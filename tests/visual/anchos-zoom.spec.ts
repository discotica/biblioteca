// E21-rc2 y U34: cada vista del inventario (tablero L) a 1440, 1024, 390 y con zoom al 200 %,
// con la misma red simulada que el censo. No compara capturas: comprueba que nada se sale del
// ancho, que no se parte una palabra, que el header y el contenido principal siguen a la vista,
// que cada control es alcanzable y tiene nombre, y (con zoom) que el foco se ve. Guarda una
// captura de cada estado en tests/visual/results/anchos (o en ANCHOS_OUT) para revisarla a mano.
//   npm run test:anchos
//   ANCHOS_OUT=docs/modernizacion/capturas-u34 npm run test:anchos
// El zoom al 200 % de una ventana de 1280 × 800 es un viewport de 640 × 400 CSS px
// con densidad 2: así lo ve el CSS (WCAG 1.4.4 y 1.4.10).
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installNetwork, type MockOptions } from './support/mocks';
import { prepareContext, settle, waitRendered } from './support/stabilize';
import { ARTIST_SLUG, LABEL_SLUG, pick, sample, type Role } from './support/data';
import { brokenWords, focusWithoutRing, horizontalOffenders, lowContrast, unnamedControls, unnamedIcons } from './support/checks';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.env.ANCHOS_OUT ? path.resolve(process.cwd(), process.env.ANCHOS_OUT) : path.join(HERE, 'results/anchos');
fs.mkdirSync(OUT, { recursive: true });
const CATALOG_READY = '.resultados__grid, .resultados__vacio, .resultados__error';

const MODES = {
  '1440': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  '1024': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  '390': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  zoom200: { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }
} as const;

type Route = {
  id: string;
  url: string;
  role?: Role;
  ready?: string;
  fresh?: boolean;
  mock?: MockOptions;
  /** El estado se alcanza con una interacción. */
  setup?: (page: Page) => Promise<void>;
  /** Un diálogo o panel deja inerte la barra: no se pide que sus controles respondan. */
  overlay?: boolean;
};

// El alta son tres pasos (U30): recorre los que se pidan.
const registroEnPasos = async (page: Page, hasta: 1 | 2 | 3, privacy = false) => {
  await page.getByLabel('Correo', { exact: true }).fill('nueva@gmail.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('una-contraseña');
  await page.getByLabel('Repite la contraseña').fill('una-contraseña');
  if (hasta < 2) return;
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByLabel('Usuario').fill('laura_rios');
  if (hasta < 3) return;
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByLabel('Instagram').waitFor();
  if (privacy) await page.getByLabel(/Acepto la política/).check();
};
const abrirPanel = (selector: string) => async (page: Page) => {
  await page.click(selector);
  await page.waitForSelector('[role=menu], .header-panel__menu, [role=dialog]');
  await settle(page);
};

const ROUTES: Route[] = [
  // Ya diseñadas
  { id: 'inicio', url: '/', ready: CATALOG_READY },
  { id: 'inicio-filtrado', url: '/?genero=Techno&pais=Colombia', ready: CATALOG_READY },
  { id: 'inicio-bienvenida', url: '/', fresh: true, ready: CATALOG_READY },
  { id: 'inicio-beta', url: '/?beta=1&nombre=Laura', fresh: true, ready: CATALOG_READY },
  { id: 'entrar', url: '/auth/login' },
  { id: 'registro', url: '/auth/registro' },
  { id: 'registro-paso2', url: '/auth/registro', setup: async (page) => { await registroEnPasos(page, 2); await page.getByText('Disponible').waitFor(); await settle(page); } },
  { id: 'registro-paso3', url: '/auth/registro', setup: async (page) => { await registroEnPasos(page, 3); await settle(page); } },
  {
    id: 'confirmar',
    url: '/auth/registro',
    setup: async (page) => {
      await registroEnPasos(page, 3, true);
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await page.waitForURL('**/auth/confirmar');
      await settle(page);
    }
  },
  { id: 'perfil', url: '/perfil/comunidad', role: 'comunidad', ready: '.perfil-grid' },
  { id: 'perfil-vacio', url: '/perfil/comunidad', role: 'comunidad', mock: { noCrates: true }, ready: '.perfil-crear' },
  { id: 'perfil-visitante', url: '/perfil/comunidad', ready: '#aportes .fila' },
  { id: 'perfil-admin', url: '/perfil/jmamanche', role: 'admin', ready: '.studio' },
  { id: 'coleccion', url: '/coleccion/para-abrir-el-set?usuario=comunidad', role: 'comunidad' },
  { id: 'artista', url: `/artista/${ARTIST_SLUG}` },
  { id: 'sello', url: `/sello/${LABEL_SLUG}` },
  // Ajustadas en los tableros M y N
  { id: 'recuperar', url: '/auth/recuperar' },
  {
    id: 'recuperar-enviado',
    url: '/auth/recuperar',
    setup: async (page) => { await page.fill('input[type=email]', 'nueva@example.test'); await page.click('button[type=submit]'); await settle(page); }
  },
  { id: 'reset-nueva', url: '/auth/reset?type=recovery' },
  { id: 'reset-vencido', url: '/auth/reset' },
  { id: '404', url: '/ruta-que-no-existe' },
  { id: 'error', url: '/coleccion/sin-usuario' },
  { id: 'cuenta', url: '/cuenta', role: 'comunidad', ready: '.cuenta-form .ui-cenefa' },
  { id: 'ajustes', url: '/cuenta/ajustes', role: 'comunidad', ready: '.ajustes__bloque' },
  { id: 'reportar', url: `/reportar?release_id=${sample[3].id}`, role: 'comunidad' },
  { id: 'sugerir', url: '/sugerir', role: 'comunidad' },
  { id: 'mis-aportes', url: '/mis-aportes', role: 'comunidad', ready: '.aportes-grupo' },
  { id: 'manual', url: '/manual' },
  { id: 'privacidad', url: '/privacidad' },
  // Heredan
  { id: 'ficha-modal', url: `/?modal=${pick.collab.slug}`, ready: '[role="dialog"] .release-detail', overlay: true },
  { id: 'ficha-pagina', url: `/lanzamiento/${pick.collab.slug}`, ready: '.release-detail' },
  { id: 'estudio-catalogo', url: '/estudio/catalogo', role: 'admin' },
  { id: 'estudio-propuestas', url: '/estudio/propuestas', role: 'admin' },
  { id: 'estudio-reportes', url: '/estudio/reportes', role: 'admin' },
  { id: 'estudio-colaborador', url: '/estudio/propuestas', role: 'colaborador' },
  // Se va: /mis-colecciones redirige al perfil
  { id: 'mis-colecciones', url: '/mis-colecciones', role: 'comunidad', ready: '.perfil-grid' },
  // Panel de cuenta (U28)
  { id: 'panel-visitante', url: '/', ready: CATALOG_READY, overlay: true, setup: abrirPanel('.header-panel button') },
  { id: 'panel-cuenta', url: '/', role: 'comunidad', ready: CATALOG_READY, overlay: true, setup: abrirPanel('.header-panel .ui-menu__trigger') },
  { id: 'panel-admin', url: '/', role: 'admin', ready: CATALOG_READY, overlay: true, setup: abrirPanel('.header-panel .ui-menu__trigger') }
];

for (const [mode, device] of Object.entries(MODES)) {
  for (const route of ROUTES) {
    test(`${mode} · ${route.id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...device, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light', reducedMotion: 'reduce' });
      await prepareContext(ctx, { fresh: route.fresh });
      await installNetwork(ctx, BASE, route.role ?? null, route.mock);
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route.url, { waitUntil: 'networkidle' });
        if (route.ready) await page.waitForSelector(route.ready);
        await route.setup?.(page);
        await waitRendered(page);

        // 1. Sin scroll horizontal de la página ni contenido cortado por el clip de html/body, y sin palabras partidas.
        const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect.soft(widths.scroll, 'scroll horizontal de la página').toBeLessThanOrEqual(widths.client + 1);
        expect.soft(await horizontalOffenders(page), 'elementos fuera del ancho').toEqual([]);
        expect.soft(await brokenWords(page), 'palabras partidas').toEqual([]);

        // 2. El header y el contenido principal se ven. Con la ficha en modal, el header
        //    queda inerte detrás: se comprueba el diálogo y su botón de cerrar.
        const modal = route.id === 'ficha-modal';
        const scope = modal ? page.getByRole('dialog').first() : page.getByRole('banner').first();
        await expect(scope).toBeVisible();
        if (modal) await expect(scope.getByRole('button', { name: /Cerrar/ }).first()).toBeInViewport();
        else await expect(page.locator('main, [role="main"]').first()).toBeVisible();

        // 3. Cada control del header (o del diálogo) queda dentro del ancho y responde al clic en su centro.
        if (!route.overlay || modal) {
          const blocked = await scope.evaluate((header) => {
            const vw = document.documentElement.clientWidth;
            const misses: string[] = [];
            for (const el of header.querySelectorAll<HTMLElement>('a[href], button')) {
              if (!el.checkVisibility()) continue;
              const r = el.getBoundingClientRect();
              if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
              // Recortado por un contenedor con scroll propio (el cuerpo del diálogo): no está a la vista.
              const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
              let recortado = false;
              for (let n = el.parentElement; n && n !== header.parentElement; n = n.parentElement) {
                if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowY)) continue;
                const b = n.getBoundingClientRect();
                if (cy < b.top || cy > b.bottom || cx < b.left || cx > b.right) { recortado = true; break; }
              }
              if (recortado) continue;
              const hit = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), r.top + r.height / 2);
              if (r.right > vw + 1 || !(hit === el || el.contains(hit))) misses.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30));
            }
            return misses;
          });
          expect.soft(blocked, 'controles tapados o fuera').toEqual([]);
        }

        // 4. Nombre en cada control y cada icono, y contraste del texto sobre fondo plano.
        expect.soft(await unnamedControls(page), 'controles sin nombre').toEqual([]);
        expect.soft(await unnamedIcons(page), 'iconos sin nombre ni aria-hidden').toEqual([]);
        expect.soft(await lowContrast(page), 'contraste bajo').toEqual([]);

        await page.screenshot({ path: path.join(OUT, `${mode}-${route.id}.png`) });

        // 5. Foco visible al recorrer con Tab (una vez por ancho de escritorio y con zoom).
        if ((mode === '1440' || mode === 'zoom200') && !route.setup) expect.soft(await focusWithoutRing(page), 'foco sin indicador').toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
}
