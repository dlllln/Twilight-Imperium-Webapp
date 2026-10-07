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
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
  },
});
