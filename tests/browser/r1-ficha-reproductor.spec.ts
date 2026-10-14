import { expect, test, type Page } from '@playwright/test';

// R1 — Ficha y reproductor: errores. One test per point, at 1440 and 390.
// Providers are replaced by a cross-origin fixture with a track list: the
// parent never reads the iframe, so the observable sequence (pointer or touch
// into the frame, focus moving into it, window blur) is the same one the real
// Bandcamp, SoundCloud and Spotify embeds produce.

type Credit = { id: string; slug: string; name: string; position: number };

const credit = (n: number): Credit => ({ id: `r1-artist-${n}`, slug: `r1-artista-${n}`, name: `Artista R1 ${n}`, position: n });
const single = [credit(0)];
const compilation = Array.from({ length: 8 }, (_, index) => credit(index));

function row(index: number, slug: string, title: string, buyLink: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slug,
    title,
    release_date: `2026-08-${String(28 - index).padStart(2, '0')}`,
    type: 'Álbum',
    label: 'Sello R1',
    review: 'Reseña breve para la ficha.',
    experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
    artists: single.map(({ name }) => name),
    primary_artists: single,
    collaborators: [],
    credit_quality: 'verified',
    genres: ['Electro'],
    countries: ['Colombia'],
    buy_link: buyLink,
    cover: `https://example.test/${slug}.jpg`,
    ...overrides
  };
}

const providers = [
  { slug: 'r1-bandcamp', provider: 'bandcamp', height: 290, buyLink: 'https://artista.bandcamp.com/album/r1' },
  { slug: 'r1-soundcloud', provider: 'soundcloud', height: 300, buyLink: 'https://soundcloud.com/artista/sets/r1' },
  { slug: 'r1-spotify', provider: 'spotify', height: 352, buyLink: 'https://open.spotify.com/album/1234567890123456789012' }
] as const;

const rows = [
  row(0, 'r1-bandcamp', 'Ficha R1 Bandcamp', providers[0].buyLink),
  row(1, 'r1-compilado', 'Compilado R1', 'https://example.test/comprar', {
    type: 'Compilado',
    primary_artists: compilation,
    artists: compilation.map(({ name }) => name)
  }),
  row(2, 'r1-soundcloud', 'Ficha R1 SoundCloud', providers[1].buyLink),
  row(3, 'r1-spotify', 'Ficha R1 Spotify', providers[2].buyLink),
  ...Array.from({ length: 5 }, (_, index) => row(4 + index, `r1-relleno-${index}`, `Relleno R1 ${index}`, 'https://example.test/comprar'))
];

const playerFixture = `<!doctype html><title>fixture player</title>
<style>
  body { margin: 0; height: 100vh; font: 14px sans-serif; background: #111; color: #eee; }
  header { height: 120px; }
  ol { margin: 0; padding: 0; list-style: none; }
  button { display: block; width: 100%; height: 44px; border: 0; background: #1b1b1b; color: inherit; text-align: left; }
  button[aria-current="true"] { background: #2b3b1b; }
</style>
<header>Fixture player</header>
<ol>${Array.from({ length: 6 }, (_, index) => `<li><button type="button">Pista ${index + 1}</button></li>`).join('')}</ol>
<script>
  for (const button of document.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      for (const other of document.querySelectorAll('button')) other.removeAttribute('aria-current');
      button.setAttribute('aria-current', 'true');
      button.focus();
    });
  }
</script>`;

async function mockCatalog(page: Page) {
  await page.route('**/rest/v1/rpc/resolve_release_slug', async (route) => {
    const { p_slug: requested = '' } = route.request().postDataJSON() as { p_slug?: string };
    const release = rows.find((candidate) => candidate.slug === requested);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(release ? [{ release_id: release.id, canonical_slug: release.slug, match_kind: 'canonical', alias_kind: null }] : [])
    });
  });

  await page.route('**/rest/v1/catalog_releases**', async (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')?.replace(/^eq\./, '');
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

  await page.route('https://example.test/**', (route) => route.fulfill({ status: 404, body: '' }));
  for (const provider of ['https://bandcamp.com/**', 'https://w.soundcloud.com/**', 'https://open.spotify.com/**']) {
    await page.route(provider, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: playerFixture }));
  }
}

async function authenticateWithLateCrates(page: Page) {
  const project = 'hgocyrzhgohetfpzbmfs';
  const user = {
    id: 'r1-user', aud: 'authenticated', role: 'authenticated', email: 'r1@discoteca.test',
    app_metadata: {}, user_metadata: { username: 'r1' }, created_at: '2026-10-05T00:00:00Z'
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const session = {
    access_token: `${header}.${payload}.signature`, refresh_token: 'r1-refresh-token',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user
  };
  await page.context().addCookies([{
    name: `sb-${project}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax'
  }]);
  await page.route(`https://${project}.supabase.co/auth/v1/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  );
  // Crates arrive after the menu opened, as in production: the menu grows
  // after its first placement, which is when it used to get cut.
  await page.route('**/rest/v1/crates**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'r1-crate-a', name: 'Para abrir el set', owner_id: user.id, crate_items: [{ count: 3 }] },
        { id: 'r1-crate-b', name: 'Pendientes por escuchar con calma este fin de semana largo', owner_id: user.id, crate_items: [{ count: 12 }] },
        { id: 'r1-crate-c', name: 'Dembow raro', owner_id: user.id, crate_items: [{ count: 1 }] }
      ])
    });
  });
  await page.route('**/rest/v1/crate_items**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
}

/** The element that scrolls the player, resolved like ReleasePlayer does. */
async function scrollRegionTop(page: Page) {
  return page.locator('[data-release-player]').evaluate((player) => {
    let current = player.parentElement;
    while (current) {
      const style = getComputedStyle(current);
      if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current.scrollTop;
      current = current.parentElement;
    }
    return document.scrollingElement?.scrollTop ?? 0;
  });
}

/** Scrolls the real region so the player sits near the top with its tracks visible. */
async function placePlayerNearTop(page: Page) {
  return page.locator('[data-release-player]').evaluate((player) => {
    let region: HTMLElement | null = player.parentElement;
    while (region) {
      const style = getComputedStyle(region);
      if (/(auto|scroll)/.test(style.overflowY) && region.scrollHeight > region.clientHeight) break;
      region = region.parentElement;
    }
    const scroller = region ?? (document.scrollingElement as HTMLElement);
    const regionTop = region ? region.getBoundingClientRect().top : 0;
    scroller.scrollTop += player.getBoundingClientRect().top - regionTop - 140;
    return scroller.scrollTop;
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const touch = viewport.width < 680;

  test.describe(`R1 a ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });

    test.beforeEach(async ({ page }) => {
      await mockCatalog(page);
    });

    test(`R1.1: el marco conserva su alto por proveedor en modal y página (${viewport.width})`, async ({ page }) => {
      for (const { slug, provider, height } of providers) {
        for (const target of [`/?modal=${slug}`, `/lanzamiento/${slug}`]) {
          await page.goto(target);
          const player = page.locator(`[data-release-player="${provider}"]`);
          await expect(player).toHaveAttribute('data-player-loaded', 'true');
          expect(Math.round((await player.boundingBox())?.height ?? 0), `${target} player`).toBe(height);
          expect(Math.round((await player.locator('iframe').boundingBox())?.height ?? 0), `${target} iframe`).toBe(height);

          // Nothing is drawn over the player. U9: the actions are a bar at the
          // bottom of the ficha (outside the scroll region from 1024, sticky
          // below it); with the player in view, the bar starts below it.
          await placePlayerNearTop(page);
          const playerBottom = await player.evaluate((node) => node.getBoundingClientRect().bottom);
          const actionsTop = await page.getByLabel('Acciones del lanzamiento').evaluate((node) => node.getBoundingClientRect().top);
          expect(actionsTop, `${target} actions`).toBeGreaterThanOrEqual(playerBottom);
        }
      }

      if (!touch) {
        await page.goto(`/?modal=${providers[0].slug}`);
        const info = page.locator('.release-detail__info');
        await expect.poll(() => info.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      }
    });

    for (const { slug, provider } of providers) {
      for (const surface of ['modal', 'page'] as const) {
        test(`R1.2: elegir la tercera pista de ${provider} no mueve el scroll (${surface}, ${viewport.width})`, async ({ page }) => {
          await page.goto(surface === 'modal' ? `/?modal=${slug}` : `/lanzamiento/${slug}`);
          const player = page.locator(`[data-release-player="${provider}"]`);
          await expect(player).toHaveAttribute('data-player-loaded', 'true');

          const placed = await placePlayerNearTop(page);
          expect(placed).toBeGreaterThan(0);
          await page.waitForTimeout(300);
          const before = await scrollRegionTop(page);

          const track = page.frameLocator(`[data-release-player="${provider}"] iframe`).getByRole('button', { name: 'Pista 3' });
          const box = await track.boundingBox();
          expect(box).not.toBeNull();
          const x = box!.x + 40;
          const y = box!.y + box!.height / 2;
          if (touch) await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);

          await expect(track).toHaveAttribute('aria-current', 'true');
          await page.waitForTimeout(1000);
          expect(Math.abs((await scrollRegionTop(page)) - before)).toBeLessThanOrEqual(4);
        });
      }
    }

    test(`R1.3: el menú de "Añadir a colección" no se corta contra el borde del modal (${viewport.width})`, async ({ page }) => {
      await authenticateWithLateCrates(page);
      await page.goto(`/?modal=${providers[0].slug}`);
      const dialog = page.getByRole('dialog', { name: 'Ficha R1 Bandcamp' });
      const trigger = dialog.getByRole('button', { name: 'Añadir a colección' });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      const menu = dialog.getByRole('menu');
      await expect(menu.getByRole('menuitem', { name: /Pendientes por escuchar/ })).toBeVisible();
      await page.waitForTimeout(200);

      // Rendered in the detail's menu layer: inside the dialog (focus and
      // accessibility tree), outside every box that scrolls or clips.
      expect(await menu.evaluate((node) => Boolean(node.parentElement?.hasAttribute('data-release-menu-layer')))).toBe(true);
      expect(await menu.evaluate((node) => {
        for (let current = node.parentElement; current; current = current.parentElement) {
          if (current === document.body) return true;
          if (getComputedStyle(current).overflow !== 'visible') return false;
        }
        return true;
      })).toBe(true);

      const menuBox = (await menu.boundingBox())!;
      const dialogBox = (await dialog.boundingBox())!;
      expect(menuBox.x).toBeGreaterThanOrEqual(dialogBox.x);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 0.5);
      expect(menuBox.y).toBeGreaterThanOrEqual(0);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);

      // The longest name fits at 1440; at 390 it truncates with an ellipsis
      // inside the menu, never cut by an outer box.
      const longest = menu.getByRole('menuitem', { name: /Pendientes por escuchar/ }).locator('.opcion-nombre');
      if (!touch) expect(await longest.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      const nameBox = (await longest.boundingBox())!;
      expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(menuBox.x + menuBox.width);
      for (const item of await menu.getByRole('menuitem').all()) {
        const itemBox = (await item.boundingBox())!;
        const inside = await page.evaluate(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return Boolean(hit?.closest('[role="menu"]'));
        }, [itemBox.x + itemBox.width - 6, itemBox.y + itemBox.height / 2]);
        expect(inside).toBe(true);
      }
    });

    test(`R1.4: el menú "Varios artistas" de la tarjeta queda sobre la grilla (${viewport.width})`, async ({ page }) => {
      await page.goto('/');
      const card = page.locator('article.card').filter({ has: page.getByRole('link', { name: 'Compilado R1' }) }).first();
      const trigger = card.getByRole('button', { name: /Varios artistas/ });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      // U8: el menú va al portal de la página (U6), fuera de la tarjeta.
      const menu = page.getByRole('menu', { name: 'Créditos del lanzamiento' });
      await expect(menu).toBeVisible();
      const menuBox = (await menu.boundingBox())!;
      const cardBox = (await card.boundingBox())!;
      // The menu reaches past its own card, into a neighbouring grid row: the
      // next one, or the previous one when it flips up for lack of room below
      // (where the trigger lands depends on the sticky header's scroll-padding, U18).
      expect(menuBox.y + menuBox.height > cardBox.y + cardBox.height || menuBox.y < cardBox.y).toBe(true);

      for (const fraction of [0.15, 0.5, 0.85, 0.97]) {
        const point = [menuBox.x + menuBox.width / 2, menuBox.y + menuBox.height * fraction];
        const inside = await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('[role="menu"]')), point);
        expect(inside, `punto al ${Math.round(fraction * 100)}% del menú`).toBe(true);
      }
    });
  });
}
