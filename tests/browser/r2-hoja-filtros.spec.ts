import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

const longLabel = 'Sello Independiente de Música Experimental Latinoamericana y del Caribe Colectivo Autogestionado';
const longCountry = 'República Democrática Federal de Centroamérica y Territorios Insulares Asociados';
const longGenre = 'Electroacústica contemporánea de improvisación libre con instrumentos intervenidos';
const unbrokenLabel = 'SelloConUnNombreExtraordinariamenteLargoSinEspaciosParaRomperLaLinea';

const rows = Array.from({ length: 6 }, (_, index) => ({
  id: `20202020-2020-4020-8020-${String(index + 1).padStart(12, '0')}`,
  slug: `release-r2-${index + 1}`,
  title: `Release R2 ${index + 1}`,
  release_date: `2026-0${index + 1}-15`,
  type: index % 2 ? 'EP' : 'Álbum',
  label: index % 2 ? longLabel : unbrokenLabel,
  review: '',
  experimental: 2,
  denso: 3,
  sintetico: 1,
  bailable: 4,
  rapido: 2,
  artists: [`Artista R2 ${index + 1}`],
  primary_artists: [{ id: `artist-${index + 1}`, slug: `artista-${index + 1}`, name: `Artista R2 ${index + 1}`, position: 0 }],
  collaborators: [],
  credit_quality: 'verified',
  genres: [longGenre, 'Ambient'],
  countries: [longCountry, 'Chile'],
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
  await page.route('**/rest/v1/rpc/resolve_release_slug', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
});

/**
 * Elements of the sheet whose box leaves the sheet's content column on the right.
 * U10: the active filters are a horizontal scrolling band; what lies beyond its
 * visible width is scrolled, not overflowing, so the band itself is the check.
 */
async function overflowing(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('.filtros-mobile-sheet') as HTMLElement;
    const limit = sheet.getBoundingClientRect().right + 0.5;
    const out: string[] = [];
    for (const node of sheet.querySelectorAll<HTMLElement>('*')) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(node).visibility === 'hidden') continue;
      const scroller = node.parentElement?.closest<HTMLElement>('.pills--band');
      if (scroller && sheet.contains(scroller)) continue;
      if (box.right > limit) out.push(`${node.tagName.toLowerCase()}.${node.className}: ${Math.round(box.right)} > ${Math.round(limit)}`);
    }
    return { out, sheetOverflow: sheet.scrollWidth > sheet.clientWidth, pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
  });
}

test('R2: las opciones largas no desbordan la columna de la hoja de filtros a 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  // U10b-2: el buscador va en la barra; sus sugerencias, a todo el ancho de
  // la barra, tampoco desbordan la página.
  const barInput = page.locator('.mobile-search-row').getByRole('combobox');
  await barInput.fill('Electro');
  const listbox = page.getByRole('listbox', { name: 'Sugerencias de búsqueda' });
  await expect(listbox).toBeVisible();
  expect(await listbox.evaluate((node) => {
    const limit = node.getBoundingClientRect().right + 0.5;
    return [...node.querySelectorAll<HTMLElement>('*')].filter((child) => child.getBoundingClientRect().right > limit).length;
  })).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await barInput.fill('');

  await page.locator('.mobile-search-row').getByRole('button', { name: /^Filtros/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await expect(sheet).toBeVisible();

  // País y género: con la nube abierta y con varias opciones elegidas.
  for (const name of ['País', 'Género']) {
    const campo = sheet.locator('.cloud-campo').filter({ hasText: name });
    await campo.locator('summary').click();
    const tags = campo.locator('.tag');
    for (let index = 0; index < Math.min(await tags.count(), 3); index += 1) await tags.nth(index).click();
    const open = await overflowing(page);
    expect(open.out, `${name} abierto: ${open.out.join('\n')}`).toEqual([]);
    await campo.locator('summary').click();
  }
  const closedClouds = await overflowing(page);
  expect(closedClouds.out, closedClouds.out.join('\n')).toEqual([]);

  // Selects secundarios: abrir cada uno y elegir la última opción (la más larga: sello).
  const dropdowns = sheet.locator('.filtros-grilla .campo .dropdown');
  const count = await dropdowns.count();
  for (let index = 0; index < count; index += 1) {
    await dropdowns.nth(index).locator('summary').click();
    const options = dropdowns.nth(index).locator('li button');
    const total = await options.count();
    if (total > 1) await options.nth(total - 1).click();
  }

  const result = await overflowing(page);
  expect(result.out, result.out.join('\n')).toEqual([]);
  expect(result.sheetOverflow).toBe(false);
  expect(result.pageOverflow).toBe(false);

  // Con cada menú abierto, tampoco desborda.
  for (let index = 0; index < count; index += 1) {
    await dropdowns.nth(index).locator('summary').click();
    const open = await overflowing(page);
    expect(open.out, `menú ${index}: ${open.out.join('\n')}`).toEqual([]);
    await dropdowns.nth(index).locator('summary').click();
  }
});
