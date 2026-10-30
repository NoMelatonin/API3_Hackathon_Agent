import {Database} from './store.ts';import {type State} from './state.ts';import {tick} from './worker.ts';
const db=new Database<State>();try{await tick(db);}finally{await db.pool.end();}
