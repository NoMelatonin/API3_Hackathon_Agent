import React from 'react';
import {createRoot} from 'react-dom/client';
import {Portal} from './portal.tsx';
import {LegacyApp} from './legacy.tsx';
const legacy = new URLSearchParams(location.search).get('legacy') === '1';
await (legacy ? import('./legacy.css') : import('./style.css'));
createRoot(document.getElementById('root')!).render(<React.StrictMode>{legacy ? <LegacyApp/> : <Portal/>}</React.StrictMode>);
