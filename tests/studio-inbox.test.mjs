import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_STATUS_TONES,
  inboxNeighbor,
  proposalAction,
  proposalDetection,
  proposalFields,
  proposalGroups,
  reportContextRows,
  reportGroups,
  selectInboxItem
} from '../src/lib/domain/studioInbox.ts';

const TYPES = [
  { value: 'album', label: 'Álbum' },
  { value: 'ep', label: 'EP' },
  { value: 'single', label: 'Single' },
  { value: 'compilado', label: 'Compilado' },
  { value: 'sample-pack', label: 'Sample Pack' }
];

const payload = (over = {}) => ({
  version: 2, title: 'Disco', primary_artists: ['Ana', 'Beto'], collaborators: [], release_type: 'album',
  release_date: '2026-09-01', genres: ['Techno'], countries: ['Colombia'], label: '', team_note: '', ...over
});
const proposal = (over = {}) => ({
  id: 'p1', author_id: 'u-comunidad', status: 'pending', queue_kind: 'community', release_id: null,
  payload: payload(), detected_metadata: { source_available: true, title: 'Disco', artists: ['Ana', 'Beto'], type: 'Álbum', release_date: '2026-09-01' },
  ...over
});
const edited = (fields) => fields.filter((field) => field.edited).map((field) => field.key);

test('U17: el detalle muestra solo lo propuesto, en el orden de Sugerir', () => {
  const fields = proposalFields(proposal(), TYPES);
  assert.deepEqual(fields.map((field) => field.label), ['Título', 'Artistas principales', 'Colaboradores', 'Tipo', 'Fecha', 'Sello', 'Géneros', 'Países']);
  assert.deepEqual(fields.find((field) => field.key === 'primary_artists').values, ['Ana', 'Beto']);
  assert.equal(fields.find((field) => field.key === 'release_type').value, 'Álbum');
  // Vacío se ve como vacío, no como hueco.
  assert.equal(fields.find((field) => field.key === 'label').value, '');
  assert.deepEqual(fields.find((field) => field.key === 'collaborators').values, []);
  assert.deepEqual(edited(fields), []);
});

test('U17: se marcan los campos que difieren de lo detectado', () => {
  const fields = proposalFields(proposal({
    payload: payload({ title: 'Disco (edición)', primary_artists: ['Beto', 'Ana'], release_type: 'ep', release_date: '2026-09-02' })
  }), TYPES);
  assert.deepEqual(edited(fields), ['title', 'primary_artists', 'release_type', 'release_date']);
  // Mayúsculas y tildes también son una edición; los espacios de los bordes no.
  assert.deepEqual(edited(proposalFields(proposal({ payload: payload({ title: 'disco ' }) }), TYPES)), ['title']);
  assert.deepEqual(edited(proposalFields(proposal({ payload: payload({ title: '  Disco  ' }) }), TYPES)), []);
});

test('U17: el tipo detectado es un nombre y se compara sin tildes con el tipo propuesto', () => {
  const sameType = (type, slug) => edited(proposalFields(proposal({
    detected_metadata: { source_available: true, type }, payload: payload({ release_type: slug })
  }), TYPES));
  assert.deepEqual(sameType('Album', 'album'), []);
  assert.deepEqual(sameType('Single', 'single'), []);
  assert.deepEqual(sameType('Single', 'album'), ['release_type']);
  // Tipo sin confirmar frente a uno detectado: editado (quedó vacío).
  assert.deepEqual(sameType('Álbum', ''), ['release_type']);
});

test('U17: lo que la fuente no detecta nunca se marca', () => {
  const fields = proposalFields(proposal({
    detected_metadata: { source_available: true, title: 'Disco' },
    payload: payload({ primary_artists: ['Otra'], collaborators: ['X'], genres: ['House'], label: 'Sello', release_type: 'ep' })
  }), TYPES);
  assert.deepEqual(edited(fields), []);
  assert.deepEqual(fields.filter((field) => field.detected).map((field) => field.key), ['title']);
});

test('U17: estado de la detección', () => {
  assert.equal(proposalDetection(proposal()), 'available');
  assert.equal(proposalDetection(proposal({ detected_metadata: { source_available: false } })), 'unavailable');
  assert.equal(proposalDetection(proposal({ detected_metadata: {} })), 'unavailable');
  assert.equal(proposalDetection(proposal({ detected_metadata: null })), 'unavailable');
  // Sin detección no hay marcas.
  assert.deepEqual(edited(proposalFields(proposal({ detected_metadata: { source_available: false, title: 'Otro' } }), TYPES)), []);
});

test('U17: grupos de la bandeja por rol, con los mismos filtros que la estación de E10', () => {
  const community = proposal({ id: 'c' });
  const ready = proposal({ id: 'r', status: 'ready_for_admin' });
  const collab = proposal({ id: 'k', queue_kind: 'collaborator', author_id: 'u-colab' });
  const admin = proposalGroups([community, ready, collab], 'admin', false);
  assert.deepEqual(admin.map((group) => [group.id, group.label, group.items.map((item) => item.id)]), [
    ['priority', 'Cola prioritaria', ['r', 'k']],
    ['community', 'Cola comunitaria', ['c']]
  ]);
  // Colaborador: primero lo que puede preparar; sus aportes, solo si los hay.
  const colab = proposalGroups([community, collab], 'colaborador', false);
  assert.deepEqual(colab.map((group) => [group.id, group.label, group.items.map((item) => item.id)]), [
    ['community', 'Cola comunitaria', ['c']],
    ['own', 'Mis aportes prioritarios', ['k']]
  ]);
  assert.deepEqual(proposalGroups([community], 'colaborador', false).map((group) => group.id), ['community']);
  // Filtro por lanzamiento: un solo grupo, sea cual sea el estado.
  const byRelease = proposalGroups([proposal({ status: 'approved', release_id: 'x' })], 'admin', true);
  assert.deepEqual(byRelease.map((group) => [group.id, group.items.length]), [['release', 1]]);
});

test('U17: acciones por rol, iguales a las de E10', () => {
  assert.equal(proposalAction(proposal(), 'admin', 'u-admin'), 'review');
  assert.equal(proposalAction(proposal({ status: 'ready_for_admin' }), 'admin', 'u-admin'), 'review');
  assert.equal(proposalAction(proposal(), 'colaborador', 'u-colab'), 'prepare');
  // Sin auto-preparación ni preparación de lo ya preparado o de la cola prioritaria.
  assert.equal(proposalAction(proposal({ author_id: 'u-colab' }), 'colaborador', 'u-colab'), 'waiting');
  assert.equal(proposalAction(proposal({ status: 'ready_for_admin' }), 'colaborador', 'u-colab'), 'waiting');
  assert.equal(proposalAction(proposal({ queue_kind: 'collaborator', author_id: 'u-colab' }), 'colaborador', 'u-colab'), 'waiting');
  // Resueltas: solo consulta, también para admin.
  for (const status of ['approved', 'rejected', 'changes_requested', 'draft']) {
    assert.equal(proposalAction(proposal({ status }), 'admin', 'u-admin'), 'none');
  }
});

test('U17: selección de la bandeja', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(selectInboxItem(ids, 'b', true), 'b');
  assert.equal(selectInboxItem(ids, 'b', false), 'b');
  // Ancho: sin elegir (o con un id que ya no está), la primera. Móvil: la lista.
  assert.equal(selectInboxItem(ids, null, true), 'a');
  assert.equal(selectInboxItem(ids, 'z', true), 'a');
  assert.equal(selectInboxItem(ids, null, false), null);
  assert.equal(selectInboxItem(ids, 'z', false), null);
  assert.equal(selectInboxItem([], null, true), null);
});

test('U17: tras resolver un elemento se pasa al siguiente, o al anterior si era el último', () => {
  assert.equal(inboxNeighbor(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(inboxNeighbor(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(inboxNeighbor(['a'], 'a'), null);
  assert.equal(inboxNeighbor(['a', 'b'], 'z'), null);
});

test('U17: reportes abiertos y cerrados, con los estados de E18 traducidos', () => {
  const report = (id, status) => ({ id, status });
  const groups = reportGroups([report('1', 'new'), report('2', 'resolved'), report('3', 'in_progress'), report('4', 'closed'), report('5', 'triaged')]);
  assert.deepEqual(groups.map((group) => [group.id, group.label, group.items.map((item) => item.id)]), [
    ['open', 'Abiertos', ['1', '3', '5']],
    ['closed', 'Resueltos y cerrados', ['2', '4']]
  ]);
  assert.deepEqual(Object.keys(REPORT_STATUS_TONES).sort(), ['closed', 'in_progress', 'new', 'resolved', 'triaged']);
});

test('U17: contexto técnico de un reporte en palabras, solo con las claves permitidas por E18', () => {
  const rows = reportContextRows({
    route: '/lanzamiento/x', release_id: 'r1', timestamp: '2026-09-29T12:00:00Z', app_version: '1.2.0',
    catalog_source: 'canonical', user_agent: 'Mozilla/5.0', viewport: { width: 390, height: 844 }, locale: 'es-CO', online: true,
    cookie: 'no debería verse'
  });
  assert.deepEqual(rows, [
    { label: 'Ruta', value: '/lanzamiento/x' },
    { label: 'Pantalla', value: '390 × 844' },
    { label: 'Navegador', value: 'Mozilla/5.0' },
    { label: 'Idioma', value: 'es-CO' },
    { label: 'Conexión', value: 'En línea' },
    { label: 'Versión', value: '1.2.0' },
    { label: 'Catálogo', value: 'canonical' }
  ]);
  assert.deepEqual(reportContextRows({}), []);
  assert.deepEqual(reportContextRows(null), []);
  assert.deepEqual(reportContextRows({ online: false }), [{ label: 'Conexión', value: 'Sin conexión' }]);
});
