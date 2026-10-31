import React from 'react';
import { useUI } from './context.tsx';
import { OrganizationScroller } from './components.tsx';
export function HomePage() {
  const { organizations, tr, loaded } = useUI();
  const unknown =
    !loaded || organizations.some((o) => o.support.supported === null);
  const unsupported = organizations.filter(
    (o) => o.support.supported === false,
  );
  return (
    <>
      <section className="hero">
        <p className="eyebrow">DISASTERDAO / DISCOVER</p>
        <h1>{tr('make_relief_possible_together')}</h1>
        <p>{tr('discover_organizations_whose_ngos_share_a_relief')}</p>
      </section>
      <OrganizationScroller
        organizations={organizations}
        label={tr('discover_organizations')}
      />
      <OrganizationScroller
        organizations={unsupported}
        label={tr('not_yet_supported_by_the_test_account')}
      />
      {unknown ? (
        <p className="notice">
          {tr('support_status_requires_a_current_complete_index')}
        </p>
      ) : (
        !unsupported.length && (
          <p className="empty">
            {tr('there_are_no_further_organizations_to_show')}
          </p>
        )
      )}
    </>
  );
}
