// U25: QA del Estudio a 390 px y al 200 % de zoom, con la misma red simulada que el censo.
// Sin scroll horizontal, cada control con nombre accesible, contraste AA del texto y foco visible.
// Guarda una captura de cada estado en docs/modernizacion/capturas-u25/.
//   VISUAL_SPEC=u25-estudio.spec.ts npx playwright test -c tests/visual/playwright.config.ts --reporter=list
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { installNetwork } from './support/mocks';
import { prepareContext, settle, waitRendered } from './support/stabilize';
import type { Role } from './support/data';

const BASE = `http://127.0.0.1:${process.env.VISUAL_PORT}`;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../docs/modernizacion/capturas-u25');

const MODES = {
  '390': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  zoom200: { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }
} as const;

const PROPUESTA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03';

const openEditor = async (page: Page) => {
  await page.locator('a[aria-label^="Editar "]').nth(1).click();
  await page.waitForSelector('.editor__head');
  await settle(page);
};

const SCREENS: Array<{ id: string; url: string; role: Role; setup?: (page: Page) => Promise<void> }> = [
  { id: 'catalogo', url: '/estudio/catalogo', role: 'admin' },
  { id: 'catalogo-editor', url: '/estudio/catalogo', role: 'admin', setup: openEditor },
  { id: 'propuestas', url: '/estudio/propuestas', role: 'admin' },
  { id: 'propuesta', url: `/estudio/propuestas?propuesta=${PROPUESTA}`, role: 'admin' },
  { id: 'propuesta-editor', url: `/estudio/propuestas?editar=${PROPUESTA}`, role: 'admin' },
  { id: 'propuesta-editor-colab', url: `/estudio/propuestas?editar=${PROPUESTA}`, role: 'colaborador' },
  { id: 'reportes', url: '/estudio/reportes', role: 'admin' },
  { id: 'reporte', url: '/estudio/reportes?reporte=r1', role: 'admin' },
  { id: 'diccionarios', url: '/estudio/diccionarios', role: 'admin' },
  { id: 'diccionarios-artistas', url: '/estudio/diccionarios?tipo=artistas', role: 'admin' }
];

/** Texto o controles que se salen del viewport fuera de un contenedor con scroll propio. */
const horizontalOffenders = (page: Page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsX = (el: Element) => {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
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
      if (r.width && r.height && (r.left < -1 || r.right > vw + 1) && !scrollsX(el)) {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}» ${Math.round(r.left)}→${Math.round(r.right)}`);
      }
    }
    return out.slice(0, 10);
  });

/** Controles visibles sin nombre accesible (aria-label, aria-labelledby, label, texto, alt o title). */
const unnamedControls = (page: Page) =>
  page.evaluate(() => {
    const textOf = (el: Element): string => {
      if (el.getAttribute('aria-hidden') === 'true') return '';
      if (el instanceof HTMLImageElement) return el.alt;
      return [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent ?? '' : n.nodeType === 1 ? textOf(n as Element) : '')).join('');
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="combobox"], [role="menuitem"], [role="tab"]')) {
      if (!el.checkVisibility?.() && !(el instanceof HTMLInputElement)) continue;
      const labelled = el.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join('');
      const labels = 'labels' in el ? [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? '').join('') : '';
      const name = (el.getAttribute('aria-label') || labelled || labels || textOf(el) || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      if (!name) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')}`);
    }
    return out;
  });

/** Texto visible con contraste menor de 4,5:1 (3:1 si es grande) sobre su fondo real. */
const lowContrast = (page: Page) =>
  page.evaluate(() => {
    const parse = (value: string) => {
      const n = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
    };
    const over = (top: ReturnType<typeof parse>, under: ReturnType<typeof parse>) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1
    });
    const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const lum = (c: ReturnType<typeof parse>) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const backdrop = (el: Element) => {
      const layers: ReturnType<typeof parse>[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c.a > 0) layers.push(c);
        if (c.a === 1) break;
      }
      return layers.reduceRight((under, top) => over(top, under), { r: 14, g: 14, b: 14, a: 1 });
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only, [disabled], [aria-disabled="true"]')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      const s = getComputedStyle(el);
      if (getComputedStyle(el).backgroundImage !== 'none') continue;
      const bg = backdrop(el);
      const fg = over(parse(s.color), bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${el.textContent!.trim().slice(0, 28)}»`);
    }
    return [...new Set(out)].slice(0, 12);
  });

/** Recorre con Tab los primeros controles y devuelve los que no muestran foco visible. */
async function focusWithoutRing(page: Page, steps = 25) {
  const out: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const seen = (node: Element, pseudo?: string) => {
        const s = getComputedStyle(node, pseudo);
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      };
      const wrapper = el.closest('.ui-field, .ui-combobox, label');
      if (seen(el) || seen(el, '::after') || seen(el, '::before') || (wrapper && seen(wrapper))) return null;
      return `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}»`;
    });
    if (hit) out.push(hit);
  }
  return [...new Set(out)];
}

for (const [mode, device] of Object.entries(MODES)) {
  for (const screen of SCREENS) {
    test(`${mode} · ${screen.id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...device, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'dark', reducedMotion: 'reduce' });
      await prepareContext(ctx, {});
      await installNetwork(ctx, BASE, screen.role);
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + screen.url, { waitUntil: 'networkidle' });
        await screen.setup?.(page);
        await waitRendered(page);

        const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect.soft(widths.scroll, 'scroll horizontal de la página').toBeLessThanOrEqual(widths.client + 1);
        expect.soft(await horizontalOffenders(page), 'elementos fuera del ancho').toEqual([]);
        expect.soft(await unnamedControls(page), 'controles sin nombre').toEqual([]);
        expect.soft(await lowContrast(page), 'contraste bajo').toEqual([]);
        await page.screenshot({ path: path.join(OUT, `${mode}-${screen.id}.png`) });
        if (mode === 'zoom200') expect.soft(await focusWithoutRing(page), 'foco sin indicador').toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
}

test('SplitButton de aceptar: se abre, recorre y cierra con teclado y devuelve el foco', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
  await prepareContext(ctx, {});
  await installNetwork(ctx, BASE, 'admin');
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/estudio/propuestas?propuesta=${PROPUESTA}`, { waitUntil: 'networkidle' });
    const trigger = page.getByRole('button', { name: 'Más formas de aceptar' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const item = page.getByRole('menuitem', { name: 'Aceptar como borrador…' });
    await expect(item).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(item).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Aceptar como borrador' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});
