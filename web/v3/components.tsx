import React, { useEffect, useRef, useState } from 'react';
import type {
  ActivityPage,
  Organization,
  Snapshot,
} from '../../src/v3/ui-types.ts';
import { api, useUI } from './context.tsx';
export function ExternalIcon() {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 18L18 6M6 6h12v12" />
    </svg>
  );
}
export function GearIcon() {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button onClick={onClose} aria-label="Close / Schließen">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SnapshotLabel({ snapshot }: { snapshot: Snapshot }) {
  const { tr, date } = useUI();
  return (
    <p className={`snapshot ${snapshot.status}`}>
      <span className="badge">
        {snapshot.status === 'confirmed'
          ? tr('blockchain_confirmed_local')
          : snapshot.status === 'stale'
            ? tr('stale_index')
            : tr('confirmed_snapshot_unavailable')}
      </span>{' '}
      {snapshot.block && (
        <>
          Block {snapshot.block} · {snapshot.time && date(snapshot.time)}
        </>
      )}
      <small>
        Chain {snapshot.chainId} · <code>{snapshot.fund}</code> ·{' '}
        {tr('confirmed_with_two_blocks_of_depth')}
      </small>
    </p>
  );
}
export function FundMetrics({
  organization: o,
}: {
  organization: Organization;
}) {
  const { tr, money } = useUI();
  return (
    <section aria-label={tr('fund_balance')}>
      <div className="metrics">
        {(['balance', 'reserved', 'free', 'paid'] as const).map((k, i) => (
          <article key={k}>
            <span>
              {
                [
                  tr('fund_balance_2'),
                  tr('reserved'),
                  tr('available'),
                  tr('paid'),
                ][i]
              }
            </span>
            <strong>{o.funds ? money(o.funds[k]) : '—'}</strong>
          </article>
        ))}
      </div>
      <SnapshotLabel snapshot={o.snapshot} />
    </section>
  );
}
export function OrganizationCard({
  organization: o,
}: {
  organization: Organization;
}) {
  const { tr, locale } = useUI();
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [hidden, setHidden] = useState(document.hidden),
    [reduced, setReduced] = useState(
      matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const m = () => setReduced(media.matches),
      v = () => setHidden(document.hidden);
    media.addEventListener('change', m);
    document.addEventListener('visibilitychange', v);
    return () => {
      media.removeEventListener('change', m);
      document.removeEventListener('visibilitychange', v);
    };
  }, []);
  useEffect(() => {
    if (
      paused ||
      hovered ||
      focused ||
      hidden ||
      reduced ||
      o.images.length < 2
    )
      return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % o.images.length),
      10000,
    );
    return () => clearInterval(timer);
  }, [paused, hovered, focused, hidden, reduced, o.images.length]);
  return (
    <article
      className="organization-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setFocused(false);
      }}
    >
      <a href={`#/organizations/${encodeURIComponent(o.id)}`}>
        <img
          src={o.images[index]?.src}
          alt={locale === 'de' ? o.images[index]?.alt : o.images[index]?.altEn}
        />
        <div className="card-body">
          <span className="eyebrow">
            {tr('shared_fund')} · {o.members.length} NGOs
          </span>
          <h3>
            {o.name} <ExternalIcon />
          </h3>
          <p>{tr('a_local_synthetic_alliance_three_ngos_share')}</p>
        </div>
      </a>
      <div className="card-controls">
        <small>
          {tr('synthetic_illustration')} · {index + 1}/{o.images.length}
        </small>
        <button
          onClick={() =>
            setIndex((i) => (i + o.images.length - 1) % o.images.length)
          }
          aria-label={tr('previous_image')}
        >
          ←
        </button>
        <button
          onClick={() => setIndex((i) => (i + 1) % o.images.length)}
          aria-label={tr('next_image')}
        >
          →
        </button>
        <button
          aria-pressed={paused || reduced}
          disabled={reduced}
          onClick={() => setPaused((p) => !p)}
        >
          {paused || reduced ? tr('resume') : tr('pause')}
        </button>
      </div>
    </article>
  );
}
export function OrganizationScroller({
  organizations,
  label,
}: {
  organizations: Organization[];
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { tr } = useUI();
  return (
    <section>
      <div className="section-heading">
        <h2>{label}</h2>
        <div className="actions">
          <button
            aria-label={tr('previous_organizations')}
            onClick={() =>
              ref.current?.scrollBy({
                left: document.dir === 'rtl' ? 360 : -360,
              })
            }
          >
            ←
          </button>
          <button
            aria-label={tr('next_organizations')}
            onClick={() =>
              ref.current?.scrollBy({
                left: document.dir === 'rtl' ? -360 : 360,
              })
            }
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="organization-scroller"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {organizations.map((o) => (
          <OrganizationCard key={o.id} organization={o} />
        ))}
      </div>
    </section>
  );
}
export function ActivityList({
  id,
  support = false,
}: {
  id: string;
  support?: boolean;
}) {
  const { tr, money, date, organizations } = useUI();
  const [data, setData] = useState<ActivityPage>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  async function load(offset = 0) {
    setLoading(true);
    try {
      let page = await api<ActivityPage>(
        `/organizations/${encodeURIComponent(id)}/${support ? 'test-support' : 'activity'}?offset=${offset}`,
      );
      if (offset && data?.snapshot.hash !== page.snapshot.hash)
        page = await api<ActivityPage>(
          `/organizations/${encodeURIComponent(id)}/${support ? 'test-support' : 'activity'}?offset=0`,
        );
      setData((old) => ({
        ...page,
        items:
          offset && old?.snapshot.hash === page.snapshot.hash
            ? [...old.items, ...page.items]
            : page.items,
      }));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setData(undefined);
    void load();
  }, [id, support]);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          {support ? tr('test_account_deposits') : tr('shared_fund_activity')}
        </h2>
        <button disabled={loading} onClick={() => load()}>
          {tr('refresh')}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {data && <SnapshotLabel snapshot={data.snapshot} />}
      <ul className="activity-list">
        {data?.items.map((x) => (
          <li key={x.tx + ':' + x.logIndex}>
            <div>
              <strong>{x.kind}</strong>
              <small>
                {date(x.time)} · Block {x.block} / Log {x.logIndex}
              </small>
              {x.actor && (
                <>
                  <span>
                    {
                      organizations
                        .flatMap((o) => o.members)
                        .find(
                          (m) =>
                            m.wallet.toLowerCase() === x.actor!.toLowerCase(),
                        )?.name
                    }
                  </span>
                  <code>{x.actor}</code>
                </>
              )}
            </div>
            <div>
              {x.amount !== undefined && <strong>{money(x.amount)}</strong>}
              <code>{x.tx}</code>
            </div>
          </li>
        ))}
      </ul>
      {!data?.items.length && (
        <p>
          {loading
            ? tr('loading')
            : tr('no_confirmed_activity_in_this_snapshot')}
        </p>
      )}
      {data?.next !== null && data?.next !== undefined && (
        <button disabled={loading} onClick={() => load(data.next!)}>
          {tr('load_more')}
        </button>
      )}
    </section>
  );
}
