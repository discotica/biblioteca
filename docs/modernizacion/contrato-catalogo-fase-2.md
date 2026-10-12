# Contrato de catálogo canónico — Fase 2

Actualizado: 2026-08-30.

Este contrato crea el catálogo nuevo sin cambiar el consumidor TSV actual ni las tablas de crates existentes.

## Identidad y relaciones

- `releases.id` es UUID inmutable. Las relaciones nuevas lo usan como clave foránea.
- `catalog_import_keys(source_name, source_key)` vincula una fila editorial con un único `release_id`; importar de nuevo la misma clave actualiza ese lanzamiento en una transacción.
- La fuente debe publicar `catalog_key` (o una columna indicada con `--source-key-column`) para que los cambios de título, artista o fecha no creen otro lanzamiento.
- `--allow-derived-keys` solo sirve para una primera carga controlada de un TSV sin clave editorial. Deriva una clave del contenido y es idempotente únicamente mientras ese contenido no cambie.
- `releases.slug` es canónico, único y estable. `release_slug_aliases` conserva cada slug legado. Los alias legado pueden ser ambiguos porque ya existen colisiones; Fase 3 decidirá la redirección o la pantalla de desambiguación.

Las entidades `artists`, `labels`, `genres`, `countries` y `release_types` se normalizan por una clave sin tildes/espacios y se unen mediante tablas de relación. Las grafías editoriales iniciales se conservan como nombre visible.

## Exposición y seguridad

- Todas las tablas nuevas de `public` tienen RLS activado.
- `anon` y `authenticated` solo obtienen lectura de lanzamientos `published` y sus relaciones; no tienen políticas de escritura.
- La vista `public.catalog_releases` usa `security_invoker = true` y ofrece la forma pública agregada para la futura capa de API.
- El importador invoca `private.import_catalog_release(jsonb)` mediante una conexión de administración directa. La función usa `SECURITY INVOKER`, el esquema `private` no se expone y `anon`/`authenticated` no tienen ejecución.

## Ejecutar en local/staging

Primero aplicar las migraciones únicamente al entorno local o staging. No se debe enlazar ni ejecutar `db push` contra producción durante esta fase.

```sh
npx supabase start
npx supabase db reset --local
```

Validar un TSV sin escribir:

```sh
npm run import:catalog -- --input ../discotica-backups/2026-08-30/catalogo-publicado.tsv --allow-derived-keys --dry-run
```

Cuando el reporte no tenga errores estructurales, importar a staging usando una URL de base de datos de administración que no se registre en Git:

```sh
DATABASE_URL='postgresql://…' npm run import:catalog -- --input ruta/al/catalogo.tsv --source-key-column catalog_key
```

Si la contraseña contiene `!`, `@`, `#` u otros caracteres especiales, es más seguro usar las variables estándar de PostgreSQL en vez de escribirla dentro de una URL:

```sh
export PGHOST='aws-REGION.pooler.supabase.com' PGPORT=5432
export PGUSER='postgres.PROJECT_REF' PGDATABASE='postgres'
read -rs PGPASSWORD; echo
export PGPASSWORD
npm run import:catalog -- --input ruta/al/catalogo.tsv --source-key-column catalog_key --keep-invalid --dry-run
unset PGPASSWORD PGHOST PGPORT PGUSER PGDATABASE
```

Para conservar filas inválidas sin publicarlas, añadir `--keep-invalid`. Las filas válidas se importan y cada rechazo queda en `catalog_import_rejections` con la fila TSV original y sus errores; no se le asignan título, radar ni URL de reemplazo.

```sh
DATABASE_URL='postgresql://…' npm run import:catalog -- --input ruta/al/catalogo.tsv --source-key-column catalog_key --keep-invalid
```

El reporte JSON indica filas creadas/actualizadas/rechazadas y advertencias. Las URLs inválidas se guardan dentro de `source_payload` para trazabilidad, pero no se publican como enlace o portada.
Si una fila repite un artista, el TSV crudo se preserva y el reporte lo señala; el catálogo canónico guarda una sola relación para ese artista y lanzamiento.

## Crear `catalog_key` en Google Sheets

`catalog_key` es una columna editorial de texto, no una fórmula permanente ni un slug. Se asigna una sola vez y nunca cambia aunque se edite artista, título, fecha o se reordenen filas.

1. Conservar una copia del TSV actual y generar una tabla de claves antes de añadir la nueva columna:

   ```sh
   npm run catalog:keys -- ../discotica-backups/2026-08-30/catalogo-publicado.tsv > /tmp/discotica-catalog-keys.tsv
   ```

2. En la pestaña editorial de Google Sheets, crear una columna llamada exactamente `catalog_key`.
3. Copiar la segunda columna de `/tmp/discotica-catalog-keys.tsv` y pegarla como **valores** en la primera fila de datos de la columna nueva. Para este snapshot, las claves van de `rel_000001` a `rel_002796`.
4. Para un lanzamiento nuevo, usar el siguiente número disponible (por ejemplo, `rel_002797`). No reutilizar ni editar una clave asignada, incluso si se borra una fila.
5. Publicar el TSV y ejecutar la validación sin `--allow-derived-keys`; el reporte debe mostrar `derivedKeys: 0`.

Si ya existe una columna `catalog_key`, `npm run catalog:keys -- ruta/al/catalogo.tsv` solo muestra sus valores actuales para auditoría; no los reemplaza.

## Datos que requieren corrección editorial

El snapshot `catalogo-publicado.tsv` respaldado el 2026-08-30 contiene 2.796 filas, mientras que `static/lanzamientos.json` auditado contiene 622. Son fuentes distintas y no deben mezclarse en una misma carga sin reconciliación editorial.

La validación del snapshot detectó seis errores estructurales: cinco títulos vacíos y un valor de radar fuera del intervalo 0–5. Se preservarán como rechazos de importación al usar `--keep-invalid`; no se corrigen automáticamente ni aparecen en la API pública. También reportó diez URLs inválidas que pueden importarse como advertencias, sin exponerlas públicamente.

| Fila TSV | Artista | Campo señalado | Valor actual |
| ---: | --- | --- | --- |
| 681 | Adrian Oblanca, 98RPM, Fabio Guarriello, LØUIS | `title` | vacío |
| 1273 | Dj Babatr, Dj Deep Rh, Angel Linares, Dj Loop, Armand Dj, Lemand, Voglia, Chuma, Ronald P, Armand dj, Huakai, Dero | `title` | vacío |
| 1369 | Entrañas, PVSSY, NTFL, 2AT, Aleroj, Kid Chainz, Cimarrón | `title` | vacío |
| 1445 | Regal86 — *The Homiecides* | `sintético` | `6` |
| 1515 | Toby, Bass Playah, Imanol, Emiliano Mustafa, Dany F, Dr. Húmedo | `title` | vacío |
| 2122 | Verraco, Mary Herzer, Chevel, Stenny, Konx-om-Pax | `title` | vacío |
