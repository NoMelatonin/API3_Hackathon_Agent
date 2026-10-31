import { client, chain } from './chain.ts';
import { testActions } from 'viem';
if ((await client.getChainId()) !== 31337)
  throw new Error('Clock only permits local chain 31337');
await chain();
const arg = process.argv.indexOf('--seconds');
const seconds = Number(process.argv[arg + 1]);
if (
  arg < 0 ||
  !Number.isSafeInteger(seconds) ||
  seconds < 1 ||
  seconds > 90 * 86400
)
  throw new Error('Use --seconds 1..7776000; isolated local V3 clock only');
const block = await client.getBlock();
const tester = client.extend(testActions({ mode: 'anvil' }));
await tester.setNextBlockTimestamp({
  timestamp: block.timestamp + BigInt(seconds),
});
await tester.mine({ blocks: 1 });
console.log(
  'Only local V3 chain time advanced. No original source timestamp or public chain changed.',
);
