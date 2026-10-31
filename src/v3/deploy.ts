process.on('uncaughtException', (error: Error & { shortMessage?: string }) => {
  console.error(error.shortMessage ?? error.message);
  process.exit(1);
});
import { open, unlink, mkdir } from 'node:fs/promises';
import { testActions } from 'viem';
import {
  deployV3,
  organizationIds,
  organizationScope,
  client,
} from './chain.ts';
import { testnet } from './profile.ts';
await mkdir('.runtime', { recursive: true, mode: 0o700 });
const lock = '.runtime/deploy-' + (testnet ? 'testnet' : 'demo') + '.lock';
const handle = await open(lock, 'wx', 0o600);
try {
  for (const id of organizationIds) await organizationScope.run(id, deployV3);
  if (!testnet)
    await client.extend(testActions({ mode: 'anvil' })).mine({ blocks: 2 });
} finally {
  await handle.close();
  await unlink(lock);
}
