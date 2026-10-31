import { testActions } from 'viem';
import {
  deployV3,
  organizationIds,
  organizationScope,
  client,
} from './chain.ts';
for (const id of organizationIds)
  await organizationScope.run(id, deployV3);

// Local Anvil only: confirm both seed deposits before the first index scan.
await client.extend(testActions({ mode: 'anvil' })).mine({ blocks: 2 });
