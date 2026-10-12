import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const localEnv = await readFile('.env.local', 'utf8');
const connectionString = process.env.E06_STAGING_DATABASE_URL
  ?? localEnv.match(/^E06_STAGING_DATABASE_URL=(.+)$/m)?.[1]?.trim();

if (!connectionString) throw new Error('E06_STAGING_DATABASE_URL is required.');
if (!connectionString.includes('hgocyrzhgohetfpzbmfs')) {
  throw new Error('Refusing to run against a project other than Biblioteca Staging.');
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const reason = `E06 direct concurrency evidence ${suffix}`;
const clients = [new Client({ connectionString }), new Client({ connectionString })];

async function callBoth(functionName, name, idKey) {
  const results = await Promise.all(clients.map((client) => client.query(
    `select public.${functionName}($1, true, $2) as result`, [name, reason],
  ).then(({ rows }) => rows[0].result)));
  const ids = results.map((result) => result[idKey]);
  const created = results.filter((result) => result.created === true).length;
  const duplicates = results.filter((result) => result.duplicate === true).length;
  if (new Set(ids).size !== 1 || created !== 1 || duplicates !== 1) {
    throw new Error(`${functionName} did not return one canonical UUID (created=${created}, duplicate=${duplicates}).`);
  }
  return { id: ids[0], results };
}

try {
  await Promise.all(clients.map((client) => client.connect()));
  const { rows: admins } = await clients[0].query(
    `select id from public.profiles where role = 'admin' order by id limit 1`,
  );
  if (!admins[0]?.id) throw new Error('No staging admin profile is available.');
  const claims = JSON.stringify({ sub: admins[0].id, role: 'authenticated' });
  await Promise.all(clients.map((client) => client.query(
    `select set_config('request.jwt.claims', $1, false)`, [claims],
  )));

  const label = await callBoth('admin_create_catalog_label', `E06 Direct Label ${suffix}`, 'label_id');
  const genre = await callBoth('admin_create_catalog_genre', `E06 Direct Genre ${suffix}`, 'genre_id');
  const { rows: events } = await clients[0].query(`
    select entity_type, entity_id::text as entity_id, actor_id::text as actor_id,
      reason, before_state, after_state, result_version
    from private.catalog_dictionary_change_events
    where reason = $1
    order by entity_type
  `, [reason]);
  const expected = new Map([['label', label.id], ['genre', genre.id]]);
  if (events.length !== 2 || events.some((event) =>
    event.entity_id !== expected.get(event.entity_type)
    || event.actor_id !== admins[0].id
    || event.before_state !== null
    || event.result_version !== 1
    || event.after_state?.id !== event.entity_id,
  )) throw new Error('Dictionary audit evidence is incomplete.');

  console.log(JSON.stringify({
    project: 'hgocyrzhgohetfpzbmfs',
    label: { uuid: label.id, results: label.results.map(({ created, duplicate }) => ({ created, duplicate })) },
    genre: { uuid: genre.id, results: genre.results.map(({ created, duplicate }) => ({ created, duplicate })) },
    audit_events: events.length,
  }));
} finally {
  await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
}
