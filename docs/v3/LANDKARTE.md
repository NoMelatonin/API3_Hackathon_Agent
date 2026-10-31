# DisasterDAO: Funktionslandkarte

Stand: 31.10.2026, einschließlich Prüfung der Vite-Cache-Reparatur. Grundlage: integrierter Quellcode, lokale Contract-/Integrations-/Browserprüfungen und die separat datierten Ergebnisse im aktuellen [Prüfbericht](VERIFICATION.md). Frühere V3-Beschreibungen stehen [in der Historie](../history/v3-LANDKARTE.md). Die Pfade `v3` bleiben interne Namen; sie bezeichnen keine getrennte Produktoberfläche.

## Produkt und Oberflächen

Drei registrierte NGOs teilen je Bündnis einen Fonds. Zwei simulierte Bündnisse besitzen getrennte Token, Fonds, Rollen und private Daten. Ein Einsatz ist vor Deployment fest registriert; neue Bündnisse/Mitglieder/Einsätze werden nicht dynamisch aufgenommen.

| Einstieg                         | Wer kann was?                                                                                                                                      | Umsetzung                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/` und `#/home`                 | Öffentlichkeit entdeckt Bündnisse und sieht bestätigte Einzahlungen, Fondskennzahlen und veröffentlichte NGO-Berichte. Kein persönliches Guthaben. | [Startseite](../../web/v3/home.tsx), [Einzahlungsdiagramm](../../web/v3/support-allocation.tsx) |
| `#/organizations/local-alliance` | Organisationsdetail mit Mitgliedern, Gebieten, Fonds und Aktivität.                                                                                | [Ansicht](../../web/v3/organization.tsx), [Daten](../../server/organizations.ts)                |
| `/?ngo=1#/ngo`                   | Simulierte NGO-Sitzung: eigene Anträge, feste Empfänger, Reservierungen, private Nachweise, externe Freigaben und Folgeanträge.                    | [NGO](../../web/v3/ngo.tsx), [Fallablauf](../../web/v3/workflow.tsx)                            |
| `#/jury`                         | Originalantwort importieren, direkten Contract-Aufruf simulieren und vier Manipulationsfälle prüfen. Eine Simulation verändert keinen Zustand.     | [Jury](../../web/v3/jury.tsx), [Contract-Aufrufe](../../server/jury.ts)                         |

Die Navigation verbindet Öffentlichkeit, NGO und Jury innerhalb eines Produkts. Alte Versions-URLs werden auf diese Anwendung abgebildet. Es gibt kein Prüferportal und keine ältere Demo-Oberfläche mehr. Ansichtswechsel erhalten die NGO-Sitzung; ausdrücklich Abmelden beendet sie.

## Rollen und Freigaben

| Rolle                 | Entscheidung und Grenzen                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NGO                   | Wählt registrierten Einsatz, nennt Zweck/Betrag/Kapazität/externe Mittel, reicht Originalantwort oder externen Antrag ein, reserviert und ruft an ihre feste Adresse ab. Keine Selbstfreigabe privater Nachweise. |
| Datenprüfer           | Zwei unterschiedliche Signer aus drei bestätigen externe Anträge, gemeinsame Rundensnapshots und begründete Lageentscheidungen. Der Contract erzwingt die gemeinsame Geldregel auch bei gültigen Signaturen.      |
| Nachweisprüfer        | Zwei aus drei bestätigen Eingang, prüfen Verwendung, Nachforderung, Verlängerung, bestimmte Folgefreigaben und Veröffentlichung. Prüfbericht und signierte Entscheidung bleiben getrennt.                         |
| Einspruchsprüfer      | Zwei aus drei aus einer separaten Gruppe klären gesperrte Nachweise.                                                                                                                                              |
| Betreiber             | Startet Infrastruktur, bereitet externe Aufträge vor und verwaltet private Testschlüssel. Vorbereitung ersetzt keine erforderlichen Signaturen.                                                                   |
| Jury / Öffentlichkeit | Können ohne NGO-Schlüssel Contract-Simulationen ausführen. Tatsächliche NGO-Transaktionen benötigen die registrierte Identität bzw. den laufenden lokalen Demo-Betreiber mit deren Testschlüsseln.                |

Alle Organisationen und Identitäten sind simuliert; getrennte Testschlüssel beweisen keine institutionelle Unabhängigkeit. Prüfer signieren per externem CLI, niemals per Browserrolle. Umsetzung: [Rollen](../../server/state.ts), [Import/Bindungen](../../server/external.ts), [Werkzeug](../../src/v3/approvals.ts).

## Vollständiger Kernprozess

1. **Einsatz belegen:** NGO wählt den Einsatz. Originalbytes, Signierer, genauer Anfragehash, Signaturzeit, Ereigniszeit und Förderregel werden im Contract geprüft. Im lokalen Standardmodus ist der Signierer ausdrücklich synthetisch.
2. **Beantragen:** Zweck, Betrag, Kapazität und externe Finanzierung werden gebunden. Vorschau ist unverbindlich; Antrag reserviert und zahlt nichts.
3. **Reservieren:** Frische Oracle-Antwort oder externe 2/3-Antragsfreigabe bildet die Fördergrundlage. Oracle-Anträge reservieren regelbasiert; externe Anträge zusätzlich über einen 2/3-signierten gemeinsamen Rundensnapshot. Beide verbrauchen dieselben Paketanteile und kumulativen Ansprüche.
4. **Abrufen:** Innerhalb von 24 Stunden zahlt der Contract genau einmal an die feste NGO-Adresse. Auszahlung erzeugt die Nachweispflicht. Gemint und mit zwei Folgeblöcken im Index bestätigt sind verschiedene Zustände.
5. **Privat nachweisen:** NGO lädt Ausgabennachweise hoch. Ein gesalzenes Manifest bindet die Originale. Zwei Nachweisprüfer attestieren den Eingang. Danach werden ein eigener externer Prüfbericht hochgeladen und eine separate signierte Entscheidung importiert: akzeptiert, nachgefordert oder abgelehnt.
6. **Folgeförderung:** Akzeptierte/geklärte Gesamthistorie, belegte Verschlechterung oder zwei andere berechtigte NGO-Stimmen ermöglichen weitere Anträge innerhalb desselben Restanspruchs. Überfällige, abgelehnte oder im Einspruch befindliche Nachweise bleiben harte Sperren.

Upload allein ist keine Eingangsbestätigung, Signaturimport allein keine bestätigte Chain-Entscheidung und ein PDF allein keine Freigabe. [Konkrete Bedienung](UI.md).

## Geldregeln und Fristen

- **4.500 dUSD** Maximum kumulativ je NGO/Einsatz. `Rest = max(0, Obergrenze − bezahlt − reserviert − externe Finanzierung)`. Einzelbetrag zusätzlich höchstens Antrag und Kapazität.
- Kapazität und externe Finanzierung sind Angaben der NGO. Eine Airnode-Signatur bestätigt diese Angaben nicht.
- **Gleiche Gewichte** für zwölf registrierte Pakete (drei NGOs × vier Einsätze). Höhere Anträge erhöhen das Gewicht nicht. Bei der bestehenden Konkurrenz gilt **90 %**, also höchstens 4.050 dUSD einschließlich externer Mittel.
- **20 % der freien Mittel** bleiben bei unbekannter/widersprüchlicher Lage vor einer neuen Runde unverteilt. Vollständige, höchstens eine Stunde gültige 2/3-Lageatteste können die Unsicherheit aufheben; fehlende/fehlgeschlagene Abfragen sind keine Entwarnung.
- **Eine gemeinsame Runde:** Paketanteile ohne bereits abrufbaren Antrag werden vorläufig gebunden. Ein später geeigneter Antrag kann seinen eigenen Anteil übernehmen, auch innerhalb des sechsstündigen Rundenabstands. Das reserviert kein zweites Budget.
- **Mindestens sechs Stunden** zwischen neuen Runden; solange vorläufige Restanteile der laufenden Runde gebunden sind, wird keine zweite Runde darübergelegt. Bindung höchstens **24 Stunden**; danach werden freie Restanteile freigegeben. Es gibt keine automatische Auszahlung alle sechs Stunden.
- Externe Snapshots gelten höchstens **eine Stunde** und binden Bestand, Reservierungen, Nonce, Empfänger und genaue Beträge. Bei Zustandsänderung ist ein neuer Snapshot nötig. Abrufreservierungen gelten **24 Stunden**.
- Offene Anträge/Folgezustimmungen gelten **72 Stunden**; bestimmte unveränderte Wiederholungen nach Schließung sind **sieben Tage** gesperrt.
- Nachweise: **30 Tage** für Erdbeben/Sturm/Flut, **45 Tage** für Gesundheit; die gemeinsame Fristfunktion kennt **60 Tage** für langsame Krisen, die aktuell nicht im festen Einsatzregister stehen. Zwischenbericht bis Tag 7 ist separat.
- Eingangsattest innerhalb **einer Stunde** nach dokumentiertem Eingang; keine rückwirkende Fristverlängerung. Nachforderung **14 Tage**; einmalige Verlängerung vor Fälligkeit bis **30 Tage**; Einspruch binnen **14 Tagen**. Prüfziel zehn UTC-Werktage, keine automatische Annahme.

Der externe Ersatzpfad ersetzt nur die Oracle-Fördergrundlage. Er umgeht weder Budget, Reservierung, Empfänger, Nachweissperren noch kumulative Grenzen. V1-Einmalzahlungen, V2-Kurven und V2-Einsatzbudgets sind archiviert. Das synthetische Bedarfsmodell bestimmt keine Förderhöhe mehr.

Umsetzung: [Fonds und Oracle](../../contracts/DisasterFundV3Auto.sol), [Allokation](../../contracts/SharedAllocation.sol), [Nachweisregeln](../../contracts/DisasterFundV3.sol), [gemeinsame Vorschau/Runde](../../server/service.ts).

## Echte Airnode-Daten, Demo und Historie

- **USGS:** festes Ereignis `us6000jllz`, 06.02.2023; `reviewed`, Erdbeben, Magnitude ≥7,0, 36–39° N / 35–39° E.
- **EONET:** `EONET_22386`, JTWC, Point, `severeStorms`, Knoten ≥34; Beobachtung 10.08.2026 06:00 UTC, 26–29° N / 160–162° E. Das ist der tatsächliche historische Pazifik-Datensatz, nicht die synthetische Philippinen-Szene.
- Signaturen höchstens **300 Sekunden** alt, nicht zukünftig und nicht vor Fondsaktivierung. Historische Beobachtungsfenster werden getrennt geprüft; Originalbytes und Zeitstempel bleiben unverändert.
- Der lokale Demo-Modus verwendet einen klar markierten Demo-Signer und synthetische Flut-/Gesundheitsstufen. Auf Base Sepolia verbietet der Constructor synthetische Policies. Für Flut/akute Gesundheit bleibt dort nur der externe Pfad.
- WHO-Jahresdaten für Nigeria sind keine passende Quelle für den registrierten akuten Gesundheitsfall. [Status und tatsächliche Abrufnachweise](../sources/STATUS.md).
- Alte V1-/V2-Transaktionen sind Historie. Neue integrierte Deployment-/Auszahlungsnachweise stehen separat [im Prüfbericht](VERIFICATION.md): 500 dUSD mit echten USGS-Airnode-Daten plus vier genaue Contract-Ablehnungen.

Die öffentliche Simulation ruft eine zustandsändernde Contract-Funktion per `eth_call` auf. Reverts müssen dekodierbar sein; Netzwerk-/Backendfehler zählen nicht als Ablehnung. Ein gültiger Kontrollfall und vier getrennte Fälle sind im [Jury-Ablauf](../JURY.md) beschrieben.

## Infrastruktur und Privatsphäre

Webseite → Loopback-Backend → Contract, PostgreSQL und verschlüsselter privater S3-Speicher. Worker/Indexer lesen mit zwei Folgeblöcken bestätigte Ereignisse und gleichen verlorene Antworten sowie Reorgs ab. Private Originale liegen nicht auf der Chain; dort stehen gesalzene Nachweisbindungen und Entscheidungen.

Der [kanonische Contract-Build](../../scripts/build-contracts.mjs) trennt App-Artefakte von partiellen Test-Artefakten und prüft Quellhashes. Beide öffentlichen Fonds wurden erneut mit genau diesem Build verifiziert.

Eigene Docker-Volumes und Ports erhalten vorherige V3-Daten. App-Daten, Dateischlüssel und Sitzungen sind je Profil/Bündnis getrennt. Dokumentlinks sind rollen-/dateigebunden, einmalig und 60 Sekunden gültig; Dateien höchstens 2 MiB, mit Formatprüfung. Browser erhalten keine Prüfschlüssel. Ein Neustart erhält Daten und Dateien, beendet jedoch Sitzungen.

`npm start` startet die synthetische Demo einschließlich ausdrücklich lokalem Blocktakt. `DISASTERDAO_PROFILE=testnet npm start` verwendet die neuen unveränderlichen Base-Sepolia-Contracts. Kein automatisches Testnet-Deployment und kein Zurückfallen auf synthetische Daten. [Start/Wiederherstellung](LOCAL.md), [Chain-Profile](../../src/v3/chain.ts), [Speicher](../../server/store.ts), [Worker](../../server/worker.ts).

Der Betreiber startet die Abhängigkeitsprüfung auch mit `npm run dev`; keine NGO-/Prüferfreigabe erforderlich. Der [Installer](../../scripts/install-local.mjs) verarbeitet vor Cache-Wiederverwendung und vor Verlinkung einer Neuinstallation tatsächlich HTML mit Vite und erkennt dadurch fehlende, verzögert geladene Dateien. Beschädigte Caches werden aus dem Lockfile neu installiert; bei Fehlern bleibt der bisherige Link erhalten. Grenze: Neuinstallation benötigt Netz, laufende Server werden nicht automatisch umgestellt. Nächster Schritt bei einem alten Modulpfad: Server beenden und neu starten. [Reparaturanleitung](LOCAL.md#fehlende-vite-dateien-reparieren).

Erhalten sind außerdem: bestätigte Testeinzahlungsübersicht, begrenzte Testspenden aus dem gemeinsamen Testkonto, öffentliche freigegebene NGO-Berichte, NGO-Mitgliederaktivität, Fristerinnerungen, getrennte Organisationen, DE/EN sowie 37 als ungeprüft markierte Sprachentwürfe, RTL, Theme- und Anzeigeeinstellungen. Browserwallet-Verbindung ändert den Testspender nicht; es gibt keine erfundene Fiat-Umrechnung.

## Grenzen und nächster Schritt

Keine echten Gelder, echten Partner, nachgewiesene humanitäre Wirkung, produktive Authentifizierung oder dynamische Aufnahme neuer NGOs/Einsätze. Alle Signiererrollen werden im Prototyp vom lokalen Betreiber simuliert. API3 authentifiziert Quelldaten, keine Ausgaben oder Bedürftigkeit. Optionale unsignierte HTTP-Scans sind keine Oracle-Nachweise.

Nächster Schritt für eine Vorführung: `npm start`, NGO auswählen und den vollständigen Fall durchlaufen. Für echte Signaturen und die neue öffentliche Auszahlung zuerst [Prüfbericht](VERIFICATION.md) und [Jury-Anleitung](../JURY.md) verwenden. Bei Änderungen müssen diese Landkarte, README, UI- und Betriebsanleitung im selben Änderungssatz abgeglichen werden.
