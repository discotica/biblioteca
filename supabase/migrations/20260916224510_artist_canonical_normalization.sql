-- Canonical editorial identity: NFC, collapsed whitespace, case-insensitive,
-- and Spanish/Latin diacritics folded. Display spelling remains untouched.
create or replace function private.normalize_catalog_artist_name(p_name text)
returns text language sql immutable strict set search_path = '' as $$
  select translate(
    lower(normalize(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), NFC)),
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiiooooouuuunc'
  );
$$;

-- Preflight in staging found no existing canonical collisions. This unique
-- expression index is the database-level guarantee, not a best-effort lookup.
create unique index artists_canonical_name_unique_idx
  on public.artists (private.normalize_catalog_artist_name(name));

create or replace function public.admin_create_catalog_artist(p_name text, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := normalize(regexp_replace(btrim(coalesce(p_name,'')), '\s+', ' ', 'g'), NFC);
  v_normalized text;
  v_artist public.artists%rowtype;
  v_created boolean := false;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_confirm is not true then raise exception 'Explicit artist creation confirmation is required' using errcode = '22023'; end if;
  if v_name = '' or char_length(v_name) > 160 then raise exception 'Artist name must contain 1..160 visible characters' using errcode = '22023'; end if;
  v_normalized := private.normalize_catalog_artist_name(v_name);

  -- ON CONFLICT serializes concurrent inserts against the canonical index. A
  -- losing caller performs a fresh SELECT and returns the same existing UUID.
  insert into public.artists(name, normalized_name, slug)
  values(v_name, v_normalized, 'artist--' || substr(md5(v_normalized),1,12))
  on conflict do nothing
  returning * into v_artist;
  if found then
    v_created := true;
    insert into private.catalog_artist_change_events(artist_id,actor_id,operation,normalized_name,after_state)
    values(v_artist.id,(select auth.uid()),'create',v_normalized,jsonb_build_object('id',v_artist.id,'name',v_artist.name,'normalized_name',v_artist.normalized_name,'slug',v_artist.slug));
  else
    select * into v_artist from public.artists
    where private.normalize_catalog_artist_name(name) = v_normalized
    order by id limit 1;
    if not found then raise exception 'Canonical artist conflict could not be resolved' using errcode = '40001'; end if;
  end if;
  return jsonb_build_object('artist_id',v_artist.id,'name',v_artist.name,'normalized_name',v_artist.normalized_name,'created',v_created,'duplicate',not v_created);
end;
$$;

revoke all on function private.normalize_catalog_artist_name(text) from public, anon, authenticated;
revoke all on function public.admin_create_catalog_artist(text,boolean) from public, anon, authenticated;
grant execute on function public.admin_create_catalog_artist(text,boolean) to authenticated;
