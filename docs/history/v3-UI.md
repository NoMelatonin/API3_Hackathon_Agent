> Historie bis Commit `2436dee`. Kein aktueller Start-/Jury-Ablauf. Frühere Prüfungen sind keine neue Integrationsabnahme. Alte relative Links und Befehle können überholt sein. Aktuell: [DisasterDAO](../../README.md).

> Aktualisierung 31.10.2026: V3 startet zwei isolierte Demo-Bündnisse und führt durch fünf getrennte NGO-Schritte. Aktuelle Regeln und Grenzen: [LANDKARTE.md](LANDKARTE.md#datenbasierter-abruf-neu). Die nachstehenden externen Prüfabläufe bleiben als Alternative erhalten.

# V3: getrennte Oberflächen und externe Freigaben

Für den verständlichen Gesamtüberblick: [V3-Landkarte](LANDKARTE.md).

Implementierung auf `disasterdao-shared-fund-ui-improvements`. Bestehende lokale Deployments bleiben erhalten; der getrennte Ablauf benötigt neue Contracts und verwendet ein eigenes Deployment samt Datenbank-Namespace. Alle Konten, NGOs, Dokumente und Modellwerte bleiben synthetisch.


Lokaler Start: `npm run v3:start` prüft und installiert Abhängigkeiten bei Bedarf außerhalb des synchronisierten Desktop-Ordners. Für eine manuelle Installation `npm run install:local` verwenden. [Cloud-Blockade und Wiederherstellung](LOCAL.md#abhängigkeiten-ohne-cloud-blockade).

## Separater NGO-Einstieg und Demo-Theme (31.10.2026)

Öffentlichkeit: `/?v3=1#/home`. NGO-Zugang: `/?v3=1&ngo=1`; nach simulierter Anmeldung öffnet sich `/?v3=1&ngo=1#/ngo`. Alte Links `#ngo` und `#/ngo` wechseln automatisch zum eigenen Einstieg. Die Anmeldung gehört nicht mehr zum öffentlichen Einstellungsdialog. Einstellungen für Sprache und Theme bleiben gemeinsam gespeichert.

Eine gültige NGO-Sitzung wird wiederverwendet. „Abmelden“ öffnet die NGO-Anmeldung; „Abmelden und zur Öffentlichkeit“ beendet die Sitzung und öffnet die öffentliche Startseite. Öffentliche Links einschließlich der Kopf-Navigation beenden keine Sitzung; Testspenden bleiben dann gesperrt. Der öffentliche Einstellungsdialog bietet eine Abmeldeaktion. Ein Sessionfehler zeigt Wiederholen; abgelaufene Sitzungen entfernen private Ansichten. Bei Tab-Fokus wird die Session erneut geprüft. Ein abgelaufenes Cookie kann durch Abmelden gelöscht werden.

Die Trennung ist eine UI-Trennung innerhalb derselben App und API, keine neue Identitätsprüfung. Acht-Stunden-Cookie, feste NGO-Rollen, gemeinsames Testspenderkonto und externe Signaturfreigaben bleiben erhalten. Umsetzung: `web/v3/app.tsx`, `web/v3/ngo-entry.tsx`, `server/app.ts`.

Die V2-Demo (auch `?local=1`) verwendet `web/demo-theme.css` und tokenisierte Komponentenfarben in `web/style.css`. Dark Mode: `#080808`/`#141414`/`#202020`, helle Hauptaktionen und violette Diagramme/Fokuszustände. Light Mode behält limettengrüne Akzente. V3 verwendet weiterhin eigene Tokens; V1 behält `web/theme-legacy.css` und `web/theme.css`. Der Speicherschlüssel `v3-theme` bleibt gemeinsam.

## Navigation und Testeinzahlungen (31.10.2026)

Alle drei Einstiege zeigen dieselbe Kopf-Navigation **Demo · NGO · User** mit aktivem Zustand. Demo öffnet `/?v2=1`, NGO `/?v3=1&ngo=1`, User `/?v3=1#/home`; die lokale V2-Variante zählt ebenfalls als Demo. Organisationsdetails und öffentliche Fehlerseiten zählen als User. Die Links erhalten NGO-Sitzungen; Abmelden bleibt eine eigene Aktion. Umsetzung: `web/view-navigation.tsx`, `web/portal.tsx`, `web/v3/app.tsx`.

Unter der Einleitung der User-Startseite zeigt `web/v3/support-allocation.tsx` ein Ringdiagramm mit zugänglicher Liste, Bündnisnamen, dUSD-Beträgen, Prozentanteilen und Gesamtbetrag. Grundlage ist ausschließlich `Organization.support.total` aus der vorhandenen Organisationsabfrage: bestätigte kumulierte Einzahlungen des gemeinsamen lokalen Testkontos 0 inklusive Initialfinanzierung. Summierung erfolgt mit BigInt; Prozentwerte sind auf eine Nachkommastelle gerundet, mögliche Summenabweichungen werden genannt. Keine neuen API-Endpunkte, persönlichen Guthaben, Fiat-Umrechnung oder erfundenen Organisationen. Die beiden tatsächlichen Bündnisse werden nach bestätigten Testeinzahlungen gewichtet; ihre Mitglieds-NGOs erhalten keine erfundene Aufteilung.

Laden, keine Organisationen, Nullsumme und Ladefehler haben eigene Zustände. Sobald ein Organisationssnapshot veraltet oder unverfügbar ist, wird keine Gesamtverteilung angezeigt. Ein fehlgeschlagener Abruf unterdrückt auch zuvor geladene Diagrammwerte. „Aktualisieren“ verwendet den bestehenden Refresh; eine geminte Spende verändert die Werte erst nach Aufnahme in den bestätigten Index. Der Bündnisname öffnet die vorhandene Detailroute. Keine Anmeldung oder Freigabe fürs Ansehen erforderlich.

Desktop: Ring und Liste nebeneinander; mobil untereinander. Namen umbrechen, Navigation bleibt per Tastatur erreichbar und hat mindestens 44-px-Touchflächen. Die statische SVG-Grafik ist für Screenreader verborgen; sämtliche Werte stehen in der semantischen Liste. Keine Hover-Pflicht, keine Animation; Hell/Dunkel und RTL nutzen die bestehenden Einstellungen. Neue Texte sind DE/EN gepflegt, andere Sprachen verwenden sichtbar englisches Fallback.

## Einstieg und Daten

- `/?v3=1#/home` beziehungsweise `/`: User: Organisationen entdecken, Testeinzahlungsverteilung, Testspende und Einstellungen.
- `/?v3=1#/organizations/local-alliance`: Bündnis, drei Mitglieds-NGOs, Fonds und Unterstützungsverlauf des gemeinsamen Testkontos.
- `/?v3=1&ngo=1`: eigener NGO-Anmeldebildschirm; `/?v3=1&ngo=1#/ngo`: simulierte NGO-Sitzung, Vorschau/Antrag, Reservierungen, Nachweise, externe Signaturimporte und Fondsaktivität.
- `/?v2=1`: bestehende V2-Demo; V1 bleibt unter `/?legacy=1`.

Alte Hashlinks `#public`, `#ngo` und `#alliance-local-alliance` werden weiterhin verstanden. `#review` erklärt den externen Ablauf. Die Anmeldung im eigenen NGO-Einstieg erlaubt nur NGO-Rollen. Die festen Prüferidentitäten existieren weiterhin für externe lokale Werkzeuge; sie können keine Browsersitzung eröffnen.

Es existieren zwei registrierte Demo-Bündnisse. Die Listen erfinden keine weiteren Organisationen. Ein noch nicht unterstütztes Bündnis kann sowohl in der allgemeinen Entdeckung als auch im unteren Bereich erscheinen. Bei fehlendem/veraltetem Index bleibt sein Unterstützungsstatus unbekannt.

Spenden verwenden unverändert das gemeinsame lokale Konto 0, maximal 1.000 dUSD pro Vorgang. Dessen vollständiger bestätigter Verlauf enthält auch die Initialfinanzierung. Er ist kein persönliches Portfolio. Auszahlungen aus dem gemeinsamen Fonds können nicht einzelnen Spenden zugeordnet werden. Eine optional verbundene Browserwallet zeigt nur ihre Adresse und ändert das Spenderkonto nicht. Eine NGO-Sitzung muss vor einer Testspende beendet werden.

Neue APIs unter `/api/v3`:

| Methode und Pfad | Inhalt |
|---|---|
| GET `/organizations` | Liste der tatsächlichen Bündnisse |
| GET `/organizations/:id` | Mitglieder, Gebiete, Bildmetadaten, Fonds, Testkonto-Summe und veröffentlichte Berichte |
| GET `/organizations/:id/activity?offset=0` | Normalisierte Ereignisse, 25 je Seite, nächster Offset |
| GET `/organizations/:id/test-support?offset=0` | Bestätigte Testkontoeinzahlungen; Summe über den vollständigen Index |
| POST `/applications/preview` | NGO-bezogene Vorschau, keine Speicherung/Reservierung |
| POST `/approvals/export` | NGO-bezogener Prüfauftrag mit Zweck und Ziel-ID |
| POST `/approvals/import` | Prüfung und Übermittlung extern signierter Freigaben |

Beträge sind Strings in sechsstelligen Token-Untereinheiten. Die Antragsvorschau verwendet dieselbe Teilnehmerkonstruktion und Allokation wie die Förderrunde. Eine fehlende Modellgrundlage ist ausdrücklich ein manueller Vorschlag. Die Vorschau bindet keine Mittel; der spätere Rundensnapshot kann abweichen.

Der Indexer speichert Logs und seinen Checkpoint atomar. Neue öffentliche Projektionen lesen beides konsistent und lesen Fondskennzahlen am selben bestätigten Block. Reorgs machen einen verwaisten Checkpoint zunächst unverfügbar; der nächste Indexlauf rekonstruiert Logs und Summen. Ein veralteter Snapshot bleibt als solcher beschriftet.

**Bestätigungen:** Anvil erzeugt standardmäßig bei Transaktionen Blöcke. Zwei zusätzliche Blöcke sind für den bestätigten Index nötig. Ohne weitere Transaktionen bleibt eine geminte Transaktion entsprechend ausstehend; der Worker erzeugt keine Blöcke. Für die lokale Vorführung kann `npm run v3:clock -- --seconds 1` zweimal ausgeführt werden. Nach dem nächsten Worker-Lauf (30 Sekunden) aktualisieren. Das ist ausschließlich die lokale Simulationsuhr.

## Externe Freigaben

Die Werkzeuge verwenden die bestehenden festen lokalen Prüfschlüssel. Sie belegen keine unabhängigen Menschen oder Organisationen. Keine dieser Schlüssel werden ins Frontend exportiert. Die HTTP-Anwendung erzeugt beim Signaturimport keine Ersatzsignaturen.

Ein JSON-Paket enthält `schema: 1`, `purpose`, `target`, `chainId`, `fund`, `payload` und `signatures`, optional den lesbaren `context`. Der Kontext wird gegen den gespeicherten Auftrag geprüft; die Signatur bindet den rekonstruierten Contract-Digest. Erforderlich sind mindestens zwei unterschiedliche registrierte Signer der passenden Gruppe. Befangenheit, falsche Domain, geänderte Daten, falsche NGO und ungültige Fristen werden abgewiesen. Eine Wiederholung einer bereits erfolgreichen kanonischen Transaktion liefert deren Hash, ohne den Antrag auf einen früheren Zustand zurückzusetzen.

Dateien in `.runtime/` bleiben privat und ignoriert. `--out` überschreibt keine vorhandenen Dateien. Die Beispiele benötigen den laufenden lokalen Stack. Platzhalter-IDs aus dem NGO-Bereich einsetzen.

### Antrag und Runde

Prüfauftrag im NGO-Bereich exportieren oder lokal erstellen:

```sh
npm run v3:approvals -- export --purpose APPLICATION --target APP_ID --out .runtime/application.json
npm run v3:approvals -- sign --role data-1 --in .runtime/application.json --out .runtime/application-one.json
npm run v3:approvals -- sign --role data-2 --in .runtime/application-one.json --out .runtime/application-two.json
```

Die NGO importiert `application-two.json` im Arbeitsbereich. Der Server verifiziert beide Signaturen und reicht den bestehenden `open`-Aufruf ein.

Die fondsweite Runde bereitet der lokale Betreiber vor:

```sh
npm run v3:approvals -- prepare-round --out .runtime/round.json
npm run v3:approvals -- sign --role data-1 --in .runtime/round.json --out .runtime/round-one.json
npm run v3:approvals -- sign --role data-2 --in .runtime/round-one.json --out .runtime/round-two.json
```

Die NGO darf eine Runde mit eigenem Grant importieren; signiert ist der gesamte Snapshot. Der Contract prüft unter anderem Nonce, Ablauf, Fondsbestand und Reservierungen. Bei veraltetem Snapshot eine neue Runde vorbereiten und erneut signieren. Anschließend reservierte Auszahlung im NGO-Bereich abrufen.

### Nachweis, Eingangsattest und Prüfbericht

1. Beim Auszahlungsdatensatz einen **Ausgabennachweis** hochladen. Maximal 2 MiB; TXT beginnt mit `DISASTERDAO SYNTHETIC`, PDF/PNG/JPEG werden auf Dateisignatur geprüft. Dateien bleiben verschlüsselt und privat. Upload bedeutet keine Annahme.
2. Eine private JSON-Eingabedatei für das externe Eingangsattest erstellen:

```json
{"kind":"receipt","evidenceId":1,"reason":"Synthetic receipt checked independently; no conflict declared.","decision":0,"days":0}
```

```sh
npm run v3:approvals -- prepare-review --input .runtime/receipt-input.json --out .runtime/receipt.json
npm run v3:approvals -- sign --role evidence-1 --in .runtime/receipt.json --out .runtime/receipt-one.json
npm run v3:approvals -- sign --role evidence-2 --in .runtime/receipt-one.json --out .runtime/receipt-two.json
```

Die NGO importiert die letzte Datei. Das Eingangsattest muss einen rechtzeitigen Upload bestätigen und **innerhalb einer Stunde** verankert werden. Ein abgelaufener Auftrag ist kein erfolgreicher Eingang; keine Frist wird automatisch zurückgesetzt. Das Manifest enthält ausschließlich die zum Auftrag gehörenden Ausgabennachweise, keine späteren externen Prüfberichte.

3. Den außerhalb der App erhaltenen synthetischen Prüfbericht als **externes Prüfdokument** beim selben Nachweis hochladen. Die Dokument-ID wird angezeigt. Das Dokument über einen privaten Download außerhalb der App zur Prüfung weitergeben.
4. Den separaten Prüfauftrag erstellen; `documentId` bindet den SHA256-Digest des Berichts an die signierte Begründung:

```json
{"kind":"review","evidenceId":1,"documentId":"DOCUMENT_ID","reason":"Synthetic invoice reconciliation and delivery checks completed.","decision":2,"days":0}
```

Mit `prepare-review` und zwei `evidence`-Signaturen wie oben weiterarbeiten. Entscheidung `2` akzeptiert Verwendung, `3` fordert nach, `4` lehnt ab. Dokumentupload, vollständige Signaturen, geminte Transaktion, Bestätigung und Entscheidung bleiben getrennte Zustände.

### Weitere Entscheidungen

- `extend`: Eingabe wie beim Prüfauftrag, `days` von 1 bis 30; einmalig und nur vor der bestehenden Frist. Externes Dokument erforderlich.
- `followup`: zusätzlich `applicationId`; Nachweis und externes Dokument müssen derselben NGO gehören. Zwei Nachweisprüfer signieren. Die NGO-Abstimmung der anderen berechtigten Mitglieder bleibt als alternativer bestehender Weg erhalten.
- `resolve`: separate Gruppe `appeal-1` bis `appeal-3`. Den Einspruch selbst startet die NGO im Arbeitsbereich. Dokument, Manifest, Status und Frist werden gebunden.
- `PUBLICATION`: nach akzeptiertem/geklärtem Nachweis einen NGO-Bericht einreichen, dann mit `export --purpose PUBLICATION --target REPORT_ID` exportieren, durch zwei Nachweisprüfer signieren und importieren. Dies ist eine Off-Chain-Veröffentlichungsfreigabe, keine neue Chain-Wirkungsbestätigung.
- `COVERAGE`: `prepare-coverage --input DATEI --out DATEI` mit `areaId` und dokumentierter `reason`; zwei Datenprüfer signieren. Import nur über das Betreiberwerkzeug, eine Stunde gültig, ausdrücklich simulierte Off-Chain-Lageentscheidung.
- `recuse --role ROLE --target ID --reason TEXT`: dokumentierte Befangenheit für einen noch offenen Auftrag erklären. Geschlossene Entscheidungen werden nicht rückwirkend verändert.

Für Betreiberimporte: `npm run v3:approvals -- import --in SIGNED_FILE`. Nutzertexte und Originaldokumente werden nicht automatisch übersetzt.

## Gestaltung und Barrierefreiheit

V3 übernimmt die V2-Demo-Hierarchie: Inter/Systemschrift, helle graue Seitenfläche `#f3f4f5`, weiße Karten, 16-px-Radien und großzügige Zahlen. Die eigenen V3-Tokens verändern die Demo nicht. Dark Mode verwendet `#080808`, `#141414`, `#202020`, helle Hauptaktionen und violetten Fokus; kein grüner Flächenstich.

Untersuchte Referenzen aus `design_inspiration/`: Die WEBP-Referenz liefert getrennte Einstiege und mobile Karten. `fevg5cslqhph1.png` liefert dunkle Bestätigungsschritte und Zahlenhierarchie, `images.jpg` kompakte Aktivitätslisten und `images.png` anthrazitfarbene Flächen mit weißen/violetten Aktionen. Finanzrenditen und unbelegte Diagramme werden nicht übernommen. Die drei lokalen SVG-Einsatzillustrationen wurden für den synthetischen Prototyp erstellt; sie zeigen keine dokumentierten realen Einsätze.

Bildwechsel ungefähr alle zehn Sekunden, pausiert bei Fokus, Hover und verborgenem Tab. Ein Pauseknopf und Einzelbildnavigation sind vorhanden; reduzierte Bewegung deaktiviert den Autowechsel. Scroller sind fokussierbar, haben Tastatur-/Touchbedienung und separate Richtungsaktionen. Dialoge begrenzen den Fokus, schließen mit Escape und geben den Fokus zurück.

Bestehende 39 Sprachkataloge bleiben erhalten. Neue DE/EN-Texte liegen in `web/v3/copy.ts`; andere Sprachen verwenden sichtbar gekennzeichnete englische Ausgangstexte. Die 37 bisherigen Übersetzungsentwürfe bleiben ungeprüft. Sprache, Land, Zeitzone, Währung, RTL und Theme bleiben unabhängig gespeichert. dUSD wird nicht in Fiat umgerechnet.

Die CSS-Einstiege werden im Produktionsbuild getrennt importiert. Die vorhandenen V1-Schriften DM Sans und Manrope werden mit ihren SIL-OFL-Lizenzen lokal unter `public/fonts/` ausgeliefert; der Demoaufbau bleibt erhalten, ohne blockierenden Google-Fonts-Abruf.

Vorhandene unvollständige interne Prüfdrafts bleiben historisch gespeichert. Eine externe Vorbereitung ersetzt sie durch einen neuen Auftrag ohne übernommene Stimmen. Abgelaufene Eingangsaufträge oder Aufträge mit verändertem Nachweiszustand können ebenfalls ausdrücklich neu vorbereitet werden; gültige offene externe Aufträge werden nicht stillschweigend ersetzt.

## Zwei Bündnisse und Oracle-Abruf — 31.10.2026

`npm run v3:start` baut und startet beide lokalen Bündnisse. Neue Standardmanifeste: `.runtime/v3.3-ngo-flow.json` und die Variante `-community.json`. Alte Manifeste/Chain-Zustände/Dokumente bleiben erhalten; keine Übertragung alter Mittel oder Nachweise. Ein neuer Deploymentname erhält einen neuen getrennten Datenbestand. Die App nutzt für PostgreSQL ein aus dem Manifestnamen abgeleitetes Schema.

In der NGO-Anmeldung stehen sechs simulierte NGOs zur Auswahl. **Hilfe beantragen** führt durch Ereignisprüfung, Antrag, Freigabe/Reservierung, separaten Geldabruf und Verwendungsnachweis. Antrag und Reservierung überweisen nichts. Die Contract-Regel erlaubt Erstförderung sowie Folgeförderung bei aktueller Verschlechterung oder akzeptierten/geklärten Nachweisen ohne zusätzliche NGO-Zustimmung. Andernfalls stimmen die beiden anderen berechtigten NGOs zu; eine Stimme genügt nicht. Nachweissperren, sechs Stunden Rundenabstand und 24 Stunden Reservierungsfrist bleiben bestehen. Einzelheiten: [Landkarte](LANDKARTE.md#datenbasierter-abruf-neu).

Standard ist die klar markierte lokale Demo mit Signer Konto 30. Für eine andere synthetische Lage kann der Betreiber den Backend-Prozess mit z. B. `V3_DEMO_SEVERITY='{"demo-quake":7.3,"demo-flood":3}'` starten. Ein höherer Wert ist nur eine Demo-Regel, kein echter Krisennachweis.

`V3_ORACLE_MODE=live` muss beim Deployment und Serverstart übereinstimmen und benötigt einen eigenen neuen `V3_DEPLOYMENT`-Namen. USGS und EONET haben Adapter mit festem Signer und Request-Hash; ihre aktuell konfigurierten historischen Ereignisse sind älter als das zulässige Beobachtungsfenster und lösen deshalb keine aktuelle Auszahlung aus. Flut/akute Gesundheit sind im Live-Modus deaktiviert. Es wurde keine neue erfolgreiche echte Airnode-Zahlung nachgewiesen. Fehler oder unpassende Daten erzeugen keine Ersatzsignaturen; stattdessen den externen Prüfpfad verwenden.

Externe Betreiberbefehle für das zweite Bündnis mit `V3_ORGANIZATION=community-alliance` ausführen; Rollen heißen dort z. B. `community-data-1`. Standard ist `local-alliance`. Freigaben bleiben an Fonds und Chain gebunden. Testspenden haben eine Bündnisauswahl; das Diagramm zeigt bestätigte Einzahlungen desselben gemeinsamen Testspenderkontos.

Beim lokalen Deployment erzeugt das Startwerkzeug zwei zusätzliche Anvil-Blöcke, damit beide Initialeinzahlungen vor dem ersten Indexlauf bestätigt sind. Der Worker selbst erzeugt weiterhin keine Blöcke.

## Geführte Fünf-Schritte-Demo

1. `npm run v3:demo` starten; `/?v3=1&ngo=1` öffnen und eine simulierte NGO anmelden. Beide Bündnisse sind unabhängig finanziert (18.000 / 9.000 dUSD).
2. **Hilfe beantragen → Ereignisdaten prüfen**. Synthetische Quelle und erfüllte Regel kontrollieren; weiter zum Antrag.
3. Zweck (mindestens 20 Zeichen), Betrag, umsetzbare Kapazität und vorhandene Finanzierung angeben. **Antrag prüfen → Antrag verbindlich einreichen**. Geldbestand der NGO bleibt unverändert.
4. Am Fall **Freigabe prüfen → Mittel verbindlich reservieren**. Der Betrag ist jetzt gebunden, noch nicht ausgezahlt. **Reservierten Betrag abrufen** zahlt separat an die registrierte NGO. Die Reservierung gilt 24 Stunden. Geminte und bestätigte Vorgänge sind unterschiedlich beschriftet.
5. **Nachweis öffnen**, synthetischen Ausgabennachweis hochladen (z. B. TXT mit `DISASTERDAO SYNTHETIC` als erster Zeile), **Eingangsattest zur Prüfung exportieren**. Zwei externe Nachweisprüfer signieren mit dem bestehenden CLI; direkt am Nachweis **Signaturdatei importieren** verwenden.
6. Externen Prüfbericht als Dokumentart „Externes Prüfdokument“ hochladen. **Übergabe für Verwendungsprüfung exportieren** enthält Nachweis-/Dokument-ID und Prüferhinweise. Der Prüfer erstellt mit `prepare-review` einen eigenen Auftrag (`kind: review`, `decision: 2/3/4`, `days: 0`, eigene Begründung/Befangenheitsprüfung), signiert mit zwei verschiedenen Nachweisprüfern und gibt das Paket zurück. NGO importiert direkt am Nachweis. Nur Entscheidung 2 akzeptiert; 3 fordert nach, 4 lehnt ab.
7. Nach akzeptierter/geklärter Gesamthistorie ist unveränderte Folgeförderung ohne zusätzliche NGO-Stimmen möglich. Sonst müssen zwei andere NGOs zustimmen oder eine aktuelle Verschlechterung vorliegen. Der Rundenabstand von sechs Stunden bleibt bestehen; der Demo-Taktgeber überspringt ihn nicht. Für einen ausdrücklich simulierten Zeitsprung: `npm run v3:clock -- --seconds 21601`.

Die NGO bereitet Übergaben vor, keine eigene Prüfentscheidung. Signaturen stammen weiterhin aus externen Werkzeugen. Im zweiten Bündnis heißen Rollen z. B. `community-evidence-1` und `community-evidence-2`; CLI-Befehle dort mit `V3_ORGANIZATION=community-alliance` ausführen. Ohne Demo-Taktgeber müssen zwei lokale Folgeblöcke und ein Indexlauf ausdrücklich erfolgen.

### Neue Schnittstellen

- `POST /api/v3/automatic/preview`: Quelle, Förderregel, aktueller möglicher Anteil, Restspielraum, freie Mittel, Unsicherheitsreserve und Freigabestatus; keine Speicherung oder Geldbindung.
- `POST /api/v3/automatic/submit`: bisherige Betragsfelder plus `explanation` und stabile `requestId`; eröffnet ausschließlich den Antrag. Hash des Zwecks und Anfrage-ID werden an den Contract gebunden. Gleiche ID mit anderen Daten wird abgelehnt.
- `POST /api/v3/automatic/reserve`: `{ "application": "APP_ID" }`; prüft frische Quelle und aktuelle Regeln und reserviert. Auszahlung bleibt beim bestehenden Reservierungsendpunkt mit `action: claim`.
- `GET /api/v3/workflow`: organisations-/NGO-bezogene Fälle mit Schritt, Zuständigkeit, nächster Aktion, Sperrgründen, Fristen, Beträgen und Bestätigungsstand.
- `POST /api/v3/evidence/:id/handoff`: bereitet ausschließlich ein extern zu signierendes Eingangsattest für eigene Belege vor.
- `POST /api/v3/evidence/:id/approvals/import`: importiert ausschließlich zum Nachweis gehörende externe Freigaben.
- Der alte Sofortabruf `/automatic/claim` liefert HTTP 410 mit Wechselhinweis. Contract-ABI: `automaticSubmit(request,purposeHash,requestId)`, `automaticReserve(applicationId,request)` und anschließend `claim(reservationId)`.
