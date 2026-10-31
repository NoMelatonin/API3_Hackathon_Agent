import { test, expect } from '@playwright/test';
import type { Organization } from '../src/v3/ui-types.ts';

test.beforeEach(async ({ page }) => {
  let role = '';
  const roles = [1, 2, 3].map((n) => ({ id: `ngo-${n}`, name: `NGO ${n}` }));
  await page.route('**/api/v3/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    let status = 200;
    if (path.endsWith('/roles')) body = { roles };
    else if (path.endsWith('/test-support') || path.endsWith('/activity'))
      body = { items: [], next: null };
    else if (path.endsWith('/organizations')) body = { organizations: [] };
    else if (path.endsWith('/session')) {
      role =
        route.request().method() === 'DELETE'
          ? ''
          : route.request().postDataJSON().role;
    } else if (path.endsWith('/portal')) {
      status = role ? 200 : 401;
      body = role
        ? {
            role: roles.find((r) => r.id === role),
            apps: [],
            documents: [],
            reviews: [],
            reports: [],
            incidents: [],
            evidence: [],
            reservations: [],
            governance: [],
            interim: [],
          }
        : { error: 'No session' };
    }
    await route.fulfill({ status, json: body });
  });
});

test('separate NGO login, legacy redirect, persistent session and explicit return', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/?v3=1#ngo');
  await expect(page).toHaveURL(/ngo=1/);
  await expect(page.getByLabel('NGO auswählen')).toBeVisible();
  for (const n of [1, 2, 3]) {
    await page.getByLabel('NGO auswählen').selectOption(`ngo-${n}`);
    await page
      .getByRole('button', { name: 'NGO anmelden', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: `NGO ${n}`, exact: true }),
    ).toBeVisible();
    expect(
      await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: `NGO ${n}`, exact: true }),
    ).toBeVisible();
    if (n < 3)
      await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  }
  await page.goto('/?v3=1#/home');
  await expect(
    page.getByRole('button', { name: 'Testspende', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Einstellungen', exact: true })
    .click();
  await expect(page.getByLabel('NGO auswählen')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Abmelden und zur Öffentlichkeit' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Testspende', exact: true }),
  ).toBeEnabled();
});

test('session failures allow retry and expiry removes private workspace', async ({
  page,
}) => {
  await page.route('**/api/v3/portal', (r) =>
    r.fulfill({ status: 503, json: { error: 'Offline' } }),
  );
  await page.goto('/?v3=1&ngo=1');
  await expect(
    page.getByText('Sitzung konnte nicht geprüft werden.'),
  ).toBeVisible();
  await page.unroute('**/api/v3/portal');
  await page
    .locator('.ngo-entry')
    .getByRole('button', { name: 'Erneut laden' })
    .click();
  await page.getByRole('button', { name: 'NGO anmelden', exact: true }).click();
  await expect(page).toHaveURL(/#\/ngo$/);
  await page.waitForLoadState('load');
  await expect(
    page.getByRole('heading', { name: 'NGO 1', exact: true }),
  ).toBeVisible();
  await page.route('**/api/v3/portal', (r) =>
    r.fulfill({ status: 401, json: { error: 'Expired' } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('NGO auswählen')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Antrag starten', exact: true }),
  ).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    test(`${theme} ${width}: demo and NGO theme isolation`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem('v3-theme', theme),
        theme,
      );
      await page.goto('/?v2=1');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.panel').first()).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(20, 20, 20)' : 'rgb(255, 255, 255)',
      );
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(8, 8, 8)' : 'rgb(243, 244, 245)',
      );
      await expect(page.locator('.curve polyline')).toHaveCSS(
        'stroke',
        theme === 'dark' ? 'rgb(180, 154, 255)' : 'rgb(80, 137, 0)',
      );
      await page
        .getByRole('button', { name: /Gemeinsamer Notfallweg/ })
        .click();
      await page.screenshot({
        path: info.outputPath('demo.png'),
        fullPage: true,
      });
      await page.goto('/?v3=1&ngo=1');
      await expect(page.getByLabel('NGO auswählen')).toBeVisible();
      await expect(page.locator('.v3-app')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(8, 8, 8)' : 'rgb(243, 244, 245)',
      );
      expect(
        await page
          .locator('body')
          .evaluate((el) => el.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath('ngo.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Einstellungen', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Einstellungen', exact: true }),
      ).toBeFocused();
    });
  }
}

// Multiple organizations below are controlled fixtures, never application data.
function organization(
  id = 'local-alliance',
  total = '18000000000',
  status: Organization['snapshot']['status'] = 'confirmed',
): Organization {
  return {
    id,
    name:
      id === 'local-alliance'
        ? 'DisasterDAO Relief Alliance'
        : `Test organization ${id}`,
    description: 'Synthetic test fixture',
    members: [],
    areas: [],
    reports: [],
    images: [{ src: '/v3/rescue.svg', alt: 'Testbild', altEn: 'Test image' }],
    snapshot: {
      chainId: 31337,
      fund: '0x1234',
      block: '20',
      hash: '0xabc',
      time: 1793400000,
      status,
    },
    funds: { balance: total, reserved: '0', free: total, paid: '0' },
    support: {
      donor: '0x5678',
      total,
      count: total === '0' ? 0 : 1,
      supported: status === 'confirmed' ? total !== '0' : null,
    },
  };
}

test('all six view links, active state, history, local demo and authenticated session', async ({
  page,
}) => {
  const paths = { Demo: '/?v2=1', NGO: '/?v3=1&ngo=1', User: '/?v3=1#/home' };
  for (const [source, path] of Object.entries(paths)) {
    for (const target of Object.keys(paths).filter((view) => view !== source)) {
      await page.goto(path);
      const nav = page.locator('.view-navigation');
      await expect(nav.getByRole('link')).toHaveText(['Demo', 'NGO', 'User']);
      await expect(nav.locator('[aria-current="page"]')).toHaveText(source);
      await nav.getByRole('link', { name: target, exact: true }).click();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(target);
      await page.goBack();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(source);
      await page.goForward();
      await page.reload();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(target);
    }
  }
  await page.goto('/?local=1');
  await expect(page.locator('.view-navigation [aria-current]')).toHaveText(
    'Demo',
  );
  await page
    .locator('.view-navigation')
    .getByRole('link', { name: 'NGO', exact: true })
    .click();
  await page.getByRole('button', { name: 'NGO anmelden', exact: true }).click();
  await expect(page).toHaveURL(/#\/ngo$/);
  await page.waitForLoadState('load');
  for (const target of ['User', 'Demo', 'NGO']) {
    await page
      .locator('.view-navigation')
      .getByRole('link', { name: target, exact: true })
      .click();
    await expect(page.locator('.view-navigation [aria-current]')).toHaveText(
      target,
    );
    if (target === 'User')
      await expect(
        page.getByRole('button', { name: 'Testspende', exact: true }),
      ).toBeDisabled();
  }
  await expect(
    page.getByRole('heading', { name: 'NGO 1', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Abmelden und zur Öffentlichkeit' })
    .click();
  await expect(page.locator('.view-navigation [aria-current]')).toHaveText(
    'User',
  );
  await expect(
    page.getByRole('button', { name: 'Testspende', exact: true }),
  ).toBeEnabled();
});

test('allocation uses confirmed deposits, links to details and handles zero and missing organizations', async ({
  page,
}) => {
  let organizations = [organization()];
  await page.route('**/api/v3/organizations', (r) =>
    r.fulfill({ json: { organizations } }),
  );
  await page.goto('/?v3=1#/home');
  const allocation = page.locator('.support-allocation');
  await expect(allocation.getByTestId('allocation-total')).toHaveText(
    '18.000 dUSD',
  );
  await expect(allocation.locator('.allocation-value')).toContainText('100,0');
  await expect(allocation).toContainText('Keine persönlichen Guthaben');
  await expect(allocation.locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await allocation
    .getByRole('link', { name: 'DisasterDAO Relief Alliance' })
    .click();
  await expect(page).toHaveURL(/#\/organizations\/local-alliance$/);
  await expect(page.locator('.view-navigation [aria-current]')).toHaveText(
    'User',
  );
  await page.goBack();
  organizations = [
    organization('a', '1000000'),
    organization('b', '2000000'),
    organization('c', '3000000'),
  ];
  await allocation.getByRole('button').click();
  await expect(allocation.getByTestId('allocation-total')).toHaveText('6 dUSD');
  await expect(allocation.locator('.allocation-list li')).toHaveCount(3);
  for (const [i, value] of ['16,7', '33,3', '50,0'].entries())
    await expect(allocation.locator('.allocation-value').nth(i)).toContainText(
      value,
    );
  await expect(allocation.locator('svg circle')).toHaveCount(4);
  organizations = [organization('local-alliance', '0')];
  await allocation.getByRole('button').click();
  await expect(allocation.getByTestId('allocation-total')).toHaveText('0 dUSD');
  await expect(allocation).toContainText(
    'Noch keine bestätigten Testeinzahlungen.',
  );
  await expect(allocation.locator('svg circle')).toHaveCount(1);
  organizations = [];
  await allocation.getByRole('button').click();
  await expect(allocation).toContainText(
    'Noch keine Organisationen registriert.',
  );
  await expect(allocation.getByTestId('allocation-total')).toHaveCount(0);
  await page.goto('/?v3=1#/missing');
  await expect(page.locator('.view-navigation [aria-current]')).toHaveText(
    'User',
  );
});

for (const status of ['stale', 'unavailable'] as const) {
  test(`allocation with ${status} organization never shows partial totals`, async ({
    page,
  }) => {
    let organizations = [
      organization(),
      organization('other', '1000000', status),
    ];
    await page.route('**/api/v3/organizations', (r) =>
      r.fulfill({ json: { organizations } }),
    );
    await page.goto('/?v3=1');
    const allocation = page.locator('.support-allocation');
    await expect(allocation).toContainText(
      'Der Index ist veraltet oder nicht verfügbar.',
    );
    await expect(allocation.locator('svg')).toHaveCount(0);
    await expect(allocation.getByTestId('allocation-total')).toHaveCount(0);
    organizations = [organization()];
    await allocation.getByRole('button').click();
    await expect(allocation.getByTestId('allocation-total')).toHaveText(
      '18.000 dUSD',
    );
  });
}

test('allocation loading, failed refresh, retained data suppression and recovery', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = false;
  await page.route('**/api/v3/organizations', async (r) => {
    await gate;
    await r.fulfill(
      fail
        ? { status: 503, json: { error: 'Offline' } }
        : { json: { organizations: [organization()] } },
    );
  });
  await page.goto('/?v3=1');
  const allocation = page.locator('.support-allocation');
  await expect(allocation.getByRole('status')).toContainText('Lädt');
  await expect(allocation.getByTestId('allocation-total')).toHaveCount(0);
  release();
  await expect(allocation.getByTestId('allocation-total')).toBeVisible();
  fail = true;
  await allocation.getByRole('button').click();
  await expect(allocation.getByRole('status')).toContainText(
    'Einzahlungen konnten nicht aktualisiert werden',
  );
  await expect(allocation.getByTestId('allocation-total')).toHaveCount(0);
  fail = false;
  await allocation.getByRole('button').click();
  await expect(allocation.getByTestId('allocation-total')).toHaveText(
    '18.000 dUSD',
  );
  await expect(allocation.getByRole('alert')).toHaveCount(0);
});

for (const locale of ['de', 'en', 'ar']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      test(`allocation ${locale} ${theme} ${width}: layout and keyboard navigation`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(
          ({ locale, theme }) => {
            localStorage.setItem('v3-locale', locale);
            localStorage.setItem('v3-theme', theme);
          },
          { locale, theme },
        );
        const first = organization();
        first.name =
          'DisasterDAO Relief Alliance with a deliberately long organization name';
        await page.route('**/api/v3/organizations', (r) =>
          r.fulfill({
            json: { organizations: [first, organization('b', '6000000000')] },
          }),
        );
        await page.goto('/?v3=1#/home');
        await expect(page.getByTestId('allocation-total')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.locator('#support-allocation-title')).toHaveText(
          locale === 'de'
            ? 'Verteilung der Testeinzahlungen'
            : 'Test deposit allocation',
        );
        expect(
          await page
            .locator('body')
            .evaluate((el) => el.scrollWidth <= innerWidth),
        ).toBe(true);
        const nav = page.locator('.view-navigation');
        await nav.getByRole('link', { name: 'Demo', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(
          nav.getByRole('link', { name: 'NGO', exact: true }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
          nav.getByRole('link', { name: 'User', exact: true }),
        ).toBeFocused();
        for (const link of await nav.getByRole('link').all())
          expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        const chart = await page.locator('.allocation-donut').boundingBox();
        const details = await page.locator('.allocation-details').boundingBox();
        if (width === 390)
          expect(details!.y).toBeGreaterThan(chart!.y + chart!.height);
        await page.screenshot({
          path: info.outputPath('allocation.png'),
          fullPage: true,
        });
      });
    }
  }
}
