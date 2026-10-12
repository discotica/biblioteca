# Operación: Fase 6

## Frontera obligatoria de entornos

- Staging: `hgocyrzhgohetfpzbmfs`.
- Proyecto final/producción: `ewntlvugbopokdrvnwvg`.
- El vínculo local de `supabase/.temp` puede apuntar al proyecto final. Mientras siga así, está prohibido usar `--linked` para QA: cada comando debe llevar `--project-ref hgocyrzhgohetfpzbmfs` o una URL validada de staging.
- E21 del 24 de septiembre de 2026 quedó en **NO-GO**. No ejecutar el corte gradual hasta cerrar el checklist del expediente E21 y repetir un restore fresco.

## Verificaciones continuas

- `npm run test` cubre el importador y la clasificación del monitor de medios.
- `npm run test:browser` usa un TSV controlado e inspecciona la ficha de lanzamiento y los iframes de Bandcamp, SoundCloud y Spotify.
- `npm run verify:media -- --output reports/media-health.json` hace solicitudes `HEAD` (con fallback mínimo `GET` cuando el proveedor lo rechaza), registra estado y URL final, y no escribe ni borra datos del catálogo. El workflow programado conserva el resultado como artefacto para revisión editorial.

Un `403` o un fallo de CORS no significa automáticamente que una portada o reproductor esté roto: se revisa el informe junto con una prueba en navegador antes de cambiar datos editoriales.

## Restauración y rollback

Antes de cada corte a producción, una segunda persona debe comprobar que puede acceder al backup externo y ejecutar el simulacro en una base aislada:

1. Crear una base temporal vacía y restaurar el dump lógico con `pg_restore --clean --if-exists --no-owner`.
2. Aplicar las migraciones hasta la misma versión registrada en `supabase migration list`.
3. Verificar conteos de `releases`, `crate_items`, `contributions` y objetos de Storage contra el manifiesto del backup.
4. Ejecutar `npm run test`, `npm run build` y una consulta anónima de `catalog_releases` contra la base restaurada.
5. Registrar fecha, hash del dump, responsable y resultado en `estado.md` o en el ticket del despliegue.

La ausencia de Docker/`pg_restore`, un listado vacío de backups o un dump no generado son fallos del gate; nunca cuentan como simulacro. El restore debe incluir catálogo, crates, contribuciones, reportes y los objetos de Storage existentes.

El rollback de la aplicación es reversible: se recompila con `VITE_CATALOG_SOURCE=legacy`, `VITE_EDITORIAL_ENABLED=false`, `VITE_ADMIN_CATALOG_ENABLED=false` y `VITE_BETA_INVITATION_ENABLED=false`. No se eliminan TSV, JSON, slugs heredados ni `crate_items.lanzamiento_slug`. Las migraciones ya aplicadas no se revierten en producción durante un incidente: se recupera en una base aislada, se corrige con una migración nueva y se vuelve a validar.

## Corte gradual

1. Aplicar y validar Fases 4 y 5 en staging, incluido un admin editorial y Storage.
2. Activar `VITE_CATALOG_SOURCE=canonical` solamente en staging; comparar rutas, filtros, crates y la matriz de proveedores.
3. Ejecutar simulacro de restauración y el monitor de medios; resolver únicamente fallos confirmados en navegador.
4. Activar el catálogo canónico en producción y observar el informe diario. Mantener la fuente legado y el flag de reversión disponibles.
5. Retirar el legado únicamente tras un periodo acordado sin regresiones y con una restauración reciente verificada.
