<p align="center">
  <img src="assets/kanduit-logo.png" alt="Kanduit" width="80" />
</p>

<h1 align="center">Brückenmonitor NRW</h1>
<p align="center"><strong>Infrastruktur-Risikoüberwachung für Nordrhein-Westfalen</strong></p>
<p align="center">
  Fragmentierte Prüfdaten werden zu handlungsfähigen Infrastrukturprioritäten —<br/>
  damit Entscheidungsträger wissen, <em>welche Brücken zuerst Aufmerksamkeit brauchen</em>, bevor das nächste Leverkusen passiert.
</p>

---

> **English Version:** [README.md](README.md)

## Das Problem

Nordrhein-Westfalen unterhält rund **15.000 Straßenbrücken**, viele davon in den 1960er und 70er Jahren während des Wirtschaftswunders erbaut. Diese Bauwerke wurden für eine Lebensdauer von 60 Jahren und deutlich geringere Verkehrsbelastungen konzipiert, als sie heute tragen.

Die **A1-Rheinbrücke bei Leverkusen** wurde zum nationalen Symbol dieser Krise: 2012 gewichtsbeschränkt, jahrelang teilgesperrt, verantwortlich für geschätzte **2 Milliarden Euro wirtschaftlichen Schaden** allein durch umgeleiteten Güterverkehr. Doch Leverkusen war kein Einzelfall — es war lediglich die erste Brücke, die öffentlich versagte.

Das zugrunde liegende Datenproblem ist ebenso gravierend: Bauwerksprüfungen nach DIN 1076 erzeugen **Zustandsnoten von 1,0 bis 4,0**, doch diese existieren als isolierte PDFs und fragmentierte Datenbanken. Es gibt kein einheitliches System, das Bauwerkszustand, Verkehrsbelastung, wirtschaftliche Auswirkungen und satellitengestützte Bodenbewegungen in einer **einzigen Priorisierungsansicht** zusammenführt.

## Die Folgen des Nichthandelns

| Risiko | Konsequenz |
|---|---|
| **Öffentliche Sicherheit** | Strukturversagen gefährdet Menschenleben — Leverkusen erforderte Notsperrungen |
| **Wirtschaftliche Kosten** | Brückensperrungen erzwingen Umwege, die Millionen pro Tag an Frachtverzögerungen kosten |
| **Rechtliche Haftung** | Nach deutschem Recht haften Straßenbaulastträger persönlich für bekannte Mängel (Verkehrssicherungspflicht) |
| **Kaskadeneffekt** | Überlastete Umleitungsbrücken beschleunigen den Verfall alternativer Strecken |
| **Politisches Risiko** | Infrastrukturversagen untergräbt das Vertrauen der Öffentlichkeit in die staatliche Daseinsvorsorge |

## Unsere Lösung

Der **Brückenmonitor NRW** ist ein integriertes Risiko-Dashboard, das:

- **Alle ~15.000 Brücken** auf einer interaktiven Karte visualisiert, farbcodiert nach Risiko-Score
- **Die 50 kritischsten Brücken** anhand eines transparenten, gewichteten Bewertungsmodells einstuft
- **Detailansichten** für jede Brücke bietet: Prüfungshistorie, Verkehrsaufkommen und satellitengestützte Bodenbewegung (InSAR)
- **Filterung** nach Straßenklasse, Zustandsnote, Baujahrzehnt und Risikoschwelle ermöglicht
- **Vollständig im Browser läuft** — kein Server, keine Installation, keine IT-Abteilung erforderlich

### Das Risikomodell

Jede Brücke erhält einen zusammengesetzten Score (0–1) basierend auf fünf gewichteten Faktoren:

```
Risiko-Score = 0,30 × Zustandsnote (DIN 1076)
             + 0,20 × Alter über Entwurfslebensdauer
             + 0,20 × Verkehrslast-Verhältnis (Ist vs. Soll)
             + 0,15 × Strukturelle Redundanz (Einfeldträger = höheres Risiko)
             + 0,15 × Wirtschaftliche Umwegkosten (Auswirkung bei Sperrung)
```

Dieses Modell ist bewusst **transparent und nachprüfbar** — jede Gewichtung und jeder Input ist sichtbar, kein Black-Box-ML-Modell. Gewichtungen können von Fachexperten angepasst werden.

## Live-Demo

Dashboard im Browser öffnen:

```bash
cd nrw-bridge-dashboard
python -m http.server 8000
# Dann http://localhost:8000 öffnen
```

Oder `index.html` direkt öffnen (Hinweis: manche Browser blockieren lokale AJAX-Anfragen; der HTTP-Server ist zuverlässiger).

**Funktionen im Überblick:**
- Interaktive Karte mit Marker-Clustering bei niedrigen Zoomstufen
- Farblegende: grün (geringes Risiko) → gelb → orange → rot (kritisch)
- Seitenleiste mit Top 50 der kritischsten Brücken
- Klick auf eine Brücke zeigt Prüfungshistorie und InSAR-Diagramme
- Filterleiste für Straßenklasse, Zustandsnote, Baujahrzehnt und Mindest-Risikoscore

## Technische Architektur

### Databricks-Lakehouse-Ansatz

Im Produktivbetrieb wird dieses System durch ein **Databricks Lakehouse** mit Medaillon-Architektur angetrieben:

```
Bronze (Roh)              Silver (Bereinigt)          Gold (Analytik)
────────────              ──────────────────          ───────────────
BASt SIB-Bauwerke      →  Standardisierte Noten   →  Risiko-Scores
Straßen.NRW Verkehr    →  Vereinheitlichte Daten  →  Top-N-Rankings
OpenStreetMap          →  Geokodierte Brücken     →  Karten-GeoJSON
Haushaltsplan NRW      →  Budgetzuordnungen       →  Kosten-Nutzen-Analyse
Copernicus InSAR       →  Verschiebungsreihen     →  Anomalie-Flags
```

**Delta Lake** gewährleistet eine vollständige Änderungshistorie (Time Travel) jeder Zustandsbewertung — entscheidend für die rechtliche Nachvollziehbarkeit nach dem Straßenverkehrsrecht.

### Datenquellen

| Datenquelle | Typ | Verfügbarkeit |
|---|---|---|
| BASt-Brückendatenbank (SIB-Bauwerke) | Zustandsbewertungen, Bauwerkstyp, Alter | Teilweise offen / per IFG anfragbar |
| Straßen.NRW Verkehrszählungen | DTV (durchschnittlicher täglicher Verkehr) | Open-Data-Portal |
| OpenStreetMap | Brückenstandorte, Straßennetz | Offen |
| Haushaltsplan NRW | Instandhaltungsbudgets nach Straßenkategorie | Veröffentlichtes PDF → geparst |
| Copernicus Sentinel-1 SAR | InSAR-Verschiebungsüberwachung | Offen (ESA) |

### Branchenreferenzen

- **Google DeepMind** kooperiert mit Infrastrukturbehörden zur Anwendung von ML auf die Bauwerksüberwachung. Wir verfolgen einen einfacheren, aber produktionsreifen Ansatz: Anomalieerkennung auf InSAR-Zeitreihendaten.
- **Palantirs** Arbeit mit dem US Army Corps of Engineers im Infrastruktur-Asset-Management ist ein direktes Analogon — Verknüpfung von Prüfungs-, Finanz- und Nutzungsdaten zu einem einzigen Priorisierungsmodell.
- **Databricks Delta Lake** gewährleistet vollständige Änderungshistorie (Time Travel) jeder Zustandsbewertung, entscheidend für rechtliche Nachvollziehbarkeit.

## Projektstruktur

```
nrw-bridge-dashboard/
├── index.html              # Dashboard (Single-Page-Anwendung)
├── css/style.css           # Dashboard-Styles
├── js/
│   ├── app.js              # Datenladung & Event-Koordination
│   ├── map.js              # Leaflet-Karte mit Clustering
│   ├── charts.js           # D3-Prüfungs- & InSAR-Diagramme
│   └── filters.js          # Filter-Steuerung
├── data/
│   ├── bridges.geojson     # Alle ~15.000 Brücken mit Eigenschaften
│   └── top50.json          # Vorberechnete Top-50-Kritischliste
├── assets/
│   └── kanduit-logo.png    # Kanduit-Logo
├── scripts/
│   ├── generate_data.py    # Datenerzeugungspipeline
│   └── requirements.txt    # Python-Abhängigkeiten
├── README.md               # Englische Version
└── README.de.md            # Diese Datei (Deutsch)
```

## Daten neu generieren

Um den Brückendatensatz neu zu generieren (z.B. mit anderen Parametern):

```bash
cd scripts
pip install -r requirements.txt
python generate_data.py
```

Das Skript ruft echte Brückenstandorte von OpenStreetMap ab (mit synthetischem Fallback) und erzeugt realistische Zustands-, Verkehrs- und InSAR-Daten für ~15.000 Brücken.

## Technologie-Stack

- **Frontend:** Reines HTML/CSS/JS — kein Build-Schritt, kein Framework, kein Server
- **Karte:** Leaflet 1.9 + Leaflet.markercluster (CDN)
- **Diagramme:** D3.js v7 (CDN)
- **Datenerzeugung:** Python 3 + NumPy + Requests
- **Datenformat:** GeoJSON + JSON

---

<p align="center">
  <strong>Kanduit</strong> — Datengetriebene Infrastruktur-Intelligenz
</p>
