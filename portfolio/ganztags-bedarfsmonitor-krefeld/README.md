# Ganztags-Bedarfsmonitor Krefeld

How many all-day school places (Ganztagsplätze) does Krefeld need at each stage of
the statutory entitlement under § 24 (4) SGB VIII (GaFöG) — per primary school, per
district, through school year 2029/30? The demonstrator sets the city's published
expansion plan (OGS report, January 2026) against the demand implied by its own
small-area population register, and shows the resulting gap at each stage. The
audience is a youth-welfare department that already publishes an annual report: this
**complements** that report with the forward view, it does not replace it, and it is
not a production system.

The methodological core: every child who will start school by 2029/30 has **already
been born and is recorded in the population register**. Demand therefore does not need
to be forecast, only rolled forward — using a migration rate measured from the
2012–2024 series and validated by a backtest (mean absolute error 1.7 %).

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of Stadt Krefeld. All figures
> come from **published sources**: Krefeld's small-area population data and official
> area classification, the city's OGS report (January 2026), the NRW school ministry's
> open data, and Open Data NRW's childcare-facility geodata. No personal data —
> aggregation level is school, district and year group.

---

## Views

| View | Key finding | Honest gap |
|---|---|---|
| **Überblick** (Overview) | Coverage falls from 90 % (2026/27) to 81 % (2029/30) even though capacity grows as planned | Year-group size is a block average — single-year birth counts per district are not open data |
| **Karte** (Map) | 32 primary schools, traffic-light colouring by coverage, point area ∝ demand | Point is the school location, not a catchment area |
| **Bezirke** (Districts) | Demand/capacity/gap per Stadtbezirk (5, political) or Stadtteil (19, statistical), sortable, CSV export | Demand follows **residence**, capacity follows **school location** — without catchment areas, district differences indicate commuting, not undersupply |
| **Szenarien** (Scenarios) | Staged entitlement, expansion pace (target reached 2034/35 at 15 groups/year, 2031/32 at 30), and higher take-up | Staff, room and canteen capacity are not modelled; the OGS report names them as the bottleneck |
| **Deckungsgradrechner** (Coverage calculator) | Effect per expansion step (375 places ≈ +4.3 percentage points); every assumption adjustable | Steps act city-wide here, in reality at a specific site |
| **Kennzahlenblatt** (Metric sheet) | One printable sheet per school with the full calculation and per-figure provenance | Places per individual school is the central demo assumption |

## Data sources

| Source | Content | Used for |
|--------|---------|----------|
| [Stadt Krefeld, FB 312 — small-area population data](https://www.offenesdatenportal.de/organization/stadt-krefeld) | Age groups under 3 / 3–<6 / 6–<10 per statistical district, 2012–2024 | Demand side: year-group sizes, migration rate, backtest |
| [Stadt Krefeld — official area classification](https://open.nrw) | 5 Stadtbezirke (since 01.11.2025), 19 Stadtteile, 45 statistical districts (shapefile, EPSG:25832) | Map and area assignment |
| [Stadt Krefeld — OGS report 2026](https://www.krefeld.de/system/files/2026-01/OGS-Bericht-Krefeld-2026.pdf) | Table 4-1 (places/groups/quota 2017/18–2027/28), Fig. 4-1 (OGS quotas by social index), parent survey, canteen measures | Supply side, quotas, measures |
| [NRW school ministry — open data](https://www.schulministerium.nrw/open-data) | School register, pupil numbers, social index, time series | 32 primary school locations, coordinates, distribution weights |
| [Open Data NRW — childcare facilities](https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/) | 108 facilities in Krefeld with place counts | Over-3 places as a leading indicator |

## Pipeline

```bash
python3 scripts/fetch_<quelle>.py  # raw data → data/sources/*.json (filtered, small)
python3 scripts/generate.py        # snapshots → data.js (aggregated, deterministic)
python3 serve.py                   # local preview → http://localhost:8125
```

Only filtered snapshots are committed (about 110 KB in total), so `generate.py` runs
offline and reproducibly — running it twice yields a byte-identical `data.js`.

`fetch_ogsbericht.py` is the exception worth knowing about: the OGS report is a PDF
publication, not a machine-readable dataset. Its figures are transcribed with the table
or figure number and page cited, and the script downloads the PDF and verifies its
SHA-256 hash. If the city changes the document the check fails loudly, rather than the
figures going stale in silence.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/ganztags-bedarfsmonitor-krefeld/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/ganztags-bedarfsmonitor-krefeld-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
