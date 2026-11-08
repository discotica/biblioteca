-- U23 (D7b): al aceptar una propuesta, la nota de quien propone ya no se publica como reseña
-- (migración 20261107120000). Comprueba private.catalog_payload_from_suggestion, que usan
-- accept_contribution y admin_create_draft_from_suggestion:
--   - con team_note y sin review → review vacío;
--   - con review → esa reseña (las existentes se conservan);
--   - la función sigue sin EXECUTE para anon ni authenticated;
--   - de punta a punta: una propuesta con nota, enviada por comunidad y aceptada por admin con
--     accept_contribution, crea un lanzamiento sin reseña y la nota sigue en la propuesta.
-- Transaccional: crea sus usuarios, sello y artista con el prefijo «U23» y termina con ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/u23-verify.sql
-- Imprime "U23 verify: OK (n comprobaciones)" o aborta con "U23 FAIL: …".
begin;

create temp table u23_checks (n serial, label text);

create function pg_temp.ok(p_condition boolean, p_label text) returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'U23 FAIL: %', p_label; end if;
  insert into u23_checks (label) values (p_label);
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

do $$
declare
  v_type text := (select slug from public.release_types order by slug limit 1);
  v_base jsonb;
  v_out jsonb;
  v_src text;
begin
  perform pg_temp.ok(v_type is not null, 'hay al menos un tipo de lanzamiento');
  v_base := jsonb_build_object(
    'version', 3, 'title', 'U23 Prueba', 'release_type', v_type, 'release_date', '2026-11-07',
    'label', 'U23 Sello de prueba', 'primary_artists', '[]'::jsonb, 'collaborators', '[]'::jsonb,
    'genres', '[]'::jsonb, 'countries', '[]'::jsonb);

  v_out := private.catalog_payload_from_suggestion(
    v_base || jsonb_build_object('team_note', 'Nota de quien propone'),
    'https://u23.bandcamp.com/album/prueba', 'bandcamp', '{}'::jsonb, 'draft', 'u23-a', 'U23 verify');
  perform pg_temp.ok(v_out->>'review' = '', 'con team_note y sin review, la reseña queda vacía');

  v_out := private.catalog_payload_from_suggestion(
    v_base || jsonb_build_object('team_note', 'Nota', 'review', 'Reseña guardada'),
    'https://u23.bandcamp.com/album/prueba', 'bandcamp', '{}'::jsonb, 'draft', 'u23-b', 'U23 verify');
  perform pg_temp.ok(v_out->>'review' = 'Reseña guardada', 'una reseña que ya venía se conserva');

  v_out := private.catalog_payload_from_suggestion(
    v_base, 'https://u23.bandcamp.com/album/prueba', 'bandcamp', '{}'::jsonb, 'draft', 'u23-c', 'U23 verify');
  perform pg_temp.ok(v_out->>'review' = '', 'sin nota ni reseña, vacía');

  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'catalog_payload_from_suggestion';
  perform pg_temp.ok(position('team_note' in v_src) = 0, 'la función ya no lee team_note');

  perform pg_temp.ok(
    not has_function_privilege('anon', 'private.catalog_payload_from_suggestion(jsonb,text,text,jsonb,text,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.catalog_payload_from_suggestion(jsonb,text,text,jsonb,text,text,text)', 'EXECUTE'),
    'anon y authenticated siguen sin EXECUTE');
end $$;

do $$
declare
  admin_id uuid := gen_random_uuid();
  author_id uuid := gen_random_uuid();
  v_payload jsonb := jsonb_build_object('version', 3, 'title', 'U23 Punta a punta', 'primary_artists', jsonb_build_array('U23 Artista'),
    'collaborators', '[]'::jsonb, 'release_type', 'ep', 'release_date', '2026-11-07', 'genres', jsonb_build_array('Techno'),
    'countries', jsonb_build_array('Colombia'), 'label', 'U23 Sello', 'team_note', 'La escuché en la radio.');
  c jsonb;
  r jsonb;
  v_id uuid;
  v_release uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u23-admin@u23.test', jsonb_build_object('username', 'u23admin'), now(), now()),
    (author_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u23-author@u23.test', jsonb_build_object('username', 'u23author'), now(), now());
  update public.profiles set role = 'admin' where id = admin_id;

  c := pg_temp.run(author_id, format('select * from public.create_contribution_draft(%L, %L, %L::jsonb, %L::jsonb)',
    'https://u23.bandcamp.com/album/punta', 'bandcamp', v_payload::text, '{"cover_url":"https://f4.bcbits.com/img/u23.jpg"}'));
  v_id := (c->>'id')::uuid;
  c := pg_temp.run(author_id, format('select * from public.submit_contribution(%L, %L, %L, %L::jsonb, %L::jsonb)',
    v_id, 'https://u23.bandcamp.com/album/punta', 'bandcamp', v_payload::text, '{"cover_url":"https://f4.bcbits.com/img/u23.jpg"}'));
  perform pg_temp.ok(c->>'status' = 'pending' and c->'payload'->>'team_note' = 'La escuché en la radio.', 'la propuesta enviada lleva la nota');

  r := pg_temp.run(admin_id, format('select public.accept_contribution(%L, false, %L) as r', v_id, c->>'updated_at'))->'r';
  v_release := (r->>'release_id')::uuid;
  perform pg_temp.ok(v_release is not null, 'admin la acepta como borrador');
  perform pg_temp.ok((select coalesce(review, '') from public.releases where id = v_release) = '', 'el lanzamiento nace sin reseña');
  perform pg_temp.ok((select payload->>'team_note' from public.contributions where id = v_id) = 'La escuché en la radio.', 'la nota sigue en la propuesta');
end $$;

select format('U23 verify: OK (%s comprobaciones)', count(*)) as result from u23_checks;

rollback;
