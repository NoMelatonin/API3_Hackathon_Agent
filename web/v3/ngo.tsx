import React, { useEffect, useState } from 'react';
import type { ApprovalBundle, Preview } from '../../src/v3/ui-types.ts';
import { api, amount, saveJSON, useUI, type Evidence } from './context.tsx';
import { ActivityList, FundMetrics } from './components.tsx';

function ApplicationWizard({ onClose }: { onClose: () => void }) {
  const { portal, organizations, tr, run, busy, money } = useUI();
  const [step, setStep] = useState(1),
    [incident, setIncident] = useState(portal!.incidents[0]?.id ?? ''),
    [requested, setRequested] = useState('500'),
    [capacity, setCapacity] = useState('500'),
    [external, setExternal] = useState('0'),
    [explanation, setExplanation] = useState(''),
    [change, setChange] = useState(''),
    [conflicts, setConflicts] = useState(0),
    [preview, setPreview] = useState<Preview>();
  const input = () => ({
    incident,
    requested: amount(requested),
    capacity: amount(capacity),
    external: amount(external),
  });
  function invalidate() {
    setPreview(undefined);
    setStep(2);
  }
  return (
    <section className="panel" id="application-form">
      <div className="section-heading">
        <h2>{tr('start_application')}</h2>
        <button onClick={onClose}>{tr('close')}</button>
      </div>
      <ol className="steps">
        <li aria-current={step === 1 ? 'step' : undefined}>
          {tr('incident_need')}
        </li>
        <li aria-current={step === 2 ? 'step' : undefined}>
          {tr('amount_preview')}
        </li>
        <li aria-current={step === 3 ? 'step' : undefined}>{tr('confirm')}</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) {
            setStep(2);
            return;
          }
          if (step === 2) {
            void run(async () => {
              setPreview(
                await api<Preview>('/applications/preview', 'POST', input()),
              );
              setStep(3);
            });
            return;
          }
          void run(async () => {
            await api('/applications', 'POST', {
              ...input(),
              explanation,
              change,
              conflicts,
            });
            onClose();
          });
        }}
      >
        {step === 1 && (
          <>
            <label>
              {tr('incident')}
              <select
                value={incident}
                onChange={(e) => {
                  setIncident(e.target.value);
                  setPreview(undefined);
                }}
              >
                {portal!.incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.areaId}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr('need_rationale_and_conflicts_of_interest')}
              <textarea
                required
                minLength={20}
                maxLength={2000}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
            <label>
              {tr('material_change_for_a_follow_up')}
              <textarea
                maxLength={2000}
                value={change}
                onChange={(e) => setChange(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>{tr('conflicted_ngos_for_follow_up_voting')}</legend>
              {organizations[0]?.members.map((m, index) =>
                m.wallet.toLowerCase() ===
                portal!.role.ngo?.toLowerCase() ? null : (
                  <label className="checkbox" key={m.id}>
                    <input
                      type="checkbox"
                      checked={(conflicts & (1 << index)) !== 0}
                      onChange={(e) =>
                        setConflicts((previous) =>
                          e.target.checked
                            ? previous | (1 << index)
                            : previous & ~(1 << index),
                        )
                      }
                    />
                    {m.name}
                  </label>
                ),
              )}
            </fieldset>
          </>
        )}
        {step === 2 && (
          <>
            <p>{tr('synthetic_model_a_preview_reserves_no_funds')}</p>
            {[
              [tr('requested_dusd'), requested, setRequested],
              [tr('capacity_dusd'), capacity, setCapacity],
              [tr('external_funding_dusd'), external, setExternal],
            ].map(([label, value, set], i) => (
              <label key={String(label)}>
                {String(label)}
                <input
                  required
                  inputMode="decimal"
                  type="number"
                  step="0.000001"
                  min={i === 2 ? '0' : '0.000001'}
                  value={value as string}
                  onChange={(e) => {
                    (set as (v: string) => void)(e.target.value);
                    setPreview(undefined);
                  }}
                />
              </label>
            ))}
          </>
        )}
        {step === 3 && preview && (
          <>
            <h3>{tr('non_binding_preview')}</h3>
            <dl className="summary">
              <div>
                <dt>
                  {preview.manual
                    ? tr('manual_proposal_for_external_review')
                    : tr('synthetic_model_ceiling')}
                </dt>
                <dd>{money(preview.proposedMaximum)}</dd>
              </div>
              <div>
                <dt>{tr('remaining_claim_before_capacity_limit')}</dt>
                <dd>{money(preview.remaining)}</dd>
              </div>
              <div>
                <dt>{tr('estimated_round_allocation')}</dt>
                <dd>{money(preview.estimated)}</dd>
              </div>
              <div>
                <dt>{tr('already_paid_reserved')}</dt>
                <dd>
                  {money(preview.paid)} / {money(preview.reserved)}
                </dd>
              </div>
              <div>
                <dt>{tr('requested')}</dt>
                <dd>{requested} dUSD</dd>
              </div>
            </dl>
            <p>{explanation}</p>
            <p>
              {tr('uncertainty_reserve_20_for_unknown_coverage_cumulative')}
            </p>
            <p className="notice">
              {tr('local_confirmation_the_server_uses_test_keys')}
            </p>
            {preview.blocked && (
              <p role="alert">{tr('ngo_is_blocked_from_further_payouts')}</p>
            )}
          </>
        )}
        <div className="actions">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setStep(step - 1);
                if (step === 3) invalidate();
              }}
            >
              {tr('back')}
            </button>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              portal!.blocked ||
              (step === 3 &&
                (!preview ||
                  preview.blocked ||
                  BigInt(preview.remaining) === 0n))
            }
          >
            {step === 1
              ? tr('next')
              : step === 2
                ? tr('calculate_preview')
                : tr('submit_application')}
          </button>
        </div>
      </form>
    </section>
  );
}
async function uploadDocument(id: number, file: File, category: string) {
  const ticket = await api<{ url: string }>('/uploads', 'POST', {
    evidenceId: id,
    name: file.name,
    mime: file.type || 'text/plain',
    size: file.size,
    synthetic: true,
    category,
  });
  const r = await fetch(ticket.url, {
    method: 'PUT',
    headers: {
      'x-v3-request': 'local-prototype',
      'Content-Type': file.type || 'text/plain',
    },
    body: file,
  });
  if (!r.ok) throw new Error((await r.json()).error ?? String(r.status));
}
function EvidenceCard({ e }: { e: Evidence }) {
  const { portal, tr, money, date, run, busy } = useUI();
  const [category, setCategory] = useState('expenditure-evidence'),
    [interim, setInterim] = useState('');
  const docs = portal!.documents.filter((d) => d.evidenceId === e.id);
  const received = docs.some(
    (d) => d.uploaded && d.category !== 'external-review',
  );
  const states = [
    tr('evidence_pending'),
    tr('receipt_confirmed_in_review'),
    tr('use_accepted'),
    tr('more_information_requested'),
    tr('rejected'),
    tr('appeal_pending'),
    tr('resolved'),
  ];
  const due = e.status === 3 ? e.responseDue : e.due;
  const overdue = [0, 3].includes(e.status) && portal!.chainTime > due;
  return (
    <article className="evidence-card">
      <div className="section-heading">
        <h3>
          {tr('payout')} #{e.id} · {money(e.amount)}
        </h3>
        <span className={overdue ? 'badge error' : 'badge'}>
          {!e.confirmed
            ? tr('contract_state_index_confirmation_pending')
            : overdue
              ? tr('overdue')
              : states[e.status]}
        </span>
      </div>
      <p>
        {tr('final_evidence_due')}: {date(due)}
      </p>
      <p>
        {tr('interim_report_due')}: {date(e.interimDue)} ·{' '}
        {portal!.interim.some((i) => i.evidenceId === e.id)
          ? tr('saved')
          : tr('still_pending')}
      </p>
      <p>
        {received
          ? tr('document_saved_upload_alone_is_neither_a')
          : tr('no_completed_expenditure_evidence_upload_yet')}
      </p>
      <label>
        {tr('document_type')}
        <select value={category} onChange={(x) => setCategory(x.target.value)}>
          <option value="expenditure-evidence">
            {tr('expenditure_evidence')}
          </option>
          <option value="external-review">
            {tr('external_review_document')}
          </option>
        </select>
      </label>
      <label>
        {tr('upload_synthetic_document')}
        <input
          disabled={busy}
          type="file"
          accept=".txt,.pdf,.png,.jpg,.jpeg"
          onChange={(x) => {
            const f = x.target.files?.[0];
            if (f) void run(() => uploadDocument(e.id, f, category));
            x.target.value = '';
          }}
        />
      </label>
      <small>{tr('maximum_2_mib_txt_starts_with_disasterdao')}</small>
      <p>{tr('a_signed_receipt_must_be_anchored_within')}</p>
      <ul>
        {docs.map((d) => (
          <li key={d.id}>
            <span>
              {d.name} ·{' '}
              {d.category === 'external-review'
                ? tr('external_review')
                : tr('expenditure_evidence')}{' '}
              · {d.uploaded ? tr('saved') : tr('upload_incomplete')}
            </span>
            <code>{d.id}</code>
            {d.uploaded && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const t = await api<{ url: string }>(
                      `/documents/${d.id}/access`,
                      'POST',
                    );
                    const r = await fetch(t.url);
                    if (!r.ok) throw new Error(String(r.status));
                    const url = URL.createObjectURL(await r.blob());
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = d.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                {tr('download')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <details>
        <summary>{tr('submit_interim_report')}</summary>
        <form
          onSubmit={(x) => {
            x.preventDefault();
            void run(() =>
              api(`/evidence/${e.id}/interim`, 'POST', { text: interim }),
            );
          }}
        >
          <textarea
            aria-label={tr('interim_report')}
            required
            maxLength={5000}
            value={interim}
            onChange={(x) => setInterim(x.target.value)}
          />
          <button disabled={busy}>{tr('save')}</button>
        </form>
      </details>
      {e.status === 4 && (
        <button
          disabled={busy}
          onClick={() => run(() => api(`/evidence/${e.id}/appeal`, 'POST'))}
        >
          {tr('appeal')}
        </button>
      )}
      {[2, 6].includes(e.status) && (
        <details>
          <summary>{tr('submit_ngo_report_for_publication')}</summary>
          <form
            onSubmit={(x) => {
              x.preventDefault();
              const f = new FormData(x.currentTarget);
              void run(() =>
                api('/reports', 'POST', {
                  evidenceId: e.id,
                  ...Object.fromEntries(f),
                }),
              );
            }}
          >
            {['title', 'text', 'provenance', 'rights', 'protection'].map(
              (k) => (
                <label key={k}>
                  {
                    (
                      {
                        title: tr('title'),
                        text: tr('report'),
                        provenance: tr('provenance'),
                        rights: tr('usage_rights'),
                        protection: tr('protection_checks'),
                      } as Record<string, string>
                    )[k]
                  }
                  <textarea
                    required
                    name={k}
                    maxLength={k === 'title' ? 100 : 2000}
                  />
                </label>
              ),
            )}
            <button disabled={busy}>
              {tr('submit_for_external_approval')}
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
export function NGOPage() {
  const { portal, organizations, tr, run, busy, money, date } = useUI();
  const [wizard, setWizard] = useState(false),
    [importStatus, setImportStatus] = useState('');
  useEffect(() => setWizard(false), [portal?.role.id]);
  if (!portal) return null;
  const pending = portal.evidence.filter((e) => ![2, 6].includes(e.status));
  const completed = portal.evidence.filter((e) => [2, 6].includes(e.status));
  async function exportFile(purpose: string, target: string) {
    saveJSON(
      `${purpose}-${target}.json`,
      await api('/approvals/export', 'POST', { purpose, target }),
    );
  }
  return (
    <>
      <section className="hero">
        <p className="eyebrow">NGO WORKSPACE / {tr('simulated_session')}</p>
        <h1>{portal.role.name}</h1>
        <p>{tr('member_of_disasterdao_relief_alliance')}</p>
        <button
          className="primary"
          disabled={portal.blocked}
          onClick={() => {
            setWizard(true);
            setTimeout(
              () =>
                document.getElementById('application-form')?.scrollIntoView(),
              0,
            );
          }}
        >
          {tr('start_application')}
        </button>
        {portal.blocked && (
          <p role="alert">
            {tr('further_payouts_are_blocked_check_outstanding_evidence')}
          </p>
        )}
      </section>
      {organizations.map((o) => (
        <FundMetrics key={o.id} organization={o} />
      ))}
      <section className="panel">
        <h2>{tr('how_approval_works')}</h2>
        <ol className="steps">
          <li>{tr('submit_application_2')}</li>
          <li>{tr('import_external_approvals')}</li>
          <li>{tr('claim_reservation')}</li>
        </ol>
        <p>{tr('the_local_server_signs_ngo_transactions_with')}</p>
      </section>
      <section className="panel">
        <h2>{tr('outstanding_evidence')}</h2>
        {!pending.length && <p>{tr('no_outstanding_evidence')}</p>}
        {pending
          .sort(
            (a, b) =>
              (a.status === 3 ? a.responseDue : a.due) -
              (b.status === 3 ? b.responseDue : b.due),
          )
          .map((e) => (
            <EvidenceCard key={e.id} e={e} />
          ))}
      </section>
      {wizard && <ApplicationWizard onClose={() => setWizard(false)} />}
      <section className="panel">
        <h2>{tr('applications_and_reservations')}</h2>
        {portal.apps.map((a) => (
          <article className="workflow-row" key={a.id}>
            <h3>
              {a.incident} · {money(a.requested)}
            </h3>
            <p>
              {tr('status')}: {a.status} · {date(a.createdAt)}
            </p>
            <code>{a.id}</code>
            {a.tx && <code>{a.tx}</code>}
            {a.status === 'submitted' && (
              <button
                disabled={busy}
                onClick={() => run(() => exportFile('APPLICATION', a.id))}
              >
                {tr('export_approval_request')}
              </button>
            )}
            {a.chainId &&
              a.status === 'reviewed' &&
              portal.chainTime > a.createdAt + 259200 && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api(`/applications/${a.id}`, 'POST', {
                        action: 'expire',
                      }),
                    )
                  }
                >
                  {tr('close_expired_follow_up')}
                </button>
              )}
          </article>
        ))}
        {portal.reservations
          .filter((r) => !r.settled)
          .map((r) => (
            <article className="workflow-row" key={r.id}>
              <strong>
                {tr('reserved')}: {money(r.amount)}
              </strong>
              <p>
                {tr('claim_by')}: {date(r.expires)}
              </p>
              <button
                disabled={
                  busy || portal.blocked || r.expires < portal.chainTime
                }
                onClick={() =>
                  run(() =>
                    api(`/reservations/${r.id}`, 'POST', { action: 'claim' }),
                  )
                }
              >
                {tr('claim_payout')}
              </button>
              <button
                disabled={busy || r.expires >= portal.chainTime}
                onClick={() =>
                  run(() =>
                    api(`/reservations/${r.id}`, 'POST', { action: 'release' }),
                  )
                }
              >
                {tr('release_expired_reservation')}
              </button>
            </article>
          ))}
      </section>
      <section className="panel">
        <h2>{tr('external_signature_approvals')}</h2>
        <p>{tr('upload_the_review_document_against_its_evidence')}</p>
        <label>
          {tr('import_signature_file')}
          <input
            disabled={busy}
            type="file"
            accept=".json,application/json"
            onChange={(x) => {
              const file = x.target.files?.[0];
              if (file)
                void run(async () => {
                  if (file.size > 65536)
                    throw new Error(tr('signature_file_too_large'));
                  setImportStatus(tr('checking_signatures'));
                  try {
                    const b = JSON.parse(await file.text()) as ApprovalBundle;
                    const result = await api<{
                      tx?: string;
                      offchain?: boolean;
                    }>('/approvals/import', 'POST', b);
                    setImportStatus(
                      result.tx
                        ? `${tr('transaction_mined_waiting_for_two_confirmation_blocks')}: ${result.tx}`
                        : tr('off_chain_approval_saved'),
                    );
                  } catch (e) {
                    setImportStatus(
                      tr('import_failed_success_has_not_been_confirmed'),
                    );
                    throw e;
                  }
                });
              x.target.value = '';
            }}
          />
        </label>
        <p role="status">{importStatus}</p>
        {portal.reviews.map((r) => (
          <article className="workflow-row" key={r.id}>
            <strong>
              {r.kind} · {tr('evidence')} #{r.evidenceId}
            </strong>
            <code>{r.id}</code>
            <p>
              {r.tx
                ? tr('transaction_mined_check_chain_status')
                : tr('external_signatures_missing_or_not_yet_imported')}
            </p>
            {r.tx ? (
              <code>{r.tx}</code>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  run(() => exportFile(r.kind.toUpperCase(), r.id))
                }
              >
                {tr('export_approval_request')}
              </button>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>{tr('follow_ups_from_other_members')}</h2>
        {portal.governance.map((a) => (
          <article className="workflow-row" key={a.id}>
            <strong>{a.incident}</strong>
            <code>{a.ngo}</code>
            <p>{a.change}</p>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  api(`/applications/${a.id}`, 'POST', { action: 'vote' }),
                )
              }
            >
              {tr('approve_as_ngo')}
            </button>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>{tr('other_ngos_in_the_fund')}</h2>
        <ul className="member-list">
          {organizations
            .flatMap((o) => o.members)
            .filter(
              (m) => m.wallet.toLowerCase() !== portal.role.ngo?.toLowerCase(),
            )
            .map((m) => (
              <li key={m.id}>
                <strong>{m.name}</strong>
                <code>{m.wallet}</code>
              </li>
            ))}
        </ul>
        <p>{tr('the_fund_activity_below_shows_available_deposits')}</p>
      </section>
      {organizations.map((o) => (
        <ActivityList key={o.snapshot.hash} id={o.id} />
      ))}
      {completed.length > 0 && (
        <section className="panel">
          <h2>{tr('completed_evidence')}</h2>
          {completed.map((e) => (
            <EvidenceCard key={e.id} e={e} />
          ))}
        </section>
      )}
      <section className="panel">
        <h2>{tr('own_reports')}</h2>
        {portal.reports.map((r) => (
          <article key={r.id}>
            <h3>{r.title}</h3>
            <p>
              {r.published
                ? tr('published_ngo_statement')
                : tr('external_publication_approval_pending')}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
