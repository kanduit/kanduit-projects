# -*- coding: utf-8 -*-
"""
fetch_grundschulbezirke.py — Grundschulbezirke der Stadt Bochum mit
Jahrgangsstaerken, Kapazitaet und Belegungsprognose bis Schuljahr 2031/32.

Dies ist die tragende Quelle dieses Demonstrators. Die Stadt Bochum veroeffent-
licht ueber ihren Kartendienst "maponline" das Thema "Grundschulen"
(Grundschulbezirke, Adresspunkte, Schulstandorte). Der Dienst enthaelt je
Grundschulbezirk nicht nur die Bezirksgrenze, sondern auch die Planungsgroessen,
mit denen die Stadt selbst rechnet:

  KAPAZITAET      Bezugsgroesse des Standorts (entspricht durchgaengig der
                  Belegung 2025/26 — die Stadt misst freie Kapazitaet gegen den
                  Ist-Stand, nicht gegen eine Raumkapazitaet; siehe README)
  KL_1 … KL_4     Schuelerinnen und Schueler je Jahrgangsstufe 2025/26
  EWO_0J … EWO_5J Einwohner der Altersjahre 0 bis 5 im Bezirk (Stand EWO_JAHR)
  PROG_0J … 5J    dieselben Jahrgaenge nach Abschlag PROG_ABSCH (Fortzugs- und
                  Anmeldeverhalten)
  PR_SJ_0 … 6     die sieben Prognoseschuljahre 2025/26 bis 2031/32
  PR_BELEG_0 … 6  prognostizierte Belegung je Schuljahr
  PR_FRKAP_0 … 6  freie Kapazitaet je Schuljahr (negativ = Fehlbedarf)

Damit muss dieser Demonstrator die Jahrgangsstaerken NICHT selbst schaetzen —
er uebernimmt die Kohortenrechnung des Schultraegers und legt die Ganztags-
Anspruchslogik des § 24 Abs. 4 SGB VIII darueber.

Die Layer 10 bis 15 des Dienstes ("freie Kapazitaet_2026/2027" bis
"_2031/2032") tragen identische Sachdaten und unterscheiden sich nur in der
Signatur. Abgerufen wird deshalb ausschliesslich Layer 10.

Quelle: Stadt Bochum, Kartendienst maponline, Thema "Grundschulen"
        https://geoservicekkm.bochum.de/arcgis/rest/services/maponline/Grundschulen/MapServer
        (c) Stadt Bochum

Nur Einrichtungs- und Gebietsdaten. Keine personenbezogenen Daten: Der Dienst
fuehrt weder Schuelerinnen und Schueler noch Beschaeftigte, sondern
Jahrgangssummen je Bezirk.

Aufruf:  python3 scripts/fetch_grundschulbezirke.py
"""
import datetime
import json
import math
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
sys.path.insert(0, HERE)
from geo import utm32_to_wgs84  # noqa: E402

BASE = ("https://geoservicekkm.bochum.de/arcgis/rest/services/"
        "maponline/Grundschulen/MapServer")
LAYER = 10
URL_ATTR = (BASE + "/%d/query?where=1%%3D1&outFields=*&returnGeometry=false"
            "&f=json") % LAYER
URL_GEO = (BASE + "/%d/query?where=1%%3D1&outFields=SCHULNR&returnGeometry=true"
           "&outSR=4326&f=geojson") % LAYER

UA = {"User-Agent": "kanduit-ganztags-bedarfsmonitor/1.0 (+https://kanduit.de)"}

# Vereinfachung der Bezirksgrenzen: Der Demonstrator zeichnet eine Uebersichts-
# karte, keine Katasterkarte. 25 m Toleranz haelt jede Bezirksform erkennbar und
# druckt den Geometrie-Anteil von data.js auf einen Bruchteil zusammen.
TOLERANZ_M = 25.0
NACHKOMMA = 4          # ~7 m in Laenge, ~11 m in Breite auf 51,5 Grad Nord

SCHULJAHRE = 7         # PR_SJ_0 … PR_SJ_6


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=240) as fh:
        return json.loads(fh.read().decode("utf-8"))


def rdp(punkte, tol_grad):
    """Douglas-Peucker, rein in der Standardbibliothek."""
    if len(punkte) < 3:
        return punkte[:]
    ax, ay = punkte[0]
    bx, by = punkte[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    weit, idx = -1.0, 0
    for i in range(1, len(punkte) - 1):
        px, py = punkte[i]
        if norm == 0:
            d = math.hypot(px - ax, py - ay)
        else:
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
        if d > weit:
            weit, idx = d, i
    if weit <= tol_grad:
        return [punkte[0], punkte[-1]]
    return rdp(punkte[:idx + 1], tol_grad)[:-1] + rdp(punkte[idx:], tol_grad)


def ring_vereinfachen(ring, tol_grad):
    vereinfacht = rdp([tuple(p[:2]) for p in ring], tol_grad)
    if len(vereinfacht) < 4:                       # entartet -> Original behalten
        vereinfacht = [tuple(p[:2]) for p in ring]
    aus = [[round(x, NACHKOMMA), round(y, NACHKOMMA)] for x, y in vereinfacht]
    if aus[0] != aus[-1]:
        aus.append(aus[0])
    return aus


def ringe_aus(geom):
    if geom["type"] == "Polygon":
        return list(geom["coordinates"])
    return [ring for teil in geom["coordinates"] for ring in teil]


def num(v):
    return None if v is None else int(v)


def main():
    os.makedirs(OUT, exist_ok=True)
    stand = datetime.date.today().isoformat()

    print("lade Sachdaten der Grundschulbezirke …")
    attr = get(URL_ATTR)["features"]
    print("lade Bezirksgrenzen …")
    geo = get(URL_GEO)["features"]
    if len(attr) != len(geo):
        raise SystemExit("Sach- und Geometriesatz verschieden lang (%d/%d)"
                         % (len(attr), len(geo)))
    if len(attr) < 40:
        raise SystemExit("unerwartet wenige Grundschulbezirke (%d) — Dienst pruefen"
                         % len(attr))

    # 25 m in Grad, auf der Breite Bochums.
    mid_lat = 51.48
    tol_grad = TOLERANZ_M / (111320.0 * math.cos(math.radians(mid_lat)))

    grenzen = {}
    roh_punkte = fein_punkte = 0
    for f in geo:
        nr = str(f["properties"]["SCHULNR"]).strip()
        ringe = ringe_aus(f["geometry"])
        roh_punkte += sum(len(r) for r in ringe)
        vereinfacht = [ring_vereinfachen(r, tol_grad) for r in ringe]
        # Splitter (Restflaechen von wenigen Metern) tragen nichts zur Karte bei.
        vereinfacht = [r for r in vereinfacht if len(r) >= 4]
        fein_punkte += sum(len(r) for r in vereinfacht)
        grenzen[nr] = vereinfacht

    schulen = []
    for f in attr:
        a = f["attributes"]
        nr = str(a["SCHULNR"]).strip()
        lat = lon = None
        if a.get("RECHTS_UTM") and a.get("HOCH_UTM"):
            lat, lon = utm32_to_wgs84(float(a["RECHTS_UTM"]), float(a["HOCH_UTM"]))
            lat, lon = round(lat, 6), round(lon, 6)
        eintrag = {
            "nr": nr,
            "name": (a.get("SCHNAME_K") or "").strip(),
            "anschrift": (a.get("ANSCHRIFT") or "").strip(),
            "plz_ort": (a.get("PLZ_ORT") or "").strip(),
            "teilstandort": nr.endswith("T"),
            "stadtbezirk_nr": num(a.get("SBEZ_NR")),
            "stadtbezirk": (a.get("SBEZ_NAME") or "").strip(),
            "kapazitaet": num(a.get("KAPAZITAET")),
            "kapazitaet_art": (a.get("KAPAZ_ART") or "").strip(),
            "klassen": [num(a.get("KL_%d" % k)) for k in range(1, 5)],
            "ewo_jahr": num(a.get("EWO_JAHR")),
            "ewo": [num(a.get("EWO_%dJ" % j)) for j in range(6)],
            "prog_abschlag": a.get("PROG_ABSCH"),
            "prog": [num(a.get("PROG_%dJ" % j)) for j in range(6)],
            "beleg": [num(a.get("PR_BELEG_%d" % i)) for i in range(SCHULJAHRE)],
            "frkap": [num(a.get("PR_FRKAP_%d" % i)) for i in range(SCHULJAHRE)],
            "lat": lat, "lon": lon,
            "ringe": grenzen.get(nr, []),
        }
        if not eintrag["ringe"]:
            raise SystemExit("kein Bezirksumriss zu Schulnummer %s" % nr)
        schulen.append(eintrag)
    schulen.sort(key=lambda s: s["nr"])

    # Die Schuljahres-Etiketten stehen in jedem Datensatz gleich; PR_SJ_4 ist in
    # der Quelle als "2029.203" verunglueckt und wird hier normalisiert.
    roh_labels = [attr[0]["attributes"].get("PR_SJ_%d" % i) for i in range(SCHULJAHRE)]
    schuljahre, korrigiert = [], []
    for i, roh in enumerate(roh_labels):
        text = (roh or "").replace("SJ ", "").strip()
        start = 2025 + i
        soll = "%d/%d" % (start, start + 1)
        if text != soll:
            korrigiert.append({"feld": "PR_SJ_%d" % i, "quelle": roh, "gesetzt": soll})
        schuljahre.append(soll)

    payload = {
        "meta": {
            "quelle": "Stadt Bochum, Kartendienst maponline, Thema "
                      "„Grundschulen“ (Grundschulbezirke, Kapazitaet, "
                      "Belegungsprognose)",
            "quelle_url": BASE,
            "layer": "%d („freie Kapazitaet_2026/2027“) — die Layer 10 bis 15 "
                     "tragen identische Sachdaten" % LAYER,
            "abruf": stand,
            "ewo_stand": schulen[0]["ewo_jahr"],
            "schuljahre": schuljahre,
            "labels_korrigiert": korrigiert,
            "vereinfachung": "Douglas-Peucker, Toleranz %d m, Koordinaten auf %d "
                             "Nachkommastellen; %d von %d Stuetzpunkten behalten"
                             % (TOLERANZ_M, NACHKOMMA, fein_punkte, roh_punkte),
            "hinweis": "Nur Einrichtungs- und Gebietsdaten. Keine personenbezogenen "
                       "Daten — der Dienst fuehrt ausschliesslich Jahrgangs- und "
                       "Bezirkssummen. „KAPAZITAET“ ist in der Quelle "
                       "durchgaengig gleich der Belegung 2025/26: Die Stadt misst "
                       "freie Kapazitaet gegen den Ist-Stand, nicht gegen eine "
                       "Raumkapazitaet.",
        },
        "schulen": schulen,
    }

    path = os.path.join(OUT, "bo_grundschulbezirke.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True,
                  separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    print("   %d Grundschulbezirke, davon %d Teilstandorte"
          % (len(schulen), sum(1 for s in schulen if s["teilstandort"])))
    print("   Stuetzpunkte %d -> %d" % (roh_punkte, fein_punkte))
    print("   Schueler 2025/26: %d" % sum(sum(s["klassen"]) for s in schulen))
    for i, sj in enumerate(schuljahre):
        print("   %s  Belegung %6d  freie Kapazitaet %6d"
              % (sj, sum(s["beleg"][i] for s in schulen),
                 sum(s["frkap"][i] for s in schulen)))
    if korrigiert:
        print("   Etiketten normalisiert:", korrigiert)


if __name__ == "__main__":
    main()
