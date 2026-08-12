# -*- coding: utf-8 -*-
"""
fetch_bostatis.py — kleinraeumige Bevoelkerungsdaten aus BOStatIS, dem
Statistik-Informationsportal der Stadt Bochum.

Zwei Snapshots, beide je statistischem Bezirk:

  bo_geburten.json        Geburten und Sterbefaelle 2017 bis 2025.
      Der Vorlaufindikator des Ganztagsanspruchs: Wer bis zum Schuljahr
      2031/32 eingeschult wird, ist heute bereits geboren. Die Reihe zeigt,
      wie stark die kuenftigen Einschulungsjahrgaenge zwischen den Stadtteilen
      auseinanderlaufen — unabhaengig von der Prognose des Schultraegers und
      damit als Gegenprobe zu ihr verwendbar.

  bo_altersjahrgaenge.json Einwohnerinnen und Einwohner nach einzelnen
      Altersjahren, Stand 31.12.2022. Der einzige offene Bochumer Datensatz mit
      Einzeljahrgaengen auf Bezirksebene; neuere Jahrgaenge veroeffentlicht die
      Stadt nur in Fuenfjahresgruppen ueber den Auswertungsassistenten. Aus
      Datenschutzgruenden sind alle Werte auf 5 gerundet (Verfahren "D5") —
      die Zahlen taugen fuer Groessenordnungen und Verteilungen, nicht fuer
      Platzbescheide. Uebernommen werden nur die Altersjahre 0 bis 9.

Die Downloadadressen werden ueber die Katalog-Schnittstelle von BOStatIS
aufgeloest (POST /service/app/search/all), damit das Skript nicht auf
fest verdrahteten Dateinamen steht.

Quelle: Stadt Bochum, Statistik und Wirkungscontrolling — BOStatIS,
        https://bostatis.bochum.de/

Aggregierte Registerauswertung. Keine personenbezogenen Daten.

Aufruf:  python3 scripts/fetch_bostatis.py
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

PORTAL = "https://bostatis.bochum.de/"
SUCHE = PORTAL + "service/app/search/all"
UA = {"User-Agent": "kanduit-ganztags-bedarfsmonitor/1.0 (+https://kanduit.de)",
      "Content-Type": "application/json"}

GEBURTSJAHRE = list(range(2017, 2026))
ALTER_MAX = 9                      # Altersjahre 0 bis 9 genuegen fuer Klasse 1-4
RAUM = "Statistischer Bezirk"

# Der Katalogdienst verlangt neben dem Suchtext auch die Ergebniskonfiguration;
# ohne sie antwortet er mit HTTP 500.
ERGEBNIS = {"resultEntry": None,
            "headerAttribute": [{"name": "raeume", "title": "section"}]}


def hole(url, daten=None):
    req = urllib.request.Request(url, data=daten, headers=UA)
    with urllib.request.urlopen(req, timeout=240) as fh:
        return fh.read()


def katalog(text):
    """Katalogtreffer zu einem Suchtext."""
    koerper = json.dumps({"textSearch": text,
                          "textSearchConfig": {"attribute": None},
                          "numOfResults": 1000, "pagingStart": 0,
                          "result": ERGEBNIS}).encode("utf-8")
    return json.loads(hole(SUCHE, koerper).decode("utf-8")).get("ipResults") or []


def csv_url(eintrag):
    """Erste CSV-Darstellung eines Katalogeintrags als absolute URL."""
    for p in eintrag.get("presentations", []):
        if "CSV" not in (p.get("darstellungsArtBezeichnung") or ""):
            continue
        roh = (p.get("aufrufUrl") or "") + (p.get("schnittstelle") or "").replace("\\", "/")
        return urllib.parse.quote(roh, safe=":/?=&")
    return None


def dekodieren(roh):
    for kodierung in ("utf-8-sig", "cp1252"):
        try:
            return roh.decode(kodierung)
        except UnicodeDecodeError:
            continue
    raise SystemExit("unbekannte Zeichenkodierung")


def zahl(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return int(float(s))
    except ValueError:
        return None


def geburtszeile(z):
    """Eine Datenzeile der Geburtentabelle -> (nr, name, geburten, sterbefaelle).

    Die Quelle wechselt ueber die Jahrgaenge das Format: bis einschliesslich
    2022 stehen Nummer und Name in getrennten Spalten ("10;Grumme;122;164"),
    danach zusammengefasst in der ersten ("10 Grumme;91;168;-77"). Beide
    Schreibweisen werden hier erkannt; alles andere (Kopf-, Leer- und
    Summenzeilen) faellt durch.
    """
    erst = (z[0] or "").strip()
    if erst.isdigit() and len(z) >= 4:
        return erst, (z[1] or "").strip(), zahl(z[2]), zahl(z[3])
    nr, _, name = erst.partition(" ")
    nr, name = nr.strip(), name.strip()
    if nr.isdigit() and name and len(z) >= 3:
        return nr, name, zahl(z[1]), zahl(z[2])
    return None, None, None, None


# ----------------------------------------------------------------- Geburten --
def geburten(quellen):
    treffer = {}
    for e in katalog("Geburten und Sterbefälle"):
        if e.get("bezeichnung") != "Geburten und Sterbefälle":
            continue
        if e.get("raeume") != [RAUM] or len(e.get("zeiten") or []) != 1:
            continue
        jahr = int(e["zeiten"][0])
        url = csv_url(e)
        if jahr in GEBURTSJAHRE and url:
            treffer[jahr] = url
    fehlend = [j for j in GEBURTSJAHRE if j not in treffer]
    if fehlend:
        raise SystemExit("keine CSV-Ressource fuer %s — Katalog pruefen"
                         % ", ".join(str(j) for j in fehlend))

    jahre, namen = {}, {}
    for jahr in GEBURTSJAHRE:
        print("  Geburten %d …" % jahr)
        zeilen = list(csv.reader(io.StringIO(dekodieren(hole(treffer[jahr]))),
                                 delimiter=";"))
        werte = {}
        for z in zeilen:
            if len(z) < 3:
                continue
            nr, name, g, s = geburtszeile(z)
            if nr is None or g is None:
                continue
            namen[nr] = name
            werte[nr] = {"geburten": g, "sterbefaelle": s or 0}
        if len(werte) < 25:
            raise SystemExit("%d: nur %d statistische Bezirke gelesen"
                             % (jahr, len(werte)))
        jahre[str(jahr)] = werte
    quellen["geburten"] = [treffer[j] for j in GEBURTSJAHRE]
    return jahre, namen


# --------------------------------------------------------- Altersjahrgaenge --
def altersjahrgaenge(quellen):
    eintrag = None
    for e in katalog("Alter der Person"):
        if e.get("raeume") == [RAUM] and "Alter der Person" in e.get("bezeichnung", ""):
            eintrag = e
            break
    if eintrag is None:
        raise SystemExit("Datensatz „Einwohner … nach Alter der Person“ nicht "
                         "im Katalog gefunden")
    url = csv_url(eintrag)
    if not url:
        raise SystemExit("keine CSV-Darstellung zum Altersjahrgangs-Datensatz")
    print("  Altersjahrgaenge %s …" % ", ".join(eintrag.get("zeiten") or []))

    zeilen = list(csv.reader(io.StringIO(dekodieren(hole(url))), delimiter=";"))
    kopf = next((z for z in zeilen if z and z[0] == "Gemeindeschlüssel"), None)
    if kopf is None:
        raise SystemExit("Kopfzeile des Altersjahrgangs-Datensatzes nicht gefunden")
    spalte = {}
    for i, name in enumerate(kopf):
        n = (name or "").strip()
        for alter in range(ALTER_MAX + 1):
            if n.startswith("%d - unter %d " % (alter, alter + 1)):
                spalte[alter] = i
    fehlend = [a for a in range(ALTER_MAX + 1) if a not in spalte]
    if fehlend:
        raise SystemExit("Altersspalten fehlen: %s" % fehlend)

    stand = ""
    for z in zeilen[:14]:
        if z and z[0].startswith("Stand:"):
            stand = z[0].split(":", 1)[1].strip()

    idx_nr = kopf.index("Nr. Statistischer Bezirk")
    idx_name = kopf.index("Name Statistischer Bezirk")
    idx_art = kopf.index("Dateiart")

    bezirke, namen = {}, {}
    for z in zeilen:
        if len(z) <= max(spalte.values()) or z[0] != "05911000":
            continue
        if (z[idx_art] or "").strip() != "1":          # 1 = Gesamtbevoelkerung
            continue
        nr = (z[idx_nr] or "").strip()
        if not nr.isdigit():
            continue
        namen[nr] = (z[idx_name] or "").strip()
        bezirke[nr] = [zahl(z[spalte[a]]) or 0 for a in range(ALTER_MAX + 1)]
    if len(bezirke) < 25:
        raise SystemExit("nur %d statistische Bezirke mit Altersjahrgaengen"
                         % len(bezirke))
    quellen["altersjahrgaenge"] = [url]
    return bezirke, namen, stand, (eintrag.get("zeiten") or [""])[0]


def schreiben(dateiname, payload):
    path = os.path.join(OUT, dateiname)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True,
                  separators=(",", ":"))
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()
    quellen = {}

    print("lese Geburtenreihe …")
    geb, namen_geb = geburten(quellen)
    print("lese Altersjahrgaenge …")
    alter, namen_alter, stand_alter, jahr_alter = altersjahrgaenge(quellen)

    namen = dict(namen_alter)
    namen.update(namen_geb)

    schreiben("bo_geburten.json", {
        "meta": {
            "quelle": "Stadt Bochum, Statistik und Wirkungscontrolling — BOStatIS, "
                      "Geburten und Sterbefaelle in den Statistischen Bezirken",
            "quelle_url": PORTAL,
            "dateien": quellen["geburten"],
            "jahre": [str(j) for j in GEBURTSJAHRE],
            "abruf": abruf,
            "hinweis": "Aggregierte Registerauswertung je statistischem Bezirk. "
                       "Keine personenbezogenen Daten.",
        },
        "bezirksnamen": namen,
        "jahre": geb,
    })

    schreiben("bo_altersjahrgaenge.json", {
        "meta": {
            "quelle": "Stadt Bochum, Statistik und Wirkungscontrolling — BOStatIS, "
                      "Open Data: Einwohner nach statistischen Bezirken, "
                      "Staatsangehoerigkeit und Alter der Person",
            "quelle_url": PORTAL,
            "dateien": quellen["altersjahrgaenge"],
            "jahr": jahr_alter,
            "stichtag": stand_alter,
            "auswahl": "Dateiart 1 (Gesamtbevoelkerung), Altersjahre 0 bis %d"
                       % ALTER_MAX,
            "abruf": abruf,
            "rundung": "Alle Werte sind aus Datenschutzgruenden auf 5 gerundet "
                       "(Verfahren D5 der Stadt Bochum). Summen weichen deshalb "
                       "von der ungerundeten Gesamtzahl ab.",
            "hinweis": "Einziger offener Bochumer Datensatz mit Einzelaltersjahren "
                       "auf Bezirksebene; neuere Jahrgaenge liegen nur in "
                       "Fuenfjahresgruppen vor. Aggregierte Registerauswertung, "
                       "keine personenbezogenen Daten.",
        },
        "bezirksnamen": namen,
        "alter": alter,
    })

    stadt_geb = {j: sum(v["geburten"] for v in geb[j].values()) for j in geb}
    for j in sorted(stadt_geb):
        print("   %s  Geburten %5d" % (j, stadt_geb[j]))
    print("   Altersjahrgaenge %s: %d Bezirke, Kinder 0-9 gesamt %d"
          % (jahr_alter, len(alter), sum(sum(v) for v in alter.values())))


if __name__ == "__main__":
    main()
