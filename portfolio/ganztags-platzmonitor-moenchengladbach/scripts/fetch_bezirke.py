# -*- coding: utf-8 -*-
"""
fetch_bezirke.py — Grenzen der vier Stadtbezirke Moenchengladbachs
(Nord, Ost, Sued, West) aus OpenStreetMap ueber die Overpass-API.

Warum OSM: Weder das MSB-Open-Data noch opengeodata.nrw.de liefern
Stadtbezirksgrenzen unterhalb der Gemeindeebene. OSM ist die einzige offen
verfuegbare Quelle dafuer; sie wird in der Oberflaeche als eigene Quelle
inklusive Lizenzhinweis (ODbL) ausgewiesen.

Ergebnis: data/sources/osm_bezirke_mg.json — je Bezirk ein oder mehrere
vereinfachte Ringe in WGS84 (lon, lat), Koordinaten auf 5 Nachkommastellen
gerundet und ausgeduennt, damit der Snapshot klein bleibt.

Aufruf:  python3 scripts/fetch_bezirke.py
"""
import datetime
import json
import math
import os
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]
AGS_MG = "05116000"
QUERY = """
[out:json][timeout:90];
rel["de:amtlicher_gemeindeschluessel"="%s"]["admin_level"="6"];
map_to_area->.mg;
(
  rel(area.mg)["admin_level"="9"]["boundary"="administrative"];
  rel["de:amtlicher_gemeindeschluessel"="%s"]["admin_level"="6"];
);
out geom;
""" % (AGS_MG, AGS_MG)

UA = {"User-Agent": "kanduit-ganztags-platzmonitor/1.0 (+https://kanduit.de)"}
TOLERANZ = 0.00045   # ~35 m — Vereinfachung (Douglas-Peucker)


def fetch():
    """Overpass ist ein freier Dienst: Spiegel durchprobieren, mit Backoff.
    Leere Antworten (Ueberlast) gelten als Fehlschlag, nicht als Ergebnis."""
    data = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    last = None
    for versuch in range(6):
        url = OVERPASS[versuch % len(OVERPASS)]
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as fh:
                raw = json.loads(fh.read().decode("utf-8"))
            if raw.get("elements"):
                return raw
            last = "leere Antwort von %s" % url
        except Exception as exc:  # noqa: BLE001 — Spiegel weiterprobieren
            last = "%s: %s" % (url, exc)
        wait = 8 * (versuch + 1)
        print("  %s — neuer Versuch in %ds" % (last, wait))
        time.sleep(wait)
    raise SystemExit("Overpass nicht erreichbar (%s)" % last)


def stitch(members):
    """Offene Wege einer Relation zu geschlossenen Ringen zusammensetzen."""
    segs = []
    for m in members:
        if m.get("type") != "way" or m.get("role") not in ("outer", "", None):
            continue
        pts = [(round(p["lon"], 6), round(p["lat"], 6)) for p in m.get("geometry") or []]
        if len(pts) > 1:
            segs.append(pts)
    rings = []
    while segs:
        cur = list(segs.pop(0))
        changed = True
        while changed and cur[0] != cur[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]:
                    cur += s[1:]; segs.pop(i); changed = True; break
                if s[-1] == cur[-1]:
                    cur += list(reversed(s))[1:]; segs.pop(i); changed = True; break
                if s[-1] == cur[0]:
                    cur = s[:-1] + cur; segs.pop(i); changed = True; break
                if s[0] == cur[0]:
                    cur = list(reversed(s))[:-1] + cur; segs.pop(i); changed = True; break
        if len(cur) >= 4:
            if cur[0] != cur[-1]:
                cur.append(cur[0])
            rings.append(cur)
    rings.sort(key=len, reverse=True)
    return rings


def simplify(pts, tol):
    """Douglas-Peucker. Geschlossene Ringe werden vorher halbiert — sonst faellt
    der Ring in sich zusammen, weil Start- und Endpunkt identisch sind."""
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1] and len(pts) > 5:
        mid = len(pts) // 2
        return simplify(pts[:mid + 1], tol) + simplify(pts[mid:], tol)[1:]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def main():
    os.makedirs(OUT, exist_ok=True)
    raw = fetch()
    bezirke, stadt = [], None
    for e in raw.get("elements", []):
        tags = e.get("tags") or {}
        rings = [simplify(r, TOLERANZ) for r in stitch(e.get("members") or [])]
        rings = [[[round(x, 5), round(y, 5)] for x, y in r] for r in rings if len(r) >= 4]
        if not rings:
            continue
        if tags.get("admin_level") == "6":
            stadt = {"name": "Moenchengladbach", "ringe": rings}
        else:
            bezirke.append({"name": tags.get("name", "?"), "ringe": rings})
    bezirke.sort(key=lambda b: b["name"])
    if len(bezirke) != 4 or stadt is None:
        raise SystemExit("erwartet: 4 Stadtbezirke + Stadtgrenze, erhalten: %d / %s"
                         % (len(bezirke), "Stadtgrenze ok" if stadt else "keine Stadtgrenze"))

    path = os.path.join(OUT, "osm_bezirke_mg.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "OpenStreetMap-Mitwirkende, abgefragt ueber die Overpass-API",
                "quelle_url": "https://www.openstreetmap.org/relation/62644",
                "lizenz": "ODbL 1.0 — (c) OpenStreetMap-Mitwirkende",
                "filter": "admin_level 9 innerhalb der Gemeinde %s; zusaetzlich die Stadtgrenze (admin_level 6)" % AGS_MG,
                "vereinfachung": "Douglas-Peucker, Toleranz %.5f Grad (~35 m)" % TOLERANZ,
                "abruf": datetime.date.today().isoformat(),
            },
            "bezirke": bezirke,
            "stadt": stadt,
        }, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for b in bezirke:
        print("  ", b["name"], sum(len(r) for r in b["ringe"]), "Punkte")


if __name__ == "__main__":
    main()
