# Expediente E06 — Servicio de mutaciones administrativas auditadas

Fecha: 2026-09-16 (America/Bogota)  
Estado: **completa y verificada en Biblioteca Staging**  
Destino: staging `hgocyrzhgohetfpzbmfs`; producción `ewntlvugbopokdrvnwvg` sin cambios.

## Resultado y contrato para E07/E08

E06 instala cinco migraciones: `20260916220554_administrative_catalog_mutations_audit.sql`, `20260916221031_audit_legacy_contribution_publications.sql`, `20260916222340_administrative_catalog_read_contract.sql`, `20260916224510_artist_canonical_normalization.sql` y `20260916224720_serialize_catalog_artist_creation.sql`.

- `public.releases.catalog_version` empieza en 1 y es el token de concurrencia obligatorio.
- La evidencia privada, fail-closed, vive en `private.catalog_change_sets` y `private.catalog_change_events`. Conserva actor, operación, entidad, razón, versión base/resultante, antes/después y timestamps. No tiene grants ni policies cliente.
- Las RPC cliente son únicamente para `authenticated`, pero todas exigen `private.is_admin()` en servidor. `anon` no tiene `EXECUTE`; comunidad y colaborador reciben `42501`, aunque llamen REST/RPC sin UI.
- Las RPC son `SECURITY DEFINER` únicamente porque necesitan escribir tablas protegidas por RLS; todas usan `search_path=''`, helpers privados sin grants y validación explícita de `auth.uid()`. No usan `user_metadata`.
- El payload no puede crear entidades de diccionario implícitamente: exige UUIDs existentes para tipo, sello, artistas, géneros y países. Exige título/slug, un principal, créditos sin duplicados entre grupos, radar entero 0–5, y URLs HTTPS con proveedor.

| RPC | Uso |
| --- | --- |
| `admin_create_catalog_release(payload, reason)` | Crea release y change set `create`. |
| `admin_update_catalog_release(id, expected_version, payload, reason, operation := 'update')` | Edita atómicamente; `operation` puede ser `update`, `publish` o `archive`. No acepta cambio de slug. |
| `admin_change_release_slug(id, expected_version, new_slug, reason)` | Excepción editorial: cambia slug, crea alias `editorial_redirect`, y rechaza colisión canónica o alias visible. |
| `admin_revert_catalog_change(change_set_id, expected_version, reason)` | Cambio compensatorio. Requiere que la versión aún sea el resultado exacto del change set; no pisa una edición posterior. |
| `admin_list_catalog_releases(query, statuses, type_ids, credit_qualities, page, page_size)` | Lista administrativa paginada (1–100), incluyendo draft/published/archived; busca por UUID, slug, título, sello o artista. |
| `admin_get_catalog_release(release_id)` | Snapshot editorial completo, versión y procedencia segura. |
| `admin_get_catalog_history(release_id)` | Historial de change sets con actor, razón, before/after, reversión y versiones. |
| `admin_create_catalog_artist(name, confirm)` | Solo admin y confirmación explícita; normaliza espacios/caso, devuelve el existente ante duplicado y audita una alta nueva. |

`review_contribution` permanece como compatibilidad hasta E09, pero un trigger E06 deja ahora un change set `create` completo cuando aprueba/publica. E09 debe reemplazar su payload plano y no eliminar ese requisito de auditoría.

Ejemplo seguro para E07 (el cliente debe conservar y reenviar `catalog_version`):

```ts
await supabase.rpc('admin_update_catalog_release', {
  p_release_id: release.id,
  p_expected_version: release.catalog_version,
  p_payload: {
    slug: release.slug, title: 'Título corregido', release_date: '2026-09-16',
    release_type_id: typeId, label_id: labelId, review: '', status: 'published',
    credit_quality: 'verified', artist_ids: [artistId], collaborator_ids: [],
    genre_ids: [], country_ids: [],
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 },
    links: [{ provider: 'bandcamp', url: 'https://example.com', is_primary: true }],
    cover_url: null
  },
  p_reason: 'Corrección editorial verificada',
  p_operation: 'update'
});
```

Tratar SQLSTATE `40001` como conflicto: recargar el snapshot y mostrar su versión; no reintentar a ciegas. Tratar `42501` como denegación de rol. E07 no debe otorgar permisos de tabla ni acceder a `private.*`.

### Extensión de lectura solicitada por E07

`admin_list_catalog_releases` devuelve `{ items, total, page, page_size }`; cada item es un snapshot editable que conserva `updated_at` y `catalog_version`. `admin_get_catalog_release` devuelve la misma forma para un UUID concreto. Las dos RPCs admiten y devuelven releases archivados y borradores únicamente tras el gate admin.

`admin_get_catalog_history` devuelve `{ release_id, items }`. Cada item contiene `change_set_id`, operación, razón, estado, versiones, fecha, reversión, actor identificado y los snapshots `before_state`/`after_state`. E07 usa el `result_version` del change set seleccionado como precondición de `admin_revert_catalog_change`; nunca deriva la versión desde el historial de forma aproximada.

La identidad de artista ahora se normaliza como NFC, espacios colapsados, minúsculas y plegado de diacríticos latinos/españoles; por ejemplo, `Beyoncé` y `Beyonce` comparten clave canónica. El índice único de expresión `artists_canonical_name_unique_idx` impide esa duplicación incluso fuera de la RPC. La RPC toma además un advisory transaction lock por esa clave: contendientes del mismo nombre se serializan, y el perdedor recibe el UUID existente (`duplicate: true`) en vez de un error de unicidad.

La procedencia es **solo lectura** durante E07: `source = { mode, provider, url, cover_source_url }`. `mode` es `imported` o `editorial`. No se exponen `source_payload`, hash ni key de importación, y el formulario no puede editar esa procedencia. Los enlaces de consumo del release siguen siendo el campo `links` ya auditado por la mutación de release; no reescriben metadatos de importación.

## Verificación y fixtures

`tests/sql/e06-verify.sql` corre en una transacción y termina con `ROLLBACK`. En staging comprobó:

- RPC y tabla de auditoría denegadas para comunidad y `anon` fuera de UI.
- create/edit generan before/after con actor y versionan 1 → 2.
- una escritura con versión vieja recibe `40001`;
- un radar inválido deja snapshot y eventos exactamente intactos (atomicidad);
- revertir un update recupera título previo, crea un evento compensatorio y marca el original `reverted`; un segundo revert falla;
- la aprobación de contribución v1 genera evidencia E06.

También pasaron `npm test` (22/22), `git diff --check`, migraciones locales/remotas coincidentes y advisor de rendimiento sin hallazgos. El advisor de seguridad no tuvo `ERROR`; conserva como `WARN` deliberado las cuatro RPC E06 y la RPC preexistente `review_contribution` por ser `SECURITY DEFINER` ejecutables por `authenticated`, mitigadas por gate admin interno probado. El WARN de leaked-password protection ya existía y queda fuera de E06.

Docker local no estaba disponible; por eso se usó staging autorizado y cada fixture se revirtió transaccionalmente. No se tocó producción, UI, consola, heurísticas de créditos, ni hubo commit/push Git.

### Estado de verificación de concurrencia

La fixture transaccional prueba la ruta de recuperación `ON CONFLICT`, la equivalencia `É06 Café Artist`/`E06 Cafe Artist` y confirma que el índice deja cero colisiones canónicas en staging. Existe además `tests/sql/e06-concurrent-artist-fixture.sql` para abrir dos transacciones simultáneas y dejar ambas en rollback.

La ejecución realmente simultánea está **pendiente**: el endpoint de gestión `supabase db query --linked` serializa una de las dos solicitudes en este entorno y no hay URL/rol de conexión directa de staging autorizado para abrir dos sesiones PostgreSQL independientes. No se declara la carrera demostrada hasta ejecutar esa fixture en dos conexiones directas autorizadas y comprobar ambas respuestas/rollback. Esta limitación no afecta la prueba del índice único ni del camino de recuperación, pero mantiene E07 parcialmente bloqueada según el gate solicitado.

## Rollback

No borrar migraciones ni eventos. Para detener el servicio, revocar `EXECUTE` de las cuatro RPC a `authenticated` (y deshabilitar una futura UI por flag). Los registros de auditoría permanecen. Para revertir un cambio editorial, usar `admin_revert_catalog_change` con la versión exacta; para una corrección de esquema, crear una migración compensatoria y validarla contra una restauración antes de aplicarla.

## Reapertura E07 — 2026-09-17

Estado: **cerrada; GO explícito emitido para E07**. La reapertura quedó verificada en Biblioteca Staging mediante dos sesiones PostgreSQL independientes y persistentes del session pooler. Producción no se consultó ni modificó.

### Estado de migración

| Destino | `20260917181154_e06_reopen_catalog_dictionary_and_ordering.sql` |
| --- | --- |
| Árbol local | presente; no hay PostgreSQL/Docker local para aplicarla o hacer lint local |
| Biblioteca Staging `hgocyrzhgohetfpzbmfs` | aplicada correctamente |
| Producción | fuera de alcance, sin cambios |

La migración no abre tablas al navegador, no añade buzón de propuestas ni altera artistas. Tipo y País permanecen vocabularios cerrados. Comunidad y colaboradores no pueden crear sellos/géneros: los sellos propuestos siguen siendo asunto de E09 y requieren aprobación de admin.

### Firmas definitivas para E07

La firma existente de lista conserva sus seis argumentos y añade dos opcionales finales:

```ts
admin_list_catalog_releases(
  p_query?, p_statuses?, p_type_ids?, p_credit_qualities?, p_page?, p_page_size?,
  p_order_key = 'release_date', // release_date | updated_at | title | slug
  p_order_direction = 'desc'    // asc | desc
)
```

El servidor ordena la relación filtrada antes de `OFFSET/LIMIT`; el desempate invariable es `id ASC`. Un valor fuera de allowlist devuelve `22023`. La respuesta sigue siendo compatible con `{ items, total, page, page_size }` y añade `{ order_key, order_direction }`.

```ts
await supabase.rpc('admin_list_catalog_releases', {
  p_query: 'dub', p_statuses: ['draft', 'published'], p_type_ids: null,
  p_credit_qualities: null, p_page: 1, p_page_size: 25,
  p_order_key: 'release_date', p_order_direction: 'desc'
});
```

`admin_update_catalog_release(..., p_operation := 'publish')` exige ahora en servidor: título, slug, fecha, tipo y sello existentes, un artista principal, un género, un país, portada HTTPS y exactamente un enlace principal HTTPS con proveedor. `review` y `credit_quality` no bloquean. La validación es anterior a las escrituras relacionales y un rechazo no genera versión/evento parcial.

```ts
await supabase.rpc('admin_create_catalog_label', {
  p_name: 'Sëllo Ejemplo', p_confirm: true, p_reason: 'Alta editorial confirmada'
});
// { label_id, name, normalized_name, created, duplicate, audit_event_id?, catalog_version: 1? }

await supabase.rpc('admin_create_catalog_genre', {
  p_name: 'Género Ejemplo', p_confirm: true, p_reason: 'Alta editorial confirmada'
});
// misma forma, usando genre_id
```

Ambas altas son admin-only, requieren confirmación y razón, normalizan NFC/espacios/caja/diacríticos, adquieren advisory lock por clave y se respaldan con índices únicos de expresión. El duplicado equivalente devuelve el UUID canónico con `created:false, duplicate:true`. Una alta registra actor, razón, before `null`, after, base `null` y resultado `1` en `private.catalog_dictionary_change_events`, que conserva RLS y cero grants cliente.

Errores relevantes: `42501` no-admin; `22023` confirmación, razón, payload u orden inválidos; `23514` publicación incompleta/más de un enlace principal; `23503` relación inexistente; `23505` integridad; `40001` conflicto de versión. E07 recarga ante `40001`; no reintenta a ciegas.

### Evidencia y fixtures

| Verificación | Resultado |
| --- | --- |
| `db push --linked --project-ref hgocyrzhgohetfpzbmfs` | PASS; aplicó solo la migración de reapertura |
| `db query --file tests/sql/e06-reopen-verify.sql` | PASS; transacción y `ROLLBACK` |
| `db query --file tests/sql/e06-verify.sql` | PASS; transacción y `ROLLBACK` |
| `npm test` | PASS, 22/22 |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| permisos de staging | PASS: INSERT en `labels`/`genres` y SELECT a la auditoría nueva son `false` para navegador |

El advisor remoto no reportó errores de esquema. El advisor de seguridad conserva WARN de `SECURITY DEFINER` ejecutable por `authenticated` para las RPC E06, incluidas las dos nuevas; es la superficie intencional de RPC y está mitigada por `private.is_admin()` en servidor, `search_path=''`, revocación desde `PUBLIC`/`anon` y las pruebas de invocación forzada. El WARN preexistente de leaked-password protection queda fuera de E06.

La fixture nueva cubre admin/comunidad/colaborador/anon y RPC forzado; crea temporalmente el perfil colaborador respaldado por `auth.users` si staging no tiene uno y lo revierte. También cubre confirmación/razón, idempotencia canónica, actor/razón/before-after/versiones, publicación incompleta atómica, publicación válida con `review=''` y `credit_quality='legacy'`, filtros+búsqueda+orden, empates y dos páginas sin duplicados/omisiones. La fixture E06 original conserva la evidencia de create/update/conflicto/reversión compensatoria e historial.

El 2026-09-17 se ejecutó `scripts/e06-verify-dictionary-concurrency.mjs` contra staging usando dos clientes `pg` separados y el session pooler persistente, en autocommit. Para sello ambos resultados devolvieron `4d39dc2d-c2ec-4a81-b2f1-b153c5b30db9`; para género, `5e69e90e-7b3f-4da8-902d-1a6862055e73`. En cada par hubo exactamente un `created:true` y un `duplicate:true`, y se comprobaron dos eventos de auditoría con el actor admin, razón, `before_state = null`, `after_state` y `result_version = 1`. La evidencia se conserva en staging; no se hizo `ROLLBACK` ni se borró auditoría. Esto satisface el gate remoto y emite el **GO explícito para E07**.
