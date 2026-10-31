import { encodePacked, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { SignedResponse } from '../vendor/airnode-v2.ts';
export async function tamperCases(
  genuine: SignedResponse,
  old: SignedResponse,
  other: SignedResponse,
  requestHash: Hex,
) {
  const match = genuine.data.match(
    /"(?:magnitude|windSpeed|severity)"\s*:\s*(-?\d+(?:\.\d+)?)/,
  );
  if (!match)
    throw new Error(
      'No numeric hazard value found; refusing a fake edited-value test',
    );
  const edited = genuine.data.replace(
    match[0],
    match[0].slice(0, -match[1]!.length) + String(Number(match[1]) + 1),
  );
  if (other.requestHash === requestHash)
    throw new Error('Other fixture must answer a different request');
  const signature = await privateKeyToAccount(
    `0x${'1'.padStart(64, '0')}`,
  ).signMessage({
    message: {
      raw: keccak256(
        encodePacked(
          ['bytes32', 'uint256', 'bytes'],
          [requestHash, BigInt(genuine.timestamp), toHex(genuine.data)],
        ),
      ),
    },
  });
  return [
    {
      name: 'edited-value',
      proof: { ...genuine, data: edited },
      expected: 'NotSignedByAirnode',
    },
    { name: 'too-old', proof: old, expected: 'OracleStale' },
    { name: 'another-request', proof: other, expected: 'NotSignedByAirnode' },
    {
      name: 'wrong-key',
      proof: { ...genuine, signature },
      expected: 'NotSignedByAirnode',
    },
  ];
}
