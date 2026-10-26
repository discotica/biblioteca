-- D1: RLS y contrato de redes, aportes públicos y orden manual.
-- Local: npx supabase db query --local --file tests/sql/d1-verify.sql
--   (o psql con ON_ERROR_STOP=1). Staging solo cuando D1 esté aplicada allí.
-- Crea sus propios usuarios, lanzamientos, colecciones y aportes dentro de una
-- transacción y la revierte: no deja fixtures. Cualquier fallo aborta con
-- "D1 FAIL: ...". Al final emite "D1 verify: OK".
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  album_id uuid := (select id from public.release_types where slug = 'album');
  r uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  public_crate uuid := gen_random_uuid();
  private_crate uuid := gen_random_uuid();
  item_ids uuid[];
  n integer;
  positions integer[];
  accepted uuid[];
  result_columns text;
  bad record;
begin
  if album_id is null then raise exception 'D1 FAIL: release type album missing'; end if;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-owner@d1.test',
      jsonb_build_object('username', 'd1-owner', 'social_soundcloud', 'd1-owner', 'social_x', 'd1_owner',
        'social_bandcamp', 'd1-owner', 'social_bandcamp_kind', 'artist'), now(), now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-other@d1.test',
      jsonb_build_object('username', 'd1-other'), now(), now());

  -- 0. El alta (handle_new_user) guarda las redes de raw_user_meta_data y deja
  -- la preferencia de aportes apagada; un formato inválido bloquea el alta.
  if not exists (select 1 from public.profiles where id = owner_id and social_soundcloud = 'd1-owner'
      and social_x = 'd1_owner' and social_bandcamp = 'd1-owner' and social_bandcamp_kind = 'artist'
      and social_instagram is null and not show_accepted_contributions) then
    raise exception 'D1 FAIL: signup did not store social handles or default show_accepted_contributions=false';
  end if;
  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-bad@d1.test',
        jsonb_build_object('username', 'd1-bad', 'social_instagram', 'https://instagram.com/x'), now(), now());
    raise exception 'D1 FAIL: signup accepted a URL as Instagram handle';
  exception when check_violation then null;
  end;
  insert into public.releases (id, slug, title, release_type_id, status)
  select r[i], 'd1-fixture-' || i, 'D1 fixture ' || i, album_id, case when i = 5 then 'archived' else 'published' end
  from generate_series(1, 5) as i;
  insert into public.crates (id, owner_id, name, slug, is_public) values
    (public_crate, owner_id, 'D1 pública', 'd1-publica', true),
    (private_crate, owner_id, 'D1 privada', 'd1-privada', false);
  insert into public.contributions (author_id, status, source_url, release_id, reviewer_note, reviewed_at) values
    (owner_id, 'approved', 'https://example.bandcamp.com/album/a', r[1], 'nota interna aprobada', now() - interval '2 days'),
    (owner_id, 'approved', 'https://example.bandcamp.com/album/b', r[2], null, now() - interval '1 day'),
    (owner_id, 'approved', 'https://example.bandcamp.com/album/e', r[5], null, now()),
    (owner_id, 'rejected', 'https://example.bandcamp.com/album/c', null, 'rechazo', now()),
    (owner_id, 'draft', 'https://example.bandcamp.com/album/d', null, null, null),
    (owner_id, 'pending', 'https://example.bandcamp.com/album/f', null, null, null),
    (other_id, 'approved', 'https://example.bandcamp.com/album/g', r[3], null, now());

  -- 1a. El dueño guarda usuarios válidos de las cinco redes.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set social_bandcamp = 'dj_owner-1', social_bandcamp_kind = 'fan',
    social_soundcloud = 'owner_sc-1', social_instagram = 'owner.ig_1', social_x = 'owner_1',
    social_facebook = 'owner.fb5'
  where id = owner_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'D1 FAIL: owner could not save valid social handles'; end if;
  -- Bandcamp también acepta subdominio de artista.
  update public.profiles set social_bandcamp = 'owner-artist', social_bandcamp_kind = 'artist' where id = owner_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'D1 FAIL: owner could not save a Bandcamp artist subdomain'; end if;

  -- 1b'. Bandcamp: nombre y forma van juntos, y el formato depende de la forma.
  for bad in select * from (values
    ('owner', null), (null, 'fan'), ('owner', 'label'), ('', 'fan'),
    ('a.b', 'fan'), ('https://bandcamp.com/x', 'fan'),
    ('dj_owner', 'artist'), ('-owner', 'artist'), ('owner-', 'artist'), ('a.b', 'artist'),
    ('www', 'artist'), (repeat('a', 64), 'artist')
  ) as cases(handle, kind) loop
    begin
      update public.profiles set social_bandcamp = bad.handle, social_bandcamp_kind = bad.kind where id = owner_id;
      raise exception 'D1 FAIL: Bandcamp accepted (%, %)', bad.handle, bad.kind;
    exception when check_violation then null;
    end;
  end loop;

  -- 1b. Formatos inválidos por red: URL, "@", mayúsculas, longitud, puntos.
  for bad in select * from (values
    ('social_soundcloud', 'ab'), ('social_soundcloud', repeat('a', 26)), ('social_soundcloud', 'a/b'),
    ('social_instagram', '@owner'), ('social_instagram', '.owner'), ('social_instagram', 'own..er'),
    ('social_instagram', 'owner.'), ('social_instagram', repeat('a', 31)), ('social_instagram', 'Owner'),
    ('social_x', 'Owner'), ('social_x', repeat('a', 16)), ('social_x', 'a.b'),
    ('social_facebook', 'abcd'), ('social_facebook', 'a-bcde'), ('social_facebook', 'abcde.'),
    ('social_facebook', 'facebook.com/abcde')
  ) as cases(col, val) loop
    begin
      execute format('update public.profiles set %I = $1 where id = $2', bad.col) using bad.val, owner_id;
      raise exception 'D1 FAIL: % accepted invalid value %', bad.col, bad.val;
    exception when check_violation then null;
    end;
  end loop;

  -- 1c. Nadie más edita las redes ni la preferencia; username sigue sin grant.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  update public.profiles set social_x = 'intruso', show_accepted_contributions = true where id = owner_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'D1 FAIL: another user edited a profile'; end if;
  begin
    update public.profiles set username = 'robado' where id = other_id;
    raise exception 'D1 FAIL: username became writable';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    update public.profiles set social_x = 'anonimo' where id = owner_id;
    raise exception 'D1 FAIL: anon updated a profile';
  exception when insufficient_privilege then null;
  end;
  -- Las redes son públicas por diseño (se muestran en el perfil ajeno).
  if not exists (select 1 from public.profiles where id = owner_id and social_x = 'owner_1') then
    raise exception 'D1 FAIL: anon cannot read public social handles';
  end if;

  ---------------------------------------------------------------------------
  -- 2. Aportes aceptados en el perfil público
  ---------------------------------------------------------------------------
  -- 2a. Preferencia apagada por defecto: anónimo no ve nada.
  if exists (select 1 from public.get_public_accepted_contributions(owner_id)) then
    raise exception 'D1 FAIL: anon saw contributions of a profile that does not allow it';
  end if;
  -- 2b. anon sigue sin acceso directo a contributions.
  begin
    perform 1 from public.contributions limit 1;
    raise exception 'D1 FAIL: anon can read contributions directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 2c. El dueño activa la preferencia.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set show_accepted_contributions = true where id = owner_id;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  set local role anon;
  select array_agg(release_id order by accepted_at desc) into accepted
  from public.get_public_accepted_contributions(owner_id);
  -- Solo aprobados con lanzamiento publicado: r2 (más reciente) y r1. No r5
  -- (archivado), ni rechazos, borradores, pendientes ni aportes de otra persona.
  if accepted is distinct from array[r[2], r[1]] then
    raise exception 'D1 FAIL: public accepted contributions returned %', accepted;
  end if;
  -- 2d. Otra persona que no lo permite sigue oculta.
  if exists (select 1 from public.get_public_accepted_contributions(other_id)) then
    raise exception 'D1 FAIL: other profile contributions leaked';
  end if;
  -- 2e. Límite acotado.
  if (select count(*) from public.get_public_accepted_contributions(owner_id, 1, 0)) <> 1
     or (select count(*) from public.get_public_accepted_contributions(owner_id, 1, 1)) <> 1
     or (select count(*) from public.get_public_accepted_contributions(owner_id, 1, 2)) <> 0 then
    raise exception 'D1 FAIL: pagination of accepted contributions';
  end if;
  reset role;
  -- 2f. La forma del resultado no expone payload, notas ni estado.
  select pg_get_function_result('public.get_public_accepted_contributions(uuid, integer, integer)'::regprocedure)
  into result_columns;
  if result_columns <> 'TABLE(release_id uuid, accepted_at timestamp with time zone)' then
    raise exception 'D1 FAIL: unexpected result shape %', result_columns;
  end if;
  -- 2g. Un usuario autenticado ajeno tampoco lee contributions directamente.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.contributions where author_id = owner_id) then
    raise exception 'D1 FAIL: another user reads contributions directly';
  end if;
  reset role;

  ---------------------------------------------------------------------------
  -- 3. Orden manual
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 3a. Altas al final; la posición enviada por el cliente se ignora.
  insert into public.crate_items (crate_id, release_id, lanzamiento_slug, position) values (public_crate, r[1], 'x', 99);
  insert into public.crate_items (crate_id, release_id, lanzamiento_slug) values (public_crate, r[2], 'x'), (public_crate, r[3], 'x');
  insert into public.crate_items (crate_id, release_id, lanzamiento_slug) values (public_crate, r[4], 'x');
  select array_agg(position order by position), array_agg(id order by position) into positions, item_ids
  from public.crate_items where crate_id = public_crate;
  if positions is distinct from array[0, 1, 2, 3] then
    raise exception 'D1 FAIL: appended positions were %', positions;
  end if;

  -- 3b. El dueño no actualiza position directamente.
  begin
    update public.crate_items set position = 7 where id = item_ids[1];
    raise exception 'D1 FAIL: owner updated position directly';
  exception when insufficient_privilege then null;
  end;

  -- 3c. El dueño reordena con una permutación completa.
  perform public.reorder_crate_items(public_crate, array[item_ids[4], item_ids[1], item_ids[3], item_ids[2]]);
  if (select array_agg(id order by position) from public.crate_items where crate_id = public_crate)
     is distinct from array[item_ids[4], item_ids[1], item_ids[3], item_ids[2]] then
    raise exception 'D1 FAIL: reorder did not apply';
  end if;

  -- 3d. Permutaciones inválidas o desactualizadas.
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[1], item_ids[1], item_ids[2], item_ids[3]]);
    raise exception 'D1 FAIL: duplicate ids accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[1], null, item_ids[2], item_ids[3]]);
    raise exception 'D1 FAIL: null id accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[1], item_ids[2], item_ids[3]]);
    raise exception 'D1 FAIL: partial permutation accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[1], item_ids[2], item_ids[3], gen_random_uuid()]);
    raise exception 'D1 FAIL: foreign id accepted';
  exception when serialization_failure then null;
  end;

  -- 3e. Una baja deja un hueco; el siguiente reordenamiento compacta.
  delete from public.crate_items where id = item_ids[1];
  perform public.reorder_crate_items(public_crate, array[item_ids[2], item_ids[3], item_ids[4]]);
  select array_agg(position order by position) into positions from public.crate_items where crate_id = public_crate;
  if positions is distinct from array[0, 1, 2] then raise exception 'D1 FAIL: compaction gave %', positions; end if;
  insert into public.crate_items (crate_id, release_id, lanzamiento_slug) values (private_crate, r[1], 'x');
  reset role;

  -- 3f. Nadie reordena colecciones ajenas: otra persona, públicas o privadas.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[4], item_ids[3], item_ids[2]]);
    raise exception 'D1 FAIL: another user reordered a public collection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reorder_crate_items(private_crate, array[]::uuid[]);
    raise exception 'D1 FAIL: another user reordered a private collection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reorder_crate_items(gen_random_uuid(), array[]::uuid[]);
    raise exception 'D1 FAIL: missing collection gave a different error';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.crate_items (crate_id, release_id, lanzamiento_slug) values (public_crate, r[1], 'x');
    raise exception 'D1 FAIL: another user inserted into a collection';
  exception when insufficient_privilege then null;
  end;
  -- Políticas de lectura sin cambios: pública visible, privada no.
  if (select count(*) from public.crate_items where crate_id = public_crate) <> 3
     or exists (select 1 from public.crate_items where crate_id = private_crate) then
    raise exception 'D1 FAIL: collection read policies changed';
  end if;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform public.reorder_crate_items(public_crate, array[item_ids[4], item_ids[3], item_ids[2]]);
    raise exception 'D1 FAIL: anon reordered a collection';
  exception when insufficient_privilege then null;
  end;
  if (select array_agg(position order by position) from public.crate_items where crate_id = public_crate)
     is distinct from array[0, 1, 2]
     or exists (select 1 from public.crate_items where crate_id = private_crate) then
    raise exception 'D1 FAIL: anon read of collections changed';
  end if;
  reset role;

  raise notice 'D1 verify: OK';
end;
$$;
rollback;
