import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeControl } from './theme-control.tsx';
const params = new URLSearchParams(location.search);
const v3 =
  params.has('v3') ||
  (!params.has('local') && !params.has('legacy') && !params.has('v2'));
const legacy = new URLSearchParams(location.search).get('legacy') === '1';
await (v3
  ? import('./v3/style.css')
  : legacy
    ? import('./legacy.css')
    : import('./style.css'));
if (!v3) await import('./theme-legacy.css');
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
