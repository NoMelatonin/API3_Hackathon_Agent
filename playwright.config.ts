import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './e2e', workers: 1, fullyParallel: false, timeout: 30_000,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:5173', headless: true,
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
  },
});
