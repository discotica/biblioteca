-- Same private-predicate RLS requirement as the collaborator queue policy.
grant execute on function private.is_admin() to authenticated;
