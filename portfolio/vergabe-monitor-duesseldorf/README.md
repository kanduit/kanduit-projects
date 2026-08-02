# Vergabe-Monitor Düsseldorf

Public-procurement KPIs for the City of Düsseldorf, built **entirely from public
eForms notices** — procedure mix, award durations, competition intensity and an NRW
city benchmark. The unit of analysis is the **contracting authority**, never the place
of performance. Every figure links to its source; all processing happens in the browser.

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
  stated award volume and procurement units — all for the **city administration as
  buyer**, not the location.
- **Wer beschafft? (Who actually buys?)** — decomposition of all notices with place of
  performance Düsseldorf by actual contracting authority (city, own operations, state,
  federal, public undertakings). Headline: a place filter overstates city volume 3.8×.
- **Verfahrensdauern (Durations)** — median days from contract notice to award per
  procedure type; only procedures where both dates are public, coverage stated honestly.
- **Wettbewerb (Competition)** — bidder counts from award notices: distribution and the
  product categories with the thinnest competition.
- **Benchmark NRW** — Düsseldorf vs. Cologne, Essen, Dortmund per 100,000 inhabitants,
  compared as **municipal total** (administration + own operations), because the cities
  run the same tasks in different legal forms. The comparison's limits are stated in the
  view itself.

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
