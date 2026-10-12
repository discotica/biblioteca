import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

const countries = ['Colombia', 'Argentina', 'México', 'Chile', 'Perú', 'Brasil'];
const genres = ['Electro', 'Ambient', 'House', 'Techno', 'Reggaetón'];
const rows = Array.from({ length: 18 }, (_, index) => ({
  id: `15151515-1515-4151-8151-${String(index + 1).padStart(12, '0')}`,
  slug: `release-e15-${index + 1}`,
  title: `Release E15 ${index + 1}`,
  release_date: `2026-${String((index % 9) + 1).padStart(2, '0')}-15`,
  type: index % 2 ? 'EP' : 'Álbum',
  label: 'Sello E15',
  review: '',
  experimental: 2,
  denso: 3,
  sintetico: 1,
  bailable: 4,
  rapido: 2,
  artists: [`Artista E15 ${index + 1}`],
  primary_artists: [{ id: `artist-${index + 1}`, slug: `artista-${index + 1}`, name: `Artista E15 ${index + 1}`, position: 0 }],
  collaborators: [],
  credit_quality: 'verified',
  genres: [genres[index % genres.length]],
  countries: [countries[index % countries.length]],
  buy_link: '',
  cover: ''
}));

// U10b-2: la barra móvil es el campo de texto + «Filtros» (que abre la hoja) + la vista.
const filtersTrigger = (page: import('@playwright/test').Page) => page.locator('.mobile-search-row').getByRole('button', { name: /^Filtros/ });

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

test('E15: aplica el breakpoint semántico y nunca introduce scroll horizontal', async ({ page }) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const mobileSearch = filtersTrigger(page);
    const mobileInput = page.locator('.mobile-search-row').getByRole('combobox');
    await expect(page.getByText('No encontramos resultados exactos, pero aquí tienes los más cercanos.')).toHaveCount(0);
    if (viewport.width <= 768) {
      await expect(mobileSearch).toBeVisible();
      await expect(mobileInput).toBeVisible();
      await expect(page.locator('.home-search__row')).toBeHidden();
      await expect(mobileSearch).toHaveCSS('min-height', '44px');
      await expect(page.locator('.mobile-search-row .busqueda-input-row')).toHaveCSS('min-height', '44px');
    } else {
      await expect(mobileSearch).toBeHidden();
      await expect(mobileInput).toBeHidden();
      await expect(page.locator('.home-search__row')).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await filtersTrigger(page).click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await expect(sheet).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
});

test('E15: centra las tarjetas cuando la grilla solo admite una columna', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 844 });
  await page.goto('/');
  const grid = page.locator('.resultados__grid');
  const card = page.locator('.card--grid').first();
  await expect(card).toBeVisible();
  const alignment = await grid.evaluate((node, firstCard) => {
    const gridBox = node.getBoundingClientRect();
    const cardBox = firstCard.getBoundingClientRect();
    return {
      left: cardBox.left - gridBox.left,
      right: gridBox.right - cardBox.right
    };
  }, await card.elementHandle());
  expect(Math.abs(alignment.left - alignment.right)).toBeLessThanOrEqual(1);
});

// U10 (ronda 3, "Descubrimiento"): los filtros activos son una banda horizontal
// desplazable con todas las chips; sustituye la fila medida con "+N" de E15.
test('E15/U10: las pills forman una banda desplazable sin desbordar la página y el foco vuelve al disparador', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?pais=Colombia&pais=Argentina&pais=México&genero=Electro&genero=Ambient&type=Álbum&año=2026');

  const band = page.getByRole('list', { name: 'Filtros activos' });
  await expect(band).toBeVisible();
  await expect(band.locator('.chip-activo')).toHaveCount(7);
  await expect(band).toHaveCSS('overflow-x', 'auto');
  await expect.poll(() => band.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(band.getByRole('button', { name: /filtros más/ })).toHaveCount(0);

  const trigger = filtersTrigger(page);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.chip-activo')).toHaveCount(7);
  await expect(sheet.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('E15: la barra reaparece tras 24 px ascendentes sin traer el header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  await page.locator('.card--grid').first().waitFor();
  await page.locator('main').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    main.append(spacer);
  });
  const anchor = page.locator('.mobile-search-anchor');
  const header = page.locator('header.site-header');

  await page.evaluate(() => window.scrollTo(0, 320));
  await expect(anchor).toHaveAttribute('data-search-visible', 'false');
  await expect(header).toHaveAttribute('data-header-visible', 'false');

  await page.evaluate(() => window.scrollTo(0, 308));
  await expect(anchor).toHaveAttribute('data-search-visible', 'false');
  await page.evaluate(() => window.scrollTo(0, 295));
  await expect(anchor).toHaveAttribute('data-search-visible', 'true');
  await expect(header).toHaveAttribute('data-header-visible', 'false');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(anchor).toHaveAttribute('data-search-visible', 'true');
  await expect(header).toHaveAttribute('data-header-visible', 'true');
});

test('E15: una reducción de viewport sin foco no congela la barra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  await page.locator('.card--grid').first().waitFor();
  await page.locator('main').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    main.append(spacer);
  });
  await page.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 300 });
    window.visualViewport.dispatchEvent(new Event('resize'));
    window.scrollTo(0, 320);
  });
  const anchor = page.locator('.mobile-search-anchor');
  await expect(anchor).toHaveAttribute('data-search-visible', 'false');
  await page.evaluate(() => window.scrollTo(0, 292));
  await expect(anchor).toHaveAttribute('data-search-visible', 'true');
});

test('E15: Sheet conserva scroll y ancho, fija cabecera/pills y aplica cambios con Back/Forward', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?pais=Colombia');
  await page.evaluate(() => window.scrollTo(0, 260));
  await page.evaluate(() => window.scrollTo(0, 180));
  const before = await page.locator('.resultados').evaluate((node) => ({
    y: window.scrollY,
    width: node.getBoundingClientRect().width,
    left: node.getBoundingClientRect().left
  }));
  const trigger = filtersTrigger(page);
  await trigger.click();

  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  // U10: la hoja es la primitiva Sheet; cabecera fija y cuerpo desplazable.
  // U10b-2: sin pie y con el radar siempre desplegado.
  await expect(sheet.locator('.ui-sheet__header')).toHaveCSS('flex-shrink', '0');
  await expect(sheet.locator('.ui-sheet__body')).toHaveCSS('overflow-y', 'auto');
  await expect(sheet.locator('.ui-sheet__footer')).toHaveCount(0);
  await expect(sheet.getByRole('heading', { name: 'Radar' })).toBeAttached();
  await expect.poll(() => page.locator('.resultados').evaluate((node) => node.getBoundingClientRect().width)).toBe(before.width);
  await expect.poll(() => page.locator('.resultados').evaluate((node) => node.getBoundingClientRect().left)).toBe(before.left);

  const country = sheet.locator('.cloud-campo').filter({ hasText: 'País' });
  await country.locator('summary').click();
  await country.getByRole('button', { name: 'Argentina' }).click();
  await expect(page).toHaveURL(/pais=Colombia.*pais=Argentina/);
  await expect(sheet.getByRole('button', { name: 'Quitar país Argentina' })).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/pais=Argentina/);
  await expect(sheet.getByRole('button', { name: 'Quitar país Argentina' })).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/pais=Argentina/);

  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before.y);
});

test('E15: swipe respeta umbrales, cancela horizontal y nunca nace en el cuerpo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.card--grid').first().waitFor();
  await page.locator('main').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    main.append(spacer);
  });
  const trigger = filtersTrigger(page);
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  const header = page.locator('.ui-sheet__header');

  await trigger.click();
  await page.waitForTimeout(220);
  let box = await header.boundingBox();
  if (!box) throw new Error('No se pudo medir el header del Sheet');
  await page.mouse.move(box.x + 20, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 105, box.y + 36, { steps: 3 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();

  const body = sheet.locator('.ui-sheet__body');
  box = await body.boundingBox();
  if (!box) throw new Error('No se pudo medir el cuerpo del Sheet');
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 150, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();

  box = await header.boundingBox();
  if (!box) throw new Error('No se pudo volver a medir el header del Sheet');
  await page.mouse.move(box.x + 20, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 126, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('E15: el gesto táctil real cierra únicamente desde el encabezado', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP se usa solo para validar eventos táctiles nativos en Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = filtersTrigger(page);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  const header = page.locator('.ui-sheet__header');
  await page.waitForTimeout(220);
  const box = await header.boundingBox();
  if (!box) throw new Error('No se pudo medir el encabezado para el gesto táctil');

  const x = box.x + 18;
  const y = box.y + 14;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  // 30 px is below the distance threshold; this closes through the documented
  // fast-swipe branch (>=24 px and >=0.5 px/ms).
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 30, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('E15: visualViewport limita la hoja y aperturas repetidas no degradan el scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.card--grid').first().waitFor();
  await page.locator('main').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    main.append(spacer);
  });
  const trigger = filtersTrigger(page);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.evaluate(() => window.scrollTo(0, 140));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(140);
    const expectedScroll = await page.evaluate(() => window.scrollY);
    await trigger.evaluate((node: HTMLButtonElement) => node.click());
    const sheet = page.getByRole('dialog', { name: 'Filtros' });
    await expect(sheet).toBeVisible();
    if (cycle === 0) {
      await page.evaluate(() => {
        if (!window.visualViewport) return;
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 500 });
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      await expect.poll(() => sheet.locator('.ui-sheet__panel').evaluate((node) => node.getBoundingClientRect().height <= 500)).toBe(true);
    }
    await page.locator('.ui-sheet__backdrop').click({ position: { x: 8, y: 8 } });
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(expectedScroll);
  }
});
