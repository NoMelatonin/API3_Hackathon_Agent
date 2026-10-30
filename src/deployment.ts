import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http, type Abi, type Address, type Hex } from 'viem';
import { baseSepolia, foundry } from 'viem/chains';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { readPrivateKey } from './private-key.ts';

export interface Deployment {
  chainId: number; network: string; fund: Address; token: Address; deployer: Address;
  ngos: Address[]; committee: Address[]; airnode: Address; requestHash: Hex;
  deployedBlock: string; transactions: Record<string, Hex>;
}

export function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export const local = process.argv.includes('--local');
export const chain = local ? foundry : baseSepolia;
export const rpcUrl = local ? process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545' : process.env.RPC_URL || 'https://sepolia.base.org';
export const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 20_000, retryCount: 1 }) });
export const manifestFile = option('--deployment', local ? 'deployments/local.local.json' : 'deployments/base-sepolia.json')!;

export async function assertChain() {
  if (await publicClient.getChainId() !== chain.id) throw new Error(`Wrong RPC network: expected test chain ${chain.id}`);
}

export function projectAccount() {
  // Public Anvil test mnemonic is ONLY used behind --local and the explicit chain-31337 guard.
  return local ? mnemonicToAccount('test test test test test test test test test test test junk') :
    privateKeyToAccount(readPrivateKey(process.env.DEPLOYER_PRIVATE_KEY || process.env.PAYER_PRIVATE_KEY));
}

export function wallet(account = projectAccount()) {
  return createWalletClient({ account, chain, transport: http(rpcUrl, { timeout: 20_000, retryCount: 0 }) });
}

export async function artifact(name: string) {
  const json = JSON.parse(await readFile(`out/${name}.sol/${name}.json`, 'utf8'));
  return { abi: json.abi as Abi, bytecode: json.bytecode.object as Hex };
}

export async function deployment(): Promise<Deployment> {
  const config: Deployment = JSON.parse(await readFile(manifestFile, 'utf8'));
  await assertChain();
  if (config.chainId !== chain.id) throw new Error('Deployment belongs to another chain');
  return config;
}

export async function confirmed(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Reverted transaction: ${hash}`);
  console.log(`${local ? 'Local tx' : 'https://sepolia.basescan.org/tx/'}${hash}`);
  return receipt;
}

export function ngoIndex() {
  const index = Number(option('--ngo', '1')) - 1;
  if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error('--ngo must be 1, 2 or 3');
  return index;
}
