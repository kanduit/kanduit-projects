#!/usr/bin/env python3
"""Transform raw cached data into dashboard-ready Parquet files.

This script is a lightweight post-processing step.  The heavy lifting
(download + NRW filtering) happens in `scripts/ingest.py`.  This script
validates the cached data and prints summary stats.

Usage:
    python scripts/process.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import MASTR_NRW_SOLAR_PATH, MASTR_NRW_WIND_PATH, SMARD_GENERATION_PATH
from src.processing.targets import compute_gap
from src.processing.transform import (
    aggregate_smard_monthly,
    cumulative_capacity,
    load_combined_installations,
    monthly_additions,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def main() -> None:
    log.info("═══ Datenverarbeitung starten ═══")

    for path, label in [
        (MASTR_NRW_SOLAR_PATH, "Solar NRW"),
        (MASTR_NRW_WIND_PATH, "Wind NRW"),
        (SMARD_GENERATION_PATH, "SMARD Erzeugung"),
    ]:
        if path.exists():
            log.info("  ✓ %s vorhanden: %s", label, path)
        else:
            log.warning("  ✗ %s FEHLT: %s", label, path)

    log.info("Installationsdaten laden …")
    df = load_combined_installations()
    if df.empty:
        log.error("Keine Installationsdaten gefunden. Bitte 'scripts/ingest.py' ausführen.")
        sys.exit(1)

    log.info("  Anlagen gesamt: %s", f"{len(df):,}")
    log.info("  Davon Solar: %s", f"{len(df[df['technology'] == 'Solar']):,}")
    log.info("  Davon Wind: %s", f"{len(df[df['technology'] == 'Wind']):,}")

    annual = cumulative_capacity(df)
    log.info("Jährliche Kapazität berechnet (%d Datenpunkte).", len(annual))

    monthly = monthly_additions(df)
    log.info("Monatliche Zubauten berechnet (%d Datenpunkte).", len(monthly))

    gaps = compute_gap(annual)
    for g in gaps:
        emoji = "✅" if g.gap_years == 0 else "🔴"
        log.info(
            "  %s %s: %.1f / %.0f GW — Rückstand %+.0f Jahre",
            emoji,
            g.technology,
            g.current_gw,
            g.target_gw,
            g.gap_years,
        )

    if SMARD_GENERATION_PATH.exists():
        import pandas as pd

        smard = pd.read_parquet(SMARD_GENERATION_PATH)
        smard_monthly = aggregate_smard_monthly(smard)
        log.info("SMARD monatlich aggregiert: %d Monate.", len(smard_monthly))

    log.info("═══ Verarbeitung abgeschlossen ═══")


if __name__ == "__main__":
    main()
