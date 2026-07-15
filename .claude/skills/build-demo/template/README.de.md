# {{TITLE}}

TODO: Ein-Absatz-Beschreibung — was zeigt der Demonstrator, aus welchen
öffentlichen Daten, für wen.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der {{CITY}}.
> Alle Zahlen stammen aus **veröffentlichten Quellen** — TODO: Quellen nennen.
> Keine personenbezogenen Daten.

---

## Ansichten

TODO: eine Zeile je Tab (Kennzahl-Fokus, ehrlich benannte Datenlücken).

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| TODO | TODO | TODO |

## Pipeline

```bash
python3 scripts/fetch_<quelle>.py  # Rohdaten → data/sources/*.json (gefiltert, klein)
python3 scripts/generate.py        # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                   # lokale Vorschau → http://localhost:{{PORT}}
```

Nur gefilterte Snapshots liegen im Repo — `generate.py` läuft damit offline und
reproduzierbar. TODO: quellenspezifische Besonderheiten (Cache, ausgeschlossene
Felder) ergänzen.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/{{SLUG}}/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/{{SLUG}}-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
