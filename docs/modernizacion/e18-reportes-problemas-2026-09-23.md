# E18 — Reportar un problema: relevo a E19/E21

Estado: **implementada en el árbol; pendiente de aplicar y verificar en local/staging**. No se tocó producción, no hubo commit/push ni envío automático de correo.

## Modelo y privacidad

- `public.problem_reports`: autor, categoría (`catalog_error`, `technical_bug`, `general_feedback`), descripción, URL relativa, `release_id` canónico opcional, contexto técnico validado, ruta privada opcional, estado/asignación y fechas.
- `public.problem_report_events`: historial de creación, adjunto y acciones administrativas. Las notas internas no se exponen al autor en el historial.
- Contexto permitido exclusivamente: ruta, release_id, timestamp, versión, fuente de catálogo, user-agent (máx. 512), viewport, locale y estado online. La restricción `private.valid_problem_report_context` rechaza claves no permitidas: no cookies, tokens, contraseñas, ni formularios.
- Bucket privado `problem-report-screenshots`: JPEG/PNG/WebP, máximo 5 MiB, sin upsert. La ruta es `{author_id}/{report_id}/screenshot.{ext}`. No se generan URLs públicas.

## Matriz de permisos

| Actor | Reportes | Capturas |
| --- | --- | --- |
| anon | sin grants ni policies | sin policy |
| autor | inserta y lee sólo los propios; no actualiza actor/estado | INSERT de una captura propia y SELECT únicamente cuando ya está adjunta al propio reporte |
| otro autenticado | no ve ni modifica reportes ajenos | no lee, adjunta ni lista objetos ajenos |
| admin | lee cola, cambia estado/asignación/notas con RPC | SELECT sólo de objetos vinculados a un reporte |

La clasificación usa `admin_update_problem_report`; adjuntar usa `attach_problem_report_screenshot`. Ambas son `SECURITY DEFINER` con `auth.uid()`, `private.is_admin()`, search path vacío, grants sólo a `authenticated` y parámetros validados. No se entregó una key privilegiada al navegador.

## Flujo, limpieza y flag operativo

1. Se inserta el reporte sin captura.
2. Se sube la captura una única vez y se adjunta mediante RPC.
3. Si upload/attach falla, se conserva el reporte y se informa el estado; el objeto no adjuntado aparece después de 24 h en `admin_list_orphan_problem_report_screenshots`, inventario no destructivo que administración revisa antes de cualquier eliminación operativa.

No se añadió flag de producto: E18 define un canal permanente. La disponibilidad real depende de que la migración esté aplicada; el flag editorial existente sólo controla la vista de cola dentro de `/editorial`, nunca la autorización de base de datos.

## Archivos y pruebas

- Migración: `supabase/migrations/20260923120000_e18_authenticated_problem_reports.sql`.
- Cliente/UI: `src/lib/services/problemReports.ts`, `/reportar`, Header, ficha de lanzamiento y cola `/editorial`.
- Privacidad actualizada en `src/routes/privacidad/+page.svelte`.
- Verificación SQL transaccional preparada: `tests/sql/e18-verify.sql` (anon, autor, otro usuario y admin).
- `npm test`: **47/47 PASS**.
- `npm run build`: **PASS**.
- `npx supabase start` y `migration list --local`: no ejecutables, Docker no está levantado.
- Browser Playwright: no arrancó porque falta `chromium_headless_shell`; no es una regresión detectada.

## Pendiente para E21

Con Docker disponible, ejecutar `npx supabase start`, `npx supabase db reset`, `npx supabase db advisors --local`, `npx supabase db query --file tests/sql/e18-verify.sql` y la matriz manual de screenshot MIME/tamaño/subida fallida/URL privada. En staging, confirmar primero el project ref `hgocyrzhgohetfpzbmfs`, aplicar sólo tras revisar migration list, y repetir advisors/RLS. No desplegar a producción desde E18.

## Corrección 2026-10 (S5)

E18 no estaba aplicada en ningún entorno (E21: `problem_reports` no existe en staging), así que se corrigió el archivo de la migración en lugar de añadir una nueva. Ni staging ni producción se tocaron.

| Hallazgo | Corrección |
| --- | --- |
| **B2 / H2:** la FK `release_id` apuntaba a la vista `public.catalog_releases` (`42809`) | Ahora referencia `public.releases(id)`, con `on delete set null`. |
| **B3 / H3:** el `CHECK` `problem_reports_technical_context_valid` llama a `private.valid_problem_report_context`, sin `EXECUTE` para `authenticated`; el `insert` de un autor fallaba con `permission denied for function` | `grant execute on function private.valid_problem_report_context(jsonb) to authenticated`. No se concede `USAGE` en `private`. |

**Por qué el `GRANT` y no un trigger `SECURITY DEFINER`:**

- Un `CHECK` guardado no necesita `USAGE` en el esquema; solo `EXECUTE` sobre la función. Se comprobó: `has_schema_privilege('authenticated','private','USAGE')` sigue en `false` y el insert funciona.
- La función es pura (sin acceso a tablas), `IMMUTABLE` y de derechos del invocador, y vive en `private`, que PostgREST no expone. No hay superficie nueva por la API.
- Un trigger `SECURITY DEFINER` añadiría una función privilegiada más, que el linter alojado marca (0028/0029) cuando es ejecutable, y cambiaría una restricción declarativa por código procedural. El `GRANT` no añade hallazgos.

**`tests/sql/e18-verify.sql`:** dependía de perfiles preexistentes y fallaba en una cadena limpia (`E18 requires admin and two community fixtures`). Ahora crea su admin y dos personas de comunidad dentro de la transacción (como `d2-verify.sql`) y termina con `E18 verify: OK` y `ROLLBACK`. Se corrigió además una referencia ambigua a `report_id` (variable PL/pgSQL frente a columna) que el fallo del `CHECK` ocultaba.

**Verificación** (stack local aislado `discotica-s5`, puertos 544xx, `supabase db reset` sobre las migraciones del repositorio sin parches):

- `e18-verify.sql`: **PASS**.
- Control negativo: revocando el `EXECUTE`, el test falla con `permission denied for function valid_problem_report_context`.
- `db lint --level warning`: sin errores.
- Advisors: ver "Advisors de E18" abajo.

### Advisors de E18

Con E18 en la cadena (antes se excluía) aparecen 6 hallazgos propios de su diseño, ninguno causado por esta corrección:

- 2 `WARN` `multiple_permissive_policies` en `problem_reports` y `problem_report_events` (política de autor y de admin sobre `SELECT`, el mismo patrón que `contributions`); el plan los absorbe en B8 (S6).
- 2 `INFO` `unindexed_foreign_keys`: `problem_reports.assigned_to` y `problem_report_events.actor_id`.
- 2 `INFO` `unused_index` (índices sin uso en una base sin datos).

El resto (53 `INFO` y 2 `WARN`) coincide con la línea base de D1/D2.

### Pendiente para staging

1. La migración base `20260830000000` (H7) debe marcarse como aplicada antes del `db push`; ver [`estado.md`](./estado.md), sección S5.
2. Aplicar E18 → D1 → D2 con `--project-ref hgocyrzhgohetfpzbmfs`, nunca `--linked`, y repetir `e18-verify.sql` con `db query`.
3. La matriz manual de capturas (MIME, tamaño, subida fallida, URL privada) sigue pendiente.
