# -*- coding: utf-8 -*-
"""
geo.py — Koordinaten-Hilfen ohne Fremdbibliotheken.

utm32_to_wgs84(): Rueckrechnung ETRS89 / UTM Zone 32N (EPSG:25832) nach
WGS84-Laenge/Breite. Reine Mathematik, kein Netzzugriff — damit bleiben die
Fetch-Skripte stdlib-only und die Snapshots reproduzierbar.

point_in_ring()/point_in_polygon(): Ray-Casting fuer die Zuordnung eines
Standorts zu einem Stadtbezirk.
"""
import math

# GRS80 (ETRS89)
_A = 6378137.0
_F = 1.0 / 298.257222101
_K0 = 0.9996
_E2 = _F * (2 - _F)
_LON0 = math.radians(9.0)  # Mittelmeridian Zone 32


def utm32_to_wgs84(easting, northing):
    """(E, N) in EPSG:25832 -> (lat, lon) in Grad."""
    e2 = _E2
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    x = easting - 500000.0
    m = northing / _K0
    mu = m / (_A * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    ep2 = e2 / (1 - e2)
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = _A / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = _A * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * _K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = _LON0 + (
        d
        - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
    ) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lon)


def point_in_ring(lon, lat, ring):
    """Ray-Casting; ring = [[lon, lat], ...]."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            xint = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < xint:
                inside = not inside
        j = i
    return inside


def point_in_polygon(lon, lat, polygons):
    """polygons = Liste von Ringen (aeusserer Ring je Teilflaeche)."""
    for ring in polygons:
        if point_in_ring(lon, lat, ring):
            return True
    return False
