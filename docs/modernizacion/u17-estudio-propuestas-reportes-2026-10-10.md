# U17 — Estudio: propuestas y reportes (2026-10-10)

Etapa U17 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u17--estudio-propuestas-y-reportes). Claude Opus 5.5, esfuerzo `high`, como asigna el plan. No hubo que escalar ni volver a E09: la bandeja se construyó solo con lo que E09 y E18 ya exponen (ver "Contrato E09").

Estado: **implementada, pendiente de aceptación.** Sin commit, push, despliegue, datos ni producción. Ningún estado, permiso, RPC, SQL ni RLS cambió.

## Condición de arranque

- **U15 aceptada** (2026-10-10, `decisiones.md`). **U16 implementada, sin aceptar.**
- **Línea base visual:** la oficial sigue en U10. Antes de editar:
  - `visual:compare` contra `.ref-pre-u16` dio exactamente lo que dejó U16 (176 capturas: 157 iguales, 15 distintas y 4 nuevas). El árbol no se había movido;
  - como U16 no está aceptada, el árbol de partida se capturó en `tests/visual/.ref-pre-u17/` (176 capturas, 0 diferencias). U17 se compara contra esa referencia.
- **Antes de editar:** E07, E10 y U15: 31/31.
- **Respaldos** en `respaldos/*.pre-u17.*.txt`:
  - las dos secciones (`estudio-propuestas-page`, `estudio-reportes-page`);
  - `/lab`, `tokens.css` y el índice de layouts;
  - las pruebas `e10`, `u15` y `censo.spec`;
  - `data.ts` y `mocks.ts` de la suite visual (no cambiaron);
  - `package.json`.

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Propuestas en bandeja | Lista a la izquierda y detalle a la derecha (`InboxLayout`). En móvil, primero la lista; al elegir, solo el detalle, con "Volver a las propuestas". |
| 2. Detalle: solo lo propuesto, con lo editado marcado | Los ocho campos del payload v2 en el orden de Sugerir. "Editado" marca los que difieren de lo que detectó la fuente. Lo detectado no se muestra. |
| 3. Acciones por rol, iguales a las de E10 | El colaborador prepara y marca la propuesta como lista para administración. El admin aprueba (con resumen y confirmación), pide cambios o rechaza; estos dos últimos con nota obligatoria. |
| 4. Reportes en la misma bandeja | Abiertos y "Resueltos y cerrados", estados en español, enlace al lanzamiento y a sus reportes, y la clasificación de siempre. |

## Flujo de moderación (para U18)

### Quién ve qué

| Rol | Lista | Acción en el detalle |
| --- | --- | --- |
| Admin | **Cola prioritaria** (aportes de colaboración y propuestas preparadas) y **Cola comunitaria** (pendientes de la comunidad) | Nota para la persona autora + **Revisar publicación** · **Solicitar cambios** · **Rechazar**, en una línea |
| Colaborador | **Cola comunitaria**, primero porque es lo que puede preparar, y **Mis aportes prioritarios** si los tiene | En la comunitaria ajena: "Nota interna (opcional)" + **Marcar lista para administración**. En sus aportes: "Pendiente de revisión administrativa.", sin botones |
| Comunidad y sin sesión | Sin cambios (gates del layout de U15) | — |
| Cualquiera, con `?lanzamiento=` | "Propuestas de este lanzamiento", en cualquier estado | Solo consulta, también para admin (como en U15) |

- **Filtros y acciones iguales a E10**, en `src/lib/domain/studioInbox.ts` (`proposalGroups`, `proposalAction`), con pruebas en node:
  - comunitaria: `queue_kind = community` y `pending`;
  - prioritaria: `queue_kind = collaborator` o `ready_for_admin`;
  - preparar: solo una comunitaria pendiente ajena (sin auto-preparación);
  - las resueltas no tienen acciones.
- **Reportes:** solo admin, como antes. Colaborador ve el aviso del layout.

### Decidir

1. **Aprobar.** "Revisar publicación" abre el `Dialog` de U6: título, "Confirma el lanzamiento que se publicará con estos datos." y los campos. El foco cae en "Volver", y Escape devuelve el foco al botón. "Aprobar y publicar" llama `review_contribution(id, 'approved', null)`. Si hay nota escrita, se envía.
2. **Pedir cambios o rechazar** sin nota no llama al servidor. El error va en el campo ("Escribe una nota para solicitar cambios." / "Escribe una nota antes de rechazar.", con `aria-invalid`) y el foco va a la nota. Con nota: `review_contribution(id, acción, nota)`.
3. **Después de decidir:**
   - la propuesta sale de la lista;
   - el aviso dice el resultado ("Propuesta comunitaria: Aceptado.");
   - al aprobar, el aviso ofrece **"Abrir el lanzamiento en el Catálogo"**;
   - en ancho se abre la siguiente (o la anterior si era la última), con el foco en su título. En móvil se vuelve a la lista;
   - en los dos casos, la vista sube al aviso;
   - se refrescan los conteos de la barra lateral.
4. **Preparar** (colaborador): `prepare_contribution_for_admin(id, payload tal como llegó, nota interna)`. La propuesta sale de su cola.

**Aprobar y corregir sin salir del Estudio ni escribir URLs** (prueba del plan): desde `/estudio`, la barra lateral → Propuestas → la propuesta → Revisar publicación → Aprobar y publicar → "Abrir el lanzamiento en el Catálogo" → el editor de U16 → Guardar. Se comprueban los dos RPC y que toda navegación quedó bajo `/estudio`.

### URL, foco e historial

- La propuesta abierta va en la URL: `?propuesta=<id>`, y `?reporte=<id>` en Reportes. Se combina con `?lanzamiento=`. Cada fila es un enlace: se puede abrir en otra pestaña.
- **Ancho (768 px o más):**
  - sin `?propuesta=` (o con un id que ya no está), se abre la primera;
  - elegir reemplaza la entrada del historial y deja el foco en la fila.
- **Móvil (menos de 768 px):**
  - sin `?propuesta=` solo se ve la lista;
  - elegir crea una entrada nueva y lleva el foco al título del detalle;
  - "Volver" o "atrás" regresan a la lista, con el foco en la fila que se abrió.
- **Reportes:** al guardar, el reporte se fija en la URL. Así sigue abierto aunque pase a "Resueltos y cerrados" (defecto encontrado por la prueba y corregido).
- Lógica compartida: `src/lib/components/estudio/inboxSelection.svelte.ts` (`InboxSelection`).

### Qué cuenta como "Editado"

- **Se compara solo lo que la fuente detecta** (`inspect-release-source`): título, artistas principales (en orden), tipo y fecha.
- **No se marcan nunca** colaboradores, sello, géneros ni países: la fuente no los detecta.
- **Cualquier cambio de texto cuenta,** también mayúsculas y tildes; los espacios sobrantes no. E10 ignoraba mayúsculas. Aquí cuentan porque el revisor quiere saber qué tocó la persona.
- **Tipo:** la fuente dice un nombre ("Álbum") y la propuesta un slug (`album`). Se emparejan sin tildes ni mayúsculas. Un tipo detectado que quedó sin confirmar cuenta como editado.
- **Fuente ilegible** (`source_available: false` o sin nada comparable): no hay marcas, y el detalle lo dice: "La fuente no se pudo leer: todos los datos se escribieron a mano."
- **Leyenda:** "Editado difiere de lo que detectó la fuente." o "Coincide con lo que detectó la fuente.".
- **En la lista:** "N campos editados", en ámbar.
- **Lectores de pantalla:** cada marca lleva "Difiere de lo que detectó la fuente." oculto.
- **Portada detectada:** se muestra como "De la fuente. Se publica con el lanzamiento.". E09 la publica al aprobar si es HTTPS.
- **Nota de quien propone:** siempre visible; sin texto dice "Sin nota" (relevo de U13).

## Reportes

- **Lista:**
  - grupos Abiertos (`new`, `triaged`, `in_progress`, lo que cuenta la barra lateral) y Resueltos y cerrados;
  - cada fila: la descripción en dos líneas, el estado en español (chip), la categoría, la fecha y "Con lanzamiento" si lo tiene.
- **Detalle:**
  - la categoría como título, el estado y "Recibido el …";
  - "Abrir el lanzamiento en el Catálogo" y "Ver sus reportes";
  - la descripción, la página (solo la ruta, aunque el reporte guarde la URL completa), la captura (adjunta y privada, o sin captura) y la asignación;
  - "Contexto técnico" plegado: solo las claves que E18 permite (ruta, pantalla, navegador, idioma, conexión, versión, catálogo), en palabras.
- **Clasificar:**
  - el `Select` de U5 con los cinco estados en español, en lugar del `select` nativo blanco del censo;
  - "Respuesta interna (opcional)" y "Guardar clasificación";
  - el mismo RPC y los mismos argumentos que antes: `admin_update_problem_report(id, estado, admin actual, nota)`.
- **Ningún estado crudo** en inglés en la interfaz (comprobado en la prueba).

## Primitivas y layouts

En `$lib/layouts` y en `/lab` (sección "Bandeja", capturas `lab-u17-D/M`):

| Pieza | Qué es |
| --- | --- |
| `InboxLayout` | Lista y detalle. Grupos con nombre, número, ayuda y texto de vacío. La lista es fija bajo el header y se desplaza por dentro; en tablet ocupa 2/5. Por debajo de 768, un panel cada vez, con "Volver". |
| `InboxItem` | Fila de al menos 56 px (`--tool-row-h`): título en dos líneas y, debajo, el estado, una marca ámbar y los datos. Es un enlace: el clic simple elige y Cmd/Ctrl/central abren otra pestaña. |
| `InboxDetail` | `article` con cabecera (antetítulo, h2 enfocable, enlaces), cuerpo y pie de acciones. Da estilo a `.l-inbox-fields`, `.l-inbox-note` y `.l-inbox-buttons`. |
| `InboxField` | Dato `dt`/`dd`, con "—" (y "Vacío" para lectores) si falta, y la marca opcional "Editado". |

- **Botones de decisión** en una línea. Si el detalle mide menos de 480 px (container query: móvil, y tablet con la lista al lado), se apilan a todo el ancho. Así "Rechazar" no queda solo en una segunda línea (hallazgo del censo).
- **Token nuevo:** `--tool-inbox-list-w: 22rem`.
- **Primitivas usadas:** `Chip` (estado), `Textarea`, `Select`, `Button` (primary, secondary, destructive), `Dialog`, `Notice`, `ErrorState`, `EmptyState`, `LoadingIndicator` y `Cover`. No se extendió ninguna.
- `lint:tokens`: OK.

## Contrato E09

- **No cambió nada.** Las mismas lecturas (`loadEditorialQueue`, `loadReleaseContributions`) y los mismos RPC (`prepare_contribution_for_admin`, `review_contribution`), con los mismos argumentos. Las pruebas lo comprueban con igualdad estricta.
- **No hizo falta detenerse:** todo lo que muestra la bandeja está en la fila de `contributions` (payload, `detected_metadata`, estados, notas) o en `problem_reports`.
- **Limitación previa, sin cambios** (expediente de E10, "Limitación reproducible"):
  - lo que el colaborador prepara (`p_working_payload`) y su nota interna se guardan en `private.contribution_preparations`;
  - administración no los puede leer, y la aprobación publica el payload original;
  - por eso el colaborador sigue enviando el payload tal como llegó, como en E10.
  - **Para el equipo:** la ayuda de la nota interna dice "Evidencia o contexto para administración", pero hoy nadie la lee en el Estudio. No se cambió, porque las acciones debían quedar iguales. Las salidas son dos:
    - cambiar el texto (decisión de producto);
    - abrir el caso de E09 (Opus 5.5, `xhigh`) para que el admin la vea.

## Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U18 no las vuelva a inferir.

- **La primera propuesta se abre sola en ancho; en móvil, no.** Así lista y detalle nunca quedan vacíos en desktop, y en móvil la lista es la entrada.
- **Tras decidir se abre la siguiente**, para revisar en cadena. Pasa a la anterior si era la última.
- **Colaborador: su cola comunitaria primero.** En E10, "Mis aportes prioritarios" iba arriba. Lo accionable va primero; el contenido de cada grupo no cambia.
- **"Editado" estricto** (mayúsculas y tildes cuentan). Ver arriba.
- **Errores de la acción en el detalle,** junto a los botones. El de carga es un `ErrorState` con "Reintentar". El de nota obligatoria va en el campo, en lugar de un aviso suelto.
- **Fechas** "21 de sept de 2026" (es-CO). En el detalle de un reporte, con la hora.
- **Reportes sin el título del lanzamiento:** `problem_reports` solo trae el id. El enlace lleva al editor. Buscar títulos sería una consulta nueva, fuera del alcance.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **153/153** (incluye `studio-inbox.test.mjs`, 11) |
| `npm run lint:tokens` | OK, 175 archivos, las 2 excepciones de siempre |
| `npm run build` | OK. El único aviso es el de `/cuenta` (U12), previo |
| `svelte-check` | Sin errores en los archivos de U17, salvo los de `process`/`Buffer`, que tienen todas las pruebas de navegador |
| **`u17-bandeja.spec.ts`** | **11/11**, estable con `--repeat-each=3` |
| E10 (`e10-contributions.spec.ts`), adaptada | **8/8** |
| E18 | Sin prueba de navegador propia (su verificación es SQL y no se tocó). La clasificación queda cubierta por U17 (payload exacto) y el alta por U13 |
| U15, adaptada | **15/15** |
| E07, U13 y U16 | En verde. Junto con U17, E10 y U15: **186/186 con `--repeat-each=3`** |
| `npm run test:browser` | **311 pasan**, 5 omitidas; solo falla E17:202 (conocida) |

**Qué cubre `u17-bandeja.spec.ts`:**

- **1440:**
  - lista y detalle lado a lado, con la primera abierta;
  - elegir reemplaza el historial y deja el foco en la fila;
  - "2 campos editados";
  - campos en orden, "Editado" solo en Título y Tipo, y lo detectado ausente;
  - "Sin nota", la fuente en otra pestaña y la portada;
  - "Coincide…" y la fuente ilegible;
  - enlace directo, y un id inexistente abre la primera.
- **Aprobar y corregir sin escribir URLs:** el recorrido de arriba, con los cuerpos exactos de `review_contribution` y `admin_update_catalog_release`, toda la navegación bajo `/estudio`, el foco en la siguiente, el aviso a la vista y el conteo a 3.
- **Nota obligatoria:**
  - rechazar y pedir cambios sin nota: error en el campo, foco y ningún RPC;
  - con nota: los cuerpos exactos, la siguiente abierta con el foco y la nota vacía; tras la última, la anterior.
- **Colaborador:**
  - grupos en orden y sin botones de decisión;
  - su aporte, sin botones;
  - preparar envía el payload original y la nota.
- **390, propuestas:**
  - solo la lista;
  - el detalle con el foco en el título;
  - "Volver" con el foco en la fila;
  - "atrás" del navegador;
  - enlace directo con retorno;
  - decidir vuelve a la lista con el aviso y el enlace al lanzamiento.
- **Reportes:**
  - grupos y chips en español, sin estados crudos;
  - enlaces al lanzamiento y a sus reportes;
  - las opciones del estado y el contexto técnico;
  - guardar envía el cuerpo exacto; el reporte pasa a resueltos y sigue abierto; de ahí, al editor;
  - a 390, con retorno.
- **Matriz de anchos:** 390, 834 y 1440 con el detalle abierto, sin desborde horizontal, en las dos secciones.

**Cambios en E10 y U15** (mismas aserciones de contrato; cambia cómo se recorre la interfaz):

- el detalle es `article` con el nombre de la propuesta, y se elige con su fila;
- "Título detectado" ya no se ve: se comprueba la marca "Editado" en Título;
- el error de nota está en el campo, no en un `alert`;
- la etiqueta es "Nota interna (opcional)";
- el enlace del reporte es "Abrir el lanzamiento en el Catálogo".

## Suite visual

`visual:compare` contra `.ref-pre-u17`: **182 capturas, 170 iguales, 6 distintas y 6 nuevas.** Todas del alcance. Copias (esperada y actual, y las nuevas) en [`capturas-u17/visual/`](./capturas-u17/visual/).

| Grupo | Capturas | Motivo |
| --- | --- | --- |
| Propuestas | `editorial-admin-D/M`, `editorial-colab-D`, `editorial-approve-D` | Bandeja en lugar de tarjetas apiladas; diálogo de aprobación con el `Dialog` de U6 |
| Reportes | `estudio-reportes-D/M` | Bandeja, chips de estado y `Select` del sistema |
| **Nuevas** | `estudio-propuesta-M` (detalle en móvil), `estudio-propuestas-T`, `estudio-propuesta-nota-D` (nota obligatoria), `estudio-reporte-M`, `lab-u17-D/M` | Lo que el censo no capturaba: móvil con detalle, tablet y el error |

- **Una corrida con la máquina cargada** (load ~9) también marcó `estudio-editor-medios-M`, el selector fijo del editor de U16, que U17 no toca. Aislada dio 0 diferencias, también con `--repeat-each=3`, y la corrida final no la marcó.
- `lab-D/M` no cambian: la sección nueva queda por debajo del alto máximo de esa captura.
- "El censo conserva sus 127 IDs" sigue fallando como desde U7, sin relación con esta etapa.

## Capturas del flujo

En [`capturas-u17/`](./capturas-u17/). Se regeneran con `U17_CAPTURAS=1 npx playwright test tests/browser/u17-bandeja.spec.ts --workers=1`.

- `1-bandeja-1440` y `2-detalle-editado-1440`;
- `3-aprobar-1440`, `4-aprobada-1440` (aviso y siguiente abierta) y `5-corregido-1440` (editor guardado);
- `6-nota-obligatoria-1440` y `7-colaborador-1440`;
- `8-lista-390` y `9-detalle-390`;
- `10-reportes-1440` y `11-reporte-390`;
- `12-propuesta-834` y `12-reporte-834`.

## Archivos

- **Nuevos:**
  - `src/lib/domain/studioInbox.ts` y `tests/studio-inbox.test.mjs` (en `npm test`);
  - `src/lib/layouts/InboxLayout.svelte`, `InboxItem.svelte`, `InboxDetail.svelte` e `InboxField.svelte` (exportados en `$lib/layouts`);
  - `src/lib/components/estudio/inboxSelection.svelte.ts`;
  - `tests/browser/u17-bandeja.spec.ts`;
  - `docs/modernizacion/capturas-u17/` (unos 4,5 MB) y este expediente.
- **Reescritos:** `src/routes/estudio/propuestas/+page.svelte` y `src/routes/estudio/reportes/+page.svelte`, con runas.
- **Modificados:**
  - `tokens.css` (`--tool-inbox-list-w`), `src/lib/layouts/index.ts` y `/lab`;
  - `e10-contributions.spec.ts`, `u15-estudio.spec.ts` y `tests/visual/censo.spec.ts` (6 capturas suplementarias);
  - `package.json` (`npm test`);
  - `decisiones.md` y `estado.md`.
- Sin migraciones, flags ni variables.

## Para U18

- **Recorrido en staging:** "sugerir y su aprobación en el Estudio" pasa por esta bandeja. Antes, en staging:
  - E18 corregida y D2 aplicadas (relevo de U15). Sin E18, Reportes muestra el error y el resto funciona;
  - una cuenta con rol colaborador, que staging no tiene, para probar "Marcar lista".
- **Teclado y VoiceOver:**
  - las filas son enlaces en orden de tabulación; no hay navegación con flechas;
  - comprobar el anuncio del título al abrir en móvil, la marca "Editado" (texto oculto) y el aviso tras decidir (`role=status`).
- **iPhone real:**
  - la lista fija con scroll interno no aplica en móvil (es estática);
  - comprobar el "atrás" por gesto entre detalle y lista.
- **Decisión pendiente del equipo:** la ayuda de "Nota interna" (ver "Contrato E09").
- La lista es sticky gracias a `html.is-tool` (U16). El arreglo global del `overflow-x` sigue pendiente para U18.

## Rollback

Sin datos ni migraciones.

1. Restaurar desde `respaldos/*.pre-u17.*.txt`:
   - las dos secciones;
   - `/lab`, `tokens.css` y `layouts/index.ts`;
   - `e10`, `u15` y `censo.spec`;
   - `package.json`.
2. Borrar:
   - `studioInbox.ts`, `inboxSelection.svelte.ts` y los cuatro `Inbox*.svelte`;
   - `tests/studio-inbox.test.mjs` y `tests/browser/u17-bandeja.spec.ts`;
   - `capturas-u17/`.

## Al aceptar

- **Si U16 y U17 se aceptan juntas:** borrar `.ref-pre-u16`. Si además U10b–U14 están aceptadas, `npm run visual:capture` sobre la línea base oficial y borrar `.ref-pre-u17`.
- **Si no:** `VISUAL_BASELINE_DIR=.ref-pre-u18 npm run visual:capture` para aislar U18, y borrar `.ref-pre-u17`.
- Decidir si `capturas-u17/` se versiona.
