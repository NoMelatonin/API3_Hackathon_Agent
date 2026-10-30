/** Explanatory browser preview only. Contract quote is authoritative. */
export const curveDefinitions = [
  {name:'Türkei · Erdbeben',source:'USGS',date:'06.02.2023',threshold:7,cap:8,unit:'Magnitude',field:'magnitude',label:'Energie · exponentiell',formula:'10^(1,5 × (M − T))',sample:7.8},
  {name:'Tropical Storm 15W',source:'NASA EONET',date:'10.08.2026 · 06:00 UTC',threshold:34,cap:64,unit:'kts',field:'windSpeed',label:'Winddruck · quadratisch',formula:'v²',sample:35},
  {name:'Nigeria · Malariaprävention',source:'WHO GHO',date:'Jahr 2022',threshold:100,cap:300,unit:'Fälle / 1.000 Risikopersonen / Jahr',field:'incidence',label:'Jährliche Inzidenz · linear',formula:'r',sample:200},
] as const;
export interface CurveParameters {threshold:number;cap:number;minimum:number;maximum:number}
export function previewPayout(id:number,value:number,parameters?:CurveParameters):number {
  const d=curveDefinitions[id]; if(!d || !Number.isFinite(value) || value<0) return 0;
  const {threshold,cap,minimum,maximum}=parameters??{threshold:d.threshold,cap:d.cap,minimum:500,maximum:2000};
  if(value<threshold) return 0;
  if(value>=cap) return maximum;
  const f=(x:number)=>id===0?10**(1.5*(x-threshold)):id===1?x*x:x;
  return minimum+(maximum-minimum)*(f(value)-f(threshold))/(f(cap)-f(threshold));
}
