import { oracleMode } from '../src/v3/profile.ts';
import { type Area, type Coverage, type Hazard } from '../src/v3/domain.ts';
import { roleAddress, organizationId } from '../src/v3/chain.ts';
export interface Role {
  id: string;
  kind: 'ngo' | 'data' | 'evidence' | 'appeal';
  index: number;
  ngo?: string;
  name: string;
}
export const roles: Role[] = [
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `ngo-${i + 1}`,
    kind: 'ngo' as const,
    index: i + 1,
    ngo: roleAddress(i + 1),
    name: ['Relief North', 'Health Bridge', 'Shelter Collective'][i]!,
  })),
  ...(['data', 'evidence', 'appeal'] as const).flatMap((kind, k) =>
    Array.from({ length: 3 }, (_, i) => ({
      id: `${kind}-${i + 1}`,
      kind,
      index: 4 + k * 3 + i,
      name: `${kind} ${i + 1}`,
    })),
  ),
];
export interface OperatingPackage {
  id: string;
  version: 1;
  ngo: string;
  areaId: string;
  service: 'essential-relief';
  sector: number;
  sectors: 3;
  synthetic: true;
}
export interface Incident {
  id: string;
  name: string;
  hazard: Hazard;
  areaId: string;
  people: [number, number];
  features: number[];
  synthetic: boolean;
}
export interface App {
  oracleProof?: import('../src/vendor/airnode-v2.ts').SignedResponse;
  automatic?: boolean;
  id: string;
  version: number;
  ngo: string;
  incident: string;
  requested: string;
  capacity: string;
  external: string;
  explanation: string;
  change: string;
  conflicts: number;
  nonce: number;
  createdAt: number;
  expires: number;
  maximum: string;
  deadlineDays: number;
  sources: string;
  votes: string[];
  chainId?: number;
  tx?: string;
  status:
    'submitted' | 'reviewed' | 'reserved' | 'paid' | 'expired' | 'rejected';
}
export interface Doc {
  category?: 'expenditure-evidence' | 'external-review';
  id: string;
  evidenceId: number;
  ngo: string;
  name: string;
  mime: string;
  size: number;
  uploaded: boolean;
  digest?: string;
  salt: string;
  createdAt: number;
}
export interface Review {
  superseded?: boolean;
  documentId?: string;
  binding?: { manifest: string; status: number; due: number };
  external?: boolean;
  id: string;
  kind: 'receipt' | 'review' | 'extend' | 'resolve' | 'followup';
  evidenceId: number;
  applicationId?: string;
  manifest: string;
  reason: string;
  decision: number;
  receivedAt: number;
  days: number;
  votes: string[];
  tx?: string;
}
export interface Round {
  id: string;
  version: number;
  createdAt: number;
  expires: number;
  nonce: number;
  balance: string;
  reserved: string;
  uncertain: boolean;
  competing: boolean;
  provisional: string;
  snapshot: string;
  grants: { application: bigint | string; amount: bigint | string }[];
  explanation: unknown;
  votes: string[];
  tx?: string;
}
export interface Report {
  id: string;
  ngo: string;
  evidenceId: number;
  title: string;
  text: string;
  provenance: string;
  rights: string;
  protection: string;
  approvedBy: string[];
  published: boolean;
}
export interface State {
  schema: 1;
  registryVersion: 1;
  alliance: { id: string; name: string };
  roles: Role[];
  areas: Area[];
  packages: OperatingPackage[];
  incidents: Incident[];
  coverage: Coverage[];
  conflicts: { roleId: string; target: string; reason: string }[];
  interim: {
    evidenceId: number;
    ngo: string;
    text: string;
    at: number;
  }[];
  coverageDecisions: {
    id: string;
    areaId: string;
    reason: string;
    time: number;
    votes: string[];
  }[];
  apps: App[];
  documents: Doc[];
  reviews: Review[];
  rounds: Round[];
  reports: Report[];
  reminders: { evidenceId: number; kind: string; at: number }[];
  worker: { at: number; status: string; error?: string };
  indexer: { block: string; hash: string; status: string };
}
export function seed(): State {
  const community = organizationId() === 'community-alliance';
  const localRoles = roles.map((r) => ({
    ...r,
    ...(community
      ? {
          id: 'community-' + r.id,
          index: r.index + 13,
          ...(r.ngo ? { ngo: roleAddress(r.index + 13) } : {}),
          name:
            r.kind === 'ngo'
              ? ['Community Rescue', 'Mobile Care', 'Safe Haven'][r.index - 1]!
              : r.name,
        }
      : {}),
  }));
  return {
    schema: 1,
    registryVersion: 1,
    alliance: {
      id: organizationId(),
      name: community
        ? 'Community Response Alliance'
        : 'DisasterDAO Relief Alliance',
    },
    roles: localRoles,
    areas: [
      {
        id: 'turkiye',
        version: 1,
        name: 'Synthetic southern Türkiye area',
        country: 'TR',
        bbox: [35, 36, 39, 39],
        hazards: ['earthquake', 'flood', 'health'],
      },
      {
        id: 'philippines',
        version: 1,
        name:
          oracleMode === 'live'
            ? 'Historical Pacific storm test area'
            : 'Synthetic Philippines area',
        country: oracleMode === 'live' ? 'ZZ' : 'PH',
        bbox: oracleMode === 'live' ? [160, 26, 162, 29] : [120, 10, 125, 18],
        hazards: ['storm', 'flood', 'health'],
      },
      {
        id: 'mozambique',
        version: 1,
        name: 'Synthetic Mozambique area',
        country: 'MZ',
        bbox: [32, -26, 40, -11],
        hazards: ['storm', 'flood', 'health'],
      },
    ],
    packages: localRoles
      .filter((r) => r.kind === 'ngo')
      .flatMap((r, sector) =>
        ['turkiye', 'philippines', 'mozambique'].map((areaId) => ({
          id: `${r.id}/${areaId}/essential-relief`,
          version: 1 as const,
          ngo: r.ngo!,
          areaId,
          service: 'essential-relief' as const,
          sector,
          sectors: 3 as const,
          synthetic: true as const,
        })),
      ),
    incidents: [
      {
        id: 'demo-quake',
        name:
          oracleMode === 'live'
            ? 'Historical Türkiye earthquake · USGS us6000jllz'
            : 'Synthetic earthquake response',
        hazard: 'earthquake',
        areaId: 'turkiye',
        people: [1000, 1800],
        features: [7.1, 150, 0.7, 0.7, 1],
        synthetic: oracleMode !== 'live',
      },
      {
        id: 'demo-storm',
        name:
          oracleMode === 'live'
            ? 'Historical Pacific storm 15W · EONET_22386'
            : 'Synthetic storm response',
        hazard: 'storm',
        areaId: 'philippines',
        people: [1200, 2200],
        features: [100, 200, 0.6, 0.5, 1],
        synthetic: oracleMode !== 'live',
      },
      {
        id: 'demo-flood',
        name: 'Synthetic flood response',
        hazard: 'flood',
        areaId: 'mozambique',
        people: [800, 1500],
        features: [2, 100, 0.4, 0.4, 1],
        synthetic: true,
      },
      {
        id: 'demo-health',
        name: 'Synthetic acute health response',
        hazard: 'health',
        areaId: 'mozambique',
        people: [800, 1500],
        features: [1, 100, 0.4, 0.4, 1],
        synthetic: true,
      },
    ],
    coverage: [],
    conflicts: [],
    interim: [],
    coverageDecisions: [],
    apps: [],
    documents: [],
    reviews: [],
    rounds: [],
    reports: [],
    reminders: [],
    worker: { at: 0, status: 'not-run' },
    indexer: { block: '0', hash: '', status: 'not-run' },
  };
}
