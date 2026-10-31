import { readFileSync } from 'node:fs';
import { profile, testnet, chainId, oracleMode } from './profile.ts';
import { readPrivateKey } from '../private-key.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
export const organizationScope = new AsyncLocalStorage<string>();
export const organizationId = () =>
  organizationScope.getStore() ??
  process.env.V3_ORGANIZATION ??
  'local-alliance';
export const organizationIds = [
  'local-alliance',
  'community-alliance',
] as const;
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
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { foundry, baseSepolia } from 'viem/chains';
export const network = testnet ? baseSepolia : foundry;
const mnemonic = 'test test test test test test test test test test test junk';
export const rpc =
  process.env.V3_RPC ??
  (testnet
    ? (process.env.RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com')
    : 'http://127.0.0.1:8548');
if (!testnet && !/^http:\/\/127\.0\.0\.1:\d+$/.test(rpc))
  throw new Error('Demo RPC must be loopback');
let privateRoles: Record<string, string> | undefined;
export const account = (i: number) => {
  if (!testnet) return mnemonicToAccount(mnemonic, { addressIndex: i });
  if (!privateRoles) {
    try {
      privateRoles = JSON.parse(
        readFileSync('.runtime/testnet-roles.json', 'utf8'),
      );
    } catch {
      throw new Error(
        'Missing private test roles. Run npm run init:testnet first.',
      );
    }
  }
  return privateKeyToAccount(readPrivateKey(privateRoles![String(i)]));
};
export function roleAddress(i: number): Address {
  if (!testnet) return account(i).address;
  try {
    return account(i).address;
  } catch {
    const path =
      i >= 14
        ? deploymentPath.replace('.json', '-community.json')
        : deploymentPath;
    const c = JSON.parse(readFileSync(path, 'utf8')) as Config;
    return [
      c.deployer,
      ...c.ngos,
      ...c.dataReviewers,
      ...c.evidenceReviewers,
      ...c.appealReviewers,
    ][i >= 14 ? i - 13 : i] as Address;
  }
}
export const client = createPublicClient({
  chain: network,
  transport: http(rpc, { retryCount: 0, timeout: 30000 }),
});
export const wallet = (i: number) =>
  createWalletClient({
    account: account(i),
    chain: network,
    transport: http(rpc),
  });
export const hash = (s: string) => keccak256(toHex(s));
export const encode = (types: string, values: unknown[]) =>
  keccak256(
    encodeAbiParameters(parseAbiParameters(types) as never, values as never),
  );
export type Config = {
  chainId: 31337 | 84532;
  network: string;
  profile: string;
  oracleMode: string;
  oracleVerifier: Address;
  allocator: Address;
  activatedAt: string;
  transactions: Record<string, Hex>;
  deployer: Address;
  seedAmount: string;
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
// Solidity's trailing CBOR source metadata is not executable code.
const executable = (code: string) => {
  const value = code.replace(/^0x/, '').toLowerCase();
  const size = Number.parseInt(value.slice(-4), 16) * 2 + 4;
  return size <= value.length ? value.slice(0, -size) : value;
};
export async function verifyRuntime(config: Config) {
  const fund = JSON.parse(
    await readFile('out/integrated/DisasterFundV3Auto.json', 'utf8'),
  ) as RuntimeArtifact;
  const token = JSON.parse(
    await readFile('out/integrated/DemoUSDV3.json', 'utf8'),
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
    return executable(result);
  };
  for (const [address, artifact] of [
    [config.fund, fund],
    [config.token, token],
  ] as const) {
    const actual = await client.getCode({ address });
    if (!actual)
      throw new Error(
        'DisasterDAO chain state is missing; preserve the old manifest and use a new V3_DEPLOYMENT name',
      );
    if (
      mask(actual, artifact) !==
      mask(artifact.deployedBytecode.object, artifact)
    )
      throw new Error(
        'DisasterDAO executable runtime/build mismatch; preserve state and use a fresh named deployment',
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
        hash('DisasterDAO integrated attestations v1'),
        BigInt(chainId),
        config.fund,
      ])
  )
    throw new Error('Immutable configuration mismatch');
  if (
    String(await read('minimumFunding')) !== config.seedAmount ||
    String(await read('operator')).toLowerCase() !==
      config.deployer.toLowerCase()
  )
    throw new Error('Funding target/operator mismatch');
  const verifier = (await read('oracleVerifier')) as Address;
  const verifierArtifact = JSON.parse(
    await readFile('out/integrated/V3OracleVerifier.json', 'utf8'),
  );
  if (
    executable((await client.getCode({ address: verifier })) ?? '0x') !==
    executable(verifierArtifact.deployedBytecode.object)
  )
    throw new Error('Oracle verifier runtime mismatch');
  const allocatorArtifact = JSON.parse(
    await readFile('out/integrated/SharedAllocation.json', 'utf8'),
  );
  const allocationAddress = (await read('allocator')) as Address;
  if (
    executable(
      (await client.getCode({ address: allocationAddress })) ?? '0x',
    ) !== executable(allocatorArtifact.deployedBytecode.object)
  )
    throw new Error('Allocator runtime mismatch');
  if (
    config.chainId !== chainId ||
    config.oracleMode !== oracleMode ||
    String(await read('activatedAt')) !== config.activatedAt ||
    BigInt(config.activatedAt) === 0n ||
    verifier.toLowerCase() !== config.oracleVerifier.toLowerCase() ||
    allocationAddress.toLowerCase() !== config.allocator.toLowerCase()
  )
    throw new Error('Deployment profile or immutable address mismatch');
  const { oraclePolicies } = await import('./oracle.ts');
  for (const [i, p] of oraclePolicies().entries()) {
    const actual = (await read('policies', [BigInt(i)])) as unknown[];
    if (
      JSON.stringify(actual, (_k, v) =>
        typeof v === 'bigint'
          ? Number(v)
          : typeof v === 'string'
            ? v.toLowerCase()
            : v,
      ) !==
      JSON.stringify(Object.values(p), (_k, v) =>
        typeof v === 'string' ? v.toLowerCase() : v,
      )
    )
      throw new Error(
        'Oracle policy mismatch; use a fresh named deployment and database namespace',
      );
  }
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
  process.env.V3_DEPLOYMENT ??
  (testnet
    ? 'deployments/integrated-base-sepolia.json'
    : '.runtime/integrated-demo-v1.json');
if (!/^(?:\.runtime|deployments)\/[a-zA-Z0-9_.-]+\.json$/.test(deploymentPath))
  throw new Error('V3 deployment must be a named private runtime manifest');
const deployments = new Map<
  string,
  { config: Config; fundAbi: Abi; tokenAbi: Abi }
>();
export const databaseNamespace = () =>
  'v3_' +
  keccak256(toHex(String(chainId) + '/' + scopedDeploymentPath())).slice(2, 18);
export const scopedDeploymentPath = () =>
  organizationId() === 'local-alliance'
    ? deploymentPath
    : deploymentPath.replace('.json', '-community.json');
export async function chain() {
  if ((await client.getChainId()) !== chainId)
    throw new Error('Wrong chain for selected DisasterDAO profile');
  let loaded = deployments.get(organizationId());
  if (!loaded) {
    const [config, fund, token] = await Promise.all([
      readFile(scopedDeploymentPath(), 'utf8'),
      readFile('out/integrated/DisasterFundV3Auto.json', 'utf8'),
      readFile('out/integrated/DemoUSDV3.json', 'utf8'),
    ]);
    await verifyRuntime(JSON.parse(config));
    loaded = {
      config: JSON.parse(config),
      fundAbi: [
        ...JSON.parse(fund).abi,
        ...JSON.parse(
          await readFile('out/integrated/V3OracleVerifier.json', 'utf8'),
        ).abi.filter((x: { type: string }) => x.type === 'error'),
      ],
      tokenAbi: JSON.parse(token).abi,
    };
    deployments.set(organizationId(), loaded);
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
      let transactionFees: {
        gas?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
      } = {};
      if (testnet) {
        const estimate = await client.estimateContractGas({
          address: c.config.fund,
          abi: c.fundAbi,
          functionName: name,
          args,
          account: account(index).address,
          gasPrice: 0n,
        });
        const fees = await client.estimateFeesPerGas();
        const gas = estimate + estimate / 10n + 10000n;
        const target = gas * fees.maxFeePerGas + 1_000_000_000n;
        const balance = await client.getBalance({
          address: account(index).address,
        });
        if (index !== 0 && balance < target) {
          if (target > 40_000_000_000_000n)
            throw new Error(
              'Required test gas exceeds per-operation funding limit',
            );
          const gasTx = await wallet(0).sendTransaction({
            to: account(index).address,
            value: target - balance,
          });
          if (
            (await client.waitForTransactionReceipt({ hash: gasTx })).status !==
            'success'
          )
            throw new Error('Test gas funding failed');
        }
        transactionFees = {
          gas,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        };
      }
      const tx = await wallet(index).writeContract({
        ...transactionFees,
        address: c.config.fund,
        abi: c.fundAbi,
        functionName: name,
        args,
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
      });
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
  if ((await client.getChainId()) !== chainId)
    throw new Error('Wrong deployment network');
  try {
    await access(scopedDeploymentPath());
    console.log('V3 already initialized; preserving deployment.');
    await chain();
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await mkdir('.runtime', { recursive: true, mode: 0o700 });
  const artifact = async (name: string) =>
    JSON.parse(await readFile(`out/integrated/${name}.json`, 'utf8')) as {
      abi: Abi;
      bytecode: { object: Hex };
    };
  const t = await artifact('DemoUSDV3'),
    f = await artifact('DisasterFundV3Auto');
  const offset = organizationId() === 'local-alliance' ? 0 : 13;
  const addresses = [
    account(0).address,
    ...Array.from({ length: 12 }, (_, i) => account(i + 1 + offset).address),
  ];
  const { oraclePolicies } = await import('./oracle.ts');
  const policies = oraclePolicies();
  const seedAmount =
    organizationId() === 'local-alliance' ? 18_000_000_000n : 9_000_000_000n;
  for (let i = 1; !testnet && i < addresses.length; i++)
    if ((await client.getBalance({ address: addresses[i]! })) < 10n ** 16n) {
      const tx = await wallet(0).sendTransaction({
        to: addresses[i]!,
        value: 10n ** 17n,
      });
      await client.waitForTransactionReceipt({ hash: tx });
    }
  let deploymentFees: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } =
    {};
  if (testnet) {
    const { integratedBudget } = await import('./deploy-budget.ts');
    const budget = await integratedBudget(addresses, policies, seedAmount);
    console.log(
      JSON.stringify(budget, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
    if (!budget.enough)
      throw new Error(
        'Insufficient test ETH for deployment with 2x fee reserve',
      );
    deploymentFees = {
      maxFeePerGas: budget.maxFeePerGas,
      maxPriorityFeePerGas: budget.maxPriorityFeePerGas,
    };
  }
  const journalPath =
    '.runtime/deploy-progress-' + scopedDeploymentPath().split('/').pop();
  const journal: Record<string, unknown> = {
    chainId,
    organization: organizationId(),
    seedAmount: String(seedAmount),
    transactions: {},
  };
  await writeFile(journalPath, JSON.stringify(journal, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const record = async (name: string, tx: Hex) => {
    (journal.transactions as Record<string, Hex>)[name] = tx;
    await writeFile(journalPath, JSON.stringify(journal, null, 2), {
      mode: 0o600,
    });
  };
  const tokenTx = await wallet(0).deployContract({
    ...deploymentFees,
    abi: t.abi,
    bytecode: t.bytecode.object,
    args: [addresses[0]],
  });
  await record('token', tokenTx);
  const tokenReceipt = await client.waitForTransactionReceipt({
    hash: tokenTx,
  });
  if (tokenReceipt.status !== 'success' || !tokenReceipt.contractAddress)
    throw new Error('Token deployment failed; preserve deployment journal');
  const token = tokenReceipt.contractAddress;
  const fundTx = await wallet(0).deployContract({
    ...deploymentFees,
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
  await record('fund', fundTx);
  const deployed = await client.waitForTransactionReceipt({
    hash: fundTx,
  });
  if (deployed.status !== 'success') throw new Error('Deploy failed');
  const fund = deployed.contractAddress!;
  const transactions: Record<string, Hex> = { token: tokenTx, fund: fundTx };
  for (const [address, abi, functionName, args] of [
    [token, t.abi, 'approve', [fund, seedAmount]],
    [fund, f.abi, 'deposit', [seedAmount]],
  ] as const) {
    const tx = await wallet(0).writeContract({
      ...deploymentFees,
      address,
      abi,
      functionName,
      args,
    });
    await record(functionName, tx);
    transactions[functionName] = tx;
    if (
      (await client.waitForTransactionReceipt({ hash: tx })).status !==
      'success'
    )
      throw new Error('Funding failed');
  }
  transactions.activation = await wallet(0).writeContract({
    ...deploymentFees,
    address: fund,
    abi: f.abi,
    functionName: 'activate',
  });
  await record('activation', transactions.activation);
  if (
    (await client.waitForTransactionReceipt({ hash: transactions.activation }))
      .status !== 'success'
  )
    throw new Error('Activation failed');
  const activatedAt = String(
    await client.readContract({
      address: fund,
      abi: f.abi,
      functionName: 'activatedAt',
    }),
  );
  const oracleVerifier = (await client.readContract({
    address: fund,
    abi: f.abi,
    functionName: 'oracleVerifier',
  })) as Address;
  const allocator = (await client.readContract({
    address: fund,
    abi: f.abi,
    functionName: 'allocator',
  })) as Address;
  const config: Config = {
    chainId,
    network: network.name,
    profile,
    oracleMode,
    activatedAt,
    oracleVerifier,
    allocator,
    transactions,
    deployer: account(0).address,
    seedAmount: String(seedAmount),
    fund,
    token,
    deployedBlock: String(deployed.blockNumber),
    ngos: addresses.slice(1, 4),
    dataReviewers: addresses.slice(4, 7),
    evidenceReviewers: addresses.slice(7, 10),
    appealReviewers: addresses.slice(10, 13),
  };
  await mkdir(scopedDeploymentPath().split('/').slice(0, -1).join('/'), {
    recursive: true,
  });
  await writeFile(
    scopedDeploymentPath(),
    JSON.stringify(config, null, 2) + '\n',
    {
      flag: 'wx',
      mode: 0o600,
    },
  );
  await verifyRuntime(config);
  journal.completed = true;
  await writeFile(journalPath, JSON.stringify(journal, null, 2), {
    mode: 0o600,
  });
  console.log(
    `Isolated ${organizationId()} deployed and funded: ${seedAmount / 1_000_000n} valueless dUSD.`,
  );
}
