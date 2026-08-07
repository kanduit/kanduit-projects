# Changelog — Ganztags-Bedarfsmonitor Bochum

## 2026-08-07 · Erstveröffentlichung

**Datenpipeline** — vier Fetch-Skripte, stdlib-only, Snapshots zusammen rund 100 KB:

- `fetch_grundschulbezirke.py`: Kartendienst *maponline* der Stadt Bochum, Thema
  „Grundschulen“, Layer 10 (Layer 10–15 tragen identische Sachdaten). 47 Grundschul-
  bezirke mit Grenzen, Jahrgangsstärken 2025/26, Einwohnern 0–5 Jahre (Stand 2025),
  Prognosejahrgängen sowie Belegungs- und Kapazitätsprognose bis 2031/32. Grenzen mit
  Douglas-Peucker auf 25 m vereinfacht (2.564 von 17.497 Stützpunkten), Koordinaten auf
  vier Nachkommastellen. Das fehlerhafte Quellfeld `PR_SJ_4` („2029.203“) wird als
  Schuljahr 2029/2030 gelesen und die Korrektur mitgeführt.
- `fetch_bostatis.py`: Geburten und Sterbefälle je statistischem Bezirk 2017–2025 sowie
  Einwohner nach einzelnen Altersjahren (Stand 31.12.2022, auf 5 gerundet). Die
  Downloadadressen werden über die Katalog-Schnittstelle des Portals aufgelöst statt
  fest verdrahtet; der Parser erkennt beide Tabellenformate der Geburtenreihe.
- `fetch_msb.py`: Schulverzeichnis, Schülerzahlen, Sozialindexstufen und Zeitreihe des
  Schulministeriums NRW, gefiltert auf Bochum (Gemeindeschlüssel 05911000, Kreis 911).
- `fetch_ogs_eckwerte.py`: stadtweite OGS-Eckwerte 2026/27. Statt die Zahlen abzutippen,
  lädt das Skript die Quelle und weist jeden Wert im Quelltext nach — schlägt eine
  Prüfung fehl, bricht der Abruf ab.

**Modell** — `generate.py` rechnet die Jahrgangsstufenverteilung aus den offenen
Planungsdaten zurück (Klasse *k* im Prognosejahr *i* stammt aus Einschulungsjahrgang
*i − k + 1*) und prüft sie gegen die veröffentlichte Belegung: 47 Bezirke × 7
Prognosejahre = 329 Werte, keine Abweichung. Bei Abweichung bricht der Lauf ab.
Deterministisch; zwei Läufe erzeugen ein byteidentisches `data.js` (80 KB).

**Ansichten** — sechs Reiter:

1. **Überblick** — Anspruchsberechtigte je Schuljahr nach Klassenstufe gegen die
   stadtweit belegte Platzzahl, Geburtenreihe als Vorlauf. Kernbefund: 11.734
   Anspruchsberechtigte 2029/30, kritische Elternquote 71,6 % gegenüber heute 69,8 %.
2. **Karte** — 47 Grundschulbezirke als SVG, eingefärbt nach Deckungsgrad, umschaltbar
   nach Schuljahr und Szenario, Punktfläche proportional zu den anspruchsberechtigten
   Kindern.
3. **Lückenampel** — alle Standorte sortierbar, mit Eintrittsjahr der Lücke, Filter auf
   Standorte mit Lücke und CSV-Export inklusive Annahmen-Kopfzeilen.
4. **Standorte** — Jahrgangsverlauf, Kohortenherkunft nach Altersjahr, freie
   Grundschulkapazität laut Stadt, Tabelle je Schuljahr.
5. **Szenarien** — „Stufenplan Regelfall“, „Ausbaupfad 400“, „Elternquote 90“, dazu
   Regler für Inanspruchnahmequote und Ausbaurate.
6. **Daten & Methode** — Registerabgleich 49/47/46, Quellenliste mit Status
   (belegt / Sekundärquelle / Datenlieferung Amt erforderlich), Rechenweg in sieben
   Schritten.

**Ehrlich benannte Datenlücken** — es gibt keinen offenen Datensatz mit OGS-Plätzen je
Grundschule; die Standortkapazität ist eine Verteilungsannahme aus der stadtweit
belegten Platzzahl und im UI durchgängig als solche gekennzeichnet. Ebenfalls ausgewiesen:
die Lesart der Aufwachsjahre 2026/27 bis 2028/29 (Anspruch gegen Gesamtbestand), die drei
abweichenden Schulzahlen, die 5er-Rundung der Altersjahrgänge, der fehlende
Open-Data-Status des Kartendienstes und die Sekundärquelle der OGS-Eckwerte.

**Technik** — Publish-Flow nach `docs/ganztags-bedarfsmonitor-bochum/` mit CI-Check
(`ganztags-bedarfsmonitor-bochum-publish-check.yml`), Karte auf der Landingpage, Bullet
im Root-README. Gleiche Design-Systematik wie Schulbau-/Vergabe-Monitor (Petrol,
Archivo/IBM Plex Mono, ⓘ-Glossar-Tooltips, Quellen-Link unter jeder Karte, mobile
Tab-Leiste). Verifiziert auf Desktop und 375 px: alle Ansichten, keine Konsolen-Fehler,
kein horizontaler Seiten-Overflow.
