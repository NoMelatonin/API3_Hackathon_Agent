import { mkdir, writeFile } from 'node:fs/promises';
import { artifact } from './deployment.ts';
await mkdir('web', { recursive: true });
await writeFile('web/contracts.json', JSON.stringify({
  fund: (await artifact('DisasterFund')).abi, token: (await artifact('DemoUSD')).abi,
}, null, 2) + '\n');

await writeFile('web/contracts-v2.json', JSON.stringify({
  fund: (await artifact('DisasterFundV2')).abi, token: (await artifact('DemoUSDV2')).abi,
}, null, 2) + '\n');
