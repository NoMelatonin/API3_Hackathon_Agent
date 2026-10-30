import { encodeDeployData, formatEther } from 'viem';
import { artifact, deployment, local, publicClient } from './deployment.ts';
import { AIRNODE_SIGNER, REQUEST_HASH } from './usgs.ts';

const config = await deployment();
const { abi } = await artifact('DisasterFund');
// eth_call simulates creation without broadcasting. This reconstructs the full runtime,
// including constructor-bound immutables, rather than trusting ABI-compatible getters alone.
for (const [name, address, args] of [
  ['DemoUSD', config.token, [config.deployer]],
  ['DisasterFund', config.fund, [config.token, AIRNODE_SIGNER, REQUEST_HASH, config.ngos, config.committee]],
] as const) {
  const compiled = await artifact(name);
  const [{ data: expected }, actual] = await Promise.all([
    publicClient.call({ account: config.deployer, data: encodeDeployData({ ...compiled, args: [...args] }) }),
    publicClient.getCode({ address }),
  ]);
  if (!expected || expected === '0x' || actual?.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Deployed runtime does not match locally compiled ${name}`);
  }
  console.log(`PASS: ${name} runtime bytecode including immutables matches the local build.`);
}
const read = (functionName: string, args?: unknown[]) => publicClient.readContract({ address: config.fund, abi, functionName, args });
for (const [name, expected] of [['airnode', AIRNODE_SIGNER], ['requestHash', REQUEST_HASH], ['token', config.token]] as const) {
  if (String(await read(name)).toLowerCase() !== expected.toLowerCase()) throw new Error(`Deployment mismatch: ${name}`);
}
for (let i = 0; i < 3; i++) {
  if (String(await read('ngos', [BigInt(i)])).toLowerCase() !== config.ngos[i]!.toLowerCase() ||
      String(await read('committee', [BigInt(i)])).toLowerCase() !== config.committee[i]!.toLowerCase()) throw new Error('Role mismatch');
}
if (!(await read('active'))) throw new Error('Fund is not activated');
console.log('PASS: deployed token, signer, request, NGOs, committee and activation match configuration.');
console.log('Total paid dUSD:', String(await read('totalPaid')));
let l2Cost = 0n, l1Cost = 0n;
for (const hash of Object.values(config.transactions)) {
  const receipt = await publicClient.getTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Deployment transaction failed: ${hash}`);
  l2Cost += receipt.gasUsed * receipt.effectiveGasPrice;
  // Base receipt extensions are exposed by the chain formatter.
  const fee = (receipt as unknown as { l1Fee?: bigint }).l1Fee;
  if (fee !== undefined) l1Cost += BigInt(fee);
}
console.log('Deployment L2 gas paid ETH:', formatEther(l2Cost));
console.log('Deployment L1 data fee ETH:', formatEther(l1Cost));
console.log('Current project wallet test ETH:', formatEther(await publicClient.getBalance({ address: config.deployer })));
if (!local) console.log('https://sepolia.basescan.org/address/' + config.fund);
