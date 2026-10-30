import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';

// A skipped optional test is NOT a completed feasibility gate.
try { await access('fixtures/usgs-real.json'); }
catch { throw new Error('Missing real response. Configure .env, then run npm run fetch-response first.'); }
for (const [command, args] of [
  [process.execPath, ['src/verify-response.ts']],
  ['node_modules/.bin/forge', ['test', '--match-test', 'testRealAirnodeResponse', '-vv']],
] as const) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('PASS: genuine signed USGS data authenticated and read by Solidity.');
