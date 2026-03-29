"""Clean and aggregate MaStR + SMARD data into dashboard-ready DataFrames."""

from __future__ import annotations

import logging

import pandas as pd

from src.config import MASTR_NRW_SOLAR_PATH, MASTR_NRW_WIND_PATH, PROCESSED_DIR

log = logging.getLogger(__name__)


def _parse_dates(df: pd.DataFrame, col: str = "Inbetriebnahmedatum") -> pd.DataFrame:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def _add_capacity_mw(df: pd.DataFrame) -> pd.DataFrame:
    """Add a capacity_mw column (Bruttoleistung is in kW)."""
    for src in ("Bruttoleistung", "Nettonennleistung"):
        if src in df.columns:
            df["capacity_mw"] = df[src] / 1_000
            break
    return df


def load_combined_installations() -> pd.DataFrame:
    """Load solar + wind, tag with *technology*, return unified DataFrame."""
    frames = []
    for path, tech in [
        (MASTR_NRW_SOLAR_PATH, "Solar"),
        (MASTR_NRW_WIND_PATH, "Wind"),
    ]:
        if not path.exists():
            log.warning("Missing %s — run ingest first.", path)
            continue
        df = pd.read_parquet(path)
        df["technology"] = tech
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    combined = _parse_dates(combined)
    combined = _add_capacity_mw(combined)
    return combined


def cumulative_capacity(df: pd.DataFrame) -> pd.DataFrame:
    """Return yearly cumulative installed capacity (MW) by technology.

    Expects columns: Inbetriebnahmedatum, capacity_mw, technology.
    """
    if df.empty:
        return df

    df = df.dropna(subset=["Inbetriebnahmedatum", "capacity_mw"]).copy()
    df["year"] = df["Inbetriebnahmedatum"].dt.year

    annual = (
        df.groupby(["year", "technology"])["capacity_mw"]
        .sum()
        .reset_index()
        .rename(columns={"capacity_mw": "added_mw"})
    )
    annual = annual.sort_values(["technology", "year"])
    annual["cumulative_mw"] = annual.groupby("technology")["added_mw"].cumsum()
    return annual


def monthly_additions(df: pd.DataFrame) -> pd.DataFrame:
    """Monthly new installations count + capacity by technology."""
    if df.empty:
        return df

    df = df.dropna(subset=["Inbetriebnahmedatum"]).copy()
    df["month"] = df["Inbetriebnahmedatum"].dt.to_period("M")

    monthly = (
        df.groupby(["month", "technology"])
        .agg(count=("EinheitMastrNummer", "count"), capacity_mw=("capacity_mw", "sum"))
        .reset_index()
    )
    monthly["month"] = monthly["month"].dt.to_timestamp()
    return monthly.sort_values("month")


def aggregate_smard_monthly(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate hourly SMARD generation to monthly totals (GWh)."""
    if df.empty or "timestamp" not in df.columns:
        return df
    df = df.copy()
    df["month"] = pd.to_datetime(df["timestamp"]).dt.to_period("M")

    energy_cols = [c for c in df.columns if c not in ("timestamp_ms", "timestamp", "month")]
    monthly = df.groupby("month")[energy_cols].sum() / 1_000  # MW·h → GWh
    monthly.index = monthly.index.to_timestamp()
    monthly.index.name = "month"
    return monthly.reset_index()
