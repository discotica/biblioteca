# U10b — Búsqueda directa (desktop y móvil)

## Contexto

Hoy, en desktop, la búsqueda se abre con un botón «Buscar» centrado ([HomeSearchToggle.svelte](src/lib/components/home/HomeSearchToggle.svelte)). Ese botón despliega un panel ([HomeFilterPanel.svelte](src/lib/components/home/HomeFilterPanel.svelte)) que tiene el campo de texto, País·Género, una fila Tipo·Año con hueco (`.select-row` es una grilla de 4 columnas con 2 ocupadas) y «Reiniciar filtros» al pie. Hay dos problemas:

- El disparador va centrado y el contenido alineado a la izquierda.
- Para escribir hacen falta dos clics.

En móvil, la barra sticky es un botón que abre una hoja con un pie "Ver N lanzamientos". Ahí el radar va plegado y, desplegado, ocupa mucho alto y deja el gráfico al final.

Objetivo: el campo de texto pasa a ser el disparador. Un clic basta para escribir, y los filtros se reorganizan sin huecos. En móvil, buscar y filtrar se separan y el radar se compacta.

Es una enmienda a U10 (aceptada). U11 está implementada pero sin aceptar, así que la comparación visual usa una referencia aislada.

## Decisiones tomadas (rondas 1–3 con el equipo, 2026-10-08)

| Tema | Decisión |
| --- | --- |
| Disparador desktop | Un campo de texto real en lugar del botón: centrado cerrado y a todo el ancho abierto (feedback tras U10b-1; la ronda 1 lo dejaba a la izquierda) |
| Apertura | Clic o tap en el campo, o empezar a escribir: el campo se amplía, aparece la × y se despliega el panel. El foco por Tab no abre el panel (no hay cambio en foco). |
| Ancho abierto | Ancho total del panel, por encima del formulario y del radar |
| × | Cierra el panel y conserva texto, filtros y radar (el comportamiento actual de "Cerrar búsqueda") |
| Otros cierres | Esc (el primero cierra las sugerencias, el segundo el panel) y clic fuera de la región de búsqueda |
| Transición | El ancho crece con `--motion-fast`; sin transición con `prefers-reduced-motion` |
| Chips activas | Fuera del campo, bajo él y sobre el panel; se ven con el panel abierto o cerrado. Centradas con el campo cerrado y al inicio con el panel abierto |
| Texto | Se mantiene Enter o sugerencia → chip. No se filtra en vivo y no cambian E11 ni E12. |
| Formulario desktop | Fila 1: País · Género. Fila 2: Tipo · Año · Reiniciar (acento). El pie del panel desaparece. |
| Radar desktop | Sin cambios, en la columna derecha |
| Tablet 769–1023 | El patrón de desktop, con el radar apilado bajo el formulario (corte E15 en 768, sin cambios) |
| Barra móvil | Un input real, más un botón Filtros con el número de activos, más ViewToggle. Las sugerencias salen bajo la barra y la hoja ya no lleva campo de texto. |
| Hoja móvil | Sin pie: se quita "Ver N" y se cierra con la × de la cabecera. Orden: País·Género / Tipo·Año / Reiniciar / Radar desplegado. |
| Altura de la hoja | Medida al abrir: chips, formulario, Reiniciar y ~72 px del radar (su cabecera y el primer eje), con tope de 88dvh. El resto se ve con scroll. |
| Radar móvil | Dos columnas (ejes | gráfico) en todos los anchos. Puntos de 40 × 44 con el dedo, etiqueta pequeña sobre los puntos, menos aire entre ejes, gráfico de ~115 px, y Aleatorizar/Limpiar bajo el gráfico. |

Hay que registrarlas en `docs/modernizacion/decisiones.md`, en una sección nueva: "Búsqueda directa (2026-10-08, U10b)".

## Diseño

### Componentes

- **Nuevo `src/lib/components/SearchCombobox.svelte`.** Se extrae de [Filtros.svelte](src/lib/components/Filtros.svelte) todo el combobox: estado `textoTemporal`, `ranking`, `matchTop`, los conjuntos de artistas, sellos, álbumes, países y géneros, `gruposSugerencias`, el teclado, el dropdown y los estilos `.busqueda-*` y `.sug-*`. El comportamiento y el ARIA combobox se mantienen idénticos.
  - Props: `lanzamientos`, `valores`, `placeholder`, `size` (`lg` en desktop y `md` en la barra móvil), `inputEl` (bindable).
  - Eventos: `filtrar` (el mismo payload que hoy), `activate` (pointerdown, click o la primera tecla imprimible o ArrowDown con el panel cerrado), `escape` (Esc con las sugerencias ya cerradas) y `commit` (tras crear una chip).
  - Las listas únicas de país y género que usa también el formulario se mueven a una utilidad pura compartida, p. ej. `src/lib/domain/filterOptions.ts`, para no duplicarlas.
- **`Filtros.svelte`** queda solo con los controles.
  - Grilla de 4 columnas: País y Género ocupan 2 columnas cada uno; Tipo y Año, 1 cada uno; `ResetFiltersButton` ocupa 2 columnas y se alinea a la altura de los controles (44 px), sin etiqueta encima.
  - Prop `layout = 'panel' | 'sheet'`. En `sheet` hay 2 columnas (País·Género / Tipo·Año) y Reiniciar va en su propia línea, con ancho automático y alineado a la izquierda. Bajo 680 sigue el apilado actual de País y Género si los nombres no caben (verificar a 360).
  - Emite `reset`.
- **Nuevo `src/lib/components/home/HomeSearchBar.svelte`** (desktop, >768). Sustituye a `HomeSearchToggle`. Es una región `role="search"` que contiene, en orden, el campo, las chips (`ActiveSearchPills`) y el panel (`HomeFilterPanel`).
  - Cerrado, el campo mide `min(100%, 24rem)`. Abierto, `100%`, con la `IconButton` × "Cerrar búsqueda" (`aria-expanded`, `aria-controls` del panel) a su derecha.
  - Clic fuera: un listener en `document` (pointerdown) cierra si el objetivo queda fuera de la región. Las chips, las sugerencias y los desplegables de País y Género cuentan como dentro. `dropdownMenu` de [overlay.ts](src/lib/ui/overlay.ts) se reutiliza si encaja.
  - × y Esc cierran y dejan el foco en el campo, sin reabrir. Como el panel solo se abre con `activate`, un foco programático no lo abre. Eso cubre `exploreWelcome` y `BetaInvitation.returnFocus`.
- **`HomeFilterPanel.svelte`**: se quita `.filtros-pie` y pasa `layout="panel"` a `Filtros`. Conserva la caja, las columnas 1,25fr·1fr desde 1024 y el apilado por debajo.
- **`MobileSearchBar.svelte`**: queda `[SearchCombobox size md, flex 1][Filtros (n)][ViewToggle]`.
  - Botón Filtros: `IconButton` con un icono nuevo, `filtros` (deslizadores, en [icons.ts](src/lib/ui/icons.ts)), y la insignia de conteo actual. Nombre accesible: "Filtros" o "Filtros, N activos". Lleva `aria-haspopup="dialog"`.
  - Las sugerencias van ancladas bajo la barra, a ancho completo, por encima de la banda de chips.
  - En móvil, tras `commit`, se hace `blur()` del input para bajar el teclado y mostrar los resultados.
  - La congelación por campo enfocado o teclado de [mobileSearchChrome.ts](src/lib/ui/mobileSearchChrome.ts) ya cubre el input.
- **`MobileFilterSheet.svelte`**:
  - Sin campo de texto (`Filtros layout="sheet"`), sin `<details>` del radar (`RadarPanel` siempre visible, con `showTitle`) y sin el snippet `footer`.
  - Calcula la altura al abrir: la cabecera de la hoja, más `offsetTop` del radar dentro del cuerpo, más 72 px, con tope `--sheet-max-h`. La recalcula al cambiar el tamaño del viewport, pero no cuando cambian las chips mientras está abierta, para que no salte.
- **`Sheet.svelte`**: prop opcional `maxHeight` (CSS) que, cuando existe, sustituye a `--sheet-max-h` en el cálculo de `max-height`. Es el único cambio a la primitiva.
- **`RadarFiltros.svelte`**:
  - Se quita el colapso a 1 columna bajo 1023. El radar queda siempre como `ejes | gráfico`.
  - Con `(pointer: coarse) and (max-width: 479px)`: `--pip-hit` horizontal de 40 px con altura de 44, etiqueta sobre los puntos, `gap` entre ejes reducido y gráfico de ~115 px. Aleatorizar/Limpiar pasan a la columna del gráfico.
  - Para separar ancho y alto del punto: `--pip-hit-x` y `--pip-hit-y`.
- **`+page.svelte`**:
  - `HomeSearchToggle` y el bloque `.active-pills-outside` pasan a `HomeSearchBar`. El estado `mostrarPanelFiltros` se mantiene.
  - `desktopSearchButtonEl` pasa a ser el input y `mobileSearchButtonEl` el input móvil, para `exploreWelcome`. La hoja recibe como `returnFocus` el botón Filtros.
  - Se borra `HomeSearchToggle.svelte`, con respaldo en `docs/modernizacion/respaldos/*.pre-u10b.svelte.txt`, como en U10.
  - Las chips en móvil siguen igual: banda bajo la barra.

### Contratos de prueba que cambian (actualizar con la etapa)

- `e15-mobile-search.spec.ts`: el disparador `/Buscar y filtrar/` pasa a ser el botón `Filtros` y aparece un `combobox` en la barra. El resto de E15 (sticky, swipe, visualViewport, Back/Forward) se mantiene.
- `u10-inicio.spec.ts`:
  - Se quita "Ver N lanzamientos" de la hoja y la comprobación de que cierra y devuelve el foco (ahora lo hace la ×).
  - El radar de la hoja se mide en dos columnas, con puntos de ≥40 × ≥44.
  - En desktop desaparece "Cerrar búsqueda" como botón de texto: es la × y el campo tiene 52 px.
  - Reiniciar comparte la fila con Tipo y Año.
- `catalogo.spec.ts`, `tests/visual/censo.spec.ts` (selectores `.boton-buscar-toggle` y `.sheet-radar`) y `u6-lab.spec.ts`: ajustar selectores.
- Nuevo `tests/browser/u10b-busqueda.spec.ts`:
  - Un clic en el campo enfoca y abre el panel.
  - El ancho crece hasta el del panel.
  - La × cierra y conserva las chips.
  - Esc ×2 cierra.
  - Clic en los resultados cierra; clic en una chip, una sugerencia o el desplegable de País no cierra.
  - Tab no abre el panel.
  - Fila 2 = Tipo·Año·Reiniciar con el mismo `top`.
  - Móvil: escribir en la barra muestra sugerencias, Enter crea una chip y baja el teclado (blur), Filtros abre la hoja sin input de texto, la hoja no tiene pie y el radar asoma entre 40 y 120 px por encima del borde inferior de la hoja a 390×844 y 360×800, sin scroll horizontal.

## Etapas

### U10b-1 — Desktop: campo directo y formulario sin hueco

Alcance:
- Extraer `SearchCombobox` y `filterOptions`.
- Crear `HomeSearchBar`.
- Cambiar la grilla de `Filtros` (`layout`) y quitar el pie de `HomeFilterPanel`.
- Integrar en `+page.svelte`.
- Ajustar los tests de desktop y añadir los casos desktop de `u10b-busqueda.spec.ts`.

La hoja móvil solo recibe `Filtros layout="sheet"` sin input, y su barra se mantiene hasta U10b-2. Para no dejar el móvil sin texto entre etapas, `MobileFilterSheet` conserva temporalmente un `SearchCombobox` arriba hasta U10b-2.

Perfil de ejecución: **Modelo** Opus 5.5 · **Esfuerzo** `high` · **Motivo:** el refactor del combobox ARIA, la lógica de foco, apertura y clic fuera, y la integración con el estado de la URL · **Escalar a `xhigh` solo si** E12 o E17 (sesión de modal, scroll) fallan por la extracción.

### U10b-2 — Móvil: input en la barra, hoja sin pie y radar en dos columnas

Alcance:
- Rehacer `MobileSearchBar`, con el icono `filtros`.
- `MobileFilterSheet` sin input, sin pie y con el radar visible y la altura medida.
- Prop `maxHeight` en `Sheet`.
- Radar a dos columnas con puntos de 40 × 44.
- Tests de E15 y U10 en móvil, y los casos móviles de `u10b-busqueda.spec.ts`.

Perfil de ejecución: **Modelo** Opus 5.5 · **Esfuerzo** `high` · **Motivo:** el sticky, el teclado virtual y `visualViewport`, la medición de la hoja y los contratos E15 · **Escalar a `xhigh` solo si** el input en la barra sticky rompe la congelación de `mobileSearchChrome` o el gesto de la hoja.

## Archivos críticos

- Nuevos: `src/lib/components/SearchCombobox.svelte`, `src/lib/components/home/HomeSearchBar.svelte`, `src/lib/domain/filterOptions.ts`, `tests/browser/u10b-busqueda.spec.ts` y `docs/modernizacion/u10b-busqueda-directa-2026-10-08.md`.
- Modificados: `Filtros.svelte`, `HomeFilterPanel.svelte`, `MobileSearchBar.svelte`, `MobileFilterSheet.svelte`, `RadarFiltros.svelte`, `ResetFiltersButton.svelte` (si hace falta `block`), `src/lib/ui/Sheet.svelte`, `src/lib/ui/icons.ts`, `src/routes/+page.svelte` y `decisiones.md`.
- Borrado: `HomeSearchToggle.svelte` (con respaldo).
- Sin tocar: `searchMatching.ts`, `searchState.ts`, el formato de la URL y los datos.

## Verificación (cada etapa)

1. Antes de editar, porque U11 no está aceptada: `VISUAL_BASELINE_DIR=.ref-pre-u10b npm run visual:capture`. Después, comparar contra esa referencia; la línea base oficial no se toca. No editar `src/` mientras captura.
2. `npm test`, `npm run lint:tokens`, `npm run build`, `svelte-check` (sin errores nuevos).
3. `npm run test:browser` dos veces en caliente. Fallos conocidos: E17:202 persistente; E14, E16:294 y E17:99 intermitentes.
4. Inspección manual con `npm run dev`:
   - 1440, 1024 y 834: el campo cerrado a la izquierda, la apertura y la ×, Esc, el clic fuera, la fila 2 sin hueco y el radar a la derecha o apilado.
   - 390 y 360: el input de la barra, el teclado, Filtros, el asomo del radar y el radar en dos columnas.
5. Capturas de entrega en `docs/modernizacion/capturas-u10b/` (copiarlas desde `report/diferencias` antes de recapturar).
6. Sin commit ni push. La línea base oficial se recaptura cuando el equipo acepte.

## Prompts por etapa

En [`prompts-busqueda-directa-2026-10-08.md`](./prompts-busqueda-directa-2026-10-08.md).
