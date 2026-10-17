-- U19 G1 (3/3): la importación de la hoja con listas cerradas. Expediente:
-- docs/modernizacion/u19-estudio-flujo-2026-10-15.md (G1, punto 8).
--
-- private.import_catalog_release (cuerpo de 20261014203000 salvo los bloques marcados "U19"):
--   - géneros y países se resuelven por nombre o alias y tienen que ser seleccionables o de legado;
--     uno desconocido o retirado aborta con un error legible (genre_unknown / country_unknown) y no
--     se crea. scripts/import-catalog.mjs valida antes contra los mismos diccionarios y convierte
--     esos casos en filas rechazadas, así que este error es la última barrera;
--   - sello y artistas se resuelven también por alias antes de crearse.
-- private.prune_unused_catalog_dictionaries ya no borra géneros ni países de las listas: solo
-- artistas, sellos y géneros o países retirados que ningún lanzamiento usa.

create or replace function private.import_catalog_release(payload jsonb)
returns table (imported_release_id uuid, action text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p_source_name text := btrim(payload ->> 'source_name');
  p_source_key text := btrim(payload ->> 'source_key');
  p_source_hash text := btrim(payload ->> 'source_hash');
  p_slug text := btrim(payload ->> 'slug');
  p_legacy_slug text := btrim(payload ->> 'legacy_slug');
  p_title text := btrim(payload ->> 'title');
  p_review text := coalesce(payload ->> 'review', '');
  p_status text := coalesce(payload ->> 'status', 'published');
  p_credit_quality text := coalesce(nullif(btrim(payload ->> 'credit_quality'), ''), 'legacy');
  p_primary_artists jsonb;
  p_collaborators jsonb;
  p_type_slug text;
  p_date date;
  p_release_id uuid;
  p_action text;
  p_type_id uuid;
  p_label_id uuid;
  v_cur public.releases%rowtype;
  v_archived_missing_at timestamptz;
  v_credits jsonb := '[]'::jsonb;
  v_genre_ids uuid[] := '{}';
  v_country_ids uuid[] := '{}';
  v_link text := nullif(btrim(payload ->> 'buy_link'), '');
  v_provider text := btrim(payload ->> 'provider');
  v_cover text := nullif(btrim(payload ->> 'cover'), '');
  v_keep uuid;
  v_rows integer;
  v_changed boolean := false;
  v_credits_changed boolean := false;
  v_status text;
  v_dict_id uuid;
  v_dict_status text;
  entry jsonb;
  entity_id uuid;
  entity_name text;
  entity_key text;
  entity_slug text;
begin
  if p_source_name = '' or p_source_key = '' or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'source_name, source_key and source_hash SHA-256 are required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'
    or p_legacy_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' then
    raise exception 'slug and legacy_slug must be canonical ASCII slugs';
  end if;

  p_primary_artists := case
    when jsonb_typeof(payload -> 'primary_artists') = 'array' then payload -> 'primary_artists'
    else payload -> 'artists'
  end;
  p_collaborators := coalesce(payload -> 'collaborators', '[]'::jsonb);

  if p_title = ''
    or jsonb_typeof(p_primary_artists) <> 'array'
    or jsonb_array_length(p_primary_artists) = 0 then
    raise exception 'title and at least one primary artist are required';
  end if;
  if jsonb_typeof(p_collaborators) <> 'array' then
    raise exception 'collaborators must be an array';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'invalid release status: %', p_status;
  end if;
  if p_credit_quality not in ('legacy', 'proposed', 'verified') then
    raise exception 'invalid credit quality: %', p_credit_quality using errcode = '22023';
  end if;
  if nullif(payload ->> 'release_date', '') is not null then
    begin
      p_date := (payload ->> 'release_date')::date;
    exception when others then
      raise exception 'release_date must use ISO YYYY-MM-DD';
    end;
  end if;
  if v_link is not null and v_link !~* '^https?://' then
    raise exception 'buy_link must be an http(s) URL';
  end if;
  if v_link is not null and v_provider = '' then
    raise exception 'provider is required with buy_link';
  end if;
  if v_cover is not null and v_cover !~* '^https?://' then
    raise exception 'cover must be an http(s) URL';
  end if;

  p_type_slug := private.canonical_release_type_slug(payload ->> 'type');
  if p_type_slug is null then
    raise exception 'Tipo de lanzamiento inválido. Permitidos: Álbum, EP, Single, Compilado, Sample Pack.'
      using errcode = '22023';
  end if;
  select id into p_type_id
  from public.release_types
  where slug = p_type_slug;
  if p_type_id is null then
    raise exception 'El tipo canónico % no está configurado.', p_type_slug;
  end if;

  select cik.release_id, cik.archived_missing_at into p_release_id, v_archived_missing_at
  from public.catalog_import_keys cik
  where cik.source_name = p_source_name and cik.source_key = p_source_key
  for update;

  -- Diccionarios: insertar solo lo que falta. Un nombre que ya existe (por normalized_name) no se
  -- escribe, así una fila sin cambios no toca los diccionarios.
  entity_name := btrim(payload ->> 'label');
  entity_key := btrim(payload ->> 'label_key');
  entity_slug := btrim(payload ->> 'label_slug');
  if entity_name = '' or entity_key = '' then raise exception 'label is required'; end if;
  -- U19: el sello y los artistas se resuelven primero por nombre o alias; solo se crean si no existen.
  select r.id into p_label_id from private.resolve_catalog_label(entity_name) r;
  if p_label_id is null then
    with ins as (
      insert into public.labels (name, normalized_name, slug)
      values (entity_name, entity_key, entity_slug)
      on conflict (normalized_name) do nothing
      returning id
    )
    select id into p_label_id from (
      select id from ins
      union all
      select l.id from public.labels l where l.normalized_name = entity_key
    ) found limit 1;
  end if;

  for idx in 0 .. jsonb_array_length(p_primary_artists) - 1 loop
    entry := p_primary_artists -> idx;
    entity_name := btrim(entry ->> 'name');
    entity_key := btrim(entry ->> 'key');
    entity_slug := btrim(entry ->> 'slug');
    if entity_name = '' or entity_key = '' then raise exception 'primary artist % is invalid', idx + 1; end if;
    select r.id into entity_id from private.resolve_catalog_artist(entity_name) r;
    if entity_id is null then
      with ins as (
        insert into public.artists (name, normalized_name, slug)
        values (entity_name, entity_key, entity_slug)
        on conflict (normalized_name) do nothing
        returning id
      )
      select id into entity_id from (
        select id from ins
        union all
        select a.id from public.artists a where a.normalized_name = entity_key
      ) found limit 1;
    end if;
    v_credits := v_credits || jsonb_build_array(jsonb_build_object('artist_id', entity_id, 'role', 'primary', 'position', idx));
  end loop;

  if jsonb_array_length(p_collaborators) > 0 then
    for idx in 0 .. jsonb_array_length(p_collaborators) - 1 loop
      entry := p_collaborators -> idx;
      entity_name := btrim(entry ->> 'name');
      entity_key := btrim(entry ->> 'key');
      entity_slug := btrim(entry ->> 'slug');
      if entity_name = '' or entity_key = '' then raise exception 'collaborator % is invalid', idx + 1; end if;
      select r.id into entity_id from private.resolve_catalog_artist(entity_name) r;
      if entity_id is null then
        with ins as (
          insert into public.artists (name, normalized_name, slug)
          values (entity_name, entity_key, entity_slug)
          on conflict (normalized_name) do nothing
          returning id
        )
        select id into entity_id from (
          select id from ins
          union all
          select a.id from public.artists a where a.normalized_name = entity_key
        ) found limit 1;
      end if;
      if exists (select 1 from jsonb_array_elements(v_credits) c where (c ->> 'artist_id')::uuid = entity_id) then
        raise exception 'An artist cannot be both primary and collaborator: %', entity_name
          using errcode = '23505';
      end if;
      v_credits := v_credits || jsonb_build_array(jsonb_build_object('artist_id', entity_id, 'role', 'collaborator', 'position', idx));
    end loop;
  end if;

  -- U19: géneros y países con lista cerrada. Se aceptan los seleccionables y los de legado, por
  -- nombre o alias; nunca se crean.
  for entry in select value from jsonb_array_elements(coalesce(payload -> 'genres', '[]'::jsonb)) loop
    entity_name := btrim(entry ->> 'name');
    if coalesce(entity_name, '') = '' then raise exception 'invalid genre'; end if;
    v_dict_id := null; v_dict_status := null;
    select r.id, r.status into v_dict_id, v_dict_status from private.resolve_catalog_genre(entity_name) r;
    if v_dict_id is null or v_dict_status = 'retired' then
      raise exception 'genre_unknown' using errcode = '22023', detail = format('%s (clave %s)', entity_name, p_source_key),
        hint = 'La importación no crea géneros: corrige la hoja o pide el valor a admin.';
    end if;
    v_genre_ids := array_append(v_genre_ids, v_dict_id);
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'countries', '[]'::jsonb)) loop
    entity_name := btrim(entry ->> 'name');
    if coalesce(entity_name, '') = '' then raise exception 'invalid country'; end if;
    v_dict_id := null; v_dict_status := null;
    select r.id, r.status into v_dict_id, v_dict_status from private.resolve_catalog_country(entity_name) r;
    if v_dict_id is null or v_dict_status = 'retired' then
      raise exception 'country_unknown' using errcode = '22023', detail = format('%s (clave %s)', entity_name, p_source_key),
        hint = 'La importación no crea países: corrige la hoja o pide el valor a admin.';
    end if;
    v_country_ids := array_append(v_country_ids, v_dict_id);
  end loop;

  if p_release_id is null then
    begin
      insert into public.releases (
        slug, title, release_date, release_type_id, label_id, review, status, credit_quality
      ) values (
        p_slug, p_title, p_date, p_type_id, p_label_id, p_review, p_status, p_credit_quality
      ) returning id into p_release_id;
    exception when unique_violation then
      raise exception 'canonical slug already belongs to another release: %', p_slug;
    end;
    insert into public.catalog_import_keys (source_name, source_key, release_id, source_hash, source_payload)
    values (p_source_name, p_source_key, p_release_id, p_source_hash, payload);
    p_action := 'created';
  else
    select * into v_cur from public.releases where id = p_release_id for update;
    v_changed := (v_cur.title, v_cur.release_date, v_cur.release_type_id, v_cur.label_id, v_cur.review)
      is distinct from (p_title, p_date, p_type_id, p_label_id, p_review);
    update public.catalog_import_keys
    set source_hash = p_source_hash,
        source_payload = payload,
        last_imported_at = now(),
        archived_missing_at = null
    where source_name = p_source_name and source_key = p_source_key;
  end if;

  insert into public.release_slug_aliases (slug, release_id, source_name, is_legacy, alias_kind)
  values (p_legacy_slug, p_release_id, p_source_name, true, 'migration')
  on conflict (slug, release_id) do nothing;

  -- Créditos: se reescriben solo si cambia la lista ordenada (artista, rol, posición).
  if (
    select coalesce(jsonb_agg(jsonb_build_object('artist_id', ra.artist_id, 'role', ra.role, 'position', ra.position)
      order by ra.role, ra.position), '[]'::jsonb)
    from public.release_artists ra where ra.release_id = p_release_id
  ) is distinct from (
    select coalesce(jsonb_agg(c order by c ->> 'role', (c ->> 'position')::int), '[]'::jsonb)
    from jsonb_array_elements(v_credits) c
  ) then
    delete from public.release_artists where release_id = p_release_id;
    insert into public.release_artists (release_id, artist_id, position, role)
    select p_release_id, (c ->> 'artist_id')::uuid, (c ->> 'position')::int, c ->> 'role'
    from jsonb_array_elements(v_credits) c;
    v_credits_changed := true;
  end if;

  if array(select rg.genre_id from public.release_genres rg where rg.release_id = p_release_id order by 1)
    is distinct from array(select distinct g from unnest(v_genre_ids) g order by 1) then
    delete from public.release_genres where release_id = p_release_id;
    insert into public.release_genres (release_id, genre_id)
    select distinct p_release_id, g from unnest(v_genre_ids) g;
    v_changed := true;
  end if;

  if array(select rc.country_id from public.release_countries rc where rc.release_id = p_release_id order by 1)
    is distinct from array(select distinct c from unnest(v_country_ids) c order by 1) then
    delete from public.release_countries where release_id = p_release_id;
    insert into public.release_countries (release_id, country_id)
    select distinct p_release_id, c from unnest(v_country_ids) c;
    v_changed := true;
  end if;

  insert into public.release_radar as rr (release_id, experimental, denso, sintetico, bailable, rapido)
  values (p_release_id, (payload -> 'radar' ->> 'experimental')::smallint, (payload -> 'radar' ->> 'denso')::smallint,
    (payload -> 'radar' ->> 'sintetico')::smallint, (payload -> 'radar' ->> 'bailable')::smallint,
    (payload -> 'radar' ->> 'rapido')::smallint)
  on conflict (release_id) do update set experimental = excluded.experimental, denso = excluded.denso,
    sintetico = excluded.sintetico, bailable = excluded.bailable, rapido = excluded.rapido
  where (rr.experimental, rr.denso, rr.sintetico, rr.bailable, rr.rapido)
    is distinct from (excluded.experimental, excluded.denso, excluded.sintetico, excluded.bailable, excluded.rapido);
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;

  -- Enlaces (S7): la hoja describe un único enlace, el primario. Lo que no sea ese enlace se borra;
  -- si ya existe con la misma URL, se conserva la fila (y su checked_at).
  delete from public.release_links rl
  where rl.release_id = p_release_id and rl.url is distinct from v_link;
  get diagnostics v_rows = row_count;
  v_changed := v_changed or v_rows > 0;
  if v_link is not null then
    update public.release_links rl set provider = v_provider, is_primary = true
    where rl.release_id = p_release_id and rl.url = v_link
      and (rl.provider is distinct from v_provider or not rl.is_primary);
    get diagnostics v_rows = row_count;
    v_changed := v_changed or v_rows > 0;
    insert into public.release_links (release_id, provider, url, is_primary)
    select p_release_id, v_provider, v_link, true
    where not exists (select 1 from public.release_links rl where rl.release_id = p_release_id and rl.url = v_link);
    get diagnostics v_rows = row_count;
    v_changed := v_changed or v_rows > 0;
  end if;

  -- Portadas (S7): solo la externa; las de storage no se tocan nunca.
  if v_cover is null then
    delete from public.release_covers where release_id = p_release_id and kind = 'external';
    get diagnostics v_rows = row_count;
    v_changed := v_changed or v_rows > 0;
  else
    v_keep := null;
    select id into v_keep from public.release_covers
    where release_id = p_release_id and kind = 'external' and url = v_cover order by created_at, id limit 1;
    if v_keep is null then
      select id into v_keep from public.release_covers
      where release_id = p_release_id and kind = 'external' order by created_at, id limit 1;
      if v_keep is null then
        insert into public.release_covers (release_id, url) values (p_release_id, v_cover) returning id into v_keep;
      else
        update public.release_covers set url = v_cover, source_url = null, content_hash = null, checked_at = null
        where id = v_keep;
      end if;
      v_changed := true;
    end if;
    delete from public.release_covers where release_id = p_release_id and kind = 'external' and id <> v_keep;
    get diagnostics v_rows = row_count;
    v_changed := v_changed or v_rows > 0;
  end if;

  if p_action is null then
    v_status := v_cur.status;
    if v_cur.status = 'archived' and v_archived_missing_at is not null then
      v_status := 'published';
    end if;
    if v_changed or v_credits_changed or v_status is distinct from v_cur.status then
      update public.releases
      set title = p_title,
          release_date = p_date,
          release_type_id = p_type_id,
          label_id = p_label_id,
          review = p_review,
          status = v_status,
          credit_quality = case when v_credits_changed then p_credit_quality else credit_quality end,
          catalog_version = catalog_version + 1,
          updated_at = now()
      where id = p_release_id;
      p_action := case when v_status is distinct from v_cur.status then 'republished' else 'updated' end;
    else
      p_action := 'unchanged';
    end if;
  end if;

  return query select p_release_id, p_action;
end;
$$;

revoke all on function private.import_catalog_release(jsonb)
  from public, anon, authenticated;

-- Poda explícita (--prune-dictionaries): artistas, sellos y géneros o países retirados sin uso.
-- Las listas cerradas (seleccionables y legado) no se podan nunca.
create or replace function private.prune_unused_catalog_dictionaries()
returns table (entity_type text, entity_id uuid, name text)
language sql
security invoker
set search_path = ''
as $$
  with del_artists as (
    delete from public.artists a
    where not exists (select 1 from public.release_artists ra where ra.artist_id = a.id)
      and not exists (select 1 from private.catalog_artist_change_events e where e.artist_id = a.id)
    returning 'artist'::text, a.id, a.name
  ), del_labels as (
    delete from public.labels l
    where not exists (select 1 from public.releases r where r.label_id = l.id)
    returning 'label'::text, l.id, l.name
  ), del_genres as (
    delete from public.genres g
    where g.status = 'retired'
      and not exists (select 1 from public.release_genres rg where rg.genre_id = g.id)
    returning 'genre'::text, g.id, g.name
  ), del_countries as (
    delete from public.countries c
    where c.status = 'retired'
      and not exists (select 1 from public.release_countries rc where rc.country_id = c.id)
    returning 'country'::text, c.id, c.name
  )
  select * from del_artists
  union all select * from del_labels
  union all select * from del_genres
  union all select * from del_countries;
$$;

revoke all on function private.prune_unused_catalog_dictionaries()
  from public, anon, authenticated;
