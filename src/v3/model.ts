import {POLICY,commitment,type Hazard} from './domain.ts';
export interface Comparable {id:string; event:string; time:number; hazard:Hazard; service:string; days:number; kind:'actual'|'requirement';
 people:number; amount:number; currency:'EUR'; priceYear:2026; features:readonly (number|null)[]; region:string; source:string; license:string; synthetic:boolean; error?:string;}
export interface EstimateInput {hazard:Hazard;service:string;kind:'actual'|'requirement';time:number;people:readonly [number,number];features:readonly (number|null)[]; synthetic:boolean;}
export const MODEL_VERSION='nearest-robust-equal-v3.1';
const quantile=(values:number[],p:number)=> {const xs=[...values].sort((a,b)=>a-b);return xs[Math.min(xs.length-1,Math.floor(xs.length*p))]??0;};
function weightedQ(values:{value:number;weight:number}[],p:number) {const xs=[...values].sort((a,b)=>a.value-b.value);const threshold=xs.reduce((s,x)=>s+x.weight,0)*p;let sum=0;for(const x of xs){sum+=x.weight;if(sum>=threshold)return x.value;}return xs.at(-1)?.value??0;}
export function estimate(input:EstimateInput,corpus:Comparable[]) {
 if(input.people[0]<0||input.people[1]<input.people[0]||!input.people.every(Number.isFinite))throw new Error('Invalid affected-population interval');
 const excluded=corpus.filter(c=>c.error||c.hazard!==input.hazard||c.service!==input.service||c.days!==30||c.kind!==input.kind||c.time>=input.time||c.synthetic!==input.synthetic||!c.source||!c.license||c.people<=0||c.amount<=0||!Number.isFinite(c.amount));
 const eligible=corpus.filter(c=>!excluded.includes(c));
 const features=input.features.length;
 const scales=Array.from({length:features},(_,i)=>{
  const xs=eligible.map(c=>c.features[i]).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
  const med=quantile(xs,0.5);const mad=quantile(xs.map(x=>Math.abs(x-med)),0.5);return mad||1;
 });
 const missing=input.features.some(x=>x===null||!Number.isFinite(x));
 const scored=eligible.filter(c=>c.features.length===features&&c.features.every(x=>x!==null&&Number.isFinite(x))).map(c=>({c,d:Math.sqrt(c.features.reduce<number>((sum,x,i)=>sum+((x!-(input.features[i]??0))/scales[i]!)**2,0)/Math.max(1,features))})).sort((a,b)=>a.d-b.d||a.c.id.localeCompare(b.c.id));
 // One independent event contributes once, including related event families.
 const events=new Set<string>();const selected=scored.filter(x=>{if(events.has(x.c.event))return false;events.add(x.c.event);return true;}).slice(0,20);
 const ready=!missing&&selected.length>=10;
 const values=selected.map(x=>({value:x.c.amount/x.c.people,weight:1/(1+x.d)}));
 const q75=weightedQ(values,0.75),median=weightedQ(values,0.5),q25=weightedQ(values,0.25);
 const extremeCutoff=quantile(values.map(x=>x.value),0.75)+3*(quantile(values.map(x=>x.value),0.75)-quantile(values.map(x=>x.value),0.25));
 const without=values.filter(x=>x.value<=extremeCutoff);
 const euros=ready?q75*input.people[1]:null;
 // Policy reference = fictitious EUR 100,000 per 30-day service package. Never an exchange rate.
 const demo=euros===null?null:BigInt(Math.floor(Math.min(4500,2000*euros/100000)*1e6));
 return {version:MODEL_VERSION,status:ready?(input.synthetic?'synthetic-demo':'empirical-candidate'):'manual-review-required',automaticRelease:false,
  reason:ready?'Data reviewers must validate the versioned source manifest':'At least ten independent complete comparable events and all required features are needed',
  kind:input.kind,unit:'EUR (2026 price basis) per reachable affected person / 30 days',q75,median,dispersion:[q25,q75],
  interval:ready?[q25*input.people[0],q75*input.people[1]]:null,euros,demoMaximum:demo?.toString()??null,
  referencePolicy:'v3.1: synthetic EUR 100000 reference → 2000 dUSD; policy scaling, not FX or real cost coverage',
  sensitivityWithoutExtremes:weightedQ(without,0.75)*input.people[1],extremeEvents:selected.filter(x=>x.c.amount/x.c.people>extremeCutoff).map(x=>x.c.id),
  selected:selected.map(x=>({id:x.c.id,event:x.c.event,source:x.c.source,ageDays:Math.floor((input.time-x.c.time)/86400),distance:x.d,weight:1/(1+x.d),amount:x.c.amount,people:x.c.people})),
  excluded:excluded.map(c=>({id:c.id,reason:c.error??'Wrong unit, provenance, period, type, synthetic status or future observation'})),
  sourceCommitment:commitment(selected.map(x=>x.c)),synthetic:input.synthetic};
}
export const syntheticCases:Comparable[]=Array.from({length:18},(_,i)=>({id:`SYNTHETIC-${i}`,event:`fictitious-event-${i}`,time:1600000000+i*10000000,hazard:'earthquake',service:'essential-relief',days:30,kind:'actual',people:800+i*100,amount:50000+i*7000,currency:'EUR',priceYear:2026,features:[5+i/10,100+i*10,0.5+i/50,0.7,1],region:i%2?'poorly-documented-demo':'well-documented-demo',source:'FICTITIOUS: no real expenditure or impact',license:'Synthetic project test data',synthetic:true}));
export function backtest(corpus:Comparable[]) {
 const rows=corpus.map(c=>{const result=estimate({hazard:c.hazard,service:c.service,kind:c.kind,time:c.time,people:[c.people,c.people],features:c.features,synthetic:c.synthetic},corpus.filter(x=>x.event!==c.event));return {id:c.id,region:c.region,eligible:result.euros!==null,actual:c.amount,predicted:result.euros,ratio:result.euros===null?null:result.euros/c.amount};});
 return {method:'Forward-time; entire event family withheld; no claim of real-world validation',rows,regions:[...new Set(corpus.map(c=>c.region))].map(region=>{const group=rows.filter(r=>r.region===region);return {region,coverage:group.filter(r=>r.eligible).length/group.length,ratios:group.flatMap(r=>r.ratio===null?[]:[r.ratio])};})};
}
