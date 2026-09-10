# Changelog — Anlagen- und Fristenmonitor BDH

## 2026-09-10 · Erstveröffentlichung

- Datenpipeline: PRTR 2024 (40 Einrichtungen BDH, Namen entfernt), EU-Registry
  (68 Betriebe / 84 Zeilen, Bundesland NW, Hagen exakt), ISA 2024, 44. BImSchV
  ohne Personennamen, Geobasis-WFS der drei Städte. Snapshots unter `data/sources/`.
- Zwei Register in `window.KANDUIT_BDH`: 144 MFA (◈) und 68 IED-Betriebe.
  Eine gemeinsame `anlagen[]`-Liste gibt es nicht. `data.js` 79.112 Bytes.
- Ansichten: Überblick mit Leitzahl 106 (jährliche Nachweise, Frist 01.01.2025),
  80 Anlagen mit verpasstem Nachweis daneben, Berichtsauszug 233 Termine bei 160 Plätzen.
  Register mit Dual-Karte, Fristenkalender, Risikoeinstufung (ein Gewichtsobjekt),
  Daten & Methode mit Registerabgleich 2.030 ≠ 68 ≠ 40 ≠ 144 und Gegenprobe MAPE 3,9 %.
- Publish-Flow + CI-Check `anlagen-fristenmonitor-bdh-publish-check.yml`,
  Landingpage-Karte. Gleiche Design-Systematik wie Schulbau-/Vergabe-Monitor
  (Petrol, Archivo/IBM Plex Mono, ⓘ-Glossar-Tooltips, Quellen-Link unter jeder
  Karte, mobile Tab-Leiste).
