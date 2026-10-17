-- Fase 2: catálogo canónico. No modifica profiles, crates ni crate_items.
-- Las escrituras se realizan mediante conexión de administración en local/staging;
-- el cliente público solo puede leer lanzamientos publicados.

create schema if not exists private;

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.release_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  title text not null check (btrim(title) <> ''),
  release_date date,
  release_type_id uuid references public.release_types(id) on delete restrict,
  label_id uuid references public.labels(id) on delete restrict,
  review text not null default '',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.release_artists (
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  position smallint not null check (position >= 0),
  role text not null default 'primary' check (role in ('primary', 'featured', 'remixer', 'other')),
  primary key (release_id, artist_id, role),
  unique (release_id, position, role)
);

create table public.release_genres (
  release_id uuid not null references public.releases(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete restrict,
  primary key (release_id, genre_id)
);

create table public.release_countries (
  release_id uuid not null references public.releases(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete restrict,
  primary key (release_id, country_id)
);

create table public.release_radar (
  release_id uuid primary key references public.releases(id) on delete cascade,
  experimental smallint not null check (experimental between 0 and 5),
  denso smallint not null check (denso between 0 and 5),
  sintetico smallint not null check (sintetico between 0 and 5),
  bailable smallint not null check (bailable between 0 and 5),
  rapido smallint not null check (rapido between 0 and 5)
);

create table public.release_links (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  provider text not null check (btrim(provider) <> ''),
  url text not null check (url ~* '^https?://'),
  is_primary boolean not null default true,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (release_id, url)
);

create unique index release_links_one_primary_per_release
  on public.release_links (release_id) where is_primary;

create table public.release_covers (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  kind text not null default 'external' check (kind in ('external', 'storage')),
  url text check (url is null or url ~* '^https?://'),
  storage_path text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  content_hash text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'external' and url is not null and storage_path is null)
    or (kind = 'storage' and storage_path is not null)
  ),
  unique (release_id, url)
);

create table public.catalog_import_keys (
  source_name text not null check (btrim(source_name) <> ''),
  source_key text not null check (btrim(source_key) <> ''),
  release_id uuid not null unique references public.releases(id) on delete restrict,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  source_payload jsonb not null,
  first_imported_at timestamptz not null default now(),
  last_imported_at timestamptz not null default now(),
  primary key (source_name, source_key)
);

-- Un slug histórico puede ser ambiguo porque el sitio legado ya tiene colisiones.
-- La ruta canónica siempre usa releases.slug; la Fase 3 resolverá o señalizará alias ambiguos.
create table public.release_slug_aliases (
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'),
  release_id uuid not null references public.releases(id) on delete cascade,
  source_name text not null check (btrim(source_name) <> ''),
  is_legacy boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (slug, release_id)
);

create index releases_published_date_idx on public.releases (release_date desc, id) where status = 'published';
create index releases_label_idx on public.releases (label_id) where status = 'published';
create index release_artists_artist_idx on public.release_artists (artist_id, release_id);
create index release_genres_genre_idx on public.release_genres (genre_id, release_id);
create index release_countries_country_idx on public.release_countries (country_id, release_id);
create index release_slug_aliases_slug_idx on public.release_slug_aliases (slug, release_id);

alter table public.artists enable row level security;
alter table public.labels enable row level security;
alter table public.genres enable row level security;
alter table public.countries enable row level security;
alter table public.release_types enable row level security;
alter table public.releases enable row level security;
alter table public.release_artists enable row level security;
alter table public.release_genres enable row level security;
alter table public.release_countries enable row level security;
alter table public.release_radar enable row level security;
alter table public.release_links enable row level security;
alter table public.release_covers enable row level security;
alter table public.catalog_import_keys enable row level security;
alter table public.release_slug_aliases enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.artists, public.labels, public.genres, public.countries, public.release_types,
  public.releases, public.release_artists, public.release_genres, public.release_countries,
  public.release_radar, public.release_links, public.release_covers, public.release_slug_aliases
  to anon, authenticated;

create policy "published releases are publicly readable" on public.releases
  for select to anon, authenticated using (status = 'published');
create policy "catalog dictionaries are publicly readable" on public.artists
  for select to anon, authenticated using (true);
create policy "catalog labels are publicly readable" on public.labels
  for select to anon, authenticated using (true);
create policy "catalog genres are publicly readable" on public.genres
  for select to anon, authenticated using (true);
create policy "catalog countries are publicly readable" on public.countries
  for select to anon, authenticated using (true);
create policy "catalog release types are publicly readable" on public.release_types
  for select to anon, authenticated using (true);
create policy "published release artists are publicly readable" on public.release_artists
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release genres are publicly readable" on public.release_genres
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release countries are publicly readable" on public.release_countries
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release radar is publicly readable" on public.release_radar
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release links are publicly readable" on public.release_links
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release covers are publicly readable" on public.release_covers
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));
create policy "published release slug aliases are publicly readable" on public.release_slug_aliases
  for select to anon, authenticated
  using ((select status = 'published' from public.releases where id = release_id));

create view public.catalog_releases
with (security_invoker = true)
as
select
  r.id,
  r.slug,
  r.title,
  r.release_date,
  rt.name as type,
  l.name as label,
  r.review,
  rr.experimental,
  rr.denso,
  rr.sintetico,
  rr.bailable,
  rr.rapido,
  coalesce((
    select jsonb_agg(a.name order by ra.position, a.name)
    from public.release_artists ra
    join public.artists a on a.id = ra.artist_id
    where ra.release_id = r.id and ra.role = 'primary'
  ), '[]'::jsonb) as artists,
  coalesce((
    select jsonb_agg(g.name order by g.name)
    from public.release_genres rg
    join public.genres g on g.id = rg.genre_id
    where rg.release_id = r.id
  ), '[]'::jsonb) as genres,
  coalesce((
    select jsonb_agg(c.name order by c.name)
    from public.release_countries rc
    join public.countries c on c.id = rc.country_id
    where rc.release_id = r.id
  ), '[]'::jsonb) as countries,
  (select rl.url from public.release_links rl where rl.release_id = r.id and rl.is_primary) as buy_link,
  (select rcov.url from public.release_covers rcov where rcov.release_id = r.id and rcov.kind = 'external' order by rcov.created_at limit 1) as cover
from public.releases r
left join public.release_types rt on rt.id = r.release_type_id
left join public.labels l on l.id = r.label_id
left join public.release_radar rr on rr.release_id = r.id
where r.status = 'published';

grant select on public.catalog_releases to anon, authenticated;

create function private.import_catalog_release(payload jsonb)
returns table (imported_release_id uuid, action text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p_source_name text := btrim(payload ->> 'source_name');
  p_source_key text := btrim(payload ->> 'source_key');
  p_source_hash text := btrim(payload ->> 'source_hash');
  p_slug text := btrim(payload ->> 'slug');
  p_legacy_slug text := btrim(payload ->> 'legacy_slug');
  p_title text := btrim(payload ->> 'title');
  p_review text := coalesce(payload ->> 'review', '');
  p_status text := coalesce(payload ->> 'status', 'published');
  p_date date;
  p_release_id uuid;
  p_action text := 'updated';
  p_type_id uuid;
  p_label_id uuid;
  entry jsonb;
  entity_id uuid;
  entity_name text;
  entity_key text;
  entity_slug text;
begin
  if p_source_name = '' or p_source_key = '' or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'source_name, source_key and source_hash SHA-256 are required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' or p_legacy_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' then
    raise exception 'slug and legacy_slug must be canonical ASCII slugs';
  end if;
  if p_title = '' or jsonb_typeof(payload -> 'artists') <> 'array' or jsonb_array_length(payload -> 'artists') = 0 then
    raise exception 'title and at least one artist are required';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'invalid release status: %', p_status;
  end if;
  if nullif(payload ->> 'release_date', '') is not null then
    begin
      p_date := (payload ->> 'release_date')::date;
    exception when others then
      raise exception 'release_date must use ISO YYYY-MM-DD';
    end;
  end if;

  select cik.release_id into p_release_id
  from public.catalog_import_keys cik
  where cik.source_name = p_source_name and cik.source_key = p_source_key
  for update;

  -- Lookup tables retain their first editorial spelling. The importer sends a
  -- normalized key and a collision-safe slug for each entity.
  entity_name := btrim(payload ->> 'type');
  entity_key := btrim(payload ->> 'type_key');
  entity_slug := btrim(payload ->> 'type_slug');
  if entity_name = '' or entity_key = '' then raise exception 'type is required'; end if;
  insert into public.release_types (name, normalized_name, slug)
  values (entity_name, entity_key, entity_slug)
  on conflict (normalized_name) do update set updated_at = now()
  returning id into p_type_id;

  entity_name := btrim(payload ->> 'label');
  entity_key := btrim(payload ->> 'label_key');
  entity_slug := btrim(payload ->> 'label_slug');
  if entity_name = '' or entity_key = '' then raise exception 'label is required'; end if;
  insert into public.labels (name, normalized_name, slug)
  values (entity_name, entity_key, entity_slug)
  on conflict (normalized_name) do update set updated_at = now()
  returning id into p_label_id;

  if p_release_id is null then
    begin
      insert into public.releases (slug, title, release_date, release_type_id, label_id, review, status)
      values (p_slug, p_title, p_date, p_type_id, p_label_id, p_review, p_status)
      returning id into p_release_id;
    exception when unique_violation then
      raise exception 'canonical slug already belongs to another release: %', p_slug;
    end;
    insert into public.catalog_import_keys (source_name, source_key, release_id, source_hash, source_payload)
    values (p_source_name, p_source_key, p_release_id, p_source_hash, payload);
    p_action := 'created';
  else
    update public.releases
    set title = p_title, release_date = p_date, release_type_id = p_type_id,
        label_id = p_label_id, review = p_review, status = p_status, updated_at = now()
    where id = p_release_id;
    update public.catalog_import_keys
    set source_hash = p_source_hash, source_payload = payload, last_imported_at = now()
    where source_name = p_source_name and source_key = p_source_key;
  end if;

  insert into public.release_slug_aliases (slug, release_id, source_name)
  values (p_legacy_slug, p_release_id, p_source_name)
  on conflict do nothing;

  delete from public.release_artists where release_id = p_release_id;
  for idx in 0 .. jsonb_array_length(payload -> 'artists') - 1 loop
    entry := payload -> 'artists' -> idx;
    entity_name := btrim(entry ->> 'name');
    entity_key := btrim(entry ->> 'key');
    entity_slug := btrim(entry ->> 'slug');
    if entity_name = '' or entity_key = '' then raise exception 'artist % is invalid', idx + 1; end if;
    insert into public.artists (name, normalized_name, slug)
    values (entity_name, entity_key, entity_slug)
    on conflict (normalized_name) do update set updated_at = now()
    returning id into entity_id;
    insert into public.release_artists (release_id, artist_id, position)
    values (p_release_id, entity_id, idx);
  end loop;

  delete from public.release_genres where release_id = p_release_id;
  for entry in select value from jsonb_array_elements(coalesce(payload -> 'genres', '[]'::jsonb)) loop
    entity_name := btrim(entry ->> 'name'); entity_key := btrim(entry ->> 'key'); entity_slug := btrim(entry ->> 'slug');
    if entity_name = '' or entity_key = '' then raise exception 'invalid genre'; end if;
    insert into public.genres (name, normalized_name, slug) values (entity_name, entity_key, entity_slug)
    on conflict (normalized_name) do update set updated_at = now() returning id into entity_id;
    insert into public.release_genres (release_id, genre_id) values (p_release_id, entity_id) on conflict do nothing;
  end loop;

  delete from public.release_countries where release_id = p_release_id;
  for entry in select value from jsonb_array_elements(coalesce(payload -> 'countries', '[]'::jsonb)) loop
    entity_name := btrim(entry ->> 'name'); entity_key := btrim(entry ->> 'key'); entity_slug := btrim(entry ->> 'slug');
    if entity_name = '' or entity_key = '' then raise exception 'invalid country'; end if;
    insert into public.countries (name, normalized_name, slug) values (entity_name, entity_key, entity_slug)
    on conflict (normalized_name) do update set updated_at = now() returning id into entity_id;
    insert into public.release_countries (release_id, country_id) values (p_release_id, entity_id) on conflict do nothing;
  end loop;

  insert into public.release_radar (release_id, experimental, denso, sintetico, bailable, rapido)
  values (p_release_id, (payload -> 'radar' ->> 'experimental')::smallint, (payload -> 'radar' ->> 'denso')::smallint,
    (payload -> 'radar' ->> 'sintetico')::smallint, (payload -> 'radar' ->> 'bailable')::smallint,
    (payload -> 'radar' ->> 'rapido')::smallint)
  on conflict (release_id) do update set experimental = excluded.experimental, denso = excluded.denso,
    sintetico = excluded.sintetico, bailable = excluded.bailable, rapido = excluded.rapido;

  delete from public.release_links where release_id = p_release_id;
  if nullif(btrim(payload ->> 'buy_link'), '') is not null then
    insert into public.release_links (release_id, provider, url)
    values (p_release_id, btrim(payload ->> 'provider'), btrim(payload ->> 'buy_link'));
  end if;
  delete from public.release_covers where release_id = p_release_id;
  if nullif(btrim(payload ->> 'cover'), '') is not null then
    insert into public.release_covers (release_id, url)
    values (p_release_id, btrim(payload ->> 'cover'));
  end if;

  return query select p_release_id, p_action;
end;
$$;

revoke all on schema private from public, anon, authenticated;
revoke all on function private.import_catalog_release(jsonb) from public, anon, authenticated;
