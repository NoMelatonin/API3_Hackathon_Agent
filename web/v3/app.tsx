import React, { useEffect, useState } from 'react';
import {
  catalog,
  languages,
  countries,
  formatToken,
  formatDate,
  historicalCurrency,
  translationStatus,
  type Key,
} from './i18n.ts';
import type {
  App,
  Review,
  Round,
  Doc,
  Report,
  Role,
} from '../../server/state.ts';
import type { Area } from '../../src/v3/domain.ts';
type Evidence = {
  id: number;
  ngo: string;
  amount: string;
  paidAt: number;
  interimDue: number;
  due: number;
  responseDue: number;
  status: number;
  reviewTarget?: number | null;
  extended: boolean;
};
type Reservation = {
  id: number;
  application: number;
  ngo: string;
  amount: string;
  expires: number;
  settled: boolean;
};
type Incident = { id: string; name: string; areaId: string };
type Model = {
  incident: string;
  demoMaximum: string | null;
  euros: number | null;
  status: string;
  selected: unknown[];
  [key: string]: unknown;
};
type PortalData = {
  role: Role;
  chainTime: number;
  apps: App[];
  incidents: Incident[];
  models: Model[];
  areas: Area[];
  evidence: Evidence[];
  reservations: Reservation[];
  documents: Doc[];
  rounds: Round[];
  reviews: Review[];
  reports: Report[];
  governance: {
    id: string;
    chainId: number;
    ngo: string;
    incident: string;
    change: string;
  }[];
  blocked: boolean;
  interim: { evidenceId: number; text: string; at: number }[];
  conflicts: { roleId: string; target: string }[];
  coverageDecisions: {
    id: string;
    areaId: string;
    reason: string;
    votes: string[];
  }[];
};
type PublicData = {
  alliance: { id: string; name: string };
  balance: string;
  reserved: string;
  free: string;
  paid: string;
  chainTime: number;
  areaStates: {
    id: string;
    state: 'signals' | 'clear' | 'unknown' | 'conflicting';
  }[];
  organizations: { id: string; name: string; wallet: string }[];
  incidents: Incident[];
  areas: Area[];
  reports: Report[];
  history: { tx: string; body: unknown }[];
  worker: { status: string; at: number };
  indexer: { status: string; block: string };
  coverage: unknown[];
  sources: unknown[];
};
const initial = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(`v3-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
};
async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch('/api/v3' + path, {
    method,
    headers: {
      'x-v3-request': 'local-prototype',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
const parseAmount = (value: string) => {
  if (!/^\d+(\.\d{0,6})?$/.test(value)) throw new Error('amount');
  const [whole, part = ''] = value.split('.');
  return (BigInt(whole) * 1000000n + BigInt(part.padEnd(6, '0'))).toString();
};
export function SharedFundApp() {
  const [locale, setLocale] = useState(initial('locale', 'de')),
    [country, setCountry] = useState(initial('country', 'DE')),
    [zone, setZone] = useState(initial('zone', 'Europe/Berlin')),
    [currency, setCurrency] = useState(initial('currency', 'EUR')),
    [theme, setTheme] = useState(initial('theme', 'system'));
  const [view, setView] = useState(location.hash.slice(1) || 'public'),
    [pub, setPub] = useState<PublicData>(),
    [portal, setPortal] = useState<PortalData>(),
    [roles, setRoles] = useState<{ id: string; kind: string; name: string }[]>(
      [],
    ),
    [roleId, setRoleId] = useState('ngo-1');
  const [message, setMessage] = useState<Key>(),
    [errorCode, setErrorCode] = useState(''),
    [busy, setBusy] = useState(false);
  const [incident, setIncident] = useState('demo-quake'),
    [amount, setAmount] = useState('500'),
    [capacity, setCapacity] = useState('500'),
    [external, setExternal] = useState('0'),
    [reason, setReason] = useState(
      'Synthetic 30-day essential relief package; no independently documented actual expenditure. No conflict declared.',
    ),
    [change, setChange] = useState(''),
    [conflicts, setConflicts] = useState(0);
  const [reviewKind, setReviewKind] = useState<Review['kind']>('receipt'),
    [evidenceId, setEvidenceId] = useState(1),
    [decision, setDecision] = useState(2),
    [days, setDays] = useState(15),
    [followup, setFollowup] = useState('');
  const t = (key: Key) => catalog[locale]?.[key] ?? catalog.en![key];
  const money = (x: string) => formatToken(x, locale);
  const date = (x: number) => formatDate(x, locale, zone);
  const statusKey = (s: number): Key =>
    (
      ({
        0: 'pending',
        1: 'review',
        2: 'accept',
        3: 'request',
        4: 'reject',
        5: 'appeal',
        6: 'resolve',
      }) as Record<number, Key>
    )[s] ?? 'unknown';
  const reviewKey = (s: Review['kind']): Key =>
    (
      ({
        receipt: 'receipt',
        review: 'review',
        extend: 'extend',
        resolve: 'resolve',
        followup: 'followup',
      }) as const
    )[s];
  const model = portal?.models.find((m) => m.incident === incident);
  const maximum = model?.demoMaximum ?? '4500000000';
  useEffect(() => {
    for (const [k, v] of Object.entries({
      locale,
      country,
      zone,
      currency,
      theme,
    }))
      try {
        localStorage.setItem(`v3-${k}`, v);
      } catch {}
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [locale, country, zone, currency, theme]);
  useEffect(() => {
    const listener = () => setView(location.hash.slice(1) || 'public');
    addEventListener('hashchange', listener);
    return () => removeEventListener('hashchange', listener);
  }, []);
  async function refresh() {
    setPub(await api<PublicData>('/public'));
    try {
      setPortal(await api<PortalData>('/portal'));
    } catch (e) {
      if ((e as Error).message === '401') setPortal(undefined);
      else throw e;
    }
  }
  useEffect(() => {
    api<{ roles: typeof roles }>('/roles')
      .then((x) => setRoles(x.roles))
      .catch(() => {});
    refresh().catch(() => {
      setMessage('error');
      setErrorCode('Backend · npm run v3:start');
    });
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(undefined);
    setErrorCode('');
    try {
      await fn();
      await refresh();
      setMessage('success');
    } catch (e) {
      setMessage('error');
      setErrorCode((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, body?: unknown) => api(path, 'POST', body);
  const details = (data: unknown) => (
    <details>
      <summary>
        {t('details')} · {t('sourceText')}
      </summary>
      <pre dir="ltr" lang="en">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
  const recuse = (id: string) =>
    action(
      'recuse',
      () => post('/conflicts', { target: id, reason }),
      portal?.conflicts.some(
        (c) => c.target === id && c.roleId === portal.role.id,
      ),
    );
  const action = (label: Key, fn: () => Promise<unknown>, disabled = false) => (
    <button disabled={busy || disabled} onClick={() => run(fn)}>
      {t(label)}
    </button>
  );
  async function upload(id: number, file: File) {
    const ticket = (await post('/uploads', {
      evidenceId: id,
      name: file.name,
      mime: file.type || 'text/plain',
      size: file.size,
      synthetic: true,
    })) as { url: string };
    const r = await fetch(ticket.url, {
      method: 'PUT',
      headers: {
        'x-v3-request': 'local-prototype',
        'Content-Type': file.type || 'text/plain',
      },
      body: file,
    });
    if (!r.ok) throw new Error(String(r.status));
  }
  async function download(id: string) {
    const ticket = (await post(`/documents/${id}/access`)) as { url: string };
    const r = await fetch(ticket.url);
    if (!r.ok) throw new Error(String(r.status));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = 'synthetic-evidence.bin';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const prefs = (
    <details className="preferences">
      <summary>
        {t('language')} · {locale.toUpperCase()}{' '}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="preferences-grid">
        <label>
          {t('language')}
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            {languages.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('country')}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((id) => (
              <option key={id} value={id}>
                {new Intl.DisplayNames([locale], { type: 'region' }).of(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('timezone')}
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            {[
              ...new Set([zone, 'UTC', ...Intl.supportedValuesOf('timeZone')]),
            ].map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          {t('currency')}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {[
              'EUR',
              'USD',
              'GBP',
              'INR',
              'PHP',
              'IDR',
              'CNY',
              'MZN',
              'JPY',
              'XAF',
              'XXX',
            ].map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          {t('theme')}
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {(['system', 'light', 'dark'] as const).map((id) => (
              <option value={id} key={id}>
                {t(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
  return (
    <div className="v3-app">
      <a className="skip" href="#main">
        {t('public')}
      </a>
      <header className="v3-header">
        <a href="#public" className="brand">
          <span className="brand-icon" aria-hidden="true">
            D<span>↗</span>
          </span>
          <strong>
            DisasterDAO<small>RELIEF ALLIANCE / V3</small>
          </strong>
        </a>
        <nav aria-label="DisasterDAO">
          <a
            aria-current={view === 'public' ? 'page' : undefined}
            href="#public"
          >
            {t('public')}
          </a>
          <a aria-current={view === 'ngo' ? 'page' : undefined} href="#ngo">
            {t('ngo')}
          </a>
          <a
            aria-current={view === 'review' ? 'page' : undefined}
            href="#review"
          >
            {t('review')}
          </a>
          <a href="/?v2=1">{t('demo')} ↗</a>
        </nav>
        {prefs}
      </header>
      <div className="simulation-strip">
        <span aria-hidden="true">◈</span> {t('simulation')}
        {translationStatus(locale) === 'unreviewed-draft' && (
          <strong data-testid="draft"> · {t('draft')}</strong>
        )}
      </div>
      <main id="main" tabIndex={-1}>
        {message && (
          <div
            className={`feedback ${message === 'error' ? 'is-error' : ''}`}
            role={message === 'error' ? 'alert' : 'status'}
          >
            {t(message)} {errorCode && <code>{errorCode}</code>}
          </div>
        )}
        {view === 'public' || view.startsWith('alliance') ? (
          <>
            <section className="v3-hero">
              <div>
                <p className="eyebrow">01 / {t('public')}</p>
                <h1>
                  {t('estimated')}
                  <span className="hero-dot">.</span>
                </h1>
                <p className="hero-note">{t('simulation')}</p>
                <div className="hero-actions">
                  <a className="primary-link" href="#ngo">
                    {t('application')} <span aria-hidden="true">↗</span>
                  </a>
                  <a className="text-link" href="#fund">
                    {t('balance')} ↓
                  </a>
                </div>
              </div>
              <div className="fund-card" id="fund">
                <div className="fund-card-top">
                  <span>{t('balance')}</span>
                  <span>V3 / dUSD</span>
                </div>
                <strong className="fund-total" data-testid="balance">
                  {pub ? money(pub.balance) : '—'}
                </strong>
                <div className="fund-bar" role="img" aria-label={t('reserved')}>
                  <span
                    style={{
                      width:
                        pub && BigInt(pub.balance) > 0n
                          ? `${Number((BigInt(pub.reserved) * 100n) / BigInt(pub.balance))}%`
                          : '0%',
                    }}
                  />
                </div>
                <dl className="fund-breakdown">
                  {(['free', 'reserved', 'paid'] as const).map((k) => (
                    <div key={k}>
                      <dt>{t(k)}</dt>
                      <dd>{pub ? money(pub[k]) : '—'}</dd>
                    </div>
                  ))}
                </dl>
                <p className="policy-note">
                  20% · {t('reserved')} / 90% · {t('maximum')} / 4,500 dUSD
                </p>
                <p className="muted">{t('noRate')}</p>
                {action('refresh', refresh)}
              </div>
            </section>
            <section className="section-heading">
              <div>
                <p className="eyebrow">02 / {t('incidents')}</p>
                <h2>{t('areas')}</h2>
              </div>
              <span>
                {pub?.areas.length ?? 0} / {t('areas')}
              </span>
            </section>
            <div className="incident-grid">
              {pub?.incidents.map((i, index) => (
                <article key={i.id} className="incident-card">
                  <div
                    className={`area-visual area-${index}`}
                    aria-hidden="true"
                  >
                    <div className="map-grid" />
                    <span className="map-ring" />
                    <span className="map-label">{i.areaId.toUpperCase()}</span>
                    <span className="map-index">0{index + 1}</span>
                  </div>
                  <div className="incident-content">
                    <p className="eyebrow">
                      {t('incidents')} / 0{index + 1}
                    </p>
                    <h3>
                      {pub.areas.find((a) => a.id === i.areaId)?.country &&
                        new Intl.DisplayNames([locale], { type: 'region' }).of(
                          pub.areas.find((a) => a.id === i.areaId)!.country,
                        )}
                    </h3>
                    <span className="state-pill">
                      ◌{' '}
                      {t(
                        pub.areaStates.find((a) => a.id === i.areaId)?.state ??
                          'unknown',
                      )}
                    </span>
                    {details({
                      incident: i,
                      area: pub.areas.find((a) => a.id === i.areaId),
                      coverage: pub.coverage,
                    })}
                  </div>
                </article>
              ))}
            </div>
            <section className="public-bottom">
              <div>
                <p className="eyebrow">03 / {t('organizations')}</p>
                <h2>
                  <a href="#alliance-local-alliance">
                    {pub?.alliance.name ?? 'DisasterDAO Relief Alliance'} ↗
                  </a>
                </h2>
                {pub?.organizations.map((o, index) => (
                  <article className="organization-row" key={o.id}>
                    <span className="org-monogram">0{index + 1}</span>
                    <div>
                      <h3>{o.name}</h3>
                      <p>
                        <bdi>
                          {o.wallet.slice(0, 8)}…{o.wallet.slice(-4)}
                        </bdi>
                      </p>
                    </div>
                    <a href="#ngo">{t('application')} ↗</a>
                  </article>
                ))}
              </div>
              <aside className="policy-panel">
                <p className="eyebrow">04 / {t('status')}</p>
                <h2>{t('review')}</h2>
                <dl>
                  <div>
                    <dt>{t('round')}</dt>
                    <dd>6 h</dd>
                  </div>
                  <div>
                    <dt>{t('approve')}</dt>
                    <dd>2 / 3</dd>
                  </div>
                  <div>
                    <dt>{t('claim')}</dt>
                    <dd>24 h</dd>
                  </div>
                  <div>
                    <dt>{t('followup')}</dt>
                    <dd>72 h</dd>
                  </div>
                </dl>
                {details({
                  policy: 'v3.1',
                  scope:
                    'All registered areas checked, even without applications. Unknown/conflicting coverage holds 20% of free funds. A competing incident or unknown situation limits cumulative release to 90% of current maximum. Forecasts are synthetic or manually reviewed; no proven need.',
                  worker: pub?.worker,
                  indexer: pub?.indexer,
                  sources: pub?.sources,
                  countryScope:
                    'WorldRiskIndex 2026: EU27 + top10 + bottom20 = 51 distinct countries. Structural national nature risk, not a live crisis or health/conflict ranking.',
                  countrySource:
                    'https://weltrisikobericht.de/worldriskreport/',
                  ranks:
                    'Andorra and San Marino share 191; 193 UN members; official table pp 62–63; CC BY 4.0',
                })}
              </aside>
            </section>
            <section className="section-heading">
              <div>
                <p className="eyebrow">05 / {t('reports')}</p>
                <h2>{t('evidence')}</h2>
              </div>
            </section>
            <div className="report-grid">
              {pub?.reports.length ? (
                pub.reports.map((r) => (
                  <article key={r.id}>
                    <span className="state-pill">{t('accept')}</span>
                    <h3>{r.title}</h3>
                    <p lang="en">{r.text}</p>
                    {details(r)}
                  </article>
                ))
              ) : (
                <p className="empty-state">
                  {t('reports')}: 0 · {t('paid')} ≠ {t('accept')} ≠{' '}
                  {t('reports')}
                </p>
              )}
            </div>
            <section className="panel">
              <h2>{t('donate')}</h2>
              <label>
                {t('amount')} / dUSD
                <input
                  type="number"
                  min="0.000001"
                  max="1000"
                  step="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              {action('donate', () =>
                post('/donations', { amount: parseAmount(amount) }),
              )}
              <p className="muted">{t('simulation')}</p>
            </section>
            <details className="history">
              <summary>
                {t('history')} · {pub?.history.length ?? 0}
              </summary>
              {pub?.history.map((x, i) => (
                <div key={x.tx + i}>
                  <code>{x.tx}</code>
                  {details(x.body)}
                </div>
              ))}
            </details>
          </>
        ) : (
          <>
            <section className="portal-heading">
              <div>
                <p className="eyebrow">
                  {view === 'ngo' ? '02' : '03'} /{' '}
                  {t(view === 'ngo' ? 'ngo' : 'review')}
                </p>
                <h1>{t(view === 'ngo' ? 'application' : 'review')}</h1>
              </div>
              <div className="role-box">
                <label>
                  {t('login')}
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {action('login', () => post('/session', { role: roleId }))}
                {portal &&
                  action('logout', async () => {
                    await api('/session', 'DELETE');
                    setPortal(undefined);
                  })}
              </div>
            </section>
            {portal && (
              <div className="active-role">
                <strong>{portal.role.name}</strong> · {t('simulation')} ·{' '}
                <time>{date(portal.chainTime)}</time>
                {action('refresh', refresh)}
                {portal.blocked && (
                  <p className="is-error">
                    {t('status')}: {t('deadline')} · {t('resolve')}
                  </p>
                )}
              </div>
            )}
            {!portal ? (
              <p className="empty-state">{t('login')}</p>
            ) : (
              <>
                {portal.role.kind === 'ngo' && (
                  <div className="portal-grid">
                    <section className="panel">
                      <h2>
                        {t('application')} / {t('followup')}
                      </h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() =>
                            post('/applications', {
                              incident,
                              requested: parseAmount(amount),
                              capacity: parseAmount(capacity),
                              external: parseAmount(external),
                              explanation: reason,
                              change,
                              conflicts,
                            }),
                          );
                        }}
                      >
                        <label>
                          {t('incidents')}
                          <select
                            value={incident}
                            onChange={(e) => {
                              setIncident(e.target.value);
                              setCapacity('500');
                            }}
                          >
                            {portal.incidents.map((i, index) => (
                              <option key={i.id} value={i.id}>
                                {t('incidents')} 0{index + 1} / {i.areaId}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="estimate">
                          <span>{t('estimated')}</span>
                          <strong>{money(maximum)}</strong>
                          <small>
                            {t('maximum')} · {t('simulation')}
                          </small>
                        </div>
                        <label>
                          {t('amount')} / dUSD
                          <input
                            required
                            type="number"
                            step="0.000001"
                            min="0.000001"
                            max={Number(maximum) / 1e6}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </label>
                        <div className="field-grid">
                          <label>
                            {t('capacity')} / dUSD
                            <input
                              required
                              type="number"
                              step="0.000001"
                              min="0.000001"
                              max={Number(maximum) / 1e6}
                              value={capacity}
                              onChange={(e) => setCapacity(e.target.value)}
                            />
                          </label>
                          <label>
                            {t('external')} / dUSD
                            <input
                              required
                              type="number"
                              min="0"
                              step="0.000001"
                              value={external}
                              onChange={(e) => setExternal(e.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          {t('reason')}
                          <textarea
                            required
                            minLength={20}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <label>
                          {t('change')}
                          <textarea
                            value={change}
                            onChange={(e) => setChange(e.target.value)}
                          />
                        </label>
                        <label>
                          {t('protection')} / {t('organizations')}
                          <select
                            value={conflicts}
                            onChange={(e) =>
                              setConflicts(Number(e.target.value))
                            }
                          >
                            <option value={0}>0</option>
                            {[1, 2, 4, 7].map((x) => (
                              <option value={x} key={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="primary"
                          disabled={busy || portal.blocked}
                        >
                          {t('submit')} ↗
                        </button>
                      </form>
                      {details(model)}
                      {model?.euros !== null && model?.euros !== undefined && (
                        <p>
                          {historicalCurrency(model.euros, currency, locale)
                            ?.text ?? t('unknown')}{' '}
                          · {currency} · {t('sourceText')}
                        </p>
                      )}
                    </section>
                    <section className="panel">
                      <h2>{t('status')}</h2>
                      {portal.apps.map((a) => (
                        <article className="workflow-row" key={a.id}>
                          <strong>
                            {t('application')} {a.nonce} · {a.incident}
                          </strong>
                          <p>
                            {money(a.requested)} · {t('approve')}{' '}
                            {a.votes.length}/2 ·{' '}
                            <span>
                              {t(
                                (
                                  {
                                    submitted: 'submit',
                                    reviewed: 'review',
                                    reserved: 'reserved',
                                    paid: 'paid',
                                    expired: 'deadline',
                                    rejected: 'reject',
                                  } as const
                                )[a.status],
                              )}
                            </span>
                          </p>
                          {details(a)}
                          {a.chainId &&
                            a.status === 'reviewed' &&
                            portal.chainTime > a.createdAt + 259200 &&
                            action('release', () =>
                              post(`/applications/${a.id}`, {
                                action: 'expire',
                              }),
                            )}
                        </article>
                      ))}
                      {portal.reservations
                        .filter((r) => !r.settled)
                        .map((r) => (
                          <article className="workflow-row" key={r.id}>
                            <strong>
                              {t('reserved')}: {money(r.amount)}
                            </strong>
                            <p>
                              {t('deadline')}: {date(r.expires)}
                            </p>
                            {action(
                              'claim',
                              () =>
                                post(`/reservations/${r.id}`, {
                                  action: 'claim',
                                }),
                              portal.blocked || r.expires < portal.chainTime,
                            )}
                            {action(
                              'release',
                              () =>
                                post(`/reservations/${r.id}`, {
                                  action: 'release',
                                }),
                              r.expires >= portal.chainTime,
                            )}
                          </article>
                        ))}
                      <h3>
                        {t('vote')} · {t('followup')}
                      </h3>
                      {portal.governance.map((a) => (
                        <article key={a.id} className="workflow-row">
                          <p>
                            {a.incident} · <bdi>{a.ngo.slice(0, 8)}…</bdi>
                          </p>
                          <p>{a.change}</p>
                          {action('vote', () =>
                            post(`/applications/${a.id}`, { action: 'vote' }),
                          )}
                        </article>
                      ))}
                      <h3>{t('donate')}</h3>
                      <label>
                        {t('amount')} / dUSD
                        <input
                          type="number"
                          min="0.000001"
                          step="0.000001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </label>
                      {action('donate', () =>
                        post('/donations', { amount: parseAmount(amount) }),
                      )}
                    </section>
                  </div>
                )}
                {portal.role.kind === 'data' && (
                  <div className="portal-grid">
                    <section className="panel">
                      <h2>{t('application')}</h2>
                      {portal.apps.map((a) => (
                        <article className="workflow-row" key={a.id}>
                          <h3>
                            {a.incident} / {a.ngo.slice(0, 8)}…
                          </h3>
                          <p>
                            {money(a.requested)} / {t('maximum')}{' '}
                            {money(a.maximum)}
                          </p>
                          <p>
                            {t('approve')}: {a.votes.length}/2
                          </p>
                          {details(a)}
                          {action(
                            'approve',
                            () =>
                              post(`/applications/${a.id}`, {
                                action: 'approve',
                              }),
                            a.status !== 'submitted' ||
                              a.votes.includes(portal.role.id),
                          )}
                          {recuse(a.id)}
                        </article>
                      ))}
                    </section>
                    <section className="panel">
                      <h2>{t('round')}</h2>
                      <label>
                        {t('reason')}
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      {portal.areas.map((area) => (
                        <div className="workflow-row" key={area.id}>
                          <p>
                            {t('areas')}: {area.id}
                          </p>
                          {action('release', () =>
                            post('/coverage-decisions', {
                              areaId: area.id,
                              reason,
                            }),
                          )}
                        </div>
                      ))}
                      {portal.coverageDecisions.map((d) => (
                        <article className="workflow-row" key={d.id}>
                          <p>
                            {d.areaId}: {t('approve')} {d.votes.length}/2
                          </p>
                          {details(d)}
                          {action(
                            'approve',
                            () => post(`/coverage-decisions/${d.id}/approve`),
                            d.votes.length >= 2 ||
                              d.votes.includes(portal.role.id),
                          )}
                        </article>
                      ))}
                      {action('round', () => post('/rounds'))}
                      {portal.rounds.map((r) => (
                        <article className="workflow-row" key={r.id}>
                          <p>
                            {t('reserved')}: {money(r.provisional)} ·{' '}
                            {t('approve')} {r.votes.length}/2
                          </p>
                          <p>
                            {t('deadline')}: {date(r.expires)}
                          </p>
                          {details(r)}
                          {action(
                            'approve',
                            () => post(`/rounds/${r.id}/approve`),
                            !!r.tx ||
                              r.votes.includes(portal.role.id) ||
                              r.expires < portal.chainTime,
                          )}
                          {r.tx &&
                            action(
                              'release',
                              () => post(`/rounds/${r.id}/release`),
                              portal.chainTime <= r.createdAt + 86400,
                            )}
                          {recuse(r.id)}
                        </article>
                      ))}
                    </section>
                  </div>
                )}
                {['evidence', 'appeal'].includes(portal.role.kind) && (
                  <div className="portal-grid">
                    <section className="panel">
                      <h2>{t('review')}</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() =>
                            post('/reviews', {
                              kind: reviewKind,
                              evidenceId,
                              reason,
                              decision,
                              days,
                              ...(reviewKind === 'followup'
                                ? { applicationId: followup }
                                : {}),
                            }),
                          );
                        }}
                      >
                        <label>
                          {t('review')}
                          <select
                            value={reviewKind}
                            onChange={(e) =>
                              setReviewKind(e.target.value as Review['kind'])
                            }
                          >
                            {(portal.role.kind === 'appeal'
                              ? ['resolve']
                              : ['receipt', 'review', 'extend', 'followup']
                            ).map((k) => (
                              <option key={k} value={k}>
                                {t(reviewKey(k as Review['kind']))}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t('evidence')}
                          <select
                            value={evidenceId}
                            onChange={(e) =>
                              setEvidenceId(Number(e.target.value))
                            }
                          >
                            <option value={0}>—</option>
                            {portal.evidence.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.id} / {e.ngo.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {reviewKind === 'followup' && (
                          <label>
                            {t('followup')}
                            <select
                              value={followup}
                              onChange={(e) => setFollowup(e.target.value)}
                            >
                              <option value="">—</option>
                              {portal.apps
                                .filter((a) => a.chainId)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.nonce} / {a.incident}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        {reviewKind === 'review' && (
                          <label>
                            {t('status')}
                            <select
                              value={decision}
                              onChange={(e) =>
                                setDecision(Number(e.target.value))
                              }
                            >
                              {[2, 3, 4].map((s) => (
                                <option key={s} value={s}>
                                  {t(statusKey(s))}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {reviewKind === 'extend' && (
                          <label>
                            {t('deadline')} (1–30)
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={days}
                              onChange={(e) => setDays(Number(e.target.value))}
                            />
                          </label>
                        )}
                        <label>
                          {t('reason')}
                          <textarea
                            required
                            minLength={20}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          {t('submit')}
                        </button>
                      </form>
                    </section>
                    <section className="panel">
                      <h2>{t('approve')} / 2</h2>
                      {portal.reviews.map((r) => (
                        <article key={r.id} className="workflow-row">
                          <h3>
                            {t(reviewKey(r.kind))} / {r.evidenceId}
                          </h3>
                          <p>
                            {t('approve')}: {r.votes.length}/2
                          </p>
                          {details(r)}
                          {action(
                            'approve',
                            () => post(`/reviews/${r.id}/approve`),
                            !!r.tx || r.votes.includes(portal.role.id),
                          )}
                          {recuse(r.id)}
                        </article>
                      ))}
                      <h3>{t('publish')}</h3>
                      {portal.reports.map((r) => (
                        <article className="workflow-row" key={r.id}>
                          <strong>{r.title}</strong>
                          {details(r)}
                          {action(
                            'approve',
                            () => post(`/reports/${r.id}/approve`),
                            r.published ||
                              r.approvedBy.includes(portal.role.id),
                          )}
                        </article>
                      ))}
                    </section>
                  </div>
                )}
                <section className="panel evidence-panel">
                  <h2>{t('evidence')}</h2>
                  {portal.evidence.length === 0 && (
                    <p className="empty-state">0 · {t('evidence')}</p>
                  )}
                  {portal.evidence.map((e) => (
                    <article className="workflow-row" key={e.id}>
                      <div className="row-between">
                        <h3>
                          #{e.id} / {money(e.amount)}
                        </h3>
                        <span className="state-pill">
                          {t(statusKey(e.status))}
                        </span>
                      </div>
                      <p>
                        {t('deadline')}: {date(e.due)} · 7d:{' '}
                        {date(e.interimDue)}
                        {e.reviewTarget && (
                          <>
                            {' '}
                            · {t('review')}: {date(e.reviewTarget)}
                          </>
                        )}
                        {e.responseDue > 0 && (
                          <> · 14d: {date(e.responseDue)}</>
                        )}
                      </p>
                      {portal.role.kind === 'ngo' && (
                        <>
                          <label className="upload-field">
                            {t('upload')} · {t('simulation')}
                            <input
                              type="file"
                              accept=".txt,.pdf,.png,.jpg,.jpeg"
                              disabled={busy}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) run(() => upload(e.id, file));
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const text = String(
                                new FormData(event.currentTarget).get('text'),
                              );
                              run(() =>
                                post(`/evidence/${e.id}/interim`, { text }),
                              );
                            }}
                          >
                            <label>
                              {t('reports')} / 7d
                              <textarea required name="text" maxLength={5000} />
                            </label>
                            <button disabled={busy}>{t('submit')}</button>
                          </form>
                          {portal.interim
                            .filter((i) => i.evidenceId === e.id)
                            .map((i, index) => (
                              <p key={index}>
                                {date(i.at)}: {i.text}
                              </p>
                            ))}
                          {action(
                            'appeal',
                            () => post(`/evidence/${e.id}/appeal`),
                            e.status !== 4,
                          )}
                        </>
                      )}
                      {details(e)}
                      {portal.documents
                        .filter((d) => d.evidenceId === e.id)
                        .map((d) => (
                          <div className="document-row" key={d.id}>
                            <span>
                              {d.name} · {d.size} B
                            </span>
                            {action(
                              'download',
                              () => download(d.id),
                              !d.uploaded,
                            )}
                          </div>
                        ))}
                    </article>
                  ))}
                </section>
                {portal.role.kind === 'ngo' && (
                  <section className="panel">
                    <h2>{t('reports')}</h2>
                    <form
                      className="report-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        run(() =>
                          post(
                            '/reports',
                            Object.fromEntries(
                              [...data.entries()].map(([k, v]) => [
                                k,
                                k === 'evidenceId' ? Number(v) : v,
                              ]),
                            ),
                          ),
                        );
                      }}
                    >
                      <label>
                        {t('evidence')}
                        <select required name="evidenceId">
                          {portal.evidence
                            .filter((e) => [2, 6].includes(e.status))
                            .map((e) => (
                              <option value={e.id} key={e.id}>
                                #{e.id}
                              </option>
                            ))}
                        </select>
                      </label>
                      {(
                        [
                          'reports',
                          'details',
                          'provenance',
                          'rights',
                          'protection',
                        ] as Key[]
                      ).map((k, i) => (
                        <label key={k}>
                          {t(k)}
                          <input
                            required
                            name={
                              [
                                'title',
                                'text',
                                'provenance',
                                'rights',
                                'protection',
                              ][i]
                            }
                            maxLength={i === 0 ? 100 : 2000}
                          />
                        </label>
                      ))}
                      <button disabled={busy}>{t('submit')}</button>
                    </form>
                    {portal.reports.map((r) => (
                      <article key={r.id}>
                        <h3>{r.title}</h3>
                        <p>
                          {t('publish')}: {r.approvedBy.length}/2
                        </p>
                      </article>
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
      <footer className="v3-footer">
        <strong>
          DisasterDAO <span>V3</span>
        </strong>
        <span>{t('simulation')}</span>
        <a href="/?legacy=1">V1 · {t('demo')} ↗</a>
      </footer>
    </div>
  );
}
