---
name: build-demo
description: Build a new static Kanduit demo dashboard (Monitor/Demonstrator) from a build brief. Given a "Demo-Brief für Claude Code" (the fenced block produced by amt-pitch-scout — product name, public data sources, views/KPIs, scenarios, constraints), this skill scaffolds a complete portfolio project from the Kanduit template (design system, publish flow, CI check), builds a build-time data pipeline from real public data, implements the views, verifies in the browser, and opens a PR. Use whenever the user pastes a demo brief, runs /build-demo, asks to "build the demo" from a pitch dossier, or wants a new <Thema>-Monitor for a German city or Amt turned into a working demo.
---

# /build-demo — Kanduit-Demonstrator aus einem Demo-Brief bauen

Builds run **in this repo** (kanduit-projects). The heavy boilerplate (design
system, chrome, chart kit, ◈-Annahmen-Maschinerie, Druckbereich, publish flow,
CI) comes from `template/` via `scaffold.py` — do **not** re-read or re-write
it, and do not read the exemplar projects wholesale. Per-build work is only:
data pipeline, views, German copy.

**Was diese Demos verkauft, ist nicht die Optik.** Es ist der sichtbare Beweis,
dass jemand die Quellen wirklich gelesen hat: dass die Zahl des Amtes von der
eigenen abweicht und warum, dass die Fortschreibung an der Vergangenheit
geprüft wurde, dass die erfundenen Größen als erfunden markiert sind. Die
Pflichtbausteine unten sind genau das — sie sind nicht optional, weil ohne sie
nur ein hübsches Dashboard übrig bleibt.

## Input

The argument (or pasted block) is a demo brief: product name, purpose, data
sources (URLs), views/KPIs, up to ~3 named scenarios, constraints. If missing,
ask for it (amt-pitch-scout dossiers contain one under "Demo-Brief für Claude
Code"). Derive:

- **slug** — lowercase-hyphen ASCII incl. Stadt (`kita-monitor-essen`; ue/oe/ae/ss)
- **title / brand-sub / city** — "Kita-Monitor Essen" / "Kita-Monitor" / "Stadt Essen"
- **tabs** — ≤ 6 `id:Label` pairs from the views (Überblick first; scenarios are
  usually own tabs). `daten:Daten & Methode` hängt `scaffold.py` selbst an.

## Step 1 — Quellen prüfen, bevor irgendetwas gebaut wird

Der Brief ist älter als die Quellen. In jedem bisherigen Build war mindestens
eine Angabe überholt. Deshalb je Quelle **zwei** Abrufe:

1. **Die genannte Datei** (kleiner GET). Tot? Paywall? CORS/Auth? Personenbezug?
2. **Die Landing-Page der Quelle**, von der die Datei verlinkt ist. Dort steht
   fast immer eine neuere Fassung oder eine zweite, bessere Datei.

> Beim Duisburg-Build ergab Schritt 2 die vollständige Teilnehmerliste statt
> einer veralteten Teilliste (21 → 48 Schulen) **und** ein zweites PDF mit dem
> Schulträgerbudget — die Zahl, an der am Ende die halbe Demo hängt. Schritt 1
> allein hätte beides übersehen.

Ebenfalls jetzt klären, nicht später:

- **Join-Schlüssel.** Welche ID verbindet die Quellen? Gibt es keine, ist das
  ein Befund, kein Detail.
- **Ist die Stadt Teil eines Vergleichsfelds?** Enthält eine Quelle auch die
  Nachbarstädte (Landeslisten tun das fast immer), ist der Benchmark quasi
  gratis — siehe Pflichtbaustein 4.

Bei toter, ersetzter oder mehrdeutiger Quelle: **jetzt fragen** (max. 3 Fragen,
eine Runde). **Never invent or substitute data sources silently** — auch dann
nicht, wenn die Ersetzung offensichtlich ist (`opendata.duisburg.de` →
`opendata-duisburg.de` ist ein Tippfehler und trotzdem eine Rückfrage).

## Step 2 — Branch + scaffold

```bash
git checkout main && git pull && git checkout -b FEATURE-<slug>
python3 .claude/skills/build-demo/scaffold.py <slug> \
  --title "…" --brand-sub "…" --city "Stadt …" \
  --tabs "overview:Überblick,…"
```

Scaffold creates `portfolio/<slug>/` (chrome, styles, app.js kit, stub data.js,
serve.py, publish.py, generate.py skeleton, README/CHANGELOG skeletons, die
vorstrukturierte Ansicht *Daten & Methode*) and the CI workflow. It does **not**
touch docs/, the landing page, or git.

## Step 3 — Data pipeline (fetch → snapshot → generate)

- `scripts/fetch_<quelle>.py`: build-time only, stdlib (urllib/csv/json/zipfile).
  Cache large raw downloads in the session scratch dir (never committed); commit
  only **small filtered snapshots** to `data/sources/` (target < ~250 KB/file).
  Record fetch date + source URL in each snapshot.
- `scripts/generate.py`: aggregate snapshots → `data.js`. Offline-reproducible,
  **deterministic** (skeleton enforces `sort_keys=True`; `meta.stand` from
  snapshot metadata, never `now()`). Keep `data.js` < ~100 KB.
- `QUELLEN` und `ANNAHMEN` in `generate.py` pflegen — app.js zieht daraus die
  Quellenzeilen und die ◈-Tooltips. Es gibt keine zweite Stelle, an der eine
  Annahme beschrieben wird.
- **Keine personenbezogenen Daten.** Behörden dürfen genannt werden; Firmen-/
  Zuschlagsempfänger-Namen werden schon beim Fetch verworfen, nie gerankt.

### Vier Fallen, die bisher jeden Build erwischt haben

1. **Nie über Namen joinen.** Namen weichen zwischen Quellen ab (die
  Startchancen-Liste lässt bei Förderschulen den Förderschwerpunkt weg → 3 von
  48 Schulen fielen durch). Über die ID joinen und die **Trefferquote als harte
  Prüfung** ausgeben: `if len(hit) != len(soll): raise SystemExit(...)`.
2. **Anzeigenamen auf Eindeutigkeit prüfen.** 37 Duisburger Standorte heißen im
  Landesregister gleichlautend „Städt. Gem. Grundschule“. Eine Tabelle mit 37
  identischen Zeilen ist im Termin sofort tot. Eindeutigkeit in `generate.py`
  herstellen und per `assert` sichern.
3. **Verlockende Ersatzfelder erst prüfen, dann verwerfen.** Das
  Schulbetriebsdatum sah nach Baujahr aus und stand für 101 von 135 Standorten
  auf 1973 — dem Aufbau des Registers. **Immer die Verteilung ansehen**, bevor
  ein Feld als Proxy dient. Wird eines verworfen, gehört das in die UI: es
  zeigt, dass geprüft wurde.
4. **Angenommene Größen müssen zu den belegten passen.** Erster Duisburger
  Entwurf: 331 Mio € erfundener Sanierungsbedarf neben 86 Mio € belegtem
  Programmvolumen — die belegte Zahl verschwand. Nach dem Generieren die
  Summen ansehen und die Annahme kalibrieren, bis die Größenordnungen
  vergleichbar sind.

### Zwei Quellen, die sich gegenseitig prüfen

Wo zwei Quellen dieselbe Größe hergeben, das ausrechnen und ausweisen — die
Teilnehmerliste parst zu 923 Zeilen, das Budget-PDF nennt im Titel dieselben
923 Schulen. Solche Übereinstimmungen sind das billigste Vertrauen im ganzen
Projekt.

## Step 4 — Views

One `render<Tab>()` per tab in `app.js`, using **only** the kit helpers already
there: `statCard`, `barChart`, `columnChart` (stacked/breaks/legend), `mixBar`,
`infoIcon`, `assumeMark`, `showTip`, `verdrahteQuellen`, de-DE formatters.

- `METRIC_INFO` — one entry per KPI **and** chart; each names Berechnung UND
  Datenlücken (feeds the ⓘ tooltips).
- `<p class="note src-note" data-src="…">` under **every** chart card;
  `verdrahteQuellen()` nach jedem Nachrendern aufrufen.
- `.banner.warn` / `.banner.info` / `.banner.assume-banner` für Rahmung.
- Replace all TODOs in `index.html` — German UI throughout.

### Pflichtbausteine

Diese fünf sind kein Bonus. Ohne sie sieht der Demonstrator aus wie jedes
andere Dashboard.

1. **Leitzahl** (`.leitzahl`, ganz oben im Überblick). *Eine* Zahl, die das
  Argument trägt, statt vier gleich großer Kacheln. Sie muss eine Frist oder
  eine Konsequenz hinter sich haben — „mindestens 11,0 Mio € Eigenanteil je
  Jahr, sonst verfällt Fördergeld bis 2034“ bewegt ein Gespräch, „135
  Standorte“ nicht. Wo eine Bandbreite möglich ist, die **Untergrenze** rechnen
  und als solche benennen.
2. **Ansicht „Daten & Methode“** (von `scaffold.py` vorstrukturiert): der Ort
  für die Frage, die in jedem Termin kommt.
3. **Registerabgleich** — wenn Amtsseite und Landesregister verschiedene Zahlen
  nennen („rund 130“ gegen 135), gehört genau das als Karte dorthin, nicht in
  eine Fußnote. Es ist der erste Einwand und die billigste Gelegenheit,
  Sorgfalt zu zeigen.
4. **Gegenprobe** — jedes Fortschreibungs- oder Prognoseverfahren an der
  Vergangenheit prüfen: auf altem Fenster anpassen, die bekannten Jahre
  vorhersagen, mittlere absolute Abweichung ausweisen, und das Ergebnis ehrlich
  einordnen („taugt als Größenordnung, nicht als Planungsgrundlage je
  Jahrgang“). Ohne diese Karte ist jede Prognose eine Behauptung.
5. **Register der Demo-Annahmen** aus `DATA.annahmen`, zugleich die
  Einkaufsliste fürs Projekt: „was belegt ist — und was eine Datenlieferung des
  Amtes braucht“.

Dazu, wenn die Daten es hergeben:

- **Benchmark** — enthält eine Landesquelle auch die Nachbarstädte, den
  Vergleich bauen und **normieren** (je Kopf, je Schüler, je Fall). Rang statt
  Adjektiv: „Rang 5 von 22, 23 % über dem Median“ schlägt „überdurchschnittlich
  vertreten“. Beide Einschränkungen der Normierung dazuschreiben.
- **Kennzahlenblatt** (Drawer) je Standort/Fall, druckbar, jede Zahl mit
  Quelle, Stand und Rechenweg — als Anlage zu Ausschussvorlagen.

### Ehrlichkeit als Funktion, nicht als Fußnote

- Jede Kennzahl mit Teilabdeckung sagt das in der UI („nur X von Y … —
  Untergrenze“) und in ihrem METRIC_INFO-Eintrag.
- Jede angenommene Größe trägt ein ◈ mit dem vollen Begründungstext.
- Simulierte Ansichten heißen „schematisch“ / „Konzeptansicht“.
- **Wenn das eigene Modell ein Artefakt produziert, benennt die UI es.** Der
  Duisburger Verzögerungs-Fall erhöht bei engem Deckel den Förderabruf
  rechnerisch — ein Effekt der Einplanungsheuristik. Das steht als Grenze des
  Modells da, nicht als Ergebnis. Genau solche Sätze unterscheiden einen
  Demonstrator von einer Verkaufsfolie.

## Step 5 — Verify

1. `python3 scripts/generate.py` twice → `shasum data.js` identical.
2. `grep -rn '{{\|TODO' portfolio/<slug>` → empty.
3. Join-Trefferquoten und Eindeutigkeit der Anzeigenamen geprüft (Step 3).
4. Summen der angenommenen gegen die belegten Größen angesehen.
5. Serve (`python3 serve.py`; fallback: unsandboxed `nohup python3 -m
   http.server <port>` from the project dir) und im Browser prüfen:
   jede Ansicht auf Desktop **und** 375 px, ein ⓘ-Tooltip, ein ◈-Tooltip, ein
   Chart-Tooltip, Filter/Slider wirken über Ansichten hinweg, Footer Stand +
   Disclaimer, **null Konsolenfehler**, keine externen Requests außer Google
   Fonts.
6. „Drucken / PDF“ gibt nur die aktive Ansicht aus, bei offenem Kennzahlenblatt
   nur dieses.

> Die Browser-Pane repaintet bei langen Seiten nicht immer zuverlässig. Wenn
> ein Screenshot leer bleibt, ist das meist die Pane und nicht die Seite —
> per `javascript_exec` gegen das DOM prüfen statt Screenshots zu wiederholen.

## Step 6 — Publish flow

`python3 scripts/publish.py` then `--check` must print "in sync ✓"
(docs/<slug>/ = exactly index.html, app.js, styles.css, data.js).

## Step 7 — Landing page + READMEs

Add one card to `docs/index.html` and one bullet to root `README.md` using the
exact snippets in reference.md — **ASCII transliteration there** ("Duesseldorf",
"Projekt oeffnen"). Fill the scaffolded README.md / README.de.md / CHANGELOG.md;
deutsche Zahlformate auch dort (`71.852`, `60,0 Mio €`).

## Step 8 — Commit + PR

Single commit on `FEATURE-<slug>`, push, `gh pr create` (body pattern in
reference.md). **Never merge — Julian merges.**

- `gh` läuft ggf. unter einem Konto ohne Collaborator-Rechte („must be a
  collaborator“). Dann `gh auth switch --hostname github.com --user kanduit`,
  PR anlegen, **danach zurückschalten**.
- Vor `git add -A` prüfen, dass kein `__pycache__` mitläuft (entsteht, sobald
  ein `fetch_*.py` importiert statt ausgeführt wurde).

## Step 9 — Hand the last mile over explicitly

**The build is not the finish line, and this is where the pipeline actually
broke.** The Wärmewende-Monitor Mülheim was finished, committed, pushed and
CI-green on 2026-08-20 — and it 404'd for fifteen days. The PR was never merged,
so GitHub Pages never served it; it was never registered in the outreach repo,
so the send verifier would have refused to link it even after a merge; and the
decisions ledger meanwhile recorded its signal as having *no linkable demo*.
Nothing was broken. The handoff was simply implicit.

So end the run by naming what remains, in the PR body **and** in your closing
message, as a numbered list Julian can work down:

```
1. gh pr merge <N> --squash --delete-branch
2. wait for the `pages build and deployment` run, then confirm
   https://kanduit.github.io/kanduit-projects/<slug>/ returns 200
3. in ~/Documents/Kanduit:
   python3 crm/demo_publish.py register <slug> \
     --name "<Anzeigename>" --city "<Kommune wie in der CRM>" \
     --fit "<Tag>,<Tag>,<Tag>" --note "<wofür und für wen>"
   (refuses while the URL is not 200 — that is the point)
4. python3 crm/verify_send.py selftest
5. add the row to the demo table in CLAUDE.md
6. point contacts at it: crm annotate on the assignments this demo now fits
```

Steps 3–6 happen in the **Kanduit** repo, not this one — that repo boundary is
why nothing watched them. `python3 crm/demo_publish.py status` there audits the
whole chain and exits non-zero while any of it is unfinished; Routine E runs it
weekly. Do not run steps 1–2 yourself: publishing a demonstrator built on a
Kommune's data is Julian's call.

## Quality bar (final gate)

- [ ] German UI, de-DE numbers, mobile 375 px OK, zero console errors
- [ ] ⓘ on every KPI/chart; METRIC_INFO names gaps; Quellen-Link under every card
- [ ] Leitzahl vorhanden und mit Frist/Konsequenz begründet
- [ ] Ansicht „Daten & Methode“ gefüllt: Registerabgleich, Gegenprobe, Annahmen
- [ ] Benchmark gebaut, wo die Quelle das Vergleichsfeld hergibt (normiert)
- [ ] Joins über IDs, Trefferquote geprüft; Anzeigenamen eindeutig
- [ ] Honest gaps stated in UI text; simulated views labeled „schematisch“;
      Modellartefakte benannt
- [ ] No personal data; no company/winner names stored or ranked
- [ ] Footer: "Demonstrator der Kanduit UG … kein Produkt der <Stadt>", Stand-Datum
- [ ] Druckbereich auf die aktive Ansicht bzw. das Kennzahlenblatt begrenzt
- [ ] generate.py deterministisch; data.js < ~100 KB; publish `--check` grün
- [ ] Landing card (ASCII) + README bullet + project READMEs/CHANGELOG done
- [ ] PR open, not merged
- [ ] Step 9 handoff list written out, with the exact `demo_publish register`
      command for this slug — a finished demo nobody merges is worth nothing
