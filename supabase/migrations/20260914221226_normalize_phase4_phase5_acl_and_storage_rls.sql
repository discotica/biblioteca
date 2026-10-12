-- E01: restore the application ACLs declared by the canonical catalog and
-- phases 4-5, then close the privilege and Storage RLS drift found in staging.

-- Supabase's legacy public-schema defaults grant new objects to API roles.
-- Keep service_role defaults intact, but make application exposure explicit.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- PostgreSQL's built-in PUBLIC function grant is global; a schema-scoped
-- revoke cannot override it.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Application migrations and all application objects inventoried by E01 are
-- owned by postgres. supabase_admin owns managed platform defaults and is not
-- altered here: PostgreSQL can only revoke its built-in PUBLIC function grant
-- globally, which would also affect future functions outside public.

-- Start from no client access for every application relation and re-grant the
-- exact surface declared by the versioned migrations.
revoke all privileges on table
  public.artists,
  public.labels,
  public.genres,
  public.countries,
  public.release_types,
  public.releases,
  public.release_artists,
  public.release_genres,
  public.release_countries,
  public.release_radar,
  public.release_links,
  public.release_covers,
  public.catalog_import_keys,
  public.release_slug_aliases,
  public.catalog_import_rejections,
  public.catalog_releases,
  public.profiles,
  public.crates,
  public.crate_items,
  public.contributions,
  public.contribution_events,
  private.reserved_usernames,
  private.legacy_crate_release_map
from public, anon, authenticated;

grant select on table
  public.artists,
  public.labels,
  public.genres,
  public.countries,
  public.release_types,
  public.releases,
  public.release_artists,
  public.release_genres,
  public.release_countries,
  public.release_radar,
  public.release_links,
  public.release_covers,
  public.release_slug_aliases,
  public.catalog_releases
to anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant update (display_name, bio, newsletter_opt_in)
  on table public.profiles to authenticated;

grant select on table public.crates, public.crate_items to anon, authenticated;
grant insert, update, delete on table public.crates to authenticated;
grant insert, delete on table public.crate_items to authenticated;

grant select, insert on table public.contributions to authenticated;
grant update (payload, source_url, source_provider, status, updated_at)
  on table public.contributions to authenticated;
grant select on table public.contribution_events to authenticated;

revoke all privileges on sequence public.contribution_events_id_seq
  from public, anon, authenticated;

-- All current review actions are administrative in the phase-5 contract.
-- This does not add ready_for_admin or otherwise introduce the v2 workflow.
create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_action text,
  p_note text default null
)
returns public.contributions
language plpgsql security definer set search_path = '' as $$
declare
  c public.contributions%rowtype;
  p jsonb;
  p_release_id uuid;
  p_artist_id uuid;
  p_label_id uuid;
  p_type_id uuid;
  p_artist text;
  p_slug_base text;
  p_url text;
  p_cover text;
  p_date date;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  if p_action not in ('changes_requested', 'rejected', 'approved') then
    raise exception 'Invalid review action';
  end if;

  select * into c from public.contributions where id = p_contribution_id for update;
  if not found or c.status <> 'pending' then
    raise exception 'Only pending contributions can be reviewed';
  end if;
  if p_action in ('changes_requested', 'rejected') and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reviewer note is required';
  end if;

  if p_action = 'approved' then
    p := c.payload;
    if nullif(btrim(p ->> 'title'), '') is null
      or jsonb_typeof(p -> 'artists') <> 'array'
      or jsonb_array_length(p -> 'artists') = 0 then
      raise exception 'title and at least one artist are required to publish';
    end if;
    if nullif(p ->> 'release_date', '') is not null then
      p_date := (p ->> 'release_date')::date;
    end if;
    p_slug_base := regexp_replace(lower(coalesce(p ->> 'title', 'release')), '[^a-z0-9]+', '-', 'g');
    p_slug_base := trim(both '-' from p_slug_base);
    if p_slug_base = '' then p_slug_base := 'release'; end if;

    if nullif(btrim(p ->> 'label'), '') is not null then
      insert into public.labels (name, normalized_name, slug)
      values (btrim(p ->> 'label'), lower(btrim(p ->> 'label')), 'label--' || substr(md5(lower(btrim(p ->> 'label'))), 1, 8))
      on conflict (normalized_name) do update set updated_at = now()
      returning id into p_label_id;
    end if;
    if nullif(btrim(p ->> 'type'), '') is not null then
      insert into public.release_types (name, normalized_name, slug)
      values (btrim(p ->> 'type'), lower(btrim(p ->> 'type')), 'type--' || substr(md5(lower(btrim(p ->> 'type'))), 1, 8))
      on conflict (normalized_name) do update set updated_at = now()
      returning id into p_type_id;
    end if;
    insert into public.releases (slug, title, release_date, release_type_id, label_id, review, status)
    values (p_slug_base || '--' || substr(replace(c.id::text, '-', ''), 1, 8), btrim(p ->> 'title'), p_date,
      p_type_id, p_label_id, coalesce(p ->> 'review', ''), 'published')
    returning id into p_release_id;
    for p_artist in select btrim(value) from jsonb_array_elements_text(p -> 'artists') as artists(value) loop
      if p_artist <> '' then
        insert into public.artists (name, normalized_name, slug)
        values (p_artist, lower(p_artist), 'artist--' || substr(md5(lower(p_artist)), 1, 8))
        on conflict (normalized_name) do update set updated_at = now()
        returning id into p_artist_id;
        insert into public.release_artists (release_id, artist_id, position)
        values (p_release_id, p_artist_id, coalesce((select max(position) + 1 from public.release_artists where release_id = p_release_id), 0));
      end if;
    end loop;
    p_url := coalesce(nullif(btrim(p ->> 'source_url'), ''), c.source_url);
    insert into public.release_links (release_id, provider, url)
    values (p_release_id, coalesce(nullif(c.source_provider, ''), 'manual'), p_url);
    p_cover := nullif(btrim(p ->> 'cover_url'), '');
    if p_cover ~* '^https://' then
      insert into public.release_covers (release_id, url, source_url)
      values (p_release_id, p_cover, p_url);
    end if;
  end if;

  update public.contributions
  set status = p_action,
      reviewer_note = nullif(btrim(coalesce(p_note, '')), ''),
      reviewed_by = (select auth.uid()), reviewed_at = now(),
      release_id = p_release_id, updated_at = now()
  where id = c.id
  returning * into c;
  insert into public.contribution_events (contribution_id, actor_id, action, before_payload, after_payload, note)
  values (c.id, (select auth.uid()), p_action, c.payload, c.payload, c.reviewer_note);
  return c;
end;
$$;

-- Trigger helpers are not RPCs. The only client-callable application
-- functions remain the editor predicate used by RLS and the review RPC.
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.set_crate_item_release_slug()
  from public, anon, authenticated;
revoke all on function public.record_contribution_event()
  from public, anon, authenticated;
revoke all on function public.review_contribution(uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.import_catalog_release(jsonb)
  from public, anon, authenticated;
revoke all on function private.record_catalog_import_rejection(text, text, text, integer, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function private.is_admin()
  from public, anon, authenticated;
revoke all on function private.is_editor()
  from public, anon, authenticated;

grant execute on function private.is_editor() to authenticated;
grant execute on function public.review_contribution(uuid, text, text)
  to authenticated;

drop policy if exists "authors upload their contribution covers" on storage.objects;
drop policy if exists "authors and editors read contribution covers" on storage.objects;
drop policy if exists "authors delete their pending contribution covers" on storage.objects;
drop policy if exists "authors delete editable contribution covers" on storage.objects;

create policy "authors upload their contribution covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'contribution-covers'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.contributions c
    where c.id::text = (storage.foldername(name))[2]
      and c.author_id = (select auth.uid())
      and c.status in ('draft', 'changes_requested')
  )
);

create policy "authors and editors read contribution covers"
on storage.objects for select to authenticated
using (
  bucket_id = 'contribution-covers'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.contributions c
    where c.id::text = (storage.foldername(name))[2]
      and c.author_id::text = (storage.foldername(name))[1]
      and (
        (
          c.author_id = (select auth.uid())
          and owner_id = (select auth.uid()::text)
        )
        or (select private.is_editor())
      )
  )
);

create policy "authors delete editable contribution covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'contribution-covers'
  and array_length(storage.foldername(name), 1) = 2
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.contributions c
    where c.id::text = (storage.foldername(name))[2]
      and c.author_id = (select auth.uid())
      and c.status in ('draft', 'changes_requested')
  )
);
