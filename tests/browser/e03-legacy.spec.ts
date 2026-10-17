import { expect, test } from '@playwright/test';

test.skip(
  process.env.VITE_CATALOG_SOURCE !== 'legacy',
  'E03 legacy compatibility only runs with the legacy catalog flag enabled.'
);

const legacySlug = 'disco-legado-artista-legado';
const canonicalSlug = 'disco-legado-artista-legado--abcd1234';
const releaseId = '55555555-5555-4555-8555-555555555555';
const tsv = `artist\ttitle\ttype\tcountry\tgenre\tlabel\trelease_date\tbuy_link\treview\texperimental\tdenso\tsintético\tbailable\trápido\tcover
Artista Legado\tDisco Legado\tDisco\tColombia\tElectro\tSello\t09/08/2026\thttps://artista.bandcamp.com/album/disco\tNota\t1\t2\t3\t4\t5\thttps://example.test/legacy.jpg`;

const canonicalRow = {
  id: releaseId,
  slug: canonicalSlug,
  title: 'Disco Legado',
  release_date: '2026-08-09',
  type: 'Álbum',
  label: 'Sello',
  review: 'Nota',
  experimental: 1,
  denso: 2,
  sintetico: 3,
  bailable: 4,
  rapido: 5,
  artists: ['Artista Legado'],
  primary_artists: [{ id: 'a5', slug: 'artista-legado', name: 'Artista Legado', position: 0 }],
  collaborators: [],
  credit_quality: 'legacy',
  genres: ['Electro'],
  countries: ['Colombia'],
  buy_link: 'https://artista.bandcamp.com/album/disco',
  cover: 'https://example.test/legacy.jpg'
};

test.beforeEach(async ({ page }) => {
  await page.route('**/spreadsheets/d/e/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/tab-separated-values',
    body: tsv
  }));
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => {
    const requested = (route.request().postDataJSON() as { p_slug?: string }).p_slug;
    const resolved = requested === legacySlug || requested === canonicalSlug;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(resolved ? [{
        release_id: releaseId,
        canonical_slug: canonicalSlug,
        match_kind: requested === canonicalSlug ? 'canonical' : 'alias',
        alias_kind: requested === canonicalSlug ? null : 'migration'
      }] : [])
    });
  });
  await page.route('**/rest/v1/catalog_releases**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/vnd.pgrst.object+json',
    body: JSON.stringify(canonicalRow)
  }));
});

test('el home TSV y la ruta heredada convergen en el release canónico', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Abrir Disco Legado' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Abrir Disco Legado' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Disco Legado' })).toBeVisible();

  await page.goto(`/lanzamiento/${legacySlug}`);
  await expect(page.getByRole('heading', { name: 'Disco Legado', exact: true })).toBeVisible();
  await expect(page.getByTitle('Bandcamp player')).toBeVisible();
});
