import { encodeFunctionData, keccak256, parseEther, toHex } from 'viem';
import { estimateL1Fee } from 'viem/op-stack';
import { privateKeyToAccount } from 'viem/accounts';
import { artifact, confirmed, deployment, local, ngoIndex, option, publicClient, wallet } from './deployment.ts';
import { readPrivateKey } from './private-key.ts';

const config = await deployment();
const { abi } = await artifact('DisasterFund');
const ngo = config.ngos[ngoIndex()]!;
const reason = option('--reason', 'Oracle unavailable; historical exercise; post-review required')!.trim();
if (!reason) throw new Error('A public, non-personal reason is required');
const reasonHash = keccak256(toHex(reason));
console.log('Public reason:', reason, '\nReason hash:', reasonHash);
if (await publicClient.readContract({ address: config.fund, abi, functionName: 'claimed', args: [ngo] })) {
  throw new Error('This NGO has already received its one grant.');
}
const payer = wallet();
for (const i of [1, 2]) {
  const account = privateKeyToAccount(readPrivateKey(process.env[`COMMITTEE_${i}_PRIVATE_KEY`]));
  if (account.address.toLowerCase() !== config.committee[i - 1]!.toLowerCase()) throw new Error('Local committee key does not match deployment');
  const mask = Number(await publicClient.readContract({ address: config.fund, abi, functionName: 'approvals', args: [ngo, reasonHash] }));
  if (mask & (1 << (i - 1))) { console.log(`Committee ${i} already approved this exact request; continuing.`); continue; }
  // Gas stipend, only on the asserted test chain. Not NGO funding and not a shared signing key.
  const fees = await publicClient.estimateFeesPerGas();
  const approvalData = encodeFunctionData({ abi, functionName: 'approveEmergency', args: [ngo, reasonHash] });
  const dataFee = local ? 0n : await estimateL1Fee(publicClient, { account, to: config.fund, data: approvalData });
  // Bound a 120k-gas approval with 3x reserve, instead of wasting scarce faucet ETH.
  const stipend = local ? parseEther('0.01') : (120_000n * fees.maxFeePerGas + dataFee) * 3n + parseEther('0.000001');
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < stipend / 2n) {
    await confirmed(await payer.sendTransaction({ to: account.address, value: stipend - balance }));
  }
  const client = wallet(account);
  const call = { address: config.fund, abi, functionName: 'approveEmergency', args: [ngo, reasonHash], account } as const;
  await publicClient.simulateContract(call);
  await confirmed(await client.writeContract(call));
}
const call = { address: config.fund, abi, functionName: 'executeEmergency', args: [ngo, reasonHash], account: payer.account } as const;
await publicClient.simulateContract(call);
await confirmed(await payer.writeContract(call));
console.log('Emergency grant paid. This NGO can no longer receive an oracle grant.');
