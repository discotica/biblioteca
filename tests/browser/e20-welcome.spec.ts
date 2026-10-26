import { expect, test } from '@playwright/test';

const rows = [{
  id: '20202020-2020-4020-8020-000000000001', slug: 'welcome-fixture', title: 'Welcome fixture',
  release_date: '2026-09-01', type: 'EP', label: '', review: '', experimental: 2, denso: 2,
  sintetico: 2, bailable: 2, rapido: 2, artists: ['Discótica'],
  primary_artists: [{ id: 'welcome-artist', slug: 'welcome-artist', name: 'Discótica', position: 0 }],
  collaborators: [], credit_quality: 'verified', genres: ['Ambient'], countries: ['Colombia'], buy_link: '', cover: ''
}];

async function stubCatalog(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/catalog_releases**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(rows)
  }));
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]'
  }));
}

test('E20: primera entrada directa muestra un banner no modal; cierre persiste al recargar y una pestaña nueva empieza otra sesión', async ({ page, context }) => {
  await stubCatalog(page);
  await page.goto('/');

  const banner = page.locator('[data-welcome-banner]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Explora la biblioteca de Discótica');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar bienvenida' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);

  const newTab = await context.newPage();
  await stubCatalog(newTab);
  await newTab.goto('/');
  await expect(newTab.locator('[data-welcome-banner]')).toBeVisible();
  await newTab.close();
});

test('E20: filtros, modal, beta válida y navegación iniciada fuera de home no disparan la bienvenida', async ({ page }) => {
  await stubCatalog(page);
  for (const href of ['/?pais=Colombia', '/?modal=welcome-fixture', '/?beta=1', '/artista/welcome-artist']) {
    await page.goto(href);
    await expect(page.locator('[data-welcome-banner]')).toHaveCount(0);
  }

  // Same tab, client startup was an internal route: home is navigation, not a
  // fresh direct entry. The route marker comes from the root layout session.
  await page.goto('/');
  await expect(page.locator('[data-welcome-banner]')).toHaveCount(0);
});

test('E20: Explorar deja el catálogo accesible, enfoca el campo de búsqueda y no deja banner al recargar', async ({ page }) => {
  await stubCatalog(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar' }).click();
  // U10b: el destino es el campo de texto; enfocarlo no abre el panel.
  const search = page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
  await expect(search).toBeFocused();
  await expect(page.locator('#panel-busqueda')).toHaveCount(0);
  await expect(page.locator('.resultados__grid')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-welcome-banner]')).toHaveCount(0);
});

test('E20: 360–1440 mantiene el catálogo alcanzable, sin scroll horizontal ni animación obligatoria', async ({ page }) => {
  await stubCatalog(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const search = viewport.width <= 768
      ? page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' })
      : page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
    await expect(search).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar bienvenida' }).click();
    await page.evaluate(() => sessionStorage.clear());
  }
});
