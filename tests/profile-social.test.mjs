import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCIAL_NETWORKS,
  isValidSocialHandle,
  normalizeSocialForm,
  normalizeSocialHandle,
  socialLinks,
  socialProfileUrl
} from '../src/lib/domain/profileSocial.ts';

const handle = (network, input) => {
  const result = normalizeSocialHandle(network, input);
  return result.ok ? result.handle : `ERROR`;
};
const bandcamp = (input) => {
  const result = normalizeSocialHandle('bandcamp', input);
  return result.ok ? [result.bandcampKind, result.handle] : 'ERROR';
};

test('D1: vacío quita la red', () => {
  for (const network of SOCIAL_NETWORKS) {
    assert.equal(handle(network, ''), null);
    assert.equal(handle(network, '   '), null);
    assert.equal(handle(network, null), null);
  }
});

test('D1: "@", mayúsculas y enlaces se convierten en el usuario', () => {
  assert.equal(handle('instagram', '@Discotica.CO'), 'discotica.co');
  assert.equal(handle('instagram', 'https://www.instagram.com/discotica.co/?hl=es'), 'discotica.co');
  assert.equal(handle('instagram', 'instagram.com/discotica_co'), 'discotica_co');
  assert.equal(handle('x', 'https://twitter.com/Discotica_CO'), 'discotica_co');
  assert.equal(handle('x', 'x.com/discotica'), 'discotica');
  assert.equal(handle('soundcloud', 'https://soundcloud.com/dj-mamanche'), 'dj-mamanche');
  assert.equal(handle('facebook', 'https://m.facebook.com/discotica.co'), 'discotica.co');
  assert.equal(handle('facebook', 'https://www.facebook.com/profile.php?id=100012345678'), '100012345678');
});

test('D1: formatos que la base rechaza también se rechazan en el cliente', () => {
  const invalid = {
    bandcamp: ['fan_name', '@artista', 'https://bandcamp.com/a/wishlist', 'https://evilbandcamp.com/x',
      'https://artista.bandcamp.com.evil.com', 'https://a.b.bandcamp.com', 'https://-artista.bandcamp.com',
      'https://www.bandcamp.com', 'https://artista.example.com'],
    soundcloud: ['ab', 'a'.repeat(26), 'https://soundcloud.com/a/sets/b', 'https://on.soundcloud.com/xyz'],
    instagram: ['.owner', 'own..er', 'owner.', 'a'.repeat(31), 'https://example.com/owner'],
    x: ['a'.repeat(16), 'a.b', 'https://x.com/a/status/1'],
    facebook: ['abcd', 'a-bcde', 'abcde.', 'https://www.facebook.com/profile.php']
  };
  for (const [network, values] of Object.entries(invalid)) {
    for (const value of values) {
      const result = normalizeSocialHandle(network, value);
      assert.equal(result.ok, false, `${network}: ${value}`);
      assert.match(result.error, /usuario|Bandcamp/);
    }
  }
});

test('D1: Bandcamp acepta página de artista y de fan, solo como enlace', () => {
  assert.deepEqual(bandcamp('https://artista.bandcamp.com'), ['artist', 'artista']);
  assert.deepEqual(bandcamp('artista-dos.bandcamp.com'), ['artist', 'artista-dos']);
  assert.deepEqual(bandcamp('https://Artista.bandcamp.com/album/disco-uno'), ['artist', 'artista']);
  assert.deepEqual(bandcamp('https://bandcamp.com/fan_name'), ['fan', 'fan_name']);
  assert.deepEqual(bandcamp('bandcamp.com/fan_name/'), ['fan', 'fan_name']);
  assert.deepEqual(bandcamp('https://www.bandcamp.com/fan_name?from=menubar'), ['fan', 'fan_name']);
  assert.deepEqual(bandcamp(''), [null, null]);
  const bare = normalizeSocialHandle('bandcamp', 'artista');
  assert.equal(bare.ok, false);
  assert.match(bare.error, /artista\.bandcamp\.com.*bandcamp\.com\/usuario/);
});

test('D1: la URL pública se construye solo con usuarios válidos', () => {
  assert.equal(socialProfileUrl('bandcamp', 'fan_name', 'fan'), 'https://bandcamp.com/fan_name');
  assert.equal(socialProfileUrl('bandcamp', 'artista', 'artist'), 'https://artista.bandcamp.com');
  assert.equal(socialProfileUrl('bandcamp', 'fan_name', 'artist'), null);
  assert.equal(socialProfileUrl('bandcamp', 'artista', null), null);
  assert.equal(socialProfileUrl('soundcloud', 'dj-mamanche'), 'https://soundcloud.com/dj-mamanche');
  assert.equal(socialProfileUrl('instagram', 'discotica.co'), 'https://www.instagram.com/discotica.co/');
  assert.equal(socialProfileUrl('x', 'discotica'), 'https://x.com/discotica');
  assert.equal(socialProfileUrl('facebook', 'discotica.co'), 'https://www.facebook.com/discotica.co');
  assert.equal(socialProfileUrl('x', 'Discotica'), null);
  assert.equal(socialProfileUrl('x', '../evil'), null);
  assert.equal(socialProfileUrl('x', null), null);
  assert.equal(isValidSocialHandle('instagram', '@discotica'), false);
});

test('D1: enlaces del perfil en orden fijo, sin redes vacías', () => {
  const links = socialLinks({
    social_x: 'discotica', social_bandcamp: 'artista', social_bandcamp_kind: 'artist', social_instagram: null
  });
  assert.deepEqual(links.map((link) => [link.network, link.url]), [
    ['bandcamp', 'https://artista.bandcamp.com'],
    ['x', 'https://x.com/discotica']
  ]);
});

test('D1: el formulario devuelve columnas o errores por red', () => {
  assert.deepEqual(normalizeSocialForm({ x: '@Discotica', instagram: '', bandcamp: 'https://artista.bandcamp.com' }), {
    ok: true,
    columns: { social_bandcamp: 'artista', social_bandcamp_kind: 'artist', social_instagram: null, social_x: 'discotica' }
  });
  assert.deepEqual(normalizeSocialForm({ bandcamp: '' }), {
    ok: true,
    columns: { social_bandcamp: null, social_bandcamp_kind: null }
  });
  const failed = normalizeSocialForm({ x: 'demasiado_largo_para_x', soundcloud: 'ok-user' });
  assert.equal(failed.ok, false);
  assert.deepEqual(Object.keys(failed.errors), ['x']);
});
