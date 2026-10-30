import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, custom, formatUnits,
  decodeEventLog, http, keccak256, parseAbiItem, toHex, type Address, type Hex, type EIP1193Provider,
} from 'viem';
import { baseSepolia, foundry } from 'viem/chains';
import contracts from './contracts.json';

import { logPages } from '../src/log-pages.ts';
import { mergePayouts, payoutId, type Payout } from '../src/payout-history.ts';

declare global { interface Window { ethereum?: EIP1193Provider } }
interface Config {
  chainId: number; network: string; token: Address; fund: Address; ngos: Address[]; committee: Address[];
  deployedBlock: string; airnode: Address; requestHash: Hex;
  payoutTransactions?: Hex[];
}
interface ResponseData { timestamp: string; data: string; signature: Hex; requestHash?: Hex; airnode?: Address }
interface Snapshot {
  balance: bigint; totalPaid: bigint; active: boolean; claimed: boolean[];
  activatedAt: bigint; chainTime: bigint; approvals: number; approvalsKey: string; history: Payout[];
}
const local = new URLSearchParams(location.search).get('local') === '1';
const chain = local ? foundry : baseSepolia;
const client = createPublicClient({ chain, transport: http(local ? 'http://127.0.0.1:8545' : 'https://sepolia.base.org', { timeout: 15_000, retryCount: 0 }) });
const DEFAULT_REASON = 'Oracle unavailable; historical exercise; post-review required';
const paidEvent = parseAbiItem('event Paid(address indexed ngo, uint256 amount, uint8 path, bytes32 evidenceHash)');
type HistoryEntry = Snapshot['history'][number];
const historyCache = new Map<string, { entries: HistoryEntry[]; through: bigint }>();
async function history(c: Config, count: number, through: bigint): Promise<HistoryEntry[]> {
  const key = `${c.chainId}:${c.fund}`;
  const cached = historyCache.get(key);
  if (cached && cached.entries.length === count) return cached.entries;
  let entries = cached?.entries ?? [];
  if (!cached && c.payoutTransactions?.length) {
    const receipts = await Promise.all([...new Set(c.payoutTransactions)].map(hash => client.getTransactionReceipt({ hash })));
    entries = receipts.filter(receipt => receipt.status === 'success' && receipt.blockNumber <= through)
      .flatMap(receipt => receipt.logs.filter(log => log.address.toLowerCase() === c.fund.toLowerCase()).flatMap(log => {
      try {
        const decoded = decodeEventLog({ abi: [paidEvent], data: log.data, topics: log.topics });
        return [{ ngo: decoded.args.ngo, amount: decoded.args.amount, path: decoded.args.path,
          hash: receipt.transactionHash, block: receipt.blockNumber, logIndex: log.logIndex }];
      } catch { return []; } // Other events in the same receipt are not payout events.
    }));
  }
  if (entries.length !== count) {
    const from = cached ? cached.through : BigInt(c.deployedBlock);
    const logs = await logPages(from, through, (fromBlock, toBlock) => client.getLogs({
      address: c.fund, event: paidEvent, fromBlock, toBlock,
    }));
    const combined = [...entries, ...logs.map(log => ({ ngo: log.args.ngo!, amount: log.args.amount!,
      path: log.args.path!, hash: log.transactionHash, block: log.blockNumber, logIndex: log.logIndex }))];
    entries = mergePayouts(combined);
  }
  entries = mergePayouts(entries);
  historyCache.set(key, { entries, through });
  return entries;
}
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const money = (value: bigint) => Number(formatUnits(value, 6)).toLocaleString('de-DE');
const explorer = (hash: Hex, kind = 'tx') => `https://sepolia.basescan.org/${kind}/${hash}`;
const explanations: Record<string, string> = {
  NotSignedByAirnode: 'Signatur passt nicht zum erlaubten Airnode und zur festgelegten Anfrage.',
  ResponseTooOld: 'Die echte Antwort ist älter als fünf Minuten. Bitte frisch abrufen.',
  FutureResponse: 'Die Signaturzeit liegt nach der aktuellen Chain-Zeit.',
  ResponseBeforeActivation: 'Die Antwort wurde vor der Aktivierung dieses Fonds signiert.',
  AlreadyClaimed: 'Diese NGO hat ihre Soforthilfe bereits erhalten — auch über einen anderen Freigabepfad.',
  QuorumNotMet: 'Zwei unterschiedliche Verantwortliche müssen dieselbe Begründung genehmigen.',
  AlreadyApproved: 'Diese Wallet hat diese Begründung bereits genehmigt.',
  NotCommittee: 'Die verbundene Wallet gehört nicht zum Notfallgremium.',
  TriggerNotMet: 'Der gültige Datensatz erfüllt Magnitude oder Reviewstatus nicht.',
  WrongEvent: 'Die signierten Daten gehören nicht zum festgelegten Erdbeben.',
  OutsideRegion: 'Die signierten Koordinaten liegen außerhalb des Einsatzgebiets.',
  ObservationOutsideWindow: 'Die Beobachtung liegt außerhalb des vereinbarten Ereignistages.',
  UnexpectedValue: 'Ein erforderlicher Wert fehlt, ist null oder hat ein ungültiges Format.',
  FieldNotFound: 'Ein erforderliches signiertes Datenfeld fehlt.',
};
function describe(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(e => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? 'Contract-Revert';
      return `${name}: ${explanations[name] ?? 'Der Contract hat die Aktion abgelehnt.'}`;
    }
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}

export function LegacyApp() {
  const [config, setConfig] = useState<Config>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [account, setAccount] = useState<Address>();
  const [status, setStatus] = useState('Deployment wird geladen …');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<Hex>();
  const [ngo, setNgo] = useState(0);
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [responseText, setResponseText] = useState('');
  const [responseName, setResponseName] = useState('');
  const [tab, setTab] = useState<'relief' | 'jury'>('relief');
  const reasonHash = keccak256(toHex(reason.trim()));
  const approvalsKey = `${ngo}:${reasonHash}`;
  const selection = useRef(approvalsKey);
  selection.current = approvalsKey;
  const refreshVersion = useRef(0);

  async function refresh(c = config) {
    if (!c || selection.current !== approvalsKey) return;
    const version = ++refreshVersion.current;
    if (await client.getChainId() !== c.chainId || c.chainId !== chain.id) throw new Error('RPC und Deployment passen nicht zur ausgewählten Testchain.');
    const block = await client.getBlock();
    const read = (functionName: string, args?: unknown[]) => client.readContract({ address: c.fund, abi: contracts.fund, functionName, args, blockNumber: block.number });
    const [balance, totalPaid, active, activatedAt, claimed, mask] = await Promise.all([
      client.readContract({ address: c.token, abi: contracts.token, functionName: 'balanceOf', args: [c.fund], blockNumber: block.number }),
      read('totalPaid'), read('active'), read('activatedAt'),
      Promise.all(c.ngos.map(a => read('claimed', [a]))), read('approvals', [c.ngos[ngo], reasonHash]),
    ]);
    const entries = await history(c, Number(totalPaid as bigint) / 1_000_000_000, block.number);
    if (version !== refreshVersion.current || selection.current !== approvalsKey) return;
    setSnapshot({ balance: balance as bigint, totalPaid: totalPaid as bigint, active: active as boolean,
      activatedAt: activatedAt as bigint, chainTime: block.timestamp, claimed: claimed as boolean[], approvals: Number(mask),
      approvalsKey, history: entries });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/deployment${local ? '.local' : ''}.json`);
      if (!r.ok || !r.headers.get('content-type')?.includes('json')) throw new Error('Noch kein Deployment. Zuerst „npm run deploy“ ausführen; lokal mit --local und ?local=1 öffnen.');
      const c: Config = await r.json();
      if (!cancelled) { setConfig(c); await refresh(c); setStatus('Fonds bereit. Daten und Regeln werden im Contract geprüft.'); }
    })().catch(e => { if (!cancelled) { setStatus(describe(e)); setFailed(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config) return;
    refresh().catch(e => { setFailed(true); setStatus(describe(e)); });
  }, [ngo, reasonHash]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setFailed(false); setLastTx(undefined);
    try { await action(); await refresh(); }
    catch (e) { setFailed(true); setStatus(describe(e)); }
    finally { setBusy(false); }
  }

  async function connect() {
    if (!window.ethereum) throw new Error('Bitte eine Browserwallet installieren oder die dokumentierten CLI-Skripte nutzen.');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) throw new Error('Keine Wallet ausgewählt.');
    const id = await window.ethereum.request({ method: 'eth_chainId' });
    if (Number(id) !== chain.id) await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHex(chain.id) }] });
    setAccount(accounts[0]);
    setStatus(`Wallet verbunden: ${short(accounts[0])}`);
    return accounts[0];
  }

  async function transact(functionName: string, args: unknown[]) {
    if (!config) throw new Error('Deployment fehlt.');
    const address = await connect(); // Refresh account and chain before every action.
    const wallet = createWalletClient({ chain, transport: custom(window.ethereum!), account: address });
    setStatus('Contract prüft die Aktion …');
    const call = { address: config.fund, abi: contracts.fund, functionName, args, account: address } as const;
    await client.simulateContract(call);
    const hash = await wallet.writeContract(call);
    setStatus('Transaktion eingereicht. Bestätigung wird erwartet …');
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Die Transaktion wurde on-chain abgelehnt.');
    setLastTx(hash); setStatus('On-chain bestätigt.');
  }

  function parseResponse(): ResponseData {
    const r = JSON.parse(responseText);
    if (typeof r.data !== 'string' || typeof r.timestamp !== 'string' || !/^\d+$/.test(r.timestamp) ||
      typeof r.signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(r.signature)) {
      throw new Error('Originale Airnode-Antwort mit timestamp, data-String und signature erforderlich.');
    }
    return r;
  }

  async function submit(simulate: boolean) {
    if (!config) throw new Error('Deployment fehlt.');
    const r = parseResponse();
    // The original data string goes to the contract as UTF-8 bytes, NEVER reserialized.
    const args = [config.ngos[ngo], BigInt(r.timestamp), toHex(r.data), r.signature];
    if (simulate) {
      await client.simulateContract({ address: config.fund, abi: contracts.fund, functionName: 'claim', args });
      setStatus('Contract-Simulation akzeptiert. Noch keine Auszahlung oder Transaktion.');
    } else await transact('claim', args);
  }

  let preview: Record<string, unknown> | undefined;
  try { preview = JSON.parse(JSON.parse(responseText).data); } catch { /* Unverified input, no inferred status. */ }
  const approvalMask = snapshot?.approvalsKey === approvalsKey ? snapshot.approvals : 0;
  const votes = [1, 2, 4].filter(bit => approvalMask & bit).length;
  const paidCount = snapshot?.claimed.filter(Boolean).length ?? 0;

  return <>
    <header className="topbar"><a className="brand" href={local ? '/?local=1' : '/'}><span className="brand-mark">D</span>DisasterDAO</a>
      <span className="network"><span className="dot" />{local ? 'Lokale Testchain' : 'Base Sepolia'} · Nur Testmittel</span>
      <button className="wallet" disabled={busy} onClick={() => run(async () => { await connect(); })}>{account ? short(account) : 'Wallet verbinden'}</button>
    </header>
    <main>
      <section className="hero"><div><p className="eyebrow">GEMEINSAM VORBEREITET. NACHVOLLZIEHBAR FREIGEGEBEN.</p>
        <h1>Soforthilfe braucht<br />klare Entscheidungen.</h1>
        <p className="lead">Drei Organisationen. Ein gemeinsamer Fonds. Signierte Ereignisdaten geben ein begrenztes Budget frei — mit einem gemeinsamen Notfallweg.</p>
      </div><div className="mission-tag"><span>HISTORISCHE SIMULATION</span><strong>Türkei · 06.02.2023</strong><small>USGS us6000jllz · fiktive NGOs</small></div></section>

      <div className={`notice ${failed ? 'error' : ''}`} role="status" aria-live="polite"><span>{busy ? '◌ ' : failed ? '○ ' : '● '}{status}</span>
        {lastTx && !local && <a href={explorer(lastTx)} target="_blank" rel="noreferrer">Transaktion ansehen ↗</a>}
        <button disabled={busy || !config} onClick={() => run(async () => { await refresh(); setStatus('Fondsstatus aktualisiert.'); })}>Aktualisieren</button>
      </div>

      <section className="metrics" aria-label="Fondsübersicht">
        <article><span>IM GEMEINSAMEN POOL</span><strong>{snapshot ? money(snapshot.balance) : '—'} <small>dUSD</small></strong><p>3.000 dUSD vorab bereitgestellt</p></article>
        <article><span>BEREITS AUSGEZAHLT</span><strong>{snapshot ? money(snapshot.totalPaid) : '—'} <small>dUSD</small></strong><p>{paidCount} von 3 einmaligen Ansprüchen</p></article>
        <article><span>PRO ORGANISATION</span><strong>1.000 <small>dUSD</small></strong><p>Oracle und Notfall teilen dieselbe Grenze</p></article>
      </section>

      <nav className="tabs" aria-label="Ansicht"><button className={tab === 'relief' ? 'selected' : ''} onClick={() => setTab('relief')}>Einsatz & Freigabe</button>
        <button className={tab === 'jury' ? 'selected' : ''} onClick={() => setTab('jury')}>Signaturprüfung / Jury</button></nav>

      {tab === 'relief' ? <div className="columns"><section className="panel"><div className="panel-heading"><span className="step">01</span><div><p className="eyebrow">VORAB VEREINBART</p><h2>Ein Ereignis. Feste Regeln.</h2></div></div>
        <div className="event-card"><div><span className="event-symbol">⌁</span><h3>Erdbeben · Kahramanmaraş</h3></div><span className="pill">Historisch</span></div>
        <dl className="rules"><div><dt>Trigger</dt><dd>Magnitude ≥ 7,0 · reviewed</dd></div><div><dt>Ereignisfenster</dt><dd>06.02.2023 · UTC</dd></div><div><dt>Gebiet</dt><dd>36–39° N / 35–39° E</dd></div><div><dt>Datenquelle / Signierer</dt><dd>USGS / API3-Airnode</dd></div><div><dt>Antwortalter</dt><dd>Höchstens 5 Minuten, nach Aktivierung</dd></div></dl>
        <div className="callout">Eine frisch signierte Antwort auf ein historisches Ereignis. Der Messwert ist kein Nachweis für humanitären Bedarf.</div>
        <h3 className="subheading">Zugelassene Organisationen</h3>
        <div className="ngo-list">{(config?.ngos ?? ['', '', '']).map((address, i) => <button key={i} className={`ngo ${ngo === i ? 'chosen' : ''}`} onClick={() => setNgo(i)}>
          <span className="ngo-icon">0{i + 1}</span><span><strong>Demo-NGO {i + 1}</strong><small>{address ? short(address) : 'Noch nicht deployt'}</small></span>
          <span className={`ngo-state ${snapshot?.claimed[i] ? 'paid' : ''}`}>{snapshot?.claimed[i] ? 'Ausgezahlt' : '1.000 dUSD offen'}</span></button>)}</div>
      </section><section className="panel"><div className="panel-heading"><span className="step">02</span><div><p className="eyebrow">MENSCHLICHE ABSICHERUNG</p><h2>Wenn Daten fehlen.</h2></div></div>
        <p className="body-copy">Zwei von drei Verantwortlichen können die Soforthilfe gemeinsam freigeben. Die Empfänger und ihr Budget bleiben verbindlich.</p>
        <label htmlFor="ngo">Empfänger</label><select id="ngo" value={ngo} onChange={e => setNgo(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={i}>Demo-NGO {i + 1} · {snapshot?.claimed[i] ? 'bereits ausgezahlt' : '1.000 dUSD'}</option>)}</select>
        <label htmlFor="reason">Gemeinsame Begründung</label><textarea id="reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} /><small className="helper">Nur der Text-Hash wird veröffentlicht. Den genauen Text separat teilen und aufbewahren; Leerzeichen am Anfang und Ende werden entfernt. Keine personenbezogenen Informationen.</small>
        <div className="quorum"><div><strong>{votes} / 2</strong><span>Freigaben für diesen Empfänger und Grund</span></div><div className="vote-dots">{[0, 1, 2].map(i => <span key={i} className={approvalMask & (1 << i) ? 'voted' : ''}>{i + 1}</span>)}</div></div>
        <div className="actions"><button disabled={busy || !snapshot?.active || !!snapshot?.claimed[ngo] || !reason.trim()} onClick={() => run(() => transact('approveEmergency', [config!.ngos[ngo], reasonHash]))}>Als Verantwortlicher genehmigen</button>
          <button className="primary" disabled={busy || votes < 2 || !!snapshot?.claimed[ngo]} onClick={() => run(() => transact('executeEmergency', [config!.ngos[ngo], reasonHash]))}>1.000 dUSD freigeben</button></div>
        <p className="helper">Die Notfallzahlung ersetzt die Oracle-Zahlung. Nachprüfung bleibt erforderlich. Ein Chain-Ausfall oder ein unerreichbares Quorum wird dadurch nicht gelöst.</p>
        <button className="text-button" onClick={() => setTab('jury')}>Signierte Ereignisantwort einreichen →</button>
      </section></div> : <section className="panel jury"><div className="panel-heading"><span className="step">↳</span><div><p className="eyebrow">CONTRACT PRÜFT SELBST</p><h2>Originalantwort einreichen.</h2></div></div>
        <p className="body-copy">Eine echte AirnodeHub-JSON-Datei laden oder unverändert einfügen. Die Simulation führt dieselben Contract-Prüfungen aus wie die Auszahlung, ohne eine Transaktion zu senden.</p>
        <div className="jury-grid"><div><label htmlFor="response-file">Antwortdatei</label><input id="response-file" type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => { setResponseText(await file.text()); setResponseName(file.name); setStatus('Antwort geladen. Signatur noch nicht geprüft.'); }); }} />
          <label htmlFor="response">Originale Attestation {responseName && `· ${responseName}`}</label><textarea id="response" className="code-input" rows={12} value={responseText} onChange={e => setResponseText(e.target.value)} spellCheck={false} placeholder={'{"timestamp":"…","data":"{…}","signature":"0x…"}'} />
          <label htmlFor="claim-ngo">Empfänger</label><select id="claim-ngo" value={ngo} onChange={e => setNgo(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={i}>Demo-NGO {i + 1}{snapshot?.claimed[i] ? ' · bereits ausgezahlt' : ''}</option>)}</select>
          <div className="actions"><button disabled={busy || !config || !responseText} onClick={() => run(() => submit(true))}>Im Contract simulieren</button><button className="primary" disabled={busy || !config || !responseText || !!snapshot?.claimed[ngo]} onClick={() => run(() => submit(false))}>Signatur prüfen & auszahlen</button></div>
        </div><aside className="verification"><span className="pill">Vorschau · unverifiziert</span><h3>Was wurde übergeben?</h3><dl className="rules"><div><dt>Magnitudenwert</dt><dd>{String(preview?.magnitude ?? '—')}</dd></div><div><dt>Ereignis-ID</dt><dd>{String(preview?.eventId ?? '—')}</dd></div><div><dt>Reviewstatus</dt><dd>{String(preview?.status ?? '—')}</dd></div></dl>
          <h3>Vier Ablehnungsfälle</h3><ol><li>Echten Datenwert verändern</li><li>Echte Antwort über 5 Minuten altern lassen</li><li>Echte Antwort auf eine andere Anfrage</li><li>Signatur eines fremden Schlüssels</li></ol><p className="helper">CLI: <code>npm run tamper</code>. Netzwerkfehler zählen nicht als erfolgreiche Ablehnung. Bei altem Datensatz den signierten Zeitstempel unverändert lassen.</p>
          <details><summary>Festgelegter Signer und Anfragehash</summary><p className="hash">{config?.airnode}</p><p className="hash">{config?.requestHash}</p><p className="helper">Diese Werte liegen unveränderlich im deployten Contract. Mitgelieferte Metadaten bestimmen kein Vertrauen.</p></details>
        </aside></div></section>}

      <section className="panel history"><div className="history-heading"><div><p className="eyebrow">ÖFFENTLICH NACHVOLLZIEHBAR</p><h2>Auszahlungen</h2></div><span className="pill">{snapshot?.history.length ?? 0} Einträge</span></div>
        {!snapshot?.history.length ? <p className="empty">Noch keine Auszahlung. Jede bestätigte Freigabe erscheint hier mit Empfänger und Grund.</p> : <div className="table-wrap"><table><thead><tr><th>Empfänger</th><th>Betrag</th><th>Freigabegrund</th><th>Nachweis</th></tr></thead><tbody>{snapshot.history.map(row => <tr key={payoutId(row)}><td>Demo-NGO {(config?.ngos.findIndex(a => a.toLowerCase() === row.ngo.toLowerCase()) ?? -1) + 1}<small>{short(row.ngo)}</small></td><td>{money(row.amount)} dUSD</td><td><span className="pill">{row.path === 0 ? 'Signiertes Ereignis' : '2/3-Notfallquorum'}</span></td><td>{local ? <code>{short(row.hash)}</code> : <a target="_blank" rel="noreferrer" href={explorer(row.hash)}>Transaktion ↗</a>}</td></tr>)}</tbody></table></div>}
      </section>
      <footer><span>DisasterDAO · Hackathon-Prototyp</span><p>Fiktive Organisationen · Historisches Ereignis · Wertlose Demotoken · Keine Spendenbescheinigung</p>{config && <a href={local ? '#' : explorer(config.fund, 'address')} target={local ? undefined : '_blank'} rel="noreferrer">Contract {short(config.fund)} ↗</a>}</footer>
    </main>
  </>;
}

