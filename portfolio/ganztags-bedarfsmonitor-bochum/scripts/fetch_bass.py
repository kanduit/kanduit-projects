# -*- coding: utf-8 -*-
"""
fetch_bass.py — Foerdersaetze des Offenen Ganztags aus der Foerderrichtlinie.

Quelle ist ausschliesslich die Richtlinie selbst:
BASS 11-02 Nr. 19 — „Zuwendungen fuer die Durchfuehrung ausserunterrichtlicher
Angebote offener Ganztagsschulen im Primarbereich“, Fassung BASS 2026/2027.
https://bass.schule.nrw/4938.htm

Ausdruecklich NICHT aus Pressemitteilungen: Das Land hat fuer 2026 und 2027
zusaetzliche Plaetze und Mittel angekuendigt: Solche Zahlen sind keine
Foerdersaetze und taugen nicht fuer eine Kostenrechnung. Massgeblich ist der
Satz in der Richtlinie, mit Fassungsdatum.

Uebernommene Saetze (jeweils ab 01.08.2026, Nummern 5.4.1 und 5.5):

  Grundfestbetrag Land          1.138 € je Kind und Schuljahr
    fuer Kinder mit Bedarf an
    sonderpaedagogischer Unterst. 2.054 €
  Festbetrag statt 0,1 Lehrer-
    stellen (Wahlrecht § 94 II
    SchulG)                       383 € je Kind
  Kommunaler Eigenanteil          603 € je Platz und Jahr
  Elternbeitrag, Hoechstgrenze    242 € je Kind und Monat

Alle Saetze steigen laut Richtlinie jaehrlich zum 1. August um drei Prozent,
kaufmaennisch auf volle Euro gerundet.

Wie bei den OGS-Eckwerten werden die Betraege nicht abgetippt, sondern beim
Abruf im Quelltext der Richtlinie nachgewiesen. Faellt eine Pruefung durch,
bricht der Abruf ab — dann wurde die Richtlinie geaendert und die Kostenachse
muss neu bewertet werden.

Keine personenbezogenen Daten.

Aufruf:  python3 scripts/fetch_bass.py
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

URL = "https://bass.schule.nrw/4938.htm"
UA = {"User-Agent": "kanduit-ganztags-bedarfsmonitor/1.0 (+https://kanduit.de)"}

# Feld -> (Wert in Euro, Nachweistext, Fundstelle, Einheit)
SAETZE = [
    ("land_grundbetrag", 1138, "1.138 €", "Nr. 5.4.1", "je Kind und Schuljahr"),
    ("land_grundbetrag_sonderpaed", 2054, "2.054 €", "Nr. 5.4.1",
     "je Kind mit Bedarf an sonderpaedagogischer Unterstuetzung und Schuljahr"),
    ("land_statt_lehrerstellen", 383, "383 €", "Nr. 5.4.2 Absatz 2",
     "je Kind, wenn der Traeger statt 0,1 Lehrerstellen den Festbetrag waehlt"),
    ("kommunaler_eigenanteil", 603, "603 €", "Nr. 5.5", "je Platz und Jahr"),
    ("elternbeitrag_hoechstgrenze", 242, "242 €", "Nr. 5.5",
     "je Kind und Monat — Hoechstgrenze, nicht der Bochumer Satzungssatz"),
]

STEIGERUNG = 0.03   # Nr. 5.4.1 und 5.5: jaehrlich zum 1. August drei Prozent
AB = "2026-08-01"


def text_von(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as fh:
        roh = fh.read().decode("utf-8", errors="replace")
    ohne = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", roh, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", ohne)))


def main():
    os.makedirs(OUT, exist_ok=True)
    print("lade Richtlinie …")
    text = text_von(URL)

    fassung = "BASS 2026/2027"
    if fassung not in text:
        raise SystemExit("Fassung „%s“ nicht mehr im Quelltext — Richtlinie "
                         "wurde neu aufgelegt, Saetze pruefen" % fassung)
    if "drei Prozent" not in text:
        raise SystemExit("Regel zur jaehrlichen Erhoehung nicht mehr belegt")

    saetze, fehlend = {}, []
    for feld, wert, nachweis, fundstelle, einheit in SAETZE:
        if nachweis not in text:
            fehlend.append("%s (erwartet: „%s“)" % (feld, nachweis))
        saetze[feld] = {"betrag": wert, "fundstelle": fundstelle,
                        "einheit": einheit}
    if fehlend:
        raise SystemExit("Richtlinie belegt folgende Saetze nicht mehr:\n  "
                         + "\n  ".join(fehlend))

    payload = {
        "meta": {
            "quelle": "BASS 11-02 Nr. 19 — Zuwendungen fuer die Durchfuehrung "
                      "ausserunterrichtlicher Angebote offener Ganztagsschulen "
                      "im Primarbereich",
            "quelle_url": URL,
            "fassung": fassung,
            "gueltig_ab": AB,
            "steigerung_jaehrlich": STEIGERUNG,
            "steigerung_regel": "Die Foerdersaetze und der Eigenanteil steigen "
                                "jaehrlich zum 1. August um drei Prozent, "
                                "kaufmaennisch auf volle Euro gerundet "
                                "(Nr. 5.4.1 und Nr. 5.5).",
            "abruf": datetime.date.today().isoformat(),
            "geprueft": "Jeder Betrag wurde beim Abruf im Quelltext der "
                        "Richtlinie nachgewiesen.",
            "hinweis": "Elternbeitraege sind auf den kommunalen Eigenanteil "
                       "anrechenbar (Nr. 5.5); der Satz von 242 € ist die "
                       "Hoechstgrenze der Richtlinie, nicht der tatsaechliche "
                       "Bochumer Satzungssatz. Die Bochumer Elternbeitrags"
                       "satzung ist sozial gestaffelt und liegt nicht offen "
                       "vor — Elternbeitraege werden deshalb getrennt "
                       "ausgewiesen und nicht mit dem Eigenanteil saldiert.",
        },
        "saetze": saetze,
    }

    path = os.path.join(OUT, "bass_ogs_foerderung.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True,
                  separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for feld, wert, _, fundstelle, einheit in SAETZE:
        print("   %-30s %6d €  %-22s %s" % (feld, wert, fundstelle, einheit))
    print("   Steigerung %.0f %% jaehrlich zum 1. August · Fassung %s"
          % (STEIGERUNG * 100, fassung))


if __name__ == "__main__":
    main()
