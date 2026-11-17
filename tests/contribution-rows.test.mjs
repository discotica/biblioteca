import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRIBUTION_ROW_TONES,
  contributionCounts,
  contributionRowAction,
  contributionRowDate,
  contributionTaken,
  fechaAporte,
  groupContributions
} from '../src/lib/domain/contributionRows.ts';

const row = (status, extra = {}) => ({
  id: 'c1', status, submitted_at: '2026-09-02T00:00:00Z', reviewed_at: '2026-09-03T00:00:00Z',
  updated_at: '2026-09-04T00:00:00Z', release_id: null, ...extra
});

test('U14 y U31: una acción como mucho por aporte; el borrador se edita', () => {
  assert.deepEqual(contributionRowAction(row('draft'), null), { kind: 'resume', label: 'Editar', href: '/sugerir?draft=c1' });
  assert.deepEqual(contributionRowAction(row('changes_requested'), null), { kind: 'fix', label: 'Corregir', href: '/sugerir?draft=c1' });
  assert.deepEqual(contributionRowAction(row('approved', { release_id: 'r1' }), 'mi-disco'), { kind: 'view', label: 'Ver lanzamiento', href: '/lanzamiento/mi-disco' });
  // Aceptado pero ya no publicado: sin enlace.
  assert.equal(contributionRowAction(row('approved', { release_id: 'r1' }), null), null);
  assert.equal(contributionRowAction(row('rejected'), 'x'), null);
});

test('U19 y U31: el autor edita lo enviado hasta que el equipo lo toma; después, «Editar» desactivado', () => {
  assert.deepEqual(contributionRowAction(row('pending'), null), { kind: 'edit', label: 'Editar', href: '/sugerir?draft=c1' });
  const locked = { kind: 'locked', label: 'Editar', href: '/sugerir?draft=c1' };
  assert.deepEqual(contributionRowAction(row('pending', { taken_at: '2026-09-05T00:00:00Z' }), null), locked);
  assert.deepEqual(contributionRowAction(row('ready_for_admin'), 'x'), locked);
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

test('U31: tres grupos en orden fijo; dentro, primero lo que pide algo y luego el orden recibido', () => {
  const rows = [
    row('approved', { id: 'a1' }), row('draft', { id: 'd1' }), row('pending', { id: 'p1' }),
    row('changes_requested', { id: 'c1' }), row('rejected', { id: 'r1' }), row('ready_for_admin', { id: 'l1' }),
    row('draft', { id: 'd2' }), row('approved', { id: 'a2' })
  ];
  const groups = groupContributions(rows);
  assert.deepEqual(groups.map((g) => [g.id, g.label, g.rows.map((r) => r.id)]), [
    ['por-resolver', 'Por resolver', ['c1', 'd1', 'd2']],
    ['en-revision', 'En revisión', ['p1', 'l1']],
    ['resueltos', 'Resueltos', ['a1', 'r1', 'a2']]
  ]);
  // Un grupo sin filas no aparece.
  assert.deepEqual(groupContributions([row('draft')]).map((g) => g.id), ['por-resolver']);
  assert.deepEqual(groupContributions([]), []);
});

test('U31: cifras de Mis aportes (lanzamientos, en revisión y aceptados)', () => {
  const rows = ['draft', 'pending', 'ready_for_admin', 'changes_requested', 'approved', 'approved', 'rejected'].map((s) => row(s));
  assert.deepEqual(contributionCounts(rows), { total: 7, enRevision: 2, aceptados: 2 });
  assert.deepEqual(contributionCounts([]), { total: 0, enRevision: 0, aceptados: 0 });
});

test('U31: la fecha va corta y sin punto («5 nov 2026»)', () => {
  assert.equal(fechaAporte('2026-11-05T12:00:00'), '5 nov 2026');
  assert.equal(fechaAporte('2026-09-30T12:00:00'), '30 sept 2026');
  assert.equal(fechaAporte('2026-01-02T12:00:00'), '2 ene 2026');
});
