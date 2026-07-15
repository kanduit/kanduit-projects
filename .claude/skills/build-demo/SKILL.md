---
name: build-demo
description: Build a new static Kanduit demo dashboard (Monitor/Demonstrator) from a build brief. Given a "Demo-Brief für Claude Code" (the fenced block produced by amt-pitch-scout — product name, public data sources, views/KPIs, scenarios, constraints), this skill scaffolds a complete portfolio project from the Kanduit template (design system, publish flow, CI check), builds a build-time data pipeline from real public data, implements the views, verifies in the browser, and opens a PR. Use whenever the user pastes a demo brief, runs /build-demo, asks to "build the demo" from a pitch dossier, or wants a new <Thema>-Monitor for a German city or Amt turned into a working demo.
---

# /build-demo — Kanduit-Demonstrator aus einem Demo-Brief bauen

Builds run **in this repo** (kanduit-projects). The heavy boilerplate (design
system, chrome, chart kit, publish flow, CI) comes from `template/` via
`scaffold.py` — do **not** re-read or re-write it, and do not read the exemplar
projects wholesale. Per-build work is only: data pipeline, views, German copy.

## Input

The argument (or pasted block) is a demo brief: product name, purpose, data
sources (URLs), views/KPIs, up to ~3 named scenarios, constraints. If missing,
ask for it (amt-pitch-scout dossiers contain one under "Demo-Brief für Claude
Code"). Derive:

- **slug** — lowercase-hyphen ASCII incl. Stadt (`kita-monitor-essen`; ue/oe/ae/ss)
- **title / brand-sub / city** — "Kita-Monitor Essen" / "Kita-Monitor" / "Stadt Essen"
- **tabs** — ≤ 6 `id:Label` pairs from the views (Überblick first; scenarios are
  usually own tabs)

## Step 1 — Clarify before building

Probe every data-source URL read-only (small GET). If one is dead, paywalled,
CORS/auth-gated at build time, or contains personal data — or a scenario is
ambiguous — ask the user now (max 3 questions, one round). **Never invent or
substitute data sources silently.**

## Step 2 — Branch + scaffold

```bash
git checkout main && git pull && git checkout -b FEATURE-<slug>
python3 .claude/skills/build-demo/scaffold.py <slug> \
  --title "…" --brand-sub "…" --city "Stadt …" \
  --tabs "overview:Überblick,…"
```

Scaffold creates `portfolio/<slug>/` (chrome, styles, app.js kit, stub data.js,
serve.py, publish.py, generate.py skeleton, README/CHANGELOG skeletons) and the
CI workflow. It does **not** touch docs/, the landing page, or git.

## Step 3 — Data pipeline (fetch → snapshot → generate)

- `scripts/fetch_<quelle>.py`: build-time only, stdlib (urllib/csv/json/zipfile).
  Cache large raw downloads in the session scratch dir (never committed); commit
  only **small filtered snapshots** to `data/sources/` (target < ~250 KB/file).
  Record fetch date + source URL in each snapshot.
- `scripts/generate.py`: aggregate snapshots → `data.js`. Offline-reproducible,
  **deterministic** (skeleton enforces `sort_keys=True`; `meta.stand` from
  snapshot metadata, never `now()`). Keep `data.js` < ~100 KB — aggregate
  harder rather than shipping row-level data.
- **Ehrliche Datenlücken:** every KPI with partial coverage says so in the UI
  ("nur X von Y … — Untergrenze") and in its METRIC_INFO entry. Simulated views
  are labeled "schematisch" / "Konzeptansicht".
- **Keine personenbezogenen Daten.** Behörden dürfen genannt werden; Firmen-/
  Zuschlagsempfänger-Namen werden schon beim Fetch verworfen, nie gerankt.
- Canonical pipeline example (read selectively, only if the source is similar):
  `portfolio/vergabe-monitor-duesseldorf/scripts/fetch_notices.py` + `generate.py`.

## Step 4 — Views

One `render<Tab>()` per tab in `app.js`, using **only** the kit helpers already
there: `statCard`, `barChart`, `columnChart` (stacked/breaks/legend), `mixBar`,
`infoIcon`, `showTip`, de-DE formatters. Fill:

- `METRIC_INFO` — one entry per KPI **and** chart; each names Berechnung UND
  Datenlücken (this feeds the ⓘ tooltips).
- `SRC_LABEL` + a `<p class="note src-note" data-src="…">` under **every** chart
  card — jede Kennzahl mit Quellen-Link.
- `.banner.warn` / `.banner.info` for scenario framing and caveats.
- Replace all TODOs in `index.html` (eyebrows, intros, footer sources) —
  German UI throughout.

For chart-usage idioms consult the pointer table in
[references/reference.md](references/reference.md) — not whole exemplar files.

## Step 5 — Verify

1. `python3 scripts/generate.py` twice → `shasum data.js` identical.
2. `grep -rn '{{\|TODO' portfolio/<slug>` → empty.
3. Serve (`python3 serve.py`; fallback: unsandboxed `nohup python3 -m
   http.server <port>` from the project dir) and check in the browser:
   every tab at desktop **and** 375 px, one ⓘ tooltip, one chart tooltip,
   footer Stand + Disclaimer, **zero console errors**, no external requests
   except Google Fonts.

## Step 6 — Publish flow

`python3 scripts/publish.py` then `--check` must print "in sync ✓"
(docs/<slug>/ = exactly index.html, app.js, styles.css, data.js).

## Step 7 — Landing page + READMEs

Add one card to `docs/index.html` and one bullet to root `README.md` using the
exact snippets in reference.md — **ASCII transliteration there** ("Duesseldorf",
"Projekt oeffnen"). Fill the scaffolded README.md / README.de.md / CHANGELOG.md.

## Step 8 — Commit + PR

Single commit on `FEATURE-<slug>`, push, `gh pr create` (body pattern in
reference.md). **Never merge — Julian merges.**

## Quality bar (final gate)

- [ ] German UI, de-DE numbers, mobile 375 px OK, zero console errors
- [ ] ⓘ on every KPI/chart; METRIC_INFO names gaps; Quellen-Link under every card
- [ ] Honest gaps stated in UI text; simulated views labeled "schematisch"
- [ ] No personal data; no company/winner names stored or ranked
- [ ] Footer: "Demonstrator der Kanduit UG … kein Produkt der <Stadt>", Stand-Datum
- [ ] generate.py deterministic; data.js < ~100 KB; publish `--check` green
- [ ] Landing card (ASCII) + README bullet + project READMEs/CHANGELOG done
- [ ] PR open, not merged
