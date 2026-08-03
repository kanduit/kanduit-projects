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
> (day-care facilities) and the City of Mönchengladbach's official Kleinräumige
> Gebietsgliederung (city-district boundaries). The room
> parameters of the capacity model, the participation rate of non-entitled year groups
> and the list of measures are **clearly labelled demo assumptions**, flagged as such
> throughout the interface. No personal data; aggregation level school, city district,
> year group (§ 120 SchulG NRW).

---

## Views

| View | Focus | Known gap |
|---|---|---|
| **Überblick** (Overview) | Demand, capacity and shortfall per expansion stage; plausibility anchor against the officially published 2026/27 figures; backtest of the trend extrapolation | Per-school year-group sizes are not open — pupils ÷ 4 |
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
| [Stadt Mönchengladbach — Kleinräumige Gebietsgliederung](https://open.nrw) | Official boundaries of the four city districts (the file also carries Stadtteile, statistical districts and city blocks), EPSG:25832 | 2026-08-03 |
| [Stadt Mönchengladbach — OGS expansion](https://www.moenchengladbach.de/aktuell-aktiv/newsroom/ogs-ausbau-in-moenchengladbach-umsetzung-des-rechtsanspruchs-ab-2026-27) | Anchor figures 2026/27: 2,000–2,100 places needed, ~1,380 free, up to 720 to be created | 2026-08-03 |
| [Bildungsnetzwerk — open all-day school](https://www.moenchengladbach.de/bildungsnetzwerk-ogs/der-offene-ganztag) | Context on open and semi-open models | 2026-08-03 |

**Why the city's own geography:** it is the official classification used by the
school authority itself, district numbers included, and the district areas sum
exactly to the city's 170.47 km². As a cross-check the assignment of all 38 sites
was compared against the OpenStreetMap boundaries — it agrees in all 38 cases.

**Landesdatenbank NRW (IT.NRW):** it does have an interface — a GENESIS 2020 REST
API at `landesdatenbank.nrw.de/ldbnrwws/rest/2020/`, addressed by POST. The public
`GAST` account only clears `helloworld/logincheck`; the data services require a
(free) registered account, which rules the source out for a demonstrator that must
build reproducibly without credentials. The MSB time series 2012–2025 takes its
place. **What that costs in accuracy** is shown in the interface itself: fitted on
2012–2021, the same extrapolation would have predicted 9,934 primary pupils for
2025 against an actual 11,022 — 9.9 % short, with a mean absolute error of 8.2 %
across 2022–2025. Migration from 2022 onwards is not something a trend model can
see; a child starting school in 2029/30, by contrast, has already been born.

## Pipeline

```bash
python3 scripts/fetch_msb.py       # school register, pupils, social index, time series
python3 scripts/fetch_kitas.py     # day-care Ü3 stock (no names, providers or addresses)
python3 scripts/fetch_gebietsgliederung.py  # official city districts (shapefile, stdlib reader)
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
