-- Run against Biblioteca Staging only:
-- npx supabase@2.117.0 db query --linked --file tests/sql/e06-reopen-verify.sql
-- It deliberately rolls back releases, dictionaries and private evidence.
begin;

do $$
declare
  v_admin uuid; v_community uuid; v_collaborator uuid; v_artist uuid;
  v_type uuid; v_country uuid; v_label jsonb; v_label_duplicate jsonb;
  v_genre jsonb; v_genre_duplicate jsonb; v_created jsonb; v_published jsonb;
  v_first jsonb; v_second jsonb; v_before jsonb; v_after jsonb; v_events integer;
  v_release uuid; v_payload jsonb; v_order_payload jsonb; v_order_ids uuid[]; v_expected_order_ids uuid[];
begin
  select id into v_admin from public.profiles where role = 'admin' order by id limit 1;
  select id into v_community from public.profiles where role = 'comunidad' order by id limit 1;
  select id into v_collaborator from public.profiles where role = 'colaborador' order by id limit 1;
  -- Staging may not retain a collaborator account. Make a real auth-backed
  -- profile inside this transaction only, so private.is_admin() exercises the
  -- role lookup rather than merely an unknown JWT subject.
  if v_collaborator is null then
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      gen_random_uuid(), 'authenticated', 'authenticated',
      'e06-collaborator-fixture@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"e06collaboratorfixture","display_name":"E06 collaborator fixture"}'::jsonb,
      now(), now()
    ) returning id into v_collaborator;
    update public.profiles set role = 'colaborador' where id = v_collaborator;
  end if;
  select id into v_artist from public.artists order by id limit 1;
  select id into v_type from public.release_types where name = 'EP' order by id limit 1;
  select id into v_country from public.countries order by id limit 1;
  if v_admin is null or v_community is null or v_collaborator is null or v_artist is null or v_type is null or v_country is null then
    raise exception 'E06 reopening fixture prerequisites are absent';
  end if;

  -- Forced RPC invocation is denied for every non-admin role, independently
  -- of the console's controls or feature flags.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_community, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_create_catalog_label('E06 forbidden label', true, 'must fail'); raise exception 'community created label'; exception when insufficient_privilege then null; end;
  begin perform public.admin_create_catalog_genre('E06 forbidden genre', true, 'must fail'); raise exception 'community created genre'; exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_collaborator, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_create_catalog_label('E06 forbidden collaborator label', true, 'must fail'); raise exception 'collaborator created label'; exception when insufficient_privilege then null; end;
  begin perform public.admin_create_catalog_genre('E06 forbidden collaborator genre', true, 'must fail'); raise exception 'collaborator created genre'; exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  begin perform public.admin_create_catalog_label('E06 forbidden anon label', true, 'must fail'); raise exception 'anon created label'; exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_label := public.admin_create_catalog_label('  E06  Sëllo  Fixture ', true, 'fixture label creation');
  v_label_duplicate := public.admin_create_catalog_label('E06 Sello Fixture', true, 'equivalent duplicate');
  v_genre := public.admin_create_catalog_genre('  E06  Género  Fixture ', true, 'fixture genre creation');
  v_genre_duplicate := public.admin_create_catalog_genre('E06 Genero Fixture', true, 'equivalent duplicate');
  if (v_label->>'created')::boolean is not true or (v_label_duplicate->>'duplicate')::boolean is not true
     or v_label->>'label_id' <> v_label_duplicate->>'label_id'
     or (v_genre->>'created')::boolean is not true or (v_genre_duplicate->>'duplicate')::boolean is not true
     or v_genre->>'genre_id' <> v_genre_duplicate->>'genre_id' then
    raise exception 'dictionary canonical idempotency failed';
  end if;
  if not exists (
    select 1 from private.catalog_dictionary_change_events e
    where e.entity_type = 'label' and e.entity_id = (v_label->>'label_id')::uuid
      and e.actor_id = v_admin and e.reason = 'fixture label creation'
      and e.before_state is null and e.after_state->>'catalog_version' = '1'
      and e.result_version = 1
  ) or not exists (
    select 1 from private.catalog_dictionary_change_events e
    where e.entity_type = 'genre' and e.entity_id = (v_genre->>'genre_id')::uuid
      and e.actor_id = v_admin and e.reason = 'fixture genre creation'
      and e.before_state is null and e.after_state->>'catalog_version' = '1'
      and e.result_version = 1
  ) then
    raise exception 'dictionary audit evidence is incomplete';
  end if;
  begin perform public.admin_create_catalog_label('No confirmation', false, 'must fail'); raise exception 'unconfirmed label succeeded'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_create_catalog_genre('No reason', true, ''); raise exception 'genre without reason succeeded'; exception when invalid_parameter_value then null; end;

  v_payload := jsonb_build_object(
    'slug', 'e06-reopen-publish-fixture', 'title', 'E06 reopening publish fixture',
    'release_date', '2026-09-17', 'release_type_id', v_type, 'label_id', v_label->>'label_id',
    'review', '', 'status', 'draft', 'credit_quality', 'legacy',
    'artist_ids', jsonb_build_array(v_artist), 'collaborator_ids', '[]'::jsonb,
    'genre_ids', jsonb_build_array(v_genre->>'genre_id'), 'country_ids', jsonb_build_array(v_country),
    'radar', jsonb_build_object('experimental', 0, 'denso', 0, 'sintetico', 0, 'bailable', 0, 'rapido', 0),
    'links', jsonb_build_array(jsonb_build_object('provider', 'fixture', 'url', 'https://example.test/e06', 'is_primary', true)),
    'cover_url', null
  );
  v_created := public.admin_create_catalog_release(v_payload, 'draft before publish validation');
  v_release := (v_created->>'release_id')::uuid;
  v_before := private.catalog_snapshot(v_release);
  select count(*) into v_events from private.catalog_change_events where entity_id = v_release;
  begin
    perform public.admin_update_catalog_release(v_release, 1, v_payload, 'forced incomplete publish', 'publish');
    raise exception 'incomplete publish unexpectedly succeeded';
  exception when check_violation then null;
  end;
  v_after := private.catalog_snapshot(v_release);
  if v_before <> v_after or v_events <> (select count(*) from private.catalog_change_events where entity_id = v_release) then
    raise exception 'incomplete publish was not atomic';
  end if;
  v_payload := jsonb_set(v_payload, '{cover_url}', '"https://example.test/e06-cover.jpg"');
  v_published := public.admin_update_catalog_release(v_release, 1, v_payload, 'publish with blank review and legacy quality', 'publish');
  if (v_published->>'catalog_version')::integer <> 2
     or (select status from public.releases where id = v_release) <> 'published' then
    raise exception 'valid publish did not accept optional review/credit_quality';
  end if;

  -- Same release_date/title ties plus a query/filter verify that ordering
  -- happens before pagination and ends in an immutable UUID tie-breaker.
  foreach v_order_payload in array array[
    jsonb_set(jsonb_set(v_payload, '{slug}', '"e06-order-a"'), '{title}', '"E06 Ordering Fixture"'),
    jsonb_set(jsonb_set(v_payload, '{slug}', '"e06-order-b"'), '{title}', '"E06 Ordering Fixture"'),
    jsonb_set(jsonb_set(v_payload, '{slug}', '"e06-order-c"'), '{title}', '"E06 Ordering Fixture"')
  ] loop
    v_order_payload := jsonb_set(v_order_payload, '{status}', '"draft"');
    perform public.admin_create_catalog_release(v_order_payload, 'ordering fixture');
  end loop;
  v_first := public.admin_list_catalog_releases('E06 Ordering Fixture', array['draft'], array[v_type], array['legacy'], 1, 2, 'release_date', 'desc');
  v_second := public.admin_list_catalog_releases('E06 Ordering Fixture', array['draft'], array[v_type], array['legacy'], 2, 2, 'release_date', 'desc');
  select array_agg((x->>'id')::uuid order by page_no, ordinality) into v_order_ids
  from (
    select 1 as page_no, x.value as x, x.ordinality from jsonb_array_elements(v_first->'items') with ordinality as x(value, ordinality)
    union all select 2, x.value, x.ordinality from jsonb_array_elements(v_second->'items') with ordinality as x(value, ordinality)
  ) s;
  select array_agg(x order by x) into v_expected_order_ids from unnest(v_order_ids) x;
  if cardinality(v_order_ids) <> 3 or (select count(distinct x) from unnest(v_order_ids) x) <> 3
     or v_order_ids <> v_expected_order_ids
     or (v_first->>'order_key') <> 'release_date' or (v_first->>'order_direction') <> 'desc' then
    raise exception 'stable pagination omitted or duplicated a tied release';
  end if;
  begin
    perform public.admin_list_catalog_releases('E06 Ordering Fixture', array['draft'], array[v_type], array['legacy'], 1, 2, 'untrusted_sql', 'desc');
    raise exception 'unallowlisted sort key succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

rollback;
