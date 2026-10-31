# Umsetzung des integrierten Produkts

Stand: 31.10.2026. Dieses Dokument ersetzt die früheren getrennten V1/V2/V3-Bedienmodelle; [historische Architektur](../history/v3-IMPLEMENTATION.md).

## Übernommen, ersetzt, archiviert

- V3 liefert öffentliche Ansicht, NGO-Arbeitsbereich, privaten Speicher, externe Signaturimporte, Nachweise, Folgeanträge und Indexer.
- V1 liefert die echte API3-Verifikation, originale Jury-Dateien und vier getrennte Manipulationsprüfungen. Der alte direkte Notfalltransfer entfällt.
- V2 liefert fest gebundene USGS-/EONET-Anfragen, Originalfixtures und präzise Einheiten-/Gebietsprüfung. Kurven und separate Einsatzbudgets entfallen zugunsten der gemeinsamen Regel.
- Das synthetische Bedarfsmodell und frühere Oberflächen bestimmen keine aktive Förderhöhe. Historische Contracts/Regressionen bleiben nachvollziehbar; die Web-App importiert ausschließlich die integrierte Oberfläche.

## Geld und Quellen

`DisasterFundV3Auto` ist der aktive Fonds, mit den Nachweisregeln aus `DisasterFundV3`, eigenem unveränderlichem `V3OracleVerifier` und `SharedAllocation`. Neue öffentliche Deployments, keine Upgrades bestehender Adressen. Nur Anvil 31337 und Base Sepolia 84532; synthetische Policies auf öffentlichem Testnet verboten. Aktivierung benötigt die vollständige konfigurierte Initialfinanzierung.

Eine gemeinsame Runde verwaltet zwölf Paketanteile. Das Umwandeln eines vorläufigen Anteils in eine Abrufreservierung ändert `totalReserved` nicht. Auszahlung reduziert Reservierungen und erhöht `paidFor`; Freigabe abgelaufener Anteile gibt sie wieder frei. Externe Finanzierung wird pfadübergreifend geführt. Größere Anträge erhöhen kein Gewicht. Externe Rundensignaturen dürfen die im Contract berechneten Beträge nicht frei wählen.

Oracle-Antrag und Reservierung prüfen Originalsignatur und genaue Policy erneut. Die Signatur muss frisch und nach Aktivierung sein; Beobachtungszeit darf innerhalb des fest registrierten historischen Fensters liegen. `peak` steigt erst nach Auszahlung. Wiederholung einer Antrags-ID bindet denselben unveränderlichen Inhalt; Wechsel des Pfades umgeht weder Geldgrenzen noch Nachweissperren.

Externe 2/3-Freigabe ersetzt nur die Oracle-Grundlage. Sie bindet Antrag/Quelle/Zweck und dieselbe Runde. Gruppen für Daten, Nachweise und Einspruch sind getrennt. `COVERAGE` ist jetzt ebenfalls on-chain gebunden und höchstens eine Stunde gültig; beide Pfade lesen denselben Unsicherheitsstatus.

## Anwendung und Betrieb

Die internen Pfade `/api/v3` und `src/v3` bleiben aus Kompatibilität erhalten. Im Produkt gibt es keine Versionswahl. Alte Query-Parameter werden entfernt; Öffentlichkeit, NGO und Jury teilen dieselbe Anwendung. Ein CLI und die Browser-Jury unterstützen eigene Originaldateien; negative Fälle laufen direkt gegen `automaticSubmit` per `eth_call`.

Die Testnet-Anbindung verwendet eigene private Rollen, tatsächliche Chain-ID-Prüfung und überprüfte öffentliche Deploymentmanifeste. Lokale Anvil-Schlüssel gelangen nicht auf Base Sepolia. API-Zahlung verwendet das vorhandene x402-Test-aUSD-Verfahren; echte Antworten werden kurzzeitig unverändert wiederverwendet. Keine synthetische Ersatzantwort bei Fehlern.

PostgreSQL und privater AES-GCM-Dateispeicher bleiben lokal. Namensräume binden Profil/Chain, Manifest und Bündnis. Transaktionen und DB-Änderungen sind nicht atomar; Idempotenz, genaue Calldata-Wiedererkennung und Indexer-Abgleich rekonstruieren erfolgreiche Vorgänge. Der bestätigte Index und Fondskennzahlen beziehen sich auf denselben Block. Bei Reorgs werden verwaiste Logs entfernt.

[Fund](../../contracts/DisasterFundV3Auto.sol) · [Allokator](../../contracts/SharedAllocation.sol) · [Chain/Deployment](../../src/v3/chain.ts) · [Service](../../server/service.ts) · [Jury](../../server/jury.ts) · [Speicher](../../server/store.ts)

## Reproduzierbarer Contract-Build

Partielle Forge-Läufe mit unterschiedlichen Abhängigkeitsmengen können bei via-IR andere ausführbare Artefakte erzeugen. `npm run contracts:build` erzwingt bei Änderungen einen vollständigen Graph-Build und hält die vier App-Artefakte getrennt unter `out/integrated`. Quell-/Konfigurationshashes und Artefakthashes verhindern die Verwendung veralteter oder durch Testläufe ersetzter Dateien. Start, Deployment, Jury und Verifikation verwenden dieselben Artefakte. [Builder](../../scripts/build-contracts.mjs), [Quell-/Buildnachweis](../../deployments/integrated-build.json).

Die Runtime-Prüfung bleibt streng: Nur Compiler-Metadaten und bekannte unveränderliche Werte werden beim Codevergleich ausgenommen; Token, Operator, Finanzierungsziel, Verifier, Allokator, Rollen und Policies werden separat gegen die Chain geprüft. Der kanonische vollständige Build reproduziert beide bereits deployten öffentlichen Fonds; es wurde keine Abweichung durch eine gelockerte Prüfung kaschiert.

## Prüfgrenze

Lokale Tests können Rollen, Reorgs und Zeitablauf simulieren. Sie beweisen keine institutionelle Unabhängigkeit und ersetzen keine neue öffentliche Auszahlung mit echten Airnode-Daten. Der tatsächliche aktuelle Nachweis steht ausschließlich im [Prüfbericht](VERIFICATION.md). Keine Produktivfreigabe oder belegte humanitäre Wirkung.
