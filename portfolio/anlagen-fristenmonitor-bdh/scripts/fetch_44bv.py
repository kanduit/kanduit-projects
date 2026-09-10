import datetime
import json
import os
import re
import urllib.request
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")
CACHE = os.environ.get("KANDUIT_CACHE", "/tmp/kanduit-bdh-fetch")

URL = ("https://www.lanuk.nrw.de/fileadmin/lanuv/luft/emissionen/pdf/"
       "44_BV_Ansprechpersonen_NRW.pdf")
LANDING = "https://www.lanuk.nrw.de/themen/luft/emissionen"
UA = {"User-Agent": "kanduit-anlagen-fristenmonitor-bdh/1.0 (+https://kanduit.de)"}

CITIES = {
    "911": "Bochum",
    "913": "Dortmund",
    "914": "Hagen",
}


def get_pdf():
    dest = os.path.join(CACHE, "44_BV_Ansprechpersonen_NRW.pdf")
    if os.path.isfile(dest):
        return dest
    os.makedirs(CACHE, exist_ok=True)
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as fh, open(dest, "wb") as out:
        out.write(fh.read())
    return dest


def pdf_text(path):
    raw = open(path, "rb").read()
    chunks = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", raw, re.S):
        blob = m.group(1)
        try:
            blob = zlib.decompress(blob)
        except zlib.error:
            pass
        try:
            text = blob.decode("latin-1")
        except UnicodeDecodeError:
            continue
        parts = re.findall(r"\((?:\\.|[^\\)])*\)", text)
        line = []
        for p in parts:
            s = p[1:-1]
            s = s.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ")
            s = re.sub(r"\\(\d{3})", lambda x: chr(int(x.group(1), 8)), s)
            s = s.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
            line.append(s)
        if line:
            chunks.append(" ".join(line))
    return "\n".join(chunks)


def main():
    os.makedirs(OUT, exist_ok=True)
    path = get_pdf()
    text = pdf_text(path)
    found = sorted(set(re.findall(r"\b(911|913|914)\b", text)))
    if found != ["911", "913", "914"]:
        raise SystemExit("44. BImSchV PDF missing keys %s" % found)
    gemeinsame = (
        "gemeinsame Untere Umweltschutzbehörde der Städte Bochum, Dortmund und Hagen"
    )
    payload = {
        "meta": {
            "abruf": datetime.date.today().isoformat(),
            "quelle_url": URL,
            "landing_url": LANDING,
            "hinweis": "Personennamen und Straßen aus dem Snapshot entfernt.",
        },
        "gebiete": [
            {"schluessel": k, "stadt": CITIES[k], "behoerde": gemeinsame}
            for k in found
        ],
        "sitz": {"ort": "Hagen", "plz": "58095"},
    }
    dest = os.path.join(OUT, "bv44_bdh.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=2)
        fh.write("\n")
    print("wrote", dest, "gebiete", found, "bytes", os.path.getsize(dest))


if __name__ == "__main__":
    main()
