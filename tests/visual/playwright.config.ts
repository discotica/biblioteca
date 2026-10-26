// Suite de regresión visual (etapa U1). Uso y regeneración en tests/visual/README.md.
//   npm run visual:capture   reescribe la línea base
//   npm run visual:compare   compara contra la línea base y escribe el informe
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { SUPABASE_KEY, SUPABASE_URL } from './support/data';

const here = path.dirname(fileURLToPath(import.meta.url));

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

// El proceso principal elige el puerto y lo hereda a los workers por entorno.
if (!process.env.VISUAL_PORT) process.env.VISUAL_PORT = String(await freePort());
const port = Number(process.env.VISUAL_PORT);
export const BASE_URL = `http://127.0.0.1:${port}`;

/** Umbral por píxel (0–1, distancia de color YIQ). Bajo para que un cambio de token se vea. */
const colorThreshold = Number(process.env.VISUAL_THRESHOLD ?? 0.02);
/** Píxeles distintos tolerados por captura antes de marcar diferencia. */
const maxDiffPixels = Number(process.env.VISUAL_MAX_DIFF_PIXELS ?? 0);
/** Carpeta de referencia (bajo tests/visual). Otra que `baseline` sirve para aislar una etapa sin tocar la línea base. */
const baselineDir = process.env.VISUAL_BASELINE_DIR ?? 'baseline';

export default defineConfig({
  testDir: here,
  // VISUAL_SPEC=anchos-zoom.spec.ts corre la comprobación de 1024 px y zoom (npm run test:anchos).
  testMatch: process.env.VISUAL_SPEC ?? 'censo.spec.ts',
  outputDir: path.join(here, 'results'),
  snapshotPathTemplate: `{testDir}/${baselineDir}/{platform}/{arg}{ext}`,
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  workers: Number(process.env.VISUAL_WORKERS ?? 4),
  retries: 0,
  timeout: 90_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(here, 'report/html'), open: 'never' }],
    ['./support/report.ts', { outputDir: path.join(here, 'report') }]
  ],
  expect: {
    timeout: 20_000,
    toHaveScreenshot: { threshold: colorThreshold, maxDiffPixels, animations: 'disabled', caret: 'hide', scale: 'device' }
  },
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off'
  },
  webServer: {
    command: `npx vite dev --config tests/visual/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: path.resolve(here, '../..'),
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      // Supabase ficticio: la captura nunca habla con staging ni usa .env.local.
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_KEY,
      // Banderas fijas con los valores del censo, independientes del entorno local.
      VITE_CATALOG_SOURCE: 'canonical',
      VITE_EDITORIAL_ENABLED: 'true',
      VITE_ADMIN_CATALOG_ENABLED: 'true',
      VITE_BETA_INVITATION_ENABLED: 'true'
    }
  }
});
