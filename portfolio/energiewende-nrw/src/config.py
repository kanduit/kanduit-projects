"""Central configuration for Energiewende NRW."""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DEPLOY_DIR = DATA_DIR / "deploy"
REFERENCE_DIR = DATA_DIR / "reference"
ASSETS_DIR = PROJECT_ROOT / "assets"

# Deploy paths — the dashboard reads these at runtime.
MASTR_NRW_SOLAR_PATH = DEPLOY_DIR / "nrw_solar.parquet"
MASTR_NRW_WIND_PATH = DEPLOY_DIR / "nrw_wind.parquet"
MASTR_NRW_COMBUSTION_PATH = DEPLOY_DIR / "nrw_combustion.parquet"
GEMEINDEN_GEOJSON_PATH = REFERENCE_DIR / "nrw_gemeinden.geojson"
TARGETS_JSON_PATH = REFERENCE_DIR / "targets.json"

# ---------------------------------------------------------------------------
# MaStR
# ---------------------------------------------------------------------------
MASTR_TECHNOLOGIES = ["solar", "wind", "combustion"]
MASTR_MVP_TECHNOLOGIES = ["solar", "wind"]
NRW_BUNDESLAND = "Nordrhein-Westfalen"

MVP_REQUIRED_PATHS = [
    MASTR_NRW_SOLAR_PATH,
    MASTR_NRW_WIND_PATH,
]

# ---------------------------------------------------------------------------
# NRW 2030 Targets  (official, from Energie- und Wärmestrategie NRW)
# ---------------------------------------------------------------------------
TARGETS_2030 = {
    "wind_onshore_gw": 12.0,
    "solar_pv_gw": 18.0,
    "solar_pv_gw_high": 24.0,
    "coal_exit_year": 2030,
    "climate_neutral_electricity_year": 2035,
    "co2_reduction_vs_1990_pct": 65,
}

EXPANSION_BASELINE_YEAR = 2018

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
DASHBOARD_TITLE = "Energiewende-Monitor NRW"
DASHBOARD_ICON = "⚡"
MAP_CENTER_LAT = 51.45
MAP_CENTER_LON = 7.01
MAP_ZOOM = 8

# ---------------------------------------------------------------------------
# Ingest-only constants (SMARD, paths for full processed data).
# These are imported only by scripts/ingest.py and src/ingest/*, not by the
# deployed Streamlit app.
# ---------------------------------------------------------------------------
SMARD_BASE_URL = "https://www.smard.de/app/chart_data"

SMARD_FILTERS = {
    "wind_onshore": 4067,
    "wind_offshore": 1225,
    "solar": 4068,
    "biomasse": 4066,
    "braunkohle": 1223,
    "steinkohle": 4069,
    "erdgas": 4071,
    "wasserkraft": 1226,
    "sonstige_erneuerbare": 5016,
    "kernenergie": 1224,
}

SMARD_REGION_DE = "DE"
SMARD_REGION_AMPRION = "Amprion"
SMARD_RESOLUTION = "hour"
SMARD_GENERATION_PATH = PROCESSED_DIR / "smard_generation.parquet"

# Full-column processed paths used only by scripts/ingest.py and
# scripts/prepare_deploy.py — not by the dashboard at runtime.
MASTR_PROCESSED_SOLAR_PATH = PROCESSED_DIR / "mastr_nrw_solar.parquet"
MASTR_PROCESSED_WIND_PATH = PROCESSED_DIR / "mastr_nrw_wind.parquet"
MASTR_PROCESSED_COMBUSTION_PATH = PROCESSED_DIR / "mastr_nrw_combustion.parquet"
