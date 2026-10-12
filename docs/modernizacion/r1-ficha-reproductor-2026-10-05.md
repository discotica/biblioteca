# Expediente R1 — Ficha y reproductor: errores

Fecha: 2026-10-05 (America/Bogota)
Etapa: R1 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#r1--ficha-y-reproductor-errores)
Modelo: Claude Opus 5.5, esfuerzo `high`. No hizo falta escalar.
Estado: **completa en local; pendiente de revisión humana**. Sin cambios de datos, esquema, producción, textos, acciones ni tokens. Sin commit ni push.

Entrada: no existe un documento de relevo de U1 en `docs/`. Se usaron como relevo [`tests/visual/README.md`](../../tests/visual/README.md) y la línea base de `npm run test:browser` registrada al cierre de U1. Antes de editar, `npm run visual:compare` dio 131 de 131 capturas iguales.

## Causa raíz y corrección

| # | Error | Causa raíz | Corrección |
| --- | --- | --- | --- |
| 1 | Reproductor aplastado en desktop | `.release-detail__info` es flex en columna con alto fijo en el modal. Sus hijos tienen `flex-shrink: 1`. `.release-player` tiene `overflow: hidden`, así que su mínimo automático es 0. El marco quedaba en 15–58 px y acciones y recomendaciones se dibujaban encima del iframe. El scroll interno nunca se activaba. | `.release-detail__info > :global(*) { flex-shrink: 0 }`. Es `:global` porque la raíz de `ReleasePlayer` es de otro componente. Alturas: Bandcamp 380, SoundCloud 300, Spotify 352. |
| 2 | Elegir una pista mueve el scroll | Lo causaba la propia guarda de scroll de E16 en `ReleasePlayer`, no el proveedor. La guarda escuchaba `scroll` en `document.scrollingElement`, pero el scroll del documento se emite en `document`. Su "última posición estable" quedaba en el valor del montaje (0). Al entrar el foco al iframe (blur de la ventana), la guarda restauraba esa posición y la página saltaba arriba. Con ratón, `pointerenter` tomaba antes una instantánea correcta y ocultaba el error. Con toque (móvil) y con foco por teclado no hay `pointerenter`. Además, el elemento que desplaza se fijaba una sola vez al montar. En el modal desktop, como la columna no desbordaba por el error 1, resolvía al documento. | Un solo listener `scroll` en captura sobre `document`, filtrado al ancestro que desplaza el reproductor. El elemento que desplaza se resuelve en cada interacción y cuando empieza a desplazar otro ancestro. La guarda, sus tiempos y su liberación al salir del reproductor no cambian. |
| 3 | Menú de "Añadir a crate" cortado contra el borde del modal | Dos causas. (a) El menú se posicionaba una sola vez, con el ancho del estado vacío. Los crates llegan después de abrir, el menú crecía hacia la derecha y no se recolocaba. (b) El diálogo (`.release-modal`) tenía `overflow: hidden` y recortaba la capa de menús de la ficha. | Nuevo contrato `anchoredLayer` en [`src/lib/ui/overlay.ts`](../../src/lib/ui/overlay.ts), que reemplaza el posicionamiento local de `AddToCrateButton`. Mide el ancho intrínseco, abre abajo o arriba según el espacio del viewport y limita el alto con scroll propio si no cabe. Se recoloca cuando cambia su tamaño, al redimensionar y con cualquier scroll. Se combina con `dropdownMenu` (foco, Escape, cierre exterior). El diálogo deja de recortar y `.release-detail__layout` recorta sus propias esquinas (`border-radius: inherit`). La capa de menús queda fuera de toda caja que recorte, pero dentro del diálogo. |
| 4 | Menú "Varios artistas" de la tarjeta tapado por la grilla | La tarjeta ya se elevaba con `.card--menu-open`, pero esa clase dependía de `showArtistsMenu`, el estado del menú antiguo de la tarjeta. Desde E05 el menú vive en `CreditSummary` con su propio `open`, así que la tarjeta nunca se elevaba. | `CreditSummary` expone `open` (bindable) y la tarjeta lo usa en `class:card--menu-open`. |

Sobre el punto 3: el menú no se lleva a `document.body`. El diálogo es `aria-modal` y oculta el resto del documento. Un menú fuera del diálogo quedaría fuera del árbol accesible y su foco sería devuelto por la trampa de `dialogOverlay`. La prueba E16 que exige el menú dentro del diálogo sigue vigente.

## Archivos modificados

- `src/lib/components/ReleaseDetail.svelte`: `flex-shrink: 0` en los hijos de la columna; recorte del layout del modal con `border-radius: inherit`.
- `src/lib/components/ReleasePlayer.svelte`: resolución del elemento que desplaza y listener de scroll en captura.
- `src/lib/components/LanzamientoModal.svelte`: el diálogo pasa a `overflow: visible`.
- `src/lib/ui/overlay.ts`: nuevo `anchoredLayer` y su tipo `AnchoredLayerOptions`.
- `src/lib/components/AddToCrateButton.svelte`: usa `anchoredLayer` y se elimina `portalDropdown`.
- `src/lib/components/CreditSummary.svelte`: `open` exportado.
- `src/lib/components/LanzamientoCard.svelte`: `bind:open` y elevación de la tarjeta.
- `tests/browser/r1-ficha-reproductor.spec.ts`: nuevo.

## Pruebas

`tests/browser/r1-ficha-reproductor.spec.ts` tiene 18 pruebas, a 1440 (ratón) y a 390 (toque):

- **R1.1:** alto del marco y del iframe por proveedor en modal y página, sin nada dibujado encima. En 1440, la columna del modal desplaza.
- **R1.2:** la tercera pista se elige con un clic o toque real en sus coordenadas, en los tres proveedores y en modal y página. El scroll queda a ≤ 4 px. Los proveedores se sustituyen por un documento de origen cruzado con lista de pistas.
- **R1.3:** los crates llegan 250 ms después de abrir el menú, con un nombre largo. Se verifica que el menú está en la capa de la ficha, sin ancestros que recorten, dentro del diálogo en horizontal y del viewport en vertical, y pintado encima en el borde derecho de cada opción.
- **R1.4:** el compilado de la tarjeta, con 8 artistas, abre un menú que invade la fila siguiente y sigue pintado encima.

| Comando | Resultado |
| --- | --- |
| R1 sobre el código corregido | 18/18 PASS |
| R1 sobre el código original (reversión temporal) | 11 fallan y 7 pasan. Fallan R1.1 a 1440, R1.2 en modal a 1440 y en página a 390, y R1.3 y R1.4 en ambos anchos. Cada error queda cubierto por al menos una prueba que lo detecta. |
| `npm run test:browser`, dos corridas | 97 y 98 PASS, 5 omitidas. Solo fallan E17:198 (persistente, previo a R1) y E14 `catalogo.spec.ts:408` (intermitente, 1 de 2). Coincide con la línea base de U1. Todas las E16 en verde. |
| E17:178 (Back/Forward) | Falló una vez en paralelo junto a R1 y E16; aislada, 5/5 PASS. R1 no toca historial. |
| `npm test` | 52/52 PASS |
| `npm run build` | PASS |
| `svelte-check` sobre los archivos tocados | Sin errores nuevos. Los de `overlay.ts:118` y `:227` son previos. `Buffer` en la spec es el mismo patrón que E16 (sin `@types/node`). |
| Matriz de ficha a 680, 681, 834 y 1112, en modal y página, con los tres proveedores (spec temporal, ya borrada) | Alturas exactas, acciones bajo el reproductor y sin scroll horizontal |

**Reproducción con proveedores reales.** Se usó un script exploratorio fuera del repositorio: catálogo simulado, iframes reales y clic o toque en la tercera pista, con eventos `scroll` y escrituras a `scrollTop` instrumentados.

- Antes, a 390 en página, en los tres proveedores: `window-blur`, luego `set html.scrollTop = 0`, luego scroll del documento a 0. El salto de 500 a 0 lo escribía la guarda, sin ningún scroll nativo.
- Antes, en el modal a 1440, el reproductor medía 15 px y el clic caía sobre las recomendaciones.
- Después: 0 px de desplazamiento en los 12 casos (3 proveedores × modal/página × 1440/390). Bandcamp (`currenttrack`) y Spotify (`isCurrentTrack`, "Pause track") confirman el cambio a la tercera pista.

## Capturas que cambiaron

`npm run visual:compare` tras editar: 14 diferentes y 117 iguales. Todas están dentro del alcance.

| Capturas | Motivo |
| --- | --- |
| `modal-D`, `modal-1100-D`, `modal-bottom-D`, `modal-radar-D`, `modal-review-D`, `modal-varios-D`, `modal-soundcloud-D`, `modal-spotify-D`, `modal-T`, `modal-tablet-landscape-T`, `debug-modal-overlap` | El reproductor recupera su alto (punto 1). Acciones y recomendaciones pasan debajo, dentro del scroll interno de la columna. |
| `modal-crate-D` | El menú de crates se muestra completo; sin espacio debajo, abre hacia arriba (punto 3). |
| `card-varios-open-D` | El menú "Varios artistas" queda sobre la fila siguiente (punto 4). |
| `modal-nocover-D` | 1 píxel junto al anillo de foco del botón cerrar, que el diálogo ya no recorta. |

Sin cambios: `ficha-D`, `ficha-M`, `ficha-comp-D`, `modal-M`, `modal-mid-M`, `modal-bottom-M` y todas las vistas fuera de la ficha.

La línea base **no se reescribió**. Es un archivo sin versionar y la etapa espera revisión humana. Al aceptarla hay que ejecutar `npm run visual:capture`. Si no, U4 y U9 arrancarán con estas 14 diferencias.

## Límites conocidos por proveedor

- **Frontera de origen cruzado.** No se lee nada dentro de los iframes. La guarda actúa desde el contenedor: posición estable del ancestro que desplaza, foco o blur de la ventana y `pointerenter`/`pointerleave`.
- **Bandcamp:** al elegir pista recibe el foco y marca `currenttrack`. No se observó scroll nativo del padre en Chromium.
- **SoundCloud:** recibe el foco, pero su DOM no marca la pista actual. Solo se confirma que el toque llegó al iframe, no el cambio de pista. Se conserva el supuesto de E16 de que puede mover el contenedor antes de que el blur sea observable; por eso la guarda restaura desde la última posición estable y no desde la del blur.
- **Spotify:** al elegir pista recibe el foco y reproduce (`isCurrentTrack`). Solo genera reproductor para enlaces de álbum; los de pista siguen sin reproductor (decisión previa, fuera de R1).
- **Navegadores:** solo se verificó en Chromium (desktop y emulación móvil con toque). WebKit no está instalado en este entorno, así que iOS Safari y Safari de escritorio quedan sin verificar. E21/U18 deben repetir la tercera pista en dispositivos reales.
- **Guarda temporal:** la guarda corrige durante 1,6 s tras entrar al reproductor y mientras el puntero sigue dentro. Un desplazamiento del proveedor más tardío, con el puntero fuera, no se corregiría. No se observó.

## Relevo a U4 y U9

- **U9 (rediseño de la ficha):**
  - Conservar `flex-shrink: 0` (o equivalente) en la columna con scroll interno.
  - El modal no debe volver a recortar con `overflow` en el diálogo; el recorte va en el layout interno.
  - La capa `[data-release-menu-layer]` debe seguir fuera de toda caja con `overflow` distinto de `visible` y dentro del diálogo.
  - La barra de acciones fija en móvil tendrá que convivir con `anchoredLayer`, que hoy limita al viewport.
- **U4/U5/U6:**
  - `anchoredLayer` es geometría reutilizable para la primitiva de menú (U6).
  - Hoy usa un `gutter` de 8 px literal por defecto; al existir tokens de espaciado, debe leerse de ellos.
  - `.card--menu-open` usa `z-index: 10` literal (previo a R1); pasarlo a la escala `--layer-*` en U4/U8.
- **Pruebas:** `r1-ficha-reproductor.spec.ts` usa los textos actuales ("Añadir a crate"). U3 debe actualizarlos al renombrar a "colección".

## Rollback

Revertir los siete archivos de código listados y borrar la spec. No hay datos, migraciones ni variables.
