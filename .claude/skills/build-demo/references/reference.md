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

## generate.py — QUELLEN und ANNAHMEN

Beide speisen die Oberfläche direkt; es gibt keine zweite Stelle, an der eine
Quelle oder eine Annahme beschrieben wird.

```python
QUELLEN = {
    "msb": {"t": "Schulverzeichnis — Open Data MSB NRW",
            "u": "https://www.schulministerium.nrw/open-data"},
}

ANNAHMEN = [
    {"k": "zustand", "t": "Bauzustand je Standort",
     "d": "Demo-Annahme. Ein Zustandsregister liegt nicht offen vor. Das "
          "Schulbetriebsdatum taugt nicht als Ersatz — es steht für 101 der 135 "
          "Standorte auf 1973, dem Aufbau des Registers. Die Note wird "
          "deterministisch aus der Schulnummer gezogen: reproduzierbar, aber "
          "fachlich bedeutungslos. Im Projekt durch Amtsdaten zu ersetzen."},
]
```

Der Text nennt immer drei Dinge: **warum angenommen**, **wie gebildet**,
**wodurch im Projekt zu ersetzen**.

## METRIC_INFO — Beispiel-Eintrag (Berechnung UND Datenlücke)

```js
kpi_volumen: { t: 'Auftragsvolumen (wo ausgewiesen)', d: `Summe der in
Zuschlagsbekanntmachungen ausgewiesenen Auftragswerte. Nur ${fmtInt(n)} von
${fmtInt(total)} Ergebnissen nennen einen Wert — die Summe ist also eine
Untergrenze, kein Gesamtvolumen.` },
```

## Leitzahl — eine Zahl mit Frist dahinter

```js
$('#leitzahl').innerHTML = `
  <div class="k">Leitzahl${infoIcon('leitzahl')}</div>
  <div class="v">${fmtMio(wert)}</div>
  <div class="d"><b>{Was die Zahl verlangt}</b> — {unter welcher Annahme
    gerechnet}. {Was passiert, wenn sie verfehlt wird.} Durchgerechnet unter
    <a href="#" data-goto="szenarien">Szenarien → …</a>.</div>`;
```

Wo eine Bandbreite möglich ist, die **Untergrenze** rechnen (bestmögliche
Reihenfolge / günstigste Annahme) und genau so benennen — eine Untergrenze
hält im Gespräch, eine Punktprognose nicht.

## Gegenprobe (Back-Test) — Muster

Verfahren auf einem alten Fenster anpassen, die bekannten Jahre vorhersagen,
mittlere absolute Abweichung ausweisen, Ergebnis ehrlich einordnen:

```js
backtest: { t: 'Rückrechnung der Fortschreibung', d: `Prüfung des Verfahrens an
der Vergangenheit: angepasst auf ${bt.fitVon}–${bt.fitBis}, vorhergesagt
${bt.von}–${bt.bis}, ohne diese Jahre gesehen zu haben. Mittlere absolute
Abweichung ${fmtPct(bt.mape)}. Die Fortschreibung unterschätzt, weil sie den
Zuzug ab 2022 nicht kennen kann — sie taugt als Größenordnung, nicht als
Planungsgrundlage je Jahrgang.` },
```

## Benchmark — Rang statt Adjektiv

Enthält eine Landesquelle das Vergleichsfeld mit, ist der Benchmark fast
gratis. Über den **Schlüsseltext beider Quellen** joinen, nie über den Namen:

```python
# 'Krfr. Stadt Duisburg' steht zeichengleich im Budget-PDF und in der
# MSB-Zeitreihe — das ist der Join, ohne zusätzliche Quelle.
schueler = {r["kreis"]: r["schueler"] for r in reihe_src["kreisfreie_staedte"]}
bench = [{"name": r["name"], "budget": r["budget_eur"], "schueler": n,
          "jeSchueler": round(r["budget_eur"] / n, 2)}
         for r in budget_src["kreisfreie_staedte"]
         if (n := schueler.get(r["kreis"]))]
```

In der UI die eigene Stadt einfärben, alle anderen grau, und **beide
Einschränkungen der Normierung** darunter nennen.

## PDF als Quelle — stdlib-Textextraktion

Kommt vor (Landeslisten sind oft nur PDF). Zwei Fälle:

- **Normale Schriften:** `zlib.decompress` über die Content-Streams, dann
  String-Literale `(...)` einsammeln; Positionierungsoperatoren (`Td/TD/Tm/T*/ET`)
  beenden je eine Tabellenzelle.
- **CID-Schriften** (Hex-Strings `<00250344>`): zusätzlich die `/ToUnicode`-CMap
  des Fonts parsen (`beginbfchar`/`beginbfrange`) und je zwei Bytes zurück nach
  Text übersetzen.

Fertige, geprüfte Implementierung: `portfolio/schulinvestitions-monitor-duisburg/scripts/fetch_startchancen.py`
→ `pdf_cells()`. Von dort kopieren statt neu schreiben.

## PR-Body-Muster

```markdown
## Was ist das?
Neuer statischer Demonstrator **{Titel}** — {1 Satz Zweck/Anlass}.
Gleiche Systematik wie Schulbau-/Vergabe-Monitor (Petrol-Design, ⓘ-Glossar,
Quellen-Link unter jeder Karte, mobilfähig, alles im Browser).

## Daten (alle öffentlich, reproduzierbar)
- {Quelle(n) + Zeitraum + Filter}; gefilterte Snapshots im Repo → generate.py offline
- {Ausschlüsse: keine personenbezogenen Daten / keine Firmennamen}

## Abweichungen vom Demo-Brief
- {tote/ersetzte/neuere Quelle, jeweils mit Begründung — oder "keine"}

## Ansichten
1. **{Tab}** — {1 Zeile mit Kern-Kennzahl}
…

## Ehrliche Trennung echt / angenommen
{Welche Größen sind Annahme, wo steht die Begründung, welche Modellgrenze
benennt die UI selbst.}

## Technik & Flow
- fetch → generate → publish (docs/-Sync), CI-Check {slug}-publish-check.yml
- Landingpage-Karte + README-Bullet ergänzt
- Nach Merge live unter kanduit.github.io/kanduit-projects/{slug}/

Verifiziert im Browser (Desktop + Mobil 375px, alle Ansichten, keine Konsolen-Fehler).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Exemplar-Pointer (gezielt lesen, nie ganze Dateien)

| Bedarf | Datei | Suchanker |
|---|---|---|
| KPI-Zeile + gestapelte Quartals-Säulen | vergabe-monitor-duesseldorf/app.js | `renderOverview` |
| Median/Perzentil-Balken + Abdeckungs-Banner | ebd. | `renderDauern` |
| Monatsreihe mit Regeländerungs-Markern + 100%-Mixbars | ebd. | `renderWettbewerb` |
| Städtevergleich pro-Kopf-normiert + Tabelle | ebd. | `renderBenchmark` |
| Ranking-Tabelle je Vergabestelle mit Pills | ebd. | `renderStellen` |
| **Ansicht „Daten & Methode“, Registerabgleich** | ganztags-bedarfsmonitor-bochum/index.html | `view-daten` |
| **Leitzahl mit Schwellenrechnung** | ebd. app.js | `kipppunktJahr`, `Leitzahl` |
| **Gegenprobe mit MAPE** | ganztags-platzmonitor-moenchengladbach/app.js | `backtest` |
| Kennzahlenblatt als eigene Ansicht | ebd. | `view-sheet` |
| Rückrechnung + Abgleich mit Fachstatistik | ganztags-bedarfsmonitor-krefeld/app.js | `Rückrechnung` |
| **PDF-Textextraktion (auch CID/ToUnicode)** | schulinvestitions-monitor-duisburg/scripts/fetch_startchancen.py | `pdf_cells` |
| **Benchmark aus einer Landesquelle** | ebd. scripts/generate.py | `Benchmark kreisfreie Staedte` |
| **◈-Annahmen von generate.py in die UI** | ebd. app.js | `ANNAHME`, `assumeMark` |
| **Modellartefakt in der UI benennen** | ebd. app.js | `szVerzoegerung` |
| Eindeutige Anzeigenamen aus Registerdaten | ebd. scripts/generate.py | `anzeigename` |
| Gewichts-Slider, live über alle Ansichten | ebd. app.js | `renderModell`, `ranked` |
| SVG-Karte aus GeoJSON + Punkt-in-Polygon | ebd. app.js | `renderKarte`, `px(`/`py(` |
| Sortier-/Filter-Tabelle + CSV-Export | ebd. app.js | `COLS`, `csvExport` |
| Detail-Drawer (Kennzahlenblatt) | ebd. app.js | `openBlatt` |
| Geometrie vereinfachen (Douglas-Peucker) | ebd. scripts/fetch_gebiete.py | `simplify` |
| UTM32 → WGS84 ohne Fremdbibliothek | ebd. scripts/geo.py | `utm32_to_wgs84` |
| Daten-Pipeline API→Snapshot→Aggregat | vergabe-monitor-duesseldorf/scripts/ | `fetch_notices.py` |
