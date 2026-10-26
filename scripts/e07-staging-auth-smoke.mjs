import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const localEnv = await readFile('.env.local', 'utf8');
const getEnv = (name) => process.env[name] ?? localEnv.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const publishableKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
const email = getEnv('E07_STAGING_QA_EMAIL');
const password = getEnv('E07_STAGING_QA_PASSWORD');
if (supabaseUrl !== 'https://hgocyrzhgohetfpzbmfs.supabase.co' || !publishableKey || !email || !password) {
  throw new Error('Staging QA configuration is incomplete.');
}

let server;
let browser;
async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch('http://127.0.0.1:4173/estudio/catalogo')).ok) return; } catch { /* wait for Vite */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Local QA server did not start.');
}

try {
  const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Staging QA login failed (${login.status}): ${await login.text()}`);
  const session = await login.json();
  const cookie = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{
    name: 'sb-hgocyrzhgohetfpzbmfs-auth-token', value: cookie, domain: '127.0.0.1', path: '/',
    httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/estudio/catalogo', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Catálogo' }).waitFor();
  const firstEdit = page.locator('button[aria-label^="Editar "]').first();
  await firstEdit.waitFor();
  const desktopNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (!desktopNoOverflow) throw new Error('Desktop console overflows horizontally.');
  await page.getByPlaceholder('Buscar por título, artista, sello o ID').fill('e07-qa-no-match');
  await page.getByText('No encontramos lanzamientos').waitFor();
  await page.getByPlaceholder('Buscar por título, artista, sello o ID').fill('');
  await firstEdit.waitFor();
  await firstEdit.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Vista de consulta. Abre esta ficha en desktop para editar.').waitFor();
  const mobileNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (!mobileNoOverflow) throw new Error('Mobile console overflows horizontally.');
  console.log(JSON.stringify({ project: 'hgocyrzhgohetfpzbmfs', authenticated_admin: true, direct_route: true, search: true, desktop_1440: true, mobile_390: true }));
} finally {
  await browser?.close().catch(() => undefined);
  server?.kill('SIGTERM');
}
