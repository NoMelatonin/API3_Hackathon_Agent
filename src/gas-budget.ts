import { encodeDeployData, encodeFunctionData, formatEther, getContractAddress, type Address } from 'viem';
import { estimateL1Fee, estimateOperatorFee } from 'viem/op-stack';
import { artifact, assertChain, local, projectAccount, publicClient } from './deployment.ts';
import { AIRNODE_SIGNER, REQUEST_HASH } from './usgs.ts';

/** Read-only budget; constructor simulation uses a code override for the not-yet-deployed token. */
export async function deploymentBudget(ngos: Address[], committee: Address[]) {
  await assertChain();
  const account = projectAccount();
  const [tokenArtifact, fundArtifact, balance, nonce, fees] = await Promise.all([
    artifact('DemoUSD'), artifact('DisasterFund'), publicClient.getBalance({ address: account.address }),
    publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }), publicClient.estimateFeesPerGas(),
  ]);
  const token = getContractAddress({ from: account.address, nonce: BigInt(nonce) });
  const fund = getContractAddress({ from: account.address, nonce: BigInt(nonce + 1) });
  const tokenData = encodeDeployData({ ...tokenArtifact, args: [account.address] });
  const fundData = encodeDeployData({ ...fundArtifact, args: [token, AIRNODE_SIGNER, REQUEST_HASH, ngos, committee] });
  // Anvil differs from Base's node in creation-call nonce overrides; local test ETH needs only a safe bound.
  const [tokenGas, fundGas] = local ? [600_000n, 3_000_000n] : await Promise.all([
    publicClient.estimateGas({ account, data: tokenData }),
    publicClient.estimateGas({ account, data: fundData, nonce: nonce + 1,
      stateOverride: [{ address: token, code: '0x00' }, { address: account.address, nonce: nonce + 1 }] }),
  ]);
  const transferData = encodeFunctionData({ abi: tokenArtifact.abi, functionName: 'transfer', args: [fund, 3_000_000_000n] });
  const activateData = encodeFunctionData({ abi: fundArtifact.abi, functionName: 'activate' });
  // 100k each is conservative for the two post-deployment calls; their state does not exist yet.
  const totalGas = tokenGas + fundGas + 200_000n;
  const maxFee = fees.maxFeePerGas;
  const l1Fees = local ? [] : await Promise.all([
    estimateL1Fee(publicClient, { account, data: tokenData }),
    estimateL1Fee(publicClient, { account, data: fundData }),
    estimateL1Fee(publicClient, { account, to: token, data: transferData }),
    estimateL1Fee(publicClient, { account, to: fund, data: activateData }),
  ]);
  const l1 = l1Fees.reduce((a, b) => a + b, 0n);
  const operator = local ? 0n : await estimateOperatorFee(publicClient, { account, gas: totalGas });
  const estimate = totalGas * maxFee + l1 + operator;
  const reserved = estimate * 2n;
  return { account: account.address, balance, tokenGas, fundGas, totalGas, maxFee, l1, operator, estimate, reserved,
    enough: balance >= reserved, additional: reserved > balance ? reserved - balance : 0n };
}

export function printBudget(budget: Awaited<ReturnType<typeof deploymentBudget>>) {
  console.log(JSON.stringify({
    wallet: budget.account, balanceETH: formatEther(budget.balance), tokenGas: budget.tokenGas.toString(),
    fundGas: budget.fundGas.toString(), totalGasIncludingFundingActivation: budget.totalGas.toString(),
    maxFeePerGasWei: budget.maxFee.toString(), l1DataFeeETH: formatEther(budget.l1),
    operatorFeeETH: formatEther(budget.operator), estimatedETH: formatEther(budget.estimate),
    requiredWith2xReserveETH: formatEther(budget.reserved), enough: budget.enough, additionalETH: formatEther(budget.additional),
  }, null, 2));
}
