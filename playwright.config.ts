import { defineConfig, devices } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '4173';
const playwrightBaseURL = `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: playwrightBaseURL,
    ...devices['Desktop Chrome'],
    // En CI, una prueba que falla deja su traza (DOM, capturas y eventos cuadro a
    // cuadro) en test-results/; ci.yml la sube como artefacto. Para fallas que no
    // se reproducen en local. Se abre con `npx playwright show-trace <zip>`.
    trace: process.env.CI ? 'retain-on-failure' : 'off'
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${playwrightPort}`,
    url: playwrightBaseURL,
    reuseExistingServer: !process.env.CI
  }
});
