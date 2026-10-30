import { createHash } from 'node:crypto';
export const POLICY = Object.freeze({
  version: 'v3.1',
  roundSeconds: 21600,
  reserveBps: 2000,
  restrictedBps: 9000,
  cap: 4_500_000_000n,
  reference: 2_000_000_000n,
  claimSeconds: 86400,
  voteSeconds: 259200,
  cooldownSeconds: 604800,
});
export type Hazard = 'earthquake' | 'storm' | 'flood' | 'health' | 'slow';
export type Situation = 'signals' | 'clear' | 'unknown' | 'conflicting';
export type BBox = readonly [number, number, number, number]; // west, south, east, north; no dateline crossing
export interface Area {
  id: string;
  version: number;
  name: string;
  country: string;
  bbox: BBox;
  hazards: Hazard[];
}
export interface Observation {
  id: string;
  canonicalId: string;
  source: string;
  hazard: Hazard;
  time: number;
  bbox: BBox;
  severity: number | null;
  url: string;
  rawCommitment: string;
}
export interface Coverage {
  source: string;
  areaId: string;
  areaVersion: number;
  hazards: Hazard[];
  start: number;
  end: number;
  checkedAt: number;
  status: 'ok' | 'failed' | 'unsupported';
  pages: number;
  complete: boolean;
  observations: Observation[];
  error?: string;
}
export interface Assessment {
  id: string;
  ngo: string;
  incident: string;
  areaVersion: number;
  modelVersion: string;
  sourceCommitment: string;
  maximum: string;
  expires: number;
  nonce: number;
  deadlineDays: number;
  interimDays: 7;
  manual: boolean;
  explanation: string;
}
export interface Participant {
  id: string;
  ngo: string;
  incident: string;
  weight: bigint;
  maximum: bigint;
  requested: bigint | null;
  capacity: bigint;
  paid: bigint;
  reserved: bigint;
  external: bigint;
  blocked: boolean;
}
export function commitment(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) =>
                Buffer.compare(Buffer.from(a), Buffer.from(b)),
              )
              .map(([k, x]) => [k, canonical(x)]),
          )
        : typeof v === 'bigint'
          ? v.toString()
          : v;
  return (
    '0x' +
    createHash('sha256')
      .update(JSON.stringify(canonical(value)))
      .digest('hex')
  );
}
export function overlaps(a: BBox, b: BBox) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
export const deadlineDays = (hazard: Hazard, severe: boolean) =>
  hazard === 'health'
    ? severe
      ? 60
      : 45
    : hazard === 'slow'
      ? severe
        ? 90
        : 60
      : severe
        ? 45
        : 30;
export function situation(
  area: Area,
  snapshots: Coverage[],
  now: number,
): Situation {
  // A source profile for every registered hazard is required, including successful zero-result searches.
  const valid = snapshots.filter(
    (s) =>
      s.areaId === area.id &&
      s.areaVersion === area.version &&
      s.status === 'ok' &&
      s.complete &&
      s.pages > 0 &&
      s.checkedAt <= now &&
      now - s.checkedAt <= 3600 &&
      s.end >= now - 3600 &&
      s.start <= now - 86400,
  );
  if (area.hazards.some((h) => !valid.some((s) => s.hazards.includes(h))))
    return 'unknown';
  const observations = valid
    .flatMap((s) => s.observations)
    .filter((o) => overlaps(o.bbox, area.bbox));
  const perId = new Map<string, Observation>();
  for (const o of observations) {
    const prev = perId.get(o.canonicalId);
    if (prev && (prev.hazard !== o.hazard || !overlaps(prev.bbox, o.bbox)))
      return 'conflicting';
    perId.set(o.canonicalId, o);
  }
  return observations.length ? 'signals' : 'clear';
}
