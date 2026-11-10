#!/usr/bin/env node
// Mide CampoPulso a 1440×900 en Chromium con CPU ×4 (U27, plan de dirección de
// arte §4). Traza 6 s en reposo y 6 s con el ratón en un ocho, y resume la
// duración de FireAnimationFrame por hilo (principal y worker).
//
//   npm run build && npx vite preview --port 4173
//   node scripts/medir-campo-pulso.mjs http://localhost:4173 2
//
// Resultados y método: docs/producto/u27-motor-generativo-2026-11-10.md
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const dpr = Number(process.argv[3] ?? 2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }));
await page.goto(`${base}/lab?campo=pantalla`, { waitUntil: 'networkidle' });
await page.waitForSelector('.lab__u27-campo--pantalla canvas');
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.waitForTimeout(1500);

async function fase(nombre, mover) {
  const eventos = [];
  cdp.on('Tracing.dataCollected', (e) => eventos.push(...e.value));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  const fin = Date.now() + 6000;
  let i = 0;
  while (Date.now() < fin) {
    if (mover) {
      const f = (i++ % 240) / 240;
      await page.mouse.move(720 + 520 * Math.cos(f * 6.283), 450 + 300 * Math.sin(f * 12.566), { steps: 2 });
    } else await page.waitForTimeout(50);
  }
  const listo = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await listo;
  cdp.removeAllListeners('Tracing.dataCollected');
  const hilos = new Map(eventos.filter((e) => e.ph === 'M' && e.name === 'thread_name').map((e) => [`${e.pid}:${e.tid}`, e.args.name]));
  const resumen = (filtro) => {
    const d = eventos.filter((e) => e.name === 'FireAnimationFrame' && e.ph === 'X' && filtro(hilos.get(`${e.pid}:${e.tid}`) ?? '')).map((e) => e.dur / 1000).sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))];
    return { cuadros: d.length, mediana: q(0.5)?.toFixed(2), p95: q(0.95)?.toFixed(2), max: d.at(-1)?.toFixed(2) };
  };
  // Tareas largas del hilo principal (≥ 50 ms) durante la fase.
  const largas = eventos.filter((e) => e.name === 'RunTask' && e.ph === 'X' && hilos.get(`${e.pid}:${e.tid}`) === 'CrRendererMain' && e.dur >= 50000).length;
  const ema = Number(await page.locator('.lab__u27-campo--pantalla').getAttribute('data-ms'));
  return { nombre, dpr, principal: resumen((n) => n === 'CrRendererMain'), trabajador: resumen((n) => /Worker/i.test(n)), emaTrabajador: ema.toFixed(2), tareasLargas: largas };
}

const reposo = await fase('reposo', false);
const cursor = await fase('cursor', true);
console.log(JSON.stringify([reposo, cursor], null, 1));
await browser.close();
