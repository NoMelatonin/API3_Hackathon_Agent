# V3-Abnahme — 30.10.2026

Umgesetzt auf `feat/disasterdao-shared-fund`, Ausgangspunkt `e7bb4b8`. Keine öffentlichen Chain-Transaktionen, kostenpflichtigen Quellenabfragen, Videos oder externen Veröffentlichungen. Keine Migration bestehender Gelder. Vorhandene unversionierte Dateien wurden nicht übernommen oder verändert.

## Ausgeführt

| Prüfung | Ergebnis |
|---|---|
| TypeScript / `npm test` | 30 bestanden; der separat aufrufbare Integrationstest ist im Standardlauf ausdrücklich übersprungen |
| Backend-/Frontend-Typecheck und Produktionsbuild | bestanden; V3 und beide Demo-Einstiege in getrennten Bundles |
| `forge test` | **65 bestanden**, davon 50 unveränderte V1/V2-/Starter-Regressionen und 15 V3-Tests einschließlich Invariante |
| Fuzzing | jeweils 1.000 Durchläufe; V3 zusätzlich 256 Invariantenfolgen mit insgesamt 128.000 Handler-Aufrufen |
| PostgreSQL + privates S3 + echte lokale Contract-Aufrufe | vollständiger Integrationstest bestanden, eigenes Testschema und Snapshot-Rücksetzung |
| Chrome / Playwright | **4 bestanden**: 39 Sprachen, 51 Länder, Entwurfsstatus, RTL, 375/768/1440px, Hell/Dunkel, Tastatur, vollständiger NGO-Ablauf, Legacy-Einstiege und private Dateisperren |
| Runtime und Rollen | Contract-/Tokencode, Immutables/Domain, feste Rollen und Reservierungsdeckung am finalen lokalen Deployment geprüft |
| Gesamtstart | `npm run v3:start` mit Compose, Build, Deploymentprüfung, Backend und Vite tatsächlich gestartet |
| Persistenz | echten Anvil-Containerneustart ausgeführt; danach Code, Rollen, 18.000-dUSD-Bestand sowie Integration erneut erfolgreich geprüft |

Der Starttest deckte einen Schreibrechtefehler des Anvil-Named-Volumes auf. Dieser wurde behoben; die finale private Konfiguration ist `.runtime/v3.1-persistent.json`. Ältere lokale V3-Versuche bleiben als Dateien erhalten. Die Fehlversuche wurden nicht als bestandene Prüfungen gezählt.

## Inhaltliche Abdeckung

Solidity: manipulierte Beträge, fremder Signer, doppelte Signer, falscher Fonds/Domain, abgelaufene Bewertung, wiederverwendete Nonces und Rundensnapshots; unsichere 90%-Grenze, doppelte Grants und atomare Rücknahme; vorläufige Reserven, 24-Stunden-Ablauf, Einzahlungen nach Rundenschluss; kumulative Folgeanträge über beide Wege; gesperrte Selbstabstimmung; fällige Nachweise ohne Worker, rechtzeitiger Eingang ohne Verwendungsakzeptanz, Ablehnung, Einspruch durch getrennte Prüfer, Nachforderung, einmalige Verlängerung; fehlgeschlagene Transfers und Budgeterhaltung.

TypeScript: deterministische Ganzzahlverteilung und Rundungsreste, 999 verschiedene Budgetstände, nicht beantragte konkurrierende Pakete, externe Finanzierung, doppelte Arbeitspakete, fehlende Daten, weniger als zehn unabhängige Ereignisse, reale/synthetische Trennung, ereignisweise zeitliche Rücktests, USGS-Pagination einschließlich wiederholter Seiten, fehlgeschlagene/teilweise/veraltete Gebietsabdeckung und UTC-Werktage.

Integration: organisationsfremde Anträge/Reservierungen/Dokumente, falsche Rolle und Origin, zwei getrennte Prüferzustimmungen; Rücknahme einer Stimme bei Befangenheit und Ersatz durch den dritten Prüfer; abgelaufener und wiederverwendeter Upload-Link; tatsächliche S3-Verschlüsselung und Entschlüsselung; gesalzener Eingang, getrennte Verwendungsprüfung, Veröffentlichung erst nach 2/3; keine Dokumentnamen/-IDs im öffentlichen Export; manuelle Lageentscheidungen; idempotente Chain-Logs und Entfernung verwaister Auszahlungslogs nach Reorg.

Browser: alle Sprachressourcen tatsächlich gewählt, sichtbare Entwurfsmarkierung, unabhängige Einstellungen und Persistenz; RTL und beide Farbmodi ohne horizontalen Überlauf; Testspende, Antrag, Datenprüfung, Runde, Auszahlung und Upload; Theme-Schalter der erhaltenen V1/V2-Einstiege. Zusätzliche Direktzugriffe auf `.runtime` und Backendquellen einschließlich Vites `@fs`-Pfad werden mit 403 abgewiesen. Die entsprechenden [Vite-Dateisperren](https://vite.dev/config/server-options.html#server-fs-deny) sind explizit konfiguriert.

## Grenzen der Abnahme

- Keine neuen signierten Live-Abfragen. Authentische Airnode-Fixtures und deren Originalbytes bleiben V1/V2-Nachweise. V3s optionale USGS-/EONET-HTTP-Adapter wurden mit kontrollierten Antworten getestet; kein erfolgreicher neuer Live-Lauf wird behauptet.
- Keine geeignete reale globale 30-Tage-Ausgabenbasis nachgewiesen. Modell-, Sensitivitäts- und Fairnessmechanik sind mit synthetischen Fällen geprüft, nicht fachlich validiert. Zusätzliche GDACS-/WorldPop-/EM-DAT-/WHO-/FTS-Integrationen und Datennutzungsrechte sind als Lücken registriert.
- Keine echte Organisationsanmeldung, unabhängigen Menschen, Wirtschaftsprüfung oder humanitäre Wirkung. Feste drei NGOs und getrennte Dreiergruppen demonstrieren die Regeln.
- Kein Feiertagskalender für die Zehn-Werktage-Zielmarke. Fristen selbst verwenden Chain-Zeit; keine Nachrichten wurden versendet.
- Keine fachliche Freigabe der 37 zusätzlichen Übersetzungsentwürfe. Originalmanifeste und freie Nutzertexte werden nicht automatisch übersetzt.
- Keine Live-EZB-/InforEuro-Integration. Fehlende historische Fiat-Kurse bleiben unbekannt; dUSD besitzt keinen Fiat-Kurs.
- V1/V2-Verträge und bestehende Tests bestehen weiterhin. Ihre **Transaktions-Browserabläufe** wurden in dieser Umsetzung nicht mit neuen historischen Deployments wiederholt; geprüft wurden die Demo-Einstiege, Darstellung und Solidity-Regressionen.
- Sichtprüfung von Mobile-Screenshots und automatisierte Layout-/Fokusprüfungen durchgeführt; keine vollständige WCAG-Zertifizierung, Penetrationsprüfung oder produktive Reorg-/Ausfallfreigabe behauptet.
- Vite meldet weiterhin den vorhandenen browserfremden optionalen `node:worker_threads`-Import aus einer Legacy-Abhängigkeit. Der Build und die geprüften Browserabläufe bestehen.

Reproduktionsbefehle und Ablauf: [LOCAL.md](LOCAL.md). Integrations-/Browsertests nicht gleichzeitig mit manuellen Transaktionen ausführen.

## UI-Weiterentwicklung — 31.10.2026

Ausgeführt auf `disasterdao-shared-fund-ui-improvements`, Basis `59aa382`. Die historische Abnahme oben bleibt als solche erhalten. Aktuelle Routen, APIs und der externe Prüfablauf stehen in [UI.md](UI.md).

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 11 Testdateien ohne Fehler; neuer Testkonto-/Signatur-/Browserrollen-Test und ergänzte Sprachressourcenprüfung enthalten |
| `npm run build` | Backend-/Frontend-Typechecks und Produktionsbuild bestanden |
| Solidity 0.8.37 / Forge | 65 Tests bestanden; einschließlich 256 Invariantenfolgen mit 128.000 Aufrufen |
| `V3_INTEGRATION=1 node --test --test-concurrency=1 server/app.test.ts` | Vollständiger isolierter Ablauf bestanden: echte PostgreSQL-, S3- und lokale Contract-Aufrufe |
| Produktionsbuild / Chromium | 3 Browserfälle bestanden: getrennte Einstiege und alte Links, 39 Sprachoptionen, RTL, Hell/Dunkel, Fokus, Bildwechsel, Testspende und NGO-Vorschau/Antrag |
| Sichtprüfung | Screenshots bei 375/768/1440 px in Hell/Dunkel; zusätzlich berechnete Hintergrundfarbe, Headerlayout und Icongröße geprüft |
| `git diff --check` | bestanden |

Der Integrationstest prüft zwei externe Signaturen einschließlich tatsächlicher CLI-Signierung, falsche Domain/Chain/Payload/Zweck, doppelte Signer, fremde NGO-Zugriffe, manipulierte Dokumentbindung, abgelaufenen Eingang, Einmallinks, getrennte Eingangs-/Verwendungsentscheidung, Veröffentlichung, vollständige Fondsdaten und Entfernung verwaister Einzahlungen nach Reorg. Ein erneuter Import darf einen bereits ausgezahlten Antrag nicht auf „geprüft“ zurücksetzen. Alte interne Prüfdrafts werden bei externer Vorbereitung archiviert und ohne übernommene Stimmen ersetzt.

Die Sichtprüfung fand eine fehlerhafte Zusammenfassung bedingter CSS-Imports im Produktionsbundler. Explizite Importzweige beheben dies; Browserprüfungen kontrollieren jetzt tatsächliche Styles. Der danach sichtbar gewordene blockierende Google-Fonts-Abruf der V1-Demo wurde durch lokale Dateien derselben Schriftfamilien mit SIL-OFL-Lizenzen ersetzt. V1/V2-Aufbau und Contracts bleiben erhalten.

Reproduktion der Browserprüfung mit laufendem Backend und `vite preview --host 127.0.0.1 --port 4173`:

```sh
V3_UI_URL=http://127.0.0.1:4173 CHROME_PATH=/usr/bin/chromium npm run v3:test:ui
```

In dieser Cloud-Umgebung wurde Forge direkt über `node_modules/@foundry-rs/forge-linux-amd64/bin/forge test --use /tmp/disasterdao-solc` aufgerufen. Die lokal bereitgestellte Compilerdatei ist Solidity 0.8.37; der standardmäßige Installationspfad war schreibgeschützt. Es wurden keine Contract-Quellen geändert.

Die Browserfälle prüfen bei privaten Quellpfaden entweder eine Zugriffsverweigerung oder die reine HTML-Fallbackseite des statischen Previewservers; private Dateien werden nicht ausgeliefert. Die Vite-Dateisperren bleiben konfiguriert. Legacy-Transaktionsabläufe auf neuen V1/V2-Deployments wurden nicht ausgeführt. Neue Oberflächentexte sind DE/EN-Ausgangstexte; andere Sprachen verwenden sichtbar gekennzeichnete englische Ausgangstexte. Die Abnahme behauptet keine vollständige WCAG-Zertifizierung oder produktive Identitäts-/Prüferinfrastruktur.
