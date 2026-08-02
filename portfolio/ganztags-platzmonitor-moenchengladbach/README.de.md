# Ganztags-Platzmonitor Mönchengladbach

Der Demonstrator bricht die gesamtstädtische Ganztags-Platzlücke Mönchengladbachs
auf die 38 einzelnen Grundschulen und die vier Stadtbezirke herunter — für jede
Ausbaustufe des Rechtsanspruchs nach § 24 Abs. 4 SGB VIII bis zum Schuljahr
2029/30. Die Kapazität je Standort wird aus Raumflächen und Nutzungsannahmen
gerechnet statt aus festen Gruppengrößen, weil die Stadt auf offene und
halboffene Modelle mit multifunktional genutzten Räumen umstellt. Daneben steht,
welche Bau- oder Umbaumaßnahme wie viele Plätze an welchem Standort ab wann
schafft. Adressat ist ein Fachbereich Schule und Sport, der die Platzvergabe
zentral steuert und den Ausbau im Haushalt hinterlegen muss — kein Fachverfahren,
sondern eine Planungs- und Entscheidungsschicht.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Stadt Mönchengladbach.
> Standorte, Schüler- und Klassenzahlen sowie Sozialindexstufen stammen aus dem
> **Open-Data-Angebot des Schulministeriums NRW**, der Kita-Bestand aus **Open Data
> NRW**, die Stadtbezirksgrenzen aus **OpenStreetMap** (ODbL). Die Raumkennwerte des
> Kapazitätsmodells, die Bestandsquote und die Maßnahmenliste sind **gekennzeichnete
> Demo-Annahmen** und in der Oberfläche als solche ausgewiesen — im Projekt durch
> Daten des Fachbereichs zu ersetzen.
> Keine personenbezogenen Daten; Aggregationsstufe Schule, Stadtbezirk, Jahrgang
> (§ 120 SchulG NRW).

---

## Ansichten

| Ansicht | Kern | Datenlücke |
|---|---|---|
| **Überblick** | Platzbedarf, Kapazität und Lücke je Ausbaustufe; Plausibilitätsanker gegen die öffentlich genannten Zahlen für 2026/27 | Jahrgangsstärken je Schule nicht offen — Schülerzahl ÷ 4 |
| **Karte** | 38 Standorte, eingefärbt nach Deckungsgrad, Punktfläche ∝ Platzbedarf | Schuleinzugsbereiche liegen nicht offen vor |
| **Standorte** | sortierbare Standort- und Bezirkstabelle mit CSV-Export | Kita-Ü3-Bestand ist Indikator, keine Übergangsquote |
| **Kapazitätsmodell** | Kapazität aus Fläche und Nutzung; acht veränderbare Annahmen | Raumbücher je Standort liegen nicht offen vor |
| **Maßnahmen** | Platzwirkung je Standort und Wirksamkeitsjahr, kumuliert | Maßnahmenliste vollständig Demo-Annahme |
| **Kennzahlenblatt** | druckbares Blatt je Standort mit vollständigem Rechenweg | Demo-Annahmen im Rechenweg markiert |

Die drei Szenarien — „Stufenplan bis 2029/30“, „Hohe Inanspruchnahme“ (+10 / +20
Prozentpunkte) und „Raumoptionen“ (mit gegen ohne Maßnahmen) — wirken auf alle
Ansichten.

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| [MSB NRW — Open Data](https://www.schulministerium.nrw/open-data) | Schulverzeichnis (Anschrift, UTM-Koordinate, Trägerform), Schülerzahlen je Schule, Sozialindexstufen SJ 2025/26 | 03.08.2026 |
| [MSB NRW — Open Data](https://www.schulministerium.nrw/open-data) | Schüler-, Klassen- und Schulzahlen für Mönchengladbach je Schuljahr 2012 ff. | 03.08.2026 |
| [Open Data NRW — Kindertageseinrichtungen](https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/) | Ü3- und U3-Platzbestand je Einrichtung (nur Koordinate und Platzzahlen übernommen) | 03.08.2026 |
| [OpenStreetMap via Overpass](https://www.openstreetmap.org/relation/62644) | Grenzen der vier Stadtbezirke und der Stadt (ODbL) | 03.08.2026 |
| [Stadt Mönchengladbach — OGS-Ausbau](https://www.moenchengladbach.de/aktuell-aktiv/newsroom/ogs-ausbau-in-moenchengladbach-umsetzung-des-rechtsanspruchs-ab-2026-27) | Ankerwerte 2026/27: 2.000–2.100 benötigte Plätze, rund 1.380 frei, bis zu 720 zu schaffen | 03.08.2026 |
| [Bildungsnetzwerk — Der offene Ganztag](https://www.moenchengladbach.de/bildungsnetzwerk-ogs/der-offene-ganztag) | Kontext offene und halboffene Modelle | 03.08.2026 |

**Warum OpenStreetMap:** Weder das MSB-Open-Data noch opengeodata.nrw.de liefern
Stadtbezirksgrenzen unterhalb der Gemeindeebene. OSM ist die einzige offen
verfügbare Quelle dafür und wird in der Oberfläche mit Lizenzhinweis als eigene
Quelle ausgewiesen.

**Nicht verwendet:** Die Landesdatenbank NRW (IT.NRW) hat keine offen skriptbare
Schnittstelle; an ihre Stelle tritt die MSB-Zeitreihe 2012–2025.

## Pipeline

```bash
python3 scripts/fetch_<quelle>.py  # Rohdaten → data/sources/*.json (gefiltert, klein)
python3 scripts/generate.py        # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                   # lokale Vorschau → http://localhost:8123
```

```bash
python3 scripts/fetch_msb.py       # Schulverzeichnis, Schülerzahlen, Sozialindex, Zeitreihe
python3 scripts/fetch_kitas.py     # Kita-Ü3-Bestand (ohne Namen, Träger, Adressen)
python3 scripts/fetch_bezirke.py   # Stadtbezirksgrenzen aus OSM (Overpass, mit Spiegeln)
```

Nur gefilterte Snapshots liegen im Repo (zusammen unter 40 KB) — `generate.py`
läuft damit offline und reproduzierbar; zweimaliger Lauf ergibt ein
byte-identisches `data.js`. Besonderheiten:

- **Koordinaten:** Das Schulverzeichnis liefert EPSG:25832; `scripts/geo.py`
  rechnet ohne Fremdbibliotheken nach WGS84 um und ordnet Standorte per
  Punkt-in-Polygon ihrem Stadtbezirk zu (alle 38 eindeutig).
- **Ausgeschlossene Felder:** Aus dem Kita-Datensatz werden Einrichtungsname,
  Träger, Adresse und Telefonnummer bereits beim Abruf verworfen. Aus dem
  Schulverzeichnis werden Telefon, Fax und E-Mail nicht übernommen.
- **Overpass:** freier Dienst — der Abruf probiert drei Spiegel mit Backoff und
  wertet leere Antworten als Fehlschlag.
- **Zeichensatz:** Die Sozialindex-Liste des MSB ist CP850-kodiert.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/ganztags-platzmonitor-moenchengladbach/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/ganztags-platzmonitor-moenchengladbach-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
