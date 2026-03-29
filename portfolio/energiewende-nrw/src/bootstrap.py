"""Auto-download and cache data on first launch.

Primary path: read committed Parquet files from data/processed/.
Fallback: download from Zenodo (MaStR) and SMARD REST API, filter to NRW,
and cache as Parquet so subsequent starts are instant.

The solar Zenodo CSV is ~723 MB compressed.  We stream-download the zip,
read the CSV in pandas chunks (100k rows), filter each chunk to NRW, and
concatenate only the matching rows — never loading the full national dataset
into memory.
"""

from __future__ import annotations

import io
import logging
import zipfile
from pathlib import Path

import pandas as pd
import requests
import streamlit as st

from src.config import (
    MASTR_NRW_COMBUSTION_PATH,
    MASTR_NRW_SOLAR_PATH,
    MASTR_NRW_WIND_PATH,
    NRW_BUNDESLAND,
    PROCESSED_DIR,
    SMARD_GENERATION_PATH,
)

log = logging.getLogger(__name__)

ZENODO_RECORD = "14843222"
ZENODO_BASE = f"https://zenodo.org/api/records/{ZENODO_RECORD}/files"

_ZENODO_FILES = {
    "solar": "bnetza_mastr_solar_raw.csv.zip",
    "wind": "bnetza_mastr_wind_raw.csv.zip",
    "combustion": "bnetza_mastr_combustion_raw.csv.zip",
}

_OUTPUT_PATHS = {
    "solar": MASTR_NRW_SOLAR_PATH,
    "wind": MASTR_NRW_WIND_PATH,
    "combustion": MASTR_NRW_COMBUSTION_PATH,
}

_STATE_COLUMN_CANDIDATES = ["Bundesland", "bundesland", "state", "State"]

CHUNK_SIZE = 100_000


def _find_state_col(columns: list[str]) -> str | None:
    for candidate in _STATE_COLUMN_CANDIDATES:
        if candidate in columns:
            return candidate
    return None


def _download_zenodo_csv_nrw(
    tech: str,
    progress_text: str | None = None,
) -> pd.DataFrame:
    """Download a MaStR CSV zip from Zenodo, filter to NRW in chunks."""
    filename = _ZENODO_FILES[tech]
    url = f"{ZENODO_BASE}/{filename}/content"

    log.info("Downloading %s from Zenodo …", filename)
    resp = requests.get(url, stream=True, timeout=300)
    resp.raise_for_status()

    raw_bytes = io.BytesIO()
    total = int(resp.headers.get("content-length", 0))
    downloaded = 0

    for chunk in resp.iter_content(chunk_size=1_048_576):
        raw_bytes.write(chunk)
        downloaded += len(chunk)
        if progress_text and total > 0:
            pct = downloaded / total
            st.toast(f"{progress_text}: {pct:.0%}", icon="📥")

    raw_bytes.seek(0)

    with zipfile.ZipFile(raw_bytes) as zf:
        csv_name = zf.namelist()[0]
        with zf.open(csv_name) as csv_file:
            nrw_chunks: list[pd.DataFrame] = []
            reader = pd.read_csv(
                csv_file,
                chunksize=CHUNK_SIZE,
                low_memory=False,
                sep=",",
                encoding="utf-8",
            )
            for i, chunk_df in enumerate(reader):
                state_col = _find_state_col(chunk_df.columns.tolist())
                if state_col is None:
                    log.warning("No state column found in chunk %d; keeping all rows.", i)
                    nrw_chunks.append(chunk_df)
                else:
                    nrw_rows = chunk_df.loc[chunk_df[state_col] == NRW_BUNDESLAND]
                    if not nrw_rows.empty:
                        nrw_chunks.append(nrw_rows)

    if not nrw_chunks:
        return pd.DataFrame()

    return pd.concat(nrw_chunks, ignore_index=True)


def _ensure_mastr_tech(tech: str) -> None:
    out_path = _OUTPUT_PATHS[tech]
    if out_path.exists():
        return

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df = _download_zenodo_csv_nrw(tech, progress_text=f"MaStR {tech}")
    log.info("  NRW %s: %s Anlagen", tech, f"{len(df):,}")
    df.to_parquet(out_path, index=False)
    log.info("  Saved → %s", out_path)


def _ensure_smard() -> None:
    if SMARD_GENERATION_PATH.exists():
        return

    from src.ingest.smard import download_generation

    log.info("Downloading SMARD generation data …")
    download_generation()


def ensure_data() -> None:
    """Ensure all required data files exist — download if missing.

    Call this at the top of every Streamlit page.  If data is already
    cached (committed to repo or from a previous run), this is a no-op.
    """
    all_present = all(p.exists() for p in _OUTPUT_PATHS.values()) and SMARD_GENERATION_PATH.exists()
    if all_present:
        return

    mastr_present = all(p.exists() for p in [MASTR_NRW_SOLAR_PATH, MASTR_NRW_WIND_PATH])
    if mastr_present:
        if not SMARD_GENERATION_PATH.exists():
            with st.spinner("SMARD-Erzeugungsdaten werden heruntergeladen …"):
                _ensure_smard()
        return

    with st.status("Daten werden erstmalig heruntergeladen …", expanded=True) as status:
        for tech in ["wind", "combustion", "solar"]:
            if not _OUTPUT_PATHS[tech].exists():
                st.write(f"📥 MaStR {tech.title()} wird von Zenodo geladen …")
                _ensure_mastr_tech(tech)
                st.write(f"✅ {tech.title()} — fertig")

        if not SMARD_GENERATION_PATH.exists():
            st.write("📥 SMARD-Erzeugungsdaten werden geladen …")
            _ensure_smard()
            st.write("✅ SMARD — fertig")

        status.update(label="Alle Daten geladen!", state="complete")
