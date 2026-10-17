# U8 — Tarjeta y modo lista (2026-10-07)

Etapa U8 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). El plan asigna Claude Sonnet 5.5 con esfuerzo `high`. El chat corrió en **Claude Opus 5.5** con esfuerzo `high`, por elección del equipo. No hubo que escalar: tocar la portada para ver el radar no interfiere con abrir la ficha ni con el scroll (ver "Radar"). No se hizo commit ni push, y no se tocaron la ficha, los datos, el despliegue ni producción. El selector grilla/lista del inicio no se conectó (es U10).

Estado: **aceptada el 2026-10-07**, junto con U7. Se recapturó `tests/visual/baseline/darwin/`: 142 capturas y 0 diferencias después. Se borraron `tests/visual/.ref-pre-u8/` y `CreditSummary.svelte`. Sigue pendiente probar el doble toque en un iPhone real.

## Condición de arranque

- U6 está aceptada (2026-10-07, [`decisiones.md`](./decisiones.md), ronda 3).
- **U7 no está aceptada.** U8 depende solo de U6, así que se siguió. Consecuencia: el árbol de partida ya traía las diferencias de U7.
- `npm run visual:compare` antes de editar: 140 capturas, **114 diferencias, exactamente las de U7** según su relevo. Ninguna `card-*` difería.
- Para aislar U8 de U7 sin tocar la línea base, se capturó el estado de partida en `tests/visual/.ref-pre-u8/darwin/` (140 capturas). Para eso se añadió la variable `VISUAL_BASELINE_DIR` a la suite (ver "Suite visual").
- El árbol viene de U7, sin commits desde `0ab31e0`.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Tarjeta: Cover y CreditLine | `Cover ambient` sustituye a `.card::before` y `CreditLine` sustituye a `CreditSummary`. "Varios artistas" abre su menú en el portal, así que ya no queda debajo de la fila siguiente. |
| 1. Año · país · sello y géneros con el paso nuevo | `--text-2xs` (12 px, contraste ≥ 4.5:1 desde U4), en una sola línea. Los géneros pasan a `Chip` (nueva talla `sm` de 24 px), hasta tres más "+N". |
| 1. Compartir como IconButton discreto | `IconButton` `sm` `ghost`, en el tono de los metadatos. Al copiar, el icono pasa a ✓, la ayuda dice "Enlace copiado" y una región viva lo anuncia. |
| 1. Altura estable | Créditos, datos y géneros ocupan siempre una línea, aunque estén vacíos o sean largos. El título, una o dos. Las tarjetas de una fila de la grilla miden lo mismo y sus datos quedan alineados abajo (ver "Altura estable"). |
| 2. Radar | Con cursor, al pasar por la portada. Con el dedo, el primer toque lo muestra y el segundo abre la ficha (ver "Radar"). |
| 3. Fila del modo lista | `LanzamientoFila`: las mismas piezas en 73 px de alto. No hay radar. En móvil, sin géneros. |
| 4. Nunca más de 3 columnas | Grilla compartida `.lanzamientos-grilla` en inicio, artista, sello y colección. Los tracks son `minmax(max(20rem, ⅓), 1fr)` con `auto-fill`, así que es imposible una cuarta columna. |

### Decisiones tomadas en la etapa

**Título de la tarjeta (decisión del equipo, 2026-10-07)**

- Hasta U7 el título se veía a `--text-3xl` (25–32 px, 800). La regla `.titulo`, declarada después, pisaba los 16 px/650 de `.titulo--grid`: el censo lo describe con los valores que no se veían.
- Una primera versión de U8 lo dejó a 16 px. El equipo lo encontró demasiado pequeño, y el anterior demasiado grande: pidió un punto medio.
- Queda en `--text-2xl` (24 px), 800, interlineado 1,1.
- Hasta dos líneas (`--card-title-lines`). Un título más largo se recorta con elipsis y se lee completo en la ayuda (`title`) y en la ficha.

**Altura estable**

- Créditos, datos y géneros tienen siempre una línea; el título, una o dos.
- Las celdas de una fila de la grilla se estiran (`align-items: stretch`), así que las tarjetas de la fila miden lo mismo. Datos y géneros se alinean abajo.
- Una primera versión reservaba siempre dos líneas de título. Así todas las tarjetas medían igual, pero quedaba un hueco bajo cada título corto. El equipo lo señaló, y se cambió a igualar por fila: el aire solo aparece cuando una vecina tiene dos líneas.
- Entre filas, la diferencia máxima es una línea de título (26,4 px).
- En una columna (móvil), cada tarjeta mide según su título.
- Resuelve el hallazgo del censo: "las tarjetas de una fila no comparten altura".

**Radar** (ver la sección propia).

**Fila**

- Sin radar: a 56 px el polígono y sus cinco rótulos no se leen.
- La miniatura no es un enlace: el enlace del título se estira sobre toda la fila, así que un toque en cualquier parte abre la ficha. Créditos, país, sello, géneros y compartir quedan por encima.
- Desde 768 px: portada · créditos y título · datos · géneros · compartir.
- En móvil: portada · créditos, título y datos en tres líneas · compartir. Los géneros se ocultan porque no caben sin partir la línea.
- El título va a `--text-sm`, en una línea.

**Grilla**

- Bajo 680 px, una columna de hasta 34rem, centrada. De 680 a 1023, dos columnas. Desde 1024, entre 2 y 3.
- Las cuatro grillas (inicio, artista, sello y colección) tenían cada una su copia. Ahora comparten `.lanzamientos-grilla` en `styles.css`.
- Cambios visibles:
  - **Artista y sello:** el hueco pasa de 24 a 18,4 px, el del inicio.
  - **`auto-fill` en lugar de `auto-fit`:** con una o dos tarjetas, cada una mide un tercio y no se estira. Antes llegaba a 440 px por el `max-width` global de `.card`.
  - **Tablet (834):** antes la segunda columna se salía del viewport. `1fr` tenía un mínimo automático y la página medía 912 px de ancho (`home-full-T`). Ahora son `minmax(0, 1fr)`.
- La lista es `.lanzamientos-lista`: filas apiladas con un separador.

**Accesibilidad**

- La portada de la tarjeta repite el enlace del título. Queda con `tabindex="-1"` y `aria-hidden`:
  - con teclado o lector de pantalla se abre desde el título, en un solo paso;
  - desaparece el enlace duplicado "Abrir …" por tarjeta;
  - con VoiceOver en iOS, la activación por doble toque podría llegar como un toque y mostrar el radar sin abrir. Así no puede pasar.
- El radar sigue siendo decorativo (`aria-hidden`), como antes. Su información no llega al lector de pantalla. Queda anotado; no lo pide el plan.
- **Objetivo táctil:** los géneros (Chip `sm`) y compartir (IconButton `sm`) amplían su área a 44.
- País y sello son enlaces de texto dentro de la línea "año · país · sello". Se acogen a la excepción "en línea" de WCAG 2.5.8, igual que los nombres de créditos en U6.
- **Prueba de 44 px de U5:** se excluyen país y sello, y también el título de la tarjeta y de la fila. El objetivo real del título es toda la información o toda la fila; la prueba lo mide como caja de texto.
- **Clic con modificador** (⌘, Ctrl, Mayús, botón central): el navegador lo resuelve, así que se abre en otra pestaña. Antes la tarjeta lo anulaba siempre.

**Compartir**

- El enlace es siempre `https://biblioteca.discotica.com/lanzamiento/{slug}`, igual que en la ficha. Antes la tarjeta copiaba el protocolo de la página actual.

### Radar: comportamiento elegido

| Entrada | Comportamiento |
| --- | --- |
| Cursor (`hover: hover`) | El radar aparece al pasar por la portada (el CSS de siempre, ahora solo bajo `@media (hover: hover)`). Un clic en la portada abre la ficha. |
| Dedo | **Primer toque** en la portada: muestra el radar y no navega. **Segundo toque** en la misma portada: abre la ficha. Un toque en otra portada mueve el radar a esa tarjeta. Un toque en cualquier otro punto lo oculta. |
| Deslizar sobre la portada | La página se desplaza. No hay radar ni ficha, porque el navegador no emite clic tras un gesto. |
| Toque en título, espacio libre o información | Abre la ficha en un solo toque, como siempre. |
| Teclado y lector de pantalla | La portada no es una parada de tabulación. El título abre la ficha. |

Implementación (`PortadaRadar.svelte`):

- `pointerdown` guarda el `pointerType`. El clic que sigue a un `touch` con el radar oculto hace `preventDefault()` y lo muestra.
- Un `pointerdown` en captura fuera de la portada lo oculta. Solo se escucha mientras está visible.
- Un clic sin `pointerdown` (teclado) nunca se trata como toque.
- `:hover` queda bajo `@media (hover: hover)`, para que los móviles no se queden con el hover pegado tras un toque. En un portátil con pantalla táctil, el primer toque emula el hover y el clic aplica la misma regla, así que el resultado coincide.
- `-webkit-touch-callout: none`: mantener el dedo no abre la vista previa del enlace.
- Antes, en táctil, la capa del radar recibía el toque (`pointer: coarse`) y `RadarMini` anulaba el clic. El radar aparecía por el hover pegado, pero la portada nunca abría la ficha. Ahora la capa no recibe eventos.

Se probó con toques reales por CDP a 390 (ver "Pruebas"). No hubo que escalar a Opus 5.5 `high`, la condición del plan.

## Archivos

- **Nuevos**
  - `src/lib/components/LanzamientoFila.svelte`.
  - `src/lib/components/lanzamiento/`:
    - `PortadaRadar.svelte`, `DatosLanzamiento.svelte`, `GenerosLanzamiento.svelte` y `CompartirLanzamiento.svelte`;
    - `lanzamiento.ts`: `summarizeRelease`, enlaces (`releaseHref`, `labelHref`, `artistHref`, `filterHref`, `shareUrl`) e `isModifiedClick`.
  - `tests/browser/u8-tarjeta.spec.ts` (18 casos).
  - Línea base: `lab-u8-D` y `lab-u8-M`.
  - `tests/visual/.ref-pre-u8/darwin/`: referencia temporal del estado de partida, 140 capturas (~17 MB). Se borra al aceptar.
  - `docs/modernizacion/respaldos/LanzamientoCard.pre-u8.svelte.txt`: la tarjeta anterior, para el rollback. No estaba en git.
  - Este documento.
- **Modificados**
  - `LanzamientoCard.svelte`, reescrito (runes).
  - Primitivas:
    - `Chip.svelte`: prop `size` (`sm` para un género enlazado en una sola línea); el enlace recibe `onclick`;
    - `CreditLine.svelte`: el disparador "Varios artistas" ocupa la línea de texto (`--btn-h: auto`), no la caja de 32. El área táctil sigue en 44;
    - `Menu.svelte`: el disparador con `buttonLabel` también lleva la clase `ui-menu__trigger`. U7 solo se la había puesto al del snippet.
  - Estilos:
    - `tokens.css`: bloque "Tarjeta y fila de lanzamiento (U8)";
    - `styles.css`: `.lanzamientos-grilla` y `.lanzamientos-lista`.
  - Usos de la tarjeta, que pasan a `onabrir` y a la grilla compartida: `home/HomeResults.svelte`, `artista/[slug]`, `sello/[slug]` y `coleccion/[slug]`. En la colección, `.item-card` se estira con su fila.
  - `/lab`: sección "Tarjeta y fila" (`.lab__u8`), Chip `sm` y `RELEASE_SAMPLES` en `samples.ts`.
  - Pruebas:
    - `catalogo.spec.ts`: la portada rota se mira en `.ui-cover__fallback`; la coma, en `.ui-credit-line__names`; el título, a 2 líneas; el menú del Compilado, en el portal; y "Colaborador" en singular cuando hay uno (es la etiqueta de U6);
    - `r1-ficha-reproductor.spec.ts`: el menú de "Varios artistas" se busca en el portal;
    - `tarjeta-clic-y-latencia.spec.ts`: `.card__info`;
    - `u5-lab.spec.ts`: excepciones de 44 px (ver "Accesibilidad");
    - `tests/visual/censo.spec.ts`: `card-hover-D` pasa el cursor por `.portada`, `card-varios-open-D` abre `.ui-menu__trigger`, y se añaden `lab-u8-D/M`;
    - `tests/visual/playwright.config.ts` y `README.md`: `VISUAL_BASELINE_DIR`.
- **Sin tocar:** la ficha (`ReleaseDetail`, `LanzamientoModal`, `LanzamientoVista`), `RadarMini`, datos y el selector del inicio.
- **Sin uso desde U8:** `CreditSummary.svelte`. No se borró: no está en git y se perdería. Se puede borrar al aceptar.

## API para U9, U10 y U14

### LanzamientoCard y LanzamientoFila

| Prop | Tipo | |
| --- | --- | --- |
| `lanzamiento` | `Release` | |
| `onabrir` | `(lanzamiento: Release) => void` | Abre la ficha en el modal. Sin él, título y portada navegan a `/lanzamiento/{slug}` con la búsqueda actual (sin invitación beta). |
| `class` | `string` | |

- Sustituye a `openInModal` + `on:abrir`. Desde un componente legado: `onabrir={(release) => dispatch('abrir', release)}`, como `HomeResults`.
- La tarjeta es `article.card.card--grid`, una clase que conservan las pruebas. La fila es `article.fila`.
- Contenedores globales:

```svelte
<div class="lanzamientos-grilla">{#each releases as r}<LanzamientoCard lanzamiento={r} {onabrir} />{/each}</div>
<div class="lanzamientos-lista">{#each releases as r}<LanzamientoFila lanzamiento={r} {onabrir} />{/each}</div>
```

### Piezas (`$lib/components/lanzamiento/`)

| Pieza | Props | |
| --- | --- | --- |
| `PortadaRadar` | `href`, `cover`, `radar`, `onopen?`, `ambient?` | Portada con radar, cursor y doble toque. `data-radar="visible"` mientras lo muestra un toque. |
| `DatosLanzamiento` | `year`, `country`, `label`, `search` | "Año · país · sello" en una línea. Sin datos, conserva la línea vacía. |
| `GenerosLanzamiento` | `genres`, `more?`, `search` | Chips `sm` en una línea y "+N" con el resto en la ayuda y para lectores. |
| `CompartirLanzamiento` | `slug` | IconButton que copia `shareUrl(slug)`. |
| `lanzamiento.ts` | `summarizeRelease(release)` | `{ slug, title, cover, year, country, label, genres, moreGenres, radar }`. Lee el contrato canónico y cae a los campos legados. |

### Tokens nuevos (`tokens.css`, bloque "Tarjeta y fila de lanzamiento (U8)")

| Token | Valor | Uso |
| --- | --- | --- |
| `--card-min-w` | 20rem | Ancho mínimo de columna desde 1024 |
| `--card-single-max-w` | 34rem | Tarjeta en una columna (móvil) |
| `--card-grid-gap` | 1.15rem | Hueco de la grilla (el del inicio) |
| `--card-grid-max-cols` | 3 | Máximo de columnas |
| `--card-pad` | `--space-4` | Relleno de la información |
| `--card-title-lines` | 2 | Líneas máximas del título |
| `--row-cover` | 56px | Miniatura de la fila |

## Para U9, U10 y siguientes

- **U9 (ficha). Feedback del equipo del 2026-10-07, para resolver ahí:**
  1. **"y N más" en la ficha no se despliega.** Hoy la ficha resume a los colaboradores igual que la tarjeta y se queda ahí. El plan pide en la ficha todos los artistas por rol: `CreditLine variant="roles"`, sin "y N más".
  2. **En la ficha, los créditos se leen en mayúsculas sostenidas**, mientras que la tarjeta usa caja normal separada por comas. El equipo dice que así cuesta leerlos. Los nombres deben ir en caja normal, como en la tarjeta.
     - `CreditLine` ya los pinta así; solo la etiqueta del rol ("Artistas principales") va en mayúsculas pequeñas.
     - Confirmar con el equipo si la etiqueta también debe pasar a caja normal.
  - La aceptación de U8 ("la misma CreditLine en tarjeta, fila y ficha") se cumple del todo cuando U9 adopte `CreditLine` en la ficha. Hoy la tarjeta y la fila ya la usan.
  - El menú "Varios artistas" de la tarjeta va al portal de la página. Dentro del modal actual, que no tiene capa propia, se resuelve como dice el relevo de U6.
- **U10 (inicio):**
  - conectar `ViewToggle` (`context="inicio"`) para alternar entre `.lanzamientos-grilla` con `LanzamientoCard` y `.lanzamientos-lista` con `LanzamientoFila`;
  - el separador "Resultados aproximados" (`.resultados__grupo`) funciona en las dos;
  - `.resultados__grid` sigue siendo el ancla de foco y de scroll del inicio.
- **U11 (artista y sello):** ya usan la grilla compartida.
- **U14 (colección):**
  - la misma alternancia, con `Sortable` según el modo;
  - `.item-card` envuelve la tarjeta con la nota y el "✕", que se reharán allí.
- **Global:** `styles.css` conserva `.card { max-width: 440px }` y `.card:hover { transform: translateY(-2px) }` (E04). Siguen aplicándose a la tarjeta. Si U10 quiere quitar el desplazamiento al pasar, va ahí.
- **Pendiente heredado:** la pasada con VoiceOver de U6, si `/lab` debe existir solo en desarrollo y centralizar `<title>`.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **106/106** |
| `npm run lint:tokens` | OK: 136 archivos, 2 excepciones temporales (las de U4; ninguna nueva) |
| `npm run build` | OK |
| `svelte-check` | Sin errores nuevos en los archivos de U8. Los que quedan son previos: `$types` sin generar, `any` implícitos en artista, sello y colección, y `Buffer`/`process` en las pruebas. |
| `tests/browser/u8-tarjeta.spec.ts` | **18/18**; con `--repeat-each=3`, **54/54** |
| Pruebas de tarjeta afectadas (`catalogo`, `r1`, `tarjeta-clic`, `u5-lab`, `u6-lab`) | En verde |
| `npm run test:browser` | **174 pasan**, 5 omitidas y 2 fallan, las dos ya registradas: E17:198 (persistente desde U1) y E14 "en móvil se oculta…" (`catalogo.spec.ts:449`, intermitente; aislada pasó 9 de 10). Falla en el paso "el header se congela con un campo enfocado", que no tiene relación con la tarjeta. |

Qué cubre `u8-tarjeta.spec.ts`:

- **`/lab` a 1440 y 390:**
  - tarjetas de una fila de la grilla con el mismo alto;
  - entre filas, como mucho una línea de título de diferencia;
  - créditos, datos y géneros con el mismo alto en todas;
  - título de dos líneas como máximo;
  - filas de la lista con el mismo alto;
  - sin desborde horizontal.
- **Créditos, en tarjeta y en fila:**
  - Compilado: "Varios artistas" abre los créditos por rol;
  - varios principales de nombres largos: todos enlazados y la línea truncada sin partirse;
  - principal con colaboradores: "y 4 más" entero y los colaboradores no enlazados.
- **Título largo:** recortado a dos líneas, completo en `title`.
- **Fila:** géneros ocultos solo en móvil. Un clic en la información de la tarjeta o en la miniatura de la fila abre la ficha.
- **Grilla del inicio:** 3 columnas a 1920 y 1440, 2 a 1024, 834 y 680, y 1 a 390.
- **Cursor (1440):** el radar aparece al pasar y un clic en la portada abre la ficha. Con teclado, la portada no es una parada de tabulación y el título abre la ficha con Intro.
- **Compartir:** copia `https://biblioteca.discotica.com/lanzamiento/…`, muestra "Enlace copiado", lo anuncia y no abre la ficha.
- **Táctil a 390, con toques reales por CDP:**
  - el primer toque muestra el radar sin abrir ni cambiar la URL, y el segundo abre la ficha;
  - tocar otra portada mueve el radar, y tocar fuera lo oculta sin abrir nada;
  - deslizar sobre la portada desplaza la página, sin radar ni ficha;
  - un toque en el título abre la ficha directamente;
  - géneros y compartir tienen objetivo de 44.

No se ejecutó en Firefox ni WebKit: los binarios no están instalados, igual que en U6 y U7. **Queda pendiente probar el doble toque en un iPhone real (Safari).** CDP reproduce los eventos táctiles de Chromium, no los de WebKit.

## Suite visual

### `VISUAL_BASELINE_DIR`

`tests/visual/playwright.config.ts` acepta una carpeta de referencia distinta de `baseline` (bajo `tests/visual/`). Por defecto no cambia nada. Sirve para aislar una etapa cuando la anterior aún no está aceptada:

```sh
VISUAL_BASELINE_DIR=.ref-pre-u8 npm run visual:capture   # estado de partida
VISUAL_BASELINE_DIR=.ref-pre-u8 npm run visual:compare   # solo lo que cambió la etapa
```

### Capturas que cambiaron

Contra la referencia de partida (`.ref-pre-u8`, es decir, solo U8): **142 capturas**, 77 iguales, 63 distintas y 2 nuevas, todas dentro del alcance. La causa de cada una sale de la zona del diff.

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Tarjeta | `card-grid-D`, `card-collab-D`, `card-two-D`, `card-hover-D` (517 → 516 de alto) | Título a 24 px, compartir como icono, géneros en Chip `sm`, `Cover ambient`. Con hover, el radar igual que antes. |
| Créditos del Compilado | `card-varios-open-D` | El menú va al portal y "Varios artistas" ocupa la línea de texto |
| Filas de la grilla | `card-row-D/M/T` | Tarjeta nueva y celdas que se estiran por fila |
| Inicio | `home-D/M/T`, `home-full-D/M/T`, `home-page2-D`, `home-approx-D`, `home-filtered-D/M`, `home-filtered-panel-D`, `home-radar-D`, `home-radar-results-D`, `home-search-D`, `home-search-pais-D`, `home-search-tipo-D`, `home-scrolled-M` | Tarjeta y grilla. `home-full-T` pasa de 912 a 834 px de ancho: se corrigió el desborde de la segunda columna en tablet. |
| Artista, sello y colección | `artista-D/M`, `sello-D/M`, `crate-D/M` | Tarjeta y grilla compartida (hueco de 24 a 18,4 px; `auto-fill`) |
| Tarjetas detrás de una capa | `modal-D`, `modal-T`, `modal-bottom-D`, `modal-crate-D`, `modal-longtitle-D`, `modal-nocover-D`, `modal-radar-D`, `modal-review-D`, `modal-soundcloud-D`, `modal-spotify-D`, `modal-varios-D`, `debug-modal-overlap`, `header-menu-D/M`, `header-auth-menu-M`, `header-account-menu-D`, `home-beta-D/M`, `home-welcome-D/M`, `home-search-suggest-D` | Solo cambia la franja de tarjetas visible tras el velo. En `modal-T` el panel de la ficha tiene 0 píxeles distintos. |
| Subpíxel | `footer-D` (185 → 184), `footer-M`, `home-pagination-D`, `lab-u7-D/M`, `modal-1100-D` (5 px), `modal-tablet-landscape-T` (390 px) | Sin cambio visible: la página cambia de alto en fracciones de píxel y el texto se rasteriza distinto |
| `/lab` | `lab-D`, `lab-M` | Sección U8 y Chip `sm` |
| `/lab` U6 | `lab-u6-D/M` (−15 px CSS en móvil) | La tarjeta "Compilado" de CreditLine: "Varios artistas" ya no ocupa la caja de 32. El resto es subpíxel. |

**Nuevas** (capturadas con `-g " lab-u8-(D|M)$"`, anclado, sin tocar otras líneas base): `lab-u8-D` y `lab-u8-M`.

Contra la línea base oficial (`npm run visual:compare`, que compara con U6 aceptada y por eso suma U7 y U8): **142 capturas**, 9 iguales, 133 distintas y 0 errores.

## Línea base

- `baseline/darwin/` tiene la línea base aceptada de U6, las 5 capturas nuevas de U7 y las 2 de U8: 142 archivos.
- Las demás **no** se recapturaron, para que la revisión humana vea las diferencias de U7 y U8 con `npm run visual:compare`. Las de U8 solas se ven con `VISUAL_BASELINE_DIR=.ref-pre-u8 npm run visual:compare`.
- **Aceptación (2026-10-07):** hecho todo lo siguiente salvo borrar `.ref-pre-u4`, que se conserva hasta que el equipo diga.
  1. aceptar U7 antes o a la vez;
  2. `npm run visual:capture` con el equipo sin carga y comprobar 0 diferencias;
  3. borrar `tests/visual/.ref-pre-u8/` y, si ya no hace falta, `tests/visual/.ref-pre-u4/`;
  4. borrar `CreditSummary.svelte`.

## Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| La misma CreditLine en tarjeta, fila y ficha | **Parcial:** tarjeta y fila, sí. La ficha la adopta en U9 (fuera de alcance aquí: "no toques la ficha"). |
| Créditos: compilado, varios principales de nombres largos, principal con colaboradores | Cumplido (prueba automatizada, en tarjeta y en fila) |
| Táctil a 390 | Cumplido en Chromium con toques reales. Falta un iPhone real. |
| Altura estable | Cumplido por fila de la grilla (ver "Altura estable") |
| Nunca más de 3 columnas | Cumplido (prueba de 390 a 1920) |
| Solo tokens y primitivas | Cumplido: Chip, IconButton, Cover, CreditLine y Menu, sin literales nuevos |
| Suite visual | Todas las diferencias dentro del alcance (tabla de arriba) |

## Rollback

Sin datos ni migraciones.

1. Restaurar `src/lib/components/LanzamientoCard.svelte` desde `docs/modernizacion/respaldos/LanzamientoCard.pre-u8.svelte.txt`.
2. Borrar:
   - `LanzamientoFila.svelte` y `src/lib/components/lanzamiento/`;
   - `tests/browser/u8-tarjeta.spec.ts`;
   - `lab-u8-*.png` y su línea en `censo.spec.ts`;
   - este documento.
   - `.ref-pre-u8` y `CreditSummary.svelte` ya se borraron al aceptar. **Ojo:** el respaldo de la tarjeta importa `CreditSummary`. Al restaurarlo, sustituye ese import y su uso por `CreditLine`.
3. En los usos de la tarjeta, volver a `openInModal={true} on:abrir={…}` y a cada grilla local: `HomeResults`, artista, sello y colección.
   - La regla del inicio estaba en `HomeResults.svelte`: `auto-fit, minmax(320px, 1fr)`, hueco 1.15rem, `1fr 1fr` desde 680 y una columna de 34rem bajo 680.
   - Artista y sello: `auto-fit, minmax(320px, 1fr)` con hueco `--spacing-md`.
   - Colección: `.items-grid` igual que el inicio, sin las reglas de 680.
4. Quitar el bloque U8 de `tokens.css` y `.lanzamientos-grilla` y `.lanzamientos-lista` de `styles.css`.
5. Primitivas:
   - `Chip`: quitar `size` y el `onclick` del enlace;
   - `CreditLine`: quitar la regla de `.ui-menu__trigger`;
   - `Menu`: quitar `class` del disparador con `buttonLabel`.
6. `/lab`: quitar `.lab__u8`, la fila de Chip `sm`, los imports y `RELEASE_SAMPLES`.
7. Revertir los ajustes de pruebas listados en "Archivos". `VISUAL_BASELINE_DIR` puede quedarse: no cambia nada por defecto.
