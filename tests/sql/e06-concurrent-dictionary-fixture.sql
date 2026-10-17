-- Launch two copies of this file at the same time. Each connection invokes
-- both dictionary RPCs. A direct-session harness must retain/compare the UUID
-- results before rollback; the Management API cannot demonstrate that race.
begin;
do $$
declare v_admin uuid; v_result jsonb;
begin
  select id into v_admin from public.profiles where role = 'admin' order by id limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_result := public.admin_create_catalog_label('E06 Concurrent Sëllo Fixture', true, 'concurrency fixture');
  if (v_result->>'label_id') is null then raise exception 'missing canonical label UUID'; end if;
  v_result := public.admin_create_catalog_genre('E06 Concurrent Género Fixture', true, 'concurrency fixture');
  if (v_result->>'genre_id') is null then raise exception 'missing canonical genre UUID'; end if;
  perform pg_sleep(2);
end;
$$;
rollback;
