# Integrationsabnahme

Stand: 31.10.2026. Grundlage ist die tatsächlich integrierte Implementierung, kein bloßes Branch-Merge. Frühere Tests bleiben [historisch](../history/v3-VERIFICATION.md).

## Neuer öffentlicher API3-Nachweis

Netzwerk **Base Sepolia**, Chain-ID **84532**. Erster integrierter Fonds: `0x31b632b6b01d486c5c7081423950f4a6edd58728`. Zweites Bündnis: `0xff80001619324e2f99079ce246a89a7fa53effc5`.

Beide Fonds wurden neu deployt, vollständig mit ihren konfigurierten 18.000/9.000 wertlosen dUSD finanziert, aktiviert und anhand von ausführbarem Runtime-Code, unveränderlichen Parametern, Quellen-Policies und getrennten Rollen geprüft. Bestehende V1-/V2-Contracts wurden nicht verändert.

**Neue erfolgreiche Auszahlung: 500 dUSD** an die feste NGO-Adresse, Block **52595953**:

- [Antrag](https://sepolia.basescan.org/tx/0xedc5c4324787d605d9622f9c9073d5307bef70d07a4b1c30a685d564daf1ac13)
- [Reservierung](https://sepolia.basescan.org/tx/0xcdc08f6dcb81f744578d742940abd0030a87191cc820e72902015ab4a55530b1)
- [Auszahlung](https://sepolia.basescan.org/tx/0x39a398293c0c6e4a9bfa5b6b1f47560798ca9545d458e856c1db15c71dad2b4a)

Der Nachweis prüft erfolgreichen Receipt, `Paid`-Ereignis, `totalPaid`-Zuwachs und den tatsächlichen Token-Guthabenzuwachs des festen Empfängers von 0 auf 500 dUSD. Originale USGS-Antworten sind getrennt für Antrag und Reservierung enthalten; beide wurden nach Aktivierung signiert. Ein erster Versuch stoppte nach dem Antrag wegen unzureichend pauschal bereitgestelltem Testgas. Derselbe Antrag wurde nach konkreter Gasschätzung mit einer neuen unveränderten Originalantwort reserviert und ausgezahlt. Es wurde keine zweite Beantragung oder synthetische Ersatzsignatur verwendet.

[Maschinenlesbarer vollständiger Nachweis](../../deployments/integrated-report.json) · [erstes Deployment](../../deployments/integrated-base-sepolia.json) · [zweites Deployment](../../deployments/integrated-base-sepolia-community.json)

## Vier getrennte Ablehnungen

Direkte `eth_call`-Simulationen von `automaticReserve` gegen den integrierten Fonds, jeweils mit protokolliertem Block:

| Fall                                          | Block    | Tatsächlicher Revert |
| --------------------------------------------- | -------- | -------------------- |
| Gültige Originalantwort                       | 52595931 | akzeptiert           |
| Veränderte Magnitude                          | 52595933 | `NotSignedByAirnode` |
| Echte unveränderte alte Antwort               | 52595934 | `OracleStale`        |
| Frische Originalantwort einer anderen Anfrage | 52595936 | `NotSignedByAirnode` |
| Unerwarteter Signierer                        | 52595937 | `NotSignedByAirnode` |

Der gültige Kontrollfall war akzeptiert. Der Stand der ausgezahlten Mittel blieb während aller Simulationen unverändert. Netzwerkfehler werden nicht als Ablehnungen gezählt. Die alte Antwort wurde nach Fondsaktivierung original beschafft und ohne Zeitstempeländerung tatsächlich altern gelassen. Keine absichtlich fehlgeschlagenen Transaktionen wurden dafür gesendet.

[Einstieg für eigene Jury-Dateien](../JURY.md). Die festgelegten historischen Ereignisfenster sind bewusst von der maximal fünfminütigen Signaturfrische getrennt; auf öffentlichen Chains wurde keine Uhr verändert.

## Lokale Prüfungen

- TypeScript- und Web-Typecheck sowie Produktionsbuild.
- TypeScript-Regressionen für Attestationen, x402, Originaldateischutz, gemeinsame Allokation, Quellenzustände, Sprachen und Signaturgruppen.
- Solidity-Suite einschließlich 1.000 Fuzz-Durchläufen je Fuzztest und 256 Invariantenläufen. Der integrierte Fonds hat zusätzliche Prüfungen für gemischte Freigabepfade, gemeinsame Paketanteile, externe Finanzierung, kumulative Grenzen, ablaufende Lageatteste und unveränderte reale USGS-/EONET-Fixtures.
- Infrastrukturintegration für beide Bündnisse, getrennte Sitzungen, wiederholbare Anträge, Reservierung ohne Zahlung, einmaligen Abruf, Folgeförderung, private Nachweise, externe Eingangs-/Prüfentscheidungen, Wiederanlauf und Reorg-Rekonstruktion.
- Browser: einheitliche Navigation und alte Links, öffentliche Einzahlungen, NGO-Kernablauf bis akzeptierter Verwendung, Einstellungen/RTL/Themes, 375/768/1440 px und Jury-Originaldatei mit konkretem Signature-Revert.

Abschließende, getrennt ausgeführte Läufe: **81/81 Solidity-Tests**, **34 bestandene TypeScript-Tests** (die zwei Infrastrukturtests werden im Standardlauf ausdrücklich übersprungen), **5/5 Infrastruktur-/API-Prüfungen** einschließlich dieser beiden End-to-End-Fälle und **6/6 Browsertests (52,6 Sekunden)**. Typecheck und Produktionsbuild bestanden. Der vollständige Start `npm start` wurde inklusive Abhängigkeitsinstallation, gesunden Docker-Diensten, erhaltenen/verifizierten Deployments und Backend/Webseite ausgeführt. Ein überlappender früherer API-/Browserlauf wurde wegen gemeinsamer Chain-Snapshots verworfen; die Abnahme verwendet ausschließlich die anschließenden getrennten Läufe. Tests stellen Chain und beide App-Zustände wieder her. Der normale Worker erzeugt keine Blöcke; der lokale Demo-Taktgeber wird für die Bestätigungszustandstests ausdrücklich abgeschaltet.

## Zweite echte Quelle

Eine neue originale EONET-Antwort wurde gegen denselben integrierten Fonds in Block **52596905** von `automaticSubmit` akzeptiert (`eth_call`). Dies ist eine echte signierte Quellen-/Contract-Prüfung, keine zusätzliche Auszahlung. [Originaldatei](../../fixtures/integrated/eonet-current.json), [Ergebnis](../../deployments/integrated-eonet-check.json).

## Quellenstatus und Grenzen

WHO wurde erneut über die konfigurierte Airnode-Anfrage mit Test-aUSD aufgerufen: **HTTP 502, Upstream HTTP 500**. Kein WHO-Erfolg, keine WHO-Förderfreigabe und keine erfundene Antwort. [Aktueller Status](../sources/STATUS.md), [Abrufbericht](../../deployments/integrated-source-status.json).

Die NGOs, Prüfer, Dokumentbeispiele und Gelder bleiben simuliert. Echte Airnode-Signatur bedeutet authentifizierten Datenbezug, keine bestätigte Bedürftigkeit oder humanitäre Wirkung. Private Nachweisentscheidungen sind lokal vollständig getestet; daraus folgt kein produktiver institutionell unabhängiger Prüfprozess. Dynamische Mitglieder/Einsätze, persönliche Spenderkonten und reale signierte Flut-/Akutgesundheitsquellen bleiben außerhalb des Umfangs.

## Reproduzierbarkeit und Veröffentlichungsvorbereitung

Nach der Abnahme wurde der vollständige Contract-Build erneut gegen beide öffentlichen Fonds geprüft: ausführbarer Code, Token, Operator, Finanzierungsziel, Verifier, Allokator, Rollen und Policies stimmen überein. Separate kanonische Artefakte blieben auch nach einem vollständigen Forge-Testlauf unverändert; [Compiler-/Quellhashes](../../deployments/integrated-build.json) binden den Stand. Keine gelockerte Bytecode-Prüfung und kein behauptetes Upgrade alter Contracts.

Ein zusätzlicher Testnet-Browsercheck zeigte den echten 500-dUSD-Fall korrekt in Schritt 5 mit bestätigter Auszahlung auf Desktop und 375 px, ohne Seitenfehler. Der öffentliche Jury-Konfigurationszugriff wurde in einem neuen Prozess ohne private NGO-/Prüfer-Rollendatei geprüft. [Originaldatei-Audit](../../deployments/integrated-originals-audit.json) bestätigt die Signaturen aller sechs neuen Originaldateien, ohne abgelaufene Antworten als heute förderfähig zu bezeichnen.

Vor Veröffentlichung wurden Arbeitsdateien, bisherige Git-Blobs und der vorhandene PDF-Bericht auf die tatsächlich verwendeten 26 privaten Testschlüssel geprüft: kein Treffer; `.env`, `.runtime` und private AWS-Pfade sind nicht getrackt. Das ist ein konkreter Vergleich gegen vorhandene Schlüssel, keine pauschale Garantie gegen unbekannte Geheimnisse. Private Dokumente und Schlüssel werden nicht gepusht. GitHub-Deployments und laufende Actions waren leer; Pages-Abfrage lieferte 404. Repository bleibt privat. Der Tarif erlaubt keine abschließende Branchschutz-/Ruleset-Abfrage (403); eine Sichtbarkeits-/Tarifänderung wurde nicht vorgenommen.

Die Landkarte wurde nach den Änderungen erneut gegen Rollen, Ablauf, Finanzregeln, Quellen-/Demo-Grenzen, Infrastruktur und tatsächlich ausgeführte Prüfungen abgeglichen und aktualisiert. Historische Originalanleitungen und öffentliche Contracts bleiben getrennt nachvollziehbar.
