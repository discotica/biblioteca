-- D2: lote auditado (publicar/archivar) y señales de vistas rápidas.
-- Transaccional: crea sus fixtures, comprueba y termina con ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/d2-verify.sql
-- Necesita E06, E18 y D2 aplicadas. Imprime "D2 verify: OK" o aborta con "D2 FAIL: …".
begin;

-- Huella de todo lo que una escritura de E06 toca para unos lanzamientos:
-- versión de fila (xmin) de releases y de cada relación reescrita, incluidos
-- enlaces y portadas (id, xmin y metadatos; desde S7 se conservan, no se
-- recrean), y la evidencia de auditoría. Si un lote rechazado escribió algo
-- y no lo deshizo, la huella cambia.
create function pg_temp.d2_fingerprint(p_ids uuid[]) returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(',', r.id, r.xmin, r.status, r.catalog_version, r.updated_at), ';' order by r.id) from public.releases r where r.id = any(p_ids)),
    (select string_agg(concat_ws(',', a.release_id, a.artist_id, a.role, a.xmin), ';' order by a.release_id, a.role, a.artist_id) from public.release_artists a where a.release_id = any(p_ids)),
    (select string_agg(concat_ws(',', g.release_id, g.genre_id, g.xmin), ';' order by g.release_id, g.genre_id) from public.release_genres g where g.release_id = any(p_ids)),
    (select string_agg(concat_ws(',', c.release_id, c.country_id, c.xmin), ';' order by c.release_id, c.country_id) from public.release_countries c where c.release_id = any(p_ids)),
    (select string_agg(concat_ws(',', x.release_id, x.xmin), ';' order by x.release_id) from public.release_radar x where x.release_id = any(p_ids)),
    (select string_agg(concat_ws(',', l.id, l.xmin, l.provider, l.url, l.is_primary, l.checked_at), ';' order by l.id) from public.release_links l where l.release_id = any(p_ids)),
    (select string_agg(concat_ws(',', c.id, c.xmin, c.kind, c.url, c.storage_path, c.source_url, c.content_hash, c.checked_at), ';' order by c.id) from public.release_covers c where c.release_id = any(p_ids)),
    (select count(*)::text from private.catalog_change_sets s where s.entity_id = any(p_ids)),
    (select count(*)::text from private.catalog_change_events e where e.entity_id = any(p_ids))
  ));
$$;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_collab uuid := gen_random_uuid();
  v_community uuid := gen_random_uuid();
  v_type uuid; v_label uuid; v_genre uuid; v_country uuid; v_artist uuid;
  v_complete jsonb;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; r7 uuid;
  v_all uuid[]; v_extra uuid[] := '{}';
  v_fp text; v_res jsonb; v_res2 jsonb; v_items jsonb; v_count integer; v_snapshot jsonb;
  v_batch uuid; v_started timestamptz; v_ms numeric;
  v_admin_claims text; v_fn text;
begin
  -- Fixtures ------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2-admin@d2.test', jsonb_build_object('username', 'd2-admin'), now(), now()),
    (v_collab, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2-collab@d2.test', jsonb_build_object('username', 'd2-collab'), now(), now()),
    (v_community, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2-community@d2.test', jsonb_build_object('username', 'd2-community'), now(), now());
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'colaborador' where id = v_collab;
  if (select role from public.profiles where id = v_community) <> 'comunidad' then raise exception 'D2 FAIL: community fixture role'; end if;

  select id into v_type from public.release_types where slug = 'album';
  insert into public.labels (name, normalized_name, slug) values ('D2 Sello', 'd2 sello', 'd2-sello') returning id into v_label;
  insert into public.genres (name, normalized_name, slug) values ('D2 Género', 'd2 genero', 'd2-genero') returning id into v_genre;
  insert into public.countries (name, normalized_name, slug) values ('D2 País', 'd2 pais', 'd2-pais') returning id into v_country;
  insert into public.artists (name, normalized_name, slug) values ('D2 Artista', 'd2 artista', 'd2-artista') returning id into v_artist;
  if v_type is null then raise exception 'D2 FAIL: release type album missing'; end if;

  v_complete := jsonb_build_object(
    'title', 'x', 'slug', 'x', 'release_date', '2026-10-06', 'release_type_id', v_type, 'label_id', v_label,
    'review', '', 'status', 'draft', 'credit_quality', 'legacy', 'artist_ids', jsonb_build_array(v_artist),
    'collaborator_ids', '[]'::jsonb, 'genre_ids', jsonb_build_array(v_genre), 'country_ids', jsonb_build_array(v_country),
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5),
    'links', jsonb_build_array(jsonb_build_object('provider', 'bandcamp', 'url', 'https://d2.bandcamp.com/album/x', 'is_primary', true)),
    'cover_url', 'https://f4.bcbits.com/img/d2.jpg');

  v_admin_claims := jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', v_admin_claims, true);
  set local role authenticated;
  r1 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 uno","slug":"d2-uno"}', 'fixture')->>'release_id')::uuid;
  r2 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 dos","slug":"d2-dos"}', 'fixture')->>'release_id')::uuid;
  r3 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 tres","slug":"d2-tres"}', 'fixture')->>'release_id')::uuid;
  -- r4: borrador sin portada.
  r4 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 cuatro","slug":"d2-cuatro","cover_url":null}', 'fixture')->>'release_id')::uuid;
  -- r5: borrador sin sello, sin país y sin enlace principal.
  r5 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 cinco","slug":"d2-cinco","label_id":null,"country_ids":[],"links":[]}', 'fixture')->>'release_id')::uuid;
  -- r6: ya publicado y completo (E06 no crea directamente como publicado: se publica con la operación individual, versión 2).
  r6 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 seis","slug":"d2-seis"}', 'fixture')->>'release_id')::uuid;
  perform public.admin_update_catalog_release(r6, 1, v_complete || '{"title":"D2 seis","slug":"d2-seis"}', 'fixture', 'publish');
  -- r7: datos heredados que E06 ya no aceptaría (portada y enlace principal http).
  r7 := (public.admin_create_catalog_release(v_complete || '{"title":"D2 siete","slug":"d2-siete"}', 'fixture')->>'release_id')::uuid;
  reset role;
  update public.release_covers set url = 'http://f4.bcbits.com/img/d2-legacy.jpg' where release_id = r7;
  update public.release_links set url = 'http://d2.bandcamp.com/album/legacy' where release_id = r7;
  v_all := array[r1, r2, r3, r4, r5, r6, r7];

  -- 1. Permisos -----------------------------------------------------------------
  foreach v_fn in array array[
    'public.admin_batch_update_catalog_releases(text,jsonb,text)',
    'public.admin_catalog_quick_view_counts(text[])',
    'public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text,text)',
    'public.admin_get_catalog_history(uuid)'] loop
    if has_function_privilege('anon', v_fn, 'execute') then raise exception 'D2 FAIL: anon can execute %', v_fn; end if;
    if has_function_privilege('public', v_fn, 'execute') then raise exception 'D2 FAIL: PUBLIC can execute %', v_fn; end if;
    if not has_function_privilege('authenticated', v_fn, 'execute') then raise exception 'D2 FAIL: authenticated cannot execute %', v_fn; end if;
  end loop;
  foreach v_fn in array array[
    'private.catalog_release_missing_fields(uuid)', 'private.catalog_release_open_report_count(uuid)',
    'private.catalog_release_signals(uuid)',
    'private.admin_catalog_snapshot(uuid)'] loop
    if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'D2 FAIL: client role can execute %', v_fn;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'private.catalog_change_sets', 'select') or has_table_privilege('anon', 'private.catalog_change_sets', 'select') then
    raise exception 'D2 FAIL: client grant on private.catalog_change_sets';
  end if;
  -- La firma de 8 argumentos desapareció: PostgREST no ve dos sobrecargas.
  if to_regprocedure('public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text)') is not null then
    raise exception 'D2 FAIL: old 8-argument list overload still exists';
  end if;

  v_fp := pg_temp.d2_fingerprint(v_all);
  v_items := jsonb_build_array(jsonb_build_object('release_id', r1, 'expected_version', 1));

  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  set local role anon;
  begin perform public.admin_batch_update_catalog_releases('publish', v_items, 'anon'); raise exception 'D2 FAIL: anon ran the batch'; exception when insufficient_privilege then null; end;
  begin perform public.admin_catalog_quick_view_counts(); raise exception 'D2 FAIL: anon read counts'; exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_community, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_batch_update_catalog_releases('publish', v_items, 'comunidad'); raise exception 'D2 FAIL: community ran the batch'; exception when insufficient_privilege then null; end;
  begin perform public.admin_batch_update_catalog_releases('archive', v_items, 'comunidad'); raise exception 'D2 FAIL: community ran the archive batch'; exception when insufficient_privilege then null; end;
  begin perform public.admin_catalog_quick_view_counts(); raise exception 'D2 FAIL: community read counts'; exception when insufficient_privilege then null; end;
  begin perform public.admin_list_catalog_releases(p_quick_view => 'draft'); raise exception 'D2 FAIL: community listed quick view'; exception when insufficient_privilege then null; end;
  begin perform 1 from private.catalog_change_sets; raise exception 'D2 FAIL: community read audit'; exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_collab, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_batch_update_catalog_releases('publish', v_items, 'colaborador'); raise exception 'D2 FAIL: collaborator ran the batch'; exception when insufficient_privilege then null; end;
  begin perform public.admin_batch_update_catalog_releases('archive', v_items, 'colaborador'); raise exception 'D2 FAIL: collaborator ran the archive batch'; exception when insufficient_privilege then null; end;
  begin perform public.admin_catalog_quick_view_counts(); raise exception 'D2 FAIL: collaborator read counts'; exception when insufficient_privilege then null; end;
  begin perform public.admin_list_catalog_releases(p_quick_view => 'incomplete'); raise exception 'D2 FAIL: collaborator listed quick view'; exception when insufficient_privilege then null; end;
  begin perform public.admin_get_catalog_history(r1); raise exception 'D2 FAIL: collaborator read history'; exception when insufficient_privilege then null; end;
  reset role;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: a denied call changed state'; end if;

  -- 2. Validación estructural: rechaza la llamada entera con 22023 ----------------
  perform set_config('request.jwt.claims', v_admin_claims, true);
  set local role authenticated;
  begin perform public.admin_batch_update_catalog_releases('update', v_items, 'r'); raise exception 'D2 FAIL: accepted operation update'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases(null, v_items, 'r'); raise exception 'D2 FAIL: accepted null operation'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', v_items, '   '); raise exception 'D2 FAIL: accepted blank reason'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', '[]', 'r'); raise exception 'D2 FAIL: accepted empty batch'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', null, 'r'); raise exception 'D2 FAIL: accepted null batch'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_object('release_id', r1, 'expected_version', 1), 'r'); raise exception 'D2 FAIL: accepted object instead of array'; exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_batch_update_catalog_releases('publish',
      (select jsonb_agg(jsonb_build_object('release_id', gen_random_uuid(), 'expected_version', 1)) from generate_series(1, 51)), 'r');
    raise exception 'D2 FAIL: accepted 51 items';
  exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', r1, 'expected_version', 1), jsonb_build_object('release_id', r1, 'expected_version', 1)), 'r'); raise exception 'D2 FAIL: accepted duplicate release'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', r1)), 'r'); raise exception 'D2 FAIL: accepted missing expected_version'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', r1, 'expected_version', '1')), 'r'); raise exception 'D2 FAIL: accepted string version'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', r1, 'expected_version', 0)), 'r'); raise exception 'D2 FAIL: accepted version 0'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', r1, 'expected_version', 1.5)), 'r'); raise exception 'D2 FAIL: accepted fractional version'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array(jsonb_build_object('release_id', 'd2-uno', 'expected_version', 1)), 'r'); raise exception 'D2 FAIL: accepted slug as id'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_batch_update_catalog_releases('publish', jsonb_build_array('x'), 'r'); raise exception 'D2 FAIL: accepted scalar item'; exception when invalid_parameter_value then null; end;
  reset role;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: a malformed batch changed state'; end if;

  -- 3. Todo o nada: un elemento inválido no cambia nada -------------------------
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('publish', jsonb_build_array(
    jsonb_build_object('release_id', r1, 'expected_version', 1),
    jsonb_build_object('release_id', r4, 'expected_version', 1),
    jsonb_build_object('release_id', r2, 'expected_version', 1)), 'publicar lote con uno incompleto');
  reset role;
  if (v_res->>'applied')::boolean or v_res->'batch_id' <> 'null'::jsonb
     or (v_res->>'requested')::int <> 3 or (v_res->>'rejected_count')::int <> 1
     or (v_res->>'rolled_back_count')::int <> 2 or (v_res->>'applied_count')::int <> 0
     or v_res->'items'->0->>'result' <> 'rolled_back' or (v_res->'items'->0->>'release_id')::uuid <> r1
     or v_res->'items'->1->>'result' <> 'rejected' or v_res->'items'->1->'error'->>'code' <> '23514'
     or v_res->'items'->2->>'result' <> 'rolled_back' or (v_res->'items'->2->>'release_id')::uuid <> r2
     or v_res->'items'->0 ? 'change_set_id' then
    raise exception 'D2 FAIL: mixed batch report %', v_res;
  end if;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: rejected batch left changes'; end if;
  if exists (select 1 from private.catalog_change_sets where batch_id is not null) then raise exception 'D2 FAIL: rejected batch left audit'; end if;

  -- Versión desactualizada (40001), inexistente (P0002) y datos heredados (22023).
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('publish', jsonb_build_array(
    jsonb_build_object('release_id', r1, 'expected_version', 1),
    jsonb_build_object('release_id', r2, 'expected_version', 7),
    jsonb_build_object('release_id', gen_random_uuid(), 'expected_version', 1),
    jsonb_build_object('release_id', r7, 'expected_version', 1),
    jsonb_build_object('release_id', r6, 'expected_version', 1)), 'publicar con errores');
  reset role;
  -- r6 ya está publicado, pero con versión vieja tampoco cuenta como "sin cambios".
  if (v_res->>'applied')::boolean or (v_res->>'rejected_count')::int <> 4
     or v_res->'items'->0->>'result' <> 'rolled_back'
     or v_res->'items'->1->'error'->>'code' <> '40001'
     or v_res->'items'->2->'error'->>'code' <> 'P0002'
     or v_res->'items'->3->'error'->>'code' <> '22023'
     or v_res->'items'->4->'error'->>'code' <> '40001' then
    raise exception 'D2 FAIL: error codes report %', v_res;
  end if;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: batch with stale/missing items left changes'; end if;

  -- Archivar también es todo o nada.
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('archive', jsonb_build_array(
    jsonb_build_object('release_id', r5, 'expected_version', 1),
    jsonb_build_object('release_id', r6, 'expected_version', 1)), 'archivar con versión vieja');
  reset role;
  if (v_res->>'applied')::boolean or v_res->'items'->0->>'result' <> 'rolled_back' or v_res->'items'->1->'error'->>'code' <> '40001' then
    raise exception 'D2 FAIL: archive rollback report %', v_res;
  end if;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: rejected archive batch left changes'; end if;

  -- 4. Paridad con E06: lo que el lote rechaza, la operación individual también.
  v_snapshot := private.catalog_snapshot(r4) - 'id' - 'catalog_version';
  set local role authenticated;
  begin perform public.admin_update_catalog_release(r4, 1, v_snapshot, 'individual', 'publish'); raise exception 'D2 FAIL: E06 published r4 without cover'; exception when check_violation then null; end;
  reset role;
  v_snapshot := private.catalog_snapshot(r7) - 'id' - 'catalog_version';
  set local role authenticated;
  begin perform public.admin_update_catalog_release(r7, 1, v_snapshot, 'individual', 'publish'); raise exception 'D2 FAIL: E06 published r7 with http data'; exception when invalid_parameter_value then null; end;
  reset role;
  if pg_temp.d2_fingerprint(v_all) <> v_fp then raise exception 'D2 FAIL: parity probes changed state'; end if;

  -- 5. Lote válido: cada lanzamiento queda auditado como en E06 ------------------
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('publish', jsonb_build_array(
    jsonb_build_object('release_id', r3, 'expected_version', 1),
    jsonb_build_object('release_id', r1, 'expected_version', 1),
    jsonb_build_object('release_id', r6, 'expected_version', 2),
    jsonb_build_object('release_id', r2, 'expected_version', 1)), '  Publicación en lote revisada  ');
  reset role;
  v_batch := (v_res->>'batch_id')::uuid;
  if not (v_res->>'applied')::boolean or v_batch is null
     or (v_res->>'applied_count')::int <> 3 or (v_res->>'unchanged_count')::int <> 1 or (v_res->>'rejected_count')::int <> 0
     or (v_res->'items'->0->>'release_id')::uuid <> r3 or v_res->'items'->0->>'result' <> 'applied'
     or (v_res->'items'->0->>'catalog_version')::int <> 2 or v_res->'items'->0->>'change_set_id' is null
     or v_res->'items'->2->>'result' <> 'unchanged' or (v_res->'items'->2->>'catalog_version')::int <> 2 then
    raise exception 'D2 FAIL: valid batch report %', v_res;
  end if;
  if (select count(*) from public.releases where id in (r1, r2, r3) and status = 'published' and catalog_version = 2) <> 3
     or (select status || catalog_version from public.releases where id = r6) <> 'published2' then
    raise exception 'D2 FAIL: valid batch final state';
  end if;
  -- Exactamente un change set por lanzamiento cambiado, con la forma de E06.
  if (select count(*) from private.catalog_change_sets s
      join private.catalog_change_events e on e.change_set_id = s.id
      where s.batch_id = v_batch and s.operation = 'publish' and e.operation = 'publish'
        and s.actor_id = v_admin and e.actor_id = v_admin and s.reason = 'Publicación en lote revisada'
        and s.status = 'applied' and s.base_version = 1 and s.result_version = 2
        and e.before_state->>'status' = 'draft' and e.after_state->>'status' = 'published'
        and (e.after_state->>'catalog_version')::int = 2
        and e.before_state - 'status' - 'catalog_version' = e.after_state - 'status' - 'catalog_version'
        and s.entity_id = e.entity_id and s.entity_id in (r1, r2, r3)) <> 3
     or (select count(distinct entity_id) from private.catalog_change_sets where batch_id = v_batch) <> 3
     or (select count(*) from private.catalog_change_sets where entity_id = r6) <> 2
     or exists (select 1 from jsonb_array_elements(v_res->'items') x
       where x->>'result' = 'applied' and not exists (select 1 from private.catalog_change_sets s
         where s.id = (x->>'change_set_id')::uuid and s.entity_id = (x->>'release_id')::uuid and s.batch_id = v_batch)) then
    raise exception 'D2 FAIL: audit evidence for the batch';
  end if;

  -- El historial expone batch_id y la reversión individual de E06 sigue funcionando.
  set local role authenticated;
  v_res2 := public.admin_get_catalog_history(r1);
  if (v_res2->'items'->0->>'batch_id')::uuid <> v_batch or v_res2->'items'->0->>'operation' <> 'publish'
     or v_res2->'items'->1->'batch_id' <> 'null'::jsonb then
    raise exception 'D2 FAIL: history batch_id %', v_res2;
  end if;
  v_res2 := public.admin_revert_catalog_change((v_res->'items'->1->>'change_set_id')::uuid, 2, 'revertir uno del lote');
  if (v_res2->>'catalog_version')::int <> 3 then raise exception 'D2 FAIL: revert of a batch change %', v_res2; end if;
  reset role;
  if (select status from public.releases where id = r1) <> 'draft' then raise exception 'D2 FAIL: revert did not restore draft'; end if;

  -- Archivar en lote: no exige completitud, igual que la operación individual.
  set local role authenticated;
  v_res := public.admin_batch_update_catalog_releases('archive', jsonb_build_array(
    jsonb_build_object('release_id', r5, 'expected_version', 1),
    jsonb_build_object('release_id', r2, 'expected_version', 2)), 'archivar en lote');
  reset role;
  if not (v_res->>'applied')::boolean or (v_res->>'applied_count')::int <> 2
     or (v_res->>'batch_id')::uuid = v_batch
     or (select count(*) from public.releases where id in (r5, r2) and status = 'archived') <> 2
     or (select count(*) from private.catalog_change_sets where batch_id = (v_res->>'batch_id')::uuid and operation = 'archive' and actor_id = v_admin) <> 2 then
    raise exception 'D2 FAIL: archive batch %', v_res;
  end if;

  -- 6. Señales y vistas rápidas -------------------------------------------------
  insert into public.problem_reports (author_id, category, description, page_url, release_id, technical_context, status)
  select v_community, 'catalog_error', 'D2 ' || s, '/lanzamiento/x', rel, jsonb_build_object(
      'route', '/lanzamiento/x', 'timestamp', now()::text, 'app_version', 'd2', 'catalog_source', 'canonical',
      'user_agent', 'psql', 'viewport', jsonb_build_object('w', 1, 'h', 1), 'locale', 'es', 'online', true), s
  from (values (r3, 'new'), (r3, 'triaged'), (r3, 'in_progress'), (r3, 'resolved'), (r3, 'closed'),
               (r4, 'resolved'), (r4, 'closed'), (r6, 'new')) v(rel, s);

  if private.catalog_release_signals(r3) <> jsonb_build_object('draft', false, 'incomplete', false, 'missing_fields', '[]'::jsonb, 'missing_cover', false, 'open_report_count', 3)
     or private.catalog_release_signals(r4) <> jsonb_build_object('draft', true, 'incomplete', true, 'missing_fields', '["cover"]'::jsonb, 'missing_cover', true, 'open_report_count', 0)
     or private.catalog_release_signals(r5) <> jsonb_build_object('draft', false, 'incomplete', true, 'missing_fields', '["label","country","primary_link"]'::jsonb, 'missing_cover', false, 'open_report_count', 0)
     or private.catalog_release_signals(r7) <> jsonb_build_object('draft', true, 'incomplete', true, 'missing_fields', '["cover","primary_link"]'::jsonb, 'missing_cover', true, 'open_report_count', 0)
     or private.catalog_release_signals(r6)->>'open_report_count' <> '1' then
    raise exception 'D2 FAIL: signals r3=% r4=% r5=% r7=%', private.catalog_release_signals(r3), private.catalog_release_signals(r4), private.catalog_release_signals(r5), private.catalog_release_signals(r7);
  end if;
  -- Cada requisito de publicación se detecta por separado (sobre una copia descartable).
  insert into public.releases (slug, title, status) values ('d2-vacio', 'D2 vacío', 'draft');
  if private.catalog_release_missing_fields((select id from public.releases where slug = 'd2-vacio'))
     <> array['release_date','release_type','label','primary_artist','genre','country','cover','primary_link'] then
    raise exception 'D2 FAIL: empty release missing fields %', private.catalog_release_missing_fields((select id from public.releases where slug = 'd2-vacio'));
  end if;
  delete from public.releases where slug = 'd2-vacio';

  set local role authenticated;
  v_snapshot := public.admin_get_catalog_release(r4);
  if v_snapshot->'signals'->'missing_fields' <> '["cover"]'::jsonb or not v_snapshot ? 'source' or not v_snapshot ? 'updated_at' then
    raise exception 'D2 FAIL: admin snapshot signals %', v_snapshot;
  end if;
  v_res := public.admin_list_catalog_releases(p_quick_view => 'missing_cover', p_order_key => 'slug', p_order_direction => 'asc');
  if (v_res->>'total')::int <> 2 or v_res->>'quick_view' <> 'missing_cover'
     or (select array_agg((x->>'id')::uuid order by n) from jsonb_array_elements(v_res->'items') with ordinality t(x, n)) <> array[r4, r7]
     or v_res->'items'->0->'signals'->>'missing_cover' <> 'true' then
    raise exception 'D2 FAIL: missing_cover view %', v_res;
  end if;
  v_res := public.admin_list_catalog_releases(p_quick_view => ' Incomplete ', p_order_key => 'slug', p_order_direction => 'asc');
  if (select array_agg((x->>'id')::uuid order by n) from jsonb_array_elements(v_res->'items') with ordinality t(x, n)) <> array[r5, r4, r7] then
    raise exception 'D2 FAIL: incomplete view %', v_res;
  end if;
  v_res := public.admin_list_catalog_releases(p_quick_view => 'draft', p_order_key => 'slug', p_order_direction => 'asc');
  if (select array_agg((x->>'id')::uuid order by n) from jsonb_array_elements(v_res->'items') with ordinality t(x, n)) <> array[r4, r7, r1] then
    raise exception 'D2 FAIL: draft view %', v_res;
  end if;
  v_res := public.admin_list_catalog_releases(p_quick_view => 'open_reports', p_order_key => 'slug', p_order_direction => 'asc');
  if (select array_agg((x->>'id')::uuid order by n) from jsonb_array_elements(v_res->'items') with ordinality t(x, n)) <> array[r6, r3] then
    raise exception 'D2 FAIL: open_reports view %', v_res;
  end if;
  -- Se combina con los filtros existentes y con la búsqueda.
  v_res := public.admin_list_catalog_releases(p_query => 'cuatro', p_statuses => array['draft'], p_quick_view => 'incomplete');
  if (v_res->>'total')::int <> 1 or (v_res->'items'->0->>'id')::uuid <> r4 then raise exception 'D2 FAIL: combined filters %', v_res; end if;
  -- Sin vista rápida, la lista de E06 no cambia (los llamadores de 8 argumentos siguen sirviendo).
  v_res := public.admin_list_catalog_releases(null, null, null, null, 1, 25, 'slug', 'asc');
  if (v_res->>'total')::int <> 7 or v_res->'quick_view' <> 'null'::jsonb then raise exception 'D2 FAIL: list without quick view %', v_res; end if;
  begin perform public.admin_list_catalog_releases(p_quick_view => 'reportes'); raise exception 'D2 FAIL: accepted unknown quick view'; exception when invalid_parameter_value then null; end;

  v_res := public.admin_catalog_quick_view_counts();
  if v_res - 'statuses' <> jsonb_build_object('total', 7, 'draft', 3, 'incomplete', 3, 'missing_cover', 2, 'open_reports', 2) then
    raise exception 'D2 FAIL: counts %', v_res;
  end if;
  v_res := public.admin_catalog_quick_view_counts(array['draft']);
  if v_res - 'statuses' <> jsonb_build_object('total', 3, 'draft', 3, 'incomplete', 2, 'missing_cover', 2, 'open_reports', 0) then
    raise exception 'D2 FAIL: counts by status %', v_res;
  end if;
  reset role;

  -- 7. Límite: 50 elementos en un lote se aplican; mide la duración --------------
  set local role authenticated;
  for i in 1..50 loop
    v_extra := v_extra || (public.admin_create_catalog_release(v_complete || jsonb_build_object('title', 'D2 extra ' || i, 'slug', 'd2-extra-' || i), 'fixture')->>'release_id')::uuid;
  end loop;
  v_started := clock_timestamp();
  v_res := public.admin_batch_update_catalog_releases('publish',
    (select jsonb_agg(jsonb_build_object('release_id', id, 'expected_version', 1) order by n) from unnest(v_extra) with ordinality t(id, n)), 'lote máximo');
  v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
  reset role;
  if not (v_res->>'applied')::boolean or (v_res->>'applied_count')::int <> 50
     or (select count(*) from private.catalog_change_sets where batch_id = (v_res->>'batch_id')::uuid) <> 50 then
    raise exception 'D2 FAIL: 50-item batch %', v_res - 'items';
  end if;
  raise notice 'D2: lote de 50 publicado en % ms', round(v_ms);

  -- El mismo lote con el último elemento inválido: 49 escrituras y nada queda.
  v_fp := pg_temp.d2_fingerprint(v_extra);
  set local role authenticated;
  v_started := clock_timestamp();
  v_res := public.admin_batch_update_catalog_releases('archive',
    (select jsonb_agg(jsonb_build_object('release_id', id, 'expected_version', case when n = 50 then 1 else 2 end) order by n) from unnest(v_extra) with ordinality t(id, n)), 'lote máximo con error al final');
  v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
  reset role;
  if (v_res->>'applied')::boolean or (v_res->>'rolled_back_count')::int <> 49 or (v_res->>'rejected_count')::int <> 1
     or v_res->'items'->49->'error'->>'code' <> '40001' or pg_temp.d2_fingerprint(v_extra) <> v_fp then
    raise exception 'D2 FAIL: 50-item rollback %', v_res - 'items';
  end if;
  raise notice 'D2: lote de 50 rechazado (49 deshechos) en % ms', round(v_ms);

  raise notice 'D2 verify: OK';
end;
$$;

rollback;
