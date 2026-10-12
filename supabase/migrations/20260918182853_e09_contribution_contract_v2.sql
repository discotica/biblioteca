-- E09: contribution v2 is an RPC-only write boundary.  RLS controls what can
-- be read, while every state transition is serialized and authorized here.

alter table public.contributions
  add column payload_version smallint not null default 1,
  add column payload_quality text not null default 'legacy',
  add column detected_metadata jsonb not null default '{}'::jsonb,
  add column queue_kind text,
  add column submitted_at timestamptz;

alter table public.contributions
  add constraint contributions_payload_version_check check (payload_version in (1, 2)),
  add constraint contributions_payload_quality_check check (payload_quality in ('legacy', 'confirmed')),
  add constraint contributions_detected_metadata_check check (jsonb_typeof(detected_metadata) = 'object'),
  add constraint contributions_queue_kind_check check (queue_kind is null or queue_kind in ('community', 'collaborator'));

-- Preserve v1 facts verbatim where possible.  They are explicitly legacy and
-- cannot be mistaken for a person-confirmed v2 submission.
update public.contributions
set payload = (payload - 'artists' - 'type' - 'review' - 'cover_url') || jsonb_build_object(
      'version', 1,
      'title', coalesce(payload->'title', 'null'::jsonb),
      'primary_artists', coalesce(payload->'artists', '[]'::jsonb),
      'collaborators', '[]'::jsonb,
      'release_type', coalesce(payload->'type', 'null'::jsonb),
      'team_note', coalesce(payload->'review', 'null'::jsonb)
    ),
    detected_metadata = case when payload ? 'cover_url'
      then detected_metadata || jsonb_build_object('cover_url', payload->'cover_url', 'legacy_payload', true)
      else detected_metadata || jsonb_build_object('legacy_payload', true)
    end,
    payload_version = 1,
    payload_quality = 'legacy'
where payload_version = 1;

alter table public.contributions drop constraint contributions_status_check;
alter table public.contributions add constraint contributions_status_check
  check (status in ('draft', 'pending', 'ready_for_admin', 'changes_requested', 'rejected', 'approved'));

alter table public.contribution_events drop constraint contribution_events_action_check;
alter table public.contribution_events add constraint contribution_events_action_check
  check (action in ('created', 'updated', 'submitted', 'prepared_for_admin', 'changes_requested', 'rejected', 'approved'));

create index contributions_author_state_idx on public.contributions (author_id, updated_at desc);
create index contributions_admin_queue_idx on public.contributions (queue_kind, status, submitted_at, created_at)
  where status in ('pending', 'ready_for_admin');
create index contributions_reviewed_by_idx on public.contributions (reviewed_by) where reviewed_by is not null;
create index contribution_events_actor_idx on public.contribution_events (actor_id, created_at desc) where actor_id is not null;

create table private.contribution_preparations (
  contribution_id uuid primary key references public.contributions(id) on delete cascade,
  collaborator_id uuid not null references public.profiles(id) on delete restrict,
  working_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(working_payload) = 'object'),
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.contribution_preparations enable row level security;
revoke all on table private.contribution_preparations from public, anon, authenticated;

create or replace function private.is_collaborator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'colaborador');
$$;
revoke all on function private.is_collaborator() from public, anon, authenticated;

create or replace function private.assert_contribution_payload_v2(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v text; v_date date;
begin
  if jsonb_typeof(p_payload) <> 'object' or coalesce(p_payload->>'version', '') <> '2'
     or nullif(btrim(p_payload->>'title'), '') is null
     or jsonb_typeof(p_payload->'primary_artists') <> 'array' or jsonb_array_length(p_payload->'primary_artists') = 0
     or jsonb_typeof(coalesce(p_payload->'collaborators', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(p_payload->'genres') <> 'array' or jsonb_array_length(p_payload->'genres') = 0
     or jsonb_typeof(p_payload->'countries') <> 'array' or jsonb_array_length(p_payload->'countries') = 0
     or p_payload ? 'cover_url' then
    raise exception 'Invalid contribution v2 payload' using errcode = '22023';
  end if;
  if p_payload->>'release_type' not in ('album', 'ep', 'single', 'compilado', 'sample-pack') then
    raise exception 'A manually confirmed canonical release_type is required' using errcode = '22023';
  end if;
  begin v_date := (p_payload->>'release_date')::date; exception when others then
    raise exception 'release_date must use ISO YYYY-MM-DD' using errcode = '22023';
  end;
  if exists (select 1 from jsonb_array_elements_text(p_payload->'primary_artists') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_payload->'collaborators', '[]')) x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'genres') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'countries') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'primary_artists') a join jsonb_array_elements_text(coalesce(p_payload->'collaborators','[]')) b on lower(btrim(a)) = lower(btrim(b))) then
    raise exception 'Credits, genres, and countries must be nonempty; credits cannot be in both groups' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_payload->'detected_metadata', '{}'::jsonb)) <> 'object' then
    raise exception 'Detected metadata must be an object' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.record_contribution_transition(p_id uuid, p_action text, p_before jsonb, p_after jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contribution_events(contribution_id, actor_id, action, before_payload, after_payload, note)
  values (p_id, (select auth.uid()), p_action, p_before, p_after, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

drop trigger if exists record_contribution_event on public.contributions;
drop policy if exists "authors read their contributions and editors read the queue" on public.contributions;
drop policy if exists "authors create their own drafts" on public.contributions;
drop policy if exists "authors edit only drafts" on public.contributions;
drop policy if exists "authors and editors read contribution history" on public.contribution_events;
revoke all on table public.contributions, public.contribution_events from anon, authenticated;
grant select on table public.contributions, public.contribution_events to authenticated;

create policy "contribution authors read own rows" on public.contributions for select to authenticated
  using (author_id = (select auth.uid()));
create policy "admins read all contribution queues" on public.contributions for select to authenticated
  using ((select private.is_admin()));
create policy "collaborators read community preparation queue" on public.contributions for select to authenticated
  using ((select private.is_collaborator()) and queue_kind = 'community' and status = 'pending' and author_id <> (select auth.uid()));
create policy "contribution authors read own history" on public.contribution_events for select to authenticated
  using (exists (select 1 from public.contributions c where c.id = contribution_id and c.author_id = (select auth.uid())));
create policy "admins read all contribution history" on public.contribution_events for select to authenticated
  using ((select private.is_admin()));
create policy "collaborators read community preparation history" on public.contribution_events for select to authenticated
  using ((select private.is_collaborator()) and exists (select 1 from public.contributions c where c.id = contribution_id and c.queue_kind = 'community' and c.author_id <> (select auth.uid())));

create or replace function public.create_contribution_draft(p_source_url text, p_source_provider text, p_payload jsonb default '{}'::jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype;
begin
  if (select auth.uid()) is null or coalesce(p_source_url, '') !~* '^https://' or jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_detected_metadata) <> 'object' then raise exception 'Valid source URL and object payloads are required' using errcode='22023'; end if;
  insert into public.contributions(author_id,status,source_url,source_provider,payload,payload_version,payload_quality,detected_metadata)
  values((select auth.uid()),'draft',btrim(p_source_url),nullif(btrim(coalesce(p_source_provider,'')),''),p_payload,2,'confirmed',p_detected_metadata)
  returning * into c;
  perform private.record_contribution_transition(c.id, 'created', null, c.payload);
  return c;
end;
$$;

create or replace function public.save_contribution_draft(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb;
begin
  select * into c from public.contributions where id=p_contribution_id for update;
  if not found or c.author_id <> (select auth.uid()) or c.status <> 'draft' then raise exception 'Only the author may edit a draft' using errcode='42501'; end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_detected_metadata) <> 'object' then raise exception 'Valid source URL and object payloads are required' using errcode='22023'; end if;
  v_before:=c.payload;
  update public.contributions set source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=p_payload,payload_version=2,payload_quality='confirmed',detected_metadata=p_detected_metadata,updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id, 'updated', v_before, c.payload);
  return c;
end;
$$;

create or replace function public.submit_contribution(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_role text;
begin
  select * into c from public.contributions where id=p_contribution_id for update;
  if not found or c.author_id <> (select auth.uid()) or c.status not in ('draft','changes_requested') then raise exception 'Only draft or requested-change submissions may be sent by their author' using errcode='42501'; end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_detected_metadata) <> 'object' then raise exception 'Valid source URL and detected metadata are required' using errcode='22023'; end if;
  perform private.assert_contribution_payload_v2(p_payload);
  select role into v_role from public.profiles where id=c.author_id;
  if v_role not in ('comunidad','colaborador') then raise exception 'Author role is invalid' using errcode='42501'; end if;
  v_before:=c.payload;
  update public.contributions set status='pending',source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=p_payload,payload_version=2,payload_quality='confirmed',detected_metadata=p_detected_metadata,queue_kind=case when v_role='colaborador' then 'collaborator' else 'community' end,submitted_at=now(),reviewer_note=null,reviewed_by=null,reviewed_at=null,updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id, 'submitted', v_before, c.payload);
  return c;
end;
$$;

create or replace function public.prepare_contribution_for_admin(p_contribution_id uuid, p_working_payload jsonb default '{}'::jsonb, p_internal_note text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype;
begin
  if not (select private.is_collaborator()) then raise exception 'Collaborator role required' using errcode='42501'; end if;
  select * into c from public.contributions where id=p_contribution_id for update;
  if not found or c.status <> 'pending' or c.queue_kind <> 'community' or c.author_id=(select auth.uid()) then raise exception 'Only another community pending contribution can be prepared' using errcode='42501'; end if;
  if jsonb_typeof(p_working_payload) <> 'object' then raise exception 'Working payload must be an object' using errcode='22023'; end if;
  insert into private.contribution_preparations(contribution_id,collaborator_id,working_payload,internal_note) values(c.id,(select auth.uid()),p_working_payload,nullif(btrim(coalesce(p_internal_note,'')),'')) on conflict(contribution_id) do update set collaborator_id=excluded.collaborator_id,working_payload=excluded.working_payload,internal_note=excluded.internal_note,updated_at=now();
  update public.contributions set status='ready_for_admin',updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id, 'prepared_for_admin', c.payload, c.payload, 'Prepared for admin');
  return c;
end;
$$;

create or replace function public.review_contribution(p_contribution_id uuid, p_action text, p_note text default null)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; p jsonb; v_release_id uuid; v_type_id uuid; v_artist_id uuid; v_genre_id uuid; v_country_id uuid; v_label_id uuid; v_name text; v_i int := 0; v_slug text;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_action not in ('approved','rejected','changes_requested') then raise exception 'Invalid review action' using errcode='22023'; end if;
  select * into c from public.contributions where id=p_contribution_id for update;
  if not found or c.status not in ('pending','ready_for_admin') then raise exception 'Only pending or ready_for_admin contributions can be reviewed' using errcode='22023'; end if;
  if p_action in ('rejected','changes_requested') and nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A reviewer note is required' using errcode='22023'; end if;
  if p_action='approved' then
    if c.payload_version <> 2 or c.payload_quality <> 'confirmed' then raise exception 'Legacy payload requires author confirmation before publication' using errcode='22023'; end if;
    p:=c.payload; perform private.assert_contribution_payload_v2(p);
    select id into v_type_id from public.release_types where slug=p->>'release_type'; if v_type_id is null then raise exception 'Canonical release type is not configured' using errcode='23503'; end if;
    if nullif(btrim(p->>'label'),'') is not null then insert into public.labels(name,normalized_name,slug) values(btrim(p->>'label'),lower(btrim(p->>'label')),'label--'||substr(md5(lower(btrim(p->>'label'))),1,12)) on conflict(normalized_name) do update set updated_at=now() returning id into v_label_id; end if;
    v_slug:=trim(both '-' from regexp_replace(lower(btrim(p->>'title')),'[^a-z0-9]+','-','g')); if v_slug='' then v_slug:='release'; end if;
    insert into public.releases(slug,title,release_date,release_type_id,label_id,review,status,credit_quality) values(v_slug||'--'||substr(replace(c.id::text,'-',''),1,8),btrim(p->>'title'),(p->>'release_date')::date,v_type_id,v_label_id,coalesce(p->>'team_note',''),'published','proposed') returning id into v_release_id;
    v_i:=0; for v_name in select btrim(value) from jsonb_array_elements_text(p->'primary_artists') loop insert into public.artists(name,normalized_name,slug) values(v_name,private.normalize_catalog_artist_name(v_name),'artist--'||substr(md5(private.normalize_catalog_artist_name(v_name)),1,12)) on conflict(normalized_name) do update set updated_at=now() returning id into v_artist_id; insert into public.release_artists(release_id,artist_id,role,position) values(v_release_id,v_artist_id,'primary',v_i); v_i:=v_i+1; end loop;
    v_i:=0; for v_name in select btrim(value) from jsonb_array_elements_text(coalesce(p->'collaborators','[]')) loop insert into public.artists(name,normalized_name,slug) values(v_name,private.normalize_catalog_artist_name(v_name),'artist--'||substr(md5(private.normalize_catalog_artist_name(v_name)),1,12)) on conflict(normalized_name) do update set updated_at=now() returning id into v_artist_id; insert into public.release_artists(release_id,artist_id,role,position) values(v_release_id,v_artist_id,'collaborator',v_i); v_i:=v_i+1; end loop;
    for v_name in select btrim(value) from jsonb_array_elements_text(p->'genres') loop insert into public.genres(name,normalized_name,slug) values(v_name,private.normalize_catalog_dictionary_name(v_name),'genre--'||substr(md5(private.normalize_catalog_dictionary_name(v_name)),1,12)) on conflict do nothing; select id into v_genre_id from public.genres where private.normalize_catalog_dictionary_name(name)=private.normalize_catalog_dictionary_name(v_name); insert into public.release_genres(release_id,genre_id) values(v_release_id,v_genre_id) on conflict do nothing; end loop;
    for v_name in select btrim(value) from jsonb_array_elements_text(p->'countries') loop insert into public.countries(name,normalized_name,slug) values(v_name,lower(v_name),'country--'||substr(md5(lower(v_name)),1,12)) on conflict(normalized_name) do update set updated_at=now() returning id into v_country_id; insert into public.release_countries(release_id,country_id) values(v_release_id,v_country_id) on conflict do nothing; end loop;
    insert into public.release_links(release_id,provider,url) values(v_release_id,coalesce(c.source_provider,'manual'),c.source_url);
    if nullif(c.detected_metadata->>'cover_url','') ~* '^https://' then insert into public.release_covers(release_id,url,source_url) values(v_release_id,c.detected_metadata->>'cover_url',c.source_url); end if;
  end if;
  update public.contributions set status=p_action,reviewer_note=nullif(btrim(coalesce(p_note,'')),''),reviewed_by=(select auth.uid()),reviewed_at=now(),release_id=v_release_id,updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id,p_action,c.payload,c.payload,c.reviewer_note);
  return c;
end;
$$;

revoke all on function private.assert_contribution_payload_v2(jsonb), private.record_contribution_transition(uuid,text,jsonb,jsonb,text), private.is_collaborator() from public, anon, authenticated;
revoke all on function public.record_contribution_event(), public.review_contribution(uuid,text,text), public.create_contribution_draft(text,text,jsonb,jsonb), public.save_contribution_draft(uuid,text,text,jsonb,jsonb), public.submit_contribution(uuid,text,text,jsonb,jsonb), public.prepare_contribution_for_admin(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.review_contribution(uuid,text,text), public.create_contribution_draft(text,text,jsonb,jsonb), public.save_contribution_draft(uuid,text,text,jsonb,jsonb), public.submit_contribution(uuid,text,text,jsonb,jsonb), public.prepare_contribution_for_admin(uuid,jsonb,text) to authenticated;
