# -*- coding: utf-8 -*-
"""
fetch_endbericht.py — Snapshot aus dem Endbericht zur Wärmeplanung Mülheim.

Quelle (öffentlich, Stadt Mülheim an der Ruhr):
  https://cms.muelheim-ruhr.de/sites/default/files/2026-07/Waermeplanung_Muelheim_Endbericht.pdf
  190 Seiten, Redaktionsdatum 15.05.2026, vom Rat beschlossen am 16.07.2026.

Erzeugt data/sources/endbericht_*.json. Nur Zahlen, Kennwerte und kurze
Sachangaben (Federführung, Laufzeit, Kostenträger) — bewusst KEINE längeren
Textpassagen: der Bericht trägt im Impressum den Hinweis, dass eine
Veröffentlichung auch auszugsweise der Genehmigung der Herausgeber bedarf
(siehe README, Abschnitt „Rechte an den Quellen").

Voraussetzung: `pdftotext` (poppler). Nur zur Snapshot-Erzeugung nötig —
generate.py liest ausschließlich die committeten JSON-Dateien und läuft offline.

Aufruf:  python3 scripts/fetch_endbericht.py [--pdf /pfad/endbericht.pdf]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfgrid  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

PDF_URL = ("https://cms.muelheim-ruhr.de/sites/default/files/2026-07/"
           "Waermeplanung_Muelheim_Endbericht.pdf")
ABRUF = "20.08.2026"          # Abrufdatum der Quelle
REDAKTION = "15.05.2026"      # Redaktionsdatum laut Impressum
BESCHLUSS = "16.07.2026"      # Ratsbeschluss laut Stadt-Website

STUETZJAHRE = ["Basisjahr", "2030", "2035", "2040", "2045"]
# Spaltengrenzen der Anhang-Tabellen 42–45 (S. 186): Bezeichnung, dann fünf
# Stützjahre mit Mittelpunkten bei x ≈ 222/293/364/427/492.
ANHANG_BOUNDS = [180, 258, 328, 396, 460]
# Spaltengrenzen der Tabellen 36–40 (S. 185 f.): Energieträger, dann die drei
# Sektoren mit Mittelpunkten bei x ≈ 281/373/471.
ENERGIE_BOUNDS = [240, 330, 425]
# Umweltwärme zählt in den Tabellen 36–40 als eigene Zeile mit, bleibt aber in
# der Endenergiebilanz des Fließtextes (S. 126) außen vor. Für die Gegenprobe
# der Spaltenzuordnung werden diese Zeilen abgezogen.
UMWELTWAERME = ("Umweltwärme aus Luft", "Oberflächennahe Geothermie")


# --------------------------------------------------------------------------
# Tabelle 26 (S. 130) — Indikatoren der Wärmewende
# --------------------------------------------------------------------------
# Kategorien in Dokumentreihenfolge mit ihrer Zeilenzahl. Die Kategoriespalte
# ist vertikal zentriert über ihre Zeilengruppe gesetzt; eine Zuordnung über
# die y-Nähe greift daneben (die Zeile „zusätzlicher Wärmebedarf durch
# Neubauten" läge sonst bei „Emissionen"). Deshalb über die Reihenfolge, mit
# Prüfung der Gesamtzahl.
IND_KATEGORIEN = [
    ("Anteile der Energieträger am Wärmebedarf", 5),
    ("Anteile der Energieträger am Endenergiebedarf", 5),
    ("Transformation der Versorgungsstruktur", 7),
    ("Energieeinsparungen", 4),
    ("Emissionen", 1),
]


def indikatoren(pdf):
    """22 Indikatoren mit Referenz- und Zielwert (Tabelle 26, S. 130)."""
    ws = [w for w in pdfgrid.words(pdf, 130) if 110 <= w["cy"] <= 480]
    rows = []                       # Zeilen mit Werten
    labels = []                     # reine Beschriftungszeilen (Umbrüche)
    for ln in pdfgrid.lines(ws):
        kat, ind, ref, ziel = pdfgrid.cells(ln, [170, 330, 405])
        if ref or ziel:
            rows.append({"y": ln[0]["cy"], "ind": [ind], "ref": ref, "ziel": ziel})
        elif ind:
            labels.append((ln[0]["cy"], ind))
    if len(rows) != 22:
        raise SystemExit(f"Tabelle 26: {len(rows)} Wertzeilen statt 22 — Quelle geändert?")
    # Umbrochene Beschriftungen der nächstgelegenen Wertzeile zuordnen und in
    # y-Reihenfolge anhängen bzw. voranstellen.
    for y, txt in labels:
        r = min(rows, key=lambda r: abs(r["y"] - y))
        r["ind"].insert(0, txt) if y < r["y"] else r["ind"].append(txt)

    out, i = [], 0
    for kat, n in IND_KATEGORIEN:
        for r in rows[i:i + n]:
            name = re.sub(r"\s+", " ", " ".join(r["ind"])).replace(" *", "").strip()
            # Trennstriche aus dem Zeilenumbruch zusammenziehen
            # („Raumwärme- bedarfs" → „Raumwärmebedarfs"), echte Bindestriche
            # vor Konjunktionen aber stehen lassen („Ausbau- und …").
            name = re.sub(r"(\w)-\s+(?!und\b|oder\b|bzw\b|sowie\b)([a-zäöüß])",
                          r"\1\2", name)
            out.append({"kategorie": kat, "indikator": name,
                        "referenz": r["ref"].strip(), "ziel": r["ziel"].strip(),
                        "referenz_num": pdfgrid.num(r["ref"]),
                        "ziel_num": pdfgrid.num(r["ziel"]), "seite": 130})
        i += n
    if i != 22:
        raise SystemExit("Tabelle 26: Kategoriezuordnung deckt nicht alle Zeilen ab")
    return out


# --------------------------------------------------------------------------
# Anhang-Tabellen (S. 184–186)
# --------------------------------------------------------------------------
def _anhang_tabelle(pdf, page, titel, bounds, ncols):
    """Zeilen einer Anhang-Tabelle ab ihrer Überschrift bis zur nächsten."""
    ws = pdfgrid.words(pdf, page)
    lns = pdfgrid.lines(ws)
    start = end = None
    for i, ln in enumerate(lns):
        t = " ".join(w["t"] for w in ln)
        if t.startswith(titel):
            start = i
        elif start is not None and re.match(r"^Tabelle \d+:", t):
            end = i
            break
    if start is None:
        raise SystemExit(f"{titel!r} auf S. {page} nicht gefunden — Quelle geändert?")
    rows = []
    for ln in lns[start + 1:end]:
        c = pdfgrid.cells(ln, bounds)
        if any(c) and len([x for x in c if x]) > 1:
            rows.append(c[:ncols])
    return rows


def endenergie(pdf):
    """Tabelle 36–40: Endenergie Wärme in GWh je Energieträger und Sektor."""
    spec = [("Tabelle 36", 185, "Basisjahr"), ("Tabelle 37", 185, "2030"),
            ("Tabelle 38", 185, "2035"), ("Tabelle 39", 185, "2040"),
            ("Tabelle 40", 186, "2045")]
    reihen = {}
    for titel, page, jahr in spec:
        rows = _anhang_tabelle(pdf, page, titel, ENERGIE_BOUNDS, 4)
        got = 0
        for name, phh, oef, ghd in rows:
            if name in ("Energieträger", "") or pdfgrid.num(phh) is None:
                continue
            reihen.setdefault(name, {})[jahr] = {
                "phh": pdfgrid.num(phh), "oef": pdfgrid.num(oef),
                "ghd": pdfgrid.num(ghd)}
            got += 1
        if got != 10:
            raise SystemExit(f"{titel}: {got} Energieträger statt 10")

    # Gegenprobe der Spaltenzuordnung an einer zweiten Stelle des Berichts:
    # Ohne die Umweltwärme-Zeilen muss die Summe je Stützjahr den im Fließtext
    # genannten Endenergiebedarf treffen (1.726 GWh im Basisjahr, 980 GWh in
    # 2045, S. 126). Ohne diese Prüfung bleibt eine verrutschte Spalte
    # unbemerkt — die Zeilenzahl allein stimmt auch dann noch.
    probe = {}
    for jahr, soll in (("Basisjahr", 1726.0), ("2045", 980.0)):
        summe = sum(v[jahr]["phh"] + v[jahr]["oef"] + v[jahr]["ghd"]
                    for k, v in reihen.items() if k not in UMWELTWAERME)
        abw = abs(summe - soll) / soll
        if abw > 0.02:
            raise SystemExit(f"Endenergie {jahr}: Summe {summe:.1f} GWh weicht "
                             f"{abw:.1%} von den {soll:.0f} GWh auf S. 126 ab — "
                             f"Spaltenzuordnung prüfen")
        probe[jahr] = {"summe_tabellen": round(summe, 1), "fliesstext": soll,
                       "abw_pct": round(abw * 100, 2)}

    return {"einheit": "GWh/a", "gegenprobe_fliesstext": probe,
            "umweltwaerme_zeilen": list(UMWELTWAERME), "sektoren": {
        "phh": "Private Haushalte", "oef": "Öffentliche Einrichtungen",
        "ghd": "Gewerbe, Handel, Dienstleistung und Industrie"},
        "seiten": "185–186", "reihen": reihen}


def thg(pdf):
    """Tabelle 41: THG-Emissionen des Wärmesektors je Stützjahr, in kt."""
    rows = _anhang_tabelle(pdf, 186, "Tabelle 41", [300], 2)
    out = {}
    for jahr, wert in rows:
        j = jahr.strip()
        if j in STUETZJAHRE and pdfgrid.num(wert) is not None:
            out[j] = pdfgrid.num(wert)
    if len(out) != 5:
        raise SystemExit(f"Tabelle 41: {len(out)} Stützjahre statt 5")
    return {"einheit": "kt CO2-Äq/a", "seite": 186, "werte": out}


def gebaeude(pdf):
    """Tabelle 43/45: Gebäude mit Wärmenetz- bzw. Gasnetzanschluss."""
    out = {}
    for key, titel in (("fernwaerme", "Tabelle 43"), ("gas", "Tabelle 45")):
        rows = _anhang_tabelle(pdf, 186, titel, ANHANG_BOUNDS, 6)
        vals = {}
        for r in rows:
            if r[0].startswith("Anzahl"):
                for j, v in zip(STUETZJAHRE, r[1:6]):
                    vals[j] = pdfgrid.num(v)
        if len(vals) != 5 or any(v is None for v in vals.values()):
            raise SystemExit(f"{titel}: Anzahl-Zeile unvollständig ({vals})")
        out[key] = vals
    return {"seite": 186, "hinweis": (
        "Gemeinschaftlich versorgte Gebäudeteile und Adressen sind laut Fußnote "
        "der Tabellen zu Gebäuden zusammengefasst — ein Gebäude kann mehrere "
        "Adressen umfassen."), "werte": out}


def fernwaerme_mix(pdf):
    """Tabelle 42: Endenergie der Fernwärmeerzeugung je Energieträger."""
    rows = _anhang_tabelle(pdf, 186, "Tabelle 42", ANHANG_BOUNDS, 6)
    reihen, reihenfolge, letzte = {}, [], None
    for r in rows:
        name = r[0].strip()
        werte = [pdfgrid.num(v) for v in r[1:6]]
        if name and name != "Energieträger" and all(v is not None for v in werte):
            reihen[name] = dict(zip(STUETZJAHRE, werte))
            reihenfolge.append(name)
            letzte = name
        elif name and letzte and not any(werte):
            # Fortsetzungszeile eines umbrochenen Energieträgernamens
            reihen[letzte + " " + name] = reihen.pop(letzte)
            reihenfolge[-1] = letzte = letzte + " " + name
    if len(reihen) != 8:
        raise SystemExit(f"Tabelle 42: {len(reihen)} Energieträger statt 8: {list(reihen)}")
    return {"einheit": "GWh/a", "seite": 186, "reihen": reihen}


def netz_emissionsfaktoren(pdf):
    """Tabelle 35: Emissionsfaktoren je Wärmenetz (S. 184).

    Die Spalten 2030/2040/2045 sind für Netzgruppen vertikal verbunden; nur die
    Basisjahr-Spalte steht je Netz einzeln. Übernommen wird daher der
    Basisjahr-Wert je Netz — die Gruppenwerte wären ohne die Gruppierung
    irreführend und werden nicht gespeichert.
    """
    # Fenster auf Tabelle 35 (die Seite trägt auch Tabelle 33 und 34).
    ws = [w for w in pdfgrid.words(pdf, 184) if 500 <= w["cy"] <= 700]
    zeilen, namen = [], []
    for ln in pdfgrid.lines(ws):
        name, basis = pdfgrid.cells(ln, [250, 300])[:2]
        if basis.strip():
            zeilen.append({"y": ln[0]["cy"], "n": [name.strip()],
                           "v": pdfgrid.num(basis)})
        elif name.strip():
            namen.append((ln[0]["cy"], name.strip()))
    for y, txt in namen:                       # umbrochene Netznamen
        z = min(zeilen, key=lambda z: abs(z["y"] - y))
        z["n"].insert(0, txt) if y < z["y"] else z["n"].append(txt)
    netze = [{"netz": " ".join(x for x in z["n"] if x).replace("- ", "-"),
              "basisjahr_g_co2_kwh": z["v"]} for z in zeilen]
    if len(netze) != 15:
        raise SystemExit(f"Tabelle 35: {len(netze)} Netze statt 15: "
                         + ", ".join(n["netz"] for n in netze))
    bestand = [n for n in netze if n["basisjahr_g_co2_kwh"] is not None]
    if len(bestand) != 11:
        raise SystemExit(f"Tabelle 35: {len(bestand)} Netze mit Basisjahr-Wert statt 11")
    return {"einheit": "g CO2-Äq je kWh Wärmeabsatz", "seite": 184,
            "hinweis": ("Nur der Basisjahr-Wert steht je Netz einzeln. Die "
                        "Spalten 2030/2040/2045 sind im Bericht für Netzgruppen "
                        "verbunden und werden deshalb nicht je Netz geführt."),
            "netze_gesamt": len(netze), "netze_mit_basiswert": len(bestand),
            "netze": netze}


# --------------------------------------------------------------------------
# Maßnahmensteckbriefe (Kapitel 6.5, S. 139–169)
# --------------------------------------------------------------------------
STRATEGIEFELDER = {
    "6.5.1": "Wärmeplanung als Prozess",
    "6.5.2": "Wärmenetze und Infrastruktur",
    "6.5.3": "Ausbau erneuerbarer Energien und Abwärme",
    "6.5.4": "Begleitende Prozesse",
    "6.5.5": "Sonstige",
}
# Titel laut Übersichtstabellen 27–31 (S. 136 f.). Die Steckbrief-Überschriften
# brechen um und weichen in einem Fall ab („Denkmalbereiche" gegen
# „Denkmalschutzbereiche") — deshalb die Übersichtsfassung als Anzeigename.
TITEL = {
    "6.5.1.1": "Integration der Wärmeplanung in die städtische Infrastrukturplanung",
    "6.5.1.2": "Flächensicherung für erneuerbare Wärmeerzeugung",
    "6.5.1.3": "Analyse und Optimierung städtischer Strukturen mit Bezug zur Wärmewende",
    "6.5.1.4": "Vertiefende Analyse der Prüfgebiete",
    "6.5.2.1": "Umsetzung des Transformationsplans Wärmenetz „Innenstadt“",
    "6.5.2.2": "Aufstellung und Berücksichtigung von Transformationsplänen für Wärmenetze außerhalb des Innenstadtbereichs",
    "6.5.2.3": "Bedarfsorientierter Stromnetzausbau",
    "6.5.3.1": "Koordinierung und Unterstützung von Abwärmeprojekten in Industrie und Gewerbe",
    "6.5.3.2": "Einleitung erforderlicher Planungsschritte zur Erschließung der tiefen und mitteltiefen Geothermiepotenziale",
    "6.5.3.3": "Realisierung der Flusswasserpotenziale der Ruhr",
    "6.5.4.1": "Information der Fachbetriebe, professionell Beratenden und Beratungsstellen zur Wärmeplanung",
    "6.5.4.2": "Energieberatung für Denkmalbereiche",
    "6.5.4.3": "Bekanntheitssteigerung der Übergangslösungen bei Havariefällen",
    "6.5.5.1": "Prüfung: Wärmepumpencontracting für Mehrfamilienhäuser",
}
# Zweispaltige Blöcke: (linkes Label, rechtes Label). Der x-Beginn des rechten
# Labels ist die Spaltentrennung — sie liegt je Block anders. Die Kopfzeile
# wird gegen ein Muster geprüft, weil ein Steckbrief „Mögliche Hemmnisse"
# statt „Hemmnisse" schreibt (6.5.2.3).
ZWEISPALTIG = [("Federführung", "Beteiligte"),
               ("Erforderliche Umsetzungsschritte", "Laufzeit"),
               ("voraussichtliche Kosten und Kostenträger", "Finanzierung"),
               ("Erfolgsindikatoren/Meilensteine", "Hemmnisse")]
EINSPALTIG = ["Ziel", "Zielgruppe", "Beschreibung", "Kommunaler Einflussbereich",
              "Positive Auswirkungen"]


# Fußnoten stehen im Bericht in ~6,8 pt, Fließtext in ~9,5 pt. Ohne diesen
# Filter rutschen Fußnotentexte in die Felder darüber (etwa „5 Weitere
# Informationen …" in die Federführung von 6.5.3.3).
FUSSNOTE_MAX_HOEHE = 8.0


def _zweispaltig(txt):
    """(linkes Label, rechtes Label, rechtes Label wie gesetzt) oder None."""
    for links, rechts in ZWEISPALTIG:
        m = re.fullmatch(rf"{re.escape(links)}\s+((?:\S+\s+)?{re.escape(rechts)})", txt)
        if m:
            return links, rechts, m.group(1)
    return None


def _steckbrief_seiten(pdf, seiten):
    """Alle Zeilen der Steckbrief-Seiten als (seite, [worte]), ohne Kopfzeile,
    Seitenzahl und Fußnoten."""
    out = []
    for p in seiten:
        for ln in pdfgrid.lines(pdfgrid.words(pdf, p)):
            txt = " ".join(w["t"] for w in ln)
            if txt.startswith("Wärmeplanung für Mülheim") or txt.strip().isdigit():
                continue
            hoehe = sum(w["y1"] - w["y0"] for w in ln) / len(ln)
            if hoehe < FUSSNOTE_MAX_HOEHE:
                continue
            out.append((p, ln))
    return out


def massnahmen(pdf, von=139, bis=169):
    lns = _steckbrief_seiten(pdf, range(von, bis + 1))
    # Steckbrief-Anfänge finden
    kopf = re.compile(r"^(6\.5\.\d+\.\d+)\s")
    starts = []
    for i, (p, ln) in enumerate(lns):
        m = kopf.match(" ".join(w["t"] for w in ln))
        if m:
            starts.append((i, m.group(1), p))
    if len(starts) != 14:
        raise SystemExit(f"{len(starts)} Steckbriefe statt 14 gefunden")

    out = []
    for k, (i, nr, seite) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(lns)
        blk = lns[i:end]
        felder = {}
        j = 0
        while j < len(blk):
            txt = " ".join(w["t"] for w in blk[j][1]).strip()
            zwei = _zweispaltig(txt)
            if zwei:
                # Spaltentrennung = linke Kante des rechten Labels
                rechts = zwei[2].split()[0]
                div = next(w["x0"] for w in blk[j][1] if w["t"].startswith(rechts)) - 4
                li, re_ = [], []
                j += 1
                while j < len(blk):
                    t2 = " ".join(w["t"] for w in blk[j][1]).strip()
                    if _zweispaltig(t2) or t2 in EINSPALTIG:
                        break
                    a, b = pdfgrid.cells(blk[j][1], [div])
                    li.append(a)
                    re_.append(b)
                    j += 1
                felder[zwei[0]] = " ".join(x for x in li if x)
                felder[zwei[1]] = " ".join(x for x in re_ if x)
                continue
            if txt in EINSPALTIG:
                buf = []
                j += 1
                while j < len(blk):
                    t2 = " ".join(w["t"] for w in blk[j][1]).strip()
                    if t2 in EINSPALTIG or _zweispaltig(t2):
                        break
                    buf.append(t2)
                    j += 1
                felder[txt] = " ".join(buf)
                continue
            j += 1

        def clean(s, limit=None):
            s = re.sub(r"\s+", " ", felder.get(s, "")).strip(" ;,")
            return s[:limit].rstrip() if limit and len(s) > limit else s

        kosten = clean("voraussichtliche Kosten und Kostenträger")
        mt = re.search(r"Kostenträger:\s*(.+?)(?:\s+Erfolgsindikatoren|$)", kosten)
        quantifiziert = bool(re.search(r"\d[\d.]*\s*(?:€|Euro|T€|Mio)", kosten))
        schritte = clean("Erforderliche Umsetzungsschritte")
        indikatoren_txt = clean("Erfolgsindikatoren/Meilensteine")
        out.append({
            "nr": nr,
            "strategiefeld": STRATEGIEFELDER[nr.rsplit(".", 1)[0]],
            "titel": TITEL[nr],
            "federfuehrung": clean("Federführung"),
            "beteiligte": clean("Beteiligte"),
            "einflussbereich": [x.strip() for x in
                                clean("Kommunaler Einflussbereich").split(",") if x.strip()],
            "laufzeit": clean("Laufzeit"),
            "kosten_quantifiziert": quantifiziert,
            "kostentraeger": (mt.group(1).strip(" .") if mt else ""),
            "finanzierung": clean("Finanzierung", 160),
            "n_schritte": schritte.count("•") or None,
            "n_erfolgsindikatoren": indikatoren_txt.count("•") or None,
            "hat_hemmnisse": bool(clean("Hemmnisse")),
            "seite": seite,
        })
    fehlend = [m["nr"] for m in out
               if not m["federfuehrung"] or not m["laufzeit"]
               or not m["einflussbereich"] or not m["n_erfolgsindikatoren"]
               or not m["n_schritte"]]
    if fehlend:
        raise SystemExit(f"Steckbriefe mit unvollständigen Feldern: {fehlend}")
    return out


# --------------------------------------------------------------------------
# Eckwerte aus dem Fließtext — je Wert die Seite und ein Muster, das ihn
# eindeutig trifft. Ändert sich der Bericht, schlägt der Abruf fehl statt
# still eine veraltete Zahl weiterzureichen.
# --------------------------------------------------------------------------
ECKWERTE = [
    ("waermenetzgebiet_flaechenanteil_pct", 113,
     r"Wärmenetzgebiete, die (\d+) % der Fläche Mülheims"),
    ("waermenetzgebiet_bedarf_gwh", 113, r"Wärmebedarf von rd\. (\d+) GWh/a"),
    ("waermenetzgebiet_bedarfsanteil_pct", 113, r"über (\d+) % des städtischen Gesamtwärmebedarfs"),
    ("fw_absatz_heute_gwh", 115, r"von heutigen (\d+) GWh/a"),
    ("fw_absatz_ziel_gwh", 115, r"auf rd\. (\d+) GWh/a an"),
    ("netzlaenge_heute_km", 115, r"Hausanschlussleitungen rd\. (\d+) km lang"),
    ("netzlaenge_ziel_km", 115, r"beträgt die Länge im Zielzustand (\d+) km"),
    ("trassenanteil_ziel_pct", 115, r"entfallen rd\. (\d+) % auf die Fernwärmetrasse"),
    ("trassenbau_km_pro_jahr", 115, r"Geschwindigkeit von über (\d+) km Trasse"),
    ("netzlaenge_innenstadt_km", 135, r"auf rund (\d+) Kilometern Trassenlänge"),
    ("gebaeude_innenstadtnetz", 135, r"Trassenlänge über (\d+) Gebäude"),
    ("netze_gesamt", 135, r"Alle (zwölf) Wärmenetze"),
    ("netzlaenge_gesamt_km", 136, r"derzeit auf knapp (\d+) Kilometern Trassenlänge"),
    ("gebaeude_alle_netze", 136, r"Trassenlänge rund ([\d.]+) Gebäude"),
    ("gebaeude_umstellung_anteil_pct", 122, r"rund (\d+) % aller Gebäude"),
    ("gebaeude_umstellung_anzahl", 122, r"\(rd\. ([\d.]+) Gebäude\)"),
    ("umstellungen_dezentral_pro_jahr", 122, r"jedes Jahr über ([\d.]+) Gebäude"),
    ("fw_anschluesse_pro_jahr", 122, r"im Mittel (\d+) Fernwärmeanschlüsse"),
    ("zentralheizungen_referenz_pro_jahr", 122, r"durchschnittlich (\d+) neue Zentralheizungen pro Jahr"),
    ("investition_gesamt_mio", 128, r"Investitionsvolumen von rd\. ([\d.]+) Mio"),
    ("einsparung_kesseltausch_mio", 128, r"Anlagenbau von rd\. (\d+)\s*\n?\s*Mio"),
    ("einsparung_fw_reinvest_mio", 128, r"fossile Fernwärmeerzeuger von (\d+) Mio"),
    ("investition_je_einwohner_monat_eur", 128, r"Investitionsanteil von rd\. (\d+) € je Einwohner"),
    ("einwohner", 128, r"die ([\d.]+) Einwohner\*innen"),
    ("investition_waermepumpen_mio", 129, r"Wärmepumpen mit ([\d.]+) Mio\. € bzw\. (?:\d+) %"),
    ("investition_fernwaerme_mio", 129, r"entfallen rd\. (\d+) Mio\. € bzw"),
    ("investition_sanierung_mio", 129, r"Mülheim mit (\d+) Mio\. € rd"),
    ("sanierung_thg_beitrag_pct", 129, r"jedoch nur (\d+) % zur Zielerreichung"),
    ("thg_minderung_2030_pct", 126, r"Jahr 2030\s+zeigt sich eine Reduktion um (\d+) %"),
    ("thg_minderung_2040_pct", 126, r"bis 2040 um (\d+) %"),
    ("thg_minderung_2045_pct", 126, r"bis zum Zieljahr 2045 um (\d+) %"),
    ("endenergie_basis_gwh", 126, r"sinkt von ([\d.]+) GWh/a im Basisjahr"),
    ("endenergie_ziel_gwh", 126, r"auf (\d+) GWh/a im Jahr 2045"),
    ("anschlussquote_bestand_pct", 115, r"Anschlussquote von (\d+) % des Wärmebedarfs"),
    ("anschlussquote_neubau_pct", 115, r"Neubaugebiete eine Anschlussquote von (\d+) %"),
    ("wp_strombedarf_gwh", 120, r"Wärmepumpen von rd\. (\d+) GWh/a"),
    ("wp_netzlast_mw", 120, r"zusätzliche Netzlast von rd\. (\d+) MW"),
    ("massnahmen_text_anzahl", 137, r"Alle (zwölf) Maßnahmen der Umsetzungsstrategie"),
]
ZAHLWORT = {"zwölf": 12}


def eckwerte(pdf):
    txt = {}
    out = {}
    for key, seite, muster in ECKWERTE:
        if seite not in txt:
            txt[seite] = subprocess.run(
                ["pdftotext", "-layout", "-f", str(seite), "-l", str(seite), pdf, "-"],
                check=True, capture_output=True).stdout.decode("utf-8", "replace")
        m = re.search(muster, txt[seite].replace("\n", " "))
        if not m:
            raise SystemExit(f"Eckwert {key!r} auf S. {seite} nicht gefunden — "
                             f"Quelle geändert? Muster: {muster}")
        roh = m.group(1)
        out[key] = {"wert": ZAHLWORT.get(roh, pdfgrid.num(roh)), "seite": seite}
    return out


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=os.environ.get("ENDBERICHT_PDF", ""))
    a = ap.parse_args()
    pdf = a.pdf
    if not pdf or not os.path.exists(pdf):
        pdf = os.path.join(OUT, "_endbericht.pdf")
        if not os.path.exists(pdf):
            print("lade", PDF_URL)
            urllib.request.urlretrieve(PDF_URL, pdf)
    os.makedirs(OUT, exist_ok=True)

    meta = {"quelle": "Endbericht zur Wärmeplanung für Mülheim an der Ruhr",
            "url": PDF_URL, "abruf": ABRUF, "redaktionsdatum": REDAKTION,
            "ratsbeschluss": BESCHLUSS, "seiten_gesamt": 190}

    teile = {
        "endbericht_indikatoren": {"indikatoren": indikatoren(pdf)},
        "endbericht_endenergie": endenergie(pdf),
        "endbericht_thg": thg(pdf),
        "endbericht_gebaeude": gebaeude(pdf),
        "endbericht_fernwaerme_mix": fernwaerme_mix(pdf),
        "endbericht_netze": netz_emissionsfaktoren(pdf),
        "endbericht_massnahmen": {"massnahmen": massnahmen(pdf)},
        "endbericht_eckwerte": {"eckwerte": eckwerte(pdf)},
    }
    for name, payload in teile.items():
        payload = dict(payload)
        payload["_meta"] = meta
        p = os.path.join(OUT, name + ".json")
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=1, sort_keys=True)
            fh.write("\n")
        print(f"  {name}.json  ({os.path.getsize(p) // 1024 or 1} KB)")
    print("ok")


if __name__ == "__main__":
    main()
