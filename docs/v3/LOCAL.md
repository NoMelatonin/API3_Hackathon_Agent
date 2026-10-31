# DisasterDAO V3 — lokaler Gesamtprototyp

> Aktueller UI-Ablauf auf `disasterdao-shared-fund-ui-improvements`: [getrennte Oberflächen und externe Signaturfreigaben](UI.md). Das frühere Prüferportal und dessen Browser-Anmeldung sind entfernt. Die untenstehenden Prüferportal-Schritte dokumentieren den vorherigen Ablauf; Freigaben werden jetzt extern vorbereitet, signiert und durch NGOs importiert.

V3 ergänzt V1/V2 auf `feat/disasterdao-shared-fund`. Es gibt keine Migration oder Änderung öffentlicher Verträge. Alle Organisationen, Prüfer, Einsatzpakete, Dokumente, Ergebnisse und Kostenbeispiele sind simuliert. Unterschiedliche lokale Schlüssel demonstrieren Zuständigkeiten; sie belegen keine institutionelle Unabhängigkeit.

## Start

Voraussetzungen: Node ≥22.18, Docker Desktop gestartet, freie Ports 5173, 3007, 5437, 9007 und 8547. Die Compose-Images sind per Digest festgelegt; geprüft auf macOS/Apple Silicon. Die erste Ausführung lädt die Images und benötigt Internet. Danach läuft die Standarddemo ohne externe Datenabrufe.

```sh
npm ci
npm run v3:start
```

Öffnen: **http://127.0.0.1:5173/?v3=1** (auch der neue Standard unter `/`). Start nur einmal ausführen; bereits laufende Vite-/Backend-Terminals zuvor beenden. Docker-Volumes und `.runtime/` bleiben beim Beenden erhalten. Weder bestehende lokale V1-/V2-Konfigurationen noch Original-Fixtures werden überschrieben.

Einzelschritte, falls Dienste separat gestartet werden sollen:

```sh
npm run v3:infra
npm run forge -- build
npm run v3:deploy
npm run v3:server
# zweites Terminal:
npm run dev
```

`v3:deploy` verweigert ein abweichendes bestehendes Deployment. Bei Wiederholung überprüft es Contract-Code (mit separat geprüften Immutables), Chain 31337 und alle Rollen. Die maßgebliche Konfiguration heißt `.runtime/v3.1-persistent.json`. Ein abweichender Fonds kann mit `V3_DEPLOYMENT=.runtime/eigener-name.json` für **sämtliche** V3-Kommandos gewählt werden. Frühere lokale V3-Entwicklungsversuche können daneben liegen und werden nicht migriert. Der Anvil-Container verwendet ein eigenes beschreibbares Named Volume und speichert seinen Zustand sekündlich.

V1 bleibt unter `/?legacy=1`, V2 unter `/?v2=1`, lokale V2 zusätzlich `&local=1`. Deren bisherige Skripte und historische Chain auf Port 8545 bleiben getrennt. V3 nutzt Port **8547** und verändert keine Originalsignatur oder deren Zeitstempel.

## Vollständiger Durchlauf

1. **Öffentlichkeit:** Gemeinsamen Fonds, Gebiete und Organisationen ansehen. Eine Testspende bis 1.000 dUSD verwendet das ausdrücklich simulierte lokale Spenderkonto. Anfangs liegen 18.000 dUSD im Fonds und weitere 18.000 beim Testspender. dUSD hat sechs Dezimalstellen und keinen Fiat-Wechselkurs.
2. **NGO:** Rolle `Relief North` wählen und anmelden. Einen Betrag unter dem vorgeschlagenen Maximum beantragen (z. B. 500 dUSD), Kapazität, externe Finanzierung und Begründung prüfen. Die Bereiche der drei NGOs sind ausdrücklich **synthetische, getrennte Drittel**; die Bevölkerung wird entsprechend aufgeteilt. Das ist keine echte Erhebung oder räumliche Bedarfsanalyse.
3. **Datenprüfung:** Rolle `data 1` anmelden und den Antrag bestätigen. Dann separat `data 2` anmelden und dieselbe Version bestätigen. Erst die zweite Freigabe öffnet den Antrag on-chain. „Befangenheit erklären“ entfernt eine noch offene Stimme; die dritte Person ersetzt einen ausgeschlossenen Prüfer. Abgeschlossene Entscheidungen werden dadurch nicht rückwirkend geändert.
4. **Runde:** Als Datenprüfer „Förderrunde“ erstellen und mit zwei Datenprüfern bestätigen. Die Erklärung enthält alle registrierten Einsatzpakete, auch solche ohne Antrag. Deren vorläufige Anteile werden 24 Stunden mitreserviert. Unbekannte Abdeckung hält zusätzlich 20% freier Mittel zurück; konkurrierende Krisen oder Unklarheit begrenzen kumulative Bewilligungen auf 90% des aktuellen Maximums. Gewichte hängen nicht von der selbst gewählten Antragssumme ab. Ein Antrag über 500 dUSD kann deshalb weniger erhalten.
5. **Auszahlung:** Wieder `Relief North` wählen und die Reservierung innerhalb von 24 Stunden abrufen. Auszahlung geht ausschließlich an die feste NGO-Adresse, unabhängig vom Relayer. „Aktualisieren“ liest Chain und Portal erneut.
6. **Nachweis:** Eine ausschließlich fiktive Textdatei erstellen, deren erste Zeile `DISASTERDAO SYNTHETIC` lautet. Danach etwa erfundene Rechnung, Zahlungsabgleich, Lieferbestätigung und Stichproben dokumentieren. Upload beim betreffenden Auszahlungsdatensatz. PDF/PNG/JPEG werden nach Dateisignatur geprüft und ausschließlich als Download ausgeliefert. Maximal 2 MiB. Ein separater kurzer Zwischenbericht kann bis Tag 7 eingereicht werden.
7. **Eingang:** Als `evidence 1` einen Eingangsprüfauftrag erstellen und bestätigen; als `evidence 2` denselben Auftrag bestätigen. Das gesalzene Manifest und die signierte Eingangszeit werden verankert. Dies bedeutet **noch keine akzeptierte Verwendung**.
8. **Verwendungsprüfung:** Einen neuen Auftrag vom Typ „Prüfung“ mit Entscheidung „Akzeptieren“, „Nachfordern“ oder „Ablehnen“ und dokumentierten Prüfhandlungen erstellen. Zwei Nachweisprüfer bestätigen dieselbe Entscheidung. Nachforderungen geben 14 Kalendertage; eine endgültige Ablehnung sperrt weitere Auszahlungen. Prüfziel: zehn UTC-Werktage (Mo–Fr, ohne Feiertagskalender).
9. **Bericht:** Nach akzeptierter Verwendung kann die NGO einen Bericht mit Herkunft, Nutzungsrechten und Schutzprüfung einreichen. Erst zwei Nachweisprüfer geben ihn für die lokale öffentliche Oberfläche frei. Auszahlungen, geprüfte Verwendung und behauptete Wirkung werden getrennt dargestellt; die Demo belegt keine reale Wirkung.
10. **Folgeantrag:** Neue Bewertung und dokumentierte Änderung einreichen und erneut von zwei Datenprüfern freigeben lassen. Danach entweder beide unbefangenen anderen NGOs abstimmen lassen (bei drei Mitgliedern mindestens 2/2) oder — nach akzeptierten bisherigen Nachweisen — einen Nachweisprüfauftrag „Folgeantrag“ durch 2/3 freigeben. Der Antragsteller kann sich nicht selbst zustimmen. Aktueller Restanspruch, Fristen und Budget gelten weiter.

Jede Runde dauert sechs Stunden. Für zeitabhängige lokale Tests kann ausschließlich die isolierte V3-Uhr weitergestellt werden:

```sh
npm run v3:clock -- --seconds 21600
```

Danach aktualisieren und **erst dann** eine neue Runde erstellen. Unabgerufene Reservierungen sowie vorläufige Rundenanteile können nach 24 Stunden freigegeben werden. Ein nicht ausreichend genehmigter Folgeantrag kann nach 72 Stunden geschlossen werden. Unveränderte Wiederholungen unterliegen der siebentägigen Sperre; dokumentierte wesentliche Evidenz muss erneut geprüft werden.

Verlängerung: Nachweisprüfauftrag „Verlängern“, maximal einmal und höchstens 30 Tage vor Fälligkeit. Einspruch: NGO innerhalb von 14 Tagen nach Ablehnung; Klärung durch die **separate** Gruppe `appeal 1–3` (2/3). Überfälligkeit prüft der Contract bei jeder Auszahlung ohne Worker. Eine rechtzeitige Einreichung kann binnen einer Stunde mit signiertem Eingangsattest verankert werden; längere Chain-/Worker-Ausfälle benötigen eine ausdrückliche Klärung, keinen stillen Fristreset.

## Daten und Modell

- [Datenregister](../../fixtures/v3/data-register.json) benennt die erhaltenen echten USGS-/EONET-Airnode-Fixtures. Sie belegen keine 30-Tage-Hilfskosten.
- Die 18 Vergleichsfälle in `src/v3/model.ts` sind **vollständig synthetisch**. Aktuelle Ausgaben und geplante Anforderungen werden getrennt behandelt. Bis zu 20 nächste unabhängige Ereignisse; mindestens zehn, alle Pflichtmerkmale und geeignete Quellen nötig.
- Gleiche Gewichte, robuste MAD-Standardisierung für Intensität, Dichte, Infrastruktur, Zugang, Preisniveau und logarithmierte erreichbare betroffene Bevölkerung. Median, gewichtetes 75%-Quantil, empirische Streuung, Bevölkerungsspanne, Ausschlüsse und Sensitivität werden erklärt. Die Spanne ist **kein kalibriertes Konfidenzintervall**.
- Zeitliche Rücktests halten ganze Ereignisfamilien zurück. Regionenvergleiche sind Testmechanik auf fiktiven Gruppen, kein Nachweis realer Fairness.
- 100.000 synthetische EUR (Preisstand 2026) entsprechen dem **Förderpolitik-Referenzfall** von 2.000 dUSD, begrenzt auf 4.500 je NGO/Ereignis. Das ist kein Wechselkurs und keine Kostendeckung. Bei fehlender Vergleichsgrundlage wird nur ein begründeter manueller Vorschlag zur 2/3-Prüfung angeboten; keine automatische empirische Freigabe.
- Der optionale Worker `V3_LIVE_SOURCES=1 npm run v3:server` ruft USGS mit vollständiger Pagination und EONET als ergänzenden Katalog **ohne Airnode-Signatur** ab. Standard: offline/unbekannt. Katalogvollständigkeit bedeutet keine vollständige Gefahrenabdeckung; EONET beansprucht kein vollständiges Quellenprofil.
- GDACS, WorldPop, EM-DAT, WHO und OCHA FTS haben ein Quellen-/Rechteregister, aber **keinen als funktionsfähig behaupteten V3-Live-/Airnode-Adapter**. WHO-Jahresinzidenz bleibt Kontext, kein akuter Trigger. Das reale globale Ausgabenkorpus und zusätzliche Nutzungsrechte bleiben unbewiesen.
- Dokumentierte manuelle Lageentscheidungen können im lokalen Prüferportal nach 2/3-Prüfung die Unsicherheitsreserve freigeben. Sie sind auf Gebiet/Version/Zeit begrenzt, laufen nach einer Stunde aus und stehen im Rundensnapshot. Sie sind ebenfalls simulierte Prüferentscheidungen.

## Architektur und Datenschutzgrenzen

Fastify bindet nur an Loopback. PostgreSQL speichert einen transaktional gesperrten JSONB-Aggregatzustand sowie getrennte Audit- und Chain-Logtabellen. Dies ist ein bewusst begrenzter lokaler Prototyp mit einem Bündnis, drei NGOs und festem Register v1; keine dynamische Mitgliederverwaltung oder Produktionsskalierung. Ein Registrywechsel benötigt einen neuen isolierten Fonds.

Die Rollenauswahl ist **simulierte Anmeldung**, keine reale Identitätsprüfung. Sitzungen sind zufällige HttpOnly-/SameSite-Cookies mit Ablauf, Schreibzugriffe benötigen den lokalen Request-Header und erlaubten Origin. NGO-Zugriffe sind serverseitig auf die eigene Organisation begrenzt. Datenprüfer können keine Originaldokumente herunterladen. Alle drei Nachweisprüfer sind im festen lokalen Register den synthetischen Nachweisen zugeordnet; Einsprüche haben eine getrennte Dreiergruppe.

Dokumente werden vor S3-Speicherung mit AES-256-GCM verschlüsselt. Der S3-kompatible RustFS-Bucket ist privat; AWS-/S3-Schlüssel und entschlüsselte Dateien gelangen nicht ins Frontend. Die Anwendung vermittelt objekt-, nutzer- und methodengebundene Einmallinks (60 Sekunden) statt wiederverwendbarer direkter S3-URLs. Downloads werden protokolliert und als Anhang mit `nosniff`/Sandbox ausgegeben. Kein IPFS, keine personenbezogenen Originale, keine externe Dokumentenübersetzung.

Die lokalen Verschlüsselungsschlüssel liegen mit Modus 0600 in `.runtime/`; Verlust macht gespeicherte Originale unlesbar. Compose nutzt öffentlich dokumentierte **Testzugangsdaten** an Loopback. Sessions und Links gehen bei Serverneustart verloren; Anträge und verschlüsselte Dokumente bleiben erhalten. Dies ist kein produktionsgeeignetes Authentifizierungs-, Schlüssel- oder Aufbewahrungssystem.

Der Indexer rekonstruiert Ereignisse durch einen bestätigten Stand mit zwei Blöcken Abstand, ersetzt verwaiste Logs bei Reorgs und gleicht Antragszustände ab. Datenbank und Chain können nicht gemeinsam atomar committen; Abstimmung/Nonces, kanonische Wiedererkennung und erneute Zustellung begrenzen Doppelverarbeitung. Auszahlungen selbst sind atomar im Contract. Der Worker zeigt Ausfälle an und erzeugt lokale Fristerinnerungen; er versendet keine Nachrichten.

Vor realem Betrieb fehlen fachliche Modellfreigabe, Rechteprüfung, Betreiber-/Rechtsraumwahl, echte NGO-/Prüfermandate, unabhängige Interessenkonfliktprüfung, Schlüsselverwaltung, Aufbewahrungs-/Löschkonzept, Datenschutz-Folgenabschätzung und regulatorische Prüfung. Der lokale Code stellt keine Rechtskonformität fest. Der Plan verweist hierfür unter anderem auf [EDPB-Leitlinien](https://www.edpb.europa.eu/system/files/2026-07/edpb_guidelines_202502_blockchain_v2_en.pdf) und [MiCA](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32023R1114).

## Sprache und Darstellung

39 vollständige UI-Kataloge mit 69 Schlüsseln. DE/EN sind gepflegte Ausgangstexte; die übrigen 37 Übersetzungen sind sichtbar **ungeprüfte Entwürfe**. Keine fachliche Übersetzungsfreigabe behauptet. Technische Quellenmanifeste, fiktive Belegtexte und Begründungen werden ausdrücklich als englischer Originalquellentext angezeigt, nicht heimlich übersetzt.

Sprache, eines von 51 Ländern, Zeitzone, Anzeigewährung und System/Hell/Dunkel sind unabhängig und lokal gespeichert. `Intl` formatiert Zahlen, Datum und reale historische Modellbeträge; Zeitangaben nennen die Zeitzone. Arabisch setzt RTL. Ohne datierten echten Referenzkurs bleibt eine andere Modellwährung unbekannt; der Code unterstützt datierte Raten, führt aber keinen Live-FX-Abruf durch. **dUSD wird nie in Fiat umgerechnet.**

Länderliste: EU-27, die ersten zehn und letzten zwanzig Länder des WorldRiskIndex 2026, sechs EU-Überschneidungen, zusammen 51. Quelle: [WorldRiskReport](https://weltrisikobericht.de/worldriskreport/), vollständige Tabelle Druckseiten 62–63, CC BY 4.0; Andorra/San Marino teilen Rang 191. Nationales strukturelles Naturgefahrenrisiko ist kein aktueller Krisen- oder Gesundheits-/Konfliktstatus.

## Prüfen

```sh
npm test
npm run build
npm run forge -- test
npm run v3:verify
npm run v3:integration
npm run v3:test:ui
```

Integration und UI benötigen den laufenden Stack und ein unbenutztes finales V3-Deployment. Integration verwendet ein eigenes DB-Schema und Chain-Snapshots; UI speichert den Anwendungszustand und stellt ihn samt Chain nach jedem Test wieder her. Diese Prüfungen nicht gleichzeitig mit manuellen Transaktionen ausführen. Chrome bzw. ein installiertes Playwright-Chromium muss vorhanden sein.

Details zu ausgeführten Prüfungen und verbleibenden Grenzen: [Abnahme](VERIFICATION.md). Die Legacy-Transaktions-Browsertests benötigen weiterhin ihre eigenen frischen historischen V1/V2-Deployments; der V3-Start stellt diese bewusst nicht neu bereit.
