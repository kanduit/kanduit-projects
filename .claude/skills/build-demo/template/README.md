# {{TITLE}}

TODO: one-paragraph description — what the demonstrator shows, from which
public data, for whom.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of {{CITY}}. All figures
> come from **published sources** — TODO: name them. No personal data.

---

## Views

TODO: one line per tab.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| TODO | TODO | TODO |

## Pipeline

```bash
python3 scripts/fetch_<quelle>.py  # raw data → data/sources/*.json (filtered, small)
python3 scripts/generate.py        # snapshots → data.js (aggregated, deterministic)
python3 serve.py                   # local preview → http://localhost:{{PORT}}
```

Only filtered snapshots are committed, so `generate.py` runs offline and reproducibly.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/{{SLUG}}/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/{{SLUG}}-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
