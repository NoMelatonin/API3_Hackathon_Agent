import React, { useEffect, useState } from 'react';
export function ThemeControl() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('v3-theme') ?? 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    apply();
    try {
      localStorage.setItem('v3-theme', theme);
    } catch {}
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return (
    <div className="legacy-theme">
      <a href="/?v3=1">V3 ↗</a>
      <label>
        Darstellung
        <select
          aria-label="Darstellung"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="system">System</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
    </div>
  );
}
