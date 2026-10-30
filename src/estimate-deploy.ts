import { privateKeyToAccount } from 'viem/accounts';
import { readPrivateKey } from './private-key.ts';
import { deploymentBudget, printBudget } from './gas-budget.ts';
const roles = (kind: string) => [1, 2, 3].map(i => privateKeyToAccount(readPrivateKey(process.env[`${kind}_${i}_PRIVATE_KEY`])).address);
try { printBudget(await deploymentBudget(roles('NGO'), roles('COMMITTEE'))); }
catch (error) {
  const e = error as { shortMessage?: string; details?: string; message?: string };
  console.error(e.shortMessage || e.message);
  if (e.details) console.error(e.details.slice(0, 500));
  process.exitCode = 1;
}
