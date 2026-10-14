import { expect, test, type Page } from '@playwright/test';

// U18 (H1, H15): el header y la barra «Buscar» se quedan arriba de verdad.
// Hasta U18, `overflow-x: hidden` en html/body anulaba todo position: sticky
// fuera del Estudio, y las pruebas de E14/E15 pasaban igual porque solo miraban
// `data-header-visible`/`data-search-visible`. Estas miden la geometría.

const rows = Array.from({ length: 18 }, (_, index) => ({
  id: `18181818-1818-4181-8181-${String(index + 1).padStart(12, '0')}`,
  slug: `release-u18-${index + 1}`,
  title: `Release U18 ${index + 1}`,
  release_date: `2026-${String((index % 9) + 1).padStart(2, '0')}-15`,
  type: index % 2 ? 'EP' : 'Álbum',
  label: 'Sello U18',
  review: '',
  experimental: 2,
  denso: 3,
  sintetico: 1,
  bailable: 4,
  rapido: 2,
  artists: [`Artista U18 ${index + 1}`],
  primary_artists: [{ id: `artist-u18-${index + 1}`, slug: `artista-u18-${index + 1}`, name: `Artista U18 ${index + 1}`, position: 0 }],
  collaborators: [],
  credit_quality: 'verified',
  genres: ['Electro'],
  countries: ['Colombia'],
  buy_link: '',
  cover: ''
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/catalog_releases**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
    body: JSON.stringify(rows)
  }));
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]'
  }));
});

// `scrollTo` devuelve antes de que se despache `scroll`; se espera al evento
// para que el header y la barra lo hayan procesado (como en E14).
const scrollTo = (page: Page, y: number) => page.evaluate((target) => new Promise<void>((resolve) => {
  window.addEventListener('scroll', () => resolve(), { once: true });
  window.scrollTo(0, target);
}), y);

const box = (page: Page, selector: string) => page.locator(selector).first().evaluate((node) => {
  const rect = node.getBoundingClientRect();
  return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
});

test('H1: a 1440 el header se queda arriba, se oculta al bajar y vuelve al subir; el índice del manual queda debajo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/manual');
  const header = page.locator('header.site-header');
  const { height } = await box(page, 'header.site-header');

  await scrollTo(page, 1200);
  await expect(header).toHaveAttribute('data-header-visible', 'false');
  // Oculto pero pegado arriba: justo encima del viewport, no 1200 px más arriba.
  await expect.poll(async () => (await box(page, 'header.site-header')).top).toBe(-height);

  await scrollTo(page, 900);
  await expect(header).toHaveAttribute('data-header-visible', 'true');
  await expect.poll(async () => (await box(page, 'header.site-header')).top).toBe(0);
  // El índice sigue a la vista, bajo el header y no debajo de él.
  await expect.poll(async () => (await box(page, 'nav.l-reading__toc')).top).toBeGreaterThanOrEqual(height);
  expect((await box(page, 'nav.l-reading__toc')).top).toBeLessThan(height + 64);
});

test('H1/E15: a 390 «Buscar» se queda arriba al subir y el header solo vuelve al inicio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  await page.locator('.card--grid').first().waitFor();
  await page.locator('main').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    main.append(spacer);
  });
  const anchor = page.locator('.mobile-search-anchor');

  // Lejos de su sitio en el flujo (bajo la bienvenida), donde solo sticky la
  // mantiene arriba.
  await scrollTo(page, 900);
  await expect(anchor).toHaveAttribute('data-search-visible', 'false');
  await expect.poll(async () => (await box(page, '.mobile-search-anchor')).bottom).toBeLessThanOrEqual(0);

  await scrollTo(page, 870);
  await expect(anchor).toHaveAttribute('data-search-visible', 'true');
  await expect.poll(async () => (await box(page, '.mobile-search-anchor')).top).toBe(0);
  expect((await box(page, 'header.site-header')).bottom).toBeLessThanOrEqual(0);

  await scrollTo(page, 0);
  await expect.poll(async () => (await box(page, 'header.site-header')).top).toBe(0);
});

// H15: `goto` con noScroll devolvía la página a donde estaba al terminar y
// cancelaba el desplazamiento suave a la grilla. Sin movimiento reducido.
for (const { width, height, chrome } of [
  { width: 1440, height: 900, chrome: 'header.site-header' },
  { width: 390, height: 844, chrome: '.mobile-search-anchor' }
]) {
  test(`H15: a ${width}, paginar desde abajo sube a la grilla sin dejarla bajo ${chrome}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.locator('.card--grid').first().waitFor();
    const next = page.getByRole('navigation', { name: 'Paginación inferior de resultados' }).getByRole('button', { name: 'Página siguiente' });
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(page).toHaveURL(/[?&]p=2/);

    // La grilla termina justo bajo lo que vuelve al subir (header en escritorio,
    // «Buscar» en móvil), con el margen propio de la grilla.
    await expect.poll(async () => {
      const grid = await box(page, '.resultados__grid');
      const bar = await box(page, chrome);
      return grid.top >= bar.bottom && grid.top <= bar.bottom + 48;
    }, { timeout: 5000 }).toBe(true);
  });
}
