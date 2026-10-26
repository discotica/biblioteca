import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptCanonicalRelease } from '../src/lib/domain/releases.ts';
import { recommendReleases } from '../src/lib/domain/releaseRecommendations.ts';
import {
  MODAL_HISTORY_KEY,
  beginModalSession,
  closeModalPlan,
  entryForSession,
  pushModalRelease,
  readModalHistoryEntry,
  restoreModalSession,
  visitModalBase
} from '../src/lib/domain/modalHistory.ts';
import { createSearchState } from '../src/lib/domain/searchState.ts';

const credit = [{ id: 'artist-1', slug: 'artista', name: 'Artista', position: 0 }];

function release(id, slug, genres, radar) {
  return adaptCanonicalRelease({
    id,
    slug,
    title: slug,
    release_date: '2026-09-20',
    type: 'Álbum',
    label: '',
    review: '',
    artists: ['Artista'],
    primary_artists: credit,
    collaborators: [],
    genres,
    countries: ['Colombia'],
    buy_link: '',
    cover: '',
    experimental: radar[0],
    denso: radar[1],
    sintetico: radar[2],
    bailable: radar[3],
    rapido: radar[4]
  });
}

test('E17 recommendations: slot 1 shares genre and slot 2 is the nearest remaining Radar release', () => {
  const current = release('current', 'actual', ['Ambient', 'Electro'], [3, 3, 3, 3, 3]);
  const sameGenreFar = release('genre-far', 'genero-lejano', ['Ambient'], [5, 5, 5, 5, 5]);
  const sameGenreNear = release('genre-near', 'genero-cercano', ['Electro'], [3, 3, 3, 3, 2]);
  const globalNearest = release('global-near', 'global-cercano', ['Jazz'], [3, 3, 3, 3, 3]);
  const duplicateCurrent = release('current', 'actual-duplicado', ['Ambient'], [3, 3, 3, 3, 3]);
  const duplicateGlobal = release('global-near', 'global-duplicado', ['Jazz'], [3, 3, 3, 3, 3]);

  const result = recommendReleases(current, [duplicateGlobal, sameGenreFar, current, globalNearest, sameGenreNear, duplicateCurrent]);
  assert.deepEqual(result.map(({ slot, release: item }) => [slot, item.id]), [[1, 'genre-near'], [2, 'global-near']]);
  assert.equal(result[0].sharesGenre, true);
  assert.equal(result[0].radarDistance, 1);
  assert.equal(result[1].sharesGenre, false);
  assert.equal(result[1].radarDistance, 0);
});

test('E17 recommendations: stable hash resolves ties independently of input order', () => {
  const current = release('current', 'actual', ['Ambient'], [2, 2, 2, 2, 2]);
  const candidates = [
    release('a', 'a', ['Ambient'], [2, 2, 2, 2, 2]),
    release('b', 'b', ['Ambient'], [2, 2, 2, 2, 2]),
    release('c', 'c', ['Jazz'], [2, 2, 2, 2, 2])
  ];
  const first = recommendReleases(current, candidates).map(({ release: item }) => item.id);
  const second = recommendReleases(current, [...candidates].reverse()).map(({ release: item }) => item.id);
  assert.deepEqual(second, first);
  assert.equal(new Set(first).size, first.length);
});

test('E17 recommendations: returns exactly zero or one when valid slots are insufficient', () => {
  const emptyCurrent = release('empty', 'sin-radar-ni-genero', [], [0, 0, 0, 0, 0]);
  assert.deepEqual(recommendReleases(emptyCurrent, [emptyCurrent]), []);

  const only = release('only', 'unico', ['Jazz'], [5, 5, 5, 5, 5]);
  const one = recommendReleases(emptyCurrent, [emptyCurrent, only]);
  assert.equal(one.length, 1);
  assert.equal(one[0].slot, 2);
  assert.equal(one[0].release.id, 'only');
  assert.equal(one[0].radarDistance, null);
});

test('E17 modal machine: catalog A → B → C closes to the immutable base snapshot', () => {
  const baseSearchState = createSearchState({ genres: ['Ambient'], page: 3 });
  let session = beginModalSession({
    origin: 'catalog',
    baseHref: '/?genero=Ambient&p=3',
    baseSearchState,
    baseScroll: { x: 0, y: 417 },
    slug: 'a'
  });
  assert.equal(session.depth, 1);
  const a = entryForSession(session);
  const b = pushModalRelease(session, 'b');
  session = b.session;
  const c = pushModalRelease(session, 'c');
  session = c.session;
  assert.deepEqual([a.depth, b.entry.depth, c.entry.depth], [1, 2, 3]);
  assert.deepEqual(closeModalPlan(session), { kind: 'go', delta: -3, finishDirectAtDepthZero: false });

  const restoredB = restoreModalSession(readModalHistoryEntry({ [MODAL_HISTORY_KEY]: b.entry }));
  assert.equal(restoredB.slug, 'b');
  assert.equal(restoredB.depth, 2);
  assert.deepEqual(restoredB.baseSearchState, baseSearchState);
  assert.equal(visitModalBase(restoredB).phase, 'base');
});

test('E17 modal machine: direct sessions replace the direct entry after traversing back to depth zero', () => {
  const direct = beginModalSession({
    origin: 'direct',
    baseHref: '/?genero=Ambient',
    baseSearchState: createSearchState({ genres: ['Ambient'] }),
    baseScroll: { x: 0, y: 0 },
    slug: 'a'
  });
  assert.deepEqual(closeModalPlan(direct), { kind: 'replace', href: '/?genero=Ambient', scroll: { x: 0, y: 0 } });
  const chained = pushModalRelease(pushModalRelease(direct, 'b').session, 'c').session;
  assert.deepEqual(closeModalPlan(chained), { kind: 'go', delta: -2, finishDirectAtDepthZero: true });
  assert.equal(readModalHistoryEntry({ [MODAL_HISTORY_KEY]: { version: 2 } }), null);
});

