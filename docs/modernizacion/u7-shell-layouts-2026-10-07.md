# U7 — Shell y layouts (2026-10-07)

Etapa U7 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). El plan asigna Claude Sonnet 5.5 con esfuerzo `high`; el chat corrió en **Claude Opus 5.5** con esfuerzo `high`, por elección del equipo. No hubo que escalar: el header no choca con el scroll de E14 ni con la barra de E15 (ver "E14 y E15"). No se hizo commit ni push, y no se tocaron datos, despliegue ni producción.

Estado: **aceptada el 2026-10-07**, junto con U8. La línea base se recapturó sobre U8: 142 capturas y 0 diferencias (ver el relevo de U8).

## Condición de arranque

- U6 está aceptada (2026-10-07, [`decisiones.md`](./decisiones.md), ronda 3).
- El árbol viene de U6, sin commits desde `0ab31e0`.
- `npm run visual:compare` antes de editar: **5 diferencias, todas del entorno.**
  - El equipo tenía un juego abierto que ocupaba el 120 % de una CPU (carga media de 14). La suite tardó 6 minutos en lugar de 80 segundos.
  - Diferencias: `home-search-pais-D` y `home-search-tipo-D` (la página quedó sin desplazar tras el clic), `home-loading-D` (16 px del indicador animado) y `lab-u6-D/M` (134 y 338 px).
  - `lab-u6-D/M` pasaron aisladas. Las tres de inicio pasaron en todas las corridas posteriores, con la carga más baja.
  - Si vuelven a aparecer con el equipo cargado, son candidatas a `UNSTABLE`.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Header | Navegación principal en mayúsculas sostenidas, con Button del sistema (más anchos que altos). Entrar lleno y Sugerir con borde, del mismo tamaño, en móvil y en desktop. Icono de menú de U5 (tres barras regulares), que pasa a × al abrir. Salir con icono. |
| 2. Cuenta con sesión | Desktop: avatar con chevron que abre un `Menu` (Perfil, Mis colecciones, Mis aportes · Salir). Móvil: el mismo grupo dentro del menú, encabezado por el avatar y el usuario. |
| 3. Acceso al Estudio | El perfil propio de admin y colaborador muestra el bloque "Estudio". El header no tiene acceso a herramientas para ningún rol. |
| 4. Contenedores | narrow, regular, wide y full, como tokens, clases globales y `<Container>`. |
| 5. Layouts | `PageLayout` (por defecto), `AccountLayout` (con variante `split`), `ReadingLayout` (manual y privacidad) y `ToolLayout` (vacío hasta U15). |
| 6. Patrón de retorno | Migas (`Breadcrumbs` de U5) desde `PageLayout` y `ReadingLayout`. Desaparecen los "← Volver" de artista, sello y lanzamiento. |
| 7. `+error.svelte` | `ErrorState` como página, con el mensaje como h1 y una acción. |
| Rutas | Todas declaran su layout y su contenedor (tabla "Qué ruta usa qué layout"). |

### Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U8 en adelante no las vuelva a inferir.

**Header**

- Sugerir lleva borde también en desktop. La ronda 3 lo fija para móvil, y usar la misma pareja en los dos anchos mantiene una sola jerarquía. Antes era texto verde con icono.
- En móvil, Sugerir y Entrar usan Button `sm`: 32 px visibles, 44 px de área táctil y más anchos que altos. Con `md` no caben a 360 px junto al logo y al menú. El alto del header no cambia, porque lo fija el botón de menú (44 px).
- El avatar muestra la inicial del usuario (antes la del correo). Su nombre accesible es "Cuenta @usuario". No lleva ayuda emergente: es una imagen de la persona, no un icono de acción.
- El menú de cuenta es `Menu` de U6, con `role="menu"` y teclado APG. El menú móvil y el desplegable "Menú" siguen siendo navegación (`<nav>` con `dropdownMenu`), como pedía el relevo de U6.
- En el menú móvil, los enlaces de cuenta sin icono alinean su texto con los que sí lo llevan.
- Los iconos del desplegable secundario (Manual, Blog, Substack, Instagram) siguen siendo los SVG de `/img`, como el footer. No hay equivalentes en `icons.ts` para Manual, Blog ni Substack.

**Mis aportes y Estudio, hasta U14 y U15**

- "Mis aportes" apunta a `/perfil/{usuario}#mis-aportes`: la sección de propuestas del perfil propio, que ahora tiene ese id. U14 crea `/mis-aportes` y cambia el enlace en `Header.svelte`.
- Sin `VITE_EDITORIAL_ENABLED`, "Mis aportes" no aparece, porque la sección tampoco se muestra. Así no hay enlaces muertos.
- El bloque "Estudio" del perfil enlaza a las herramientas actuales según rol y flags:
  - admin: Catálogo (`/admin/catalogo`, con `VITE_ADMIN_CATALOG_ENABLED`) y "Propuestas y reportes" (`/editorial`, con `VITE_EDITORIAL_ENABLED`);
  - colaborador: Propuestas (`/editorial`).
- U15 sustituye esos destinos por `/estudio`.
- El rol se lee con `getProfileRole`. Si falla, no se muestra el bloque y la página sigue.

**Migas**

- La primera miga de artista, sello y lanzamiento es "Catálogo" y conserva la búsqueda con la que se llegó, sin la invitación beta (`catalogCrumb`).
  - Artista y sello reciben esa búsqueda en su propia URL, como hasta ahora.
  - La página del lanzamiento la toma del `referrer` si viene del catálogo del mismo sitio. Si no, va a `/`.
- La última miga es la página actual. No es un enlace y lleva `aria-current="page"`.
- Colección propia: "Mis colecciones › Nombre". Colección ajena: "@dueño › Colecciones › Nombre". "Colecciones" lleva a `/perfil/{dueño}#colecciones`.
- Mis colecciones: "@usuario › Mis colecciones". Las migas salen de la sesión, así que no esperan a la consulta del perfil.
- Se pierde el `history.back()` de "← Volver", y con él la posición de scroll al volver. La búsqueda sí se conserva.

**Lectura (manual)**

- Se retiraron:
  - el botón flotante "Secciones" (hallazgo del censo);
  - la animación de aparición de las secciones (movimiento decorativo);
  - el enlace "Volver arriba".
- En su lugar:
  - desde 1024 px, índice lateral fijo con la sección actual marcada (`aria-current="location"`);
  - por debajo, un desplegable "Contenido" antes del texto, que se cierra al elegir.
- "+ Sugerir disco" pasa a un Button con icono: "Sugerir un lanzamiento", el mismo texto que el resto del sitio.
- "Qué es", "Orden" y el resto conservan su texto. Los "›" de las preguntas pasan a un icono SVG.
- El manual deja de tener sistema visual propio: sin variables `--manual-*`, sin literales y sin los 4 breakpoints.

**Error**

- `+error.svelte` ya no muestra el código (404). El mensaje ("No encontramos esta página" o "Algo salió mal") es el h1 y la acción es "Volver al catálogo".

### Lo que queda fuera de "ninguna ruta define su propio ancho, título o botón de volver"

Son excepciones conscientes. Cada una pertenece a una etapa posterior que rehace esa vista.

| Ruta o pieza | Qué queda | Etapa |
| --- | --- | --- |
| `/admin/catalogo` | Usa `l-container--full`, pero conserva sus cabeceras internas y el "←" del editor, que vuelve a la tabla, no a otra página. | U15 (`ToolLayout`) |
| `/editorial` | Usa `PageLayout wide`. Sus colas y el diálogo conservan sus estilos. | U15 |
| `<title>` del documento | Sigue en el `<svelte:head>` de cada ruta. El layout raíz también emite uno. No se centralizó para no cambiar títulos que ya funcionan. | — (proponer si se quiere) |
| Artista y sello | El "Ordenar por" nativo va en las acciones de la cabecera. | U11 (sin filtros internos) |
| Colección | "Copiar link" y el "✕" de quitar siguen como botones de la ruta. | U14 |
| Mis colecciones | El botón del estado vacío sigue siendo el de la ruta. La cabecera usa Button. | U14 |
| Ficha como página | Pasa de 1120 a 1200 px (contenedor wide). La ficha y "Explorar el catálogo" no se tocaron. | U9 |
| `/lab` | Conserva su cabecera "Primitivas". Es interna. | — |

## Archivos

- **Nuevos**
  - `src/lib/layouts/`:
    - `Container.svelte`, `PageLayout.svelte`, `AccountLayout.svelte`, `ReadingLayout.svelte` y `ToolLayout.svelte`;
    - `crumbs.ts` (`catalogCrumb`) e `index.ts`.
  - `tests/browser/u7-shell.spec.ts` (20 casos).
  - Línea base: `header-account-menu-D`, `perfil-admin-D`, `perfil-colab-M`, `lab-u7-D` y `lab-u7-M`.
  - Este documento.
- **Modificados**
  - Shell:
    - `Header.svelte`, reescrito en su marcado. La lógica de scroll de E14 no cambia, salvo que el menú de cuenta abierto también congela.
    - `Footer.svelte` y los componentes de inicio (`HomeResults`, `HomeFilterPanel`, `MobileSearchBar`) y `+page.svelte`: la clase `container` pasa a `l-container l-container--wide`, con los mismos valores.
  - Estilos: `tokens.css` (bloque "Shell y layouts (U7)") y `styles.css` (contenedores, con `.container` como alias).
  - Primitivas:
    - `Menu.svelte`: snippet `trigger`;
    - `ErrorState.svelte`: prop `heading`.
  - Rutas:
    - `+error.svelte`, `auth/{login,registro,recuperar,reset}`, `privacidad`, `manual`;
    - `artista/[slug]`, `sello/[slug]`, `lanzamiento/[slug]`;
    - `mis-colecciones`, `coleccion/[slug]`, `perfil/[username]`;
    - `reportar`, `sugerir`, `editorial`, `admin/catalogo` (solo el contenedor) y `lab`.
  - Pruebas:
    - `catalogo.spec.ts`: la prueba E14 de sesión pasa al menú de cuenta;
    - `u3-colecciones.spec.ts`: lee `.l-page` en lugar de `.page`;
    - `u5-lab.spec.ts`: ignora controles no pintados (`checkVisibility`) y aplica la excepción "en línea" a los enlaces dentro de un párrafo de lectura;
    - `tests/visual/censo.spec.ts`: las 5 capturas nuevas.
  - [`estado.md`](./estado.md).
- **Sin tocar:** tarjeta, ficha (`LanzamientoVista`, `ReleaseDetail`, modal), inicio (salvo la clase del contenedor), formularios (campos y botones de envío de cuenta, sugerir y reportar) y `overlay.ts`.

## API para U8 y siguientes

Todo se importa desde `$lib/layouts`. Los layouts son componentes que la ruta usa como raíz; no son `+layout.svelte` por grupo, porque cada página pasa título, migas y acciones.

### Contenedores

| Tamaño | Token | Ancho (incluye margen) | Para |
| --- | --- | --- | --- |
| `narrow` | `--container-narrow` | 46rem · 736 | Lectura sin índice, formularios, cuenta, error |
| `regular` | `--container-regular` | 60rem · 960 | Perfil, Mis colecciones, cuenta en dos columnas |
| `wide` | `--container-wide` | 75rem · 1200 | Catálogo, artista, sello, colección, ficha, manual con índice, editorial |
| `full` | `--container-full` | 100 % | Herramienta (Estudio) |

- El margen lateral es `--container-gutter` (24 px, el de siempre), en todos los anchos.
- `<Container size="wide" as="section" class="…">` renderiza `class="l-container l-container--wide"`.
- Las mismas clases están en `styles.css` para el que no puede envolver, por ejemplo una sección sticky. Así lo hace el inicio.
- `.container` es un alias de `wide`. No se usa en código nuevo.

### PageLayout

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `container` | `ContainerSize` | `wide` | |
| `breadcrumbs` | `Crumb[]` | — | Del más general a la página actual, que va al final |
| `eyebrow` | `string` | — | Antetítulo en mayúsculas, verde |
| `title` | `string` | — | h1 (`--text-3xl`, 800). Sin título no hay cabecera: la vista pone su h1, como la ficha. |
| `titleId` | `string` | — | Para `aria-labelledby` |
| `description` | `string` | — | Una o dos frases, con la medida de lectura |
| Snippets | `leading` (avatar), `meta` (datos e insignias), `actions` (a la derecha; abajo en móvil), `children` | | |

- Ritmo vertical: arriba `--page-pad-top` (48; 24 en móvil), abajo `--page-pad-bottom` (64), y `--page-header-gap` (32) entre la cabecera y el contenido.
- Con migas, el margen superior baja a 12 (8 en móvil) y las migas ocupan esa franja.

### AccountLayout

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `title` | `string` | — | h1 (`--text-2xl`) |
| `help` | `string` | — | Ayuda bajo el título |
| `variant` | `'single' \| 'split'` | `single` | `split` necesita `aside` |
| Snippets | `children` (formulario o estado), `footer` (enlaces secundarios, centrados, con área táctil de 44), `aside` (beneficios) | | |

- `single`: contenedor narrow y columna de `--account-form-w` (26rem), centrada.
- `split`: contenedor regular.
  - Desde 769 px: `aside` a la izquierda (`--account-aside-w`, 22rem) y formulario a la derecha.
  - En móvil: primero el formulario y debajo `aside`.
  - Es la base de Entrar en U12, con los tres beneficios.

### ReadingLayout

| Prop | Tipo | |
| --- | --- | --- |
| `title`, `eyebrow`, `lead`, `meta` | `string` | Título en `--text-display`, entrada en `--text-lg` y línea de datos en `--text-xs` |
| `breadcrumbs` | `Crumb[]` | |
| `toc` | `TocEntry[]` (`{ id, label }`) | Con índice: contenedor wide e índice lateral fijo desde 1024 px; por debajo, un desplegable "Contenido". Sin índice: contenedor narrow. |
| Snippets | `aside` (ilustración decorativa junto al título, oculta en móvil), `children` | |

Tipografía del cuerpo, sin clases:

- `h2`, `h3`, `p`, listas, enlaces, `strong` y `code`;
- 16 px, interlineado `--leading-reading` (1,7) y medida `--measure-reading` (68ch);
- `section + section` separadas por `--reading-section-gap` (48);
- `scroll-margin-top` en todo `[id]`.

Los enlaces con clase `.ui-btn` (Button) no reciben el estilo de enlace de lectura.

### ToolLayout (para U15)

| Prop | Tipo | |
| --- | --- | --- |
| `name` | `string` | "Estudio": rótulo de la barra y nombre de su `<nav>` |
| `sections` | `ToolSection[]` (`{ label, href, icon?, count? }`) | |
| `current` | `string` | `href` actual (`aria-current="page"`) |
| `title` | `string` | h1 de la vista |
| Snippets | `actions`, `sidebarFooter`, `children` | |

- Contenedor full y `data-density="compact"` en la raíz.
- Barra lateral fija de `--tool-sidebar-w` (15rem). En móvil pasa a una fila de secciones desplazable.
- Hoy vive bajo el header global. U15 decide si el Estudio lleva header propio.

### Migas

- `catalogCrumb(search)` devuelve `{ label: 'Catálogo', href: '/' + búsqueda sin beta }`.
- Para U11 (artista y sello): la cabecera ya es la de `PageLayout`, con migas, antetítulo y nombre a la izquierda. Falta retirar el orden.

### Extensiones de primitivas

- **`Menu`:**
  - snippet `trigger`: contenido propio del disparador, con chevron;
  - el nombre accesible sale de `label`;
  - el botón lleva la clase `ui-menu__trigger`.
- **`ErrorState`:** prop `heading: 'h1' | 'h2' | 'h3'`, que renderiza el mensaje como encabezado. Por defecto sigue siendo un párrafo.

### Tokens nuevos (`tokens.css`, bloque "Shell y layouts (U7)")

| Token | Valor | Uso |
| --- | --- | --- |
| `--container-narrow / regular / wide / full` | 46rem · 60rem · 75rem · 100% | Contenedores |
| `--container-gutter` | `--space-5` | Margen lateral |
| `--page-pad-top`, `--page-pad-top-mobile`, `--page-pad-bottom`, `--page-header-gap` | 48 · 24 · 64 · 32 | Ritmo vertical de página |
| `--account-form-w`, `--account-aside-w` | 26rem · 22rem | Cuenta |
| `--measure-reading`, `--leading-reading`, `--leading-heading`, `--reading-section-gap`, `--reading-toc-w` | 68ch · 1.7 · 1.15 · 48 · 13rem | Lectura |
| `--tool-sidebar-w` | 15rem | Herramienta |
| `--avatar-sm` | 28px | Avatar del menú de cuenta |
| `--header-logo-h`, `--header-logo-h-mobile`, `--header-pad-block` | 22 · 20 · 0.85rem | Header (los valores de siempre) |

## Qué ruta usa qué layout

| Ruta | Layout | Contenedor | Migas |
| --- | --- | --- | --- |
| `/` (inicio) | Composición propia (U10) | wide, por clase en cada sección | — |
| `/artista/[slug]`, `/sello/[slug]` | PageLayout | wide | Catálogo › Nombre |
| `/lanzamiento/[slug]` | PageLayout sin título; la ficha pone el h1 | wide | Catálogo › Título |
| `/lanzamiento/[slug]` (no encontrado) | PageLayout + ErrorState h1 | narrow | — |
| `/coleccion/[slug]` | PageLayout | wide | Mis colecciones › Nombre · @dueño › Colecciones › Nombre |
| `/mis-colecciones` | PageLayout | regular | @usuario › Mis colecciones |
| `/perfil/[username]` | PageLayout con avatar | regular | — |
| `/auth/login`, `/auth/registro`, `/auth/recuperar`, `/auth/reset` | AccountLayout single | narrow | — |
| `/manual` | ReadingLayout con índice | wide (columna de 68ch) | — |
| `/privacidad` | ReadingLayout | narrow | — |
| `/sugerir`, `/reportar` | PageLayout | narrow | — |
| `/editorial` | PageLayout (ToolLayout en U15) | wide | — |
| `/admin/catalogo` | Contenedor full (ToolLayout en U15) | full | — |
| `+error.svelte` | Container + ErrorState h1 | narrow | — |
| `/lab` | Clase de contenedor | wide | — |
| `/crate/[slug]`, `/mis-crates` | Redirecciones de U3, sin interfaz | — | — |

## E14 y E15

No hubo choque, así que no se escaló a Opus 5.5 por este motivo:

- El alto del header es el de siempre: `--header-pad-block` más 44 px de controles. E15 no mide el header.
- La lógica de scroll de E14 está intacta: ocultar y reaparecer en desktop, solo en el tope en móvil, congelación con campo enfocado o teclado.
- El menú de cuenta abierto también congela el header. Lo comprueba `u7-shell.spec.ts`.
- `catalogo.spec.ts` (E04/E14), E12, E13 y E15 pasan **29/29** con un worker.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **106/106** |
| `npm run lint:tokens` | OK: 130 archivos, 2 excepciones temporales (las de U4; ninguna nueva) |
| `npm run build` | OK |
| `svelte-check` | Sin errores ni avisos nuevos en los archivos de U7. Los errores restantes son previos (`$types`, `Buffer` en las pruebas, `overlay.ts`, `admin/catalogo`). |
| `tests/browser/u7-shell.spec.ts` | **20/20**. Junto con E14, **96/96** en cuatro repeticiones con 2 workers. Una corrida previa del mismo bloque tuvo 1 fallo que no dejó traza y no se reprodujo: probablemente el E14 intermitente ya registrado. |
| E04/E12/E13/E14/E15 (`--workers=1`) | **29/29** |
| `npm run test:browser` (2 workers) | **156 pasan**, 5 omitidas y 2 fallan: E17:198, el fallo persistente conocido desde U1, y E16 "cada apertura crea una sesión", que pasó 3/3 aislada y sí pasó en la corrida completa anterior (intermitente bajo paralelo). |

Qué cubre `u7-shell.spec.ts`:

- **Header anónimo a 360, 390 y 1440:**
  - Sugerir y Entrar del mismo alto, los dos más anchos que altos y en mayúsculas;
  - Entrar lleno, Sugerir transparente con borde;
  - menú de 44 px con tres trazos;
  - nada se sale del viewport.
- **Menú de cuenta con teclado** (1440):
  - Intro abre en Perfil; ↓, ↑ circular, Inicio y Fin;
  - Escape devuelve el foco; ↑ desde el disparador abre en Salir; Tab cierra y devuelve el foco;
  - Salir lleva icono;
  - con el menú abierto el header no se oculta al desplazar;
  - Salir cierra la sesión y vuelve Entrar.
- **Móvil con sesión:** sin Entrar ni avatar en la barra. La cuenta va dentro del menú, con el usuario, Perfil enfocado y Salir con icono.
- **Roles × anchos** (anónimo, comunidad, colaborador y admin, a 390 y 1440), sobre `/perfil/…`:
  - h1 correcto;
  - el header no tiene acceso a herramientas;
  - Entrar solo para el anónimo y el avatar solo con sesión;
  - bloque Estudio solo para colaborador (Propuestas) y admin (Catálogo, y Propuestas y reportes), con sus destinos;
  - `#mis-aportes` solo en el perfil propio;
  - sin desborde horizontal.
- **Contenedor declarado** en 12 rutas, y en Mis colecciones con sesión, con sus migas.
- **404** con h1, alerta y "Volver al catálogo".
- **Lectura:**
  - a 1440, índice fijo con 10 enlaces, la sección marcada al elegirla, cuerpo de 16 px y medida de 720 px o menos;
  - a 390, desplegable "Contenido" que se cierra al elegir y sin botón flotante;
  - privacidad con p de 16 px y h2 de 24 px.
- **Cuenta:** login, registro y recuperar comparten título, formulario y pie.

No se ejecutó en Firefox ni WebKit: los binarios no están instalados, igual que en E15.

## Capturas que cambiaron

`npm run visual:compare` final: **140 capturas**, 26 iguales y 114 distintas, todas dentro del alcance. La clasificación sale de la franja vertical que cambia en cada diff.

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Solo la franja del header (y ≤ 66 px CSS) | `home-D/M/T`, `home-full-D/M/T`, `home-approx-D`, `home-beta-D/M`, `home-empty-D`, `home-error-D`, `home-filtered-D/M`, `home-filtered-panel-D`, `home-loading-D`, `home-page2-D`, `home-radar-D`, `home-radar-results-D`, `home-search-D`, `home-search-suggest-D`, `home-sheet-M`, `home-sheet-filtered-M`, `home-sheet-pais-M`, `home-sheet-radar-M`, `home-welcome-D/M`, `header-anon-D`, `header-auth-D`, `lab-M` (los primeros 10 000 px; U7 está más abajo) | Header nuevo. El inicio no cambia. |
| Header detrás del modal | `modal-D`, `modal-T`, `modal-1100-D`, `modal-bottom-D`, `modal-crate-D`, `modal-longtitle-D`, `modal-nocover-D`, `modal-radar-D`, `modal-review-D`, `modal-soundcloud-D`, `modal-spotify-D`, `modal-tablet-landscape-T`, `modal-varios-D`, `debug-modal-overlap` | El header se ve atenuado tras el modal. La ficha no cambia. |
| Menús del header | `header-menu-D`, `header-menu-M`, `header-auth-menu-M` | Botón Menú con icono y × al abrir; cuenta dentro del menú móvil con Mis aportes y Salir con icono |
| Cuenta | `login-D/M`, `login-error-D`, `registro-D/M`, `registro-error-D`, `registro-filled-D`, `registro-success-D`, `recuperar-D/M`, `recuperar-sent-D`, `reset-error-D`, `reset-recovery-D/M`, `reset-signup-D`, `miscrates-anon-D` y `reportar-anon-D` (las dos redirigen a Entrar) | AccountLayout: título, ayuda y pie del layout; contenedor narrow. Los campos no cambian. |
| Lectura | `manual-D/M`, `privacidad-D` | ReadingLayout y nuevo estilo del manual |
| Páginas con cabecera de layout | `artista-D/M`, `sello-D/M`, `perfil-D/M`, `miscrates-D/M`, `miscrates-empty-D`, `crate-D/M`, `crate-crear-D/M`, `sugerir-D/M`, `sugerir-anon-D/M`, `sugerir-admin-D`, `sugerir-detected-D/M`, `reportar-D/M`, `editorial-admin-D/M`, `editorial-anon-D`, `editorial-approve-D`, `editorial-colab-D` | PageLayout: migas en lugar de "← Volver", antetítulo y h1 del sistema, acciones a la derecha, contenedor declarado |
| Ficha como página | `ficha-D/M`, `ficha-comp-D` | Migas "Catálogo › Título" en lugar de "← Volver"; contenedor de 1120 a 1200 |
| Consola | `admin-anon-D`, `admin-norole-D`, `admin-list-D/M/T`, `admin-selection-D`, `admin-filters-D`, `admin-editor-D/M/T`, `admin-editor-top-D`, `admin-history-D`, `admin-finder-D`, `admin-publish-D`, `admin-new-D` | Header y contenedor full: margen de 24 en lugar de 12 en desktop y de 11 en móvil |
| Error | `404-D/M` | ErrorState como página |
| `/lab` | `lab-D` | Secciones de U7 (crece de alto) y header |

**Nuevas** (capturadas con `-g` anclado, sin tocar otras líneas base):

- `header-account-menu-D`: menú de cuenta abierto;
- `perfil-admin-D`: Estudio con Catálogo, y Propuestas y reportes;
- `perfil-colab-M`: Estudio con Propuestas;
- `lab-u7-D/M`: catálogo de layouts.

**Iguales:**

- tarjetas (`card-*`), footer, correos y paginación;
- `modal-M`, `modal-mid-M` y `modal-bottom-M` (en móvil el modal cubre el header);
- `home-scrolled-M`, `home-search-pais-D` y `home-search-tipo-D` (el header ya no está en el encuadre);
- `lab-u6-D/M`.

## Línea base

- `baseline/darwin/` tiene la línea base aceptada de U6 más las 5 capturas nuevas: 140 archivos.
- Las 114 distintas **no** se recapturaron, para que la revisión humana las vea con `npm run visual:compare` o con el comparador deslizante (`npx playwright show-report tests/visual/report/html`).
- Al aceptar U7: `npm run visual:capture` y una `visual:compare` con 0 diferencias. Conviene hacerlo con el equipo sin carga (ver "Condición de arranque").

## Para U8 y siguientes

- **U8 (tarjeta):** la tarjeta no se tocó. Las grillas de artista, sello y colección ya viven dentro de `PageLayout wide`.
- **U9 (ficha):**
  - la página del lanzamiento ya tiene las migas y el contenedor wide;
  - U9 rediseña "Explorar el catálogo" (hoy son las recomendaciones de la ficha) y decide si la ficha usa todo el ancho de 1200.
- **U10 (inicio):** el inicio declara `l-container l-container--wide` en cada sección. Si pasa a un componente raíz, puede usar `<Container>`.
- **U11 (artista y sello):** la cabecera ya está alineada a la izquierda con migas. Falta quitar "Ordenar por" (sin filtros internos) y revisar la grilla.
- **U12 (cuenta):** `AccountLayout variant="split"` con `aside` para los tres beneficios de Entrar. La demo está en `/lab`.
- **U13 (sugerir y reportar):** ya están en `PageLayout narrow`.
- **U14:**
  - crear `/mis-aportes` y cambiar el enlace del menú (`contributionsHref` en `Header.svelte`);
  - "Copiar link" y "✕" de la colección pasan a primitivas;
  - el perfil ya tiene `#colecciones` y `#mis-aportes`.
- **U15:**
  - `ToolLayout` con `sections` de Catálogo, Propuestas y Reportes;
  - cambiar los destinos del bloque Estudio del perfil (`studioLinks` en `perfil/[username]/+page.svelte`) a `/estudio`;
  - el contenedor de la tabla debe estar posicionado (relevo de U6).
- **Pendiente heredado:**
  - si `/lab` debe existir solo en desarrollo;
  - la pasada con VoiceOver de U6;
  - centralizar `<title>`, si se quiere.

## Rollback

Sin datos ni migraciones.

1. Borrar:
   - `src/lib/layouts/`;
   - `tests/browser/u7-shell.spec.ts`;
   - las 5 capturas nuevas y sus líneas en `censo.spec.ts`;
   - este documento.
2. Quitar el bloque "Shell y layouts (U7)" de `tokens.css` y devolver `.container` en `styles.css` a `max-width: 1200px; padding-inline: var(--spacing-md)`.
3. Quitar el snippet `trigger` de `Menu.svelte` y la prop `heading` de `ErrorState.svelte`.
4. Restaurar el marcado de `Header.svelte` y de las rutas listadas en "Archivos". El manual previo se respaldó durante la etapa en el scratchpad de la sesión, que no es durable: para recuperarlo hace falta el árbol del equipo o un commit previo a U7.
5. Revertir los ajustes de `catalogo.spec.ts`, `u3-colecciones.spec.ts` y `u5-lab.spec.ts`.
