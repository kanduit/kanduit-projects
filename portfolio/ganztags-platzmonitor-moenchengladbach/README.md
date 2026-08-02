# Ganztags-Platzmonitor Mönchengladbach

The demonstrator breaks Mönchengladbach's city-wide shortfall of all-day primary
school places down to its 38 individual schools and four city districts — for every
expansion stage of the statutory entitlement under § 24 (4) SGB VIII up to school
year 2029/30. Capacity per site is derived from floor area and usage assumptions
rather than fixed group sizes, because the city is moving to open and semi-open
models with multi-purpose rooms. Alongside it sits the effect of each planned
construction or conversion measure: how many places, at which site, from when.
The audience is a municipal education department that allocates places centrally
and has to budget the expansion — not a case-management system, but a planning
and decision layer.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of Stadt Mönchengladbach. All figures
> come from **published sources**: the NRW Ministry of Education open-data offering
> (school register, pupil and class counts, social-index levels), Open Data NRW
> (day-care facilities) and OpenStreetMap (city-district boundaries, ODbL). The room
> parameters of the capacity model, the participation rate of non-entitled year groups
> and the list of measures are **clearly labelled demo assumptions**, flagged as such
> throughout the interface. No personal data; aggregation level school, city district,
> year group (§ 120 SchulG NRW).

---

## Views

| View | Focus | Known gap |
|---|---|---|
| **Überblick** (Overview) | Demand, capacity and shortfall per expansion stage; plausibility anchor against the officially published 2026/27 figures | Per-school year-group sizes are not open — pupils ÷ 4 |
| **Karte** (Map) | 38 sites coloured by coverage ratio, point area ∝ demand | School catchment areas are not published |
| **Standorte** (Sites) | Sortable site and district table with CSV export | Day-care Ü3 stock is an indicator, not a transition rate |
| **Kapazitätsmodell** (Capacity model) | Capacity from area and usage; eight adjustable assumptions | Per-site room books are not published |
| **Maßnahmen** (Measures) | Place effect per site and year, cumulative | Measure list is entirely a demo assumption |
| **Kennzahlenblatt** (Metrics sheet) | Printable one-pager per site with full calculation trail | Demo assumptions marked inline |

Three scenarios — staged plan to 2029/30, high uptake (+10 / +20 percentage points)
and room options (with vs. without measures) — apply across all views.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| [MSB NRW open data](https://www.schulministerium.nrw/open-data) | School register (address, UTM coordinate, legal form), pupils per school, social-index levels 2025/26 | 2026-08-03 |
| [MSB NRW open data](https://www.schulministerium.nrw/open-data) | Pupils, classes and schools in Mönchengladbach per school year, 2012 onwards | 2026-08-03 |
| [Open Data NRW — day-care facilities](https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/) | Ü3/U3 place counts (only coordinate and counts are kept) | 2026-08-03 |
| [OpenStreetMap via Overpass](https://www.openstreetmap.org/relation/62644) | Boundaries of the four city districts and the city (ODbL) | 2026-08-03 |
| [Stadt Mönchengladbach — OGS expansion](https://www.moenchengladbach.de/aktuell-aktiv/newsroom/ogs-ausbau-in-moenchengladbach-umsetzung-des-rechtsanspruchs-ab-2026-27) | Anchor figures 2026/27: 2,000–2,100 places needed, ~1,380 free, up to 720 to be created | 2026-08-03 |
| [Bildungsnetzwerk — open all-day school](https://www.moenchengladbach.de/bildungsnetzwerk-ogs/der-offene-ganztag) | Context on open and semi-open models | 2026-08-03 |

**Why OpenStreetMap:** neither MSB open data nor opengeodata.nrw.de publish
sub-municipal district boundaries. OSM is the only openly available source; it is
credited with its licence in the interface. **Not used:** Landesdatenbank NRW
(IT.NRW) has no openly scriptable interface — the MSB time series 2012–2025 takes
its place.

## Pipeline

```bash
python3 scripts/fetch_msb.py       # school register, pupils, social index, time series
python3 scripts/fetch_kitas.py     # day-care Ü3 stock (no names, providers or addresses)
python3 scripts/fetch_bezirke.py   # city-district boundaries from OSM (Overpass, mirrored)
python3 scripts/generate.py        # snapshots → data.js (aggregated, deterministic)
python3 serve.py                   # local preview → http://localhost:8123
```

Only filtered snapshots are committed (under 40 KB in total), so `generate.py` runs
offline and reproducibly — two runs produce a byte-identical `data.js`. Coordinates
arrive as EPSG:25832 and are converted to WGS84 by `scripts/geo.py` without third-party
libraries; point-in-polygon assigns each of the 38 sites unambiguously to one district.
Facility names, providers, addresses and phone numbers are discarded at fetch time.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/ganztags-platzmonitor-moenchengladbach/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/ganztags-platzmonitor-moenchengladbach-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
