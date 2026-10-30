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
await run('docker', ['compose', '-f', 'compose.v3.yaml', 'up', '-d', '--wait']);
await run('npm', [
  'run',
  'forge',
  '--',
  'build',
  '--skip',
  'test',
  '--skip',
  'script',
  '--quiet',
]);
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
await ready(process.env.V3_RPC ?? 'http://127.0.0.1:8547', {
  jsonrpc: '2.0',
  id: 1,
  method: 'eth_chainId',
  params: [],
});
await run('node', ['src/v3/deploy.ts']);
const backend = spawn('node', ['server/main.ts'], { stdio: 'inherit' });
let closing = false;
backend.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
await ready('http://127.0.0.1:3007/api/v3/health');
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
console.log('Open http://127.0.0.1:5173/?v3=1 — synthetic local prototype');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    closing = true;
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
  });
