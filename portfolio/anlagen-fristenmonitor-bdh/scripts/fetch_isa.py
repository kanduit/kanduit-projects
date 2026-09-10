import datetime
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
CACHE = os.environ.get("KANDUIT_CACHE", "/tmp/kanduit-bdh-fetch")

URL = "https://www.lanuk.nrw.de/fileadmin/lanuv/anlagen/pdf/ISA-Jahresbericht-2024.pdf"
LANDING = "https://www.lanuk.nrw.de/themen/industrieanlagen/informationssystem-stoffe-und-anlagen-isa"
UA = {"User-Agent": "kanduit-anlagen-fristenmonitor-bdh/1.0 (+https://kanduit.de)"}

ISA = {
    "stichtag": "2024-12-31",
    "nrw": {
        "anlagen": 14301,
        "avn": 5838,
        "ied_anlagen": 2107,
        "ied_avn": 1061,
    },
    "inspections_2024": {
        "total": 1848,
        "ied": 770,
        "non_ied_genehmigung": 935,
        "nicht_genehmigung": 143,
        "maengel": 849,
        "unangekuendigt": 225,
        "delta_vs_2023_pct": -15,
    },
    "inspection_series": [
        {"year": 2015, "n": 1678},
        {"year": 2016, "n": 1746},
        {"year": 2017, "n": 1749},
        {"year": 2018, "n": 2205},
        {"year": 2019, "n": 2130},
        {"year": 2020, "n": 1702},
        {"year": 2021, "n": 1866},
        {"year": 2022, "n": 2036},
        {"year": 2023, "n": 2176},
        {"year": 2024, "n": 1848},
    ],
    "uubn": [
        {"k": "arnsberg", "t": "UUBn Arnsberg", "anlagen": 2030, "avn": 229,
         "einwohner_rb": 3570000},
        {"k": "detmold", "t": "UUBn Detmold", "anlagen": 2091, "avn": 315,
         "einwohner_rb": 2054000},
        {"k": "duesseldorf", "t": "UUBn Düsseldorf", "anlagen": 1468, "avn": 339,
         "einwohner_rb": 5203000},
        {"k": "koeln", "t": "UUBn Köln", "anlagen": 1542, "avn": 249,
         "einwohner_rb": 4472000},
        {"k": "muenster", "t": "UUBn Münster", "anlagen": 2657, "avn": 617,
         "einwohner_rb": 2635000},
    ],
    "einwohner_quelle": {
        "t": "IT.NRW, Bevölkerung der Regierungsbezirke, gerundet",
        "u": "https://www.it.nrw/statistik/eckzahlen/bevoelkerung",
        "hinweis": "Nenner ist der Regierungsbezirk, nicht die UUBn-Zuständigkeit.",
    },
}


def maybe_touch_pdf():
    dest = os.path.join(CACHE, "ISA-Jahresbericht-2024.pdf")
    if os.path.isfile(dest):
        return
    os.makedirs(CACHE, exist_ok=True)
    req = urllib.request.Request(URL, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=120) as fh, open(dest, "wb") as out:
            out.write(fh.read())
    except OSError:
        return


def main():
    os.makedirs(OUT, exist_ok=True)
    maybe_touch_pdf()
    payload = {
        "meta": {
            "abruf": datetime.date.today().isoformat(),
            "quelle_url": URL,
            "landing_url": LANDING,
            "transcribed": True,
        },
        "isa": ISA,
    }
    dest = os.path.join(OUT, "isa_2024.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=2)
        fh.write("\n")
    print("wrote", dest, "bytes", os.path.getsize(dest))


if __name__ == "__main__":
    main()
