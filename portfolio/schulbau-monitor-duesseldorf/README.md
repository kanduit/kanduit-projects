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

## Data sources

| Source | Data | Licence |
|--------|------|---------|
| [Open Data Düsseldorf](https://opendata.duesseldorf.de/dataset/standorte-der-d%C3%BCsseldorfer-schulen) | School locations (185 sites): name, address, district, type, operator, coordinates | Datenlizenz Deutschland – Zero – 2.0 |
| [Open Data Düsseldorf](https://opendata.duesseldorf.de/dataset/stadtbezirksgrenzen-d%C3%BCsseldorf) | City district boundaries (10 districts, GeoJSON) | Datenlizenz Deutschland – Zero – 2.0 |

Condition/cost/priority values are generated deterministically by `scripts/generate.py`
and clearly labelled as illustrative throughout the app.

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

## Licence

Code: MIT. Master data © Landeshauptstadt Düsseldorf, dl-de/zero-2-0. Condition and cost
values are illustrative.

---

Built by [Kanduit](https://kanduit.de) — your partner for digital public administration in NRW.
