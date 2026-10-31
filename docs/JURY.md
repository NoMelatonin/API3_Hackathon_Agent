# Jury: originale Airnode-Antworten im integrierten Produkt

Stand: 31.10.2026. Dieselbe Anwendung unter `/#/jury`; keine Versionsauswahl.

## Aktiver öffentlicher Nachweis

- Netzwerk **Base Sepolia**, Chain-ID **84532**.
- Integrierter Fonds: [`0x31b632b6b01d486c5c7081423950f4a6edd58728`](https://sepolia.basescan.org/address/0x31b632b6b01d486c5c7081423950f4a6edd58728).
- Neue Auszahlung **500 dUSD** an die feste simulierte NGO-Adresse: [erfolgreiche Transaktion](https://sepolia.basescan.org/tx/0x39a398293c0c6e4a9bfa5b6b1f47560798ca9545d458e856c1db15c71dad2b4a).
- [Öffentliches Deploymentmanifest](../deployments/integrated-base-sepolia.json), [zweites Bündnis](../deployments/integrated-base-sepolia-community.json), [vollständiger neuer Nachweis](../deployments/integrated-report.json).

Der neue Nachweis enthält Antrag, Reservierung, Auszahlung, Originaldateien, konkrete Simulationsblöcke und vier erwartete Reverts. Er ist kein historischer V1-/V2-Erfolg. NGOs und Mittel sind weiterhin simuliert/wertlos; die Airnode-Signaturen sind echt.

## Eigene Antwort im Browser

1. Betreiber startet `DISASTERDAO_PROFILE=testnet npm start`. Wer nur simulieren möchte, benötigt keinen NGO-Schlüssel. Testnet-Verbindungen verwenden keine synthetische Ersatzantwort.
2. Jury öffnen, Bündnis/Einsatz/registrierte NGO wählen. Echte originale JSON-Antwort hochladen. `data` und `timestamp` unverändert lassen.
3. **Direkt im Contract simulieren**: `accepted: true` bedeutet erfolgreicher `eth_call`, keine Reservierung und keine Auszahlung. Bei einem offenen Oracle-Antrag wird dessen Reservierung simuliert, sonst ein neuer Antrag.
4. Für vier Fälle zusätzlich eine echte alte Antwort und eine frische Originalantwort einer anderen Anfrage importieren. **Gültigen Fall und vier Ablehnungen prüfen** ausführen. Nur die unten genannten Contract-Reverts zählen; Netzwerk-/Backendfehler zählen nicht.
5. Für tatsächliche Zustandsänderungen in den NGO-Arbeitsbereich wechseln: Originaldatei beim Antrag importieren, Zweck/Beträge angeben, beim Reservieren eine noch gültige Originaldatei verwenden, dann separat abrufen. Der lokale Betreiber benötigt die privaten registrierten Testrollen. Die Simulation gibt der Jury keine zusätzlichen Förderrechte.

## CLI ohne Browserwallet

Einmal `npm run install:local` und `npm run contracts:build`. Für bezahlte Abrufe eigener `PAYER_PRIVATE_KEY` in privater `.env`, mit wertlosen Base-Sepolia-aUSD. Vorhandene Dateien werden nicht überschrieben.

```sh
DISASTERDAO_PROFILE=testnet npm run jury -- config
DISASTERDAO_PROFILE=testnet npm run jury -- fetch --out .runtime/jury-fresh.json
DISASTERDAO_PROFILE=testnet npm run jury -- simulate --file .runtime/jury-fresh.json --ngo 3
```

Für das zweite Bündnis zusätzlich `--organization community-alliance` verwenden.

Für die vier Fälle braucht die Gegenanfrage eine ebenfalls **frische** originale Signatur:

```sh
DISASTERDAO_PROFILE=testnet npm run jury -- fetch --other --out .runtime/jury-other.json
DISASTERDAO_PROFILE=testnet npm run jury -- tamper --file .runtime/jury-fresh.json --old fixtures/integrated/usgs-old.json --other .runtime/jury-other.json --ngo 3 --out .runtime/jury-tamper.json
```

Ist die erste Datei inzwischen älter als fünf Minuten, eine neue Datei beschaffen. Beim bestehenden ersten Fonds ist `fixtures/integrated/usgs-old.json` eine passende echte alte Antwort **nach seiner Aktivierung**. Bei einem neuen Fonds zuerst nach dessen Aktivierung eine Antwort holen und unverändert länger als 300 Sekunden altern lassen. Zeitstempel nicht umschreiben; auf öffentlichen Chains keine Uhr verstellen.

| Fall                      | Tatsächliche Prüfung                                                                    | Erwarteter Revert    |
| ------------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| Gültige originale Antwort | Richtiger Signierer, genaue Anfrage, frische Signatur, historischer Einsatz/Förderregel | kein Revert          |
| Datenwert verändert       | Alte Signatur passt nicht zu neuen Originalbytes                                        | `NotSignedByAirnode` |
| Echte alte Antwort        | Unveränderte gültige Signatur ist tatsächlich älter als 300 Sekunden                    | `OracleStale`        |
| Andere Anfrage            | Frische Originalantwort passt nicht zum festgelegten Anfragehash                        | `NotSignedByAirnode` |
| Unerwarteter Signierer    | Gültig geformte Signatur eines ausdrücklich fremden Testschlüssels                      | `NotSignedByAirnode` |

Die Signaturprüfung verwendet die **im Contract gespeicherten** Werte für Signierer und Anfrage, keine vom Upload vorgeschlagenen Vertrauensanker. Der Test für einen fremden Schlüssel ist absichtlich ein negativer synthetischer Angriff, kein Ersatz für Quelldaten.

## Tatsächlich beantragen, reservieren und abrufen

Mit den privaten registrierten Testrollen und laufendem lokalen Speicher:

```sh
DISASTERDAO_PROFILE=testnet npm run jury -- submit --file .runtime/jury-fresh.json --ngo 3
DISASTERDAO_PROFILE=testnet npm run jury -- reserve --application ANTRAGS-ID --file .runtime/jury-fresh.json --ngo 3
DISASTERDAO_PROFILE=testnet npm run jury -- claim --reservation RESERVIERUNGS-ID --ngo 3
```

Standard: 500 dUSD Antrag/Kapazität, keine externe Finanzierung, dokumentierter Jury-Testzweck. `submit` gibt die Antrags-ID zurück, `reserve` die Reservierungs-ID. Abgelaufene Signaturen durch neue **Originalantworten** ersetzen. Bereits geminte Aktionen zuerst anhand der ausgegebenen IDs prüfen; gleiche Antrags-ID mit gleichem Inhalt ist wiederholbar (`--request-id`). Neue Anträge sind neue Vorgänge innerhalb desselben kumulativen Restanspruchs.

Der vollständige Nachweislauf `jury prove --file … --old … --other … --ngo … --out …` führt nach den vier exakten Ablehnungen **wirkliche** Antrag-/Reservierungs-/Auszahlungsschritte aus. Bei Fortsetzung eines eröffneten Antrags dessen `--request-id` und ursprüngliche Datei über `--application-file` angeben. Kein zweites unabhängiges Förderbudget entsteht dadurch.

Der aktuelle Fonds hat bereits 500 dUSD an NGO 1 gezahlt; NGO 2/3 waren bei der Abnahme für Erstanträge offen. Vor jeder Vorführung aktuellen Zustand prüfen. Spätere Auszahlungen/Folgeförderung bleiben an Paketanteile, Abruffrist, Budget und Nachweissperren gebunden. Für eine vollständig frische Vorführung einen neuen Fonds unter neuem Manifestnamen deployen; [Einrichtung](v3/LOCAL.md).

[Originalantwort zur Antragseröffnung](../fixtures/integrated/usgs-valid.json) · [Originalantwort zur Reservierung](../fixtures/integrated/usgs-reserve.json) · [echte alte Antwort](../fixtures/integrated/usgs-old.json) · [echte andere Anfrage](../fixtures/integrated/usgs-other-reserve.json)
