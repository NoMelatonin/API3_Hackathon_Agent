# DisasterDAO — judge setup and own-response tests

Prepared 31 October 2026. One integrated application; no version selector. All funds are valueless test tokens and all organizational identities are simulated.

## 1. Run the local product

Requirements: Node.js **22.18 or later**, npm, Git and a running Docker engine. Internet access is needed for locked dependencies and initial container images. Run in a terminal:

```sh
git clone https://github.com/NoMelatonin/API3_Hackathon_Agent.git
cd API3_Hackathon_Agent
npm start
```

The startup command installs the locked dependencies and bundled Foundry tools when needed, starts the isolated local services, builds the contracts and preserves compatible existing deployments. Initial installation can take several minutes. Stop with Ctrl-C; preserve Docker volumes.

- Public view: http://127.0.0.1:5173/
- NGO workspace: http://127.0.0.1:5173/?ngo=1#/ngo
- Jury tools: http://127.0.0.1:5173/#/jury

This default profile uses **explicitly synthetic local signatures**. It demonstrates the complete product but is not the genuine Airnode testnet evidence.

## 2. Use the existing public deployment

Stop the local app first, then start the same application with:

```sh
DISASTERDAO_PROFILE=testnet npm start
```

Network: **Base Sepolia (84532)**. Main fund: `0x31b632b6b01d486c5c7081423950f4a6edd58728`. The second alliance uses `0xff80001619324e2f99079ce246a89a7fa53effc5`.

This verifies and reads the existing public contracts and starts local storage; it does not deploy another fund or generate replacement signatures. **Read-only jury simulations need no NGO/reviewer private keys.** Actual NGO transactions on the existing deployment need the operator's registered private test roles, which are deliberately excluded from the repository.

## 3. Fetch or bring your own original response

For the documented USGS scenario, use a genuine response for the configured request and a genuinely fresh response to the alternate request. Keep the signed `data` string, timestamp and signature unchanged.

To fetch priced responses yourself, configure your own `PAYER_PRIVATE_KEY` in a private `.env` using the names in `.env.example`, and obtain valueless Base-Sepolia aUSD using the [event faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/). Never publish your key. The aUSD used for API payments is different from the fund's dUSD token. Importing a response you already obtained requires no payer key.

In another terminal at the repository root:

```sh
npm run install:local
npm run contracts:build
DISASTERDAO_PROFILE=testnet npm run jury -- config
DISASTERDAO_PROFILE=testnet npm run jury -- fetch --out .runtime/judge-fresh-01.json
DISASTERDAO_PROFILE=testnet npm run jury -- fetch --other --out .runtime/judge-other-01.json
DISASTERDAO_PROFILE=testnet npm run jury -- simulate --file .runtime/judge-fresh-01.json --ngo 2
DISASTERDAO_PROFILE=testnet npm run jury -- tamper --file .runtime/judge-fresh-01.json --old fixtures/integrated/usgs-old.json --other .runtime/judge-other-01.json --ngo 2 --out .runtime/judge-results-01.json
```

Use new filenames on repeat runs; original output files are not overwritten. NGO 2 was not paid in the supplied integration/video evidence; check its current eligibility in the app before testing. Current state can change, and a successful positive control is required. If necessary choose another eligible registered NGO; lack of eligibility is not evidence of a signature failure.

Both fresh responses must remain at most **300 seconds** old. If the window elapses, fetch new originals with new filenames. The bundled old file is genuinely signed after this fund's activation and has aged naturally. For a new deployment, obtain an original after activation and allow it to age unchanged for more than 300 seconds. Do not rewrite timestamps or alter a public chain's time.

The commands above perform paid API calls only when explicitly running `fetch`; `config`, `simulate` and `tamper` do not send chain transactions. These commands do not require the backend to run for their direct contract simulations once dependencies and artifacts are available.

## 4. Browser import

Open `/#/jury` in the testnet profile. Select the alliance, registered incident and eligible NGO. Upload your genuine fresh original JSON and run the direct contract simulation. Upload the genuine old and fresh alternate-request originals to run the valid control and all four rejection cases. The app submits the exact bytes to the deployed contract; network errors are not successful rejection tests.

| Case | Required result |
| --- | --- |
| Valid fresh configured response | `accepted: true` |
| Original response with one value changed | `NotSignedByAirnode` |
| Genuine unchanged old response | `OracleStale` |
| Fresh genuine response to another request | `NotSignedByAirnode` |
| Unexpected signing key | `NotSignedByAirnode` |

`accepted: true` is an **`eth_call` simulation**, not a payment. The wrong-key case is deliberately a negative synthetic attack, never a replacement oracle source. A positive control must pass; otherwise resolve freshness, eligibility or connectivity before interpreting the four results.

## 5. Inspect the confirmed state-changing flow

The [evidence guide](EVIDENCE_EN.md) links the real application, reservation and payout recorded in the demo and the original signed response files. Anyone can inspect those public receipts. The original files are historical evidence and are no longer fresh enough for a new funding action.

To create a new state-changing demonstration, use the on-site operator's authorized registered role, or create your own isolated fund with your own test roles following [deployment instructions](../v3/LOCAL.md). `jury submit`, `reserve`, `claim` and `prove` are actual transaction paths; the `prove` command can pay funds. Do not run them as read-only checks or repeatedly replay an already completed application.

## Limits and troubleshooting

- No publicly hosted app is claimed. localhost works on the machine running the stack; it is not a remote demo link.
- The source repository must be public for judges; if GitHub returns 404, contact the entrant.
- API responses can fail upstream. WHO is disabled; flood/acute-health local data are synthetic.
- The default public RPC is `https://base-sepolia-rpc.publicnode.com`; an alternative valid Base-Sepolia endpoint can be set using `V3_RPC`.
- If an old Vite cache fails, stop the app and run `npm start` again. The current installer checks actual HTML processing. Preserve chain and document volumes.
- The public index uses confirmations and can lag the chain; read the displayed block/date and use transaction receipts for the recorded result.

Further detail: [German operating guide](../v3/LOCAL.md), [German jury reference](../JURY.md), [functional map](../v3/LANDKARTE.md).
