-- U15 — Permisos efectivos del Estudio por rol, SOLO LECTURA.
-- Uso: psql "$E06_STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/u15-staging-permissions.sql
-- No escribe nada: corre dentro de "begin read only" y termina con rollback.
-- Para cada rol toma una cuenta real de profiles, se hace pasar por ella con
-- request.jwt.claims y el rol authenticated, y prueba las lecturas que consume
-- el Estudio (E06/E07, E09/E10, E18 y D2). Las escrituras no se invocan: su
-- gate es el mismo private.is_admin()/is_editor() que se evalúa aquí.
begin read only;

do $$
declare
  r record;
  v_out text;
  v_n bigint;
  v_has_reports boolean := to_regclass('public.problem_reports') is not null;
  v_has_d2 boolean := to_regprocedure('public.admin_catalog_quick_view_counts(text[])') is not null;
begin
  raise notice 'problem_reports (E18) presente: %', v_has_reports;
  raise notice 'D2 (admin_catalog_quick_view_counts) presente: %', v_has_d2;
  raise notice 'admin_batch_update_catalog_releases presente: %', to_regprocedure('public.admin_batch_update_catalog_releases(text,jsonb,text)') is not null;

  for r in
    select distinct on (p.role) p.role::text as role, p.id
    from public.profiles p
    where p.role::text in ('admin', 'colaborador', 'comunidad')
    order by p.role, p.created_at
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    -- Los gates privados se evalúan como dueño (authenticated no ve private).
    v_out := format('[%s] is_admin=%s is_editor=%s', r.role,
      (select private.is_admin()), (select private.is_editor()));
    perform set_config('role', 'authenticated', true);

    -- Catálogo: lista administrativa (E06). Firma de 8 o de 9 argumentos (D2).
    begin
      if v_has_d2 then
        execute 'select (public.admin_list_catalog_releases(null,null,null,null,1,1,''release_date'',''desc'',null)->>''total'')::bigint' into v_n;
      else
        execute 'select (public.admin_list_catalog_releases(null,null,null,null,1,1,''release_date'',''desc'')->>''total'')::bigint' into v_n;
      end if;
      v_out := v_out || format(' | catálogo: lista OK (%s)', v_n);
    exception when others then
      v_out := v_out || format(' | catálogo: %s', sqlstate);
    end;

    -- Propuestas en cola (E09): RLS decide qué filas ve cada rol.
    begin
      select count(*) into v_n from public.contributions where status in ('pending', 'ready_for_admin');
      v_out := v_out || format(' | cola visible: %s', v_n);
    exception when others then
      v_out := v_out || format(' | cola: %s', sqlstate);
    end;
    begin
      select count(*) into v_n from public.contributions where status in ('pending', 'ready_for_admin') and author_id <> r.id;
      v_out := v_out || format(' (ajenas %s)', v_n);
    exception when others then null;
    end;

    -- Reportes (E18): solo admin lee la cola completa.
    if v_has_reports then
      begin
        execute 'select count(*) from public.problem_reports where author_id <> $1' into v_n using r.id;
        v_out := v_out || format(' | reportes ajenos visibles: %s', v_n);
      exception when others then
        v_out := v_out || format(' | reportes: %s', sqlstate);
      end;
    end if;

    if v_has_d2 then
      begin
        execute 'select (public.admin_catalog_quick_view_counts(null)->>''total'')::bigint' into v_n;
        v_out := v_out || format(' | conteos D2 OK (%s)', v_n);
      exception when others then
        v_out := v_out || format(' | conteos D2: %s', sqlstate);
      end;
    end if;

    perform set_config('role', 'postgres', true);
    raise notice '%', v_out;
  end loop;

  -- Sin cuenta de un rol, sus permisos se verifican por definición: los gates
  -- y las políticas de contributions deben ser los del repositorio.
  for r in
    select p.proname as name, md5(pg_get_functiondef(p.oid)) as h,
           pg_get_functiondef(p.oid) ~ 'colaborador' as mentions_collab
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('is_admin', 'is_editor', 'is_collaborator', 'current_app_role')
    order by 1
  loop
    raise notice 'gate private.%: md5=% menciona colaborador=%', r.name, r.h, r.mentions_collab;
  end loop;
  for r in
    select policyname, cmd, roles::text as roles, md5(coalesce(qual, '') || coalesce(with_check, '')) as h
    from pg_policies where schemaname = 'public' and tablename = 'contributions' order by 1
  loop
    raise notice 'policy contributions "%" (% %): md5=%', r.policyname, r.cmd, r.roles, r.h;
  end loop;
  select count(*) into v_n from public.profiles where role::text = 'colaborador';
  raise notice 'cuentas con rol colaborador: %', v_n;

  -- Grants de ejecución de las RPC que usa el Estudio.
  for r in
    select p.oid::regprocedure::text as fn,
           has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'admin_list_catalog_releases', 'admin_get_catalog_release', 'admin_get_catalog_history',
      'admin_update_catalog_release', 'admin_create_catalog_release', 'admin_revert_catalog_change',
      'admin_batch_update_catalog_releases', 'admin_catalog_quick_view_counts',
      'prepare_contribution_for_admin', 'review_contribution', 'admin_update_problem_report')
    order by 1
  loop
    raise notice 'grant %: anon=% authenticated=%', r.fn, r.anon, r.auth;
  end loop;
end $$;

rollback;
