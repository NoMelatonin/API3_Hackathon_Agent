# DisasterDAO

NGO-Katastrophenfonds für den TUM Blockchain & AI Hackathon, API3-Track.

**Stand: Meilenstein 1 – Datenweg vorbereitet; echter Ereignisnachweis noch offen.**
Es gibt noch keinen Fonds, keine Auszahlung und kein Deployment. Der nächste Schritt
ist der echte bezahlte USGS-Abruf und `npm run check-real`. Erst wenn dieser Check
erfolgreich ist, folgen Fonds, Notfallquorum, Oberfläche und Testnet-Demo.

## Lokal starten

Node.js ≥ 22.18 (hier geprüft mit 24.15.0):

```sh
npm ci
cp .env.example .env
```

In `.env` ausschließlich den Schlüssel einer separaten **Testwallet** als
`PAYER_PRIVATE_KEY=0x…` hinterlegen. Keine Schlüssel im Chat oder Repository.
Die Wallet benötigt API3-aUSD auf Base Sepolia; die API verlangt 0,01 aUSD pro Abruf.
Minting benötigt Base-Sepolia-ETH, die vermittelte x402-Zahlung selbst nicht.
[aUSD-Faucet](https://airnodehub.api3.org/faucet).

```sh
npm run request-hash
npm run fetch-response
npm run check-real
```

`fetch-response` speichert die originale signierte Antwort in
`fixtures/usgs-real.json`. Bestehende Dateien werden nicht überschrieben.
Für einen neuen Abruf eine andere Datei mit `-- --out fixtures/usgs-fresh.json`
angeben. `--other` verwendet eine andere Projektion desselben Ereignisses und
speichert eine echte andere Anfrage für den späteren Manipulationstest.

`check-real` scheitert ausdrücklich ohne echte Fixture. Er prüft die Signatur in
TypeScript und Solidity und liest dort Magnitude, Ereigniszeit und Ereignis-ID.
Dieser reine Machbarkeitscheck prüft **keine Anwendungsfrische**; der geplante Fonds
wird diese zusätzlich erzwingen. Eine alte Fixture bleibt für Regressionstests
nützlich, ersetzt aber keine frische Antwort für eine Auszahlung.

## Prüfungen

```sh
npm run typecheck
npm test
npm run forge -- test -vv
```

Die npm-Pakete enthalten die offiziellen lokalen Foundry-Binaries; keine globale
Foundry- oder pnpm-Installation ist nötig. Foundry lädt beim ersten Lauf Solc 0.8.37.
Der reguläre Forge-Lauf überspringt den echten Integrationstest, wenn die Fixture
fehlt. **Ein übersprungener Test erfüllt den Machbarkeitscheck nicht.**

Die mitgelieferten Nodary-Fixtures stammen aus dem offiziellen Starter und dienen
seinen Verifier-Regressionstests. Sie sind kein Katastrophennachweis.

## Feste Demoanfrage und Vertrauensgrenzen

- Quelle: [USGS](https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=us6000jllz).
- Historisches Ereignis: Türkei, 06.02.2023, `us6000jllz`, Magnitude 7,8.
- Airnode: `https://airnode-usgs.fly.dev/`, betrieben von API3 über der USGS-API.
- Erwarteter Signer: `0x5aF744115e2577513D878D4263Db73b3E77E7630`.
- Anfragehash: `0x226b958e9cea51240281d38535b7a0661ed95b7a21f978a122bf442ca7b8522c`.
- Projektion: Ereignis-ID und -typ, Magnitude, Ereigniszeit, Breite, Länge, Reviewstatus.

Die originale `data`-Zeichenfolge wird vor Signaturprüfung niemals geparst und neu
serialisiert. Der Vertrag vertraut festgelegtem Signer und Anfragehash, nicht den
Metadaten eines Einreichers. Die Signatur belegt, was der API3-Airnode gelesen hat;
sie beweist weder Schadenshöhe noch Bedürftigkeit oder Verwendung von Hilfsgeldern.
Die Demo verwendet ein historisches Ereignis und später ausschließlich Testmittel.

## Herkunft

[Offizieller API3-Starter](https://github.com/api3dao/airnodehub-hackathon-starter),
Commit `52933ae1fb9371446a927338473466c3d320e19a`.
Übernommene Quellen und Lizenzen befinden sich unter `contracts/vendor`,
`src/vendor` und `vendor`; exakte Abhängigkeitsstände in `vendor/versions.json`.
Die relativen Fixture-Pfade der übernommenen TypeScript-Tests wurden angepasst.
Die pnpm-Version wurde wegen gemeldeter npm-Advisories auf 11.28.9 aktualisiert.

Deadline: **31.10.2026, 15:00 Uhr MEZ**.
[Track und Abgabe](https://hackathon.tum-blockchain.com/prizes#api3).
