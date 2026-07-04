# Changelog — Schulbau-Monitor Düsseldorf

Human-readable history of notable changes, in addition to the full git history on
GitHub. Newest first. Dates are `YYYY-MM-DD`.

## 2026-07-04

### Added — metric tooltips & definitions
- **ⓘ hover tooltips on every metric** so the demo can be shared with stakeholders
  who need to understand what each number means. Implemented as a central
  `METRIC_INFO` glossary in `app.js` plus a reusable `infoIcon()` helper, wired
  into the Overview KPIs, table headers, map metric toggles, the priority-model
  weights and the school drawer. Reuses the existing cursor-following tooltip; new
  `.info-i` styling in `styles.css`.
- **Metric definitions in both READMEs** (`README.md` EN, `README.de.md` DE) — a
  plain-language glossary table (what each metric represents · scale/unit · how we
  derive it), kept in sync with the in-app tooltip text. Real vs. illustrative
  values are marked explicitly.
- Shipped in PR #7 (`FEATURE-tooltip` → `main`).

### Added — reliable source → docs publish flow
- Established the intended split explicitly: **`portfolio/schulbau-monitor-duesseldorf/`
  is the source of truth**; GitHub Pages serves a public-only copy from the repo's
  **`/docs`** folder. See the *Deployment* section in the README.
- **`scripts/publish.py`** copies the four deployable files (`index.html`, `app.js`,
  `styles.css`, `data.js`) source → `docs/`, with a `--check` mode. It never copies
  the internal `*.internal.md`, raw source data, generator or `serve.py`.
- **`.github/workflows/schulbau-publish-check.yml`** runs `publish.py --check` on
  every push/PR touching the demo and **fails CI if `docs/` is out of sync** — so
  "edited the source but forgot to publish" (which had left the live site stale)
  can no longer reach `main`.
- Shipped in PR #8 (`FEATURE-publish-flow` → `main`).

### Deployment / branch housekeeping
- During review, GitHub Pages was temporarily pointed at the `FEATURE-tooltip`
  branch to preview the changes. After both PRs merged, Pages was set back to
  **`main` /docs** (the standard production source).
- The temporary `FEATURE-tooltip` and `FEATURE-publish-flow` branches were deleted
  after merge; their history is preserved in the merge commits on `main`
  (PR #7 = `6c361c5`, PR #8 = `497e29d`).

---

_Older history (initial demo, table/layout fixes, branding) predates this file —
see the git log and merged PRs #1–#6._
