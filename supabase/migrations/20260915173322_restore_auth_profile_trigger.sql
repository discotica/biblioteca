-- E01: the logical restore preserved public.handle_new_user() but omitted the
-- user-creation trigger from auth.users. Recreate the source trigger only
-- after asserting that its privileged function is still hardened.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
      and p.pronargs = 0
      and p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  ) then
    raise exception 'Expected hardened public.handle_new_user() is missing';
  end if;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
