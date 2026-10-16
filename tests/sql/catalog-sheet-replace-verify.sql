-- Paso 8: reemplazo del catálogo con la hoja (20261014203000_catalog_sheet_replace_import.sql).
-- Transaccional: crea sus fixtures, comprueba y termina con ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/catalog-sheet-replace-verify.sql
-- Imprime "Catalog sheet replace verify: OK" o aborta con "SHEET FAIL n: …".
-- Control negativo: con el cuerpo de import_catalog_release de 20260915204413 falla en la comprobación 2.
-- Las huellas incluyen xmin: si una escritura toca una fila que debía quedar igual, la huella cambia.
begin;

-- U19: la importación ya no crea géneros ni países. Los del fixture existen antes: uno seleccionable
-- y dos de legado, que la importación también acepta.
insert into public.genres (name, normalized_name, slug, status) values
  ('SR Género', 'sr genero', 'sr-' || substr(md5('sr genero'), 1, 12), 'selectable'),
  ('SR Otro', 'sr otro', 'sr-' || substr(md5('sr otro'), 1, 12), 'legacy');
insert into public.countries (name, normalized_name, slug, status) values
  ('SR País', 'sr pais', 'sr-' || substr(md5('sr pais'), 1, 12), 'legacy');

create function pg_temp.sr_release(p_id uuid) returns text language sql as $$
  select concat_ws(',', r.id, r.xmin, r.title, r.status, r.credit_quality, r.catalog_version, r.updated_at)
  from public.releases r where r.id = p_id;
$$;
create function pg_temp.sr_relations(p_id uuid) returns text language sql as $$
  select concat_ws('|',
    (select string_agg(concat_ws(',', ra.xmin, ra.artist_id, ra.role, ra.position), ';' order by ra.role, ra.position) from public.release_artists ra where ra.release_id = p_id),
    (select string_agg(concat_ws(',', rg.xmin, rg.genre_id), ';' order by rg.genre_id) from public.release_genres rg where rg.release_id = p_id),
    (select string_agg(concat_ws(',', rc.xmin, rc.country_id), ';' order by rc.country_id) from public.release_countries rc where rc.release_id = p_id),
    (select concat_ws(',', rr.xmin, rr.experimental, rr.denso, rr.sintetico, rr.bailable, rr.rapido) from public.release_radar rr where rr.release_id = p_id));
$$;
create function pg_temp.sr_links(p_id uuid) returns text language sql as $$
  select coalesce(string_agg(concat_ws(',', l.id, l.xmin, l.provider, l.url, l.is_primary, l.checked_at, l.created_at), ';' order by l.url), '')
  from public.release_links l where l.release_id = p_id;
$$;
create function pg_temp.sr_covers(p_id uuid, p_kind text) returns text language sql as $$
  select coalesce(string_agg(concat_ws(',', c.id, c.xmin, c.kind, c.url, c.storage_path, c.source_url, c.content_hash, c.checked_at, c.created_at), ';' order by c.created_at, c.id), '')
  from public.release_covers c where c.release_id = p_id and c.kind = p_kind;
$$;
create function pg_temp.sr_dictionaries() returns text language sql as $$
  select concat_ws('|',
    (select string_agg(concat_ws(',', a.id, a.xmin), ';' order by a.id) from public.artists a where a.normalized_name like 'sr %'),
    (select string_agg(concat_ws(',', l.id, l.xmin), ';' order by l.id) from public.labels l where l.normalized_name like 'sr %'),
    (select string_agg(concat_ws(',', g.id, g.xmin), ';' order by g.id) from public.genres g where g.normalized_name like 'sr %'),
    (select string_agg(concat_ws(',', c.id, c.xmin), ';' order by c.id) from public.countries c where c.normalized_name like 'sr %'));
$$;
create function pg_temp.sr_entity(p_name text) returns jsonb language sql as $$
  select jsonb_build_object('name', p_name, 'key', lower(p_name), 'slug', 'sr-' || substr(md5(lower(p_name)), 1, 12));
$$;
create function pg_temp.sr_payload(p_key text, p_title text) returns jsonb language sql as $$
  select jsonb_build_object(
    'source_name', 'sr-sheet', 'source_key', p_key, 'source_hash', encode(sha256(convert_to(p_key || p_title, 'UTF8')), 'hex'),
    'slug', 'sr-' || p_key, 'legacy_slug', 'sr-' || p_key || '-legado', 'title', p_title, 'release_date', '2026-10-14',
    'type', 'EP', 'label', 'SR Sello', 'label_key', 'sr sello', 'label_slug', 'sr-sello', 'review', '', 'status', 'published',
    'primary_artists', jsonb_build_array(pg_temp.sr_entity('SR Artista')), 'collaborators', '[]'::jsonb, 'credit_quality', 'legacy',
    'genres', jsonb_build_array(pg_temp.sr_entity('SR Género'), pg_temp.sr_entity('SR Otro')),
    'countries', jsonb_build_array(pg_temp.sr_entity('SR País')),
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5),
    'buy_link', 'https://sr.bandcamp.com/album/' || p_key, 'provider', 'bandcamp',
    'cover', 'https://f4.bcbits.com/img/sr-' || p_key || '.jpg');
$$;

do $$
declare
  v_res record;
  r1 uuid; r2 uuid; r3 uuid;
  v_p1 jsonb := pg_temp.sr_payload('k1', 'SR uno');
  v_p2 jsonb := pg_temp.sr_payload('k2', 'SR dos');
  v_rel text; v_relations text; v_links text; v_ext text; v_sto text; v_dict text; v_ver integer;
  v_failed boolean;
  v_count integer;
begin
  -- 1. Crear: igual que antes ---------------------------------------------------
  select * into v_res from private.import_catalog_release(v_p1);
  r1 := v_res.imported_release_id;
  if v_res.action <> 'created' then raise exception 'SHEET FAIL 1: action %', v_res.action; end if;
  if not exists (select 1 from public.releases where id = r1 and status = 'published' and credit_quality = 'legacy' and catalog_version = 1)
    or (select count(*) from public.release_links where release_id = r1 and is_primary) <> 1
    or (select count(*) from public.release_covers where release_id = r1 and kind = 'external') <> 1
    or (select count(*) from public.release_genres where release_id = r1) <> 2 then
    raise exception 'SHEET FAIL 1: estado inicial';
  end if;

  -- 2. La misma fila otra vez no escribe nada --------------------------------
  v_rel := pg_temp.sr_release(r1); v_relations := pg_temp.sr_relations(r1); v_links := pg_temp.sr_links(r1);
  v_ext := pg_temp.sr_covers(r1, 'external'); v_dict := pg_temp.sr_dictionaries();
  select * into v_res from private.import_catalog_release(v_p1);
  if v_res.action <> 'unchanged' then raise exception 'SHEET FAIL 2: action % (esperado unchanged)', v_res.action; end if;
  if pg_temp.sr_release(r1) <> v_rel then raise exception 'SHEET FAIL 2: se escribió el lanzamiento'; end if;
  if pg_temp.sr_relations(r1) <> v_relations then raise exception 'SHEET FAIL 2: se escribieron las relaciones'; end if;
  if pg_temp.sr_links(r1) <> v_links or pg_temp.sr_covers(r1, 'external') <> v_ext then raise exception 'SHEET FAIL 2: se escribieron enlaces o portadas'; end if;
  if pg_temp.sr_dictionaries() <> v_dict then raise exception 'SHEET FAIL 2: se escribieron los diccionarios'; end if;

  -- 3. Cambio de título: conserva estado, calidad de créditos y metadatos de media; sube versión
  update public.release_links set checked_at = now() - interval '1 day' where release_id = r1;
  update public.release_covers set checked_at = now() - interval '1 day', content_hash = repeat('a', 64),
    source_url = 'https://sr.bandcamp.com/album/k1' where release_id = r1;
  insert into public.release_covers (release_id, kind, storage_path) values (r1, 'storage', 'sr/k1.jpg');
  update public.releases set status = 'archived', credit_quality = 'verified' where id = r1;
  select catalog_version into v_ver from public.releases where id = r1;
  v_links := pg_temp.sr_links(r1); v_ext := pg_temp.sr_covers(r1, 'external'); v_sto := pg_temp.sr_covers(r1, 'storage');
  select * into v_res from private.import_catalog_release(v_p1 || '{"title": "SR uno corregido"}');
  if v_res.action <> 'updated' then raise exception 'SHEET FAIL 3: action %', v_res.action; end if;
  if not exists (select 1 from public.releases where id = r1 and title = 'SR uno corregido' and status = 'archived'
      and credit_quality = 'verified' and catalog_version = v_ver + 1) then
    raise exception 'SHEET FAIL 3: título, estado, calidad o versión';
  end if;
  if pg_temp.sr_links(r1) <> v_links then raise exception 'SHEET FAIL 3: se reescribió un enlace igual'; end if;
  if pg_temp.sr_covers(r1, 'external') <> v_ext then raise exception 'SHEET FAIL 3: se reescribió una portada igual'; end if;
  if pg_temp.sr_covers(r1, 'storage') <> v_sto then raise exception 'SHEET FAIL 3: se tocó la portada storage'; end if;

  -- 4. Cambian los créditos: la calidad vuelve a la de la fuente ---------------
  select * into v_res from private.import_catalog_release(v_p1 || jsonb_build_object('title', 'SR uno corregido',
    'primary_artists', jsonb_build_array(pg_temp.sr_entity('SR Artista'), pg_temp.sr_entity('SR Segunda'))));
  if v_res.action <> 'updated'
    or not exists (select 1 from public.releases where id = r1 and credit_quality = 'legacy' and status = 'archived')
    or (select count(*) from public.release_artists where release_id = r1 and role = 'primary') <> 2 then
    raise exception 'SHEET FAIL 4: créditos';
  end if;

  -- 5. Cambian enlace y portada: el enlace se reemplaza, la portada se actualiza en su sitio ----
  v_sto := pg_temp.sr_covers(r1, 'storage');
  select * into v_res from private.import_catalog_release(v_p1 || jsonb_build_object('title', 'SR uno corregido',
    'primary_artists', jsonb_build_array(pg_temp.sr_entity('SR Artista'), pg_temp.sr_entity('SR Segunda')),
    'buy_link', 'https://open.spotify.com/album/sr-k1', 'provider', 'spotify', 'cover', 'https://f4.bcbits.com/img/sr-k1-b.jpg'));
  if v_res.action <> 'updated' then raise exception 'SHEET FAIL 5: action %', v_res.action; end if;
  if (select string_agg(url || ':' || provider || ':' || is_primary, ';') from public.release_links where release_id = r1)
    <> 'https://open.spotify.com/album/sr-k1:spotify:true' then
    raise exception 'SHEET FAIL 5: enlace';
  end if;
  if (select count(*) from public.release_covers where release_id = r1 and kind = 'external' and url = 'https://f4.bcbits.com/img/sr-k1-b.jpg'
        and content_hash is null and checked_at is null and source_url is null
        and id = split_part(v_ext, ',', 1)::uuid) <> 1 then
    raise exception 'SHEET FAIL 5: la portada externa no se actualizó en su sitio';
  end if;
  if pg_temp.sr_covers(r1, 'storage') <> v_sto then raise exception 'SHEET FAIL 5: se tocó la portada storage'; end if;

  -- 6. Archivar las claves ausentes -------------------------------------------
  select imported_release_id into r2 from private.import_catalog_release(v_p2);
  insert into public.releases (slug, title, release_type_id, label_id, status)
  select 'sr-sin-clave', 'SR sin clave', rt.id, l.id, 'published'
  from public.release_types rt, public.labels l where rt.slug = 'ep' and l.normalized_name = 'sr sello'
  returning id into r3;
  select catalog_version into v_ver from public.releases where id = r2;

  v_failed := false;
  begin
    perform private.archive_missing_catalog_keys('sr-sheet', array['k1'], 0);
  exception when sqlstate '22023' then v_failed := true;
  end;
  if not v_failed then raise exception 'SHEET FAIL 6: el tope max_archive no frenó'; end if;
  v_failed := false;
  begin
    perform private.archive_missing_catalog_keys('sr-sheet', array[]::text[], 100);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'SHEET FAIL 6: una lista vacía archivaría todo'; end if;

  select count(*) into v_count from private.archive_missing_catalog_keys('sr-sheet', array['k1'], 5) a
  where a.release_id = r2 and a.source_key = 'k2' and a.previous_status = 'published' and a.crate_items = 0;
  if v_count <> 1 then raise exception 'SHEET FAIL 6: no devolvió k2'; end if;
  if not exists (select 1 from public.releases where id = r2 and status = 'archived' and catalog_version = v_ver + 1)
    or not exists (select 1 from public.catalog_import_keys where release_id = r2 and archived_missing_at is not null) then
    raise exception 'SHEET FAIL 6: k2 no quedó archivado y marcado';
  end if;
  if not exists (select 1 from public.releases where id = r3 and status = 'published') then
    raise exception 'SHEET FAIL 6: se archivó un lanzamiento sin clave';
  end if;
  if exists (select 1 from public.catalog_import_keys where release_id = r1 and archived_missing_at is not null) then
    raise exception 'SHEET FAIL 6: se marcó una clave presente';
  end if;
  if (select count(*) from private.archive_missing_catalog_keys('sr-sheet', array['k1'], 5)) <> 0 then
    raise exception 'SHEET FAIL 6: archivar dos veces no es idempotente';
  end if;
  if not exists (select 1 from public.releases where id = r2) then raise exception 'SHEET FAIL 6: se borró'; end if;

  -- 7. La clave vuelve: se republica solo lo que archivó el importador ---------
  select * into v_res from private.import_catalog_release(v_p2);
  if v_res.action <> 'republished'
    or not exists (select 1 from public.releases where id = r2 and status = 'published')
    or exists (select 1 from public.catalog_import_keys where release_id = r2 and archived_missing_at is not null) then
    raise exception 'SHEET FAIL 7: republicar % ', v_res.action;
  end if;
  -- r1 lo archivó el Estudio (comprobación 3): sigue archivado aunque la hoja lo traiga.
  if exists (select 1 from public.releases where id = r1 and status <> 'archived') then
    raise exception 'SHEET FAIL 7: se republicó un archivo del Estudio';
  end if;

  -- 8. Misma persona en principales y colaboradores ---------------------------
  v_failed := false;
  begin
    perform private.import_catalog_release(v_p2 || jsonb_build_object('collaborators', jsonb_build_array(pg_temp.sr_entity('SR Artista'))));
  exception when sqlstate '23505' then v_failed := true;
  end;
  if not v_failed then raise exception 'SHEET FAIL 8: aceptó un artista principal y colaborador'; end if;

  -- 9. Diccionarios sin uso ---------------------------------------------------
  insert into public.artists (name, normalized_name, slug) values ('SR Huérfano', 'sr huerfano', 'sr-' || substr(md5('sr huerfano'), 1, 12));
  insert into public.labels (name, normalized_name, slug) values ('SR Sello huérfano', 'sr sello huerfano', 'sr-' || substr(md5('sr sello huerfano'), 1, 12));
  -- U19: solo se podan géneros y países retirados; los de las listas se conservan aunque no se usen.
  insert into public.genres (name, normalized_name, slug, status) values ('SR Género huérfano', 'sr genero huerfano', 'sr-' || substr(md5('sr genero huerfano'), 1, 12), 'retired');
  insert into public.countries (name, normalized_name, slug, status) values ('SR País huérfano', 'sr pais huerfano', 'sr-' || substr(md5('sr pais huerfano'), 1, 12), 'retired');
  insert into public.genres (name, normalized_name, slug, status) values ('SR Género libre', 'sr genero libre', 'sr-' || substr(md5('sr genero libre'), 1, 12), 'selectable');
  insert into public.countries (name, normalized_name, slug, status) values ('SR País libre', 'sr pais libre', 'sr-' || substr(md5('sr pais libre'), 1, 12), 'legacy');
  -- r1 (archivado) es el único que usa 'SR Segunda': un archivado también cuenta como uso.
  select count(*) into v_count from private.prune_unused_catalog_dictionaries() p
  where p.name in ('SR Huérfano', 'SR Sello huérfano', 'SR Género huérfano', 'SR País huérfano');
  if v_count <> 4 then raise exception 'SHEET FAIL 9: borró % de 4 huérfanos', v_count; end if;
  if exists (select 1 from public.artists where normalized_name = 'sr huerfano')
    or not exists (select 1 from public.artists where normalized_name = 'sr segunda')
    or not exists (select 1 from public.genres where normalized_name = 'sr otro')
    or not exists (select 1 from public.labels where normalized_name = 'sr sello')
    or not exists (select 1 from public.genres where normalized_name = 'sr genero libre')
    or not exists (select 1 from public.countries where normalized_name = 'sr pais libre') then
    raise exception 'SHEET FAIL 9: borró algo en uso o dejó un huérfano';
  end if;

  raise notice 'Catalog sheet replace verify: OK';
end;
$$;

rollback;
