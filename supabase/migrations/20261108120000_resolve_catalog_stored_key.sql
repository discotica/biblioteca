-- Aceptar una propuesta abortaba con «Canonical artist conflict could not be resolved» cuando el
-- nombre coincidía con la clave guardada de un artista pero no con su nombre actual. Caso real:
-- «Azogiar» frente a «Azogiař», guardado por la importación de agosto con normalized_name = 'azogiar'.
-- normalize_catalog_artist_name no convierte la ř, así que resolve no lo hallaba, el alta chocaba con
-- artists_normalized_name_key y la segunda búsqueda tampoco lo hallaba. Hay 15 artistas y 1 sello así.
-- Ahora la resolución también mira la clave guardada: es la que impone la unicidad.
-- Solo cambian estas dos funciones; no se escribe ninguna fila. `create or replace` conserva dueño y
-- permisos. Verificación: tests/sql/resolve-stored-key-verify.sql.

create or replace function private.resolve_catalog_artist(p_name text)
returns table(id uuid, name text) language sql stable security definer set search_path = '' as $$
  select a.id, a.name from public.artists a
  where private.normalize_catalog_artist_name(a.name) = private.normalize_catalog_artist_name(p_name)
  union all
  select a.id, a.name from public.artists a
  where a.normalized_name = private.normalize_catalog_artist_name(p_name)
  union all
  select a.id, a.name from public.artist_aliases x join public.artists a on a.id = x.artist_id
  where x.normalized_name = private.normalize_catalog_artist_name(p_name)
  limit 1;
$$;

create or replace function private.resolve_catalog_label(p_name text)
returns table(id uuid, name text) language sql stable security definer set search_path = '' as $$
  select l.id, l.name from public.labels l
  where private.normalize_catalog_dictionary_name(l.name) = private.normalize_catalog_dictionary_name(p_name)
  union all
  select l.id, l.name from public.labels l
  where l.normalized_name = private.normalize_catalog_dictionary_name(p_name)
  union all
  select l.id, l.name from public.label_aliases a join public.labels l on l.id = a.label_id
  where a.normalized_name = private.normalize_catalog_dictionary_name(p_name)
  limit 1;
$$;
