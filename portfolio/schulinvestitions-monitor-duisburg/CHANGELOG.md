# Changelog — Schulinvestitions-Monitor Duisburg

## 16.08.2026 — Städtevergleich, Leitzahl, Druckbereich

Nachgezogen aus dem Abgleich mit den bereits gebauten Demonstratoren.

- **Vergleich der kreisfreien Städte.** Das Schulträgerbudget-PDF enthält alle NRW-Träger,
  nicht nur Duisburg — ausgewertet werden jetzt alle 22 kreisfreien
  Städte, normiert auf die Schülerzahl aus der MSB-Zeitreihe. Verknüpft über den
  Kreisschlüsseltext „Krfr. Stadt …“, der in beiden Quellen identisch ist; keine Zuordnung
  nach Namen, keine zusätzliche Quelle. **Duisburg liegt auf Rang 5 von
  22** mit 836 € je Schülerin und Schüler
  gegenüber einem Median von 681 €. Damit ist die Aussage
  „überdurchschnittlich stark im Startchancen-Programm vertreten“ belegt statt behauptet.
- **Leitzahl.** Statt vier gleich großer Kennzahlen führt der Überblick jetzt eine Zahl:
  den kleinsten jährlichen Eigenanteil, bei dem die 60,0 Mio € aus Säule I bis
  2034 noch vollständig abgerufen werden. Gerechnet unter der bestmöglichen
  Reihenfolge — damit eine harte Untergrenze, keine Prognose.
- **Druckbereich.** „Drucken / PDF“ gibt nur noch die aktive Ansicht aus, bei geöffnetem
  Kennzahlenblatt ausschließlich dieses. Vorher wanderten alle sechs Ansichten in die PDF.
- Geldbeträge einheitlich mit einer Nachkommastelle („60,0 Mio €“ statt „60 Mio €“).

## 14.08.2026 — erste Fassung

Neuer statischer Demonstrator für das Amt für Schulische Bildung (Amt 40) der Stadt
Duisburg, gebaut aus dem Demo-Brief des Pitch-Dossiers.

**Datenpipeline**

- `fetch_msb.py` — Schulverzeichnis, Schülerzahlen, Sozialindexstufen und Zeitreihe des
  MSB NRW, gefiltert auf Gemeindeschlüssel 05112000. 135 Standorte mit aktivem
  Schulbetrieb, 71.852 Schülerinnen und Schüler. Schulamt, ZfsL und Seminare
  sind ausgeschlossen — sie stehen unter denselben Schlüsseln im Register, sind aber keine
  Schulen.
- `fetch_startchancen.py` — bestätigte Teilnehmerliste (Gesamtliste beider
  Aufnahmegruppen) und Schulträgerbudgets Säule I, beide PDF. Stdlib-Textextraktion
  inklusive ToUnicode-CMap-Decoder für die CID-Schriften des Budget-PDF.
  48 Duisburger Startchancen-Schulen, Schulträgerbudget 60,0 Mio €.
  Verknüpfung über die Schulnummer statt über den Namen — die Teilnehmerliste lässt bei
  Förderschulen den Förderschwerpunkt weg, über den Namen blieben drei Schulen unverknüpft.
- `fetch_gebiete.py` — sieben Stadtbezirke vom ArcGIS-Dienst des Duisburger Geoportals,
  mit Douglas-Peucker von 9.340 auf 651 Stützpunkte vereinfacht. Das im Demo-Brief
  genannte Portal `opendata.duisburg.de` existiert nicht (kein DNS-Eintrag); das
  tatsächliche Portal der Stadt ist `opendata-duisburg.de`.
- `generate.py` — deterministische Aggregation zu `data.js`. Anzeigenamen werden eindeutig
  gemacht: 37 Standorte heißen im Verzeichnis gleichlautend „Städt. Gem. Grundschule“,
  erst die Kurzbezeichnung trennt sie.

**Ansichten**

Überblick, Standortkarte, Standortregister, Priorisierungsmodell, Eigenanteils-Zeitachse
und Szenarien; dazu ein druckbares Kennzahlenblatt je Standort mit Quelle, Stand und
Rechenweg zu jeder Zahl.

**Trennung echt / angenommen**

Fünf Größen liegen nicht offen vor und sind als Demo-Annahme gekennzeichnet: Bauzustand,
Maßnahmenkosten, Ganztagsquote, OGS-Bestand und genehmigte Zügigkeit. Sie sind in
`generate.py` begründet und tragen in der Oberfläche durchgängig ein ◈ mit dem
vollständigen Begründungstext. Das Schulbetriebsdatum wird bewusst nicht als
Baujahr-Ersatz verwendet — es steht für 101 der 135 Standorte auf 1973, dem
Aufbau des Registers.
