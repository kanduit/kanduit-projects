#!/usr/bin/env python3
"""Validate cached data and print summary stats.

This script is a lightweight post-processing step.  The heavy lifting
(download + NRW filtering) happens in `scripts/ingest.py`.

Usage:
    python scripts/process.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import (
    DEPLOY_DIR,
    MASTR_NRW_SOLAR_PATH,
    MASTR_NRW_WIND_PATH,
    MASTR_PROCESSED_SOLAR_PATH,
    MASTR_PROCESSED_WIND_PATH,
    SMARD_GENERATION_PATH,
)
from src.processing.targets import compute_gap
from src.processing.transform import (
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

    log.info("── Processed (full) files ──")
    for path, label in [
        (MASTR_PROCESSED_SOLAR_PATH, "Solar NRW (processed)"),
        (MASTR_PROCESSED_WIND_PATH, "Wind NRW (processed)"),
        (SMARD_GENERATION_PATH, "SMARD Erzeugung"),
    ]:
        if path.exists():
            log.info("  ✓ %s vorhanden: %s", label, path)
        else:
            log.warning("  ✗ %s FEHLT: %s", label, path)

    log.info("── Deploy (slim) files ──")
    for path, label in [
        (MASTR_NRW_SOLAR_PATH, "Solar NRW (deploy)"),
        (MASTR_NRW_WIND_PATH, "Wind NRW (deploy)"),
    ]:
        if path.exists():
            size_mb = path.stat().st_size / 1_048_576
            log.info("  ✓ %s vorhanden: %s (%.1f MB)", label, path, size_mb)
        else:
            log.warning("  ✗ %s FEHLT: %s — run scripts/prepare_deploy.py", label, path)

    log.info("Installationsdaten laden …")
    df = load_combined_installations()
    if df.empty:
        log.error("Keine Installationsdaten gefunden. Bitte Pipeline ausführen:")
        log.error("  1. python scripts/ingest.py")
        log.error("  2. python scripts/prepare_deploy.py")
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

    total_deploy = sum(f.stat().st_size for f in DEPLOY_DIR.glob("*.parquet"))
    if total_deploy:
        log.info("Deploy-Daten gesamt: %.1f MB", total_deploy / 1_048_576)

    log.info("═══ Verarbeitung abgeschlossen ═══")


if __name__ == "__main__":
    main()
