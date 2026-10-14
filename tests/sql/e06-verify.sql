-- Run with: supabase db query --linked --file tests/sql/e06-verify.sql
--   or, on the local stack: docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/e06-verify.sql
-- All fixtures, including roles and audit evidence, disappear at ROLLBACK.
-- Staging has real admin/community profiles and artists; a clean local chain has
-- none, so the missing ones are created inside the transaction (S6).
begin;

do $$
declare
  admin_id uuid; community_id uuid; artist_id uuid; type_id uuid;
  created jsonb; updated jsonb; reverted jsonb; archived jsonb; before_invalid jsonb; after_invalid jsonb; listed jsonb; detail jsonb; artist_created jsonb; artist_duplicate jsonb; artist_accent jsonb; artist_unaccented jsonb;
  release_id uuid; update_set uuid; version_2 integer; event_count integer; contribution_id uuid; legacy_release_id uuid;
  payload jsonb;
begin
  select id into admin_id from public.profiles where role = 'admin' limit 1;
  select id into community_id from public.profiles where role = 'comunidad' limit 1;
  select id into artist_id from public.artists limit 1;
  select id into type_id from public.release_types where slug = 'ep';
  if admin_id is null then
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'e06-admin-fixture@example.test', jsonb_build_object('username', 'e06adminfixture'), now(), now())
    returning id into admin_id;
    update public.profiles set role = 'admin' where id = admin_id;
  end if;
  if community_id is null then
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'e06-community-fixture@example.test', jsonb_build_object('username', 'e06communityfixture'), now(), now())
    returning id into community_id;
  end if;
  if artist_id is null then
    insert into public.artists (name, normalized_name, slug)
    values ('E06 fixture artist', 'e06 fixture artist', 'e06-fixture-artist') returning id into artist_id;
  end if;
  if admin_id is null or community_id is null or artist_id is null or type_id is null then
    raise exception 'E06 fixture prerequisites are absent';
  end if;

  payload := jsonb_build_object(
    'slug', 'e06-audited-fixture', 'title', 'E06 audited fixture', 'release_date', '2026-09-16',
    'release_type_id', type_id, 'label_id', null, 'review', '', 'status', 'draft',
    'credit_quality', 'proposed', 'artist_ids', jsonb_build_array(artist_id),
    'collaborator_ids', '[]'::jsonb, 'genre_ids', '[]'::jsonb, 'country_ids', '[]'::jsonb,
    'radar', jsonb_build_object('experimental', 1, 'denso', 2, 'sintetico', 3, 'bailable', 4, 'rapido', 5),
    'links', '[]'::jsonb, 'cover_url', null
  );

  -- Direct table access and RPC use are denied even when bypassing the UI.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', community_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_create_catalog_release(payload, 'must fail');
    raise exception 'community unexpectedly invoked admin mutation';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into private.catalog_change_sets(actor_id, operation, entity_id, reason, result_version)
    select community_id, 'create', id, 'must fail', 1 from public.releases limit 1;
    raise exception 'community unexpectedly wrote audit log';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- New admin-only read model cannot be used by community outside the UI.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', community_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_list_catalog_releases();
    raise exception 'community unexpectedly read administrative catalog';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.admin_create_catalog_release(payload, 'must fail');
    raise exception 'anon unexpectedly invoked admin mutation';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  created := public.admin_create_catalog_release(payload, 'fixture creation');
  release_id := (created->>'release_id')::uuid;
  if (created->>'catalog_version')::integer <> 1 then raise exception 'create version was not 1'; end if;
  if (select count(*) from private.catalog_change_events where entity_id = release_id) <> 1 then raise exception 'create audit missing'; end if;

  payload := jsonb_set(payload, '{title}', '"E06 edited fixture"');
  updated := public.admin_update_catalog_release(release_id, 1, payload, 'fixture edit');
  version_2 := (updated->>'catalog_version')::integer;
  update_set := (updated->>'change_set_id')::uuid;
  if version_2 <> 2 then raise exception 'update version was not 2'; end if;
  if (select before_state->>'title' from private.catalog_change_events where change_set_id = update_set) <> 'E06 audited fixture'
     or (select after_state->>'title' from private.catalog_change_events where change_set_id = update_set) <> 'E06 edited fixture' then
    raise exception 'before/after evidence is incorrect';
  end if;

  begin
    perform public.admin_update_catalog_release(release_id, 1, payload, 'stale write');
    raise exception 'stale write unexpectedly succeeded';
  exception when serialization_failure then null;
  end;
  before_invalid := private.catalog_snapshot(release_id);
  select count(*) into event_count from private.catalog_change_events where entity_id = release_id;
  begin
    perform public.admin_update_catalog_release(release_id, 2, jsonb_set(payload, '{radar,rapido}', '9'::jsonb), 'invalid atomically');
    raise exception 'invalid mutation unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  after_invalid := private.catalog_snapshot(release_id);
  if before_invalid <> after_invalid or event_count <> (select count(*) from private.catalog_change_events where entity_id = release_id) then
    raise exception 'failed mutation was not atomic';
  end if;

  reverted := public.admin_revert_catalog_change(update_set, version_2, 'fixture reversal');
  if (reverted->>'catalog_version')::integer <> 3
     or (select title from public.releases where id = release_id) <> 'E06 audited fixture'
     or (select status from private.catalog_change_sets where id = update_set) <> 'reverted' then
    raise exception 'reversion did not restore the intended state';
  end if;
  begin
    perform public.admin_revert_catalog_change(update_set, 3, 'repeat reversal');
    raise exception 'reverted change unexpectedly reverted twice';
  exception when invalid_parameter_value then null;
  end;

  payload := jsonb_set(jsonb_set(payload, '{slug}', '"e06-archived-fixture"'), '{title}', '"E06 archived fixture"');
  payload := jsonb_set(payload, '{status}', '"archived"');
  archived := public.admin_create_catalog_release(payload, 'fixture archived creation');
  listed := public.admin_list_catalog_releases('E06', array['draft','archived'], null, array['proposed'], 1, 10);
  detail := public.admin_get_catalog_release(release_id);
  if (listed->>'total')::integer <> 2 or not exists (select 1 from jsonb_array_elements(listed->'items') x where (x->>'id')::uuid = release_id)
     or not exists (select 1 from jsonb_array_elements(listed->'items') x where (x->>'id')::uuid = (archived->>'release_id')::uuid and x->>'status' = 'archived')
     or detail->>'catalog_version' <> '3' or detail ? 'source_payload' or not (detail ? 'source') then
    raise exception 'admin list/detail contract is incomplete or leaked private source data';
  end if;
  if jsonb_array_length(public.admin_get_catalog_history(release_id)->'items') < 3 then
    raise exception 'admin history did not expose audited events';
  end if;
  artist_created := public.admin_create_catalog_artist('  E06   Confirmed Artist  ', true);
  artist_duplicate := public.admin_create_catalog_artist('E06 Confirmed Artist', true);
  if (artist_created->>'created')::boolean is not true or (artist_duplicate->>'duplicate')::boolean is not true
     or artist_created->>'artist_id' <> artist_duplicate->>'artist_id' then
    raise exception 'confirmed artist creation did not normalize/recover duplicate';
  end if;
  -- The second call takes the ON CONFLICT recovery path. The unique canonical
  -- index is also the serialization point for simultaneous callers.
  artist_accent := public.admin_create_catalog_artist('É06 Café Artist', true);
  artist_unaccented := public.admin_create_catalog_artist('E06 Cafe Artist', true);
  if (artist_accent->>'created')::boolean is not true or (artist_unaccented->>'duplicate')::boolean is not true
     or artist_accent->>'artist_id' <> artist_unaccented->>'artist_id'
     or (select count(*) from public.artists where private.normalize_catalog_artist_name(name) = private.normalize_catalog_artist_name('E06 Cafe Artist')) <> 1 then
    raise exception 'accent-insensitive canonical artist collision was not recovered atomically';
  end if;
  begin
    perform public.admin_create_catalog_artist('E06 Not Confirmed', false);
    raise exception 'unconfirmed artist creation unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;

  -- Contribution approval (E09). A legacy payload (version 1, unconfirmed) can
  -- no longer be approved: the RPC refuses it and publishes nothing. The old E02
  -- approval path this section used to exercise no longer exists.
  insert into public.contributions(author_id, status, source_url, payload)
  values (community_id, 'pending', 'https://example.test/e06-legacy', jsonb_build_object(
    'title', 'E06 legacy approval fixture', 'artists', jsonb_build_array('E06 legacy artist'),
    'type', 'EP', 'review', ''
  )) returning id into contribution_id;
  begin
    perform public.review_contribution(contribution_id, 'approved', null);
    raise exception 'legacy contribution unexpectedly approved';
  exception when invalid_parameter_value then null;
  end;
  if (select c.status from public.contributions c where c.id = contribution_id) <> 'pending'
     or (select c.release_id from public.contributions c where c.id = contribution_id) is not null
     or exists (select 1 from private.catalog_change_sets where reason = 'Approved contribution ' || contribution_id::text) then
    raise exception 'rejected legacy approval left a release or audit trail';
  end if;

  -- A confirmed v2 approval does publish, and the E06 compatibility trigger
  -- still leaves its create audit evidence.
  insert into public.contributions(author_id, status, source_url, payload, payload_version, payload_quality, queue_kind)
  values (community_id, 'pending', 'https://example.test/e06-v2', jsonb_build_object(
    'version', 2, 'title', 'E06 confirmed approval fixture', 'primary_artists', jsonb_build_array('E06 confirmed artist'),
    'genres', jsonb_build_array('E06 genre'), 'countries', jsonb_build_array('E06 country'),
    'release_type', 'ep', 'release_date', '2026-09-18'
  ), 2, 'confirmed', 'community') returning id into contribution_id;
  select rc.release_id into legacy_release_id from public.review_contribution(contribution_id, 'approved', null) rc;
  if legacy_release_id is null or not exists (
    select 1 from private.catalog_change_sets
    where entity_id = legacy_release_id and operation = 'create'
      and reason = 'Approved contribution ' || contribution_id::text
  ) then
    raise exception 'confirmed approval did not leave E06 audit evidence';
  end if;

  -- S6 / H5: a release can be created directly as published (E06 requires a
  -- complete payload to publish: date, type, label, artist, genre, country,
  -- HTTPS cover and exactly one primary link).
  insert into public.labels (name, normalized_name, slug) values ('E06 H5 label', 'e06 h5 label', 'e06-h5-label') on conflict do nothing;
  insert into public.genres (name, normalized_name, slug) values ('E06 H5 genre', 'e06 h5 genre', 'e06-h5-genre') on conflict do nothing;
  insert into public.countries (name, normalized_name, slug) values ('E06 H5 country', 'e06 h5 country', 'e06-h5-country') on conflict do nothing;
  payload := jsonb_set(jsonb_set(jsonb_set(payload, '{slug}', '"e06-published-fixture"'), '{title}', '"E06 published fixture"'), '{status}', '"published"');
  payload := payload || jsonb_build_object(
    'label_id', (select id from public.labels where slug = 'e06-h5-label'),
    'genre_ids', jsonb_build_array((select id from public.genres where slug = 'e06-h5-genre')),
    'country_ids', jsonb_build_array((select id from public.countries where slug = 'e06-h5-country')),
    'links', jsonb_build_array(jsonb_build_object('provider', 'bandcamp', 'url', 'https://e06.example.test/album', 'is_primary', true)),
    'cover_url', 'https://e06.example.test/cover.jpg');
  created := public.admin_create_catalog_release(payload, 'fixture published creation');
  if (select r.status from public.releases r where r.id = (created->>'release_id')::uuid) <> 'published'
     or (created->>'catalog_version')::integer <> 1
     or (select count(*) from private.catalog_change_events where entity_id = (created->>'release_id')::uuid) <> 1 then
    raise exception 'direct published creation failed (H5)';
  end if;
  begin
    perform public.admin_create_catalog_release(jsonb_set(jsonb_set(payload, '{slug}', '"e06-published-no-type"'), '{release_type_id}', 'null'::jsonb), 'published without type');
    raise exception 'published release without a type unexpectedly created';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.releases r where r.slug = 'e06-published-no-type') then
    raise exception 'rejected published creation left a row';
  end if;
end;
$$;

rollback;
