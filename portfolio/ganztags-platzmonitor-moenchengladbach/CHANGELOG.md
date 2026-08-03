# Changelog — Ganztags-Platzmonitor Mönchengladbach

## 2026-08-03 · Amtliche Gebietsgliederung und Rückrechnung

**Stadtbezirke jetzt aus amtlicher Quelle**

- `fetch_bezirke.py` (OpenStreetMap über Overpass) ersetzt durch
  `fetch_gebietsgliederung.py`: die Kleinräumige Gebietsgliederung der Stadt
  Mönchengladbach aus deren Geoportal, nachgewiesen über open.nrw. Shapefile
  in EPSG:25832, gelesen mit der Standardbibliothek (Shapefile- und
  dBASE-Format sind offen dokumentiert).
- Die vier Bezirke tragen jetzt ihre amtliche Nummer und Fläche; die Flächen
  summieren sich exakt auf die 170,47 km² des Stadtgebiets. Die Zuordnung
  aller 38 Standorte stimmt mit der bisherigen OSM-Zuordnung überein — beide
  Quellen bestätigen sich gegenseitig.
- Die separate Stadtgrenze entfällt: Die vier Bezirke kacheln das Stadtgebiet
  vollständig.
- Anlass: open.nrw war zuvor nur scheinbar nicht erreichbar — das Portal weist
  den Standard-User-Agent von curl ab. Mit explizitem UA liefert es eine
  CKAN-API, über die dieser Datensatz auffindbar ist.

**Rückrechnung der Trendfortschreibung**

- Neue Kennzahl im Überblick: Das Trendmodell wird auf 2012–2021 angepasst und
  sagt 2022–2025 voraus, ohne diese Jahre gesehen zu haben. Ergebnis: für 2025
  9.934 statt tatsächlich 11.022 Grundschülerinnen und Grundschüler (−9,9 %),
  mittlere absolute Abweichung 8,2 % über vier Jahre.
- Damit weist die Oberfläche selbst aus, was die Fortschreibung wert ist — und
  warum die Geburtsjahrgänge des Fachbereichs sie im Projekt ersetzen sollten:
  Wer 2029/30 eingeschult wird, ist längst geboren.

**Korrektur zur Landesdatenbank NRW**

- Die Aussage „keine offen skriptbare Schnittstelle" war falsch. Die
  Landesdatenbank betreibt eine GENESIS-2020-REST-API; das öffentliche Konto
  `GAST` kommt nur durch `helloworld/logincheck`, die Datendienste verlangen
  ein kostenloses registriertes Konto. Für einen Demonstrator ohne
  Zugangsdaten scheidet sie aus, im Projekt nicht. In beiden READMEs
  richtiggestellt.

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
