# -*- coding: utf-8 -*-
"""
generate.py — aggregate the filtered notice snapshots (data/sources/
notices-YYYY-MM.json, written by scripts/fetch_notices.py) into data.js
for the Kanduit Vergabe-Monitor Düsseldorf.

Run:  python3 scripts/generate.py     (from the vergabe-monitor folder)

UNIT OF ANALYSIS: the Vergabestelle (contracting authority), not the place.
--------------------------------------------------------------------------
The snapshots are collected by place of performance (NUTS DEA11 …), because
that is the only filter the public search offers. But a NUTS code says where a
service is delivered, NOT who is buying: Land NRW, Bund, Universitätsklinikum
and the Landeshauptstadt all tender for delivery in Düsseldorf and procure
independently of one another. Every headline figure in this monitor is
therefore computed per BUYER, and the place-level total is only ever shown as
the decomposition that makes that distinction visible.

Träger classification is layered, strongest evidence first:
  1. explicit buyerId (Leitweg-ID) / name rules for a city's core administration
  2. buyerLegalType — the official eForms self-declaration, whose German
     taxonomy carries -kommun / -land / -bund suffixes
  3. conservative name patterns
  4. otherwise: "nicht zuordenbar", counted and displayed, never silently bucketed

NEVER classify by the leading block of a Leitweg-ID: it is the Gemeindeschlüssel
of the authority's SEAT, so Land bodies seated in Düsseldorf also carry 05111.
That is a location signal and would reproduce the very error described above.

All inputs are public eForms-DE notices. No personal data. Winner/company names
are not present in the snapshots and therefore cannot appear in the output.
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

# ---------------------------------------------------------------- Träger rules
# Layer 1: core administration of each city (Kernverwaltung incl. Eigenbetriebe).
KERN_RE = {
    "DEA11": re.compile(r"landeshauptstadt d[üu]sseldorf|^stadt d[üu]sseldorf", re.I),
    "DEA23": re.compile(r"^stadt k[öo]ln|stadt koeln|oberb[üu]rgermeister.*k[öo]ln", re.I),
    "DEA13": re.compile(r"^stadt essen|stadt essen[ ,-]", re.I),
    "DEA52": re.compile(r"^stadt dortmund|vergabe und beschaffungszentrum dortmund|dortmund.*oberb[üu]rgermeister", re.I),
}
# Layer 1b: municipally owned companies / Beteiligungen (independent buyers,
# but municipal money — kept separate from the Kernverwaltung on purpose).
BETEILIGUNG_RE = {
    "DEA11": re.compile(r"stadtwerke d[üu]sseldorf|rheinbahn|awista|messe d[üu]sseldorf|flughafen d[üu]sseldorf|d[üu]sseldorf congress|d\.live|bädergesellschaft d[üu]sseldorf|ipm|industrieterrains|stadtsparkasse d[üu]sseldorf|netzgesellschaft d[üu]sseldorf|swd\b|holding der landeshauptstadt", re.I),
    "DEA23": re.compile(r"stadtwerke k[öo]ln|kvb|k[öo]lner verkehrs|rheinenergie|awb k[öo]ln|k[öo]lnmesse|flughafen k[öo]ln|geb[äa]udewirtschaft.*k[öo]ln|k[öo]lnb[äa]der|h[äa]fen und g[üu]terverkehr|netcologne|gag immobilien|sparkasse k[öo]lnbonn|b[üu]hnen.*k[öo]ln|zoologischer garten k[öo]ln", re.I),
    "DEA13": re.compile(r"stadtwerke essen|ruhrbahn|entsorgungsbetriebe essen|\bebe\b|messe essen|gr[üu]n und gruga|allbau|sparkasse essen|immobilienwirtschaft essen|\bgve\b", re.I),
    "DEA52": re.compile(r"stadtwerke dortmund|dsw21|dew21|\bedg\b|entsorgung dortmund|messe dortmund|westfalenhallen|flughafen dortmund|sparkasse dortmund|dogewo|klinikum dortmund", re.I),
}

# Layer 2: official eForms buyerLegalType taxonomy → Träger.
LEGALTYPE_TRAEGER = {
    "kommun-beh": "kommunal", "koerp-oer-kommun": "kommunal",
    "anst-oer-kommun": "kommunal", "stift-oer-kommun": "kommunal",
    "omu-lbeh": "land", "oberst-lbeh": "land", "koerp-oer-land": "land",
    "anst-oer-land": "land", "stift-oer-land": "land",
    "omu-bbeh": "bund", "omu-bbeh-niedrig": "bund", "oberst-bbeh": "bund",
    "koerp-oer-bund": "bund", "anst-oer-bund": "bund", "stift-oer-bund": "bund",
    "pub-undert": "unternehmen", "pub-undert-ra": "unternehmen",
    "pub-undert-cga": "unternehmen", "pub-undert-la": "unternehmen",
    "def-cont": "bund", "spec-rights-entity": "unternehmen",
}

# Layer 3: conservative name patterns (only clear-cut institutional markers).
LAND_RE = re.compile(r"\bland nrw\b|land nordrhein|landesbetrieb|landesamt|landeskriminalamt|landtag|ministerium|bezirksregierung|universit[äa]tsklinikum|universit[äa]t|hochschule|fachhochschule|nrw\.bank|nrw\.urban|it\.nrw|polizei|finanzverwaltung des landes|justizvollzug|stra[sß]en\.nrw|bau- und liegenschaftsbetrieb|\bblb\b|vergabekammer|landschaftsverband", re.I)
BUND_RE = re.compile(r"\bbundes|deutsche bahn|\bdb \w|db infrago|db netz|autobahn gmbh|bundeswehr|\bzoll\b|agentur f[üu]r arbeit|deutsche rentenversicherung|jobcenter|bundesanstalt", re.I)
UNTERNEHMEN_RE = re.compile(r"\bgmbh\b|\bag\b$|\bag \(|aktiengesellschaft|\bkg\b|mbh|e\.? ?v\.?$|gGmbH", re.I)

TRAEGER_LABEL = {
    "kern": "Kernverwaltung der Stadt",
    "beteiligung": "Städtische Beteiligungen",
    "kommunal": "Sonstige kommunale Träger",
    "land": "Land NRW & Landeseinrichtungen",
    "bund": "Bund, Bahn & Sozialversicherung",
    "unternehmen": "Öffentliche Unternehmen (Sektoren)",
    "unklar": "nicht zuordenbar",
}
TRAEGER_ORDER = ["kern", "beteiligung", "kommunal", "land", "bund", "unternehmen", "unklar"]

VALUE_CAP = 500e6  # guard against nonsense values (e.g. cent errors) in KPIs


def log(*a):
    print(*a)


def traeger_of(n):
    """Which public body owns this buyer? Layered, strongest evidence first."""
    name = (n.get("buyer") or "").strip()
    nuts = n["nuts"]
    if not name:
        return "unklar"
    if KERN_RE[nuts].search(name):
        return "kern"
    if BETEILIGUNG_RE[nuts].search(name):
        return "beteiligung"
    lt = LEGALTYPE_TRAEGER.get(n.get("buyerLegalType") or "")
    if lt:
        # a legal type of "kommunal" for a body that is not this city's own
        # administration means another municipal carrier (Kreis, Zweckverband …)
        return lt
    if BUND_RE.search(name):
        return "bund"
    if LAND_RE.search(name):
        return "land"
    if UNTERNEHMEN_RE.search(name):
        return "unternehmen"
    return "unklar"


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


def profile(ns, last_full_q):
    """Aggregate one set of notices belonging to ONE buyer group."""
    comp = [n for n in ns if n.get("formType") == "competition"]
    res = [n for n in ns if n.get("formType") == "result"]

    quarters = sorted({quarter(n["pubDate"]) for n in ns
                       if n.get("pubDate") and n["pubDate"] >= "2024-01-01"
                       and quarter(n["pubDate"]) <= last_full_q})
    q_counts = []
    for q in quarters:
        in_q = [n for n in ns if n.get("pubDate") and quarter(n["pubDate"]) == q]
        q_counts.append({
            "q": q,
            "competition": sum(1 for n in in_q if n.get("formType") == "competition"),
            "result": sum(1 for n in in_q if n.get("formType") == "result"),
            "other": sum(1 for n in in_q if n.get("formType") not in ("competition", "result")),
        })

    proc = Counter(n.get("procedureType") for n in comp)
    cpv = Counter((n.get("cpv") or "")[:2] for n in comp if n.get("cpv"))

    vals = [n["awardValue"] for n in res if n.get("awardValue")]
    vals_ok = [v for v in vals if v <= VALUE_CAP]
    bids = [n["bidsAvg"] for n in res if n.get("bidsAvg")]

    # distinct Vergabestellen inside this group (public bodies — naming is fine)
    stellen = Counter()
    ids = set()
    for n in ns:
        if n.get("buyer"):
            stellen[n["buyer"].strip()] += 1
        if n.get("buyerId"):
            ids.add(n["buyerId"])

    return {
        "total": len(ns),
        "competitions": len(comp),
        "results": len(res),
        "veat": sum(1 for n in ns if n.get("formType") == "dir-awa-pre"),
        "contModif": sum(1 for n in ns if n.get("formType") == "cont-modif"),
        "quarterly": q_counts,
        "procMix": [{"key": k or "none", "label": PROC_LABEL.get(k, k), "n": c}
                    for k, c in proc.most_common()],
        "cpvTop": [{"div": d, "label": CPV_DIV.get(d, "CPV " + d), "n": c}
                   for d, c in cpv.most_common(10)],
        "awardSum": round(sum(vals_ok)),
        "awardN": len(vals_ok),
        "resultsWithValue": len(vals),
        "bidsMedian": median(bids),
        "bidsN": len(bids),
        "topStellen": [{"name": b, "n": c} for b, c in stellen.most_common(10)],
        "distinctStellen": len(stellen),
        "distinctIds": len(ids),
    }


def durations(ns, label_lookup=PROC_LABEL, min_n=5):
    """Median days competition pubDate -> award decision, within one buyer group."""
    comp_by_proc = defaultdict(list)
    for n in ns:
        if n.get("formType") == "competition" and n.get("procedureId") and n.get("pubDate"):
            comp_by_proc[n["procedureId"]].append(n)
    results = [n for n in ns if n.get("formType") == "result"]
    pairs = []
    for r in results:
        comps = comp_by_proc.get(r.get("procedureId"))
        if not comps:
            continue
        c0 = min(comps, key=lambda c: c["pubDate"])
        end = r.get("decisionDate") or r.get("pubDate")
        if not end or end < c0["pubDate"]:
            continue
        days = (date.fromisoformat(end) - date.fromisoformat(c0["pubDate"])).days
        if days > 1200:
            continue
        pairs.append({"proc": c0.get("procedureType"), "days": days})
    by_proc = defaultdict(list)
    for p in pairs:
        by_proc[p["proc"]].append(p["days"])
    return {
        "results": len(results),
        "matched": len(pairs),
        "medianAll": median([p["days"] for p in pairs]),
        "p25": pctl([p["days"] for p in pairs], .25),
        "p75": pctl([p["days"] for p in pairs], .75),
        "byProc": [{"key": k or "none", "label": label_lookup.get(k, k), "n": len(v),
                    "median": median(v), "p25": pctl(v, .25), "p75": pctl(v, .75)}
                   for k, v in sorted(by_proc.items(), key=lambda kv: -len(kv[1])) if len(v) >= min_n],
    }


def main():
    notices, fetched, files = load_notices()
    months = sorted(f[-12:-5] for f in files)
    first_month, last_month = months[0], months[-1]

    today = date.fromisoformat(fetched) if fetched else date.today()
    lq_end = date(today.year, 3 * ((today.month - 1) // 3) + 1, 1) - timedelta(days=1)
    last_full_q = quarter(lq_end.isoformat())

    by_city = defaultdict(list)
    for n in notices:
        n["traeger"] = traeger_of(n)
        by_city[n["nuts"]].append(n)

    cities_out = {}
    for nuts, cfg in CITIES.items():
        ns = by_city.get(nuts, [])
        mix = Counter(n["traeger"] for n in ns)
        kern = [n for n in ns if n["traeger"] == "kern"]
        beteiligung = [n for n in ns if n["traeger"] == "beteiligung"]

        cities_out[nuts] = {
            **cfg,
            "nuts": nuts,
            # place level — only ever shown as the decomposition, never as a headline
            "platz": {
                "total": len(ns),
                "traegerMix": [{"key": k, "label": TRAEGER_LABEL[k], "n": mix.get(k, 0)}
                               for k in TRAEGER_ORDER if mix.get(k)],
                "kernAnteil": round(len(kern) / len(ns) * 100, 1) if ns else 0,
                "unklarAnteil": round(mix.get("unklar", 0) / len(ns) * 100, 1) if ns else 0,
            },
            # buyer level — every headline figure comes from here
            "kern": profile(kern, last_full_q),
            "beteiligung": profile(beteiligung, last_full_q),
            "dauernKern": durations(kern),
        }

    # Düsseldorf detail: named Vergabestellen behind the place total, by Träger
    d11 = by_city.get("DEA11", [])
    stellen_by_traeger = defaultdict(Counter)
    for n in d11:
        if n.get("buyer"):
            stellen_by_traeger[n["traeger"]][n["buyer"].strip()] += 1
    vergabestellen = {
        t: [{"name": b, "n": c} for b, c in stellen_by_traeger[t].most_common(8)]
        for t in TRAEGER_ORDER if stellen_by_traeger.get(t)
    }

    # competition intensity — bidder counts for the city's own procedures
    kern11 = [n for n in d11 if n["traeger"] == "kern"]
    res_with_bids = [n for n in kern11 if n.get("formType") == "result" and n.get("bidsAvg")]
    bid_buckets = Counter()
    for n in res_with_bids:
        b = n["bidsAvg"]
        key = "1" if b < 1.5 else "2" if b < 2.5 else "3-5" if b < 5.5 else "6-9" if b < 9.5 else "10+"
        bid_buckets[key] += 1
    by_cpv_bids = defaultdict(list)
    for n in res_with_bids:
        if n.get("cpv"):
            by_cpv_bids[n["cpv"][:2]].append(n["bidsAvg"])
    wettbewerb = {
        "n": len(res_with_bids),
        "resultsGesamt": sum(1 for n in kern11 if n.get("formType") == "result"),
        "median": median([n["bidsAvg"] for n in res_with_bids]),
        "buckets": [{"k": k, "n": bid_buckets.get(k, 0)} for k in ["1", "2", "3-5", "6-9", "10+"]],
        "byCpv": sorted(
            [{"div": d, "label": CPV_DIV.get(d, "CPV " + d), "n": len(v), "median": median(v)}
             for d, v in by_cpv_bids.items() if len(v) >= 8],
            key=lambda r: r["median"])[:10],
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

    payload = {"meta": meta, "cities": cities_out,
               "vergabestellen": vergabestellen, "wettbewerb": wettbewerb,
               "traegerLabel": TRAEGER_LABEL, "traegerOrder": TRAEGER_ORDER}

    header = (
        "/* Kanduit Vergabe-Monitor Düsseldorf — aggregierte öffentliche Bekanntmachungsdaten.\n"
        "   Quelle: Bekanntmachungsservice / Datenservice Öffentlicher Einkauf (eForms-DE),\n"
        "   https://www.oeffentlichevergabe.de — OpenData-API, Abruf siehe meta.stand.\n"
        "   Auswertungseinheit ist die VERGABESTELLE, nicht der Erfüllungsort:\n"
        "   NUTS-Codes sagen, wo geliefert wird, nicht wer beschafft.\n"
        "   Keine personenbezogenen Daten; Namen von Zuschlagsempfängern werden nicht verarbeitet.\n*/\n"
    )
    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(header + "window.KANDUIT_VERGABE = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")

    log(f"notices gesamt: {len(notices)}  (Monate {first_month}..{last_month})")
    for nuts, c in cities_out.items():
        p, k = c["platz"], c["kern"]
        log(f"  {c['name']}: Erfüllungsort {p['total']} → Kernverwaltung {k['total']} "
            f"({p['kernAnteil']} %), Beteiligungen {c['beteiligung']['total']}, "
            f"nicht zuordenbar {p['unklarAnteil']} % | Median-Dauer {c['dauernKern']['medianAll']} T "
            f"({c['dauernKern']['matched']}/{c['dauernKern']['results']})")
    log(f"Wettbewerb (D'dorf Kernverwaltung): Median {wettbewerb['median']} Angebote, "
        f"{wettbewerb['n']}/{wettbewerb['resultsGesamt']} Ergebnisse mit Angabe")
    log("wrote " + out)


if __name__ == "__main__":
    main()
