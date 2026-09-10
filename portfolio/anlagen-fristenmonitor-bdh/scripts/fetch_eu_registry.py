import datetime
import json
import os
import re
import urllib.request
import zipfile
from xml.etree.ElementTree import iterparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
CACHE = os.environ.get("KANDUIT_CACHE", "/tmp/kanduit-bdh-fetch")

URL = ("https://thru.de/wp-content/uploads/2026/04/"
       "Anlagenliste_EU-Registry_gemaess_IE_RL_ab_2017.xlsx")
LANDING = "https://thru.de/downloads/"
CITIES = {"Bochum", "Dortmund", "Hagen"}
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
COL_RE = re.compile(r"([A-Z]+)(\d+)")
UA = {"User-Agent": "kanduit-anlagen-fristenmonitor-bdh/1.0 (+https://kanduit.de)"}

KEEP = {
    "Berichtsjahr": "jahr",
    "Adresse_Ort": "ort",
    "Adresse_PLZ": "plz",
    "Bundesland": "bundesland",
    "Koordinaten.Anlage_geo_lat_ETRS89": "lat",
    "Koordinaten.Anlage_geo_long_ETRS89": "lon",
    "Anlage_Typ": "anlage_typ",
    "IE_RL_Haupttaetigkeit_Nr_Anh_I": "ie_taetigkeit",
    "Betrieb_Typ": "betrieb_typ",
    "Status.Anlage": "status",
    "InspireID.Anlage": "inspire_anlage",
    "Inspektionen_Anzahl": "inspektionen",
    "Anzahl_Anlagen": "n_anlagen",
    "InspireID.Betrieb": "inspire_betrieb",
    "Status.Betrieb": "status_betrieb",
}


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


def col_key(ref):
    m = COL_RE.match(ref or "")
    return m.group(1) if m else ""


def load_shared_strings(zf):
    ss = []
    for _ev, el in iterparse(zf.open("xl/sharedStrings.xml"), events=("end",)):
        if el.tag == NS + "si":
            ss.append("".join(t.text or "" for t in el.iter(NS + "t")))
            el.clear()
    return ss


def cell_value(el, ss):
    t = el.attrib.get("t")
    v = el.find(NS + "v")
    if v is None or v.text is None:
        is_el = el.find(NS + "is")
        if is_el is not None:
            return "".join(x.text or "" for x in is_el.iter(NS + "t"))
        return None
    raw = v.text
    if t == "s":
        return ss[int(raw)]
    if t == "b":
        return raw == "1"
    if t in (None, "n"):
        if "." in raw or "e" in raw.lower():
            return float(raw)
        try:
            return int(raw)
        except ValueError:
            return raw
    return raw


def parse_rows(xlsx_path):
    with zipfile.ZipFile(xlsx_path) as zf:
        ss = load_shared_strings(zf)
        headers = None
        row = {}
        out = []
        for _ev, el in iterparse(zf.open("xl/worksheets/sheet3.xml"), events=("end",)):
            if el.tag == NS + "c":
                k = col_key(el.attrib.get("r", ""))
                if k:
                    row[k] = cell_value(el, ss)
                el.clear()
            elif el.tag == NS + "row":
                if headers is None:
                    headers = row
                    row = {}
                    el.clear()
                    continue
                rec = {}
                for col, header in headers.items():
                    if header in KEEP:
                        rec[KEEP[header]] = row.get(col)
                jahr = rec.get("jahr")
                try:
                    jahr = int(jahr)
                except (TypeError, ValueError):
                    jahr = None
                bl = str(rec.get("bundesland") or "").strip().upper()
                ort = rec.get("ort")
                if jahr == 2024 and bl == "NW" and ort in CITIES:
                    rec["jahr"] = jahr
                    out.append(rec)
                row = {}
                el.clear()
        return out


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()
    xlsx = get(URL, os.path.join(CACHE, "eu_registry.xlsx"))
    rows = parse_rows(xlsx)
    n_betrieb = len({r["inspire_betrieb"] for r in rows if r.get("inspire_betrieb")})
    payload = {
        "meta": {
            "abruf": abruf,
            "quelle_url": URL,
            "landing_url": LANDING,
            "filter": "jahr=2024 AND bundesland=NW AND ort in Bochum,Dortmund,Hagen; names dropped",
            "n_rows": len(rows),
            "n_betrieb": n_betrieb,
        },
        "rows": rows,
    }
    dest = os.path.join(OUT, "eu_registry_bdh.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=2)
        fh.write("\n")
    print("wrote", dest, "rows", len(rows), "betrieb", n_betrieb,
          "bytes", os.path.getsize(dest))


if __name__ == "__main__":
    main()
