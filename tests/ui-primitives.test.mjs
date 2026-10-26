import test from 'node:test';
import assert from 'node:assert/strict';
import { paginationItems, clampPage } from '../src/lib/ui/pagination.ts';
import { evaluatePassword, DEFAULT_PASSWORD_RULES, PASSWORD_MIN_LENGTH } from '../src/lib/ui/password.ts';
import { readViewPreference, writeViewPreference, viewPreferenceKey } from '../src/lib/ui/viewPreference.ts';
import { ICONS, ICON_NAMES, SOCIAL_ICONS } from '../src/lib/ui/icons.ts';

// ---- Pagination -------------------------------------------------------------

test('U5 paginación: totales cortos muestran todas las páginas', () => {
  assert.deepEqual(paginationItems(1, 1), [1]);
  assert.deepEqual(paginationItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('U5 paginación: inicio, medio y final con huecos', () => {
  assert.deepEqual(paginationItems(1, 233), [1, 2, 3, 4, 5, 'gap', 233]);
  assert.deepEqual(paginationItems(4, 233), [1, 2, 3, 4, 5, 'gap', 233]);
  assert.deepEqual(paginationItems(5, 233), [1, 'gap', 4, 5, 6, 'gap', 233]);
  assert.deepEqual(paginationItems(50, 233), [1, 'gap', 49, 50, 51, 'gap', 233]);
  assert.deepEqual(paginationItems(230, 233), [1, 'gap', 229, 230, 231, 232, 233]);
  assert.deepEqual(paginationItems(233, 233), [1, 'gap', 229, 230, 231, 232, 233]);
});

test('U5 paginación: el número de elementos no cambia al avanzar (los botones no saltan)', () => {
  for (const total of [8, 9, 12, 233]) {
    const lengths = new Set(Array.from({ length: total }, (_, index) => paginationItems(index + 1, total).length));
    assert.equal(lengths.size, 1, `total ${total}: ${[...lengths]}`);
    for (let page = 1; page <= total; page += 1) {
      const items = paginationItems(page, total);
      assert.ok(items.includes(page), `la página actual ${page} siempre se ve`);
      assert.equal(items[0], 1);
      assert.equal(items.at(-1), total);
    }
  }
});

test('U5 paginación: entradas fuera de rango se acotan', () => {
  assert.deepEqual(paginationItems(99, 3), [1, 2, 3]);
  assert.deepEqual(paginationItems(0, 0), [1]);
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(11, 10), 10);
  assert.equal(clampPage(Number.NaN, 10), 1);
});

// ---- PasswordField ------------------------------------------------------------

test('U5 contraseña: solo la longitud mínima es obligatoria (la misma que el registro)', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.deepEqual(DEFAULT_PASSWORD_RULES.filter((rule) => rule.required).map((rule) => rule.id), ['longitud']);
  assert.equal(evaluatePassword('abcdefgh').valid, true);
  assert.equal(evaluatePassword('abc1234').valid, false);
});

test('U5 contraseña: reglas y fortaleza en vivo', () => {
  assert.equal(evaluatePassword('').strength, 'vacia');
  assert.equal(evaluatePassword('a1B').strength, 'debil');
  assert.equal(evaluatePassword('abcdefgh').strength, 'debil');
  assert.equal(evaluatePassword('abcdefg1').strength, 'aceptable');
  assert.equal(evaluatePassword('Abcdef1!').strength, 'aceptable', 'corta: la variedad no basta para "fuerte"');
  assert.equal(evaluatePassword('Abcdefgh123!').strength, 'fuerte');
  assert.equal(evaluatePassword('una frase larga para recordar').strength, 'fuerte', 'una frase larga es fuerte');

  const rules = Object.fromEntries(evaluatePassword('discotica').rules.map((rule) => [rule.id, rule.met]));
  assert.deepEqual(rules, { longitud: true, 'letras-numeros': false, 'mayuscula-simbolo': false });
  const all = evaluatePassword('Discotica2026').rules.every((rule) => rule.met);
  assert.equal(all, true);
});

test('U5 contraseña: letras y números con acentos y ñ cuentan', () => {
  const met = Object.fromEntries(evaluatePassword('ñandú2026').rules.map((rule) => [rule.id, rule.met]));
  assert.equal(met['letras-numeros'], true);
});

// ---- ViewToggle ---------------------------------------------------------------

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), data };
}

test('U5 vista: se recuerda por contexto', () => {
  const storage = memoryStorage();
  assert.equal(readViewPreference('inicio', storage), null);
  assert.equal(writeViewPreference('inicio', 'list', storage), true);
  assert.equal(writeViewPreference('coleccion', 'grid', storage), true);
  assert.equal(readViewPreference('inicio', storage), 'list');
  assert.equal(readViewPreference('coleccion', storage), 'grid');
  assert.equal(storage.data.get(viewPreferenceKey('inicio')), 'list');
});

test('U5 vista: almacenamiento bloqueado, ausente o con basura no rompe nada', () => {
  const throwing = {
    getItem() { throw new DOMException('bloqueado', 'SecurityError'); },
    setItem() { throw new DOMException('lleno', 'QuotaExceededError'); }
  };
  assert.equal(readViewPreference('inicio', throwing), null);
  assert.equal(writeViewPreference('inicio', 'list', throwing), false);
  assert.equal(readViewPreference('inicio', null), null);
  assert.equal(writeViewPreference('inicio', 'list', null), false);

  const storage = memoryStorage();
  storage.setItem(viewPreferenceKey('inicio'), 'mosaico');
  assert.equal(readViewPreference('inicio', storage), null);
  // Sin localStorage global (Node), el valor por defecto también es seguro.
  assert.equal(readViewPreference('inicio'), null);
});

// ---- Iconos -------------------------------------------------------------------

test('U5 iconos: el juego pedido existe, con las cinco redes del perfil', () => {
  for (const name of ['buscar', 'salir', 'compartir', 'reportar', 'menu', 'cerrar', 'flecha-izquierda', 'flecha-derecha', 'grilla', 'lista', 'mas-opciones']) {
    assert.ok(ICON_NAMES.includes(name), name);
  }
  assert.deepEqual([...SOCIAL_ICONS], ['bandcamp', 'soundcloud', 'instagram', 'x', 'facebook']);
  for (const name of ICON_NAMES) {
    const icon = ICONS[name];
    assert.ok(icon.paths.length > 0, name);
    for (const path of icon.paths) assert.match(typeof path === 'string' ? path : path.d, /^M/, name);
  }
});

test('U10b iconos: filtros son tres deslizadores, cada uno con su mando', () => {
  const paths = ICONS.filtros.paths;
  assert.equal(paths.length, 9);
  assert.ok(paths.every((path) => typeof path === 'string'), 'trazo, sin relleno');
});

test('U5 iconos: el menú son tres barras iguales y equidistantes', () => {
  const bars = ICONS.menu.paths.map((path) => path.match(/^M(\d+) (\d+)h(\d+)$/).slice(1).map(Number));
  assert.equal(bars.length, 3);
  assert.equal(new Set(bars.map(([x, , w]) => `${x}:${w}`)).size, 1, 'mismo inicio y largo');
  assert.equal(bars[1][1] - bars[0][1], bars[2][1] - bars[1][1], 'misma separación');
});
