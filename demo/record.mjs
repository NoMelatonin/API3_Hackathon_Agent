import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { encodePacked, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Run after the browser tests on a fresh local deployment. No secret is loaded by this recorder.
const config = JSON.parse(await readFile('public/deployment.local.json', 'utf8'));
const good = JSON.parse(await readFile('fixtures/usgs-fresh.json', 'utf8'));
const old = JSON.parse(await readFile('fixtures/usgs-real.json', 'utf8'));
const other = JSON.parse(await readFile('fixtures/usgs-other.json', 'utf8'));
async function rpc(method, params = []) {
  const r = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const json = await r.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
if (Number(await rpc('eth_chainId')) !== 31337) throw new Error('Recorder only transacts on Anvil 31337.');
const snapshot = await rpc('evm_snapshot');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
await mkdir('demo/videos', { recursive: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
  recordVideo: { dir: 'demo/videos', size: { width: 1280, height: 900 } } });
const page = await context.newPage();
const started = Date.now();
const video = page.video();
try {
  await rpc('evm_setNextBlockTimestamp', [Number(good.timestamp)]); await rpc('evm_mine');
  await page.addInitScript(({ account }) => {
    window.__testAccount = account;
    window.ethereum = { request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [window.__testAccount];
      if (method === 'wallet_switchEthereumChain') return null;
      const r = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }) });
      const json = await r.json(); if (json.error) throw new Error(json.error.message); return json.result;
    } };
  }, { account: config.deployer });
  async function caption(title, text, hold = 2400) {
    await page.evaluate(({ title, text }) => {
      let overlay = document.getElementById('demo-caption');
      if (!overlay) {
        overlay = document.createElement('aside'); overlay.id = 'demo-caption';
        overlay.style.cssText = 'position:fixed;bottom:16px;left:24px;right:24px;background:#122e2bf2;color:white;border:1px solid #b9cd8a;border-radius:12px;padding:15px 22px;z-index:99999;font:15px/1.5 system-ui;pointer-events:none;box-shadow:0 8px 35px #0003';
        document.body.append(overlay);
      }
      overlay.replaceChildren();
      const heading = document.createElement('strong'); heading.textContent = title; heading.style.cssText = 'display:block;color:#e2eda7;font-size:18px;margin-bottom:5px';
      const body = document.createElement('span'); body.textContent = text;
      overlay.append(heading, body);
    }, { title, text });
    await page.waitForTimeout(hold);
  }
  async function confirmed() { await page.getByRole('status').filter({ hasText: 'On-chain bestätigt' }).waitFor({ timeout: 15000 }); }
  await page.goto('http://127.0.0.1:5173/?local=1');
  await page.getByRole('status').filter({ hasText: 'Fonds bereit' }).waitFor();
  await caption('DisasterDAO · Gemeinsame Soforthilfe', 'Lokaler Funktionsmitschnitt: echte AirnodeHub-Signaturen, historische Chain-Uhr, fiktive NGOs. Testnet-Nachweise am Ende.', 6500);
  await page.locator('.columns').scrollIntoViewIfNeeded();
  await caption('3 Organisationen · 3.000 dUSD · gemeinsame Regeln', 'Je 1.000 dUSD. Kein Administrator kann die aktivierten Regeln ändern oder den Pool beliebig abziehen.', 5000);
  await page.getByRole('button', { name: 'Signaturprüfung / Jury' }).click();
  await page.getByLabel(/^Originale Attestation/).fill(JSON.stringify(good, null, 2));
  await page.getByRole('button', { name: 'Signatur prüfen & auszahlen' }).scrollIntoViewIfNeeded();
  await caption('Echte signierte USGS-Antwort', 'Der API3-Airnode signiert Magnitude 7,8, Ereignis-ID, Zeit und Ort. Der Contract prüft Signer, Anfrage und Zeitbedingungen.', 5000);
  await page.getByRole('button', { name: 'Signatur prüfen & auszahlen' }).click(); await confirmed();
  await caption('Gültiger Fall: 1.000 dUSD ausgezahlt', 'Die Auszahlung hängt vom Wert in den authentifizierten Originalbytes ab. Der Relayer erhält nichts.', 4000);
  await page.locator('#claim-ngo').selectOption('1');
  const wrong = privateKeyToAccount(`0x${'1'.padStart(64, '0')}`); // Public test-only key, not a project key.
  const signature = await wrong.signMessage({ message: { raw: keccak256(encodePacked(
    ['bytes32', 'uint256', 'bytes'], [config.requestHash, BigInt(good.timestamp), toHex(good.data)]
  )) } });
  const cases = [
    ['1/4 · Datenwert verändert', { ...good, data: good.data.replace('"magnitude":7.8', '"magnitude":9.8') }, 'NotSignedByAirnode', 'Ein veränderter Wert passt nicht mehr zur echten Signatur.'],
    ['2/4 · Echte Antwort zu alt', old, 'ResponseTooOld', 'Eine unveränderte echte ältere Antwort scheitert an der Altersprüfung. Ihr Zeitstempel wurde nicht verändert.'],
    ['3/4 · Echte andere Anfrage', other, 'NotSignedByAirnode', 'Eine andere signierte Projektion hat einen anderen Anfragehash. Der Contract akzeptiert nur die vereinbarte Anfrage.'],
    ['4/4 · Fremder Signaturschlüssel', { ...good, signature }, 'NotSignedByAirnode', 'Eine syntaktisch gültige Signatur eines anderen Schlüssels ist keine Airnode-Antwort.'],
  ];
  for (const [title, response, expected, text] of cases) {
    await page.getByLabel(/^Originale Attestation/).fill(JSON.stringify(response, null, 2));
    await page.getByRole('button', { name: 'Im Contract simulieren' }).click();
    await page.getByRole('status').filter({ hasText: expected }).waitFor();
    await page.getByRole('status').scrollIntoViewIfNeeded();
    await caption(title, `${text} Contract-Simulation abgewiesen; keine Auszahlung.`, 4500);
  }
  await page.getByRole('button', { name: 'Einsatz & Freigabe' }).click();
  await page.locator('#ngo').selectOption('1');
  await page.getByRole('heading', { name: 'Wenn Daten fehlen.' }).scrollIntoViewIfNeeded();
  await caption('Menschlicher Notfallweg · 2 von 3', 'Zwei unterschiedliche Verantwortliche müssen denselben Empfänger und dieselbe Begründung genehmigen.', 4000);
  for (const address of config.committee.slice(0, 2)) {
    await rpc('anvil_impersonateAccount', [address]); await rpc('anvil_setBalance', [address, '0xde0b6b3a7640000']);
    await page.evaluate(address => { window.__testAccount = address; }, address);
    await page.getByRole('button', { name: 'Als Verantwortlicher genehmigen' }).click(); await confirmed();
  }
  await page.getByRole('button', { name: '1.000 dUSD freigeben' }).click(); await confirmed();
  await page.locator('.history').scrollIntoViewIfNeeded();
  await caption('Dasselbe Budget. Kein zweiter Anspruch.', 'Oracle- und Notfallzahlung verbrauchen denselben einmaligen Anspruch. Herkunft und Entscheidungsgrund bleiben sichtbar.', 5000);
  // This final scene reads the actual Base Sepolia deployment; no public-chain transaction is signed by this recorder.
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('status').filter({ hasText: 'Fonds bereit' }).waitFor({ timeout: 25000 });
  await caption('Auf Base Sepolia tatsächlich bestätigt', 'Fonds 0x8b1c…7257: echte Oracle-Auszahlung und echte 2/3-Notfallzahlung. Die Transaktionslinks liegen im Repository.', 6000);
  await page.locator('.history').scrollIntoViewIfNeeded();
  await caption('Signatur ist kein Nachweis humanitären Bedarfs', 'USGS liefert Daten; API3 signiert die Antwort. Keine echten NGOs oder Mittel, keine geprüfte Wirkung. Setup und alle fünf Fälle sind reproduzierbar.', 6500);
} finally {
  await context.close();
  await video.saveAs('demo/DisasterDAO-demo.webm');
  await browser.close(); await rpc('evm_revert', [snapshot]);
}
const seconds = (Date.now() - started) / 1000;
await writeFile('demo/video-info.json', JSON.stringify({ seconds, audio: false,
  type: 'local functional walkthrough with genuine signed fixtures, then read-only live Base Sepolia evidence',
  file: 'DisasterDAO-demo.webm' }, null, 2) + '\n');
if (seconds > 150) throw new Error(`Video capture exceeded the 150-second limit: ${seconds}`);
console.log(`Saved demo/DisasterDAO-demo.webm (${seconds.toFixed(1)} seconds, captions, no audio).`);
