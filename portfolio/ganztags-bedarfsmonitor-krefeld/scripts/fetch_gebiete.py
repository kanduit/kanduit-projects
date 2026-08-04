# -*- coding: utf-8 -*-
"""
fetch_gebiete.py — die drei amtlichen Gebietsgliederungen der Stadt Krefeld.

Krefeld haelt drei Ebenen offen bereit, und der Unterschied ist fuer die
Jugendhilfeplanung wesentlich:

  Stadtbezirke (5)          POLITISCHE Einteilung, gueltig seit 01.11.2025
                            (zuvor neun Bezirke). Ebene der Bezirksvertretungen.
  Stadtteile (19)           STATISTISCHE Einteilung. Alle Angaben in den
                            amtlichen Statistiken und im Statistischen Jahrbuch
                            der Stadt beziehen sich auf diese Ebene.
  statistische Bezirke (45) Untergliederung der Stadtteile. Ebene, auf der die
                            kleinraeumigen Bevoelkerungsdaten veroeffentlicht
                            werden (siehe fetch_bevoelkerung.py).

Ergebnis: data/sources/kr_gebiete.json — je Ebene Name, amtliche Nummer und
vereinfachte Ringe in WGS84, dazu die Zuordnung Stadtteil -> Stadtbezirk und
statistischer Bezirk -> Stadtteil.

Quelle: Stadt Krefeld ueber das Offene Datenportal (offenesdatenportal.de),
nachgewiesen im Datensatzkatalog des Landes (open.nrw). Shapefile und dBASE
werden mit der Standardbibliothek gelesen; beide Formate sind offen
dokumentiert, eine Fremdbibliothek waere dafuer unverhaeltnismaessig.

Aufruf:  python3 scripts/fetch_gebiete.py
"""
import datetime
import io
import json
import math
import os
import struct
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
sys.path.insert(0, HERE)
from geo import utm32_to_wgs84, point_in_polygon  # noqa: E402

PORTAL = "https://www.offenesdatenportal.de/dataset/"
KATALOG = "https://open.nrw"

# (Ebene, ZIP-URL, Pfad im ZIP ohne Endung, Namensfeld, Nummernfeld, Sollzahl)
EBENEN = [
    ("stadtbezirke",
     PORTAL + "c9f744f3-67ee-414a-b607-bd43d54a310f/resource/"
     "480a8abb-632f-4ab8-a539-5fa45b4b2b17/download/stadtbezirke_ab_2025.zip",
     "Stadtbezirke_ab_2025/Stadtbezirke_ab_2025", "BEZIRKSBEZ", "BEZIRKSNUM", 5),
    ("stadtteile",
     PORTAL + "73613a79-bcc6-4009-9fb8-3e3bd407378d/resource/"
     "e46f4b96-a537-4c7c-90a1-002dae42dc37/download/stadtteile-krefeld.zip",
     "Stadtteile", "Stadtteiln", "Stadtteil1", 19),
    ("statbezirke",
     PORTAL + "cff80769-fbe9-4e01-a2d3-15f76814d61b/resource/"
     "2dcd7c0f-3a2f-4fe9-8d63-976ea5946ab9/download/statistische-bezirke-krefeld.zip",
     "Statistische_Bezirke", "StatiBezir", "StatiBezi1", 45),
]

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36")}
TOLERANZ_M = 25.0  # Vereinfachung in Metern (Douglas-Peucker, in UTM gerechnet)


def lade_zip(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return zipfile.ZipFile(io.BytesIO(fh.read()))


def _dec(raw):
    """Die drei Dateien mischen UTF-8 und cp1252 — erst strikt, dann cp1252."""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


def lies_dbf(raw):
    """Minimaler dBASE-III-Leser: Feldnamen + Werte je Datensatz."""
    n_rec, h_len, r_len = struct.unpack("<IHH", raw[4:12])
    felder, off = [], 32
    while raw[off] != 0x0D:
        d = raw[off:off + 32]
        felder.append((d[0:11].split(b"\x00")[0].decode("latin-1"), d[16]))
        off += 32
    zeilen = []
    for i in range(n_rec):
        row = raw[h_len + i * r_len: h_len + (i + 1) * r_len]
        pos, werte = 1, {}
        for name, laenge in felder:
            werte[name] = _dec(row[pos:pos + laenge]).strip()
            pos += laenge
        zeilen.append(werte)
    return zeilen


def lies_shp_polygone(raw):
    """Minimaler Shapefile-Leser fuer Polygone (Shape-Typ 5).

    Liefert je Datensatz eine Liste von Ringen. Loecher (gegenlaeufig
    orientierte Ringe) werden verworfen — fuer die Bezirksflaechen sind sie
    nicht relevant, und die Punkt-in-Polygon-Pruefung wuerde sie sonst
    faelschlich als Flaeche werten.
    """
    shapetyp, = struct.unpack("<i", raw[32:36])
    if shapetyp != 5:
        raise SystemExit("unerwarteter Shape-Typ %d (erwartet 5 = Polygon)" % shapetyp)
    saetze, pos, ende = [], 100, len(raw)
    while pos < ende:
        _, laenge = struct.unpack(">ii", raw[pos:pos + 8])
        inhalt = raw[pos + 8: pos + 8 + laenge * 2]
        pos += 8 + laenge * 2
        n_teile, n_punkte = struct.unpack("<ii", inhalt[36:44])
        teile = struct.unpack("<%di" % n_teile, inhalt[44:44 + 4 * n_teile])
        p0 = 44 + 4 * n_teile
        punkte = struct.unpack("<%dd" % (2 * n_punkte), inhalt[p0:p0 + 16 * n_punkte])
        ringe = []
        for i, start in enumerate(teile):
            stop = teile[i + 1] if i + 1 < n_teile else n_punkte
            ring = [(punkte[2 * j], punkte[2 * j + 1]) for j in range(start, stop)]
            # Shapefile: aeussere Ringe im Uhrzeigersinn -> negative Flaeche
            # in der ueblichen mathematischen Zaehlweise.
            flaeche = sum((ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1])
                          for k in range(len(ring) - 1)) / 2.0
            if flaeche < 0 and len(ring) >= 4:
                ringe.append(ring)
        saetze.append(ringe)
    return saetze


def simplify(pts, tol):
    """Douglas-Peucker; geschlossene Ringe werden vorher halbiert, sonst
    faellt der Ring in sich zusammen (Start- und Endpunkt sind identisch)."""
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
        ax, ay = pts[a]
        bx, by = pts[b]
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
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def flaeche_km2(ringe_utm):
    """Gauss'sche Trapezformel ueber die UTM-Ringe, in km²."""
    a = 0.0
    for ring in ringe_utm:
        a += abs(sum(ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1]
                     for k in range(len(ring) - 1)) / 2.0)
    return a / 1e6


def schwerpunkt(ringe_utm):
    """Flaechengewichteter Schwerpunkt des groessten Rings (nur zur
    Zuordnung Stadtteil -> Stadtbezirk gebraucht)."""
    groesster = max(ringe_utm, key=len)
    sx = sum(p[0] for p in groesster) / len(groesster)
    sy = sum(p[1] for p in groesster) / len(groesster)
    return sx, sy


def lade_ebene(url, layer, feld_name, feld_nr):
    z = lade_zip(url)
    attribute = lies_dbf(z.read(layer + ".dbf"))
    geometrien = lies_shp_polygone(z.read(layer + ".shp"))
    if len(attribute) != len(geometrien):
        raise SystemExit("Attribute (%d) und Geometrien (%d) passen nicht zusammen"
                         % (len(attribute), len(geometrien)))
    gebiete = []
    for attr, ringe_utm in zip(attribute, geometrien):
        ringe = []
        for ring in ringe_utm:
            vereinfacht = simplify(ring, TOLERANZ_M)
            wgs = [utm32_to_wgs84(e, n) for e, n in vereinfacht]
            ringe.append([[round(lon, 5), round(lat, 5)] for lat, lon in wgs])
        cx, cy = schwerpunkt(ringe_utm)
        clat, clon = utm32_to_wgs84(cx, cy)
        gebiete.append({
            "name": attr.get(feld_name, "?"),
            "nr": attr.get(feld_nr, "0").strip(),
            "flaecheKm2": round(flaeche_km2(ringe_utm), 2),
            "ringe": ringe,
            "_zentrum": [round(clon, 5), round(clat, 5)],
        })
    return gebiete


def main():
    os.makedirs(OUT, exist_ok=True)
    ebenen = {}
    for key, url, layer, fname, fnr, soll in EBENEN:
        print("lade %s …" % key)
        g = lade_ebene(url, layer, fname, fnr)
        if len(g) != soll:
            raise SystemExit("%s: erwartet %d Gebiete, erhalten %d" % (key, soll, len(g)))
        ebenen[key] = g

    # Stadtbezirke: Nummern 1..5 einheitlich zweistellig fuehren wir nicht —
    # die amtliche Nummer ist einstellig. Stadtteile und statistische Bezirke
    # sind dreistellig; das Portal liefert die Stadtteilnummer mit Endziffer 0
    # (z. B. 130 Bockum) und die statistischen Bezirke darunter (131, 132, 133).
    for g in ebenen["stadtteile"] + ebenen["statbezirke"]:
        g["nr"] = g["nr"].zfill(3)
    for g in ebenen["stadtbezirke"]:
        g["nr"] = str(int(g["nr"]))

    # statistischer Bezirk -> Stadtteil ueber die Nummernsystematik.
    st_nummern = {g["nr"] for g in ebenen["stadtteile"]}
    zu_stadtteil = {}
    for g in ebenen["statbezirke"]:
        stadtteil = g["nr"][:2] + "0"
        if stadtteil not in st_nummern:
            raise SystemExit("statistischer Bezirk %s: kein Stadtteil %s"
                             % (g["nr"], stadtteil))
        zu_stadtteil[g["nr"]] = stadtteil

    # Stadtteil -> Stadtbezirk geometrisch ueber den Schwerpunkt.
    zu_stadtbezirk = {}
    for g in ebenen["stadtteile"]:
        lon, lat = g["_zentrum"]
        treffer = [b["nr"] for b in ebenen["stadtbezirke"]
                   if point_in_polygon(lon, lat, b["ringe"])]
        if len(treffer) != 1:
            raise SystemExit("Stadtteil %s (%s): %d Stadtbezirks-Treffer"
                             % (g["nr"], g["name"], len(treffer)))
        zu_stadtbezirk[g["nr"]] = treffer[0]

    for g in ebenen["stadtteile"] + ebenen["statbezirke"] + ebenen["stadtbezirke"]:
        del g["_zentrum"]
    for key in ebenen:
        ebenen[key].sort(key=lambda g: g["nr"])

    path = os.path.join(OUT, "kr_gebiete.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "Stadt Krefeld — amtliche Gebietsgliederung "
                          "(Stadtbezirke ab 01.11.2025, Stadtteile, "
                          "statistische Bezirke)",
                "quelle_url": KATALOG,
                "dateien": [u for _, u, _, _, _, _ in EBENEN],
                "crs_quelle": "EPSG:25832 (ETRS89 / UTM 32N), umgerechnet nach WGS84",
                "vereinfachung": "Douglas-Peucker, Toleranz %.0f m" % TOLERANZ_M,
                "abruf": datetime.date.today().isoformat(),
                "hinweis": ("Stadtbezirke sind die politische Einteilung "
                            "(Bezirksvertretungen, seit 01.11.2025 fuenf statt "
                            "zuvor neun). Stadtteile und statistische Bezirke "
                            "sind die statistische Einteilung, auf die sich die "
                            "amtlichen Statistiken der Stadt beziehen."),
            },
            "stadtbezirke": ebenen["stadtbezirke"],
            "stadtteile": ebenen["stadtteile"],
            "statbezirke": ebenen["statbezirke"],
            "zuStadtteil": zu_stadtteil,
            "zuStadtbezirk": zu_stadtbezirk,
        }, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for key in ("stadtbezirke", "stadtteile", "statbezirke"):
        g = ebenen[key]
        print("   %-13s %2d Gebiete, %5d Punkte, %6.2f km²"
              % (key, len(g), sum(len(r) for x in g for r in x["ringe"]),
                 sum(x["flaecheKm2"] for x in g)))


if __name__ == "__main__":
    main()
