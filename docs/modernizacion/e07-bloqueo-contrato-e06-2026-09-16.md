# E07 — bloqueo de contrato devuelto a E06

Fecha: 2026-09-16 (America/Bogota)  
Etapa afectada: E07 — Consola administrativa de catálogo  
Estado: **bloqueada antes de implementar UI; requiere cierre de E06 en un chat nuevo de `gpt-5.6-sol` con esfuerzo `xhigh`**

## Decisión

No se implementó una consola parcial. Hacerlo exigiría que componentes de cliente leyeran tablas crudas o el esquema `private`, o que E07 inventara RPCs administrativas. Ambas opciones contradicen explícitamente el contrato de E07 y E06.

E03 está aceptada y aporta el dominio público `Release`; E04 está disponible en el árbol mediante sus tokens y primitivas de overlay, con cobertura de teclado en `tests/browser/catalogo.spec.ts`; E06 está cerrada para mutaciones. El bloqueo es exclusivamente una frontera de servicio que E06 no expone.

## Caso reproducible

Con una sesión `authenticated` de administrador en staging, la consola E07 necesita realizar estas lecturas/acciones:

1. Lista paginada que incluya `draft`, `published` y `archived`, con ID, slug, `updated_at`, `catalog_version`, filtros de estado/tipo/calidad y detalles completos para editar.
2. Historial de un release: actor, razón, operación, timestamps, `before_state`, `after_state`, estado de reversión y `change_set_id` para ejecutar `admin_revert_catalog_change` con la versión exacta.
3. Crear un artista, solamente tras confirmación explícita, conservando su UUID y rechazando una colisión por `normalized_name`.
4. Mostrar/editar la fuente solicitada por E07 cuando aplique, sin exponer ni corromper los metadatos de importación.

El contrato actual no permite ninguna de ellas:

- `public.catalog_releases` filtra `where r.status = 'published'`; las policies de `public.releases` y relaciones también permiten leer únicamente publicados. Por tanto un admin del navegador no puede listar, buscar ni abrir borradores/archivados, ni obtener `updated_at` o `catalog_version` desde la vista pública.
- E06 declara que `private.catalog_change_sets` y `private.catalog_change_events` son fail-closed, sin grants ni policies para cliente. Sus cuatro únicas RPC cliente son `admin_create_catalog_release`, `admin_update_catalog_release`, `admin_change_release_slug` y `admin_revert_catalog_change`; ninguna lee historial ni devuelve eventos/snapshots. El resultado de una mutación solo devuelve IDs/versiones.
- E06 valida que todos los IDs de artistas ya existan y prohíbe crear entidades de diccionario implícitamente. No proporciona una operación de creación de artista con normalización/confirmación.
- `private.catalog_snapshot` y los payloads de las cuatro RPC no incluyen `catalog_import_keys` ni `release_covers.source_url`; E07 no puede cubrir el campo «fuente» sin acceso crudo ni un contrato explícito que defina qué parte es editable.

La alternativa de cargar solo `catalog_releases` incumple E07 (no sirve para borradores, archivados, historia ni reversión visible). La alternativa de invocar `supabase.from('releases')`, `supabase.from('catalog_change_sets')` o insertar en `artists` incumple las prohibiciones de E07 y la frontera de E06.

## Solicitud acotada para E06

E06 debe definir, implementar y verificar un contrato administrativo auditado y autorizado en servidor para:

1. lectura paginada/búsqueda de releases de todos los estados, con el snapshot editorial necesario para el formulario, `updated_at` y `catalog_version`;
2. lectura de historial por release, limitada a admin, con actor identificable, razón, before/after, estado y `change_set_id`, sin grants directos sobre `private.*`;
3. creación explícitamente confirmada de artista, con normalización determinista, devolución de UUID y rechazo/recuperación segura ante duplicado;
4. una decisión explícita sobre «fuente»: contrato de solo lectura, campo editable auditado o exclusión documentada del editor, sin exponer `source_payload` privado innecesariamente.

Las nuevas lecturas/operaciones deben conservar el gate `private.is_admin()` y ser denegadas con `42501` fuera de UI para comunidad, colaborador y anon. Las pruebas E06 deben cubrir RLS/permisos, paginación/búsqueda, visibilidad de borradores/archivados, confidencialidad de campos de fuente, colisión normalizada de artista, historial y reversión por `change_set_id`/versión.

## Entrega pendiente de E07 a E08/QA

No hay rutas ni flujos E07 entregables mientras E06 no cierre este contrato. No se modificaron UI, SQL, RLS, producción, commits ni push. Al reanudar, E07 consumirá exclusivamente el dominio E03, `dialogOverlay`/`sheetOverlay`/`dropdownMenu` de E04 y el contrato E06 ampliado; no realizará accesos directos a tablas desde componentes.

## Resolución de E06 (2026-09-16)

E06 cerró la frontera funcional mediante la migración `20260916222340_administrative_catalog_read_contract.sql`, aplicada y verificada en staging. E07 puede preparar su consumo exclusivamente con `admin_list_catalog_releases`, `admin_get_catalog_release`, `admin_get_catalog_history` y `admin_create_catalog_artist`, además de las mutaciones ya existentes. La fuente se muestra solo como `{ mode, provider, url, cover_source_url }`; no se edita ni expone el payload de importación. Las RPCs siguen gateadas por `private.is_admin()` y no hay grants directos a `private.*` ni a tablas de catálogo.

La migración posterior `20260916224510_artist_canonical_normalization.sql` corrige la colisión por tildes y `20260916224720_serialize_catalog_artist_creation.sql` serializa creación por clave canónica. La prueba de tildes y recuperación de conflicto pasa, pero la prueba de dos conexiones directas simultáneas está pendiente por falta de una conexión de staging autorizada; por el gate de seguridad, E07 no se declara plenamente desbloqueada hasta completar esa verificación.
