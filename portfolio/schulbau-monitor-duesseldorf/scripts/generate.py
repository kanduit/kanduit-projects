# -*- coding: utf-8 -*-
"""
generate.py — build data.js for the Kanduit Schulbau-Monitor demo.

Run:  python3 scripts/generate.py     (from the schulbau-monitor/ folder)

Inputs (real, public — Open Data Düsseldorf, Datenlizenz Deutschland Zero 2.0):
  data/sources/schulen.geojson              — school locations, form, Träger, lon/lat
  data/sources/stadtbezirke_grenzen.geojson — Stadtbezirk boundary polygons

Output:
  data.js  — window.KANDUIT_DATA = {meta, bezirke, schulen}

The Stadtbezirk geometry is simplified (Douglas–Peucker) for inline embedding.
Zustand / Sanierungsstau / Modernisierung / Priorität are ILLUSTRATIVE values,
generated deterministically (seeded per school) — not real assessments.
"""
import json, hashlib, math, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'data', 'sources')

SCHULEN = json.load(open(os.path.join(SRC, 'schulen.geojson'), encoding='utf-8'))
BEZIRKE = json.load(open(os.path.join(SRC, 'stadtbezirke_grenzen.geojson'), encoding='utf-8'))

BEZIRK_NAMES = {
    1: "Altstadt · Pempelfort · Derendorf", 2: "Flingern · Düsseltal",
    3: "Bilk · Friedrichstadt · Oberbilk", 4: "Oberkassel · Heerdt · Lörick",
    5: "Kaiserswerth · Stockum · Angermund", 6: "Rath · Unterrath · Mörsenbroich",
    7: "Gerresheim · Grafenberg · Ludenberg", 8: "Eller · Lierenfeld · Vennhausen",
    9: "Benrath · Wersten · Holthausen", 10: "Garath · Hellerhof",
}

# ----------------------------------------------------------------- geometry
def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    dmax, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        dist = math.hypot(x0 - x1, y0 - y1) if norm < 1e-12 \
            else abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
        if dist > dmax:
            dmax, idx = dist, i
    if dmax > eps:
        return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx + 1:], eps)
    return [points[0], points[-1]]

def simplify_ring(ring, eps=0.00025):
    openring = ring[:-1] if ring[0] == ring[-1] else ring[:]
    minx_i = min(range(len(openring)), key=lambda i: openring[i][0])
    openring = openring[minx_i:] + openring[:minx_i]
    simp = [[round(x, 5), round(y, 5)] for x, y in rdp(openring + [openring[0]], eps)]
    if simp[0] != simp[-1]:
        simp.append(simp[0])
    return simp

# ----------------------------------------------------------------- point in polygon
def point_in_ring(x, y, ring):
    inside, n, j = False, len(ring), len(ring) - 1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def bezirk_for_point(lon, lat):
    for f in BEZIRKE['features']:
        if point_in_ring(lon, lat, f['geometry']['coordinates'][0]):
            return f['properties']['STADTBEZIRK']
    best, bd = None, 1e9
    for f in BEZIRKE['features']:
        ring = f['geometry']['coordinates'][0]
        cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
        d = (cx - lon) ** 2 + (cy - lat) ** 2
        if d < bd:
            bd, best = d, f['properties']['STADTBEZIRK']
    return best

# ----------------------------------------------------------------- deterministic rng
def rng_floats(seed_str, n):
    out, h, i = [], hashlib.sha256(seed_str.encode('utf-8')).digest(), 0
    while len(out) < n:
        if i + 4 > len(h):
            h = hashlib.sha256(h).digest(); i = 0; continue
        out.append(int.from_bytes(h[i:i + 4], 'big') / 0xFFFFFFFF); i += 4
    return out

def canon_form(s):
    s = s.lower()
    if 'grundschule' in s: return 'Grundschule'
    if 'hauptschule' in s: return 'Hauptschule'
    if 'realschule' in s: return 'Realschule'
    if 'gesamtschule' in s or 'sekundarschule' in s: return 'Gesamtschule'
    if 'gymnasium' in s: return 'Gymnasium'
    if 'berufs' in s or 'kolleg' in s: return 'Berufskolleg'
    if any(w in s for w in ('förder', 'foerder', 'sonder', 'kranke')): return 'Förderschule'
    return 'Sonstige'

FORM_PROFILE = {  # (min pupils, max pupils, m² gross / pupil)
    'Grundschule': (180, 480, 11), 'Hauptschule': (260, 620, 13), 'Realschule': (380, 780, 12),
    'Gesamtschule': (650, 1350, 13), 'Gymnasium': (620, 1280, 13), 'Berufskolleg': (900, 2400, 14),
    'Förderschule': (90, 280, 16), 'Sonstige': (200, 500, 12),
}
COHORTS = [(1900, 1939, .10, 18), (1950, 1969, .30, 30), (1970, 1984, .27, 26),
           (1985, 1999, .16, 14), (2000, 2012, .12, 7), (2013, 2022, .05, 2)]
ZK_LABEL = {1: 'gut', 2: 'mittel', 3: 'schlecht', 4: 'ungenügend'}
EUR_PER_M2 = 2650

def pick_cohort(r):
    acc = 0
    for c in COHORTS:
        acc += c[2]
        if r <= acc: return c
    return COHORTS[-1]

# ----------------------------------------------------------------- build schools
schools = []
for idx, f in enumerate(SCHULEN['features']):
    p = f['properties']
    name = p['NAME DER SCHULE'].strip()
    ansch = p['ANSCHRIFT'].strip()
    parts = [x.strip() for x in p['BESCHREIBUNG (STADTTEIL - SCHULFORM - SCHULTRÄGER)'].split(' - ')]
    stadtteil = parts[0] if parts else ''
    form = canon_form(parts[1] if len(parts) > 1 else '')
    traeger = parts[2] if len(parts) > 2 else ''
    lon, lat = f['geometry']['coordinates']
    plz = (re.search(r'\b(\d{5})\b', ansch) or [None, ''])[1] if re.search(r'\b(\d{5})\b', ansch) else ''
    plz = re.search(r'\b(\d{5})\b', ansch).group(1) if re.search(r'\b(\d{5})\b', ansch) else ''
    strasse = ansch.split(' - ')[0].strip()
    bezirk = bezirk_for_point(lon, lat)

    r = rng_floats(f"{name}|{ansch}|kanduit-v1", 12)
    lo, hi, m2pp = FORM_PROFILE[form]
    schueler = int(lo + r[0] * (hi - lo))
    bgf = int(schueler * m2pp * (0.85 + r[1] * 0.4))
    coh = pick_cohort(r[2])
    baujahr = int(coh[0] + r[3] * (coh[1] - coh[0]))
    reno = r[4] < 0.32
    sanj = int(2006 + r[5] * 19) if reno else None
    if sanj and sanj <= baujahr: sanj = min(2025, baujahr + 25)

    ref = sanj if sanj else baujahr
    cond = (100 - coh[3]) - max(0, 2026 - ref) * 0.62 + (r[6] - 0.5) * 16 + (22 if sanj else 0)
    zi = round(max(8, min(98, cond)), 1)
    zk = 1 if zi >= 75 else 2 if zi >= 55 else 3 if zi >= 38 else 4

    deficit = (100 - zi) / 100.0
    stau = bgf * EUR_PER_M2 * (deficit ** 1.25) * (0.8 + r[7] * 0.5)
    stau = int(round(stau / 10000.0)) * 10000

    mod = (45 + r[8] * 50) if sanj else (r[8] * 38)
    mod = int(round(max(0, min(98, mod + (zi - 50) * 0.25))))

    old = baujahr < 1978 and not sanj
    brand = r[9] < (0.55 if old else 0.16)
    barr = not (r[10] < (0.62 if baujahr < 1992 else 0.18))
    schad = (1960 <= baujahr <= 1985 and r[11] < 0.5 and not sanj)

    prio = round(min(100, deficit * 40 + min(1, schueler / 1400) * 20
                     + min(1, stau / 18e6) * 15
                     + (14 if brand else 0) + (6 if not barr else 0) + (5 if schad else 0)), 1)
    if sanj and sanj >= 2021: status = 'abgeschlossen'
    elif prio >= 62 and r[0] < 0.5: status = 'in Umsetzung'
    elif prio >= 50: status = 'geplant'
    else: status = 'nicht begonnen'

    schools.append({'id': idx + 1, 'name': name, 'strasse': strasse, 'plz': plz,
        'stadtteil': stadtteil, 'form': form, 'traeger': traeger, 'bezirk': bezirk,
        'lon': round(lon, 5), 'lat': round(lat, 5), 'baujahr': baujahr, 'sanierungsjahr': sanj,
        'schueler': schueler, 'bgf': bgf, 'zustandsindex': zi, 'zklasse': zk,
        'zklasseLabel': ZK_LABEL[zk], 'sanierungsstau': stau, 'modernisierung': mod,
        'prioritaet': prio, 'brandschutz': brand, 'barrierefrei': barr, 'schadstoff': schad,
        'status': status})

# ----------------------------------------------------------------- aggregate per bezirk
bez_features = []
for f in BEZIRKE['features']:
    bnr = f['properties']['STADTBEZIRK']
    ring = simplify_ring(f['geometry']['coordinates'][0])
    sl = [s for s in schools if s['bezirk'] == bnr]
    n = len(sl)
    cx = round(sum(p[0] for p in ring) / len(ring), 5)
    cy = round(sum(p[1] for p in ring) / len(ring), 5)
    bez_features.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring]},
        'properties': {'bezirk': bnr, 'name': f"Stadtbezirk {bnr}", 'stadtteile': BEZIRK_NAMES.get(bnr, ''),
            'anzahlSchulen': n,
            'avgZustand': round(sum(s['zustandsindex'] for s in sl) / n, 1) if n else 0,
            'sumSanierungsstau': sum(s['sanierungsstau'] for s in sl),
            'avgModernisierung': int(round(sum(s['modernisierung'] for s in sl) / n)) if n else 0,
            'avgPrioritaet': round(sum(s['prioritaet'] for s in sl) / n, 1) if n else 0,
            'schueler': sum(s['schueler'] for s in sl), 'cx': cx, 'cy': cy}})

n = len(schools)
meta = {'stadt': 'Düsseldorf', 'stand': '06/2026', 'anzahlSchulen': n, 'anzahlBezirke': len(bez_features),
    'sumSanierungsstau': sum(s['sanierungsstau'] for s in schools),
    'avgZustand': round(sum(s['zustandsindex'] for s in schools) / n, 1),
    'avgModernisierung': int(round(sum(s['modernisierung'] for s in schools) / n)),
    'schueler': sum(s['schueler'] for s in schools), 'bgf': sum(s['bgf'] for s in schools),
    'kritisch': sum(1 for s in schools if s['zklasse'] == 4)}

payload = {'meta': meta, 'bezirke': {'type': 'FeatureCollection', 'features': bez_features}, 'schulen': schools}
header = ("/* Kanduit Schulbau-Monitor — Demo-Datensatz\n"
          "   Reale Stammdaten: Open Data Düsseldorf (Schulstandorte, Stadtbezirksgrenzen),\n"
          "   Datenlizenz Deutschland – Zero – 2.0.\n"
          "   Zustands-, Kosten- und Prioritätswerte sind ILLUSTRATIV und frei erzeugt\n"
          "   (deterministisch, seed-basiert) — keine realen Bewertungen der Stadt Düsseldorf.\n*/\n")
with open(os.path.join(ROOT, 'data.js'), 'w', encoding='utf-8') as fh:
    fh.write(header + "window.KANDUIT_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ";\n")

print(f"schools: {n}  bezirke: {len(bez_features)}")
print("by bezirk:", dict(sorted(Counter(s['bezirk'] for s in schools).items())))
print(f"total Sanierungsstau: {meta['sumSanierungsstau']:,} €  | avg Zustand: {meta['avgZustand']}  | kritisch: {meta['kritisch']}")
print("wrote", os.path.join(ROOT, 'data.js'))
