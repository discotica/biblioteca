-- E02: canonical catalog v2.
--
-- This migration keeps release UUIDs and canonical slugs stable while it:
--   * collapses legacy credit roles into primary/collaborator;
--   * canonicalizes the five allowed release types;
--   * distinguishes migration aliases from permanent editorial redirects;
--   * exposes ordered credit groups without removing the legacy artists field;
--   * makes import and contribution publication reject unknown release types.

create schema if not exists private;

create or replace function private.canonical_release_type_slug(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case regexp_replace(lower(btrim(p_value)), '\s+', ' ', 'g')
    when 'disco' then 'album'
    when 'album' then 'album'
    when 'álbum' then 'album'
    when 'ep' then 'ep'
    when 'single' then 'single'
    when 'compilado' then 'compilado'
    when 'sample pack' then 'sample-pack'
    else null
  end;
$$;

revoke all on function private.canonical_release_type_slug(text)
  from public, anon, authenticated;

-- Stop instead of guessing when an existing dictionary value cannot be mapped.
do $$
declare
  invalid_values text;
begin
  select string_agg(format('%s [%s/%s]', name, normalized_name, slug), ', ' order by name)
  into invalid_values
  from public.release_types
  where coalesce(
    private.canonical_release_type_slug(name),
    private.canonical_release_type_slug(normalized_name)
  ) is null;

  if invalid_values is not null then
    raise exception 'E02 cannot map existing release types deterministically: %', invalid_values
      using errcode = '23514';
  end if;
end;
$$;

-- Private migration evidence is deliberately not exposed through the Data API.
create table private.release_type_migration_log (
  migration_version text not null,
  release_id uuid not null,
  previous_type_id uuid not null,
  previous_name text not null,
  previous_normalized_name text not null,
  previous_slug text not null,
  canonical_type_id uuid not null,
  canonical_name text not null,
  canonical_slug text not null,
  recorded_at timestamptz not null default now(),
  primary key (migration_version, release_id)
);

create table private.release_credit_migration_log (
  migration_version text not null,
  release_id uuid not null,
  artist_id uuid not null,
  legacy_role text not null check (legacy_role in ('primary', 'featured', 'remixer', 'other', 'collaborator')),
  legacy_position smallint not null check (legacy_position >= 0),
  migrated_role text not null check (migrated_role in ('primary', 'collaborator')),
  migrated_position smallint not null check (migrated_position >= 0),
  resolution text not null check (resolution in (
    'role_mapped',
    'primary_prevailed',
    'duplicate_collaborator_roles_collapsed'
  )),
  recorded_at timestamptz not null default now(),
  primary key (migration_version, release_id, artist_id, legacy_role)
);

alter table private.release_type_migration_log enable row level security;
alter table private.release_credit_migration_log enable row level security;
revoke all on table private.release_type_migration_log, private.release_credit_migration_log
  from public, anon, authenticated;

-- Reuse an existing canonical row when possible. Disco/Album/Álbum all converge
-- on the same Álbum row; release IDs are never recreated.
do $$
declare
  canonical record;
  target_id uuid;
begin
  for canonical in
    select *
    from (values
      ('album', 'Álbum', 'album'),
      ('ep', 'EP', 'ep'),
      ('single', 'Single', 'single'),
      ('compilado', 'Compilado', 'compilado'),
      ('sample-pack', 'Sample Pack', 'sample pack')
    ) as allowed(slug, name, normalized_name)
  loop
    select rt.id
    into target_id
    from public.release_types rt
    where coalesce(
      private.canonical_release_type_slug(rt.name),
      private.canonical_release_type_slug(rt.normalized_name)
    ) = canonical.slug
    order by
      (rt.slug = canonical.slug) desc,
      (rt.normalized_name = canonical.normalized_name) desc,
      rt.id
    limit 1;

    if target_id is null then
      insert into public.release_types (name, normalized_name, slug)
      values (canonical.name, canonical.normalized_name, canonical.slug)
      returning id into target_id;
    end if;

    insert into private.release_type_migration_log (
      migration_version,
      release_id,
      previous_type_id,
      previous_name,
      previous_normalized_name,
      previous_slug,
      canonical_type_id,
      canonical_name,
      canonical_slug
    )
    select
      '20260915204413',
      r.id,
      rt.id,
      rt.name,
      rt.normalized_name,
      rt.slug,
      target_id,
      canonical.name,
      canonical.slug
    from public.releases r
    join public.release_types rt on rt.id = r.release_type_id
    where coalesce(
      private.canonical_release_type_slug(rt.name),
      private.canonical_release_type_slug(rt.normalized_name)
    ) = canonical.slug
      and (
        rt.id <> target_id
        or rt.name <> canonical.name
        or rt.normalized_name <> canonical.normalized_name
        or rt.slug <> canonical.slug
      )
    on conflict (migration_version, release_id) do nothing;

    update public.releases r
    set release_type_id = target_id,
        updated_at = now()
    from public.release_types rt
    where r.release_type_id = rt.id
      and rt.id <> target_id
      and coalesce(
        private.canonical_release_type_slug(rt.name),
        private.canonical_release_type_slug(rt.normalized_name)
      ) = canonical.slug;

    delete from public.release_types rt
    where rt.id <> target_id
      and coalesce(
        private.canonical_release_type_slug(rt.name),
        private.canonical_release_type_slug(rt.normalized_name)
      ) = canonical.slug;

    update public.release_types
    set name = canonical.name,
        normalized_name = canonical.normalized_name,
        slug = canonical.slug,
        updated_at = now()
    where id = target_id;
  end loop;
end;
$$;

alter table public.release_types
  add constraint release_types_canonical_value_check
  check (
    (name = 'Álbum' and normalized_name = 'album' and slug = 'album')
    or (name = 'EP' and normalized_name = 'ep' and slug = 'ep')
    or (name = 'Single' and normalized_name = 'single' and slug = 'single')
    or (name = 'Compilado' and normalized_name = 'compilado' and slug = 'compilado')
    or (name = 'Sample Pack' and normalized_name = 'sample pack' and slug = 'sample-pack')
  ) not valid;
alter table public.release_types validate constraint release_types_canonical_value_check;

do $$
begin
  if (select count(*) from public.release_types) <> 5 then
    raise exception 'E02 expected exactly five canonical release types'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.releases
  add column credit_quality text not null default 'legacy';
alter table public.releases
  add constraint releases_credit_quality_check
  check (credit_quality in ('legacy', 'proposed', 'verified')) not valid;
alter table public.releases validate constraint releases_credit_quality_check;
alter table public.releases
  add constraint releases_published_type_required_check
  check (status <> 'published' or release_type_id is not null) not valid;
alter table public.releases validate constraint releases_published_type_required_check;

-- Merge old role namespaces without rewriting primary relationships. Ordering is
-- deterministic and preserves relative order inside every legacy role.
do $$
begin
  if exists (
    select 1 from public.release_artists
    where role not in ('primary', 'featured', 'remixer', 'other', 'collaborator')
  ) then
    raise exception 'E02 found an unknown release artist role'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.release_artists drop constraint release_artists_role_check;
alter table public.release_artists
  add constraint release_artists_role_transition_check
  check (role in ('primary', 'featured', 'remixer', 'other', 'collaborator'));

create temporary table e02_credit_map on commit drop as
with grouped as (
  select
    release_id,
    artist_id,
    bool_or(role = 'primary') as has_primary,
    min(position) filter (where role = 'primary') as primary_position,
    min(position) filter (where role <> 'primary') as collaborator_sort_position,
    min(case role
      when 'collaborator' then 0
      when 'featured' then 1
      when 'remixer' then 2
      when 'other' then 3
      else 4
    end) filter (where role <> 'primary') as collaborator_sort_role,
    count(*) as source_count
  from public.release_artists
  group by release_id, artist_id
), prepared as (
  select
    release_id,
    artist_id,
    has_primary,
    source_count,
    case when has_primary then 'primary' else 'collaborator' end as migrated_role,
    case when has_primary then primary_position else collaborator_sort_position end as sort_position,
    coalesce(collaborator_sort_role, 0) as sort_role
  from grouped
)
select
  release_id,
  artist_id,
  has_primary,
  source_count,
  migrated_role,
  case
    when migrated_role = 'primary' then sort_position
    else (row_number() over (
      partition by release_id, migrated_role
      order by sort_position, sort_role, artist_id
    ) - 1)::smallint
  end as migrated_position
from prepared;

insert into private.release_credit_migration_log (
  migration_version,
  release_id,
  artist_id,
  legacy_role,
  legacy_position,
  migrated_role,
  migrated_position,
  resolution
)
select
  '20260915204413',
  ra.release_id,
  ra.artist_id,
  ra.role,
  ra.position,
  mapped.migrated_role,
  mapped.migrated_position,
  case
    when mapped.source_count > 1 and mapped.has_primary then 'primary_prevailed'
    when mapped.source_count > 1 then 'duplicate_collaborator_roles_collapsed'
    else 'role_mapped'
  end
from public.release_artists ra
join e02_credit_map mapped
  on mapped.release_id = ra.release_id
 and mapped.artist_id = ra.artist_id
where ra.role <> 'primary' or mapped.source_count > 1
on conflict (migration_version, release_id, artist_id, legacy_role) do nothing;

delete from public.release_artists where role <> 'primary';

insert into public.release_artists (release_id, artist_id, position, role)
select release_id, artist_id, migrated_position, 'collaborator'
from e02_credit_map
where migrated_role = 'collaborator';

alter table public.release_artists drop constraint release_artists_pkey;
alter table public.release_artists drop constraint release_artists_release_id_position_role_key;
alter table public.release_artists drop constraint release_artists_role_transition_check;
alter table public.release_artists
  add constraint release_artists_role_check
  check (role in ('primary', 'collaborator'));
alter table public.release_artists
  add constraint release_artists_pkey primary key (release_id, artist_id);
alter table public.release_artists
  add constraint release_artists_release_role_position_key
  unique (release_id, role, position);

-- FK lookup/cascade indexes not covered by the existing leftmost index order.
create index releases_release_type_idx
  on public.releases (release_type_id, id);
create index release_slug_aliases_release_idx
  on public.release_slug_aliases (release_id, slug);

alter table public.release_slug_aliases
  add column alias_kind text not null default 'migration';
update public.release_slug_aliases
set alias_kind = case when is_legacy then 'migration' else 'editorial_redirect' end;
alter table public.release_slug_aliases
  add constraint release_slug_aliases_kind_check
  check (alias_kind in ('migration', 'editorial_redirect')) not valid;
alter table public.release_slug_aliases
  add constraint release_slug_aliases_kind_legacy_consistency_check
  check (
    (alias_kind = 'migration' and is_legacy)
    or (alias_kind = 'editorial_redirect' and not is_legacy)
  ) not valid;
alter table public.release_slug_aliases validate constraint release_slug_aliases_kind_check;
alter table public.release_slug_aliases validate constraint release_slug_aliases_kind_legacy_consistency_check;

comment on column public.release_slug_aliases.alias_kind is
  'migration aliases are temporary compatibility data; editorial_redirect aliases are permanent editorial redirects. Canonical release slugs always win.';

-- Atomic read resolver: canonical first, exactly one visible alias second,
-- ambiguous aliases unresolved. SECURITY INVOKER preserves releases/alias RLS.
create or replace function public.resolve_release_slug(p_slug text)
returns table (
  release_id uuid,
  canonical_slug text,
  match_kind text,
  alias_kind text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with canonical_match as (
    select r.id as release_id, r.slug as canonical_slug
    from public.releases r
    where r.slug = btrim(p_slug)
      and r.status = 'published'
  ), alias_matches as (
    select
      r.id as release_id,
      r.slug as canonical_slug,
      a.alias_kind,
      count(*) over () as match_count
    from public.release_slug_aliases a
    join public.releases r on r.id = a.release_id
    where a.slug = btrim(p_slug)
      and r.status = 'published'
  )
  select c.release_id, c.canonical_slug, 'canonical'::text, null::text
  from canonical_match c
  union all
  select a.release_id, a.canonical_slug, 'alias'::text, a.alias_kind
  from alias_matches a
  where a.match_count = 1
    and not exists (select 1 from canonical_match);
$$;

revoke all on function public.resolve_release_slug(text)
  from public, anon, authenticated;
grant execute on function public.resolve_release_slug(text)
  to anon, authenticated;

create or replace view public.catalog_releases
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
    select jsonb_agg(a.name order by ra.position, a.name, a.id)
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
  (select rcov.url from public.release_covers rcov where rcov.release_id = r.id and rcov.kind = 'external' order by rcov.created_at limit 1) as cover,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'slug', a.slug,
        'name', a.name,
        'position', ra.position
      ) order by ra.position, a.name, a.id
    )
    from public.release_artists ra
    join public.artists a on a.id = ra.artist_id
    where ra.release_id = r.id and ra.role = 'primary'
  ), '[]'::jsonb) as primary_artists,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'slug', a.slug,
        'name', a.name,
        'position', ra.position
      ) order by ra.position, a.name, a.id
    )
    from public.release_artists ra
    join public.artists a on a.id = ra.artist_id
    where ra.release_id = r.id and ra.role = 'collaborator'
  ), '[]'::jsonb) as collaborators,
  r.credit_quality
from public.releases r
left join public.release_types rt on rt.id = r.release_type_id
left join public.labels l on l.id = r.label_id
left join public.release_radar rr on rr.release_id = r.id
where r.status = 'published';

grant select on public.catalog_releases to anon, authenticated;

create or replace function private.import_catalog_release(payload jsonb)
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
  p_credit_quality text := coalesce(nullif(btrim(payload ->> 'credit_quality'), ''), 'legacy');
  p_primary_artists jsonb;
  p_collaborators jsonb;
  p_type_slug text;
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
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$'
    or p_legacy_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$' then
    raise exception 'slug and legacy_slug must be canonical ASCII slugs';
  end if;

  p_primary_artists := case
    when jsonb_typeof(payload -> 'primary_artists') = 'array' then payload -> 'primary_artists'
    else payload -> 'artists'
  end;
  p_collaborators := coalesce(payload -> 'collaborators', '[]'::jsonb);

  if p_title = ''
    or jsonb_typeof(p_primary_artists) <> 'array'
    or jsonb_array_length(p_primary_artists) = 0 then
    raise exception 'title and at least one primary artist are required';
  end if;
  if jsonb_typeof(p_collaborators) <> 'array' then
    raise exception 'collaborators must be an array';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'invalid release status: %', p_status;
  end if;
  if p_credit_quality not in ('legacy', 'proposed', 'verified') then
    raise exception 'invalid credit quality: %', p_credit_quality using errcode = '22023';
  end if;
  if nullif(payload ->> 'release_date', '') is not null then
    begin
      p_date := (payload ->> 'release_date')::date;
    exception when others then
      raise exception 'release_date must use ISO YYYY-MM-DD';
    end;
  end if;

  p_type_slug := private.canonical_release_type_slug(payload ->> 'type');
  if p_type_slug is null then
    raise exception 'Tipo de lanzamiento inválido. Permitidos: Álbum, EP, Single, Compilado, Sample Pack.'
      using errcode = '22023';
  end if;
  select id into p_type_id
  from public.release_types
  where slug = p_type_slug;
  if p_type_id is null then
    raise exception 'El tipo canónico % no está configurado.', p_type_slug;
  end if;

  select cik.release_id into p_release_id
  from public.catalog_import_keys cik
  where cik.source_name = p_source_name and cik.source_key = p_source_key
  for update;

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
      insert into public.releases (
        slug, title, release_date, release_type_id, label_id, review, status, credit_quality
      ) values (
        p_slug, p_title, p_date, p_type_id, p_label_id, p_review, p_status, p_credit_quality
      ) returning id into p_release_id;
    exception when unique_violation then
      raise exception 'canonical slug already belongs to another release: %', p_slug;
    end;
    insert into public.catalog_import_keys (source_name, source_key, release_id, source_hash, source_payload)
    values (p_source_name, p_source_key, p_release_id, p_source_hash, payload);
    p_action := 'created';
  else
    update public.releases
    set title = p_title,
        release_date = p_date,
        release_type_id = p_type_id,
        label_id = p_label_id,
        review = p_review,
        status = p_status,
        credit_quality = p_credit_quality,
        updated_at = now()
    where id = p_release_id;
    update public.catalog_import_keys
    set source_hash = p_source_hash,
        source_payload = payload,
        last_imported_at = now()
    where source_name = p_source_name and source_key = p_source_key;
  end if;

  insert into public.release_slug_aliases (slug, release_id, source_name, is_legacy, alias_kind)
  values (p_legacy_slug, p_release_id, p_source_name, true, 'migration')
  on conflict (slug, release_id) do nothing;

  delete from public.release_artists where release_id = p_release_id;
  for idx in 0 .. jsonb_array_length(p_primary_artists) - 1 loop
    entry := p_primary_artists -> idx;
    entity_name := btrim(entry ->> 'name');
    entity_key := btrim(entry ->> 'key');
    entity_slug := btrim(entry ->> 'slug');
    if entity_name = '' or entity_key = '' then raise exception 'primary artist % is invalid', idx + 1; end if;
    insert into public.artists (name, normalized_name, slug)
    values (entity_name, entity_key, entity_slug)
    on conflict (normalized_name) do update set updated_at = now()
    returning id into entity_id;
    insert into public.release_artists (release_id, artist_id, position, role)
    values (p_release_id, entity_id, idx, 'primary');
  end loop;

  if jsonb_array_length(p_collaborators) > 0 then
    for idx in 0 .. jsonb_array_length(p_collaborators) - 1 loop
      entry := p_collaborators -> idx;
      entity_name := btrim(entry ->> 'name');
      entity_key := btrim(entry ->> 'key');
      entity_slug := btrim(entry ->> 'slug');
      if entity_name = '' or entity_key = '' then raise exception 'collaborator % is invalid', idx + 1; end if;
      insert into public.artists (name, normalized_name, slug)
      values (entity_name, entity_key, entity_slug)
      on conflict (normalized_name) do update set updated_at = now()
      returning id into entity_id;
      if exists (
        select 1 from public.release_artists
        where release_id = p_release_id and artist_id = entity_id
      ) then
        raise exception 'An artist cannot be both primary and collaborator: %', entity_name
          using errcode = '23505';
      end if;
      insert into public.release_artists (release_id, artist_id, position, role)
      values (p_release_id, entity_id, idx, 'collaborator');
    end loop;
  end if;

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

revoke all on function private.import_catalog_release(jsonb)
  from public, anon, authenticated;

-- Keep the current contribution payload contract until E09, but normalize its
-- type and stop auto-creating arbitrary dictionary rows.
create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_action text,
  p_note text default null
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contributions%rowtype;
  p jsonb;
  p_release_id uuid;
  p_artist_id uuid;
  p_label_id uuid;
  p_type_id uuid;
  p_type_slug text;
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
  if p_action in ('changes_requested', 'rejected')
    and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reviewer note is required';
  end if;

  if p_action = 'approved' then
    p := c.payload;
    if nullif(btrim(p ->> 'title'), '') is null
      or jsonb_typeof(p -> 'artists') <> 'array'
      or jsonb_array_length(p -> 'artists') = 0 then
      raise exception 'title and at least one artist are required to publish';
    end if;

    p_type_slug := private.canonical_release_type_slug(p ->> 'type');
    if p_type_slug is null then
      raise exception 'Tipo de lanzamiento inválido. Permitidos: Álbum, EP, Single, Compilado, Sample Pack.'
        using errcode = '22023';
    end if;
    select id into p_type_id from public.release_types where slug = p_type_slug;
    if p_type_id is null then
      raise exception 'El tipo canónico % no está configurado.', p_type_slug;
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

    insert into public.releases (
      slug, title, release_date, release_type_id, label_id, review, status, credit_quality
    ) values (
      p_slug_base || '--' || substr(replace(c.id::text, '-', ''), 1, 8),
      btrim(p ->> 'title'),
      p_date,
      p_type_id,
      p_label_id,
      coalesce(p ->> 'review', ''),
      'published',
      'legacy'
    ) returning id into p_release_id;

    for p_artist in
      select btrim(value) from jsonb_array_elements_text(p -> 'artists') as artists(value)
    loop
      if p_artist <> '' then
        insert into public.artists (name, normalized_name, slug)
        values (p_artist, lower(p_artist), 'artist--' || substr(md5(lower(p_artist)), 1, 8))
        on conflict (normalized_name) do update set updated_at = now()
        returning id into p_artist_id;
        insert into public.release_artists (release_id, artist_id, position, role)
        values (
          p_release_id,
          p_artist_id,
          coalesce((
            select max(position) + 1
            from public.release_artists
            where release_id = p_release_id and role = 'primary'
          ), 0),
          'primary'
        );
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
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      release_id = p_release_id,
      updated_at = now()
  where id = c.id
  returning * into c;

  insert into public.contribution_events (
    contribution_id, actor_id, action, before_payload, after_payload, note
  ) values (
    c.id, (select auth.uid()), p_action, c.payload, c.payload, c.reviewer_note
  );
  return c;
end;
$$;

revoke all on function public.review_contribution(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_contribution(uuid, text, text)
  to authenticated;

comment on column public.releases.credit_quality is
  'legacy: not audited; proposed: machine/editorial proposal pending verification; verified: human-verified credits.';
comment on view public.catalog_releases is
  'Published catalog v2. artists is temporary primary-name compatibility; primary_artists and collaborators are the canonical ordered credit groups.';
