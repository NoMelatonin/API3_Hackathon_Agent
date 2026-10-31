import React from 'react';

export function ViewNavigation({
  active,
  label,
}: {
  active: 'demo' | 'ngo' | 'user';
  label: string;
}) {
  return (
    <nav className="view-navigation" aria-label={label}>
      {(
        [
          ['demo', 'Demo', '/?v2=1'],
          ['ngo', 'NGO', '/?v3=1&ngo=1'],
          ['user', 'User', '/?v3=1#/home'],
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
