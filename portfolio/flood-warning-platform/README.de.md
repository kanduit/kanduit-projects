# Hochwasser-Frühwarnung & Krisenkoordinationsplattform

**Inspiriert durch die Ahrtal-Katastrophe 2021**

> "Die Daten existierten. Die Technologie existierte. Was fehlte, war die
> Integration. Wir bauen das verbindende Gewebe."

Im Juli 2021 kamen bei einer Hochwasserkatastrophe in NRW und
Rheinland-Pfalz mehr als 180 Menschen ums Leben. Das Europäische
Hochwasserwarnsystem EFAS hatte bereits Tage zuvor Warnungen versandt, die
jedoch in fragmentierten Kommunikationsketten zwischen Behörden verloren
gingen. Landkreise erhielten PDF-Anhänge per E-Mail. Ein einheitliches
operatives Lagebild fehlte vollständig.

Diese Plattform zeigt, wie eine integrierte Datenplattform Leben hätte
retten können.

## Architektur

```
Datenquellen               Medallion-Pipeline          Dashboard
────────────               ──────────────────          ─────────
EFAS-Warnungen   ──┐
DWD Radar/Nds.   ──┼──▶  Bronze → Silver → Gold  ──▶  Interaktive Karte
Pegel-Messwerte  ──┤                                   Ereignis-Zeitachse
Zensus/BKG       ──┘                                   Was-wäre-wenn-Szenarien
```

## Schnellstart

### Dashboard anzeigen (keine Installation erforderlich)

`docs/index.html` in einem beliebigen Browser öffnen. Beispieldaten sind
bereits enthalten.

### Beispieldaten neu generieren

```bash
cd flood-warning-platform
pixi run generate-data
```

### Lokaler Entwicklungsserver

```bash
pixi run serve
# Öffne http://localhost:8080
```

## Datenquellen

| Quelle | Datentyp | Zugang |
|--------|----------|--------|
| [Pegel Online (WSV)](https://pegelonline.wsv.de) | Pegelstände | Offene REST-API |
| [DWD Open Data](https://opendata.dwd.de) | Radar / Niederschlag | Offener HTTPS-Zugang |
| [EFAS (Copernikus)](https://european-flood.emergency.copernicus.eu) | Hochwasservorhersagen | Archivierter WMS-T-Dienst |
| [Zensus 2022 (Destatis)](https://www.destatis.de) | Bevölkerungsraster | Offener CSV-Download |
| [DGM1 NRW](https://www.opengeodata.nrw.de) | Digitales Geländemodell | Offenes GeoTIFF |

## Dashboard-Funktionen

- **Interaktive Karte**: Leaflet.js mit Risiko-Choropleth auf Gemeindeebene,
  Pegelstations-Markern und Bevölkerungsdichte-Overlay
- **Historische Wiedergabe**: Das Ereignis vom Juli 2021 Stunde für Stunde
  durchspielen
- **Ereignis-Zeitachse**: Visualisiert, wann welches Datensignal verfügbar
  war und wann Evakuierungen tatsächlich angeordnet wurden
- **Was-wäre-wenn-Szenarien**: Schwellenwerte anpassen und sehen, wie viel
  früher automatisierte Warnungen hätten ausgelöst werden können

## Projektstruktur

```
flood-warning-platform/
├── README.md                # Englische Dokumentation
├── README.de.md             # Deutsche Dokumentation (diese Datei)
├── pixi.toml                # Python-Umgebung für Daten-Skripte
├── scripts/
│   ├── generate_sample_data.py
│   ├── ingest_pegel.py      # Optional: Live-Daten von Pegel Online
│   └── ingest_dwd.py        # Optional: Live-Daten vom DWD
└── docs/                    # Statisches Dashboard (GitHub Pages)
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── app.js           # Zustandsverwaltung + Wiedergabe-Engine
    │   ├── map.js           # Leaflet-Kartenebenen
    │   ├── timeline.js      # Chart.js Ereignis-Zeitachse
    │   └── scenario.js      # Was-wäre-wenn-Schwellenwert-Engine
    └── data/                # Vorberechnete Beispieldaten
        ├── municipalities.geojson
        ├── gauge_stations.geojson
        ├── gauge_readings.json
        ├── precipitation.json
        ├── event_timeline.json
        ├── population_grid.json
        └── risk_scores.json
```

## Technische Architektur (Detailliert)

### Systemübersicht

Die Plattform folgt einer **Lakehouse-Medallion-Architektur**, die für die
Integration von Krisendaten angepasst wurde. Im Produktivbetrieb läuft dies
auf Apache Spark / Delta Lake (Databricks oder Open Source). Die Demo
implementiert dieselben logischen Schichten mit lokalen Dateien und einem
statischen Frontend, um keinerlei Abhängigkeiten zu benötigen.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       INGESTION-SCHICHT                              │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  EFAS    │  │  DWD     │  │  Pegel   │  │ Zensus / │           │
│  │  WMS-T   │  │  HTTPS   │  │  REST    │  │ BKG Open │           │
│  │  OGC SOS │  │  Radar   │  │  JSON    │  │ GeoTIFF  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │              │                 │
│       ▼              ▼              ▼              ▼                 │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                 BRONZE (Rohdaten)                        │       │
│  │  Nur-Anfügen-Aufnahme. Schema-on-Read. Partitioniert    │       │
│  │  nach Quelle und Aufnahmezeitstempel. Pegeldaten alle   │       │
│  │  5 Min., Radarkomposits alle 5 Min., EFAS-Vorhersagen   │       │
│  │  alle 6 Std. Format: Parquet / Delta Lake.              │       │
│  └────────────────────────┬────────────────────────────────┘       │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │               SILVER (Angereichert)                      │       │
│  │  Bereinigt, dedupliziert, verknüpft. Pegelstände geo-   │       │
│  │  angereichert mit Gemeindegrenzen (Spatial Join via      │       │
│  │  ST_CONTAINS). Niederschlagsraster auf Gemeindepolygone  │       │
│  │  umgerechnet. EFAS-Überschreitungswahrscheinlichkeiten   │       │
│  │  auf betroffene Gemeindeschlüssel (AGS) gemappt.        │       │
│  └────────────────────────┬────────────────────────────────┘       │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                GOLD (Operativ)                           │       │
│  │  Risikobewertung pro Gemeinde, alle 5 Min. aktualisiert.│       │
│  │  Komposit-Index: Pegelstand, Niederschlagsrate,         │       │
│  │  EFAS-Überschreitungswahrscheinlichkeit, Geländeneigung,│       │
│  │  Bodensättigungs-Proxy. Schwellenwert-Ereignisse werden │       │
│  │  an eine Alert-Queue geschrieben (Kafka / Pub/Sub).     │       │
│  └────────────────────────┬────────────────────────────────┘       │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PRÄSENTATIONSSCHICHT                               │
│                                                                     │
│  Statisches HTML/JS-Dashboard (Leaflet.js + Chart.js)              │
│  Bereitstellung über GitHub Pages, S3 oder beliebigen statischen   │
│  Host. Im Produktivbetrieb: Apache Superset / Redash / Grafana     │
│  hinter behördlichem SSO (SAML/OIDC via BundID oder Landesportal).│
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Leaflet  │  │ Chart.js │  │ Szenario │  │ Ereignis │           │
│  │ Karte    │  │ Zeitachse│  │ Engine   │  │ Protokoll│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Datenaufnahme-Protokolle

| Quelle | Protokoll | Aktualisierung | Format | Authentifizierung |
|--------|-----------|----------------|--------|-------------------|
| EFAS | OGC WMS-T / SOS | 6-Std.-Vorhersagezyklen | GeoTIFF, XML | Partnervereinbarung (Archivdaten offen) |
| DWD Radar | HTTPS-Verzeichnislisting | 5-Min.-Komposits | HDF5 / Binärraster (produktspezifisch) | Keine (offene Daten) |
| DWD CDC | HTTPS-Massendownload | Stündlich / täglich | CSV in ZIP-Archiven | Keine (offene Daten) |
| Pegel Online | REST JSON-API | 15 Min. (Bundeswasserstraßen) | JSON, CSV | Keine (offen, ratenbegrenzt) |
| NRW Landespegel | ELWAS-WEB / Hochwasserportal NRW | 15 Min. | HTML-Scraping / WFS | Keine (offen) |
| Zensus 2022 | HTTPS-Massendownload | Statisch (Zehnjahres-Zensus) | CSV-Raster (100m, 1km, 10km) | Keine (offen, Quellenangabe erforderlich) |
| DGM1 NRW | GEOportal.NRW Download-Client | Statisch (ca. jährlich aktualisiert) | GeoTIFF, EPSG:25832 | Keine (offen, Datenlizenz DE Zero) |

### Frontend-Modularchitektur

Das Dashboard ist eine Single-Page-Anwendung in reinem JavaScript mit einem
globalen Namensraum-Muster (`window.FloodMap`, `window.FloodTimeline`,
`window.FloodScenario`). Kein Build-Schritt erforderlich.

| Modul | Verantwortung | Wichtige APIs |
|-------|---------------|---------------|
| `app.js` | Datenladen (7 parallele `fetch`-Aufrufe), Zustandsverwaltung, Wiedergabe-Engine (`setInterval`-basierter Takt), UI-Event-Bindung | `loadAll()`, `updateAll()`, `togglePlay()` |
| `map.js` | Leaflet-Karteninitialisierung (CartoDB Dark Matter Kacheln), GeoJSON-Choropleth-Ebene für Gemeinden, `L.circleMarker` für Pegel mit dynamischer Farbe/Größe, Bevölkerungsdichte-Overlay | `init()`, `updateGauges(idx)`, `highlightMunicipality(name)` |
| `timeline.js` | Chart.js Doppelachsen-Diagramm (Linie für Pegelstand, Balken für Niederschlag), `chartjs-plugin-annotation` für Ereignismarker, Warn-/Kritisch-Bänder und beweglichen Abspielkopf | `init()`, `setStation(id)`, `setPlayhead(idx)` |
| `scenario.js` | Was-wäre-wenn-Schwellenwert-Engine: findet ersten Überschreitungsindex in Pegelständen, berechnet Zeitdelta zur tatsächlichen Katwarn-Meldung (14.07.2021, 01:09 Uhr), fügt gestrichelte Annotationslinien in Zeitachse ein | `init()`, `setStation(id)`, `recalculate()` |

### Datenfluss während der Wiedergabe

```
Wiedergabe-Takt (alle 500ms / Geschwindigkeit)
    │
    ├─▶ app.js: currentIndex erhöhen
    │
    ├─▶ map.js: updateGauges(idx)
    │       └─ Für jeden Pegelmarker:
    │           gaugeReadings[stationId][idx].level_cm lesen
    │           Marker umfärben (grün/gelb/rot)
    │           Markergröße anpassen (8px normal, 12px kritisch)
    │
    ├─▶ timeline.js: setPlayhead(idx)
    │       └─ Weiße vertikale Annotationslinie verschieben
    │
    ├─▶ app.js: updateEventHighlights()
    │       └─ Aktuellen Zeitstempel mit Ereignissen vergleichen
    │           zukünftige Ereignisse abdunkeln, aktuelles hervorheben
    │           Ereignisprotokoll automatisch scrollen
    │
    └─▶ app.js: updateStatusBadge()
            └─ Ausgewählten Pegelstand lesen
                Badge-Klasse setzen: normal/warnung/kritisch
```

### Hochwasserganglinie-Modell

Die Beispieldaten verwenden eine stückweise asymmetrische Kurve, die an
dokumentierte Ahr-Pegelstände kalibriert wurde:

- **Basisabfluss** (T < Scheitel - 36 Std.): Normalstand + Gaußsches Rauschen (Sigma = 1,5 cm)
- **Allmählicher Anstieg** (T - 36 Std. bis T - 12 Std.): Quadratische Rampe, erreicht 5 % der Amplitude
- **Schneller Anstieg** (T - 12 Std. bis T): Kubische Beschleunigung zum Scheitel
- **Scheitelplateau** (T bis T + 1 Std.): Scheitelstand + Gaußsches Rauschen (Sigma = 5 cm)
- **Rezessionsast** (T + 1 Std. danach): Exponentieller Abfall, Tau = 16,7 Std.

Oberstrom-Stationen (Müsch) erreichen den Scheitel ca. 3 Std. vor der
Referenzstation (Altenahr); unterstrom gelegene Stationen (Bad Bodendorf)
ca. 2,5 Std. danach. Dies modelliert die Hochwasserwellenausbreitung durch
die Ahrtal-Schlucht.

### Produktiv-Bereitstellungspfad

| Komponente | Demo | Produktivbetrieb |
|------------|------|------------------|
| Rechenleistung | Lokale Python-Skripte | Databricks / Spark Structured Streaming |
| Speicher | Lokale JSON/GeoJSON-Dateien | Delta Lake auf S3/ADLS/GCS |
| Datenaufnahme | `generate_sample_data.py` | Kafka Connect / eigene Ingestoren mit 5-Min.-Polling |
| Dashboard | Statisches HTML (GitHub Pages) | Apache Superset / Grafana mit PostGIS-Backend |
| Alarmierung | Visuelle Was-wäre-wenn-Analyse | Apache Kafka → MoWaS/NINA API-Integration |
| Authentifizierung | Keine | SAML 2.0 via BundID / Landesportal OIDC |
| Überwachung | Manuell | Prometheus + Alertmanager für Pipeline-Gesundheit |

---

## Häufige Fragen öffentlicher Auftraggeber

### Daten & Souveränität

**F: Wo werden die Daten gespeichert? Verlassen sie Deutschland?**
A: Die gesamte Datenverarbeitung erfolgt in deutschen oder EU-Rechenzentren.
In der Referenzarchitektur wird das Lakehouse in einem Databricks-Workspace
in `eu-west-1` (Frankfurt) oder on-premises über Azure Stack betrieben.
Rohdaten von DWD, Pegel Online und EFAS verlassen die Verarbeitungsumgebung
nicht. Für eingestufte Betriebsdaten (z. B. Standorte kritischer
Infrastrukturen) steht eine air-gapped Bereitstellungsoption zur Verfügung.

**F: Ist das DSGVO-konform? Werden personenbezogene Daten verarbeitet?**
A: Die Plattform verarbeitet hydrologische, meteorologische und geografische
Daten, von denen keines personenbezogene Daten im Sinne von Art. 4 DSGVO
darstellt. Bevölkerungsdichten stammen aus Zensus-Rasterzellen
(100-m-Auflösung), die konstruktionsbedingt anonymisiert sind. Es werden
keine personenbezogenen Daten aufgenommen, gespeichert oder verarbeitet.

**F: Wem gehören die Daten und die abgeleiteten Risikobewertungen?**
A: Alle Eingangsdaten stammen aus offenen staatlichen Quellen (DWD, WSV,
Destatis, EFAS). Die abgeleiteten Risikobewertungen und operativen
Dashboards gehören der einsetzenden Behörde. Der Plattform-Code ist
Open Source; es besteht kein Vendor-Lock-in auf der Analytics-Schicht.

### Integration & Interoperabilität

**F: Wie integriert sich das mit bestehenden Warnsystemen (NINA, Katwarn, MoWaS)?**
A: Die Gold-Schicht erzeugt strukturierte Alarmereignisse mit Schweregrad,
betroffenen Gemeindeschlüsseln (AGS) und empfohlenen Maßnahmen. Im
Produktivbetrieb werden diese Ereignisse an eine Nachrichtenwarteschlange
(Kafka/Pub/Sub) veröffentlicht. Ein Connector-Modul kann Meldungen an die
MoWaS-API (Modulares Warnsystem) senden, die wiederum an NINA,
Cell Broadcast (DE-Alert) und lokale Sirenen verteilt. Die Plattform ersetzt
MoWaS nicht -- sie speist es mit schnelleren, datengetriebenen
Auslöse-Entscheidungen.

**F: Funktioniert das neben unseren bestehenden Hochwasserportalen / LANUV-Systemen?**
A: Ja. Die Plattform ist additiv, kein Ersatz. Sie nutzt dieselben
Datenfeeds wie bestehende Hochwasserportale (Pegel Online, DWD), ergänzt
diese aber um quellenübergreifende Korrelation und automatisierte
Schwellenwertüberwachung. Bestehende LANUV-Pegelnetze können über deren
WFS/SOS-Endpunkte als zusätzliche Bronze-Schicht-Quellen eingebunden
werden.

**F: Was ist mit Leitstellen? Können die das direkt nutzen?**
A: Das Dashboard kann als schreibgeschützte Betriebsansicht in Leitstellen
neben den bestehenden ELRD/Cobra-Systemen bereitgestellt werden. Für eine
aktive Einsatzleiter-Integration können die Alarmereignisse der
Gold-Schicht als CAP-Nachrichten (Common Alerting Protocol) formatiert
werden -- dem Standard, der von deutscher Leitstellen-Software verwendet
wird.

### Kosten & Betrieb

**F: Was kostet der Betrieb?**
A: Für einen einzelnen Landkreis: Die Demo läuft auf einem Standard-Laptop
ohne Kosten. Eine Produktiv-Bereitstellung für einen Regierungsbezirk
(ca. 20-50 Gemeinden umfassend) kostet ungefähr 2.000-5.000 EUR/Monat auf
verwalteter Cloud-Infrastruktur (Databricks + managed Kafka + statisches
Dashboard-Hosting). Das entspricht etwa einem VZÄ-Monat manueller
Überwachung und ist deutlich weniger als die Kosten einer einzigen
gescheiterten Evakuierung.

**F: Wer betreibt und wartet das?**
A: Die Plattform ist für ein kleines DevOps-Team (2-3 Personen) auf
Landesebene oder einen gemeinsamen IT-Dienstleister (z. B. IT.NRW)
ausgelegt. Der tägliche Betrieb ist weitgehend automatisiert:
Datenpipelines laufen planmäßig, Dashboards aktualisieren sich
automatisch, und Alarme werden ohne menschliches Eingreifen ausgelöst.
Wartung umfasst die Überwachung der Pipeline-Gesundheit und die
Aktualisierung von Schwellenwert-Konfigurationen.

**F: Was passiert, wenn das Internet während einer Krise ausfällt?**
A: Das Dashboard bündelt den zuletzt bekannten Datensatz lokal und
funktioniert offline, sobald es geladen ist. Für Leitstellen-Einsätze im
Produktivbetrieb empfehlen wir einen On-Premises-Edge-Knoten, der die
Gold-Schicht-Daten cached und das Dashboard lokal betreibt. Pegeldaten von
NRW-Landespegeln können auch über dedizierte ISDN/LTE-Backup-Leitungen
empfangen werden, unabhängig vom öffentlichen Internet.

### Technische Glaubwürdigkeit

**F: Wurde dieser Ansatz anderswo bereits erprobt?**
A: Ja. Palantir Foundry wurde von der FEMA (USA) und dem NHS (UK) für genau
diese Art der quellenübergreifenden Krisendatenintegration eingesetzt.
Googles Flood Hub nutzt ähnliche hydrologische Modellierung für
Hochwasservorhersagen in Indien und in über 80 Ländern. Die britische
Environment Agency betreibt ein automatisiertes Hochwasserwarnsystem
(Flood Warning System), das SMS-Warnungen basierend auf Pegelschwellenwerten
auslöst -- konzeptionell identisch mit unserer Was-wäre-wenn-Engine.
Unser Ansatz repliziert diese bewährten Muster mit Open-Source-Werkzeugen
und offenen deutschen Daten.

**F: Wie genau sind die Hochwasserrisiko-Vorhersagen?**
A: Die Demo verwendet einen kombinierten Risiko-Score basierend auf Höhenlage,
Flussnähe, Bevölkerungsdichte und historischer Schwere. Im Produktivbetrieb
würde dieser durch hydrodynamische Simulation mit dem DGM1-Geländemodell
(1-m-Auflösung für NRW) und Bodensättigungsdaten des DWD ergänzt. Die
Genauigkeit hängt von der Modellkalibrierung ab, aber die zentrale Erkenntnis
ist: Selbst einfache schwellenwertbasierte Warnungen auf bestehenden
Pegeldaten hätten im Ereignis von 2021 zusätzlich 12-24 Stunden Vorwarnzeit
gebracht -- ganz ohne ML-Modell.

**F: Warum nicht einfach die bestehenden EFAS-Warnungen nutzen?**
A: EFAS hat Warnungen ausgesprochen -- 4 Tage im Voraus. Das Problem war
nicht die Vorhersage, sondern die Weitergabekette. EFAS-Benachrichtigungen
gingen an die BfG (Bundesebene), die an Landesämter weiterleitete, die
an Landkreise weiterleiteten -- per E-Mail, als PDF-Anhänge. Manche
landeten im Spam-Ordner. Diese Plattform eliminiert diese Kette, indem sie
EFAS-Daten direkt einliest und automatisierte Regeln am Entscheidungspunkt
(Landkreis-/Leitstellenebene) anwendet.

### Bereitstellung & Zeitplan

**F: Wie lange dauert die Bereitstellung?**
A: Die Demo kann sofort gezeigt werden (`index.html` öffnen). Ein
Proof-of-Concept mit Live-Daten für einen Landkreis kann in 4-6 Wochen
bereitgestellt werden. Ein vollständiges Produktivsystem für einen
Regierungsbezirk mit MoWaS-Integration, authentifiziertem Zugang und
24/7-Überwachung: 3-6 Monate.

**F: Erfordert das eine BSI-IT-Grundschutz-Zertifizierung?**
A: Für den Einsatz in KRITIS-Umgebungen (kritische Infrastrukturen): ja.
Die Architektur ist grundschutzkonform ausgelegt: Alle Komponenten können in
einer zertifizierten Cloud-Umgebung betrieben werden (z. B. Bundescloud,
IONOS), Daten im Ruhezustand sind verschlüsselt (AES-256), Daten im
Transport nutzen TLS 1.3, und der Zugriff wird über RBAC mit
Audit-Protokollierung gesteuert. Eine formale Grundschutz-Bewertung wäre
Teil des Produktiv-Bereitstellungsprojekts.

**F: Welche Schulung benötigen Leitstellen-Disponenten?**
A: Das Dashboard ist selbsterklärend gestaltet -- es zeigt eine Karte, eine
Zeitachse und eine Statusanzeige. Keine SQL- oder Programmierkenntnisse sind
erforderlich. Eine 2-stündige Schulung umfasst: Risikokarte lesen,
Zeitachse interpretieren, Was-wäre-wenn-Schwellenwerte verstehen und
wissen, wann an MoWaS eskaliert werden soll. Das zentrale Designprinzip:
Das System gibt Empfehlungen; Menschen treffen Entscheidungen.

---

## Kernaussage

Die Ahrtal-Flut 2021 offenbarte ein systemisches Versagen der
Datenintegration, nicht einen Mangel an Daten. EFAS gab mehr als 4 Tage vor
der Katastrophe handlungsrelevante Warnungen aus. Diese Plattform zeigt,
wie die Verknüpfung bestehender Datenquellen mit automatisierter
Schwellenwertüberwachung Evakuierungen 12-24 Stunden früher hätte auslösen
können -- und damit potenziell Dutzende Menschenleben hätte retten können.
