-- S7 (H4): apply_catalog_payload conserva las filas de release_links y release_covers que no cambian.
-- Hasta ahora cada escritura de E06 (individual, E09, revert o lote de D2) las borraba y recreaba, y se
-- perdían source_url, content_hash y checked_at. Ahora el payload se aplica como diferencia:
--   * enlaces: se emparejan por URL (la clave única real). Sin cambios no se escribe; cambia
--     provider o is_primary: UPDATE; la URL que el payload quita: DELETE; la nueva: INSERT.
--   * portada externa: la fila que ya tiene esa URL se conserva intacta. Si la URL cambia, se
--     actualiza en el sitio y se anulan source_url/content_hash/checked_at. Sin portada: se borra.
--   * portadas `storage`: el payload no las expresa, así que ya no se borran.
--   * dos enlaces con la misma URL siguen fallando con 23505, como antes por la clave única.
-- Cuerpo y validaciones idénticos a los de 20260917181154; cambia solo el bloque de enlaces y portadas.
-- catalog_snapshot no cambia: before_state/after_state conservan su forma y revert sigue aplicándose.
-- Rollback: tests/sql/s7-rollback-verify.sql (cuerpo de 20260917181154, sin pérdida de datos).

create or replace function private.apply_catalog_payload(p_release_id uuid, p_payload jsonb, p_increment_version boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare p_status text := coalesce(p_payload->>'status', 'draft'); p_version integer; p_radar jsonb := coalesce(p_payload->'radar', '{}'::jsonb); v text;
  v_links jsonb := coalesce(p_payload->'links', '[]'::jsonb); v_cover text := nullif(p_payload->>'cover_url',''); v_keep uuid;
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
  -- S7: enlaces y portadas se sincronizan en lugar de borrarse y recrearse. Una fila que el
  -- payload deja igual no se toca (mismo id, mismo xmin, conserva checked_at); las que cambian se
  -- actualizan; solo se borra lo que el payload quita. Orden: borrar, bajar primarios, actualizar,
  -- insertar, para no chocar con el índice único de un solo primario por lanzamiento.
  if (select count(*) from jsonb_array_elements(v_links) l) <> (select count(distinct l->>'url') from jsonb_array_elements(v_links) l) then
    raise exception 'Duplicate link URLs are not allowed' using errcode = '23505';
  end if;
  delete from public.release_links rl where rl.release_id=p_release_id
    and not exists (select 1 from jsonb_array_elements(v_links) l where l->>'url' = rl.url);
  update public.release_links rl set is_primary=false
    where rl.release_id=p_release_id and rl.is_primary
      and exists (select 1 from jsonb_array_elements(v_links) l where l->>'url' = rl.url and not (l->>'is_primary')::boolean);
  update public.release_links rl set provider=btrim(l->>'provider'), is_primary=(l->>'is_primary')::boolean
    from jsonb_array_elements(v_links) l
    where rl.release_id=p_release_id and rl.url = l->>'url'
      and (rl.provider is distinct from btrim(l->>'provider') or rl.is_primary is distinct from (l->>'is_primary')::boolean);
  insert into public.release_links(release_id,provider,url,is_primary)
    select p_release_id,btrim(l->>'provider'),l->>'url',(l->>'is_primary')::boolean from jsonb_array_elements(v_links) l
    where not exists (select 1 from public.release_links rl where rl.release_id=p_release_id and rl.url = l->>'url');
  -- El payload solo describe la portada externa: las portadas `storage` no se tocan nunca. Si la URL
  -- cambia, la fila externa se actualiza en el sitio (conserva id y created_at, que fija el orden) y se
  -- anulan source_url, content_hash y checked_at, que describían la imagen anterior.
  if v_cover is null then
    delete from public.release_covers where release_id=p_release_id and kind='external';
  else
    select id into v_keep from public.release_covers where release_id=p_release_id and kind='external' and url=v_cover order by created_at, id limit 1;
    if v_keep is null then
      select id into v_keep from public.release_covers where release_id=p_release_id and kind='external' order by created_at, id limit 1;
      if v_keep is null then
        insert into public.release_covers(release_id,url) values(p_release_id,v_cover) returning id into v_keep;
      else
        update public.release_covers set url=v_cover, source_url=null, content_hash=null, checked_at=null where id=v_keep;
      end if;
    end if;
    delete from public.release_covers where release_id=p_release_id and kind='external' and id<>v_keep;
  end if;
  return p_version;
end;
$$;

revoke all on function private.apply_catalog_payload(uuid,jsonb,boolean) from public, anon, authenticated;
