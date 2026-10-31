import React from 'react';

export function ViewNavigation({
  active,
  label,
}: {
  active: 'demo' | 'ngo' | 'user' | 'jury';
  label: string;
}) {
  return (
    <nav className="view-navigation" aria-label={label}>
      {(
        [
          ['jury', 'Jury', '/#/jury'],
          ['ngo', 'NGO', '/?ngo=1#/ngo'],
          ['user', 'User', '/#/home'],
        ] as const
      ).map(([view, name, href]) => (
        <a
          key={view}
          href={href}
          aria-current={active === view ? 'page' : undefined}
        >
          {name}
        </a>
      ))}
    </nav>
  );
}
