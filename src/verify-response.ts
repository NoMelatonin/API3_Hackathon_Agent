import { readFile } from 'node:fs/promises';
import { AIRNODE_SIGNER, EVENT_ID, REQUEST_HASH } from './usgs.ts';
import { verifySignedResponse, type SignedResponse } from './vendor/airnode-v2.ts';

const filename = process.argv[2] ?? 'fixtures/usgs-real.json';
const response: SignedResponse = JSON.parse(await readFile(filename, 'utf8'));
await verifySignedResponse(response, AIRNODE_SIGNER, REQUEST_HASH);
const data = JSON.parse(response.data);
if (data.eventId !== EVENT_ID || data.eventType !== 'earthquake' || data.status !== 'reviewed') {
  throw new Error('Unexpected USGS event, event type or review status');
}
if (typeof data.magnitude !== 'number' || typeof data.eventTime !== 'number') throw new Error('Missing numeric fields');
console.log('Authentic USGS response for the configured request. No application freshness check performed.');
console.log({ signer: AIRNODE_SIGNER, requestHash: REQUEST_HASH, signedAt: response.timestamp, data });
