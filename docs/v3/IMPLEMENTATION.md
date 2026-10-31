> Aktualisierung 31.10.2026: V3 startet zwei isolierte Demo-Bündnisse und führt durch fünf getrennte NGO-Schritte. Aktuelle Regeln und Grenzen: [LANDKARTE.md](LANDKARTE.md#datenbasierter-abruf-neu). Die nachstehenden externen Prüfabläufe bleiben als Alternative erhalten.

# V3 local shared fund — implementation contract

Current functionality overview in German: [V3-Landkarte](LANDKARTE.md). The original delivery stages below remain historical; current external approval workflows are documented in [UI.md](UI.md).

Approved scope: local prototype, branch feat/disasterdao-shared-fund, based on e7bb4b8. V1/V2 source, artifacts, deployments and original Airnode response bytes remain unchanged. No migration, production deployment, paid query, video or publication.

## Parameters (policy v3.1)
18,000 dUSD initial supply, six decimals; shared pool; six-hour rounds; 20% of free balance held while coverage is unknown/conflicting; cumulative ceiling 90% of current assessed maximum with competing incidents or uncertainty; 4,500 dUSD per NGO/incident; 24-hour claims; 72-hour follow-up vote; seven-day repeat cooldown. No dUSD/fiat conversion.

## Trust and state boundaries
Local role sessions and distinct signing accounts simulate independent organizations, data reviewers and evidence reviewers. They do not establish real independence. Data reviewers sign versioned assessments and round snapshots (2/3). Evidence reviewers are a separate 2/3 group. A relayer cannot invent a grant. Source authenticity does not prove need or delivery. Chain time enforces deadlines at every payout.

Assessment: draft → data-reviewed. Application: submitted → reviewed → reserved → paid, expired or rejected. Evidence: pending → submitted → in-review → accepted / requested / rejected; also overdue, appeal, extended and resolved. Upload receipt does not mean accepted expenditure. Follow-up: one open version; frozen eligible organizations; 2 and ceil(2n/3) approvals or accepted prior evidence + 2/3 evidence reviewers; expiry after 72h.

Sensitive synthetic originals remain encrypted off-chain in private storage; only salted manifests on-chain. Public API uses explicit projections; private objects require object-scoped expiring access. No real beneficiary data. Public reports distinguish payment, checked use and substantiated impact, with provenance and publication approval.

## Stages and verification
- P0: preserve baseline; 23 TS + 50 Solidity tests passed on 2026-10-30.
- P1: source adapters and coverage, rights/provenance registry; actual comparable 30-day expenditure dataset is **not established**. Synthetic corpus only exercises mechanics.
- P2: robust nearest comparables, weighted quantiles, uncertainty/sensitivity, temporal grouped backtests; integer proportional allocation with provisional competitors.
- P3: isolated DisasterFundV3, attestations, reserves, deadlines and cumulative claims; adversarial/fuzz/invariant tests.
- P4: Fastify, PostgreSQL, encrypted private S3, local role sessions, workflow, indexer and worker.
- P5: public/NGO/reviewer routes, existing demo, theme and complete 39-language resources (non-DE/EN drafts).
- P6: build, regression, integration and browser acceptance; record exact remaining verification gaps.

Source documentation consulted during implementation: [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [S3 signed access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [USGS](https://earthquake.usgs.gov/fdsnws/event/1/), [EONET](https://eonet.gsfc.nasa.gov/docs/v3). Public source availability is not assumed to imply a working signed adapter.

## Delivered local implementation
P0–P6 are implemented and verified for the explicitly simulated local scope. See [LOCAL.md](LOCAL.md) for operating instructions and [VERIFICATION.md](VERIFICATION.md) for executed checks and material gaps. P1 established provenance/coverage mechanics and explicitly did **not** establish a real comparable expenditure corpus. The country/language catalogs have 51 countries and 39 languages (69 UI keys); only DE/EN are maintained source texts. PostgreSQL uses a locked JSONB aggregate with separate audit/log tables for the fixed local registry. Private storage is S3-compatible RustFS (pinned image), encrypted before upload. No production-readiness or external-source integration is inferred from local acceptance.

## UI evolution

The `disasterdao-shared-fund-ui-improvements` branch adds separate discovery, organization and NGO surfaces and external signature imports. Browser reviewer sessions are disabled; quorum requirements remain unchanged. See [UI.md](UI.md) for current routes, APIs, data boundaries and operator commands. Earlier portal descriptions above describe the original delivered baseline.

## Local dependency storage (2026-10-31)

The V3 launcher first runs `scripts/install-local.mjs`. Registry dependencies are installed from the existing lockfile into a per-project local user cache, then exposed through a project `node_modules` symlink. The installer reuses a fingerprinted successful installation, serializes its own invocations, retains the current link on installation failure, and quarantines old directories without traversing cloud placeholders. Vite limits dependency discovery to `index.html` and excludes/denies dependency backups. This changes local tooling only; role, financial and persistence rules are unchanged. Plain `npm ci` can remove the link; use `npm run install:local` and see [LOCAL.md](LOCAL.md#abhängigkeiten-ohne-cloud-blockade) for limits.

## Shared navigation and test deposit allocation (2026-10-31)

`web/view-navigation.tsx` supplies Demo/NGO/User anchors to the V2 and V3 headers. Existing query entries, hash routes, session persistence and explicit logout actions remain in use. No router or public API changes.

`web/v3/support-allocation.tsx` consumes the existing `Organization[]` context and `support.total` projection from `server/organizations.ts`. It sums integer token units with BigInt, renders a static SVG donut plus a semantic value list, and uses existing localized dUSD formatting. The source is cumulative confirmed deposits of shared test account 0, including initial funding, not personal or remaining balances. The current single alliance produces one 100% segment; member NGOs are not donor allocations. Rounded percentages carry a rounding notice.

The context exposes organization loading/ready/error state independently of session loading, with request ordering protection for the organization response. Failed refreshes and any stale/unavailable snapshot suppress the allocation instead of displaying partial totals. Empty registry and zero deposits are distinct. No changes to backend contracts, financial rules, role permissions or wallet identity. Current verification is recorded separately in VERIFICATION.md.

## Zwei Bündnisse und Oracle-Abruf — 31.10.2026

`npm run v3:start` baut und startet beide lokalen Bündnisse. Neue Standardmanifeste: `.runtime/v3.3-ngo-flow.json` und die Variante `-community.json`. Alte Manifeste/Chain-Zustände/Dokumente bleiben erhalten; keine Übertragung alter Mittel oder Nachweise. Ein neuer Deploymentname erhält einen neuen getrennten Datenbestand. Die App nutzt für PostgreSQL ein aus dem Manifestnamen abgeleitetes Schema.

In der NGO-Anmeldung stehen sechs simulierte NGOs zur Auswahl. **Hilfe beantragen** führt durch Ereignisprüfung, Antrag, Freigabe/Reservierung, separaten Geldabruf und Verwendungsnachweis. Antrag und Reservierung überweisen nichts. Die Contract-Regel erlaubt Erstförderung sowie Folgeförderung bei aktueller Verschlechterung oder akzeptierten/geklärten Nachweisen ohne zusätzliche NGO-Zustimmung. Andernfalls stimmen die beiden anderen berechtigten NGOs zu; eine Stimme genügt nicht. Nachweissperren, sechs Stunden Rundenabstand und 24 Stunden Reservierungsfrist bleiben bestehen. Einzelheiten: [Landkarte](LANDKARTE.md#datenbasierter-abruf-neu).

Standard ist die klar markierte lokale Demo mit Signer Konto 30. Für eine andere synthetische Lage kann der Betreiber den Backend-Prozess mit z. B. `V3_DEMO_SEVERITY='{"demo-quake":7.3,"demo-flood":3}'` starten. Ein höherer Wert ist nur eine Demo-Regel, kein echter Krisennachweis.

`V3_ORACLE_MODE=live` muss beim Deployment und Serverstart übereinstimmen und benötigt einen eigenen neuen `V3_DEPLOYMENT`-Namen. USGS und EONET haben Adapter mit festem Signer und Request-Hash; ihre aktuell konfigurierten historischen Ereignisse sind älter als das zulässige Beobachtungsfenster und lösen deshalb keine aktuelle Auszahlung aus. Flut/akute Gesundheit sind im Live-Modus deaktiviert. Es wurde keine neue erfolgreiche echte Airnode-Zahlung nachgewiesen. Fehler oder unpassende Daten erzeugen keine Ersatzsignaturen; stattdessen den externen Prüfpfad verwenden.

Externe Betreiberbefehle für das zweite Bündnis mit `V3_ORGANIZATION=community-alliance` ausführen; Rollen heißen dort z. B. `community-data-1`. Standard ist `local-alliance`. Freigaben bleiben an Fonds und Chain gebunden. Testspenden haben eine Bündnisauswahl; das Diagramm zeigt bestätigte Einzahlungen desselben gemeinsamen Testspenderkontos.

Beim lokalen Deployment erzeugt das Startwerkzeug zwei zusätzliche Anvil-Blöcke, damit beide Initialeinzahlungen vor dem ersten Indexlauf bestätigt sind. Der Worker selbst erzeugt weiterhin keine Blöcke.

## Geführter NGO-Ablauf — 31.10.2026

`DisasterFundV3Auto` trennt Antrag, Reservierung und Auszahlung. Anfrage-IDs sind je NGO gebunden; unveränderliche Inhaltsbindung umfasst Einsatz, Beträge und Zweckhash. Reservierung prüft erneut aktuelle signierte Daten, Sperren, Quorum/Regelfreigabe und Budget. Der Hook `_afterClaim` im Basiskontrakt erhöht den höchsten ausgezahlten Lagewert ausschließlich bei tatsächlicher Zahlung. Abgelaufene Reservierungen erhöhen ihn nicht.

`server/automatic.ts` vermittelt diese Aktionen, `server/workflow.ts` projiziert den Fall aus Contract-Zuständen/Ereignissen und privaten App-Daten. `web/v3/workflow.tsx` führt durch die fünf Schritte, `web/v3/ngo.tsx` bindet private Dokumente und fallgebundene Signaturimporte an. Zwecktexte und Originalbelege bleiben außerhalb der Chain. Upload, externe Signaturen, geminte Transaktion, zwei Folgeblöcke und inhaltliche Akzeptanz sind getrennte Zustände.

Ein neues Deployment samt Datenbank-Namespace verhindert eine stillschweigende ABI-Umstellung bestehender Fonds. V1/V2 bleiben erhalten. Das Live-Prüfwerkzeug zahlt weder Quellengebühren noch NGO-Mittel; HTTP 402 bleibt ein sichtbarer Betreiberbedarf. [Betrieb](LOCAL.md#geführte-demo-und-live-prüfung), [API und Bedienung](UI.md#geführte-fünf-schritte-demo).
