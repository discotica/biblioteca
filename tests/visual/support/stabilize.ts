// Determinismo de cada página: reloj fijo, azar con semilla, bienvenida ya
// atendida y esperas por estado (red simulada en reposo, fuentes, imágenes y
// reproductores cargados) en lugar de tiempos fijos.
import type { BrowserContext, Page } from '@playwright/test';
import { FIXED_TIME } from './data';
import { pendingRequests } from './mocks';

export async function prepareContext(ctx: BrowserContext, opts: { fresh?: boolean }) {
  await ctx.addInitScript(({ fresh, fixedTime }) => {
    // Reloj fijo solo para Date: temporizadores y requestAnimationFrame siguen reales
    // (page.clock los falsea y la app depende de rAF para medir y pintar).
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor> | []) {
        if (args.length === 0) super(fixedTime);
        else super(...(args as [string | number | Date]));
      }
      static now() { return fixedTime; }
    }
    globalThis.Date = FixedDate as DateConstructor;

    // Math.random con semilla fija (mulberry32): "Aleatorizar" y cualquier orden al azar se repiten.
    let seed = 0x5eed1003;
    Math.random = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    if (!fresh) {
      try { sessionStorage.setItem('discotica:welcome:handled:v1', '1'); } catch {}
    }
  }, { fresh: Boolean(opts.fresh), fixedTime: FIXED_TIME.getTime() });
}

/** Espera a que no haya peticiones simuladas en curso durante dos frames seguidos. */
export async function waitNetworkIdle(page: Page, timeout = 15_000) {
  const ctx = page.context();
  const deadline = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < deadline) {
    if (pendingRequests(ctx) === 0) {
      quiet++;
      if (quiet >= 3) return;
    } else quiet = 0;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

/** Fuentes listas, imágenes visibles decodificadas y reproductores resueltos. */
export async function waitRendered(page: Page) {
  await waitNetworkIdle(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = [...document.images].filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && img.loading !== 'lazy';
    });
    await Promise.all(visible.map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }))));
  });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-release-player]')]
    .every((el) => el.getAttribute('data-player-loaded') === 'true' || el.getAttribute('data-player-failed') === 'true'), null, { timeout: 15_000 })
    .catch(() => {});
  await waitNoLoadingText(page);
  await waitNetworkIdle(page);
}

/** Ningún indicador visible de carga ("Cargando…", "Comprobando acceso…"). */
export async function waitNoLoadingText(page: Page) {
  await page.waitForFunction(() => ![...document.querySelectorAll('.loader, .loading, .loading-table, .gate, .estado, .vacio, [role="status"]')]
    .some((el) => {
      // Solo lo visible: las regiones para lectores de pantalla (1×1 px) no cuentan.
      const rect = el.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2 && el.checkVisibility() && /^\s*(Cargando|Comprobando)/i.test(el.textContent ?? '');
    }), null, { timeout: 20_000 })
    .catch(() => {});
}

/** Después de una interacción: red simulada en reposo y dos frames pintados. */
export async function settle(page: Page) {
  await waitNetworkIdle(page);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * El sitio no carga Work Sans (no hay @font-face ni enlace): solo se ve si está
 * instalada en el sistema. Se detecta midiendo contra una fuente de respaldo.
 */
export async function hasWorkSans(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const sample = 'Discótica lanzamientos 0123456789';
    return ['monospace', 'serif'].every((fallback) => {
      ctx.font = `16px ${fallback}`;
      const plain = ctx.measureText(sample).width;
      ctx.font = `16px "Work Sans", ${fallback}`;
      return ctx.measureText(sample).width !== plain;
    });
  });
}

/**
 * Página completa: la captura extiende el viewport y las imágenes `lazy` empiezan
 * a cargar a mitad de la comparación. Se cargan antes, como las vería alguien que
 * recorre la página.
 */
export async function loadLazyImages(page: Page) {
  await page.evaluate(async () => {
    const lazy = [...document.querySelectorAll('img[loading="lazy"]')] as HTMLImageElement[];
    for (const img of lazy) img.loading = 'eager';
    await Promise.all(lazy.map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }))));
  });
  await waitNetworkIdle(page);
}
