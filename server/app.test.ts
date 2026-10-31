import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { testActions, type Hex } from 'viem';
import { Database, Documents } from './store.ts';
import { seed, type State } from './state.ts';
import { buildApp } from './app.ts';
import { chain, client } from '../src/v3/chain.ts';
import { exportApproval, prepareExternalReview } from './external.ts';
import { prepareRound, proposeReview } from './service.ts';
import { tick } from './worker.ts';
import type { ApprovalBundle } from '../src/v3/ui-types.ts';

test(
  'isolated external approval lifecycle, document privacy, confirmed snapshots and reorg recovery',
  { skip: process.env.V3_INTEGRATION !== '1' },
  async () => {
    const base = new pg.Pool({
        connectionString:
          'postgres://localdemo:localdemo-only@127.0.0.1:5438/disasterdao',
      }),
      schema = `v3_test_${Date.now()}`;
    await base.query(`CREATE SCHEMA ${schema}`);
    const db = new Database<State>();
    await db.pool.end();
    db.pool = new pg.Pool({
      connectionString:
        'postgres://localdemo:localdemo-only@127.0.0.1:5438/disasterdao',
      options: `-c search_path=${schema}`,
    });
    await db.init(seed());
    const docs = new Documents(randomBytes(32));
    docs.bucket = `test-${schema.replaceAll('_', '-')}`;
    await docs.init();
    const app = await buildApp(db, docs, randomBytes(32)),
      tc = client.extend(testActions({ mode: 'anvil' })),
      initial = await tc.snapshot();
    const directory = await mkdtemp('/tmp/disasterdao-approval-test-');
    const cli = (args: string[]) =>
      promisify(execFile)(process.execPath, ['src/v3/approvals.ts', ...args], {
        env: {
          ...process.env,
          V3_DATABASE_URL: `postgres://localdemo:localdemo-only@127.0.0.1:5438/disasterdao?options=-c%20search_path%3D${schema}`,
        },
      });
    let cookie = '';
    const call = (method: string, url: string, payload?: unknown) =>
      app.inject({
        method: method as 'POST',
        url,
        headers: {
          host: '127.0.0.1:3007',
          'x-v3-request': 'local-prototype',
          ...(cookie ? { cookie } : {}),
        },
        ...(payload === undefined ? {} : { payload: payload as never }),
      });
    const ok = async (method: string, url: string, payload?: unknown) => {
      const r = await call(method, url, payload);
      assert.equal(r.statusCode, 200, r.body);
      return r.json();
    };
    const login = async (role: string) => {
      const r = await call('POST', '/api/v3/session', { role });
      assert.equal(r.statusCode, 200, r.body);
      cookie = String(r.headers['set-cookie']).split(';')[0]!;
    };
    const signed = async (
      b: ApprovalBundle,
      indices: number[],
    ): Promise<ApprovalBundle> => ({
      ...b,
      signatures: await (await chain()).sign(b.purpose, b.payload, indices),
    });
    const importBundle = (b: ApprovalBundle) =>
      ok('POST', '/api/v3/approvals/import', b);
    const upload = async (
      evidenceId: number,
      category = 'expenditure-evidence',
    ) => {
      const body = Buffer.from(
        'DISASTERDAO SYNTHETIC\nFictional invoice, payment reconciliation and relief delivery checks.',
      );
      const t = await ok('POST', '/api/v3/uploads', {
        evidenceId,
        name: 'synthetic.txt',
        mime: 'text/plain',
        size: body.length,
        synthetic: true,
        category,
      });
      const r = await app.inject({
        method: 'PUT',
        url: t.url,
        headers: {
          host: '127.0.0.1:3007',
          'x-v3-request': 'local-prototype',
          cookie,
          'content-type': 'text/plain',
        },
        payload: body,
      });
      assert.equal(r.statusCode, 200, r.body);
      return t;
    };
    try {
      assert.equal((await call('GET', '/api/v3/portal')).statusCode, 401);
      for (const role of ['data-1', 'evidence-1', 'appeal-1'])
        assert.equal(
          (await call('POST', '/api/v3/session', { role })).statusCode,
          403,
        );
      await login('ngo-1');
      const input = {
        incident: 'demo-quake',
        requested: '500000000',
        capacity: '500000000',
        external: '0',
        explanation:
          'Synthetic essential relief package, externally assessed; no real costs claimed.',
        change: '',
        conflicts: 0,
      };
      const preview = await ok('POST', '/api/v3/applications/preview', {
        incident: input.incident,
        requested: input.requested,
        capacity: input.capacity,
        external: input.external,
      });
      assert.equal((await db.read()).apps.length, 0);
      const a = await ok('POST', '/api/v3/applications', input);
      assert.equal(
        (
          await call('POST', `/api/v3/applications/${a.id}`, {
            action: 'approve',
          })
        ).statusCode,
        403,
      );
      const approval = await signed(
        await ok('POST', '/api/v3/approvals/export', {
          purpose: 'APPLICATION',
          target: a.id,
        }),
        [4, 5],
      );
      await login('ngo-2');
      assert.equal((await ok('GET', '/api/v3/portal')).apps.length, 0);
      assert.equal(
        (await call('POST', '/api/v3/approvals/import', approval)).statusCode,
        403,
      );
      await login('ngo-1');
      for (const invalid of [
        { ...approval, fund: '0x0000000000000000000000000000000000000001' },
        { ...approval, chainId: 1 },
        { ...approval, payload: '0x' + '00'.repeat(32) },
        { ...approval, purpose: 'ROUND' },
        {
          ...approval,
          signatures: [approval.signatures[0], approval.signatures[0]],
        },
      ])
        assert.notEqual(
          (await call('POST', '/api/v3/approvals/import', invalid)).statusCode,
          200,
        );
      await writeFile(
        directory + '/request.json',
        JSON.stringify(
          await exportApproval(await db.read(), 'APPLICATION', a.id),
        ),
      );
      await cli([
        'sign',
        '--role',
        'data-1',
        '--in',
        directory + '/request.json',
        '--out',
        directory + '/one.json',
      ]);
      await cli([
        'sign',
        '--role',
        'data-2',
        '--in',
        directory + '/one.json',
        '--out',
        directory + '/two.json',
      ]);
      const cliApproval = JSON.parse(
        await readFile(directory + '/two.json', 'utf8'),
      ) as ApprovalBundle;
      assert.deepEqual(cliApproval.signatures, approval.signatures);
      const opened = await importBundle(cliApproval);
      assert.ok(opened.tx);
      assert.equal(
        (
          await importBundle({
            ...approval,
            signatures: [...approval.signatures].reverse(),
          })
        ).tx,
        opened.tx,
      );
      const round = await db.transaction((s) =>
        prepareRound(
          s,
          s.roles.find((r) => r.id === 'data-1')!,
        ),
      );
      const grant = round.grants[0]!;
      assert.equal(String(grant.amount), preview.estimated);
      const roundBundle = await signed(
        await exportApproval(await db.read(), 'ROUND', round.id),
        [4, 5],
      );
      await importBundle(roundBundle);
      let portal = await ok('GET', '/api/v3/portal');
      assert.equal(portal.apps[0].status, 'reserved');
      const reservation = portal.reservations.find(
        (r: { settled: boolean }) => !r.settled,
      );
      await ok('POST', `/api/v3/reservations/${reservation.id}`, {
        action: 'claim',
      });
      // Reimporting an earlier approval must never regress a paid application.
      await importBundle(approval);
      assert.equal((await db.read()).apps[0]!.status, 'paid');
      portal = await ok('GET', '/api/v3/portal');
      const e = portal.evidence[0];
      assert.equal(e.confirmed, false);
      const doc = await upload(e.id);
      assert.equal((await ok('GET', '/api/v3/portal')).evidence[0].status, 0);
      const legacy = await db.transaction((s) =>
        proposeReview(
          s,
          s.roles.find((r) => r.kind === 'evidence')!,
          {
            kind: 'receipt',
            evidenceId: e.id,
            reason:
              'Legacy synthetic receipt review draft without completed transaction.',
            decision: 0,
            days: 0,
          },
        ),
      );
      const receiptReview = await db.transaction((s) =>
        prepareExternalReview(s, {
          kind: 'receipt',
          evidenceId: e.id,
          reason:
            'Independent simulated receipt confirmation and conflict checks.',
          decision: 0,
          days: 0,
        }),
      );
      assert.equal(
        (await db.read()).reviews.find((r) => r.id === legacy.id)!.superseded,
        true,
      );
      const rb = await signed(
        await exportApproval(await db.read(), 'RECEIPT', receiptReview.id),
        [7, 8],
      );
      const validReceiptTime = await tc.snapshot();
      await tc.increaseTime({ seconds: 3601 });
      await tc.mine({ blocks: 1 });
      assert.notEqual(
        (await call('POST', '/api/v3/approvals/import', rb)).statusCode,
        200,
      );
      await tc.revert({ id: validReceiptTime });
      await importBundle(rb);
      assert.equal((await ok('GET', '/api/v3/portal')).evidence[0].status, 1);
      const audit = await upload(e.id, 'external-review');
      const review = await db.transaction((s) =>
        prepareExternalReview(s, {
          kind: 'review',
          evidenceId: e.id,
          documentId: audit.id,
          reason:
            'Synthetic expenditure reviewed with invoice reconciliation and delivery checks.',
          decision: 2,
          days: 0,
        }),
      );
      const vb = await signed(
        await exportApproval(await db.read(), 'REVIEW', review.id),
        [7, 8],
      );
      const originalDigest = (await db.read()).documents.find(
        (d) => d.id === audit.id,
      )!.digest!;
      await db.transaction((s) => {
        s.documents.find((d) => d.id === audit.id)!.digest = '00'.repeat(32);
      });
      assert.notEqual(
        (await call('POST', '/api/v3/approvals/import', vb)).statusCode,
        200,
      );
      await db.transaction((s) => {
        s.documents.find((d) => d.id === audit.id)!.digest = originalDigest;
      });
      await login('ngo-2');
      assert.equal(
        (await call('POST', `/api/v3/documents/${doc.id}/access`)).statusCode,
        403,
      );
      assert.equal(
        (await call('POST', '/api/v3/approvals/import', vb)).statusCode,
        403,
      );
      await login('ngo-1');
      const reviewTx = await importBundle(vb);
      assert.equal((await importBundle(vb)).tx, reviewTx.tx);
      const access = await ok('POST', `/api/v3/documents/${doc.id}/access`);
      assert.equal((await call('GET', access.url)).statusCode, 200);
      assert.equal((await call('GET', access.url)).statusCode, 403);
      await tc.mine({ blocks: 2 });
      await tick(db);
      portal = await ok('GET', '/api/v3/portal');
      assert.equal(portal.evidence[0].status, 2);
      assert.equal(portal.evidence[0].confirmed, true);
      const report = await ok('POST', '/api/v3/reports', {
        evidenceId: e.id,
        title: 'Synthetic delivery',
        text: 'Fictional delivery outcome',
        provenance: 'Fictional source',
        rights: 'Synthetic local text',
        protection: 'No real beneficiary data',
      });
      assert.equal((await ok('GET', '/api/v3/public')).reports.length, 0);
      const pub = await signed(
        await exportApproval(await db.read(), 'PUBLICATION', report.id),
        [7, 8],
      );
      await importBundle(pub);
      assert.equal((await ok('GET', '/api/v3/public')).reports.length, 1);
      const organization = await ok(
        'GET',
        '/api/v3/organizations/local-alliance',
      );
      assert.equal(organization.snapshot.status, 'confirmed');
      assert.ok(organization.funds);
      assert.equal(organization.members.length, 3);
      const publicText = JSON.stringify(
        await ok('GET', '/api/v3/organizations'),
      );
      assert.ok(!publicText.includes(doc.id));
      assert.ok(!publicText.includes('synthetic.txt'));
      const originalSupport = await ok(
        'GET',
        '/api/v3/organizations/local-alliance/test-support',
      );
      const beforeDonation = await tc.snapshot();
      await ok('DELETE', '/api/v3/session');
      cookie = '';
      await ok('POST', '/api/v3/donations', { amount: '1000000' });
      await tc.mine({ blocks: 2 });
      await tick(db);
      const increased = await ok(
        'GET',
        '/api/v3/organizations/local-alliance/test-support',
      );
      assert.equal(
        BigInt(increased.total),
        BigInt(originalSupport.total) + 1000000n,
      );
      await tc.revert({ id: beforeDonation });
      assert.equal(
        (await ok('GET', '/api/v3/organizations/local-alliance')).snapshot
          .status,
        'unavailable',
      );
      await tick(db);
      assert.equal(
        (await ok('GET', '/api/v3/organizations/local-alliance/test-support'))
          .total,
        originalSupport.total,
      );
      assert.equal(
        (await call('GET', '/api/v3/organizations/unknown')).statusCode,
        404,
      );
      // Oracle reservation consumes another package of the SAME externally opened round.
      const mixedChain = await chain();
      const roundNonceBefore = await mixedChain.read('roundNonce');
      const reservedBefore = await mixedChain.read('totalReserved');
      await login('ngo-2');
      const auto = await ok('POST', '/api/v3/automatic/submit', {
        incident: 'demo-quake',
        requested: '500000000',
        capacity: '500000000',
        external: '0',
        explanation:
          'Synthetic relief supplies through the same shared fund round.',
        requestId: crypto.randomUUID(),
      });
      const mixed = await ok('POST', '/api/v3/automatic/reserve', {
        application: auto.application,
      });
      assert.equal(await mixedChain.read('roundNonce'), roundNonceBefore);
      assert.equal(await mixedChain.read('totalReserved'), reservedBefore);
      await ok('POST', `/api/v3/reservations/${mixed.reservation}`, {
        action: 'claim',
      });
      assert.equal(String(await mixedChain.read('totalPaid')), '1000000000');
    } finally {
      await tc.revert({ id: initial });
      await app.close();
      await db.pool.end();
      await rm(directory, { recursive: true, force: true });
      await base.query(`DROP SCHEMA ${schema} CASCADE`);
      await base.end();
    }
  },
);
