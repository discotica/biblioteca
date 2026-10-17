-- S6 / B8: matriz de lectura por rol de las cuatro tablas con policies SELECT
-- permisivas múltiples (contributions, contribution_events, problem_reports,
-- problem_report_events).
--
-- Imprime una línea "MATRIX rol|tabla|filas visibles" por rol y tabla. Se ejecuta
-- ANTES y DESPUÉS de la migración de S6 y las dos salidas tienen que ser
-- idénticas (la consolidación no puede cambiar quién lee qué):
--
--   P='docker exec -i supabase_db_<project_id> psql -U postgres -X -v ON_ERROR_STOP=1'
--   eval "$P" < tests/sql/s6-b8-policy-matrix.sql 2>&1 | grep MATRIX > antes.txt
--   (aplicar migración)
--   eval "$P" < tests/sql/s6-b8-policy-matrix.sql 2>&1 | grep MATRIX > despues.txt
--   diff antes.txt despues.txt
--
-- Transaccional: crea sus fixtures y termina con ROLLBACK. Solo local o staging
-- con ROLLBACK (no deja nada).
begin;

do $$
declare
  v_admin  uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_collab uuid := 'a0000000-0000-0000-0000-0000000000c1';
  v_a      uuid := 'a0000000-0000-0000-0000-0000000000b1';
  v_b      uuid := 'a0000000-0000-0000-0000-0000000000b2';
  v_roles  text[] := array['anon', 'comunidad A (autor)', 'comunidad B', 'colaborador', 'admin'];
  v_tables text[] := array['contributions', 'contribution_events', 'problem_reports', 'problem_report_events'];
  v_role text; v_table text; v_sub uuid; v_sql text; v_out text;
  v_context jsonb := jsonb_build_object('route', '/s6', 'timestamp', '2026-10-11T00:00:00Z', 'app_version', 's6',
    'catalog_source', 'supabase', 'user_agent', 's6', 'viewport', jsonb_build_object('w', 1, 'h', 1), 'locale', 'es', 'online', true);
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.name || '@s6.test',
         jsonb_build_object('username', u.name), now(), now()
  from (values (v_admin, 's6admin'), (v_collab, 's6colab'), (v_a, 's6usera'), (v_b, 's6userb')) u(id, name);
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set role = 'colaborador' where id = v_collab;

  -- Contribuciones: la etiqueta es el sufijo del id (c1…c6).
  insert into public.contributions (id, author_id, status, source_url, queue_kind) values
    ('c0000000-0000-0000-0000-000000000001', v_a,      'pending',  'https://s6.test/1', 'community'),
    ('c0000000-0000-0000-0000-000000000002', v_b,      'pending',  'https://s6.test/2', 'community'),
    ('c0000000-0000-0000-0000-000000000003', v_a,      'draft',    'https://s6.test/3', null),
    ('c0000000-0000-0000-0000-000000000004', v_b,      'pending',  'https://s6.test/4', 'collaborator'),
    ('c0000000-0000-0000-0000-000000000005', v_collab, 'pending',  'https://s6.test/5', 'community'),
    ('c0000000-0000-0000-0000-000000000006', v_b,      'rejected', 'https://s6.test/6', 'community');
  insert into public.contribution_events (contribution_id, actor_id, action)
  select id, author_id, 'created' from public.contributions where id::text like 'c0000000-%';

  -- Reportes: el trigger de creación inserta el evento 'created'; se añade uno
  -- interno ('triaged') que el autor no debe ver.
  insert into public.problem_reports (id, author_id, category, description, page_url, technical_context) values
    ('d0000000-0000-0000-0000-000000000001', v_a, 'technical_bug', 's6 a', '/s6', v_context),
    ('d0000000-0000-0000-0000-000000000002', v_b, 'technical_bug', 's6 b', '/s6', v_context);
  insert into public.problem_report_events (report_id, actor_id, action)
  select id, v_admin, 'triaged' from public.problem_reports where id::text like 'd0000000-%';

  foreach v_role in array v_roles loop
    v_sub := case v_role when 'comunidad A (autor)' then v_a when 'comunidad B' then v_b when 'colaborador' then v_collab when 'admin' then v_admin end;
    foreach v_table in array v_tables loop
      v_sql := case v_table
        when 'contributions' then 'select string_agg(right(id::text, 1), '','' order by id) from public.contributions where id::text like ''c0000000-%'''
        when 'contribution_events' then 'select string_agg(right(contribution_id::text, 1) || ''.'' || action, '','' order by contribution_id, action) from public.contribution_events where contribution_id::text like ''c0000000-%'''
        when 'problem_reports' then 'select string_agg(right(id::text, 1), '','' order by id) from public.problem_reports where id::text like ''d0000000-%'''
        else 'select string_agg(right(report_id::text, 1) || ''.'' || action, '','' order by report_id, action) from public.problem_report_events where report_id::text like ''d0000000-%'''
      end;
      begin
        if v_role = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          set local role anon;
        else
          perform set_config('request.jwt.claims', jsonb_build_object('sub', v_sub, 'role', 'authenticated')::text, true);
          set local role authenticated;
        end if;
        execute v_sql into v_out;
        reset role;
        raise notice 'MATRIX %|%|%', v_role, v_table, coalesce(v_out, '(ninguna)');
      exception when insufficient_privilege then
        reset role;
        raise notice 'MATRIX %|%|DENEGADO', v_role, v_table;
      end;
    end loop;
  end loop;

  -- Escrituras: authenticated solo tiene SELECT en las tres primeras y
  -- SELECT/INSERT en problem_reports. Ninguna de estas debe poder hacerse.
  foreach v_role in array array['comunidad A (autor)', 'admin'] loop
    v_sub := case v_role when 'admin' then v_admin else v_a end;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_sub, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      update public.contributions set reviewer_note = 'x' where id::text like 'c0000000-%';
      raise notice 'MATRIX %|update contributions|PERMITIDO', v_role;
    exception when insufficient_privilege then
      raise notice 'MATRIX %|update contributions|DENEGADO', v_role;
    end;
    begin
      insert into public.contribution_events (contribution_id, actor_id, action) values ('c0000000-0000-0000-0000-000000000001', v_sub, 'updated');
      raise notice 'MATRIX %|insert contribution_events|PERMITIDO', v_role;
    exception when insufficient_privilege then
      raise notice 'MATRIX %|insert contribution_events|DENEGADO', v_role;
    end;
    begin
      update public.problem_reports set status = 'closed' where id::text like 'd0000000-%';
      raise notice 'MATRIX %|update problem_reports|PERMITIDO', v_role;
    exception when insufficient_privilege then
      raise notice 'MATRIX %|update problem_reports|DENEGADO', v_role;
    end;
    reset role;
  end loop;
end;
$$;

-- Policies permisivas por tabla/comando (para el informe, no para el diff).
select 'POLICIES ' || tablename || '|' || cmd || '|' || count(*) || '|' || string_agg(policyname, ' + ' order by policyname)
from pg_policies
where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd = 'SELECT'
  and tablename in ('contributions', 'contribution_events', 'problem_reports', 'problem_report_events')
group by tablename, cmd order by tablename;

rollback;
