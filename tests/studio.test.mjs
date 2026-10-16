import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchItemText,
  batchRejectionText,
  batchSummary,
  catalogHref,
  legacyStudioHref,
  quickViewFromSlug,
  quickViewSlug,
  studioReleaseHref,
  studioReportsHref,
  studioProposalsHref,
  studioSectionOf,
  studioSectionsFor,
  withParams
} from '../src/lib/domain/studio.ts';

const ON = { adminCatalog: true, editorial: true };

test('U15: cada rol ve las mismas secciones que antes (U19 G4: más Diccionarios para admin)', () => {
  assert.deepEqual(studioSectionsFor('admin', ON), ['catalogo', 'propuestas', 'reportes', 'diccionarios']);
  assert.deepEqual(studioSectionsFor('colaborador', ON), ['propuestas']);
  assert.deepEqual(studioSectionsFor('comunidad', ON), []);
  assert.deepEqual(studioSectionsFor('', ON), []);
});

test('U15: cada interruptor apaga solo sus secciones', () => {
  assert.deepEqual(studioSectionsFor('admin', { adminCatalog: false, editorial: true }), ['propuestas', 'reportes']);
  assert.deepEqual(studioSectionsFor('admin', { adminCatalog: true, editorial: false }), ['catalogo', 'diccionarios']);
  assert.deepEqual(studioSectionsFor('colaborador', { adminCatalog: true, editorial: false }), []);
});

test('U15: las rutas anteriores van a su sección conservando query y hash', () => {
  assert.equal(legacyStudioHref('/admin/catalogo'), '/estudio/catalogo');
  assert.equal(legacyStudioHref('/admin/catalogo/', '?nuevo=1', '#x'), '/estudio/catalogo?nuevo=1#x');
  assert.equal(legacyStudioHref('/editorial', '?a=1&b=2'), '/estudio/propuestas?a=1&b=2');
  for (const path of ['/admin', '/admin/catalogo/x', '/editorial/x', '/estudio', '/editoriales']) {
    assert.equal(legacyStudioHref(path, '?q=1'), null, path);
  }
});

test('U15: la sección sale de la ruta', () => {
  assert.equal(studioSectionOf('/estudio/catalogo'), 'catalogo');
  assert.equal(studioSectionOf('/estudio/reportes/'), 'reportes');
  assert.equal(studioSectionOf('/estudio'), null);
  assert.equal(studioSectionOf('/estudio/otra'), null);
});

test('U15: vistas rápidas en la URL en español, ida y vuelta', () => {
  for (const [value, slug] of [['draft', 'borradores'], ['incomplete', 'incompletos'], ['missing_cover', 'sin-portada'], ['open_reports', 'con-reportes']]) {
    assert.equal(quickViewSlug(value), slug);
    assert.equal(quickViewFromSlug(slug), value);
  }
  assert.equal(quickViewFromSlug('draft'), null);
  assert.equal(quickViewFromSlug(null), null);
  assert.equal(catalogHref(), '/estudio/catalogo');
  assert.equal(catalogHref('missing_cover'), '/estudio/catalogo?vista=sin-portada');
});

test('U15: enlaces cruzados', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(studioReleaseHref(id), `/estudio/catalogo?lanzamiento=${id}`);
  assert.equal(studioReportsHref(id), `/estudio/reportes?lanzamiento=${id}`);
  assert.equal(studioProposalsHref(id), `/estudio/propuestas?lanzamiento=${id}`);
  assert.equal(studioReportsHref(), '/estudio/reportes');
});

test('U15: withParams pone y quita parámetros sin tocar los demás', () => {
  const url = new URL('https://x.test/estudio/catalogo?vista=incompletos#t');
  assert.equal(withParams(url, { lanzamiento: 'a' }), '/estudio/catalogo?vista=incompletos&lanzamiento=a#t');
  assert.equal(withParams(url, { vista: null }), '/estudio/catalogo#t');
});

test('U15: informe del lote sin códigos internos', () => {
  for (const code of ['40001', '23514', '22023', 'P0002', '23502', '42501', 'XX000']) {
    assert.doesNotMatch(batchRejectionText(code), /\d{4}|E0\d|D2/, code);
  }
  assert.equal(batchItemText('publish', { result: 'applied' }), 'Publicado');
  assert.equal(batchItemText('archive', { result: 'unchanged' }), 'Ya estaba archivado');
  assert.match(batchItemText('publish', { result: 'rolled_back' }), /otro elemento/);
  assert.match(batchItemText('publish', { result: 'rejected', error: { code: '23514', message: 'x' } }), /faltan datos/);
});

test('U15: resumen del lote', () => {
  assert.equal(batchSummary('publish', { applied: true, applied_count: 2, unchanged_count: 0, rejected_count: 0 }), 'Se publicaron 2 lanzamientos.');
  assert.equal(batchSummary('archive', { applied: true, applied_count: 1, unchanged_count: 2, rejected_count: 0 }), 'Se archivó 1 lanzamiento; 2 ya lo estaban.');
  assert.equal(batchSummary('publish', { applied: true, applied_count: 0, unchanged_count: 3, rejected_count: 0 }), 'No hubo cambios: todos ya lo estaban.');
  assert.match(batchSummary('publish', { applied: false, applied_count: 0, unchanged_count: 0, rejected_count: 1 }), /^No cambió nada: 1 lanzamiento no se pudo publicar/);
});
