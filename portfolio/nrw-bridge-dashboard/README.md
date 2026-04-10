<p align="center">
  <img src="assets/kanduit-logo.png" alt="Kanduit" width="80" />
</p>

<h1 align="center">Brückenmonitor NRW</h1>
<p align="center"><strong>Bridge & Infrastructure Risk Monitoring for North Rhine-Westphalia</strong></p>
<p align="center">
  Turning fragmented inspection data into actionable infrastructure priorities —<br/>
  so decision-makers know <em>which bridges need attention first</em>, before the next Leverkusen happens.
</p>

---

> **Deutsche Version:** [README.de.md](README.de.md)

## The Problem

North Rhine-Westphalia maintains approximately **15,000 road bridges**, many built during the Wirtschaftswunder of the 1960s and 70s. These structures were designed for 60-year lifespans and far lower traffic volumes than they carry today.

The **A1 Rhine Bridge at Leverkusen** became a national symbol of this crisis: weight-restricted in 2012, partially closed for years, and responsible for an estimated **€2 billion in economic damage** from rerouted freight traffic alone. But Leverkusen was not an outlier — it was simply the first to fail publicly.

The underlying data problem is equally severe: condition assessments (Bauwerksprüfung nach DIN 1076) produce **condition grades from 1.0 to 4.0**, but these exist as isolated PDFs and fragmented databases. There is no unified system that combines structural condition, traffic loading, economic impact, and satellite-detected ground movement into a **single prioritization view**.

## The Impact of Inaction

| Risk | Consequence |
|---|---|
| **Public Safety** | Structural failures endanger lives — Leverkusen required emergency closures |
| **Economic Cost** | Bridge closures force detours costing millions per day in freight delays |
| **Legal Liability** | Under German law, road authorities bear personal liability for known defects (Verkehrssicherungspflicht) |
| **Cascading Failure** | Overloaded detour bridges accelerate deterioration of alternative routes |
| **Political Risk** | Infrastructure failures erode public trust in government stewardship |

## Our Solution

The **Brückenmonitor NRW** is an integrated risk dashboard that:

- **Visualizes all ~15,000 bridges** on an interactive map, color-coded by composite risk score
- **Ranks the Top 50 most critical bridges** using a transparent, weighted scoring model
- **Enables drill-down** into each bridge's inspection history, traffic volumes, and satellite-detected ground movement (InSAR)
- **Supports filtering** by road class, condition grade, construction decade, and risk threshold
- **Runs entirely in a browser** — no server, no installation, no IT department required

### The Risk Model

Each bridge receives a composite score (0–1) based on five weighted factors:

```
Risk Score = 0.30 × Condition Grade (DIN 1076)
           + 0.20 × Age Beyond Design Life
           + 0.20 × Traffic Load Ratio (actual vs. design)
           + 0.15 × Structural Redundancy (single-span = higher risk)
           + 0.15 × Economic Detour Cost (impact if closed)
```

This model is intentionally transparent and auditable — every weight and input is visible, not a black-box ML model. Weights can be adjusted by domain experts.

## Live Demo

Open the dashboard in any modern browser:

```bash
cd nrw-bridge-dashboard
python -m http.server 8000
# Then open http://localhost:8000
```

Or simply open `index.html` directly (note: some browsers block local file AJAX requests; the HTTP server approach is more reliable).

**Features at a glance:**
- Interactive map with marker clustering at low zoom levels
- Color legend: green (low risk) → yellow → orange → red (critical)
- Sidebar with Top 50 ranked critical bridges
- Click any bridge for detailed inspection history and InSAR charts
- Filter bar for road class, condition grade, decade, and minimum risk score

## Technical Architecture

### Databricks Lakehouse Approach

In a production deployment, this system would be powered by a **Databricks Lakehouse** with a medallion architecture:

```
Bronze (Raw)          Silver (Cleaned)         Gold (Analytics)
─────────────         ────────────────         ────────────────
BASt SIB-Bauwerke  →  Standardized grades   →  Risk scores
Straßen.NRW traffic → Unified traffic data  →  Top-N rankings
OpenStreetMap        → Geocoded bridges      →  Map-ready GeoJSON
Haushaltsplan NRW    → Budget allocations    →  Cost-benefit analysis
Copernicus InSAR     → Displacement series   →  Anomaly flags
```

**Delta Lake** ensures a full audit trail (time travel) of every condition assessment — critical for legal accountability under German road safety law.

### Data Sources

| Data Source | Type | Availability |
|---|---|---|
| BASt bridge database (SIB-Bauwerke) | Condition ratings, structure type, age | Partially open / FOI requestable |
| Straßen.NRW traffic counts | AADT (average annual daily traffic) | Open data portal |
| OpenStreetMap | Bridge locations, road network | Open |
| Haushaltsplan NRW | Maintenance budgets by road category | Published PDF → parsed |
| Copernicus Sentinel-1 SAR | InSAR displacement monitoring | Open (ESA) |

### Industry References

- **Google DeepMind** has partnered with infrastructure agencies to apply ML to structural health monitoring. We adopt a simpler but production-ready approach: anomaly detection on InSAR time-series data.
- **Palantir's** work with the US Army Corps of Engineers on infrastructure asset management is a direct analog — linking inspection, financial, and usage data into a single prioritization model.
- **Databricks Delta Lake** ensures full audit trail (time travel) of every condition assessment, critical for legal accountability.

## Project Structure

```
nrw-bridge-dashboard/
├── index.html              # Dashboard (single-page application)
├── css/style.css           # Dashboard styles
├── js/
│   ├── app.js              # Data loading & event coordination
│   ├── map.js              # Leaflet map with clustering
│   ├── charts.js           # D3 inspection & InSAR charts
│   └── filters.js          # Filter controls
├── data/
│   ├── bridges.geojson     # All ~15,000 bridges with properties
│   └── top50.json          # Pre-computed top 50 critical list
├── assets/
│   └── kanduit-logo.png    # Kanduit logo
├── scripts/
│   ├── generate_data.py    # Data generation pipeline
│   └── requirements.txt    # Python dependencies
├── README.md               # This file (English)
└── README.de.md            # German version
```

## Regenerating Data

To regenerate the bridge dataset (e.g., with different parameters):

```bash
cd scripts
pip install -r requirements.txt
python generate_data.py
```

The script fetches real bridge locations from OpenStreetMap (with synthetic fallback) and generates realistic condition, traffic, and InSAR data for ~15,000 bridges.

## Technology Stack

- **Frontend:** Pure HTML/CSS/JS — no build step, no framework, no server
- **Map:** Leaflet 1.9 + Leaflet.markercluster (CDN)
- **Charts:** D3.js v7 (CDN)
- **Data generation:** Python 3 + NumPy + Requests
- **Data format:** GeoJSON + JSON

---

<p align="center">
  <strong>Kanduit</strong> — Data-driven infrastructure intelligence
</p>
