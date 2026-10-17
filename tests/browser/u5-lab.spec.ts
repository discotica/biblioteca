import { expect, test, type Page } from '@playwright/test';

// U5: primitivas base en /lab, a 390 y 1440, con teclado, foco visible y
// objetivos táctiles de 44px.

const VIEWPORTS = [
  { name: '1440', viewport: { width: 1440, height: 900 } },
  { name: '390', viewport: { width: 390, height: 844 } }
] as const;

async function openLab(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
  );
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Primitivas', level: 1 })).toBeVisible();
}

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`U5 /lab a ${name}`, () => {
    test.use({ viewport });

    test('no ensancha la página y no aparece en la navegación', async ({ page }) => {
      await openLab(page);
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
      await expect(page.locator('header a[href="/lab"], footer a[href="/lab"]')).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });

    test('cada control interactivo ofrece un objetivo táctil de 44px', async ({ page }) => {
      await openLab(page);
      const misses = await page.evaluate(() => {
        const half = 21; // 44px centrados: el punto a 21px del centro sigue dentro
        // Excepción "en línea" de WCAG 2.5.8: los nombres enlazados de los créditos
        // (U6), los enlaces dentro de un párrafo de lectura (U7) y el país y el sello
        // de la línea "año · país · sello" (U8) y el enlace dentro del texto de una
        // casilla (U12, "política de privacidad") son texto dentro de una línea; su
        // alto lo fija la línea de texto. El título de la tarjeta y de la fila (U8)
        // se estira sobre toda la información o la fila: su objetivo es ese bloque,
        // no la caja del texto (lo prueba u8-tarjeta.spec.ts).
        const controls = Array.from(document.querySelectorAll<HTMLElement>('.lab :is(button, a[href], a[aria-disabled], input, select, textarea):not(.ui-credit-line__names a, .ui-credits a, .l-reading__body :is(p, li) a, .ui-checkbox__text a, .datos a, .card__titulo-enlace, .fila__titulo-enlace)'));
        const failed: string[] = [];
        for (const control of controls) {
          // Contenido de un <details> cerrado (índice de lectura en móvil): no se pinta.
          if (!control.checkVisibility()) continue;
          control.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          const rect = control.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const points = [[cx, cy - half], [cx, cy + half], [cx - half, cy], [cx + half, cy]];
          for (const [x, y] of points) {
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === control || control.contains(hit))) {
              failed.push(`${control.tagName.toLowerCase()} "${(control.getAttribute('aria-label') || control.textContent || '').trim().slice(0, 30)}" ${Math.round(rect.width)}×${Math.round(rect.height)} en (${Math.round(x - cx)},${Math.round(y - cy)})`);
              break;
            }
          }
        }
        return { total: controls.length, failed };
      });
      expect(misses.total).toBeGreaterThan(80);
      expect(misses.failed).toEqual([]);
    });
  });
}

test.describe('U5 /lab con teclado', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('el foco es visible y el icono solo muestra su ayuda; Escape la oculta', async ({ page }) => {
    await openLab(page);
    const report = page.getByRole('button', { name: 'Reportar un problema' }).first();
    await report.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(report).toBeFocused();
    const outline = await report.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    const tip = report.locator('xpath=following-sibling::span[contains(@class,"ui-icon-btn__tip")]');
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText('Reportar un problema');
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await expect(report).toBeFocused();
  });

  test('chip de filtro, paginación y alternancia responden a teclado', async ({ page }) => {
    await openLab(page);
    const chip = page.getByRole('button', { name: 'Quitar filtro: Techno' });
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(chip).toHaveCount(0);

    const compact = page.getByRole('navigation', { name: 'Paginación de resultados' });
    await expect(compact).toContainText('1 de 233');
    await compact.getByRole('button', { name: 'Página siguiente' }).focus();
    await page.keyboard.press('Space');
    await expect(compact).toContainText('2 de 233');

    const full = page.getByRole('navigation', { name: 'Paginación completa' });
    await expect(full.locator('[aria-current="page"]')).toHaveText('5');
    await full.getByRole('button', { name: 'Página 6' }).click();
    await expect(full.locator('[aria-current="page"]')).toHaveText('6');

    const toggle = page.getByRole('button', { name: /^Alternar/ });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('PasswordField muestra reglas y fortaleza en vivo y alterna la visibilidad', async ({ page }) => {
    await openLab(page);
    const input = page.getByLabel('Contraseña', { exact: true });
    await input.fill('abc');
    await expect(page.getByText('Fortaleza: Débil')).toBeVisible();
    await expect(page.getByText('Contraseña nueva todavía no válida.')).toBeVisible();
    await input.fill('Discotica2026!');
    await expect(page.getByText('Fortaleza: Fuerte')).toBeVisible();
    await expect(page.getByText('Contraseña nueva válida.')).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('ViewToggle recuerda la vista por contexto', async ({ page }) => {
    await openLab(page);
    const group = page.getByRole('group', { name: 'Vista', exact: true });
    await group.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByText('Vista actual: lista')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('discotica:vista:lab'))).toBe('list');
    await page.reload();
    await expect(page.getByRole('group', { name: 'Vista', exact: true }).getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Vista actual: lista')).toBeVisible();
  });

  test('ViewToggle funciona con el almacenamiento bloqueado', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openLab(page);
    const group = page.getByRole('group', { name: 'Vista', exact: true });
    await group.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByText('Vista actual: lista')).toBeVisible();
    expect(errors.filter((message) => /bloqueado|localStorage/.test(message))).toEqual([]);
  });
});
