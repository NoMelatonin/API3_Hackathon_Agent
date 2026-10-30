import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate } from './allocation.ts';
import { estimate, syntheticCases, backtest } from './model.ts';
import {
  situation,
  type Area,
  type Coverage,
  type Participant,
} from './domain.ts';
import { scanUSGS, reconcile } from './sources.ts';
const p = (id: string, request: bigint | null = null): Participant => ({
  id,
  ngo: id,
  incident: id,
  weight: 100n,
  maximum: 1000n,
  requested: request,
  capacity: 1000n,
  paid: 0n,
  reserved: 0n,
  external: 0n,
  blocked: false,
});
test('reserve, provisional competitors, caps and deterministic integer reallocation', () => {
  const r = allocate(
    [p('a', 100n), p('b'), p('c', 1000n)],
    1001n,
    0n,
    true,
    true,
  );
  assert.equal(r.hold, '200');
  assert.deepEqual(
    r.rows.map((x) => x.amount),
    ['100', '351', '350'],
  );
  assert.equal(
    r.snapshot,
    allocate([p('c', 1000n), p('b'), p('a', 100n)], 1001n, 0n, true, true)
      .snapshot,
  ); // canonical participant order required below
});
test('random allocation never overspends, crosses cumulative cap or weights higher requests', () => {
  for (let seed = 1; seed < 1000; seed++) {
    const rows = [
      p('a', BigInt(seed)),
      { ...p('b'), paid: 100n, external: 200n },
      p('c', 1000n),
    ];
    const r = allocate(rows, BigInt(seed), 0n, true, true);
    assert.ok(
      r.rows.reduce((s, x) => s + BigInt(x.amount), 0n) <=
        BigInt(seed) - BigInt(r.hold),
    );
    assert.ok(BigInt(r.rows[1]!.amount) <= 600n);
  }
  const a = allocate([p('a', 500n), p('b', 500n)], 100n, 0n, false, false);
  const b = allocate([p('a', 1000n), p('b', 500n)], 100n, 0n, false, false);
  assert.equal(a.rows[0]!.amount, b.rows[0]!.amount);
  assert.throws(() => allocate([p('a'), p('a')], 100n, 0n, false, false));
});
test('missing or real-unproven expenditure never yields automatic empirical grant', () => {
  const input = {
    hazard: 'earthquake' as const,
    service: 'essential-relief',
    kind: 'actual' as const,
    time: 1800000000,
    people: [1000, 2000] as const,
    features: [7, 150, 0.7, 0.7, 1],
    synthetic: true,
  };
  assert.equal(estimate(input, syntheticCases).status, 'synthetic-demo');
  assert.equal(
    estimate({ ...input, synthetic: false }, syntheticCases).demoMaximum,
    null,
  );
  assert.equal(
    estimate({ ...input, features: [null, 1, 1, 1, 1] }, syntheticCases).status,
    'manual-review-required',
  );
  assert.equal(
    estimate(
      input,
      syntheticCases.map((x) => ({ ...x, event: 'same-related-event' })),
    ).demoMaximum,
    null,
  );
  const b = backtest(syntheticCases);
  assert.ok(b.rows.some((r) => r.eligible));
  assert.ok(b.rows.slice(0, 10).every((r) => !r.eligible));
});
const area: Area = {
  id: 'a',
  version: 1,
  name: 'Test',
  country: 'DE',
  bbox: [0, 0, 10, 10],
  hazards: ['earthquake'],
};
const c: Coverage = {
  source: 'USGS',
  areaId: 'a',
  areaVersion: 1,
  hazards: ['earthquake'],
  start: 0,
  end: 86400,
  checkedAt: 86400,
  status: 'ok',
  pages: 1,
  complete: true,
  observations: [],
};
test('empty, stale, incomplete, failed and changed-area coverage is unknown', () => {
  assert.equal(situation(area, [c], 86400), 'clear');
  for (const x of [
    { complete: false },
    { pages: 0 },
    { areaVersion: 2 },
    { status: 'failed' as const },
    { checkedAt: 0 },
  ])
    assert.equal(situation(area, [{ ...c, ...x }], 86400), 'unknown');
  assert.equal(
    situation({ ...area, hazards: ['earthquake', 'health'] }, [c], 86400),
    'unknown',
  );
});
test('USGS consumes final page and fails closed on repeated or unavailable pagination', async () => {
  const feature = {
    id: 'x',
    properties: { time: 1, mag: 7, url: 'https://example.invalid' },
    geometry: { type: 'Point', coordinates: [1, 2] },
  };
  let calls = 0;
  const r = await scanUSGS(
    area,
    86400,
    async () => ({ features: calls++ === 0 ? [feature] : [] }),
    1,
  );
  assert.equal(r.complete, true);
  assert.equal(r.pages, 2);
  const repeat = await scanUSGS(
    area,
    86400,
    async () => ({ features: [feature] }),
    1,
  );
  assert.equal(repeat.complete, false);
  assert.equal(repeat.status, 'failed');
  assert.equal(reconcile([...r.observations, ...r.observations]).size, 1);
});

test('review target counts UTC business days and skips weekends', async () => {
  const { reviewTarget } = await import('./deadlines.ts');
  const friday = Date.parse('2026-10-30T12:00:00Z') / 1000;
  assert.equal(
    new Date(reviewTarget(friday) * 1000).toISOString(),
    '2026-11-13T12:00:00.000Z',
  );
});
