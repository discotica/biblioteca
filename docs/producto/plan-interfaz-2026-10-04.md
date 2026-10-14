# Plan de ejecución por chats — Sistema de interfaz Discótica

> Desde el 2026-10-13, el orden de lo que queda (U18 y D3) lo fija el [plan de lanzamiento](./plan-lanzamiento-2026-10-13.md).

Fecha: 4 de octubre de 2026
Estado: plan ejecutable. U0 está cerrada; ninguna otra etapa está implementada.
Alcance: llevar todas las vistas del sitio y las herramientas internas a un único sistema de interfaz (tamaños, controles, órdenes y layouts en desktop y móvil), conservando la dirección visual actual.

## 1. Propósito

Este plan convierte las 64 decisiones de la ronda 3 en una secuencia que se ejecuta **una etapa por chat**, igual que el [plan de la biblioteca](./plan-ejecucion-biblioteca-2026-09-14.md). Cada etapa:

- resuelve una dependencia concreta;
- limita los archivos y comportamientos que puede tocar;
- define pruebas, aceptación y cuándo detenerse;
- deja un paquete de relevo para el chat siguiente.

No es un rediseño. Paleta, Work Sans, tono oscuro, portada protagonista y fondo ambiental desenfocado se conservan. Lo que cambia es que cada valor (tamaño, alto de control, radio, espaciado, breakpoint) sale de un solo sistema y cada vista ordena sus piezas según una regla común.

Los prompts listos para pegar, uno por etapa y con su modelo y esfuerzo, están en [`prompts-interfaz-2026-10-04.md`](./prompts-interfaz-2026-10-04.md).

## 2. Fuentes de verdad y precedencia

1. [`../modernizacion/decisiones.md`](../modernizacion/decisiones.md), sección "Interfaz — ronda 3". Es el registro normalizado y manda sobre todo lo demás.
2. Este plan, incluidas las interpretaciones de la sección 5.
3. [`censo-interfaz-2026-10-03.md`](./censo-interfaz-2026-10-03.md): por cada vista, rutas, archivos, cómo está construida, hallazgos y la respuesta literal de la ronda 3.
4. [`../modernizacion/respuestas-catalogo-ui.md`](../modernizacion/respuestas-catalogo-ui.md): respaldo literal de las 64 respuestas.
5. El plan de la biblioteca y sus documentos E00–E21 para todo lo que este plan no cambia (contratos de datos, roles, RLS, URL de búsqueda, historial del modal).

Si una respuesta literal del censo parece contradecir el registro de decisiones, manda el registro. Si dos fuentes del mismo nivel se contradicen, el chat se detiene y registra la evidencia; no decide por su cuenta.

## 3. Condición de arranque

- Según [`../modernizacion/estado.md`](../modernizacion/estado.md) (2026-09-24), E21 tiene dictamen **NO-GO** y E22 no ha empezado. El censo se tomó sobre ese mismo árbol, con cambios locales sin confirmar.
- **U1, U2 y el carril R** no cambian datos y pueden empezar en cuanto el equipo lo decida.
- **D1 y D2** crean migraciones. Solo se aplican en staging cuando el bloqueo de backup de E21 esté resuelto: no se añade esquema sobre un staging sin backup restaurable.
- **D3** necesita acceso humano al DNS de discotica.com y una cuenta de envío.
- **Recomendación:** ejecutar E22 (corte a producción) antes de U4. Así el corte no arrastra un cambio visual grande y cada uno tiene su propio rollback. Si el equipo decide lo contrario, debe registrarlo en `decisiones.md` antes de U4.

## 4. Decisiones que no deben volver a inferirse

El registro completo está en `decisiones.md` (ronda 3). Estas son las que más etapas tocan:

- **Lenguaje.** "Crate" desaparece de la interfaz: se dice "colección/colecciones". Base de datos y código conservan `crates`/`crate_items`. Las URLs nuevas son `/mis-colecciones` y `/coleccion/[slug]`, y las antiguas redirigen.
- **Créditos.**
  - Tarjeta: todos los artistas principales visibles (truncados si no caben). Con colaboradores, "Principal y N más" en texto y sin caja.
  - "Varios artistas" **solo** cuando el tipo es Compilado.
  - Ficha: todos los artistas, organizados por rol.
- **Ficha.**
  - Portada cuadrada fija a la izquierda, con recorte si hace falta, e información con scroll interno. Sin barras.
  - Acciones en una línea: Comprar y Añadir a colección con texto e icono; Compartir y Reportar solo con icono.
  - Reproductor completo; elegir una pista no mueve el scroll.
  - Móvil: portada a ancho completo y barra fija abajo. Dos columnas desde 680px.
  - Modal y página usan el mismo componente.
- **Descubrimiento.**
  - Máximo 3 columnas. Selector grilla/lista recordado.
  - Paginación numerada; en móvil comparte línea con "Ordenar por".
  - Móvil en tres líneas: buscar / filtros activos / paginación y orden.
  - El radar se ve al pasar el cursor; en móvil, tocar la portada equivale a ese hover. "Aleatorizar".
  - Hoja de filtros móvil con botón fijo "Ver lanzamientos".
- **Sistema.**
  - Iconos solo en SVG.
  - Barras de scroll propias.
  - Texto pequeño ~15% más legible.
  - Navegación principal en mayúsculas sostenidas.
  - Botones más anchos que altos (referencia: Comprar).
  - Estados vacíos y de error utilitarios.
  - Carga con esqueleto más indicador horizontal.
  - Migas en texto.
- **Cuenta.**
  - Entrar con usuario o correo.
  - Layout común para todas las pantallas de cuenta; entrar en dos columnas con tres beneficios.
  - Registro en un paso, agrupado, con contraseña en vivo y redes opcionales.
  - "Revisa tu correo" tras registrarse. Correos HTML desde hola@discotica.com.
  - Al confirmar se aterriza en Mis colecciones con aviso.
- **Comunidad.**
  - Sugerir por pasos; la nota de quien propone nunca es obligatoria.
  - Listas con chips y buscador.
  - "Mis aportes" en filas compactas.
  - Perfil público con colecciones, redes y aportes aceptados si su dueño lo permite.
  - Colecciones en mosaico de 4 portadas con menú "…".
  - Dentro de una colección: acciones explícitas arriba, grilla o lista, sin notas visibles; se reordena arrastrando.
- **Herramienta interna.**
  - Una sola herramienta con secciones Catálogo, Propuestas y Reportes. Layout propio con barra lateral y ancho completo; lenguaje visual dedicado, como YouTube Studio respecto de YouTube.
  - Vistas rápidas y publicar/archivar en lote.
  - Editor en una página con índice lateral, más compacto, con combobox y chips, sin vista previa y con edición completa en móvil.
  - Propuestas en bandeja, con los campos editados marcados.

## 5. Interpretaciones por confirmar

Tres respuestas eran ambiguas. Cada etapa aplica la interpretación por defecto salvo que `decisiones.md` diga otra cosa antes de empezar.

| # | Respuesta original | Interpretación por defecto | Etapa |
| --- | --- | --- | --- |
| I1 | Acciones de la ficha: "compartir y añadir a crate son dos botones con texto e icono, (…) reportar y compartir solo icono" | El primer "compartir" es **Comprar**. Quedan: Comprar y Añadir a colección con texto; Compartir y Reportar solo icono. | U9 |
| I2 | Header: "Salir está bien donde está, sin embargo, creo que hace falta un logo" | El header ya tiene logo; se entiende que falta un **icono SVG en Salir**, como pide también la respuesta de búsqueda. | U5, U7 |
| I3 | Herramientas "desde el perfil" + nombre de la herramienta única | El perfil propio de admin y colaborador muestra un acceso. Nombre de trabajo: **Estudio**, en `/estudio`, con `/admin/catalogo` y `/editorial` redirigiendo. | U7, U15 |

Además, sin pregunta explícita, el plan fija estos valores por defecto:

- **"Mis aportes"** es una página propia (`/mis-aportes`), enlazada desde el perfil propio y desde el menú de cuenta, que queda así: Perfil, Mis colecciones, Mis aportes, Salir.
- **Hoja de filtros móvil:** se quita el botón de texto "Cerrar". Quedan un × en la cabecera (descartar, como en todo overlay) y el botón fijo "Ver N lanzamientos" (aplicar), con el número cuando esté disponible.
- **Header móvil sin sesión:** "Entrar" lleno y "Sugerir" con borde, los dos con la misma altura y padding (más anchos que altos). Entrar deja de dominar por tamaño, no por color.
- **Recuadro de la bienvenida:** lleva ilustración de marca. La opción "con imagen real" se refería al bloque grande, no a una fotografía.

## 6. Contrato obligatorio para todos los chats

Se aplica completo el contrato de la sección 6 del [plan de la biblioteca](./plan-ejecucion-biblioteca-2026-09-14.md#6-contrato-obligatorio-para-todos-los-chats-de-ejecución):

- inicio del chat;
- manejo de feedback;
- cierre con paquete de relevo;
- disciplina de versiones: sin commit, push ni despliegue salvo pedido expreso.

Para este plan se añade lo siguiente:

1. **Regresión visual.**
   - Desde que U1 cierre, cada chat ejecuta la suite de capturas antes y después de editar.
   - Las diferencias fuera del alcance de la etapa son regresiones.
   - El cierre adjunta la lista de capturas que cambiaron, con su motivo.
2. **Matriz mínima.** Cada vista tocada se verifica:
   - a 390, 834 y 1440px;
   - además a 680 y 1112px si la etapa toca la ficha;
   - con el rol que corresponda.
3. **Sin valores literales.** Desde U4 no se añaden colores, tamaños de fuente, radios, alturas de control ni breakpoints literales en componentes. Si falta un token, se añade al sistema y se documenta; no se inventa en el componente.
4. **Primitivas primero.** Desde U5–U6, una vista no crea su propio botón, chip, menú, campo o paginación. Si la primitiva no cubre un caso, se extiende la primitiva y se muestra en `/lab`.
5. **Accesibilidad.**
   - Objetivos táctiles de 44px.
   - Foco visible.
   - Contraste de texto ≥ 4.5:1.
   - Los iconos solos llevan nombre accesible y tooltip.
   - Se respeta `prefers-reduced-motion`.
6. **Textos.** Español neutro de Discótica. Nunca códigos internos (E06, E09, U4…) en la interfaz.
7. **Cambios de producto.** Si una etapa descubre que una decisión no se puede cumplir tal cual, se detiene y la registra para decisión humana; no la sustituye por otra.

## 7. Criterio de modelo y esfuerzo

Este plan se ejecuta con modelos de Claude. Antes de pegar el prompt de una etapa, elige en Claude Code el modelo indicado (`/model`) y su nivel de esfuerzo. Las etapas E00–E23 de la biblioteca conservan su asignación original; este criterio solo aplica a este plan.

| Modelo | ID | En este plan |
| --- | --- | --- |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Documentación mecánica y ajustes de copy sin comportamiento. No se asigna a ninguna etapa por defecto. |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | Primitivas y vistas delimitadas, sin datos ni gestos complejos |
| Claude Opus 5.5 | `claude-opus-5-5` | Refactors de muchos archivos, migraciones y RLS, scroll e iframes, flujos completos, Estudio y QA integral |

Niveles de esfuerzo:

- `medium` cuando el contrato y los archivos están acotados.
- `high` cuando hay varios estados o casos límite.
- `xhigh` solo para riesgo sistémico: la ficha, el lote auditado y la QA final.
- `max` nunca es el valor inicial. Si `xhigh` no basta, primero se divide la etapa o se aísla la pregunta bloqueante.

Para escalar:

- **Subir un nivel de esfuerzo** cuando el problema sea profundidad dentro del mismo alcance.
- **Pasar de Sonnet a Opus** cuando aparezca otra clase de problema: datos, RLS, scroll o historial no deterministas, o una contradicción entre contratos.
- **Tras dos intentos fallidos** sobre la misma causa, detenerse y registrar la evidencia.
- **Para feedback solo visual o de copy** dentro de una etapa ya hecha, puede bajarse a Sonnet o Haiku.

Si Opus 5.5 no está disponible, no se sustituye por Sonnet en D1, D2, D3, U15 ni U18: el chat se detiene y pide una decisión humana.

## 8. Mapa de dependencias

```text
U0 Decisiones (cerrada)
 ├─ U1 Línea base y regresión visual
 │   ├─ U2 Saneamiento sin cambio visual
 │   │   └─ U3 Colecciones: lenguaje y URLs
 │   ├─ R1 Ficha y reproductor: errores
 │   └─ R2 Errores visibles menores
 ├─ D1 Datos de perfil y colecciones      (tras backup de E21)
 ├─ D2 Datos del Estudio                  (tras backup de E21)
 └─ D3 Correo propio y plantillas         (gate humano: DNS y proveedor)

U2 + R1 + R2
 └─ U4 Tokens v2
     └─ U5 Primitivas base
         └─ U6 Primitivas compuestas
             ├─ U7 Shell y layouts
             │   ├─ U10 Inicio y búsqueda ........ (+ U8)
             │   ├─ U11 Bienvenida, beta, artista y sello (+ U8)
             │   ├─ U12 Cuenta ................... (+ D1)
             │   ├─ U13 Sugerir y reportar ....... (+ U9)
             │   ├─ U14 Perfil, aportes y colecciones (+ U3, U8, D1)
             │   └─ U15 Estudio: estructura y catálogo (+ D2)
             │       ├─ U16 Estudio: editor
             │       └─ U17 Estudio: propuestas y reportes
             └─ U8 Tarjeta y modo lista
                 └─ U9 Ficha: modal, página y móvil (+ R1)

Todas
 └─ U18 QA integral y candidato
```

Las ramas muestran dependencias lógicas; no autorizan dos chats a la vez sobre el mismo árbol de trabajo. D3 es independiente de la interfaz y puede ejecutarse en cuanto el gate humano esté listo.

## 9. Resumen de etapas

| ID | Etapa | Modelo | Esfuerzo | Resultado principal | Riesgo |
| --- | --- | --- | --- | --- | --- |
| U0 | Decisiones de dirección | — | — | Ronda 3 registrada (cerrada 2026-10-04) | — |
| U1 | Línea base y regresión visual | Opus 5.5 | `high` | Suite de capturas reproducible y línea base | Medio |
| U2 | Saneamiento sin cambio visual | Opus 5.5 | `high` | Código muerto fuera e inicio partido en módulos | Medio |
| U3 | Colecciones: lenguaje y URLs | Sonnet 5.5 | `high` | "Colección" en toda la interfaz; URLs viejas redirigen | Medio |
| R1 | Ficha y reproductor: errores | Opus 5.5 | `high` | Reproductor sin aplastarse ni saltos de scroll | Alto |
| R2 | Errores visibles menores | Sonnet 5.5 | `medium` | Créditos, menús, desbordes y textos corregidos | Bajo |
| D1 | Datos de perfil y colecciones | Opus 5.5 | `high` | Redes, visibilidad de aportes y orden manual en DB | Alto |
| D2 | Datos del Estudio | Opus 5.5 | `xhigh` | Lote auditado y señales para vistas rápidas | Alto |
| D3 | Correo propio y plantillas | Opus 5.5 | `high` | Correos HTML desde hola@discotica.com | Alto |
| U4 | Tokens v2 | Opus 5.5 | `high` | Escalas cerradas y lint de literales | Medio |
| U5 | Primitivas base | Sonnet 5.5 | `high` | Botón, icono, campo, chip, paginación y otras en `/lab` | Medio |
| U6 | Primitivas compuestas | Opus 5.5 | `high` | Combobox, menú, diálogo/hoja, ordenable, portada y créditos | Alto |
| U7 | Shell y layouts | Sonnet 5.5 | `high` | Header, menú de cuenta, contenedores y layouts | Medio |
| U8 | Tarjeta y modo lista | Sonnet 5.5 | `high` | Tarjeta y fila sobre las mismas piezas | Medio |
| U9 | Ficha: modal, página y móvil | Opus 5.5 | `xhigh` | Ficha sin barras, con acciones en una línea | Alto |
| U10 | Inicio y búsqueda | Opus 5.5 | `high` | Orden móvil en 3 líneas, panel compacto y hoja con CTA | Alto |
| U11 | Bienvenida, beta, artista y sello | Sonnet 5.5 | `medium` | Bienvenida permanente, diálogo beta y migas | Bajo |
| U12 | Cuenta | Sonnet 5.5 | `high` | Layout común, usuario o correo, registro y "Revisa tu correo" | Medio |
| U13 | Sugerir y reportar | Opus 5.5 | `high` | Sugerir por pasos con nota opcional | Alto |
| U14 | Perfil, aportes y colecciones | Opus 5.5 | `high` | Mis aportes, perfil público, mosaicos y reordenar | Alto |
| U15 | Estudio: estructura y catálogo | Opus 5.5 | `high` | Una herramienta, vistas rápidas y lote | Alto |
| U16 | Estudio: editor | Opus 5.5 | `high` | Editor compacto con índice, usable en móvil | Alto |
| U17 | Estudio: propuestas y reportes | Opus 5.5 | `high` | Bandeja con campos editados marcados | Alto |
| U18 | QA integral y candidato | Opus 5.5 | `xhigh` | Matriz completa y go/no-go | Alto |

## 10. Etapas detalladas

### U0 — Decisiones de dirección

**Estado:** cerrada el 2026-10-04.

Las 64 respuestas están en `respuestas-catalogo-ui.md`, normalizadas en `decisiones.md` (ronda 3) y cruzadas con el censo en `censo-interfaz-2026-10-03.md`. Quedan tres interpretaciones por confirmar (sección 5) que no bloquean el arranque.

---

### U1 — Línea base y regresión visual

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** sesiones simuladas, mocks de PostgREST y capturas deterministas en tres anchos y cuatro roles.
- **Escalar solo si:** las capturas no son estables entre dos corridas seguidas sin cambios de código. Subir a `xhigh`.

**Depende de:** U0.

**Objetivo**
Tener la línea base antes de tocar nada, para que cada etapa demuestre qué cambió y qué no.

**Trabajo**

1. Convertir `anexos/censo-interfaz-captura-2026-10-03.mjs` en una suite reproducible dentro del repositorio (`tests/visual/` o `scripts/censo-interfaz.mjs` con su comando en `package.json`):
   - sin rutas absolutas;
   - con datos de muestra versionados o regenerables desde staging en solo lectura;
   - servidor propio en un puerto libre.
2. Cubrir los mismos 127 IDs de captura del censo (126 estados más 1 diagnóstico) en D 1440, T 834 y M 390.
3. Hacer que las capturas sean deterministas:
   - animaciones desactivadas;
   - reloj fijo;
   - portadas y embeds externos con respaldo local;
   - esperas por estado y no por tiempo cuando sea posible.
4. Añadir comparación contra la línea base, con umbral por píxeles, y un informe de diferencias.
5. Guardar la línea base fuera del bundle público. Documentar dónde vive y cómo se regenera.
6. Documentar en el propio archivo cómo usarla en cada etapa.

**Pruebas**

- Dos corridas seguidas sin cambios dan cero diferencias.
- Un cambio de color deliberado en un token aparece en el informe y se revierte.

**Aceptación**

- `npm run` tiene un comando de captura y otro de comparación.
- Las sesiones simuladas no escriben nada remoto y no usan secretos fuera de `.env.local`.

---

### U2 — Saneamiento sin cambio visual

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** refactor de varios archivos, incluido el inicio de 1.412 líneas con estado de URL, modal, hoja y gestos.
- **Escalar solo si:** al partir `routes/+page.svelte` cambia el comportamiento de URL o historial y las pruebas E12, E13, E15 o E17 no lo explican. Subir a `xhigh`.

**Depende de:** U1.

**Objetivo**
Quitar lo que hoy impide cambiar un valor en un solo lugar, sin cambiar lo que se ve.

**Trabajo**

1. Borrar código muerto:
   - `src/app.css`;
   - la variante `detail` de `LanzamientoCard` y su segundo reproductor.
2. Corregir tokens:
   - definir `--radius-md` o reemplazar sus usos por un token existente;
   - pasar `#8cff18` de la consola al token de acento.
3. Quitar códigos internos de los textos visibles ("E06", "E09"…).
4. Partir `routes/+page.svelte` en módulos (estado y URL, hoja móvil, barra de resultados, estilos) sin cambiar el marcado resultante.

**Pruebas**

- `npm test`, `npm run build` y `npm run test:browser` en verde.
- Suite visual de U1: cero diferencias, salvo textos y las esquinas de `--radius-md`. Cada diferencia se lista.

**Aceptación**

- Ningún archivo de interfaz supera ~500 líneas sin motivo documentado.
- No queda ninguna referencia a archivos borrados.

---

### U3 — Colecciones: lenguaje y URLs

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** copy y rutas acotados, con redirecciones en un sitio estático.
- **Escalar solo si:** las redirecciones exigen cambiar el despliegue o rompen enlaces compartidos. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U2.

**Objetivo**
Que la palabra "crate" desaparezca de la interfaz sin romper un solo enlace compartido.

**Trabajo**

1. Reemplazar en toda la interfaz "crate/crates" por "colección/colecciones": títulos, botones, menús, vacíos, toasts, `aria-label`, manual, privacidad, invitación beta y bienvenida.
2. Crear `/mis-colecciones` y `/coleccion/[slug]`. `/mis-crates` y `/crate/[slug]` redirigen conservando query y hash:
   - en la app, con una redirección de cliente;
   - en `static/.htaccess`, con un 301.
3. Actualizar todos los enlaces internos y los destinos de autenticación que apunten a las rutas viejas.
4. No renombrar tablas, columnas, stores ni tipos. Si se renombran identificadores de interfaz, que sea dentro de los archivos tocados y sin cambiar contratos.

**Pruebas**

- Un enlace viejo de colección pública abre la nueva URL con el mismo contenido.
- Búsqueda de texto: cero apariciones visibles de "crate" (se permiten en código y SQL).

**Aceptación**

- La suite visual solo cambia en textos.

---

### R1 — Ficha y reproductor: errores

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** iframes de terceros, scroll interno y foco; el comportamiento varía entre navegadores.
- **Escalar solo si:** el salto de scroll al elegir una pista viene del iframe del proveedor y no se puede contener desde el contenedor. Subir a `xhigh` y documentar los límites por proveedor.

**Depende de:** U1.

**Objetivo**
Corregir ya los errores graves de la ficha, sin esperar al sistema nuevo.

**Trabajo**

1. Reproductor aplastado en desktop: los hijos de la columna de información no deben encogerse (`flex-shrink: 0` o equivalente). El marco conserva su alto por proveedor: Bandcamp 290 (bajado de 380 el 2026-10-05 por espacio sobrante en listas cortas), SoundCloud 300, Spotify 352.
2. Elegir una pista dentro del reproductor no mueve el scroll de la ficha ni del documento:
   - reproducir el caso en Bandcamp, SoundCloud y Spotify;
   - contenerlo (por ejemplo, con `overflow-anchor` o fijando el scroll ante cambios de foco hacia el iframe);
   - documentar lo que dependa del proveedor.
3. El menú de "Añadir a colección" no se corta contra el borde del modal; se renderiza en portal.
4. El menú de "Varios artistas" de la tarjeta no queda tapado por la grilla.

**Pruebas**

- Pruebas de navegador nuevas en `tests/browser` para cada punto, a 1440 y 390.
- Las pruebas E16 y E17 siguen en verde.

**Aceptación**

- Con el reproductor de cada proveedor, elegir la tercera pista deja el scroll donde estaba (tolerancia 4px).

---

### R2 — Errores visibles menores

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `medium`.
- **Motivo:** correcciones puntuales y bien localizadas.
- **Escalar solo si:** la regla de créditos exige cambiar el contrato de datos. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U1.

**Trabajo**

1. Regla de créditos única en `src/lib/domain/releases.ts`:
   - "Varios artistas" solo si `releaseType === 'Compilado'`;
   - si no, todos los principales y, con colaboradores, "y N más".
   - Las tres reglas actuales pasan a usar esta. Pruebas de unidad en `tests/release-domain.test.mjs`.
2. Espacio después de la coma en las listas de créditos. Es un problema de recorte de espacios de Svelte 5: la separación no puede depender del espacio final dentro de un `span`.
3. En la hoja de filtros móvil, las opciones largas no desbordan la columna.
4. Enlace azul en el éxito del registro: usar el color del sistema.
5. Portada rota o ausente: logo de Discótica atenuado.
6. Página de error y 404 en español.
7. Estados de reportes traducidos.
8. "Randomizar" pasa a "Aleatorizar".

**Pruebas**

- Unidad para la regla de créditos: compilado, un principal, varios principales, principal con colaboradores y nombres largos.
- Navegador para el desborde de la hoja a 390.

**Aceptación**

- La suite visual solo cambia en los puntos listados.

---

### D1 — Datos de perfil y colecciones

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** migraciones y RLS sobre perfiles y colecciones.
- **Escalar solo si:** el orden manual exige reescribir políticas de `crate_items` que hoy protegen colecciones públicas, o aparece drift en staging. Subir a `xhigh`.

**Depende de:** U0 y backup restaurable de staging (bloqueo de E21).

**Trabajo**

1. Redes sociales en `profiles`:
   - campos opcionales para Bandcamp, SoundCloud, Instagram, X/Twitter y Facebook;
   - se guarda el usuario o handle, no URLs libres: validación de formato por red en la base y en el cliente;
   - la URL pública se construye en el dominio de cliente.
2. Visibilidad de aportes:
   - preferencia en `profiles` para mostrar o no los aportes aceptados en el perfil público (valor por defecto: no);
   - lectura pública solo de aportes aceptados de perfiles que lo permitan, sin exponer borradores, rechazados ni notas del revisor.
3. Orden manual de colecciones:
   - posición por elemento en `crate_items`, con backfill a partir de `added_at`;
   - política o RPC para que solo el dueño reordene;
   - un solo cambio de orden es atómico.
4. Tipos y servicios de cliente para todo lo anterior, sin interfaz nueva.

**Pruebas**

- Migración aplicada en staging, con advisors revisados.
- Pruebas SQL de RLS:
  - un anónimo no ve aportes de perfiles que no lo permiten;
  - nadie reordena colecciones ajenas;
  - un reordenamiento concurrente no deja posiciones duplicadas.

**Aceptación**

- Rollback documentado: una migración posterior; nunca borrar el archivo.
- `decisiones.md` y `estado.md` actualizados.

---

### D2 — Datos del Estudio: lote y vistas rápidas

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `xhigh`.
- **Motivo:** extiende el servicio de mutaciones auditadas de E06 con operaciones en lote. Es una frontera de confianza.
- **Escalar solo si:** no aplica. Si el lote no cabe en el contrato auditado, detenerse y pedir decisión humana.

**Depende de:** U0 y backup restaurable de staging.

**Trabajo**

1. Publicar o archivar en lote:
   - RPC solo para admin, que aplica la misma validación y auditoría que la operación individual por cada lanzamiento;
   - todo o nada;
   - límite de tamaño por lote;
   - informe por elemento.
2. Señales para las vistas rápidas del catálogo en el contrato de lectura administrativa: borrador, incompleto (con criterio explícito y documentado), sin portada y con reportes abiertos.
3. Servicio de cliente en `adminCatalog.ts` y tipos.

**Pruebas**

- RLS y permisos: un colaborador o la comunidad no pueden ejecutar el lote.
- Un lote con un elemento inválido no cambia nada.
- La auditoría registra cada lanzamiento.
- Advisors revisados.

**Aceptación**

- Contrato documentado en `docs/modernizacion/` con ejemplo de respuesta y rollback.

---

### D3 — Correo propio y plantillas

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** configuración de Auth, DNS y proveedor externo con gates humanos.
- **Escalar solo si:** el proveedor o el DNS fallan en la verificación. No sustituir el remitente sin decisión humana.

**Depende de:** U0, más un gate humano: acceso al DNS de discotica.com y cuenta en un proveedor SMTP con plan gratuito suficiente.

**Trabajo**

1. Proponer el proveedor y esperar aprobación humana antes de crear cuentas o registros DNS. El chat nunca escribe secretos en el repositorio.
2. Configurar SMTP propio en Supabase Auth con remitente hola@discotica.com y verificar SPF, DKIM y DMARC.
3. Versionar plantillas HTML en `supabase/templates/` y referenciarlas en `supabase/config.toml`:
   - confirmación de registro;
   - recuperación de contraseña;
   - cambio de correo.
   Las plantillas son HTML sencillo, con logo y botón verde, en español y con versión en texto plano.
4. Aterrizaje tras confirmar: Mis colecciones con aviso. Coordinar el destino con U12, que cambia `emailRedirectTo`.

**Pruebas**

- Envío real a una cuenta de prueba en staging.
- Revisión en Gmail web, Gmail móvil y Apple Mail.
- Enlaces correctos al entorno.

**Aceptación**

- Los correos llegan a la bandeja de entrada, no al spam, desde hola@discotica.com.
- Registros DNS y configuración documentados sin secretos.

---

### U4 — Tokens v2

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** toca el CSS de todo el sitio con equivalencia visual verificada.
- **Escalar solo si:** el ajuste de escalas produce diferencias visuales que no se pueden clasificar como intencionales. Subir a `xhigh`.

**Depende de:** U2, R1 y R2.

**Objetivo**
Escalas cerradas sobre la paleta actual, sin cambiar la dirección visual.

**Trabajo**

1. Tipografía de 8 a 9 pasos. El paso más pequeño sube lo necesario para que los metadatos sean ~15% más legibles, sin cambiar el tamaño de la tarjeta.
2. Espaciado sobre base 4/8. Radios: 4 valores más pill.
3. Superficies, bordes y texto con alfa como tokens: de 346 literales a unos 16.
4. Alturas de control 32 · 40 · 44 · 52, con padding horizontal mayor que el vertical. Referencia: el botón Comprar.
5. Breakpoints: 480 · 680 · 768 · 1024 · 1280. Se conserva 680 porque es el corte de la ficha.
6. Capas y motion.
7. Estilo de navegación en mayúsculas sostenidas como token tipográfico.
8. Barras de scroll propias, discretas y en la paleta, para todo el sitio y los scroll internos.
9. Tokens del Estudio: misma paleta y otra densidad, preparados para U15.
10. Regla de lint (Stylelint o script) que rechaza colores, tamaños, radios y breakpoints literales nuevos en componentes, con una lista temporal de excepciones que se vacía en las etapas siguientes.

**Pruebas**

- Suite visual con todas las diferencias clasificadas.
- Contraste ≥ 4.5:1 en texto pequeño.

**Aceptación**

- El lint corre en CI y falla con un literal nuevo.

---

### U5 — Primitivas base

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** componentes delimitados con estados conocidos.
- **Escalar solo si:** una primitiva exige gestionar foco entre capas u overlays. Ese caso pasa a U6.

**Depende de:** U4.

**Trabajo**

Crear en `src/lib/ui/` (o en la carpeta de componentes que el repositorio ya use para esto), cada una con todos sus estados:

1. **Iconos SVG:**
   - buscar, salir, compartir, reportar, menú, cerrar, flechas, grilla, lista, "…", redes sociales;
   - el icono de menú se redibuja con tres barras regulares;
   - se retiran todos los emoji de la interfaz.
2. **Button e IconButton:**
   - variantes primario, secundario, ghost, destructivo y enlace;
   - tamaños sm, md y lg sobre las alturas de U4;
   - el icono solo lleva nombre accesible y tooltip.
3. **Field, Textarea y PasswordField.** PasswordField muestra en vivo las reglas y la fortaleza.
4. **Chip** en tres usos: filtro activo compacto, género y estado.
5. **Pagination:**
   - el texto queda alineado con los botones;
   - variante compacta que comparte línea con "Ordenar por" a 390.
6. **ViewToggle** grilla/lista, que recuerda la elección por contexto con almacenamiento local seguro.
7. **Skeleton** de tarjeta y de fila, más el indicador de carga actual con las barras en horizontal.
8. **EmptyState y ErrorState** utilitarios: mensaje corto y una acción.
9. **Breadcrumbs** en texto ("Catálogo › Artista").
10. **Página interna `/lab`** con todas las variantes y estados. No se enlaza ni se publica en la navegación.

**Pruebas**

- `/lab` a 390 y 1440.
- Teclado y foco.
- Objetivos táctiles de 44px.

**Aceptación**

- Cada primitiva sale solo de tokens de U4. El lint pasa.

---

### U6 — Primitivas compuestas

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** patrones ARIA complejos (combobox, menú, ordenable) sobre `overlay.ts`.
- **Escalar solo si:** arrastrar en táctil choca con el scroll o con los gestos de la hoja móvil. Subir a `xhigh`.

**Depende de:** U5.

**Trabajo**

1. **Combobox con chips:**
   - búsqueda;
   - crear un valor nuevo cuando el contexto lo permita;
   - chips seleccionados que se quitan con teclado;
   - lo usan Sugerir y el Estudio.
2. **Menu "…"** en portal, que nunca se corta contra un contenedor.
3. **Dialog y Sheet** sobre `overlay.ts`:
   - la hoja admite altura según contenido y pie fijo con acción primaria;
   - el diálogo admite contenido con scroll interno.
4. **Sortable:** arrastrar con ratón y táctil, con alternativa de teclado (mover arriba o abajo) y anuncio para lectores de pantalla.
5. **Cover:**
   - siempre cuadrada, con recorte (`object-fit: cover`);
   - logo de Discótica atenuado como respaldo;
   - fondo ambiental desenfocado opcional.
6. **CreditLine:**
   - aplica la regla de créditos de R2;
   - trunca los nombres con elipsis sin ocultar el sufijo "y N más";
   - variante para la ficha con todos los artistas por rol.
7. **SocialLinks:** iconos de las cinco redes a partir de los handles de D1.
8. Todo se añade a `/lab`.

**Pruebas**

- Teclado completo en combobox, menú y ordenable.
- Lector de pantalla básico (VoiceOver) en combobox y ordenable.
- Táctil a 390.

**Aceptación**

- Ningún menú se corta en el modal ni en la tabla del Estudio.

---

### U7 — Shell y layouts

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** composición sobre primitivas ya probadas.
- **Escalar solo si:** el header choca con el comportamiento de scroll acordado en E14 o con la barra de búsqueda móvil de E15. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U6.

**Trabajo**

1. **Header:**
   - navegación principal en mayúsculas sostenidas;
   - botones del sistema, más anchos que altos;
   - en móvil sin sesión, "Entrar" lleno y "Sugerir" con borde, del mismo tamaño;
   - icono de menú nuevo;
   - Salir con icono.
2. **Con sesión en desktop:** avatar con menú de cuenta (Perfil, Mis colecciones, Mis aportes, Salir). En móvil, lo mismo dentro del menú.
3. **Acceso a herramientas:** el perfil propio de admin y colaborador muestra un acceso al Estudio. No se añade al header.
4. **Contenedores:** estrecho, regular, ancho y completo. Ninguna ruta define su propio ancho.
5. **Layouts:**
   - **cuenta:** título, ayuda, formulario y pie, con variante de dos columnas;
   - **lectura:** para el manual y la privacidad, con mejor tipografía;
   - **herramienta:** barra lateral y ancho completo, para U15.
6. **Patrón de retorno:** migas.
7. **`+error.svelte` definitivo**, con ErrorState.

**Pruebas**

- Anónimo, comunidad, colaborador y admin, a 390 y 1440.
- Teclado en el menú de cuenta.
- Las pruebas E14 y E15 siguen en verde.

**Aceptación**

- Ninguna ruta define su propio ancho, título o botón de volver.

---

### U8 — Tarjeta y modo lista

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** componente central pero delimitado.
- **Escalar solo si:** tocar la portada para ver el radar en móvil interfiere con abrir la ficha o con el scroll. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U6.

**Trabajo**

1. **Tarjeta:**
   - Cover y CreditLine;
   - metadatos año · país · sello y géneros, con el paso tipográfico nuevo;
   - compartir como IconButton discreto;
   - altura estable aunque cambie la longitud de los textos.
2. **Radar:**
   - en desktop, al pasar el cursor (como hoy);
   - en táctil, el primer toque sobre la portada muestra el radar y el segundo abre la ficha (o el patrón equivalente que se pruebe mejor);
   - se documenta el comportamiento elegido.
3. **Fila** para el modo lista: mismas piezas, versión densa.
4. La grilla nunca pasa de 3 columnas.

**Pruebas**

- Créditos: compilado, varios principales con nombres largos, principal con colaboradores.
- Táctil a 390.
- Suite visual.

**Aceptación**

- La misma CreditLine en tarjeta, fila y ficha.

---

### U9 — Ficha: modal, página y móvil

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `xhigh`.
- **Motivo:** la misma geometría en modal, página y móvil, con scroll interno, iframes e historial del modal. Es el antecedente de E16.
- **Escalar solo si:** no aplica. Si la geometría no cumple en algún ancho, detenerse y documentarlo.

**Depende de:** U8 y R1.

**Trabajo**

1. **Desktop, desde 680px:**
   - portada cuadrada fija a la izquierda, a la altura útil;
   - el diálogo se ajusta para que no queden barras arriba ni abajo;
   - información con scroll interno a la derecha, donde todo cabe cómodo.
2. **Acciones en una sola línea** (I1): Comprar y Añadir a colección con texto e icono; Compartir y Reportar como IconButton.
3. **Reproductor** completo con lista de pistas, sobre el arreglo de R1.
4. **Créditos completos por rol** (artistas principales, colaboradores) con la variante de CreditLine.
5. **Móvil:**
   - portada a ancho completo;
   - barra de acciones fija abajo, que respeta el safe area.
6. **Página `/lanzamiento/[slug]`:**
   - mismo componente que el modal, con la distribución optimizada;
   - fondo desenfocado como el del modal en lugar del gris;
   - "Explorar el catálogo" rediseñado como botón o miga del sistema;
   - mismas acciones.
7. Tablet vertical (834): verificar que la portada no quede diminuta. Si hace falta, ajustar proporciones sin cambiar el corte de 680.

**Pruebas**

- Matriz 390 · 680 · 834 · 1112 · 1440, en modal y en página.
- Con portada, sin portada, título muy largo, reseña larga y cada proveedor.
- E16 y E17 en verde.

**Aceptación**

- Cero barras.
- El reproductor nunca se solapa con las acciones.
- La misma ficha en modal y en página.

---

### U10 — Inicio y búsqueda

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** estado de URL, hoja móvil con gestos y barra sticky de E15.
- **Escalar solo si:** el orden nuevo en móvil choca con el comportamiento sticky acordado en E15. Subir a `xhigh`.

**Depende de:** U7 y U8.

**Trabajo**

1. **Móvil**, antes de la primera portada, en tres líneas:
   1. buscar;
   2. filtros activos en una banda horizontal desplazable, con chips compactos de menos altura y mejor padding;
   3. paginación y "Ordenar por" en la misma línea.
2. **Desktop:**
   - el panel actual con filtros y radar se mantiene y se compacta para recuperar espacio;
   - el campo de texto es más alto y ~15% más visible;
   - "Reiniciar filtros" es un botón secundario cohesionado con el panel.
3. **Radar:** en móvil, la palabra RADAR aparece solo en el desplegable cerrado. "Aleatorizar" como acción secundaria. Cinco puntos por eje.
4. **Hoja de filtros móvil:**
   - altura según contenido;
   - × en la cabecera;
   - botón fijo "Ver N lanzamientos";
   - sin botón "Cerrar" de texto.
5. **ViewToggle** grilla/lista en el inicio, recordado.
6. **Carga** con esqueleto e indicador horizontal.
7. **Estados vacíos y de error** con EmptyState y ErrorState.

**Pruebas**

- E12, E13 y E15 en verde.
- 390×844: la primera portada asoma sin scroll con un filtro activo.
- Paginación y orden en una línea a 360.

**Aceptación**

- La paginación tiene el mismo diseño en el inicio, el artista, el sello y las colecciones.

---

### U11 — Bienvenida, beta, artista y sello

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `medium`.
- **Motivo:** composición sobre piezas existentes.
- **Escalar solo si:** separar la beta de la bienvenida rompe las reglas de E19 y E20. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U7 y U8.

**Trabajo**

1. **Bienvenida editorial:**
   - componente permanente del inicio, en bloque grande;
   - espacio para la ilustración de marca, reemplazable por el equipo;
   - se conservan las reglas de sesión de E20, salvo que `decisiones.md` diga otra cosa.
2. **Invitación beta:** diálogo propio, distinto de la bienvenida, con las reglas de E19.
3. **Artista y sello:**
   - cabecera solo con el nombre, alineado a la izquierda;
   - migas "Catálogo › Artista" y "Catálogo › Sello";
   - sin filtros internos;
   - paginación del sistema.

**Pruebas**

- E19 y E20 en verde.
- 390 y 1440.

---

### U12 — Cuenta: entrar, registro y correo

**Perfil de ejecución**

- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** formularios sobre el layout de cuenta, más un cambio de autenticación acotado.
- **Escalar solo si:** entrar con correo interfiere con `login-with-username`, con la sesión o con los límites de intento. Pasar a Opus 5.5 con esfuerzo `high`.

**Depende de:** U7 y D1.

**Trabajo**

1. **Layout de cuenta** en entrar, registro, recuperar, nueva contraseña y cuenta confirmada.
2. **Entrar:**
   - dos columnas en desktop: beneficios a la izquierda (colecciones, compartirlas, aportar lanzamientos) y formulario a la derecha;
   - en móvil, primero el formulario y después los beneficios;
   - un campo "Usuario o correo": con `@` entra por correo con Supabase Auth; si no, usa `login-with-username`;
   - errores genéricos en los dos casos.
3. **Registro:**
   - un paso, con los campos agrupados por categoría;
   - PasswordField con reglas y fortaleza en vivo;
   - sección opcional de redes (D1), con la aclaración de que es voluntaria y ayuda a que otras personas te encuentren y te sigan.
4. **"Revisa tu correo"** tras registrarse:
   - muestra el correo;
   - "Reenviar", con espera entre envíos;
   - "Abrir correo", con enlace al webmail de los dominios comunes (Gmail, Outlook, iCloud) y sin enlace para los demás.
5. **Aterrizaje:** `emailRedirectTo` lleva a Mis colecciones con un aviso de cuenta confirmada.

**Pruebas**

- Navegador: entrar con usuario y con correo, error genérico, registro con contraseña débil y con contraseña fuerte, reenviar.
- Staging: registro, correo, confirmación y Mis colecciones.

**Aceptación**

- Ninguna respuesta de error revela si un usuario o correo existe.

---

### U13 — Sugerir y reportar

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** reestructura un flujo con borradores, detección de fuente y contrato de contribuciones de E09/E10.
- **Escalar solo si:** los pasos exigen cambiar el payload o el estado de borrador. Detenerse y volver a E09 en un chat de Opus 5.5 con esfuerzo `xhigh`.

**Depende de:** U7 y U9.

**Trabajo**

1. **Sugerir por pasos:** fuente → revisar datos → nota → enviar.
   - Los borradores se conservan entre pasos y entre visitas, como hoy.
   - Se puede volver atrás sin perder datos.
2. **Nota opcional siempre**, también al proponer un cambio a un lanzamiento existente. No se cambia la obligatoriedad de la nota del revisor.
3. **Listas** de artistas, géneros y países con el Combobox de U6.
4. **Reportar:**
   - IconButton en la ficha (U9) que abre el flujo de E18 con el lanzamiento ya identificado;
   - acceso desde el menú global.

**Pruebas**

- E10 y E18 en verde.
- Sugerir completo a 390 y 1440.
- Proponer un cambio sin nota.

---

### U14 — Perfil, aportes y colecciones

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** varias vistas con datos nuevos de D1, ordenamiento y permisos de visibilidad.
- **Escalar solo si:** el reordenamiento o la visibilidad pública exponen datos que no deben verse. Detenerse y volver a D1.

**Depende de:** U3, U7, U8 y D1.

**Trabajo**

1. **`/mis-aportes`:**
   - lista de filas compactas: estado, lanzamiento, fecha y una acción;
   - los botones de pendientes con tamaño normal;
   - mismos estados y datos que hoy (borradores, pendientes, aceptados, rechazados, cambios solicitados).
2. **Perfil propio:**
   - edición de redes;
   - interruptor "Mostrar mis aportes aceptados";
   - acceso al Estudio para admin y colaborador (I3).
3. **Perfil ajeno:** colecciones públicas, redes con SocialLinks y aportes aceptados si su dueño lo permite.
4. **Mis colecciones:**
   - mosaico de 4 portadas y nombre;
   - menú "…" con compartir, editar y eliminar.
5. **Colección:**
   - compartir, editar y eliminar como botones explícitos arriba;
   - ViewToggle grilla/lista;
   - sin notas visibles;
   - reordenar con Sortable (D1), solo para el dueño;
   - carga por IDs.

**Pruebas**

- Dueño frente a visitante.
- Reordenar con ratón, táctil y teclado.
- Perfil con aportes visibles y ocultos.

---

### U15 — Estudio: estructura y catálogo

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** une la consola de E07 y la estación de E10 bajo un layout propio, con redirecciones y permisos por rol.
- **Escalar solo si:** unir las rutas cambia los permisos efectivos de algún rol. Subir a `xhigh`.

**Depende de:** U7 y D2.

**Trabajo**

1. Estudio en `/estudio` (I3), con el layout de herramienta de U7:
   - barra lateral con Catálogo, Propuestas y Reportes;
   - ancho completo;
   - un lenguaje visual propio y más denso, sobre los mismos tokens.
2. Redirecciones: `/admin/catalogo` y `/editorial` llevan a la sección equivalente, conservando la query.
3. Permisos por rol, iguales a los actuales: el admin ve todo; el colaborador ve solo lo que hoy puede ver y hacer.
4. **Catálogo:**
   - tabla con la densidad actual;
   - vistas rápidas: Borradores, Incompletos, Sin portada, Con reportes (D2);
   - selección múltiple con publicar o archivar en lote, confirmación e informe por elemento.
5. **Enlaces cruzados:** desde un lanzamiento, a sus propuestas y reportes, y al revés.

**Pruebas**

- E07 en verde, adaptada a las rutas nuevas.
- Comunidad sin acceso.
- Colaborador con acceso parcial.
- Lote con éxito y con error.

---

### U16 — Estudio: editor

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** formulario largo con créditos, diccionarios, auditoría e historial.
- **Escalar solo si:** la reorganización cambia el payload de las mutaciones auditadas. Detenerse.

**Depende de:** U15.

**Trabajo**

1. Una página con secciones e índice lateral fijo: Datos, Créditos, Clasificación, Medios e Historial.
2. Densidad más compacta. Este punto responde a "esta vista es demasiado grande".
3. Géneros y países con el Combobox de U6, en lugar de la nube completa.
4. Sin vista previa.
5. **Edición completa en móvil**, con una vista pensada para móvil:
   - el índice se vuelve un selector;
   - las acciones de guardar quedan fijas abajo.

**Pruebas**

- Crear, editar, archivar y revertir a 390 y 1440.
- La auditoría registra igual que antes.

---

### U17 — Estudio: propuestas y reportes

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `high`.
- **Motivo:** flujo de moderación por rol, con estados y notas obligatorias del revisor.
- **Escalar solo si:** la bandeja necesita datos que el contrato de E09 no expone. Detenerse y volver a E09.

**Depende de:** U15.

**Trabajo**

1. **Propuestas en bandeja:**
   - lista a la izquierda, detalle a la derecha;
   - en móvil, lista y después detalle, con retorno.
2. **Detalle:** muestra solo lo propuesto, con los campos editados respecto de lo detectado marcados.
3. **Acciones por rol, iguales a las actuales.** El colaborador prepara y marca la propuesta como lista para admin. El admin aprueba, pide cambios o rechaza, con nota obligatoria en estos dos últimos.
4. **Reportes** en la misma bandeja, con estados traducidos y enlace al lanzamiento.

**Pruebas**

- E10 y E18 en verde, adaptadas.
- Un admin aprueba una propuesta y corrige el lanzamiento sin salir del Estudio ni escribir URLs.

---

### U18 — QA integral y candidato

**Perfil de ejecución**

- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Esfuerzo:** `xhigh`.
- **Motivo:** dictamen go/no-go sobre todo el sistema.
- **Escalar solo si:** no aplica. La falta de evidencia es no-go.

**Depende de:** todas las anteriores.

**Trabajo**

1. Suite visual completa por ruta, estado y rol a 390, 834 y 1440 (680 y 1112 en la ficha), comparada con la línea base de U1. Cada diferencia debe ser intencional.
2. Lint de tokens sin excepciones restantes.
3. Accesibilidad:
   - teclado en todas las vistas;
   - VoiceOver básico en ficha, filtros, combobox y ordenable;
   - contraste;
   - objetivos táctiles;
   - `prefers-reduced-motion`.
4. Comprobaciones globales:
   - ninguna barra de scroll nativa visible;
   - ningún "crate" en la interfaz;
   - ningún emoji como icono;
   - ningún código interno en los textos.
5. Recorrido de punta a punta en staging:
   - registro, correo, confirmación, primera colección, reordenar y compartir;
   - sugerir y su aprobación en el Estudio.
6. Expediente con evidencia y dictamen go/no-go para desplegar.

**Aceptación**

- Expediente completo en `docs/modernizacion/`.
- `estado.md` actualizado.

## 11. Fuera de alcance deliberado

- Cambiar la paleta, la tipografía o el tono visual.
- Seguidores, mensajes o colaboración entre personas en colecciones.
- Vista previa en el editor del Estudio.
- Filtros dentro de las páginas de artista y sello.
- Scroll infinito.
- Renombrar tablas o columnas de la base de datos.
