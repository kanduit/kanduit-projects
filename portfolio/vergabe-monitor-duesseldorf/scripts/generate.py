# -*- coding: utf-8 -*-
"""
generate.py — aggregate the filtered notice snapshots (data/sources/
notices-YYYY-MM.json, written by scripts/fetch_notices.py) into data.js
for the Kanduit Vergabe-Monitor Düsseldorf.

Run:  python3 scripts/generate.py     (from the vergabe-monitor folder)

All inputs are public eForms-DE notices from the Bekanntmachungsservice
(Datenservice Öffentlicher Einkauf). No personal data. Winner/company names
are not present in the snapshots and therefore cannot appear in the output.

Output: data.js — window.KANDUIT_VERGABE = {meta, cities, dauern, radar, …}
"""
import glob
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

# Official population, IT.NRW, Stand 31.12.2024 (Basis Zensus 2022):
# https://www.it.nrw/nrw-einwohnerzahl-erstmals-auf-basis-des-zensus-2022-fortgeschrieben
CITIES = {
    "DEA11": {"name": "Düsseldorf", "einwohner": 618685},
    "DEA23": {"name": "Köln", "einwohner": 1024621},
    "DEA13": {"name": "Essen", "einwohner": 574682},
    "DEA52": {"name": "Dortmund", "einwohner": 603462},
}

PROC_LABEL = {
    "open": "Offenes Verfahren",
    "restricted": "Nicht offenes Verfahren",
    "neg-w-call": "Verhandlungsverf. mit Teilnahmewettbewerb",
    "neg-wo-call": "Verhandlungsverf. ohne Teilnahmewettbewerb",
    "comp-dial": "Wettbewerblicher Dialog",
    "comp-tend": "Wettbewerb",
    "innovation": "Innovationspartnerschaft",
    "exp-int-limited": "Interessensbekundung (begrenzt)",
    "oth-single": "Sonstiges einstufiges Verfahren",
    "oth-mult": "Sonstiges mehrstufiges Verfahren",
    "us-open": "Offenes Verfahren (Sektoren)",
    "us-restricted": "Nicht offenes Verfahren (Sektoren)",
    "us-neg-w-call": "Verhandlungsverf. mit Aufruf (Sektoren)",
    "us-neg-wo-call": "Verhandlungsverf. ohne Aufruf (Sektoren)",
    None: "ohne Angabe",
}

FORM_LABEL = {
    "planning": "Vorinformation",
    "competition": "Ausschreibung",
    "result": "Zuschlag/Ergebnis",
    "dir-awa-pre": "Ex-ante-Transparenz (Direktvergabe)",
    "cont-modif": "Auftragsänderung",
}

# CPV divisions (first two digits) — short German labels
CPV_DIV = {
    "03": "Land-/Forstwirtschaft", "09": "Energie & Brennstoffe", "14": "Bergbau & Rohstoffe",
    "15": "Nahrungsmittel", "16": "Landmaschinen", "18": "Bekleidung", "19": "Leder/Textil",
    "22": "Druckerzeugnisse", "24": "Chemische Erzeugnisse", "30": "Büro- & EDV-Geräte",
    "31": "Elektrotechnik", "32": "Rundfunk/Nachrichtentechnik", "33": "Medizin & Pharma",
    "34": "Fahrzeuge & Verkehrsmittel", "35": "Sicherheits-/Feuerwehrbedarf", "37": "Musik/Sport/Spiel",
    "38": "Labor-/Präzisionsgeräte", "39": "Möbel & Ausstattung", "41": "Wasser",
    "42": "Industriemaschinen", "43": "Bergbau-/Baumaschinen", "44": "Baustoffe & Baubedarf",
    "45": "Bauarbeiten", "48": "Software", "50": "Reparatur & Wartung",
    "51": "Installationsarbeiten", "55": "Gaststätten & Beherbergung", "60": "Transport & Verkehr",
    "63": "Verkehrsnebenleistungen", "64": "Post & Telekommunikation", "65": "Versorgungswirtschaft",
    "66": "Finanz & Versicherung", "70": "Immobilien", "71": "Architektur & Ingenieurwesen",
    "72": "IT-Dienstleistungen", "73": "Forschung & Entwicklung", "75": "Öffentliche Verwaltung",
    "76": "Öl-/Gasindustrie", "77": "Garten-/Landschaftsbau", "79": "Unternehmensdienste",
    "80": "Bildung & Schulung", "85": "Gesundheit & Soziales", "90": "Abwasser/Abfall/Umwelt",
    "92": "Kultur/Sport/Erholung", "98": "Sonstige Dienstleistungen",
}

# Buyer categories: Landeshauptstadt + Beteiligungen vs. Land/Bund/Sonstige.
# City companies (Töchter/Beteiligungen) via keyword heuristics per city.
STADT_RE = {
    "DEA11": re.compile(r"landeshauptstadt d[üu]sseldorf|stadt d[üu]sseldorf", re.I),
    "DEA23": re.compile(r"stadt k[öo]ln|stadt koeln", re.I),
    "DEA13": re.compile(r"stadt essen", re.I),
    "DEA52": re.compile(r"stadt dortmund", re.I),
}
TOCHTER_RE = {
    "DEA11": re.compile(r"stadtwerke d[üu]sseldorf|rheinbahn|awista|messe d[üu]sseldorf|flughafen d[üu]sseldorf|d[üu]sseldorf congress|zoo|ipm|industrieterrains|IDR|stadtsparkasse d[üu]sseldorf|wohnungsgesellschaft d[üu]sseldorf|swd|netzgesellschaft d[üu]sseldorf|bädergesellschaft", re.I),
    "DEA23": re.compile(r"stadtwerke k[öo]ln|kvb|k[öo]lner verkehrs|rheinenergie|awb k[öo]ln|k[öo]lnmesse|flughafen k[öo]ln|geb[äa]udewirtschaft.*k[öo]ln|k[öo]lnbäder|häfen und güterverkehr|netcologne|gag immobilien|sparkasse k[öo]lnbonn|bühnen.*k[öo]ln|zoologischer garten k[öo]ln", re.I),
    "DEA13": re.compile(r"stadtwerke essen|ruhrbahn|ebe|entsorgungsbetriebe essen|messe essen|grün und gruga|allbau|sparkasse essen|immobilienwirtschaft essen|gve", re.I),
    "DEA52": re.compile(r"stadtwerke dortmund|dsw21|dew21|edg|entsorgung dortmund|messe dortmund|westfalenhallen|flughafen dortmund|sparkasse dortmund|dogewo|klinikum dortmund", re.I),
}
LAND_RE = re.compile(r"\bland nrw\b|landesbetrieb|land nordrhein|landeshaupt(?!stadt)|landesamt|landeskriminalamt|landtag|ministerium|bezirksregierung|universit[äa]t|hochschule|nrw\.bank|nrw\.urban|it\.nrw|polizei|finanzverwaltung|justiz|straßen\.nrw|strassen\.nrw|bau- und liegenschaftsbetrieb|blb", re.I)
BUND_RE = re.compile(r"\bbundes|deutsche bahn|db \w|db-|autobahn gmbh|bundeswehr|zoll|agentur f[üu]r arbeit|deutsche rentenversicherung", re.I)

VALUE_CAP = 500e6  # guard against nonsense values (e.g. cent errors) in KPIs


def log(*a):
    print(*a)


def load_notices():
    seen = {}
    files = sorted(glob.glob(os.path.join(SRC, "notices-*.json")))
    if not files:
        raise SystemExit("no snapshots found — run scripts/fetch_notices.py first")
    fetched = None
    for path in files:
        blob = json.load(open(path, encoding="utf-8"))
        fetched = max(fetched or "", blob.get("fetched") or "")
        for n in blob["notices"]:
            prev = seen.get(n["id"])
            # corrections republish the same id — keep the earliest pubDate,
            # but let later versions fill in missing fields
            if prev is None:
                seen[n["id"]] = n
            else:
                early = min(filter(None, [prev.get("pubDate"), n.get("pubDate")]), default=None)
                merged = {**prev, **{k: v for k, v in n.items() if v not in (None, "")}}
                merged["pubDate"] = early
                seen[n["id"]] = merged
    return list(seen.values()), fetched, files


def quarter(d):  # 'YYYY-MM-DD' -> 'YYYY-Qn'
    return f"{d[:4]}-Q{(int(d[5:7]) - 1) // 3 + 1}"


def buyer_category(n):
    name = n.get("buyer") or ""
    nuts = n["nuts"]
    if STADT_RE[nuts].search(name):
        return "stadt"
    if TOCHTER_RE[nuts].search(name):
        return "tochter"
    if BUND_RE.search(name):
        return "bund"
    if LAND_RE.search(name):
        return "land"
    legal = n.get("buyerLegalType") or ""
    if legal == "koerp-oer-kommun":
        return "kommunal-sonst"
    return "sonstige"


def median(vals):
    vals = sorted(vals)
    if not vals:
        return None
    k = len(vals) // 2
    return vals[k] if len(vals) % 2 else round((vals[k - 1] + vals[k]) / 2, 1)


def pctl(vals, p):
    vals = sorted(vals)
    if not vals:
        return None
    i = min(len(vals) - 1, int(round(p * (len(vals) - 1))))
    return vals[i]


def main():
    notices, fetched, files = load_notices()
    months = sorted(f[-12:-5] for f in files)
    first_month, last_month = months[0], months[-1]

    today = date.fromisoformat(fetched) if fetched else date.today()
    # last complete quarter (partial quarters are excluded from time series)
    lq_end = date(today.year, 3 * ((today.month - 1) // 3) + 1, 1) - timedelta(days=1)
    last_full_q = quarter(lq_end.isoformat())

    by_city = defaultdict(list)
    for n in notices:
        n["cat"] = buyer_category(n)
        by_city[n["nuts"]].append(n)

    def q_ok(d):
        return d and quarter(d) <= last_full_q and d >= "2024-01-01"

    cities_out = {}
    for nuts, cfg in CITIES.items():
        ns = by_city.get(nuts, [])
        comp = [n for n in ns if n.get("formType") == "competition"]
        res = [n for n in ns if n.get("formType") == "result"]
        veat = [n for n in ns if n.get("formType") == "dir-awa-pre"]

        # quarterly counts (complete quarters only)
        quarters = sorted({quarter(n["pubDate"]) for n in ns if q_ok(n.get("pubDate"))})
        q_counts = []
        for q in quarters:
            in_q = [n for n in ns if n.get("pubDate") and quarter(n["pubDate"]) == q]
            q_counts.append({
                "q": q,
                "competition": sum(1 for n in in_q if n.get("formType") == "competition"),
                "result": sum(1 for n in in_q if n.get("formType") == "result"),
                "other": sum(1 for n in in_q if n.get("formType") not in ("competition", "result")),
            })

        # procedure mix (competition notices)
        proc = Counter(n.get("procedureType") for n in comp)
        proc_mix = [{"key": k or "none", "label": PROC_LABEL.get(k, k), "n": c}
                    for k, c in proc.most_common()]

        # CPV divisions (competitions; results not double-counted)
        cpv = Counter((n.get("cpv") or "")[:2] for n in comp if n.get("cpv"))
        cpv_top = [{"div": d, "label": CPV_DIV.get(d, "CPV " + d), "n": c}
                   for d, c in cpv.most_common(10)]

        # award volume where stated (capped outliers excluded from the sum, counted separately)
        vals = [n["awardValue"] for n in res if n.get("awardValue")]
        vals_ok = [v for v in vals if v <= VALUE_CAP]
        award_sum = sum(vals_ok)

        # buyer categories + top buyers (public authorities — not winners)
        cat = Counter(n["cat"] for n in ns)
        buyers = Counter((n.get("buyer") or "").strip() for n in ns if n.get("buyer"))
        top_buyers = [{"name": b, "n": c, "cat": buyer_category({"buyer": b, "nuts": nuts, "buyerLegalType": ""})}
                      for b, c in buyers.most_common(12)]

        bids = [n["bidsAvg"] for n in res if n.get("bidsAvg")]

        cities_out[nuts] = {
            **cfg,
            "nuts": nuts,
            "total": len(ns),
            "competitions": len(comp),
            "results": len(res),
            "veat": len(veat),
            "contModif": sum(1 for n in ns if n.get("formType") == "cont-modif"),
            "quarterly": q_counts,
            "procMix": proc_mix,
            "cpvTop": cpv_top,
            "awardSum": round(award_sum),
            "awardN": len(vals_ok),
            "awardOutliers": len(vals) - len(vals_ok),
            "resultsWithValue": len(vals),
            "buyerCats": dict(cat),
            "topBuyers": top_buyers,
            "distinctBuyers": len(buyers),
            "bidsMedian": median(bids),
            "bidsN": len(bids),
        }

    # ---------------- durations: competition pubDate -> result decision/pub ----
    dauern = {}
    for nuts in CITIES:
        ns = by_city.get(nuts, [])
        comp_by_proc = defaultdict(list)
        for n in ns:
            if n.get("formType") == "competition" and n.get("procedureId") and n.get("pubDate"):
                comp_by_proc[n["procedureId"]].append(n)
        pairs = []
        results = [n for n in ns if n.get("formType") == "result"]
        matched = 0
        for r in results:
            comps = comp_by_proc.get(r.get("procedureId"))
            if not comps:
                continue
            c0 = min(comps, key=lambda c: c["pubDate"])
            end = r.get("decisionDate") or r.get("pubDate")
            if not end or end < c0["pubDate"]:
                continue
            days = (date.fromisoformat(end) - date.fromisoformat(c0["pubDate"])).days
            if days > 1200:  # implausible pairing
                continue
            matched += 1
            pairs.append({"proc": c0.get("procedureType"), "days": days,
                          "endBasis": "decision" if r.get("decisionDate") else "resultPub"})
        by_proc = defaultdict(list)
        for p in pairs:
            by_proc[p["proc"]].append(p["days"])
        dauern[nuts] = {
            "results": len(results),
            "matched": matched,
            "medianAll": median([p["days"] for p in pairs]),
            "p25": pctl([p["days"] for p in pairs], .25),
            "p75": pctl([p["days"] for p in pairs], .75),
            "byProc": [{"key": k or "none", "label": PROC_LABEL.get(k, k), "n": len(v),
                        "median": median(v), "p25": pctl(v, .25), "p75": pctl(v, .75)}
                       for k, v in sorted(by_proc.items(), key=lambda kv: -len(kv[1])) if len(v) >= 5],
        }

    # ---------------- scenario: mix before/after 2026-01-01 (Düsseldorf) -------
    d11 = by_city.get("DEA11", [])
    def mix_for(pred):
        sel = [n for n in d11 if n.get("formType") == "competition" and n.get("pubDate") and pred(n["pubDate"])]
        c = Counter(n.get("procedureType") for n in sel)
        return {"n": len(sel), "mix": [{"key": k or "none", "label": PROC_LABEL.get(k, k), "n": v}
                                        for k, v in c.most_common()]}
    # half-year windows around the break for a fair per-month comparison
    szenario = {
        "vor": mix_for(lambda d: "2025-01-01" <= d <= "2025-12-31"),
        "nach": mix_for(lambda d: "2026-01-01" <= d <= (lq_end.isoformat())),
        "vorLabel": "2025 (Jan–Dez)",
        "nachLabel": f"2026 (Jan–{lq_end.strftime('%b')})".replace("Mar", "Mrz").replace("Jun", "Jun"),
        "monthlyComp": [],
        "veatMonthly": [],
    }
    monthly = Counter(n["pubDate"][:7] for n in d11 if n.get("formType") == "competition" and n.get("pubDate"))
    for m in months:
        if m <= lq_end.isoformat()[:7]:
            szenario["monthlyComp"].append({"m": m, "n": monthly.get(m, 0)})
    veat_m = Counter(n["pubDate"][:7] for n in d11 if n.get("formType") == "dir-awa-pre" and n.get("pubDate"))
    szenario["veatMonthly"] = [{"m": m, "n": veat_m.get(m, 0)} for m in months if m <= lq_end.isoformat()[:7]]

    # ---------------- Melde-Radar (schematisch): 60-Tage-Fristen ---------------
    radar_src = [n for n in d11 if n.get("formType") == "result"]
    radar_items = []
    for n in radar_src:
        basis = n.get("decisionDate") or n.get("pubDate")
        if not basis:
            continue
        frist = (date.fromisoformat(basis) + timedelta(days=60)).isoformat()
        rest = (date.fromisoformat(frist) - today).days
        if rest < -120:
            continue  # keep the radar list recent
        radar_items.append({
            "buyer": n.get("buyer") or "—",
            "cat": n["cat"],
            "basis": basis,
            "basisTyp": "Zuschlagsdatum" if n.get("decisionDate") else "Bekanntmachung Ergebnis",
            "frist": frist,
            "rest": rest,
            "value": n.get("awardValue"),
        })
    radar_items.sort(key=lambda r: r["frist"])
    radar = {
        "stand": today.isoformat(),
        "items": radar_items,
        "n90": len(radar_items),
        "offen": sum(1 for r in radar_items if r["rest"] >= 0),
        "unter14": sum(1 for r in radar_items if 0 <= r["rest"] < 14),
        "abgelaufen": sum(1 for r in radar_items if r["rest"] < 0),
        "resultsOhneDatum": sum(1 for n in radar_src if not (n.get("decisionDate") or n.get("pubDate"))),
        "mitZuschlagsdatum": sum(1 for n in radar_src if n.get("decisionDate")),
        "gesamtResults": len(radar_src),
    }

    meta = {
        "stadt": "Düsseldorf",
        "stand": today.strftime("%d.%m.%Y"),
        "zeitraum": {"von": first_month, "bis": last_month, "letztesVollesQuartal": last_full_q},
        "quellen": {
            "bkms": "https://www.oeffentlichevergabe.de",
            "api": "https://www.oeffentlichevergabe.de/documentation/swagger-ui/opendata/index.html",
            "uiDuesseldorf": "https://oeffentlichevergabe.de/ui/de/ausschreibungen_duesseldorf_kreisfreie_stadt_DEA11",
            "einwohner": "https://www.it.nrw/nrw-einwohnerzahl-erstmals-auf-basis-des-zensus-2022-fortgeschrieben",
            "einwohnerStand": "31.12.2024 (Basis Zensus 2022)",
        },
        "noticesGesamt": len(notices),
    }

    payload = {"meta": meta, "cities": cities_out, "dauern": dauern,
               "szenario": szenario, "radar": radar}

    header = (
        "/* Kanduit Vergabe-Monitor Düsseldorf — aggregierte öffentliche Bekanntmachungsdaten.\n"
        "   Quelle: Bekanntmachungsservice / Datenservice Öffentlicher Einkauf (eForms-DE),\n"
        "   https://www.oeffentlichevergabe.de — OpenData-API, Abruf siehe meta.stand.\n"
        "   Keine personenbezogenen Daten; Namen von Zuschlagsempfängern werden nicht verarbeitet.\n*/\n"
    )
    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(header + "window.KANDUIT_VERGABE = " +
                 json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")

    log(f"notices gesamt: {len(notices)}  (Monate {first_month}..{last_month})")
    for nuts, c in cities_out.items():
        log(f"  {c['name']}: {c['total']} notices, {c['competitions']} Ausschreibungen, "
            f"{c['results']} Ergebnisse, Median-Dauer {dauern[nuts]['medianAll']} Tage "
            f"({dauern[nuts]['matched']}/{dauern[nuts]['results']} Paare)")
    log(f"radar: {radar['n90']} Einträge, {radar['offen']} offen, Stand {radar['stand']}")
    log("wrote " + out)


if __name__ == "__main__":
    main()
