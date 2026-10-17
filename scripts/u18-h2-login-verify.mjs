// U18 (H2): login-with-username de punta a punta contra un Supabase local con edge-runtime.
// Solo local: rechaza URLs que no sean 127.0.0.1/localhost. Crea una cuenta de prueba y la borra.
//   U18_API_URL=http://127.0.0.1:54421 U18_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
//   U18_ANON_KEY=<ANON_KEY> U18_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> node scripts/u18-h2-login-verify.mjs
// (valores de `supabase status --workdir <dir> -o env`; la función compara el apikey con SUPABASE_ANON_KEY,
// que en local es la clave anon JWT, no la publicable).
import assert from 'node:assert/strict';
import { Client } from 'pg';

const { U18_API_URL: api, U18_DB_URL: dbUrl, U18_ANON_KEY: anonKey, U18_SERVICE_ROLE_KEY: serviceKey } = process.env;
if (!api || !dbUrl || !anonKey || !serviceKey) throw new Error('Faltan U18_API_URL, U18_DB_URL, U18_ANON_KEY o U18_SERVICE_ROLE_KEY.');
for (const url of [api, dbUrl]) {
  if (!/@?(127\.0\.0\.1|localhost):\d+/.test(url)) throw new Error(`Solo local: ${url}`);
}

const FLOOR_MS = 1200;
const PASSWORD = 'u18-contraseña-correcta';
const username = `u18h2-${Date.now().toString(36)}`;
const db = new Client({ connectionString: dbUrl });
let userId;

async function login(user, password, ip) {
  const started = performance.now();
  const response = await fetch(`${api}/functions/v1/login-with-username`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) },
    body: JSON.stringify({ username: user, password })
  });
  const body = await response.json();
  return { status: response.status, body, ms: performance.now() - started };
}
const reset = () => db.query('delete from private.username_login_attempts');
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = {};

try {
  await db.connect();
  const created = await fetch(`${api}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${username}@example.test`, password: PASSWORD, email_confirm: true, user_metadata: { username } })
  });
  assert.equal(created.status, 200, await created.clone().text());
  userId = (await created.json()).id;
  await db.query('update public.profiles set username = $1 where id = $2', [username, userId]);
  await reset();

  // 1. Acceso correcto: tokens, intento marcado como correcto.
  const ok = await login(username, PASSWORD, '203.0.113.1');
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.access_token && ok.body.refresh_token);
  assert.deepEqual((await db.query('select succeeded from private.username_login_attempts')).rows, [{ succeeded: true }]);
  results.success = { status: ok.status, ms: Math.round(ok.ms) };

  // 2. Tiempo: inexistente y contraseña incorrecta tardan lo mismo (el piso).
  //    Cada par usa una IP propia y se limpia la tabla para no tocar los límites.
  const missing = [], wrong = [];
  for (let i = 0; i < 6; i += 1) {
    await reset();
    missing.push((await login(`u18h2-nadie-${i}`, 'una-contraseña-mala', `203.0.113.${10 + i}`)).ms);
    wrong.push((await login(username, 'una-contraseña-mala', `203.0.113.${20 + i}`)).ms);
  }
  const tokenStarted = performance.now();
  await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${username}@example.test`, password: 'una-contraseña-mala' })
  });
  results.timing = {
    missing_median_ms: Math.round(median(missing)),
    wrong_median_ms: Math.round(median(wrong)),
    token_wrong_password_ms: Math.round(performance.now() - tokenStarted)
  };
  assert.ok(Math.min(...missing, ...wrong) >= FLOOR_MS - 5, JSON.stringify(results.timing));
  assert.ok(Math.abs(median(missing) - median(wrong)) < 100, JSON.stringify(results.timing));

  // 3. Por usuario: 5 fallos y el 6.º es 429 aunque la contraseña sea la buena.
  await reset();
  for (let i = 0; i < 5; i += 1) assert.equal((await login(username, 'una-contraseña-mala', `198.51.100.${i}`)).status, 401);
  const lockedOut = await login(username, PASSWORD, '198.51.100.99');
  assert.equal(lockedOut.status, 429);
  assert.ok(lockedOut.ms < FLOOR_MS, 'el bloqueo responde sin consultar la cuenta');
  //    Un usuario inexistente se bloquea igual.
  for (let i = 0; i < 5; i += 1) assert.equal((await login('u18h2-fantasma', 'una-contraseña-mala', `198.51.100.${i}`)).status, 401);
  assert.equal((await login('u18h2-fantasma', 'una-contraseña-mala', '198.51.100.98')).status, 429);
  results.user_limit = 'ok (real e inexistente)';

  // 4. Por IP: 20 fallos contra usuarios distintos y el 21.º es 429; otra IP sigue entrando.
  await reset();
  const sprayIp = '192.0.2.50';
  const spray = await Promise.all(Array.from({ length: 20 }, (_, i) => login(`u18h2-spray-${i}`, 'una-contraseña-mala', sprayIp)));
  assert.deepEqual([...new Set(spray.map((r) => r.status))], [401]);
  assert.equal((await login(username, PASSWORD, sprayIp)).status, 429);
  assert.equal((await login(username, PASSWORD, '192.0.2.51')).status, 200);
  results.ip_limit = 'ok';

  // 5. Ráfaga simultánea contra un usuario: exactamente 5 llegan a comprobar la contraseña.
  await reset();
  const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => login(username, 'una-contraseña-mala', `192.0.2.${100 + i}`)));
  const statuses = burst.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 401).length, 5, JSON.stringify(statuses));
  assert.equal(statuses.filter((s) => s === 429).length, 7, JSON.stringify(statuses));
  results.burst = { '401': 5, '429': 7 };

  // 6. Un acceso correcto reinicia la cuenta del usuario.
  await reset();
  for (let i = 0; i < 4; i += 1) assert.equal((await login(username, 'una-contraseña-mala', '192.0.2.200')).status, 401);
  assert.equal((await login(username, PASSWORD, '192.0.2.200')).status, 200);
  for (let i = 0; i < 4; i += 1) assert.equal((await login(username, 'una-contraseña-mala', '192.0.2.201')).status, 401);
  assert.equal((await login(username, PASSWORD, '192.0.2.201')).status, 200);
  results.success_resets = 'ok';

  // 7. La tabla no guarda IPs en claro.
  const stored = (await db.query('select ip_hash from private.username_login_attempts')).rows;
  assert.ok(stored.length > 0 && stored.every((r) => /^[0-9a-f]{64}$/.test(r.ip_hash)));
  results.ip_hashed = 'ok';

  console.log(JSON.stringify(results, null, 2));
  console.log('U18 H2 login verify: OK');
} finally {
  await db.query('delete from private.username_login_attempts').catch(() => undefined);
  if (userId) {
    await fetch(`${api}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
    }).catch(() => undefined);
  }
  await db.end().catch(() => undefined);
}
