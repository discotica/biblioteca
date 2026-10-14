-- D1: redes del perfil, visibilidad pública de aportes aceptados y orden manual
-- de colecciones. No reescribe ninguna política existente de profiles, crates,
-- crate_items ni contributions. Rollback: una migración posterior, documentada
-- en docs/modernizacion/d1-datos-perfil-colecciones-2026-10-06.md.

-- 1. Redes sociales: se guarda el usuario normalizado (minúsculas, sin "@" ni
-- URL). La URL pública se construye en src/lib/domain/profileSocial.ts, que
-- replica estos formatos. Bandcamp admite dos formas: página de fan
-- (bandcamp.com/usuario) o subdominio de artista (artista.bandcamp.com);
-- social_bandcamp_kind dice cuál es y van juntas o ninguna.
alter table public.profiles
  add column social_bandcamp text,
  add column social_bandcamp_kind text,
  add column social_soundcloud text,
  add column social_instagram text,
  add column social_x text,
  add column social_facebook text,
  add column show_accepted_contributions boolean not null default false;

alter table public.profiles
  add constraint profiles_social_bandcamp_kind_check
    check (social_bandcamp_kind in ('fan', 'artist')),
  add constraint profiles_social_bandcamp_pair
    check ((social_bandcamp is null) = (social_bandcamp_kind is null)),
  -- Fan: usuario de bandcamp.com/usuario. Artista: una etiqueta DNS (subdominio).
  add constraint profiles_social_bandcamp_format
    check (
      (social_bandcamp_kind = 'fan' and social_bandcamp ~ '^[a-z0-9_-]{1,64}$')
      or (social_bandcamp_kind = 'artist' and char_length(social_bandcamp) <= 63
        and social_bandcamp ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and social_bandcamp <> 'www')
    ),
  add constraint profiles_social_soundcloud_format
    check (social_soundcloud ~ '^[a-z0-9_-]{3,25}$'),
  add constraint profiles_social_instagram_format
    check (char_length(social_instagram) <= 30 and social_instagram ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  add constraint profiles_social_x_format
    check (social_x ~ '^[a-z0-9_]{1,15}$'),
  add constraint profiles_social_facebook_format
    check (char_length(social_facebook) between 5 and 50 and social_facebook ~ '^[a-z0-9]+(\.[a-z0-9]+)*$');

-- La lectura pública de profiles ya cubre todas sus columnas; solo se amplía la
-- escritura del dueño. username y role siguen fuera.
grant update (
  social_bandcamp, social_bandcamp_kind, social_soundcloud, social_instagram, social_x,
  social_facebook, show_accepted_contributions
) on table public.profiles to authenticated;

-- Fase 4 reservó /crate y /mis-crates. U3 movió esas rutas a /coleccion y
-- /mis-colecciones, así que un perfil con ese nombre chocaría con la ruta nueva.
insert into private.reserved_usernames (username, reason)
values ('coleccion', 'system'), ('mis-colecciones', 'system')
on conflict (username) do nothing;

-- El registro no tiene sesión hasta confirmar el correo: las redes opcionales
-- llegan en raw_user_meta_data. El cliente las normaliza; aquí solo se recortan
-- y las restricciones de arriba rechazan cualquier formato inválido.
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
  insert into public.profiles (
    id, username, display_name, newsletter_opt_in,
    social_bandcamp, social_bandcamp_kind, social_soundcloud, social_instagram, social_x, social_facebook
  )
  values (
    new.id, requested_username, coalesce(left(requested_display_name, 60), requested_username),
    coalesce(new.raw_user_meta_data ->> 'newsletter_opt_in', '') = 'true',
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_bandcamp', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_bandcamp_kind', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_soundcloud', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_instagram', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_x', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'social_facebook', '')), '')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2. Aportes aceptados en el perfil público. contributions sigue sin lectura
-- anónima; esta RPC devuelve únicamente el lanzamiento publicado y la fecha de
-- aceptación, solo si la persona lo permite. Nunca payload, notas ni estados.
create or replace function public.get_public_accepted_contributions(
  p_profile_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (release_id uuid, accepted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select contribution.release_id, contribution.reviewed_at
  from public.contributions as contribution
  join public.profiles as profile on profile.id = contribution.author_id
  join public.releases as release on release.id = contribution.release_id
  where contribution.author_id = p_profile_id
    and profile.show_accepted_contributions
    and contribution.status = 'approved'
    and release.status = 'published'
  order by contribution.reviewed_at desc nulls last, contribution.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_accepted_contributions(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_accepted_contributions(uuid, integer, integer)
  to anon, authenticated;

-- 3. Orden manual. Backfill estable desde added_at (empates por id); el orden
-- visible no cambia. La unicidad es diferible para que una permutación en una
-- sola sentencia se valide al final de la sentencia y no fila a fila.
alter table public.crate_items add column position integer;

update public.crate_items as item
set position = ordered.position
from (
  select id, (row_number() over (partition by crate_id order by added_at, id) - 1)::integer as position
  from public.crate_items
) as ordered
where item.id = ordered.id;

alter table public.crate_items
  alter column position set not null,
  add constraint crate_items_position_nonnegative check (position >= 0),
  add constraint crate_items_crate_position_key unique (crate_id, position)
    deferrable initially immediate;

-- Toda inserción va al final. El bloqueo de la colección serializa altas y
-- reordenamientos de la misma colección; la posición enviada por el cliente se
-- ignora. Security invoker: quien no es dueño no obtiene el bloqueo y la
-- política de inserción existente lo rechaza igual.
create or replace function public.set_crate_item_position()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.crates where crates.id = new.crate_id for no key update;
  select coalesce(max(item.position) + 1, 0) into new.position
  from public.crate_items as item
  where item.crate_id = new.crate_id;
  return new;
end;
$$;

revoke all on function public.set_crate_item_position() from public, anon, authenticated;

create trigger set_crate_item_position
before insert on public.crate_items
for each row execute function public.set_crate_item_position();

-- Único camino de escritura de position: authenticated no tiene UPDATE sobre
-- crate_items. Recibe la permutación completa de la colección y la aplica en
-- una sentencia. Si la colección cambió desde que el cliente la leyó, falla
-- con 40001 para que recargue; no adivina un orden parcial.
create or replace function public.reorder_crate_items(p_crate_id uuid, p_item_ids uuid[])
returns setof public.crate_items
language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid;
begin
  select crate.owner_id into v_owner_id
  from public.crates as crate
  where crate.id = p_crate_id
  for no key update;
  -- Mismo error para colección inexistente o ajena: no revela colecciones privadas.
  if v_owner_id is null or v_owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the collection owner can reorder it' using errcode = '42501';
  end if;

  if p_item_ids is null
     or array_position(p_item_ids, null) is not null
     or cardinality(p_item_ids) <> (select count(distinct item_id) from unnest(p_item_ids) as ids(item_id)) then
    raise exception 'Item ids must be a list without nulls or duplicates' using errcode = '22023';
  end if;

  if cardinality(p_item_ids) <> (select count(*) from public.crate_items as item where item.crate_id = p_crate_id)
     or exists (
       select 1 from unnest(p_item_ids) as ids(item_id)
       where not exists (
         select 1 from public.crate_items as item
         where item.crate_id = p_crate_id and item.id = ids.item_id
       )
     ) then
    raise exception 'The collection changed; reload it before reordering' using errcode = '40001';
  end if;

  update public.crate_items as item
  set position = (ordered.ordinality - 1)::integer
  from unnest(p_item_ids) with ordinality as ordered(item_id, ordinality)
  where item.crate_id = p_crate_id
    and item.id = ordered.item_id
    and item.position <> (ordered.ordinality - 1)::integer;

  return query
    select item.* from public.crate_items as item
    where item.crate_id = p_crate_id
    order by item.position;
end;
$$;

revoke all on function public.reorder_crate_items(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_crate_items(uuid, uuid[]) to authenticated;
