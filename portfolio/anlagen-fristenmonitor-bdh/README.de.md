# Anlagen- und Fristenmonitor BDH

Prüffähiges Anlagenregister und Fristenkalender für die gemeinsame Untere
Umweltschutzbehörde Bochum / Dortmund / Hagen (Gebietsschlüssel 911, 913, 914).
Zwei Register bleiben getrennt: 144 schematische MFA nach der 44. BImSchV
und 68 öffentliche IED-Betriebe (davon 40 mit PRTR 2024). Die Leitzahl zählt
die jährlichen Messnachweise der nächsten 12 Monate — Untergrenze, mit Frist
01.01.2025 — nicht die 40 PRTR-Einrichtungen.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Städte Bochum, Dortmund und Hagen.
> Alle Zahlen stammen aus **veröffentlichten Quellen** — PRTR und EU-Registry (thru.de),
> ISA-Jahresbericht 2024 (LANUK), Geobasis NRW. Der MFA-Bestand nach 44. BImSchV ist eine
> gekennzeichnete Demo-Annahme (◈). Keine personenbezogenen Daten, keine Betreibernamen.

---

## Ansichten

1. **Überblick** — Leitzahl der jährlichen MFA-Nachweise, beide Tabellen dauerhaft sichtbar.
2. **Anlagenregister** — Dual-Karte (Kreis = MFA, Quadrat = IED) plus dieselben zwei Tabellen.
3. **Fristenkalender** — Monat × Stadt, schematisch; Klick filtert das Register.
4. **Risikoeinstufung** — ein Gewichtsobjekt (§ 52a), nur MFA, IED unbewertet.
5. **Berichtsauszug** — Konzeptansicht: Termine gegen Stellenkapazität.
6. **Daten & Methode** — Registerabgleich 2.030 ≠ 68 ≠ 40 ≠ 144, Gegenprobe MAPE 3,9 %, Annahmen.

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| PRTR 2024 (thru.de) | 40 Einrichtungen BDH, Zeitreihe 2015–2024 | öffentliches Zip / SQLite |
| EU-Registry IE-RL | 68 Betriebe, 84 Anlagenzeilen, Jahr 2024, NW | öffentliches xlsx |
| ISA-Jahresbericht 2024 | NRW / UUBn / Inspektionen 2015–2024 | LANUK-PDF |
| 44. BImSchV Ansprechpersonen | Gebietsschlüssel 911/913/914, ohne Personennamen | LANUK-PDF |
| Geobasis NRW WFS | Stadtgrenzen Bochum, Dortmund, Hagen, EPSG:4326 | WFS |

## Pipeline

```bash
python3 scripts/fetch_prtr.py
python3 scripts/fetch_eu_registry.py
python3 scripts/fetch_isa.py
python3 scripts/fetch_44bv.py
python3 scripts/fetch_gebiete.py
python3 scripts/generate.py        # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                   # lokale Vorschau → http://localhost:8129
```

Nur gefilterte Snapshots liegen im Repo — `generate.py` läuft damit offline und
reproduzierbar. Roh-Zips und die 123-MB-SQLite bleiben im Sitzungscache.
Betreiber-, Straßen- und Muttergesellschaftsnamen fallen bereits beim Fetch.

Hagen wird mit `bundesland=nw` **und** exaktem `ort=Hagen` gefiltert; ein
niedersächsischer Hagen existiert in der EU-Liste und darf nicht mitlaufen.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/anlagen-fristenmonitor-bdh/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/anlagen-fristenmonitor-bdh-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
