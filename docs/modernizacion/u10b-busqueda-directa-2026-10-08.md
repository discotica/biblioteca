# U10b-1 — Búsqueda directa: desktop (2026-10-08)

Etapa U10b-1 del [plan de búsqueda directa](../producto/plan-busqueda-directa-2026-10-08.md#u10b-1--desktop-campo-directo-y-formulario-sin-hueco). Corrió en Claude Opus 5.5 con esfuerzo `high`. No hubo que escalar a `xhigh`: E12 y E17 (sesión del modal, scroll) siguen verdes tras la extracción. No se hizo commit ni push. No se tocaron `searchMatching.ts`, `searchState.ts`, el formato de la URL, los datos ni producción. La línea base oficial no se recapturó.

Estado: **implementada, pendiente de aceptar.** U10b-2 (móvil) también está implementada y pendiente de aceptar: ver [U10b-2](#u10b-2--móvil-input-en-la-barra-hoja-sin-pie-y-radar-en-dos-columnas-2026-10-08) al final. Es una enmienda a U10 (aceptada). U11 sigue implementada y sin aceptar, por eso la comparación visual usa la referencia aislada `tests/visual/.ref-pre-u10b/`.

## Feedback del equipo (ajuste antes de aceptar)

| Feedback | Cambio |
| --- | --- |
| "Cuando está estática me gusta más la barra en el centro, y que al expandirse se ponga a la izquierda" | El campo cerrado va centrado (donde estaba el botón «Buscar») y al abrir crece desde el centro hasta ocupar todo el ancho, así que su borde izquierdo queda en el del panel. La fila usa `justify-content: center` en los dos estados: al crecer no salta de lado. |
| Cómo conviven las chips | Acompañan al campo: centradas bajo el campo cerrado y al inicio con el panel abierto, alineadas con el formulario. `ActiveSearchPills` gana `align: 'start' \| 'center'`, que solo actúa desde 768, en varias líneas: una banda desplazable centrada cortaría su inicio. Alternativa descartada: chips siempre a la izquierda, descolgadas bajo un campo centrado. |
| "La animación del panel abriéndose más expresiva, no necesariamente más larga, con personalidad, sin overshoot" | Token nuevo `--ease-expressive: cubic-bezier(0.16, 1, 0.3, 1)` (arranque rápido, frenada larga, y ≤ 1). La entrada pasa de transición Svelte a animación CSS con tokens. El panel se descubre de arriba abajo (`clip-path`, que deja ver la sombra) mientras baja 8 px, en 200 ms (`--motion-base`, igual que antes); las columnas llegan con 20 y 50 ms de desfase (180 ms). El campo pasa de `ease` a la misma curva, así que el gesto es uno solo. Con movimiento reducido no se anima nada, tampoco la salida, que antes duraba 180 ms aunque el movimiento estuviera reducido. |
| "Que las chips se alineen a la izquierda con el campo una vez abierto en vez de correrse súbitamente" | `ActiveSearchPills` anima el cambio de `align` con FLIP (WAAPI): cada chip viaja desde su posición anterior con `--motion-fast` y `--ease-expressive`, los mismos que el campo, y llega alineada con su borde izquierdo. Al cerrar vuelve al centro igual. Sin animación con movimiento reducido. |

Registrado en `decisiones.md` ("Búsqueda directa"); la posición, además, en la tabla de decisiones del plan. El resto del documento describe la versión con el ajuste.

## Condición de arranque

- `git status --short`: el árbol tiene trabajo sin versionar de etapas anteriores (`src/lib/components/home/` entero está sin seguimiento). Se preservó todo y solo se tocaron los archivos de la lista "Archivos".
- Referencia aislada: `VISUAL_BASELINE_DIR=.ref-pre-u10b npm run visual:capture`, con 145 capturas. Solo falló "el censo conserva sus 127 IDs" (130), que falla así desde U7 y no es una diferencia de captura.
- Respaldos en `docs/modernizacion/respaldos/*.pre-u10b.svelte.txt`: `Filtros`, `HomeFilterPanel`, `HomeSearchToggle` (borrado), `MobileFilterSheet` y `routes/+page`.

## Resultado

| Trabajo | Hecho |
| --- | --- |
| 1. `SearchCombobox` y `filterOptions` | El combobox sale de `Filtros` con el mismo comportamiento y el mismo ARIA. Se conservan el estado, el ranking, los grupos País / Género / Artista / Sello / Álbum, el teclado, el cierre a los 160 ms tras el blur y las clases `.busqueda-*` y `.sug-*`. Props: `lanzamientos`, `valores`, `placeholder`, `size` (`lg` 52 / `md` 44), `id` e `inputEl` (bindable). Eventos: `filtrar` (el mismo payload), `activate`, `escape` y `commit`. Las listas de país, género, tipo y año pasan a `$lib/domain/filterOptions.ts`, que es puro y tiene prueba unitaria. |
| 2. `HomeSearchBar` | Es una región `role="search"` con el campo, las chips y el panel. Cerrado, el campo va centrado y mide `min(100%, 24rem)`, con las chips centradas debajo. Abierto, crece desde el centro con `--motion-fast` hasta el ancho del panel, las chips pasan al inicio y aparece la × "Cerrar búsqueda" (`IconButton` lg, `aria-expanded`, `aria-controls="panel-busqueda"`). Detalle en "Apertura y cierre". |
| 3. Grilla de `Filtros` | `layout="panel"`: 4 columnas, con País·Género en la fila 1 y Tipo·Año·«Reiniciar filtros» en la fila 2. Reiniciar ocupa 2 columnas, a la altura de los controles y sin etiqueta. `layout="sheet"`: 2 columnas, con Reiniciar en su propia línea (ancho automático, a la izquierda) y País y Género apilados bajo 680. Emite `reset`. El pie del panel desaparece. |
| 4. Integración | En `+page.svelte`, `HomeSearchBar` sustituye a `HomeSearchToggle`, al bloque `.active-pills-outside` y a `HomeFilterPanel`. `mostrarPanelFiltros` se mantiene (`bind:open`). `exploreWelcome` y `BetaInvitation.returnFocus` apuntan al input. `HomeSearchToggle.svelte` se borró. |
| 5. Hoja móvil (temporal) | `MobileFilterSheet` conserva un `SearchCombobox` arriba (`id="busqueda-hoja"`) y usa `Filtros layout="sheet" showReset={false}`, porque «Reiniciar» sigue en su pie junto a "Ver N" hasta U10b-2. La barra móvil no cambia. |
| 6. Pruebas | Nuevo `tests/browser/u10b-busqueda.spec.ts` con 13 casos de desktop. Se ajustaron los selectores de 7 archivos (ver "Pruebas"). |
| 7. Decisiones | Registradas en `decisiones.md`, "Búsqueda directa (2026-10-08, U10b)". |

### Apertura y cierre

- **Abre:** `pointerdown` o clic en el campo, `input` (escribir o pegar), una tecla imprimible o ArrowDown. `SearchCombobox` emite `activate` y la barra lo trata de forma idempotente.
- **No abre:** el foco. Ni Tab, ni «Explorar» de la bienvenida, ni el cierre de la invitación beta, que devuelve el foco al campo. Las sugerencias sí se muestran al enfocar si ya hay texto, como antes.
- **Cierra:**
  - la ×, que conserva el texto escrito, las chips y el radar;
  - Esc: el primero cierra las sugerencias (`aria-expanded` pasa a `false`) y el segundo el panel;
  - un `pointerdown` fuera de la región, escuchado en `document`.

  La × y Esc dejan el foco en el campo, y como el foco no abre, el panel no se reabre.
- **Cuenta como dentro:** todo lo que vive en la región, es decir, las chips, las sugerencias (posición absoluta dentro del campo) y los desplegables de País, Género, Tipo y Año.
- **`dropdownMenu` no se reutiliza:** mueve el foco al abrir, lo devuelve al cerrar y hace `preventDefault` del `pointerdown` de fuera. Aquí ese clic tiene que llegar a su destino: un resultado, la paginación o una tarjeta.
- **Enter con el panel cerrado** sigue creando la chip (E12): el texto no depende del panel.

### Medidas (catálogo del censo, 2.790 lanzamientos)

| Ancho | Cerrado | Abierto |
| --- | --- | --- |
| 1440 | Campo 528–912 × 100–152 (384 = 24rem, centrado) | Campo + × = 144–1296, el ancho de la caja del panel; × 1244–1296 |
| 1024 | Campo 320–704 | Campo + × = 24–1000; formulario 1,25fr · radar 1fr |
| 834 | Campo 225–609 | Campo + × = 24–810; formulario arriba y radar apilado debajo |

- Fila 2 a 1440, 1024 y 834: Tipo, Año y Reiniciar con el mismo `top` (±1 px) y la misma altura (44). Reiniciar llega al borde derecho de Género (prueba).
- A 1440, medido: campo 100–152; sin chips, la barra de resultados en 168 (16 px bajo el campo, como bajo el botón). Con chips, la banda ocupa 160–204 (chips de 32 en 166–198) y la barra empieza en 220 (antes, chips ~175–205 y barra en 228). Abierto, la caja del panel empieza en 216, 12 px bajo la banda.
- En móvil (≤768) la región solo muestra la banda de chips bajo `MobileSearchBar`. La fila del campo está oculta y, sin chips, la región no ocupa alto.

### Ajuste visual dentro del alcance

- **Un solo anillo de foco en el campo.** La regla global `:where(input):focus-visible` ponía su `box-shadow` en el `<input>` dentro de la fila, que ya marca el foco con `:focus-within`. Se veían dos rectángulos, uno dentro del otro. Ya pasaba antes (`home-search-suggest-D` de la referencia), pero ahora el campo enfocado es el estado normal al abrir. `.busqueda-input` lleva `box-shadow: none`.

## Pruebas

| Prueba | Antes (sin editar) | Después |
| --- | --- | --- |
| `npm test` | — | **110/110**: suma `tests/filter-options.test.mjs` (4 casos) al script `test` de `package.json` |
| `npm run lint:tokens` | — | OK: 138 archivos, las 2 excepciones de U4 |
| `npm run build` | — | OK |
| `svelte-check` | — | Sin errores nuevos en los archivos de la etapa. `filterOptions.ts` importa `./releases.ts` con extensión, como los otros 9 módulos de dominio: lo exige `npm test` (`--experimental-strip-types`). `svelte-check` lo marca igual que a esos 9 (`allowImportingTsExtensions`). |
| `npm run test:browser`, 1.ª corrida | 214 pasan · 5 omitidas · 2 fallan: **E17:202** (persistente) y **E14** `catalogo.spec.ts:450` (intermitente conocida) | **226 pasan** · 5 omitidas · 1 falla: **E17:202** |
| `npm run test:browser`, 2.ª corrida | 215 pasan · 5 omitidas · 1 falla: **E17:202** | **226 pasan** · 5 omitidas · 1 falla: **E17:202** |
| `u10-inicio` + `u10b-busqueda`, `--repeat-each=3` | — | 66/66 (antes del feedback) |
| Tras el feedback, `test:browser` 1.ª | — | **226 pasan** · 5 omitidas · 2 fallan: **E17:202** y **E17:182** (Back/Forward, intermitente conocida, antes en la línea 178; 5/5 aislada) |
| Tras el feedback, `test:browser` 2.ª | — | **227 pasan** · 5 omitidas · 1 falla: **E17:202** |
| Tras el feedback de la animación, `test:browser` ×2 | — | **228 pasan** · 5 omitidas · 1 falla: **E17:202**, en las dos |
| `u10b-busqueda`, `--repeat-each=3` | — | 39/39 |

- Fallos conocidos: E17:202 persistente; E14, E16:294 y E17:99 intermitentes. Después de editar solo apareció E17:202, en las dos corridas. Antes, E14 falló una vez.
- La suite pasa de 221 a 234 casos: los 13 nuevos de `u10b-busqueda.spec.ts` (11, más el de la alineación de las chips y el del movimiento, tras el feedback).
- No se ejecutó en Firefox ni WebKit: los binarios no están instalados, como en U6–U11.

Qué cubre `u10b-busqueda.spec.ts` (desktop):

- A 1440, 1024 y 834:
  - **un clic abre:** el campo cerrado va centrado, mide `min(fila, 384)` y 52 de alto, sin ×. Un clic lo enfoca y abre el panel. La × no tiene texto y lleva `aria-expanded`/`aria-controls`. Abierto, el campo y la × ocupan exactamente la caja del panel y no hay scroll horizontal;
  - **fila 2 sin hueco:** Tipo, Año y Reiniciar comparten `top` y altura, Reiniciar termina donde termina Género y no hay `.filtros-pie`.
- A 1440:
  - **chips:** centradas bajo el campo cerrado (mismo centro, ±1 px) y al inicio de la fila con el panel abierto, alineadas con el campo;
  - **escribir abre y la × conserva:** un foco programático no abre; escribir sí. La × cierra, deja el foco en el campo, conserva el texto, las 2 chips (país y radar) y la URL. Volver con el foco no reabre; un clic sí;
  - **Esc ×2:** el primero cierra las sugerencias y deja el panel; el segundo cierra el panel con el foco en el campo. Enter con el panel cerrado crea la chip `texto`;
  - **clic fuera:** quitar una chip, elegir una sugerencia y marcar una etiqueta en País no cierran; un clic en la barra de resultados sí;
  - **Tab:** se llega al campo con Tab sin abrir el panel, y ArrowDown abre;
  - **movimiento:** el panel entra con `--ease-expressive` en 200 ms y cada chip tiene su animación FLIP de 140 ms con la misma curva, que termina al cerrar;
  - **transición:** `max-width` en 140 ms (`--motion-fast`) con `--ease-expressive`; con movimiento reducido, `transition-property: none`, sin animación del panel y sin FLIP.

Pruebas existentes ajustadas (selectores; el contrato solo cambia donde lo manda el plan):

- `u10-inicio.spec.ts` (desktop): se abre con un clic en el campo, que está fuera de `.filtros-caja`. "Cerrar búsqueda" es la × sin texto, Reiniciar comparte fila con Tipo y no hay pie. Se espera a que termine la entrada del panel (8 px) antes de medir. Los casos móviles no cambian: la hoja sigue con "Ver N" y Reiniciar en el pie hasta U10b-2.
- `e12-search-state.spec.ts`: el combobox se abre con un clic en lugar del botón «Buscar».
- `e15-mobile-search.spec.ts`: `.boton-buscar-toggle` → `.home-search__row` (oculta ≤768, visible >768).
- `e19-beta-invitation.spec.ts`: el disparador visible y el destino del foco al cerrar son el campo. Además se comprueba que el panel sigue cerrado. Estos casos se omiten con el flag apagado.
- `e20-welcome.spec.ts`: «Explorar» enfoca el campo sin abrir el panel, y el disparador desktop es el campo en todos los anchos. El título del caso pasa de "enfoca Buscar" a "enfoca el campo de búsqueda".
- `r2-hoja-filtros.spec.ts`: `.select-row .dropdown` → `.filtros-grilla .campo .dropdown`. Con el selector viejo el bucle no habría encontrado nada y la prueba habría pasado sin comprobar los selects.
- `tests/visual/censo.spec.ts`: `openSearch` hace clic en `.home-search .busqueda-input` y espera `#panel-busqueda`; el select de Tipo pasa a `.filtros-grilla .campo details.dropdown`.
- `catalogo.spec.ts` y `u6-lab.spec.ts` no necesitaron cambios: no usan los selectores afectados.

## Comparación visual contra `.ref-pre-u10b`

`VISUAL_BASELINE_DIR=.ref-pre-u10b npm run visual:compare`, tras los dos ajustes del feedback: **145 capturas, 106 iguales, 39 distintas**, 0 errores, 0 inestables. Son las mismas 39 que en la versión con el campo a la izquierda.
- En el estado cerrado la diferencia baja de 25.728 a 18.711 px, porque el campo ocupa el sitio del botón.
- La animación nueva no cambia ninguna captura (la suite corre con movimiento reducido), salvo los dos desplegables (ver la tabla).
- La carga media era de 7 a 10. `home-search-pais-D` y `home-search-tipo-D` se repitieron solas con carga 5,7 y dieron lo mismo. Las dos que no tienen relación con la etapa se repitieron solas con carga 6 y dieron lo mismo (ver la última fila).

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Inicio desktop, panel cerrado | `home-D`, `home-full-D`, `home-page2-D`, `home-list-D`, `home-loading-D`, `home-error-D`, `home-welcome-D` (18.711 px cada una), `home-beta-D` (11.302, bajo el diálogo) | El botón «Buscar» pasa a ser el campo, centrado en el mismo sitio. El resto de la página no se mueve: el campo y el botón miden 52 y los márgenes son los mismos. |
| Inicio desktop con chips | `home-filtered-D`, `home-approx-D`, `home-radar-results-D` (~130.000), `home-empty-D` (36.184) | Campo en lugar del botón; las chips, centradas bajo él (antes iban al inicio). Las chips suben 8 px (8 de separación bajo el campo en lugar de 16 bajo el botón), y con ellas la barra y la grilla: la barra pasa de 228 a 220 a 1440. |
| Panel abierto | `home-search-D`, `home-filtered-panel-D`, `home-radar-D` (~31 %), `home-search-suggest-D` (31 %) | El campo sale de la caja y ocupa todo el ancho sobre el formulario y el radar, con la × a la derecha. Las chips van entre el campo y la caja. La fila 2 es Tipo·Año·Reiniciar y no hay pie, así que el panel es más bajo y la grilla sube. Las sugerencias tienen el ancho del campo abierto. Un solo anillo de foco. |
| Desplegables del panel | `home-search-pais-D` (687.933), `home-search-tipo-D` (793.561) | Mismo cambio del panel. Además, la página ya no aparece desplazada: en la referencia bajaba ~170 px al abrir el desplegable. Ese scroll solo pasaba en la suite: la entrada anterior era una transición de Svelte en JS, que corría aunque el contexto pidiera movimiento reducido, y lo probable es que el clic sobre un `summary` aún en movimiento desplazara la página. Ahora la entrada es CSS y se apaga con movimiento reducido. En uso real, `scrollY` sigue en 0 al abrir País, con o sin movimiento reducido y con o sin esperar a la animación (comprobado). Con el campo a la izquierda eran 52.010 y 56.510 px. |
| Tablet (834) | `home-T`, `home-full-T` (18.710), `modal-T` (11.304, tras el velo) | El campo centrado en lugar del botón |
| El inicio tras una capa | `header-menu-D`, `header-account-menu-D` (18.711); `modal-*-D` (11 capturas) y `debug-modal-overlap` (128 px) | Solo cambia la franja del campo, que se ve tras el menú o el velo del modal. En los modales son 128 px en el borde inferior del campo, más ancho que el botón. |
| Hoja móvil | `home-sheet-M` (41.745), `home-sheet-filtered-M` (57.158), `home-sheet-pais-M` (109.082) | La grilla de `Filtros` tiene un solo espacio entre filas (16). País y Género, apilados bajo 680, quedan a 16 en lugar de 12, y la hoja crece 4 px (sube 4 px desde el borde inferior). No cambia nada más. U10b-2 rehace el orden de la hoja. |
| Subpíxel o sin relación | `home-sheet-radar-M` (10 px), `lab-u6-M` (332 px) | `home-sheet-radar-M`: los 4 px de la hoja desplazan el radar en fracciones de píxel. `lab-u6-M`: antialiasing en los números de las portadas simuladas de la lista ordenable; `/lab` no importa ningún archivo tocado. Las dos se repitieron solas con menos carga y dieron lo mismo. |

Ninguna diferencia fuera del alcance. Las comparaciones esperada/actual de diez capturas representativas están en [`capturas-u10b/suite/`](./capturas-u10b/suite/).

## Capturas de entrega

En [`capturas-u10b/`](./capturas-u10b/), con los datos del censo (2.790 lanzamientos), a 1440, 1024 y 834 × 1000, sin animación:

| Estado | Archivos |
| --- | --- |
| Panel cerrado | `u10b-{1440,1024,834}-cerrado.png` |
| Abierto (clic en el campo) | `u10b-{ancho}-abierto.png` |
| Con sugerencias ("trib") | `u10b-{ancho}-sugerencias.png` |
| Con filtros, abierto | `u10b-{ancho}-filtros.png` (`?genero=Techno&genero=Tribal&pais=Colombia&texto=entrañas&año=2025`) |
| Con filtros, cerrado | `u10b-{ancho}-filtros-cerrado.png` |

Se sacaron con un spec temporal sobre el servidor y los mocks de la suite visual. Se borró al terminar.

## Archivos

- **Nuevos**
  - `src/lib/components/SearchCombobox.svelte`
  - `src/lib/components/home/HomeSearchBar.svelte`
  - `src/lib/domain/filterOptions.ts`
  - `tests/browser/u10b-busqueda.spec.ts` (13 casos) y `tests/filter-options.test.mjs` (4 casos)
  - `docs/modernizacion/capturas-u10b/` y este documento
  - Respaldos: `respaldos/lib-components-Filtros.pre-u10b.svelte.txt`, `lib-components-home-HomeFilterPanel.pre-u10b.svelte.txt`, `lib-components-home-HomeSearchToggle.pre-u10b.svelte.txt`, `lib-components-home-MobileFilterSheet.pre-u10b.svelte.txt`, `routes-page.pre-u10b.svelte.txt` y `lib-components-ActiveSearchPills.pre-u10b.svelte.txt`
  - Referencia visual: `tests/visual/.ref-pre-u10b/` (145 capturas)
- **Reescritos:** `src/lib/components/Filtros.svelte` (solo los controles, la grilla y `layout`) y `src/lib/components/home/HomeFilterPanel.svelte` (sin pie ni contenedor propio, con `id`)
- **Modificados**
  - `src/lib/components/home/MobileFilterSheet.svelte` (`SearchCombobox` temporal y `layout="sheet"`)
  - `src/routes/+page.svelte` (integración)
  - `src/lib/components/ActiveSearchPills.svelte` (prop `align` y su FLIP, tras el feedback; respaldo `lib-components-ActiveSearchPills.pre-u10b.svelte.txt`)
  - `src/lib/styles/tokens.css` (token `--ease-expressive`; respaldo `lib-styles-tokens.pre-u10b.css.txt`)
  - `package.json` (solo el script `test`)
  - `docs/modernizacion/decisiones.md`
  - Pruebas: `u10-inicio`, `e12-search-state`, `e15-mobile-search`, `e19-beta-invitation`, `e20-welcome`, `r2-hoja-filtros` y `tests/visual/censo.spec.ts`
- **Borrado:** `src/lib/components/home/HomeSearchToggle.svelte` (no estaba en git; copia en `respaldos/`)
- **Sin tocar:** `searchMatching.ts`, `searchState.ts`, `homeSearchView.ts`, `overlay.ts`, `Sheet.svelte`, `RadarFiltros.svelte`, `MobileSearchBar.svelte`, `ResetFiltersButton.svelte` (ya tenía `block`), los datos y la línea base oficial

## Pendiente del equipo

1. **Dos × juntas con texto escrito.** Abierto y con texto, "Limpiar búsqueda" (sm, dentro del campo) queda a ~40 px de "Cerrar búsqueda" (lg, fuera). Tienen tamaño y nombre distintos, pero el mismo icono para dos acciones. Se ve en `u10b-1024-sugerencias.png` y `u10b-1440-sugerencias.png`. Opciones: aceptarlo, quitar "Limpiar" en desktop (borrar el texto ya es una tecla) o darle otro icono. No lo cambié: el plan pedía extraer el combobox sin cambiar su comportamiento.
2. **Sugerencias a ancho completo.** Con el campo abierto, el listado mide lo mismo que el campo: 1.090 px a 1440 para etiquetas cortas. Antes medía ~590, el ancho de la columna del formulario. Opciones: aceptarlo, o limitarlo (p. ej. a 40rem) alineado a la izquierda.
3. **Hueco bajo el formulario a ≥1024** cuando el radar es más alto que las dos filas. Es anterior a U10b, pero ahora se nota más porque el panel ya no tiene pie.

## Rollback

Sin datos ni migraciones.

1. Restaurar desde `docs/modernizacion/respaldos/*.pre-u10b.svelte.txt`: `Filtros`, `HomeFilterPanel`, `HomeSearchToggle`, `MobileFilterSheet`, `ActiveSearchPills` y `routes/+page`, y `tokens.css` desde `lib-styles-tokens.pre-u10b.css.txt`.
2. Borrar `SearchCombobox.svelte`, `HomeSearchBar.svelte`, `filterOptions.ts`, `u10b-busqueda.spec.ts` y `filter-options.test.mjs`, y quitar este último del script `test` de `package.json`.
3. Restaurar los selectores de las pruebas de "Pruebas" y la sección "Búsqueda directa" de `decisiones.md`.
4. Borrar `tests/visual/.ref-pre-u10b/`, `capturas-u10b/` y este documento.

## Al aceptar

1. Recapturar la línea base oficial (`npm run visual:capture`) cuando estén aceptadas U11 y U10b, o solo U10b si el equipo acepta U11 antes.
2. Borrar `tests/visual/.ref-pre-u10b/` y, cuando el cambio esté en git, los respaldos `*.pre-u10b.svelte.txt`.

## Relevo a U10b-2 (móvil)

- **Punto de partida:**
  - `MobileFilterSheet` lleva un `SearchCombobox` temporal arriba (`id="busqueda-hoja"`) y `Filtros layout="sheet" showReset={false}`. U10b-2 quita las dos cosas: el input pasa a la barra y «Reiniciar» a la propia grilla de la hoja (`showReset` por defecto).
  - Luego hay que quitar el pie "Ver N", el `<details>` del radar y el snippet `footer`.
  - Si `showReset` deja de usarse, se puede borrar de `Filtros`.
- **API disponible:**
  - `SearchCombobox`: `size="md"` (44 px) para la barra; `id` único por instancia (la hoja usa `busqueda-hoja`, desktop el valor por defecto `busqueda`, y el listbox es `sugerencias-${id}`); `bind:inputEl`; `on:commit` para el `blur()` que baja el teclado.
  - La barra puede ignorar `activate` y `escape`: no hay panel que abrir.
  - Las sugerencias son `position: absolute` bajo el campo. Para anclarlas a ancho completo bajo la barra hará falta un modificador de estilo o un contenedor relativo a la barra.
- **Región `role="search"` en móvil:** `HomeSearchBar` sigue montado ≤768 y solo muestra la banda de chips: el campo desktop está oculto (`display: none`, fuera del árbol accesible). Hoy el landmark contiene solo chips. Con el input en `MobileSearchBar`, conviene decidir si la barra es la región de búsqueda (y `HomeSearchBar` deja de serlo ≤768) para no tener dos landmarks ni uno vacío.
- **`returnFocus` de la hoja:** sigue siendo el botón de `MobileSearchBar` (`mobileSearchButtonEl`). El plan lo pasa al botón Filtros en U10b-2, y `exploreWelcome` debe apuntar al input móvil.
- **Pruebas que esperan a U10b-2:**
  - `e15-mobile-search.spec.ts`, `u10-inicio.spec.ts` (móvil), `r2-hoja-filtros.spec.ts` y `catalogo.spec.ts` (`Abrir filtros de búsqueda`) usan el botón `/Buscar y filtrar/` y la hoja con pie;
  - los casos móviles de `u10b-busqueda.spec.ts` (sugerencias bajo la barra, Enter → chip y blur, Filtros sin input, sin pie y el asomo del radar a 390×844 y 360×800).
- **Hoja a 4 px:** los 16 px entre País y Género apilados vienen de la grilla. Si U10b-2 quiere 12, puede poner `row-gap` propio en `filtros-grilla--sheet`.

---

# U10b-2 — Móvil: input en la barra, hoja sin pie y radar en dos columnas (2026-10-08)

Etapa U10b-2 del [plan](../producto/plan-busqueda-directa-2026-10-08.md#u10b-2--móvil-input-en-la-barra-hoja-sin-pie-y-radar-en-dos-columnas). Corrió en Claude Opus 5.5 con esfuerzo `high`. No hubo que escalar a `xhigh`: la congelación de `mobileSearchChrome` con el campo de la barra enfocado y el gesto de la hoja siguen en verde. No se hizo commit ni push. No se tocaron `searchMatching.ts`, `searchState.ts`, `mobileSearchChrome.ts`, el formato de la URL ni los datos. La línea base oficial no se recapturó.

Estado: **implementada, pendiente de aceptar.**

## Condición de arranque

- `git status --short`: el mismo árbol sin versionar de U10b-1. Solo se tocaron los archivos de "Archivos".
- `tests/visual/.ref-pre-u10b/` es anterior a U10b-1, así que no reflejaba su final. Se recapturó el árbol de U10b-1 como **`tests/visual/.ref-pre-u10b-2/`** antes de editar: 145 capturas. Solo falló "el censo conserva sus 127 IDs" (130), que falla así desde U7.
- Respaldos en `docs/modernizacion/respaldos/*.pre-u10b-2.*.txt`: `MobileSearchBar`, `MobileFilterSheet`, `Sheet`, `RadarFiltros`, `icons.ts`, `Filtros`, `HomeSearchBar`, `SearchCombobox` y `routes/+page`. `RadarPanel.svelte` no tiene respaldo: solo cambiaron dos comentarios.

## Resultado

| Trabajo | Hecho |
| --- | --- |
| 1. `MobileSearchBar` | `[SearchCombobox md, flex 1][Filtros][ViewToggle]` en una línea de 44. Filtros es un `IconButton` secundario con el icono nuevo `filtros` (tres deslizadores, en `icons.ts`), `aria-haspopup="dialog"`, `aria-expanded` y el nombre "Filtros" o "Filtros, N activo(s)". La insignia del número va en la esquina, `aria-hidden` porque el número ya está en el nombre. Las sugerencias salen bajo la barra a todo su ancho: la barra es el ancla (`position: relative`) y el `busqueda-wrap` del combobox pasa a `static`. Sobre la banda de chips porque la barra es sticky con su propia capa. Tras `commit` (Enter o una sugerencia), `blur()` del input. Campo y Filtros son opacos (`--color-velo-opaco` con desenfoque), como el botón «Buscar» al que sustituyen, porque flotan sobre los resultados. |
| 2. `MobileFilterSheet` | Sin campo de texto, sin `<details>` y sin el snippet `footer`: desaparecen "Ver N lanzamientos" y el pie, y se cierra con la × de la cabecera. Orden: País · Género / Tipo · Año / «Reiniciar filtros» (con su texto completo, en la grilla de `Filtros`) / Radar con su título, separado por una línea. Se quitó la prop `count`. |
| 3. `Sheet` | Prop opcional `maxHeight` (CSS) que sustituye a `--sheet-max-h` en el `max-height` del panel. El viewport visual sigue limitando. Es el único cambio a la primitiva. La hoja de filtros mide al abrir (tras `tick`, antes del primer pintado): la distancia de la cabecera al `.radar` dentro del panel, más el `scrollTop` del cuerpo, más 72 px. El tope es `min(…, var(--sheet-max-h))`, es decir, 88dvh. Recalcula en `resize`, pero no cuando cambian las chips: con la hoja abierta no salta (hay prueba). |
| 4. `RadarFiltros` | Se quita el colapso a una columna bajo 1023: siempre `ejes \| gráfico`. Variables nuevas: `--pip-hit-x` y `--pip-hit-y` (por defecto `--pip-hit`) y `--radar-spine` (1,1rem). Bajo 680 pasa a la versión compacta: la etiqueta y el valor van sobre los puntos (grilla `label valor / pips`), con menos aire entre ejes (`--space-1`), el gráfico mide ~115 px y Aleatorizar/Limpiar van bajo él, en su columna (`display: contents` en `.radar-controls` y áreas de grilla). Con el dedo bajo 480, los puntos miden 40 × 44. El panel desktop no cambia: 0 px de diferencia en `home-search-D`, `home-radar-D` y `home-filtered-panel-D`. |
| 5. Integración | `+page.svelte` pasa `lanzamientos`, `valores` y `filtrar` a la barra. `exploreWelcome` enfoca el input móvil ≤768. El `returnFocus` de la hoja es el botón Filtros. `HomeSearchBar` deja de ser `role="search"` ≤768 (`matchMedia`) y la barra lo es: así hay un solo landmark. `Filtros` pierde `showReset`, que ya no usaba nadie. |
| 6. Pruebas | Cinco casos nuevos en `u10b-busqueda.spec.ts` (dos por ancho y el del teclado) y selectores ajustados en 6 archivos (ver "Pruebas"). |
| 7. Decisiones | En `decisiones.md`, "Búsqueda directa", "Implementación (U10b-2)". |

### Desviaciones del plan (registradas en `decisiones.md`)

- **Radar compacto bajo 680, no bajo 480.** A tamaño completo (etiqueta al lado y gráfico de 180), `ejes | gráfico` necesita 566 px con el dedo, y la hoja ofrece 432 px a 480 de ancho. Con ratón tampoco cabe a 400. El plan quitaba el colapso a una columna bajo 1023, así que entre 480 y ~614 habría desbordado. Bajo 680 se usa la versión compacta con cualquier puntero. Los puntos de 40 × 44 siguen limitados al dedo bajo 480; entre 480 y 679 miden 44 × 44. Desktop (>768) no cambia.
- **Placeholder «Buscar» en la barra.** A 360 el campo mide 160 px y el placeholder de desktop se cortaba ("País, género, a"). «Buscar» es el rótulo que tenía el botón. El nombre accesible sigue siendo "Buscar por país, género, artista, sello o álbum".
- **Alto de las sugerencias.** El listado se limita al borde visible del viewport visual (`--busqueda-dropdown-max-h`, con un mínimo de 160 px) y desplaza por dentro. Con el teclado abierto, las últimas opciones no quedan debajo. Es una variable opcional de `SearchCombobox`; en desktop no se define y no cambia nada (0 px en `home-search-suggest-D`).

### Medidas (catálogo del censo, táctil, sin animación)

| | 390 × 844 | 360 × 800 |
| --- | --- | --- |
| Barra (y = 88, alto 44) | campo 24–214 (190) · Filtros 222–266 · vista 274–366 | campo 24–184 (160) · Filtros 192–236 · vista 244–336 |
| Hoja al abrir, sin chips / con 2 chips | 501 / 545 px (tope 88dvh = 743) | 501 / 545 px (tope 704) |
| Asomo del radar sobre el borde inferior | 72 px (título «Radar» y la etiqueta del primer eje) | 72 px |
| Scroll del cuerpo hasta el final del radar | 313 px | 313 px |
| Puntos del radar · gráfico | 40 × 44 · 115 px | 40 × 44 · 104 px |
| Scroll horizontal (página y cuerpo) | no | no |

## Pruebas

| Prueba | Antes (sin editar) | Después |
| --- | --- | --- |
| `npm test` | — | **111/111**: suma "U10b iconos: filtros…" a `ui-primitives.test.mjs` |
| `npm run lint:tokens` | — | OK: 138 archivos, las 2 excepciones de U4 |
| `npm run build` | — | OK |
| `svelte-check` | — | Ningún diagnóstico en los archivos tocados. El total (100 errores, todos en archivos ajenos a la etapa, p. ej. `admin/catalogo`) no se comparó contra el árbol anterior. |
| `npm run test:browser`, 1.ª corrida | **228 pasan** · 5 omitidas · 1 falla: **E17:202** | **232 pasan** · 5 omitidas · 2 fallan: **E17:202** y **E14** `catalogo.spec.ts:450` |
| `npm run test:browser`, 2.ª corrida | **228 pasan** · 5 omitidas · 1 falla: **E17:202** | **233 pasan** · 5 omitidas · 1 falla: **E17:202** |
| `u10-inicio` + `u10b-busqueda`, `--repeat-each=3` | — | 87/87 |
| E14 aislada | — | 10/10 en serie; 9/10 dos veces con 4 workers |

- La suite pasa de 234 a 239 casos: los 5 nuevos de `u10b-busqueda.spec.ts`. Los dos casos móviles de U10 sobre la hoja se rehacen sin cambiar el número.
- **E14** (`catalogo.spec.ts:450`) falla en la línea 479: la **cabecera global** debe seguir visible con un campo de prueba enfocado al pie de la página. Es la misma aserción intermitente que se anota desde U4 y que falló en el arranque de U10b-1. La etapa no toca `Header.svelte` ni su lógica. Solo falla con carga en paralelo (1/10).
- No se ejecutó en Firefox ni WebKit: los binarios no están instalados, como en U6–U11.

Casos móviles nuevos de `u10b-busqueda.spec.ts`:

- A 390×844 y 360×800, con dedo:
  - **barra:** un solo landmark `search`, y es la barra. El campo, Filtros (44 × 44) y la vista van en una línea, centrados en vertical. Filtros se llama "Filtros, 1 activo", con `aria-haspopup="dialog"`, `aria-expanded` y la insignia «1». Escribir muestra sugerencias bajo la barra, a todo su ancho y por encima de las chips. No hay scroll horizontal. Enter crea la chip, vacía el campo, cierra el listado, suelta el foco (el teclado baja) y el nombre pasa a "Filtros, 2 activos";
  - **hoja:** Filtros la abre (`aria-expanded="true"`) sin combobox ni textbox, sin pie, sin "Ver …" y sin `<details>`. Tipo y Año comparten fila, Reiniciar va debajo y el radar debajo de Reiniciar. El radar asoma entre 40 y 120 px sobre el borde inferior de la hoja, que mide ≤ 88 % del alto. El cuerpo desplaza sin scroll horizontal. Elegir un punto añade una chip a la cabecera y la altura de la hoja no cambia. La × cierra y el foco vuelve a Filtros.
- A 390×600, **teclado:** con el campo de la barra enfocado y `visualViewport` reducido 300 px, desplazar 360 px no oculta la barra. Al soltar el campo y recuperar el viewport, vuelve a ocultarse al bajar. Este caso confirma que la congelación de `mobileSearchChrome` cubre el input.

Pruebas existentes ajustadas:

- `e15-mobile-search.spec.ts`: el disparador `/Buscar y filtrar/` pasa a ser el botón `Filtros` de la barra. ≤768 se exige además el `combobox` de la barra con 44 px; >768, oculto. La hoja no tiene pie y el radar (su título) está en el árbol desde el principio: sustituye a "Radar plegado". Sticky, swipe, touch CDP, `visualViewport`, Back/Forward y el foco de vuelta no cambian.
- `u10-inicio.spec.ts`:
  - el caso de la hoja ya no busca "Ver N lanzamientos" ni el cierre por el pie. Comprueba que no hay pie y que «Reiniciar filtros» va en el cuerpo, bajo Tipo y Año; la × cierra y devuelve el foco a Filtros;
  - el radar ya no se despliega: se miden las dos columnas (el gráfico a la derecha de los ejes), la etiqueta sobre sus puntos, puntos de ≥ 40 × ≥ 44 y Aleatorizar/Limpiar bajo el gráfico;
  - la primera prueba mide `.mobile-search-row` en lugar de `.mobile-search-bar`.
- `r2-hoja-filtros.spec.ts`: las sugerencias largas se comprueban en la barra (antes en la hoja) y la hoja se abre con Filtros.
- `catalogo.spec.ts` (E04): el disparador es Filtros.
- `e20-welcome.spec.ts`: ≤768 el buscador visible es el combobox de la región de búsqueda (la barra).
- `tests/visual/censo.spec.ts`: `openSheet` hace clic en `.mobile-search-filters button`; `home-sheet-radar-M` ya no abre un `summary`.
- `u6-lab.spec.ts` no cambia: su "Ver 124 lanzamientos" es la demo de `Sheet` en `/lab`, que conserva su pie.

## Comparación visual contra `.ref-pre-u10b-2`

`VISUAL_BASELINE_DIR=.ref-pre-u10b-2 npm run visual:compare`: **145 capturas, 130 iguales, 15 distintas**, 0 inestables. La carga media era de 6 a 9. **Ninguna captura desktop o tablet del inicio cambia**, incluidos el panel abierto (`home-search-D`, `home-filtered-panel-D`, `home-radar-D`) y las sugerencias (`home-search-suggest-D`).

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Barra móvil | `home-M`, `home-full-M`, `home-list-M`, `home-welcome-M` (2.881 px), `home-loading-M` (2.839), `home-filtered-M` (6.209, con la insignia «5»), `home-beta-M` (7.903, tras el diálogo), `header-menu-M` (1.975) y `header-auth-menu-M` (1.987, tras el menú) | El botón «Buscar» centrado pasa a ser el campo (placeholder «Buscar»), con Filtros y la vista al lado. La barra mide lo mismo: nada más se mueve. |
| Hoja | `home-sheet-M` (254.352), `home-sheet-filtered-M` (296.823), `home-sheet-pais-M` (323.228), `home-sheet-radar-M` (269.653) | Sin campo ni pie, «Reiniciar filtros» en el cuerpo y el radar desplegado, con 72 px a la vista. La hoja mide 501 px en lugar de ~550, así que su borde superior baja ~50 px. En `home-sheet-radar-M` el cuerpo desplazado muestra el radar en dos columnas. Nota: la suite visual emula móvil sin dedo (`pointer: fine`), así que ahí los puntos miden 24 × 24. Las capturas de entrega, con dedo, muestran los de 40 × 44. |
| Galería de iconos | `lab-D` (2.189), `lab-M` (8.699) | El icono nuevo `filtros` entra en la galería de `/lab` y desplaza los de su fila. |

Las comparaciones esperada/actual de `home-M`, `home-filtered-M`, las cuatro de la hoja y `lab-D` están en [`capturas-u10b/suite-u10b2/`](./capturas-u10b/suite-u10b2/).

## Capturas de entrega

En [`capturas-u10b/`](./capturas-u10b/), con los datos del censo, táctiles (`hasTouch`, `isMobile`, ×2) y sin animación, sobre `/?genero=Techno&pais=Colombia`:

| Estado | 390 × 844 | 360 × 800 |
| --- | --- | --- |
| Barra (campo, Filtros con «2», vista; chips debajo) | `u10b2-390-barra.png` | `u10b2-360-barra.png` |
| Sugerencias ("trib") bajo la barra | `u10b2-390-sugerencias.png` | `u10b2-360-sugerencias.png` |
| Hoja al abrir, con el radar asomando | `u10b2-390-hoja.png` | `u10b2-360-hoja.png` |
| Hoja desplazada a la mitad | `u10b2-390-hoja-desplazada.png` | `u10b2-360-hoja-desplazada.png` |
| Radar (cuerpo al final) | `u10b2-390-radar.png` | `u10b2-360-radar.png` |

Se sacaron con un spec temporal sobre el servidor y los mocks de la suite visual. Se borró al terminar.

## Archivos (U10b-2)

- **Modificados**
  - `src/lib/components/home/MobileSearchBar.svelte` (reescrito)
  - `src/lib/components/home/MobileFilterSheet.svelte` (sin campo ni pie, con la altura medida)
  - `src/lib/ui/Sheet.svelte` (prop `maxHeight`)
  - `src/lib/components/RadarFiltros.svelte` (dos columnas y versión compacta)
  - `src/lib/ui/icons.ts` (`filtros`)
  - `src/lib/components/SearchCombobox.svelte` (`--busqueda-dropdown-max-h` opcional)
  - `src/lib/components/Filtros.svelte` (sin `showReset`)
  - `src/lib/components/home/HomeSearchBar.svelte` (sin landmark ≤768)
  - `src/lib/components/home/RadarPanel.svelte` (comentarios)
  - `src/routes/+page.svelte`
  - `docs/modernizacion/decisiones.md`
  - Pruebas: `u10b-busqueda`, `u10-inicio`, `e15-mobile-search`, `r2-hoja-filtros`, `catalogo`, `e20-welcome`, `tests/visual/censo.spec.ts` y `tests/ui-primitives.test.mjs`
- **Nuevos:** `tests/visual/.ref-pre-u10b-2/` (145 capturas), `capturas-u10b/u10b2-*.png` (10), `capturas-u10b/suite-u10b2/` (14) y los respaldos `*.pre-u10b-2.*.txt` (9)
- **Sin tocar:** `searchMatching.ts`, `searchState.ts`, `mobileSearchChrome.ts`, `overlay.ts`, `ResetFiltersButton.svelte`, los datos y la línea base oficial

## Pendiente del equipo (U10b-2)

1. **Cuánto asoma el radar.** Con 72 px se ven el título «Radar» y la etiqueta «Experimental», pero no sus puntos (ver `u10b2-390-hoja.png`). El plan dice "su cabecera y el primer eje". Para ver la primera fila de puntos harían falta ~100 px. Es un número (`RADAR_PEEK` en `MobileFilterSheet`).
2. **«Reiniciar filtros» siempre visible**, también sin filtros activos, como en el panel desktop. Antes vivía en el pie.
3. **«Limpiar búsqueda» en la barra.** Con texto escrito, la × pequeña del campo (pendiente 1 de U10b-1) también aparece en la barra móvil, donde el campo mide 160–190 px. Se decide junto con desktop.

## Comprobaciones manuales pendientes (iPhone real)

Este entorno solo tiene Chromium emulado: el teclado virtual se simula reduciendo `visualViewport`. Falta comprobar en un iPhone con Safari:

1. **Teclado sobre la barra sticky.** Al tocar el campo con la página desplazada: que Safari no desplace la página de forma que la barra quede bajo la barra de direcciones, que la barra no se oculte mientras se escribe y que las sugerencias quepan sobre el teclado (con desplazamiento interno si son muchas). Tras Enter o una sugerencia, que el teclado baje y la barra siga visible. Comprobar también con la barra de direcciones colapsada y en horizontal.
2. **Gesto de la hoja.** Arrastrar desde el asa o la cabecera cierra (≥ 72 px o un gesto rápido). Desplazar el cuerpo hasta el radar no cierra la hoja, ni rebota la página de fondo (`overscroll-behavior`). Tocar un punto del radar no inicia el gesto. La altura medida respeta `safe-area-inset-bottom` (iPhone con barra de inicio).
3. **VoiceOver.**
   - Rotor: un solo punto de referencia "Catálogo" (búsqueda), y es la barra.
   - El campo se anuncia como cuadro combinado con sugerencias, y las opciones se recorren.
   - Filtros se anuncia como "Filtros, N activos, botón, emergente". La insignia no se lee aparte.
   - Al abrir la hoja, el foco va a "Cerrar"; al cerrarla, vuelve a Filtros.
   - Los puntos del radar se anuncian "Bailable: 3 de 5", con estado pulsado.
   - Tras crear una chip con Enter, no se pierde el contexto: el foco sale del campo, así que comprobar dónde queda el cursor de VoiceOver.

## Rollback (U10b-2)

Sin datos ni migraciones.

1. Restaurar desde `docs/modernizacion/respaldos/*.pre-u10b-2.*.txt` los nueve archivos, y en `RadarPanel.svelte` los dos comentarios.
2. Quitar los 5 casos móviles de `u10b-busqueda.spec.ts` y el test del icono, y restaurar los selectores de "Pruebas existentes ajustadas".
3. Quitar "Implementación (U10b-2)" de `decisiones.md` y borrar `tests/visual/.ref-pre-u10b-2/`, `capturas-u10b/u10b2-*`, `capturas-u10b/suite-u10b2/` y esta sección.

## Al aceptar (U10b-1 y U10b-2)

1. Recapturar la línea base oficial (`npm run visual:capture`) cuando estén aceptadas U11 y U10b.
2. Borrar `tests/visual/.ref-pre-u10b/` y `.ref-pre-u10b-2/` y, cuando el cambio esté en git, los respaldos `*.pre-u10b*.txt`.
