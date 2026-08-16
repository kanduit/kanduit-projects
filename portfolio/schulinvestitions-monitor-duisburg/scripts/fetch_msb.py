# -*- coding: utf-8 -*-
"""
fetch_msb.py — Open Data des Ministeriums fuer Schule und Bildung NRW (MSB).

Erzeugt zwei kleine, gefilterte Snapshots in data/sources/:

  msb_schulen_du.json  — alle Schulen in Duisburg (Gemeindeschluessel 05112000,
      Schulbetrieb aktiv) mit Schulform, Anschrift, Rechtsform, Schuelerzahl,
      Sozialindexstufe des Landes und WGS84-Koordinate.
  msb_zeitreihe_du.json — Schulen / Schuelerinnen und Schueler / Klassen in
      Duisburg je Schuljahr und Schulform ab 2012.

Quellen:
  https://www.schulministerium.nrw/open-data
  .../BiPo/OpenData/Schuldaten/schuldaten.csv                  (Schulverzeichnis)
  .../BiPo/OpenData/Schuldaten/SchuelerGesamtZahl/anzahlen.csv (Schuelerzahlen)
  .../system/files/media/document/file/opendata2025-26.csv      (Zeitreihe)
  .../system/files/media/document/file/schulliste_sj_25_26_open_data.csv
                                                                (Sozialindexstufe)

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

AGS_DU = "05112000"      # Gemeindeschluessel Duisburg
KREIS_DU = "112"         # Kreisschluessel in der Zeitreihe (Krfr. Stadt Duisburg)
IN_BETRIEB = "1"         # Schulbetriebsschluessel: Schule in Betrieb
TRAEGER_STADT = "10054"  # Traegernummer der Stadt Duisburg als Schultraeger

# Das Schulverzeichnis fuehrt unter denselben Schluesseln auch Einrichtungen,
# die keine Schulen sind (Schulamt, Zentrum fuer schulpraktische Lehrerausbildung,
# Seminare). Die bleiben draussen — sonst waere die Standortzahl falsch.
KEINE_SCHULE = {"0A", "50", "51", "52", "56", "58"}

UA = {"User-Agent": "kanduit-schulinvestitions-monitor/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return fh.read()


def read_csv(raw, encoding, skip_sep_line=False):
    text = raw.decode(encoding)
    if skip_sep_line and text.startswith("sep="):
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
    schulen = read_csv(get(URL_SCHULDATEN), "utf-8-sig", skip_sep_line=True)
    print("lade Schuelerzahlen …")
    anzahlen = {r["Schulnummer"].strip('"'): num(r["Anzahl"].strip('"'))
                for r in read_csv(get(URL_ANZAHLEN), "utf-8-sig", skip_sep_line=True)}
    print("lade Sozialindexstufen …")
    sozial = {r["Schulnummer"]: r["Sozialindexstufe"]
              for r in read_csv(get(URL_SOZIALINDEX), "cp850")}
    print("lade Zeitreihe …")
    zeitreihe = read_csv(get(URL_ZEITREIHE), "utf-8-sig")

    # Schulform-Klartext aus der Zeitreihe ableiten, statt ihn zu erfinden.
    # Das Verzeichnis fuehrt zweistellige, die Zeitreihe einstellige Schluessel.
    formen = {}
    for r in zeitreihe:
        code, text = (r.get("SCHULFORM") or "").strip(), (r.get("SCHULFORM_Text") or "").strip()
        if code and text:
            formen[code.zfill(2)] = text

    liste = []
    keine_schule = 0
    for r in schulen:
        if r.get("Gemeindeschluessel") != AGS_DU:
            continue
        if r.get("Schulbetriebsschluessel") != IN_BETRIEB:
            continue
        form = (r.get("Schulform") or "").strip()
        if form in KEINE_SCHULE:
            keine_schule += 1
            continue
        nr = r["Schulnummer"]
        tnr = (r.get("Traegernummer") or "").strip()
        # Traegerschaft entscheidet ueber die Baulast: nur fuer die eigenen
        # Schulen investiert die Stadt. Der Landschaftsverband und die freien
        # Traeger stehen im Register, gehoeren aber nicht in den Eigenanteil.
        if tnr == TRAEGER_STADT:
            traeger = "stadt"
        elif r.get("Rechtsform") == "2":
            traeger = "privat"
        else:
            traeger = "anderer_oeffentlicher"
        e, n = num(r.get("UTMRechtswert")), num(r.get("UTMHochwert"))
        lat, lon = (None, None)
        if e and n:
            lat, lon = utm32_to_wgs84(e, n)
            lat, lon = round(lat, 6), round(lon, 6)
        liste.append({
            "nr": nr,
            "name": (r.get("Schulbezeichnung_1") or "").strip(),
            "kurz": (r.get("Kurzbezeichnung") or "").strip(),
            "form": form,
            "form_text": formen.get(form, "sonstige Schulform"),
            "strasse": (r.get("Strasse") or "").strip(),
            "plz": (r.get("PLZ") or "").strip(),
            "rechtsform": "privat" if r.get("Rechtsform") == "2" else "oeffentlich",
            "traegernr": tnr,
            "traeger": traeger,
            "betrieb_seit": (r.get("Schulbetriebsdatum") or "").strip(),
            "schueler": int(anzahlen.get(nr) or 0),
            "sozialindex": sozial.get(nr, "ohne"),
            "lat": lat,
            "lon": lon,
        })
    liste.sort(key=lambda s: s["nr"])
    if len(liste) < 100:
        raise SystemExit("unerwartet wenige Schulen (%d) — Quelle pruefen" % len(liste))

    nach_traeger = {}
    for s in liste:
        nach_traeger[s["traeger"]] = nach_traeger.get(s["traeger"], 0) + 1
    print("  Traegerschaft:", ", ".join("%s=%d" % kv for kv in sorted(nach_traeger.items())))
    if nach_traeger.get("stadt", 0) < 100:
        raise SystemExit("unerwartet wenige staedtische Schulen — Traegernummer pruefen")

    ohne_geo = [s["nr"] for s in liste if s["lat"] is None]
    ohne_soz = [s["nr"] for s in liste if s["sozialindex"] == "ohne"]
    unbekannte_form = sorted({s["form"] for s in liste if s["form"] not in formen})
    print("  %d Schulen, %d ohne Koordinate, %d ohne Sozialindexstufe"
          % (len(liste), len(ohne_geo), len(ohne_soz)))
    if unbekannte_form:
        print("  Hinweis: Schulform-Schluessel ohne Klartext in der Zeitreihe:",
              ", ".join(unbekannte_form))

    reihe = []
    for r in zeitreihe:
        if r.get("KREIS") != KREIS_DU:
            continue
        reihe.append({
            "jahr": int(r["JAHR"]),
            "form_text": (r.get("SCHULFORM_Text") or "").strip(),
            "rechtsform": "privat" if r.get("RECHTSFORM") == "2" else "oeffentlich",
            "schulen": int(num(r["SCHULEN"]) or 0),
            "schueler": int(num(r["SCHUELER_INNEN"]) or 0),
            "klassen": int(num(r["KLASSEN"]) or 0),
        })
    reihe.sort(key=lambda r: (r["jahr"], r["form_text"], r["rechtsform"]))
    if not reihe:
        raise SystemExit("Zeitreihe fuer Duisburg leer — Quelle pruefen")

    # Schuelerzahlen je kreisfreier Stadt im Basisjahr — Nenner fuer den
    # Vergleich der Startchancen-Schultraegerbudgets. Der KREIS_Text
    # ('Krfr. Stadt Duisburg') ist zugleich der Schluessel im Budget-PDF.
    basis = max(int(r["JAHR"]) for r in zeitreihe if r.get("JAHR"))
    staedte = {}
    for r in zeitreihe:
        kreis = (r.get("KREIS_Text") or "").strip()
        if not kreis.startswith("Krfr. Stadt") or int(r["JAHR"]) != basis:
            continue
        staedte[kreis] = staedte.get(kreis, 0) + int(num(r["SCHUELER_INNEN"]) or 0)
    vergleich = [{"kreis": k, "schueler": v} for k, v in sorted(staedte.items())]
    if len(vergleich) < 15:
        raise SystemExit("unerwartet wenige kreisfreie Staedte (%d) — Quelle pruefen"
                         % len(vergleich))
    print("  Vergleichsfeld: %d kreisfreie Staedte, Basisjahr %d" % (len(vergleich), basis))

    dump(os.path.join(OUT, "msb_schulen_du.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data "
                      "(Schulverzeichnis, Schuelerzahlen, Sozialindexstufen)",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_SCHULDATEN, URL_ANZAHLEN, URL_SOZIALINDEX],
            "filter": "Gemeindeschluessel %s (Duisburg), Schulbetrieb aktiv; "
                      "ohne Schulamt, ZfsL und Seminare (Schluessel %s)"
                      % (AGS_DU, ", ".join(sorted(KEINE_SCHULE))),
            "schuljahr": "2025/26",
            "abruf": stand,
            "ohne_sozialindex": len(ohne_soz),
            "ohne_koordinate": len(ohne_geo),
            "traegerschaft": nach_traeger,
            "ausgeschlossen_keine_schule": keine_schule,
            "hinweis": "Nur Einrichtungsdaten. Keine personenbezogenen Daten. "
                       "Die Sozialindexstufe ist die neunstufige Stufe des Landes "
                       "NRW (1 = geringste, 9 = hoechste Belastung); sie liegt nur "
                       "fuer allgemeinbildende Schulen vor, nicht fuer Berufskollegs.",
        },
        "schulen": liste,
    })
    dump(os.path.join(OUT, "msb_zeitreihe_du.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Open Data, "
                      "Schuelerzahlen nach Kreis und Schulform",
            "quelle_url": "https://www.schulministerium.nrw/open-data",
            "dateien": [URL_ZEITREIHE],
            "filter": "Kreis %s (Krfr. Stadt Duisburg), alle Schulformen; zusaetzlich "
                      "Schuelerzahlen aller kreisfreien Staedte im Basisjahr als "
                      "Nenner fuer den Budgetvergleich" % KREIS_DU,
            "basisjahr": basis,
            "abruf": stand,
        },
        "reihe": reihe,
        "kreisfreie_staedte": vergleich,
    })


def dump(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
