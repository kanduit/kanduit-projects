---
name: Energiewende NRW Dashboard
overview: Build a Streamlit dashboard at `/Users/jcheng/Library/CloudStorage/OneDrive-trivagoN.V/Documents/energiewende-nrw/` that ingests real data from MaStR (power installations) and SMARD (generation mix), visualizes NRW's energy transition on a Kepler.gl map, and quantifies the gap to 2030 coal phase-out targets.
todos:
  - id: scaffold
    content: Create project directory, pyproject.toml, .gitignore, and folder structure at target path
    status: completed
  - id: config
    content: Write src/config.py with paths, SMARD filter IDs, NRW Bundesland code, and 2030 target constants
    status: completed
  - id: ingest-mastr
    content: "Implement src/ingest/mastr.py: open-mastr bulk download for solar/wind, filter to NRW, save raw"
    status: completed
  - id: ingest-smard
    content: "Implement src/ingest/smard.py: SMARD REST API client for hourly generation by source (Amprion zone)"
    status: completed
  - id: processing
    content: "Implement src/processing/ modules: transform (clean + Parquet cache), targets (2030 gap math), scorecard (municipality ranking)"
    status: completed
  - id: reference-data
    content: Add NRW municipality GeoJSON and targets.json to data/reference/
    status: completed
  - id: dashboard-overview
    content: "Build app/Startseite.py: KPI cards, trend sparklines, status indicators"
    status: completed
  - id: dashboard-map
    content: "Build app/pages/1_Karte.py: Kepler.gl map of all NRW solar/wind installations"
    status: completed
  - id: dashboard-tracker
    content: "Build app/pages/2_Ausbautracker.py: expansion rate vs 2030 target Plotly charts"
    status: completed
  - id: dashboard-scorecard
    content: "Build app/pages/3_Gemeinderanking.py: municipality scorecard table"
    status: completed
  - id: dashboard-gap
    content: "Build app/pages/4_Lueckenanalyse.py: gap analysis with projection scenarios"
    status: completed
  - id: cli-scripts
    content: Write scripts/ingest.py and scripts/process.py CLI entry points
    status: completed
  - id: readme-en
    content: "Write README.md (English): stakeholder-first structure, data sources, architecture, getting started"
    status: completed
  - id: readme-de
    content: "Write README.de.md (German): same structure, fully translated"
    status: completed
  - id: git-init
    content: Initialize git repo and make initial commit
    status: completed
isProject: false
---

# Energiewende NRW — Energy Transition Monitor

## Project Location & Structure

Target: `/Users/jcheng/Library/CloudStorage/OneDrive-trivagoN.V/Documents/energiewende-nrw/`

```
energiewende-nrw/
├── README.md                    # English (stakeholder-first)
├── README.de.md                 # German (stakeholder-first)
├── pyproject.toml               # pixi project config
├── .gitignore
├── data/
│   ├── raw/                     # MaStR bulk + SMARD downloads (gitignored)
│   ├── processed/               # Cleaned Parquet files (gitignored)
│   └── reference/
│       ├── nrw_gemeinden.geojson  # NRW municipality boundaries
│       └── targets.json           # Official 2030 targets
├── src/
│   ├── __init__.py
│   ├── ingest/
│   │   ├── __init__.py
│   │   ├── mastr.py             # open-mastr bulk download, NRW filter
│   │   └── smard.py             # SMARD REST API client
│   ├── processing/
│   │   ├── __init__.py
│   │   ├── transform.py         # Clean, aggregate, cache as Parquet
│   │   ├── targets.py           # 2030 target definitions & gap math
│   │   └── scorecard.py         # Municipality-level scoring logic
│   └── config.py                # Paths, constants, SMARD filter IDs
├── app/
│   ├── Startseite.py            # Streamlit entry (overview + KPI cards)
│   └── pages/
│       ├── 1_Karte.py           # Kepler.gl map of all installations
│       ├── 2_Ausbautracker.py   # Expansion rate vs 2030 target
│       ├── 3_Gemeinderanking.py # Municipality scorecard table
│       └── 4_Lueckenanalyse.py  # Gap analysis ("miss 2030 by X years")
├── scripts/
│   ├── ingest.py                # CLI: download MaStR + SMARD data
│   └── process.py               # CLI: transform raw -> processed Parquet
└── assets/
    └── logo.png                 # Project logo
```

## Data Sources & Ingestion

### 1. MaStR via `open-mastr` ([src/ingest/mastr.py](src/ingest/mastr.py))

- Use the `open-mastr` Python package (v0.16.1) for bulk XML download
- Download technologies: `["solar", "wind"]` (plus `"combustion"` for coal/gas context)
- Post-download filter: `Bundesland == "Nordrhein-Westfalen"` (no state-level API filter exists; must download national, then filter)
- Key columns to extract: `MaStR-Nr`, `Energietraeger` (energy source), `Bruttoleistung` (gross capacity kW), `Inbetriebnahmedatum` (commissioning date), `Breitengrad`/`Laengengrad` (lat/lon), `Gemeinde`, `Postleitzahl`, `Betriebsstatus`
- Output: `data/processed/mastr_nrw_solar.parquet`, `mastr_nrw_wind.parquet`

### 2. SMARD via REST API ([src/ingest/smard.py](src/ingest/smard.py))

- Endpoint: `https://www.smard.de/app/chart_data/{filter}/{region}/...`
- Filters: Wind Onshore (4067), Wind Offshore (1225), PV (4068), Biomass (4066), Braunkohle (1223), Steinkohle (4069), Erdgas (4071)
- Region: Amprion zone (best NRW proxy; note: not perfectly NRW-aligned -- document this)
- Resolution: hourly data, aggregated to daily/monthly in processing
- Output: `data/processed/smard_generation.parquet`

### 3. Reference Data ([data/reference/](data/reference/))

- **NRW municipality boundaries**: GeoJSON from `opendatasoft.com` or `gdz.bkg.bund.de` (Verwaltungsgebiete)
- **2030 targets** (from official NRW Energie- und Warmestrategie):
  - Coal exit: 2030 (Rheinisches Revier lignite)
  - Wind onshore NRW target: ~12 GW installed by 2030 (state target)
  - Solar PV NRW target: ~18-24 GW installed by 2030
  - Overall: electricity generation largely climate-neutral by 2035

## Dashboard Pages (all in German)

### Startseite (Overview)

- KPI cards: total installed renewable capacity, number of installations, renewable share trend, years behind target
- Trend sparklines: monthly new installations over past 3 years
- Status indicator: on-track / behind / critical

### 1. Karte (Map)

- **Kepler.gl** via `streamlit-keplergl` showing every solar panel and wind turbine in NRW
- Color-coded by technology (solar = yellow, wind = blue)
- Point size scaled by capacity (kW)
- Layer toggle: solar / wind / coal plants
- Municipality boundary overlay

### 2. Ausbautracker (Expansion Tracker)

- Plotly line chart: cumulative installed capacity over time vs. required linear trajectory to 2030 target
- Separate tracks for solar and wind
- Shaded "gap zone" between actual and required pace
- Annual installation rate (bar chart) with trend line

### 3. Gemeinderanking (Municipality Scorecard)

- Table of all NRW municipalities ranked by "Energiewende score"
- Score components: installed capacity per capita, growth rate, technology diversity
- Color-coded: green (ahead), yellow (on pace), red (behind)
- Filterable by Kreis (county), sortable by any column

### 4. Luckenanalyse (Gap Analysis)

- Headline metric: "Bei aktuellem Tempo verfehlt NRW das Ziel 2030 um X Jahre"
- Projection: current installation rate extrapolated forward
- Scenario analysis: what if rate doubles? Triples?
- Breakdown by technology: where is the biggest gap?

## READMEs

Follow the pattern from `nrw-bridge-dashboard`: impact-first structure aimed at non-technical public-sector stakeholders.

**Structure (both EN and DE):**

1. Project title + one-sentence value proposition
2. The Problem (coal dependence, data fragmentation, 2030 deadline)
3. Impact of Inaction (table: missed targets, economic cost, climate risk)
4. The Solution (what the dashboard shows, with screenshot placeholder)
5. Key Findings (to be filled after data loads)
6. Data Sources (with licensing: DL-DE-BY-2.0 for MaStR, CC BY 4.0 for SMARD)
7. Technical Architecture (data flow diagram, tech stack)
8. Getting Started (install, ingest, run)
9. License

## Tech Stack & Dependencies

```toml
# pixi.toml
[dependencies]
python = ">=3.11"

[pypi-dependencies]
streamlit = "*"
streamlit-keplergl = "*"
keplergl = "*"
open-mastr = "*"
pandas = ">=2.2"
pyarrow = "*"
plotly = "*"
requests = "*"
geopandas = "*"
shapely = "*"
```

## Key Technical Decisions

- **Kepler.gl for 500k points**: GPU-accelerated WebGL rendering handles the scale; `streamlit-keplergl` wraps it for Streamlit
- **Parquet as cache layer**: MaStR bulk download is slow (~30 min); cache cleaned NRW subset as Parquet so dashboard starts instantly
- **SMARD Amprion zone as NRW proxy**: SMARD does not offer state-level data; Amprion transmission zone covers most of NRW but also parts of other states -- this limitation is documented in the dashboard and README
- **Two-phase CLI**: `scripts/ingest.py` (download raw) and `scripts/process.py` (transform to Parquet) are separate so users can re-process without re-downloading
- **No database**: Parquet + pandas is sufficient for this scale; avoids Docker/DB setup friction for public-sector users

