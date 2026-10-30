import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPrivateKey } from './private-key.ts';
import { AIRNODE_SIGNER, AIRNODE_URL, OTHER_REQUEST, REQUEST, REQUEST_HASH } from './usgs.ts';
import { deriveRequestHash, fetchSignedResponse, verifySignedResponse } from './vendor/airnode-v2.ts';
import { createPayingFetch, readPaymentSettlement } from './vendor/x402.ts';

const key = readPrivateKey(process.env.PAYER_PRIVATE_KEY);
const other = process.argv.includes('--other');
const request = other ? OTHER_REQUEST : REQUEST;
const fileIndex = process.argv.indexOf('--out');
const output = process.argv[fileIndex + 1];
if (fileIndex !== -1 && (!output || output.startsWith('--'))) throw new Error('--out requires a path');
const filename = fileIndex !== -1 ? output! : `fixtures/usgs-${other ? 'other' : 'real'}.json`;
const paidFetch = createPayingFetch(key);
const fetchWithReceipt: typeof fetch = async (input, init) => {
  const response = await paidFetch(input, { ...init, signal: AbortSignal.timeout(60_000) });
  const settlement = readPaymentSettlement(response);
  if (settlement) console.error('x402 settlement:', JSON.stringify(settlement));
  return response;
};
const response = await fetchSignedResponse(AIRNODE_URL, request, fetchWithReceipt);
await verifySignedResponse(response, AIRNODE_SIGNER, other ? deriveRequestHash(request) : REQUEST_HASH);
// Preserve response.data exactly as signed; JSON wrapping does not change its bytes.
await mkdir(resolve(filename, '..'), { recursive: true });
await writeFile(filename, JSON.stringify(response, null, 2) + '\n', { flag: 'wx' });
console.log(`Saved verified real Airnode response to ${filename}`);
console.log(`Signed at ${new Date(Number(response.timestamp) * 1000).toISOString()}`);
console.log('Historical observation:', JSON.parse(response.data));
