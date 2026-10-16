import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRIBUTION_ROW_TONES, contributionRowAction, contributionRowDate, contributionTaken } from '../src/lib/domain/contributionRows.ts';

const row = (status, extra = {}) => ({
  id: 'c1', status, submitted_at: '2026-09-02T00:00:00Z', reviewed_at: '2026-09-03T00:00:00Z',
  updated_at: '2026-09-04T00:00:00Z', release_id: null, ...extra
});

test('U14: una acción como mucho por aporte', () => {
  assert.deepEqual(contributionRowAction(row('draft'), null), { kind: 'resume', label: 'Retomar', href: '/sugerir?draft=c1' });
  assert.deepEqual(contributionRowAction(row('changes_requested'), null), { kind: 'fix', label: 'Corregir', href: '/sugerir?draft=c1' });
  assert.deepEqual(contributionRowAction(row('approved', { release_id: 'r1' }), 'mi-disco'), { kind: 'view', label: 'Ver lanzamiento', href: '/lanzamiento/mi-disco' });
  // Aceptado pero ya no publicado: sin enlace.
  assert.equal(contributionRowAction(row('approved', { release_id: 'r1' }), null), null);
  for (const status of ['ready_for_admin', 'rejected']) assert.equal(contributionRowAction(row(status), 'x'), null);
});

test('U19: el autor edita lo enviado hasta que el equipo lo toma', () => {
  assert.deepEqual(contributionRowAction(row('pending'), null), { kind: 'edit', label: 'Editar', href: '/sugerir?draft=c1' });
  assert.equal(contributionRowAction(row('pending', { taken_at: '2026-09-05T00:00:00Z' }), null), null);
  assert.equal(contributionTaken(row('pending')), false);
  assert.equal(contributionTaken(row('pending', { taken_at: '2026-09-05T00:00:00Z' })), true);
  assert.equal(contributionTaken(row('ready_for_admin')), true);
  // Pedir cambios también la toma, pero entonces el autor tiene "Corregir": no es "en revisión".
  assert.equal(contributionTaken(row('changes_requested', { taken_at: '2026-09-05T00:00:00Z' })), false);
});

test('U14: la fecha que importa en cada estado', () => {
  assert.deepEqual(contributionRowDate(row('draft')), { label: 'Guardado', value: '2026-09-04T00:00:00Z' });
  assert.deepEqual(contributionRowDate(row('pending')), { label: 'Enviado', value: '2026-09-02T00:00:00Z' });
  assert.deepEqual(contributionRowDate(row('ready_for_admin', { submitted_at: null })), { label: 'Enviado', value: '2026-09-04T00:00:00Z' });
  assert.deepEqual(contributionRowDate(row('rejected')), { label: 'Revisado', value: '2026-09-03T00:00:00Z' });
  assert.deepEqual(contributionRowDate(row('approved', { reviewed_at: null })), { label: 'Revisado', value: '2026-09-04T00:00:00Z' });
});

test('U14: los seis estados de E09 tienen tono', () => {
  assert.deepEqual(Object.keys(CONTRIBUTION_ROW_TONES).sort(), ['approved', 'changes_requested', 'draft', 'pending', 'ready_for_admin', 'rejected']);
});
