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

export interface AutomaticPreview {
  remaining: string;
  fundFree: string;
  uncertaintyReserve: string;
  amount: string;
  provisional: string;
  nextRound: number;
  chainTime: number;
  blocked: boolean;
  paid: string;
  peak: string;
  synthetic: boolean;
  available: boolean;
  authorized: boolean;
  severity: string;
  sourceStatus: string;
  rule: string;
  source: {
    signer: string;
    requestHash: string;
    eventId: string;
    observedAt: string | number | null;
    signedAt: number | null;
    unit: string;
  };
}
export interface WorkflowCase {
  id: string;
  incident: string;
  explanation: string;
  automatic: boolean;
  step: 3 | 4 | 5;
  actor:
    | 'ngo'
    | 'data_reviewers'
    | 'evidence_reviewers'
    | 'appeal_reviewers'
    | 'operator_and_data_reviewers';
  action: string;
  reasonCodes: string[];
  blockingEvidence: number[];
  requested: string;
  reserved: string;
  paid: string;
  reservationId?: number;
  evidenceId?: number;
  deadline?: number;
  nextRound: number;
  votes: number;
  requiredVotes: number;
  confirmed: boolean;
  tx?: string;
}
