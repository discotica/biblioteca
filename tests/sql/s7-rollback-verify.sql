-- S7: ensayo del rollback. El bloque entre los marcadores es el cuerpo exacto
-- de la migración posterior que revierte S7 (no se borra ni edita la de S7):
--   npx supabase migration new s7_rollback_preserve_release_media_metadata
-- y pegar ahí ese bloque. Este archivo lo ejecuta dentro de una transacción,
-- comprueba el resultado y revierte: no cambia nada.
--
-- Qué devuelve: apply_catalog_payload a su cuerpo de 20260917181154 (cada escritura
-- vuelve a borrar y recrear release_links y release_covers). No toca datos ni
-- auditoría y los grants se conservan porque `create or replace` no los toca.
-- Pérdida al volver atrás: desde la siguiente escritura de E06 se pierden otra vez
-- source_url, content_hash y checked_at, y las portadas `storage` de ese lanzamiento.
-- No revertir una vez que verify:media o Storage hayan guardado metadatos.
begin;

-- >>> S7 ROLLBACK
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
-- <<< S7 ROLLBACK

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'apply_catalog_payload';
  if position('delete from public.release_links where release_id=p_release_id' in v_def) = 0
     or position('delete from public.release_covers where release_id=p_release_id' in v_def) = 0
     or position('v_keep' in v_def) > 0 then
    raise exception 'S7 rollback FAIL: apply_catalog_payload no recuperó el cuerpo de E06';
  end if;
  if has_function_privilege('anon', 'private.apply_catalog_payload(uuid,jsonb,boolean)', 'execute')
     or has_function_privilege('authenticated', 'private.apply_catalog_payload(uuid,jsonb,boolean)', 'execute') then
    raise exception 'S7 rollback FAIL: grants de apply_catalog_payload cambiaron';
  end if;
  -- Cuerpo restaurado byte a byte respecto a 20260917181154: misma definición que antes de S7.
  if md5(v_def) <> '56bf9f21bdad87e63b94ad38e12ba00a' then
    raise exception 'S7 rollback FAIL: la definición restaurada difiere de 20260917181154';
  end if;
  raise notice 'S7 rollback verify: OK';
end;
$$;

rollback;
