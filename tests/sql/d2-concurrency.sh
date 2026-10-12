#!/usr/bin/env bash
# D2: concurrencia del lote auditado.
#
#   1. Lotes solapados en paralelo, en órdenes y operaciones aleatorias.
#      Ninguno puede terminar en deadlock (40P01), ni como error ni dentro
#      del informe por elemento. Al final, la
#      versión de cada lanzamiento cuadra con su auditoría, y los change sets
#      con batch_id suman lo que los lotes informaron como aplicado.
#   2. Un lote que llega mientras una edición individual tiene el lanzamiento
#      bloqueado espera, ve la versión nueva y se rechaza con 40001.
#   3. Sonda informativa sobre E06: dos ediciones individuales con la misma
#      versión base. El contrato dice que la segunda recibe 40001.
#
# Solo local: los fixtures se confirman (las sesiones paralelas deben verlos)
# y al salir se borran, incluida su auditoría privada. No apuntar a staging.
#   bash tests/sql/d2-concurrency.sh
#   PSQL='docker exec -i supabase_db_<project_id> psql -U postgres' bash tests/sql/d2-concurrency.sh
set -euo pipefail

PSQL=${PSQL:-"docker exec -i supabase_db_discotica psql -U postgres"}
RELEASES=${RELEASES:-8}
BATCHES=${BATCHES:-24}

ADMIN=$(uuidgen | tr 'A-Z' 'a-z')
TAG="d2c-${ADMIN:0:8}"
OUT=$(mktemp -d)

psql_run() { eval "$PSQL"' -X -q -v ON_ERROR_STOP=1 -At "$@"'; }

cleanup() {
  psql_run <<SQL >/dev/null 2>&1 || true
delete from private.catalog_change_events where entity_id in (select id from public.releases where slug like '$TAG-%');
delete from private.catalog_change_sets where entity_id in (select id from public.releases where slug like '$TAG-%');
delete from public.releases where slug like '$TAG-%';
delete from public.artists where slug = '$TAG-artista';
delete from public.labels where slug = '$TAG-sello';
delete from public.genres where slug = '$TAG-genero';
delete from public.countries where slug = '$TAG-pais';
delete from auth.users where id = '$ADMIN';
SQL
  rm -rf "$OUT"
}
trap cleanup EXIT

as_admin="select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\",\"role\":\"authenticated\"}', false); set role authenticated;"

psql_run <<SQL >/dev/null
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('$ADMIN', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '$TAG@d2.test', jsonb_build_object('username', '$TAG'), now(), now());
update public.profiles set role = 'admin' where id = '$ADMIN';
insert into public.labels (name, normalized_name, slug) values ('$TAG sello', '$TAG sello', '$TAG-sello');
insert into public.genres (name, normalized_name, slug) values ('$TAG genero', '$TAG genero', '$TAG-genero');
insert into public.countries (name, normalized_name, slug) values ('$TAG pais', '$TAG pais', '$TAG-pais');
insert into public.artists (name, normalized_name, slug) values ('$TAG artista', '$TAG artista', '$TAG-artista');
$as_admin
select public.admin_create_catalog_release(jsonb_build_object(
  'title', 'D2 concurrencia ' || i, 'slug', '$TAG-' || i, 'release_date', '2026-10-06',
  'release_type_id', (select id from public.release_types where slug = 'album'),
  'label_id', (select id from public.labels where slug = '$TAG-sello'),
  'review', '', 'status', 'draft', 'credit_quality', 'legacy',
  'artist_ids', jsonb_build_array((select id from public.artists where slug = '$TAG-artista')),
  'collaborator_ids', '[]'::jsonb,
  'genre_ids', jsonb_build_array((select id from public.genres where slug = '$TAG-genero')),
  'country_ids', jsonb_build_array((select id from public.countries where slug = '$TAG-pais')),
  'radar', jsonb_build_object('experimental', 0, 'denso', 0, 'sintetico', 0, 'bailable', 0, 'rapido', 0),
  'links', jsonb_build_array(jsonb_build_object('provider', 'bandcamp', 'url', 'https://d2.bandcamp.com/album/' || i, 'is_primary', true)),
  'cover_url', 'https://f4.bcbits.com/img/d2-' || i || '.jpg'), 'fixture de concurrencia')
from generate_series(1, $RELEASES) i;
SQL

# 1. Lotes solapados -----------------------------------------------------------
batch_session() {
  psql_run <<SQL
$as_admin
select pg_sleep(random() * 0.3);
with pick as (
  select x from jsonb_array_elements(public.admin_list_catalog_releases(p_query => '$TAG', p_page_size => 100)->'items') x
  order by random() limit 3 + floor(random() * 4)::int
)
select public.admin_batch_update_catalog_releases(
  case when random() < 0.5 then 'publish' else 'archive' end,
  (select jsonb_agg(jsonb_build_object('release_id', x->>'id', 'expected_version', (x->>'catalog_version')::int)) from pick),
  'd2 concurrencia');
SQL
}
for i in $(seq 1 "$BATCHES"); do batch_session >"$OUT/b$i.out" 2>"$OUT/b$i.err" & done
wait

errors=$(cat "$OUT"/b*.err | grep -c ERROR || true)
# Un deadlock dentro de un elemento lo captura el bloque por elemento: aparece
# en el informe como 40P01 y el lote se deshace. Se cuentan las dos formas.
deadlocks=$(( $(cat "$OUT"/b*.err | grep -c 'deadlock' || true) + $(cat "$OUT"/b*.out | { grep -o '"40P01"' || true; } | wc -l) ))
applied=$(cat "$OUT"/b*.out | grep -c '"applied": true' || true)
rejected=$(cat "$OUT"/b*.out | grep -c '"applied": false' || true)
applied_items=$(cat "$OUT"/b*.out | grep -o '"applied_count": [0-9]*' | awk '{s+=$2} END {print s+0}')

audit=$(psql_run <<SQL
select concat_ws(' ',
  (select count(*) from public.releases r where r.slug like '$TAG-%'
     and r.catalog_version - 1 <> (select count(*) from private.catalog_change_sets s where s.entity_id = r.id and s.operation <> 'create')),
  (select count(*) from private.catalog_change_sets s join public.releases r on r.id = s.entity_id
     where r.slug like '$TAG-%' and s.operation <> 'create' and s.result_version <> s.base_version + 1),
  (select count(*) from private.catalog_change_sets s join public.releases r on r.id = s.entity_id
     where r.slug like '$TAG-%' and s.batch_id is not null));
SQL
)
read -r version_mismatch chain_gaps batched_sets <<<"$audit"

echo "Fase 1: $BATCHES lotes; aplicados $applied, rechazados $rejected; elementos aplicados $applied_items; change sets en lote $batched_sets"
echo "        errores $errors, deadlocks $deadlocks, versiones que no cuadran $version_mismatch, saltos de versión $chain_gaps"
phase1=PASS
if [ "$errors" != 0 ] || [ "$deadlocks" != 0 ] || [ "$version_mismatch" != 0 ] || [ "$chain_gaps" != 0 ] \
   || [ "$applied_items" != "$batched_sets" ] || [ $((applied + rejected)) != "$BATCHES" ]; then
  phase1=FAIL; cat "$OUT"/b*.err | head -20
fi
echo "Fase 1: $phase1"

# 2. Lote frente a una edición individual en curso ----------------------------
X=$(psql_run -c "select id from public.releases where slug = '$TAG-1'")
V=$(psql_run -c "select catalog_version from public.releases where id = '$X'")
edit_payload="(public.admin_get_catalog_release('$X') - 'id' - 'catalog_version' - 'updated_at' - 'source' - 'signals')"

psql_run >"$OUT/p2a.out" 2>&1 <<SQL &
$as_admin
begin;
select (public.admin_update_catalog_release('$X', $V, $edit_payload || '{"title":"D2 edición A"}', 'edición A', 'update'))->>'catalog_version';
select pg_sleep(1.5);
commit;
SQL
sleep 0.5
op=$(psql_run -c "select case when status = 'published' then 'archive' else 'publish' end from public.releases where id = '$X'")
psql_run >"$OUT/p2b.out" 2>&1 <<SQL
$as_admin
select public.admin_batch_update_catalog_releases('$op', jsonb_build_array(jsonb_build_object('release_id', '$X', 'expected_version', $V)), 'lote con versión vieja')->'items'->0->'error'->>'code';
SQL
wait
p2_code=$(tail -1 "$OUT/p2b.out")
p2_state=$(psql_run -c "select title || ' v' || catalog_version from public.releases where id = '$X'")
phase2=PASS
if [ "$p2_code" != 40001 ] || [ "$p2_state" != "D2 edición A v$((V + 1))" ]; then phase2=FAIL; cat "$OUT/p2a.out" "$OUT/p2b.out"; fi
echo "Fase 2: el lote recibió '$p2_code'; queda '$p2_state' → $phase2"

# 3. Sonda E06: dos ediciones individuales con la misma versión base ---------------
Y=$(psql_run -c "select id from public.releases where slug = '$TAG-2'")
W=$(psql_run -c "select catalog_version from public.releases where id = '$Y'")
edit_payload="(public.admin_get_catalog_release('$Y') - 'id' - 'catalog_version' - 'updated_at' - 'source' - 'signals')"
psql_run >"$OUT/p3a.out" 2>&1 <<SQL &
$as_admin
begin;
select (public.admin_update_catalog_release('$Y', $W, $edit_payload || '{"title":"D2 edición A"}', 'edición A', 'update'))->>'catalog_version';
select pg_sleep(1.5);
commit;
SQL
sleep 0.5
psql_run >"$OUT/p3b.out" 2>&1 <<SQL || true
$as_admin
select (public.admin_update_catalog_release('$Y', $W, $edit_payload || '{"title":"D2 edición B"}', 'edición B', 'update'))->>'catalog_version';
SQL
wait
p3_state=$(psql_run -c "select title || ' v' || catalog_version from public.releases where id = '$Y'")
if grep -q 'Catalog version conflict' "$OUT/p3b.out"; then
  echo "Sonda E06: la segunda edición recibió 40001; queda '$p3_state' → contrato cumplido"
else
  echo "Sonda E06: la segunda edición NO recibió 40001 ($(tail -1 "$OUT/p3b.out")); queda '$p3_state' → actualización perdida (informativo, fuera de D2)"
fi

[ "$phase1" = PASS ] && [ "$phase2" = PASS ] && echo "D2 concurrency: OK" || { echo "D2 concurrency: FAIL"; exit 1; }
