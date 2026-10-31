import { randomUUID, randomBytes } from 'node:crypto';
import { type Address, type Hex } from 'viem';
import {
  chain,
  client,
  hash,
  encode,
  assessmentType,
  requestType,
  roundType,
} from '../src/v3/chain.ts';
import {
  POLICY,
  commitment,
  deadlineDays,
  situation,
  type Participant,
} from '../src/v3/domain.ts';
import { allocate } from '../src/v3/allocation.ts';
import { estimate, syntheticCases, MODEL_VERSION } from '../src/v3/model.ts';
import {
  type State,
  type Role,
  type App,
  type Review,
  type Round,
} from './state.ts';
export class Rejected extends Error {
  statusCode: number;
  constructor(message: string, status = 400) {
    super(message);
    this.statusCode = status;
  }
}
export function must(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new Rejected(message, status);
}
export function requireRole(role: Role, ...kinds: Role['kind'][]) {
  if (!kinds.includes(role.kind)) throw new Rejected('Forbidden role', 403);
}
export function own(role: Role, ngo: string) {
  if (role.kind === 'ngo' && role.ngo?.toLowerCase() !== ngo.toLowerCase())
    throw new Rejected('Other organization', 403);
}
export async function now() {
  return Number((await client.getBlock()).timestamp);
}
export function assessment(a: App) {
  return {
    ngo: a.ngo as Address,
    incident: hash(a.incident),
    areaVersion: 1n,
    modelVersion: hash(MODEL_VERSION),
    sources: a.sources as Hex,
    maximum: BigInt(a.maximum),
    expires: BigInt(a.expires),
    nonce: BigInt(a.nonce),
    deadlineDays: BigInt(a.deadlineDays),
  };
}
export function request(a: App) {
  return {
    requested: BigInt(a.requested),
    capacity: BigInt(a.capacity),
    externalFunding: BigInt(a.external),
    conflicts: a.conflicts,
    newEvidence: !!a.change,
  };
}
export function model(s: State, incident: string, time: number, ngo?: string) {
  const i = s.incidents.find((x) => x.id === incident);
  must(i, 'Unknown incident');
  const people = ngo
    ? (i.people.map(
        (total) =>
          Math.floor(total / 3) +
          (s.roles
            .filter((r) => r.kind === 'ngo')
            .findIndex((r) => r.ngo === ngo) <
          total % 3
            ? 1
            : 0),
      ) as [number, number])
    : i.people;
  return estimate(
    {
      hazard: i.hazard,
      service: 'essential-relief',
      kind: 'actual',
      time,
      people,
      features: i.features,
      synthetic: true,
    },
    syntheticCases,
  );
}
export async function submit(
  s: State,
  role: Role,
  input: {
    incident: string;
    requested: string;
    capacity: string;
    external: string;
    explanation: string;
    change: string;
    conflicts: number;
  },
) {
  requireRole(role, 'ngo');
  const time = await now();
  const incident = s.incidents.find((x) => x.id === input.incident);
  must(incident, 'Unknown incident');
  must(
    !s.apps.some(
      (a) =>
        a.ngo === role.ngo &&
        a.incident === input.incident &&
        ['submitted', 'reviewed'].includes(a.status),
    ),
    'One open application per NGO/incident',
  );
  const previous = s.apps
    .filter((a) => a.ngo === role.ngo && a.incident === input.incident)
    .at(-1);
  must(
    !previous ||
      previous.status !== 'rejected' ||
      time >= previous.createdAt + POLICY.cooldownSeconds ||
      input.change.length >= 20,
    'Repeat cooldown requires material evidence',
  );
  const m = model(s, input.incident, time, role.ngo);
  const maximum = m.demoMaximum ?? POLICY.cap.toString();
  for (const x of [input.requested, input.capacity, input.external])
    must(/^\d{1,12}$/.test(x), 'Integer token subunits required');
  must(
    BigInt(input.requested) > 0n &&
      BigInt(input.requested) <= BigInt(maximum) &&
      BigInt(input.capacity) > 0n &&
      BigInt(input.capacity) <= BigInt(maximum),
    'Requested amount or capacity exceeds proposed maximum',
  );
  must(
    input.explanation.trim().length >= 20,
    'Document a manual data-review rationale',
  );
  const a: App = {
    id: randomUUID(),
    version: 1,
    ngo: role.ngo!,
    incident: input.incident,
    requested: input.requested,
    capacity: input.capacity,
    external: input.external,
    explanation: input.explanation,
    change: input.change,
    conflicts: input.conflicts,
    nonce: s.apps.length + 1,
    createdAt: time,
    expires: time + 7 * 86400,
    maximum,
    deadlineDays: deadlineDays(incident.hazard, false),
    sources: commitment({
      model: m,
      incident,
      coverage: s.coverage,
      explanation: input.explanation,
      change: input.change,
      registry: s.registryVersion,
      workPackage: s.packages.find(
        (p) => p.ngo === role.ngo && p.areaId === incident.areaId,
      ),
    }),
    votes: [],
    status: 'submitted',
  };
  s.apps.push(a);
  return a;
}
export function noConflict(s: State, role: Role, id: string) {
  must(
    !s.conflicts.some((c) => c.roleId === role.id && c.target === id),
    'Recused reviewer cannot approve',
    403,
  );
}
export async function approveApplication(s: State, role: Role, id: string) {
  noConflict(s, role, id);
  requireRole(role, 'data');
  const a = s.apps.find((x) => x.id === id);
  must(a, 'Application missing', 404);
  must(
    a.status === 'submitted' &&
      (!a.votes.includes(role.id) || a.votes.length >= 2),
    'Already voted or closed',
  );
  if (!a.votes.includes(role.id)) a.votes.push(role.id);
  if (a.votes.length >= 2) {
    const c = await chain();
    const data = assessment(a),
      r = request(a);
    const ah = (await c.read('assessmentHash', [data])) as Hex;
    const key = (await c.read('keyFor', [data.ngo, data.incident])) as Hex;
    const existing = (await c.read('openApplication', [key])) as bigint;
    if (existing > 0n) {
      const current = (await c.read('applications', [existing])) as unknown[];
      must(current[1] === ah, 'Different application already on chain');
      a.chainId = Number(existing);
    } else {
      const sigs = await c.sign(
        'APPLICATION',
        encode(`bytes32,${requestType}`, [ah, r]),
        a.votes.map((v) => s.roles.find((x) => x.id === v)!.index),
      );
      a.tx = await c.send(
        'open',
        [data, r, sigs],
        s.roles.find((x) => x.ngo === a.ngo)!.index,
      );
      a.chainId = Number(await c.read('applicationCount'));
    }
    a.status = 'reviewed';
  }
  return a;
}
export async function allocationSnapshot(s: State, draft?: App) {
  const c = await chain(),
    block = await client.getBlock({ blockTag: 'latest' });
  const time = Number(block.timestamp),
    blockNumber = block.number;
  const balance = await c.balance(blockNumber),
    reserved = (await c.read('totalReserved', [], blockNumber)) as bigint;
  const nonce = Number(await c.read('roundNonce', [], blockNumber));
  const states = s.areas.map((a) => ({
    area: a.id,
    situation: situation(a, s.coverage, time),
  }));
  const uncertain = states.some(
    (x) => x.situation === 'unknown' || x.situation === 'conflicting',
  );
  const competing = s.incidents.length > 1;
  const participants: Participant[] = [];
  // All registered NGO operating packages, including competitors with no application.
  for (const ngo of s.roles.filter((r) => r.kind === 'ngo'))
    for (const incident of s.incidents) {
      const app =
        (draft && draft.ngo === ngo.ngo && draft.incident === incident.id
          ? draft
          : undefined) ??
        s.apps.find(
          (a) =>
            a.ngo === ngo.ngo &&
            a.incident === incident.id &&
            a.status === 'reviewed',
        );
      const max = BigInt(
        app?.maximum ??
          model(s, incident.id, time, ngo.ngo).demoMaximum ??
          POLICY.cap,
      );
      const key = await c.read(
        'keyFor',
        [ngo.ngo, hash(incident.id)],
        blockNumber,
      );
      const paid = (await c.read('paidFor', [key], blockNumber)) as bigint;
      const committed = (await c.read(
        'reservedFor',
        [key],
        blockNumber,
      )) as bigint;
      let authorized = true;
      if (app?.chainId) {
        const onchain = (await c.read(
          'applications',
          [BigInt(app.chainId)],
          blockNumber,
        )) as unknown[];
        authorized = Boolean(onchain[10]);
      }
      participants.push({
        id: `${ngo.id}/${incident.id}`,
        ngo: ngo.ngo!,
        incident: incident.id,
        weight:
          max > paid + committed + BigInt(app?.external ?? 0)
            ? max - paid - committed - BigInt(app?.external ?? 0)
            : 0n,
        maximum: max,
        requested: app && authorized ? BigInt(app.requested) : null,
        capacity: BigInt(app?.capacity ?? max),
        paid,
        reserved: committed,
        external: BigInt(app?.external ?? 0),
        blocked: (await c.read('isBlocked', [ngo.ngo], blockNumber)) as boolean,
      });
    }
  const result = allocate(
    participants,
    balance,
    reserved,
    uncertain,
    competing,
  );
  return {
    result,
    states,
    participants,
    balance,
    reserved,
    time,
    uncertain,
    competing,
    nonce,
  };
}
export async function prepareRound(s: State, role: Role) {
  requireRole(role, 'data');
  const {
    result,
    states,
    participants,
    uncertain,
    competing,
    balance,
    reserved,
    time,
    nonce,
  } = await allocationSnapshot(s);
  const pending = s.rounds.find(
    (r) => r.nonce === nonce && !r.tx && r.expires > time,
  );
  if (pending) return pending;
  const grants = result.rows
    .filter((r) => !r.provisional && BigInt(r.amount) > 0n)
    .map((r) => {
      const app = s.apps.find(
        (a) =>
          a.ngo === r.ngo &&
          a.incident === r.incident &&
          a.status === 'reviewed',
      )!;
      return { application: String(app.chainId), amount: r.amount };
    });
  const provisional = result.rows
    .filter((r) => r.provisional)
    .reduce((sum, r) => sum + BigInt(r.amount), 0n);
  const round: Round = {
    id: randomUUID(),
    version: 1,
    createdAt: time,
    expires: time + 3600,
    nonce,
    balance: balance.toString(),
    reserved: reserved.toString(),
    uncertain,
    competing,
    provisional: String(provisional),
    snapshot: commitment({
      result,
      states,
      participants,
      nonce,
      time,
      registry: s.registryVersion,
    }),
    grants,
    explanation: {
      result,
      states,
      rule: 'Provisional no-application shares remain held for 24h; no empirical truth claimed',
    },
    votes: [],
  };
  s.rounds.push(round);
  return round;
}
export async function approveRound(s: State, role: Role, id: string) {
  noConflict(s, role, id);
  requireRole(role, 'data');
  const r = s.rounds.find((x) => x.id === id);
  must(r, 'Round missing', 404);
  must(
    !r.tx && !r.votes.includes(role.id) && r.expires >= (await now()),
    'Round expired or already voted',
  );
  r.votes.push(role.id);
  if (r.votes.length >= 2) {
    const c = await chain();
    const data = {
      snapshot: r.snapshot as Hex,
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
    const sigs = await c.sign(
      'ROUND',
      encode(`(uint256 application,uint256 amount)[],${roundType}`, [
        grants,
        data,
      ]),
      r.votes.map((v) => s.roles.find((x) => x.id === v)!.index),
    );
    r.tx = await c.send('closeRound', [grants, data, sigs]);
    for (const g of grants) {
      const app = s.apps.find((a) => a.chainId === Number(g.application));
      if (app) app.status = 'reserved';
    }
  }
  return r;
}
export async function chainEvidence(blockNumber?: bigint) {
  const c = await chain(),
    count = Number(await c.read('evidenceCount', [], blockNumber));
  const list = [];
  for (let id = 1; id <= count; id++) {
    const x = (await c.read(
      'evidence',
      [BigInt(id)],
      blockNumber,
    )) as readonly unknown[];
    list.push({
      id,
      ngo: String(x[0]),
      key: String(x[1]),
      amount: String(x[2]),
      paidAt: Number(x[3]),
      interimDue: Number(x[3]) + 7 * 86400,
      due: Number(x[4]),
      responseDue: Number(x[5]),
      manifest: String(x[6]),
      status: Number(x[7]),
      extended: Boolean(x[8]),
      decisionAt: Number(x[9]),
      appealAt: Number(x[10]),
    });
  }
  return list;
}
export async function reservations() {
  const c = await chain(),
    count = Number(await c.read('reservationCount'));
  const list = [];
  for (let id = 1; id <= count; id++) {
    const x = (await c.read('reservations', [BigInt(id)])) as unknown[];
    const app = (await c.read('applications', [x[0]])) as unknown[];
    list.push({
      id,
      application: Number(x[0]),
      ngo: String(app[2]),
      amount: String(x[1]),
      expires: Number(x[2]),
      settled: Boolean(x[4]),
    });
  }
  return list;
}
export async function proposeReview(
  s: State,
  role: Role,
  input: {
    kind: Review['kind'];
    evidenceId: number;
    reason: string;
    decision: number;
    days: number;
    applicationId?: string;
  },
) {
  if (input.kind === 'resolve') requireRole(role, 'appeal');
  else requireRole(role, 'evidence');
  const time = await now();
  let manifest = '0x' + '0'.repeat(64);
  let receivedAt = time;
  if (input.kind !== 'followup') {
    const e = (await chainEvidence()).find((x) => x.id === input.evidenceId);
    must(e, 'Evidence missing', 404);
    manifest = e.manifest;
    if (input.kind === 'receipt') {
      const docs = s.documents.filter(
        (d) =>
          d.evidenceId === e.id &&
          d.uploaded &&
          d.category !== 'external-review',
      );
      must(docs.length > 0, 'Upload synthetic evidence first');
      manifest = commitment(
        docs.map((d) => ({ id: d.id, digest: d.digest, salt: d.salt })),
      );
      receivedAt = Math.max(...docs.map((d) => d.createdAt));
    }
  } else
    must(
      s.apps.some((a) => a.id === input.applicationId && a.chainId),
      'Application missing',
    );
  must(input.reason.length >= 20, 'Document checks and conflict declaration');
  const duplicate = s.reviews.find(
    (r) =>
      !r.tx &&
      !r.superseded &&
      r.kind === input.kind &&
      r.evidenceId === input.evidenceId &&
      r.applicationId === input.applicationId,
  );
  must(!duplicate, 'Open review already exists');
  const review: Review = {
    ...input,
    id: randomUUID(),
    manifest,
    receivedAt,
    votes: [],
  };
  s.reviews.push(review);
  return review;
}
export async function approveReview(s: State, role: Role, id: string) {
  noConflict(s, role, id);
  const r = s.reviews.find((x) => x.id === id);
  must(r, 'Review missing', 404);
  requireRole(role, r.kind === 'resolve' ? 'appeal' : 'evidence');
  must(!r.tx && !r.votes.includes(role.id), 'Already voted');
  r.votes.push(role.id);
  if (r.votes.length >= 2) {
    const c = await chain(),
      eid = BigInt(r.evidenceId);
    const e = (await chainEvidence()).find((x) => x.id === r.evidenceId);
    let payload: Hex;
    let purpose: string;
    let args: unknown[];
    switch (r.kind) {
      case 'receipt':
        purpose = 'RECEIPT';
        payload = encode('uint256,bytes32,uint256', [
          eid,
          r.manifest,
          BigInt(r.receivedAt),
        ]);
        args = [eid, r.manifest, BigInt(r.receivedAt)];
        break;
      case 'review':
        purpose = 'REVIEW';
        payload = encode('uint256,bytes32,uint8,bytes32', [
          eid,
          e!.manifest,
          r.decision,
          hash(r.reason),
        ]);
        args = [eid, r.decision, hash(r.reason)];
        break;
      case 'extend':
        purpose = 'EXTEND';
        payload = encode('uint256,uint256,uint256,bytes32', [
          eid,
          BigInt(e!.due),
          BigInt(r.days),
          hash(r.reason),
        ]);
        args = [eid, BigInt(r.days), hash(r.reason)];
        break;
      case 'resolve':
        purpose = 'RESOLVE';
        payload = encode('uint256,bytes32,uint8,uint256,bytes32', [
          eid,
          e!.manifest,
          e!.status,
          BigInt(e!.due),
          hash(r.reason),
        ]);
        args = [eid, hash(r.reason)];
        break;
      case 'followup': {
        const app = s.apps.find((a) => a.id === r.applicationId)!;
        purpose = 'FOLLOWUP';
        payload = encode('uint256,bytes32', [
          BigInt(app.chainId!),
          await c.read('assessmentHash', [assessment(app)]),
        ]);
        args = [BigInt(app.chainId!)];
        break;
      }
    }
    const sigs = await c.sign(
      purpose,
      payload,
      s.roles.filter((x) => r.votes.includes(x.id)).map((x) => x.index),
    );
    r.tx = await c.send(
      r.kind === 'followup'
        ? 'authorizeFollowup'
        : r.kind === 'receipt'
          ? 'receipt'
          : r.kind === 'review'
            ? 'review'
            : r.kind === 'extend'
              ? 'extend'
              : 'resolve',
      [...args, sigs],
    );
  }
  return r;
}
