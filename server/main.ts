import {Database,Documents,localSecret} from './store.ts';import {seed,type State} from './state.ts';import {buildApp} from './app.ts';import {tick} from './worker.ts';
const db=new Database<State>();await db.init(seed());const docs=new Documents(await localSecret('documents'));await docs.init();
const app=await buildApp(db,docs,await localSecret('sessions'));await app.listen({host:'127.0.0.1',port:3007});
console.log('V3 local backend: http://127.0.0.1:3007 — all roles simulated, synthetic documents only');
let running=false;async function work(){if(running)return;running=true;try{await tick(db);}catch{console.error('V3 worker failed; visible in portal status');}finally{running=false;}}await work();const timer=setInterval(work,30000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{clearInterval(timer);await app.close();await db.pool.end();process.exit(0);});
