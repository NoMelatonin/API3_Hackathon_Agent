import type { Address } from 'viem';
import { deriveRequestHash, type AirnodeV2Request } from './vendor/airnode-v2.ts';

export const AIRNODE_URL = 'https://airnode-usgs.fly.dev/';
// From the Airnode's machine-readable documentation, not a response supplied by a relayer.
export const AIRNODE_SIGNER: Address = '0x5aF744115e2577513D878D4263Db73b3E77E7630';
export const EVENT_ID = 'us6000jllz';
export const REQUEST: AirnodeV2Request = {
  operation: 'queryEvents',
  parameters: { format: 'geojson', eventid: EVENT_ID },
  responseProjection: {
    eventId: '/id', magnitude: '/properties/mag', eventTime: '/properties/time',
    latitude: '/geometry/coordinates/1', longitude: '/geometry/coordinates/0',
    status: '/properties/status', eventType: '/properties/type',
  },
};
// A genuinely different request for the official tamper demo, using the same known event.
export const OTHER_REQUEST: AirnodeV2Request = {
  ...REQUEST, responseProjection: { ...REQUEST.responseProjection, depth: '/geometry/coordinates/2' },
};
export const REQUEST_HASH = deriveRequestHash(REQUEST);
