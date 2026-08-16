# -*- coding: utf-8 -*-
"""
generate.py — aggregate the committed data snapshots (data/sources/) into
data.js for the Kanduit Schulinvestitions-Monitor Duisburg.

Run:  python3 scripts/generate.py     (from the project folder)

Conventions (do not break):
- Reads ONLY files under data/sources/ — no network access, so the build is
  reproducible offline. Fetching lives in scripts/fetch_<quelle>.py.
- Output must be DETERMINISTIC: running twice yields a byte-identical data.js
  (meta.stand comes from the snapshots, never from datetime.now()).
- Aggregates only; no personal data, no company/winner names.

Was echt ist und was Demo-Annahme ist, steht in ANNAHMEN und wandert von dort
unveraendert in die Oberflaeche. Die Trennlinie ist der Kern dieses
Demonstrators: alles, was das Amt selbst besser weiss, ist als Annahme
gekennzeichnet und im Projekt durch Amtsdaten zu ersetzen.
"""
import collections
import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

HEADER = (
    "/* Kanduit Schulinvestitions-Monitor Duisburg — aggregierte öffentliche Daten.\n"
    "   Quellen: Schulverzeichnis, Schülerzahlen und Sozialindexstufen des MSB NRW;\n"
    "   bestätigte Teilnehmerliste und Schulträgerbudgets Säule I des Startchancen-\n"
    "   Programms; Stadtbezirksgrenzen der Stadt Duisburg. Abruf siehe meta.stand.\n"
    "   Bauzustand, Maßnahmenkosten und Ganztagsquote sind gekennzeichnete\n"
    "   Demo-Annahmen (siehe annahmen) — keine Amtsdaten.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)

# ---------------------------------------------------------------- Annahmen
FOERDERQUOTE = 0.70          # Saeule I: bis zu 70 % der zuwendungsfaehigen Ausgaben
EIGENQUOTE = 1 - FOERDERQUOTE
PROGNOSE_JAHR = 2030
BASIS_JAHR = 2025
REF_JAHR = 2019              # Trendbasis
BT_FIT_VON, BT_FIT_BIS, BT_ZIEL = 2013, 2019, 2024   # Gegenprobe-Fenster
TREND_CAP = 0.25             # max. +/-25 % Fortschreibung bis 2030
GANZTAG_QUOTE = 0.75         # angenommene Inanspruchnahme des Ganztagsanspruchs
GANZTAG_NEU = 0.40           # angenommener Anteil noch zu schaffender Plaetze
GANZTAG_EUR_PLATZ = 12000    # angenommene Investition je zusaetzlichem Ganztagsplatz
SAN_EUR_SCHUELER = 900       # angenommene Sanierungskosten je Schueler und Zustandsstufe
SAN_AB_NOTE = 3              # erst ab dieser Zustandsnote entsteht Sanierungsbedarf
STUFEN = [(2026, 1), (2027, 2), (2028, 3), (2029, 4)]   # GaFoeG-Ausbaustufen
PLANJAHRE = list(range(2026, 2035))

# Schulformen, deren Schuelerzahl sich strukturell (Umbau/Auslaufen) und nicht
# demografisch entwickelt — eine Trendfortschreibung waere hier irrefuehrend.
AUSLAUFEND = {"Hauptschule", "Sekundarschule", "Freie Waldorfschule"}

ANNAHMEN = [
    {
        "k": "zustand",
        "t": "Bauzustand je Standort",
        "d": "Demo-Annahme. Ein Zustandsregister der Duisburger Schulgebäude liegt "
             "nicht offen vor. Das Schulbetriebsdatum des Schulverzeichnisses taugt "
             "nicht als Ersatz — es steht für 101 der 135 Standorte auf 1973, dem "
             "Aufbau des Registers, nicht auf einem Baujahr. Die Zustandsnote 1 bis 5 "
             "wird deshalb deterministisch aus der Schulnummer gezogen (SHA-256, "
             "Verteilung 10/25/30/25/10 %) und ist reproduzierbar, aber fachlich "
             "bedeutungslos. Im Projekt durch die Zustandsdaten des Amtes bzw. des "
             "Immobilienmanagements zu ersetzen.",
    },
    {
        "k": "kapazitaet",
        "t": "Kapazität und Kapazitätslücke",
        "d": "Teilweise Demo-Annahme. Die genehmigte Zügigkeit je Standort liegt nicht "
             "offen vor; als Bezugsgröße dient die heutige Belegung laut MSB. Die "
             "Prognose 2030 schreibt den echten Trend der jeweiligen Schulform in "
             "Duisburg (%d bis %d, MSB-Zeitreihe) fort, gedeckelt auf ±%d %%. Für "
             "Hauptschule, Sekundarschule und Freie Waldorfschule wird nicht "
             "fortgeschrieben — deren Zahlen folgen Umbau- und Auslaufentscheidungen, "
             "nicht der Demografie."
             % (REF_JAHR, BASIS_JAHR, int(TREND_CAP * 100)),
    },
    {
        "k": "ganztag",
        "t": "Ganztags-Raumbedarf",
        "d": "Teilweise Demo-Annahme. Die Schülerzahlen je Grundschule sind echt (MSB). "
             "Angenommen sind die Inanspruchnahme des Rechtsanspruchs mit %d %% und "
             "eine gleichmäßige Verteilung über vier Jahrgänge. Der heutige "
             "OGS-Platzbestand je Standort ist nicht öffentlich — ausgewiesen wird "
             "deshalb der Bedarf aus dem Rechtsanspruch, nicht die Lücke gegenüber "
             "dem Bestand. Für das Investitionsvolumen wird zusätzlich angenommen, "
             "dass %d %% dieser Plätze baulich noch zu schaffen sind."
             % (int(GANZTAG_QUOTE * 100), int(GANZTAG_NEU * 100)),
    },
    {
        "k": "volumen",
        "t": "Maßnahmenvolumen — drei getrennte Stränge",
        "d": "Gemischt, und bewusst getrennt gehalten. (1) Startchancen Säule I: die "
             "Summe ist echt verankert — das Schulträgerbudget der Stadt Duisburg "
             "beträgt laut Schulministerium 60.048.769,33 € Förderbetrag, bei %d %% "
             "Förderquote also rund 85,8 Mio € Gesamtvolumen für die %d "
             "Startchancen-Schulen; nur die Verteilung auf die einzelnen Standorte "
             "ist Annahme (Schülerzahl × Zustandsgewicht). (2) Sanierung: vollständig "
             "Demo-Annahme, %s € je Schüler und Zustandsstufe ab Note %d, nicht "
             "förderfähig. (3) Ganztag: Demo-Annahme, %s € je noch zu schaffendem "
             "Platz, nicht aus Säule I förderfähig. Förderfähig ist ausschließlich "
             "Strang 1 — die Trennung ist der Punkt, nicht die Summe.",
    },
    {
        "k": "baulast",
        "t": "Baulast — welche Standorte die Stadt bezahlt",
        "d": "Keine Annahme, sondern eine Abgrenzung, die leicht untergeht: Von den "
             "135 Schulen im Stadtgebiet stehen 129 in Trägerschaft der Stadt "
             "(Trägernummer 10054 im Schulverzeichnis). Zwei Förderschulen gehören "
             "einem anderen öffentlichen Träger, vier Schulen sind in freier "
             "Trägerschaft. Alle 135 bleiben im Register, weil die "
             "Schulentwicklungsplanung nach § 80 SchulG NRW das gesamte Stadtgebiet "
             "umfasst — Sanierungs- und Ganztagsvolumen werden aber nur für die 129 "
             "Standorte in städtischer Baulast angesetzt. Genau daher rührt auch die "
             "Differenz zur Zahl „rund 130\u201c auf der Amtsseite.",
    },
    {
        "k": "zeitachse",
        "t": "Verteilung über die Haushaltsjahre",
        "d": "Demo-Annahme. Die Programmlaufzeit 2024 bis 2034 ist echt; wann Duisburg "
             "welche Maßnahme abruft, ist es nicht. Der Monitor plant die Maßnahmen "
             "in der Reihenfolge des Prioritätsmodells in die Jahre %d bis %d ein, "
             "begrenzt durch den eingestellten jährlichen Eigenanteils-Deckel."
             % (PLANJAHRE[0], PLANJAHRE[-1]),
    },
]

QUELLEN = {
    "msb": {
        "t": "Schulverzeichnis, Schülerzahlen und Sozialindexstufen — Open Data MSB NRW",
        "u": "https://www.schulministerium.nrw/open-data",
    },
    "msbReihe": {
        "t": "Schülerzahlen nach Kreis und Schulform (Zeitreihe) — Open Data MSB NRW",
        "u": "https://www.schulministerium.nrw/open-data",
    },
    "startchancen": {
        "t": "Bestätigte Teilnehmerliste Startchancen-Programm NRW",
        "u": "https://www.schulministerium.nrw/startchancen",
    },
    "budget": {
        "t": "Schulträgerbudgets Investitionsprogramm Säule I, Startchancen-Programm",
        "u": "https://www.schulministerium.nrw/startchancen",
    },
    "bezirke": {
        "t": "Stadtbezirke — Open Data Duisburg",
        "u": "https://opendata-duisburg.de/dataset/stadtbezirke",
    },
}


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as fh:
        return json.load(fh)


def de_date(iso):
    return iso[8:10] + "." + iso[5:7] + "." + iso[0:4]


def zustand_von(nr):
    """Deterministische Zustandsnote 1..5 aus der Schulnummer. Demo-Annahme."""
    h = int(hashlib.sha256(nr.encode("utf-8")).hexdigest()[:12], 16) % 100
    for grenze, note in ((10, 1), (35, 2), (65, 3), (90, 4), (100, 5)):
        if h < grenze:
            return note
    return 5


# Schulform-Kuerzel am Anfang der MSB-Kurzbezeichnung ("Duisburg, GG Tonstr.").
_KUERZEL = re.compile(r"^(?:(?:FÖ|GG|GE|GH|GY|Gym|RS|SK|KG|EG|BK|WBK|KR|PR|LE|ES|SQ|KM|SE)\b[ ,]*)+")


def unterscheidungsteil(kurz):
    """'Duisburg, GG Tonstr.' -> 'Tonstr.' — der Teil, der Standorte trennt."""
    rest = kurz.split(",", 1)[1].strip() if "," in kurz else kurz
    return _KUERZEL.sub("", rest).strip() or rest


def saubere_schreibweise(name):
    """'Erich Kaestner- Gesamtschule' -> 'Erich Kaestner-Gesamtschule'.

    Im Schulverzeichnis steht bei einigen Namen ein Leerzeichen hinter dem
    Bindestrich einer Zusammensetzung. Rein kosmetisch, aendert keine Bedeutung.
    """
    return re.sub(r"(?<=\w)- (?=[A-ZÄÖÜ])", "-", name).strip()


def anzeigename(name, kurz, mehrfach):
    """Eindeutiger Anzeigename.

    Das Schulverzeichnis fuehrt 37 Duisburger Standorte unter demselben Namen
    'Staedt. Gem. Grundschule'. Erst die Kurzbezeichnung trennt sie. Wo der Name
    eindeutig ist, bleibt er unveraendert; sonst wird der unterscheidende Teil
    der Kurzbezeichnung angehaengt.
    """
    name = saubere_schreibweise(name)
    if name not in mehrfach:
        return name
    teil = unterscheidungsteil(kurz)
    return "%s %s" % (name, teil) if teil and teil not in name else (teil or name)


def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat):
            if lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def main():
    schulen_src = load("msb_schulen_du.json")
    reihe_src = load("msb_zeitreihe_du.json")
    sc_src = load("startchancen_schulen_du.json")
    budget_src = load("startchancen_budget_du.json")
    bez_src = load("du_stadtbezirke.json")

    stand = max(schulen_src["meta"]["abruf"], sc_src["meta"]["abruf"],
                bez_src["meta"]["abruf"])

    # ------------------------------------------------ Zeitreihe je Schulform
    reihe = {}
    for r in reihe_src["reihe"]:
        reihe.setdefault(r["form_text"], {}).setdefault(r["jahr"], 0)
        reihe[r["form_text"]][r["jahr"]] += r["schueler"]

    trend = {}
    for form, jahre in reihe.items():
        a, b = jahre.get(REF_JAHR, 0), jahre.get(BASIS_JAHR, 0)
        if form in AUSLAUFEND or not a or not b:
            trend[form] = None
            continue
        jaehrlich = (b / a) ** (1.0 / (BASIS_JAHR - REF_JAHR)) - 1
        faktor = (1 + jaehrlich) ** (PROGNOSE_JAHR - BASIS_JAHR)
        trend[form] = round(max(1 - TREND_CAP, min(1 + TREND_CAP, faktor)), 4)

    formen = []
    for form in sorted(reihe, key=lambda f: -reihe[f].get(BASIS_JAHR, 0)):
        j = reihe[form]
        if not j.get(BASIS_JAHR):
            continue
        formen.append({
            "name": form,
            "ref": j.get(REF_JAHR, 0),
            "jetzt": j.get(BASIS_JAHR, 0),
            "trend": trend.get(form),
            "auslaufend": form in AUSLAUFEND,
        })

    jahre_alle = sorted({y for j in reihe.values() for y in j})
    zeitreihe = [{"jahr": y, "n": sum(j.get(y, 0) for j in reihe.values())}
                 for y in jahre_alle]

    # ------------------------------------------------ Standorte
    sc_nr = {s["nr"] for s in sc_src["schulen"]}
    bezirke = bez_src["bezirke"]

    # Dubletten auf der bereinigten Schreibweise zaehlen — sonst greift die
    # Eindeutigkeitspruefung an der falschen Zeichenkette.
    namen = collections.Counter(saubere_schreibweise(s["name"])
                                for s in schulen_src["schulen"])
    mehrfach = {n for n, c in namen.items() if c > 1}

    schulen = []
    for s in schulen_src["schulen"]:
        bez = ""
        for b in bezirke:
            if any(point_in_ring(s["lon"], s["lat"], r) for r in b["ringe"]):
                bez = b["nr"]
                break
        note = zustand_von(s["nr"])
        form = s["form_text"]
        tf = trend.get(form)
        prognose = int(round(s["schueler"] * tf)) if tf else None
        luecke = max(0, prognose - s["schueler"]) if prognose is not None else 0
        soz = None if s["sozialindex"] == "ohne" else int(s["sozialindex"])

        # Ganztags-Rechtsanspruch: Primarbereich
        gz = 0
        if form == "Grundschule":
            gz = int(round(s["schueler"] * GANZTAG_QUOTE))

        schulen.append({
            "id": s["nr"],
            "n": anzeigename(s["name"], s["kurz"], mehrfach),
            "k": s["kurz"],
            "f": form,
            "b": bez,
            "lat": s["lat"],
            "lon": s["lon"],
            "sch": s["schueler"],
            "soz": soz,
            "sc": s["nr"] in sc_nr,
            "z": note,
            "prog": prognose,
            "lue": luecke,
            "gz": gz,
            "priv": s["rechtsform"] == "privat",
            "tr": s["traeger"],
        })

    ohne_bezirk = [s["id"] for s in schulen if not s["b"]]
    ohne_soz = [s["id"] for s in schulen if s["soz"] is None]

    # ------------------------------------------------ Volumen
    foerder = budget_src["investitionsbudget_eur"]
    gesamt_sc = foerder / FOERDERQUOTE

    # Drei getrennte Straenge je Standort — genau die drei Listen, die das Amt
    # heute nebeneinander fuehrt:
    #   vSc  Startchancen Saeule I, foerderfaehig (nur die 48 Programmschulen)
    #   vSan Sanierung nach Bauzustand, nicht foerderfaehig
    #   vGz  Ganztag, nicht aus Saeule I foerderfaehig (nur Grundschulen)
    gew = {s["id"]: s["sch"] * (0.6 + 0.2 * s["z"]) for s in schulen if s["sc"]}
    gew_summe = sum(gew.values()) or 1
    for s in schulen:
        s["vSc"] = int(round(gesamt_sc * gew[s["id"]] / gew_summe)) if s["sc"] else 0
        # Baulast: die Stadt investiert nur in ihre eigenen Schulen. Die beiden
        # Standorte eines anderen oeffentlichen Traegers und die vier freien
        # Schulen bleiben im Register (die Schulentwicklungsplanung nach
        # § 80 SchulG umfasst sie), tragen aber keinen kommunalen Eigenanteil.
        eigen_baulast = s["tr"] == "stadt"
        stufen_ueber = max(0, s["z"] - (SAN_AB_NOTE - 1))
        s["vSan"] = int(round(s["sch"] * stufen_ueber * SAN_EUR_SCHUELER)) if eigen_baulast else 0
        s["gzNeu"] = int(round(s["gz"] * GANZTAG_NEU)) if eigen_baulast else 0
        s["vGz"] = s["gzNeu"] * GANZTAG_EUR_PLATZ

    # Rundungsdifferenz auf den groessten Startchancen-Standort buchen, damit
    # die Summe exakt dem veroeffentlichten Budget entspricht.
    sc_list = sorted([s for s in schulen if s["sc"]], key=lambda s: -s["vSc"])
    if sc_list:
        sc_list[0]["vSc"] += int(round(gesamt_sc)) - sum(s["vSc"] for s in sc_list)

    for s in schulen:
        s["vol"] = s["vSc"] + s["vSan"] + s["vGz"]
        s["foe"] = int(round(s["vSc"] * FOERDERQUOTE))
        s["eig"] = s["vol"] - s["foe"]

    schulen.sort(key=lambda s: s["id"])

    # ------------------------------------------------ Bezirke verdichten
    bez_out = []
    for b in bezirke:
        drin = [s for s in schulen if s["b"] == b["nr"]]
        bez_out.append({
            "nr": b["nr"],
            "name": b["name"],
            "ringe": b["ringe"],
            "mitte": b["mitte"],
            "schulen": len(drin),
            "sch": sum(s["sch"] for s in drin),
            "sc": sum(1 for s in drin if s["sc"]),
            "vol": sum(s["vol"] for s in drin),
            "eig": sum(s["eig"] for s in drin),
            "gz": sum(s["gz"] for s in drin),
            "lue": sum(s["lue"] for s in drin),
        })

    # ------------------------------------------------ Gegenprobe (Back-Test)
    # Dasselbe Verfahren, an der Vergangenheit geprueft: Fitfenster und Horizont
    # sind genauso lang wie in der Produktivrechnung (6 bzw. 5 Jahre), nur um
    # sechs Jahre nach hinten verschoben. Die Zieljahre kennt das Modell nicht.
    def fortschreibung(form, fit_von, fit_bis, ziel):
        j = reihe.get(form, {})
        a, b = j.get(fit_von, 0), j.get(fit_bis, 0)
        if form in AUSLAUFEND or not a or not b:
            return None
        jaehrlich = (b / a) ** (1.0 / (fit_bis - fit_von)) - 1
        faktor = (1 + jaehrlich) ** (ziel - fit_bis)
        return b * max(1 - TREND_CAP, min(1 + TREND_CAP, faktor))

    bt_zeilen, bt_p, bt_i = [], 0.0, 0
    for form in sorted(reihe, key=lambda f: -reihe[f].get(BT_ZIEL, 0)):
        p = fortschreibung(form, BT_FIT_VON, BT_FIT_BIS, BT_ZIEL)
        ist = reihe[form].get(BT_ZIEL, 0)
        if p is None or not ist:
            continue
        bt_zeilen.append({
            "name": form,
            "prognose": int(round(p)),
            "ist": ist,
            "abw": round((p / ist - 1) * 100, 1),
        })
        bt_p += p
        bt_i += ist
    mape = (sum(abs(z["abw"]) for z in bt_zeilen) / len(bt_zeilen)) if bt_zeilen else 0
    gew_mape = (sum(abs(z["abw"]) * z["ist"] for z in bt_zeilen) / bt_i) if bt_i else 0

    # ------------------------------------------------ Benchmark kreisfreie Staedte
    # Beide Seiten kommen aus schon geladenen Quellen: das Budget aus dem
    # Schultraegerbudget-PDF, der Nenner aus der MSB-Zeitreihe. Der Schluessel
    # 'Krfr. Stadt X' ist in beiden identisch — keine Zuordnung nach Namen.
    schueler_je_stadt = {r["kreis"]: r["schueler"]
                         for r in reihe_src.get("kreisfreie_staedte", [])}
    bench = []
    for r in budget_src.get("kreisfreie_staedte", []):
        n = schueler_je_stadt.get(r["kreis"])
        if not n:
            continue
        bench.append({
            "name": r["name"],
            "budget": r["budget_eur"],
            "schueler": n,
            "jeSchueler": round(r["budget_eur"] / n, 2),
        })
    bench.sort(key=lambda b: -b["jeSchueler"])
    for i, b in enumerate(bench):
        b["rang"] = i + 1
    du_bench = next((b for b in bench if b["name"] == "Duisburg"), None)
    ohne_nenner = len(budget_src.get("kreisfreie_staedte", [])) - len(bench)

    # ------------------------------------------------ Ganztag-Ausbaustufen
    gs = [s for s in schulen if s["f"] == "Grundschule"]
    stufen = [{
        "jahr": jahr,
        "klassen": kl,
        "plaetze": int(round(sum(s["gz"] for s in gs) * kl / 4)),
    } for jahr, kl in STUFEN]

    payload = {
        "meta": {
            "stand": de_date(stand),
            "standIso": stand,
            "stadt": "Duisburg",
            "quellen": QUELLEN,
            "schuljahr": schulen_src["meta"]["schuljahr"],
            "standListe": de_date(sc_src["meta"]["stand"]),
            "standBudget": de_date(budget_src["meta"]["stand"]),
        },
        "annahmen": ANNAHMEN,
        "stadt": {
            "schulen": len(schulen),
            "schueler": sum(s["sch"] for s in schulen),
            "bezirke": len(bez_out),
            "sc": sum(1 for s in schulen if s["sc"]),
            "scSchueler": sum(s["sch"] for s in schulen if s["sc"]),
            "grundschulen": len(gs),
            "ohneSoz": len(ohne_soz),
            "ohneBezirk": len(ohne_bezirk),
            "vSc": sum(s["vSc"] for s in schulen),
            "vSan": sum(s["vSan"] for s in schulen),
            "vGz": sum(s["vGz"] for s in schulen),
            "vol": sum(s["vol"] for s in schulen),
            "foe": sum(s["foe"] for s in schulen),
            "eig": sum(s["eig"] for s in schulen),
            "sanStandorte": sum(1 for s in schulen if s["vSan"] > 0),
            "baulast": sum(1 for s in schulen if s["tr"] == "stadt"),
            "ohneBaulast": sum(1 for s in schulen if s["tr"] != "stadt"),
            "lue": sum(s["lue"] for s in schulen),
            "refJahr": REF_JAHR,
            "basisJahr": BASIS_JAHR,
            "prognoseJahr": PROGNOSE_JAHR,
        },
        "budget": {
            "foerder": foerder,
            "quote": FOERDERQUOTE,
            "gesamt": int(round(gesamt_sc)),
            "eigen": int(round(gesamt_sc * EIGENQUOTE)),
            "von": budget_src["laufzeit"]["von"],
            "bis": budget_src["laufzeit"]["bis"],
            "landessumme": budget_src["landessumme_eur"],
            "nrwSchulen": budget_src["startchancen_schulen_nrw"],
            "planjahre": PLANJAHRE,
        },
        "ganztag": {
            "quote": GANZTAG_QUOTE,
            "neuAnteil": GANZTAG_NEU,
            "eurPlatz": GANZTAG_EUR_PLATZ,
            "stufen": stufen,
            "gesamt": sum(s["gz"] for s in gs),
            "neu": sum(s["gzNeu"] for s in gs),
        },
        "gegenprobe": {
            "fitVon": BT_FIT_VON, "fitBis": BT_FIT_BIS, "ziel": BT_ZIEL,
            "formen": bt_zeilen,
            "prognose": int(round(bt_p)),
            "ist": bt_i,
            "abw": round((bt_p / bt_i - 1) * 100, 1) if bt_i else None,
            "mape": round(mape, 1),
            "mapeGewichtet": round(gew_mape, 1),
        },
        "register": {
            "traeger": schulen_src["meta"]["traegerschaft"],
            "keineSchule": schulen_src["meta"]["ausgeschlossen_keine_schule"],
            "gesamt": len(schulen),
            "inBetrieb": len(schulen) + schulen_src["meta"]["ausgeschlossen_keine_schule"],
            "schuelerStadt": sum(s["sch"] for s in schulen if s["tr"] == "stadt"),
        },
        "benchmark": {
            "staedte": bench,
            "rangDu": du_bench["rang"] if du_bench else None,
            "jeSchuelerDu": du_bench["jeSchueler"] if du_bench else None,
            "median": (sorted(b["jeSchueler"] for b in bench)[len(bench) // 2]
                       if bench else None),
            "basisJahr": reihe_src["meta"].get("basisjahr", BASIS_JAHR),
            "ohneNenner": ohne_nenner,
        },
        "formen": formen,
        "zeitreihe": zeitreihe,
        "bezirke": bez_out,
        "schulen": schulen,
    }

    # Platzhalter in der Volumen-Annahme fuellen (echte Zahlen, ein Ort).
    for a in payload["annahmen"]:
        if a["k"] == "volumen":
            a["d"] = a["d"] % (
                int(FOERDERQUOTE * 100), payload["stadt"]["sc"],
                format(SAN_EUR_SCHUELER, ",d").replace(",", "."), SAN_AB_NOTE,
                format(GANZTAG_EUR_PLATZ, ",d").replace(",", "."))

    write_data_js(payload)


def write_data_js(payload):
    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_SCHULINVESTITIONS = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out, "(%d B)" % os.path.getsize(out))


if __name__ == "__main__":
    main()
