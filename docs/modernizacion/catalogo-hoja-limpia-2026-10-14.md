# Catálogo de staging reemplazado con la hoja limpia — 2026-10-14

Paso 8 del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md). Aplica la decisión "Hoja limpia como fuente del lanzamiento" de [`decisiones.md`](./decisiones.md):
- la hoja manda en todo lanzamiento con `catalog_key`;
- cada lanzamiento se empareja por clave y conserva su UUID;
- lo que la hoja ya no tiene se archiva, nunca se borra.

Solo se tocó staging (`hgocyrzhgohetfpzbmfs`). Producción no se tocó.

## Resumen

- **Staging:** desde las 03:34 UTC del 2026-10-15 tiene publicados exactamente los 2.782 lanzamientos válidos de la hoja.
  - 667 lanzamientos se actualizaron y 2.115 no cambiaron.
  - 8 se archivaron y ninguno se borró.
  - 34 entradas de diccionario sin uso se borraron.
- **Hoja usada:** es la publicada a esa hora, **sin las dos correcciones** que el usuario había decidido (ver "Decisiones del usuario"). Lo decidió el propio usuario: reemplazar ya con la hoja tal como estaba.
- **Comprobaciones:**
  - las 14 comprobaciones posteriores dieron OK;
  - la regresión de E06, D2 y S7 está en verde;
  - la prueba de humo dio 12/12.
- **Importador nuevo:** migración `20261014203000_catalog_sheet_replace_import.sql`, más las opciones `--archive-missing` y `--prune-dictionaries`.

## Snapshot de la hoja

- **Origen:** `TSV_URL` de `src/lib/utils/catalogoStore.ts` (pestaña `gid=1229139332`). HTTP 200, 710.603 bytes, UTF-8 con CRLF.
- **Ruta:** `../discotica-backups/2026-10-14-hoja-limpia/catalogo-hoja-limpia.tsv`, con `SHA256SUMS` y `analisis/`, que guarda la prueba en seco, las diferencias, el export previo de staging, los scripts y los informes.
- **SHA-256:** `83f29cda647d2903e31e7ebfe90ff10e13bac3e91e9c0784f3124908e7b0add7`.
  - Es **idéntico al snapshot B10 del 2026-10-12**: la hoja publicada no cambió entre el 12 y el 14 de octubre.
  - Las claves siguen en orden estricto (`rel_000001…rel_002796`, sin inversiones), así que el orden de las filas es el de agosto.
- **Frente al respaldo del 2026-08-30:**
  - faltan 7 filas;
  - cambian los géneros de 679 filas y el sello de 24 (BODY MUSIC → BODY MUSICK);
  - hay correcciones sueltas en 6 filas.

## Prueba en seco

`npm run import:catalog -- --input … --dry-run`, sin `--allow-derived-keys`: 2.789 filas, `derivedKeys: 0`, 7 filas rechazadas y 34 advertencias.

| Fila | Clave | Artista / título | Campo | Valor |
| ---: | --- | --- | --- | --- |
| 677 | rel_000680 | Adrian Oblanca, 98RPM… | `title` | vacío |
| 1269 | rel_001272 | Dj Babatr, Dj Deep Rh… | `title` | vacío |
| 1365 | rel_001368 | Entrañas, PVSSY, NTFL… | `title` | vacío |
| 1441 | rel_001444 | Regal86 — The Homiecides | `sintético` | `6` |
| 1511 | rel_001514 | Toby, Bass Playah… | `title` | vacío |
| 1631 | rel_001634 | — / REUNION | `artist` | vacío (en staging: ROOi, EL PLVYBXY) |
| 2116 | rel_002121 | Verraco, Mary Herzer… | `title` | vacío |

Las advertencias no impiden importar. La fila se carga sin el enlace o la portada inválidos, o con una sola relación por artista:

- **URLs dañadas por un buscar y reemplazar en la hoja:**
  - `malReino Unidoo.bandcamp.com` en las filas 203, 348, 544 y 614 (probablemente `maluko`);
  - `Latin Core.bandcamp.com` en las filas 205 y 277 (probablemente `latincore`);
  - texto en lugar de URL en la fila 55.
- **Portadas `data:image` en base64** en las filas 1095, 1107 y 1202.
- **24 artistas repetidos dentro de una misma fila.**

## Informe de diferencias (antes del reemplazo, en solo lectura)

- **Staging antes del reemplazo:** 2.790 lanzamientos, todos `published` y `legacy`, todos con clave de importación de `google-sheets-tsv`.

| | Lanzamientos |
| --- | ---: |
| Nuevos | 0 |
| Cambiados | 667 |
| Iguales | 2.115 |
| Claves de staging que la hoja ya no tiene | 7 |
| Filas rechazadas en la hoja que existen en staging | 1 (rel_001634) |
| Lanzamientos sin clave de importación (Estudio o Sugerir) | 0 |

- **Qué cambia:**
  - **géneros, en 660 lanzamientos:** se quitan Hard, Progressive, Dark, Minimal, Tech, Synth y Psy, entre otros, y "Reggaetón" pasa a "Reguetón". El informe inicial decía 665; 5 de esas filas solo repiten un género dentro de la fila, y el importador las trata como conjunto;
  - **sello BODY MUSIC → BODY MUSICK**, en 24 lanzamientos;
  - **artistas principales**, en 3: rel_000002, rel_001307 y rel_001638;
  - **un caso** cada uno de país (rel_000060), enlace (rel_000355 y rel_001638), fecha, tipo, radar y portada (los cuatro en rel_001638).
- **Claves que faltan en la hoja:** rel_000117, rel_000412, rel_000647, rel_000654, rel_001740, rel_001923 y rel_002299.
  - Seis son sample packs o drum kits; la séptima es *Los Reyes de la Nueva Era*.
  - Ninguna estaba en colecciones, reportes ni propuestas.
- **Edición del Estudio que el reemplazo pisa:** la única desde la carga de agosto.
  - Es rel_000002, *Killing Mariposas*, del 2026-10-03: 9 artistas principales pasaron a colaboradores.
  - La hoja no tiene columna de colaboradores, así que vuelven a ser principales.
- **Grafías que el importador no aplica:**
  - Son 386 diferencias de solo mayúsculas o tildes, por ejemplo "Republica Dominicana" (37), "Hiedrah Club de Baile" (38) o "Nick Leon" (9).
  - El diccionario conserva la primera grafía que entró (`normalized_name`).
- **Restos en los diccionarios:** un sello y un género de prueba de E06 ("E06 Direct …").

### Tabla de cambios de identidad (la usa E22)

Lanzamientos publicados cuyo título o primer artista cambió. El slug canónico no cambia. El slug legado nuevo se añade como alias, y el anterior se conserva.

| Clave | Antes | Después | Slug legado anterior | Slug legado nuevo | Slug canónico |
| --- | --- | --- | --- | --- | --- |
| rel_001638 | Rio Zur, DANT3 — Dark Perreo | OH MARGÓ — Dark Perreo | `dark-perreo-rio-zur` | `dark-perreo-oh-margo` | `dark-perreo-rio-zur--7f6ac422` |

Los dos slugs legados resuelven por alias al mismo lanzamiento (`9f3987d8-…`).

## Decisiones del usuario (2026-10-14)

1. **rel_001634 (REUNION):** el usuario devuelve el artista en la hoja. Mientras no se publique, la fila sigue rechazada y el lanzamiento está **archivado**.
2. **rel_000002:** se acepta que los colaboradores vuelvan a ser principales, como dice la hoja.
3. **Las 7 claves ausentes:** se archivan.
4. **rel_001638:** parece otro lanzamiento escrito encima de la misma fila.
   - Se decidió dar a la fila de OH MARGÓ una clave nueva (`rel_002797`).
   - **Esa clave todavía no está en la hoja**, así que el lanzamiento conserva su UUID y ahora muestra los datos de OH MARGÓ.
5. **Grafías:** quedan fuera de este paso y se corrigen en el Estudio.
6. **Orden:** el sitio sigue ordenando por fecha e ID. El orden de la hoja no se traslada.
7. **Diccionarios:** se borra lo que ya no use ningún lanzamiento.

Los cambios 1 y 4 seguían sin publicarse a las 21:43 (hora de Bogotá). El usuario eligió reemplazar con la hoja tal como estaba. **Cuando la hoja traiga esos cambios hay que repetir el reemplazo**, con el mismo comando:

- REUNION volverá a publicarse sola (`republished`);
- se creará `rel_002797`;
- rel_001638 se archivará. Ese lanzamiento conserva los datos de OH MARGÓ, y los de Rio Zur solo quedan en el dump post-S9 y en la fila `source_payload` anterior de ese dump.

## El importador

Migración `20261014203000_catalog_sheet_replace_import.sql`. Redefine `private.import_catalog_release`; la versión anterior es la de `20260915204413`. La firma no cambia.

- **Al actualizar:**
  - si la fila no cambió, no se escribe nada, ni el lanzamiento, ni sus relaciones, ni los diccionarios, y la acción es `unchanged`;
  - si algo cambia, sube `catalog_version`. Así, una edición del Estudio con una versión anterior da conflicto en lugar de pisar la importación;
  - **conserva `status`.** Solo republica lo que el propio importador archivó por ausencia, que queda marcado en `catalog_import_keys.archived_missing_at`. Un lanzamiento archivado en el Estudio sigue archivado aunque la hoja lo traiga;
  - **conserva `credit_quality`**, salvo que cambien los créditos;
  - **enlaces y portadas se sincronizan como en S7 (H4):**
    - la fila que no cambia conserva sus metadatos;
    - la portada externa que cambia de URL se actualiza en su sitio;
    - las portadas `storage` no se tocan.
  - La comparación de créditos, géneros y países se hace por id y como conjunto. Por eso una fila con un género repetido no cuenta como cambio.
- **`private.archive_missing_catalog_keys(source, claves_presentes, max)`:**
  - archiva las claves de esa fuente que no aparecen y nunca borra;
  - no toca lanzamientos sin clave ni ya archivados;
  - se niega con una lista vacía o si supera el tope.
- **`private.prune_unused_catalog_dictionaries()`:**
  - borra artistas, sellos, géneros y países que ningún lanzamiento usa, contando también los archivados;
  - conserva los artistas con historial en `catalog_artist_change_events`.
- **Permisos:** las tres funciones solo las ejecuta `postgres`.
- **Opciones nuevas de `import-catalog.mjs`:**
  - `--archive-missing` (claves presentes = filas válidas) y `--max-archive N` (por defecto 25);
  - `--prune-dictionaries`;
  - `--rollback`, que ejecuta todo y deshace: es el informe exacto sin escribir;
  - `--archive-missing` no se puede combinar con `--allow-derived-keys`.
- **Pruebas:**
  - `npm run test:catalog-import` 10/10 y `npm test` 158/158;
  - `tests/sql/catalog-sheet-replace-verify.sql`, con 9 comprobaciones;
  - control negativo: con el cuerpo de `20260915204413`, falla en la comprobación 2 (`action updated (esperado unchanged)`).

## Ensayo local

- **Cadena vacía** (stack aislado `discotica-p8`, puertos 544xx, `db reset` con las 31 migraciones):
  - la verificación nueva y su control negativo;
  - `e06-verify`, `e06-reopen-verify`, `d2-verify`, `s7-verify`, `e18-verify` y `d1-verify` en verde.
- **Dump nuevo de staging.** El del paso 6 es anterior a las migraciones del paso 7, así que se hizo otro, en solo lectura:
  - `../discotica-backups/2026-10-14-staging-post-s9/staging-hgocyrzhgohetfpzbmfs-2026-10-14-post-s9.dump`, a las 20:33 hora de Bogotá;
  - SHA-256 `2d45e1746985d2819d4e7c84ec565364473bb829a5f7a9ae6929807c1e90e92c`;
  - el inventario de staging (72 tablas) fue idéntico antes y después del volcado.
- **Restauración** en `discotica-p8r`, con migraciones vacías y el procedimiento de [`operacion-fase-6.md`](./operacion-fase-6.md#restauración-y-rollback): 72/72 tablas idénticas a staging.
- **Sobre esa copia:**
  - se aplicó la migración y se ejecutó `--rollback`, que no dejó rastro;
  - después, el reemplazo completo, con los mismos números que luego dio staging;
  - las 14 comprobaciones posteriores dieron OK y la regresión quedó en verde (`d2-verify` en su copia adaptada a staging, la del paso 7).
- **Rollback de datos ensayado** (`rollback-catalogo.sql` y `rollback-catalogo-datos.sql`, en la carpeta del dump):
  - borra y recarga desde el dump las 14 tablas del catálogo en una transacción, con `session_replication_role = replica`, y después comprueba la integridad referencial;
  - resultado: las 14 tablas idénticas al dump; `catalog_import_keys` también, sin contar la columna nueva;
  - la migración no se revierte.

## Staging

Se hizo con autorización del usuario. El destino se comprobó con dos señales en cada sesión: el ref en la URL del pooler, y `inet_server_addr()` = `2600:1f18:38df:9502::a50a`, que es el DNS de `db.hgocyrzhgohetfpzbmfs`.

1. **Antes del primer cambio,** staging era idéntico al dump post-S9.
2. **Migración:**
   - `migration list --project-ref` mostró 30 aplicadas y solo `20261014203000` pendiente;
   - se hizo un `db push --dry-run` y después el `db push` real, aplicado el 2026-10-15 a las 02:27 UTC;
   - el workdir temporal no tenía `.temp/project-ref`;
   - después: 31 migraciones, ACL solo `postgres` y `catalog-sheet-replace-verify.sql` OK;
   - ningún dato cambió; solo la columna nueva, vacía.
3. **Vista previa:** `--keep-invalid --archive-missing --prune-dictionaries --rollback`, con el mismo resultado que el ensayo. Tardó 8 min 15 s y no dejó cambios.
4. **Reemplazo:**
   - mismo comando sin `--rollback`, entre las 03:26 y las 03:34 UTC, en una sola transacción;
   - `DATABASE_URL` se tomó de `E06_STAGING_DATABASE_URL` sin mostrarla;
   - resultado: 667 `updated`, 2.115 `unchanged`, 0 `created`, 7 rechazos registrados y 8 archivados (los 7 ausentes más REUNION, con 0 ítems de colección);
   - diccionarios podados: 30 géneros, 2 sellos (BODY MUSIC y el de prueba de E06), 1 país (Jamaica) y 1 artista (DANT3).
5. **Comprobaciones en solo lectura** (las 14 en OK):
   - publicados = las 2.782 filas válidas;
   - ninguno publicado sin clave o con clave fuera de la hoja;
   - ningún lanzamiento borrado y ningún slug canónico cambiado;
   - ningún alias perdido;
   - ninguna referencia huérfana en `crate_items`, `problem_reports` ni `contributions`;
   - los 4 ítems de colección conservados y todos publicados.
6. **Regresión, transaccional:** `e06-verify`, `e06-reopen-verify`, `d2-verify` (copia adaptada a staging) y `s7-verify` en verde.
7. **Prueba de humo** (`.env.local`, Playwright y la cuenta QA, sin escrituras): 12/12.
   - El inicio muestra "2782 lanzamientos", y una ficha muestra BODY MUSICK.
   - La colección pública "Cumbias Electrónicas" conserva sus 3 ítems.
   - El Estudio carga el catálogo y el inicio. Sus conteos son total 2.790, incompletos 15 y sin portada 8.
   - No hubo errores de consola ni respuestas ≥ 400.

### Conteos antes y después

| Tabla | Antes | Después |
| --- | ---: | ---: |
| `releases` publicados / archivados | 2.790 / 0 | 2.782 / 8 |
| `release_artists` | 9.298 | 9.296 |
| `release_genres` | 8.138 | 7.420 |
| `release_countries` | 2.966 | 2.965 |
| `release_links` | 2.783 | 2.783 |
| `release_covers` | 2.782 | 2.782 |
| `release_slug_aliases` | 2.790 | 2.791 |
| `catalog_import_rejections` | 6 | 7 |
| `artists` | 4.669 | 4.669 (+OH MARGÓ, −DANT3) |
| `labels` | 461 | 460 (+BODY MUSICK, −BODY MUSIC, −prueba E06) |
| `genres` | 71 | 41 |
| `countries` | 48 | 47 |
| `crates` / `crate_items` | 2 / 4 | 2 / 4 |

Inventarios completos en `analisis/` (`inventario-staging-despues.txt`) y en la carpeta del dump.

## Rollback en staging (no ejecutado)

Solo con autorización. Hay que lanzarlo desde la carpeta del dump, con la cadena de staging:

```sh
psql "$URL" -v ON_ERROR_STOP=1 -1 -f rollback-catalogo.sql
```

- Devuelve el catálogo al dump post-S9 y deja intactos crates, reportes, propuestas y auditoría.
- La migración se queda aplicada. Revertirla exigiría una migración nueva que restaure el cuerpo de `20260915204413` y elimine las dos funciones y la columna.

## Pendiente

- **Repetir el reemplazo cuando la hoja traiga las correcciones 1 y 4:** antes, dump del mismo día, prueba en seco y vista previa con `--rollback`. Si la hoja ya no tiene rechazos, el comando no necesita `--keep-invalid`.
- **Corregir en la hoja,** si se quiere, las URLs dañadas y los títulos vacíos de las 5 compilaciones. Estas siguen rechazadas: no estaban publicadas antes y siguen sin publicarse.
- **Corregir las grafías en el Estudio** (decisión 5).
- **Rotar la contraseña de la base de staging.** Se expuso en el paso 7 y sigue sin rotar.
- **Copiar fuera de este disco** `../discotica-backups/2026-10-14-staging-post-s9/` y `../discotica-backups/2026-10-14-hoja-limpia/`, y comprobarlas con `shasum -a 256 -c SHA256SUMS`.
