# Operación: Fase 6

## Frontera obligatoria de entornos

- Staging: `hgocyrzhgohetfpzbmfs`.
- Proyecto final/producción: `ewntlvugbopokdrvnwvg`.
- El vínculo local de `supabase/.temp` puede apuntar al proyecto final. Mientras siga así, está prohibido usar `--linked` para QA: cada comando debe llevar `--project-ref hgocyrzhgohetfpzbmfs` o una URL validada de staging.
- E21 del 24 de septiembre de 2026 quedó en **NO-GO**. No ejecutar el corte gradual hasta cerrar el checklist del expediente E21 y repetir un restore fresco.

## Verificaciones continuas

- `npm run test` cubre el importador y la clasificación del monitor de medios.
- `npm run test:browser` usa un TSV controlado e inspecciona la ficha de lanzamiento y los iframes de Bandcamp, SoundCloud y Spotify.
- `npm run verify:media -- --output reports/media-health.json` hace solicitudes `HEAD` (con fallback mínimo `GET` cuando el proveedor lo rechaza), registra estado y URL final, y no escribe ni borra datos del catálogo. El workflow programado conserva el resultado como artefacto para revisión editorial.

Un `403` o un fallo de CORS no significa automáticamente que una portada o reproductor esté roto: se revisa el informe junto con una prueba en navegador antes de cambiar datos editoriales.

## Despliegue desde GitHub Actions

`deploy.yml` es **manual** (`workflow_dispatch`) hasta E22: un push o merge a `main` no publica. Para desplegar: Actions > "Build y publicar rama dist" > Run workflow, eligiendo `main` (desde otra rama falla a propósito). El workflow compila con Node 22 (`.nvmrc`) y publica `build/` en la rama `dist`.

Las variables se crean en GitHub en Settings > Secrets and variables > Actions > pestaña **Variables** (no Secrets). Son públicas: `VITE_*` se incrusta en el bundle del navegador, así que nunca se guarda ahí una `service_role`, `sb_secret_` ni cadena de conexión.

| Variable | Obligatoria | Valor | Si falta |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Sí | URL `https://<ref>.supabase.co` del proyecto que se publica | El workflow falla antes del build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sí | Clave publicable (`sb_publishable_…`) o anon del mismo proyecto | El workflow falla antes del build |
| `VITE_CATALOG_SOURCE` | No | `legacy` o `canonical` | `legacy` |
| `VITE_EDITORIAL_ENABLED` | No | `true` o `false` | `false` |
| `VITE_ADMIN_CATALOG_ENABLED` | No | `true` o `false` | `false` |
| `VITE_BETA_INVITATION_ENABLED` | No | `true` o `false` | `false` |

El paso "Verificar variables de despliegue" también rechaza una URL que no sea `https://`, una clave `sb_secret_` o un JWT con `role=service_role`, y valores fuera de `legacy|canonical` o `true|false`. Hasta E22, las cuatro opcionales se dejan sin crear (o en sus valores seguros).

### Ajustes para el despliegue por Git de Hostinger

Hostinger no compila: copia lo que haya en la rama `dist` (ver el [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md#2-cómo-se-va-a-desplegar)). Dos ajustes de `deploy.yml` lo respaldan:

- **`force_orphan: false` (y `keep_files: false`) en la publicación a `dist`.** Cada despliegue añade un commit encima de la rama en vez de reescribirla. Hostinger actualiza su copia desde esa rama y su documentación no dice cómo reacciona a una historia reescrita; con commits encima, el avance es siempre un fast-forward. `keep_files: false` (el valor por defecto, escrito explícito) hace que el build reemplace el contenido de `dist` y no se acumulen archivos de despliegues anteriores. El rollback pasa a ser un commit que revierte el último, no un force-push.
- **Solo corre desde `main`.** El primer paso, "Verificar rama", comprueba `github.ref == refs/heads/main` antes de instalar o compilar. Desde otra rama el job **falla** con el mensaje "Producción solo sale de main", en vez de omitirse (un `if:` a nivel de job lo marcaría como omitido y pasaría desapercibido). Para desplegar, fusiona el PR en `main` y lanza el workflow eligiendo `main`.

### Conexión de Hostinger a `dist` (2026-10-14)

Conectada desde hPanel (biblioteca.discotica.com → Avanzado → Git):

| Dato | Valor |
| --- | --- |
| Repositorio | `discotica/biblioteca` (app de Hostinger instalada solo para ese repositorio) |
| Rama | `dist` |
| Directorio raíz | `public_html` |
| Despliegue automático | Activado ("Implementación automática") |
| Primer despliegue | 2026-10-14 09:39 (hora local), 3 s, "Se ha completado", disparado a mano al conectar |
| Commit desplegado | `3c137d7` ("deploy: 0ab31e0"), el mismo que ya estaba en vivo |

- **Dónde ver un despliegue:** hPanel → biblioteca.discotica.com → Avanzado → Git. "Último despliegue" muestra estado, rama, directorio y hora; "Todos los despliegues" abre el historial (Deployments) con el registro de cada uno (commit clonado, publicación). "Redistribuir" repite el último.
- **Hostinger no compila:** el registro solo clona la rama, instala dependencias de Composer (ninguna) y publica. Lo que hay en `dist` es lo que se sirve.
- **Nunca se suben archivos a mano** al Administrador de archivos ni por FTP: el siguiente despliegue los pisaría. Todo cambio entra por PR a `main` y Run workflow.
- **Comprobación del 2026-10-14:** `index.html` del sitio y el de `origin/dist` son idénticos (SHA-256 `37d92de8…`) y comparten los 10 `_app/immutable/...`. `Last-Modified` 14:39:49 GMT, dos segundos después del inicio del despliegue (09:39:47 hora local = 14:39:47 GMT). Una ruta profunda de artista (`/artista/pepito-perez`) responde 200 con el `index.html`; `/.htaccess` responde 403.
- **No probado:** el despliegue automático ante un push real a `dist`. Se verá en el primer Run workflow (ensayo en E22-A o corte en E22-B); entonces debe aparecer un despliegue nuevo en "Todos los despliegues" y cambiar los `_app/immutable/...`.

### Ruleset de `main` (2026-10-14)

Ruleset `main` (id 25086558), activo, sobre la rama por defecto, sin actores con bypass:

- Requiere pull request antes de fusionar (0 aprobaciones requeridas).
- Requiere el check `verify` (job de `ci.yml`, GitHub Actions) sin exigir la rama al día.
- Bloquea borrar la rama y los force-push (`non_fast_forward`).

Verificado con `gh api repos/discotica/biblioteca/rulesets` y `rules/branches/main`. Sin bypass, ni los administradores pueden hacer push directo a `main`.

`ci.yml` no usa estas variables: define valores ficticios propios (ref de staging de las pruebas, clave de relleno, flags seguros) para que el build y el servidor de Playwright no lancen. Ninguna prueba de la CI toca Supabase real.

## Restauración y rollback

Antes de cada corte a producción, una segunda persona debe comprobar que puede acceder al backup externo y ejecutar el simulacro en una base aislada:

1. Levantar un stack local aislado (`project_id` propio, puertos 544xx, carpeta de migraciones **vacía**), parar los contenedores de auth y storage, y preparar el destino con `simulacro/prep-target.sql` del backup. Ese script borra `auth` y `storage` y alinea los privilegios por defecto con los de staging; el motivo está en el simulacro del 2026-10-14.
2. Restaurar con `pg_restore -U supabase_admin -d postgres <dump>`, sin `--clean` ni `--no-owner`. El dump trae el esquema y el historial de migraciones, así que no se aplica ninguna. El único error aceptable es `schema "public" already exists`.
3. Verificar conteos y sumas de control por tabla (`simulacro/inventory.sql`) y la estructura (`simulacro/structure-lines.sql`) contra el manifiesto del backup, y los objetos de Storage.
4. Ejecutar `npm run test`, `npm run build` y una consulta anónima de `catalog_releases` contra la base restaurada.
5. Registrar fecha, hash del dump, responsable y resultado en `estado.md` o en el ticket del despliegue.

La ausencia de Docker/`pg_restore`, un listado vacío de backups o un dump no generado son fallos del gate; nunca cuentan como simulacro. El restore debe incluir catálogo, crates, contribuciones, reportes y los objetos de Storage existentes.

El rollback de la aplicación es reversible: se recompila con `VITE_CATALOG_SOURCE=legacy`, `VITE_EDITORIAL_ENABLED=false`, `VITE_ADMIN_CATALOG_ENABLED=false` y `VITE_BETA_INVITATION_ENABLED=false`. No se eliminan TSV, JSON, slugs heredados ni `crate_items.lanzamiento_slug`. Las migraciones ya aplicadas no se revierten en producción durante un incidente: se recupera en una base aislada, se corrige con una migración nueva y se vuelve a validar.

## Registro de simulacros

### 2026-10-14 — S8: dump de staging y restauración local, conteos idénticos

- **Vía B.** Usa la cadena de `E06_STAGING_DATABASE_URL` (`.env.local`), con autorización explícita del usuario en el chat. No se mostró ni se copió.
- **Destino comprobado antes de volcar**, con dos señales:
  - el usuario del pooler (`aws-0-us-east-1.pooler.supabase.com:5432`) lleva el ref `hgocyrzhgohetfpzbmfs`;
  - `inet_server_addr()` = `2600:1f18:38df:9502::a50a`, igual al DNS de `db.hgocyrzhgohetfpzbmfs.supabase.co`. El de `ewntlvugbopokdrvnwvg` es otro, y ese proyecto no se tocó.
  - Servidor: PostgreSQL 17.6.
- **Dump:**
  - `pg_dump` 17.6, de la imagen `supabase/postgres:17.6.1.165`, la misma versión que el servidor.
  - Formato custom, con sesión `default_transaction_read_only=on`.
  - Esquemas `public`, `private`, `auth`, `storage` y `supabase_migrations`: 69 tablas y 784 entradas TOC. Duró 23 s y pesa 2,9 MB.
  - Ruta: `../discotica-backups/2026-10-14-staging/staging-hgocyrzhgohetfpzbmfs-2026-10-14.dump`, más `SHA256SUMS`, el manifiesto de staging y los scripts del simulacro en `simulacro/`.
  - **SHA-256 del dump:** `8671fbdb8cf1137a08b9242e067b4d3d3ec0f9429ceaf116c310429f96e742bb`.
  - El inventario de staging (filas y md5 por tabla) se tomó antes y después del volcado y es idéntico: staging no cambió durante el dump.
- **Storage:** un bucket privado (`contribution-covers`) con **0 objetos**. No hay archivos que descargar.
- **Restauración:**
  - Stack aislado `discotica-s8`, puertos 544xx, migraciones vacías, PostgreSQL `17.6.1.165`.
  - Duró 29 s desde `supabase start` hasta la base restaurada, con un solo error esperado (`schema "public" already exists`).
- **Comparación con staging**, en solo lectura y con `TimeZone=UTC`:
  - **Datos:** 69/69 tablas con filas y md5 (`string_agg` de cada fila ordenada) idénticos. Destacan `releases` 2.790, `release_artists` 9.298, `release_genres` 8.138, `release_covers` 2.782, `release_links` 2.783, `artists` 4.669, `labels` 461, `crates` 2, `crate_items` 4, `contributions` 1, `profiles` 8, `auth.users` 8 y `supabase_migrations.schema_migrations` 23 (última `20260918184855`).
  - **Estructura:** idéntica línea a línea en 31 políticas, 42 funciones (cuerpo, `SECURITY DEFINER`, `search_path`, dueño y ACL), 10 triggers, 215 índices, 75 ACL de tabla, vista y secuencia, 3 ACL de columna, 5 esquemas y 13 privilegios por defecto.
- **Prueba de humo sobre el stack restaurado:**
  - `anon` lee `catalog_releases` (2.790) y las colecciones públicas;
  - `anon` recibe `42501` en `contributions`, `catalog_import_keys` y la RPC `admin_list_catalog_releases`;
  - auth y storage responden, y el bucket conserva sus límites de MIME y tamaño;
  - `npm run test` da 156/156, y `vite build` contra el stack funciona.
- **Diferencias encontradas y resueltas en el procedimiento.** El primer intento no reprodujo staging. No eran fallos del dump:
  1. **`pg_restore --clean` falla en `storage`.** El stack local trae tablas que staging ya retiró (`iceberg_*`), y sus FK impiden borrar `buckets_analytics`. Además, auth y storage de staging van por delante del stack local (82 frente a 77 migraciones de auth, 73 frente a 63 de storage). Solución: borrar `auth` y `storage` en el destino y restaurarlos completos desde el dump.
  2. **Grants de más para `anon`.** Los privilegios por defecto estándar del destino (los de `supabase_admin` y `postgres` en `public`) conceden todo a `anon`, `authenticated` y `service_role` al crear cada objeto. `pg_dump` solo revoca lo que difiere del ACL base de Postgres, así que no los quita. Resultado: `anon` con `EXECUTE` sobre las RPC de admin y de contribuciones. Solución: revocar esos privilegios por defecto antes de restaurar; el dump vuelve a poner los de staging al final.
  3. **Ajuste global fuera del dump.** Staging tiene `alter default privileges for role postgres revoke execute on functions from public` sin esquema, y `pg_dump -n` no lo incluye. `prep-target.sql` lo replica. **Al restaurar en un proyecto nuevo** (incluida la copia de E22-A), hay que replicarlo también, o las funciones que se creen después quedarán ejecutables por `PUBLIC`.
- **Dictamen E21-P0-02: CERRADO.** Hay dump con checksum y una restauración local con conteos, sumas de control y estructura idénticos por tabla. B10 no se toma aquí: la referencia es la hoja limpia (`decisiones.md`), y su snapshot y la comparación son del paso 8.
- **Pendiente del usuario:** copiar `../discotica-backups/2026-10-14-staging/` fuera de este disco y comprobarlo con `shasum -a 256 -c SHA256SUMS`. S9 exige un backup del mismo día: este vale para el 2026-10-14; otro día hay que repetir el dump.

### 2026-10-12 — S8: simulacro de restauración NO EJECUTADO; snapshot legado (B10) generado

- **Vía:** ninguna. No existe backup descargable (vía A) ni se dio cadena de conexión de staging (vía B). Por decisión del usuario, S8 continúa sin dump de staging y sin reemplazar la base de staging.
- **Dump de staging y restauración local (pasos 1 y 2):** no ejecutados. No hay conteos por tabla ni sumas de control staging/restaurado que comparar.
- **Dictamen E21-P0-02: ABIERTO.** Sin dump no hay restore fresco; esto es un fallo del gate, no un simulacro. Sigue bloqueando S9 (aplicar E18, D1, D2, S6, S7 en staging).
- **B10, snapshot del TSV publicado (E21-P1-05):**
  - Origen: `TSV_URL` de `src/lib/utils/catalogoStore.ts` (Google Sheets publicado, solo lectura). HTTP 200, 710.603 bytes, ~2 s, UTF-8/CRLF.
  - Ruta: `../discotica-backups/2026-10-12-legado-tsv/catalogo-publicado.tsv` (+ `SHA256SUMS` en la misma carpeta).
  - SHA-256: `83f29cda647d2903e31e7ebfe90ff10e13bac3e91e9c0784f3124908e7b0add7`.
  - Procedimiento E01 (`npm run import:catalog -- --input … --allow-derived-keys --keep-invalid --dry-run`, sin escritura): `records: 2789`, `derivedKeys: 0`, `rejectedRows: 7`, 34 advertencias.
  - **Diferencias frente a lo esperado:** son 2.789 filas, no 2.796 (−7). Los rechazos son 7, no 6: títulos vacíos (filas 677, 1269, 1365, 1511, 2116), `sintético` fuera de rango (1441) y fila 1631 sin artista (nueva). El hash no coincide con `eb40f961…` (TSV con `catalog_key` de `estado.md`, 2.796 filas) ni con `22ab9cfc…` (respaldo 2026-08-30, sin `catalog_key`). La hoja publicada cambió desde esos snapshots; el contenido de 2.796 filas no se puede reconstruir desde esta fuente.
  - Dictamen B10: snapshot fresco generado, pero **no cumple las 2.796 filas esperadas**; el criterio de E21-P1-05 queda pendiente de que el usuario decida cuál es la fuente legado de referencia.

## Corte gradual

1. Aplicar y validar Fases 4 y 5 en staging, incluido un admin editorial y Storage.
2. Activar `VITE_CATALOG_SOURCE=canonical` solamente en staging; comparar rutas, filtros, crates y la matriz de proveedores.
3. Ejecutar simulacro de restauración y el monitor de medios; resolver únicamente fallos confirmados en navegador.
4. Activar el catálogo canónico en producción y observar el informe diario. Mantener la fuente legado y el flag de reversión disponibles.
5. Retirar el legado únicamente tras un periodo acordado sin regresiones y con una restauración reciente verificada.
