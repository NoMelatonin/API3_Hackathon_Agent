import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import { artifact, assertChain, chain, confirmed, local, manifestFile, projectAccount, publicClient, wallet, type Deployment } from './deployment.ts';
import { AIRNODE_SIGNER, REQUEST_HASH } from './usgs.ts';
import { readPrivateKey } from './private-key.ts';
import { deploymentBudget, printBudget } from './gas-budget.ts';

await assertChain();
try { await access(manifestFile); throw new Error(`Deployment file already exists: ${manifestFile}. Use --deployment with a NEW path for a fresh fund.`); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const roles = (kind: string) => [1, 2, 3].map(i => privateKeyToAccount(readPrivateKey(process.env[`${kind}_${i}_PRIVATE_KEY`])).address);
const ngos = roles('NGO');
const committee = roles('COMMITTEE');
const budget = await deploymentBudget(ngos, committee);
printBudget(budget);
if (!budget.enough) throw new Error('Not enough test ETH for deployment with 2x fee reserve; no transaction was sent.');
const account = projectAccount();
const client = wallet(account);
if (await publicClient.getBalance({ address: account.address }) === 0n) throw new Error(`Fund project wallet ${account.address} with Base Sepolia ETH first.`);
const tokenArtifact = await artifact('DemoUSD');
const fundArtifact = await artifact('DisasterFund');
const transactions: Record<string, Hex> = {};
transactions.token = await client.deployContract({ ...tokenArtifact, args: [account.address] });
const token = (await confirmed(transactions.token)).contractAddress as Address;
transactions.fund = await client.deployContract({ ...fundArtifact, args: [token, AIRNODE_SIGNER, REQUEST_HASH, ngos, committee] });
const fundReceipt = await confirmed(transactions.fund);
const fund = fundReceipt.contractAddress as Address;
transactions.funding = await client.writeContract({ address: token, abi: tokenArtifact.abi, functionName: 'transfer', args: [fund, 3_000_000_000n] });
await confirmed(transactions.funding);
transactions.activation = await client.writeContract({ address: fund, abi: fundArtifact.abi, functionName: 'activate' });
await confirmed(transactions.activation);
const config: Deployment = {
  chainId: chain.id, network: chain.name, fund, token, deployer: account.address, ngos, committee,
  airnode: AIRNODE_SIGNER, requestHash: REQUEST_HASH, deployedBlock: fundReceipt.blockNumber.toString(), transactions,
};
await mkdir(dirname(manifestFile), { recursive: true });
await writeFile(manifestFile, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
await mkdir('public', { recursive: true });
await writeFile(`public/deployment${local ? '.local' : ''}.json`, JSON.stringify(config, null, 2) + '\n');
console.log(`Fund activated: ${fund}\nPublic configuration: ${manifestFile}`);
