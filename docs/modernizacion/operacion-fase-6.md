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

`ci.yml` no usa estas variables: define valores ficticios propios (ref de staging de las pruebas, clave de relleno, flags seguros) para que el build y el servidor de Playwright no lancen. Ninguna prueba de la CI toca Supabase real.

## Restauración y rollback

Antes de cada corte a producción, una segunda persona debe comprobar que puede acceder al backup externo y ejecutar el simulacro en una base aislada:

1. Crear una base temporal vacía y restaurar el dump lógico con `pg_restore --clean --if-exists --no-owner`.
2. Aplicar las migraciones hasta la misma versión registrada en `supabase migration list`.
3. Verificar conteos de `releases`, `crate_items`, `contributions` y objetos de Storage contra el manifiesto del backup.
4. Ejecutar `npm run test`, `npm run build` y una consulta anónima de `catalog_releases` contra la base restaurada.
5. Registrar fecha, hash del dump, responsable y resultado en `estado.md` o en el ticket del despliegue.

La ausencia de Docker/`pg_restore`, un listado vacío de backups o un dump no generado son fallos del gate; nunca cuentan como simulacro. El restore debe incluir catálogo, crates, contribuciones, reportes y los objetos de Storage existentes.

El rollback de la aplicación es reversible: se recompila con `VITE_CATALOG_SOURCE=legacy`, `VITE_EDITORIAL_ENABLED=false`, `VITE_ADMIN_CATALOG_ENABLED=false` y `VITE_BETA_INVITATION_ENABLED=false`. No se eliminan TSV, JSON, slugs heredados ni `crate_items.lanzamiento_slug`. Las migraciones ya aplicadas no se revierten en producción durante un incidente: se recupera en una base aislada, se corrige con una migración nueva y se vuelve a validar.

## Registro de simulacros

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
