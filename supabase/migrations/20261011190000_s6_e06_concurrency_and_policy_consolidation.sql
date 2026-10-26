-- S6: concurrencia de E06 (H1), creación publicada (H5) y policies permisivas (B8).
--
-- E06 ya está aplicada en staging; esta migración la corrige sin editarla.
--
-- H1. `private.catalog_snapshot` es STABLE. Dentro de
--   `select private.catalog_snapshot(id) into v_before from releases where id = … for update`
-- la función lee con la instantánea tomada ANTES de esperar el bloqueo, así que
-- una segunda edición que esperaba la fila valida contra la versión vieja, se
-- aplica sin 40001 y guarda un before_state falso. La corrección separa las dos
-- cosas: una sentencia que solo bloquea la fila (al terminar de esperar, la
-- siguiente sentencia de la función volátil toma una instantánea nueva) y otra
-- que lee el snapshot ya con el bloqueo en la mano. Lo mismo en
-- admin_change_release_slug y admin_revert_catalog_change. El cuerpo de las tres
-- es el de E06 salvo ese cambio.
--
-- H5. admin_create_catalog_release insertaba la fila con el estado del payload
-- y sin tipo; con 'published' violaba releases_published_type_required_check
-- antes de que apply_catalog_payload completara la fila. Ahora inserta siempre
-- en borrador y apply_catalog_payload fija el estado real, con su validación
-- (un publicado sin release_type_id sigue fallando con 23514). El contrato de
-- entrada y salida no cambia, y E07 (que crea en borrador y publica) tampoco.
--
-- B8. Cada una de las cuatro tablas tiene varias policies SELECT permisivas para
-- el mismo rol. Se reemplazan por una sola por tabla con el OR de las mismas
-- condiciones, sin cambiar quién lee qué (tests/sql/s6-b8-policy-matrix.sql).
--
-- Rollback: tests/sql/s6-rollback-verify.sql.

-- H1 + H5 ------------------------------------------------------------------------

create or replace function public.admin_create_catalog_release(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_after jsonb; v_change uuid; v_version integer;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required' using errcode='22023'; end if;
  -- Siempre en borrador: la fila nace sin tipo y el estado real lo fija
  -- apply_catalog_payload cuando ya validó el payload completo.
  insert into public.releases(slug,title,status,credit_quality) values(p_payload->>'slug',btrim(p_payload->>'title'),'draft',coalesce(p_payload->>'credit_quality','legacy')) returning id into v_id;
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
  -- H1: bloquear en una sentencia propia; el snapshot se lee en la siguiente,
  -- con la instantánea posterior a la espera.
  perform 1 from public.releases where id=p_release_id for update;
  if not found then raise exception 'Release not found' using errcode='P0002'; end if;
  v_before:=private.catalog_snapshot(p_release_id);
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
  -- H1: bloqueo y lectura en sentencias separadas.
  perform 1 from public.releases where id=p_release_id for update;
  if not found then raise exception 'Release not found' using errcode='P0002'; end if;
  v_before:=private.catalog_snapshot(p_release_id);
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
  select * into e from private.catalog_change_events where change_set_id=c.id order by id limit 1;
  -- H1: bloqueo del lanzamiento y lectura del snapshot en sentencias separadas.
  -- Orden de bloqueos: change set y luego lanzamiento; ninguna otra RPC bloquea
  -- un change set existente después del lanzamiento, así que no hay ciclo.
  perform 1 from public.releases where id=c.entity_id for update;
  v_current:=case when found then private.catalog_snapshot(c.entity_id) end;
  if v_current is null or (v_current->>'catalog_version')::integer<>p_expected_version or p_expected_version<>c.result_version then raise exception 'Catalog version conflict; later edits cannot be overwritten' using errcode='40001'; end if;
  if c.operation='create' then update public.releases set status='archived',catalog_version=catalog_version+1,updated_at=now() where id=c.entity_id returning catalog_version into v_version;
  else v_payload:=e.before_state - 'id' - 'catalog_version'; v_payload:=jsonb_set(v_payload,'{slug}',to_jsonb(v_current->>'slug')); v_version:=private.apply_catalog_payload(c.entity_id,v_payload); end if;
  v_after:=private.catalog_snapshot(c.entity_id); v_change:=private.record_catalog_change('revert',c.entity_id,p_expected_version,v_version,v_current,v_after,p_reason,c.id); return jsonb_build_object('release_id',c.entity_id,'catalog_version',v_version,'change_set_id',v_change,'reverted_change_set_id',c.id);
end;
$$;

-- B8 ------------------------------------------------------------------------------
-- Una policy SELECT por tabla (rol authenticated) con el OR de las condiciones
-- anteriores. Se crea la nueva antes de retirar las viejas; todo en la misma
-- transacción de la migración.

create policy "contributions readable by author, admin or collaborator queue" on public.contributions for select to authenticated
  using (
    author_id = (select auth.uid())
    or (select private.is_admin())
    or ((select private.is_collaborator()) and queue_kind = 'community' and status = 'pending' and author_id <> (select auth.uid()))
  );
drop policy "contribution authors read own rows" on public.contributions;
drop policy "admins read all contribution queues" on public.contributions;
drop policy "collaborators read community preparation queue" on public.contributions;

create policy "contribution history readable by author, admin or collaborator" on public.contribution_events for select to authenticated
  using (
    exists (select 1 from public.contributions c where c.id = contribution_id and c.author_id = (select auth.uid()))
    or (select private.is_admin())
    or ((select private.is_collaborator()) and exists (select 1 from public.contributions c where c.id = contribution_id and c.queue_kind = 'community' and c.author_id <> (select auth.uid())))
  );
drop policy "contribution authors read own history" on public.contribution_events;
drop policy "admins read all contribution history" on public.contribution_events;
drop policy "collaborators read community preparation history" on public.contribution_events;

create policy "problem reports readable by author or admin" on public.problem_reports for select to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));
drop policy "authors read their own problem reports" on public.problem_reports;
drop policy "admins read the problem report queue" on public.problem_reports;

create policy "problem report history readable by author or admin" on public.problem_report_events for select to authenticated
  using (
    (action in ('created', 'screenshot_attached') and exists (select 1 from public.problem_reports r where r.id = report_id and r.author_id = (select auth.uid())))
    or (select private.is_admin())
  );
drop policy "authors read their own problem report history" on public.problem_report_events;
drop policy "admins read problem report history" on public.problem_report_events;
