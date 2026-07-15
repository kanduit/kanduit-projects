# -*- coding: utf-8 -*-
"""
generate.py — aggregate the committed data snapshots (data/sources/) into
data.js for the Kanduit {{TITLE}}.

Run:  python3 scripts/generate.py     (from the project folder)

Conventions (do not break):
- Reads ONLY files under data/sources/ — no network access, so the build is
  reproducible offline. Fetching lives in scripts/fetch_<quelle>.py.
- Output must be DETERMINISTIC: running twice yields a byte-identical data.js
  (meta.stand comes from the snapshots, never from datetime.now()).
- Aggregates only; no personal data, no company/winner names.
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

HEADER = (
    "/* Kanduit {{TITLE}} — aggregierte öffentliche Daten.\n"
    "   Quelle(n): TODO — Abruf siehe meta.stand.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)


def write_data_js(payload):
    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_{{DATA_KEY}} = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out)


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    if not files:
        raise SystemExit("no snapshots found — run scripts/fetch_<quelle>.py first")

    # TODO: Snapshots laden und zu Kennzahlen aggregieren.
    # payload-Konvention: {"meta": {"stand": "TT.MM.JJJJ", "quellen": {...}}, ...}
    # meta.stand aus den Snapshot-Metadaten übernehmen (fetch-Datum).
    raise SystemExit("TODO: Aggregation implementieren (siehe Docstring)")


if __name__ == "__main__":
    main()
