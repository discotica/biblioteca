import test from 'node:test';
import assert from 'node:assert/strict';
import {
  missingForAccept,
  proposalCover,
  proposalEditorActions,
  proposalToSnapshot,
  snapshotToProposal
} from '../src/lib/domain/proposalEditor.ts';
import { pendingId } from '../src/lib/domain/releaseEditor.ts';

// U19 (G3): una propuesta v3 (por nombres) en el formulario del editor (por UUID) y de vuelta.

const dictionaries = {
  genres: [{ id: 'g-techno', name: 'Techno', status: 'selectable' }, { id: 'g-ambient', name: 'Ambient', status: 'selectable' }],
  countries: [{ id: 'c-col', name: 'Colombia', status: 'selectable' }, { id: 'c-mex', name: 'México', status: 'selectable' }],
  types: [{ id: 't-comp', name: 'Compilado', slug: 'compilado' }, { id: 't-ep', name: 'EP', slug: 'ep' }]
};
const labels = [{ id: 'l-raro', name: 'Sello Raro' }];

const proposal = (payload = {}, extra = {}) => ({
  id: 'p1', author_id: 'u-autor', status: 'pending', queue_kind: 'community',
  source_url: 'https://artista.bandcamp.com/album/pulso', source_provider: 'bandcamp',
  updated_at: '2026-10-16T12:00:00.123456+00:00', taken_at: null,
  detected_metadata: { cover_url: 'https://f4.bcbits.com/img/pulso.jpg' },
  payload: {
    version: 3, title: 'Pulso I', primary_artists: ['artista del catálogo', 'Nueva Uno', 'Nueva Dos'], collaborators: ['Invitada'],
    release_type: 'compilado', release_date: '2026-09-18', genres: ['techno'], countries: ['Mexico'], label: 'sello raro',
    team_note: 'Nota del autor', ...payload
  },
  ...extra
});

const resolved = {
  artists: [
    { name: 'artista del catálogo', id: 'a-cat', canonical: 'Artista del catálogo' },
    { name: 'Nueva Uno', id: null, canonical: null },
    { name: 'Nueva Dos', id: null, canonical: null },
    { name: 'Invitada', id: null, canonical: null }
  ],
  labels: [{ name: 'sello raro', id: 'l-raro', canonical: 'Sello Raro' }]
};

test('la propuesta en el formulario: existentes por UUID y nuevos como nombres pendientes', () => {
  const { snapshot, artists, labels: known, unknown } = proposalToSnapshot(proposal(), dictionaries, resolved);
  assert.deepEqual(snapshot.artist_ids, ['a-cat', pendingId('Nueva Uno'), pendingId('Nueva Dos')]);
  assert.deepEqual(snapshot.collaborator_ids, [pendingId('Invitada')]);
  assert.deepEqual(artists, [{ id: 'a-cat', name: 'Artista del catálogo' }]);
  assert.equal(snapshot.label_id, 'l-raro');
  assert.deepEqual(known, [{ id: 'l-raro', name: 'Sello Raro' }]);
  assert.equal(snapshot.release_type_id, 't-comp');
  // Géneros y países por nombre, sin tildes ni mayúsculas, a su id de la lista.
  assert.deepEqual(snapshot.genre_ids, ['g-techno']);
  assert.deepEqual(snapshot.country_ids, ['c-mex']);
  assert.deepEqual(unknown, { genres: [], countries: [] });
  // Fuente como enlace principal y portada detectada; la reseña empieza con la nota del autor.
  assert.deepEqual(snapshot.links, [{ provider: 'bandcamp', url: 'https://artista.bandcamp.com/album/pulso', is_primary: true }]);
  assert.equal(snapshot.cover_url, 'https://f4.bcbits.com/img/pulso.jpg');
  assert.equal(snapshot.review, 'Nota del autor');
  assert.deepEqual(snapshot.radar, {});
});

test('un sello nuevo, valores fuera de la lista y un radar a medias', () => {
  const { snapshot, unknown } = proposalToSnapshot(
    proposal({ label: 'Sello Inexistente', genres: ['Polka', 'Ambient'], countries: ['WORLD'], radar: { experimental: 1 } }),
    dictionaries,
    { artists: resolved.artists, labels: [{ name: 'Sello Inexistente', id: null, canonical: null }] }
  );
  assert.equal(snapshot.label_id, pendingId('Sello Inexistente'));
  assert.deepEqual(snapshot.genre_ids, ['g-ambient']);
  assert.deepEqual(unknown, { genres: ['Polka'], countries: ['WORLD'] });
  assert.deepEqual(snapshot.radar, {});
});

test('un mismo artista en los dos grupos queda solo como principal', () => {
  const { snapshot } = proposalToSnapshot(proposal({ collaborators: ['Artista del Catalogo'] }), dictionaries, {
    ...resolved,
    artists: [...resolved.artists, { name: 'Artista del Catalogo', id: 'a-cat', canonical: 'Artista del catálogo' }]
  });
  assert.deepEqual(snapshot.collaborator_ids, []);
});

test('de vuelta a propuesta v3: nombres conservados, nuevos tal cual y la nota del autor intacta', () => {
  const { snapshot, artists } = proposalToSnapshot(proposal(), dictionaries, resolved);
  snapshot.title = '  Pulso I (corregido) ';
  snapshot.radar = { experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5 };
  snapshot.label_id = pendingId('Sello Nuevo');
  const context = { base: proposal().payload, artists, labels, ...dictionaries };
  const { payload, sourceUrl } = snapshotToProposal(snapshot, { ...context, role: 'colaborador' });
  assert.deepEqual(payload, {
    version: 3,
    title: 'Pulso I (corregido)',
    primary_artists: ['Artista del catálogo', 'Nueva Uno', 'Nueva Dos'],
    collaborators: ['Invitada'],
    release_type: 'compilado',
    release_date: '2026-09-18',
    genres: ['Techno'],
    countries: ['México'],
    label: 'Sello Nuevo',
    radar: { experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5 },
    team_note: 'Nota del autor'
  });
  assert.equal(sourceUrl, 'https://artista.bandcamp.com/album/pulso');
});

test('reseña y portada solo las manda admin', () => {
  const { snapshot, artists } = proposalToSnapshot(proposal(), dictionaries, resolved);
  snapshot.review = 'Reseña del equipo';
  snapshot.cover_url = 'https://f4.bcbits.com/img/otra.jpg';
  const context = { base: proposal().payload, artists, labels, ...dictionaries };
  const asCollaborator = snapshotToProposal(snapshot, { ...context, role: 'colaborador' }).payload;
  assert.equal('review' in asCollaborator, false);
  assert.equal('cover_url' in asCollaborator, false);
  const asAdmin = snapshotToProposal(snapshot, { ...context, role: 'admin' }).payload;
  assert.equal(asAdmin.review, 'Reseña del equipo');
  assert.equal(asAdmin.cover_url, 'https://f4.bcbits.com/img/otra.jpg');
  // Sin radar completo no se manda radar.
  assert.equal('radar' in asAdmin, false);
});

test('la portada: la de la propuesta o, si falta, la detectada (solo HTTPS)', () => {
  assert.equal(proposalCover(proposal({ cover_url: 'https://img.test/a.jpg' })), 'https://img.test/a.jpg');
  assert.equal(proposalCover(proposal()), 'https://f4.bcbits.com/img/pulso.jpg');
  assert.equal(proposalCover(proposal({}, { detected_metadata: { cover_url: 'http://inseguro.test/a.jpg' } })), null);
});

test('acciones del editor por rol (tabla del expediente)', () => {
  const pending = proposal().payload && { status: 'pending', queue_kind: 'community', author_id: 'u-autor' };
  assert.deepEqual(proposalEditorActions(pending, 'admin', 'u-admin'), ['save', 'accept_draft', 'accept_publish', 'changes', 'reject']);
  assert.deepEqual(proposalEditorActions({ ...pending, status: 'ready_for_admin' }, 'admin', 'u-admin'), ['save', 'accept_draft', 'accept_publish', 'changes', 'reject']);
  assert.deepEqual(proposalEditorActions(pending, 'colaborador', 'u-colab'), ['save', 'prepare']);
  // El colaborador no corrige la suya, ni lo que ya está listo, ni la cola de colaboración.
  assert.deepEqual(proposalEditorActions(pending, 'colaborador', 'u-autor'), []);
  assert.deepEqual(proposalEditorActions({ ...pending, status: 'ready_for_admin' }, 'colaborador', 'u-colab'), []);
  assert.deepEqual(proposalEditorActions({ ...pending, queue_kind: 'collaborator' }, 'colaborador', 'u-colab'), []);
  assert.deepEqual(proposalEditorActions({ ...pending, status: 'approved' }, 'admin', 'u-admin'), []);
  assert.deepEqual(proposalEditorActions(pending, 'comunidad', 'u-otro'), []);
});

test('lo que falta para aceptar no incluye la portada (solo publicar la exige)', () => {
  const { snapshot } = proposalToSnapshot(proposal(), dictionaries, resolved);
  assert.deepEqual(missingForAccept({ ...snapshot, cover_url: null }), []);
  assert.deepEqual(missingForAccept({ ...snapshot, label_id: null, genre_ids: [], links: [] }), ['Sello', 'Género', 'Link de compra']);
});
