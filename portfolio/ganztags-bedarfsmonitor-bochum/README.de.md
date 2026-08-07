# Ganztags-Bedarfsmonitor Bochum

Der Rechtsanspruch auf ganztägige Förderung im Grundschulalter (§ 24 Abs. 4 SGB VIII)
gilt seit dem 01.08.2026 und wächst bis 2029/30 jahrgangsweise auf. Dieser Demonstrator
beantwortet die Frage, die daraus für das Jugendamt folgt: **Welcher Grundschulbezirk
reißt in welchem Schuljahr welchen Anspruch — und ab welcher Elternquote kippt die
stadtweite Bilanz?** Grundlage sind ausschließlich veröffentlichte Daten, allen voran
die Kohortenrechnung der Stadt Bochum selbst.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Stadt Bochum.
> Alle Zahlen stammen aus **veröffentlichten Quellen**: dem Kartendienst *maponline*
> der Stadt Bochum (Thema „Grundschulen“), dem Statistikportal BOStatIS, dem Open-Data-
> Angebot des Schulministeriums NRW und einer Pressemitteilung zu den stadtweiten
> OGS-Eckwerten. Verarbeitet werden ausschließlich Jahrgangs- und Bezirkssummen —
> keine Einzelfall- oder Sozialdaten nach §§ 61 ff. SGB VIII i. V. m. SGB X.

---

## Der fachliche Kern

Die Stadt Bochum veröffentlicht je Grundschulbezirk die Klassen 1–4 des Schuljahres
2025/26, die Kinder der Altersjahre 0–5 (Stand 2025) nach einem Abschlag von 7,5 % und
ihre eigene Belegungsprognose bis 2031/32 — **aber nicht, wie sich die prognostizierte
Belegung auf die vier Jahrgangsstufen verteilt.** Genau das braucht der Stufenplan des
Gesetzes.

Diese Verteilung wird zurückgerechnet: Klasse *k* im Prognosejahr *i* stammt aus dem
Einschulungsjahrgang *i − k + 1*; liegt der in der Zukunft, ist es der prognostizierte
Altersjahrgang, sonst die entsprechende Klasse aus 2025/26. **Die Probe darauf ist hart
verdrahtet:** Die Summe der rekonstruierten Klassenstufen muss die veröffentlichte
Belegung ergeben — in allen 47 Bezirken × 7 Prognosejahren = **329 Fällen ohne
Abweichung**. Weicht bei einem künftigen Abruf ein einziger Wert ab, bricht
`scripts/generate.py` ab, statt still eine falsche Zahl auszuliefern.

Der Monitor schätzt also keine Kohorten. Er legt die Anspruchslogik des Gesetzes über
die Kohortenrechnung des Schulträgers.

## Was die Daten zeigen

- Bis 2029/30 wächst der Rechtsanspruch auf alle vier Jahrgangsstufen und damit auf
  **11.734 Kinder**. Gleichzeitig schrumpfen die Jahrgänge — die Stadt selbst erwartet
  11.734 statt 12.445 Kinder im Schuljahr 2026/27.
- Bei der heute beobachteten Inanspruchnahme von **69,8 %** reichen die 8.397 Plätze
  stadtweit rechnerisch aus. **Ab 71,6 % nicht mehr.** Das sind 1,7 Prozentpunkte
  Abstand — der Stufenplan allein sprengt den Bestand nicht, die Elternquote tut es.
- **Und die Elternquote steigt.** Zwischen den beiden belegten Stützpunkten 2022/23 und
  2026/27 hat die angemeldete Nachfrage um **1,33 Punkte je Jahr** zugelegt. Bei dieser
  Steigung ist der Puffer im Schuljahr **2029/30** aufgebraucht — genau in dem Jahr, in
  dem der Rechtsanspruch erstmals alle vier Jahrgangsstufen erfasst. 1,7 Punkte sind
  kein Puffer, sondern gut ein Jahr.
- Trotz auskömmlicher Bilanz haben **21 der 47 Standorte** eine Lücke: Die Plätze liegen
  dort, wo die Kinder weniger werden. **Verlagerung allein in angrenzende Bezirke** senkt
  die Zahl auf 8 Standorte und die offenen Plätze von 568 auf 130 — ohne einen einzigen
  neuen Platz.
- Die Geburten sind von 3.457 (2018) auf 2.759 (2025) gefallen — der Vorlauf jeder
  Einschulungsplanung bis 2031/32.
- In Euro: Der kommunale Eigenanteil liegt 2029/30 bei rund **5,5 Mio. €** im Jahr, der
  Landeszuschuss bei **9,5 Mio. €**. Die Lücke zu schließen kostet die Stadt rechnerisch
  **374 T€** jährlich zusätzlich — ohne Investitions- und Raumkosten, die nicht
  öffentlich sind.

## Ansichten

| Ansicht | Kern | Datenlücke |
|---|---|---|
| **Überblick** | Anspruchsberechtigte je Schuljahr nach Klassenstufe, gegen die stadtweit belegte Platzzahl; Geburtenreihe als Vorlauf | stadtweite Platzzahl ist belegt, ihre Verteilung nicht |
| **Karte** | 47 Grundschulbezirke, eingefärbt nach Deckungsgrad, umschaltbar nach Schuljahr und Szenario | Deckungsunterschiede stammen aus den Kohorten, nicht aus Standortkapazitäten |
| **Lückenampel** | alle Standorte sortierbar, mit Eintrittsjahr der Lücke, CSV-Export im Zuschnitt einer Ausschussvorlage | Spalte „Plätze“ ist die einzige Verteilungsannahme des Modells |
| **Standorte** | Jahrgangsverlauf, Kohortenherkunft nach Altersjahr, freie Grundschulkapazität laut Stadt | Sozialindexstufe nur je Stammschule, nicht je Teilstandort |
| **Szenarien** | „Stufenplan Regelfall“, „Kipppunkt Elternquote“, „Umverteilung statt Ausbau“, dazu fünf Regler, Elternquote als Zeitachse und das Kostenbild in Euro | Träger-, Personal- und Raumkapazitäten sowie Investitionskosten sind nicht öffentlich |
| **Daten & Methode** | Registerabgleich 49/47/46, Quellenliste mit Status, Rechenweg Schritt für Schritt | benennt ausdrücklich, was eine Datenlieferung des Amtes braucht |

Zwei Elemente stehen bewusst vor der Navigation, weil sie im Ausschuss die Zahlen sind,
die hängen bleiben: das **Datenstand-Badge** („329 von 329 städtischen Belegungswerten
reproduziert“, bei Abweichung rot) und die **Kipppunkt-Leitzahl** — heutige Quote,
Schwellwert und Abstand gleichzeitig sichtbar, auch bei 375 px Breite.

## Die eine Annahme — offen benannt, und in zwei Fassungen

**Es gibt keinen öffentlichen Datensatz mit OGS-Plätzen je Grundschule.** Belegt ist
allein die stadtweite Zahl von 8.397 Plätzen zum Schuljahr 2026/27. Sie wird im
Ausgangsjahr proportional zur Schülerzahl auf die Standorte verteilt und danach
festgehalten. Daraus folgt: Alle Unterschiede im Deckungsgrad zwischen den Standorten
entstehen aus den Kohorten der Stadt, nicht aus erfundenen Standortwerten. Liefert das
Amt seine Zahlen, ersetzen sie genau eine Zeile im Modell — an der Systematik ändert
sich nichts. Im UI ist die Spalte durchgängig als Annahme gekennzeichnet.

Statt die Lücke zu verstecken, macht der Monitor sie messbar: Er bietet **zwei
begründbare Verteilungen derselben belegten Gesamtzahl** an, umschaltbar in jeder
Ansicht. Neben der flachen Verteilung nach Schülerzahl steht eine **sozialindex­
gewichtete**, die den schulscharf veröffentlichten Sozialindex des Landes als
Take-up-Faktor nutzt — genau ein freier Parameter, die Summe bleibt bei 8.397. Eine
eigene Ansicht zeigt die Differenz beider Verteilungen je Bezirk. Das ist der Satz fürs
Gespräch: *„Hier sind zwei begründbare Verteilungsannahmen. Der Abstand zwischen ihnen
ist genau das, was Ihre eigene Platzliste auflösen würde.“* Standard bleibt die flache
Verteilung.

**Was ausdrücklich nicht gebaut wurde:** ein Kapazitäts-Vorhersagemodell aus anderen
NRW-Städten. Die Trainingsdaten existieren nicht (OGS-Plätze je Schule stehen in keinem
Landesdatensatz), die Zielgröße ist pfadabhängige Verwaltungsgeschichte statt
Naturphänomen, und ein solches Modell würde die reproduzierten 329 Werte entwerten. Jede
Zahl im Monitor fällt in genau eine von drei Klassen — **gemessen**, **rekonstruiert**
oder **angenommen** — und die Klasse ist im UI erkennbar. Eine vierte Klasse, geschätzt
aber wie gemessen dargestellt, gibt es nicht.

**Lesart der Aufwachsjahre:** Von 2026/27 bis 2028/29 halten erst ein bis drei
Jahrgangsstufen einen Anspruch, die Plätze belegen aber weiterhin alle vier. Die Ampel
misst dort, wie viel des Bestandes rechtlich gebunden ist — nicht die tatsächliche
Nachfrage. Dass es real schon eng ist, zeigt die Stadt selbst: 292 Ablehnungen zum
Schuljahr 2026/27. Die Standortansicht führt beide Größen nebeneinander.

## Was nicht gebaut wurde — und warum

**Kein Peer-Städte-Benchmark.** Die Ganztagsquoten auf Gemeindeebene liegen in der
Landesdatenbank NRW (GENESIS-Online), deren Tabellenabruf eine Anmeldung verlangt; ein
anonymer, reproduzierbarer Abruf ist nicht möglich. Ohne reproduzierbare Quelle keine
Kennzahl — die Zahlen von Hand abzutippen würde die Pipeline brechen, die sonst überall
offline und nachvollziehbar läuft.

**Keine landesweite Ganztagsquote neben der Bochumer Kurve.** Sie hat einen anderen
Nenner (alle Grundschulkinder gegenüber einer OGS-Inanspruchnahme) und ließ sich aus
denselben Gründen nicht belastbar beschaffen. Zwei Größen mit unterschiedlichem Nenner
gehören nicht in dieselbe Grafik; der Monitor zeigt deshalb ausschließlich die Bochumer
Reihe und benennt ihren Nenner direkt an der Grafik.

## Wie viele Grundschulen hat Bochum?

Drei Quellen, drei Zahlen — und keine ist falsch:

| Quelle | Zahl | Zählweise |
|---|---|---|
| Mitteilung der Stadt, Mai 2026 | 49 | Zählweise nicht ausgewiesen |
| Kartendienst der Stadt | **47** | Grundschulbezirke: 41 Standorte + 6 Teilstandorte |
| Schulverzeichnis NRW | 46 | in Betrieb: 43 öffentlich + 3 privat |

Der Monitor rechnet auf den 47 Bezirken — nur sie bringen Kohorten und Grenzen mit.
Ohne eigenen Schulbezirk sind Don-Bosco-Schule und Weilenbrink-Schule; die drei
Ersatzschulen (Carolinenschule, Freie Schule Bochum, Matthias-Claudius-Schule) haben
per Definition keinen. Daher rechnet der Monitor mit 12.277 statt 13.110 Kindern.
Die Ansicht „Daten & Methode“ weist das aus, statt es zu glätten.

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| [Stadt Bochum, Kartendienst *maponline*, Thema „Grundschulen“](https://geoservicekkm.bochum.de/arcgis/rest/services/maponline/Grundschulen/MapServer) | 47 Grundschulbezirke: Grenzen, Anschrift, Jahrgangsstärken 2025/26, Einwohner 0–5 Jahre (Stand 2025), Prognosejahrgänge, Belegungs- und Kapazitätsprognose 2025/26–2031/32 | ArcGIS-REST, Layer 10 (Layer 10–15 tragen identische Sachdaten) |
| [Stadt Bochum, BOStatIS](https://bostatis.bochum.de/) | Geburten und Sterbefälle je statistischem Bezirk 2017–2025 | Katalog-Schnittstelle `POST /service/app/search/all` → CSV |
| [Stadt Bochum, BOStatIS (Open Data)](https://bostatis.bochum.de/) | Einwohner nach einzelnen Altersjahren je statistischem Bezirk, Stand 31.12.2022, auf 5 gerundet | dieselbe Schnittstelle → CSV |
| [Schulministerium NRW, Open Data](https://www.schulministerium.nrw/open-data) | Schulverzeichnis, Schülerzahlen, Sozialindexstufen, Zeitreihe ab 2012 | CSV |
| [Bericht über Angaben der Stadt Bochum, 18.05.2026](https://www.radiobochum.de/artikel/mehr-ogs-plaetze-an-grundschulen-in-bochum-2651761) | stadtweite OGS-Eckwerte 2022/23 und 2026/27: Plätze und Ablehnungen | HTML; jeder Wert wird beim Abruf im Quelltext nachgewiesen |
| [BASS 11-02 Nr. 19, Fassung BASS 2026/2027](https://bass.schule.nrw/4938.htm) | Fördersätze des Offenen Ganztags ab 01.08.2026: Landeszuschuss, kommunaler Eigenanteil, Elternbeitrags-Höchstgrenze, jährliche Steigerung | HTML; jeder Betrag wird beim Abruf in der Richtlinie nachgewiesen |
| abgeleitet aus den Bezirksgrenzen | Nachbarschaftsgraph der 47 Grundschulbezirke, 115 Kanten | eigene Datei `data/sources/bo_nachbarschaft.json`, von Hand prüfbar |

Zwei Hinweise zur Belastbarkeit: Der Kartendienst ist öffentlich erreichbar und über das
Geoportal der Stadt eingebunden, aber **nicht als lizenzierter Open-Data-Datensatz im
Portal geführt** — vor produktiver Nutzung ist die Freigabe mit dem Amt zu klären. Die
OGS-Eckwerte sind eine **Sekundärquelle**; vor Verwendung außerhalb dieses Demonstrators
sind sie an der Vorlage des Jugendhilfeausschusses zu prüfen.

## Pipeline

```bash
python3 scripts/fetch_grundschulbezirke.py  # Kartendienst → bo_grundschulbezirke.json + bo_nachbarschaft.json
python3 scripts/fetch_bostatis.py           # BOStatIS → bo_geburten.json, bo_altersjahrgaenge.json
python3 scripts/fetch_msb.py                # Schulministerium → msb_*.json
python3 scripts/fetch_ogs_eckwerte.py       # stadtweite Eckwerte → bo_ogs_eckwerte.json
python3 scripts/fetch_bass.py               # Förderrichtlinie → bass_ogs_foerderung.json
python3 scripts/generate.py                 # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                            # lokale Vorschau → http://localhost:8126
```

Nur gefilterte Snapshots liegen im Repo (zusammen rund 100 KB) — `generate.py` läuft
damit offline und reproduzierbar; zwei Läufe erzeugen ein byteidentisches `data.js`.
Quellenspezifische Besonderheiten:

- **Bezirksgrenzen** werden mit Douglas-Peucker auf 25 m Toleranz vereinfacht
  (2.564 von 17.497 Stützpunkten) und auf vier Nachkommastellen gerundet — eine
  Übersichtskarte, keine Katasterkarte.
- **Teilstandorte** führt der Kartendienst als Schulnummer mit Suffix `T`; für den
  Abgleich mit dem Landesverzeichnis wird auf die Stammnummer zurückgeführt.
- Das Feld `PR_SJ_4` enthält in der Quelle den fehlerhaften Wert `2029.203`; es wird als
  Schuljahr 2029/2030 gelesen und die Korrektur in `data.js` und im UI dokumentiert.
- Die Altersjahrgänge sind aus Datenschutzgründen auf 5 gerundet (Verfahren D5) — gut
  für Größenordnungen, nicht für Platzbescheide.
- Der **Nachbarschaftsgraph** wird auf der *unvereinfachten* Geometrie berechnet: Zwei
  Bezirke gelten als benachbart, wenn ihre Umringe mindestens zwei Stützpunkte teilen.
  Nach der Vereinfachung wäre das nicht mehr zuverlässig. Ergebnis: 115 Kanten, kein
  Bezirk ohne Nachbarn — sonst bricht der Abruf ab.
- Die **Steigung der Elternquote** stammt aus zwei belegten Stützpunkten auf gleichem
  Nenner; für 2026/27 reicht die amtliche Schülerreihe noch nicht, dort steht der
  jüngste Wert (2025/26). Dieser Versatz von einem Jahr ist im UI benannt statt
  weggerechnet.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/ganztags-bedarfsmonitor-bochum/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/ganztags-bedarfsmonitor-bochum-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts als handgezeichnetes SVG, keine Frameworks,
keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar. Die gesamte
Rechnung inklusive Szenarien läuft im Browser; die Seite lädt nur die mitgelieferte
Datendatei.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
