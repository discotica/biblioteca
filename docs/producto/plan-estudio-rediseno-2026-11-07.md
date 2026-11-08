# Plan de rediseño del Estudio — 2026-11-07

El Estudio funciona, pero cuesta leerlo: subtítulos, ayudas y leyendas compiten con la próxima acción. Este plan lo poda sin cambiar su estructura ni sus contratos de datos.

- **Propuesta visual (a aprobar antes de codificar):** <https://claude.ai/artifact/QgDaUEH4YpitMvz4zfRk5r>. Son 7 pantallas a 1440 px, con los tokens reales.
- **Prompts por etapa:** [`prompts-estudio-rediseno-2026-11-07.md`](./prompts-estudio-rediseno-2026-11-07.md).
- **Etapas:** de U20 a U25. Siguen la serie de interfaz (U1–U19).

## 1. Decisiones de partida (rondas del 2026-11-07)

| Tema | Decisión |
| --- | --- |
| Alcance | El Estudio de admin completo: Catálogo y sus vistas rápidas, editor de lanzamiento, Propuestas, Reportes y Diccionarios. El colaborador **hereda** los mismos componentes con sus acciones (ver §5, D5). Sugerir y Mis aportes quedan fuera. |
| Orden | **Después del corte E22-B.** Se corta con el Estudio de rc3, que dio GO, y el rediseño entra como mejora en producción. No reabre la QA de rc3. |
| Dónde se ejecuta | En la app de Claude (pestaña Code), con una sesión nueva por etapa. VS Code no aporta nada que esta app no tenga: es el mismo Claude Code, y aquí además hay navegador integrado y artifacts. |
| Fuente de diseño | El lienzo de la propuesta. Nadie codifica antes de que el usuario apruebe U20-0. |
| Texto | Poda media-alta. Fuera subtítulos, eyebrows, leyendas y ayudas permanentes. Una regla que no se deduce queda como **marca corta junto al dato**, y su explicación va en el tooltip. |
| Iconos | Acciones de fila, estado como punto + palabra, barra lateral plegable y señales del catálogo (falta portada, reportes). Todo icono lleva tooltip y `aria-label`. |
| Carácter | Herramienta silenciosa: densidad compacta real y verde ácido solo para la acción principal y el estado activo. Sin tarjetas anidadas. |
| Estructura | **A · Poda sobre lo actual.** Mismas rutas y patrones: tabla → editor en el Catálogo, y bandeja en Propuestas y Reportes. |
| Editor | Una página **sin tarjetas**: secciones con la etiqueta en el margen y líneas finas. Los enlaces (fuente, ficha, historial) pasan a iconos en la cabecera. El bloque «Propuesta» se reduce a una línea. |
| Decidir una propuesta | **Guardar · Devolver ▾ · Aceptar y publicar │▾.** Devolver agrupa Pedir cambios y Rechazar, y cada uno abre su nota obligatoria. La flecha de Aceptar lleva a «como borrador». |
| Bandeja | **Resumen mínimo**, con la misma cabecera que el editor: «Editar» expande sin cambiar de lugar. «Editado» aparece una sola vez, como un punto junto al campo. Se puede decidir desde el resumen. |
| Reseña | **Fuera de la interfaz** (comentario del 2026-11-07). La columna `review` se queda en el esquema, pero ninguna pantalla permite escribirla. Ver D7 para la ficha pública y el respaldo del servidor. |

## 2. Diagnóstico (verificado en código y capturas)

### Sistema

- **La densidad compacta no llega a los controles.** `ToolLayout` pone `data-density="compact"`, pero `Field`, `Button`, `Select` y `Combobox` no leen `--density-control-h`. Por eso los controles del Estudio miden 44 px, igual que en el sitio público.
- **Padding del estado vacío.** `EmptyState size="inline"` tiene `padding: var(--space-4) 0`, sin margen horizontal. Dentro de la tabla del Catálogo (por ejemplo, Borradores en 0), el texto queda pegado al borde de la tarjeta.
- **Estados en caja y mayúsculas.** `Chip kind="status"` se trunca en la columna Estado («PUBLI…», «BORRA…»).
- **Tarjeta dentro de tarjeta.** El editor apila panel → sección → subpanel de créditos. La bandeja apila panel → lista y panel → detalle.

### Texto que sobra (muestras)

| Dónde | Hoy | Propuesta |
| --- | --- | --- |
| Catálogo, subtítulo | «Todos los lanzamientos, del más reciente al más antiguo.» | Nada. El conteo va junto al título. |
| Catálogo, cabecera de tabla | «Todos los lanzamientos · 2.790 lanzamientos» | Nada. La barra lateral dice dónde estás. |
| Catálogo, fila | slug, «Editado 30/09/2026, 9:3…», «Falta: Portada» | Título solo. La edición va en el tooltip; la falta, como icono. |
| Propuestas, subtítulo | «Revisa cada propuesta y ábrela en el editor para…» | Nada. |
| Propuestas, grupos | «Aportes de colaboración y propuestas ya preparadas.» · «Prepara propuestas ajenas…» · «Pasan directo a administración…» | Solo el nombre y el conteo. |
| Propuestas, detalle | Leyenda «EDITADO difiere de lo que detectó la fuente» + chip por campo + «1 campo editado» en la lista | Un punto ámbar junto al campo, con tooltip. |
| Propuestas, detalle | «De la fuente. Se publica con el lanzamiento.» | Nada. |
| Propuestas, detalle | «En el editor la corriges y decides: …» + «Abrir en el editor» | «Editar» + la barra de decisión. |
| Editor de propuesta | Bloque «Propuesta»: Cola · Enviada · Quien propone (frase de 25 palabras) · Fuente · Nota | Una línea bajo la cabecera: autor, nota y la marca «Sin tomar» (la regla en el tooltip). La fuente, como icono en la cabecera. |
| Editor de propuesta | «Sin cambios. Abrirla no la toma.» | «Sin cambios». La regla vive en el tooltip de «Sin tomar». |
| Editor | Eyebrow «EDITAR LANZAMIENTO» / «CORREGIR PROPUESTA» | Nada. |
| Editor | «Si es autoeditado, elige «Independiente».» | Nada. «Independiente» va fijo arriba en la lista. |
| Editor | «Nuevo · se crea al aceptar» por artista | Marca «NUEVO», con la regla en el tooltip. |
| Editor | «Pega una URL HTTPS. La detección automática llegará después.» | La etiqueta dice «Portada · URL HTTPS». |
| Editor | «Arrastra para ordenar o cambiar de grupo; Mayús o Cmd seleccionan varios.» | Nada en pantalla. El asa de arrastre lo dice, y el resto va en el tooltip del asa. |
| Reportes, subtítulo | «Los adjuntos y el contexto técnico solo los ve administración. Las respuestas…» | Nada. El campo se llama «Nota interna», con el marcador «Solo la ve el equipo». |
| Diccionarios, subtítulo | «Lista cerrada: solo los seleccionables se ofrecen…» | Nada. El filtro «Seleccionables» lo dice. |
| Barra lateral | «ESTUDIO» | Nada. |

## 3. Guía de voz del Estudio (aplica a todas las etapas)

1. **Sin subtítulo bajo el h1.** El título lleva su conteo (`Catálogo 2.790`).
2. **Sin eyebrows ni leyendas.** Si algo necesita leyenda, el marcador no se entiende: hay que cambiar el marcador.
3. **Una regla que no se deduce = marca + tooltip.** Visible, como mucho 3 palabras («NUEVO», «Sin tomar», «Falta portada»). La explicación completa va en `title` o en el tooltip, y en `aria-describedby` cuando es un control.
4. **Estados:** punto de color + una palabra, en caja normal. Verde = publicado o listo; ámbar = pendiente o falta algo; contorno = borrador; rojo = archivado o rechazado.
5. **Vacíos:** título de 2 o 3 palabras, una línea de contexto y una acción. Siempre con padding en los cuatro lados.
6. **Botones:** verbo con el objeto mínimo («Guardar», «Devolver», «Aceptar y publicar»). La acción principal es la única verde.
7. **Errores:** qué pasó y qué hacer, en una línea.
8. **No se pierde información:** lo que sale de la pantalla queda en un tooltip, en el historial o en un menú. Los textos que exigen los tests de accesibilidad se conservan como `aria-label`.

### Ritmo de espaciado (comentario del 2026-11-07: «el sitio pega demasiado los contenedores»)

La densidad compacta se aplica a la **altura de los controles** (36 px), no a los espacios entre elementos:

- etiqueta → control: 8 px; filas de campos: 20 px; columnas: 32 px;
- padding interno de un control: 12 px a los lados; de una celda de tabla: 16 px; de un ítem de bandeja: 14 × 16 px;
- padding de un panel (resumen, detalle, barra de acciones): 20–24 px; secciones del editor: 28 px arriba y abajo;
- cabecera → contenido: 20 px;
- acciones de quitar: icono ✕ con nombre accesible, separado al menos 12 px de lo que quita; nunca la palabra «Quitar» pegada al título.

Se definen como tokens en U20 (`--tool-gap-*`, `--tool-pad-*`) para que U21–U24 no usen números sueltos.

## 4. Etapas

Un chat por etapa, en orden y uno a la vez sobre el árbol. Cada etapa guarda su referencia visual antes de tocar nada (`VISUAL_BASELINE_DIR=.ref-pre-u2N`), para medir solo sus propias diferencias.

### U20-0 — Aprobar la propuesta (solo el usuario)

- Revisar el lienzo y dejar comentarios.
- Cerrar las decisiones de §5.
- Sin prompt. Lo que cambie se ajusta en el lienzo antes de U20.

### U20 — Base: densidad, primitivas y barra lateral

- La densidad compacta llega a `Button`, `Field`, `Select`, `Combobox`, `Textarea` e `IconButton` mediante `--density-control-h`/`-px`. Fuera del Estudio no cambia nada.
- `EmptyState inline` con padding horizontal. Variante con icono.
- **`StatusDot`**: punto + palabra, con tonos `ok`, `pending`, `draft`, `danger` y `neutral`. Sustituye a `Chip kind="status"` solo en el Estudio.
- **`SplitButton`**: acción principal + menú, sobre `Menu`.
- **`SourceLink`**: botón de icono que abre la fuente con el glifo de su proveedor (`bandcamp`, `soundcloud`, `spotify`) y una flecha externa para cualquier otro enlace. Tooltip y `aria-label` «Abrir en {Proveedor}». Añade el icono `spotify` a `icons.ts`. Lo usan la bandeja, el editor de propuesta, el editor de lanzamiento y Reportes (tablero 4b del lienzo).
- **`ToolLayout`** plegable a iconos con conteos. La preferencia queda en `localStorage`, envuelta en try/catch. Sin la etiqueta «ESTUDIO».
- **`ToolHeader`** sin `description`: el título con conteo opcional y las acciones en una fila.
- Todo se muestra en `/lab`.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: primitivas compartidas y densidad, que pueden filtrarse al sitio público.
  - Escalar solo si `visual:compare` muestra diferencias fuera del Estudio que no se explican.

### U21 — Catálogo y Diccionarios

- Tableros 1 a 3 del lienzo.
- Catálogo:
  - búsqueda, filtros y «Nuevo» en una fila;
  - la barra de lote reemplaza a la de filtros mientras hay selección;
  - fila sin slug ni «Editado»;
  - estado con `StatusDot`;
  - señales como icono + tooltip;
  - vacío con `EmptyState` corregido.
- Diccionarios:
  - pestañas con conteo;
  - filtro segmentado (Todos, Seleccionables, Legado, Sin uso);
  - estado con punto;
  - «publicados» en el tooltip del número;
  - el alias en línea con el nombre.
- **Perfil de ejecución:**
  - Modelo: Sonnet 5.5.
  - Esfuerzo: high.
  - Motivo: UI acotada sobre primitivas ya hechas.
  - Escalar a Opus solo si el lote o la paginación cambian de comportamiento.

### U22 — Editor de lanzamiento

- Tablero 7. `ReleaseEditor` y `ReleaseForm`:
  - secciones sin tarjeta, con la etiqueta en el margen (140 px) y separadores finos;
  - cabecera con estado y versión, «Falta …» o «✓ Lista para publicar», e iconos de fuente, historial (con conteo) y ⋯;
  - Datos técnicos como enlace «+», que se despliega en el sitio. **La reseña desaparece del editor** (campo, enlace y textos que la mencionan, como «Solo admin cambia la reseña y la portada.» → «Solo admin cambia la portada.»). El tipo de datos la conserva, y guardar no la toca;
  - Radar con el mismo lenguaje que el filtro de la barra de búsqueda: cinco ejes con cinco puntos (`RadarFiltros`) y el pentágono de `RadarVisual` a unos 136 px al lado, en un bloque compacto (unos 420 px). Sustituye a los sliders de `RadarControls`. Los puntos se extraen a un componente compartido (`RadarPips`) que usan la búsqueda y el editor; sin datos, «+ Radar»; con datos, «Quitar» junto al título;
  - créditos sin subpanel;
  - barra fija con el resumen de cambios, la observación y Guardar.
- El índice lateral se quita si se aprueba D1. Si no, queda como columna fina.
- El historial se abre desde el icono (panel o `Sheet`) y deja de ser una sección.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: formulario grande, sticky y estado de cambios (U16, RC2-P1-01).
  - Escalar a xhigh solo si aparece una regresión de guardado o de créditos.

### U23 — Propuestas: bandeja y editor de propuesta

- Tableros 4 y 5. Bandeja:
  - grupos sin ayuda;
  - ítem con portada, título, artistas, fecha relativa y estado (punto o ✓ de «lista»);
  - resumen mínimo con la misma cabecera que el editor, campos en tres columnas (dos bajo 720 px), punto ámbar en «Editado» y la nota como cita;
  - barra Editar · Devolver ▾ · Aceptar y publicar │▾.
- Editor de propuesta:
  - línea de autor, nota y «Sin tomar»;
  - ‹ n de N › para recorrer la cola;
  - la barra de decisión es la misma de la bandeja;
  - «Pedir cambios…» y «Rechazar…» abren un popover con la nota obligatoria y la confirmación.
- La transición entre el resumen y el editor conserva la cabecera: misma posición de portada y título, sin salto de layout.
- Colaborador (D5): Guardar corrección · Marcar lista para admin (primaria), sin Devolver. La nota interna sale de la barra y pasa al popover de «Marcar lista».
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: xhigh.
  - Motivo: permisos por rol, regla de «tomada» y decisiones irreversibles (`review_contribution`).
  - Escalar: no aplica; ya va en xhigh.

### U24 — Reportes

- Tablero 6:
  - lista con punto de estado y dos líneas de descripción;
  - detalle con la descripción como titular, datos en una fila de iconos (página, captura, quién reporta y sus otros reportes), el lanzamiento como bloque de acción (portada, título, artista, Tipo · País · Sello · estado, icono de ficha pública y «Corregir lanzamiento» como acción primaria: abre el editor y al guardar vuelve al reporte con «Resuelto» preseleccionado), Estado y Asignado en dos columnas, y Nota interna;
  - Guardar.
- **Perfil de ejecución:**
  - Modelo: Sonnet 5.5.
  - Esfuerzo: medium.
  - Motivo: una pantalla con un contrato estable (E18).
  - Escalar a high si cambia la lógica de estados.

### U25 — QA y cierre

- Ancho 390 y zoom 200 en las 7 pantallas.
- Accesibilidad: todo icono con nombre, foco visible, menú del `SplitButton` con teclado, contraste de `--color-texto-tenue`.
- `npm test`, `build`, `lint:tokens`, `test:browser` ×3 y `test:anchos`. `visual:capture` se acepta solo con el visto bueno del usuario.
- Recorrido en staging con admin y `colaborador_qa`.
- `decisiones.md`, con una sección por etapa; `estado.md`; capturas en `docs/modernizacion/capturas-u25/`.
- **Perfil de ejecución:**
  - Modelo: Opus 5.5.
  - Esfuerzo: high.
  - Motivo: QA transversal y criterio para aceptar baselines.
  - Escalar si `test:browser` queda intermitente.

## 5. Decisiones de U20-0

**Lienzo aprobado el 2026-11-07** («listo, ejecuta»). D1–D6 quedan cerradas como propone el lienzo. **D7 cerrada el 2026-11-07**: (a) sí, la reseña también se oculta en la ficha pública (U22); (b) sí, se autoriza la migración que deja de copiar `team_note` a `review` (U23).

| # | Pregunta | Lo que propone el lienzo |
| --- | --- | --- |
| D1 | ¿Se quita el índice lateral del editor? Contradice U16 («una sola página con secciones e índice lateral»). | Quitarlo: las etiquetas del margen hacen de índice y la página queda en ~1,5 pantallas. |
| D2 | ¿Se puede aceptar o devolver desde el resumen de la bandeja, sin abrir el editor? | Sí. Con «Editar» al lado. |
| D3 | ¿Sale el slug de la fila del Catálogo? Hoy se busca por ID. | Sale de la fila. La búsqueda por slug o ID sigue igual, y el slug aparece en el tooltip del título. |
| D4 | ¿La barra lateral arranca plegada en Propuestas, Reportes y el editor? | Desplegada por defecto. Cada quien la pliega y la preferencia se recuerda por navegador. |
| D5 | El colaborador no entró en el alcance, pero usa los mismos componentes. ¿Hereda el rediseño? | Sí. Mismas pantallas con sus acciones, sin diseño propio. |
| D6 | Móvil: el lienzo solo muestra 1440 px. | U25 adapta cada pantalla con las reglas de U18. Si quieres ver móvil antes de codificar, se añaden tableros a 390 px. |
| D7 | La reseña sale de la interfaz, pero quedan dos fugas: (a) la ficha pública (`ReleaseDetail.svelte`) muestra `release.review` si existe; (b) al aceptar una propuesta, el servidor usa `coalesce(review, team_note)` (`20261015190100_u19_g1_contribution_v3.sql`), así que la nota de quien propone se publica como reseña. `proposalEditor.ts` también precarga la reseña con la nota. | (a) Ocultarla también en la ficha. (b) Una migración pequeña que deje de copiar `team_note` a `review`, más quitar la precarga. Es el único cambio de servidor del plan: va en U23, con su verificación SQL, y requiere tu OK explícito. |

## 6. Reglas de ejecución

- **Rama:** `estudio-rediseno`, desde `main` (`f7582bf`, etiqueta `v1.0.0`, en producción desde E22-B el 2026-10-25). Nunca `main` ni `dist` a mano.
- **Commits:** «aceptado» en el chat de la etapa hace commit en la rama y push de esa rama.
- **Datos:** sin migraciones ni cambios de RPC. Si una etapa necesita un dato nuevo, se detiene y lo pregunta.
- **Lote de textos:** los textos que leen los tests (`getByRole`, `getByText`) se actualizan en el mismo cambio. Nunca se borra una prueba para que pase.
- **A/B:** nunca intercambiando archivos del árbol (ver memoria del proyecto). La comparación es contra `.ref-pre-u2N`.
