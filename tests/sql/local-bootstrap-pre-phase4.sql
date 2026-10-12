-- SOLO LOCAL. No es una migración del repositorio y nunca se aplica en staging
-- ni en producción.
--
-- `profiles`, `crates` y `crate_items` existían en Supabase antes de la primera
-- migración versionada (E01: "no hay una migración local que las cree desde
-- cero"). Este archivo las recrea tal como estaban en el dump del 2026-08-30
-- (`../discotica-backups/2026-08-30/schema.sql`), para que la cadena completa de
-- `supabase/migrations/` se pueda aplicar en un stack local.
--
-- Uso (D1, 2026-10-06): copiar `supabase/` a un directorio temporal, guardar este
-- archivo como `migrations/20260830000000_local_bootstrap_pre_phase4.sql` en esa
-- copia y ejecutar `npx supabase start --workdir <copia>`.

create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  bio text,
  newsletter_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_-]{3,30}$')
);

create table if not exists public.crates (
  id uuid not null default gen_random_uuid() primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  slug text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint name_length check (char_length(name) >= 1 and char_length(name) <= 120),
  constraint slug_format check (slug ~ '^[a-z0-9-]{1,80}$'),
  constraint crates_owner_id_slug_key unique (owner_id, slug)
);

create table if not exists public.crate_items (
  id uuid not null default gen_random_uuid() primary key,
  crate_id uuid not null references public.crates(id) on delete cascade,
  lanzamiento_slug text not null,
  note text,
  added_at timestamptz not null default now(),
  constraint slug_not_empty check (char_length(lanzamiento_slug) > 0),
  constraint crate_items_crate_id_lanzamiento_slug_key unique (crate_id, lanzamiento_slug)
);

create index if not exists crate_items_crate_idx on public.crate_items (crate_id);
create index if not exists crates_owner_public_idx on public.crates (owner_id, is_public);

alter table public.profiles enable row level security;
alter table public.crates enable row level security;
alter table public.crate_items enable row level security;

-- Políticas originales; Fase 4 las reemplaza por nombre.
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "crates_select" on public.crates for select
  using (is_public = true or auth.uid() = owner_id);
create policy "crates_insert_own" on public.crates for insert with check (auth.uid() = owner_id);
create policy "crates_update_own" on public.crates for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "crates_delete_own" on public.crates for delete using (auth.uid() = owner_id);
create policy "crate_items_select" on public.crate_items for select
  using (exists (select 1 from public.crates c
    where c.id = crate_items.crate_id and (c.is_public = true or c.owner_id = auth.uid())));
create policy "crate_items_insert_own" on public.crate_items for insert
  with check (exists (select 1 from public.crates c
    where c.id = crate_items.crate_id and c.owner_id = auth.uid()));
create policy "crate_items_delete_own" on public.crate_items for delete
  using (exists (select 1 from public.crates c
    where c.id = crate_items.crate_id and c.owner_id = auth.uid()));

grant all on table public.profiles, public.crates, public.crate_items to anon, authenticated, service_role;
