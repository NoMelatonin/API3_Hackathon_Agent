import type { State, Role, App } from './state.ts';
import {
  allocationSnapshot,
  model,
  now,
  must,
  requireRole,
} from './service.ts';
import { POLICY } from '../src/v3/domain.ts';
import type { Preview } from '../src/v3/ui-types.ts';
export async function previewApplication(
  s: State,
  role: Role,
  input: {
    incident: string;
    requested: string;
    capacity: string;
    external: string;
  },
): Promise<Preview> {
  requireRole(role, 'ngo');
  for (const x of [input.requested, input.capacity, input.external])
    must(/^\d{1,12}$/.test(x), 'Integer token subunits required');
  const time = await now(),
    m = model(s, input.incident, time, role.ngo);
  const maximum = m.demoMaximum ?? String(POLICY.cap);
  must(
    BigInt(input.requested) > 0n &&
      BigInt(input.requested) <= BigInt(maximum) &&
      BigInt(input.capacity) > 0n &&
      BigInt(input.capacity) <= BigInt(maximum),
    'Requested amount or capacity exceeds proposed maximum',
  );
  const draft = {
    ...input,
    ngo: role.ngo!,
    maximum,
    status: 'reviewed',
  } as App;
  const { result, participants } = await allocationSnapshot(s, draft);
  const p = participants.find(
    (p) => p.ngo === role.ngo && p.incident === input.incident,
  )!;
  const row = result.rows.find(
    (r) => r.ngo === role.ngo && r.incident === input.incident,
  )!;
  const restricted =
    (BigInt(maximum) *
      (result.uncertain || result.competing ? 9000n : 10000n)) /
    10000n;
  const gap = restricted - p.paid - p.reserved - p.external;
  return {
    proposedMaximum: maximum,
    manual: m.demoMaximum === null,
    remaining: String(gap > 0n ? gap : 0n),
    estimated: row.amount,
    paid: String(p.paid),
    reserved: String(p.reserved),
    blocked: p.blocked,
    chainTime: time,
    balance: result.balance,
    budget: result.budget,
    uncertain: result.uncertain,
    competing: result.competing,
  };
}
