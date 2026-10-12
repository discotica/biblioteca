# Trazabilidad del feedback de la Biblioteca Discótica

Fecha de la conversación inicial: 13 de septiembre de 2026  
Fecha indicada por la conversación de cierre: 14 de septiembre de 2026  
Fecha del contraste con el código: 13 de septiembre de 2026  
Repositorio revisado: `discotica`, commit base `0ab31e0`, incluyendo los cambios locales que estaban sin confirmar al hacer el análisis.

## Propósito y alcance

Este documento convierte la conversación informal en un registro verificable de producto. Para cada comentario distingue:

- qué problema se quiso resolver;
- qué decisión se tomó, se rechazó o quedó abierta;
- qué hace hoy el producto;
- qué archivos y fragmentos de código corresponden al tema;
- qué diferencia existe entre la decisión y la implementación.

No se modificó la implementación como parte de este análisis. La conversación de cierre se consolidó en [`resoluciones-puntos-abiertos-biblioteca-2026-09-14.md`](./resoluciones-puntos-abiertos-biblioteca-2026-09-14.md); las preguntas que aún requieren respuesta están en [`decisiones-abiertas-biblioteca-2026-09-13.md`](./decisiones-abiertas-biblioteca-2026-09-13.md).

## Cómo leer los estados

| Estado | Significado |
| --- | --- |
| **Alineado** | El código actual coincide con la decisión o con un rechazo explícito. |
| **Parcial** | Existe una base funcional, pero falta una parte visible, de comportamiento o de datos. |
| **Pendiente** | La decisión fue suficientemente clara, pero no está implementada. |
| **Abierto** | La conversación no cerró una regla que permita implementar sin tomar una nueva decisión de producto. |

## Diagnóstico general

La implementación actual ya incorporó varias ideas que aparecen en las conversaciones: el Radar calcula cercanía real; las tarjetas muestran solo el año; los filtros activos sobreviven fuera del panel; el formulario interno de sugerencias detecta Bandcamp, Spotify y SoundCloud; y el esquema canónico ya admite relaciones con rol y posición para artistas.

Las brechas principales siguen concentradas en cuatro zonas:

1. **La búsqueda ordinaria todavía filtra antes de puntuar.** Dentro de país o género usa una coincidencia `OR`; entre categorías usa `AND`; después ordena por fecha o alfabeto. Por eso no puede producir la secuencia ya acordada de exactos primero y aproximados después, con prioridad `texto > género > Radar > país > tipo > año`.
2. **El Radar actual no usa el límite acordado.** Amplía el margen de 0 a 5 para llenar una página, añade los elementos que quedaron fuera y siempre conserva similitud como orden primario. La conversación decidió probar un conjunto acotado a exacto/±1 y permitir que el orden elegido reorganice ese conjunto.
3. **La interfaz todavía trata “Ordenar por” como parte del formulario de filtros.** Paginación, contador, aviso y orden no forman la composición responsive de dos filas que ya se decidió.
4. **La ficha de lanzamiento sigue teniendo un solo scroll.** La portada no permanece fija en desktop, el iframe puede alterar la posición y no existen las dos recomendaciones acordadas.
5. **El producto ya cerró dos grupos editoriales de artistas, pero el flujo real aplana todo a `primary`.** Vista pública, contrato del cliente, importación y formulario todavía pierden la distinción entre principales y colaboradores.

Hay además una condición de arquitectura importante: el catálogo público usa Google Sheets por defecto y solo usa la vista canónica de Supabase cuando `VITE_CATALOG_SOURCE=canonical`. Por tanto, que una capacidad exista en una migración no significa que ya esté activa en producción.

```ts
// src/lib/utils/catalogoStore.ts:51-53
export type CatalogSource = 'legacy' | 'canonical';
export const catalogSource: CatalogSource =
  import.meta.env.VITE_CATALOG_SOURCE === 'canonical' ? 'canonical' : 'legacy';
```

## Inventario completo de feedback y decisiones

### A. Relevancia, filtros, orden y navegación de resultados

| ID | Feedback expresado con precisión | Decisión de la conversación | Estado actual | Correspondencia en el código |
| --- | --- | --- | --- | --- |
| F-01 | Al activar el Radar, “Más reciente” no debe aparentar ser el criterio activo ni deshacer la selección. | Activar cualquier eje selecciona `Ordenar por Radar`. El Radar forma primero un conjunto de exactos y variaciones máximas de ±1; si la persona elige después fecha u otro orden permitido, este reorganiza ese conjunto. | **Pendiente** | El Radar puntúa por distancia, pero amplía el margen hasta 5, añade todo lo que queda fuera y usa el orden convencional solo como desempate. Tampoco existe la opción visible `Ordenar por Radar`. [`+page.svelte`](../../src/routes/+page.svelte#L262), [`manual`](../../src/routes/manual/+page.svelte#L287). |
| F-02 | El selector “Ordenar por” no pertenece dentro del bloque de búsqueda. | Sacarlo del formulario y ubicarlo junto a los controles de resultados. | **Pendiente** | Sigue dentro de `Filtros.svelte`, junto a Tipo, Año y Mes. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L420). |
| F-03 | Mes introduce una granularidad poco útil y aumenta las combinaciones de filtros. | Quitar el filtro Mes. | **Pendiente** | Mes sigue en el estado, la URL, el contador de filtros, las pills y el formulario. [`+page.svelte`](../../src/routes/+page.svelte#L53), [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L397). |
| F-04 | Las barras de scroll blancas se ven desprolijas. | Usar pista transparente y thumb neutro/gris. | **Parcial** | Los dropdowns ya tienen pista transparente, pero el thumb es verde y no se aplica el estilo a la hoja móvil ni al modal. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L780). |
| F-05 | Con varios géneros o criterios, primero deben aparecer los discos que cumplen todo; después, los parciales. | Dentro de una categoría se acepta cualquiera y se premia cumplir más valores. Un exacto cumple todo el conjunto; un aproximado cumple al menos un criterio. Los exactos anteceden a los aproximados. | **Pendiente** | País y género usan `some`, pero luego se aplica `AND` entre categorías. Lo parcial se descarta en vez de puntuar. [`+page.svelte`](../../src/routes/+page.svelte#L528). |
| F-06 | La biblioteca no debe fingir que una coincidencia parcial es exacta. | Usar texto pequeño en línea, nunca una interrupción. Si solo hay aproximados, el aviso reemplaza el contador; si hay ambos grupos, un separador discreto marca la transición. El copy final sigue abierto. | **Pendiente** | El contador actual dice “No se encontraron lanzamientos” y las sugerencias aproximadas solo se calculan para texto. [`+page.svelte`](../../src/routes/+page.svelte#L589), [`+page.svelte`](../../src/routes/+page.svelte#L750). |
| F-07 | La biblioteca debería evitar una salida vacía cuando pueda ofrecer cercanía útil. | Mostrar aproximaciones si cumplen al menos un criterio elegido. Si no existe ninguna coincidencia en ningún criterio, mostrar cero resultados reales; no añadir alternativas arbitrarias. | **Pendiente** | Los filtros ordinarios eliminan cualquier fila que incumpla una categoría, aunque coincida con otra. |
| F-08 | Había que cerrar qué pesa más cuando se combinan texto, género, Radar, país, tipo y año. | Prioridad acordada: `texto > género > Radar > país > tipo > año`. Un exacto en un campo importante puede superar varias coincidencias secundarias; el puntaje no se muestra. | **Pendiente** | Solo el Radar tiene función de puntaje. El resto de los filtros devuelve booleanos. Véase la etapa 1 del documento de resoluciones. |
| F-09 | Buscar sin tildes o sin ciertos caracteres especiales debería encontrar nombres que sí los contienen. | Normalizar acentos, `ñ` y letras especiales como `ø`; el usuario no debe conocer la grafía exacta. | **Parcial** | `NFD` + eliminación de diacríticos resuelve tildes y `ñ`, pero no translitera letras como `ø`, `ł` o `ß`. La misma limitación aparece en filtros e importación. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L88), [`+page.svelte`](../../src/routes/+page.svelte#L119), [`import-catalog.mjs`](../../scripts/import-catalog.mjs#L12). |
| F-10 | Elegir un artista, sello o álbum del autocompletado debe filtrar esa entidad exacta, no cualquier texto que la contenga. | La selección de una sugerencia tipada debe conservar tipo e identidad. | **Pendiente** | País y género se guardan en su categoría; artista, sello y álbum se convierten todos en un término de `texto`, que luego usa `includes`. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L139), [`+page.svelte`](../../src/routes/+page.svelte#L457). |
| F-11 | En las sugerencias, una coincidencia directa o por prefijo debe aparecer antes que una coincidencia interna accidental. | Priorizar exacta, luego prefijo, luego contiene; solo después recurrir a coincidencias más laxas. | **Pendiente** | Las listas se ordenan alfabéticamente antes de ejecutar `includes()` y cortar los primeros resultados. Por eso `Abstract...` puede anteceder a un nombre cuyo comienzo coincide con la consulta. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L92), [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L104). |
| F-12 | Se propuso ordenar sugerencias por cantidad de lanzamientos o popularidad de búsqueda. | La propuesta fue rechazada: no se quiere instrumentar popularidad ni favorecer siempre los nombres con más catálogo. | **Alineado** | No hay telemetría de popularidad ni conteo usado para ordenar sugerencias. |
| F-13 | Los géneros deben verse en un orden alfabético coherente aunque unas entradas empiecen en mayúscula y otras en minúscula. | Orden alfabético sin sensibilidad a mayúsculas/acentos. | **Pendiente** | `generosUnicos` usa `.sort()` sin `localeCompare` ni normalización. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L56). |
| F-14 | Se consideró ocultar o deshabilitar opciones incompatibles al seleccionar otro filtro. | Se prefirió **no** limitar las combinaciones: permitirlas y responder con resultados aproximados y un aviso honesto. | **Alineado en libertad; incompleto en respuesta** | Las opciones no se reducen según otros filtros, lo cual conserva la libertad acordada. Falta el ranking aproximado y su aviso. |
| F-15 | Seleccionar muchas etiquetas no debería ensanchar horizontalmente la caja de filtro. | La selección solo debe cambiar el estado visual; el ancho debe permanecer fijo. | **Parcial** | El resumen ya usa `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` y un contador, mientras el tag cloud hace wrap. Falta una prueba de regresión móvil y protección explícita para tags individuales extraordinariamente largos. [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L760), [`Filtros.svelte`](../../src/lib/components/Filtros.svelte#L801). |
| F-16 | Paginación, orden, contador y aviso de aproximación compiten por el mismo espacio. | Paginación izquierda y orden derecha se alinean con la grilla; contador solo al final; paginación arriba/abajo; móvil separa paginación y orden. Cambiar página u orden vuelve al inicio. Quedó una contradicción: se pidieron dos filas superiores, pero la segunda quedó sin contenido. | **Parcialmente abierto; pendiente** | Hoy hay paginación centrada arriba, contador antes de la grilla y otra paginación al final. El orden permanece dentro del panel. [`+page.svelte`](../../src/routes/+page.svelte#L717), [`+page.svelte`](../../src/routes/+page.svelte#L750), [`+page.svelte`](../../src/routes/+page.svelte#L796). |

#### Fragmento clave: el filtro actual es booleano antes de ordenar

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

const resultado = radarActivo
  ? rankByRadarElastic(base, filtrosSeleccionados.radar, {
      secondaryCmp: getOrdenComparator(filtrosSeleccionados.orden)
    })
  : ordenarLanzamientos(base);
```

Consecuencia: dos géneros seleccionados significan “género A **o** género B”; género y país significan “género **y** país”; lo que no pasa ese filtro desaparece antes de que pueda recibir un puntaje aproximado.

#### Fragmento clave: el Radar sí tiene ranking de similitud

```js
// src/routes/+page.svelte:262-319
function radarScore(itemRadar, targetRadar, weights, mode = 'hybrid') {
  const a = toVec(itemRadar);
  const b = toVec(targetRadar);
  const l1 = l1NormDiff(a, b, weights);
  const c = cosineDistance(a, b);
  return 0.6 * l1 + 0.4 * c;
}

gated.sort((x, y) => {
  const primary = x.score - y.score;
  if (primary) return primary;
  const secondary = secondaryCmp ? secondaryCmp(x.item, y.item) : 0;
  if (secondary) return secondary;
  return y.date - x.date;
});
```

Esto implementa la parte central del feedback del Radar: menor distancia primero y orden convencional como desempate. La interfaz, sin embargo, sigue mostrando “Más reciente” como si fuera el criterio principal.

### B. Búsqueda y filtros en móvil

| ID | Feedback expresado con precisión | Decisión de la conversación | Estado actual | Correspondencia en el código |
| --- | --- | --- | --- | --- |
| F-17 | El botón móvil de búsqueda abajo, pequeño y solo con lupa, no se descubre con facilidad. | Crear una barra secundaria `Buscar` sobre la grilla, separada del header global. Se oculta al bajar y reaparece al subir; conserva el badge numérico. Falta decidir si el header global también reaparece al subir o solo al llegar al inicio. | **Un detalle abierto; pendiente** | En desktop existe un botón rotulado arriba, pero se oculta bajo 768 px. En móvil aparece un FAB circular fijo abajo a la izquierda, sin texto. [`+page.svelte`](../../src/routes/+page.svelte#L646), [`+page.svelte`](../../src/routes/+page.svelte#L819), [`+page.svelte`](../../src/routes/+page.svelte#L1208). |
| F-18 | La hoja de filtros debería poder cerrarse con un swipe hacia abajo. | Añadir el gesto, pero permitir que empiece solo en el handle o encabezado superior, no dentro del contenido desplazable. | **Pendiente** | La hoja tiene apertura/cierre y transición, pero no tiene handlers de pointer/touch ni umbral de arrastre. [`+page.svelte`](../../src/routes/+page.svelte#L834). |
| F-19 | Dentro de la hoja no se puede comprobar qué filtros ya están activos; fuera de ella las pills quedaban ocultas por navegación. | Fuera: una sola fila sin scroll, las pills que caben y `+N` para abrir el panel. Dentro: todas las pills fijas bajo el encabezado mientras el formulario hace scroll. | **Parcial** | Las pills se muestran fuera del panel y el FAB tiene contador, pero pueden ocupar varias líneas; no hay `+N` ni pills dentro de `.filtros-mobile-sheet`. [`+page.svelte`](../../src/routes/+page.svelte#L661), [`+page.svelte`](../../src/routes/+page.svelte#L849). |
| F-20 | El recorrido vertical de filtros en móvil es demasiado largo. | Conservar las listas/tags actuales de país y género, iniciar Radar colapsado y aplicar cada cambio inmediatamente, sin botón final. | **Parcial** | La hoja limita altura a `88vh` y hace scroll interno, pero monta el Radar abierto junto al formulario completo; no hay jerarquía colapsable específica para móvil. [`+page.svelte`](../../src/routes/+page.svelte#L1224), [`+page.svelte`](../../src/routes/+page.svelte#L1282). |

#### Fragmento clave: desktop y móvil presentan dos controles distintos

```svelte
<!-- src/routes/+page.svelte:646-658 -->
<div class="boton-buscar-contenedor">
  <button class="boton-buscar-toggle">
    {mostrarPanelFiltros ? '✖ Cerrar búsqueda' : '🔍 Buscar'}
  </button>
</div>

<!-- src/routes/+page.svelte:819-832 -->
<button class="fab-mobile" aria-label="Abrir filtros de búsqueda">
  <svg><!-- lupa --></svg>
  {#if contarFiltrosActivos > 0}
    <span class="fab-badge">{contarFiltrosActivos}</span>
  {/if}
</button>
```

```css
/* src/routes/+page.svelte:1208-1211 */
@media (max-width: 768px) {
  .boton-buscar-contenedor { display: none; }
  .fab-mobile { display: flex; }
}
```

### C. Tarjetas, modal y reproducción

| ID | Feedback expresado con precisión | Decisión de la conversación | Estado actual | Correspondencia en el código |
| --- | --- | --- | --- | --- |
| F-21 | Se preguntó si la música debía seguir sonando al cerrar la ficha. | Se rechazó el reproductor persistente: cada lanzamiento conserva su reproductor y al cerrar la ficha termina esa instancia. | **Alineado** | El reproductor vive dentro de `LanzamientoModal`; al poner `lanzamientoActivo = null` se desmonta la modal y su iframe. [`+page.svelte`](../../src/routes/+page.svelte#L37), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L291). |
| F-22 | Las tarjetas deben mostrar el año, no el mes. El detalle puede mostrar la fecha completa. | Conservar solo el año en grid. | **Alineado** | La tarjeta extrae y renderiza solo `year`. [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L32), [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L332). |
| F-23 | La ficha debería proponer otros lanzamientos sin volverse pesada, idealmente por cercanía de Radar. | Máximo dos: la primera comparte género y prioriza cercanía Radar; la segunda usa solo cercanía Radar. Excluyen actual/duplicados, ignoran filtros activos, usan desempate aleatorio estable y se muestran como filas con miniportada, título y artista al final de la ficha. | **Pendiente** | No existe cálculo ni bloque de recomendaciones en `LanzamientoModal` o `LanzamientoVista`; la navegación modal actual tampoco construye el historial acordado. |
| F-24 | El borde verde de hover se corta en las esquinas superiores de la tarjeta. La portada debe conservar esquinas rectas; solo las esquinas exteriores que correspondan deben redondearse. | Tarjeta: parte superior recta y esquinas inferiores redondeadas. Modal desktop: lado de portada recto y lado de información redondeado. | **Parcial** | La modal usa exactamente `border-radius: 0 20px 20px 0`. La tarjeta aplica radio a las cuatro esquinas y luego usa `overflow: visible` en grid, combinación que permite el artefacto descrito. [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L375), [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L562), [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L661). |
| F-25 | Una sola palabra muy larga no debe ampliar la tarjeta ni producir scroll horizontal. | Grid: máximo tres líneas, corte dentro de palabra y elipsis. Para la ficha hay contradicción: primero se decidió título completo y después tres líneas en la modal. | **Abierto para modal/ficha; pendiente en grid** | El título del grid no tiene `overflow-wrap`, `word-break` ni `line-clamp`. La modal tampoco protege palabras sin espacios. [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L721), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L615). |
| F-26 | La portada debería permanecer estable mientras se recorre información, reproductor y futuras recomendaciones. | Desktop: portada fija y solo columna derecha con scroll; modal de tamaño estable. Móvil: portada e información se desplazan juntas en un único recorrido. | **Pendiente** | `.scroll-area` envuelve las dos columnas y es el elemento que hace scroll; `info-col` no tiene overflow propio y `cover-col` no es sticky. [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L169), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L438). |
| F-27 | Tipo, país, sello, fecha y géneros necesitan mejor jerarquía y espaciado; la fecha numérica no es amable. | Usar una fecha humana, por ejemplo “5 de enero de 2026”, y afinar espaciados. | **Parcial** | La metadata ya está estructurada como `dl` con filas y estilos consistentes, pero la fecha se imprime cruda. [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L237), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L267). |
| F-28 | El widget de Bandcamp ocupa demasiado alto y al cambiar de pista puede desplazar el scroll. | Conservar el embed grande y una altura cercana a la actual; puede crecer lo mínimo para mostrar otra pista. La posición debe permanecer exactamente donde se hizo clic. | **Pendiente** | La altura se calcula hasta 380 px y el iframe comparte el scroll global del modal. No existe protección ni restauración de la posición al interactuar. [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L291). |
| F-29 | Los títulos se sienten demasiado pesados en Black. | Usar Bold, no Black. | **Parcial** | Grid usa peso `650`, compatible con la intención. Modal y vista completa usan `800`, todavía más pesados que un Bold convencional (`700`). [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L721), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L615). |

#### Fragmento clave: actualmente se desplazan portada e información juntas

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
.scroll-area {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.layout {
  display: grid;
  grid-template-columns: 1fr 440px;
}
```

### D. Créditos de artistas y modelo de datos

| ID | Feedback expresado con precisión | Decisión de la conversación | Estado actual | Correspondencia en el código |
| --- | --- | --- | --- | --- |
| F-30 | “Varios artistas” mezcla compilados, coautorías y colaboraciones/remixes. | Dos grupos editoriales: `artistas principales` y `colaboradores`; ambos admiten varios nombres y conservan orden. Todo acreditado tiene página y discografía. La comunidad autenticada puede reportar una atribución incorrecta para revisión manual. | **Decisión cerrada; implementación parcial** | Supabase ya tiene `position` y `role`, pero importación y contribuciones insertan una lista plana como `primary`; la vista pública agrega solo `primary`; el cliente expone `string[]`. Puede conservarse la relación normalizada y publicar solo los dos grupos acordados, sin arreglos JSON. [`migración canónica`](../../supabase/migrations/20260830192747_create_canonical_catalog.sql#L65), [`catalog_releases`](../../supabase/migrations/20260830192747_create_canonical_catalog.sql#L226), [`importación`](../../supabase/migrations/20260830192747_create_canonical_catalog.sql#L350), [`catalogoStore.ts`](../../src/lib/utils/catalogoStore.ts#L8). |
| F-31 | La presentación no debe ocultar la autoría principal por contar todos los créditos como equivalentes. | Tipo Compilado siempre muestra `Varios artistas`. Fuera de compilados, 1–3 principales se nombran y 4+ muestran `Varios artistas`. Con colaboradores, se conserva primero la autoría principal y los varios secundarios usan desplegable. Falta cerrar el caso visual de un único colaborador. | **Pendiente; un detalle abierto** | `manyArtists = artistas.length > 2` no consulta tipo ni roles y usa un umbral distinto. [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L75), [`LanzamientoCard.svelte`](../../src/lib/components/LanzamientoCard.svelte#L261), [`LanzamientoModal.svelte`](../../src/lib/components/LanzamientoModal.svelte#L91). |

#### Fragmento clave: el esquema ya admite más que dos columnas conceptuales

```sql
-- supabase/migrations/20260830192747_create_canonical_catalog.sql:65-72
create table public.release_artists (
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  position smallint not null check (position >= 0),
  role text not null default 'primary'
    check (role in ('primary', 'featured', 'remixer', 'other')),
  primary key (release_id, artist_id, role),
  unique (release_id, position, role)
);
```

No hace falta convertir la elección editorial de “dos campos” en dos columnas JSON. El esquema canónico tiene una base relacional correcta: puede mapear sus roles a los dos grupos visibles y conservar posición. Falta migrar/auditar créditos, exponer ambos grupos en la vista/cliente y cerrar la estabilidad de slugs cuando cambie la autoría visible.

### E. Entrada al producto, beta, formulario y navegación global

| ID | Feedback expresado con precisión | Decisión de la conversación | Estado actual | Correspondencia en el código |
| --- | --- | --- | --- | --- |
| F-32 | Entrar directamente a filtros puede ser poco acogedor, pero una portada que exija otro clic castiga a quien usa la herramienta con frecuencia. | Banner grande dentro del home, solo en la primera entrada directa de la sesión, cerrable y sin cubrir el viewport completo. Se omite con filtros compartidos y URLs internas. Ilustración + frase breve orientadas a explorar; copy y arte se decidirán después. | **Decisión funcional cerrada; contenido abierto; implementación pendiente** | La ruta `/` comienza con el botón de búsqueda, pills, paginación y resultados. Hay estilos globales `.intro` sin markup correspondiente en la ruta. [`+page.svelte`](../../src/routes/+page.svelte#L646), [`styles.css`](../../src/lib/styles/styles.css#L53). |
| F-33 | Para beta testing se quieren URLs que activen una invitación genérica y, opcionalmente, personalicen el saludo. | Query params solo en home; modal tipo cookies cada vez que se abre la URL; nombre visible y Unicode permitido; params no se propagan y la función es temporal. Siguen abiertos nombres exactos de params, copy y canal de feedback. | **Parcialmente decidido; pendiente** | No hay lectura ni componente de invitación. Los query params actuales se reservan para filtros, página, orden, Radar y modal, y se reconstruyen desde cero al interactuar. [`+page.svelte`](../../src/routes/+page.svelte#L53), [`+page.svelte`](../../src/routes/+page.svelte#L611). |
| F-34 | Sugerir un lanzamiento debe ocurrir dentro del producto y completar datos desde Bandcamp, Spotify o SoundCloud, con preferencia por Bandcamp. | Solo fuente habilitada al inicio; Detectar revela y completa; faltantes resaltados. Dos campos de artistas, Tipo como selector, sin portada, género/país obligatorios, borradores y estados en perfil. Admin publica; colaboradores y comunidad pasan por colas separadas con aprobación admin. Tipo obligatorio sigue abierto. | **Parcial; brecha amplia** | `/sugerir` detecta los tres proveedores y envía a revisión, pero muestra todo desde el inicio, usa lista plana de artistas, Tipo libre, expone portada, no captura género/país, envía el borrador inmediatamente y solo tiene una cola. [`sugerir`](../../src/routes/sugerir/+page.svelte#L20), [`inspect-release-source`](../../supabase/functions/inspect-release-source/index.ts#L9), [`contributionsStore.ts`](../../src/lib/stores/contributionsStore.ts#L30). |
| F-35 | El header hace demasiado prominentes redes y enlaces secundarios, especialmente en desktop. | Primarios: Sugerir, cuenta/Entrar y hamburguesa. El menú contiene Manual, Blog, Substack e Instagram; iconos acompañan texto. Buscar móvil es independiente. Dos respuestas contradicen si el header global reaparece en cualquier scroll ascendente o solo al inicio. | **Jerarquía cerrada; scroll móvil abierto; implementación parcial** | Ocultar/reaparecer, iconos y menú móvil ya existen. Desktop aún muestra todos los enlaces en una fila; en móvil Sugerir y Entrar también están dentro del menú en vez de ser permanentes. [`Header.svelte`](../../src/lib/components/Header.svelte#L44), [`Header.svelte`](../../src/lib/components/Header.svelte#L179). |
| F-36 | Se cuestionó el footer. | Tras revisarlo, se consideró que funciona; no se acordó rehacerlo. | **Alineado** | Conserva enlaces, claim y copyright. [`Footer.svelte`](../../src/lib/components/Footer.svelte#L1). |

#### Fragmento clave: la sugerencia interna ya es “fuente primero”

```svelte
<!-- src/routes/sugerir/+page.svelte:84-100 -->
<form on:submit|preventDefault={enviar}>
  <label>Enlace de la fuente
    <div class="source">
      <input type="url" bind:value={source_url} on:blur={detectar} />
      <button type="button" on:click={detectar}>Detectar</button>
    </div>
    <small>Bandcamp, Spotify y SoundCloud se detectan; el resto se puede completar manualmente.</small>
  </label>
  <!-- campos editables -->
  <button type="submit">Enviar a revisión</button>
</form>
```

## Decisiones cerradas que no deben reabrirse por accidente

Estas conclusiones fueron suficientemente explícitas entre las dos conversaciones:

1. Sin criterios activos, el orden inicial es `Más reciente`.
2. La prioridad de relevancia es `texto > género > Radar > país > tipo > año`.
3. Dentro de una categoría se acepta cualquiera de los valores elegidos y se premia cumplir más de uno.
4. Una aproximación debe cumplir al menos un criterio; con cero coincidencias se muestra un estado vacío real.
5. El puntaje no se muestra al público.
6. Activar Radar selecciona `Ordenar por Radar`; su conjunto se limita inicialmente a exactos/±1 y después puede reordenarse.
7. No habrá selector de pesos ni texto técnico de “desempatar por”.
8. Al limpiar el último criterio se vuelve a `Más reciente`.
9. El filtro Mes se elimina.
10. Los aproximados se anuncian con texto en línea y, si comparten lista con exactos, mediante un separador discreto.
11. Paginación izquierda y orden derecha ocupan la zona superior; el contador queda al final. En móvil, paginación y orden se separan. La cantidad final de filas superiores sigue abierta.
12. La paginación se conserva arriba y abajo; cambiar página u orden vuelve al inicio de la grilla.
13. El reproductor no persiste al cerrar una ficha.
14. Las tarjetas muestran año, no mes, y sus títulos se limitan a tres líneas.
15. Desktop usa portada fija y scroll solo en información; móvil desplaza toda la ficha.
16. Comprar, Añadir a crate y Compartir comparten fila y se desplazan con el contenido.
17. El embed grande de Bandcamp se conserva y no debe mover el viewport al cambiar de pista.
18. Las recomendaciones son exactamente dos: género + Radar y solo Radar; no dependen de los filtros activos.
19. No se exige recomendar al mismo artista ni se usa popularidad; los empates son aleatorios pero estables.
20. Los créditos se dividen en artistas principales y colaboradores, conservando orden y páginas para todos.
21. Compilado siempre muestra `Varios artistas`; fuera de compilados se nombran hasta tres principales y cuatro o más se resumen.
22. La sugerencia empieza solo con una fuente; Detectar revela y completa el resto. Se admite un único enlace y se prioriza Bandcamp.
23. Administrador puede publicar; colaborador y comunidad pasan por colas separadas con aprobación de administrador.
24. El remitente no gestiona portada. Puede guardar borradores y consultar estados en su perfil, sin correos automáticos.
25. En móvil, Buscar vive en una barra secundaria; las pills usan una fila + `+N`, Radar empieza colapsado y el swipe nace en el encabezado. El comportamiento del header global al subir sigue abierto.
26. La bienvenida general es un banner de primera entrada directa por sesión, sin bloquear la grilla.
27. La beta se activa por query params del home, reabre la invitación cada vez, admite nombre Unicode y es temporal.
28. El header prioriza Sugerir, cuenta/Entrar y menú; Manual, Blog, Substack e Instagram pasan al menú y siguen en footer.
29. El footer no necesita un rediseño prioritario.

## Rechazos explícitos

| Propuesta descartada | Motivo registrado |
| --- | --- |
| Reproductor global que continúa tras cerrar la ficha | Se prefirió que cada lanzamiento sea una sesión independiente. |
| Modal, pop-up o tarjeta grande para avisar resultados aproximados | Interrumpe la exploración y ocupa demasiado espacio. |
| Ocultar combinaciones de filtros que no den coincidencia exacta | Limita exploraciones inesperadas; se prefieren aproximaciones honestas. |
| Mes visible en las tarjetas | El año basta en grid; el detalle contiene la fecha completa. |
| Ordenar autocompletado por popularidad o volumen de catálogo | Requiere telemetría no deseada y sesga la exploración hacia los nombres dominantes. |
| Selector de pesos entre Radar y fecha | Añade complejidad que el equipo no quiere exponer. |
| Embed compacto de Bandcamp | Se prefiere conservar el widget grande y su lista de pistas. |
| Recomendación obligatoria del mismo artista | La página de artista ya permite continuar por esa discografía. |
| Más de un enlace de fuente por propuesta | Se decidió aceptar exactamente uno. |
| Pedir URL o archivo de portada a quien propone | La detección y el equipo editorial se encargan. |
| Notificaciones por correo para aportes | Los estados viven en el perfil. |
| Página de bienvenida separada o bloque reabrible | Se decidió un banner cerrable dentro del home por sesión. |

## Dependencias y riesgos de implementación

- **El ranking ya tiene semántica, pero necesita pruebas antes de reemplazar el filtro actual.** Cambiar `some` por `every` no implementa exactos + aproximados ni sus pesos.
- **Tratar exacto/±1 del Radar como hipótesis aceptada para prototipar.** Puede producir cero resultados y debe validarse con catálogo real antes de ampliar el margen silenciosamente.
- **No resolver créditos de artistas suponiendo que el primer elemento siempre es principal.** El caso de dos coautores más remixers demuestra que esa heurística destruye información.
- **No modificar solo `LanzamientoModal.svelte`.** Existe una vista completa separada, `LanzamientoVista.svelte`, que replica artistas, fecha, metadata y reproductores. Toda decisión de ficha necesita una estrategia para evitar divergencia entre ambas.
- **No asumir que Supabase ya es la fuente pública.** El valor predeterminado documentado sigue siendo `legacy`; cualquier migración de roles requiere validar el corte canónico.
- **No cambiar slugs a partir de la nueva autoría sin una política de aliases.** En canónico existen identidad y aliases; el fallback legado todavía usa el primer artista.
- **El historial de recomendaciones no debe reemplazar el estado de la búsqueda.** Cerrar la modal tiene que restaurar filtros y scroll, mientras Atrás/Adelante recorre lo abierto dentro de ella.
- **Sanear la personalización beta como texto.** `URLSearchParams` soporta Unicode, pero el nombre nunca debe interpretarse como HTML.
- **Añadir pruebas de comportamiento y accesibilidad.** Las pruebas actuales no cubren ranking, grupos exacto/aproximado, layout móvil, swipe, devolución de foco, títulos largos, historial de recomendaciones ni conservación del scroll.

## Orden recomendado para convertir este registro en trabajo

1. Cerrar obligatoriedad de Tipo, política de créditos dudosos y estabilidad de slugs.
2. Implementar y probar relevancia exacta/aproximada junto con el conjunto Radar ±1.
3. Construir la barra de resultados sobre los estados producidos por ese modelo.
4. Exponer artistas principales/colaboradores en datos y adaptar el formulario progresivo con sus colas.
5. Cerrar títulos largos y arquitectura compartida; después reestructurar scroll, reproductor y acciones de la ficha.
6. Añadir recomendaciones e historial modal sin perder el contexto de búsqueda.
7. Rediseñar filtros móviles y header con sus contenidos ya estabilizados.
8. Implementar la bienvenida cuando copy/arte estén listos.
9. Cerrar contrato, copy y feedback beta; luego implementar la capa temporal de invitación.

La resolución detallada está en [`resoluciones-puntos-abiertos-biblioteca-2026-09-14.md`](./resoluciones-puntos-abiertos-biblioteca-2026-09-14.md). Las conversaciones que todavía faltan están separadas en [`decisiones-abiertas-biblioteca-2026-09-13.md`](./decisiones-abiertas-biblioteca-2026-09-13.md).
