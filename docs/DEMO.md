# Demo und Abgabe

## Nachgewiesener Stand

Echte USGS-Airnode-Antworten wurden über x402 bezahlt und sowohl off-chain als auch in Solidity geprüft. Der Fonds ist auf Base Sepolia aktiv. Eine reguläre und eine 2/3-Notfallzahlung wurden bestätigt. Die vier offiziellen Ablehnungen wurden als `eth_call` am echten Deployment geprüft, ohne Zahlungen auszulösen. Lokale Browsertests führen zusätzlich echte Transaktionen auf Anvil aus.

[Vorbereiteter Mitschnitt](../demo/DisasterDAO-demo.webm): **74,6 Sekunden**, 1280×900, ohne Ton, mit deutschen Texteinblendungen. Er zeigt den vollständigen lokalen Ablauf mit unveränderten echten signierten Fixtures und ausdrücklich historischer Chain-Uhr. Am Ende zeigt er die echte Base-Sepolia-Historie lesend. Die öffentliche Chain wird vom Recorder nicht verändert; NGO 3 bleibt dort offen. Dauer anhand der Container-Metadaten geprüft; Bildinhalt stichprobenartig visuell geprüft.

Für einen neuen Mitschnitt zunächst eine frische lokale Chain und einen frischen lokalen Fonds wie im README bereitstellen, den Devserver starten und `npx playwright install ffmpeg` einmal ausführen. Danach `npm run record-demo`. Der Recorder verwendet nur öffentliche Anvil-Testaccounts und stellt den lokalen Zustand anschließend wieder her. Unter anderen Betriebssystemen `CHROME_PATH` setzen.

## 150-Sekunden-Ablauf

| Zeit | Zeigen / sagen |
|---|---|
| 0–20 s | Gemeinsamer Pool, drei feste Empfänger, 1.000-dUSD-Grenze. Historisches Ereignis und fiktive Organisationen nennen. |
| 20–55 s | Nach Aktivierung frisch abgerufene USGS-Antwort einreichen. Signierte Magnitude entscheidet im Contract. Zahlung und Transaktion zeigen. |
| 55–110 s | Vier echte Ausgangsantworten mit jeweils getrenntem Fehler einreichen: Wert verändert, wirklich gealtert, andere Anfrage, fremder Schlüssel. Klar benennen, falls nur simuliert. |
| 110–135 s | Zwei getrennte Notfallgenehmigungen und dieselbe begrenzte Auszahlung; kein zweiter Anspruch über den Oracle-Pfad. |
| 135–150 s | USGS-Datenquelle vs. API3-Signierer, historische Simulation, keine Bedarfs- oder Verwendungsprüfung. |

Für eine neue vollständige Live-Demo einen **neuen Fonds** deployen, danach eine neue Antwort abrufen. Den bestehenden Fonds nicht zurücksetzen oder versteckte Administrationsrechte hinzufügen. Historische Fixtures können auf dem öffentlichen Testnet veraltet sein; ihre Signaturen oder Zeiten nicht ändern. Der originale alte Datensatz ist absichtlich als Alters-Negativfall enthalten.

## Jury ohne Wallet

Oberfläche starten, Jurybereich öffnen, originale JSON-Datei laden und „Im Contract simulieren“ wählen. Der Contract selbst entscheidet. Alternativ `npm run tamper`. Eine Simulation ist keine Zahlung. Für eine echte gültige Auszahlung wird eine eigene Wallet mit Base-Sepolia-ETH benötigt; der Empfänger bleibt eine feste Demo-NGO.

## Vor der Einreichung

- [ ] Offizielle Deadline nochmals prüfen: 31.10.2026, 15:00 MEZ.
- [x] Video auf höchstens 150 Sekunden begrenzen; 74,6 Sekunden gemessen, repräsentative Frames geprüft.
- [x] Lokalen Mitschnitt als lokale Simulation mit unveränderten echten signierten Daten kennzeichnen; Testnet-Transaktionen separat zeigen.
- [ ] Devfolio-Entwurf prüfen, Repository-Link und Contract-Adresse eintragen.
- [ ] Repository muss vor der Deadline öffentlich sein; am 30.10.2026 als **privat** geprüft. Sichtbarkeit nicht geändert.
- [ ] Anleitung von einer frischen Installation aus nachvollziehen; Datenabruf erfordert Test-aUSD.
- [ ] Keine `.env`, `.env.roles`, Wallet-Exporte oder privaten Belege hochladen.
- [ ] Devfolio tatsächlich absenden und den finalen Status prüfen.

Video-Upload und Devfolio-Abgabe sind noch nicht erfolgt. Dieser Entwurf stellt keine Einreichung dar.
