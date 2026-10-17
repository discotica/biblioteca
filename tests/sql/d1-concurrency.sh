#!/usr/bin/env bash
# D1: concurrencia del orden manual de colecciones.
#
# Lanza sesiones PostgreSQL en paralelo contra UNA colección:
#   1. altas simultáneas (todas deben entrar, sin 23505 por posición);
#   2. reordenamientos simultáneos mezclados con altas y bajas.
# Comprueba al final que no hay posiciones duplicadas ni errores inesperados.
# Un reordenamiento puede fallar con 40001 si una alta/baja cambió la colección
# entre su lectura y su escritura: es el contrato (el cliente recarga).
#
# Los fixtures se confirman (las sesiones paralelas deben verlos) y se borran
# al salir, también si algo falla. Por defecto usa el stack local:
#   bash tests/sql/d1-concurrency.sh
# Otro destino solo con autorización explícita:
#   PSQL='psql "postgresql://…"' bash tests/sql/d1-concurrency.sh
set -euo pipefail

PSQL=${PSQL:-"docker exec -i supabase_db_discotica psql -U postgres"}
INSERTS=${INSERTS:-20}
REORDERS=${REORDERS:-12}
MIXED_INSERTS=${MIXED_INSERTS:-6}
MIXED_DELETES=${MIXED_DELETES:-3}

OWNER=$(uuidgen | tr 'A-Z' 'a-z')
CRATE=$(uuidgen | tr 'A-Z' 'a-z')
TAG="d1c-${OWNER:0:8}"
OUT=$(mktemp -d)

psql_run() { eval "$PSQL"' -X -q -v ON_ERROR_STOP=1 -At "$@"'; }

cleanup() {
  psql_run <<SQL >/dev/null 2>&1 || true
delete from auth.users where id = '$OWNER';
delete from public.releases where slug like '$TAG-%';
SQL
  rm -rf "$OUT"
}
trap cleanup EXIT

as_owner="select set_config('request.jwt.claims', '{\"sub\":\"$OWNER\",\"role\":\"authenticated\"}', true); set local role authenticated;"

psql_run <<SQL >/dev/null
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('$OWNER', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '$TAG@d1.test', jsonb_build_object('username', '$TAG'), now(), now());
insert into public.releases (slug, title, release_type_id, status)
select '$TAG-' || i, 'D1 concurrency ' || i, (select id from public.release_types where slug = 'album'), 'published'
from generate_series(1, $INSERTS + $MIXED_INSERTS) as i;
insert into public.crates (id, owner_id, name, slug, is_public) values ('$CRATE', '$OWNER', 'D1 concurrency', '$TAG', true);
SQL

release_id() { psql_run -c "select id from public.releases where slug = '$TAG-$1'"; }

insert_session() {
  local rid; rid=$(release_id "$1")
  psql_run <<SQL
begin;
$as_owner
insert into public.crate_items (crate_id, release_id, lanzamiento_slug) values ('$CRATE', '$rid', 'x');
select pg_sleep(random() * 0.2);
commit;
SQL
}

reorder_session() {
  psql_run <<SQL
begin;
$as_owner
select count(*) from public.reorder_crate_items('$CRATE',
  (select array_agg(id order by random()) from public.crate_items where crate_id = '$CRATE'));
select pg_sleep(random() * 0.2);
commit;
SQL
}

delete_session() {
  psql_run <<SQL
begin;
$as_owner
delete from public.crate_items where id = (
  select id from public.crate_items where crate_id = '$CRATE' order by random() limit 1);
select pg_sleep(random() * 0.2);
commit;
SQL
}

check_positions() {
  psql_run <<SQL
select count(*) || ' items, ' || count(distinct position) || ' distinct positions, min ' ||
  coalesce(min(position), -1) || ', max ' || coalesce(max(position), -1)
from public.crate_items where crate_id = '$CRATE';
SQL
}

duplicates() {
  psql_run -c "select count(*) from (select position from public.crate_items where crate_id = '$CRATE' group by position having count(*) > 1) d"
}

echo "Fase 1: $INSERTS altas simultáneas"
for i in $(seq 1 "$INSERTS"); do insert_session "$i" >"$OUT/insert-$i.log" 2>&1 & done
wait
phase1_errors=$(cat "$OUT"/insert-*.log | grep -ci 'error' || true)
echo "  errores: $phase1_errors"
echo "  $(check_positions)"

echo "Fase 2: $REORDERS reordenamientos + $MIXED_INSERTS altas + $MIXED_DELETES bajas simultáneas"
for i in $(seq 1 "$REORDERS"); do reorder_session >"$OUT/reorder-$i.log" 2>&1 & done
for i in $(seq 1 "$MIXED_INSERTS"); do insert_session $((INSERTS + i)) >"$OUT/mixed-insert-$i.log" 2>&1 & done
for i in $(seq 1 "$MIXED_DELETES"); do delete_session >"$OUT/mixed-delete-$i.log" 2>&1 & done
wait
reorder_ok=$( (grep -Li 'error' "$OUT"/reorder-*.log || true) | wc -l | tr -d ' ')
reorder_stale=$( (grep -l 'reload it before reordering' "$OUT"/reorder-*.log || true) | wc -l | tr -d ' ')
unexpected=$(cat "$OUT"/*.log | grep -i 'error' | grep -vc 'reload it before reordering' || true)
echo "  reordenamientos aplicados: $reorder_ok; rechazados por colección cambiada (40001): $reorder_stale"
echo "  errores inesperados: $unexpected"
echo "  $(check_positions)"
dups=$(duplicates)
echo "  posiciones duplicadas: $dups"

if [ "$phase1_errors" != "0" ] || [ "$unexpected" != "0" ] || [ "$dups" != "0" ] || [ "$reorder_ok" = "0" ]; then
  echo "D1 concurrency: FAIL"
  cat "$OUT"/*.log | grep -i 'error' | sort | uniq -c
  exit 1
fi
echo "D1 concurrency: OK"
