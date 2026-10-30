import pg from 'pg';
import { test, expect } from '@playwright/test';
import { languages, catalog } from '../web/v3/i18n.ts';
import { createPublicClient, http, testActions } from 'viem';
import { foundry } from 'viem/chains';
const chain = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8547'),
}).extend(testActions({ mode: 'anvil' }));
let snap: `0x${string}`;
let saved: unknown;
const database = new pg.Pool({
  connectionString:
    'postgres://localdemo:localdemo-only@127.0.0.1:5437/disasterdao',
});
test.afterAll(async () => {
  await database.end();
});
test.beforeEach(async () => {
  snap = await chain.snapshot();
  saved = (await database.query('SELECT body FROM v3_state WHERE id=1')).rows[0]
    .body;
});
test.afterEach(async () => {
  await chain.revert({ id: snap });
  await database.query('UPDATE v3_state SET body=$1 WHERE id=1', [
    JSON.stringify(saved),
  ]);
});
test('all 39 languages, draft status, dark/light, country scope and RTL mobile layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?v3=1');
  await expect(page.getByTestId('balance')).toContainText('dUSD');
  await page.locator('.preferences>summary').click();
  const selects = page.locator('.preferences select');
  expect(await selects.nth(1).locator('option').count()).toBe(51);
  for (const [lang] of languages) {
    await selects.nth(0).selectOption(lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toHaveText(catalog[lang]!.estimated + '.');
    if (!['de', 'en'].includes(lang))
      await expect(page.getByTestId('draft')).toBeVisible();
  }
  for (const mode of ['light', 'dark']) {
    await selects.nth(4).selectOption(mode);
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await selects.nth(0).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.preferences>summary').click();
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/v3-ar-dark-mobile.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});
test('keyboard navigation, public donation and protected role workflow through two separate reviewers', async ({
  page,
}) => {
  await page.goto('/?v3=1');
  await page.locator('.preferences>summary').click();
  await page.locator('.preferences select').first().selectOption('en');
  await page.locator('.preferences>summary').click();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    'BODY',
  );
  await page
    .getByRole('button', { name: 'Test donation', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  await page.locator('nav a[href="#ngo"]').click();
  await page.locator('.role-box select').selectOption('ngo-1');
  await page
    .getByRole('button', { name: 'Select simulated role', exact: true })
    .click();
  await expect(page.locator('.active-role')).toContainText('Relief North');
  await page.locator('.portal-grid form button.primary').first().click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  await expect(page.locator('.workflow-row')).toContainText('500 dUSD');
  await page.locator('nav a[href="#review"]').click();
  for (const role of ['data-1', 'data-2']) {
    await page.locator('.role-box select').selectOption(role);
    await page
      .getByRole('button', { name: 'Select simulated role', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Approve', exact: true })
      .first()
      .click();
    await expect(page.getByRole('status')).toHaveText('Completed');
  }
  await page
    .getByRole('button', { name: 'Funding round', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  for (const role of ['data-1', 'data-2']) {
    await page.locator('.role-box select').selectOption(role);
    await page
      .getByRole('button', { name: 'Select simulated role', exact: true })
      .click();
    await page
      .locator('.portal-grid .panel')
      .nth(1)
      .getByRole('button', { name: 'Approve', exact: true })
      .last()
      .click();
    await expect(page.getByRole('status')).toHaveText('Completed');
  }
  await page.locator('.role-box select').selectOption('ngo-1');
  await page
    .getByRole('button', { name: 'Select simulated role', exact: true })
    .click();
  await page.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Completed');
  await expect(page.locator('.evidence-panel')).toContainText('#1');
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'DISASTERDAO SYNTHETIC\nFictitious invoice and delivery receipt',
    ),
  });
  await expect(page.getByRole('status')).toHaveText('Completed');
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeEnabled();
  for (const mode of ['light', 'dark']) {
    await page.locator('.preferences>summary').click();
    await page.locator('.preferences select').nth(4).selectOption(mode);
    await page.locator('.preferences>summary').click();
    await page.setViewportSize({ width: 375, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/v3-ngo-${mode}.png`,
      fullPage: true,
    });
  }
});

test('preserved V1/V2 demo entries have accessible theme controls and fit mobile', async ({
  page,
}) => {
  for (const url of ['/?v2=1', '/?legacy=1']) {
    await page.goto(url);
    await expect(page.locator('.legacy-theme')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const mode of ['light', 'dark']) {
      await page.getByLabel('Darstellung', { exact: true }).selectOption(mode);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
