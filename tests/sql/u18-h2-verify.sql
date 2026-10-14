-- U18 (H2): límite de intentos de login-with-username.
-- Transaccional: crea sus filas, comprueba y termina con ROLLBACK.
--   docker exec -i supabase_db_<project_id> psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/u18-h2-verify.sql
-- Necesita la migración 20261014120000. Imprime "U18 H2 verify: OK" o aborta con "U18 H2 FAIL: …".
begin;

do $$
declare
  ip_a constant text := repeat('a', 64);
  ip_b constant text := repeat('b', 64);
  ip_c constant text := repeat('c', 64);
  v_id bigint;
  v_ids bigint[] := '{}';
  i integer;
  v_count integer;
begin
  -- Permisos -------------------------------------------------------------------
  if has_function_privilege('anon', 'public.begin_username_login(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.begin_username_login(text, text)', 'execute')
     or has_function_privilege('anon', 'public.finish_username_login(bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.finish_username_login(bigint)', 'execute') then
    raise exception 'U18 H2 FAIL: anon o authenticated pueden ejecutar las funciones';
  end if;
  if not has_function_privilege('service_role', 'public.begin_username_login(text, text)', 'execute')
     or not has_function_privilege('service_role', 'public.finish_username_login(bigint)', 'execute') then
    raise exception 'U18 H2 FAIL: service_role no puede ejecutar las funciones';
  end if;
  if has_table_privilege('anon', 'private.username_login_attempts', 'select')
     or has_table_privilege('authenticated', 'private.username_login_attempts', 'select')
     or has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'U18 H2 FAIL: la tabla es legible desde la API';
  end if;

  -- Entradas inválidas ---------------------------------------------------------
  begin
    perform public.begin_username_login('Mayúsculas', ip_a);
    raise exception 'U18 H2 FAIL: aceptó un usuario con formato imposible';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.begin_username_login('persona', '203.0.113.7');
    raise exception 'U18 H2 FAIL: aceptó una IP sin hash';
  exception when sqlstate '22023' then null;
  end;

  -- Por usuario: 5 intentos pasan, el 6.º no. Igual si el usuario no existe ----
  for i in 1..5 loop
    if public.begin_username_login('u18-objetivo', ip_a) is null then
      raise exception 'U18 H2 FAIL: el intento % del usuario quedó bloqueado antes de tiempo', i;
    end if;
  end loop;
  if public.begin_username_login('u18-objetivo', ip_b) is not null then
    raise exception 'U18 H2 FAIL: el 6.º intento contra el mismo usuario pasó (desde otra IP)';
  end if;
  if (select count(*) from private.username_login_attempts where username = 'u18-objetivo') <> 5 then
    raise exception 'U18 H2 FAIL: el intento bloqueado se anotó y alargaría el bloqueo';
  end if;
  if exists (select 1 from public.profiles where username = 'u18-objetivo') then
    raise exception 'U18 H2 FAIL: el fixture debía ser un usuario inexistente';
  end if;

  -- La ventana es de 15 minutos ------------------------------------------------
  update private.username_login_attempts set attempted_at = now() - interval '16 minutes'
  where username = 'u18-objetivo';
  if public.begin_username_login('u18-objetivo', ip_b) is null then
    raise exception 'U18 H2 FAIL: los fallos de hace más de 15 minutos siguen contando';
  end if;

  -- Por IP: 20 fallos contra usuarios distintos bloquean el 21.º ---------------
  for i in 1..20 loop
    if public.begin_username_login('u18-spray-' || i, ip_c) is null then
      raise exception 'U18 H2 FAIL: el intento % de la IP quedó bloqueado antes de tiempo', i;
    end if;
  end loop;
  if public.begin_username_login('u18-spray-otro', ip_c) is not null then
    raise exception 'U18 H2 FAIL: el 21.º intento desde la misma IP pasó';
  end if;
  if public.begin_username_login('u18-spray-otro', ip_a) is null then
    raise exception 'U18 H2 FAIL: el bloqueo de una IP alcanzó a otra';
  end if;

  -- Un acceso correcto reinicia la cuenta del usuario, no la de la IP -----------
  for i in 1..4 loop
    v_ids := v_ids || public.begin_username_login('u18-persona', ip_a);
  end loop;
  v_id := public.begin_username_login('u18-persona', ip_a);
  perform public.finish_username_login(v_id);
  select count(*) into v_count from private.username_login_attempts where username = 'u18-persona' and not succeeded;
  if v_count <> 0 then
    raise exception 'U18 H2 FAIL: tras entrar quedan % fallos del usuario', v_count;
  end if;
  if not exists (select 1 from private.username_login_attempts where id = v_id and succeeded) then
    raise exception 'U18 H2 FAIL: el acceso correcto no quedó anotado';
  end if;
  for i in 1..5 loop
    if public.begin_username_login('u18-persona', ip_a) is null then
      raise exception 'U18 H2 FAIL: tras entrar, el intento % volvió a bloquearse', i;
    end if;
  end loop;
  -- Terminar otra vez el mismo intento no borra los fallos nuevos.
  perform public.finish_username_login(v_id);
  if (select count(*) from private.username_login_attempts where username = 'u18-persona' and not succeeded) <> 5 then
    raise exception 'U18 H2 FAIL: repetir finish_username_login borró fallos posteriores';
  end if;

  -- Purga de filas de más de un día ----------------------------------------------
  update private.username_login_attempts set attempted_at = now() - interval '2 days'
  where username like 'u18-spray-%';
  perform public.begin_username_login('u18-purga', ip_b);
  if exists (select 1 from private.username_login_attempts where username like 'u18-spray-%') then
    raise exception 'U18 H2 FAIL: las filas de más de un día no se purgaron';
  end if;

  raise notice 'U18 H2 verify: OK';
end;
$$;

rollback;
