import React, { useState } from 'react';
import { useUI } from './context.tsx';

export function SupportAllocation() {
  const { organizations, organizationsState, tr, money, locale, refresh } =
    useUI();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const unavailable = organizations.some(
    (o) => o.snapshot.status !== 'confirmed',
  );
  const ready = organizationsState === 'ready' && !unavailable;
  // Keep token arithmetic in integer units. Only bounded chart coordinates and
  // rounded percentages become Numbers; never sum floating-point token values.
  const total = ready
    ? organizations.reduce((sum, o) => sum + BigInt(o.support.total), 0n)
    : 0n;
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  let offset = 0;
  const rows = ready
    ? organizations.map((o, index) => {
        const value = BigInt(o.support.total);
        const share =
          total > 0n ? Number((value * 100000000n) / total) / 1000000 : 0;
        const roundedPercent =
          total > 0n ? Number((value * 1000n + total / 2n) / total) / 1000 : 0;
        const row = {
          organization: o,
          share,
          offset,
          percentage: percent.format(roundedPercent),
          color: `var(--allocation-${index % 6})`,
        };
        offset += share;
        return row;
      })
    : [];
  async function update() {
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      await refresh();
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <section
      className="panel support-allocation"
      aria-labelledby="support-allocation-title"
    >
      <div className="section-heading">
        <h2 id="support-allocation-title">{tr('allocation_title')}</h2>
        <button disabled={refreshing} onClick={() => void update()}>
          {tr('refresh')}
        </button>
      </div>
      <p>{tr('allocation_test_account')}</p>
      <p className="allocation-explanation">{tr('allocation_explanation')}</p>
      {refreshFailed && <p role="alert">{tr('allocation_load_failed')}</p>}
      {organizationsState === 'error' ? (
        <p role="status">{tr('allocation_load_failed')}</p>
      ) : organizationsState === 'loading' ? (
        <p role="status">{tr('loading')}</p>
      ) : unavailable ? (
        <p role="status">{tr('allocation_index_required')}</p>
      ) : !organizations.length ? (
        <p className="empty">{tr('allocation_no_organizations')}</p>
      ) : (
        <>
          <div className="allocation-layout">
            <svg
              className="allocation-donut"
              viewBox="0 0 120 120"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                className="allocation-track"
                cx="60"
                cy="60"
                r="46"
                fill="none"
                strokeWidth="16"
              />
              {rows
                .filter((row) => row.share > 0)
                .map((row) => (
                  <circle
                    key={row.organization.id}
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    strokeWidth="16"
                    pathLength="100"
                    stroke={row.color}
                    strokeDasharray={`${row.share} ${100 - row.share}`}
                    strokeDashoffset={-row.offset}
                    transform="rotate(-90 60 60)"
                  />
                ))}
            </svg>
            <div className="allocation-details">
              <p className="allocation-total">
                <span>{tr('allocation_total')}</span>
                <strong data-testid="allocation-total">
                  {money(String(total))}
                </strong>
              </p>
              <ul className="allocation-list">
                {rows.map(({ organization: o, color, percentage }) => (
                  <li key={o.id}>
                    <span
                      className="allocation-swatch"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <a href={`#/organizations/${encodeURIComponent(o.id)}`}>
                      {o.name}
                    </a>
                    <span className="allocation-value">
                      <strong>{money(o.support.total)}</strong>
                      <span>{percentage}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {total === 0n && (
            <p className="empty">{tr('allocation_no_deposits')}</p>
          )}
          <small>{tr('allocation_rounding')}</small>
        </>
      )}
    </section>
  );
}
