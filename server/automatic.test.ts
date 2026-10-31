import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testActions } from 'viem';
import { buildGateway } from './gateway.ts';
import { client, organizationScope, organizationIds } from '../src/v3/chain.ts';
import { Database } from './store.ts';
import type { State } from './state.ts';
import { exportApproval, prepareExternalReview } from './external.ts';
import type { ApprovalBundle } from '../src/v3/ui-types.ts';
import { allocate } from '../src/v3/allocation.ts';
import { chain } from '../src/v3/chain.ts';

test(
  'two funded alliances: isolated NGO sessions, source-based payment, peer follow-up and confirmed support',
  { skip: process.env.V3_INTEGRATION !== '1' },
  async () => {
    const tc = client.extend(testActions({ mode: 'anvil' }));
    const snapshot = await tc.snapshot();
    const { app, work } = await buildGateway();
    const saved = await Promise.all(
      organizationIds.map((id) =>
        organizationScope.run(id, async () => {
          const db = new Database<State>();
          try {
            return await db.read();
          } finally {
            await db.pool.end();
          }
        }),
      ),
    );
    const call = async (
      method: string,
      url: string,
      payload?: unknown,
      cookie = '',
      organization?: string,
    ) =>
      app.inject({
        method: method as 'GET',
        url,
        headers: {
          host: '127.0.0.1:3007',
          'x-v3-request': 'local-prototype',
          ...(cookie ? { cookie } : {}),
          ...(organization ? { 'x-v3-organization': organization } : {}),
        },
        ...(payload === undefined ? {} : { payload: payload as never }),
      });
    const ok = async (
      method: string,
      url: string,
      payload?: unknown,
      cookie = '',
      org?: string,
    ) => {
      const r = await call(method, url, payload, cookie, org);
      assert.equal(r.statusCode, 200, r.body);
      return r.json();
    };
    const login = async (role: string) => {
      const r = await call('POST', '/api/v3/session', { role });
      assert.equal(r.statusCode, 200, r.body);
      return (r.headers['set-cookie'] as string[])
        .map((x) => x.split(';')[0])
        .join('; ');
    };
    try {
      await tc.mine({ blocks: 2 });
      await work();
      const orgs = (await ok('GET', '/api/v3/organizations')).organizations;
      assert.equal(orgs.length, 2);
      assert.equal(orgs[0].support.total, '18000000000');
      assert.equal(orgs[1].support.total, '9000000000');
      assert.notEqual(orgs[0].snapshot.fund, orgs[1].snapshot.fund);
      assert.equal((await ok('GET', '/api/v3/roles')).roles.length, 6);
      const community = await login('community-ngo-1');
      const input = {
        incident: 'demo-quake',
        requested: '500000000',
        capacity: '500000000',
        external: '0',
      };
      const preview = await ok(
        'POST',
        '/api/v3/automatic/preview',
        input,
        community,
      );
      assert.equal(preview.available, true);
      assert.equal(preview.authorized, true);
      assert.equal(preview.synthetic, true);
      // Independent reference for 12 fixed equal-weight work packages, including provisional competitors.
      const participants = Array.from({ length: 12 }, (_, i) => ({
        id: String(i).padStart(2, '0'),
        ngo: String(i % 3),
        incident: String(Math.floor(i / 3)),
        weight: 1n,
        maximum: 4500_000000n,
        capacity: i === 0 ? 500_000000n : 4500_000000n,
        requested: i === 0 ? 500_000000n : null,
        paid: 0n,
        reserved: 0n,
        external: 0n,
        blocked: false,
      }));
      assert.equal(
        preview.amount,
        allocate(participants, 9000_000000n, 0n, true, true).rows[0]!.amount,
      );
      const paid = await ok(
        'POST',
        '/api/v3/automatic/submit',
        {
          ...input,
          explanation: 'Deliver emergency shelter and medical supplies.',
          requestId: randomUUID(),
        },
        community,
      );
      assert.equal(
        (await ok('GET', '/api/v3/portal', undefined, community)).evidence
          .length,
        0,
      );
      const retry = await ok(
        'POST',
        '/api/v3/automatic/submit',
        {
          ...input,
          explanation: 'Deliver emergency shelter and medical supplies.',
          requestId: paid.application,
        },
        community,
      );
      assert.equal(retry.application, paid.application);
      assert.equal(retry.tx, paid.tx);
      const changed = await call(
        'POST',
        '/api/v3/automatic/submit',
        {
          ...input,
          explanation: 'Changed purpose with a reused request identifier.',
          requestId: paid.application,
        },
        community,
      );
      assert.equal(changed.statusCode, 409);
      const reserved = await ok(
        'POST',
        '/api/v3/automatic/reserve',
        { application: paid.application },
        community,
      );
      assert.equal(
        (await ok('GET', '/api/v3/portal', undefined, community)).evidence
          .length,
        0,
      );
      await ok(
        'POST',
        `/api/v3/reservations/${reserved.reservation}`,
        { action: 'claim' },
        community,
      );
      await ok(
        'POST',
        `/api/v3/reservations/${reserved.reservation}`,
        { action: 'claim' },
        community,
      );
      assert.equal(
        (await ok('GET', '/api/v3/portal', undefined, community)).evidence
          .length,
        1,
      );
      const foreign = await call(
        'GET',
        '/api/v3/portal',
        undefined,
        community,
        'local-alliance',
      );
      assert.equal(foreign.statusCode, 401);
      const local = await login('ngo-1');
      assert.equal(
        (await ok('GET', '/api/v3/portal', undefined, local)).evidence.length,
        0,
      );
      await tc.increaseTime({ seconds: 86401 });
      await tc.mine({ blocks: 1 });
      const followup = await ok(
        'POST',
        '/api/v3/automatic/submit',
        {
          ...input,
          explanation: 'Deliver emergency shelter and medical supplies.',
          requestId: randomUUID(),
        },
        community,
      );
      const denied = await call(
        'POST',
        '/api/v3/automatic/reserve',
        { application: followup.application },
        community,
      );
      assert.equal(denied.statusCode, 400);
      assert.equal(
        (await ok('GET', '/api/v3/portal', undefined, community)).evidence
          .length,
        1,
      );
      const peer = await login('community-ngo-2');
      const peer2 = await login('community-ngo-3');
      await ok(
        'POST',
        '/api/v3/applications/' + followup.application,
        { action: 'vote' },
        peer,
      );
      await ok(
        'POST',
        '/api/v3/applications/' + followup.application,
        { action: 'vote' },
        peer2,
      );
      const nextReservation = await ok(
        'POST',
        '/api/v3/automatic/reserve',
        { application: followup.application },
        community,
      );
      await ok(
        'POST',
        `/api/v3/reservations/${nextReservation.reservation}`,
        { action: 'claim' },
        community,
      );
      const cases = await ok('GET', '/api/v3/workflow', undefined, community);
      assert.equal(
        cases.find((c: { id: string }) => c.id === paid.application).step,
        5,
      );
      assert.equal(
        cases.find((c: { id: string }) => c.id === paid.application).paid,
        '500000000',
      );
      // Complete spending evidence for both payments, with separate external attestations.
      const evidence = (await ok('GET', '/api/v3/portal', undefined, community))
        .evidence;
      for (const e of evidence) {
        async function upload(category: string) {
          const body = Buffer.from(
            'DISASTERDAO SYNTHETIC\nFictional invoice reconciliation and delivery report.',
          );
          const ticket = await ok(
            'POST',
            '/api/v3/uploads',
            {
              evidenceId: e.id,
              name: 'synthetic.txt',
              mime: 'text/plain',
              size: body.length,
              synthetic: true,
              category,
            },
            community,
          );
          const response = await app.inject({
            method: 'PUT',
            url: ticket.url,
            headers: {
              host: '127.0.0.1:3007',
              cookie: community,
              'x-v3-request': 'local-prototype',
              'content-type': 'text/plain',
            },
            payload: body,
          });
          assert.equal(response.statusCode, 200, response.body);
        }
        await upload('expenditure-evidence');
        let handoff = (await ok(
          'POST',
          `/api/v3/evidence/${e.id}/handoff`,
          undefined,
          community,
        )) as ApprovalBundle;
        const oldHandoff = handoff;
        await upload('expenditure-evidence');
        handoff = await ok(
          'POST',
          `/api/v3/evidence/${e.id}/handoff`,
          undefined,
          community,
        );
        assert.notEqual(handoff.target, oldHandoff.target);
        const sign = (b: ApprovalBundle) =>
          organizationScope.run('community-alliance', async () => ({
            ...b,
            signatures: await (
              await chain()
            ).sign(b.purpose, b.payload, [20, 21]),
          }));
        const receipt = await sign(handoff);
        const short = await call(
          'POST',
          `/api/v3/evidence/${e.id}/approvals/import`,
          { ...receipt, signatures: receipt.signatures.slice(0, 1) },
          community,
        );
        assert.notEqual(short.statusCode, 200);
        await ok(
          'POST',
          `/api/v3/evidence/${e.id}/approvals/import`,
          receipt,
          community,
        );
        await upload('external-review');
        const review = await organizationScope.run(
          'community-alliance',
          async () => {
            const database = new Database<State>();
            try {
              return await database.transaction(async (s) => {
                const document = s.documents.findLast(
                  (d) =>
                    d.evidenceId === e.id && d.category === 'external-review',
                )!;
                const r = await prepareExternalReview(s, {
                  kind: 'review',
                  evidenceId: e.id,
                  documentId: document.id,
                  reason:
                    'Synthetic invoices and delivery independently checked; no conflict declared.',
                  decision: 2,
                  days: 0,
                });
                return exportApproval(s, 'REVIEW', r.id);
              });
            } finally {
              await database.pool.end();
            }
          },
        );
        await ok(
          'POST',
          `/api/v3/evidence/${e.id}/approvals/import`,
          await sign(review),
          community,
        );
      }
      await tc.increaseTime({ seconds: 86401 });
      await tc.mine({ blocks: 1 });
      const acceptedPreview = await ok(
        'POST',
        '/api/v3/automatic/preview',
        input,
        community,
      );
      assert.equal(acceptedPreview.authorized, true);
      const third = await ok(
        'POST',
        '/api/v3/automatic/submit',
        {
          ...input,
          explanation:
            'More emergency supplies after accepted spending evidence.',
          requestId: randomUUID(),
        },
        community,
      );
      const thirdReserve = await ok(
        'POST',
        '/api/v3/automatic/reserve',
        { application: third.application },
        community,
      );
      await ok(
        'POST',
        `/api/v3/reservations/${thirdReserve.reservation}`,
        { action: 'claim' },
        community,
      );
      await tc.mine({ blocks: 2 });
      await work();
      const after = (await ok('GET', '/api/v3/organizations')).organizations;
      assert.equal(after[0].funds.paid, '0');
      assert.ok(BigInt(after[1].funds.paid) > 0n);
      assert.equal(after[1].support.total, '9000000000');
      // Restart preserves state and signatures/transactions remain bound to the fund.
      await organizationScope.run('community-alliance', async () =>
        assert.equal(
          String(await (await chain()).read('totalPaid')),
          after[1].funds.paid,
        ),
      );
    } finally {
      await tc.revert({ id: snapshot });
      for (const [i, id] of organizationIds.entries())
        await organizationScope.run(id, async () => {
          const db = new Database<State>();
          try {
            await db.pool.query('UPDATE v3_state SET body=$1 WHERE id=1', [
              JSON.stringify(saved[i]),
            ]);
          } finally {
            await db.pool.end();
          }
        });
      await work();
      await app.close();
    }
  },
);
