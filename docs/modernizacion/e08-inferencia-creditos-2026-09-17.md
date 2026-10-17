# E08 — Inferencia, cola y migración progresiva de créditos

Fecha: 2026-09-17 (America/Bogota)  
Estado: infraestructura y dry-run completados en Biblioteca Staging; **ningún lote editorial fue aprobado ni aplicado**.

## Contrato entregado

- `credit-inference-v1` es una función pura en `supabase/functions/_shared/credit-inference.ts`. Recibe únicamente metadata ya obtenida y artistas existentes; no hace HTTP, no crea artistas y no escribe hechos.
- Solo `high` puede entrar a un lote, y solo tras decisión explícita de admin. `high` exige fuente soportada/disponible y `structured_author` que cruce exactamente contra identidades existentes, sin señales de colaboración ni autores por pista sin resolver.
- `review` cubre señales controladas (`feat.`, `ft.`, `featuring`, `remix`, `remixed by`, `prod.`, `produced by`), contradicciones y separadores no cruzables. `manual` cubre fuente faltante/no soportada/autor estructurado ausente o no conocido. Ninguno se puede aprobar para lote; se corrige individualmente en la consola E07 y se rechaza/desecha la propuesta con nota.
- Una coma, `&`, `and` o `y` se separa solo si todos los fragmentos resuelven artistas existentes. Un nombre completo coincidente como `A&B` o `Comma, Name` permanece intacto.
- Las migraciones `20260917221953_e08_credit_inference_queue.sql` y `20260917222640_e08_allow_conflicted_application_audit.sql` mantienen propuestas, lotes, aplicaciones y eventos en `private`, con RLS, sin grants a `anon`/`authenticated` y sin policies. Las RPC públicas son admin-only mediante `private.is_admin()`.
- Aplicar llama a `admin_update_catalog_release` de E06 para cada fila. Por ello el hecho publicado tiene `catalog_change_set`, actor, razón, before/after y versión. Revertir llama a `admin_revert_catalog_change`; crea el evento compensatorio y no borra historia.

## Seguridad y ejecución de fuente

`inspect-release-source` fue desplegada como versión 3 en **Biblioteca Staging**. Mantiene JWT y añade allowlist HTTPS por proveedor, máximo dos redirects, timeout de 5 s, máximo 1 MB y lectura acotada del cuerpo. Expone `structured_author` únicamente como metadata; no publica ni infiere créditos. Producción no fue consultada ni modificada.

Los avisos de advisor de seguridad para las RPC `SECURITY DEFINER` son los esperados: su ejecución se concede solamente a `authenticated`, pero cada RPC tiene el gate `private.is_admin()`, `search_path=''`, tablas privadas sin grants y una fixture de invocación forzada. El advisor de rendimiento no tiene hallazgos.

## Dry-run real inicial (10 casos difíciles)

Selección: releases `legacy` publicados con tres o más créditos o señal de remix, priorizando señales. La fuente de importación conserva `artists` legados, pero no un autor estructurado verificable ni tracklist. No se hizo fetch editorial masivo, y por tanto la heurística devolvió `manual`, cero IDs propuestos y `structured_author_missing` en los diez casos. Este es el freno conservador requerido, no una ausencia de trabajo.

| Release ID | Título | Esperado | Propuesto | Aprobación editorial |
| --- | --- | --- | --- | --- |
| `a135f281-716c-4598-93e6-a4651954f445` | After Styles III | manual | manual | pendiente |
| `7e95d211-f5fc-4bc8-8ca2-9053341f6a24` | RE0101 - Disco de Remixes | manual | manual | pendiente |
| `a598c75a-5bae-4925-8233-b33e1a431e4d` | PERVERTGROUND REMIXES | manual | manual | pendiente |
| `4ec55b0b-b7dd-43b6-92ee-c0862eb08b5f` | After Styles | manual | manual | pendiente |
| `7d0ad55a-407b-42c7-9d36-d6d79e8a5fd1` | CLUB CULT (Remixes) | manual | manual | pendiente |
| `56733bd7-6b7b-4d43-ad1b-6b039bf9cf36` | DOLO REMIXES | manual | manual | pendiente |
| `8471bd25-66da-48eb-9de1-a0922226090a` | Ritmos Pa La Calle (Remixes) | manual | manual | pendiente |
| `b3a5740b-dd58-4897-ba01-e0d342aaa21c` | FEstados Unidosgasuga Remixes | manual | manual | pendiente |
| `e6937818-632b-4bd9-9a3f-3266ebc734d6` | Rio Cayapas + Remixes | manual | manual | pendiente |
| `4c59614d-92b0-49e3-b8f0-7f2c542648dd` | Remixes 2 | manual | manual | pendiente |

No se materializó ninguna propuesta al no haber evidencia estructurada. El siguiente lote debe partir de metadata obtenida por la Edge Function, conservar su evidencia y detenerse de nuevo si alguno de los diez casos no supera el cruce exacto.

## Conteos y evidencia para E21

| Métrica en staging | Antes | Después |
| --- | ---: | ---: |
| Releases `legacy` | 2.790 | 2.790 |
| Releases `proposed` | 0 | 0 |
| Releases `verified` | 0 | 0 |
| Propuestas persistentes | 0 | 0 |
| Lotes persistentes | 0 | 0 |
| Aplicaciones persistentes | 0 | 0 |

La fixture `tests/sql/e08-verify.sql` pasó dentro de una transacción y terminó con `ROLLBACK`. Demostró: idempotencia de encolado; cero mutaciones al encolar; denegación a anon/comunidad/colaborador; rechazo de `review`/`manual` para lote; aprobación admin; un lote con una fila aplicada y otra en conflicto sin revertir la aplicada; auditoría E06; rollback compensatorio que restaura relaciones y `credit_quality` (la versión y `updated_at` avanzan intencionalmente); y conservación del evento de reversión.

Las pruebas unitarias incluyen coautoría con `&`, nombres con `&`/coma, remixers, autores por track, fuente ausente, tres artistas sin señales y contradicción de grafía. `npm test` pasó 27/27. `deno check --config supabase/functions/inspect-release-source/deno.json` pasó antes del despliegue.

## Rollback operativo

1. Antes de una edición posterior sobre el release, un admin ejecuta `admin_revert_credit_inference_batch(batch_id, reason)`. Cada fila conserva su `catalog_change_set` original y recibe un change set compensatorio de E06.
2. Si una fila tuvo una edición posterior, queda `conflict`; no se sobreescribe. Se revisa individualmente en E07.
3. Si hay una regresión de superficie, se revocan los cinco `EXECUTE` E08 a `authenticated` con una migración compensatoria revisada. No se borran tablas, propuestas, eventos ni migraciones.
4. Para detener enriquecimiento remoto, se redepliega la versión anterior de la Edge Function en staging; no se aplica un rollback destructivo de datos.

## Relevo a E21

- Heurística: `credit-inference-v1`; la regla exacta está en el módulo compartido y cada propuesta almacena evidencia, warnings, metadata, versión y `base_catalog_version`.
- Cobertura actual: 0/2.790 `verified`; 2.790 `legacy`. Cola persistente: 0. Pendientes prioritarios: los diez IDs del dry-run y el resto de releases legacy con tres o más créditos/señales controladas.
- No existen falsos positivos conocidos porque no se publicaron hechos ni se emitieron propuestas sin autor estructurado verificable. Riesgo conocido: el import legado no guarda tracklist/autor estructurado; se necesita obtenerlo por la Edge Function y revisión editorial, no reconstruirlo de los créditos legacy.
- La corrección `20260917222640` es parte de la evidencia: conserva el `change_set` de una aplicación que luego entra en conflicto, necesario para rollback/auditoría sin pérdida de historia.
