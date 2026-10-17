-- E06 extension required by E07. These are admin-gated RPC read models;
-- catalog and private audit tables remain unavailable for direct client access.

create table private.catalog_artist_change_events (
  id bigint generated always as identity primary key,
  artist_id uuid not null references public.artists(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation = 'create'),
  normalized_name text not null,
  before_state jsonb,
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz not null default now()
);
create index catalog_artist_change_events_artist_idx on private.catalog_artist_change_events(artist_id, created_at desc);
alter table private.catalog_artist_change_events enable row level security;
revoke all on table private.catalog_artist_change_events from public, anon, authenticated;
revoke all on sequence private.catalog_artist_change_events_id_seq from public, anon, authenticated;

create or replace function private.admin_catalog_snapshot(p_release_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.catalog_snapshot(r.id) || jsonb_build_object(
    'updated_at', r.updated_at,
    -- Provenance is deliberately read-only. source_payload/hash/key stay private.
    'source', jsonb_build_object(
      'mode', case when exists (select 1 from public.catalog_import_keys k where k.release_id = r.id) then 'imported' else 'editorial' end,
      'provider', (select l.provider from public.release_links l where l.release_id = r.id and l.is_primary limit 1),
      'url', (select l.url from public.release_links l where l.release_id = r.id and l.is_primary limit 1),
      'cover_source_url', (select c.source_url from public.release_covers c where c.release_id = r.id and c.kind = 'external' order by c.created_at limit 1)
    )
  ) from public.releases r where r.id = p_release_id;
$$;

create or replace function public.admin_list_catalog_releases(
  p_query text default null, p_statuses text[] default null, p_type_ids uuid[] default null,
  p_credit_qualities text[] default null, p_page integer default 1, p_page_size integer default 25
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_total integer; v_items jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'page must be >= 1 and page_size must be 1..100' using errcode = '22023'; end if;
  with filtered as (
    select r.id, r.updated_at from public.releases r
    left join public.labels l on l.id = r.label_id
    where (p_statuses is null or r.status = any(p_statuses))
      and (p_type_ids is null or r.release_type_id = any(p_type_ids))
      and (p_credit_qualities is null or r.credit_quality = any(p_credit_qualities))
      and (nullif(btrim(coalesce(p_query,'')),'') is null or r.id::text = btrim(p_query)
        or r.slug ilike '%' || btrim(p_query) || '%' or r.title ilike '%' || btrim(p_query) || '%'
        or coalesce(l.name,'') ilike '%' || btrim(p_query) || '%'
        or exists (select 1 from public.release_artists ra join public.artists a on a.id=ra.artist_id where ra.release_id=r.id and a.name ilike '%' || btrim(p_query) || '%'))
  ), paged as (
    select * from filtered order by updated_at desc, id desc offset (p_page - 1) * p_page_size limit p_page_size
  )
  select (select count(*) from filtered)::integer,
    coalesce((select jsonb_agg(private.admin_catalog_snapshot(id) order by updated_at desc, id desc) from paged), '[]'::jsonb)
  into v_total, v_items;
  return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'page_size',p_page_size);
end;
$$;

create or replace function public.admin_get_catalog_release(p_release_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_snapshot jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  select private.admin_catalog_snapshot(p_release_id) into v_snapshot;
  if v_snapshot is null then raise exception 'Release not found' using errcode = 'P0002'; end if;
  return v_snapshot;
end;
$$;

create or replace function public.admin_get_catalog_history(p_release_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.releases where id = p_release_id) then raise exception 'Release not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'change_set_id', s.id, 'operation', s.operation, 'reason', s.reason, 'status', s.status,
    'base_version', s.base_version, 'result_version', s.result_version, 'created_at', s.created_at,
    'reverted_at', s.reverted_at, 'reverted_by', s.reverted_by,
    'actor', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name),
    'before_state', e.before_state, 'after_state', e.after_state
  ) order by s.created_at desc, e.id desc), '[]'::jsonb) into v_result
  from private.catalog_change_sets s
  join private.catalog_change_events e on e.change_set_id=s.id
  join public.profiles p on p.id=s.actor_id
  where s.entity_id=p_release_id;
  return jsonb_build_object('release_id',p_release_id,'items',v_result);
end;
$$;

create or replace function public.admin_create_catalog_artist(p_name text, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text := regexp_replace(btrim(coalesce(p_name,'')), '\s+', ' ', 'g'); v_normalized text; v_artist public.artists%rowtype; v_created boolean := false;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_confirm is not true then raise exception 'Explicit artist creation confirmation is required' using errcode = '22023'; end if;
  if v_name = '' or char_length(v_name) > 160 then raise exception 'Artist name must contain 1..160 visible characters' using errcode = '22023'; end if;
  v_normalized := lower(v_name);
  select * into v_artist from public.artists where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = v_normalized order by id limit 1;
  if found then
    return jsonb_build_object('artist_id',v_artist.id,'name',v_artist.name,'normalized_name',v_artist.normalized_name,'created',false,'duplicate',true);
  end if;
  insert into public.artists(name,normalized_name,slug)
  values(v_name,v_normalized,'artist--' || substr(md5(v_normalized),1,12)) returning * into v_artist;
  v_created := true;
  insert into private.catalog_artist_change_events(artist_id,actor_id,operation,normalized_name,after_state)
  values(v_artist.id,(select auth.uid()),'create',v_normalized,jsonb_build_object('id',v_artist.id,'name',v_artist.name,'normalized_name',v_artist.normalized_name,'slug',v_artist.slug));
  return jsonb_build_object('artist_id',v_artist.id,'name',v_artist.name,'normalized_name',v_artist.normalized_name,'created',v_created,'duplicate',false);
end;
$$;

revoke all on function private.admin_catalog_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer), public.admin_get_catalog_release(uuid), public.admin_get_catalog_history(uuid), public.admin_create_catalog_artist(text,boolean) from public, anon, authenticated;
grant execute on function public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer), public.admin_get_catalog_release(uuid), public.admin_get_catalog_history(uuid), public.admin_create_catalog_artist(text,boolean) to authenticated;
