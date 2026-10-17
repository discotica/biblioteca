-- U18 (H2): límite de intentos propio de login-with-username.
-- La función llamaba a /auth/v1/token desde el servidor sin contar nada: el único límite era el
-- de Auth por IP, aplicado a la IP del runtime (compartida por todas las personas que entran con
-- usuario). Ahora cada intento pasa antes por begin_username_login:
--   * por usuario: 5 fallos en 15 minutos bloquean ese usuario, exista o no (si solo se
--     bloquearan los que existen, el bloqueo los delataría);
--   * por IP de quien llama: 20 fallos en 15 minutos, contra cualquier usuario;
--   * el intento se anota como fallo al empezar: una ráfaga simultánea no pasa la cuenta antes de
--     que se anote ninguno. Un acceso correcto lo marca y borra los fallos de ese usuario;
--   * la IP llega como HMAC (la calcula la función): la tabla nunca guarda IPs en claro;
--   * las filas de más de un día se borran en cada llamada.
-- Solo service_role ejecuta las funciones; la tabla vive en private, sin acceso desde la API.
-- Rollback: drop de las dos funciones y de la tabla (no hay datos que conservar).

create table private.username_login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index username_login_attempts_username_idx
  on private.username_login_attempts (username, attempted_at) where not succeeded;
create index username_login_attempts_ip_idx
  on private.username_login_attempts (ip_hash, attempted_at) where not succeeded;
create index username_login_attempts_attempted_at_idx
  on private.username_login_attempts (attempted_at);

alter table private.username_login_attempts enable row level security;
revoke all on table private.username_login_attempts from public, anon, authenticated;

-- Devuelve el id del intento, o null si el usuario o la IP superan el límite.
create function public.begin_username_login(p_username text, p_ip_hash text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_window constant interval := interval '15 minutes';
  v_id bigint;
begin
  if p_username is null or p_username !~ '^[a-z0-9_-]{3,30}$'
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid login attempt' using errcode = '22023';
  end if;

  -- Siempre IP y después usuario: el orden fijo evita bloqueos mutuos entre intentos.
  perform pg_advisory_xact_lock(hashtextextended('username-login:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('username-login:user:' || p_username, 0));

  delete from private.username_login_attempts where attempted_at < now() - interval '1 day';

  if (select count(*) from private.username_login_attempts
      where username = p_username and not succeeded and attempted_at > now() - v_window) >= 5
     or (select count(*) from private.username_login_attempts
      where ip_hash = p_ip_hash and not succeeded and attempted_at > now() - v_window) >= 20 then
    return null;
  end if;

  insert into private.username_login_attempts (username, ip_hash)
  values (p_username, p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- Un acceso correcto reinicia la cuenta de ese usuario. La de la IP baja solo por sus filas.
create function public.finish_username_login(p_attempt_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_username text;
begin
  update private.username_login_attempts set succeeded = true
  where id = p_attempt_id and not succeeded
  returning username into v_username;
  if v_username is not null then
    delete from private.username_login_attempts
    where username = v_username and not succeeded;
  end if;
end;
$$;

revoke all on function
  public.begin_username_login(text, text),
  public.finish_username_login(bigint)
from public, anon, authenticated;
grant execute on function
  public.begin_username_login(text, text),
  public.finish_username_login(bigint)
to service_role;
