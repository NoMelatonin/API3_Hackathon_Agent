import { uiText, type UIKey } from './copy.ts';
import React, { useEffect, useRef, useState } from 'react';
import { ViewNavigation } from '../view-navigation.tsx';
import { catalog, languages, countries, translationStatus } from './i18n.ts';
import { api, amount, formatters, UIContext, type Portal } from './context.tsx';
import type { Organization } from '../../src/v3/ui-types.ts';
import { Dialog, ExternalIcon, GearIcon } from './components.tsx';
import { HomePage } from './home.tsx';
import { OrganizationPage } from './organization.tsx';
import { NGOEntry } from './ngo-entry.tsx';
import { JuryPage } from './jury.tsx';
import { NGOPage } from './ngo.tsx';
const stored = (key: string, fallback: string) => {
  try {
    return localStorage.getItem('v3-' + key) ?? fallback;
  } catch {
    return fallback;
  }
};
export function resolveRoute(hash: string) {
  const raw = hash.replace(/^#/, '');
  if (!raw || raw === 'public' || raw === '/home' || raw === 'review')
    return { kind: 'home', review: raw === 'review' };
  if (raw === '/jury') return { kind: 'jury' };
  if (raw === 'ngo' || raw === '/ngo') return { kind: 'ngo' };
  if (raw === 'alliance-local-alliance')
    return { kind: 'organization', id: 'local-alliance' };
  if (raw.startsWith('/organizations/')) {
    try {
      return {
        kind: 'organization',
        id: decodeURIComponent(raw.slice(15)),
      };
    } catch {
      return { kind: 'missing' };
    }
  }
  return { kind: 'missing' };
}
export function SharedFundApp() {
  const ngoEntry = new URLSearchParams(location.search).get('ngo') === '1';
  const publicHome = '/#/home';
  const ngoHome = '/?ngo=1#/ngo';
  const [sessionState, setSessionState] = useState<
    'checking' | 'authenticated' | 'anonymous' | 'error'
  >('checking');
  const [locale, setLocale] = useState(stored('locale', 'de')),
    [country, setCountry] = useState(stored('country', 'DE')),
    [zone, setZone] = useState(stored('zone', 'Europe/Berlin')),
    [currency, setCurrency] = useState(stored('currency', 'EUR')),
    [theme, setTheme] = useState(stored('theme', 'system'));
  const [loaded, setLoaded] = useState(false);
  const [organizationsState, setOrganizationsState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const organizationsRequest = useRef(0);
  const [route, setRoute] = useState(resolveRoute(location.hash)),
    [organizations, setOrganizations] = useState<Organization[]>([]),
    [portal, setPortal] = useState<Portal>(),
    [roles, setRoles] = useState<{ id: string; name: string }[]>([]),
    [role, setRole] = useState('ngo-1');
  const [settings, setSettings] = useState(false),
    [donation, setDonation] = useState(false),
    [wallet, setWallet] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [donationAmount, setDonationAmount] = useState('25'),
    [donationOrganization, setDonationOrganization] =
      useState('local-alliance'),
    [pending, setPending] = useState<string[]>([]);
  const tr = (key: UIKey) => uiText(locale, key);
  const old = (key: keyof typeof catalog.en) =>
    catalog[locale]?.[key] ?? catalog.en![key];
  async function refresh() {
    const request = ++organizationsRequest.current;
    const organizationData = api<{ organizations: Organization[] }>(
      '/organizations',
    )
      .then((data) => {
        if (request === organizationsRequest.current) {
          setOrganizations(data.organizations);
          setLoaded(true);
          setOrganizationsState('ready');
        }
        return data;
      })
      .catch((e) => {
        if (request === organizationsRequest.current)
          setOrganizationsState('error');
        throw e;
      });
    const session = api<Portal>('/portal')
      .then((p) => {
        setPortal(p);
        setSessionState('authenticated');
        return p;
      })
      .catch((e) => {
        setPortal(undefined);
        if (e.status === 401) {
          setSessionState('anonymous');
          return undefined;
        }
        setSessionState('error');
        throw e;
      });
    const [data, p, roleData] = await Promise.all([
      organizationData,
      session,
      api<{ roles: typeof roles }>('/roles'),
    ]);
    setRoles(roleData.roles);
    setPortal(p);
    for (const organization of data.organizations.filter(
      (o) => o.snapshot.status === 'confirmed',
    )) {
      const confirmed = await api<{ items: { tx: string }[] }>(
        '/organizations/' + organization.id + '/test-support',
      );
      setPending((previous) =>
        previous.filter((tx) => !confirmed.items.some((x) => x.tx === tx)),
      );
    }
  }
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await refresh();
      setMessage(tr('saved_chain_and_review_statuses_are_shown'));
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        setPortal(undefined);
        setSessionState('anonymous');
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const check = () => {
      void refresh().catch((e) => setError((e as Error).message));
    };
    addEventListener('focus', check);
    return () => removeEventListener('focus', check);
  }, []);
  useEffect(() => {
    if (!pending.length && !portal) return;
    const timer = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [pending.length, portal?.role.id]);
  useEffect(() => {
    const listener = () => {
      const next = resolveRoute(location.hash);
      setRoute(next);
      document.getElementById('main')?.focus();
    };
    addEventListener('hashchange', listener);
    return () => removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    for (const [key, value] of Object.entries({
      locale,
      country,
      zone,
      currency,
      theme,
    })) {
      try {
        localStorage.setItem('v3-' + key, value);
      } catch {}
    }
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [locale, country, zone, currency, theme]);
  useEffect(() => {
    if (!ngoEntry && route.kind === 'ngo') location.replace(ngoHome);
    if (
      ngoEntry &&
      (route.kind === 'home' || route.kind === 'organization') &&
      location.hash
    )
      location.replace('/' + location.hash);
    if (ngoEntry && sessionState === 'authenticated' && !location.hash)
      location.replace(ngoHome);
  }, [ngoEntry, route.kind, sessionState]);
  async function logout(destination: string) {
    await api('/session', 'DELETE');
    setPortal(undefined);
    setSessionState('anonymous');
    location.assign(destination);
  }
  const ethereum = (
    window as unknown as {
      ethereum?: {
        request: (p: { method: string }) => Promise<string[]>;
        on?: (event: string, fn: (a: string[]) => void) => void;
        removeListener?: (event: string, fn: (a: string[]) => void) => void;
      };
    }
  ).ethereum;
  useEffect(() => {
    const update = (a: string[]) => setWallet(a[0] ?? '');
    ethereum?.on?.('accountsChanged', update);
    return () => ethereum?.removeListener?.('accountsChanged', update);
  }, [ethereum]);
  return (
    <UIContext.Provider
      value={{
        loaded,
        organizationsState,
        locale,
        zone,
        organizations,
        portal,
        busy,
        refresh,
        run,
        tr,
        ...formatters(locale, zone),
      }}
    >
      <div className="v3-app">
        <a
          className="skip"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('main')?.focus();
          }}
        >
          {tr('skip_to_content')}
        </a>
        <header className="v3-header">
          <a className="brand" href={ngoEntry ? ngoHome : publicHome}>
            DisasterDAO
            <span>
              <ExternalIcon />
            </span>
          </a>
          <ViewNavigation
            active={route.kind === 'jury' ? 'jury' : ngoEntry ? 'ngo' : 'user'}
            label={tr('main_navigation')}
          />
          {ngoEntry && portal && (
            <div className="ngo-session-actions">
              <span>{portal.role.name}</span>
              <button
                disabled={busy}
                onClick={() => run(() => logout('/?ngo=1'))}
              >
                {tr('sign_out')}
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => logout(publicHome))}
              >
                {tr('sign_out_to_public')}
              </button>
            </div>
          )}
          <div className="header-actions">
            {!ngoEntry && (
              <button
                className="primary"
                disabled={!!portal}
                onClick={() => setDonation(true)}
                title={portal ? tr('end_the_ngo_session_first') : undefined}
              >
                {tr('test_donation')}
              </button>
            )}
            <button
              className="gear"
              aria-label={tr('settings_and_sign_in')}
              aria-haspopup="dialog"
              onClick={() => setSettings(true)}
            >
              <GearIcon />
            </button>
          </div>
        </header>
        <div className="simulation-strip">
          {organizations[0]?.snapshot.chainId === 84532
            ? locale === 'de'
              ? 'Base Sepolia · wertlose Testmittel · simulierte NGO-/Prüferrollen · echte Airnode-Antworten erforderlich'
              : 'Base Sepolia · valueless test funds · simulated NGO/reviewer roles · genuine Airnode responses required'
            : old('simulation')}
          {translationStatus(locale) === 'unreviewed-draft' && (
            <strong data-testid="draft">
              {' '}
              · {old('draft')} · {tr('new_interface_text_english_source')}
            </strong>
          )}
        </div>
        <main id="main" tabIndex={-1}>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button disabled={busy} onClick={() => run(refresh)}>
                {tr('retry')}
              </button>
            </div>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {pending.map((tx) => (
            <p className="notice" key={tx}>
              {tr('test_donation_mined_index_confirmation_pending')}{' '}
              <code>{tx}</code>
            </p>
          ))}
          {route.review && (
            <p className="notice">
              {tr('reviewers_now_work_outside_the_app_ngos')}
            </p>
          )}
          {route.kind === 'jury' ? (
            <JuryPage />
          ) : ngoEntry && route.kind !== 'missing' ? (
            sessionState === 'authenticated' && portal ? (
              <NGOPage key={portal.role.id} />
            ) : (
              <NGOEntry
                state={sessionState}
                roles={roles}
                role={role}
                setRole={setRole}
                busy={busy}
                onLogin={() =>
                  run(async () => {
                    await api('/session', 'POST', { role });
                    await refresh();
                    location.replace(ngoHome);
                  })
                }
                onRetry={() => run(refresh)}
              />
            )
          ) : route.kind === 'home' ? (
            <HomePage />
          ) : route.kind === 'organization' ? (
            <OrganizationPage id={route.id!} />
          ) : route.kind === 'ngo' ? (
            <p role="status">{tr('session_checking')}</p>
          ) : (
            <section className="hero">
              <h1>{tr('page_not_found')}</h1>
              <a href="#/home">{tr('back_to_home')}</a>
            </section>
          )}
        </main>
        <footer>
          <strong>DisasterDAO</strong>
          <span>{tr('local_prototype_no_fiat_conversion_for_dusd')}</span>
          <a href="/#/jury">
            Jury / API3 <ExternalIcon />
          </a>
        </footer>
        {settings && (
          <Dialog title={tr('settings')} onClose={() => setSettings(false)}>
            <div className="preferences-grid">
              {[
                [
                  old('language'),
                  locale,
                  setLocale,
                  languages.map(([value, label]) => ({ value, label })),
                ],
                [
                  old('country'),
                  country,
                  setCountry,
                  countries.map((value) => ({
                    value,
                    label:
                      new Intl.DisplayNames([locale], {
                        type: 'region',
                      }).of(value) ?? value,
                  })),
                ],
                [
                  old('timezone'),
                  zone,
                  setZone,
                  [
                    ...new Set([
                      zone,
                      'UTC',
                      ...Intl.supportedValuesOf('timeZone'),
                    ]),
                  ].map((value) => ({ value, label: value })),
                ],
                [
                  old('currency'),
                  currency,
                  setCurrency,
                  [
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
                  ].map((value) => ({ value, label: value })),
                ],
                [
                  old('theme'),
                  theme,
                  setTheme,
                  ['system', 'light', 'dark'].map((value) => ({
                    value,
                    label: old(value as 'system'),
                  })),
                ],
              ].map(([label, value, set, options]) => (
                <label key={String(label)}>
                  {String(label)}
                  <select
                    value={value as string}
                    onChange={(e) =>
                      (set as (v: string) => void)(e.target.value)
                    }
                  >
                    {(options as { value: string; label: string }[]).map(
                      (o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ))}
            </div>
            <p>{old('noRate')}</p>
            {!ngoEntry && portal && (
              <>
                <p>
                  {portal.role.name} · {tr('end_the_ngo_session_first')}
                </p>
                <button
                  disabled={busy}
                  onClick={() => run(() => logout(publicHome))}
                >
                  {tr('sign_out_to_public')}
                </button>
              </>
            )}
            <h3>{tr('optional_wallet_connection')}</h3>
            <p>{tr('address_display_only_this_wallet_is_neither')}</p>
            {wallet && <code>{wallet}</code>}
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!ethereum)
                    throw new Error(tr('no_browser_wallet_installed'));
                  setWallet(
                    (
                      await ethereum.request({
                        method: 'eth_requestAccounts',
                      })
                    )[0] ?? '',
                  );
                })
              }
            >
              {tr('connect_wallet')}
            </button>
            {wallet && (
              <button onClick={() => setWallet('')}>
                {tr('hide_address')}
              </button>
            )}
          </Dialog>
        )}
        {donation && (
          <Dialog
            title={tr('test_donation')}
            onClose={() => setDonation(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api<{ tx: string }>(
                    '/donations',
                    'POST',
                    {
                      amount: amount(donationAmount),
                    },
                    donationOrganization,
                  );
                  setPending((p) => [...p, r.tx]);
                  setDonation(false);
                });
              }}
            >
              <label>
                {locale === 'de' ? 'Bündnis' : 'Alliance'}
                <select
                  value={donationOrganization}
                  onChange={(e) => setDonationOrganization(e.target.value)}
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>{tr('shared_test_donor_account_up_to_1')}</p>
              <code>{organizations[0]?.support.donor}</code>
              <label>
                {old('amount')} / dUSD
                <input
                  autoComplete="off"
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  max="1000"
                  step="0.000001"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={busy || !!portal || !organizations.length}
              >
                {tr('confirm_test_donation')}
              </button>
            </form>
          </Dialog>
        )}
      </div>
    </UIContext.Provider>
  );
}
