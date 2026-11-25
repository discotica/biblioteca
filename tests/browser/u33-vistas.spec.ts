import { expect, test } from '@playwright/test';

// U33 (tablero M): 404 y error en el panel de 480, y Manual y Privacidad como
// lectura (índice de 260 y columna de 720; h1 40/44, h2 22/28, cuerpo 18/28).
// Las pantallas con sesión (Editar perfil, Ajustes) están en u12-cuenta.spec.ts;
// Reportar y Sugerir, en u13 y u19.

const noOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const width of [1440, 390]) {
  test(`404 a ${width}: una sola pantalla en un panel de 480 sobre el campo de puntos`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/ruta-que-no-existe');
    const panel = page.getByRole('alert');
    await expect(panel.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible();
    await expect(panel).toContainText('El enlace puede estar mal escrito o la página ya no existe.');
    await expect(panel.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/');
    expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(480);
    await expect(page.locator('.acceso-fondo canvas').first()).toBeAttached();
    expect(await noOverflow(page)).toBe(true);
  });

  test(`error general a ${width}: comparte pantalla con el 404`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    // Sin sesión ni ?usuario=, una colección falla con 400: no es un 404.
    await page.goto('/coleccion/sin-usuario');
    const panel = page.getByRole('alert');
    await expect(panel.getByRole('heading', { level: 1, name: 'Algo salió mal' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/');
    expect(await noOverflow(page)).toBe(true);
  });
}

for (const route of ['/manual', '/privacidad']) {
  test(`lectura ${route} a 1440: sin campo de puntos, índice de 260 y columna de 720`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await expect(page.locator('.acceso-fondo')).toHaveCount(0);
    const toc = page.getByRole('navigation', { name: 'Contenido' }).locator('visible=true');
    await expect(toc).toHaveCount(1);
    expect((await toc.boundingBox())!.width).toBe(260);
    const body = page.locator('.l-reading__body');
    expect((await body.boundingBox())!.width).toBe(720);
    // El índice queda a la izquierda de la columna, a la altura del título.
    const tocBox = (await toc.boundingBox())!;
    const bodyBox = (await body.boundingBox())!;
    expect(tocBox.x + tocBox.width).toBeLessThan(bodyBox.x);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCSS('font-size', '40px');
    await expect(h1).toHaveCSS('line-height', '44px');
    const h2 = body.getByRole('heading', { level: 2 }).first();
    await expect(h2).toHaveCSS('font-size', '22px');
    await expect(h2).toHaveCSS('line-height', '28px');
    await expect(body).toHaveCSS('font-size', '18px');
    await expect(body).toHaveCSS('line-height', '28px');
    expect(await noOverflow(page)).toBe(true);
  });
}

test('Privacidad: el índice lleva a cada sección y marca la actual', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/privacidad');
  const toc = page.getByRole('navigation', { name: 'Contenido' }).locator('visible=true');
  await expect(toc.getByRole('link')).toHaveCount(8);
  await toc.getByRole('link', { name: 'Tus derechos' }).click();
  await expect(page).toHaveURL(/#derechos$/);
  await expect(toc.getByRole('link', { name: 'Tus derechos' })).toHaveAttribute('aria-current', 'location');
});

test('Privacidad a 390: el índice es el desplegable y no hay desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacidad');
  await expect(page.locator('details.l-reading__toc-mobile')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});
