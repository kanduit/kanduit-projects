# Schulinvestitions-Monitor Duisburg (School Investment Monitor)

A German school authority normally keeps three separate lists — building refurbishment
backlog, measures funded by the federal/state *Startchancen* programme, and the extra
space required by the new legal entitlement to all-day primary care — even though all
three compete for the same sites and the same budget. This demonstrator merges them into
one defensible ranking across all 135 school sites in Duisburg and shows what
each ordering costs the city in own-share funding per budget year.

A portfolio project by [Kanduit](https://kanduit.de) — digitalisation, data and software
for the public sector in North Rhine-Westphalia. The full documentation is in German:
[`README.de.md`](README.de.md).

> **Note:** this is a **demonstrator**, not a product of the City of Duisburg.
> Sites, pupil numbers, social index grades, Startchancen participation and the Säule I
> school-authority budget come unchanged from published sources of the NRW Ministry of
> Education and the City of Duisburg.
> **Building condition, measure costs and the all-day take-up rate are not public** — they
> are deterministic demo assumptions, marked ◈ throughout the interface and meant to be
> replaced by the authority's own data.
> No personal data; pupil numbers only aggregated per school (§ 120 SchulG NRW).

## Views

1. **Überblick** — headline figure (minimum annual own share), a per-pupil comparison of all 22 NRW city districts, 135 sites, 71,852 pupils, 48 Startchancen schools, 60.0 m EUR programme budget, plus a register of every demo assumption.
2. **Standortkarte** — all sites on the official district boundaries, coloured by priority rank.
3. **Standortregister** — sortable, filterable, CSV-exportable table; each row opens the site fact sheet.
4. **Priorisierung** — four freely weighted criteria; the current weighting is always readable as plain text.
5. **Eigenanteil** — municipal own share per budget year 2026–2034 under an adjustable annual cap.
6. **Szenarien** — the three named scenarios: own-share cap, all-day first, one-year delay.

A printable **fact sheet per site** is reachable from the map, the table and the ranking;
every figure carries its source, date and derivation.

## Data sources

| Source | Content | Retrieved |
|--------|---------|-----------|
| [MSB NRW Open Data](https://www.schulministerium.nrw/open-data) | school register, pupil numbers, social index grades, time series | 14.08.2026 |
| [Startchancen NRW](https://www.schulministerium.nrw/startchancen) | confirmed participant list (48 Duisburg schools) and Säule I authority budgets (60.0 m EUR for Duisburg) | 14.08.2026 |
| [Open Data Duisburg](https://opendata-duisburg.de/dataset/stadtbezirke) | official city district boundaries | 14.08.2026 |

Both Startchancen sources are PDFs; text extraction is stdlib-only (zlib over the content
streams plus a ToUnicode CMap decoder for the budget PDF's CID fonts), so the build needs
no third-party libraries.

## Pipeline

```bash
python3 scripts/fetch_msb.py
python3 scripts/fetch_startchancen.py
python3 scripts/fetch_gebiete.py
python3 scripts/generate.py   # snapshots -> data.js (deterministic, byte-identical on re-run)
python3 serve.py              # local preview -> http://localhost:8127
```

Only small filtered snapshots are committed, so `generate.py` runs offline and
reproducibly.

## Publishing (GitHub Pages)

```bash
python3 scripts/publish.py
python3 scripts/publish.py --check
```

## Tech

Static HTML/CSS/vanilla JS, hand-rolled SVG charts and map, no frameworks, no external
scripts, no tracking. All computation runs in the browser.

## Licence

Code: MIT. Data: see sources. All analyses without warranty.
