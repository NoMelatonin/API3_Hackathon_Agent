import React from 'react';
import { useUI } from './context.tsx';
import { ActivityList, FundMetrics } from './components.tsx';
export function OrganizationPage({ id }: { id: string }) {
  const { organizations, tr, money, loaded } = useUI();
  const o = organizations.find((o) => o.id === id);
  if (!loaded) return <p role="status">{tr('loading')}</p>;
  if (!o)
    return (
      <section className="hero">
        <h1>{tr('organization_not_found')}</h1>
        <a href="#/home">{tr('back_to_home')}</a>
      </section>
    );
  return (
    <>
      <section className="hero">
        <a href="#/home">← {tr('discover')}</a>
        <p className="eyebrow">{tr('organization_shared_fund')}</p>
        <h1>{o.name}</h1>
        <p>{tr('three_synthetic_ngos_share_one_local_relief')}</p>
      </section>
      <FundMetrics organization={o} />
      <section className="panel">
        <h2>{tr('support_history_of_the_shared_test_account')}</h2>
        <p className="large-number">
          {o.snapshot.status === 'unavailable' ? '—' : money(o.support.total)}
        </p>
        <p>{tr('includes_initial_funding_this_is_not_a')}</p>
        <code>{o.support.donor}</code>
        <p>{tr('donations_go_into_the_shared_fund_ngo')}</p>
      </section>
      <section className="panel">
        <h2>{tr('member_ngos')}</h2>
        <ul className="member-list">
          {o.members.map((m) => (
            <li key={m.id}>
              <strong>{m.name}</strong>
              <code>{m.wallet}</code>
            </li>
          ))}
        </ul>
        <h3>{tr('synthetic_operating_areas')}</h3>
        <ul>
          {o.areas.map((a) => (
            <li key={a.id}>
              {a.name} · {a.country}
            </li>
          ))}
        </ul>
      </section>
      <ActivityList key={o.snapshot.hash + 'support'} id={o.id} support />
      <ActivityList key={o.snapshot.hash + 'activity'} id={o.id} />
      <section className="panel">
        <h2>{tr('published_ngo_reports')}</h2>
        <p>{tr('ngo_statements_about_synthetic_outcomes_no_independently')}</p>
        {o.reports.map((r) => (
          <article key={r.id}>
            <h3>{r.title}</h3>
            <p>{r.text}</p>
            <p>{r.provenance}</p>
          </article>
        ))}
      </section>
    </>
  );
}
