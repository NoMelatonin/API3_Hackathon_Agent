import { encodePacked, keccak256, toHex, type Hex } from 'viem';
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
  const live = process.env.V3_ORACLE_MODE === 'live';
  return incidentIds.map((id, kind) => {
    const c = kind < 2 ? campaigns[kind]! : undefined;
    return {
      incident: hash(id),
      airnode: live && c ? c.signer : account(30).address,
      requestHash:
        live && c
          ? campaignHashes[kind]!
          : hash('synthetic-v3-policy-1/' + id),
      eventId: hash(
        live && c ? (kind === 0 ? 'us6000jllz' : 'EONET_22386') : id,
      ),
      kind,
      synthetic: !live,
      enabled: !live || kind < 2,
    };
  });
}
export async function oracleResponse(
  incident: string,
): Promise<SignedResponse> {
  const kind = incidentIds.indexOf(incident);
  if (kind < 0) throw new Error('Unknown oracle incident');
  const policy = oraclePolicies()[kind]!;
  if (!policy.enabled)
    throw new Error('No suitable signed source; use external review');
  if (!policy.synthetic) {
    const c = campaigns[kind]!;
    const response = await fetchSignedResponse(
      c.url,
      c.request,
      (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(15000) }),
    );
    await verifySignedResponse(
      response,
      policy.airnode,
      policy.requestHash,
    );
    return response;
  }
  const { client } = await import('./chain.ts');
  const timestamp = String((await client.getBlock()).timestamp);
  const overrides = JSON.parse(
    process.env.V3_DEMO_SEVERITY ?? '{}',
  ) as Record<string, number>;
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
