import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { BaseError, ContractFunctionRevertedError, encodePacked, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { artifact, deployment, local, ngoIndex, option, publicClient } from './deployment.ts';
import { REQUEST_HASH } from './usgs.ts';
import type { SignedResponse } from './vendor/airnode-v2.ts';

const config = await deployment();
const { abi } = await artifact('DisasterFund');
const readResponse = async (file: string): Promise<SignedResponse> => JSON.parse(await readFile(file, 'utf8'));
const genuine = await readResponse(option('--file', 'fixtures/usgs-real.json')!);
const old = await readResponse(option('--old', 'fixtures/usgs-real.json')!);
const other = await readResponse(option('--other', 'fixtures/usgs-other.json')!);
const ngo = config.ngos[process.argv.includes('--ngo') ? ngoIndex() : 1]!;
const current = await publicClient.getBlock();
if (current.timestamp <= BigInt(old.timestamp) + 300n) {
  throw new Error('The genuine --old fixture is not yet over five minutes old on this chain. Wait; do not edit its timestamp.');
}
const editedData = genuine.data.replace('"magnitude":7.8', '"magnitude":9.8');
if (editedData === genuine.data) throw new Error('Expected real magnitude field not found; refusing a fake edited-value test');
if (other.requestHash === REQUEST_HASH) throw new Error('The --other fixture is not a different request');
const wrongKey = privateKeyToAccount(`0x${'1'.padStart(64, '0')}`); // Public, unfunded unit-test key.
const forged = await wrongKey.signMessage({ message: { raw: keccak256(encodePacked(
  ['bytes32', 'uint256', 'bytes'], [REQUEST_HASH, BigInt(genuine.timestamp), toHex(genuine.data)]
)) } });
const cases: [string, SignedResponse, string][] = [
  ['edited-value', { ...genuine, data: editedData }, 'NotSignedByAirnode'],
  ['too-old', old, 'ResponseTooOld'],
  ['another-request', other, 'NotSignedByAirnode'],
  ['wrong-key', { ...genuine, signature: forged }, 'NotSignedByAirnode'],
];
const total = () => publicClient.readContract({ address: config.fund, abi, functionName: 'totalPaid' }) as Promise<bigint>;
const before = await total();
const results = [];
for (const [name, response, expected] of cases) {
  let rejected = '';
  try {
    await publicClient.simulateContract({ address: config.fund, abi, functionName: 'claim',
      args: [ngo, BigInt(response.timestamp), toHex(response.data), response.signature], account: config.deployer });
  } catch (error) {
    if (error instanceof BaseError) {
      const revert = error.walk(e => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) rejected = revert.data?.errorName ?? '';
    }
    if (!rejected) throw error; // Network failures are not contract rejections.
  }
  if (rejected !== expected) throw new Error(`${name}: expected ${expected}, got ${rejected || 'ACCEPTED'}`);
  if (await total() !== before) throw new Error('Payment state changed during a rejection');
  console.log(`PASS ${name}: deployed contract reverted with ${rejected}; no payout.`);
  results.push({ name, rejected, execution: 'eth_call to deployed contract', noPayout: true });
}
await mkdir('deployments', { recursive: true });
await writeFile(`deployments/tamper-report${local ? '.local' : ''}.json`, JSON.stringify({
  chainId: config.chainId, fund: config.fund, block: current.number.toString(), results,
}, null, 2) + '\n');
