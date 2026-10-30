import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewPayout,curveDefinitions } from './payout-preview.ts';
import { campaigns,campaignHashes } from './campaigns.ts';
import {verifySignedResponse} from './vendor/airnode-v2.ts';

test('preview matches independently generated decimal reference within 0.01 dUSD',async()=>{
  const ref=JSON.parse(await readFile('test/fixtures/payout-reference.json','utf8'));
  ref.x.forEach((x:number,i:number)=>assert.ok(Math.abs(previewPayout(0,x/1e6)-ref.y[i]/1e6)<0.01));
});
test('display defaults match deployment rules and cap, independent of pool balance',()=>{
  campaigns.forEach((c,i)=>{
    assert.equal(c.threshold,curveDefinitions[i]!.threshold);assert.equal(c.cap,curveDefinitions[i]!.cap);
    assert.equal(previewPayout(i,c.threshold-0.000001),0);assert.equal(previewPayout(i,c.threshold),500);
    assert.equal(previewPayout(i,c.cap),2000);assert.equal(previewPayout(i,Number.MAX_VALUE),2000);
  });
});
test('EONET fixture is signed for the independently configured exact request',async()=>{
  const r=JSON.parse(await readFile('fixtures/v2/eonet-real.json','utf8'));
  await verifySignedResponse(r,campaigns[1].signer,campaignHashes[1]!);
  assert.equal(JSON.parse(r.data).windSpeed,35);
  await assert.rejects(verifySignedResponse({...r,data:r.data.replace('35.00','64.00')},campaigns[1].signer,campaignHashes[1]!));
});
