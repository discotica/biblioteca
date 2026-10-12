import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaCandidates, providerForUrl, summarize } from '../scripts/verify-release-media.mjs';

test('clasifica proveedores y omite URLs que no se pueden verificar', () => {
  assert.equal(providerForUrl('https://foo.bandcamp.com/album/x'), 'bandcamp');
  assert.equal(providerForUrl('https://open.spotify.com/album/x'), 'spotify');
  assert.equal(providerForUrl('not-a-url'), 'invalid');
  assert.deepEqual(mediaCandidates([{ buy_link: 'https://example.com/r', cover: 'nota' }]), [
    { index: 0, field: 'buy_link', provider: 'example.com', url: 'https://example.com/r' }
  ]);
});

test('resume fallos por proveedor sin modificar el catálogo', () => {
  const report = summarize([
    { provider: 'spotify', ok: true },
    { provider: 'spotify', ok: false },
    { provider: 'bandcamp', ok: true }
  ]);
  assert.equal(report.total, 3);
  assert.equal(report.failed, 1);
  assert.deepEqual(report.byProvider.spotify, { total: 2, healthy: 1, failed: 1 });
});
