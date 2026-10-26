-- E06: the only client-callable catalog writers are the audited admin RPCs below.
-- The private audit log is deliberately fail-closed (RLS, no policies, no grants).

alter table public.releases add column if not exists catalog_version integer not null default 1
  check (catalog_version > 0);

create table private.catalog_change_sets (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation in ('create', 'update', 'publish', 'archive', 'slug_redirect', 'revert')),
  entity_type text not null default 'release' check (entity_type = 'release'),
  entity_id uuid not null references public.releases(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  status text not null default 'applied' check (status in ('applied', 'reverted')),
  base_version integer,
  result_version integer not null check (result_version > 0),
  reverted_by uuid references private.catalog_change_sets(id) on delete restrict,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

create table private.catalog_change_events (
  id bigint generated always as identity primary key,
  change_set_id uuid not null references private.catalog_change_sets(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  entity_type text not null default 'release',
  entity_id uuid not null references public.releases(id) on delete restrict,
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(after_state) = 'object'),
  check (before_state is null or jsonb_typeof(before_state) = 'object')
);

create index catalog_change_sets_entity_created_idx
  on private.catalog_change_sets (entity_id, created_at desc);
create index catalog_change_sets_actor_created_idx
  on private.catalog_change_sets (actor_id, created_at desc);
create index catalog_change_events_change_set_idx
  on private.catalog_change_events (change_set_id, created_at);

alter table private.catalog_change_sets enable row level security;
alter table private.catalog_change_events enable row level security;
revoke all on table private.catalog_change_sets, private.catalog_change_events from public, anon, authenticated;
revoke all on sequence private.catalog_change_events_id_seq from public, anon, authenticated;

create or replace function private.catalog_snapshot(p_release_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'title', r.title, 'release_date', r.release_date,
    'release_type_id', r.release_type_id, 'label_id', r.label_id, 'review', r.review,
    'status', r.status, 'credit_quality', r.credit_quality, 'catalog_version', r.catalog_version,
    'artist_ids', coalesce((select jsonb_agg(ra.artist_id order by ra.position)
      from public.release_artists ra where ra.release_id = r.id and ra.role = 'primary'), '[]'::jsonb),
    'collaborator_ids', coalesce((select jsonb_agg(ra.artist_id order by ra.position)
      from public.release_artists ra where ra.release_id = r.id and ra.role = 'collaborator'), '[]'::jsonb),
    'genre_ids', coalesce((select jsonb_agg(rg.genre_id order by rg.genre_id)
      from public.release_genres rg where rg.release_id = r.id), '[]'::jsonb),
    'country_ids', coalesce((select jsonb_agg(rc.country_id order by rc.country_id)
      from public.release_countries rc where rc.release_id = r.id), '[]'::jsonb),
    'radar', coalesce((select to_jsonb(rr) - 'release_id' from public.release_radar rr where rr.release_id = r.id), '{}'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('provider', rl.provider, 'url', rl.url, 'is_primary', rl.is_primary) order by rl.is_primary desc, rl.id)
      from public.release_links rl where rl.release_id = r.id), '[]'::jsonb),
    'cover_url', (select rc.url from public.release_covers rc where rc.release_id = r.id and rc.kind = 'external' order by rc.created_at limit 1)
  ) from public.releases r where r.id = p_release_id;
$$;

-- Validates references before changing anything; no dictionary entity is created implicitly.
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
  if p_status = 'published' and nullif(p_payload->>'release_type_id', '') is null then
    raise exception 'Published releases require release_type_id' using errcode = '23514';
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
  if exists (select 1 from jsonb_array_elements(coalesce(p_payload->'links','[]')) l where jsonb_typeof(l) <> 'object' or nullif(btrim(l->>'provider'),'') is null or coalesce(l->>'url','') !~* '^https://')
     or (p_payload->>'cover_url' is not null and p_payload->>'cover_url' <> '' and p_payload->>'cover_url' !~* '^https://') then
    raise exception 'URLs must use HTTPS and links need a provider' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_payload->'links','[]')) l where coalesce((l->>'is_primary')::boolean, true)) > 1 then
    raise exception 'At most one primary link is allowed' using errcode = '23514';
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
  delete from public.release_links where release_id=p_release_id; insert into public.release_links(release_id,provider,url,is_primary) select p_release_id,btrim(l->>'provider'),l->>'url',coalesce((l->>'is_primary')::boolean,true) from jsonb_array_elements(coalesce(p_payload->'links','[]')) l;
  delete from public.release_covers where release_id=p_release_id; if nullif(p_payload->>'cover_url','') is not null then insert into public.release_covers(release_id,url) values(p_release_id,p_payload->>'cover_url'); end if;
  return p_version;
end;
$$;

create or replace function private.record_catalog_change(p_operation text,p_release_id uuid,p_base_version integer,p_result_version integer,p_before jsonb,p_after jsonb,p_reason text,p_reverted uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into private.catalog_change_sets(actor_id,operation,entity_id,reason,base_version,result_version,reverted_by,reverted_at)
  values((select auth.uid()),p_operation,p_release_id,btrim(p_reason),p_base_version,p_result_version,p_reverted,case when p_reverted is null then null else now() end) returning id into v_id;
  insert into private.catalog_change_events(change_set_id,actor_id,operation,entity_id,before_state,after_state)
  values(v_id,(select auth.uid()),p_operation,p_release_id,p_before,p_after);
  if p_reverted is not null then update private.catalog_change_sets set status='reverted',reverted_by=v_id,reverted_at=now() where id=p_reverted and status='applied'; end if;
  return v_id;
end;
$$;

create or replace function public.admin_create_catalog_release(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_after jsonb; v_change uuid; v_version integer;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  insert into public.releases(slug,title,status,credit_quality) values(p_payload->>'slug',btrim(p_payload->>'title'),coalesce(p_payload->>'status','draft'),coalesce(p_payload->>'credit_quality','legacy')) returning id into v_id;
  v_version:=private.apply_catalog_payload(v_id,p_payload,false); v_after:=private.catalog_snapshot(v_id); v_change:=private.record_catalog_change('create',v_id,null,v_version,null,v_after,p_reason);
  return jsonb_build_object('release_id',v_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_update_catalog_release(p_release_id uuid,p_expected_version integer,p_payload jsonb,p_reason text,p_operation text default 'update')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_version integer; v_change uuid;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_operation not in ('update','publish','archive') or nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Invalid operation or missing reason' using errcode='22023'; end if;
  select private.catalog_snapshot(p_release_id) into v_before from public.releases where id=p_release_id for update;
  if v_before is null then raise exception 'Release not found' using errcode='P0002'; end if;
  if (v_before->>'catalog_version')::integer <> p_expected_version then raise exception 'Catalog version conflict' using errcode='40001'; end if;
  if p_operation='publish' then p_payload:=jsonb_set(p_payload,'{status}','"published"'); elsif p_operation='archive' then p_payload:=jsonb_set(p_payload,'{status}','"archived"'); end if;
  if p_payload->>'slug' <> v_before->>'slug' then raise exception 'Use admin_change_release_slug for slug changes' using errcode='22023'; end if;
  v_version:=private.apply_catalog_payload(p_release_id,p_payload); v_after:=private.catalog_snapshot(p_release_id); v_change:=private.record_catalog_change(p_operation,p_release_id,p_expected_version,v_version,v_before,v_after,p_reason);
  return jsonb_build_object('release_id',p_release_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_change_release_slug(p_release_id uuid,p_expected_version integer,p_new_slug text,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_version integer; v_change uuid; v_old text;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null or btrim(p_new_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' then raise exception 'Valid slug and reason are required' using errcode='22023'; end if;
  select private.catalog_snapshot(p_release_id) into v_before from public.releases where id=p_release_id for update; if v_before is null then raise exception 'Release not found' using errcode='P0002'; end if;
  if (v_before->>'catalog_version')::integer <> p_expected_version then raise exception 'Catalog version conflict' using errcode='40001'; end if; v_old:=v_before->>'slug';
  if exists(select 1 from public.releases where slug=btrim(p_new_slug) and id<>p_release_id) or exists(select 1 from public.release_slug_aliases where slug=btrim(p_new_slug) and release_id<>p_release_id) then raise exception 'Slug collides with a canonical slug or visible alias' using errcode='23505'; end if;
  update public.releases set slug=btrim(p_new_slug),catalog_version=catalog_version+1,updated_at=now() where id=p_release_id returning catalog_version into v_version;
  insert into public.release_slug_aliases(slug,release_id,source_name,is_legacy,alias_kind) values(v_old,p_release_id,'editorial',false,'editorial_redirect') on conflict(slug,release_id) do update set source_name='editorial',is_legacy=false,alias_kind='editorial_redirect';
  v_after:=private.catalog_snapshot(p_release_id); v_change:=private.record_catalog_change('slug_redirect',p_release_id,p_expected_version,v_version,v_before,v_after,p_reason); return jsonb_build_object('release_id',p_release_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_revert_catalog_change(p_change_set_id uuid,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.catalog_change_sets%rowtype; e private.catalog_change_events%rowtype; v_current jsonb; v_after jsonb; v_version integer; v_change uuid; v_payload jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into c from private.catalog_change_sets where id=p_change_set_id for update; if not found or c.status<>'applied' then raise exception 'Only an applied change set can be reverted' using errcode='22023'; end if;
  select * into e from private.catalog_change_events where change_set_id=c.id order by id limit 1; select private.catalog_snapshot(c.entity_id) into v_current from public.releases where id=c.entity_id for update;
  if v_current is null or (v_current->>'catalog_version')::integer<>p_expected_version or p_expected_version<>c.result_version then raise exception 'Catalog version conflict; later edits cannot be overwritten' using errcode='40001'; end if;
  if c.operation='create' then update public.releases set status='archived',catalog_version=catalog_version+1,updated_at=now() where id=c.entity_id returning catalog_version into v_version;
  else v_payload:=e.before_state - 'id' - 'catalog_version'; v_payload:=jsonb_set(v_payload,'{slug}',to_jsonb(v_current->>'slug')); v_version:=private.apply_catalog_payload(c.entity_id,v_payload); end if;
  v_after:=private.catalog_snapshot(c.entity_id); v_change:=private.record_catalog_change('revert',c.entity_id,p_expected_version,v_version,v_current,v_after,p_reason,c.id); return jsonb_build_object('release_id',c.entity_id,'catalog_version',v_version,'change_set_id',v_change,'reverted_change_set_id',c.id);
end;
$$;

revoke all on function private.catalog_snapshot(uuid), private.apply_catalog_payload(uuid,jsonb,boolean), private.record_catalog_change(text,uuid,integer,integer,jsonb,jsonb,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_create_catalog_release(jsonb,text), public.admin_update_catalog_release(uuid,integer,jsonb,text,text), public.admin_change_release_slug(uuid,integer,text,text), public.admin_revert_catalog_change(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.admin_create_catalog_release(jsonb,text), public.admin_update_catalog_release(uuid,integer,jsonb,text,text), public.admin_change_release_slug(uuid,integer,text,text), public.admin_revert_catalog_change(uuid,integer,text) to authenticated;
