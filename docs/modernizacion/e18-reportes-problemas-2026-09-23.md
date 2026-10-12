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
