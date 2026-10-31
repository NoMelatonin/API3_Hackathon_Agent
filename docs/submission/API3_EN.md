# API3 — track-specific description

DisasterDAO uses authenticated AirnodeHub event data to govern the automatic funding path of a shared NGO relief fund. Removing the integration removes automatic event-based eligibility. An external 2-of-3 decision is a separate human fallback and consumes the same limited entitlement.

**Who relies on it:** participating NGOs and fund participants rely on the contract authenticating the event response before it opens a funding application and reservation. If a relayer could forge a hazard value, swap the request or supply a self-selected signer, it could make an ineligible case appear eligible. The contract uses its stored signer and request policy, the exact signed bytes, signature freshness and event conditions before allowing the state change. Claims pay once to the registered recipient.

**Deployment:** Base Sepolia (84532), fund `0x31b632b6b01d486c5c7081423950f4a6edd58728`.

**Meaningful action:** the recorded real signed USGS responses enabled application, reservation and a confirmed **500-dUSD** payout, [transaction](https://sepolia.basescan.org/tx/0x57de87282f6244a575ee0774aafd52bcd9da6139037457b820c98cb67256b300). Test tokens and NGO identities are simulated; the Airnode signatures and deployed contract are genuine.

**Tamper test:** valid fresh control accepted; edited value, stale original, fresh other request and unexpected signer rejected with the exact contract errors. Negative tests are `eth_call` simulations with no payout. See [evidence](EVIDENCE_EN.md).

**Own responses:** [English judge instructions](JUDGE_GUIDE_EN.md) document browser import and the `jury fetch`, `simulate` and `tamper` scripts. No NGO private key is needed for contract simulations. Fetching priced responses requires the judge's own test-aUSD payer; obtaining a new real payout requires an authorized role or an isolated deployment.

**Missing data:** no suitable working signed source was established for the registered flood or acute-health scenes, local relief need or actual spending outcomes. The configured WHO annual-data request failed upstream and is unsuitable for acute eligibility; it remains disabled. This is a prototype-specific limitation, not a claim that the complete catalogue lacks those data.

**Trust boundary:** Airnode authenticates the source response, not humanitarian need, source truth, correct spending or independently operated NGO/reviewer identities.
