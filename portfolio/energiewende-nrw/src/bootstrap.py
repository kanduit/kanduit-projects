"""Auto-download and cache MVP data on first launch.

MVP startup requires only two deploy artifacts:
  - nrw_solar.parquet
  - nrw_wind.parquet

Optional datasets (combustion, SMARD) are not required for startup and can be
loaded explicitly when needed.

On Streamlit Cloud (or any fresh checkout without committed deploy data), this
module downloads MaStR CSVs from Zenodo, filters to NRW, selects the slim
column set used by the dashboard, and writes directly to data/deploy/.
"""

from __future__ import annotations

import logging
import io
import zipfile

import pandas as pd
import requests
import streamlit as st

from src.config import (
    DEPLOY_DIR,
    MASTR_NRW_COMBUSTION_PATH,
    MASTR_NRW_SOLAR_PATH,
    MASTR_NRW_WIND_PATH,
    MVP_REQUIRED_PATHS,
    NRW_BUNDESLAND,
    SMARD_DEPLOY_PATH,
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

_MVP_OUTPUT_PATHS = {
    "solar": MASTR_NRW_SOLAR_PATH,
    "wind": MASTR_NRW_WIND_PATH,
}
_OPTIONAL_OUTPUT_PATHS = {"combustion": MASTR_NRW_COMBUSTION_PATH}
_MVP_TECHS = ["wind", "solar"]

_STATE_COLUMN_CANDIDATES = ["Bundesland", "bundesland", "state", "State"]

_DEPLOY_COLUMNS = [
    "EinheitMastrNummer",
    "Bruttoleistung",
    "Inbetriebnahmedatum",
    "GemeindeName",
    "Gemeindeschluessel",
    "Breitengrad",
    "Laengengrad",
]

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

    df = pd.concat(nrw_chunks, ignore_index=True)
    keep_cols = [c for c in _DEPLOY_COLUMNS if c in df.columns]
    if keep_cols:
        df = df[keep_cols]
    return df


def _ensure_mastr_tech(tech: str) -> None:
    out_path = _MVP_OUTPUT_PATHS.get(tech) or _OPTIONAL_OUTPUT_PATHS.get(tech)
    if out_path is None:
        raise KeyError(f"Unknown technology '{tech}'")
    if out_path.exists():
        return

    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
    df = _download_zenodo_csv_nrw(tech, progress_text=f"MaStR {tech}")
    log.info("  NRW %s: %s Anlagen", tech, f"{len(df):,}")
    df.to_parquet(out_path, index=False)
    log.info("  Saved → %s", out_path)


def _smard_available() -> bool:
    return SMARD_DEPLOY_PATH.exists() or SMARD_GENERATION_PATH.exists()


def _ensure_smard() -> None:
    """Download SMARD data and save to both processed and deploy dirs."""
    if _smard_available():
        return

    from src.ingest.smard import download_generation

    log.info("Downloading SMARD generation data …")
    df = download_generation()

    if not SMARD_DEPLOY_PATH.exists() and not df.empty:
        DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
        df.to_parquet(SMARD_DEPLOY_PATH, index=False, compression="zstd")
        log.info("Saved SMARD deploy copy → %s", SMARD_DEPLOY_PATH)


def ensure_optional_data() -> None:
    """Download optional datasets that are not required for MVP startup."""
    if not _OPTIONAL_OUTPUT_PATHS["combustion"].exists():
        _ensure_mastr_tech("combustion")
    if not _smard_available():
        _ensure_smard()


def ensure_smard_data() -> None:
    """Ensure SMARD generation data exists in deploy dir — download if missing."""
    if _smard_available():
        return

    with st.status("SMARD-Erzeugungsdaten werden heruntergeladen …", expanded=True) as status:
        st.write("📥 SMARD-Daten werden von smard.de geladen …")
        _ensure_smard()
        st.write("✅ SMARD-Daten — fertig")
        status.update(label="SMARD-Daten geladen!", state="complete")


def ensure_data(include_optional: bool = False) -> None:
    """Ensure MVP-required files exist — download if missing.

    Call this at the top of every Streamlit page.  If data is already
    cached (committed to repo or from a previous run), this is a no-op.
    """
    if all(p.exists() for p in MVP_REQUIRED_PATHS):
        if include_optional:
            ensure_optional_data()
        return

    with st.status("Daten werden erstmalig heruntergeladen …", expanded=True) as status:
        for tech in _MVP_TECHS:
            if not _MVP_OUTPUT_PATHS[tech].exists():
                st.write(f"📥 MaStR {tech.title()} wird von Zenodo geladen …")
                _ensure_mastr_tech(tech)
                st.write(f"✅ {tech.title()} — fertig")

        if include_optional:
            st.write("📥 Optionale Daten werden geladen …")
            ensure_optional_data()
            st.write("✅ Optionale Daten — fertig")

        status.update(label="MVP-Daten geladen!", state="complete")
