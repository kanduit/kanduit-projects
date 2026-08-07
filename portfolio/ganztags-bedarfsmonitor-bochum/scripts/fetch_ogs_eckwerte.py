# -*- coding: utf-8 -*-
"""
fetch_ogs_eckwerte.py — stadtweite Eckwerte des Offenen Ganztags in Bochum.

Es gibt in Bochum keinen offenen Datensatz mit OGS-Plaetzen je Grundschule.
Oeffentlich belegt sind ausschliesslich vier stadtweite Zahlen, die die Stadt
im Mai 2026 zum Schuljahr 2026/27 mitgeteilt hat:

    8.397 Plaetze (2022/23: 6.659)
      292 abgelehnte Kinder (2022/23: 904)
       27 von 49 Grundschulen koennen allen angemeldeten Kindern
          einen Platz anbieten (Vorjahr: 14)

Diese vier Zahlen sind die einzige belastbare Kapazitaetsgroesse des
Demonstrators. Alles, was der Monitor je Standort an Kapazitaet zeigt, ist eine
daraus abgeleitete Verteilungsannahme und im UI als solche gekennzeichnet.

Statt die Zahlen abzutippen, laedt dieses Skript die Quelle und prueft, dass
jede von ihnen dort woertlich steht. Faellt eine Pruefung durch, bricht der
Abruf ab — dann hat sich die Quelle geaendert und der Snapshot muss neu
bewertet werden, statt still zu veralten.

Quelle: Radio Bochum, „Mehr OGS-Plaetze an Grundschulen in Bochum“,
        18.05.2026 — Bericht ueber Angaben der Stadt Bochum.
        Eine primaere Ausschussvorlage waere vorzuziehen; das
        Ratsinformationssystem liefert sie nicht maschinenlesbar. Vor jeder
        Verwendung ausserhalb dieses Demonstrators sind die Werte an der
        Vorlage des Jugendhilfeausschusses zu pruefen.

Keine personenbezogenen Daten.

Aufruf:  python3 scripts/fetch_ogs_eckwerte.py
"""
import datetime
import html
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

URL = ("https://www.radiobochum.de/artikel/"
       "mehr-ogs-plaetze-an-grundschulen-in-bochum-2651761")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}

# Feld -> (Wert, Zeichenkette, die im Artikel stehen muss)
ECKWERTE = [
    ("plaetze_2026_27", 8397, "8.397"),
    ("plaetze_2022_23", 6659, "6.659"),
    ("ablehnungen_2026_27", 292, "292"),
    ("ablehnungen_2022_23", 904, "904"),
    ("schulen_voll_versorgt", 27, "27 von insgesamt 49"),
    ("schulen_gesamt_presse", 49, "27 von insgesamt 49"),
    ("schulen_voll_versorgt_vorjahr", 14, "14 Standorten"),
]


def text_von(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as fh:
        roh = fh.read().decode("utf-8", errors="replace")
    ohne = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", roh, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", ohne)))


def main():
    os.makedirs(OUT, exist_ok=True)
    print("lade Quelle …")
    text = text_von(URL)

    werte, fehlend = {}, []
    for feld, wert, nachweis in ECKWERTE:
        if nachweis not in text:
            fehlend.append("%s (erwartet: „%s“)" % (feld, nachweis))
        werte[feld] = wert
    if fehlend:
        raise SystemExit("Quelle belegt folgende Werte nicht mehr:\n  "
                         + "\n  ".join(fehlend))

    payload = {
        "meta": {
            "quelle": "Radio Bochum, „Mehr OGS-Plaetze an Grundschulen in "
                      "Bochum“, 18.05.2026 — Bericht ueber Angaben der Stadt "
                      "Bochum",
            "quelle_url": URL,
            "abruf": datetime.date.today().isoformat(),
            "geprueft": "Jeder Wert wurde beim Abruf im Quelltext nachgewiesen.",
            "hinweis": "Einzige oeffentlich belegte Kapazitaetsgroesse des "
                       "Offenen Ganztags in Bochum. Es existiert kein offener "
                       "Datensatz mit OGS-Plaetzen je Grundschule; jede "
                       "Standortkapazitaet in diesem Demonstrator ist daraus "
                       "abgeleitet und als Annahme gekennzeichnet. "
                       "Sekundaerquelle — vor weiterer Verwendung an der "
                       "Vorlage des Jugendhilfeausschusses pruefen.",
        },
        "eckwerte": werte,
    }

    path = os.path.join(OUT, "bo_ogs_eckwerte.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True,
                  separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for feld, wert, _ in ECKWERTE:
        print("   %-30s %6d  belegt" % (feld, wert))


if __name__ == "__main__":
    main()
