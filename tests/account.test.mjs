import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authLinkRedirect,
  parseLoginIdentifier,
  readAuthLink,
  retryAfterSeconds,
  profileHref,
  safeRedirect,
  WEBMAILS
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

test('U30 (D4): «Revisa tu correo» ofrece siempre Gmail y Outlook', () => {
  assert.deepEqual(
    WEBMAILS.map((webmail) => [webmail.label, webmail.url]),
    [
      ['Gmail', 'https://mail.google.com/mail/'],
      ['Outlook', 'https://outlook.live.com/mail/']
    ]
  );
});

test('U12: el límite de Auth dice cuántos segundos esperar', () => {
  assert.equal(retryAfterSeconds('For security purposes, you can only request this after 42 seconds.'), 42);
  assert.equal(retryAfterSeconds('Email rate limit exceeded'), null);
  assert.equal(retryAfterSeconds(undefined), null);
});

test('U12: el destino tras entrar es siempre interno', () => {
  assert.equal(safeRedirect('/coleccion/a?x=1'), '/coleccion/a?x=1');
  assert.equal(safeRedirect('//evil.example'), '/');
  assert.equal(safeRedirect('https://evil.example'), '/');
  assert.equal(safeRedirect(null), '/');
  assert.equal(safeRedirect('', '/'), '/');
});

test('U30: sin destino propio, safeRedirect cae en el que le pasa quien llama y nunca en Mis colecciones', () => {
  assert.equal(safeRedirect(null, '/perfil/laura_rios'), '/perfil/laura_rios');
  assert.equal(safeRedirect('//evil.example', '/perfil/laura_rios'), '/perfil/laura_rios');
  assert.equal(safeRedirect('/sugerir', '/perfil/laura_rios'), '/sugerir');
  assert.notEqual(safeRedirect(undefined), '/mis-colecciones');
});

test('U30: el perfil de un usuario es /perfil/{usuario}', () => {
  assert.equal(profileHref('laura_rios'), '/perfil/laura_rios');
  assert.equal(profileHref('a-b_c'), '/perfil/a-b_c');
});

test('RC2-P0-01: los enlaces de Auth van a /auth/reset sin query', () => {
  assert.equal(authLinkRedirect('https://biblioteca.discotica.com'), 'https://biblioteca.discotica.com/auth/reset');
});

test('RC2-P0-01: el enlace de las plantillas trae token_hash y el tipo dice el flujo', () => {
  const read = (search, hash = '') => readAuthLink(new URLSearchParams(search), new URLSearchParams(hash));
  assert.deepEqual(read('token_hash=abc&type=email'), { flow: 'signup', tokenHash: 'abc', otpType: 'email', code: null, error: false });
  assert.deepEqual(read('token_hash=abc&type=signup'), { flow: 'signup', tokenHash: 'abc', otpType: 'email', code: null, error: false });
  assert.deepEqual(read('token_hash=abc&type=recovery'), { flow: 'recovery', tokenHash: 'abc', otpType: 'recovery', code: null, error: false });
  assert.deepEqual(read('token_hash=abc&type=email_change'), { flow: 'email_change', tokenHash: 'abc', otpType: 'email_change', code: null, error: false });
  // Un token sin tipo reconocible se canjea según el flujo heredado.
  assert.equal(read('token_hash=abc&flow=signup').otpType, 'email');
  assert.equal(read('token_hash=abc').otpType, 'recovery');
  assert.equal(read('token_hash=%20%20').tokenHash, null);
});

test('RC2-P0-01: los enlaces anteriores (flow, code, fragmento y error) se siguen leyendo', () => {
  const read = (search, hash = '') => readAuthLink(new URLSearchParams(search), new URLSearchParams(hash));
  assert.deepEqual(read('code=123&flow=signup'), { flow: 'signup', tokenHash: null, otpType: null, code: '123', error: false });
  assert.equal(read('flow=email_change').flow, 'email_change');
  assert.equal(read('', 'access_token=x&type=recovery').flow, 'recovery');
  assert.equal(read('', 'access_token=x&type=signup').flow, 'signup');
  assert.equal(read('flow=otra').flow, 'recovery');
  assert.equal(read('flow=signup', 'error=access_denied&error_description=expired').error, true);
  assert.equal(read('error_description=expired&type=recovery').error, true);
});
