export interface Activity {
  kind: string;
  tx: string;
  logIndex: number;
  block: string;
  time: number;
  actor?: string;
  amount?: string;
  evidenceId?: string;
}
export interface Snapshot {
  chainId: number;
  fund: string;
  block: string | null;
  hash: string | null;
  time: number | null;
  status: 'confirmed' | 'stale' | 'unavailable';
}
export interface Organization {
  id: string;
  name: string;
  description: string;
  members: { id: string; name: string; wallet: string }[];
  areas: { id: string; name: string; country: string }[];
  images: { src: string; alt: string; altEn: string }[];
  snapshot: Snapshot;
  funds: {
    balance: string;
    reserved: string;
    free: string;
    paid: string;
  } | null;
  support: {
    donor: string;
    total: string;
    count: number;
    supported: boolean | null;
  };
  reports: {
    id: string;
    title: string;
    text: string;
    ngo: string;
    provenance: string;
  }[];
}
export interface ActivityPage {
  snapshot: Snapshot;
  items: Activity[];
  next: number | null;
}
export interface SupportPage extends ActivityPage {
  donor: string;
  total: string;
  count: number;
}
export interface Preview {
  proposedMaximum: string;
  manual: boolean;
  remaining: string;
  estimated: string;
  paid: string;
  reserved: string;
  blocked: boolean;
  chainTime: number;
  balance: string;
  budget: string;
  uncertain: boolean;
  competing: boolean;
}
export interface ApprovalBundle {
  schema: 1;
  purpose: string;
  target: string;
  chainId: number;
  fund: string;
  context?: Record<string, unknown>;
  payload: `0x${string}`;
  signatures: `0x${string}`[];
}
