import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const migrationUrl = new URL(
  '../supabase/migrations/20260915204413_canonical_v2_credits_types_identity.sql',
  import.meta.url
);

async function expectSqlState(client, savepoint, expectedCode, callback) {
  await client.query(`savepoint ${savepoint}`);
  try {
    await callback();
    assert.fail(`Expected SQLSTATE ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode, error.message);
  } finally {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const migrationSql = await readFile(migrationUrl, 'utf8');
  const client = new Client({ connectionString });
  await client.connect();

  const checks = [];
  const record = (name, ok, detail = undefined) => {
    assert.equal(Boolean(ok), true, detail ? `${name}: ${JSON.stringify(detail)}` : name);
    checks.push(name);
  };

  const baseline = (await client.query(`
    select
      (select count(*)::int from public.releases) as releases,
      (select count(*)::int from public.release_artists) as release_artists,
      (select count(*)::int from public.release_types) as release_types,
      (select count(*)::int from public.release_slug_aliases) as aliases,
      (select count(*)::int from public.catalog_import_keys) as import_keys
  `)).rows[0];

  let rolledBack = false;
  try {
    await client.query('begin');

    const discoTypeId = (await client.query(`
      select id from public.release_types where normalized_name = 'disco'
    `)).rows[0]?.id;
    assert.ok(discoTypeId, 'The E01 fixture must still contain the legacy Disco type');

    const fixtureReleaseId = (await client.query(`
      insert into public.releases (slug, title, release_type_id, status)
      values ('e02-roles-fixture', 'E02 roles fixture', $1, 'published')
      returning id
    `, [discoTypeId])).rows[0].id;

    const artistRows = (await client.query(`
      insert into public.artists (name, normalized_name, slug)
      values
        ('E02 Primary A', 'e02 primary a', 'e02-primary-a'),
        ('E02 Featured B', 'e02 featured b', 'e02-featured-b'),
        ('E02 Remixer C', 'e02 remixer c', 'e02-remixer-c'),
        ('E02 Other D', 'e02 other d', 'e02-other-d'),
        ('E02 Multi E', 'e02 multi e', 'e02-multi-e')
      returning id, name
    `)).rows;
    const artistIds = Object.fromEntries(artistRows.map(({ id, name }) => [name, id]));

    await client.query(`
      insert into public.release_artists (release_id, artist_id, position, role)
      values
        ($1, $2, 0, 'primary'),
        ($1, $2, 0, 'featured'),
        ($1, $3, 1, 'featured'),
        ($1, $4, 0, 'remixer'),
        ($1, $5, 0, 'other'),
        ($1, $6, 2, 'remixer'),
        ($1, $6, 1, 'other')
    `, [
      fixtureReleaseId,
      artistIds['E02 Primary A'],
      artistIds['E02 Featured B'],
      artistIds['E02 Remixer C'],
      artistIds['E02 Other D'],
      artistIds['E02 Multi E']
    ]);

    await client.query(migrationSql);

    const immediate = (await client.query(`
      select
        (select count(*)::int from public.releases) as releases,
        (select count(*)::int from public.release_types) as release_types,
        (select count(*)::int from public.release_artists where release_id = $1) as fixture_credits,
        (select count(*)::int from public.releases where credit_quality = 'legacy') as legacy_quality
    `, [fixtureReleaseId])).rows[0];
    record('migration_preserves_release_count', immediate.releases === baseline.releases + 1, immediate);
    record('migration_seeds_exactly_five_types', immediate.release_types === 5, immediate);
    record('credit_duplicates_collapse_without_losing_people', immediate.fixture_credits === 5, immediate);
    record('existing_releases_receive_explicit_legacy_quality', immediate.legacy_quality === baseline.releases + 1, immediate);

    const canonicalTypes = (await client.query(`
      select name, normalized_name, slug from public.release_types order by slug
    `)).rows;
    assert.deepEqual(canonicalTypes, [
      { name: 'Álbum', normalized_name: 'album', slug: 'album' },
      { name: 'Compilado', normalized_name: 'compilado', slug: 'compilado' },
      { name: 'EP', normalized_name: 'ep', slug: 'ep' },
      { name: 'Sample Pack', normalized_name: 'sample pack', slug: 'sample-pack' },
      { name: 'Single', normalized_name: 'single', slug: 'single' }
    ]);
    record('canonical_type_dictionary_is_exact', true);

    const fixtureType = (await client.query(`
      select r.id, rt.name, rt.slug
      from public.releases r
      join public.release_types rt on rt.id = r.release_type_id
      where r.id = $1
    `, [fixtureReleaseId])).rows[0];
    record(
      'disco_normalizes_to_album_without_recreating_release',
      fixtureType.id === fixtureReleaseId && fixtureType.name === 'Álbum' && fixtureType.slug === 'album',
      fixtureType
    );

    const credits = (await client.query(`
      select a.name, ra.role, ra.position
      from public.release_artists ra
      join public.artists a on a.id = ra.artist_id
      where ra.release_id = $1
      order by ra.role desc, ra.position
    `, [fixtureReleaseId])).rows;
    assert.deepEqual(credits, [
      { name: 'E02 Primary A', role: 'primary', position: 0 },
      { name: 'E02 Remixer C', role: 'collaborator', position: 0 },
      { name: 'E02 Other D', role: 'collaborator', position: 1 },
      { name: 'E02 Featured B', role: 'collaborator', position: 2 },
      { name: 'E02 Multi E', role: 'collaborator', position: 3 }
    ]);
    record('legacy_roles_convert_with_independent_order', true);

    const migrationEvidence = (await client.query(`
      select resolution, count(*)::int as rows
      from private.release_credit_migration_log
      where release_id = $1
      group by resolution
      order by resolution
    `, [fixtureReleaseId])).rows;
    assert.deepEqual(migrationEvidence, [
      { resolution: 'duplicate_collaborator_roles_collapsed', rows: 2 },
      { resolution: 'primary_prevailed', rows: 2 },
      { resolution: 'role_mapped', rows: 3 }
    ]);
    record('credit_collision_decisions_are_traceable', true);

    const catalogView = (await client.query(`
      select artists, primary_artists, collaborators, credit_quality
      from public.catalog_releases where id = $1
    `, [fixtureReleaseId])).rows[0];
    assert.deepEqual(catalogView.artists, ['E02 Primary A']);
    assert.deepEqual(catalogView.primary_artists.map((artist) => artist.name), ['E02 Primary A']);
    assert.deepEqual(
      catalogView.collaborators.map((artist) => [artist.name, artist.position]),
      [
        ['E02 Remixer C', 0],
        ['E02 Other D', 1],
        ['E02 Featured B', 2],
        ['E02 Multi E', 3]
      ]
    );
    record('view_exposes_v2_groups_and_legacy_artists', catalogView.credit_quality === 'legacy');

    const importPayload = {
      source_name: 'e02-test',
      source_key: 'stable-001',
      source_hash: 'a'.repeat(64),
      slug: 'e02-imported--stable',
      legacy_slug: 'e02-imported',
      title: 'E02 imported',
      release_date: '2026-09-15',
      type: 'Disco',
      label: 'E02 label',
      label_key: 'e02 label',
      label_slug: 'e02-label',
      review: '',
      status: 'published',
      credit_quality: 'legacy',
      primary_artists: [
        { name: 'E02 Import Primary', key: 'e02 import primary', slug: 'e02-import-primary' }
      ],
      collaborators: [
        { name: 'E02 Import Collaborator', key: 'e02 import collaborator', slug: 'e02-import-collaborator' }
      ],
      genres: [],
      countries: [],
      radar: { experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5 },
      buy_link: '',
      provider: 'manual',
      cover: ''
    };

    const firstImport = (await client.query(
      'select * from private.import_catalog_release($1::jsonb)',
      [JSON.stringify(importPayload)]
    )).rows[0];
    const secondPayload = {
      ...importPayload,
      slug: 'e02-imported-changed--stable',
      title: 'E02 imported updated',
      type: 'Album',
      source_hash: 'b'.repeat(64)
    };
    const secondImport = (await client.query(
      'select * from private.import_catalog_release($1::jsonb)',
      [JSON.stringify(secondPayload)]
    )).rows[0];
    const imported = (await client.query(`
      select r.id, r.slug, r.title, rt.name as type,
        (select count(*)::int from public.catalog_import_keys where source_name = 'e02-test' and source_key = 'stable-001') as keys,
        (select count(*)::int from public.release_artists where release_id = r.id) as credits
      from public.releases r
      join public.release_types rt on rt.id = r.release_type_id
      where r.id = $1
    `, [firstImport.imported_release_id])).rows[0];
    record(
      'import_twice_preserves_release_identity',
      firstImport.action === 'created'
        && secondImport.action === 'updated'
        && firstImport.imported_release_id === secondImport.imported_release_id
        && imported.slug === 'e02-imported--stable'
        && imported.title === 'E02 imported updated'
        && imported.type === 'Álbum'
        && imported.keys === 1
        && imported.credits === 2,
      { firstImport, secondImport, imported }
    );

    await expectSqlState(client, 'invalid_type_dictionary', '23514', () => client.query(`
      insert into public.release_types (name, normalized_name, slug)
      values ('Mixtape', 'mixtape', 'mixtape')
    `));
    await expectSqlState(client, 'invalid_type_import', '22023', () => client.query(
      'select * from private.import_catalog_release($1::jsonb)',
      [JSON.stringify({ ...importPayload, source_key: 'invalid-type', type: 'Mixtape' })]
    ));
    record('invalid_types_are_rejected_by_table_and_import', true);

    const secondReleaseId = (await client.query(`
      insert into public.releases (slug, title, release_type_id, status)
      select 'e02-alias-target', 'E02 alias target', id, 'published'
      from public.release_types where slug = 'ep'
      returning id
    `)).rows[0].id;
    const draftReleaseId = (await client.query(`
      insert into public.releases (slug, title, release_type_id, status)
      select 'e02-draft', 'E02 draft', id, 'draft'
      from public.release_types where slug = 'single'
      returning id
    `)).rows[0].id;

    await client.query(`
      insert into public.release_slug_aliases (slug, release_id, source_name, is_legacy, alias_kind)
      values
        ('e02-roles-fixture', $1, 'e02-test', true, 'migration'),
        ('e02-ambiguous', $1, 'e02-test', true, 'migration'),
        ('e02-ambiguous', $2, 'e02-test', true, 'migration'),
        ('e02-draft-alias', $3, 'e02-test', true, 'migration')
    `, [secondReleaseId, fixtureReleaseId, draftReleaseId]);

    await client.query('savepoint anon_reads');
    await client.query('set local role anon');
    const canonicalWins = (await client.query(
      "select * from public.resolve_release_slug('e02-roles-fixture')"
    )).rows;
    const ambiguous = (await client.query(
      "select * from public.resolve_release_slug('e02-ambiguous')"
    )).rows;
    const hiddenDraft = (await client.query(`
      select
        (select count(*)::int from public.releases where id = $1) as direct_rows,
        (select count(*)::int from public.catalog_releases where id = $1) as view_rows,
        (select count(*)::int from public.resolve_release_slug('e02-draft-alias')) as resolver_rows
    `, [draftReleaseId])).rows[0];
    await client.query('rollback to savepoint anon_reads');
    await client.query('release savepoint anon_reads');

    record(
      'canonical_slug_wins_over_colliding_alias',
      canonicalWins.length === 1
        && canonicalWins[0].release_id === fixtureReleaseId
        && canonicalWins[0].match_kind === 'canonical',
      canonicalWins
    );
    record('ambiguous_alias_is_not_guessed', ambiguous.length === 0, ambiguous);
    record(
      'anonymous_reads_only_published_rows',
      hiddenDraft.direct_rows === 0 && hiddenDraft.view_rows === 0 && hiddenDraft.resolver_rows === 0,
      hiddenDraft
    );

    await expectSqlState(client, 'anon_write', '42501', async () => {
      await client.query('set local role anon');
      await client.query(`
        insert into public.releases (slug, title, status)
        values ('e02-anon-write', 'Denied', 'draft')
      `);
    });
    record('anonymous_catalog_write_is_denied', true);

    const security = (await client.query(`
      select
        (select reloptions @> array['security_invoker=true']
          from pg_class where oid = 'public.catalog_releases'::regclass) as security_invoker,
        not has_table_privilege('anon', 'private.release_credit_migration_log', 'select') as anon_log_denied,
        not has_table_privilege('authenticated', 'private.release_type_migration_log', 'select') as auth_log_denied,
        (select relrowsecurity from pg_class where oid = 'private.release_credit_migration_log'::regclass) as credit_log_rls,
        (select relrowsecurity from pg_class where oid = 'private.release_type_migration_log'::regclass) as type_log_rls
    `)).rows[0];
    record(
      'security_invoker_rls_and_private_audit_denials_hold',
      Object.values(security).every(Boolean),
      security
    );

    await client.query('rollback');
    rolledBack = true;
  } catch (error) {
    if (!rolledBack) await client.query('rollback');
    throw error;
  }

  const afterRollback = (await client.query(`
    select
      (select count(*)::int from public.releases) as releases,
      (select count(*)::int from public.release_artists) as release_artists,
      (select count(*)::int from public.release_types) as release_types,
      (select count(*)::int from public.release_slug_aliases) as aliases,
      (select count(*)::int from public.catalog_import_keys) as import_keys,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'releases' and column_name = 'credit_quality'
      ) as migration_column_remains
  `)).rows[0];
  record(
    'transactional_rollback_restores_pre_e02_schema_and_counts',
    afterRollback.releases === baseline.releases
      && afterRollback.release_artists === baseline.release_artists
      && afterRollback.release_types === baseline.release_types
      && afterRollback.aliases === baseline.aliases
      && afterRollback.import_keys === baseline.import_keys
      && afterRollback.migration_column_remains === false,
    { baseline, afterRollback }
  );

  await client.end();
  console.log(JSON.stringify({ ok: true, checks: checks.length, baseline, afterRollback }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, code: error.code ?? null }, null, 2));
  process.exitCode = 1;
});
