import { expect, test } from '@playwright/test';

const rows = [
  ...Array.from({ length: 13 }, (_, index) => release(`exact-${index + 1}`, `Exact ${index + 1}`, 'Electro', index + 1)),
  ...Array.from({ length: 13 }, (_, index) => release(`approx-${index + 1}`, `Aproximado ${index + 1}`, 'House', index + 14))
];

function release(slug: string, title: string, genre: string, index: number) {
  const part = String(index).padStart(12, '0');
  return {
    id: `11111111-1111-4111-8111-${part}`,
    slug,
    title,
    release_date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    type: 'EP',
    label: 'Sello de prueba',
    review: '',
    experimental: 2,
    denso: 3,
    sintetico: 1,
    bailable: 4,
    rapido: 2,
    artists: ['Artista E13'],
    primary_artists: [{ id: 'artist-e13', slug: 'artista-e13', name: 'Artista E13', position: 0 }],
    collaborators: [],
    credit_quality: 'verified',
    genres: [genre],
    countries: ['Colombia'],
    buy_link: '',
    cover: ''
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
      body: JSON.stringify(rows)
    });
  });
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
});

test('E13: pagina la secuencia agrupada sin ocultar ni duplicar el corte exacto/aproximado', async ({ page }) => {
  await page.goto('/?pais=Colombia&genero=Electro&p=2');

  await expect(page).toHaveURL(/pais=Colombia.*genero=Electro.*orden=match.*p=2/);
  await expect(page.locator('.card--grid')).toHaveCount(12);
  await expect(page.locator('.resultados__grupo')).toHaveText('Resultados aproximados');
  await expect(page.locator('.resultados__contador')).toHaveText('13–24 de 26 lanzamientos');
  expect(await page.locator('.card--grid').evaluateAll((cards) => {
    const names = cards.map((card) => card.textContent);
    return new Set(names).size === names.length;
  })).toBe(true);

  await page.getByRole('button', { name: 'Página siguiente' }).first().press('Enter');
  await expect(page).toHaveURL(/p=3/);
  await expect(page.locator('.card--grid')).toHaveCount(2);
  await expect(page.locator('.resultados__grid > :first-child')).toHaveClass(/resultados__grupo/);
});

test('E13: solo aproximados usa aviso completo sin contador redundante y el orden conserva filtros en URL', async ({ page }) => {
  await page.goto('/?pais=Colombia&genero=Techno');

  await expect(page.getByText('No encontramos resultados exactos, pero aquí tienes los más cercanos.')).toBeVisible();
  await expect(page.locator('.resultados__contador')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('match');

  await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('fecha-asc');
  await expect(page).toHaveURL(/pais=Colombia.*genero=Techno.*orden=fecha-asc/);
  await expect(page).not.toHaveURL(/p=/);
  await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('fecha-asc');
});

test('E13: la paginación es operable por teclado y desplaza a la grilla respetando reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?pais=Colombia&genero=Electro');
  await page.evaluate(() => window.scrollTo(0, 650));

  const nextPage = page.getByRole('button', { name: 'Página siguiente' }).first();
  await nextPage.focus();
  await expect(nextPage).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/p=2/);
  // La grilla queda arriba, bajo lo que reserva el scroll-padding para el
  // header sticky (U18).
  await expect.poll(() => page.locator('.resultados__grid').evaluate((grid) => {
    const reserve = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return Math.abs(grid.getBoundingClientRect().top - reserve) < 100;
  })).toBe(true);
});

test('E13: vacío, carga fallida, deep link y barra responsive exponen estados distinguibles', async ({ page }) => {
  await page.goto('/?texto=sin-coincidencia');
  await expect(page.getByRole('status').getByText('No encontramos lanzamientos con estos filtros.')).toBeVisible();

  // U10: en móvil la paginación y "Ordenar por" comparten una línea.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?pais=Colombia&genero=Electro&p=2');
  const previous = page.getByRole('button', { name: 'Página anterior' }).first();
  await expect(previous).toBeVisible();
  const [pager, order] = await Promise.all([
    previous.boundingBox(),
    page.getByRole('combobox', { name: 'Ordenar por' }).boundingBox()
  ]);
  expect(Math.abs((pager?.y ?? 0) - (order?.y ?? 99))).toBeLessThanOrEqual(1);
});

test('E13: un error de catálogo no se presenta como búsqueda vacía', async ({ page }) => {
  await page.unroute('**/rest/v1/catalog_releases**');
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'fallo de red' }) });
  });

  await page.goto('/');
  // U10: ErrorState con una acción, Reintentar.
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('No pudimos cargar los lanzamientos.');
  await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('status').getByText('No encontramos lanzamientos con estos filtros.')).toHaveCount(0);
});

test('E13: mantiene un estado de carga hasta que el catálogo responde', async ({ page }) => {
  await page.unroute('**/rest/v1/catalog_releases**');
  let releaseCatalog: (() => Promise<void>) | undefined;
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    await new Promise<void>((resolve) => {
      releaseCatalog = async () => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
          body: JSON.stringify(rows)
        });
        resolve();
      };
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status', { name: 'Cargando catálogo' })).toBeVisible();
  await expect.poll(() => Boolean(releaseCatalog)).toBe(true);
  await releaseCatalog?.();
  await expect(page.locator('.card--grid').first()).toBeVisible();
});
