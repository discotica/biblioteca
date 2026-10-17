-- S7 (H4): apply_catalog_payload conserva las filas de portadas y enlaces que no cambian.
-- Transaccional: crea sus fixtures, comprueba y termina con ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/s7-verify.sql
-- Necesita E06, D2, S6 y S7 aplicadas. Imprime "S7 verify: OK" o aborta con "S7 FAIL: …".
-- La huella incluye id, xmin y todas las columnas de las filas: si una escritura toca una
-- fila que debía quedar igual, la huella cambia (UPDATE crea una tupla nueva y cambia xmin).
begin;

create function pg_temp.s7_links(p_id uuid) returns text language sql as $$
  select coalesce(string_agg(concat_ws(',', l.id, l.xmin, l.provider, l.url, l.is_primary, l.checked_at, l.created_at), ';' order by l.url), '')
  from public.release_links l where l.release_id = p_id;
$$;
create function pg_temp.s7_link(p_id uuid, p_url text) returns text language sql as $$
  select concat_ws(',', l.id, l.xmin, l.provider, l.url, l.is_primary, l.checked_at, l.created_at)
  from public.release_links l where l.release_id = p_id and l.url = p_url;
$$;
create function pg_temp.s7_covers(p_id uuid, p_kind text) returns text language sql as $$
  select coalesce(string_agg(concat_ws(',', c.id, c.xmin, c.kind, c.url, c.storage_path, c.source_url, c.content_hash, c.checked_at, c.created_at), ';' order by c.created_at, c.id), '')
  from public.release_covers c where c.release_id = p_id and c.kind = p_kind;
$$;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_type uuid; v_label uuid; v_genre uuid; v_country uuid; v_artist uuid;
  v_base jsonb; v_payload jsonb; v_res jsonb;
  r1 uuid; r2 uuid; v_ver integer;
  v_a text := 'https://s7.bandcamp.com/album/a';
  v_b text := 'https://s7.bandcamp.com/album/b';
  v_c text := 'https://s7.bandcamp.com/album/c';
  v_cover1 text := 'https://f4.bcbits.com/img/s7-1.jpg';
  v_cover2 text := 'https://f4.bcbits.com/img/s7-2.jpg';
  v_link_a text; v_link_b text; v_ext_cover text; v_sto_cover text; v_cover_id uuid;
  v_before_state jsonb; v_after_state jsonb; v_set uuid;
begin
  -- Fixtures ------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's7-admin@s7.test', jsonb_build_object('username', 's7-admin'), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;
  select id into v_type from public.release_types where slug = 'album';
  insert into public.labels (name, normalized_name, slug) values ('S7 Sello', 's7 sello', 's7-sello') returning id into v_label;
  insert into public.genres (name, normalized_name, slug) values ('S7 Género', 's7 genero', 's7-genero') returning id into v_genre;
  insert into public.countries (name, normalized_name, slug) values ('S7 País', 's7 pais', 's7-pais') returning id into v_country;
  insert into public.artists (name, normalized_name, slug) values ('S7 Artista', 's7 artista', 's7-artista') returning id into v_artist;

  v_base := jsonb_build_object(
    'title', 'S7 uno', 'slug', 's7-uno', 'release_date', '2026-10-12', 'release_type_id', v_type, 'label_id', v_label,
    'review', '', 'status', 'draft', 'credit_quality', 'legacy', 'artist_ids', jsonb_build_array(v_artist),
    'collaborator_ids', '[]'::jsonb, 'genre_ids', jsonb_build_array(v_genre), 'country_ids', jsonb_build_array(v_country),
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5),
    'links', jsonb_build_array(
      jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', true),
      jsonb_build_object('provider', 'bandcamp', 'url', v_b, 'is_primary', false)),
    'cover_url', v_cover1);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r1 := (public.admin_create_catalog_release(v_base, 'fixture')->>'release_id')::uuid;
  r2 := (public.admin_create_catalog_release(v_base || '{"title":"S7 dos","slug":"s7-dos"}', 'fixture')->>'release_id')::uuid;
  reset role;

  -- Metadatos que hoy se pierden: lo que dejarían E09, verify:media y la promoción a Storage.
  update public.release_links set checked_at = '2026-10-01 10:00:00+00' where release_id = r1;
  update public.release_covers set source_url = 'https://s7.bandcamp.com/album/a', content_hash = repeat('a', 64), checked_at = '2026-10-02 10:00:00+00'
    where release_id = r1 and kind = 'external';
  insert into public.release_covers (release_id, kind, storage_path, content_hash, checked_at)
    values (r1, 'storage', 'covers/s7-1.webp', repeat('b', 64), '2026-10-03 10:00:00+00');
  v_ver := 1;

  -- 1. Edición que no toca portada ni enlaces: filas idénticas ---------------------
  v_link_a := pg_temp.s7_links(r1); v_ext_cover := pg_temp.s7_covers(r1, 'external'); v_sto_cover := pg_temp.s7_covers(r1, 'storage');
  if v_ext_cover = '' or v_sto_cover = '' or v_link_a = '' then raise exception 'S7 FAIL: fixtures sin filas'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_base || '{"title":"S7 uno editado","review":"texto"}', 'solo título', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if v_ver <> 2 or (select title from public.releases where id = r1) <> 'S7 uno editado' then raise exception 'S7 FAIL: la edición no se aplicó'; end if;
  if pg_temp.s7_links(r1) <> v_link_a then raise exception 'S7 FAIL: una edición sin enlaces tocó release_links: % <> %', pg_temp.s7_links(r1), v_link_a; end if;
  if pg_temp.s7_covers(r1, 'external') <> v_ext_cover then raise exception 'S7 FAIL: una edición sin portada tocó la portada externa'; end if;
  if pg_temp.s7_covers(r1, 'storage') <> v_sto_cover then raise exception 'S7 FAIL: una edición tocó la portada storage'; end if;
  raise notice 'S7 1/8 edición sin media: enlaces, portada externa y storage idénticos (id, xmin, metadatos)';

  -- 2. Cambia un enlace (provider de B): A y la portada quedan idénticos, B conserva id y checked_at
  v_link_a := pg_temp.s7_link(r1, v_a); v_link_b := pg_temp.s7_link(r1, v_b);
  v_payload := v_base || jsonb_build_object('title', 'S7 uno editado', 'review', 'texto', 'links', jsonb_build_array(
    jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', true),
    jsonb_build_object('provider', 'otro', 'url', v_b, 'is_primary', false)));
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_payload, 'cambia provider de B', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if pg_temp.s7_link(r1, v_a) <> v_link_a then raise exception 'S7 FAIL: cambiar B tocó A'; end if;
  if pg_temp.s7_covers(r1, 'external') <> v_ext_cover then raise exception 'S7 FAIL: cambiar un enlace tocó la portada'; end if;
  if (select l.provider from public.release_links l where l.release_id = r1 and l.url = v_b) <> 'otro'
     or (select l.id from public.release_links l where l.release_id = r1 and l.url = v_b) <> split_part(v_link_b, ',', 1)::uuid
     or (select l.checked_at from public.release_links l where l.release_id = r1 and l.url = v_b) is distinct from '2026-10-01 10:00:00+00'::timestamptz then
    raise exception 'S7 FAIL: B no se actualizó en el sitio o perdió checked_at';
  end if;
  if pg_temp.s7_link(r1, v_b) = v_link_b then raise exception 'S7 FAIL: B cambió de provider sin UPDATE'; end if;
  raise notice 'S7 2/8 cambia un enlace: A y portada idénticos; B actualizado con mismo id y checked_at';

  -- 3. Quitar y añadir enlaces: solo se borra lo que el payload quita -------------
  v_link_a := pg_temp.s7_link(r1, v_a);
  v_payload := v_payload || jsonb_build_object('links', jsonb_build_array(
    jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', true),
    jsonb_build_object('provider', 'spotify', 'url', v_c, 'is_primary', false)));
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_payload, 'quita B, añade C', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if pg_temp.s7_link(r1, v_a) <> v_link_a then raise exception 'S7 FAIL: quitar B y añadir C tocó A'; end if;
  if pg_temp.s7_link(r1, v_b) is not null then raise exception 'S7 FAIL: B no se borró'; end if;
  if pg_temp.s7_link(r1, v_c) is null or (select count(*) from public.release_links where release_id = r1) <> 2 then raise exception 'S7 FAIL: C no se insertó'; end if;
  raise notice 'S7 3/8 quitar y añadir: A idéntico, B borrado, C nuevo';

  -- 4. Cambio de primario sin chocar con el índice único ---------------------------
  v_link_a := pg_temp.s7_link(r1, v_a);
  v_payload := v_payload || jsonb_build_object('links', jsonb_build_array(
    jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', false),
    jsonb_build_object('provider', 'spotify', 'url', v_c, 'is_primary', true)));
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_payload, 'intercambia primario', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if (select url from public.release_links where release_id = r1 and is_primary) <> v_c
     or split_part(pg_temp.s7_link(r1, v_a), ',', 1) <> split_part(v_link_a, ',', 1)
     or (select l.checked_at from public.release_links l where l.release_id = r1 and l.url = v_a) is null then
    raise exception 'S7 FAIL: el intercambio de primario perdió ids o checked_at';
  end if;
  raise notice 'S7 4/8 intercambio de primario: ids y checked_at conservados';

  -- 5. Portada: URL nueva se actualiza en el sitio, storage intacta; sin portada borra solo la externa
  v_cover_id := (select id from public.release_covers where release_id = r1 and kind = 'external');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_payload || jsonb_build_object('cover_url', v_cover2), 'portada nueva', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if (select count(*) from public.release_covers where release_id = r1 and kind = 'external') <> 1
     or (select id from public.release_covers where release_id = r1 and kind = 'external') <> v_cover_id
     or (select url from public.release_covers where release_id = r1 and kind = 'external') <> v_cover2
     or (select source_url from public.release_covers where release_id = r1 and kind = 'external') is not null
     or (select content_hash from public.release_covers where release_id = r1 and kind = 'external') is not null
     or (select checked_at from public.release_covers where release_id = r1 and kind = 'external') is not null then
    raise exception 'S7 FAIL: la portada nueva no reutilizó la fila o dejó metadatos de la imagen anterior';
  end if;
  if pg_temp.s7_covers(r1, 'storage') <> v_sto_cover then raise exception 'S7 FAIL: cambiar la portada externa tocó la storage'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_update_catalog_release(r1, v_ver, v_payload || jsonb_build_object('cover_url', null), 'sin portada', 'update');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if exists (select 1 from public.release_covers where release_id = r1 and kind = 'external') then raise exception 'S7 FAIL: la portada externa no se borró'; end if;
  if pg_temp.s7_covers(r1, 'storage') <> v_sto_cover then raise exception 'S7 FAIL: quitar la portada externa borró la storage'; end if;
  raise notice 'S7 5/8 portada: URL nueva en el sitio con metadatos anulados; sin portada borra solo la externa; storage intacta';

  -- 6. URLs duplicadas: sigue fallando 23505 y no cambia nada -------------------------
  v_link_a := pg_temp.s7_links(r1);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_update_catalog_release(r1, v_ver, v_payload || jsonb_build_object('links', jsonb_build_array(
      jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', true),
      jsonb_build_object('provider', 'bandcamp', 'url', v_a, 'is_primary', false))), 'duplicado', 'update');
    raise exception 'S7 FAIL: aceptó URLs duplicadas';
  exception when unique_violation then null; end;
  reset role;
  if pg_temp.s7_links(r1) <> v_link_a then raise exception 'S7 FAIL: el rechazo por duplicado dejó cambios'; end if;
  raise notice 'S7 6/8 URLs duplicadas: 23505 y sin cambios';

  -- 7. Auditoría: before_state/after_state completos y revert conserva metadatos ----
  select s.id, e.before_state, e.after_state into v_set, v_before_state, v_after_state
    from private.catalog_change_sets s join private.catalog_change_events e on e.change_set_id = s.id
    where s.entity_id = r1 and s.reason = 'quita B, añade C';
  if v_set is null
     or jsonb_array_length(v_before_state->'links') <> 2 or jsonb_array_length(v_after_state->'links') <> 2
     or not (v_before_state->'links' @> jsonb_build_array(jsonb_build_object('provider', 'otro', 'url', v_b, 'is_primary', false)))
     or not (v_after_state->'links' @> jsonb_build_array(jsonb_build_object('provider', 'spotify', 'url', v_c, 'is_primary', false)))
     or v_before_state->>'cover_url' <> v_cover1 or v_after_state->>'cover_url' <> v_cover1 then
    raise exception 'S7 FAIL: la auditoría perdió forma o contenido: % / %', v_before_state->'links', v_after_state->'links';
  end if;
  -- Revert del cambio "quita B, añade C": vuelve B y se va C; A conserva fila y metadatos.
  v_link_a := pg_temp.s7_link(r1, v_a);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Hay ediciones posteriores: el revert del cambio viejo debe rechazarse (contrato de E06) y no tocar filas.
  begin
    perform public.admin_revert_catalog_change(v_set, v_ver, 'revert viejo');
    raise exception 'S7 FAIL: el revert de un cambio antiguo no se rechazó';
  exception when sqlstate '40001' then null; end;
  reset role;
  if pg_temp.s7_link(r1, v_a) <> v_link_a then raise exception 'S7 FAIL: un revert rechazado tocó A'; end if;
  -- Revert del último cambio sí procede y conserva el resto de filas.
  select s.id into v_set from private.catalog_change_sets s where s.entity_id = r1 order by s.result_version desc limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_revert_catalog_change(v_set, v_ver, 'revert último');
  reset role;
  v_ver := (v_res->>'catalog_version')::integer;
  if pg_temp.s7_link(r1, v_a) <> v_link_a then raise exception 'S7 FAIL: el revert del último cambio tocó A'; end if;
  if pg_temp.s7_covers(r1, 'storage') <> v_sto_cover then raise exception 'S7 FAIL: el revert tocó la portada storage'; end if;
  raise notice 'S7 7/8 auditoría: before/after con enlaces y portada completos; revert rechazado y revert válido conservan A y storage';

  -- 8. Lote de D2 (publicar): las filas de media no se tocan y el rechazo es todo o nada --
  v_link_a := pg_temp.s7_links(r2); v_ext_cover := pg_temp.s7_covers(r2, 'external');
  update public.release_links set checked_at = '2026-10-04 10:00:00+00' where release_id = r2;
  update public.release_covers set content_hash = repeat('c', 64) where release_id = r2 and kind = 'external';
  v_link_a := pg_temp.s7_links(r2); v_ext_cover := pg_temp.s7_covers(r2, 'external');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('publish',
    jsonb_build_array(jsonb_build_object('release_id', r2, 'expected_version', 1)), 'lote S7');
  reset role;
  if (v_res->>'applied')::boolean is not true or (select status from public.releases where id = r2) <> 'published' then
    raise exception 'S7 FAIL: el lote no publicó: %', v_res;
  end if;
  if pg_temp.s7_links(r2) <> v_link_a or pg_temp.s7_covers(r2, 'external') <> v_ext_cover then
    raise exception 'S7 FAIL: el lote reescribió enlaces o portada de un lanzamiento que no cambiaron';
  end if;
  raise notice 'S7 8/8 lote D2: publicar conserva enlaces y portada (id, xmin, metadatos)';

  raise notice 'S7 verify: OK';
end;
$$;

rollback;
