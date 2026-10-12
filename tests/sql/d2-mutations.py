"""D2: pruebas de mutación de tests/sql/d2-verify.sql.

Aplica cada defecto sobre la migración D2 dentro de una transacción, corre el
cuerpo de d2-verify.sql y revierte. Una mutación cuenta como detectada si la
verificación deja de imprimir "D2 verify: OK". No cambia la base.
  python3 tests/sql/d2-mutations.py
  D2_DB_CONTAINER=supabase_db_<project_id> python3 tests/sql/d2-mutations.py
"""
import os, subprocess, sys
CONTAINER = os.environ.get('D2_DB_CONTAINER', 'supabase_db_discotica')
mig = open('supabase/migrations/20261006200859_d2_studio_batch_and_quick_views.sql').read()
ver = open('tests/sql/d2-verify.sql').read()
body = ver.split('begin;', 1)[1].rsplit('rollback;', 1)[0]
M = {
 'M1 lote sin gate admin': ("""  if not (select private.is_admin()) then raise exception 'Administrative role required' using errcode = '42501'; end if;
  if p_operation is null""", "  if p_operation is null"),
 'M2 anon con EXECUTE del lote': ("to authenticated;\n", "to authenticated;\ngrant execute on function public.admin_batch_update_catalog_releases(text, jsonb, text) to anon;\n"),
 'M3 sin todo-o-nada': ("    if v_rejected > 0 then\n      raise exception 'Batch rejected' using errcode = 'D2B01';\n    end if;", ""),
 'M4 escritura directa sin E06': ("""          v_result := public.admin_update_catalog_release(v_id, v_expected,
            private.catalog_snapshot(v_id) - 'id' - 'catalog_version', p_reason, p_operation);""",
   """          update public.releases set status = v_target, catalog_version = catalog_version + 1 where id = v_id;
          v_result := jsonb_build_object('change_set_id', gen_random_uuid(), 'catalog_version', v_expected + 1);"""),
 'M5 portada http cuenta como válida': ("order by c.created_at limit 1), '') !~* '^https://' then 'cover'", "order by c.created_at limit 1), '') !~* '^https?://' then 'cover'"),
 'M6 reportes resueltos cuentan como abiertos': ("where pr.release_id = p_release_id and pr.status in ('new', 'triaged', 'in_progress');", "where pr.release_id = p_release_id;"),
 'M7 límite 100': ("c_max_items constant integer := 50;", "c_max_items constant integer := 100;"),
 'M8 sin batch_id en auditoría': ("          update private.catalog_change_sets set batch_id = v_batch\n          where id = (v_result->>'change_set_id')::uuid;\n", ""),
 'M9 sin control de versión en "sin cambios"': ("        if v_version <> v_expected then raise exception 'Catalog version conflict' using errcode = '40001'; end if;\n", ""),
 'M10 duplicados permitidos': ("  if cardinality(v_ids) <> jsonb_array_length(p_items) then", "  if false then"),
 'M11 vista rápida ignorada': ("      and (v_quick_view is null or case v_quick_view", "      and (true or case v_quick_view"),
 'M12 incompleto sin enlace principal': ("""    case when not exists (select 1 from public.release_links l
      where l.release_id = r.id and l.is_primary and l.url ~* '^https://'
        and btrim(l.provider) <> '') then 'primary_link' end""", "    null"),
 'M13 informe rejected->rolled_back mal': ("then jsonb_build_object('release_id', x->'release_id', 'expected_version', x->'expected_version', 'result', 'rolled_back')", "then x"),
}
pre = "begin;\ndrop function public.admin_list_catalog_releases(text, text[], uuid[], text[], integer, integer, text, text, text);\n"
ok = 0
for name, (a, b) in M.items():
    assert mig.count(a) >= 1, name
    sql = pre + mig.replace(a, b) + body + "\nrollback;\n"
    r = subprocess.run(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'], input=sql, capture_output=True, text=True)
    out = r.stdout + r.stderr
    caught = 'D2 verify: OK' not in out
    ok += caught
    line = next((l for l in out.splitlines() if 'D2 FAIL' in l or 'ERROR' in l), '(sin error)')
    print(('DETECTADA ' if caught else 'NO DETECTADA ') + name + ' :: ' + line[:150])
print(f'{ok}/{len(M)} mutaciones detectadas')
sys.exit(0 if ok == len(M) else 1)
