# DisasterDAO — Entwurf für Devfolio

## Kurzbeschreibung

Ein gemeinsamer NGO-Notfallfonds verbindet vorab vereinbarte Budgets mit signierten Ereignisdaten. Ein Smart Contract authentifiziert eine echte AirnodeHub-Antwort und gibt begrenzte Soforthilfe frei. Wenn Daten fehlen, können zwei von drei benannten Verantwortlichen denselben begrenzten Anspruch manuell freigeben.

## Problem und Zielgruppe

Die Hypothese: Unabhängige Hilfsorganisationen und Geldgeber möchten Mittel vorab bereitstellen und die Freigaberegeln gemeinsam kontrollieren. Einzelne Fondsbetreiber sollen weder Regeln unbemerkt ändern noch hinterlegte Mittel allein abziehen können. Wiederholte Abstimmungen und verstreute Nachweise können die Koordination erschweren. Diese Hypothese ist bisher nicht mit NGOs validiert; zentrale Fonds mit signierten Freigaben bleiben eine ernsthafte Alternative.

## Was gebaut wurde

Ein Base-Sepolia-Prototyp mit einem vollständig finanzierten 3.000-dUSD-Pool, drei fiktiven NGO-Empfängern und je einem Anspruch von 1.000 dUSD. Der erste Pfad authentifiziert eine echte, über x402 bezahlte AirnodeHub-Antwort zum historischen Türkei-Erdbeben vom 06.02.2023. Der zweite benötigt zwei getrennte Zustimmungen des Notfallgremiums zu Empfänger und Begründung. Beide Pfade teilen Anspruch und Budget. Eine React-Oberfläche zeigt Regeln, Poolstand, Freigaben und Zahlungen. CLI-Skripte erlauben der Jury eigene Einreichungen und sämtliche Manipulationstests.

## Warum die signierten Daten wesentlich sind

Ohne Authentifizierung könnte ein Relayer die Magnitude erhöhen oder eine andere Anfrage einschleusen, um hinterlegte Mittel freizugeben. Der Contract verwendet die ursprünglichen signierten Bytes, den festgelegten Airnode, den unabhängig berechneten Anfragehash und getrennte Zeitprüfungen. Ein Wert aus genau diesen Bytes steuert eine tatsächliche dUSD-Auszahlung. Die API ist keine dekorative Anzeige.

Der reguläre Pfad akzeptiert Magnitude ≥ 7,0, `reviewed`, das festgelegte Ereignis, Ereignistag und Region. Diese Schwelle ist eine Demo-Regel und keine wissenschaftliche Katastrophendefinition. Die manuelle Ausnahme ist ausdrücklich ein menschlicher Vertrauenspfad und kein Oracle-Nachweis.

## Nachweise

Fonds: `0x8b1cad09c9be9d2e1ff38f4a490951bc1a317257`, Base Sepolia (84532).

- Echte Oracle-Auszahlung: https://sepolia.basescan.org/tx/0x1eb9c1960f8e73779709f0021438f1b24692e671b8c7f6b322f5fcb0001accd1
- Notfall-Auszahlung: https://sepolia.basescan.org/tx/0xce84643833c8529aa502befe4edbde47d9f599e02c3f83eb0b070074fbed3242
- Alle vier Manipulationsfälle am deployten Contract über `eth_call` abgewiesen; Bericht im Repository unter `deployments/tamper-report.json`.
- 17 TypeScript-, 29 Solidity- und vier Browsertests bestanden; inklusive gemischter Auszahlungspfade, Wiederholungen, Zeitgrenzen, ungültiger Daten und fehlgeschlagener Transfers.

## Vertrauensmodell und Grenzen

Die Organisationen vertrauen USGS als Datenquelle, dem API3-Airnode als Signierer sowie den vorab gewählten Regeln. Die Signatur bestätigt Herkunft und Integrität einer konkreten Antwort, nicht ihre sachliche Richtigkeit. Naturgefahr bedeutet nicht automatisch humanitären Bedarf. Ein NGO-Transfer beweist weder Hilfsgüterlieferung noch angemessene Verteilung. Der Prototyp verwendet ausschließlich Testmittel und simulierte Organisationen. Die getrennten Demo-Schlüssel liegen noch bei einer Person; echte organisatorische Unabhängigkeit wird nicht behauptet.

Es gibt keine echten NGO-Partner, keine geprüfte Bedürftigkeit, keine automatische Belegbewertung und keine Spendenbescheinigung. Die Notfallfreigabe erzwingt keine spätere externe Prüfung und löst keinen Chain-Ausfall. Es wird kein autonomer Agent-Bonus beansprucht.

## Gewünschte Daten, die im MVP fehlen

Ein geeigneter Ereignisendpunkt war verfügbar. Was darüber hinaus benötigt wird und für diesen Prototyp nicht integriert wurde: verifizierbarer lokaler Hilfsbedarf, organisationsübergreifende Bedarfszuordnung und belastbare Nachweise tatsächlicher Mittelverwendung. Wir behaupten nicht, den gesamten AirnodeHub-Katalog auf das Fehlen dieser Daten geprüft zu haben.

## Nächster Validierungsschritt

Mit drei bis fünf Fonds-, NGO- und Einsatzverantwortlichen vergangene Freigabefälle rekonstruieren und denselben Ablauf mit einer zentralen, signierten Datenbank vergleichen. Erst danach institutionelle Rollen, produktive Auszahlungskanäle und Nachprüfung entwickeln.
