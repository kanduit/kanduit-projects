# -*- coding: utf-8 -*-
"""
fetch_msb.py — Open Data des Ministeriums fuer Schule und Bildung NRW (MSB).

Erzeugt zwei kleine, gefilterte Snapshots in data/sources/:

  msb_grundschulen_mg.json — die Grundschulen in Moenchengladbach
      (Gemeindeschluessel 05116000, Schulform 02, in Betrieb) mit Anschrift,
      Traegerform, Schuelerzahl und WGS84-Koordinate.
  msb_zeitreihe_mg.json    — Grundschulen / Schueler / Klassen in
      Moenchengladbach je Schuljahr 2012 ff.

Quellen:
  https://www.schulministerium.nrw/open-data
  .../BiPo/OpenData/Schuldaten/schuldaten.csv                 (Schulverzeichnis)
  .../BiPo/OpenData/Schuldaten/SchuelerGesamtZahl/anzahlen.csv (Schuelerzahlen)
  .../system/files/media/document/file/opendata2025-26.csv     (Zeitreihe)
  .../system/files/media/document/file/schulliste_sj_25_26_open_data.csv
                                                               (Sozialindexstufe)

Nur Einrichtungsdaten, keine personenbezogenen Daten.
Aufruf:  python3 scripts/fetch_msb.py
"""
import csv
import datetime
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
sys.path.insert(0, HERE)
from geo import utm32_to_wgs84  # noqa: E402

BASE = "https://www.schulministerium.nrw.de/BiPo/OpenData/Schuldaten/"
SITE = "https://www.schulministerium.nrw/system/files/media/document/file/"
URL_SCHULDATEN = BASE + "schuldaten.csv"
URL_ANZAHLEN = BASE + "SchuelerGesamtZahl/anzahlen.csv"
URL_ZEITREIHE = SITE + "opendata2025-26.csv"
URL_SOZIALINDEX = SITE + "schulliste_sj_25_26_open_data.csv"

AGS_MG = "05116000"      # Gemeindeschluessel Moenchengladbach
KREIS_MG = "116"         # Kreisschluessel in der Zeitreihe
SCHULFORM_GS = "02"      # Grundschule
IN_BETRIEB = "1"         # Schulbetriebsschluessel: Schule in Betrieb

UA = {"User-Agent": "kanduit-ganztags-platzmonitor/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as fh:
        return fh.read()


def read_csv(raw, encoding, skip_sep_line=False):
    text = raw.decode(encoding)
    if skip_sep_line and text.startswith("sep="):
        text = text.split("\n", 1)[1]
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def num(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def main():
    os.makedirs(OUT, exist_ok=True)
    stand = datetime.date.today().isoformat()

    print("lade Schulverzeichnis …")
    schulen = read_csv(get(URL_SCHULDATEN), "utf-8-sig", skip_sep_line=True)
    print("lade Schuelerzahlen …")
    anzahlen = {r["Schulnummer"].strip('"'): num(r["Anzahl"].strip('"'))
                for r in read_csv(get(URL_ANZAHLEN), "utf-8-sig", skip_sep_line=True)}
    print("lade Sozialindexstufen …")
    sozial = {r["Schulnummer"]: r["Sozialindexstufe"]
              for r in read_csv(get(URL_SOZIALINDEX), "cp850")}
    print("lade Zeitreihe …")
    zeitreihe = read_csv(get(URL_ZEITREIHE), "utf-8-sig")

    gs = []
    for r in schulen:
        if r.get("Gemeindeschluessel") != AGS_MG:
            continue
        if r.get("Schulform") != SCHULFORM_GS:
            continue
        if r.get("Schulbetriebsschluessel") != IN_BETRIEB:
            continue
        nr = r["Schulnummer"]
        e, n = num(r.get("UTMRechtswert")), num(r.get("UTMHochwert"))
        lat, lon = (None, None)
        if e and n:
            lat, lon = utm32_to_wgs84(e, n)
            lat, lon = round(lat, 6), round(lon, 6)
        gs.append({
            "nr": nr,
            "name": (r.get("Schulbezeichnung_1") or "").strip(),
            "strasse": (r.get("Strasse") or "").strip(),
            "plz": (r.get("PLZ") or "").strip(),
            "rechtsform": "privat" if r.get("Rechtsform") == "2" else "oeffentlich",
            "betrieb_seit": (r.get("Schulbetriebsdatum") or "").strip(),
            "schueler": int(anzahlen.get(nr) or 0),
            "sozialindex": sozial.get(nr, "ohne"),
            "lat": lat,
            "lon": lon,
        })
    gs.sort(key=lambda s: s["nr"])
    if len(gs) < 20:
        raise SystemExit("unerwartet wenige Grundschulen (%d) — Quelle pruefen" % len(gs))
    missing = [s["nr"] for s in gs if s["lat"] is None or not s["schueler"]]
    if missing:
        print("  Hinweis: ohne Koordinate/Schuelerzahl:", ", ".join(missing))

    reihe = []
    for r in zeitreihe:
        if r.get("KREIS") != KREIS_MG or r.get("SCHULFORM_Text") != "Grundschule":
            continue
        reihe.append({
            "jahr": int(r["JAHR"]),
            "rechtsform": "privat" if r.get("RECHTSFORM") == "2" else "oeffentlich",
            "schulen": int(num(r["SCHULEN"]) or 0),
            "schueler": int(num(r["SCHUELER_INNEN"]) or 0),
            "klassen": int(num(r["KLASSEN"]) or 0),
        })
    reihe.sort(key=lambda r: (r["jahr"], r["rechtsform"]))
    if not reihe:
        raise SystemExit("Zeitreihe fuer Moenchengladbach leer — Quelle pruefen")

    dump(os.path.join(OUT, "msb_grundschulen_mg.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data (Schulverzeichnis, Schuelerzahlen, Sozialindexstufen)",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_SCHULDATEN, URL_ANZAHLEN, URL_SOZIALINDEX],
            "filter": "Gemeindeschluessel %s, Schulform 02 (Grundschule), Schulbetrieb aktiv" % AGS_MG,
            "schuljahr": "2025/26",
            "abruf": stand,
            "hinweis": "Nur Einrichtungsdaten. Keine personenbezogenen Daten.",
        },
        "schulen": gs,
    })
    dump(os.path.join(OUT, "msb_zeitreihe_mg.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data, Schuelerzahlen nach Kreis und Schulform",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_ZEITREIHE],
            "filter": "Kreis %s (Krfr. Stadt Moenchengladbach), Schulform Grundschule" % KREIS_MG,
            "abruf": stand,
        },
        "reihe": reihe,
    })


def dump(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
