> Historie bis Commit `2436dee`. Kein aktueller Start-/Jury-Ablauf. Frühere Prüfungen sind keine neue Integrationsabnahme. Alte relative Links und Befehle können überholt sein. Aktuell: [DisasterDAO](../../README.md).

> V3-Update: Zwei lokale Demo-Bündnisse und geführter NGO-Ablauf: Ereignis belegen → beantragen → reservieren → abrufen → Verwendung nachweisen. [Regeln und Zuständigkeiten](docs/v3/LANDKARTE.md#datenbasierter-abruf-neu), [Start und Demo-/Live-Grenzen](docs/v3/LOCAL.md#zwei-bündnisse-und-oracle-abruf--31102026).

# DisasterDAO

## V3: lokaler gemeinsamer Fonds und getrennte Oberflächen

**V3 verstehen:** [Landkarte der Funktionen, Rollen, Abläufe und groben Umsetzung](docs/v3/LANDKARTE.md).

Auf `disasterdao-shared-fund-ui-improvements`: getrennte Entdeckung, Organisationsdetail und NGO-Arbeitsbereich; gemeinsamer Fonds, externe 2/3-Signaturfreigaben, proportionale Förderrunden, kumulative Tranchen und private Nachweise. PostgreSQL und verschlüsselter privater S3-Speicher laufen lokal; 39 UI-Sprachen und System/Hell/Dunkel sind enthalten.

```sh
npm run install:local
npm run v3:demo
```

Für eine reibungslose lokale Vorführung erzeugt `npm run v3:demo` ausdrücklich alle zwei Sekunden Anvil-Blöcke zur Bestätigung. Der reguläre Worker erzeugt keine Blöcke. [Fünf-Schritte-Demo](docs/v3/UI.md#geführte-fünf-schritte-demo).

Für spätere Starts genügt `npm run v3:start`: Abhängigkeiten werden automatisch geprüft und bei Änderungen installiert. Im cloud-synchronisierten Checkout `npm run install:local` statt direktem `npm ci` verwenden; Pakete liegen lokal außerhalb des Desktop-Ordners. [Details und Wiederherstellung](docs/v3/LOCAL.md#abhängigkeiten-ohne-cloud-blockade).

**User: http://127.0.0.1:5173/?v3=1#/home** · **Demo: http://127.0.0.1:5173/?v2=1** · **NGO-Einstieg: http://127.0.0.1:5173/?v3=1&ngo=1** · [Oberflächen und externe Freigaben](docs/v3/UI.md) · [Start und vollständiger Ablauf](docs/v3/LOCAL.md) · [Prüfbericht und Grenzen](docs/v3/VERIFICATION.md).

Die Kopf-Navigation verbindet Demo, NGO und User. Unter User zeigt ein Ringdiagramm die bestätigten Einzahlungen des gemeinsamen Testkontos je Bündnis, inklusive Initialfinanzierung; keine persönlichen Guthaben oder echten Gelder. Ein Ansichtswechsel erhält eine aktive NGO-Sitzung.

Alle Rollen, Kostenbeispiele und Dokumente sind simuliert. Ein echtes vergleichbares 30-Tage-Ausgabenkorpus ist noch nicht belegt; keine automatische empirische Bedarfsfreigabe. V1/V2 und vorhandene Deployments bleiben erhalten. V2-Vorschau: `/?v2=1`; lokale V2 weiterhin `/?local=1`.

## V2: adaptive Auszahlungen und drei Einsätze

Der Arbeitsbranch `feat/disasterdao-multi-source` ergänzt einen **neuen lokalen Fonds** mit exponentieller Erdbeben-, quadratischer Sturm- und linearer Gesundheits-Förderkurve. Pro NGO und Einsatz einmalig 500–2.000 dUSD; drei reservierte Einsatzbudgets ergeben 18.000 dUSD. V1-Contract, Testnet-Deployment und ursprüngliche Nachweise bleiben erhalten.

Die V2-Vorschau ist nach `npm run dev` unter `/?v2=1` erreichbar. Lokale V2: **http://127.0.0.1:5173/?local=1**. Den bisherigen MVP erreicht man mit **http://127.0.0.1:5173/?legacy=1**, lokal zusätzlich `&local=1`.

**Echt belegt:** USGS und NASA EONET mit unveränderten Airnode-Signaturen sowie lokalen Contract-Auszahlungen. **WHO blockiert:** Airnode HTTP 502 wegen Upstream HTTP 500; im Standardfonds keine WHO-Oracle-Auszahlung. Die WHO-Kurve wird ausschließlich synthetisch getestet.

[V2 starten, Formeln, Parameter und Prüfgrenzen](docs/V2.md) · [Quellenstatus](docs/sources/STATUS.md).

Die folgenden Abschnitte dokumentieren den erhaltenen **V1-MVP mit festen 1.000-dUSD-Zahlungen**. Seine lokalen Browseraufrufe benötigen jetzt `&legacy=1`; die V1-Skripte sind unverändert.

Gemeinsamer NGO-Katastrophenfonds mit signierter Soforthilfe und einem begrenzten 2/3-Notfallpfad. Hackathon-Prototyp mit **fiktiven NGOs, historischen Ereignisdaten und wertlosen Testmitteln**.

## Laufender Prototyp

- **Netzwerk:** Base Sepolia, Chain-ID `84532`.
- **Fonds:** [`0x8b1cad09c9be9d2e1ff38f4a490951bc1a317257`](https://sepolia.basescan.org/address/0x8b1cad09c9be9d2e1ff38f4a490951bc1a317257).
- **dUSD-Demotoken:** [`0xdc6ab1e15c3f23b05276fde1ac4a7311abe8e914`](https://sepolia.basescan.org/address/0xdc6ab1e15c3f23b05276fde1ac4a7311abe8e914).
- [Echte Oracle-Auszahlung, 1.000 dUSD an NGO 1](https://sepolia.basescan.org/tx/0x1eb9c1960f8e73779709f0021438f1b24692e671b8c7f6b322f5fcb0001accd1).
- [Notfall-Auszahlung nach zwei Freigaben, 1.000 dUSD an NGO 2](https://sepolia.basescan.org/tx/0xce84643833c8529aa502befe4edbde47d9f599e02c3f83eb0b070074fbed3242).
- NGO 3 bleibt zunächst für Jury-Tests offen. Die Ansprüche sind einmalig; für wiederholte gültige Auszahlungen einen neuen Fonds deployen.
- Alle vier offiziellen Manipulationsfälle am deployten Contract abgewiesen: [Testbericht](deployments/tamper-report.json). Dies sind `eth_call`-Simulationen, keine absichtlich fehlgeschlagenen Transaktionen.
- [Demo-Video, 74,6 Sekunden](demo/DisasterDAO-demo.webm): mit deutschen Texteinblendungen, ohne Ton. Vollständiger lokaler Ablauf mit echten Signaturen und historischer Chain-Uhr, anschließend die tatsächlichen Testnet-Nachweise.

## Starten

Node.js ≥ 22.18 (geprüft mit 24.15.0):

```sh
npm run install:local
npm run forge -- build
npm run dev
```

Oberfläche: **http://127.0.0.1:5173/**. Die öffentliche Deploymentkonfiguration ist enthalten. Ein Browserwallet wird nur für Transaktionen benötigt. Simulationen funktionieren ohne Wallet. Alternativ dienen die Skripte als vollständiger Jury-Zugang.

Für eigene bezahlte API-Abrufe bzw. Transaktionen eine `.env` anhand von `.env.example` anlegen. `PAYER_PRIVATE_KEY` ist ausschließlich ein separater Testwallet-Schlüssel (64 Hexzeichen, optional `0x`). `DEPLOYER_PRIVATE_KEY` ist optional und fällt auf die Projekt-Testwallet zurück. Keine Schlüssel in Chat, Repository oder Browsercode. `.env` und `.env.roles` sind ignoriert.

API-Zahlungen: Base-Sepolia-**aUSD** von der [API3-Faucet](https://airnodehub.api3.org/faucet); 0,01 aUSD pro USGS-Abfrage. Der Facilitator zahlt die Transfer-Gasgebühr. Minting und Anwendungstransaktionen benötigen zusätzlich Test-ETH. **aUSD und der Fonds-Demotoken dUSD sind unterschiedliche Assets.**

## Jury: eigene Antwort einreichen

Auf dem bestehenden Fonds ist NGO 3 noch offen (vor Ausführung Status prüfen). Neue Dateinamen verwenden; der Abruf überschreibt keine bestehenden Fixtures.

```sh
npm run fetch-response -- --out fixtures/jury-fresh.json
npm run submit-response -- --file fixtures/jury-fresh.json --ngo 3 --simulate
npm run submit-response -- --file fixtures/jury-fresh.json --ngo 3
npm run tamper -- --file fixtures/jury-fresh.json --ngo 3
```

Die originale Antwort muss **nach Fondsaktivierung** signiert und bei Einreichung höchstens fünf Minuten alt sein. Für die vier Ablehnungsfälle verwendet `tamper` zusätzlich die enthaltene echte alte Antwort und die echte Antwort einer anderen Anfrage. Netzwerkfehler zählen nicht als erfolgreiche Ablehnung. Keine signierten Zeitstempel verändern, um Alter zu simulieren.

Die Einreichungsskripte prüfen die Attestation bewusst **nicht** vorab: Der deployte Contract muss manipulierte Daten selbst zurückweisen. Die Oberfläche bietet unter „Signaturprüfung / Jury“ Dateiupload, Simulation und Auszahlung. Simulation allein verändert keinen Zustand.

### Neuer Fonds und Notfallpfad

```sh
npm run init-demo
npm run estimate-deploy
npm run deploy
npm run verify-deployment
```

`init-demo` nur einmal ausführen, falls `.env.roles` noch nicht existiert. Es erzeugt sechs getrennte lokale Testrollen. Alle Rollen werden im Prototyp von einer Person simuliert; das ist keine institutionell unabhängige Governance. Die Schlüssel werden niemals an die Oberfläche gegeben.

Das Deployment schätzt beide Contract-Erstellungen, Finanzierung und Aktivierung einschließlich Base-L1-Datengebühren und verlangt eine doppelte Gebührenreserve. Es aktiviert den vollständig finanzierten Fonds und schreibt die öffentliche Konfiguration. Bestehende Deploymentdateien werden vor jeder Transaktion abgewiesen. Zum bewussten Wiederholen:

```sh
npm run deploy -- --deployment deployments/jury-new.json
npm run emergency -- --deployment deployments/jury-new.json --ngo 2
```

Dies erzeugt einen neuen, eigenständigen Fonds und aktualisiert die lokale Oberfläche auf ihn. `--deployment` auch bei `submit-response`, `tamper` und `verify-deployment` angeben, um genau diesen Fonds zu prüfen. `emergency` signiert zwei getrennte Genehmigungen aus `.env.roles`, stellt begrenztes Testgas bereit und zahlt an die feste NGO-Adresse. Bereits erfolgte Genehmigungen desselben Vorgangs werden beim Wiederholen übersprungen.

## Lokal reproduzieren und prüfen

```sh
npm run typecheck
npm test
npm run forge -- test -vv
npm run check-real
npm run build
```

**Geprüft:** 20 TypeScript-Tests, 33 Solidity-Tests mit 1.000 Fuzz-Durchläufen, fünf Browsertests, Produktionsbuild, echte Base-Sepolia-Auszahlungen und vier Contract-Ablehnungen. Die eingebundenen Nodary-Fixtures dienen nur den übernommenen Starter-Regressionstests, niemals als Katastrophennachweis.

Für die Browsertests eine **frische lokale Chain** starten (historische Uhr ausdrücklich nur für die lokale Simulation):

```sh
npm run anvil -- --host 127.0.0.1 --timestamp 1793373040 --silent
```

In einem zweiten Terminal, mit vorhandener `.env.roles` und freiem Namen für die Deploymentdatei:

```sh
npm run deploy -- --local
npm run dev
npm run test:ui
```

Die Tests benötigen Chrome unter macOS oder ein installiertes Playwright-Chromium (`npx playwright install chromium`); alternativ `CHROME_PATH` setzen. Sie stellen den lokalen Chainzustand nach jedem Fall wieder her. Vor einem neuen vollständigen Durchlauf eine frische Chain verwenden. Bei bereits vorhandener ignorierter lokaler Deploymentdatei einen neuen Namen mit `--deployment` wählen; die Browsertests lesen die jeweils aktuelle öffentliche lokale Konfiguration.

Einzelne lokale CLI-Demo nach den Browsertests:

```sh
npm run local-clock -- --local
npm run submit-response -- --local --file fixtures/usgs-fresh.json --ngo 1
npm run tamper -- --local --file fixtures/usgs-fresh.json --ngo 2
npm run emergency -- --local --ngo 2
```

Die lokale UI ist unter `http://127.0.0.1:5173/?local=1` erreichbar. `local-clock` verweigert jede andere Chain als 31337. Öffentliche Testnet-Zeitstempel werden niemals angepasst.

## Regeln und Grenzen

Ein unveränderlicher Einsatz: Türkei-Erdbeben **USGS `us6000jllz`, 06.02.2023**, Magnitude 7,8. Drei festgelegte NGOs erhalten je einmal 1.000 dUSD; Gesamtbudget 3.000 dUSD. Das dUSD-Angebot ist auf 3.000 begrenzt und hat sechs Dezimalstellen. Aktivierung setzt vollständige Finanzierung voraus.

`claim(ngo, timestamp, data, signature)` prüft den unveränderlich konfigurierten Signer und Anfragehash, Signaturalter ≤ 300 Sekunden, keine Zukunft und keine Signatur vor Aktivierung. Die authentifizierten Daten müssen Ereignis-ID, Typ `earthquake`, Status `reviewed`, Magnitude ≥ 7,0, den Ereignistag und 36–39° N / 35–39° E erfüllen. Signaturzeit und historische Beobachtungszeit werden getrennt geprüft. Fehlende/null Felder sind ungültig, nicht „unter der Schwelle“.

`approveEmergency(ngo, reasonHash)` und `executeEmergency(ngo, reasonHash)` ersetzen den Oracle-Trigger durch zwei unterschiedliche Genehmigungen derselben NGO/Begründung. Die drei Verantwortlichen sind von allen NGO-Adressen getrennt. Beide Pfade verbrauchen **denselben Anspruch**. Keine zusätzliche Folgetranche oder doppelte Auszahlung durch neue Signaturen. Zustand wird vor dem sicheren Token-Transfer aktualisiert; Reentrancy-Schutz ist aktiv.

Es gibt keine administrativen Regeländerungen, Upgrades, beliebigen Abzüge oder Rückzahlung überschüssiger Einzahlungen. **Keine echten Mittel einzahlen.** Ein on-chain Notfallpfad löst weder Chain-Ausfälle noch ein unerreichbares Quorum. Nachprüfung ist eine dokumentierte Prozesspflicht, keine implementierte Wirtschaftsprüfung. Personenbezogene Belege gehören nicht auf die Chain.

Die Airnode-Signatur belegt, was **API3 über die USGS-API** gelesen hat. USGS selbst betreibt diesen Signierer nicht. Die Signatur beweist weder die Richtigkeit der Naturgefahrendaten noch Bedürftigkeit, Lieferung von Hilfsgütern oder korrekte Mittelverwendung. Es gibt keine bestätigten Partner oder belegte humanitäre Wirkung.

## Quellen und Abgabe

- [Offizieller API3-Track](https://api3dao.github.io/airnodehub-hackathon/docs/).
- [USGS-Airnode mit Operationen und Signer](https://airnode-usgs.fly.dev/).
- [USGS-Ereignis](https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=us6000jllz).
- [API3-Starter](https://github.com/api3dao/airnodehub-hackathon-starter), Commit `52933ae1fb9371446a927338473466c3d320e19a`.
- Übernommene Quellen und Lizenzen: `contracts/vendor`, `src/vendor`, `vendor`; Versionsstände in `vendor/versions.json`. Nur Fixture-Pfade der Starter-Tests angepasst; pnpm wegen bekannter Advisories aktualisiert.
- [Demo und Abgabecheckliste](docs/DEMO.md), [Devfolio-Entwurf](docs/DEVFOLIO.md), [Testnet-Nachweise](deployments/demo-report.json).

Deadline: **31.10.2026, 15:00 Uhr MEZ**. Kein autonomer Agent; kein Agent-Bonus beansprucht. Devfolio-Einreichung, Video-Upload und gegebenenfalls Änderungen der Repository-Sichtbarkeit erfolgen separat durch den Nutzer.

Die GitHub-Sichtbarkeit wurde am 30.10.2026 geprüft: Das Repository ist derzeit **privat**. Vor Abgabe muss es öffentlich sein; die Sichtbarkeit wurde nicht verändert.

Projektbericht für Leser ohne Vorwissen: [Umsetzung, abgeschlossenes Review und priorisierter Ausblick](output/pdf/DisasterDAO_Projektbericht_Review_und_Ausblick.pdf).
