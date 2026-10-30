import { chain, verifyRuntime, client } from './chain.ts';
const c = await chain();
await verifyRuntime(c.config);
const [balance, reserved, paid] = await Promise.all([
  c.balance(),
  c.read('totalReserved') as Promise<bigint>,
  c.read('totalPaid') as Promise<bigint>,
]);
if (reserved > balance) throw new Error('Uncovered reservations');
console.log(
  JSON.stringify(
    {
      chainId: await client.getChainId(),
      runtimeAndRegistry: 'verified',
      balance: String(balance),
      reserved: String(reserved),
      paid: String(paid),
      simulation: true,
    },
    null,
    2,
  ),
);
