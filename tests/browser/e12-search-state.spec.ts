import { expect, test } from '@playwright/test';

const rows = [{
  id: '11111111-1111-4111-8111-111111111111', slug: 'unico-release', title: 'Único Release',
  release_date: '2026-08-09', type: 'EP', label: 'Sello Único', review: '',
  experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
  artists: ['Artista BC'], primary_artists: [{ id: 'artist-bc', slug: 'artista-bc', name: 'Artista BC', position: 0 }], collaborators: [],
  credit_quality: 'verified', genres: ['Electro'], countries: ['Colombia'], buy_link: '', cover: ''
}];

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(rows) });
  });
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
});

test('E12: un deep link canónico conserva params ajenos e ignora mes legado', async ({ page }) => {
  await page.goto('/?mes=08&pais=Colombia&beta=1&nombre=Zo%C3%AB');
  await expect(page).toHaveURL(/\?beta=1&nombre=Zo%C3%AB&pais=Colombia&orden=match$/);
  await expect(page.locator('.chip-activo').filter({ hasText: 'Colombia' })).toBeVisible();
});

test('E12: sugerencia de artista queda tipada en URL y Back restaura el estado anterior', async ({ page }) => {
  await page.goto('/');
  // U10b: el campo de texto abre el panel; ya no hay botón «Buscar».
  const search = page.getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
  await search.click();
  await search.fill('Artista BC');
  await page.getByRole('option', { name: 'Artista Artista BC' }).click();
  await expect(page).toHaveURL(/entidad=/);
  await expect(page).not.toHaveURL(/texto=Artista/);
  await expect(page.getByText('"Artista BC"')).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/entidad=/);
  await expect(page.getByText('"Artista BC"')).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/entidad=/);
  await expect(page.getByText('"Artista BC"')).toBeVisible();
});

test('E12: limpiar filtros vuelve a fecha descendente y una consulta vacía sigue siendo estable', async ({ page }) => {
  await page.goto('/?texto=imposible');
  await expect(page.getByRole('status').getByText('No encontramos lanzamientos con estos filtros.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' }).click();
  await page.getByRole('button', { name: 'Reiniciar filtros' }).click();
  await expect(page).not.toHaveURL(/texto=/);
  await expect(page).not.toHaveURL(/orden=/);
});
