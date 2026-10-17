import { expect, test, type Route } from '@playwright/test';

// U11 — Bienvenida editorial (bloque con hueco de ilustración), invitación beta
// como diálogo del sistema, y artista/sello con migas, solo el nombre y la
// barra de resultados del inicio. Las reglas de sesión siguen en e20 y e19.

function row(index: number) {
  const own = index < 15;
  return {
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
    slug: `release-u11-${index + 1}`,
    title: `Release U11 ${String(index + 1).padStart(2, '0')}`,
    release_date: `20${String(10 + (index % 16))}-0${(index % 9) + 1}-15`,
    type: 'EP',
    label: own ? 'Sello U11' : 'Otro sello',
    review: '',
    experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
    artists: [own ? 'Artista U11' : `Artista ${index + 1}`],
    primary_artists: [own
      ? { id: 'artist-u11', slug: 'artista-u11', name: 'Artista U11', position: 0 }
      : { id: `artist-${index}`, slug: `artista-${index}`, name: `Artista ${index + 1}`, position: 0 }],
    collaborators: [],
    credit_quality: 'verified',
    genres: ['Ambient'],
    countries: ['Colombia'],
    buy_link: '',
    cover: ''
  };
}

const rows = Array.from({ length: 40 }, (_, index) => row(index));

function fulfillRows(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
    body: JSON.stringify(rows)
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/catalog_releases**', (route) => fulfillRows(route));
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
});

const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    test('U11: la bienvenida es un bloque del catálogo con el hueco de la ilustración y acciones del sistema', async ({ page }) => {
      await page.goto('/');
      const welcome = page.locator('[data-welcome-banner]');
      await expect(welcome).toBeVisible();
      await expect(welcome.getByRole('heading', { level: 1, name: 'Explora la biblioteca de Discótica' })).toBeVisible();

      // Hueco de la ilustración: sin arte, el logo atenuado y oculto al lector.
      const art = welcome.locator('[data-welcome-illustration]');
      await expect(art).toBeVisible();
      await expect(art.locator('.cover-fallback')).toHaveAttribute('aria-hidden', 'true');
      // La proporción es el alto mínimo (el hueco se estira si el texto es más
      // alto), así que depende de la fuente: Work Sans no se carga y en Linux
      // (CI) cae a la sans genérica, que da un texto más alto. Se comprueba la
      // proporción declarada y que el hueco nunca sea más ancho que ella.
      const ratio = viewport.width > 768 ? 4 / 3 : 5 / 2;
      await expect(art).toHaveCSS('aspect-ratio', viewport.width > 768 ? '4 / 3' : '5 / 2');
      const artBox = await art.boundingBox();
      expect(artBox!.width / artBox!.height).toBeLessThanOrEqual(ratio + 0.05);

      // Botones del sistema (U5) y el bloque alineado con la grilla.
      await expect(welcome.getByRole('button', { name: 'Explorar' })).toHaveClass(/ui-btn--primary/);
      await expect(welcome.getByRole('button', { name: 'Cerrar bienvenida' })).toHaveClass(/ui-btn--square/);
      const block = await welcome.locator('.welcome__block').boundingBox();
      const grid = await page.locator('.resultados__grid').boundingBox();
      expect(Math.round(block!.x)).toBe(Math.round(grid!.x));
      expect(Math.round(block!.width)).toBe(Math.round(grid!.width));

      // Desktop: ilustración a la izquierda, como la portada de la ficha. Móvil: debajo del texto.
      const copy = await welcome.locator('.welcome__copy').boundingBox();
      if (viewport.width > 768) expect(artBox!.x).toBeLessThan(copy!.x);
      else expect(artBox!.y).toBeGreaterThan(copy!.y);

      await noHorizontalScroll(page);
    });

    for (const [path, kind, name] of [['/artista/artista-u11', 'Artista', 'Artista U11'], ['/sello/sello-u11', 'Sello', 'Sello U11']]) {
      test(`U11: ${kind.toLowerCase()} con migas "Catálogo › ${kind}", solo el nombre a la izquierda y sin filtros`, async ({ page }) => {
        await page.goto(`${path}?pais=Colombia&p=2`);

        const crumbs = page.getByRole('navigation', { name: 'Migas de pan' });
        await expect(crumbs).toHaveText(/Catálogo\s*›\s*/);
        await expect(crumbs.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/?pais=Colombia&p=2');
        await expect(crumbs.locator('[aria-current="page"]')).toHaveText(kind);

        // Cabecera: solo el h1 con el nombre, alineado a la izquierda del contenido.
        const header = page.locator('.l-page__header');
        await expect(header.getByRole('heading', { level: 1 })).toHaveText(name);
        await expect(header.locator('.l-page__eyebrow, .l-page__actions, select')).toHaveCount(0);
        await expect(header.getByRole('heading', { level: 1 })).toHaveCSS('text-align', /start|left/);
        const title = await header.getByRole('heading', { level: 1 }).boundingBox();
        const crumbsBox = await crumbs.boundingBox();
        expect(Math.round(title!.x)).toBe(Math.round(crumbsBox!.x));

        // Sin filtros internos: ni búsqueda ni panel ni chips de filtro.
        await expect(page.getByRole('button', { name: /Buscar/ })).toHaveCount(0);
        await expect(page.locator('.filtros, .active-pills-outside, .mobile-search-row')).toHaveCount(0);

        // Barra del inicio: paginación "x de y", contador y orden; sin selector grilla/lista.
        const bar = page.locator('.results-bar');
        await expect(bar.getByRole('navigation', { name: 'Paginación superior de resultados' })).toContainText('1 de 2');
        await expect(bar.getByRole('combobox', { name: 'Ordenar por' })).toBeVisible();
        await expect(bar.locator('.ui-view-toggle')).toHaveCount(0);
        await expect(page.locator('.card--grid')).toHaveCount(12);

        await bar.getByRole('combobox', { name: 'Ordenar por' }).selectOption('titulo-asc');
        await expect(page.locator('.card--grid').first()).toContainText('Release U11 01');
        await page.getByRole('navigation', { name: 'Paginación inferior de resultados' }).getByRole('button', { name: 'Página siguiente' }).click();
        await expect(page.locator('.card--grid')).toHaveCount(3);

        await noHorizontalScroll(page);
      });
    }
  });
}

test('U11: artista sin lanzamientos muestra un estado vacío con una acción', async ({ page }) => {
  await page.goto('/artista/no-existe-u11');
  await expect(page.getByText('Este artista aún no tiene lanzamientos en Discótica.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/');
  await expect(page.locator('.results-bar')).toHaveCount(0);
});
