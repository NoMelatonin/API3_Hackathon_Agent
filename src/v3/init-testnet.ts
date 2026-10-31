import { mkdir, writeFile } from 'node:fs/promises';
import { generatePrivateKey } from 'viem/accounts';
import { readPrivateKey } from '../private-key.ts';
await mkdir('.runtime', { recursive: true, mode: 0o700 });
const roles: Record<string, string> = {};
roles['0'] = readPrivateKey(
  process.env.DEPLOYER_PRIVATE_KEY?.trim() || process.env.PAYER_PRIVATE_KEY,
);
for (let i = 1; i <= 25; i++) {
  const existing =
    i <= 3
      ? process.env[`NGO_${i}_PRIVATE_KEY`]
      : i <= 6
        ? process.env[`COMMITTEE_${i - 3}_PRIVATE_KEY`]
        : undefined;
  roles[String(i)] = existing ? readPrivateKey(existing) : generatePrivateKey();
}
await writeFile('.runtime/testnet-roles.json', JSON.stringify(roles) + '\n', {
  flag: 'wx',
  mode: 0o600,
});
console.log('Separate private testnet roles saved. No Anvil keys used.');
