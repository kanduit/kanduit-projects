# Changelog — Wärmewende-Monitor Mülheim

## 2026-08-20 · Erstveröffentlichung

**Datenpipeline.** Einzige Primärquelle ist der
[Endbericht zur Wärmeplanung für Mülheim an der Ruhr](https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf)
(190 Seiten, 19 MB, Redaktionsdatum 15.05.2026, Ratsbeschluss 16.07.2026), ergänzt um die
Wärmeplanungs-Seite der Stadt. `fetch_endbericht.py` liest ihn über Wortkoordinaten
(`pdftotext -bbox-layout`) statt über den Textumbruch und legt acht gefilterte Snapshots
mit zusammen 28 KB in `data/sources/` ab; `generate.py` aggregiert sie deterministisch zu
einer 31 KB großen `data.js`. Das Quell-PDF wird nicht versioniert.

**Übernommen sind:** 22 Indikatoren mit Referenz- und Zielwert (Tabelle 26), 14
Maßnahmensteckbriefe mit Federführung, Beteiligten, Laufzeit, Kostenträger und der Zahl
ihrer Umsetzungsschritte und Erfolgsindikatoren (Kapitel 6.5), 15 Wärmenetze mit
Emissionsfaktoren (Tabelle 35), Endenergie je Energieträger und Sektor über fünf Stützjahre
(Tabellen 36–40), Treibhausgaspfad (Tabelle 41), Erzeugungsmix der Fernwärme (Tabelle 42),
Gebäude an Wärme- und Gasnetz (Tabellen 43/45) sowie 38 Eckwerte aus dem Fließtext, jeder
mit Seitenzahl und einem Muster, das beim nächsten Abruf erneut greifen muss.

**Prüfungen im Abruf.** Jede Tabelle trägt eine harte Zusicherung über ihre Zeilenzahl. Die
Energiereihen werden zusätzlich gegen die im Fließtext genannten Summen abgeglichen
(1.726 GWh im Basisjahr, 980 GWh in 2045, S. 126) — ohne die Umweltwärme-Zeilen treffen sie
auf 0,41 % bzw. 1,41 %. Genau diese Probe hat eine verrutschte Spaltenzuordnung aufgedeckt,
die die reine Zeilenzählung nicht bemerkt hatte. Fußnoten werden über die Schriftgröße
aussortiert.

**Ansichten.** Überblick mit Leitzahl (Wärmepumpenzubau muss 9-mal so schnell werden:
rund 150 → rund 1.350 Anlagen im Jahr, Tabelle 26) und den vier Controlling-Bausteinen aus
Kapitel 8 des Berichts · Indikatoren · Maßnahmen mit Filter und druckbarem
Kennzahlenblatt je Steckbrief · Netze & Prüfgebiete · Umsetzungsfortschritt (Szenario 1) ·
Klimawirkung je Euro (Szenario 2, mit Regler) · Daten & Methode.

**Registerabgleich.** Drei Stellen, an denen der Endbericht sich selbst widerspricht oder
zwei Bezugsgrößen mischt, sind offengelegt statt geglättet: „alle zwölf Maßnahmen" im
Fließtext gegen vierzehn in den Übersichtstabellen und Steckbriefen; 45 km Netz einmal als
Trassenlänge und einmal als Länge inklusive Hausanschlüsse; Adressen (Tabelle 26) gegen
Gebäude (Tabelle 43) als Zähleinheit für Fernwärmeanschlüsse.

**Gegenprobe.** Das naheliegende Fortschreibungsverfahren — eine Gerade vom Basisjahr zum
Zieljahr — wurde an den drei veröffentlichten Stützjahren geprüft, die es nicht gesehen
hat: mittlere absolute Abweichung 45,1 kt bzw. 17,3 %, in allen drei Jahren zu niedrig. Der
Monitor interpoliert deshalb zwischen den Stützjahren. Zusätzlich eine Querprobe des
Anschlusstempos aus zwei unabhängigen Reihen (136,1 bzw. 170,5 gegen genannte 150 pro Jahr).

**Ehrliche Lücken.** Kein Umsetzungsstatus je Maßnahme (nach dem Beschluss nicht
veröffentlicht), keine Anzahl der Versorgungs- und Prüfgebiete (nennt der Bericht nicht),
keine Karte (Geometrien nur bei einem privaten Fachbüro, Nachnutzung ungeklärt). Die
Aufteilung der nicht belegten Klimawirkung ist als ◈-Annahme gekennzeichnet und über einen
Regler veränderbar; die Ansicht benennt selbst, dass die Rangfolge nur zwischen rund 38 %
und 78 % Reglerstellung hält.

**Rechte an den Quellen.** Der Bericht erlaubt eine auszugsweise Veröffentlichung nur mit
Genehmigung der Herausgeber. Übernommen sind daher ausschließlich Zahlen, Kennwerte und
kurze Sachangaben mit Seitenverweis, keine Textpassagen; alle Beschreibungen in der
Oberfläche sind eigene Formulierungen.

**Technik.** Publish-Flow nach `docs/waermewende-monitor-muelheim/` mit CI-Check
`waermewende-monitor-muelheim-publish-check.yml`, Karte auf der Landingpage, Bullet im
Root-README. Gleiche Design-Systematik wie Schulbau- und Vergabe-Monitor (Petrol,
Archivo/IBM Plex Mono, ⓘ-Glossar-Tooltips, Quellen-Link unter jeder Karte, mobile
Tab-Leiste, Druckbereich auf die aktive Ansicht bzw. das Kennzahlenblatt begrenzt).
