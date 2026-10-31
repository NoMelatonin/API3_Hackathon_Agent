import type { SignedResponse } from '../src/vendor/airnode-v2.ts';
import { chain, client, hash } from '../src/v3/chain.ts';
import {
  incidentIds,
  oracleResponse,
  oraclePolicies,
} from '../src/v3/oracle.ts';
import type { State, Role, App } from './state.ts';
import { must, requireRole, now } from './service.ts';
import {
  toHex,
  toFunctionSelector,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  type Address,
} from 'viem';
export type AutomaticInput = {
  proof?: SignedResponse;
  incident: string;
  requested: string;
  capacity: string;
  external: string;
};
export type AutomaticSubmission = AutomaticInput & {
  explanation: string;
  requestId: string;
};
export async function automaticPreview(role: Role, input: AutomaticInput) {
  requireRole(role, 'ngo');
  const slot = incidentIds.indexOf(input.incident);
  must(slot >= 0, 'Unknown incident');
  for (const v of [input.requested, input.capacity, input.external])
    must(/^\d{1,12}$/.test(v), 'Integer token subunits required');
  must(
    BigInt(input.requested) > 0n &&
      BigInt(input.requested) <= 4500_000000n &&
      BigInt(input.capacity) > 0n &&
      BigInt(input.capacity) <= 4500_000000n,
    'Amount exceeds fixed policy',
  );
  const c = await chain();
  const [amount, provisional, nextRound] = (await client.readContract({
    address: c.config.fund,
    abi: c.fundAbi,
    functionName: 'automaticQuote',
    account: role.ngo as Address,
    args: [
      BigInt(slot),
      BigInt(input.requested),
      BigInt(input.capacity),
      BigInt(input.external),
    ],
  })) as [bigint, bigint, bigint];
  const key = await c.read('keyFor', [role.ngo, hash(input.incident)]);
  let available = false,
    authorized = false,
    severity = '0';
  let sourceStatus = 'unavailable';
  let source: Record<string, unknown> = {};
  let signedAt: number | null = null;
  const synthetic = oraclePolicies()[slot]!.synthetic;
  try {
    const response = input.proof ?? (await oracleResponse(input.incident));
    signedAt = Number(response.timestamp);
    source = JSON.parse(response.data);
    const result = (await client.readContract({
      address: c.config.fund,
      abi: c.fundAbi,
      functionName: 'automaticEligibility',
      account: role.ngo as Address,
      args: [
        {
          slot: BigInt(slot),
          requested: BigInt(input.requested),
          capacity: BigInt(input.capacity),
          externalFunding: BigInt(input.external),
          timestamp: BigInt(response.timestamp),
          data: toHex(response.data),
          signature: response.signature,
        },
      ],
    })) as [boolean, bigint];
    available = true;
    authorized = result[0];
    severity = String(result[1]);
    sourceStatus = 'eligible';
  } catch (error) {
    const message = String(error);
    sourceStatus = message.includes('responded with 402')
      ? 'payment_required'
      : message.includes('ObservationStale') ||
          message.includes(toFunctionSelector('ObservationStale()'))
        ? 'observation_stale'
        : message.includes('OracleStale') ||
            message.includes(toFunctionSelector('OracleStale()'))
          ? 'signature_stale'
          : message.includes('FundingRuleNotMet') ||
              message.includes(toFunctionSelector('FundingRuleNotMet()'))
            ? 'rule_not_met'
            : signedAt !== null
              ? 'invalid_proof'
              : 'unavailable';
  }
  const balance = BigInt(String(await c.read('effectiveReserved')));
  const total = await c.balance();
  const uncertain = Boolean(((await c.read('sharedQuote')) as unknown[])[2]);
  return {
    remaining: String(
      4050_000000n >
        BigInt(String(await c.read('paidFor', [key]))) +
          BigInt(String(await c.read('reservedFor', [key]))) +
          BigInt(input.external)
        ? 4050_000000n -
            BigInt(String(await c.read('paidFor', [key]))) -
            BigInt(String(await c.read('reservedFor', [key]))) -
            BigInt(input.external)
        : 0n,
    ),
    fundFree: String(total - balance),
    uncertaintyReserve: String(
      uncertain ? ((total - balance) * 20n) / 100n : 0n,
    ),
    amount: String(amount),
    provisional: String(provisional),
    nextRound: Number(nextRound),
    chainTime: await now(),
    blocked: await c.read('isBlocked', [role.ngo]),
    paid: String(await c.read('paidFor', [key])),
    peak: String(await c.read('peak', [key])),
    synthetic,
    available,
    authorized,
    severity,
    sourceStatus,
    source: {
      signer: oraclePolicies()[slot]!.airnode,
      requestHash: oraclePolicies()[slot]!.requestHash,
      eventId: source.eventId ?? input.incident,
      observedAt: source.observedAt ?? source.eventTime ?? null,
      signedAt,
      unit: source.unit ?? (slot === 0 ? 'magnitude' : 'kts'),
    },
    rule: ['magnitude ≥ 7.0', 'wind ≥ 34 kts', 'level ≥ 2', 'level ≥ 2'][slot],
  };
}
function request(
  input: AutomaticInput,
  proof: Awaited<ReturnType<typeof oracleResponse>>,
) {
  return {
    slot: BigInt(incidentIds.indexOf(input.incident)),
    requested: BigInt(input.requested),
    capacity: BigInt(input.capacity),
    externalFunding: BigInt(input.external),
    timestamp: BigInt(proof.timestamp),
    data: toHex(proof.data),
    signature: proof.signature,
  };
}
export async function automaticSubmit(
  s: State,
  role: Role,
  input: AutomaticSubmission,
) {
  requireRole(role, 'ngo');
  must(
    input.explanation.trim().length >= 20 && input.explanation.length <= 2000,
    'Describe the intended use (20–2000 characters)',
  );
  must(/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId), 'Request ID required');
  const retry = keccak256(
    encodeAbiParameters(parseAbiParameters('address,bytes32'), [
      role.ngo as Address,
      hash(input.requestId),
    ]),
  );
  const previous = s.apps.find((a) => a.automatic && a.id === input.requestId);
  if (previous) {
    must(
      previous.ngo === role.ngo &&
        ['incident', 'requested', 'capacity', 'external', 'explanation'].every(
          (k) =>
            previous[k as keyof App] === input[k as keyof AutomaticSubmission],
        ),
      'Request ID content changed',
      409,
    );
    const c = await chain();
    if (
      previous.chainId &&
      Number(await c.read('submittedRequest', [retry])) === previous.chainId
    )
      return { application: previous.id, tx: previous.tx };
  }
  const preview = await automaticPreview(role, input);
  must(
    preview.available,
    'No suitable current signed source; use external review',
  );
  must(!preview.blocked, 'NGO blocked by evidence obligations');
  const c = await chain();
  const proof = input.proof ?? (await oracleResponse(input.incident));
  const tx = await c.send(
    'automaticSubmit',
    [request(input, proof), hash(input.explanation), hash(input.requestId)],
    role.index,
  );
  const id = Number(await c.read('submittedRequest', [retry]));
  const a = (await c.read('assessments', [BigInt(id)])) as unknown[];
  const onchain = (await c.read('applications', [BigInt(id)])) as unknown[];
  const record: App = {
    id: input.requestId,
    version: 1,
    ngo: role.ngo!,
    ...input,
    change: '',
    conflicts: 0,
    nonce: Number(a[7]),
    createdAt: Number(onchain[6]),
    expires: Number(a[6]),
    maximum: String(a[5]),
    deadlineDays: Number(a[8]),
    sources: String(a[4]),
    votes: [],
    chainId: id,
    status: 'reviewed',
    automatic: true,
    oracleProof: proof,
    tx,
  };
  if (previous) Object.assign(previous, record);
  else s.apps.push(record);
  return { application: input.requestId, tx };
}
export async function automaticReserve(
  s: State,
  role: Role,
  id: string,
  supplied?: SignedResponse,
) {
  requireRole(role, 'ngo');
  const app = s.apps.find((a) => a.id === id && a.automatic);
  must(app && app.ngo === role.ngo && app.chainId, 'Application missing', 404);
  const c = await chain();
  must(
    (await c.read('purposeHash', [BigInt(app.chainId)])) ===
      hash(app.explanation),
    'Application changed or reorganized; refresh the case',
    409,
  );
  const existing = Number(
    await c.read('automaticReservation', [BigInt(app.chainId)]),
  );
  if (existing) return { reservation: existing };
  const proof = supplied ?? (await oracleResponse(app.incident));
  const preview = await automaticPreview(role, { ...app, proof });
  must(
    preview.available,
    'No suitable current signed source; use external review',
  );
  must(!preview.blocked, 'NGO blocked by evidence obligations');
  must(preview.authorized, 'Two peer NGO approvals required');
  must(
    preview.chainTime >= preview.nextRound,
    `Next round: ${preview.nextRound}`,
  );
  const tx = await c.send(
    'automaticReserve',
    [BigInt(app.chainId), request(app, proof)],
    role.index,
  );
  app.status = 'reserved';
  return {
    reservation: Number(
      await c.read('automaticReservation', [BigInt(app.chainId)]),
    ),
    tx,
  };
}
