# U5 — Primitivas base (2026-10-07)

Etapa U5 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). El plan asigna Claude Sonnet 5.5 con esfuerzo `high`; el chat corrió en Claude Opus 5.5. No hubo que escalar: ninguna primitiva necesita gestionar foco entre capas. Sin commit, push, datos, despliegue ni producción.

Estado: **aceptada el 2026-10-07**. La línea base visual se recapturó sobre U5: 133 capturas y 0 diferencias después.

## Condición de arranque

- **U4 aceptada el 2026-10-07**, con la decisión del equipo tomada en este chat. Se registró en [`decisiones.md`](./decisiones.md), ronda 3, en "Orden frente a E22 y línea base".
- Antes de recapturar, la línea base previa a U4 se copió a `tests/visual/.ref-pre-u4/darwin/` (131 PNG, dentro del repo). Esa carpeta se puede borrar cuando ya no haga falta comparar contra el estado previo a U4. No está en `.gitignore`.
- Se ejecutó `npm run visual:capture` sobre el árbol de U4: 131 capturas. Después, `visual:compare` dio **0 diferencias** antes de editar.
- El árbol venía de U4, con 77 entradas sin confirmar. No hay commits desde `0ab31e0`.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Iconos SVG | `Icon` con 28 iconos en `icons.ts`, en retícula de 24 y con `currentColor`: buscar, salir, compartir, reportar, menú (tres barras iguales y equidistantes, comprobado en prueba), cerrar, agregar, check, "…", ojo y ojo tachado, 4 flechas, flecha externa, 4 chevrons, grilla, lista y las cinco redes del perfil (Bandcamp, SoundCloud, Instagram, X y Facebook). Instagram reutiliza el dibujo de marca de `static/img/insta.svg`. |
| Emoji retirados | 🔍 y ✖ del botón Buscar/Cerrar búsqueda, los cuatro ✔ de los desplegables Tipo y Año de Filtros, y el ↗ de "Abrir fuente original" en la Estación editorial. En las tres vistas solo cambia el icono (ver "Capturas que cambiaron"). |
| 2. Button e IconButton | 5 variantes × 3 tamaños, más deshabilitado, ocupado, alternancia (`aria-pressed`), icono inicial o final, ancho completo y enlace (`href`). IconButton exige `label`: es su nombre accesible y el texto de una ayuda visible con cursor o con foco de teclado, que Escape oculta. |
| 3. Field, Textarea y PasswordField | Etiqueta obligatoria, ayuda, error (`aria-invalid` y `aria-describedby`), opcional, solo lectura, deshabilitado y contador en Textarea. PasswordField muestra en vivo las reglas y la fortaleza en tres segmentos, y permite mostrar u ocultar la contraseña. |
| 4. Chip | Filtro activo compacto (32 px, todo el chip quita el filtro), género (texto, enlace o botón con seleccionado) y estado (neutro, acento, aviso, peligro). |
| 5. Pagination | Numerada (`full`), compacta (`‹ 5 de 233 ›`) y `auto` (compacta por debajo de 768). El texto ocupa la misma caja que los botones y se centra en ese eje. La compacta comparte línea con "Ordenar por" a 390 (demostrado en `/lab`). Mantiene siempre 7 elementos para que los botones no salten de sitio. |
| 6. ViewToggle | Grilla/lista recordada por contexto en `localStorage` (`discotica:vista:<contexto>`), con lectura y escritura protegidas por try/catch. |
| 7. Skeleton y LoadingIndicator | Esqueleto de tarjeta (portada cuadrada, artista, título, metadatos y géneros) y de fila. El indicador actual del catálogo, con los tres puntos en horizontal. |
| 8. EmptyState y ErrorState | Mensaje corto, detalle opcional y una sola acción. Variantes de página e integrada. ErrorState usa "Reintentar" por defecto y puede mostrarse ocupado. |
| 9. Breadcrumbs | Migas en texto, del tipo "Catálogo › Artista"; el último elemento es la página actual. |
| 10. `/lab` | Todas las primitivas con sus variantes y estados. No está enlazada desde ningún sitio y lleva `noindex, nofollow`. |

### Decisiones de diseño tomadas en la etapa

Ninguna cambia una decisión de producto. Están aquí para que U6 en adelante no las vuelva a inferir.

- **Tamaños de botón: sm 32, md 44 y lg 52.** md es el tamaño de Comprar, como pedía el relevo de U4. U4 definió 4 alturas (32, 40, 44 y 52) para 3 tamaños; 40 queda sin uso en el sitio público.
- **Área táctil.** Todo control de menos de 44 px amplía su área de clic hasta 44 con un `::after` invisible, sin cambiar su caja visible. Esto aplica a Button e IconButton sm, chips interactivos, números de página y enlaces de migas. Hay dos reglas para quien los use:
  - Entre dos objetivos sm seguidos debe haber 12 px (`--target-touch` − `--button-h-sm`). Pagination sm y ViewToggle sm ya lo cumplen.
  - Un contenedor con `overflow` debe dejar al menos 6 px de padding alrededor de un objetivo sm. Si no, recorta el área ampliada.
- **Chip de género interactivo: 32 px.** Con 24 px, dos filas de chips con 12 px de separación solapaban sus áreas de 44. El chip de género que solo muestra texto sigue en 24.
- **Ayuda de IconButton.**
  - Se muestra con `hover` solo en dispositivos con cursor (`@media (hover: hover)`) y siempre con foco de teclado.
  - Es `aria-hidden`: el nombre accesible ya es `label` y así el lector no lo repite.
  - Escape la oculta y no detiene el evento, para que un diálogo o un menú que la contenga también reciba ese Escape.
- **Contraseña.** Solo es obligatoria la longitud mínima de 8 caracteres, la misma que ya impone el registro (`minlength="8"`). "Letras y números" y "Una mayúscula o un símbolo" son recomendaciones: suben la fortaleza, pero no bloquean el envío. Volverlas obligatorias sería un cambio de producto. "Fuerte" exige 12 caracteres.
- **Criterio de "emoji".** Se tomó como emoji todo carácter con la propiedad Unicode `Emoji` usado como icono: 🔍, ✖, ✔ y ↗. Los glifos tipográficos sin esa propiedad (←, →, ✕, ✓, ‹, ›, ⌄, ♪, ✎, ⇄, ⌕, ＋) se quedan donde están hasta que su vista migre a las primitivas. La lista con la etapa de cada uno está en "Para U6 y siguientes".
- **Svelte en modo runes.** Las primitivas usan `$props`, snippets y callbacks (`onclick`, `onchange`…). Un componente heredado (`export let`) las usa pasando `onclick={fn}`; `on:click` sobre una primitiva no hace nada.

### Tokens nuevos (`tokens.css`, bloque "Primitivas (U5)")

| Token | Valor | Uso |
| --- | --- | --- |
| `--button-h-sm/md/lg` | `--control-h-sm` · `-lg` · `-xl` (32 · 44 · 52) | Button, IconButton, Pagination |
| `--button-px-sm/md/lg` | `--control-px-sm` · `-lg` · `-xl` (12 · 24 · 28) | Padding horizontal |
| `--field-h-md/lg` | 44 · 52 | Field |
| `--chip-h-sm/md` | 24 · 32 | Chip |
| `--chip-px-sm/md` | 8 · 12 | Chip |
| `--icon-sm/md/lg` | 16 · 20 · 24 px | Icon |
| `--icon-stroke` / `--icon-stroke-bold` | 1.75 / 2.5 | Trazo normal y junto a texto en negrita |
| `--loader-dot` / `--loader-dot-sm` | 8 / 6 px | LoadingIndicator |
| `--tooltip-max-w` | 16rem | Ayuda de IconButton |

### Archivos

- **Nuevos**
  - `src/lib/ui/`: `Icon.svelte`, `icons.ts`, `Button.svelte`, `IconButton.svelte`, `Field.svelte`, `Textarea.svelte`, `PasswordField.svelte`, `password.ts`, `Chip.svelte`, `Pagination.svelte`, `pagination.ts`, `ViewToggle.svelte`, `viewPreference.ts`, `Skeleton.svelte`, `LoadingIndicator.svelte`, `EmptyState.svelte`, `ErrorState.svelte`, `Breadcrumbs.svelte` e `index.ts`.
  - `src/routes/lab/+page.svelte`.
  - `tests/ui-primitives.test.mjs` (11 casos, dentro de `npm test`).
  - `tests/browser/u5-lab.spec.ts` (9 casos).
  - `tests/visual/baseline/darwin/lab-D.png` y `lab-M.png`.
  - `tests/visual/.ref-pre-u4/` (respaldo, ver arranque).
  - Este documento.
- **Modificados**
  - `src/lib/styles/tokens.css`: tokens de primitivas.
  - Emoji por SVG: `src/lib/components/home/HomeSearchToggle.svelte`, `src/lib/components/Filtros.svelte` y `src/routes/editorial/+page.svelte`.
  - `package.json`: `tests/ui-primitives.test.mjs` en `npm test`.
  - `tests/visual/censo.spec.ts`: capturas `lab-D` y `lab-M`, suplementarias.
  - `tests/visual/README.md`, [`decisiones.md`](./decisiones.md) y [`estado.md`](./estado.md).
- `src/lib/components/Pagination.svelte`, la paginación que usan hoy las vistas, **no se tocó**. La sustituye `$lib/ui/Pagination.svelte` cuando cada vista migre.

## API para U6

Todas se importan desde `$lib/ui` (o por archivo). Los atributos no listados pasan al elemento nativo (`...rest`).

### Icon

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `name` | `IconName` | — | Obligatoria. Lista en `ICON_NAMES`; redes en `SOCIAL_ICONS`. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'em'` | `md` | 16 · 20 · 24 · 1em |
| `weight` | `'regular' \| 'bold'` | `regular` | `bold` junto a texto de peso 800 |
| `label` | `string` | — | Solo si el icono comunica algo solo: `role="img"`. Sin él, `aria-hidden`. |

### Button

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'destructive' \| 'link'` | `primary` | primario, secundario, ghost, destructivo y enlace |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | 32 · 44 · 52 |
| `href` | `string` | — | Renderiza `<a>`. Deshabilitado: sin `href`, con `aria-disabled` y fuera del orden de tabulación. |
| `type` | `'button' \| 'submit' \| 'reset'` | `button` | |
| `disabled`, `loading`, `block`, `square` | `boolean` | `false` | `loading`: `aria-busy`, conserva el foco e ignora el clic. `square`: lo usa IconButton. |
| `pressed` | `boolean` | — | `aria-pressed` |
| `icon`, `iconEnd` | `IconName` | — | |
| `element` | bindable | | El nodo `<button>` o `<a>` |
| Snippet | `children` | | Etiqueta |
| Callback | `onclick(event)` | | No se llama si está deshabilitado u ocupado |

### IconButton

`icon` y `label` son obligatorias. Además acepta `variant` (`ghost` por defecto, `secondary`, `primary` o `destructive`), `size`, `href`, `type`, `disabled`, `loading`, `pressed`, `tooltip` (`'top' | 'bottom'`), `tooltipAlign` (`'center' | 'start' | 'end'`, para iconos pegados a un borde), `element` (bindable) y `onclick`.

### Field

| Prop | Tipo | |
| --- | --- | --- |
| `label` | `string` | Obligatoria, visible. `hideLabel` la deja solo para lectores. |
| `value` | bindable | |
| `type` | `text \| email \| search \| url \| tel \| password \| number` | |
| `size` | `'md' \| 'lg'` | 44 · 52 (`lg` para el campo del panel de búsqueda) |
| `icon` | `IconName` | Icono al inicio |
| `hint`, `error` | `string` | `error` añade `aria-invalid` |
| `optional`, `required`, `disabled`, `readonly` | `boolean` | |
| `placeholder`, `autocomplete`, `name`, `id` | | `id` se genera si falta |
| `describedby` | `string` | Ids extra para `aria-describedby` |
| `element` | bindable | El `<input>` |
| Snippets | `end`, `below` | `end`: dentro del borde, al final (un IconButton sm). `below`: bajo la ayuda. |
| Eventos | `oninput`, `onchange`, `onkeydown`… | Pasan al `<input>` |

### Textarea

Las mismas props que Field salvo `type`, `size`, `icon`, `end` y `below`. Añade `rows` (4) y `maxlength`, que muestra el contador "N de M" y lo resalta al llegar al límite.

### PasswordField

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `label` | `string` | `Contraseña` | |
| `value` | bindable | | |
| `valid` | bindable | | `true` cuando se cumplen las reglas obligatorias |
| `autocomplete` | `'new-password' \| 'current-password'` | `new-password` | Con `current-password` no hay reglas ni medidor |
| `rules` | `PasswordRule[]` | `DEFAULT_PASSWORD_RULES` | `{ id, label, required, test }` |
| `showRules` | `boolean` | según `autocomplete` | |
| `hint`, `error`, `required`, `disabled`, `name`, `id` | | | |

La lógica (`evaluatePassword`) está en `password.ts` y tiene prueba propia. Para confirmar la contraseña se usa un segundo PasswordField con `showRules={false}` y un `error` propio.

### Chip

| Prop | Tipo | |
| --- | --- | --- |
| `kind` | `'filter' \| 'genre' \| 'status'` | Obligatoria |
| `label` | `string` | Obligatoria |
| `onremove(event)` | filter | Todo el chip es un botón con el nombre "Quitar filtro: {label}" (o `removeLabel`) |
| `href` / `onclick(event)` | genre | Enlace o botón. Sin ninguno de los dos, solo texto (24 px). |
| `selected` | genre | `aria-pressed` en un botón y `aria-current` en un enlace |
| `tone` | status | `'neutral' \| 'accent' \| 'warning' \| 'danger'` |
| `disabled` | filter y genre | |

### Pagination

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `page`, `totalPages` | `number` | — | Se acotan a [1, total]. Con `totalPages <= 1` no se renderiza nada. |
| `onchange(page, event)` | | | Con `hrefFor` también se llama: puede hacer `preventDefault()` y navegar con `goto` |
| `hrefFor(page)` | `(n) => string` | — | Cada página es un enlace real (`?p=N`) |
| `variant` | `'full' \| 'compact' \| 'auto'` | `auto` | |
| `size` | `'sm' \| 'md'` | `md` | |
| `label` | `string` | `Paginación` | Nombre del `<nav>`. Debe ser único si hay dos en la página. |

`paginationItems(page, total, siblings = 1)` y `clampPage` están en `pagination.ts`.

### ViewToggle

| Prop | Tipo | Defecto | |
| --- | --- | --- | --- |
| `value` | bindable `'grid' \| 'list'` | `grid` | |
| `context` | `string` | — | Clave que se recuerda (p. ej. `inicio`, `coleccion`). Sin contexto no se guarda. |
| `onchange(mode)` | | | También se llama si al montar recupera un valor distinto |
| `size`, `label` | | `md`, `Vista` | |

Para evitar que la vista cambie después del primer pintado, la vista lee la preferencia antes de renderizar: `let vista = $state(readViewPreference('inicio') ?? 'grid')`. Si el almacenamiento falla, devuelve `null` y la vista usa su valor por defecto.

### Skeleton y LoadingIndicator

- `Skeleton`: `variant: 'card' | 'row'`. Es decorativo (`aria-hidden`) y renderiza un solo elemento; la vista lo repite dentro de su propia grilla.
- `LoadingIndicator`: `label` ("Cargando"), `showLabel` (`true`), `size` (`'sm' | 'md'`) y `decorative`. Lleva `role="status"`.
- Para la carga del catálogo se combinan: un LoadingIndicator más N Skeleton `card` en la grilla de resultados.

### EmptyState y ErrorState

- Props comunes: `message` (obligatoria), `detail`, `actionLabel`, `actionHref`, `onaction(event)` y `size` (`'page' | 'inline'`).
- Snippet `action`: sustituye al botón.
- EmptyState usa `role="status"`. ErrorState usa `role="alert"`, tiene `actionLabel` "Reintentar" por defecto y la prop `retrying` para mostrar el botón ocupado.

### Breadcrumbs

`items: { label, href? }[]`, del más general al actual. El último se marca con `aria-current="page"` y no se enlaza. `label` por defecto: "Migas de pan".

## `/lab`

- Ruta: `src/routes/lab/+page.svelte`, servida en `/lab`.
- No hay ningún enlace a ella y lleva `<meta name="robots" content="noindex, nofollow">`.
- Usa el layout raíz, con header y footer.
- **Sí sale en el build estático:** se puede abrir con la URL en producción. Si el equipo prefiere que solo exista en desarrollo, basta con devolver un 404 cuando `!dev` en un `+page.ts`. Es una decisión pendiente, no un bloqueo.
- El `<select>` de "Ordenar por" de la demostración es provisional y solo existe en `/lab`. U5 no incluye una primitiva Select; el control de orden se rehace en U10, o antes en U6 si el menú lo cubre.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | 92/92 (81 previas más 11 de `ui-primitives`) |
| `npm run lint:tokens` | OK: 111 archivos, 2 excepciones temporales (las de U4; ninguna nueva) |
| `npm run build` | OK, sin avisos |
| `svelte-check` sobre los archivos nuevos | 0 errores y 0 avisos. El resto del repo arrastra errores previos de tipos, fuera del alcance. |
| `tests/browser/u5-lab.spec.ts` | 9/9. Comprueba, a 390 y 1440: <ul><li>sin desborde horizontal y fuera de la navegación;</li><li>objetivo de 44 px en los cuatro lados de cada control interactivo de `/lab` (más de 80);</li><li>foco visible y ayuda con teclado, que Escape oculta;</li><li>chip, paginación y alternancia con teclado;</li><li>contraseña en vivo y mostrar/ocultar;</li><li>ViewToggle recordado tras recargar y funcionando con `localStorage` bloqueado.</li></ul> |
| `npm run test:browser` (2 corridas) | 1.ª: 118 pasan, 5 omitidas y 1 falla (E17:198). 2.ª: 117 pasan y 2 fallan (E17:198 y E17:99). Las dos ya estaban registradas: E17:198 es persistente desde U1 y E17:99 es una carrera de la prueba en paralelo, que pasó 5/5 aislada (`--repeat-each=5`). |
| `npm run visual:compare` | Antes de editar, 0 diferencias. Después, 22 distintas (todas por el icono, abajo) y las 2 nuevas de `/lab` |

**Verificación manual en `/lab`** (capturas a 390 y 1440 revisadas):

- sin desbordes;
- la paginación completa se desplaza dentro de su caja a 390;
- la compacta y "Ordenar por" caben en una línea a 390.

La prueba de los 44 px encontró tres casos, ya corregidos:

- objetivos sm demasiado juntos en Pagination sm y ViewToggle sm;
- chips de género interactivos en filas que se solapaban;
- enlaces cortos de las migas.

También encontró un fallo de la ayuda: no aparecía con el foco porque Svelte limita `:has()` al ámbito del componente. Ya está corregido.

## Capturas que cambiaron

22 capturas distintas de la línea base aceptada de U4. Ninguna cambia de tamaño. Todas las diferencias están dentro de la caja del icono que se cambió:

| Capturas | Zona de la diferencia | Motivo |
| --- | --- | --- |
| `home-D`, `home-full-D`, `home-page2-D`, `home-empty-D`, `home-error-D`, `home-loading-D`, `home-approx-D`, `home-filtered-D`, `home-radar-results-D`, `home-welcome-D`, `header-menu-D` | Botón "Buscar" (124 × 45 px) | 🔍 → SVG `buscar`. El emoji era más ancho que el icono, así que el botón se estrecha unos px y el texto se desplaza dentro de él. La altura no cambia. |
| `home-T`, `home-full-T` | Mismo botón a 834 | Igual |
| `home-search-D`, `home-search-suggest-D`, `home-filtered-panel-D`, `home-radar-D` | Botón "Cerrar búsqueda" (196 × 43 px) | ✖ → SVG `cerrar` |
| `home-beta-D`, `modal-T` | 14 × 12 px detrás del velo | El mismo icono de Buscar, visto a través del diálogo |
| `home-search-tipo-D` | 12 × 11 px | ✔ → SVG `check` en el desplegable Tipo |
| `editorial-admin-D`, `editorial-admin-M` | Columna de 11–22 px en cada tarjeta | ↗ → SVG `flecha-externa` |

**Incidencia en `editorial-colab-D`.** Al capturar solo `lab-D` y `lab-M` se filtró con `-g "lab-(D|M)$"`, y el filtro también coincidió con `editorial-colab-D`. Su línea base se reescribió con el estado de U5 y la previa se perdió. Antes de eso, la comparación había mostrado que solo cambiaba la flecha ↗: una columna de 11 px, igual que en `editorial-admin-D`. Por eso hoy `visual:compare` da 22 diferencias y no 23. El README de la suite ya explica cómo anclar el filtro con un espacio.

## Línea base

- `baseline/darwin/` contiene la línea base aceptada de U4 (recapturada al inicio), más `lab-D` y `lab-M`, más `editorial-colab-D` en su estado de U5 (ver la incidencia). En total, 133 archivos.
- Las 22 diferencias de los iconos **no** se recapturaron, para que la revisión humana las vea con `npm run visual:compare`. El informe queda en `tests/visual/report/informe.md`.
- **Aceptación (2026-10-07):** se ejecutó `npm run visual:capture` (133 capturas) y `visual:compare` dio 0 diferencias. Las 22 diferencias de iconos ya forman parte de la línea base.

## Para U6 y siguientes

- **Foco entre capas.** Ninguna primitiva de U5 lo necesitó, así que no queda nada aparcado para U6 por ese motivo. Dos cosas a tener en cuenta:
  - Dentro de un `dialogOverlay`, el primer Escape cierra el diálogo, porque `overlay.ts` escucha en captura. La ayuda de IconButton desaparece con él.
  - El Menu "…" de U6 debe usar `IconButton icon="mas-opciones"` como disparador y pasar su `element` como `trigger` de `dropdownMenu`.
- **SocialLinks (U6):** los iconos ya existen (`SOCIAL_ICONS`, en el orden de D1). Las URL salen de `src/lib/domain/profileSocial.ts`.
- **Header y footer (U7):**
  - icono de menú: `menu`;
  - Salir: `Button variant="ghost" icon="salir"` (interpretación I2);
  - Sugerir: `agregar`.
  
  Los `<img>` de `static/img` con `filter` (manual, substack, blog, sugerir) pueden pasar al registro de iconos con su viewBox, como Instagram.
- **Glifos tipográficos que quedan como icono.** No son emoji según el criterio de arriba. Cada uno se sustituye cuando su vista migre:

  | Glifo | Dónde | Etapa |
  | --- | --- | --- |
  | `‹ ›` | `components/Pagination.svelte` | U10 (pasar a `$lib/ui/Pagination`) |
  | `⌄` | `home/MobileFilterSheet.svelte` (CSS `content`) | U10 |
  | `← Volver` | `artista`, `sello` (migas) | U11 |
  | `← Volver` / `→` | `lanzamiento/[slug]`, `ReleaseRecommendations` | U9 |
  | `✓` | `AddToCrateButton` | U9 |
  | `✕`, "Copiado ✓" | `coleccion/[slug]` | U14 |
  | `✕` | `manual` (cerrar) | U7 (layout de lectura) |
  | `←`, `♪`, `✎`, `⇄`, `×`, `⌕`, `›`, `＋`, `✓`, `!`, `→` | `admin/catalogo` | U15–U16 |

- **Chip de la tarjeta** (21.8 px) y **botón compartir de la tarjeta** (22 px): siguen fuera de escala. Son de U8. El chip de género con texto mide 24 (`--chip-h-sm`); si la tarjeta lo enlaza, sube a 32.
- **Lint.** Las primitivas no añadieron excepciones. Las alturas de control siguen fuera del lint (U4); las primitivas las toman de `--button-h-*`, `--field-h-*` y `--chip-h-*`.

## Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| Cada primitiva sale solo de tokens de U4 | Cumplido. Las que faltaban se añadieron a `tokens.css` (tabla de arriba). |
| El lint pasa | Cumplido, sin excepciones nuevas |
| `/lab` a 390 y 1440 | Cumplido (prueba automatizada y revisión de capturas) |
| Teclado y foco | Cumplido (prueba automatizada) |
| Objetivos táctiles de 44 px | Cumplido en todos los controles de `/lab` (prueba automatizada) |
| Emoji retirados, solo con cambio de icono | Cumplido. 22 capturas, todas acotadas al icono. |
| `npm run build` y suite visual | Cumplido |

## Rollback

Sin datos ni migraciones.

1. Borrar `src/lib/ui/{Icon,Button,IconButton,Field,Textarea,PasswordField,Chip,Pagination,ViewToggle,Skeleton,LoadingIndicator,EmptyState,ErrorState,Breadcrumbs}.svelte`, `src/lib/ui/{icons,pagination,password,viewPreference,index}.ts`, `src/routes/lab/`, `tests/ui-primitives.test.mjs` y `tests/browser/u5-lab.spec.ts`.
2. Quitar el bloque "Primitivas (U5)" de `tokens.css`.
3. Devolver el emoji en tres archivos:
   - `HomeSearchToggle.svelte`: `🔍 Buscar` y `✖ Cerrar búsqueda`, y quitar `display: inline-flex`, `align-items` y `gap` del botón;
   - `Filtros.svelte`: `<span class="tick">✔</span>` y la regla `.tick` anterior;
   - `editorial/+page.svelte`: ` <span aria-hidden="true">↗</span>` y quitar `.source-link__icon`.
4. Quitar `tests/ui-primitives.test.mjs` de `npm test` en `package.json`, y `lab` de `censo.spec.ts`. Borrar `baseline/darwin/lab-*.png` y ejecutar `npm run visual:capture -- -g " editorial-colab-D$"` para regenerar esa captura.
