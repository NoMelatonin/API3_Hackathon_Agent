import { isHex, type Hex } from 'viem';

/** Accept wallet exports with or without 0x; never include a secret in errors. */
export function readPrivateKey(value: string | undefined): Hex {
  const trimmed = value?.trim() ?? '';
  const key = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!isHex(key) || key.length !== 66 || BigInt(key) === 0n ||
      BigInt(key) >= 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n) {
    throw new Error('Configure a valid dedicated testwallet private key locally in .env (64 hex digits, optional 0x).');
  }
  return key as Hex;
}
