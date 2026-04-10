#!/usr/bin/env python3
"""Prepare slim parquet files for Streamlit Cloud deployment.

Reads full MaStR parquets from data/processed/, prunes to only the columns
used by the dashboard, optimizes dtypes, and writes compressed parquets to
data/deploy/.  Run this locally after ingest, then commit data/deploy/.

Usage:
    python scripts/prepare_deploy.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import (
    DEPLOY_DIR,
    MASTR_PROCESSED_COMBUSTION_PATH,
    MASTR_PROCESSED_SOLAR_PATH,
    MASTR_PROCESSED_WIND_PATH,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


SOLAR_WIND_COLUMNS = [
    "EinheitMastrNummer",
    "Bruttoleistung",
    "Inbetriebnahmedatum",
    "GemeindeName",
    "Gemeindeschluessel",
    "Breitengrad",
    "Laengengrad",
]

COMBUSTION_COLUMNS = [
    "Bruttoleistung",
    "Inbetriebnahmedatum",
    "GemeindeName",
    "Breitengrad",
    "Laengengrad",
]

FLOAT32_COLS = {"Bruttoleistung", "Breitengrad", "Laengengrad"}
CATEGORY_COLS = {"GemeindeName", "Gemeindeschluessel"}


def _safe_select(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    present = [c for c in cols if c in df.columns]
    return df[present].copy()


def _optimize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if col in FLOAT32_COLS:
            df[col] = df[col].astype("float32")
        elif col in CATEGORY_COLS:
            df[col] = df[col].astype("category")
    return df


def _process_tech(
    source_path: Path,
    dest_name: str,
    columns: list[str],
) -> None:
    if not source_path.exists():
        log.warning("Source missing: %s — skipping", source_path)
        return

    df = pd.read_parquet(source_path)
    original_size = source_path.stat().st_size
    log.info("  Read %s rows, %d columns from %s (%.1f MB on disk)",
             f"{len(df):,}", len(df.columns), source_path.name,
             original_size / 1_048_576)

    df = _safe_select(df, columns)
    df = _optimize_dtypes(df)

    out_path = DEPLOY_DIR / dest_name
    df.to_parquet(out_path, index=False, compression="zstd")
    new_size = out_path.stat().st_size
    log.info("  Wrote %s → %.1f MB  (%.0f%% reduction)",
             out_path.name, new_size / 1_048_576,
             (1 - new_size / original_size) * 100 if original_size else 0)


def main() -> None:
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
    log.info("═══ Preparing deploy parquets → %s ═══", DEPLOY_DIR)

    _process_tech(MASTR_PROCESSED_SOLAR_PATH, "nrw_solar.parquet", SOLAR_WIND_COLUMNS)
    _process_tech(MASTR_PROCESSED_WIND_PATH, "nrw_wind.parquet", SOLAR_WIND_COLUMNS)
    _process_tech(MASTR_PROCESSED_COMBUSTION_PATH, "nrw_combustion.parquet", COMBUSTION_COLUMNS)

    total = sum(f.stat().st_size for f in DEPLOY_DIR.glob("*.parquet"))
    log.info("═══ Done — total deploy data: %.1f MB ═══", total / 1_048_576)


if __name__ == "__main__":
    main()
