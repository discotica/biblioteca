import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptCanonicalRelease,
  adaptLegacyRelease,
  allArtistCredits,
  findArtistCredit,
  legacyReleaseSlug,
  normalizeReleaseDate,
  normalizeReleaseType,
  releaseArtistPresentation,
  releaseHasArtistSlug,
  summarizeReleaseCredits
} from '../src/lib/domain/releases.ts';
import { resolveReleaseBySlug } from '../src/lib/domain/releaseRepository.ts';
import {
  canonicalReleasePath,
  formatReleaseDateEsCo,
  releasePlayerConfig
} from '../src/lib/domain/releaseDetail.ts';

const canonicalRow = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ritmo-norte--abcd1234',
  title: 'Ritmo Norte',
  release_date: '2026-09-05',
  type: 'Álbum',
  label: 'Sello Uno',
  review: null,
  experimental: 1,
  denso: 2,
  sintetico: 3,
  bailable: 4,
  rapido: 5,
  artists: ['Fallback que no debe ganar'],
  primary_artists: [
    { id: 'a1', slug: 'arbol', name: 'Árbol', position: 1 },
    { id: 'a0', slug: 'luz', name: 'Luz', position: 0 }
  ],
  collaborators: [{ id: 'c0', slug: 'invitada', name: 'Invitada', position: 0 }],
  credit_quality: 'proposed',
  genres: ['Electro'],
  countries: ['Colombia'],
  buy_link: 'https://example.test/release',
  cover: 'https://example.test/cover.jpg'
};

test('adapta la vista canónica sin perder UUID, slugs, grupos ni posiciones', () => {
  const release = adaptCanonicalRelease(canonicalRow);
  assert.equal(release.id, canonicalRow.id);
  assert.equal(release.slug, canonicalRow.slug);
  assert.deepEqual(release.primaryArtists.map(({ id, slug, name, position }) => ({ id, slug, name, position })), [
    { id: 'a0', slug: 'luz', name: 'Luz', position: 0 },
    { id: 'a1', slug: 'arbol', name: 'Árbol', position: 1 }
  ]);
  assert.equal(release.collaborators[0].slug, 'invitada');
  assert.equal(release.creditQuality, 'proposed');
  assert.equal(release.releaseDate.iso, '2026-09-05');
  assert.equal(release.release_date, '05/09/2026');
});

test('el adaptador legado crea solo principales y calidad legacy sin inferir colaboradores', () => {
  const release = adaptLegacyRelease({
    artist: 'Árbol, Invitada',
    title: 'Ritmo Norte',
    type: 'Disco',
    release_date: '5/9/26'
  });
  assert.equal(release.id, null);
  assert.equal(release.releaseType, 'Álbum');
  assert.equal(release.creditQuality, 'legacy');
  assert.deepEqual(release.primaryArtists.map((credit) => credit.name), ['Árbol', 'Invitada']);
  assert.deepEqual(release.collaborators, []);
  assert.equal(release.slug, legacyReleaseSlug('Ritmo Norte', 'Árbol'));
});

test('normaliza únicamente los cinco tipos y trata nulos o arbitrarios como no publicables', () => {
  assert.equal(normalizeReleaseType('Disco'), 'Álbum');
  assert.equal(normalizeReleaseType('Album'), 'Álbum');
  assert.equal(normalizeReleaseType('Sample Pack'), 'Sample Pack');
  assert.equal(normalizeReleaseType('Mixtape'), null);
  assert.equal(normalizeReleaseType(null), null);
});

test('centraliza fechas ISO/legado y no interpreta valores nulos, imposibles o ambiguos', () => {
  assert.deepEqual(normalizeReleaseDate('2026-09-05'), {
    iso: '2026-09-05', display: '05/09/2026', year: '2026', month: '09', timestamp: Date.UTC(2026, 8, 5)
  });
  assert.equal(normalizeReleaseDate('5/9/26').iso, '2026-09-05');
  assert.equal(normalizeReleaseDate('31/02/2026').timestamp, 0);
  assert.equal(normalizeReleaseDate('1970-01-01').iso, '1970-01-01');
  assert.equal(normalizeReleaseDate('septiembre 2026').iso, null);
  assert.equal(normalizeReleaseDate(null).display, '');
});

test('Compilado usa Varios artistas sin borrar las relaciones navegables', () => {
  const release = adaptCanonicalRelease({ ...canonicalRow, type: 'Compilado' });
  const presentation = releaseArtistPresentation(release);
  assert.equal(presentation.label, 'Varios artistas');
  assert.deepEqual(presentation.credits.map((credit) => credit.slug), ['luz', 'arbol', 'invitada']);
});

const creditOf = (name, position = 0) => ({ id: null, slug: name.toLowerCase(), name, position });

test('créditos: Compilado muestra Varios artistas sin importar cuántos principales hay', () => {
  const summary = summarizeReleaseCredits({
    releaseType: 'Compilado',
    primaryArtists: [creditOf('Luz')],
    collaborators: []
  });
  assert.equal(summary.various, true);
  assert.equal(summary.label, 'Varios artistas');
  assert.deepEqual(summary.credits.map((credit) => credit.name), ['Luz']);
});

test('créditos: un principal se muestra por nombre, sin resumen ni "más"', () => {
  const release = adaptCanonicalRelease({
    ...canonicalRow,
    primary_artists: [{ id: 'artist-luz', slug: 'luz', name: 'Luz', position: 0 }],
    collaborators: []
  });
  const summary = summarizeReleaseCredits(release);
  assert.equal(summary.various, false);
  assert.equal(summary.label, 'Luz');
  assert.equal(summary.moreCount, 0);
  assert.equal(summary.moreLabel, '');
  assert.equal(releaseArtistPresentation(release).label, 'Luz');
});

test('créditos: varios principales se listan todos, sin importar cuántos sean', () => {
  const four = ['Ana', 'Beto', 'Caro', 'Dani'].map(creditOf);
  const summary = summarizeReleaseCredits({ releaseType: 'Single', primaryArtists: four, collaborators: [] });
  assert.equal(summary.various, false);
  assert.deepEqual(summary.names.map((credit) => credit.name), ['Ana', 'Beto', 'Caro', 'Dani']);
  assert.equal(summary.label, 'Ana, Beto, Caro, Dani');

  const two = adaptCanonicalRelease({ ...canonicalRow, collaborators: [] });
  assert.equal(releaseArtistPresentation(two).label, 'Luz, Árbol');
});

test('créditos: principal con colaboradores añade "y N más" en texto', () => {
  const one = summarizeReleaseCredits({ releaseType: 'EP', primaryArtists: [creditOf('Luz')], collaborators: [creditOf('Invitada')] });
  assert.equal(one.label, 'Luz y 1 más');
  assert.equal(one.moreLabel, 'y 1 más');

  const many = summarizeReleaseCredits({
    releaseType: 'Álbum',
    primaryArtists: [creditOf('Luz'), creditOf('Árbol', 1)],
    collaborators: [creditOf('A'), creditOf('B', 1), creditOf('C', 2)]
  });
  assert.equal(many.label, 'Luz, Árbol y 3 más');
  assert.equal(many.moreCount, 3);
  assert.deepEqual(many.credits.map((credit) => credit.name), ['Luz', 'Árbol', 'A', 'B', 'C']);
});

test('créditos: sin principales, los colaboradores dan nombre y no cuentan como "más"', () => {
  const summary = summarizeReleaseCredits({ releaseType: 'EP', primaryArtists: [], collaborators: [creditOf('Invitada')] });
  assert.equal(summary.label, 'Invitada');
  assert.equal(summary.moreCount, 0);
  assert.equal(summarizeReleaseCredits({ releaseType: null, primaryArtists: [], collaborators: [] }).label, '');
});

test('créditos: nombres largos llegan completos; el truncado es de presentación', () => {
  const long = 'Nombre Principal Excepcionalmente Largo que no cabe en una tarjeta de tres columnas';
  const summary = summarizeReleaseCredits({
    releaseType: 'Single',
    primaryArtists: [creditOf(`${long} A`), creditOf(`${long} B`, 1)],
    collaborators: [creditOf('Invitada')]
  });
  assert.equal(summary.label, `${long} A, ${long} B y 1 más`);
  assert.equal(summary.moreLabel, 'y 1 más');
});

test('la discografía de artista incluye créditos principales y colaboradores', () => {
  const release = adaptCanonicalRelease(canonicalRow);
  assert.equal(releaseHasArtistSlug(release, 'invitada'), true);
  assert.equal(findArtistCredit(release, 'invitada')?.name, 'Invitada');
  assert.deepEqual(allArtistCredits(release).map((credit) => credit.name), ['Luz', 'Árbol', 'Invitada']);
});

function gateway({ target = null, release = null, legacy = [], resolverError = null } = {}) {
  return {
    async resolveCanonicalSlug() {
      if (resolverError) throw resolverError;
      return target;
    },
    async findCanonicalById() { return release; },
    async listLegacy() { return legacy; }
  };
}

test('el resolvedor devuelve slug canónico y conserva por separado el alias recibido', async () => {
  const release = adaptCanonicalRelease(canonicalRow);
  const resolution = await resolveReleaseBySlug('ritmo-viejo', gateway({
    target: {
      releaseId: canonicalRow.id,
      canonicalSlug: canonicalRow.slug,
      matchKind: 'alias',
      aliasKind: 'migration'
    },
    release
  }));
  assert.equal(resolution.status, 'resolved');
  assert.equal(resolution.requestedSlug, 'ritmo-viejo');
  assert.equal(resolution.canonicalSlug, canonicalRow.slug);
  assert.equal(resolution.releaseId, canonicalRow.id);
  assert.equal(resolution.matchKind, 'alias');
});

test('una colisión canonical/alias obedece el resultado canónico atómico de E02', async () => {
  const release = adaptCanonicalRelease(canonicalRow);
  const resolution = await resolveReleaseBySlug(canonicalRow.slug, gateway({
    target: {
      releaseId: canonicalRow.id,
      canonicalSlug: canonicalRow.slug,
      matchKind: 'canonical',
      aliasKind: null
    },
    release
  }));
  assert.equal(resolution.status, 'resolved');
  assert.equal(resolution.matchKind, 'canonical');
  assert.equal(resolution.aliasKind, null);
});

test('cero filas queda no resuelto y nunca escoge entre aliases ambiguos', async () => {
  const legacy = adaptLegacyRelease({ artist: 'Árbol', title: 'Ritmo Norte' });
  const resolution = await resolveReleaseBySlug(legacy.slug, gateway({ legacy }), { allowLegacyFallback: true });
  assert.deepEqual(resolution, {
    status: 'unresolved', requestedSlug: legacy.slug, reason: 'not-found-or-ambiguous'
  });
});

test('el rollback TSV solo actúa ante fallo técnico y exige una coincidencia única', async () => {
  const legacy = adaptLegacyRelease({ artist: 'Árbol', title: 'Ritmo Norte' });
  const resolved = await resolveReleaseBySlug(
    legacy.slug,
    gateway({ legacy: [legacy], resolverError: new Error('offline') }),
    { allowLegacyFallback: true }
  );
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.matchKind, 'legacy');

  const ambiguous = await resolveReleaseBySlug(
    legacy.slug,
    gateway({ legacy: [legacy, { ...legacy }], resolverError: new Error('offline') }),
    { allowLegacyFallback: true }
  );
  assert.equal(ambiguous.status, 'unresolved');
});

test('cambiar créditos no altera UUID, slug ni la referencia estable de crate', () => {
  const before = adaptCanonicalRelease(canonicalRow);
  const after = adaptCanonicalRelease({
    ...canonicalRow,
    primary_artists: [{ id: 'a0', slug: 'luz', name: 'Luz', position: 0 }],
    collaborators: [{ id: 'a1', slug: 'arbol', name: 'Árbol', position: 0 }]
  });
  assert.equal(after.id, before.id);
  assert.equal(after.slug, before.slug);
  assert.equal(after.id, canonicalRow.id);
});

test('entrada vacía o URI malformada no llega al gateway', async () => {
  let calls = 0;
  const inertGateway = {
    async resolveCanonicalSlug() { calls++; return null; },
    async findCanonicalById() { calls++; return null; },
    async listLegacy() { calls++; return []; }
  };
  assert.equal((await resolveReleaseBySlug(null, inertGateway)).status, 'unresolved');
  assert.equal((await resolveReleaseBySlug('%E0%A4%A', inertGateway)).status, 'unresolved');
  assert.equal(calls, 0);
});

test('E16: la ficha comparte fecha es-CO y siempre publica el slug canónico', () => {
  const release = adaptCanonicalRelease(canonicalRow);
  assert.match(formatReleaseDateEsCo(release.releaseDate), /5 de septiembre de 2026/i);
  assert.equal(canonicalReleasePath(release), '/lanzamiento/ritmo-norte--abcd1234');
});

test('E16: la matriz de providers fija geometría y rechaza hosts o rutas parecidas', () => {
  const configs = [
    ['https://artista.bandcamp.com/album/release', 'bandcamp', 290],
    ['https://soundcloud.com/artista/release', 'soundcloud', 300],
    ['https://open.spotify.com/album/1234567890', 'spotify', 352]
  ];

  for (const [buyLink, provider, height] of configs) {
    const config = releasePlayerConfig({ buyLink });
    assert.equal(config?.provider, provider);
    assert.equal(config?.height, height);
    assert.match(config?.src ?? '', /^https:\/\//);
  }

  assert.equal(releasePlayerConfig({ buyLink: 'https://bandcamp.com.attacker.test/album/x' }), null);
  assert.equal(releasePlayerConfig({ buyLink: 'https://open.spotify.com/track/123' }), null);
  assert.equal(releasePlayerConfig({ buyLink: 'javascript:alert(1)' }), null);
});
