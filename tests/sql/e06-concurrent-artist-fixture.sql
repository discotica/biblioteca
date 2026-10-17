-- Launch two copies concurrently. Each holds its transaction open after the
-- RPC; both roll back, so staging retains no test artist or audit event.
begin;
do $$
declare v_admin uuid;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform public.admin_create_catalog_artist('E06 Concurrent Café Fixture', true);
  perform pg_sleep(2);
end;
$$;
rollback;
