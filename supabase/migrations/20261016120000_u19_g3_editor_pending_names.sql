-- U19 G3: la cola se corrige en el editor del Estudio. Expediente:
-- docs/modernizacion/u19-estudio-flujo-2026-10-15.md (G3, punto 2).
--
-- 1. Nombres nuevos en el editor del catálogo. Créditos y sello aceptan un nombre que todavía no existe
--    («se crea al guardar»). Se crea en la misma transacción que guarda, con su evento de alta, como al
--    aceptar una propuesta (G1). Sustituye a las altas auditadas aparte de E06 en el editor; los RPC
--    admin_create_catalog_* siguen para quien los use.
--    - artist_ids y collaborator_ids aceptan, además de UUID, objetos {"name": "…"};
--    - label_name se usa cuando label_id viene vacío.
--    Un nombre se resuelve por nombre o alias igual que al aceptar: si ya existe, se usa ese.
-- 2. resolve_catalog_names: dice qué nombres de artista o de sello ya existen (por nombre o alias). El
--    editor lo usa para mostrar como «nuevo» solo lo que de verdad se creará al aceptar una propuesta.

-- 1. Nombres nuevos -------------------------------------------------------------------------------------
create or replace function private.resolve_catalog_pending_names(p_payload jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb := p_payload - 'label_name'; v_seen uuid[] := '{}'; v_group text; v_ids jsonb; v_item jsonb;
  v_id uuid; v_name text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid catalog payload' using errcode = '22023'; end if;
  foreach v_group in array array['artist_ids', 'collaborator_ids'] loop
    if jsonb_typeof(coalesce(p_payload->v_group, '[]'::jsonb)) <> 'array' then raise exception 'Invalid catalog payload' using errcode = '22023'; end if;
    v_ids := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(coalesce(p_payload->v_group, '[]'::jsonb)) loop
      if jsonb_typeof(v_item) = 'object' then
        if jsonb_typeof(v_item->'name') is distinct from 'string' then raise exception 'Invalid catalog payload' using errcode = '22023'; end if;
        v_name := v_item->>'name';
        v_id := private.ensure_catalog_artist(v_name);
        -- El nombre nuevo resultó ser un crédito que ya está: mejor decirlo que duplicarlo.
        if v_id = any(v_seen) then raise exception 'credit_duplicate' using errcode = '23505', detail = v_name,
          hint = 'Ese nombre ya es uno de los créditos del lanzamiento.'; end if;
        v_ids := v_ids || to_jsonb(v_id::text);
      else
        -- Los UUID los valida apply_catalog_payload, como siempre.
        if jsonb_typeof(v_item) = 'string' and (v_item #>> '{}') ~* '^[0-9a-f-]{36}$' then v_id := (v_item #>> '{}')::uuid; else v_id := null; end if;
        v_ids := v_ids || v_item;
      end if;
      if v_id is not null then v_seen := v_seen || v_id; end if;
    end loop;
    if p_payload ? v_group then v_payload := jsonb_set(v_payload, array[v_group], v_ids); end if;
  end loop;
  if nullif(p_payload->>'label_id', '') is null and nullif(btrim(coalesce(p_payload->>'label_name', '')), '') is not null then
    v_payload := jsonb_set(v_payload, '{label_id}', to_jsonb(private.ensure_catalog_label(p_payload->>'label_name', p_reason)::text));
  end if;
  return v_payload;
end;
$$;

-- Cuerpo de 20261011190000 (S6) salvo la resolución de nombres nuevos, marcada "U19".
create or replace function public.admin_update_catalog_release(p_release_id uuid,p_expected_version integer,p_payload jsonb,p_reason text,p_operation text default 'update')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_version integer; v_change uuid;
begin
  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode='42501'; end if;
  if p_operation not in ('update','publish','archive') or nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Invalid operation or missing reason' using errcode='22023'; end if;
  -- H1: bloquear en una sentencia propia; el snapshot se lee en la siguiente,
  -- con la instantánea posterior a la espera.
  perform 1 from public.releases where id=p_release_id for update;
  if not found then raise exception 'Release not found' using errcode='P0002'; end if;
  v_before:=private.catalog_snapshot(p_release_id);
  if (v_before->>'catalog_version')::integer <> p_expected_version then raise exception 'Catalog version conflict' using errcode='40001'; end if;
  if p_operation='publish' then p_payload:=jsonb_set(p_payload,'{status}','"published"'); elsif p_operation='archive' then p_payload:=jsonb_set(p_payload,'{status}','"archived"'); end if;
  if p_payload->>'slug' <> v_before->>'slug' then raise exception 'Use admin_change_release_slug for slug changes' using errcode='22023'; end if;
  -- U19: artistas y sello nuevos se crean aquí, en la misma transacción que guarda.
  p_payload:=private.resolve_catalog_pending_names(p_payload, p_reason);
  v_version:=private.apply_catalog_payload(p_release_id,p_payload); v_after:=private.catalog_snapshot(p_release_id); v_change:=private.record_catalog_change(p_operation,p_release_id,p_expected_version,v_version,v_before,v_after,p_reason);
  return jsonb_build_object('release_id',p_release_id,'catalog_version',v_version,'change_set_id',v_change);
end;
$$;

-- 2. Qué nombres ya existen ---------------------------------------------------------------------------
-- p_kind: 'artist' o 'label'. p_names: lista de hasta 200 nombres. Devuelve, en el mismo orden,
-- [{name, id, canonical}], con id y canonical null si el nombre se crearía nuevo. Artistas, sellos y
-- alias ya son de lectura pública; el RPC solo aplica la misma normalización que aceptar.
create or replace function public.resolve_catalog_names(p_kind text, p_names jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb := '[]'::jsonb; v_name text; v_row record;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('artist', 'label') then raise exception 'Invalid kind' using errcode = '22023'; end if;
  if jsonb_typeof(p_names) is distinct from 'array' or jsonb_array_length(p_names) > 200
     or exists (select 1 from jsonb_array_elements(p_names) x where jsonb_typeof(x) <> 'string') then
    raise exception 'Names must be an array of up to 200 strings' using errcode = '22023';
  end if;
  for v_name in select value from jsonb_array_elements_text(p_names) loop
    if p_kind = 'artist' then select r.id, r.name into v_row from private.resolve_catalog_artist(v_name) r;
    else select r.id, r.name into v_row from private.resolve_catalog_label(v_name) r; end if;
    v_result := v_result || jsonb_build_array(jsonb_build_object('name', v_name, 'id', v_row.id, 'canonical', v_row.name));
  end loop;
  return v_result;
end;
$$;

revoke all on function private.resolve_catalog_pending_names(jsonb, text) from public, anon, authenticated;
revoke all on function public.resolve_catalog_names(text, jsonb) from public, anon, authenticated;
grant execute on function public.resolve_catalog_names(text, jsonb) to authenticated;
