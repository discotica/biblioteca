-- U19 G1 (2/3): propuesta v3, corrección en el editor, bloqueo por "tomada", alta directa de admin y
-- duplicados por enlace. Expediente: docs/modernizacion/u19-estudio-flujo-2026-10-15.md (G1, puntos
-- 3 a 7). El contrato, RPC por RPC, está documentado en el expediente.
--
-- Propuesta v3 (nombres, no UUID):
--   version 3 (se acepta 2 de entrada y se guarda como 3), title, primary_artists[], collaborators[],
--   release_type, release_date, genres[], countries[], label, radar? (los 5 ejes, enteros 0..5),
--   team_note?, review? y cover_url? (los dos últimos solo los cambia admin). Las claves desconocidas
--   se descartan.
--   - Géneros y países tienen que ser seleccionables (por nombre o alias); se guardan con el nombre
--     canónico. El sello es obligatorio. Artistas y sello que no existen viajan como nombres y se
--     crean al aceptar, en la misma transacción.
--   - Un borrador (create/save) se valida con lo que trae; enviar, corregir y aceptar exigen la
--     propuesta completa.
--
-- "Tomada" (contributions.taken_at): la primera corrección del equipo, marcarla lista o aceptarla,
-- rechazarla o pedir cambios. Desde entonces el autor ya no la edita. Abrirla para mirar no la toma.
-- Reenviarla tras "pedir cambios" la deja otra vez sin tomar.
--
-- Aceptar crea el lanzamiento con apply_catalog_payload y record_catalog_change (historial 'create'),
-- como borrador o publicado. apply_catalog_payload cambia en dos cosas:
--   - un radar vacío ({}) significa "sin radar" (antes fallaba por NOT NULL); un radar incompleto se
--     rechaza;
--   - un género o país nuevo para el lanzamiento tiene que ser seleccionable. Lo que el lanzamiento ya
--     tiene (legado o retirado) se conserva. La reversión del historial está exenta: restaura tal cual.

-- 1. Catálogo: radar opcional y diccionarios cerrados en apply_catalog_payload ------------------------
-- Cuerpo de 20261012120000 (S7) salvo los bloques marcados "U19".
create or replace function private.apply_catalog_payload(p_release_id uuid, p_payload jsonb, p_increment_version boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare p_status text := coalesce(p_payload->>'status', 'draft'); p_version integer; p_radar jsonb := coalesce(p_payload->'radar', '{}'::jsonb); v text;
  v_links jsonb := coalesce(p_payload->'links', '[]'::jsonb); v_cover text := nullif(p_payload->>'cover_url',''); v_keep uuid;
  v_restore boolean := coalesce(current_setting('discotica.catalog_restore', true), '') = 'on'; v_name text;
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
  -- U19: un género o país que el lanzamiento no tenía tiene que ser seleccionable.
  if not v_restore then
    select g.name into v_name from jsonb_array_elements_text(coalesce(p_payload->'genre_ids','[]')) x
      join public.genres g on g.id = x.value::uuid
      where g.status <> 'selectable'
        and not exists (select 1 from public.release_genres rg where rg.release_id = p_release_id and rg.genre_id = g.id)
      limit 1;
    if v_name is not null then
      raise exception 'genre_not_selectable' using errcode = '22023', detail = v_name,
        hint = 'Solo se pueden añadir géneros de la lista; los de legado se conservan donde ya están.';
    end if;
    select c.name into v_name from jsonb_array_elements_text(coalesce(p_payload->'country_ids','[]')) x
      join public.countries c on c.id = x.value::uuid
      where c.status <> 'selectable'
        and not exists (select 1 from public.release_countries rc where rc.release_id = p_release_id and rc.country_id = c.id)
      limit 1;
    if v_name is not null then
      raise exception 'country_not_selectable' using errcode = '22023', detail = v_name,
        hint = 'Solo se pueden añadir países de la lista; los de legado se conservan donde ya están.';
    end if;
  end if;
  -- U19: {} es "sin radar"; si hay radar, lleva los cinco ejes.
  if p_radar <> '{}'::jsonb then
    foreach v in array array['experimental','denso','sintetico','bailable','rapido'] loop
      if coalesce(p_radar->>v, '') !~ '^[0-5]$' then raise exception 'Radar values must be integers from 0 to 5' using errcode = '22023'; end if;
    end loop;
  end if;
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
  -- U19: sin radar en el payload, el lanzamiento queda sin radar.
  if p_radar = '{}'::jsonb then
    delete from public.release_radar where release_id=p_release_id;
  else
    insert into public.release_radar(release_id,experimental,denso,sintetico,bailable,rapido) values(p_release_id,(p_radar->>'experimental')::smallint,(p_radar->>'denso')::smallint,(p_radar->>'sintetico')::smallint,(p_radar->>'bailable')::smallint,(p_radar->>'rapido')::smallint) on conflict(release_id) do update set experimental=excluded.experimental,denso=excluded.denso,sintetico=excluded.sintetico,bailable=excluded.bailable,rapido=excluded.rapido;
  end if;
  -- S7: enlaces y portadas se sincronizan en lugar de borrarse y recrearse.
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

-- La reversión restaura el estado anterior tal cual, aunque tenga valores de legado o retirados.
-- Cuerpo de 20261011190000 (S6) salvo la marca discotica.catalog_restore alrededor de apply.
create or replace function public.admin_revert_catalog_change(p_change_set_id uuid,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.catalog_change_sets%rowtype; e private.catalog_change_events%rowtype; v_current jsonb; v_after jsonb; v_version integer; v_change uuid; v_payload jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into c from private.catalog_change_sets where id=p_change_set_id for update; if not found or c.status<>'applied' then raise exception 'Only an applied change set can be reverted' using errcode='22023'; end if;
  select * into e from private.catalog_change_events where change_set_id=c.id order by id limit 1;
  perform 1 from public.releases where id=c.entity_id for update;
  v_current:=case when found then private.catalog_snapshot(c.entity_id) end;
  if v_current is null or (v_current->>'catalog_version')::integer<>p_expected_version or p_expected_version<>c.result_version then raise exception 'Catalog version conflict; later edits cannot be overwritten' using errcode='40001'; end if;
  if c.operation='create' then update public.releases set status='archived',catalog_version=catalog_version+1,updated_at=now() where id=c.entity_id returning catalog_version into v_version;
  else
    v_payload:=e.before_state - 'id' - 'catalog_version'; v_payload:=jsonb_set(v_payload,'{slug}',to_jsonb(v_current->>'slug'));
    perform set_config('discotica.catalog_restore', 'on', true);
    v_version:=private.apply_catalog_payload(c.entity_id,v_payload);
    perform set_config('discotica.catalog_restore', 'off', true);
  end if;
  v_after:=private.catalog_snapshot(c.entity_id); v_change:=private.record_catalog_change('revert',c.entity_id,p_expected_version,v_version,v_current,v_after,p_reason,c.id); return jsonb_build_object('release_id',c.entity_id,'catalog_version',v_version,'change_set_id',v_change,'reverted_change_set_id',c.id);
end;
$$;

-- 2. Propuestas: columnas y estados ------------------------------------------------------------------
alter table public.contributions add column taken_at timestamptz;
comment on column public.contributions.taken_at is
  'Primera vez que el equipo corrigió, marcó lista, aceptó, rechazó o pidió cambios. Desde entonces el autor no la edita. Se anula al reenviar.';

alter table public.contributions drop constraint contributions_payload_version_check;
alter table public.contributions add constraint contributions_payload_version_check check (payload_version in (1, 2, 3));

alter table public.contribution_events drop constraint contribution_events_action_check;
alter table public.contribution_events add constraint contribution_events_action_check
  check (action in ('created', 'updated', 'submitted', 'corrected', 'prepared_for_admin', 'changes_requested', 'rejected', 'approved'));

-- 3. Validación del contrato v3 ---------------------------------------------------------------------
-- Lista de nombres libres (créditos): cadenas no vacías de hasta 160 caracteres, sin repetir.
create or replace function private.contribution_name_list(p_value jsonb, p_field text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_out jsonb := '[]'::jsonb; v_keys text[] := '{}'; v_item jsonb; v_name text; v_key text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return v_out; end if;
  if jsonb_typeof(p_value) <> 'array' then
    raise exception '%_invalid', p_field using errcode = '22023', hint = 'Debe ser una lista de nombres.';
  end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item) <> 'string' then raise exception '%_invalid', p_field using errcode = '22023', hint = 'Debe ser una lista de nombres.'; end if;
    v_name := normalize(regexp_replace(btrim(v_item #>> '{}'), '\s+', ' ', 'g'), NFC);
    if v_name = '' or char_length(v_name) > 160 then
      raise exception '%_invalid', p_field using errcode = '22023', detail = v_item #>> '{}', hint = 'Cada nombre tiene de 1 a 160 caracteres.';
    end if;
    v_key := private.normalize_catalog_artist_name(v_name);
    if v_key = any (v_keys) then continue; end if;
    v_keys := v_keys || v_key;
    v_out := v_out || to_jsonb(v_name);
  end loop;
  return v_out;
end;
$$;

-- Lista cerrada (géneros o países): cada nombre se resuelve por nombre o alias a un valor
-- seleccionable y se guarda con su nombre canónico.
create or replace function private.contribution_dictionary_list(p_value jsonb, p_field text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_out jsonb := '[]'::jsonb; v_ids uuid[] := '{}'; v_item jsonb; v_row record;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return v_out; end if;
  if jsonb_typeof(p_value) <> 'array' then
    raise exception '%_invalid', p_field using errcode = '22023', hint = 'Debe ser una lista de nombres.';
  end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item) <> 'string' then raise exception '%_invalid', p_field using errcode = '22023', hint = 'Debe ser una lista de nombres.'; end if;
    v_row := null;
    if p_field = 'genres' then
      select r.id, r.name, r.status into v_row from private.resolve_catalog_genre(v_item #>> '{}') r;
    else
      select r.id, r.name, r.status into v_row from private.resolve_catalog_country(v_item #>> '{}') r;
    end if;
    if v_row.id is null or v_row.status <> 'selectable' then
      raise exception '%', case p_field when 'genres' then 'genre_not_selectable' else 'country_not_selectable' end
        using errcode = '22023', detail = v_item #>> '{}', hint = 'Elige un valor de la lista.';
    end if;
    if v_row.id = any (v_ids) then continue; end if;
    v_ids := v_ids || v_row.id;
    v_out := v_out || to_jsonb(v_row.name);
  end loop;
  return v_out;
end;
$$;

-- p_complete: false para borradores (se valida lo que hay), true para enviar, corregir y aceptar.
-- p_editor: 'author', 'collaborator' o 'admin'. Solo admin cambia review y cover_url; los demás
-- conservan los de p_current.
create or replace function private.contribution_payload_v3(p_payload jsonb, p_complete boolean, p_editor text, p_current jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := jsonb_build_object('version', 3);
  v_text text;
  v_axis text;
  v_radar jsonb;
  v_field text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_invalid' using errcode = '22023', hint = 'La propuesta debe ser un objeto.';
  end if;
  if coalesce(p_payload->>'version', '') not in ('2', '3') then
    raise exception 'payload_version_invalid' using errcode = '22023', hint = 'La propuesta debe ser de la versión 2 o 3.';
  end if;
  if p_editor not in ('author', 'collaborator', 'admin') then
    raise exception 'Invalid payload editor' using errcode = '22023';
  end if;
  foreach v_field in array array['title', 'label', 'release_type', 'release_date', 'team_note', 'review', 'cover_url'] loop
    if jsonb_typeof(p_payload->v_field) not in ('string', 'null') then
      raise exception '%_invalid', v_field using errcode = '22023', hint = 'Debe ser texto.';
    end if;
  end loop;

  v_text := normalize(regexp_replace(btrim(coalesce(p_payload->>'title', '')), '\s+', ' ', 'g'), NFC);
  if char_length(v_text) > 300 then raise exception 'title_invalid' using errcode = '22023', hint = 'El título tiene hasta 300 caracteres.'; end if;
  if p_complete and v_text = '' then raise exception 'title_required' using errcode = '22023'; end if;
  v := v || jsonb_build_object('title', v_text);

  v := v || jsonb_build_object('primary_artists', private.contribution_name_list(p_payload->'primary_artists', 'primary_artists'));
  v := v || jsonb_build_object('collaborators', private.contribution_name_list(p_payload->'collaborators', 'collaborators'));
  if p_complete and jsonb_array_length(v->'primary_artists') = 0 then
    raise exception 'primary_artists_required' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(v->'primary_artists') a join jsonb_array_elements_text(v->'collaborators') b
             on private.normalize_catalog_artist_name(a) = private.normalize_catalog_artist_name(b)) then
    raise exception 'credit_in_both_groups' using errcode = '22023', hint = 'Un artista no puede ser principal y colaborador a la vez.';
  end if;

  v_text := coalesce(p_payload->>'release_type', '');
  if v_text <> '' and v_text not in ('album', 'ep', 'single', 'compilado', 'sample-pack') then
    raise exception 'release_type_invalid' using errcode = '22023', detail = v_text;
  end if;
  if p_complete and v_text = '' then raise exception 'release_type_required' using errcode = '22023'; end if;
  v := v || jsonb_build_object('release_type', v_text);

  v_text := btrim(coalesce(p_payload->>'release_date', ''));
  if v_text <> '' then
    begin
      if v_text !~ '^\d{4}-\d{2}-\d{2}$' or to_char(v_text::date, 'YYYY-MM-DD') <> v_text then raise exception 'bad date'; end if;
    exception when others then
      raise exception 'release_date_invalid' using errcode = '22023', detail = v_text, hint = 'Usa AAAA-MM-DD.';
    end;
  end if;
  if p_complete and v_text = '' then raise exception 'release_date_required' using errcode = '22023'; end if;
  v := v || jsonb_build_object('release_date', v_text);

  v := v || jsonb_build_object('genres', private.contribution_dictionary_list(p_payload->'genres', 'genres'));
  v := v || jsonb_build_object('countries', private.contribution_dictionary_list(p_payload->'countries', 'countries'));
  if p_complete and jsonb_array_length(v->'genres') = 0 then raise exception 'genres_required' using errcode = '22023'; end if;
  if p_complete and jsonb_array_length(v->'countries') = 0 then raise exception 'countries_required' using errcode = '22023'; end if;

  v_text := normalize(regexp_replace(btrim(coalesce(p_payload->>'label', '')), '\s+', ' ', 'g'), NFC);
  if char_length(v_text) > 160 then raise exception 'label_invalid' using errcode = '22023', hint = 'El sello tiene hasta 160 caracteres.'; end if;
  if p_complete and v_text = '' then raise exception 'label_required' using errcode = '22023'; end if;
  v := v || jsonb_build_object('label', v_text);

  if jsonb_typeof(p_payload->'radar') = 'object' then
    if (select count(*) from jsonb_object_keys(p_payload->'radar')) <> 5 then
      raise exception 'radar_invalid' using errcode = '22023', hint = 'El radar lleva los cinco ejes, de 0 a 5.';
    end if;
    v_radar := '{}'::jsonb;
    foreach v_axis in array array['experimental', 'denso', 'sintetico', 'bailable', 'rapido'] loop
      if jsonb_typeof(p_payload->'radar'->v_axis) <> 'number' or (p_payload->'radar'->>v_axis) !~ '^[0-5]$' then
        raise exception 'radar_invalid' using errcode = '22023', detail = v_axis, hint = 'El radar lleva los cinco ejes, de 0 a 5.';
      end if;
      v_radar := v_radar || jsonb_build_object(v_axis, (p_payload->'radar'->>v_axis)::int);
    end loop;
    v := v || jsonb_build_object('radar', v_radar);
  elsif p_payload ? 'radar' and jsonb_typeof(p_payload->'radar') <> 'null' then
    raise exception 'radar_invalid' using errcode = '22023', hint = 'El radar lleva los cinco ejes, de 0 a 5.';
  end if;

  v_text := btrim(coalesce(p_payload->>'team_note', ''));
  if char_length(v_text) > 4000 then raise exception 'team_note_invalid' using errcode = '22023', hint = 'La nota tiene hasta 4000 caracteres.'; end if;
  if v_text <> '' then v := v || jsonb_build_object('team_note', v_text); end if;

  -- Reseña y portada: solo admin las cambia. Los demás conservan las que haya.
  foreach v_field in array array['review', 'cover_url'] loop
    v_text := btrim(coalesce(p_payload->>v_field, ''));
    if p_editor <> 'admin' then
      if v_text <> '' and v_text is distinct from btrim(coalesce(p_current->>v_field, '')) then
        raise exception 'field_not_allowed' using errcode = '42501', detail = v_field, hint = 'Solo admin cambia la reseña y la portada.';
      end if;
      v_text := btrim(coalesce(p_current->>v_field, ''));
    end if;
    if v_field = 'review' and char_length(v_text) > 20000 then raise exception 'review_invalid' using errcode = '22023'; end if;
    if v_field = 'cover_url' and v_text <> '' and v_text !~* '^https://' then
      raise exception 'cover_url_invalid' using errcode = '22023', hint = 'La portada usa una URL HTTPS.';
    end if;
    if v_text <> '' then v := v || jsonb_build_object(v_field, v_text); end if;
  end loop;
  return v;
end;
$$;

-- 4. Autor: borrador, envío y edición mientras nadie la tome ------------------------------------------
create or replace function public.create_contribution_draft(p_source_url text, p_source_provider text, p_payload jsonb default '{}'::jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_payload jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if coalesce(p_source_url, '') !~* '^https://' or jsonb_typeof(p_detected_metadata) is distinct from 'object' then
    raise exception 'Valid source URL and object payloads are required' using errcode='22023';
  end if;
  v_payload := private.contribution_payload_v3(coalesce(nullif(p_payload, '{}'::jsonb), '{"version":3}'::jsonb), false, 'author');
  insert into public.contributions(author_id,status,source_url,source_provider,payload,payload_version,payload_quality,detected_metadata)
  values((select auth.uid()),'draft',btrim(p_source_url),nullif(btrim(coalesce(p_source_provider,'')),''),v_payload,3,'confirmed',p_detected_metadata)
  returning * into c;
  perform private.record_contribution_transition(c.id, 'created', null, c.payload);
  return c;
end;
$$;

create or replace function public.save_contribution_draft(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_payload jsonb;
begin
  select * into c from public.contributions where id=p_contribution_id for update;
  if not found or c.author_id is distinct from (select auth.uid()) or c.status <> 'draft' then raise exception 'Only the author may edit a draft' using errcode='42501'; end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_detected_metadata) is distinct from 'object' then raise exception 'Valid source URL and object payloads are required' using errcode='22023'; end if;
  v_payload := private.contribution_payload_v3(p_payload, false, 'author', c.payload);
  v_before:=c.payload;
  update public.contributions set source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=v_payload,payload_version=3,payload_quality='confirmed',detected_metadata=p_detected_metadata,updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id, 'updated', v_before, c.payload);
  return c;
end;
$$;

create or replace function public.submit_contribution(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_role text; v_payload jsonb;
begin
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found then raise exception 'Contribution not found' using errcode='P0002'; end if;
  if c.author_id is distinct from (select auth.uid()) then raise exception 'Only the author may submit a contribution' using errcode='42501'; end if;
  if c.status not in ('draft','changes_requested') then raise exception 'Only draft or requested-change submissions may be sent' using errcode='22023'; end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_detected_metadata) is distinct from 'object' then raise exception 'Valid source URL and detected metadata are required' using errcode='22023'; end if;
  select profile.role into v_role from public.profiles as profile where profile.id = c.author_id;
  if v_role is null or v_role not in ('comunidad','colaborador') then raise exception 'Author role is invalid' using errcode='42501'; end if;
  v_payload := private.contribution_payload_v3(p_payload, true, 'author', c.payload);
  v_before:=c.payload;
  update public.contributions as contribution set status='pending',source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=v_payload,payload_version=3,payload_quality='confirmed',detected_metadata=p_detected_metadata,queue_kind=case when v_role='colaborador' then 'collaborator' else 'community' end,submitted_at=now(),taken_at=null,reviewer_note=null,reviewed_by=null,reviewed_at=null,updated_at=now() where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id, 'submitted', v_before, c.payload);
  return c;
end;
$$;

create or replace function public.update_submitted_contribution(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_payload jsonb;
begin
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found then raise exception 'Contribution not found' using errcode='P0002'; end if;
  if c.author_id is distinct from (select auth.uid()) then raise exception 'Only the author may edit a submitted contribution' using errcode='42501'; end if;
  if c.status <> 'pending' then raise exception 'Only a pending contribution can be edited by its author' using errcode='22023'; end if;
  if c.taken_at is not null then
    raise exception 'contribution_taken' using errcode='55000', hint = 'El equipo ya está revisando esta propuesta.';
  end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_detected_metadata) is distinct from 'object' then raise exception 'Valid source URL and detected metadata are required' using errcode='22023'; end if;
  v_payload := private.contribution_payload_v3(p_payload, true, 'author', c.payload);
  v_before:=c.payload;
  update public.contributions as contribution set source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=v_payload,payload_version=3,payload_quality='confirmed',detected_metadata=p_detected_metadata,updated_at=now() where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id, 'updated', v_before, c.payload);
  return c;
end;
$$;

-- 5. Equipo: corrección, lista para admin, aceptar y revisar --------------------------------------------
-- Bloquea la propuesta y decide si el usuario actual (admin o colaborador) puede corregirla.
create or replace function private.lock_contribution_for_team(p_contribution_id uuid)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype;
begin
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found then raise exception 'Contribution not found' using errcode='P0002'; end if;
  if (select private.is_admin()) then
    if c.status not in ('pending','ready_for_admin') then raise exception 'Only pending or ready_for_admin contributions can be corrected' using errcode='22023'; end if;
  elsif (select private.is_collaborator()) then
    if c.queue_kind is distinct from 'community' or c.status <> 'pending' or c.author_id = (select auth.uid()) then
      raise exception 'Only another community pending contribution can be corrected' using errcode='42501';
    end if;
  else
    raise exception 'Collaborator or administrative role required' using errcode='42501';
  end if;
  return c;
end;
$$;

create or replace function public.save_contribution_correction(p_contribution_id uuid, p_expected_updated_at timestamptz, p_payload jsonb, p_source_url text default null, p_source_provider text default null, p_note text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_payload jsonb; v_url text;
begin
  c := private.lock_contribution_for_team(p_contribution_id);
  if p_expected_updated_at is null or c.updated_at is distinct from p_expected_updated_at then
    raise exception 'contribution_version_conflict' using errcode='40001', hint = 'Alguien guardó la propuesta después de que la abriste.';
  end if;
  v_url := coalesce(nullif(btrim(coalesce(p_source_url, '')), ''), c.source_url);
  if v_url !~* '^https://' then raise exception 'Valid source URL is required' using errcode='22023'; end if;
  v_payload := private.contribution_payload_v3(p_payload, true, case when (select private.is_admin()) then 'admin' else 'collaborator' end, c.payload);
  v_before := c.payload;
  update public.contributions as contribution
  set payload=v_payload, payload_version=3, payload_quality='confirmed', source_url=v_url,
      source_provider=case when p_source_url is null then contribution.source_provider else nullif(btrim(coalesce(p_source_provider,'')),'') end,
      taken_at=coalesce(contribution.taken_at, now()), updated_at=now()
  where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id, 'corrected', v_before, c.payload, p_note);
  return c;
end;
$$;

-- Firma de E09. Con p_working_payload no vacío, guarda primero esa corrección.
create or replace function public.prepare_contribution_for_admin(p_contribution_id uuid, p_working_payload jsonb default '{}'::jsonb, p_internal_note text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_payload jsonb;
begin
  if not (select private.is_collaborator()) then raise exception 'Collaborator role required' using errcode='42501'; end if;
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found or c.status <> 'pending' or c.queue_kind is distinct from 'community' or c.author_id=(select auth.uid()) then raise exception 'Only another community pending contribution can be prepared' using errcode='42501'; end if;
  if jsonb_typeof(p_working_payload) is distinct from 'object' then raise exception 'Working payload must be an object' using errcode='22023'; end if;
  if p_working_payload <> '{}'::jsonb then
    v_payload := private.contribution_payload_v3(p_working_payload, true, 'collaborator', c.payload);
    v_before := c.payload;
    update public.contributions as contribution set payload=v_payload, payload_version=3, payload_quality='confirmed', updated_at=now()
    where contribution.id=c.id returning contribution.* into c;
    perform private.record_contribution_transition(c.id, 'corrected', v_before, c.payload, p_internal_note);
  end if;
  insert into private.contribution_preparations(contribution_id,collaborator_id,working_payload,internal_note) values(c.id,(select auth.uid()),p_working_payload,nullif(btrim(coalesce(p_internal_note,'')),'')) on conflict(contribution_id) do update set collaborator_id=excluded.collaborator_id,working_payload=excluded.working_payload,internal_note=excluded.internal_note,updated_at=now();
  update public.contributions as contribution set status='ready_for_admin', taken_at=coalesce(contribution.taken_at, now()), updated_at=now() where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id, 'prepared_for_admin', c.payload, c.payload, 'Prepared for admin');
  return c;
end;
$$;

-- Payload del catálogo (UUID) a partir de una propuesta v3 completa. Crea artistas y sello que no
-- existen; géneros y países ya vienen resueltos a seleccionables.
create or replace function private.catalog_payload_from_suggestion(p jsonb, p_source_url text, p_source_provider text, p_detected jsonb, p_status text, p_slug_seed text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_type_id uuid; v_artist_ids jsonb := '[]'; v_collaborator_ids jsonb := '[]'; v_genre_ids jsonb := '[]'; v_country_ids jsonb := '[]';
  v_name text; v_id uuid; v_slug text; v_cover text; v_row record;
begin
  select id into v_type_id from public.release_types where slug = p->>'release_type';
  if v_type_id is null then raise exception 'Canonical release type is not configured' using errcode='23503'; end if;
  for v_name in select value from jsonb_array_elements_text(p->'primary_artists') loop
    v_artist_ids := v_artist_ids || to_jsonb(private.ensure_catalog_artist(v_name));
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'collaborators') loop
    v_id := private.ensure_catalog_artist(v_name);
    if v_artist_ids ? v_id::text then raise exception 'credit_in_both_groups' using errcode='22023', detail = v_name; end if;
    v_collaborator_ids := v_collaborator_ids || to_jsonb(v_id);
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'genres') loop
    select r.id, r.status into v_row from private.resolve_catalog_genre(v_name) r;
    if v_row.id is null or v_row.status <> 'selectable' then raise exception 'genre_not_selectable' using errcode='22023', detail = v_name; end if;
    if not v_genre_ids ? v_row.id::text then v_genre_ids := v_genre_ids || to_jsonb(v_row.id); end if;
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'countries') loop
    select r.id, r.status into v_row from private.resolve_catalog_country(v_name) r;
    if v_row.id is null or v_row.status <> 'selectable' then raise exception 'country_not_selectable' using errcode='22023', detail = v_name; end if;
    if not v_country_ids ? v_row.id::text then v_country_ids := v_country_ids || to_jsonb(v_row.id); end if;
  end loop;
  v_slug := trim(both '-' from regexp_replace(private.normalize_catalog_dictionary_name(p->>'title'), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'lanzamiento'; end if;
  v_slug := left(v_slug, 80);
  v_slug := trim(both '-' from v_slug) || '--' || substr(md5(p_slug_seed), 1, 8);
  v_cover := coalesce(nullif(p->>'cover_url', ''), case when coalesce(p_detected->>'cover_url', '') ~* '^https://' then p_detected->>'cover_url' end);
  return jsonb_build_object(
    'slug', v_slug, 'title', p->>'title', 'release_date', p->>'release_date', 'release_type_id', v_type_id,
    'label_id', private.ensure_catalog_label(p->>'label', p_reason),
    'review', coalesce(p->>'review', p->>'team_note', ''), 'status', p_status, 'credit_quality', 'proposed',
    'artist_ids', v_artist_ids, 'collaborator_ids', v_collaborator_ids, 'genre_ids', v_genre_ids, 'country_ids', v_country_ids,
    'links', jsonb_build_array(jsonb_build_object('provider', coalesce(nullif(btrim(coalesce(p_source_provider, '')), ''), 'manual'), 'url', btrim(p_source_url), 'is_primary', true)),
    'cover_url', v_cover, 'radar', coalesce(p->'radar', '{}'::jsonb));
end;
$$;

-- Crea el lanzamiento con el mismo camino que admin_create_catalog_release: nace en borrador y
-- apply_catalog_payload fija el estado con sus validaciones; queda una entrada 'create' en el historial.
create or replace function private.create_release_from_catalog_payload(p_payload jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer; v_after jsonb; v_change uuid;
begin
  if exists (select 1 from public.releases where slug = p_payload->>'slug') or exists (select 1 from public.release_slug_aliases where slug = p_payload->>'slug') then
    raise exception 'Slug collides with a canonical slug or visible alias' using errcode = '23505';
  end if;
  insert into public.releases(slug,title,status,credit_quality) values(p_payload->>'slug',btrim(p_payload->>'title'),'draft','proposed') returning id into v_id;
  v_version := private.apply_catalog_payload(v_id, p_payload, false);
  v_after := private.catalog_snapshot(v_id);
  v_change := private.record_catalog_change('create', v_id, null, v_version, null, v_after, p_reason);
  return jsonb_build_object('release_id', v_id, 'release_slug', p_payload->>'slug', 'status', v_after->>'status', 'catalog_version', v_version, 'change_set_id', v_change);
end;
$$;

create or replace function private.accept_contribution_core(p_contribution_id uuid, p_publish boolean, p_expected_updated_at timestamptz, p_check_version boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_payload jsonb; v_catalog jsonb; v_result jsonb; v_reason text; v_before jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_publish is null then raise exception 'Choose draft or publish' using errcode='22023'; end if;
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found then raise exception 'Contribution not found' using errcode='P0002'; end if;
  if c.status not in ('pending','ready_for_admin') then raise exception 'Only pending or ready_for_admin contributions can be reviewed' using errcode='22023'; end if;
  if p_check_version and (p_expected_updated_at is null or c.updated_at is distinct from p_expected_updated_at) then
    raise exception 'contribution_version_conflict' using errcode='40001', hint = 'Alguien guardó la propuesta después de que la abriste.';
  end if;
  if c.payload_version < 2 or c.payload_quality <> 'confirmed' then raise exception 'Legacy payload requires author confirmation before publication' using errcode='22023'; end if;
  v_payload := private.contribution_payload_v3(c.payload, true, 'admin');
  v_reason := coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Propuesta aceptada') || ' (propuesta ' || c.id || ')';
  v_catalog := private.catalog_payload_from_suggestion(v_payload, c.source_url, c.source_provider, c.detected_metadata,
    case when p_publish then 'published' else 'draft' end, c.id::text, v_reason);
  v_result := private.create_release_from_catalog_payload(v_catalog, v_reason);
  v_before := c.payload;
  update public.contributions as contribution
  set status='approved', payload=v_payload, payload_version=3, reviewer_note=nullif(btrim(coalesce(p_note,'')),''), reviewed_by=(select auth.uid()), reviewed_at=now(),
      release_id=(v_result->>'release_id')::uuid, taken_at=coalesce(contribution.taken_at, now()), updated_at=now()
  where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id, 'approved', v_before, c.payload,
    coalesce(c.reviewer_note || ' · ', '') || case when p_publish then 'Aceptada y publicada' else 'Aceptada como borrador' end);
  return v_result || jsonb_build_object('contribution_id', c.id);
end;
$$;

create or replace function public.accept_contribution(p_contribution_id uuid, p_publish boolean, p_expected_updated_at timestamptz, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.accept_contribution_core(p_contribution_id, p_publish, p_expected_updated_at, true, p_note);
end;
$$;

-- Firma de E09. 'approved' acepta y publica (como antes); rechazar y pedir cambios no cambian salvo
-- que marcan la propuesta como tomada.
create or replace function public.review_contribution(p_contribution_id uuid, p_action text, p_note text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('approved','rejected','changes_requested') then raise exception 'Invalid review action' using errcode='22023'; end if;
  if p_action = 'approved' then
    perform private.accept_contribution_core(p_contribution_id, true, null, false, p_note);
    select * into c from public.contributions where id = p_contribution_id;
    return c;
  end if;
  select contribution.* into c from public.contributions as contribution where contribution.id = p_contribution_id for update;
  if not found or c.status not in ('pending','ready_for_admin') then raise exception 'Only pending or ready_for_admin contributions can be reviewed' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A reviewer note is required' using errcode='22023'; end if;
  update public.contributions as contribution set status=p_action,reviewer_note=btrim(p_note),reviewed_by=(select auth.uid()),reviewed_at=now(),taken_at=coalesce(contribution.taken_at, now()),updated_at=now()
  where contribution.id=c.id returning contribution.* into c;
  perform private.record_contribution_transition(c.id,p_action,c.payload,c.payload,c.reviewer_note);
  return c;
end;
$$;

-- 6. Alta directa de admin desde Sugerir: un borrador del catálogo, sin cola -------------------------
create or replace function public.admin_create_draft_from_suggestion(p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb; v_reason text; v_catalog jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if coalesce(p_source_url, '') !~* '^https://' or jsonb_typeof(p_detected_metadata) is distinct from 'object' then
    raise exception 'Valid source URL and detected metadata are required' using errcode='22023';
  end if;
  v_payload := private.contribution_payload_v3(p_payload, true, 'admin');
  v_reason := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Alta desde Sugerir');
  v_catalog := private.catalog_payload_from_suggestion(v_payload, p_source_url, p_source_provider, p_detected_metadata, 'draft', gen_random_uuid()::text, v_reason);
  return private.create_release_from_catalog_payload(v_catalog, v_reason);
end;
$$;

-- 7. Duplicados por enlace ---------------------------------------------------------------------------
-- Clave de comparación de un enlace: https, host en minúsculas, sin consulta, fragmento, barra final
-- ni el segmento /intl-xx de Spotify. La ruta conserva mayúsculas (los ID de Spotify las distinguen).
create or replace function private.normalize_source_url(p_url text)
returns text language plpgsql immutable strict set search_path = '' as $$
declare v text := btrim(p_url); m text[];
begin
  v := regexp_replace(v, '[?#].*$', '');
  m := regexp_match(v, '^(?:[a-z][a-z0-9+.-]*://)?([^/]+)(/.*)?$', 'i');
  if m is null then return lower(v); end if;
  return 'https://' || lower(m[1]) || regexp_replace(regexp_replace(coalesce(m[2], ''), '^/intl-[a-z]{2}(?:-[a-z]{2})?(/|$)', '/', 'i'), '/+$', '');
end;
$$;
revoke all on function private.normalize_source_url(text) from public, anon, authenticated;

create index release_links_normalized_url_idx on public.release_links (private.normalize_source_url(url));
create index contributions_normalized_source_url_idx on public.contributions (private.normalize_source_url(source_url));

-- Dice si un enlace ya está en el catálogo o en la cola. Nunca expone propuestas ajenas: la ficha
-- solo sale si está publicada, el UUID del lanzamiento solo para admin y el de la propuesta solo
-- para su autor o admin.
create or replace function public.check_source_duplicate(p_source_url text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_key text; v_uid uuid := (select auth.uid()); v_admin boolean; r record;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if coalesce(btrim(p_source_url), '') !~* '^https?://' then raise exception 'Valid source URL is required' using errcode='22023'; end if;
  v_key := private.normalize_source_url(p_source_url);
  v_admin := (select private.is_admin());
  select rel.id, rel.slug, rel.status into r
  from public.release_links rl join public.releases rel on rel.id = rl.release_id
  where private.normalize_source_url(rl.url) = v_key
  order by (rel.status = 'published') desc, (rel.status = 'draft') desc, rel.created_at
  limit 1;
  if found then
    return jsonb_build_object('match', 'catalog', 'state', r.status,
      'release_slug', case when r.status = 'published' then r.slug end,
      'release_id', case when v_admin then r.id end,
      'contribution_id', null);
  end if;
  select c.id, c.status, c.author_id into r
  from public.contributions c
  where private.normalize_source_url(c.source_url) = v_key
    and (c.status in ('pending', 'ready_for_admin', 'changes_requested') or (c.status = 'draft' and c.author_id = v_uid))
  order by (c.author_id = v_uid) desc, c.created_at
  limit 1;
  if found then
    return jsonb_build_object('match', 'queue', 'state', r.status, 'release_slug', null, 'release_id', null,
      'contribution_id', case when v_admin or r.author_id = v_uid then r.id end);
  end if;
  return jsonb_build_object('match', 'none', 'state', null, 'release_slug', null, 'release_id', null, 'contribution_id', null);
end;
$$;

-- 8. Permisos --------------------------------------------------------------------------------------
revoke all on function private.contribution_name_list(jsonb, text), private.contribution_dictionary_list(jsonb, text),
  private.contribution_payload_v3(jsonb, boolean, text, jsonb), private.lock_contribution_for_team(uuid),
  private.catalog_payload_from_suggestion(jsonb, text, text, jsonb, text, text, text),
  private.create_release_from_catalog_payload(jsonb, text),
  private.accept_contribution_core(uuid, boolean, timestamptz, boolean, text)
  from public, anon, authenticated;

revoke all on function public.create_contribution_draft(text,text,jsonb,jsonb), public.save_contribution_draft(uuid,text,text,jsonb,jsonb),
  public.submit_contribution(uuid,text,text,jsonb,jsonb), public.update_submitted_contribution(uuid,text,text,jsonb,jsonb),
  public.save_contribution_correction(uuid,timestamptz,jsonb,text,text,text), public.prepare_contribution_for_admin(uuid,jsonb,text),
  public.accept_contribution(uuid,boolean,timestamptz,text), public.review_contribution(uuid,text,text),
  public.admin_create_draft_from_suggestion(text,text,jsonb,jsonb,text), public.check_source_duplicate(text),
  public.admin_revert_catalog_change(uuid,integer,text)
  from public, anon, authenticated;
grant execute on function public.create_contribution_draft(text,text,jsonb,jsonb), public.save_contribution_draft(uuid,text,text,jsonb,jsonb),
  public.submit_contribution(uuid,text,text,jsonb,jsonb), public.update_submitted_contribution(uuid,text,text,jsonb,jsonb),
  public.save_contribution_correction(uuid,timestamptz,jsonb,text,text,text), public.prepare_contribution_for_admin(uuid,jsonb,text),
  public.accept_contribution(uuid,boolean,timestamptz,text), public.review_contribution(uuid,text,text),
  public.admin_create_draft_from_suggestion(text,text,jsonb,jsonb,text), public.check_source_duplicate(text),
  public.admin_revert_catalog_change(uuid,integer,text)
  to authenticated;

-- La validación v2 ya no se usa: la sustituye contribution_payload_v3.
drop function private.assert_contribution_payload_v2(jsonb);

-- Aceptar escribe su propia entrada 'create' en el historial (create_release_from_catalog_payload):
-- el puente de compatibilidad de E06 la duplicaría.
drop trigger audit_legacy_contribution_publication on public.contributions;
drop function private.audit_legacy_contribution_publication();
