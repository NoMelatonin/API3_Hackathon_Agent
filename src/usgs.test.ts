import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRNODE_SIGNER, OTHER_REQUEST, REQUEST, REQUEST_HASH } from './usgs.ts';
import { deriveRequestHash, verifySignedResponse } from './vendor/airnode-v2.ts';
import { keccak256, encodePacked, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

test('fixed USGS request includes exactly the fields required by the historical scenario', () => {
  assert.deepEqual(REQUEST.parameters, { format: 'geojson', eventid: 'us6000jllz' });
  assert.equal(REQUEST_HASH, '0x226b958e9cea51240281d38535b7a0661ed95b7a21f978a122bf442ca7b8522c');
  assert.notEqual(deriveRequestHash(OTHER_REQUEST), REQUEST_HASH);
});

test('an attestation cannot select its own trusted signer', async () => {
  // Public test-only key. Never funded, never used for payments or deployment.
  const account = privateKeyToAccount(`0x${'1'.padStart(64, '0')}`);
  const data = '{"magnitude":7.8}';
  const timestamp = '1793370000';
  const digest = keccak256(encodePacked(['bytes32', 'uint256', 'bytes'], [REQUEST_HASH, BigInt(timestamp), toHex(data)]));
  const signature = await account.signMessage({ message: { raw: digest } });
  await assert.rejects(verifySignedResponse({ airnode: account.address, requestHash: REQUEST_HASH, timestamp, data, signature },
    AIRNODE_SIGNER, REQUEST_HASH), /not by/);
});
