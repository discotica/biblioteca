-- D2: ensayo del rollback. El bloque entre los marcadores es el cuerpo exacto
-- de la migración posterior que revierte D2 (no se borra ni edita la de D2):
--   npx supabase migration new d2_rollback_studio_batch_and_quick_views
-- y pegar ahí ese bloque. Este archivo lo ejecuta dentro de una transacción,
-- comprueba el esquema resultante y revierte: no cambia nada.
-- Sin pérdida de datos: los change sets de los lotes y su batch_id se quedan.
begin;

-- >>> D2 ROLLBACK
-- Retira el lote, el conteo y las señales; restaura las lecturas de E06 tal
-- como las dejaron 20260916222340 y 20260917181154 (cuerpos copiados sin cambios).
-- Conserva private.catalog_change_sets.batch_id y su índice: son evidencia de
-- auditoría de los lotes ya aplicados y no se borran.
drop function if exists public.admin_batch_update_catalog_releases(text, jsonb, text);
drop function if exists public.admin_catalog_quick_view_counts(text[]);
drop function if exists public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text, text);

create or replace function private.admin_catalog_snapshot(p_release_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.catalog_snapshot(r.id) || jsonb_build_object(
    'updated_at', r.updated_at,
    -- Provenance is deliberately read-only. source_payload/hash/key stay private.
    'source', jsonb_build_object(
      'mode', case when exists (select 1 from public.catalog_import_keys k where k.release_id = r.id) then 'imported' else 'editorial' end,
      'provider', (select l.provider from public.release_links l where l.release_id = r.id and l.is_primary limit 1),
      'url', (select l.url from public.release_links l where l.release_id = r.id and l.is_primary limit 1),
      'cover_source_url', (select c.source_url from public.release_covers c where c.release_id = r.id and c.kind = 'external' order by c.created_at limit 1)
    )
  ) from public.releases r where r.id = p_release_id;
$$;

create or replace function public.admin_get_catalog_history(p_release_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.releases where id = p_release_id) then raise exception 'Release not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'change_set_id', s.id, 'operation', s.operation, 'reason', s.reason, 'status', s.status,
    'base_version', s.base_version, 'result_version', s.result_version, 'created_at', s.created_at,
    'reverted_at', s.reverted_at, 'reverted_by', s.reverted_by,
    'actor', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name),
    'before_state', e.before_state, 'after_state', e.after_state
  ) order by s.created_at desc, e.id desc), '[]'::jsonb) into v_result
  from private.catalog_change_sets s
  join private.catalog_change_events e on e.change_set_id=s.id
  join public.profiles p on p.id=s.actor_id
  where s.entity_id=p_release_id;
  return jsonb_build_object('release_id',p_release_id,'items',v_result);
end;
$$;

create function public.admin_list_catalog_releases(
  p_query text default null, p_statuses text[] default null, p_type_ids uuid[] default null,
  p_credit_qualities text[] default null, p_page integer default 1, p_page_size integer default 25,
  p_order_key text default 'release_date', p_order_direction text default 'desc'
)
returns jsonb language plpgsql security definer set search_path = '' as $e06_list$
declare
  v_total integer;
  v_items jsonb;
  v_order_key text := lower(btrim(coalesce(p_order_key, 'release_date')));
  v_order_direction text := lower(btrim(coalesce(p_order_direction, 'desc')));
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'page must be >= 1 and page_size must be 1..100' using errcode = '22023'; end if;
  if v_order_key not in ('release_date', 'updated_at', 'title', 'slug')
     or v_order_direction not in ('asc', 'desc') then
    raise exception 'Unsupported order key or direction' using errcode = '22023';
  end if;
  with filtered as (
    select r.id, r.release_date, r.updated_at, r.title, r.slug from public.releases r
    left join public.labels l on l.id = r.label_id
    where (p_statuses is null or r.status = any(p_statuses))
      and (p_type_ids is null or r.release_type_id = any(p_type_ids))
      and (p_credit_qualities is null or r.credit_quality = any(p_credit_qualities))
      and (nullif(btrim(coalesce(p_query,'')),'') is null or r.id::text = btrim(p_query)
        or r.slug ilike '%' || btrim(p_query) || '%' or r.title ilike '%' || btrim(p_query) || '%'
        or coalesce(l.name,'') ilike '%' || btrim(p_query) || '%'
        or exists (select 1 from public.release_artists ra join public.artists a on a.id=ra.artist_id where ra.release_id=r.id and a.name ilike '%' || btrim(p_query) || '%'))
  ), paged as (
    select * from filtered
    order by
      case when v_order_key = 'release_date' and v_order_direction = 'asc' then release_date end asc nulls last,
      case when v_order_key = 'release_date' and v_order_direction = 'desc' then release_date end desc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'asc' then updated_at end asc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'desc' then updated_at end desc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'asc' then lower(title) end asc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'desc' then lower(title) end desc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'asc' then slug end asc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'desc' then slug end desc nulls last,
      id asc
    offset (p_page - 1) * p_page_size limit p_page_size
  )
  select (select count(*) from filtered)::integer,
    coalesce((select jsonb_agg(private.admin_catalog_snapshot(id) order by
      case when v_order_key = 'release_date' and v_order_direction = 'asc' then release_date end asc nulls last,
      case when v_order_key = 'release_date' and v_order_direction = 'desc' then release_date end desc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'asc' then updated_at end asc nulls last,
      case when v_order_key = 'updated_at' and v_order_direction = 'desc' then updated_at end desc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'asc' then lower(title) end asc nulls last,
      case when v_order_key = 'title' and v_order_direction = 'desc' then lower(title) end desc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'asc' then slug end asc nulls last,
      case when v_order_key = 'slug' and v_order_direction = 'desc' then slug end desc nulls last,
      id asc) from paged), '[]'::jsonb)
  into v_total, v_items;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'page_size', p_page_size, 'order_key', v_order_key, 'order_direction', v_order_direction);
end;
$e06_list$;

drop function if exists private.catalog_release_signals(uuid);
drop function if exists private.catalog_release_open_report_count(uuid);
drop function if exists private.catalog_release_missing_fields(uuid);
drop index if exists public.problem_reports_open_release_idx;

revoke all on function private.admin_catalog_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text), public.admin_get_catalog_history(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text), public.admin_get_catalog_history(uuid) to authenticated;
-- <<< D2 ROLLBACK

do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_batch_update_catalog_releases(text,jsonb,text)',
    'public.admin_catalog_quick_view_counts(text[])',
    'public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text,text)',
    'private.catalog_release_missing_fields(uuid)', 'private.catalog_release_open_report_count(uuid)',
    'private.catalog_release_signals(uuid)'] loop
    if to_regprocedure(v_fn) is not null then raise exception 'D2 ROLLBACK FAIL: % still exists', v_fn; end if;
  end loop;
  if to_regprocedure('public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text)') is null
     or not has_function_privilege('authenticated', 'public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text)', 'execute')
     or has_function_privilege('anon', 'public.admin_list_catalog_releases(text,text[],uuid[],text[],integer,integer,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_get_catalog_history(uuid)', 'execute')
     or has_function_privilege('anon', 'public.admin_get_catalog_history(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.admin_catalog_snapshot(uuid)', 'execute') then
    raise exception 'D2 ROLLBACK FAIL: E06 read functions or grants not restored';
  end if;
  if pg_get_functiondef('private.admin_catalog_snapshot(uuid)'::regprocedure) like '%signals%'
     or pg_get_functiondef('public.admin_get_catalog_history(uuid)'::regprocedure) like '%batch_id%' then
    raise exception 'D2 ROLLBACK FAIL: D2 keys remain in E06 reads';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'catalog_change_sets' and column_name = 'batch_id')
     or to_regclass('private.catalog_change_sets_batch_idx') is null then
    raise exception 'D2 ROLLBACK FAIL: batch audit evidence must be kept';
  end if;
  if to_regclass('public.problem_reports_open_release_idx') is not null then
    raise exception 'D2 ROLLBACK FAIL: open reports index remains';
  end if;
  -- La lista de E06 vuelve a funcionar para admin y a negar al resto.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_list_catalog_releases(); raise exception 'D2 ROLLBACK FAIL: non-admin listed'; exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'D2 rollback verify: OK';
end;
$$;

rollback;
