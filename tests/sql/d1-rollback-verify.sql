-- D1: ensayo del rollback. El bloque entre los marcadores es el cuerpo exacto
-- de la migración posterior que revierte D1 (no se borra ni edita la de D1):
--   npx supabase migration new d1_rollback_profile_social_and_collection_order
-- y pegar ahí ese bloque. Este archivo lo ejecuta dentro de una transacción,
-- comprueba el esquema resultante y revierte: no cambia nada.
-- Pérdida de datos al aplicarlo de verdad: redes, preferencia de aportes y
-- orden manual. El orden visible vuelve a added_at.
begin;

-- >>> D1 ROLLBACK
drop function if exists public.reorder_crate_items(uuid, uuid[]);
drop trigger if exists set_crate_item_position on public.crate_items;
drop function if exists public.set_crate_item_position();
alter table public.crate_items
  drop constraint if exists crate_items_crate_position_key,
  drop constraint if exists crate_items_position_nonnegative,
  drop column if exists position;

drop function if exists public.get_public_accepted_contributions(uuid, integer, integer);

-- handle_new_user vuelve a la versión de Fase 4 (sin redes).
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

-- Quitar las columnas elimina también sus grants de columna y restricciones.
alter table public.profiles
  drop column if exists social_bandcamp,
  drop column if exists social_bandcamp_kind,
  drop column if exists social_soundcloud,
  drop column if exists social_instagram,
  drop column if exists social_x,
  drop column if exists social_facebook,
  drop column if exists show_accepted_contributions;
-- <<< D1 ROLLBACK

do $$
declare
  user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
      and ((table_name = 'profiles' and (column_name like 'social\_%' or column_name = 'show_accepted_contributions'))
        or (table_name = 'crate_items' and column_name = 'position'))) then
    raise exception 'D1 ROLLBACK FAIL: D1 columns remain';
  end if;
  if exists (select 1 from pg_proc where proname in ('reorder_crate_items', 'set_crate_item_position', 'get_public_accepted_contributions')) then
    raise exception 'D1 ROLLBACK FAIL: D1 functions remain';
  end if;
  if (select array_agg(column_name::text order by column_name::text) from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE')
     is distinct from array['bio', 'display_name', 'newsletter_opt_in'] then
    raise exception 'D1 ROLLBACK FAIL: profile update grants differ from phase 4';
  end if;
  -- Las políticas de colecciones no se tocaron en ningún sentido.
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('crates', 'crate_items')) <> 7 then
    raise exception 'D1 ROLLBACK FAIL: collection policies changed';
  end if;
  -- El alta sigue funcionando sin redes.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1-rb@d1.test',
    jsonb_build_object('username', 'd1-rollback', 'social_x', 'ignored'), now(), now());
  if not exists (select 1 from public.profiles where id = user_id) then
    raise exception 'D1 ROLLBACK FAIL: signup broken';
  end if;
  raise notice 'D1 rollback verify: OK';
end;
$$;
rollback;
