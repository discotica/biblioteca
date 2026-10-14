-- E18: private, authenticated problem reports.  The browser only receives the
-- narrow RPCs below; neither reports nor Storage objects are public APIs.
create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('catalog_error', 'technical_bug', 'general_feedback')),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  page_url text not null check (char_length(page_url) <= 2048 and page_url like '/%' and page_url not like '//%'),
  release_id uuid references public.releases(id) on delete set null,
  technical_context jsonb not null,
  screenshot_path text unique,
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create index problem_reports_author_created_idx on public.problem_reports (author_id, created_at desc);
create index problem_reports_admin_queue_idx on public.problem_reports (status, created_at desc);

create table public.problem_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.problem_reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'screenshot_attached', 'triaged', 'status_changed', 'assigned', 'internal_response')),
  before_status text,
  after_status text,
  note text,
  created_at timestamptz not null default now()
);
create index problem_report_events_report_created_idx on public.problem_report_events (report_id, created_at);

create or replace function private.record_problem_report_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.problem_report_events(report_id, actor_id, action, after_status)
  values (new.id, (select auth.uid()), 'created', new.status);
  return new;
end;
$$;
create trigger record_problem_report_created
after insert on public.problem_reports for each row execute function private.record_problem_report_created();

create or replace function private.valid_problem_report_context(p_context jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_context) = 'object'
    and p_context ?& array['route', 'timestamp', 'app_version', 'catalog_source', 'user_agent', 'viewport', 'locale', 'online']
    and not exists (
      select 1 from jsonb_object_keys(p_context) as k
      where k not in ('route', 'release_id', 'timestamp', 'app_version', 'catalog_source', 'user_agent', 'viewport', 'locale', 'online')
    )
    and jsonb_typeof(p_context->'route') = 'string'
    and jsonb_typeof(p_context->'timestamp') = 'string'
    and jsonb_typeof(p_context->'app_version') = 'string'
    and jsonb_typeof(p_context->'catalog_source') = 'string'
    and jsonb_typeof(p_context->'user_agent') = 'string'
    and jsonb_typeof(p_context->'viewport') = 'object'
    and jsonb_typeof(p_context->'locale') = 'string'
    and jsonb_typeof(p_context->'online') = 'boolean'
    and (not (p_context ? 'release_id') or jsonb_typeof(p_context->'release_id') in ('string', 'null'))
    and char_length(p_context->>'user_agent') <= 512
    and char_length(p_context->>'route') <= 2048;
$$;

alter table public.problem_reports
  add constraint problem_reports_technical_context_valid
  check (private.valid_problem_report_context(technical_context));

alter table public.problem_reports enable row level security;
alter table public.problem_report_events enable row level security;
revoke all on table public.problem_reports, public.problem_report_events from public, anon, authenticated;
grant select, insert on public.problem_reports to authenticated;
grant select on public.problem_report_events to authenticated;
revoke all on sequence public.problem_report_events_id_seq from public, anon, authenticated;

create policy "authors read their own problem reports" on public.problem_reports for select to authenticated
  using (author_id = (select auth.uid()));
create policy "admins read the problem report queue" on public.problem_reports for select to authenticated
  using ((select private.is_admin()));
create policy "authors create their own problem reports" on public.problem_reports for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'new' and assigned_to is null and screenshot_path is null and responded_at is null);
create policy "authors read their own problem report history" on public.problem_report_events for select to authenticated
  using (action in ('created', 'screenshot_attached') and exists (select 1 from public.problem_reports r where r.id = report_id and r.author_id = (select auth.uid())));
create policy "admins read problem report history" on public.problem_report_events for select to authenticated
  using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('problem-report-screenshots', 'problem-report-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "authors upload their problem report screenshot once"
on storage.objects for insert to authenticated with check (
  bucket_id = 'problem-report-screenshots'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from public.problem_reports r where r.id::text = (storage.foldername(name))[2] and r.author_id = (select auth.uid()) and r.screenshot_path is null)
);
create policy "authors read their problem report screenshot"
on storage.objects for select to authenticated using (
  bucket_id = 'problem-report-screenshots'
  and owner_id = (select auth.uid()::text)
  and exists (select 1 from public.problem_reports r where r.screenshot_path = name and r.author_id = (select auth.uid()))
);
create policy "admins read problem report screenshots"
on storage.objects for select to authenticated using (
  bucket_id = 'problem-report-screenshots'
  and exists (select 1 from public.problem_reports r where r.screenshot_path = name)
  and (select private.is_admin())
);

create or replace function public.attach_problem_report_screenshot(p_report_id uuid, p_path text)
returns public.problem_reports language plpgsql security definer set search_path = '' as $$
declare r public.problem_reports%rowtype;
begin
  select * into r from public.problem_reports where id = p_report_id for update;
  if not found or r.author_id <> (select auth.uid()) then raise exception 'Report not found' using errcode = '42501'; end if;
  if r.screenshot_path is not null then raise exception 'A screenshot is already attached' using errcode = '22023'; end if;
  if p_path !~ ('^' || (select auth.uid())::text || '/' || p_report_id::text || '/[^/]+$') then raise exception 'Invalid screenshot path' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'problem-report-screenshots' and name = p_path and owner_id = (select auth.uid()::text)) then raise exception 'Screenshot upload not found' using errcode = '22023'; end if;
  update public.problem_reports set screenshot_path = p_path, updated_at = now() where id = r.id returning * into r;
  insert into public.problem_report_events(report_id, actor_id, action) values (r.id, (select auth.uid()), 'screenshot_attached');
  return r;
end;
$$;

create or replace function public.admin_update_problem_report(p_report_id uuid, p_status text, p_assigned_to uuid default null, p_note text default null)
returns public.problem_reports language plpgsql security definer set search_path = '' as $$
declare r public.problem_reports%rowtype; v_before_status text; v_before_assigned uuid;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_status not in ('new', 'triaged', 'in_progress', 'resolved', 'closed') then raise exception 'Invalid report status' using errcode = '22023'; end if;
  if p_assigned_to is not null and not exists (select 1 from public.profiles where id = p_assigned_to and role = 'admin') then raise exception 'Reports can only be assigned to an administrator' using errcode = '22023'; end if;
  select * into r from public.problem_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  v_before_status := r.status; v_before_assigned := r.assigned_to;
  update public.problem_reports set status=p_status, assigned_to=p_assigned_to, updated_at=now(), responded_at=case when nullif(btrim(coalesce(p_note, '')), '') is null then responded_at else now() end where id=r.id returning * into r;
  insert into public.problem_report_events(report_id, actor_id, action, before_status, after_status, note) values (r.id, (select auth.uid()), case when nullif(btrim(coalesce(p_note, '')), '') is not null then 'internal_response' when v_before_status <> p_status then 'status_changed' when v_before_assigned is distinct from p_assigned_to then 'assigned' else 'triaged' end, v_before_status, p_status, nullif(btrim(coalesce(p_note, '')), ''));
  return r;
end;
$$;

-- Non-destructive cleanup inventory: an administrator reviews objects that were
-- uploaded but never attached after a one-day grace period. Deletion remains a
-- separate, privileged operational action; the browser has no delete policy.
create or replace function public.admin_list_orphan_problem_report_screenshots(p_before timestamptz default now() - interval '1 day')
returns table(name text, created_at timestamptz) language sql security definer set search_path = '' as $$
  select o.name, o.created_at from storage.objects o
  where o.bucket_id = 'problem-report-screenshots' and o.created_at < p_before
    and not exists (select 1 from public.problem_reports r where r.screenshot_path = o.name)
    and (select private.is_admin());
$$;

revoke all on function private.valid_problem_report_context(jsonb), private.record_problem_report_created() from public, anon, authenticated;
-- The CHECK constraint is evaluated with the inserting role's privileges, so an
-- author needs EXECUTE on the validator. It is a pure, invoker-rights function
-- (no table access, no secrets) in a schema that PostgREST does not expose, and
-- a stored constraint does not need USAGE on `private`. Nothing else is opened.
grant execute on function private.valid_problem_report_context(jsonb) to authenticated;
revoke all on function public.attach_problem_report_screenshot(uuid, text), public.admin_update_problem_report(uuid, text, uuid, text), public.admin_list_orphan_problem_report_screenshots(timestamptz) from public, anon, authenticated;
grant execute on function public.attach_problem_report_screenshot(uuid, text), public.admin_update_problem_report(uuid, text, uuid, text), public.admin_list_orphan_problem_report_screenshots(timestamptz) to authenticated;
