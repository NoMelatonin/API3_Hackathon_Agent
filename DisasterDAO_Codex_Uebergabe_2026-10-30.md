# DisasterDAO Projektübergabe für Codex

Stand: 30. Oktober 2026, Europe/Berlin. Sprache: Deutsch.

Dieses Dokument bündelt den bisherigen Projektkontext, die ursprüngliche Vision, die aktuelle Präferenz des Nutzers und die Anforderungen für eine mögliche Umsetzung. Es soll ohne den bisherigen Chat verständlich sein. Angaben zum MVP und technische Entwürfe sind ausdrücklich als Empfehlungen gekennzeichnet und noch keine vollständig beschlossene Spezifikation.

## 1 Aktueller Stand in einer Minute

**DisasterDAO ist wieder der bevorzugte Projektansatz.** Der Nutzer nimmt solo am TUM Blockchain & AI Hackathon teil und möchte im API3-Track einen NGO-Katastrophenfonds bauen. Mehrere Organisationen sollen Geld und Freigaberegeln gemeinsam verwalten können. Signierte externe Ereignisdaten ermöglichen eine begrenzte erste Auszahlung; weitere Mittel hängen von zusätzlichen Entscheidungen oder Nachweisen ab.

Die Idee wurde zunächst kritisch zurückgestellt, weil automatische Katastrophenfinanzierung und gemeinsame NGO-Fonds bereits existieren. Nach der Untersuchung anderer Ideen hat der Nutzer erklärt, dass er den NGO-Fonds weiterhin interessanter findet. Die letzte Empfehlung war deshalb die Rückkehr zu DisasterDAO mit deutlich kleinerem Umfang.

**Aktuelle Nutzerpräferenz:** Eine umsetzbare, interessante Idee mit plausiblem Mehrwert genügt. Es muss keine perfekte oder völlig neue Geschäftsidee sein. Der Nutzer möchte jetzt etwas haben, an dem er arbeiten kann. Seine frühere Forderung nach einer noch unbesetzten Marktlücke darf die Arbeit deshalb nicht erneut in eine endlose Ideensuche führen.

**Wichtigste offene Produktfrage:** Warum würden reale NGOs einen gemeinsam kontrollierten Smart Contract gegenüber einem herkömmlichen Fondsbetreiber bevorzugen? Dafür gibt es eine plausible Hypothese, aber bisher keine Interviews oder belastbare Marktvalidierung.

**Wichtigste technische Voraussetzung:** Eine echte AirnodeHub-Antwort muss im Contract verifiziert werden; ein Wert aus genau dieser Antwort muss die Auszahlung steuern. Für DisasterDAO wurde bisher keine konkrete Ereignis-API vollständig getestet.

**Deadline:** Die offizielle Hackathon-Seite zeigte im aktuellen Chat Samstag, 31. Oktober 2026, 15:00 Uhr. Testnet ist für den API3-Track ausreichend. Vor der Abgabe das Veranstalterportal auf Änderungen prüfen.

## 2 Was feststeht und was noch offen ist

| Thema | Stand |
| --- | --- |
| Projektfokus | NGO-Katastrophenfonds wieder bevorzugt; FlightBond ist aktuell zurückgestellt. |
| Name | DisasterDAO ist ein Arbeitsname. |
| Arbeitskontext | Solo-Hackathon mit wenig Zeit und parallelen Uni-Verpflichtungen. |
| Grundidee | Gemeinsamer Pool, signierter Ereignistrigger, nachvollziehbare und begrenzte Auszahlungen. |
| Ursprüngliche Erweiterungen | Folgetranchen, Berichte und Prüfungen, internationale Dokumentationsunterschiede, Notfallausnahme. |
| Menschliche Absicherung | Zentrale Sorge des Nutzers: Fehlende Daten oder Belege dürfen notwendige Hilfe nicht ohne Eskalationsweg blockieren. |
| Hackathon-Umfang | Kleiner MVP empfohlen; genaue Funktionen und Parameter noch nicht endgültig festgelegt. |
| Umsetzung | Im Arbeitsverzeichnis wurden noch keine Implementierungsdateien gefunden. |
| Reale Partner | Keine bestätigten NGOs, Geber, Prüfer oder Pilotkunden. |
| Noch auszuwählen | Blockchain, Test-Token, Ereignisquelle, Region, Schwelle, Empfänger, Budgets, Rollen und Quorum. |

Die zuletzt besprochenen drei NGOs sind eine Demo-Empfehlung. Das ältere Konzept nennt zwei. Keine dieser Zahlen ist eine harte Nutzeranforderung. Dasselbe gilt für Beispielbeträge, ein mögliches Quorum von zwei aus drei Personen und konkrete Katastrophenschwellen.

## 3 Ursprüngliche Projektidee

Mehrere internationale NGOs, beispielsweise aus Deutschland und den USA, zahlen in einen gemeinsamen Katastrophenfonds ein oder arbeiten mit einem gemeinsam finanzierten Pool. Vorab definierte Ereignisdaten können eine schnelle erste Auszahlung an berechtigte NGOs ermöglichen. Die Regeln und die tatsächlich ausgeführten Zahlungen sind für die Beteiligten nachvollziehbar.

Weitere Auszahlungen sollen stärker geprüft werden. Im ursprünglichen Konzept wurden insbesondere diese Auslöser diskutiert:

- Die Lage hat sich deutlich verschärft.
- Die Verwendung bereits ausgezahlter Mittel wurde dokumentiert beziehungsweise geprüft.
- Eine weitere Finanzierung wird durch verantwortliche Personen genehmigt.

Unterschiedliche Nachweis- und Dokumentationsvorgaben der beteiligten Organisationen und Länder sollen berücksichtigt werden. Eine technische Plattform vereinheitlicht diese Vorgaben jedoch nicht automatisch.

Die ursprüngliche Formulierung „Verschlechterung ODER alte Mittel geprüft“ ist **kein fertig beschlossenes Freigabeverfahren**. Ein unbeschränkter Auszahlungsanspruch bei jedem dieser Ereignisse wäre problematisch. Gleichzeitig kann eine anhaltend schwere Lage Hilfe erfordern, ohne dass sie sich weiter verschlechtert. Die genaue Verbindung von Bedarf, Berichten, Budget und Genehmigung bleibt eine Produktentscheidung.

„DAO“ bedeutet hier zunächst gemeinsame Verwaltung und verbindliche Regeln. Ein handelbarer Governance-Token, anonyme Teilnahme oder öffentliche Abstimmungen wurden nicht beschlossen.

## 4 Problem und möglicher Mehrwert

Die Problemhypothese lautet: Unabhängige Organisationen möchten Mittel für Katastrophen vorab bereitstellen und die Bedingungen der Freigabe gemeinsam kontrollieren. Wiederholte Einzelfreigaben, unklare Zuständigkeiten und verstreute Dokumentation können die Koordination erschweren. Wie groß diese Probleme bei konkreten Organisationen sind, ist noch nicht untersucht.

Der denkbare Blockchain-Vorteil ist eine gemeinsame, überprüfbare Verwaltung tatsächlich hinterlegter Mittel. Die Beteiligten können sehen, welche Regeln gelten und ob Auszahlungen diese Regeln einhalten. Eine Partei sollte den Pool oder eine bereits aktivierte Regel nicht unbemerkt einseitig kontrollieren können.

Dieser Vorteil besteht nur unter passenden Contract- und Administrationsregeln. Ein einzelner Administrator mit uneingeschränktem Abzugsrecht oder beliebiger Änderungsmacht würde die Begründung gemeinsamer Kontrolle schwächen.

Eine zentrale Datenbank mit signierten Freigaben, Rollenrechten, unabhängiger Prüfung und unveränderbaren Protokollen bleibt eine ernsthafte Alternative. Internationale Teilnahme oder das Wort „Transparenz“ reichen allein als Blockchain-Begründung nicht aus.

Vier Grenzen sind besonders wichtig:

1. Eine Signatur belegt die Herkunft und Integrität einer Antwort unter den jeweiligen Vertrauensannahmen. Sie beweist nicht automatisch deren sachliche Richtigkeit.
2. Ein Naturgefahrenwert belegt keine konkrete humanitäre Bedürftigkeit oder angemessene Mittelverteilung.
3. Ein Transfer an eine NGO belegt nicht, dass Hilfsgüter gekauft, geliefert oder fair verteilt wurden.
4. Eine Transaktionsquittung ist keine automatisch gültige steuerliche Spendenbescheinigung.

## 5 Bestehende Ansätze und bisherige Kritik

Im ursprünglichen Konzept wurden folgende Vorbilder recherchiert. Die Zusammenfassungen sind aus dem vorhandenen Projekt-PDF übernommen; ihre Detailangaben wurden für diese Übergabe nicht erneut unabhängig geprüft. Es bestehen keine behaupteten Partnerschaften.

| Vorbild | Relevanz für die Idee |
| --- | --- |
| Start Network und Global Start Fund | Gemeinsame Katastrophenfinanzierung und organisierte schnelle Mittelvergabe existieren bereits. |
| Start Ready und anticipatory action | Vorab vorbereitete Finanzierung und ereignisbezogenes Handeln sind etablierte Ansätze. |
| OCHA Country-Based Pooled Funds | Gemeinsame Fonds mit Eignungsprüfung, Allokation, Berichten und Kontrolle. |
| DEC | Bündnis mit gemeinsamer Spendenmobilisierung und geregelter Mittelverteilung. |
| WFP Building Blocks | Beispiel für organisationsübergreifende Blockchain-Koordination im humanitären Bereich; kein Nachweis für DisasterDAOs konkreten Nutzen. |
| IATI | Standard für die Veröffentlichung von Hilfsdaten; kein Auszahlungssystem und kein Wahrheitsnachweis. |

DisasterDAO sollte deshalb nicht als „erster transparenter NGO-Fonds“ oder als erstmalige automatische Katastrophenhilfe beschrieben werden. Die engere zu prüfende Idee ist eine organisationsübergreifende, überprüfbare Freigabe vorab vereinbarter Budgets.

Der früher erwähnte ODI-Artikel zur Finanzierung von Mutual-Aid-Gruppen im Sudan dient als Rechercheanker für reale Finanzierungsprobleme. Er belegt nicht, dass Blockchain oder genau dieser gemeinsame Fonds die beste Lösung ist.

## 6 Empfohlener Hackathon-MVP

Die letzte Empfehlung im Chat lautete sinngemäß:

> Drei zugelassene NGOs nutzen einen gemeinsamen Notfallfonds. Ein signiertes Katastrophenereignis gibt einen vorab vereinbarten Soforthilfebetrag frei. Weitere Mittel werden gemeinsam genehmigt. Bei Datenausfall gibt es einen menschlichen Notfallpfad.

Dies ist der empfohlene Arbeitsumfang, kein bereits implementierter Ablauf.

### Unverzichtbarer Kern

- Ein Testnet, ein Test-Token und ein gemeinsamer Pool.
- Ein vorab definierter Einsatz mit ausgewählter Region und Datenquelle.
- Zugelassene Demo-NGOs mit ausdrücklich zugeteilten Budgets.
- Eine echte, nachvollziehbar beschaffte AirnodeHub-Antwort.
- Contract-Prüfung von Signer, Anfrage, Zeitbedingungen und auszahlungsrelevantem Datenwert.
- Begrenzte Soforthilfe mit Schutz vor wiederholter Auszahlung.
- Gültige Auszahlung und die vier vorgeschriebenen Manipulationsfälle.
- Eine einfache Oberfläche oder zuerst ein reproduzierbares Einreichungsskript.

### Danach nach verfügbarer Zeit

- Ein begrenzter, gemeinsam genehmigter Notfallpfad.
- Eine weitere Tranche mit Antrag, Berichtreferenz und gemeinsamer Freigabe.
- Eine verständliche Historie der Auszahlungen und ihrer Gründe.

### Spätere Ausbaustufen aus der ursprünglichen Vision

Vertraulicher Dokumentenspeicher, echte Prüferattestationen, organisationsspezifische Nachweisprofile, IATI- beziehungsweise Buchhaltungsexport, mehrere Ereignistypen, produktive lokale Auszahlungskanäle und ein internationaler Pilot.

Der Hackathon-MVP arbeitet mit Testmitteln und fiktiven Organisationen. Multichain, ein eigener Governance-Token, KI-Belegbewertung und eine vollständige internationale Förderverwaltung gehören nicht zum empfohlenen Kern.

## 7 Fachliche Abläufe

### Reguläre Soforthilfe

1. Die Beteiligten vereinbaren Einsatz, Datenquelle, Trigger, Empfänger und Budgets.
2. Testmittel werden in den Pool eingezahlt; die berechtigten NGOs werden registriert.
3. Ein Relayer beschafft die originale signierte Ereignisantwort.
4. Der Contract prüft die Attestation und die für diesen Einsatz erlaubten Daten.
5. Er prüft Empfängerberechtigung, freies Budget und die noch nicht ausgeführte Tranche.
6. Er aktualisiert den Auszahlungsstatus vor dem Transfer und zahlt den begrenzten Betrag aus.
7. Ein Ereignisprotokoll hält Betrag, Empfänger und Freigabegrund fest.

Ein Smart Contract startet nicht von selbst, wenn sich das Wetter ändert. Ein Nutzer, Keeper oder Agent muss eine Transaktion einreichen. „Automatisch“ bezeichnet die regelbasierte Entscheidung nach dieser Einreichung.

### Folgetranche

Ein Antrag benennt Einsatz, NGO, gewünschte Tranche und Betrag. Im ursprünglichen Konzept kamen Bericht, Dokumentversion und Prüferbestätigung hinzu. Die Prüfung muss ihren Umfang und ihr Ergebnis klar benennen. Ein Dokument-Hash belegt die Identität eines Dokuments, nicht seine inhaltliche Richtigkeit.

Für den kleinen Hackathon-Umfang ist eine gemeinsame manuelle Freigabe eine mögliche Vereinfachung. Eine tatsächlich erfolgte externe Wirtschaftsprüfung darf daraus nicht behauptet werden. Fortbestehender Bedarf, freies Budget und Schutz vor doppelter Auszahlung bleiben relevant.

### Notfallausnahme

Die Sorge vor blockierter Hilfe gehört zum ursprünglichen Nutzerkontext. Bei fehlendem Oracle oder fehlenden Belegen soll deshalb ein nachvollziehbarer Eskalationsweg existieren.

Ein früherer Entwurf sah ein unabhängiges Quorum, beispielsweise zwei von drei benannten Verantwortlichen, vor. Die Freigabe benötigt einen zugelassenen Empfänger, Begründung, begrenzten Betrag und eine spätere Nachprüfung. Das Quorum darf nicht ausschließlich aus Vertretern der empfangenden NGO bestehen.

**Normale und ausnahmsweise Auszahlungen müssen dasselbe verbleibende Einsatz- und NGO-Budget berücksichtigen.** Eine Notfallzahlung darf nicht unbemerkt eine zusätzliche reguläre Auszahlung desselben bewilligten Betrags ermöglichen.

Ein on-chain Notfallpfad löst keinen Chain-Ausfall, unerreichbares Quorum oder fehlende lokale Liquidität. Für einen realen Betrieb wären externe Reserven und eine spätere Abstimmung gegen Doppelzahlungen notwendig. Im MVP reicht es, diese Grenze sichtbar zu dokumentieren.

## 8 Architektur und Rollen

```text
Ereignisquelle
    ↓
Airnode signiert Antwort und Anfragekontext
    ↓
Relayer reicht unveränderte Antwort ein
    ↓
Contract authentifiziert und prüft die Freigaberegel
    ↓
Begrenzter Transfer an zugelassene NGO
    ↓
Portal zeigt Status und Entscheidungsgrund
```

| Komponente oder Rolle | Aufgabe |
| --- | --- |
| Geber oder beteiligte Organisation | Finanziert den Pool und beteiligt sich an vereinbarten Regeln. |
| Fondsverwaltung | Richtet Einsätze, Berechtigungen und Budgets im vereinbarten Rahmen ein. |
| Ereignisquelle und Airnode | Liefert Daten beziehungsweise signiert die konkrete API-Antwort. Die beiden Betreiber können verschieden sein. |
| Relayer oder Keeper | Beschafft Daten und reicht sie ein; entscheidet nicht durch eigene ungebundene Behauptungen über Auszahlungen. |
| Verifier und DisasterFund | Prüft Attestation, Trigger, Berechtigungen, Budgets und Einmaligkeit. |
| NGO | Zugelassener Empfänger; kann später Anträge und Berichte einreichen. |
| Prüfer oder Freigabegremium | Bestätigt definierte Prüfungen beziehungsweise zusätzliche Tranchen. |
| Notfallgremium | Genehmigt begrenzte Ausnahmen unter benannten Bedingungen. |
| Portal | Zeigt Poolstand, Einsatz, Datenlage, Anträge und Auszahlungen. |
| Geschützter Dokumentenspeicher | Spätere Ablage vertraulicher Berichte außerhalb der Blockchain. |

Die genaue Rollentrennung und Änderbarkeit der Regeln ist offen. Für den MVP ist ein überschaubarer Contract mit klaren Berechtigungen vorzuziehen. Die Bezeichnung „DAO“ verlangt keine zusätzliche Governance-Infrastruktur.

## 9 Datenquelle und Verifikation

### Noch keine fertige Katastrophenintegration

Im AirnodeHub-Katalog waren am 30. Oktober unter anderem USGS Earthquakes, NASA EONET und Wetterintegrationen wie Open-Meteo, Visual Crossing und WeatherAPI.com sichtbar. Das sind Kandidaten zur Prüfung. Daraus folgt weder die Eignung eines bestimmten Endpunkts noch ein erfolgreicher signierter Abruf für DisasterDAO.

Wetter, Hochwasser und Erdbeben sind mögliche Demo-Szenarien. Die Auswahl sollte davon abhängen, ob ein klarer Datenwert mit Orts- und Zeitbezug verfügbar und im Contract sicher auswertbar ist. Eine Prognose, eine Beobachtung und ein tatsächlicher Schadensnachweis sind unterschiedliche Dinge.

Ein Demo-Schwellenwert ist eine vereinbarte Prototypregel, keine wissenschaftlich validierte Katastrophendefinition. Ein historisches Ereignis darf verwendet werden, wenn die Demo es klar benennt und das dafür zulässige Ereigniszeitfenster ausdrücklich konfiguriert ist.

### Prüfreihenfolge

Die im aktuellen Chat geprüfte AirnodeHub-Dokumentation beschreibt Attestationen mit `airnode`, `requestHash`, `timestamp`, `data` und `signature`. Verwendet werden EIP-191/secp256k1-Signaturen. Den exakten Codec aus dem aktuellen offiziellen Starter beziehungsweise der Dokumentation übernehmen.

Der Contract muss mindestens prüfen:

1. **Vertrauenswürdiger Signer:** Wiederhergestellte Signaturadresse gegen eine konfigurierte Adresse oder Allowlist prüfen. Die vom Einreicher mitgelieferte `airnode`-Adresse allein begründet kein Vertrauen.
2. **Beabsichtigte Anfrage:** Operation, Parameter und gegebenenfalls Projektion müssen zum erwarteten `requestHash` gehören. Falscher Ort, Zeitraum oder Messwert ist keine zulässige Ersatzanfrage.
3. **Signaturzeit:** Datenalter und unzulässig zukünftige Zeitstempel behandeln.
4. **Ereigniszeit:** Eine frisch signierte Antwort kann alte Beobachtungen enthalten. Das für den Einsatz zulässige Ereignis- oder Messzeitfenster separat prüfen.
5. **Gebundener Datenwert:** Die Auszahlung muss von einem Wert aus den authentifizierten Antwortbytes abhängen. Ein zusätzlich übergebenes freies Feld wie `severity` genügt nicht.
6. **Semantik:** Einheit, Skalierung, Dezimalwerte, fehlende oder ungültige Werte sowie Ortsbezug eindeutig behandeln.
7. **Einmaligkeit und Budget:** Bereits ausgeführte Ansprüche und verbleibende Beträge auf Anwendungsebene prüfen.

Den ursprünglichen `data`-String bis zur kryptografischen Prüfung erhalten. Eigenes Parsen und Neu-Serialisieren vor der Verifikation kann die signierten Bytes verändern.

AirnodeHub unterstützt laut geprüfter Dokumentation eine `responseProjection`, die ausgewählte JSON-Felder in einer kleinen signierten Antwort zusammenfasst. Diese Projektion ist Teil der Anfrageidentität. Das kann die Auswertung im Contract vereinfachen; für den gewählten Ereignisendpunkt müssen Feldpfade und Verhalten zuerst an einer echten Antwort geprüft werden. Nachträgliches Zuschneiden durch das eigene Backend erhält die ursprüngliche Signatur nicht.

Die Prüfung einer Signatur darf nicht mit der Prüfung einer ungebundenen, vom Relayer behaupteten Zahl kombiniert werden. Eine eigene Backend-Signatur würde das Vertrauen auf das Backend verlagern und müsste ausdrücklich als solcher Aufbau erklärt werden.

### Mehrere Empfänger und erneute Ereignisantworten

Eine sinnvolle Anspruchskennung kann Fonds, Einsatz, NGO und Tranche enthalten. Eine gültige Ereignisantwort kann mehrere vorab bewilligte Empfänger betreffen. Ein globales „Attestation schon benutzt“ darf dabei nicht versehentlich die anderen berechtigten NGOs ausschließen.

Umgekehrt darf eine neue Signatur oder ein neuer Zeitstempel für dasselbe Ereignis keinen erneuten Anspruch auf dieselbe Tranche erzeugen. Eine Lageverschärfung ist nur dann ein zusätzlicher Auszahlungsgrund, wenn ein eigener genehmigter Ablauf dafür besteht.

### Wer signiert wirklich

Viele Katalogintegrationen sind „by API3“ gelistet. Nicht behaupten, dass beispielsweise eine Wetterbehörde selbst signiert, bevor dies für die ausgewählte Integration geprüft wurde. Datenquelle, Airnode-Betreiber und erlaubter Signer müssen einzeln benannt werden. Mehrere Signaturen über dieselbe Quelle sind keine unabhängigen Messungen.

## 10 Offizielle API3-Anforderungen

Die folgenden Kernpunkte wurden im aktuellen Chat am 30. Oktober 2026 direkt in der dynamischen API3-Ansicht der offiziellen Hackathon-Seite gelesen. Die ältere Übergabe, die sie noch als unbestätigte Claude-Zusammenfassung behandelt, ist in diesem Punkt überholt.

- Track: **Any API in your contract**.
- AirnodeHub muss für einen Kernablauf wesentlich sein.
- Eine signierte Antwort wird einem deployten Contract übergeben; Testnet genügt.
- Der Contract prüft erwarteten Signer, beabsichtigte Anfrage und relevante Zeitbedingungen.
- Ein Wert aus genau dieser signierten Antwort löst eine wesentliche on-chain Aktion oder Zustandsänderung aus.
- Wo nötig, muss doppelte Ausführung verhindert werden.

Für DisasterDAO soll die wesentliche Aktion eine begrenzte Auszahlung sein. Eine API-Anzeige oder ein bloßer Daten-Log allein ist nicht der empfohlene Nachweis.

### Fünf vorgeschriebene Demo-Fälle

| Fall | Erwartetes Ergebnis |
| --- | --- |
| Gültige und rechtzeitige Antwort mit erfülltem Trigger | Beabsichtigte Auszahlung erfolgt. |
| Echte Antwort mit einem veränderten Wert | Ablehnung vor Auszahlung. |
| Echte, zu alte Antwort | Ablehnung vor Auszahlung. |
| Echte Antwort auf eine andere Anfrage | Ablehnung vor Auszahlung. |
| Antwort mit Signatur eines unerwarteten Schlüssels | Ablehnung vor Auszahlung. |

Bei den Ablehnungsfällen die Ursachen getrennt demonstrieren. Eine geänderte Signaturzeit ohne gültige Neusignierung wäre beispielsweise nur ein weiterer Signaturfehler und kein sauberer Nachweis der Altersprüfung. Zeitgrenzen und Demo-Timing früh einplanen.

### Abgabe

- Demo-Video mit höchstens 2,5 Minuten.
- Ausführliche Projektbeschreibung auf Devfolio.
- Öffentliches Repository mit Setup- und Ausführungsanleitung.
- Deployte Contract-Adresse und Netzwerk.
- Oberfläche oder dokumentiertes Skript, über das die Jury eigene Antworten einreichen und die Manipulationstests ausführen kann.
- Erklärung, wer den Daten vertraut, welcher Schaden bei Fälschung entsteht und welche gewünschten Daten auf AirnodeHub fehlten.

Die Track-Seite empfiehlt den offiziellen Starter, Foundry, Node.js und pnpm sowie die Event-Faucet- und Zahlungsanleitung. Der Starter beginnt mit Nodary ETH/USD; das ist ein Einstieg in die Verifikation und noch keine Katastrophenintegration. Aus den gelesenen API3-Kernanforderungen ergibt sich keine Pflicht zu einem KI-Agenten.

## 11 Oberfläche und Demo

Für die erste Oberfläche genügen ein Poolüberblick und eine Einsatzansicht. Sie sollten zeigen:

- Verfügbarer Poolbetrag und vorab zugeteilte NGO-Budgets.
- Ereignis, Region, Datenquelle und vereinbarte Freigaberegel.
- Ob die Daten gültig, unzureichend, veraltet oder nicht verfügbar sind.
- Auszahlbarer Betrag und bereits ausgeführte Tranchen.
- Empfänger, Betrag, Zeitpunkt und Grund jeder Auszahlung.
- Sichtbarer Eskalationsweg bei fehlenden Daten oder Nachweisen.

Anfragehash, Signatur und technische Fehlertests können in einen eigenen Prüfbereich für die Jury. Die normale NGO-Ansicht sollte verständliche Statusmeldungen verwenden.

Vorgeschlagene Verteilung der 150 Sekunden Demozeit:

| Zeit | Inhalt |
| --- | --- |
| 0 bis 20 Sekunden | Problem, gemeinsamer Pool und vereinbarte Soforthilfe. |
| 20 bis 55 Sekunden | Echte gültige Attestation und Auszahlung. |
| 55 bis 110 Sekunden | Vier sichtbar abgewiesene Manipulationsfälle. |
| 110 bis 135 Sekunden | Begrenzter Notfallpfad oder Folgetranche, falls umgesetzt. |
| 135 bis 150 Sekunden | Vertrauensgrenzen und nächster Validierungsschritt. |

Die offiziellen fünf Fälle haben Vorrang vor zusätzlichen Funktionen. Historische Ereignisse, Testmittel und fiktive Organisationen klar benennen. Selbst signierte Testdaten sind für ergänzende Tests nützlich, ersetzen aber keinen echten AirnodeHub-Abruf.

## 12 Abnahmekriterien und Arbeitsreihenfolge

### Abnahmekriterien für den Kern

- Eine echte gültige Antwort kann eine begrenzte Auszahlung an einen zugelassenen Empfänger auslösen.
- Eine gültige Antwort ohne erfüllten Trigger löst keine Auszahlung aus.
- Die vier offiziellen Manipulationsfälle scheitern vor dem Transfer.
- Dieselbe NGO kann dieselbe Tranche nicht erneut beziehen, auch nicht mit einer frisch signierten Antwort zum selben Ereignis.
- Unberechtigte Empfänger und ausgeschöpfte Budgets werden abgewiesen.
- Eine Auszahlung kann nicht durch einen beliebig behaupteten Backend-Wert gesteuert werden.
- Fehlende Daten sind unterscheidbar von einem gültigen Datensatz unterhalb der Schwelle.
- Soweit Notfall- oder Folgetranchen existieren, gelten Quorum, Budget und Einmaligkeit auch für diese Pfade.
- Eine fremde Person kann den dokumentierten Ablauf reproduzieren.

### Empfohlene Umsetzungsschritte

1. **Bestand prüfen:** Arbeitsverzeichnis und vorhandenes Repository lesen; vorhandene Arbeit erhalten. Aktuellen Starter und Track-Vorgaben gezielt abgleichen.
2. **Datenweg beweisen:** Innerhalb eines ersten begrenzten Arbeitsblocks eine passende Ereignisquelle auswählen und eine echte signierte Antwort sichern. Signer, Anfrage, Feldformat, Einheit und Zeitbezug dokumentieren. Der bisher vorgeschlagene Zeitrahmen von etwa 30 bis 45 Minuten ist eine Orientierung, keine Vorgabe des Veranstalters.
3. **Contract-Kern bauen:** Pool, Berechtigungen, Einsatzbudget, Verifikation, Trigger und einmalige Auszahlung.
4. **Kritische Fälle prüfen:** Gültiger Ablauf, vier offizielle Manipulationsfälle sowie wiederholte Ansprüche und Budgetgrenzen. Für diesen geldverwaltenden Kern sind aussagekräftige Tests erforderlich.
5. **Einreichung ermöglichen:** Abruf- und Einreichungsskript mit reproduzierbaren Parametern; danach einfache Oberfläche.
6. **Zeitabhängig erweitern:** Begrenzte gemeinsame Notfallfreigabe und gegebenenfalls eine Folgetranche.
7. **Abgabe vorbereiten:** Testnet-Deployment, Adressen, Setup, Nachweise und kurzes Video.

Wenn die Katastrophenintegration nicht funktioniert, zuerst den Datenumfang oder Ereignistyp innerhalb von DisasterDAO anpassen. Eine ETH/USD-Antwort nicht als Katastrophennachweis ausgeben. Eine breitere neue Ideensuche ist aktuell nicht das Ziel.

## 13 Offene Fragen und Grenzen für einen realen Einsatz

Für die technische Umsetzung müssen zunächst Netzwerk, Token, Datenendpunkt, erlaubter Signer, Anfrageidentität, Zeitfenster, Schwelle, Budgets und konkrete Änderungsrechte entschieden werden. Diese Routineentscheidungen können anhand des Starters und der verfügbaren Daten vorgeschlagen werden; sie dürfen nicht als frühere Nutzerentscheidungen dargestellt werden.

Für einen späteren Pilot sind weitere Fragen offen:

- Welche Organisationen möchten tatsächlich gemeinsam Geld verwalten, und welche Befugnis soll keine einzelne Partei allein haben?
- Wer trägt die institutionelle Verantwortung und entscheidet bei Streit oder fehlerhaften Daten?
- Wie werden lokale Organisationen angemessen beteiligt und Budgets fair zugeteilt?
- Wie erreichen Mittel die lokale Verwendung, wenn Wallet, Token, Internet oder Umtausch nicht funktionieren?
- Welche Zugangs-, Lösch- und Offenlegungsregeln gelten für Berichte und Belege?
- Welche rechtlichen, vertraglichen und steuerlichen Anforderungen gelten in den beteiligten Ländern?

Im ursprünglichen Konzept wurden insbesondere falsche Oracle-Daten, Schlüsselverlust, problematische Administrationsrechte, Token- und Liquiditätsrisiken, kolludierende Prüfer und die Reidentifikation durch öffentliche Metadaten festgehalten. Auch Hashes und Walletadressen können einen sensiblen Bezug haben. Personenbezogene Rohbelege gehören nicht in eine öffentliche Blockchain.

Der bisher vorgeschlagene Validierungsweg nach dem Hackathon: drei bis fünf Gespräche mit Fondsmanagement, NGO-Finanzteams, lokaler Einsatzorganisation und Prüfung. An echten vergangenen Fällen Alarm, Entscheidung, Auszahlung, lokale Nutzbarkeit und Bericht rekonstruieren. Anschließend denselben Ablauf mit einer zentralen signierten Datenbank vergleichen. Relevante Kriterien wären Zeit bis nutzbarer Finanzierung, manueller Aufwand, Gesamtkosten und fehlerhaft blockierte oder freigegebene Zahlungen.

Es gibt bisher keine belegte Zeitersparnis, Kostenreduktion, rechtliche Freigabe oder humanitäre Wirkung für DisasterDAO. Der Hackathon-Prototyp soll zunächst den technischen Ablauf nachvollziehbar zeigen.

## 14 Bisherige Alternativen und heutige Priorität

Zwischenzeitlich wurden Forschungsbeiträge, Fahrzeughistorien, Wasserrechte, Kühlketten, Wetterversicherung, Schiffs-Demurrage und Flugverspätungs-Escrow untersucht. Wiederkehrende Probleme waren bereits existierende Lösungen, fehlende passende API-Daten oder die Verwechslung eines Messwerts mit einem tatsächlichen Leistungs- beziehungsweise Bedarfsnachweis.

FlightBond wurde zuletzt als besonders schnell abgrenzbare Technikdemo empfohlen: Ein vereinbarter Flug entscheidet über die Verteilung einer hinterlegten Restzahlung. Der Nutzer findet den NGO-Fonds jedoch interessanter. Die letzte vergleichende Empfehlung lautete deshalb:

1. NGO-Fonds als bevorzugtes Gesamtprojekt.
2. FlightBond als technisch gut abgrenzbare Alternative.
3. Fahrzeughistorie als langfristig interessante, derzeit weniger gut zum API3-Track passende Richtung.

Diese Rangfolge ist eine Einschätzung aus dem Chat, keine Marktstudie. Der Nutzer wünscht jetzt die Aufbereitung des NGO-Projekts für Codex. Die frühere Kennzeichnung von DisasterDAO als endgültig verworfen ist überholt.

## 15 Arbeitsverzeichnis und vorhandene Materialien

Projektordner:

`/Users/max/Desktop/Second-Brain/Own Projects/Blockchain Hackathon`

Beim Erstellen dieser Übergabe am 30. Oktober 2026 waren folgende Materialien vorhanden:

| Material | Bedeutung |
| --- | --- |
| `DisasterDAO_Projektkontext_DE.pdf` | 15-seitiger ursprünglicher NGO-Kontext mit Architektur, Tranchen, Notfallweg, Grenzen und Quellen. |
| `Blockchain_Hackathon_Projektuebergabe_2026-10-30.pdf` | 11-seitiges Ideen- und Entscheidungsprotokoll; frühere Bewertung von DisasterDAO und unbestätigter Status der Track-Regeln sind teilweise überholt. |
| `Claude_Ideas` | Bei Prüfung leer. |
| `API3_Project/README.md` | Bei Prüfung leer. |
| `API3_Project/.git` | Vorhandenes Repository; `main` mit Tracking auf `origin/main`, Arbeitsbaum bei Prüfung sauber. Es wurden keine Implementierungsdateien gefunden. |

Zusätzlich wurde ein Claude-Chat als Textanhang bereitgestellt. Er behandelt vor allem alternative Ideen und die Konkurrenz bei automatischen Verspätungsauszahlungen. Die Originaldatei liegt außerhalb des Projektordners unter:

`/Users/max/.codex/attachments/c8280d70-2620-4f4c-8b01-927ff80efd59/Eingefügter Text.txt`

Dieses Dokument enthält den für DisasterDAO relevanten Kontext, sodass die nächste Codex-Sitzung nicht von diesem Anhang abhängt. Es wurde für diese Übergabe keine Software implementiert, kein Contract deployt und keine NGO kontaktiert.

## 16 Quellen und Einstiegspunkte

### Aktuelle technische und organisatorische Quellen

- [Offizielle API3-Track-Regeln und Einreichung](https://hackathon.tum-blockchain.com/prizes#api3) — Dynamische API3-Ansicht im aktuellen Chat geprüft; Kernanforderungen und sichtbare Deadline daraus übernommen.
- [Offizieller Starter](https://github.com/api3dao/airnodehub-hackathon-starter) — Von der offiziellen Track-Seite verlinkt. Repository-Inhalt und Versionsstand vor Implementierung lesen.
- [Challenge und Onboarding](https://api3dao.github.io/airnodehub-hackathon/) — Offiziell verlinkter Einstieg; inhaltlich in dieser Sitzung nicht vollständig geprüft.
- [Hackathon-Dokumentation](https://api3dao.github.io/airnodehub-hackathon/docs/) — Implementierungsanleitungen; konkrete aktuelle Anleitung vor Nutzung lesen.
- [Empfohlene Integrationen](https://api3dao.github.io/airnodehub-hackathon/docs/integrations) — Von der Track-Seite verlinkt.
- [Von der API zum Contract](https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract) und [Projektionen](https://api3dao.github.io/airnodehub-hackathon/docs/projections) — Von der Track-Seite verlinkte technische Anleitungen.
- [AirnodeHub-Katalog](https://airnodehub.api3.org/explore) — In dieser Sitzung gelesen; ein Eintrag ist kein erfolgreicher Integrationstest.
- [Attestation und Verifikation](https://airnodehub-docs.api3.org/airnode/attestation) — In dieser Sitzung gelesen; Signatur, Anfragebindung und Originalbytes.
- [HTTP-Schnittstelle und Projektionen](https://airnodehub-docs.api3.org/airnode/http-interface) — In dieser Sitzung gelesen; Aufrufmodell und signierte Feldauswahl.
- [API-Konsumenten](https://airnodehub-docs.api3.org/api-consumers/) — In dieser Sitzung gelesen; Discovery, Aufruf und Zahlungsstatus.
- [Attestierte Daten und Quellenvertrauen](https://airnodehub-docs.api3.org/airnode/attested-data) — Aus dem ursprünglichen Kontext übernommen; bei Auswahl des Signers lesen.
- [aUSD-Faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/) und [Circle-Testnet-Faucet](https://faucet.circle.com/) — Von der Track-Seite verlinkt. Token zur API-Bezahlung und Token des NGO-Pools getrennt auswählen; sie müssen nicht identisch sein.

### Aus dem ursprünglichen Projektkontext übernommene Rechercheanker

Diese Links sind Anknüpfungspunkte und keine erneut geprüften Zusagen oder Produktnachweise:

- [Start Network Global Start Fund](https://startnetwork.org/what-we-do/start-fund/global)
- [Start Network Anticipatory Action](https://startnetwork.org/focus-areas/anticipatory-action)
- [OCHA Country-Based Pooled Funds](https://www.unocha.org/country-based-pooled-funds)
- [OCHA FAQ zu Pooled Funds](https://www.unocha.org/country-based-pooled-funds-cbpfs-faq)
- [DEC Mittelverteilung](https://www.dec.org.uk/article/how-we-spend-and-allocate-your-money)
- [WFP Building Blocks](https://www.wfp.org/building-blocks)
- [IATI Standard](https://azure.iatistandard.org/en/iati-standard/)
- [ODI zur Finanzierung von Mutual-Aid-Gruppen im Sudan](https://odi.org/en/publications/funding-mutual-aid-groups-in-sudan-routes-losses-and-what-needs-to-change/)
- [EDPB zu personenbezogenen Daten und Blockchain](https://www.edpb.europa.eu/documents/guideline/guidelines-022025-on-processing-of-personal-data-through-blockchain_et)
- [Finanzamt München zu Spendenformularen](https://www.finanzamt-muenchen.de/formulare/weitere-themen-a-bis-z/spenden)
- [OCHA Country-Based Pooled Funds 2023 in Review](https://digitallibrary.un.org/record/4053232/files/1410896-EN.pdf)

Lokale Grundlagen dieser Zusammenstellung sind die beiden genannten PDFs, der bereitgestellte Claude-Chat und die anschließenden Nachrichten in dieser Sitzung. Bei Widersprüchen gilt die neueste ausdrückliche Nutzeranweisung. Frühere Vorschläge und zusammengefasste Recherche dürfen nicht zu bestätigten Nutzerentscheidungen oder bewiesenen Marktlücken werden.

## 17 Startprompt für die nächste Codex-Sitzung

> Ich nehme solo am TUM Blockchain & AI Hackathon teil und möchte DisasterDAO im API3-Track umsetzen. Lies dieses Übergabedokument und prüfe zuerst den vorhandenen Projektordner. Der NGO-Fonds ist wieder mein bevorzugter Ansatz; starte keine neue breite Ideensuche.
>
> Ziel ist ein kleiner Testnet-Prototyp: gemeinsamer Pool für zugelassene Demo-NGOs, vorab vereinbarte Budgets, eine echte AirnodeHub-Ereignisantwort und eine begrenzte einmalige Auszahlung. Der Contract muss Signer, beabsichtigte Anfrage, relevante Zeitbedingungen und den tatsächlich signierten Datenwert prüfen. Zeige die gültige Auszahlung und alle vier offiziellen Manipulationsfälle.
>
> Beginne mit einer echten signierten Katastrophen- beziehungsweise Ereignisantwort und dem offiziellen Starter. Wähle geeignete technische Details anhand der verfügbaren Daten und dokumentiere deine Annahmen. Baue danach den Contract-Kern und eine einfache Oberfläche. Ergänze einen begrenzten gemeinsamen Notfallpfad und eine Folgetranche, soweit die verbleibende Zeit es erlaubt. Die Sorge vor blockierter Hilfe und die Grenzen eines on-chain Notfallwegs müssen erhalten bleiben.
>
> Trenne ursprüngliche Vision, aktuelle Empfehlung und neu getroffene technische Entscheidungen. Behaupte keine bewiesene Marktlücke, echten Partner, reale Prüfung oder humanitäre Wirkung. Antworte kurz und präzise und arbeite auf einen reproduzierbaren, reviewbaren Hackathon-Prototyp hin. Echte Gelder, externe Kontaktaufnahme und eine Veröffentlichung sind nicht Teil dieses Startauftrags.
