# DisasterDAO starten und erhalten

Stand: 31.10.2026. Eine Anwendung, zwei ausdrücklich getrennte Netzwerkprofile. Frühere V3-Betriebsanweisungen stehen [in der Historie](../history/v3-LOCAL.md).

## Lokale Demo

Voraussetzungen: Node.js ≥22.18, npm, laufende Docker-Engine. Im Projekt:

```sh
npm start
```

Der Start prüft/installiert gesperrte Abhängigkeiten, startet Infrastruktur, baut kanonische Contracts, erhält vorhandene passende Deployments und startet Backend und Vite. Die Registry-Pakete liegen außerhalb des synchronisierten Desktop-Ordners; `npm run install:local` kann sie separat reparieren. Alte Abhängigkeitsordner werden gesichert, nicht gelöscht.

| Dienst               | Loopback-Port |
| -------------------- | ------------- |
| Webseite             | 5173          |
| Backend              | 3008          |
| PostgreSQL           | 5438          |
| Privater S3-Speicher | 9008          |
| Anvil                | 8548          |

Compose-Projekt: `disasterdao-integrated`; eigene Volumes `postgres`, `documents`, `chain`. Frühere `disasterdao-v3`-Volumes/Ports werden nicht gelöscht. Erstes Bündnis startet mit 18.000 dUSD, zweites mit 9.000; beide Token besitzen getrennt jeweils 36.000 wertlose dUSD.

URLs: `/` Öffentlichkeit, `/?ngo=1#/ngo` NGO, `/#/jury` Jury. Es gibt keine Versionsauswahl. Start/Stop mit `Ctrl-C` beendet Node-Prozesse; Docker-Volumes bleiben erhalten. Der lokale Demo-Taktgeber erzeugt alle zwei Sekunden Bestätigungsblöcke. Abschalten für kontrollierte Tests:

```sh
V3_DEMO_CLOCK=0 npm start
```

Der reguläre Worker erzeugt keine Blöcke. `npm run clock -- --seconds 1` funktioniert ausschließlich auf Chain 31337. Kein öffentliches Zeitreisen.

## Fehlende Vite-Dateien reparieren

`npm start`, `npm run v3:start` und auch `npm run dev` prüfen den Cache mit einer echten Vite-HTML-Verarbeitung. Ein vorhandener Lockfile-Marker genügt nicht: Fehlt etwa der erst beim Seitenaufruf geladene Chunk `vite/dist/node/chunks/dist.js`, wird aus dem bestehenden Lockfile neu installiert. Erst nach erfolgreicher Prüfung werden Cache-Zeiger und Projektlink ersetzt. Eine fehlgeschlagene Neuinstallation erhält den bisherigen Link.

Bei einem Fehler aus einem alten Cache laufende Entwicklungsserver mit `Ctrl-C` beenden und `npm start` erneut ausführen; bereits gestartete Prozesse wechseln ihre geladenen Module nicht automatisch. Für eine ausdrücklich frische Installation vor dem Neustart `npm run install:local -- --clean` verwenden. Internetzugriff ist für eine Neuinstallation nötig. Im synchronisierten Projekt kein direktes `npm ci` verwenden, weil es den externen Link durch einen lokalen Ordner ersetzen kann. Umsetzung: [Installer](../../scripts/install-local.mjs), [Start](../../src/v3/start.ts), [npm-Einstiege](../../package.json).

## Base Sepolia

```sh
DISASTERDAO_PROFILE=testnet npm start
```

Der Start baut dieselbe Anwendung, verwendet die veröffentlichten `deployments/integrated-base-sepolia*.json`, prüft Netzwerk/Runtime/Rollen/Policies und deployt nichts. Er startet nur die benötigten lokalen Speicher; die öffentliche Chain wird nicht verändert. Ungeeignete oder fehlende Airnode-Daten werden nicht synthetisch ersetzt.

Reine Jury-Simulationen verwenden öffentliche Rollenadressen und brauchen keine NGO-Schlüssel. Tatsächliche Transaktionen des lokalen Demo-Betreibers benötigen dessen `.runtime/testnet-roles.json`; diese Datei wird nicht veröffentlicht. Eine eigene Installation kann stattdessen einen neuen isolierten Testfonds mit eigenen Rollen deployen.

Für ein **neues eigenes Testdeployment**:

1. `.env` aus `.env.example` vorbereiten: eigener Testwallet-Schlüssel `PAYER_PRIVATE_KEY`, optional separater `DEPLOYER_PRIVATE_KEY`, optional `RPC_URL`. Keine echten Gelder.
2. Test-aUSD für API-Aufrufe und Base-Sepolia-Test-ETH für Gas beschaffen. API3-aUSD und Fonds-dUSD sind unterschiedliche Token.
3. `npm run init:testnet` einmal ausführen. Existierende private Testrollen werden nicht überschrieben. Ohne `.env.roles` werden neue getrennte NGOs und Prüfer erzeugt; vorhandene historische NGO-/Committee-Testrollen können übernommen werden.
4. `npm run install:local`, `npm run contracts:build`.
5. Gebühren lesend prüfen: `DISASTERDAO_PROFILE=testnet npm run estimate-deploy`.
6. Unter neuem Namen deployen:

```sh
DISASTERDAO_PROFILE=testnet V3_DEPLOYMENT=deployments/jury-new.json npm run deploy
DISASTERDAO_PROFILE=testnet V3_DEPLOYMENT=deployments/jury-new.json npm run verify-deployment
DISASTERDAO_PROFILE=testnet V3_DEPLOYMENT=deployments/jury-new.json npm start
```

Der Name bestimmt auch das zweite Manifest `jury-new-community.json` und die getrennten Datenbankbereiche. Bestehende Deployments werden verifiziert/erhalten. Unpassende Runtime wird abgewiesen; niemals alte Manifeste blind löschen oder öffentliche Contracts als aktualisiert behandeln.

Vor Deployment wird eine doppelte Gebührenreserve verlangt. RPCs ohne funktionierende Gas-Zustandsüberschreibung werden über denselben Constructor mit bestehendem Testtoken konservativ geprüft; der Bericht benennt Probe und Puffer. Für neue Deployments gilt eine feste Gebührenobergrenze; bei steigender Base Fee wartet die Transaktion. Jeder gesendete Deploymenthash wird in einem privaten Fortschrittsjournal gespeichert. Nach einem Abbruch Journal und Receipts prüfen; ein unvollständiger gleichnamiger Versuch darf nicht blind wiederholt werden.

Der lokale Betreiber stellt bei Bedarf Testgas für registrierte NGO-Transaktionen bereit: konkrete Gasschätzung plus Puffer, höchstens 0,00004 Test-ETH Zielguthaben pro Vorgang. Prüfschlüssel und Testwallet gelangen nicht in den Browser. Der Mechanismus ist keine produktive Authentifizierung.

## Kanonische Artefakte

`npm run contracts:build` erzeugt bei fehlenden/geänderten Quellhashes einen vollständigen Contract-Build und eigene App-Artefakte unter `out/integrated`. Partielle Forge-/Test-Artefakte werden nicht als Deployment-Wahrheit übernommen. Die aktuellen Deployment-/Jury-/Verifikationsbefehle prüfen diesen Cache automatisch; kein manuelles ABI-Kopieren nötig.

## Daten, Schlüssel und Wiederherstellung

- `.env`, `.env.roles`, `.runtime/testnet-roles.json` und `.runtime/integrated-*-documents-*.key` privat sichern. Ohne Dateischlüssel sind verschlüsselte Originale unlesbar.
- PostgreSQL-Bereiche binden Chain-ID, Manifestname und Bündnis. S3-Originale sind AES-256-GCM-verschlüsselt; Browserlinks sind einmalig und 60 Sekunden gültig.
- Neustarts erhalten DB, Chain und Dateien; Browser-Sitzungen verfallen. Kein `docker compose down -v` als normale Reparatur.
- Bei geänderter Contract-Runtime neues Manifest und damit neue isolierte App-Daten verwenden. Alte Deployment-/Auszahlungsnachweise bleiben historisch.
- Ein geminter Vorgang kann vor zwei Folgeblöcken noch im Index fehlen. Worker läuft regelmäßig; die UI kennzeichnet ausstehende/veraltete Bestätigungen.

Alternative freie Web-/API-Ports: `DISASTERDAO_UI_PORT=5174 DISASTERDAO_API_PORT=3009 npm start`. Der Vite-Proxy und die erlaubten Loopback-Origins übernehmen dieselben Werte. Der RPC kann ausdrücklich mit `V3_RPC` gewählt werden; das tatsächliche Netzwerk muss zum Profil passen.

[Demo und Freigaben](UI.md) · [Jury](../JURY.md) · [Funktionslandkarte](LANDKARTE.md)
