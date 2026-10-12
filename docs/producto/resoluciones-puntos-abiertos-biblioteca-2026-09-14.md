# Resolución de los puntos abiertos de la Biblioteca Discótica

> **Continuidad:** una ronda posterior de respuestas y su secuencia de implementación están consolidadas en el [`plan de ejecución por chats`](./plan-ejecucion-biblioteca-2026-09-14.md). Este documento sigue siendo la resolución de la conversación anterior y no debe usarse aisladamente para decidir qué continúa abierto.

Fecha indicada por la transcripción: 14 de septiembre de 2026  
Documento de partida: [`decisiones-abiertas-biblioteca-2026-09-13.md`](./decisiones-abiertas-biblioteca-2026-09-13.md)  
Mapa del producto y del código: [`trazabilidad-feedback-biblioteca-2026-09-13.md`](./trazabilidad-feedback-biblioteca-2026-09-13.md)

## Alcance

Este documento registra lo resuelto en la segunda conversación. Separa tres cosas que no son equivalentes:

- **decidido**: ya existe una regla de producto suficientemente clara;
- **decidido, pendiente de implementación**: la regla está cerrada, pero el código todavía no la cumple;
- **aún abierto**: la conversación dejó una contradicción, delegó la respuesta o aplazó deliberadamente el contenido.

No se modificó código ni base de datos. Las observaciones sobre Supabase son recomendaciones de representación técnica, no cambios aplicados.

## Consolidación E00 — fuente normativa vigente

La precedencia del plan de ejecución hace que este documento sea el registro histórico de la ronda de respuestas, complementado por el plan como fuente normativa operativa. Por tanto, los estados “parcialmente cerrada”, “ambigua” o “aún abierta” que aparecen en las tablas históricas de abajo describen el estado al cerrar aquella conversación, no un bloqueo vigente para E01. E00 no inventa decisiones nuevas: solo incorpora las respuestas ya normalizadas por el plan y sus seis resoluciones derivadas.

### Seis cierres explícitos normalizados por el plan

1. **Copy de aproximados:** `No encontramos resultados exactos, pero aquí tienes los más cercanos.`; la etiqueta de transición es `Resultados aproximados`; el vacío real es `No encontramos lanzamientos con estos filtros.`. El aviso es texto en línea, no modal, pop-up ni tarjeta.
2. **Tipo:** es obligatorio y se confirma manualmente antes de enviar o publicar. La lista canónica es `Álbum`, `EP`, `Single`, `Compilado` y `Sample Pack`; `Disco` y `Album` se normalizan a `Álbum`; no existe `Sin determinar` publicable ni texto libre.
3. **Slugs y relaciones:** `release_id` es la identidad inmutable; el slug canónico se conserva al corregir título o autoría; el resolvedor prioriza slug canónico sobre alias; los alias de migración duran hasta validar rutas/crates; todo crate nuevo escribe `release_id` y conserva `lanzamiento_slug` solo como compatibilidad temporal.
4. **Ficha compartida:** modal y página completa comparten el componente de contenido, contratos y formateadores de fecha, créditos, metadata, acciones, reproducción y recomendaciones; cada contenedor conserva su propia sesión de reproductor. El modal mantiene overlay, cierre, foco e historial; la ruta mantiene su fondo y navegación.
5. **Invitación beta:** solo vive en `/`; `/?beta` y `/?beta=1` activan, `nombre` sin beta se ignora; el nombre admite Unicode, se normaliza, se recorta a 40 caracteres visibles y se inserta como texto; al cerrar se eliminan únicamente `beta` y `nombre` mediante reemplazo de historial. Copy y CTA finales: `Hola, {nombre}.`, `Bienvenida a la beta de Discótica`, cuerpo neutral aprobado y `Explorar`; la fecha se omite mientras no exista una aprobada.
6. **Reportes:** `Reportar un problema` es permanente; exige autenticación y conserva la URL de retorno al llevar a login. Adjunta descripción obligatoria, URL actual automática, `release_id` opcional/automático, captura opcional y contexto técnico automático, excluyendo cookies, tokens, formularios y datos arbitrarios. Un administrador clasifica y responde; la invitación beta puede mostrar además un correo de salida sin convertirlo en autenticación.

### Seis resoluciones derivadas de planificación

Estas no son citas nuevas del equipo: son cierres de vacíos técnicos establecidos en la sección 5 del plan, y deben mantenerse distinguibles de las decisiones explícitas anteriores.

1. La segunda fila superior solo aparece cuando debe anunciar contexto aproximado; en desktop la primera fila conserva paginación izquierda y orden derecha, y en móvil paginación y orden ocupan filas separadas.
2. En móvil, el header global solo vuelve al llegar al inicio; durante el scroll ascendente intermedio reaparece únicamente `Buscar`.
3. El orden efectivo es `Más reciente` sin criterios, `Mejor coincidencia` con texto/filtros y `Radar` con Radar recién activado; fecha reordena dentro de exactos/aproximados y A–Z/Z–A no se ofrece mientras haya aproximados.
4. Exactos siempre preceden a aproximados; el orden manual solo reorganiza cada grupo.
5. Radar actúa como compuerta: un candidato con diferencia mayor a uno en un eje activo queda fuera; no se ensancha el margen para llenar la página.
6. Si la URL activa beta, solo aparece la invitación beta en esa carga; la bienvenida general no se muestra debajo ni después de cerrarla.

**Estado E00:** decisiones vigentes consolidadas; implementación pendiente en sus etapas respectivas. No queda una contradicción documental sin resolver por la precedencia del plan. La única discrepancia de estado se conserva como historial en las secciones originales y queda corregida por esta consolidación normativa.

## Resultado ejecutivo

| Etapa | Tema | Resultado de la conversación | Situación frente al código |
| --- | --- | --- | --- |
| 1 | Relevancia | **Cerrada** | Pendiente: los filtros siguen siendo booleanos y no puntúan coincidencias parciales. |
| 2 | Relevancia y orden | **Cerrada con una validación de comportamiento** | Pendiente: el Radar actual amplía el margen hasta 5 y siempre conserva similitud como orden primario. |
| 3 | Barra de resultados | **Parcialmente cerrada** | Pendiente: falta definir qué ocupa la segunda fila superior y aprobar el copy. |
| 4 | Artistas y colaboradores | **Contrato editorial cerrado; migración y URLs parcialmente abiertas** | Pendiente: datos y cliente siguen aplanando los créditos. |
| 5 | Sugerir lanzamientos | **Flujo cerrado; obligatoriedad de Tipo resuelta por E00** | Pendiente: existe detección, pero el formulario contradice varias decisiones nuevas. |
| 6 | Ficha y reproductor | **Geometría cerrada; dos detalles abiertos** | Pendiente: portada e información comparten scroll y no se protege el viewport del iframe. |
| 7 | Recomendaciones | **Cerrada** | No implementada. |
| 8 | Búsqueda móvil | **Casi cerrada; comportamiento del header global contradictorio** | Pendiente/parcial. |
| 9 | Bienvenida | **Patrón cerrado; contenido visual y copy aplazados** | No implementada. |
| 10 | Invitación beta | **Mecánica cerrada; copy y canal de feedback abiertos** | No implementada. |
| 11 | Header | **Cerrada** | Parcial: móvil ya usa menú; desktop todavía expone todos los enlaces secundarios. |

---

## Etapa 1 — Qué significa “la mejor coincidencia”

### Decisión tomada

1. Dentro de una categoría con varias selecciones, cada valor es aceptable y tener más coincidencias mejora la posición. Ejemplo: `Cumbia + Dub` admite un lanzamiento con cualquiera de los dos, pero premia uno que tenga ambos.
2. La prioridad entre categorías queda así:

   `texto > género > Radar > país > tipo > año`

3. Una coincidencia exacta en un campo de mayor prioridad puede superar varias coincidencias secundarias.
4. Una aproximación solo es útil si coincide con al menos uno de los criterios elegidos.
5. Si ningún lanzamiento coincide con ningún criterio, se muestran cero resultados; no se rellena la página con alternativas arbitrarias.
6. El puntaje no se expone. Solo determina selección, agrupación y orden.
7. Los resultados se separan conceptualmente en:

   - **exactos**: cumplen el conjunto completo solicitado;
   - **aproximados**: incumplen parte del conjunto, pero cumplen al menos un criterio.

8. Texto y filtros definen qué entra en la muestra y con qué fuerza; el Radar organiza por cercanía dentro de la muestra que le corresponda. No se mostrará un control de pesos.

### Ejemplo acordado

Una búsqueda por `Julio Victoria + reggaetón` puede no tener coincidencia completa. En ese caso puede mostrar lanzamientos de Julio Victoria y lanzamientos de reggaetón como aproximaciones, debidamente anunciadas. Si no hay ninguno de los dos, debe mostrar el estado vacío real.

### Contraste con el código

Hoy no existe ese puntaje multinivel. La implementación aplica `AND` entre categorías, `OR` dentro de país y género y descarta lo que no pase antes de ordenar:

```js
// src/routes/+page.svelte:528-581
const base = lanzamientos.filter((l) => {
  const coincidePais =
    filtrosSeleccionados.pais.length === 0 ||
    filtrosSeleccionados.pais.some((p) =>
      (l.country || []).some((c) => normalizar(c) === normalizar(p))
    );

  const coincideGenero =
    filtrosSeleccionados.genero.length === 0 ||
    filtrosSeleccionados.genero.some((g) =>
      (l.genre || []).some((gg) => normalizar(gg) === normalizar(g))
    );

  return coincidePais && coincideGenero && coincideAño &&
    coincideMes && coincideTipo && coincideTxt;
});
```

Por eso el código actual no puede producir el ejemplo acordado: si no coincide simultáneamente texto y género, el lanzamiento desaparece. La decisión exige reemplazar el único booleano final por evaluación de coincidencia exacta, elegibilidad aproximada y puntaje ponderado.

### Estado

**Decisión cerrada; implementación pendiente.** La reunión rechazó hacer un ejercicio manual de cinco resultados, por lo que el algoritmo deberá verificarse con casos de prueba construidos a partir de estas reglas.

---

## Etapa 2 — Relación entre relevancia y “Ordenar por”

### Decisión tomada

- Sin criterios activos, el valor inicial es `Más reciente`.
- Al activar cualquier eje del Radar, el selector cambia y muestra `Ordenar por Radar`.
- El Radar debe formar primero un conjunto acotado: coincidencias exactas y variaciones de máximo un punto por eje activo. No debe ampliar gradualmente el margen hasta abarcar toda la biblioteca.
- Si no existe ningún lanzamiento dentro de ese margen, el Radar puede devolver cero resultados.
- Después de formado ese conjunto, la persona puede elegir `Más reciente`, fecha ascendente u otro orden permitido, y ese orden reorganiza el conjunto acotado.
- Al limpiar el último criterio, el selector vuelve a `Más reciente`.
- No se añade una explicación de “desempate” ni un selector de peso: se busca que el control se entienda como `Ordenar por`.
- La respuesta directa sobre A–Z/Z–A durante una búsqueda aproximada fue que **no deberían estar disponibles**. Conviene comprobar esta lectura en el prototipo porque la conversación siguió inmediatamente con otra pregunta y no formuló la lista final de opciones.

### Contraste con el código

El código actual empieza exacto, pero ensancha el Radar de 0 a 5 hasta llenar una página y luego añade incluso los elementos fuera del margen:

```js
// src/routes/+page.svelte:272-317
tolStart = 0,
tolStep = 1,
tolMax = 5,
pageSize = 12,
// ...
while (gated.length < pageSize && T < tolMax) {
  T += tolStep;
  gated = scored.filter(x => x.maxDiff <= T);
}
// ...
return [...gated, ...outGate].map(x => x.item);
```

Además, siempre ordena primero por cercanía y usa el selector actual solo como criterio secundario:

```js
gated.sort((x, y) => {
  const primary = x.score - y.score;
  if (primary) return primary;
  const secondary = secondaryCmp ? secondaryCmp(x.item, y.item) : 0;
  if (secondary) return secondary;
  return y.date - x.date;
});
```

### Estado

**Decisión cerrada, pendiente de implementación y prueba de uso.** La frase “podemos intentarlo y ver cómo sale” convierte el margen `±1` en una hipótesis aceptada para prototipar, no en una razón para volver a un selector de pesos.

---

## Etapa 3 — Barra de resultados y navegación

### Decisión tomada

#### Desktop

- La zona superior ocupa dos filas.
- Primera fila: paginación a la izquierda y `Ordenar por` a la derecha, alineados con el ancho de la grilla; el centro queda vacío.
- El contador vive solo al final de los resultados.
- Se conserva paginación tanto arriba como abajo.

#### Móvil

- Paginación y orden viven en filas distintas.
- El selector de orden debe ser pequeño y discreto.
- También se conserva paginación arriba y abajo.

#### Exactos y aproximados

- Si hay exactos y aproximados en la misma lista, una línea o separador pequeño marca el comienzo de los aproximados sin romper la grilla.
- Cuando solo hay aproximados, el aviso ocupa el lugar del contador; no convive con él.
- Cambiar página u orden lleva el viewport al comienzo de la grilla.

### Copy solicitado

La frase literal discutida fue `No hay resultados exactos. Se muestran resultados aproximados.` El equipo pidió una versión un poco más cercana y español colombiano, sin voseo argentino. Propuesta para aprobación:

> No encontramos coincidencias exactas, pero aquí tienes las más cercanas.

La misma frase funciona para singular y plural porque se refiere a “coincidencias”.

### Contraste con el código

El selector sigue dentro de `Filtros.svelte`; la paginación superior está centrada, el contador está antes de la grilla y no hay grupo ni separador de aproximaciones. Véanse [`+page.svelte`](../../src/routes/+page.svelte#L717) y [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L420).

### Inconsistencia que sigue abierta

Se respondió que la zona superior tendría **dos filas**, pero solo se asignó contenido a la primera —paginación izquierda y orden derecha— y después se decidió que el contador vive únicamente al final. No quedó definido qué ocupa la segunda fila ni si, al mover el contador, la intención final era en realidad una sola fila superior. El aviso de “solo aproximados” reemplaza al contador y por tanto quedaría al final, salvo que el equipo indique otra ubicación.

### Estado

**Layout parcialmente cerrado; implementación pendiente.** Falta resolver la segunda fila superior y aprobar o reemplazar el copy propuesto.

---

## Etapa 4 — Contrato editorial de artistas y colaboradores

### Decisión tomada

El producto necesita dos categorías comprensibles, no una taxonomía visible de créditos:

1. **Artistas principales**: admite uno o varios y conserva su orden editorial.
2. **Colaboradores**: reúne invitados, featured artists, remixers, productores y otros participantes; también conserva su orden editorial.

Reglas de presentación:

| Caso | Presentación acordada |
| --- | --- |
| Tipo `Compilado` | `Varios artistas`, independientemente del número de créditos. |
| 1–3 artistas principales, no compilado | Mostrar sus nombres en orden. |
| 4 o más artistas principales, no compilado | `Varios artistas`. |
| Principal(es) + varios colaboradores | Mostrar primero la autoría principal y después un control `Varios artistas` que despliega los colaboradores. |
| Un principal + un colaborador | Mostrar ambos y diferenciarlos por jerarquía visual; el recurso exacto no quedó cerrado. |

Todo artista acreditado, principal o colaborador, tiene página de artista y el lanzamiento forma parte de su discografía. La comunidad autenticada puede proponer una corrección mediante `Reportar un error` y un campo de texto; el equipo la revisa manualmente.

Para el catálogo existente se decidió no bloquear la publicación hasta terminar una auditoría total. Bandcamp puede ayudar a proponer la separación a partir de título, autor y tracklist. Los lanzamientos con más de tres artistas tienen prioridad de revisión, pero esa regla no basta por sí sola: también existe el caso de un principal y dos remixers.

### Traducción técnica recomendada para Supabase

La elección de “dos campos” es una decisión de interfaz y contrato editorial. No obliga a guardar dos arreglos JSON. El esquema normalizado actual puede conservar integridad, orden y páginas de artista si se reduce su taxonomía efectiva a dos grupos (`primary` y `collaborator`, o `primary` y el valor existente `other`) y se exponen ambos por separado en la vista pública.

```sql
-- supabase/migrations/20260830192747_create_canonical_catalog.sql:65-72
create table public.release_artists (
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  position smallint not null check (position >= 0),
  role text not null default 'primary'
    check (role in ('primary', 'featured', 'remixer', 'other')),
  primary key (release_id, artist_id, role)
);
```

La brecha está en el uso: la importación omite `role`, la vista agrega solo `primary` y el cliente vuelve a convertir todo en `artist: string[]`:

```ts
// src/lib/utils/catalogoStore.ts:8-13, 66-71
export interface Lanzamiento {
  artist: string[];
  // ...
}

artist: asStringList(row.artists),
```

El formulario también entrega una única lista `artists`, de modo que hoy no puede expresar la decisión editorial.

### Histórico — decisiones que quedaban abiertas al cerrar aquella conversación

- Aprobar el recurso visual para distinguir un único colaborador de la autoría principal.
- Definir una política de migración que también detecte casos dudosos con tres artistas o menos.
- Confirmar la política de URLs cuando cambia el artista visible. Recomendación técnica: el slug canónico del lanzamiento debe permanecer estable, los slugs anteriores deben conservarse como alias y los crates deben referenciar `release_id`. En legado, el fallback actual sí depende del primer artista:

```ts
// src/lib/utils/slugLanzamiento.ts:10-16
const canonicalSlug = (l?.slug ?? '').toString().trim();
if (canonicalSlug) return canonicalSlug;
const a0 = Array.isArray(l?.artist) ? (l.artist[0] ?? '') : '';
return slugify(`${title}-${a0}`);
```

### Estado

**Contrato editorial cerrado; representación pública, migración y política de URLs pendientes.**

---

## Etapa 5 — Flujo para sugerir e ingresar lanzamientos

### Decisión final

La conversación cambió de criterio después de usar el formulario. La decisión final reemplaza la primera respuesta de “mostrar todo desde el inicio”:

1. Al entrar, solo está habilitado el enlace de fuente.
2. Se acepta exactamente un enlace de Bandcamp, Spotify o SoundCloud y se recomienda priorizar Bandcamp.
3. Al pulsar `Detectar`, aparece un spinner pequeño.
4. Después de la detección se revelan o habilitan los demás campos, llenos cuando fue posible; lo faltante queda resaltado para completarlo.
5. Si la fuente no responde, se muestra un estado como `Información no disponible` y se permite completar los datos.
6. Hay dos campos separados: `Artistas principales` y `Colaboradores`.
7. `Tipo` es una selección de los tipos existentes, no texto libre.
8. `Sello` se escribe manualmente, sin autocompletado obligatorio.
9. Portada y URL de portada no se exponen a quien propone. La detección puede adjuntar una portada para revisión; el equipo resuelve lo que falte.
10. `Nota para el equipo` nunca se llena con la descripción detectada. Su ayuda debe decir `Contexto, créditos o información adicional`.
11. Se elimina la frase `por qué debería entrar al catálogo`.
12. Se pueden guardar borradores. Perfil muestra borradores, aportes y estado (`pendiente`, `aceptado`, `rechazado`, `cambios solicitados`). No se enviarán correos de seguimiento.

### Permisos y colas

| Rol | Resultado al enviar |
| --- | --- |
| Administrador | Puede publicar directamente y administrar el catálogo. |
| Colaborador | Requiere aprobación de administrador, pero entra a una cola prioritaria separada. |
| Comunidad autenticada | Requiere aprobación de administrador y entra a la cola comunitaria. |

### Campos obligatorios que sí quedaron nombrados al final

- enlace de fuente;
- título;
- artistas principales;
- fecha de lanzamiento;
- géneros;
- países.

`Sello` y `Nota para el equipo` son opcionales. Portada no es un campo del remitente. **Tipo quedó ambiguo**: se decidió que debe ser un selector, pero no fue incluido en la enumeración final de obligatorios.

### Microcopy propuesto para la fuente

> Aceptamos enlaces de Bandcamp, Spotify y SoundCloud. Si está disponible, prioriza Bandcamp.

### Contraste con el código

El formulario actual muestra todos los campos desde el inicio, usa una sola lista de artistas, deja Tipo como texto, expone URL y carga de portada y no incluye género ni país:

```svelte
<!-- src/routes/sugerir/+page.svelte:84-98 -->
<label>Enlace de la fuente ...</label>
<div class="grid">
  <label>Título ...</label>
  <label>Artista(s) ...</label>
  <label>Tipo <input ... /></label>
  <label>Sello ...</label>
  <label>Fecha de lanzamiento ...</label>
  <label>Portada (URL HTTPS) ...</label>
</div>
<label>O sube una portada ...</label>
```

La validación solo exige enlace, título y artista; la fecha tampoco es obligatoria hoy. `createContribution()` crea un borrador técnico pero la pantalla lo envía inmediatamente y no ofrece guardar o recuperar borradores. La cola editorial actual es una sola consulta por `status = pending` ordenada por fecha.

### Estado

**Flujo y permisos decididos; implementación pendiente.** Falta una decisión puntual sobre si `Tipo` es obligatorio.

---

## Etapa 6 — Arquitectura de la ficha y comportamiento del reproductor

### Decisión tomada

- Desktop: portada completamente fija; solo la columna derecha hace scroll.
- La modal conserva un tamaño estable incluso cuando el contenido es corto. El tamaño actual es una referencia válida y puede crecer ligeramente sin cambiar la proporción de la portada.
- Móvil: portada e información forman un único recorrido vertical; la portada se desplaza con el contenido y no se convierte en encabezado sticky.
- `Comprar`, `Añadir a crate` y `Compartir` comparten una fila y forman parte del contenido desplazable; no quedan fijos.
- El menú de crates debe desplegar todas sus opciones sin quedar recortado por el overflow de la modal.
- Se conserva el embed grande de Bandcamp. La altura actual es aceptable; si no puede compactarse internamente, puede crecer lo mínimo para mostrar aproximadamente una pista adicional.
- Al elegir otra pista, el viewport debe permanecer exactamente donde ocurrió el clic. El iframe no puede desplazar la ficha.
- La aceptación se hará como mínimo en un viewport móvil y uno desktop; no se fijaron tamaños exactos.

### Contraste con el código

Actualmente `.scroll-area` envuelve ambas columnas, por lo que portada e información se desplazan juntas:

```svelte
<!-- src/lib/components/LanzamientoModal.svelte:169-188 -->
<div class="scroll-area">
  <div class="layout">
    <div class="cover-col">...</div>
    <div class="info-col">...</div>
  </div>
</div>
```

```css
/* src/lib/components/LanzamientoModal.svelte:438-455 */
.scroll-area { overflow-y: auto; }
.layout { display: grid; grid-template-columns: 1fr 440px; }
```

El iframe tiene altura dinámica de hasta 380 px y no existe restauración del scroll al interactuar con él. `LanzamientoVista.svelte` mantiene una segunda implementación de la ficha, de modo que cualquier cambio aislado en la modal puede producir divergencias.

### Histórico — decisiones que quedaban abiertas al cerrar aquella conversación

1. **Título largo en la ficha.** La primera conversación decidió tres líneas en tarjeta y título completo en ficha. En esta conversación, una pregunta explícita sobre palabras largas “en la modal” recibió la respuesta de truncar después de tres líneas. Hay que escoger una de las dos reglas.
2. **Componente compartido.** La pregunta sobre compartir estructura entre modal y página completa no se entendió. Es una decisión técnica necesaria para que créditos, fecha, reproductor y recomendaciones no diverjan.

### Estado

**Geometría cerrada; implementación pendiente; dos decisiones residuales.**

---

## Etapa 7 — Recomendaciones dentro de la ficha

### Decisión tomada

Se muestran como máximo dos recomendaciones, independientes de los filtros que estén activos debajo de la modal:

1. **Recomendación 1:** comparte género y, dentro de ese conjunto, elige la mayor cercanía de Radar.
2. **Recomendación 2:** elige por cercanía de Radar sin exigir el mismo género, para ampliar el descubrimiento.

Reglas adicionales:

- no se exige otro lanzamiento del mismo artista;
- se excluye el lanzamiento abierto;
- no se repite el mismo release;
- los empates usan aleatoriedad estable;
- cada elemento es una fila compacta con portada pequeña, título y artista;
- desktop: al final de la columna derecha, después de las acciones;
- móvil: al final de la ficha, también después de las acciones;
- al abrir una recomendación, se reemplaza el contenido de la misma modal;
- Atrás/Adelante del navegador recorre los lanzamientos abiertos dentro de esa sesión;
- cerrar la modal restaura exactamente la búsqueda, filtros y posición de scroll subyacentes;
- no se usa popularidad ni telemetría; la calidad se evalúa editorialmente contra estas dos reglas.

### Contraste con el código

No existe cálculo ni bloque de recomendaciones en `LanzamientoModal.svelte` o `LanzamientoVista.svelte`. El parámetro `modal` actual se actualiza con `replaceState`, lo cual tampoco construye por sí solo el historial de recomendaciones acordado. Véanse [`+page.svelte`](../../src/routes/+page.svelte#L30) y [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L322).

### Estado

**Decisión cerrada; implementación pendiente.**

---

## Etapa 8 — Experiencia móvil de búsqueda y filtros

### Decisión tomada

- `Buscar` vive sobre la grilla como barra sticky secundaria, independiente del header global.
- En esta etapa se propuso que el header global solo apareciera al inicio, mientras la barra de búsqueda se oculta al bajar y reaparece al subir.
- El texto se mantiene como `Buscar`; los filtros activos se indican con el badge numérico actual.
- Fuera del panel, las pills ocupan una sola fila sin scroll horizontal. Se muestran las que caben y el resto se resume como `+N`; pulsar `+N` abre el panel.
- Dentro del panel, todas las pills permanecen fijas bajo el encabezado mientras el formulario hace scroll.
- País y Género conservan el patrón actual de listas/tags desplegables.
- El Radar empieza colapsado.
- Cada cambio aplica inmediatamente; no hay botón `Ver N resultados`.
- El swipe para cerrar solo puede comenzar en el handle o encabezado superior, nunca en el contenido desplazable.

### Contraste con el código

El móvil actual usa un FAB circular fijo abajo, sin texto; las pills exteriores pueden hacer wrap, no aparecen dentro del panel y no hay gesto de swipe:

```svelte
<!-- src/routes/+page.svelte:819-870 -->
<button class="fab-mobile" aria-label="Abrir filtros de búsqueda">
  <svg><!-- lupa --></svg>
  {#if contarFiltrosActivos > 0}<span class="fab-badge">...</span>{/if}
</button>

<div class="filtros-mobile-sheet" role="dialog" aria-modal="true">
  <div class="filtros-mobile-header">...</div>
  <div class="filtros-mobile-body">
    <Filtros ... />
    <RadarFiltros ... />
  </div>
</div>
```

### Especificaciones aún necesarias

- Definir en implementación el umbral de distancia/velocidad del swipe y validarlo para que no compita con el scroll.
- Al cerrar, devolver el foco al botón `Buscar`; la conversación no respondió esta pregunta de accesibilidad. Esto debe tratarse como requisito técnico, no como preferencia visual.
- Verificar y reproducir el cambio de ancho o “salto extraño” observado durante la reunión.
- Resolver una contradicción posterior: en la etapa 11 se aprobó que el header global se oculte al bajar y reaparezca al subir “como ahora”, mientras aquí se había indicado que solo reaparecería al volver al inicio. La barra `Buscar` sigue siendo independiente en ambos casos.

### Estado

**Composición de búsqueda cerrada; comportamiento del header global, implementación y aceptación accesible pendientes.**

---

## Etapa 9 — Bienvenida sin bloquear el catálogo

### Decisión tomada

- Es un banner grande dentro de `/`, no una página separada ni una pantalla completa.
- Debe dejar visible suficiente parte de la sección siguiente para comunicar que existe una biblioteca debajo.
- Se muestra solo en la primera entrada directa al home de cada sesión de navegación.
- Puede cerrarse y permanece cerrada durante esa sesión; no se convierte en bloque pequeño reabrible.
- No aparece al llegar con filtros compartidos ni en URLs directas de artista, sello o lanzamiento.
- La grilla y `Buscar` siguen siendo accesibles en el primer viewport sin clic obligatorio.
- El objetivo principal es explorar y presentar muy brevemente la biblioteca.
- Usa una ilustración y una frase corta; el contenido esencial es el mismo en desktop y móvil.
- No se instrumentará telemetría específica; el equipo la evaluará cualitativamente con el tiempo.

### Contenido deliberadamente aplazado

Se mencionaron como dirección, no como copy final:

- `La biblioteca electrónica sudaca más grande del mundo`;
- `Bailamos y sudamos. Orgullo Sudaka`.

La ilustración y el comportamiento responsive fino también se diseñarán después.

### Contraste con el código

No hay markup de bienvenida en `/`; la ruta comienza en controles y resultados. Solo existen estilos globales `.intro` sin uso en esa página. Véanse [`+page.svelte`](../../src/routes/+page.svelte#L646) y [`styles.css`](../../src/lib/styles/styles.css#L53).

### Estado

**Patrón cerrado; copy, arte y detalle responsive abiertos; implementación pendiente.**

---

## Etapa 10 — URLs e invitaciones de beta

### Decisión tomada

- La invitación se activa mediante query params en el home, no mediante ruta ni subdominio.
- Debe existir URL genérica y URL personalizada. Conceptualmente: `/?beta=...` y un segundo parámetro de nombre.
- El nombre puede ser visible en URL, historial y logs; debe admitir espacios, tildes y caracteres no latinos.
- La invitación aparece como modal pequeña “tipo aviso de cookies”.
- Se muestra cada vez que se abre una URL beta, incluso en el mismo dispositivo, porque contiene información que puede necesitar releerse.
- Los parámetros beta y nombre solo tienen significado en el home. Cualquier navegación o interacción que cambie la URL debe eliminarlos; no se propagan a enlaces internos.
- El mecanismo es temporal y se retira después de la beta.

Ejemplos técnicos válidos, todavía sujetos a escoger los nombres finales de parámetros:

```text
/?beta=1
/?beta=1&nombre=María%20José
/?beta=1&nombre=%E6%9D%8E%E9%9B%B7
```

La codificación estándar de `URLSearchParams` resuelve espacios, tildes y Unicode; al renderizar el nombre debe usarse como texto, nunca como HTML.

### Contraste con el código

`readFiltersFromURL()` solo reconoce filtros, orden, página, Radar y modal. `actualizarURL()` reconstruye la query desde cero, por lo que hoy eliminaría cualquier `beta` o `nombre` en el siguiente cambio, pero tampoco existe lógica que los lea o muestre la invitación. Véase [`+page.svelte`](../../src/routes/+page.svelte#L53).

### Histórico — decisiones que quedaban abiertas al cerrar aquella conversación

- nombres finales y valores válidos de los parámetros;
- copy genérico y personalizado, relato de la beta y fecha de lanzamiento;
- canal de feedback: la conversación contrapuso un botón autenticado `Reportar un problema` con recibir comentarios manualmente por el canal mediante el cual se envió la invitación, sin cerrar una opción;
- si se elige un canal estructurado, qué datos solicita y quién los revisa.

### Estado

**Mecánica y privacidad aceptadas; contenido y feedback abiertos; implementación pendiente.**

---

## Etapa 11 — Jerarquía del header

### Decisión tomada

#### Persona anónima

Orden primario:

1. `Sugerir` como CTA permanente;
2. `Entrar`, siempre como último elemento primario a la derecha;
3. menú hamburguesa.

El menú contiene `Manual`, `Blog`, `Substack` e `Instagram`. Al pulsar `Sugerir` sin sesión, el producto informa que hace falta entrar o registrarse; aun así, la CTA se mantiene visible para comunicar que cualquiera puede aportar.

#### Persona autenticada

Se conserva la agrupación visible actual de Perfil, Mis crates y Salir. Los enlaces secundarios viven en el menú y siguen disponibles en el footer.

#### Comportamiento común

- En esta etapa se dijo que el header se oculta al bajar y reaparece al subir “como ahora”. Esto contradice la regla de la etapa 8, donde el header global quedaba reservado para el inicio de la página.
- En móvil, `Buscar` no forma parte de este header: usa la barra secundaria definida en la etapa 8.
- Los iconos acompañan texto; no lo sustituyen.
- No hace falta añadir un rótulo para distinguir Biblioteca de Blog: el catálogo y sus discos aportan el contexto.
- El footer conserva los enlaces secundarios; no se rediseña en esta fase.

### Contraste con el código

El header ya se oculta/reaparece, móvil ya usa hamburguesa e iconos con texto, y el footer conserva enlaces. La brecha está sobre todo en desktop: Instagram, Substack, Manual, Blog, Sugerir y cuenta/crates siguen todos en una misma fila:

```svelte
<!-- src/lib/components/Header.svelte:44-77 -->
<nav class="nav" aria-label="Principal">
  <a ...>Instagram</a>
  <a ...>Substack</a>
  <a ...>Manual</a>
  <a ...>Blog</a>
  <a ...>Sugerir</a>
  <!-- cuenta, crates y salir/entrar -->
</nav>
```

Además, en móvil `Sugerir` y `Entrar` están dentro del menú, no como acciones primarias permanentes.

### Estado

**Jerarquía cerrada; comportamiento móvil al subir todavía abierto; implementación parcial.**

---

## Histórico — decisiones que permanecían abiertas al cerrar aquella conversación

Después de esta conversación quedan trece cierres puntuales. Están convertidos en etapas independientes, con preguntas concretas, en [`decisiones-abiertas-biblioteca-2026-09-13.md`](./decisiones-abiertas-biblioteca-2026-09-13.md):

1. composición de la segunda fila superior de resultados;
2. copy del aviso de resultados aproximados;
3. presentación de un colaborador único;
4. migración/auditoría de créditos existentes;
5. estabilidad de slugs y URLs al corregir autoría;
6. obligatoriedad del campo Tipo;
7. regla de títulos largos en la ficha;
8. componente compartido entre modal y página completa;
9. comportamiento del header global al hacer scroll en móvil;
10. copy e ilustración de la bienvenida general;
11. contrato exacto de query params beta;
12. copy de la invitación beta;
13. canal de feedback de la beta.
