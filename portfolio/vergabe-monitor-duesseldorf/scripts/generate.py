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
#
# Identifying "the city as buyer" cannot rely on the name alone: Köln's central
# procurement office publishes as plain "Amt für Recht, Vergabe und
# Versicherungen" with no city name in it at all. The reliable signal is the
# combination of the buyer's seat (organisationCity) with the official eForms
# self-declaration buyerLegalType, minus the supra-municipal bodies that happen
# to be seated in the same city.
#
# Kernverwaltung vs. Beteiligung is then decided by LEGAL FORM, because that is
# what actually differs between the cities: Düsseldorf runs its sewage works as
# an Eigenbetrieb (legally part of the city), Köln runs the same function as an
# AöR (a separate legal entity). Comparing "the city" across cities therefore
# requires both tiers — see kommunalGesamt below.
CITY_NAME = {"DEA11": "Düsseldorf", "DEA23": "Köln", "DEA13": "Essen", "DEA52": "Dortmund"}

KERN_NAME_RE = {
    "DEA11": re.compile(r"landeshauptstadt d[üu]sseldorf|^stadt d[üu]sseldorf", re.I),
    "DEA23": re.compile(r"^stadt k[öo]ln|^stadt koeln", re.I),
    "DEA13": re.compile(r"^stadt essen", re.I),
    "DEA52": re.compile(r"^stadt dortmund|^vergabe und beschaffungszentrum dortmund", re.I),
}

KOMMUNAL_LEGALTYPES = {"kommun-beh", "koerp-oer-kommun", "anst-oer-kommun", "stift-oer-kommun"}

# Municipal in legal type and seated in the city — but NOT the city itself.
# Landschaftsverbände, Zweckverbände, Kammern and joint Bund/Kommune bodies all
# carry municipal legal types and would otherwise be counted as city procurement.
NICHT_STADT_RE = re.compile(
    r"landschaftsverband|\blvr\b|\blwl\b|regionalverband|ruhrverband|emschergenossenschaft|"
    r"lippeverband|niersverband|wupperverband|linksniederrhein|"
    r"zweckverband|go\.rheinland|\bkdn\b|kopart|"
    r"kammer|innung|\bihk\b|kreishandwerkerschaft|"
    r"jobcenter|job-center|"
    r"max-planck|fraunhofer|leibniz|helmholtz|caritas|diakonie|"
    r"bundeswehr|medizinischer dienst|kassen[äa]rztliche|kassenzahn|nrw\.bank|"
    r"universit[äa]t|hochschule|klinikum der|uniklinik|"
    r"studierendenwerk|studentenwerk|verkehrsverbund|"
    r"sparkasse|versorgungskasse|zusatzversorgung", re.I)

# Legally separate entity → Beteiligung rather than Kernverwaltung.
RECHTSFORM_SEPARAT_RE = re.compile(
    r"\b(gGmbH|GmbH|mbH|AG|AöR|AoeR|eG|e\.\s?G\.|KGaA|KG|e\.\s?V\.)\b|"
    r"\bgemeinn[üu]tzige\b", re.I)


def primary_name(name):
    """Strip representation clauses so the legal form of the ACTUAL buyer is read.

    "Stadt Essen, vertreten durch die GVE … GmbH" is the city procuring, with a
    municipal company merely administering the procedure — the trailing GmbH
    must not turn the city into a Beteiligung.
    """
    return re.split(r",?\s*(?:vertreten durch|verfahrensbegleitung durch|"
                    r"handelnd durch|über\s+die)\b", name, flags=re.I)[0].strip()

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

    prim = primary_name(name)
    legal = n.get("buyerLegalType") or ""
    seat_matches = (n.get("buyerCity") or "").strip().lower() == CITY_NAME[nuts].lower()

    # Is this the city itself procuring? Either it says so in the name, or it is
    # a municipal-type buyer seated here that is not a supra-municipal body.
    ist_stadt = bool(KERN_NAME_RE[nuts].search(name)) or (
        seat_matches and legal in KOMMUNAL_LEGALTYPES and not NICHT_STADT_RE.search(name)
    )
    if ist_stadt:
        # Eigenbetrieb (no own legal personality) → part of the administration;
        # AöR / GmbH / AG → legally separate municipal company.
        return "beteiligung" if RECHTSFORM_SEPARAT_RE.search(prim) else "kern"

    lt = LEGALTYPE_TRAEGER.get(legal)
    if lt:
        # municipal legal type but not this city's own administration means
        # another municipal carrier (Kreis, Landschaftsverband, Zweckverband …)
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

        kommunal_gesamt = kern + beteiligung

        cities_out[nuts] = {
            **cfg,
            "nuts": nuts,
            # place level — only ever shown as the decomposition, never as a headline
            "platz": {
                "total": len(ns),
                "traegerMix": [{"key": k, "label": TRAEGER_LABEL[k], "n": mix.get(k, 0)}
                               for k in TRAEGER_ORDER if mix.get(k)],
                "kernAnteil": round(len(kern) / len(ns) * 100, 1) if ns else 0,
                "kommunalAnteil": round(len(kommunal_gesamt) / len(ns) * 100, 1) if ns else 0,
                "unklarAnteil": round(mix.get("unklar", 0) / len(ns) * 100, 1) if ns else 0,
            },
            # buyer level — every headline figure comes from here
            "kern": profile(kern, last_full_q),
            "beteiligung": profile(beteiligung, last_full_q),
            # legal-form-robust comparison unit: Eigenbetrieb vs. AöR differs by
            # city, so only Kernverwaltung + Beteiligungen is comparable 1:1
            "kommunal": profile(kommunal_gesamt, last_full_q),
            "dauernKern": durations(kern),
            "dauernKommunal": durations(kommunal_gesamt),
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
        # Known limits of the comparison, shown in the UI rather than hidden.
        "vergleichbarkeit": [
            "Die Städte organisieren gleiche Aufgaben in unterschiedlichen Rechtsformen: "
            "Düsseldorf führt die Stadtentwässerung als Eigenbetrieb (Teil der Verwaltung), "
            "Köln dieselbe Aufgabe als AöR (eigene Rechtsperson). Ein Vergleich nur der "
            "Kernverwaltungen benachteiligt daher Städte mit vielen ausgegliederten Betrieben — "
            "deshalb ist „Kommunal gesamt“ (Kernverwaltung + Beteiligungen) die belastbarere Größe.",
            "Zugeordnet wird über den Sitz des Auftraggebers und die amtliche eForms-Angabe zur "
            "Art des Auftraggebers. Überörtliche Träger mit kommunaler Rechtsform "
            "(Landschaftsverbände, Zweckverbände, Kammern, Jobcenter) sind ausgenommen.",
            "Bekanntmachungen ohne auswertbaren Auftraggebernamen werden als „nicht zuordenbar“ "
            "ausgewiesen und nicht geschätzt.",
            "Gezählt werden Bekanntmachungen, nicht Aufträge oder Euro-Volumen: Ein Verfahren mit "
            "vielen Losen kann mehrere Bekanntmachungen erzeugen, ein Rahmenvertrag deckt "
            "umgekehrt viele Einzelabrufe ab.",
        ],
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
