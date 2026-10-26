# E07 — Consola administrativa de catálogo

Fecha de actualización: 2026-09-17 (America/Bogota)  
Estado: **cerrada y verificada en local y Biblioteca Staging**

## Resultado funcional

La ruta `/admin/catalogo` reemplaza la operación diaria de Google Sheets para administradores sin exponer Dashboard ni SQL. Está detrás de `VITE_ADMIN_CATALOG_ENABLED=true`; el flag es únicamente un kill switch. La autorización efectiva permanece en las RPC de E06 mediante `private.is_admin()`.

La consola ofrece:

- tabla paginada de 25 filas, ancha y densa, con búsqueda reactiva por título, artista, sello, UUID o slug;
- filtros por estado y tipo; la calidad de créditos dejó de ser un concepto visible por decisión editorial posterior al plan original;
- título, artistas, tipo, sello, fecha de lanzamiento y edición, estado y alerta compacta de campos pendientes;
- editor desktop en un único flujo de `Edición`, dividido visualmente en Información, Créditos, Clasificación/Radar y Portada;
- pestaña separada `Historial` con actor, observación, versiones, before/after y reversión compensatoria;
- vista móvil de consulta: muestra todos los datos pero deshabilita la edición;
- estados de carga, vacío, error, éxito y conflicto de concurrencia.

## Decisiones incorporadas del rediseño

- El slug no aparece como campo editable. Al crear se deriva del título; en un release existente se conserva y solo aparece dentro de `Datos técnicos` colapsados.
- `Tipo` y `País` consumen vocabularios fijos. No existe creación arbitraria de tipo.
- `Sello` es texto con autocompletado contra entidades existentes. Un admin puede abrir una confirmación que exige nombre y razón y llama exclusivamente a `admin_create_catalog_label`; se selecciona el UUID canónico devuelto.
- Los géneros existentes se seleccionan como chips. Un admin puede crear uno mediante la misma confirmación auditada y `admin_create_catalog_genre`; se añade el UUID canónico devuelto.
- La reseña es opcional y está colapsada. `credit_quality` se preserva en el payload, pero no se muestra, filtra ni bloquea publicación.
- El enlace principal de compra/escucha está entre los datos esenciales; su proveedor se deriva de la URL. Los enlaces adicionales existentes se preservan sin inventar una gestión nueva.
- La portada se previsualiza y admite URL HTTPS manual. La extracción automática desde Bandcamp, Spotify o SoundCloud necesita un servicio seguro/auditado fuera de este componente.
- Los artistas principales y colaboradores se gestionan dentro de sus propios grupos. Se puede buscar, crear identidad con confirmación, reemplazar, mover con un botón accesible, arrastrar entre grupos y seleccionar varios con Shift/Ctrl/Cmd.
- El radar reutiliza `RadarMini` para dar feedback visual inmediato.
- `Observación del cambio` sigue siendo obligatoria: E06 exige una razón no vacía para conservar auditoría. No se presenta como metadata permanente del release.

## Contrato consumido

`src/lib/services/adminCatalog.ts` concentra las lecturas y mutaciones. Ningún componente escribe tablas.

RPC de E06:

- `admin_list_catalog_releases`
- `admin_get_catalog_release`
- `admin_get_catalog_history`
- `admin_create_catalog_release`
- `admin_update_catalog_release`
- `admin_revert_catalog_change`
- `admin_create_catalog_artist`
- `admin_create_catalog_label`
- `admin_create_catalog_genre`

Lecturas de solo consulta: `profiles` para el estado visual del rol y los vocabularios `artists`, `labels`, `genres`, `countries` y `release_types`. La lista, el detalle, el historial y toda escritura siguen detrás de RPC administrativas. La procedencia segura `{ mode, provider, url, cover_source_url }` permanece en el snapshot de solo lectura, pero no se presenta ni se edita porque el feedback editorial la retiró del flujo operativo.

Cada listado pide `release_date DESC`: E06 ordena la relación filtrada completa con desempate de UUID antes de paginar. Cada actualización envía `catalog_version`. Un `40001` recarga snapshot e historial, muestra la versión vigente y no reintenta ni sobrescribe. `42501` se presenta como denegación del servidor. Publicar, archivar y revertir usan confirmaciones distintas; la reversión envía el `result_version` exacto del change set. La comprobación cliente exige portada HTTPS y exactamente un enlace principal HTTPS con proveedor; E06 repite esa completitud de publicación en servidor.

## Autorización y auditoría

- Sin sesión, la URL directa solicita autenticación.
- Comunidad y colaborador reciben una pantalla restringida antes de cargar el catálogo.
- Ocultar controles no se usa como autorización: `tests/sql/e06-verify.sql` prueba que anon/comunidad no pueden invocar la lectura o mutación administrativa forzada.
- Cada mutación visible conserva actor, razón, before/after, operación y versiones en E06.
- El navegador no recibe secretos, service-role keys ni acceso a `private.*`.

## Valores extensibles y propuestas

La política acordada queda así:

| Valor | Política |
| --- | --- |
| Tipo | Lista canónica fija; no se crea desde la consola. |
| País | Lista fija seleccionable. |
| Artista | Admin puede crear identidad confirmada mediante E06. |
| Género | Extensible únicamente por admin mediante `admin_create_catalog_genre`, con confirmación y razón auditada. |
| Sello | Extensible únicamente por admin mediante `admin_create_catalog_label`, con confirmación y razón auditada. Comunidad y colaboradores lo proponen mediante E09 y siempre esperan aprobación admin. |

El buzón de aportes de comunidad y colaboradores no pertenece a E07. E09 debe entregar sus colas `comunidad`, `colaborador prioritario` y `ready_for_admin`; E10 puede integrarlas en una navegación administrativa común. Ninguna propuesta no administrativa puede publicarse ni crear vocabulario por sí sola.

## Pruebas ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 22/22 |
| `npx playwright test tests/browser/e07-admin-console.spec.ts --workers=1 --retries=1` | PASS, 8/8 |
| `node scripts/e07-staging-auth-smoke.mjs` | PASS: sesión admin real, URL directa, búsqueda y 1440/390 px contra Biblioteca Staging |
| `npm run build` | PASS, sin advertencias de Svelte |
| `git diff --check` | PASS |

La suite específica cubre 1440 px, ausencia de overflow de página, búsqueda reactiva y su payload de orden, 390 px en consulta, sesión ausente, roles comunidad/colaborador, borrador, edición/publicación/archivado conservando UUID y slug, validación cliente, rechazo servidor, conflicto `40001`, historial, retorno de foco con Escape, reversión con payload/versionado y altas de sello/género con confirmación, razón, foco inicial y payload RPC auditado. La fixture E06 de reapertura aporta invocación forzada, atomicidad de publicación, orden paginado y auditoría de diccionarios en servidor. La pasada autenticada real de staging confirmó admin, URL directa, búsqueda y 1440/390 px; la carrera remota de sello/género ya dejó el GO explícito de E06. No se tocó producción durante este rediseño.

La suite global con sus cuatro workers reprodujo dos veces una carrera preexistente de E04: el test de retorno de foco del modal falló al reemplazarse su enlace durante la actualización de query params. El caso pasó 3/3 aislado y toda la suite pasó con un worker. No se cambió E04 desde este alcance; queda como deuda de estabilización, no como fallo de la consola E07.

## Criterios de aceptación

| Criterio E07 | Estado |
| --- | --- |
| Operar catálogo sin Dashboard ni SQL | Cumplido localmente y en la pasada autenticada de staging. |
| Historial y reversión para cada cambio | Cumplido mediante E06. |
| Sin secretos ni elevación de privilegio cliente | Cumplido. |
| Orden cronológico global | Integrado: la RPC ordena antes de paginar; comprobado en la fixture E06 de reapertura. |
| Publicación completa validada en servidor | Integrado: UI y RPC exigen la regla acordada y la fixture comprueba atomicidad. |
| Crear sellos y géneros con la política acordada | Integrado: confirmación+razón y RPC auditadas; no hay escritura directa de tablas. |
| GO explícito de E06 y carrera remota de diccionarios | Cumplido: dos sesiones persistentes de staging en autocommit devolvieron un UUID canónico por entidad, con un `created` y un `duplicate` y auditoría conservada. |

## Relevo a E08 y QA

E08 puede usar `/admin/catalogo` para revisar y corregir principales/colaboradores conservando UUID, slug y `catalog_version`; no debe convertir este editor en heurística ni inferir créditos desde E07. E06 emitió GO explícito y E07 queda cerrada.

QA recibió evidencia de la matriz completa y de la pasada autenticada staging. Debe mantener `VITE_ADMIN_CATALOG_ENABLED` como kill switch en cualquier regresión posterior y comprobar que corregir artistas conserva `release_id`, UUID, slug y referencias de crate. Comunidad y colaboradores siguen fuera de la consola: sus aportes permanecen exclusivamente en E09/E10.

## Rollback

Apagar `VITE_ADMIN_CATALOG_ENABLED` retira la interfaz sin alterar datos ni auditoría. Para detener las capacidades servidoras se aplica el rollback documentado por E06 mediante grants/migración compensatoria, nunca borrando eventos o migraciones existentes.

No se modificaron SQL/RLS, producción, commits ni push.
