import { expect, test, type Locator, type Page } from '@playwright/test';

// U6: primitivas compuestas en /lab. Teclado completo en combobox, menú y
// ordenable; menús que no se cortan (tabla con overflow y diálogo); diálogo y
// hoja; arrastre con ratón y táctil (390); portada, créditos y redes.

async function openLab(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
  );
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Primitivas', level: 1 })).toBeVisible();
}

const comboRoot = (page: Page, name: string, scope = page.locator('#combobox')) =>
  scope.locator('.ui-combobox').filter({ has: page.getByRole('combobox', { name }) });

/** Espera a que terminen las animaciones de entrada (hoja, diálogo, menú). */
const settled = (locator: Locator) =>
  locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)));

const activeOptionText = (input: Locator) =>
  input.evaluate((el) => document.getElementById(el.getAttribute('aria-activedescendant') ?? '')?.textContent?.trim() ?? '');

/**
 * Dentro del viewport, y el centro y el punto medio de cada borde son suyos:
 * nada lo tapa ni lo recorta. (Puntos medios y no esquinas: las esquinas
 * redondeadas no son del elemento.)
 */
async function fullyVisible(locator: Locator) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const inset = 2;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const points = [
      [cx, rect.top + inset],
      [cx, rect.bottom - inset],
      [rect.left + inset, cy],
      [rect.right - inset, cy],
      [cx, cy]
    ];
    const inViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= document.documentElement.clientWidth;
    return inViewport && points.every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
  });
}

const order = (scope: Locator) =>
  scope.locator('.ui-sortable__list > li').evaluateAll((items) =>
    items.map((item) => item.querySelector('[data-sortable-handle]')?.getAttribute('data-sortable-handle'))
  );
const labList = (page: Page) => page.locator('#sortable .ui-sortable').first();

// ---------------------------------------------------------------------------

test.describe('U6 combobox con teclado', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('busca, elige con Intro, recorre con flechas y cierra con Escape', async ({ page }) => {
    await openLab(page);
    const input = page.locator('#combobox').getByRole('combobox', { name: 'Géneros', exact: true });
    const root = comboRoot(page, 'Géneros');
    await input.focus();
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.type('progressive');
    const list = page.getByRole('listbox', { name: 'Géneros' });
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(list.getByRole('option')).toHaveText([/Progresivo/]);
    expect(await activeOptionText(input)).toContain('Progresivo');

    await page.keyboard.press('Enter');
    await expect(root.getByRole('button', { name: 'Quitar Progresivo' })).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(root.locator('[aria-live]')).toHaveText(/Progresivo añadido\. 3 elegidos\./);
    await expect(list.getByRole('option', { name: 'Progresivo' })).toHaveAttribute('aria-selected', 'true');

    // Flechas: la opción activa cambia (aria-activedescendant), el foco sigue en el campo.
    await page.keyboard.type('h');
    const first = await activeOptionText(input);
    await page.keyboard.press('ArrowDown');
    const second = await activeOptionText(input);
    expect(second).not.toBe(first);
    await page.keyboard.press('ArrowUp');
    expect(await activeOptionText(input)).toBe(first);
    await expect(input).toBeFocused();

    // Intro sobre una elegida la quita (alternar).
    await page.keyboard.press('Backspace');
    await page.keyboard.type('techno');
    await page.keyboard.press('Enter');
    await expect(root.getByRole('button', { name: 'Quitar Techno' })).toHaveCount(0);

    // Escape: primero cierra la lista, después borra el texto.
    await page.keyboard.type('dub');
    await page.keyboard.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await expect(input).toHaveValue('dub');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
    await expect(page.locator('#combobox').getByText('Géneros: house, progresivo')).toBeVisible();
  });

  test('los chips se recorren y se quitan con teclado', async ({ page }) => {
    await openLab(page);
    const input = page.locator('#combobox').getByRole('combobox', { name: 'Artistas', exact: true });
    const root = comboRoot(page, 'Artistas');
    await input.focus();
    // Con el campo vacío, Retroceso lleva al último chip sin borrarlo.
    await page.keyboard.press('Backspace');
    await expect(root.getByRole('button', { name: 'Quitar Nicola Cruz' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(root.getByRole('button', { name: 'Quitar Ela Minus' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(input).toBeFocused();

    // Supr quita el chip enfocado y pasa al siguiente; Retroceso, al anterior.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(root.getByRole('button', { name: 'Quitar Ela Minus' })).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(root.getByRole('button', { name: 'Quitar Ela Minus' })).toHaveCount(0);
    await expect(root.getByRole('button', { name: 'Quitar Nicola Cruz' })).toBeFocused();
    await expect(root.locator('[aria-live]')).toHaveText('Ela Minus quitado. 1 elegido.');
    await page.keyboard.press('Enter');
    await expect(root.getByRole('button', { name: /^Quitar/ })).toHaveCount(0);
    await expect(input).toBeFocused();

    // Los chips no son paradas de tabulación: Tab sale del campo.
    await expect(root.locator('[data-combobox-chip]')).toHaveCount(0);
  });

  test('crea un valor nuevo solo cuando el contexto lo permite', async ({ page }) => {
    await openLab(page);
    const genres = page.locator('#combobox').getByRole('combobox', { name: 'Géneros', exact: true });
    await genres.focus();
    await page.keyboard.type('Neoperreo');
    await expect(page.getByRole('listbox', { name: 'Géneros' }).getByRole('option')).toHaveCount(0);
    await expect(page.getByText('Sin coincidencias')).toBeVisible();
    await page.keyboard.press('Escape');

    const artists = page.locator('#combobox').getByRole('combobox', { name: 'Artistas', exact: true });
    await artists.focus();
    await page.keyboard.type('ela minus');
    await expect(page.getByRole('option', { name: /Añadir/ })).toHaveCount(0);
    await page.keyboard.press('Backspace');
    await artists.fill('');
    await page.keyboard.type('Ana Tijoux');
    const create = page.getByRole('option', { name: 'Añadir «Ana Tijoux»' });
    await expect(create).toBeVisible();
    expect(await activeOptionText(artists)).toBe('Añadir «Ana Tijoux»');
    await page.keyboard.press('Enter');
    await expect(comboRoot(page, 'Artistas').getByRole('button', { name: 'Quitar Ana Tijoux' })).toBeVisible();
    // La opción creada pasa a la lista.
    await page.keyboard.type('tijoux');
    await expect(page.getByRole('option', { name: /Ana Tijoux/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('en un diálogo, Escape cierra la lista antes que el diálogo y la lista no se corta', async ({ page }) => {
    await openLab(page);
    const opener = page.getByRole('button', { name: 'Abrir diálogo con scroll' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Editar colección' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('combobox', { name: 'Géneros' });
    await input.focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: 'Géneros' });
    await expect(list).toBeVisible();
    // La lista vive en la capa del diálogo, fuera del cuerpo con scroll.
    expect(await list.evaluate((el) => el.closest('[data-ui-layer]') !== null && el.closest('[role="dialog"]') !== null && !el.closest('.ui-dialog__body'))).toBe(true);
    expect(await fullyVisible(page.locator('.ui-combobox__popup'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

// ---------------------------------------------------------------------------

test.describe('U6 menú "…"', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('teclado completo: abrir, recorrer, buscar por letra, cerrar y devolver el foco', async ({ page }) => {
    await openLab(page);
    const trigger = page.getByRole('button', { name: 'Acciones de «Para el domingo»' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Acciones de «Para el domingo»' });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('menuitem', { name: 'Compartir' })).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Editar nombre' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Eliminar' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Compartir' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Eliminar' })).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('v');
    await expect(menu.getByRole('menuitem', { name: 'Ver en el catálogo' })).toBeFocused();
    // El deshabilitado se recorre (se lee) pero no se activa.
    await page.keyboard.press('ArrowDown');
    const disabled = menu.getByRole('menuitem', { name: 'Duplicar (no disponible)' });
    await expect(disabled).toBeFocused();
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // ↑ abre en el último elemento; Tab cierra y devuelve el foco.
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Eliminar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Intro sobre una acción: cierra, ejecuta y el foco vuelve al "…".
    await page.keyboard.press('Space');
    await expect(menu.getByRole('menuitem', { name: 'Compartir' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Última acción: Editar Para el domingo')).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('una acción que abre un diálogo devuelve el foco al "…" al cerrarlo', async ({ page }) => {
    await openLab(page);
    const trigger = page.getByRole('button', { name: 'Acciones de «Para el domingo»' });
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    const confirm = page.getByRole('dialog', { name: '¿Eliminar «Para el domingo»?' });
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirm).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('no se corta en una tabla con overflow ni junto al borde del viewport', async ({ page }) => {
    await openLab(page);
    const trigger = page.getByRole('button', { name: 'Acciones de «Llegó la cumbia»' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Acciones de «Llegó la cumbia»' });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((el) => !el.closest('[data-testid="lab-table"]') && el.parentElement?.getAttribute('data-ui-layer') === 'page')).toBe(true);
    expect(await fullyVisible(menu)).toBe(true);
    for (const item of await menu.getByRole('menuitem').all()) expect(await fullyVisible(item)).toBe(true);
    // Fuera del menú, un clic lo cierra sin activar nada.
    await page.mouse.click(10, 10);
    await expect(menu).toHaveCount(0);
  });

  test('dentro de un diálogo: en su capa, entero, y el primer Escape solo cierra el menú', async ({ page }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'Abrir diálogo con scroll' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar colección' });
    const trigger = dialog.getByRole('button', { name: 'Acciones dentro del diálogo' });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Acciones dentro del diálogo' });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((el) => el.parentElement?.matches('[role="dialog"] > [data-ui-layer]'))).toBe(true);
    for (const item of await menu.getByRole('menuitem').all()) expect(await fullyVisible(item)).toBe(true);
    await expect(menu.getByRole('menuitem', { name: 'Compartir' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

// ---------------------------------------------------------------------------

test.describe('U6 diálogo y hoja', () => {
  test('diálogo: el cuerpo hace scroll dentro y cabecera y pie quedan visibles', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLab(page);
    await page.getByRole('button', { name: 'Abrir diálogo con scroll' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar colección' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-describedby', /.+/);
    const body = page.locator('.ui-dialog__body');
    const metrics = await body.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, tabindex: el.getAttribute('tabindex') }));
    expect(metrics.scroll).toBeGreaterThan(metrics.client);
    expect(metrics.tabindex).toBe('0');
    const scrollY = await page.evaluate(() => window.scrollY);
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await fullyVisible(dialog.getByRole('button', { name: 'Guardar' }))).toBe(true);
    expect(await fullyVisible(dialog.getByRole('button', { name: 'Cerrar' }))).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    // Foco atrapado: Tab desde el último vuelve al primero.
    await dialog.getByRole('button', { name: 'Guardar' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  });

  test('hoja a 390: altura según contenido, pie fijo visible y área segura', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);
    await page.getByRole('button', { name: 'Abrir hoja corta' }).click();
    const short = page.getByRole('dialog', { name: 'Compartir colección' });
    await expect(short).toBeVisible();
    await settled(short);
    const shortHeight = await page.locator('.ui-sheet__panel').evaluate((el) => el.getBoundingClientRect().height);
    expect(shortHeight).toBeLessThan(844 * 0.5);
    expect(await fullyVisible(short.getByRole('button', { name: 'Copiar enlace' }))).toBe(true);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Abrir hoja con pie fijo' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtros' });
    await expect(sheet).toBeVisible();
    await settled(sheet);
    const panel = await page.locator('.ui-sheet__panel').evaluate((el) => el.getBoundingClientRect());
    expect(panel.height).toBeLessThanOrEqual(844 * 0.88 + 1);
    expect(panel.bottom).toBeCloseTo(844, 0);
    const primary = sheet.getByRole('button', { name: 'Ver 124 lanzamientos' });
    expect(await fullyVisible(primary)).toBe(true);
    const body = page.locator('.ui-sheet__body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await fullyVisible(primary)).toBe(true);
    await primary.click();
    await expect(sheet).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('U6 ordenable', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('teclado: flechas, Inicio y Fin desde el asa, con anuncio y foco conservado', async ({ page }) => {
    await openLab(page);
    const live = page.locator('#sortable .ui-sortable').first().locator('[aria-live]');
    const handle = page.getByRole('button', { name: 'Reordenar: Pájaros de fuego' }).first();
    await expect(handle).toHaveAttribute('aria-describedby', /.+/);
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    expect((await order(labList(page))).slice(0, 3)).toEqual(['r2', 'r1', 'r3']);
    await expect(live).toHaveText('«Pájaros de fuego» movido a la posición 2 de 6.');
    await expect(handle).toBeFocused();
    await page.keyboard.press('End');
    expect((await order(labList(page))).at(-1)).toBe('r1');
    await expect(live).toHaveText('«Pájaros de fuego» movido a la posición 6 de 6.');
    await page.keyboard.press('ArrowDown');
    await expect(live).toHaveText('«Pájaros de fuego» ya está en la última posición.');
    await page.keyboard.press('Home');
    expect((await order(labList(page)))[0]).toBe('r1');
    await expect(handle).toBeFocused();
    await expect(page.getByText(/Último cambio: 6 → 1/)).toBeVisible();
  });

  test('botones Subir y Bajar mueven y conservan el foco', async ({ page }) => {
    await openLab(page);
    const down = page.getByRole('button', { name: 'Bajar: Miss Colombia' });
    await down.focus();
    await page.keyboard.press('Enter');
    expect((await order(labList(page))).slice(0, 3)).toEqual(['r1', 'r3', 'r2']);
    await expect(down).toBeFocused();
    await expect(page.getByRole('button', { name: 'Subir: Pájaros de fuego' })).toBeDisabled();
  });

  test('ratón: arrastrar desde el asa reordena; Escape cancela', async ({ page }) => {
    await openLab(page);
    const scope = labList(page);
    const handle = page.getByRole('button', { name: 'Reordenar: Pájaros de fuego' }).first();
    await handle.scrollIntoViewIfNeeded();
    const from = (await handle.boundingBox())!;
    const target = (await page.getByRole('button', { name: 'Reordenar: ¡Ay!' }).first().boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + ((target.y - from.y + 20) * step) / 10);
    }
    await expect(page.locator('.ui-sortable__item--dragging')).toHaveCount(1);
    await page.mouse.up();
    expect((await order(scope)).slice(0, 3)).toEqual(['r2', 'r3', 'r1']);
    await expect(page.locator('#sortable .ui-sortable').first().locator('[aria-live]')).toHaveText('«Pájaros de fuego» movido a la posición 3 de 6.');

    // Cancelar con Escape a mitad de arrastre deja el orden como estaba.
    const again = page.getByRole('button', { name: 'Reordenar: Miss Colombia' }).first();
    const box = (await again.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await order(scope)).slice(0, 3)).toEqual(['r2', 'r3', 'r1']);
  });
});

// ---------------------------------------------------------------------------
// Táctil a 390: CDP genera toques reales (con touch-action y gestos del
// navegador), no eventos sintéticos de puntero.

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 14) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let step = 1; step <= steps; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / steps;
    const y = from.y + ((to.y - from.y) * step) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  await cdp.detach();
}

const center = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe('U6 táctil a 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('arrastrar el asa reordena; deslizar la fila desplaza la página', async ({ page }) => {
    await openLab(page);
    const scope = labList(page);
    const handle = page.getByRole('button', { name: 'Reordenar: Pájaros de fuego' }).first();
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const from = await center(handle);
    const to = await center(page.getByRole('button', { name: 'Reordenar: ¡Ay!' }).first());
    await touchDrag(page, from, { x: from.x, y: to.y + 20 });
    expect((await order(scope)).slice(0, 3)).toEqual(['r2', 'r3', 'r1']);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    // Deslizar sobre el contenido de la fila es scroll normal, no arrastre.
    const row = page.locator('#sortable .ui-sortable__content').first();
    const start = await center(row);
    await touchDrag(page, start, { x: start.x, y: start.y - 250 });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore + 100);
    expect((await order(scope)).slice(0, 3)).toEqual(['r2', 'r3', 'r1']);
  });

  test('dentro de la hoja: arrastrar no cierra la hoja ni la desplaza; el gesto de la cabecera sí la cierra', async ({ page }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'Abrir hoja con pie fijo' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtros' });
    await expect(sheet).toBeVisible();
    await settled(sheet);
    const handle = sheet.getByRole('button', { name: 'Reordenar: Pájaros de fuego' });
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const body = page.locator('.ui-sheet__body');
    const bodyScroll = await body.evaluate((el) => el.scrollTop);
    const from = await center(handle);
    const to = await center(sheet.getByRole('button', { name: 'Reordenar: Miss Colombia' }));
    await touchDrag(page, from, { x: from.x, y: to.y + 20 });
    await expect(sheet).toBeVisible();
    expect(await order(page.locator('.ui-sheet'))).toEqual(['r2', 'r1', 'r3', 'r4']);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(bodyScroll);
    expect(await page.locator('.ui-sheet__panel').evaluate((el) => getComputedStyle(el).transform)).toBe('none');

    // El gesto de cierre sigue funcionando desde la cabecera.
    const title = await center(sheet.getByRole('heading', { name: 'Filtros' }));
    await touchDrag(page, title, { x: title.x, y: title.y + 220 }, 10);
    await expect(sheet).toHaveCount(0);
  });

  test('menú y combobox con el dedo', async ({ page }) => {
    await openLab(page);
    const trigger = page.getByRole('button', { name: 'Acciones de «Para el domingo»' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    expect(await fullyVisible(menu)).toBe(true);
    await menu.getByRole('menuitem', { name: 'Compartir' }).tap();
    await expect(page.getByText('Última acción: Compartir Para el domingo')).toBeVisible();

    const input = page.locator('#combobox').getByRole('combobox', { name: 'Países' });
    await input.scrollIntoViewIfNeeded();
    await input.tap();
    const list = page.getByRole('listbox', { name: 'Países' });
    await expect(list).toBeVisible();
    await list.getByRole('option', { name: 'Chile' }).tap();
    await expect(comboRoot(page, 'Países').getByRole('button', { name: 'Quitar Chile' })).toBeVisible();
    await expect(list).toBeVisible();
    // Tocar fuera (en el margen de la página, a la altura del campo) cierra la lista.
    await page.touchscreen.tap(2, (await center(input)).y);
    await expect(list).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('U6 portada, créditos y redes', () => {
  for (const width of [390, 1440]) {
    test(`a ${width}: portadas cuadradas con respaldo, créditos truncados sin perder "y N más"`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openLab(page);
      const covers = page.locator('#cover .ui-cover');
      await expect(covers).toHaveCount(6);
      for (const box of await covers.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => [r.width, r.height]))) {
        expect(Math.abs(box[0] - box[1])).toBeLessThanOrEqual(1);
      }
      // Sin portada y rota: logo atenuado con nombre accesible.
      await expect(page.getByRole('img', { name: 'Sin portada' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Portada rota' })).toBeVisible();
      expect(await page.locator('#cover .ui-cover__image').first().evaluate((img) => getComputedStyle(img).objectFit)).toBe('cover');

      const collab = page.locator('#creditos .lab__credit-card').filter({ hasText: 'Principal y colaboradores' });
      const names = collab.locator('.ui-credit-line__names');
      const more = collab.locator('.ui-credit-line__more');
      await collab.scrollIntoViewIfNeeded();
      expect(await names.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await expect(more).toHaveText('y 4 más');
      expect(await more.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await fullyVisible(more)).toBe(true);
      await expect(more).toHaveAttribute('title', 'Ana Tijoux, Bomba Estéreo, Sin enlace, Quantic');

      // "Varios artistas" solo en el Compilado, con todos los créditos por rol.
      await expect(page.locator('#creditos').getByRole('button', { name: 'Varios artistas' })).toHaveCount(1);
      await page.locator('#creditos').getByRole('button', { name: 'Varios artistas' }).click();
      const menu = page.getByRole('menu', { name: 'Créditos del lanzamiento' });
      await expect(menu.getByRole('group', { name: 'Artistas principales' }).getByRole('menuitem')).toHaveCount(4);
      await expect(menu.getByRole('group', { name: 'Colaborador' }).getByRole('menuitem')).toHaveText(['Matanza']);
      await expect(menu.getByRole('menuitem', { name: 'Ela Minus' })).toHaveAttribute('href', '/artista/ela-minus');
    });
  }

  test('ficha: todos los artistas por rol y redes con las cinco marcas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLab(page);
    const roles = page.locator('#creditos .ui-credits').first();
    await expect(roles.locator('dt')).toHaveText(['Artista principal', 'Colaboradores']);
    await expect(roles.locator('dd').nth(1).locator('a')).toHaveCount(3);
    await expect(roles.locator('dd').nth(1)).toContainText('Sin enlace');

    const social = page.getByRole('list', { name: 'Redes del perfil de ejemplo' });
    const links = social.getByRole('link');
    await expect(links).toHaveCount(5);
    expect(await links.evaluateAll((els) => els.map((el) => [el.getAttribute('aria-label'), el.getAttribute('href')]))).toEqual([
      ['Bandcamp: discotica', 'https://discotica.bandcamp.com'],
      ['SoundCloud: discotica', 'https://soundcloud.com/discotica'],
      ['Instagram: discotica.co', 'https://www.instagram.com/discotica.co/'],
      ['X (Twitter): discotica', 'https://x.com/discotica'],
      ['Facebook: discotica.co', 'https://www.facebook.com/discotica.co']
    ]);
    const newTab = page.getByRole('list', { name: 'Redes (sm)' }).getByRole('link').first();
    await expect(newTab).toHaveAttribute('target', '_blank');
    await expect(newTab).toHaveAttribute('aria-label', /se abre en otra pestaña/);
  });
});
