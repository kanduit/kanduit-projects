# Schulinvestitions-Monitor Duisburg

Ein Schulträger führt Sanierungsbedarf, Startchancen-Maßnahmen und Ganztags-Raumbedarf
in aller Regel in drei getrennten Listen — obwohl sie um dieselben Standorte und
dieselben Haushaltsmittel konkurrieren. Dieser Demonstrator führt sie für die
135 Duisburger Schulstandorte in einer gemeinsamen, begründbaren Reihenfolge
zusammen und zeigt daneben, was davon als kommunaler Eigenanteil in welchem Haushaltsjahr
anfällt. Adressiert ist die Schulentwicklungsplanung, die den Bedarf plant, und die
Schulraumplanung, die ihn umsetzt.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten &
Software für den öffentlichen Sektor in NRW. Eine englische Übersicht steht in
[`README.md`](README.md).

> **Hinweis:** Dies ist ein **Demonstrator** und kein Produkt der Stadt Duisburg.
> Standorte, Schülerzahlen, Sozialindexstufen, Startchancen-Teilnahme und das
> Schulträgerbudget Säule I stammen unverändert aus veröffentlichten Quellen des
> Schulministeriums NRW und der Stadt Duisburg.
> **Bauzustand, Maßnahmenkosten und die Ganztagsquote liegen nicht offen vor** — sie sind
> deterministische Demo-Annahmen, in der Oberfläche durchgängig mit ◈ gekennzeichnet und
> im Projekt durch Amtsdaten zu ersetzen.
> Keine personenbezogenen Daten; Schülerzahlen ausschließlich aggregiert je Schule
> (§ 120 SchulG NRW).

---

## Ansichten

| Ansicht | Kern | Ehrlich benannte Lücke |
|---|---|---|
| **Überblick** | Leitzahl (Mindest-Eigenanteil je Jahr), Vergleich aller 22 kreisfreien Städte NRW, 135 Standorte, 71.852 Schülerinnen und Schüler, 48 Startchancen-Schulen, 60,0 Mio € Schulträgerbudget | Register aller fünf Demo-Annahmen direkt auf der Seite; der Städtevergleich nennt seine beiden Einschränkungen |
| **Standortkarte** | alle Standorte auf den amtlichen Stadtbezirksgrenzen, eingefärbt nach Prioritätsrang | Einfärbung folgt dem Modell, nicht einer Amtsbewertung |
| **Standortregister** | sortier-, filter- und als CSV exportierbare Tabelle, Zeile öffnet das Kennzahlenblatt | Spalten mit ◈ beruhen auf Annahmen, nicht auf Amtsdaten |
| **Priorisierung** | vier frei gewichtbare Kriterien, Gewichtung jederzeit als Text ablesbar | 28 Standorte ohne Sozialindexstufe gehen neutral ein |
| **Eigenanteil** | Eigenanteil je Haushaltsjahr 2026–2034 unter einstellbarem Jahresdeckel | Einplanungsverfahren und Deckel sind Modellannahmen |
| **Daten & Methode** | Registerabgleich, Gegenprobe an der Vergangenheit, Quellen, Register der Demo-Annahmen | benennt den einseitigen Prognosefehler von -6,5 % |
| **Szenarien** | „Eigenanteil-Deckel“, „Ganztag zuerst“, „Verzögerung um ein Jahr“ | Szenario 3 benennt das Packungs-Artefakt seines eigenen Verfahrens |

Dazu als sechste Ansicht das **Kennzahlenblatt je Standort** (Klick auf Karte, Tabelle
oder Rangliste): druckbar, jede Zahl mit Quelle, Stand und Rechenweg — verwendbar als
Anlage zu Ausschussvorlagen und als Zuarbeit zur Wirtschaftlichkeitsbetrachtung im
Verwendungsnachweis.

## Datenquellen

| Quelle | Inhalt | Abruf |
|--------|--------|-------|
| [Open Data MSB NRW](https://www.schulministerium.nrw/open-data) | Schulverzeichnis (Gemeindeschlüssel 05112000), Schülerzahlen, Sozialindexstufen, Zeitreihe nach Kreis und Schulform | 14.08.2026 |
| [Startchancen-Programm NRW](https://www.schulministerium.nrw/startchancen) | bestätigte Teilnehmerliste (Gesamtliste, Stand 21.05.2025) — 48 Duisburger Schulen | 14.08.2026 |
| [Startchancen-Programm NRW](https://www.schulministerium.nrw/startchancen) | Schulträgerbudgets Investitionsprogramm Säule I (Stand 02.07.2025) — 60,0 Mio € für Duisburg, dazu alle 22 kreisfreien Städte als Vergleichsfeld | 14.08.2026 |
| [Open Data Duisburg](https://opendata-duisburg.de/dataset/stadtbezirke) | amtliche Stadtbezirksgrenzen, über den ArcGIS-Dienst des städtischen Geoportals | 14.08.2026 |

Beide Startchancen-Dateien sind PDF. Die Textextraktion in
`scripts/fetch_startchancen.py` ist stdlib-only (zlib über die Content-Streams, dazu ein
ToUnicode-CMap-Decoder für die CID-Schriften des Budget-PDF) — damit bleibt der Build
ohne Fremdbibliotheken reproduzierbar. Die beiden PDF validieren sich gegenseitig: die
Teilnehmerliste enthält 923 Zeilen, das Budget-PDF nennt im Titel dieselben 923
Startchancen-Schulen.

**Nicht öffentlich verfügbar und deshalb Demo-Annahme:** Bauzustand je Gebäude,
Maßnahmenkosten je Standort, Inanspruchnahmequote des Ganztagsanspruchs, heutiger
OGS-Platzbestand, genehmigte Zügigkeit je Standort. Alle fünf sind in `generate.py`
(Konstante `ANNAHMEN`) im Wortlaut begründet und wandern von dort unverändert in die
Oberfläche.

Bemerkenswert am Rande: das Schulbetriebsdatum des Schulverzeichnisses wäre der
naheliegende Ersatz für ein Baujahr — es steht aber für 101 der 135 Standorte
auf 1973, dem Aufbau des Registers. Es wird deshalb bewusst **nicht** verwendet.

## Prüfung des Verfahrens

Die Trendfortschreibung wird an der Vergangenheit geprüft: angepasst auf
2013–2019, vorhergesagt 2024 — Fenster und Horizont genauso lang
wie in der Produktivrechnung. Mittlere absolute Abweichung 6,5 %
gewichtet nach Schülerzahl, 11,8 % ungewichtet über die Schulformen. Der Fehler
ist einseitig: **alle** fortgeschriebenen Schulformen werden unterschätzt, in Summe um
-6,5 %, weil das Anpassungsfenster die Duisburger Wachstumsphase ab 2020 noch
nicht enthält. Die Prognose taugt damit als Größenordnung und eher als Untergrenze, nicht
als Punktwert je Jahrgang.

## Wie viele Schulen hat Duisburg?

Drei Quellen, drei Zahlen, keine falsch. Die Amtsseite nennt „rund 130" und meint die
Schulen in Trägerschaft der Stadt — laut Trägernummer im Landesregister
129. Dieser Monitor führt 135: alle Schulen im Stadtgebiet
mit aktivem Schulbetrieb, unabhängig vom Träger, weil die Schulentwicklungsplanung nach
§ 80 SchulG NRW das gesamte Stadtgebiet umfasst. Ungefiltert enthält das Register
141 Einträge; die zusätzlichen 6 sind Schulamt, ZfsL und
vier Lehrerseminare.

Für das Geld zählt die Baulast: Sanierungs- und Ganztagsvolumen werden nur für die
129 städtischen Standorte angesetzt.

## Einordnung im Land

Beide Seiten des Vergleichs stammen aus Quellen, die der Monitor ohnehin lädt: das Budget
aus dem Schulträgerbudget-PDF, der Nenner aus der MSB-Zeitreihe. Verknüpft wird über den
Kreisschlüsseltext „Krfr. Stadt …“, der in beiden Quellen zeichengleich ist — es wird
nicht über Namen geraten. Duisburg liegt auf **Rang 5 von
22** mit 836 € je Schülerin und Schüler
(Median 681 €).

Zwei Einschränkungen stehen auch in der Oberfläche: Nenner sind alle Schülerinnen und
Schüler der Stadt, nicht nur die an Startchancen-Schulen; und die Budgethöhe folgt der
Landesauswahl über den Sozialindex — sie misst die soziale Ausgangslage, nicht kommunales
Handeln.

## Pipeline

```bash
python3 scripts/fetch_msb.py           # Schulverzeichnis, Schülerzahlen, Sozialindex, Zeitreihe
python3 scripts/fetch_startchancen.py  # Teilnehmerliste + Schulträgerbudget (PDF)
python3 scripts/fetch_gebiete.py       # Stadtbezirke vom Geoportal Duisburg
python3 scripts/generate.py            # Snapshots → data.js (aggregiert, deterministisch)
python3 serve.py                       # lokale Vorschau → http://localhost:8127
```

Nur gefilterte Snapshots liegen im Repo (zusammen rund 110 KB) — `generate.py` läuft damit
offline und reproduzierbar; zweimal ausgeführt ergibt es eine byteweise identische
`data.js`. Die Stadtbezirksgeometrie wird beim Abruf mit Douglas-Peucker von 9.340 auf 651
Stützpunkte vereinfacht. Firmennamen werden nirgends verarbeitet, personenbezogene Daten
nirgends abgerufen.

## Veröffentlichen (GitHub Pages)

Dieser Ordner ist die **Quelle**; GitHub Pages bedient eine separate Kopie unter
`docs/schulinvestitions-monitor-duisburg/` (nur die vier statischen Dateien):

```bash
python3 scripts/publish.py          # index.html, app.js, styles.css, data.js → docs/
python3 scripts/publish.py --check  # Sync-Prüfung (läuft auch als CI-Check)
```

Ablauf: *fetch → generate → publish → commit → push*. Der CI-Check
(`.github/workflows/schulinvestitions-monitor-duisburg-publish-check.yml`) blockiert Merges mit veraltetem `docs/`.

## Technik

Statisches HTML/CSS/Vanilla-JS, Charts und Karte als handgezeichnetes SVG, keine
Frameworks, keine externen Skripte, kein Tracking — vollständig in Deutschland hostbar.
Sämtliche Berechnung (Prioritätsmodell, Einplanung, Szenarien) läuft im Browser.

## Lizenz

Code: MIT. Daten: siehe Datenquellen. Alle Auswertungen ohne Gewähr.
