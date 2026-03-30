"""Download MaStR data and filter to NRW.

Uses the open-mastr package to bulk-download the national register, then
filters to Nordrhein-Westfalen and persists as Parquet.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from open_mastr import Mastr

from src.config import (
    MASTR_PROCESSED_COMBUSTION_PATH,
    MASTR_PROCESSED_SOLAR_PATH,
    MASTR_PROCESSED_WIND_PATH,
    MASTR_TECHNOLOGIES,
    NRW_BUNDESLAND,
    PROCESSED_DIR,
)

log = logging.getLogger(__name__)

_COMMON_COLS = [
    "EinheitMastrNummer",
    "Bruttoleistung",
    "Nettonennleistung",
    "EinheitBetriebsstatus",
    "Inbetriebnahmedatum",
    "GemeindeName",
    "Gemeindeschluessel",
    "Postleitzahl",
    "Bundesland",
    "Breitengrad",
    "Laengengrad",
    "Energietraeger",
]

_SOLAR_EXTRA = [
    "Lage",
    "Leistungsbegrenzung",
    "Hauptausrichtung",
    "Nutzungsbereich",
]

_WIND_EXTRA = [
    "Nabenhoehe",
    "Rotordurchmesser",
    "Hersteller",
    "Typenbezeichnung",
]

_COMBUSTION_EXTRA = [
    "Hauptbrennstoff",
    "Technologie",
]

_OUTPUT_MAP: dict[str, tuple[list[str], Path]] = {
    "solar": (_COMMON_COLS + _SOLAR_EXTRA, MASTR_PROCESSED_SOLAR_PATH),
    "wind": (_COMMON_COLS + _WIND_EXTRA, MASTR_PROCESSED_WIND_PATH),
    "combustion": (_COMMON_COLS + _COMBUSTION_EXTRA, MASTR_PROCESSED_COMBUSTION_PATH),
}


def download_bulk(technologies: list[str] | None = None) -> None:
    """Run the open-mastr bulk download into a local SQLite DB."""
    techs = technologies or MASTR_TECHNOLOGIES
    log.info("Starting MaStR bulk download for: %s", techs)
    db = Mastr()
    db.download(method="bulk", data=techs, bulk_cleansing=True)
    log.info("Bulk download complete.")


def _safe_select(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Select only columns that actually exist in *df*."""
    present = [c for c in cols if c in df.columns]
    return df[present]


def extract_nrw(technologies: list[str] | None = None) -> dict[str, pd.DataFrame]:
    """Read the local SQLite DB, filter to NRW, and save Parquet files.

    Returns a dict mapping technology name -> filtered DataFrame.
    """
    techs = technologies or MASTR_TECHNOLOGIES
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    db = Mastr()
    results: dict[str, pd.DataFrame] = {}

    table_map = {
        "solar": "solar_extended",
        "wind": "wind_extended",
        "combustion": "combustion_extended",
    }

    for tech in techs:
        table_name = table_map.get(tech)
        if table_name is None:
            log.warning("No table mapping for technology '%s'; skipping.", tech)
            continue

        log.info("Reading table '%s' from local MaStR DB …", table_name)
        df = pd.read_sql(table_name, con=db.engine)
        log.info("  Total rows (national): %s", f"{len(df):,}")

        state_col = "Bundesland"
        if state_col not in df.columns:
            for candidate in ["bundesland", "state", "State"]:
                if candidate in df.columns:
                    state_col = candidate
                    break

        df_nrw = df.loc[df[state_col] == NRW_BUNDESLAND].copy()
        log.info("  NRW rows: %s", f"{len(df_nrw):,}")

        desired_cols, out_path = _OUTPUT_MAP[tech]
        df_nrw = _safe_select(df_nrw, desired_cols)
        df_nrw.to_parquet(out_path, index=False)
        log.info("  Saved → %s", out_path)
        results[tech] = df_nrw

    return results


def load_nrw_solar() -> pd.DataFrame:
    """Load cached NRW solar Parquet (run extract_nrw first)."""
    return pd.read_parquet(MASTR_PROCESSED_SOLAR_PATH)


def load_nrw_wind() -> pd.DataFrame:
    """Load cached NRW wind Parquet."""
    return pd.read_parquet(MASTR_PROCESSED_WIND_PATH)


def load_nrw_combustion() -> pd.DataFrame:
    """Load cached NRW combustion Parquet."""
    return pd.read_parquet(MASTR_PROCESSED_COMBUSTION_PATH)
