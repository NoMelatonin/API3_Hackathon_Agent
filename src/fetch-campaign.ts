import { option } from './deployment.ts';
import { campaigns, campaignHashes } from './campaigns.ts';
import { readPrivateKey } from './private-key.ts';
import { writeNewOutput } from './new-output.ts';
import { createPayingFetch } from './vendor/x402.ts';
import { fetchSignedResponse, verifySignedResponse } from './vendor/airnode-v2.ts';

const id = Number(option('--campaign', '0'));
const campaign = campaigns[id];
if (!campaign) throw new Error('--campaign must be 0, 1 or 2');
const filename = option('--out');
if (!filename) throw new Error('--out NEW_PATH required; original evidence is never overwritten');
await writeNewOutput(filename, async () => {
  const paid = createPayingFetch(readPrivateKey(process.env.PAYER_PRIVATE_KEY));
  const timed: typeof fetch = (input, init) => paid(input, { ...init, signal: AbortSignal.timeout(45_000) });
  const response = await fetchSignedResponse(campaign.url, campaign.request, timed);
  await verifySignedResponse(response, campaign.signer, campaignHashes[id]!);
  console.log(`${campaign.provider}: authentic signature verified. Application validation is separate.`);
  return JSON.stringify(response, null, 2) + '\n';
});
