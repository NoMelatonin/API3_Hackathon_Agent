import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {Database,Documents} from './store.ts';import {seed,type State} from './state.ts';import {buildApp} from './app.ts';
import {client,chain} from '../src/v3/chain.ts';import {testActions} from 'viem';import pg from 'pg';import {tick} from './worker.ts';
const enabled=process.env.V3_INTEGRATION==='1';
test('complete isolated PostgreSQL/S3/chain workflow, tenant security, two signatures and publication', {skip:!enabled},async()=>{
 const base=new pg.Pool({connectionString:'postgres://localdemo:localdemo-only@127.0.0.1:5437/disasterdao'});const schema=`v3_test_${Date.now()}`;await base.query(`CREATE SCHEMA ${schema}`);
 const db=new Database<State>();await db.pool.end();db.pool=new pg.Pool({connectionString:'postgres://localdemo:localdemo-only@127.0.0.1:5437/disasterdao',options:`-c search_path=${schema}`});await db.init(seed());
 const docs=new Documents(randomBytes(32));docs.bucket=`test-${schema.replaceAll('_','-')}`;await docs.init();const app=await buildApp(db,docs,randomBytes(32));const tc=client.extend(testActions({mode:'anvil'})),snapshot=await tc.snapshot();let cookie='';
 const call=async(method:string,url:string,payload?:unknown)=>app.inject({method:method as 'GET'|'POST'|'PUT',url,headers:{host:'127.0.0.1:3007','x-v3-request':'local-prototype',cookie},...(payload===undefined?{}:{payload:payload as never})});
 const login=async(role:string)=>{const r=await call('POST','/api/v3/session',{role});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0]!;};
 const ok=async(method:string,url:string,payload?:unknown)=>{const r=await call(method,url,payload);assert.equal(r.statusCode,200,r.body);return r.json();};
 try {
  assert.equal((await call('GET','/api/v3/portal')).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/api/v3/session',headers:{host:'127.0.0.1:3007',origin:'https://evil.example','x-v3-request':'local-prototype'},payload:{role:'data-1'}})).statusCode,403);
  await login('ngo-1');const body={incident:'demo-quake',requested:'500000000',capacity:'500000000',external:'0',explanation:'Synthetic manually assessed 30-day relief package; no actual cost evidence.',change:'',conflicts:0};const a=await ok('POST','/api/v3/applications',body);
  assert.equal((await call('POST',`/api/v3/applications/${a.id}`,{action:'approve'})).statusCode,403);
  await login('ngo-2');assert.equal((await ok('GET','/api/v3/portal')).apps.length,0);
  await login('data-1');await ok('POST',`/api/v3/applications/${a.id}`,{action:'approve'});assert.equal((await chain()).config.chainId,31337);
  const state1=await db.read();assert.equal(state1.apps[0]!.chainId,undefined);
  await login('data-2');await ok('POST',`/api/v3/applications/${a.id}`,{action:'approve'});assert.ok((await db.read()).apps[0]!.chainId);
  const round=await ok('POST','/api/v3/rounds');assert.equal(round.uncertain,true);assert.equal(round.competing,true);assert.ok(BigInt(round.provisional)>0n);
  await login('data-1');await ok('POST',`/api/v3/rounds/${round.id}/approve`);assert.equal(await (await chain()).read('reservationCount'),0n);
  await login('data-2');await ok('POST',`/api/v3/rounds/${round.id}/approve`);await login('ngo-2');assert.equal((await call('POST','/api/v3/reservations/1',{action:'claim'})).statusCode,403);
  await login('ngo-1');await ok('POST','/api/v3/reservations/1',{action:'claim'});
  const plain=Buffer.from('DISASTERDAO SYNTHETIC\nFictitious invoice, payment reconciliation and delivery receipt.');const ticket=await ok('POST','/api/v3/uploads',{evidenceId:1,name:'fictitious-invoice.txt',mime:'text/plain',size:plain.length,synthetic:true});
  const put=()=>app.inject({method:'PUT',url:ticket.url,headers:{host:'127.0.0.1:3007','x-v3-request':'local-prototype',cookie,'content-type':'text/plain'},payload:plain});assert.equal((await put()).statusCode,200);assert.equal((await put()).statusCode,403);
  const stored=await docs.client.send(new (await import('@aws-sdk/client-s3')).GetObjectCommand({Bucket:docs.bucket,Key:ticket.id}));const encrypted=Buffer.from(await stored.Body!.transformToByteArray());assert.equal(encrypted.includes(plain),false);assert.deepEqual(await docs.get(ticket.id),plain);
  await login('ngo-2');assert.equal((await call('POST',`/api/v3/documents/${ticket.id}/access`)).statusCode,403);
  await login('data-1');assert.equal((await call('POST',`/api/v3/documents/${ticket.id}/access`)).statusCode,403);
  await login('evidence-1');const receipt=await ok('POST','/api/v3/reviews',{kind:'receipt',evidenceId:1,reason:'Confirmed synthetic document receipt; no conflict declared.',decision:0,days:0});await ok('POST',`/api/v3/reviews/${receipt.id}/approve`);await login('evidence-2');await ok('POST',`/api/v3/reviews/${receipt.id}/approve`);
  await login('evidence-1');const review=await ok('POST','/api/v3/reviews',{kind:'review',evidenceId:1,reason:'Fictitious invoices, payments, delivery and sample checks complete; no conflict.',decision:2,days:0});await ok('POST',`/api/v3/reviews/${review.id}/approve`);await login('evidence-2');await ok('POST',`/api/v3/reviews/${review.id}/approve`);
  await login('ngo-1');const report=await ok('POST','/api/v3/reports',{evidenceId:1,title:'Synthetic reviewed relief',text:'<script>alert(1)</script> Fictitious outcome, not actual impact.',provenance:'Fictitious editorial example',rights:'Synthetic project content',protection:'No people or exact beneficiary locations'});
  assert.equal((await ok('GET','/api/v3/public')).reports.length,0);await login('evidence-1');await ok('POST',`/api/v3/reports/${report.id}/approve`);await login('evidence-2');await ok('POST',`/api/v3/reports/${report.id}/approve`);assert.equal((await ok('GET','/api/v3/public')).reports.length,1);
  await tc.mine({blocks:3});await tick(db,false);const first=await db.pool.query('SELECT count(*) FROM v3_chain_log');await tick(db,false);assert.equal((await db.pool.query('SELECT count(*) FROM v3_chain_log')).rows[0].count,first.rows[0].count);
  const checkpoint=await tc.snapshot();await tc.revert({id:snapshot});await tc.mine({blocks:3});await tick(db,false);assert.equal((await db.pool.query("SELECT count(*) FROM v3_chain_log WHERE body->>'eventName'='Paid'")).rows[0].count,'0'); // orphan logs removed
 }finally{await tc.revert({id:snapshot}).catch(()=>{});await app.close();await db.pool.end();await base.query(`DROP SCHEMA ${schema} CASCADE`);await base.end();}
});
