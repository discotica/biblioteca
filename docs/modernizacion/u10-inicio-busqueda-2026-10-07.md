# U10 — Inicio y búsqueda (2026-10-07)

Etapa U10 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u10--inicio-y-búsqueda). Corrió en Claude Opus 5.5 con esfuerzo `high`, como asigna el plan. No hubo que escalar a `xhigh`: el orden móvil nuevo no choca con el sticky de E15 (ver "E15 y el sticky"). No se hizo commit ni push. No se tocaron el motor de búsqueda (`searchMatching.ts`), el estado y el formato de la URL (`searchState.ts`), los datos ni producción.

Estado: **aceptada el 2026-10-07**, después del ajuste de "Feedback del equipo". Se recapturó `tests/visual/baseline/darwin/`: 145 capturas y 0 diferencias después. Se borró `src/lib/components/Pagination.svelte` (sin uso; copia en `respaldos/`).

## Condición de arranque

- U7 y U8 aceptadas. U9 se aceptó durante el arranque de U10 (`decisiones.md`, ronda 3): la línea base oficial ya es U9, así que no hizo falta una referencia aislada `.ref-pre-u10`.
- `npm run visual:compare` antes de editar: 142 capturas, **0 diferencias**.
- `npm run test:browser` antes de editar: 197 pasan, 5 omitidas y 1 falla, E17:198 (persistente desde U1).
- Los archivos reescritos se respaldaron en `docs/modernizacion/respaldos/*.pre-u10.svelte.txt`: no están en git en su versión actual.

## Feedback del equipo (ajuste interno, antes de aceptar)

Registrado en [`decisiones.md`](./decisiones.md), "Inicio y búsqueda (2026-10-07, durante U10)". Lo que cambió respecto de la primera versión, descrita en el resto del documento salvo donde se indica:

| Feedback | Cambio |
| --- | --- |
| "Me gustaba más la paginación que no se expandía, que decía 'x de y'" | `Pagination` pasa a `compact` por defecto: ‹ 5 de 233 › en todos los anchos, en inicio (arriba y abajo), artista, sello y colección. Ya no hay números en desktop. |
| "Reiniciar filtros" no es suficientemente notorio | `Button` gana la variante `accent` (borde y texto de acento sobre un tinte, sin relleno lleno) y el icono `reiniciar`. Panel: al inicio del pie, donde termina el formulario. Hoja: en el pie fijo, "Reiniciar" junto a "Ver N lanzamientos" (nombre accesible "Reiniciar filtros"). |
| En la lista de desktop los géneros anchos se truncaban; la lista móvil es más útil | `LanzamientoFila` usa la composición móvil en todos los anchos: portada · créditos, título y datos · compartir, sin géneros. Afecta también a `/lab` (U8). |
| Mejor ubicación del "x–y de z lanzamientos" | Desktop: junto a la paginación superior ("‹ 1 de 233 ›  1–12 de 2.790 lanzamientos"). Móvil: al pie, sobre la paginación inferior, para no sumar una línea antes de la primera portada. Resuelve el hallazgo del censo "el total solo aparece al final de la página" en desktop. |

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Móvil: buscar / filtros activos / paginación y orden, antes de la primera portada | Tres líneas. **1:** «Buscar» (con el número de filtros) y el selector grilla/lista. **2:** banda horizontal desplazable con chips compactas (`Chip kind="filter"`, 32 px visibles y área táctil de 44). **3:** paginación compacta y "Ordenar por" en la misma línea. Con un filtro, a 390×844 la primera portada empieza en y = 249. |
| 2. Desktop: panel compacto; campo de texto más alto y ~15 % más visible; "Reiniciar filtros" secundario | El panel es **una sola caja**: formulario y Radar lado a lado desde 1024, separados por una línea; ya no hay tarjetas dentro de tarjetas. El campo de texto pasa de ~41 a **52 px** (`--field-h-lg`), el texto de 14 a **16 px** (+14 %), con borde, fondo e icono en el acento. País, Género, Tipo y Año miden 44 con el mismo radio (`--control-radius`). "Reiniciar filtros" es un `Button` secundario al pie del panel, alineado a la derecha. |
| 3. Radar: RADAR solo en el desplegable cerrado; "Aleatorizar"; cinco puntos por eje | En la hoja, el desplegable dice RADAR y el componente desplegado ya no repite el título. "Aleatorizar" es `Button` secundario sm y "Limpiar", ghost sm. Cinco puntos por eje, ahora con nombre accesible ("Bailable: 3 de 5"), `aria-pressed` y área táctil de 44 con el dedo (24 con cursor). |
| 4. Hoja móvil: altura según contenido, × en la cabecera, botón fijo "Ver N lanzamientos", sin "Cerrar" de texto | La hoja pasa a la primitiva `Sheet`: × (`IconButton` "Cerrar") en la cabecera, filtros activos fijos bajo el título, cuerpo desplazable y pie fijo con `Button` primario "Ver N lanzamientos" (N con separador de miles; "Ver resultados" si N = 0). Altura según contenido hasta 88dvh. |
| 5. ViewToggle grilla/lista en el inicio, recordado | `ViewToggle`: en desktop a la derecha de "Ordenar por"; en móvil, junto a «Buscar». Se guarda en `localStorage` (`discotica:vista:inicio`) y se lee antes del primer pintado. Lista = `LanzamientoFila` en `.lanzamientos-lista`; el separador de aproximados funciona en las dos. |
| 6. Carga con esqueleto e indicador horizontal | `LoadingIndicator` ("Cargando catálogo", tres puntos en fila) sobre seis `Skeleton` con la composición de la vista (tarjeta o fila). La sección queda `aria-busy`. |
| 7. EmptyState y ErrorState | Vacío: "No encontramos lanzamientos con estos filtros." y, si hay criterios, "Quitar filtros". Error: "No pudimos cargar los lanzamientos." con "Reintentar", que vuelve a cargar pasando por el esqueleto. |
| Aceptación: la misma paginación en inicio, artista, sello y colecciones | Las cuatro usan `$lib/ui/Pagination` (12 por página, "x de y" tras el feedback). Artista y sello dejan el render progresivo; la colección pagina sus elementos. |

### Composición final por breakpoint

Medido con un filtro activo (`?pais=Colombia`), catálogo simulado de 300 lanzamientos. Coordenadas en px CSS.

| Ancho | Línea / bloque | Posición |
| --- | --- | --- |
| **360×800** | Header | 0–72 |
| | 1. «Buscar» + grilla/lista (sticky, se oculta al bajar) | 80–140 (control de 44 en 88–132) |
| | 2. Banda de filtros activos (desplazable) | 140–184 (chips de 32 en 146–178) |
| | 3. Paginación compacta (24–178) + orden (186–336) | 192–236 |
| | Primera portada | desde 249 |
| **390×844** | Igual que 360; la portada empieza en 249 y mide 340 | primera pantalla: header, tres líneas y 595 px de portada |
| **768–1023** | Barra móvil (≤768) o desktop (>768) según E15. Desktop: «Buscar» centrado, filtros en varias líneas, paginación numerada a la izquierda; orden (sin la etiqueta visible por debajo de 1024) y grilla/lista a la derecha. Panel: formulario y Radar apilados. | — |
| **834** (T) | Paginación "x de y" y contador a la izquierda · orden y vista a la derecha | barra en 228–272 |
| **≥1024** | Panel: formulario (1,25fr) · Radar (1fr) con línea divisoria; pie con "Reiniciar filtros" (acento) a la izquierda. Barra: paginación "x de y" · contador · "Ordenar por" + orden + grilla/lista. | — |
| **1440** | «Buscar» 100–152 · filtros activos ~175–205 · barra 228–272 · grilla desde ~290 | — |
| **Pie** | Desktop: paginación "x de y" centrada. Móvil (≤768): contador y paginación, centrados. | — |

- "Ordenar por" se ve desde 1024. Por debajo queda solo para lectores y el control muestra el icono de orden; por debajo de 480, tampoco el icono, para dejar sitio a la opción elegida.
- En la línea 3, la paginación nunca cede ancho: si no cabe, la opción del orden se recorta con elipsis. Con 233 páginas, "Más reciente" cabe entera a 360 y 390. "Mejor coincidencia" cabe a 390 y se recorta a 360 ("Mejor coincid…"). Ver "Pendiente del equipo".

### E15 y el sticky

No hubo choque, así que no se escaló:

- Solo la línea 1 es sticky, como en E15. La banda de filtros y la barra de resultados van en el flujo y suben con la página.
- La auto-ocultación (24 px de subida), la congelación con la hoja abierta, con un campo enfocado o con el teclado virtual siguen en `mobileSearchChrome.ts`, sin cambios.
- **El sticky no funciona hoy en ningún sitio.** `html, body { overflow-x: hidden }` (`styles.css`) anula `position: sticky`, como documentó U9. La barra «Buscar» se oculta y reaparece (el atributo y la transición funcionan), pero no se queda arriba. U10 no lo cambió: arreglarlo cambia el header de E14 en todo el sitio y el relevo de U9 lo asigna a U18 ("decidir el `overflow-x` global"). Con el arreglo, la línea 1 se quedaría arriba sobre la banda y la barra de resultados, que es el comportamiento de E15.

### Cambios de contrato respecto de E13 y E15

Los manda la ronda 3 ("Descubrimiento"); las pruebas se actualizaron a la vez:

- **E15, filtros activos:** la fila medida con "+N" se sustituye por la banda desplazable con todas las chips. `+N` y el evento `overflow` desaparecen. En desktop las chips pasan a varias líneas.
- **E13, barra en móvil:** paginación y orden ya no se apilan; comparten línea.
- **E13, error:** ahora tiene "Reintentar".
- **Nombre del orden:** el `<select>` se llama por su etiqueta visible, "Ordenar por" (antes `aria-label="Ordenar resultados"`, distinto del texto visible).
- **Anuncio `aria-live`:** U2 lo dejó evaluándose una sola vez ("Cargando lanzamientos." para siempre). Ahora sigue a la carga y a cada búsqueda.

### Primitivas

- **`Select` (nuevo, `$lib/ui/Select.svelte`).** `<select>` nativo con la altura (44), el borde y el radio de `Field`. Props: `label` (obligatoria), `options`, `value` (bindable), `hideLabel` (`true`, `'compact'` < 480 o `'wide'` < 1024), `inline`, `icon`, `compactIcon` (`false`: sin icono < 480), `onchange(value, event)`. Sin talla `sm`: un `<select>` no admite el pseudo-elemento que amplía el área táctil a 44. Sustituye al `<select>` provisional de `/lab` (U5 lo dejó para U10).
- **Icono `ordenar`** en `icons.ts`.
- **`LoadingIndicator`:** su `role="status"` lleva `aria-label` igual a `label`; antes no tenía nombre accesible.
- **`Pagination`:** `compact` es el valor por defecto (feedback). Por debajo de 480 el texto "N de M" cede su relleno lateral.
- **`Button`:** variante `accent` (feedback) e icono `reiniciar` en `icons.ts`.
- `Sheet`, `Chip`, `Button`, `IconButton`, `ViewToggle`, `Skeleton`, `EmptyState` y `ErrorState` se usan sin cambios.
- Sin tokens nuevos. `npm run lint:tokens` sigue con las dos excepciones de U4; la de `RadarVisual.svelte` (`font-size="7"` en unidades del viewBox) sigue: U10 no tocó ese archivo.

## Archivos

- **Nuevos**
  - `src/lib/ui/Select.svelte`.
  - `tests/browser/u10-inicio.spec.ts` (11 casos).
  - Línea base suplementaria: `home-list-D`, `home-list-M`, `home-loading-M`.
  - `docs/modernizacion/capturas-u10/` y este documento.
  - Respaldos `docs/modernizacion/respaldos/*.pre-u10.svelte.txt` (18 archivos).
- **Reescritos**
  - `src/lib/components/ActiveSearchPills.svelte` (banda de `Chip`).
  - `src/lib/components/SearchResultsBar.svelte` (`Pagination`, `Select`, `ViewToggle`).
  - `src/lib/components/home/`: `HomeResults` (esqueleto, estados, lista, paginación), `MobileSearchBar` (+ vista), `HomeSearchToggle` (`Button`, sin el barrido de luz en bucle), `HomeFilterPanel` (una caja), `MobileFilterSheet` (`Sheet`), `RadarPanel` (sin caja propia, `showTitle`), `ResetFiltersButton` (`Button` secundario).
- **Modificados**
  - `src/routes/+page.svelte`: vista recordada, reintento (`initialize` sale de `onMount`), conteo para la hoja, anuncio reactivo; se quitan `abrirFiltrosOcultos` y las medidas de viewport que ahora lleva `Sheet`.
  - `src/lib/components/Filtros.svelte`: sin caja propia, campo de 52/16 px, controles de 44 con `--control-radius`, chevrons e iconos con `Icon`/`IconButton` (antes `▾` tipográfico y SVG en línea).
  - `src/lib/components/RadarFiltros.svelte`: `showTitle`, `Button`, puntos accesibles y área táctil, columna más compacta (radar de 230 a 180 px).
  - `src/routes/artista/[slug]`, `sello/[slug]` y `coleccion/[slug]`: paginación.
  - `src/lib/ui/`: `LoadingIndicator`, `Pagination`, `icons.ts`, `index.ts`.
  - Tras el feedback: `src/lib/ui/Button.svelte` (variante `accent`), `LanzamientoFila.svelte` (composición móvil en todos los anchos), `u8-tarjeta.spec.ts` y `e17-recommendations-history.spec.ts` (ver "Pruebas").
  - `src/routes/lab/+page.svelte`: `Select` en lugar del `<select>` provisional y una fila de demostración.
  - Pruebas: `e12-search-state`, `e13-results-composition`, `e15-mobile-search`, `r2-hoja-filtros` y `tests/visual/censo.spec.ts` (ver "Pruebas").
- **Sin uso desde U10:** `src/lib/components/Pagination.svelte` (la paginación antigua). No se borró porque no está en git; hay copia en `respaldos/lib-components-Pagination.pre-u10.svelte.txt`. Se puede borrar al aceptar.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **106/106** |
| `npm run lint:tokens` | OK: 136 archivos, 2 excepciones temporales (las de U4) |
| `npm run build` | OK |
| `svelte-check` | Sin errores nuevos en los archivos de U10. Quedan los previos: `$types` sin generar, `any` implícitos en artista, sello y colección, `Buffer`/`process` en pruebas. |
| E12 + E13 + E15 + R2 (hoja) | **19/19** |
| `tests/browser/u10-inicio.spec.ts` | **11/11**; con `--repeat-each=2`, 20/20 (antes de añadir el caso de colección) |
| `npm run test:browser`, 1.ª corrida | 205 pasan, 5 omitidas, 4 fallan: E17:198 (persistente), E17:99 (intermitente conocida) y U5 "objetivo táctil de 44px" ×2, causada por U10 (`Select` sm en `/lab`) y corregida quitando esa talla |
| `npm run test:browser`, 2.ª corrida | 206 pasan, 5 omitidas, 3 fallan: E17:198 y U5 ×2 (antes de la corrección) |
| U5 + U6 lab tras la corrección | **28/28** |
| Tras el feedback: E12 + E13 + E15 + R2 + U10 + U8 + U5 | **73/73** (U8 con dos ajustes, ver abajo) |
| `npm run test:browser`, final | **208 pasan**, 5 omitidas, 1 falla: E17:198 (persistente desde U1, ahora en la línea 202) |
| E17:99 | Antes del arreglo de la prueba fallaba también en serie: la carrera de U2 (ver abajo). Tras el arreglo, 8/8 aislada y verde en la suite completa. |

Qué cubre `u10-inicio.spec.ts`:

- **390×844 con un filtro:** orden vertical buscar → filtros → paginación y orden → portada; paginación y orden en la misma fila; al menos un tercio de la primera portada sin scroll.
- **360:** paginación y orden en una línea de 44, sin solaparse ni desbordar la página.
- **Hoja:** foco inicial en ×, × sin texto, un solo "Cerrar", pie fijo al fondo, altura según contenido, "Ver N" cierra, devuelve el foco y coincide con el contador.
- **Radar en la hoja:** RADAR solo en el desplegable, 5 puntos por eje, objetivo de 44, `aria-pressed`, escribe `radar_bailable` en la URL, "Aleatorizar" secundario.
- **Vista:** el selector está en la línea de «Buscar» en móvil, la lista pinta 12 filas y se recuerda tras recargar.
- **Desktop:** una caja, campo de 52 y 16 px, "Reiniciar filtros" secundario y más ancho que alto; paginación, orden y vista en una línea.
- **Carga:** tres puntos en una fila, seis esqueletos de tarjeta, `aria-busy`.
- **Error y vacío:** "Reintentar" recarga; "Quitar filtros" limpia la URL.
- **Anuncio** `aria-live` que cambia con la búsqueda.
- **Paginación** en artista, sello y colección (15 y 14 elementos → 2 páginas).

Cambios en pruebas existentes (selectores; el contrato solo cambia donde lo manda la ronda 3):

- `e15-mobile-search.spec.ts`: el caso "+N" pasa a la banda (7 chips, `overflow-x: auto`, sin desborde de página, foco de vuelta a «Buscar»). Cabecera, cuerpo, fondo y panel se buscan por las clases de `Sheet` (`.ui-sheet__header`, `__body`, `__backdrop`, `__panel`) en lugar de `.filtros-mobile-*` y `[data-swipe-region]`.
- `e13-results-composition.spec.ts`: "Ordenar por"; misma línea en móvil en lugar de `grid-template-columns`; error con "Reintentar"; el texto del vacío se busca dentro del `role="status"`, porque el anuncio `aria-live` ahora lo repite.
- `e12-search-state.spec.ts`: el mismo ajuste del vacío.
- `r2-hoja-filtros.spec.ts`: lo que queda fuera de la parte visible de la banda desplazable no cuenta como desborde; la banda misma sí se comprueba.
- `tests/visual/censo.spec.ts`: `.filtros-mobile-body` → `.ui-sheet__body`; tres capturas suplementarias.
- `e17-recommendations-history.spec.ts:99`: guardaba el scroll antes de que el catálogo pintara (carrera documentada en U2) y suponía que el clic en "Abrir Alpha" no desplaza la página. Con la ventana de 420 px de la prueba el título queda en y = 536, así que el clic lo trae a la vista y el modal conserva ese scroll (correcto). Ahora espera al catálogo y lleva el disparador a la vista antes de guardar el scroll. El contrato (cerrar restaura el scroll del momento de abrir) no cambia.
- `u8-tarjeta.spec.ts` (tras el feedback): la fila no muestra géneros en ningún ancho; a 1440 los créditos largos de la fila pueden caber enteros, así que se comprueba que no parten línea en lugar de que se recorten; el toque "fuera" del radar usa el contador del pie (`.resultados__total-pie`).

No se ejecutó en Firefox ni WebKit (binarios no instalados, como en U6–U9).

## Capturas

Capturas de entrega en [`capturas-u10/`](./capturas-u10/) (actuales de la suite, más medidas a 360).

### Suite visual

Primera versión contra la línea base U9: **145 capturas, 81 iguales, 61 distintas, 3 nuevas**. Tras el feedback: **82 iguales, 63 distintas** (se suman `footer-D`, subpíxel; `home-list-D` y `lab-u8-D`, por la fila nueva), 0 errores, 0 inestables. Al aceptar se recapturó todo: 145 capturas, 0 diferencias.

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Inicio, desktop | `home-D`, `home-T`, `home-full-D/T`, `home-page2-D`, `home-filtered-D`, `home-approx-D`, `home-radar-results-D`, `home-pagination-D`, `home-welcome-D`, `home-beta-D` | «Buscar» como `Button` primario sin barrido; chips compactas; paginación numerada de la primitiva; "Ordenar por" con `Select`; grilla/lista en la barra; contador con separador de miles |
| Panel | `home-search-D`, `home-search-suggest-D`, `home-search-pais-D`, `home-search-tipo-D`, `home-filtered-panel-D`, `home-radar-D` | Una caja, campo de 52, controles de 44, Radar compacto, "Reiniciar filtros" secundario al pie |
| Inicio, móvil | `home-M`, `home-full-M`, `home-filtered-M`, `home-scrolled-M`, `home-welcome-M`, `home-beta-M` | Tres líneas: «Buscar» + vista, banda de filtros, paginación y orden en una línea |
| Hoja | `home-sheet-M`, `home-sheet-filtered-M`, `home-sheet-pais-M`, `home-sheet-radar-M` | `Sheet`: ×, chips en banda, sin caja interior, RADAR en mayúsculas en el desplegable sin título repetido, pie "Ver N lanzamientos" |
| Estados | `home-loading-D`, `home-empty-D`, `home-error-D` | Esqueleto + indicador; EmptyState con "Quitar filtros"; ErrorState con "Reintentar" |
| Artista y sello | `artista-D`, `sello-D` | Paginación numerada en lugar del render progresivo (la página mide 12 tarjetas) |
| El inicio tras una capa | `header-menu-D/M`, `header-auth-menu-M`, `header-account-menu-D`, `modal-*` (11), `debug-modal-overlap` | Solo cambia la franja del inicio visible tras el velo o el menú. En `modal-D` son 772 px en los bordes de las tarjetas del fondo. |
| `/lab` | `lab-D`, `lab-M`, `lab-u8-D` | `Select` en la línea móvil de demostración y fila nueva de `Select`; variante `accent` de `Button`; fila de lista con la composición móvil |
| Lista | `home-list-D` | Fila con la composición móvil (feedback). `home-list-M` no cambia. |
| Subpíxel | `card-row-D/M/T`, `footer-M` (470 → 468), `lab-u6-D/M`, `lab-u7-D/M`, `lab-u8-D/M` (±1–2 px de alto) | La página cambia de alto en fracciones de píxel o en la sección de arriba, y el texto se rasteriza distinto. Sin cambio visible. |

Ninguna diferencia fuera del alcance. `crate-D` no cambia (la colección del censo tiene menos de 13 elementos y la paginación no se pinta).

## Comprobaciones manuales pendientes

- **iPhone real (Safari):** la banda de filtros con el dedo (desplazamiento horizontal sin disparar el gesto vertical de la hoja), el selector nativo de "Ordenar por" y "Ver N lanzamientos" sobre el área segura.
- **VoiceOver:** orden de lectura de la hoja (título, ×, filtros activos, formulario, Radar, Reiniciar, Ver N) y anuncio de resultados.
- El doble toque del radar de la tarjeta (pendiente de U8) también en modo lista: la fila no tiene radar.

## Pendiente del equipo (abierto al aceptar)

1. **"Mejor coincidencia" a 360.** Cabe a 390 y se recorta a 360 ("Mejor coincid…"). Opciones: aceptarlo, o acortar la etiqueta del orden a "Coincidencia" en todos los anchos (es copy de E13; no lo cambié).
2. **`overflow-x` global** (U9 → U18): mientras siga, la línea «Buscar» no se queda arriba al desplazar.

## Deuda y riesgos fuera de U10

- **Página de artista y sello en la URL.** La página vive en el componente, no en la URL: la query de esas páginas es la búsqueda del catálogo (con su `p`), que la miga "Catálogo" devuelve intacta. Atrás/Adelante no recuerdan la página del artista. U11 rehace esas vistas y puede decidir.
- **Colección y reordenar (U14).** Con paginación, arrastrar solo mueve dentro de la página. U14 decide si el modo de orden muestra todos los elementos.
- **"Ordenar por" de artista y sello** sigue con su `<select>` propio: lo quita U11 ("sin filtros internos").
- `Filtros.svelte` sigue en ~930 líneas y con su propio combobox de sugerencias (agrupadas por tipo), que no es el `Combobox` de U6 (selección múltiple con chips). Unificarlos cambiaría el comportamiento de búsqueda.
- Las sugerencias conservan los colores por tipo (`--color-cat-*`), un hallazgo del censo que no está en las decisiones de la ronda 3.

## Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| E12, E13 y E15 en verde | Cumplido: 19/19 con R2. Los ajustes de E13/E15 están listados arriba. |
| 390×844: la primera portada asoma sin scroll con un filtro activo | Cumplido: empieza en y = 249 (prueba) |
| Paginación y orden en una línea a 360 | Cumplido (prueba). "Mejor coincidencia" se recorta a 360 (pendiente 1). |
| La paginación tiene el mismo diseño en inicio, artista, sello y colecciones | Cumplido: la misma primitiva en las cuatro (prueba) |
| Suite visual | 61 diferencias, todas dentro del alcance (tabla de arriba); línea base sin recapturar |
| Solo tokens y primitivas | Cumplido: `Button`, `IconButton`, `Chip`, `Select` (nueva), `Pagination`, `ViewToggle`, `Sheet`, `Skeleton`, `LoadingIndicator`, `EmptyState`, `ErrorState`. Lint en verde. |

## Rollback

Sin datos ni migraciones.

1. Restaurar desde `docs/modernizacion/respaldos/*.pre-u10.svelte.txt` los 18 archivos (inicio, `LanzamientoFila`, `components/home/*`, `ActiveSearchPills`, `SearchResultsBar`, `Filtros`, `RadarFiltros`, `LoadingIndicator`, artista, sello y colección). `components/Pagination.svelte` no se tocó.
2. Borrar `src/lib/ui/Select.svelte` y su export en `index.ts`; quitar los iconos `ordenar` y `reiniciar` de `icons.ts`, la variante `accent` de `Button`, y en `Pagination.svelte` volver a `variant = 'auto'` y quitar el bloque `max-width: 479px` del estado.
   - `LanzamientoFila.svelte`: restaurar desde `respaldos/lib-components-LanzamientoFila.pre-u10.svelte.txt` (reconstruida tras el cambio a partir de la versión de U8 leída antes de editar).
   - `components/Pagination.svelte` se restaura desde `respaldos/lib-components-Pagination.pre-u10.svelte.txt`.
3. En `/lab`, volver al `<select>` provisional (y sus estilos `.lab__sort`) y quitar la fila de `Select`.
4. Revertir los ajustes de pruebas de "Pruebas" y borrar `u10-inicio.spec.ts`, las tres capturas suplementarias y sus líneas en `censo.spec.ts`, `capturas-u10/` y este documento.

## Al aceptar

1. Hecho: `npm run visual:capture` (carga ~4,4) y 0 diferencias en la comparación siguiente.
2. Hecho: borrado `src/lib/components/Pagination.svelte`.
3. Pendiente: decidir si `capturas-u10/` (4,7 MB) se versiona o se archiva fuera del repositorio.
4. Pendiente: los respaldos `*.pre-u10.svelte.txt` se pueden borrar cuando el cambio esté en git.

## Relevo

- **U11 (bienvenida, beta, artista y sello):**
  - artista y sello ya paginan con `Pagination`; falta quitar su "Ordenar por" y decidir si la página va a la URL (ver "Deuda");
  - la bienvenida va sobre la línea «Buscar» en móvil (`home-welcome-M`); si cambia de alto, la portada sigue asomando solo si la bienvenida no ocupa toda la primera pantalla.
- **U14 (colecciones):** `ViewToggle` con `context="coleccion"` y `Sortable`; la colección ya pagina de 12 en 12 (ver "Deuda").
- **U18 (QA):**
  - `overflow-x` global y sticky de la línea «Buscar»;
  - matriz en WebKit e iPhone real (banda, selector nativo, hoja);
  - "Mejor coincidencia" a 360 si el equipo no decide antes.
- **API para quien siga:** `Select` (arriba), `ActiveSearchPills` (`pills`, `layout: 'responsive' | 'band'`, `label`, evento `remove`), `SearchResultsBar` (`view` y evento `view`), `HomeResults` (`view`, `hasCriteria`; eventos `view`, `retry`, `reset`), `MobileFilterSheet` (`count`), `RadarPanel`/`RadarFiltros` (`showTitle`).
