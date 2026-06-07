# Schulbau-Monitor Düsseldorf

Interaktives Lagebild zu **Gebäudezustand, Sanierungsstau und Priorisierung** der
Düsseldorfer Schulen — als Entscheidungsgrundlage für Haushaltsplanung,
Investitionssteuerung und politische Kommunikation.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW.

> **Hinweis:** Dies ist ein **Demonstrator**. Die Stammdaten (Schulstandorte,
> Stadtbezirksgrenzen) sind real und öffentlich; die Zustands-, Kosten- und
> Prioritätswerte sind **illustrativ und frei erzeugt** — keine realen Bewertungen
> der Stadt Düsseldorf. Im Echtbetrieb treten die Daten des Amtes an ihre Stelle.

---

## Überblick

Der Schulbau-Monitor bündelt vier Sichten auf den gesamten Schulgebäudebestand:

| Sicht | Inhalt |
|------|--------|
| **Übersicht** | Stadtweite Kennzahlen: Sanierungsstau gesamt, Ø Zustandsindex, kritische Standorte, Modernisierungsfortschritt; Verteilung nach Zustandsklasse; Sanierungsstau nach Schulform und Stadtbezirk; dringendste Standorte. |
| **Karte** | Choroplethenkarte der 10 Stadtbezirke, umschaltbar nach Ø Zustand / Sanierungsstau / Ø Priorität / Modernisierung; alle Standorte als Punkte (Farbe = Zustand); Bezirk-Detailpanel. |
| **Schulen** | Filter- und sortierbares Standortregister; Klick öffnet ein Standortprofil mit Stammdaten, Zustandsanzeige, Mängeln und der Zusammensetzung des Prioritätsscores. |
| **Priorisierung** | Transparentes, gewichtetes Bewertungsmodell; Sanierungsfahrplan-Simulation (Jahresbudget → Jahre bis Abbau, Standorte pro Jahr); Streudiagramm Zustand × Sanierungsstau; Rangliste. |

Die vier Kernkennzahlen:

- **Zustandsindex** (0–100) bzw. **Zustandsklasse** 1–4 je Schule
- **Sanierungsstau (€)** je Schule, je Bezirk und gesamt
- **Modernisierungsfortschritt (%)** — umgesetzter Anteil des Bedarfs
- **Prioritätsscore** (0–100) aus vier gewichteten Kriterien

---

## Fragen, die uns das Amt typischerweise stellt

### Woher kommen die Daten?

**Reale, öffentliche Stammdaten** (im Repository unter `data/sources/`):

| Quelle | Daten | Lizenz |
|--------|-------|--------|
| [Open Data Düsseldorf](https://opendata.duesseldorf.de/dataset/standorte-der-d%C3%BCsseldorfer-schulen) | Schulstandorte: Name, Anschrift, Stadtteil, Schulform, Schulträger, Koordinaten (185 Standorte) | Datenlizenz Deutschland – Zero – 2.0 |
| [Open Data Düsseldorf](https://opendata.duesseldorf.de/dataset/stadtbezirksgrenzen-d%C3%BCsseldorf) | Stadtbezirksgrenzen (10 Bezirke, GeoJSON) | Datenlizenz Deutschland – Zero – 2.0 |

**Illustrative, erzeugte Werte:** Zustandsindex, Sanierungsstau, Modernisierung,
Prioritätsscore, Baujahr, Schülerzahl, Bruttogrundfläche und Mängel-Flags werden
**deterministisch und nachvollziehbar** durch `scripts/generate.py` erzeugt. Sie sind
plausibel korreliert (älteres Gebäude → schlechterer Zustand → höherer Stau → höhere
Priorität), aber **keine echten Daten**. Im Produktivbetrieb ersetzen wir sie durch die
Bestands- und Bewertungsdaten des Amtes (z. B. aus Gebäudemanagement/CAFM, vorhandenen
Zustandsbewertungen, Kostenschätzungen).

### Wie ist der Prioritätsscore aufgebaut?

Regelbasiert und transparent — kein „Black-Box-Algorithmus“. Vier gewichtete Kriterien:

| Kriterium | Gewicht |
|-----------|:------:|
| Gebäudezustand | 40 |
| Betroffene Schüler:innen | 20 |
| Höhe des Sanierungsstaus | 15 |
| Mängel & Recht (Brandschutz, Barrierefreiheit, Schadstoffe) | 25 |

Die Gewichte sind **parametrierbar** und werden gemeinsam mit dem Amt festgelegt —
die fachliche Hoheit bleibt bei Ihnen. Jede Bewertung ist bis auf die Einzelkriterien
nachvollziehbar (siehe Standortprofil).

### Welche Technologien stecken dahinter?

- **Statisches HTML/CSS/Vanilla-JavaScript** — kein Framework, kein Build-Schritt
- Diagramme und Karte als **handgezeichnetes SVG** — keine schweren Bibliotheken,
  keine externen Skripte zur Laufzeit
- **Keine Server-Logik, keine Datenbank, keine externen API-Aufrufe, kein Tracking**
- Datensatz wird vorab durch ein **Python-Skript** (`scripts/generate.py`) erzeugt
- Schriften: Archivo & IBM Plex Mono (Kanduit-Markenschriften)

Bewusst „lean": leicht zu prüfen, leicht zu betreiben, leicht zu migrieren — passend
zur souveränen Positionierung. Bei umfangreicheren Anforderungen (Mehrbenutzer,
Datenbankanbindung, Live-Datenpipelines) wird auf eine entsprechend tragfähigere
Architektur erweitert (siehe Produktivierung).

### Ist das datenschutzkonform und barrierearm?

- Es werden **keine personenbezogenen Daten** verarbeitet; alle Berechnungen laufen
  **lokal im Browser**. Damit ist die Anwendung DSGVO-unkritisch.
- Farbskalen sind kontraststark, Werte werden zusätzlich numerisch und über Form/Label
  codiert (Farbfehlsichtigkeit). Bedienelemente sind tastatur- und touch-tauglich.
- Für den Produktivbetrieb empfehlen wir, die Schriften **selbst zu hosten** (statt
  Google Fonts) — dann fließen auch beim Laden keine Daten an Dritte.

### Wo kann das gehostet werden?

Vollständig statisch und ohne Backend — damit **souverän in Deutschland betreibbar**:

- Statisches Hosting bei einem deutschen Anbieter (z. B. Hetzner, IONOS,
  Open Telekom Cloud / T-Systems)
- **On-Premise** bzw. im kommunalen Rechenzentrum hinter nginx/Apache oder im Intranet
- Aktuell als Demo auf GitHub Pages — jederzeit ohne Code-Änderung auf eine
  DE-Infrastruktur umziehbar

### Wie würde daraus eine produktive Anwendung?

Wir empfehlen ein **gestuftes Vorgehen**:

1. **Pilot** — Andocken an echte Daten eines abgegrenzten Bereichs (z. B. ein
   Schultyp oder ein Stadtbezirk): Import der Bestands- und Zustandsdaten des Amtes,
   gemeinsame Festlegung von Zustandsmodell und Prioritäts-Gewichten, Validierung
   der Kennzahlen.
2. **Ausbau** — Vollständiger Bestand, regelmäßige Datenaktualisierung (Schnittstelle
   oder Import-Routine), PDF-/Excel-Export für Haushalts- und Ratsvorlagen, optional
   Mehrbenutzer-Zugriff mit Rollen, Mehrjahres-Szenarien und Maßnahmen-Tracking,
   Betrieb auf Infrastruktur in Deutschland inkl. Wartung und Support.

Der Einstieg bleibt bewusst klein und schnell wirksam; der Ausbau erfolgt
bedarfsgerecht.

### Was kostet das?

Aufwand und Konditionen besprechen wir gern direkt. Wir arbeiten mit einem **gestuften
Modell (Pilot → Ausbau)**, das den Einstieg bewusst klein hält. *(Konditionen sind
nicht Teil dieses öffentlichen Repositories.)*

---

## Lokal starten

```bash
# Variante A — Datei direkt öffnen
open index.html

# Variante B — kleiner lokaler Server (empfohlen)
python3 serve.py            # → http://localhost:8123
```

## Daten neu erzeugen

```bash
python3 scripts/generate.py   # liest data/sources/*, schreibt data.js
```

## Projektstruktur

```
schulbau-monitor-duesseldorf/
├── index.html        App-Shell & vier Sichten
├── styles.css        Kanduit-Designtokens & Komponenten
├── app.js            Logik: Projektion, Karte, Tabelle, Profil, Szenario
├── data.js           erzeugter Datensatz (window.KANDUIT_DATA)
├── serve.py          minimaler lokaler Server
├── data/sources/     reale Quell-GeoJSONs (Open Data Düsseldorf)
└── scripts/generate.py   erzeugt data.js reproduzierbar
```

## Lizenz

Code: MIT. Stammdaten © Landeshauptstadt Düsseldorf, dl-de/zero-2-0.
Bewertungs- und Kostenwerte sind illustrativ.

---

Erstellt von [Kanduit](https://kanduit.de) — Ihr Partner für die digitale Verwaltung in NRW.
