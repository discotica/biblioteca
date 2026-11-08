-- U23 (rediseño del Estudio, D7b aprobada el 2026-11-07): la reseña salió de la interfaz y la nota de
-- quien propone ya no se publica como reseña al aceptar. Hasta ahora el payload del catálogo tomaba
-- `coalesce(review, team_note)`; desde aquí solo `review` (que ninguna pantalla escribe). La nota sigue
-- en la propuesta y en su historial. Misma función que 20261015190100 con esa única línea cambiada:
-- `create or replace` conserva dueño y permisos (private, sin EXECUTE para anon ni authenticated).
-- Verificación: tests/sql/u23-verify.sql.

create or replace function private.catalog_payload_from_suggestion(p jsonb, p_source_url text, p_source_provider text, p_detected jsonb, p_status text, p_slug_seed text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_type_id uuid; v_artist_ids jsonb := '[]'; v_collaborator_ids jsonb := '[]'; v_genre_ids jsonb := '[]'; v_country_ids jsonb := '[]';
  v_name text; v_id uuid; v_slug text; v_cover text; v_row record;
begin
  select id into v_type_id from public.release_types where slug = p->>'release_type';
  if v_type_id is null then raise exception 'Canonical release type is not configured' using errcode='23503'; end if;
  for v_name in select value from jsonb_array_elements_text(p->'primary_artists') loop
    v_artist_ids := v_artist_ids || to_jsonb(private.ensure_catalog_artist(v_name));
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'collaborators') loop
    v_id := private.ensure_catalog_artist(v_name);
    if v_artist_ids ? v_id::text then raise exception 'credit_in_both_groups' using errcode='22023', detail = v_name; end if;
    v_collaborator_ids := v_collaborator_ids || to_jsonb(v_id);
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'genres') loop
    select r.id, r.status into v_row from private.resolve_catalog_genre(v_name) r;
    if v_row.id is null or v_row.status <> 'selectable' then raise exception 'genre_not_selectable' using errcode='22023', detail = v_name; end if;
    if not v_genre_ids ? v_row.id::text then v_genre_ids := v_genre_ids || to_jsonb(v_row.id); end if;
  end loop;
  for v_name in select value from jsonb_array_elements_text(p->'countries') loop
    select r.id, r.status into v_row from private.resolve_catalog_country(v_name) r;
    if v_row.id is null or v_row.status <> 'selectable' then raise exception 'country_not_selectable' using errcode='22023', detail = v_name; end if;
    if not v_country_ids ? v_row.id::text then v_country_ids := v_country_ids || to_jsonb(v_row.id); end if;
  end loop;
  v_slug := trim(both '-' from regexp_replace(private.normalize_catalog_dictionary_name(p->>'title'), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'lanzamiento'; end if;
  v_slug := left(v_slug, 80);
  v_slug := trim(both '-' from v_slug) || '--' || substr(md5(p_slug_seed), 1, 8);
  v_cover := coalesce(nullif(p->>'cover_url', ''), case when coalesce(p_detected->>'cover_url', '') ~* '^https://' then p_detected->>'cover_url' end);
  return jsonb_build_object(
    'slug', v_slug, 'title', p->>'title', 'release_date', p->>'release_date', 'release_type_id', v_type_id,
    'label_id', private.ensure_catalog_label(p->>'label', p_reason),
    'review', coalesce(p->>'review', ''), 'status', p_status, 'credit_quality', 'proposed',
    'artist_ids', v_artist_ids, 'collaborator_ids', v_collaborator_ids, 'genre_ids', v_genre_ids, 'country_ids', v_country_ids,
    'links', jsonb_build_array(jsonb_build_object('provider', coalesce(nullif(btrim(coalesce(p_source_provider, '')), ''), 'manual'), 'url', btrim(p_source_url), 'is_primary', true)),
    'cover_url', v_cover, 'radar', coalesce(p->'radar', '{}'::jsonb));
end;
$$;
