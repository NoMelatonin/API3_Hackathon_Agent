import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePayouts, type Payout } from './payout-history.ts';

test('batched payouts survive history merging and repeated RPC/receipt results are deduplicated', () => {
  const first: Payout = { ngo: 'NGO1', amount: 1_000_000_000n, path: 0, hash: '0x1234', block: 10n, logIndex: 2 };
  const second = { ...first, ngo: 'NGO2', logIndex: 4 };
  const later = { ...first, ngo: 'NGO3', hash: '0x5678' as const, block: 11n, logIndex: 1 };
  assert.deepEqual(mergePayouts([first, second, first, later, second]), [later, second, first]);
});
