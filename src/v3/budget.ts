import { integratedBudget } from './deploy-budget.ts';
import { account, organizationIds, organizationScope } from './chain.ts';
import { oraclePolicies } from './oracle.ts';
import { testnet } from './profile.ts';
if (!testnet)
  throw new Error(
    'Fee estimate is for DISASTERDAO_PROFILE=testnet; local Anvil uses valueless prefunded accounts',
  );
for (const id of organizationIds)
  await organizationScope.run(id, async () => {
    const offset = id === 'local-alliance' ? 0 : 13;
    const addresses = [
      account(0).address,
      ...Array.from({ length: 12 }, (_, i) => account(i + 1 + offset).address),
    ];
    console.log(
      JSON.stringify(
        {
          organization: id,
          ...(await integratedBudget(
            addresses,
            oraclePolicies(),
            id === 'local-alliance' ? 18000_000000n : 9000_000000n,
          )),
        },
        (_k, v) => (typeof v === 'bigint' ? String(v) : v),
        2,
      ),
    );
  });
