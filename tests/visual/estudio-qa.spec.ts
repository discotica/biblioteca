// U25: QA del rediseño del Estudio. Las 7 pantallas del lienzo a 390, 768, 1024, 1440 y zoom
// al 200 %, con la red simulada del censo. No compara capturas: mide lo que el censo no ve.
//   VISUAL_SPEC=estudio-qa.spec.ts npx playwright test -c tests/visual/playwright.config.ts --reporter=list
// ESTUDIO_QA_OUT=<carpeta> guarda además una captura por estado y hallazgos.json.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installNetwork } from './support/mocks';
import { prepareContext, settle, waitRendered } from './support/stabilize';
import type { Role } from './support/data';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const OUT = process.env.ESTUDIO_QA_OUT;
const STUDIO = '/estudio/catalogo';
const PROPUESTA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03';

const WIDTHS = {
  '390': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true },
  '768': { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, hasTouch: true },
  '1024': { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  '1280': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '1440': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  zoom200: { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }
} as const;

const openEditor = async (page: Page) => {
  await page.locator('a[aria-label^="Editar "]').nth(1).click();
  await page.waitForSelector('.editor__head');
};
const pickRows = async (page: Page) => {
  const boxes = page.locator('tbody input[type=checkbox]');
  await boxes.nth(0).check({ force: true });
  await boxes.nth(1).check({ force: true });
  await page.waitForSelector('.selection-bar');
};

const SCREENS: Array<{ id: string; url: string; role?: Role; setup?: (page: Page) => Promise<void> }> = [
  { id: 'catalogo', url: STUDIO },
  { id: 'lote', url: STUDIO, setup: pickRows },
  { id: 'diccionarios', url: '/estudio/diccionarios' },
  { id: 'propuestas', url: `/estudio/propuestas?propuesta=${PROPUESTA}` },
  { id: 'propuesta-editor', url: `/estudio/propuestas?editar=${PROPUESTA}` },
  { id: 'reportes', url: '/estudio/reportes?reporte=r1' },
  { id: 'editor', url: STUDIO, setup: openEditor },
  { id: 'colab-propuesta-editor', url: `/estudio/propuestas?editar=${PROPUESTA}`, role: 'colaborador' }
];

/** Todo lo medible en la página: ancho, nombres, contraste y texto visible. */
function measure() {
  const vw = document.documentElement.clientWidth;
  const visible = (el: Element) => (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) && !!el.getClientRects().length;
  const describe = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')}`;

  const inScroller = (el: Element) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return n;
    }
    return null;
  };
  const offenders: string[] = [];
  const scrollers = new Set<string>();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.sr-only')) continue;
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) scrollers.add(describe(el));
    const interactive = el.matches('a[href], button, input, select, textarea, [tabindex="0"]');
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!interactive && !ownText) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && (r.left < -1 || r.right > vw + 1) && !inScroller(el)) offenders.push(`${describe(el)} ${Math.round(r.left)}→${Math.round(r.right)}`);
  }

  const accName = (el: Element): string => {
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) return labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    if (el.matches('input, select, textarea')) {
      const input = el as HTMLInputElement;
      const text = [...(input.labels ?? [])].map((l) => l.textContent).join(' ').trim();
      return text || input.placeholder || el.getAttribute('title') || '';
    }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    return (clone.textContent ?? '').trim() || [...el.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt')).join(' ').trim() || el.getAttribute('title') || '';
  };
  const unnamed: string[] = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=tab], [role=radio], [role=checkbox]')) {
    if (visible(el) && !accName(el)) unnamed.push(describe(el));
  }
  // Iconos informativos: un svg visible, sin nombre y que no está dentro de algo con nombre.
  const looseIcons: string[] = [];
  for (const svg of document.querySelectorAll('svg')) {
    if (!visible(svg) || svg.closest('[aria-hidden="true"]') || svg.getAttribute('aria-hidden') === 'true') continue;
    if (!svg.getAttribute('aria-label') && !svg.querySelector('title')) looseIcons.push(describe(svg.parentElement!));
  }

  // Marcas con tooltip: span/abbr con title fuera de un control.
  const marks: string[] = [];
  for (const el of document.querySelectorAll('[title]')) {
    if (!visible(el) || el.matches('a, button, input, select, textarea, iframe, img')) continue;
    const sr = el.querySelector('.sr-only');
    const desc = el.getAttribute('aria-describedby');
    marks.push(`${desc ? 'desc' : sr ? 'sr' : el.getAttribute('aria-label') ? 'label' : 'SIN'} · ${describe(el)} · ${(el.textContent ?? '').trim().slice(0, 24)} · ${el.getAttribute('title')!.slice(0, 40)}`);
  }

  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const over = (f: { r: number; g: number; b: number; a: number }, b: { r: number; g: number; b: number; a: number }) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c: { r: number; g: number; b: number }) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const background = (el: Element) => {
    const layers: { r: number; g: number; b: number; a: number }[] = [];
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      opacity *= Number(s.opacity);
      if (s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) base = over(layer, base);
    return { base, opacity };
  };
  const contrast: string[] = [];
  const texts = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent!.trim();
    const el = node.parentElement!;
    if (!text || !visible(el) || el.closest('.sr-only, script, style, header[role=banner]')) continue;
    texts.add(text.slice(0, 120));
    const bg = background(el);
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!bg || !fg) continue;
    const c = over({ ...fg, a: fg.a * bg.opacity }, bg.base);
    const l1 = lum(c), l2 = lum(bg.base);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const disabled = !!el.closest('[disabled], [aria-disabled="true"]');
    if (ratio < (large ? 3 : 4.5) && !disabled) contrast.push(`${ratio.toFixed(2)} · ${describe(el)} · ${text.slice(0, 30)}`);
  }

  const truncated: string[] = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.sr-only')) continue;
    const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis' && !el.matches('.col-action, .col-check') && el.scrollWidth > el.clientWidth + 1 && !(el.getAttribute('title') || el.closest('[title]'))) truncated.push(`${describe(el)} · ${(el.textContent ?? '').trim().slice(0, 30)}`);
  }

  const targets: string[] = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && (r.width < 24 || r.height < 24) && !el.matches('input[type=checkbox], input[type=radio]')) targets.push(`${Math.round(r.width)}×${Math.round(r.height)} · ${describe(el)} · ${accName(el).slice(0, 24)}`);
  }

  // Lo que nunca puede cortarse: el estado y las señales de la fila, y la fecha del editor.
  const clipped: string[] = [];
  for (const el of document.querySelectorAll('td.col-status, td.col-signals, td.col-date')) {
    if (visible(el) && el.scrollWidth > el.clientWidth + 1) clipped.push(`${describe(el)} · ${el.scrollWidth}/${el.clientWidth}`);
  }
  // Mide la fecha con el mismo ancho de texto de su input: dd/mm/aaaa + el icono del calendario.
  for (const el of document.querySelectorAll<HTMLInputElement>('input[type=date]')) {
    if (visible(el) && el.getBoundingClientRect().width < 150) clipped.push(`fecha ${Math.round(el.getBoundingClientRect().width)}`);
  }
  // Controles con tooltip que explica algo: la descripción debe llegar por aria-describedby.
  const described: string[] = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea')) {
    const title = el.getAttribute('title');
    if (visible(el) && title && title !== accName(el) && !el.getAttribute('aria-describedby')) described.push(`${describe(el)} · ${accName(el).slice(0, 24)} · ${title.slice(0, 40)}`);
  }

  return {
    clipped, described: [...new Set(described)],
    page: { scroll: document.documentElement.scrollWidth, client: vw, bodyScroll: document.body.scrollWidth },
    offenders: offenders.slice(0, 12), scrollers: [...scrollers], unnamed, looseIcons: [...new Set(looseIcons)],
    marks: [...new Set(marks)], contrast: [...new Set(contrast)], truncated: [...new Set(truncated)], targets: [...new Set(targets)], texts: [...texts]
  };
}

for (const [width, device] of Object.entries(WIDTHS)) {
  for (const screen of SCREENS) {
    // Bajo 768 el Catálogo es de consulta: sin selección ni lote (E07, U15).
    if (screen.id === 'lote' && device.viewport.width < 768) continue;
    test(`${width} · ${screen.id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...device, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light', reducedMotion: 'reduce' });
      await prepareContext(ctx, {});
      await installNetwork(ctx, BASE, screen.role ?? 'admin');
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + screen.url, { waitUntil: 'networkidle' });
        await waitRendered(page);
        if (screen.setup) await screen.setup(page);
        await settle(page);
        await waitRendered(page);
        const m = await page.evaluate(measure);
        if (OUT) {
          fs.mkdirSync(OUT, { recursive: true });
          fs.writeFileSync(path.join(OUT, `${width}-${screen.id}.json`), JSON.stringify(m, null, 1));
          await page.screenshot({ path: path.join(OUT, `${width}-${screen.id}.png`), fullPage: true });
        }
        expect(m.page.scroll, 'scroll horizontal de la página').toBeLessThanOrEqual(m.page.client + 1);
        expect(m.offenders, 'elementos fuera del ancho').toEqual([]);
        expect(m.unnamed, 'controles sin nombre accesible').toEqual([]);
        expect(m.contrast, 'contraste').toEqual([]);
        expect(m.clipped, 'estado, señales o fecha cortados').toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
}
