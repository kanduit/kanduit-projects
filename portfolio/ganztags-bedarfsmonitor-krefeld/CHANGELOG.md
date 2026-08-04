# Changelog — Ganztags-Bedarfsmonitor Krefeld

## 2026-08-04 · Erstveröffentlichung

**Datenpipeline** (fünf Fetch-Skripte, stdlib-only, Snapshots zusammen rund 110 KB):

- `fetch_bevoelkerung.py` — kleinräumige Bevölkerungsdaten der Stadt Krefeld
  (FB 312 Statistik und Wahlen), 45 statistische Bezirke × 13 Jahre (2012–2024),
  Spalten `BEV_001`–`BEV_004` (gesamt, u3, 3–<6, 6–<10). Ressourcen-URLs werden
  über die CKAN-API von open.nrw aufgelöst. Geschlechts- und Feinaltersgliederung
  wird verworfen. → 38 KB
- `fetch_gebiete.py` — amtliche Gebietsgliederung: 5 Stadtbezirke (politisch, seit
  01.11.2025 statt zuvor neun), 19 Stadtteile (statistisch), 45 statistische
  Bezirke. Shapefile und dBASE mit der Standardbibliothek gelesen, Ringe mit
  Douglas-Peucker auf 25 m vereinfacht, EPSG:25832 → WGS84. Zuordnung
  Stadtteil → Stadtbezirk geometrisch über den Schwerpunkt. → 44 KB
- `fetch_msb.py` — Schulverzeichnis NRW (Gemeindeschlüssel 05114000, Schulform 02,
  in Betrieb): 32 Grundschulen mit Koordinate, Schülerzahl und Sozialindexstufe,
  dazu die Zeitreihe für Kreis 114. → 13 KB
- `fetch_kitas.py` — 108 Kindertageseinrichtungen in Krefeld (Open Data NRW).
  Einrichtungsnamen, Träger, Adressen und Telefonnummern werden bereits beim
  Abruf verworfen; im Snapshot stehen nur Koordinate und Platzzahlen. → 7 KB
- `fetch_ogsbericht.py` — Kennzahlen aus dem OGS-Bericht der Stadt Krefeld
  (Januar 2026). Der Bericht ist eine PDF-Publikation; die Werte sind mit
  Tabelle/Abbildung und Seite belegt abgeschrieben, und das Skript prüft den
  SHA-256-Hash des Dokuments, damit die Zahlen nicht stillschweigend veralten.
  → 4 KB

**Modell** (`generate.py`, deterministisch, `data.js` 48 KB):

- Nachfrage aus dem Melderegister statt aus einer Prognose: Alle Kinder, die bis
  2029/30 eingeschult werden, sind bereits geboren. Zwischen den drei
  Altersblöcken wird interpoliert, danach mit einer **gemessenen**
  Wanderungsrate von 1,90 % je Altersjahr auf das Grundschulalter fortgeschrieben.
- Die Wanderungsrate ist nicht angenommen: Dieselben Geburtsjahrgänge werden in
  einem späteren Altersblock wiedergefunden (10 bzw. 9 Jahrgangspaare).
- Zwei Prüfungen im UI ausgewiesen: Rückrechnung mit Fit auf 2012–2018 und
  ungesehenen Zieljahren (MAPE 1,74 %) sowie Abgleich mit einer fremden Quelle
  (Melderegister 6–<10: 9.293 gegen MSB-Grundschülerzahl 9.062, Abweichung 2,5 %).
- Angebot aus Tabelle 4-1 des OGS-Berichts (Ist bis 2024/25, Ausbauplanung bis
  2027/28, danach Fortschreibung mit 15 Gruppen bzw. 375 Plätzen pro Jahr).
- Quoten aus veröffentlichten Werten: Anspruchsjahrgänge 95 % (Elternbefragung
  der Stadt, Juni 2024), übrige Jahrgänge 61,5 % (Ganztagsquote 2025/26).
- Verteilung der stadtweiten Plätze auf die Standorte nach Schülerzahl × OGS-Quote
  je Sozialindex (Abb. 4-1) — als **Demo-Annahme** ausgewiesen, weil die Platzzahl
  je einzelner Schule nicht offen vorliegt.
- 15 der 17 im Bericht genannten Küchen- und Mensa-Standorte auf Schulnummern
  abgebildet; die übrigen sind Förderschulen im Primarbereich.

**Ansichten** (sechs Tabs, globaler Umschalter für Ausbaustufe und Szenario):

Überblick, Karte (Ampel je Standort), Bezirke (5 politische Stadtbezirke oder 19
statistische Stadtteile, sortierbar, CSV-Export mit Provenienz-Kopf), Szenarien
(Stufenplan, Ausbaupfad mit Zielerreichungsjahr, hohe Inanspruchnahme),
Deckungsgradrechner (alle Annahmen als Regler, Wirkung je Ausbauschritt,
Mensa-Maßnahmen der Stadt) und Kennzahlenblatt je Schule mit vollständigem
Rechenweg und Herkunftsnachweis, druckbar als Anlage zur Fortschreibung des
OGS-Berichts.

**Ehrlich benannte Lücken** — im UI, nicht nur im README: Platzzahl je Schule,
fehlende Schuleinzugsbereiche (Bedarf folgt dem Wohnort, Kapazität dem Schulort),
jahrgangsscharfe Geburtszahlen je Bezirk, kommunaler Grundschulsozialindex je
Schule, sowie Personal-, Raum- und Mensenkapazitäten als nicht modellierter
Engpass.

**Flow und Design:** fetch → generate → publish (docs/-Sync) mit CI-Check
`ganztags-bedarfsmonitor-krefeld-publish-check.yml`, Landingpage-Karte ergänzt.
Gleiche Design-Systematik wie Schulbau-/Vergabe-Monitor (Petrol, Archivo/IBM Plex
Mono, ⓘ-Glossar-Tooltips, Quellen-Link unter jeder Karte, mobile Tab-Leiste).
