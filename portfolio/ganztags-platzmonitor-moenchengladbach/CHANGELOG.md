# Changelog — Ganztags-Platzmonitor Mönchengladbach

## 2026-08-03 · Erstveröffentlichung

**Datenpipeline**

- `fetch_msb.py`: MSB NRW Open Data — Schulverzeichnis, Schülerzahlen je Schule,
  Sozialindexstufen SJ 2025/26 und die Zeitreihe 2012–2025 für Mönchengladbach.
  Filter: Gemeindeschlüssel 05116000, Schulform 02, Schulbetrieb aktiv → 38
  Grundschulen, 11.022 Schülerinnen und Schüler. Telefon, Fax und E-Mail werden
  nicht übernommen.
- `fetch_kitas.py`: Open Data NRW — 186 Kindertageseinrichtungen in
  Mönchengladbach, ausschließlich Koordinate und Platzzahlen; Name, Träger,
  Adresse und Telefonnummer werden bereits beim Abruf verworfen.
- `fetch_bezirke.py`: OpenStreetMap über Overpass — die vier Stadtbezirke
  (Nord, Ost, Süd, West) und die Stadtgrenze, Douglas-Peucker-vereinfacht
  (~35 m). Drei Spiegel mit Backoff, leere Antworten gelten als Fehlschlag.
- `geo.py`: UTM-32-Rückrechnung nach WGS84 und Punkt-in-Polygon, stdlib-only.
- Snapshots zusammen unter 40 KB; `generate.py` ist deterministisch
  (zweimaliger Lauf → byte-identisches `data.js`, 27 KB).

**Modell**

- Kohortenfortschreibung: Jahrgangsstärke = Schülerzahl ÷ 4 (Schulen im Aufbau:
  ÷ Zahl der geführten Jahrgänge), Trend aus der MSB-Zeitreihe (2,5 % p. a.).
- Kapazität aus Fläche und Nutzung statt fester Gruppengrößen; fünf
  Raumannahmen und drei Nachfrageannahmen sind in der Oberfläche veränderbar.
- Voreinstellungen auf die öffentlich genannten Werte für 2026/27 kalibriert:
  Modell 2.049 Anspruchsplätze (öffentlich 2.000–2.100), 1.442 freie Plätze
  (öffentlich rund 1.380), 717 offene Plätze (öffentlich bis zu 720).
- Raumkennwerte, Bestandsquote und Maßnahmenliste sind gekennzeichnete
  Demo-Annahmen; ein eigener Regler stellt die Streuung des Raumbestands auf
  0 % und macht damit das Artefakt des rein proportionalen Modells sichtbar.

**Ansichten**

- Überblick (Bilanz je Ausbaustufe, Plausibilitätsanker, Zeitreihe 2012–2029,
  Lücke je Bezirk), Karte (SVG aus OSM-Grenzen, Ampellogik), Standorte
  (sortierbare Tabelle, Bezirksfilter, CSV-Export), Kapazitätsmodell (Regler,
  Formelanzeige, Sensitivität), Maßnahmen (kumulierte Wirkung, Tabelle),
  Kennzahlenblatt (druckbar, vollständiger Rechenweg je Standort).
- Drei Szenarien per Umschalter: Stufenplan bis 2029/30, Hohe Inanspruchnahme
  (+10 / +20 Prozentpunkte), Raumoptionen (mit gegen ohne Maßnahmen).

**Flow und Design**

- fetch → generate → publish; CI-Check
  `ganztags-platzmonitor-moenchengladbach-publish-check.yml` blockiert Merges
  mit veraltetem `docs/`. Landingpage-Karte und README-Bullet ergänzt.
- Gleiche Design-Systematik wie Schulbau-/Vergabe-Monitor (Petrol,
  Archivo/IBM Plex Mono, ⓘ-Glossar-Tooltips, Quellen-Link unter jeder Karte,
  mobile Tab-Leiste).
