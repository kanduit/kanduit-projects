# -*- coding: utf-8 -*-
"""
generate.py — aggregate the committed data snapshots (data/sources/) into
data.js for the Kanduit Ganztags-Platzmonitor Mönchengladbach.

Run:  python3 scripts/generate.py     (from the project folder)

Conventions (do not break):
- Reads ONLY files under data/sources/ — no network access, so the build is
  reproducible offline. Fetching lives in scripts/fetch_<quelle>.py.
- Output must be DETERMINISTIC: running twice yields a byte-identical data.js
  (meta.stand comes from the snapshots, never from datetime.now()).
- Aggregates only; no personal data, no company/winner names.

Was hier gerechnet wird — und was bewusst NICHT:
- Aus offenen Daten kommen: Standorte, Schuelerzahlen, Sozialindexstufen,
  Klassenzahlen (MSB NRW), Kita-Ue3-Plaetze (Open Data NRW), Bezirksgrenzen (OSM).
- Demo-Annahmen sind: die Raumkennwerte des Kapazitaetsmodells, die
  Bestandsquote der Jahrgaenge ohne Rechtsanspruch und die Liste der geplanten
  Bau- und Umbaumassnahmen. Sie sind im Datensatz als solche markiert und in der
  Oberflaeche ausgewiesen. Die Szenariorechnung selbst laeuft im Browser.
"""
import glob
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

import sys  # noqa: E402
sys.path.insert(0, HERE)
from geo import point_in_polygon  # noqa: E402

HEADER = (
    "/* Kanduit Ganztags-Platzmonitor Mönchengladbach — aggregierte öffentliche Daten.\n"
    "   Quellen: MSB NRW Open Data (Schulverzeichnis, Schülerzahlen, Sozialindex),\n"
    "   Open Data NRW (Kindertageseinrichtungen), OpenStreetMap (Stadtbezirksgrenzen, ODbL).\n"
    "   Raumkennwerte, Bestandsquote und Maßnahmenliste sind gekennzeichnete Demo-Annahmen.\n"
    "   Erzeugt von scripts/generate.py — Abruf siehe meta.stand.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)

# ---------------------------------------------------------------- Demo-Annahmen
# Raumkennwerte des Kapazitaetsmodells. Die Voreinstellungen sind so gewaehlt,
# dass das Modell stadtweit die oeffentlich genannte Groessenordnung fuer das
# Schuljahr 2026/27 reproduziert (rund 1.380 freie Plaetze fuer Klasse 1).
# Im Projekt durch die Raumbuecher des Fachbereichs zu ersetzen.
RAUM_DEFAULTS = {
    "flaecheProRaum": 85.0,    # m² je Klassenraum-Äquivalent inkl. anteiliger
                               # Neben-, Mehrzweck- und Mensaflächen
    "anteilGanztag": 50.0,     # % davon multifunktional für den Ganztag nutzbar
    "flaecheProKind": 4.0,     # m² je gleichzeitig betreutem Kind
    "belegungsfaktor": 1.25,   # versetzte Nutzung im offenen/halboffenen Modell
}
BESTANDSQUOTE = 52.0           # % OGS-Teilnahme der Jahrgänge ohne Rechtsanspruch
RAUM_STREUUNG = 25.0           # % Streuung des Raumbestands je Standort (Demo)

# Oeffentlich genannte Ankerwerte (Stadt Mönchengladbach, Newsroom)
ANKER = {
    "bedarfVon": 2000,
    "bedarfBis": 2100,
    "freiePlaetze": 1380,
    "luecke": 720,
    "schuljahr": "2026/27",
    "quelleUrl": ("https://www.moenchengladbach.de/aktuell-aktiv/newsroom/"
                  "ogs-ausbau-in-moenchengladbach-umsetzung-des-rechtsanspruchs-ab-2026-27"),
}

STUFEN = [
    {"id": "2026/27", "jahr": 2026, "jahrgaenge": 1, "klassen": "Klasse 1"},
    {"id": "2027/28", "jahr": 2027, "jahrgaenge": 2, "klassen": "Klassen 1–2"},
    {"id": "2028/29", "jahr": 2028, "jahrgaenge": 3, "klassen": "Klassen 1–3"},
    {"id": "2029/30", "jahr": 2029, "jahrgaenge": 4, "klassen": "Klassen 1–4"},
]

MASSNAHMEN_TYPEN = [
    "Anbau Ganztagsräume",
    "Umbau zu Multifunktionsräumen",
    "Mensa- und Küchenerweiterung",
    "Aufstockung Bestandsgebäude",
    "Neubau Ganztagstrakt",
    "Interimsbau (Modulbauweise)",
]
MASSNAHMEN_ANZAHL = 16
BASISJAHR = 2025


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as fh:
        return json.load(fh)


def bezirk_von(lat, lon, bezirke):
    if lat is None or lon is None:
        return None
    for b in bezirke:
        if point_in_polygon(lon, lat, b["ringe"]):
            return b["name"]
    return None


def raummodell_plaetze(raeume, p):
    """Plätze je Standort aus Raumfläche und Nutzungsannahmen — nicht aus
    festen Gruppengrößen. Gleiche Formel wie in app.js (dort veränderbar)."""
    flaeche = raeume * p["flaecheProRaum"] * (p["anteilGanztag"] / 100.0)
    return int(math.floor(flaeche / p["flaecheProKind"] * p["belegungsfaktor"]))


def raum_index(schulnummer):
    """Deterministischer Streufaktor in [-1, +1] je Standort.

    Hintergrund: Der Raumbestand einer Grundschule ist real NICHT proportional
    zur Schülerzahl — Baujahr, Erweiterungen, Fachraumanteil und Mensa
    unterscheiden sich erheblich. Diese Streuung ist planungsrelevant, liegt
    aber nicht offen vor. Ohne sie hätten alle Standorte denselben
    Deckungsgrad, und die Karte wäre einfarbig — ein Artefakt des Modells,
    keine Aussage über die Stadt.

    Der Faktor wird daher deterministisch aus der Schulnummer erzeugt (FNV-1a),
    ist in der Oberfläche als Demo-Annahme ausgewiesen und über den Regler
    „Streuung des Raumbestands“ auf 0 % stellbar — dann rechnet das Modell
    wieder strikt proportional. Er enthält keine Aussage über einen realen
    Standort.
    """
    h = 2166136261
    for ch in schulnummer:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return round((h % 20001) / 10000.0 - 1.0, 4)


def raeume_effektiv(s, streuung):
    """Klassenraum-Äquivalente inkl. Demo-Streuung. Gleiche Formel wie app.js."""
    return max(1, int(round(s["raeume"] * (1 + streuung / 100.0 * s["raumIndex"]))))


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    if len(files) < 4:
        raise SystemExit("Snapshots unvollständig — scripts/fetch_*.py ausführen")

    schulen_raw = load("msb_grundschulen_mg.json")
    zeitreihe_raw = load("msb_zeitreihe_mg.json")
    kitas_raw = load("kitas_mg.json")
    geo_raw = load("osm_bezirke_mg.json")

    stand_iso = max(schulen_raw["meta"]["abruf"], zeitreihe_raw["meta"]["abruf"],
                    kitas_raw["meta"]["abruf"], geo_raw["meta"]["abruf"])
    stand = "%s.%s.%s" % (stand_iso[8:10], stand_iso[5:7], stand_iso[0:4])

    # ---------------------------------------------------------- Zeitreihe
    jahre = {}
    for r in zeitreihe_raw["reihe"]:
        j = jahre.setdefault(r["jahr"], {"jahr": r["jahr"], "schueler": 0, "klassen": 0, "schulen": 0})
        j["schueler"] += r["schueler"]
        j["klassen"] += r["klassen"]
        j["schulen"] += r["schulen"]
    zeitreihe = [jahre[j] for j in sorted(jahre)]
    letztes = zeitreihe[-1]
    if letztes["jahr"] != BASISJAHR:
        raise SystemExit("Zeitreihe endet %d, erwartet %d — Basisjahr anpassen"
                         % (letztes["jahr"], BASISJAHR))

    klassengroesse = round(letztes["schueler"] / letztes["klassen"], 2)

    def cagr(weite):
        frueher = jahre.get(BASISJAHR - weite)
        if not frueher:
            return None
        return round((letztes["schueler"] / frueher["schueler"]) ** (1.0 / weite) - 1.0, 4)

    trend = {"j1": cagr(1), "j3": cagr(3), "j5": cagr(5), "j8": cagr(8)}
    trend_default = trend["j3"]

    # ---------------------------------------------------------- Bezirke
    bezirke_geo = geo_raw["bezirke"]
    bezirk_stat = {b["name"]: {"kitas": 0, "kitaUe3": 0, "kitaU3": 0} for b in bezirke_geo}
    kitas_ohne_bezirk = 0
    for k in kitas_raw["kitas"]:
        name = bezirk_von(k["lat"], k["lon"], bezirke_geo)
        if not name:
            kitas_ohne_bezirk += 1
            continue
        bezirk_stat[name]["kitas"] += 1
        bezirk_stat[name]["kitaUe3"] += k["ue3"]
        bezirk_stat[name]["kitaU3"] += k["u3"]

    # ---------------------------------------------------------- Standorte
    namen = {}
    for s in schulen_raw["schulen"]:
        namen[s["name"]] = namen.get(s["name"], 0) + 1

    schulen = []
    for s in schulen_raw["schulen"]:
        gruendung = int(s["betrieb_seit"][-4:]) if s.get("betrieb_seit") else 1900
        im_aufbau = gruendung >= BASISJAHR - 1
        raeume = int(math.ceil(s["schueler"] / klassengroesse)) if s["schueler"] else 0
        # Jahrgangsstärke: Gesamtschülerzahl ÷ 4 Jahrgänge. Schulen im Aufbau
        # führen noch nicht alle vier Jahrgänge — dort ist die Schülerzahl
        # selbst die Jahrgangsstärke.
        vorhandene = min(4, BASISJAHR - gruendung + 1) if im_aufbau else 4
        vorhandene = max(1, vorhandene)
        kohorte = round(s["schueler"] / float(vorhandene), 1)
        anzeige = s["name"]
        if namen[s["name"]] > 1:
            anzeige = "%s (%s)" % (s["name"], s["strasse"].split(",")[0])
        schulen.append({
            "nr": s["nr"],
            "name": anzeige,
            "strasse": s["strasse"],
            "plz": s["plz"],
            "bezirk": bezirk_von(s["lat"], s["lon"], bezirke_geo) or "ohne Zuordnung",
            "rechtsform": s["rechtsform"],
            "sozialindex": s["sozialindex"],
            "schueler": s["schueler"],
            "raeume": raeume,
            "raumIndex": raum_index(s["nr"]),
            "kohorte": kohorte,
            "imAufbau": im_aufbau,
            "gruendung": gruendung,
            "lat": s["lat"],
            "lon": s["lon"],
        })
    schulen.sort(key=lambda s: s["nr"])

    # Streufaktoren so zentrieren, dass die stadtweite Raumsumme unverändert
    # bleibt: die Streuung verschiebt Kapazität zwischen Standorten, sie
    # erzeugt oder vernichtet keine.
    gewicht = sum(s["raeume"] for s in schulen)
    mittel = sum(s["raumIndex"] * s["raeume"] for s in schulen) / float(gewicht or 1)
    for s in schulen:
        s["raumIndex"] = round(s["raumIndex"] - mittel, 4)

    # ---------------------------------------------------------- Maßnahmen (Demo)
    # Deterministisch aus der modellierten Lücke der Endstufe 2029/30 abgeleitet:
    # keine Zufallszahlen, gleiche Eingabe -> gleiche Liste.
    quote_basis = None
    kohorte_2026 = sum(s["kohorte"] for s in schulen) * (1 + trend_default)
    quote_basis = round(((ANKER["bedarfVon"] + ANKER["bedarfBis"]) / 2.0) / kohorte_2026 * 100, 1)

    faktor_2029 = (1 + trend_default) ** (2029 - BASISJAHR)
    luecken = []
    for s in schulen:
        bedarf = s["kohorte"] * faktor_2029 * 4 * (quote_basis / 100.0)
        kap = raummodell_plaetze(raeume_effektiv(s, RAUM_STREUUNG), RAUM_DEFAULTS)
        luecken.append((max(0.0, bedarf - kap), s["nr"]))
    luecken.sort(key=lambda x: (-x[0], x[1]))

    massnahmen = []
    for i, (luecke, nr) in enumerate(luecken[:MASSNAHMEN_ANZAHL]):
        plaetze = max(25, int(round(luecke * 0.62 / 25.0)) * 25)
        massnahmen.append({
            "id": "M%02d" % (i + 1),
            "schulNr": nr,
            "typ": MASSNAHMEN_TYPEN[i % len(MASSNAHMEN_TYPEN)],
            "plaetze": plaetze,
            "wirksamAb": 2027 + (i % 4),
            "annahme": True,
        })
    massnahmen.sort(key=lambda m: m["id"])

    # ---------------------------------------------------------- Bezirksliste
    bezirke = []
    for b in sorted(bezirke_geo, key=lambda b: b["name"]):
        st = bezirk_stat[b["name"]]
        mine = [s for s in schulen if s["bezirk"] == b["name"]]
        bezirke.append({
            "name": b["name"],
            "ringe": b["ringe"],
            "schulen": len(mine),
            "schueler": sum(s["schueler"] for s in mine),
            "kitas": st["kitas"],
            "kitaUe3": st["kitaUe3"],
            "kitaU3": st["kitaU3"],
        })

    payload = {
        "meta": {
            "stand": stand,
            "standIso": stand_iso,
            "stadt": "Mönchengladbach",
            "schuljahrBasis": "2025/26",
            "basisjahr": BASISJAHR,
            "kitasOhneBezirk": kitas_ohne_bezirk,
            "quellen": {
                "msb": {"t": "MSB NRW — Open Data (Schulverzeichnis, Schülerzahlen, Sozialindexstufen)",
                        "u": schulen_raw["meta"]["quelle_url"]},
                "msbReihe": {"t": "MSB NRW — Open Data, Schülerzahlen nach Kreis und Schulform",
                             "u": zeitreihe_raw["meta"]["quelle_url"]},
                "kitas": {"t": "Kindertageseinrichtungen in NRW — Open Data NRW",
                          "u": kitas_raw["meta"]["quelle_url"]},
                "osm": {"t": "Stadtbezirksgrenzen — OpenStreetMap-Mitwirkende (ODbL)",
                        "u": geo_raw["meta"]["quelle_url"]},
                "stadt": {"t": "Stadt Mönchengladbach — OGS-Ausbau, Umsetzung des Rechtsanspruchs ab 2026/27",
                          "u": ANKER["quelleUrl"]},
                "ganztag": {"t": "Bildungsnetzwerk Mönchengladbach — Der offene Ganztag",
                            "u": "https://www.moenchengladbach.de/bildungsnetzwerk-ogs/der-offene-ganztag"},
            },
        },
        "konstanten": {
            "klassengroesse": klassengroesse,
            "trend": trend,
            "trendDefault": trend_default,
            "quoteBasis": quote_basis,
            "bestandsquote": BESTANDSQUOTE,
        },
        "raumDefaults": dict(RAUM_DEFAULTS, raumStreuung=RAUM_STREUUNG),
        "anker": ANKER,
        "stufen": STUFEN,
        "zeitreihe": zeitreihe,
        "bezirke": bezirke,
        "stadtRinge": geo_raw["stadt"]["ringe"],
        "schulen": schulen,
        "massnahmen": massnahmen,
    }

    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_GANZTAGS = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out, "(%.1f KB)" % (os.path.getsize(out) / 1024.0))
    print("  Standorte %d · Klassengröße %.2f · Trend %.1f %% · Basisquote %.1f %%"
          % (len(schulen), klassengroesse, trend_default * 100, quote_basis))
    print("  Kapazität (Voreinstellung): %d Plätze · Maßnahmen: %d / %d Plätze"
          % (sum(raummodell_plaetze(raeume_effektiv(s, RAUM_STREUUNG), RAUM_DEFAULTS)
                 for s in schulen),
             len(massnahmen), sum(m["plaetze"] for m in massnahmen)))


if __name__ == "__main__":
    main()
