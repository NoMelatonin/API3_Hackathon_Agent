import {
  chain,
  verifyRuntime,
  client,
  organizationIds,
  organizationScope,
} from './chain.ts';
for (const id of organizationIds)
  await organizationScope.run(id, async () => {
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
          organization: id,
          chainId: await client.getChainId(),
          fund: c.config.fund,
          runtimeAndRegistry: 'verified',
          balance: String(balance),
          reserved: String(reserved),
          paid: String(paid),
          oracleMode: c.config.oracleMode,
          simulatedRoles: true,
        },
        null,
        2,
      ),
    );
  });
