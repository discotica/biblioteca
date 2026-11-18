// Imagen genérica de la vista previa de enlaces (2026-11-17): el logo sobre el
// fondo del sitio, 1200 × 630 (la proporción que piden WhatsApp, iMessage y
// las tarjetas grandes). Se usa cuando la ficha no tiene portada.
// Uso: node scripts/vista-previa-imagen.mjs → static/img/vista-previa.png
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync('static/img/logo.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#0e0e0e;display:grid;place-items:center">
  <div style="width:520px">${logo.replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div>
</body></html>`);
await page.screenshot({ path: 'static/img/vista-previa.png' });
await browser.close();
