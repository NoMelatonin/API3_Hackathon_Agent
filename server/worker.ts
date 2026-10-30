import {Database,json} from './store.ts';import {type State} from './state.ts';
import {chain,client} from '../src/v3/chain.ts';import {decodeEventLog,type Log} from 'viem';import {readFile} from 'node:fs/promises';
import {scanUSGS,scanEONET} from '../src/v3/sources.ts';import {chainEvidence,now,assessment} from './service.ts';
export async function tick(db:Database<State>,live=process.env.V3_LIVE_SOURCES==='1') {
 const time=await now();const state=await db.read();
 const coverage=live?(await Promise.all(state.areas.flatMap(area=>[scanUSGS(area,time),scanEONET(area,time)]))):state.coverage;
 try {
  const c=await chain();const tip=await client.getBlockNumber({cacheTime:0});const finalized=tip>2n?tip-2n:0n;
  const abi=JSON.parse(await readFile('out/DisasterFundV3.sol/DisasterFundV3.json','utf8')).abi;
  // Rebuild from deployment through confirmed tip. On this bounded local chain, replacement is cheap,
  // removes orphaned rows after any reorg and gives restart-idempotence without trusting a stale cursor.
  const logs:Log[]=[];for(let from=BigInt(c.config.deployedBlock);from<=finalized;from+=1000n){const to=from+999n<finalized?from+999n:finalized;logs.push(...await client.getLogs({address:c.config.fund,fromBlock:from,toBlock:to}));}
  const block=await client.getBlock({blockNumber:finalized});const evidence=await chainEvidence();
  const connection=await db.pool.connect();try{await connection.query('BEGIN');await connection.query('DELETE FROM v3_chain_log');for(const log of logs){let decoded;try{decoded=decodeEventLog({abi,data:log.data,topics:log.topics});}catch{continue;}await connection.query('INSERT INTO v3_chain_log VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[String(log.blockNumber),log.blockHash,log.transactionHash,log.logIndex,json(decoded)]);}await connection.query('COMMIT');}catch(e){await connection.query('ROLLBACK');throw e;}finally{connection.release();}
  await db.transaction(async(s)=>{
   s.coverage=coverage;s.worker={at:time,status:live?'live unsigned source scan; unsupported hazards remain unknown':'offline simulation; actual coverage unknown'};s.indexer={block:String(finalized),hash:block.hash,status:'confirmed (2 blocks), rebuilt idempotently'};
   for(const e of evidence){for(const [kind,due] of [['interim',e.interimDue],['final',e.due]] as const)if(time>=due&&!s.reminders.some(r=>r.evidenceId===e.id&&r.kind===kind))s.reminders.push({evidenceId:e.id,kind,at:time});}
   for(const app of s.apps){if(!app.chainId&&app.votes.length>=2){const key=await c.read('keyFor',[app.ngo,assessment(app).incident]);const id=Number(await c.read('openApplication',[key]));if(id>0){const current=await c.read('applications',[BigInt(id)]) as unknown[];if(current[1]===await c.read('assessmentHash',[assessment(app)])){app.chainId=id;app.status='reviewed';}}}}
   for(const r of s.rounds.filter(r=>!r.tx)){const match=logs.find(log=>{try{const event=decodeEventLog({abi,data:log.data,topics:log.topics}) as {eventName:string;args:{snapshot?:string}};return event.eventName==='RoundClosed'&&event.args.snapshot===r.snapshot;}catch{return false;}});if(match)r.tx=match.transactionHash??undefined;}
  });
 }catch(e){await db.transaction(async(s)=>{s.worker={at:time,status:'failed',error:e instanceof Error?e.message:'worker failure'};s.indexer.status='failed';});throw e;}
}
