import { expect, test, type Page } from '@playwright/test';

// U9 — Ficha: modal, página y móvil. Matriz 390 · 680 · 834 · 1112 · 1440, en
// modal y en página, con portada y sin ella, título muy largo, reseña larga y
// los tres proveedores. Geometría (decisiones.md, "Ficha (2026-10-07, durante U9)"):
//
// - desde 768: arriba, la portada en una columna cuadrada con un marco igual en
//   los cuatro lados, y la información con scroll interno; al pie, la barra de
//   acciones a todo el ancho;
// - por debajo: una columna, portada enmarcada a todo el ancho y barra fija abajo.
//
// Con U9_CAPTURAS=1 guarda además una captura por caso en
// docs/modernizacion/capturas-u9/ (evidencia del relevo).

type Credit = { id: string; slug: string; name: string; position: number };
const credit = (n: number, prefix = 'u9-artista'): Credit => ({ id: `${prefix}-${n}`, slug: `${prefix}-${n}`, name: `Artista U9 ${n}`, position: n });

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#3a5f7a"/><g stroke="#cde" stroke-width=".4" fill="none">${Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="100"/><line y1="${(i + 1) * 10}" x1="0" y2="${(i + 1) * 10}" x2="100"/>`).join('')}</g></svg>`;

const playerFixture = `<!doctype html><title>fixture player</title>
<style>body{margin:0;height:100vh;font:14px sans-serif;background:#111;color:#eee}header{height:120px}
button{display:block;width:100%;height:44px;border:0;background:#1b1b1b;color:inherit;text-align:left}</style>
<header>Fixture player</header><ol style="margin:0;padding:0;list-style:none">${Array.from({ length: 6 }, (_, i) => `<li><button type="button">Pista ${i + 1}</button></li>`).join('')}</ol>`;

const longTitle = 'Un título editorial muy largo que ocupa varias líneas en la ficha para comprobar que crece sin romper la geometría ni las acciones';
const longReview = Array.from({ length: 14 }, (_, i) => `Párrafo ${i + 1} de una reseña larga con contexto del lanzamiento, su escena y su sonido.`).join('\n');

function row(index: number, slug: string, title: string, buyLink: string, overrides: Record<string, unknown> = {}) {
  const primary = [credit(0)];
  return {
    id: `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
    slug,
    title,
    release_date: '2026-08-20',
    type: 'Álbum',
    label: 'Sello U9',
    review: 'Reseña breve.',
    experimental: 1, denso: 2, sintetico: 3, bailable: 4, rapido: 5,
    artists: primary.map(({ name }) => name),
    primary_artists: primary,
    collaborators: [credit(1, 'u9-colab'), credit(2, 'u9-colab')],
    credit_quality: 'verified',
    genres: ['Electro', 'Ambient', 'Techno'],
    countries: ['Colombia', 'México'],
    buy_link: buyLink,
    cover: `https://covers.test/${slug}.svg`,
    ...overrides
  };
}

const BANDCAMP = 'https://artista.bandcamp.com/album/u9';
const cases = [
  { slug: 'u9-bandcamp', label: 'Bandcamp', provider: 'bandcamp', height: 290 },
  { slug: 'u9-soundcloud', label: 'SoundCloud', provider: 'soundcloud', height: 300 },
  { slug: 'u9-spotify', label: 'Spotify', provider: 'spotify', height: 352 },
  { slug: 'u9-sin-portada', label: 'sin portada', provider: 'bandcamp', height: 290 },
  { slug: 'u9-titulo-largo', label: 'título largo', provider: 'bandcamp', height: 290 },
  { slug: 'u9-resena-larga', label: 'reseña larga', provider: 'bandcamp', height: 290 }
] as const;

const rows = [
  row(0, 'u9-bandcamp', 'Ficha U9 Bandcamp', BANDCAMP),
  row(1, 'u9-soundcloud', 'Ficha U9 SoundCloud', 'https://soundcloud.com/artista/sets/u9'),
  row(2, 'u9-spotify', 'Ficha U9 Spotify', 'https://open.spotify.com/album/1234567890123456789012'),
  row(3, 'u9-sin-portada', 'Ficha U9 sin portada', BANDCAMP, { cover: '' }),
  row(4, 'u9-titulo-largo', longTitle, BANDCAMP),
  row(5, 'u9-resena-larga', 'Ficha U9 reseña larga', BANDCAMP, { review: longReview })
];

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
      await route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(rows.find((candidate) => candidate.id === id) ?? null) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` },
      body: JSON.stringify(rows)
    });
  });
  await page.route('https://covers.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg }));
  for (const provider of ['https://bandcamp.com/**', 'https://w.soundcloud.com/**', 'https://open.spotify.com/**']) {
    await page.route(provider, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: playerFixture }));
  }
}

const viewports = [
  { width: 390, height: 844 },
  { width: 680, height: 1000 },
  // Los dos lados del corte: 767 en una columna; 768 en dos, con la información al mínimo (360).
  { width: 767, height: 1024 },
  { width: 768, height: 1024 },
  { width: 834, height: 1112 },
  { width: 1112, height: 834 },
  { width: 1440, height: 900 }
];

const rect = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
  });

for (const viewport of viewports) {
  const wide = viewport.width >= 768;
  const touch = viewport.width < 680;

  test.describe(`U9 a ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });
    test.beforeEach(async ({ page }) => mockCatalog(page));

    for (const surface of ['modal', 'page'] as const) {
      test(`U9: geometría de la ficha en ${surface} (${viewport.width})`, async ({ page }) => {
        for (const item of cases) {
          await page.goto(surface === 'modal' ? `/?modal=${item.slug}` : `/lanzamiento/${item.slug}`);
          const detail = page.locator(`[data-release-detail][data-release-detail-mode="${surface}"]`);
          await expect(detail).toBeVisible();
          const player = detail.locator(`[data-release-player="${item.provider}"]`);
          await expect(player).toHaveAttribute('data-player-loaded', 'true');
          await page.waitForTimeout(150);
          const tag = `${surface} ${viewport.width} ${item.label}`;

          // Sin desborde horizontal del documento.
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tag}: scroll horizontal`).toBe(true);

          // Portada cuadrada con el mismo marco en los cuatro lados; sin
          // portada, el logo atenuado con nombre accesible.
          const cover = await rect(page, '.release-detail__cover .ui-cover');
          const column = await rect(page, `[data-release-detail-mode="${surface}"] .release-detail__cover-column`);
          expect(Math.abs(cover.width - cover.height), `${tag}: portada cuadrada`).toBeLessThanOrEqual(1);
          const frame = [cover.top - column.top, column.bottom - cover.bottom, cover.left - column.left, column.right - cover.right];
          for (const side of frame) expect(Math.abs(side - 24), `${tag}: marco uniforme ${frame.map(Math.round).join('/')}`).toBeLessThanOrEqual(1);
          if (item.slug === 'u9-sin-portada') {
            await expect(detail.getByRole('img', { name: 'Portada de Ficha U9 sin portada' })).toBeVisible();
          }

          // El reproductor conserva su alto (R1).
          expect(Math.round((await player.boundingBox())?.height ?? 0), `${tag}: alto del reproductor`).toBe(item.height);

          // Acciones en una sola línea: Comprar, Añadir a colección, Compartir, Reportar.
          const actions = detail.locator('[data-release-actions]');
          const controls = actions.locator(':scope > :is(a, span, div)');
          await expect(controls).toHaveCount(3);
          const tops = await actions.locator('a.ui-btn, button.ui-btn').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
          expect(tops.length, `${tag}: cuatro acciones`).toBe(4);
          expect(Math.max(...tops) - Math.min(...tops), `${tag}: acciones en una línea`).toBeLessThanOrEqual(6);
          const bar = await rect(page, `[data-release-detail-mode="${surface}"] [data-release-actions]`);
          const lastControl = await actions.locator('a.ui-btn, button.ui-btn').last().evaluate((node) => node.getBoundingClientRect().right);
          expect(lastControl, `${tag}: acciones dentro de la barra`).toBeLessThanOrEqual(bar.right + 0.5);

          const layout = await rect(page, `[data-release-detail-mode="${surface}"] .release-detail__layout`);
          if (wide) {
            // Columna de la portada cuadrada, arriba a la izquierda, y la barra justo debajo, a todo el ancho.
            expect(Math.abs(column.width - column.height), `${tag}: columna cuadrada`).toBeLessThanOrEqual(1);
            expect(Math.abs(column.top - layout.top), `${tag}: columna arriba`).toBeLessThanOrEqual(1);
            expect(Math.abs(column.left - layout.left), `${tag}: columna a la izquierda`).toBeLessThanOrEqual(1);
            expect(Math.abs(bar.top - column.bottom), `${tag}: barra bajo la portada`).toBeLessThanOrEqual(1);
            // En la página el panel tiene un borde de 1 px por fuera del contenido.
            const border = surface === 'page' ? 1 : 0;
            expect(Math.abs(bar.left - layout.left - border) + Math.abs(layout.right - border - bar.right), `${tag}: barra a todo el ancho`).toBeLessThanOrEqual(1);
            expect(Math.abs(bar.bottom - layout.bottom), `${tag}: barra al pie`).toBeLessThanOrEqual(1);
            // Tope del bloque de la portada: 640.
            expect(column.width, `${tag}: tope de la portada`).toBeLessThanOrEqual(640.5);
            // Toda la ficha cabe en el viewport.
            expect(layout.bottom, `${tag}: ficha dentro del viewport`).toBeLessThanOrEqual(viewport.height + 1);
            if (surface === 'modal') {
              const dialog = await rect(page, '.release-modal');
              expect(Math.abs(dialog.height - 2 - layout.height), `${tag}: el diálogo mide la ficha`).toBeLessThanOrEqual(1);
            }
            expect(await actions.evaluate((node) => Boolean(node.closest('.release-detail__info'))), `${tag}: barra fuera del scroll`).toBe(false);
          } else {
            // Una columna: portada enmarcada a todo el ancho y barra fija abajo.
            expect(Math.abs(column.left), `${tag}: portada desde el borde`).toBeLessThanOrEqual(1);
            expect(Math.abs(column.width - viewport.width), `${tag}: portada a todo el ancho`).toBeLessThanOrEqual(1);
            expect(Math.abs(bar.bottom - viewport.height), `${tag}: barra fija abajo`).toBeLessThanOrEqual(1);
          }

          // Con el reproductor a la vista, la barra empieza debajo: nunca se solapan.
          // Se mide la parte visible del reproductor (la región con scroll lo recorta).
          const playerBox = await player.evaluate((node) => {
            let region: HTMLElement | null = node.parentElement;
            while (region && !(/(auto|scroll)/.test(getComputedStyle(region).overflowY) && region.scrollHeight > region.clientHeight)) region = region.parentElement;
            const scroller = region ?? (document.scrollingElement as HTMLElement);
            const top = region ? region.getBoundingClientRect().top : 0;
            scroller.scrollTop += node.getBoundingClientRect().top - top - (region ? 0 : 24);
            const visibleBottom = region ? region.getBoundingClientRect().bottom : window.innerHeight;
            return { bottom: Math.min(node.getBoundingClientRect().bottom, visibleBottom), height: node.getBoundingClientRect().height, room: visibleBottom - top };
          });
          await page.waitForTimeout(100);
          const barTop = await actions.evaluate((node) => node.getBoundingClientRect().top);
          expect(barTop, `${tag}: reproductor y acciones no se solapan`).toBeGreaterThanOrEqual(playerBox.bottom - 0.5);
          // Y el reproductor completo cabe en su región (desde 768, el lado mínimo es 360 > 352).
          expect(playerBox.room, `${tag}: el reproductor cabe entero`).toBeGreaterThanOrEqual(playerBox.height);

          if (process.env.U9_CAPTURAS) {
            await page.evaluate(() => document.querySelectorAll('[data-release-scroll-region]').forEach((node) => (node.scrollTop = 0)));
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(150);
            await page.screenshot({ path: `docs/modernizacion/capturas-u9/${surface}-${viewport.width}-${item.slug.replace('u9-', '')}.png` });
          }
        }
      });
    }

    if (wide) {
      test(`U9: la información desplaza dentro de la ficha y la portada no se mueve (${viewport.width})`, async ({ page }) => {
        for (const target of ['/?modal=u9-resena-larga', '/lanzamiento/u9-resena-larga']) {
          await page.goto(target);
          const info = page.locator('.release-detail__info');
          await expect.poll(() => info.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
          // La referencia se toma con la entrada del modal terminada y, en la
          // página, después de volver a medir con las fuentes cargadas.
          await page.evaluate(async () => {
            await document.fonts.ready;
            const dialog = document.querySelector('.release-modal');
            await Promise.all((dialog?.getAnimations() ?? []).map((animation) => animation.finished.catch(() => {})));
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          const coverTop = (await page.locator('.release-detail__cover').boundingBox())?.y;
          await info.evaluate((node) => { node.scrollTop = node.scrollHeight; });
          await expect.poll(() => info.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
          expect((await page.locator('.release-detail__cover').boundingBox())?.y).toBe(coverTop);
        }
      });
    }
  });
}

test('U9: en tablet vertical (834) dos columnas y la portada no queda diminuta', async ({ page }) => {
  await mockCatalog(page);
  await page.setViewportSize({ width: 834, height: 1112 });
  for (const target of ['/?modal=u9-bandcamp', '/lanzamiento/u9-bandcamp']) {
    await page.goto(target);
    const cover = await page.locator('.release-detail__cover .ui-cover').boundingBox();
    const info = await page.locator('.release-detail__info').boundingBox();
    // Antes de U9: 225 px. Ahora la portada (sin el marco) mide ~394 en el modal
    // y ~378 en la página, que pierde el margen lateral del contenedor.
    expect(cover?.width ?? 0, target).toBeGreaterThanOrEqual(370);
    expect(info && cover && info.x >= cover.x + cover.width, `${target}: información a la derecha`).toBe(true);
  }
});

test('U9: en la página móvil la barra fija se acopla al final de la ficha y no tapa el pie', async ({ page }) => {
  await mockCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lanzamiento/u9-bandcamp');
  const bar = page.locator('[data-release-actions]');
  await expect(page.locator('[data-release-player]')).toHaveAttribute('data-player-loaded', 'true');
  // U18: la barra es sticky (antes, position: fixed por JavaScript). Se mide
  // dónde queda, no un atributo.
  const barBottom = () => bar.evaluate((node) => Math.round(node.getBoundingClientRect().bottom));
  const viewportBottom = await page.evaluate(() => window.innerHeight);
  await expect.poll(barBottom).toBe(viewportBottom);
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(barBottom).toBe(viewportBottom);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footerTop = await page.locator('footer').last().evaluate((node) => node.getBoundingClientRect().top);
  await expect.poll(barBottom).toBeLessThanOrEqual(Math.round(footerTop));
  expect(await barBottom()).toBeLessThan(viewportBottom);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(barBottom).toBe(viewportBottom);
});

test('U9: la página usa el fondo desenfocado de la portada y las migas del sistema', async ({ page }) => {
  await mockCatalog(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/lanzamiento/u9-bandcamp');
  const fondo = page.locator('.ficha-pagina__fondo');
  await expect(fondo).toHaveAttribute('src', 'https://covers.test/u9-bandcamp.svg');
  await expect(fondo).toHaveCSS('filter', /blur/);
  const crumbs = page.getByRole('navigation', { name: /migas|ruta/i });
  await expect(crumbs.getByRole('link', { name: 'Catálogo' })).toBeVisible();
  await expect(page.getByText('Explorar el catálogo')).toHaveCount(0);

  await page.goto('/lanzamiento/u9-sin-portada');
  await expect(page.locator('[data-release-detail]')).toBeVisible();
  await expect(page.locator('.ficha-pagina__fondo')).toHaveCount(0);
});

test('U9: modal y página montan la misma ficha', async ({ page }) => {
  await mockCatalog(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const shape = async () => page.locator('[data-release-detail]').evaluate((node) => {
    const walk = (element: Element): string => `${element.tagName}.${[...element.classList].filter((name) => name.startsWith('release-detail') || name.startsWith('ui-')).sort().join('.')}[${[...element.children].map(walk).join(',')}]`;
    // Sin el título (h1/h2) ni el contenido de terceros: la estructura de la ficha.
    return walk(node.querySelector('.release-detail__layout')!).replace(/H[12]\./g, 'H.');
  });
  await page.goto('/lanzamiento/u9-bandcamp');
  await expect(page.locator('[data-release-player]')).toHaveAttribute('data-player-loaded', 'true');
  const pageShape = await shape();
  await page.goto('/?modal=u9-bandcamp');
  await expect(page.locator('[data-release-player]')).toHaveAttribute('data-player-loaded', 'true');
  expect(await shape()).toBe(pageShape);
});
