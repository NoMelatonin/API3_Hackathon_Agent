/** Base's public RPC allows at most 200 blocks per eth_getLogs request. */
export async function logPages<T>(from: bigint, to: bigint, load: (from: bigint, to: bigint) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  for (let cursor = from; cursor <= to; cursor += 800n) {
    const pages: Promise<T[]>[] = [];
    for (let offset = 0n; offset < 800n && cursor + offset <= to; offset += 200n) {
      const start = cursor + offset;
      pages.push(load(start, start + 199n < to ? start + 199n : to));
    }
    for (const page of await Promise.all(pages)) result.push(...page);
  }
  return result;
}
