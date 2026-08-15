# Changelog — Schulinvestitions-Monitor Duisburg

## 14.08.2026 — erste Fassung

Neuer statischer Demonstrator für das Amt für Schulische Bildung (Amt 40) der Stadt
Duisburg, gebaut aus dem Demo-Brief des Pitch-Dossiers.

**Datenpipeline**

- `fetch_msb.py` — Schulverzeichnis, Schülerzahlen, Sozialindexstufen und Zeitreihe des
  MSB NRW, gefiltert auf Gemeindeschlüssel 05112000. 135 Standorte mit aktivem
  Schulbetrieb, 71852 Schülerinnen und Schüler. Schulamt, ZfsL und Seminare sind
  ausgeschlossen — sie stehen unter denselben Schlüsseln im Register, sind aber keine
  Schulen.
- `fetch_startchancen.py` — bestätigte Teilnehmerliste (Gesamtliste beider
  Aufnahmegruppen) und Schulträgerbudgets Säule I, beide PDF. Stdlib-Textextraktion
  inklusive ToUnicode-CMap-Decoder für die CID-Schriften des Budget-PDF.
  48 Duisburger Startchancen-Schulen, Schulträgerbudget 60.0 m EUR.
  Verknüpfung über die Schulnummer statt über den Namen — die Teilnehmerliste lässt bei
  Förderschulen den Förderschwerpunkt weg, über den Namen blieben drei Schulen unverknüpft.
- `fetch_gebiete.py` — sieben Stadtbezirke vom ArcGIS-Dienst des Duisburger Geoportals,
  mit Douglas-Peucker von 9.340 auf 651 Stützpunkte vereinfacht. Das im Demo-Brief
  genannte Portal `opendata.duisburg.de` existiert nicht (kein DNS-Eintrag); das
  tatsächliche Portal der Stadt ist `opendata-duisburg.de`.
- `generate.py` — deterministische Aggregation zu `data.js` (60 KB). Anzeigenamen werden
  eindeutig gemacht: 37 Standorte heißen im Verzeichnis gleichlautend
  „Städt. Gem. Grundschule“, erst die Kurzbezeichnung trennt sie.

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
