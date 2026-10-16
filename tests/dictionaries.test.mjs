import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeDictionaryError,
  dictionariesHref,
  dictionaryCapabilities,
  dictionaryFilterFromSlug,
  dictionaryFilters,
  dictionaryKey,
  dictionaryKindFromSlug,
  dictionaryPublicHref,
  mergeConsequence,
  releaseTally,
  renameConsequence
} from '../src/lib/domain/dictionaries.ts';

// U19 (G4): pantalla de diccionarios. El servidor decide; esto decide qué se ofrece y cómo se dice.

test('G4: las pestañas y los filtros viven en la URL', () => {
  assert.equal(dictionaryKindFromSlug(null), 'genre');
  assert.equal(dictionaryKindFromSlug('paises'), 'country');
  assert.equal(dictionaryKindFromSlug('artistas'), 'artist');
  assert.equal(dictionaryKindFromSlug('otra'), 'genre');
  assert.equal(dictionariesHref(), '/estudio/diccionarios');
  assert.equal(dictionariesHref('label', 'orphans'), '/estudio/diccionarios?tipo=sellos&filtro=sin-lanzamientos');
  assert.equal(dictionariesHref('country', 'legacy', '  eeuu '), '/estudio/diccionarios?tipo=paises&filtro=legado&q=eeuu');
});

test('G4: sellos y artistas no tienen estado; un filtro ajeno vuelve a Todos', () => {
  assert.deepEqual(dictionaryFilters('genre'), ['all', 'selectable', 'legacy', 'retired', 'orphans']);
  assert.deepEqual(dictionaryFilters('artist'), ['all', 'orphans']);
  assert.equal(dictionaryFilterFromSlug('country', 'retirados'), 'retired');
  assert.equal(dictionaryFilterFromSlug('label', 'legado'), 'all');
  assert.equal(dictionaryFilterFromSlug('label', 'sin-lanzamientos'), 'orphans');
});

test('G4: géneros y países se crean y cambian de estado; sellos y artistas se borran huérfanos', () => {
  assert.deepEqual(dictionaryCapabilities('genre'), { create: true, status: true, deleteOrphans: false });
  assert.deepEqual(dictionaryCapabilities('label'), { create: false, status: false, deleteOrphans: true });
});

test('G4: la página pública de artistas y sellos', () => {
  assert.equal(dictionaryPublicHref('artist', { public_slug: 'foo--a1b2c3d4' }), '/artista/foo--a1b2c3d4');
  assert.equal(dictionaryPublicHref('label', { public_slug: 'sello-raro' }), '/sello/sello-raro');
  assert.equal(dictionaryPublicHref('genre', { public_slug: null }), null);
});

test('G4: conteo de lanzamientos', () => {
  assert.equal(releaseTally({ release_count: 0, published_count: 0 }), 'Sin lanzamientos');
  assert.equal(releaseTally({ release_count: 1, published_count: 1 }), '1 lanzamiento');
  assert.equal(releaseTally({ release_count: 3, published_count: 2 }), '3 lanzamientos · 2 publicados');
  assert.equal(releaseTally({ release_count: 2, published_count: 0 }), '2 lanzamientos · 0 publicados');
});

test('G4: renombrar avisa del alias solo si cambia la clave, y de la URL en artistas y sellos', () => {
  assert.equal(dictionaryKey('  Haití  '), dictionaryKey('haiti'));
  assert.deepEqual(renameConsequence('country', 'Haiti', 'Haití'), ['«Haiti» pasa a llamarse «Haití» en todos sus lanzamientos.']);
  assert.deepEqual(renameConsequence('genre', 'Triphop', 'Trip Hop'), [
    '«Triphop» pasa a llamarse «Trip Hop» en todos sus lanzamientos.',
    '«Triphop» queda como alias: la hoja y Sugerir lo traducen a «Trip Hop».'
  ]);
  assert.equal(renameConsequence('label', 'Sello', 'Sello Nuevo').at(-1), 'Su URL vieja redirige a la nueva.');
  assert.deepEqual(renameConsequence('genre', 'Techno', ' Techno '), []);
});

test('G4: fusionar dice qué se mueve y qué queda', () => {
  const lines = mergeConsequence('artist', { name: 'DJ Viejo', release_count: 3 }, 'DJ Nuevo');
  assert.equal(lines[0], 'Sus 3 lanzamientos pasan a «DJ Nuevo».');
  assert.ok(lines.includes('La URL de «DJ Viejo» redirige a la de «DJ Nuevo».'));
  assert.equal(mergeConsequence('country', { name: 'EEUU', release_count: 1 }, 'Estados Unidos')[0], 'Su lanzamiento pasa a «Estados Unidos».');
  assert.equal(mergeConsequence('genre', { name: 'Triphop', release_count: 1 }, 'Trip Hop').length, 2);
});

test('G4: los errores del servidor se dicen sin código', () => {
  assert.equal(describeDictionaryError({ message: 'dictionary_value_exists', details: 'Trip Hop' }), 'Ya existe «Trip Hop». Para unirlos, usa «Fusionar con…».');
  assert.equal(describeDictionaryError({ message: 'dictionary_value_in_use', details: 'Sello A, Sello B' }), 'No se borró nada: Sello A, Sello B tienen lanzamientos.');
  assert.equal(describeDictionaryError({ message: 'dictionary_value_in_use', details: 'Sello A' }), 'No se borró nada: Sello A tiene lanzamientos.');
  assert.equal(describeDictionaryError({ code: '42501', message: 'Administrative role required' }), 'Solo administración puede cambiar los diccionarios.');
  assert.equal(describeDictionaryError({ code: 'PGRST202', message: 'Could not find the function public.admin_list_catalog_dictionary' }),
    'Este entorno todavía no tiene la pantalla de diccionarios: falta aplicar su migración (U19 G4).');
  assert.equal(describeDictionaryError({ code: '40001', message: 'x' }), 'El servidor no aceptó el cambio. Inténtalo de nuevo.');
});
