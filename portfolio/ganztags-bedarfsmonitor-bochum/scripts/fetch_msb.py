# -*- coding: utf-8 -*-
"""
fetch_msb.py — Open Data des Ministeriums fuer Schule und Bildung NRW (MSB).

Zwei Snapshots:

  msb_grundschulen_bo.json — amtliches Schulverzeichnis der Bochumer Grund-
      schulen (Gemeindeschluessel 05911000, Schulform 02, Schulbetrieb aktiv)
      mit Anschrift, Rechtsform, Schuelerzahl, Sozialindexstufe des Landes und
      WGS84-Koordinate.
  msb_zeitreihe_bo.json    — Grundschulen, Schuelerinnen und Schueler sowie
      Klassen in Bochum je Schuljahr ab 2012.

Wozu das Verzeichnis neben dem Bezirksdatensatz der Stadt gebraucht wird: Die
drei oeffentlich kursierenden Schulzahlen widersprechen sich. Die Stadt spricht
in ihrer Pressemitteilung von 49 Grundschulen, ihr eigener Kartendienst fuehrt
47 Grundschulbezirke, das Landesverzeichnis 46 Schulen in Betrieb. Erst der
Abgleich zeigt, dass es sich um drei verschiedene Zaehlweisen handelt
(Teilstandorte, Ersatzschulen, Betriebsstatus) und nicht um einen Fehler. Der
Demonstrator rechnet das im Reiter „Daten & Methode“ offen vor.

Quellen:
  https://www.schulministerium.nrw/open-data
  .../BiPo/OpenData/Schuldaten/schuldaten.csv                   (Verzeichnis)
  .../BiPo/OpenData/Schuldaten/SchuelerGesamtZahl/anzahlen.csv  (Schuelerzahlen)
  .../system/files/media/document/file/opendata2025-26.csv       (Zeitreihe)
  .../system/files/media/document/file/schulliste_sj_25_26_open_data.csv
                                                                (Sozialindex)

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

AGS_BO = "05911000"      # Gemeindeschluessel Bochum
KREIS_BO = "911"         # Kreisschluessel in der Zeitreihe
SCHULFORM_GS = "02"      # Grundschule
IN_BETRIEB = "1"         # Schulbetriebsschluessel: Schule in Betrieb

UA = {"User-Agent": "kanduit-ganztags-bedarfsmonitor/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=240) as fh:
        return fh.read()


def read_csv(roh, kodierung, sep_zeile=False):
    text = roh.decode(kodierung)
    if sep_zeile and text.startswith("sep="):
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
    schulen = read_csv(get(URL_SCHULDATEN), "utf-8-sig", sep_zeile=True)
    print("lade Schuelerzahlen …")
    anzahlen = {r["Schulnummer"].strip('"'): num(r["Anzahl"].strip('"'))
                for r in read_csv(get(URL_ANZAHLEN), "utf-8-sig", sep_zeile=True)}
    print("lade Sozialindexstufen …")
    sozial = {r["Schulnummer"]: r["Sozialindexstufe"]
              for r in read_csv(get(URL_SOZIALINDEX), "cp850")}
    print("lade Zeitreihe …")
    zeitreihe = read_csv(get(URL_ZEITREIHE), "utf-8-sig")

    gs = []
    for r in schulen:
        if r.get("Gemeindeschluessel") != AGS_BO:
            continue
        if r.get("Schulform") != SCHULFORM_GS:
            continue
        if r.get("Schulbetriebsschluessel") != IN_BETRIEB:
            continue
        nr = r["Schulnummer"]
        e, n = num(r.get("UTMRechtswert")), num(r.get("UTMHochwert"))
        lat = lon = None
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
            "lat": lat, "lon": lon,
        })
    gs.sort(key=lambda s: s["nr"])
    if len(gs) < 30:
        raise SystemExit("unerwartet wenige Grundschulen (%d) — Quelle pruefen" % len(gs))

    reihe = []
    for r in zeitreihe:
        if r.get("KREIS") != KREIS_BO or r.get("SCHULFORM_Text") != "Grundschule":
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
        raise SystemExit("Zeitreihe fuer Bochum leer — Quelle pruefen")

    dump(os.path.join(OUT, "msb_grundschulen_bo.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data "
                      "(Schulverzeichnis, Schuelerzahlen, Sozialindexstufen)",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_SCHULDATEN, URL_ANZAHLEN, URL_SOZIALINDEX],
            "filter": "Gemeindeschluessel %s, Schulform 02 (Grundschule), "
                      "Schulbetrieb aktiv" % AGS_BO,
            "schuljahr": "2025/26",
            "abruf": stand,
            "hinweis": "Nur Einrichtungsdaten. Keine personenbezogenen Daten. "
                       "Die Sozialindexstufe ist die neunstufige Stufe des "
                       "Landes NRW (1 = geringste, 9 = hoechste Belastung); "
                       "sie steuert Lehrerstellen, nicht Ganztagsplaetze.",
        },
        "schulen": gs,
    })
    dump(os.path.join(OUT, "msb_zeitreihe_bo.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data, "
                      "Schuelerzahlen nach Kreis und Schulform",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_ZEITREIHE],
            "filter": "Kreis %s (Krfr. Stadt Bochum), Schulform Grundschule" % KREIS_BO,
            "abruf": stand,
        },
        "reihe": reihe,
    })

    oeff = sum(1 for s in gs if s["rechtsform"] == "oeffentlich")
    print("   %d Grundschulen in Betrieb (%d oeffentlich, %d privat), "
          "%d Schuelerinnen und Schueler"
          % (len(gs), oeff, len(gs) - oeff, sum(s["schueler"] for s in gs)))


def dump(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True,
                  separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
