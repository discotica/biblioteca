// Comprobaciones de interfaz compartidas por las pruebas de QA (anchos, U25, U34).
// Todas corren dentro de la página y devuelven la lista de hallazgos (vacía = bien).
import type { Page } from '@playwright/test';

/** Elementos con texto o interactivos que se salen del viewport en horizontal, fuera de un contenedor con scroll propio. */
export const horizontalOffenders = (page: Page) =>
  page.evaluate(() => {
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

/** Palabras cortadas por la mitad: un texto cuya palabra más ancha no cabe en su caja y se parte. */
export const brokenWords = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('h1, h2, h3, p, a, button, li, dt, dd, label, span')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only')) continue;
      const s = getComputedStyle(el);
      if (s.display === 'inline' || s.overflowWrap === 'normal' && s.wordBreak === 'normal') continue;
      if (!/(anywhere|break-word)/.test(s.overflowWrap) && s.wordBreak !== 'break-all') continue;
      // Solo si hay una palabra más ancha que la caja de contenido.
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ');
      const limit = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      if (!own.trim() || limit <= 0) continue;
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${s.font};letter-spacing:${s.letterSpacing};text-transform:${s.textTransform}`;
      document.body.appendChild(probe);
      for (const word of own.split(/\s+/).filter(Boolean)) {
        probe.textContent = word;
        if (probe.getBoundingClientRect().width > limit + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${word}»`);
      }
      probe.remove();
    }
    return [...new Set(out)].slice(0, 8);
  });

/** Controles visibles sin nombre accesible (aria-label, aria-labelledby, label, texto, alt o title). */
export const unnamedControls = (page: Page) =>
  page.evaluate(() => {
    const textOf = (el: Element): string => {
      if (el.getAttribute('aria-hidden') === 'true') return '';
      if (el instanceof HTMLImageElement) return el.alt;
      return [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent ?? '' : n.nodeType === 1 ? textOf(n as Element) : '')).join('');
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="combobox"], [role="menuitem"], [role="tab"]')) {
      if (!el.checkVisibility?.() && !(el instanceof HTMLInputElement)) continue;
      if (el.closest('[aria-hidden="true"]')) continue; // duplicado decorativo fuera del árbol de accesibilidad
      const labelled = el.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join('');
      const labels = 'labels' in el ? [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? '').join('') : '';
      const name = (el.getAttribute('aria-label') || labelled || labels || textOf(el) || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      if (!name) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')}`);
    }
    return out;
  });

/** SVG de icono visible, suelto o dentro de un control, sin nombre propio ni texto del control que lo nombre. */
export const unnamedIcons = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const svg of document.querySelectorAll<SVGElement>('svg')) {
      if (!(svg as unknown as HTMLElement).checkVisibility?.()) continue;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (svg.getAttribute('aria-hidden') === 'true' || svg.closest('[aria-hidden="true"]')) continue;
      if (svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby') || svg.querySelector('title')) continue;
      if (svg.getAttribute('role') === 'img') {
        out.push(`svg role=img sin nombre «${(svg.parentElement?.textContent ?? '').trim().slice(0, 24)}»`);
        continue;
      }
      // Un icono sin aria-hidden dentro de un control con nombre se lee dos veces o nada: se pide ocultarlo.
      out.push(`svg sin aria-hidden en ${svg.parentElement?.tagName.toLowerCase()}.${[...(svg.parentElement?.classList ?? [])].filter((c) => !c.startsWith('svelte-')).join('.')}`);
    }
    return [...new Set(out)].slice(0, 10);
  });

/** Texto visible con contraste menor de 4,5:1 (3:1 si es grande) sobre su fondo real. Omite lo que está sobre una imagen o un degradado. */
export const lowContrast = (page: Page) =>
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
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only, [disabled], [aria-disabled="true"], .ui-cenefa, .ficha-cabeza, .perfil-cabeza')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      const s = getComputedStyle(el);
      if (s.backgroundImage !== 'none') continue;
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
export async function focusWithoutRing(page: Page, steps = 25) {
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
      if (el.tagName === 'IFRAME') return null; // reproductores de terceros: el foco lo dibuja el reproductor
      const wrapper = el.closest('.ui-field, .ui-combobox, label, .busqueda-input-row');
      if (seen(el) || seen(el, '::after') || seen(el, '::before') || (wrapper && seen(wrapper))) return null;
      return `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}»`;
    });
    if (hit) out.push(hit);
  }
  return [...new Set(out)];
}
