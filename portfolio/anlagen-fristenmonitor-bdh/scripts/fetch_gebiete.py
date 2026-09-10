import datetime
import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
CACHE = os.environ.get("KANDUIT_CACHE", "/tmp/kanduit-bdh-fetch")

WFS = "https://www.wfs.nrw.de/geobasis/wfs_nw_dvg"
CITIES = [
    ("911", "Bochum", "05911000", "wfs_bochum.xml"),
    ("913", "Dortmund", "05913000", "wfs_dortmund.xml"),
    ("914", "Hagen", "05914000", "wfs_hagen.xml"),
]
TOLERANZ = 0.0025
STELLEN = 5
UA = {"User-Agent": "kanduit-anlagen-fristenmonitor-bdh/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as fh:
        return fh.read()


def _dist2(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2


def simplify(ring, tol):
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


def gml_poslist_lonlat(text):
    nums = [float(x) for x in text.split()]
    ring = []
    for i in range(0, len(nums) - 1, 2):
        lat, lon = nums[i], nums[i + 1]
        ring.append([round(lon, STELLEN), round(lat, STELLEN)])
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def localname(tag):
    return tag.rsplit("}", 1)[-1]


def load_feature(xml_bytes):
    root = ET.fromstring(xml_bytes)
    pos = None
    kn = gn = stand = None
    for el in root.iter():
        ln = localname(el.tag)
        if ln == "posList" and el.text and pos is None:
            pos = el.text
        elif ln == "KN" and el.text:
            kn = el.text.strip()
        elif ln == "GN" and el.text:
            gn = el.text.strip()
        elif ln == "STAND" and el.text:
            stand = el.text.strip()
    if not pos:
        raise SystemExit("WFS feature has no posList")
    return kn, gn, stand, gml_poslist_lonlat(pos)


def fetch_or_cache(resource_id, cache_name):
    cached = os.path.join(CACHE, cache_name)
    if os.path.isfile(cached):
        return open(cached, "rb").read()
    q = {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAMES": "dvg:nw_dvg2_krs",
        "RESOURCEID": "nw_dvg2_krs." + resource_id,
    }
    url = WFS + "?" + urllib.parse.urlencode(q)
    raw = get(url)
    os.makedirs(CACHE, exist_ok=True)
    with open(cached, "wb") as fh:
        fh.write(raw)
    return raw


def ring_to_path(ring):
    if not ring:
        return ""
    parts = ["M%.5f,%.5f" % (ring[0][0], ring[0][1])]
    for p in ring[1:]:
        parts.append("L%.5f,%.5f" % (p[0], p[1]))
    parts.append("Z")
    return "".join(parts)


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()
    cities = {}
    for key, name, rid, cache_name in CITIES:
        raw = fetch_or_cache(rid, cache_name)
        kn, gn, stand, ring = load_feature(raw)
        ring = [[round(p[0], STELLEN), round(p[1], STELLEN)]
                for p in simplify(ring, TOLERANZ)]
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        mitte = centroid(ring)
        cities[key] = {
            "name": name,
            "municipalityKey": kn or ("05" + key + "000"),
            "gn": gn or name,
            "stand": stand,
            "bbox": [min(lons), min(lats), max(lons), max(lats)],
            "mitte": [round(mitte[0], STELLEN), round(mitte[1], STELLEN)],
            "path": ring_to_path(ring),
            "ringe": [ring],
        }
        print(name, "vertices", len(ring), "kn", kn)

    payload = {
        "meta": {
            "abruf": abruf,
            "quelle_url": WFS,
            "type": "dvg:nw_dvg2_krs",
            "crs": "EPSG:4326",
            "simplify_deg": TOLERANZ,
        },
        "cities": cities,
    }
    dest = os.path.join(OUT, "gebiete_bdh.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=2)
        fh.write("\n")
    print("wrote", dest, "bytes", os.path.getsize(dest))


if __name__ == "__main__":
    main()
