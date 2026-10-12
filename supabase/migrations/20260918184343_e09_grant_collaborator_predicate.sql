-- The predicate is private (the schema has no client USAGE), but policies
-- execute it as the requesting role.  This grant is required for allowed RLS
-- reads and does not expose it as a Data API RPC.
grant execute on function private.is_collaborator() to authenticated;
