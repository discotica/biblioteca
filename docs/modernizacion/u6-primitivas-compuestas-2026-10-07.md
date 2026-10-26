# U6 — Primitivas compuestas (2026-10-07)

Etapa U6 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). Corrió en Claude Opus 5.5 con esfuerzo `high`, como asigna el plan. No hizo falta subir a `xhigh`: el arrastre táctil no choca con el scroll ni con el gesto de la hoja (ver "Táctil"). No se hizo commit ni push, y no se tocaron datos, despliegue ni producción. No se migró ninguna vista.

Estado: **aceptada el 2026-10-07.** La línea base visual se recapturó sobre U6: 135 capturas y 0 diferencias después. Sigue pendiente la pasada humana con VoiceOver (ver "VoiceOver"); el equipo aceptó la etapa sin ella.

## Condición de arranque

- U5 está aceptada (2026-10-07, [`decisiones.md`](./decisiones.md), ronda 3).
- `npm run visual:compare` antes de editar: 133 capturas y **0 diferencias**.
- El árbol viene de U5, sin commits desde `0ab31e0`.
- **Contrato de redes de D1:** existe y está implementado en local, pero no se ha aplicado en staging. SocialLinks consume `socialLinks()` de `src/lib/domain/profileSocial.ts`, que es puro y no lee datos. `/lab` usa un perfil de ejemplo.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Combobox con chips | `Combobox`: búsqueda sin tildes ni mayúsculas, con sinónimos (`keywords`); chips que se quitan con teclado; "Añadir «texto»" solo con `allowCreate`. Patrón ARIA 1.2 con `aria-activedescendant`. La lista va al portal. |
| 2. Menu "…" en portal | `Menu`: IconButton "…" o disparador con texto; grupos con encabezado; destructivo, deshabilitado y enlace. Teclado APG completo. Va al portal del overlay o de la página, así que no lo corta ningún contenedor. |
| 3. Dialog y Sheet | `Dialog` (sm, md y lg) con cuerpo de scroll interno y pie fijo. `Sheet` con altura según contenido, cabecera opcional fija, pie fijo con la acción primaria, cierre deslizando la cabecera y apoyo en el viewport visual (teclado virtual). Los dos usan `dialogOverlay` y `sheetOverlay` y llevan su propia capa de portal. |
| 4. Sortable | `Sortable`: arrastre con ratón y dedo desde el asa, lista o grilla, auto-scroll en los bordes y Escape para cancelar. Teclado con ↑ ↓ ← → Inicio Fin sobre el asa y botones "Subir" y "Bajar" opcionales. Anuncio para lectores de pantalla en cada cambio. |
| 5. Cover | `Cover`: siempre cuadrada (`object-fit: cover`). Sin portada o rota, el logo atenuado con el nombre accesible del `alt`. Fondo ambiental desenfocado opcional. |
| 6. CreditLine | `CreditLine`: variante `line`, con la regla de R2 (`summarizeReleaseCredits`), nombres truncados y "y N más" que nunca se encoge; en un Compilado, "Varios artistas" abre un Menu con los créditos por rol. Variante `roles` para la ficha, con todos los artistas por rol y sin truncar. |
| 7. SocialLinks | `SocialLinks`: las cinco redes como IconButton enlace, en el orden de D1 y con su nombre accesible. Puede abrir en otra pestaña y lo anuncia. |
| 8. `/lab` | Siete secciones nuevas, dentro de `.lab__u6`, con todos los estados: el diálogo y la hoja con menú, combobox y ordenable dentro, una tabla con overflow que simula el Estudio, y portadas 1:1, 16:9, 5:8, vacía y rota. |

### Decisiones de diseño y accesibilidad

Ninguna cambia una decisión de producto. Se registran para que U7 en adelante no las vuelva a inferir.

**Portal**

- `layerFor(trigger)`, en `overlay.ts`, elige dónde se monta un menú o una lista:
  - si el disparador está dentro de un modal (`aria-modal="true"`), en la capa de ese modal (`> [data-ui-layer]`). El popup queda dentro del diálogo, así que el foco atrapado y el `inert` del resto siguen funcionando, pero fuera del panel que hace scroll o recorta;
  - si no, en una capa fija de página que se crea al usarla por primera vez, al final de `<body>`, con `--layer-dropdown`.
- Dialog y Sheet ponen `role="dialog"` en una raíz fija a pantalla completa. Esa raíz contiene el fondo, el panel y la capa. El panel puede tener `overflow` y `transform` (el gesto de la hoja) sin recortar la capa.
- Un modal antiguo sin capa propia (hoy `LanzamientoModal`) recibe el popup en el propio nodo del modal: el foco funciona, pero puede recortarse. Se resuelve en U9 al pasar la ficha a Dialog o al añadirle `data-ui-layer`.

**Combobox**

- El foco se queda en el campo. La opción activa se comunica con `aria-activedescendant`, y al escribir la primera coincidencia queda activa (autocompletado de lista). Intro alterna la opción activa: la añade o la quita.
- Los chips no son paradas de tabulación (`tabindex="-1"`). Se llega a ellos desde el campo vacío con Retroceso o ←. Entre ellos se mueve con ← →. Retroceso quita el chip y lleva el foco al anterior; Supr, al siguiente; Intro o Espacio también lo quitan. → desde el último y Escape vuelven al campo. Las instrucciones están en `aria-describedby`.
- Escape cierra primero la lista y después borra el texto. Dentro de un diálogo, `overlay.ts` ya no cierra el diálogo con ese primer Escape mientras el combobox esté expandido.
- Una región `aria-live="polite"` anuncia "X añadido. N elegidos.", "X quitado." y el número de resultados medio segundo después de dejar de escribir.
- El texto ocupa la fila de un chip (32 px), pero su área táctil llega a 44 gracias a un margen negativo. La altura del campo no cambia (44).

**Menu**

- Patrón de botón de menú del APG:
  - Intro, Espacio o ↓ abren en el primer elemento; ↑ abre en el último;
  - ↑ ↓ recorren de forma circular; Inicio y Fin van a los extremos; una letra salta al siguiente elemento que empieza por ella;
  - Escape cierra;
  - **Tab cierra y devuelve el foco al "…"** (opción nueva `tabCloses` de `dropdownMenu`). No salta al elemento siguiente.
- Los elementos deshabilitados se recorren y se leen, pero no se activan (`aria-disabled`).
- Una acción se ejecuta después de cerrar el menú y de devolver el foco. Si abre un diálogo, al cerrarlo el foco vuelve al "…".
- La ayuda del IconButton se oculta mientras su menú está abierto (`aria-expanded="true"`). Es una extensión de U5.

**Dialog y Sheet**

- El cuerpo del diálogo solo entra en el orden de tabulación cuando desborda (`tabindex="0"`, `role="region"`), para poder desplazarlo con teclado sin nada enfocable. Las líneas de cabecera y pie solo aparecen en ese caso.
- La hoja conserva los umbrales del gesto de E15 (72 px, o 24 px con 0,5 px/ms). El gesto empieza solo en la cabecera y el asa (`touch-action: pan-x`). El cuerpo hace scroll con `overscroll-behavior: contain`.
- Con `prefers-reduced-motion` no hay animación de entrada ni transición.

**Sortable**

- Solo el asa inicia el arrastre y solo ella tiene `touch-action: none`. Deslizar el resto de la fila desplaza la página o la hoja con normalidad, sin pulsación larga.
- El asa es un IconButton sm ("Reordenar: {nombre}") con ayuda emergente y `aria-describedby` con las instrucciones.
- El anuncio es `aria-live="assertive"`:
  - "Arrastrando «X», posición N de M.";
  - "«X» movido a la posición N de M.";
  - "«X» ya está en la primera/última posición.";
  - "Reordenación cancelada…".
- El foco sigue al elemento movido: al asa, o al mismo botón "Subir" o "Bajar" si no quedó deshabilitado.
- `layout="grid"` supone casillas iguales y `layout="list"` admite filas de cualquier alto. La geometría está en `sortable.ts` y tiene prueba.
- Al soltar, las transiciones se apagan durante un cuadro para que el reordenamiento del DOM no haga saltar nada.

**Cover**

- El fondo ambiental (`ambient`) ocupa el ancestro posicionado más cercano con `z-index: -1`. El anfitrión debe tener `position: relative`, `isolation: isolate` y `overflow: hidden`, como ya hace la tarjeta.
- Si cambia `src`, se vuelve a intentar cargar la imagen.

**CreditLine**

- Los nombres enlazados se acogen a la **excepción "en línea" de WCAG 2.5.8**: son texto dentro de una línea. Por eso la prueba de 44 px de U5 los excluye (`.ui-credit-line__names a`, `.ui-credits a`). El disparador "Varios artistas" sí mide 44 (Button sm con área ampliada).
- Un crédito sin slug no se enlaza: en el menú del Compilado aparece deshabilitado y se puede leer.

**`/lab`**

- Un texto `sr-only` (absoluto) dentro de un contenedor con scroll escapa del recorte si ese contenedor no está posicionado. Con `isMobile`, eso ensanchaba el viewport de diseño de `/lab` a 485 px.
- Se corrigió con `position: relative` en el contenedor. **La tabla del Estudio (U15) debe hacer lo mismo.**

### Tokens nuevos (`tokens.css`, bloque "Primitivas compuestas (U6)")

| Token | Valor | Uso |
| --- | --- | --- |
| `--dialog-w-sm/md/lg` | 28 · 40 · 60rem | Ancho del diálogo |
| `--dialog-gutter` | `--space-4` | Margen al viewport; el alto máximo es `100dvh − 2×` |
| `--sheet-max-h` | 88dvh | Alto máximo de la hoja (el de E15) |
| `--sheet-max-w` | 40rem | Ancho de la hoja en pantallas anchas |
| `--sheet-top-gap` | `--space-3` | Separación mínima con el borde superior del viewport visual |
| `--sheet-handle-w/h` | 42 · 4 px | Asa |
| `--menu-min-w` / `--menu-max-w` | 12 · 20rem | Menú |
| `--listbox-max-h` | 18rem | Lista del combobox |
| `--popover-gutter` | `--space-2` | Reservado para popups (hoy `anchoredLayer` usa su `gutter`) |
| `--sortable-edge` | `--space-7` | Distancia al borde que activa el auto-scroll |
| `--cover-ambient-opacity/blur/saturate` | 0.14 · 55px · 1.3 | Los valores de la tarjeta (E04) |
| `--cover-fallback-opacity` | 0.2 | Logo atenuado (R2) |

Icono nuevo: `arrastrar`, dos columnas de tres puntos.

### Cambios en `overlay.ts`

Todos son compatibles con los usos actuales. La suite completa de navegador sigue igual (ver "Pruebas").

- `dialogOverlay`: el Escape en captura también cede ante `[role="combobox"][aria-expanded="true"]`, además de `[role="menu"]`.
- `dropdownMenu`: nueva opción `tabCloses`.
- `anchoredLayer`:
  - nuevas opciones `align: 'start' | 'end'` y `matchWidth`;
  - el alto disponible usa el viewport visual (teclado virtual) y se recoloca con sus eventos.
- Nueva función `layerFor(trigger)` (ver "Portal").

## Archivos

- **Nuevos**
  - En `src/lib/ui/`:
    - componentes: `Combobox.svelte`, `Menu.svelte`, `Dialog.svelte`, `Sheet.svelte`, `Sortable.svelte`, `Cover.svelte`, `CreditLine.svelte` y `SocialLinks.svelte`;
    - lógica sin DOM: `combobox.ts`, `sortable.ts` y `credits.ts`.
  - `src/routes/lab/samples.ts`: datos y portadas SVG de ejemplo, solo para `/lab`.
  - Pruebas: `tests/ui-composite.test.mjs` (14 casos, dentro de `npm test`) y `tests/browser/u6-lab.spec.ts` (19 casos).
  - Línea base: `tests/visual/baseline/darwin/lab-u6-D.png` y `lab-u6-M.png`.
  - Este documento.
- **Modificados**
  - `src/lib/ui/overlay.ts`: extensiones de la sección anterior.
  - `src/lib/ui/icons.ts`: `arrastrar`.
  - `src/lib/ui/IconButton.svelte`: oculta la ayuda con `aria-expanded="true"`.
  - `src/lib/ui/index.ts`: exportaciones.
  - `src/lib/styles/tokens.css`: tokens de U6.
  - `src/routes/lab/+page.svelte`: secciones de U6.
  - `tests/browser/u5-lab.spec.ts`: excluye los nombres de créditos de la prueba de 44 px (excepción en línea).
  - `tests/visual/censo.spec.ts`: capturas `lab-u6-D` y `lab-u6-M`.
  - `tests/visual/README.md`, `package.json` (`npm test`), [`decisiones.md`](./decisiones.md) y [`estado.md`](./estado.md).
- **Sin tocar:** `CreditSummary.svelte`, `CoverFallback.svelte`, `AddToCrateButton.svelte`, `MobileFilterSheet.svelte`, `LanzamientoModal.svelte` y todas las vistas. Las primitivas las sustituyen cuando cada vista migre.

## API para U7, U8 y U9

Todo se importa desde `$lib/ui`. Los callbacks siguen el modo runes (`onchange`, `onclose`…).

### Combobox

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `label` | `string` | — | Obligatoria, visible. Nombra el campo y la lista. `hideLabel` la deja solo para lectores. |
| `options` | `ComboboxOption[]` | — | `{ value, label, keywords?, hint?, disabled? }` |
| `value` | bindable `string[]` | `[]` | Valores elegidos, en orden de alta |
| `query` | bindable `string` | `''` | Para buscar en el servidor |
| `filter` | `boolean` | `true` | `false` si quien lo usa ya filtra `options` |
| `loading` | `boolean` | `false` | "Buscando" en la lista |
| `maxResults` | `number` | 50 | |
| `allowCreate` | `boolean` | `false` | Ofrece "Añadir «texto»" si nada se llama igual (sin tildes ni mayúsculas) |
| `createLabel` | `(text) => string` | `Añadir «text»` | |
| `oncreate` | `(text) => ComboboxOption \| string \| null \| Promise<…>` | — | Sin él, el valor y la etiqueta son el texto. `null` cancela. |
| `onchange` | `(value) => void` | | |
| `removeLabel` | `(label) => string` | `Quitar {label}` | Nombre accesible del chip |
| `placeholder`, `hint`, `error`, `optional`, `required`, `disabled`, `id`, `emptyText` | | | Como Field |
| `element` | bindable | | El `<input>` |

`filterOptions`, `normalizeSearch` y `canCreate` se exportan para que quien busque en el servidor use el mismo criterio.

### Menu

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `items` | `MenuItem[]` | `[]` | `{ label, icon?, href?, onselect?, tone?: 'default' \| 'danger', disabled? }`. Sin `href` ni `onselect`, deshabilitado. |
| `groups` | `MenuGroup[]` | — | `{ label?, items }`; sustituye a `items`. Separador entre grupos. |
| `label` | `string` | `buttonLabel` o "Más opciones" | Nombre del menú. Con icono solo, también del disparador y su ayuda. |
| `icon` | `IconName` | `mas-opciones` | |
| `buttonLabel` | `string` | — | Disparador con texto y chevron |
| `variant`, `size` | | `ghost`, `md` | De Button. `link` solo con `buttonLabel`. |
| `align` | `'start' \| 'end'` | `end` | `end` para un "…" pegado a la derecha |
| `open` | bindable | `false` | |
| `disabled` | `boolean` | `false` | |

Uso típico en una colección (U14): `<Menu label="Acciones de «{nombre}»" items={[…, { label: 'Eliminar', tone: 'danger', onselect: confirmar }]} />`, donde `confirmar` abre un Dialog. El foco vuelve solo.

### Dialog

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `open` | bindable | — | |
| `title` | `string` | — | Visible y nombre accesible |
| `description` | `string` | — | `aria-describedby` |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | |
| `dismissible` | `boolean` | `true` | Tocar el fondo cierra. Escape y × cierran siempre. |
| `initialFocus` | selector | primer enfocable (×) | |
| `returnFocus` | `HTMLElement` | quien lo abrió | |
| `onclose` | `() => void` | | Se llama al cerrar por cualquier vía |
| Snippets | `children`, `footer` | | `footer`: acciones, alineadas a la derecha y con `wrap` |

### Sheet

Las mismas props que Dialog salvo `size` y `dismissible` (el fondo siempre cierra). Además:

- `swipeToClose` (`true`);
- snippet `header`: contenido fijo bajo el título, como los filtros activos;
- snippet `footer`: el pie fijo. Para la hoja de filtros (U10) es `<Button block>Ver N lanzamientos</Button>`.

Sin `footer`, el área segura inferior pasa al cuerpo.

### Sortable

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `items` | bindable `T[]` | — | |
| `key` | `(item) => string` | — | Clave estable |
| `itemLabel` | `(item) => string` | — | Para el asa y los anuncios |
| `label` | `string` | — | Nombre de la lista |
| `layout` | `'list' \| 'grid'` | `list` | |
| `moveButtons` | `boolean` | `false` | "Subir" y "Bajar" visibles |
| `disabled` | `boolean` | `false` | Sin asas |
| `onreorder` | `(items, { key, from, to }) => void` | | Tras soltar o tras mover con teclado o botón |
| Snippet | `item(item, index)` | | Contenido del elemento, sin el asa |

Para D1 y U14: `onreorder` recibe la colección completa en el orden nuevo, que es justo lo que espera `reordenarItems`. Si la RPC falla con `40001`, la vista recarga y reasigna `items`.

### Cover

`src`, `alt` (obligatoria; vacía si un texto cercano ya nombra el lanzamiento), `ambient`, `loading` (`lazy`), `fetchpriority`, `sizes`, `srcset` y `radius` (`'none' | 'sm' | 'base'`). Ocupa el ancho de su contenedor y siempre es cuadrada.

### CreditLine

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `release` | `Pick<Release, 'releaseType' \| 'primaryArtists' \| 'collaborators'>` | — | |
| `variant` | `'line' \| 'roles'` | `line` | `line` para la tarjeta, `roles` para la ficha |
| `hrefFor` | `(credit) => string \| null` | `/artista/{slug}` | U8 y U9 pasan su versión, con `withoutBetaInvitationSearch($page.url.search)` como hoy |

`creditRoleGroups` y `creditRoleLabel` (en `credits.ts`) agrupan por rol con singular y plural: "Artista principal", "Artistas principales", "Colaborador" y "Colaboradores". Hoy el catálogo distingue solo esos dos roles.

### SocialLinks

`links` (salida de `socialLinks()` o `profileSocialLinks()`), `label` ("Redes"), `size` (`md`; `sm` deja 12 px entre iconos) y `newTab`.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **106/106**: 92 previas más 14 de `ui-composite`, que cubren búsqueda y creación del combobox, la geometría del ordenable en lista y grilla, las teclas del asa, el auto-scroll, los créditos por rol y el icono |
| `npm run lint:tokens` | OK: 123 archivos, 2 excepciones temporales (las de U4; ninguna nueva) |
| `npm run build` | OK, sin avisos |
| `svelte-check` sobre los archivos nuevos y `/lab` | 0 errores y 0 avisos. `overlay.ts` conserva sus 2 errores de tipos previos (líneas de `hideOutside` y `destroy`, no tocadas). |
| `tests/browser/u6-lab.spec.ts` | **19/19**; con `--repeat-each=3`, **57/57** |
| `tests/browser/u5-lab.spec.ts` | 9/9, incluida la de 44 px, que ahora recorre también los controles de U6 |
| `npm run test:browser` | 136 pasan, 5 omitidas y 2 fallan, las dos ya registradas: E17:198, persistente desde U1, y E14 (`catalogo.spec.ts:447`), intermitente, que aislada pasó 3/3 |

Qué cubre `u6-lab.spec.ts`:

- **Teclado en el combobox:**
  - buscar con sinónimo, elegir con Intro, alternar, ↑ ↓ sobre `aria-activedescendant`, Escape en dos tiempos;
  - chips con Retroceso, ← →, Supr e Intro, con el foco donde corresponde y el anuncio;
  - crear solo con `allowCreate`, nunca un duplicado;
  - dentro del diálogo: la lista en su capa, entera, y el primer Escape solo la cierra.
- **Teclado en el menú:**
  - abrir con Intro, Espacio y ↑; recorrer con flechas circulares, Inicio, Fin y letra;
  - el deshabilitado se lee y no se activa;
  - Escape y Tab devuelven el foco;
  - una acción que abre un diálogo devuelve el foco al "…".
- **Sin recorte (aceptación del plan):**
  - menú de la última fila de una tabla con `overflow: auto` de 12rem;
  - menú dentro del diálogo, junto al borde;
  - comprobado con `elementFromPoint` en el centro y los cuatro bordes, y dentro del viewport.
- **Diálogo:** scroll interno con cabecera y pie visibles, la página sin moverse y el foco atrapado.
- **Hoja a 390:** la corta mide menos de la mitad del alto; la larga no pasa del 88 %, está apoyada abajo y su pie sigue visible tras desplazar el cuerpo.
- **Ordenable con teclado:** flechas, Inicio y Fin, anuncio y foco conservado; botones Subir y Bajar.
- **Ordenable con ratón:** arrastre y Escape a mitad de arrastre.
- **Táctil a 390,** con toques reales por CDP (`Input.dispatchTouchEvent`), que pasan por `touch-action` y los gestos del navegador:
  - arrastrar el asa reordena sin mover la página;
  - deslizar la fila desplaza la página y no reordena;
  - dentro de la hoja, el arrastre reordena sin cerrarla, sin moverla y sin desplazar su cuerpo, y el gesto de la cabecera la sigue cerrando;
  - menú y combobox con toques, y tocar fuera cierra la lista.
- **Portada:** cuadradas a 390 y 1440 con imágenes 16:9 y 5:8, `object-fit: cover`, respaldo con nombre accesible.
- **Créditos:** los nombres se truncan y "y 4 más" se ve entero; "Varios artistas" solo en el Compilado, con grupos por rol; la variante por rol.
- **Redes:** cinco enlaces con URL y nombre correctos, y aviso de otra pestaña.

### Táctil: no hubo que escalar

La condición para subir a `xhigh` no se dio, por tres motivos:

- el asa es el único punto con `touch-action: none`;
- el gesto de la hoja solo empieza en su cabecera;
- el cuerpo de la hoja tiene su propio scroll, que el ordenable reconoce para el auto-scroll.

Las pruebas táctiles lo comprueban en los dos sentidos.

### VoiceOver

**No se ejecutó VoiceOver real.** Activarlo desde el chat toma el control del audio y de la pantalla del equipo. Lo que sí se comprobó, en Chromium, es el árbol de accesibilidad que VoiceOver lee:

- **Combobox:**
  - `combobox "Géneros" [expanded]`;
  - `listbox "Géneros"` con `option "Techno, 117 lanzamientos" [selected]` y `aria-activedescendant` apuntando a la opción activa;
  - `list "Géneros: elegidos"` con `button "Quitar Techno"`;
  - las instrucciones en `aria-describedby` y la región viva con "Techno quitado. 1 elegido.".
- **Ordenable:**
  - `list "Orden de la colección"` con `button "Reordenar: …"`, `"Subir: …" [disabled]` y `"Bajar: …"`;
  - tras ↓, el foco sigue en el mismo asa y la región `assertive` dice "«Pájaros de fuego» movido a la posición 2 de 6.".

WebKit no está instalado en este equipo, así que no se comprobó en el motor de Safari.

**Pasada manual pendiente** (Safari, VoiceOver con Cmd+F5, unos 5 minutos, en `/lab`):

1. **Combobox "Géneros".**
   - Al enfocarlo, debe leer la etiqueta, "cuadro combinado", los elegidos y las instrucciones.
   - Escribe "tec": se debe oír la opción activa.
   - Intro: "Techno añadido" o "quitado".
   - Retroceso con el campo vacío: "Quitar House, botón".
2. **Ordenable.**
   - Tab hasta "Reordenar: Pájaros de fuego, botón": se deben oír las instrucciones.
   - ↓: "movido a la posición 2 de 6", sin perder el foco.
   - Fin y luego Inicio.
3. **Si VoiceOver no anuncia los cambios de la región viva tras mover**, regístralo aquí. Alternativa ya prevista: anunciar con `aria-live="polite"` y un pequeño retardo, porque el foco vuelve al asa en el mismo cuadro y puede pisar el anuncio.

## Capturas que cambiaron

| Captura | Motivo |
| --- | --- |
| `lab-D` (1440 × 5790 → 1440 × 9416) | Las secciones de U6, y el icono `arrastrar` en la retícula de iconos: la primera fila distinta es la 422, dentro de Iconos. Todo lo anterior es idéntico. |
| `lab-M` | Lo mismo a 390. La primera fila distinta es la 1235 (617 px CSS), en Iconos. Llega al tope de 10 000 px, por eso existe `lab-u6-M`. |
| `lab-u6-D`, `lab-u6-M` | Nuevas: solo las secciones de U6 (captura del elemento `.lab__u6`). Se capturaron con `-g " lab-u6-(D|M)$"`, anclado, sin tocar ninguna otra línea base. |

El resto de capturas (131 del censo y del anexo) tiene **0 diferencias**. No se tocó ninguna vista.

## Línea base

- `baseline/darwin/` tiene la línea base aceptada de U5, más `lab-u6-D` y `lab-u6-M`: 135 archivos.
- `lab-D` y `lab-M` **no** se recapturaron, para que la revisión humana vea la diferencia con `npm run visual:compare`.
- **Aceptación (2026-10-07):** se ejecutó `npm run visual:capture` (135 capturas). La primera `visual:compare` dio 1 diferencia de 4 px en `home-approx-D`, ajena a U6. Esa captura dio 0 diferencias en tres comparaciones aisladas y en una comparación completa posterior (135 capturas, 0 diferencias). Si vuelve a aparecer, hay que tratarla como candidata a `UNSTABLE`.

## Para U7, U8 y U9

- **U7 (shell).**
  - El menú de cuenta del avatar es un `Menu` con `buttonLabel` o un IconButton, con los elementos Perfil, Mis colecciones, Mis aportes y Salir. Salir lleva `icon: 'salir'`.
  - El menú móvil de navegación no es `role="menu"`: es navegación. Sigue con `dropdownMenu` sobre un `<nav>` o pasa a Sheet.
  - `+error.svelte` no necesita nada de U6.
- **U8 (tarjeta).**
  - `CreditLine` sustituye a `CreditSummary` y `Cover ambient` sustituye a `.card::before`.
  - La tarjeta ya tiene `position: relative` y `overflow: hidden`; le falta `isolation: isolate`.
  - El disparador "Varios artistas" es un Button sm de 32 px. Puede subir unos px la fila de créditos del Compilado respecto de hoy: hay que revisarlo en `card-varios-open-D`.
  - `hrefFor` debe conservar el filtro de la invitación beta, como hoy.
- **U9 (ficha).**
  - `CreditLine variant="roles"` cubre "todos los artistas por rol".
  - Para que el menú de Añadir a colección deje de cortarse, la ficha tiene dos caminos: pasar a `Dialog`, que ya trae su capa, o añadir `data-ui-layer` como hijo directo del nodo `aria-modal`. Ese menú pasa a `Menu` o a `anchoredLayer` con `layerFor`.
  - La página del lanzamiento puede usar `Cover ambient` sobre un anfitrión de página completa para el "fondo desenfocado del modal".
- **U10:** la hoja de filtros pasa a `Sheet` con `footer` ("Ver N lanzamientos") y `header` (filtros activos). El orden puede ser un `Menu` con `buttonLabel`.
- **U13 y U16:** `Combobox` con `allowCreate` para artistas y sin crear para géneros y países, salvo que el Estudio confirme diccionarios. El `oncreate` del Estudio puede abrir su diálogo de "Crear género confirmado" y devolver la opción.
- **U14:** `Sortable` con `layout` según el ViewToggle y `onreorder` hacia `reordenarItems`; `Menu` "…" en el mosaico de colecciones.
- **U15:** el contenedor con scroll de la tabla debe estar posicionado (ver "`/lab`" en las decisiones).
- **Pendiente heredado:** si `/lab` debe existir solo en desarrollo.

## Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| Ningún menú se corta en el modal ni en la tabla del Estudio | Cumplido en `/lab`, con una tabla con overflow y un diálogo. El modal real de la ficha se cumple en U9 al adoptar la capa (ver arriba). |
| Teclado completo en combobox, menú y ordenable | Cumplido (prueba automatizada) |
| VoiceOver básico en combobox y ordenable | **Parcial:** árbol de accesibilidad comprobado. La pasada humana sigue pendiente; la etapa se aceptó sin ella. |
| Táctil a 390 | Cumplido, con toques reales por CDP |
| Lint, build y suite visual | Cumplido; solo cambian las capturas de `/lab` |
| Solo tokens | Cumplido; los nuevos están en `tokens.css` (tabla de arriba) |

## Rollback

Sin datos ni migraciones.

1. Borrar:
   - `src/lib/ui/{Combobox,Menu,Dialog,Sheet,Sortable,Cover,CreditLine,SocialLinks}.svelte`;
   - `src/lib/ui/{combobox,sortable,credits}.ts`;
   - `src/routes/lab/samples.ts`;
   - `tests/ui-composite.test.mjs` y `tests/browser/u6-lab.spec.ts`;
   - `tests/visual/baseline/darwin/lab-u6-*.png`.
2. Quitar el bloque "Primitivas compuestas (U6)" de `tokens.css`, el icono `arrastrar` de `icons.ts`, la regla `aria-expanded` de `IconButton.svelte` y las exportaciones de U6 de `index.ts`.
3. En `overlay.ts`, quitar `layerFor`, `tabCloses`, `align`, `matchWidth` y el uso de `visualViewport`, y devolver el selector de Escape a `'[role="menu"]'`.
4. En `/lab`, quitar el envoltorio `.lab__u6`, las secciones, los diálogos, las hojas, los imports y los estilos de U6.
5. Quitar `ui-composite` de `npm test`, `lab-u6` de `censo.spec.ts` y la exclusión de créditos de `u5-lab.spec.ts`.
