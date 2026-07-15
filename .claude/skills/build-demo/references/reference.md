# /build-demo — Snippets & Exemplar-Pointer

## docs/index.html — Landing-Karte (ASCII! "ue/oe/ae", "Projekt oeffnen")

Insert as a new `<article>` inside `<section class="grid">`, before the first
non-Monitor card:

```html
      <article class="card">
        <div class="type">GitHub Pages</div>
        <h2>{Titel, ASCII-transliteriert}</h2>
        <p>{Ein-Satz-Beschreibung, ASCII-transliteriert}</p>
        <div class="actions">
          <a class="btn primary" href="./{slug}/">Projekt oeffnen</a>
        </div>
      </article>
```

## Root README.md — Bullet unter "## Aktuelle Projekte"

```markdown
- `portfolio/{slug}` -> statisch, publiziert unter `docs/{slug}/`
```

## METRIC_INFO — Beispiel-Eintrag (Berechnung UND Datenlücke)

```js
kpi_volumen: { t: 'Auftragsvolumen (wo ausgewiesen)', d: `Summe der in
Zuschlagsbekanntmachungen ausgewiesenen Auftragswerte. Nur ${fmtInt(n)} von
${fmtInt(total)} Ergebnissen nennen einen Wert — die Summe ist also eine
Untergrenze, kein Gesamtvolumen.` },
```

## SRC_LABEL + src-note — Verdrahtung

```js
const SRC_LABEL = {
  quelleKey: { t: 'Anzeigename der Quelle', u: 'https://…' },
};
// HTML unter jeder Chart-Karte:
// <p class="note src-note" data-src="quelleKey"></p>
// (Der Kit-Loop in app.js füllt "Quelle: <a …> · Abruf <stand>" automatisch.)
```

## PR-Body-Muster

```markdown
## Was ist das?
Neuer statischer Demonstrator **{Titel}** — {1 Satz Zweck/Anlass}.
Gleiche Systematik wie Schulbau-/Vergabe-Monitor (Petrol-Design, ⓘ-Glossar,
Quellen-Link unter jeder Karte, mobilfähig, alles im Browser).

## Daten (alle öffentlich, reproduzierbar)
- {Quelle(n) + Zeitraum + Filter}; gefilterte Snapshots im Repo → generate.py offline
- {Ausschlüsse: keine personenbezogenen Daten / keine Firmennamen}

## Ansichten
1. **{Tab}** — {1 Zeile mit Kern-Kennzahl}
…

## Technik & Flow
- fetch → generate → publish (docs/-Sync), CI-Check {slug}-publish-check.yml
- Landingpage-Karte + README-Bullet ergänzt
- Nach Merge live unter kanduit.github.io/{slug}/

Verifiziert im Browser (Desktop + Mobil 375px, alle Ansichten, keine Konsolen-Fehler).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Exemplar-Pointer (gezielt lesen, nie ganze Dateien)

| Bedarf | Datei | Suchanker (Funktion/Abschnitt) |
|---|---|---|
| KPI-Zeile + gestapelte Quartals-Säulen | portfolio/vergabe-monitor-duesseldorf/app.js | `renderOverview` |
| Median/Perzentil-Balken + Abdeckungs-Banner | ebd. | `renderDauern` |
| Monatsreihe mit Regeländerungs-Markern + 100%-Mixbars | ebd. | `renderDirekt` |
| Städtevergleich pro-Kopf-normiert + Tabelle | ebd. | `renderBenchmark` |
| Fristen-/Status-Tabelle mit Pills | ebd. | `renderRadar` |
| Lazy-Render pro Tab (bei schweren Views) | portfolio/schulbau-monitor-duesseldorf/app.js | `let rendered = {}` in `showView` |
| SVG-Karte aus GeoJSON + Punkt-in-Polygon | ebd. | `renderMap`, `project(` |
| Sortier-/Filter-Tabelle | ebd. | `renderTable`, `COLS` |
| Detail-Drawer (Seitenpanel) | ebd. | `openDrawer` |
| CSS für Karte/Tabelle/Drawer/Szenario-Slider | portfolio/schulbau-monitor-duesseldorf/styles.css | Abschnitts-Kommentare `Map` / `Table` / `Drawer` / `Scenario` |
| Daten-Pipeline API→Snapshot→Aggregat | portfolio/vergabe-monitor-duesseldorf/scripts/ | `fetch_notices.py`, `generate.py` |
