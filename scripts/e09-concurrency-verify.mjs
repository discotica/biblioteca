import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const env = await readFile('.env.local', 'utf8');
const connectionString = env.match(/^E06_STAGING_DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!connectionString?.includes('hgocyrzhgohetfpzbmfs')) throw new Error('E09 requires Biblioteca Staging.');
const payload = { version: 2, title: `E09 concurrency ${Date.now()}`, primary_artists: ['E09 Primary'], collaborators: [], release_type: 'ep', release_date: '2026-09-18', genres: ['E09 Genre'], countries: ['E09 Country'] };
const clients = [new Client({ connectionString }), new Client({ connectionString }), new Client({ connectionString })];
let contributionId;
try {
  await Promise.all(clients.map((client) => client.connect()));
  const author = (await clients[0].query(`select id from public.profiles where role='comunidad' order by id limit 1`)).rows[0]?.id;
  if (!author) throw new Error('No community fixture user exists in staging.');
  const claims = JSON.stringify({ sub: author, role: 'authenticated' });
  await clients[0].query(`select set_config('request.jwt.claims',$1,false)`, [claims]);
  contributionId = (await clients[0].query(`select * from public.create_contribution_draft($1,$2,$3,$4)`, ['https://example.test/e09-concurrency', 'manual', payload, {}])).rows[0].id;
  await Promise.all(clients.slice(1).map((client) => client.query(`select set_config('request.jwt.claims',$1,false)`, [claims])));
  const results = await Promise.all(clients.slice(1).map(async (client) => {
    try { await client.query(`select * from public.submit_contribution($1,$2,$3,$4,$5)`, [contributionId, 'https://example.test/e09-concurrency', 'manual', payload, {}]); return 'submitted'; }
    catch (error) { return error.code; }
  }));
  assert.equal(results.filter((result) => result === 'submitted').length, 1, JSON.stringify(results));
  assert.equal(results.filter((result) => result === '22023').length, 1, JSON.stringify(results));
  console.log(JSON.stringify({ contribution_id: contributionId, results, exactly_one_transition: true }));
} finally {
  if (contributionId) await clients[0].query(`delete from public.contributions where id=$1`, [contributionId]).catch(() => undefined);
  await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
}
