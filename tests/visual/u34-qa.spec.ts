// U34: QA transversal de la dirección de arte, con la misma red simulada que el censo.
//  1. Movimiento reducido: toda pieza generativa queda fija (con control positivo sin reducir).
//  2. Teclado: panel de cuenta, «N más» de las chips, «N más» de las fichas y pasos del registro.
//  3. Contraste AA del título y los datos sobre cada cenefa, medido sobre los píxeles reales:
//     se oculta el texto, se captura el fondo y se calcula el contraste de cada elemento contra
//     sus propios píxeles. Con portadas sintéticas del peor caso (blanco y tonos muy claros).
//   VISUAL_SPEC=u34-qa.spec.ts npx playwright test -c tests/visual/playwright.config.ts --reporter=list
// Las medidas se escriben en tests/visual/results/u34-contraste.json.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { installNetwork } from './support/mocks';
import { prepareContext, settle, waitRendered } from './support/stabilize';
import { ARTIST_SLUG, LABEL_SLUG, type Role } from './support/data';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const RESULTS = path.join(HERE, 'results');
const CATALOG_READY = '.resultados__grid, .resultados__vacio, .resultados__error';

type Opciones = { role?: Role | null; reduced?: boolean; viewport?: { width: number; height: number }; fresh?: boolean };

async function abrir(browser: import('@playwright/test').Browser, url: string, o: Opciones = {}) {
  const ctx = await browser.newContext({
    viewport: o.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    colorScheme: 'light',
    reducedMotion: o.reduced === false ? 'no-preference' : 'reduce'
  });
  await prepareContext(ctx, { fresh: o.fresh });
  await installNetwork(ctx, BASE, o.role ?? null);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  return { ctx, page };
}

// ---------------------------------------------------------------------------
// 1. Movimiento reducido

const instantanea = (page: Page, selector: string) => page.locator(selector).first().screenshot({ animations: 'allow' });

test.describe('movimiento reducido', () => {
  test('el campo de pulso del inicio: con movimiento reducido no cambia ni con el cursor encima; sin reducir, sí', async ({ browser }) => {
    // Control positivo: sin reducir, el campo late y cambia.
    {
      const { ctx, page } = await abrir(browser, '/', { reduced: false, fresh: true });
      try {
        await page.waitForSelector('canvas.ui-campo-pulso');
        await waitRendered(page);
        await page.mouse.move(700, 250);
        const a = await instantanea(page, 'canvas.ui-campo-pulso');
        await page.mouse.move(900, 300, { steps: 8 });
        await page.waitForTimeout(700);
        const b = await instantanea(page, 'canvas.ui-campo-pulso');
        expect(Buffer.compare(a, b), 'sin reducir el campo debe animar (control positivo)').not.toBe(0);
      } finally {
        await ctx.close();
      }
    }
    // Reducido: fotograma fijo.
    const { ctx, page } = await abrir(browser, '/', { reduced: true, fresh: true });
    try {
      await page.waitForSelector('canvas.ui-campo-pulso');
      await waitRendered(page);
      const a = await instantanea(page, 'canvas.ui-campo-pulso');
      await page.mouse.move(700, 250);
      await page.mouse.move(900, 300, { steps: 8 });
      await page.waitForTimeout(1200);
      const b = await instantanea(page, 'canvas.ui-campo-pulso');
      expect(Buffer.compare(a, b), 'con movimiento reducido el campo no cambia').toBe(0);
    } finally {
      await ctx.close();
    }
  });

  test('al activar el movimiento reducido con la página abierta, el campo se detiene', async ({ browser }) => {
    const { ctx, page } = await abrir(browser, '/', { reduced: false, fresh: true });
    try {
      await page.waitForSelector('canvas.ui-campo-pulso');
      await waitRendered(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(300);
      const a = await instantanea(page, 'canvas.ui-campo-pulso');
      await page.mouse.move(800, 260, { steps: 6 });
      await page.waitForTimeout(900);
      const b = await instantanea(page, 'canvas.ui-campo-pulso');
      expect(Buffer.compare(a, b)).toBe(0);
    } finally {
      await ctx.close();
    }
  });

  const PAGINAS: Array<{ id: string; url: string; role?: Role }> = [
    { id: 'inicio', url: '/' },
    { id: 'entrar', url: '/auth/login' },
    { id: 'registro', url: '/auth/registro' },
    { id: '404', url: '/ruta-que-no-existe' },
    { id: 'perfil', url: '/perfil/comunidad', role: 'comunidad' },
    { id: 'artista', url: `/artista/${ARTIST_SLUG}` },
    { id: 'sello', url: `/sello/${LABEL_SLUG}` },
    { id: 'aportes', url: '/mis-aportes', role: 'comunidad' },
    { id: 'cuenta', url: '/cuenta', role: 'comunidad' }
  ];
  for (const pagina of PAGINAS) {
    test(`${pagina.id}: sin animaciones infinitas ni transiciones largas con movimiento reducido`, async ({ browser }) => {
      const { ctx, page } = await abrir(browser, pagina.url, { role: pagina.role, reduced: true });
      try {
        await waitRendered(page);
        await settle(page);
        const vivas = await page.evaluate(() =>
          document.getAnimations()
            .filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === 'running')
            .map((a) => `${(a as CSSAnimation).animationName ?? a.constructor.name} en ${(a.effect as KeyframeEffect).target?.nodeName.toLowerCase()}.${[...((a.effect as KeyframeEffect).target as HTMLElement)?.classList ?? []].join('.')}`)
        );
        expect(vivas, 'animaciones infinitas corriendo').toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }

  test('Registro paso 1: el latido del fondo corre sin reducir y se detiene al reducir', async ({ browser }) => {
    const nombre = (reduced: boolean) => async () => {
      const { ctx, page } = await abrir(browser, '/auth/registro', { reduced });
      try {
        await waitRendered(page);
        return await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === 'running').length);
      } finally {
        await ctx.close();
      }
    };
    expect(await nombre(false)(), 'control positivo: sin reducir hay un latido').toBeGreaterThan(0);
    expect(await nombre(true)()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Teclado

test.describe('teclado', () => {
  for (const [id, role, nombreMenu] of [
    ['visitante', null, 'Menú'],
    ['comunidad', 'comunidad', null]
  ] as const) {
    test(`panel de cuenta (${id}): Enter abre, flechas recorren, Escape cierra y devuelve el foco`, async ({ browser }) => {
      const { ctx, page } = await abrir(browser, '/', { role });
      try {
        await page.waitForSelector(CATALOG_READY);
        const disparador = nombreMenu ? page.getByRole('banner').getByRole('button', { name: nombreMenu }) : page.locator('.header-panel .ui-menu__trigger');
        await disparador.focus();
        await page.keyboard.press('Enter');
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        const items = menu.getByRole('menuitem');
        const total = await items.count();
        expect(total).toBeGreaterThanOrEqual(3);
        await expect(items.first()).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(items.nth(1)).toBeFocused();
        await page.keyboard.press('End');
        await expect(items.nth(total - 1)).toBeFocused();
        await page.keyboard.press('Home');
        await expect(items.first()).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect(items.nth(total - 1)).toBeFocused(); // da la vuelta
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
        await expect(disparador).toBeFocused();
        // Tab con el panel abierto lo cierra sin atrapar el foco.
        await page.keyboard.press('Enter');
        await expect(menu).toBeVisible();
        await expect(items.first()).toBeFocused(); // el foco entra en el panel al abrir; Tab antes de eso sale del disparador
        await page.keyboard.press('Tab');
        await expect(menu).toHaveCount(0);
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
      } finally {
        await ctx.close();
      }
    });
  }

  test('chips «N más»: Enter abre, Tab entra, Escape cierra y devuelve el foco al botón', async ({ browser }) => {
    const { ctx, page } = await abrir(browser, '/?pais=Colombia&pais=Argentina&genero=Techno&genero=Cumbia&a%C3%B1o=2024&type=EP');
    try {
      await page.waitForSelector(CATALOG_READY);
      const mas = page.locator('.home-search .pills__mas-boton');
      await expect(mas).toHaveText(/^\d+ más/);
      await mas.focus();
      await page.keyboard.press('Enter');
      await expect(mas).toHaveAttribute('aria-expanded', 'true');
      const panel = page.locator('.pills__mas-panel');
      await expect(panel).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(panel.locator('.chip-activo').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(mas).toBeFocused();
      expect(await focusWithoutRingOn(page, mas)).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('ficha del sello: «N más» abre el desplegable con teclado, recorre sus filas y Escape devuelve el foco', async ({ browser }) => {
    const { ctx, page } = await abrir(browser, `/sello/${LABEL_SLUG}`);
    try {
      await waitRendered(page);
      const botones = page.locator('.ficha-cabeza .ficha-dato button').filter({ hasText: /\d+ más/ });
      const n = await botones.count();
      expect(n, 'el sello de la muestra tiene al menos una lista con «N más»').toBeGreaterThan(0);
      const boton = botones.first();
      await boton.focus();
      await page.keyboard.press('Enter');
      await expect(boton).toHaveAttribute('aria-expanded', 'true');
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      const items = menu.getByRole('menuitem');
      const total = await items.count();
      await expect(items.first()).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('End');
      await expect(items.nth(total - 1)).toBeFocused();
      await page.keyboard.press('Home');
      await expect(items.first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(boton).toBeFocused();
      expect(await focusWithoutRingOn(page, boton)).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('registro en tres pasos: solo teclado, con el foco siempre en un control y Enter que avanza', async ({ browser }) => {
    const { ctx, page } = await abrir(browser, '/auth/registro');
    try {
      await waitRendered(page);
      const foco = () => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return (el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent || el.tagName).trim().slice(0, 30);
      });
      const rastro: Array<string | null> = [];

      // Paso 1: correo, contraseña y repetición. Enter en el último campo envía el paso.
      await page.getByLabel('Correo', { exact: true }).focus();
      await page.keyboard.type('nueva@gmail.com');
      await page.keyboard.press('Tab');
      await page.keyboard.type('una-contraseña');
      // El botón de ver contraseña es el siguiente control; el campo de repetición, el que sigue.
      await page.getByLabel('Repite la contraseña').focus();
      await page.keyboard.type('una-contraseña');
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Usuario')).toBeVisible();
      rastro.push(await foco());
      expect(rastro.at(-1), 'tras avanzar al paso 2 el foco no se pierde').not.toBeNull();

      // Paso 2: el foco va al usuario; Enter avanza.
      await page.getByLabel('Usuario').focus();
      await page.keyboard.type('laura_rios');
      await page.getByText('Disponible').waitFor();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Instagram')).toBeVisible();
      rastro.push(await foco());
      expect(rastro.at(-1), 'tras avanzar al paso 3 el foco no se pierde').not.toBeNull();

      // Paso 3: la política se marca con Espacio y el alta se envía con el botón.
      await page.getByLabel(/Acepto la política/).focus();
      await page.keyboard.press('Space');
      await expect(page.getByLabel(/Acepto la política/)).toBeChecked();
      await page.getByRole('button', { name: 'Crear cuenta' }).focus();
      expect(await focusWithoutRingOn(page, page.getByRole('button', { name: 'Crear cuenta' }))).toBe(true);
      await page.keyboard.press('Enter');
      await page.waitForURL('**/auth/confirmar');

      // Volver atrás desde el paso 3 conserva lo escrito (se prueba en una página nueva).
      const otra = await abrir(browser, '/auth/registro');
      try {
        await otra.page.getByLabel('Correo', { exact: true }).fill('nueva@gmail.com');
        await otra.page.getByLabel('Contraseña', { exact: true }).fill('una-contraseña');
        await otra.page.getByLabel('Repite la contraseña').fill('una-contraseña');
        await otra.page.getByRole('button', { name: 'Seguir' }).click();
        await otra.page.getByLabel('Usuario').fill('laura_rios');
        const atras = otra.page.getByRole('button', { name: /Atrás|Volver/ });
        if (await atras.count()) {
          await atras.first().focus();
          await otra.page.keyboard.press('Enter');
          await expect(otra.page.getByLabel('Correo', { exact: true })).toHaveValue('nueva@gmail.com');
        }
      } finally {
        await otra.ctx.close();
      }
    } finally {
      await ctx.close();
    }
  });
});

/** El control enfocado muestra un anillo (outline o sombra). */
async function focusWithoutRingOn(page: Page, locator: ReturnType<Page['locator']>) {
  await locator.focus();
  return locator.evaluate((el) => {
    const seen = (node: Element, pseudo?: string) => {
      const s = getComputedStyle(node, pseudo);
      return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
    };
    return seen(el) || seen(el, '::after') || seen(el, '::before');
  });
}

// ---------------------------------------------------------------------------
// 3. Contraste sobre las cenefas

type Medida = {
  pagina: string;
  portada: string;
  texto: string;
  fuente: string;
  grande: boolean;
  /** Contraste del 2.º percentil de los píxeles del fondo (el peor sin los extremos sueltos). */
  p2: number;
  /** El mínimo absoluto. */
  min: number;
  umbral: number;
  ok: boolean;
};

const DIR_MEDIDAS = path.join(RESULTS, 'u34-contraste');

const svgSolido = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${color}"/></svg>`;

/** Portadas del peor caso: blanco y tonos saturados muy claros. Pasan por el mismo filtro de la cenefa. */
const PORTADAS: Array<[string, string]> = [
  ['blanco', '#ffffff'],
  ['amarillo', '#ffff66'],
  ['cian', '#7df9ff'],
  ['rosa', '#ff9ee0'],
  ['lima', '#baff4e']
];

async function cubrirPortadas(ctx: BrowserContext, color: string | null) {
  if (!color) return;
  await ctx.route((url) => /\.(avif|webp|jpe?g|png)(\?|$)/i.test(url.pathname) || url.hostname.includes('bcbits') || url.hostname.includes('example'), (route) =>
    route.request().resourceType() === 'image' ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgSolido(color) }) : route.fallback()
  );
}

/**
 * Mide el contraste de cada texto que cae sobre una cenefa, contra los píxeles reales de su caja.
 * 1) Reúne el texto (color, tamaño, caja). 2) Oculta el texto y captura la cenefa. 3) En la página,
 * decodifica la captura y compara el color del texto, compuesto sobre cada píxel, con ese píxel.
 */
async function medirCenefa(page: Page, pagina: string, portada: string, alcance = '.ui-cenefa'): Promise<Medida[]> {
  const reunidos = await page.evaluate((alcanceSel) => {
    const cenefas = [...document.querySelectorAll<HTMLElement>(alcanceSel)].filter((c) => c.checkVisibility?.() && c.getBoundingClientRect().height > 0);
    if (!cenefas.length) return null;
    const cen = cenefas[0];
    const cr = cen.getBoundingClientRect();
    const scope = cen.parentElement!;
    const textos: Array<{ texto: string; x: number; y: number; w: number; h: number; color: string; size: number; weight: number }> = [];
    for (const el of scope.querySelectorAll<HTMLElement>('*')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only')) continue;
      const propio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ').trim();
      if (!propio) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        if (r.right < cr.left || r.left > cr.right || r.bottom < cr.top || r.top > cr.bottom) continue;
        const s = getComputedStyle(el);
        textos.push({ texto: propio.slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: s.color, size: parseFloat(s.fontSize), weight: Number(s.fontWeight) });
      }
    }
    return { clip: { x: cr.left, y: cr.top, width: cr.width, height: cr.height }, textos };
  }, alcance);
  if (!reunidos) throw new Error(`Sin cenefa en ${pagina}`);

  await page.addStyleTag({ content: `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg { visibility: hidden !important; }` });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const png = await page.screenshot({ clip: reunidos.clip });
  const resultado = await page.evaluate(
    async ({ b64, clip, textos }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      const lum = (r: number, g: number, b: number) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
      const analizar = (t: (typeof textos)[number]) => {
        const m = t.color.match(/[\d.]+/g)!.map(Number);
        const [tr, tg, tb] = m;
        const ta = m[3] ?? 1;
        const x = Math.max(0, Math.floor(t.x - clip.x)), y = Math.max(0, Math.floor(t.y - clip.y));
        const w = Math.min(bmp.width - x, Math.ceil(t.w)), h = Math.min(bmp.height - y, Math.ceil(t.h));
        if (w < 1 || h < 1) return null;
        const d = ctx.getImageData(x, y, w, h).data;
        const razones: number[] = [];
        for (let i = 0; i < d.length; i += 4) {
          const br = d[i], bg = d[i + 1], bb = d[i + 2];
          const fr = tr * ta + br * (1 - ta), fg = tg * ta + bg * (1 - ta), fb = tb * ta + bb * (1 - ta);
          const a = lum(fr, fg, fb), b = lum(br, bg, bb);
          razones.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
        }
        razones.sort((p, q) => p - q);
        return { p2: razones[Math.floor(razones.length * 0.02)], min: razones[0] };
      };
      return textos.map((t) => ({ t, r: analizar(t) }));
    },
    { b64: png.toString('base64'), clip: reunidos.clip, textos: reunidos.textos }
  );
  const medidas: Medida[] = [];
  for (const { t, r } of resultado) {
    if (!r) continue;
    const grande = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
    const umbral = grande ? 3 : 4.5;
    medidas.push({ pagina, portada, texto: t.texto, fuente: `${t.size}px/${t.weight}`, grande, p2: Number(r.p2.toFixed(2)), min: Number(r.min.toFixed(2)), umbral, ok: r.p2 >= umbral });
  }
  fs.mkdirSync(DIR_MEDIDAS, { recursive: true });
  fs.writeFileSync(path.join(DIR_MEDIDAS, `${pagina}--${portada}.json`), JSON.stringify(medidas, null, 1));
  const informe = medidas.filter((m) => !m.ok).map((f) => `${f.p2} (mín ${f.min}) < ${f.umbral} · ${f.fuente} · «${f.texto}»`);
  expect.soft(medidas.length, `${pagina}/${portada}: hay texto medido`).toBeGreaterThan(0);
  expect.soft(informe, `${pagina}/${portada}: texto bajo AA sobre la cenefa`).toEqual([]);
  return medidas;
}

test.describe('contraste sobre cenefas', () => {
  // Las fichas (artista, sello, colección) llevan la portada más reciente.
  const FICHAS: Array<{ id: string; url: string; role?: Role }> = [
    { id: 'artista', url: `/artista/${ARTIST_SLUG}` },
    { id: 'sello', url: `/sello/${LABEL_SLUG}` },
    { id: 'coleccion', url: '/coleccion/para-abrir-el-set?usuario=comunidad', role: 'comunidad' }
  ];
  for (const ficha of FICHAS) {
    for (const [nombre, color] of [['mock', null], ...PORTADAS] as Array<[string, string | null]>) {
      test(`${ficha.id} con portada ${nombre}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
        await prepareContext(ctx, {});
        await installNetwork(ctx, BASE, ficha.role ?? null);
        await cubrirPortadas(ctx, color);
        const page = await ctx.newPage();
        try {
          await page.goto(BASE + ficha.url, { waitUntil: 'networkidle' });
          await page.waitForSelector('.ficha-cabeza .ui-cenefa__superficie--lista, .ficha-cabeza .ui-cenefa__huella');
          await waitRendered(page);
          await medirCenefa(page, ficha.id, nombre, '.ficha-cabeza .ui-cenefa');
        } finally {
          await ctx.close();
        }
      });
    }
  }

  // Sin portada: la huella del rol (perfil, Mis aportes, Editar perfil y panel de cuenta).
  const HUELLAS: Array<{ id: string; url: string; role: Role | null; scope: string; abrir?: (page: Page) => Promise<void> }> = [
    { id: 'perfil-usuario', url: '/perfil/comunidad', role: 'comunidad', scope: '.perfil-cabeza__cenefa' },
    { id: 'perfil-colaborador', url: '/perfil/colaboradora', role: 'comunidad', scope: '.perfil-cabeza__cenefa' },
    { id: 'perfil-admin', url: '/perfil/jmamanche', role: 'admin', scope: '.perfil-cabeza__cenefa' },
    { id: 'mis-aportes', url: '/mis-aportes', role: 'comunidad', scope: '.aportes-cabeza__cenefa' },
    { id: 'cuenta-usuario', url: '/cuenta', role: 'comunidad', scope: '.cuenta-cenefa' },
    { id: 'cuenta-admin', url: '/cuenta', role: 'admin', scope: '.cuenta-cenefa' },
    { id: 'cuenta-colaborador', url: '/cuenta', role: 'colaborador', scope: '.cuenta-cenefa' },
    {
      id: 'panel-usuario', url: '/', role: 'comunidad', scope: '.panel-cenefa',
      abrir: async (page) => { await page.click('.header-panel .ui-menu__trigger'); await page.waitForSelector('.panel-cenefa'); await settle(page); }
    },
    {
      id: 'panel-admin', url: '/', role: 'admin', scope: '.panel-cenefa',
      abrir: async (page) => { await page.click('.header-panel .ui-menu__trigger'); await page.waitForSelector('.panel-cenefa'); await settle(page); }
    },
    {
      id: 'panel-colaborador', url: '/', role: 'colaborador', scope: '.panel-cenefa',
      abrir: async (page) => { await page.click('.header-panel .ui-menu__trigger'); await page.waitForSelector('.panel-cenefa'); await settle(page); }
    }
  ];
  for (const huella of HUELLAS) {
    test(`huella: ${huella.id}`, async ({ browser }) => {
      const { ctx, page } = await abrir(browser, huella.url, { role: huella.role });
      try {
        await waitRendered(page);
        await huella.abrir?.(page);
        await page.waitForSelector(huella.scope);
        await medirCenefa(page, huella.id, 'huella', huella.scope);
      } finally {
        await ctx.close();
      }
    });
  }
});
