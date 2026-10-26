-- E06 compatibility boundary: E09 still owns the contribution-v2 redesign,
-- but its existing approval RPC must not create a visible release without E06
-- audit evidence in the meantime.
create or replace function private.audit_legacy_contribution_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_after jsonb; v_change uuid;
begin
  if new.status = 'approved' and new.release_id is not null
     and (old.status is distinct from new.status or old.release_id is distinct from new.release_id) then
    v_after := private.catalog_snapshot(new.release_id);
    v_change := private.record_catalog_change(
      'create', new.release_id, null, (v_after->>'catalog_version')::integer,
      null, v_after, 'Approved contribution ' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_legacy_contribution_publication on public.contributions;
create trigger audit_legacy_contribution_publication
after update of status, release_id on public.contributions
for each row execute function private.audit_legacy_contribution_publication();

revoke all on function private.audit_legacy_contribution_publication() from public, anon, authenticated;
