import { expect, test } from '@playwright/test';

test.skip(
  process.env.VITE_CATALOG_SOURCE !== 'canonical',
  'E01 staging smoke only runs with the canonical catalog flag enabled.'
);

test('carga el catálogo canónico y mantiene editorial detrás de Auth', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByLabel('Cargando catálogo')).toBeHidden({ timeout: 20_000 });
  await expect(
    page.locator('.resultados__contador:not(.resultados__contador--hidden)')
  ).toContainText(/2790 lanzamientos/);

  const firstReleaseLink = page.locator('a[aria-label^="Abrir "]').first();
  await expect(firstReleaseLink).toBeVisible();
  await firstReleaseLink.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goto('/editorial');
  await expect(page.getByRole('heading', { name: 'Cola editorial' })).toBeVisible();
  await expect(page.getByText('Inicia sesión para acceder al área editorial.')).toBeVisible();
});
