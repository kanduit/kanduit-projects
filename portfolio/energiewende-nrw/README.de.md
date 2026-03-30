<p align="center">
  <img src="assets/logo.png" alt="Energiewende NRW" width="80" onerror="this.style.display='none'" />
</p>

<h1 align="center">Energiewende-Monitor NRW</h1>
<p align="center"><strong>Tracking des Kohleausstiegs in Deutschlands industriellem Herz</strong></p>
<p align="center">
  Fragmentierte Energiedaten in eine einzige, ehrliche Antwort verdichten:<br/>
  <em>Ist NRW auf Kurs, bis 2030 aus der Kohle auszusteigen?</em>
</p>

---

> **English Version:** [README.md](README.md)

## Das Problem

Nordrhein-Westfalen ist Deutschlands größtes Energieerzeugerland. Das Rheinische Revier — Europas größtes Braunkohletagebaugebiet — hat die Industrie in NRW seit über einem Jahrhundert mit Strom versorgt. Im Oktober 2022 einigten sich die Bundesregierung, das Land NRW und RWE auf einen **vollständigen Braunkohleausstieg bis 2030** — acht Jahre früher als ursprünglich geplant.

Um diese Frist einzuhalten, ist ein beispielloser Ausbau erneuerbarer Energien erforderlich: Das Land muss seine **Windkapazität verdoppeln** und seine **Solarkapazität verdreifachen** — innerhalb weniger Jahre. Jeder Monat Verzögerung vergrößert das Risiko.

Die dafür benötigten Daten sind jedoch auf **Dutzende Behörden und Register** verteilt:

| Datensilo | Betreiber | Inhalt |
|---|---|---|
| Marktstammdatenregister (MaStR) | BNetzA | Jedes Kraftwerk, jede Solaranlage, jede Windturbine in Deutschland |
| SMARD | BNetzA | Echtzeit-Stromerzeugung nach Energieträger |
| Klimaschutzgesetz NRW | Landesregierung | Gesetzliche Ziele und Reduktionspfade |
| Geoportal NRW / LANUV | Landesbehörden | Flächennutzung, Umweltdaten, Solardachpotenzial |
| Bundesagentur für Arbeit | Bundesbehörde | Beschäftigung in Kohleregionen |

Es gibt keine einheitliche Sicht, die beantwortet: **Wie viel haben wir gebaut? Wie schnell bauen wir? Reicht das?**

## Die Kosten des Nichtwissens

| Risiko | Konsequenz |
|---|---|
| **Verfehlte Klimaziele** | Deutschlands rechtsverbindliche 2030-Ziele (65% CO2-Reduktion gg. 1990) setzen NRW voraus — scheitert NRW, scheitert Deutschland |
| **Fehlinvestitionen** | Milliarden an Strukturstärkungsmitteln (Strukturstärkungsgesetz) drohen ohne transparente Fortschrittsdaten fehlzulaufen |
| **Netzinstabilität** | Die Abschaltung von 8+ GW Kohle ohne entsprechenden Erneuerbaren-Ersatz gefährdet die Grundlastversorgung im bevölkerungsreichsten Bundesland |
| **Beschäftigungskrise** | 8.200+ direkte Kohle-Arbeitsplätze im Rheinischen Revier brauchen rechtzeitige Transformationsplanung — keine Last-Minute-Schließungen |
| **Politische Glaubwürdigkeit** | Wenn Deutschlands industrielles Herz die Transformation nicht schafft, untergräbt das die Energiewende-Erzählung national und in der EU |

## Die Lösung

Der **Energiewende-Monitor NRW** ist ein interaktives Dashboard, das echte Behördendaten in vier Ansichten bündelt:

- **Interaktive Karte** — jede registrierte Solaranlage und Windturbine in NRW, auf einer pydeck/deck.gl-Karte (~500.000 Anlagen)
- **Ausbautracker** — kumulierte installierte Leistung vs. erforderlicher linearer Zielpfad 2030, getrennt für Solar und Wind
- **Gemeinderanking** — welche der 396 NRW-Gemeinden treiben die Energiewende voran, und welche fallen zurück?
- **Lückenanalyse** — „Beim aktuellen Ausbautempo verfehlt NRW das Ziel 2030 um X Jahre" — mit Szenarienmodellierung für Beschleunigung

### Das Bewertungsmodell

Jede Gemeinde erhält einen Energiewende-Score (0–100):

```
Score = Perzentil(Installierte Gesamtkapazität)
      + Perzentil(Zubaurate der letzten 3 Jahre)
      + Perzentil(Technologievielfalt: Solar + Wind)
      + Perzentil(Kapazität pro Kopf)*

* Pro-Kopf-Bewertung erfordert Bevölkerungsdaten (optionaler Input)
```

Gemeinden werden kategorisiert: **Vorreiter** (>66), **Im Zeitplan** (33–66), **Nachholbedarf** (<33).

## Datenquellen

Alle Daten sind **öffentlich zugänglich** unter offenen Lizenzen:

| Quelle | Daten | Lizenz | Zugang |
|---|---|---|---|
| [Marktstammdatenregister](https://www.marktstammdatenregister.de) (BNetzA) | Jede registrierte Energieanlage in Deutschland | DL-DE-BY-2.0 | Bulk-XML-Download via [`open-mastr`](https://github.com/OpenEnergyPlatform/open-MaStR) |
| [SMARD](https://www.smard.de) (BNetzA) | Stündliche Stromerzeugung nach Energieträger | CC BY 4.0 | REST-API |
| Energie- und Wärmestrategie NRW | Offizielle 2030-Ziele | Öffentliches Dokument | Als Referenz hinterlegt |

**Hinweis zu SMARD-Regionaldaten:** SMARD liefert Erzeugungsdaten auf Regelzonen-Ebene, nicht nach Bundesland. NRW wird überwiegend durch die **Amprion**-Zone versorgt, die auch Teile anderer Bundesländer umfasst. Dies ist als bekannte Einschränkung dokumentiert.

## Technische Architektur

```
 Offline (lokaler Rechner)                Deployed (Streamlit Cloud)
┌────────────────────────────────┐       ┌─────────────────────────────┐
│  scripts/ingest.py             │       │  Streamlit-Dashboard        │
│  MaStR (open-mastr) + SMARD   │       │                             │
│  ↓ Bulk-Download + NRW-Filter  │       │  Startseite  Karte   Ausbau│
│  ↓ data/processed/ (~50 MB)    │       │  (KPIs)     (pydeck) tracker│
│                                │       │                             │
│  scripts/prepare_deploy.py     │       │  Gemeinde-   Lücken-       │
│  ↓ Spaltenreduktion + Dtype-Opt│       │  ranking     analyse       │
│  ↓ data/deploy/ (~10-15 MB)   ─┼──────→  liest schlanke Parquets   │
└────────────────────────────────┘       └──────────────┬──────────────┘
                                                        │
                                          Falls Deploy-Daten fehlen:
                                          bootstrap.py lädt von Zenodo
                                          (Zero-Config-Fallback)
```

### Technologie-Stack

| Komponente | Technologie |
|---|---|
| Daten-Ingestion (offline) | [`open-mastr`](https://pypi.org/project/open-MaStR/) + SMARD REST-API |
| Verarbeitung | pandas, PyArrow (Parquet) |
| Dashboard | Streamlit |
| Kartenvisualisierung | pydeck / deck.gl (WebGL, GPU-beschleunigt) |
| Diagramme | Plotly |

## Bereitstellung

### Option A: Streamlit Community Cloud (empfohlen)

Der schnellste Weg zu einer öffentlichen URL — kein Server nötig:

1. Daten-Pipeline lokal ausführen (siehe Option B), um `data/deploy/`-Parquets zu erzeugen
2. Dieses Repo (inkl. `data/deploy/`) auf GitHub pushen
3. Auf [share.streamlit.io](https://share.streamlit.io) gehen und GitHub-Konto verbinden
4. Repo auswählen, Hauptdatei auf `app/Startseite.py` setzen
5. Deployen — Sie erhalten eine URL wie `https://energiewende-nrw.streamlit.app`

**Einbetten als iframe** (z.B. in Confluence, einer Behörden-Website oder Notion):

```html
<iframe
  src="https://energiewende-nrw.streamlit.app/?embed=true"
  width="100%" height="800" frameborder="0">
</iframe>
```

Der `?embed=true` Parameter entfernt die Streamlit-Oberfläche für eine saubere Einbettung.

**Datenstrategie für Cloud:** Die schlanken, spaltenreduzierten NRW-Parquet-Dateien (~10–15 MB) in `data/deploy/` werden im Repo committed. Die App liest sie direkt beim Start — keine Laufzeit-Downloads, keine Netzwerkabhängigkeiten. Kaltstarts sind sofort.

**Zero-Config-Fallback:** Falls die Deploy-Daten fehlen (z.B. frischer Klon ohne Pipeline-Durchlauf), lädt die App automatisch MaStR Solar+Wind-Daten von [Zenodo](https://zenodo.org/records/14843222), filtert auf NRW und schreibt die Deploy-Dateien. Dadurch funktioniert „Klonen und Starten" ohne jegliches Pipeline-Setup.

### Option B: Lokal ausführen

#### Voraussetzungen

- Python 3.11+
- ~2 GB Festplattenspeicher (MaStR Bulk-Download ist groß)
- Internetverbindung für den initialen Datendownload

#### Installation

```bash
git clone <repo-url> energiewende-nrw
cd energiewende-nrw
python -m venv .venv && source .venv/bin/activate

# Mit Ingest-Abhängigkeiten installieren (für Daten-Pipeline)
pip install -e ".[ingest]"

# Oder nur Laufzeit-Abhängigkeiten (für Dashboard)
pip install -e .
```

#### Daten-Ingestion

Echte Daten von öffentlichen APIs herunterladen (ca. 30–45 Minuten für den initialen MaStR Bulk-Download):

```bash
# Alles herunterladen (MaStR + SMARD + Gemeinde-Geodaten)
python scripts/ingest.py

# Oder selektiv herunterladen
python scripts/ingest.py --mastr     # Nur MaStR-Anlagen
python scripts/ingest.py --smard     # Nur SMARD-Erzeugungsdaten
python scripts/ingest.py --geodata   # Nur Gemeindegrenzen
```

#### Deploy-Daten vorbereiten

Nach der Ingestion die schlanken Parquet-Dateien für das Dashboard erzeugen:

```bash
python scripts/prepare_deploy.py
```

Dieses Skript liest die vollständigen Parquets aus `data/processed/`, reduziert auf
die vom Dashboard benötigten Spalten, optimiert Datentypen und schreibt komprimierte
Dateien nach `data/deploy/`.

#### Daten prüfen

```bash
python scripts/process.py
```

#### Dashboard starten

```bash
streamlit run app/Startseite.py
```

Das Dashboard öffnet sich unter `http://localhost:8501`.

## Projektstruktur

```
energiewende-nrw/
├── README.md                        # Englische Version
├── README.de.md                     # Diese Datei (Deutsch)
├── pyproject.toml                   # Projektabhängigkeiten (Laufzeit + optionale Ingest-Deps)
├── requirements.txt                 # Minimale Deploy-Deps (Streamlit Cloud liest diese)
├── data/
│   ├── raw/                         # MaStR Bulk-Downloads (gitignored)
│   ├── processed/                   # Vollständige Parquet-Dateien (gitignored)
│   ├── deploy/                      # Schlanke Parquets fürs Dashboard (committed)
│   │   ├── nrw_solar.parquet
│   │   ├── nrw_wind.parquet
│   │   └── nrw_combustion.parquet
│   └── reference/
│       └── targets.json             # Offizielle 2030-Ziele
├── src/
│   ├── config.py                    # Pfade, Zielwerte, Dashboard-Konstanten
│   ├── bootstrap.py                 # Auto-Download beim ersten Start (Zenodo)
│   ├── ingest/
│   │   ├── mastr.py                 # MaStR Bulk-Download + NRW-Filter
│   │   └── smard.py                 # SMARD REST-API Client
│   └── processing/
│       ├── transform.py             # Datenbereinigung + Aggregation
│       ├── targets.py               # 2030-Lückenanalyse-Mathematik
│       └── scorecard.py             # Gemeinde-Scoring-Logik
├── app/
│   ├── Startseite.py                # Dashboard-Startseite (KPI-Übersicht)
│   └── pages/
│       ├── 1_Karte.py               # Interaktive Anlagenkarte (pydeck)
│       ├── 2_Ausbautracker.py       # Ausbautracker vs. Zielpfade
│       ├── 3_Gemeinderanking.py     # Gemeinde-Scorecard
│       └── 4_Lueckenanalyse.py      # Lückenanalyse + Szenarien
└── scripts/
    ├── ingest.py                    # CLI: Datendownload (benötigt [ingest]-Deps)
    ├── prepare_deploy.py            # CLI: Spaltenreduktion → data/deploy/
    ├── process.py                   # CLI: Datenvalidierung
    └── download_geodata.py          # Gemeinde-GeoJSON-Download
```

## Lizenz

Code: MIT

Datenlizenzen:
- Marktstammdatenregister: [DL-DE-BY-2.0](https://www.govdata.de/dl-de/by-2-0) — © Bundesnetzagentur
- SMARD: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — © Bundesnetzagentur

---

<p align="center">
  <strong>Kanduit</strong> — Datengetriebene Intelligenz für den öffentlichen Sektor
</p>
