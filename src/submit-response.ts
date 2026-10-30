import { readFile } from 'node:fs/promises';
import { toHex } from 'viem';
import { artifact, confirmed, deployment, ngoIndex, option, publicClient, wallet } from './deployment.ts';
import type { SignedResponse } from './vendor/airnode-v2.ts';

const config = await deployment();
const { abi } = await artifact('DisasterFund');
const response: SignedResponse = JSON.parse(await readFile(option('--file', 'fixtures/usgs-real.json')!, 'utf8'));
const client = wallet();
const args = [config.ngos[ngoIndex()]!, BigInt(response.timestamp), toHex(response.data), response.signature];
// Intentionally NO off-chain attestation check: the deployed contract must reject tampering itself.
const call = { address: config.fund, abi, functionName: 'claim', args, account: client.account } as const;
if (process.argv.includes('--simulate')) {
  await publicClient.simulateContract(call);
  console.log('Contract simulation accepted. No transaction was sent.');
} else {
  await publicClient.simulateContract(call);
  await confirmed(await client.writeContract(call));
  console.log('Fixed grant paid to', args[0]);
}
