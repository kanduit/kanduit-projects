# -*- coding: utf-8 -*-
"""
pdfgrid.py — Wort-Koordinaten aus einem PDF (poppler `pdftotext -bbox-layout`)
zu Zeilen und Spalten gruppieren.

Warum koordinatenbasiert und nicht `-layout`-Text: Im Endbericht der
Wärmeplanung sind mehrere Tabellen mit umbrochenen Zellen und vertikal
verbundenen Zellen gesetzt. Ein reiner Textumbruch verliert dort die
Spaltenzuordnung (die Zeile „Reduktion des Wärmebedarfs im" trägt ihre Werte
eine Zeile tiefer). Über die x-Mitte jedes Wortes bleibt die Zuordnung exakt.

Nur Standardbibliothek; `pdftotext` (poppler) muss auf dem Pfad liegen.
"""
import html
import re
import subprocess

WORD_RE = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>',
    re.S)


def words(pdf_path, page):
    """Alle Wörter einer Seite als [{x0,x1,y0,y1,cx,cy,t}], oben-links zuerst."""
    xml = subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), "-bbox-layout",
         pdf_path, "-"],
        check=True, capture_output=True).stdout.decode("utf-8", "replace")
    out = []
    for x0, y0, x1, y1, t in WORD_RE.findall(xml):
        t = html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
        if not t:
            continue
        x0, y0, x1, y1 = float(x0), float(y0), float(x1), float(y1)
        out.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1,
                    "cx": (x0 + x1) / 2, "cy": (y0 + y1) / 2, "t": t})
    out.sort(key=lambda w: (round(w["cy"], 1), w["x0"]))
    return out


def lines(ws, ytol=3.0):
    """Wörter zu Textzeilen bündeln (gleiche Grundlinie ± ytol)."""
    rows = []
    for w in sorted(ws, key=lambda w: (w["cy"], w["x0"])):
        if rows and abs(w["cy"] - rows[-1][-1]["cy"]) <= ytol:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda w: w["x0"]) for r in rows]


def cells(line, bounds):
    """Eine Textzeile auf Spalten verteilen. bounds = aufsteigende x-Grenzen
    zwischen den Spalten; len(bounds)+1 Spalten kommen zurück."""
    cols = [[] for _ in range(len(bounds) + 1)]
    for w in line:
        i = 0
        while i < len(bounds) and w["cx"] >= bounds[i]:
            i += 1
        cols[i].append(w["t"])
    return [" ".join(c).strip() for c in cols]


def table(pdf_path, page, bounds, y0=0, y1=10000, ytol=3.0):
    """Tabellenzeilen einer Seite im y-Fenster [y0, y1] als Spaltenlisten."""
    ws = [w for w in words(pdf_path, page) if y0 <= w["cy"] <= y1]
    return [cells(l, bounds) for l in lines(ws, ytol)]


def num(s):
    """Deutsche Zahl → float. '1.248' → 1248.0, '7,5 %' → 7.5, '~ 5.000' → 5000."""
    s = re.sub(r"[^\d,.\-]", "", str(s).replace("−", "-"))
    if not s or s in {"-", "."}:
        return None
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None
