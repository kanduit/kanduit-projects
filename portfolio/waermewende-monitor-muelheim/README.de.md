# Wärmewende-Monitor Mülheim

Umsetzungsverfolgung der kommunalen Wärmeplanung, die der Rat der Stadt Mülheim an der
Ruhr am 16. Juli 2026 beschlossen hat. Der Demonstrator macht aus dem 190-seitigen
Endbericht eine arbeitsfähige Controlling-Schicht: alle 22 Indikatoren mit Referenz- und
Zielwert, die 14 Maßnahmensteckbriefe mit Federführung und Laufzeit, die Wärmenetze mit
ihren Emissionsfaktoren und den Investitionsrahmen des Plans, sortiert nach Klimawirkung je
Euro. Adressiert sind die Koordinierungsstelle Wärmeplanung und die Stabsstelle Klimaschutz
und Klimaanpassung — die Stellen, die ab jetzt über den Fortschritt berichten müssen.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Stadt Mülheim an der Ruhr.
> Alle Zahlen stammen aus **veröffentlichten Quellen** — vor allem dem
> [Endbericht zur Wärmeplanung](https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf)
> der Stadt selbst (Redaktionsdatum 15.05.2026). Keine personenbezogenen Daten.

---

## Ansichten

1. **Überblick** — Leitzahl: Der Wärmepumpenzubau muss **9-mal so schnell** werden wie
   heute (rund 150 → rund 1.350 Anlagen im Jahr). Dazu der Treibhausgaspfad und die vier
   Controlling-Bausteine, die der Endbericht selbst benennt.
2. **Indikatoren** — alle 22 Indikatoren aus Tabelle 26 mit Referenz- und Zielwert. Die
   Ist-Spalte bleibt leer: Seit dem Ratsbeschluss ist kein Ist-Wert veröffentlicht.
3. **Maßnahmen** — die 14 Steckbriefe, filterbar, je mit druckbarem Kennzahlenblatt. Nur
   4 von 14 werden von der Stadtverwaltung selbst geführt.
4. **Netze & Prüfgebiete** — Emissionsfaktoren der 11 bestehenden Netze, die vier
   Kategorien offener Prüfgebiete und die Begründung, warum hier keine Karte steht.
5. **Umsetzungsfortschritt** (Szenario 1) — der Zielpfad je Stützjahr: Endenergie nach
   Energieträgern und Sektoren, Gebäude an Wärme- und Gasnetz, Erzeugungsmix.
6. **Klimawirkung je Euro** (Szenario 2) — Investition je Tonne vermiedener
   Jahresemission, mit Regler für die eine Aufteilung, die der Bericht nicht beziffert.
7. **Daten & Methode** — drei Stellen, an denen der Bericht sich selbst widerspricht, die
   Gegenprobe des Fortschreibungsverfahrens, eine Querprobe aus zwei unabhängigen Reihen
   und das Register der Demo-Annahmen.

## Was der Demonstrator bewusst nicht zeigt

- **Keine Karte der Versorgungsgebiete.** Der Endbericht nennt Flächen- und Bedarfsanteile
  (17 % der Fläche, 810 GWh/a, über 51 % des Wärmebedarfs), aber an keiner Stelle eine
  Anzahl von Gebieten. Die Geometrien liegen nur in einer Online-Karte auf der
  Infrastruktur eines privaten Fachbüros — die Nachnutzung ist ungeklärt.
- **Keinen Umsetzungsstatus je Maßnahme.** Der Plan wurde am 16.07.2026 beschlossen; ein
  Status ist noch nicht veröffentlicht. Die Spalte bleibt leer statt erfunden.
- **Keine Textpassagen aus dem Endbericht** (siehe „Rechte an den Quellen").

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| [Endbericht zur Wärmeplanung für Mülheim an der Ruhr](https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf) (PDF, 190 S., 19 MB) | Indikatoren (Tabelle 26), Maßnahmensteckbriefe (Kap. 6.5), Emissionsfaktoren der Netze (Tabelle 35), Energie- und Emissionsreihen (Tabellen 36–45), Investitionsrahmen (Kap. 5.7) | 20.08.2026 |
| [Wärmeplanung — Stadt Mülheim an der Ruhr](https://cms.muelheim-ruhr.de/stadtraum/planen-und-bauen/waermeplanung) | Ratsbeschluss 16.07.2026, FAQ zu Monitoring und Prüfgebieten | 20.08.2026 |

### Rechte an den Quellen

Der Endbericht trägt im Impressum den Hinweis, dass er nur unverkürzt vervielfältigt werden
darf und eine Veröffentlichung auch auszugsweise der Genehmigung der Herausgeber bedarf.
Dieser Demonstrator gibt deshalb **Zahlen, Kennwerte und kurze Sachangaben** (Federführung,
Laufzeit, Kostenträger) mit Seitenverweis wieder, aber **keine Textpassagen** aus dem
Bericht oder den Steckbriefen; alle Beschreibungen in der Oberfläche sind eigene
Formulierungen. Zweite offene Frage: Die interaktive Karte der Versorgungsgebiete läuft auf
der Infrastruktur eines privaten Fachbüros, nicht auf einem städtischen Geoportal — die
Nachnutzung der Geometrien wäre gesondert zu klären. **Beides ist vor einer
Veröffentlichung über dieses Repository hinaus mit der Stadt zu klären.**

## Pipeline

```bash
python3 scripts/fetch_endbericht.py  # PDF → data/sources/*.json (8 Snapshots, 28 KB)
python3 scripts/generate.py        # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                   # lokale Vorschau → http://localhost:8128
```

Nur gefilterte Snapshots liegen im Repo — `generate.py` läuft damit offline und
reproduzierbar — zweimal ausgeführt entsteht ein byte-gleiches `data.js`.

`fetch_endbericht.py` braucht `pdftotext` (poppler) und liest die Tabellen über
**Wortkoordinaten**, nicht über den Textumbruch: Der Endbericht setzt umbrochene und
vertikal verbundene Zellen, bei denen eine reine Textextraktion die Spaltenzuordnung
verliert. Jede Tabelle trägt eine harte Prüfung — Zeilenzahlen (22 Indikatoren, 14
Steckbriefe, 15 Netze, 10 Energieträger je Stützjahr) und ein Abgleich der Energiereihen
gegen die im Fließtext genannten Summen (S. 126). Eine verrutschte Spalte lässt den Abruf
fehlschlagen, statt still falsche Zahlen weiterzureichen. Fußnoten werden über die
Schriftgröße aussortiert, sonst rutschen sie in das Feld darüber.

Das 19 MB große Quell-PDF wird **nicht** mitgeliefert; `--pdf` nimmt eine lokale Kopie,
sonst lädt das Skript es einmalig nach `data/sources/_endbericht.pdf` (gitignoriert).

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/waermewende-monitor-muelheim/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/waermewende-monitor-muelheim-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
