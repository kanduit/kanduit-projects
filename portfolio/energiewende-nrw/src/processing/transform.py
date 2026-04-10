"""Clean and aggregate MaStR data into dashboard-ready DataFrames."""

from __future__ import annotations

import json
import logging

import pandas as pd

from src.config import GEMEINDEN_GEOJSON_PATH, MASTR_NRW_SOLAR_PATH, MASTR_NRW_WIND_PATH

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


def load_gemeinde_lookup() -> pd.DataFrame:
    """Build AGS → GemeindeName lookup from the NRW GeoJSON reference file.

    The GeoJSON uses 12-digit Regionalschlüssel (RS) in ``gem_code``, while
    MaStR deploy parquets use the 8-digit Amtlicher Gemeindeschlüssel (AGS).
    Conversion: AGS = RS[:5] + RS[9:]
    """
    if not GEMEINDEN_GEOJSON_PATH.exists():
        return pd.DataFrame(columns=["Gemeindeschluessel", "GemeindeName"])

    with open(GEMEINDEN_GEOJSON_PATH) as f:
        gj = json.load(f)

    rows = []
    for feat in gj["features"]:
        props = feat["properties"]
        rs = props["gem_code"][0]
        ags = rs[:5] + rs[9:]
        name = props["gem_name_short"][0]
        rows.append({"Gemeindeschluessel": ags, "GemeindeName": name})

    return pd.DataFrame(rows).drop_duplicates(subset=["Gemeindeschluessel"])


def load_combined_installations() -> pd.DataFrame:
    """Load solar + wind from deploy dir, tag with *technology*, return unified DataFrame."""
    frames = []
    for path, tech in [
        (MASTR_NRW_SOLAR_PATH, "Solar"),
        (MASTR_NRW_WIND_PATH, "Wind"),
    ]:
        if not path.exists():
            log.warning("Missing %s — run prepare_deploy or ensure bootstrap.", path)
            continue
        df = pd.read_parquet(path)
        df["technology"] = tech
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    combined = _parse_dates(combined)
    combined = _add_capacity_mw(combined)

    if "GemeindeName" not in combined.columns and "Gemeindeschluessel" in combined.columns:
        lookup = load_gemeinde_lookup()
        if not lookup.empty:
            combined["Gemeindeschluessel"] = combined["Gemeindeschluessel"].astype(str)
            combined = combined.merge(lookup, on="Gemeindeschluessel", how="left")

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
