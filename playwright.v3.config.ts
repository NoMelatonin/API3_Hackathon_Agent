import base from './playwright.config.ts';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: '**/v3.spec.ts',
  timeout: 45000,
});
