-- Run locally after `npx supabase start`, or against staging only after the E18
-- migration is applied: npx supabase db query --linked --file tests/sql/e18-verify.sql
-- The transaction leaves no fixture reports or events behind.
begin;
do $$
declare admin_id uuid; author_id uuid; other_id uuid; report_id uuid; report_context jsonb := jsonb_build_object('route','/lanzamiento/demo','timestamp','2026-09-23T00:00:00Z','app_version','test','catalog_source','canonical','user_agent','E18 test','viewport',jsonb_build_object('width',1280,'height',800),'locale','es-CO','online',true);
begin
  select id into admin_id from public.profiles where role='admin' limit 1;
  select id into author_id from public.profiles where role='comunidad' limit 1;
  select id into other_id from public.profiles where role='comunidad' and id <> author_id limit 1;
  if admin_id is null or author_id is null or other_id is null then raise exception 'E18 requires admin and two community fixtures'; end if;

  -- anon has no relation grants; a signed-in author can create/read only own rows.
  set local role anon;
  begin perform * from public.problem_reports; raise exception 'anon read unexpectedly allowed'; exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',author_id,'role','authenticated')::text, true); set local role authenticated;
  insert into public.problem_reports(author_id,category,description,page_url,technical_context) values(author_id,'technical_bug','Fixture report','/lanzamiento/demo',report_context) returning id into report_id;
  if not exists(select 1 from public.problem_reports where id=report_id) then raise exception 'author cannot read own report'; end if;
  begin insert into public.problem_reports(author_id,category,description,page_url,technical_context) values(other_id,'technical_bug','cross author','/','{}'); raise exception 'cross-author insert unexpectedly allowed'; exception when insufficient_privilege or check_violation then null; end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',other_id,'role','authenticated')::text, true); set local role authenticated;
  if exists(select 1 from public.problem_reports where id=report_id) then raise exception 'cross-user report read unexpectedly allowed'; end if;
  begin perform public.admin_update_problem_report(report_id,'triaged',null,'no'); raise exception 'non-admin report update unexpectedly allowed'; exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated')::text, true); set local role authenticated;
  perform public.admin_update_problem_report(report_id,'triaged',admin_id,'fixture triage');
  if not exists(select 1 from public.problem_report_events where report_id=report_id and after_status='triaged') then raise exception 'admin history missing'; end if;
  reset role;
end $$;
rollback;
