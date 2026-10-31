import base from './playwright.config.ts';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: '**/v3.spec.ts',
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { ...base.use, baseURL: process.env.V3_UI_URL ?? base.use?.baseURL },
});
