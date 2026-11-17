import { expect, test } from '@playwright/test';

const betaEnabled = process.env.VITE_BETA_INVITATION_ENABLED === 'true';

async function stubLegacyCatalog(page: import('@playwright/test').Page) {
  await page.route(/docs\.google\.com\/spreadsheets/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/tab-separated-values',
      body: 'artist\ttitle\ttype\tcountry\tgenre\trelease_date\nPrueba\tPrueba\tEP\tColombia\tAmbient\t2026-01-01\n'
    });
  });
}

test('E19: el kill switch conserva una URL beta pero no monta ni interpreta la invitación', async ({ page }) => {
  test.skip(betaEnabled, 'Esta comprobación se ejecuta con el flag desactivado.');
  await stubLegacyCatalog(page);
  await page.goto('/?beta=1&nombre=Mar%C3%ADa&pais=Colombia');
  await expect(page.locator('[data-beta-invitation]')).toHaveCount(0);
  await expect(page).toHaveURL(/beta=1.*nombre=Mar%C3%ADa/);
  await expect(page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' })).toBeVisible();
});

// U29: la invitación deja de ser un diálogo y ocupa el hueco de la franja, como la
// bienvenida. La URL, el historial y el nombre como texto siguen siendo los de E19.
const invitation = (page: import('@playwright/test').Page) => page.locator('[data-beta-invitation]');
const searchField = (page: import('@playwright/test').Page) => page.getByRole('search').getByRole('combobox', { name: 'Buscar por país, género, artista, sello o álbum' });

test.describe('E19: invitación beta con flag activo', () => {
  test.skip(!betaEnabled, 'Estas comprobaciones requieren VITE_BETA_INVITATION_ENABLED=true.');

  test('acepta parámetros válidos, conserva filtros y limpia historial de forma idempotente', async ({ page }) => {
    await stubLegacyCatalog(page);
    await page.goto('/?beta&nombre=Mar%C3%ADa&pais=Colombia&genero=Ambient');

    const note = invitation(page);
    await expect(note).toBeVisible();
    // No modal: sin diálogo y con el catálogo a la vista.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(note.getByRole('heading', { level: 1, name: 'Hola, María.' })).toBeVisible();
    await expect(note).toContainText('Estás entrando a una versión en prueba de nuestra biblioteca. Explora el catálogo y cuéntanos si encuentras algo que podamos mejorar.');
    await expect(note.getByRole('link', { name: 'Escribir a hola@discotica.com' })).toHaveAttribute('href', 'mailto:hola@discotica.com');
    await expect(searchField(page)).toBeVisible();

    await note.getByRole('button', { name: 'Cerrar invitación beta' }).click();
    await expect(note).toHaveCount(0);
    await expect(page).toHaveURL(/\?pais=Colombia&genero=Ambient&orden=match$/);
    // U10b: el foco va al campo de texto, que no abre el panel por foco.
    await expect(searchField(page)).toBeFocused();
    await expect(page.locator('#panel-busqueda')).toHaveCount(0);

    // A normal in-app link is a pushed history entry, but must not carry the
    // invitation parameters. Back/Forward preserves that clean state too.
    await page.locator('.card a[href^="/?"]').first().click();
    await expect(page).not.toHaveURL(/(?:beta|nombre)=/);
    await expect(invitation(page)).toHaveCount(0);
    await page.goBack();
    await expect(invitation(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\?pais=Colombia&genero=Ambient&orden=match$/);
    await page.goForward();
    await expect(page).not.toHaveURL(/(?:beta|nombre)=/);
    await expect(invitation(page)).toHaveCount(0);

    // An explicitly opened beta URL remains a valid invitation link.
    await page.goto('/?beta=1&nombre=%E6%9D%8E%E9%9B%B7&pais=Colombia');
    await expect(invitation(page).getByRole('heading', { level: 1, name: 'Hola, 李雷.' })).toBeVisible();
    await invitation(page).getByRole('button', { name: 'Cerrar invitación beta' }).click();
    await expect(invitation(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\?pais=Colombia&orden=match$/);
  });

  test('rechaza beta malformada y renderiza XSS como texto, nunca markup', async ({ page }) => {
    await stubLegacyCatalog(page);
    await page.goto('/?beta=true&nombre=Ana');
    await expect(invitation(page)).toHaveCount(0);

    const attack = '<img onerror=alert(1)>';
    await page.goto(`/?beta=1&nombre=${encodeURIComponent(attack)}`);
    const note = invitation(page);
    await expect(note).toContainText(attack);
    await expect(note.locator('img')).toHaveCount(0);
    await expect(await page.evaluate(() => document.querySelector('[data-beta-invitation] img'))).toBeNull();
  });

  test('sin nombre usa el título genérico y, sin sesión, el enlace lleva a entrar para reportar', async ({ page }) => {
    await stubLegacyCatalog(page);
    await page.goto('/?beta=1');
    const note = invitation(page);
    await expect(note.getByRole('heading', { level: 1, name: 'Bienvenida a la beta de Discótica' })).toBeVisible();
    await expect(note.getByRole('link', { name: 'Iniciar sesión para reportar un problema' })).toHaveAttribute('href', '/auth/login?redirect=%2Freportar');
  });

  test.describe('responsive', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test('mantiene la nota utilizable en móvil, sin desbordar, y cerrarla conserva filtros', async ({ page }) => {
      await stubLegacyCatalog(page);
      await page.goto('/?beta=1&nombre=%F0%9F%98%80&pais=Colombia');
      const note = invitation(page);
      await expect(note.getByRole('heading', { level: 1, name: 'Hola, 😀.' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await note.getByRole('button', { name: 'Cerrar invitación beta' }).click();
      await expect(note).toHaveCount(0);
      await expect(page).toHaveURL(/\?pais=Colombia&orden=match$/);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
});
