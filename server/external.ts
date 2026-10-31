import {
  recoverAddress,
  encodeFunctionData,
  decodeFunctionData,
  decodeEventLog,
  type Hex,
} from 'viem';
import {
  account,
  chain,
  client,
  encode,
  hash,
  requestType,
  roundType,
} from '../src/v3/chain.ts';
import { commitment } from '../src/v3/domain.ts';
import type { ApprovalBundle } from '../src/v3/ui-types.ts';
import type { State, Role, Review } from './state.ts';
import {
  assessment,
  request,
  must,
  own,
  noConflict,
  now,
  chainEvidence,
  proposeReview,
} from './service.ts';

export async function verifySignatures(
  digest: Hex,
  signatures: Hex[],
  allowed: { id: string; address: string }[],
) {
  must(
    Array.isArray(signatures) &&
      signatures.length >= 2 &&
      signatures.length <= 3,
    'Two distinct signatures required',
  );
  const voters: string[] = [];
  for (const signature of signatures) {
    must(/^0x[0-9a-fA-F]{130}$/.test(signature), 'Invalid signature');
    const address = await recoverAddress({ hash: digest, signature });
    const signer = allowed.find(
      (x) => x.address.toLowerCase() === address.toLowerCase(),
    );
    must(
      signer && !voters.includes(signer.id),
      'Wrong or duplicate signer',
      403,
    );
    voters.push(signer.id);
  }
  return voters;
}

export async function prepareExternalReview(
  s: State,
  input: {
    kind: Review['kind'];
    evidenceId: number;
    reason: string;
    decision: number;
    days: number;
    applicationId?: string;
    documentId?: string;
  },
) {
  const { documentId, ...rest } = input;
  const evidence = (await chainEvidence()).find(
    (e) => e.id === input.evidenceId,
  );
  const doc = documentId
    ? s.documents.find(
        (d) =>
          d.id === documentId && d.uploaded && d.category === 'external-review',
      )
    : undefined;
  if (input.kind !== 'receipt') {
    must(
      doc &&
        evidence &&
        doc.evidenceId === evidence.id &&
        doc.ngo.toLowerCase() === evidence.ngo.toLowerCase(),
      'Upload a matching external review document first',
    );
  }
  if (input.kind === 'followup')
    must(
      evidence &&
        s.apps.some(
          (a) =>
            a.id === input.applicationId &&
            a.ngo.toLowerCase() === evidence.ngo.toLowerCase(),
        ),
      'Follow-up document belongs to another NGO',
      403,
    );
  const role = s.roles.find(
    (r) => r.kind === (input.kind === 'resolve' ? 'appeal' : 'evidence'),
  )!;
  // Preserve old drafts while allowing an explicit external replacement. Existing
  // signatures are never counted as votes on the replacement request.
  const pending = s.reviews.find(
    (r) =>
      !r.tx &&
      !r.superseded &&
      r.kind === input.kind &&
      r.evidenceId === input.evidenceId &&
      r.applicationId === input.applicationId,
  );
  if (pending) {
    const expired =
      pending.kind === 'receipt' && (await now()) - pending.receivedAt > 3600;
    const changed =
      pending.binding &&
      evidence &&
      (pending.binding.manifest !== evidence.manifest ||
        pending.binding.status !== evidence.status ||
        pending.binding.due !== evidence.due);
    must(
      !pending.external || expired || changed,
      'Open external review already exists',
    );
    pending.superseded = true;
  }
  const review = await proposeReview(s, role, {
    ...rest,
    reason: doc
      ? `${rest.reason}\nExternal document SHA256: ${doc.digest}`
      : rest.reason,
  });
  review.external = true;
  review.documentId = documentId;
  if (evidence)
    review.binding = {
      manifest: evidence.manifest,
      status: evidence.status,
      due: evidence.due,
    };
  return review;
}

async function descriptor(s: State, purpose: string, target: string) {
  const c = await chain();
  let payload: Hex,
    fn = '',
    args: unknown[] = [],
    ngo: string | undefined;
  let group: Role['kind'] = 'evidence';
  if (purpose === 'APPLICATION') {
    group = 'data';
    const a = s.apps.find((a) => a.id === target);
    must(a, 'Application missing', 404);
    const data = assessment(a),
      r = request(a);
    payload = encode(`bytes32,${requestType}`, [
      await c.read('assessmentHash', [data]),
      r,
    ]);
    fn = 'open';
    args = [data, r];
    ngo = a.ngo;
  } else if (purpose === 'ROUND') {
    group = 'data';
    const r = s.rounds.find((r) => r.id === target);
    must(r, 'Round missing', 404);
    const data = {
      snapshot: r.snapshot,
      balance: BigInt(r.balance),
      reserved: BigInt(r.reserved),
      nonce: BigInt(r.nonce),
      validUntil: BigInt(r.expires),
      uncertain: r.uncertain,
      competing: r.competing,
      provisional: BigInt(r.provisional),
    };
    const grants = r.grants.map((g) => ({
      application: BigInt(g.application),
      amount: BigInt(g.amount),
    }));
    payload = encode(`(uint256 application,uint256 amount)[],${roundType}`, [
      grants,
      data,
    ]);
    fn = 'closeRound';
    args = [grants, data];
  } else if (purpose === 'PUBLICATION') {
    const r = s.reports.find((r) => r.id === target);
    must(r, 'Report missing', 404);
    ngo = r.ngo;
    payload = commitment({
      id: r.id,
      evidenceId: r.evidenceId,
      title: r.title,
      text: r.text,
      provenance: r.provenance,
      rights: r.rights,
      protection: r.protection,
    }) as Hex;
  } else if (purpose === 'COVERAGE') {
    group = 'data';
    const d = s.coverageDecisions.find((d) => d.id === target);
    must(d, 'Coverage decision missing', 404);
    payload = commitment({
      id: d.id,
      areaId: d.areaId,
      reason: d.reason,
      time: d.time,
    }) as Hex;
  } else {
    const r = s.reviews.find(
      (r) => r.id === target && r.external && !r.superseded,
    );
    must(r, 'External review missing', 404);
    must(r.kind.toUpperCase() === purpose, 'Purpose mismatch');
    const e = (await chainEvidence()).find((e) => e.id === r.evidenceId);
    ngo = e?.ngo;
    const eid = BigInt(r.evidenceId),
      b = r.binding;
    if (r.documentId) {
      const d = s.documents.find((d) => d.id === r.documentId && d.uploaded);
      must(
        d?.category === 'external-review' &&
          r.reason.endsWith(`External document SHA256: ${d.digest}`),
        'Document binding changed',
      );
    }
    switch (r.kind) {
      case 'receipt':
        payload = encode('uint256,bytes32,uint256', [
          eid,
          r.manifest,
          BigInt(r.receivedAt),
        ]);
        fn = 'receipt';
        args = [eid, r.manifest, BigInt(r.receivedAt)];
        break;
      case 'review':
        must(b, 'Missing binding');
        payload = encode('uint256,bytes32,uint8,bytes32', [
          eid,
          b.manifest,
          r.decision,
          hash(r.reason),
        ]);
        fn = 'review';
        args = [eid, r.decision, hash(r.reason)];
        break;
      case 'extend':
        must(b, 'Missing binding');
        payload = encode('uint256,uint256,uint256,bytes32', [
          eid,
          BigInt(b.due),
          BigInt(r.days),
          hash(r.reason),
        ]);
        fn = 'extend';
        args = [eid, BigInt(r.days), hash(r.reason)];
        break;
      case 'resolve':
        group = 'appeal';
        must(b, 'Missing binding');
        payload = encode('uint256,bytes32,uint8,uint256,bytes32', [
          eid,
          b.manifest,
          b.status,
          BigInt(b.due),
          hash(r.reason),
        ]);
        fn = 'resolve';
        args = [eid, hash(r.reason)];
        break;
      case 'followup': {
        const a = s.apps.find((a) => a.id === r.applicationId);
        must(a?.chainId, 'Application missing');
        ngo = a.ngo;
        payload = encode('uint256,bytes32', [
          BigInt(a.chainId),
          await c.read('assessmentHash', [assessment(a)]),
        ]);
        fn = 'authorizeFollowup';
        args = [BigInt(a.chainId)];
        break;
      }
    }
  }
  return { payload, fn, args, ngo, group };
}
export async function exportApproval(
  s: State,
  purpose: string,
  target: string,
): Promise<ApprovalBundle> {
  const c = await chain(),
    d = await descriptor(s, purpose, target);
  const a = s.apps.find((a) => a.id === target),
    review = s.reviews.find((r) => r.id === target);
  const context = JSON.parse(
    JSON.stringify(
      {
        function: d.fn || 'offchain',
        args: d.args,
        ...(a
          ? {
              incident: a.incident,
              explanation: a.explanation,
              change: a.change,
            }
          : {}),
        ...(review
          ? {
              reason: review.reason,
              documentId: review.documentId,
              receivedAt: review.receivedAt,
            }
          : {}),
      },
      (_, v) => (typeof v === 'bigint' ? String(v) : v),
    ),
  );
  return {
    schema: 1,
    purpose,
    target,
    chainId: c.config.chainId,
    fund: c.config.fund,
    payload: d.payload,
    context,
    signatures: [],
  };
}
export async function authorizeApproval(
  s: State,
  purpose: string,
  target: string,
  role: Role,
) {
  must(role.kind === 'ngo', 'NGO required', 403);
  const d = await descriptor(s, purpose, target);
  if (purpose === 'ROUND') {
    const round = s.rounds.find((r) => r.id === target)!;
    must(
      round.grants.some((g) =>
        s.apps.some(
          (a) =>
            a.chainId === Number(g.application) &&
            a.ngo.toLowerCase() === role.ngo?.toLowerCase(),
        ),
      ),
      'Round has no own application',
      403,
    );
  } else {
    must(d.ngo, 'Operator import required', 403);
    own(role, d.ngo);
  }
}
export async function importApproval(
  s: State,
  bundle: ApprovalBundle,
  role?: Role,
) {
  must(
    bundle &&
      bundle.schema === 1 &&
      typeof bundle.target === 'string' &&
      typeof bundle.purpose === 'string',
    'Invalid approval file',
  );
  const c = await chain();
  must(
    bundle.chainId === c.config.chainId &&
      bundle.fund?.toLowerCase() === c.config.fund.toLowerCase(),
    'Wrong chain or fund',
    403,
  );
  const d = await descriptor(s, bundle.purpose, bundle.target);
  must(bundle.payload === d.payload, 'Approval payload changed', 409);
  if (bundle.context) {
    const expected = await exportApproval(s, bundle.purpose, bundle.target);
    must(
      commitment(bundle.context) === commitment(expected.context),
      'Approval context changed',
      409,
    );
  }
  if (role) {
    must(role.kind === 'ngo', 'NGO required', 403);
    if (bundle.purpose === 'ROUND') {
      const round = s.rounds.find((r) => r.id === bundle.target)!;
      must(
        round.grants.some((g) =>
          s.apps.some(
            (a) =>
              a.chainId === Number(g.application) &&
              a.ngo.toLowerCase() === role.ngo?.toLowerCase(),
          ),
        ),
        'Round has no own application',
        403,
      );
    } else {
      must(d.ngo, 'Operator import required', 403);
      own(role, d.ngo);
    }
  }
  const digest = (await c.read('digest', [
    hash(bundle.purpose),
    d.payload,
  ])) as Hex;
  const voters = await verifySignatures(
    digest,
    bundle.signatures,
    s.roles
      .filter((r) => r.kind === d.group)
      .map((r) => ({ id: r.id, address: account(r.index).address })),
  );
  for (const v of voters)
    noConflict(
      s,
      s.roles.find((r) => r.id === v)!,
      bundle.target,
    );
  const time = await now();
  if (!d.fn) {
    if (bundle.purpose === 'PUBLICATION') {
      const r = s.reports.find((r) => r.id === bundle.target)!;
      const e = (await chainEvidence()).find((e) => e.id === r.evidenceId);
      must(e && [2, 6].includes(e.status), 'Accepted use required');
      r.approvedBy = voters;
      r.published = true;
    } else {
      const r = s.coverageDecisions.find((r) => r.id === bundle.target)!;
      must(time - r.time <= 3600, 'Decision expired');
      r.votes = voters;
      const a = s.areas.find((a) => a.id === r.areaId)!;
      const source =
        'SIMULATED documented 2/3 manual coverage decision ' + r.id;
      if (!s.coverage.some((c) => c.source === source))
        s.coverage.push({
          source,
          areaId: a.id,
          areaVersion: a.version,
          hazards: a.hazards,
          start: r.time - 86400,
          end: r.time,
          checkedAt: r.time,
          status: 'ok',
          pages: 1,
          complete: true,
          observations: [],
        });
    }
    return { offchain: true, status: 'accepted', voters };
  }
  // Recover a successful canonical transaction if the DB commit or response was lost.
  // The exact calldata comparison includes the submitted signatures and target arguments.
  const callArgs = [...d.args, bundle.signatures];
  const data = encodeFunctionData({
    abi: c.fundAbi,
    functionName: d.fn,
    args: [...d.args, []],
  });
  let tx: Hex | undefined;
  const tip = await client.getBlockNumber({ cacheTime: 0 });
  const hashes = new Set<Hex>();
  for (let from = BigInt(c.config.deployedBlock); from <= tip; from += 1000n) {
    for (const log of await client.getLogs({
      address: c.config.fund,
      fromBlock: from,
      toBlock: from + 999n < tip ? from + 999n : tip,
    }))
      hashes.add(log.transactionHash);
  }
  for (const h of hashes) {
    const t = await client.getTransaction({ hash: h });
    let normalized: Hex | undefined;
    try {
      const decoded = decodeFunctionData({ abi: c.fundAbi, data: t.input });
      if (decoded.functionName === d.fn)
        normalized = encodeFunctionData({
          abi: c.fundAbi,
          functionName: d.fn,
          args: [...(decoded.args ?? []).slice(0, -1), []],
        });
    } catch {}
    if (normalized === data) {
      const receipt = await client.getTransactionReceipt({ hash: h });
      if (receipt.status === 'success') tx = h;
    }
  }
  if (!tx) {
    const r = s.reviews.find((r) => r.id === bundle.target);
    if (r?.binding && r.kind !== 'followup') {
      const e = (await chainEvidence()).find((e) => e.id === r.evidenceId);
      must(e, 'Evidence missing');
      must(
        e.manifest === r.binding.manifest &&
          e.status === r.binding.status &&
          e.due === r.binding.due,
        'Review state changed',
        409,
      );
    }
    tx = await c.send(
      d.fn,
      callArgs,
      d.ngo
        ? s.roles.find((r) => r.ngo?.toLowerCase() === d.ngo!.toLowerCase())!
            .index
        : 0,
    );
  }
  if (bundle.purpose === 'APPLICATION') {
    const a = s.apps.find((a) => a.id === bundle.target)!;
    a.tx = tx;
    a.votes = voters;
    if (a.status === 'submitted') a.status = 'reviewed';
    const receipt = await client.getTransactionReceipt({ hash: tx });
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({
          abi: c.fundAbi,
          data: log.data,
          topics: log.topics,
        });
        if (ev.eventName === 'ApplicationOpened')
          a.chainId = Number((ev.args as unknown as { id: bigint }).id);
      } catch {}
    }
  } else if (bundle.purpose === 'ROUND') {
    const r = s.rounds.find((r) => r.id === bundle.target)!;
    r.tx = tx;
    r.votes = voters;
    for (const g of r.grants) {
      const a = s.apps.find((a) => a.chainId === Number(g.application));
      if (a && a.status === 'reviewed') a.status = 'reserved';
    }
  } else {
    const r = s.reviews.find((r) => r.id === bundle.target)!;
    r.tx = tx;
    r.votes = voters;
  }
  return { tx, status: 'mined', voters };
}
