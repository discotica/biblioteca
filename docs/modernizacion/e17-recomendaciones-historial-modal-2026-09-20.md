# Expediente E17 — Recomendaciones y sesión de historial modal

Fecha de ejecución: 2026-09-20 (America/Bogota)  
Estado: **completa en local; lista para revisión/aceptación y relevo a E21**  
Dependencias: E11 y E16 aceptadas operativamente por la orden explícita de iniciar E17. El expediente E16 aún conserva el texto histórico “lista para revisión/aceptación”; esta discrepancia documental no cambió el gate comunicado por el usuario.

## Resultado funcional

- La ficha muestra entre cero y dos filas compactas al final del contenido compartido E16: miniportada, título y artista.
- La ruta completa y la modal usan `ReleaseRecommendations` dentro del slot `recommendations` de `ReleaseDetail`; no existe una segunda ficha editorial.
- La selección vive en `recommendReleases`, es pura e ignora por completo filtros y orden activos.
- El slot 1 exige al menos un género compartido y minimiza distancia Radar. El slot 2 minimiza distancia Radar entre los restantes sin exigir género.
- La distancia se obtiene exclusivamente de `evaluateReleaseMatch` E11. E17 lee `radarDistance`, pero deliberadamente no usa la compuerta de elegibilidad de búsqueda.
- Se excluyen el release actual y duplicados por `release_id`; para filas TSV anteriores a identidad canónica se usa el slug como compatibilidad.
- Los empates usan un hash FNV-1a estable de `release_id actual + slot + release_id candidato`; no existe `Math.random()` en render.
- Si el catálogo no alcanza, se devuelve uno o ninguno. Un release sin géneros no fabrica slot 1 y un release sin ejes Radar activos conserva distancia `null` y usa únicamente el desempate estable.
- En página completa cada fila navega a `/lanzamiento/[slug]` y Back usa el historial normal del navegador.
- En modal cada recomendación añade una entrada con `modal=[slug]`; el overlay permanece montado, el contenido se sustituye y el foco pasa al encabezado nuevo.

## Máquina de estados entregada a E21

La máquina pura vive en `src/lib/domain/modalHistory.ts`. Cada entrada modal serializa bajo `page.state.__discotecaModalSession`:

```text
version, sessionId, origin, baseHref, baseSearchState,
baseScroll{x,y}, depth, slug
```

| Estado | Evento | Transición/efecto |
| --- | --- | --- |
| `idle` | abrir tarjeta desde resultados | `open/catalog`, profundidad 1; snapshot inmutable de URL base, `SearchState`, scroll y disparador; `pushState modal=A` |
| `idle` | cargar `/?…&modal=A` sin marker local | `open/direct`, profundidad 0; deriva la base eliminando solo `modal` y marca la entrada directa con `replaceState` de SvelteKit |
| `open` | abrir recomendación | `pushModalRelease`; profundidad +1; `pushState modal=B`; conserva base y disparador originales |
| `open` | Back/Forward a una entrada marcada | `restoreModalSession`; restaura `depth` y slug desde `$page.state`, resuelve la ficha correspondiente y enfoca su encabezado |
| `open/catalog` | cerrar en profundidad N | `history.go(-N)` hasta la entrada base real |
| `open/direct` profundidad 0 | cerrar | reemplaza la entrada directa por `baseHref`; elimina solo `modal` |
| `open/direct` profundidad N | cerrar | vuelve N entradas hasta la directa y después la reemplaza por `baseHref` |
| `open` | llegar a URL base por Back/cierre | `base`; desmonta modal y restaura scroll; el marker de entradas forward permite reabrir con Forward |

Invariantes comprobados:

1. URL `modal`, `data-release-slug`, título visible y marker de historial representan siempre el mismo release después de layout estable.
2. Solo las entradas de recomendación incrementan profundidad; Back restaura la profundidad visitada antes de calcular el salto de cierre.
3. La base nunca incorpora slugs de la cadena y no pierde filtros, `SearchState` ni parámetros desconocidos.
4. Cerrar desde catálogo vuelve a la entrada base; cerrar una apertura directa no consume una entrada anterior ajena.
5. La modal no se remonta al cambiar release. Así el overlay no desbloquea el documento ni restaura foco/scroll entre A, B y C.
6. Una recarga conserva el marker serializado y puede cerrar a la base con el scroll guardado aun cuando ya no exista un `HTMLElement` de disparador.
7. Al cierre normal `dialogOverlay` enfoca el disparador original si sigue conectado. Al sustituir contenido, `LanzamientoModal` enfoca el `h2` con `preventScroll`.

## Escalamiento xhigh y corrección del invariante

La primera prueba de navegador reprodujo el caso prohibido: la URL avanzaba a `modal=e17-b`/`e17-c`, pero la ficha seguía mostrando A. E17 se detuvo y el caso se cerró en el chat Sol xhigh `/root/e17_history_escalation` antes de continuar.

Causa: el sincronizador observaba solo `searchParams`; en navegación superficial SvelteKit podía publicar primero la URL y después `page.state`, dejando el marker/depth fuera de la reacción. La corrección usa el `page.state` reactivo como fuente del marker, actualiza estados con `replaceState` de `$app/navigation` y conserva el `depth` de la entrada realmente visitada. La misma revisión añadió un guard nulo en `ReleasePlayer`: el componente compartido permanece montado aunque el release no tenga provider y, en ese caso, no instala observadores/listeners sobre un wrapper inexistente.

## Fixtures y cobertura

`tests/release-recommendations.test.mjs` cubre:

- slot 1 por género + distancia y slot 2 por distancia global;
- exclusión de actual y duplicados por identidad;
- desempate estable independiente del orden de entrada;
- cero y una recomendación, release sin Radar y sin género;
- máquina catálogo A → B → C, reconstrucción desde marker y plan de cierre;
- sesión directa en profundidad cero y con cadena.

`tests/browser/e17-recommendations-history.spec.ts` usa Alpha/Beta/Gamma con distancias y géneros controlados y cubre:

- exactitud visual de los dos slots;
- apertura directa y desde resultados filtrados;
- ruta completa y Back normal;
- A → B → C, Back → B → A y Forward → B → C;
- Back desde A cierra sobre la base y Forward reabre A dentro de la misma sesión;
- cierre desde C y cierre después de volver a B;
- recarga en C;
- preservación de filtros y parámetro desconocido `beta`;
- foco en encabezado al reemplazar, foco en disparador al cerrar;
- restauración de scroll con tolerancia máxima de 1 px;
- catálogo insuficiente sin relleno;
- ausencia de excepciones de página.

## Evidencia de pruebas

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 47/47; incluye 5 casos puros E17 |
| `VITE_CATALOG_SOURCE=canonical PLAYWRIGHT_PORT=4233 npx playwright test tests/browser/e17-recommendations-history.spec.ts --workers=1 --repeat-each=3 --reporter=line` | PASS, 21/21 |
| Corrida xhigh equivalente sin repetición, antes del caso adicional base↔A | PASS, 6/6 |
| Corrida xhigh E17 repetida tres veces, antes del caso adicional base↔A | PASS, 18/18 |
| Corrida xhigh completa `tests/browser/e16-release-detail.spec.ts` | PASS, 14/14 |
| `VITE_CATALOG_SOURCE=canonical PLAYWRIGHT_PORT=4231 npx playwright test tests/browser/e16-release-detail.spec.ts --grep 'menú de crates' --workers=1 --repeat-each=3 --reporter=line` | PASS, 3/3 aislado |
| Rerun xhigh de dos regresiones E16 en puerto 4228 | PASS, 2/2 aislado |
| `npm run build` | PASS, adapter-static |
| `git diff --check` | PASS |

Registro de infraestructura/prueba: una corrida concurrente de dos casos E16 junto con `npm run build` fue abortada porque el build retiró artefactos usados por el dev server; el rerun aislado 4228 pasó 2/2. En dos corridas completas locales posteriores E16 obtuvo 13/14 por la carrera ya aislada del portal de crates (el menú se hizo visible antes de que el assert observara su padre portal); el mismo caso pasó 3/3 aislado y la corrida completa xhigh previa pasó 14/14. No se cambió E16 para perseguir una carrera fuera del alcance de E17.

## Archivos de E17

- `src/lib/domain/releaseRecommendations.ts`
- `src/lib/domain/modalHistory.ts`
- `src/lib/components/ReleaseRecommendations.svelte`
- `src/lib/components/LanzamientoModal.svelte`
- `src/lib/components/LanzamientoVista.svelte`
- `src/lib/components/ReleaseDetail.svelte`
- `src/lib/components/ReleasePlayer.svelte` (guard de mount requerido por la sustitución E17)
- `src/routes/+page.svelte`
- `src/routes/lanzamiento/[slug]/+page.svelte`
- `tests/release-recommendations.test.mjs`
- `tests/browser/e17-recommendations-history.spec.ts`
- `package.json`
- este expediente

No se añadieron migraciones, flags ni variables; no se tocaron datos, Supabase, producción ni el algoritmo E11.

## Rollback

No hay estado remoto que revertir. Retirar el componente y la función de recomendaciones, devolver ambos wrappers al slot vacío y restaurar el manejo anterior de `modal` en home elimina E17. También se retiran sus dos suites y la entrada del test unitario en `package.json`. No borrar ni alterar E11/E16 al hacer rollback.

## Relevo a E21

1. Repetir la matriz browser E17 con catálogo canónico y dispositivos objetivo; inspeccionar que la URL, el slug visible y `page.state.__discotecaModalSession.depth` avancen juntos.
2. Repetir el clic real en iframes remotos que E16 ya deja pendiente; el guard nulo E17 solo evita instalar listeners cuando no existe player y no cambia la estrategia cross-origin.
3. Validar editorialmente la calidad de los pares de recomendaciones con catálogo real. Las reglas son deterministas, no populares ni personalizadas.
4. Confirmar manualmente scroll ±1 px y retorno de foco con mouse, teclado y navegación Back/Forward móvil/desktop.
5. Mantener separados los dos hallazgos de infraestructura: no ejecutar build mientras Playwright depende del dev server y, si reaparece la carrera del portal de crates, aislarla como deuda E16 en vez de atribuirla al historial E17.
