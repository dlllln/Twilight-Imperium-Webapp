import { defineConfig } from '@playwright/test';

const executablePath = process.env['PW_CHROMIUM_PATH'];

export default defineConfig({
  testDir: 'e2e',
  // Software-Rendering auf CI-Runnern ist langsam; der Spielablauf-Test braucht Luft.
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    ...(executablePath === undefined ? {} : { launchOptions: { executablePath } }),
  },
  // Der Online-Server liefert die gebaute Seite aus, genau wie im Betrieb (ohne Datenbank).
  webServer: {
    command: 'pnpm build && pnpm --filter @stellar/server start',
    url: 'http://localhost:4173/health',
    env: { PORT: '4173', WEB_DIST: '../web/dist', BOT_DELAY_MS: '60', LOG_LEVEL: 'warn' },
    reuseExistingServer: !process.env['CI'],
  },
});
