# Expediente E11 — motor puro de coincidencia y Radar

Fecha: 2026-09-18 (America/Bogota)  
Estado: completa en local; sin cambios de esquema, RLS, red, producción, commit ni push.

## Resultado

`src/lib/domain/searchMatching.ts` es la única fuente de evaluación y orden del catálogo en home. No hace I/O, no conoce Svelte y recibe exclusivamente `Release[]` E03. La ruta adapta su estado heredado y consume `matchReleases`; ya no implementa filtro, score ni elasticidad Radar en el componente.

La normalización de coincidencia es deliberadamente solo una clave interna: minúsculas, Unicode NFD, diacríticos, puntuación y espacios; añade un mapa explícito para `æ/œ/ø/ł/ß` y otras grafías. Nunca cambia el texto visible.

## Contrato entregado

```ts
matchReleases(releases: readonly Release[], criteria?: SearchCriteria): SearchResult
evaluateReleaseMatch(release: Release, criteria?: SearchCriteria): ReleaseMatch
normalizeSearchText(value: unknown): string
```

`SearchCriteria` acepta texto libre o `SearchEntity` tipada (`artist`, `label`, `release`), género, país, tipo, año, Radar y orden. Una entidad de artista/release coincide exclusivamente por `id` o `slug`; no se convierte a substring. E12 debe conservar esa forma al serializar sus sugerencias. Para sello, E03 aún no expone identidad de sello; el contrato temporal exige igualdad normalizada de nombre y E12 no debe fingir un ID que no existe.

`ReleaseMatch` entrega `eligible`, `group` (`exact | approximate | null`), categorías con fracción/cobertura, `relevanceVector` en orden inmutable `[texto, género, Radar, país, tipo, año]`, `radarDistance` y `reasons` para test/debug. No expone un score público.

## Reglas de orden

1. Sin criterios: todos, fecha descendente e identidad estable.
2. Un exacto cumple completamente cada categoría activa. Un aproximado cumple alguna; varias selecciones en género/país exigen todas para ser exactas y su fracción ordena dentro de la categoría.
3. Los grupos son invariables: exactos antes de aproximados.
4. `match`: vector lexicográfico, fecha descendente, `release.id ?? release.slug`.
5. `fecha-desc`/`fecha-asc`: grupo, fecha, identidad.
6. `radar`: grupo, distancia, vector, fecha descendente, identidad.
7. Radar con ejes activos es una compuerta: cada eje debe estar a diferencia máxima de 1. ±1 es aproximado; ±2 queda excluido; no se rellena la muestra ampliando el margen.

`month` es un parámetro de compatibilidad temporal para el estado de UI existente; E12 debe retirarlo según su propia etapa. No añade una posición a la prioridad lexicográfica.

## Fixtures y evidencia

`tests/search-matching.test.mjs` cubre Unicode/acentos/puntuación, entidades tipadas y alias por slug, exacto/prefijo/contiene, Julio Victoria + reggaetón, fracciones de género, prioridad lexicográfica, Radar exacto/±1/±2/vacío, grupos, empates, cero resultados y ausencia de criterios.

- `npm test`: PASS, 35/35.
- `npm run build`: PASS.
- `VITE_CATALOG_SOURCE=canonical npx playwright test tests/browser/catalogo.spec.ts --workers=1`: PASS, 17/17; home limpio muestra el catálogo y modal/rutas/aliases permanecen operativos.
- Suite browser completa canónica: 33 PASS, 1 omitida por flag legado y 1 fallo preexistente fuera de E11 en `e01-staging-canonical.spec.ts` (espera el encabezado histórico `Cola editorial`, que E10 ya sustituyó).

## Relevo a E12 y E17

E12 debe construir `SearchState`/parser/serializer encima de `SearchCriteria`, persistir `SearchEntity` para sugerencias y llamar una vez a `matchReleases`. Puede usar `SearchResult.exact`, `.approximate` y `.hasCriteria` para su UI; no debe duplicar ranking. El ejemplo mínimo es:

```ts
const result = matchReleases(releases, { text: state.text, genres: state.genres, countries: state.countries, type: state.type, year: state.year, radar: state.radar, order: state.order });
const visible = result.matches.map(({ release }) => release);
```

E17 recibe `evaluateReleaseMatch` y `RADAR_AXES`: para recomendaciones puede calcular la distancia pura de un candidato con `criteria: { radar: current.radar }`, pero no debe usar el resultado elegible como filtro porque sus reglas de recomendación no tienen la compuerta de búsqueda. Debe aplicar sus propias exclusiones y empate pseudoaleatorio estable definidos por E17.

## Rollback

Revertir el import/llamada de `matchReleases` en home y retirar el archivo/prueba E11 restaura el comportamiento local previo. No hay datos ni estado remoto que revertir.
