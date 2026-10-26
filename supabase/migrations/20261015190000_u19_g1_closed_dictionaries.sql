-- U19 G1 (1/3): géneros y países con lista cerrada, alias y resolución por nombre.
-- Expediente: docs/modernizacion/u19-estudio-flujo-2026-10-15.md (G1, puntos 1 y 2).
--
-- Estado de géneros y países (`status`):
--   selectable  se ofrece en Sugerir y en el editor; propuestas, editor e importación lo aceptan;
--   legacy      se conserva donde ya está y la importación lo acepta, pero no se ofrece;
--   retired     se conserva donde ya está hasta que la hoja lo corrija; nadie lo acepta de nuevo.
--
-- Las listas se siembran aquí de forma explícita y no salen de los datos: en producción (E22) esta
-- migración corre antes de importar la hoja, con los diccionarios vacíos.
-- Listas aprobadas por el usuario el 2026-10-15:
--   - países seleccionables: los 33 estados de Latinoamérica y el Caribe, Puerto Rico y LATAM;
--   - países de legado: los 20 de fuera de la región que trae la hoja;
--   - EE.UU, EEUU y USA quedan como alias de Estados Unidos, y UK de Reino Unido;
--   - WORLD, Entrañas, TSA y cualquier otro país existente quedan retirados;
--   - géneros seleccionables: los 36 de la hoja. Los demás existentes quedan como legado.
--
-- Alias: la grafía vieja de un artista, sello, género o país apunta al valor que se conserva.
-- La búsqueda, Sugerir y la importación la traducen. Los alias de slug de artista y sello guardan
-- la URL pública vieja (`slugifyReleaseIdentity` del nombre anterior) para redirigirla (G4).

-- 1. Estado ---------------------------------------------------------------------------------------
-- Lo que ya existe nace como legado; la siembra marca lo seleccionable. Después el valor por
-- defecto pasa a 'selectable': solo admin crea géneros y países, y los crea para usarlos.
alter table public.genres
  add column status text not null default 'legacy' check (status in ('selectable', 'legacy', 'retired'));
alter table public.countries
  add column status text not null default 'legacy' check (status in ('selectable', 'legacy', 'retired'));

comment on column public.genres.status is
  'selectable: se ofrece y se acepta. legacy: se conserva y lo acepta la importación, no se ofrece. retired: se conserva donde está, nadie lo acepta de nuevo.';
comment on column public.countries.status is
  'selectable: se ofrece y se acepta. legacy: se conserva y lo acepta la importación, no se ofrece. retired: se conserva donde está, nadie lo acepta de nuevo.';

-- 2. Alias de nombre y de slug ----------------------------------------------------------------------
create table public.artist_aliases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  normalized_name text generated always as (private.normalize_catalog_artist_name(name)) stored unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.label_aliases (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  normalized_name text generated always as (private.normalize_catalog_dictionary_name(name)) stored unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.genre_aliases (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references public.genres(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  normalized_name text generated always as (private.normalize_catalog_dictionary_name(name)) stored unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.country_aliases (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  normalized_name text generated always as (private.normalize_catalog_dictionary_name(name)) stored unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.artist_slug_aliases (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.label_slug_aliases (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label_id uuid not null references public.labels(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index artist_aliases_artist_idx on public.artist_aliases (artist_id);
create index label_aliases_label_idx on public.label_aliases (label_id);
create index genre_aliases_genre_idx on public.genre_aliases (genre_id);
create index country_aliases_country_idx on public.country_aliases (country_id);
create index artist_slug_aliases_artist_idx on public.artist_slug_aliases (artist_id);
create index label_slug_aliases_label_idx on public.label_slug_aliases (label_id);
create index artist_aliases_created_by_idx on public.artist_aliases (created_by) where created_by is not null;
create index label_aliases_created_by_idx on public.label_aliases (created_by) where created_by is not null;
create index genre_aliases_created_by_idx on public.genre_aliases (created_by) where created_by is not null;
create index country_aliases_created_by_idx on public.country_aliases (created_by) where created_by is not null;
create index artist_slug_aliases_created_by_idx on public.artist_slug_aliases (created_by) where created_by is not null;
create index label_slug_aliases_created_by_idx on public.label_slug_aliases (created_by) where created_by is not null;

-- Lectura pública, como los diccionarios. Nadie escribe directamente: solo los RPC (G4) y las
-- migraciones.
alter table public.artist_aliases enable row level security;
alter table public.label_aliases enable row level security;
alter table public.genre_aliases enable row level security;
alter table public.country_aliases enable row level security;
alter table public.artist_slug_aliases enable row level security;
alter table public.label_slug_aliases enable row level security;
revoke all on table public.artist_aliases, public.label_aliases, public.genre_aliases, public.country_aliases,
  public.artist_slug_aliases, public.label_slug_aliases from public, anon, authenticated;
grant select on table public.artist_aliases, public.label_aliases, public.genre_aliases, public.country_aliases,
  public.artist_slug_aliases, public.label_slug_aliases to anon, authenticated;
create policy "artist aliases are publicly readable" on public.artist_aliases for select to anon, authenticated using (true);
create policy "label aliases are publicly readable" on public.label_aliases for select to anon, authenticated using (true);
create policy "genre aliases are publicly readable" on public.genre_aliases for select to anon, authenticated using (true);
create policy "country aliases are publicly readable" on public.country_aliases for select to anon, authenticated using (true);
create policy "artist slug aliases are publicly readable" on public.artist_slug_aliases for select to anon, authenticated using (true);
create policy "label slug aliases are publicly readable" on public.label_slug_aliases for select to anon, authenticated using (true);

-- Un alias no puede tener el nombre de un valor vivo del mismo diccionario: la resolución sería
-- ambigua. (La resolución busca primero el valor vivo, así que tampoco hace falta la regla inversa.)
-- En un trigger BEFORE la columna generada aún no está calculada: la clave sale de new.name.
create or replace function private.assert_catalog_alias_free()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_taken boolean;
begin
  v_taken := case tg_table_name
    when 'artist_aliases' then exists (select 1 from public.artists a where private.normalize_catalog_artist_name(a.name) = private.normalize_catalog_artist_name(new.name))
    when 'label_aliases' then exists (select 1 from public.labels l where private.normalize_catalog_dictionary_name(l.name) = private.normalize_catalog_dictionary_name(new.name))
    when 'genre_aliases' then exists (select 1 from public.genres g where private.normalize_catalog_dictionary_name(g.name) = private.normalize_catalog_dictionary_name(new.name))
    when 'country_aliases' then exists (select 1 from public.countries c where private.normalize_catalog_dictionary_name(c.name) = private.normalize_catalog_dictionary_name(new.name))
  end;
  if v_taken then
    raise exception 'alias_matches_live_value' using errcode = '23505', detail = new.name,
      hint = 'Un alias no puede tener el nombre de un valor que existe; fusiona o renombra primero.';
  end if;
  return new;
end;
$$;
revoke all on function private.assert_catalog_alias_free() from public, anon, authenticated;

create trigger artist_aliases_free before insert or update of name on public.artist_aliases
  for each row execute function private.assert_catalog_alias_free();
create trigger label_aliases_free before insert or update of name on public.label_aliases
  for each row execute function private.assert_catalog_alias_free();
create trigger genre_aliases_free before insert or update of name on public.genre_aliases
  for each row execute function private.assert_catalog_alias_free();
create trigger country_aliases_free before insert or update of name on public.country_aliases
  for each row execute function private.assert_catalog_alias_free();

-- 3. Siembra de géneros -------------------------------------------------------------------------------
with seed(name) as (values
  ('Acid'), ('Ambient'), ('Baile Funk'), ('Bass'), ('Breaks'), ('Cumbia'), ('Dark Disco'), ('Dembow'),
  ('Disco'), ('Downtempo'), ('Drum & Bass'), ('Dub'), ('Dubstep'), ('EBM'), ('Electro'), ('Experimental'),
  ('Folclor'), ('Footwork'), ('Garage'), ('Guaracha'), ('Hard Techno'), ('Hardcore'), ('Hardgroove'),
  ('Hip Hop'), ('House'), ('IDM'), ('Industrial'), ('Instrumental'), ('Neorave'), ('Pop'), ('Raptor House'),
  ('Reguetón'), ('Tech House'), ('Techno'), ('Trance'), ('Tribal')
), keyed as (
  select name, private.normalize_catalog_dictionary_name(name) as key from seed
), updated as (
  update public.genres g set name = k.name, status = 'selectable', updated_at = now()
  from keyed k where private.normalize_catalog_dictionary_name(g.name) = k.key
  returning private.normalize_catalog_dictionary_name(g.name) as key
)
insert into public.genres (name, normalized_name, slug, status)
select k.name, k.key, 'genre--' || substr(md5(k.key), 1, 12), 'selectable'
from keyed k where k.key not in (select key from updated);

-- 4. Siembra de países ----------------------------------------------------------------------------------
-- Las grafías sin tilde que ya existen (Haiti, Republica Dominicana, Canada, Libano, Pakistan) se
-- renombran: la clave normalizada es la misma, así que la hoja sigue coincidiendo.
with seed(name, status) as (values
  ('Argentina', 'selectable'), ('Bolivia', 'selectable'), ('Brasil', 'selectable'), ('Chile', 'selectable'),
  ('Colombia', 'selectable'), ('Ecuador', 'selectable'), ('Guyana', 'selectable'), ('Paraguay', 'selectable'),
  ('Perú', 'selectable'), ('Surinam', 'selectable'), ('Uruguay', 'selectable'), ('Venezuela', 'selectable'),
  ('Belice', 'selectable'), ('Costa Rica', 'selectable'), ('El Salvador', 'selectable'), ('Guatemala', 'selectable'),
  ('Honduras', 'selectable'), ('México', 'selectable'), ('Nicaragua', 'selectable'), ('Panamá', 'selectable'),
  ('Antigua y Barbuda', 'selectable'), ('Bahamas', 'selectable'), ('Barbados', 'selectable'), ('Cuba', 'selectable'),
  ('Dominica', 'selectable'), ('Granada', 'selectable'), ('Haití', 'selectable'), ('Jamaica', 'selectable'),
  ('Puerto Rico', 'selectable'), ('República Dominicana', 'selectable'), ('San Cristóbal y Nieves', 'selectable'),
  ('San Vicente y las Granadinas', 'selectable'), ('Santa Lucía', 'selectable'), ('Trinidad y Tobago', 'selectable'),
  ('LATAM', 'selectable'),
  ('Alemania', 'legacy'), ('Australia', 'legacy'), ('Austria', 'legacy'), ('Canadá', 'legacy'),
  ('Corea del Sur', 'legacy'), ('España', 'legacy'), ('Estados Unidos', 'legacy'), ('Francia', 'legacy'),
  ('Hungría', 'legacy'), ('India', 'legacy'), ('Islandia', 'legacy'), ('Italia', 'legacy'), ('Japón', 'legacy'),
  ('Líbano', 'legacy'), ('Países Bajos', 'legacy'), ('Pakistán', 'legacy'), ('Reino Unido', 'legacy'),
  ('Rumania', 'legacy'), ('Suecia', 'legacy'), ('Suiza', 'legacy')
), keyed as (
  select name, status, private.normalize_catalog_dictionary_name(name) as key from seed
), updated as (
  update public.countries c set name = k.name, status = k.status, updated_at = now()
  from keyed k where private.normalize_catalog_dictionary_name(c.name) = k.key
  returning private.normalize_catalog_dictionary_name(c.name) as key
)
insert into public.countries (name, normalized_name, slug, status)
select k.name, k.key, 'country--' || substr(md5(k.key), 1, 12), k.status
from keyed k where k.key not in (select key from updated);

-- 5. Grafías duplicadas de país: se fusionan en el valor conservado y quedan como alias -------------
do $$
declare
  v_pair record;
  v_target uuid;
  v_source uuid;
begin
  for v_pair in select * from (values ('EE.UU', 'Estados Unidos'), ('EEUU', 'Estados Unidos'), ('USA', 'Estados Unidos'), ('UK', 'Reino Unido')) p(alias, target) loop
    select id into strict v_target from public.countries
    where private.normalize_catalog_dictionary_name(name) = private.normalize_catalog_dictionary_name(v_pair.target);
    v_source := null;
    select id into v_source from public.countries
    where private.normalize_catalog_dictionary_name(name) = private.normalize_catalog_dictionary_name(v_pair.alias);
    if v_source is not null then
      insert into public.release_countries (release_id, country_id)
      select rc.release_id, v_target from public.release_countries rc where rc.country_id = v_source
      on conflict do nothing;
      delete from public.release_countries where country_id = v_source;
      delete from public.countries where id = v_source;
    end if;
    insert into public.country_aliases (country_id, name) values (v_target, v_pair.alias);
  end loop;
end;
$$;

-- 6. Lo que no está en ninguna lista queda retirado (WORLD, Entrañas, TSA en staging) --------------------
update public.countries set status = 'retired', updated_at = now()
where status = 'legacy'
  and private.normalize_catalog_dictionary_name(name) not in (
    select private.normalize_catalog_dictionary_name(n) from unnest(array[
      'Alemania', 'Australia', 'Austria', 'Canadá', 'Corea del Sur', 'España', 'Estados Unidos', 'Francia',
      'Hungría', 'India', 'Islandia', 'Italia', 'Japón', 'Líbano', 'Países Bajos', 'Pakistán', 'Reino Unido',
      'Rumania', 'Suecia', 'Suiza']) n);

alter table public.genres alter column status set default 'selectable';
alter table public.countries alter column status set default 'selectable';

-- 7. Unicidad canónica de países, como E06 hizo con sellos y géneros -----------------------------------
do $$
begin
  if exists (select 1 from public.countries group by private.normalize_catalog_dictionary_name(name) having count(*) > 1) then
    raise exception 'Cannot install canonical country uniqueness: existing canonical collisions require editorial reconciliation'
      using errcode = '23505';
  end if;
end;
$$;
create unique index countries_canonical_name_unique_idx
  on public.countries (private.normalize_catalog_dictionary_name(name));

-- 8. Resolución por nombre: primero el valor vivo, después el alias ----------------------------------------
create or replace function private.resolve_catalog_genre(p_name text)
returns table (id uuid, name text, status text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.status from public.genres g
  where private.normalize_catalog_dictionary_name(g.name) = private.normalize_catalog_dictionary_name(p_name)
  union all
  select g.id, g.name, g.status from public.genre_aliases a join public.genres g on g.id = a.genre_id
  where a.normalized_name = private.normalize_catalog_dictionary_name(p_name)
  limit 1;
$$;

create or replace function private.resolve_catalog_country(p_name text)
returns table (id uuid, name text, status text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.status from public.countries c
  where private.normalize_catalog_dictionary_name(c.name) = private.normalize_catalog_dictionary_name(p_name)
  union all
  select c.id, c.name, c.status from public.country_aliases a join public.countries c on c.id = a.country_id
  where a.normalized_name = private.normalize_catalog_dictionary_name(p_name)
  limit 1;
$$;

create or replace function private.resolve_catalog_label(p_name text)
returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name from public.labels l
  where private.normalize_catalog_dictionary_name(l.name) = private.normalize_catalog_dictionary_name(p_name)
  union all
  select l.id, l.name from public.label_aliases a join public.labels l on l.id = a.label_id
  where a.normalized_name = private.normalize_catalog_dictionary_name(p_name)
  limit 1;
$$;

create or replace function private.resolve_catalog_artist(p_name text)
returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name from public.artists a
  where private.normalize_catalog_artist_name(a.name) = private.normalize_catalog_artist_name(p_name)
  union all
  select a.id, a.name from public.artist_aliases x join public.artists a on a.id = x.artist_id
  where x.normalized_name = private.normalize_catalog_artist_name(p_name)
  limit 1;
$$;

-- Artistas y sellos libres: se resuelven por nombre o alias y, si no existen, se crean en la misma
-- transacción, con su evento de alta cuando hay una persona detrás (E06).
create or replace function private.ensure_catalog_artist(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
  v_key text;
  v_artist public.artists%rowtype;
  v_id uuid;
begin
  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'artist_name_invalid' using errcode = '22023', detail = coalesce(p_name, '');
  end if;
  v_key := private.normalize_catalog_artist_name(v_name);
  select r.id into v_id from private.resolve_catalog_artist(v_name) r;
  if v_id is not null then return v_id; end if;
  insert into public.artists (name, normalized_name, slug)
  values (v_name, v_key, 'artist--' || substr(md5(v_key), 1, 12))
  on conflict do nothing
  returning * into v_artist;
  if not found then
    select r.id into v_id from private.resolve_catalog_artist(v_name) r;
    if v_id is null then raise exception 'Canonical artist conflict could not be resolved' using errcode = '40001'; end if;
    return v_id;
  end if;
  if (select auth.uid()) is not null then
    insert into private.catalog_artist_change_events (artist_id, actor_id, operation, normalized_name, after_state)
    values (v_artist.id, (select auth.uid()), 'create', v_key,
      jsonb_build_object('id', v_artist.id, 'name', v_artist.name, 'normalized_name', v_artist.normalized_name, 'slug', v_artist.slug));
  end if;
  return v_artist.id;
end;
$$;

create or replace function private.ensure_catalog_label(p_name text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
  v_key text;
  v_label public.labels%rowtype;
  v_id uuid;
begin
  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'label_name_invalid' using errcode = '22023', detail = coalesce(p_name, '');
  end if;
  v_key := private.normalize_catalog_dictionary_name(v_name);
  perform pg_advisory_xact_lock(hashtextextended('label:' || v_key, 0));
  select r.id into v_id from private.resolve_catalog_label(v_name) r;
  if v_id is not null then return v_id; end if;
  insert into public.labels (name, normalized_name, slug)
  values (v_name, v_key, 'label--' || substr(md5(v_key), 1, 12))
  on conflict do nothing
  returning * into v_label;
  if not found then
    select r.id into v_id from private.resolve_catalog_label(v_name) r;
    if v_id is null then raise exception 'Canonical label conflict could not be resolved' using errcode = '40001'; end if;
    return v_id;
  end if;
  if (select auth.uid()) is not null then
    perform private.record_catalog_dictionary_create('label', v_label.id, v_key,
      jsonb_build_object('id', v_label.id, 'name', v_label.name, 'normalized_name', v_key, 'slug', v_label.slug, 'catalog_version', 1),
      coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Alta implícita'));
  end if;
  return v_label.id;
end;
$$;

revoke all on function private.resolve_catalog_genre(text), private.resolve_catalog_country(text),
  private.resolve_catalog_label(text), private.resolve_catalog_artist(text),
  private.ensure_catalog_artist(text), private.ensure_catalog_label(text, text)
  from public, anon, authenticated;
