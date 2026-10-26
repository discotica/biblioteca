import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyCollectionHref } from '../src/lib/domain/collectionRoutes.ts';

test('U3: las rutas viejas de colecciones van a las nuevas con query y hash', () => {
  assert.equal(legacyCollectionHref('/mis-crates'), '/mis-colecciones');
  assert.equal(legacyCollectionHref('/mis-crates/', '?crear=1', '#nueva'), '/mis-colecciones?crear=1#nueva');
  assert.equal(
    legacyCollectionHref('/crate/para-abrir-el-set', '?usuario=comunidad', '#u3'),
    '/coleccion/para-abrir-el-set?usuario=comunidad#u3'
  );
  assert.equal(legacyCollectionHref('/crate/cumbia-%C3%A1cida/'), '/coleccion/cumbia-%C3%A1cida');
});

test('U3: el resto de rutas no se redirige', () => {
  for (const path of ['/', '/crate', '/crate/', '/crate/a/b', '/mis-crates-x', '/coleccion/a', '/perfil/crate']) {
    assert.equal(legacyCollectionHref(path, '?q=1', '#x'), null, path);
  }
});
