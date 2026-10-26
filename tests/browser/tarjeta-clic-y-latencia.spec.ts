import { expect, test, type Page } from '@playwright/test';

const rows = Array.from({ length: 6 }, (_, index) => ({
  id: `30303030-3030-4030-8030-${String(index + 1).padStart(12, '0')}`,
  slug: `tarjeta-${index + 1}`,
  title: `Tarjeta ${index + 1}`,
  release_date: `2026-0${index + 1}-10`,
  type: 'EP',
  label: 'Sello T',
  review: '',
  experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
  artists: [`Artista ${index + 1}`],
  primary_artists: [{ id: `a-${index + 1}`, slug: `artista-${index + 1}`, name: `Artista ${index + 1}`, position: 0 }],
  collaborators: [],
  credit_quality: 'verified',
  genres: ['Electro', 'House'],
  countries: ['Colombia'],
  buy_link: '',
  cover: ''
}));

const NETWORK_DELAY_MS = 600;

async function mockCatalog(page: Page) {
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));
    const { p_slug } = route.request().postDataJSON() as { p_slug: string };
    const row = rows.find((candidate) => candidate.slug === p_slug);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(row ? [{ release_id: row.id, canonical_slug: row.slug, match_kind: 'canonical', alias_kind: null }] : [])
    });
  });
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace(/^eq\./, '');
    if (id) {
      await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));
      await route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(rows.find((row) => row.id === id) ?? null) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockCatalog(page);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`un clic en el espacio en blanco de la tarjeta abre el lanzamiento (${viewport.width})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const card = page.locator('.card--grid').filter({ hasText: 'Tarjeta 1' });
    const info = card.locator('.card__info');
    await info.scrollIntoViewIfNeeded();
    const box = (await info.boundingBox())!;

    // Esquina inferior derecha del área de información: padding, sin ningún control.
    await page.mouse.click(box.x + box.width - 6, box.y + box.height - 6);
    await expect(page.getByRole('dialog', { name: 'Tarjeta 1' })).toBeVisible();
    await expect(page).toHaveURL(/modal=tarjeta-1/);
  });
}

test('los controles de la tarjeta siguen haciendo lo suyo y no abren el lanzamiento', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.card--grid').filter({ hasText: 'Tarjeta 2' });
  await card.getByRole('link', { name: 'Electro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/genero=Electro/);

  await page.goto('/');
  const other = page.locator('.card--grid').filter({ hasText: 'Tarjeta 3' });
  await other.getByRole('link', { name: 'Artista 3' }).click();
  await expect(page).toHaveURL(/\/artista\/artista-3/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('abrir una ficha desde la tarjeta no espera a la red', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.card--grid').filter({ hasText: 'Tarjeta 4' });
  await expect(card).toBeVisible();
  const started = Date.now();
  await card.getByRole('link', { name: 'Abrir Tarjeta 4' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Tarjeta 4' })).toBeVisible({ timeout: NETWORK_DELAY_MS - 200 });
  expect(Date.now() - started).toBeLessThan(NETWORK_DELAY_MS);
});
