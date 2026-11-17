#!/usr/bin/env node
// U34: contraste AA del texto sobre la cenefa con las portadas reales de staging.
//   node scripts/u34-contraste-staging.mjs http://127.0.0.1:5175 [artistas=80] [sellos=30]
// Solo lectura: lista artistas y sellos por la API pública (clave publicable), abre cada ficha en la app
// local y mide, sobre los píxeles reales de la cenefa (con el texto oculto), el contraste de cada texto
// contra su fondo. Imprime los peores casos y escribe tests/visual/results/u34-contraste-staging.json.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5175';
const N_ARTISTAS = Number(process.argv[3] ?? 80);
const N_SELLOS = Number(process.argv[4] ?? 30);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
if (env.VITE_SUPABASE_URL.includes('ewntlvugbopokdrvnwvg')) throw new Error('Es producción: abortado.');
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(BASE).hostname)) throw new Error('La app debe ser local.');

async function rest(query) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${query}`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
  if (!res.ok) throw new Error(`REST ${res.status}`);
  return res.json();
}
// Una muestra repartida por todo el catálogo (cada k-ésimo), para no sesgar por fecha.
const filas = await rest('catalog_releases?select=slug,cover,label,primary_artists&cover=not.is.null&limit=3000');
const artistas = new Map(), sellos = new Map();
for (const f of filas) {
  for (const a of f.primary_artists ?? []) if (a.slug && !artistas.has(a.slug)) artistas.set(a.slug, a.name);
  if (f.label && f.label !== 'Independiente') sellos.set(f.label, f.label);
}
const slug = (n) => String(n ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const repartir = (lista, n) => lista.filter((_, i) => i % Math.max(1, Math.floor(lista.length / n)) === 0).slice(0, n);
// Los sellos tienen slug propio: se leen aparte.
const sellosFilas = await rest('labels?select=slug,name&limit=2000').catch(() => []);
const rutas = process.env.RUTAS_ARCHIVO ? fs.readFileSync(process.env.RUTAS_ARCHIVO, 'utf8').split('\n').filter(Boolean) : [
  ...repartir([...artistas.keys()], N_ARTISTAS).map((s) => `/artista/${s}`),
  ...repartir(sellosFilas.map((l) => slug(l.name)).filter((x) => x && x !== 'independiente'), N_SELLOS).map((s) => `/sello/${s}`)
];
console.log(`${rutas.length} fichas (de ${artistas.size} artistas y ${sellosFilas.length} sellos)`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'es-CO' });
await ctx.addInitScript(() => { try { sessionStorage.setItem('discotica:welcome:handled:v1', '1'); } catch {} });
const resultados = [];
const salida = path.join(ROOT, `tests/visual/results/u34-contraste-staging${process.env.RUTAS_ARCHIVO ? '-tras-arreglo' : N_ARTISTAS ? '' : '-sellos'}.json`);

async function medir(page, ruta) {
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ficha-cabeza .ui-cenefa__superficie--lista, .ficha-cabeza .ui-cenefa__huella', { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
  const reunidos = await page.evaluate(() => {
    const cen = document.querySelector('.ficha-cabeza .ui-cenefa');
    if (!cen) return null;
    const cr = cen.getBoundingClientRect();
    const textos = [];
    for (const el of cen.parentElement.querySelectorAll('*')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only')) continue;
      const propio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ').trim();
      if (!propio) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2 || r.right < cr.left || r.left > cr.right || r.bottom < cr.top || r.top > cr.bottom) continue;
        const s = getComputedStyle(el);
        textos.push({ texto: propio.slice(0, 36), x: r.left, y: r.top, w: r.width, h: r.height, color: s.color, size: parseFloat(s.fontSize), weight: Number(s.fontWeight) });
      }
    }
    const portada = cen.querySelector('img')?.getAttribute('src') ?? null;
    return { clip: { x: cr.left, y: cr.top, width: cr.width, height: Math.min(cr.height, innerHeight - cr.top) }, textos, portada };
  });
  if (!reunidos) return;
  await page.addStyleTag({ content: `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } svg { visibility: hidden !important; }` });
  const png = await page.screenshot({ clip: reunidos.clip });
  const medidas = await page.evaluate(async ({ b64, clip, textos }) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const c = cv.getContext('2d');
    c.drawImage(bmp, 0, 0);
    const canal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    return textos.map((t) => {
      const m = t.color.match(/[\d.]+/g).map(Number);
      const a = m[3] ?? 1;
      const x = Math.max(0, Math.floor(t.x - clip.x)), y = Math.max(0, Math.floor(t.y - clip.y));
      const w = Math.min(bmp.width - x, Math.ceil(t.w)), h = Math.min(bmp.height - y, Math.ceil(t.h));
      if (w < 1 || h < 1) return null;
      const d = c.getImageData(x, y, w, h).data;
      const rz = [];
      for (let i = 0; i < d.length; i += 4) {
        const fr = m[0] * a + d[i] * (1 - a), fg = m[1] * a + d[i + 1] * (1 - a), fb = m[2] * a + d[i + 2] * (1 - a);
        const l1 = lum(fr, fg, fb), l2 = lum(d[i], d[i + 1], d[i + 2]);
        rz.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      rz.sort((p, q) => p - q);
      return { texto: t.texto, size: t.size, weight: t.weight, p2: rz[Math.floor(rz.length * 0.02)], min: rz[0] };
    });
  }, { b64: png.toString('base64'), clip: reunidos.clip, textos: reunidos.textos });
  for (const m of medidas.filter(Boolean)) {
    const grande = m.size >= 24 || (m.size >= 18.66 && m.weight >= 700);
    resultados.push({ ruta, portada: reunidos.portada, ...m, p2: Number(m.p2.toFixed(2)), min: Number(m.min.toFixed(2)), umbral: grande ? 3 : 4.5 });
  }
}

const page = await ctx.newPage();
for (const ruta of rutas) {
  try { await medir(page, ruta); } catch (e) { console.log(`  ${ruta}: ${String(e.message).split('\n')[0]}`); }
}
await browser.close();

fs.mkdirSync(path.join(ROOT, 'tests/visual/results'), { recursive: true });
fs.writeFileSync(salida, JSON.stringify(resultados, null, 1));
const peores = [...resultados].sort((a, b) => a.p2 - b.p2).slice(0, 12);
const bajos = resultados.filter((r) => r.p2 < r.umbral);
console.log(`${resultados.length} medidas en ${new Set(resultados.map((r) => r.ruta)).size} fichas; bajo el umbral (p2): ${bajos.length}`);
for (const r of peores) console.log(`  ${r.p2} (mín ${r.min}) / ${r.umbral} · ${r.ruta} · ${r.size}px/${r.weight} · «${r.texto}»`);
