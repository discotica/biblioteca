# Censo de interfaz — 2026-10-03

Versión en texto del catálogo visual publicado en https://claude.ai/artifact/7NAxvxQyhyGMUK2Zr1GG55 (127 capturas, 25 vistas, 7 grupos). Los chats de ejecución deben leer este archivo, no la página: aquí está cómo se construye cada vista, qué falla y qué se decidió. Las capturas se regeneran en U1 con el script de [`anexos/censo-interfaz-captura-2026-10-03.mjs`](./anexos/censo-interfaz-captura-2026-10-03.mjs).

- Capturado el 3 de octubre de 2026 sobre `main` con cambios locales, servidor de desarrollo y catálogo canónico de staging en solo lectura (2.790 lanzamientos).
- Anchos: 1440 (D), 834 (T) y 390 (M). Roles: anónimo, comunidad, colaborador y admin, con sesiones simuladas.
- Propuestas, reportes, crates y perfiles de las capturas son ficticios; portadas y créditos son reales.
- Severidad de hallazgos: **Error** (roto o ilegible), **Sistema** (inconsistente con el resto), **Pulido** (detalle).
- Las decisiones normalizadas están en [`../modernizacion/decisiones.md`](../modernizacion/decisiones.md) (ronda 3). Si una respuesta literal de este censo parece contradecirlas, manda el registro de decisiones y el plan.

## El sistema hoy

Medido en el código de 41 archivos de interfaz y en el DOM renderizado de 12 vistas.

| Métrica | Valor | Detalle |
| --- | --- | --- |
| Tamaños de fuente distintos | 74 | De 8px a 2.6rem, mezclando px, rem y clamp |
| Alturas de botón renderizadas | 19 | De 14 a 64px en 31 combinaciones |
| Clases de botón | 41 | btn-*, button *, ui-button, share-button… |
| Valores de border-radius | 28 | 4, 5, 6, 7, 8, 9, 10, 12, 14… y 999 |
| Colores literales | 346 | 128 hex y 218 rgba fuera de tokens |
| Breakpoints | 17 | De 420 a 1024px; los tokens declaran 3 |

**Se conserva:** paleta base de `styles.css` (fondo `#0e0e0e`, panel `#161616`, texto `#f8ffee`, acento `#96f719`); Work Sans 600–800 en títulos y regular en lectura; la portada como protagonista con fondo ambiental desenfocado; tokens semánticos de E04 (capas, foco, táctil 44px, motion, `.ui-button`); contratos de overlay de `lib/ui/overlay.ts`.

**Deuda estructural:**

- `src/app.css` (144 líneas) no se importa en ningún sitio.
- `--radius-md` se usa en perfil, sugerir y editorial pero no existe.
- La consola admin usa `#8cff18` frente al `#96f719` de marca, con 202 colores literales.
- `LanzamientoCard` conserva una variante `detail` que ninguna ruta usa (~550 líneas, con un segundo reproductor).
- `routes/+page.svelte` tiene 1.412 líneas: búsqueda, URL, modal, hoja móvil, gestos y estilos.
- Tres reglas distintas deciden cuándo mostrar "Varios artistas".
- Textos internos del proyecto en la interfaz ("servicio auditado E06", "que E09 publicará").

### Botones observados (desktop, una muestra por combinación)

| Alto | Texto | Fuente | Radio | Caja | Vista |
| --- | --- | --- | --- | --- | --- |
| 22px | Compartir (tarjeta) | icono | 5px | — | Inicio |
| 25px | Chip de país | 12.5px | pill | — | Filtros |
| 28px | Género | 11.2px | 7px | — | Ficha |
| 30px | Randomizar | 11.5px | pill | — | Radar |
| 32px | Añadir a crate | 12px | 7px | MAYÚS | Ficha |
| 35px | Copiar link | 12.5px | 8px | MAYÚS | Crate |
| 36px | + Nuevo crate | 12.8px | 8px | MAYÚS | Mis crates |
| 38px | Nuevo lanzamiento | 12px | 7px | — | Consola |
| 39px | Seleccionar (desplegable) | 14px | 14px | — | Filtros |
| 41px | Reiniciar filtros | 14.7px | pill | — | Filtros |
| 42px | ← Volver | 16px | 14px | — | Artista |
| 43px | Cerrar búsqueda | 15.7px | pill | — | Inicio |
| 43px | Entrar | 13.6px | 8px | MAYÚS | Entrar |
| 44px | Entrar (header) | 11.5px | 8px | MAYÚS | Header |
| 44px | Varios artistas ▾ | 13.1px | 4px | — | Tarjeta |
| 44px | Comprar | 13.6px | 8px | — | Ficha |
| 44px | Filtros | 12px | 7px | — | Consola |
| 45px | Revisar publicación | 16px | 8px | — | Editorial |
| 51px | Detectar | 16px | 8px | — | Sugerir |
| 64px | Nueva propuesta | 16px | 8px | — | Perfil |

## Estructura global

### Header, menú y footer

- **Rutas:** `global`
- **Archivos:** lib/components/Header.svelte (176) · Footer.svelte (112) · lib/ui/overlay.ts (dropdownMenu)
- **Capturas:** Anónimo (`header-anon-D`) · Con sesión (`header-auth-D`) · Menú abierto (`header-menu-D`) · Menú abierto (`header-menu-M`) · Con sesión, menú (`header-auth-menu-M`) · Footer (`footer-D`) · Footer (`footer-M`)

**Cómo está construido**

- Barra fija que se esconde al bajar. En desktop vuelve al subir (umbral 8px); en móvil solo reaparece en el tope.
- Desktop: logo · "Sugerir" (texto verde con icono) · separador · "Entrar" (verde lleno, 44px, mayúsculas a 11.5px) · "Menú".
- Con sesión: inicial en círculo + "Perfil", "Mis crates" y "Salir" como enlaces de texto en mayúsculas.
- Menú desplegable anclado: Manual, Reportar un problema, Blog, Substack, Instagram, con iconos SVG de /img.
- Móvil: Sugerir + bloque verde "Entrar" de ~58px + hamburguesa. Con sesión, la cuenta pasa al menú.
- Footer: cuatro enlaces con icono en mayúsculas, lema y copyright; remate con una línea verde de 48px.

**Hallazgos**

- **Sistema.** Ni la Consola de catálogo ni la Estación editorial aparecen en la navegación, tampoco para admin. Solo se llega por URL.
- **Sistema.** "Entrar" mide 11.5px en mayúsculas en el header y 13.6px en /auth/login. "Comprar", del mismo peso visual, va en minúsculas a 13.6px.
- **Sistema.** El menú móvil se abre sobre la grilla sin fondo que bloquee: el contenido sigue legible y tocable detrás.
- **Pulido.** En móvil, "Entrar" ocupa más que el logo y compite con "Sugerir" como acción principal.
- **Pulido.** "Salir" está al mismo nivel que "Perfil" y "Mis crates", sin separación.

**Decisiones de la ronda 3**

- ¿Cómo llegan admin y colaboradores a sus herramientas? → **Desde el perfil**
- Con sesión en desktop, ¿cuenta en enlaces sueltos o agrupada? → **Avatar que abre un menú de cuenta (Perfil, Mis crates, Salir)**
- ¿Qué acción lleva el botón lleno en el header móvil? → **Entrar**. Nota: "Prefiero cómo está estructurado el de "COMPRAR" puesto que tiene unpadding prudente horizontal y vertical. El padding botón de entrar es más alto que ancho. Mayúsculas sostenidas para los elementos prinicpales del header. Se debe resolver conflcto entre entrar y sugerir, ambos son importantes, pero el entrar tiene demasiado protagonismo y los mismos problemas de padding. Salir está bien donde está, sin embargo, creo que hace falta un logo. También las tres barras horizontales del botón "Menú" son irregulares, se ven como mal distrubídas."

### Carga, error, vacío y 404

- **Rutas:** `/`, `/ruta-inexistente`
- **Archivos:** routes/+page.svelte (loader, resultados__error, resultados__vacio) · no existe routes/+error.svelte
- **Capturas:** Cargando catálogo (`home-loading-D`) · Fallo de carga (`home-error-D`) · Sin resultados (`home-empty-D`) · 404 (`404-D`) · 404 (`404-M`)

**Cómo está construido**

- Carga: tres puntos verdes que laten y "CARGANDO LANZAMIENTOS", centrados en 60vh.
- Error: una línea roja "No pudimos cargar los lanzamientos. Inténtalo de nuevo." sin botón.
- Vacío: una línea gris bajo la barra de orden; la pill del texto buscado sigue arriba.
- 404: la página por defecto de SvelteKit, "404 / Not Found", sin estilos y pegada a la esquina.

**Hallazgos**

- **Error.** No hay página de error propia: el 404 sale en inglés, sin diseño ni salida.
- **Sistema.** El error no ofrece reintentar y el vacío no ofrece limpiar filtros ni sugerencias.
- **Sistema.** Cada vista escribe sus estados a mano: "Cargando catálogo…" en crate, spinner + "Comprobando acceso…" en la consola, otro texto en editorial. No hay un componente común.

**Decisiones de la ronda 3**

- ¿Qué tono tienen los estados vacíos y de error? → **Utilitario: mensaje corto + una acción clara**
- ¿Cómo se ve la carga del catálogo? → **Esqueleto de tarjetas que conserva la composición**. Nota: "una combinación con el actual (que dé el indicio de que hay algo cargando) + un esqueleto, bien resuelto. me parece que los botones pulsantes verticales podrían ser horizontales."

## Descubrimiento

### Inicio · listado

- **Rutas:** `/`, `/?p=2`
- **Archivos:** routes/+page.svelte (1.412) · SearchResultsBar.svelte · Pagination.svelte · LanzamientoCard.svelte (grid)
- **Capturas:** Primera pantalla (`home-D`) · Página completa (`home-full-D`) · Primera pantalla (`home-T`) · Página completa (`home-full-T`) · Primera pantalla (`home-M`) · Página completa (`home-full-M`) · Página 2 (`home-page2-D`) · Paginación inferior (`home-pagination-D`)

**Cómo está construido**

- Orden vertical: header → "Buscar" centrado (pill verde con emoji 🔍 y un barrido de luz animado en bucle) → barra de resultados (‹ Página 1 de 233 › a la izquierda, "Ordenar por" a la derecha) → 12 tarjetas → "1–12 de 2790 lanzamientos" → paginación.
- Grilla: auto-fit minmax(320px) → 3 columnas en el contenedor de 1200px; 2 columnas entre 640 y 1023; 1 columna (máx. 34rem) bajo 640.
- Móvil: la pill se convierte en una barra "Buscar" a ancho completo, sticky, que se esconde al bajar; muestra el número de filtros activos.

**Hallazgos**

- **Sistema.** Las tarjetas de una fila no comparten altura: la caja de "Varios artistas" (44px con margen negativo) y los títulos de 2–3 líneas descuadran cada fila.
- **Sistema.** "Buscar" usa emoji como icono y una animación permanente; el resto del sitio usa iconos SVG y no tiene animación ambiental.
- **Pulido.** En móvil, paginación y orden ocupan ~200px antes de la primera portada; en desktop la paginación superior repite la inferior.
- **Pulido.** El total de lanzamientos solo aparece al final de la página.
- **Sistema.** Un ajuste visual del listado obliga a tocar el archivo que también contiene la lógica de búsqueda, URL y modal.

**Decisiones de la ronda 3**

- ¿Necesitamos un modo lista (filas densas) además de la grilla? → **Sí, con selector grilla/lista que se recuerda**
- ¿Cuántas columnas en desktop ancho (≥1280)? → **3, como hoy**. Nota: "3 es el máximo, el tamaño de la card es el correcto y ya está bien diseñado. los otros breakpoints se comoportan de manera esperada."
- ¿Paginación o carga continua? → **Paginación numerada, como hoy**. Nota: "mantener la paginación. revisar en todas las vistas el diseño de la paginación (tiene problemas de altura el texto respecto a los botones) y de ancho en mobile y en desktop. debe haber alguna forma en que en móvil convivan en la misma línea la paginación y el ordenar por."
- En móvil, ¿qué hay antes de la primera portada? → **Buscar + filtros activos**. Nota: "buscar en una lkínea, filtros activos en otra, y en la tercera paginación con orden. los filtros activos son un banner horizontal scrolleable. el diseño de filtros activos puede ser mejor: más compacto, menos altura, mejor separación entre el texto y el padding a los bordes."

### Bienvenida e invitación beta

- **Rutas:** `/`, `/?beta=1&nombre=Laura`
- **Archivos:** WelcomeBanner.svelte · content/welcome.ts · ui/welcomeSession.ts · BetaInvitation.svelte · domain/betaInvitation.ts
- **Capturas:** Bienvenida (`home-welcome-D`) · Bienvenida (`home-welcome-M`) · Invitación beta (`home-beta-D`) · Invitación beta (`home-beta-M`)

**Cómo está construido**

- Bienvenida: banner en el flujo (no modal) con eyebrow, título, texto, "Explorar" y un recuadro visual. Aparece una vez por pestaña y solo al entrar directo a /.
- Beta: diálogo modal centrado con saludo por nombre, "Explorar", correo de contacto y enlace para reportar.

**Hallazgos**

- **Sistema.** El recuadro visual es un marcador de posición: rectángulo punteado verde con un círculo.
- **Sistema.** Bienvenida (banner) y beta (diálogo) resuelven lo mismo con dos patrones distintos.
- **Pulido.** En móvil el banner empuja la primera portada fuera de pantalla.
- **Pulido.** El cerrar del diálogo beta aparece con anillo de foco grueso al abrir.

**Decisiones de la ronda 3**

- ¿Qué forma tiene la bienvenida? → **Bloque editorial grande, como hoy, con imagen real**. Nota: "este bloque edit4orial completo es una bienvenida general al sitio, no es lo mismo que la bienvenida del beta. para la invitación del beta, es una opción que da para enviar a probadores, pero esta bienvenida editorial es un componente permanennte de la página."
- ¿Qué va en el recuadro visual? → **Ilustración de marca**
- ¿Beta y bienvenida comparten patrón? → **No, la beta merece diálogo propio**

### Búsqueda y filtros · desktop

- **Rutas:** `/?genero=…&pais=…`
- **Archivos:** Filtros.svelte (916) · ActiveSearchPills.svelte · RadarFiltros.svelte · domain/searchState.ts · domain/searchMatching.ts
- **Capturas:** Panel abierto (`home-search-D`) · Sugerencias (`home-search-suggest-D`) · País abierto (`home-search-pais-D`) · Tipo abierto (`home-search-tipo-D`) · Filtros activos (`home-filtered-D`) · Filtros + panel (`home-filtered-panel-D`) · Solo aproximados (`home-approx-D`)

**Cómo está construido**

- Panel en el flujo que empuja la grilla. Izquierda: texto con sugerencias agrupadas (Género, Artista, Álbum) y cuatro campos (País y Género en nube de etiquetas; Tipo y Año en lista). Derecha: Radar.
- "Reiniciar filtros" como pill verde a todo el ancho de la columna, bajo el formulario.
- Los cambios se aplican al instante. Las pills activas viven fuera del panel (44px, radio pill, verde en negrita) con "+N" si no caben.
- Orden: Más reciente / Más antiguo; con criterios suma "Mejor coincidencia"; con radar, "Radar".
- Sin coincidencias exactas aparece el aviso "No encontramos resultados exactos…" y se muestran aproximados.

**Hallazgos**

- **Sistema.** Cuatro estilos de control en un panel: input con radio 14, desplegables de 39px con radio 14, pill de 41px y botones de radar de 30px.
- **Sistema.** "Reiniciar filtros" es lo más visible del panel (verde a todo el ancho) siendo una acción secundaria que borra.
- **Sistema.** Las sugerencias usan colores propios por tipo (lila, rojo) fuera de la paleta.
- **Pulido.** "Buscar" lleva emoji y "Cerrar búsqueda" una ✖ tipográfica: el mismo control cambia de familia de icono.
- **Pulido.** Los desplegables de País y Tipo se abren encima de la grilla y se cortan contra el borde del panel.

**Decisiones de la ronda 3**

- ¿Dónde viven los filtros en desktop? → _sin opción elegida_. Nota: "Creo que la forma en la que funciona el buscador actualmente es la correcta, en la que convivan tanto los filtros como el radar. sin embargo, creo que hace falta optimizar el espacio, puesto que en instancias anteirores habíamos retirado otro apr de menús (mes yordenar por)."
- ¿Cómo se presenta "Reiniciar filtros"? → **Botón secundario dentro del panel**. Nota: "el botón dentro del pánel está bien, lo importante es darle cohesión. también creo que el icono de buscar con emoji ya no debería estar sino un icono svg. lo mismo el desalida."
- ¿El campo de texto está siempre visible, fuera del panel? → **No, dentro del panel**. Nota: "quizá puede ser un poc omás alto y un 15% más llamativo para que se entienda el poder que tiene."

### Radar

- **Rutas:** `/?radar_bailable=5…`
- **Archivos:** RadarFiltros.svelte (317) · RadarMini.svelte · RadarVisual.svelte · domain/searchMatching.ts
- **Capturas:** Radar con valores (`home-radar-D`) · Orden por radar (`home-radar-results-D`) · Radar en la hoja (`home-sheet-radar-M`) · Radar en tarjeta (hover) (`card-hover-D`) · Radar en ficha (hover) (`modal-radar-D`)

**Cómo está construido**

- Cinco ejes (Experimental, Denso, Sintético, Bailable, Rápido) con cinco puntos cada uno y un pentágono SVG con las iniciales E, D, S, B, R.
- "Randomizar" y "Limpiar" como pills de 30px.
- Al activar un eje el orden pasa a "Radar" y aparece la pill "Radar".
- En tarjeta y ficha el radar solo aparece al pasar el cursor por la portada, que baja al 18% y 12% de opacidad.

**Hallazgos**

- **Sistema.** En pantallas táctiles no hay una forma explícita de ver el radar de un lanzamiento: depende del hover.
- **Sistema.** El filtro rotula los ejes con iniciales y la tarjeta con nombres completos.
- **Pulido.** En la hoja móvil "Radar" aparece dos veces (el desplegable y el título del componente).
- **Pulido.** "Randomizar" es la acción con más peso del bloque.

**Decisiones de la ronda 3**

- ¿Cómo se ve el radar de un lanzamiento? → **Solo hover, como hoy**. Nota: "en mobile tambiñén qye funcione con hover, pero pues le hover es un tap sobre la portada"
- ¿Qué control tiene cada eje en el filtro? → **Cinco puntos, como hoy**
- ¿Se mantiene "Randomizar"? → **Sí, como acción secundaria**. Nota: "me gusta la palabra "Aleatorizar". Respecto a que la palabra RADAR aprezca dos veces en móvil, sugiero dejar la palabra RADAR del desplegable, y en el desplegado, ocultarla."

### Hoja de filtros · móvil

- **Rutas:** `/ (≤768px)`
- **Archivos:** routes/+page.svelte (filtros-mobile-sheet, swipe) · lib/ui/overlay.ts (sheetOverlay) · Filtros.svelte
- **Capturas:** Hoja abierta (`home-sheet-M`) · Con filtros (`home-sheet-filtered-M`) · País abierto (`home-sheet-pais-M`) · Radar desplegado (`home-sheet-radar-M`) · Resultado tras cerrar (`home-filtered-M`)

**Cómo está construido**

- Hoja inferior con asa, título "Filtros", cerrar de 44px, pills activas (máx. 7.1rem con scroll), el mismo Filtros.svelte, Radar en un desplegable y "Reiniciar filtros".
- Altura según contenido hasta 88dvh. Se cierra deslizando, tocando el fondo o con Escape.
- Fuera de la hoja: barra "Buscar" con insignia del número de filtros y pills con "+N".

**Hallazgos**

- **Sistema.** La altura de la hoja salta según lo que se despliega (de ~60% a 88%).
- **Sistema.** No hay un botón "Ver N resultados": el cambio se aplica, pero no se sabe cuántos resultados hay hasta cerrar.
- **Pulido.** Los campos van en una tarjeta con borde dentro de la hoja: doble contenedor.

**Decisiones de la ronda 3**

- ¿La hoja abre a altura fija o según contenido? → **Según contenido, como hoy**. Nota: "cuando en los filtros, hay demasiadas opciones que superan el ancho de la columna en móvil, el contenedor del texto overflowea la derecha."
- ¿Lleva un botón fijo de resultados ("Ver 124 lanzamientos")? → **Sí, fijo abajo**. Nota: "el botón de cerrar y un nuevo botón de ver lanzamientos (que no tiene que ser con el # exacto) realizan la misma acción, pero el botón de ver resultados me parece útil. hay que resolver esta tensión."

## Lanzamiento

### Tarjeta de lanzamiento

- **Rutas:** `/`, `/artista/…`, `/sello/…`, `/crate/…`
- **Archivos:** LanzamientoCard.svelte (1.108; variante grid en uso, variante detail sin uso) · CreditSummary.svelte (154) · RadarMini.svelte
- **Capturas:** Fila de tarjetas (`card-row-D`) · Un artista (`card-grid-D`) · Principal + colaboradores (`card-collab-D`) · Dos artistas (`card-two-D`) · Menú "Varios artistas" (`card-varios-open-D`) · Hover con radar (`card-hover-D`) · Fila de tarjetas (`card-row-T`) · Tarjeta (`card-row-M`)

**Cómo está construido**

- Portada cuadrada; detrás, la misma portada desenfocada al 14% como fondo ambiental.
- Fila 1, créditos (13px, verde): nombres con coma o "Varios artistas ▾" en caja de 44px con borde verde y margen −10px.
- Fila 2: título (15–18px, 650, máx. 3 líneas) + compartir verde de 22×22px.
- Fila 3: año · país · sello a 10.7px y 30% de opacidad.
- Fila 4: hasta 3 géneros en chips de 11px + "+N".

**Hallazgos**

- **Error.** El menú de "Varios artistas" queda debajo de la fila siguiente de la grilla y no se puede leer completo.
- **Error.** Falta el espacio tras la coma ("Diego Raposo,aLex vs aLex"): Svelte 5 recorta el espacio final del , ", ".
- **Sistema.** Tres reglas para "Varios artistas": la tarjeta usa compilado o ≥4 principales (y otra vez ≥2 colaboradores), la ficha compilado o >1 principal y la variante antigua >2. PERMANENTE muestra dos nombres en la tarjeta y "Varios artistas" en el modal.
- **Sistema.** "Luca Durán | Varios artistas ▾" se lee como un lanzamiento de varios artistas; en realidad agrupa a 9 colaboradores.
- **Sistema.** Compartir (22px, verde lleno) es lo más saturado de la tarjeta y queda bajo el mínimo táctil.
- **Pulido.** Los metadatos a 10.7px con 30% de opacidad no alcanzan contraste legible.

**Decisiones de la ronda 3**

- ¿Cómo se resumen los créditos en la tarjeta? → **Primer artista + "y N más" en texto, sin caja**. Nota: "lo importante s que se vean todos los nombres de los artistas prinicipales. en caso de comiplados (que se escoge desde la cateogría del lanzamiento, no desde heurística) que diga varios artistas; en caso de que los nombres de los artistas principales sean demasiado largos, se truncan. si es artista prinicpal y colaboradores, el nombre del prinicpal y n+. en la modal / página del lanzamiento debe haber una vista mucho más clara de todos los aritstas que participan en sus diferentes roles."
- ¿Los colaboradores aparecen en la tarjeta? → _sin opción elegida_. Nota: "—sigue la lógica que revisamos arriba."
- ¿Qué acciones viven en la tarjeta? → **Compartir como icono discreto**
- ¿Qué metadatos lleva como mínimo? → **Año · país · sello + géneros, como hoy**. Nota: "la lwegibilidad de los datos pequeños puede ser un 15% mejor pero el tamaño y la distribuci´òn es la adecuada."

### Ficha en modal

- **Rutas:** `/?modal=…`
- **Archivos:** LanzamientoModal.svelte (137) · ReleaseDetail.svelte (558) · ReleasePlayer.svelte · ReleaseRecommendations.svelte · AddToCrateButton.svelte · domain/releaseDetail.ts · domain/modalHistory.ts
- **Capturas:** Desktop 1440 (`modal-D`) · Diagnóstico: barras y reproductor (`debug-modal-overlap`) · Desktop 1100 (`modal-1100-D`) · Tablet horizontal (`modal-tablet-landscape-T`) · Tablet vertical (`modal-T`) · Móvil (`modal-M`) · Móvil, scroll (`modal-mid-M`) · Móvil, final (`modal-bottom-M`) · Desktop, final (`modal-bottom-D`) · Menú de artistas (`modal-varios-D`) · Hover con radar (`modal-radar-D`) · Añadir a crate (`modal-crate-D`)
- **Nota de captura:** La captura de diagnóstico marca en naranja la columna de portada, en azul la portada y en rojo el marco del reproductor.

**Cómo está construido**

- Diálogo de 1060×720 como máximo, con radio 0 20 20 0 (esquinas izquierdas rectas). Grid: portada (1fr) + información (440px).
- Columna de portada: cuadrado centrado en vertical sobre #0e0e0e.
- Columna de información con scroll propio: artista (verde, mayúsculas), título, metadatos (etiquetas de 58px), reseña, reproductor (Bandcamp 380px, SoundCloud 300, Spotify 352), acciones y recomendaciones.
- Bajo 680px: pantalla completa, portada al 82vw centrada, todo en un solo scroll.

**Hallazgos**

- **Error.** Barras negras arriba y abajo: la columna mide 720px de alto y la portada es un cuadrado del ancho de la columna (620px), así que sobran 50px arriba y abajo. A 834px de ancho la portada ocupa media altura.
- **Error.** El reproductor se aplasta en desktop: la columna de información es flex con altura fija y sus hijos pueden encogerse. El marco de Bandcamp (380px) queda en ~58px y botones y recomendaciones se dibujan encima del iframe. El scroll interno existe pero nunca se activa.
- **Error.** El menú de "Añadir a crate" se corta contra el borde derecho del modal.
- **Sistema.** Cuatro acciones, cuatro estilos y dos filas: Comprar (verde, 44px), AÑADIR A CRATE (mayúsculas, 32px), Reportar (subrayado en caja de 44px), Compartir (caja de 44px). No refleja la jerarquía acordada: escuchar → compartir → guardar → comprar.
- **Sistema.** Los colaboradores no aparecen en ninguna parte de la ficha.
- **Sistema.** En tablet vertical (834) siguen dos columnas con una portada de 225px.
- **Pulido.** El cerrar abre con anillo de foco de 3px; en móvil queda sobre la portada.
- **Pulido.** "Reportar" y "Compartir" tienen el mismo peso; reportar es una acción de soporte.

**Decisiones de la ronda 3**

- ¿Composición desktop de la ficha? → **Portada fija arriba a la izquierda, información con scroll al lado**. Nota: "a la izquierda debe estar la portada en el tamaño adecuado (todas las portadas siempre serán cuadradas, de no ser así, se hace un crop para que lo sean). que no aparezcan barras ni arriba ni abajo, y que la información quepa cómodamente en el scroll interno del lanzmaiento en la parte dereacha."
- ¿Cómo se agrupan las acciones? → _sin opción elegida_. Nota: "compartir y añadir a crate son dos botones con texto e icono, el del reportar (un bug) y de compartir solo icono basta. todo en una sola línea."
- ¿Qué peso tiene el reproductor? → **Completo con lista de pistas, como hoy**. Nota: "el reproductor ha tenido muchos problemasp orque con el clic en aluno de los tracks, automáticamente se escrollea para rariba o no se queda en el lugar donde fue seleccionado."
- ¿Composición móvil? → **Portada a ancho completo + barra de acciones fija abajo**
- ¿Desde qué ancho pasa a dos columnas? → **680px, como hoy**

### Variantes de contenido de la ficha

- **Rutas:** `/?modal=…`
- **Archivos:** ReleaseDetail.svelte · domain/releaseDetail.ts (releasePlayerConfig)
- **Capturas:** Spotify (`modal-spotify-D`) · SoundCloud, portada rota (`modal-soundcloud-D`) · Con reseña (`modal-review-D`) · Título largo (`modal-longtitle-D`) · Sin portada (`modal-nocover-D`)

**Cómo está construido**

- El reproductor sale del dominio del enlace de compra: Bandcamp, SoundCloud o Spotify (solo álbumes).
- La reseña va en cursiva con borde verde a la izquierda.
- Sin portada: un degradado gris vacío.

**Hallazgos**

- **Error.** Si la portada falla se ve el texto alternativo ("Portada de Madafa") sobre negro: no hay respaldo para imagen rota.
- **Sistema.** Sin portada queda un rectángulo gris sin identidad (sin título, iniciales ni radar).
- **Sistema.** Un título largo ocupa cuatro líneas a 38px y empuja todo; no hay escala para títulos largos.
- **Pulido.** Spotify con enlace a pista (no a álbum) no genera reproductor y la ficha queda sin escucha.
- **Pulido.** Hay reseñas que son una URL pegada (dato, no interfaz).

**Decisiones de la ronda 3**

- ¿Qué se muestra sin portada? → **Logo de Discótica atenuado**
- ¿Cómo se tratan los títulos largos? → **Dejar crecer, como hoy**. Nota: "importante que en todo el sitio, los sliders del scroll no sean los nativos del navegador, puesto que contrastan demasiado y se ven muy feos. la idea es hacer algo más discreto y de acuerdo a la paleta de colores."

### Ficha como página

- **Rutas:** `/lanzamiento/[slug]`
- **Archivos:** routes/lanzamiento/[slug]/+page.svelte (133) · LanzamientoVista.svelte → ReleaseDetail.svelte (modo page)
- **Capturas:** Desktop (`ficha-D`) · Móvil (`ficha-M`) · Compilado (`ficha-comp-D`)

**Cómo está construido**

- Enlace "← Explorar el catálogo", portada sticky a la izquierda y la misma columna de información sin altura fija.
- Comparte componente con el modal; cambia el título (h1) y la posición sticky.

**Hallazgos**

- **Sistema.** Las acciones se parten en dos filas y "Compartir" queda sola en la segunda.
- **Sistema.** El reproductor aparece como bloque negro de 380px mientras carga; no hay estado de carga.
- **Sistema.** Dos patrones de retorno: "← Explorar el catálogo" aquí y "← Volver" en botón verde en artista y sello.
- **Pulido.** La columna de información mide ~460px en una pantalla de 1440.

**Decisiones de la ronda 3**

- ¿La página se ve igual que el modal? → **Idéntica: mismo componente y layout**. Nota: "creo que debe verse similar, sin embago la ditribución de los objetos debe ser optimizada. el botón "splorar el catálogo" luce poco proloijo, y el fondo gris de el lanzamiento no va de acuerdo al fondo desenfoc ado que diseñamos para la modal. las demás acciones y cosas que ya definimos anteriormente, deben propagarse a esta instancia."

### Artista y sello

- **Rutas:** `/artista/[slug]`, `/sello/[slug]`
- **Archivos:** routes/artista/[slug]/+page.svelte (248) · routes/sello/[slug]/+page.svelte (264) · artista/_+page copy.svelte (881, sin uso)
- **Capturas:** Artista (`artista-D`) · Artista (`artista-M`) · Sello (`sello-D`) · Sello (`sello-M`)

**Cómo está construido**

- "← Volver" (verde lleno, 42px, radio 14) a la izquierda y "Ordenar por:" a la derecha.
- Eyebrow ARTISTA o SELLO y el nombre centrado en verde; debajo, la grilla de tarjetas.

**Hallazgos**

- **Sistema.** "Volver" es lo más visible de la página; en móvil es un botón verde a todo el ancho.
- **Sistema.** Título centrado en verde, cuando el resto del sitio alinea títulos a la izquierda en blanco.
- **Sistema.** No muestra datos que ya existen: número de lanzamientos, años, países, géneros principales.
- **Pulido.** "Ordenar por:" lleva dos puntos aquí y no en Inicio.
- **Sistema.** Una copia de 881 líneas de la página de artista sigue en el repositorio sin uso.

**Decisiones de la ronda 3**

- ¿Qué cabecera tienen artista y sello? → **Solo el nombre, alineado a la izquierda**
- ¿Cómo se vuelve? → **Migas en texto ("Catálogo › Artista")**
- ¿Se puede filtrar dentro de artista o sello? → **No**

## Cuenta

### Entrar

- **Rutas:** `/auth/login`
- **Archivos:** routes/auth/login/+page.svelte (205) · Edge Function login-with-username
- **Capturas:** Vacío (`login-D`) · Vacío (`login-M`) · Credenciales inválidas (`login-error-D`)

**Cómo está construido**

- Tarjeta de 420px centrada: título, etiquetas en mayúsculas de 11px, campos de 44px y "ENTRAR" verde a todo el ancho en mayúsculas.
- Debajo: "Olvidé mi contraseña · Crear cuenta". El error aparece en un bloque rojo sobre el botón.

**Hallazgos**

- **Sistema.** Dos sistemas de formulario: auth usa etiquetas y botones en mayúsculas; Sugerir y Reportar usan etiquetas en tipo oración y .ui-button.
- **Pulido.** En desktop es un formulario pequeño en una página vacía, sin decir para qué sirve tener cuenta.
- **Pulido.** Se entra con nombre de usuario; nada lo aclara a quien recuerda su correo.

**Decisiones de la ronda 3**

- ¿Qué acompaña al formulario? → **Dos columnas: formulario + qué permite la cuenta**. Nota: "sí, que explique tres beneficios de tener un acuenta en discótica: los crates, poder compartirlos a otros y colaborar añadiendo lanzamientos. creo que en general puede ser un layout de dos columnas (izquierda: beneficios, derecha: login) para desktop, y para mobile que sea (1. login, 2. beneficios)"
- ¿Con qué se entra? → **Usuario o correo**

### Registro

- **Rutas:** `/auth/registro`
- **Archivos:** routes/auth/registro/+page.svelte (372)
- **Capturas:** Vacío (`registro-D`) · Vacío (`registro-M`) · Completo, usuario verificado (`registro-filled-D`) · Validación (`registro-error-D`) · Éxito (`registro-success-D`)

**Cómo está construido**

- Campos: correo, usuario (verificación en vivo "DISPONIBLE"), nombre para mostrar (opcional), contraseña y confirmación, newsletter y privacidad.
- Botón "CREAR CUENTA"; al terminar, el formulario se reemplaza por "Revisa tu correo para confirmar tu cuenta."

**Hallazgos**

- **Error.** El enlace "Ir a iniciar sesión" del mensaje de éxito sale en el azul por defecto del navegador, ilegible sobre negro.
- **Sistema.** La casilla de privacidad usa la burbuja nativa del navegador, en inglés ("Please check this box…"); los demás errores usan el bloque rojo propio.
- **Sistema.** Los requisitos de la contraseña no se ven hasta que falla.
- **Pulido.** El éxito no dice a qué correo se envió ni cómo reenviar.

**Decisiones de la ronda 3**

- ¿Registro en uno o dos pasos? → **Uno, como hoy**. Nota: "uno como hoy, pero la información distribuída de otra manera o por categorías para separarla más fácil. importante que las condiciones y la fortaleza de la contraseña se muestren dinámicamente. en los datos que las personas pueden compartir de sus perfiles, añadir la opción de mostar los usuarios de sus redes sociales, limitado a bandcamp, soundcloud, instagram, twitter y facebookm, y que en el perfil eso salga con íconos. importante que se haa una aclaración para los links sociales de que es voluntario y ayudará a conectar con las personas y que lo sigan."
- ¿Qué pasa tras crear la cuenta? → **Pantalla "Revisa tu correo" con el correo, reenviar y abrir correo**

### Correos de confirmación y recuperación

- **Rutas:** `Supabase Auth`, `/auth/reset?flow=signup`
- **Archivos:** supabase/config.toml ([auth.email.template] comentado) · no existe supabase/templates/
- **Capturas:** Confirmar cuenta (`email-confirm`) · Restablecer contraseña (`email-reset`) · Enlace vencido (`reset-error-D`)
- **Nota de captura:** Reconstrucción de la plantilla por defecto de Supabase. Si alguien la personalizó en el dashboard, ese cambio no está en el repositorio: hay que verificarlo allí.

**Cómo está construido**

- Sin plantillas propias, Supabase envía un correo en inglés, sin marca, desde noreply@mail.app.supabase.io.
- El enlace de confirmación vuelve a /auth/reset?flow=signup, que confirma la sesión y redirige a /mis-crates sin mensaje.
- Un enlace vencido muestra "Algo salió mal" con una sola salida: pedir un nuevo enlace de contraseña, también si venías de registrarte.

**Hallazgos**

- **Sistema.** Correos en inglés y sin identidad, fuera del repositorio.
- **Sistema.** Tras confirmar no hay pantalla de "Cuenta confirmada": se aterriza en Mis crates sin contexto.
- **Sistema.** El error de enlace vencido no distingue registro de recuperación.
- **Pulido.** El remitente por defecto de Supabase tiene un límite bajo de envíos; producción necesita SMTP propio.

**Decisiones de la ronda 3**

- ¿Nivel de diseño de los correos? → **HTML sencillo con logo y botón verde**
- ¿Desde qué dirección? → **hola@discotica.com**
- ¿Dónde aterriza la persona tras confirmar? → **Mis crates con un aviso**

### Recuperar y nueva contraseña

- **Rutas:** `/auth/recuperar`, `/auth/reset`
- **Archivos:** routes/auth/recuperar/+page.svelte (183) · routes/auth/reset/+page.svelte (208)
- **Capturas:** Pedir enlace (`recuperar-D`) · Pedir enlace (`recuperar-M`) · Enlace enviado (`recuperar-sent-D`) · Nueva contraseña (`reset-recovery-D`) · Nueva contraseña (`reset-recovery-M`)

**Cómo está construido**

- Mismo patrón de tarjeta que Entrar. El éxito es un bloque verde "Listo." con texto no enumerativo.
- Nueva contraseña: dos campos y "GUARDAR CONTRASEÑA"; al terminar, redirige a Mis crates.

**Hallazgos**

- **Sistema.** Las cuatro pantallas de cuenta reimplementan los mismos estilos (205, 372, 183 y 208 líneas) con 5 a 8 tamaños de fuente cada una.
- **Pulido.** "ENVIAR LINK" mezcla inglés y mayúsculas.
- **Pulido.** Nueva contraseña no muestra el mínimo de 8 caracteres.

**Decisiones de la ronda 3**

- ¿Las pantallas de cuenta comparten un layout? → **Sí: un layout con título, ayuda, formulario y pie**

## Comunidad y crates

### Sugerir un lanzamiento

- **Rutas:** `/sugerir`
- **Archivos:** routes/sugerir/+page.svelte (357) · StringListField.svelte · stores/contributionsStore.ts · Edge Function inspect-release-source
- **Capturas:** Sin sesión (`sugerir-anon-D`) · Sin sesión (`sugerir-anon-M`) · Comunidad, vacío (`sugerir-D`) · Comunidad, vacío (`sugerir-M`) · Tras detectar (`sugerir-detected-D`) · Tras detectar (`sugerir-detected-M`) · Admin (`sugerir-admin-D`)

**Cómo está construido**

- Eyebrow "CATÁLOGO ABIERTO", título y explicación; campo de enlace + "Detectar".
- Tras detectar: portada como evidencia, título, artistas (un campo por artista con ×), colaboradores, tipo, fecha, géneros, países, sello, nota; "Guardar borrador" y "Enviar".
- Admin ve un aviso que lo envía a la consola.

**Hallazgos**

- **Sistema.** El asterisco de obligatorio ocupa una línea propia bajo la etiqueta (igual en la consola).
- **Sistema.** 25 artistas detectados se convierten en 25 campos apilados.
- **Sistema.** Sin sesión: un recuadro con dos enlaces subrayados. Otras vistas resuelven el mismo bloqueo con botón verde.
- **Pulido.** Columna de 560px en desktop con el resto vacío.

**Decisiones de la ronda 3**

- ¿Cómo se estructura sugerir? → **Por pasos: fuente → revisar datos → nota → enviar**. Nota: "bien, pero la nota no tiene que ser obligatoria en ninguna instancia, ni añadiendo un cambio ni sugiriendo un lanzamiento."
- ¿Cómo se editan listas (artistas, géneros)? → **Chips con buscador, como en la consola**

### Reportar un problema

- **Rutas:** `/reportar?release_id=…`
- **Archivos:** routes/reportar/+page.svelte (62) · services/problemReports.ts
- **Capturas:** Con lanzamiento (`reportar-D`) · Con lanzamiento (`reportar-M`)

**Cómo está construido**

- Categoría (select nativo), descripción, captura opcional (selector de archivo nativo), bloque de contexto técnico y "Enviar reporte".
- Sin sesión redirige a Entrar.

**Hallazgos**

- **Sistema.** El selector de archivo nativo sale en inglés ("Choose File / No file chosen").
- **Pulido.** En móvil la introducción va centrada y el formulario alineado a la izquierda.

**Decisiones de la ronda 3**

- ¿Desde dónde se reporta? → **Desde la ficha (dentro de "…") y el menú global**

### Perfil

- **Rutas:** `/perfil/[username]`
- **Archivos:** routes/perfil/[username]/+page.svelte (307) + loader
- **Capturas:** Perfil propio (`perfil-D`) · Perfil propio (`perfil-M`)

**Cómo está construido**

- Inicial en círculo, nombre, @usuario, bio y "En Discótica desde".
- Sección privada "Mis propuestas" con estado (Borrador, Cambios solicitados, Pendiente, Aceptado, Rechazado) y nota editorial.
- "Crates públicos" en tarjetas de texto.

**Hallazgos**

- **Sistema.** Insignias de estado en cinco colores a 9px.
- **Sistema.** Usa --radius-md, que no está definido: las tarjetas quedan con esquinas rectas.
- **Pulido.** Columna de 860px; las tarjetas de crates no tienen portadas.

**Decisiones de la ronda 3**

- ¿Dónde viven las propuestas propias? → **En una sección "Mis propuestas" aparte**. Nota: ""mis aportes" es mucho mejor. diseñar la vista de los aportes para que la información sea más clara y compacta, como una lista de filas, nada demasiado alto. y el botón de acción de las cosas pendientes está DEMIASOD grande."
- ¿Qué ve otra persona en un perfil? → **Crates + aportes aceptados**. Nota: "y que la persona en su perfil pueda ajustar si decide permitir quel os aportes aceptados sean públicos."

### Mis crates y crear crate

- **Rutas:** `/mis-crates`, `/mis-crates?crear=1`
- **Archivos:** routes/mis-crates/+page.svelte (164) · CrateCard.svelte (193) · CreateCrateModal.svelte (310) · stores/cratesStore.ts
- **Capturas:** Con crates (`miscrates-D`) · Con crates (`miscrates-M`) · Vacío (`miscrates-empty-D`) · Crear crate (`crate-crear-D`) · Crear crate (`crate-crear-M`)

**Cómo está construido**

- Título + "+ NUEVO CRATE" (mayúsculas, 36px). Tarjetas con PÚBLICO/PRIVADO, nombre, descripción, conteo y "ELIMINAR".
- Diálogo de crear: nombre, descripción, segmentado PÚBLICO/PRIVADO, "CANCELAR" y "CREAR CRATE".

**Hallazgos**

- **Sistema.** Las tarjetas no muestran portadas y no se distinguen entre sí.
- **Sistema.** "ELIMINAR" es la única acción visible; editar y compartir no aparecen.
- **Sistema.** El diálogo de crear usa mayúsculas y un segmentado propio, distinto de los diálogos de la consola.
- **Pulido.** "@comunidad · Catálogo" bajo el título no explica qué es "Catálogo".

**Decisiones de la ronda 3**

- ¿Cómo se ve un crate en el listado? → **Mosaico de 4 portadas + nombre**. Nota: "creo que es importante revisar el naming de "crate" puesto que es un anglicismo: sugerimos "colecciones" y que se propague en todas las instancias de "crate""
- ¿Qué acciones por crate? → _sin opción elegida_. Nota: "en la lista de crates, detrás de un botón "…" estén las opciones que dices excepto abrir, y dentro del crate, que esas acciones estén en botones más explicitos en la parte de arriba."

### Crate

- **Rutas:** `/crate/[slug]?usuario=…`
- **Archivos:** routes/crate/[slug]/+page.svelte (365) + loader
- **Capturas:** Propietario (`crate-D`) · Propietario (`crate-M`)

**Cómo está construido**

- Migas "@usuario › Crates", título, descripción, insignia, conteo y "COPIAR LINK".
- Grilla de tarjetas con una × sobre la portada para quitar; la nota del ítem va debajo.

**Hallazgos**

- **Sistema.** Descarga el catálogo completo (2.790) para pintar seis lanzamientos: ~8 s en "Cargando catálogo…" durante la captura.
- **Sistema.** La × de quitar flota sobre cada portada y no pide confirmación ni permite deshacer.
- **Pulido.** Las notas van a 10px bajo la tarjeta.

**Decisiones de la ronda 3**

- ¿Cómo se ve un crate por dentro? → _sin opción elegida_. Nota: "solo grillas o listas con selector, pero sin notas visibles"
- ¿Se puede reordenar? → **Sí, arrastrando**

## Herramientas internas

### Consola de catálogo · listado

- **Rutas:** `/admin/catalogo`
- **Archivos:** routes/admin/catalogo/+page.svelte (581 líneas largas; 202 colores literales) · services/adminCatalog.ts
- **Capturas:** Listado (`admin-list-D`) · Filtros (`admin-filters-D`) · Selección (`admin-selection-D`) · Listado (`admin-list-T`) · Listado (`admin-list-M`) · Sin sesión (`admin-anon-D`) · Sin rol (`admin-norole-D`)

**Cómo está construido**

- Eyebrow ADMINISTRACIÓN, "Catálogo" y "Nuevo lanzamiento". Buscador con chip "Enter" + "Filtros" + "Buscar".
- Filtros: estado (Borrador, Publicado, Archivado) y tipo, con "Limpiar" y "Aplicar filtros".
- Tabla de 25 filas: selección, portada, título + identificador, artistas, tipo, sello, fecha/edición, estado y ›. Paginación "Página 1 de 112".
- Móvil: tarjetas de consulta.

**Hallazgos**

- **Sistema.** Rompe el contenedor del sitio: va de borde a borde (9px) mientras el header se queda en 1200px.
- **Sistema.** Paleta paralela: verde #8cff18 (la marca es #96f719) y grises verdosos propios.
- **Sistema.** Escala tipográfica propia: 15 tamaños, muchos entre 9 y 11px.
- **Sistema.** La selección múltiple no ofrece acciones: solo "N seleccionados · Limpiar".
- **Sistema.** La fila no indica completitud (solo un ícono "!" en borradores); no hay orden por columna visible.
- **Pulido.** Filas de 56px a dos líneas: densidad media para 2.790 registros.

**Decisiones de la ronda 3**

- ¿La consola comparte header y contenedor con el sitio? → **Layout de herramienta propio (barra lateral + ancho completo)**. Nota: "en genral el diseño de este sitio debe parecer un poco más parecid a lo que es youtube studio vs youtube. son parte de la misma plataforma pero no necesarimente deben tener el mismo lenguaejh visual. debe ser una UXUI dedicad a la revisión y creación de lanzamientos."
- ¿Densidad y columnas de la tabla? → **Como hoy**
- ¿Qué acción masiva hace falta primero? → **Publicar o archivar en lote**
- ¿Atajos de vista? → **Sí: Borradores, Incompletos, Sin portada, Con reportes**

### Consola de catálogo · editor

- **Rutas:** `/admin/catalogo (editor)`
- **Archivos:** routes/admin/catalogo/+page.svelte · services/adminCatalog.ts (RPC admin_*)
- **Capturas:** Primera pantalla (`admin-editor-top-D`) · Editor completo (`admin-editor-D`) · Historial (`admin-history-D`) · Buscar artista (`admin-finder-D`) · Confirmar archivo (`admin-publish-D`) · Nuevo lanzamiento (`admin-new-D`) · Tablet (`admin-editor-T`) · Móvil, solo consulta (`admin-editor-M`)

**Cómo está construido**

- Barra superior: volver, portada, EDITAR LANZAMIENTO, título, artista, estado y versión. Pestañas Edición / Historial con contador.
- Secciones: Datos esenciales; Artistas del lanzamiento (dos grupos con arrastre y selección múltiple); Género, país y radar (nubes de chips y cinco sliders); Imagen.
- Barra lateral fija: completitud, estado actual, observación obligatoria, "Guardar cambios" y "Archivar lanzamiento".
- Historial en línea de tiempo con "Revertir este cambio". En móvil, solo consulta.

**Hallazgos**

- **Sistema.** Textos internos del proyecto en pantalla: "El servicio auditado E06 la exige", "E06 conserva esta nota en el historial auditado".
- **Sistema.** Diccionarios con duplicados a la vista: "Progressive / Progresive / Progresivo", "footwor / Footwork", "EE.UU / EEUU / Estados Unidos", "Entrañas" como país y un género de prueba "E06 Direct Genre…".
- **Sistema.** 71 géneros y 48 países como nubes de chips sin buscador.
- **Sistema.** El asterisco de obligatorio ocupa una línea propia bajo cada etiqueta.
- **Pulido.** Pestañas a 11px en una barra de 32px.
- **Pulido.** "Archivar lanzamiento" va en texto rojo pegado a "Guardar".

**Decisiones de la ronda 3**

- ¿Estructura del editor? → **Secciones en una página con índice lateral**
- ¿Cómo se eligen géneros y países? → **Combobox con búsqueda + chips seleccionados**. Nota: "me parece que la nube está bien, pero siento que ocupa demasiado espacio. en general el diseño de esta vista me parece demasiado grande"
- ¿Vista previa de cómo se verá en el sitio? → **No**
- ¿Edición en móvil? → **Edición completa**. Nota: "permitir la edición completa, pero ajustar la vista para que también esté optimizada para móvil y sea igual de útil y fácil de usar."

### Estación editorial

- **Rutas:** `/editorial`
- **Archivos:** routes/editorial/+page.svelte (266) · stores/contributionsStore.ts · services/problemReports.ts
- **Capturas:** Admin, colas y reportes (`editorial-admin-D`) · Admin (`editorial-admin-M`) · Aprobar y publicar (`editorial-approve-D`) · Colaborador (`editorial-colab-D`) · Sin sesión (`editorial-anon-D`)

**Cómo está construido**

- Una columna de ~600px: Cola prioritaria → Reportes → Cola comunitaria.
- Cada propuesta: estado, título, fuente, tabla Detectado / Confirmado, metadatos, evidencia, nota del equipo, nota para la persona autora y "Revisar publicación", "Solicitar cambios", "Rechazar".
- Reportes: categoría, estado en select nativo, respuesta interna y "Guardar clasificación".
- Aprobar abre un diálogo con resumen y "Aprobar y publicar".

**Hallazgos**

- **Sistema.** Columna de 600px en 1440: tres colas largas apiladas, sin vista de lista + detalle.
- **Sistema.** Los reportes muestran el estado en un select nativo blanco y el valor crudo en inglés ("new", "triaged") como título.
- **Sistema.** El diálogo de aprobación dice "Confirma el release que E09 publicará de forma transaccional".
- **Sistema.** Aprobar crea el lanzamiento pero no enlaza a editarlo en la consola: las dos herramientas no se conectan.
- **Sistema.** Primario, secundario y destructivo en dos filas; "Rechazar" queda solo.
- **Pulido.** Las diferencias detectado/confirmado se marcan con una barra naranja de 2px.

**Decisiones de la ronda 3**

- ¿Forma de la estación? → **Bandeja: lista a la izquierda y detalle a la derecha**. Nota: "la bandeja es perfecta"
- ¿Relación con la consola de catálogo? → **Una sola herramienta con secciones: Catálogo, Propuestas, Reportes**. Nota: "si, la idea es que no sean urls distintas para revisar la cola y crear nuevos lanzamientos, la idea es que todo esté centralizado en una misma herramient pero que cada una de las diferentes vistas / herramientas tengan su propia sección o tab."
- ¿Cómo se muestra lo que cambió entre detectado y propuesto? → **Solo lo propuesto, marcando campos editados**

## Información

### Manual y privacidad

- **Rutas:** `/manual`, `/privacidad`
- **Archivos:** routes/manual/+page.svelte (966) · routes/privacidad/+page.svelte (148)
- **Capturas:** Manual (`manual-D`) · Manual (`manual-M`) · Privacidad (`privacidad-D`)

**Cómo está construido**

- Manual: cabecera en tarjeta, índice lateral, tarjetas de explicación y un botón flotante "Secciones".
- Privacidad: texto continuo en una columna de ~700px.

**Hallazgos**

- **Sistema.** El manual tiene su propio sistema visual: 13 tamaños de fuente, 70 colores literales y 4 breakpoints.
- **Pulido.** El botón flotante "Secciones" queda fuera de la columna en desktop.
- **Pulido.** Privacidad tiene texto pequeño y jerarquía de títulos plana.

**Decisiones de la ronda 3**

- ¿El manual sigue como página? → **Página, con mejor tipografía**
