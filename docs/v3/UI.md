# V3: getrennte Oberflächen und externe Freigaben

Implementierung auf `disasterdao-shared-fund-ui-improvements`. Das bestehende lokale Deployment bleibt erhalten; die Contracts wurden nicht geändert. Alle Konten, NGOs, Dokumente und Modellwerte bleiben synthetisch.

## Einstieg und Daten

- `/?v3=1#/home` beziehungsweise `/`: Organisationen entdecken, Testspende und Einstellungen.
- `/?v3=1#/organizations/local-alliance`: Bündnis, drei Mitglieds-NGOs, Fonds und Unterstützungsverlauf des gemeinsamen Testkontos.
- `/?v3=1#/ngo`: simulierte NGO-Sitzung, Vorschau/Antrag, Reservierungen, Nachweise, externe Signaturimporte und Fondsaktivität.
- `/?v2=1`: bestehende V2-Demo; V1 bleibt unter `/?legacy=1`.

Alte Hashlinks `#public`, `#ngo` und `#alliance-local-alliance` werden weiterhin verstanden. `#review` erklärt den externen Ablauf. Die NGO-Anmeldung im Zahnrad erlaubt nur NGO-Rollen. Die festen Prüferidentitäten existieren weiterhin für externe lokale Werkzeuge; sie können keine Browsersitzung eröffnen.

Es existiert genau ein Bündnis. Die Listen erfinden keine weiteren Organisationen. Ein noch nicht unterstütztes Bündnis kann sowohl in der allgemeinen Entdeckung als auch im unteren Bereich erscheinen. Bei fehlendem/veraltetem Index bleibt sein Unterstützungsstatus unbekannt.

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
