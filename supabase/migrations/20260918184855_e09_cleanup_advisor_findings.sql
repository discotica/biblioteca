drop index if exists public.contributions_author_state_idx;

create or replace function private.assert_contribution_payload_v2(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_payload) <> 'object' or coalesce(p_payload->>'version', '') <> '2'
     or nullif(btrim(p_payload->>'title'), '') is null
     or jsonb_typeof(p_payload->'primary_artists') <> 'array' or jsonb_array_length(p_payload->'primary_artists') = 0
     or jsonb_typeof(coalesce(p_payload->'collaborators', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(p_payload->'genres') <> 'array' or jsonb_array_length(p_payload->'genres') = 0
     or jsonb_typeof(p_payload->'countries') <> 'array' or jsonb_array_length(p_payload->'countries') = 0
     or p_payload ? 'cover_url' then raise exception 'Invalid contribution v2 payload' using errcode = '22023'; end if;
  if p_payload->>'release_type' not in ('album', 'ep', 'single', 'compilado', 'sample-pack') then raise exception 'A manually confirmed canonical release_type is required' using errcode = '22023'; end if;
  begin perform (p_payload->>'release_date')::date; exception when others then raise exception 'release_date must use ISO YYYY-MM-DD' using errcode = '22023'; end;
  if exists (select 1 from jsonb_array_elements_text(p_payload->'primary_artists') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_payload->'collaborators', '[]')) x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'genres') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'countries') x where nullif(btrim(x), '') is null)
     or exists (select 1 from jsonb_array_elements_text(p_payload->'primary_artists') a join jsonb_array_elements_text(coalesce(p_payload->'collaborators','[]')) b on lower(btrim(a)) = lower(btrim(b))) then raise exception 'Credits, genres, and countries must be nonempty; credits cannot be in both groups' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_payload->'detected_metadata', '{}'::jsonb)) <> 'object' then raise exception 'Detected metadata must be an object' using errcode = '22023'; end if;
end;
$$;
