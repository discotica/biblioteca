-- U19 G1: listas cerradas, alias, propuesta v3, corrección y bloqueo, aceptar, alta directa de admin,
-- duplicados por enlace e importación (migraciones 20261015190000, 20261015190100 y 20261015190200).
-- Transaccional: crea sus usuarios (admin, colaborador y dos de comunidad), comprueba y termina con
-- ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/u19-g1-verify.sql
-- Imprime "U19 G1 verify: OK (n comprobaciones)" o aborta con "U19G1 FAIL: …".
-- En staging (G5) corre igual: no depende de que los diccionarios estén vacíos.
begin;

create temp table u19_checks (n serial, label text);
grant all on u19_checks to anon, authenticated;
grant all on sequence u19_checks_n_seq to anon, authenticated;

create function pg_temp.ok(p_condition boolean, p_label text) returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'U19G1 FAIL: %', p_label; end if;
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
  if v not like p_prefix || '%' then raise exception 'U19G1 FAIL: % (esperado «%», obtenido «%»)', p_label, p_prefix, v; end if;
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

-- Propuesta v3 completa; p_extra la modifica.
create function pg_temp.v3(p_title text, p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('version', 3, 'title', p_title, 'primary_artists', jsonb_build_array('U19 Artista ' || p_title),
    'collaborators', jsonb_build_array('U19 Colaborador ' || p_title), 'release_type', 'ep', 'release_date', '2026-10-15',
    'genres', jsonb_build_array('Techno', 'house'), 'countries', jsonb_build_array('Colombia'), 'label', 'U19 Sello ' || p_title,
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5)) || p_extra;
$$;

create function pg_temp.lit(p jsonb) returns text language sql as $$ select quote_literal(p::text) || '::jsonb' $$;

-- Payload de importación (forma de scripts/import-catalog.mjs).
create function pg_temp.sheet(p_key text, p_genres text[], p_countries text[], p_label text default 'U19 Sello hoja') returns jsonb language sql as $$
  select jsonb_build_object(
    'source_name', 'u19-sheet', 'source_key', p_key, 'source_hash', encode(sha256(convert_to(p_key, 'UTF8')), 'hex'),
    'slug', 'u19-' || p_key, 'legacy_slug', 'u19-' || p_key || '-legado', 'title', 'U19 hoja ' || p_key, 'release_date', '2026-10-15',
    'type', 'EP', 'label', p_label, 'label_key', lower(p_label), 'label_slug', 'u19-' || substr(md5(lower(p_label)), 1, 12), 'review', '', 'status', 'published',
    'primary_artists', jsonb_build_array(jsonb_build_object('name', 'U19 Artista hoja', 'key', 'u19 artista hoja', 'slug', 'u19-artista-hoja')),
    'collaborators', '[]'::jsonb, 'credit_quality', 'legacy',
    'genres', (select coalesce(jsonb_agg(jsonb_build_object('name', g, 'key', lower(g), 'slug', 'x-' || md5(g))), '[]') from unnest(p_genres) g),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('name', c, 'key', lower(c), 'slug', 'x-' || md5(c))), '[]') from unnest(p_countries) c),
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5),
    'buy_link', 'https://u19.bandcamp.com/album/' || p_key, 'provider', 'bandcamp', 'cover', 'https://f4.bcbits.com/img/u19-' || p_key || '.jpg');
$$;

do $$
declare
  admin_id uuid := gen_random_uuid(); colab_id uuid := gen_random_uuid(); author_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  c jsonb; r jsonb; v_id uuid; v_id2 uuid; v_id3 uuid; v_release uuid; v_release2 uuid;
  v_spain uuid; v_canada uuid; v_colombia uuid; v_imported uuid; v_snapshot jsonb; v_change uuid; v_version integer; v_payload jsonb;
  v_count integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19-admin@u19.test', jsonb_build_object('username', 'u19admin'), now(), now()),
    (colab_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19-colab@u19.test', jsonb_build_object('username', 'u19colab'), now(), now()),
    (author_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19-author@u19.test', jsonb_build_object('username', 'u19author'), now(), now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19-other@u19.test', jsonb_build_object('username', 'u19other'), now(), now());
  update public.profiles set role = 'admin' where id = admin_id;
  update public.profiles set role = 'colaborador' where id = colab_id;
  perform pg_temp.ok((select role from public.profiles where id = author_id) = 'comunidad' and (select role from public.profiles where id = other_id) = 'comunidad', '0.1 fixtures de comunidad');

  -- 1. Diccionarios ----------------------------------------------------------------------------------
  perform pg_temp.ok((select count(*) from public.genres where status = 'selectable') = 36, '1.1 36 géneros seleccionables');
  perform pg_temp.ok((select count(*) from public.countries where status = 'selectable') = 35, '1.2 35 países seleccionables');
  perform pg_temp.ok((select count(*) from public.countries where status = 'legacy') = 20, '1.3 20 países de legado');
  perform pg_temp.ok((select array_agg(name order by name) from public.countries where name in ('Haití', 'República Dominicana', 'LATAM', 'Surinam', 'Puerto Rico') and status = 'selectable')
    = array['Haití', 'LATAM', 'Puerto Rico', 'República Dominicana', 'Surinam'], '1.4 seleccionables con tilde, Puerto Rico y LATAM');
  perform pg_temp.ok((select status from public.countries where name = 'Canadá') = 'legacy' and (select status from public.countries where name = 'Líbano') = 'legacy', '1.5 legado con tilde');
  perform pg_temp.ok(not exists (select 1 from public.countries where private.normalize_catalog_dictionary_name(name) in ('ee.uu', 'eeuu', 'usa', 'uk')), '1.6 grafías duplicadas fusionadas');
  perform pg_temp.ok((select string_agg(a.name || '>' || c.name, ',' order by a.name) from public.country_aliases a join public.countries c on c.id = a.country_id)
    = 'EE.UU>Estados Unidos,EEUU>Estados Unidos,UK>Reino Unido,USA>Estados Unidos', '1.7 alias de país sembrados');
  perform pg_temp.ok((select name from private.resolve_catalog_country(' usa ')) = 'Estados Unidos', '1.8 el resolver traduce el alias');
  perform pg_temp.ok((select name from private.resolve_catalog_genre('REGUETON')) = 'Reguetón', '1.9 el resolver ignora mayúsculas y tildes');
  perform pg_temp.expect(null, 'select count(*) from public.country_aliases', 'ok', '1.10 anon lee alias de nombre');
  perform pg_temp.expect(null, 'select count(*) from public.label_slug_aliases', 'ok', '1.11 anon lee alias de slug');
  perform pg_temp.expect(null, 'select status from public.countries limit 1', 'ok', '1.12 anon lee el estado de los países');
  perform pg_temp.expect(author_id, 'insert into public.genre_aliases (genre_id, name) select id, ''U19 alias'' from public.genres limit 1', '42501', '1.13 comunidad no escribe alias');
  perform pg_temp.expect(colab_id, 'insert into public.artist_slug_aliases (slug, artist_id) select ''u19-slug'', id from public.artists limit 1', '42501', '1.14 colaborador no escribe alias de slug');
  perform pg_temp.expect(admin_id, 'insert into public.country_aliases (country_id, name) select id, ''U19 alias'' from public.countries limit 1', '42501', '1.15 ni admin escribe alias por la tabla');
  perform pg_temp.expect(admin_id, 'update public.genres set status = ''legacy''', '42501', '1.16 nadie cambia el estado por la tabla');
  begin
    insert into public.country_aliases (country_id, name) select id, 'COLOMBIA' from public.countries where name = 'Chile';
    raise exception 'U19G1 FAIL: 1.17 alias con el nombre de un valor vivo';
  exception when unique_violation then perform pg_temp.ok(true, '1.17 un alias no puede llamarse como un valor vivo');
  end;
  -- Alias de prueba para las secciones siguientes (como los dejará G4).
  insert into public.country_aliases (country_id, name) select id, 'Méjico' from public.countries where name = 'México';
  insert into public.genre_aliases (genre_id, name) select id, 'Tecno' from public.genres where name = 'Techno';
  insert into public.artists (name, normalized_name, slug) values ('U19 Conservado', 'u19 conservado', 'u19-conservado');
  insert into public.artist_aliases (artist_id, name) select id, 'U19 Grafia Vieja' from public.artists where name = 'U19 Conservado';
  insert into public.labels (name, normalized_name, slug) values ('U19 Sello Conservado', 'u19 sello conservado', 'u19-sello-conservado');
  insert into public.label_aliases (label_id, name) select id, 'U19 Sello Viejo' from public.labels where name = 'U19 Sello Conservado';
  insert into public.countries (name, normalized_name, slug, status) values ('U19 Retirado', 'u19 retirado', 'u19-retirado', 'retired');

  -- 2. Permisos de ejecución ------------------------------------------------------------------------
  perform pg_temp.ok(not has_function_privilege('anon', p, 'execute') and has_function_privilege('authenticated', p, 'execute'), '2 ' || p)
  from unnest(array['public.update_submitted_contribution(uuid,text,text,jsonb,jsonb)', 'public.save_contribution_correction(uuid,timestamptz,jsonb,text,text,text)',
    'public.accept_contribution(uuid,boolean,timestamptz,text)', 'public.admin_create_draft_from_suggestion(text,text,jsonb,jsonb,text)',
    'public.check_source_duplicate(text)', 'public.create_contribution_draft(text,text,jsonb,jsonb)', 'public.submit_contribution(uuid,text,text,jsonb,jsonb)',
    'public.review_contribution(uuid,text,text)', 'public.prepare_contribution_for_admin(uuid,jsonb,text)']) p;
  perform pg_temp.ok(not has_function_privilege('authenticated', p, 'execute'), '2 privada ' || p)
  from unnest(array['private.contribution_payload_v3(jsonb,boolean,text,jsonb)', 'private.ensure_catalog_artist(text)', 'private.ensure_catalog_label(text,text)',
    'private.resolve_catalog_country(text)', 'private.accept_contribution_core(uuid,boolean,timestamptz,boolean,text)', 'private.normalize_source_url(text)']) p;
  perform pg_temp.expect(null, 'select public.check_source_duplicate(''https://x.bandcamp.com/album/a'')', '42501', '2.1 anon no consulta duplicados');
  perform pg_temp.expect(null, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://x.bandcamp.com/album/a', 'bandcamp', pg_temp.lit(pg_temp.v3('anon'))), '42501', '2.2 anon no crea borradores de catálogo');
  perform pg_temp.expect(null, format('select * from public.create_contribution_draft(%L, %L, %s)', 'https://x.bandcamp.com/album/a', 'bandcamp', pg_temp.lit(pg_temp.v3('anon'))), '42501', '2.3 anon no crea propuestas');

  -- 3. Autor: contrato v3 ---------------------------------------------------------------------------
  c := pg_temp.run(author_id, format('select * from public.create_contribution_draft(%L, %L, %s)', 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit('{"version":2,"title":"  U19   parcial "}'::jsonb)));
  perform pg_temp.ok(c->>'status' = 'draft' and (c->>'payload_version')::int = 3 and c->'payload'->>'version' = '3' and c->'payload'->>'title' = 'U19 parcial'
    and c->'payload'->'genres' = '[]'::jsonb, '3.1 borrador parcial v2 entra y se guarda como v3');
  v_id := (c->>'id')::uuid;
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"genres":["Polka"]}'))), '22023 genre_not_selectable', '3.2 género fuera de la lista');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"countries":["España"]}'))), '22023 country_not_selectable', '3.3 país de legado no se elige');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"countries":["USA"]}'))), '22023 country_not_selectable', '3.4 alias de un país de legado tampoco');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"countries":["U19 Retirado"]}'))), '22023 country_not_selectable', '3.5 país retirado');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"radar":{"experimental":1}}'))), '22023 radar_invalid', '3.6 radar incompleto');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"radar":{"experimental":6,"denso":0,"sintetico":0,"bailable":0,"rapido":0}}'))), '22023 radar_invalid', '3.7 radar fuera de rango');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"cover_url":"https://evil.test/c.jpg"}'))), '42501 field_not_allowed', '3.8 el autor no fija la portada');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"review":"reseña"}'))), '42501 field_not_allowed', '3.9 el autor no escribe la reseña');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"version":4}'))), '22023 payload_version_invalid', '3.10 versión desconocida');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"collaborators":["U19 Artista x"]}'))), '22023 credit_in_both_groups', '3.11 crédito en los dos grupos');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"release_date":"2026-02-30"}'))), '22023 release_date_invalid', '3.12 fecha imposible');
  perform pg_temp.expect(other_id, format('select * from public.save_contribution_draft(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x'))), '42501', '3.13 otra persona no edita el borrador');
  perform pg_temp.expect(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"label":"  "}'))), '22023 label_required', '3.14 enviar sin sello');
  perform pg_temp.expect(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"genres":[]}'))), '22023 genres_required', '3.15 enviar sin géneros');
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Uno', '{"countries":["Méjico","colombia"],"genres":["Tecno","techno","House"],"team_note":"Nota del autor","extra":"se descarta"}'))));
  perform pg_temp.ok(c->>'status' = 'pending' and c->>'queue_kind' = 'community' and c->>'taken_at' is null
    and c->'payload'->'countries' = '["México","Colombia"]'::jsonb and c->'payload'->'genres' = '["Techno","House"]'::jsonb
    and not (c->'payload' ? 'extra') and c->'payload'->>'team_note' = 'Nota del autor' and (c->'payload'->'radar'->>'rapido')::int = 5,
    '3.16 enviar traduce alias, deduplica, descarta claves desconocidas y conserva el radar');
  c := pg_temp.run(author_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('Uno editado'))));
  perform pg_temp.ok(c->>'status' = 'pending' and c->'payload'->>'title' = 'Uno editado' and c->>'taken_at' is null, '3.17 el autor edita su propuesta pendiente sin tomar');
  perform pg_temp.expect(other_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x'))), '42501', '3.18 otra persona no la edita');
  perform pg_temp.expect(colab_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x'))), '42501', '3.19 el colaborador no usa el RPC del autor');
  perform pg_temp.expect(author_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x', '{"genres":["Polka"]}'))), '22023 genre_not_selectable', '3.20 la edición del autor también valida');
  perform pg_temp.ok((select count(*) from public.contribution_events where contribution_id = v_id and action = 'updated') = 1, '3.21 la edición del autor queda en el historial');

  -- 4. Duplicados por enlace -------------------------------------------------------------------------
  r := pg_temp.run(other_id, 'select public.check_source_duplicate(''http://U19.Bandcamp.com/album/uno/?from=x#t'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'queue' and r->>'state' = 'pending' and r->>'contribution_id' is null, '4.1 la cola se detecta sin exponer la propuesta ajena');
  r := pg_temp.run(author_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/uno'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'queue' and (r->>'contribution_id')::uuid = v_id, '4.2 el autor recibe su propia propuesta');
  r := pg_temp.run(admin_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/uno'') as r')->'r';
  perform pg_temp.ok((r->>'contribution_id')::uuid = v_id, '4.3 admin recibe la propuesta');
  r := pg_temp.run(other_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/nada'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'none', '4.4 un enlace nuevo no coincide');
  perform pg_temp.expect(other_id, 'select public.check_source_duplicate(''ftp://x'')', '22023', '4.5 URL inválida');
  c := pg_temp.run(other_id, format('select * from public.create_contribution_draft(%L, %L, %s)', 'https://u19.bandcamp.com/album/borrador-ajeno', 'bandcamp', pg_temp.lit(pg_temp.v3('ajeno'))));
  r := pg_temp.run(author_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/borrador-ajeno'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'none', '4.6 el borrador ajeno no cuenta como cola');
  r := pg_temp.run(other_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/borrador-ajeno'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'queue' and r->>'state' = 'draft', '4.7 el borrador propio sí');
  perform pg_temp.ok(private.normalize_source_url('https://OPEN.spotify.com/intl-es/album/AbC?si=1') = 'https://open.spotify.com/album/AbC', '4.8 Spotify: host, intl y consulta');

  -- 5. Equipo: corrección y "tomada" -----------------------------------------------------------------
  v_payload := pg_temp.run(author_id, format('select updated_at::text as u from public.contributions where id = %L', v_id));
  perform pg_temp.expect(other_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_payload->>'u', pg_temp.lit(pg_temp.v3('x'))), '42501', '5.1 comunidad no corrige');
  perform pg_temp.expect(author_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_payload->>'u', pg_temp.lit(pg_temp.v3('x'))), '42501', '5.2 el autor no corrige como equipo');
  perform pg_temp.expect(null, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_payload->>'u', pg_temp.lit(pg_temp.v3('x'))), '42501', '5.3 anon no corrige');
  perform pg_temp.expect(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, '2000-01-01', pg_temp.lit(pg_temp.v3('x'))), '40001 contribution_version_conflict', '5.4 versión vieja da conflicto');
  perform pg_temp.expect(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_payload->>'u', pg_temp.lit(pg_temp.v3('x', '{"review":"del colaborador"}'))), '42501 field_not_allowed', '5.5 el colaborador no escribe la reseña');
  perform pg_temp.expect(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, v_payload->>'u', pg_temp.lit(pg_temp.v3('x', '{"countries":["Canadá"]}'))), '22023 country_not_selectable', '5.6 la corrección también valida');
  perform pg_temp.ok((select taken_at is null from public.contributions where id = v_id), '5.7 intentos fallidos no la toman');
  c := pg_temp.run(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s, null, null, %L)', v_id, v_payload->>'u',
    pg_temp.lit(pg_temp.v3('Uno corregido', '{"primary_artists":["U19 Grafia Vieja","U19 Nuevo Uno"],"collaborators":[]}')), 'Corrijo créditos'));
  perform pg_temp.ok(c->>'status' = 'pending' and c->>'taken_at' is not null and c->'payload'->>'title' = 'Uno corregido', '5.8 la corrección del colaborador la toma');
  perform pg_temp.ok((select note from public.contribution_events where contribution_id = v_id and action = 'corrected') = 'Corrijo créditos', '5.9 la corrección queda en el historial con su nota');
  perform pg_temp.expect(author_id, format('select * from public.update_submitted_contribution(%L, %L, %L, %s)', v_id, 'https://u19.bandcamp.com/album/uno', 'bandcamp', pg_temp.lit(pg_temp.v3('x'))), '55000 contribution_taken', '5.10 tomada: el autor ya no edita');
  perform pg_temp.ok(pg_temp.run(author_id, format('select taken_at from public.contributions where id = %L', v_id))->>'taken_at' is not null, '5.11 el autor ve que está tomada');
  perform pg_temp.expect(colab_id, format('select * from public.accept_contribution(%L, false, now())', v_id), '42501', '5.12 el colaborador no acepta');
  perform pg_temp.expect(colab_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://u19.bandcamp.com/album/c', 'bandcamp', pg_temp.lit(pg_temp.v3('c'))), '42501', '5.13 el colaborador no crea en el catálogo');
  c := pg_temp.run(colab_id, format('select * from public.prepare_contribution_for_admin(%L, %s, %L)', v_id, pg_temp.lit(pg_temp.v3('Uno listo', '{"primary_artists":["U19 Grafia Vieja","U19 Nuevo Uno"],"collaborators":[]}')), 'Lista'));
  perform pg_temp.ok(c->>'status' = 'ready_for_admin' and c->'payload'->>'title' = 'Uno listo', '5.14 marcar lista guarda la corrección');
  perform pg_temp.expect(colab_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, c->>'updated_at', pg_temp.lit(pg_temp.v3('x'))), '42501', '5.15 lista para admin: el colaborador ya no la corrige');

  -- 6. Admin: corregir y aceptar como borrador ------------------------------------------------------
  perform pg_temp.expect(admin_id, format('select * from public.accept_contribution(%L, false, %L)', v_id, '2000-01-01'), '40001 contribution_version_conflict', '6.1 aceptar con versión vieja da conflicto');
  perform pg_temp.expect(admin_id, format('select * from public.accept_contribution(%L, null, %L)', v_id, c->>'updated_at'), '22023', '6.2 aceptar exige elegir borrador o publicar');
  c := pg_temp.run(admin_id, format('select * from public.save_contribution_correction(%L, %L, %s)', v_id, c->>'updated_at',
    pg_temp.lit(pg_temp.v3('Uno final', '{"primary_artists":["U19 Grafia Vieja","U19 Nuevo Uno"],"collaborators":["U19 Colab Uno"],"label":"U19 Sello Viejo","review":"Reseña del equipo","cover_url":"https://f4.bcbits.com/img/u19-uno.jpg"}'))));
  perform pg_temp.ok(c->'payload'->>'review' = 'Reseña del equipo' and c->>'status' = 'ready_for_admin', '6.3 admin corrige con reseña y portada');
  r := pg_temp.run(admin_id, format('select public.accept_contribution(%L, false, %L, %L) as r', v_id, c->>'updated_at', 'Bien'))->'r';
  v_release := (r->>'release_id')::uuid;
  perform pg_temp.ok(r->>'status' = 'draft' and (select status from public.releases where id = v_release) = 'draft', '6.4 aceptar como borrador');
  perform pg_temp.ok((select string_agg(a.name, ',' order by ra.role, ra.position) from public.release_artists ra join public.artists a on a.id = ra.artist_id where ra.release_id = v_release)
    = 'U19 Colab Uno,U19 Conservado,U19 Nuevo Uno', '6.5 créditos por alias y artistas nuevos creados en la misma transacción');
  perform pg_temp.ok((select l.name from public.releases rel join public.labels l on l.id = rel.label_id where rel.id = v_release) = 'U19 Sello Conservado', '6.6 sello por alias');
  perform pg_temp.ok((select string_agg(g.name, ',' order by g.name) from public.release_genres rg join public.genres g on g.id = rg.genre_id where rg.release_id = v_release) = 'House,Techno'
    and (select string_agg(co.name, ',' order by co.name) from public.release_countries rc join public.countries co on co.id = rc.country_id where rc.release_id = v_release) = 'Colombia', '6.7 géneros y países resueltos');
  perform pg_temp.ok((select (experimental, rapido) = (1::smallint, 5::smallint) from public.release_radar where release_id = v_release), '6.8 el radar pasa a release_radar');
  perform pg_temp.ok((select review from public.releases where id = v_release) = 'Reseña del equipo'
    and (select url from public.release_covers where release_id = v_release) = 'https://f4.bcbits.com/img/u19-uno.jpg'
    and (select url || '|' || provider from public.release_links where release_id = v_release and is_primary) = 'https://u19.bandcamp.com/album/uno|bandcamp', '6.9 reseña, portada y enlace');
  perform pg_temp.ok((select credit_quality from public.releases where id = v_release) = 'proposed', '6.10 créditos propuestos');
  perform pg_temp.ok((select count(*) from private.catalog_change_sets where entity_id = v_release and operation = 'create') = 1, '6.11 una sola entrada create en el historial');
  perform pg_temp.ok((select status = 'approved' and release_id = v_release and reviewed_by = admin_id and reviewer_note = 'Bien' from public.contributions where id = v_id), '6.12 la propuesta queda aceptada y enlazada');
  perform pg_temp.ok((select note from public.contribution_events where contribution_id = v_id and action = 'approved') = 'Bien · Aceptada como borrador', '6.13 el historial dice cómo se aceptó');
  perform pg_temp.ok((select count(*) from private.catalog_artist_change_events e join public.artists a on a.id = e.artist_id where a.name in ('U19 Nuevo Uno', 'U19 Colab Uno')) = 2, '6.14 las altas de artista quedan auditadas');
  perform pg_temp.expect(admin_id, format('select * from public.accept_contribution(%L, true, now())', v_id), '22023', '6.15 una propuesta aceptada no se acepta otra vez');
  r := pg_temp.run(other_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/uno'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'catalog' and r->>'state' = 'draft' and r->>'release_slug' is null and r->>'release_id' is null, '6.16 duplicado en el catálogo sin ficha mientras es borrador');
  r := pg_temp.run(admin_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/uno'') as r')->'r';
  perform pg_temp.ok((r->>'release_id')::uuid = v_release, '6.17 admin recibe el UUID del borrador');

  -- 7. Aceptar y publicar; sin radar; rechazar y pedir cambios ------------------------------------------
  c := pg_temp.run(author_id, format('select * from public.create_contribution_draft(%L, %L, %s, %s)', 'https://u19.bandcamp.com/album/dos', 'bandcamp', pg_temp.lit(pg_temp.v3('Dos', '{"radar":null}')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19-dos.jpg"}')));
  v_id2 := (c->>'id')::uuid;
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s, %s)', v_id2, 'https://u19.bandcamp.com/album/dos', 'bandcamp', pg_temp.lit(pg_temp.v3('Dos', '{"radar":null}')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19-dos.jpg"}')));
  perform pg_temp.ok(not (c->'payload' ? 'radar'), '7.1 el radar es opcional');
  r := pg_temp.run(admin_id, format('select public.accept_contribution(%L, true, %L) as r', v_id2, c->>'updated_at'))->'r';
  v_release2 := (r->>'release_id')::uuid;
  perform pg_temp.ok((select status from public.releases where id = v_release2) = 'published' and not exists (select 1 from public.release_radar where release_id = v_release2)
    and (select url from public.release_covers where release_id = v_release2) = 'https://f4.bcbits.com/img/u19-dos.jpg', '7.2 aceptar y publicar, con la portada detectada y sin radar');
  perform pg_temp.ok((select taken_at is not null from public.contributions where id = v_id2), '7.3 aceptar la marca como tomada');
  r := pg_temp.run(other_id, 'select public.check_source_duplicate(''https://u19.bandcamp.com/album/dos'') as r')->'r';
  perform pg_temp.ok(r->>'match' = 'catalog' and r->>'state' = 'published' and r->>'release_slug' = (select slug from public.releases where id = v_release2), '7.4 publicado: el duplicado enlaza a la ficha');
  c := pg_temp.run(author_id, format('select * from public.create_contribution_draft(%L, %L, %s)', 'https://u19.bandcamp.com/album/tres', 'bandcamp', pg_temp.lit(pg_temp.v3('Tres'))));
  v_id3 := (c->>'id')::uuid;
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s)', v_id3, 'https://u19.bandcamp.com/album/tres', 'bandcamp', pg_temp.lit(pg_temp.v3('Tres'))));
  perform pg_temp.expect(admin_id, format('select * from public.accept_contribution(%L, true, %L)', v_id3, c->>'updated_at'), '23514', '7.5 publicar exige portada');
  perform pg_temp.ok((select status from public.contributions where id = v_id3) = 'pending' and not exists (select 1 from public.releases where title = 'Tres'), '7.6 un aceptar fallido no deja nada');
  perform pg_temp.expect(admin_id, format('select * from public.review_contribution(%L, %L, null)', v_id3, 'changes_requested'), '22023', '7.7 pedir cambios exige nota');
  perform pg_temp.expect(colab_id, format('select * from public.review_contribution(%L, %L, %L)', v_id3, 'rejected', 'no'), '42501', '7.8 el colaborador no revisa');
  c := pg_temp.run(admin_id, format('select * from public.review_contribution(%L, %L, %L)', v_id3, 'changes_requested', 'Falta la portada'));
  perform pg_temp.ok(c->>'status' = 'changes_requested' and c->>'taken_at' is not null, '7.9 pedir cambios la toma');
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %s)', v_id3, 'https://u19.bandcamp.com/album/tres', 'bandcamp', pg_temp.lit(pg_temp.v3('Tres bis'))));
  perform pg_temp.ok(c->>'status' = 'pending' and c->>'taken_at' is null, '7.10 reenviar la deja sin tomar');
  c := pg_temp.run(admin_id, format('select * from public.review_contribution(%L, %L, %L)', v_id3, 'rejected', 'Duplicado'));
  perform pg_temp.ok(c->>'status' = 'rejected', '7.11 rechazar');

  -- 8. Alta directa de admin desde Sugerir ------------------------------------------------------------
  perform pg_temp.expect(author_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://u19.bandcamp.com/album/cuatro', 'bandcamp', pg_temp.lit(pg_temp.v3('Cuatro'))), '42501', '8.1 comunidad no crea en el catálogo');
  perform pg_temp.expect(admin_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://u19.bandcamp.com/album/cuatro', 'bandcamp', pg_temp.lit(pg_temp.v3('Cuatro', '{"label":""}'))), '22023 label_required', '8.2 sello obligatorio');
  perform pg_temp.expect(admin_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s)', 'https://u19.bandcamp.com/album/cuatro', 'bandcamp', pg_temp.lit(pg_temp.v3('Cuatro', '{"countries":["España"]}'))), '22023 country_not_selectable', '8.3 admin tampoco elige legado');
  r := pg_temp.run(admin_id, format('select public.admin_create_draft_from_suggestion(%L, %L, %s, %s) as r', 'https://u19.bandcamp.com/album/cuatro', 'bandcamp',
    pg_temp.lit(pg_temp.v3('Cuatro', '{"label":"U19 Sello Nuevo Cuatro"}')), pg_temp.lit('{"cover_url":"https://f4.bcbits.com/img/u19-4.jpg"}')))->'r';
  perform pg_temp.ok(r->>'status' = 'draft' and (select status from public.releases where id = (r->>'release_id')::uuid) = 'draft'
    and (select l.name from public.releases rel join public.labels l on l.id = rel.label_id where rel.id = (r->>'release_id')::uuid) = 'U19 Sello Nuevo Cuatro', '8.4 borrador del catálogo con sello nuevo');
  perform pg_temp.ok((select reason from private.catalog_change_sets where entity_id = (r->>'release_id')::uuid and operation = 'create') = 'Alta desde Sugerir', '8.5 entrada en el historial');
  perform pg_temp.ok((select count(*) from private.catalog_dictionary_change_events where entity_type = 'label' and normalized_name = 'u19 sello nuevo cuatro') = 1, '8.6 el alta del sello queda auditada');
  perform pg_temp.ok(not exists (select 1 from public.contributions where source_url = 'https://u19.bandcamp.com/album/cuatro'), '8.7 sin cola');

  -- 9. Editor: los valores de legado se conservan, no se añaden; la reversión restaura ----------------
  select id into v_spain from public.countries where name = 'España';
  select id into v_canada from public.countries where name = 'Canadá';
  select id into v_colombia from public.countries where name = 'Colombia';
  select imported_release_id into v_imported from private.import_catalog_release(pg_temp.sheet('k-legado', array['Techno'], array['España']));
  perform pg_temp.ok((select country_id from public.release_countries where release_id = v_imported) = v_spain, '9.1 la importación acepta un país de legado');
  v_snapshot := pg_temp.run(admin_id, format('select public.admin_get_catalog_release(%L) as r', v_imported))->'r';
  v_payload := jsonb_build_object('slug', v_snapshot->>'slug', 'title', 'U19 editado', 'release_date', '2026-10-15', 'release_type_id', v_snapshot->>'release_type_id',
    'label_id', v_snapshot->>'label_id', 'review', '', 'status', 'published', 'credit_quality', 'legacy',
    'artist_ids', (select jsonb_agg(artist_id) from public.release_artists where release_id = v_imported and role = 'primary'), 'collaborator_ids', '[]'::jsonb,
    'genre_ids', (select jsonb_agg(genre_id) from public.release_genres where release_id = v_imported),
    'country_ids', jsonb_build_array(v_spain), 'links', jsonb_build_array(jsonb_build_object('provider', 'bandcamp', 'url', 'https://u19.bandcamp.com/album/k-legado', 'is_primary', true)),
    'cover_url', 'https://f4.bcbits.com/img/u19-k-legado.jpg', 'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5));
  v_version := (select catalog_version from public.releases where id = v_imported);
  r := pg_temp.run(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L) as r', v_imported, v_version, pg_temp.lit(v_payload), 'conserva legado'))->'r';
  perform pg_temp.ok((select title from public.releases where id = v_imported) = 'U19 editado', '9.2 editar conserva el país de legado que ya tenía');
  v_version := (r->>'catalog_version')::int;
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L)', v_imported, v_version, pg_temp.lit(v_payload || jsonb_build_object('country_ids', jsonb_build_array(v_spain, v_canada))), 'añade legado'),
    '22023 country_not_selectable', '9.3 el editor no añade un país de legado');
  r := pg_temp.run(admin_id, format('select public.admin_update_catalog_release(%L, %s, %s, %L) as r', v_imported, v_version, pg_temp.lit(v_payload || jsonb_build_object('country_ids', jsonb_build_array(v_colombia))), 'quita legado'))->'r';
  v_change := (r->>'change_set_id')::uuid; v_version := (r->>'catalog_version')::int;
  r := pg_temp.run(admin_id, format('select public.admin_revert_catalog_change(%L, %s, %L) as r', v_change, v_version, 'deshacer'))->'r';
  perform pg_temp.ok((select country_id from public.release_countries where release_id = v_imported) = v_spain, '9.4 la reversión restaura el país de legado');
  perform pg_temp.ok(coalesce(current_setting('discotica.catalog_restore', true), '') <> 'on', '9.5 la marca de restauración no queda encendida');
  perform pg_temp.expect(admin_id, format('select public.admin_create_catalog_release(%s, %L)', pg_temp.lit(v_payload || jsonb_build_object('slug', 'u19-nuevo-legado', 'status', 'draft')), 'nuevo con legado'),
    '22023 country_not_selectable', '9.6 un lanzamiento nuevo no nace con legado');
  r := pg_temp.run(admin_id, format('select public.admin_create_catalog_release(%s, %L) as r', pg_temp.lit(v_payload || jsonb_build_object('slug', 'u19-sin-radar', 'status', 'draft', 'country_ids', jsonb_build_array(v_colombia), 'radar', '{}'::jsonb)), 'sin radar'))->'r';
  perform pg_temp.ok(not exists (select 1 from public.release_radar where release_id = (r->>'release_id')::uuid), '9.7 radar vacío: sin radar');
  perform pg_temp.expect(admin_id, format('select public.admin_create_catalog_release(%s, %L)', pg_temp.lit(v_payload || jsonb_build_object('slug', 'u19-radar-medio', 'status', 'draft', 'country_ids', jsonb_build_array(v_colombia), 'radar', '{"experimental":1}'::jsonb)), 'radar a medias'),
    '22023', '9.8 radar a medias se rechaza');

  -- 10. Importación ---------------------------------------------------------------------------------
  begin
    perform private.import_catalog_release(pg_temp.sheet('k-genero', array['Polka'], array['Colombia']));
    raise exception 'U19G1 FAIL: 10.1 importó un género desconocido';
  exception when invalid_parameter_value then
    perform pg_temp.ok(sqlerrm = 'genre_unknown', '10.1 género desconocido: genre_unknown');
  end;
  begin
    perform private.import_catalog_release(pg_temp.sheet('k-pais', array['Techno'], array['U19 Retirado']));
    raise exception 'U19G1 FAIL: 10.2 importó un país retirado';
  exception when invalid_parameter_value then
    perform pg_temp.ok(sqlerrm = 'country_unknown', '10.2 país retirado: country_unknown');
  end;
  perform pg_temp.ok(not exists (select 1 from public.genres where name = 'Polka'), '10.3 no se creó el género');
  select imported_release_id into v_imported from private.import_catalog_release(pg_temp.sheet('k-alias', array['Tecno', 'Hard Techno'], array['USA', 'méjico'], 'U19 Sello Viejo'));
  perform pg_temp.ok((select string_agg(co.name, ',' order by co.name) from public.release_countries rc join public.countries co on co.id = rc.country_id where rc.release_id = v_imported) = 'Estados Unidos,México'
    and (select string_agg(g.name, ',' order by g.name) from public.release_genres rg join public.genres g on g.id = rg.genre_id where rg.release_id = v_imported) = 'Hard Techno,Techno', '10.4 la importación traduce alias de país y género');
  perform pg_temp.ok((select l.name from public.releases rel join public.labels l on l.id = rel.label_id where rel.id = v_imported) = 'U19 Sello Conservado', '10.5 la importación traduce el alias del sello');
  select count(*) into v_count from public.countries where private.normalize_catalog_dictionary_name(name) in ('usa', 'mejico');
  perform pg_temp.ok(v_count = 0, '10.6 los alias no se convierten en valores');

  raise notice 'U19 G1 verify: OK (% comprobaciones)', (select count(*) from u19_checks);
end $$;

rollback;
