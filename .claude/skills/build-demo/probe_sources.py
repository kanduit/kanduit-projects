#!/usr/bin/env python3
"""
probe_sources.py — two GETs per source, no substitution.

Step 1 of /build-demo. The brief is older than the sources. This script
fetches the named file URL and any --landing catalog URL. It never invents
a replacement URL. A dead source is a question for the human.

Usage:
  python3 .claude/skills/build-demo/probe_sources.py URL [URL ...]
  python3 .claude/skills/build-demo/probe_sources.py --landing https://portal.example/ \\
      https://portal.example/file.csv
  python3 .claude/skills/build-demo/probe_sources.py --from-generate portfolio/<slug>/scripts/generate.py

Exit 1 only when a named file or a --landing URL is dead. A 403 on the
parent directory of a file is printed as NOTE. That path is not the
catalog page the brief names.
"""
from __future__ import annotations

import argparse
import ast
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

UA = "kanduit-build-demo-probe/1 (+https://github.com/kanduit/kanduit-projects)"
TIMEOUT = 25


def _assign(tree, name):
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name:
                    try:
                        return ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        return None
    return None


def quellen_from_generate(path):
    with open(path, encoding="utf-8") as fh:
        tree = ast.parse(fh.read(), filename=path)
    quellen = _assign(tree, "QUELLEN") or {}
    rows = []
    for key, meta in quellen.items():
        if isinstance(meta, dict) and meta.get("u"):
            rows.append((key, meta.get("t") or key, meta["u"]))
    return rows


def looks_like_file(url):
    path = urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    return ext in {
        ".pdf", ".csv", ".json", ".zip", ".xlsx", ".xls", ".geojson",
        ".xml", ".txt", ".tsv", ".gpkg",
    }


def landing_url(url):
    parsed = urlparse(url)
    parent = parsed.path.rsplit("/", 1)[0] + "/"
    return urljoin(url, parent)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read(2048)
            return {
                "ok": True,
                "status": getattr(resp, "status", 200),
                "url": resp.geturl(),
                "ctype": resp.headers.get("Content-Type", ""),
                "length": resp.headers.get("Content-Length", ""),
                "modified": resp.headers.get("Last-Modified", ""),
                "bytes": len(raw),
            }
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "url": url, "error": str(e.reason)}
    except Exception as e:
        return {"ok": False, "status": 0, "url": url, "error": type(e).__name__ + ": " + str(e)}


def report_one(label, url, kind):
    r = fetch(url)
    if r["ok"]:
        extra = f" {r['ctype']}" if r.get("ctype") else ""
        loc = r["url"] if r["url"] != url else ""
        loc_s = f" → {loc}" if loc else ""
        print(f"  OK  {r['status']} {kind} {label}: {url}{extra}{loc_s}")
        return True
    print(f"  DEAD {r['status']} {kind} {label}: {url}  ({r.get('error', '')})")
    return False


def probe(rows, landings=None):
    """rows: list of (key, title, url). Returns True if every named GET succeeded."""
    ok = True
    if not rows and not landings:
        print("probe_sources: keine URLs")
        return False
    file_rows = [r for r in rows if looks_like_file(r[2])]
    if file_rows and not landings:
        print("  WARN keine --landing Katalog-URL. "
              "Parent-Verzeichnisse sind nicht die Open-Data-Seite.",
              file=sys.stderr)
    for key, title, url in rows:
        print(f"{key} — {title}")
        if not report_one(key, url, "datei"):
            ok = False
        if looks_like_file(url):
            listing = landing_url(url)
            if listing != url:
                r = fetch(listing)
                if r["ok"]:
                    print(f"  OK  {r['status']} listing {key}: {listing}")
                else:
                    print(f"  NOTE {r['status']} listing {key}: {listing}  "
                          f"(kein Directory-Listing — Katalog-URL als --landing übergeben)")
        print("  keine Ersatz-URL. Bei DEAD die menschliche Quelle fragen.")
    for i, url in enumerate(landings or []):
        print(f"landing{i + 1} — Katalog")
        if not report_one(f"landing{i + 1}", url, "landing"):
            ok = False
        print("  keine Ersatz-URL. Bei DEAD die menschliche Quelle fragen.")
    return ok


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--from-generate", metavar="PATH")
    ap.add_argument("--landing", action="append", default=[],
                    help="Katalog- oder Portal-URL der Quelle (wiederholbar)")
    args = ap.parse_args(argv)
    rows = []
    if args.from_generate:
        rows.extend(quellen_from_generate(args.from_generate))
    for i, url in enumerate(args.urls):
        rows.append((f"url{i + 1}", url, url))
    if not rows and not args.landing:
        ap.error("URL, --landing oder --from-generate angeben")
    return 0 if probe(rows, args.landing) else 1


if __name__ == "__main__":
    sys.exit(main())
