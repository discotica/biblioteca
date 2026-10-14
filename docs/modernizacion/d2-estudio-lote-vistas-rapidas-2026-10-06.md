# D2 — Datos del Estudio: lote y vistas rápidas (2026-10-06)

Estado: **implementada y verificada solo en local. No está aplicada en staging ni en producción.** El bloqueo de backup de E21 sigue abierto ([`estado.md`](./estado.md)), así que no se consultó staging. No hubo commit, push ni despliegue. No se construyó interfaz.

Ejecución: Claude Opus 5.5 (`claude-opus-5-5`), esfuerzo `xhigh`. No hubo que detenerse: el lote cabe en el contrato auditado de E06 sin debilitarlo, porque no tiene camino de escritura propio. Las pruebas encontraron un defecto de concurrencia **preexistente en E06** (hallazgo H1). El lote está protegido contra él, pero la operación individual no.

**Dependencia de orden:** D2 necesita E18 aplicada (`public.problem_reports`). Si no existe, la migración se detiene al principio con `55000` y no aplica nada. E18 todavía no aplica sobre una cadena limpia (H2), así que primero hay que corregirla.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `supabase/migrations/20261006200859_d2_studio_batch_and_quick_views.sql` | La migración. SHA-256 `79d654c11248b7141964ad3179eedba384c3194798b80c789d2bec9ca572db56`. |
| `src/lib/services/adminCatalog.ts` | Tipos de señales, vistas rápidas y lote. `listCatalog({ quickView })`, `getCatalogQuickViewCounts` y `batchUpdateCatalog`. `payload()` ya no envía `signals`. |
| `tests/sql/d2-verify.sql` | Permisos, validación, todo o nada, auditoría, señales, vistas, conteos y límite. Transaccional, revierte todo. |
| `tests/sql/d2-mutations.py` | 13 defectos inyectados sobre la migración; la verificación debe detectar cada uno. No cambia la base. |
| `tests/sql/d2-concurrency.sh` | Lotes solapados, lote frente a una edición individual en curso, y la sonda de H1. Solo local. |
| `tests/sql/d2-rollback-verify.sql` | Cuerpo del rollback y su ensayo, transaccional. |

## Contrato

Todas las RPC nuevas o reemplazadas son `SECURITY DEFINER` con `search_path = ''` y exigen `private.is_admin()` dentro de la función. Tienen `EXECUTE` solo para `authenticated`, revocado de `PUBLIC` y de `anon`. Los auxiliares nuevos viven en `private`, son `SECURITY INVOKER` y no tienen `EXECUTE` para clientes. No se creó ninguna tabla ni política. `private.catalog_change_sets` gana una columna, sin grants.

### 1. Publicar o archivar en lote

```
public.admin_batch_update_catalog_releases(
  p_operation text,   -- 'publish' | 'archive'
  p_items jsonb,      -- [{ "release_id": uuid, "expected_version": int }, …], 1..50
  p_reason text       -- obligatoria; la misma para todos los change sets
) returns jsonb
```

**Misma validación y auditoría que E06.** El lote no escribe tablas directamente. Por cada elemento llama a `public.admin_update_catalog_release(id, expected_version, payload, reason, operation)`. El payload es el snapshot vigente (`private.catalog_snapshot` sin `id` ni `catalog_version`), que es exactamente lo que envía la consola de E07 al publicar o archivar. Por eso cada lanzamiento pasa por:

- el gate de admin;
- el control de versión (`40001`);
- las validaciones del payload (`22023`, `23503`, `23505`);
- la completitud para publicar (`23514`);
- un change set con actor, razón, versión base y resultante, y `before_state`/`after_state`.

Archivar no exige completitud, igual que la operación individual.

**Validación estructural (falla la llamada entera, `22023`, sin informe):**

- operación distinta de `publish`/`archive`;
- razón vacía;
- `p_items` que no es un arreglo, está vacío o tiene más de 50 elementos;
- un elemento sin `release_id` UUID en texto, o sin `expected_version` entero positivo (no se aceptan cadenas ni decimales);
- un lanzamiento repetido.

**Por elemento,** en el orden enviado:

| `result` | Cuándo | Campos extra |
| --- | --- | --- |
| `applied` | Se escribió y auditó. Solo aparece si el lote se aplicó. | `catalog_version` (nueva), `change_set_id` |
| `unchanged` | Ya estaba en el estado pedido y con la versión enviada. No se escribe ni se audita: la operación individual crearía una versión nueva sin cambio real. | `catalog_version` (la misma) |
| `rolled_back` | Era válido, pero otro elemento falló y el lote se deshizo. | — |
| `rejected` | Falló con el mismo SQLSTATE que la operación individual. | `error: { code, message }` |

Un elemento que ya está en el estado pedido pero con versión vieja es `rejected` con `40001`: la vista del cliente está desactualizada.

**Todo o nada.** Los elementos corren dentro de un bloque que, si alguno falla, se revierte completo: datos, versiones y change sets. La respuesta es `applied: false` (HTTP 200, no lanza) con el informe de todos los elementos. Un lote con un solo elemento inválido deja la base idéntica (comprobado con huella de `xmin` de cada fila tocada, ids de enlaces y portadas, y conteo de auditoría).

**Concurrencia.**

- Antes de escribir, el lote bloquea todas sus filas en orden de UUID, en una sentencia aparte (`select … order by id for update`). Así, dos lotes solapados no pueden bloquearse mutuamente (deadlock).
- Si una edición individual tiene un lanzamiento bloqueado, el lote espera a que termine y después ve la versión nueva. Ese elemento sale `40001` y el lote no se aplica.
- Ese bloqueo previo es también lo que protege al lote de H1. Sin él, la prueba de concurrencia muestra deadlocks y saltos de versión (ver Pruebas).

**Límite de 50.** El lote abre una subtransacción por elemento escrito, más una para todo el bloque. Con 50 elementos quedan 51, por debajo de las 64 que PostgreSQL guarda en caché por sesión. Pasar de 64 degrada las lecturas concurrentes de toda la base mientras el lote está abierto. Duración medida en local: 65 ms para publicar 50 y 68 ms para rechazar un lote de 50 con el último elemento inválido. El Estudio debe limitar la selección a 50 (`CATALOG_BATCH_MAX`). Partir una selección mayor en varios lotes rompe el todo o nada: si la interfaz lo hace, tiene que decirlo.

**Auditoría.** Cada change set de un lote lleva el mismo `private.catalog_change_sets.batch_id` (columna nueva, nula en las operaciones individuales, con índice parcial). `admin_get_catalog_history` devuelve `batch_id` en cada ítem. La reversión sigue siendo individual: `admin_revert_catalog_change` funciona igual sobre un cambio hecho en lote (probado).

**Ejemplos de respuesta** (capturados en el stack local):

Lote rechazado: el tercero no tiene portada.

```json
{
  "applied": false, "operation": "publish", "batch_id": null, "requested": 3,
  "applied_count": 0, "unchanged_count": 0, "rolled_back_count": 2, "rejected_count": 1,
  "items": [
    { "release_id": "947a2fdb-c059-479f-854a-4b51bfd81b9e", "expected_version": 1, "result": "rolled_back" },
    { "release_id": "fffc2ca4-4083-4f7b-ba40-ab9f195f32fc", "expected_version": 1, "result": "rolled_back" },
    { "release_id": "cf704d48-edca-4ea4-9c8b-b8c1d5ca2bad", "expected_version": 1, "result": "rejected",
      "error": { "code": "23514", "message": "Published releases require date, type, label, primary artist, genre, country, HTTPS cover, and exactly one HTTPS primary link" } }
  ]
}
```

Lote aplicado:

```json
{
  "applied": true, "operation": "publish", "batch_id": "be3f0bf3-dc39-497e-8040-103310401bae", "requested": 2,
  "applied_count": 2, "unchanged_count": 0, "rolled_back_count": 0, "rejected_count": 0,
  "items": [
    { "release_id": "947a2fdb-c059-479f-854a-4b51bfd81b9e", "expected_version": 1, "result": "applied",
      "catalog_version": 2, "change_set_id": "37d01866-7849-48e7-ae60-ca9e302c7842" },
    { "release_id": "fffc2ca4-4083-4f7b-ba40-ab9f195f32fc", "expected_version": 1, "result": "applied",
      "catalog_version": 2, "change_set_id": "cba4ce5d-e780-46f0-8e39-415550865ca1" }
  ]
}
```

`batch_id` es `null` cuando el lote no se aplicó o cuando todos los elementos salieron `unchanged`.

**Errores:**

| Código | Dónde | Significado para U15 |
| --- | --- | --- |
| `42501` | llamada | No es admin (comunidad, colaborador) o no hay sesión. |
| `22023` | llamada | Lote mal formado (ver arriba). Es un error del cliente, no del contenido. |
| `40001` | elemento | Cambió desde la última lectura. Recargar la lista y volver a seleccionar; no reintentar a ciegas. |
| `23514` | elemento | Incompleto para publicar. Las señales lo anticipan (`missing_fields`). |
| `22023` | elemento | Datos heredados que E06 ya no acepta: una portada o un enlace no HTTPS, o un enlace sin proveedor. Se corrige en el editor. |
| `P0002` | elemento | El lanzamiento no existe. |
| `23502` | elemento | No tiene fila de radar. El importador siempre la crea, así que no debería ocurrir; la operación individual falla igual. |

### 2. Señales de las vistas rápidas

Cada snapshot administrativo (`admin_list_catalog_releases`, `admin_get_catalog_release`) incluye un objeto de solo lectura:

```json
"signals": {
  "draft": true,
  "incomplete": true,
  "missing_fields": ["cover"],
  "missing_cover": true,
  "open_report_count": 0
}
```

| Señal | Criterio exacto |
| --- | --- |
| `draft` | `status = 'draft'`. |
| `incomplete` | `missing_fields` no está vacío, en cualquier estado. Incluye publicados heredados que hoy no pasarían la validación de publicación. |
| `missing_fields` | Requisitos de publicación de E06 (`20260917181154`) que el lanzamiento guardado no cumple, siempre en este orden: `release_date` (sin fecha), `release_type` (sin tipo), `label` (sin sello), `primary_artist` (ningún artista principal), `genre` (ningún género), `country` (ningún país), `cover` (la primera portada externa por fecha de alta, la misma que toma el snapshot, falta o no es HTTPS), `primary_link` (no hay un enlace principal HTTPS con proveedor). |
| `missing_cover` | `cover` está en `missing_fields`. Una portada `http://` cuenta como faltante, porque E06 no la acepta. |
| `open_report_count` | Reportes de E18 con ese `release_id` en estado `new`, `triaged` o `in_progress`. No cuenta `resolved` ni `closed`. Cuentan las tres categorías. Los reportes sin `release_id` no se asocian. |

**"Incompleto" significa "hoy no se podría publicar por falta de datos".** El criterio replica la regla de publicación de E06 tal como se evalúa sobre el payload que arma E07 (o el lote) a partir del snapshot. La prueba de paridad lo comprueba: lo que la señal marca como incompleto, la publicación individual lo rechaza, y lo que la señal da por completo, el lote lo publica. No mira ni la reseña ni `credit_quality`, que tampoco bloquean la publicación. Hay dos casos que E06 rechaza por formato y no por falta de datos, así que no cuentan como incompletos: un enlace secundario `http://` y la falta de fila de radar. El lote los informa por elemento (`22023` y `23502`).

**Filtrar.** `admin_list_catalog_releases` acepta un noveno argumento opcional, `p_quick_view`: `draft`, `incomplete`, `missing_cover` u `open_reports` (sin distinguir mayúsculas ni espacios). Se combina con búsqueda, estados, tipos y orden, y filtra antes de paginar. La respuesta añade `quick_view` (o `null`). Un valor desconocido devuelve `22023`. La firma de 8 argumentos se eliminó para que PostgREST no vea dos sobrecargas. Las llamadas que no envían `p_quick_view`, como la de E07, siguen funcionando igual (probado por SQL y por PostgREST).

**Contar.** `public.admin_catalog_quick_view_counts(p_statuses text[] default null)` devuelve el total y el conteo de cada vista. Con `p_statuses`, cuenta solo esos estados:

```json
{ "total": 3000, "draft": 300, "incomplete": 712, "missing_cover": 30, "open_reports": 15, "statuses": null }
```

**Rendimiento** (local, 3.000 lanzamientos sintéticos, página de 25):

| Consulta | Tiempo |
| --- | --- |
| Sin vista rápida | 33 ms |
| `draft` | 28 ms |
| `open_reports` | 39 ms |
| `incomplete` | 125 ms |
| `missing_cover` | 104 ms |
| `incomplete` con página de 100 | 181 ms |
| Conteos | 151 ms |

La primera versión tardaba 750 ms en `incomplete`. Envolver el criterio en otra función SQL obligaba a PostgreSQL a replanificar la función interna en cada fila, así que el `CASE` va escrito directamente en la lista. Índice nuevo: `problem_reports_open_release_idx`, parcial sobre los reportes abiertos con `release_id`. Además resuelve el aviso `unindexed_foreign_keys` de esa FK.

### 3. Cliente (`src/lib/services/adminCatalog.ts`)

```ts
import {
  listCatalog, getCatalogQuickViewCounts, batchUpdateCatalog,
  CATALOG_BATCH_MAX, CATALOG_MISSING_FIELD_LABELS, type CatalogQuickView,
} from '$lib/services/adminCatalog';

// Barra lateral: conteos de las vistas rápidas.
const counts = await getCatalogQuickViewCounts();             // { total, draft, incomplete, missing_cover, open_reports }

// Tabla filtrada por una vista rápida (se combina con los filtros de E07).
const page = await listCatalog({ query, statuses, typeIds, qualities: [], page: 1, quickView: 'incomplete' });
page.items[0].signals?.missing_fields.map((f) => CATALOG_MISSING_FIELD_LABELS[f]); // ['Sello', 'Portada']

// Lote: se envían los snapshots seleccionados tal como se leyeron (id + catalog_version).
if (selected.length > CATALOG_BATCH_MAX) return;              // la interfaz no deja pasar de 50
const r = await batchUpdateCatalog('publish', selected, observation);
if (r.applied) {
  // r.applied_count publicados, r.unchanged_count ya lo estaban; recargar lista y conteos
} else {
  // nada cambió; mostrar r.items con result 'rejected' y su error.code
  // si alguno es 40001: recargar antes de reintentar
}
```

`batchUpdateCatalog` lanza (con `code`) solo ante `42501` y `22023` de llamada. Un lote rechazado se devuelve como `applied: false`. `CatalogHistory` tiene ahora `batch_id`, para marcar en el historial los cambios hechos en lote. `payload()` quita `signals` antes de guardar, de modo que el editor no envía campos de solo lectura.

## Decisiones tomadas en D2

Son reversibles y están dentro del contrato. Se registran para que el equipo las confirme o las cambie.

1. **`unchanged` en lugar de rechazo o reescritura.** Seleccionar uno ya publicado no rompe el lote ni ensucia la auditoría con versiones sin cambio.
2. **Límite de 50,** por la caché de subtransacciones (ver arriba). Una página de 25 cabe entera, y dos también.
3. **"Incompleto" incluye publicados y archivados.** Para ver solo borradores incompletos, se combina con `p_statuses`.
4. **`batch_id` se conserva aunque se revierta D2:** es evidencia de auditoría.

## Hallazgos preexistentes (fuera de D2, requieren decisión)

| # | Gravedad | Hallazgo | Evidencia | Propuesta |
| --- | --- | --- | --- | --- |
| H1 | **Alta** | **E06 pierde actualizaciones concurrentes.** Dos `admin_update_catalog_release` con la misma versión base: la segunda espera el bloqueo, valida contra una versión vieja, se aplica y pisa a la primera sin `40001`. Además, su auditoría registra un `before_state` falso (el estado anterior a la primera edición) y un salto de versión (base 1 → resultado 3). | Sonda de `d2-concurrency.sh`, reproducida en todas las corridas. Change sets: `A 1→2`, `B 1→3`, y B con `before_state.title` = título original. | Causa: `private.catalog_snapshot` es `STABLE`, así que dentro de `select … for update` lee con la instantánea tomada antes de esperar el bloqueo. Arreglo mínimo: bloquear la fila en una sentencia previa (`perform 1 from public.releases where id = … for update`) en `admin_update_catalog_release`, y revisar el mismo patrón en `admin_change_release_slug` y `admin_revert_catalog_change` (no probados). Conviene resolverlo antes de U15, que suma ediciones concurrentes. El lote no lo sufre, pero una edición individual con versión vieja que llegue mientras corre un lote sí puede pisar lo que el lote escribió. |
| H2 | Alta (resuelto en local, S5) | E18 no aplica sobre una cadena limpia: su FK apunta a la vista `catalog_releases` (ya registrado por D1). D2 depende de E18. | `42809`. | En local se probó con la FK corregida a `public.releases(id)`, solo en la copia temporal. Corregir E18 en su propia etapa. |
| H3 | Alta (resuelto en local, S5) | **E18: un autor no puede crear reportes.** El `CHECK` llama a `private.valid_problem_report_context`, revocada a `authenticated`, así que el `insert` del autor falla con `permission denied for function valid_problem_report_context`. | `tests/sql/e18-verify.sql` falla igual con D2 y sin D2. | Corregirlo en la misma pasada que H2: dar `EXECUTE` (y `USAGE` en `private` si hiciera falta) a `authenticated` solo sobre esa función inmutable, o validar en un trigger `SECURITY DEFINER`. |
| H4 | Media | Cada escritura de E06 (individual o en lote) borra y vuelve a crear portadas y enlaces. Se pierden `release_covers.source_url`, `content_hash` y `checked_at`, `release_links.checked_at`, y cualquier portada `storage`. | Lectura de `apply_catalog_payload`. Hoy solo las aprobaciones de E09 guardan `source_url`, y nada escribe `checked_at` ni portadas `storage`. | Antes de promover portadas a Storage o de guardar resultados de `verify:media`, hacer que `apply_catalog_payload` conserve las filas que no cambian. El lote no cambia esta exposición, pero la multiplica por 50. |
| H5 | Baja | `admin_create_catalog_release` no puede crear directamente como `published`: el `insert` inicial no lleva tipo y viola `releases_published_type_required_check`. | Fixture de `d2-verify.sql`. | Crear como borrador y publicar, que es lo que hace E07. Documentar o corregir. |
| H6 | Baja | La última sección de `tests/sql/e06-verify.sql` (aprobación legada de E02) falla desde E09. | Falla igual sin D2. El resto de la suite pasa con D2. | Retirar o actualizar esa sección. |

## Pruebas

Las pruebas corrieron en un stack Supabase local aislado (CLI 2.116.0, PostgreSQL 17, `project_id` `discotica-d2`, puertos 544xx), con la cadena completa de migraciones más D1 y D2 aplicadas desde cero con `db reset`.

| Prueba | Resultado |
| --- | --- |
| `tests/sql/d2-verify.sql` | **PASS** (`D2 verify: OK`). Cubre lo siguiente. **Permisos:** `EXECUTE` (anon/PUBLIC sin él, authenticated con él, auxiliares privados cerrados). Anon, comunidad y colaborador reciben `42501` en el lote (publicar y archivar), en los conteos, en la lista con vista rápida y en el historial; no leen la auditoría; ninguna denegación cambia nada. **Validación:** 14 entradas mal formadas → `22023` sin cambios. **Todo o nada:** lotes con un incompleto (`23514`), con versión vieja (`40001`), inexistente (`P0002`), datos `http` (`22023`) y "ya publicado con versión vieja" (`40001`) dejan la huella idéntica y sin auditoría; también al archivar. **Paridad:** E06 individual rechaza lo mismo. **Lote válido:** exactamente un change set por lanzamiento cambiado, con actor, razón recortada, base 1 → 2, `draft`→`published`, el resto del estado idéntico, `batch_id` común, y ninguno para el `unchanged`. **Historial** con `batch_id`; reversión individual de un cambio del lote. **Archivar en lote** un incompleto. **Señales:** los 8 campos por separado, portada y enlace `http`, reportes abiertos y cerrados. **Vistas:** las cuatro, combinadas con búsqueda y estado, sin vista y con valor inválido. **Conteos:** con y sin estados. **Límite:** 50 aplicados y 50 deshechos con el último inválido. |
| `tests/sql/d2-mutations.py` | **13/13 detectadas.** Sin gate admin, anon con `EXECUTE`, sin todo o nada, escritura directa sin E06, portada `http` válida, reportes resueltos como abiertos, límite 100, sin `batch_id`, sin control de versión en `unchanged`, duplicados, vista rápida ignorada, incompleto sin enlace principal, informe que no marca `rolled_back`. |
| `tests/sql/d2-concurrency.sh` | **PASS en 4 corridas.** Fase 1: 24 lotes solapados con orden y operación aleatorios. Aplicados 8–11 y rechazados 13–16 por `40001`; 0 errores, 0 deadlocks, versiones que cuadran con la auditoría, sin saltos de versión, y los change sets con `batch_id` suman lo informado. Fase 2: el lote espera a la edición individual en curso, recibe `40001` y conserva la edición. |
| Control negativo de concurrencia | Sin el bloqueo ordenado y con una pausa de 50 ms por elemento, la fase 1 **falla**: 47 y 61 deadlocks (`40P01`, capturados por elemento), y en otra corrida un salto de versión (el lote heredando H1). Con el bloqueo y la misma pausa: 0 y PASS. |
| `tests/sql/d2-rollback-verify.sql` | **PASS** (`D2 rollback verify: OK`). Quita lote, conteos y auxiliares. Restaura los cuerpos exactos de E06 de la lista de 8 argumentos, el snapshot y el historial, con sus grants. Conserva `batch_id` y su índice. La lista vuelve a negar a no admin. |
| Regresión SQL con D2 | `e06-verify.sql` núcleo **PASS** (todo salvo la sección legada, H6). `e06-reopen-verify.sql` **PASS** (incluye la lista con 8 argumentos posicionales y el `22023` de orden). `d1-verify.sql` **PASS**. `e18-verify.sql` falla por H3, igual sin D2. |
| API real (supabase-js → GoTrue/PostgREST local) | **20/20 PASS.** Lista con y sin `p_quick_view` (incluida la llamada exacta de E07), `22023` por vista desconocida, conteos, snapshot con señales, `42501` para anon/comunidad/colaborador en lote y conteos, `22023` con 51 elementos, rechazo con `applied:false` y `23514` sin cambios, lote aplicado con auditoría y `batch_id`, historial. |
| `npm test` | **74/74 PASS.** |
| `npm run build` | **PASS.** |
| `npx playwright test tests/browser/e07-admin-console.spec.ts` | **8/8 PASS**: la consola de E07 sigue funcionando con el servicio ampliado. |
| `svelte-check` | Sin errores en `adminCatalog.ts`. Los dos de `src/routes/admin/catalogo/+page.svelte` (líneas 419 y 525) son preexistentes. |
| `supabase db lint --level warning` | Sin errores. |
| `git diff --check` | Limpio. |

## Advisors (local)

`npx supabase db advisors --local --type all --level info`, en la misma base antes y después de D2:

- **Antes:** 67 (4 `WARN`, 63 `INFO`, 0 `ERROR`).
- **Después:** 61 (4 `WARN`, 57 `INFO`, 0 `ERROR`).
- **Nuevos:** ninguno. Desaparecen 5 `unused_index` (índices que las pruebas usaron) y el `unindexed_foreign_keys` de `problem_reports.release_id`. Los dos índices nuevos aparecen usados en `pg_stat_user_indexes`.
- Los 4 `WARN` son preexistentes: `multiple_permissive_policies` en `contributions`, `contribution_events`, `problem_reports` y `problem_report_events`.

**Esperado en staging:** el linter alojado incluye `0029_authenticated_security_definer_function_executable`, que el CLI local no reporta. El nombre y el nivel `WARN` salen de un resumen de la página de advisors consultada el 2026-10-06, no de su texto literal: confirmarlos al revisar staging. Se esperan dos `WARN` nuevos, a aceptar como los de E06:

- `admin_batch_update_catalog_releases`. Mitigación: gate admin interno, cada elemento vuelve a pasar el gate de E06 y hay pruebas negativas por rol.
- `admin_catalog_quick_view_counts`. Mitigación: gate admin, solo devuelve conteos.

`admin_list_catalog_releases` y `admin_get_catalog_history` ya tenían ese `WARN`. Al recrearse, pueden aparecer con la firma nueva. Ninguna función nueva es ejecutable por `anon` (`0028`). Changelog de Supabase revisado del 1 de junio al 5 de octubre de 2026: nada afecta a funciones, RPC ni advisors. El cambio del 30 de octubre (las tablas nuevas de `public` dejan de exponerse solas) no afecta a D2, que no crea tablas.

## Rollback

Es una migración posterior; nunca se borra ni se edita la de D2. El cuerpo exacto está entre `>>> D2 ROLLBACK` y `<<< D2 ROLLBACK` en [`tests/sql/d2-rollback-verify.sql`](../../tests/sql/d2-rollback-verify.sql), ensayado arriba.

```bash
npx supabase migration new d2_rollback_studio_batch_and_quick_views
# pegar el bloque marcado; probar en local con db reset; revisar advisors
```

- **Sin pérdida de datos.** Los change sets hechos en lote siguen en la auditoría con su `batch_id`; solo dejan de mostrarse en el historial. Los cambios del lote no se deshacen con el rollback: para eso está `admin_revert_catalog_change`, uno por uno.
- **Orden para revertir:** primero el frontend que ya no usa D2, porque `listCatalog` envía `p_quick_view` y fallaría contra la firma de 8 argumentos; después la migración.
- **Parada rápida sin migración:** `revoke execute on function public.admin_batch_update_catalog_releases(text, jsonb, text) from authenticated;` detiene el lote y deja intactas las señales.

## Entorno local

La receta de D1 ([`d1-datos-perfil-colecciones-2026-10-06.md`](./d1-datos-perfil-colecciones-2026-10-06.md), "Entorno local") con tres diferencias:

1. **E18 se incluye.** Hasta S5 se corregía solo en la copia temporal; desde S5 (2026-10-11) el archivo del repositorio ya está corregido y la cadena construye sin parches (H2 y H3 resueltos en local).
2. **Stack aislado:** `project_id = "discotica-d2"` y puertos 544xx en el `config.toml` de la copia, para no chocar con otra sesión que use el stack de `discotica`.
3. Los scripts aceptan el contenedor: `PSQL='docker exec -i supabase_db_discotica-d2 psql -U postgres'` y `D2_DB_CONTAINER=supabase_db_discotica-d2`.

```bash
docker exec -i supabase_db_discotica-d2 psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/d2-verify.sql
D2_DB_CONTAINER=supabase_db_discotica-d2 python3 tests/sql/d2-mutations.py
PSQL='docker exec -i supabase_db_discotica-d2 psql -U postgres' bash tests/sql/d2-concurrency.sh
docker exec -i supabase_db_discotica-d2 psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/d2-rollback-verify.sql
npx supabase stop --workdir $W --no-backup
```

El stack se detuvo con `--no-backup`: no quedaron contenedores ni volúmenes.

## Pendiente para staging (cuando E21 libere el backup)

1. Backup restaurable fresco de staging `hgocyrzhgohetfpzbmfs`.
2. Corregir E18 (H2 y H3) en su etapa y aplicarla. D2 se niega a aplicarse sin ella.
3. Decidir H1. Recomendación: corregir E06 antes de abrir U15 a uso real.
4. Con `--project-ref hgocyrzhgohetfpzbmfs`, nunca `--linked`: comparar `migration list` local y remoto. Si aparece drift, detenerse.
5. Aplicar D1 y D2. Ejecutar `d2-verify.sql` (necesita un admin, un colaborador y una persona de comunidad, que crea dentro de la transacción) y los advisors; registrar los dos `WARN` esperados. `d2-concurrency.sh` y `d2-mutations.py` son solo locales: el primero borra la auditoría de sus fixtures.
6. Actualizar este documento y `estado.md`.

## Relevo a U15

- El contrato está completo para Catálogo: vistas rápidas (Borradores, Incompletos, Sin portada, Con reportes) con conteos, selección múltiple hasta 50, y publicar o archivar en lote con confirmación e informe por elemento.
- Mostrar `missing_fields` con `CATALOG_MISSING_FIELD_LABELS`, que son los mismos nombres de la consola de E07.
- Ante `applied: false`, la interfaz debe decir que no cambió nada y listar los `rejected`. Ante `40001`, recargar.
- Desplegar U15 solo después de aplicar D2 en el entorno correspondiente: hasta entonces no existen `p_quick_view` ni el lote.
