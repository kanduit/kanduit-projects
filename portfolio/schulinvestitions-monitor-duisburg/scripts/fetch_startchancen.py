# -*- coding: utf-8 -*-
"""
fetch_startchancen.py — Startchancen-Programm NRW, Saeule I.

Erzeugt zwei kleine Snapshots in data/sources/:

  startchancen_schulen_du.json — die Duisburger Schulen auf der bestaetigten
      Teilnehmerliste des Landes (Gesamtliste beider Aufnahmegruppen), je
      Eintrag Schulnummer, Schulform und Kurzbezeichnung. Die Schulnummer ist
      der Verbindungsschluessel zum Schulverzeichnis des MSB — die
      Kurzbezeichnung taugt nicht dafuer, weil die Teilnehmerliste bei
      Foerderschulen den Foerderschwerpunkt weglaesst ('FOE Eschenstr.' gegen
      'FOE LE Eschenstr.').
  startchancen_budget_du.json — das Schultraegerbudget der Stadt Duisburg im
      Investitionsprogramm Saeule I (2024 bis 2034), plus die Landessumme als
      Einordnung.

Quellen (beide PDF, Bildungsportal NRW):
  https://www.schulministerium.nrw/startchancen
  .../startchancen-programm_bestaetigte_teilnehmerliste_gesamt_stand_250521.pdf
  .../schultraegerbudgets_investitionsprogramm_saeule_i_startchancen_250702.pdf

Die PDF-Textextraktion ist bewusst stdlib-only (zlib + Regex ueber die
Content-Streams, ToUnicode-CMap fuer CID-Schriften) — damit bleibt der Build
ohne Fremdbibliotheken reproduzierbar.

Nur Einrichtungsdaten, keine personenbezogenen Daten.

Aufruf:  python3 scripts/fetch_startchancen.py
"""
import datetime
import json
import os
import re
import urllib.request
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "sources")

SITE = "https://www.schulministerium.nrw/system/files/media/document/file/"
URL_LISTE = SITE + "startchancen-programm_bestaetigte_teilnehmerliste_gesamt_stand_250521.pdf"
URL_BUDGET = SITE + "schultraegerbudgets_investitionsprogramm_saeule_i_startchancen_250702.pdf"
URL_SEITE = "https://www.schulministerium.nrw/startchancen"

# Die erste Aufnahmegruppe (Schuljahr 2024/25) wird nur noch als Herkunftsnachweis
# gefuehrt; massgeblich ist die Gesamtliste oben.
URL_LISTE_G1 = SITE + "startchancen-programm_bestaetigte_teilnehmerliste_schuljahr_24_25_stand_240524.pdf"

STAND_LISTE = "2025-05-21"   # Dateistand laut Dateiname und Deckblatt
STAND_BUDGET = "2025-07-02"

TRAEGER = "Stadt Duisburg"
PRAEFIX = "Duisburg,"        # Kurzbezeichnungen des MSB beginnen mit dem Ort

UA = {"User-Agent": "kanduit-schulinvestitions-monitor/1.0 (+https://kanduit.de)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as fh:
        return fh.read()


# ---------------------------------------------------------------- PDF-Text
def _objects(raw):
    """Rohe Bodies aller 'N 0 obj' im PDF, nach Objektnummer."""
    objs = {}
    for m in re.finditer(rb"(\d+)\s+0\s+obj\b", raw):
        start = m.end()
        end = raw.find(b"endobj", start)
        objs[int(m.group(1))] = raw[start:end if end > 0 else len(raw)]
    return objs


def _stream(body):
    m = re.search(rb"stream\r?\n", body or b"")
    if not m:
        return None
    end = body.find(b"endstream", m.end())
    data = body[m.end():end if end > 0 else len(body)]
    try:
        return zlib.decompress(data)
    except zlib.error:
        return data


def _tounicode(objs):
    """cid -> Zeichen, aus allen ToUnicode-CMaps des Dokuments."""
    cmap = {}
    for body in objs.values():
        ref = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", body)
        if not ref:
            continue
        cs = _stream(objs.get(int(ref.group(1))))
        if not cs:
            continue
        for blk in re.finditer(rb"beginbfchar(.*?)endbfchar", cs, re.S):
            for src, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk.group(1)):
                cmap[int(src, 16)] = bytes.fromhex(dst.decode()).decode("utf-16-be", "replace")
        for blk in re.finditer(rb"beginbfrange(.*?)endbfrange", cs, re.S):
            for lo, hi, dst in re.findall(
                    rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk.group(1)):
                lo_i, hi_i, base = int(lo, 16), int(hi, 16), int(dst, 16)
                for k in range(lo_i, min(hi_i, lo_i + 4096) + 1):
                    cmap[k] = chr(base + (k - lo_i))
    return cmap


def pdf_cells(raw):
    """Textzellen eines PDF in Lesereihenfolge.

    Jede Positionierung (Td/TD/Tm/T*/ET) beendet eine Zelle — bei den beiden
    Listen-PDF entspricht eine Zelle genau einer Tabellenzelle.
    Literale Strings '(...)' und Hex-Strings '<...>' werden beide gelesen; fuer
    Hex-Strings uebersetzt die ToUnicode-CMap die CIDs zurueck nach Text.
    """
    objs = _objects(raw)
    cmap = _tounicode(objs)
    token = re.compile(rb"\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f]+)>"
                       rb"|\bTd\b|\bTD\b|\bT\*\b|\bTm\b|\bET\b")
    cells = []
    for body in objs.values():
        cs = _stream(body)
        if not cs or (b"Tj" not in cs and b"TJ" not in cs):
            continue
        buf = []
        for tok in token.finditer(cs):
            hexstr = tok.group(1)
            raw_tok = tok.group(0)
            if hexstr is not None:
                b = bytes.fromhex(hexstr.decode())
                buf.append("".join(cmap.get(int.from_bytes(b[i:i + 2], "big"), "")
                                   for i in range(0, len(b) - 1, 2)))
            elif raw_tok.startswith(b"("):
                buf.append(re.sub(rb"\\([()\\])", rb"\1", raw_tok[1:-1]).decode("latin-1"))
            elif buf:
                cells.append("".join(buf))
                buf = []
        if buf:
            cells.append("".join(buf))
    return [c for c in (re.sub(r"\s+", " ", c).strip() for c in cells) if c]


def eur(s):
    """'60.048.769,33' -> 60048769.33"""
    return float(s.replace(".", "").replace(",", "."))


def main():
    os.makedirs(OUT, exist_ok=True)
    abruf = datetime.date.today().isoformat()

    # ------------------------------------------------ Teilnehmerliste
    print("lade bestaetigte Teilnehmerliste …")
    cells = pdf_cells(get(URL_LISTE))
    # Spaltenfolge je Tabellenzeile:
    #   Traeger | Schulform | Schulnummer (6-stellig) | Kurzbezeichnung
    # Die Schulnummer ist der eindeutige Anker; von ihr aus liegen die
    # Nachbarspalten fest.
    schulen, gesamt_nrw = {}, 0
    for i, c in enumerate(cells):
        if not re.fullmatch(r"\d{6}", c) or i < 2 or i + 1 >= len(cells):
            continue
        gesamt_nrw += 1
        if cells[i - 2] != TRAEGER:
            continue
        schulen[c] = {
            "nr": c,
            "form_text": cells[i - 1],
            "kurz": cells[i + 1],
        }
    uniq = [schulen[k] for k in sorted(schulen)]
    if len(uniq) < 20:
        raise SystemExit("unerwartet wenige Startchancen-Schulen (%d) — Quelle pruefen"
                         % len(uniq))
    print("  %d Duisburger Schulen (Zeilen in NRW gesamt: %d)" % (len(uniq), gesamt_nrw))

    # ------------------------------------------------ Schultraegerbudget
    print("lade Schultraegerbudgets Saeule I …")
    bcells = pdf_cells(get(URL_BUDGET))
    budget_du = None
    for i, c in enumerate(bcells):
        if c == TRAEGER:
            for nxt in bcells[i + 1:i + 4]:
                if re.fullmatch(r"[\d.]+,\d{2}", nxt):
                    budget_du = eur(nxt)
                    break
        if budget_du is not None:
            break
    if budget_du is None:
        raise SystemExit("Schultraegerbudget fuer %s nicht gefunden — Quelle pruefen" % TRAEGER)
    landessumme = max((eur(c) for c in bcells if re.fullmatch(r"[\d.]+,\d{2}", c)), default=None)
    anzahl_nrw = None
    for c in bcells:
        m = re.search(r"der (\d[\d.]*) Startchancen-Schulen", c)
        if m:
            anzahl_nrw = int(m.group(1).replace(".", ""))
            break
    print("  Budget %s: %s EUR" % (TRAEGER, format(budget_du, ",.2f").replace(",", ".")))

    dump(os.path.join(OUT, "startchancen_schulen_du.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — bestaetigte "
                      "Teilnehmerliste Startchancen-Programm (Gesamtliste beider "
                      "Aufnahmegruppen)",
            "quelle_url": URL_SEITE,
            "dateien": [URL_LISTE],
            "erste_gruppe_2024_25": URL_LISTE_G1,
            "filter": "Schultraeger '%s'" % TRAEGER,
            "stand": STAND_LISTE,
            "abruf": abruf,
            "zeilen_nrw": gesamt_nrw,
            "hinweis": "Verbindungsschluessel zum Schulverzeichnis ist die "
                       "Schulnummer. Die Liste nennt keine personenbezogenen "
                       "Daten.",
        },
        "schulen": uniq,
    })
    dump(os.path.join(OUT, "startchancen_budget_du.json"), {
        "meta": {
            "quelle": "Ministerium fuer Schule und Bildung NRW — Schultraegerbudgets "
                      "zur Umsetzung der Saeule I (Investitionsprogramm) des "
                      "Startchancen-Programms 2024 bis 2034",
            "quelle_url": URL_SEITE,
            "dateien": [URL_BUDGET],
            "stand": STAND_BUDGET,
            "abruf": abruf,
        },
        "traeger": TRAEGER,
        "investitionsbudget_eur": round(budget_du, 2),
        "landessumme_eur": round(landessumme, 2) if landessumme else None,
        "startchancen_schulen_nrw": anzahl_nrw,
        "laufzeit": {"von": 2024, "bis": 2034},
    })


def dump(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print("wrote", path, "(%d B)" % os.path.getsize(path))


if __name__ == "__main__":
    main()
