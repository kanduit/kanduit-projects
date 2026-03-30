"""Karte — Interactive map of every solar & wind installation in NRW."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pydeck as pdk
import streamlit as st

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

TECH_COLORS = {
    "Solar": [241, 196, 15],
    "Wind": [52, 152, 219],
    "Konventionell": [231, 76, 60],
}


@st.cache_data(ttl=3600)
def _load_map_data():
    frames = []
    for path, tech in [
        (MASTR_NRW_SOLAR_PATH, "Solar"),
        (MASTR_NRW_WIND_PATH, "Wind"),
    ]:
        if path.exists():
            df = pd.read_parquet(path)
            df["technology"] = tech
            frames.append(df)

    if MASTR_NRW_COMBUSTION_PATH.exists():
        df = pd.read_parquet(MASTR_NRW_COMBUSTION_PATH)
        df["technology"] = "Konventionell"
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.dropna(subset=["Breitengrad", "Laengengrad"])
    combined["color"] = combined["technology"].map(TECH_COLORS)
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

# ── Pydeck Map ──────────────────────────────────────────────────────────────
layer = pdk.Layer(
    "ScatterplotLayer",
    data=filtered,
    get_position=["Laengengrad", "Breitengrad"],
    get_color="color",
    get_radius="Bruttoleistung",
    radius_scale=0.3,
    radius_min_pixels=1,
    radius_max_pixels=15,
    pickable=True,
    opacity=0.7,
    auto_highlight=True,
)

view_state = pdk.ViewState(
    latitude=MAP_CENTER_LAT,
    longitude=MAP_CENTER_LON,
    zoom=MAP_ZOOM,
    pitch=0,
)

tooltip = {
    "html": (
        "<b>{technology}</b><br/>"
        "Leistung: {Bruttoleistung} kW<br/>"
        "Gemeinde: {GemeindeName}"
    ),
    "style": {"backgroundColor": "#1a1a2e", "color": "#fafafa"},
}

st.pydeck_chart(
    pdk.Deck(
        layers=[layer],
        initial_view_state=view_state,
        tooltip=tooltip,
        map_style="mapbox://styles/mapbox/dark-v11",
    ),
    height=700,
)
