# DisasterDAO bedienen

Stand: 31.10.2026. Aktuelle einheitliche Oberfläche; [historische V3-Anleitung](../history/v3-UI.md).

## Geführte NGO-Demo

1. `npm start`, dann `/?ngo=1#/ngo`. Eine der sechs ausdrücklich simulierten NGOs wählen und anmelden. Jedes Bündnis hat einen eigenen Fonds.
2. **Hilfe beantragen**: registrierten Einsatz wählen, **Ereignisdaten prüfen**. Der lokale Standard zeigt synthetisch signierte Demo-Daten. Auf Base Sepolia sind originale Airnode-Daten nötig; eigene JSON-Datei kann hier importiert werden.
3. **Weiter zum Antrag**: Zweck, Betrag, Kapazität und externe Finanzierung eintragen. Vorschau ansehen und verbindlich einreichen. Noch keine Reservierung und keine Auszahlung.
4. Im selben Fall **Freigabe prüfen**. Bei eigener Originaldatei diese für die Reservierung erneut importieren, solange sie gültig ist; andernfalls eine neue echte Antwort beschaffen. Erst dann **Mittel verbindlich reservieren**. Ohne Verschlechterung/akzeptierte Gesamthistorie können Folgeanträge zwei andere NGO-Stimmen benötigen.
5. **Reservierten Betrag abrufen**. Fester Empfänger, Betrag und Frist stehen am Fall. Erst dieser Schritt überträgt dUSD und erzeugt die Nachweispflicht. Wiederholungen erzeugen keine zweite Zahlung.
6. Ausgabennachweise privat hochladen und den nachfolgenden externen Prozess abschließen. Der Fall zeigt Verantwortlichen, Sperrgrund und nächsten Schritt; er bleibt nach Neuladen erhalten.

Der öffentliche Bereich zeigt Fonds und bestätigte Einzahlungen des gemeinsamen Testkontos. Testspenden sind auf 1.000 dUSD pro Vorgang begrenzt. Eine verbundene Browserwallet ändert das Testspenderkonto nicht. Für Testspenden eine aktive NGO-Sitzung ausdrücklich beenden.

## Externe Freigaben

Prüfer arbeiten ausschließlich mit lokalen externen Werkzeugen. Die NGO importiert fertige signierte JSON-Pakete. Kein Browser-Prüferkonto und kein automatisches Erzeugen fehlender Freigaben beim Import.

Alle folgenden Befehle im richtigen Profil und Bündniskontext ausführen. Für das zweite Bündnis `V3_ORGANIZATION=community-alliance` setzen, für Base Sepolia zusätzlich `DISASTERDAO_PROFILE=testnet`. Neue private Ausgabedateien unter `.runtime/` verwenden; Werkzeuge überschreiben sie nicht.

### Antrag und gemeinsamer Ersatzpfad

Ohne geeignete Oracle-Daten im selben Einstieg **Externe Prüfung als Alternative** öffnen. Zweck/Beträge einreichen und **Prüfauftrag exportieren**. Zwei Datenprüfer signieren nacheinander:

```sh
npm run approvals -- sign --role data-1 --in .runtime/application.json --out .runtime/application-one.json
npm run approvals -- sign --role data-2 --in .runtime/application-one.json --out .runtime/application-two.json
```

Die NGO importiert die letzte Datei. Danach bereitet der Betreiber die gemeinsame Runde vor:

```sh
npm run approvals -- prepare-round --out .runtime/round.json
npm run approvals -- sign --role data-1 --in .runtime/round.json --out .runtime/round-one.json
npm run approvals -- sign --role data-2 --in .runtime/round-one.json --out .runtime/round-two.json
```

NGO importiert `round-two.json`, sofern ein eigener Antrag enthalten ist. Budget-/Snapshotänderungen verlangen einen neuen Auftrag und neue Signaturen. Der Contract berechnet/vergleicht dieselben Paketanteile wie im Oracle-Pfad. Anschließend separat abrufen.

### Eingang und Verwendung nachweisen

- Am Auszahlungsnachweis **Ausgabennachweis** hochladen: TXT mit `DISASTERDAO SYNTHETIC`, PDF, PNG oder JPEG, höchstens 2 MiB. Für die Demo nur fiktive Inhalte verwenden. Originale bleiben privat.
- **Eingangsattest zur Prüfung exportieren** und privat als `.runtime/receipt.json` speichern. Zwei Nachweisprüfer (`evidence-1`, `evidence-2`) signieren mit demselben `sign`-Befehl. NGO importiert am betreffenden Nachweis. Upload allein zählt nicht als attestierter Eingang.
- **Externen Prüfbericht** als separates privates Dokument hochladen und seine Dokument-ID übernehmen. Betreiber bereitet die Entscheidung mit privater Eingabedatei vor:

```json
{
  "kind": "review",
  "evidenceId": 1,
  "documentId": "DOKUMENT-ID",
  "reason": "Rechnung, Zahlung und Lieferung geprüft; kein Interessenkonflikt.",
  "decision": 2,
  "days": 0
}
```

```sh
npm run approvals -- prepare-review --input .runtime/review-input.json --out .runtime/review.json
npm run approvals -- sign --role evidence-1 --in .runtime/review.json --out .runtime/review-one.json
npm run approvals -- sign --role evidence-2 --in .runtime/review-one.json --out .runtime/review-two.json
```

NGO importiert die letzte Datei am passenden Nachweis. `decision`: 2 akzeptiert, 3 nachgefordert, 4 abgelehnt. Der Auftrag bindet Berichtsdigest, Manifest, Zustand, Chain und Fonds; Änderungen machen alte Signaturen unbrauchbar.

### Weitere vorhandene Entscheidungen

`prepare-review` unterstützt `extend` (vor Fälligkeit einmal höchstens 30 Tage), `resolve` (separate Einspruchsgruppe) und `followup` (akzeptierte Gesamthistorie plus passender externer Bericht). Der konkrete JSON-Auftrag enthält Nachweis-/Antrags-ID, Grund, Tage und Dokument-ID. Der Export zeigt die vollständigen signierten Argumente; nicht benötigte Felder mit 0 belegen. Einspruch selbst startet die betroffene NGO am Nachweis.

`prepare-coverage --input .runtime/coverage-input.json` erwartet `areaId` und begründeten `reason` (mindestens 20 Zeichen). Zwei Datenprüfer signieren; nur Betreiber importiert. Die höchstens eine Stunde gültige Chain-Entscheidung hebt Unsicherheit nur für die gebundenen Einsatzgebiete auf. Sie ist keine Airnode-Signatur und ersetzt keine individuelle Fördergrundlage.

Berichte zur Veröffentlichung benötigen separat zwei Nachweisprüfer über `PUBLICATION`. Veröffentlichung einer NGO-Aussage ist keine zusätzliche On-Chain-Wirkungsbestätigung. `recuse --role … --target … --reason …` dokumentiert Befangenheit vor einer Freigabe; vorhandene Signaturen werden dadurch nicht auf neue Aufträge übertragen.

## Status richtig lesen

Datei hochgeladen → Eingang attestiert → Prüfbericht gebunden → Entscheidung gemint → mit zwei Folgeblöcken bestätigt sind getrennte Zustände. Bei Quellen-/Netzwerkfehlern gibt es keine Ersatzsignatur. Reservierungsablauf gibt Geld frei; er ist keine Auszahlung. Geänderte private Dokumente erfordern neue Manifestbindungen und Signaturen.

[Alle Geldregeln und Fristen](LANDKARTE.md#geldregeln-und-fristen) · [Start und Schlüssel](LOCAL.md) · [Jury](../JURY.md)
