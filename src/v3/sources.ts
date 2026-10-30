import {commitment, overlaps,type Area,type Coverage,type Observation} from './domain.ts';
type Fetcher=(url:string)=>Promise<unknown>;
const fetchJSON:Fetcher=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Upstream HTTP ${r.status}`);return r.json();};
export const SOURCE_REGISTRY=[
 {id:'USGS',use:'earthquake catalogue; not humanitarian need',url:'https://earthquake.usgs.gov/fdsnws/event/1/',rights:'USGS public data; third-party products need separate checks',signed:'Existing historical Airnode fixture only; live adapter is unsigned'},
 {id:'EONET',use:'event catalogue; not complete impact coverage',url:'https://eonet.gsfc.nasa.gov/docs/v3',rights:'NASA disclaimer; original linked sources retain own rights',signed:'Existing historical Airnode fixture only; live adapter is unsigned'},
 {id:'GDACS',use:'hazard coverage',url:'https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf',rights:'Pending verification',signed:'No established adapter'},
 {id:'WHO',use:'annual context only; never an acute outbreak trigger',url:'https://www.who.int/data/gho/info/gho-odata-api',rights:'Check WHO terms before reuse',signed:'Nigeria Airnode query remains blocked'},
 {id:'WorldPop',use:'modelled exposure, not affected people',url:'https://api.worldpop.org/v2/',rights:'Dataset-specific license/version/year required',signed:'No established adapter'},
 {id:'EM-DAT',use:'historical impact, not relief cost',url:'https://doc.emdat.be/docs/data-accessibility/',rights:'Access and reuse approval required',signed:'No established adapter'},
 {id:'OCHA FTS',use:'requirements/pledges/disbursements must remain separate',url:'https://fts.unocha.org/',rights:'Source-specific permission review pending',signed:'No established adapter'},
];
export async function scanUSGS(area:Area,now:number,get:Fetcher=fetchJSON,pageSize=200):Promise<Coverage> {
 const base:Coverage={source:'USGS',areaId:area.id,areaVersion:area.version,hazards:['earthquake'],start:now-86400,end:now,checkedAt:now,status:'ok',pages:0,complete:false,observations:[]};
 try {
  const ids=new Set<string>(); let offset=1;
  for(let page=0;page<100;page++) {
   const q=new URLSearchParams({format:'geojson',starttime:new Date(base.start*1000).toISOString(),endtime:new Date(now*1000).toISOString(),minlongitude:String(area.bbox[0]),minlatitude:String(area.bbox[1]),maxlongitude:String(area.bbox[2]),maxlatitude:String(area.bbox[3]),limit:String(pageSize),offset:String(offset),orderby:'time-asc'});
   const raw=await get(`https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`) as {features?:Array<{id:string;properties:{time:number;mag:number|null;url:string};geometry:{type:string;coordinates:number[]}}>};
   if(!Array.isArray(raw.features))throw new Error('Invalid USGS structure');base.pages++;
   for(const f of raw.features) {
    const [lon,lat]=f.geometry.coordinates;
    if(f.geometry.type!=='Point'||!Number.isFinite(lon)||!Number.isFinite(lat)||!Number.isFinite(f.properties.time)||!f.id||ids.has(f.id))throw new Error('Invalid or repeated USGS page');
    ids.add(f.id);base.observations.push({id:f.id,canonicalId:`USGS:${f.id}`,source:'USGS',hazard:'earthquake',time:Math.floor(f.properties.time/1000),bbox:[lon!,lat!,lon!,lat!],severity:f.properties.mag,url:f.properties.url,rawCommitment:commitment(f)});
   }
   if(raw.features.length<pageSize){base.complete=true;break;}offset+=raw.features.length;
  }
  if(!base.complete)throw new Error('Pagination limit reached');
 }catch(e){base.status='failed';base.complete=false;base.error=String(e);}
 return base;
}
export async function scanEONET(area:Area,now:number,get:Fetcher=fetchJSON):Promise<Coverage> {
 const c:Coverage={source:'EONET',areaId:area.id,areaVersion:area.version,hazards:[],start:now-86400,end:now,checkedAt:now,status:'ok',pages:0,complete:false,observations:[]};
 // EONET is supplementary: even a fully fetched catalogue does not establish complete hazard coverage.
 try {
  const raw=await get(`https://eonet.gsfc.nasa.gov/api/v3/events?status=all&start=${new Date(c.start*1000).toISOString().slice(0,10)}&end=${new Date(now*1000).toISOString().slice(0,10)}`) as {events?:Array<{id:string;link:string;categories:{id:string}[];geometry:{type:string;date:string;magnitudeValue?:number;coordinates:number[]}[]}>};
  if(!Array.isArray(raw.events))throw new Error('Invalid EONET structure');c.pages=1;
  for(const e of raw.events)for(const g of e.geometry) {
   const hazard=e.categories.some(x=>x.id==='severeStorms')?'storm':e.categories.some(x=>x.id==='floods')?'flood':null;
   if(!hazard||g.type!=='Point'||g.coordinates.length!==2)continue;
   const [lon,lat]=g.coordinates;if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   const bbox=[lon!,lat!,lon!,lat!] as const;
   if(overlaps(bbox,area.bbox))c.observations.push({id:e.id,canonicalId:`EONET:${e.id}`,source:'EONET',hazard,time:Date.parse(g.date)/1000,bbox,severity:g.magnitudeValue??null,url:e.link,rawCommitment:commitment(e)});
  }
  c.complete=true;
 }catch(e){c.status='failed';c.error=String(e);}return c;
}
export function reconcile(observations:Observation[],links:Record<string,string>={}) {
 const grouped=new Map<string,Observation[]>();
 // Never auto-merge nearby events: only reviewed explicit cross-source links may establish identity.
 for(const o of observations){const id=links[o.canonicalId]??o.canonicalId;const list=grouped.get(id)??[];if(!list.some(x=>x.rawCommitment===o.rawCommitment))list.push(o);grouped.set(id,list);}return grouped;
}
