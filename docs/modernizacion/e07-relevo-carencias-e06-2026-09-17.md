# E07 → E06 — carencias reveladas por el rediseño operativo

Fecha: 2026-09-17 (America/Bogota)  
Ejecutor requerido por el plan: chat nuevo con `gpt-5.6-sol`, esfuerzo `xhigh`  
Alcance de este documento: contrato solicitado; E07 no modifica SQL/RLS ni inventa RPC.

## Motivo del retorno

El rediseño de la consola hizo visibles cuatro necesidades que no pueden resolverse correctamente sólo en UI. Ordenar una página ya paginada, confiar únicamente en validación cliente o escribir diccionarios desde componentes rompería el contrato de E06.

## Cambios de contrato solicitados

1. **Orden global antes de paginar.** Extender `admin_list_catalog_releases` con claves/direcciones allowlisted y default `release_date DESC` para la operación cronológica pedida. La búsqueda puede conservar su criterio explícito, pero nunca ordenar sólo los 25 resultados recibidos.
2. **Completitud de publicación en servidor.** `operation='publish'` debe exigir título/slug, fecha, tipo, sello, al menos un principal, al menos un género, al menos un país, portada HTTPS y un enlace principal HTTPS. `review` y `credit_quality` no bloquean publicación. La regla debe ser atómica y compartir una especificación comprobable con E07.
3. **Alta auditada de sello para admin.** Incorporar una operación admin-only, normalizada, idempotente ante duplicado y con confirmación explícita. Debe devolver UUID canónico y evento de auditoría. No debe conceder escritura de tabla al navegador.
4. **Alta auditada de género para admin.** Misma frontera, exclusiva de admin. `Tipo` y `País` permanecen cerrados/fijos desde la consola.

## Política de aportes que E06 no debe ampliar

Comunidad y colaboradores no invocan las altas administrativas. Un sello propuesto por esos roles viaja dentro del contrato de contribuciones de E09, queda pendiente y sólo un admin puede aprobarlo/materializarlo. Los géneros nuevos no se proponen directamente por comunidad/colaboradores en el alcance actual. El buzón de propuestas es E09/E10, no una lectura lateral construida en E07.

## Extensiones opcionales, no bloqueantes para el editor actual

- Renombrar globalmente una identidad de artista requeriría una RPC auditada separada. E07 hoy permite reemplazar la identidad acreditada o crear una nueva; no muta globalmente el nombre existente.
- Extraer portada desde Bandcamp/Spotify/SoundCloud requiere fetch con allowlist, redirects/timeout/tamaño limitados y procedencia de evidencia. Debe evaluarse con E08/E09; no debe convertirse en fetch arbitrario del navegador ni en escritura implícita de E07.

## Pruebas requeridas al volver a E06

- orden estable con empates, páginas consecutivas sin duplicados/omisiones y filtros combinados;
- publicación incompleta rechazada directamente por RPC aunque se omita la UI;
- creación concurrente de sello/género equivalente devuelve una sola entidad canónica;
- anon, comunidad y colaborador reciben `42501` al forzar las nuevas operaciones;
- actor, razón, before/after y versión aparecen en historial;
- rollback compensatorio sin borrar auditoría.

## Compatibilidad esperada

Mantener las firmas actuales o introducir una versión compatible documentada. E07 debe poder migrar el adaptador sin escribir tablas, sin elevar roles y sin cambiar el significado de `catalog_version`. Producción permanece fuera de alcance.
