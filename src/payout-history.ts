import type { Hex } from 'viem';

export interface Payout {
  ngo: string; amount: bigint; path: number; hash: Hex; block: bigint; logIndex: number;
}
export const payoutId = (entry: Payout) => `${entry.hash}:${entry.logIndex}`;

/** A router can pay several NGOs in one transaction. Identify events, not transactions. */
export function mergePayouts(entries: Payout[]): Payout[] {
  return [...new Map(entries.map(entry => [payoutId(entry), entry])).values()]
    .sort((a, b) => a.block === b.block ? b.logIndex - a.logIndex : a.block > b.block ? -1 : 1);
}
