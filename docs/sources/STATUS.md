# Integration evidence — 2026-10-30

The existing USGS evidence is preserved in `fixtures/usgs-real.json`.

NASA EONET: **real signed response retrieved and cryptographically verified** using the pinned signer and exact projected request in `src/campaigns.ts`. Original bytes are in `fixtures/v2/eonet-real.json`. This is an API3 Airnode signature, not a NASA signature. Application-level acceptance is tested separately. Public machine-readable documentation is snapshotted alongside this file.

WHO GHO: **blocked, not integrated successfully**. The exact Nigeria/2022 malaria request in `src/campaigns.ts` was attempted through AirnodeHub. The Airnode returned HTTP 502 with `{"error":"Upstream responded with 500 ","upstreamStatus":500}`. Direct upstream attempts during planning also returned 500. No WHO response fixture was fabricated. WHO remains disabled for oracle claims in the default deployment; its reserved budget and explicitly synthetic local tests remain available. Retry with a new output filename; do not silently substitute another indicator or dataset.

Both paid endpoints document 0.01 test-aUSD per request. No production funds or deployments are used. A failed upstream request does not establish whether payment was settled; no success claim is made for WHO.

Requests include their projection in the signed request hash. A matching signature establishes what the configured Airnode returned, not the accuracy of the source or humanitarian need. Historical data use a fixed observation period; signature freshness is checked independently.

Sources: https://airnodehub.api3.org/llms.txt, https://airnode-eonet.fly.dev/, https://airnode-who.fly.dev/, https://eonet.gsfc.nasa.gov/api/v3/events/EONET_22386, https://www.who.int/data/gho/info/gho-odata-api.
