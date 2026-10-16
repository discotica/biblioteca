-- U19 G4: pantalla de diccionarios. Crear, renombrar, fusionar, marcar seleccionable o legado y
-- borrar huérfanos, cada operación con un RPC de admin auditado y con observación.
-- Expediente: docs/modernizacion/u19-estudio-flujo-2026-10-15.md (G4).
--
-- Reglas (decisiones de U19 y del cierre de G4):
--   - géneros y países: crear, renombrar, fusionar y cambiar de estado (seleccionable o legado);
--   - sellos y artistas: renombrar, fusionar y borrar los que no tienen lanzamientos. Se crean al
--     guardar o aceptar un lanzamiento (G1, G3), no desde aquí;
--   - fusionar mueve todas las referencias al valor conservado en una transacción, borra el valor
--     viejo y deja su grafía como alias. Si es un artista o un sello, su URL vieja redirige;
--   - renombrar también deja la grafía vieja como alias cuando cambia la clave normalizada (no si
--     solo cambian tildes o mayúsculas), para que la hoja y Sugerir no vuelvan a crear el valor viejo;
--   - borrar solo acepta valores sin lanzamientos, de cualquier estado. El servidor lo comprueba.
--
-- Errores: el código va en `message` y el valor en `details`, como los RPC v3 de G1.
--   42501 (rol)                         solo admin; anon no tiene EXECUTE
--   22023 reason_required               falta la observación
--   22023 dictionary_kind_invalid       tipo desconocido o que no admite la operación
--   22023 dictionary_name_invalid       nombre vacío o de más de 160 caracteres
--   22023 dictionary_status_invalid     estado que no es selectable ni legacy
--   22023 dictionary_filter_invalid     filtro desconocido para ese tipo
--   22023 dictionary_batch_invalid      borrado sin ids o con más de 200
--   22023 merge_same_value              fusionar un valor consigo mismo
--   23505 dictionary_value_exists       el nombre ya es de otro valor (details: ese valor)
--   23505 dictionary_alias_exists       el nombre ya es alias de otro valor (details: ese valor)
--   23503 dictionary_value_in_use       borrar un valor con lanzamientos (details: los nombres)
--   P0002 dictionary_value_not_found    id inexistente (details: el id)

-- 1. Auditoría ----------------------------------------------------------------------------------------
-- E06 solo registraba altas de sellos y géneros; ahora también países y artistas, y las operaciones
-- de G4. `result_version` era siempre 1 (alta); los diccionarios no tienen versión, así que las
-- operaciones nuevas lo dejan vacío.
alter table private.catalog_dictionary_change_events
  drop constraint catalog_dictionary_change_events_entity_type_check,
  drop constraint catalog_dictionary_change_events_operation_check,
  drop constraint catalog_dictionary_change_events_result_version_check,
  alter column result_version drop not null;
alter table private.catalog_dictionary_change_events
  add constraint catalog_dictionary_change_events_entity_type_check
    check (entity_type in ('label', 'genre', 'country', 'artist')),
  add constraint catalog_dictionary_change_events_operation_check
    check (operation in ('create', 'rename', 'merge', 'status', 'delete')),
  add constraint catalog_dictionary_change_events_result_version_check
    check (result_version is null or (operation = 'create' and result_version = 1));

-- El registro de altas de artistas es historial: tiene que sobrevivir al artista fusionado o
-- borrado. Sin la FK conserva el id como dato.
alter table private.catalog_artist_change_events
  drop constraint catalog_artist_change_events_artist_id_fkey;

-- Las URL públicas de artista usan `artists.slug`, que lleva un sufijo («nombre--a1b2c3d4»). El
-- alias de slug tiene que poder guardarlo.
alter table public.artist_slug_aliases drop constraint artist_slug_aliases_slug_check;
alter table public.artist_slug_aliases
  add constraint artist_slug_aliases_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$');

-- 2. Ayudas ---------------------------------------------------------------------------------------------
-- Tablas de cada diccionario. Los nombres salen de esta lista cerrada, nunca de la entrada.
create or replace function private.catalog_dictionary_meta(p_kind text)
returns table (tbl text, alias_tbl text, fk text, ref_tbl text, slug_alias_tbl text)
language sql immutable set search_path = '' as $$
  select m.tbl, m.alias_tbl, m.fk, m.ref_tbl, m.slug_alias_tbl from (values
    ('genre', 'genres', 'genre_aliases', 'genre_id', 'release_genres', null),
    ('country', 'countries', 'country_aliases', 'country_id', 'release_countries', null),
    ('label', 'labels', 'label_aliases', 'label_id', 'releases', 'label_slug_aliases'),
    ('artist', 'artists', 'artist_aliases', 'artist_id', 'release_artists', 'artist_slug_aliases')
  ) m(kind, tbl, alias_tbl, fk, ref_tbl, slug_alias_tbl)
  where m.kind = p_kind;
$$;

-- La misma clave que usan E06 y G1 (las dos funciones de normalización son iguales hoy).
create or replace function private.catalog_dictionary_key(p_kind text, p_name text)
returns text language sql immutable set search_path = '' as $$
  select case when p_kind = 'artist' then private.normalize_catalog_artist_name(p_name)
    else private.normalize_catalog_dictionary_name(p_name) end;
$$;

-- `slugifyReleaseIdentity` de src/lib/domain/releases.ts: la URL pública de un sello.
create or replace function private.slugify_catalog_name(p_name text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(
    regexp_replace(normalize(lower(btrim(p_name)), NFD), '[̀-ͯ]', '', 'g'),
    '[^a-z0-9]+', '-', 'g'), '-');
$$;

-- Slug interno con el formato de la importación (`slug()` de scripts/import-catalog.mjs).
create or replace function private.catalog_entity_slug(p_name text, p_key text, p_length integer default 8)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(private.slugify_catalog_name(p_name), ''), 'sin-slug') || '--'
    || left(encode(sha256(convert_to(p_key, 'UTF8')), 'hex'), p_length);
$$;

create or replace function private.clean_catalog_dictionary_name(p_name text)
returns text language plpgsql immutable set search_path = '' as $$
declare v_name text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
begin
  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'dictionary_name_invalid' using errcode = '22023', detail = coalesce(p_name, '');
  end if;
  return v_name;
end;
$$;

create or replace function private.require_catalog_dictionary_admin(p_reason text)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  return btrim(p_reason);
end;
$$;

create or replace function private.require_catalog_dictionary_kind(p_kind text, p_allowed text[])
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_kind is null or not (p_kind = any (p_allowed)) then
    raise exception 'dictionary_kind_invalid' using errcode = '22023', detail = coalesce(p_kind, '');
  end if;
end;
$$;

-- Estado de un valor para la auditoría y las respuestas: nombre, slug, estado, alias y alias de slug.
create or replace function private.catalog_dictionary_state(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m record; v jsonb; v_slugs jsonb;
begin
  select * into m from private.catalog_dictionary_meta(p_kind);
  execute format(
    'select jsonb_build_object(''id'', t.id, ''name'', t.name, ''normalized_name'', t.normalized_name, ''slug'', t.slug)
       || case when %L in (''genre'', ''country'') then jsonb_build_object(''status'', to_jsonb(t) ->> ''status'') else ''{}''::jsonb end
       || jsonb_build_object(''aliases'', coalesce((select jsonb_agg(a.name order by a.name) from public.%I a where a.%I = t.id), ''[]''::jsonb))
     from public.%I t where t.id = $1',
    p_kind, m.alias_tbl, m.fk, m.tbl)
  into v using p_id;
  if v is not null and m.slug_alias_tbl is not null then
    execute format('select coalesce(jsonb_agg(s.slug order by s.slug), ''[]''::jsonb) from public.%I s where s.%I = $1', m.slug_alias_tbl, m.fk)
    into v_slugs using p_id;
    v := v || jsonb_build_object('slug_aliases', v_slugs);
  end if;
  return v;
end;
$$;

create or replace function private.record_catalog_dictionary_event(
  p_operation text, p_kind text, p_entity_id uuid, p_reason text, p_normalized_name text, p_before jsonb, p_after jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into private.catalog_dictionary_change_events (
    actor_id, operation, entity_type, entity_id, reason, base_version, result_version, normalized_name, before_state, after_state
  ) values (
    (select auth.uid()), p_operation, p_kind, p_entity_id, p_reason, null, case when p_operation = 'create' then 1 end,
    p_normalized_name, p_before, p_after
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Quién tiene ya este nombre: un valor vivo (otro que p_except) o un alias. Primero el valor vivo.
create or replace function private.catalog_dictionary_name_owner(p_kind text, p_key text, p_except uuid)
returns table (owner_kind text, owner_id uuid, owner_name text)
language plpgsql stable security definer set search_path = '' as $$
declare m record;
begin
  select * into m from private.catalog_dictionary_meta(p_kind);
  return query execute format(
    'select ''value''::text, t.id, t.name from public.%1$I t
       where private.catalog_dictionary_key(%3$L, t.name) = $1 and t.id is distinct from $2
     union all
     select ''alias''::text, t.id, t.name from public.%2$I a join public.%1$I t on t.id = a.%4$I
       where a.normalized_name = $1
     limit 1',
    m.tbl, m.alias_tbl, p_kind, m.fk)
  using p_key, p_except;
end;
$$;

-- Un nombre libre para p_kind, salvo el propio valor p_except. Si el nombre es alias del propio
-- valor, lo devuelve para que quien llama lo retire.
create or replace function private.assert_catalog_dictionary_name_free(p_kind text, p_key text, p_except uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare o record;
begin
  select * into o from private.catalog_dictionary_name_owner(p_kind, p_key, p_except);
  if not found then return false; end if;
  if o.owner_kind = 'value' then
    raise exception 'dictionary_value_exists' using errcode = '23505', detail = o.owner_name,
      hint = 'Ese nombre ya es de otro valor; fusiónalos.';
  end if;
  if o.owner_id is distinct from p_except then
    raise exception 'dictionary_alias_exists' using errcode = '23505', detail = o.owner_name,
      hint = 'Ese nombre ya es alias de otro valor.';
  end if;
  return true;
end;
$$;

-- Bloquea la fila y la devuelve como jsonb, o P0002.
create or replace function private.lock_catalog_dictionary_value(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m record; v jsonb;
begin
  select * into m from private.catalog_dictionary_meta(p_kind);
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', m.tbl) into v using p_id;
  if v is null then
    raise exception 'dictionary_value_not_found' using errcode = 'P0002', detail = coalesce(p_id::text, '');
  end if;
  return v;
end;
$$;

-- Guarda la URL vieja de un artista o un sello. No pisa un alias que ya apunte a otro valor.
create or replace function private.add_catalog_slug_alias(p_kind text, p_slug text, p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_slug is null or p_slug = '' then return false; end if;
  if p_kind = 'artist' then
    if exists (select 1 from public.artists a where a.slug = p_slug) then return false; end if;
    insert into public.artist_slug_aliases (slug, artist_id, created_by) values (p_slug, p_id, (select auth.uid()))
    on conflict (slug) do nothing;
  else
    if exists (select 1 from public.labels l where private.slugify_catalog_name(l.name) = p_slug) then return false; end if;
    insert into public.label_slug_aliases (slug, label_id, created_by) values (p_slug, p_id, (select auth.uid()))
    on conflict (slug) do nothing;
  end if;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function private.catalog_dictionary_meta(text), private.catalog_dictionary_key(text, text),
  private.slugify_catalog_name(text), private.catalog_entity_slug(text, text, integer),
  private.clean_catalog_dictionary_name(text), private.require_catalog_dictionary_admin(text),
  private.require_catalog_dictionary_kind(text, text[]), private.catalog_dictionary_state(text, uuid),
  private.record_catalog_dictionary_event(text, text, uuid, text, text, jsonb, jsonb),
  private.catalog_dictionary_name_owner(text, text, uuid), private.assert_catalog_dictionary_name_free(text, text, uuid),
  private.lock_catalog_dictionary_value(text, uuid), private.add_catalog_slug_alias(text, text, uuid)
  from public, anon, authenticated;

-- 3. Lista de la pantalla ------------------------------------------------------------------------------
-- Una página de un diccionario, con lanzamientos de cualquier estado y los publicados, alias, alias
-- de slug y la URL pública. La búsqueda mira el nombre y los alias, sin mayúsculas ni tildes.
-- Filtros: all, orphans (sin lanzamientos) y, en géneros y países, selectable, legacy y retired.
create or replace function public.admin_list_catalog_dictionary(
  p_kind text, p_query text default null, p_filter text default 'all', p_page integer default 1, p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m record;
  v_filter text := coalesce(nullif(btrim(coalesce(p_filter, '')), ''), 'all');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_query text := nullif(private.normalize_catalog_dictionary_name(coalesce(p_query, '')), '');
  v_like text;
  v_count_expr text;
  v_published_expr text;
  v_result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  perform private.require_catalog_dictionary_kind(p_kind, array['genre', 'country', 'label', 'artist']);
  if not (v_filter = any (case when p_kind in ('genre', 'country')
      then array['all', 'orphans', 'selectable', 'legacy', 'retired'] else array['all', 'orphans'] end)) then
    raise exception 'dictionary_filter_invalid' using errcode = '22023', detail = v_filter;
  end if;
  select * into m from private.catalog_dictionary_meta(p_kind);
  v_like := case when v_query is null then null
    else '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  v_count_expr := case when p_kind = 'label'
    then 'count(*) from public.releases r where r.label_id = t.id'
    else format('count(distinct x.release_id) from public.%I x where x.%I = t.id', m.ref_tbl, m.fk) end;
  v_published_expr := case when p_kind = 'label'
    then 'count(*) from public.releases r where r.label_id = t.id and r.status = ''published'''
    else format('count(distinct x.release_id) from public.%I x join public.releases r on r.id = x.release_id where x.%I = t.id and r.status = ''published''', m.ref_tbl, m.fk) end;

  execute format($q$
    with base as (
      select t.id, t.name, t.slug, %5$s as status, (select %3$s) as release_count
      from public.%1$I t
    ), counted as (
      select jsonb_build_object(
        'all', count(*), 'orphans', count(*) filter (where release_count = 0),
        'selectable', count(*) filter (where status = 'selectable'),
        'legacy', count(*) filter (where status = 'legacy'),
        'retired', count(*) filter (where status = 'retired')) as counts
      from base
    ), filtered as (
      select b.* from base b
      where ($1 = 'all' or ($1 = 'orphans' and b.release_count = 0) or b.status = $1)
        and ($2 is null
          or private.normalize_catalog_dictionary_name(b.name) like $2
          or exists (select 1 from public.%2$I a where a.%4$I = b.id and a.normalized_name like $2))
    ), paged as (
      select f.* from filtered f
      order by private.normalize_catalog_dictionary_name(f.name), f.name, f.id
      offset ($3 - 1) * $4 limit $4
    )
    select jsonb_build_object(
      'kind', %6$L, 'filter', $1, 'page', $3, 'page_size', $4,
      'total', (select count(*) from filtered),
      'counts', (select counts from counted),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'slug', p.slug, 'status', p.status,
          'release_count', p.release_count,
          'published_count', (select %7$s),
          'aliases', coalesce((select jsonb_agg(a.name order by a.name) from public.%2$I a where a.%4$I = p.id), '[]'::jsonb),
          'slug_aliases', %8$s,
          'public_slug', %9$s
        ) order by private.normalize_catalog_dictionary_name(p.name), p.name, p.id)
        from paged p join public.%1$I t on t.id = p.id), '[]'::jsonb))
    $q$,
    m.tbl, m.alias_tbl, v_count_expr, m.fk,
    case when p_kind in ('genre', 'country') then 't.status' else 'null::text' end,
    p_kind, v_published_expr,
    case when m.slug_alias_tbl is null then '''[]''::jsonb'
      else format('coalesce((select jsonb_agg(s.slug order by s.slug) from public.%I s where s.%I = p.id), ''[]''::jsonb)', m.slug_alias_tbl, m.fk) end,
    case p_kind when 'artist' then 'p.slug' when 'label' then 'private.slugify_catalog_name(p.name)' else 'null::text' end)
  into v_result using v_filter, v_like, v_page, v_size;
  return v_result;
end;
$$;

-- 4. Crear (géneros y países) -------------------------------------------------------------------------
create or replace function public.admin_create_catalog_dictionary_value(
  p_kind text, p_name text, p_status text default 'selectable', p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := private.require_catalog_dictionary_admin(p_reason);
  v_name text;
  v_key text;
  v_status text := coalesce(p_status, 'selectable');
  v_id uuid;
  v_after jsonb;
begin
  perform private.require_catalog_dictionary_kind(p_kind, array['genre', 'country']);
  if v_status not in ('selectable', 'legacy') then
    raise exception 'dictionary_status_invalid' using errcode = '22023', detail = v_status;
  end if;
  v_name := private.clean_catalog_dictionary_name(p_name);
  v_key := private.catalog_dictionary_key(p_kind, v_name);
  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || v_key, 0));
  perform private.assert_catalog_dictionary_name_free(p_kind, v_key, null);
  if p_kind = 'genre' then
    insert into public.genres (name, normalized_name, slug, status)
    values (v_name, v_key, private.catalog_entity_slug(v_name, v_key), v_status) returning id into v_id;
  else
    insert into public.countries (name, normalized_name, slug, status)
    values (v_name, v_key, private.catalog_entity_slug(v_name, v_key), v_status) returning id into v_id;
  end if;
  v_after := private.catalog_dictionary_state(p_kind, v_id);
  perform private.record_catalog_dictionary_event('create', p_kind, v_id, v_reason, v_key, null, v_after);
  return jsonb_build_object('kind', p_kind, 'value', v_after);
end;
$$;

-- 5. Renombrar ----------------------------------------------------------------------------------------
create or replace function public.admin_rename_catalog_dictionary_value(p_kind text, p_id uuid, p_name text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := private.require_catalog_dictionary_admin(p_reason);
  m record;
  v_row jsonb;
  v_before jsonb;
  v_after jsonb;
  v_name text;
  v_key text;
  v_old_name text;
  v_old_key text;
  v_old_slug text;
  v_slug text;
  v_alias_added boolean := false;
  v_slug_aliases text[] := '{}'::text[];
begin
  perform private.require_catalog_dictionary_kind(p_kind, array['genre', 'country', 'label', 'artist']);
  select * into m from private.catalog_dictionary_meta(p_kind);
  v_name := private.clean_catalog_dictionary_name(p_name);
  v_row := private.lock_catalog_dictionary_value(p_kind, p_id);
  v_old_name := v_row ->> 'name';
  v_old_slug := v_row ->> 'slug';
  if v_name = v_old_name then
    return jsonb_build_object('kind', p_kind, 'changed', false, 'value', private.catalog_dictionary_state(p_kind, p_id));
  end if;
  v_before := private.catalog_dictionary_state(p_kind, p_id);
  v_old_key := private.catalog_dictionary_key(p_kind, v_old_name);
  v_key := private.catalog_dictionary_key(p_kind, v_name);
  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || v_key, 0));
  if private.assert_catalog_dictionary_name_free(p_kind, v_key, p_id) then
    -- El nombre nuevo era un alias de este mismo valor: deja de serlo.
    execute format('delete from public.%I where %I = $1 and normalized_name = $2', m.alias_tbl, m.fk) using p_id, v_key;
  end if;

  v_slug := private.catalog_entity_slug(v_name, v_key);
  execute format('select case when exists (select 1 from public.%I t where t.slug = $1 and t.id <> $2) then $3 else $1 end', m.tbl)
    into v_slug using v_slug, p_id, private.catalog_entity_slug(v_name, v_key || ':' || p_id::text, 16);
  execute format('update public.%I set name = $1, normalized_name = $2, slug = $3, updated_at = now() where id = $4', m.tbl)
    using v_name, v_key, v_slug, p_id;

  if v_old_key <> v_key then
    execute format('insert into public.%I (%I, name, created_by) values ($1, $2, $3)', m.alias_tbl, m.fk)
      using p_id, v_old_name, (select auth.uid());
    v_alias_added := true;
  end if;
  if p_kind = 'artist' then
    if v_old_slug <> v_slug and private.add_catalog_slug_alias('artist', v_old_slug, p_id) then
      v_slug_aliases := v_slug_aliases || v_old_slug;
    end if;
    if private.slugify_catalog_name(v_old_name) <> private.slugify_catalog_name(v_name)
        and private.add_catalog_slug_alias('artist', private.slugify_catalog_name(v_old_name), p_id) then
      v_slug_aliases := v_slug_aliases || private.slugify_catalog_name(v_old_name);
    end if;
  elsif p_kind = 'label' then
    if private.slugify_catalog_name(v_old_name) <> private.slugify_catalog_name(v_name)
        and private.add_catalog_slug_alias('label', private.slugify_catalog_name(v_old_name), p_id) then
      v_slug_aliases := v_slug_aliases || private.slugify_catalog_name(v_old_name);
    end if;
  end if;

  v_after := private.catalog_dictionary_state(p_kind, p_id);
  perform private.record_catalog_dictionary_event('rename', p_kind, p_id, v_reason, v_key, v_before,
    v_after || jsonb_build_object('alias_added', v_alias_added, 'slug_aliases_added', to_jsonb(v_slug_aliases)));
  return jsonb_build_object('kind', p_kind, 'changed', true, 'previous_name', v_old_name, 'value', v_after,
    'alias_added', v_alias_added, 'slug_aliases_added', to_jsonb(v_slug_aliases));
end;
$$;

-- 6. Fusionar -----------------------------------------------------------------------------------------
-- Todo en la transacción del RPC: si algo falla, no cambia nada.
--   - las referencias del valor viejo pasan al conservado; un lanzamiento que ya tenía los dos se
--     queda con uno. En créditos, si el viejo era principal y el conservado colaborador, el
--     conservado pasa a principal en el lugar del viejo; las posiciones se renumeran;
--   - los lanzamientos afectados suben de `catalog_version`: un editor abierto con el id viejo
--     recibe 40001 al guardar y recarga, en lugar de fallar por la FK;
--   - las propuestas de créditos de E08 abiertas cambian el id viejo por el conservado;
--   - los alias y alias de slug del viejo pasan al conservado; el nombre viejo queda como alias y,
--     en artistas y sellos, su URL como alias de slug;
--   - el valor viejo se borra.
-- El historial de cada lanzamiento (E06) y el registro de altas conservan el id viejo como dato.
create or replace function public.admin_merge_catalog_dictionary_values(p_kind text, p_source_id uuid, p_target_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := private.require_catalog_dictionary_admin(p_reason);
  m record;
  v_source jsonb;
  v_target jsonb;
  v_source_state jsonb;
  v_target_state jsonb;
  v_releases uuid[];
  v_release uuid;
  s record;
  t record;
  v_slug_aliases text[] := '{}'::text[];
  v_after jsonb;
begin
  perform private.require_catalog_dictionary_kind(p_kind, array['genre', 'country', 'label', 'artist']);
  if p_source_id is null or p_target_id is null or p_source_id = p_target_id then
    raise exception 'merge_same_value' using errcode = '22023';
  end if;
  select * into m from private.catalog_dictionary_meta(p_kind);
  -- Orden fijo de bloqueo para que dos fusiones cruzadas no se bloqueen entre sí.
  if p_source_id < p_target_id then
    v_source := private.lock_catalog_dictionary_value(p_kind, p_source_id);
    v_target := private.lock_catalog_dictionary_value(p_kind, p_target_id);
  else
    v_target := private.lock_catalog_dictionary_value(p_kind, p_target_id);
    v_source := private.lock_catalog_dictionary_value(p_kind, p_source_id);
  end if;
  v_source_state := private.catalog_dictionary_state(p_kind, p_source_id);
  v_target_state := private.catalog_dictionary_state(p_kind, p_target_id);

  execute format('select coalesce(array_agg(distinct %I order by %I), ''{}'') from public.%I where %I = $1',
      case when p_kind = 'label' then 'id' else 'release_id' end, case when p_kind = 'label' then 'id' else 'release_id' end,
      m.ref_tbl, m.fk)
    into v_releases using p_source_id;
  perform 1 from public.releases r where r.id = any (v_releases) order by r.id for update;

  if p_kind = 'label' then
    update public.releases set label_id = p_target_id where label_id = p_source_id;
  elsif p_kind = 'artist' then
    foreach v_release in array v_releases loop
      select * into s from public.release_artists where release_id = v_release and artist_id = p_source_id;
      select * into t from public.release_artists where release_id = v_release and artist_id = p_target_id;
      if t.artist_id is null then
        update public.release_artists set artist_id = p_target_id where release_id = v_release and artist_id = p_source_id;
      else
        delete from public.release_artists where release_id = v_release and artist_id = p_source_id;
        if s.role = 'primary' and t.role = 'collaborator' then
          update public.release_artists set role = 'primary', position = s.position
          where release_id = v_release and artist_id = p_target_id;
        end if;
        -- Posiciones seguidas desde 0 en cada grupo, sin huecos.
        with moved as (delete from public.release_artists where release_id = v_release returning *)
        insert into public.release_artists (release_id, artist_id, position, role)
        select release_id, artist_id, (row_number() over (partition by role order by position, artist_id) - 1)::smallint, role from moved;
      end if;
    end loop;
    update private.credit_inference_proposals p set
      proposed_primary_artist_ids = (
        select coalesce(jsonb_agg(to_jsonb(v) order by o), '[]'::jsonb) from (
          select v, min(o) o from (
            select case when e.value = p_source_id::text then p_target_id::text else e.value end v, e.o
            from jsonb_array_elements_text(p.proposed_primary_artist_ids) with ordinality e(value, o)) x group by v) y),
      proposed_collaborator_artist_ids = (
        select coalesce(jsonb_agg(to_jsonb(v) order by o), '[]'::jsonb) from (
          select v, min(o) o from (
            select case when e.value = p_source_id::text then p_target_id::text else e.value end v, e.o
            from jsonb_array_elements_text(p.proposed_collaborator_artist_ids) with ordinality e(value, o)) x group by v) y),
      updated_at = now()
    where p.status in ('ready_for_review', 'approved', 'conflict')
      and (p.proposed_primary_artist_ids ? p_source_id::text or p.proposed_collaborator_artist_ids ? p_source_id::text);
  else
    execute format('insert into public.%1$I (release_id, %2$I) select release_id, $2 from public.%1$I where %2$I = $1 on conflict do nothing',
      m.ref_tbl, m.fk) using p_source_id, p_target_id;
    execute format('delete from public.%I where %I = $1', m.ref_tbl, m.fk) using p_source_id;
  end if;

  update public.releases set catalog_version = catalog_version + 1, updated_at = now() where id = any (v_releases);

  execute format('update public.%I set %I = $2 where %I = $1', m.alias_tbl, m.fk, m.fk) using p_source_id, p_target_id;
  if m.slug_alias_tbl is not null then
    execute format('update public.%I set %I = $2 where %I = $1', m.slug_alias_tbl, m.fk, m.fk) using p_source_id, p_target_id;
  end if;
  execute format('delete from public.%I where id = $1', m.tbl) using p_source_id;

  execute format('insert into public.%I (%I, name, created_by) values ($1, $2, $3)', m.alias_tbl, m.fk)
    using p_target_id, v_source ->> 'name', (select auth.uid());
  if p_kind = 'artist' then
    if private.add_catalog_slug_alias('artist', v_source ->> 'slug', p_target_id) then
      v_slug_aliases := v_slug_aliases || (v_source ->> 'slug');
    end if;
    if private.add_catalog_slug_alias('artist', private.slugify_catalog_name(v_source ->> 'name'), p_target_id) then
      v_slug_aliases := v_slug_aliases || private.slugify_catalog_name(v_source ->> 'name');
    end if;
  elsif p_kind = 'label' then
    if private.add_catalog_slug_alias('label', private.slugify_catalog_name(v_source ->> 'name'), p_target_id) then
      v_slug_aliases := v_slug_aliases || private.slugify_catalog_name(v_source ->> 'name');
    end if;
  end if;

  v_after := private.catalog_dictionary_state(p_kind, p_target_id);
  perform private.record_catalog_dictionary_event('merge', p_kind, p_target_id, v_reason, v_target ->> 'normalized_name',
    jsonb_build_object('source', v_source_state, 'target', v_target_state),
    v_after || jsonb_build_object('merged_id', p_source_id, 'release_ids', to_jsonb(v_releases),
      'slug_aliases_added', to_jsonb(v_slug_aliases)));
  return jsonb_build_object('kind', p_kind, 'source', jsonb_build_object('id', p_source_id, 'name', v_source ->> 'name'),
    'value', v_after, 'release_count', coalesce(array_length(v_releases, 1), 0),
    'slug_aliases_added', to_jsonb(v_slug_aliases));
end;
$$;

-- 7. Seleccionable o legado (géneros y países) -----------------------------------------------------------
-- Un valor retirado (WORLD, Entrañas, TSA) también puede volver a seleccionable o legado.
create or replace function public.admin_set_catalog_dictionary_status(p_kind text, p_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := private.require_catalog_dictionary_admin(p_reason);
  v_row jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  perform private.require_catalog_dictionary_kind(p_kind, array['genre', 'country']);
  if p_status is null or p_status not in ('selectable', 'legacy') then
    raise exception 'dictionary_status_invalid' using errcode = '22023', detail = coalesce(p_status, '');
  end if;
  v_row := private.lock_catalog_dictionary_value(p_kind, p_id);
  if v_row ->> 'status' = p_status then
    return jsonb_build_object('kind', p_kind, 'changed', false, 'value', private.catalog_dictionary_state(p_kind, p_id));
  end if;
  v_before := private.catalog_dictionary_state(p_kind, p_id);
  if p_kind = 'genre' then
    update public.genres set status = p_status, updated_at = now() where id = p_id;
  else
    update public.countries set status = p_status, updated_at = now() where id = p_id;
  end if;
  v_after := private.catalog_dictionary_state(p_kind, p_id);
  perform private.record_catalog_dictionary_event('status', p_kind, p_id, v_reason, v_row ->> 'normalized_name', v_before, v_after);
  return jsonb_build_object('kind', p_kind, 'changed', true, 'previous_status', v_row ->> 'status', 'value', v_after);
end;
$$;

-- 8. Borrar huérfanos (sellos y artistas) -----------------------------------------------------------------
-- Todo o nada: si uno tiene lanzamientos (de cualquier estado) o no existe, no se borra ninguno.
-- Sus alias y alias de slug se van con él.
create or replace function public.admin_delete_catalog_dictionary_orphans(p_kind text, p_ids uuid[], p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := private.require_catalog_dictionary_admin(p_reason);
  m record;
  v_ids uuid[];
  v_id uuid;
  v_in_use text;
  v_state jsonb;
  v_items jsonb := '[]'::jsonb;
begin
  perform private.require_catalog_dictionary_kind(p_kind, array['label', 'artist']);
  select coalesce(array_agg(distinct x order by x), '{}') into v_ids from unnest(coalesce(p_ids, '{}')) x where x is not null;
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 200 then
    raise exception 'dictionary_batch_invalid' using errcode = '22023', detail = cardinality(v_ids)::text;
  end if;
  select * into m from private.catalog_dictionary_meta(p_kind);
  foreach v_id in array v_ids loop
    perform private.lock_catalog_dictionary_value(p_kind, v_id);
  end loop;
  if p_kind = 'label' then
    select string_agg(l.name, ', ' order by l.name) into v_in_use from public.labels l
    where l.id = any (v_ids) and exists (select 1 from public.releases r where r.label_id = l.id);
  else
    select string_agg(a.name, ', ' order by a.name) into v_in_use from public.artists a
    where a.id = any (v_ids) and exists (select 1 from public.release_artists ra where ra.artist_id = a.id);
  end if;
  if v_in_use is not null then
    raise exception 'dictionary_value_in_use' using errcode = '23503', detail = v_in_use,
      hint = 'Solo se borran valores sin lanzamientos; fusiónalos o corrige sus lanzamientos primero.';
  end if;
  foreach v_id in array v_ids loop
    v_state := private.catalog_dictionary_state(p_kind, v_id);
    execute format('delete from public.%I where id = $1', m.tbl) using v_id;
    perform private.record_catalog_dictionary_event('delete', p_kind, v_id, v_reason, v_state ->> 'normalized_name',
      v_state, jsonb_build_object('deleted', true, 'id', v_id));
    v_items := v_items || jsonb_build_array(jsonb_build_object('id', v_id, 'name', v_state ->> 'name'));
  end loop;
  return jsonb_build_object('kind', p_kind, 'deleted_count', cardinality(v_ids), 'items', v_items);
end;
$$;

revoke all on function public.admin_list_catalog_dictionary(text, text, text, integer, integer),
  public.admin_create_catalog_dictionary_value(text, text, text, text),
  public.admin_rename_catalog_dictionary_value(text, uuid, text, text),
  public.admin_merge_catalog_dictionary_values(text, uuid, uuid, text),
  public.admin_set_catalog_dictionary_status(text, uuid, text, text),
  public.admin_delete_catalog_dictionary_orphans(text, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.admin_list_catalog_dictionary(text, text, text, integer, integer),
  public.admin_create_catalog_dictionary_value(text, text, text, text),
  public.admin_rename_catalog_dictionary_value(text, uuid, text, text),
  public.admin_merge_catalog_dictionary_values(text, uuid, uuid, text),
  public.admin_set_catalog_dictionary_status(text, uuid, text, text),
  public.admin_delete_catalog_dictionary_orphans(text, uuid[], text)
  to authenticated;
