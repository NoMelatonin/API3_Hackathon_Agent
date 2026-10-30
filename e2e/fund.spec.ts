import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { encodeFunctionData, keccak256, toHex } from 'viem';

// Real local chain; public unlocked Anvil accounts only. No private key enters the browser.
const config = JSON.parse(await readFile('public/deployment.local.json', 'utf8'));
const response = JSON.parse(await readFile('fixtures/usgs-fresh.json', 'utf8'));
const contracts = JSON.parse(await readFile('web/contracts.json', 'utf8'));
async function rpc(method: string, params: unknown[] = []) {
  const r = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}
let snapshot: string;
test.beforeEach(async ({ page }) => {
  snapshot = await rpc('evm_snapshot');
  await rpc('evm_setNextBlockTimestamp', [Number(response.timestamp)]);
  await rpc('evm_mine');
  await page.addInitScript(({ account }) => {
    (window as any).__testAccount = account;
    (window as any).ethereum = { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [(window as any).__testAccount];
      if (method === 'wallet_switchEthereumChain') return null;
      const r = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } };
  }, { account: config.deployer });
  await page.goto('/?local=1');
  await expect(page.getByRole('status')).toContainText('Fonds bereit');
});
test.afterEach(async () => { if (snapshot) await rpc('evm_revert', [snapshot]); });

test('desktop: authentic response pays, history updates, replay rejected', async ({ page }) => {
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Signaturprüfung / Jury' }).click();
  await page.getByLabel(/^Originale Attestation/).fill(JSON.stringify(response));
  await page.getByRole('button', { name: 'Signatur prüfen & auszahlen' }).click();
  await expect(page.getByRole('status')).toContainText('On-chain bestätigt');
  await expect(page.getByRole('row').filter({ hasText: 'Demo-NGO 1' })).toContainText('1.000 dUSD');
  await page.getByRole('button', { name: 'Im Contract simulieren' }).click();
  await expect(page.getByRole('status')).toContainText('AlreadyClaimed');
});

test('edited genuine value is rejected by the actual contract', async ({ page }) => {
  await page.getByRole('button', { name: 'Signaturprüfung / Jury' }).click();
  const edited = { ...response, data: response.data.replace('"magnitude":7.8', '"magnitude":9.8') };
  await page.getByLabel(/^Originale Attestation/).fill(JSON.stringify(edited));
  await page.getByRole('button', { name: 'Im Contract simulieren' }).click();
  await expect(page.getByRole('status')).toContainText('NotSignedByAirnode');
  await expect(page.getByText('Noch keine Auszahlung.', { exact: false })).toBeVisible();
});

test('two different committee wallets approve and execute one emergency grant', async ({ page }) => {
  await page.locator('#ngo').selectOption('1');
  for (const address of config.committee.slice(0, 2)) {
    await rpc('anvil_impersonateAccount', [address]);
    await rpc('anvil_setBalance', [address, '0xde0b6b3a7640000']);
    await page.evaluate(address => { (window as any).__testAccount = address; }, address);
    await page.getByRole('button', { name: 'Als Verantwortlicher genehmigen' }).click();
    await expect(page.getByRole('status')).toContainText('On-chain bestätigt');
  }
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '1.000 dUSD freigeben' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Demo-NGO 2' })).toContainText('2/3-Notfallquorum');
});

test('mobile: overview and jury fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Wenn Daten fehlen.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Signaturprüfung / Jury' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('changing a reason clears quorum immediately and late RPC results cannot restore it', async ({ page }) => {
  const reason = await page.locator('#reason').inputValue();
  const reasonHash = keccak256(toHex(reason.trim()));
  const data = encodeFunctionData({ abi: contracts.fund, functionName: 'approveEmergency', args: [config.ngos[0], reasonHash] });
  for (const address of config.committee.slice(0, 2)) {
    await rpc('anvil_impersonateAccount', [address]);
    await rpc('anvil_setBalance', [address, '0xde0b6b3a7640000']);
    await rpc('eth_sendTransaction', [{ from: address, to: config.fund, data, gas: '0x30d40' }]);
  }
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aktualisieren', exact: true })).toBeEnabled();

  const approvalsData = encodeFunctionData({ abi: contracts.fund, functionName: 'approvals', args: [config.ngos[0], reasonHash] });
  let notifyDelayed!: () => void;
  const delayed = new Promise<void>(resolve => { notifyDelayed = resolve; });
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  let delayOnce = true;
  await page.route('http://127.0.0.1:8545/', async route => {
    const body = route.request().postDataJSON();
    if (delayOnce && body.method === 'eth_call' && body.params?.[0]?.data === approvalsData) {
      delayOnce = false;
      const response = await route.fetch();
      notifyDelayed();
      await released;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await delayed;
  await page.locator('#reason').fill('Another reason, no approvals');
  await expect(page.getByText('0 / 2', { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Aktualisieren', exact: true })).toBeEnabled();
  await expect(page.getByText('0 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1.000 dUSD freigeben', exact: true })).toBeDisabled();
  await page.locator('#reason').fill(reason);
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
});
