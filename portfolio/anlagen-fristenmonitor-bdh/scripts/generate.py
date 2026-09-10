import glob
import hashlib
import json
import os
import re
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

SEED = "anlagen-fristenmonitor-bdh/911-913-914"
MFA_N = 144
MFA_PER_CITY = 48
OVERLAY_N = 68
PRTR_N = 40
MAX_JS = 100_000

CITY_KEYS = ("911", "913", "914")
CITY_ORT = {"911": "Bochum", "913": "Dortmund", "914": "Hagen"}
ORT_KEY = {v: k for k, v in CITY_ORT.items()}

SIZE_BANDS = ("1–5 MW", "5–20 MW", "20–50 MW")
FUELS = ("Erdgas", "Heizöl", "Holz", "Biogas")
TYPES = ("Heizwerk", "BHKW", "Notstrom", "Prozesswärme")
PLZ = {
    "911": ("44787", "44789", "44793", "44797", "44801", "44805", "44809", "44866", "44879", "44894"),
    "913": ("44135", "44137", "44141", "44147", "44225", "44263", "44287", "44319", "44339", "44369"),
    "914": ("58089", "58091", "58093", "58095", "58097", "58099", "58119", "58135"),
}

HEADER = (
    "/* Kanduit Anlagen- und Fristenmonitor BDH — aggregierte öffentliche Daten.\n"
    "   Quellen: PRTR 2024 und EU-Registry (thru.de), ISA-Jahresbericht 2024\n"
    "   (LANUK), 44. BImSchV-Ansprechpersonen, Geobasis NRW WFS. Abruf siehe\n"
    "   meta.stand. Der MFA-Bestand nach 44. BImSchV ist eine gekennzeichnete\n"
    "   Demo-Annahme. Keine personenbezogenen Daten, keine Betreibernamen.\n*/\n"
)

QUELLEN = {
    "prtr": {
        "t": "PRTR-Betriebsdatenbank 2024 — thru.de",
        "u": "https://thru.de/wp-content/uploads/2026/03/prtr_2024.zip",
    },
    "eu": {
        "t": "Anlagenliste EU-Registry gemäß IE-RL — thru.de",
        "u": "https://thru.de/wp-content/uploads/2026/04/Anlagenliste_EU-Registry_gemaess_IE_RL_ab_2017.xlsx",
    },
    "isa": {
        "t": "ISA-Jahresbericht 2024 — LANUK NRW",
        "u": "https://www.lanuk.nrw.de/fileadmin/lanuv/anlagen/pdf/ISA-Jahresbericht-2024.pdf",
    },
    "bv44": {
        "t": "Ansprechpersonen 44. BImSchV NRW — LANUK",
        "u": "https://www.lanuk.nrw.de/fileadmin/lanuv/luft/emissionen/pdf/44_BV_Ansprechpersonen_NRW.pdf",
    },
    "gebiete": {
        "t": "Verwaltungsgrenzen Kreise/krsfr. Städte — Geobasis NRW WFS",
        "u": "https://www.wfs.nrw.de/geobasis/wfs_nw_dvg",
    },
    "bra": {
        "t": "Umweltüberwachungsplan 2026 — Bezirksregierung Arnsberg (nur zitiert)",
        "u": "https://www.bra.nrw.de/system/files/media/document/file/umweltueberwachungsplan_2026.pdf",
    },
}

ANNAHMEN = [
    {
        "k": "mfa",
        "t": "Schematischer MFA-Bestand nach 44. BImSchV",
        "d": "Demo-Annahme. Das 44.-BImSchV-Register der gemeinsamen Unteren "
             "Umweltschutzbehörde ist nicht öffentlich. Bundesweit werden rund "
             "40.000 mittelgroße Feuerungsanlagen genannt; ein Bevölkerungsanteil "
             "BDH ergäbe ~600 Anlagen und stünde neben 40 PRTR-Einrichtungen und "
             "68 EU-Betrieben unverhältnismäßig. Der Demonstrator kalibriert den "
             "Bestand deshalb auf 144 Anlagen (48 je Stadt), dreistellig und in "
             "derselben Größenordnung wie die öffentliche IED-Kulisse. "
             "Deterministisch aus dem Seed anlagen-fristenmonitor-bdh/911-913-914 "
             "(SHA-256), nicht aus random. Im Projekt durch das Amtsregister zu "
             "ersetzen.",
    },
    {
        "k": "intervalle",
        "t": "Messintervalle 0 / 12 / 36 Monate",
        "d": "Demo-Annahme. Die Zuordnung folgt einer dokumentierten Tabelle aus "
             "Leistungsklasse und Brennstoff: Holzfeuerungen 20–50 MW gelten als "
             "kontinuierlich überwacht (0 Monate, nicht in der Leitzahl); "
             "Erdgas/Biogas 1–5 MW dreijährlich (36); alle übrigen jährlich (12). "
             "Das ist eine Lesart von § 20 44. BImSchV, keine Amtsfestlegung. Im "
             "Projekt durch die tatsächlichen Überwachungsintervalle zu ersetzen.",
    },
    {
        "k": "messung",
        "t": "Letztes Messdatum je MFA",
        "d": "Demo-Annahme. lastMeasuredOn liegt nicht offen vor und wird "
             "deterministisch aus dem Anlagenseed auf ein Datum zwischen Januar "
             "2023 und Juni 2026 gelegt. Die Fälligkeit rechnet der Client: er "
             "addiert das Intervall so oft, bis die nächste Frist nach dem Stand "
             "liegt. data.js enthält keine due dates. Im Projekt durch die "
             "Messhistorie des Amtes zu ersetzen.",
    },
    {
        "k": "risiko",
        "t": "Risikofaktoren und §-52a-Gewichte",
        "d": "Demo-Annahme. Die drei Kriterien Umweltauswirkungen, Einhaltung der "
             "Rechtsvorschriften und Umgebung (§ 52a BImSchG) sind das gesetzliche "
             "Raster; die Zahlen je Anlage (u/a/o in 0–1) und die Startgewichte "
             "40/35/25 sind schematisch. Die Bezirksregierung Arnsberg veröffentlicht "
             "Beispielbewertungen im Überwachungsplan — sie werden hier zitiert, "
             "nicht eingelesen. Im Projekt durch die Risikoeinstufung der UUB zu "
             "ersetzen.",
    },
    {
        "k": "kapazitaet",
        "t": "Termine je Person und Stellenansatz",
        "d": "Demo-Annahme. 80 Messtermine je Person und Jahr, 2 Stellen im "
             "Default. Beides ist eine Gesprächsgröße für Szenario „Stelle ±1“, "
             "kein Stellenplan. Im Projekt durch Ist-Kapazität und das "
             "Überwachungsprogramm der UUB zu ersetzen.",
    },
    {
        "k": "flip",
        "t": "Intervallwechsel einer benannten Gruppe",
        "d": "Demo-Annahme. Szenario Intervallwechsel dreht Erdgas-Anlagen der "
             "Klasse 5–20 MW von jährlich auf dreijährlich (und zurück). Die Gruppe "
             "ist benannt, damit die Laständerung je Stadt nachvollziehbar bleibt. "
             "Im Projekt durch eine echte Umstufung nach 44. BImSchV zu ersetzen.",
    },
]


def load_sources(src_dir):
    out = {}
    for path in sorted(glob.glob(os.path.join(src_dir, "*.json"))):
        with open(path, encoding="utf-8") as fh:
            out[os.path.basename(path)] = json.load(fh)
    return out


def abruf_stand(src):
    dates = []
    for doc in src.values():
        meta = doc.get("meta") or {}
        a = meta.get("abruf")
        if a:
            dates.append(a)
    if not dates:
        raise SystemExit("no snapshot abruf — cannot stamp meta.stand")
    iso = max(dates)
    y, m, d = iso.split("-")
    return "%s.%s.%s" % (d, m, y), iso


def hash_stream(seed):
    n = 0
    while True:
        digest = hashlib.sha256(("%s/%d" % (seed, n)).encode("utf-8")).digest()
        n += 1
        for i in range(0, 32, 4):
            yield int.from_bytes(digest[i:i + 4], "big") / 4294967296.0


def pick(stream, seq):
    return seq[int(next(stream) * len(seq)) % len(seq)]


def inside(lon, lat, ring):
    odd = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        ):
            odd = not odd
        j = i
    return odd


def place_point(stream, ring, bbox, n=40):
    x0, y0, x1, y1 = bbox
    for _ in range(n):
        lon = x0 + next(stream) * (x1 - x0)
        lat = y0 + next(stream) * (y1 - y0)
        if inside(lon, lat, ring):
            return round(lon, 5), round(lat, 5)
    mitte_lon = round((x0 + x1) / 2, 5)
    mitte_lat = round((y0 + y1) / 2, 5)
    return mitte_lon, mitte_lat


def interval_months(size_band, fuel):
    if size_band == "20–50 MW" and fuel == "Holz":
        return 0
    if size_band == "1–5 MW" and fuel in ("Erdgas", "Biogas"):
        return 36
    return 12


def iso_from_ordinal(n):
    d = date(2023, 1, 1) + timedelta(days=int(n) % (365 * 3 + 180))
    return d.isoformat()


def hold_forward(series):
    by_year = {int(s["year"]): int(s["n"]) for s in series}
    last = by_year[2019]
    rows = []
    apes = []
    for year in range(2020, 2025):
        actual = by_year[year]
        ape = abs(actual - last) / actual if actual else 0.0
        rows.append({
            "year": year,
            "actual": actual,
            "pred": last,
            "ape": round(ape, 4),
        })
        apes.append(ape)
    mape = sum(apes) / len(apes)
    return {
        "fitVon": 2015,
        "fitBis": 2019,
        "predVon": 2020,
        "predBis": 2024,
        "hold": last,
        "mape": round(mape, 4),
        "rows": rows,
    }


def short_inspire(url):
    if not url:
        return None
    return url.rstrip("/").rsplit("/", 1)[-1]


def status_short(raw):
    if not raw:
        return "ohne Angabe"
    s = raw.lower()
    if "notregulated" in s or "nicht" in s and "ie" in s:
        return "nicht IE-RL"
    if "disused" in s or "außer" in s:
        return "außer Betrieb"
    if "functional" in s or "in betrieb" in s:
        return "in Betrieb"
    return "ohne Angabe"


def walk_keys(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield path + "." + k, k
            yield from walk_keys(v, path + "." + k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_keys(v, "%s[%d]" % (path, i))


def assert_payload(payload, blob):
    mfa = payload["populations"]["mfa44"]
    ied = payload["populations"]["publicIedPrtr"]
    if len(mfa) != MFA_N:
        raise SystemExit("MFA count %d != %d" % (len(mfa), MFA_N))
    per = {}
    for row in mfa:
        per[row["cityKey"]] = per.get(row["cityKey"], 0) + 1
        if row["intervalMonths"] not in (0, 12, 36):
            raise SystemExit("bad interval %s" % row["intervalMonths"])
        if "due" in row or "faelligAm" in row or "score" in row:
            raise SystemExit("MFA row carries a client field")
    if per != {k: MFA_PER_CITY for k in CITY_KEYS}:
        raise SystemExit("MFA per city %s" % per)
    if len(ied) != OVERLAY_N:
        raise SystemExit("overlay Betrieb count %d != %d" % (len(ied), OVERLAY_N))
    names = [r["displayName"] for r in mfa] + [r["displayName"] for r in ied]
    if len(names) != len(set(names)):
        raise SystemExit("display names are not unique across both registers")
    prtr_ids = {
        r["inspireFacilityId"] for r in ied
        if r.get("prtr2024") and r.get("inspireFacilityId")
    }
    if len(prtr_ids) != PRTR_N:
        raise SystemExit("PRTR⊆EU hits %d != %d" % (len(prtr_ids), PRTR_N))
    for r in ied:
        if "intervalMonths" in r:
            raise SystemExit("overlay row has intervalMonths")
    forb = re.compile(r"name|betrieb|mutter|strasse", re.I)
    allow_key = {"inspireFacilityId", "displayName"}
    for path, key in walk_keys(payload):
        if not forb.search(key):
            continue
        if key in allow_key or key.startswith("display"):
            continue
        if key == "name" and ".cities." in path:
            continue
        raise SystemExit("forbidden key %s at %s" % (key, path))
    n = len(blob)
    if n >= MAX_JS:
        raise SystemExit("data.js is %d bytes, cap %d" % (n, MAX_JS))


def build_mfa(geo):
    rows = []
    for key in CITY_KEYS:
        g = geo[key]
        ring = g["ringe"][0]
        bbox = g["bbox"]
        stream = hash_stream("%s/%s" % (SEED, key))
        for i in range(1, MFA_PER_CITY + 1):
            size = pick(stream, SIZE_BANDS)
            fuel = pick(stream, FUELS)
            plant = pick(stream, TYPES)
            lon, lat = place_point(stream, ring, bbox)
            rf = {
                "u": round(next(stream), 3),
                "a": round(next(stream), 3),
                "o": round(next(stream), 3),
            }
            rows.append({
                "id": "mfa-%s-%02d" % (key, i),
                "displayName": "MFA %s %d" % (CITY_ORT[key], i),
                "cityKey": key,
                "postalCode": pick(stream, PLZ[key]),
                "lon": lon,
                "lat": lat,
                "sizeBand": size,
                "fuel": fuel,
                "plantType": plant,
                "intervalMonths": interval_months(size, fuel),
                "lastMeasuredOn": iso_from_ordinal(int(next(stream) * 100000)),
                "riskFactors": rf,
            })
    rows.sort(key=lambda r: (r["cityKey"], r["id"]))
    return rows


def build_overlay(eu_rows, prtr_facilities, geo):
    prtr = {f["inspire_id"]: f for f in prtr_facilities}
    groups = {}
    for row in eu_rows:
        bid = row.get("inspire_betrieb")
        if not bid:
            continue
        groups.setdefault(bid, []).append(row)
    if len(groups) != OVERLAY_N:
        raise SystemExit("EU Betrieb grain %d != %d" % (len(groups), OVERLAY_N))
    missing = [i for i in prtr if i not in groups]
    if missing:
        raise SystemExit("PRTR not subset of EU: %d missing" % len(missing))
    if len([i for i in prtr if i in groups]) != PRTR_N:
        raise SystemExit("PRTR→EU hits != 40")

    by_city = {k: [] for k in CITY_KEYS}
    for bid, inst in groups.items():
        ort = next((r["ort"] for r in inst if r.get("ort") in ORT_KEY), None)
        key = ORT_KEY[ort]
        by_city[key].append((bid, inst))
    out = []
    for key in CITY_KEYS:
        items = sorted(by_city[key], key=lambda x: x[0])
        mitte = geo[key]["mitte"]
        for n, (bid, inst) in enumerate(items, 1):
            lat = next((r["lat"] for r in inst if r.get("lat") not in (None, "")), None)
            lon = next((r["lon"] for r in inst if r.get("lon") not in (None, "")), None)
            pr = prtr.get(bid)
            if lat is None and pr:
                lat, lon = pr["lat"], pr["lon"]
            if lat is None:
                lat, lon = mitte[1], mitte[0]
            plz = next((str(r["plz"]) for r in inst if r.get("plz")), None)
            if not plz and pr:
                plz = pr.get("plz")
            insp = 0
            n_inst = 0
            ie = None
            typ = "NONIED"
            for r in inst:
                try:
                    insp += int(r.get("inspektionen") or 0)
                except (TypeError, ValueError):
                    pass
                try:
                    n_inst += int(r.get("n_anlagen") or 0)
                except (TypeError, ValueError):
                    pass
                if r.get("inspire_anlage"):
                    n_inst = max(n_inst, 1)
                if (r.get("anlage_typ") or "").upper() == "IED":
                    typ = "IED"
                if not ie and r.get("ie_taetigkeit"):
                    ie = str(r["ie_taetigkeit"])
            if n_inst < 1:
                n_inst = len(inst)
            st = status_short(inst[0].get("status_betrieb") or inst[0].get("status"))
            prtr2024 = None
            if pr:
                text = pr.get("nace_text") or ""
                if len(text) > 48:
                    text = text[:45] + "…"
                prtr2024 = {
                    "naceCode": pr.get("nace_code"),
                    "naceText": text or None,
                    "activityKeys": pr.get("activity_keys") or [],
                    "confidentialityFlag": bool(pr.get("confidentiality_flag")),
                }
            out.append({
                "id": short_inspire(bid),
                "inspireFacilityId": bid,
                "displayName": "IED-Betrieb %s-%02d" % (key, n),
                "cityKey": key,
                "postalCode": plz,
                "lon": round(float(lon), 5),
                "lat": round(float(lat), 5),
                "typ": typ,
                "status": st,
                "ieActivity": ie,
                "insp": insp,
                "installationCount": n_inst,
                "prtr2024": prtr2024,
            })
    out.sort(key=lambda r: (r["cityKey"], r["displayName"]))
    return out


def compact_geo(geo_src):
    out = {}
    for key in CITY_KEYS:
        g = geo_src[key]
        out[key] = {
            "path": g["path"],
            "bbox": g["bbox"],
            "mitte": g["mitte"],
        }
    return out


def build_benchmark(uubn):
    rows = []
    for u in uubn:
        einw = u["einwohner_rb"]
        rows.append({
            "k": u["k"],
            "t": u["t"],
            "anlagen": u["anlagen"],
            "avn": u["avn"],
            "einwohnerRb": einw,
            "je1000": round(u["anlagen"] / (einw / 1000.0), 2),
        })
    by_n = sorted(rows, key=lambda r: (-r["anlagen"], r["k"]))
    by_k = sorted(rows, key=lambda r: (-r["je1000"], r["k"]))
    rank_n = {r["k"]: i + 1 for i, r in enumerate(by_n)}
    rank_k = {r["k"]: i + 1 for i, r in enumerate(by_k)}
    for r in rows:
        r["rangAnlagen"] = rank_n[r["k"]]
        r["rangJe1000"] = rank_k[r["k"]]
    rows.sort(key=lambda r: r["rangAnlagen"])
    return {
        "n": len(rows),
        "arnsbergRangAnlagen": rank_n["arnsberg"],
        "arnsbergRangJe1000": rank_k["arnsberg"],
        "rows": rows,
    }


def build_payload(src):
    prtr = src["prtr_bdh.json"]
    eu = src["eu_registry_bdh.json"]
    isa_doc = src["isa_2024.json"]
    geo_doc = src["gebiete_bdh.json"]
    isa = isa_doc["isa"]
    geo = geo_doc["cities"]
    stand, stand_iso = abruf_stand(src)

    mfa = build_mfa(geo)
    overlay = build_overlay(eu["rows"], prtr["facilities"], geo)
    hf = hold_forward(prtr["series"])
    bench = build_benchmark(isa["uubn"])

    abgleich = [
        {
            "k": "isa",
            "t": "ISA 2024 UUBn Arnsberg",
            "n": 2030,
            "d": "2.030 genehmigungsbedürftige Anlagen plus 229 AVN. Gilt für alle "
                 "Kreise und kreisfreien Städte im Bezirk, nicht für BDH allein.",
        },
        {
            "k": "eu",
            "t": "EU-Registry Betriebe BDH 2024",
            "n": 68,
            "d": "68 eindeutige inspire_betrieb in Bochum, Dortmund und Hagen, "
                 "Bundesland NW. IED-Maßstab, nicht 44. BImSchV.",
        },
        {
            "k": "prtr",
            "t": "PRTR 2024 Einrichtungen BDH",
            "n": 40,
            "d": "40 eindeutige inspire_id, alle 40 finden sich in der EU-Liste. "
                 "Berichtsjahr 2024, Namen entfernt.",
        },
        {
            "k": "mfa",
            "t": "schematischer MFA-Bestand 44. BImSchV",
            "n": 144,
            "d": "Demo-Annahme, 48 je Stadt. Nicht öffentlich, nicht die IED-Kulisse.",
        },
    ]

    payload = {
        "meta": {
            "stand": stand,
            "standIso": stand_iso,
            "quellen": QUELLEN,
        },
        "annahmen": ANNAHMEN,
        "cities": {
            k: {"name": CITY_ORT[k], "municipalityKey": geo[k]["municipalityKey"]}
            for k in CITY_KEYS
        },
        "populations": {
            "mfa44": mfa,
            "publicIedPrtr": overlay,
        },
        "config": {
            "defaultWeights": {"umwelt": 40, "adherence": 35, "umgebung": 25},
            "flipGruppe": {
                "k": "erdgas_5_20",
                "t": "Erdgas-Anlagen 5–20 MW",
                "brennstoff": "Erdgas",
                "mw": "5–20 MW",
            },
            "termineProPersonJahr": 80,
            "stellenDefault": 2,
            "horizonMonths": 12,
            "grenzwertbeginn": "2025-01-01",
        },
        "evidence": {
            "prtrFacilitySeries": prtr["series"],
            "prtrHoldForward": hf,
            "isa2024": {
                "stichtag": isa["stichtag"],
                "nrwAnlagen": isa["nrw"]["anlagen"],
                "nrwAvn": isa["nrw"]["avn"],
                "iedAnlagen": isa["nrw"]["ied_anlagen"],
                "uubnArnsbergAnlagen": 2030,
                "uubnArnsbergAvn": 229,
                "inspections": isa["inspections_2024"],
            },
            "isaInspectionSeries": isa["inspection_series"],
            "abgleich": abgleich,
            "benchmark": bench,
        },
        "geography": {"cities": compact_geo(geo)},
    }
    return payload


def write_data_js(payload):
    blob = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    raw = (HEADER + "window.KANDUIT_BDH = " + blob + ";\n").encode("utf-8")
    assert_payload(payload, raw)
    out = os.path.join(ROOT, "data.js")
    with open(out, "wb") as fh:
        fh.write(raw)
    print("wrote", out, "bytes", len(raw))
    return len(raw)


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    if not files:
        raise SystemExit("no snapshots found — run scripts/fetch_<quelle>.py first")
    src = load_sources(SRC)
    need = ("prtr_bdh.json", "eu_registry_bdh.json", "isa_2024.json",
            "gebiete_bdh.json", "bv44_bdh.json")
    missing = [n for n in need if n not in src]
    if missing:
        raise SystemExit("missing snapshots: " + ", ".join(missing))
    payload = build_payload(src)
    write_data_js(payload)
    mfa = payload["populations"]["mfa44"]
    mix = {0: 0, 12: 0, 36: 0}
    for r in mfa:
        mix[r["intervalMonths"]] += 1
    print("MFA intervals", mix, "overlay", len(payload["populations"]["publicIedPrtr"]))


if __name__ == "__main__":
    main()
