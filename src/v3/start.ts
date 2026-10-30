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
await run('node', ['src/v3/deploy.ts']);
const backend = spawn('node', ['server/main.ts'], { stdio: 'inherit' });
const frontend = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
console.log('Open http://127.0.0.1:5173/?v3=1 — synthetic local prototype');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
  });
