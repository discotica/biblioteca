-- U19 G4: pantalla de diccionarios (migración 20261016180000). Permisos de los seis RPC por rol,
-- lista, crear, cambiar de estado, renombrar, fusionar (las cuatro clases, con alias y URL vieja) y
-- borrar huérfanos (todo o nada, comprobado en el servidor).
-- Transaccional: crea sus usuarios (admin, colaborador y comunidad) y sus valores, comprueba y
-- termina con ROLLBACK. Requiere G1 (20261015190000–190200) y G3 (20261016120000).
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/u19-g4-verify.sql
-- Imprime "U19 G4 verify: OK (n comprobaciones)" o aborta con "U19G4 FAIL: …".
-- En staging (G5) corre igual: solo usa nombres con el prefijo «U19G4».
begin;

create temp table u19_checks (n serial, label text);
grant all on u19_checks to anon, authenticated;
grant all on sequence u19_checks_n_seq to anon, authenticated;

create function pg_temp.ok(p_condition boolean, p_label text) returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'U19G4 FAIL: %', p_label; end if;
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
  if v not like p_prefix || '%' then raise exception 'U19G4 FAIL: % (esperado «%», obtenido «%»)', p_label, p_prefix, v; end if;
  insert into u19_checks (label) values (p_label);
end $$;

-- Ejecuta una consulta como p_user y devuelve su primera columna como jsonb.
create function pg_temp.run(p_user uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute format('select to_jsonb(x.r) from (%s) x(r)', p_sql) into v;
  execute 'reset role';
  return v;
end $$;

-- Un lanzamiento en borrador con su sello, artistas (principales y colaboradores), géneros y países.
create function pg_temp.release(p_title text, p_label uuid, p_primary uuid[], p_collabs uuid[], p_genres uuid[], p_countries uuid[])
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.releases (slug, title, release_type_id, label_id, status, catalog_version)
  values ('u19g4-' || lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g')), p_title,
    (select id from public.release_types where name = 'EP'), p_label, 'draft', 3)
  returning id into v_id;
  insert into public.release_artists (release_id, artist_id, role, position)
  select v_id, a, 'primary', o - 1 from unnest(p_primary) with ordinality u(a, o);
  insert into public.release_artists (release_id, artist_id, role, position)
  select v_id, a, 'collaborator', o - 1 from unnest(coalesce(p_collabs, '{}')) with ordinality u(a, o);
  insert into public.release_genres (release_id, genre_id) select v_id, g from unnest(coalesce(p_genres, '{}')) g;
  insert into public.release_countries (release_id, country_id) select v_id, c from unnest(coalesce(p_countries, '{}')) c;
  return v_id;
end $$;

create function pg_temp.artist(p_name text) returns uuid language sql as $$
  insert into public.artists (name, normalized_name, slug)
  values (p_name, private.normalize_catalog_artist_name(p_name), private.catalog_entity_slug(p_name, private.normalize_catalog_artist_name(p_name)))
  returning id;
$$;

create function pg_temp.label(p_name text) returns uuid language sql as $$
  insert into public.labels (name, normalized_name, slug)
  values (p_name, private.normalize_catalog_dictionary_name(p_name), private.catalog_entity_slug(p_name, private.normalize_catalog_dictionary_name(p_name)))
  returning id;
$$;

create function pg_temp.credits(p_release uuid) returns text language sql as $$
  select string_agg(role || ':' || position || ':' || a.name, ' | ' order by role desc, position)
  from public.release_artists ra join public.artists a on a.id = ra.artist_id where ra.release_id = p_release;
$$;

do $$
declare
  admin_id uuid := gen_random_uuid(); colab_id uuid := gen_random_uuid(); member_id uuid := gen_random_uuid();
  r jsonb; v_text text; v_sql text; v_fn text;
  v_genre uuid; v_genre2 uuid; v_dup_genre uuid; v_country_src uuid; v_country_dst uuid; v_colombia uuid;
  v_label_src uuid; v_label_dst uuid; v_label_orphan uuid; v_label_orphan2 uuid;
  v_a_src uuid; v_a_dst uuid; v_a_other uuid; v_a_orphan uuid; v_a_renamed uuid;
  v_rel1 uuid; v_rel2 uuid; v_rel3 uuid; v_rel4 uuid; v_rel5 uuid;
  v_src_slug text; v_snapshot jsonb; v_payload jsonb; v_events integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g4-admin@u19.test', jsonb_build_object('username', 'u19g4admin'), now(), now()),
    (colab_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g4-colab@u19.test', jsonb_build_object('username', 'u19g4colab'), now(), now()),
    (member_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u19g4-member@u19.test', jsonb_build_object('username', 'u19g4member'), now(), now());
  update public.profiles set role = 'admin' where id = admin_id;
  update public.profiles set role = 'colaborador' where id = colab_id;
  perform pg_temp.ok((select role from public.profiles where id = member_id) = 'comunidad', '0.1 fixtures de comunidad');
  select id into v_colombia from public.countries where name = 'Colombia';

  -- 1. Permisos ---------------------------------------------------------------------------------------
  foreach v_fn in array array[
    'public.admin_list_catalog_dictionary(text,text,text,integer,integer)',
    'public.admin_create_catalog_dictionary_value(text,text,text,text)',
    'public.admin_rename_catalog_dictionary_value(text,uuid,text,text)',
    'public.admin_merge_catalog_dictionary_values(text,uuid,uuid,text)',
    'public.admin_set_catalog_dictionary_status(text,uuid,text,text)',
    'public.admin_delete_catalog_dictionary_orphans(text,uuid[],text)'] loop
    perform pg_temp.ok(not has_function_privilege('anon', v_fn, 'execute') and has_function_privilege('authenticated', v_fn, 'execute')
      and (select prosecdef from pg_proc where oid = v_fn::regprocedure), '1.1 solo authenticated, security definer: ' || v_fn);
  end loop;
  foreach v_fn in array array['private.catalog_dictionary_state(text,uuid)', 'private.lock_catalog_dictionary_value(text,uuid)',
    'private.record_catalog_dictionary_event(text,text,uuid,text,text,jsonb,jsonb)', 'private.add_catalog_slug_alias(text,text,uuid)',
    'private.catalog_dictionary_name_owner(text,text,uuid)'] loop
    perform pg_temp.ok(not has_function_privilege('authenticated', v_fn, 'execute'), '1.2 la ayuda es privada: ' || v_fn);
  end loop;

  insert into public.genres (name, normalized_name, slug, status) values ('U19G4 Triphop', 'u19g4 triphop', 'u19g4-triphop--1', 'legacy') returning id into v_dup_genre;
  insert into public.genres (name, normalized_name, slug, status) values ('U19G4 Trip Hop', 'u19g4 trip hop', 'u19g4-trip-hop--1', 'legacy') returning id into v_genre2;
  v_label_orphan := pg_temp.label('U19G4 Sello Huérfano');

  -- Cada RPC, como anon, comunidad y colaborador: 42501, y nada cambia.
  foreach v_sql in array array[
    'select public.admin_list_catalog_dictionary(''genre'')',
    'select public.admin_create_catalog_dictionary_value(''genre'', ''U19G4 Intruso'', ''selectable'', ''x'')',
    format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Intruso'', ''x'')', v_dup_genre),
    format('select public.admin_merge_catalog_dictionary_values(''genre'', %L, %L, ''x'')', v_dup_genre, v_genre2),
    format('select public.admin_set_catalog_dictionary_status(''genre'', %L, ''selectable'', ''x'')', v_dup_genre),
    format('select public.admin_delete_catalog_dictionary_orphans(''label'', array[%L]::uuid[], ''x'')', v_label_orphan)] loop
    perform pg_temp.expect(null, v_sql, '42501', '1.3 anon: ' || left(v_sql, 60));
    perform pg_temp.expect(member_id, v_sql, '42501', '1.4 comunidad: ' || left(v_sql, 60));
    perform pg_temp.expect(colab_id, v_sql, '42501', '1.5 colaborador: ' || left(v_sql, 60));
  end loop;
  perform pg_temp.ok(not exists (select 1 from public.genres where name = 'U19G4 Intruso')
    and exists (select 1 from public.genres where id = v_dup_genre and name = 'U19G4 Triphop' and status = 'legacy')
    and exists (select 1 from public.labels where id = v_label_orphan), '1.6 los intentos rechazados no cambian nada');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.genre_aliases', 'insert')
    and not has_table_privilege('authenticated', 'public.artist_slug_aliases', 'insert')
    and not has_table_privilege('authenticated', 'public.genres', 'update'), '1.7 nadie escribe alias ni diccionarios por la tabla');

  -- 2. Crear (géneros y países) --------------------------------------------------------------------------
  r := pg_temp.run(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''  U19G4   Género Nuevo '', ''selectable'', ''alta de prueba'')');
  v_genre := (r->'value'->>'id')::uuid;
  perform pg_temp.ok(r->'value'->>'name' = 'U19G4 Género Nuevo' and r->'value'->>'status' = 'selectable', '2.1 crea un género, con el nombre limpio');
  perform pg_temp.ok((select slug from public.genres where id = v_genre) ~ '^u19g4-genero-nuevo--[0-9a-f]{8}$', '2.2 con el slug de la importación');
  perform pg_temp.ok(exists (select 1 from private.catalog_dictionary_change_events e where e.entity_id = v_genre and e.operation = 'create'
    and e.entity_type = 'genre' and e.actor_id = admin_id and e.reason = 'alta de prueba' and e.result_version = 1), '2.3 el alta queda auditada con su observación');
  r := pg_temp.run(admin_id, 'select public.admin_create_catalog_dictionary_value(''country'', ''U19G4 País'', ''legacy'', ''país de legado'')');
  perform pg_temp.ok(r->'value'->>'status' = 'legacy' and exists (select 1 from public.countries where name = 'U19G4 País' and status = 'legacy'), '2.4 crea un país de legado');
  perform pg_temp.expect(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''u19g4 genero NUEVO'', ''selectable'', ''x'')', '23505 dictionary_value_exists', '2.5 nombre de un valor vivo, sin mayúsculas ni tildes');
  insert into public.genre_aliases (genre_id, name) values (v_genre2, 'U19G4 Trip-Hop Viejo');
  v_text := pg_temp.attempt(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''U19G4 trip-hop viejo'', ''selectable'', ''x'')');
  perform pg_temp.ok(v_text like '23505 dictionary_alias_exists%', '2.6 nombre de un alias: ' || v_text);
  perform pg_temp.expect(admin_id, 'select public.admin_create_catalog_dictionary_value(''label'', ''U19G4 Sello'', ''selectable'', ''x'')', '22023 dictionary_kind_invalid', '2.7 sellos y artistas no se crean aquí');
  perform pg_temp.expect(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''U19G4 Otro'', ''selectable'', ''  '')', '22023 reason_required', '2.8 la observación es obligatoria');
  perform pg_temp.expect(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''U19G4 Otro'', ''retired'', ''x'')', '22023 dictionary_status_invalid', '2.9 solo seleccionable o legado');
  perform pg_temp.expect(admin_id, 'select public.admin_create_catalog_dictionary_value(''genre'', ''   '', ''selectable'', ''x'')', '22023 dictionary_name_invalid', '2.10 nombre vacío');
  perform pg_temp.expect(admin_id, format('select public.admin_create_catalog_dictionary_value(''genre'', %L, ''selectable'', ''x'')', repeat('x', 161)), '22023 dictionary_name_invalid', '2.11 nombre de más de 160');

  -- 3. Estado ------------------------------------------------------------------------------------------
  r := pg_temp.run(admin_id, format('select public.admin_set_catalog_dictionary_status(''genre'', %L, ''legacy'', ''ya no se ofrece'')', v_genre));
  perform pg_temp.ok(r->>'changed' = 'true' and r->>'previous_status' = 'selectable' and (select status from public.genres where id = v_genre) = 'legacy', '3.1 pasa a legado');
  perform pg_temp.ok(exists (select 1 from private.catalog_dictionary_change_events e where e.entity_id = v_genre and e.operation = 'status'
    and e.before_state->>'status' = 'selectable' and e.after_state->>'status' = 'legacy' and e.result_version is null), '3.2 el cambio queda auditado');
  r := pg_temp.run(admin_id, format('select public.admin_set_catalog_dictionary_status(''genre'', %L, ''legacy'', ''otra vez'')', v_genre));
  perform pg_temp.ok(r->>'changed' = 'false' and (select count(*) from private.catalog_dictionary_change_events where entity_id = v_genre and operation = 'status') = 1, '3.3 sin cambio no se audita');
  perform pg_temp.expect(admin_id, format('select public.admin_set_catalog_dictionary_status(''genre'', %L, ''retired'', ''x'')', v_genre), '22023 dictionary_status_invalid', '3.4 no se retira desde aquí');
  perform pg_temp.expect(admin_id, format('select public.admin_set_catalog_dictionary_status(''label'', %L, ''legacy'', ''x'')', v_label_orphan), '22023 dictionary_kind_invalid', '3.5 los sellos no tienen estado');
  perform pg_temp.expect(admin_id, format('select public.admin_set_catalog_dictionary_status(''genre'', %L, ''legacy'', ''x'')', gen_random_uuid()), 'P0002 dictionary_value_not_found', '3.6 id inexistente');
  update public.countries set status = 'retired' where name = 'U19G4 País';
  r := pg_temp.run(admin_id, format('select public.admin_set_catalog_dictionary_status(''country'', %L, ''selectable'', ''vuelve'')', (select id from public.countries where name = 'U19G4 País')));
  perform pg_temp.ok(r->'value'->>'status' = 'selectable', '3.7 un retirado puede volver a seleccionable');

  -- 4. Renombrar ----------------------------------------------------------------------------------------
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Genero nuevo'', ''solo tildes'')', v_genre));
  perform pg_temp.ok(r->>'alias_added' = 'false' and (select name from public.genres where id = v_genre) = 'U19G4 Genero nuevo'
    and not exists (select 1 from public.genre_aliases where genre_id = v_genre), '4.1 solo tildes o mayúsculas: sin alias');
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Género Renombrado'', ''nombre nuevo'')', v_genre));
  perform pg_temp.ok(r->>'alias_added' = 'true' and r->>'previous_name' = 'U19G4 Genero nuevo'
    and exists (select 1 from public.genre_aliases where genre_id = v_genre and name = 'U19G4 Genero nuevo'), '4.2 el nombre viejo queda como alias');
  perform pg_temp.ok((select g.id from private.resolve_catalog_genre('u19g4 género NUEVO') g) = v_genre, '4.3 la resolución encuentra el valor por la grafía vieja');
  perform pg_temp.ok((select normalized_name from public.genres where id = v_genre) = 'u19g4 genero renombrado'
    and (select slug from public.genres where id = v_genre) ~ '^u19g4-genero-renombrado--', '4.4 cambian la clave y el slug');
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Genero Nuevo'', ''de vuelta'')', v_genre));
  perform pg_temp.ok((select name from public.genres where id = v_genre) = 'U19G4 Genero Nuevo'
    and (select array_agg(name) from public.genre_aliases where genre_id = v_genre) = array['U19G4 Género Renombrado'], '4.5 volver a un alias propio lo retira y deja el otro');
  perform pg_temp.expect(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 TRIP HOP'', ''x'')', v_genre), '23505 dictionary_value_exists', '4.6 a un nombre vivo: hay que fusionar');
  perform pg_temp.expect(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Trip-Hop Viejo'', ''x'')', v_genre), '23505 dictionary_alias_exists', '4.7 a un alias de otro valor');
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''genre'', %L, ''U19G4 Genero Nuevo'', ''igual'')', v_genre));
  perform pg_temp.ok(r->>'changed' = 'false', '4.8 el mismo nombre no cambia nada');
  perform pg_temp.ok((select count(*) from private.catalog_dictionary_change_events where entity_id = v_genre and operation = 'rename') = 3, '4.9 cada renombre queda auditado');

  v_a_renamed := pg_temp.artist('U19G4 Artista Antes');
  v_src_slug := (select slug from public.artists where id = v_a_renamed);
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''artist'', %L, ''U19G4 Artista Después'', ''grafía oficial'')', v_a_renamed));
  perform pg_temp.ok((select slug from public.artists where id = v_a_renamed) ~ '^u19g4-artista-despues--[0-9a-f]{8}$', '4.10 artista: slug nuevo');
  perform pg_temp.ok((select array_agg(slug order by slug) from public.artist_slug_aliases where artist_id = v_a_renamed) = array['u19g4-artista-antes', v_src_slug]
    and r->'slug_aliases_added' @> to_jsonb(array[v_src_slug]), '4.11 artista: la URL vieja (slug y nombre) redirige');
  perform pg_temp.ok((public.resolve_catalog_names('artist', '["u19g4 artista antes"]'::jsonb))->0->>'canonical' = 'U19G4 Artista Después', '4.12 artista: Sugerir y el editor traducen la grafía vieja');
  v_label_src := pg_temp.label('U19G4 Sello Antes');
  r := pg_temp.run(admin_id, format('select public.admin_rename_catalog_dictionary_value(''label'', %L, ''U19G4 Sello Después'', ''grafía oficial'')', v_label_src));
  perform pg_temp.ok(exists (select 1 from public.label_slug_aliases where slug = 'u19g4-sello-antes' and label_id = v_label_src)
    and exists (select 1 from public.label_aliases where label_id = v_label_src and name = 'U19G4 Sello Antes'), '4.13 sello: alias y URL vieja');

  -- 5. Lista -----------------------------------------------------------------------------------------------
  v_rel1 := pg_temp.release('U19G4 Lista', v_label_src, array[v_a_renamed], null, array[v_genre2], array[v_colombia]);
  update public.releases set status = 'published' where id = v_rel1;
  r := pg_temp.run(admin_id, 'select public.admin_list_catalog_dictionary(''label'', ''u19g4 sello ANTES'')');
  perform pg_temp.ok((r->>'total')::int = 1 and r->'items'->0->>'name' = 'U19G4 Sello Después' and (r->'items'->0->>'release_count')::int = 1
    and (r->'items'->0->>'published_count')::int = 1 and r->'items'->0->'aliases' = '["U19G4 Sello Antes"]'::jsonb
    and r->'items'->0->'slug_aliases' = '["u19g4-sello-antes"]'::jsonb and r->'items'->0->>'public_slug' = 'u19g4-sello-despues', '5.1 sellos: busca por alias, con conteos, alias y URL');
  r := pg_temp.run(admin_id, 'select public.admin_list_catalog_dictionary(''label'', ''U19G4'', ''orphans'')');
  perform pg_temp.ok((r->>'total')::int = 1 and r->'items'->0->>'name' = 'U19G4 Sello Huérfano' and (r->'counts'->>'orphans')::int >= 1, '5.2 sellos: filtro sin lanzamientos');
  r := pg_temp.run(admin_id, 'select public.admin_list_catalog_dictionary(''genre'', ''u19g4'', ''legacy'')');
  perform pg_temp.ok((select array_agg(x->>'name' order by x->>'name') from jsonb_array_elements(r->'items') x) = array['U19G4 Genero Nuevo', 'U19G4 Trip Hop', 'U19G4 Triphop'], '5.3 géneros: por estado y en orden');
  r := pg_temp.run(admin_id, 'select public.admin_list_catalog_dictionary(''artist'', ''u19g4 artista'', ''all'', 1, 1)');
  perform pg_temp.ok(jsonb_array_length(r->'items') = 1 and r->'items'->0->>'public_slug' = (select slug from public.artists where id = v_a_renamed), '5.4 artistas: página y URL pública');
  r := pg_temp.run(admin_id, 'select public.admin_list_catalog_dictionary(''genre'', ''100%_'')');
  perform pg_temp.ok((r->>'total')::int = 0, '5.5 los comodines de LIKE se escapan');
  perform pg_temp.expect(admin_id, 'select public.admin_list_catalog_dictionary(''label'', null, ''legacy'')', '22023 dictionary_filter_invalid', '5.6 los sellos no tienen estado');
  perform pg_temp.expect(admin_id, 'select public.admin_list_catalog_dictionary(''tag'')', '22023 dictionary_kind_invalid', '5.7 tipo desconocido');

  -- 6. Fusionar --------------------------------------------------------------------------------------------
  -- 6a. Géneros: Triphop → Trip Hop. Un lanzamiento tiene los dos.
  v_rel2 := pg_temp.release('U19G4 Genero A', null, array[v_a_renamed], null, array[v_dup_genre], null);
  v_rel3 := pg_temp.release('U19G4 Genero B', null, array[v_a_renamed], null, array[v_dup_genre, v_genre2], null);
  perform pg_temp.expect(admin_id, format('select public.admin_merge_catalog_dictionary_values(''genre'', %L, %L, ''x'')', v_dup_genre, v_dup_genre), '22023 merge_same_value', '6.1 consigo mismo');
  perform pg_temp.expect(admin_id, format('select public.admin_merge_catalog_dictionary_values(''genre'', %L, %L, ''x'')', v_dup_genre, gen_random_uuid()), 'P0002 dictionary_value_not_found', '6.2 destino inexistente');
  perform pg_temp.expect(admin_id, format('select public.admin_merge_catalog_dictionary_values(''genre'', %L, %L, '''')', v_dup_genre, v_genre2), '22023 reason_required', '6.3 sin observación');
  perform pg_temp.ok(exists (select 1 from public.genres where id = v_dup_genre) and (select count(*) from public.release_genres where genre_id = v_dup_genre) = 2, '6.4 los intentos fallidos no tocan nada');
  r := pg_temp.run(admin_id, format('select public.admin_merge_catalog_dictionary_values(''genre'', %L, %L, ''duplicado de la hoja'')', v_dup_genre, v_genre2));
  perform pg_temp.ok((r->>'release_count')::int = 2 and not exists (select 1 from public.genres where id = v_dup_genre)
    and not exists (select 1 from public.release_genres where genre_id = v_dup_genre), '6.5 géneros: no quedan referencias al viejo');
  perform pg_temp.ok((select array_agg(genre_id) from public.release_genres where release_id = v_rel3) = array[v_genre2]
    and (select array_agg(genre_id) from public.release_genres where release_id = v_rel2) = array[v_genre2], '6.6 cada lanzamiento queda con el conservado, una vez');
  perform pg_temp.ok((select array_agg(name order by name) from public.genre_aliases where genre_id = v_genre2) = array['U19G4 Trip-Hop Viejo', 'U19G4 Triphop']
    and (select g.id from private.resolve_catalog_genre('u19g4 TRIPHOP') g) = v_genre2, '6.7 la grafía vieja queda como alias y se resuelve');
  perform pg_temp.ok((select catalog_version from public.releases where id = v_rel2) = 4 and (select catalog_version from public.releases where id = v_rel3) = 4
    and (select catalog_version from public.releases where id = v_rel1) = 3, '6.8 sube la versión solo de los afectados');
  perform pg_temp.ok(exists (select 1 from private.catalog_dictionary_change_events e where e.operation = 'merge' and e.entity_id = v_genre2
    and e.before_state->'source'->>'name' = 'U19G4 Triphop' and (e.after_state->>'merged_id')::uuid = v_dup_genre
    and e.after_state->'release_ids' @> to_jsonb(array[v_rel2, v_rel3]) and e.reason = 'duplicado de la hoja'), '6.9 la fusión queda auditada con los lanzamientos');

  -- 6b. Países, con un lanzamiento que tiene los dos.
  insert into public.countries (name, normalized_name, slug, status) values ('U19G4 EEUU', 'u19g4 eeuu', 'u19g4-eeuu--1', 'legacy') returning id into v_country_src;
  insert into public.countries (name, normalized_name, slug, status) values ('U19G4 Estados Unidos', 'u19g4 estados unidos', 'u19g4-estados-unidos--1', 'legacy') returning id into v_country_dst;
  v_rel4 := pg_temp.release('U19G4 Pais', null, array[v_a_renamed], null, null, array[v_country_src, v_country_dst, v_colombia]);
  r := pg_temp.run(admin_id, format('select public.admin_merge_catalog_dictionary_values(''country'', %L, %L, ''grafía duplicada'')', v_country_src, v_country_dst));
  perform pg_temp.ok((select array_agg(country_id order by country_id) from public.release_countries where release_id = v_rel4) = (select array_agg(x order by x) from unnest(array[v_country_dst, v_colombia]) x)
    and not exists (select 1 from public.countries where id = v_country_src)
    and exists (select 1 from public.country_aliases where country_id = v_country_dst and name = 'U19G4 EEUU'), '6.10 países: referencias, alias y borrado');

  -- 6c. Sellos: la URL vieja redirige y el editor abierto recibe 40001.
  v_label_dst := pg_temp.label('U19G4 Sello Conservado');
  v_rel5 := pg_temp.release('U19G4 Sello', v_label_src, array[v_a_renamed], null, array[(select id from public.genres where name = 'Techno')], array[v_colombia]);
  v_snapshot := pg_temp.run(admin_id, format('select public.admin_get_catalog_release(%L)', v_rel5));
  r := pg_temp.run(admin_id, format('select public.admin_merge_catalog_dictionary_values(''label'', %L, %L, ''mismo sello'')', v_label_src, v_label_dst));
  perform pg_temp.ok(not exists (select 1 from public.releases where label_id = v_label_src) and (select label_id from public.releases where id = v_rel5) = v_label_dst
    and (select label_id from public.releases where id = v_rel1) = v_label_dst and not exists (select 1 from public.labels where id = v_label_src), '6.11 sellos: los lanzamientos pasan al conservado');
  perform pg_temp.ok((select array_agg(slug order by slug) from public.label_slug_aliases where label_id = v_label_dst) = array['u19g4-sello-antes', 'u19g4-sello-despues']
    and (select array_agg(name order by name) from public.label_aliases where label_id = v_label_dst) = array['U19G4 Sello Antes', 'U19G4 Sello Después'], '6.12 sellos: alias y URL viejas, también las del renombre anterior');
  v_payload := (v_snapshot - 'id' - 'catalog_version' - 'updated_at' - 'source' - 'signals') || jsonb_build_object('title', 'U19G4 Sello editado');
  perform pg_temp.expect(admin_id, format('select public.admin_update_catalog_release(%L, %s, %L::jsonb, ''guardar tarde'')', v_rel5, v_snapshot->>'catalog_version', v_payload),
    '40001', '6.13 un editor abierto antes de fusionar recibe un conflicto de versión');

  -- 6d. Artistas: solo el viejo, viejo principal + conservado colaborador, los dos principales.
  v_a_src := pg_temp.artist('U19G4 Viejo');
  v_a_dst := pg_temp.artist('U19G4 Conservado');
  v_a_other := pg_temp.artist('U19G4 Otro');
  v_src_slug := (select slug from public.artists where id = v_a_src);
  insert into public.artist_aliases (artist_id, name) values (v_a_src, 'U19G4 Alias Del Viejo');
  insert into public.artist_slug_aliases (slug, artist_id) values ('u19g4-url-del-viejo', v_a_src);
  insert into private.catalog_artist_change_events (artist_id, actor_id, operation, normalized_name, after_state)
  values (v_a_src, admin_id, 'create', 'u19g4 viejo', '{}'::jsonb);
  v_rel1 := pg_temp.release('U19G4 Creditos A', null, array[v_a_other, v_a_src], null, null, null);
  v_rel2 := pg_temp.release('U19G4 Creditos B', null, array[v_a_src, v_a_other], array[v_a_dst], null, null);
  v_rel3 := pg_temp.release('U19G4 Creditos C', null, array[v_a_dst, v_a_other, v_a_src], array[v_a_renamed], null, null);
  v_rel4 := pg_temp.release('U19G4 Creditos D', null, array[v_a_other], array[v_a_src, v_a_dst], null, null);
  insert into private.credit_inference_proposals (release_id, heuristic_version, classification, base_catalog_version, proposed_primary_artist_ids, proposed_collaborator_artist_ids, evidence)
  values (v_rel1, 'u19g4', 'high', 3, jsonb_build_array(v_a_src::text, v_a_dst::text), jsonb_build_array(v_a_src::text), '["u19g4"]'::jsonb);
  r := pg_temp.run(admin_id, format('select public.admin_merge_catalog_dictionary_values(''artist'', %L, %L, ''mismo artista'')', v_a_src, v_a_dst));
  perform pg_temp.ok(pg_temp.credits(v_rel1) = 'primary:0:U19G4 Otro | primary:1:U19G4 Conservado', '6.14 artistas: toma el lugar del viejo — ' || pg_temp.credits(v_rel1));
  perform pg_temp.ok(pg_temp.credits(v_rel2) = 'primary:0:U19G4 Conservado | primary:1:U19G4 Otro', '6.15 artistas: el colaborador conservado pasa a principal — ' || pg_temp.credits(v_rel2));
  perform pg_temp.ok(pg_temp.credits(v_rel3) = 'primary:0:U19G4 Conservado | primary:1:U19G4 Otro | collaborator:0:U19G4 Artista Después', '6.16 artistas: los dos principales quedan en uno — ' || pg_temp.credits(v_rel3));
  perform pg_temp.ok(pg_temp.credits(v_rel4) = 'primary:0:U19G4 Otro | collaborator:0:U19G4 Conservado', '6.17 artistas: dos colaboradores, uno; posiciones desde 0 — ' || pg_temp.credits(v_rel4));
  perform pg_temp.ok(not exists (select 1 from public.release_artists where artist_id = v_a_src) and not exists (select 1 from public.artists where id = v_a_src)
    and not exists (select 1 from public.artist_aliases where artist_id = v_a_src) and not exists (select 1 from public.artist_slug_aliases where artist_id = v_a_src), '6.18 artistas: no quedan referencias al viejo');
  perform pg_temp.ok((select array_agg(name order by name) from public.artist_aliases where artist_id = v_a_dst) = array['U19G4 Alias Del Viejo', 'U19G4 Viejo'], '6.19 artistas: sus alias pasan al conservado, más su nombre');
  perform pg_temp.ok((select array_agg(slug order by slug) from public.artist_slug_aliases where artist_id = v_a_dst) = (select array_agg(x order by x) from unnest(array['u19g4-url-del-viejo', 'u19g4-viejo', v_src_slug]) x), '6.20 artistas: las URL viejas redirigen al conservado');
  perform pg_temp.ok((select proposed_primary_artist_ids from private.credit_inference_proposals where release_id = v_rel1) = jsonb_build_array(v_a_dst::text)
    and (select proposed_collaborator_artist_ids from private.credit_inference_proposals where release_id = v_rel1) = jsonb_build_array(v_a_dst::text), '6.21 artistas: las propuestas de E08 abiertas usan el conservado');
  perform pg_temp.ok(exists (select 1 from private.catalog_artist_change_events where artist_id = v_a_src), '6.22 el registro de altas conserva el id viejo como historial');
  perform pg_temp.ok((public.resolve_catalog_names('artist', '["U19G4 viejo", "u19g4 alias del viejo"]'::jsonb)) @> jsonb_build_array(
    jsonb_build_object('canonical', 'U19G4 Conservado'), jsonb_build_object('name', 'u19g4 alias del viejo', 'canonical', 'U19G4 Conservado')), '6.23 artistas: se resuelven por los dos alias');
  perform pg_temp.ok((r->>'release_count')::int = 4, '6.24 artistas: cuenta los cuatro lanzamientos');

  -- 7. Borrar huérfanos ------------------------------------------------------------------------------------
  v_a_orphan := pg_temp.artist('U19G4 Sin Lanzamientos');
  insert into public.artist_aliases (artist_id, name) values (v_a_orphan, 'U19G4 Alias Huérfano');
  insert into private.catalog_artist_change_events (artist_id, actor_id, operation, normalized_name, after_state)
  values (v_a_orphan, admin_id, 'create', 'u19g4 sin lanzamientos', '{}'::jsonb);
  v_text := pg_temp.attempt(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''artist'', array[%L, %L]::uuid[], ''limpieza'')', v_a_orphan, v_a_other));
  perform pg_temp.ok(v_text like '23503 dictionary_value_in_use%' and exists (select 1 from public.artists where id = v_a_orphan), '7.1 con un artista en uso no se borra ninguno: ' || v_text);
  v_label_orphan2 := pg_temp.label('U19G4 Sello Huérfano Dos');
  insert into public.releases (slug, title, label_id, status) values ('u19g4-archivado', 'U19G4 Archivado', v_label_orphan2, 'archived');
  perform pg_temp.expect(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''label'', array[%L]::uuid[], ''x'')', v_label_orphan2), '23503 dictionary_value_in_use', '7.2 un lanzamiento archivado también cuenta');
  delete from public.releases where slug = 'u19g4-archivado';
  r := pg_temp.run(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''label'', array[%L, %L, %L]::uuid[], ''limpieza de sellos'')', v_label_orphan, v_label_orphan2, v_label_orphan));
  perform pg_temp.ok((r->>'deleted_count')::int = 2 and not exists (select 1 from public.labels where id in (v_label_orphan, v_label_orphan2)), '7.3 borra en lote, sin repetir ids');
  r := pg_temp.run(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''artist'', array[%L]::uuid[], ''de a uno'')', v_a_orphan));
  perform pg_temp.ok(not exists (select 1 from public.artists where id = v_a_orphan) and not exists (select 1 from public.artist_aliases where name = 'U19G4 Alias Huérfano'), '7.4 borra un artista con sus alias, aunque tenga alta registrada');
  select count(*) into v_events from private.catalog_dictionary_change_events e where e.operation = 'delete' and e.entity_id in (v_label_orphan, v_label_orphan2, v_a_orphan)
    and e.before_state ? 'name' and e.actor_id = admin_id;
  perform pg_temp.ok(v_events = 3, '7.5 cada borrado queda auditado con lo que había');
  perform pg_temp.expect(admin_id, 'select public.admin_delete_catalog_dictionary_orphans(''artist'', ''{}''::uuid[], ''x'')', '22023 dictionary_batch_invalid', '7.6 sin ids');
  perform pg_temp.expect(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''artist'', %L::uuid[], ''x'')', (select array_agg(gen_random_uuid()) from generate_series(1, 201))), '22023 dictionary_batch_invalid', '7.7 más de 200');
  perform pg_temp.expect(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''artist'', array[%L]::uuid[], ''x'')', gen_random_uuid()), 'P0002 dictionary_value_not_found', '7.8 id inexistente');
  perform pg_temp.expect(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''genre'', array[%L]::uuid[], ''x'')', v_genre), '22023 dictionary_kind_invalid', '7.9 géneros y países no se borran desde aquí');
  perform pg_temp.expect(admin_id, format('select public.admin_delete_catalog_dictionary_orphans(''label'', array[%L]::uuid[], '' '')', v_label_dst), '22023 reason_required', '7.10 sin observación');

  raise notice 'U19 G4 verify: OK (% comprobaciones)', (select count(*) from u19_checks);
end $$;

rollback;
