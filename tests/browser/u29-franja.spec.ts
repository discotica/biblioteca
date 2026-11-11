import { expect, test, type Page } from '@playwright/test';

// U29 (tablero D): la franja de entrada con el campo de pulso, el buscador de 560
// con las chips en su fila y «N más», y el hueco único de bienvenida y nota beta.
// La URL, el historial y el scroll de la búsqueda no cambian: las pruebas de E12,
// E17, E19 y U18 siguen siendo las que lo cubren.

const betaEnabled = process.env.VITE_BETA_INVITATION_ENABLED === 'true';

const rows = Array.from({ length: 24 }, (_, index) => ({
  id: `29292929-2929-4929-8929-${String(index + 1).padStart(12, '0')}`,
  slug: `release-u29-${index + 1}`,
  title: `Release U29 ${index + 1}`,
  release_date: `2026-${String((index % 9) + 1).padStart(2, '0')}-15`,
  type: index % 2 ? 'EP' : 'Álbum',
  label: 'Sello U29', review: '', experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
  artists: [`Artista U29 ${index + 1}`],
  primary_artists: [{ id: `artist-u29-${index + 1}`, slug: `artista-u29-${index + 1}`, name: `Artista U29 ${index + 1}`, position: 0 }],
  collaborators: [], credit_quality: 'verified', genres: ['Electro'], countries: ['Colombia'], buy_link: '', cover: ''
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

const searchField = (page: Page) => page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
// Solo las visibles en la fila: las del panel de «N más» cuelgan de otra caja.
const chips = (page: Page) => page.locator('.home-search .pills > li > .chip-activo');
const masButton = (page: Page) => page.locator('.home-search .pills__mas-boton');

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`Sin caja para ${selector}`);
  return rect;
}

// Con la bienvenida a la vista no hay URL con filtros: las chips se crean con el
// campo (Enter confirma el texto) y el panel se cierra con la ×.
async function addTextChips(page: Page, words: string[]) {
  const input = searchField(page);
  await input.click();
  for (const word of words) {
    await input.fill(word);
    await input.press('Enter');
    await expect(page.locator('.home-search .pills')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Cerrar búsqueda' }).click();
  await expect(page.locator('#panel-busqueda')).toHaveCount(0);
}

test.describe('desktop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('bienvenida: franja de 460 bajo el cabecero, título 102/92, campo de 560 y una sola instancia del campo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const welcome = page.locator('[data-welcome-banner]');
    await expect(welcome).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const header = await box(page, 'header.site-header');
    const franja = await box(page, '.franja');
    expect(Math.round(franja.y)).toBe(Math.round(header.y + header.height));
    expect(Math.round(franja.height)).toBe(460);
    expect(Math.round(franja.width)).toBe(1440);

    const h1 = welcome.getByRole('heading', { level: 1, name: 'Explora la biblioteca' });
    await expect(h1).toHaveCSS('font-size', '102px');
    await expect(h1).toHaveCSS('line-height', /^92(\.\d+)?px$/);
    await expect(h1).toHaveCSS('font-weight', '700');

    // El campo de pulso es el único canvas vivo y no recibe foco ni eventos.
    const canvas = page.locator('canvas.ui-campo-pulso');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveCSS('pointer-events', 'none');
    expect(await canvas.evaluate((node) => node.closest('[aria-hidden="true"]') !== null)).toBe(true);

    // Buscador: 560 × 56, a la izquierda del contenedor y 24 bajo la franja.
    await expect(searchField(page)).toHaveAttribute('placeholder', 'Buscar por país, género, artista, sello o álbum');
    const field = await box(page, '.home-search__field');
    const grid = await box(page, '.resultados__grid');
    expect(Math.round(field.width)).toBe(560);
    expect(Math.round((await box(page, '.home-search .busqueda-input-row')).height)).toBe(56);
    expect(Math.round(field.x)).toBe(Math.round(grid.x));
    expect(Math.round(field.y - (franja.y + franja.height))).toBe(24);
  });

  test('bienvenida con 6 chips: cuatro, «2 más» en la fila del campo y el resto en un panel con teclado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await addTextChips(page, ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']);

    // Cuatro visibles y «2 más», todos en la línea del campo y pegados a la derecha.
    await expect(chips(page)).toHaveCount(4);
    const mas = masButton(page);
    await expect(mas).toHaveText('2 más');
    await expect(mas).toHaveAttribute('aria-expanded', 'false');
    const field = await box(page, '.home-search__field');
    const row = await box(page, '.home-search__row');
    const masBox = (await mas.boundingBox())!;
    expect(Math.abs(masBox.y + masBox.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(masBox.x + masBox.width - (row.x + row.width))).toBeLessThanOrEqual(1);
    const firstChip = (await chips(page).first().boundingBox())!;
    expect(firstChip.x).toBeGreaterThanOrEqual(field.x + field.width);

    // Teclado: Enter abre, Tab entra en el panel y Escape cierra devolviendo el foco al botón.
    await mas.focus();
    await page.keyboard.press('Enter');
    await expect(mas).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('.pills__mas-panel');
    await expect(panel.locator('.chip-activo')).toHaveCount(2);
    await page.keyboard.press('Tab');
    await expect(panel.locator('.chip-activo').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(mas).toBeFocused();
    await expect(mas).toHaveAttribute('aria-expanded', 'false');

    // Con el ratón: abre, un clic fuera cierra.
    await mas.click();
    await expect(panel).toBeVisible();
    await page.locator('.results-bar').click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);

    // Quitar desde el panel: el botón se queda con el foco y el conteo baja; sin resto, el botón desaparece.
    await mas.click();
    await panel.getByRole('button', { name: /^Quitar/ }).first().click();
    await expect(chips(page)).toHaveCount(4);
    await expect(mas).toHaveText('1 más');
    await expect(mas).toBeFocused();
    await expect(panel.locator('.chip-activo')).toHaveCount(1);
    await panel.getByRole('button', { name: /^Quitar/ }).first().click();
    await expect(mas).toHaveCount(0);
    await expect(chips(page)).toHaveCount(4);
  });

  test('con el panel abierto, las chips bajan, empiezan donde el campo y «N más» sigue abriendo el resto', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await addTextChips(page, ['uno', 'dos', 'tres', 'cuatro', 'cinco']);
    await searchField(page).click();
    await expect(page.locator('#panel-busqueda')).toBeVisible();
    const field = await box(page, '.home-search__field');
    const firstChip = (await chips(page).first().boundingBox())!;
    expect(firstChip.y).toBeGreaterThan(field.y + field.height - 1);
    expect(Math.abs(firstChip.x - field.x)).toBeLessThanOrEqual(1);
    await expect(masButton(page)).toHaveText('1 más');
  });

  test('sin bienvenida ni nota: banda reducida de 120 con título 28, campo de 420 y tres chips más «N más»', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?pais=Colombia&genero=Techno&a%C3%B1o=2024&type=EP&texto=zeta');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await expect(page.locator('[data-welcome-banner], [data-beta-invitation]')).toHaveCount(0);

    const franja = await box(page, '.franja');
    expect(Math.round(franja.height)).toBe(120);
    await expect(page.locator('canvas.ui-campo-pulso')).toHaveCount(1);
    const title = page.getByRole('heading', { level: 1, name: 'Explora la biblioteca' });
    await expect(title).toHaveCSS('font-size', '28px');
    const field = await box(page, '.home-search__field');
    expect(Math.round(field.width)).toBe(420);
    expect(Math.round((await box(page, '.home-search .busqueda-input-row')).height)).toBe(48);
    // El campo queda centrado en la banda.
    expect(Math.abs(field.y + field.height / 2 - (franja.y + franja.height / 2))).toBeLessThanOrEqual(1);

    await expect(chips(page)).toHaveCount(3);
    await expect(masButton(page)).toHaveText('2 más');
  });

  test('la franja ocupa su altura sola: los resultados empiezan bajo ella y no se mueven al abrir el panel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?pais=Colombia');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    const before = await box(page, '.franja');
    await searchField(page).click();
    await expect(page.locator('#panel-busqueda')).toBeVisible();
    const after = await box(page, '.franja');
    expect(Math.round(after.height)).toBe(Math.round(before.height));
    expect(Math.round(after.y)).toBe(Math.round(before.y));
  });

  test('el campo de pulso se queda quieto con movimiento reducido y no añade scroll horizontal', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-welcome-banner]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Dos fotogramas iguales: no hay bucle de animación dibujando.
    const frame = () => page.locator('canvas.ui-campo-pulso').evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    const first = await frame();
    await page.mouse.move(400, 250);
    await page.waitForTimeout(250);
    expect(await frame()).toBe(first);
  });
});

test.describe('beta con flag activo', () => {
  test.skip(!betaEnabled, 'Estas comprobaciones requieren VITE_BETA_INVITATION_ENABLED=true.');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('la nota beta ocupa el mismo hueco que la bienvenida, a todo el ancho y sin diálogo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?beta=1&nombre=Laura');
    const note = page.locator('[data-beta-invitation]');
    await expect(note).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-welcome-banner]')).toHaveCount(0);
    const franja = await box(page, '.franja');
    expect(Math.round(franja.x)).toBe(0);
    expect(Math.round(franja.width)).toBe(1440);
    expect(franja.height).toBeGreaterThanOrEqual(460);
    const h1 = note.getByRole('heading', { level: 1, name: 'Hola, Laura.' });
    await expect(h1).toHaveCSS('font-size', '102px');
    await expect(page.locator('canvas.ui-campo-pulso')).toHaveCount(1);
    // Bajo la franja, el mismo buscador de 560 × 56.
    const field = await box(page, '.home-search__field');
    expect(Math.round(field.width)).toBe(560);
    expect(Math.round((await box(page, '.home-search .busqueda-input-row')).height)).toBe(56);
  });

  test('con 6 chips en la URL: cuatro y «2 más», sin que la nota cambie la URL de búsqueda', async ({ page }) => {
    await page.goto('/?beta=1&nombre=Laura&pais=Colombia&pais=Argentina&genero=Techno&genero=Cumbia&a%C3%B1o=2024&type=EP');
    await expect(page.locator('[data-beta-invitation]')).toBeVisible();
    await expect(chips(page)).toHaveCount(4);
    await expect(masButton(page)).toHaveText('2 más');
    await masButton(page).click();
    await expect(page.locator('.pills__mas-panel .chip-activo')).toHaveCount(2);
    await expect(page).toHaveURL(/beta=1&nombre=Laura&pais=Colombia&pais=Argentina&genero=Techno&genero=Cumbia/);
  });
});

test.describe('móvil 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('bienvenida: título 48/46 en la franja y la barra móvil debajo; sin campo de desktop ni banda reducida', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const welcome = page.locator('[data-welcome-banner]');
    await expect(welcome).toBeVisible();
    const h1 = welcome.getByRole('heading', { level: 1, name: 'Explora la biblioteca' });
    await expect(h1).toHaveCSS('font-size', '48px');
    await expect(h1).toHaveCSS('line-height', /^46(\.\d+)?px$/);
    await expect(page.locator('.home-search__field')).toBeHidden();
    const franja = await box(page, '.franja');
    const bar = await box(page, '.mobile-search-row');
    expect(bar.y).toBeGreaterThanOrEqual(franja.y + franja.height - 1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Cerrada la bienvenida, no queda banda en móvil: la barra sube bajo el cabecero.
    await page.getByRole('button', { name: 'Cerrar bienvenida' }).click();
    await expect(page.locator('.franja')).toBeHidden();
  });

  test('las chips siguen en banda desplazable, sin «N más»', async ({ page }) => {
    await page.goto('/?pais=Colombia&pais=Argentina&genero=Techno&genero=Cumbia&a%C3%B1o=2024&type=EP');
    await expect(page.locator('.card--grid').first()).toBeVisible();
    await expect(page.locator('.active-pills-outside .chip-activo')).toHaveCount(6);
    await expect(page.locator('.pills__mas')).toHaveCount(0);
  });
});
