import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  type Address,
  type Hex,
  type Abi,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
const mnemonic = 'test test test test test test test test test test test junk';
export const rpc = process.env.V3_RPC ?? 'http://127.0.0.1:8547';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(rpc))
  throw new Error('V3 RPC must be loopback');
export const account = (i: number) =>
  mnemonicToAccount(mnemonic, { addressIndex: i });
export const client = createPublicClient({
  chain: foundry,
  transport: http(rpc, { retryCount: 0 }),
});
export const wallet = (i: number) =>
  createWalletClient({
    account: account(i),
    chain: foundry,
    transport: http(rpc),
  });
export const hash = (s: string) => keccak256(toHex(s));
export const encode = (types: string, values: unknown[]) =>
  keccak256(
    encodeAbiParameters(parseAbiParameters(types) as never, values as never),
  );
export type Config = {
  chainId: 31337;
  fund: Address;
  token: Address;
  deployedBlock: string;
  ngos: Address[];
  dataReviewers: Address[];
  evidenceReviewers: Address[];
  appealReviewers: Address[];
};
type RuntimeArtifact = {
  abi: Abi;
  deployedBytecode: {
    object: Hex;
    immutableReferences: Record<string, { start: number; length: number }[]>;
  };
};
export async function verifyRuntime(config: Config) {
  const fund = JSON.parse(
    await readFile('out/DisasterFundV3.sol/DisasterFundV3.json', 'utf8'),
  ) as RuntimeArtifact;
  const token = JSON.parse(
    await readFile('out/DemoUSDV3.sol/DemoUSDV3.json', 'utf8'),
  ) as RuntimeArtifact;
  const mask = (code: string, artifact: RuntimeArtifact) => {
    let result = code.slice(2).toLowerCase();
    for (const refs of Object.values(
      artifact.deployedBytecode.immutableReferences ?? {},
    ))
      for (const ref of refs)
        result =
          result.slice(0, ref.start * 2) +
          '0'.repeat(ref.length * 2) +
          result.slice((ref.start + ref.length) * 2);
    return result;
  };
  for (const [address, artifact] of [
    [config.fund, fund],
    [config.token, token],
  ] as const) {
    const actual = await client.getCode({ address });
    if (!actual)
      throw new Error(
        'Local V3 chain state is missing; preserve the old manifest and use a new V3_DEPLOYMENT name',
      );
    if (
      mask(actual, artifact) !==
      mask(artifact.deployedBytecode.object, artifact)
    )
      throw new Error(
        'V3 executable runtime/build mismatch; preserve state and use a fresh named deployment',
      );
  }
  const read = (functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: config.fund,
      abi: fund.abi,
      functionName,
      args,
    });
  if (
    String(await read('token')).toLowerCase() !== config.token.toLowerCase() ||
    (await read('DOMAIN')) !==
      encode('bytes32,uint256,address', [
        hash('DisasterDAO V3 local attestations v1'),
        31337n,
        config.fund,
      ])
  )
    throw new Error('Immutable configuration mismatch');
  for (const group of [
    'ngos',
    'dataReviewers',
    'evidenceReviewers',
    'appealReviewers',
  ] as const)
    for (let i = 0; i < 3; i++)
      if (
        String(await read(group, [BigInt(i)])).toLowerCase() !==
        config[group][i]?.toLowerCase()
      )
        throw new Error('V3 registry mismatch');
}
export const deploymentPath =
  process.env.V3_DEPLOYMENT ?? '.runtime/v3.1-persistent.json';
if (!/^\.runtime\/[a-zA-Z0-9_.-]+\.json$/.test(deploymentPath))
  throw new Error('V3 deployment must be a named private runtime manifest');
let loaded: { config: Config; fundAbi: Abi; tokenAbi: Abi } | undefined;
export async function chain() {
  if ((await client.getChainId()) !== 31337)
    throw new Error('V3 only permits chain 31337');
  if (!loaded) {
    const [config, fund, token] = await Promise.all([
      readFile(deploymentPath, 'utf8'),
      readFile('out/DisasterFundV3.sol/DisasterFundV3.json', 'utf8'),
      readFile('out/DemoUSDV3.sol/DemoUSDV3.json', 'utf8'),
    ]);
    await verifyRuntime(JSON.parse(config));
    loaded = {
      config: JSON.parse(config),
      fundAbi: JSON.parse(fund).abi,
      tokenAbi: JSON.parse(token).abi,
    };
  }
  const c = loaded;
  if (!(await client.getCode({ address: c.config.fund })))
    throw new Error(
      'Local V3 deployment missing; reset only the isolated V3 stack',
    );
  return {
    config: c.config,
    fundAbi: c.fundAbi,
    read: async (name: string, args: unknown[] = [], blockNumber?: bigint) =>
      client.readContract({
        address: c.config.fund,
        abi: c.fundAbi,
        functionName: name,
        args,
        blockNumber,
      }),
    send: async (name: string, args: unknown[] = [], index = 0) => {
      const tx = await wallet(index).writeContract({
        address: c.config.fund,
        abi: c.fundAbi,
        functionName: name,
        args,
      });
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== 'success')
        throw new Error(`V3 transaction reverted: ${name}`);
      return tx;
    },
    balance: async (blockNumber?: bigint) =>
      client.readContract({
        address: c.config.token,
        abi: c.tokenAbi,
        functionName: 'balanceOf',
        args: [c.config.fund],
        blockNumber,
      }) as Promise<bigint>,
    sign: async (purpose: string, payload: Hex, indices: number[]) => {
      const digest = (await client.readContract({
        address: c.config.fund,
        abi: c.fundAbi,
        functionName: 'digest',
        args: [hash(purpose), payload],
      })) as Hex;
      return Promise.all(indices.map((i) => account(i).sign({ hash: digest })));
    },
  };
}
export const assessmentType =
  '(address ngo,bytes32 incident,uint256 areaVersion,bytes32 modelVersion,bytes32 sources,uint256 maximum,uint256 expires,uint256 nonce,uint256 deadlineDays)';
export const requestType =
  '(uint256 requested,uint256 capacity,uint256 externalFunding,uint8 conflicts,bool newEvidence)';
export const roundType =
  '(bytes32 snapshot,uint256 balance,uint256 reserved,uint256 nonce,uint256 validUntil,bool uncertain,bool competing,uint256 provisional)';
export async function deployV3() {
  if ((await client.getChainId()) !== 31337)
    throw new Error('Local chain only');
  try {
    await access(deploymentPath);
    console.log('V3 already initialized; preserving deployment.');
    await chain();
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await mkdir('.runtime', { recursive: true, mode: 0o700 });
  const artifact = async (name: string) =>
    JSON.parse(await readFile(`out/${name}.sol/${name}.json`, 'utf8')) as {
      abi: Abi;
      bytecode: { object: Hex };
    };
  const t = await artifact('DemoUSDV3'),
    f = await artifact('DisasterFundV3');
  const addresses = Array.from({ length: 13 }, (_, i) => account(i).address);
  const tokenTx = await wallet(0).deployContract({
    abi: t.abi,
    bytecode: t.bytecode.object,
    args: [addresses[0]],
  });
  const token = (await client.waitForTransactionReceipt({ hash: tokenTx }))
    .contractAddress!;
  const fundTx = await wallet(0).deployContract({
    abi: f.abi,
    bytecode: f.bytecode.object,
    args: [
      token,
      addresses.slice(1, 4),
      addresses.slice(4, 7),
      addresses.slice(7, 10),
      addresses.slice(10, 13),
    ],
  });
  const deployed = await client.waitForTransactionReceipt({ hash: fundTx });
  if (deployed.status !== 'success') throw new Error('Deploy failed');
  const fund = deployed.contractAddress!;
  for (const [address, abi, functionName, args] of [
    [token, t.abi, 'approve', [fund, 18_000_000_000n]],
    [fund, f.abi, 'deposit', [18_000_000_000n]],
  ] as const) {
    const tx = await wallet(0).writeContract({
      address,
      abi,
      functionName,
      args,
    });
    if (
      (await client.waitForTransactionReceipt({ hash: tx })).status !==
      'success'
    )
      throw new Error('Funding failed');
  }
  const config: Config = {
    chainId: 31337,
    fund,
    token,
    deployedBlock: String(deployed.blockNumber),
    ngos: addresses.slice(1, 4),
    dataReviewers: addresses.slice(4, 7),
    evidenceReviewers: addresses.slice(7, 10),
    appealReviewers: addresses.slice(10, 13),
  };
  await writeFile(deploymentPath, JSON.stringify(config, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  await verifyRuntime(config);
  console.log('Isolated V3 deployed and funded: 18,000 valueless dUSD.');
}
