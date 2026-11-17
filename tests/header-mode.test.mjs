// U28: variante del cabecero por ruta y el hook de U30 (`header` en el load).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerModeFor } from '../src/lib/components/headerMode.ts';
import { ICONS } from '../src/lib/ui/icons.ts';

test('U28 cabecero: completo por defecto, acceso en Entrar y mínimo en los pasos de Crear cuenta', () => {
  assert.equal(headerModeFor('/'), 'completo');
  assert.equal(headerModeFor('/estudio/catalogo'), 'completo');
  assert.equal(headerModeFor('/auth/login'), 'acceso');
  assert.equal(headerModeFor('/auth/registro'), 'minimo');
  assert.equal(headerModeFor('/auth/registro/nombre'), 'minimo');
  assert.equal(headerModeFor('/auth/recuperar'), 'completo');
});

test('U28 cabecero: lo que declara la ruta manda y lo desconocido se ignora', () => {
  assert.equal(headerModeFor('/bienvenida', 'minimo'), 'minimo');
  assert.equal(headerModeFor('/auth/registro', 'completo'), 'completo');
  assert.equal(headerModeFor('/auth/login', 'otro'), 'acceso');
  assert.equal(headerModeFor('/', 42), 'completo');
});

test('U28 iconos: ayuda (Manual del panel) es de trazo', () => {
  assert.ok(ICONS.ayuda.paths.length === 3);
  assert.ok(!('filled' in ICONS.ayuda));
});
