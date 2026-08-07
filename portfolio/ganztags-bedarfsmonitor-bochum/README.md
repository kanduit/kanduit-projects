# Ganztags-Bedarfsmonitor Bochum

Germany's statutory claim to all-day primary-school care (§ 24 (4) SGB VIII) took effect
on 1 August 2026 and phases in one year group at a time until 2029/30. This demonstrator
answers the question that follows for the youth welfare office of the city of Bochum:
**which primary-school catchment breaches the claim in which school year — and at what
parental take-up rate does the city-wide balance tip?** Everything rests on published
data, above all the city's own cohort projection.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of Stadt Bochum. All figures come
> from **published sources**: the city's *maponline* map service (theme "Grundschulen"),
> the BOStatIS statistics portal, the NRW education ministry's open data, and a press
> report of the city's city-wide all-day-care figures. Only year-group and district
> aggregates are processed — no individual or social-services data under §§ 61 ff.
> SGB VIII in conjunction with SGB X.

---

## The analytical core

For each primary-school catchment the city publishes the year groups 1–4 of school year
2025/26, the resident children aged 0–5 (as of 2025) after a 7.5 % deduction, and its own
occupancy projection through 2031/32 — **but not how that projected occupancy splits
across the four year groups.** That split is exactly what the statutory phase-in needs.

It is reconstructed: year group *k* in projection year *i* comes from the intake cohort
*i − k + 1*; if that lies in the future it is the projected age cohort, otherwise the
corresponding 2025/26 year group. **The check is hard-wired:** the reconstructed year
groups must sum to the published occupancy — across all 47 catchments × 7 projection
years = **329 cases with no deviation**. If a future fetch disagrees on a single value,
`scripts/generate.py` aborts rather than silently shipping a wrong number.

So the monitor does not estimate cohorts. It lays the statutory entitlement logic over
the school authority's own cohort arithmetic.

## What the data shows

- By 2029/30 the claim covers all four year groups and thus **11,734 children**. At the
  same time the cohorts shrink — the city itself expects 11,734 rather than the 12,445
  children of 2026/27.
- At today's observed take-up of **69.8 %** the 8,397 places suffice city-wide. **Above
  71.6 % they do not.** That is 1.7 percentage points of headroom — the phase-in alone
  does not break the stock, the parental take-up rate does.
- **Two effects meet in 2029/30, and they do different jobs.** The *year* is set by the
  statutory phase-in: before it, the stock cannot break arithmetically — 2027/28 would
  require 137 % take-up, 2028/29 still 94 %. Only from 2028/29 does the threshold fall
  below 100 %, reaching its minimum of 71.6 % in 2029/30: full entitlement while the cohort
  is still near peak. It then rises again to 78 % as cohorts shrink — **the problem is a
  hump, not a ramp.** *Whether* it breaks is set by take-up: at an unchanged 69.8 % the
  stock suffices throughout. Between the two documented reference points registered demand
  grew by **1.33 points per year** — and a crossing in 2029/30 needs only **0.58 points per
  year.** That margin is the actual finding: even if 56 % of the observed rise were a
  one-off registration effect of the new entitlement rather than a trend, the crossing in
  2029/30 would still hold.
- Even with a sufficient balance, **21 of 47 locations** show a gap: the places sit where
  the children are becoming fewer. **Moving places only into adjacent catchments** cuts
  that to 8 locations and the shortfall from 568 to 130 — without a single new place.
- Births fell from 3,457 (2018) to 2,759 (2025) — the leading indicator for every intake
  projection through 2031/32.
- In euros: the municipal own-share runs at about **€5.5 m** a year in 2029/30, the state
  grant at **€9.5 m**. Closing the gap costs the city a further **€374 k** annually —
  excluding investment and room costs, which are not public.

## Views

| View | Focus | Data gap |
|---|---|---|
| **Überblick** (Overview) | entitled children per school year by year group against the published city-wide place count; birth series as leading indicator | the city-wide count is documented, its distribution is not |
| **Karte** (Map) | 47 catchments shaded by coverage ratio, switchable by school year and scenario | coverage differences come from cohorts, not from location capacities |
| **Lückenampel** (Gap traffic light) | all locations, sortable, with the year the gap opens; CSV export shaped for a committee paper | the "places" column is the model's single distribution assumption |
| **Standorte** (Locations) | year-group trajectory, cohort origin by age year, free primary-school capacity per the city | social index only per main school, not per satellite site |
| **Szenarien** (Scenarios) | "Stufenplan Regelfall", "Kipppunkt Elternquote", "Umverteilung statt Ausbau", plus five sliders, take-up as a time axis and the cost picture in euros | provider, staffing and room capacity as well as investment costs are not public |
| **Daten & Methode** (Data & method) | register reconciliation 49/47/46, source list with status, step-by-step calculation | states explicitly what requires a data delivery from the authority |

## The single assumption — stated openly, in two versions

**No public dataset lists all-day places per primary school.** Only the city-wide figure
of 8,397 places for 2026/27 is documented. It is distributed across locations in the base
year in proportion to pupil numbers and then held fixed. It follows that every difference
in coverage between locations arises from the city's cohorts, not from invented location
figures. If the authority supplies its numbers, they replace exactly one line in the
model — the method is unchanged. The column is flagged as an assumption throughout the UI.

Rather than hiding the gap, the monitor makes it measurable: it offers **two defensible
distributions of the same documented total**, switchable in every view. Alongside the flat
per-pupil distribution there is a **social-index-weighted** one, using the state's
school-level social index as a take-up factor — exactly one free parameter, the total stays
at 8,397. A dedicated view shows the difference between the two per catchment. That is the
line for the meeting: *"here are two defensible distribution assumptions; the distance
between them is exactly what your own place list would resolve."* The flat distribution
remains the default.

**What was deliberately not built:** a capacity prediction model trained on other NRW
cities. The training data does not exist (no state dataset lists all-day places per
school), the target is path-dependent administrative history rather than a natural
phenomenon, and such a model would devalue the 329 reproduced values. Every number in the
monitor falls into exactly one of three classes — **measured**, **reconstructed** or
**assumed** — and the class is visible in the UI. There is no fourth class of estimated
figures presented as measured.

**Reading the phase-in years:** from 2026/27 to 2028/29 only one to three year groups hold
a claim, yet all four occupy the same places. There the traffic light measures how much of
the stock is legally committed — not actual demand. That it is already tight in practice
is the city's own figure: 292 rejections for 2026/27. The location view shows both
quantities side by side.

## How many primary schools does Bochum have?

Three sources, three numbers — and none of them is wrong:

| Source | Count | Counting basis |
|---|---|---|
| City announcement, May 2026 | 49 | basis not stated |
| City map service | **47** | catchments: 41 sites + 6 satellite sites |
| NRW school register | 46 | in operation: 43 public + 3 private |

The monitor works on the 47 catchments — only they carry cohorts and boundaries. Two
public schools have no catchment of their own (Don-Bosco-Schule, Weilenbrink-Schule); the
three private substitute schools have none by definition. Hence the monitor counts 12,277
rather than 13,110 children. The "Daten & Methode" view spells this out instead of
smoothing it over.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| [Stadt Bochum, *maponline* map service, theme "Grundschulen"](https://geoservicekkm.bochum.de/arcgis/rest/services/maponline/Grundschulen/MapServer) | 47 catchments: boundaries, address, year groups 2025/26, residents aged 0–5 (as of 2025), projected cohorts, occupancy and capacity projection 2025/26–2031/32 | ArcGIS REST, layer 10 (layers 10–15 carry identical attributes) |
| [Stadt Bochum, BOStatIS](https://bostatis.bochum.de/) | births and deaths per statistical district 2017–2025 | catalogue endpoint `POST /service/app/search/all` → CSV |
| [Stadt Bochum, BOStatIS (open data)](https://bostatis.bochum.de/) | residents by single age year per statistical district, 31 Dec 2022, rounded to 5 | same endpoint → CSV |
| [NRW Ministry of Education, open data](https://www.schulministerium.nrw/open-data) | school register, pupil numbers, social index levels, time series from 2012 | CSV |
| [Press report of city figures, 18 May 2026](https://www.radiobochum.de/artikel/mehr-ogs-plaetze-an-grundschulen-in-bochum-2651761) | city-wide all-day figures for 2022/23 and 2026/27: places and rejections | HTML; every value is verified in the source text at fetch time |
| [BASS 11-02 no. 19, edition BASS 2026/2027](https://bass.schule.nrw/4938.htm) | all-day funding rates from 1 Aug 2026: state grant, municipal own-share, parental fee ceiling, annual uplift | HTML; every amount is verified in the directive at fetch time |
| derived from the catchment boundaries | adjacency graph of the 47 catchments, 115 edges | own file `data/sources/bo_nachbarschaft.json`, checkable by hand |

Two caveats on robustness: the map service is publicly reachable and embedded in the
city's geoportal, but it is **not listed as a licensed open-data dataset in the portal** —
clearance with the authority is required before productive use. The all-day figures are a
**secondary source**; before any use beyond this demonstrator they should be checked
against the youth welfare committee paper.

## Pipeline

```bash
python3 scripts/fetch_grundschulbezirke.py  # map service → bo_grundschulbezirke.json + bo_nachbarschaft.json
python3 scripts/fetch_bostatis.py           # BOStatIS → bo_geburten.json, bo_altersjahrgaenge.json
python3 scripts/fetch_msb.py                # ministry → msb_*.json
python3 scripts/fetch_ogs_eckwerte.py       # city-wide figures → bo_ogs_eckwerte.json
python3 scripts/fetch_bass.py               # funding directive → bass_ogs_foerderung.json
python3 scripts/generate.py                 # snapshots → data.js (aggregated, deterministic)
python3 serve.py                            # local preview → http://localhost:8126
```

Only filtered snapshots are committed (about 100 KB in total), so `generate.py` runs
offline and reproducibly; two runs produce a byte-identical `data.js`. Source-specific
notes:

- **Catchment boundaries** are simplified with Douglas-Peucker at 25 m tolerance
  (2,564 of 17,497 vertices) and rounded to four decimals — an overview map, not a
  cadastral one.
- **Satellite sites** carry a school number with a `T` suffix in the map service; the
  reconciliation with the state register maps them back to the parent school number.
- The field `PR_SJ_4` holds the malformed value `2029.203` in the source; it is read as
  school year 2029/2030 and the correction is documented in `data.js` and in the UI.
- Age cohorts are rounded to 5 for data-protection reasons (the city's "D5" method) —
  good for orders of magnitude, not for individual place decisions.
- The **adjacency graph** is computed on the *unsimplified* geometry: two catchments count
  as adjacent when their rings share at least two vertices. After simplification that would
  no longer be reliable. Result: 115 edges, no catchment without neighbours — otherwise the
  fetch aborts.
- The **take-up slope** comes from two documented reference points on the same denominator;
  the official pupil series does not yet reach 2026/27, so the latest value (2025/26) stands
  there. That one-year offset is named in the UI rather than calculated away.

## How to read the trend figure

The **1.33 points per year is not a regression line but a line connecting two documented
years** — the UI therefore calls it "average change between two documented years"
throughout, never "trend". The objection that will come up in the meeting is stated in the
monitor itself: the endpoint 2026/27 is precisely the year the entitlement took effect, so
the new legal situation plausibly triggered registrations that previously did not happen.
A level shift extrapolated linearly over four years is exactly the kind of number a
planning officer takes apart.

The claim therefore does not rest on the **size** of the change but on its **margin over
what is required**: 0.58 versus 1.33 points per year. And the 1.7-point gap explicitly
**cannot** be converted into a remaining runtime — that division assumes the 2029/30
threshold already applies today. It does not.

## What was not built — and why

**No peer-city benchmark.** Municipal-level all-day rates sit in the NRW state database
(GENESIS-Online), whose table retrieval requires a login; there is no anonymous,
reproducible fetch. No reproducible source, no metric — typing the numbers in by hand would
break a pipeline that otherwise runs offline and traceably throughout.

**No state-wide all-day rate beside the Bochum curve.** It uses a different denominator
(all primary pupils versus an all-day take-up) and could not be sourced reliably for the
same reason. Two quantities with different denominators do not belong in one chart, so the
monitor shows the Bochum series alone and names its denominator at the chart.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/ganztags-bedarfsmonitor-bochum/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/ganztags-bedarfsmonitor-bochum-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany. The entire calculation including the
scenarios runs in the browser; the page loads nothing but its bundled data file.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
