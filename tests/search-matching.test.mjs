import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCanonicalRelease } from '../src/lib/domain/releases.ts';
import { evaluateReleaseMatch, matchReleases, normalizeSearchText } from '../src/lib/domain/searchMatching.ts';

function release(id, overrides = {}) {
  return adaptCanonicalRelease({ id, slug: `release-${id}`, title: 'Base', release_date: '2026-01-01', type: 'EP', label: 'Sello', artists: [], primary_artists: [], collaborators: [], credit_quality: 'verified', genres: [], countries: [], buy_link: '', cover: '', experimental: 3, denso: 3, sintetico: 3, bailable: 3, rapido: 3, ...overrides });
}

const fixture = [
  release('exact', { title: 'Reggaetón Solar', release_date: '2026-03-01', primary_artists: [{ id: 'julio-id', slug: 'julio-victoria', name: 'Julio Victoria', position: 0 }], genres: ['Reggaetón'], countries: ['Colombia'] }),
  release('artist-only', { title: 'Ambiental', primary_artists: [{ id: 'julio-id', slug: 'julio-victoria', name: 'Julio Victoria', position: 0 }], genres: ['Ambient'] }),
  release('genre-only', { title: 'Perreo', primary_artists: [{ id: 'other', slug: 'otra', name: 'Otra', position: 0 }], genres: ['Reggaetón'] }),
  release('none', { title: 'Noise', genres: ['Noise'] })
];

test('normalización cubre Unicode, acentos, ñ, puntuación y transliteraciones explícitas', () => {
  assert.equal(normalizeSearchText('  Niño: BØRk, Łódź & Straße! '), 'nino bork lodz strasse');
  assert.equal(normalizeSearchText('Æther / œuvre'), 'aether oeuvre');
});

test('entidad de artista usa id/slug exactos y texto libre aplica exacto, prefijo y contiene', () => {
  const entity = evaluateReleaseMatch(fixture[0], { text: [{ kind: 'artist', slug: 'julio-victoria' }] });
  assert.equal(entity.categories.text.kinds[0], 'exact');
  assert.equal(evaluateReleaseMatch(fixture[0], { text: ['julio'] }).categories.text.kinds[0], 'prefix');
  assert.equal(evaluateReleaseMatch(fixture[0], { text: ['ctoria'] }).categories.text.kinds[0], 'contains');
  assert.equal(evaluateReleaseMatch(fixture[0], { text: [{ kind: 'artist', slug: 'julio' }] }).eligible, false);
});

test('Julio Victoria + reggaetón conserva exacto, parciales y descarta cero coincidencias', () => {
  const result = matchReleases(fixture, { text: [{ kind: 'artist', slug: 'julio-victoria' }], genres: ['Reggaetón'], order: 'match' });
  assert.deepEqual(result.matches.map((match) => match.release.id), ['exact', 'artist-only', 'genre-only']);
  assert.deepEqual(result.exact.map((match) => match.release.id), ['exact']);
  assert.deepEqual(result.approximate.map((match) => match.release.id), ['artist-only', 'genre-only']);
});

test('varios géneros requieren todos para exactitud y una fracción mayor gana lexicográficamente', () => {
  const one = release('one', { genres: ['Ambient'] });
  const both = release('both', { genres: ['Ambient', 'Dub'] });
  const result = matchReleases([one, both], { genres: ['Ambient', 'Dub'] });
  assert.deepEqual(result.matches.map((match) => match.release.id), ['both', 'one']);
  assert.equal(result.matches[1].group, 'approximate');
});

test('texto tiene prioridad lexicográfica sobre muchas señales inferiores', () => {
  const text = release('text', { title: 'Ritual', genres: [], countries: [], releaseType: undefined });
  const lower = release('lower', { title: 'Nada', genres: ['Ambient'], countries: ['Colombia'], type: 'EP', release_date: '2026-01-01' });
  const result = matchReleases([lower, text], { text: ['ritual'], genres: ['Ambient'], countries: ['Colombia'], type: 'EP', year: '2026' });
  assert.equal(result.matches[0].release.id, 'text');
});

test('Radar acepta exacto y ±1, excluye ±2 sin ensanchar y puede quedar vacío', () => {
  const exact = release('radar-exact', { experimental: 3 });
  const near = release('radar-near', { experimental: 4 });
  const far = release('radar-far', { experimental: 5 });
  const result = matchReleases([far, near, exact], { radar: { experimental: 3 }, order: 'radar' });
  assert.deepEqual(result.matches.map((match) => match.release.id), ['radar-exact', 'radar-near']);
  assert.equal(evaluateReleaseMatch(far, { radar: { experimental: 3 } }).eligible, false);
  assert.equal(matchReleases([far], { radar: { experimental: 3 } }).matches.length, 0);
});

test('orden explícito mantiene grupos, y empates usan fecha e identidad estables', () => {
  const approximate = release('a', { title: 'No', release_date: '2026-03-01' });
  const exactLater = release('z', { title: 'Sí', release_date: '2026-02-01' });
  const exactEarlier = release('b', { title: 'Sí', release_date: '2026-01-01' });
  const result = matchReleases([approximate, exactEarlier, exactLater], { text: ['si'], order: 'fecha-asc' });
  assert.deepEqual(result.matches.map((match) => match.release.id), ['b', 'z']);
  assert.equal(result.approximate.length, 0);
  const ties = matchReleases([release('b'), release('a')], {}).matches;
  assert.deepEqual(ties.map((match) => match.release.id), ['a', 'b']);
});

test('sin criterios incluye todo por fecha descendente y consultas sin coincidencia quedan vacías', () => {
  const dated = [release('old', { release_date: '2025-01-01' }), release('new', { release_date: '2026-01-01' })];
  assert.deepEqual(matchReleases(dated, {}).matches.map((match) => match.release.id), ['new', 'old']);
  assert.deepEqual(matchReleases(dated, {
    text: [], genres: [], countries: [], type: '', year: '',
    radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 },
    order: 'fecha-desc'
  }).matches.map((match) => match.release.id), ['new', 'old']);
  assert.deepEqual(matchReleases(dated, { text: ['imposible'] }).matches, []);
});
