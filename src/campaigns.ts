import type { Address } from 'viem';
import { AIRNODE_SIGNER, AIRNODE_URL, REQUEST } from './usgs.ts';
import { deriveRequestHash, type AirnodeV2Request } from './vendor/airnode-v2.ts';

const eonet: AirnodeV2Request = {
  operation: 'getEvent', parameters: { id: 'EONET_22386' },
  responseProjection: {
    eventId: '/id', category: '/categories/0/id', source: '/sources/0/id',
    observedAt: '/geometry/0/date', geometryType: '/geometry/0/type',
    latitude: '/geometry/0/coordinates/1', longitude: '/geometry/0/coordinates/0',
    windSpeed: '/geometry/0/magnitudeValue', unit: '/geometry/0/magnitudeUnit',
  },
};
const who: AirnodeV2Request = {
  operation: 'getIndicatorData', parameters: {
    indicator: 'MALARIA_EST_INCIDENCE',
    '$filter': "SpatialDim eq 'NGA' and TimeDim eq 2022 and Dim1 eq null and Dim2 eq null and Dim3 eq null",
    '$count': true, '$top': 2,
  },
  responseProjection: {
    count: '/@odata.count', recordId: '/value/0/Id', indicator: '/value/0/IndicatorCode',
    spatialType: '/value/0/SpatialDimType', country: '/value/0/SpatialDim', year: '/value/0/TimeDim',
    dim1: '/value/0/Dim1', dim2: '/value/0/Dim2', dim3: '/value/0/Dim3',
    incidence: '/value/0/NumericValue', low: '/value/0/Low', high: '/value/0/High',
  },
};
export const campaigns = [
  { id: 0, name: 'Türkei · Erdbeben', provider: 'USGS', url: AIRNODE_URL, signer: AIRNODE_SIGNER, request: REQUEST,
    threshold: 7, cap: 8, unit: 'Magnitude', field: 'magnitude', curve: 'energy', date: '06.02.2023' },
  { id: 1, name: 'Tropical Storm 15W', provider: 'NASA EONET', url: 'https://airnode-eonet.fly.dev/',
    signer: '0x84A69892825178Fb1602fb78412E21728efee6a6' as Address, request: eonet,
    threshold: 34, cap: 64, unit: 'kts', field: 'windSpeed', curve: 'square', date: '10.08.2026 · 06:00 UTC' },
  { id: 2, name: 'Nigeria · Malariaprävention', provider: 'WHO GHO', url: 'https://airnode-who.fly.dev/',
    signer: '0x94df063Cd4D240075c9DBc2494e9e2787A7bB864' as Address, request: who,
    threshold: 100, cap: 300, unit: 'Fälle / 1.000 Risikopersonen / Jahr', field: 'incidence', curve: 'linear', date: 'Jahr 2022' },
] as const;
export const campaignHashes = campaigns.map(c => deriveRequestHash(c.request));
export const TOTAL_BUDGET = 18_000_000_000n;
