-- D2: Estudio — publicar/archivar en lote y señales para las vistas rápidas.
--
-- The batch has no write path of its own. For every release it calls the E06
-- RPC public.admin_update_catalog_release with the current snapshot as payload,
-- exactly as the E07 console does, so validation, versioning and audit are the
-- individual operation's. All or nothing: one rejected item undoes the batch.
--
-- Signals are read-only and admin-gated through the existing E06 read RPCs.
-- "Incompleto" is the E06 publish rule (20260917181154) evaluated on the
-- stored release; see docs/modernizacion/d2-estudio-lote-vistas-rapidas-*.md.

do $$
begin
  if to_regclass('public.problem_reports') is null then
    raise exception 'D2 requires E18 (public.problem_reports) to be applied first'
      using errcode = '55000';
  end if;
end;
$$;

-- Batch linkage for the audit log. Every change set of one batch shares it.
alter table private.catalog_change_sets add column if not exists batch_id uuid;
create index if not exists catalog_change_sets_batch_idx
  on private.catalog_change_sets (batch_id) where batch_id is not null;

-- "Con reportes abiertos": reports not yet resolved or closed.
create index if not exists problem_reports_open_release_idx
  on public.problem_reports (release_id)
  where release_id is not null and status in ('new', 'triaged', 'in_progress');

-- Publish requirements the stored release does not meet, in a fixed order.
-- Mirrors the E06 publish check on the payload E07 (and the batch) builds from
-- private.catalog_snapshot: the first external cover by created_at, and the
-- single primary link, must be HTTPS.
create or replace function private.catalog_release_missing_fields(p_release_id uuid)
returns text[] language sql stable set search_path = '' as $$
  select array_remove(array[
    case when r.release_date is null then 'release_date' end,
    case when r.release_type_id is null then 'release_type' end,
    case when r.label_id is null then 'label' end,
    case when not exists (select 1 from public.release_artists ra
      where ra.release_id = r.id and ra.role = 'primary') then 'primary_artist' end,
    case when not exists (select 1 from public.release_genres rg
      where rg.release_id = r.id) then 'genre' end,
    case when not exists (select 1 from public.release_countries rc
      where rc.release_id = r.id) then 'country' end,
    case when coalesce((select c.url from public.release_covers c
      where c.release_id = r.id and c.kind = 'external'
      order by c.created_at limit 1), '') !~* '^https://' then 'cover' end,
    case when not exists (select 1 from public.release_links l
      where l.release_id = r.id and l.is_primary and l.url ~* '^https://'
        and btrim(l.provider) <> '') then 'primary_link' end
  ], null)
  from public.releases r where r.id = p_release_id;
$$;

create or replace function private.catalog_release_open_report_count(p_release_id uuid)
returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from public.problem_reports pr
  where pr.release_id = p_release_id and pr.status in ('new', 'triaged', 'in_progress');
$$;

create or replace function private.catalog_release_signals(p_release_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'draft', r.status = 'draft',
    'incomplete', cardinality(m.fields) > 0,
    'missing_fields', to_jsonb(m.fields),
    'missing_cover', 'cover' = any(m.fields),
    'open_report_count', private.catalog_release_open_report_count(r.id)
  )
  from public.releases r
  cross join lateral (select private.catalog_release_missing_fields(r.id) as fields) m
  where r.id = p_release_id;
$$;

-- Admin snapshot: same shape as E06 plus the read-only "signals" object.
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
    ),
    'signals', private.catalog_release_signals(r.id)
  ) from public.releases r where r.id = p_release_id;
$$;

-- The eight-argument E06 list gains a ninth optional filter. Existing callers
-- omit it; the old signature is dropped so PostgREST never sees an overload.
drop function if exists public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text);
create function public.admin_list_catalog_releases(
  p_query text default null, p_statuses text[] default null, p_type_ids uuid[] default null,
  p_credit_qualities text[] default null, p_page integer default 1, p_page_size integer default 25,
  p_order_key text default 'release_date', p_order_direction text default 'desc',
  p_quick_view text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $d2_list$
declare
  v_total integer;
  v_items jsonb;
  v_order_key text := lower(btrim(coalesce(p_order_key, 'release_date')));
  v_order_direction text := lower(btrim(coalesce(p_order_direction, 'desc')));
  v_quick_view text := nullif(lower(btrim(coalesce(p_quick_view, ''))), '');
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'page must be >= 1 and page_size must be 1..100' using errcode = '22023'; end if;
  if v_order_key not in ('release_date', 'updated_at', 'title', 'slug')
     or v_order_direction not in ('asc', 'desc') then
    raise exception 'Unsupported order key or direction' using errcode = '22023';
  end if;
  if v_quick_view is not null and v_quick_view not in ('draft', 'incomplete', 'missing_cover', 'open_reports') then
    raise exception 'Unsupported quick view' using errcode = '22023';
  end if;
  with filtered as (
    select r.id, r.release_date, r.updated_at, r.title, r.slug from public.releases r
    left join public.labels l on l.id = r.label_id
    where (p_statuses is null or r.status = any(p_statuses))
      and (p_type_ids is null or r.release_type_id = any(p_type_ids))
      and (p_credit_qualities is null or r.credit_quality = any(p_credit_qualities))
      -- Inline on purpose: wrapping this CASE in another SQL function makes
      -- PostgreSQL re-plan the nested helper on every row (~10x slower).
      and (v_quick_view is null or case v_quick_view
        when 'draft' then r.status = 'draft'
        when 'incomplete' then cardinality(private.catalog_release_missing_fields(r.id)) > 0
        when 'missing_cover' then 'cover' = any(private.catalog_release_missing_fields(r.id))
        when 'open_reports' then private.catalog_release_open_report_count(r.id) > 0
      end)
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
    'page_size', p_page_size, 'order_key', v_order_key, 'order_direction', v_order_direction,
    'quick_view', v_quick_view);
end;
$d2_list$;

-- Counts for the quick views, optionally narrowed by status.
create or replace function public.admin_catalog_quick_view_counts(p_statuses text[] default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_counts jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', count(*),
    'draft', count(*) filter (where r.status = 'draft'),
    'incomplete', count(*) filter (where cardinality(m.fields) > 0),
    'missing_cover', count(*) filter (where 'cover' = any(m.fields)),
    'open_reports', count(*) filter (where private.catalog_release_open_report_count(r.id) > 0),
    'statuses', to_jsonb(p_statuses)
  ) into v_counts
  from public.releases r
  cross join lateral (select private.catalog_release_missing_fields(r.id) as fields) m
  where p_statuses is null or r.status = any(p_statuses);
  return v_counts;
end;
$$;

-- E06 history plus batch_id, so a change made in a batch can be identified.
create or replace function public.admin_get_catalog_history(p_release_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.releases where id = p_release_id) then raise exception 'Release not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'change_set_id', s.id, 'operation', s.operation, 'reason', s.reason, 'status', s.status,
    'base_version', s.base_version, 'result_version', s.result_version, 'created_at', s.created_at,
    'reverted_at', s.reverted_at, 'reverted_by', s.reverted_by, 'batch_id', s.batch_id,
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

-- Publish or archive up to 50 releases in one all-or-nothing transaction.
-- 50 keeps the batch (one outer subtransaction plus one per written item)
-- under PostgreSQL's 64 cached subtransactions per backend.
create or replace function public.admin_batch_update_catalog_releases(
  p_operation text, p_items jsonb, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_max_items constant integer := 50;
  v_target text;
  v_ids uuid[];
  v_item jsonb;
  v_id uuid;
  v_expected integer;
  v_status text;
  v_version integer;
  v_result jsonb;
  v_report jsonb := '[]'::jsonb;
  v_batch uuid := gen_random_uuid();
  v_rejected integer := 0;
  v_applied boolean := false;
  v_state text;
  v_message text;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_operation is null or p_operation not in ('publish', 'archive') then
    raise exception 'Batch operation must be publish or archive' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and c_max_items then
    raise exception 'A batch must contain 1..% items', c_max_items using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
      or jsonb_typeof(e->'release_id') is distinct from 'string'
      or (e->>'release_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(e->'expected_version') is distinct from 'number'
      or (e->>'expected_version') !~ '^[1-9][0-9]{0,8}$') then
    raise exception 'Each item needs release_id (UUID) and expected_version (positive integer)' using errcode = '22023';
  end if;
  select array_agg(distinct (e->>'release_id')::uuid) into v_ids from jsonb_array_elements(p_items) e;
  if cardinality(v_ids) <> jsonb_array_length(p_items) then
    raise exception 'A release can appear only once per batch' using errcode = '22023';
  end if;

  v_target := case p_operation when 'publish' then 'published' else 'archived' end;

  -- Lock every target row in UUID order before any write: concurrent batches
  -- cannot deadlock, and an in-flight individual edit finishes first.
  perform 1 from public.releases r where r.id = any(v_ids) order by r.id for update;

  begin
    for v_item in select e from jsonb_array_elements(p_items) with ordinality t(e, n) order by n loop
      v_id := (v_item->>'release_id')::uuid;
      v_expected := (v_item->>'expected_version')::integer;
      begin
        select r.status, r.catalog_version into v_status, v_version from public.releases r where r.id = v_id;
        if not found then raise exception 'Release not found' using errcode = 'P0002'; end if;
        if v_version <> v_expected then raise exception 'Catalog version conflict' using errcode = '40001'; end if;
        if v_status = v_target then
          v_report := v_report || jsonb_build_object('release_id', v_id, 'expected_version', v_expected,
            'result', 'unchanged', 'catalog_version', v_version);
        else
          -- The same payload E07 sends: the current snapshot without id/version.
          v_result := public.admin_update_catalog_release(v_id, v_expected,
            private.catalog_snapshot(v_id) - 'id' - 'catalog_version', p_reason, p_operation);
          update private.catalog_change_sets set batch_id = v_batch
          where id = (v_result->>'change_set_id')::uuid;
          v_report := v_report || jsonb_build_object('release_id', v_id, 'expected_version', v_expected,
            'result', 'applied', 'catalog_version', (v_result->>'catalog_version')::integer,
            'change_set_id', v_result->'change_set_id');
        end if;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
        v_rejected := v_rejected + 1;
        v_report := v_report || jsonb_build_object('release_id', v_id, 'expected_version', v_expected,
          'result', 'rejected', 'error', jsonb_build_object('code', v_state, 'message', v_message));
      end;
    end loop;
    if v_rejected > 0 then
      raise exception 'Batch rejected' using errcode = 'D2B01';
    end if;
    v_applied := true;
  exception when sqlstate 'D2B01' then
    -- Every write of the batch, audit included, was rolled back with this block.
    v_applied := false;
  end;

  if not v_applied then
    select jsonb_agg(case when x->>'result' = 'applied'
      then jsonb_build_object('release_id', x->'release_id', 'expected_version', x->'expected_version', 'result', 'rolled_back')
      else x end order by n) into v_report
    from jsonb_array_elements(v_report) with ordinality t(x, n);
  end if;

  return jsonb_build_object(
    'applied', v_applied,
    'operation', p_operation,
    'batch_id', case when v_applied and exists (select 1 from jsonb_array_elements(v_report) x where x->>'result' = 'applied') then v_batch end,
    'requested', jsonb_array_length(p_items),
    'applied_count', (select count(*) from jsonb_array_elements(v_report) x where x->>'result' = 'applied'),
    'unchanged_count', (select count(*) from jsonb_array_elements(v_report) x where x->>'result' = 'unchanged'),
    'rolled_back_count', (select count(*) from jsonb_array_elements(v_report) x where x->>'result' = 'rolled_back'),
    'rejected_count', v_rejected,
    'items', v_report
  );
end;
$$;

revoke all on function
  private.catalog_release_missing_fields(uuid),
  private.catalog_release_open_report_count(uuid),
  private.catalog_release_signals(uuid),
  private.admin_catalog_snapshot(uuid)
from public, anon, authenticated;
revoke all on function
  public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text, text),
  public.admin_catalog_quick_view_counts(text[]),
  public.admin_get_catalog_history(uuid),
  public.admin_batch_update_catalog_releases(text, jsonb, text)
from public, anon, authenticated;
grant execute on function
  public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text, text),
  public.admin_catalog_quick_view_counts(text[]),
  public.admin_get_catalog_history(uuid),
  public.admin_batch_update_catalog_releases(text, jsonb, text)
to authenticated;
