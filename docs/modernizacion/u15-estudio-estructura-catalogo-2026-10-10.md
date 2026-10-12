# U15 — Estudio: estructura y catálogo (2026-10-10)

Etapa U15 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u15--estudio-estructura-y-catálogo). Claude Opus 5.5, esfuerzo `high`, como asigna el plan. No hubo que escalar a `xhigh`: unir las rutas no cambia los permisos efectivos de ningún rol (ver "Permisos").

Estado: **implementada, pendiente de aceptación.** La línea base visual no se recapturó. Sin commit, push, despliegue, datos ni producción. Ningún contrato de datos cambió.

## Condición de arranque

- **U7 aceptada** (2026-10-07). Su `ToolLayout` es la base del Estudio.
- **D2:** contrato aceptado según su criterio (documentado con ejemplos y rollback), **implementado solo en local y sin aplicar en staging**. `estado.md` ya decía que U15 se programa sobre ese contrato y solo se publica después de aplicar D2. Sigue igual (ver "Staging").
- **U10b a U14 implementadas, sin aceptar.** Para aislar U15, el árbol de partida se capturó en `tests/visual/.ref-pre-u15/` (164 capturas).
- **Antes de editar:**
  - E07, E10 y U7: 36/36;
  - el último `test:browser` completo, de U14 y el mismo día: 273 pasan, solo falla E17:202;
  - permisos efectivos en staging (ver "Permisos").
- **Respaldos** de cada archivo sin versionar que se reescribió, en `respaldos/*.pre-u15.*.txt`: la consola y la estación (`admin-catalogo-page`, `editorial-page`), `ToolLayout`, `Checkbox`, `Header`, `/lab`, `censo.spec`, `e07`, `e10`, y `data.ts` y `mocks.ts` de la suite visual.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Estudio en `/estudio` con el layout de U7 | `src/routes/estudio/+layout.svelte` comprueba sesión y rol una vez y pinta `ToolLayout` con las secciones del rol. Ancho completo, `data-density="compact"`, sin el pie del sitio y con el header a ancho completo. |
| Barra lateral | Catálogo (con sus cuatro vistas rápidas y su tamaño), Propuestas (pendientes) y Reportes (abiertos). |
| 2. Redirecciones con la query | `/admin/catalogo` → `/estudio/catalogo` y `/editorial` → `/estudio/propuestas`: en el cliente (`LegacyStudioRedirect`, `replaceState`) y como 301 en `static/.htaccess`, verificadas con el Apache local. |
| 3. Permisos por rol, iguales | Ver "Permisos". |
| 4. Catálogo | Tabla con la densidad de E07, vistas rápidas, selección múltiple y lote con confirmación e informe por elemento. |
| 5. Enlaces cruzados | Fila → reportes; reporte → lanzamiento y sus reportes; editor → reportes, propuestas y ficha pública; propuesta aprobada o resuelta → lanzamiento. |
| Propuestas y Reportes | La vista de `/editorial` dentro del layout nuevo, partida en dos secciones. Su rediseño es U17. |
| Editor | Sin rediseño (U16). Solo cambia cómo se abre (por URL) y gana el bloque "Relacionado". |

## Estructura de rutas y secciones

| Ruta | Qué muestra | Quién |
| --- | --- | --- |
| `/estudio` | Abre la primera sección del rol (`replaceState`, conserva la query) | admin → Catálogo; colaborador → Propuestas |
| `/estudio/catalogo` | Lista | admin |
| `?vista=borradores \| incompletos \| sin-portada \| con-reportes` | Vista rápida (D2 `p_quick_view`) | admin |
| `?lanzamiento=<uuid>` | Editor de ese lanzamiento (E07, sin cambios) | admin |
| `?nuevo=1` | Editor de un lanzamiento nuevo; con el traspaso de Sugerir si lo hay (U13) | admin |
| `/estudio/propuestas` | Colas prioritaria y comunitaria (E10) | admin decide; colaborador prepara |
| `?lanzamiento=<uuid>` | Propuestas que crearon ese lanzamiento (solo consulta) | según RLS de E09 |
| `/estudio/reportes` | Reportes (E18) | admin |
| `?lanzamiento=<uuid>` | Solo los de ese lanzamiento | admin |
| `/admin/catalogo`, `/editorial` | 301 y redirección de cliente a su sección | — |

- **Dominio puro** en `src/lib/domain/studio.ts`: secciones por rol, rutas anteriores, vistas rápidas en la URL, enlaces cruzados (`studioReleaseHref`, `studioReportsHref`, `studioProposalsHref`), `withParams` y los textos del informe del lote. Pruebas: `tests/studio.test.mjs` (9).
- **Contexto** (`src/lib/components/estudio/context.ts`): el layout da a cada sección `role`, `userId`, `sections` y `refreshCounts()`. Una sección solo se monta si su rol la ve, así que no repite la comprobación.
- **Interruptores:** Catálogo sigue detrás de `VITE_ADMIN_CATALOG_ENABLED`; Propuestas y Reportes, de `VITE_EDITORIAL_ENABLED`. Sin ninguno, el Estudio dice que está desactivado.
- **Estados del layout:** desactivado; sin sesión ("Inicia sesión", con `redirect` a la misma URL); comprobando acceso; error al leer el rol (con reintento); sin acceso (comunidad); y sección ajena al rol (aviso dentro del layout, con la barra lateral del rol y un botón a su primera sección).
- **Conteos de la barra lateral:** cada uno se pide aparte y, si falla, la sección se ve sin número. Se refrescan tras un lote, guardar, revertir, preparar, decidir o clasificar.
- **Perfil propio:** el bloque Estudio enlaza a cada sección del rol (admin: Catálogo, Propuestas, Reportes; colaborador: Propuestas). `ADMIN_NEW_RELEASE_HREF` es `/estudio/catalogo?nuevo=1`.

### Catálogo

- **Barra:** búsqueda (`Field`), Estado y Tipo (`Select` en línea, aplican al momento) y, por debajo de 1024 px, Vista (`Select`), porque ahí la barra lateral es una fila de secciones.
- **Tabla:** las columnas de E07 (selección, lanzamiento con portada de 40 y slug, artistas, tipo, sello, fecha / edición, estado, abrir) en filas de 56 px. El estado es un `Chip`; debajo, las señales de D2: "Falta: …" con los nombres de `CATALOG_MISSING_FIELD_LABELS` y "N reportes", que enlaza a los reportes del lanzamiento. Sin señales (un entorno sin D2) se usa la comprobación de cliente del editor.
- **Filas como enlaces:** el título y el "›" (`IconButton`) son enlaces a `?lanzamiento=<id>`, así que se pueden abrir en otra pestaña. "Volver al catálogo" es "atrás" si el editor se abrió desde la lista, y conserva la vista.
- **Selección:** `Checkbox` con `hideLabel` por fila y "Seleccionar los N de esta página". Se conserva entre páginas, vistas y filtros, y guarda la versión leída de cada lanzamiento; si la fila se vuelve a leer, vale la nueva.
- **Lote** (`Dialog`):
  - barra "N seleccionados" con Publicar, Archivar y Quitar selección;
  - más de 50 deshabilita las dos acciones y dice cuántos quitar; nunca se parte en silencio;
  - confirmar lista los lanzamientos y pide la observación del cambio (obligatoria; es el `p_reason` de cada change set);
  - publicar con incompletos conocidos no se envía: un aviso los nombra y ofrece quitarlos de la selección;
  - el informe reemplaza la confirmación: resumen ("Se publicaron 2 lanzamientos." o "No cambió nada: … y el lote se deshizo completo.") y una línea por elemento con su resultado en palabras. Cada rechazado enlaza a su editor;
  - aplicado: vacía la selección, recarga la lista y los conteos, y deja el resumen como aviso. Rechazado: conserva la selección y ofrece "Quitar los rechazados". Con un `40001`, la lista ya se recargó con las versiones nuevas.
- **Móvil (< 768):** consulta, como el editor de E07: filas en tarjeta (artistas en dos líneas), sin selección ni lote y sin "Nuevo lanzamiento".
- **Tablet (768–1023):** la barra lateral pasa a fila de secciones y la columna Tipo se oculta, para que estado y señales no se corten.

## Permisos

Los permisos efectivos viven en la base (E06 `private.is_admin()`, RLS de E09 y E18, D2). U15 no tocó SQL ni RLS. La interfaz muestra a cada rol exactamente lo que mostraban `/admin/catalogo` y `/editorial`:

| Rol | Antes | Estudio |
| --- | --- | --- |
| Sin sesión | Pantalla "Inicia sesión" en las dos rutas | "Inicia sesión" en todo `/estudio`, sin datos ni RPC |
| Comunidad | "Solo para administradores" y "Sin acceso editorial" | "Sin acceso al Estudio", sin barra lateral ni consultas a `contributions`, `problem_reports` o `admin_*` |
| Colaborador | Sin consola; en `/editorial`, la cola comunitaria para preparar y sus aportes sin revisión | Solo Propuestas, con las mismas acciones. Catálogo y Reportes muestran "Esta sección es solo para administración" y no piden datos |
| Admin | Consola completa; en `/editorial`, colas, decisión y reportes | Catálogo, Propuestas y Reportes |

**Verificado en staging** (`hgocyrzhgohetfpzbmfs`), solo lectura, antes y después de editar, con [`tests/sql/u15-staging-permissions.sql`](../../tests/sql/u15-staging-permissions.sql). Corre en `begin read only` y termina con `rollback`; se hace pasar por una cuenta real de cada rol. **Las dos salidas son idénticas:**

- admin: `is_admin` y `is_editor` verdaderos; lista administrativa OK (2.790); ve la cola completa;
- comunidad: `is_admin` e `is_editor` falsos; la lista administrativa responde `42501`; no ve propuestas ajenas;
- **colaborador: staging no tiene ninguna cuenta con ese rol** (0). Se verificó por definición: huella (`md5`) de `private.is_admin`, `is_collaborator` e `is_editor` y de las tres políticas de lectura de `contributions`, iguales antes y después; `is_admin` no menciona al colaborador. El comportamiento por rol lo cubren `tests/sql/d2-verify.sql` (local: colaborador recibe `42501` en lote, conteos y lista) y las pruebas de navegador;
- `EXECUTE` de las RPC del Estudio: `authenticated` sí, `anon` no, sin cambios.

## Staging hoy: el Estudio no está listo para publicarse ahí

Hallazgos de la misma consulta, que no cambió U15:

- **D2 no está aplicada:** no existen `admin_catalog_quick_view_counts`, `admin_batch_update_catalog_releases` ni la firma de 9 argumentos de la lista. `listCatalog` envía `p_quick_view` desde D2, así que la lista del Catálogo falla en staging. Esto ya pasaba con `/admin/catalogo` desde D2; no es nuevo de U15.
- **E18 no está aplicada:** no existe `problem_reports`. La sección Reportes muestra el error y la barra lateral la deja sin número; las demás secciones siguen.
- **Orden para publicar U15 en un entorno:** E18 corregida (H2, H3) → D2 → U15. Antes de abrir el lote a uso real conviene corregir H1 de E06 (relevo D2).
- **Para probar el colaborador de verdad** hace falta una cuenta con ese rol en staging. Crearla es una escritura y una decisión del equipo; no se hizo.

## Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U16–U18 no las vuelvan a inferir.

- **Vistas rápidas en la barra lateral**, bajo Catálogo y con su tamaño, como anticipaba el relevo de D2. Por debajo de 1024 px pasan a un `Select` "Vista". Se combinan con búsqueda, estado y tipo.
- **Filtros de estado y tipo de un solo valor**, en la barra y sin el panel "Filtros" con "Aplicar". Antes admitían varios a la vez; la combinación más usada (borradores incompletos) sale de Vista + Estado. Es reversible: `listCatalog` sigue aceptando listas.
- **URL como fuente de verdad** de la vista, el lanzamiento abierto y el alta nueva. Hace posibles los enlaces cruzados y que "atrás" funcione. `?nuevo=1` ya no se borra al abrir (U13 lo quitaba); al crear el borrador se reemplaza por `?lanzamiento=<id>`.
- **Header a ancho completo y sin pie en `/estudio`.** Responde al hallazgo del censo ("rompe el contenedor del sitio: va de borde a borde mientras el header se queda en 1200"). El header es el mismo (cuenta, menú, logo hacia el sitio); no hay header propio.
- **`ToolLayout` pasa a fila de secciones por debajo de 1024 px** (antes 768), para dejar el ancho a la tabla en tablet.
- **Textos:**
  - el diálogo de aprobación dice "Confirma el lanzamiento que se publicará con estos datos" (antes "el release … de forma transaccional", hallazgo del censo);
  - en Sugerir para admin, "consola" pasa a "Estudio" ("Continuar en el Estudio");
  - el bloque del perfil dice "Las herramientas del equipo.".
- **Propuestas por lanzamiento** son de solo consulta: las resueltas no muestran acciones, aunque quien mira sea admin.

## Primitivas y layouts

- **`ToolLayout`:** `ToolSection.items` (vistas de una sección, con `count`), sección "abierta" cuando su vista es la actual y fila de secciones por debajo de 1024. Demo en `/lab`.
- **`ToolHeader`** (nuevo, en `$lib/layouts`): título, descripción y acciones de una sección cuando el layout vive en un `+layout.svelte`. `ToolLayout` con `title` lo usa por dentro.
- **`Checkbox`:** `hideLabel` (texto solo para lectores, caja centrada en 44 × 44). Demo en `/lab`.
- **Tokens** (bloque "Shell y layouts"): `--tool-row-h` (56), `--tool-thumb` (40), `--tool-table-min-w` (48rem) y `--tool-dialog-list-max-h` (16rem).

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **134/134** (incluye `studio.test.mjs`, 9) |
| `npm run lint:tokens` | OK, 165 archivos, las 2 excepciones de siempre |
| `npm run build` | OK |
| `svelte-check` | Sin errores nuevos. En el editor queda el de `RadarMini` (tipo del radar), preexistente desde E07 y anotado en D2 |
| `u15-estudio.spec.ts` | **15/15, y 45/45 con `--repeat-each=3`** |
| E07 (`e07-admin-console.spec.ts`), adaptada | **8/8** |
| E10, adaptada | **8/8** |
| U7 y U13, adaptadas | **20/20 y 7/7** |
| `npm run test:browser` | **288 pasan, 5 omitidas, solo falla E17:202** (conocida). La primera pasada además falló U13 admin, por un defecto real del Catálogo, ya corregido (ver abajo) |
| `.htaccess` con el Apache local | `/admin/catalogo?vista=incompletos&nuevo=1` → 301 a `/estudio/catalogo?vista=incompletos&nuevo=1`; `/editorial?x=1` → 301 a `/estudio/propuestas?x=1`; con barra final también; `/admin` y `/editoriales` no redirigen |
| Staging, permisos (solo lectura) | Antes y después idénticos (ver "Permisos") |

Qué cubre `u15-estudio.spec.ts`:

- **Rutas:** las anteriores llegan a su sección con la query; `/estudio` abre Catálogo (admin) o Propuestas (colaborador).
- **Roles:** sin sesión (entrar con `redirect` exacto, sin barra ni RPC), comunidad (sin acceso en las tres secciones, sin pedir `contributions`, `problem_reports` ni `admin_*`), colaborador (solo Propuestas, prepara pero no decide; Catálogo, Reportes y `?lanzamiento=` muestran el aviso, sin tabla y sin `admin_*` ni `problem_reports`) y admin (tres secciones, vistas con conteo, contenedor full, sin pie).
- **Vistas rápidas:** por la barra lateral (URL, `aria-current`, `p_quick_view`) y por el selector a 390; móvil sin casillas.
- **Lote con éxito:** pide observación antes de enviar; payload exacto (`p_operation`, versiones leídas, `p_reason`); informe por elemento; recarga lista y conteos; vacía la selección.
- **Lote con error:** "No cambió nada", texto por elemento sin códigos, enlace al editor del rechazado, selección intacta y "Quitar los rechazados".
- **Límites:** un incompleto bloquea publicar y se puede quitar; 50 en dos páginas pasan, el 51 bloquea Publicar y Archivar con el motivo; nunca se llama al lote.
- **Enlaces cruzados:** fila → reportes del lanzamiento → editor → "Relacionado" (reportes, propuestas, ficha) → propuestas del lanzamiento; aprobar deja un enlace al lanzamiento creado.
- **Editor por URL** y "Volver" a la misma vista.
- **Anchos:** 390, 834 y 1440 sin desborde horizontal en las tres secciones.

### Defectos encontrados y corregidos durante la etapa

- **Nombres de artistas "sin resolver" en la lista y enlace vacío al llegar desde Sugerir.** En modo legacy, una variable que la plantilla solo lee dentro de una función no es estado. E07 no lo sufría porque pintaba la lista y el editor después de cargar todo; el Estudio pinta antes. Arreglo: `artistNames` derivado con `$:` y `primaryLink(selected)` explícito. Lo detectaron la suite visual y U13.
- **Desborde horizontal a 834 px.** Los textos `sr-only` (absolutos) de las celdas escapaban del contenedor con scroll; ahora está posicionado. Era el aviso del relevo de U6 y U7.

## Capturas

`npm run visual:compare` contra `.ref-pre-u15`: **172 capturas, 134 iguales, 30 distintas y 8 nuevas.** Todas del alcance. Copias en [`capturas-u15/`](./capturas-u15/) (38).

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Catálogo | `admin-list-D/T/M`, `admin-selection-D`, `admin-filters-D` (ahora Estado = Borrador en la barra) | Estudio, tabla con primitivas, señales, selección y lote |
| Editor (E07 sin cambios) | `admin-editor-D/T/M`, `admin-editor-top-D`, `admin-history-D`, `admin-finder-D`, `admin-publish-D`, `admin-new-D` | Dentro del layout del Estudio y con "Relacionado" en la columna lateral |
| Sin acceso | `admin-anon-D`, `admin-norole-D`, `editorial-anon-D` | Pantallas del Estudio |
| Propuestas | `editorial-admin-D/M`, `editorial-approve-D`, `editorial-colab-D` | Vista de E10 dentro del layout, sin los reportes |
| Perfil | `perfil-admin-D`, `perfil-colab-M` | Bloque Estudio con una entrada por sección |
| `/lab` | `lab-D/M`, `lab-u7-D/M` | Demos de `ToolLayout` con vistas y `Checkbox hideLabel` |
| `/lab`, desplazadas | `lab-u6-D/M`, `lab-u8-D/M` | Solo antialiasing del texto: las secciones bajan por el contenido nuevo de arriba |
| **Nuevas** | `estudio-vista-D/M`, `estudio-lote-D`, `estudio-lote-ok-D`, `estudio-lote-error-D`, `estudio-reportes-D/M`, `estudio-colab-catalogo-D` | Vista rápida, lote (confirmar con un incompleto, aplicado y rechazado), Reportes y colaborador en Catálogo |

- Los IDs del censo se conservan: `admin-*` y `editorial-*` apuntan a la sección equivalente del Estudio. Las 8 nuevas son suplementarias. "El censo conserva sus 127 IDs" sigue fallando como desde U7 (130), sin relación.
- Los mocks visuales ganaron señales de D2 en los lanzamientos, conteos y el filtro `p_quick_view`. El lote se simula por captura con `override`.
- La línea base no se recapturó. Al aceptar: `npm run visual:capture` y borrar `tests/visual/.ref-pre-u15/`.

## Para U16 (editor)

- El editor vive en `src/routes/estudio/catalogo/+page.svelte`, rama `{:else if selected}`, con su CSS de E07 al final del `<style>` (una línea por bloque, extraída tal cual). La lista y el lote están en la rama `{:else}` y en el bloque "Lista del Estudio (U15)".
- Se abre por URL: `?lanzamiento=<uuid>` o `?nuevo=1` (`syncFromUrl`). Al crear, `submit` reemplaza `nuevo` por `lanzamiento`. "Volver" usa `openedFromList` (atrás) o quita los parámetros.
- Si U16 lo lleva a otra ruta (por ejemplo `/estudio/catalogo/[id]`), cambiar `studioReleaseHref` en `studio.ts` y `ADMIN_NEW_RELEASE_HREF`; todos los enlaces cruzados pasan por ahí.
- **Cuidado con el modo legacy:** la página no usa runas. Una variable que la plantilla solo lee dentro de una función no se actualiza (ver "Defectos"). Si U16 pasa el editor a runas, el problema desaparece.
- "Relacionado" (reportes, propuestas, ficha) usa `Button variant="link"` dentro de la columna lateral de E07: U16 decide dónde va en el índice nuevo.
- Tras guardar, publicar o revertir se llama `studio.refreshCounts()`.

## Para U17 (propuestas y reportes)

- `src/routes/estudio/propuestas/+page.svelte` y `src/routes/estudio/reportes/+page.svelte` son la vista de E10 movida: cartas, `select` nativo, diálogo propio. U17 las reemplaza por la bandeja.
- Ya existen: filtro `?lanzamiento=` en las dos, `loadReleaseContributions` (solo lectura) y el aviso tras aprobar con "Abrir el lanzamiento en el Catálogo" (cubre la prueba de U17 "sin salir del Estudio ni escribir URLs").
- El colaborador solo ve Propuestas. Reportes es solo admin, igual que en `/editorial`.
- Tras preparar, decidir o clasificar se llama `studio.refreshCounts()`.
- Los gates de sesión y rol son del layout: las secciones no deben repetirlos.

## Rollback

Sin datos ni migraciones.

1. Restaurar `src/routes/admin/catalogo/+page.svelte` y `src/routes/editorial/+page.svelte` desde `respaldos/admin-catalogo-page.pre-u15.svelte.txt` y `respaldos/editorial-page.pre-u15.svelte.txt`.
2. Borrar `src/routes/estudio/`, `src/lib/components/estudio/`, `src/lib/domain/studio.ts`, `src/lib/layouts/ToolHeader.svelte` (y su export), `tests/studio.test.mjs` (y su entrada en `package.json`), `tests/browser/u15-estudio.spec.ts` y `tests/sql/u15-staging-permissions.sql`.
3. Quitar las dos reglas del Estudio en `static/.htaccess`.
4. Restaurar desde `respaldos/*.pre-u15.*`: `ToolLayout`, `Checkbox`, `Header`, `/lab`, `censo.spec.ts`, `e07`, `e10`, y `data.ts` y `mocks.ts` de la suite visual. En `tokens.css`, quitar los cuatro tokens `--tool-*` nuevos.
5. Deshacer los cambios menores:
   - el pie condicional de `src/routes/+layout.svelte`;
   - `studioLinks` del perfil;
   - `ADMIN_NEW_RELEASE_HREF` y `loadReleaseContributions` en `contributionsStore.ts`;
   - los textos "Estudio" de Sugerir;
   - las adaptaciones de `u7-shell`, `u13-sugerir-reportar` y `scripts/e07-staging-auth-smoke.mjs`.
