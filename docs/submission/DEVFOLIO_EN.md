# DisasterDAO — Devfolio copy

Prepared 31 October 2026 for the integrated product. Draft only; video URL is still to be added. The live form allows 50 characters for the tagline and 5,000 per main text field. A condensed version has been saved in the actual form; the sections below provide the fuller project reference.

## Project name

DisasterDAO

## Tagline

Shared relief funds. Signed data. Accountable aid.

## The problem it solves

Independent NGOs and donors may want to commit money to a shared relief fund while agreeing in advance who can receive it and under which rules. DisasterDAO explores that coordination problem: a fund operator should not be able to forge a disaster reading, pay an arbitrary recipient, or give the same NGO a second budget through a manual exception.

Registered NGOs use one application to submit a funding purpose, requested amount, capacity and external funding. An authenticated event response establishes eligibility. The contract then applies the shared allocation rules, reserves the permitted amount and lets the fixed NGO address claim it once. Each payout creates an obligation to provide private spending evidence; uploading a document alone does not approve its use.

This is a prototype and an unvalidated user hypothesis. We have no NGO partners or demonstrated humanitarian outcomes. A conventional shared database with signed approvals remains an alternative to evaluate with real fund managers.

## What we built and how it works

DisasterDAO is an integrated React/TypeScript application backed by Solidity contracts, a local Fastify service, PostgreSQL and encrypted private object storage. Its public view, NGO workspace and API3 jury tools use the same fund rules. Two simulated alliances have separate funds, test tokens, roles and records.

For the automatic path, the deployed contract authenticates an AirnodeHub response against its configured Airnode signer and exact request hash, checks the signature's age and the registered event conditions, and uses the value contained in those exact signed bytes to establish funding eligibility. Applying, reserving and claiming are separate on-chain actions. Removing the authenticated data path removes the automatic eligibility workflow; external 2-of-3 approval remains an explicit human fallback using the same limited entitlement.

The cumulative limit is 4,500 dUSD per NGO and incident, reduced by previous payouts, reservations and declared external funding. Requests and capacity cap the individual amount; shared allocation, competition and uncertainty rules can reduce it further. A reservation can be claimed only once by its fixed recipient within its time window.

After payment, documents remain encrypted off-chain. Salted commitments bind the evidence; designated reviewers sign separate receipt and spending decisions. Overdue or rejected evidence blocks further payouts. Reviewer identities, NGOs and documents are simulated, and all private reviewer keys remain with the prototype operator.

## Why API3 is essential / who relies on the data

NGOs, fund participants and the contract's automatic eligibility path rely on authentic event data. A relayer able to invent a magnitude, swap the requested event or choose its own signer could otherwise open access to the shared fund. The contract therefore checks the configured signer, intended request, original signed bytes and timing before acting. It does not trust signer or request claims supplied by an uploaded JSON file.

USGS is the primary signed source for a registered historical earthquake. NASA EONET was also accepted by the deployed integrated contract in a separate read-only simulation. The USGS earthquake occurred on 6 February 2023; the demo fetched genuinely new signatures on 31 October 2026. Signature freshness, maximum 300 seconds, is checked separately from the historical event window.

An Airnode signature authenticates the configured source response. It does not establish humanitarian need, the truth or completeness of the underlying source, correct spending or institutional independence.

## Working deployment and evidence

- Network: **Base Sepolia**, chain ID **84532**.
- Main fund: [`0x31b632b6b01d486c5c7081423950f4a6edd58728`](https://sepolia.basescan.org/address/0x31b632b6b01d486c5c7081423950f4a6edd58728).
- Video-recorded application: [transaction](https://sepolia.basescan.org/tx/0xd01c9331cfac5d835aa65a4e242d46b3c53b947f17f4f929b1bc00290f76c20d).
- Video-recorded reservation: [transaction](https://sepolia.basescan.org/tx/0x90e7e6f7e84954f7c23a9bdc5b2feee4c7e151da89090decfebc14f05feb2fa7).
- Video-recorded payout: [500 dUSD to the fixed simulated NGO recipient](https://sepolia.basescan.org/tx/0x57de87282f6244a575ee0774aafd52bcd9da6139037457b820c98cb67256b300).
- [Source and setup](https://github.com/NoMelatonin/API3_Hackathon_Agent).
- [English jury guide](https://github.com/NoMelatonin/API3_Hackathon_Agent/blob/main/docs/submission/JUDGE_GUIDE_EN.md).
- [Evidence and all four rejection results](https://github.com/NoMelatonin/API3_Hackathon_Agent/blob/main/docs/submission/EVIDENCE_EN.md).

The recorded recipient balance increased from 0 to 500 dUSD. These are valueless test tokens. The four negative cases call the deployed contract using `eth_call`: changed value → `NotSignedByAirnode`; genuinely old unchanged response → `OracleStale`; fresh response to a different request → `NotSignedByAirnode`; unexpected signer → `NotSignedByAirnode`. A valid fresh control passed. These simulations do not transfer money.

## Challenges we ran into

The important boundary was between authenticated data and a funding decision. We bound the exact request and original response bytes, kept historical event time separate from signature freshness, and required specific decoded contract errors so RPC failures could not count as successful protection. We also kept automatic and externally approved requests inside the same allocation and cumulative limits, and distinguished a document upload from a confirmed spending decision.

## Data we wanted but could not obtain for this prototype

We did not establish a suitable working signed source for the registered flood or acute-health cases, verified local relief needs, cross-NGO needs allocation, or actual spending outcomes. A configured WHO annual malaria-data request failed with an upstream error; annual incidence would also not establish the registered acute emergency. WHO therefore stays disabled. We do not claim to have exhaustively searched the entire AirnodeHub catalogue. Local flood and health scenes are explicitly synthetic; testnet cases require the external approval path.

## What is next

Validate historical release decisions with NGO and fund managers, compare the workflow with a conventional signed database, and assess whether shared on-chain control creates a measurable advantage. Then improve institutional key custody, production authentication, incident onboarding and suitable signed data coverage.

## Technologies / tags

Solidity, TypeScript, React, API3, AirnodeHub, Base Sepolia, x402, viem, Foundry, Fastify, PostgreSQL, Docker, encrypted S3-compatible storage.

## Links / remaining media

Repository: https://github.com/NoMelatonin/API3_Hackathon_Agent

Video: **ADD_FINAL_VIDEO_URL** — final voiced video, accessible without requesting permission, at most 150 seconds.

Website: no public hosted application claimed. The app runs locally using the repository setup and is available for the on-site demonstration. A localhost URL is not a public demo URL.

Partner track: **API3 — Any API in your contract**. The organizer's TUM Blockchain Track is automatic. No autonomous-agent bonus is claimed.
