import { test, expect } from '@playwright/test';
import pg from 'pg';
import { createPublicClient, http, testActions } from 'viem';
import { foundry } from 'viem/chains';
import { prepareExternalReview, exportApproval } from '../server/external.ts';
import { chain as fundingChain } from '../src/v3/chain.ts';
import { tick } from '../server/worker.ts';
import { Database } from '../server/store.ts';
import { databaseNamespace, organizationScope } from '../src/v3/chain.ts';
import type { State } from '../server/state.ts';
import { languages } from '../web/v3/i18n.ts';
const chain = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8547'),
}).extend(testActions({ mode: 'anvil' }));
const db = new pg.Pool({
  connectionString:
    'postgres://localdemo:localdemo-only@127.0.0.1:5437/disasterdao',
  options: `-c search_path=${databaseNamespace()}`,
});
let snap: `0x${string}`, saved: unknown;
let communitySaved: unknown;
test.beforeEach(async () => {
  snap = await chain.snapshot();
  saved = (await db.query('SELECT body FROM v3_state WHERE id=1')).rows[0].body;
  await organizationScope.run('community-alliance', async () => {
    const other = new Database<State>();
    try {
      communitySaved = await other.read();
    } finally {
      await other.pool.end();
    }
  });
  await chain.mine({ blocks: 2 });
  for (const id of ['local-alliance', 'community-alliance'])
    await organizationScope.run(id, async () => {
      const indexDb = new Database<State>();
      try {
        await tick(indexDb);
      } finally {
        await indexDb.pool.end();
      }
    });
});
test.afterEach(async () => {
  await chain.revert({ id: snap });
  const indexDb = new Database<State>();
  try {
    await tick(indexDb);
    await organizationScope.run('community-alliance', async () => {
      const other = new Database<State>();
      try {
        await tick(other);
      } finally {
        await other.pool.end();
      }
    });
  } finally {
    await indexDb.pool.end();
  }
  await db.query('UPDATE v3_state SET body=$1 WHERE id=1', [
    JSON.stringify(saved),
  ]);
  await organizationScope.run('community-alliance', async () => {
    const other = new Database<State>();
    try {
      await other.pool.query('UPDATE v3_state SET body=$1 WHERE id=1', [
        JSON.stringify(communitySaved),
      ]);
    } finally {
      await other.pool.end();
    }
  });
});
test.afterAll(async () => db.end());

test('four separate entries, compatible links, history and shared test deposit allocation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?v3=1');
  await expect(
    page.getByRole('heading', {
      name: 'Gemeinsam Hilfe möglich machen.',
    }),
  ).toBeVisible();
  await expect(
    page
      .locator('.organization-scroller')
      .first()
      .locator('.organization-card'),
  ).toHaveCount(2);
  await expect(page.locator('.metrics')).toHaveCount(0);
  await expect(page.getByTestId('allocation-total')).toHaveText('27.000 dUSD');
  await expect(page.locator('#support-allocation-title')).toHaveText(
    'Verteilung der Testeinzahlungen',
  );
  await page.locator('.organization-card>a').first().click();
  await expect(page).toHaveURL(/#\/organizations\/local-alliance$/);
  await expect(
    page.getByRole('heading', {
      name: 'Unterstützungsverlauf des gemeinsamen Testkontos',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Enthält initiale Einzahlungen. Dies ist kein persönliches Portfolio.',
    ),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator('.metrics')).toHaveCount(0);
  await expect(page.locator('#support-allocation-title')).toHaveText(
    'Verteilung der Testeinzahlungen',
  );
  await page.goForward();
  await page.reload();
  await expect(page.locator('.member-list li')).toHaveCount(3);
  await page.goto('/?v3=1#alliance-local-alliance');
  await expect(
    page.getByRole('heading', { name: 'Mitglieds-NGOs' }),
  ).toBeVisible();
  await page.goto('/?v3=1#review');
  await expect(
    page.getByText(
      'Prüfer arbeiten jetzt außerhalb der App. NGOs importieren Dokumente und signierte Freigaben.',
    ),
  ).toBeVisible();
  await expect(page.locator('a[href="#review"]')).toHaveCount(0);
  await page.goto('/?v3=1#/organizations/missing');
  await expect(
    page.getByRole('heading', { name: 'Organisation nicht gefunden' }),
  ).toBeVisible();
  await page.goto('/?v2=1');
  await expect(page.locator('.campaigns')).toBeVisible();
  await page.goto('/?legacy=1');
  await expect(page.locator('.tabs')).toBeVisible();
  expect(errors).toEqual([]);
});

test('settings focus, all language resources, themes, responsive RTL and image rotation', async ({
  page,
}) => {
  await page.goto('/?v3=1');
  const gear = page.getByRole('button', {
    name: 'Einstellungen',
  });
  await gear.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const selects = dialog.locator('.preferences-grid select');
  expect(await selects.nth(1).locator('option').count()).toBe(51);
  for (const [locale] of languages) {
    await selects.nth(0).selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    if (!['de', 'en'].includes(locale))
      await expect(page.getByTestId('draft')).toBeVisible();
  }
  await selects.nth(0).selectOption('de');
  for (const mode of ['light', 'dark']) {
    await selects.nth(4).selectOption(mode);
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(page.locator('.v3-app')).toHaveCSS(
      'background-color',
      mode === 'dark' ? 'rgb(8, 8, 8)' : 'rgb(243, 244, 245)',
    );
    await expect(page.locator('.v3-header')).toHaveCSS('display', 'flex');
    await expect(page.locator('.brand .icon')).toHaveCSS('width', '18px');
    await page.keyboard.press('Escape');
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/v3-${mode}-${width}.png`,
        fullPage: true,
      });
    }
    await gear.click();
  }
  await selects.nth(0).selectOption('ar');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.preferences-grid select').first().selectOption('de');
  await page.keyboard.press('Escape');
  await expect(gear).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const img = page.locator('.organization-card img').first(),
    original = await img.getAttribute('src');
  await page.clock.install();
  await page.clock.fastForward(11000);
  await expect(img).toHaveAttribute('src', original!);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(
    page.locator('.card-controls').first().locator('button').last(),
  ).toBeEnabled();
  await page.locator('h1').hover();
  await page.clock.fastForward(11000);
  await expect(img).not.toHaveAttribute('src', original!);
  const pause = page
    .getByRole('button', { name: 'Pause', exact: true })
    .first();
  await pause.click();
  const paused = await img.getAttribute('src');
  await page.clock.fastForward(22000);
  await expect(img).toHaveAttribute('src', paused!);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    'BODY',
  );
});

test('NGO workspace, preview wizard, private boundary and public test donation dialog', async ({
  page,
  request,
}) => {
  await page.goto('/?v3=1');
  await page.getByRole('button', { name: 'Testspende', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Gemeinsames Testspenderkonto');
  await dialog.getByRole('spinbutton').fill('1');
  await dialog.getByRole('button', { name: 'Testspende bestätigen' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/Testspende gemined/)).toBeVisible();
  await page.getByRole('link', { name: 'NGO', exact: true }).click();
  await expect(page.getByLabel('NGO auswählen').locator('option')).toHaveCount(
    6,
  );
  await page.getByRole('button', { name: 'NGO anmelden', exact: true }).click();
  await expect(page).toHaveURL(/#\/ngo$/);
  await expect(
    page.getByRole('heading', { name: 'Relief North' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Testspende', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Hilfe beantragen', exact: true })
    .click();
  await page
    .getByText('Externe Prüfung als Alternative', { exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Externen Antrag öffnen', exact: true })
    .click();
  await page
    .getByLabel('Bedarf, Begründung und Interessenkonflikte')
    .fill(
      'Synthetic local emergency relief with documented rationale; no actual expenditure claimed.',
    );
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Vorschau berechnen' }).click();
  await expect(
    page.getByRole('heading', { name: 'Unverbindliche Vorschau' }),
  ).toBeVisible();
  await expect(
    page.getByText('Lokale Bestätigung:', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Antrag verbindlich absenden' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Prüfauftrag exportieren' }).first(),
  ).toBeVisible();
  for (const path of ['/.runtime/v3.1-persistent.json', '/server/state.ts']) {
    const response = await request.get(path);
    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('text/html');
      expect(await response.text()).toContain('<div id="root">');
    } else expect([403, 404]).toContain(response.status());
  }
});

test('test allocation only increases after the donation enters the confirmed index', async ({
  page,
  request,
}) => {
  const indexDb = new Database<State>();
  try {
    await chain.mine({ blocks: 2 });
    await tick(indexDb);
    await organizationScope.run('community-alliance', async () => {
      const other = new Database<State>();
      try {
        await tick(other);
      } finally {
        await other.pool.end();
      }
    });
    await page.goto('/?v3=1#/home');
    const beforeResponse = await request.get('/api/v3/organizations');
    const before = (await beforeResponse.json()).organizations[0];
    const amountBefore = (await beforeResponse.json()).organizations.reduce(
      (sum: bigint, o: { support: { total: string } }) =>
        sum + BigInt(o.support.total),
      0n,
    );
    const format = (value: bigint) =>
      new Intl.NumberFormat('de', { maximumFractionDigits: 6 }).format(
        Number(value) / 1e6,
      ) + ' dUSD';
    await expect(page.getByTestId('allocation-total')).toHaveText(
      format(amountBefore),
    );
    await page.getByRole('button', { name: 'Testspende', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton').fill('1');
    await dialog.getByRole('button', { name: 'Testspende bestätigen' }).click();
    await expect(page.getByText(/Testspende gemined/)).toBeVisible();
    // Mining alone leaves the deposit outside the two-block-deep confirmed index.
    const minedResponse = await request.get('/api/v3/organizations');
    expect((await minedResponse.json()).organizations[0].support.total).toBe(
      String(before.support.total),
    );
    await expect(page.getByTestId('allocation-total')).toHaveCount(0);
    await chain.mine({ blocks: 2 });
    await tick(indexDb);
    await organizationScope.run('community-alliance', async () => {
      const other = new Database<State>();
      try {
        await tick(other);
      } finally {
        await other.pool.end();
      }
    });
    await page.locator('.support-allocation').getByRole('button').click();
    await expect(page.getByTestId('allocation-total')).toHaveText(
      format(amountBefore + 1000000n),
    );
    await expect(page.getByText(/Testspende gemined/)).toHaveCount(0);
  } finally {
    await indexDb.pool.end();
  }
});

test('second alliance and source-based preview are visible in the NGO workspace', async ({
  page,
}) => {
  await page.goto('/?v3=1#/home');
  await expect(page.locator('.support-allocation')).toContainText(
    'Community Response Alliance',
  );
  await expect(page.locator('.support-allocation')).toContainText(
    'DisasterDAO Relief Alliance',
  );
  await page.getByRole('link', { name: 'NGO', exact: true }).click();
  await page.getByLabel('NGO auswählen').selectOption('community-ngo-1');
  await page.getByRole('button', { name: 'NGO anmelden', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Community Rescue', exact: true }),
  ).toBeVisible();
  const panel = page.locator('.ngo-flow');
  await panel
    .getByRole('button', { name: 'Hilfe beantragen', exact: true })
    .click();
  await panel
    .getByRole('button', { name: 'Ereignisdaten prüfen', exact: true })
    .click();
  await expect(panel).toContainText('Synthetische, lokal signierte Demo-Daten');
  await panel
    .getByRole('button', { name: 'Weiter zum Antrag', exact: true })
    .click();
  const purpose =
    'Emergency shelter and medical supplies ' + crypto.randomUUID();
  await panel.getByLabel('Einsatzzweck', { exact: true }).fill(purpose);
  await panel
    .getByRole('button', { name: 'Antrag prüfen', exact: true })
    .click();
  await panel
    .getByRole('button', { name: 'Antrag verbindlich einreichen', exact: true })
    .click();
  const card = page.getByTestId('workflow-case').filter({ hasText: purpose });
  await expect(card).toContainText('Mittel freigeben');
  await expect(page.locator('.evidence-card')).toHaveCount(0);
  await page.reload();
  await card
    .getByRole('button', { name: 'Freigabe prüfen', exact: true })
    .click();
  await card
    .getByRole('button', {
      name: 'Mittel verbindlich reservieren',
      exact: true,
    })
    .click();
  await expect(
    card.getByRole('button', {
      name: 'Reservierten Betrag abrufen',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.evidence-card')).toHaveCount(0);
  await card
    .getByRole('button', { name: 'Reservierten Betrag abrufen', exact: true })
    .click();
  const evidence = page.locator('.evidence-card');
  await expect(evidence).toHaveCount(1);
  await expect(card).toContainText('500 dUSD');
  await evidence
    .locator('input[type=file][accept=".txt,.pdf,.png,.jpg,.jpeg"]')
    .setInputFiles({
      name: 'receipt.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'DISASTERDAO SYNTHETIC\nFictional emergency supplies and delivery checks.',
      ),
    });
  await expect(
    evidence.getByRole('button', {
      name: 'Eingangsattest zur Prüfung exportieren',
    }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await evidence
    .getByRole('button', { name: 'Eingangsattest zur Prüfung exportieren' })
    .click();
  const exported = await download;
  const { readFile } = await import('node:fs/promises');
  const receipt = JSON.parse(await readFile((await exported.path())!, 'utf8'));
  receipt.signatures = await organizationScope.run(
    'community-alliance',
    async () =>
      (await fundingChain()).sign(receipt.purpose, receipt.payload, [20, 21]),
  );
  await evidence
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: 'receipt-signed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(receipt)),
    });
  await expect(evidence).toContainText('Eingangsattest bestätigt · in Prüfung');
  await evidence
    .getByLabel('Dokumentart', { exact: true })
    .selectOption('external-review');
  await evidence
    .locator('input[type=file][accept=".txt,.pdf,.png,.jpg,.jpeg"]')
    .setInputFiles({
      name: 'review.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'DISASTERDAO SYNTHETIC\nIndependent invoice reconciliation and delivery checks; no conflict.',
      ),
    });
  await expect(evidence).toContainText('review.txt');
  const reviewed = await organizationScope.run(
    'community-alliance',
    async () => {
      const database = new Database<State>();
      try {
        return await database.transaction(async (s) => {
          const document = s.documents.findLast(
            (d) => d.name === 'review.txt' && d.uploaded,
          )!;
          const r = await prepareExternalReview(s, {
            kind: 'review',
            evidenceId: document.evidenceId,
            documentId: document.id,
            reason:
              'Fictional invoices and delivery checked independently; no conflict declared.',
            decision: 2,
            days: 0,
          });
          const b = await exportApproval(s, 'REVIEW', r.id);
          return {
            ...b,
            signatures: await (
              await fundingChain()
            ).sign(b.purpose, b.payload, [20, 21]),
          };
        });
      } finally {
        await database.pool.end();
      }
    },
  );
  await evidence
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: 'review-signed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(reviewed)),
    });
  await expect(evidence).toContainText('Verwendung akzeptiert');
  await expect(card).toContainText('Neuen Antrag starten');
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/v3-guided-${width}.png`,
      fullPage: true,
    });
  }
});
