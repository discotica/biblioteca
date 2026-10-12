import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLoginIdentifier,
  retryAfterSeconds,
  safeRedirect,
  webmailFor
} from '../src/lib/domain/account.ts';

test('U12: con @ se entra por correo; sin @, por usuario', () => {
  assert.deepEqual(parseLoginIdentifier('  Persona@Example.com '), { kind: 'email', email: 'persona@example.com' });
  assert.deepEqual(parseLoginIdentifier('Cumbiero_Total'), { kind: 'username', username: 'cumbiero_total' });
  assert.deepEqual(parseLoginIdentifier('a-b_c'), { kind: 'username', username: 'a-b_c' });
});

test('U12: un usuario con formato imposible no se envía', () => {
  for (const value of ['', '   ', 'ab', 'con espacio', 'ñandú', 'x'.repeat(31)]) {
    assert.deepEqual(parseLoginIdentifier(value), { kind: 'invalid' }, value);
  }
});

test('U12: "Abrir correo" solo para Gmail, Outlook e iCloud', () => {
  assert.equal(webmailFor('a@gmail.com')?.label, 'Gmail');
  assert.equal(webmailFor('A@GoogleMail.com')?.label, 'Gmail');
  assert.equal(webmailFor('a@hotmail.com')?.label, 'Outlook');
  assert.equal(webmailFor('a@outlook.es')?.label, 'Outlook');
  assert.equal(webmailFor('a@icloud.com')?.label, 'iCloud Mail');
  assert.equal(webmailFor('a@me.com')?.label, 'iCloud Mail');
  for (const email of ['a@yahoo.com', 'a@discotica.com', 'a@gmail.com.co', 'sin-arroba', '']) {
    assert.equal(webmailFor(email), null, email);
  }
});

test('U12: el límite de Auth dice cuántos segundos esperar', () => {
  assert.equal(retryAfterSeconds('For security purposes, you can only request this after 42 seconds.'), 42);
  assert.equal(retryAfterSeconds('Email rate limit exceeded'), null);
  assert.equal(retryAfterSeconds(undefined), null);
});

test('U12: el destino tras entrar es siempre interno', () => {
  assert.equal(safeRedirect('/coleccion/a?x=1'), '/coleccion/a?x=1');
  assert.equal(safeRedirect('//evil.example'), '/mis-colecciones');
  assert.equal(safeRedirect('https://evil.example'), '/mis-colecciones');
  assert.equal(safeRedirect(null), '/mis-colecciones');
  assert.equal(safeRedirect('', '/'), '/');
});
