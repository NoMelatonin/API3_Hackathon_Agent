import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {encodeFunctionData,keccak256,toHex} from 'viem';
const config=JSON.parse(await readFile('public/deployment.v2.local.json','utf8'));
const abi=JSON.parse(await readFile('web/contracts-v2.json','utf8')).fund;
const usgs=JSON.parse(await readFile('fixtures/usgs-real.json','utf8'));
const eonet=JSON.parse(await readFile('fixtures/v2/eonet-real.json','utf8'));
async function rpc(method:string,params:unknown[]=[]) {
  const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const body=await r.json();if(body.error)throw new Error(body.error.message);return body.result;
}
let snapshot:string;
test.beforeEach(async({page})=>{
  snapshot=await rpc('evm_snapshot');
  await rpc('evm_setNextBlockTimestamp',[Number(usgs.timestamp)]);await rpc('evm_mine');
  await page.addInitScript(({account})=>{
    (window as any).__testAccount=account;
    (window as any).ethereum={request:async({method,params}:any)=>{
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [(window as any).__testAccount];
      if(method==='wallet_switchEthereumChain')return null;
      const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:params??[]})});
      const b=await r.json();if(b.error)throw new Error(b.error.message);return b.result;
    }};
  },{account:config.deployer});
  await page.goto('/?local=1');await expect(page.getByRole('status')).toContainText('Fonds bereit');
});
test.afterEach(async()=>{if(snapshot)await rpc('evm_revert',[snapshot]);});
test('USGS contract quote pays dynamic amount, history counts events, replay rejected',async({page})=>{
  await page.getByLabel('Originale Attestation').fill(JSON.stringify(usgs));
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('1.227,35');
  await page.getByRole('button',{name:'Auszahlen →',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('On-chain bestätigt');
  await expect(page.locator('.payment-list')).toContainText('1.227,35');
  await expect(page.getByText('1 bestätigte Einträge')).toBeVisible();
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('AlreadyClaimed');
});
test('EONET authentic fixture quotes and pays its quadratic amount',async({page})=>{
  await rpc('evm_setNextBlockTimestamp',[Number(eonet.timestamp)]);await rpc('evm_mine');
  await page.getByRole('button',{name:/01?2 \/ NASA EONET|02 \/ NASA EONET/}).click();
  await page.getByLabel('Originale Attestation').fill(JSON.stringify(eonet));
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('535,2');
  await page.getByRole('button',{name:'Auszahlen →',exact:true}).click();
  await expect(page.locator('.payment-list')).toContainText('NASA EONET');
  await expect(page.locator('.payment-list')).toContainText('535,2');
});
test('tampering fails and WHO is explicitly blocked',async({page})=>{
  await page.getByLabel('Originale Attestation').fill(JSON.stringify({...usgs,data:usgs.data.replace('7.8','8.0')}));
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('NotSignedByAirnode');
  await expect(page.getByRole('button',{name:'Auszahlen →',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/03 \/ WHO GHO/}).click();
  await expect(page.locator('.warning')).toContainText('Keine echte WHO-Antwort');
  await expect(page.getByRole('button',{name:'Im Contract simulieren',exact:true})).toBeDisabled();
});
test('simulation without wallet and slider cannot authorize a payout',async({page})=>{
  await page.evaluate(()=>{delete window.ethereum;});
  await page.locator('#severity-slider').fill('8');
  await expect(page.getByRole('button',{name:'Auszahlen →',exact:true})).toBeDisabled();
  await page.getByLabel('Originale Attestation').fill(JSON.stringify(usgs));
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Contract-Simulation akzeptiert');
  await page.getByRole('button',{name:'Auszahlen →',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Browserwallet');
  await expect(page.locator('.empty')).toBeVisible();
});
test('emergency quorum is isolated by campaign, NGO and reason',async({page})=>{
  const reason='Oracle unavailable; historical exercise; post-review required';
  const hash=keccak256(toHex(reason));
  for(const address of config.committee.slice(0,2))await rpc('eth_sendTransaction',[{from:address,to:config.fund,data:encodeFunctionData({abi,functionName:'approveEmergency',args:[0,config.ngos[0],hash]}),gas:'0x7a120'}]);
  await page.getByRole('button',{name:/Gemeinsamer Notfallweg/}).click();
  await page.getByRole('button',{name:'Aktualisieren',exact:true}).click();
  await expect(page.getByText('2 / 2',{exact:true})).toBeVisible();
  await page.getByLabel('Öffentliche Begründung').fill('Different reason');
  await expect(page.getByText('0 / 2',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'1.000 dUSD freigeben'})).toBeDisabled();
  await page.getByLabel('Öffentliche Begründung').fill(reason);
  await expect(page.getByText('2 / 2',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'1.000 dUSD freigeben'}).click();
  await expect(page.locator('.payment-list')).toContainText('2/3-Notfallquorum');
  await page.getByRole('button',{name:/02 \/ NASA EONET/}).click();
  await expect(page.getByText('0 / 2',{exact:true})).toBeVisible();
});
for(const width of [375,768,1440])test(`layout ${width}px fits viewport`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/v2-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:/03 \/ WHO GHO/}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('RPC failure is an error, never a successful simulation',async({page})=>{
  await page.route('http://127.0.0.1:8545/',route=>route.abort());
  await page.getByLabel('Originale Attestation').fill(JSON.stringify(usgs));
  await page.getByRole('button',{name:'Im Contract simulieren',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('HTTP request failed');
  await expect(page.getByRole('button',{name:'Auszahlen →',exact:true})).toBeDisabled();
});
