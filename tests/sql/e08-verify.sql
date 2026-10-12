-- Run only against Biblioteca Staging:
-- npx supabase db query --linked --project-ref hgocyrzhgohetfpzbmfs --file tests/sql/e08-verify.sql
-- All fixture rows, E06 events and applied/reverted credit facts disappear at ROLLBACK.
begin;

do $$
declare
  admin_id uuid; community_id uuid; collaborator_id uuid; artist_a uuid; artist_b uuid;
  release_a uuid; release_b uuid; before_a jsonb; after_a jsonb; restored_a jsonb;
  high_a jsonb; high_a_retry jsonb; high_b jsonb; review jsonb; manual jsonb;
  decided_a jsonb; decided_b jsonb; batch jsonb; applied jsonb; reverted jsonb;
  list_result jsonb; v_payload jsonb; v_version integer;
begin
  select id into admin_id from public.profiles where role='admin' limit 1;
  select id into community_id from public.profiles where role='comunidad' limit 1;
  select id into collaborator_id from public.profiles where role='colaborador' limit 1;
  if collaborator_id is null then
    insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values (gen_random_uuid(),'authenticated','authenticated','e08-collaborator-fixture@example.test','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"e08collaboratorfixture","display_name":"E08 collaborator fixture"}'::jsonb,now(),now())
    returning id into collaborator_id;
    update public.profiles set role='colaborador' where id=collaborator_id;
  end if;
  select id into artist_a from public.artists order by id limit 1;
  select id into artist_b from public.artists where id <> artist_a order by id limit 1;
  select id into release_a from public.releases where status='published' order by id limit 1;
  select id into release_b from public.releases where status='published' and id <> release_a order by id limit 1;
  if admin_id is null or community_id is null or collaborator_id is null or artist_a is null or artist_b is null or release_a is null or release_b is null then
    raise exception 'E08 fixture prerequisites are absent';
  end if;

  -- Browser roles cannot read the private queue or invoke its public admin RPCs.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',community_id,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_list_credit_inference_proposals(); raise exception 'community read queue'; exception when insufficient_privilege then null; end;
  begin perform public.admin_apply_credit_inference_batch(gen_random_uuid(),'must fail'); raise exception 'community applied queue'; exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',collaborator_id,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_decide_credit_inference_proposal(gen_random_uuid(),1,'rejected','must fail'); raise exception 'collaborator decided queue'; exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  begin perform public.admin_list_credit_inference_proposals(); raise exception 'anon read queue'; exception when insufficient_privilege then null; end;
  reset role;

  select private.catalog_snapshot(release_a) into before_a;
  high_a := private.enqueue_credit_inference_proposal(release_a,'credit-inference-v1-fixture-a','high',jsonb_build_array(artist_a),jsonb_build_array(artist_b),jsonb_build_array(jsonb_build_object('kind','structured_author','field','structured_author','value','fixture')), '[]', jsonb_build_object('provider','bandcamp','source_available',true));
  high_a_retry := private.enqueue_credit_inference_proposal(release_a,'credit-inference-v1-fixture-a','high',jsonb_build_array(artist_a),jsonb_build_array(artist_b),jsonb_build_array(jsonb_build_object('kind','structured_author','field','structured_author','value','fixture')), '[]', jsonb_build_object('provider','bandcamp','source_available',true));
  if (high_a->>'created')::boolean is not true or (high_a_retry->>'created')::boolean is not false or high_a->>'proposal_id' <> high_a_retry->>'proposal_id' then raise exception 'enqueue is not idempotent'; end if;
  if private.catalog_snapshot(release_a) <> before_a then raise exception 'dry-run/enqueue mutated published facts'; end if;

  -- review/manual cannot be batch-approved: they remain for individual E07 editing.
  review := private.enqueue_credit_inference_proposal(release_b,'credit-inference-v1-review','review',jsonb_build_array(artist_a),'[]',jsonb_build_array(jsonb_build_object('kind','controlled_signal','field','title','value','feat.','signal','feat.')),jsonb_build_array('collaboration_signal_requires_editorial_review'),'{}');
  manual := private.enqueue_credit_inference_proposal(release_b,'credit-inference-v1-manual','manual',jsonb_build_array(artist_a),'[]',jsonb_build_array(jsonb_build_object('kind','missing_source','field','source','value','unavailable')),jsonb_build_array('source_unavailable_or_unsupported'),'{}');
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated')::text, true);
  begin perform public.admin_decide_credit_inference_proposal((review->>'proposal_id')::uuid,1,'approved','must not batch'); raise exception 'review proposal was approved'; exception when invalid_parameter_value then null; end;
  perform public.admin_decide_credit_inference_proposal((review->>'proposal_id')::uuid,1,'rejected','editor will correct in E07');
  perform public.admin_decide_credit_inference_proposal((manual->>'proposal_id')::uuid,1,'rejected','source unavailable; manual review required');

  decided_a := public.admin_decide_credit_inference_proposal((high_a->>'proposal_id')::uuid,1,'approved','editorial evidence checked');
  if decided_a->>'status' <> 'approved' then raise exception 'high proposal approval failed'; end if;
  -- A competing E06 edit creates a per-row conflict; it must not roll back A.
  select private.catalog_snapshot(release_b) into v_payload;
  v_version := (v_payload->>'catalog_version')::integer;
  high_b := private.enqueue_credit_inference_proposal(release_b,'credit-inference-v1-fixture-a','high',jsonb_build_array(artist_a),jsonb_build_array(artist_b),jsonb_build_array(jsonb_build_object('kind','structured_author','field','structured_author','value','fixture')), '[]', jsonb_build_object('provider','bandcamp','source_available',true));
  decided_b := public.admin_decide_credit_inference_proposal((high_b->>'proposal_id')::uuid,1,'approved','editorial evidence checked');
  v_payload := v_payload - 'id' - 'catalog_version';
  perform public.admin_update_catalog_release(release_b,v_version,v_payload,'fixture competing E06 edit','update');
  batch := public.admin_create_credit_inference_batch(array[(high_a->>'proposal_id')::uuid,(high_b->>'proposal_id')::uuid],'fixture approved batch');
  applied := public.admin_apply_credit_inference_batch((batch->>'batch_id')::uuid,'fixture batch application');
  if (applied->>'applied')::integer <> 1 or (applied->>'conflicts')::integer <> 1 then raise exception 'batch did not isolate row conflict'; end if;
  select private.catalog_snapshot(release_a) into after_a;
  if after_a->'artist_ids' <> jsonb_build_array(artist_a) or after_a->'collaborator_ids' <> jsonb_build_array(artist_b) or after_a->>'credit_quality' <> 'verified' then raise exception 'approved batch did not apply exact facts'; end if;
  if not exists (select 1 from private.catalog_change_events e join private.credit_inference_applications a on a.catalog_change_set_id=e.change_set_id where a.batch_id=(batch->>'batch_id')::uuid and a.status='applied') then raise exception 'E06 audit missing from applied row'; end if;
  list_result := public.admin_list_credit_inference_proposals(array['applied','conflict','rejected'],null,1,25);
  if (list_result->>'total')::integer < 4 then raise exception 'admin queue response omitted evidence/statuses'; end if;

  reverted := public.admin_revert_credit_inference_batch((batch->>'batch_id')::uuid,'fixture compensating rollback');
  if (reverted->>'reverted')::integer <> 1 or (reverted->>'conflicts')::integer <> 0 then raise exception 'batch rollback did not compensate exact applied row'; end if;
  select private.catalog_snapshot(release_a) into restored_a;
  -- The compensating E06 event deliberately advances catalog_version and
  -- updated_at; every editorial fact, including both credit groups/quality,
  -- must otherwise be identical to the pre-batch snapshot.
  if (restored_a - 'catalog_version' - 'updated_at') <> (before_a - 'catalog_version' - 'updated_at') then raise exception 'rollback did not restore release facts exactly'; end if;
  if not exists (select 1 from private.credit_inference_events where batch_id=(batch->>'batch_id')::uuid and action='reverted') then raise exception 'compensating audit was not retained'; end if;
end;
$$;

rollback;
