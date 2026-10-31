import { readFile } from 'node:fs/promises';
import {
  encodeDeployData,
  encodeFunctionData,
  getContractAddress,
  type Address,
  type Abi,
  type Hex,
} from 'viem';
import { estimateL1Fee, estimateOperatorFee } from 'viem/op-stack';
import { account, client } from './chain.ts';
export async function integratedBudget(
  addresses: Address[],
  policies: unknown[],
  seedAmount: bigint,
) {
  const artifact = async (name: string) =>
    JSON.parse(await readFile(`out/integrated/${name}.json`, 'utf8')) as {
      abi: Abi;
      bytecode: { object: Hex };
      deployedBytecode: { object: Hex };
    };
  const [t, f, balance, nonce, fees] = await Promise.all([
    artifact('DemoUSDV3'),
    artifact('DisasterFundV3Auto'),
    client.getBalance({ address: account(0).address }),
    client.getTransactionCount({
      address: account(0).address,
      blockTag: 'pending',
    }),
    client.estimateFeesPerGas(),
  ]);
  const token = getContractAddress({
    from: account(0).address,
    nonce: BigInt(nonce),
  });
  const fund = getContractAddress({
    from: account(0).address,
    nonce: BigInt(nonce + 1),
  });
  const tokenData = encodeDeployData({
    abi: t.abi,
    bytecode: t.bytecode.object,
    args: [addresses[0]],
  });
  const fundData = encodeDeployData({
    abi: f.abi,
    bytecode: f.bytecode.object,
    args: [
      token,
      addresses.slice(1, 4),
      addresses.slice(4, 7),
      addresses.slice(7, 10),
      addresses.slice(10, 13),
      policies,
      seedAmount,
    ],
  });
  const tokenGas = await client.estimateGas({
    account: account(0),
    data: tokenData,
  });
  // Constructor simulation: the future test token has code and the fixed 36,000 dUSD supply.
  let fundGas: bigint;
  let gasEstimation = 'exact constructor with state override';
  try {
    fundGas = await client.estimateGas({
      account: account(0),
      data: fundData,
      nonce: nonce + 1,
      stateOverride: [
        {
          address: token,
          code: `0x7f${36000_000000n.toString(16).padStart(64, '0')}5f5260205ff3` as Hex,
        },
        { address: account(0).address, nonce: nonce + 1 },
      ],
    });
  } catch {
    // Some RPCs apply overrides to eth_call but ignore them in eth_estimateGas.
    // Probe the same constructor against our existing valueless token, with a valid funding target.
    // The actual future-token initcode is still used below for L1 fee estimation. No transaction is sent.
    const prior = await readFile(
      'deployments/integrated-base-sepolia.json',
      'utf8',
    )
      .then((x) => JSON.parse(x) as { token: Address })
      .catch(() => undefined);
    const probeToken =
      prior?.token ?? ('0xdc6ab1e15c3f23b05276fde1ac4a7311abe8e914' as Address);
    const supply = (await client.readContract({
      address: probeToken,
      abi: t.abi,
      functionName: 'totalSupply',
    })) as bigint;
    if (supply <= 0n)
      throw new Error('Cannot conservatively estimate constructor gas');
    const probe = encodeDeployData({
      abi: f.abi,
      bytecode: f.bytecode.object,
      args: [
        probeToken,
        addresses.slice(1, 4),
        addresses.slice(4, 7),
        addresses.slice(7, 10),
        addresses.slice(10, 13),
        policies,
        seedAmount < supply ? seedAmount : supply,
      ],
    });
    const executable = (code: string) =>
      code
        .slice(0, code.length - (parseInt(code.slice(-4), 16) * 2 + 4))
        .toLowerCase();
    const identical =
      supply === 36000_000000n &&
      executable((await client.getCode({ address: probeToken })) ?? '0x') ===
        executable(t.deployedBytecode.object);
    fundGas =
      ((await client.estimateGas({ account: account(0), data: probe })) *
        (identical ? 101n : 120n)) /
      100n;
    gasEstimation = identical
      ? 'same constructor and verified identical token runtime/supply +1% gas margin; real initcode L1 fee'
      : 'same constructor with existing test token +20% gas margin; real initcode L1 fee';
  }
  const calls = [
    tokenData,
    fundData,
    encodeFunctionData({
      abi: t.abi,
      functionName: 'approve',
      args: [fund, seedAmount],
    }),
    encodeFunctionData({
      abi: f.abi,
      functionName: 'deposit',
      args: [seedAmount],
    }),
    encodeFunctionData({ abi: f.abi, functionName: 'activate' }),
  ];
  const l1 = (
    await Promise.all(
      calls.map((data) => estimateL1Fee(client, { account: account(0), data })),
    )
  ).reduce((a, b) => a + b, 0n);
  const gas = tokenGas + fundGas + 300_000n;
  const operator = await estimateOperatorFee(client, {
    account: account(0),
    gas,
  });
  const block = await client.getBlock();
  // Cap deployment fees at the current base fee plus the RPC's suggested tip. A rise waits; it never spends more.
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  const maxFeePerGas = block.baseFeePerGas! + maxPriorityFeePerGas;
  const required = (gas * maxFeePerGas + l1 + operator) * 2n;
  return {
    wallet: account(0).address,
    balance,
    tokenGas,
    fundGas,
    gasEstimation,
    l1,
    operator,
    maxFeePerGas,
    maxPriorityFeePerGas,
    required,
    enough: balance >= required,
  };
}
