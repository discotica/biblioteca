import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueCountries, uniqueGenres, uniqueTypes, uniqueYears } from '../src/lib/domain/filterOptions.ts';

// U10b: las opciones del formulario y de las sugerencias salen de una sola
// utilidad (antes, dentro de Filtros.svelte).
const releases = [
  { country: ['Colombia', 'España'], genre: ['techno', 'Ambient'], type: 'EP', release_date: '2024-05-01' },
  { country: ['méxico', 'Colombia'], genre: ['Ambient', 'Électro'], type: 'Álbum', release_date: '2026-01-15' },
  { country: null, genre: null, type: '', release_date: '' },
  { country: ['Puerto Rico'], genre: ['House'], type: 'EP', release_date: '2019-03-01' }
];

test('U10b filterOptions: solo países de Latinoamérica y el Caribe, sin repetir y en orden', () => {
  assert.deepEqual(uniqueCountries(releases), ['Colombia', 'méxico', 'Puerto Rico']);
});

test('U10b filterOptions: géneros sin repetir, ordenados sin distinguir mayúsculas ni tildes', () => {
  assert.deepEqual(uniqueGenres(releases), ['Ambient', 'Électro', 'House', 'techno']);
});

test('U10b filterOptions: tipos y años (del más reciente al más antiguo), sin vacíos', () => {
  assert.deepEqual(uniqueTypes(releases), ['EP', 'Álbum']);
  assert.deepEqual(uniqueYears(releases), ['2026', '2024', '2019']);
});

test('U10b filterOptions: sin catálogo no hay opciones', () => {
  assert.deepEqual(uniqueCountries(undefined), []);
  assert.deepEqual(uniqueGenres(null), []);
  assert.deepEqual(uniqueTypes([]), []);
  assert.deepEqual(uniqueYears([]), []);
});
