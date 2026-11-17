#!/usr/bin/env node
// U34: recorrido en staging con la app local (vite dev) apuntando a staging por .env.local.
//   npx vite dev --port 5175 --strictPort &
//   node scripts/u34-recorrido-staging.mjs http://localhost:5175 [visitante|nuevo|comunidad|colaborador|admin ...]
//
// - Visitante: sin sesión. Usuario nuevo: alta completa con un alias del buzón de pruebas y el enlace de
//   confirmación leído de la base en solo lectura. Comunidad, colaborador y admin: las cuentas de pruebas
//   de .env.local (nunca se imprimen las contraseñas).
// - Solo lectura salvo el alta de la cuenta nueva y su confirmación. No guarda formularios ni cierra
//   la sesión de las cuentas fijas (el cierre global de Supabase invalidaría sus otras sesiones).
// - Aborta si la URL de Supabase es la de producción o si la app no es local.
// Capturas e informe: docs/modernizacion/capturas-u34/staging/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.argv[2] ?? 'http://localhost:5175';
const QUE = process.argv.slice(3).length ? process.argv.slice(3) : ['visitante', 'nuevo', 'comunidad', 'colaborador', 'admin'];
const OUT = path.join(ROOT, 'docs/modernizacion/capturas-u34/staging');
const PROD_REF = 'ewntlvugbopokdrvnwvg';
const PSQL = '/opt/homebrew/opt/libpq/bin/psql';

// ---------- entorno ----------
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
if (!new URL(BASE).hostname.match(/^(localhost|127\.0\.0\.1)$/)) throw new Error('La app debe ser local.');
if (!env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL.includes(PROD_REF)) throw new Error('VITE_SUPABASE_URL no es staging: abortado.');
if ((env.E06_STAGING_DATABASE_URL ?? '').includes(PROD_REF)) throw new Error('E06_STAGING_DATABASE_URL apunta a producción: abortado.');
fs.mkdirSync(OUT, { recursive: true });

const redact = (text) => String(text).replace(/postgres(ql)?:\/\/[^\s'"]+/g, '<url>').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>');
function sqlLectura(consulta) {
  try {
    return execFileSync(PSQL, [env.E06_STAGING_DATABASE_URL, '-X', '-q', '-t', '-A', '-c', `begin read only; ${consulta}; rollback;`], { encoding: 'utf8', timeout: 60_000 }).trim();
  } catch (error) {
    throw new Error(redact(error.message).split('\n')[0]);
  }
}

// ---------- comprobaciones ----------
const hallazgos = [];
const nota = (rol, vista, tipo, detalle) => hallazgos.push({ rol, vista, tipo, detalle });

async function revisar(page, rol, vista, { captura = true } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const fuera = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.checkVisibility?.() || el.closest('[aria-hidden="true"], .sr-only')) continue;
      const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!propio && !el.matches('a[href], button, input, select, textarea')) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      let recorta = false;
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowX) && n.scrollWidth > n.clientWidth + 1) { recorta = true; break; }
      }
      if ((b.left < -1 || b.right > vw + 1) && !recorta) fuera.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} «${(el.textContent || '').trim().slice(0, 24)}»`);
    }
    const sinNombre = [];
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="menuitem"]')) {
      if (el.closest('[aria-hidden="true"]')) continue;
      if (!el.checkVisibility?.() && !(el instanceof HTMLInputElement)) continue;
      const lab = el.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join('') ?? '';
      const labels = 'labels' in el ? [...(el.labels ?? [])].map((l) => l.textContent ?? '').join('') : '';
      const nombre = (el.getAttribute('aria-label') || lab || labels || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.querySelector('img')?.alt || '').trim();
      if (!nombre) sinNombre.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')}`);
    }
    return { scroll: document.documentElement.scrollWidth, client: vw, fuera: fuera.slice(0, 6), sinNombre: [...new Set(sinNombre)].slice(0, 6), titulo: document.title, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null };
  });
  if (r.scroll > r.client + 1) nota(rol, vista, 'desborde', `scroll horizontal ${r.scroll} > ${r.client}`);
  if (r.fuera.length) nota(rol, vista, 'fuera del ancho', r.fuera.join(' · '));
  if (r.sinNombre.length) nota(rol, vista, 'sin nombre', r.sinNombre.join(' · '));
  if (captura) await page.screenshot({ path: path.join(OUT, `${rol}-${vista}.png`) });
  return r;
}

function vigilar(page, rol, vistaActual) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = redact(m.text());
    if (/favicon|Failed to load resource: the server responded with a status of (404|400)|net::ERR_ABORTED|bcbits|spotify|soundcloud/i.test(t)) return;
    nota(rol, vistaActual(), 'consola', t.slice(0, 200));
  });
  page.on('pageerror', (e) => nota(rol, vistaActual(), 'excepción', redact(e.message).slice(0, 200)));
  page.on('response', (res) => {
    const u = res.url();
    if (res.status() >= 500 && (u.startsWith(env.VITE_SUPABASE_URL) || u.startsWith(BASE))) nota(rol, vistaActual(), `HTTP ${res.status()}`, redact(u.replace(env.VITE_SUPABASE_URL, '<supabase>')).slice(0, 160));
  });
}

async function nuevoContexto(browser, rol, ancho) {
  const movil = ancho < 768;
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: movil ? 844 : 900 },
    deviceScaleFactor: movil ? 2 : 1,
    hasTouch: movil,
    isMobile: movil,
    locale: 'es-CO',
    timezoneId: 'America/Bogota'
  });
  // La bienvenida del inicio ya atendida: no es lo que se recorre aquí.
  await ctx.addInitScript(() => { try { sessionStorage.setItem('discotica:welcome:handled:v1', '1'); } catch {} });
  const page = await ctx.newPage();
  const estado = { vista: 'inicio' };
  vigilar(page, `${rol}-${ancho}`, () => estado.vista);
  return { ctx, page, estado };
}

async function ir(page, estado, rol, vista, url, opciones) {
  estado.vista = vista;
  const res = await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  if (res && res.status() >= 400 && vista !== '404') nota(rol, vista, `HTTP ${res.status()}`, url);
  return revisar(page, rol, vista, opciones);
}

async function entrar(page, estado, rol, correo, clave, destino = '/') {
  estado.vista = 'entrar';
  await page.goto(`${BASE}/auth/login?redirect=${encodeURIComponent(destino)}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/Usuario o correo/).fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 20_000 });
}

async function abrirPanel(page, estado, rol, vista) {
  estado.vista = vista;
  const disparador = page.locator('.header-panel .ui-menu__trigger, .header-panel button').first();
  await disparador.click();
  await page.waitForSelector('[role=menu]');
  return revisar(page, rol, vista);
}

// ---------- recorridos ----------
const resultados = {};

async function visitante(browser) {
  for (const ancho of [1440, 390]) {
    const rol = 'visitante';
    const { ctx, page, estado } = await nuevoContexto(browser, rol, ancho);
    const tag = `${ancho}`;
    try {
      await ir(page, estado, rol, `${tag}-inicio`, '/');
      await page.waitForSelector('.resultados__grid a[href^="/lanzamiento/"], a[href^="/lanzamiento/"]', { timeout: 30_000 });
      await abrirPanel(page, estado, rol, `${tag}-panel`);
      await page.keyboard.press('Escape');
      const href = await page.locator('a[href^="/lanzamiento/"]').first().getAttribute('href');
      await ir(page, estado, rol, `${tag}-ficha`, href);
      const artista = await page.locator('a[href^="/artista/"]').first().getAttribute('href').catch(() => null);
      const sello = await page.locator('a[href^="/sello/"]').first().getAttribute('href').catch(() => null);
      if (artista) await ir(page, estado, rol, `${tag}-artista`, artista);
      if (sello) await ir(page, estado, rol, `${tag}-sello`, sello);
      await ir(page, estado, rol, `${tag}-entrar`, '/auth/login');
      await ir(page, estado, rol, `${tag}-registro`, '/auth/registro');
      await ir(page, estado, rol, `${tag}-recuperar`, '/auth/recuperar');
      await ir(page, estado, rol, `${tag}-manual`, '/manual');
      await ir(page, estado, rol, `${tag}-privacidad`, '/privacidad');
      await ir(page, estado, rol, `${tag}-404`, '/ruta-que-no-existe');
      // Rutas privadas sin sesión: llevan a Entrar y vuelven.
      for (const ruta of ['/mis-aportes', '/cuenta', '/mis-colecciones', '/sugerir', '/estudio/catalogo']) {
        estado.vista = `${tag}-guarda${ruta.replaceAll('/', '-')}`;
        await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        const destino = new URL(page.url());
        if (!destino.pathname.startsWith('/auth/login')) nota(rol, estado.vista, 'guarda', `sin sesión, ${ruta} dejó en ${destino.pathname}`);
      }
      // «Sugerir» sin sesión: va a Entrar con retorno.
      await ir(page, estado, rol, `${tag}-inicio-2`, '/', { captura: false });
      await page.getByRole('banner').getByRole('link', { name: 'Sugerir' }).click();
      await page.waitForURL('**/auth/login**');
      if (!/redirect=/.test(page.url())) nota(rol, `${tag}-sugerir`, 'guarda', 'Entrar sin retorno');
    } catch (e) {
      nota(rol, estado.vista, 'recorrido', redact(e.message).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }
}

async function nuevo(browser) {
  const rol = 'nuevo';
  const base = env.E21_STAGING_COMUNIDAD_EMAIL ?? '';
  const [local, dominio] = base.split('@');
  if (!local || !dominio) throw new Error('Falta E21_STAGING_COMUNIDAD_EMAIL para derivar el alias del buzón de pruebas.');
  const sello = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
  const correo = `${local.split('+')[0]}+u34-${sello}@${dominio}`;
  const usuario = `u34_qa_${sello}`;
  const clave = crypto.randomBytes(15).toString('base64url') + 'aA1';
  // Las credenciales de la cuenta nueva no entran al repositorio: van a una carpeta local (U34_SECRETOS o la temporal).
  const secretos = path.join(process.env.U34_SECRETOS ?? os.tmpdir(), 'u34-nuevo-usuario.txt');
  fs.writeFileSync(secretos, `usuario: ${usuario}\ncorreo: ${correo}\nclave: ${clave}\n`, { mode: 0o600 });

  const { ctx, page, estado } = await nuevoContexto(browser, rol, 1440);
  try {
    await ir(page, estado, rol, 'registro-1', '/auth/registro');
    await page.getByLabel('Correo', { exact: true }).fill(correo);
    await page.getByLabel('Contraseña', { exact: true }).fill(clave);
    await page.getByLabel('Repite la contraseña').fill(clave);
    await revisar(page, rol, 'registro-1-lleno');
    await page.getByRole('button', { name: 'Seguir' }).click();
    estado.vista = 'registro-2';
    await page.getByLabel('Usuario').fill(usuario);
    await page.getByText('Disponible').waitFor({ timeout: 20_000 });
    await revisar(page, rol, 'registro-2');
    await page.getByRole('button', { name: 'Seguir' }).click();
    estado.vista = 'registro-3';
    await page.getByLabel('Instagram').waitFor();
    await page.getByLabel(/Acepto la política/).check();
    await revisar(page, rol, 'registro-3');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL('**/auth/confirmar', { timeout: 30_000 });
    await revisar(page, rol, 'confirmar');
    const alta = await page.getByRole('link', { name: /Abrir Gmail/ }).count();
    if (!alta) nota(rol, 'confirmar', 'contenido', 'falta «Abrir Gmail»');

    // El enlace del correo, leído de la base (el buzón de pruebas no se abre desde aquí).
    let token = '';
    for (let i = 0; i < 10 && !token; i += 1) {
      token = sqlLectura(`select confirmation_token from auth.users where email = '${correo.replace(/'/g, "''")}'`);
      if (!token) await page.waitForTimeout(1500);
    }
    if (!token) throw new Error('Sin confirmation_token en auth.users: ¿confirmación de correo desactivada?');
    estado.vista = 'enlace-confirmacion';
    await page.goto(`${BASE}/auth/reset?token_hash=${token}&type=email`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.startsWith('/perfil/'), { timeout: 30_000 });
    resultados.nuevo = { aterrizaEn: new URL(page.url()).pathname.replace(usuario, '<usuario>'), query: new URL(page.url()).search };
    if (!page.url().includes('aviso=cuenta-confirmada')) nota(rol, 'enlace-confirmacion', 'flujo', `aterrizó en ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
    await revisar(page, rol, 'perfil-nuevo');
    await abrirPanel(page, estado, rol, 'panel');
    await page.keyboard.press('Escape');
    await ir(page, estado, rol, 'cuenta', '/cuenta');
    await ir(page, estado, rol, 'ajustes', '/cuenta/ajustes');
    await ir(page, estado, rol, 'mis-aportes', '/mis-aportes');
    await ir(page, estado, rol, 'sugerir', '/sugerir');
    await ir(page, estado, rol, 'reportar', '/reportar');
    await ir(page, estado, rol, 'mis-colecciones-redirige', '/mis-colecciones');
    if (!new URL(page.url()).pathname.startsWith('/perfil/')) nota(rol, 'mis-colecciones-redirige', 'flujo', `no redirigió al perfil: ${new URL(page.url()).pathname}`);
    // Salir (cuenta de prueba propia: aquí sí se cierra la sesión).
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('.header-panel .ui-menu__trigger').click();
    await page.getByRole('menuitem', { name: 'Salir' }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    estado.vista = 'tras-salir';
    await page.goto(BASE + '/mis-aportes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    if (!new URL(page.url()).pathname.startsWith('/auth/login')) nota(rol, 'tras-salir', 'guarda', 'tras Salir, /mis-aportes no pidió entrar');
    resultados.nuevo = { ...resultados.nuevo, usuario, correoAlias: correo.replace(/^[^+]+/, '…') };
  } catch (e) {
    nota(rol, estado.vista, 'recorrido', redact(e.message).split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

async function conSesion(browser, rol, ancho, correo, clave, recorrer) {
  const { ctx, page, estado } = await nuevoContexto(browser, rol, ancho);
  try {
    await entrar(page, estado, rol, correo, clave);
    await recorrer(page, estado, `${rol}`, ancho);
  } catch (e) {
    nota(`${rol}-${ancho}`, estado.vista, 'recorrido', redact(e.message).split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

const cuentas = {
  comunidad: [env.E21_STAGING_COMUNIDAD_EMAIL, env.E21_STAGING_COMUNIDAD_PASSWORD],
  colaborador: [env.E21_STAGING_COLAB_EMAIL, env.E21_STAGING_COLAB_PASSWORD],
  admin: [env.E07_STAGING_QA_EMAIL, env.E07_STAGING_QA_PASSWORD]
};

async function comunidad(browser) {
  const [c, k] = cuentas.comunidad;
  for (const ancho of [1440, 390]) {
    await conSesion(browser, 'comunidad', ancho, c, k, async (page, estado, rol) => {
      const t = `${ancho}`;
      await revisar(page, rol, `${t}-tras-entrar`);
      await abrirPanel(page, estado, rol, `${t}-panel`);
      await page.keyboard.press('Escape');
      const perfil = await page.locator('.header-panel .ui-menu__trigger').first().getAttribute('aria-label');
      const mis = await page.evaluate(() => null);
      void perfil; void mis;
      await ir(page, estado, rol, `${t}-mis-colecciones-redirige`, '/mis-colecciones');
      if (!new URL(page.url()).pathname.startsWith('/perfil/')) nota(`${rol}-${ancho}`, 'mis-colecciones', 'flujo', `no redirigió al perfil: ${new URL(page.url()).pathname}`);
      await page.waitForSelector('.perfil-grid, .perfil-crear', { timeout: 20_000 }).catch(() => nota(`${rol}-${ancho}`, `${t}-perfil`, 'contenido', 'sin cuadrícula del perfil'));
      await revisar(page, rol, `${t}-perfil`);
      if (!(await page.getByText('Mis aportes', { exact: false }).count())) nota(`${rol}-${ancho}`, `${t}-perfil`, 'contenido', 'no aparece el tile «Mis aportes» al dueño');
      await ir(page, estado, rol, `${t}-mis-aportes`, '/mis-aportes');
      await ir(page, estado, rol, `${t}-cuenta`, '/cuenta');
      await ir(page, estado, rol, `${t}-ajustes`, '/cuenta/ajustes');
      await ir(page, estado, rol, `${t}-sugerir`, '/sugerir');
      await ir(page, estado, rol, `${t}-reportar`, '/reportar');
      await ir(page, estado, rol, `${t}-estudio-guarda`, '/estudio/catalogo', { captura: false });
      if (new URL(page.url()).pathname.startsWith('/estudio')) nota(`${rol}-${ancho}`, 'estudio', 'guarda', 'la comunidad entró al Estudio');
      if (ancho === 1440) {
        await ir(page, estado, rol, `${t}-inicio`, '/', { captura: false });
        if (await page.getByRole('banner').getByRole('link', { name: 'Estudio' }).count()) nota(`${rol}-${ancho}`, 'inicio', 'guarda', 'la comunidad ve «Estudio» en la barra');
      }
    });
  }
}

async function equipo(browser, rol, rutas) {
  const [c, k] = cuentas[rol];
  await conSesion(browser, rol, 1440, c, k, async (page, estado) => {
    await revisar(page, rol, 'tras-entrar');
    const estudio = page.getByRole('banner').getByRole('link', { name: 'Estudio' });
    if (!(await estudio.count())) nota(rol, 'barra', 'contenido', 'falta «Estudio» en la barra');
    await abrirPanel(page, estado, rol, 'panel');
    await page.keyboard.press('Escape');
    await ir(page, estado, rol, 'perfil', '/mis-colecciones');
    await page.waitForSelector('.perfil-grid, .perfil-crear', { timeout: 20_000 }).catch(() => {});
    await revisar(page, rol, 'perfil');
    for (const [vista, ruta, ok] of rutas) {
      await ir(page, estado, rol, vista, ruta);
      const donde = new URL(page.url()).pathname;
      if (ok === 'entra' && !donde.startsWith('/estudio')) nota(rol, vista, 'guarda', `${ruta} no entró (${donde})`);
      if (ok === 'no-entra' && donde.startsWith('/estudio/' + vista.split('-')[1]) && (await page.locator('main h1, main [role="heading"]').count())) nota(rol, vista, 'guarda', `${ruta} accesible para ${rol}`);
    }
    await estado.vista;
    const volver = page.getByRole('banner').getByRole('link', { name: /Volver al catálogo/ });
    if (!(await volver.count())) nota(rol, 'estudio', 'contenido', 'dentro del Estudio falta «Volver al catálogo»');
  });
}

const browser = await chromium.launch();
try {
  for (const que of QUE) {
    console.log(`→ ${que}`);
    if (que === 'visitante') await visitante(browser);
    else if (que === 'nuevo') await nuevo(browser);
    else if (que === 'comunidad') await comunidad(browser);
    else if (que === 'colaborador') await equipo(browser, 'colaborador', [['estudio-propuestas', '/estudio/propuestas', 'entra'], ['estudio-reportes', '/estudio/reportes', 'entra']]);
    else if (que === 'admin') await equipo(browser, 'admin', [['estudio-catalogo', '/estudio/catalogo', 'entra'], ['estudio-propuestas', '/estudio/propuestas', 'entra'], ['estudio-reportes', '/estudio/reportes', 'entra'], ['estudio-diccionarios', '/estudio/diccionarios', 'entra']]);
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, `informe-${QUE.join('-')}.json`), JSON.stringify({ base: 'staging', resultados, hallazgos }, null, 1));
console.log(`Hallazgos: ${hallazgos.length}`);
for (const h of hallazgos) console.log(`  [${h.rol}] ${h.vista} · ${h.tipo} · ${h.detalle}`);
