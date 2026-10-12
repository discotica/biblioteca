// Calienta el servidor de desarrollo antes de capturar: Vite optimiza
// dependencias la primera vez que ve cada ruta y puede recargar la página a
// mitad de una captura. Visitar cada ruta una vez deja el grafo estable.
import { chromium } from '@playwright/test';
import { installNetwork } from './mocks';
import { prepareContext, waitRendered } from './stabilize';
import { pick } from './data';

const ROUTES: Array<[string, 'admin' | null]> = [
  ['/', null],
  [`/?modal=${pick.collab.slug}`, null],
  [`/lanzamiento/${pick.collab.slug}`, null],
  ['/artista/entranas--38c34929', null],
  ['/sello/trampa', null],
  ['/auth/login', null],
  ['/auth/registro', null],
  ['/auth/recuperar', null],
  ['/auth/reset', null],
  ['/sugerir', 'admin'],
  ['/reportar', 'admin'],
  ['/mis-colecciones', 'admin'],
  ['/coleccion/para-abrir-el-set?usuario=comunidad', 'admin'],
  ['/perfil/comunidad', 'admin'],
  ['/estudio/propuestas', 'admin'],
  ['/estudio/catalogo', 'admin'],
  ['/estudio/reportes', 'admin'],
  ['/manual', null],
  ['/privacidad', null],
  ['/ruta-que-no-existe', null]
];

export default async function globalSetup() {
  const base = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
  const browser = await chromium.launch();
  const started = Date.now();
  try {
    for (let pass = 0; pass < 2; pass++) {
      for (const [route, role] of ROUTES) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await prepareContext(ctx, {});
        await installNetwork(ctx, base, role);
        const page = await ctx.newPage();
        await page.goto(base + route, { waitUntil: 'load', timeout: 120_000 });
        await waitRendered(page).catch(() => {});
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Servidor visual caliente en ${((Date.now() - started) / 1000).toFixed(1)} s (${base})`);
}
