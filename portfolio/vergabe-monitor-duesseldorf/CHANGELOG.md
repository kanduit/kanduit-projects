# Changelog — Vergabe-Monitor Düsseldorf

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
