import datetime
import json
import os
import sqlite3
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
CACHE = os.environ.get("KANDUIT_CACHE", "/tmp/kanduit-bdh-fetch")

URL = "https://thru.de/wp-content/uploads/2026/03/prtr_2024.zip"
LANDING = "https://thru.de/downloads/"
CITIES = ("Bochum", "Dortmund", "Hagen")
YEARS = range(2015, 2025)
UA = {"User-Agent": "kanduit-anlagen-fristenmonitor-bdh/1.0 (+https://kanduit.de)"}


def get(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh, open(dest, "wb") as out:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    return dest


def db_path():
    cached = os.path.join(CACHE, "prtr_2024.db")
    if os.path.isfile(cached):
        return cached
    zpath = get(URL, os.path.join(CACHE, "prtr_2024.zip"))
    with zipfile.ZipFile(zpath) as zf:
        names = [n for n in zf.namelist() if n.endswith(".db")]
        if not names:
            raise SystemExit("prtr zip contains no .db")
        zf.extract(names[0], CACHE)
        extracted = os.path.join(CACHE, names[0])
        if extracted != cached:
            os.replace(extracted, cached)
    return cached


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()
    path = db_path()
    con = sqlite3.connect(path)
    cur = con.cursor()

    series = []
    for year in YEARS:
        n = cur.execute(
            """SELECT count(DISTINCT inspire_id) FROM betriebe
               WHERE jahr=? AND lower(bundesland)='nw' AND ort IN (?,?,?)""",
            (year,) + CITIES,
        ).fetchone()[0]
        series.append({"year": year, "n": n})

    rows = list(cur.execute(
        """SELECT id, inspire_id, jahr, postleitzahl, ort, ETRS89_x, ETRS89_y,
                  nace_code, nace_text
           FROM betriebe
           WHERE jahr=2024 AND lower(bundesland)='nw' AND ort IN (?,?,?)
           ORDER BY inspire_id""",
        CITIES,
    ))
    ids_2024 = {r[1] for r in rows}
    if len(ids_2024) != 40:
        raise SystemExit(
            "PRTR 2024 BDH unique inspire_id is %d, expected 40" % len(ids_2024)
        )

    gg = {r[0] for r in cur.execute(
        """SELECT g.betriebe_id FROM betriebe_gg g
           JOIN betriebe b ON b.id=g.betriebe_id
           WHERE b.jahr=2024 AND lower(b.bundesland)='nw' AND b.ort IN (?,?,?)""",
        CITIES,
    )}

    acts = {}
    for bid, key in cur.execute(
        """SELECT t.betriebe_id, t.prtr_schluessel FROM taetigkeiten t
           JOIN betriebe b ON b.id=t.betriebe_id
           WHERE b.jahr=2024 AND lower(b.bundesland)='nw' AND b.ort IN (?,?,?)
           ORDER BY t.betriebe_id, t.prtr_schluessel""",
        CITIES,
    ):
        acts.setdefault(bid, [])
        if key and key not in acts[bid]:
            acts[bid].append(key)

    facilities = []
    seen = set()
    for bid, inspire, year, plz, ort, lon, lat, nace, nace_text in rows:
        if inspire in seen:
            continue
        seen.add(inspire)
        facilities.append({
            "inspire_id": inspire,
            "year": year,
            "city": ort,
            "plz": plz,
            "lon": lon,
            "lat": lat,
            "nace_code": nace,
            "nace_text": nace_text,
            "activity_keys": acts.get(bid, []),
            "confidentiality_flag": bid in gg,
        })

    payload = {
        "meta": {
            "abruf": abruf,
            "quelle_url": URL,
            "landing_url": LANDING,
            "datenstand": "10.12.2025",
            "filter": "bundesland=nw AND ort IN Bochum,Dortmund,Hagen; names dropped",
            "n_2024": len(facilities),
        },
        "series": series,
        "facilities": facilities,
    }
    dest = os.path.join(OUT, "prtr_bdh.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=2)
        fh.write("\n")
    print("wrote", dest, "facilities", len(facilities), "bytes", os.path.getsize(dest))


if __name__ == "__main__":
    main()
