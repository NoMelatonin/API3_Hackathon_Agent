import { client } from '../src/v3/chain.ts';
import { testActions } from 'viem';
import { buildGateway } from './gateway.ts';
const { app, work } = await buildGateway();
await app.listen({ host: '127.0.0.1', port: 3007 });
console.log('V3: two isolated local demo alliances, http://127.0.0.1:3007');
await work();
const timer = setInterval(work, 30000);
// Explicit local demo clock. Regular workers never mine blocks or advance time.
let clockBusy = false;
const clock =
  process.env.V3_DEMO_CLOCK === '1'
    ? setInterval(async () => {
        if (clockBusy) return;
        clockBusy = true;
        try {
          if ((await client.getChainId()) !== 31337)
            throw new Error('Demo clock requires local chain 31337');
          await client
            .extend(testActions({ mode: 'anvil' }))
            .mine({ blocks: 1 });
          await work();
        } catch (error) {
          console.error('Demo clock:', error);
        } finally {
          clockBusy = false;
        }
      }, 2000)
    : undefined;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    clearInterval(timer);
    if (clock) clearInterval(clock);
    await app.close();
    process.exit(0);
  });
