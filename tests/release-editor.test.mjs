import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITOR_SECTIONS,
  changedFields,
  inferProvider,
  missingBySection,
  missingFields,
  moveCredits,
  operationLabel,
  validateRelease,
  withPrimaryLink
} from '../src/lib/domain/releaseEditor.ts';

const complete = () => ({
  id: 'r1', slug: 'killing-mariposas', title: 'Killing Mariposas', release_date: '2026-09-18',
  release_type_id: 't', label_id: 'l', review: '', status: 'draft', credit_quality: 'proposed',
  catalog_version: 4, updated_at: '', artist_ids: ['a'], collaborator_ids: ['b'], genre_ids: ['g'],
  country_ids: ['c'], radar: { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 },
  links: [{ provider: 'Bandcamp', url: 'https://x.bandcamp.com/album/y', is_primary: true }],
  cover_url: 'https://img.test/c.jpg'
});

test('el índice tiene las cinco secciones del plan, en orden', () => {
  assert.deepEqual(EDITOR_SECTIONS.map((section) => section.label), ['Datos', 'Créditos', 'Clasificación', 'Medios', 'Historial']);
});

test('un lanzamiento completo no tiene pendientes', () => {
  assert.deepEqual(missingFields(complete()), []);
  assert.equal(validateRelease(complete(), true), '');
});

test('los pendientes conservan nombres y orden de E07 y se reparten por sección', () => {
  const blank = { ...complete(), release_date: null, label_id: null, artist_ids: [], genre_ids: [], cover_url: 'http://img.test/c.jpg', links: [] };
  assert.deepEqual(missingFields(blank), ['Fecha', 'Sello', 'Artista principal', 'Género', 'Portada', 'Link de compra']);
  const bySection = missingBySection(blank);
  assert.deepEqual(bySection.datos, ['Fecha', 'Sello']);
  assert.deepEqual(bySection.creditos, ['Artista principal']);
  assert.deepEqual(bySection.clasificacion, ['Género']);
  assert.deepEqual(bySection.medios, ['Portada', 'Link de compra']);
  assert.deepEqual(bySection.historial, []);
});

test('dos enlaces principales o uno sin HTTPS cuentan como enlace pendiente', () => {
  const two = { ...complete(), links: [complete().links[0], { provider: 'Spotify', url: 'https://open.spotify.com/a', is_primary: true }] };
  assert.ok(missingFields(two).includes('Link de compra'));
  assert.equal(validateRelease(two), 'Solo puede haber un enlace principal.');
});

test('la validación usa los mensajes de E07 en su orden', () => {
  assert.equal(validateRelease({ ...complete(), title: ' ' }), 'El título es obligatorio.');
  assert.equal(validateRelease({ ...complete(), slug: 'Mal Slug' }), 'No pudimos generar el identificador interno. Revisa el título.');
  assert.equal(validateRelease({ ...complete(), artist_ids: [] }), 'Selecciona al menos un artista principal.');
  assert.equal(validateRelease({ ...complete(), collaborator_ids: ['a'] }), 'Un artista no puede ser principal y colaborador a la vez.');
  assert.equal(validateRelease({ ...complete(), country_ids: [] }, true), 'Completa antes de publicar: País.');
  assert.equal(validateRelease({ ...complete(), country_ids: [] }), '');
  assert.equal(validateRelease({ ...complete(), cover_url: 'http://img.test/c.jpg' }), 'La portada debe usar HTTPS.');
});

test('el enlace principal se crea delante, se reemplaza o se quita sin tocar los demás', () => {
  const extra = { provider: 'Spotify', url: 'https://open.spotify.com/a', is_primary: false };
  assert.deepEqual(withPrimaryLink([extra], 'https://x.bandcamp.com/album/y'), [
    { provider: 'Bandcamp', url: 'https://x.bandcamp.com/album/y', is_primary: true },
    extra
  ]);
  const links = [extra, { provider: 'Bandcamp', url: 'https://x.bandcamp.com/album/y', is_primary: true }];
  assert.deepEqual(withPrimaryLink(links, 'https://soundcloud.com/z'), [extra, { provider: 'SoundCloud', url: 'https://soundcloud.com/z', is_primary: true }]);
  assert.deepEqual(withPrimaryLink(links, ''), [extra]);
  assert.deepEqual(withPrimaryLink([], ''), []);
  assert.equal(inferProvider('https://'), 'Enlace');
});

test('mover o añadir créditos: entre grupos, delante de otro y nunca en los dos', () => {
  const credits = { artist_ids: ['a', 'b'], collaborator_ids: ['c', 'd'] };
  assert.deepEqual(moveCredits(credits, ['b'], 'collaborator_ids'), { artist_ids: ['a'], collaborator_ids: ['c', 'd', 'b'] });
  assert.deepEqual(moveCredits(credits, ['d', 'c'], 'artist_ids', 'a'), { artist_ids: ['c', 'd', 'a', 'b'], collaborator_ids: [] });
  assert.deepEqual(moveCredits(credits, ['b'], 'artist_ids', 'a'), { artist_ids: ['b', 'a'], collaborator_ids: ['c', 'd'] });
  assert.deepEqual(moveCredits(credits, ['x'], 'artist_ids'), { artist_ids: ['a', 'b', 'x'], collaborator_ids: ['c', 'd'] });
  assert.deepEqual(moveCredits(credits, ['x', 'c'], 'artist_ids', 'b'), { artist_ids: ['a', 'c', 'x', 'b'], collaborator_ids: ['d'] });
  assert.deepEqual(moveCredits(credits, [], 'artist_ids'), credits);
});

test('historial: operaciones y campos en palabras, sin la versión ni la fecha de edición', () => {
  assert.equal(operationLabel('publish'), 'Publicación');
  assert.equal(operationLabel('desconocida'), 'desconocida');
  const entry = {
    before_state: { title: 'A', catalog_version: 1, updated_at: 'x', genre_ids: ['g'] },
    after_state: { title: 'B', catalog_version: 2, updated_at: 'y', genre_ids: ['g'], cover_url: 'https://c' }
  };
  assert.deepEqual(changedFields(entry), ['Título', 'Portada']);
  assert.deepEqual(changedFields({ before_state: null, after_state: { title: 'A' } }), ['Título']);
});
