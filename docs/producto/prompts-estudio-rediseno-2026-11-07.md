# Prompts del rediseño del Estudio — 2026-11-07

Un chat autocontenido por etapa del [plan](./plan-estudio-rediseno-2026-11-07.md). Se pegan tal cual.

## Uso

1. Abre una sesión nueva en la pestaña Code de la app y elige el modelo y el esfuerzo del encabezado antes de pegar.
2. Una etapa por sesión, y una sola sesión a la vez sobre este árbol.
3. U20-0 es solo tuya: aprobar el lienzo <https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r> y cerrar D1–D7 del plan. Ninguna etapa empieza antes.
4. Cuando aceptes una etapa, escribe «aceptado» en su sesión: hace commit en `estudio-rediseno` y push de esa rama.
5. Si Opus 5.5 no está disponible, no lo sustituyas por Sonnet en las etapas de Opus: espera.

---

## U20 — Base: densidad, primitivas y barra lateral

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U20 de `docs/producto/plan-estudio-rediseno-2026-11-07.md` (rediseño del Estudio). U20-0 está aprobada: el lienzo se aprobó el 2026-11-07 y D1–D6 están cerradas (sección 5 del plan). D7 sigue abierta, pero no afecta a U20.

Lee primero:
- el plan completo, sobre todo las secciones 1, 2 (Sistema) y 3 (Guía de voz);
- el lienzo aprobado, con la herramienta Artifact (action read): https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r. Los tableros están en `project/*.dc.html` y `project/canvas.json`; las notas del lienzo resumen cada pantalla;
- `docs/modernizacion/decisiones.md`: «Herramienta interna», «Editor del Estudio», «Bandeja del Estudio» y «QA de interfaz»;
- `src/lib/styles/tokens.css` (bloque Densidad), `src/lib/layouts/ToolLayout.svelte`, `ToolHeader.svelte`, `src/lib/ui/{Button,Field,Select,Combobox,Textarea,IconButton,EmptyState,Chip,Menu}.svelte` y `src/routes/lab/+page.svelte`.

Antes de tocar nada:
- `git status --short`. Si la rama `estudio-rediseno` no existe, créala desde `main` (`f7582bf`, `v1.0.0`). E22-B se hizo el 2026-10-25: su registro es `docs/modernizacion/e22-corte-2026-10-25.md`, todavía sin commit, y `estado.md` aún no lo refleja. No es tarea de esta etapa: no lo toques ni lo incluyas en tus cambios. Los archivos del plan (`docs/producto/*-estudio-rediseno-2026-11-07.md`) tampoco tienen commit; consérvalos tal como están.
- Guarda la referencia visual: `VISUAL_BASELINE_DIR=.ref-pre-u20 npm run visual:capture`.

Haz:
1. Densidad: que `Button`, `Field`, `Select`, `Combobox`, `Textarea` e `IconButton` usen `--density-control-h` y `--density-control-px` sin cambiar su tamaño fuera de `[data-density="compact"]`. Compruébalo midiendo un control en `/` y otro en `/estudio/catalogo`.
2. `EmptyState`: la variante `inline` lleva padding en los cuatro lados y admite un icono opcional (prop `icon`, del set de `icons.ts`).
3. `StatusDot` nuevo en `src/lib/ui`: punto y palabra, con tonos `ok | pending | draft | danger | neutral` (el borrador es un contorno). Sin mayúsculas forzadas. Expórtalo en `index.ts`.
4. `SplitButton` nuevo: acción principal y un botón de menú con su propio `aria-label`, sobre `Menu`. Teclado completo (Enter, Escape, flechas) y variantes `primary | secondary`.
4b. `SourceLink` nuevo: un IconButton que abre la fuente con el glifo de su proveedor (`bandcamp`, `soundcloud`, `spotify`) y una flecha externa para cualquier otro enlace. Tooltip y `aria-label` «Abrir en {Proveedor}». Añade `spotify` a `icons.ts`. Usa la detección de proveedor que ya existe (`sourceProviderFor` o equivalente); no la dupliques. Referencia: tablero «4b · Botón de fuente por proveedor» del lienzo.
5. `ToolLayout`:
   - plegable a 60 px, con iconos y conteos como insignia, y botón de plegar abajo;
   - la preferencia, en `localStorage` con try/catch, y si falla queda desplegada;
   - sin la etiqueta «ESTUDIO»;
   - en móvil el comportamiento no cambia.
5b. Espaciado: crea en `tokens.css` los tokens del «Ritmo de espaciado» de la sección 3 del plan (`--tool-gap-*` y `--tool-pad-*`, nombres a tu criterio, documentados) y aplícalos en `ToolLayout`, `ToolHeader`, `Inbox*`, `EmptyState` y en el padding horizontal de `Field`, `Select` y `Combobox` en densidad compacta. Compáralo con los tableros del lienzo.
6. `ToolHeader`: `description` pasa a ser opcional y deprecada (avísalo en el JSDoc), y se añade `count` junto al título. No quites todavía las descripciones de las secciones: eso lo hacen U21–U24.
7. Añade a `/lab` StatusDot, SplitButton, EmptyState con icono y ToolLayout plegado y desplegado.

Aceptación:
- `npm test`, `npm run build` y `npm run lint:tokens` en verde;
- `npm run test:browser` en verde;
- `VISUAL_BASELINE_DIR=.ref-pre-u20 npm run visual:compare`: diferencias solo en el Estudio y en `/lab`. Explica cada una. Fuera del Estudio, cero.

No cambies textos de las secciones, rutas, stores ni RPC. No hagas commit.
Entrega: lista de archivos, medidas de los controles antes y después, capturas de `/lab` y de `/estudio/catalogo` con la barra plegada y desplegada (en el navegador integrado), y las diferencias visuales explicadas.
```

## U21 — Catálogo y Diccionarios

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U21 de `docs/producto/plan-estudio-rediseno-2026-11-07.md`: Catálogo y Diccionarios del Estudio. U20 debe estar aceptada (StatusDot, SplitButton, EmptyState con icono y ToolLayout plegable existen).

Lee primero:
- las secciones 2, 3 y U21 del plan, y las decisiones D3 y D4 tal como quedaron;
- los tableros «1 · Catálogo», «2 · Borradores vacío» y «3 · Diccionarios» del lienzo, con la herramienta Artifact (action read, path `project/Main.dc.html`, `project/CatalogoVacio.dc.html` y `project/Diccionarios.dc.html`): https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r;
- `src/routes/estudio/catalogo/+page.svelte`, `src/routes/estudio/diccionarios/+page.svelte`, `src/routes/estudio/+layout.svelte` y `src/lib/domain/studio.ts`;
- las specs de `tests/browser` que tocan `/estudio/catalogo` y `/estudio/diccionarios` (búscalas con grep).
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u21 npm run visual:capture`.

Catálogo:
- Cabecera: «Catálogo» con el conteo, o «Catálogo / Borradores» con el suyo en una vista rápida. Sin descripción. «Nuevo» es primario.
- Una fila: búsqueda, Estado y Tipo. Mientras hay selección, la barra de lote ocupa esa fila: conteo, Publicar, Archivar y ✕.
- Tabla:
  - sin la cabecera «Todos los lanzamientos»;
  - la fila lleva portada y título, sin slug: el slug y «Editado …» van en el `title` del enlace;
  - Fecha en una línea;
  - Estado con StatusDot;
  - una columna de señales con iconos y tooltip: falta portada o datos, y reportes abiertos con número, que enlaza a Reportes;
  - el chevron final queda.
- Vacío: EmptyState inline con icono. El título va según la vista («Sin borradores», «Nada incompleto», «Todo con portada», «Sin reportes abiertos», «Sin resultados»), con una línea y una acción.
- Pie: «1–50 de 2.790» y la paginación.

Diccionarios:
- Sin descripción. Pestañas con conteo.
- El select «Mostrar» pasa a un control segmentado con las mismas opciones de hoy y los mismos valores en la URL.
- Estado con StatusDot. El número de lanzamientos va alineado a la derecha, con «n publicados» en el `title`. El alias va en línea, en gris.
- El diálogo de fusionar y el menú ⋯ no cambian de comportamiento.

Aplica la guía de voz (sección 3) a todo texto visible de estas dos pantallas. Conserva como `aria-label` lo que los tests lean por rol o por nombre.

Aceptación:
- `npm test`, `build`, `lint:tokens` y `test:browser` en verde; los selectores de las specs se actualizan, ninguna se borra;
- `VISUAL_BASELINE_DIR=.ref-pre-u21 npm run visual:compare`: solo Catálogo y Diccionarios;
- en el navegador integrado, captura a 1440 y a 390 de Catálogo, Borradores vacío, lote con 3 seleccionados y Diccionarios › Géneros.

No toques el editor (U22), Propuestas ni Reportes. No hagas commit.
Entrega: textos quitados y su destino (tooltip, aria o nada), capturas, y las diferencias visuales explicadas.
```

## U22 — Editor de lanzamiento

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U22 de `docs/producto/plan-estudio-rediseno-2026-11-07.md`: el editor de lanzamiento del Estudio. U20 y U21 deben estar aceptadas.

Lee primero:
- las secciones 2, 3 y U22 del plan, y la decisión D1 (índice lateral) tal como quedó;
- el tablero «7 · Editor de lanzamiento» del lienzo (Artifact read, path `project/Editor.dc.html`): https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r;
- en `docs/modernizacion/decisiones.md`, «Editor del Estudio (U16)»; RC2-P1-01 en `docs/modernizacion/u19-estudio-flujo-2026-10-15.md`;
- `src/lib/components/estudio/{ReleaseEditor,ReleaseForm,EditorCredits,EditorHistory}.svelte` y `tests/release-editor.test.mjs`, más las specs de navegador del editor.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u22 npm run visual:capture`.

Haz:
1. Cabecera:
   - ← volver, portada de 48 px, título y una línea con StatusDot (estado · versión · artista);
   - a la derecha, «Falta …» como marca ámbar o «✓ Lista para publicar» en verde tenue;
   - icono de la fuente (abre el enlace principal), icono de historial con conteo y ⋯ (Publicar, Archivar, Relacionado, como hoy);
   - sin eyebrow.
2. Cuerpo:
   - secciones sin tarjeta, en una rejilla de `140px 1fr`, con la etiqueta de la sección en el margen y un separador de 1 px;
   - Datos en dos filas: Título 2fr, Tipo 1fr y Fecha 1fr; después Sello, con el enlace «+ Datos técnicos», que se despliega en el sitio. **Sin reseña:** quita el campo, su enlace y cualquier texto que la mencione (por ejemplo, «Solo admin cambia la reseña y la portada.» → «Solo admin cambia la portada.»). `release.review` se conserva en el tipo y en el payload tal como venga; la interfaz nunca lo escribe. Si D7(a) se aprobó, oculta también el bloque de reseña de `ReleaseDetail.svelte`;
   - Créditos sin subpanel;
   - Clasificación con «+ Radar» o, si ya tiene, el bloque de radar del tablero 7: cinco ejes con cinco puntos, como el filtro de la barra de búsqueda (`src/lib/components/RadarFiltros.svelte`), con el pentágono de `RadarVisual` a unos 136 px al lado y «Quitar» junto al título. Extrae los ejes con puntos de `RadarFiltros` a un componente compartido (`RadarPips`, con `value` enlazable y sin «Aleatorizar» ni «Limpiar» en el editor) y haz que `RadarFiltros` lo use, sin cambiar su aspecto ni su comportamiento en la búsqueda (compruébalo con visual:compare en `/`). `RadarControls` (sliders) deja de usarse en el editor; bórralo si nada más lo usa;
   - Medios con portada de 96 px, «Compra o escucha · proveedor» y «Portada · URL HTTPS».
3. Ayudas: quita las de la tabla de la sección 2 del plan que son del editor. «NUEVO», junto a un artista o sello nuevo, lleva su regla en el tooltip.
4. Índice: quítalo si D1 = quitar. Si no, déjalo como columna de anclas sin «Listo para publicar», que pasa a la cabecera.
5. Historial: deja de ser una sección y se abre desde el icono, en un Sheet o un panel lateral, con el mismo componente EditorHistory.
6. Barra fija: «n cambios · campos», la observación (marcador «¿Qué cambió? (queda en el historial)») y Guardar. Los errores de guardado se muestran en la barra, en una línea.

No cambies la carga, el guardado, la validación, los créditos (arrastre, mover de grupo, selección múltiple) ni los RPC. Si algo de eso se rompe, es una regresión: arréglala en la causa.

Aceptación:
- `npm test` (sobre todo `release-editor`), `build`, `lint:tokens` y `test:browser` ×2 en verde;
- visual:compare contra `.ref-pre-u22`: solo el editor;
- en el navegador integrado, contra staging local o fixtures: editar un publicado, guardar con observación, abrir el historial y añadir un artista nuevo; capturas a 1440 y 390.

No toques el editor de propuestas (U23) más allá de lo que comparten ReleaseForm y EditorCredits: anota en la entrega qué heredó. No hagas commit.
Entrega: archivos, regresiones encontradas y su arreglo, capturas, y lo que heredó ProposalEditor.
```

## U23 — Propuestas: bandeja y editor de propuesta

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta la etapa U23 de `docs/producto/plan-estudio-rediseno-2026-11-07.md`: la bandeja de Propuestas y el editor de propuesta, para admin y colaborador. U20–U22 deben estar aceptadas.

Lee primero:
- las secciones 1, 2, 3 y U23 del plan, y las decisiones D2 y D5 tal como quedaron;
- los tableros «4 · Propuestas» y «5 · Propuesta en el editor» del lienzo (Artifact read, path `project/Propuestas.dc.html` y `project/PropuestaEditor.dc.html`): https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r;
- en `docs/modernizacion/decisiones.md`, «Bandeja del Estudio (U17)» y «U19»; en `docs/modernizacion/u19-estudio-flujo-2026-10-15.md`, «La cola se corrige en el editor del Estudio» y la regla de «tomada»;
- `src/routes/estudio/propuestas/+page.svelte`, `src/lib/components/estudio/{ProposalEditor,inboxSelection.svelte}.ts|svelte`, `src/lib/domain/studioInbox.ts`, `src/lib/layouts/Inbox*.svelte`, `src/lib/domain/contributionContract.ts` y `src/lib/stores/contributionsStore.ts`;
- `tests/studio-inbox.test.mjs`, `tests/proposal-editor.test.mjs` y las specs de navegador de Propuestas.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u23 npm run visual:capture`.

Bandeja:
- h1 «Propuestas» con su conteo. Sin descripción.
- Grupos con nombre y conteo: «Prioritaria», «Comunidad» y, para colaborador, «Mis aportes». Las ayudas de `studioInbox.ts` salen de la vista: si nadie más las usa, bórralas del dominio y de `/lab`.
- Ítem:
  - portada de 36 px, título, artistas y fecha relativa;
  - a la derecha, un punto de estado, o ✓ si está lista para administración;
  - «n campos editados» sale.
- Resumen:
  - cabecera con portada de 72 px, título, artistas y una línea de StatusDot (estado · cola · enviada · autor), más el icono de la fuente;
  - campos en tres columnas (Tipo, Fecha, Sello · Colaboradores, Géneros, País; dos columnas bajo 720 px), con un punto ámbar junto a la etiqueta del campo editado (tooltip «Cambiado frente a la fuente»);
  - la nota como cita, o nada si no hay;
  - sin leyenda, sin «De la fuente…», sin «En el editor la corriges…».
- Barra del resumen: «Editar», Devolver ▾ y Aceptar y publicar │▾ (SplitButton). Si D2 = no, solo «Editar».

Editor de propuesta:
- La misma cabecera de U22, más ‹ n de N › para ir a la anterior o la siguiente de la misma bandeja, sin volver.
- Bajo la cabecera, una línea con el autor, la nota y la marca «Sin tomar» o «Tomada por …»; la regla completa va en el tooltip.
- El bloque «Propuesta» desaparece.
- Barra de admin: Guardar · Devolver ▾ (Pedir cambios…, Rechazar…) · «Sin cambios» o «n cambios» · Aceptar y publicar │▾ (Aceptar como borrador).
- Pedir cambios y Rechazar abren un popover con la nota obligatoria y su botón de confirmar: las mismas reglas de hoy, que sin nota no envían.
- Barra de colaborador: Guardar corrección · Marcar lista para admin (primaria). La nota interna opcional va en el popover de «Marcar lista».
- Autor bloqueado y estados de error: mismos mensajes, en una línea.

Transición: «Editar» en el resumen y el regreso desde el editor no mueven la cabecera (misma posición de portada y título). Usa la navegación que ya existe (`?propuesta=` y `studioProposalEditorHref`); no inventes rutas. Si el navegador lo admite, usa View Transitions con `view-transition-name` en portada y título, y sin animación cuando `prefers-reduced-motion`.

Reseña (D7): el editor de propuesta no muestra ni precarga la reseña. Quita la precarga con `team_note` de `src/lib/domain/proposalEditor.ts` y ajusta `tests/proposal-editor.test.mjs`. Si D7(b) está aprobada en la sección 5 del plan, añade una migración nueva que, al aceptar, deje de usar `team_note` como respaldo de `review` (hoy `coalesce(p->>'review', p->>'team_note', '')` en `20261015190100_u19_g1_contribution_v3.sql`). Hazlo con `create or replace` de la función, sin tocar migraciones ya aplicadas, con su verificación en `tests/sql/` y probándolo en el stack local aislado. Si D7(b) no está aprobada, no toques el servidor y anótalo en la entrega.

Seguridad: no cambies qué RPC se llama ni con qué payload. La única excepción es D7(b). La regla de «tomada» la impone el servidor; la interfaz solo la muestra.

Aceptación:
- `npm test` (`studio-inbox`, `proposal-editor`, `contribution-*`), `build`, `lint:tokens` y `test:browser` ×2 en verde;
- visual:compare contra `.ref-pre-u23`: solo Propuestas;
- en el navegador integrado, en el stack local: como admin, aceptar y publicar, aceptar como borrador, pedir cambios sin nota (debe bloquear) y con nota, rechazar, y ‹ › entre propuestas; como `colaborador_qa`, corregir, guardar y marcar lista. Capturas a 1440 y 390.

No hagas commit.
Entrega: archivos, matriz rol × acción con el resultado, capturas, y cualquier texto o regla que no pudo quedar en tooltip.
```

## U24 — Reportes

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta la etapa U24 de `docs/producto/plan-estudio-rediseno-2026-11-07.md`: la bandeja de Reportes del Estudio. U20–U23 deben estar aceptadas.

Lee primero:
- las secciones 3 y U24 del plan;
- el tablero «6 · Reportes» del lienzo (Artifact read, path `project/Reportes.dc.html`): https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r;
- `src/routes/estudio/reportes/+page.svelte`, `src/lib/services/problemReports.ts`, `docs/modernizacion/e18-reportes-problemas-2026-09-23.md` y las specs de navegador de Reportes.
Guarda la referencia: `VISUAL_BASELINE_DIR=.ref-pre-u24 npm run visual:capture`.

Haz:
- h1 «Reportes» con «n abiertos». Sin descripción.
- Lista: punto de estado y descripción en dos líneas como máximo; debajo, tipo y fecha. Grupos «Abiertos» y «Cerrados».
- Detalle:
  - línea de StatusDot (estado · tipo · fecha y hora);
  - la descripción como titular;
  - una fila de iconos: página (enlace), captura (miniatura o «Sin captura»), quién reporta y «n reportes más» si los hay;
  - el lanzamiento como bloque de acción: portada de 56 px, título y artista, una fila con Tipo · País · Sello · estado (para comparar con lo reportado), un icono a la ficha pública y «Corregir lanzamiento» como **acción primaria** de la pantalla. Abre el editor con `?desde=reporte:<id>` (o el mecanismo que ya exista para volver); al guardar vuelve al reporte con el estado «Resuelto» preseleccionado, sin guardarlo solo. «Guardar» del reporte pasa a secundario. Si esto exige tocar el servicio o la URL del editor más allá de un parámetro de retorno, detente y pregunta;
  - Estado y Asignado en dos columnas, y «Nota interna» con el marcador «Solo la ve el equipo»;
  - Guardar.
- El aviso sobre adjuntos y correo sale de la pantalla. Si es una regla de privacidad que hay que conservar, pásala al tooltip de «Nota interna» y dilo en la entrega.

No cambies estados, transiciones ni el servicio.
Aceptación: `npm test`, `build`, `lint:tokens` y `test:browser` en verde; visual:compare contra `.ref-pre-u24`, solo Reportes; capturas a 1440 y 390 en el navegador integrado. No hagas commit.
Entrega: archivos, textos movidos y capturas.
```

## U25 — QA y cierre

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa U25 de `docs/producto/plan-estudio-rediseno-2026-11-07.md`: QA y cierre del rediseño del Estudio. U20–U24 deben estar aceptadas.

Lee primero el plan completo, «QA de interfaz (U18)» en `docs/modernizacion/decisiones.md` y `docs/modernizacion/u18-qa-interfaz-2026-10-14.md` (los criterios de ancho y zoom).

Haz:
1. Responsive: las 7 pantallas del lienzo a 390, 768, 1024 y 1440, y con zoom al 200 %. Nada de scroll horizontal de página; la tabla hace scroll en su caja. `npm run test:anchos`.
2. Accesibilidad:
   - todo IconButton e icono informativo tiene nombre accesible;
   - el foco es visible en SplitButton, el control segmentado y la barra plegada;
   - el menú se maneja con teclado;
   - el contraste de los textos tenues es ≥ 4.5:1;
   - las marcas con tooltip llevan `aria-describedby`.
3. Voz: recorre cada pantalla contra la sección 3 del plan y lista lo que sobre.
4. Suite: `npm test`, `build`, `lint:tokens` y `test:browser` ×3 seguidas en verde. Si aparece un intermitente, mide su frecuencia y su causa; no lo escondas con reintentos.
5. Visual: `visual:compare` contra la baseline vigente. Muéstrame las diferencias y, solo con mi visto bueno, `visual:capture` para aceptarlas.
6. Staging: recorrido con admin y con `colaborador_qa` (credenciales en `.env.local`): Catálogo, lote, editor, Propuestas (aceptar, devolver), Reportes y Diccionarios. Capturas en `docs/modernizacion/capturas-u25/`.
7. Documentación:
   - en `docs/modernizacion/decisiones.md`, «Rediseño del Estudio (U20–U25)» con lo decidido, incluido D1–D7;
   - el expediente `docs/modernizacion/u25-estudio-rediseno-AAAA-MM-DD.md`;
   - una entrada en `estado.md`.

No hagas commit hasta que diga «aceptado».
Entrega: hallazgos por severidad (P0/P1/P2), resultados de la suite, diferencias visuales y si el rediseño queda listo para PR.
```
