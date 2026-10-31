import {
  BaseError,
  ContractFunctionRevertedError,
  toHex,
  type Address,
} from 'viem';
import { randomBytes } from 'node:crypto';
import { hash } from '../src/v3/chain.ts';
import { chain, client } from '../src/v3/chain.ts';
import type { SignedResponse } from '../src/vendor/airnode-v2.ts';
import { oraclePolicies, incidentIds } from '../src/v3/oracle.ts';
export async function juryConfig() {
  const c = await chain();
  return {
    ...c.config,
    policies: oraclePolicies().map((p, i) => ({
      ...p,
      incidentId: incidentIds[i],
    })),
  };
}
/** Deliberately no signature/freshness precheck. Only a decoded EVM revert is a rejection. */
export async function jurySimulate(
  proof: SignedResponse,
  slot: number,
  ngo: number,
) {
  const c = await chain();
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const request = {
    slot: BigInt(slot),
    requested: 500_000_000n,
    capacity: 500_000_000n,
    externalFunding: 0n,
    timestamp: BigInt(proof.timestamp),
    data: toHex(proof.data),
    signature: proof.signature,
  };
  const key = await c.read(
    'keyFor',
    [c.config.ngos[ngo], oraclePolicies()[slot]!.incident],
    block,
  );
  const application = (await c.read('openApplication', [key], block)) as bigint;
  const pending =
    application > 0n &&
    (await c.read('automaticApplication', [application], block));
  const functionName = pending ? 'automaticReserve' : 'automaticSubmit';
  if (pending) {
    const app = (await c.read(
      'applications',
      [application],
      block,
    )) as unknown[];
    request.requested = app[3] as bigint;
    request.capacity = app[4] as bigint;
    request.externalFunding = app[5] as bigint;
  }
  const args = pending
    ? [application, request]
    : [
        request,
        hash('Jury simulation: essential relief supplies'),
        hash(randomBytes(32).toString('hex')),
      ];
  try {
    const simulation = await client.simulateContract({
      address: c.config.fund,
      abi: c.fundAbi,
      functionName,
      account: c.config.ngos[ngo] as Address,
      args,
      blockNumber: block,
    });
    const result = simulation.result;
    return {
      accepted: true,
      functionName,
      block: String(block),
      execution: 'eth_call',
      fund: c.config.fund,
      chainId: c.config.chainId,
      result: JSON.parse(
        JSON.stringify(result, (_k, v) =>
          typeof v === 'bigint' ? String(v) : v,
        ),
      ),
    };
  } catch (error) {
    if (error instanceof BaseError) {
      const revert = error.walk(
        (e) => e instanceof ContractFunctionRevertedError,
      );
      if (
        revert instanceof ContractFunctionRevertedError &&
        revert.data?.errorName
      )
        return {
          accepted: false,
          functionName,
          block: String(block),
          execution: 'eth_call',
          fund: c.config.fund,
          chainId: c.config.chainId,
          revert: revert.data.errorName,
        };
    }
    throw error;
  }
}
export async function juryTamper(
  genuine: SignedResponse,
  old: SignedResponse,
  other: SignedResponse,
  slot: number,
  ngo: number,
) {
  const { tamperCases } = await import('../src/v3/jury-cases.ts');
  const { verifySignedResponse } = await import('../src/vendor/airnode-v2.ts');
  const p = oraclePolicies()[slot]!;
  // Establish that auxiliary fixtures really are original Airnode responses, without editing their timestamps.
  await verifySignedResponse(old, p.airnode, p.requestHash);
  await verifySignedResponse(other, p.airnode, other.requestHash);
  const c = await chain();
  const before = String(await c.read('totalPaid'));
  const positive = await jurySimulate(genuine, slot, ngo);
  if (!positive.accepted)
    throw new Error(
      'Positive control failed; tamper results would be misleading',
    );
  const results = [];
  for (const test of await tamperCases(genuine, old, other, p.requestHash)) {
    const result = await jurySimulate(test.proof, slot, ngo);
    const passed =
      !result.accepted && 'revert' in result && result.revert === test.expected;
    results.push({
      name: test.name,
      expected: test.expected,
      ...result,
      passed,
    });
  }
  const unchanged = String(await c.read('totalPaid')) === before;
  return {
    positive,
    results,
    unchanged,
    passed: unchanged && results.every((r) => r.passed),
  };
}
