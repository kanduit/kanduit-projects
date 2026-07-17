# Changelog — Vergabe-Monitor Düsseldorf

## 2026-07-17 · Rechtsstand aktualisiert

Anlass: Das **Vergabebeschleunigungsgesetz** ist zum 01.07.2026 in Kraft getreten.

- **VergStatVO-Meldeschwelle** überall korrigiert: von „ab 25.000 €" auf „über 50.000 €
  netto (seit 01.07.2026; zuvor 25.000 €)". Betrifft Melde-Radar (index.html), METRIC_INFO
  `radar_frist` (app.js), README.de.md/README.md. 60-Tage-Frist unverändert.
- **Direktauftrag-Ansicht entschärft:** Die „50-T€-Direktauftragsgrenze" ist die Regel der
  Landesverwaltung und bindet Kommunen seit § 75a GO NRW **nicht** automatisch — maßgeblich
  ist die eigene Vergabeordnung. Eyebrow, Intro, Monatsreihen-/VEAT-Marker und METRIC_INFO
  entsprechend umformuliert; irreführender „01.02.2026"-Marker entfernt.
- **Hinweis auf Schwellenbruch** ergänzt (Vergabestatistik 25→50 T€, Wettbewerbsregister
  30→50 T€): künftige Zeitreihen zeigen ab Q3 2026 einen Bruch. Das Datenfenster endet
  weiterhin im letzten vollen Quartal (Q2 2026) — keine unvollständigen Julimonate.
- Datenstand unverändert (Abruf 14.07.2026); reine Text-/Label-Korrektur, `data.js` unberührt.

## 2026-07-14 · Erstveröffentlichung

Demonstrator aus rein öffentlichen eForms-Bekanntmachungsdaten, gebaut als
artefakt-getriebenes Follow-up für die Zentrale Vergabestelle (Amt 30/4).

- **Datenpipeline:** `scripts/fetch_notices.py` lädt die monatlichen CSV-Exporte der
  OpenData-API des Bekanntmachungsservice (2024-01 … 2026-07) und filtert auf
  Erfüllungsort DEA11/DEA23/DEA13/DEA52; nur gefilterte Snapshots (~200 KB/Monat)
  liegen im Repo. `scripts/generate.py` aggregiert zu `data.js` (~66 KB).
  Zuschlagsempfänger-Namen werden nicht verarbeitet.
- **Fünf Ansichten:** Überblick (Quartale, Verfahrensmix, CPV, Vergabestellen),
  Verfahrensdauern (Median je Vergabeart, Abdeckung ehrlich ausgewiesen),
  Direktauftrag 2026 (§ 75a GO NRW / 50-T€-Grenze, Hinweis-Banner zur
  Sichtbarkeitslücke), Benchmark NRW (je 100.000 Einwohner, IT.NRW-Zahlen),
  Melde-Radar (schematisch, simulierte 60-Tage-VergStatVO-Fristen).
- **Publish-Flow:** `scripts/publish.py` (+ `--check`) synchronisiert die vier
  statischen Dateien nach `docs/vergabe-monitor-duesseldorf/`; CI-Check
  `vergabe-publish-check.yml` blockiert Merges mit veraltetem `docs/`.
- Gleiche Design-Systematik wie Schulbau-Monitor (Petrol, Archivo/IBM Plex Mono,
  ⓘ-Glossar-Tooltips, Quellen-Link unter jeder Karte, mobile Tab-Leiste).
