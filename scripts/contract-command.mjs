import { spawn } from 'node:child_process';
import { ensureContracts } from './build-contracts.mjs';
const [command, ...args] = process.argv.slice(2);
if (!['deploy', 'verify', 'jury', 'approvals', 'clock'].includes(command))
  throw new Error('Unknown integrated contract command');
await ensureContracts();
const child = spawn(process.execPath, [`src/v3/${command}.ts`, ...args], {
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
