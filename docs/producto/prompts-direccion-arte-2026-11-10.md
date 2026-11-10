# Prompts de la dirección de arte — 2026-11-10

Un chat autocontenido por etapa del [plan](./plan-direccion-arte-2026-11-10.md). Se pegan tal cual.

## Uso

1. Abre una sesión nueva en la pestaña Code de la app y elige el modelo y el esfuerzo del encabezado antes de pegar.
2. Una etapa por sesión, y una sola sesión a la vez sobre este árbol.
3. U26-0 es solo tuya: responder D1–D5 del plan (§6). Ninguna etapa empieza antes.
4. Cuando aceptes una etapa, escribe «aceptado» en su sesión: hace commit en `direccion-arte` y push de esa rama.
5. Si Opus 5.5 no está disponible, no lo sustituyas por Sonnet en las etapas de Opus: espera.

Todas las etapas leen el lienzo aprobado con la herramienta Artifact (`action: "read"`, `url: https://claude.ai/artifact/D6Zt9AwNTW1TvckLbXtGW5`, `path: project/<Archivo>.dc.html`). La tabla del plan (§1) dice qué archivo es cada tablero.

---

## U26 — Base: tipografía, botones, iconos y tokens

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U26 de `docs/producto/plan-direccion-arte-2026-11-10.md` (dirección de arte del sitio público). U26-0 está cerrada: las respuestas a D1–D5 están en la sección 6 del plan.

Lee primero:
- el plan completo, sobre todo §2, §3 y U26;
- del lienzo, los tableros J (`CabeceroPropuesta.dc.html`), K (`OnboardingR3.dc.html`) y F (`PerfilR3.dc.html`), para sacar los iconos (engranaje, pin, faders) y las medidas de botón y contenedor;
- `src/lib/styles/tokens.css`, `src/lib/styles/styles.css`, `src/app.html`, `src/lib/ui/Button.svelte`, `src/lib/ui/icons.ts`, `src/lib/ui/index.ts` y `src/routes/lab/+page.svelte`;
- `docs/modernizacion/decisiones.md`, secciones de tokens (U4) y primitivas (U5, U6).

Antes de tocar nada:
- `git fetch`. Si la rama `direccion-arte` no existe, créala desde `origin/main` (`b304175`). `docs/modernizacion/e22-corte-2026-10-25.md` no tiene commit y no es tuyo: no lo toques. Los archivos del plan (`docs/producto/*-direccion-arte-2026-11-10.md`) tampoco tienen commit: inclúyelos en el primer commit de la rama.
- Guarda la referencia visual: `VISUAL_BASELINE_DIR=.ref-pre-u26 npm run visual:capture`.

Haz:
1. Work Sans 400, 500, 600 y 700 (el 800 se cambió por 700 al ejecutar U26) en `static/fonts/*.woff2`, con `@font-face` y `font-display: swap`, y precarga de 400 y 600 en `app.html`. Nada de Google Fonts ni de otro proveedor nuevo. Si la licencia (OFL) pide un archivo, añádelo junto a las fuentes.
2. `Button`: peso 600 en todas las variantes. Si no existe un tamaño de 48 px para la acción de un formulario, añádelo (`size="lg"` o lo que siga el patrón de `Button`).
3. Tokens nuevos y documentados en `tokens.css`:
   - `--color-rol-admin: #682cc6`;
   - alturas del cabecero (72 y 60);
   - el contenedor de formulario (fondo `#121212`, borde `rgba(248,255,238,.12)`, radio 14, padding 32 y 20–24 en móvil);
   - el ritmo 22/36 de los formularios.
   Sin valores sueltos: `lint:tokens` en verde.
4. Iconos en `icons.ts`: `menu`, `estudio` (faders), `ajustes` (engranaje), `pin` y `externo`, si no existen ya con otro nombre. Trazo 1,75, en la cuadrícula de 24.
5. `FormPanel` en `src/lib/ui` (el nombre puede ajustarse al patrón): el contenedor de formulario con anchos 480 y 576. Expórtalo.
6. Muestra en `/lab` los botones antes y después, los iconos nuevos y `FormPanel`.

Aceptación:
- `npm test`, `npm run build` y `npm run lint:tokens` en verde;
- `npm run test:browser` en verde (hazlo en caliente, dos veces);
- `VISUAL_BASELINE_DIR=.ref-pre-u26 npm run visual:compare`: se esperan diferencias de tipo y de peso en todo el sitio. Explica por categorías y señala cualquiera que no sea de tipo, peso o métrica.

No cambies rutas, cabecero ni textos. No hagas commit.
Entrega: archivos, una captura de `/lab` en el navegador integrado, y una comparación de la misma página antes y después (inicio en desktop) que muestre que Work Sans carga (pestaña Network o `document.fonts.check`).
```

## U27 — Motor generativo

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U27 de `docs/producto/plan-direccion-arte-2026-11-10.md`: el motor generativo (huella, cenefa y pulso). U26 debe estar aceptada.

Lee primero:
- el plan, §4 y U27 (son la especificación);
- del lienzo, con la herramienta Artifact (action read):
  - `PulsoB.dc.html` (A2): su `<script>` es la implementación del campo y del pulso que hay que portar;
  - `Huellas.dc.html` (B), para la apariencia de las huellas por rol;
  - `FichaR3.dc.html` (G2) y `PerfilR3.dc.html` (F), para cenefas con portada y sin ella;
  - `OnboardingR3.dc.html` (K), para la huella gris y la de color;
  Si D1 eligió A, porta `Pulso.dc.html` en su lugar;
- `src/lib/ui/index.ts` y `src/routes/lab/+page.svelte`.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u27 npm run visual:capture`.

Contexto: el motor original (`motor.js`) vivía en un scratchpad que ya no existe. Las imágenes de los tableros salieron de él con los parámetros de §4. Reconstrúyelo hasta que tus resultados se parezcan a esas imágenes. No tienen que ser idénticos píxel a píxel.

Haz, en `src/lib/generative/` y sin dependencias nuevas:
1. Semilla FNV-1a de 32 bits y un PRNG determinista.
2. `huella(ctx, w, h, opciones)` y `tonosDe(nombre, rol)`. Gamas:
   - usuario, verdes;
   - colaborador, grises;
   - admin, alrededor de `--color-rol-admin`.
3. `Huella.svelte`: avatar circular de 32, 40 o 96 px, cacheado como `dataURL` por nombre, rol y tamaño.
4. `Cenefa.svelte`:
   - con portada: superficie con `<img>` y filtro CSS, y máscara de puntos de un canvas propio vía `mask-image` o compuesto CSS. Nunca pintes portadas en un canvas ni llames a `getImageData` sobre ellas;
   - sin portada: la huella con el color del rol;
   - los velos de lectura de §4, y una prop para la zona derecha atenuada.
5. `CampoPulso.svelte` (A2):
   - una instancia por pantalla y `pointer-events: none`;
   - pausa fuera de pantalla y con la pestaña oculta;
   - fotograma fijo con `prefers-reduced-motion` o `Save-Data`;
   - DPR limitado a 2.
6. Pruebas unitarias: el mismo nombre da la misma huella (hash de los puntos) y el mismo tono, y nombres distintos dan huellas distintas.
7. En `/lab`:
   - tres huellas por rol;
   - una cenefa con portada (usa una portada local de `static`, o un mock si no hay) y otra sin ella;
   - el campo en reposo y con cursor.

Mide el campo en Chromium con CPU ×4: menos de 4 ms por cuadro en 1440×900. Documenta la medida.

Aceptación: `npm test`, `build`, `lint:tokens` y `test:browser` en verde. `visual:compare`: diferencias solo en `/lab`.
No toques páginas fuera de `/lab`. No hagas commit.
Entrega: API del módulo, capturas de `/lab` en el navegador integrado junto a los tableros B y G2 para compararlos, y la medida de rendimiento.
```

## U28 — Cabecero y panel

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U28 de `docs/producto/plan-direccion-arte-2026-11-10.md`: el cabecero y el panel de cuenta. U26 y U27 deben estar aceptadas.

Lee primero:
- el plan, §3 (Cabecero y Panel de cuenta) y U28;
- del lienzo, el tablero J (`CabeceroPropuesta.dc.html`). Para comparar, I (`CabeceroActual.dc.html`); y para las excepciones, E (`AccesoR3.dc.html`) y K (`OnboardingR3.dc.html`);
- `src/lib/components/Header.svelte`, `src/lib/ui/Menu.svelte`, `src/routes/+layout.svelte`, `src/routes/estudio/+layout.svelte` y `src/lib/stores/authStore.ts`;
- en `docs/modernizacion/decisiones.md`, lo que diga sobre el header (E14, U7, U13 y U18: sticky, `--header-offset`, `--header-reserve` y `menuMovil`);
- las specs de `tests/browser` que tocan el header o el menú (búscalas con grep: `header`, `menu`, `Entrar`).
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u28 npm run visual:capture`.

Haz:
1. Barra opaca de 72/60 y el mismo ancho en todas las páginas, Estudio incluido. «beta» junto al logo.
2. Por estado:
   - visitante: Sugerir (verde, con +) y la hamburguesa sin texto, con `aria-label="Menú"`. Sugerir sin sesión lleva a entrar con retorno;
   - con sesión: Sugerir y el avatar `Huella` con chevron;
   - colaborador y admin: además, Estudio en contorno, con el icono `estudio`;
   - dentro de `/estudio`: «Volver al catálogo» en lugar de Estudio.
3. Excepciones:
   - en `/auth/login`, Sugerir en contorno;
   - en los pasos de `/auth/registro`, la barra mínima con Entrar en contorno. Deja el hook preparado para U30.
4. Panel:
   - cenefa con huella y color de rol, y «@usuario» a 24 px;
   - la fila «Perfil y colecciones», que va a `/perfil/{usuario}`;
   - «Tu cuenta»: Editar perfil (`/cuenta`), Ajustes (`/cuenta` hasta U33) y Salir;
   - «El sitio»: Manual y Reportar un problema;
   - visitante: Entrar y Crear cuenta, y luego «El sitio».
   Filas de 44 px, a 14/500, con teclado completo y foco atrapado como el `Menu` actual. En móvil, el panel a pantalla.
5. Conserva:
   - el ocultar al hacer scroll en móvil (E14);
   - `--header-offset` y `--header-reserve`;
   - un solo menú montado (`menuMovil`).
   Fuera del panel no quedan enlaces a `/mis-colecciones`: el perfil los sustituye.

Aceptación:
- `npm test`, `build` y `lint:tokens` en verde;
- `test:browser` ×2 en caliente, con E14 incluido. Los textos que leen los tests se actualizan en el mismo cambio;
- `visual:compare`: diferencias en el cabecero de todas las páginas y en el menú. Explica las que no lo sean.
No cambies el cuerpo de las páginas. No hagas commit.
Entrega: archivos, y capturas en el navegador integrado de visitante, usuario, colaborador y admin (desktop y 390), del panel abierto, y de `/estudio` con «Volver al catálogo».
```

## U29 — Entrada y catálogo

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U29 de `docs/producto/plan-direccion-arte-2026-11-10.md`: la franja de entrada y el buscador del inicio. U26–U28 deben estar aceptadas.

Lee primero:
- el plan, U29;
- del lienzo, el tablero D (`EntradaR3.dc.html`) completo, incluidas las variantes de bienvenida, beta y chips abiertos;
- `src/routes/+page.svelte`, `src/lib/components/home/*` (sobre todo `HomeWelcome`, `HomeSearchBar` y `MobileSearchBar`), `src/lib/components/BetaInvitation.svelte` y `ActiveSearchPills.svelte`;
- en `docs/modernizacion/decisiones.md`, U10, U10b, U11 y E19;
- las specs de `tests/browser` del inicio, la búsqueda, la beta y el historial (E12, E17 y E19).
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u29 npm run visual:capture`.

Haz:
1. La franja con `CampoPulso` (una sola instancia en la página) y el título 102/92 del tablero.
2. Placeholder del buscador: «Buscar por país, género, artista, sello o álbum».
3. La barra de 560 y los chips en la misma fila (`space-between`). Con más de 4 chips, el quinto es «N más» con caret y abre el resto, con teclado.
4. Bienvenida y nota beta en un solo hueco a todo el ancho, según el token beta. La nota beta deja de ser modal. Conserva la lógica de invitación de E19: solo cambia la presentación.
5. Conserva:
   - la franja reducida tras el primer scroll;
   - la paginación, que aterriza con la navegación visible;
   - la URL de búsqueda y el historial sin cambios.

Aceptación: `npm test`, `build`, `lint:tokens`, `test:browser` ×2 en caliente (también el subconjunto con beta) y `visual:compare` explicado.
Si cambia la URL, el historial o el scroll, detente y avísalo: esta etapa se escala a Opus.
No hagas commit.
Entrega: archivos y capturas (desktop y 390) en el navegador integrado: inicio sin beta, con beta, con 6 chips cerrados y con el «N más» abierto.
```

## U30 — Acceso y onboarding

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U30 de `docs/producto/plan-direccion-arte-2026-11-10.md`: Entrar, el registro en tres pasos, Revisa tu correo, y recuperar o cambiar la contraseña. U26–U28 deben estar aceptadas.

Lee primero:
- el plan, U30 y las respuestas a D3 y D4 (§6);
- del lienzo:
  - E (`AccesoR3.dc.html`);
  - K (`OnboardingR3.dc.html`), solo los pasos y Revisa tu correo, porque el perfil es de U31;
  - M (`VistasR3.dc.html`): Recuperar, Contraseña nueva y Enlace vencido;
- `src/routes/auth/*/+page.svelte`, `src/lib/domain/account.ts` (`authLinkRedirect` y `safeRedirect`), `src/lib/components/account/pendingSignup.ts`, `SocialFields.svelte` y `src/lib/services/profiles.ts`;
- en `docs/modernizacion/decisiones.md`, U12 y D3 (correo propio y plantillas);
- las specs de `tests/browser` de login, registro, confirmar y reset.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u30 npm run visual:capture`.

Haz:
1. Entrar (tablero E):
   - título según D3;
   - tres puntos con icono: «Aporta nuevos y viejos lanzamientos al catálogo», «Guarda lanzamientos en tus colecciones» y «Comparte tus colecciones con un enlace»;
   - «Crear cuenta» como botón secundario de contorno verde, bajo Entrar;
   - «Olvidé mi contraseña» como enlace discreto.
2. Registro (tablero K), en tres pasos dentro de `FormPanel` sobre una `Cenefa` o `Huella` que nace:
   - paso 1: correo y contraseña dos veces. Línea: «Crea tu cuenta con tu correo y una contraseña.» La huella va gris y casi quieta;
   - paso 2: usuario y nombre para mostrar (opcional). Línea: «Elige tu usuario y el nombre que se verá en tu perfil.» Bajo Usuario: «No se podrá cambiar después.» Cada tecla del usuario reorganiza la huella, todavía gris. Si ya existe una comprobación de disponibilidad, muestra «Disponible»; si no existe y requiere RPC, no la inventes: detente y pregúntalo;
   - paso 3: redes (placeholders `instagram.com/tu_usuario`, `soundcloud.com/tu_usuario`, `tuusuario.bandcamp.com`), novedades y privacidad. Al entrar, la huella revela su color;
   - progreso solo con tres barritas, sin titulares ni «1 de 3». Lectores de pantalla: anuncia el paso;
   - validación por paso; Atrás conserva lo escrito;
   - misma llamada de alta y mismos metadatos que hoy, al final del paso 3.
3. Revisa tu correo:
   - título 28/34;
   - «Te enviamos un enlace a {correo} para confirmar tu cuenta.»;
   - «Abrir Gmail» y «Abrir Outlook» (según D4), en verde y con el icono `externo`;
   - Reenviar, y «Usar otro correo».
4. El enlace de confirmación aterriza en el perfil (`/perfil/{usuario}`) con el aviso de cuenta confirmada. Las plantillas de correo no cambian. `safeRedirect` deja de caer en `/mis-colecciones`.
5. Recuperar, Contraseña nueva y Enlace vencido como en M: contenedor de 480 y textos del tablero. Enlace vencido sin aviso rojo, con «Pedir otro enlace».

Aceptación: `npm test`, `build`, `lint:tokens`, `test:browser` ×2 en caliente y `visual:compare` explicado. Haz un alta completa en local (o con el mock de Auth de los tests) que llegue al perfil.
Nada de cuentas reales ni contraseñas reales: usa las de prueba del proyecto.
No hagas commit.
Entrega: archivos y capturas (desktop y 390) de cada paso, de Revisa tu correo y de las tres vistas de contraseña.
```

## U31 — Perfil, colecciones y Mis aportes

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U31 de `docs/producto/plan-direccion-arte-2026-11-10.md`: el perfil como casa, la salida de Mis colecciones y la página Mis aportes. U26–U30 deben estar aceptadas.

Lee primero:
- el plan, U31 y las respuestas a D2 y D5 (§6);
- del lienzo:
  - F (`PerfilR3.dc.html`);
  - K (`OnboardingR3.dc.html`), solo el perfil recién nacido;
  - N (`AportesR3.dc.html`);
  - L (`InventarioR3.dc.html`);
- `src/routes/perfil/[username]/+page.{ts,svelte}`, `src/routes/mis-colecciones/+page.svelte`, `src/routes/mis-aportes/+page.{ts,svelte}`, `src/lib/stores/cratesStore.ts`, `src/lib/components/colecciones/*`, `src/lib/domain/contributionRows.ts`, `src/lib/stores/contributionsStore.ts`, `src/lib/ui/StatusDot.svelte` y `static/.htaccess` (o donde vivan las reglas de Hostinger);
- en `docs/modernizacion/decisiones.md`, U3, U12 y U14 (perfil y colecciones);
- las specs `u14-perfil-colecciones` y las que tocan `/mis-colecciones` y `/mis-aportes`.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u31 npm run visual:capture`.

Haz:
1. Perfil (F):
   - `Cenefa` sin portada, con la huella del usuario, y el título de entidad;
   - bio, y redes como botones de icono;
   - para el dueño, Editar perfil y Ajustes.
2. Colecciones:
   - cabecera «Colecciones» con «+ Nueva colección» en verde;
   - cuadrícula de 4×270 en desktop y de 2 columnas en móvil.
   - Para el dueño:
     - sus colecciones privadas, marcadas «Privada»;
     - el menú de compartir, editar y eliminar, y los diálogos que hoy viven en Mis colecciones.
   - El dueño lee sus colecciones con el store que ya las trae todas (`cargarCrates`); el público sigue con `is_public`. Si hiciera falta cambiar RLS, detente.
3. Mis aportes como primer tile:
   - 1×1, con borde verde de 2 px y pin (`aria-label="Fijada"`);
   - mosaico de las portadas de los aportes aceptados;
   - «N lanzamientos · N en revisión»;
   - abre `/mis-aportes`;
   - visibilidad según D2.
4. Perfil vacío (K):
   - tile «Mis aportes» vacío («Sin aportes todavía»);
   - tile verde «Crea tu primera colección», que abre el diálogo;
   - tiles fantasma punteados;
   - en la cabecera, enlaces «Escribe tu bio» y «Añade tus redes».
5. `/mis-colecciones` redirige al perfil: redirección en cliente y regla en `.htaccess`, como con las rutas antiguas. Los avisos `cuenta-confirmada` y `contrasena` se muestran en el perfil.
6. `/mis-aportes` (N):
   - `Cenefa` de 240 con la huella, «@usuario», título 64 y tres cifras: lanzamientos, en revisión y aceptados;
   - grupos:
     - Por resolver: `changes_requested` y `draft`;
     - En revisión: `pending` y `ready_for_admin`;
     - Resueltos: `approved` y `rejected`;
   - filas:
     - portada de 64, o hueco punteado si no hay;
     - título, artista y tipo;
     - `StatusDot`;
     - fecha con su verbo;
     - «Nota del equipo:» en caja;
     - sin la fuente;
   - acción:
     - «Corregir» en verde;
     - «Editar» para borradores y pendientes sin tomar;
     - «Editar» gris y desactivado (`aria-disabled`) cuando `contributionTaken`;
     - «Ver lanzamiento» si está publicado;
   - vacío, como hoy, con «Sugerir un lanzamiento»;
   - reutiliza `contributionRows.ts`. Las etiquetas «Retomar» pasan a «Editar».

Aceptación: `npm test`, `build`, `lint:tokens`, `test:browser` ×2 en caliente y `visual:compare` explicado. Prueba la redirección con Apache local si cambias `.htaccess` (ver la memoria del proyecto).
No hagas commit.
Entrega: archivos y capturas (desktop y 390): perfil propio con colecciones, perfil propio vacío, perfil ajeno, `/mis-aportes` con los tres grupos, y la redirección de `/mis-colecciones`.
```

## U32 — Fichas de colección, artista y sello

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U32 de `docs/producto/plan-direccion-arte-2026-11-10.md`: las fichas de colección, artista y sello. U26–U28 deben estar aceptadas (U27 da `Cenefa`).

Lee primero:
- el plan, U32;
- del lienzo, el tablero G2 (`FichaR3.dc.html`): sus tres ejemplos y el desplegable abierto de Sellos;
- `src/lib/components/CatalogEntityPage.svelte`, `src/routes/{artista,sello}/[slug]/+page.{ts,svelte}`, `src/routes/coleccion/[slug]/+page.{ts,svelte}`, `src/lib/utils/catalogoStore.ts` (`findReleasesByLabelSlug` y equivalentes) y `src/lib/ui/Menu.svelte`;
- las specs de `tests/browser` de artista, sello y colección.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u32 npm run visual:capture`.

Haz:
1. Cabecera de ficha:
   - `Cenefa` de 400 px con la portada del lanzamiento más reciente y la huella del nombre;
   - título 88/84, y en colecciones la descripción debajo;
   - a la derecha, la columna de datos de 372 px sobre la zona atenuada.
   En móvil, el título y los datos se apilan bajo una cenefa más baja.
2. Datos, calculados de los lanzamientos ya cargados en una función pura con pruebas:
   - colección: Curada por (@usuario), Lanzamientos y Visibilidad;
   - artista: País, Años (mín–máx), Sellos, Géneros y Lanzamientos;
   - sello: Países, Años, Artistas (primarios), Géneros y Lanzamientos.
   Orden por frecuencia. Se excluyen «Independiente» de Sellos y «LATAM» de Países.
3. Listas largas:
   - hasta tres nombres, los que quepan en la fila, y un botón «N más» con caret;
   - el botón abre un desplegable opaco del ancho de la columna, con nombre y cantidad por fila, que enlaza a su ficha;
   - 8 filas visibles y luego scroll;
   - teclado completo y cierre con Escape.
   Usa `Menu` si encaja, y si no, un patrón equivalente con las mismas reglas de foco.
4. Debajo, la barra de resultados y la rejilla de siempre.

Aceptación: `npm test` (con las pruebas del cálculo), `build`, `lint:tokens`, `test:browser` ×2 en caliente y `visual:compare` explicado.
Si una lista necesita datos que la página no carga, detente y avísalo.
No hagas commit.
Entrega: archivos y capturas (desktop y 390) de una colección, un artista con muchos sellos (Entrañas) y un sello (TraTraTrax), con el desplegable abierto.
```

## U33 — Vistas restantes

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U33 de `docs/producto/plan-direccion-arte-2026-11-10.md`: 404 y error, Editar perfil y Ajustes, Reportar, Sugerir, Manual y Privacidad. U26–U28 deben estar aceptadas.

Lee primero:
- el plan, U33;
- del lienzo, el tablero M (`VistasR3.dc.html`) completo y L (`InventarioR3.dc.html`);
- `src/routes/+error.svelte`, `src/routes/cuenta/+page.svelte`, `src/lib/components/account/*`, `src/routes/reportar/+page.svelte`, `src/routes/sugerir/+page.svelte`, `src/routes/manual/+page.svelte`, `src/routes/privacidad/+page.svelte` y `src/lib/components/Header.svelte` (el enlace a Ajustes del panel);
- en `docs/modernizacion/decisiones.md`, U12 y U13;
- las specs `u12-cuenta` y las de reportar y sugerir.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u33 npm run visual:capture`.

Haz:
1. 404 y error: una sola pantalla sobre el campo de puntos, en `FormPanel` de 480, con «No encontramos esta página» o «Algo salió mal», su línea, y «Volver al catálogo».
2. `/cuenta` = Editar perfil:
   - cenefa pequeña con «@usuario»;
   - Nombre para mostrar, Sobre ti y Redes (placeholders de URL);
   - «Guardar cambios».
3. `/cuenta/ajustes`, ruta nueva:
   - correo actual y nuevo, con «Cambiar correo»;
   - contraseña nueva y su repetición, con «Cambiar contraseña»;
   - novedades por correo.
   Mueve ahí la lógica de correo y contraseña sin cambiar sus llamadas. El panel del cabecero enlaza Ajustes aquí.
4. Reportar:
   - Categoría y Descripción;
   - «Añadir captura»;
   - la línea «Incluimos datos técnicos de la página. Nunca cookies.», solo si es cierta para el código actual (compruébalo);
   - «Enviar reporte».
5. Sugerir: progreso en cuatro barritas, como el onboarding, «Sugerir un lanzamiento» y «Enlace de la fuente». El flujo no cambia.
6. Manual y Privacidad como lectura: sin campo de puntos, índice a la izquierda (260) y columna de 720, con h1 40/44, h2 22/28 y cuerpo 18/28. Los textos no cambian.

Aceptación: `npm test`, `build`, `lint:tokens`, `test:browser` ×2 en caliente y `visual:compare` explicado. Comprueba que el cambio de correo y el enlace de su correo siguen funcionando con el mock de Auth.
Si separar `/cuenta` rompe ese flujo, detente: se escala a Opus.
No hagas commit.
Entrega: archivos y capturas (desktop y 390) de cada vista.
```

## U34 — QA y cierre

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U34 de `docs/producto/plan-direccion-arte-2026-11-10.md`: QA transversal y cierre de la dirección de arte. U26–U33 deben estar aceptadas.

Lee primero:
- el plan completo;
- del lienzo, L (`InventarioR3.dc.html`), que es la lista de vistas a recorrer;
- `docs/modernizacion/estado.md`, el final de `decisiones.md` y `tests/visual/README.md`.

Haz:
1. Recorre cada vista de L a 1440, a 390 y con zoom 200 (`npm run test:anchos` y el navegador integrado). Corrige los desbordes.
2. Movimiento reducido: toda pieza generativa queda fija. El campo cumple el presupuesto de §4 con CPU ×4: mídelo de nuevo.
3. Accesibilidad:
   - todo icono con nombre;
   - foco visible;
   - teclado en el panel, los chips «N más», el desplegable de las fichas y los pasos del registro;
   - contraste AA del título y los datos sobre cada cenefa (mídelo con las portadas reales más claras que encuentres).
4. `npm test`, `build`, `lint:tokens`, `test:browser` ×3 en caliente y `test:anchos`. Pasa `visual:capture` y prepara el informe, pero no aceptes la línea base sin mi visto bueno.
5. Recorrido en staging:
   - visitante;
   - usuario nuevo, con el alta completa usando el buzón de pruebas de la memoria del proyecto;
   - colaborador (`colaborador_qa`);
   - admin.
   Comprueba los roles en staging antes. No inicies sesión con contraseñas por mí si no están en `.env.local`.
6. `decisiones.md`, con una sección por etapa U26–U33; `estado.md`; y capturas en `docs/modernizacion/capturas-u34/`.

No hagas commit hasta mi «aceptado». La publicación (fusionar en `main` y lanzar el workflow) va aparte y la pido yo.
Entrega: informe de QA con lo corregido, lo pendiente con severidad, las medidas de rendimiento y contraste, y el informe visual.
```
