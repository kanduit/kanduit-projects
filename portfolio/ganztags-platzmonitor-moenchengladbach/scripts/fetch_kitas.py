# -*- coding: utf-8 -*-
"""
fetch_kitas.py — Kindertageseinrichtungen in Moenchengladbach aus dem
offenen Geodatenangebot des Landes NRW.

Quelle: https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/
        KiTasNRW_EPSG4326_CSV.csv

Zweck: Der Ue3-Platzbestand je Stadtbezirk ist der Vorlauf-Indikator fuer die
kuenftigen Einschulungsjahrgaenge. Er wird in der Oberflaeche ausschliesslich
aggregiert je Stadtbezirk gezeigt.

Der Snapshot enthaelt bewusst KEINE Einrichtungsnamen, Traeger, Adressen oder
Telefonnummern — nur Koordinate und Platzzahlen, damit die Bezirkszuordnung in
generate.py offline erfolgen kann.

Aufruf:  python3 scripts/fetch_kitas.py
"""
import csv
import datetime
import io
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

URL = ("https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/"
       "KiTasNRW_EPSG4326_CSV.csv")
UA = {"User-Agent": "kanduit-ganztags-platzmonitor/1.0 (+https://kanduit.de)"}


def num(s):
    try:
        return float((s or "0").replace(",", "."))
    except ValueError:
        return 0.0


def main():
    os.makedirs(OUT, exist_ok=True)
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        text = fh.read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))

    kitas = []
    for r in rows:
        if (r.get("Ort") or "").strip() != "Mönchengladbach":
            continue
        geo = (r.get("Geokoordinate") or "").split(",")
        if len(geo) != 2:
            continue
        try:
            lat, lon = float(geo[0]), float(geo[1])
        except ValueError:
            continue
        kitas.append({
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "u3": int(num(r.get("U3-Plätze"))),
            "ue3": int(num(r.get("Ü3-Plätze"))),
            "schulkinder": int(num(r.get("Plätze Schulkinder"))),
        })
    kitas.sort(key=lambda k: (k["lat"], k["lon"], k["ue3"]))
    if len(kitas) < 50:
        raise SystemExit("unerwartet wenige Kitas (%d) — Quelle pruefen" % len(kitas))

    path = os.path.join(OUT, "kitas_mg.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "Kindertageseinrichtungen in NRW — Open Data NRW (opengeodata.nrw.de)",
                "quelle_url": "https://www.opengeodata.nrw.de/produkte/bildung_wissenschaft/kitas/",
                "dateien": [URL],
                "filter": "Ort = Moenchengladbach",
                "abruf": datetime.date.today().isoformat(),
                "hinweis": ("Ohne Einrichtungsnamen, Traeger und Adressen — nur Koordinate "
                            "und Platzzahlen. Auswertung ausschliesslich je Stadtbezirk."),
            },
            "kitas": kitas,
        }, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B, %d Einrichtungen)" % (os.path.getsize(path), len(kitas)))


if __name__ == "__main__":
    main()
