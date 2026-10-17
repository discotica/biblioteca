create or replace function public.submit_contribution(p_contribution_id uuid, p_source_url text, p_source_provider text, p_payload jsonb, p_detected_metadata jsonb default '{}'::jsonb)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare c public.contributions%rowtype; v_before jsonb; v_role text;
begin
  select * into c from public.contributions where id = p_contribution_id for update;
  if not found then raise exception 'Contribution not found' using errcode='P0002'; end if;
  if c.author_id is distinct from (select auth.uid()) then raise exception 'Only the author may submit a contribution' using errcode='42501'; end if;
  if c.status not in ('draft','changes_requested') then raise exception 'Only draft or requested-change submissions may be sent' using errcode='22023'; end if;
  if coalesce(p_source_url,'') !~* '^https://' or jsonb_typeof(p_detected_metadata) <> 'object' then raise exception 'Valid source URL and detected metadata are required' using errcode='22023'; end if;
  perform private.assert_contribution_payload_v2(p_payload);
  select role into v_role from public.profiles where id=c.author_id;
  if v_role not in ('comunidad','colaborador') then raise exception 'Author role is invalid' using errcode='42501'; end if;
  v_before:=c.payload;
  update public.contributions set status='pending',source_url=btrim(p_source_url),source_provider=nullif(btrim(coalesce(p_source_provider,'')),''),payload=p_payload,payload_version=2,payload_quality='confirmed',detected_metadata=p_detected_metadata,queue_kind=case when v_role='colaborador' then 'collaborator' else 'community' end,submitted_at=now(),reviewer_note=null,reviewed_by=null,reviewed_at=null,updated_at=now() where id=c.id returning * into c;
  perform private.record_contribution_transition(c.id, 'submitted', v_before, c.payload);
  return c;
end;
$$;
