# Implementation log — Anlagen- und Fristenmonitor BDH

Branch `FEATURE-anlagen-fristenmonitor-bdh`. Not committed.

## Commands

```
python3 scripts/fetch_prtr.py
python3 scripts/fetch_eu_registry.py
python3 scripts/fetch_isa.py
python3 scripts/fetch_44bv.py
python3 scripts/fetch_gebiete.py
python3 scripts/generate.py   # twice
shasum data.js
python3 scripts/publish.py
python3 scripts/publish.py --check
grep -rn '{{|TODO' portfolio/anlagen-fristenmonitor-bdh   # empty
```

Chrome headless `--dump-dom` against `http://localhost:8129/` (desktop and 375×812). Cursor browser MCP had no usable tab in this session.

## shasum (SHA-1)

```
f71e9630f6a80192f2788fc90a3c15aa28393b84  data.js
```

Identical on two `generate.py` runs. Same hash in `docs/anlagen-fristenmonitor-bdh/data.js` after publish.

`data.js` 79.065 bytes. `publish.py --check` printed `docs/ is in sync with source ✓`.

## Checks observed

- PRTR 2024 unique inspire_id = 40, all 40 ⊂ EU `inspire_betrieb`.
- Hagen filter is `bundesland=NW` and exact `ort=Hagen` (no Niedersachsen Hagen).
- Dual registers only. Leitzahl in the rendered DOM is **26** (annual MFA in the next 12 months), with 55 overdue after 01.01.2025 beside it. Not 40 PRTR.
- No `TODO` / `{{` under the project folder. No Betreiber names, no Winkelmann, no `__pycache__`, no sqlite in the repo.
