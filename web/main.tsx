import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeControl } from './theme-control.tsx';
const params = new URLSearchParams(location.search);
const v3 =
  params.has('v3') ||
  (!params.has('local') && !params.has('legacy') && !params.has('v2'));
const legacy = new URLSearchParams(location.search).get('legacy') === '1';
// Keep each stylesheet import in its own branch. A shared conditional import
// is coalesced by the production bundler and can preload the V2 CSS for V3.
if (v3) await import('./v3/style.css');
else if (legacy) await import('./legacy.css');
else await import('./style.css');
if (legacy && !v3) await import('./theme-legacy.css');
else if (!v3) await import('./demo-theme.css');
if (!v3 && !legacy) document.body.classList.add('demo-app');
const App = v3
  ? (await import('./v3/app.tsx')).SharedFundApp
  : legacy
    ? (await import('./legacy.tsx')).LegacyApp
    : (await import('./portal.tsx')).Portal;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {!v3 && <ThemeControl />}
    <App />
  </React.StrictMode>,
);
