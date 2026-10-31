import React, { useEffect, useState } from 'react';
import { api, useUI } from './context.tsx';
import type { SignedResponse } from '../../src/vendor/airnode-v2.ts';
type Config = {
  chainId: number;
  network: string;
  fund: string;
  oracleVerifier: string;
  ngos: string[];
  policies: {
    incidentId: string;
    airnode: string;
    requestHash: string;
    synthetic: boolean;
    enabled: boolean;
    observedFrom: number;
    observedUntil: number;
  }[];
};
export function JuryPage() {
  const { locale, run, busy, organizations } = useUI(),
    de = locale === 'de';
  const [org, setOrg] = useState('local-alliance'),
    [config, setConfig] = useState<Config>(),
    [slot, setSlot] = useState(0),
    [ngo, setNGO] = useState(0),
    [files, setFiles] = useState<
      Partial<Record<'proof' | 'old' | 'other', SignedResponse>>
    >({}),
    [result, setResult] = useState<unknown>();
  useEffect(() => {
    api<Config>('/jury/config', 'GET', undefined, org)
      .then(setConfig)
      .catch(() => setConfig(undefined));
    setResult(undefined);
  }, [org]);
  return (
    <section className="panel" aria-label="Jury / API3">
      <h1>Jury / API3</h1>
      <p>
        {de
          ? 'Originale Airnode-Antwort importieren und direkt vom aktiven Contract prüfen lassen. Eine Simulation reserviert und zahlt nichts.'
          : 'Import an original Airnode response for direct verification by the active contract. Simulation reserves and pays nothing.'}
      </p>
      <label>
        {de ? 'Bündnis' : 'Alliance'}
        <select value={org} onChange={(e) => setOrg(e.target.value)}>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {config ? (
        <>
          <p>
            {config.network} · Chain-ID {config.chainId}
          </p>
          <p className="workflow-code">Contract: {config.fund}</p>
          <p className="workflow-code">Verifier: {config.oracleVerifier}</p>
          <label>
            {de ? 'Einsatz' : 'Incident'}
            <select
              value={slot}
              onChange={(e) => {
                setSlot(Number(e.target.value));
                setResult(undefined);
              }}
            >
              {config.policies.map((p, i) => (
                <option key={p.incidentId} value={i}>
                  {p.incidentId}
                  {!p.enabled ? ' — external review' : ''}
                </option>
              ))}
            </select>
          </label>
          <p>
            {config.policies[slot]?.synthetic
              ? de
                ? 'Synthetische lokale Demo; kein echter Airnode-Nachweis.'
                : 'Synthetic local demo; no genuine Airnode evidence.'
              : de
                ? 'Echter Airnode erforderlich. Historischer Testeinsatz; Signatur maximal fünf Minuten alt und nach Fondsaktivierung.'
                : 'Genuine Airnode required. Historical test incident; signature no more than five minutes old and after activation.'}
          </p>
          <p className="workflow-code">
            Signer: {config.policies[slot]?.airnode}
            <br />
            Request: {config.policies[slot]?.requestHash}
          </p>
          <label>
            NGO
            <select
              value={ngo}
              onChange={(e) => setNGO(Number(e.target.value))}
            >
              {config.ngos.map((address, i) => (
                <option key={address} value={i}>
                  NGO {i + 1} · {address}
                </option>
              ))}
            </select>
          </label>
          {(['proof', 'old', 'other'] as const).map((key, i) => (
            <label key={key}>
              {
                (de
                  ? [
                      'Originalantwort',
                      'Echte veraltete Antwort (für Tests)',
                      'Originalantwort einer anderen Anfrage (für Tests)',
                    ]
                  : [
                      'Original response',
                      'Genuine stale response (for tests)',
                      'Original response to another request (for tests)',
                    ])[i]
              }
              <input
                type="file"
                accept=".json,application/json"
                aria-label={key}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void run(async () => {
                      if (f.size > 150000) throw new Error('File too large');
                      const p = JSON.parse(await f.text()) as SignedResponse;
                      setFiles((x) => ({ ...x, [key]: p }));
                      setResult(undefined);
                    });
                }}
              />
            </label>
          ))}
          <div className="actions">
            <button
              disabled={busy || !files.proof}
              onClick={() =>
                run(async () =>
                  setResult(
                    await api(
                      '/jury/simulate',
                      'POST',
                      { proof: files.proof, slot, ngo },
                      org,
                    ),
                  ),
                )
              }
            >
              {de
                ? 'Direkt im Contract simulieren'
                : 'Simulate directly in contract'}
            </button>
            <button
              disabled={busy || !files.proof || !files.old || !files.other}
              onClick={() =>
                run(async () =>
                  setResult(
                    await api(
                      '/jury/tamper',
                      'POST',
                      { ...files, slot, ngo },
                      org,
                    ),
                  ),
                )
              }
            >
              {de
                ? 'Gültigen Fall und vier Ablehnungen prüfen'
                : 'Check valid case and four rejections'}
            </button>
          </div>
          {result !== undefined && (
            <pre className="workflow-code" role="status">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          <p>
            {de
              ? 'Für eine tatsächliche Auszahlung im NGO-Arbeitsbereich dieselbe Originaldatei beim Antrag und bei der Reservierung importieren; danach separat abrufen. Läuft die Signatur ab, eine neue originale Antwort beschaffen.'
              : 'For a real payout, import the same original file for the NGO application and reservation, then claim separately. Obtain a new original response if the signature expires.'}
          </p>
          <a href="/?ngo=1#/ngo">
            {de ? 'Zum NGO-Arbeitsbereich' : 'Open NGO workspace'}
          </a>
        </>
      ) : (
        <p role="status">
          {de
            ? 'Contract-Konfiguration wird geladen oder ist nicht erreichbar.'
            : 'Loading contract configuration, or contract unavailable.'}
        </p>
      )}
    </section>
  );
}
