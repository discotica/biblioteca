# Expediente E12 — estado de búsqueda, URL, sugerencias y retiro de Mes

Etapa: E12 — Estado de búsqueda, URL, sugerencias y retiro de Mes  
Estado: completa en local; sin cambios de datos, Supabase, producción ni Git remoto.

## Contrato entregado

`src/lib/domain/searchState.ts` es la única frontera entre la URL, los controles de búsqueda y `matchReleases` de E11.

| URL | estado canónico |
| --- | --- |
| `?texto=Niño&entidad={…artist slug…}` | texto libre Unicode y entidad `artist` tipada, conservados separados |
| `?pais=Colombia&genero=Reggaetón&año=2026&type=EP&radar_denso=3&p=2&modal=slug` | filtros, Radar, página y modal correspondientes |
| `?mes=08&pais=Colombia` | ignora y retira `mes`; conserva País y usa orden efectivo `match` |
| valores duplicados o inválidos | conserva el primer escalar válido, deduplica listas y serializa canónicamente |
| `?beta=1&nombre=Zoë` | no interpreta esos parámetros y los preserva verbatim para E19 |

`SearchState` contiene `text`, `genres`, `countries`, `type`, `year`, `radar`, `order`, `page` y `modal`; Mes no forma parte del tipo, del formulario, pills ni manual. El parser todavía reconoce `mes` únicamente como parámetro legado que se descarta sin fallar.

Las sugerencias de artista, sello y lanzamiento escriben `SearchEntity` serializada en `entidad`; artista/lanzamiento mantienen ID o slug y nunca se degradan a substring. Su ranking es exacto, prefijo, contiene y finalmente `localeCompare('es')`; géneros y países se ordenan sin distinguir mayúsculas o tildes.

La home consume `searchStateToCriteria()` una sola vez para E11. Back/Forward rehidrata filtros y modal; las mutaciones de criterios hacen push de historial, mientras abrir/cerrar modal hace replace. Parámetros ajenos no se pierden.

Las opciones A–Z/Z–A heredadas se retiraron: no pertenecen al contrato de orden E11/E12 y por ello no pueden quedar seleccionadas ante resultados aproximados. Los únicos valores son `match`, `radar`, `fecha-desc` y `fecha-asc`.

## Consumidores migrados

- `src/routes/+page.svelte`: sincronización URL/estado, historial, criterios E11, pills y modal.
- `src/lib/components/Filtros.svelte`: entidades tipadas, ranking de sugerencias, órdenes válidos y retiro de Mes.
- `src/routes/manual/+page.svelte`: documentación de filtros sin Mes.

## Verificación local

- `npm test` — PASS, 39 pruebas.
- `npx playwright test tests/browser/e12-search-state.spec.ts --workers=1` — PASS, 3 pruebas: deep link/mes y parámetros ajenos; sugerencia tipada con Back/Forward; limpieza y vacío.
- `npm run build` — PASS.
- `git diff --check` — PASS.

## Relevo a E13 y E19

E13 debe importar `SearchState`, `parseSearchState`, `serializeSearchState` y `searchStateToCriteria` desde `src/lib/domain/searchState.ts`; no debe reconstruir query params ni ranking. Puede consumir `SearchResult.exact`, `.approximate` y `.hasCriteria` de E11 para su composición, contador y separación visual.

E19 debe pasar los parámetros desconocidos devueltos por `parseSearchState` a `serializeSearchState`. Así podrá retirar únicamente `beta` y `nombre` con `replaceState`, de manera idempotente, sin afectar filtros, modal ni página.

Rollback: revertir únicamente los consumidores E12 y `searchState.ts` devuelve la home al flujo heredado; no existe migración ni estado remoto que revertir.
