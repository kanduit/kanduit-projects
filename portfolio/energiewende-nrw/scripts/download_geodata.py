#!/usr/bin/env python3
"""Download NRW municipality boundaries (GeoJSON) from open data.

Source: Bundesamt für Kartographie und Geodäsie (BKG) – open data.
Fallback: opendatasoft / Geoportal NRW.

Usage:
    python scripts/download_geodata.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = PROJECT_ROOT / "data" / "reference" / "nrw_gemeinden.geojson"

OPENDATASOFT_URL = (
    "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
    "georef-germany-gemeinde/exports/geojson"
    "?where=lan_name%20%3D%20%22Nordrhein-Westfalen%22"
    "&limit=-1"
)


def download() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if OUT_PATH.exists():
        log.info("GeoJSON already exists at %s — skipping download.", OUT_PATH)
        return

    log.info("Downloading NRW municipality boundaries …")
    resp = requests.get(OPENDATASOFT_URL, timeout=120)
    resp.raise_for_status()

    geojson = resp.json()
    n_features = len(geojson.get("features", []))
    log.info("Received %d municipality features.", n_features)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    log.info("Saved → %s", OUT_PATH)


if __name__ == "__main__":
    try:
        download()
    except Exception as exc:
        log.error("Download failed: %s", exc)
        sys.exit(1)
