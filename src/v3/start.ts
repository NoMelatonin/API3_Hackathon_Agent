import { apiPort, uiPort, testnet } from './profile.ts';
import { spawn } from 'node:child_process';
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)),
    );
  });
}
await run('node', ['scripts/install-local.mjs']);
await run('docker', [
  'compose',
  '-f',
  'compose.v3.yaml',
  'up',
  '-d',
  '--wait',
  ...(testnet ? ['postgres', 's3'] : []),
]);
await run('npm', ['run', 'contracts:build']);
async function ready(url: string, body?: unknown) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const r = await fetch(url, {
        ...(body
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
        signal: AbortSignal.timeout(1500),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Local service did not become ready: ${url}`);
}
await ready(
  process.env.V3_RPC ??
    (testnet
      ? (process.env.RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com')
      : 'http://127.0.0.1:8548'),
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_chainId',
    params: [],
  },
);
if (testnet) {
  const { chain, organizationIds, organizationScope } =
    await import('./chain.ts');
  for (const id of organizationIds) await organizationScope.run(id, chain);
} else await run('node', ['src/v3/deploy.ts']);
const backend = spawn('node', ['server/main.ts'], { stdio: 'inherit' });
let closing = false;
backend.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
await ready(`http://127.0.0.1:${apiPort}/api/v3/health`);
const frontend = spawn('npm', ['run', 'dev', '--', '--strictPort'], {
  stdio: 'inherit',
});
for (const child of [backend, frontend])
  child.on('exit', (code) => {
    if (!closing) {
      closing = true;
      backend.kill('SIGTERM');
      frontend.kill('SIGTERM');
      process.exit(code ?? 1);
    }
  });
console.log(
  `Open http://127.0.0.1:${uiPort}/ — ${testnet ? 'Base Sepolia, genuine Airnode signatures, simulated roles' : 'synthetic local demo, valueless dUSD'}`,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    closing = true;
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
  });
