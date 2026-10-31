import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  supportSummary,
  paginate,
  normalizeActivity,
} from './organizations.ts';
import { verifySignatures } from './external.ts';
import { account, hash } from '../src/v3/chain.ts';
import { buildApp } from './app.ts';
import { seed, type State } from './state.ts';
import type { Database, Documents } from './store.ts';
import { randomBytes } from 'node:crypto';
test('support aggregation covers the full index, keeps integer precision, and excludes other donors and payouts', () => {
  const donor = account(0).address;
  const events = Array.from({ length: 125 }, (_, i) =>
    normalizeActivity(
      {
        tx: `0x${i}`,
        log_index: i,
        block_number: String(i),
        body: {
          eventName: 'Deposited',
          args: { donor, amount: '9007199254740993' },
        },
      },
      i,
    ),
  );
  events.push({ ...events[0]!, kind: 'Paid' });
  events.push({ ...events[0]!, actor: account(1).address });
  const summary = supportSummary(events, donor.toLowerCase());
  assert.equal(summary.count, 125);
  assert.equal(summary.total, String(125n * 9007199254740993n));
  const pages = [];
  for (let offset: number | null = 0; offset !== null;) {
    const page: { items: typeof events; next: number | null } = paginate(
      events,
      offset,
    );
    pages.push(...page.items);
    offset = page.next;
  }
  assert.equal(pages.length, 127);
  assert.equal(supportSummary([], donor).total, '0');
});
test('signature verification rejects duplicate signers, wrong groups and tampered payloads', async () => {
  const digest = hash('test-only-external-approval'),
    other = hash('tampered');
  const allowed = [4, 5, 6].map((i) => ({
    id: `data-${i - 3}`,
    address: account(i).address,
  }));
  const sigs = await Promise.all(
    [4, 5].map((i) => account(i).sign({ hash: digest })),
  );
  assert.deepEqual(await verifySignatures(digest, sigs, allowed), [
    'data-1',
    'data-2',
  ]);
  await assert.rejects(() =>
    verifySignatures(digest, [sigs[0]!, sigs[0]!], allowed),
  );
  await assert.rejects(() => verifySignatures(other, sigs, allowed));
  await assert.rejects(() =>
    verifySignatures(digest, sigs, [
      { id: 'ngo', address: account(1).address },
    ]),
  );
  await assert.rejects(() => verifySignatures(digest, [sigs[0]!], allowed));
});
test('browser session boundary lists only NGOs and rejects every reviewer group', async () => {
  const state = seed();
  const db = { read: async () => state } as unknown as Database<State>;
  const app = await buildApp(db, {} as Documents, randomBytes(32));
  const headers = { host: '127.0.0.1:3007', 'x-v3-request': 'local-prototype' };
  try {
    const list = await app.inject({ url: '/api/v3/roles', headers });
    assert.equal(list.json().roles.length, 3);
    assert.ok(
      list.json().roles.every((r: { kind: string }) => r.kind === 'ngo'),
    );
    for (const role of ['data-1', 'evidence-1', 'appeal-1']) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v3/session',
        headers,
        payload: { role },
      });
      assert.equal(r.statusCode, 403);
      assert.equal(r.headers['set-cookie'], undefined);
    }
    const r = await app.inject({
      method: 'POST',
      url: '/api/v3/session',
      headers,
      payload: { role: 'ngo-1' },
    });
    assert.equal(r.statusCode, 200);
    const cookie = String(r.headers['set-cookie']).split(';')[0]!;
    const donation = await app.inject({
      method: 'POST',
      url: '/api/v3/donations',
      headers: { ...headers, cookie },
      payload: { amount: '1' },
    });
    assert.equal(donation.statusCode, 403);
    for (const sessionCookie of [cookie, cookie, 'v3_session=expired']) {
      const logout = await app.inject({
        method: 'DELETE',
        url: '/api/v3/session',
        headers: { ...headers, cookie: sessionCookie },
      });
      assert.equal(logout.statusCode, 200);
      assert.match(String(logout.headers['set-cookie']), /Max-Age=0/);
    }
  } finally {
    await app.close();
  }
});
