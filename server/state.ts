import {type Area,type Coverage,type Hazard} from '../src/v3/domain.ts';
import {account} from '../src/v3/chain.ts';
export interface Role {id:string;kind:'ngo'|'data'|'evidence'|'appeal';index:number;ngo?:string;name:string;}
export const roles:Role[]=[...Array.from({length:3},(_,i)=>({id:`ngo-${i+1}`,kind:'ngo' as const,index:i+1,ngo:account(i+1).address,name:['Relief North','Health Bridge','Shelter Collective'][i]!})),...(['data','evidence','appeal'] as const).flatMap((kind,k)=>Array.from({length:3},(_,i)=>({id:`${kind}-${i+1}`,kind,index:4+k*3+i,name:`${kind} ${i+1}`})))];
export interface OperatingPackage {id:string;version:1;ngo:string;areaId:string;service:'essential-relief';sector:number;sectors:3;synthetic:true;}
export interface Incident {id:string;name:string;hazard:Hazard;areaId:string;people:[number,number];features:number[];synthetic:true;}
export interface App {id:string;version:number;ngo:string;incident:string;requested:string;capacity:string;external:string;explanation:string;change:string;conflicts:number;nonce:number;createdAt:number;expires:number;maximum:string;deadlineDays:number;sources:string;votes:string[];chainId?:number;tx?:string;status:'submitted'|'reviewed'|'reserved'|'paid'|'expired'|'rejected';}
export interface Doc {id:string;evidenceId:number;ngo:string;name:string;mime:string;size:number;uploaded:boolean;digest?:string;salt:string;createdAt:number;}
export interface Review {id:string;kind:'receipt'|'review'|'extend'|'resolve'|'followup';evidenceId:number;applicationId?:string;manifest:string;reason:string;decision:number;receivedAt:number;days:number;votes:string[];tx?:string;}
export interface Round {id:string;version:number;createdAt:number;expires:number;nonce:number;balance:string;reserved:string;uncertain:boolean;competing:boolean;provisional:string;snapshot:string;grants:{application:bigint|string;amount:bigint|string}[];explanation:unknown;votes:string[];tx?:string;}
export interface Report {id:string;ngo:string;evidenceId:number;title:string;text:string;provenance:string;rights:string;protection:string;approvedBy:string[];published:boolean;}
export interface State {schema:1;registryVersion:1;alliance:{id:string;name:string};roles:Role[];areas:Area[];packages:OperatingPackage[];incidents:Incident[];coverage:Coverage[];apps:App[];documents:Doc[];reviews:Review[];rounds:Round[];reports:Report[];reminders:{evidenceId:number;kind:string;at:number}[];worker:{at:number;status:string;error?:string};indexer:{block:string;hash:string;status:string};}
export function seed():State {return {schema:1,registryVersion:1,alliance:{id:'local-alliance',name:'DisasterDAO Relief Alliance'},roles,areas:[
 {id:'turkiye',version:1,name:'Synthetic southern Türkiye area',country:'TR',bbox:[35,36,39,39],hazards:['earthquake','flood','health']},
 {id:'philippines',version:1,name:'Synthetic Philippines area',country:'PH',bbox:[120,10,125,18],hazards:['storm','flood','health']},
 {id:'mozambique',version:1,name:'Synthetic Mozambique area',country:'MZ',bbox:[32,-26,40,-11],hazards:['storm','flood','health']}
 ],packages:roles.filter(r=>r.kind==='ngo').flatMap((r,sector)=>['turkiye','philippines','mozambique'].map(areaId=>({id:`${r.id}/${areaId}/essential-relief`,version:1 as const,ngo:r.ngo!,areaId,service:'essential-relief' as const,sector,sectors:3 as const,synthetic:true as const}))),incidents:[
 {id:'demo-quake',name:'Synthetic earthquake response',hazard:'earthquake',areaId:'turkiye',people:[1000,1800],features:[7.1,150,.7,.7,1],synthetic:true},
 {id:'demo-storm',name:'Synthetic storm response',hazard:'storm',areaId:'philippines',people:[1200,2200],features:[100,200,.6,.5,1],synthetic:true},
 {id:'demo-health',name:'Synthetic acute health response',hazard:'health',areaId:'mozambique',people:[800,1500],features:[1,100,.4,.4,1],synthetic:true}
 ],coverage:[],apps:[],documents:[],reviews:[],rounds:[],reports:[],reminders:[],worker:{at:0,status:'not-run'},indexer:{block:'0',hash:'',status:'not-run'}};}
