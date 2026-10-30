import { campaigns, campaignHashes } from './campaigns.ts';

export const campaignConfig = campaigns.map((c, i) => ({
  airnode: c.signer, requestHash: campaignHashes[i]!, threshold: BigInt(c.threshold) * 1_000_000n,
  cap: BigInt(c.cap) * 1_000_000n, minimum: 500_000_000n, maximum: 2_000_000_000n,
  oracleEnabled: i !== 2,
}));
