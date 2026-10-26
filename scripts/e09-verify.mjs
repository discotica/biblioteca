import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const env = await readFile('.env.local', 'utf8');
const connectionString = process.env.E06_STAGING_DATABASE_URL ?? env.match(/^E06_STAGING_DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!connectionString?.includes('hgocyrzhgohetfpzbmfs')) throw new Error('E09 requires Biblioteca Staging.');

const payload = (suffix = '') => ({ version: 2, title: `E09 Fixture ${suffix}`, primary_artists: ['E09 Primary'], collaborators: ['E09 Collaborator'], release_type: 'ep', release_date: '2026-09-18', genres: ['Techno'], countries: ['Colombia'], label: 'E09 Label', team_note: 'fixture' });
let savepoint = 0;
const expect = async (fn, code) => {
  const name = `e09_expected_${++savepoint}`;
  await db.query(`savepoint ${name}`);
  try { await fn(); assert.fail(`Expected ${code}`); }
  catch (error) { assert.equal(error.code, code, error.message); }
  finally { await db.query(`rollback to savepoint ${name}`); await db.query(`release savepoint ${name}`); }
};

const db = new Client({ connectionString });
await db.connect();
const checks = [];
const ok = (name, value) => { assert.equal(value, true, name); checks.push(name); };
const as = async (id) => { await db.query('reset role'); await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]); await db.query('set local role authenticated'); };
const rpc = async (name, values) => (await db.query(`select * from public.${name}(${values.map((_, i) => `$${i + 1}`).join(', ')})`, values)).rows[0];

try {
  await db.query('begin');
  const people = (await db.query(`select id, role from public.profiles where role in ('admin','comunidad') order by role,id`)).rows;
  const admin = people.find((p) => p.role === 'admin')?.id;
  const community = people.filter((p) => p.role === 'comunidad').map((p) => p.id);
  if (!admin || community.length < 3) throw new Error('E09 fixtures need one admin and three community profiles');
  const [author, outsider, collaborator] = community;
  await db.query(`update public.profiles set role='colaborador' where id=$1`, [collaborator]);

  // Legacy is mapped but deliberately cannot become a v2 publication.
  const legacy = (await db.query(`select id,payload,payload_version,payload_quality from public.contributions where payload_version=1 limit 1`)).rows[0];
  ok('v1_mapped_to_explicit_groups_and_legacy_quality', legacy?.payload?.primary_artists?.length > 0 && legacy.payload?.collaborators?.length === 0 && legacy.payload_quality === 'legacy');
  await as(admin); await expect(() => rpc('review_contribution', [legacy.id, 'approved', null]), '22023');

  await as(author);
  const draft = await rpc('create_contribution_draft', ['https://example.test/e09', 'manual', payload('community'), { cover_url: 'https://example.test/e09.jpg' }]);
  ok('author_creates_and_reads_own_draft', draft.status === 'draft' && (await db.query('select id from public.contributions where id=$1', [draft.id])).rowCount === 1);
  ok('author_claim_matches_draft', (await db.query(`select auth.uid()::text as id`)).rows[0].id === author);
  ok('draft_row_is_still_draft', (await db.query(`select status from public.contributions where id=$1`, [draft.id])).rows[0].status === 'draft');
  const pending = await rpc('submit_contribution', [draft.id, 'https://example.test/e09', 'manual', payload('community'), { cover_url: 'https://example.test/e09.jpg' }]);
  ok('community_submission_derives_community_queue', pending.status === 'pending' && pending.queue_kind === 'community');
  await expect(() => db.query(`update public.contributions set status='approved' where id=$1`, [draft.id]), '42501');
  ok('raw_table_transition_is_denied', true);
  await expect(() => rpc('submit_contribution', [draft.id, 'https://example.test/e09', 'manual', payload('again'), {}]), '22023');

  await as(outsider); ok('foreign_contribution_hidden', (await db.query('select id from public.contributions where id=$1', [draft.id])).rowCount === 0);
  await expect(() => rpc('review_contribution', [draft.id, 'approved', null]), '42501');
  await db.query('reset role'); await db.query('set local role anon');
  await expect(() => db.query('select id from public.contributions where id=$1', [draft.id]), '42501');
  ok('anon_cannot_read_contribution', true);
  await expect(() => rpc('create_contribution_draft', ['https://example.test/anon', 'manual', {}, {}]), '42501');

  await as(collaborator); ok('collaborator_sees_only_community_pending_queue', (await db.query('select id from public.contributions where id=$1', [draft.id])).rowCount === 1);
  const ready = await rpc('prepare_contribution_for_admin', [draft.id, payload('working copy'), 'internal only']);
  ok('other_collaborator_prepares_without_publishing', ready.status === 'ready_for_admin' && ready.release_id === null);
  await expect(() => db.query('select * from private.contribution_preparations where contribution_id=$1', [draft.id]), '42501');
  const own = await rpc('create_contribution_draft', ['https://example.test/e09-own', 'manual', payload('own'), {}]);
  await rpc('submit_contribution', [own.id, 'https://example.test/e09-own', 'manual', payload('own'), {}]);
  await expect(() => rpc('prepare_contribution_for_admin', [own.id, {}, null]), '42501');

  await as(admin);
  const approved = await rpc('review_contribution', [draft.id, 'approved', null]);
  const release = (await db.query(`select r.id,rt.slug,(select count(*)::int from public.release_artists where release_id=r.id and role='primary') primary_count,(select count(*)::int from public.release_artists where release_id=r.id and role='collaborator') collaborator_count,(select count(*)::int from public.release_genres where release_id=r.id) genres,(select count(*)::int from public.release_countries where release_id=r.id) countries from public.releases r join public.release_types rt on rt.id=r.release_type_id where r.id=$1`, [approved.release_id])).rows[0];
  ok('admin_approval_is_transactional_and_creates_complete_relations', approved.status === 'approved' && release.slug === 'ep' && release.primary_count === 1 && release.collaborator_count === 1 && release.genres === 1 && release.countries === 1);

  await as(author);
  const changes = await rpc('create_contribution_draft', ['https://example.test/e09-changes', 'manual', payload('changes'), {}]);
  await rpc('submit_contribution', [changes.id, 'https://example.test/e09-changes', 'manual', payload('changes'), {}]);
  await as(admin); await rpc('review_contribution', [changes.id, 'changes_requested', 'Needs evidence']);
  await as(author); const resubmitted = await rpc('submit_contribution', [changes.id, 'https://example.test/e09-changes', 'manual', payload('changes fixed'), {}]);
  ok('requested_changes_returns_only_to_pending_by_author', resubmitted.status === 'pending');
  await as(admin); await expect(() => rpc('review_contribution', [resubmitted.id, 'rejected', null]), '22023');
  const rejected = await rpc('review_contribution', [resubmitted.id, 'rejected', 'Not enough evidence']);
  await as(author); await expect(() => rpc('submit_contribution', [rejected.id, 'https://example.test/e09-changes', 'manual', payload('terminal'), {}]), '22023');
  ok('terminal_statuses_do_not_reopen', rejected.status === 'rejected');

  // U19 (contrato v3): el borrador ya valida lo que trae; la portada editable es solo de admin.
  await expect(() => rpc('create_contribution_draft', ['https://example.test/e09-bad', 'manual', { ...payload('bad'), primary_artists: [''] }, {}]), '22023');
  await expect(() => rpc('create_contribution_draft', ['https://example.test/e09-bad', 'manual', { ...payload('bad'), cover_url: 'https://forbidden.test/cover.jpg' }, {}]), '42501');
  await expect(() => rpc('create_contribution_draft', ['https://example.test/e09-bad', 'manual', { ...payload('bad'), genres: ['E09 Genre'] }, {}]), '22023');
  ok('malformed_payload_unknown_or_editable_cover_cannot_submit', true);
  await db.query('rollback');
  console.log(JSON.stringify({ checks, count: checks.length, rolled_back: true }));
} catch (error) { await db.query('rollback').catch(() => undefined); throw error; }
finally { await db.end(); }
