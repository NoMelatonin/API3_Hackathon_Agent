import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logPages } from './log-pages.ts';
test('log queries cover each block exactly once and respect public RPC limits', async () => {
  const spans: [bigint, bigint][] = [];
  const result = await logPages(100n, 950n, async (a, b) => { spans.push([a, b]); return [a]; });
  assert.deepEqual(spans, [[100n, 299n], [300n, 499n], [500n, 699n], [700n, 899n], [900n, 950n]]);
  assert.equal(result.length, 5);
});
test('history RPC failures propagate instead of being displayed as an empty history', async () => {
  await assert.rejects(logPages(0n, 200n, async () => { throw new Error('RPC down'); }), /RPC down/);
});
