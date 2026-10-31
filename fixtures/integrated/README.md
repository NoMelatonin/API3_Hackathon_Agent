# Originale Airnode-Antworten der Integration

Alle JSON-Dateien in diesem Ordner enthalten echte originale Airnode-Antworten. Insbesondere `data`, `timestamp`, `signature`, `airnode` und `requestHash` wurden nicht geändert, um Prüfungen zu umgehen.

- `usgs-old.json`: nach Aktivierung des neuen Fonds beschafft und tatsächlich unverändert gealtert.
- `usgs-valid.json`: Original zur erfolgreichen Eröffnung des Antrags.
- `usgs-reserve.json`: neue Originalantwort zur späteren Reservierung desselben Antrags und zu den vier Contract-Tests.
- `usgs-other-reserve.json`: frische Originalantwort einer anderen Anfrage für den getrennten Request-Test.
- `usgs-other.json`: frühere originale Gegenanfrage; nicht die im endgültigen Vier-Fälle-Bericht verwendete Datei.
- `eonet-current.json`: neue echte EONET-Antwort, im integrierten öffentlichen Fonds per `eth_call` akzeptiert.

Diese Dateien sind heute keine unbegrenzt frischen Antworten. Für neue Live-Aufrufe neue Dateien beschaffen. Die protokollierten Simulationsblöcke erlauben historische Reproduktion ohne veränderte Bytes oder Zeitstempel. [Auszahlungsnachweis](../../deployments/integrated-report.json), [EONET-Prüfung](../../deployments/integrated-eonet-check.json), [Jury](../../docs/JURY.md).
