import { expect, test, type Page, type Route } from '@playwright/test';

// U7 — Shell y layouts: header por rol y ancho, menú de cuenta con teclado,
// acceso al Estudio desde el perfil propio, layouts de lectura y cuenta, y
// declaración de contenedor en cada ruta. Supabase está simulado: no hay red.

const project = 'hgocyrzhgohetfpzbmfs';
type Role = 'anonimo' | 'comunidad' | 'colaborador' | 'admin';
const ids: Record<Exclude<Role, 'anonimo'>, string> = {
  comunidad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  colaborador: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockSupabase(page: Page, role: Role) {
  const user =
    role === 'anonimo'
      ? null
      : {
          id: ids[role], aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`,
          app_metadata: {}, user_metadata: { username: role }, created_at: '2026-09-18T00:00:00Z'
        };
  if (user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const session = {
      access_token: `${header}.${payload}.signature`, refresh_token: 'u7-fixture-refresh-token', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
    };
    await page.context().addCookies([{
      name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
      domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
    }]);
  }
  await page.route(`https://${project}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/auth/v1/')) return user ? json(route, user) : json(route, {}, 401);
    if (url.pathname === '/rest/v1/profiles') {
      if (url.searchParams.get('select') === 'role') return json(route, { role: role === 'anonimo' ? 'comunidad' : role });
      const username = url.searchParams.get('username')?.replace(/^eq\./, '') ?? role;
      const id = (ids as Record<string, string>)[username] ?? 'otro-id';
      return json(route, { id, username, display_name: `Persona ${username}`, bio: null, created_at: '2026-01-01T00:00:00Z' });
    }
    if (url.pathname === '/rest/v1/crates' || url.pathname === '/rest/v1/contributions') return json(route, []);
    return json(route, []);
  });
}

async function noHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test.describe('U7 header', () => {
  for (const width of [360, 390, 1440]) {
    test(`anónimo a ${width}: mayúsculas, botones más anchos que altos, Entrar lleno y Sugerir con borde del mismo tamaño`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await mockSupabase(page, 'anonimo');
      await page.goto('/manual');
      const header = page.locator('header.site-header');
      const sugerir = header.getByRole('link', { name: 'Sugerir' }).locator('visible=true');
      const entrar = header.getByRole('link', { name: 'Entrar' }).locator('visible=true');
      await expect(sugerir).toHaveCount(1);
      await expect(entrar).toHaveCount(1);

      const [s, e] = [await sugerir.boundingBox(), await entrar.boundingBox()];
      if (!s || !e) throw new Error('Sin caja');
      expect(s.height).toBe(e.height);
      expect(s.width).toBeGreaterThan(s.height);
      expect(e.width).toBeGreaterThan(e.height);
      for (const link of [sugerir, entrar]) await expect(link).toHaveCSS('text-transform', 'uppercase');
      // Entrar es el lleno; Sugerir lleva borde y fondo transparente.
      await expect(entrar).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(sugerir).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(sugerir).toHaveCSS('border-top-width', '1px');

      if (width < 769) {
        const menu = header.getByRole('button', { name: 'Abrir menú' });
        await expect(menu).toHaveCSS('width', '44px');
        await expect(menu.locator('svg path')).toHaveCount(3);
        const m = await menu.boundingBox();
        expect(m!.x + m!.width).toBeLessThanOrEqual(width);
      } else {
        const menu = header.getByRole('button', { name: 'Menú' });
        await expect(menu).toHaveCSS('text-transform', 'uppercase');
        await expect(menu.locator('svg')).toHaveCount(1);
      }
      await noHorizontalOverflow(page);
    });
  }

  test('menú de cuenta con teclado: APG completo, Salir con icono y cierre de sesión', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSupabase(page, 'comunidad');
    await page.goto('/manual');
    const trigger = page.getByRole('button', { name: 'Cuenta @comunidad' });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Cuenta @comunidad' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('group', { name: '@comunidad' })).toBeVisible();
    const item = (name: string) => menu.getByRole('menuitem', { name });
    await expect(item('Perfil')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item('Mis colecciones')).toBeFocused();
    await page.keyboard.press('End');
    await expect(item('Salir')).toBeFocused();
    await expect(item('Salir').locator('svg')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(item('Perfil')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(item('Salir')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(item('Perfil')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // ↑ abre en el último; Tab cierra y devuelve el foco al disparador.
    await page.keyboard.press('ArrowUp');
    await expect(item('Salir')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Con el menú abierto el header no se oculta al hacer scroll (congelación E14).
    await page.keyboard.press('Enter');
    await expect(item('Perfil')).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('header.site-header')).toHaveAttribute('data-header-visible', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('header.site-header').getByRole('link', { name: 'Entrar' }).locator('visible=true')).toHaveCount(1);
  });

  test('móvil con sesión: sin Entrar, la cuenta vive dentro del menú con Salir e icono', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, 'comunidad');
    await page.goto('/manual');
    const header = page.locator('header.site-header');
    await expect(header.getByRole('link', { name: 'Entrar' }).locator('visible=true')).toHaveCount(0);
    await expect(header.getByRole('button', { name: /^Cuenta/ }).locator('visible=true')).toHaveCount(0);
    await header.getByRole('button', { name: 'Abrir menú' }).click();
    const nav = page.getByRole('navigation', { name: 'Menú' });
    const account = nav.getByRole('group', { name: 'Cuenta' });
    await expect(account.getByText('@comunidad')).toBeVisible();
    await expect(account.getByRole('link', { name: 'Perfil' })).toBeFocused();
    await expect(account.getByRole('link', { name: 'Mis colecciones' })).toHaveAttribute('href', '/mis-colecciones');
    await expect(account.getByRole('button', { name: 'Salir' }).locator('svg')).toHaveCount(1);
    await expect(header.getByRole('button', { name: 'Cerrar menú' })).toBeVisible();
    await noHorizontalOverflow(page);
  });
});

test.describe('U7 roles: header y acceso al Estudio desde el perfil propio', () => {
  const studio: Record<Role, Array<[string, string]>> = {
    anonimo: [],
    comunidad: [],
    // U15: una entrada por sección del Estudio que ve el rol.
    colaborador: [['Propuestas', '/estudio/propuestas']],
    admin: [['Catálogo', '/estudio/catalogo'], ['Propuestas', '/estudio/propuestas'], ['Reportes', '/estudio/reportes']]
  };
  for (const role of ['anonimo', 'comunidad', 'colaborador', 'admin'] as Role[]) {
    for (const width of [390, 1440]) {
      test(`${role} a ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await mockSupabase(page, role);
        const username = role === 'anonimo' ? 'comunidad' : role;
        await page.goto(`/perfil/${username}`);
        await expect(page.getByRole('heading', { level: 1, name: `Persona ${username}` })).toBeVisible();

        const header = page.locator('header.site-header');
        // El header no lleva acceso a herramientas para ningún rol.
        await expect(header.getByRole('link', { name: /Estudio|Catálogo|Editorial/ })).toHaveCount(0);
        const entrar = header.getByRole('link', { name: 'Entrar' }).locator('visible=true');
        await expect(entrar).toHaveCount(role === 'anonimo' ? 1 : 0);
        if (width > 768) {
          await expect(header.getByRole('button', { name: /^Cuenta/ })).toHaveCount(role === 'anonimo' ? 0 : 1);
        }

        const section = page.getByRole('region', { name: 'Estudio' });
        if (!studio[role].length) {
          await expect(section).toHaveCount(0);
        } else {
          await expect(section).toBeVisible();
          const links = section.getByRole('link');
          await expect(links).toHaveCount(studio[role].length);
          for (const [index, [label, href]] of studio[role].entries()) {
            await expect(links.nth(index)).toHaveText(label);
            await expect(links.nth(index)).toHaveAttribute('href', href);
          }
        }
        // Mis aportes (U14): página propia, enlazada desde el perfil propio.
        await expect(page.locator('.l-page a[href="/mis-aportes"]')).toHaveCount(role === 'anonimo' ? 0 : 1);
        await noHorizontalOverflow(page);
      });
    }
  }
});

test.describe('U7 layouts', () => {
  test('cada ruta declara un contenedor del sistema', async ({ page }) => {
    await mockSupabase(page, 'anonimo');
    const routes: Array<[string, string]> = [
      ['/manual', 'l-container--wide'],
      ['/privacidad', 'l-container--narrow'],
      ['/auth/login', 'l-container--regular'], // U12: dos columnas (beneficios y formulario)
      ['/auth/confirmar', 'l-container--narrow'],
      ['/auth/registro', 'l-container--narrow'],
      ['/auth/recuperar', 'l-container--narrow'],
      ['/auth/reset', 'l-container--narrow'],
      ['/reportar', 'l-container--regular'], // sin sesión redirige a Entrar (dos columnas desde U12)
      ['/sugerir', 'l-container--narrow'],
      ['/estudio/catalogo', 'l-container--narrow'], // U15: sin sesión, el Estudio pide entrar (con sesión, full)
      ['/perfil/comunidad', 'l-container--regular'],
      ['/ruta-que-no-existe', 'l-container--narrow']
    ];
    for (const [path, size] of routes) {
      await page.goto(path);
      const first = page.locator('main > :first-child');
      await expect(first, path).toHaveClass(new RegExp(`\\bl-container\\b.*\\b${size}\\b`));
    }
  });

  test('con sesión, Mis colecciones usa el contenedor regular y migas hacia el perfil', async ({ page }) => {
    await mockSupabase(page, 'comunidad');
    await page.goto('/mis-colecciones');
    await expect(page.locator('main > :first-child')).toHaveClass(/\bl-container--regular\b/);
    const crumbs = page.getByRole('navigation', { name: 'Migas de pan' });
    await expect(crumbs.getByRole('link', { name: '@comunidad' })).toHaveAttribute('href', '/perfil/comunidad');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Mis colecciones');
  });

  test('404: ErrorState como página, con h1 y una acción', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');
    await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('El enlace puede estar mal escrito');
    await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/');
  });

  test('lectura a 1440: índice lateral fijo con la sección actual marcada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/manual');
    const toc = page.getByRole('navigation', { name: 'Contenido' }).locator('visible=true');
    await expect(toc).toHaveCount(1);
    await expect(toc.getByRole('link')).toHaveCount(10);
    await expect(toc).toHaveCSS('position', 'sticky');
    await toc.getByRole('link', { name: 'Orden' }).click();
    await expect(page).toHaveURL(/#orden$/);
    await expect(toc.getByRole('link', { name: 'Orden' })).toHaveAttribute('aria-current', 'location');
    await expect(toc.locator('[aria-current]')).toHaveCount(1);
    // Tipografía de lectura: 16 px y medida de línea limitada.
    const body = page.locator('.l-reading__body');
    await expect(body).toHaveCSS('font-size', '16px');
    expect((await body.boundingBox())!.width).toBeLessThanOrEqual(720);
    await noHorizontalOverflow(page);
  });

  test('lectura a 390: el índice es un desplegable "Contenido" que se cierra al elegir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/manual');
    const details = page.locator('details.l-reading__toc-mobile');
    await expect(details).toBeVisible();
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await details.getByRole('link', { name: 'Radar' }).click();
    await expect(page).toHaveURL(/#radar$/);
    await expect(details).not.toHaveAttribute('open', '');
    // Sin botón flotante "Secciones".
    await expect(page.getByRole('button', { name: /Secciones|índice/i })).toHaveCount(0);
    await noHorizontalOverflow(page);
  });

  test('privacidad usa el layout de lectura con mejor tipografía', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
    const paragraph = page.locator('.l-reading__body p').first();
    await expect(paragraph).toHaveCSS('font-size', '16px');
    await expect(page.locator('.l-reading__body h2').first()).toHaveCSS('font-size', '24px');
  });

  test('cuenta: título, formulario y pie comparten layout', async ({ page }) => {
    await mockSupabase(page, 'anonimo');
    for (const [path, title] of [['/auth/login', 'Entrar'], ['/auth/registro', 'Crear cuenta'], ['/auth/recuperar', 'Recuperar contraseña']]) {
      await page.goto(path);
      const layout = page.locator('.l-account');
      await expect(layout.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(layout.locator('form')).toHaveCount(1);
      await expect(layout.locator('.l-account__footer a').first()).toBeVisible();
    }
  });
});
