import type { UIKey } from './copy.ts';
import React, { createContext, useContext } from 'react';
import type { App, Doc, Review, Role, Report } from '../../server/state.ts';
import type { Organization } from '../../src/v3/ui-types.ts';
import { formatDate, formatToken } from './i18n.ts';
export interface Evidence {
  confirmed: boolean;
  id: number;
  ngo: string;
  amount: string;
  paidAt: number;
  interimDue: number;
  due: number;
  responseDue: number;
  status: number;
  extended: boolean;
  reviewTarget?: number | null;
}
export interface Portal {
  role: Role;
  network: string;
  oracleMode: string;
  chainTime: number;
  blocked: boolean;
  apps: App[];
  documents: Doc[];
  reviews: Review[];
  reports: Report[];
  incidents: { id: string; name: string; areaId: string }[];
  evidence: Evidence[];
  interim: { evidenceId: number; text: string; at: number }[];
  reservations: {
    id: number;
    amount: string;
    expires: number;
    settled: boolean;
  }[];
  governance: {
    id: string;
    ngo: string;
    incident: string;
    change: string;
  }[];
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  organization?: string,
): Promise<T> {
  const r = await fetch('/api/v3' + path, {
    method,
    headers: {
      'x-v3-request': 'local-prototype',
      ...(organization ? { 'x-v3-organization': organization } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error ?? String(r.status)), {
      status: r.status,
    });
  return data;
}
export function amount(value: string) {
  if (!/^\d+(\.\d{0,6})?$/.test(value))
    throw new Error('dUSD: maximal 6 decimals');
  const [w, p = ''] = value.split('.');
  return String(BigInt(w) * 1000000n + BigInt(p.padEnd(6, '0')));
}
export function saveJSON(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export interface UI {
  loaded: boolean;
  organizationsState: 'loading' | 'ready' | 'error';
  locale: string;
  zone: string;
  organizations: Organization[];
  portal?: Portal;
  busy: boolean;
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  tr: (key: UIKey) => string;
  money: (s: string) => string;
  date: (n: number) => string;
}
export const UIContext = createContext<UI>(null!);
export const useUI = () => useContext(UIContext);
export const formatters = (locale: string, zone: string) => ({
  money: (s: string) => formatToken(s, locale),
  date: (n: number) => formatDate(n, locale, zone),
});
