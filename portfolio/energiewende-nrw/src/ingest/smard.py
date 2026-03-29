"""SMARD (Bundesnetzagentur) REST API client.

Downloads hourly electricity generation data by energy source.
See https://smard.api.bund.dev/ for the OpenAPI spec.

Limitation: SMARD provides data at national (DE) or transmission-zone level
(50Hertz, Amprion, TenneT, TransnetBW).  NRW falls mostly within the Amprion
zone, but not exclusively.  This is documented in the dashboard.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import pandas as pd
import requests

from src.config import (
    PROCESSED_DIR,
    SMARD_BASE_URL,
    SMARD_FILTERS,
    SMARD_GENERATION_PATH,
    SMARD_REGION_DE,
    SMARD_RESOLUTION,
)

log = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({"Accept": "application/json"})


def _get_timestamps(filter_id: int, region: str) -> list[int]:
    """Fetch available timestamp indices for a given filter/region."""
    url = f"{SMARD_BASE_URL}/{filter_id}/{region}/index_{SMARD_RESOLUTION}.json"
    resp = _SESSION.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json().get("timestamps", [])


def _get_timeseries(
    filter_id: int, region: str, timestamp: int
) -> list[list[int | float | None]]:
    """Fetch one chunk of time-series data."""
    url = (
        f"{SMARD_BASE_URL}/{filter_id}/{region}/"
        f"{filter_id}_{region}_{SMARD_RESOLUTION}_{timestamp}.json"
    )
    resp = _SESSION.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json().get("series", [])


def download_generation(
    region: str = SMARD_REGION_DE,
    start_year: int = 2018,
    filters: dict[str, int] | None = None,
) -> pd.DataFrame:
    """Download hourly generation data for all configured energy sources.

    Returns a DataFrame with columns: timestamp, <source_1>, <source_2>, …
    Values are in MW.
    """
    filters = filters or SMARD_FILTERS
    cutoff = int(datetime(start_year, 1, 1, tzinfo=timezone.utc).timestamp()) * 1000

    all_series: dict[str, pd.Series] = {}

    for name, fid in filters.items():
        log.info("SMARD: fetching '%s' (filter %d) …", name, fid)
        timestamps = _get_timestamps(fid, region)
        relevant = [t for t in timestamps if t >= cutoff]

        records: list[tuple[int, float | None]] = []
        for ts in relevant:
            chunk = _get_timeseries(fid, region, ts)
            records.extend(chunk)
            time.sleep(0.15)  # polite rate-limit

        sdf = pd.DataFrame(records, columns=["timestamp_ms", name])
        sdf = sdf.dropna(subset=[name])
        sdf = sdf.drop_duplicates(subset=["timestamp_ms"])
        all_series[name] = sdf.set_index("timestamp_ms")[name]
        log.info("  → %s data points", f"{len(sdf):,}")

    df = pd.DataFrame(all_series)
    df.index.name = "timestamp_ms"
    df = df.sort_index().reset_index()
    df["timestamp"] = pd.to_datetime(df["timestamp_ms"], unit="ms", utc=True)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(SMARD_GENERATION_PATH, index=False)
    log.info("Saved SMARD generation data → %s  (%s rows)", SMARD_GENERATION_PATH, f"{len(df):,}")
    return df


def load_generation() -> pd.DataFrame:
    """Load cached SMARD generation Parquet."""
    return pd.read_parquet(SMARD_GENERATION_PATH)
