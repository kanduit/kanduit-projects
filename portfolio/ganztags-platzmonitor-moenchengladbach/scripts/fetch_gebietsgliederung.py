# -*- coding: utf-8 -*-
"""
fetch_gebietsgliederung.py — Stadtbezirke Mönchengladbachs aus der amtlichen
Kleinräumigen Gebietsgliederung (KGG) der Stadt.

Quelle: Stadt Mönchengladbach, Geoportal — Datensatz "Kleinräumige
Gebietsgliederung", nachgewiesen im Open-Data-Portal des Landes (open.nrw).
Das ZIP enthält Stadtbezirke, Stadtteile, statistische Bezirke und Baublöcke
als Shapefile in EPSG:25832.

Warum diese Quelle und nicht OpenStreetMap: Sie ist die amtliche Gliederung des
Schulträgers selbst. Die Bezirksnummern entsprechen denen, mit denen der
Fachbereich arbeitet. (Die feineren Ebenen Stadtteil und statistischer Bezirk
liegen im selben Datensatz — sie sind die natürliche Aggregationsebene, sobald
Einwohner- oder Einzugsbereichsdaten hinzukommen.)

Ergebnis: data/sources/mg_stadtbezirke.json — je Bezirk Name, amtliche Nummer
und vereinfachte Ringe in WGS84.

Shapefile und dBASE werden mit der Standardbibliothek gelesen; beide Formate
sind offen dokumentiert, eine Fremdbibliothek wäre dafür unverhältnismäßig.

Aufruf:  python3 scripts/fetch_gebietsgliederung.py
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
from geo import utm32_to_wgs84  # noqa: E402

URL = ("https://geoportal.moenchengladbach.de/wms/Hotlinks/OpenData/"
       "Kleinraeumige_Gebietsgliederung_EPSG25832_SHAPE.zip")
LAYER = "Kleinraeumige_Gebietsgliederung_EPSG25832_SHAPE/Stadtbezirke_MG"
KATALOG = "https://open.nrw"

# Der Geoportal-Server weist die Standard-User-Agents von urllib und curl ab —
# wie schon bei open.nrw. Deshalb ein expliziter Browser-naher UA.
UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36")}
TOLERANZ_M = 30.0  # Vereinfachung in Metern (Douglas-Peucker, in UTM gerechnet)


def lade_zip():
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return zipfile.ZipFile(io.BytesIO(fh.read()))


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
            werte[name] = row[pos:pos + laenge].decode("utf-8", "replace").strip()
            pos += laenge
        zeilen.append(werte)
    return zeilen


def lies_shp_polygone(raw):
    """Minimaler Shapefile-Leser für Polygone (Shape-Typ 5).

    Liefert je Datensatz eine Liste von Ringen. Löcher (gegenläufig
    orientierte Ringe) werden verworfen — für die Bezirksflächen sind sie
    nicht relevant, und die Punkt-in-Polygon-Prüfung würde sie sonst
    fälschlich als Fläche werten.
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
            # Shapefile: äußere Ringe im Uhrzeigersinn -> negative Fläche
            # in der üblichen mathematischen Zählweise.
            flaeche = sum((ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1])
                          for k in range(len(ring) - 1)) / 2.0
            if flaeche < 0 and len(ring) >= 4:
                ringe.append(ring)
        saetze.append(ringe)
    return saetze


def simplify(pts, tol):
    """Douglas-Peucker; geschlossene Ringe werden vorher halbiert, sonst
    fällt der Ring in sich zusammen (Start- und Endpunkt sind identisch)."""
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
    z = lade_zip()
    attribute = lies_dbf(z.read(LAYER + ".dbf"))
    geometrien = lies_shp_polygone(z.read(LAYER + ".shp"))
    if len(attribute) != len(geometrien):
        raise SystemExit("Attribute (%d) und Geometrien (%d) passen nicht zusammen"
                         % (len(attribute), len(geometrien)))

    bezirke = []
    for attr, ringe_utm in zip(attribute, geometrien):
        ringe = []
        for ring in ringe_utm:
            vereinfacht = simplify(ring, TOLERANZ_M)
            wgs = [utm32_to_wgs84(e, n) for e, n in vereinfacht]
            ringe.append([[round(lon, 5), round(lat, 5)] for lat, lon in wgs])
        bezirke.append({
            "name": attr.get("Name", "?"),
            "nummer": int(attr.get("Nummer") or 0),
            "flaecheKm2": round(float(attr.get("SHAPE_STAr") or 0) / 1e6, 2),
            "ringe": ringe,
        })
    bezirke.sort(key=lambda b: b["nummer"])
    if len(bezirke) != 4:
        raise SystemExit("erwartet: 4 Stadtbezirke, erhalten: %d" % len(bezirke))

    path = os.path.join(OUT, "mg_stadtbezirke.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "Stadt Mönchengladbach — Kleinräumige Gebietsgliederung (Geoportal)",
                "quelle_url": KATALOG,
                "datei": URL,
                "ebene": "Stadtbezirke (die Datei enthält zusätzlich Stadtteile, "
                         "statistische Bezirke und Baublöcke)",
                "crs_quelle": "EPSG:25832 (ETRS89 / UTM 32N), umgerechnet nach WGS84",
                "vereinfachung": "Douglas-Peucker, Toleranz %.0f m" % TOLERANZ_M,
                "abruf": datetime.date.today().isoformat(),
            },
            "bezirke": bezirke,
        }, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for b in bezirke:
        print("   %d %-6s %6.2f km² · %d Ring(e), %d Punkte"
              % (b["nummer"], b["name"], b["flaecheKm2"], len(b["ringe"]),
                 sum(len(r) for r in b["ringe"])))
    print("   Gesamtfläche %.2f km²" % sum(b["flaecheKm2"] for b in bezirke))


if __name__ == "__main__":
    main()
