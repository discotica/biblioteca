# U16 — Estudio: editor (2026-10-10)

Etapa U16 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u16--estudio-editor). Claude Opus 5.5, esfuerzo `high`, como asigna el plan. No hubo que escalar: **el payload de las mutaciones auditadas no cambió** (ver "Auditoría").

Estado: **implementada, pendiente de aceptación.** Sin commit, push, despliegue, datos ni producción. Ningún contrato de datos, SQL ni RLS cambió.

## Condición de arranque

- **U15 aceptada** por el equipo al arrancar U16 (2026-10-10). Registrado en `decisiones.md` y `estado.md`.
- **Línea base visual:** `tests/visual/baseline/darwin/` sigue en U10. No se recapturó al aceptar U15 porque U10b–U14 siguen sin aceptar y la recaptura los habría aceptado de hecho. En su lugar:
  - antes de editar, `visual:compare` contra `.ref-pre-u15` dio exactamente lo que dejó U15 (172 capturas: 134 iguales, 30 distintas, 8 nuevas): el árbol no se movió desde entonces;
  - el árbol de partida (U15 aceptada) se capturó en `tests/visual/.ref-pre-u16/` (172 capturas) y se comprobó con 0 diferencias;
  - se borró `.ref-pre-u15`, como pedía su relevo al aceptar.
- **Antes de editar:** E07, U15 y U13 en verde (31/31).
- **Respaldos** en `respaldos/*.pre-u16.*.txt`: la página del Catálogo (`estudio-catalogo-page`), `Combobox`, `Header`, `ToolLayout`, `icons.ts`, `tokens.css`, `styles.css`, el layout del Estudio, `/lab` y las pruebas `e07`, `u13`, `u15` y `censo.spec`.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Una página con secciones e índice lateral fijo | Datos, Créditos, Clasificación, Medios e Historial en una sola página. Índice fijo a la izquierda, con la sección visible marcada y lo que falta por sección. Sin pestañas. |
| 2. Densidad más compacta | Ver "Densidad". |
| 3. Géneros y países con el Combobox de U6 | Los dos con búsqueda y chips. Géneros ofrece "Crear género «…»", que abre la confirmación auditada de siempre. Países es vocabulario cerrado: sin alta. |
| 4. Sin vista previa | No hay vista previa del sitio. Queda la miniatura del radar junto a sus controles (feedback inmediato de E07) y la portada en Medios. |
| 5. Edición completa en móvil | Móvil deja de ser consulta. El índice pasa a un selector fijo arriba y la barra de guardar queda fija abajo. |

## Estructura del editor

Archivos:

- `src/lib/components/estudio/ReleaseEditor.svelte` (runas): carga, campos, guardar/publicar/archivar/revertir, altas auditadas, índice y barra.
- `src/lib/components/estudio/EditorCredits.svelte`: los dos grupos de créditos.
- `src/lib/components/estudio/EditorHistory.svelte`: el historial.
- `src/lib/domain/releaseEditor.ts`, sin Svelte ni Supabase: secciones, pendientes de publicación (los de E07, en su orden) repartidos por sección, validación con los mensajes de E07, enlace principal, mover créditos y textos del historial. Pruebas: `tests/release-editor.test.mjs` (8).
- `src/routes/estudio/catalogo/+page.svelte` conserva la lista y el lote. El editor se abre igual que en U15 (`?lanzamiento=<uuid>`, `?nuevo=1`); la página solo le pasa la URL, los diccionarios y tres avisos (cerrar, creado y guardado).

| Zona | Contenido |
| --- | --- |
| Cabecera | Volver, portada de 40, "Editar / Nuevo lanzamiento", título (h1) y artistas principales. A la derecha: estado (`Chip`), versión, "N reportes" si los hay y "Más acciones" (`Menu`): Ver ficha pública, Reportes, Propuestas y Archivar lanzamiento. |
| Índice (≥ 768) | Las cinco secciones, con `aria-current="location"` en la visible y "falta N" en ámbar por sección; Historial lleva su número. Debajo, "Para publicar falta: …" o "Listo para publicar.". Mismo lenguaje que el índice de `ReadingLayout`. |
| Datos | Título y Tipo; Fecha y Sello (con "Crear sello «…»" si no coincide); "Reseña (opcional)" y "Datos técnicos" (ID, identificador, última edición) plegados. |
| Créditos | Artistas principales y Colaboradores (opcional), en filas: arrastrar (también delante de otro, para ordenar), "Mover a …" y "Quitar". Cada grupo busca con el Combobox de U6 sin chips; "Crear identidad «…»" abre la confirmación. Elegir a alguien del otro grupo lo mueve. |
| Clasificación | Géneros y Países (Combobox) y Radar: miniatura y cinco controles. |
| Medios | Portada, Link de compra o escucha (con el proveedor detectado) y URL de portada. Los enlaces adicionales se conservan y se dice cuántos hay. |
| Historial | Operación en palabras (Edición, Publicación, Archivo, Alta, Reversión), observación, quién, versiones, fecha, campos cambiados en palabras, comparación técnica plegada y "Revertir este cambio". |
| Barra de guardar | Fija abajo en todos los anchos: estado ("Cambios sin guardar.", aviso de éxito o error), observación del cambio, Publicar (si no está publicado) y Guardar cambios / Crear borrador. Intro en la observación guarda. |
| Diálogos | `Dialog` de U6: publicar, archivar, revertir (con su propia observación), crear identidad, sello y género. |

**Móvil (< 768):** una columna; el índice es un `Select` "Ir a la sección" fijo arriba con la línea de lo que falta; las secciones van a sangre; la barra de guardar ocupa todo el ancho, con la observación sobre los botones y sin la línea "Sin cambios.". En pantallas táctiles no se muestra el asa de arrastre: mover y quitar quedan en los botones.

**Tablet (768–1023):** índice lateral; título y sello a todo el ancho; géneros y países apilados.

### Densidad

Frente a E07 (capturas `admin-editor-*`):

- la nube de 71 géneros y 48 países (dos cajas de 210 px con scroll) pasa a dos campos de una línea;
- tarjetas de sección con 16 px de relleno y encabezado de una línea (antes eyebrow + título + descripción + filete);
- etiquetas sin la línea propia del asterisco; se marca lo opcional, como en el resto del sistema;
- créditos en filas de 40 (`--density-row-h`) y sin el buscador desplegable aparte;
- radar en una fila (miniatura y controles en tres columnas) en lugar de cinco tarjetas;
- portada de 96 en lugar de 170;
- el historial deja de ser una pestaña: es la última sección.

Desktop a 1440: del inicio de "Datos" al final de "Medios" hay ~1.580 px; en E07, de "Datos esenciales" al final de "Portada", ~2.210, con el historial aparte en su pestaña. Los controles conservan 44 px (objetivo táctil del plan).

## Auditoría: el payload no cambió

- **Servicio intacto:** `saveCatalog`, `createCatalog`, `revertCatalog`, `createArtist`, `createLabel` y `createGenre` de `adminCatalog.ts` no se tocaron. El payload sigue saliendo de `payload(snapshot)` y el editor solo guarda el snapshot de E06 (ningún campo de interfaz entra en él).
- **Mismos valores que E07 para la misma edición:**
  - `release_type_id` vuelve a `null` al elegir "Selecciona un tipo" (el `Select` usa `''`; se convierte);
  - la fecha y la portada guardan el texto del campo, como el `bind:value` de antes;
  - el enlace principal se crea, cambia o quita igual (`withPrimaryLink`);
  - las altas de artista, sello y género llaman a las mismas RPC con confirmación y razón.
- **Comprobado con igualdad estricta** en `u16-editor.spec.ts` (`toEqual` sobre el cuerpo entero de cada RPC, a 390 y 1440):
  - crear: payload del alta en blanco más lo escrito;
  - guardar sin cambios: `payload(snapshot)` exacto;
  - guardar con cambios en las cuatro secciones: solo cambian esos campos;
  - archivar, revertir y arrastrar créditos.

  E06 audita lo que recibe (actor, razón, antes/después y versiones), así que registra igual que antes.
- **Observación:** sigue siendo obligatoria y es `p_reason`. Si falta, Publicar y Archivar ya no abren la confirmación: avisan y llevan el foco al campo. La reversión pide la suya dentro del diálogo, con lo escrito en la barra como punto de partida. Antes leía el mismo campo de la barra lateral.

## Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U17–U18 no las vuelvan a inferir.

- **Créditos con filas y no con chips.** El plan pide el Combobox para géneros y países. En créditos importan el orden y el grupo, y E07 permitía mover y arrastrar entre grupos. Por eso cada grupo usa el Combobox para buscar y añadir (`chips={false}`, extensión nueva de la primitiva) y muestra los créditos en filas.
  - Se pierde "Cambiar identidad" (✎), que reemplazaba un artista en su sitio. Se hace con Quitar + añadir, y el orden se corrige arrastrando (nuevo: soltar delante de otro).
  - Si el equipo lo quiere de vuelta, es un botón más por fila.
- **"Link de compra o escucha" pasa de Datos a Medios.** E07 lo tenía entre los datos esenciales. U16 nombra una sección Medios, y el enlace y la portada son las dos URL del lanzamiento. Sigue contando para publicar y el índice lo marca en Medios.
- **Archivar sale de la barra de guardar** y va a "Más acciones", junto a los enlaces relacionados. Responde al hallazgo del censo "Archivar va en texto rojo pegado a Guardar".
- **"Relacionado" (U15) va a "Más acciones".** Los reportes abiertos, además, en la cabecera ("N reportes"), como en la fila de la tabla.
- **Una sola barra de guardar fija en todos los anchos.** Desktop y móvil comparten el mecanismo (sticky al pie del cuerpo). En desktop no hay una columna derecha de acciones: el ancho queda para el formulario.
- **Avisos en la barra**, no arriba de la página: con la página larga, el resultado de guardar se lee donde se pulsó. El aviso de Sugerir (U13) sigue arriba porque describe el formulario.
- **Sticky en el Estudio** (ver abajo).

## Sticky en el Estudio: `html.is-tool` y `--header-offset`

`overflow-x: hidden` en `html` y `body` (`styles.css`) convierte a `body` en un contenedor de scroll que nunca se desplaza, y eso anula todo `position: sticky`. Es el problema que `decisiones.md` deja para U18. Sin arreglarlo no había índice ni barra fijos. Tampoco la barra lateral del Estudio era fija de verdad desde U7.

- **Arreglo acotado al Estudio:** el layout de `/estudio` pone `html.is-tool` mientras está montado. Con esa clase, `html` y `body` usan `overflow-x: clip`, que recorta igual pero no crea el contenedor de scroll. El resto del sitio no cambia.
- **Consecuencia en el Estudio:** el header también pasa a ser sticky, con su comportamiento de E14 (se esconde al bajar; en desktop vuelve al subir; en móvil, solo arriba del todo). Para que no tape lo fijo, el header publica su alto visible en `--header-offset` (token nuevo, `0px` fuera del Estudio). La barra lateral de `ToolLayout`, el índice y el selector se colocan debajo y lo siguen con la misma curva del header.
- **Para U18:** el arreglo global es el mismo `clip`, pero activa el header fijo en todo el sitio. Es una decisión de producto, no un cambio silencioso.

## Primitivas, tokens e iconos

- **`Combobox`:** `chips` (por defecto `true`). Con `false`, el campo solo busca y elige; quien lo usa muestra lo elegido. La demo está en `/lab` (sección nueva, `.lab__u16`).
- **Icono `intercambiar`** (dos flechas opuestas): "Mover a …" en créditos.
- **Tokens:**
  - `--tool-index-w` (12rem), `--tool-cover` (6rem) y `--tool-radar` (7rem), en el bloque "Shell y layouts";
  - `--header-offset`, junto a los del header.
- **`ToolLayout`:** la barra lateral usa `--header-offset` y respeta `prefers-reduced-motion`.
- **`Header`:** publica `--header-offset` solo en `/estudio`.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **142/142** (incluye `release-editor.test.mjs`, 8) |
| `npm run lint:tokens` | OK, 169 archivos, las 2 excepciones de siempre |
| `npm run build` | OK. Solo el aviso previo de `/cuenta` (U12) |
| `svelte-check` | Sin errores nuevos. En el editor sigue el de `RadarMini` (tipo del radar), el mismo desde E07 |
| `u16-editor.spec.ts` | **12/12, y 24/24 con `--repeat-each=2`** |
| E07, adaptada | **8/8** |
| U15, adaptada | **15/15** |
| U13 (traspaso de Sugerir al editor) | **8/8**, sin cambios |
| E07 + U13 + U15 + U16 con `--repeat-each=3` | **126/126** |
| `npm run test:browser` | **299 pasan, 5 omitidas, solo falla E17:202** (conocida) |

Qué cubre `u16-editor.spec.ts`, cada caso a 390 y a 1440:

- **Crear:** alta con título y artista principal (Combobox). Payload exacto del alta; la URL pasa a `?lanzamiento=<id>`; la observación se vacía y se ve v1.
- **Editar:**
  - guardar sin cambios envía `payload(snapshot)` exacto;
  - después, título, mover un colaborador a principal, un género por Combobox, un eje del radar y el enlace principal: el payload solo cambia en esos campos, con la versión nueva;
  - "Cambios sin guardar." y el aviso de éxito se alternan.
- **Archivar:** desde "Más acciones". Sin observación no abre el diálogo y enfoca el campo; con ella, `p_operation: 'archive'` y el payload intacto.
- **Revertir:** se llega por el índice (desktop) o el selector (móvil). El diálogo exige su observación y envía `change_set_id` y `result_version` exactos.
- **Página:** el índice o el selector llevan a la sección y la marcan; la barra de guardar está dentro del viewport con la sección arriba; el selector móvil sigue fijo; no hay vista previa ni nube de casillas; sin desborde horizontal.
- **Además:**
  - arrastrar un colaborador delante del principal (1440) cambia el orden y el payload;
  - a 834: índice lateral, barra a la vista y sin desborde.

Cambios en las pruebas existentes (respaldos `*.pre-u16.*`):

- **E07:** índice y cinco secciones en lugar de pestañas; móvil editable en lugar de consulta; artistas, géneros y países con Combobox; Archivar desde "Más acciones"; sello con "Crear sello «…»" y género desde el Combobox; el historial por el índice, con la observación de la reversión en el diálogo; avisos en `.editor__feedback`. Los payloads esperados no cambiaron.
- **U15:** cabecera `.editor__head`; "Relacionado" en "Más acciones".

## Capturas

`npm run visual:compare` contra `.ref-pre-u16`: **176 capturas, 157 iguales, 15 distintas y 4 nuevas.** Todas son del alcance. Hay copias en [`capturas-u16/`](./capturas-u16/): antes y después de cada captura del editor, más las 4 nuevas.

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Editor | `admin-editor-D/T/M`, `admin-editor-top-D`, `admin-new-D` | Rediseño: página única con índice, combobox, barra de guardar y móvil editable |
| Editor, estados | `admin-history-D` (ahora la sección Historial por el índice), `admin-finder-D` (Combobox del grupo con "entr"), `admin-publish-D` (archivar desde "Más acciones") | Mismo ID del censo, con el estado equivalente del editor nuevo |
| `/lab` | `lab-D/M` | Icono `intercambiar` en la grilla y demo del Combobox sin chips |
| `/lab`, desplazadas | `lab-u6-D` (85 px), `lab-u6-M` (3), `lab-u7-D/M` (1), `lab-u8-M` (6) | Solo antialiasing de bordes redondeados: las secciones bajan porque el icono nuevo añade una fila a la grilla. Deterministas (se repiten igual) |
| **Nuevas** | `estudio-editor-top-M`, `estudio-editor-medios-M`, `estudio-editor-generos-D`, `estudio-editor-guardado-D` | Móvil con selector y barra fijos; salto a Medios con el selector; Combobox de géneros abierto; error de observación en la barra |

- En las capturas de página completa, la barra de guardar aparece a la altura del primer viewport. Así pinta Chromium un elemento sticky en `fullPage`; en uso real va al pie de la pantalla, como en `estudio-editor-top-M`.
- `admin-editor-M` ya no es "Móvil, solo consulta": es la edición móvil. El ID se conserva.
- La línea base no se recapturó (ver "Condición de arranque"). Al aceptar U16: si U10b–U14 también se aceptan, `npm run visual:capture` y borrar las `.ref-pre-*` que ya no hagan falta. Si no, `VISUAL_BASELINE_DIR=.ref-pre-u17 npm run visual:capture` para aislar U17, y borrar `.ref-pre-u16`.

## Para U17 (propuestas y reportes)

- El editor se abre siempre por `studioReleaseHref(id)` (`?lanzamiento=`). "Corregir el lanzamiento sin salir del Estudio" (prueba de U17) ya funciona: el aviso tras aprobar enlaza ahí.
- "Más acciones" del editor enlaza a Propuestas y Reportes del lanzamiento con `studioProposalsHref` y `studioReportsHref`. Si U17 cambia esas rutas, se cambian en `studio.ts`.
- En el Estudio, lo sticky funciona (`html.is-tool`). Una bandeja con lista fija o una barra de acciones fija puede usar `top: calc(var(--header-offset) + …)`, como el índice del editor.
- El Combobox con `chips={false}` sirve para "buscar y elegir sin mostrar chips" (p. ej., asignar un lanzamiento a un reporte).
- **Para U18:** la verificación del `overflow-x` global (ver "Sticky en el Estudio"); VoiceOver en el editor (índice, combobox de créditos, diálogos); el doble anillo de foco dentro del Combobox al escribir (el campo y el control se marcan a la vez, desde U6).

## Rollback

Sin datos ni migraciones.

1. Restaurar `src/routes/estudio/catalogo/+page.svelte` desde `respaldos/estudio-catalogo-page.pre-u16.svelte.txt` (editor de E07 dentro del Estudio, como lo dejó U15).
2. Borrar `src/lib/components/estudio/ReleaseEditor.svelte`, `EditorCredits.svelte` y `EditorHistory.svelte`, `src/lib/domain/releaseEditor.ts`, `tests/release-editor.test.mjs` (y su entrada en `package.json`) y `tests/browser/u16-editor.spec.ts`.
3. Restaurar desde `respaldos/*.pre-u16.*`:
   - `Combobox`, `Header`, `ToolLayout`, `icons.ts`, `tokens.css`, `styles.css`, el layout del Estudio y `/lab`;
   - las pruebas `e07`, `u15` y `censo.spec`.
4. Borrar `docs/modernizacion/capturas-u16/` si no se quiere conservar la evidencia.
