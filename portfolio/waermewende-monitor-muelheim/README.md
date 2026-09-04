# Wärmewende-Monitor Mülheim

Implementation tracking for the municipal heat plan (*kommunale Wärmeplanung*) that the
city council of Mülheim an der Ruhr adopted on 16 July 2026. The demonstrator turns the
554-page-equivalent final report into a working controlling layer: all 22 indicators with
their reference and target values, the 14 measure profiles with lead responsibility and
duration, the district heating networks with their emission factors, and the plan's own
investment frame ranked by climate effect per euro. It is aimed at the *Koordinierungsstelle
Wärmeplanung* and the *Stabsstelle Klimaschutz und Klimaanpassung* — the units that have to
report on progress from now on.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of Stadt Mülheim an der Ruhr. All figures
> come from **published sources** — above all the city's own
> [final report on the heat plan](https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf)
> (editorial date 15.05.2026). No personal data.

---

## Views

1. **Überblick** — headline figure: the heat-pump rollout has to run **9× faster** than
   today (≈150 → ≈1,350 units a year), plus the greenhouse-gas path and the four
   controlling building blocks the report itself specifies.
2. **Indikatoren** — all 22 indicators from table 26 with reference and target value. The
   *actual* column is deliberately empty: none has been published since adoption.
3. **Maßnahmen** — the 14 measure profiles, filterable, each with a printable data sheet.
   Only 4 of 14 are led by the city administration itself.
4. **Netze & Prüfgebiete** — emission factors of the 11 existing networks, the four
   categories of undecided areas, and why no map is shown.
5. **Umsetzungsfortschritt** (scenario 1) — the target path per milestone year: final
   energy by carrier and sector, buildings on heat and gas grids, generation mix.
6. **Klimawirkung je Euro** (scenario 2) — investment per tonne of avoided annual
   emissions, with a slider for the one split the report does not state.
7. **Daten & Methode** — three places where the report contradicts itself, a back-test of
   the interpolation method, a cross-check of two independent series, and the assumption
   register.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| [Endbericht zur Wärmeplanung für Mülheim an der Ruhr](https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf) (PDF, 190 pp., 19 MB) | Indicators (table 26), measure profiles (ch. 6.5), network emission factors (table 35), energy and emission series (tables 36–45), investment frame (ch. 5.7) | fetched 20.08.2026 |
| [Wärmeplanung — Stadt Mülheim an der Ruhr](https://cms.muelheim-ruhr.de/stadtraum/planen-und-bauen/waermeplanung) | Council decision of 16.07.2026, FAQ on monitoring and undecided areas | fetched 20.08.2026 |

### Rights in the source

The final report states in its imprint that it may only be reproduced in full and that any
publication, including of extracts, requires the publishers' permission. This demonstrator
therefore reproduces **figures, key values and short factual fields** (lead responsibility,
duration, cost bearer) with page references, but **no text passages** from the report or its
measure profiles; all descriptive wording in the UI is our own. Separately, the interactive
map of supply areas runs on a private consultancy's infrastructure rather than a municipal
geoportal, so reuse of those geometries is unresolved — which is why the demonstrator shows
no map. Both points need clearing with the city before any publication beyond this repo.

## Pipeline

```bash
python3 scripts/fetch_endbericht.py  # PDF → data/sources/*.json (8 snapshots, 28 KB)
python3 scripts/generate.py        # snapshots → data.js (aggregated, deterministic)
python3 serve.py                   # local preview → http://localhost:8128
```

Only filtered snapshots are committed, so `generate.py` runs offline and reproducibly
(running it twice yields a byte-identical `data.js`). `fetch_endbericht.py` needs
`pdftotext` (poppler) and extracts tables by word coordinates, not by text layout — the
report has wrapped and vertically merged cells that plain text extraction loses. Every
table carries a hard check (row counts, and the energy series is reconciled against the
totals stated in the report's prose); a shifted column fails the fetch instead of quietly
producing wrong numbers.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/waermewende-monitor-muelheim/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/waermewende-monitor-muelheim-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
