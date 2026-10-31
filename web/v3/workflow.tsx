import type { SignedResponse } from '../../src/vendor/airnode-v2.ts';
import { OriginalResponseInput } from './original-response.tsx';
import React, { useEffect, useState } from 'react';
import { api, amount, saveJSON, useUI } from './context.tsx';
import type { AutomaticPreview, WorkflowCase } from '../../src/v3/ui-types.ts';

const steps = [
  ['Katastrophe belegen', 'Verify disaster'],
  ['Hilfe beantragen', 'Apply for help'],
  ['Mittel freigeben', 'Approve funding'],
  ['Geld abrufen', 'Claim payment'],
  ['Verwendung nachweisen', 'Account for spending'],
];
const messages: Record<string, [string, string]> = {
  payment_required: [
    'Die Quelle verlangt Bezahlung durch den Betreiber. Erneut prüfen oder externe Prüfung wählen.',
    'The source requires operator payment. Retry or choose external review.',
  ],
  evidence_block: [
    'Weitere Mittel sind wegen offener Nachweispflichten gesperrt.',
    'Further funds are blocked by evidence obligations.',
  ],
  round_wait: [
    'Die nächste Förderrunde ist noch nicht geöffnet.',
    'The next funding round is not open yet.',
  ],
  reservation_expired: [
    'Die Reservierung ist abgelaufen; dieser Betrag kann nicht mehr abgerufen werden.',
    'The reservation expired; this amount can no longer be claimed.',
  ],
  application_expired: [
    'Die Antragsfrist ist abgelaufen. Antrag schließen und neu beantragen.',
    'The application expired. Close it and apply again.',
  ],
  rejected: [
    'Verwendung abgelehnt. Einspruch ist innerhalb von 14 Tagen möglich.',
    'Spending rejected. An appeal is possible within 14 days.',
  ],
  unavailable: [
    'Quelle nicht erreichbar oder für diesen Einsatz nicht verfügbar. Erneut prüfen oder externe Prüfung wählen.',
    'Source unavailable for this incident. Retry or choose external review.',
  ],
  observation_stale: [
    'Die Beobachtungszeit passt nicht zum registrierten Ereignisfenster; in der synthetischen Demo gilt höchstens ein Tag.',
    'The observation time does not match the registered event window; the synthetic demo permits at most one day.',
  ],
  signature_stale: [
    'Die signierte Antwort ist veraltet oder liegt in der Zukunft. Aktuelle Daten abrufen.',
    'The signed response is stale or future dated. Fetch current data.',
  ],
  rule_not_met: [
    'Die Ereignisdaten erfüllen die Förderschwelle nicht.',
    'The event does not meet the funding threshold.',
  ],
  invalid_proof: [
    'Signatur, Ereignis oder Gebiet passen nicht zur Förderregel.',
    'Signature, event or area does not match the funding policy.',
  ],
};
export function WorkflowSteps({ current }: { current: number }) {
  const { locale } = useUI();
  return (
    <ol className="steps workflow-steps">
      {steps.map((s, i) => (
        <li key={i} aria-current={current === i + 1 ? 'step' : undefined}>
          <span>
            {i + 1}. {s[locale === 'de' ? 0 : 1]}
          </span>
        </li>
      ))}
    </ol>
  );
}
function Quote({
  q,
  funding = true,
}: {
  q: AutomaticPreview;
  funding?: boolean;
}) {
  const { locale, money, date } = useUI(),
    de = locale === 'de';
  return (
    <div className="workflow-quote" role="status">
      <p>
        <strong>
          {q.synthetic
            ? de
              ? 'Synthetische, lokal signierte Demo-Daten'
              : 'Synthetic, locally signed demo data'
            : 'Airnode · live'}
        </strong>
      </p>
      <p>
        {q.available
          ? de
            ? 'Signatur und Förderregel im Contract geprüft.'
            : 'Signature and funding rule verified by the contract.'
          : messages[q.sourceStatus]?.[de ? 0 : 1]}
      </p>
      <p>
        {de ? 'Förderregel' : 'Funding rule'}: {q.rule} ·{' '}
        {de ? 'Wert' : 'Value'}: {Number(q.severity) / 100} {q.source.unit}
      </p>
      <details>
        <summary>
          {de
            ? 'Quelldaten und Signaturbindung'
            : 'Source data and signature binding'}
        </summary>
        <p>{String(q.source.eventId)}</p>
        <p>
          {de ? 'Beobachtet' : 'Observed'}: {q.source.observedAt ?? '—'}
        </p>
        <p>
          {de ? 'Signiert' : 'Signed'}:{' '}
          {q.source.signedAt ? date(q.source.signedAt) : '—'}
        </p>
        <p className="workflow-code">{q.source.signer}</p>
        <p className="workflow-code">{q.source.requestHash}</p>
      </details>
      <div hidden={!funding}>
        <p>
          {de
            ? 'Unverbindlicher möglicher Anteil'
            : 'Non-binding estimated allocation'}
          : <strong>{money(q.amount)}</strong>
        </p>
        <p>
          {de
            ? 'Restspielraum nach bisherigen Zahlungen, Reservierungen und externen Mitteln'
            : 'Remaining capacity after prior payments, reservations and external funding'}
          : {money(q.remaining)} · {de ? 'Frei im Fonds' : 'Free in fund'}:{' '}
          {money(q.fundFree)} ·{' '}
          {de ? 'Unsicherheitsreserve davon' : 'Uncertainty reserve'}:{' '}
          {money(q.uncertaintyReserve)}
        </p>
        <p>
          {de
            ? 'Begrenzt durch Antrag, Kapazität, externe Mittel, bisherige Zahlungen/Reservierungen, gemeinsame Verteilung und 20 % Unsicherheitsreserve. Kumulative Fördergrenze: 4.050 dUSD (90 % von 4.500).'
            : 'Limited by request, capacity, external funding, prior payments/reservations, shared allocation and 20% uncertainty reserve. Cumulative funding limit: 4,050 dUSD (90% of 4,500).'}
        </p>
        {q.available && (
          <p>
            {q.authorized
              ? de
                ? 'Freigabe: Contract-Regel erfüllt; keine zusätzliche NGO-Zustimmung erforderlich.'
                : 'Approval: contract rule met; no additional peer approval required.'
              : de
                ? 'Freigabe: Zwei andere berechtigte NGOs müssen zustimmen, sofern keine aktuelle Verschlechterung oder akzeptierte Nachweishistorie vorliegt.'
                : 'Approval: two other eligible NGOs must approve unless current worsening or accepted evidence history qualifies.'}
          </p>
        )}
        {q.blocked && <p role="alert">{messages.evidence_block[de ? 0 : 1]}</p>}
        {q.nextRound > q.chainTime && (
          <p>
            {messages.round_wait[de ? 0 : 1]} {date(q.nextRound)}
          </p>
        )}
        {BigInt(q.amount) === 0n && (
          <p>
            {de
              ? 'Kein Anteil verfügbar: Fördergrenze, Fondsbestand oder bestehende Bindungen begrenzen den Antrag. Es wird kein Geld reserviert.'
              : 'No allocation available: funding limits, fund balance or existing commitments constrain this request. No money is reserved.'}
          </p>
        )}
      </div>
    </div>
  );
}
export function NGOFlow({ external }: { external: () => void }) {
  const { portal, locale, run, busy, money, date } = useUI(),
    de = locale === 'de';
  const key = `v3-application-${portal!.role.id}`;
  const [draft, setDraft] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved)
        return JSON.parse(saved) as {
          requestId: string;
          incident: string;
          requested: string;
          capacity: string;
          external: string;
          explanation: string;
        };
    } catch {}
    return {
      requestId: crypto.randomUUID(),
      incident: portal!.incidents[0]?.id ?? '',
      requested: '500',
      capacity: '500',
      external: '0',
      explanation: '',
    };
  });
  const [proof, setProof] = useState<SignedResponse>();
  const [current, setCurrent] = useState(1),
    [quote, setQuote] = useState<AutomaticPreview>(),
    [cases, setCases] = useState<WorkflowCase[]>(),
    [error, setError] = useState(false),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(draft));
  }, [draft, key]);
  useEffect(() => {
    let active = true;
    setError(false);
    api<WorkflowCase[]>('/workflow')
      .then((x) => {
        if (active) setCases(x);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [portal]);
  const input = () => ({
    proof,
    incident: draft.incident,
    requested: amount(draft.requested),
    capacity: amount(draft.capacity),
    external: amount(draft.external),
  });
  const update = (k: string, v: string) => {
    if (k === 'incident') setProof(undefined);
    setDraft((d) => ({ ...d, [k]: v }));
    setQuote(undefined);
  };
  return (
    <section
      className="panel ngo-flow"
      aria-label={de ? 'NGO-Ablauf' : 'NGO workflow'}
    >
      <div className="section-heading">
        <h2>{de ? 'Vom Ereignis zur Hilfe' : 'From disaster to relief'}</h2>
        <button
          className="primary"
          onClick={() => {
            setCreating(true);
            setCurrent(1);
            setQuote(undefined);
          }}
        >
          {de ? 'Hilfe beantragen' : 'Apply for help'}
        </button>
      </div>
      <p>
        {de
          ? 'Jeder Fall zeigt den nächsten Schritt, die zuständige Rolle und den Geldstatus. Testprototyp mit wertlosen dUSD.'
          : 'Each case shows the next step, responsible role and funding status. Test prototype with worthless dUSD.'}
      </p>
      {creating && (
        <div className="workflow-case">
          <WorkflowSteps current={current} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (current === 1) {
                  setQuote(
                    await api(
                      '/automatic/preview',
                      'POST',
                      current === 1
                        ? {
                            proof,
                            incident: draft.incident,
                            requested: '500000000',
                            capacity: '500000000',
                            external: '0',
                          }
                        : input(),
                    ),
                  );
                  return;
                }
                if (!quote) {
                  setQuote(
                    await api(
                      '/automatic/preview',
                      'POST',
                      current === 1
                        ? {
                            proof,
                            incident: draft.incident,
                            requested: '500000000',
                            capacity: '500000000',
                            external: '0',
                          }
                        : input(),
                    ),
                  );
                  return;
                }
                await api('/automatic/submit', 'POST', {
                  ...input(),
                  explanation: draft.explanation,
                  requestId: draft.requestId,
                });
                setCreating(false);
                setQuote(undefined);
                setDraft((d) => ({ ...d, requestId: crypto.randomUUID() }));
              });
            }}
          >
            <h3>
              {current === 1 ? steps[0][de ? 0 : 1] : steps[1][de ? 0 : 1]}
            </h3>
            <p>
              {de ? 'Jetzt zuständig: Ihre NGO.' : 'Responsible now: your NGO.'}
            </p>
            <label>
              {de ? 'Einsatz' : 'Incident'}
              <select
                value={draft.incident}
                disabled={current !== 1}
                onChange={(e) => update('incident', e.target.value)}
              >
                {portal!.incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            {current === 2 && (
              <>
                <label>
                  {de ? 'Einsatzzweck' : 'Intended use'}
                  <textarea
                    required
                    minLength={20}
                    maxLength={2000}
                    value={draft.explanation}
                    onChange={(e) => update('explanation', e.target.value)}
                  />
                </label>
                {(['requested', 'capacity', 'external'] as const).map(
                  (k, i) => (
                    <label key={k}>
                      {
                        (de
                          ? [
                              'Beantragter Betrag / dUSD',
                              'Umsetzbare Kapazität / dUSD',
                              'Vorhandene externe Finanzierung / dUSD',
                            ]
                          : [
                              'Requested amount / dUSD',
                              'Delivery capacity / dUSD',
                              'Existing external funding / dUSD',
                            ])[i]
                      }
                      <input
                        required
                        type="number"
                        min={i === 2 ? '0' : '0.000001'}
                        step="0.000001"
                        max={i === 2 ? '999999' : '4500'}
                        value={draft[k]}
                        onChange={(e) => update(k, e.target.value)}
                      />
                    </label>
                  ),
                )}
              </>
            )}
            <OriginalResponseInput
              onChange={(p) => {
                setProof(p);
                setQuote(undefined);
              }}
            />
            {quote && <Quote q={quote} funding={current !== 1} />}
            {current === 2 && quote && (
              <p>
                {de
                  ? 'Mit dem Einreichen werden Einsatz, Zweck und Beträge verbindlich an diesen Antrag gebunden. Es wird noch kein Geld reserviert oder ausgezahlt.'
                  : 'Submission binds the incident, purpose and amounts to this application. No funds are reserved or transferred yet.'}
              </p>
            )}
            <div className="actions">
              <button
                disabled={
                  busy ||
                  (current === 2 &&
                    !!quote &&
                    (!quote.available || quote.blocked))
                }
              >
                {current === 1
                  ? de
                    ? 'Ereignisdaten prüfen'
                    : 'Check event data'
                  : !quote
                    ? de
                      ? 'Antrag prüfen'
                      : 'Preview application'
                    : de
                      ? 'Antrag verbindlich einreichen'
                      : 'Submit application'}
              </button>
              {current === 1 && quote?.available && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setCurrent(2);
                    setQuote(undefined);
                  }}
                >
                  {de ? 'Weiter zum Antrag' : 'Continue to application'}
                </button>
              )}
              {current === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(1);
                    setQuote(undefined);
                  }}
                >
                  {de ? 'Zurück' : 'Back'}
                </button>
              )}
              <button type="button" onClick={() => setCreating(false)}>
                {de ? 'Schließen' : 'Close'}
              </button>
            </div>
            <details>
              <summary>
                {de
                  ? 'Externe Prüfung als Alternative'
                  : 'External review alternative'}
              </summary>
              <p>
                {de
                  ? 'Ohne passende Quelldaten prüfen zwei Datenprüfer den Antrag und anschließend die gemeinsame Runde. Der Betreiber bereitet die Runde vor.'
                  : 'Without suitable source data, two data reviewers approve the application and shared round. The operator prepares the round.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  external();
                }}
              >
                {de ? 'Externen Antrag öffnen' : 'Open external application'}
              </button>
            </details>
          </form>
        </div>
      )}
      {error && (
        <p role="alert">
          {de
            ? 'Fallstatus konnte nicht geladen werden. Bitte aktualisieren; Geldstatus unbekannt.'
            : 'Could not load case status. Please refresh; funding status unknown.'}
        </p>
      )}
      {!cases && !error && (
        <p role="status">{de ? 'Fälle werden geladen …' : 'Loading cases …'}</p>
      )}
      {cases?.length === 0 && (
        <p>
          {de
            ? 'Noch kein Antrag. Starten Sie mit „Hilfe beantragen“.'
            : 'No applications yet. Start with “Apply for help”.'}
        </p>
      )}
      {!error &&
        cases?.map((c) => (
          <CaseCard
            key={c.id}
            c={c}
            onNew={() => {
              setCreating(true);
              setCurrent(1);
              setQuote(undefined);
            }}
          />
        ))}
    </section>
  );
}
function CaseCard({ c, onNew }: { c: WorkflowCase; onNew: () => void }) {
  const { portal, locale, run, busy, money, date } = useUI(),
    de = locale === 'de';
  const [proof, setProof] = useState<SignedResponse>();
  const [q, setQ] = useState<AutomaticPreview>();

  const a = portal!.apps.find((a) => a.id === c.id)!;
  const count = c.votes.toString(2).split('1').length - 1;
  const actionLabel: Record<string, [string, string]> = {
    reserve: ['Freigabe prüfen', 'Check approval'],
    claim: ['Reservierten Betrag abrufen', 'Claim reserved amount'],
    release: [
      'Abgelaufene Reservierung freigeben',
      'Release expired reservation',
    ],
    expire: ['Abgelaufenen Antrag schließen', 'Close expired application'],
    upload_evidence: [
      'Ausgabennachweise hochladen',
      'Upload spending evidence',
    ],
    provide_more_evidence: [
      'Nachgeforderte Belege ergänzen',
      'Provide requested evidence',
    ],
    await_review: [
      'Externen Prüfbericht und signierte Entscheidung importieren',
      'Import external report and signed decision',
    ],
    await_receipt: [
      'Auf zwei signierte Eingangsbestätigungen warten',
      'Await two signed receipt approvals',
    ],
    appeal: ['Einspruch vorbereiten', 'Prepare appeal'],
    await_appeal: ['Auf Einspruchsprüfer warten', 'Await appeal reviewers'],
    new_application: ['Neuen Antrag starten', 'Start a new application'],
    export_application: ['Prüfauftrag exportieren', 'Export review request'],
    await_round: [
      'Betreiber und zwei Datenprüfer müssen die Runde freigeben',
      'Operator and two data reviewers must approve the round',
    ],
    resubmit: ['Antrag erneut einreichen', 'Resubmit application'],
  };
  const isEvidence = c.step === 5;
  return (
    <article className="workflow-case" data-testid="workflow-case">
      <h3>
        {portal!.incidents.find((i) => i.id === c.incident)?.name ?? c.incident}
      </h3>
      <WorkflowSteps current={c.step} />
      <p>{c.explanation}</p>
      <dl className="summary">
        <div>
          <dt>{de ? 'Beantragt' : 'Requested'}</dt>
          <dd>{money(c.requested)}</dd>
        </div>
        <div>
          <dt>{de ? 'Reserviert' : 'Reserved'}</dt>
          <dd>{money(c.reserved)}</dd>
        </div>
        <div>
          <dt>{de ? 'Ausgezahlt' : 'Paid'}</dt>
          <dd>{money(c.paid)}</dd>
        </div>
      </dl>
      <p>
        {de ? 'Jetzt zuständig' : 'Responsible now'}:{' '}
        {q && !q.authorized && q.available
          ? de
            ? 'zwei andere berechtigte NGOs'
            : 'two other eligible peer NGOs'
          : {
              ngo: de ? 'Ihre NGO' : 'your NGO',
              data_reviewers: de ? 'zwei Datenprüfer' : 'two data reviewers',
              evidence_reviewers: de
                ? 'zwei Nachweisprüfer'
                : 'two evidence reviewers',
              appeal_reviewers: de
                ? 'zwei Einspruchsprüfer'
                : 'two appeal reviewers',
              operator_and_data_reviewers: de
                ? 'Betreiber und zwei Datenprüfer'
                : 'operator and two data reviewers',
            }[c.actor]}
        .
      </p>
      {c.reservationId && (
        <p className="workflow-code">
          {de ? 'Fester Empfänger' : 'Fixed recipient'}: {portal!.role.ngo}
        </p>
      )}
      {c.deadline && (
        <p>
          {de ? 'Frist' : 'Deadline'}: {date(c.deadline)}
        </p>
      )}
      <p>
        {c.confirmed
          ? de
            ? 'Vorgang mit zwei Folgeblöcken bestätigt.'
            : 'Operation confirmed with two subsequent blocks.'
          : de
            ? 'Bestätigung ausstehend. Gemint und bestätigt sind getrennte Zustände.'
            : 'Confirmation pending. Mined and confirmed are separate states.'}
      </p>
      {c.tx && (
        <details>
          <summary>{de ? 'Transaktion' : 'Transaction'}</summary>
          <code className="workflow-code">{c.tx}</code>
        </details>
      )}
      {c.reasonCodes.map((r) => (
        <p key={r} role="status">
          {messages[r]?.[de ? 0 : 1] ?? r}
          {r === 'round_wait' ? ` ${date(c.nextRound)}` : ''}
        </p>
      ))}
      {c.blockingEvidence.map((id) => (
        <p key={id}>
          <a
            href={`#evidence-${id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`evidence-${id}`)?.scrollIntoView();
            }}
          >
            {de ? 'Blockierender Nachweis' : 'Blocking evidence'} #{id}
          </a>
        </p>
      ))}
      <p>
        <strong>
          {de ? 'Nächster Schritt' : 'Next step'}:{' '}
          {actionLabel[c.action]?.[de ? 0 : 1]}
        </strong>
      </p>
      {c.action === 'new_application' && (
        <button onClick={onNew}>
          {actionLabel.new_application[de ? 0 : 1]}
        </button>
      )}
      {isEvidence && (
        <button
          onClick={() =>
            document
              .getElementById(`evidence-${c.evidenceId}`)
              ?.scrollIntoView()
          }
        >
          {de ? 'Nachweis öffnen' : 'Open evidence'} #{c.evidenceId}
        </button>
      )}
      {c.action === 'reserve' && (
        <>
          <OriginalResponseInput
            onChange={(p) => {
              setProof(p);
              setQ(undefined);
            }}
          />
          <button
            disabled={busy}
            onClick={() =>
              run(async () =>
                setQ(
                  await api('/automatic/preview', 'POST', {
                    proof,
                    incident: a.incident,
                    requested: a.requested,
                    capacity: a.capacity,
                    external: a.external,
                  }),
                ),
              )
            }
          >
            {de ? 'Freigabe prüfen' : 'Check approval'}
          </button>
          {q && (
            <>
              <Quote q={q} />
              {!q.authorized && (
                <p>
                  {de ? 'On-chain NGO-Zustimmungen' : 'On-chain peer approvals'}
                  : {count}/2
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  !q.available ||
                  !q.authorized ||
                  q.blocked ||
                  q.nextRound > q.chainTime ||
                  BigInt(q.amount) === 0n ||
                  c.reasonCodes.includes('application_expired')
                }
                onClick={() =>
                  run(() =>
                    api('/automatic/reserve', 'POST', {
                      application: c.id,
                      proof,
                    }),
                  )
                }
              >
                {de ? 'Mittel verbindlich reservieren' : 'Reserve funding'}
              </button>
            </>
          )}
        </>
      )}
      {['claim', 'release'].includes(c.action) && (
        <button
          className="primary"
          disabled={
            busy ||
            (c.action === 'claim' && c.reasonCodes.includes('evidence_block'))
          }
          onClick={() =>
            run(() =>
              api(`/reservations/${c.reservationId}`, 'POST', {
                action: c.action,
              }),
            )
          }
        >
          {actionLabel[c.action][de ? 0 : 1]}
        </button>
      )}
      {c.action === 'resubmit' && (
        <button
          disabled={busy}
          onClick={() =>
            run(() =>
              api('/automatic/submit', 'POST', {
                incident: a.incident,
                requested: a.requested,
                capacity: a.capacity,
                external: a.external,
                explanation: a.explanation,
                requestId: a.id,
              }),
            )
          }
        >
          {actionLabel.resubmit[de ? 0 : 1]}
        </button>
      )}
      {c.action === 'expire' && (
        <button
          disabled={busy}
          onClick={() =>
            run(() =>
              api(`/applications/${c.id}`, 'POST', { action: 'expire' }),
            )
          }
        >
          {actionLabel.expire[de ? 0 : 1]}
        </button>
      )}
      {c.action === 'export_application' && (
        <button
          disabled={busy}
          onClick={() =>
            run(async () =>
              saveJSON(
                `APPLICATION-${c.id}.json`,
                await api('/approvals/export', 'POST', {
                  purpose: 'APPLICATION',
                  target: c.id,
                }),
              ),
            )
          }
        >
          {actionLabel.export_application[de ? 0 : 1]}
        </button>
      )}
    </article>
  );
}
