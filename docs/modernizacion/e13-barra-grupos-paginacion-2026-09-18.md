# Expediente E13 — barra, grupos, contador, orden y paginación

Etapa: E13 — Barra, grupos, contador, orden y paginación  
Estado: completa en local; sin cambios de datos, Supabase, producción ni Git remoto.

## Comportamiento entregado

La home recibe una sola evaluación de `matchReleases(searchStateToCriteria(searchState))`. La UI compone sus tarjetas a partir de `SearchResult.matches`, `SearchResult.exact` y `SearchResult.approximate`; no vuelve a aplicar matching, ranking ni la compuerta Radar.

- Desktop muestra en la barra superior la paginación a la izquierda y `Ordenar por` a la derecha. En móvil se apilan como filas independientes y los controles conservan área táctil de 44 px.
- `Filtros.svelte` ya no contiene el selector de orden. La barra ofrece únicamente los órdenes válidos: fechas sin criterios, `Mejor coincidencia` más fechas con criterios, y además `Radar` cuando Radar está activo.
- Los exactos siempre preceden a los aproximados. La secuencia completa se pagina antes de renderizar: la transición dentro de una página usa `Resultados aproximados`; si una página empieza con aproximados tras exactos de una página anterior, el mismo rótulo queda al inicio.
- Si solo hay aproximados se muestra `No encontramos resultados exactos, pero aquí tienes los más cercanos.` como segunda fila de contexto y se omite el contador visible. La mezcla y los exactos usan el contador final. El vacío real es `No encontramos lanzamientos con estos filtros.`
- Hay paginación superior e inferior. Página u orden se escriben mediante `SearchState` y `serializeSearchState`, conservando filtros y parámetros desconocidos. Tras el DOM actualizado se desplaza al inicio de la grilla; usa movimiento instantáneo con `prefers-reduced-motion`.
- La región `aria-live` anuncia cantidad/grupo sin leer tarjetas. Carga y fallo de catálogo son estados distintos; el fallo no se presenta como búsqueda vacía.

## Componentes reutilizables

- `src/lib/components/Pagination.svelte`: navegación accesible reutilizable; props `page`, `totalPages`, `label`; evento `change` con el número de página.
- `src/lib/components/SearchResultsBar.svelte`: barra con orden y paginación superior; props `page`, `totalPages`, `order`, `orders`, `approximateNotice`; eventos `page` y `order`.

## Verificación local

- `npx playwright test tests/browser/e13-results-composition.spec.ts --workers=1` — PASS, 6 pruebas: mezcla y corte de página, solo aproximados, orden/URL, teclado/foco/scroll/reduced motion, vacío/error/carga y móvil.
- `npx playwright test tests/browser/e13-results-composition.spec.ts tests/browser/e12-search-state.spec.ts --workers=1` — PASS, 9 pruebas.
- `npm test` — PASS, 39 pruebas.
- `npm run build` — PASS.
- `git diff --check` — PASS.

## Relevo a E15, E19 y E20

E15 puede colocar su barra y hoja móvil alrededor de `SearchResultsBar` sin crear estado de orden/página móvil: debe recibir y mutar únicamente el `SearchState` de E12. No debe mover el selector de orden nuevamente a `Filtros.svelte`.

E19 debe conservar la regla de E12: pasar los parámetros desconocidos a `serializeSearchState`; la barra no elimina `beta` ni `nombre`. La invitación no debe alterar los grupos ni el contador de E13.

E20 puede coexistir con la barra de resultados, pero no debe aparecer para URLs con filtros compartidos. La barra no controla sesión ni bienvenida.

Restricciones: no modificar `searchState.ts` ni `searchMatching.ts` para necesidades visuales; no implementar hoja móvil, header, beta, DB ni producción dentro de consumidores de esta UI. Si una futura URL no hidrata o conserva filtros, devolver el caso a E12; si los grupos/ranking son incorrectos, devolverlo a E11.

Rollback: retirar `Pagination.svelte`, `SearchResultsBar.svelte` y la composición E13 de `src/routes/+page.svelte`; no hay migraciones ni estado remoto que revertir.
