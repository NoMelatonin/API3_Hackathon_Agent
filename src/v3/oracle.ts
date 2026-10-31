import { encodePacked, keccak256, toHex, type Hex } from 'viem';
import { oracleMode } from './profile.ts';
import { readPrivateKey } from '../private-key.ts';
import { createPayingFetch } from '../vendor/x402.ts';
import { account, hash } from './chain.ts';
import { campaigns, campaignHashes } from '../campaigns.ts';
import {
  fetchSignedResponse,
  verifySignedResponse,
  type SignedResponse,
} from '../vendor/airnode-v2.ts';
export const incidentIds = [
  'demo-quake',
  'demo-storm',
  'demo-flood',
  'demo-health',
];
export function oraclePolicies() {
  const live = oracleMode === 'live';
  return incidentIds.map((id, kind) => {
    const c = kind < 2 ? campaigns[kind]! : undefined;
    return {
      incident: hash(id),
      airnode: live ? (c ?? campaigns[0]).signer : account(30).address,
      requestHash:
        live && c ? campaignHashes[kind]! : hash('synthetic-v3-policy-1/' + id),
      eventId: hash(
        live && c ? (kind === 0 ? 'us6000jllz' : 'EONET_22386') : id,
      ),
      kind,
      synthetic: !live,
      enabled: !live || kind < 2,
      observedFrom:
        live && kind === 0 ? 1675641600 : live && kind === 1 ? 1786341600 : 0,
      observedUntil:
        live && kind === 0 ? 1675727999 : live && kind === 1 ? 1786341600 : 0,
    };
  });
}
const cached = new Map<string, SignedResponse>();
const pending = new Map<string, Promise<SignedResponse>>();
export async function oracleResponse(
  incident: string,
): Promise<SignedResponse> {
  if (oracleMode === 'synthetic') return obtainResponse(incident);
  const { client } = await import('./chain.ts');
  const time = (await client.getBlock()).timestamp;
  const old = cached.get(incident);
  if (
    old &&
    BigInt(old.timestamp) <= time &&
    time - BigInt(old.timestamp) <= 120n
  )
    return old;
  if (pending.has(incident)) return pending.get(incident)!;
  const task = obtainResponse(incident).then((r) => {
    cached.set(incident, r);
    return r;
  });
  pending.set(incident, task);
  try {
    return await task;
  } finally {
    pending.delete(incident);
  }
}
async function obtainResponse(incident: string): Promise<SignedResponse> {
  const kind = incidentIds.indexOf(incident);
  if (kind < 0) throw new Error('Unknown oracle incident');
  const policy = oraclePolicies()[kind]!;
  if (!policy.enabled)
    throw new Error('No suitable signed source; use external review');
  if (!policy.synthetic) {
    const c = campaigns[kind]!;
    const paid = process.env.PAYER_PRIVATE_KEY
      ? createPayingFetch(readPrivateKey(process.env.PAYER_PRIVATE_KEY))
      : fetch;
    const response = await fetchSignedResponse(c.url, c.request, (url, init) =>
      paid(url, { ...init, signal: AbortSignal.timeout(60000) }),
    );
    await verifySignedResponse(response, policy.airnode, policy.requestHash);
    return response;
  }
  const { client } = await import('./chain.ts');
  const timestamp = String((await client.getBlock()).timestamp);
  const overrides = JSON.parse(process.env.V3_DEMO_SEVERITY ?? '{}') as Record<
    string,
    number
  >;
  const severity = overrides[incident] ?? [7.1, 40, 2, 2][kind]!;
  if (!Number.isFinite(severity) || severity < 0)
    throw new Error('Invalid demo severity');
  const data = JSON.stringify({
    eventId: incident,
    severity,
    unit: ['magnitude', 'kts', 'level', 'level'][kind],
    latitude: [37, 14, -18, -18][kind],
    longitude: [37, 122, 35, 35][kind],
    observedAt: timestamp,
    synthetic: true,
  });
  const requestHash = policy.requestHash;
  const signature = await account(30).signMessage({
    message: {
      raw: keccak256(
        encodePacked(
          ['bytes32', 'uint256', 'bytes'],
          [requestHash, BigInt(timestamp), toHex(data)],
        ),
      ),
    },
  });
  return {
    airnode: policy.airnode,
    requestHash,
    timestamp,
    data,
    signature,
  };
}
