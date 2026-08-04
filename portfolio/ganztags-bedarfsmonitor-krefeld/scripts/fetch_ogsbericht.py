# -*- coding: utf-8 -*-
"""
fetch_ogsbericht.py — Kennzahlen aus dem ersten OGS-Bericht der Stadt Krefeld.

"OFFENER GANZTAG IN KREFELD — Entwicklungen, Herausforderungen, Perspektiven",
vorgelegt im Januar 2026, 56 Seiten:
  https://www.krefeld.de/system/files/2026-01/OGS-Bericht-Krefeld-2026.pdf

Der Bericht ist eine veroeffentlichte PDF-Publikation, kein maschinenlesbarer
Datensatz. Seine Kennzahlen sind deshalb hier abgeschrieben — mit Angabe der
Tabelle beziehungsweise Abbildung und der Seite, damit jeder Wert im Original
nachgeschlagen werden kann. Das Skript laedt das PDF und pruefen den
SHA-256-Hash gegen den unten festgehaltenen Wert: Damit ist eindeutig belegt,
auf welche Fassung des Berichts sich die abgeschriebenen Zahlen beziehen.
Aendert die Stadt das Dokument, schlaegt der Abgleich fehl und die Zahlen
sind neu zu pruefen — sie veralten nicht stillschweigend.

Aufruf:  python3 scripts/fetch_ogsbericht.py
         python3 scripts/fetch_ogsbericht.py --offline   (ohne Netzabgleich)
"""
import datetime
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

URL = "https://www.krefeld.de/system/files/2026-01/OGS-Bericht-Krefeld-2026.pdf"
SHA256 = "a46ba5ae521962f372a9b9599fdb898ef574037dac855f5431dc71dab1cb130d"
BYTES = 3386107
STAND = "2026-01"   # Erscheinungsmonat des Berichts

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36")}

# ---------------------------------------------------------------------------
# Tabelle 4-1 "Ganztagsentwicklung bei jaehrlichem Ausbau um 15 Gruppen
# (375 Plaetze)", Seite 42. Ist-Werte bis 2024/25, danach die Ausbauplanung
# der Stadt. "gruppen" ist im Original teils mit halber Gruppe ausgewiesen.
# ---------------------------------------------------------------------------
TABELLE_4_1 = [
    {"schuljahr": "2017/18", "ist": True,  "schueler": 7898, "plaetze": 3058, "gruppen": 127.0, "quote": 38.7},
    {"schuljahr": "2018/19", "ist": True,  "schueler": 7844, "plaetze": 3208, "gruppen": 133.0, "quote": 40.9},
    {"schuljahr": "2019/20", "ist": True,  "schueler": 7874, "plaetze": 3508, "gruppen": 145.0, "quote": 44.6},
    {"schuljahr": "2020/21", "ist": True,  "schueler": 7897, "plaetze": 3831, "gruppen": 160.0, "quote": 48.5},
    {"schuljahr": "2021/22", "ist": True,  "schueler": 8161, "plaetze": 4181, "gruppen": 174.0, "quote": 51.2},
    {"schuljahr": "2022/23", "ist": True,  "schueler": 8475, "plaetze": 4568, "gruppen": 190.0, "quote": 53.9},
    {"schuljahr": "2023/24", "ist": True,  "schueler": 8726, "plaetze": 4693, "gruppen": 195.0, "quote": 53.8},
    {"schuljahr": "2024/25", "ist": True,  "schueler": 9035, "plaetze": 5068, "gruppen": 210.0, "quote": 56.1},
    {"schuljahr": "2025/26", "ist": False, "schueler": 8950, "plaetze": 5506, "gruppen": 227.5, "quote": 61.5},
    {"schuljahr": "2026/27", "ist": False, "schueler": 8902, "plaetze": 5881, "gruppen": 242.5, "quote": 66.1},
    {"schuljahr": "2027/28", "ist": False, "schueler": 8814, "plaetze": 6256, "gruppen": 257.5, "quote": 71.0},
]

# Abb. 4-1 "OGS-Quoten nach Grundschulsozialindex", Schuljahr 2023/24, S. 43.
# Der kommunale Grundschulsozialindex der Stadt Krefeld hat fuenf Stufen —
# er ist nicht mit der neunstufigen Sozialindexstufe des Landes identisch.
# Foerderschulen sind in dieser Auswertung nicht enthalten (Fussnote 21).
OGS_QUOTE_JE_GSI = {"1": 54.2, "2": 56.4, "3": 59.5, "4": 56.0, "5": 47.2}

# Elternbefragung Juni 2024, S. 44.
BEFRAGUNG = {
    "haushalte": 2849,
    "ruecklaufquote": 28.2,
    "geburtszeitraum": "Oktober 2018 bis Juni 2023",
    "wollenGanztagsplatz": 95.0,
    "favorisiertOffen": 42.0,
    "favorisiertGebunden": 12.0,
    "unentschieden": 41.0,
    "randzeitenbedarf": 41.0,
}

# Massnahmenpakete Kuechen und Mensen, S. 43 (Beschluss ASW / Betriebsausschuss
# ZGM, Vorlage 6283/24). Schulen sind oeffentliche Einrichtungen; die Nennung
# ist unbedenklich. Platzwirkungen sind im Bericht NICHT beziffert.
MENSA_PAKETE = [
    {"paket": 1, "frist": "bis Ende der Sommerferien 2025", "wirksamAb": 2025, "standorte": [
        "GGS am Stadtpark Fischeln – Standort Marienplatz",
        "GGS Krähenfeld – Standort Kempener Allee",
        "Regenbogenschule"]},
    {"paket": 2, "frist": "bis Ende der Sommerferien 2026 und 2027", "wirksamAb": 2027, "standorte": [
        "Astrid-Lindgren-Schule – Standort Bonhoefferstraße",
        "Edith-Stein-Schule",
        "Josefschule",
        "KGS Königshof",
        "Schule an Haus Rath",
        "Südschule",
        "Grundschule an der Burg",
        "Heinrichsschule",
        "Paul-Gerhardt-Schule",
        "Pestalozzischule",
        "Schönwasserschule"]},
    {"paket": 3, "frist": "bis Ende der Sommerferien 2028", "wirksamAb": 2028, "standorte": [
        "Astrid-Lindgren-Schule – Standort Amernerstraße",
        "Brüder-Grimm-Schule",
        "Grundschule am Stadtpark Fischeln – Standort Wimmersweg"]},
]

# Weitere im Bericht genannte Groessen.
ECKWERTE = {
    "ausbautempoGruppen": 15,        # zusaetzliche Ganztagsgruppen pro Jahr, S. 42
    "plaetzeJeGruppe": 25,           # 15 Gruppen = 375 Plaetze, S. 42
    "zielquote2027_28": 71.0,        # S. 42
    "bedarfsquote2029": 100.0,       # Elternbefragung: nahezu vollstaendig, S. 42
    "acht_bis_eins_schulen": 19,     # ergaenzendes Angebot "8 bis 1", S. 44
    "acht_bis_eins_plaetze": 833,    # Schuljahr 2023/24, S. 44
    "acht_bis_eins_quote": 10.0,     # Schuljahr 2023/24, S. 44
    "schulsozialarbeitStellen": 22.5,  # Vollzeitstellen Primarbereich 2023/24, S. 41
}

SEITEN = {
    "tabelle4_1": "Tabelle 4-1, S. 42",
    "ogsQuoteJeGsi": "Abb. 4-1, S. 43",
    "befragung": "S. 44",
    "mensaPakete": "S. 43 (Vorlage 6283/24)",
    "eckwerte": "S. 41–44",
}


def pruefe_pdf():
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        raw = fh.read()
    ist = hashlib.sha256(raw).hexdigest()
    print("PDF geladen: %d B, sha256 %s" % (len(raw), ist))
    if ist != SHA256:
        raise SystemExit(
            "Der OGS-Bericht unter %s hat sich geaendert.\n"
            "  erwartet: %s (%d B)\n  erhalten: %s (%d B)\n"
            "Die abgeschriebenen Kennzahlen sind gegen die neue Fassung zu "
            "pruefen, bevor dieser Snapshot neu erzeugt wird."
            % (URL, SHA256, BYTES, ist, len(raw)))
    print("Hash stimmt — die abgeschriebenen Zahlen gehoeren zu dieser Fassung.")


def main():
    os.makedirs(OUT, exist_ok=True)
    offline = "--offline" in sys.argv
    if offline:
        print("--offline: Netzabgleich uebersprungen.")
    else:
        pruefe_pdf()

    path = os.path.join(OUT, "kr_ogsbericht.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "Stadt Krefeld — OGS-Bericht 2026 "
                          "„Offener Ganztag in Krefeld: Entwicklungen, "
                          "Herausforderungen, Perspektiven“",
                "quelle_url": URL,
                "erschienen": STAND,
                "sha256": SHA256,
                "bytes": BYTES,
                "abruf": datetime.date.today().isoformat(),
                "fundstellen": SEITEN,
                "hinweis": ("Aus einer veroeffentlichten PDF-Publikation "
                            "abgeschrieben, nicht maschinell extrahiert. Jede "
                            "Groesse ist mit Tabelle beziehungsweise Abbildung "
                            "und Seite belegt; der SHA-256-Hash pinnt die "
                            "Fassung des Dokuments."),
            },
            "ausbauplanung": TABELLE_4_1,
            "ogsQuoteJeGsi": OGS_QUOTE_JE_GSI,
            "befragung": BEFRAGUNG,
            "mensaPakete": MENSA_PAKETE,
            "eckwerte": ECKWERTE,
        }, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
