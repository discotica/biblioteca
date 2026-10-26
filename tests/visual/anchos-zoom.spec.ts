// E21-rc2: 1024 px y zoom al 200 %, con la misma red simulada que el censo.
// No compara capturas: comprueba que nada se sale del ancho, que el header y el
// contenido principal siguen a la vista y que cada control es alcanzable. Guarda una
// captura de cada estado para revisarla a mano.
//   npm run test:anchos
// El zoom al 200 % de una ventana de 1280 × 800 es un viewport de 640 × 400 CSS px
// con densidad 2: así lo ve el CSS (WCAG 1.4.4 y 1.4.10).
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installNetwork } from './support/mocks';
import { prepareContext, waitRendered } from './support/stabilize';
import { ARTIST_SLUG, LABEL_SLUG, pick, sample, type Role } from './support/data';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../docs/modernizacion/capturas-e21rc2');
const CATALOG_READY = '.resultados__grid, .resultados__vacio, .resultados__error';

const MODES = {
  '1024': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  zoom200: { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }
} as const;

const ROUTES: Array<{ id: string; url: string; role?: Role; ready?: string }> = [
  { id: 'inicio', url: '/', ready: CATALOG_READY },
  { id: 'inicio-filtrado', url: '/?genero=Techno&pais=Colombia', ready: CATALOG_READY },
  { id: 'ficha-modal', url: `/?modal=${pick.collab.slug}`, ready: '[role="dialog"] .release-detail' },
  { id: 'ficha-pagina', url: `/lanzamiento/${pick.collab.slug}`, ready: '.release-detail' },
  { id: 'artista', url: `/artista/${ARTIST_SLUG}` },
  { id: 'sello', url: `/sello/${LABEL_SLUG}` },
  { id: 'entrar', url: '/auth/login' },
  { id: 'registro', url: '/auth/registro' },
  { id: 'cuenta', url: '/cuenta', role: 'comunidad', ready: '.account-sections' },
  { id: 'sugerir', url: '/sugerir', role: 'comunidad' },
  { id: 'reportar', url: `/reportar?release_id=${sample[3].id}`, role: 'comunidad' },
  { id: 'mis-colecciones', url: '/mis-colecciones', role: 'comunidad', ready: '.crates-grid' },
  { id: 'coleccion', url: '/coleccion/para-abrir-el-set?usuario=comunidad', role: 'comunidad' },
  { id: 'perfil', url: '/perfil/comunidad', role: 'comunidad' },
  { id: 'estudio-catalogo', url: '/estudio/catalogo', role: 'admin' },
  { id: 'estudio-propuestas', url: '/estudio/propuestas', role: 'admin' },
  { id: 'estudio-reportes', url: '/estudio/reportes', role: 'admin' },
  { id: 'estudio-colaborador', url: '/estudio/propuestas', role: 'colaborador' },
  { id: 'manual', url: '/manual' },
  { id: 'privacidad', url: '/privacidad' }
];

/** Elementos con texto o interactivos que se salen del viewport en horizontal, fuera de un carrusel. */
async function horizontalOffenders(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsX = (el: Element | null): boolean => {
      for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only')) continue;
      const interactive = el.matches('a[href], button, input, select, textarea, [role="button"], [tabindex="0"]');
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!interactive && !ownText) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if ((r.left < -1 || r.right > vw + 1) && !scrollsX(el)) {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}» ${Math.round(r.left)}→${Math.round(r.right)}`);
      }
    }
    return out.slice(0, 8);
  });
}

for (const [mode, device] of Object.entries(MODES)) {
  for (const route of ROUTES) {
    test(`${mode} · ${route.id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...device, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light', reducedMotion: 'reduce' });
      await prepareContext(ctx, {});
      await installNetwork(ctx, BASE, route.role ?? null);
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route.url, { waitUntil: 'networkidle' });
        if (route.ready) await page.waitForSelector(route.ready);
        await waitRendered(page);

        // 1. Sin scroll horizontal de la página ni contenido cortado por el clip de html/body.
        const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(widths.scroll, 'scroll horizontal de la página').toBeLessThanOrEqual(widths.client + 1);
        expect(await horizontalOffenders(page), 'elementos fuera del ancho').toEqual([]);

        // 2. El header y el contenido principal se ven. Con la ficha en modal, el header
        //    queda inerte detrás: se comprueba el diálogo y su botón de cerrar.
        const modal = route.id === 'ficha-modal';
        const scope = modal ? page.getByRole('dialog').first() : page.getByRole('banner').first();
        await expect(scope).toBeVisible();
        if (modal) await expect(scope.getByRole('button', { name: /Cerrar/ }).first()).toBeInViewport();
        else await expect(page.locator('main, [role="main"]').first()).toBeVisible();

        // 3. Cada control del header (o del diálogo) queda dentro del ancho y responde al clic en su centro.
        const blocked = await scope.evaluate((header) => {
          const vw = document.documentElement.clientWidth;
          const misses: string[] = [];
          for (const el of header.querySelectorAll<HTMLElement>('a[href], button')) {
            if (!el.checkVisibility()) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
            const hit = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), r.top + r.height / 2);
            if (r.right > vw + 1 || !(hit === el || el.contains(hit))) misses.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30));
          }
          return misses;
        });
        expect(blocked, 'controles tapados o fuera').toEqual([]);

        await page.screenshot({ path: path.join(OUT, `${mode}-${route.id}.png`) });
      } finally {
        await ctx.close();
      }
    });
  }
}
