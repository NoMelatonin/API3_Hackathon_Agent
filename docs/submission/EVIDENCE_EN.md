# DisasterDAO — current public evidence

Prepared 31 October 2026. This document describes the integrated product and the newer transactions recorded for the demo. Older V1 evidence is historical.

## Deployment

| Item | Value |
| --- | --- |
| Network | Base Sepolia |
| Chain ID | 84532 |
| Main integrated fund | `0x31b632b6b01d486c5c7081423950f4a6edd58728` |
| Fund token, 6 decimals | `0x2bea3622c9c76c473ea974588e85b0bdb1af3e64` |
| Oracle verifier | `0x8Df20BA332BD8eF588af73106Aad4Dd8CB934D79` |
| Second alliance fund | `0xff80001619324e2f99079ce246a89a7fa53effc5` |
| Recorded recipient, simulated NGO 3 | `0x7c4290bB313e7c856E8930828f361915C12CE337` |

[Main deployment manifest](../../deployments/integrated-base-sepolia.json) · [second alliance](../../deployments/integrated-base-sepolia-community.json).

## On-chain flow recorded for the video

| Step | Block | Transaction |
| --- | --- | --- |
| Application | 52627323 | [0xd01c9331…](https://sepolia.basescan.org/tx/0xd01c9331cfac5d835aa65a4e242d46b3c53b947f17f4f929b1bc00290f76c20d) |
| Reservation | 52627479 | [0x90e7e6f7…](https://sepolia.basescan.org/tx/0x90e7e6f7e84954f7c23a9bdc5b2feee4c7e151da89090decfebc14f05feb2fa7) |
| Claim / payout | 52627549 | [0x57de8728…](https://sepolia.basescan.org/tx/0x57de87282f6244a575ee0774aafd52bcd9da6139037457b820c98cb67256b300) |

The recipient balance increased by **500,000,000 token units = 500 dUSD**. All three receipts succeeded. The original signatures were 27 seconds old at application and 19 seconds old at reservation. The earthquake is historical, 6 February 2023; those signatures were freshly obtained on 31 October 2026.

[Recorded evidence report](evidence/video-evidence.json) contains the original recording's read-only verification, freshness and contract-result records. [Submission-time read-only recheck](evidence/chain-check.json) independently reconfirmed deployed code, chain ID, the three successful receipts and the 500-dUSD balance increase at the payout block. It did not send another transaction or rerun the tamper tests.

Public original response files: [application](evidence/video-usgs-application.json), [reservation](evidence/video-usgs-reservation.json). These retain their original signed data strings and timestamps. They are historical evidence, not fresh inputs for a new action today.

## Recorded valid control and four exact rejections

| Recorded case | Block | Result |
| --- | --- | --- |
| Valid fresh original | 52625298 | `accepted: true` |
| Magnitude changed from 7.8 to 8.8 | 52625356 | `NotSignedByAirnode` |
| Genuine old response, unchanged | 52625447 | `OracleStale` |
| Fresh original for another request | 52625521 | `NotSignedByAirnode` |
| Unexpected signing key | 52625602 | `NotSignedByAirnode` |

All are direct deployed-contract `eth_call` results, not state-changing transactions. The report also includes a separate earlier batch control and four-case run; the table identifies the individually recorded video cases. No RPC/backend error was counted as a contract rejection.

Public response evidence: [valid original](evidence/video-jury-fresh.json), [genuine other request](evidence/video-jury-other.json), [genuine unchanged old response](evidence/video-jury-old.json). The application uses its configured signer and request hash, not uploaded trust anchors. To test new originals yourself, follow [the judge guide](JUDGE_GUIDE_EN.md).

## Additional integrated evidence

- [Earlier 500-dUSD payout and four reservation rejections](../../deployments/integrated-report.json), [transaction](https://sepolia.basescan.org/tx/0x39a398293c0c6e4a9bfa5b6b1f47560798ca9545d458e856c1db15c71dad2b4a). This is a separate earlier case, not the recorded NGO-3 payout.
- [NASA EONET accepted by the same deployed integrated fund](../../deployments/integrated-eonet-check.json): `eth_call`, not another payment.
- [WHO source failure and disabled status](../sources/STATUS.md).
- [Detailed implementation validation and limits](../v3/VERIFICATION.md). Previously documented tests are not claimed as newly rerun for this submission pack.

## Demo limits

NGOs, reviewer identities, spending documents and funds are simulated. Airnode signatures are genuine for the configured sources. The video shows a private document upload and a pending review; it does not show or claim an approved spending decision. There are no real NGO partners or verified humanitarian outcomes. The public UI index may lag the chain and identifies the displayed confirmed snapshot.

The current silent source video is 145 seconds. Add the entrant's voice and final accessible video URL before submission; no final uploaded video is claimed here.
