import React, { useState } from 'react';
import type { SignedResponse } from '../../src/vendor/airnode-v2.ts';
import { useUI } from './context.tsx';
export function OriginalResponseInput({
  onChange,
}: {
  onChange: (p: SignedResponse | undefined) => void;
}) {
  const { locale, run, busy } = useUI(),
    de = locale === 'de';
  const [name, setName] = useState('');
  return (
    <div>
      <label>
        {de
          ? 'Originale Airnode-Antwort importieren (optional)'
          : 'Import original Airnode response (optional)'}
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            onChange(undefined);
            setName('');
            if (f)
              void run(async () => {
                if (f.size > 150000) throw new Error('File too large');
                const p = JSON.parse(await f.text()) as SignedResponse;
                onChange(p);
                setName(f.name);
              });
          }}
        />
      </label>
      {name && (
        <p>
          {de ? 'Originaldatei' : 'Original file'}: {name}
        </p>
      )}
      <p>
        {de
          ? 'Ohne Datei fragt die App die konfigurierte Quelle ab. Im lokalen Demo-Modus ist diese synthetisch; im Testnet wird eine echte Airnode-Antwort benötigt.'
          : 'Without a file the app queries the configured source. Local demo data is synthetic; the testnet requires a genuine Airnode response.'}
      </p>
    </div>
  );
}
