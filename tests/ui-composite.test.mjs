import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreate, filterOptions, normalizeSearch } from '../src/lib/ui/combobox.ts';
import { edgeScrollSpeed, keyboardTarget, moveItem, previewOffsets, previewOrder, targetIndex } from '../src/lib/ui/sortable.ts';
import { creditRoleGroups, creditRoleLabel, defaultArtistHref } from '../src/lib/ui/credits.ts';
import { ICON_NAMES } from '../src/lib/ui/icons.ts';

// ---- Combobox -----------------------------------------------------------------

const options = ['Progresivo', 'Techno', 'Tech house', 'Electrónica', 'Música electrónica', 'House'].map((label) => ({
  value: label.toLowerCase(),
  label,
  keywords: label === 'Progresivo' ? ['Progressive'] : undefined
}));

test('U6 combobox: busca sin tildes, mayúsculas ni espacios de más', () => {
  assert.equal(normalizeSearch('  Música   ELECTRÓNICA '), 'musica electronica');
  assert.deepEqual(filterOptions(options, 'electronica').map((o) => o.label), ['Electrónica', 'Música electrónica']);
});

test('U6 combobox: ordena igual, empieza por, palabra que empieza por y contiene', () => {
  assert.deepEqual(filterOptions(options, 'house').map((o) => o.label), ['House', 'Tech house']);
  assert.deepEqual(filterOptions(options, 'tech').map((o) => o.label), ['Techno', 'Tech house']);
  assert.deepEqual(filterOptions(options, 'ctro').map((o) => o.label), ['Electrónica', 'Música electrónica']);
});

test('U6 combobox: las grafías alternativas encuentran la opción', () => {
  assert.deepEqual(filterOptions(options, 'progressive').map((o) => o.label), ['Progresivo']);
});

test('U6 combobox: sin texto devuelve todas, con límite', () => {
  assert.equal(filterOptions(options, '').length, options.length);
  assert.equal(filterOptions(options, '', 2).length, 2);
  assert.equal(filterOptions(options, 'e', 3).length, 3);
});

test('U6 combobox: solo se ofrece crear cuando nada se llama igual', () => {
  assert.equal(canCreate(options, [], ''), false);
  assert.equal(canCreate(options, [], '   '), false);
  assert.equal(canCreate(options, [], 'techno'), false, 'ya existe, sin distinguir mayúsculas');
  assert.equal(canCreate(options, [], 'electronica'), false, 'ya existe, sin distinguir tildes');
  assert.equal(canCreate(options, ['Nuevo género'], 'nuevo genero'), false, 'ya elegido');
  assert.equal(canCreate(options, [], 'Tech'), true, 'coincidencia parcial no bloquea');
});

// ---- Sortable -----------------------------------------------------------------

test('U6 ordenable: mover conserva los elementos y no muta la entrada', () => {
  const items = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(items, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(items, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveItem(items, 1, 1), items);
  assert.deepEqual(moveItem(items, 1, 99), ['a', 'c', 'd', 'b']);
  assert.deepEqual(items, ['a', 'b', 'c', 'd']);
  assert.deepEqual(previewOrder(4, 2, 0), [2, 0, 1, 3]);
});

// Filas de alto distinto con 8 px entre ellas.
const rows = [
  { x: 0, y: 0, w: 300, h: 40 },
  { x: 0, y: 48, w: 300, h: 80 },
  { x: 0, y: 136, w: 300, h: 40 },
  { x: 0, y: 184, w: 300, h: 40 }
];

test('U6 ordenable: destino en lista según los centros de las demás filas', () => {
  assert.equal(targetIndex('list', rows, 0, { x: 150, y: 20 }), 0);
  assert.equal(targetIndex('list', rows, 0, { x: 150, y: 100 }), 1, 'pasa el centro de la fila alta');
  assert.equal(targetIndex('list', rows, 0, { x: 150, y: 400 }), 3);
  assert.equal(targetIndex('list', rows, 3, { x: 150, y: -50 }), 0);
});

test('U6 ordenable: la vista previa en lista apila las alturas reales', () => {
  // La fila 0 (40) baja al final: las demás suben 48 (su alto + el espacio).
  assert.deepEqual(previewOffsets('list', rows, 0, 3), [
    { x: 0, y: 0 },
    { x: 0, y: -48 },
    { x: 0, y: -48 },
    { x: 0, y: -48 }
  ]);
  // La fila alta (80) sube al principio: la 0 baja 88.
  assert.deepEqual(previewOffsets('list', rows, 1, 0), [
    { x: 0, y: 88 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ]);
  assert.deepEqual(previewOffsets('list', rows, 2, 2).every((o) => !o.x && !o.y), true);
});

// Grilla de 3 columnas.
const cells = Array.from({ length: 6 }, (_, i) => ({ x: (i % 3) * 110, y: Math.floor(i / 3) * 110, w: 100, h: 100 }));

test('U6 ordenable: destino y vista previa en grilla', () => {
  assert.equal(targetIndex('grid', cells, 0, { x: 270, y: 160 }), 5);
  assert.equal(targetIndex('grid', cells, 4, { x: 60, y: 40 }), 0);
  const offsets = previewOffsets('grid', cells, 0, 4);
  // 1→0, 2→1, 3→2 (sube de fila), 4→3; 5 no se mueve.
  assert.deepEqual(offsets[1], { x: -110, y: 0 });
  assert.deepEqual(offsets[3], { x: 220, y: -110 });
  assert.deepEqual(offsets[4], { x: -110, y: 0 });
  assert.deepEqual(offsets[5], { x: 0, y: 0 });
});

test('U6 ordenable: teclas del asa', () => {
  assert.equal(keyboardTarget('ArrowUp', 2, 5), 1);
  assert.equal(keyboardTarget('ArrowLeft', 0, 5), 0, 'acotado arriba');
  assert.equal(keyboardTarget('ArrowDown', 4, 5), 4, 'acotado abajo');
  assert.equal(keyboardTarget('ArrowRight', 1, 5), 2);
  assert.equal(keyboardTarget('Home', 3, 5), 0);
  assert.equal(keyboardTarget('End', 0, 5), 4);
  assert.equal(keyboardTarget('Enter', 1, 5), null);
});

test('U6 ordenable: auto-scroll solo cerca de los bordes', () => {
  assert.equal(edgeScrollSpeed(500, 0, 1000, 48), 0);
  assert.ok(edgeScrollSpeed(10, 0, 1000, 48) < 0);
  assert.ok(edgeScrollSpeed(995, 0, 1000, 48) > 0);
  assert.ok(Math.abs(edgeScrollSpeed(-200, 0, 1000, 48)) <= 18, 'velocidad acotada');
});

// ---- Créditos por rol -----------------------------------------------------------

const credit = (name, slug = name.toLowerCase()) => ({ id: slug, slug, name, position: 0 });

test('U6 créditos: grupos por rol, en singular o plural', () => {
  const groups = creditRoleGroups({ primaryArtists: [credit('Ana')], collaborators: [credit('Beto'), credit('Caro')] });
  assert.deepEqual(groups.map((g) => [g.role, g.label, g.credits.length]), [
    ['primary', 'Artista principal', 1],
    ['collaborator', 'Colaboradores', 2]
  ]);
  assert.equal(creditRoleLabel('primary', 2), 'Artistas principales');
  assert.equal(creditRoleLabel('collaborator', 1), 'Colaborador');
  assert.deepEqual(creditRoleGroups({ primaryArtists: [], collaborators: [] }), []);
  assert.deepEqual(creditRoleGroups({ primaryArtists: [], collaborators: [credit('Beto')] }).map((g) => g.role), ['collaborator']);
});

test('U6 créditos: solo se enlaza con slug', () => {
  assert.equal(defaultArtistHref(credit('Ana')), '/artista/ana');
  assert.equal(defaultArtistHref({ id: null, slug: null, name: 'Sin enlace', position: 0 }), null);
});

test('U6 iconos: el asa del ordenable existe', () => {
  assert.ok(ICON_NAMES.includes('arrastrar'));
});
