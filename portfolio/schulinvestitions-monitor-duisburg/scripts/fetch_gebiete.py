# -*- coding: utf-8 -*-
"""
fetch_gebiete.py — amtliche Stadtbezirksgrenzen der Stadt Duisburg.

Erzeugt einen kleinen Snapshot in data/sources/:

  du_stadtbezirke.json — die sieben Duisburger Stadtbezirke als vereinfachte
      WGS84-Polygone, dazu Flaeche und Schwerpunkt je Bezirk.

Quelle:
  Open Data Duisburg  https://opendata-duisburg.de/dataset/stadtbezirke
  Downloadressource:  ArcGIS-Dienst des staedtischen Geoportals
  https://geoportal.duisburg.de/arcgisserver/rest/services/OpenData/OpenData/MapServer/6

Hinweis: Das im Demo-Brief genannte Portal 'opendata.duisburg.de' existiert
nicht (kein DNS-Eintrag). Das tatsaechliche Portal der Stadt ist
'opendata-duisburg.de'; die Geometrie liegt dort als ArcGIS-Ressource.

Der Rohdienst liefert rund 370 KB. Fuer das Repo wird die Geometrie mit
Douglas-Peucker vereinfacht und auf fuenf Nachkommastellen (~1 m) gerundet —
fuer eine Uebersichtskarte genau genug, und der Snapshot bleibt klein.

Aufruf:  python3 scripts/fetch_gebiete.py
"""
import datetime
import json
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

SERVICE = ("https://geoportal.duisburg.de/arcgisserver/rest/services/"
           "OpenData/OpenData/MapServer/6")
PORTAL = "https://opendata-duisburg.de/dataset/stadtbezirke"
QUERY = {
    "where": "OBJECTID IS NOT NULL",
    "outFields": "STBNR,STBNAME",
    "returnGeometry": "true",
    "outSR": "4326",
    "f": "geojson",
}

TOLERANZ = 0.00035   # Grad, ~35 m — Vereinfachungsschwelle
STELLEN = 5          # Nachkommastellen der Ausgabekoordinaten

UA = {"User-Agent": "kanduit-schulinvestitions-monitor/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return fh.read()


def _dist2(p, a, b):
    """Quadrierter Abstand Punkt p zur Strecke a-b."""
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2


def simplify(ring, tol):
    """Douglas-Peucker, iterativ (Ringe koennen sehr lang sein)."""
    if len(ring) < 4:
        return ring
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    t2 = tol * tol
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        worst, wi = -1.0, lo
        for i in range(lo + 1, hi):
            d = _dist2(ring[i], ring[lo], ring[hi])
            if d > worst:
                worst, wi = d, i
        if worst > t2:
            keep[wi] = True
            stack.append((lo, wi))
            stack.append((wi, hi))
    return [p for p, k in zip(ring, keep) if k]


def ring_area(ring):
    """Betrag der Gauss'schen Trapezformel, in Quadratgrad."""
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s) / 2.0


def centroid(ring):
    cx = cy = a = 0.0
    for i in range(len(ring) - 1):
        cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
        a += cross
        cx += (ring[i][0] + ring[i + 1][0]) * cross
        cy += (ring[i][1] + ring[i + 1][1]) * cross
    if a == 0:
        return ring[0]
    return [cx / (3 * a), cy / (3 * a)]


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()

    print("lade Stadtbezirke vom Geoportal Duisburg …")
    raw = get(SERVICE + "/query?" + urllib.parse.urlencode(QUERY))
    fc = json.loads(raw.decode("utf-8"))
    feats = fc.get("features") or []
    if len(feats) != 7:
        raise SystemExit("erwartet 7 Stadtbezirke, erhalten %d — Quelle pruefen" % len(feats))

    bezirke = []
    roh_pts = simpl_pts = 0
    for f in feats:
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        polys = ([geom["coordinates"]] if geom.get("type") == "Polygon"
                 else geom.get("coordinates") or [])
        ringe = []
        for poly in polys:
            if not poly:
                continue
            outer = poly[0]                     # nur die Aussenkante
            roh_pts += len(outer)
            s = simplify([[p[0], p[1]] for p in outer], TOLERANZ)
            if s[0] != s[-1]:
                s.append(s[0])
            simpl_pts += len(s)
            ringe.append([[round(x, STELLEN), round(y, STELLEN)] for x, y in s])
        ringe.sort(key=ring_area, reverse=True)
        haupt = ringe[0]
        c = centroid(haupt)
        bezirke.append({
            "nr": (props.get("STBNR") or "").strip(),
            "name": (props.get("STBNAME") or "").strip(),
            "ringe": ringe,
            "mitte": [round(c[0], STELLEN), round(c[1], STELLEN)],
        })
    bezirke.sort(key=lambda b: b["nr"])
    print("  %d Bezirke, %d -> %d Stuetzpunkte" % (len(bezirke), roh_pts, simpl_pts))

    dump(os.path.join(OUT, "du_stadtbezirke.json"), {
        "meta": {
            "quelle": "Stadt Duisburg — Open Data Duisburg, Datensatz 'Stadtbezirke'",
            "quelle_url": PORTAL,
            "dienst": SERVICE,
            "abruf": abruf,
            "crs": "WGS84 (EPSG:4326)",
            "vereinfachung": "Douglas-Peucker, Toleranz %g Grad (~35 m), "
                             "Koordinaten auf %d Nachkommastellen gerundet"
                             % (TOLERANZ, STELLEN),
            "hinweis": "Amtliche Gebietsgliederung der Stadt, nicht OpenStreetMap. "
                       "Nur Aussenkanten — fuer eine Uebersichtskarte ausreichend.",
        },
        "bezirke": bezirke,
    })


def dump(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
