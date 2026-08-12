# Changelog — Ganztags-Bedarfsmonitor Bochum

## 2026-08-08 · Ausbaustufe 2

Fünf Erweiterungen aus der Build-Spec, dazu zwei bewusst nicht gebaute.

**Kipppunkt als Leitzahl + Datenstand-Badge.** Über der Navigation stehen jetzt zwei
Elemente, die im Ausschuss hängen bleiben sollen: das Badge „Datenstand geprüft:
07.08.2026 — 329 von 329 städtischen Belegungswerten reproduziert“ (bei Abweichung rot,
mit Anzahl, verlinkt auf den Rechenweg) und die Kipppunkt-Leitzahl mit heutiger Quote,
Schwellwert und Abstand gleichzeitig — auch bei 375 px ohne Scrollen sichtbar.

**Adjazenz-Beschränkung für die Umverteilung.** Neuer Nachbarschaftsgraph der 47
Grundschulbezirke, berechnet auf der *unvereinfachten* Geometrie (gemeinsames Grenzstück
= mindestens zwei geteilte Stützpunkte): 115 Kanten, kein Bezirk ohne Nachbarn, sonst
bricht der Abruf ab. Liegt als eigene, von Hand prüfbare Datei
`data/sources/bo_nachbarschaft.json` im Repo. Verlagerungen sind auf angrenzende Bezirke
beschränkt (Tiefe 1, per Regler 2) und werden in der Karte als Pfeile gezeichnet.
Verifiziert: 86 gezeichnete Pfade bei Tiefe 1 und 2, **null** Verstöße gegen die
Nachbarschaftsbedingung.

**Elternquote als Zeitachse — mit sauberer Zerlegung der beiden Treiber.** Öffentlich
belegt sind für Bochum genau zwei Schuljahre mit Plätzen *und* Ablehnungen. Auf gleichem
Nenner — der amtlichen Grundschülerzahl des Landes — ergibt das 61,0 % (2022/23) und
66,3 % (2026/27), also **+1,33 Punkte je Jahr**. Die Nennerdefinition steht an der Grafik,
nicht nur im README; der Versatz von einem Jahr im Nenner des zweiten Punktes ist benannt
statt weggerechnet.

Die Aussage wird ausdrücklich **nicht** als „1,7 Punkte geteilt durch 1,33 = 1,3 Jahre“
geführt — diese Division unterstellt, die Schwelle von 2029/30 gälte schon heute. Sie gilt
nicht: In den Aufwachsjahren liegt die kritische Quote bei 278 %, 137 % und 94 %. Statt
dessen trennt der Monitor die Treiber: **Das Jahr bestimmt der Stufenplan** — vor 2028/29
kann der Bestand rechnerisch gar nicht reißen; die Schwelle erreicht ihren Tiefstwert von
71,6 % in 2029/30 und steigt danach wieder auf 78 %, weil die Jahrgänge schrumpfen (ein
Buckel, keine Rampe). **Ob es reißt, bestimmt die Elternquote** — bei unveränderten 69,8 %
reicht der Bestand im gesamten Zeitraum.

Belastbar ist der Befund über die Marge: Für ein Kippen in 2029/30 genügen **0,58 Punkte
je Jahr** gegenüber den belegten 1,33. Selbst wenn 56 % des Anstiegs ein einmaliger
Anmeldeeffekt des zum 01.08.2026 in Kraft getretenen Rechtsanspruchs wären — der
naheliegendste Einwand, da der Endpunkt genau dieses Jahr ist — bliebe es beim Kippen in
2029/30. Die Kennzahl heißt im UI durchgehend „durchschnittliche Veränderung zwischen zwei
belegten Jahren“, nie „Trend“, und ist als Regler ausgelegt.

**Kostenachse in Euro.** Alle Sätze aus der Förderrichtlinie selbst (BASS 11-02 Nr. 19,
Fassung BASS 2026/2027, ab 01.08.2026), nicht aus Pressemitteilungen: Landeszuschuss
1.138 € je Kind und Schuljahr, kommunaler Eigenanteil 603 € je Platz und Jahr,
Elternbeitrag höchstens 242 € je Kind und Monat, jährlich +3 % zum 1. August. Jedes
Szenario zusätzlich in Euro je Schuljahr, getrennt nach Land / Kommune / Eltern und
ausdrücklich **nicht saldiert**. Jeder Betrag ist im UI auf Satz, Fundstelle und Fassung
rückführbar. Der Kipppunkt erscheint zusätzlich als jährliche Mehrbelastung des
kommunalen Haushalts.

**Sozialindex-gewichtete Allokation als Umschalter.** Zweite Verteilung derselben
belegten Gesamtzahl, gewichtet mit einem Take-up-Faktor aus der schulscharfen
Sozialindexstufe des Landes — genau ein freier Parameter, Summe bleibt bei 8.397 Plätzen.
Steht **neben** der flachen Verteilung, nicht an deren Stelle; Standard bleibt flach, der
Zustand ist aus jeder Ansicht am Umschalter erkennbar. Eigene Ansicht: Differenz beider
Allokationen je Bezirk. Damit wird die Datenlücke vom Schwachpunkt zur messbaren Größe.

**Szenarien umbenannt** auf „Stufenplan Regelfall“, „Kipppunkt Elternquote“,
„Umverteilung statt Ausbau“. Die Ausbaurate bleibt als Regler erhalten. Fünf Regler
insgesamt: Quote, Veränderung je Jahr, Ausbau, Umverteilungstiefe, Sozialindex-Gewicht.

**Nicht gebaut, mit Begründung im README:** Der Peer-Städte-Benchmark und die landesweite
Ganztagsquote entfallen — die Gemeindewerte liegen in der Landesdatenbank NRW hinter
einer Anmeldung, ein anonymer reproduzierbarer Abruf ist nicht möglich. Ohne
reproduzierbare Quelle keine Kennzahl. Ebenfalls nicht gebaut, wie in der Spec
festgelegt: das Kapazitäts-Vorhersagemodell aus Fremdstädten.

**Unangetastet:** Das Abbruchverhalten bei Abweichung von den 329 städtischen Werten.

Verifiziert auf Desktop und 375 px: alle sechs Ansichten, alle Szenarien und Regler,
keine Konsolen-Fehler, kein horizontaler Seiten-Overflow, `data.js` deterministisch
(86 KB).

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
Deterministisch; zwei Läufe erzeugen ein byteidentisches `data.js`.

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
5. **Szenarien** — drei benannte Szenarien mit Reglern für Inanspruchnahmequote und
   Ausbaurate.
6. **Daten & Methode** — Registerabgleich 49/47/46, Quellenliste mit Status
   (belegt / Sekundärquelle / Datenlieferung Amt erforderlich), Rechenweg.

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
