import { expect, test, type Page } from '@playwright/test';

// U20: primitivas del rediseño del Estudio en /lab. Densidad compacta (36 y 12)
// solo dentro de [data-density="compact"]; StatusDot sin mayúsculas; SplitButton
// con teclado completo; SourceLink con el glifo y el nombre de su proveedor.

async function openLab(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Primitivas', level: 1 })).toBeVisible();
}

/** h: caja visible (sin el borde transparente del área táctil) · touch: caja completa · pl: padding lateral. */
const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // El borde del área táctil es el único de más de 1 px (los visibles miden 1).
    const clear = (side: 'Top' | 'Bottom') => {
      const width = parseFloat(style[`border${side}Width`]);
      return width > 1 ? width : 0;
    };
    return { h: Math.round(rect.height - clear('Top') - clear('Bottom')), touch: Math.round(rect.height), pl: style.paddingLeft };
  });

test('densidad: 44 y 16 en el sitio, 36 y 12 en el Estudio, con área táctil de 44', async ({ page }) => {
  await openLab(page);
  const site = '[data-testid="densidad-sitio"]';
  const studio = '[data-testid="densidad-estudio"]';
  expect(await box(page, `${site} .ui-btn--primary`)).toMatchObject({ h: 44, pl: '24px' });
  expect(await box(page, `${studio} .ui-btn--primary`)).toMatchObject({ h: 36, pl: '12px' });
  expect((await box(page, `${site} .ui-btn--square`)).h).toBe(44);
  expect((await box(page, `${studio} .ui-btn--square`)).h).toBe(36);
  expect(await box(page, `${site} .ui-field__input`)).toEqual({ h: 44, touch: 44, pl: '16px' });
  expect(await box(page, `${studio} .ui-field__input`)).toEqual({ h: 36, touch: 44, pl: '12px' });
  expect(await box(page, `${site} .ui-select__input`)).toEqual({ h: 44, touch: 44, pl: '12px' });
  expect(await box(page, `${studio} .ui-select__input`)).toEqual({ h: 36, touch: 44, pl: '12px' });
  expect((await box(page, `${site} .ui-combobox__control`)).h).toBe(44);
  expect((await box(page, `${studio} .ui-combobox__control`)).h).toBe(36);
  expect((await box(page, `${site} .ui-textarea__input`)).pl).toBe('16px');
  expect((await box(page, `${studio} .ui-textarea__input`)).pl).toBe('12px');
  // El campo compacto ocupa 36 en el flujo: el área táctil no separa más la etiqueta.
  const gap = await page.locator(`${studio} .ui-field`).first().evaluate((el) => {
    const label = el.querySelector('label')!.getBoundingClientRect();
    const control = el.querySelector('.ui-field__control')!.getBoundingClientRect();
    return { gap: Math.round(control.top - label.bottom), control: Math.round(control.height) };
  });
  expect(gap).toEqual({ gap: 8, control: 36 });
});

test('StatusDot: punto y palabra en caja normal; el borrador es un contorno', async ({ page }) => {
  await openLab(page);
  const section = page.locator('#estado');
  const draft = section.locator('.ui-status--draft').first();
  await expect(draft).toHaveText('Borrador');
  expect(await draft.evaluate((el) => getComputedStyle(el).textTransform)).toBe('none');
  const dot = await draft.locator('.ui-status__dot').evaluate((el) => {
    const style = getComputedStyle(el);
    return { bg: style.backgroundColor, border: style.borderTopStyle };
  });
  expect(dot).toEqual({ bg: 'rgba(0, 0, 0, 0)', border: 'solid' });
  // Solo el punto: la palabra queda para lectores de pantalla.
  await expect(section.getByText('Pendiente', { exact: true }).nth(1)).toHaveClass(/sr-only/);
});

test('SplitButton: acción principal y menú con teclado completo', async ({ page }) => {
  await openLab(page);
  const section = page.locator('#split');
  await section.getByRole('button', { name: 'Aceptar y publicar', exact: true }).first().click();
  await expect(section.getByText('Última acción: Aceptar y publicar')).toBeVisible();

  const arrow = section.getByRole('button', { name: 'Más formas de aceptar', exact: true });
  await expect(arrow).toHaveAttribute('aria-haspopup', 'menu');
  await arrow.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Más formas de aceptar' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Aceptar como borrador' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Aceptar y seguir con la siguiente' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(arrow).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menuitem', { name: 'Aceptar como borrador' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(section.getByText('Última acción: Aceptar: como borrador')).toBeVisible();

  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menu', { name: 'Más formas de aceptar' }).getByRole('menuitem', { name: 'Aceptar y seguir con la siguiente' })).toBeFocused();
  await page.keyboard.press('Escape');

  // Deshabilitado: las dos partes.
  await expect(section.getByRole('button', { name: 'Deshabilitado', exact: true })).toBeDisabled();
  await expect(section.getByRole('button', { name: 'Más formas (deshabilitado)' })).toBeDisabled();
});

test('SourceLink: glifo y nombre del proveedor, flecha para otro enlace', async ({ page }) => {
  await openLab(page);
  const links = page.locator('#fuente a');
  await expect(links).toHaveCount(5);
  const named = await links.evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('aria-label'), node.getAttribute('data-provider'), node.getAttribute('target')]));
  expect(named).toEqual([
    ['Abrir en Bandcamp', 'bandcamp', '_blank'],
    ['Abrir en SoundCloud', 'soundcloud', '_blank'],
    ['Abrir en Spotify', 'spotify', '_blank'],
    ['Abrir la fuente', 'otro', '_blank'],
    ['Abrir en Bandcamp', 'bandcamp', '_blank']
  ]);
});

test('EmptyState inline: padding lateral solo en el Estudio; icono decorativo', async ({ page }) => {
  await openLab(page);
  const states = page.locator('#vacio-icono .ui-state--inline');
  expect(await states.nth(0).evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('24px');
  expect(await states.nth(1).evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('0px');
  await expect(states.nth(0).locator('.ui-state__icon svg')).toHaveAttribute('aria-hidden', 'true');
});
