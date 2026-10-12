import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRIBUTION_STEPS,
  errorsForStep,
  firstInvalidField,
  firstStepWithError,
  stepOfField,
  visibleStep
} from '../src/lib/domain/contributionSteps.ts';

// U13: sugerir por pasos. Fuente → revisar datos → nota → enviar.
test('U13 pasos: cuatro, en el orden de la ronda 3', () => {
  assert.deepEqual(CONTRIBUTION_STEPS.map((item) => item.label), ['Fuente', 'Revisar datos', 'Nota', 'Enviar']);
});

test('U13 pasos: la fuente es del paso 1 y los obligatorios del catálogo, del 2; la nota no es obligatoria en ninguno', () => {
  assert.equal(stepOfField('source'), 1);
  for (const field of ['title', 'primary_artists', 'release_type', 'release_date', 'genres', 'countries']) {
    assert.equal(stepOfField(field), 2);
  }
  assert.equal(firstStepWithError({}), null);
});

test('U13 pasos: errores por paso, en el orden del formulario', () => {
  const errors = { countries: 'c', title: 't', source: 's' };
  assert.deepEqual(Object.keys(errorsForStep(errors, 2)), ['title', 'countries']);
  assert.deepEqual(errorsForStep(errors, 1), { source: 's' });
  assert.deepEqual(errorsForStep(errors, 3), {});
  assert.equal(firstStepWithError(errors), 1);
  assert.equal(firstStepWithError({ genres: 'g', release_type: 'r' }), 2);
  assert.equal(firstInvalidField({ genres: 'g', release_type: 'r' }), 'release_type');
});

test('U13 pasos: sin datos solo existe el primero; con datos, el del historial o el de respaldo', () => {
  assert.equal(visibleStep(3, false), 1);
  assert.equal(visibleStep(undefined, false), 1);
  assert.equal(visibleStep(3, true), 3);
  assert.equal(visibleStep(1, true, 2), 1);
  assert.equal(visibleStep(undefined, true, 2), 2);
  assert.equal(visibleStep('9', true, 2), 2);
});

// U13 (feedback): admin pasa de Sugerir a la consola con lo que rellenó.
import { matchByName, takeAdminHandoff, writeAdminHandoff } from '../src/lib/domain/adminHandoff.ts';

test('U13 traspaso a consola: empareja sin tildes ni mayúsculas y separa lo que no existe', () => {
  const entries = [{ id: 'g1', name: 'Electrónica' }, { id: 'g2', name: 'Ambient' }];
  assert.deepEqual(matchByName(entries, ['electronica', 'AMBIENT', 'Ambient', 'Kuduro ']), { ids: ['g1', 'g2'], missing: ['Kuduro'] });
});

test('U13 traspaso a consola: se lee una sola vez y descarta lo inválido', () => {
  const memory = new Map();
  const store = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  writeAdminHandoff({ sourceUrl: 'https://a.bandcamp.com/album/x', title: 'X', primaryArtists: ['A'], collaborators: [], releaseType: 'EP', releaseDate: '2026-09-18', genres: [], countries: [], label: '', note: '', coverUrl: '' }, store);
  assert.equal(takeAdminHandoff(store)?.title, 'X');
  assert.equal(takeAdminHandoff(store), null);
  store.setItem('discotica:sugerir-a-consola', '{"title":3}');
  assert.equal(takeAdminHandoff(store), null);
});
