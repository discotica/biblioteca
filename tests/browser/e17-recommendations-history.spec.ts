import { expect, test, type Page } from '@playwright/test';

type Row = ReturnType<typeof row>;

const artist = (name: string) => [{ id: `artist-${name.toLowerCase()}`, slug: name.toLowerCase(), name, position: 0 }];

function row(id: string, slug: string, title: string, genres: string[], radar: number[]) {
  const primary = artist(`Artista ${title}`);
  return {
    id, slug, title, release_date: '2026-09-20', type: 'Álbum', label: 'Sello E17',
    review: Array.from({ length: 8 }, (_, index) => `Nota ${index + 1} para sostener el recorrido vertical.`).join('\n'),
    experimental: radar[0], denso: radar[1], sintetico: radar[2], bailable: radar[3], rapido: radar[4],
    artists: primary.map(({ name }) => name), primary_artists: primary, collaborators: [], credit_quality: 'verified',
    genres, countries: ['Colombia'], buy_link: `https://example.test/${slug}`, cover: `https://example.test/${slug}.jpg`
  };
}

const rows: Row[] = [
  row('11111111-1111-4111-8111-111111111111', 'e17-a', 'Alpha', ['Ambient'], [3, 3, 3, 3, 3]),
  row('22222222-2222-4222-8222-222222222222', 'e17-b', 'Beta', ['Ambient'], [4, 3, 3, 3, 3]),
  row('33333333-3333-4333-8333-333333333333', 'e17-c', 'Gamma', ['Jazz'], [3, 3, 3, 3, 3])
];

async function mockCatalog(page: Page, fixture: Row[] = rows) {
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    const body = route.request().postDataJSON() as { p_slug?: string };
    const release = fixture.find((candidate) => candidate.slug === body.p_slug);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release ? [{
        release_id: release.id,
        canonical_slug: release.slug,
        match_kind: 'canonical',
        alias_kind: null
      }] : [])
    });
  });

  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace(/^eq\./, '');
    if (id) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(fixture.find((candidate) => candidate.id === id) ?? null)
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(0, fixture.length - 1)}/${fixture.length}` },
      body: JSON.stringify(fixture)
    });
  });

  await page.route('https://example.test/**', (route) => route.fulfill({ status: 200, body: '' }));
}

async function expectRelease(page: Page, slug: string, title: string) {
  await expect(page).toHaveURL(new RegExp(`modal=${slug}(?:&|$)`));
  const detail = page.locator('[data-release-detail]');
  await expect(detail).toHaveAttribute('data-release-slug', slug);
  await expect(detail.locator('.release-detail__title')).toHaveText(title);
}

const unexpectedPageErrors = new WeakMap<Page, Error[]>();

test.beforeEach(async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  unexpectedPageErrors.set(page, pageErrors);
  await mockCatalog(page);
});

test.afterEach(async ({ page }) => {
  expect(unexpectedPageErrors.get(page)?.map((error) => error.message) ?? []).toEqual([]);
});

test('E17: las dos recomendaciones exactas aparecen en modal y la ruta usa navegación completa', async ({ page }) => {
  await page.goto('/?modal=e17-a');
  const recommendations = page.locator('.release-recommendation');
  await expect(recommendations).toHaveCount(2);
  await expect(recommendations.nth(0)).toHaveAttribute('data-recommendation-slot', '1');
  await expect(recommendations.nth(0)).toContainText('Beta');
  await expect(recommendations.nth(1)).toHaveAttribute('data-recommendation-slot', '2');
  await expect(recommendations.nth(1)).toContainText('Gamma');

  await page.goto('/lanzamiento/e17-a');
  await expect(page.locator('.release-recommendation')).toHaveCount(2);
  await page.locator('.release-recommendation').nth(0).click();
  await expect(page).toHaveURL(/\/lanzamiento\/e17-b$/);
  await expect(page.locator('[data-release-detail]')).toHaveAttribute('data-release-slug', 'e17-b');
  await page.goBack();
  await expect(page.locator('[data-release-detail]')).toHaveAttribute('data-release-slug', 'e17-a');
});

test('E17: A → B → C, Back/Forward y cerrar conservan URL, filtros, foco y scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/?genero=Ambient');
  // Esperar al catálogo antes de desplazar (si no, el scroll se guarda sobre la
  // carga: carrera descrita en U2) y llevar el disparador a la vista antes de
  // guardar: el modal conserva el scroll del momento en que se abre.
  const trigger = page.getByRole('link', { name: 'Abrir Alpha' }).first();
  await expect(trigger).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, Math.min(160, document.documentElement.scrollHeight - innerHeight)));
  await trigger.scrollIntoViewIfNeeded();
  const savedScroll = await page.evaluate(() => window.scrollY);
  await expect(page).toHaveURL(/\/?genero=Ambient&orden=match$/);
  const baseUrl = page.url();
  await trigger.click();
  await expectRelease(page, 'e17-a', 'Alpha');

  await page.locator('[data-recommendation-slot="1"]').click();
  await expectRelease(page, 'e17-b', 'Beta');
  await expect(page.locator('.release-detail__title')).toBeFocused();

  await page.locator('[data-recommendation-slot="2"]').click();
  await expectRelease(page, 'e17-c', 'Gamma');
  await expect(page.locator('.release-detail__title')).toBeFocused();

  await page.goBack();
  await expectRelease(page, 'e17-b', 'Beta');
  await page.goBack();
  await expectRelease(page, 'e17-a', 'Alpha');
  await page.goForward();
  await expectRelease(page, 'e17-b', 'Beta');
  await page.goForward();
  await expectRelease(page, 'e17-c', 'Gamma');

  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page).toHaveURL(baseUrl);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);
});

test('E17: una recarga conserva la sesión y cerrar restaura scroll con tolerancia de 1 px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/?genero=Ambient');
  await page.evaluate(() => window.scrollTo(0, Math.min(140, document.documentElement.scrollHeight - innerHeight)));
  const savedScroll = await page.evaluate(() => window.scrollY);
  const trigger = page.getByRole('link', { name: 'Abrir Alpha' }).first();
  await expect(trigger).toBeVisible();
  await expect(page).toHaveURL(/\/?genero=Ambient&orden=match$/);
  const baseUrl = page.url();
  await trigger.click();
  await page.locator('[data-recommendation-slot="1"]').click();
  await page.locator('[data-recommendation-slot="2"]').click();
  await expectRelease(page, 'e17-c', 'Gamma');

  await page.reload();
  await expectRelease(page, 'e17-c', 'Gamma');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page).toHaveURL(baseUrl);
  await expect.poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), savedScroll)).toBeLessThanOrEqual(1);
});

test('E17: Back restaura la profundidad de sesión usada por cerrar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto('/?genero=Ambient');
  const trigger = page.getByRole('link', { name: 'Abrir Alpha' }).first();
  await expect(trigger).toBeVisible();
  await expect(page).toHaveURL(/\/?genero=Ambient&orden=match$/);
  const baseUrl = page.url();

  await trigger.click();
  await page.locator('[data-recommendation-slot="1"]').click();
  await expectRelease(page, 'e17-b', 'Beta');
  await page.locator('[data-recommendation-slot="2"]').click();
  await expectRelease(page, 'e17-c', 'Gamma');

  await page.goBack();
  await expectRelease(page, 'e17-b', 'Beta');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page).toHaveURL(baseUrl);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('E17: Back a la base cierra y Forward reabre la misma sesión', async ({ page }) => {
  await page.goto('/?genero=Ambient');
  const trigger = page.getByRole('link', { name: 'Abrir Alpha' }).first();
  await expect(trigger).toBeVisible();
  const baseUrl = page.url();

  await trigger.click();
  await expectRelease(page, 'e17-a', 'Alpha');
  await page.goBack();
  await expect(page).toHaveURL(baseUrl);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.goForward();
  await expectRelease(page, 'e17-a', 'Alpha');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page).toHaveURL(baseUrl);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('E17: una URL directa encadena recomendaciones y al cerrar elimina solo modal', async ({ page }) => {
  await page.goto('/?genero=Ambient&beta=1&modal=e17-a');
  await expectRelease(page, 'e17-a', 'Alpha');
  await expect(page).toHaveURL(/\/?beta=1&genero=Ambient&orden=match&modal=e17-a$/);
  const baseUrl = new URL(page.url());
  baseUrl.searchParams.delete('modal');
  await page.locator('[data-recommendation-slot="1"]').click();
  await expectRelease(page, 'e17-b', 'Beta');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page).toHaveURL(baseUrl.href);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('E17: catálogo insuficiente muestra cero recomendaciones sin relleno', async ({ page }) => {
  await page.unrouteAll({ behavior: 'wait' });
  await mockCatalog(page, [rows[0]]);
  await page.goto('/?modal=e17-a');
  await expect(page.getByRole('dialog', { name: 'Alpha' })).toBeVisible();
  await expect(page.locator('.release-recommendation')).toHaveCount(0);
});
