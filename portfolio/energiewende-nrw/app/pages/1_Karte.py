"""Karte — Interactive map of every solar & wind installation in NRW."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import streamlit as st
from keplergl import KeplerGl
from streamlit_keplergl import keplergl_static

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.bootstrap import ensure_data
from src.config import (
    DASHBOARD_ICON,
    DASHBOARD_TITLE,
    MAP_CENTER_LAT,
    MAP_CENTER_LON,
    MAP_ZOOM,
    MASTR_NRW_COMBUSTION_PATH,
    MASTR_NRW_SOLAR_PATH,
    MASTR_NRW_WIND_PATH,
)

st.set_page_config(page_title=f"Karte — {DASHBOARD_TITLE}", page_icon=DASHBOARD_ICON, layout="wide")
ensure_data()
st.title("🗺️ Anlagenkarte NRW")
st.caption("Jede registrierte Solar- und Windanlage in Nordrhein-Westfalen (Quelle: MaStR)")


@st.cache_data(ttl=3600)
def _load_map_data():
    frames = []
    for path, tech, color in [
        (MASTR_NRW_SOLAR_PATH, "Solar", [241, 196, 15]),
        (MASTR_NRW_WIND_PATH, "Wind", [52, 152, 219]),
    ]:
        if path.exists():
            df = pd.read_parquet(path)
            df["technology"] = tech
            df["_color_r"], df["_color_g"], df["_color_b"] = color
            frames.append(df)

    if MASTR_NRW_COMBUSTION_PATH.exists():
        df = pd.read_parquet(MASTR_NRW_COMBUSTION_PATH)
        df["technology"] = "Konventionell"
        df["_color_r"], df["_color_g"], df["_color_b"] = [231, 76, 60]
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.dropna(subset=["Breitengrad", "Laengengrad"])
    return combined


data = _load_map_data()

if data.empty:
    st.warning("Keine Geodaten vorhanden.")
    st.stop()

# ── Sidebar Filters ─────────────────────────────────────────────────────────
st.sidebar.header("Filter")
technologies = st.sidebar.multiselect(
    "Technologie",
    options=data["technology"].unique().tolist(),
    default=["Solar", "Wind"],
)

if "Bruttoleistung" in data.columns:
    min_kw = st.sidebar.slider(
        "Mindestleistung (kW)",
        min_value=0,
        max_value=int(data["Bruttoleistung"].quantile(0.99)),
        value=0,
        step=10,
    )
else:
    min_kw = 0

filtered = data.loc[data["technology"].isin(technologies)]
if min_kw > 0 and "Bruttoleistung" in filtered.columns:
    filtered = filtered.loc[filtered["Bruttoleistung"] >= min_kw]

st.sidebar.metric("Angezeigte Anlagen", f"{len(filtered):,}")

# ── Kepler.gl Map ───────────────────────────────────────────────────────────
KEPLER_CONFIG = {
    "version": "v1",
    "config": {
        "visState": {
            "filters": [],
            "layers": [
                {
                    "id": "installations",
                    "type": "point",
                    "config": {
                        "dataId": "nrw_anlagen",
                        "label": "Anlagen",
                        "columns": {
                            "lat": "Breitengrad",
                            "lng": "Laengengrad",
                        },
                        "isVisible": True,
                        "colorField": {"name": "technology", "type": "string"},
                        "colorScale": "ordinal",
                        "visConfig": {
                            "radius": 3,
                            "opacity": 0.7,
                            "filled": True,
                            "colorRange": {
                                "name": "Custom",
                                "type": "custom",
                                "category": "Custom",
                                "colors": [
                                    "#f1c40f",
                                    "#3498db",
                                    "#e74c3c",
                                ],
                            },
                        },
                    },
                    "visualChannels": {
                        "colorField": {"name": "technology", "type": "string"},
                        "colorScale": "ordinal",
                        "sizeField": {"name": "Bruttoleistung", "type": "real"},
                        "sizeScale": "sqrt",
                    },
                }
            ],
            "interactionConfig": {
                "tooltip": {
                    "enabled": True,
                    "fieldsToShow": {
                        "nrw_anlagen": [
                            {"name": "technology", "format": None},
                            {"name": "Bruttoleistung", "format": None},
                            {"name": "Inbetriebnahmedatum", "format": None},
                            {"name": "GemeindeName", "format": None},
                        ]
                    },
                }
            },
        },
        "mapState": {
            "latitude": MAP_CENTER_LAT,
            "longitude": MAP_CENTER_LON,
            "zoom": MAP_ZOOM,
        },
        "mapStyle": {"styleType": "dark"},
    },
}

map_df = filtered[
    [
        c
        for c in [
            "Breitengrad",
            "Laengengrad",
            "technology",
            "Bruttoleistung",
            "Inbetriebnahmedatum",
            "GemeindeName",
        ]
        if c in filtered.columns
    ]
].copy()

if "Inbetriebnahmedatum" in map_df.columns:
    map_df["Inbetriebnahmedatum"] = map_df["Inbetriebnahmedatum"].astype(str)

kepler_map = KeplerGl(height=700, data={"nrw_anlagen": map_df}, config=KEPLER_CONFIG)
keplergl_static(kepler_map, height=700)
