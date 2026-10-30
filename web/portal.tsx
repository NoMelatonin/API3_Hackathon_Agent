import React, {useEffect, useRef, useState} from 'react';
import {BaseError,ContractFunctionRevertedError,createPublicClient,createWalletClient,custom,decodeEventLog,formatUnits,http,keccak256,parseAbiItem,toHex,type Address,type Hex} from 'viem';
import {foundry} from 'viem/chains';
import abi from './contracts-v2.json';
import {curveDefinitions,previewPayout,type CurveParameters} from '../src/payout-preview.ts';
import {logPages} from '../src/log-pages.ts';

type Config={version:2;chainId:31337;fund:Address;token:Address;ngos:Address[];committee:Address[];deployedBlock:string};
type Rule=readonly [Address,Hex,bigint,bigint,bigint,bigint,boolean];
type Payment={campaign:number;ngo:Address;amount:bigint;path:number;hash:Hex;key:string};
type Snapshot={balance:bigint;paid:bigint;campaignPaid:bigint;claimed:boolean[];mask:number;key:string;rule:Rule;history:Payment[]};
const local=new URLSearchParams(location.search).get('local')==='1';
const client=createPublicClient({chain:foundry,transport:http('http://127.0.0.1:8545',{timeout:10_000,retryCount:0})});
const paidEvent=parseAbiItem('event Paid(uint8 indexed campaign, address indexed ngo, uint256 amount, uint8 path, bytes32 evidenceHash)');
const money=(x:bigint|number)=> (typeof x==='bigint'?Number(formatUnits(x,6)):x).toLocaleString('de-DE',{maximumFractionDigits:2});
const short=(x:string)=>`${x.slice(0,6)}…${x.slice(-4)}`;
function explain(error:unknown) {
  if(error instanceof BaseError) {
    const revert=error.walk(e=>e instanceof ContractFunctionRevertedError);
    if(revert instanceof ContractFunctionRevertedError) return `${revert.data?.errorName??'Contract-Revert'}: ${revert.shortMessage}`;
    return error.shortMessage;
  }
  return error instanceof Error?error.message:String(error);
}

export function Portal() {
  const [campaign,setCampaign]=useState(0),[ngo,setNgo]=useState(0),[reason,setReason]=useState('Oracle unavailable; historical exercise; post-review required');
  const [config,setConfig]=useState<Config>(),[snapshot,setSnapshot]=useState<Snapshot>();
  const [status,setStatus]=useState(local?'Lokaler Fonds wird geladen …':'Interaktive Vorschau. Für Transaktionen den lokalen Fonds öffnen.');
  const [error,setError]=useState(false),[busy,setBusy]=useState(false),[account,setAccount]=useState<Address>();
  const [response,setResponse]=useState(''),[quote,setQuote]=useState<{key:string;amount:bigint}>(),[lastTx,setLastTx]=useState<Hex>();
  const [slider,setSlider]=useState<number>(7.8),[emergencyOpen,setEmergencyOpen]=useState(false);
  const definition=curveDefinitions[campaign];
  const reasonHash=keccak256(toHex(reason.trim()));
  const key=`${campaign}:${ngo}:${reasonHash}`;
  const current=useRef(key);current.current=key;
  const version=useRef(0);
  const quoteKey=`${campaign}:${ngo}:${response}`;
  const currentQuote=useRef(quoteKey);currentQuote.current=quoteKey;
  const currentRule=snapshot?.key===key?snapshot.rule:undefined;
  const parameters:CurveParameters=currentRule?{threshold:Number(currentRule[2])/1e6,cap:Number(currentRule[3])/1e6,minimum:Number(currentRule[4])/1e6,maximum:Number(currentRule[5])/1e6}:{threshold:definition.threshold,cap:definition.cap,minimum:500,maximum:2000};
  const {threshold,cap,minimum,maximum}=parameters;
  const oracleEnabled=currentRule?.[6]??campaign!==2;
  const mask=snapshot?.key===key?snapshot.mask:0;
  const votes=[1,2,4].filter(bit=>mask&bit).length;
  const claimed=snapshot?.key===key?snapshot.claimed:[];
  const authoritativeQuote=quote?.key===quoteKey?quote.amount:undefined;

  async function refresh(c=config) {
    if(!c||!local)return;
    const request=++version.current,selection=key;
    if(await client.getChainId()!==31337||c.chainId!==31337)throw new Error('RPC und lokales Deployment passen nicht zusammen.');
    const block=await client.getBlock();
    const read=(functionName:string,args:unknown[]=[])=>client.readContract({address:c.fund,abi:abi.fund,functionName,args,blockNumber:block.number});
    const [balance,paid,campaignPaid,states,mask_,rule]=await Promise.all([
      client.readContract({address:c.token,abi:abi.token,functionName:'balanceOf',args:[c.fund],blockNumber:block.number}),
      read('totalPaid'),read('campaignPaid',[campaign]),Promise.all(c.ngos.map(n=>read('claimed',[campaign,n]))),read('approvals',[campaign,c.ngos[ngo],reasonHash]),read('campaigns',[campaign]),
    ]);
    const logs=await logPages(BigInt(c.deployedBlock),block.number,(fromBlock,toBlock)=>client.getLogs({address:c.fund,event:paidEvent,fromBlock,toBlock}));
    const history=logs.map(log=>({campaign:log.args.campaign!,ngo:log.args.ngo!,amount:log.args.amount!,path:log.args.path!,hash:log.transactionHash,key:`${log.transactionHash}:${log.logIndex}`}));
    if(request!==version.current||current.current!==selection)return;
    setSnapshot({balance:balance as bigint,paid:paid as bigint,campaignPaid:campaignPaid as bigint,claimed:states as boolean[],mask:Number(mask_),rule:rule as Rule,key:selection,history});
  }
  useEffect(()=>{
    if(!local)return;
    let cancelled=false;
    (async()=>{
      const response=await fetch('/deployment.v2.local.json');
      if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw new Error('Lokales V2-Deployment fehlt. Siehe npm run v2 -- deploy --local.');
      const c=await response.json() as Config;
      if(c.version!==2||c.chainId!==31337)throw new Error('Kein lokaler V2-Fonds.');
      if(cancelled)return;
      setConfig(c);await refresh(c);if(!cancelled)setStatus('Fonds bereit. Vollständig finanzierte lokale Demonstration.');
    })().catch(e=>{if(!cancelled){setStatus(explain(e));setError(true);}});
    return()=>{cancelled=true;++version.current;};
  },[]);
  useEffect(()=>{if(config)refresh().catch(e=>{setError(true);setStatus(explain(e));});},[campaign,ngo,reasonHash,config]);
  async function run(action:()=>Promise<void>) {
    setBusy(true);setError(false);setLastTx(undefined);
    try{await action();await refresh();}catch(e){setError(true);setStatus(explain(e));}finally{setBusy(false);}
  }
  async function connect() {
    if(!window.ethereum)throw new Error('Für Transaktionen eine Browserwallet verwenden; Simulationen brauchen keine Wallet.');
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
    if(!accounts[0])throw new Error('Keine Wallet gewählt.');
    const chain=await window.ethereum.request({method:'eth_chainId'});
    if(Number(chain)!==31337)await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7a69'}]});
    setAccount(accounts[0]);return accounts[0];
  }
  async function transact(functionName:string,args:unknown[]) {
    if(!config||!local)throw new Error('Nur lokale Transaktionen sind aktiviert.');
    const address=await connect();
    const wallet=createWalletClient({account:address,chain:foundry,transport:custom(window.ethereum!)});
    const call={address:config.fund,abi:abi.fund,functionName,args,account:address} as const;
    await client.simulateContract(call);
    const hash=await wallet.writeContract(call);setStatus('Transaktion eingereicht …');
    const receipt=await client.waitForTransactionReceipt({hash});
    if(receipt.status!=='success')throw new Error('Transaktion abgelehnt.');
    setLastTx(hash);setStatus('On-chain bestätigt · lokale Testchain.');
  }
  function responseArgs() {
    const r=JSON.parse(response);
    if(typeof r.timestamp!=='string'||!/^\d+$/.test(r.timestamp)||typeof r.data!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(r.signature))throw new Error('Originale Attestation mit timestamp, data-String und Signatur erforderlich.');
    return [campaign,BigInt(r.timestamp),toHex(r.data),r.signature];
  }
  async function simulate() {
    if(!config)throw new Error('Lokales Deployment fehlt.');
    setQuote(undefined);
    const selected=quoteKey,args=responseArgs();
    const amount=await client.readContract({address:config.fund,abi:abi.fund,functionName:'quote',args}) as bigint;
    await client.simulateContract({address:config.fund,abi:abi.fund,functionName:'claim',args:[campaign,config.ngos[ngo],...args.slice(1)]});
    if(currentQuote.current!==selected)return;
    setQuote({key:selected,amount});setStatus(`Contract-Simulation akzeptiert: ${money(amount)} dUSD. Keine Transaktion gesendet.`);
  }
  function selectCampaign(id:number) {setCampaign(id);setSlider(curveDefinitions[id].sample);setResponse('');setQuote(undefined);setError(false);setStatus('Einsatz gewechselt. Signierte Antwort für diesen Einsatz laden.');}
  let data:Record<string,unknown>|undefined;
  try{data=JSON.parse(JSON.parse(response).data);}catch{}
  const observed=data?.[definition.field];
  const previewValue=typeof observed==='number'?observed:typeof observed==='string'?Number(observed):NaN;
  const points=Array.from({length:101},(_,i)=>{
    const x=threshold+(cap-threshold)*i/100;
    const y=previewPayout(campaign,x,parameters);
    return `${40+i*4.8},${175-(y-minimum)/(maximum-minimum)*135}`;
  }).join(' ');
  return <>
    <header className="topbar"><a className="brand" href="/">DisasterDAO<span className="brand-dot"/></a><span className="network">{local?'Anvil · 31337':'V2 · Vorschau'} / Nur Testmittel</span><button disabled={busy||!local} onClick={()=>run(async()=>{await connect();})}>{account?short(account):'Wallet verbinden'}</button></header>
    <main>
      <section className="intro"><div><p className="eyebrow">GEMEINSAMER KATASTROPHENFONDS</p><h1>Hilfe, die mit<br/>der Lage wächst.</h1><p>Drei Datenquellen. Klare Grenzen. Ein gemeinsamer Pool.</p></div><div className="intro-note">Historische Demonstration<br/><strong>Fiktive NGOs · wertlose dUSD</strong><a href={`/?legacy=1${local?'&local=1':''}`}>Bisherigen MVP ansehen ↗</a></div></section>
      <section className="metrics" aria-label="Fondsübersicht"><article><span>Im gemeinsamen Pool</span><strong>{snapshot?money(snapshot.balance):'18.000'}<small> dUSD</small></strong><p>{snapshot?'On-chain gelesen':'Geplantes Demo-Budget'}</p></article><article><span>Ausgezahlt</span><strong>{snapshot?money(snapshot.paid):'—'}<small> dUSD</small></strong><p>Ein Anspruch pro NGO und Einsatz</p></article><article><span>Maximal pro Anspruch</span><strong>2.000<small> dUSD</small></strong><p>6.000 dUSD für jeden Einsatz reserviert</p></article></section>
      <div className={`status ${error?'error':''}`} role="status" aria-live="polite"><span>{status}{lastTx&&<code> {short(lastTx)}</code>}</span><button disabled={busy||!config} onClick={()=>run(async()=>{await refresh();setStatus('Fondsstatus aktualisiert.');})}>Aktualisieren</button></div>
      <nav className="campaigns" aria-label="Einsatz wählen">{curveDefinitions.map((c,i)=><button key={c.source} aria-pressed={campaign===i} onClick={()=>selectCampaign(i)} disabled={busy}><span>0{i+1} / {c.source}</span><strong>{c.name}</strong><small>{i===2?'Abruf blockiert':'Echte signierte Fixture vorhanden'}</small></button>)}</nav>
      <div className="workspace">
        <section className="panel severity"><p className="eyebrow">01 / DATEN & AUSZAHLUNGSREGEL</p><div className="section-title"><h2>{definition.name}</h2><span className="badge">{definition.date}</span></div>
          <p className="subtle">{definition.label}. Die Kurve ist eine begrenzte Demo-Förderregel und keine Schadens- oder Bedarfsberechnung.</p>
          {campaign===2&&<p className="warning">WHO-Integration blockiert: Der Upstream liefert HTTP 500. Keine echte WHO-Antwort nachgewiesen. Oracle-Auszahlung im Standardfonds deaktiviert; lokale synthetische Tests sind separat dokumentiert.</p>}
          <div className="rule-summary"><div><span>Schwelle</span><strong>{threshold} <small>{campaign===2?'Fälle / 1.000':definition.unit}</small></strong></div><div><span>Maximalbetrag ab</span><strong>{cap} <small>{campaign===2?'Fälle / 1.000':definition.unit}</small></strong></div><div><span>Förderrahmen</span><strong>{money(minimum)}–{money(maximum)} <small>dUSD</small></strong></div></div>
          <figure className="curve"><svg viewBox="0 0 560 210" role="img" aria-label={`${definition.label}: Auszahlung wächst von ${minimum} auf ${maximum} dUSD`}><line x1="40" y1="175" x2="520" y2="175"/><line x1="40" y1="40" x2="520" y2="40" className="grid"/><polyline points={points}/><text x="40" y="200">{threshold} {campaign===2?'Fälle':definition.unit}</text><text x="430" y="200">{cap} {campaign===2?'Fälle':definition.unit}</text><text x="40" y="25">{money(maximum)} dUSD · Obergrenze</text></svg><figcaption>{definition.formula} → auf den Förderrahmen normiert und begrenzt.</figcaption></figure>
          <div className="explorer"><label htmlFor="severity-slider">Kurve ausprobieren <span>Hypothetisch · keine Auszahlung</span></label><input id="severity-slider" type="range" min={Math.max(0,threshold-(cap-threshold)*0.1)} max={cap+(cap-threshold)*0.1} step="0.01" value={slider} onChange={e=>setSlider(Number(e.target.value))}/><div><span>{slider.toLocaleString('de-DE',{maximumFractionDigits:2})} {definition.unit}</span><strong>≈ {money(previewPayout(campaign,slider,parameters))} dUSD</strong></div></div>
          <details><summary>Wie wird der Betrag berechnet?</summary><p>Unter der Schwelle: keine Zahlung. An der Schwelle: {money(minimum)} dUSD. Danach wächst der Betrag stetig nach der jeweiligen Kurve bis maximal {money(maximum)} dUSD.</p><code>P = min + (max − min) × (f(x) − f(T)) / (f(C) − f(T))</code><p>Erdbeben: näherungsweise freigesetzte Energie. Sturm: Winddruck bei konstanter Luftdichte. WHO: jährliche Inzidenz. Die Größen sind fachlich nicht vergleichbar. On-chain wird auf sechs Token-Dezimalstellen abgerundet.</p></details>
          <details><summary>Vertrauen und Datenzeit</summary><p>API3-Airnodes signieren gelesene Quelldaten. Das beweist weder humanitären Bedarf noch die Verwendung von Hilfsmitteln. Die Signatur muss nach Fondsaktivierung und höchstens fünf Minuten alt sein. Der historische Beobachtungszeitraum wird separat geprüft.</p>{currentRule&&<><p className="hash">Signierer: {currentRule[0]}</p><p className="hash">Anfragehash: {currentRule[1]}</p></>}</details>
        </section>
        <section className="panel action-panel"><p className="eyebrow">02 / PRÜFEN & FREIGEBEN</p><h2>Gezielt auszahlen.</h2><p className="subtle">Jede NGO kann pro Einsatz einmal Geld erhalten. Eine Notfallzahlung verbraucht denselben Anspruch.</p>
          <label htmlFor="recipient">Empfänger</label><select id="recipient" disabled={busy} value={ngo} onChange={e=>setNgo(Number(e.target.value))}>{[0,1,2].map(i=><option key={i} value={i}>Demo-NGO {i+1}{claimed[i]?' · ausgezahlt':''}</option>)}</select>
          <p className="recipient-address">{config?config.ngos[ngo]:'Feste Empfängeradresse wird aus dem lokalen Contract geladen.'}</p>
          <div className="budget-row"><span>Einsatzbudget verfügbar</span><strong>{snapshot?.key===key?money(6_000_000_000n-snapshot.campaignPaid):'6.000'} dUSD</strong></div>
          <label htmlFor="response-file">Signierte Antwort laden</label><input id="response-file" type="file" accept="application/json,.json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)run(async()=>{setResponse(await f.text());setQuote(undefined);setStatus('Antwort geladen · noch nicht verifiziert.');});}}/>
          <label htmlFor="response-json">Originale Attestation</label><textarea id="response-json" disabled={busy} rows={5} value={response} onChange={e=>{setResponse(e.target.value);setQuote(undefined);}} placeholder='{"timestamp":"…","data":"{…}","signature":"0x…"}' spellCheck={false}/>
          <div className="quote"><span>{authoritativeQuote!==undefined?'Im Contract geprüft':'Unverifizierte Vorschau'}</span><strong>{authoritativeQuote!==undefined?money(authoritativeQuote):Number.isFinite(previewValue)?`≈ ${money(previewPayout(campaign,previewValue,parameters))}`:'—'} <small>dUSD</small></strong><p>{Number.isFinite(previewValue)?`Übergebener Messwert: ${previewValue} ${definition.unit}`:'Eine Antwort für diesen Einsatz laden.'}</p></div>
          <div className="actions"><button disabled={busy||!config||!response||!oracleEnabled} onClick={()=>run(simulate)}>Im Contract simulieren</button><button className="primary" disabled={busy||!config||authoritativeQuote===undefined||!!claimed[ngo]||!oracleEnabled} onClick={()=>run(async()=>{const args=responseArgs();await transact('claim',[campaign,config!.ngos[ngo],...args.slice(1)]);setQuote(undefined);})}>Auszahlen →</button></div>
          <p className="helper">Simulation verändert keinen Zustand. Der Contract prüft bei der Auszahlung erneut Signatur, Datenalter und Anspruch. Ein neuer Messwert erlaubt keine zweite Zahlung.</p>
          <button className="disclosure" aria-expanded={emergencyOpen} onClick={()=>setEmergencyOpen(!emergencyOpen)}>Gemeinsamer Notfallweg {emergencyOpen?'−':'+'}</button>
          {emergencyOpen&&<div className="emergency"><h3>Wenn Daten fehlen.</h3><p>Fest 1.000 dUSD nach zwei unterschiedlichen Freigaben. Keine geschätzte Schwere. Nachprüfung bleibt erforderlich.</p><label htmlFor="reason">Öffentliche Begründung</label><textarea id="reason" disabled={busy} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/><div className="quorum"><span>Freigaben für diese Begründung</span><strong>{votes} / 2</strong></div><div className="actions"><button disabled={busy||!config||!!claimed[ngo]||!reason.trim()} onClick={()=>run(()=>transact('approveEmergency',[campaign,config!.ngos[ngo],reasonHash]))}>Als Verantwortlicher genehmigen</button><button className="primary" disabled={busy||!config||votes<2||!!claimed[ngo]} onClick={()=>run(()=>transact('executeEmergency',[campaign,config!.ngos[ngo],reasonHash]))}>1.000 dUSD freigeben</button></div></div>}
        </section>
      </div>
      <section className="panel history"><div className="section-title"><div><p className="eyebrow">03 / NACHVOLLZIEHBAR</p><h2>Auszahlungen</h2></div><span className="badge">{snapshot?.history.length??0} bestätigte Einträge</span></div>{!snapshot?.history.length?<p className="empty">Noch keine Auszahlung. Bestätigte Transaktionen erscheinen hier.</p>:<ul className="payment-list">{snapshot.history.map(p=><li key={p.key}><div><strong>Demo-NGO {(config?.ngos.findIndex(n=>n.toLowerCase()===p.ngo.toLowerCase())??-1)+1}</strong><span>{curveDefinitions[p.campaign].source} · {p.path===0?'Signiertes Ereignis':'2/3-Notfallquorum'}</span></div><strong>{money(p.amount)} dUSD</strong><code title={p.hash}>{short(p.hash)}</code></li>)}</ul>}</section>
      <footer><strong>DisasterDAO / V2</strong><p>Historische Daten · Fiktive Organisationen · Keine echten Gelder</p><a href="/?local=1">Lokalen Fonds öffnen ↗</a></footer>
    </main>
  </>;
}
