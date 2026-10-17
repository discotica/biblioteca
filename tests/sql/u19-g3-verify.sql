-- U19 G3: la cola en el editor (migración 20261016120000). Nombres nuevos al guardar en el editor del
-- catálogo, resolución de nombres para el editor de propuestas, el colaborador sin catálogo y la
-- secuencia de «tomada» con dos sesiones (autor y colaborador).
-- Transaccional: crea sus usuarios (admin, colaborador y dos de comunidad), comprueba y termina con
-- ROLLBACK. Requiere G1 (20261015190000–190200).
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/u19-g3-verify.sql
-- Imprime "U19 G3 verify: OK (n comprobaciones)" o aborta con "U19G3 FAIL: …".
-- En staging (G5) corre igual: solo usa nombres con el prefijo «U19G3».
begin;

create temp table u19_checks (n serial, label text);
grant all on u19_checks to anon, authenticated;
grant all on sequence u19_checks_n_seq to anon, authenticated;

create function pg_temp.ok(p_condition boolean, p_label text) returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'U19G3 FAIL: %', p_label; end if;
  insert into u19_checks (label) values (p_label);
end $$;

-- Ejecuta p_sql como p_user (null = anon) y devuelve 'ok' o 'SQLSTATE mensaje'.
create function pg_temp.attempt(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text := 'ok';
begin
  if p_user is null then
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  begin
    execute p_sql;
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  execute 'reset role';
  return v;
end $$;

create function pg_temp.expect(p_user uuid, p_sql text, p_prefix text, p_label text) returns void language plpgsql as $$
declare v text := pg_temp.attempt(p_user, p_sql);
begin
  if v not like p_prefix || '%' then raise exception 'U19G3 FAIL: % (esperado «%», obtenido «%»)', p_label, p_prefix, v; end if;
  insert into u19_checks (label) values (p_label);
end $$;

-- Ejecuta una consulta como p_user y devuelve su primera fila como jsonb.
create function pg_temp.run(p_user uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute format('select to_jsonb(x) from (%s) x', p_sql) into v;
  execute 'reset role';
  return v;
end $$;

create function pg_temp.v3(p_title text, p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('version', 3, 'title', p_title, 'primary_artists', jsonb_build_array('U19G3 Artista ' || p_title),
    'collaborators', '[]'::jsonb, 'release_type', 'compilado', 'release_date', '2026-10-16',
    'genres', jsonb_build_array('Techno'), 'countries', jsonb_build_array('Colombia'), 'label', 'U19G3 Sello ' || p_title) || p_extra;
$$;

create function pg_temp.lit(p jsonb) returns text language sql as $$ select quote_literal(p::text) || '::jsonb' $$;

do $$
declare
  admin_id uuid := gen_random_uuid(); colab_id uuid := gen_random_uuid(); author_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  c jsonb; r jsonb; v_release uuid; v_existing uuid; v_kept uuid; v_snapshot jsonb; v_payload jsonb; v_version integer; v_id uuid;
  v_spain uuid; v_colombia uuid; v_new uuid; v_label uuid; v_updated text; v_user uuid; v_label_text text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g3-admin@u19.test', jsonb_build_object('username', 'u19g3admin'), now(), now()),
    (colab_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g3-colab@u19.test', jsonb_build_object('username', 'u19g3colab'), now(), now()),
    (author_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g3-author@u19.test', jsonb_build_object('username', 'u19g3author'), now(), now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g3-other@u19.test', jsonb_build_object('username', 'u19g3other'), now(), now());
  update public.profiles set role = 'admin' where id = admin_id;
  update public.profiles set role = 'colaborador' where id = colab_id;
  perform pg_temp.ok((select role from public.profiles where id = author_id) = 'comunidad', '0.1 fixtures de comunidad');

  insert into public.artists (name, normalized_name, slug) values ('U19G3 Existente', 'u19g3 existente', 'u19g3-existente') returning id into v_existing;
  insert into public.artists (name, normalized_name, slug) values ('U19G3 Conservado', 'u19g3 conservado', 'u19g3-conservado') returning id into v_kept;
  insert into public.artist_aliases (artist_id, name) values (v_kept, 'U19G3 Grafía Vieja');
  insert into public.labels (name, normalized_name, slug) values ('U19G3 Sello Conservado', 'u19g3 sello conservado', 'u19g3-sello-conservado');
  insert into public.label_aliases (label_id, name) select id, 'U19G3 Sello Viejo' from public.labels where name = 'U19G3 Sello Conservado';
  select id into v_spain from public.countries where name = 'España';
  select id into v_colombia from public.countries where name = 'Colombia';

  -- 1. Permisos de resolve_catalog_names ----------------------------------------------------------------
  perform pg_temp.ok(not has_function_privilege('anon', 'public.resolve_catalog_names(text,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.resolve_catalog_names(text,jsonb)', 'execute'), '1.1 resolve_catalog_names: solo authenticated');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'private.resolve_catalog_pending_names(jsonb,text)', 'execute'), '1.2 la resolución de nombres nuevos es privada');
  perform pg_temp.expect(null, 'select public.resolve_catalog_names(''artist'', ''["x"]'')', '42501', '1.3 anon no resuelve nombres');

  -- 2. Qué nombres ya existen ---------------------------------------------------------------------------
  r := pg_temp.run(author_id, 'select public.resolve_catalog_names(''artist'', ''["u19g3 EXISTENTE", "U19G3 grafia vieja", "U19G3 Nadie"]'') as r')->'r';
  perform pg_temp.ok(jsonb_array_length(r) = 3 and r->0->>'name' = 'u19g3 EXISTENTE' and (r->0->>'id')::uuid = v_existing and r->0->>'canonical' = 'U19G3 Existente',
    '2.1 un nombre existe sin distinguir mayúsculas, en el mismo orden');
  perform pg_temp.ok((r->1->>'id')::uuid = v_kept and r->1->>'canonical' = 'U19G3 Conservado', '2.2 el alias se resuelve al valor conservado');
  perform pg_temp.ok(r->2->'id' = 'null'::jsonb and r->2->'canonical' = 'null'::jsonb, '2.3 un nombre nuevo vuelve sin id');
  r := pg_temp.run(colab_id, 'select public.resolve_catalog_names(''label'', ''["U19G3 sello viejo"]'') as r')->'r';
  perform pg_temp.ok(r->0->>'canonical' = 'U19G3 Sello Conservado', '2.4 sellos: también por alias');
  perform pg_temp.expect(author_id, 'select public.resolve_catalog_names(''genre'', ''["Techno"]'')', '22023', '2.5 solo artistas y sellos');
  perform pg_temp.expect(author_id, 'select public.resolve_catalog_names(''artist'', ''[1]'')', '22023', '2.6 solo nombres de texto');
  perform pg_temp.expect(author_id, format('select public.resolve_catalog_names(''artist'', %L::jsonb)', (select jsonb_agg('n' || g) from generate_series(1, 201) g)), '22023', '2.7 como mucho 200 nombres');

  -- 3. Nombres nuevos al guardar en el editor del catálogo -----------------------------------------------
  r := pg_temp.run(admin_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s, %s, %L) as r', 'https://u19g3.bandcamp.com/album/base', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Base')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19g3-base.jpg"}'), 'Base G3'))->'r';
  v_release := (r->>'release_id')::uuid;
  v_snapshot := pg_temp.run(admin_id, format('select public.admin_get_catalog_release(%L) as r', v_release))->'r';
  v_version := (v_snapshot->>'catalog_version')::int;
  v_payload := (v_snapshot - 'id' - 'catalog_version' - 'updated_at' - 'source' - 'signals')
    || jsonb_build_object('artist_ids', jsonb_build_array(v_existing, jsonb_build_object('name', 'U19G3 Nuevo')),
      'collaborator_ids', jsonb_build_array(jsonb_build_object('name', 'u19g3 grafia vieja')),
      'label_id', null, 'label_name', 'U19G3 Sello Nuevo');
  r := pg_temp.run(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L) as r', v_release, v_version, pg_temp.lit(v_payload), 'créditos nuevos'))->'r';
  select id into v_new from public.artists where name = 'U19G3 Nuevo';
  select id into v_label from public.labels where name = 'U19G3 Sello Nuevo';
  perform pg_temp.ok(v_new is not null and (select array_agg(artist_id order by position) from public.release_artists where release_id = v_release and role = 'primary') = array[v_existing, v_new],
    '3.1 el artista nuevo se crea al guardar, en su posición');
  perform pg_temp.ok((select array_agg(artist_id) from public.release_artists where release_id = v_release and role = 'collaborator') = array[v_kept]
    and not exists (select 1 from public.artists where private.normalize_catalog_artist_name(name) = 'u19g3 grafia vieja'), '3.2 un nombre que es alias usa el valor conservado');
  perform pg_temp.ok((select label_id from public.releases where id = v_release) = v_label, '3.3 el sello nuevo se crea al guardar');
  perform pg_temp.ok(exists (select 1 from private.catalog_artist_change_events where artist_id = v_new and actor_id = admin_id and operation = 'create'), '3.4 el alta del artista queda auditada');
  perform pg_temp.ok(exists (select 1 from private.catalog_dictionary_change_events e where e.entity_id = v_label and e.reason = 'créditos nuevos'), '3.5 el alta del sello lleva la observación del cambio');
  perform pg_temp.ok((select after_state->'artist_ids' from private.catalog_change_events e join private.catalog_change_sets s on s.id = e.change_set_id where s.id = (r->>'change_set_id')::uuid)
    = jsonb_build_array(v_existing, v_new), '3.6 el historial guarda los UUID, no los nombres');
  v_version := (r->>'catalog_version')::int;
  v_payload := v_payload || jsonb_build_object('artist_ids', jsonb_build_array(v_existing, v_new), 'collaborator_ids', jsonb_build_array(v_kept), 'label_id', v_label, 'label_name', 'U19G3 Ignorado');
  r := pg_temp.run(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L) as r', v_release, v_version, pg_temp.lit(v_payload), 'con sello'))->'r';
  perform pg_temp.ok((select label_id from public.releases where id = v_release) = v_label and not exists (select 1 from public.labels where name = 'U19G3 Ignorado'), '3.7 con label_id, label_name se ignora');
  v_version := (r->>'catalog_version')::int;
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_release, v_version,
    pg_temp.lit(v_payload || jsonb_build_object('artist_ids', jsonb_build_array(v_existing, jsonb_build_object('name', 'u19g3 existente')))), 'duplicado'),
    '23505 credit_duplicate', '3.8 un nombre nuevo que ya es crédito se rechaza');
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_release, v_version,
    pg_temp.lit(v_payload || jsonb_build_object('artist_ids', jsonb_build_array(jsonb_build_object('nombre', 'x')))), 'forma'), '22023', '3.9 un crédito nuevo sin nombre se rechaza');
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_release, v_version,
    pg_temp.lit(v_payload || jsonb_build_object('artist_ids', jsonb_build_array(jsonb_build_object('name', 'U19G3 Atómico')), 'label_id', null, 'label_name', 'U19G3 Sello Atómico',
      'country_ids', jsonb_build_array(v_spain))), 'atómico'), '22023 country_not_selectable', '3.10 un guardado que falla…');
  perform pg_temp.ok(not exists (select 1 from public.artists where name = 'U19G3 Atómico') and not exists (select 1 from public.labels where name = 'U19G3 Sello Atómico'),
    '3.11 …no deja artistas ni sellos creados');
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_release, v_version - 1, pg_temp.lit(v_payload), 'vieja'), '40001', '3.12 la versión se comprueba antes de crear nada');
  r := pg_temp.run(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L, %L) as r', v_release, v_version,
    pg_temp.lit(v_payload || jsonb_build_object('label_id', null, 'label_name', 'U19G3 sello viejo')), 'publica', 'publish'))->'r';
  perform pg_temp.ok((select status from public.releases where id = v_release) = 'published'
    and (select l.name from public.releases x join public.labels l on l.id = x.label_id where x.id = v_release) = 'U19G3 Sello Conservado',
    '3.13 publicar con un sello por nombre (alias) cumple la regla de publicado');
  v_version := (r->>'catalog_version')::int;

  -- 4. El colaborador corrige sin catálogo: el servidor lo garantiza ---------------------------------------
  foreach v_user in array array[colab_id, author_id, null::uuid] loop
    v_label_text := coalesce((select role from public.profiles where id = v_user), 'anon');
    perform pg_temp.expect(v_user, 'select public.admin_list_catalog_releases(null, null, null, null, 1, 25, ''release_date'', ''desc'', null)', '42501', '4.1 ' || v_label_text || ': no lista el catálogo administrativo');
    perform pg_temp.expect(v_user, format('select public.admin_get_catalog_release(%L)', v_release), '42501', '4.2 ' || v_label_text || ': no lee un lanzamiento administrativo');
    perform pg_temp.expect(v_user, format('select public.admin_get_catalog_history(%L)', v_release), '42501', '4.3 ' || v_label_text || ': no lee el historial');
    perform pg_temp.expect(v_user, 'select public.admin_catalog_quick_view_counts(null)', '42501', '4.4 ' || v_label_text || ': no lee los conteos');
    perform pg_temp.expect(v_user, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_release, v_version,
      pg_temp.lit(v_payload || jsonb_build_object('artist_ids', jsonb_build_array(jsonb_build_object('name', 'U19G3 Intruso')))), 'intruso'), '42501', '4.5 ' || v_label_text || ': no guarda en el catálogo');
    perform pg_temp.expect(v_user, format('select public.admin_update_catalog_release(%L, %s, %s, %L, %L)', v_release, v_version, pg_temp.lit(v_payload), 'publica', 'publish'), '42501', '4.6 ' || v_label_text || ': no publica');
    perform pg_temp.expect(v_user, format('select public.admin_batch_update_catalog_releases(%L, %s, %L)', 'publish', pg_temp.lit(jsonb_build_array(jsonb_build_object('release_id', v_release, 'expected_version', v_version))), 'lote'), '42501', '4.7 ' || v_label_text || ': no publica en lote');
    perform pg_temp.expect(v_user, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://u19g3.bandcamp.com/album/intruso', 'bandcamp', pg_temp.lit(pg_temp.v3('Intruso'))), '42501', '4.8 ' || v_label_text || ': no crea borradores del catálogo');
  end loop;
  perform pg_temp.ok(not exists (select 1 from public.artists where name = 'U19G3 Intruso'), '4.9 los intentos denegados no crean artistas');

  -- 5. «Tomada» con dos sesiones: el autor edita, el colaborador corrige, el autor ya no ----------------------
  c := pg_temp.run(author_id, format('select * from public.create_contribution_draft(%L, %L, %s)', 'https://u19g3.bandcamp.com/album/compilado', 'bandcamp', pg_temp.lit(pg_temp.v3('Compilado'))));
  v_id := (c->>'id')::uuid;
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s, %s)', v_id, 'https://u19g3.bandcamp.com/album/compilado', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Compilado', '{"team_note":"Nota del autor"}')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19g3-compilado.jpg"}')));
  c := pg_temp.run(author_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s, %s)', v_id, 'https://u19g3.bandcamp.com/album/compilado', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Compilado del autor', '{"team_note":"Nota del autor"}')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19g3-compilado.jpg"}')));
  perform pg_temp.ok(c->>'taken_at' is null and c->'payload'->>'title' = 'Compilado del autor', '5.1 sesión del autor: edita mientras nadie la toma');
  -- El colaborador la abre (solo lectura): abrirla no la toma.
  v_updated := pg_temp.run(colab_id, format('select updated_at::text as u from public.contributions where id = %L', v_id))->>'u';
  perform pg_temp.ok((select taken_at is null from public.contributions where id = v_id), '5.2 abrirla para mirar no la toma');
  -- El colaborador guarda sin nota, como el editor: la corrección no deja texto para el autor.
  c := pg_temp.run(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_updated,
    pg_temp.lit(pg_temp.v3('Compilado corregido', '{"team_note":"Nota del autor","primary_artists":["U19G3 Existente","U19G3 Artista Nueva Uno","U19G3 Artista Nueva Dos"]}'))));
  perform pg_temp.ok(c->>'taken_at' is not null and c->'payload'->>'title' = 'Compilado corregido' and c->'payload'->>'team_note' = 'Nota del autor', '5.3 sesión del colaborador: corrige y la toma');
  perform pg_temp.expect(author_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19g3.bandcamp.com/album/compilado', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Compilado del autor otra vez'))), '55000 contribution_taken', '5.4 sesión del autor: el siguiente guardado falla con contribution_taken');
  perform pg_temp.ok((select payload->>'title' from public.contributions where id = v_id) = 'Compilado corregido', '5.5 la corrección del colaborador se conserva');
  -- (El conflicto de versión lo prueba G1 5.4; aquí no se puede: dentro de una transacción now() no cambia.)
  -- Marcar lista con la propuesta ya guardada: payload vacío y nota interna.
  c := pg_temp.run(colab_id, format('select * from public.prepare_contribution_for_admin(%L, %L::jsonb, %L)', v_id, '{}', 'Nota interna U19G3'));
  perform pg_temp.ok(c->>'status' = 'ready_for_admin' and c->'payload'->>'title' = 'Compilado corregido', '5.7 marcar lista sin payload conserva la corrección');
  perform pg_temp.ok(not exists (select 1 from public.contribution_events where contribution_id = v_id and coalesce(note, '') like '%Nota interna U19G3%'),
    '5.8 la nota interna no queda en el historial que lee el autor');
  perform pg_temp.ok((pg_temp.run(author_id, format('select count(*) as n from public.contribution_events where contribution_id = %L and action = ''corrected'' and note is not null', v_id))->>'n')::int = 0,
    '5.9 el autor no lee notas de la corrección');
  -- Admin acepta como borrador: los artistas nuevos del compilado entran en los créditos.
  v_updated := c->>'updated_at';
  r := pg_temp.run(admin_id, format('select public.accept_contribution(%L, false, %L, %L) as r', v_id, v_updated, 'Gracias'))->'r';
  perform pg_temp.ok(r->>'status' = 'draft' and (select string_agg(a.name, ' | ' order by ra.position) from public.release_artists ra join public.artists a on a.id = ra.artist_id
    where ra.release_id = (r->>'release_id')::uuid and ra.role = 'primary') = 'U19G3 Existente | U19G3 Artista Nueva Uno | U19G3 Artista Nueva Dos',
    '5.10 aceptar como borrador: el compilado trae sus artistas nuevos en los créditos (U19-01)');
  perform pg_temp.ok((select reviewer_note from public.contributions where id = v_id) = 'Gracias', '5.11 la nota de la decisión es la que ve el autor');

  raise notice 'U19 G3 verify: OK (% comprobaciones)', (select count(*) from u19_checks);
end $$;

rollback;
