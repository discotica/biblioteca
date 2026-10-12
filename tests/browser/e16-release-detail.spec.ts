import { expect, test, type Page } from '@playwright/test';

type Credit = { id: string; slug: string; name: string; position: number };

const primary: Credit[] = [
  { id: 'artist-primary', slug: 'artista-principal', name: 'Artista Principal', position: 0 }
];
const collaborators: Credit[] = [
  { id: 'artist-guest-a', slug: 'invitada-a', name: 'Invitada A', position: 0 },
  { id: 'artist-guest-b', slug: 'invitado-b', name: 'Invitado B', position: 1 }
];
const multiplePrimary: Credit[] = [
  ...primary,
  { id: 'artist-primary-b', slug: 'artista-principal-b', name: 'Artista Principal B', position: 1 },
  { id: 'artist-primary-c', slug: 'artista-principal-c', name: 'Artista Principal C', position: 2 },
  { id: 'artist-primary-d', slug: 'artista-principal-d', name: 'Artista Principal D', position: 3 }
];

function row(id: string, slug: string, title: string, buyLink: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug,
    title,
    release_date: '2026-08-09',
    type: 'Álbum',
    label: 'Sello Compartido',
    review: 'Una nota editorial suficientemente extensa para comprobar el recorrido de la columna sin separar el contenido entre superficies.',
    experimental: 1,
    denso: 2,
    sintetico: 3,
    bailable: 4,
    rapido: 5,
    artists: primary.map(({ name }) => name),
    primary_artists: primary,
    collaborators,
    credit_quality: 'verified',
    genres: ['Electro', 'Ambient'],
    countries: ['Colombia'],
    buy_link: buyLink,
    cover: `https://example.test/${slug}.jpg`,
    ...overrides
  };
}

const longTitle = 'Título editorial\ncon salto explícito y una palabra extraordinariamentelargaextraordinariamentelargaextraordinariamentelarga';
const rows = [
  row('11111111-1111-4111-8111-111111111111', 'e16-bandcamp', 'Ficha compartida Bandcamp', 'https://artista.bandcamp.com/album/e16'),
  row('22222222-2222-4222-8222-222222222222', 'e16-soundcloud', 'Ficha compartida SoundCloud', 'https://soundcloud.com/artista/e16', {
    type: 'Compilado',
    primary_artists: multiplePrimary,
    artists: multiplePrimary.map(({ name }) => name)
  }),
  row('33333333-3333-4333-8333-333333333333', 'e16-spotify', 'Ficha compartida Spotify', 'https://open.spotify.com/album/1234567890123456789012'),
  row('44444444-4444-4444-8444-444444444444', 'e16-sin-player', longTitle, 'https://example.test/comprar', {
    review: Array.from({ length: 12 }, (_, index) => `Párrafo editorial ${index + 1} con contexto del lanzamiento.`).join('\n')
  })
];

async function mockCatalog(page: Page) {
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    const body = route.request().postDataJSON() as { p_slug?: string };
    const requested = body.p_slug ?? '';
    const canonical = requested === 'e16-bandcamp-legado' ? 'e16-bandcamp' : requested;
    const release = rows.find((candidate) => candidate.slug === canonical);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release ? [{
        release_id: release.id,
        canonical_slug: release.slug,
        match_kind: requested === canonical ? 'canonical' : 'alias',
        alias_kind: requested === canonical ? null : 'migration'
      }] : [])
    });
  });

  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    if (id) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(rows.find((candidate) => candidate.id === id) ?? null)
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
      body: JSON.stringify(rows)
    });
  });

  for (const provider of ['https://bandcamp.com/**', 'https://w.soundcloud.com/**', 'https://open.spotify.com/**']) {
    await page.route(provider, (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>fixture cross-origin</title>'
    }));
  }
}

async function authenticate(page: Page) {
  const project = 'hgocyrzhgohetfpzbmfs';
  const user = {
    id: 'e16-user', aud: 'authenticated', role: 'authenticated', email: 'e16@discoteca.test',
    app_metadata: {}, user_metadata: { username: 'e16' }, created_at: '2026-09-20T00:00:00Z'
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const session = {
    access_token: `${header}.${payload}.signature`, refresh_token: 'e16-refresh-token',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);
  await page.route(`https://${project}.supabase.co/auth/v1/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  );
}

async function detailContract(page: Page) {
  const detail = page.locator('[data-release-detail]');
  const credits = detail.locator('[data-release-credits]');
  return {
    title: await detail.locator('.release-detail__title').textContent(),
    date: await detail.locator('.release-detail__metadata').getByText(/agosto de 2026/i).textContent(),
    credits: (await credits.innerText()).replace(/\s+/g, ' ').trim(),
    artistHref: await credits.getByRole('link', { name: 'Artista Principal' }).getAttribute('href'),
    // U9: nombre accesible de cada acción (Comprar es enlace; Compartir y Reportar, IconButton).
    actions: await detail.locator('[data-release-actions]').locator('a, button').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label') ?? node.textContent?.replace(/\s+/g, ' ').trim())
    )
  };
}

test.beforeEach(async ({ page }) => {
  await mockCatalog(page);
});

test('E16: ruta y modal renderizan el mismo contrato editorial y el alias conserva URL canónica', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/lanzamiento/e16-bandcamp-legado');
  const pageContract = await detailContract(page);
  await expect(page.locator('[data-release-detail]')).toHaveAttribute('data-release-detail-mode', 'page');

  await page.goto('/?modal=e16-bandcamp-legado');
  const dialog = page.getByRole('dialog', { name: 'Ficha compartida Bandcamp' });
  await expect(dialog).toBeVisible();
  const modalContract = await detailContract(page);
  expect(modalContract).toEqual(pageContract);
  // Ronda 3 (U9): la ficha muestra a todos los artistas por rol, sin "y N más".
  expect(modalContract.credits).toMatch(/Artista principal\s*Artista Principal/i);
  expect(modalContract.credits).toMatch(/Colaboradores\s*Invitada A,\s*Invitado B/i);
  expect(modalContract.credits).not.toMatch(/y \d+ más/);
  expect(modalContract.artistHref).toBe('/artista/artista-principal');
  expect(modalContract.actions).toEqual([
    'Comprar, se abre en otra pestaña', 'Añadir a colección', 'Copiar enlace', 'Reportar un problema'
  ]);

  await dialog.getByRole('button', { name: 'Copiar enlace' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('https://biblioteca.discotica.com/lanzamiento/e16-bandcamp');
});

test('E16: la corrección compartida preserva título, peso, créditos y ancho en ambos modos', async ({ page }) => {
  for (const target of ['/lanzamiento/e16-sin-player', '/?modal=e16-sin-player']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(target);
    const detail = page.locator('[data-release-detail]');
    const title = detail.locator('.release-detail__title');
    await expect(title).toHaveText(longTitle);
    await expect(title).toHaveCSS('font-weight', '700');
    await expect(title).toHaveCSS('white-space', 'pre-wrap');
    const credits = detail.locator('[data-release-credits]');
    await expect(credits).toContainText('Artista Principal');
    // La separación tras la coma es margen, no texto (R2).
    await expect(credits).toContainText(/Invitada A,\s*Invitado B/);
    await expect(credits).not.toContainText(/y \d+ más/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const cover = await detail.locator('.release-detail__cover').boundingBox();
    const heading = await title.boundingBox();
    expect(cover && heading && cover.y + cover.height <= heading.y).toBe(true);
    await expect(detail.locator('.release-detail__cover-column')).not.toHaveCSS('position', 'sticky');
  }
});

test('E16/U9: el compilado muestra todos los créditos por rol, enlazados y sin menú', async ({ page }) => {
  for (const target of ['/lanzamiento/e16-soundcloud', '/?modal=e16-soundcloud']) {
    await page.goto(target);
    const credits = page.locator('[data-release-detail] [data-release-credits]');
    await expect(credits).toBeVisible();
    // Ronda 3: "Varios artistas" es solo de la tarjeta; la ficha lista a todos.
    await expect(credits.getByRole('button', { name: /Varios artistas/ })).toHaveCount(0);
    const primary = credits.locator('.ui-credits__group--primary');
    await expect(primary).toContainText('Artistas principales');
    await expect(primary.getByRole('link')).toHaveCount(multiplePrimary.length);
    for (const credit of multiplePrimary) {
      await expect(primary.getByRole('link', { name: credit.name, exact: true })).toHaveAttribute('href', `/artista/${credit.slug}`);
    }
    await expect(credits.locator('.ui-credits__group--collaborator').getByRole('link')).toHaveCount(collaborators.length);
    // Nombres en caja normal, como en la tarjeta (feedback de U8).
    await expect(primary.locator('a').first()).toHaveCSS('text-transform', 'none');
  }
});

test('E16: modal desktop fija portada y desplaza únicamente la columna editorial', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/?modal=e16-sin-player');
  const detail = page.locator('[data-release-detail]');
  const info = detail.locator('.release-detail__info');
  const cover = detail.locator('.release-detail__cover');
  await expect.poll(() => info.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await page.waitForTimeout(250);
  const coverY = (await cover.boundingBox())?.y;
  await info.evaluate((node) => { node.scrollTop = Math.min(240, node.scrollHeight - node.clientHeight); });
  await expect.poll(() => info.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => (await cover.boundingBox())?.y).toBe(coverY);
  await expect(detail.getByLabel('Acciones del lanzamiento')).toBeAttached();
});

for (const [slug, provider, height] of [
  ['e16-bandcamp', 'bandcamp', 290],
  ['e16-soundcloud', 'soundcloud', 300],
  ['e16-spotify', 'spotify', 352]
] as const) {
  for (const surface of ['page', 'modal'] as const) {
    test(`E16: ${provider} mantiene geometría y scroll estable al interactuar en ${surface}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto(surface === 'page' ? `/lanzamiento/${slug}` : `/?modal=${slug}`);
      const player = page.locator(`[data-release-player="${provider}"]`);
      const iframe = player.locator('iframe');
      await expect(player).toHaveAttribute('data-player-height', String(height));
      await expect(player).toHaveAttribute('data-player-loaded', 'true');
      expect(Math.round((await iframe.boundingBox())?.height ?? 0)).toBe(height);

      // U9: desde 1024 la página es la misma ficha que el modal; la región que
      // desplaza el reproductor es la columna de información en las dos.
      const scrollTarget = page.locator('.release-detail__info');
      const desired = await scrollTarget.evaluate((node) => {
        const maximum = node.scrollHeight - node.clientHeight;
        const next = Math.min(120, Math.max(0, maximum));
        node.scrollTop = next;
        return next;
      });
      await iframe.evaluate((node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      await scrollTarget.evaluate((node) => { node.scrollTop = 0; });
      await iframe.evaluate((node) => node.dispatchEvent(new Event('load')));
      await expect.poll(() => scrollTarget.evaluate((node) => node.scrollTop)).toBe(desired);

      // Reproduce el salto observable cuando un click dentro del iframe mueve
      // el contenedor antes de que el padre reciba blur/focus cross-origin.
      await player.dispatchEvent('pointerenter');
      await iframe.focus();
      await scrollTarget.evaluate((node) => { node.scrollTop = 0; });
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect.poll(() => scrollTarget.evaluate((node) => node.scrollTop)).toBe(desired);

      // Bandcamp puede desplazar el contenedor bastante después del primer
      // focus/blur y volver a hacerlo al elegir otra pista sin emitir blur.
      await page.waitForTimeout(240);
      await scrollTarget.evaluate((node) => { node.scrollTop = Math.max(0, node.scrollTop - 37); });
      await expect.poll(() => scrollTarget.evaluate((node) => node.scrollTop)).toBe(desired);

      // Al abandonar el reproductor la guarda se libera y no congela el
      // recorrido intencional de la ficha.
      await player.dispatchEvent('pointerleave');
      const allowed = Math.max(0, desired - 23);
      await scrollTarget.evaluate((node, top) => { node.scrollTop = top; }, allowed);
      await page.waitForTimeout(150);
      expect(await scrollTarget.evaluate((node) => node.scrollTop)).toBe(allowed);
    });
  }
}

test('E16: fallo de iframe conserva geometría y ofrece salida externa; sin provider no monta sesión', async ({ page }) => {
  await page.goto('/?modal=e16-bandcamp');
  const player = page.locator('[data-release-player="bandcamp"]');
  await player.locator('iframe').evaluate((node) => node.dispatchEvent(new Event('error')));
  await expect(player).toHaveAttribute('data-player-failed', 'true');
  await expect(player.getByRole('alert')).toContainText('No pudimos cargar el reproductor');
  await expect(player.getByRole('link', { name: 'Abrir en bandcamp' })).toHaveAttribute('href', 'https://artista.bandcamp.com/album/e16');
  expect(await player.locator('.release-player__frame').evaluate((node) => node.offsetHeight)).toBe(290);
  expect(await player.locator('iframe').evaluate((node) => node.offsetHeight)).toBe(290);

  await page.goto('/lanzamiento/e16-sin-player');
  await expect(page.locator('[data-release-player]')).toHaveCount(0);
});

test('E16: cada apertura crea una sesión y el desmontaje retira su listener', async ({ page }) => {
  await page.addInitScript(() => {
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    let blurBalance = 0;
    Object.defineProperty(window, '__e16BlurBalance', { get: () => blurBalance });
    window.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      if (type === 'blur') blurBalance += 1;
      return originalAdd.call(this, type, listener, options);
    } as typeof window.addEventListener;
    window.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
      if (type === 'blur') blurBalance -= 1;
      return originalRemove.call(this, type, listener, options);
    } as typeof window.removeEventListener;
  });

  await page.goto('/');
  const baseline = await page.evaluate(() => (window as Window & { __e16BlurBalance: number }).__e16BlurBalance);
  const trigger = page.getByRole('link', { name: 'Abrir Ficha compartida Bandcamp' }).first();
  await trigger.click();
  const firstSession = await page.locator('[data-player-session]').getAttribute('data-player-session');
  await expect.poll(() => page.evaluate(() => (window as Window & { __e16BlurBalance: number }).__e16BlurBalance)).toBe(baseline + 1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as Window & { __e16BlurBalance: number }).__e16BlurBalance)).toBe(baseline);

  await trigger.click();
  const secondSession = await page.locator('[data-player-session]').getAttribute('data-player-session');
  expect(secondSession).not.toBe(firstSession);
  await expect(page.locator('[data-release-player]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as Window & { __e16BlurBalance: number }).__e16BlurBalance)).toBe(baseline);
});

test('E16: el menú de colecciones vive fuera de la columna recortable y permanece dentro del diálogo', async ({ page }) => {
  await authenticate(page);
  await page.goto('/?modal=e16-bandcamp');
  await page.evaluate(async () => {
    const crates = await import('/src/lib/stores/cratesStore.ts');
    crates.crates.set([]);
    crates.cratesLoaded.set(true);
  });

  const dialog = page.getByRole('dialog', { name: 'Ficha compartida Bandcamp' });
  await dialog.getByRole('button', { name: 'Añadir a colección' }).click();
  const menu = dialog.getByRole('menu');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((node) => Boolean(node.parentElement?.hasAttribute('data-release-menu-layer')))).toBe(true);
  expect(await menu.evaluate((node) => Boolean(node.closest('.release-detail__info')))).toBe(false);
  const menuBox = await menu.boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(menuBox && dialogBox && menuBox.x >= dialogBox.x && menuBox.x + menuBox.width <= dialogBox.x + dialogBox.width).toBe(true);
});

test('E16: deep link modal sobrevive Back/Forward y cerrar restaura scroll y foco', async ({ page }) => {
  await page.goto('/manual');
  await page.goto('/?modal=e16-bandcamp');
  await expect(page.getByRole('dialog', { name: 'Ficha compartida Bandcamp' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/manual$/);
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'Ficha compartida Bandcamp' })).toBeVisible();

  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 180));
  const trigger = page.getByRole('link', { name: 'Abrir Ficha compartida Bandcamp' }).first();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Ficha compartida Bandcamp' })).toBeVisible();
  const saved = await page.locator('body').evaluate((body) => Math.abs(Number.parseInt(body.style.top, 10) || 0));
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(saved);
});
