import { expect, test, type Page } from '@playwright/test';

// Cabecero recuperable (2026-11-17). El cabecero se oculta al bajar, pero nunca
// puede quedarse oculto sin una forma de volver: al navegar, cuando el documento
// pierde el desplazamiento, al asomar el puntero por el borde superior y con el
// foco de teclado. En escritorio, redimensionar la ventana (o el zoom de
// trackpad) ya no se confunde con el teclado virtual.

const scrollTo = (page: Page, y: number) => page.evaluate((target) => new Promise<void>((resolve) => {
  window.addEventListener('scroll', () => resolve(), { once: true });
  window.scrollTo(0, target);
}), y);

const header = (page: Page) => page.locator('header.site-header');
const headerOffset = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--header-offset').trim());

async function hideOnManual(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/manual');
  await page.locator('nav.l-reading__toc').waitFor();
  await scrollTo(page, 1200);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'false');
}

test('el puntero en el borde superior lo asoma sin mover lo sticky, y al salir se va', async ({ page }) => {
  await hideOnManual(page);
  await page.mouse.move(700, 400);

  await page.mouse.move(700, 4);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');
  await expect(header(page)).toHaveAttribute('data-header-peek', 'true');
  expect(await headerOffset(page)).toBe('0px');

  // Sobre la barra se queda.
  await page.mouse.move(700, 40);
  await page.waitForTimeout(500);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');

  // Fuera de la barra se va tras la pausa.
  await page.mouse.move(700, 400);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'false');
});

test('pasar por encima del contenido alto no lo asoma: solo el borde', async ({ page }) => {
  await hideOnManual(page);
  await page.mouse.move(700, 60);
  await page.waitForTimeout(100);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'false');
});

test('navegar a otra página lo muestra aunque viniera oculto', async ({ page }) => {
  await hideOnManual(page);
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/privacidad';
    link.textContent = 'ir';
    document.querySelector('main')?.append(link);
    link.click();
  });
  await page.waitForURL('**/privacidad');
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');
});

test('si el documento deja de tener desplazamiento, vuelve', async ({ page }) => {
  await hideOnManual(page);
  await page.evaluate(() => {
    document.querySelectorAll('main > *').forEach((node) => ((node as HTMLElement).style.display = 'none'));
    document.querySelector('footer')?.setAttribute('style', 'display:none');
  });
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');
});

test('el foco de teclado en la barra la trae', async ({ page }) => {
  await hideOnManual(page);
  await page.locator('header.site-header a.logo').focus();
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');
});

test('en escritorio, cambiar el alto de la ventana no congela la detección', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/manual');
  await page.locator('nav.l-reading__toc').waitFor();
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.waitForTimeout(100);
  await scrollTo(page, 1200);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'false');
  await scrollTo(page, 900);
  await expect(header(page)).toHaveAttribute('data-header-visible', 'true');
});
