-- E08: inference is evidence, never a published fact.  The only mutation of
-- public credits below is delegated to the audited E06 RPC after an admin has
-- explicitly approved both proposal and batch.

create table private.credit_inference_proposals (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete restrict,
  heuristic_version text not null check (btrim(heuristic_version) <> ''),
  classification text not null check (classification in ('high', 'review', 'manual')),
  status text not null default 'ready_for_review'
    check (status in ('ready_for_review', 'approved', 'rejected', 'applied', 'conflict')),
  base_catalog_version integer not null check (base_catalog_version > 0),
  proposed_primary_artist_ids jsonb not null check (jsonb_typeof(proposed_primary_artist_ids) = 'array'),
  proposed_collaborator_artist_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(proposed_collaborator_artist_ids) = 'array'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) > 0),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  decision_note text,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  proposal_version integer not null default 1 check (proposal_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, heuristic_version),
  check ((status in ('approved', 'rejected', 'applied', 'conflict')) = (decided_at is not null)),
  check ((status in ('approved', 'rejected', 'applied', 'conflict')) = (decided_by is not null)),
  check (status <> 'approved' or classification = 'high')
);

create table private.credit_inference_batches (
  id uuid primary key default gen_random_uuid(),
  heuristic_version text not null check (btrim(heuristic_version) <> ''),
  status text not null default 'approved'
    check (status in ('approved', 'applying', 'applied', 'applied_with_conflicts', 'reverted', 'reverted_with_conflicts')),
  reason text not null check (btrim(reason) <> ''),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  applied_at timestamptz,
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.credit_inference_applications (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.credit_inference_batches(id) on delete restrict,
  proposal_id uuid not null unique references private.credit_inference_proposals(id) on delete restrict,
  release_id uuid not null references public.releases(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'conflict', 'reverted')),
  catalog_change_set_id uuid references private.catalog_change_sets(id) on delete restrict,
  result_catalog_version integer,
  revert_change_set_id uuid references private.catalog_change_sets(id) on delete restrict,
  failure jsonb,
  applied_at timestamptz,
  reverted_at timestamptz,
  check ((status = 'applied') = (catalog_change_set_id is not null)),
  check ((status = 'reverted') = (revert_change_set_id is not null))
);

create table private.credit_inference_events (
  id bigint generated always as identity primary key,
  proposal_id uuid references private.credit_inference_proposals(id) on delete restrict,
  batch_id uuid references private.credit_inference_batches(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null check (action in ('created', 'approved', 'rejected', 'applied', 'conflict', 'reverted')),
  before_state jsonb,
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz not null default now(),
  check (proposal_id is not null or batch_id is not null),
  check (before_state is null or jsonb_typeof(before_state) = 'object')
);

create index credit_inference_proposals_review_idx
  on private.credit_inference_proposals (status, classification, created_at, id)
  where status in ('ready_for_review', 'approved', 'conflict');
create index credit_inference_proposals_release_idx
  on private.credit_inference_proposals (release_id, created_at desc);
create index credit_inference_applications_batch_idx
  on private.credit_inference_applications (batch_id, status, id);
create index credit_inference_events_proposal_idx
  on private.credit_inference_events (proposal_id, created_at desc);

alter table private.credit_inference_proposals enable row level security;
alter table private.credit_inference_batches enable row level security;
alter table private.credit_inference_applications enable row level security;
alter table private.credit_inference_events enable row level security;
revoke all on table private.credit_inference_proposals, private.credit_inference_batches,
  private.credit_inference_applications, private.credit_inference_events from public, anon, authenticated;
revoke all on sequence private.credit_inference_events_id_seq from public, anon, authenticated;

create or replace function private.credit_inference_event(
  p_proposal_id uuid, p_batch_id uuid, p_action text, p_before jsonb, p_after jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into private.credit_inference_events(proposal_id,batch_id,actor_id,action,before_state,after_state)
  values (p_proposal_id,p_batch_id,(select auth.uid()),p_action,p_before,p_after);
$$;

-- Worker-only entry point. It has no client grant and enforces that proposals
-- contain known, disjoint artists and concrete evidence before entering review.
create or replace function private.enqueue_credit_inference_proposal(
  p_release_id uuid, p_heuristic_version text, p_classification text,
  p_primary_artist_ids jsonb, p_collaborator_artist_ids jsonb,
  p_evidence jsonb, p_warnings jsonb default '[]'::jsonb,
  p_source_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_version integer; v_id uuid; v_existing private.credit_inference_proposals%rowtype;
begin
  if nullif(btrim(coalesce(p_heuristic_version,'')),'') is null
     or p_classification not in ('high','review','manual')
     or jsonb_typeof(p_primary_artist_ids) <> 'array' or jsonb_array_length(p_primary_artist_ids) = 0
     or jsonb_typeof(p_collaborator_artist_ids) <> 'array'
     or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) = 0
     or jsonb_typeof(p_warnings) <> 'array' or jsonb_typeof(p_source_metadata) <> 'object' then
    raise exception 'Invalid credit inference proposal' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_primary_artist_ids) x where x !~* '^[0-9a-f-]{36}$')
     or exists (select 1 from jsonb_array_elements_text(p_collaborator_artist_ids) x where x !~* '^[0-9a-f-]{36}$')
     or exists (select 1 from jsonb_array_elements_text(p_primary_artist_ids) a join jsonb_array_elements_text(p_collaborator_artist_ids) b on a = b)
     or (select count(*) from jsonb_array_elements_text(p_primary_artist_ids)) <> (select count(distinct value) from jsonb_array_elements_text(p_primary_artist_ids))
     or (select count(*) from jsonb_array_elements_text(p_collaborator_artist_ids)) <> (select count(distinct value) from jsonb_array_elements_text(p_collaborator_artist_ids))
     or (select count(*) from public.artists where id in (select value::uuid from jsonb_array_elements_text(p_primary_artist_ids))) <> jsonb_array_length(p_primary_artist_ids)
     or (select count(*) from public.artists where id in (select value::uuid from jsonb_array_elements_text(p_collaborator_artist_ids))) <> jsonb_array_length(p_collaborator_artist_ids) then
    raise exception 'Proposal credits must be unique existing artists' using errcode = '23503';
  end if;
  select catalog_version into v_version from public.releases where id=p_release_id;
  if v_version is null then raise exception 'Release not found' using errcode='P0002'; end if;
  insert into private.credit_inference_proposals(release_id,heuristic_version,classification,base_catalog_version,proposed_primary_artist_ids,proposed_collaborator_artist_ids,evidence,warnings,source_metadata)
  values(p_release_id,btrim(p_heuristic_version),p_classification,v_version,p_primary_artist_ids,p_collaborator_artist_ids,p_evidence,p_warnings,p_source_metadata)
  on conflict(release_id,heuristic_version) do nothing returning id into v_id;
  if v_id is null then
    select * into v_existing from private.credit_inference_proposals where release_id=p_release_id and heuristic_version=btrim(p_heuristic_version);
    return jsonb_build_object('proposal_id',v_existing.id,'created',false,'status',v_existing.status);
  end if;
  perform private.credit_inference_event(v_id,null,'created',null,jsonb_build_object('classification',p_classification,'base_catalog_version',v_version));
  return jsonb_build_object('proposal_id',v_id,'created',true,'status','ready_for_review');
end;
$$;

create or replace function public.admin_list_credit_inference_proposals(
  p_statuses text[] default null, p_classifications text[] default null,
  p_page integer default 1, p_page_size integer default 25
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_items jsonb; v_total integer; v_offset integer;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
     or (p_statuses is not null and exists(select 1 from unnest(p_statuses) s where s not in ('ready_for_review','approved','rejected','applied','conflict')))
     or (p_classifications is not null and exists(select 1 from unnest(p_classifications) c where c not in ('high','review','manual'))) then
    raise exception 'Invalid credit proposal filter' using errcode='22023';
  end if;
  v_offset := (p_page-1)*p_page_size;
  with filtered as (
    select p.*, r.title, r.slug, r.catalog_version as current_catalog_version
    from private.credit_inference_proposals p join public.releases r on r.id=p.release_id
    where (p_statuses is null or p.status=any(p_statuses)) and (p_classifications is null or p.classification=any(p_classifications))
  ) select count(*) into v_total from filtered;
  with filtered as (
    select p.*, r.title, r.slug, r.catalog_version as current_catalog_version
    from private.credit_inference_proposals p join public.releases r on r.id=p.release_id
    where (p_statuses is null or p.status=any(p_statuses)) and (p_classifications is null or p.classification=any(p_classifications))
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'release_id',release_id,'title',title,'slug',slug,'classification',classification,'status',status,'heuristic_version',heuristic_version,'base_catalog_version',base_catalog_version,'current_catalog_version',current_catalog_version,'primary_artist_ids',proposed_primary_artist_ids,'collaborator_artist_ids',proposed_collaborator_artist_ids,'evidence',evidence,'warnings',warnings,'source_metadata',source_metadata,'decision_note',decision_note,'decided_by',decided_by,'decided_at',decided_at,'proposal_version',proposal_version,'created_at',created_at,'updated_at',updated_at) order by created_at, id),'[]'::jsonb) into v_items from (select * from filtered order by created_at, id offset v_offset limit p_page_size) page;
  return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'page_size',p_page_size);
end;
$$;

create or replace function public.admin_decide_credit_inference_proposal(
  p_proposal_id uuid, p_expected_version integer, p_decision text, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v private.credit_inference_proposals%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'Decision and note are required' using errcode='22023'; end if;
  select * into v from private.credit_inference_proposals where id=p_proposal_id for update;
  if not found or v.status <> 'ready_for_review' then raise exception 'Only a pending proposal can be decided' using errcode='22023'; end if;
  if v.proposal_version <> p_expected_version then raise exception 'Proposal version conflict' using errcode='40001'; end if;
  if p_decision='approved' and v.classification <> 'high' then raise exception 'Review/manual proposals require individual console editing' using errcode='22023'; end if;
  v_before := jsonb_build_object('status',v.status,'proposal_version',v.proposal_version);
  update private.credit_inference_proposals set status=p_decision,decision_note=btrim(p_note),decided_by=(select auth.uid()),decided_at=now(),proposal_version=proposal_version+1,updated_at=now() where id=v.id returning * into v;
  v_after := jsonb_build_object('status',v.status,'proposal_version',v.proposal_version,'decision_note',v.decision_note);
  perform private.credit_inference_event(v.id,null,p_decision,v_before,v_after);
  return jsonb_build_object('proposal_id',v.id,'status',v.status,'proposal_version',v.proposal_version);
end;
$$;

create or replace function public.admin_create_credit_inference_batch(p_proposal_ids uuid[], p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch uuid; v_count integer; v_version text;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if coalesce(array_length(p_proposal_ids,1),0) = 0 or nullif(btrim(coalesce(p_reason,'')),'') is null
     or (select count(*) from unnest(p_proposal_ids)) <> (select count(distinct x) from unnest(p_proposal_ids) x) then raise exception 'Unique proposals and reason are required' using errcode='22023'; end if;
  perform 1 from private.credit_inference_proposals where id=any(p_proposal_ids) for update;
  select count(*), min(heuristic_version) into v_count,v_version from private.credit_inference_proposals where id=any(p_proposal_ids) and status='approved' and classification='high';
  if v_count <> array_length(p_proposal_ids,1) or exists(select 1 from private.credit_inference_proposals where id=any(p_proposal_ids) and heuristic_version <> v_version) then raise exception 'Only approved high proposals from one heuristic version may form a batch' using errcode='22023'; end if;
  insert into private.credit_inference_batches(heuristic_version,reason,approved_by) values(v_version,btrim(p_reason),(select auth.uid())) returning id into v_batch;
  insert into private.credit_inference_applications(batch_id,proposal_id,release_id) select v_batch,id,release_id from private.credit_inference_proposals where id=any(p_proposal_ids);
  return jsonb_build_object('batch_id',v_batch,'proposal_count',v_count,'status','approved');
end;
$$;

create or replace function public.admin_apply_credit_inference_batch(p_batch_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b private.credit_inference_batches%rowtype; a private.credit_inference_applications%rowtype; p private.credit_inference_proposals%rowtype; v_current jsonb; v_payload jsonb; v_result jsonb; v_applied integer := 0; v_conflicts integer := 0;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into b from private.credit_inference_batches where id=p_batch_id for update;
  if not found or b.status not in ('approved','applied_with_conflicts') then raise exception 'Batch is not applicable' using errcode='22023'; end if;
  update private.credit_inference_batches set status='applying' where id=b.id;
  for a in select * from private.credit_inference_applications where batch_id=b.id and status in ('pending','conflict') order by id for update skip locked loop
    select * into p from private.credit_inference_proposals where id=a.proposal_id for update;
    select private.catalog_snapshot(a.release_id) into v_current;
    if v_current is null or (v_current->>'catalog_version')::integer <> p.base_catalog_version then
      update private.credit_inference_applications set status='conflict',failure=jsonb_build_object('code','40001','reason','catalog_version_changed') where id=a.id;
      update private.credit_inference_proposals set status='conflict',updated_at=now(),proposal_version=proposal_version+1 where id=p.id;
      perform private.credit_inference_event(p.id,b.id,'conflict',jsonb_build_object('status',p.status),jsonb_build_object('status','conflict','reason','catalog_version_changed'));
      v_conflicts := v_conflicts + 1; continue;
    end if;
    begin
      v_payload := v_current - 'id' - 'catalog_version';
      v_payload := jsonb_set(v_payload,'{artist_ids}',p.proposed_primary_artist_ids);
      v_payload := jsonb_set(v_payload,'{collaborator_ids}',p.proposed_collaborator_artist_ids);
      v_payload := jsonb_set(v_payload,'{credit_quality}','"verified"'::jsonb);
      v_result := public.admin_update_catalog_release(a.release_id,p.base_catalog_version,v_payload,btrim(p_reason),'update');
      update private.credit_inference_applications set status='applied',catalog_change_set_id=(v_result->>'change_set_id')::uuid,result_catalog_version=(v_result->>'catalog_version')::integer,applied_at=now(),failure=null where id=a.id;
      update private.credit_inference_proposals set status='applied',updated_at=now(),proposal_version=proposal_version+1 where id=p.id;
      perform private.credit_inference_event(p.id,b.id,'applied',jsonb_build_object('status',p.status,'base_catalog_version',p.base_catalog_version),jsonb_build_object('status','applied','change_set_id',v_result->>'change_set_id','catalog_version',v_result->>'catalog_version'));
      v_applied := v_applied + 1;
    exception when others then
      update private.credit_inference_applications set status='conflict',failure=jsonb_build_object('code',sqlstate,'message',sqlerrm) where id=a.id;
      update private.credit_inference_proposals set status='conflict',updated_at=now(),proposal_version=proposal_version+1 where id=p.id;
      perform private.credit_inference_event(p.id,b.id,'conflict',jsonb_build_object('status',p.status),jsonb_build_object('status','conflict','code',sqlstate));
      v_conflicts := v_conflicts + 1;
    end;
  end loop;
  update private.credit_inference_batches set status=case when v_conflicts > 0 then 'applied_with_conflicts' else 'applied' end,applied_at=now() where id=b.id;
  return jsonb_build_object('batch_id',b.id,'applied',v_applied,'conflicts',v_conflicts,'status',case when v_conflicts > 0 then 'applied_with_conflicts' else 'applied' end);
end;
$$;

create or replace function public.admin_revert_credit_inference_batch(p_batch_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b private.credit_inference_batches%rowtype; a private.credit_inference_applications%rowtype; v_current integer; v_result jsonb; v_reverted integer := 0; v_conflicts integer := 0;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into b from private.credit_inference_batches where id=p_batch_id for update;
  if not found or b.status not in ('applied','applied_with_conflicts') then raise exception 'Batch is not revertible' using errcode='22023'; end if;
  for a in select * from private.credit_inference_applications where batch_id=b.id and status='applied' order by applied_at desc, id desc for update skip locked loop
    select catalog_version into v_current from public.releases where id=a.release_id;
    if v_current is distinct from a.result_catalog_version then
      update private.credit_inference_applications set status='conflict',failure=jsonb_build_object('code','40001','reason','later_catalog_change') where id=a.id;
      v_conflicts := v_conflicts + 1; continue;
    end if;
    begin
      v_result := public.admin_revert_catalog_change(a.catalog_change_set_id,v_current,btrim(p_reason));
      update private.credit_inference_applications set status='reverted',revert_change_set_id=(v_result->>'change_set_id')::uuid,reverted_at=now(),failure=null where id=a.id;
      perform private.credit_inference_event(a.proposal_id,b.id,'reverted',jsonb_build_object('status','applied','change_set_id',a.catalog_change_set_id),jsonb_build_object('status','reverted','change_set_id',v_result->>'change_set_id'));
      v_reverted := v_reverted + 1;
    exception when others then
      update private.credit_inference_applications set status='conflict',failure=jsonb_build_object('code',sqlstate,'message',sqlerrm) where id=a.id;
      v_conflicts := v_conflicts + 1;
    end;
  end loop;
  update private.credit_inference_batches set status=case when v_conflicts > 0 then 'reverted_with_conflicts' else 'reverted' end,reverted_at=now(),reverted_by=(select auth.uid()) where id=b.id;
  return jsonb_build_object('batch_id',b.id,'reverted',v_reverted,'conflicts',v_conflicts,'status',case when v_conflicts > 0 then 'reverted_with_conflicts' else 'reverted' end);
end;
$$;

revoke all on function private.credit_inference_event(uuid,uuid,text,jsonb,jsonb), private.enqueue_credit_inference_proposal(uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.admin_list_credit_inference_proposals(text[],text[],integer,integer), public.admin_decide_credit_inference_proposal(uuid,integer,text,text), public.admin_create_credit_inference_batch(uuid[],text), public.admin_apply_credit_inference_batch(uuid,text), public.admin_revert_credit_inference_batch(uuid,text) from public, anon, authenticated;
grant execute on function public.admin_list_credit_inference_proposals(text[],text[],integer,integer), public.admin_decide_credit_inference_proposal(uuid,integer,text,text), public.admin_create_credit_inference_batch(uuid[],text), public.admin_apply_credit_inference_batch(uuid,text), public.admin_revert_credit_inference_batch(uuid,text) to authenticated;
