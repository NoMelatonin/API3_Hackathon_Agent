import React from 'react';
import { useUI } from './context.tsx';
export function NGOEntry({
  state,
  roles,
  role,
  setRole,
  busy,
  onLogin,
  onRetry,
}: {
  state: 'checking' | 'authenticated' | 'anonymous' | 'error';
  roles: { id: string; name: string }[];
  role: string;
  setRole: (role: string) => void;
  busy: boolean;
  onLogin: () => void;
  onRetry: () => void;
}) {
  const { tr } = useUI();
  return (
    <section className="hero ngo-entry">
      <p className="eyebrow">NGO / V3</p>
      <h1>{tr('your_response_starts_here')}</h1>
      <p>{tr('simulated_local_role_no_identity_verification')}</p>
      {state === 'checking' ? (
        <p role="status">{tr('session_checking')}</p>
      ) : state === 'error' ? (
        <div role="alert">
          <p>{tr('session_failed')}</p>
          <button disabled={busy} onClick={onRetry}>
            {tr('retry')}
          </button>
        </div>
      ) : (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
        >
          <label>
            {tr('choose_ngo')}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy || !roles.length}>
            {tr('sign_in_as_ngo')}
          </button>
        </form>
      )}
      <a href="/?v3=1#/home">{tr('back_to_home')}</a>
    </section>
  );
}
