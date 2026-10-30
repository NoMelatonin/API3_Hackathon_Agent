import { access, mkdir, readFile } from 'node:fs/promises';
import { encodeDeployData, walletActions, formatUnits, keccak256, toHex, type Address } from 'viem';
import { artifact, assertChain, confirmed, local, ngoIndex, option, publicClient, wallet } from './deployment.ts';
import { campaignConfig } from './v2-config.ts';
import { campaigns, TOTAL_BUDGET } from './campaigns.ts';
import { writeNewOutput } from './new-output.ts';
import { verifySignedResponse, type SignedResponse } from './vendor/airnode-v2.ts';

// V2 execution is deliberately restricted to local chain 31337. V1 scripts remain available separately.
if (!local) throw new Error('V2 commands require --local. No public-chain deployment or transaction is enabled.');
await assertChain();
const command = process.argv[2];
const path = option('--deployment', 'deployments/v2.local.json')!;
const configPath = 'public/deployment.v2.local.json';
const fundArtifact = await artifact('DisasterFundV2');
const tokenArtifact = await artifact('DemoUSDV2');
const client = wallet();
const unlocked = publicClient.extend(walletActions);
export interface V2Deployment {
  version: 2; chainId: 31337; fund: Address; token: Address; deployer: Address;
  ngos: Address[]; committee: Address[]; deployedBlock: string;
  campaigns: typeof campaignConfig; transactions: Record<string, string>;
}
const json = (data: unknown) => JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
if (command === 'deploy') {
  // Refuse overwrite of both the evidence manifest and active frontend configuration before sending anything.
  for (const file of [path, configPath]) {
    try { await access(file); throw new Error(`Already exists: ${file}; preserve it or select an isolated checkout.`); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  const accounts = await unlocked.getAddresses();
  const ngos = accounts.slice(1,4); const committee = accounts.slice(4,7);
  if (ngos.length !== 3 || committee.length !== 3) throw new Error('Start Anvil with at least seven public test accounts');
  const fees = await publicClient.estimateFeesPerGas();
  const gasReserve = 12_000_000n * fees.maxFeePerGas * 2n;
  if (await publicClient.getBalance({address:client.account.address}) < gasReserve) throw new Error('Insufficient local test ETH for 2x conservative gas reserve');
  const transactions: Record<string,string> = {};
  transactions.token = await client.deployContract({...tokenArtifact,args:[client.account.address]});
  const token = (await confirmed(transactions.token as `0x${string}`)).contractAddress!;
  transactions.fund = await client.deployContract({...fundArtifact,args:[token,campaignConfig,ngos,committee]});
  const receipt = await confirmed(transactions.fund as `0x${string}`); const fund = receipt.contractAddress!;
  transactions.funding = await client.writeContract({address:token,abi:tokenArtifact.abi,functionName:'transfer',args:[fund,TOTAL_BUDGET]});
  await confirmed(transactions.funding as `0x${string}`);
  transactions.activation = await client.writeContract({address:fund,abi:fundArtifact.abi,functionName:'activate'});
  await confirmed(transactions.activation as `0x${string}`);
  const config: V2Deployment = {version:2,chainId:31337,fund,token,deployer:client.account.address,ngos,committee,
    deployedBlock:receipt.blockNumber.toString(),campaigns:campaignConfig,transactions};
  await writeNewOutput(path,async()=>json(config));
  await writeNewOutput(configPath,async()=>json(config));
  console.log('V2 local fund activated: 18,000 dUSD; WHO oracle disabled.');
} else {
  const config = JSON.parse(await readFile(path,'utf8')) as V2Deployment;
  if(config.version!==2 || config.chainId!==31337) throw new Error('Not a V2 local deployment');
  const read = (functionName:string,args:unknown[]=[]) => publicClient.readContract({address:config.fund,abi:fundArtifact.abi,functionName,args});
  const id = Number(option('--campaign','0')); if(!campaigns[id]) throw new Error('Invalid campaign');
  const ngo = config.ngos[ngoIndex()]!;
  if(command==='verify') {
    for(const [compiled,address,args] of [
      [tokenArtifact,config.token,[config.deployer]],
      [fundArtifact,config.fund,[config.token,campaignConfig,config.ngos,config.committee]],
    ] as const) {
      const [{data:expected},actual] = await Promise.all([
        publicClient.call({account:config.deployer,data:encodeDeployData({...compiled,args:[...args]})}),publicClient.getCode({address}),
      ]);
      if(!expected || expected!==actual) throw new Error('Runtime bytecode mismatch');
    }
    if(!(await read('active'))) throw new Error('Inactive');
    const total = await read('totalPaid') as bigint;
    const balance = await publicClient.readContract({address:config.token,abi:tokenArtifact.abi,functionName:'balanceOf',args:[config.fund]}) as bigint;
    if(balance+total!==TOTAL_BUDGET) throw new Error('Funding invariant failed');
    console.log('PASS: token and fund runtime incl. immutable rules match; activated; 18,000-dUSD accounting consistent.');
  } else if(command==='submit' || command==='quote') {
    const file = option('--file'); if(!file) throw new Error('--file required');
    const response = JSON.parse(await readFile(file,'utf8')) as SignedResponse;
    const args=[id,BigInt(response.timestamp),toHex(response.data),response.signature];
    // No preflight signature check: the actual contract must reject manipulated responses.
    const amount=await read('quote',args) as bigint;
    console.log(`Contract quote: ${formatUnits(amount,6)} dUSD`);
    await publicClient.simulateContract({address:config.fund,abi:fundArtifact.abi,functionName:'claim',args:[id,ngo,...args.slice(1)],account:client.account});
    if(command==='submit' && !process.argv.includes('--simulate')) await confirmed(await client.writeContract({address:config.fund,abi:fundArtifact.abi,functionName:'claim',args:[id,ngo,...args.slice(1)]}));
    else console.log('Simulation only; no transaction sent.');
  } else if(command==='emergency') {
    const reason=keccak256(toHex(option('--reason','Oracle unavailable; historical exercise; post-review required')!));
    // Local unlocked accounts only. Never loads committee secrets or funds public-chain wallets.
    for(const address of config.committee.slice(0,2)) {
      const mask=Number(await read('approvals',[id,ngo,reason]));
      const bit=1<<config.committee.indexOf(address); if(mask&bit) continue;
      const tx = await unlocked.writeContract({account:address,address:config.fund,abi:fundArtifact.abi,functionName:'approveEmergency',args:[id,ngo,reason]});
      await confirmed(tx);
    }
    await confirmed(await client.writeContract({address:config.fund,abi:fundArtifact.abi,functionName:'executeEmergency',args:[id,ngo,reason]}));
  } else throw new Error('Use deploy, verify, quote, submit or emergency');
}
