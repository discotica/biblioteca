-- Migración 20261108120000: la resolución de artistas y sellos también mira la clave guardada.
-- Control negativo: sin la migración, el primer ensure aborta con «Canonical artist conflict…».
-- Transaccional: crea sus filas con el prefijo «zzclave» y termina con ROLLBACK.
--   docker exec -i <contenedor> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/resolve-stored-key-verify.sql
-- Imprime "Clave guardada verify: OK (n comprobaciones)" o aborta con "CLAVE FAIL: …".
begin;

create temp table clave_checks (n serial, label text);

create function pg_temp.ok(p_condition boolean, p_label text) returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'CLAVE FAIL: %', p_label; end if;
  insert into clave_checks (label) values (p_label);
end $$;

do $$
declare
  v_artist uuid;
  v_label uuid;
  v_got uuid;
  v_count bigint;
begin
  insert into public.artists (name, normalized_name, slug)
  values ('Zzclaveř', 'zzclaver', 'zzclave-artista') returning id into v_artist;
  insert into public.labels (name, normalized_name, slug)
  values ('Zzclave´s', 'zzclaves', 'zzclave-sello') returning id into v_label;

  select count(*) into v_count from public.artists;
  v_got := private.ensure_catalog_artist('Zzclaver');
  perform pg_temp.ok(v_got = v_artist, 'un nombre igual a la clave guardada resuelve al artista existente');
  perform pg_temp.ok((select count(*) from public.artists) = v_count, 'no crea un artista nuevo');
  perform pg_temp.ok((select name from public.artists where id = v_artist) = 'Zzclaveř', 'el nombre del artista no cambia');
  perform pg_temp.ok(private.ensure_catalog_artist('Zzclaveř') = v_artist, 'el nombre exacto sigue resolviendo');

  select count(*) into v_count from public.labels;
  v_got := private.ensure_catalog_label('Zzclaves', 'verificación');
  perform pg_temp.ok(v_got = v_label, 'un nombre igual a la clave guardada resuelve al sello existente');
  perform pg_temp.ok((select count(*) from public.labels) = v_count, 'no crea un sello nuevo');
  perform pg_temp.ok((select name from public.labels where id = v_label) = 'Zzclave´s', 'el nombre del sello no cambia');

  select count(*) into v_count from public.labels;
  v_got := private.ensure_catalog_label('Zzclave_n', 'verificación');
  perform pg_temp.ok(v_got <> v_label and (select count(*) from public.labels) = v_count + 1, 'un sello con guion bajo y clave libre se crea aparte');
  perform pg_temp.ok((select name from public.labels where id = v_got) = 'Zzclave_n', 'y conserva su guion bajo');

  select count(*) into v_count from public.artists;
  v_got := private.ensure_catalog_artist('Zzclaveotro');
  perform pg_temp.ok(v_got <> v_artist and (select count(*) from public.artists) = v_count + 1, 'control: un nombre distinto crea su propio artista');

  perform pg_temp.ok(
    not has_function_privilege('anon', 'private.resolve_catalog_artist(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.resolve_catalog_artist(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.resolve_catalog_label(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.resolve_catalog_label(text)', 'EXECUTE'),
    'anon y authenticated siguen sin EXECUTE');
end $$;

select format('Clave guardada verify: OK (%s comprobaciones)', count(*)) as result from clave_checks;

rollback;
