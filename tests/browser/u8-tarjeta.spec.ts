import { expect, test, type Locator, type Page } from '@playwright/test';

// U8: tarjeta y fila del modo lista. Créditos (compilado, varios principales de
// nombres largos, principal con colaboradores) y altura estable en /lab;
// columnas de la grilla, radar con cursor y con el dedo (toques reales a 390) y
// compartir en el inicio.

const rows = Array.from({ length: 12 }, (_, index) => ({
  id: `80808080-8080-4080-8080-${String(index + 1).padStart(12, '0')}`,
  slug: `tarjeta-u8-${index + 1}`,
  title: `Tarjeta U8 ${index + 1}`,
  release_date: `2026-0${(index % 9) + 1}-10`,
  type: 'EP',
  label: 'Sello U8',
  review: '',
  experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
  artists: [`Artista ${index + 1}`],
  primary_artists: [{ id: `u8-${index + 1}`, slug: `artista-u8-${index + 1}`, name: `Artista ${index + 1}`, position: 0 }],
  collaborators: [],
  credit_quality: 'verified',
  genres: ['Electro', 'House'],
  countries: ['Colombia'],
  buy_link: '',
  cover: ''
}));

async function mockCatalog(page: Page) {
  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace(/^eq\./, '');
    if (id) {
      await route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(rows.find((row) => row.id === id) ?? null) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
  });
}

async function openLab(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
  );
  await page.goto('/lab');
  await expect(page.locator('.lab__u8 .card')).toHaveCount(6);
}

const heights = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
const columns = (page: Page) =>
  page.locator('.resultados__grid > article').evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size);
const homeCard = (page: Page, n: number) =>
  page.locator('.card--grid').filter({ has: page.getByRole('link', { name: `Abrir Tarjeta U8 ${n}`, exact: true }) });
const radarOpacity = (card: Locator) => card.locator('.portada__radar').evaluate((el) => getComputedStyle(el).opacity);

// ---- Créditos y altura estable (/lab) -----------------------------------------

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`/lab a ${viewport.width}`, () => {
    test.use({ viewport });

    test('altura estable: las tarjetas de una fila miden lo mismo y solo el título cambia de una a dos líneas', async ({ page }) => {
      await openLab(page);
      // Hay título largo, datos largos, cinco géneros, compilado, sin portada y sin datos.
      const cards = await page.locator('.lab__u8 .card').evaluateAll((els) =>
        els.map((el) => ({ top: Math.round(el.getBoundingClientRect().top), height: el.getBoundingClientRect().height }))
      );
      const byRow = Map.groupBy(cards, (card) => card.top);
      for (const row of byRow.values()) expect(spread(row.map((card) => card.height))).toBeLessThan(0.5);
      // Entre filas, la diferencia no pasa de una línea de título.
      const line = await page.locator('.lab__u8 .card__titulo').first().evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      expect(spread(cards.map((card) => card.height))).toBeLessThan(line + 0.5);
      for (const part of ['.card__creditos', '.card .datos', '.card .generos']) {
        expect(spread(await heights(page.locator(`.lab__u8 ${part}`))), part).toBeLessThan(0.5);
      }
      const titleLines = await page.locator('.lab__u8 .card__titulo').evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
      );
      expect(Math.max(...titleLines)).toBeLessThanOrEqual(2);
      expect(spread(await heights(page.locator('.lab__u8 .fila')))).toBeLessThan(0.5);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('créditos: compilado, varios principales de nombres largos y principal con colaboradores', async ({ page }) => {
      await openLab(page);
      for (const scope of [page.locator('.lab__u8 .card'), page.locator('.lab__u8 .fila')]) {
        // Compilado: "Varios artistas" abre los créditos por rol.
        const compiled = scope.filter({ hasText: 'Compilado del laboratorio' });
        await compiled.getByRole('button', { name: 'Varios artistas' }).click();
        const menu = page.getByRole('menu', { name: 'Créditos del lanzamiento' });
        await expect(menu.getByText('Artistas principales')).toBeVisible();
        await expect(menu.getByRole('menuitem', { name: 'Ela Minus' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);

        // Varios principales: todos enlazados, la línea se trunca y no se parte.
        const many = scope.filter({ hasText: 'Cumbia siglo XXI' });
        for (const name of ['Sonido Gallo Negro y la Orquesta Imaginaria', 'Dengue Dengue Dengue', 'Nicola Cruz']) {
          await expect(many.getByRole('link', { name, exact: true })).toHaveCount(1);
        }
        // U10: la fila tiene ahora la composición móvil en todos los anchos; a 1440
        // los nombres pueden caber enteros. Lo que no cambia es que no parten línea.
        const names = many.locator('.ui-credit-line__names');
        expect(await names.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
        expect(await names.evaluate((el) => el.getBoundingClientRect().height < 1.8 * parseFloat(getComputedStyle(el).lineHeight))).toBe(true);
        await expect(many.getByRole('button', { name: /Varios artistas/ })).toHaveCount(0);

        // Principal con colaboradores: el nombre cede, "y 4 más" se ve entero.
        const collab = scope.filter({ hasText: 'Principal con colaboradores' });
        const more = collab.getByText('y 4 más', { exact: true });
        await expect(more).toBeVisible();
        expect(await more.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await expect(collab.getByRole('link', { name: 'Ana Tijoux' })).toHaveCount(0);
      }
    });

    test('el título largo se recorta a dos líneas y se lee completo en la ayuda', async ({ page }) => {
      await openLab(page);
      const title = page.locator('.lab__u8 .card__titulo').filter({ hasText: 'Cumbia siglo XXI' });
      expect(await title.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      await expect(title.getByRole('link')).toHaveAttribute('title', /título largo que no cabe en dos líneas de la tarjeta$/);
    });

    // U10 (decisión del equipo): la fila usa la composición móvil en todos los anchos, sin géneros.
    test('la fila no muestra géneros en ningún ancho', async ({ page }) => {
      await openLab(page);
      const genres = page.locator('.lab__u8 .fila').first().getByRole('link', { name: 'Electrónica' });
      await expect(genres).toHaveCount(0);
    });
  });
}

test('/lab: la tarjeta y la fila abren con un clic en cualquier parte de su información', async ({ page }) => {
  await openLab(page);
  const status = page.getByTestId('lab-abierto');
  const info = page.locator('.lab__u8 .card').first().locator('.card__info');
  await info.scrollIntoViewIfNeeded();
  const box = (await info.boundingBox())!;
  await page.mouse.click(box.x + box.width - 6, box.y + box.height - 6);
  await expect(status).toHaveText('Abriría la ficha de «Pájaros de fuego».');

  const row = page.locator('.lab__u8 .fila').nth(2);
  await row.scrollIntoViewIfNeeded();
  const rowBox = (await row.boundingBox())!;
  await page.mouse.click(rowBox.x + 20, rowBox.y + rowBox.height / 2); // sobre la miniatura
  await expect(status).toHaveText('Abriría la ficha de «Principal con colaboradores».');
});

// ---- Grilla: nunca más de 3 columnas --------------------------------------------

test('la grilla del inicio no pasa de 3 columnas en ningún ancho', async ({ page }) => {
  await mockCatalog(page);
  for (const [width, expected] of [[1920, 3], [1440, 3], [1024, 2], [834, 2], [680, 2], [390, 1]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.resultados__grid > article')).toHaveCount(12);
    expect(await columns(page), `${width}px`).toBe(expected);
  }
});

// ---- Radar con cursor --------------------------------------------------------------

test.describe('radar con cursor (1440)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('aparece al pasar por la portada y un clic abre la ficha', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    const card = homeCard(page, 1);
    await expect.poll(() => radarOpacity(card)).toBe('0');
    await card.locator('.portada').hover();
    await expect.poll(() => radarOpacity(card)).toBe('1');
    await card.locator('.portada').click();
    await expect(page.getByRole('dialog', { name: 'Tarjeta U8 1' })).toBeVisible();
  });

  test('con teclado se abre desde el título; la portada no es una parada de tabulación', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    const card = homeCard(page, 1);
    await expect(card.locator('.portada__enlace')).toHaveAttribute('tabindex', '-1');
    await expect(card.getByRole('link', { name: 'Abrir Tarjeta U8 1' })).toHaveCount(1);
    await card.getByRole('link', { name: 'Abrir Tarjeta U8 1' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Tarjeta U8 1' })).toBeVisible();
  });

  test('compartir copia el enlace público y lo confirma', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockCatalog(page);
    await page.goto('/');
    const card = homeCard(page, 2);
    await card.getByRole('button', { name: 'Copiar enlace' }).click();
    await expect(card.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    await expect(card.getByRole('status')).toHaveText('Enlace copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://biblioteca.discotica.com/lanzamiento/tarjeta-u8-2');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// ---- Radar con el dedo (390, toques reales por CDP) ---------------------------------

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let step = 1; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / steps;
    const y = from.y + ((to.y - from.y) * step) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  await cdp.detach();
}

const center = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function tap(page: Page, locator: Locator) {
  const point = await center(locator);
  await page.touchscreen.tap(point.x, point.y);
}

test.describe('radar con el dedo (390)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await homeCard(page, 1).locator('.portada').scrollIntoViewIfNeeded();
  });

  test('el primer toque muestra el radar y el segundo abre la ficha', async ({ page }) => {
    const card = homeCard(page, 1);
    const cover = card.locator('.portada');
    await tap(page, cover);
    await expect(cover).toHaveAttribute('data-radar', 'visible');
    await expect.poll(() => radarOpacity(card)).toBe('1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(page.url()).not.toContain('modal=');

    await tap(page, cover);
    await expect(page.getByRole('dialog', { name: 'Tarjeta U8 1' })).toBeVisible();
    await expect(page).toHaveURL(/modal=tarjeta-u8-1/);
  });

  test('tocar otra portada mueve el radar; tocar fuera lo oculta', async ({ page }) => {
    const first = homeCard(page, 1).locator('.portada');
    const second = homeCard(page, 2).locator('.portada');
    await tap(page, first);
    await expect(first).toHaveAttribute('data-radar', 'visible');

    await second.scrollIntoViewIfNeeded();
    await tap(page, second);
    await expect(second).toHaveAttribute('data-radar', 'visible');
    await expect(first).not.toHaveAttribute('data-radar', 'visible');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Un toque fuera de las portadas lo oculta y no abre nada.
    // U10: en móvil el contador está al pie, junto a la paginación inferior.
    const outside = page.locator('.resultados__total-pie');
    await outside.scrollIntoViewIfNeeded();
    await tap(page, outside);
    await expect(second).not.toHaveAttribute('data-radar', 'visible');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('deslizar sobre la portada desplaza la página sin mostrar el radar ni abrir', async ({ page }) => {
    const cover = homeCard(page, 1).locator('.portada');
    const start = await center(cover);
    const before = await page.evaluate(() => scrollY);
    await swipe(page, start, { x: start.x, y: start.y - 260 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
    await expect(cover).not.toHaveAttribute('data-radar', 'visible');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('un toque en el título abre la ficha directamente', async ({ page }) => {
    await tap(page, homeCard(page, 1).getByRole('link', { name: 'Abrir Tarjeta U8 1' }));
    await expect(page.getByRole('dialog', { name: 'Tarjeta U8 1' })).toBeVisible();
  });

  test('géneros, sello y compartir siguen siendo objetivos táctiles de 44', async ({ page }) => {
    const card = homeCard(page, 1);
    for (const control of [card.getByRole('link', { name: 'Electro' }), card.getByRole('button', { name: 'Copiar enlace' })]) {
      const size = await control.evaluate((el) => {
        const after = getComputedStyle(el, '::after');
        const box = el.getBoundingClientRect();
        const top = parseFloat(after.top), bottom = parseFloat(after.bottom), left = parseFloat(after.left), right = parseFloat(after.right);
        return { w: box.width - left - right, h: box.height - top - bottom };
      });
      expect(size.w).toBeGreaterThanOrEqual(44);
      expect(size.h).toBeGreaterThanOrEqual(44);
    }
  });
});
