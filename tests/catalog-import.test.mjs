import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportPayloads, canonicalReleaseType, importOptions, presentSourceKeys } from '../scripts/import-catalog.mjs';

const tsv = `artist\ttitle\ttype\tcountry\tgenre\tlabel\trelease_date\tbuy_link\treview\texperimental\tdenso\tsintético\tbailable\trápido\tcover\tcatalog_key
Árbol, Invitada\tRitmo Norte\tEP\tColombia\tElectro, House\tSello Uno\t09/08/2026\thttps://example.org/release\tNota\t1\t2\t3\t4\t5\thttps://example.org/cover.jpg\trel-001`;

test('normaliza una fila TSV a un contrato de importación estable', () => {
  const result = buildImportPayloads(tsv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.payloads.length, 1);
  assert.equal(result.payloads[0].release_date, '2026-08-09');
  assert.equal(result.payloads[0].primary_artists[0].key, 'arbol');
  assert.deepEqual(result.payloads[0].collaborators, []);
  assert.equal(result.payloads[0].credit_quality, 'legacy');
  assert.equal(result.payloads[0].radar.sintetico, 3);
  assert.match(result.payloads[0].slug, /^ritmo-norte-arbol--[a-f0-9]{8}$/);
});

test('exige una clave estable salvo en la primera carga explícita', () => {
  const withoutKey = tsv.replace('\tcatalog_key', '').replace('\trel-001', '');
  assert.equal(buildImportPayloads(withoutKey).errors.length, 1);
  const result = buildImportPayloads(withoutKey, { allowDerivedKeys: true });
  assert.equal(result.errors.length, 0);
  assert.equal(result.derivedKeys, 1);
});

test('reporta URLs inválidas sin convertirlas en inserciones públicas', () => {
  const result = buildImportPayloads(tsv.replace('https://example.org/release', 'nota-url'));
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.payloads[0].buy_link, '');
});

test('separa las filas inválidas para conservarlas como rechazo', () => {
  const result = buildImportPayloads(tsv.replace('Ritmo Norte', ''));
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].issues.length, 1);
  assert.equal(result.entries[0].rawPayload.title, '');
});

test('deduplica relaciones de artistas, pero conserva el TSV crudo', () => {
  const result = buildImportPayloads(tsv.replace('Árbol, Invitada', 'Árbol, Árbol'));
  assert.equal(result.errors.length, 0);
  assert.equal(result.payloads[0].primary_artists.length, 1);
  assert.equal(result.entries[0].rawPayload.artist, 'Árbol, Árbol');
  assert.equal(result.warnings.at(-1).field, 'artist');
});

test('normaliza Disco, Album y Álbum al único tipo canónico sin alterar la fuente cruda', () => {
  for (const legacyValue of ['Disco', 'Album', 'Álbum']) {
    const result = buildImportPayloads(tsv.replace('\tEP\t', `\t${legacyValue}\t`));
    assert.equal(result.errors.length, 0);
    assert.equal(result.payloads[0].type, 'Álbum');
    assert.equal(result.payloads[0].type_key, 'album');
    assert.equal(result.payloads[0].type_slug, 'album');
    assert.equal(result.entries[0].rawPayload.type, legacyValue);
  }
});

test('acepta exactamente los cinco tipos publicables y rechaza texto arbitrario', () => {
  const expected = ['Álbum', 'EP', 'Single', 'Compilado', 'Sample Pack'];
  assert.deepEqual(expected.map((value) => canonicalReleaseType(value)?.name), expected);

  const invalid = buildImportPayloads(tsv.replace('\tEP\t', '\tMixtape\t'));
  assert.equal(invalid.entries[0].issues.length, 1);
  assert.equal(invalid.entries[0].issues[0].field, 'type');
  assert.match(invalid.entries[0].issues[0].message, /tipo inválido/);
});

test('rechaza a la misma persona en principales y colaboradores sin inferir una decisión editorial', () => {
  const withCollaborator = tsv
    .replace('\tcover\tcatalog_key', '\tcover\tcollaborator\tcatalog_key')
    .replace('\trel-001', '\tÁrbol\trel-001');
  const result = buildImportPayloads(withCollaborator);
  assert.equal(result.entries[0].issues.length, 1);
  assert.equal(result.entries[0].issues[0].field, 'collaborator');
});

test('solo las filas válidas cuentan como presentes al archivar las claves ausentes', () => {
  const twoRows = `${tsv}\n${tsv.split('\n')[1].replace('Ritmo Norte', '').replace('rel-001', 'rel-002')}`;
  const result = buildImportPayloads(twoRows);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(presentSourceKeys(result), ['rel-001']);
});

test('archivar las claves ausentes es explícito, con un tope y nunca con claves derivadas', () => {
  const defaults = importOptions(['--input', 'hoja.tsv']);
  assert.equal(defaults.archiveMissing, false);
  assert.equal(defaults.pruneDictionaries, false);
  assert.equal(defaults.rollback, false);
  assert.equal(defaults.maxArchive, 25);

  const replace = importOptions(['--input', 'hoja.tsv', '--archive-missing', '--max-archive', '10', '--prune-dictionaries', '--rollback']);
  assert.equal(replace.archiveMissing, true);
  assert.equal(replace.maxArchive, 10);
  assert.equal(replace.pruneDictionaries, true);
  assert.equal(replace.rollback, true);

  assert.throws(() => importOptions(['--archive-missing', '--allow-derived-keys']), /--allow-derived-keys/);
  assert.throws(() => importOptions(['--archive-missing', '--max-archive', 'muchos']), /--max-archive/);
  assert.throws(() => importOptions(['--max-archive', '-1']), /--max-archive/);
});
