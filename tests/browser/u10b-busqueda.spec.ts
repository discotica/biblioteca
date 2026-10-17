import { expect, test, type Page, type Route } from '@playwright/test';

// U10b — Búsqueda directa. U10b-1 (desktop): el campo de texto es el
// disparador del panel; la × y el segundo Esc cierran sin perder nada, un clic
// fuera de la región también; Tab no abre; el formulario no tiene huecos.
// U10b-2 (móvil): al final del archivo.

const countries = ['Colombia', 'Argentina', 'México', 'Chile', 'Perú', 'Brasil'];
const genres = ['Electro', 'Ambient', 'House', 'Techno', 'Reggaetón'];

function row(index: number) {
  return {
    id: `10b10b10-1010-4010-8010-${String(index + 1).padStart(12, '0')}`,
    slug: `release-u10b-${index + 1}`,
    title: `Release U10b ${index + 1}`,
    release_date: `20${String(10 + (index % 16))}-${String((index % 9) + 1).padStart(2, '0')}-15`,
    type: index % 2 ? 'EP' : 'Álbum',
    label: index % 3 ? 'Sello Directo' : 'Otro sello',
    review: '',
    experimental: 2, denso: 3, sintetico: 1, bailable: 4, rapido: 2,
    artists: [`Artista ${index + 1}`],
    primary_artists: [{ id: `artist-u10b-${index}`, slug: `artista-u10b-${index}`, name: `Artista ${index + 1}`, position: 0 }],
    collaborators: [],
    credit_quality: 'verified',
    genres: [genres[index % genres.length]],
    countries: [countries[index % countries.length]],
    buy_link: '',
    cover: ''
  };
}

const rows = Array.from({ length: 60 }, (_, index) => row(index));

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

const searchInput = (page: Page) => page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
const filterPanel = (page: Page) => page.locator('#panel-busqueda');

// El panel entra con un desplazamiento de 8 px: se mide en su posición final.
async function panelSettled(page: Page) {
  await filterPanel(page).waitFor();
  await filterPanel(page).evaluate((node) => Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)));
}

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await page.locator('.card--grid').first().waitFor();
}

for (const width of [1440, 1024, 834]) {
  test.describe(`desktop a ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`U10b: un clic en el campo enfoca y abre el panel, y el campo crece hasta el ancho del panel (${width})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ready(page);
      const input = searchInput(page);
      const row = page.locator('.home-search__row');

      // Cerrado: centrado, min(100%, 24rem), sin ×.
      await expect(filterPanel(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cerrar búsqueda' })).toHaveCount(0);
      const closed = (await page.locator('.home-search__field').boundingBox())!;
      const rowBox = (await row.boundingBox())!;
      expect(Math.abs(closed.x + closed.width / 2 - (rowBox.x + rowBox.width / 2))).toBeLessThanOrEqual(1);
      expect(Math.round(closed.width)).toBe(Math.min(Math.round(rowBox.width), 384));
      expect(Math.round((await page.locator('.home-search .busqueda-input-row').boundingBox())!.height)).toBe(52);

      await input.click();
      await expect(input).toBeFocused();
      await expect(filterPanel(page)).toBeVisible();
      const close = page.getByRole('button', { name: 'Cerrar búsqueda' });
      await expect(close).toHaveAttribute('aria-expanded', 'true');
      await expect(close).toHaveAttribute('aria-controls', 'panel-busqueda');
      await expect(close).toHaveText('');

      // Abierto: campo más × ocupan exactamente el ancho de la caja del panel.
      const panel = (await page.locator('.filtros-caja').boundingBox())!;
      const field = (await page.locator('.home-search__field').boundingBox())!;
      const closeBox = (await close.boundingBox())!;
      expect(Math.abs(field.x - panel.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(closeBox.x + closeBox.width - (panel.x + panel.width))).toBeLessThanOrEqual(1);
      expect(field.width).toBeGreaterThan(closed.width - 1);
      expect(Math.abs(closeBox.y + closeBox.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test(`U10b: la fila 2 del formulario es Tipo · Año · Reiniciar, sin hueco (${width})`, async ({ page }) => {
      await ready(page);
      await searchInput(page).click();
      await panelSettled(page);
      const panel = filterPanel(page);
      const tipo = (await panel.locator('.campo').filter({ hasText: 'Tipo' }).locator('summary').boundingBox())!;
      const año = (await panel.locator('.campo').filter({ hasText: 'Año' }).locator('summary').boundingBox())!;
      const reset = panel.getByRole('button', { name: 'Reiniciar filtros' });
      await expect(reset).toHaveClass(/ui-btn--accent/);
      const resetBox = (await reset.boundingBox())!;
      expect(Math.abs(tipo.y - año.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(año.y - resetBox.y)).toBeLessThanOrEqual(1);
      expect(Math.round(resetBox.height)).toBe(Math.round(año.height));
      expect(tipo.x + tipo.width).toBeLessThanOrEqual(año.x);
      expect(año.x + año.width).toBeLessThanOrEqual(resetBox.x);
      // Sin hueco: Reiniciar llega al borde derecho de Género, la fila de arriba.
      const genero = (await panel.locator('.cloud-campo').filter({ hasText: 'Género' }).locator('summary').boundingBox())!;
      expect(Math.abs(resetBox.x + resetBox.width - (genero.x + genero.width))).toBeLessThanOrEqual(1);
      // Y el panel ya no tiene pie.
      await expect(panel.locator('.filtros-pie')).toHaveCount(0);
    });
  });
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('U10b: las chips van centradas bajo el campo cerrado y al inicio con el panel abierto', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, '/?pais=Colombia&genero=Techno');
    const field = page.locator('.home-search__field');
    const pills = page.locator('.home-search .pills');
    const center = (box: { x: number; width: number }) => box.x + box.width / 2;
    const chipsBox = async () => {
      const boxes = await page.locator('.home-search .chip-activo').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => ({ x: r.left, right: r.right })));
      return { x: Math.min(...boxes.map((b) => b.x)), width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.x)) };
    };

    expect(Math.abs(center(await chipsBox()) - center((await field.boundingBox())!))).toBeLessThanOrEqual(1);
    await searchInput(page).click();
    await panelSettled(page);
    const pillsBox = (await pills.boundingBox())!;
    expect(Math.abs((await chipsBox()).x - pillsBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pillsBox.x - (await field.boundingBox())!.x)).toBeLessThanOrEqual(1);
  });

  test('U10b: escribir abre el panel; la × lo cierra y conserva texto, chips y radar', async ({ page }) => {
    await ready(page, '/?pais=Colombia&radar_bailable=4');
    const input = searchInput(page);
    // Foco programático: no abre.
    await input.focus();
    await expect(filterPanel(page)).toHaveCount(0);
    await page.keyboard.type('Sello');
    await expect(filterPanel(page)).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Sugerencias de búsqueda' })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar búsqueda' }).click();
    await expect(filterPanel(page)).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Sello');
    await expect(page.locator('.home-search .chip-activo')).toHaveCount(2);
    await expect(page).toHaveURL(/pais=Colombia/);
    await expect(page).toHaveURL(/radar_bailable=4/);
    // Volver al campo con el foco no reabre; un clic sí.
    await page.waitForTimeout(250);
    await expect(filterPanel(page)).toHaveCount(0);
    await input.click();
    await expect(filterPanel(page)).toBeVisible();
    await expect(input).toHaveValue('Sello');
  });

  test('U10b: el primer Esc cierra las sugerencias y el segundo el panel', async ({ page }) => {
    await ready(page);
    const input = searchInput(page);
    await input.click();
    await input.fill('Sello');
    const listbox = page.getByRole('listbox', { name: 'Sugerencias de búsqueda' });
    await expect(listbox).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(filterPanel(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(filterPanel(page)).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Sello');

    // Enter con el panel cerrado sigue creando la chip (E12 sin cambios).
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/texto=Sello/);
    await expect(page.locator('.home-search .chip-activo')).toHaveCount(1);
  });

  test('U10b: un clic fuera cierra; las chips, las sugerencias y el desplegable de País cuentan como dentro', async ({ page }) => {
    await ready(page, '/?pais=Colombia&genero=Techno');
    const input = searchInput(page);
    await input.click();
    const panel = filterPanel(page);
    await expect(panel).toBeVisible();

    // Quitar una chip.
    await page.getByRole('button', { name: 'Quitar género Techno' }).click();
    await expect(page).not.toHaveURL(/genero=Techno/);
    await expect(panel).toBeVisible();

    // Elegir una sugerencia.
    await input.fill('Argen');
    await page.getByRole('option', { name: 'País Argentina' }).click();
    await expect(page).toHaveURL(/pais=Argentina/);
    await expect(panel).toBeVisible();

    // Abrir País y marcar una etiqueta.
    const pais = panel.locator('.cloud-campo').filter({ hasText: 'País' });
    await pais.locator('summary').click();
    await pais.locator('.tag', { hasText: 'Chile' }).click();
    await expect(page).toHaveURL(/pais=Chile/);
    await expect(panel).toBeVisible();

    // Un clic en los resultados cierra.
    await page.locator('.results-bar').click({ position: { x: 4, y: 4 } });
    await expect(panel).toHaveCount(0);
    await expect(page.locator('.home-search .chip-activo')).toHaveCount(3);
  });

  test('U10b: Tab llega al campo sin abrir el panel', async ({ page }) => {
    await ready(page);
    const input = searchInput(page);
    let reached = false;
    for (let step = 0; step < 40 && !reached; step += 1) {
      await page.keyboard.press('Tab');
      reached = await input.evaluate((node) => node === document.activeElement);
    }
    expect(reached).toBe(true);
    await expect(filterPanel(page)).toHaveCount(0);
    // Desde el teclado, ArrowDown abre.
    await page.keyboard.press('ArrowDown');
    await expect(filterPanel(page)).toBeVisible();
  });

  test('U10b: al abrir, el panel se despliega con --ease-expressive y las chips viajan con el campo en vez de saltar', async ({ page }) => {
    await ready(page, '/?pais=Colombia&genero=Techno');
    await searchInput(page).click();
    const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
    await expect(filterPanel(page)).toHaveCSS('animation-timing-function', easing);
    await expect(filterPanel(page)).toHaveCSS('animation-duration', '0.2s');
    // FLIP: cada chip tiene una animación de transform con la duración y la curva del campo.
    const chipAnimations = await page.locator('.home-search .pills > li').evaluateAll((items) => items.map((item) => {
      const animation = item.getAnimations()[0];
      const timing = animation?.effect?.getTiming();
      return animation ? { duration: timing?.duration, easing: timing?.easing } : null;
    }));
    expect(chipAnimations).toEqual([{ duration: 140, easing }, { duration: 140, easing }]);
    await panelSettled(page);
    await page.getByRole('button', { name: 'Cerrar búsqueda' }).click();
    await expect.poll(() => page.locator('.home-search .pills > li').first().evaluate((item) => item.getAnimations().length)).toBe(0);
  });

  test('U10b: el ancho crece con --motion-fast y sin transición con movimiento reducido', async ({ page }) => {
    await ready(page);
    const field = page.locator('.home-search__field');
    await expect(field).toHaveCSS('transition-duration', '0.14s');
    await expect(field).toHaveCSS('transition-property', 'max-width');
    await expect(field).toHaveCSS('transition-timing-function', 'cubic-bezier(0.16, 1, 0.3, 1)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(field).toHaveCSS('transition-property', 'none');
    // Con movimiento reducido el panel no se anima y las chips no viajan.
    await page.goto('/?pais=Colombia');
    await page.locator('.card--grid').first().waitFor();
    await searchInput(page).click();
    await expect(filterPanel(page)).toHaveCSS('animation-name', 'none');
    expect(await page.locator('.home-search .pills > li').first().evaluate((item) => item.getAnimations().length)).toBe(0);
  });
});

// U10b-2 (móvil): el campo vive en la barra sticky, con Filtros y la vista al
// lado; las sugerencias salen bajo la barra a todo su ancho y una chip baja el
// teclado. La hoja ya no tiene campo ni pie y el radar asoma por debajo.
const barInput = (page: Page) => page.locator('.mobile-search-row').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });
const filtersButton = (page: Page) => page.locator('.mobile-search-row').getByRole('button', { name: /^Filtros/ });

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
  test.describe(`móvil a ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test(`U10b: la barra es campo + Filtros + vista; las sugerencias van bajo la barra y Enter crea la chip y baja el teclado (${viewport.width})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ready(page, '/?pais=Colombia');
      const row = page.locator('.mobile-search-row');
      const input = barInput(page);
      const filters = filtersButton(page);

      // Un solo landmark de búsqueda: la barra.
      await expect(page.getByRole('search')).toHaveCount(1);
      await expect(page.getByRole('search').getByRole('combobox')).toHaveCount(1);
      // Una línea de 44: campo (flexible), Filtros con su insignia y la vista.
      const rowBox = (await row.boundingBox())!;
      const inputRow = (await row.locator('.busqueda-input-row').boundingBox())!;
      const filtersBox = (await filters.boundingBox())!;
      const toggle = (await row.getByRole('group', { name: 'Vista de resultados' }).boundingBox())!;
      expect(Math.round(inputRow.height)).toBe(44);
      expect(Math.round(filtersBox.width)).toBe(44);
      expect(Math.round(filtersBox.height)).toBe(44);
      expect(inputRow.x + inputRow.width).toBeLessThanOrEqual(filtersBox.x);
      expect(filtersBox.x + filtersBox.width).toBeLessThanOrEqual(toggle.x);
      for (const box of [inputRow, filtersBox, toggle]) expect(Math.abs(box.y + box.height / 2 - (rowBox.y + rowBox.height / 2))).toBeLessThanOrEqual(1);
      await expect(filters).toHaveAttribute('aria-label', 'Filtros, 1 activo');
      await expect(filters).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(filters).toHaveAttribute('aria-expanded', 'false');
      await expect(row.locator('.mobile-search-badge')).toHaveText('1');

      await input.click();
      await input.fill('Sello');
      const listbox = page.getByRole('listbox', { name: 'Sugerencias de búsqueda' });
      await expect(listbox).toBeVisible();
      const list = (await listbox.boundingBox())!;
      // Bajo la barra, a todo su ancho, y por encima de la banda de chips.
      expect(list.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
      expect(Math.abs(list.x - rowBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(list.width - rowBox.width)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => {
        const option = document.querySelector('#sugerencias-busqueda-movil [role="option"]') as HTMLElement;
        const box = option.getBoundingClientRect();
        return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('[role="listbox"]') !== null;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/texto=Sello/);
      await expect(page.locator('.active-pills-outside .chip-activo')).toHaveCount(2);
      await expect(input).not.toBeFocused();
      await expect(input).toHaveValue('');
      await expect(listbox).toHaveCount(0);
      await expect(filters).toHaveAttribute('aria-label', 'Filtros, 2 activos');
    });

    test(`U10b: Filtros abre la hoja sin campo ni pie, con Reiniciar tras Tipo·Año y el radar asomando (${viewport.width})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await ready(page);
      const filters = filtersButton(page);
      await filters.click();
      const sheet = page.getByRole('dialog', { name: 'Filtros' });
      await expect(sheet).toBeVisible();
      // Con la hoja modal abierta, el resto de la página queda fuera del árbol accesible.
      await expect(page.locator('.mobile-search-filters button')).toHaveAttribute('aria-expanded', 'true');
      await expect(sheet.getByRole('combobox')).toHaveCount(0);
      await expect(sheet.getByRole('textbox')).toHaveCount(0);
      await expect(sheet.locator('.ui-sheet__footer')).toHaveCount(0);
      await expect(sheet.getByRole('button', { name: /^Ver / })).toHaveCount(0);
      await expect(sheet.locator('details.sheet-radar')).toHaveCount(0);

      // Orden: País · Género / Tipo · Año / Reiniciar / Radar.
      const tipo = (await sheet.locator('.campo').filter({ hasText: 'Tipo' }).locator('summary').boundingBox())!;
      const año = (await sheet.locator('.campo').filter({ hasText: 'Año' }).locator('summary').boundingBox())!;
      const reset = (await sheet.getByRole('button', { name: 'Reiniciar filtros' }).boundingBox())!;
      const radarTitle = sheet.getByRole('heading', { name: 'Radar' });
      await expect(radarTitle).toHaveCount(1);
      const radar = (await sheet.locator('.radar').boundingBox())!;
      expect(Math.abs(tipo.y - año.y)).toBeLessThanOrEqual(1);
      expect(reset.y).toBeGreaterThanOrEqual(tipo.y + tipo.height);
      expect(radar.y).toBeGreaterThanOrEqual(reset.y + reset.height);

      // La hoja se mide al abrir: el radar asoma entre 40 y 120 px sobre su borde inferior.
      const panel = (await sheet.locator('.ui-sheet__panel').boundingBox())!;
      const peek = panel.y + panel.height - radar.y;
      expect(peek).toBeGreaterThanOrEqual(40);
      expect(peek).toBeLessThanOrEqual(120);
      expect(panel.height).toBeLessThanOrEqual(viewport.height * 0.88 + 1);

      // El resto del radar se alcanza con scroll del cuerpo, sin scroll horizontal.
      const body = sheet.locator('.ui-sheet__body');
      expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Cambiar chips con la hoja abierta no cambia su altura.
      await sheet.getByRole('button', { name: 'Bailable: 3 de 5' }).click();
      await expect(page).toHaveURL(/radar_bailable=3/);
      await expect(sheet.locator('.chip-activo')).toHaveCount(1);
      expect(Math.abs((await sheet.locator('.ui-sheet__panel').boundingBox())!.height - panel.height)).toBeLessThanOrEqual(1);

      // Se cierra con la ×; el foco vuelve a Filtros.
      await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(filters).toBeFocused();
    });
  });
}

test.describe('móvil: teclado', () => {
  test.use({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true });

  test('U10b: con el campo de la barra enfocado y el teclado abierto, la barra no se oculta al desplazar', async ({ page }) => {
    await ready(page);
    await page.locator('main').evaluate((main) => {
      const spacer = document.createElement('div');
      spacer.style.height = '1600px';
      main.append(spacer);
    });
    const anchor = page.locator('.mobile-search-anchor');
    const input = barInput(page);
    await input.click();
    await expect(input).toBeFocused();
    // Teclado virtual: el viewport visual pierde 300 px con el campo enfocado.
    await page.evaluate(() => {
      if (!window.visualViewport) return;
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 300 });
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.evaluate(() => window.scrollTo(0, 360));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(360);
    await expect(anchor).toHaveAttribute('data-search-visible', 'true');
    // Al soltar el campo (y bajar el teclado) vuelve la auto-ocultación.
    await input.evaluate((node: HTMLInputElement) => node.blur());
    await page.evaluate(() => {
      if (!window.visualViewport) return;
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 600 });
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.evaluate(() => window.scrollTo(0, 420));
    await expect(anchor).toHaveAttribute('data-search-visible', 'false');
  });
});
