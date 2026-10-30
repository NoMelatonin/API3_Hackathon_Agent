import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { formatEther, parseAbiItem } from 'viem';
import { artifact, deployment, local, publicClient } from './deployment.ts';
import { logPages } from './log-pages.ts';
if (local) throw new Error('This evidence report is for the public Base Sepolia deployment.');
const config = await deployment();
const { abi } = await artifact('DisasterFund');
const tokenArtifact = await artifact('DemoUSD');
const rejected = JSON.parse(await readFile('deployments/tamper-report.json', 'utf8'));
if (rejected.fund !== config.fund) throw new Error('Tamper report belongs to another deployment');
const block = await publicClient.getBlock();
const logs = await logPages(BigInt(config.deployedBlock), block.number, (fromBlock, toBlock) =>
  publicClient.getLogs({ address: config.fund, fromBlock, toBlock,
    event: parseAbiItem('event Paid(address indexed ngo, uint256 amount, uint8 path, bytes32 evidenceHash)') }));
const payouts = logs.map(log => ({ ngo: log.args.ngo, amount: String(log.args.amount),
  path: log.args.path === 0 ? 'oracle' : 'emergency', evidenceHash: log.args.evidenceHash,
  transaction: log.transactionHash, block: String(log.blockNumber) }));
const totalPaid = await publicClient.readContract({ address: config.fund, abi, functionName: 'totalPaid' });
const balances = await Promise.all(config.ngos.map(address => publicClient.readContract({
  address: config.token, abi: tokenArtifact.abi, functionName: 'balanceOf', args: [address],
})));
await mkdir('deployments', { recursive: true });
await writeFile('deployments/demo-report.json', JSON.stringify({
  chainId: config.chainId, fund: config.fund, block: String(block.number), chainTime: String(block.timestamp),
  realResponseFixture: 'fixtures/usgs-testnet.json', realOtherRequestFixture: 'fixtures/usgs-other.json',
  payouts, totalPaid: String(totalPaid), ngoBalances: balances.map(String),
  rejectionMode: 'eth_call simulations against deployed contract; no failed transactions broadcast',
  tamperCases: rejected.results,
  projectWalletETH: formatEther(await publicClient.getBalance({ address: config.deployer })),
}, null, 2) + '\n');
console.log('Saved public deployment evidence. Payouts:', payouts.length, 'Total base units:', String(totalPaid));
// Seed only transaction hashes: the browser authenticates their receipts against the RPC.
const seeded = { ...config, payoutTransactions: payouts.map(p => p.transaction) };
await writeFile('public/deployment.json', JSON.stringify(seeded, null, 2) + '\n');
