// Read-only verification of live Airnode responses; never signs a replacement or pays out.
import { readFile, writeFile } from 'node:fs/promises';
import { toHex } from 'viem';
import { chain, client } from './chain.ts';
import { oraclePolicies, oracleResponse, incidentIds } from './oracle.ts';
if (process.env.V3_ORACLE_MODE !== 'live')
  throw new Error('Use V3_ORACLE_MODE=live');
const c = await chain();
const address = (await c.read('oracleVerifier')) as `0x${string}`;
const { abi } = JSON.parse(
  await readFile('out/DisasterFundV3Auto.sol/V3OracleVerifier.json', 'utf8'),
);
const results = [];
for (const [i, policy] of oraclePolicies().entries()) {
  const result: Record<string, unknown> = {
    incident: incidentIds[i],
    checkedAt: new Date().toISOString(),
    synthetic: false,
    enabled: policy.enabled,
  };
  try {
    const r = await oracleResponse(incidentIds[i]!);
    result.signatureVerified = true;
    result.signedAt = r.timestamp;
    result.data = JSON.parse(r.data);
    await client.readContract({
      address,
      abi,
      functionName: 'verify',
      args: [policy, BigInt(r.timestamp), toHex(r.data), r.signature],
    });
    result.eligible = true;
  } catch (error) {
    result.eligible = false;
    result.error = String(error).slice(0, 1600);
  }
  results.push(result);
}
const report = {
  checkedAt: new Date().toISOString(),
  readOnly: true,
  payoutAttempted: false,
  results,
};
await writeFile(
  '.runtime/v3-live-check.json',
  JSON.stringify(report, null, 2) + '\n',
  { mode: 0o600 },
);
console.log(JSON.stringify(report, null, 2));
