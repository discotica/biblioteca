-- S6: ensayo del rollback. El bloque entre los marcadores es el cuerpo exacto
-- de la migración posterior que revierte S6 (no se borra ni edita la de S6):
--   npx supabase migration new s6_rollback_e06_concurrency_and_policies
-- y pegar ahí ese bloque. Este archivo lo ejecuta dentro de una transacción,
-- comprueba el esquema resultante y revierte: no cambia nada.
--
-- Qué devuelve: las cuatro RPC de E06 a sus cuerpos de 20260916220554 (con H1 y
-- H5 otra vez presentes) y las policies SELECT a las de E09 y E18. No toca datos
-- ni auditoría. Cuidado: volver atrás reintroduce la pérdida de actualizaciones
-- concurrentes; solo como último recurso y con el Estudio sin editores.
begin;

-- >>> S6 ROLLBACK
-- RPC de E06, cuerpos copiados sin cambios de 20260916220554. Los grants se
-- conservan porque `create or replace` no los toca.
create or replace function public.admin_create_catalog_release(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_after jsonb; v_change uuid; v_version integer;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  insert into public.releases(slug,title,status,credit_quality) values(p_payload->>'slug',btrim(p_payload->>'title'),coalesce(p_payload->>'status','draft'),coalesce(p_payload->>'credit_quality','legacy')) returning id into v_id;
  v_version:=private.apply_catalog_payload(v_id,p_payload,false); v_after:=private.catalog_snapshot(v_id); v_change:=private.record_catalog_change('create',v_id,null,v_version,null,v_after,p_reason);
  return jsonb_build_object('release_id',v_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_update_catalog_release(p_release_id uuid,p_expected_version integer,p_payload jsonb,p_reason text,p_operation text default 'update')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_version integer; v_change uuid;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_operation not in ('update','publish','archive') or nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Invalid operation or missing reason' using errcode='22023'; end if;
  select private.catalog_snapshot(p_release_id) into v_before from public.releases where id=p_release_id for update;
  if v_before is null then raise exception 'Release not found' using errcode='P0002'; end if;
  if (v_before->>'catalog_version')::integer <> p_expected_version then raise exception 'Catalog version conflict' using errcode='40001'; end if;
  if p_operation='publish' then p_payload:=jsonb_set(p_payload,'{status}','"published"'); elsif p_operation='archive' then p_payload:=jsonb_set(p_payload,'{status}','"archived"'); end if;
  if p_payload->>'slug' <> v_before->>'slug' then raise exception 'Use admin_change_release_slug for slug changes' using errcode='22023'; end if;
  v_version:=private.apply_catalog_payload(p_release_id,p_payload); v_after:=private.catalog_snapshot(p_release_id); v_change:=private.record_catalog_change(p_operation,p_release_id,p_expected_version,v_version,v_before,v_after,p_reason);
  return jsonb_build_object('release_id',p_release_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_change_release_slug(p_release_id uuid,p_expected_version integer,p_new_slug text,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_version integer; v_change uuid; v_old text;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null or btrim(p_new_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' then raise exception 'Valid slug and reason are required' using errcode='22023'; end if;
  select private.catalog_snapshot(p_release_id) into v_before from public.releases where id=p_release_id for update; if v_before is null then raise exception 'Release not found' using errcode='P0002'; end if;
  if (v_before->>'catalog_version')::integer <> p_expected_version then raise exception 'Catalog version conflict' using errcode='40001'; end if; v_old:=v_before->>'slug';
  if exists(select 1 from public.releases where slug=btrim(p_new_slug) and id<>p_release_id) or exists(select 1 from public.release_slug_aliases where slug=btrim(p_new_slug) and release_id<>p_release_id) then raise exception 'Slug collides with a canonical slug or visible alias' using errcode='23505'; end if;
  update public.releases set slug=btrim(p_new_slug),catalog_version=catalog_version+1,updated_at=now() where id=p_release_id returning catalog_version into v_version;
  insert into public.release_slug_aliases(slug,release_id,source_name,is_legacy,alias_kind) values(v_old,p_release_id,'editorial',false,'editorial_redirect') on conflict(slug,release_id) do update set source_name='editorial',is_legacy=false,alias_kind='editorial_redirect';
  v_after:=private.catalog_snapshot(p_release_id); v_change:=private.record_catalog_change('slug_redirect',p_release_id,p_expected_version,v_version,v_before,v_after,p_reason); return jsonb_build_object('release_id',p_release_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

create or replace function public.admin_revert_catalog_change(p_change_set_id uuid,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.catalog_change_sets%rowtype; e private.catalog_change_events%rowtype; v_current jsonb; v_after jsonb; v_version integer; v_change uuid; v_payload jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into c from private.catalog_change_sets where id=p_change_set_id for update; if not found or c.status<>'applied' then raise exception 'Only an applied change set can be reverted' using errcode='22023'; end if;
  select * into e from private.catalog_change_events where change_set_id=c.id order by id limit 1; select private.catalog_snapshot(c.entity_id) into v_current from public.releases where id=c.entity_id for update;
  if v_current is null or (v_current->>'catalog_version')::integer<>p_expected_version or p_expected_version<>c.result_version then raise exception 'Catalog version conflict; later edits cannot be overwritten' using errcode='40001'; end if;
  if c.operation='create' then update public.releases set status='archived',catalog_version=catalog_version+1,updated_at=now() where id=c.entity_id returning catalog_version into v_version;
  else v_payload:=e.before_state - 'id' - 'catalog_version'; v_payload:=jsonb_set(v_payload,'{slug}',to_jsonb(v_current->>'slug')); v_version:=private.apply_catalog_payload(c.entity_id,v_payload); end if;
  v_after:=private.catalog_snapshot(c.entity_id); v_change:=private.record_catalog_change('revert',c.entity_id,p_expected_version,v_version,v_current,v_after,p_reason,c.id); return jsonb_build_object('release_id',c.entity_id,'catalog_version',v_version,'change_set_id',v_change,'reverted_change_set_id',c.id);
end;
$$;

-- B8: de la policy única a las policies de E09 (contributions, contribution_events)
-- y de E18 (problem_reports, problem_report_events), copiadas sin cambios.
drop policy "contributions readable by author, admin or collaborator queue" on public.contributions;
drop policy "contribution history readable by author, admin or collaborator" on public.contribution_events;
drop policy "problem reports readable by author or admin" on public.problem_reports;
drop policy "problem report history readable by author or admin" on public.problem_report_events;

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

create policy "authors read their own problem reports" on public.problem_reports for select to authenticated
  using (author_id = (select auth.uid()));
create policy "admins read the problem report queue" on public.problem_reports for select to authenticated
  using ((select private.is_admin()));
create policy "authors read their own problem report history" on public.problem_report_events for select to authenticated
  using (action in ('created', 'screenshot_attached') and exists (select 1 from public.problem_reports r where r.id = report_id and r.author_id = (select auth.uid())));
create policy "admins read problem report history" on public.problem_report_events for select to authenticated
  using ((select private.is_admin()));
-- <<< S6 ROLLBACK

do $$
declare
  v_def text;
  v_fn text;
begin
  -- Cuerpos de E06 restaurados: lectura del snapshot dentro del `for update`.
  foreach v_fn in array array['admin_update_catalog_release', 'admin_change_release_slug'] loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_fn;
    if position('select private.catalog_snapshot(p_release_id) into v_before from public.releases where id=p_release_id for update' in v_def) = 0 then
      raise exception 'S6 rollback FAIL: % no recuperó el cuerpo de E06', v_fn;
    end if;
  end loop;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_create_catalog_release';
  if position('coalesce(p_payload->>''status'',''draft'')' in v_def) = 0 then
    raise exception 'S6 rollback FAIL: admin_create_catalog_release no recuperó el cuerpo de E06';
  end if;
  -- Grants intactos: solo authenticated ejecuta las RPC administrativas.
  if has_function_privilege('anon', 'public.admin_update_catalog_release(uuid,integer,jsonb,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_update_catalog_release(uuid,integer,jsonb,text,text)', 'execute') then
    raise exception 'S6 rollback FAIL: grants de la RPC cambiaron';
  end if;
  -- Policies como antes de S6.
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contributions' and cmd = 'SELECT') <> 3
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contribution_events' and cmd = 'SELECT') <> 3
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'problem_reports' and cmd = 'SELECT') <> 2
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'problem_report_events' and cmd = 'SELECT') <> 2 then
    raise exception 'S6 rollback FAIL: policies SELECT no volvieron a 3/3/2/2';
  end if;
  raise notice 'S6 rollback verify: OK';
end;
$$;

rollback;
