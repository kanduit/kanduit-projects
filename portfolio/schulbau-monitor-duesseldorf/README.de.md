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

## Kennzahlen-Definitionen

Jede in der App gezeigte Zahl ist hier definiert — in derselben einfachen Sprache wie die
ⓘ-Hover-Tooltips in der Oberfläche. Sofern eine Kennzahl nicht ausdrücklich mit **(real)**
gekennzeichnet ist, sind ihre Werte **illustrativ**: deterministisch erzeugte Demo-Daten,
keine realen Bewertungen der Stadt Düsseldorf (siehe *Datenherkunft* / `DATENHERKUNFT.internal.md`).

| Kennzahl (UI-Label) | Was sie darstellt | Skala / Einheit | Wie wir darauf kommen |
|---------------------|-------------------|-----------------|-----------------------|
| **Schulstandorte** **(real)** | Anzahl der erfassten Schulstandorte, verteilt auf die 10 Stadtbezirke. | Anzahl | Reale Stammdaten aus Open Data Düsseldorf. |
| **Zustandsindex** | Baulicher Gesamtzustand eines Gebäudes — die zentrale Qualitätskennzahl. Höher = besser. | 0–100 (100 = neuwertig, 0 = ungenügend) | Je Schule erzeugt; abhängig von Baujahr, Zeit seit letzter Sanierung und einer Baualters-Kohorte. Der Ø-Wert ist das ungewichtete Mittel über alle Standorte. |
| **Zustandsklasse** | Vier-stufige Zusammenfassung des Zustandsindex für die schnelle Einordnung. | Klasse 1 = gut (≥ 75) · 2 = mittel (55–74) · 3 = schlecht (38–54) · 4 = ungenügend (< 38) | Deterministisch aus den Schwellenwerten des Zustandsindex abgeleitet. |
| **Kritische Standorte** | Anzahl der Standorte in Zustandsklasse 4 (ungenügend) — die dringendsten Sanierungsfälle. | Anzahl | Zahl der Schulen mit Zustandsklasse = 4. |
| **Sanierungsstau** | Geschätzte Kosten, um ein Gebäude wieder in einen neuwertigen Zustand zu versetzen. Gezeigt je Schule, je Bezirk und als stadtweite Summe. | € (oft in Mio € / Mrd €) | Bruttogrundfläche × Sanierungskostensatz (Annahme: 2.650 €/m²), skaliert mit dem Zustandsdefizit (Abstand des Index zu 100). Bezirks- und Stadtwerte sind Summen. |
| **Modernisierung** | Anteil des erkannten Modernisierungsbedarfs, der bereits umgesetzt ist. Höher = mehr erledigt. | 0–100 % (100 % = vollständig modernisiert) | Je Schule erzeugt; höher bei kürzlich sanierten Gebäuden in besserem Zustand. Der Ø-Wert ist das Mittel über alle Standorte. |
| **Prioritätsscore** | Eine einzelne Rangkennzahl, die vier Kriterien zu einer nachvollziehbaren Dringlichkeitsreihenfolge bündelt. Höher = dringender. | 0–100 | Gewichtete Summe aus vier Kriterien — **Gebäudezustand 40**, **betroffene Schüler:innen 20**, **Höhe Sanierungsstau 15**, **Mängel & Recht 25** (Brandschutz, Barrierefreiheit, Schadstoffe). Gewichte sind mit dem Amt abstimmbar. |
| **Schüler:innen** | Schüler:innen am Standort; in der Übersicht die Summe über alle Standorte. | Anzahl | Je Schule erzeugt, innerhalb plausibler Bereiche je Schulform. |
| **Baujahr** | Errichtungsjahr des Gebäudes. | Jahr | Je Schule aus einer realistischen Baualters-Verteilung erzeugt. |
| **Letzte Sanierung** | Jahr der letzten Sanierung; leer ("—"), wenn im Modell nicht gesetzt. | Jahr oder "—" | Für ca. ⅓ der Standorte erzeugt; die Open-Data-Quelle enthält dieses Feld nicht. |
| **Maßnahmenstatus** | Bearbeitungsstand der Sanierungsmaßnahme. | nicht begonnen · geplant · in Umsetzung · abgeschlossen | Aus Prioritätsscore und Sanierungsjahr erzeugt. |
| **Mängel & Recht** | Rechts-/Sicherheits-Mängel als Kennzeichen: Brandschutzmangel, nicht barrierefrei, Schadstoffverdacht. | Ja/Nein-Kennzeichen | Erzeugt, korreliert mit Baujahr und Sanierungsstand. |
| **Schulform** **(real)** | Schulform, normalisiert auf acht Kategorien. | Kategorie | Reale Stammdaten, aus dem Freitext-Typ der Quelle abgeleitet. |
| **Stadtbezirk** **(real)** | Zugehöriger Stadtbezirk (1–10). | Kategorie | Aus realen Koordinaten und realen Bezirksgrenzen abgeleitet (Punkt-in-Polygon). |

> **Karten-Kennzahlen** (Ø Zustand, Sanierungsstau, Ø Priorität, Ø Modernisierung) sind die
> obigen Schul-Kennzahlen, aggregiert über die Schulen je Stadtbezirk (Mittelwert bei
> Durchschnitten, Summe beim Sanierungsstau).

---

## Fragen, die uns das Amt typischerweise stellt

### Woher kommen die Daten?

Der Datensatz hat **drei klar getrennte Ebenen**. Zu jedem Feld lässt sich sagen, ob es
real, abgeleitet oder illustrativ erzeugt ist.

**1 · Reale, öffentliche Stammdaten** (im Repository unter `data/sources/`) — genau
**zwei Quellen**, beide von Open Data Düsseldorf. Weitere Datenquellen werden **nicht**
verwendet (kein weiterer Download, keine API):

| Quelle | Reale Felder | Lizenz |
|--------|--------------|--------|
| [Schulstandorte](https://opendata.duesseldorf.de/dataset/standorte-der-d%C3%BCsseldorfer-schulen) | Name, Anschrift (→ Straße, PLZ), Stadtteil, Schulform, Schulträger, Koordinaten — 185 Standorte | Datenlizenz Deutschland – Zero – 2.0 |
| [Stadtbezirksgrenzen](https://opendata.duesseldorf.de/dataset/stadtbezirksgrenzen-d%C3%BCsseldorf) | Grenzpolygone der 10 Stadtbezirke (GeoJSON) | Datenlizenz Deutschland – Zero – 2.0 |

**2 · Aus den Stammdaten abgeleitet** (deterministisch, keine Schätzung):

- **Stadtbezirk je Schule** — per Punkt-in-Polygon aus den realen Koordinaten und realen
  Bezirksgrenzen ermittelt (echte räumliche Zuordnung).
- **Schulform-Normalisierung** — die Freitext-Schulform wird auf acht Kategorien
  vereinheitlicht (Grundschule … Berufskolleg, Förderschule).

**3 · Illustrativ erzeugte Werte** — **alle** Zustands-, Mengen- und Bewertungsgrößen sind
**frei generiert**, nicht aus den Quellen entnommen:

> Baujahr · letzte Sanierung · Schülerzahl · Bruttogrundfläche · Zustandsindex ·
> Zustandsklasse · Sanierungsstau · Modernisierung % · Prioritätsscore ·
> Mängel-Flags (Brandschutz, Barrierefreiheit, Schadstoffe) · Maßnahmenstatus

Sie werden **deterministisch** aus einem festen Startwert je Schule (SHA-256 über Name +
Anschrift) erzeugt — derselbe Lauf liefert immer dieselben Zahlen — und sind plausibel
korreliert (älteres Gebäude → schlechterer Zustand → höherer Stau → höhere Priorität),
aber **keine echten Werte der Stadt Düsseldorf**. Auch alle Bezirks- und Stadtsummen
(Ø Zustand, Sanierungsstau gesamt usw.) sind Aggregate dieser erzeugten Werte.

> **Wichtig fürs Gespräch:** Schülerzahlen, Baujahre, „letzte Sanierung", Kosten und
> Status sind im Demonstrator **nicht** die echten Zahlen der Stadt. Sie zeigen nur, *wie*
> die Anwendung mit solchen Daten arbeitet. Im Produktivbetrieb ersetzen wir sie durch die
> Bestands- und Bewertungsdaten des Amtes (Gebäudemanagement/CAFM, vorhandene
> Zustandsbewertungen, Kostenschätzungen).

Die Erzeugung stützt sich auf einige **offen hinterlegte Annahmen** in `generate.py`
(ebenfalls illustrativ): Sanierungskosten-Richtwert **2.650 €/m²**, typische Schüler- und
Flächenspannen je Schulform, eine Baualters-Verteilung sowie die Schwellen für
Zustandsklassen und Mängel-Wahrscheinlichkeiten.

> **„Letzte Sanierung" ist oft leer („—").** Im Demo-Modell erhält nur ein Teil der
> Standorte ein Sanierungsjahr (aktuell rund ein Drittel); die Open-Data-Quelle enthält
> dieses Feld gar nicht. Ein „—" ist daher kein Fehler, sondern „im Modell nicht gesetzt".

### Wie ist der Prioritätsscore aufgebaut?

Regelbasiert und transparent — kein „Black-Box-Algorithmus”. Vier gewichtete Kriterien,
zusammen max. 100 Punkte:

| Kriterium | Gewicht | Berechnung im Demo |
|-----------|:------:|--------------------|
| Gebäudezustand | 40 | (100 − Zustandsindex) / 100 × 40 |
| Betroffene Schüler:innen | 20 | min(1, Schüler / 1.400) × 20 |
| Höhe des Sanierungsstaus | 15 | min(1, Stau / 18 Mio €) × 15 |
| Mängel & Recht (Brandschutz, Barrierefreiheit, Schadstoffe) | 25 | Brandschutz 14 + nicht barrierefrei 6 + Schadstoffe 5 |

Die im Standortprofil gezeigte „Zusammensetzung des Prioritätsscores” sind exakt diese
vier Beiträge — sie summieren sich zum Score. Beispiel Wilhelm-Heinrich-Riehl-Kolleg:
36,8 + 18,6 + 15,0 + 20,0 = **90,4**.

Die Gewichte und Schwellen sind **parametrierbar** und werden gemeinsam mit dem Amt
festgelegt — die fachliche Hoheit bleibt bei Ihnen.

### Wie entstehen Mängel & Recht und der Status?

Im Demonstrator nach **Baualter** modelliert (im Echtbetrieb aus den Daten des Amtes):
Brandschutzmangel vor allem bei alten, unsanierten Gebäuden; „nicht barrierefrei” vor
allem bei Baujahr vor 1992; Schadstoffverdacht im typischen Asbest-Zeitfenster
(Baujahr 1960–1985, unsaniert). Der **Maßnahmenstatus** (abgeschlossen · in Umsetzung ·
geplant · nicht begonnen) leitet sich aus Prioritätsscore und Sanierungsjahr ab. Alle
diese Werte sind illustrativ.

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
