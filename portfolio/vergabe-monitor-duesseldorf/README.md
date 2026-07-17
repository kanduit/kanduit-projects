# Vergabe-Monitor Düsseldorf

Public-procurement KPIs for the City of Düsseldorf, built **entirely from public
eForms notices** — procedure mix, award durations, a 2026 direct-award scenario, an
NRW city benchmark and a schematic VergStatVO reporting radar. Every figure links to
its source; all processing happens in the browser.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of the City of Düsseldorf. All
> figures come from **published notices** on the Bekanntmachungsservice (Datenservice
> Öffentlicher Einkauf) — they show the publicly visible part of procurement, not the
> authority's complete internal statistics. No personal data; award winners are never
> named or ranked.

---

## Views

- **Überblick (Overview)** — notices per quarter, procedure-type mix, top CPV groups,
  stated award volume, participating contracting authorities (city · municipal
  companies · state · federal).
- **Verfahrensdauern (Durations)** — median days from contract notice to award per
  procedure type; only procedures where both dates are public, with the coverage rate
  stated honestly.
- **Direktauftrag 2026 (Direct-award scenario)** — procedure mix and monthly series
  around § 75a GO NRW (procedural freedom for municipalities since 2026-01-01; the
  binding rule is each municipality's own Vergabeordnung, not the state's direct-award
  threshold) and the Vergabebeschleunigungsgesetz (2026-07-01). The point of the view:
  direct awards barely appear in public notice data — only internal data shows the
  actual quota.
- **Benchmark NRW** — Düsseldorf vs. Cologne, Essen, Dortmund, normalized per 100,000
  inhabitants; buyer categories expose the state-capital effect.
- **Melde-Radar (schematic)** — VergStatVO 60-day reporting deadlines simulated from
  public award data (reporting threshold raised to over €50k on 2026-07-01, previously
  €25k); clearly marked as
  a concept view.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| [Bekanntmachungsservice / Datenservice Öffentlicher Einkauf](https://www.oeffentlichevergabe.de) | eForms-DE notices (competitions, awards, …) | [OpenData API](https://www.oeffentlichevergabe.de/documentation/swagger-ui/opendata/index.html), monthly CSV exports |
| [IT.NRW](https://www.it.nrw/nrw-einwohnerzahl-erstmals-auf-basis-des-zensus-2022-fortgeschrieben) | Official population figures (2024-12-31, census-2022 based) | embedded statically |

Notices are filtered by **place of performance** (NUTS): Düsseldorf DEA11, Cologne
DEA23, Essen DEA13, Dortmund DEA52 — mirroring the
[public search UI](https://oeffentlichevergabe.de/ui/de/ausschreibungen_duesseldorf_kreisfreie_stadt_DEA11).
This includes state and federal institutions located in the city; the buyer-category
breakdown makes that share visible.

## Pipeline

```bash
python3 scripts/fetch_notices.py   # OpenData API → data/sources/notices-YYYY-MM.json
python3 scripts/generate.py        # snapshots → data.js (aggregated)
python3 serve.py                   # local preview → http://localhost:8124
```

`fetch_notices.py` downloads the monthly CSV exports (~17 MB/month, cached) and commits
only the **filtered** snapshots (~200 KB/month), so `generate.py` runs offline and
reproducibly. Winner/company names are **not** extracted during filtering
(anti-corruption sensitivity — categories instead of names).

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/vergabe-monitor-duesseldorf/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/vergabe-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Notice data: Bekanntmachungsservice / Datenservice Öffentlicher Einkauf
(public OpenData interface). All analyses without warranty.
