# Plan de dirección de arte — 2026-11-10

Lleva al sitio público el look aprobado en el lienzo: arte generativo propio, un solo cabecero, fichas editoriales, perfil como casa y un onboarding corto. No es un rediseño del sistema: los tokens, las primitivas y los contratos de datos se quedan, y se aplican con más intención.

- **Lienzo aprobado (fuente de diseño):** <https://claude.ai/artifact/D6Zt9AwNTW1TvckLbXtGW5>, página «Ronda 3: ejemplos». Aprobado por el usuario el 2026-11-10 («creo que el diseño está aprobado»).
- **Prompts por etapa:** [`prompts-direccion-arte-2026-11-10.md`](./prompts-direccion-arte-2026-11-10.md).
- **Etapas:** de U26 a U34. Siguen la serie de interfaz (U1–U25).

## 1. Tableros del lienzo

Cada tablero es `project/<Archivo>.dc.html` y se lee con la herramienta Artifact (`action: "read"`, `path`). Los tableros son HTML estático: medidas, colores y textos se toman de ahí.

| Tablero | Archivo | Qué fija | Etapa |
| --- | --- | --- | --- |
| A2 Pulso: late donde estuvo | `PulsoB.dc.html` | Campo vivo de puntos y el pulso del cursor (código interactivo incluido) | U27, U29 |
| A Pulso: campo vivo | `Pulso.dc.html` | Variante anterior del campo (ver D1) | U27 |
| B Huella por persona y rol | `Huellas.dc.html` | Huella por nombre y su gama por rol | U27 |
| C Partitura | `Partitura.dc.html` | Huella de colección por columnas. **No entra en esta serie** (D6) | — |
| D Franja de entrada | `EntradaR3.dc.html` | Inicio: franja, buscador con chips, bienvenida y beta | U29 |
| E Acceso | `AccesoR3.dc.html` | Entrar | U30 |
| F Perfil | `PerfilR3.dc.html` | Perfil visto por su dueño, cuadrícula de colecciones, Mis aportes fijado | U31 |
| G2 Ficha de archivo | `FichaR3.dc.html` | Colección, artista y sello sobre cenefa alta; listas con «N más» | U32 |
| H Tipografía en interfaz | `Tipografia.dc.html` | Comparación de tipos. Solo referencia: queda Work Sans | U26 |
| I Cabecero: estado actual | `CabeceroActual.dc.html` | Capturas de hoy. Solo referencia | — |
| J Cabecero y panel | `CabeceroPropuesta.dc.html` | Barra única para todos los roles y panel de cuenta | U28 |
| K Onboarding | `OnboardingR3.dc.html` | Tres pasos, Revisa tu correo y perfil recién nacido | U30, U31 |
| L Inventario de vistas | `InventarioR3.dc.html` | Qué ruta se diseña, cuál hereda y cuál desaparece | Todas |
| M Vistas ajustadas | `VistasR3.dc.html` | Recuperar, contraseña nueva, enlace vencido, 404, Editar perfil, Ajustes, Reportar, Sugerir, Manual y privacidad | U30, U33 |
| N Mis aportes | `AportesR3.dc.html` | Página de revisión de los aportes | U31 |

La página «Capturas» del lienzo guarda el estado anterior, para comparar.

## 2. Decisiones de partida

| Tema | Decisión |
| --- | --- |
| Alcance | Sitio público y cuenta. El Estudio solo recibe la barra nueva (U28): su interior no cambia. |
| Tipografía | **Work Sans**, cargada de verdad (hoy no se carga: `tokens.css` la nombra, pero no hay `@font-face`). Se aloja en el propio sitio, sin un proveedor nuevo. Botones a peso **600** (hoy 700). |
| Color | En interfaz y superficies grandes, solo verde de marca y grises. Las huellas usan gamas: verdes para usuarios, grises para colaboradores y morado **#682cc6** para admin. El ámbar y el rojo se quedan solo en los estados. |
| Imagen | Arte generativo propio, una sola pieza viva por pantalla. Avatares y miniaturas son estáticos. Con movimiento reducido, se muestra un fotograma fijo. |
| Voz | Directa y corta. Sin titulares que repiten lo obvio, sin «1 de 3» y sin frases pícaras. |
| Cabecero | Opaco, de 72 px en desktop y 60 en móvil, con el mismo ancho en todas las páginas, Estudio incluido. |
| Perfil | Es la casa. Desaparece la página Mis colecciones. Mis aportes no es una colección: es un tile fijado que abre su propia página. |
| Datos | Sin migraciones ni RPC nuevas. Las listas de las fichas salen de los lanzamientos que ya se cargan. Si una etapa necesita un dato nuevo, se detiene y lo pregunta. |

## 3. Sistema (aplica a todas las etapas)

### Tipografía y tamaños

- Work Sans 400, 500, 600 y 700, en `woff2` dentro de `static/fonts`, con `font-display: swap` y precarga de 400 y 600.
- **El peso más alto es 700** (decisión del usuario en U26, 2026-11-10: el 800 del lienzo pesa demasiado). La cara 700 cubre 700–900, así que un 800 que quede en el código se dibuja a 700. Donde este plan o el lienzo dicen 800, léase 700.
- Títulos de entidad (perfil, colección, artista, sello): 88/84 en desktop y 52–60 en móvil, peso 700, `letter-spacing -0.035em`.
- Título de la franja de entrada: 102/92 en desktop.
- Título dentro de un contenedor (formularios, 404, Ajustes): 28/34, peso 700.
- Página de lectura: h1 40/44, h2 22/28 y cuerpo 18/28.
- Botones: 14 px, peso 600, alto 40, y 48 en la acción de un formulario.

### Cabecero

- Fondo `#0e0e0e`, con borde inferior `rgba(248,255,238,.1)` y padding horizontal igual al contenedor del sitio. Controles de 40 px separados 8.
- Junto al logo, «beta» en 12 px y verde.
- Visitante: «Sugerir» (verde, con +) y la hamburguesa sin texto (`aria-label="Menú"`). Entrar y Crear cuenta van dentro del panel. Sugerir sin sesión lleva a entrar.
- Con sesión: Sugerir, y el avatar de huella con chevron.
- Colaborador y admin: además, «Estudio» en contorno, con el icono de faders.
- Dentro del Estudio, la misma barra con «Volver al catálogo» en lugar de Estudio.
- Excepciones:
  - en Entrar, Sugerir va en contorno;
  - en los pasos del onboarding, la barra es mínima, con Entrar en contorno.

### Panel de cuenta

- Opaco.
- Arriba, una cenefa con la huella y su color de rol, y «@usuario» a 24 px.
- Debajo, la fila «Perfil y colecciones» y dos grupos:
  - «Tu cuenta»: Editar perfil, Ajustes y Salir;
  - «El sitio»: Manual y Reportar un problema.
- Filas de 44 px, a 14/500.
- Visitante: Entrar y Crear cuenta, y luego «El sitio».

### Contenedor de formulario

- Fondo `#121212`, borde `rgba(248,255,238,.12)`, radio 14 y padding 32 (20–24 en móvil).
- Ancho 480 en las vistas cortas y 576 en onboarding, Editar perfil, Ajustes, Reportar y Sugerir.
- Se apoya sobre el campo de puntos.
- Campos de 48 px y 22 entre bloques. 36 entre los campos y las acciones.

### Iconos nuevos en `icons.ts`

Todos con trazo 1,75 y en la cuadrícula de 24:

- `menu`: `M4 7h16`, `M4 12h16`, `M4 17h16`;
- `estudio`, faders: `M6 4v9 M6 17v3 M12 4v2 M12 10v10 M18 4v7 M18 15v5` + círculos r2 en (6,15), (12,8) y (18,13);
- `ajustes`, engranaje: el del tablero F;
- `pin`: el de los tableros F y K;
- `externo`: `M7 17 17 7`, `M9 7h8v8`;
- se reutilizan los que existan para +, chevron, flechas y lápiz.

Todo botón que sea solo icono lleva `aria-label` y tooltip.

## 4. Motor generativo

El motor del lienzo vivió en el scratchpad de la sesión de diseño, que ya no existe. Lo que queda es:

- el código interactivo de A2 (`PulsoB.dc.html`);
- las imágenes de B, G2 y K;
- y los parámetros que siguen.

U27 lo reconstruye como módulo del sitio.

- **Semilla:** FNV-1a de 32 bits sobre el nombre (usuario, colección, artista o sello), con un PRNG determinista. El mismo nombre siempre da la misma huella.
- **Huella:**
  - rejilla de puntos de paso 24, con un radio de 0,06 a 0,47 del paso según un campo de ruido continuo sembrado;
  - ganancia 2,1 y borde suave;
  - tonos: `tonosDe(nombre, rol)` da tres colores de la gama del rol, con el tono exacto derivado del nombre.
- **Avatar:** la huella en un círculo de 32, 40 o 96 px, generada una vez y cacheada como `dataURL` por nombre, rol y tamaño.
- **Cenefa troquelada (G2, F, N, panel):**
  - la superficie es la portada más reciente, desenfocada al máximo y con `saturate(1.3) brightness(1.4)`;
  - encima, una máscara de puntos con la huella del nombre (blanco sobre negro) en multiplicar, y el fondo aclarado hasta `#0e0e0e`;
  - velos para leer el texto: vertical de 0,66 → 0,46 y una zona derecha atenuada al 72 % detrás de la columna de datos.
- **Cenefa sin portadas (perfil, panel):** la huella con el color del rol, sobre `#0e0e0e`.
- **Portadas de otro dominio:** pintarlas en un `<canvas>` lo contamina, aunque no lea píxeles. Por eso la superficie se hace con un `<img>` y CSS (`filter: blur() saturate() brightness()`), y la máscara de puntos es un canvas propio aplicado con `mask-image` o un compuesto CSS. Nunca se llama a `getImageData` sobre portadas.
- **Pulso (A2):**
  - campo continuo sobre la rejilla, con una malla de desplazamiento de 48×27 y radio de punto `0.6 + 4.9·v`;
  - respira en reposo;
  - el cursor deja un latido donde estuvo, y las uniones contagian «vida» a los nodos vecinos;
  - una sola instancia por pantalla y `pointer-events: none`;
  - se pausa fuera de pantalla (`IntersectionObserver`) y con la pestaña oculta;
  - con `prefers-reduced-motion` o `Save-Data`, un fotograma fijo;
  - DPR limitado a 2 y presupuesto de 4 ms por cuadro, medido en el Performance de Chromium con CPU ×4.
- Todo el motor va en `src/lib/generative/`, sin dependencias nuevas.

## 5. Etapas

Un chat por etapa, en orden y uno a la vez sobre el árbol. Cada etapa guarda su referencia visual antes de tocar nada (`VISUAL_BASELINE_DIR=.ref-pre-uNN`), para medir solo sus propias diferencias.

### U26-0 — Cerrar las decisiones abiertas (solo el usuario)

- Responder D1–D5 de §6. Sin prompt.

### U26 — Base: tipografía, botones, iconos y tokens

- Cargar Work Sans (§3) y retirar cualquier `font-family` suelto que la contradiga.
- `Button` a peso 600, con alto de 48 para la acción de un formulario (variante o prop `size="lg"` si no existe).
- Tokens:
  - `--color-rol-admin: #682cc6`;
  - las alturas del cabecero (72/60);
  - el contenedor de formulario (fondo, borde, radio y padding);
  - y el ritmo de 22/36.
- Iconos nuevos (§3).
- `FormPanel` (o el nombre que encaje en `src/lib/ui`): el contenedor de formulario.
- Todo se muestra en `/lab`.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: tipo y botones cambian en todo el sitio y en el Estudio.
  - Escalar solo si `visual:compare` muestra diferencias que no son de tipo, peso ni métrica.

### U27 — Motor generativo

- `src/lib/generative/`:
  - semilla y PRNG;
  - `huella()` y `tonosDe()`;
  - `Huella.svelte` (avatar), `Cenefa.svelte` (con y sin portada) y `CampoPulso.svelte` (A2).
- Todo según §4, con prueba unitaria de determinismo: el mismo nombre da los mismos puntos y el mismo tono.
- Se muestra en `/lab`: huellas de tres usuarios por rol, cenefas con portada y sin ella, y el campo en reposo y con cursor.
- Medición de rendimiento documentada (§4).
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: canvas, rendimiento y reconstrucción de un motor del que solo quedan parámetros y el código de A2.
  - Escalar a xhigh solo si el campo no cabe en el presupuesto de 4 ms.

### U28 — Cabecero y panel

- Tablero J: barra única para todos los roles y estados (§3), con el panel nuevo y el avatar de huella.
- Dentro de `/estudio`, la misma barra con «Volver al catálogo».
- En móvil, la barra de 60 y el panel a pantalla.
- Se conservan:
  - el comportamiento de ocultar al hacer scroll en móvil (E14);
  - `--header-offset` y `--header-reserve`;
  - el arreglo de U13 que monta un solo menú (`menuMovil`).
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: el cabecero tiene historia de errores (E14, U13, sticky de U18) y toca todas las rutas.
  - Escalar si cambia la reserva de scroll o falla E14.

### U29 — Entrada y catálogo

- Tablero D:
  - franja con `CampoPulso`;
  - título 102/92;
  - buscador con el placeholder «Buscar por país, género, artista, sello o álbum»;
  - barra de 560 y chips en la misma fila;
  - con más de 4 chips, un chip «N más» con caret, que abre el resto.
- Bienvenida y nota beta comparten un solo hueco a todo el ancho, según el token beta. La nota beta deja de ser modal.
- Se conserva la reducción de la franja tras el primer scroll, y la paginación aterriza con la navegación visible.
- **Perfil de ejecución:**
  - Modelo: Sonnet 5.5.
  - Esfuerzo: high.
  - Motivo: UI sobre buscador y estado de URL que ya existen.
  - Escalar a Opus si cambia la URL de búsqueda, el historial (E12, E17) o el scroll.

### U30 — Acceso y onboarding

- Tablero E: Entrar.
  - Título «Haz parte de la biblioteca de electrónica sudaca…» (texto según D3).
  - Tres puntos con icono: aporta, guarda y comparte.
  - «Crear cuenta» como botón secundario de contorno verde, bajo Entrar.
- Tablero K: registro en tres pasos sobre la huella que nace.
  1. Correo y contraseña.
  2. Usuario y nombre; la nota «No se podrá cambiar después.» va bajo Usuario.
  3. Redes, con placeholders de URL, novedades y privacidad.
  - Progreso solo con barritas.
  - Mismos campos y misma llamada de alta que hoy: los pasos son de interfaz.
  - La huella va de gris quieto (1) a reorganizarse con cada tecla del usuario (2) y a revelar su color (3).
- «Revisa tu correo»:
  - «Abrir Gmail» y «Abrir Outlook» (ver D4), Reenviar y Usar otro correo;
  - el correo de confirmación no cambia, pero el enlace aterriza en el perfil, no en Mis colecciones.
- Tablero M:
  - Recuperar contraseña;
  - Contraseña nueva;
  - Enlace vencido, con una acción y sin aviso rojo.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: flujos de Auth (`authLinkRedirect`, `safeRedirect`, `pendingSignup`) y metadatos de alta.
  - Escalar si el alta necesita comprobar la disponibilidad del usuario y no existe forma de hacerlo sin RPC: en ese caso, detenerse.

### U31 — Perfil, colecciones y Mis aportes

- Tableros F y K (perfil recién nacido).
  - Cenefa de huella y título de entidad.
  - Redes como botones de icono.
  - Para el dueño, Editar perfil y Ajustes.
  - «Colecciones» con «+ Nueva colección» en verde.
  - Cuadrícula de 4×270, o de 2 columnas en móvil.
- Mis aportes:
  - primer tile, 1×1, con borde verde de 2 px y un pin (`aria-label="Fijada"`);
  - datos «N lanzamientos · N en revisión»;
  - abre `/mis-aportes`;
  - solo lo ve su dueño.
- El dueño también ve sus colecciones privadas, marcadas «Privada», con el menú de compartir, editar y eliminar que hoy vive en Mis colecciones.
- Perfil vacío: tile verde «Crea tu primera colección» y tiles fantasma.
- `/mis-colecciones` redirige al perfil (301 en `.htaccess` si hace falta, y redirección en cliente). Los avisos de llegada (`cuenta-confirmada`, `contrasena`) pasan al perfil. `safeRedirect` deja de caer en `/mis-colecciones`.
- Tablero N, `/mis-aportes`:
  - cenefa de la huella;
  - «@usuario» y título;
  - tres cifras: lanzamientos, en revisión y aceptados;
  - grupos:
    - Por resolver: cambios solicitados y borradores;
    - En revisión: pendiente y listo para administración;
    - Resueltos: aceptado y rechazado;
  - filas con portada (o hueco punteado), título, artista y tipo, `StatusDot`, la fecha con su verbo, y la nota del equipo en caja;
  - acción:
    - «Corregir» en verde;
    - «Editar» para borradores y pendientes sin tomar;
    - «Editar» gris y desactivado cuando el equipo ya la tomó;
    - «Ver lanzamiento» si está publicado;
  - sin la fuente.
  - Se reutiliza `contributionRows.ts`: el agrupado es de presentación.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: lectura de colecciones privadas del dueño, redirecciones y flujos que hoy viven en otra ruta.
  - Escalar si la lectura privada exige cambiar RLS: en ese caso, detenerse.

### U32 — Fichas de colección, artista y sello

- Tablero G2:
  - cenefa troquelada de 400 px con la portada más reciente;
  - título 88/84 y, a la derecha, la columna de datos de 372 px sobre la zona atenuada;
  - debajo, la rejilla y la barra de resultados que ya existen.
- Datos:
  - colección: Curada por, Lanzamientos y Visibilidad;
  - artista: País, Años, Sellos, Géneros y Lanzamientos;
  - sello: Países, Años, Artistas, Géneros y Lanzamientos.
- Las listas se calculan de los lanzamientos cargados y se ordenan por frecuencia.
  - Se excluyen «Independiente» de Sellos y «LATAM» de Países.
  - Hasta tres nombres, los que quepan, y un botón «N más ⌄» que abre un desplegable opaco del ancho de la columna.
  - En el desplegable, cada fila lleva nombre y cantidad, y enlaza a su ficha.
  - Muestra 8 filas y luego hace scroll. Teclado completo.
- **Perfil de ejecución:**
  - Modelo: Sonnet 5.5.
  - Esfuerzo: high.
  - Motivo: UI sobre `CatalogEntityPage` y datos ya cargados.
  - Escalar a Opus si el cálculo de listas necesita datos que la página no tiene.

### U33 — Vistas restantes

- Tablero M:
  - 404 y error general, que comparten pantalla;
  - Editar perfil en `/cuenta`, con cenefa pequeña;
  - Ajustes en `/cuenta/ajustes`, ruta nueva: correo, contraseña y novedades;
  - Reportar un problema;
  - Sugerir con progreso en barritas;
  - Manual y privacidad como lectura: índice a la izquierda y columna de 720.
- El panel de U28 ya enlaza Ajustes. Hasta esta etapa, ese enlace apunta a `/cuenta`.
- **Perfil de ejecución:**
  - Modelo: Sonnet 5.5.
  - Esfuerzo: high.
  - Motivo: vistas acotadas.
  - Escalar a Opus si separar `/cuenta` rompe el cambio de correo o el enlace de confirmación.

### U34 — QA y cierre

- 390 px y zoom 200 en todas las vistas del inventario L.
- Movimiento reducido en todas las piezas generativas.
- Rendimiento del campo con CPU ×4.
- Accesibilidad:
  - nombre en cada icono;
  - foco visible;
  - teclado en el panel, los chips «N más» y el desplegable;
  - contraste del texto sobre las cenefas (AA para el título y los datos).
- `npm test`, `build`, `lint:tokens`, `test:browser` ×3 y `test:anchos`. `visual:capture` se acepta solo con el visto bueno del usuario.
- Recorrido en staging con visitante, usuario nuevo (alta completa con el buzón de pruebas), colaborador y admin.
- `decisiones.md` con una sección por etapa, `estado.md`, y capturas en `docs/modernizacion/capturas-u34/`.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: QA transversal y criterio para aceptar baselines.
  - Escalar si `test:browser` queda intermitente.

## 6. Decisiones abiertas (U26-0)

| # | Pregunta | Recomendación |
| --- | --- | --- |
| D1 | ¿Pulso A (campo vivo) o A2 (late donde estuvo el cursor)? | **A2.** Es la última iteración y la que siguió el feedback del pulso. |
| D2 | ¿Mis aportes lo ve solo su dueño? Lleva notas del equipo y borradores. | **Solo el dueño.** El público ve las colecciones públicas. |
| D3 | «…la biblioteca de electrónica sudaca más grande del mundo» no es verificable, y el memo de marketing pide afirmaciones verificables. | Quitar «más grande del mundo»: «Haz parte de la biblioteca de electrónica sudaca». O conservarla si hay una cifra que la sostenga. |
| D4 | «Revisa tu correo»: ¿Gmail y Outlook siempre, o solo el que coincide con el dominio del correo? | **Siempre los dos**, como en el lienzo. Es más simple y no adivina. |
| D5 | Perfil vacío: «+ Nueva colección» y el tile verde llevan a lo mismo, uno junto al otro. | Dejar los dos, como se aprobó. Si estorba en QA, quitar el del cabecero solo mientras no haya colecciones. |
| D6 | Tablero C, «Partitura» | Fuera de esta serie: las colecciones usan su mosaico y la cenefa troquelada. |
| D7 | Ficha de lanzamiento (modal y página) | Hereda tipo, botones e iconos. Sin layout nuevo. |

**U26-0 cerrada el 2026-11-10.** Respuestas del usuario:

- **D1:** A2. Se porta `PulsoB.dc.html`.
- **D2:** Mis aportes solo lo ve su dueño.
- **D3:** se quita el claim y el tono baja. El título de Entrar es «Haz parte de la biblioteca de electrónica sudaca». Este título manda sobre el que muestra el tablero E.
- **D4:** Gmail y Outlook, siempre los dos.
- **D5:** quedan los dos caminos, como se aprobó.
- **D6 y D7:** cerradas como propone la tabla.

## 7. Reglas de ejecución

- **Rama:** `direccion-arte`, desde `origin/main` (`b304175`, U25 en producción). El `main` local está atrasado: hay que hacer `git fetch` antes. Nunca se toca `main` ni `dist` a mano.
- **Commits:** escribir «aceptado» en el chat de la etapa hace commit en la rama y push de esa rama.
- **Publicación:** una sola vez, al cerrar U34. El cabecero, el perfil y el onboarding dependen entre sí, así que se fusiona `direccion-arte` en `main` y se publica con el workflow. No hay publicaciones parciales.
- **Datos:** sin migraciones ni cambios de RLS o RPC. Producción solo se consulta en lectura.
- **Lote de textos:** los textos que leen los tests (`getByRole`, `getByText`) se actualizan en el mismo cambio. Nunca se borra una prueba para que pase.
- **A/B:** nunca intercambiando archivos del árbol. La comparación es contra `.ref-pre-uNN`.
- **Archivos ajenos:** `docs/modernizacion/e22-corte-2026-10-25.md` sigue sin commit. Ninguna etapa lo toca ni lo incluye.
