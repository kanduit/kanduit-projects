# -*- coding: utf-8 -*-
"""
fetch_notices.py — download public eForms-DE notice exports (CSV) from the
Bekanntmachungsservice / Datenservice Öffentlicher Einkauf OpenData API and
store *filtered* per-month JSON snapshots in data/sources/.

Source (public, no personal data, no auth):
  https://oeffentlichevergabe.de/api/notice-exports?pubMonth=YYYY-MM&format=csv.zip
  API docs: https://www.oeffentlichevergabe.de/documentation/swagger-ui/opendata/index.html

Filter: any place-of-performance NUTS code in NUTS_CITIES —
  DEA11 Düsseldorf, DEA23 Köln, DEA13 Essen, DEA52 Dortmund.
This mirrors the public search UI, e.g.
  https://oeffentlichevergabe.de/ui/de/ausschreibungen_duesseldorf_kreisfreie_stadt_DEA11

The full monthly zips (~17 MB each) are cached in a scratch dir and NOT
committed; only the small filtered snapshots (data/sources/notices-YYYY-MM.json)
go into the repo, so scripts/generate.py is reproducible offline.

Winner/company names are deliberately NOT extracted (Sensibilität
Korruptionsprävention — Kategorien statt Namen). Buyer organisations are
public contracting authorities and are kept.

Usage:
    python3 scripts/fetch_notices.py                 # 2024-01 .. current month
    python3 scripts/fetch_notices.py 2026-05 2026-07 # explicit range
"""
import csv
import io
import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "data", "sources")
CACHE_DIR = os.environ.get(
    "VERGABE_FETCH_CACHE",
    os.path.join(tempfile.gettempdir(), "vergabe-monitor-cache"),
)

EXPORT_URL = "https://oeffentlichevergabe.de/api/notice-exports?pubMonth={month}&format=csv.zip"
USER_AGENT = "Kanduit Vergabe-Monitor Demo (kontakt@kanduit.de)"

NUTS_CITIES = {"DEA11": "duesseldorf", "DEA23": "koeln", "DEA13": "essen", "DEA52": "dortmund"}

csv.field_size_limit(10_000_000)  # notice descriptions can be very long


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def month_range(first, last):
    y, m = int(first[:4]), int(first[5:7])
    ly, lm = int(last[:4]), int(last[5:7])
    while (y, m) <= (ly, lm):
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m > 12:
            y, m = y + 1, 1


def download(month):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{month}.csv.zip")
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        log(f"{month}: cached ({os.path.getsize(path)/1e6:.1f} MB)")
        return path
    req = urllib.request.Request(EXPORT_URL.format(month=month), headers={"User-Agent": USER_AGENT})
    log(f"{month}: downloading …")
    with urllib.request.urlopen(req, timeout=600) as resp, open(path + ".part", "wb") as fh:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)
    os.replace(path + ".part", path)
    log(f"{month}: downloaded ({os.path.getsize(path)/1e6:.1f} MB)")
    return path


def read_csv(zf, name):
    try:
        raw = zf.read(name)
    except KeyError:
        return
    with io.TextIOWrapper(io.BytesIO(raw), encoding="utf-8-sig", newline="") as fh:
        yield from csv.DictReader(fh)


def first(d, *keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, ""):
            return v
    return None


def to_num(v):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def process_month(month, zip_path):
    """Filter one monthly export down to per-notice records for our cities."""
    zf = zipfile.ZipFile(zip_path)

    # pass 1: which notices have a place of performance in one of our cities?
    city_of = {}  # noticeIdentifier -> nuts (first hit wins; multi-city is rare)
    for row in read_csv(zf, "placeOfPerformance.csv"):
        nuts = (row.get("placePerformanceCountrySubdivision") or "").strip()
        if nuts in NUTS_CITIES:
            city_of.setdefault(row["noticeIdentifier"], nuts)
    if not city_of:
        return []

    keep = set(city_of)
    notices = {}

    for row in read_csv(zf, "notice.csv"):
        nid = row["noticeIdentifier"]
        if nid not in keep:
            continue
        notices[nid] = {
            "id": nid,
            "nuts": city_of[nid],
            "procedureId": row.get("procedureIdentifier") or None,
            "formType": row.get("formType") or None,       # planning|competition|result|…
            "noticeType": row.get("noticeType") or None,   # cn-standard|can-standard|…
            "pubDate": (row.get("publicationDate") or "")[:10] or None,
            "legalBasis": row.get("procedureLegalBasis") or None,
        }

    def get(nid):
        return notices.get(nid)

    for row in read_csv(zf, "procedure.csv"):
        n = get(row["noticeIdentifier"])
        if n is not None and row.get("procedureType"):
            n["procedureType"] = row["procedureType"]

    # purpose: procedure-level row (no lotIdentifier) preferred for title/nature/value
    for row in read_csv(zf, "purpose.csv"):
        n = get(row["noticeIdentifier"])
        if n is None:
            continue
        proc_level = not row.get("lotIdentifier")
        if proc_level or "nature" not in n:
            n["nature"] = row.get("mainNature") or n.get("nature")
        est = to_num(row.get("estimatedValue"))
        if est is not None and (row.get("estimatedValueCurrency") or "EUR") == "EUR":
            if proc_level or n.get("estValue") is None:
                n["estValue"] = est

    for row in read_csv(zf, "classification.csv"):
        n = get(row["noticeIdentifier"])
        if n is None or row.get("classificationType") != "cpv":
            continue
        code = (row.get("mainClassificationCode") or "").strip()
        if code and (not row.get("lotIdentifier") or "cpv" not in n):
            n["cpv"] = code

    # award value of result notices (one row per notice)
    for row in read_csv(zf, "noticeResult.csv"):
        n = get(row["noticeIdentifier"])
        if n is None:
            continue
        val = to_num(row.get("noticeValue"))
        if val is not None and (row.get("noticeValueCurrency") or "EUR") == "EUR":
            n["awardValue"] = val

    # decision/conclusion dates (earliest per notice)
    for row in read_csv(zf, "contract.csv"):
        n = get(row["noticeIdentifier"])
        if n is None:
            continue
        dec = first(row, "winnerDecisionDate", "contractConclusionDate")
        if dec:
            dec = dec[:10]
            if not n.get("decisionDate") or dec < n["decisionDate"]:
                n["decisionDate"] = dec

    # lot results: how many lots awarded / not awarded
    for row in read_csv(zf, "procedureLotResult.csv"):
        n = get(row["noticeIdentifier"])
        if n is None:
            continue
        wc = row.get("winnerChosen") or ""
        n["lotsTotal"] = n.get("lotsTotal", 0) + 1
        if wc.startswith("selec"):
            n["lotsAwarded"] = n.get("lotsAwarded", 0) + 1

    # received submissions: max count per lot-result row ≈ total bids for that lot
    subs = {}
    for row in read_csv(zf, "receivedSubmissions.csv"):
        nid = row["noticeIdentifier"]
        if nid not in keep:
            continue
        cnt = to_num(row.get("receivedSubmissionsCount"))
        if cnt is None:
            continue
        key = (nid, row.get("procedureLotResultNumber") or "")
        subs[key] = max(subs.get(key, 0), cnt)
    per_notice = {}
    for (nid, _lot), cnt in subs.items():
        per_notice.setdefault(nid, []).append(cnt)
    for nid, counts in per_notice.items():
        n = get(nid)
        if n is not None:
            n["bidsAvg"] = round(sum(counts) / len(counts), 1)

    # Buyer organisation (role=buyer). Winner names deliberately not extracted.
    #
    # buyerId is the organisationIdentifier — usually a Leitweg-ID
    # ("05111-31001-70"). It identifies ONE Vergabestelle exactly, which name
    # matching cannot: the Düsseldorf Zentrale Vergabestelle alone appears under
    # several spellings after its Amt was renamed.
    #
    # CAUTION: the leading block of a Leitweg-ID is the Amtlicher
    # Gemeindeschlüssel of the authority's SEAT, not of its owner. Land NRW
    # bodies seated in Düsseldorf (Bau- und Liegenschaftsbetrieb, Hochschule)
    # also carry 05111. It is therefore a location signal — exactly the trap the
    # NUTS place-of-performance filter falls into — and must never be used to
    # decide who owns a buyer. Ownership is derived in generate.py from
    # buyerLegalType (official self-declaration) plus explicit ID/name rules.
    for row in read_csv(zf, "organisation.csv"):
        n = get(row["noticeIdentifier"])
        if n is None or row.get("organisationRole") != "buyer":
            continue
        if not n.get("buyer"):
            n["buyer"] = (row.get("organisationName") or "").strip() or None
            n["buyerId"] = (row.get("organisationIdentifier") or "").strip() or None
            n["buyerLegalType"] = row.get("buyerLegalType") or None
            n["buyerCity"] = (row.get("organisationCity") or "").strip() or None

    return sorted(notices.values(), key=lambda n: (n.get("pubDate") or "", n["id"]))


def main():
    args = sys.argv[1:]
    today = date.today()
    first_m = args[0] if args else "2024-01"
    last_m = args[1] if len(args) > 1 else f"{today.year:04d}-{today.month:02d}"

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for month in month_range(first_m, last_m):
        out_path = os.path.join(OUT_DIR, f"notices-{month}.json")
        zip_path = download(month)
        rows = process_month(month, zip_path)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(
                {"month": month, "fetched": today.isoformat(),
                 "source": EXPORT_URL.format(month=month), "notices": rows},
                fh, ensure_ascii=False, separators=(",", ":"))
        total += len(rows)
        log(f"{month}: kept {len(rows)} notices → {os.path.relpath(out_path, ROOT)}")
    log(f"done — {total} notices across all months")


if __name__ == "__main__":
    main()
