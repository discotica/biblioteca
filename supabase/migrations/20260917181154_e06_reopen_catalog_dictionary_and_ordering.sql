-- E06 reopening requested by E07: globally ordered administrative reads,
-- publish completeness at the trust boundary, and admin-only audited creation
-- of extensible catalog dictionaries. This migration deliberately does not
-- expose tables, add a proposal inbox, or make countries/types extensible.

create or replace function private.normalize_catalog_dictionary_name(p_name text)
returns text language sql immutable strict set search_path = '' as $$
  select translate(
    lower(normalize(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), NFC)),
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiiooooouuuunc'
  );
$$;

-- Fail before DDL if historic display names collapse to one canonical key.
-- A human must reconcile those names; silently picking an existing UUID would
-- make the migration's identity decision irreversible and unaudited.
do $$
begin
  if exists (
    select 1 from public.labels
    group by private.normalize_catalog_dictionary_name(name)
    having count(*) > 1
  ) then
    raise exception 'Cannot install canonical label uniqueness: existing canonical collisions require editorial reconciliation'
      using errcode = '23505';
  end if;
  if exists (
    select 1 from public.genres
    group by private.normalize_catalog_dictionary_name(name)
    having count(*) > 1
  ) then
    raise exception 'Cannot install canonical genre uniqueness: existing canonical collisions require editorial reconciliation'
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists labels_canonical_name_unique_idx
  on public.labels (private.normalize_catalog_dictionary_name(name));
create unique index if not exists genres_canonical_name_unique_idx
  on public.genres (private.normalize_catalog_dictionary_name(name));

create table private.catalog_dictionary_change_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation = 'create'),
  entity_type text not null check (entity_type in ('label', 'genre')),
  entity_id uuid not null,
  reason text not null check (btrim(reason) <> ''),
  base_version integer,
  result_version integer not null check (result_version = 1),
  normalized_name text not null,
  before_state jsonb,
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz not null default now(),
  check (before_state is null or jsonb_typeof(before_state) = 'object')
);
create index catalog_dictionary_change_events_entity_created_idx
  on private.catalog_dictionary_change_events (entity_type, entity_id, created_at desc);
alter table private.catalog_dictionary_change_events enable row level security;
revoke all on table private.catalog_dictionary_change_events from public, anon, authenticated;
revoke all on sequence private.catalog_dictionary_change_events_id_seq from public, anon, authenticated;

create or replace function private.record_catalog_dictionary_create(
  p_entity_type text, p_entity_id uuid, p_normalized_name text,
  p_after jsonb, p_reason text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into private.catalog_dictionary_change_events(
    actor_id, operation, entity_type, entity_id, reason, base_version,
    result_version, normalized_name, before_state, after_state
  ) values (
    (select auth.uid()), 'create', p_entity_type, p_entity_id, btrim(p_reason),
    null, 1, p_normalized_name, null, p_after
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_create_catalog_label(
  p_name text, p_confirm boolean, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
  v_normalized text;
  v_label public.labels%rowtype;
  v_event_id bigint;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  if p_confirm is not true then
    raise exception 'Explicit label creation confirmation is required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'Label name must contain 1..160 visible characters' using errcode = '22023';
  end if;
  v_normalized := private.normalize_catalog_dictionary_name(v_name);
  perform pg_advisory_xact_lock(hashtextextended('label:' || v_normalized, 0));
  select * into v_label from public.labels
  where private.normalize_catalog_dictionary_name(name) = v_normalized
  order by id limit 1;
  if found then
    return jsonb_build_object('label_id', v_label.id, 'name', v_label.name,
      'normalized_name', v_normalized, 'created', false, 'duplicate', true);
  end if;
  insert into public.labels(name, normalized_name, slug)
  values (v_name, v_normalized, 'label--' || substr(md5(v_normalized), 1, 12))
  on conflict do nothing returning * into v_label;
  if not found then
    select * into v_label from public.labels
    where private.normalize_catalog_dictionary_name(name) = v_normalized
    order by id limit 1;
    if not found then
      raise exception 'Canonical label conflict could not be resolved' using errcode = '40001';
    end if;
    return jsonb_build_object('label_id', v_label.id, 'name', v_label.name,
      'normalized_name', v_normalized, 'created', false, 'duplicate', true);
  end if;
  v_event_id := private.record_catalog_dictionary_create('label', v_label.id,
    v_normalized, jsonb_build_object('id', v_label.id, 'name', v_label.name,
    'normalized_name', v_normalized, 'slug', v_label.slug, 'catalog_version', 1), p_reason);
  return jsonb_build_object('label_id', v_label.id, 'name', v_label.name,
    'normalized_name', v_normalized, 'created', true, 'duplicate', false,
    'audit_event_id', v_event_id, 'catalog_version', 1);
end;
$$;

create or replace function public.admin_create_catalog_genre(
  p_name text, p_confirm boolean, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
  v_normalized text;
  v_genre public.genres%rowtype;
  v_event_id bigint;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  if p_confirm is not true then
    raise exception 'Explicit genre creation confirmation is required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'Genre name must contain 1..160 visible characters' using errcode = '22023';
  end if;
  v_normalized := private.normalize_catalog_dictionary_name(v_name);
  perform pg_advisory_xact_lock(hashtextextended('genre:' || v_normalized, 0));
  select * into v_genre from public.genres
  where private.normalize_catalog_dictionary_name(name) = v_normalized
  order by id limit 1;
  if found then
    return jsonb_build_object('genre_id', v_genre.id, 'name', v_genre.name,
      'normalized_name', v_normalized, 'created', false, 'duplicate', true);
  end if;
  insert into public.genres(name, normalized_name, slug)
  values (v_name, v_normalized, 'genre--' || substr(md5(v_normalized), 1, 12))
  on conflict do nothing returning * into v_genre;
  if not found then
    select * into v_genre from public.genres
    where private.normalize_catalog_dictionary_name(name) = v_normalized
    order by id limit 1;
    if not found then
      raise exception 'Canonical genre conflict could not be resolved' using errcode = '40001';
    end if;
    return jsonb_build_object('genre_id', v_genre.id, 'name', v_genre.name,
      'normalized_name', v_normalized, 'created', false, 'duplicate', true);
  end if;
  v_event_id := private.record_catalog_dictionary_create('genre', v_genre.id,
    v_normalized, jsonb_build_object('id', v_genre.id, 'name', v_genre.name,
    'normalized_name', v_normalized, 'slug', v_genre.slug, 'catalog_version', 1), p_reason);
  return jsonb_build_object('genre_id', v_genre.id, 'name', v_genre.name,
    'normalized_name', v_normalized, 'created', true, 'duplicate', false,
    'audit_event_id', v_event_id, 'catalog_version', 1);
end;
$$;

-- The original six-argument function is replaced by an eight-argument
-- compatible signature: existing callers omit the two trailing defaults.
drop function if exists public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer);
create function public.admin_list_catalog_releases(
  p_query text default null, p_statuses text[] default null, p_type_ids uuid[] default null,
  p_credit_qualities text[] default null, p_page integer default 1, p_page_size integer default 25,
  p_order_key text default 'release_date', p_order_direction text default 'desc'
)
returns jsonb language plpgsql security definer set search_path = '' as $e06_list$
declare
  v_total integer;
  v_items jsonb;
  v_order_key text := lower(btrim(coalesce(p_order_key, 'release_date')));
  v_order_direction text := lower(btrim(coalesce(p_order_direction, 'desc')));
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'page must be >= 1 and page_size must be 1..100' using errcode = '22023'; end if;
  if v_order_key not in ('release_date', 'updated_at', 'title', 'slug')
     or v_order_direction not in ('asc', 'desc') then
    raise exception 'Unsupported order key or direction' using errcode = '22023';
  end if;
  with filtered as (
    select r.id, r.release_date, r.updated_at, r.title, r.slug from public.releases r
    left join public.labels l on l.id = r.label_id
    where (p_statuses is null or r.status = any(p_statuses))
      and (p_type_ids is null or r.release_type_id = any(p_type_ids))
      and (p_credit_qualities is null or r.credit_quality = any(p_credit_qualities))
      and (nullif(btrim(coalesce(p_query,'')),'') is null or r.id::text = btrim(p_query)
        or r.slug ilike '%' || btrim(p_query) || '%' or r.title ilike '%' || btrim(p_query) || '%'
        or coalesce(l.name,'') ilike '%' || btrim(p_query) || '%'
        or exists (select 1 from public.release_artists ra join public.artists a on a.id=ra.artist_id where ra.release_id=r.id and a.name ilike '%' || btrim(p_query) || '%'))
  ), paged as (
    select * from filtered
    order by
      case when v_order_key = 'release_date' and v_order_direction = 'asc' then release_date end asc nulls last,
      case when v_order_key = 'release_date' and v_order_direction = 'desc' then release_date end desc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'asc' then updated_at end asc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'desc' then updated_at end desc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'asc' then lower(title) end asc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'desc' then lower(title) end desc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'asc' then slug end asc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'desc' then slug end desc nulls last,
      id asc
    offset (p_page - 1) * p_page_size limit p_page_size
  )
  select (select count(*) from filtered)::integer,
    coalesce((select jsonb_agg(private.admin_catalog_snapshot(id) order by
      case when v_order_key = 'release_date' and v_order_direction = 'asc' then release_date end asc nulls last,
      case when v_order_key = 'release_date' and v_order_direction = 'desc' then release_date end desc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'asc' then updated_at end asc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'desc' then updated_at end desc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'asc' then lower(title) end asc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'desc' then lower(title) end desc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'asc' then slug end asc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'desc' then slug end desc nulls last,
      id asc) from paged), '[]'::jsonb)
  into v_total, v_items;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'page_size', p_page_size, 'order_key', v_order_key, 'order_direction', v_order_direction);
end;
$e06_list$;

create or replace function private.apply_catalog_payload(p_release_id uuid, p_payload jsonb, p_increment_version boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare p_status text := coalesce(p_payload->>'status', 'draft'); p_version integer; p_radar jsonb := coalesce(p_payload->'radar', '{}'::jsonb); v text;
begin
  if jsonb_typeof(p_payload) <> 'object' or nullif(btrim(p_payload->>'title'), '') is null
     or nullif(btrim(p_payload->>'slug'), '') is null or (p_payload->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'
     or p_status not in ('draft', 'published', 'archived')
     or coalesce(p_payload->>'credit_quality', 'legacy') not in ('legacy', 'proposed', 'verified')
     or jsonb_typeof(p_payload->'artist_ids') <> 'array' or jsonb_array_length(p_payload->'artist_ids') = 0
     or jsonb_typeof(coalesce(p_payload->'collaborator_ids', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'genre_ids', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'country_ids', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payload->'links', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(p_radar) <> 'object' then
    raise exception 'Invalid catalog payload' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_payload->'artist_ids') x where x !~* '^[0-9a-f-]{36}$')
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]')) x where x !~* '^[0-9a-f-]{36}$')
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_payload->'genre_ids','[]')) x where x !~* '^[0-9a-f-]{36}$')
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_payload->'country_ids','[]')) x where x !~* '^[0-9a-f-]{36}$') then
    raise exception 'Relation identifiers must be UUIDs' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_payload->'artist_ids') a join jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]')) b on a = b)
     or (select count(*) from jsonb_array_elements_text(p_payload->'artist_ids')) <> (select count(distinct value) from jsonb_array_elements_text(p_payload->'artist_ids'))
     or (select count(*) from jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]'))) <> (select count(distinct value) from jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]'))) then
    raise exception 'Credits must be unique and cannot belong to both groups' using errcode = '23505';
  end if;
  if (select count(*) from public.artists where id in (select value::uuid from jsonb_array_elements_text(p_payload->'artist_ids'))) <> jsonb_array_length(p_payload->'artist_ids')
     or (select count(*) from public.artists where id in (select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]')))) <> jsonb_array_length(coalesce(p_payload->'collaborator_ids','[]'::jsonb))
     or (select count(*) from public.genres where id in (select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'genre_ids','[]')))) <> jsonb_array_length(coalesce(p_payload->'genre_ids','[]'::jsonb))
     or (select count(*) from public.countries where id in (select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'country_ids','[]')))) <> jsonb_array_length(coalesce(p_payload->'country_ids','[]'::jsonb))
     or (p_payload->>'release_type_id' is not null and not exists (select 1 from public.release_types where id = (p_payload->>'release_type_id')::uuid))
     or (nullif(p_payload->>'label_id','') is not null and not exists (select 1 from public.labels where id = (p_payload->>'label_id')::uuid)) then
    raise exception 'A related entity does not exist' using errcode = '23503';
  end if;
  foreach v in array array['experimental','denso','sintetico','bailable','rapido'] loop
    if (p_radar->>v) !~ '^[0-5]$' then raise exception 'Radar values must be integers from 0 to 5' using errcode = '22023'; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(coalesce(p_payload->'links','[]')) l where jsonb_typeof(l) <> 'object' or nullif(btrim(l->>'provider'),'') is null or coalesce(l->>'url','') !~* '^https://' or jsonb_typeof(l->'is_primary') <> 'boolean')
     or (p_payload->>'cover_url' is not null and p_payload->>'cover_url' <> '' and p_payload->>'cover_url' !~* '^https://') then
    raise exception 'URLs must use HTTPS, links need a provider, and is_primary must be boolean' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_payload->'links','[]')) l where (l->>'is_primary')::boolean) > 1 then
    raise exception 'At most one primary link is allowed' using errcode = '23514';
  end if;
  if p_status = 'published' and (
    nullif(btrim(p_payload->>'release_date'), '') is null
    or nullif(p_payload->>'release_type_id', '') is null
    or nullif(p_payload->>'label_id', '') is null
    or jsonb_array_length(p_payload->'artist_ids') = 0
    or jsonb_array_length(coalesce(p_payload->'genre_ids', '[]'::jsonb)) = 0
    or jsonb_array_length(coalesce(p_payload->'country_ids', '[]'::jsonb)) = 0
    or nullif(btrim(p_payload->>'cover_url'), '') is null
    or (select count(*) from jsonb_array_elements(coalesce(p_payload->'links', '[]'::jsonb)) l where (l->>'is_primary')::boolean) <> 1
  ) then
    raise exception 'Published releases require date, type, label, primary artist, genre, country, HTTPS cover, and exactly one HTTPS primary link' using errcode = '23514';
  end if;
  update public.releases set slug=p_payload->>'slug', title=btrim(p_payload->>'title'), release_date=nullif(p_payload->>'release_date','')::date,
    release_type_id=nullif(p_payload->>'release_type_id','')::uuid, label_id=nullif(p_payload->>'label_id','')::uuid, review=coalesce(p_payload->>'review',''), status=p_status,
    credit_quality=coalesce(p_payload->>'credit_quality','legacy'), catalog_version=catalog_version + case when p_increment_version then 1 else 0 end, updated_at=now()
  where id=p_release_id returning catalog_version into p_version;
  delete from public.release_artists where release_id=p_release_id;
  insert into public.release_artists(release_id,artist_id,role,position) select p_release_id,value::uuid,'primary',ordinality-1 from jsonb_array_elements_text(p_payload->'artist_ids') with ordinality;
  insert into public.release_artists(release_id,artist_id,role,position) select p_release_id,value::uuid,'collaborator',ordinality-1 from jsonb_array_elements_text(coalesce(p_payload->'collaborator_ids','[]')) with ordinality;
  delete from public.release_genres where release_id=p_release_id; insert into public.release_genres(release_id,genre_id) select p_release_id,value::uuid from jsonb_array_elements_text(coalesce(p_payload->'genre_ids','[]'));
  delete from public.release_countries where release_id=p_release_id; insert into public.release_countries(release_id,country_id) select p_release_id,value::uuid from jsonb_array_elements_text(coalesce(p_payload->'country_ids','[]'));
  insert into public.release_radar(release_id,experimental,denso,sintetico,bailable,rapido) values(p_release_id,(p_radar->>'experimental')::smallint,(p_radar->>'denso')::smallint,(p_radar->>'sintetico')::smallint,(p_radar->>'bailable')::smallint,(p_radar->>'rapido')::smallint) on conflict(release_id) do update set experimental=excluded.experimental,denso=excluded.denso,sintetico=excluded.sintetico,bailable=excluded.bailable,rapido=excluded.rapido;
  delete from public.release_links where release_id=p_release_id; insert into public.release_links(release_id,provider,url,is_primary) select p_release_id,btrim(l->>'provider'),l->>'url',(l->>'is_primary')::boolean from jsonb_array_elements(coalesce(p_payload->'links','[]')) l;
  delete from public.release_covers where release_id=p_release_id; if nullif(p_payload->>'cover_url','') is not null then insert into public.release_covers(release_id,url) values(p_release_id,p_payload->>'cover_url'); end if;
  return p_version;
end;
$$;

revoke all on function private.normalize_catalog_dictionary_name(text), private.record_catalog_dictionary_create(text,uuid,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text), public.admin_create_catalog_label(text,boolean,text), public.admin_create_catalog_genre(text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text), public.admin_create_catalog_label(text,boolean,text), public.admin_create_catalog_genre(text,boolean,text) to authenticated;
