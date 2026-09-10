# Anlagen- und Fristenmonitor BDH

Prüffähiges Anlagenregister und Fristenkalender für die gemeinsame Untere
Umweltschutzbehörde Bochum / Dortmund / Hagen (Gebietsschlüssel 911, 913, 914).
Zwei Register bleiben getrennt: 144 schematische MFA nach der 44. BImSchV
und 68 öffentliche IED-Betriebe (davon 40 mit PRTR 2024). Die Leitzahl zählt
die jährlichen Messnachweise der nächsten 12 Monate — Untergrenze, mit Frist
01.01.2025 — nicht die 40 PRTR-Einrichtungen.

A portfolio project by [Kanduit](https://kanduit.de) — digitalization, data & software
for the public sector in NRW. 🇩🇪 **German-language UI.** A German README is available
in [`README.de.md`](README.de.md).

> **Note:** This is a **demonstrator**, not a product of Städte Bochum, Dortmund und Hagen. All figures
> come from **published sources** — PRTR and EU-Registry (thru.de), ISA-Jahresbericht 2024 (LANUK),
> Geobasis NRW. The 44. BImSchV stock is a marked demo assumption (◈). No personal data, no company names.

---

## Views

1. **Überblick** — Leitzahl der jährlichen MFA-Nachweise, beide Tabellen dauerhaft sichtbar.
2. **Anlagenregister** — Dual-Karte (Kreis = MFA, Quadrat = IED) plus dieselben zwei Tabellen.
3. **Fristenkalender** — Monat × Stadt, schematisch; Klick filtert das Register.
4. **Risikoeinstufung** — ein Gewichtsobjekt (§ 52a), nur MFA, IED unbewertet.
5. **Berichtsauszug** — Konzeptansicht: Termine gegen Stellenkapazität.
6. **Daten & Methode** — Registerabgleich 2.030 ≠ 68 ≠ 40 ≠ 144, Gegenprobe MAPE 3,9 %, Annahmen.

## Data sources

| Source | Content | Access |
|--------|---------|--------|
| PRTR 2024 (thru.de) | 40 Einrichtungen BDH, Zeitreihe 2015–2024 | public zip / SQLite |
| EU-Registry IE-RL | 68 Betriebe, 84 Anlagenzeilen, Jahr 2024, NW | public xlsx |
| ISA-Jahresbericht 2024 | NRW / UUBn / Inspektionen 2015–2024 | LANUK PDF |
| 44. BImSchV Ansprechpersonen | Gebietsschlüssel 911/913/914, ohne Personennamen | LANUK PDF |
| Geobasis NRW WFS | Stadtgrenzen Bochum, Dortmund, Hagen, EPSG:4326 | WFS |

## Pipeline

```bash
python3 scripts/fetch_prtr.py
python3 scripts/fetch_eu_registry.py
python3 scripts/fetch_isa.py
python3 scripts/fetch_44bv.py
python3 scripts/fetch_gebiete.py
python3 scripts/generate.py        # snapshots → data.js (aggregated, deterministic)
python3 serve.py                   # local preview → http://localhost:8129
```

Only filtered snapshots are committed, so `generate.py` runs offline and reproducibly.
Raw zips and the 123 MB SQLite stay in the session cache, not in the repo.
Company, street and parent names are dropped at fetch.

## Deployment (GitHub Pages)

This folder is the **source of truth**; GitHub Pages serves a separate public copy from
`docs/anlagen-fristenmonitor-bdh/` (the four static files only):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # sync check (also runs in CI)
```

Flow: *fetch → generate → publish → commit → push*. The CI check
(`.github/workflows/anlagen-fristenmonitor-bdh-publish-check.yml`) blocks merges with a stale `docs/`.

## Technology

Static HTML/CSS/vanilla JavaScript, hand-drawn SVG charts, no frameworks, no external
scripts, no tracking — fully hostable in Germany.

## Licence

Code: MIT. Data: see data sources. All analyses without warranty.
