import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BETA_INVITATION_MAX_NAME_LENGTH,
  normalizeBetaName,
  parseBetaInvitation,
  removeBetaInvitationParams,
  withoutBetaInvitationSearch
} from '../src/lib/domain/betaInvitation.ts';

function parse(query) {
  return parseBetaInvitation(new URLSearchParams(query));
}

test('E19: only bare beta and beta=1 activate the invitation', () => {
  assert.deepEqual(parse('beta'), { name: null });
  assert.deepEqual(parse('beta=1'), { name: null });
  assert.deepEqual(parse('beta&nombre=Mar%C3%ADa'), { name: 'María' });
  assert.deepEqual(parse('beta=1&nombre=%E6%9D%8E%E9%9B%B7'), { name: '李雷' });
  for (const query of ['', 'nombre=Ana', 'beta=true', 'beta=0', 'beta=01', 'beta=1&beta=1']) {
    assert.equal(parse(query), null, query);
  }
});

test('E19: names normalize Unicode, whitespace and visible-character limit', () => {
  assert.equal(normalizeBetaName('  Zoe\t\n  García  '), 'Zoe García');
  assert.equal(normalizeBetaName('e\u0301'), 'é');
  assert.equal(normalizeBetaName('  \t\n '), null);
  assert.equal(normalizeBetaName('😀'.repeat(41)), '😀'.repeat(BETA_INVITATION_MAX_NAME_LENGTH));
  assert.equal(normalizeBetaName('a'.repeat(41)), 'a'.repeat(BETA_INVITATION_MAX_NAME_LENGTH));
});

test('E19: malformed or repeated name uses generic copy and text remains data', () => {
  assert.deepEqual(parse('beta=1&nombre='), { name: null });
  assert.deepEqual(parse('beta=1&nombre=Ana&nombre=Bea'), { name: null });
  assert.deepEqual(parse('beta=1&nombre=%3Cimg%20onerror%3Dalert(1)%3E'), { name: '<img onerror=alert(1)>' });
});

test('E19: cleanup is idempotent and preserves every non-beta parameter', () => {
  const original = new URLSearchParams('beta=1&nombre=Zo%C3%AB&pais=Colombia&genero=Ambient&foo=1&beta=1');
  const once = removeBetaInvitationParams(original);
  assert.equal(once.toString(), 'pais=Colombia&genero=Ambient&foo=1');
  assert.equal(removeBetaInvitationParams(once).toString(), once.toString());
});

test('E19: internal links retain filters but never propagate beta parameters', () => {
  assert.equal(
    withoutBetaInvitationSearch('?beta=1&nombre=Zo%C3%AB&pais=Colombia&genero=Ambient'),
    '?pais=Colombia&genero=Ambient'
  );
});
