# DisasterDAO

**Judges / English:** [setup and own-response tests](docs/submission/JUDGE_GUIDE_EN.md) · [current deployed contract, recorded payout and tamper evidence](docs/submission/EVIDENCE_EN.md) · [project description](docs/submission/DEVFOLIO_EN.md). Base Sepolia (84532), fund `0x31b632b6b01d486c5c7081423950f4a6edd58728`. Node.js ≥22.18 and running Docker: `npm start` for the synthetic local demo; `DISASTERDAO_PROFILE=testnet npm start` for genuine Airnode contract simulations. No publicly hosted app is claimed.

Ein gemeinsamer Testfonds je Bündnis: Eine registrierte NGO belegt einen Einsatz, beantragt Mittel, reserviert ihren regelkonformen Anteil, ruft ihn an ihre feste Adresse ab und reicht private Verwendungsnachweise ein. Echte Airnode-Signaturen werden im Contract geprüft. Externe 2/3-Freigaben bilden den begrenzten Ersatzpfad und die unabhängige Verwendungsentscheidung ab.

**Ein Produkt:** Öffentlichkeit, NGO-Arbeitsbereich und Jury verwenden dieselbe Anwendung und dieselben Geldregeln. Es gibt keine V1-/V2-/V3-Oberflächenwahl.

## Start

Node.js ≥22.18 und Docker mit laufender Engine:

```sh
npm start
```

Der Befehl installiert gesperrte Abhängigkeiten bei Bedarf, startet eigene Docker-Volumes, baut/verifiziert die Contracts und startet Backend/Webseite.

Der Vite-Cache wird dabei mit tatsächlicher HTML-Verarbeitung geprüft und bei fehlenden Dateien neu installiert; auch `npm run dev` prüft ihn vor dem Start. [Reparatur bei fehlenden Vite-Modulen](docs/v3/LOCAL.md#fehlende-vite-dateien-reparieren).

- Öffentlichkeit: http://127.0.0.1:5173/
- NGO: http://127.0.0.1:5173/?ngo=1#/ngo
- Jury / API3: http://127.0.0.1:5173/#/jury

Standard ist eine **ausdrücklich synthetische lokale Demo** mit wertlosen dUSD und simulierten Rollen. Der lokale Taktgeber erzeugt Bestätigungsblöcke, keine fachlichen Freigaben. Zwei Demo-Bündnisse bleiben finanziell getrennt.

Für dasselbe Produkt auf Base Sepolia:

```sh
DISASTERDAO_PROFILE=testnet npm start
```

Dieser Modus verwendet die veröffentlichten neuen Deploymentmanifeste und echte Airnode-Policies. Er deployt nicht automatisch und erzeugt keine Ersatzsignaturen. Transaktionen benötigen die privaten Testrollen des Betreibers; reine Jury-Simulationen benötigen keinen NGO-Schlüssel. [Einrichtung, Ports und Wiederherstellung](docs/v3/LOCAL.md).

**Neu nachgewiesen auf Base Sepolia (84532):** [integrierter Fonds](https://sepolia.basescan.org/address/0x31b632b6b01d486c5c7081423950f4a6edd58728), [500-dUSD-Auszahlung mit echten Airnode-Daten](https://sepolia.basescan.org/tx/0x39a398293c0c6e4a9bfa5b6b1f47560798ca9545d458e856c1db15c71dad2b4a) und vier genaue Contract-Ablehnungen. [Vollständiger Nachweis](deployments/integrated-report.json).

## Verstehen und vorführen

- [Funktionslandkarte: Rollen, Regeln, Grenzen und Umsetzung](docs/v3/LANDKARTE.md)
- [NGO-Demo, private Nachweise und externe Freigaben](docs/v3/UI.md)
- [Jury: eigene Originalantwort, direkte Contract-Prüfung, vier Manipulationstests](docs/JURY.md)
- [Aktuelle Abnahme und neue Testnet-Nachweise](docs/v3/VERIFICATION.md)
- [Architektur und Entscheidungen der Zusammenführung](docs/v3/IMPLEMENTATION.md)

Die API3-Signatur bestätigt, was der konfigurierte Airnode aus der Quelle gelesen hat. Sie bestätigt weder Bedürftigkeit noch korrekte Mittelverwendung oder humanitäre Wirkung. Historische Ereigniszeit, frische Signatur, Reservierung, geminte Auszahlung und bestätigte Verwendungsentscheidung sind getrennte Zustände.

## Einheitliche Geldregeln

Maximal 4.500 dUSD kumulativ je NGO/Einsatz, abzüglich früherer Zahlungen, Reservierungen und externer Finanzierung. Gleiche Paketgewichte, 90 % Grenze bei Konkurrenz und 20 % Reserve bei unbekannter/widersprüchlicher Lage. Antrag und Kapazität begrenzen den Einzelabruf. Eine gemeinsame Runde bindet auch vorläufige Paketanteile für höchstens 24 Stunden. [Details und Fristen](docs/v3/LANDKARTE.md#geldregeln-und-fristen).

V2-Kurven, isolierte Einsatzbudgets und zusätzliche V1-Notfallzahlungen gelten nicht mehr. Beide Freigabepfade verbrauchen denselben Anspruch. Keine echten Gelder verwenden.

## Prüfen

```sh
npm run typecheck
npm test
npm run forge -- test --summary
npm run test:integration
npm run build
npm run test:ui
```

Integration und Browser benötigen den isolierten lokalen Stack; für reproduzierbare Prüfungen den Demo-Taktgeber mit `V3_DEMO_CLOCK=0 npm start` abschalten. Tests sichern/restaurieren Chain und beide App-Zustände. [Prüfgrenzen](docs/v3/VERIFICATION.md).

## Quellen, Geheimnisse und Historie

USGS und NASA EONET sind echte signierte Quellen. Flut/akute Gesundheit haben keine geeignete reale signierte Anbindung. WHO bleibt bis zu einem geeigneten Erfolgsnachweis deaktiviert; [aktueller Quellenstatus](docs/sources/STATUS.md).

`.env`, private Rollenschlüssel und verschlüsselte Belege bleiben lokal und ignoriert. API-Zahlungen verwenden ausschließlich wertlose Base-Sepolia-aUSD; der Fonds verwendet einen separaten dUSD-Testtoken. Kein Schlüssel oder privates Originaldokument gehört in öffentliche Nachweise.

[Historische Stände](docs/history/README.md) bewahren alte Nachweise; bestehende öffentliche Contracts wurden nicht aktualisiert. Übernommene API3-/OpenZeppelin-/Solady-Quellen und Lizenzen stehen in `vendor`, `contracts/vendor`, `src/vendor` und `vendor/versions.json`.
