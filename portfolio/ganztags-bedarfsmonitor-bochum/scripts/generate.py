# -*- coding: utf-8 -*-
"""
generate.py — aggregate the committed data snapshots (data/sources/) into
data.js for the Kanduit Ganztags-Bedarfsmonitor Bochum.

Run:  python3 scripts/generate.py     (from the project folder)

Conventions (do not break):
- Reads ONLY files under data/sources/ — no network access, so the build is
  reproducible offline. Fetching lives in scripts/fetch_<quelle>.py.
- Output must be DETERMINISTIC: running twice yields a byte-identical data.js
  (meta.stand comes from the snapshots, never from datetime.now()).
- Aggregates only; no personal data, no company/winner names.

------------------------------------------------------------------------------
Das Kohortenmodell — und warum es nachrechenbar ist
------------------------------------------------------------------------------
Die Stadt Bochum veroeffentlicht je Grundschulbezirk die Jahrgangsstaerken
2025/26 (KL_1 bis KL_4), die Kinder der Altersjahre 0 bis 5 nach Abschlag
(PROG_0J bis PROG_5J) und ihre eigene Belegungsprognose bis 2031/32
(PR_BELEG_0 bis PR_BELEG_6). Sie veroeffentlicht aber nicht, wie sich die
prognostizierte Belegung auf die vier Jahrgangsstufen verteilt — genau das
braucht der Stufenplan des § 24 Abs. 4 SGB VIII.

Die Verteilung laesst sich aus denselben Angaben zurueckrechnen:

  Klasse k im Prognosejahr i stammt aus dem Einschulungsjahrgang i - k + 1.
    Liegt der in der Zukunft (i - k + 1 >= 1), ist es PROG_(5 - i + k)J.
    Liegt er in der Vergangenheit, sass die Kohorte 2025/26 bereits in
    Klasse k - i, ist also KL_(k - i).

Dass diese Rekonstruktion stimmt, prueft das Skript hart nach: Die Summe der so
gebildeten vier Jahrgangsstufen muss fuer jeden der 47 Bezirke und jedes der
sieben Prognosejahre exakt der veroeffentlichten Belegung PR_BELEG_i
entsprechen. Weicht ein einziger Wert ab, bricht der Lauf ab. Der Monitor
erfindet also keine Kohorten, sondern legt die Anspruchslogik des Gesetzes
ueber die Kohortenrechnung des Schultraegers.
"""
import datetime
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

HEADER = (
    "/* Kanduit Ganztags-Bedarfsmonitor Bochum — aggregierte öffentliche Daten.\n"
    "   Quellen: Stadt Bochum (maponline „Grundschulen“, BOStatIS), Schul-\n"
    "   ministerium NRW (Open Data), stadtweite OGS-Eckwerte aus der Presse.\n"
    "   Erzeugt von scripts/generate.py — Abruf siehe meta.stand.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)

# Stufenplan § 24 Abs. 4 SGB VIII: Zahl der anspruchsberechtigten Klassenstufen
# je Schuljahr. Vor 2026/27 besteht kein Rechtsanspruch, ab 2029/30 alle vier.
STUFENPLAN = {
    "2025/2026": 0,
    "2026/2027": 1,
    "2027/2028": 2,
    "2028/2029": 3,
    "2029/2030": 4,
    "2030/2031": 4,
    "2031/2032": 4,
}


def lade(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as fh:
        return json.load(fh)


def inanspruchnahme(ogs, msb_reihe):
    """Zwei belegte Stuetzpunkte der OGS-Inanspruchnahme und ihre Steigung.

    Oeffentlich belegt sind fuer Bochum genau zwei Schuljahre: 2022/23 und
    2026/27, jeweils mit Plaetzen UND Ablehnungen. Die angemeldete Nachfrage
    ist ihre Summe — versorgte plus abgewiesene Kinder.

    Der Nenner ist der heikle Teil. Damit die Steigung nicht aus zwei
    verschiedenen Grundgesamtheiten entsteht, wird fuer BEIDE Punkte dieselbe
    Reihe verwendet: die Grundschuelerzahl Bochums aus dem amtlichen
    Verzeichnis des Landes. Fuer 2026/27 reicht diese Reihe noch nicht, dort
    steht der juengste amtliche Wert (Schuljahr 2025/26). Dieser Versatz von
    einem Jahr ist klein — Bochum ging von 13.103 auf 13.110 Kinder — und wird
    im UI benannt, statt ihn durch eine Hochrechnung zu kaschieren.

    Zwei Punkte sind kein Trend im statistischen Sinn. Die Steigung ist ein
    Differenzenquotient und deshalb im UI als Regler ausgelegt.
    """
    e = ogs["eckwerte"]
    punkte = []
    for sj, jahr, plaetze, abl in (
            ("2022/2023", 2022, e["plaetze_2022_23"], e["ablehnungen_2022_23"]),
            ("2026/2027", 2026, e["plaetze_2026_27"], e["ablehnungen_2026_27"])):
        # juengstes verfuegbares Jahr der amtlichen Reihe, hoechstens das Zieljahr
        nenner_jahr = max(j for j in (int(k) for k in msb_reihe) if j <= jahr)
        nenner = msb_reihe[str(nenner_jahr)]["schueler"]
        nachfrage = plaetze + abl
        punkte.append({
            "sj": sj, "jahr": jahr, "plaetze": plaetze, "ablehnungen": abl,
            "nachfrage": nachfrage,
            "nennerJahr": nenner_jahr, "nenner": nenner,
            "versatz": jahr - nenner_jahr,
            "quote": round(nachfrage / nenner, 4),
        })
    spanne = punkte[1]["jahr"] - punkte[0]["jahr"]
    steigung = (punkte[1]["quote"] - punkte[0]["quote"]) / spanne
    return {
        "punkte": punkte,
        "spanneJahre": spanne,
        "steigungProJahr": round(steigung, 5),
        # Diese beiden Texte erscheinen im UI und stehen deshalb in
        # ordentlichem Deutsch — anders als die Snapshot-Metadaten, die als
        # Maschinendaten in ASCII gehalten sind.
        "nenner": "Grundschülerinnen und Grundschüler in Bochum, amtliches "
                  "Schulverzeichnis des Landes (alle Grundschulen, "
                  "einschließlich Ersatzschulen)",
        "hinweis": "Zwei belegte Stützpunkte, kein statistischer Trend. Die "
                   "Steigung ist der Differenzenquotient zwischen ihnen und im "
                   "Monitor frei einstellbar.",
    }


def de_datum(iso):
    return iso[8:10] + "." + iso[5:7] + "." + iso[0:4]


def jahrgang(schule, i, k):
    """Schuelerzahl der Klassenstufe k (1..4) im Prognosejahr i (0..6)."""
    start = i - k + 1
    if start >= 1:
        return schule["prog"][5 - i + k]
    return schule["klassen"][k - i - 1]


def main():
    bezirke = lade("bo_grundschulbezirke.json")
    geburten = lade("bo_geburten.json")
    alter = lade("bo_altersjahrgaenge.json")
    msb = lade("msb_grundschulen_bo.json")
    reihe = lade("msb_zeitreihe_bo.json")
    ogs = lade("bo_ogs_eckwerte.json")
    nachbarn = lade("bo_nachbarschaft.json")
    bass = lade("bass_ogs_foerderung.json")

    schuljahre = bezirke["meta"]["schuljahre"]
    quellen = {
        "bezirke": bezirke["meta"],
        "geburten": geburten["meta"],
        "alter": alter["meta"],
        "msb": msb["meta"],
        "reihe": reihe["meta"],
        "ogs": ogs["meta"],
        "nachbarn": nachbarn["meta"],
        "bass": bass["meta"],
    }
    stand = max(q["abruf"] for q in quellen.values())

    # ---------------------------------------------------- Kohorten je Standort
    msb_nach_nr = {s["nr"]: s for s in msb["schulen"]}
    schulen, abweichungen, geprueft = [], 0, 0
    for s in bezirke["schulen"]:
        jg = {}
        for i, sj in enumerate(schuljahre):
            stufen = [jahrgang(s, i, k) for k in range(1, 5)]
            geprueft += 1
            if sum(stufen) != s["beleg"][i]:
                abweichungen += 1
                print("  ABWEICHUNG %s %s: %d rekonstruiert, %d veroeffentlicht"
                      % (s["nr"], sj, sum(stufen), s["beleg"][i]))
            jg[sj] = stufen
        # Der Bezirksdatensatz fuehrt Teilstandorte unter "<Nr> T"; das amtliche
        # Verzeichnis kennt nur die Stammschule.
        stamm = s["nr"].split(" ")[0]
        m = msb_nach_nr.get(stamm)
        schulen.append({
            "nr": s["nr"],
            "name": s["name"],
            "anschrift": s["anschrift"],
            "plzOrt": s["plz_ort"],
            "teilstandort": s["teilstandort"],
            "bezirk": s["stadtbezirk"],
            "bezirkNr": s["stadtbezirk_nr"],
            "lat": s["lat"], "lon": s["lon"],
            "ringe": s["ringe"],
            "kapGrund": s["kapazitaet"],
            "frkap": s["frkap"],
            "ewo": s["ewo"],
            "prog": s["prog"],
            "jg": jg,
            "sozialindex": (m or {}).get("sozialindex", "ohne"),
            "msbSchueler": (m or {}).get("schueler"),
        })
    if abweichungen:
        raise SystemExit("Kohortenrekonstruktion weicht in %d Faellen von der "
                         "veroeffentlichten Belegung ab — Modell pruefen"
                         % abweichungen)
    schulen.sort(key=lambda s: (s["bezirkNr"], s["name"]))

    # ------------------------------------------------------------ Stadtbezirke
    stadtbezirke = {}
    for s in schulen:
        b = stadtbezirke.setdefault(str(s["bezirkNr"]),
                                    {"nr": s["bezirkNr"], "name": s["bezirk"],
                                     "schulNrs": []})
        b["schulNrs"].append(s["nr"])
    stadtbezirke = sorted(stadtbezirke.values(), key=lambda b: b["nr"])

    # ---------------------------------------------------------------- Geburten
    geb_jahre = sorted(geburten["jahre"])
    geb_stadt = {j: sum(v["geburten"] for v in geburten["jahre"][j].values())
                 for j in geb_jahre}
    geb_bezirke = []
    for nr in sorted(geburten["bezirksnamen"]):
        reihe_nr = [geburten["jahre"][j].get(nr, {}).get("geburten")
                    for j in geb_jahre]
        if any(v is None for v in reihe_nr):
            continue
        geb_bezirke.append({
            "nr": nr,
            "name": geburten["bezirksnamen"][nr],
            "geburten": reihe_nr,
            "alter": alter["alter"].get(nr),
        })

    # ------------------------------------------- Registerabgleich der Schulzahl
    msb_oeff = [s for s in msb["schulen"] if s["rechtsform"] == "oeffentlich"]
    msb_priv = [s for s in msb["schulen"] if s["rechtsform"] == "privat"]
    stamm_im_gis = {s["nr"].split(" ")[0] for s in bezirke["schulen"]}
    ohne_bezirk = sorted(s["name"] for s in msb_oeff
                         if s["nr"] not in stamm_im_gis)
    abgleich = {
        "presse": ogs["eckwerte"]["schulen_gesamt_presse"],
        "gisBezirke": len(bezirke["schulen"]),
        "gisStandorte": sum(1 for s in bezirke["schulen"] if not s["teilstandort"]),
        "gisTeilstandorte": sum(1 for s in bezirke["schulen"] if s["teilstandort"]),
        "msbGesamt": len(msb["schulen"]),
        "msbOeffentlich": len(msb_oeff),
        "msbPrivat": len(msb_priv),
        "msbOhneBezirk": ohne_bezirk,
        "msbPrivatNamen": sorted(s["name"] for s in msb_priv),
        "msbSchueler": sum(s["schueler"] for s in msb["schulen"]),
        "gisSchueler": sum(sum(s["klassen"]) for s in bezirke["schulen"]),
    }

    # ------------------------------------------------- Basiswerte fuer das UI
    sj_start = "2026/2027"
    i_start = schuljahre.index(sj_start)
    schueler_start = sum(s["beleg"][i_start] for s in bezirke["schulen"])
    plaetze = ogs["eckwerte"]["plaetze_2026_27"]
    ablehnungen = ogs["eckwerte"]["ablehnungen_2026_27"]
    # Angemeldete Nachfrage = versorgte Kinder + abgelehnte Kinder. Bezogen auf
    # die Schuelerzahl der 47 Bezirke ergibt das die beobachtete Quote — der
    # Ausgangswert des Reglers.
    quote_basis = round((plaetze + ablehnungen) / schueler_start, 4)

    msb_reihe = {}
    for r in reihe["reihe"]:
        e = msb_reihe.setdefault(str(r["jahr"]), {"schulen": 0, "schueler": 0,
                                                  "klassen": 0})
        for k in ("schulen", "schueler", "klassen"):
            e[k] += r[k]

    # Nachbarschaftsgraph als Nachschlagetabelle Bezirk -> angrenzende Bezirke
    graph = {s["nr"]: [] for s in schulen}
    for k in nachbarn["kanten"]:
        graph[k["a"]].append(k["b"])
        graph[k["b"]].append(k["a"])
    for nr in graph:
        graph[nr].sort()

    quote_reihe = inanspruchnahme(ogs, msb_reihe)

    # Sozialindexstufen fuer die zweite Allokation. Ohne Stufe bleibt ein
    # Standort auf dem neutralen Mittelwert — er wird dadurch weder bevorzugt
    # noch benachteiligt.
    ohne_index = sorted(s["name"] for s in schulen if not s["sozialindex"].isdigit())

    payload = {
        "meta": {
            "stand": de_datum(stand),
            "schuljahre": schuljahre,
            "stufenplan": STUFENPLAN,
            "sjStart": sj_start,
            "sjVoll": "2029/2030",
            "ewoStand": bezirke["meta"]["ewo_stand"],
            "progAbschlag": bezirke["schulen"][0]["prog_abschlag"],
            "quoteBasis": quote_basis,
            "schuelerStart": schueler_start,
            "labelsKorrigiert": bezirke["meta"]["labels_korrigiert"],
            # Die Snapshot-Metadaten sind ASCII; fuer die Anzeige wird der Satz
            # hier in ordentlichem Deutsch neu gesetzt.
            "vereinfachung": bezirke["meta"]["vereinfachung"]
                             .replace("Stuetzpunkten", "Stützpunkten"),
            "pruefung": {"werte": geprueft, "abweichungen": abweichungen},
            "ohneSozialindex": ohne_index,
            "quellen": quellen,
        },
        "eckwerte": ogs["eckwerte"],
        "bass": bass["saetze"],
        "bassMeta": {k: bass["meta"][k] for k in
                     ("fassung", "gueltig_ab", "steigerung_jaehrlich",
                      "steigerung_regel", "quelle", "quelle_url", "hinweis")},
        "quoteReihe": quote_reihe,
        "nachbarn": graph,
        "schulen": schulen,
        "stadtbezirke": stadtbezirke,
        "geburten": {"jahre": geb_jahre, "stadt": geb_stadt,
                     "bezirke": geb_bezirke},
        "abgleich": abgleich,
        "msbReihe": msb_reihe,
    }

    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_BOCHUM = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out, "(%d B)" % os.path.getsize(out))
    print("   %d Grundschulbezirke, Kohortenrekonstruktion deckt sich mit allen "
          "%d veroeffentlichten Belegungswerten"
          % (len(schulen), len(schulen) * len(schuljahre)))
    print("   Stand %s · Basisquote %.1f %% · %d Schueler 2026/27 · %d OGS-Plaetze"
          % (payload["meta"]["stand"], quote_basis * 100, schueler_start, plaetze))
    for sj in schuljahre:
        n = sum(sum(s["jg"][sj][:STUFENPLAN[sj]]) for s in schulen)
        print("   %s  anspruchsberechtigt %6d  (Klassen 1–%d)"
              % (sj, n, STUFENPLAN[sj]))
    print("   Nachbarschaft: %d Kanten" % (sum(len(v) for v in graph.values()) // 2))
    for p in quote_reihe["punkte"]:
        print("   Inanspruchnahme %s: %5d von %5d (Stand %d) = %.1f %%"
              % (p["sj"], p["nachfrage"], p["nenner"], p["nennerJahr"],
                 p["quote"] * 100))
    print("   Steigung %+.2f Punkte je Jahr" % (quote_reihe["steigungProJahr"] * 100))
    if ohne_index:
        print("   ohne Sozialindexstufe: %s" % ", ".join(ohne_index))


if __name__ == "__main__":
    main()
