<p align="center">
  <img src="assets/logo.png" alt="Energiewende NRW" width="80" onerror="this.style.display='none'" />
</p>

<h1 align="center">Energiewende-Monitor NRW</h1>
<p align="center"><strong>Energy Transition Monitor — Tracking the Coal Phase-Out in Germany's Industrial Heartland</strong></p>
<p align="center">
  Turning fragmented energy data into a single, honest answer:<br/>
  <em>Is NRW on track to exit coal by 2030?</em>
</p>

---

> **Deutsche Version:** [README.de.md](README.de.md)

## The Problem

North Rhine-Westphalia is Germany's largest energy-producing state. The Rheinisches Revier — Europe's biggest open-pit lignite mining region — has powered NRW's industry for over a century. In October 2022, the federal government, the state of NRW, and RWE agreed to **end all lignite burning by 2030**, eight years earlier than originally planned.

Meeting this deadline requires an unprecedented expansion of renewable energy: the state must roughly **double its wind capacity** and **triple its solar capacity** within a few years. Every month of delay compounds the risk.

But the data needed to track this transition is scattered across **dozens of agencies and registries**:

| Data Silo | Owner | What It Contains |
|---|---|---|
| Marktstammdatenregister (MaStR) | BNetzA | Every power plant, solar panel, and wind turbine in Germany |
| SMARD | BNetzA | Real-time electricity generation by source |
| Klimaschutzgesetz NRW | State government | Legal targets and reduction pathways |
| Geoportal NRW / LANUV | State agencies | Land use, environmental data, solar roof potential |
| Bundesagentur für Arbeit | Federal agency | Employment in coal regions |

No single view exists that answers: **How much have we built? How fast are we building? Is it enough?**

## The Cost of Not Knowing

| Risk | Consequence |
|---|---|
| **Missed Climate Targets** | Germany's legally binding 2030 targets (65% CO2 reduction vs. 1990) require NRW — if NRW fails, Germany fails |
| **Stranded Investment** | Billions in coal-region structural funding (Strukturstärkungsgesetz) risk misallocation without transparent progress data |
| **Grid Instability** | Retiring 8+ GW of coal without matching renewables threatens baseload supply in Germany's most populous state |
| **Employment Crisis** | 8,200+ direct coal jobs in the Rheinisches Revier depend on timely transition planning — not last-minute closures |
| **Political Credibility** | If Germany's industrial heartland can't manage the transition, it undermines the Energiewende narrative nationally and in the EU |

## The Solution

The **Energiewende-Monitor NRW** is an interactive dashboard that consolidates real government data into four views:

- **Interactive Map** — every registered solar panel and wind turbine in NRW, visualized on a pydeck/deck.gl map (~500k installations)
- **Expansion Tracker** — cumulative installed capacity vs. the required linear trajectory to hit 2030 targets, for solar and wind separately
- **Municipality Scorecard** — which of NRW's 396 municipalities are leading the transition, and which are falling behind?
- **Gap Analysis** — "At the current installation rate, NRW will miss its 2030 target by X years" — with scenario modeling for acceleration

### The Scorecard Model

Each municipality receives a composite Energiewende score (0–100) based on:

```
Score = Percentile(Total installed capacity)
      + Percentile(3-year expansion rate)
      + Percentile(Technology diversity: solar + wind)
      + Percentile(Capacity per capita)*

* Per-capita scoring requires population data (optional input)
```

Municipalities are categorized: **Vorreiter** (pioneer, >66), **Im Zeitplan** (on track, 33–66), **Nachholbedarf** (catching up, <33).

## Data Sources

All data is **publicly available** under open licenses:

| Source | Data | License | Access |
|---|---|---|---|
| [Marktstammdatenregister](https://www.marktstammdatenregister.de) (BNetzA) | Every registered energy installation in Germany | DL-DE-BY-2.0 | Bulk XML download via [`open-mastr`](https://github.com/OpenEnergyPlatform/open-MaStR) |
| [SMARD](https://www.smard.de) (BNetzA) | Hourly electricity generation by source | CC BY 4.0 | REST API |
| Energie- und Wärmestrategie NRW | Official 2030 targets | Public document | Hardcoded reference |

**Note on SMARD regional data:** SMARD provides generation data at the transmission-zone level, not by federal state. NRW is served primarily by the **Amprion** zone, which also covers parts of other states. This is documented as a known limitation.

## Technical Architecture

```
 Offline (local machine)                  Deployed (Streamlit Cloud)
┌────────────────────────────────┐       ┌─────────────────────────────┐
│  scripts/ingest.py             │       │  Streamlit Dashboard        │
│  MaStR (open-mastr) + SMARD   │       │                             │
│  ↓ bulk download + NRW filter  │       │  Startseite  Karte   Ausbau│
│  ↓ data/processed/ (~50 MB)    │       │  (KPIs)     (pydeck) tracker│
│                                │       │                             │
│  scripts/prepare_deploy.py     │       │  Gemeinde-   Lücken-       │
│  ↓ column prune + dtype opt    │       │  ranking     analyse       │
│  ↓ data/deploy/ (~10-15 MB)   ─┼──────→  reads slim parquets       │
└────────────────────────────────┘       └──────────────┬──────────────┘
                                                        │
                                          If deploy data missing:
                                          bootstrap.py downloads from
                                          Zenodo (zero-config fallback)
```

### Technology Stack

| Component | Technology |
|---|---|
| Data ingestion (offline) | [`open-mastr`](https://pypi.org/project/open-MaStR/) + SMARD REST API |
| Processing | pandas, PyArrow (Parquet) |
| Dashboard | Streamlit |
| Map visualization | pydeck / deck.gl (WebGL, GPU-accelerated) |
| Charts | Plotly |

## Deployment

### Option A: Streamlit Community Cloud (recommended)

The fastest path to a live URL — no server to manage:

1. Run the data pipeline locally (see Option B below) to generate `data/deploy/` parquets
2. Push this repo (including `data/deploy/`) to GitHub
3. Go to [share.streamlit.io](https://share.streamlit.io) and connect your GitHub account
4. Select the repo, set main file to `app/Startseite.py`
5. Deploy — you get a public URL like `https://energiewende-nrw.streamlit.app`

**Embedding as iframe** (e.g. in Confluence, a ministry website, or Notion):

```html
<iframe
  src="https://energiewende-nrw.streamlit.app/?embed=true"
  width="100%" height="800" frameborder="0">
</iframe>
```

The `?embed=true` parameter removes Streamlit chrome for a clean embedded look.

**Data strategy for cloud:** The slim, column-pruned NRW Parquet files (~10-15 MB) in `data/deploy/` are committed to the repo. The app reads them directly at startup — no runtime downloads, no network dependencies. Cold starts are instant.

**Zero-config fallback:** If deploy data is missing (e.g. fresh clone without running the pipeline), the app automatically downloads MaStR solar+wind data from [Zenodo](https://zenodo.org/records/14843222), filters to NRW, and writes the deploy files. This makes "clone and run" work without any pipeline setup.

### Option B: Run Locally

#### Prerequisites

- Python 3.11+
- ~2 GB disk space (MaStR bulk download is large)
- Internet connection for initial data download

#### Installation

```bash
git clone <repo-url> energiewende-nrw
cd energiewende-nrw
python -m venv .venv && source .venv/bin/activate

# Install with ingest dependencies (for data pipeline)
pip install -e ".[ingest]"

# Or install runtime-only (for dashboard)
pip install -e .
```

#### Data Ingestion

Download real data from public APIs (takes ~30-45 minutes for the initial MaStR bulk download):

```bash
# Download everything (MaStR + SMARD + municipality geodata)
python scripts/ingest.py

# Or download selectively
python scripts/ingest.py --mastr     # MaStR installations only
python scripts/ingest.py --smard     # SMARD generation data only
python scripts/ingest.py --geodata   # Municipality boundaries only
```

#### Prepare Deploy Data

After ingestion, generate the slim parquet files for the dashboard:

```bash
python scripts/prepare_deploy.py
```

This reads the full parquets from `data/processed/`, prunes to only the columns
used by the dashboard, optimizes dtypes, and writes compressed files to `data/deploy/`.

#### Verify Data

```bash
python scripts/process.py
```

#### Run the Dashboard

```bash
streamlit run app/Startseite.py
```

The dashboard opens at `http://localhost:8501`.

## Project Structure

```
energiewende-nrw/
├── README.md                        # This file (English)
├── README.de.md                     # German version
├── pyproject.toml                   # Project dependencies (runtime + optional ingest)
├── requirements.txt                 # Minimal deploy deps (Streamlit Cloud reads this)
├── data/
│   ├── raw/                         # MaStR bulk downloads (gitignored)
│   ├── processed/                   # Full Parquet files (gitignored)
│   ├── deploy/                      # Slim Parquets for dashboard (committed)
│   │   ├── nrw_solar.parquet
│   │   ├── nrw_wind.parquet
│   │   └── nrw_combustion.parquet
│   └── reference/
│       └── targets.json             # Official 2030 targets
├── src/
│   ├── config.py                    # Paths, targets, dashboard constants
│   ├── bootstrap.py                 # Auto-download data on first launch (Zenodo)
│   ├── ingest/
│   │   ├── mastr.py                 # MaStR bulk download + NRW filter
│   │   └── smard.py                 # SMARD REST API client
│   └── processing/
│       ├── transform.py             # Data cleaning + aggregation
│       ├── targets.py               # 2030 gap analysis math
│       └── scorecard.py             # Municipality scoring logic
├── app/
│   ├── Startseite.py                # Dashboard home (KPI overview)
│   └── pages/
│       ├── 1_Karte.py               # Interactive installation map (pydeck)
│       ├── 2_Ausbautracker.py       # Expansion tracker vs. targets
│       ├── 3_Gemeinderanking.py     # Municipality scorecard
│       └── 4_Lueckenanalyse.py      # Gap analysis + scenarios
└── scripts/
    ├── ingest.py                    # CLI: data download (needs [ingest] deps)
    ├── prepare_deploy.py            # CLI: prune columns → data/deploy/
    ├── process.py                   # CLI: data validation
    └── download_geodata.py          # Municipality GeoJSON download
```

## License

Code: MIT

Data licenses:
- Marktstammdatenregister: [DL-DE-BY-2.0](https://www.govdata.de/dl-de/by-2-0) — © Bundesnetzagentur
- SMARD: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — © Bundesnetzagentur

---

<p align="center">
  <strong>Kanduit</strong> — Data-driven public sector intelligence
</p>
