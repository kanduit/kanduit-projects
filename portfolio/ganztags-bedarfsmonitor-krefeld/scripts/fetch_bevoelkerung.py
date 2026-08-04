# -*- coding: utf-8 -*-
"""
fetch_bevoelkerung.py — kleinraeumige Bevoelkerungsdaten der Stadt Krefeld
nach statistischen Bezirken, Jahrgaenge 2012 bis 2024.

Diese Quelle ist der Grund, warum der Bedarf in diesem Demonstrator nicht
geschaetzt werden muss: Die Stadt veroeffentlicht die Altersgruppen
u3 / 3 bis unter 6 / 6 bis unter 10 je statistischem Bezirk und Jahr. Alle
Kinder, die bis zum Schuljahr 2029/30 eingeschult werden, sind damit bereits
geboren und im Melderegister erfasst — die Anspruchsjahrgaenge des GaFoeG
lassen sich fortschreiben, ohne eine Geburtenprognose zu treffen.

Uebernommen werden nur die fuer das Kohortenmodell noetigen Spalten:
  STAT_001 Nummer, STAT_002 Name, FLAECHE,
  BEV_001 Bevoelkerung gesamt, BEV_002 unter 3, BEV_003 3 bis unter 6,
  BEV_004 6 bis unter 10.
Geschlechts- und Altersaufteilungen der uebrigen Spalten werden verworfen —
sie werden nicht gebraucht und wuerden den Snapshot unnoetig aufblaehen.

Quelle: Stadt Krefeld, FB 312 Statistik und Wahlen, ueber das Offene
Datenportal (offenesdatenportal.de), nachgewiesen im Datensatzkatalog des
Landes (open.nrw). Die Ressourcen-URLs werden ueber die CKAN-API von
open.nrw aufgeloest, damit das Skript nicht auf 13 fest verdrahteten
Downloadlinks steht.

Aggregierte Registerauswertung, keine personenbezogenen Daten.

Aufruf:  python3 scripts/fetch_bevoelkerung.py
"""
import csv
import datetime
import io
import json
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

CKAN = "https://ckan.open.nrw.de/api/3/action/package_search"
TITEL = "Kleinräumige Bevölkerungsdaten der Stadt Krefeld nach statistischen Bezirken"
KATALOG = "https://open.nrw"
JAHRE = list(range(2012, 2025))

# Spalte -> Feldname im Snapshot (Codeliste aus der Datensatzbeschreibung
# des Portals, "Basisdaten Bevoelkerung — Abteilung 312 Statistik und Wahlen").
SPALTEN = [
    ("BEV_001", "gesamt"),
    ("BEV_002", "u3"),
    ("BEV_003", "a3bis6"),
    ("BEV_004", "a6bis10"),
]

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36")}

# Zeilen, die keine Gebietseinheit sind (Summen- und Restzeile der Quelle).
KEINE_GEBIETE = ("Krefeld abs.", "nicht zuzuordnen")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return fh.read()


def num(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def finde_ressourcen():
    """CKAN-Suche -> {Jahr: CSV-URL} fuer die Basisdaten-Dateien."""
    url = CKAN + "?rows=60&q=" + urllib.parse.quote('"%s"' % TITEL)
    treffer = json.loads(get(url).decode("utf-8"))["result"]["results"]
    gefunden = {}
    for paket in treffer:
        titel = paket.get("title", "")
        if not titel.startswith(TITEL):
            continue
        jahr = titel.rsplit(" ", 1)[-1]
        if not jahr.isdigit():
            continue
        for res in paket.get("resources", []):
            u = res.get("url") or ""
            if "basisdaten-bevoelkerung" in u and "datensatzbeschreibung" not in u:
                gefunden[int(jahr)] = u
    return gefunden


def main():
    os.makedirs(OUT, exist_ok=True)
    print("suche Ressourcen im Datensatzkatalog …")
    ressourcen = finde_ressourcen()
    fehlend = [j for j in JAHRE if j not in ressourcen]
    if fehlend:
        raise SystemExit("keine Ressource fuer %s — Katalog pruefen"
                         % ", ".join(str(j) for j in fehlend))

    jahre, stadt = {}, {}
    bezirksnamen = {}
    for jahr in JAHRE:
        print("lade %d …" % jahr)
        # Die Dateien sind durchgaengig cp1252 kodiert (Umlaute in STAT_002).
        rows = list(csv.DictReader(
            io.StringIO(get(ressourcen[jahr]).decode("cp1252")), delimiter=";"))
        werte, summe = {}, dict((feld, 0) for _, feld in SPALTEN)
        for r in rows:
            nr = (r.get("STAT_001") or "").strip()
            name = (r.get("STAT_002") or "").strip()
            if nr in KEINE_GEBIETE or name in ("x", ""):
                continue
            nr = nr.zfill(3)
            bezirksnamen[nr] = name
            eintrag = {}
            for spalte, feld in SPALTEN:
                v = num(r.get(spalte))
                if v is None:
                    raise SystemExit("%d/%s: Spalte %s fehlt" % (jahr, nr, spalte))
                eintrag[feld] = int(v)
                summe[feld] += int(v)
            werte[nr] = eintrag
        if len(werte) != 45:
            raise SystemExit("%d: erwartet 45 statistische Bezirke, erhalten %d"
                             % (jahr, len(werte)))
        jahre[str(jahr)] = werte
        stadt[str(jahr)] = summe

    path = os.path.join(OUT, "kr_bevoelkerung.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "meta": {
                "quelle": "Stadt Krefeld, FB 312 Statistik und Wahlen — "
                          "Kleinraeumige Bevoelkerungsdaten nach statistischen "
                          "Bezirken",
                "quelle_url": KATALOG,
                "dateien": [ressourcen[j] for j in JAHRE],
                "stichtag": "31.12. des jeweiligen Jahres",
                "jahre": [str(j) for j in JAHRE],
                "spalten": {feld: spalte for spalte, feld in SPALTEN},
                "abruf": datetime.date.today().isoformat(),
                "hinweis": ("Aggregierte Registerauswertung je statistischem "
                            "Bezirk. Keine personenbezogenen Daten. Die Zeilen "
                            "'Krefeld abs.' und 'nicht zuzuordnen' der Quelle "
                            "sind nicht uebernommen; die Stadtsumme wird aus "
                            "den 45 Bezirken gebildet."),
            },
            "bezirksnamen": bezirksnamen,
            "jahre": jahre,
            "stadt": stadt,
        }, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))
    for j in JAHRE:
        s = stadt[str(j)]
        print("   %d  gesamt %7d · u3 %5d · 3–6 %5d · 6–10 %5d"
              % (j, s["gesamt"], s["u3"], s["a3bis6"], s["a6bis10"]))


if __name__ == "__main__":
    main()
