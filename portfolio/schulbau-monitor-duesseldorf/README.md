# Schulbau-Monitor Düsseldorf

Interactive overview of **building condition, renovation backlog (Sanierungsstau) and
prioritization** for Düsseldorf's schools — a decision aid for budget planning,
investment steering and political communication.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available in
[`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**. The master data (school locations, district
> boundaries) is real and public; the condition, cost and priority values are
> **illustrative and synthetically generated** — not real assessments by the City of
> Düsseldorf. In production they are replaced by the authority's own data.

---

## Overview

Four views over the entire school building stock:

- **Übersicht (Overview)** — city-wide KPIs (total backlog, avg condition index,
  critical sites, modernization), distribution by condition class, backlog by school
  type and district, most-urgent sites.
- **Karte (Map)** — choropleth of the 10 city districts, switchable by avg condition /
  backlog / avg priority / modernization; all sites as points (colour = condition);
  district detail panel.
- **Schulen (Schools)** — filterable, sortable register; row click opens a site profile
  with master data, condition gauge, defects and the priority-score breakdown.
- **Priorisierung (Prioritization)** — transparent weighted model; renovation-roadmap
  simulation (annual budget → years to clear, sites per year); condition × backlog
  scatter; ranking.

**Core metrics:** condition index (0–100) / class 1–4 · renovation backlog (€) per
school, district and total · modernization progress (%) · priority score (0–100) from
four weighted criteria (condition 40 · pupils affected 20 · backlog 15 · defects &
compliance 25 — weights are configurable with the authority).

## Metric definitions

Every number shown in the app is defined here, in the same plain language as the in-app
ⓘ hover tooltips. Unless a metric is explicitly marked **(real)**, its values are
**illustrative** — deterministically generated demo data, not real City of Düsseldorf
assessments (see *Data sources & provenance* below).

| Metric (UI label) | What it represents | Scale / unit | How we get it |
|-------------------|--------------------|--------------|---------------|
| **Schulstandorte** (school sites) **(real)** | Number of recorded school sites, across the 10 city districts. | count | Real master data from Open Data Düsseldorf. |
| **Zustandsindex** (condition index) | Overall structural condition of a building — the headline quality metric. Higher = better. | 0–100 (100 = as-new, 0 = inadequate) | Generated per school; driven by build year, time since last renovation, and an age-cohort baseline. The Ø (avg) value is the unweighted mean across sites. |
| **Zustandsklasse** (condition class) | A four-band grouping of the condition index for quick triage. | Class 1 = good (≥ 75) · 2 = moderate (55–74) · 3 = poor (38–54) · 4 = inadequate (< 38) | Derived deterministically from the Zustandsindex thresholds. |
| **Kritische Standorte** (critical sites) | Count of sites in condition class 4 (inadequate) — the most urgent renovation cases. | count | Number of schools with Zustandsklasse = 4. |
| **Sanierungsstau** (renovation backlog) | Estimated cost to bring a building back to as-new condition. Shown per school, per district, and as a city-wide total. | € (often displayed in Mio € / Mrd €) | Gross floor area × a renovation-cost rate (assumption: €2,650/m²), scaled by the condition deficit (how far below 100 the index sits). District/city figures are sums. |
| **Modernisierung** (modernization) | Share of the identified modernization need that has already been carried out. Higher = more done. | 0–100 % (100 % = fully modernized) | Generated per school; higher for recently renovated and better-condition sites. The Ø value is the mean across sites. |
| **Prioritätsscore** (priority score) | A single ranking number that bundles four criteria into a transparent urgency order. Higher = more urgent. | 0–100 | Weighted sum of four criteria — **building condition 40**, **pupils affected 20**, **backlog size 15**, **defects & compliance 25** (fire safety, accessibility, contaminants). Weights are configurable with the authority. |
| **Betroffene Schüler:innen** (pupils affected) | Pupils enrolled at a site; in the overview, the sum across all sites. | count | Generated per school within plausible ranges per school type. |
| **Baujahr** (build year) | Year the building was constructed. | year | Generated per school from a realistic age-cohort distribution. |
| **Letzte Sanierung** (last renovation) | Year of the most recent renovation; blank ("—") where not set in the model. | year or "—" | Generated for ~⅓ of sites; the open-data source has no such field. |
| **Maßnahmenstatus** (measure status) | Processing stage of the renovation measure. | not started · planned · in progress · completed | Generated from the priority score and renovation year. |
| **Mängel & Recht** (defects & compliance) | Legal/safety defect flags: fire-safety defect, not accessible, suspected contaminants. | boolean flags | Generated, correlated with build year and renovation status. |
| **Schulform** (school type) **(real)** | School type, normalized to eight categories. | category | Real master data, mapped from the source's free-text type. |
| **Stadtbezirk** (city district) **(real)** | The district (1–10) a school belongs to. | category | Derived (point-in-polygon) from real coordinates and real district boundaries. |

> **District map metrics** (Ø Zustand, Sanierungsstau, Ø Priorität, Ø Modernisierung) are
> simply the per-school metrics above, aggregated over the schools in each district (mean
> for averages, sum for the backlog).

## Data sources & provenance

The dataset has **three clearly separated layers** — every field is traceable to one of them.

**1 · Real, public master data** — exactly **two sources**, both from Open Data Düsseldorf
(no other downloads, no API):

| Source | Real fields | Licence |
|--------|-------------|---------|
| [School locations](https://opendata.duesseldorf.de/dataset/standorte-der-d%C3%BCsseldorfer-schulen) | Name, address (→ street, postcode), district (Stadtteil), school type, operator, coordinates — 185 sites | Datenlizenz Deutschland – Zero – 2.0 |
| [City district boundaries](https://opendata.duesseldorf.de/dataset/stadtbezirksgrenzen-d%C3%BCsseldorf) | Boundary polygons of the 10 Stadtbezirke (GeoJSON) | Datenlizenz Deutschland – Zero – 2.0 |

**2 · Derived from the master data** (deterministic, not estimated): the **district per
school** (point-in-polygon from real coordinates + real boundaries) and the **school-type
normalisation** (free-text type mapped to eight categories).

**3 · Illustrative, generated values — *all* of them, not taken from the sources:** build
year, last renovation, pupils, gross floor area, condition index, condition class,
renovation backlog, modernization %, priority score, defect flags (fire safety,
accessibility, contaminants) and measure status. They are produced **deterministically**
(SHA-256 seed per school) by `scripts/generate.py`, are plausibly correlated, and are
**labelled as illustrative throughout the app** — but they are **not** real City of
Düsseldorf figures. District and city totals are aggregates of these generated values. A
few open assumptions live in `generate.py` (e.g. a €2,650/m² renovation-cost rate, and
pupil/area ranges per school type). In production these are replaced by the authority's
own data.

> "Last renovation" is blank ("—") for most sites: only some receive a synthetic
> renovation year, and the open-data source has no such field at all. A "—" means "not set
> in the model", not a bug.

## Technology

- Static **HTML/CSS/vanilla JavaScript** — no framework, no build step
- Charts and map as **hand-drawn SVG** — no heavy libraries, no runtime third-party scripts
- **No server logic, no database, no external API calls, no tracking** — all processing
  in the browser, fully German-hostable and DSGVO-friendly
- Dataset prepared ahead of time by a small **Python script**

## Productionizing it

A staged path: **(1) Pilot** — connect to the authority's real condition/cost data for a
scoped area, agree the condition model and priority weights, validate the figures.
**(2) Ausbau** — full stock, scheduled data refresh, PDF/Excel export for budget and
council documents, optional multi-user roles, multi-year scenarios and measure tracking,
operated on infrastructure in Germany with maintenance and support.

## Run locally

```bash
open index.html               # or:
python3 serve.py              # → http://localhost:8123
```

Regenerate the dataset: `python3 scripts/generate.py`.

## Deployment (GitHub Pages)

This folder (`portfolio/schulbau-monitor-duesseldorf/`) is the **source of truth**
— it also holds the generator, raw source data and the internal `*.internal.md`
docs, which must **not** be served publicly. GitHub Pages serves a separate,
public-only copy from the repo's **`/docs`** folder
(`docs/schulbau-monitor-duesseldorf/`, four static files only).

**Editing the source does not change the live site by itself.** Publish it:

```bash
python3 scripts/publish.py          # copy the 4 deployable files → docs/
python3 scripts/publish.py --check  # verify docs/ is in sync (used by CI)
```

Then commit both the source and the updated `docs/` copy. A GitHub Actions check
(`.github/workflows/schulbau-publish-check.yml`) runs `--check` on every push/PR
and **fails if `docs/` is out of sync**, so a forgotten publish can never reach
`main`. Full flow: *edit source → `generate.py` (if data changed) → `publish.py`
→ commit → push*.

## Licence

Code: MIT. Master data © Landeshauptstadt Düsseldorf, dl-de/zero-2-0. Condition and cost
values are illustrative.

---

Built by [Kanduit](https://kanduit.de) — your partner for digital public administration in NRW.
