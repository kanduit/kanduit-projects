# -*- coding: utf-8 -*-
"""
generate.py — aggregiert die Snapshots aus data/sources/ zu data.js.

Aufruf:  python3 scripts/generate.py     (aus dem Projektordner)

Konventionen (nicht brechen):
- Liest AUSSCHLIESSLICH data/sources/ — kein Netzzugriff, damit der Build
  offline reproduzierbar ist. Das Laden liegt in scripts/fetch_<quelle>.py.
- Die Ausgabe ist DETERMINISTISCH: zweimal laufen lassen ergibt ein
  byte-identisches data.js (meta.stand stammt aus den Snapshots, nie aus
  datetime.now()).
- Nur Aggregate, keine personenbezogenen Daten.

DAS MODELL IN KURZ
------------------
Nachfrage: Die Stadt Krefeld veroeffentlicht die Altersgruppen u3 / 3 bis
unter 6 / 6 bis unter 10 je statistischem Bezirk. Daraus wird je Geburtsjahr
eine Jahrgangsstaerke gebildet. Entscheidend: Alle Kinder, die bis zum
Schuljahr 2029/30 eingeschult werden, sind bereits geboren und im Register
erfasst — es wird KEINE Geburtenprognose gebraucht, nur die Fortschreibung
der vorhandenen Jahrgaenge um Wanderung.

Die beiden Wanderungsfaktoren werden nicht angenommen, sondern aus der
Zeitreihe 2012–2024 gemessen (dieselben Geburtsjahrgaenge in einem spaeteren
Altersblock wiedergefunden) und in einer Rueckrechnung geprueft.

Angebot: Die stadtweiten Platzzahlen stammen aus Tabelle 4-1 des OGS-Berichts
der Stadt (Ist bis 2024/25, Ausbauplanung bis 2027/28), fortgeschrieben mit
dem dort genannten Tempo. Nicht oeffentlich ist die Platzzahl je einzelner
Schule — ihre Verteilung ist die zentrale Demo-Annahme dieses Prototyps und
in der Oberflaeche als solche ausgewiesen.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

import sys  # noqa: E402
sys.path.insert(0, HERE)
from geo import point_in_polygon  # noqa: E402

HEADER = (
    "/* Kanduit Ganztags-Bedarfsmonitor Krefeld — aggregierte öffentliche Daten.\n"
    "   Quellen: Stadt Krefeld (kleinräumige Bevölkerungsdaten, amtliche\n"
    "   Gebietsgliederung, OGS-Bericht 2026), Schulministerium NRW (Open Data),\n"
    "   Open Data NRW (Kindertageseinrichtungen). Abruf siehe meta.stand.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)

# ------------------------------------------------------------------ Modellwerte
BASISJAHR = 2024              # Stichtag der Bevoelkerungsdaten: 31.12.2024
EINSCHULUNGSALTER = 6         # Geburtsjahr + 6 = Einschulungsjahr
STUFEN = [                    # Ausbaustufen des Rechtsanspruchs nach GaFoeG
    ("2026/27", 2026, 1, "Klasse 1"),
    ("2027/28", 2027, 2, "Klassen 1–2"),
    ("2028/29", 2028, 3, "Klassen 1–3"),
    ("2029/30", 2029, 4, "Klassen 1–4"),
]
# Geburtsjahrgaenge, die in diesen Stufen die Klassen 1 bis 4 stellen.
EINSCHULUNGSJAHRE = list(range(2026 - 3, 2029 + 1))   # 2023 … 2029

QUELLEN = {
    "bev": {"t": "Stadt Krefeld, FB 312 — Kleinräumige Bevölkerungsdaten nach statistischen Bezirken",
            "u": "https://www.offenesdatenportal.de/organization/stadt-krefeld"},
    "gebiete": {"t": "Stadt Krefeld — amtliche Gebietsgliederung (Stadtbezirke, Stadtteile, statistische Bezirke)",
                "u": "https://open.nrw"},
    "msb": {"t": "Ministerium für Schule und Bildung NRW — Open Data (Schulverzeichnis, Schülerzahlen, Sozialindex)",
            "u": "https://www.schulministerium.nrw/open-data"},
    "ogs": {"t": "Stadt Krefeld — OGS-Bericht 2026 (Tabelle 4-1, Abb. 4-1, Elternbefragung)",
            "u": "https://www.krefeld.de/system/files/2026-01/OGS-Bericht-Krefeld-2026.pdf"},
    "kitas": {"t": "Kindertageseinrichtungen in NRW — Open Data NRW",
              "u": "https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/"},
    "gafoeg": {"t": "§ 24 Abs. 4 SGB VIII (GaFöG) — Ganztag im Primarbereich, Bildungsportal NRW",
               "u": "https://www.schulministerium.nrw/ganztag-im-primarbereich"},
}


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as fh:
        return json.load(fh)


def rd(x, n=1):
    return round(x + 0.0, n)


# ---------------------------------------------------------------- Gebiete/Geo
def zuordnen(lon, lat, gebiete):
    """Punkt -> Gebietsnummer; None, wenn er in keiner (vereinfachten) Flaeche liegt."""
    for g in gebiete:
        if point_in_polygon(lon, lat, g["ringe"]):
            return g["nr"]
    return None


def naechstes(lon, lat, gebiete):
    """Fallback fuer Punkte knapp ausserhalb der vereinfachten Grenzen:
    das Gebiet mit dem naechstgelegenen Randpunkt."""
    best, bnr = None, None
    for g in gebiete:
        for ring in g["ringe"]:
            for px, py in ring:
                d = (px - lon) ** 2 + (py - lat) ** 2
                if best is None or d < best:
                    best, bnr = d, g["nr"]
    return bnr


# ------------------------------------------------------- Kohorten aus Register
def bloecke(bev, jahr, nr):
    """Die drei Altersblöcke eines statistischen Bezirks in einem Jahr."""
    return bev["jahre"][str(jahr)][nr]


# Die Quelle veroeffentlicht Altersbloecke, keine einzelnen Geburtsjahrgaenge.
# Jeder Block liefert einen Mittelwert, der beim mittleren Geburtsjahr des
# Blocks verankert wird; dazwischen wird linear interpoliert. Damit springt
# die Jahrgangsstaerke nicht in Stufen, sondern folgt dem Verlauf, den die
# drei Bloecke gemeinsam beschreiben.
#   Block u3      Alter 0–2  -> Geburtsjahre BASISJAHR-2 … BASISJAHR
#   Block 3–<6    Alter 3–5  -> BASISJAHR-5 … BASISJAHR-3
#   Block 6–<10   Alter 6–9  -> BASISJAHR-9 … BASISJAHR-6
BLOCK_STUETZEN = [
    ("a6bis10", 4.0, 7.5),   # (Feld, Blockbreite, mittleres Alter im Block)
    ("a3bis6", 3.0, 4.0),
    ("u3", 3.0, 1.0),
]
REFERENZALTER = 7.5          # mittleres Alter des Grundschulblocks


def kohortenkurve(bev, jahr, nr):
    """Stuetzstellen (Geburtsjahr, Jahrgangsstaerke) eines Gebiets."""
    b = bloecke(bev, jahr, nr)
    return [(jahr - alter, b[feld] / breite) for feld, breite, alter in BLOCK_STUETZEN]


def kohorte(bev, geburtsjahr, nr, rate):
    """Jahrgangsstaerke eines Geburtsjahrgangs bei Einschulung.

    Schritt 1 — Interpolation zwischen den drei Blockmittelwerten.
    Schritt 2 — Fortschreibung mit der gemessenen jaehrlichen Wanderungsrate
                bis zum Referenzalter des Grundschulblocks. Jahrgaenge, die
                dieses Alter erreicht haben, werden nicht mehr fortgeschrieben:
                ihre Wanderung steckt bereits in der Beobachtung.
    """
    stuetzen = kohortenkurve(bev, BASISJAHR, nr)
    x = geburtsjahr
    if x <= stuetzen[0][0]:
        wert = stuetzen[0][1]
    elif x >= stuetzen[-1][0]:
        wert = stuetzen[-1][1]
    else:
        for (x0, y0), (x1, y1) in zip(stuetzen, stuetzen[1:]):
            if x0 <= x <= x1:
                wert = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                break
    alter = BASISJAHR - geburtsjahr
    return wert * rate ** max(0.0, REFERENZALTER - alter)


def uebergangsfaktoren(bev, von_jahr, bis_jahr):
    """Misst, wie sich dieselben Geburtsjahrgaenge zwischen den Altersbloecken
    veraendern — das ist der Wanderungssaldo, nicht eine Annahme.

    Ein Geburtsjahrgang B wird beobachtet
      im Block u3       im Jahr B+2,
      im Block 3–<6     im Jahr B+5,
      im Block 6–<10    im Jahr B+9.
    Der Quotient zweier dieser Beobachtungen ist der Uebergangsfaktor.
    """
    def stadt(jahr, feld):
        return bev["stadt"][str(jahr)][feld]

    f1, f2 = [], []   # u3 -> 3–<6, 3–<6 -> 6–<10
    for b in range(1990, 2030):
        if von_jahr <= b + 2 and b + 5 <= bis_jahr:
            a = stadt(b + 2, "u3") / 3.0
            c = stadt(b + 5, "a3bis6") / 3.0
            if a > 0:
                f1.append((b, c / a))
        if von_jahr <= b + 5 and b + 9 <= bis_jahr:
            a = stadt(b + 5, "a3bis6") / 3.0
            c = stadt(b + 9, "a6bis10") / 4.0
            if a > 0:
                f2.append((b, c / a))
    return f1, f2


def mittel(paare):
    return sum(v for _, v in paare) / len(paare) if paare else 1.0


def backtest(bev, jahre):
    """Rueckrechnung: Faktoren auf der ersten Haelfte der Zeitreihe schaetzen,
    damit die zweite Haelfte vorhersagen, Abweichung ausweisen."""
    jahre = sorted(int(j) for j in jahre)
    schnitt = jahre[0] + (jahre[-1] - jahre[0]) // 2
    f1_fit, f2_fit = uebergangsfaktoren(bev, jahre[0], schnitt)
    f2 = mittel(f2_fit)

    zeilen = []
    for b in range(1990, 2030):
        # Getestet werden nur Geburtsjahrgaenge, deren Zielbeobachtung NACH dem
        # Schnitt liegt — sie sind bei der Schaetzung der Faktoren ungesehen.
        if not (jahre[0] <= b + 5 and schnitt < b + 9 <= jahre[-1]):
            continue
        basis = bev["stadt"][str(b + 5)]["a3bis6"] / 3.0
        ist = bev["stadt"][str(b + 9)]["a6bis10"] / 4.0
        prog = basis * f2
        zeilen.append({
            "geburtsjahr": b,
            "zieljahr": b + 9,
            "prognose": rd(prog),
            "ist": rd(ist),
            "abwPct": rd((prog - ist) / ist * 100, 2) if ist else 0.0,
        })
    mape = (sum(abs(z["abwPct"]) for z in zeilen) / len(zeilen)) if zeilen else 0.0
    return {
        "fitVon": jahre[0], "fitBis": schnitt,
        "f1Fit": rd(mittel(f1_fit), 4), "f2Fit": rd(f2, 4),
        "jahre": zeilen,
        "mape": rd(mape, 2),
    }


# ------------------------------------------------------------------ Kapazitaet
def gsi_stufe(landesstufe):
    """Kommunaler Grundschulsozialindex (5 Stufen) aus der Sozialindexstufe des
    Landes (9 Stufen). Die Stadt veroeffentlicht ihre eigene Zuordnung nicht;
    diese gleichmaessige Umrechnung ist eine ausgewiesene Demo-Annahme."""
    if landesstufe == "ohne":
        return "3"
    n = int(landesstufe)
    return str(min(5, (n * 5 + 8) // 9))


def main():
    bev = load("kr_bevoelkerung.json")
    geb = load("kr_gebiete.json")
    msb = load("msb_grundschulen_kr.json")
    reihe = load("msb_zeitreihe_kr.json")
    ogs = load("kr_ogsbericht.json")
    kitas = load("kitas_kr.json")

    stand = max(bev["meta"]["abruf"], geb["meta"]["abruf"], msb["meta"]["abruf"],
                ogs["meta"]["abruf"], kitas["meta"]["abruf"])
    stand_de = ".".join(reversed(stand.split("-")))

    stadtbezirke = geb["stadtbezirke"]
    stadtteile = geb["stadtteile"]
    statbezirke = geb["statbezirke"]
    zu_stadtteil = geb["zuStadtteil"]
    zu_stadtbezirk = geb["zuStadtbezirk"]

    # -------------------------------------------------- Wanderungsfaktoren
    jahre = bev["meta"]["jahre"]
    f1_alle, f2_alle = uebergangsfaktoren(bev, int(jahre[0]), int(jahre[-1]))
    F1, F2 = mittel(f1_alle), mittel(f2_alle)
    # F1 ueberbrueckt 3 Altersjahre (Blockmitte 1 -> 4), F2 deren 3,5
    # (Blockmitte 4 -> 7,5). Daraus die jaehrliche Wanderungsrate.
    RATE = (F1 * F2) ** (1.0 / 6.5)
    bt = backtest(bev, jahre)

    # ------------------------------- Jahrgangsstaerken je statistischem Bezirk
    jg_statbezirk = {}
    for sb in statbezirke:
        nr = sb["nr"]
        jg_statbezirk[nr] = {e: kohorte(bev, e - EINSCHULUNGSALTER, nr, RATE)
                             for e in EINSCHULUNGSJAHRE}

    def aggregiere(nummern):
        return {e: sum(jg_statbezirk[n][e] for n in nummern) for e in EINSCHULUNGSJAHRE}

    st_zu_sb = {}     # Stadtteil -> [statistische Bezirke]
    for n, st in zu_stadtteil.items():
        st_zu_sb.setdefault(st, []).append(n)
    bez_zu_sb = {}    # Stadtbezirk -> [statistische Bezirke]
    for n, st in zu_stadtteil.items():
        bez_zu_sb.setdefault(zu_stadtbezirk[st], []).append(n)

    # ------------------------------------------------- Schulen raeumlich binden
    schulen = []
    for s in msb["schulen"]:
        lon, lat = s["lon"], s["lat"]
        sb = zuordnen(lon, lat, statbezirke) or naechstes(lon, lat, statbezirke)
        st = zu_stadtteil[sb]
        bz = zu_stadtbezirk[st]
        schulen.append(dict(s, statbezirk=sb, stadtteil=st, stadtbezirk=bz,
                            gsi=gsi_stufe(s["sozialindex"])))
    schulen.sort(key=lambda s: s["nr"])

    # ------------------------------------------------------------ Kitas binden
    kita_je_bezirk, kita_je_stadtteil, ohne_bezirk = {}, {}, 0
    for k in kitas["kitas"]:
        sb = zuordnen(k["lon"], k["lat"], statbezirke)
        if sb is None:
            ohne_bezirk += 1
            continue
        st = zu_stadtteil[sb]
        bz = zu_stadtbezirk[st]
        for tgt, key in ((kita_je_bezirk, bz), (kita_je_stadtteil, st)):
            e = tgt.setdefault(key, {"n": 0, "ue3": 0, "u3": 0, "schulkinder": 0})
            e["n"] += 1
            e["ue3"] += k["ue3"]
            e["u3"] += k["u3"]
            e["schulkinder"] += k["schulkinder"]

    # ------------------------------------- Kapazitaetsanteil je Schule (Annahme)
    # Verteilungsregel: Schuelerzahl, gewichtet mit der vom OGS-Bericht je
    # Grundschulsozialindex ausgewiesenen OGS-Quote (Abb. 4-1). Die stadtweite
    # Platzsumme ist real (Tabelle 4-1) — nur ihre Verteilung ist die Annahme.
    quote_gsi = ogs["ogsQuoteJeGsi"]
    gewicht = {s["nr"]: s["schueler"] * quote_gsi[s["gsi"]] for s in schulen}
    gewicht_summe = sum(gewicht.values())
    for s in schulen:
        s["kapAnteil"] = gewicht[s["nr"]] / gewicht_summe

    # ------------------------------- Jahrgangsstaerken auf die Schulen verteilen
    # Es gibt keine offenen Schuleinzugsbereiche. Der Bedarf eines Stadtbezirks
    # wird deshalb auf die Schulen dieses Bezirks im Verhaeltnis ihrer
    # Schuelerzahl verteilt — ausgewiesene Annahme.
    for bz_nr, sbs in bez_zu_sb.items():
        bez_jg = aggregiere(sbs)
        schulen_hier = [s for s in schulen if s["stadtbezirk"] == bz_nr]
        summe_sch = sum(s["schueler"] for s in schulen_hier) or 1
        for s in schulen_hier:
            anteil = s["schueler"] / summe_sch
            s["jahrgang"] = {str(e): rd(bez_jg[e] * anteil, 2)
                             for e in EINSCHULUNGSJAHRE}

    # ------------------------------------------------------- Ausbauplanung Stadt
    plan = {p["schuljahr"]: p for p in ogs["ausbauplanung"]}
    eck = ogs["eckwerte"]
    plaetze_pro_jahr = eck["ausbautempoGruppen"] * eck["plaetzeJeGruppe"]
    letztes_planjahr = ogs["ausbauplanung"][-1]
    plaetze_basis = {}
    for sid, jahr, _, _ in STUFEN:
        if sid in plan:
            plaetze_basis[sid] = float(plan[sid]["plaetze"])
        else:
            # Fortschreibung mit dem im Bericht genannten Tempo.
            n = jahr - int(letztes_planjahr["schuljahr"][:4])
            plaetze_basis[sid] = letztes_planjahr["plaetze"] + n * plaetze_pro_jahr

    # ------------------------------------------------- Mensa-Massnahmen zuordnen
    # Standortnamen aus dem OGS-Bericht auf die Schulnummern des
    # Schulverzeichnisses abbilden, soweit eindeutig.
    def normalisiere(t):
        """Auf Kleinbuchstaben ohne Umlaute, Bindestriche und Leerzeichen
        reduzieren — der Bericht schreibt „Paul-Gerhardt-Schule“, das
        Schulverzeichnis „Paul Gerhardt Schule“."""
        t = t.lower().split("–")[0]
        for a, b in (("ß", "ss"), ("ä", "a"), ("ö", "o"), ("ü", "u")):
            t = t.replace(a, b)
        t = "".join(c for c in t if c.isalnum())
        for weg in ("stadtgem", "ggs", "kgs", "bisch", "stadtische",
                    "gemeinschaftsgrundschule", "grundschule", "schule"):
            if t.startswith(weg):
                t = t[len(weg):]
        return t

    namen_index = {}
    for s in schulen:
        namen_index[normalisiere(s["name"])] = s["nr"]
    mensa = []
    for paket in ogs["mensaPakete"]:
        for ort in paket["standorte"]:
            key = normalisiere(ort)
            nr = namen_index.get(key)
            if nr is None:
                treffer = sorted(v for k, v in namen_index.items()
                                 if k and (k in key or key in k))
                nr = treffer[0] if len(treffer) == 1 else None
            mensa.append({"paket": paket["paket"], "wirksamAb": paket["wirksamAb"],
                          "standort": ort, "schulNr": nr})
    mensa.sort(key=lambda m: (m["paket"], m["standort"]))
    mensa_zugeordnet = sum(1 for m in mensa if m["schulNr"])

    # ------------------------------------------------------------ Gebietsblöcke
    def gebiet_block(g, sbs, kita_tab, ebene):
        schulen_hier = [s for s in schulen
                        if (s["stadtbezirk"] if ebene == "stadtbezirk" else s["stadtteil"]) == g["nr"]]
        k = kita_tab.get(g["nr"], {"n": 0, "ue3": 0, "u3": 0, "schulkinder": 0})
        b24 = [bloecke(bev, BASISJAHR, n) for n in sbs]
        return {
            "nr": g["nr"],
            "name": g["name"],
            "flaecheKm2": g["flaecheKm2"],
            "ringe": g["ringe"],
            "schulNrs": [s["nr"] for s in schulen_hier],
            "schueler": sum(s["schueler"] for s in schulen_hier),
            "einwohner": sum(x["gesamt"] for x in b24),
            "u3": sum(x["u3"] for x in b24),
            "a3bis6": sum(x["a3bis6"] for x in b24),
            "a6bis10": sum(x["a6bis10"] for x in b24),
            "kitas": k["n"],
            "kitaUe3": k["ue3"],
            "jahrgang": {str(e): rd(v, 2) for e, v in aggregiere(sbs).items()},
        }

    bezirke = [gebiet_block(g, bez_zu_sb.get(g["nr"], []), kita_je_bezirk, "stadtbezirk")
               for g in stadtbezirke]
    teile = [gebiet_block(g, st_zu_sb.get(g["nr"], []), kita_je_stadtteil, "stadtteil")
             for g in stadtteile]

    # ------------------------------------------------------------ Zeitreihe MSB
    zr = {}
    for r in reihe["reihe"]:
        e = zr.setdefault(r["jahr"], {"jahr": r["jahr"], "schulen": 0, "schueler": 0, "klassen": 0})
        e["schulen"] += r["schulen"]
        e["schueler"] += r["schueler"]
        e["klassen"] += r["klassen"]
    zeitreihe = [zr[j] for j in sorted(zr)]

    # -------------------------------------------- Bevoelkerungsreihe (Stadt)
    bevreihe = [{"jahr": int(j), **bev["stadt"][j]} for j in sorted(bev["stadt"])]

    # ------------------------------------------------------- Plausibilitaetsanker
    # Der Block 6–<10 der Registerdaten sollte die Grundschuelerzahl treffen.
    letzte_zr = zeitreihe[-1]
    anker_reg = bev["stadt"][str(BASISJAHR)]["a6bis10"]
    anker_msb = letzte_zr["schueler"]

    payload = {
        "meta": {
            "stand": stand_de,
            "basisjahr": BASISJAHR,
            "schuljahrBasis": msb["meta"]["schuljahr"],
            "stichtagBev": "31.12.%d" % BASISJAHR,
            "quellen": QUELLEN,
            "einschulungsjahre": [str(e) for e in EINSCHULUNGSJAHRE],
            "kitasOhneBezirk": ohne_bezirk,
            "mensaZugeordnet": mensa_zugeordnet,
            "mensaGesamt": len(mensa),
            "ogsBerichtSha": ogs["meta"]["sha256"][:12],
            "ogsBerichtStand": ogs["meta"]["erschienen"],
        },
        "konstanten": {
            # Jahrgaenge OHNE Rechtsanspruch: heutige Teilnahmequote (Ist).
            "quoteBestand": plan["2025/26"]["quote"],
            "quoteIst2024": plan["2024/25"]["quote"],
            # Jahrgaenge MIT Rechtsanspruch: erklaerte Inanspruchnahme aus der
            # Elternbefragung der Stadt (Juni 2024).
            "quoteAnspruch": ogs["befragung"]["wollenGanztagsplatz"],
            "plaetzeJeGruppe": eck["plaetzeJeGruppe"],
            "ausbauGruppen": eck["ausbautempoGruppen"],
            "plaetzeProJahr": plaetze_pro_jahr,
            "bedarfsquote2029": eck["bedarfsquote2029"],
            "zielquote2027_28": eck["zielquote2027_28"],
            "f1": rd(F1, 4),
            "f2": rd(F2, 4),
            "f1n": len(f1_alle),
            "f2n": len(f2_alle),
            "wanderungsrate": rd(RATE, 5),
            "wanderungsratePct": rd((RATE - 1) * 100, 2),
            "referenzalter": REFERENZALTER,
            "achtBisEinsSchulen": eck["acht_bis_eins_schulen"],
            "achtBisEinsPlaetze": eck["acht_bis_eins_plaetze"],
            "achtBisEinsQuote": eck["acht_bis_eins_quote"],
            "ankerRegister": anker_reg,
            "ankerMsb": anker_msb,
            "ankerAbwPct": rd((anker_reg - anker_msb) / anker_msb * 100, 1),
        },
        "stufen": [{"id": sid, "jahr": jahr, "jahrgaenge": jg, "klassen": kl,
                    "plaetzeBasis": rd(plaetze_basis[sid], 0),
                    "ausPlanung": sid in plan}
                   for sid, jahr, jg, kl in STUFEN],
        "schulen": [{
            "nr": s["nr"], "name": s["name"], "strasse": s["strasse"], "plz": s["plz"],
            "rechtsform": s["rechtsform"], "schueler": s["schueler"],
            "sozialindex": s["sozialindex"], "gsi": s["gsi"],
            "lat": s["lat"], "lon": s["lon"],
            "stadtbezirk": s["stadtbezirk"], "stadtteil": s["stadtteil"],
            "statbezirk": s["statbezirk"],
            "kapAnteil": rd(s["kapAnteil"], 6),
            "jahrgang": s["jahrgang"],
        } for s in schulen],
        "bezirke": bezirke,
        "stadtteile": teile,
        "statbezirkNamen": bev["bezirksnamen"],
        "ausbauplanung": ogs["ausbauplanung"],
        "ogsQuoteJeGsi": quote_gsi,
        "befragung": ogs["befragung"],
        "mensa": mensa,
        "backtest": bt,
        "zeitreihe": zeitreihe,
        "bevreihe": bevreihe,
    }

    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_GANZTAGS = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out, "(%d B)" % os.path.getsize(out))
    print("  Schulen %d · Stadtbezirke %d · Stadtteile %d · statistische Bezirke %d"
          % (len(schulen), len(bezirke), len(teile), len(statbezirke)))
    print("  Wanderungsfaktoren: u3→3–<6 %.4f (n=%d), 3–<6→6–<10 %.4f (n=%d)"
          % (F1, len(f1_alle), F2, len(f2_alle)))
    print("  Rückrechnung: MAPE %.2f %% über %d Geburtsjahrgänge (Fit %d–%d)"
          % (bt["mape"], len(bt["jahre"]), bt["fitVon"], bt["fitBis"]))
    print("  Anker: Register 6–<10 %d vs. MSB Grundschüler %d (%.1f %%)"
          % (anker_reg, anker_msb, payload["konstanten"]["ankerAbwPct"]))
    print("  Mensa-Maßnahmen zugeordnet: %d von %d" % (mensa_zugeordnet, len(mensa)))
    for st in payload["stufen"]:
        print("  %s: %d Plätze (%s)" % (st["id"], st["plaetzeBasis"],
                                        "Planung der Stadt" if st["ausPlanung"] else "fortgeschrieben"))


if __name__ == "__main__":
    main()
