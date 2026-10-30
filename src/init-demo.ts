import { writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const entries: string[] = ['# Local demo roles only. Never commit or use for real funds.'];
for (const role of ['NGO', 'COMMITTEE']) {
  for (let i = 1; i <= 3; i++) {
    const key = generatePrivateKey();
    entries.push(`${role}_${i}_PRIVATE_KEY=${key}`);
    console.log(`${role} ${i}: ${privateKeyToAccount(key).address}`);
  }
}
await writeFile('.env.roles', entries.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log('Saved separate local test roles to ignored .env.roles. All roles in this demo are simulated.');
