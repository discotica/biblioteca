import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDEPENDENT_LABEL,
  compareNames,
  doneScreen,
  duplicateNotice,
  pinIndependent,
  similarSearchTerms,
  submitLabel
} from '../src/lib/domain/suggestFlow.ts';

// U19 G2: un solo flujo para crear. Sugerir decide el envío y la pantalla final por rol.
test('U19 Sugerir: «Independiente» va primero y una sola vez', () => {
  assert.deepEqual(pinIndependent([]), [INDEPENDENT_LABEL]);
  assert.deepEqual(pinIndependent(['Sello A', 'independiente', 'Sello B']), ['Independiente', 'Sello A', 'Sello B']);
});

test('U19 Sugerir: nombres parecidos sin tildes, espacios ni mayúsculas, y el exacto no avisa', () => {
  assert.deepEqual(compareNames('ela minus', ['Ela Minus', 'Ela Minus Trío']), { exact: 'Ela Minus', similar: [] });
  assert.deepEqual(compareNames('Triphop', ['Trip Hop', 'Hip Hop']).similar, ['Trip Hop']);
  assert.deepEqual(compareNames('Pirañas', ['Los Pirañas', 'Piraña Records', 'Otro']).similar, ['Los Pirañas']);
  assert.deepEqual(compareNames('Sonido Gallo', ['Sonido Gallo Negro', 'Gallo Rojo', 'Sonidos']).similar, ['Sonido Gallo Negro', 'Gallo Rojo']);
  assert.deepEqual(compareNames('Nadie', ['Otro']).similar, []);
  assert.equal(compareNames('Uno', ['Uno A', 'Uno B', 'Uno C', 'Uno D']).similar.length, 3, 'tres como máximo');
});

test('U19 Sugerir: los parecidos se buscan por hasta tres palabras, las más largas primero', () => {
  assert.deepEqual(similarSearchTerms('Los Pirañas'), ['Pirañas', 'Los']);
  // Hallazgo del stack local: buscar solo «Records» no encontraba «Sello Raro».
  assert.deepEqual(similarSearchTerms('Sello Raro Records'), ['Records', 'Sello', 'Raro']);
  assert.deepEqual(similarSearchTerms('La Banda de la Banda Sur'), ['Banda', 'Sur']);
  assert.deepEqual(similarSearchTerms(' DJ '), ['DJ']);
});

test('U19 Sugerir: el botón y la pantalla final dicen lo que hace cada rol', () => {
  assert.equal(submitLabel('comunidad'), 'Enviar a revisión');
  assert.equal(submitLabel('colaborador'), 'Enviar a revisión');
  assert.equal(submitLabel('admin'), 'Crear borrador');

  const labels = (role, href = null) => doneScreen(role, href).actions.map((action) => action.label);
  assert.deepEqual(labels('comunidad'), ['Ver mis aportes', 'Sugerir otro']);
  assert.deepEqual(labels('colaborador'), ['Ir al Estudio', 'Sugerir otro']);
  assert.deepEqual(labels('admin', '/estudio/catalogo?lanzamiento=r1'), ['Abrir el borrador', 'Ir al Estudio', 'Añadir otro']);
  assert.equal(doneScreen('admin', '/estudio/catalogo?lanzamiento=r1').actions[0].href, '/estudio/catalogo?lanzamiento=r1');
  assert.equal(doneScreen('admin', null).title, 'Borrador creado');
});

test('U19 Sugerir: aviso de duplicado según lo que devuelve el servidor', () => {
  const none = { match: 'none', state: null, release_slug: null, release_id: null, contribution_id: null };
  assert.equal(duplicateNotice(none, { role: 'comunidad' }), null);
  assert.equal(duplicateNotice(null, { role: 'comunidad' }), null);
  assert.equal(duplicateNotice(/** @type {any} */ ([]), { role: 'comunidad' }), null, 'una respuesta sin forma no avisa');

  const published = duplicateNotice({ ...none, match: 'catalog', state: 'published', release_slug: 'pulso' }, { role: 'comunidad' });
  assert.deepEqual(published, { text: 'Este enlace ya está en el catálogo.', link: { label: 'Ver la ficha', href: '/lanzamiento/pulso' } });

  // Un borrador del catálogo: solo admin recibe el id y el enlace al Estudio.
  assert.deepEqual(duplicateNotice({ ...none, match: 'catalog', state: 'draft' }, { role: 'colaborador' }), { text: 'Este enlace ya está en el catálogo, como borrador.', link: null });
  assert.equal(duplicateNotice({ ...none, match: 'catalog', state: 'draft', release_id: 'r1' }, { role: 'admin' })?.link?.href, '/estudio/catalogo?lanzamiento=r1');

  // Cola: la propuesta ajena no se enlaza; la propia sí; la que se está editando no avisa.
  const queue = { ...none, match: 'queue', state: 'pending' };
  assert.deepEqual(duplicateNotice(queue, { role: 'comunidad' }), { text: 'Alguien ya propuso este enlace y está en revisión.', link: null });
  assert.equal(duplicateNotice(queue, { role: 'colaborador' })?.link?.href, '/estudio/propuestas');
  assert.equal(duplicateNotice({ ...queue, contribution_id: 'c1' }, { role: 'comunidad' })?.link?.href, '/mis-aportes');
  assert.equal(duplicateNotice({ ...queue, state: 'draft', contribution_id: 'c1' }, { role: 'comunidad' })?.link?.href, '/sugerir?draft=c1');
  assert.equal(duplicateNotice({ ...queue, state: 'draft', contribution_id: 'c1' }, { role: 'comunidad', draftId: 'c1' }), null);
  assert.equal(duplicateNotice({ ...queue, contribution_id: 'c1' }, { role: 'admin' })?.link?.href, '/estudio/propuestas?propuesta=c1');
});
