import { expect, test } from '@playwright/test';

test('R2: el 404 está en español y ofrece volver al catálogo', async ({ page }) => {
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }));
  const response = await page.goto('/ruta-inexistente');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.getByText('Not Found')).toHaveCount(0);
  await page.getByRole('link', { name: 'Volver al catálogo' }).click();
  await expect(page).toHaveURL(/\/$/);
});
