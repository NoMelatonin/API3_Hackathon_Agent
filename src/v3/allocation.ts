import { POLICY, commitment, type Participant } from './domain.ts';
const min = (...xs: bigint[]) => xs.reduce((a, b) => (a < b ? a : b));
const positive = (x: bigint) => (x > 0n ? x : 0n);
export function allocate(
  participants: Participant[],
  balance: bigint,
  reserved: bigint,
  uncertain: boolean,
  competing: boolean,
) {
  if (balance < 0n || reserved < 0n || reserved > balance)
    throw new Error('Invalid balance snapshot');
  if (new Set(participants.map((p) => p.id)).size !== participants.length)
    throw new Error('Duplicate work package');
  // Overlapping populations must have been deduplicated by data reviewers before weight is attested.
  const free = balance - reserved;
  const hold = uncertain ? (free * BigInt(POLICY.reserveBps)) / 10000n : 0n;
  const budget = free - hold;
  const ordered = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  const rows = ordered.map((p) => {
    if (
      [
        p.weight,
        p.maximum,
        p.capacity,
        p.paid,
        p.reserved,
        p.external,
        ...(p.requested === null ? [] : [p.requested]),
      ].some((v) => v < 0n)
    )
      throw new Error('Negative amount');
    const max =
      (min(p.maximum, POLICY.cap) *
        (uncertain || competing ? BigInt(POLICY.restrictedBps) : 10000n)) /
      10000n;
    const gap = positive(max - p.paid - p.reserved - p.external);
    return {
      id: p.id,
      ngo: p.ngo,
      incident: p.incident,
      provisional: p.requested === null,
      weight: p.weight,
      limit: p.blocked ? 0n : min(gap, p.capacity, p.requested ?? gap),
      amount: 0n,
    };
  });
  let remaining = budget;
  while (remaining > 0n) {
    const active = rows.filter((r) => r.amount < r.limit && r.weight > 0n);
    if (!active.length) break;
    const total = active.reduce((s, r) => s + r.weight, 0n);
    const pool = remaining;
    let used = 0n;
    const remainders = active.map((r) => {
      const raw = pool * r.weight;
      const share = min(raw / total, r.limit - r.amount);
      r.amount += share;
      used += share;
      return { r, rem: raw % total };
    });
    remaining -= used;
    if (remaining === 0n) break;
    remainders.sort((a, b) =>
      a.rem === b.rem ? a.r.id.localeCompare(b.r.id) : a.rem > b.rem ? -1 : 1,
    );
    for (const { r } of remainders)
      if (remaining > 0n && r.amount < r.limit) {
        r.amount++;
        remaining--;
      }
  }
  const result = {
    policy: POLICY.version,
    balance: balance.toString(),
    alreadyReserved: reserved.toString(),
    uncertain,
    competing,
    hold: hold.toString(),
    budget: budget.toString(),
    unallocated: remaining.toString(),
    rows: rows.map((r) => ({
      ...r,
      weight: r.weight.toString(),
      limit: r.limit.toString(),
      amount: r.amount.toString(),
    })),
  };
  return { ...result, snapshot: commitment({ participants: ordered, result }) };
}
