import { expect, test, type Page, type Route } from '@playwright/test';

// U32 — Fichas de artista y sello (tablero G2): cenefa con la portada más
// reciente, título en su propia fila, columna de datos calculada de los
// lanzamientos cargados y «N más» con su desplegable (ancho de la columna,
// 8 filas y scroll, teclado completo y Escape). La colección se cubre en u14.

const LABELS = ['Independiente', 'Abeja', 'Bruma', 'Cauce', 'Duna', 'Eco', 'Fango', 'Grieta', 'Humo', 'Isla', 'Jade'];
const GENRES = ['Ambient', 'Bass', 'Cumbia', 'Dembow', 'Electro', 'Footwork', 'Guaracha', 'House', 'IDM', 'Jungle', 'Kuduro', 'Leftfield'];

function row(index: number, kind: 'artista' | 'sello') {
  const n = String(index + 1).padStart(2, '0');
  const artist = kind === 'artista'
    ? { id: 'artist-u32', slug: 'artista-u32', name: 'Artista U32', position: 0 }
    : { id: `artist-s${index}`, slug: `artista-s${index}`, name: `Artista S${n}`, position: 0 };
  return {
    id: `32323232-3232-4232-8232-${kind === 'artista' ? '1' : '2'}${String(index + 1).padStart(11, '0')}`,
    slug: `u32-${kind}-${n}`,
    title: `U32 ${kind} ${n}`,
    release_date: `${2000 + index}-05-15`,
    type: 'EP',
    label: kind === 'artista' ? LABELS[index % LABELS.length] : 'Sello U32',
    review: '',
    experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
    artists: [artist.name],
    primary_artists: [artist],
    collaborators: [],
    credit_quality: 'verified',
    genres: [GENRES[index % GENRES.length]],
    countries: index % 3 === 0 ? ['Perú', 'LATAM'] : ['Colombia'],
    buy_link: '',
    cover: `https://example.test/u32-${kind}-${n}.jpg`
  };
}

const ARTIST_ROWS = Array.from({ length: 22 }, (_, index) => row(index, 'artista'));
const LABEL_ROWS = Array.from({ length: 14 }, (_, index) => row(index, 'sello'));
const rows = [...ARTIST_ROWS, ...LABEL_ROWS];

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
  await page.route('https://example.test/**', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#96f719"/></svg>'
  }));
});

const dato = (page: Page, etiqueta: string) => page.locator('.ficha-cabeza .ficha-dato').filter({ has: page.locator('dt', { hasText: new RegExp(`^${etiqueta}$`) }) });

/** Nombres a la vista + «N más» = la lista completa; nunca más de tres nombres. */
async function expectListaCompleta(page: Page, etiqueta: string, total: number) {
  const fila = dato(page, etiqueta);
  const nombres = fila.locator('.ficha-dato__nombres a');
  await expect.poll(() => nombres.count()).toBeGreaterThan(0);
  const visibles = await nombres.count();
  expect(visibles).toBeLessThanOrEqual(3);
  if (visibles < total) await expect(fila.getByRole('button', { name: `${total - visibles} más` })).toBeVisible();
  else await expect(fila.getByRole('button')).toHaveCount(0);
  return visibles;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    test('U32 artista: datos por frecuencia, sin «Independiente» ni «LATAM», y cenefa con la portada más reciente', async ({ page }) => {
      await page.goto('/artista/artista-u32');
      const header = page.locator('.ficha-cabeza');
      await expect(header.getByRole('heading', { level: 1 })).toHaveText('Artista U32');
      await expect(header.locator('dt')).toHaveText(['Países', 'Años', 'Sellos', 'Géneros', 'Lanzamientos']);

      // Colombia (14) va antes que Perú (8); «LATAM» no es un país.
      await expect(dato(page, 'Países').locator('.ficha-dato__nombres a')).toHaveText(['Colombia', 'Perú']);
      await expect(dato(page, 'Años')).toContainText('2000–2021');
      await expect(dato(page, 'Lanzamientos')).toContainText('22');
      // 10 sellos: «Independiente» no cuenta.
      await expectListaCompleta(page, 'Sellos', LABELS.length - 1);
      await expectListaCompleta(page, 'Géneros', GENRES.length);
      await expect(header).not.toContainText('Independiente');
      await expect(header).not.toContainText('LATAM');

      // La superficie es la portada del lanzamiento más reciente (2021).
      await expect(page.locator('.ficha-cabeza .ui-cenefa__portada')).toHaveAttribute('src', 'https://example.test/u32-artista-22.jpg');

      // El título va en su propia fila: la columna empieza debajo de él.
      const title = await header.getByRole('heading', { level: 1 }).boundingBox();
      const column = await header.locator('.ficha-datos').boundingBox();
      expect(column!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
      if (viewport.width > 768) expect(Math.round(column!.width)).toBe(372);

      // Debajo, la barra de resultados y la rejilla de siempre.
      await expect(page.locator('.results-bar').getByRole('navigation', { name: 'Paginación superior de resultados' })).toContainText('1 de 2');
      await expect(page.locator('.card--grid')).toHaveCount(12);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('U32 «N más»: desplegable del ancho de la columna, 8 filas y scroll, teclado y Escape', async ({ page }) => {
      await page.goto('/artista/artista-u32');
      const fila = dato(page, 'Sellos');
      const visibles = await expectListaCompleta(page, 'Sellos', 10);
      const boton = fila.getByRole('button', { name: `${10 - visibles} más` });

      await boton.click();
      await expect(boton).toHaveAttribute('aria-expanded', 'true');
      const menu = page.getByRole('menu', { name: 'Sellos de Artista U32' });
      await expect(menu).toBeVisible();

      // Toda la lista, con su cantidad, enlazada a cada ficha; la primera recibe el foco.
      const items = menu.getByRole('menuitem');
      await expect(items).toHaveCount(10);
      await expect(items.first()).toBeFocused();
      await expect(items.first()).toHaveAttribute('href', /^\/sello\//);
      await expect(items.first().locator('.ui-menu__detail')).toHaveText(/^\d+$/);

      // Opaco y del ancho de la columna.
      const menuBox = await menu.boundingBox();
      const columnBox = await page.locator('.ficha-cabeza .ficha-datos').boundingBox();
      expect(Math.abs(menuBox!.width - columnBox!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(menuBox!.x - columnBox!.x)).toBeLessThanOrEqual(1);
      await expect(menu).toHaveCSS('background-color', 'rgb(18, 18, 18)');

      // 8 filas a la vista; el resto, con scroll.
      const scroller = menu.locator('.ui-menu__filas');
      const medidas = await scroller.evaluate((el) => {
        const fila = el.querySelector('[role="menuitem"]') as HTMLElement;
        return { visible: el.clientHeight, total: el.scrollHeight, fila: fila.offsetHeight };
      });
      expect(Math.round(medidas.visible / medidas.fila)).toBe(8);
      expect(medidas.total).toBeGreaterThan(medidas.visible);

      // Teclado: flechas, Fin (con scroll hasta la última) e Inicio.
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('End');
      await expect(items.last()).toBeFocused();
      expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press('Home');
      await expect(items.first()).toBeFocused();

      // Escape cierra y devuelve el foco al botón.
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(boton).toBeFocused();
      await expect(boton).toHaveAttribute('aria-expanded', 'false');

      // Con el teclado: abre con Enter y navega a la ficha del sello.
      await page.keyboard.press('Enter');
      await expect(items.first()).toBeFocused();
      const destino = await items.first().getAttribute('href');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
    });

    test('U32 sello: Países, Años, Artistas principales, Géneros y Lanzamientos', async ({ page }) => {
      await page.goto('/sello/sello-u32');
      const header = page.locator('.ficha-cabeza');
      await expect(header.getByRole('heading', { level: 1 })).toHaveText('Sello U32');
      await expect(header.locator('dt')).toHaveText(['Países', 'Años', 'Artistas', 'Géneros', 'Lanzamientos']);
      await expect(dato(page, 'Años')).toContainText('2000–2013');
      await expect(dato(page, 'Lanzamientos')).toContainText('14');
      const visibles = await expectListaCompleta(page, 'Artistas', 14);

      await dato(page, 'Artistas').getByRole('button', { name: `${14 - visibles} más` }).click();
      const menu = page.getByRole('menu', { name: 'Artistas de Sello U32' });
      await expect(menu.getByRole('menuitem')).toHaveCount(14);
      await expect(menu.getByRole('menuitem').first()).toHaveAttribute('href', /^\/artista\/artista-s\d+$/);
      // Un clic fuera lo cierra.
      await page.locator('.ficha-cabeza h1').click();
      await expect(menu).toHaveCount(0);
    });
  });
}
