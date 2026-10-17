import test from 'node:test';
import assert from 'node:assert/strict';
import { RADAR_AXES, completeRadar, describeContributionError } from '../src/lib/domain/contributionContract.ts';

// U19 G1: los RPC v3 devuelven un código en `message` y, cuando aplica, el valor en `details`.
test('U19 contrato: traduce los errores de listas cerradas con el valor rechazado', () => {
  assert.deepEqual(describeContributionError({ message: 'genre_not_selectable', details: 'Polka' }), {
    field: 'genres',
    message: '«Polka» no está en la lista de géneros.'
  });
  assert.deepEqual(describeContributionError({ message: 'country_not_selectable', details: 'España' }), {
    field: 'countries',
    message: '«España» no está en la lista de países.'
  });
  assert.equal(describeContributionError({ message: 'country_not_selectable', details: null })?.message, 'Ese valor no está en la lista de países.');
});

test('U19 contrato: sello obligatorio, radar y créditos apuntan a su campo', () => {
  assert.deepEqual(describeContributionError({ message: 'label_required' }), {
    field: 'label',
    message: 'El sello es obligatorio. Si es autoeditado, elige «Independiente».'
  });
  assert.equal(describeContributionError({ message: 'radar_invalid', details: 'denso' })?.field, 'radar');
  assert.equal(describeContributionError({ message: 'credit_in_both_groups' })?.field, 'collaborators');
});

test('U19 contrato: tomada y conflicto de versión no son de un campo', () => {
  assert.deepEqual(describeContributionError({ message: 'contribution_taken' }), {
    field: null,
    message: 'El equipo ya está revisando esta propuesta y ya no se puede editar.'
  });
  assert.equal(describeContributionError({ message: 'contribution_version_conflict' })?.field, null);
});

test('U19 contrato: un error desconocido queda para el mensaje genérico', () => {
  assert.equal(describeContributionError({ message: 'Administrative role required' }), null);
  assert.equal(describeContributionError(null), null);
  assert.equal(describeContributionError({}), null);
});

test('U19 contrato: el radar solo se envía completo', () => {
  assert.deepEqual(RADAR_AXES, ['experimental', 'denso', 'sintetico', 'bailable', 'rapido']);
  assert.deepEqual(completeRadar({ experimental: 0, denso: 1, sintetico: 2, bailable: 3, rapido: 5 }), {
    experimental: 0, denso: 1, sintetico: 2, bailable: 3, rapido: 5
  });
  assert.equal(completeRadar({ experimental: 1 }), null);
  assert.equal(completeRadar({ experimental: 6, denso: 1, sintetico: 2, bailable: 3, rapido: 4 }), null);
  assert.equal(completeRadar({ experimental: 1.5, denso: 1, sintetico: 2, bailable: 3, rapido: 4 }), null);
  assert.equal(completeRadar(null), null);
});
