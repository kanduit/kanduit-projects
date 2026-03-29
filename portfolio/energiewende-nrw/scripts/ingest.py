#!/usr/bin/env python3
"""Download raw data from MaStR and SMARD APIs.

Usage:
    python scripts/ingest.py              # download everything
    python scripts/ingest.py --mastr      # MaStR only
    python scripts/ingest.py --smard      # SMARD only
    python scripts/ingest.py --geodata    # municipality GeoJSON only
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ingest.mastr import download_bulk, extract_nrw
from src.ingest.smard import download_generation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Energiewende NRW — Daten-Ingestion")
    parser.add_argument("--mastr", action="store_true", help="Nur MaStR herunterladen")
    parser.add_argument("--smard", action="store_true", help="Nur SMARD herunterladen")
    parser.add_argument("--geodata", action="store_true", help="Nur Gemeinde-GeoJSON herunterladen")
    args = parser.parse_args()

    run_all = not (args.mastr or args.smard or args.geodata)

    if run_all or args.geodata:
        log.info("═══ Gemeinde-Geodaten herunterladen ═══")
        from scripts.download_geodata import download as dl_geo
        dl_geo()

    if run_all or args.mastr:
        log.info("═══ MaStR Bulk-Download starten ═══")
        download_bulk()
        log.info("═══ NRW-Filter + Parquet-Export ═══")
        results = extract_nrw()
        for tech, df in results.items():
            log.info("  %s: %s Anlagen in NRW", tech, f"{len(df):,}")

    if run_all or args.smard:
        log.info("═══ SMARD Erzeugungsdaten herunterladen ═══")
        df = download_generation()
        log.info("  %s Zeilen heruntergeladen", f"{len(df):,}")

    log.info("═══ Ingestion abgeschlossen ═══")


if __name__ == "__main__":
    main()
