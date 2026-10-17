-- Fase 4: identidad y crates estables. Conserva lanzamiento_slug para leer
-- crates antiguos; toda inserción nueva queda anclada a releases.id.
create schema if not exists private;

create table if not exists private.reserved_usernames (
  username text primary key check (username ~ '^[a-z0-9_-]{3,30}$'),
  reason text not null default 'reserved',
  created_at timestamptz not null default now()
);

insert into private.reserved_usernames (username, reason)
values
  ('admin', 'system'), ('api', 'system'), ('auth', 'system'),
  ('crate', 'system'), ('login', 'system'), ('mis-crates', 'system'),
  ('perfil', 'system'), ('privacidad', 'system'), ('registro', 'system'),
  ('reset', 'system'), ('supabase', 'system')
on conflict (username) do nothing;

alter table public.crates alter column owner_id set default auth.uid();
alter table public.crate_items
  add column if not exists release_id uuid references public.releases(id) on delete restrict;

create table if not exists private.legacy_crate_release_map (
  lanzamiento_slug text primary key,
  release_id uuid not null references public.releases(id) on delete restrict,
  source text not null check (source in ('canonical_slug', 'unique_legacy_alias')),
  mapped_at timestamptz not null default now()
);

-- Un slug canónico tiene prioridad. Los alias ambiguos no se asignan al azar.
insert into private.legacy_crate_release_map (lanzamiento_slug, release_id, source)
select slug, id, 'canonical_slug' from public.releases
on conflict (lanzamiento_slug) do update
  set release_id = excluded.release_id, source = excluded.source, mapped_at = now();

insert into private.legacy_crate_release_map (lanzamiento_slug, release_id, source)
select slug, (array_agg(release_id))[1], 'unique_legacy_alias'
from public.release_slug_aliases
group by slug
having count(*) = 1
on conflict (lanzamiento_slug) do nothing;

update public.crate_items as item
set release_id = mapping.release_id
from private.legacy_crate_release_map as mapping
where item.release_id is null and item.lanzamiento_slug = mapping.lanzamiento_slug;

create unique index if not exists crate_items_crate_release_id_unique
  on public.crate_items (crate_id, release_id) where release_id is not null;

create or replace function public.set_crate_item_release_slug()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.release_id is null then
    raise exception 'A stable release id is required for crate items.';
  end if;
  select releases.slug into new.lanzamiento_slug
  from public.releases
  where releases.id = new.release_id and releases.status = 'published';
  if not found then
    raise exception 'Release is unavailable.';
  end if;
  return new;
end;
$$;

drop trigger if exists set_crate_item_release_slug on public.crate_items;
create trigger set_crate_item_release_slug
before insert or update of release_id on public.crate_items
for each row execute function public.set_crate_item_release_slug();

-- raw_user_meta_data es editable al registro: validar y copiar solo campos permitidos.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
begin
  if requested_username !~ '^[a-z0-9_-]{3,30}$' then
    raise exception 'Invalid username.';
  end if;
  if exists (select 1 from private.reserved_usernames where username = requested_username) then
    raise exception 'Username unavailable.';
  end if;
  insert into public.profiles (id, username, display_name, newsletter_opt_in)
  values (
    new.id, requested_username, coalesce(left(requested_display_name, 60), requested_username),
    coalesce(new.raw_user_meta_data ->> 'newsletter_opt_in', '') = 'true'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_crate_item_release_slug() from public, anon, authenticated;
alter table private.reserved_usernames enable row level security;
alter table private.legacy_crate_release_map enable row level security;

revoke all on table public.profiles, public.crates, public.crate_items from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, bio, newsletter_opt_in) on public.profiles to authenticated;
grant select on public.crates, public.crate_items to anon, authenticated;
grant insert, update, delete on public.crates to authenticated;
grant insert, delete on public.crate_items to authenticated;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles are publicly readable" on public.profiles for select to anon, authenticated using (true);
create policy "profile owners update safe fields" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "crates_select" on public.crates;
drop policy if exists "crates_insert_own" on public.crates;
drop policy if exists "crates_update_own" on public.crates;
drop policy if exists "crates_delete_own" on public.crates;
create policy "public crates and owned crates are readable" on public.crates for select to anon, authenticated
  using (is_public or (select auth.uid()) = owner_id);
create policy "crate owners insert their crates" on public.crates for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "crate owners update their crates" on public.crates for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "crate owners delete their crates" on public.crates for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "crate_items_select" on public.crate_items;
drop policy if exists "crate_items_insert_own" on public.crate_items;
drop policy if exists "crate_items_delete_own" on public.crate_items;
create policy "public crate items and owned crate items are readable" on public.crate_items for select to anon, authenticated
  using (exists (select 1 from public.crates
    where crates.id = crate_items.crate_id
      and (crates.is_public or crates.owner_id = (select auth.uid()))));
create policy "owners add published releases to crates" on public.crate_items for insert to authenticated
  with check (release_id is not null and exists (select 1 from public.crates
    where crates.id = crate_items.crate_id and crates.owner_id = (select auth.uid())));
create policy "owners remove crate items" on public.crate_items for delete to authenticated
  using (exists (select 1 from public.crates
    where crates.id = crate_items.crate_id and crates.owner_id = (select auth.uid())));
