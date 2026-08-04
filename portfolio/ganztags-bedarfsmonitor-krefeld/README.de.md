# Ganztags-Bedarfsmonitor Krefeld

Wie viele Ganztagsplätze braucht Krefeld in den Ausbaustufen des Rechtsanspruchs
nach § 24 Abs. 4 SGB VIII (GaFöG) — je Grundschule, je Bezirk, bis zum Schuljahr
2029/30? Der Demonstrator stellt der veröffentlichten Ausbauplanung der Stadt
(OGS-Bericht 2026) den Bedarf gegenüber, der sich aus den kleinräumigen
Bevölkerungsdaten des Melderegisters ergibt, und zeigt die Lücke je Ausbaustufe.
Adressat ist ein Fachbereich Jugendhilfe, der bereits jährlich berichtet: Der
Prototyp **ergänzt** den OGS-Bericht um die Vorausschau, er ersetzt ihn nicht und
ist kein Fachverfahren.

Der methodische Kern: Alle Kinder, die bis 2029/30 eingeschult werden, sind
**bereits geboren und im Melderegister erfasst**. Der Bedarf muss also nicht
prognostiziert, sondern nur fortgeschrieben werden — mit einer Wanderungsrate,
die aus der Zeitreihe 2012–2024 gemessen und in einer Rückrechnung geprüft wird
(mittlere absolute Abweichung 1,7 %).

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Stadt Krefeld.
> Alle Zahlen stammen aus **veröffentlichten Quellen**: den kleinräumigen
> Bevölkerungsdaten und der amtlichen Gebietsgliederung der Stadt Krefeld, dem
> OGS-Bericht der Stadt (Januar 2026), dem Open-Data-Angebot des
> Schulministeriums NRW und den Kita-Geodaten von Open Data NRW.
> Keine personenbezogenen Daten — Aggregationsstufe Schule, Bezirk und Jahrgang.
> Sozialdaten nach §§ 61 ff. SGB VIII werden weder benötigt noch verarbeitet.

---

## Ansichten

| Ansicht | Kernaussage | Ehrlich benannte Lücke |
|---|---|---|
| **Überblick** | Platzbedarf, Kapazität und Lücke je Ausbaustufe; Deckungsgrad fällt von 90 % (2026/27) auf 81 % (2029/30), obwohl die Kapazität planmäßig wächst | Jahrgangsstärke ist ein Blockmittel — jahrgangsscharfe Geburtszahlen je Bezirk sind nicht offen |
| **Karte** | 32 Grundschulstandorte, Ampel nach Deckungsgrad, Punktfläche ∝ Platzbedarf | Punktposition ist der Schulort, nicht der Einzugsbereich |
| **Bezirke** | Bedarf/Kapazität/Lücke je Stadtbezirk (5, politisch) oder Stadtteil (19, statistisch), sortierbar, CSV-Export | Bedarf folgt dem **Wohnort**, Kapazität dem **Schulort** — ohne Einzugsbereiche sind Gebietsunterschiede ein Pendel-Hinweis, keine Versorgungsaussage |
| **Szenarien** | Stufenplan, Ausbaupfad (Zielerreichung 2034/35 bei 15 Gruppen/Jahr, 2031/32 bei 30) und hohe Inanspruchnahme | Personal-, Raum- und Mensenkapazitäten sind nicht modelliert; der OGS-Bericht nennt sie als Engpass |
| **Deckungsgradrechner** | Wirkung je Ausbauschritt (375 Plätze ≈ +4,3 Prozentpunkte); alle Annahmen verstellbar | Ausbauschritte wirken hier stadtweit, real am Standort |
| **Kennzahlenblatt** | Ein druckbares Blatt je Schule mit vollständigem Rechenweg und Herkunftsnachweis je Zahl | Platzzahl je Schule ist die zentrale Demo-Annahme |

## Datenquellen

| Quelle | Inhalt | Verwendung |
|--------|--------|------------|
| [Stadt Krefeld, FB 312 — Kleinräumige Bevölkerungsdaten](https://www.offenesdatenportal.de/organization/stadt-krefeld) | Altersgruppen u3 / 3–<6 / 6–<10 je statistischem Bezirk, 2012–2024 | Nachfrageseite: Jahrgangsstärken, Wanderungsrate, Rückrechnung |
| [Stadt Krefeld — amtliche Gebietsgliederung](https://open.nrw) | 5 Stadtbezirke (ab 01.11.2025), 19 Stadtteile, 45 statistische Bezirke (Shapefile, EPSG:25832) | Karte und Gebietszuordnung |
| [Stadt Krefeld — OGS-Bericht 2026](https://www.krefeld.de/system/files/2026-01/OGS-Bericht-Krefeld-2026.pdf) | Tabelle 4-1 (Plätze/Gruppen/Quote 2017/18–2027/28), Abb. 4-1 (OGS-Quoten je Sozialindex), Elternbefragung, Mensa-Maßnahmen | Angebotsseite, Quoten, Maßnahmen |
| [Schulministerium NRW — Open Data](https://www.schulministerium.nrw/open-data) | Schulverzeichnis, Schülerzahlen, Sozialindexstufen, Zeitreihe | 32 Grundschulstandorte, Koordinaten, Verteilungsgewichte |
| [Open Data NRW — Kindertageseinrichtungen](https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/) | 108 Einrichtungen in Krefeld mit Platzzahlen | Ü3-Bestand als Vorlaufindikator |

## Pipeline

```bash
python3 scripts/fetch_<quelle>.py  # Rohdaten → data/sources/*.json (gefiltert, klein)
python3 scripts/generate.py        # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                   # lokale Vorschau → http://localhost:8125
```

Nur gefilterte Snapshots liegen im Repo (zusammen rund 110 KB) — `generate.py`
läuft damit offline und reproduzierbar; zweimal ausgeführt ergibt sich ein
byte-identisches `data.js`.

Quellenspezifische Besonderheiten:

- **`fetch_bevoelkerung.py`** übernimmt nur sechs Spalten je Bezirk; die
  Geschlechts- und Feinaltersgliederung der Quelle wird verworfen. Die
  Ressourcen-URLs werden über die CKAN-API von open.nrw aufgelöst statt fest
  verdrahtet.
- **`fetch_kitas.py`** verwirft Einrichtungsnamen, Träger, Adressen und
  Telefonnummern schon beim Abruf — im Snapshot stehen nur Koordinate und
  Platzzahlen.
- **`fetch_gebiete.py`** liest Shapefile und dBASE mit der Standardbibliothek
  und vereinfacht die Ringe mit Douglas-Peucker (Toleranz 25 m).
- **`fetch_ogsbericht.py`** kann den Bericht nicht maschinell auswerten — er ist
  eine PDF-Publikation. Die Kennzahlen sind mit Angabe von Tabelle/Abbildung und
  Seite abgeschrieben; das Skript lädt das PDF und prüft dessen SHA-256-Hash.
  Ändert die Stadt das Dokument, schlägt der Abgleich fehl, statt dass die Zahlen
  stillschweigend veralten.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/ganztags-bedarfsmonitor-krefeld/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/ganztags-bedarfsmonitor-krefeld-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
