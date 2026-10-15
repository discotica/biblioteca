# U18 — QA de interfaz, puntos 1–4 (2026-10-14)

Paso 4 del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md#paso-4--u18-qa-de-interfaz): la etapa [U18](../producto/plan-interfaz-2026-10-04.md#u18--qa-integral-y-candidato), puntos 1 a 4, en local. Claude Opus 5.5, esfuerzo `xhigh`. El recorrido en staging y el dictamen GO/NO-GO pasan al paso 11 (E21-rc2): **aquí no hay dictamen de despliegue.**

Estado: **expediente aceptado el 2026-10-14.** Las correcciones son el paso 5 y se anotan en "Estado de los hallazgos". No se tocaron staging ni producción. Las comprobaciones manuales (iPhone y VoiceOver) siguen pendientes y se anotarán aquí.

## Estado de los hallazgos (paso 5)

| Hallazgo | Severidad | Estado |
| --- | --- | --- |
| H1 — header y «Buscar» no se quedan arriba | P1 | **Corregido** el 2026-10-14 (grupo "Scroll y header"). Ver "Paso 5 · H1". |
| H2 — `login-with-username` sin límite de intentos | P1 | **Corregido** en local el 2026-10-14 (grupo "Seguridad de acceso"). **En staging** desde el paso 7 (migración y función v4), con las tres comprobaciones hechas. Ver "Paso 5 · H2" y "Paso 7 · H2 en staging". |
| H3 — país y sello por debajo de 44 px | P1 | Abierto. Grupo "Objetivos táctiles". |
| H4, H6, H7, H8, H9, H13, tokens del radar | P2 | Abiertos. Grupo "Menores". |
| H10, H11, H12 | P2 | Abiertos. Grupo "Objetivos táctiles". |
| H14 — huecos del censo | P2 | Abierto. Grupo "Censo". |
| **H15 — paginar desde abajo no sube a la grilla** (nuevo) | P2 | **Corregido** con H1. |
| "Mejor coincidencia" a 360; aviso al salir de Sugerir | P2 | Sin decidir; el equipo los deja para después (2026-10-14). |

## Resumen

- **P0:** ninguno.
- **P1:** tres.
  - El header y la barra de búsqueda no se quedan arriba fuera del Estudio (H1).
  - `login-with-username` no tiene límite de intentos propio (H2).
  - Los enlaces de país y sello de la tarjeta miden 17 px de alto, sin excepción registrada (H3).
- **P2:** diez, más la cobertura del censo (H14).
- **Comprobaciones globales:**
  - ninguna barra de scroll nativa;
  - ningún "crate";
  - ningún emoji.
  - **Códigos internos:** solo en `/lab`, que hoy entra en el build de producción (H7).
- **Visual:** 182 de 182 iguales a la línea base de U17.
- **Tokens:** OK, con las dos excepciones de los radares SVG.
- **Suites:** ver "Suites".
- **Pendiente de ti:** la lista corta de comprobaciones manuales (iPhone y VoiceOver). Las cuatro decisiones ya están tomadas (ver "Decisiones").

## Arranque

- `git status --short`: limpio. Rama `modernizacion-2026` en `8ef1eef`.
- **Leído:**
  - U18 y las secciones 4, 6 y 7 del plan de interfaz;
  - la ronda 3 de `decisiones.md`;
  - `estado.md` y `tests/visual/README.md`;
  - los relevos de U4–U17 y los "para U18" de D3, S3 y U9–U17.
- **CI del PR** (corrida `38584961769`, commit `8ef1eef`): verde, 314 pasan y 5 omitidas. Los `[404] GET /img/no-existe.jpg` y `/ruta-inexistente` del log son pruebas que piden a propósito una portada rota y una ruta inexistente.

## Método

Todo corre en local y sin red: la suite visual usa un Supabase simulado (`tests/visual/support/mocks.ts`) y la misma configuración que `visual:compare`.

- **Visual:** `npm run visual:compare`.
- **Auditoría automática** (archivos en el scratchpad de la sesión; no se versionan):
  - recorre los **182 estados del censo**, con los mismos roles, mocks e interacciones, más **21 estados extra**: ficha a 680 y 1112, ficha página a 834, y vistas sin captura a 834;
  - 203 estados en total, con `prefers-reduced-motion: reduce`, como el censo.
- **En cada estado mide:**
  - **textos** visibles, solo para lector, atributos (`aria-label`, `title`, `placeholder`, `alt`…) y `<title>`: "crate", emoji (`Extended_Pictographic`, sin ©/®/™) y códigos internos (`E06`, `U4`, `R2`, `D1`…);
  - **contraste** de cada nodo de texto visible contra su fondo efectivo: capas de fondo compuestas y opacidad acumulada. Se miden también los placeholders;
  - **scroll:** cada contenedor que desplaza, con su `scrollbar-width` y `scrollbar-color`;
  - **movimiento:** animaciones y transiciones CSS de más de 20 ms, y animaciones WAAPI en curso;
  - **objetivos táctiles:** área efectiva medida con `elementFromPoint` alrededor del centro de cada control. Así incluye la ampliación con pseudo-elementos de `IconButton`. Tolerancia de ±2 px por redondeo;
  - **teclado:** Tab desde el inicio hasta cerrar el ciclo (40 pulsaciones en estados con interacción previa y 160 en el resto). En cada parada registra si hay indicador de foco (propio, o un cambio visible en el control o sus dos ancestros), si queda a la vista y si el foco cae en algo oculto.
- **Sondas dirigidas** para confirmar o descartar lo que la auditoría marcó: sticky con `overflow-x: clip` inyectado, vuelta del ciclo de Tab al header, y foco en campos del Estudio.
- **Lectura de código** para lo que no se mide en el navegador: animaciones por JavaScript, mensajes de error y la función `login-with-username`.

**Límites de la auditoría:**

- Chromium sin interfaz, sin WebKit.
- Las barras de scroll no se ven en headless: se comprueba el CSS, no el píxel.
- El contraste no mide texto sobre imágenes (portadas) ni el `fill` de los SVG.
- El indicador de foco se infiere por estilos, no por píxeles. Los dos patrones dudosos se confirmaron con captura.

## 1. Visual

`npm run visual:compare` contra `tests/visual/baseline/darwin/` (U17):

- **182 capturas: 182 iguales, 0 diferentes, 0 inestables, 0 errores.** 138 s.
- **La prueba "el censo conserva sus 127 IDs" pasa** (183 de 183). `estado.md` todavía la daba por fallida desde U7; ya no lo está.
- `lab-u6-M` y `lab-u8-M`, que tenían antialiasing intermitente, dieron iguales.

### Matriz del censo

Columnas: 390 (M), 834 (T) y 1440 (D). ✓ = hay captura; · = falta.

| Vista | 1440 | 834 | 390 | Roles capturados | Falta |
| --- | --- | --- | --- | --- | --- |
| Inicio (bienvenida, beta, grilla, lista, carga, error, vacío, aproximados, filtrado, radar, paginación) | ✓ | ✓ (grilla y página completa) | ✓ | anónimo; comunidad (header, menú de cuenta) | **panel de búsqueda abierto a 834** (patrón tablet de U10b, radar apilado), beta a 834, header de admin y de colaborador |
| Hoja de filtros móvil | — | — | ✓ (4 estados) | anónimo | — |
| Tarjeta (grilla, hover, colaboradores, "Varios artistas", fila) | ✓ | ✓ (fila) | ✓ (fila) | anónimo | — |
| Ficha modal | ✓ (+1100) | ✓ (+1112 apaisada) | ✓ | anónimo; comunidad ("Añadir a colección", solo 1440) | **680**; con sesión a 390 (barra fija con "Añadir a colección") |
| Ficha página | ✓ | · | ✓ | anónimo | **680, 834 y 1112** |
| Artista, sello | ✓ | · | ✓ | anónimo | 834 |
| Entrar, registro, recuperar, restablecer, "Revisa tu correo" | ✓ | · | ✓ | anónimo | 834 |
| Editar cuenta | ✓ | · | ✓ | comunidad | 834; estados guardado y error |
| Sugerir | ✓ | · | ✓ | anónimo, comunidad, admin | 834; colaborador; error de detección |
| Reportar | ✓ | · | ✓ | anónimo (1440), comunidad | 834; envío correcto |
| Mis colecciones, colección | ✓ | ✓ | ✓ | comunidad; visitante (colección) | — |
| Perfil | ✓ | · | ✓ | comunidad, visitante, admin (1440), colaborador (390) | 834; perfil inexistente |
| Mis aportes | ✓ | · | ✓ | anónimo (1440), comunidad | 834; vacío |
| Estudio · Catálogo | ✓ | ✓ | ✓ | admin; anónimo, comunidad y colaborador (1440) | — |
| Estudio · Propuestas | ✓ | ✓ | ✓ | admin; colaborador y anónimo (1440) | colaborador a 390; bandeja vacía |
| Estudio · Reportes | ✓ | · | ✓ | admin | 834; vacío |
| Manual | ✓ | · | ✓ | anónimo | 834 |
| Privacidad | ✓ | · | · | anónimo | 390 y 834 |
| 404 | ✓ | · | ✓ | anónimo | 834 |
| `/lab` | ✓ | — | ✓ | — | (interno) |
| Correos (confirmación, restablecer) | ✓ | — | — | — | — |

- **Fuera de las capturas:**
  - las redirecciones (`/admin/catalogo`, `/editorial`, `/mis-crates`, `/crate/…`, `/estudio`) las cubren las pruebas de navegador;
  - la ficha a 680 y 767/768 la cubre `u9-ficha.spec.ts` (matriz geométrica), pero sin captura.
- **Carga y error con captura:** solo en el inicio. No hay estados de carga ni de error de perfil, colección, ficha página ni Estudio.
- **Los 21 estados extra** pasaron por la auditoría de accesibilidad y textos, pero no tienen captura.
- **Propuesta en H14.**

## 2. Tokens

`npm run lint:tokens`: **OK, 175 archivos, 2 excepciones temporales** (`scripts/lint-tokens.exceptions.json`).

| Archivo | Literal | Motivo registrado |
| --- | --- | --- |
| `src/lib/components/RadarMini.svelte:136` | `font-size="7"` | Letras de los ejes en unidades del `viewBox` (`0 0 120 130`), no en px: escalan con el dibujo. |
| `src/lib/components/RadarVisual.svelte:85` | `font-size="7"` | El mismo caso, en el radar del panel de filtros. |

**Propuesta para cerrarlas (paso 5, Sonnet 5.5 `medium`):**

1. Un token en `tokens.css`, documentado como "unidades del `viewBox` de los radares": `--radar-axis-label: 7px`.
   - Dentro de un SVG, `px` en CSS son unidades de usuario.
   - `font-size: 7px` en CSS es por tanto idéntico a `font-size="7"`: el dibujo no cambia.
2. Una clase `.radar__eje { font-size: var(--radar-axis-label); fill: var(--color-acento); }` en lugar del atributo y del `style` inline, en los dos componentes.
3. `npm run lint:tokens -- --prune` vacía la lista de excepciones.
4. `visual:compare` debe dar 0 diferencias.

`RadarMini` y `RadarVisual` comparten el `viewBox`, las etiquetas y la geometría (son casi el mismo componente). Unificarlos es opcional y no hace falta para cerrar el lint.

## 3. Accesibilidad

### Teclado

- **203 estados recorridos con Tab.**
  - 167 cierran el ciclo completo (vuelven a la primera parada).
  - Los 36 restantes alcanzan el tope de pulsaciones sin que el foco se atasque: son las páginas largas (catálogo, Estudio, `/lab`).
- **Ninguna trampa de foco:**
  - el foco nunca se queda en un mismo elemento;
  - ningún `tabindex` positivo;
  - ningún foco en elementos ocultos.
- **Indicador de foco:** presente en todas las paradas.
  - La auditoría marcó cuatro campos del Estudio como "sin indicador". La sonda dirigida lo descarta: `input.ui-field__input` muestra `outline: 2px solid` y el anillo de acento (captura comprobada).
  - Era un falso positivo: el campo ya tenía el foco al tomar la referencia.
- **Header "fuera de vista" al volver al principio del ciclo:** Una veintena de estados marcaron el logo o "Sugerir" fuera de la vista justo después de volver al header. La sonda (`registro-D`), esperando 600 ms tras el Tab, da el header visible (`site-header` sin `oculto`, logo en y = 14). Es un artefacto de medir antes del evento `scroll`.
- **Coste de recorrido:**
  - el inicio a 1440 tiene 129 paradas por página de resultados, unas 9 por tarjeta (créditos, título, compartir, país, sello y géneros);
  - no hay "Saltar al contenido" (H9).
- **Combobox, menú, diálogo, hoja y ordenable:** con teclado los cubren las pruebas de U6 (`u6-lab.spec.ts`), U10b, U14, U16 y U17, todas en verde (ver "Suites").

### Contraste (≥ 4.5:1)

**26 754 nodos de texto medidos** en los 203 estados, más los placeholders.

| Resultado | Dónde | Lectura |
| --- | --- | --- |
| 2,86:1 y 2,81:1 | `span.datos__sep` ("·") de la tarjeta y de la fila (`DatosLanzamiento.svelte:27`) | **Exento:** separador decorativo con `aria-hidden="true"`. No es hallazgo. |
| 2,8–2,9:1 | botones, chips y casillas **deshabilitados** (`/lab`, "Reenviar correo" en espera, "Publicar 3" del lote) | **Exento** (WCAG 1.4.3 excluye controles inactivos). |
| < 4.5 en texto activo | — | **Ninguno.** |
| No medible | — | 0 nodos con fondo de imagen o degradado. |

**No medido:**

- las letras de los radares sobre la portada (SVG con `fill` de acento, sobre una imagen);
- los reproductores (iframes de terceros).

### Objetivos táctiles (44 px)

Agrupado por componente. "Efectiva" es el área que responde al toque. El contrato pide 44 px (sección 6.5 del plan); WCAG 2.5.8 (AA) pide 24 px, o el mismo espacio libre alrededor.

| Control | Archivo | Caja → efectiva (mín.) | Anchos | Lectura |
| --- | --- | --- | --- | --- |
| Nombres de créditos de la tarjeta | `ui/CreditLine.svelte` | 15 px de alto | todos | **Excepción "en línea" de U6** (`decisiones.md`, U6). No es hallazgo. |
| Nombres de créditos de la ficha | `ui/CreditLine.svelte` (`ui-credits__name`) | 19 → 22 px | todos | Misma excepción. |
| **País y sello de la línea de datos** (tarjeta y fila) | `lanzamiento/DatosLanzamiento.svelte` | **17 px de alto, desde 21 px de ancho, separados por "·"** | todos, también 390 | **H3 (P1).** Sin excepción registrada. |
| Título de la tarjeta | `LanzamientoCard.svelte` | 28 → 28–44 px | todos | H10 (P2). La portada es un objetivo equivalente mayor. |
| Título de la fila (modo lista) | `LanzamientoFila.svelte` | 16 px | todos | H10 (P2). Mismo caso. |
| País de la ficha (`dd > a`) | `ReleaseDetail.svelte` | 16 → 36 px | todos | H11 (P2). |
| Chips de género de la ficha | `ReleaseDetail.svelte` | 24 px | 834 | H11 (P2). |
| Nube de países del filtro | `Filtros.svelte` (`.tag`) | 24 → 32 px | 1440 y hoja a 390 | H11 (P2). |
| Aleatorizar / Limpiar en la hoja | `RadarFiltros.svelte` | 32 → 34 px | 390 | H11 (P2). |
| Enlaces del pie | `Footer.svelte` | 19 → 40 px | 390 | H11 (P2). |
| Puntos del radar del panel | `Filtros.svelte` (`.pip`) | 24 → 24 × 38 px | 1440 (cursor) | Con el dedo son 40 × 44 o 44 × 44 (U10b). No es hallazgo. |
| Estudio: mover crédito, señal "1 reporte", "Abrir en el editor" | `estudio/EditorCredits.svelte`, `estudio/catalogo/+page.svelte` | 32 / 16 / 19 px | todos | H12 (P2, herramienta interna). |
| `IconButton` (compartir, paginación, vista, quitar chip) | `ui/IconButton.svelte` | 32 → 42–44 px | todos | Cumple (±2 px). |

### `prefers-reduced-motion`

- **CSS:** con `reduce`, ningún elemento de los 203 estados tiene animación ni transición de más de 20 ms (regla global de `styles.css:83`). Tampoco hay animaciones WAAPI en curso.
- **JavaScript:**
  - el scroll suave (`+page.svelte`, `coleccion`, `CatalogEntityPage`, `ReleaseEditor`), las chips que viajan (`ActiveSearchPills`) y el cierre del panel (`HomeFilterPanel`) comprueban `matchMedia` y no animan;
  - **excepción:** `RadarVisual.svelte` interpola la forma del radar 300 ms con `tweened`, sin comprobar la preferencia (H4).

### Comprobaciones manuales (pendientes de ti)

Lista corta. Para cada punto, dime "OK" o qué viste; registro los resultados en este expediente.

**En un iPhone real (Safari):**

1. **Doble toque del radar:** en el inicio, tocar una portada muestra el radar; un segundo toque abre la ficha; deslizar sobre la portada desplaza la página sin abrir nada.
2. **Ficha, área segura y barra:** abrir una ficha. La barra de acciones queda pegada abajo, sin tapar el indicador de inicio y sin hueco bajo ella. Girar a horizontal y volver.
3. **Banda de filtros:** con dos o más filtros activos, la banda de chips bajo la barra se desliza en horizontal sin mover la página ni mostrar barra de scroll.
4. **Hoja de filtros:** "Filtros" abre la hoja y asoma la parte de arriba del radar. Arrastrar hacia abajo la cierra. El teclado al escribir no tapa el campo. El selector nativo de País u Orden se abre bien.

**Con VoiceOver** (iPhone o Mac):

5. **Ficha:** al abrir se anuncia el título; los créditos se leen por rol; Comprar, Añadir a colección, Compartir y Reportar tienen nombre; cerrar devuelve a la tarjeta.
6. **Filtros:** la región "Catálogo" se anuncia; al aplicar un filtro se anuncia "N lanzamientos".
7. **Combobox** (géneros en Sugerir o en el editor del Estudio): se anuncian la lista, la opción activa y la chip añadida o quitada.
8. **Ordenable** (reordenar una colección propia desde el asa): se anuncian la posición inicial, el movimiento y la posición final.

**Opcional, en Safari de Mac** con "Mostrar barras de desplazamiento: siempre": las barras son finas y en la paleta. Safari usa la variante `::-webkit-scrollbar` de `styles.css:37`, que el navegador headless no ejercita.

## 4. Comprobaciones globales

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Ninguna barra de scroll nativa visible | **Cumple** | 17 tipos de contenedor con scroll en los 203 estados, todos con `scrollbar-width: thin` y `scrollbar-color` de la paleta, o con `none` (bandas de chips). La página no desborda en horizontal en ningún estado. Safari: comprobación manual opcional. |
| Ningún "crate" en la interfaz | **Cumple** | 0 coincidencias en texto visible, texto para lector, atributos y `<title>`. En el código, "crate" solo aparece en identificadores y en un mensaje de error interno que no llega a la vista (`catalogoStore.ts:201`; quien lo llama lo captura). |
| Ningún emoji como icono | **Cumple** | 0 emoji en los 203 estados ni en `src/`. Queda la flecha tipográfica "→" de las recomendaciones (H13). |
| Ningún código interno en los textos | **Cumple fuera de `/lab`** | En `/lab`: "U10", "U15", "R2", "D1" en notas y títulos (H7). En el resto, solo "D1$", que es el nombre de un sello del catálogo (dato, no código). **Riesgo aparte:** mensajes de la base en inglés que pueden llegar a la vista (H6). |

## Hallazgos

Severidad: **P0** bloquea el lanzamiento, **P1** se corrige antes, **P2** puede esperar.

### H1 — El header y la barra de búsqueda no se quedan arriba fuera del Estudio · P1 · decidido

- **Origen:** `styles.css` del repositorio original. Documentado en U9, U10 y U16; el arreglo global se asignó a U18.
- **Archivo:** `src/lib/styles/styles.css:6-23`.
- **Causa:** `html, body { overflow-x: hidden }` convierte a `body` en un contenedor de scroll que nunca se desplaza, y eso anula todo `position: sticky`. U16 lo arregló solo en el Estudio (`html.is-tool` con `clip`).
- **Evidencia** (sonda en 11 vistas × 390 y 1440, desplazando hasta 1200 px):
  - **hoy:** el header sube con la página (`top` = −1276 a 1200 px en el inicio, la cuenta y el manual; −304 en la ficha página). La barra de búsqueda móvil (`.mobile-search-anchor`) y el índice del manual (`nav.l-reading__toc`) declaran `sticky` y tampoco lo son;
  - **con `html, body { overflow-x: clip }`:** el header queda fijo y aplica el comportamiento de E14 (se oculta al bajar, `top` = −76, y está visible tras un desplazamiento corto, `top` = 0 en Sugerir);
  - **desborde horizontal:** 0 px en las 22 combinaciones, así que `clip` recorta lo mismo que `hidden`;
  - **Estudio:** sin cambios.
- **Impacto:** E14 (header que se oculta y reaparece), E15 y U10 (línea «Buscar» fija en móvil) y el índice del manual no funcionan como se decidieron.
- **Propuesta:** `clip` en `html, body`, y borrar el caso especial `html.is-tool`.
  - Revisar las pruebas de E14 y E15. Cambiarán al menos `home-scrolled-M` (U9 midió además `admin-finder-D` y `lab-u6/u7/u8`).
  - Revisar si `dockBar` de la ficha (U9) puede pasar a `sticky`.
  - Recapturar.
  - Opus 5.5 `high` (scroll y header).
- **Decisión tuya:** activa el header fijo en todo el sitio. Recomendación: sí; es el diseño de E14 y lo que asumen E15 y U10.

### H15 — Paginar desde abajo no sube a la grilla · P2 · corregido

- **Origen:** E12/E13 (orquestación de la URL del inicio). Encontrado al corregir H1; ya pasaba en `559058b`.
- **Archivo:** `src/routes/+page.svelte` (`irAPagina`).
- **Causa:** el desplazamiento suave a la grilla empezaba antes de `goto`; al terminar, `goto` con `noScroll` devuelve el scroll a donde estaba y lo cancelaba. Con `prefers-reduced-motion: reduce` el salto es instantáneo y sí funcionaba.
- **Evidencia:** sonda a 1440 sin movimiento reducido: tras "Página siguiente" abajo, `scrollY` sigue en 2153 y la grilla queda en y = −1537.
- **Arreglo:** primero la URL (`await navegarEstado()`) y después el desplazamiento.

### H2 — `login-with-username` no tiene límite de intentos propio · P1

- **Origen:** la función es previa a la ronda 3; U12 detectó el hueco.
- **Archivo:** `supabase/functions/login-with-username/index.ts`.
- **Evidencia (lectura de código):**
  - ninguna cuenta de intentos por usuario ni por IP;
  - la función llama a `/auth/v1/token` desde el servidor sin reenviar la IP de quien entra. El límite por IP de Auth se aplicaría entonces a la IP del runtime de la función, compartida por todas las personas que entran con usuario;
  - **consecuencias si se confirma:**
    - fuerza bruta contra un usuario limitada solo por ese tope global;
    - quien lo agote bloquea el acceso con usuario de todos;
  - **enumeración por tiempo:** un usuario inexistente responde sin llamar a `/token` (respuesta rápida), y uno existente sí la llama. El texto del error es igual en los dos casos, pero el tiempo no.
- **No verificado:** qué IP ve Auth. Exige staging, que este paso no toca.
- **Propuesta (paso 5, Opus 5.5 `high`):**
  - tabla `private.login_attempts` (escritura solo con `service_role`), con límites por usuario (p. ej. 5 fallos en 15 min) y por IP de quien llama (p. ej. 20 en 15 min, desde `x-forwarded-for` de la petición a la función);
  - el mismo trabajo y la misma latencia para usuario inexistente y contraseña incorrecta;
  - verificar en staging qué IP ve Auth antes y después.
- **Despliegue:** la función se despliega en staging y producción. Entra en el orden de los pasos de staging.

### H3 — País y sello de la tarjeta, por debajo del objetivo táctil · P1 · decidido

- **Origen:** U8 (tarjeta) y U10 (fila del modo lista).
- **Archivo:** `src/lib/components/lanzamiento/DatosLanzamiento.svelte`.
- **Evidencia:**
  - **tamaño:** 17 px de alto, desde 21 px de ancho, en la grilla y en la lista, a 390, 834 y 1440. Unos 960 casos en los 203 estados;
  - **separación:** "·" con `gap: var(--space-1)`, así que los dos objetivos quedan a pocos píxeles. No cumple los 44 px del contrato, ni los 24 px de WCAG 2.5.8;
  - **sin objetivo equivalente:** filtrar por país o abrir el sello no tiene otro control en la tarjeta;
  - **sin excepción registrada:** la de U6 cubre los nombres de créditos, no esta línea.
- **Propuesta:**
  - **opción A (recomendada):** ampliar el área táctil en vertical hasta 44 px con un pseudo-elemento, sin cambiar el layout. Exige mover el `overflow: hidden` del truncado a un `span` interior, porque hoy recortaría el pseudo-elemento. En horizontal, el área de cada enlace termina en el "·";
  - **opción B:** registrar en `decisiones.md` que la línea de datos se acoge a la excepción "en línea", como los créditos. Pasaría a P2.
- **Decisión tuya:** A o B.

### H4 — El radar de filtros anima aunque se pida menos movimiento · P2

- **Origen:** preexistente (radar del panel); U10 lo reutilizó.
- **Archivo:** `src/lib/components/RadarVisual.svelte:19-24`.
- **Causa:** `tweened` con `duration: 300` y sin comprobar `prefers-reduced-motion`. La regla global de CSS no lo alcanza porque la animación es por JavaScript.
- **Propuesta:** `duration: 0` si `matchMedia('(prefers-reduced-motion: reduce)')` coincide, como `HomeFilterPanel`.

### H5 — (descartado) Contraste del separador "·"

Separador decorativo con `aria-hidden`; está exento. Se deja anotado para que no se vuelva a marcar.

### H6 — Mensajes de la base en inglés pueden llegar a la vista · P2

- **Origen:** servicios de E06, E09 y E18.
- **Archivos:**
  - `src/lib/stores/contributionsStore.ts:75`, `src/lib/services/{adminCatalog.ts:105,problemReports.ts:33,profiles.ts:39}`;
  - las vistas que muestran `cause?.message`: `sugerir/+page.svelte` (203, 219, 346, 375), `reportar/+page.svelte:87`, `estudio/propuestas` y `estudio/reportes`, y `ReleaseEditor.svelte`.
- **Evidencia:**
  - `rpcError`/`fail` copian `error.message` de Supabase tal cual;
  - las excepciones de las migraciones están en inglés ("Catalog version conflict", "Only the author may submit a contribution", "A reviewer note is required", 30 veces "Administrative role required");
  - un fallo de red llega como "TypeError: Failed to fetch";
  - solo `ReleaseEditor` traduce dos códigos (`P0002`, `42501`).
- **Impacto:** casos límite (sesión caducada, carrera, red), pero en Sugerir y Reportar los ve la comunidad.
- **Propuesta:**
  - un traductor de errores compartido: los códigos conocidos (`40001`, `42501`, `P0002`, `22023`…) dan su texto en español, y el resto da el mensaje por defecto de la vista;
  - nunca mostrar `error.message` crudo;
  - Sonnet 5.5 `medium`.

### H7 — `/lab` está en producción · P2 · decidido

- **Origen:** U5.
- **Archivos:** `src/routes/lab/+page.svelte`, `src/routes/lab/samples.ts`.
- **Evidencia:**
  - `npm run build` la incluye (`build/_app/immutable/nodes/20.*.js`, 53 KB), y `/lab` responde con la app como cualquier ruta;
  - lleva `noindex, nofollow` y no está enlazada;
  - muestra códigos internos ("U10", "U15", "R2", "D1") en notas y títulos, contra la regla 6 del contrato.
- **Propuesta:**
  - solo en desarrollo: `src/routes/lab/+page.ts` con `if (!dev) error(404)` (`$app/environment`). La suite visual y `u5-lab`/`u6-lab` corren con `vite dev`, así que no cambian;
  - de paso, se puede añadir el Field fecha y el Select con ayuda y error que pidió U13.
- **Decisión tuya:** el plan de lanzamiento recomienda "solo en desarrollo".

### H8 — La ayuda de "Nota interna" promete algo que no pasa · P2 · decidido

- **Origen:** E09/E10; U17 lo registró.
- **Archivo:** `src/routes/estudio/propuestas/+page.svelte:288` (`hint="Evidencia o contexto para administración."`).
- **Evidencia:** E09 guarda la nota en `private.contribution_preparations`, que administración no puede leer.
- **Impacto:** bajo hoy. Solo la ve el rol colaborador, y staging no tiene ninguna cuenta con ese rol.
- **Propuesta:**
  - ahora, cambiar el texto. Por ejemplo, etiqueta "Nota interna (opcional)" y ayuda "Queda en el registro de la propuesta; administración todavía no la ve.";
  - después del lanzamiento, abrir el caso de E09 (Opus 5.5 `xhigh`) para que el admin la lea.
- **Decisión tuya:** el texto, o abrir E09 antes.

### H9 — No hay "Saltar al contenido" · P2

- **Origen:** U7 (shell).
- **Archivos:** `src/routes/+layout.svelte`, `src/lib/components/Header.svelte`.
- **Evidencia:**
  - en las vistas públicas, el header suma 4–5 paradas antes del contenido;
  - en el Estudio se suma la barra lateral;
  - el inicio tiene unas 9 paradas por tarjeta.
- **Propuesta:** un enlace visible al recibir el foco, que lleve a `<main>`.

### H10 — Títulos de la tarjeta y de la fila, por debajo de 44 px · P2

- **Origen:** U8 y U10.
- **Archivos:** `LanzamientoCard.svelte`, `LanzamientoFila.svelte`.
- **Evidencia:** 28 px (tarjeta) y 16 px (fila) de alto.
- **Lectura:** cumple WCAG 2.5.8 por equivalencia, porque la portada abre lo mismo con un objetivo mayor. No cumple los 44 px del contrato.
- **Propuesta:** ampliar en vertical con el mismo patrón que H3, si se elige la opción A.

### H11 — Otros controles públicos entre 24 y 44 px · P2

- **Origen:** U9, U10 y U7.
- **Controles** (detalle en la tabla de objetivos):
  - país de la ficha, 36 px;
  - chips de género de la ficha, 24 px a 834;
  - nube de países, 32 px;
  - Aleatorizar y Limpiar en la hoja, 34 px;
  - enlaces del pie a 390, 40 px.
- **Propuesta:** ampliar el área efectiva con el patrón de `IconButton`, sin cambiar el aspecto.

### H12 — Estudio: controles compactos por debajo de 44 px · P2

- **Origen:** U15 y U16. La densidad compacta es una decisión del Estudio.
- **Archivos:** `estudio/EditorCredits.svelte` (mover crédito, 32 px efectivos de ancho entre botones vecinos), `estudio/catalogo/+page.svelte` (señal "1 reporte", 16 px de alto), lote ("Abrir en el editor", 19 px).
- **Propuesta:** dejarlo así salvo el editor a 390, que sí se usa con el dedo (U16, "móvil edita").

### H13 — Flecha tipográfica como icono · P2

- **Origen:** E17.
- **Archivo:** `src/lib/components/ReleaseRecommendations.svelte:50`.
- **Evidencia:** `<span aria-hidden="true">→</span>` es un carácter, no un SVG ("Iconos solo en SVG"). No es un emoji.
- **Propuesta:** el icono SVG equivalente de `ui/icons.ts`.
- Las flechas de "Título A → Z" y de las ayudas de teclado son texto, no iconos.

### H14 — Huecos de cobertura del censo visual · P2

- **Origen:** U1 y cada etapa.
- **Archivo:** `tests/visual/censo.spec.ts`.
- **Evidencia:** la matriz de arriba.
- **Propuesta:** añadir en el paso 5, al recapturar, solo lo que protege decisiones de geometría:
  1. ficha modal a 680;
  2. ficha página a 680, 834 y 1112;
  3. panel de búsqueda abierto a 834 (patrón tablet de U10b);
  4. ficha modal a 390 con sesión (barra con "Añadir a colección");
  5. bandeja de Propuestas del colaborador a 390;
  6. un estado de error de colección o de perfil.

  Son unas 8 capturas suplementarias. El resto de vistas a 834 lo cubre la auditoría, sin captura.

### Pendientes de otras etapas, comprobados aquí

| Pendiente | De | Estado |
| --- | --- | --- |
| Conteo de los 127 IDs del censo | U7/U9 | **Resuelto**: la prueba pasa (183/183 en `visual:compare`). |
| Intermitencia de historial de E19 (`beta` persiste tras Atrás) | U11 | Sin fallos en las corridas de este paso (ver "Suites"). No se buscó a propósito. |
| Entrada de historial de más con una URL no canónica (`/?genero=Ambient`) | S3 | Sin re-verificar. Orquestación de E12/E17; P2. |
| "Mejor coincidencia" se corta a 360 | U10 | Sin decidir. P2: aceptar, o acortar a "Coincidencia". |
| Aviso al salir de Sugerir con datos sin guardar | U13 | Decisión de producto. P2. |
| Doble anillo de foco en el Combobox al escribir | U16 | Sin re-verificar. La sonda solo capturó un campo simple del editor, que muestra un único anillo. |
| *Redirect URLs* de producción (`/auth/reset`) | U12 | Para E22. No es interfaz. |
| WebKit / Safari | U9, U10, U13 | Solo en la lista manual (no hay WebKit instalado). |

## Suites

Local, Node 22.18, con `.env.local`. Servidor `vite dev` en 127.0.0.1:4173 levantado aparte y calentado (las pruebas lo reutilizan).

| Suite | Resultado |
| --- | --- |
| `npm test` | 153/153 |
| `npm run lint:tokens` | OK, 175 archivos, 2 excepciones (los radares) |
| `npm run build` | OK |
| `npm run visual:compare` | 182/182 iguales; 183/183 con la prueba de IDs |
| `npm run test:browser`, calentamiento | 314 pasan, 5 omitidas, 0 fallos (2,0 min) |
| `npm run test:browser`, corrida 1 | **314 pasan, 5 omitidas, 0 fallos** (1,9 min) |
| `npm run test:browser`, corrida 2 | **314 pasan, 5 omitidas, 0 fallos** (1,9 min) |

- Las 5 omitidas son las de siempre (E01, E03 y E19, según los flags).
- Sin intermitentes en las tres corridas.
- La CI del PR en el mismo commit también está en verde.

## Decisiones (tomadas el 2026-10-14)

Registradas en [`decisiones.md`](./decisiones.md), "QA de interfaz (2026-10-14, U18)".

1. **H1:** sí, header fijo en todo el sitio (`clip` global).
2. **H3:** opción A. El área táctil de país y sello se amplía a 44 px. Sigue siendo P1.
3. **H7:** `/lab` solo en desarrollo.
4. **H8:** se cambia el texto ahora; el caso de E09 se abre después del lanzamiento.
5. **Comprobaciones manuales** (iPhone y VoiceOver): pendientes.

Lo demás va al paso 5 con la severidad indicada: P1 antes del lanzamiento; P2 según capacidad.

## Paso 5 · H1 (2026-10-14)

Grupo "Scroll y header". Claude Opus 5.5, esfuerzo `high`. Referencia visual de partida: `.ref-pre-u18fix` (ya borrada).

**Causa:** `html, body { overflow-x: hidden }` convertía a `body` en un contenedor de scroll que nunca se desplaza, y eso anulaba todo `position: sticky` fuera del Estudio.

**Arreglo:**

- `overflow-x: clip` en `html, body` (`styles.css`). Desaparece `html.is-tool` (`estudio/+layout.svelte`).
- `Header.svelte` publica `--header-offset` en todo el sitio, no solo en el Estudio. El índice del manual (`ReadingLayout`) se coloca debajo, con la misma transición que la barra lateral del Estudio.
- **Barra de la ficha página:** de `dockBar` (JavaScript, `position: fixed`) a `position: sticky; bottom: 0`. La geometría es la misma, medida a 390 antes y después.
- **Reserva al desplazarse** (efecto nuevo del sticky): `html { scroll-padding-top: calc(var(--header-reserve) + var(--search-reserve)) }`.
  - `--header-reserve` es el alto del header en escritorio y 0 en móvil. `--search-reserve` es la barra «Buscar» del inicio en móvil.
  - Sin ella, tras paginar el header reaparecía y tapaba ~44 px de la primera fila (grilla en y = 32, header hasta 76).
  - El `scroll-margin` del editor del Estudio deja de sumar `--header-offset`.
  - **Coste:** un hueco de 76 px (60 en móvil) cuando el desplazamiento es hacia abajo y el header se oculta.
- H15, en el mismo grupo.
- **`dockBar` de la ficha:** revisado, pasa a sticky (lo pedía la propuesta de H1).

**Sonda** (390 y 1440: inicio, manual, Sugerir, cuenta, entrar, ficha página):

| Elemento | Antes | Después |
| --- | --- | --- |
| Header al bajar 1200 px | `top` = −1276 (sube con la página) | `top` = −76 (oculto y pegado arriba) |
| Header al subir 300 px, 1440 | fuera de vista | `top` = 0 |
| Header al subir, 390 | fuera de vista | oculto; solo vuelve al inicio (E14) |
| «Buscar» al subir, 390 | `top` = −363 | `top` = 0 |
| Índice del manual al subir, 1440 | `top` = −458 | `top` = 108 (bajo el header de 76) |
| Paginar desde abajo (390 / 834 / 1440, con y sin movimiento reducido) | sin movimiento reducido no se desplaza (H15) | la grilla queda 32 px bajo el header o «Buscar» |
| Barra de la ficha, 390 | abajo; acoplada sobre el pie al final | igual |

**Pruebas:**

- **Nuevas:** `tests/browser/u18-sticky.spec.ts` (4). Miden geometría, no atributos: las de E14/E15 pasaban con el sticky roto porque solo miraban `data-header-visible`/`data-search-visible`. Las 4 fallan contra `559058b` y pasan con el arreglo.
- **Ajustadas:**
  - `u9-ficha` mide dónde queda la barra en vez de `data-floating`;
  - `e13` comprueba que la grilla queda bajo la reserva, no en y = 0;
  - `r1` (R1.4) acepta que el menú «Varios artistas» se abra hacia la fila anterior cuando no cabe debajo.
- **Suite visual:** las capturas de página completa y de elemento usan `tests/visual/support/capture-document.css` (header y «Buscar» en `relative`). Sin eso, el header sticky salía en mitad de `registro-error-D` y de `lab-u6/u7/u8/u17`.

**Diferencias visuales contra `.ref-pre-u18fix`: 7 de 182, aceptadas por el equipo el 2026-10-14:**

| Captura | Motivo |
| --- | --- |
| `home-scrolled-M` | «Buscar» queda fija arriba (H1). |
| `card-row-D`, `card-row-T`, `card-row-M` | La grilla queda 76 px (60 en móvil) más abajo por la reserva. |
| `card-varios-open-D` | El disparador queda 38 px más abajo; el menú ya no cabe debajo y el overlay lo abre hacia arriba. |
| `estudio-editor-generos-D` | La sección Clasificación queda 38 px más abajo por la reserva. |
| `manual-D` | 7 px de ±1 nivel de gris por el propio `clip`: con `hidden`, la diferencia desaparece. |

**Suites:**

| Suite | Resultado |
| --- | --- |
| `npm test` | 153/153 |
| `npm run build` | OK |
| `npm run lint:tokens` | OK, 175 archivos, 2 excepciones (los radares, grupo "Menores") |
| `npm run test:browser`, corridas 1 y 2 | **318 pasan, 5 omitidas, 0 fallos** |

Una corrida parcial de `e13` falló una vez esperando `p=2`. No se reprodujo en 4 repeticiones (96/96) ni en las dos corridas completas.

## Paso 5 · H2 (2026-10-14)

Grupo "Seguridad de acceso". Claude Opus 5.5, esfuerzo `high`. Referencia visual de partida: `.ref-pre-u18fix` (ya borrada). **En local:** la migración y la función no se aplicaron en staging; se despliegan en el paso 7.

**Causa:**

- la función llamaba a `/auth/v1/token` desde el servidor sin contar intentos;
- un usuario inexistente respondía sin llamar a `/token` y uno real esperaba el bcrypt, así que el tiempo delataba qué usuarios existen.

**Arreglo:**

- **Migración** `20261014120000_u18_username_login_attempts.sql`:
  - tabla `private.username_login_attempts` (usuario, HMAC de la IP, fecha y si salió bien), con RLS y sin acceso desde la API;
  - `public.begin_username_login(usuario, ip_hash)`: devuelve el id del intento, o `null` si hay 5 fallos del usuario o 20 de la IP en 15 minutos. Toma dos *advisory locks* (IP y después usuario) y anota el intento como fallo al empezar, así una ráfaga simultánea no pasa la cuenta. Purga las filas de más de un día;
  - `public.finish_username_login(id)`: marca el acceso correcto y borra los fallos de ese usuario;
  - solo `service_role` las ejecuta.
- **Función** `login-with-username`:
  - pide el turno antes de buscar el perfil, así que un usuario inexistente se bloquea igual que uno real;
  - al superar el límite responde 429 ("Too many attempts");
  - toda respuesta 401 tarda al menos 1200 ms (`FAILURE_FLOOR_MS`);
  - la IP sale de `cf-connecting-ip`, `x-real-ip` o el primer `x-forwarded-for`, y se guarda como HMAC-SHA-256 con la clave de servicio;
  - la lógica sin dependencias vive en `supabase/functions/_shared/username-login.ts`.
- **Entrar** (`auth/login/+page.svelte`): el 429 de la función muestra "Demasiados intentos seguidos…", como el límite de Auth. Antes caía en el error genérico.

**Pruebas:**

- `tests/username-login.test.mjs` (en `npm test`): IP del cliente, HMAC y piso de latencia.
- `tests/sql/u18-h2-verify.sql` (transaccional): permisos, entradas inválidas, límite por usuario (también inexistente), ventana de 15 minutos, límite por IP, reinicio tras acceso correcto y purga. **OK** en un stack local construido desde vacío.
- `scripts/u18-h2-login-verify.mjs`, de punta a punta contra la función servida por edge-runtime en local. **OK:**

| Comprobación | Resultado |
| --- | --- |
| Acceso correcto | 200 con tokens, 159 ms |
| Inexistente frente a contraseña incorrecta (mediana de 6) | 1217 ms frente a 1216 ms. `/token` con contraseña incorrecta, solo: 101 ms |
| 5 fallos del usuario, y el 6.º con la contraseña buena | 429, sin consultar la cuenta. Igual con un usuario inexistente |
| 20 fallos desde una IP contra 20 usuarios | el 21.º es 429; desde otra IP se entra |
| Ráfaga de 12 simultáneos contra un usuario | 5 llegan a `/token` (401), 7 reciben 429 |
| 4 fallos y acceso correcto, dos veces | el contador se reinicia |
| IP en la tabla | solo HMAC de 64 caracteres hexadecimales |

- `u12-cuenta.spec.ts`: el 429 de la función muestra el mensaje del límite.

**Para el paso 7 (staging):**

1. **IP real:** comprobar qué cabecera la trae y que el cliente no la puede escribir (enviar `cf-connecting-ip` y `x-forwarded-for` falsos y ver si cambian de contador). En local se pueden falsificar.
2. **IP que ve Auth:** si es la del runtime, el límite de Auth (30 cada 5 minutos) sigue siendo compartido. El límite por IP impide que lo agote una sola IP; un ataque distribuido todavía podría hacerlo.
3. **Piso de latencia:** el camino real en hosted debe quedar por debajo de 1200 ms.

**Visual:** 0 diferencias en 182 contra `.ref-pre-u18fix`. La línea base no cambia.

**Suites:**

| Suite | Resultado |
| --- | --- |
| `npm test` | 156/156 |
| `npm run build` | OK |
| `npm run lint:tokens` | OK, 175 archivos, 2 excepciones (los radares, grupo "Menores") |
| `npm run test:browser`, corridas 1 y 2 | **319 pasan, 5 omitidas, 0 fallos** |

## Paso 7 · H2 en staging (2026-10-14)

La migración `20261014120000` se aplicó en staging el 2026-10-15 a las 00:30:10 UTC (`u18-h2-verify.sql` OK, con rollback). Después se desplegó `login-with-username` v4 a las 00:32:31 UTC, con `--use-api` y `verify_jwt` falso como la v3.
- La v3 era idéntica al `index.ts` de `5f7684f`: es el rollback.
- Antes de desplegar se comprobó que la clave publicable de `.env.local` coincide con la `SUPABASE_ANON_KEY` del runtime: una petición inválida respondió 400, no 503.

Sondas desde una sola máquina, con `curl` y `fetch`, contra `https://hgocyrzhgohetfpzbmfs.supabase.co/functions/v1/login-with-username`:

**1. IP real y si se puede falsificar.** Un intento con un usuario inexistente por cada caso; luego se comparó el `ip_hash` de cada fila.

| Petición | Respuesta | `ip_hash` |
| --- | --- | --- |
| Sin cabeceras extra | 401 | `e4526f6c8742…` |
| `x-forwarded-for: 203.0.113.7` | 401 | el mismo |
| `x-real-ip: 203.0.113.8` | 401 | el mismo |
| `cf-connecting-ip: 203.0.113.9` | **403 de Cloudflare** (página HTML, 65 ms), sin llegar a la función | sin fila |

- La IP sale de `cf-connecting-ip`. La pone Cloudflare, y una petición que la trae desde el cliente se rechaza antes de llegar a la función.
- Como `clientIp` lee esa cabecera primero, `x-real-ip` y `x-forwarded-for` falsas no cambian el contador.
- **No se puede falsificar desde el cliente.**
- **No comprobado:** que el hash corresponda exactamente a la IP pública de quien llama. Hace falta la clave de servicio, que no se sacó del proyecto, o una segunda red de origen.

**2. IP que ve Auth.** Un acceso correcto por la función y otro directo a `/auth/v1/token`. Datos de `auth.sessions`:

| Origen | IP en la sesión | Agente |
| --- | --- | --- |
| Directo desde esta máquina | `206.62.142.170` (la IP pública propia) | `node` |
| Función, 4 accesos | `34.224.168.248`, `98.80.8.128`, `98.84.124.60`, `13.219.225.246` | `Deno/2.1.4 (… SupabaseEdgeRuntime/1.77.0 …)` |

- Auth ve la IP de salida del runtime: direcciones de AWS en us-east-1 que **rotan entre peticiones**.
- El límite de Auth (30 cada 5 minutos por IP) se aplica a esas IPs compartidas, no a quien entra.
- Que rote reparte la carga, así que una sola IP de cliente difícilmente agota el límite de una IP del runtime. Además, el límite propio (20 por IP) lo frena antes.
- El riesgo que se anotó en el paso 5 queda como estaba: un ataque distribuido podría consumir el límite de Auth de una IP del runtime y bloquear a otras personas que entren con usuario por ella. Entrar con correo no pasa por el runtime.

**3. Latencia frente al piso de 1200 ms.** Tiempos de punta a punta desde el cliente, que incluyen la red:

| Caso | Tiempos (ms) | Mediana |
| --- | --- | --- |
| Acceso correcto: perfil, `getUserById`, bcrypt de `/token`, `finish` | 1432 (arranque en frío), 687, 731; y 702 el que reinició el contador | 731 (de los tres primeros) |
| Contraseña incorrecta de un usuario real (4) | 1442, 1427, 1423, 1436 | 1436 |
| Usuario inexistente (5) | 1396, 1441, 1410, 1488, 1462 | 1441 |
| 6.º intento del usuario bloqueado | 429 en 356 | — |

- El camino real, el más caro, tarda unos 730 ms en caliente con la red incluida, bien por debajo del piso.
- Contraseña incorrecta e inexistente se distinguen por 5 ms de mediana, que es ruido de red.
- El arranque en frío (1432 ms) suma su retraso antes de que corra el código, así que afecta igual a todos los casos: el piso cuenta desde dentro de la función.
- 4 fallos y un acceso correcto reinician el contador: el acceso siguiente funcionó.
- El límite por usuario responde 429 también en el entorno alojado.

**Lo que dejaron las sondas en staging:**
- 13 filas de fallo de usuarios `s9h2-*` en `private.username_login_attempts`, que se purgan en un día;
- 8 accesos correctos de `jmamanche`;
- todas las sesiones de la cuenta QA quedaron revocadas (`logout?scope=global`, 0 sesiones después).

**Dictamen H2:** verificado en staging. Sigue abierto el riesgo aceptado en `decisiones.md`: quien conozca un usuario puede bloquear 15 minutos su entrada con usuario.

## Para el paso 5 (correcciones de U18)

| Grupo | Hallazgos | Modelo |
| --- | --- | --- |
| Scroll y header | H1 (+ recapturar y revisar E14/E15) | Opus 5.5 `high` |
| Seguridad de acceso | H2 (función, tabla, verificación en staging) | Opus 5.5 `high` |
| Objetivos táctiles | H3, H10, H11 (y H12 a 390) | Sonnet 5.5 `medium` |
| Menores | H4, H6, H7, H8, H9, H13, tokens del radar | Sonnet 5.5 `medium` |
| Censo | H14, al final, con la recaptura | Sonnet 5.5 `medium` |

**Hecho:**

- "Scroll y header" (H1 y H15), el 2026-10-14;
- "Seguridad de acceso" (H2), el 2026-10-14, en local. Falta desplegarlo en staging (paso 7).

**Listo cuando:**

- no quede ningún P0/P1;
- `lint:tokens` no tenga excepciones;
- la suite esté en verde;
- `visual:compare` dé 0 diferencias tras recapturar.
