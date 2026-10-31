import React from 'react';
import { createRoot } from 'react-dom/client';
import { SharedFundApp } from './v3/app.tsx';
import './v3/style.css';
// Old version URLs resolve to the one current product, preserving useful deep links.
const params = new URLSearchParams(location.search);
if (['v3', 'v2', 'legacy', 'local'].some((k) => params.has(k))) {
  for (const k of ['v3', 'v2', 'legacy', 'local']) params.delete(k);
  history.replaceState(
    null,
    '',
    location.pathname +
      (params.size ? '?' + params.toString() : '') +
      location.hash,
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SharedFundApp />
  </React.StrictMode>,
);
