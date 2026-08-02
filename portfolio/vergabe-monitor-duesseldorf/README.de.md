# Vergabe-Monitor Düsseldorf

Vergabe-Kennzahlen der Landeshauptstadt Düsseldorf aus **öffentlichen
eForms-Bekanntmachungen** — Verfahrensmix, Dauern, Wettbewerbsintensität und
NRW-Benchmark. Auswertungseinheit ist durchgängig die **Vergabestelle**, nicht
der Erfüllungsort. Jede Kennzahl mit Quellen-Link, Verarbeitung vollständig im
Browser.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Landeshauptstadt
> Düsseldorf. Alle Zahlen stammen aus **veröffentlichten Bekanntmachungen** des
> Bekanntmachungsservice (Datenservice Öffentlicher Einkauf) — sie zeigen das
> öffentlich sichtbare Vergabegeschehen, nicht die vollständige interne Vergabestatistik.
> Keine personenbezogenen Daten; Zuschlagsempfänger werden nicht genannt.

---

## Ansichten

- **Überblick** — Bekanntmachungen je Quartal, Verfahrensarten-Mix, Top-CPV-Gruppen,
  ausgewiesenes Auftragsvolumen und Vergabestellen — jeweils **nur für die
  Kernverwaltung der Stadt** als Auftraggeber.
- **Wer beschafft?** — Zerlegung aller Bekanntmachungen mit Erfüllungsort Düsseldorf
  nach tatsächlichem Auftraggeber (Stadt, eigene Betriebe, Land, Bund, öffentliche
  Unternehmen). Kernaussage: Der Ortsfilter überzeichnet das städtische Volumen um
  Faktor 3,8.
- **Verfahrensdauern** — Median Bekanntmachung→Zuschlag je Verfahrensart; nur Verfahren
  mit beiden Daten, Abdeckung wird ehrlich ausgewiesen.
- **Wettbewerb** — Angebotszahlen aus Zuschlagsbekanntmachungen: Verteilung und die
  Warengruppen mit dem dünnsten Wettbewerb.
- **Benchmark NRW** — Düsseldorf vs. Köln, Essen, Dortmund je 100.000 Einwohner,
  verglichen als **kommunal gesamt** (Kernverwaltung + eigene Betriebe), weil die
  Städte gleiche Aufgaben in unterschiedlichen Rechtsformen führen. Die Grenzen des
  Vergleichs stehen sichtbar in der Ansicht.

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| [Bekanntmachungsservice / Datenservice Öffentlicher Einkauf](https://www.oeffentlichevergabe.de) | eForms-DE-Bekanntmachungen (Ausschreibungen, Zuschläge, …) | [OpenData-API](https://www.oeffentlichevergabe.de/documentation/swagger-ui/opendata/index.html), monatliche CSV-Exporte |
| [IT.NRW](https://www.it.nrw/nrw-einwohnerzahl-erstmals-auf-basis-des-zensus-2022-fortgeschrieben) | Amtliche Einwohnerzahlen (31.12.2024, Basis Zensus 2022) | statisch eingebettet |

Gefiltert wird nach **Erfüllungsort** (NUTS): Düsseldorf DEA11, Köln DEA23, Essen DEA13,
Dortmund DEA52 — wie in der [öffentlichen Suche](https://oeffentlichevergabe.de/ui/de/ausschreibungen_duesseldorf_kreisfreie_stadt_DEA11).
Dadurch sind auch Landes- und Bundeseinrichtungen mit Sitz vor Ort enthalten; die
Auftraggeber-Kategorien weisen diesen Anteil aus.

## Pipeline

```bash
python3 scripts/fetch_notices.py   # OpenData-API → data/sources/notices-YYYY-MM.json
python3 scripts/generate.py        # Snapshots → data.js (aggregiert)
python3 serve.py                   # lokale Vorschau → http://localhost:8124
```

`fetch_notices.py` lädt die monatlichen CSV-Exporte (~17 MB/Monat, gecacht) und legt nur
die **gefilterten** Snapshots ins Repo (~200 KB/Monat) — `generate.py` läuft damit offline
und reproduzierbar. Namen von Zuschlagsempfängern werden beim Filtern **nicht** übernommen
(Sensibilität Korruptionsprävention — Kategorien statt Namen).

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/vergabe-monitor-duesseldorf/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/vergabe-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Bekanntmachungsdaten: Bekanntmachungsservice / Datenservice Öffentlicher
Einkauf (öffentliche OpenData-Schnittstelle). Alle Auswertungen ohne Gewähr.
