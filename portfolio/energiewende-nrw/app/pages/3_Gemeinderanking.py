"""Gemeinderanking — Municipality-level Energiewende scorecard."""

from __future__ import annotations

import sys
from pathlib import Path

import plotly.express as px
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.bootstrap import ensure_data
from src.branding import render_header
from src.config import DASHBOARD_ICON, DASHBOARD_TITLE
from src.processing.scorecard import compute_scorecard
from src.processing.transform import load_combined_installations

st.set_page_config(
    page_title=f"Gemeinderanking — {DASHBOARD_TITLE}",
    page_icon=DASHBOARD_ICON,
    layout="wide",
)
ensure_data()
render_header()
st.title("🏆 Gemeinderanking")
st.caption(
    "Welche Gemeinden in NRW treiben die Energiewende voran — und wo besteht Nachholbedarf?"
)


@st.cache_data(ttl=3600)
def _load_scorecard():
    df = load_combined_installations()
    return compute_scorecard(df)


scorecard = _load_scorecard()

if scorecard.empty:
    st.warning("Keine Daten vorhanden — bitte Daten-Pipeline ausführen.")
    st.stop()

# ── Sidebar Filters ─────────────────────────────────────────────────────────
st.sidebar.header("Filter")

status_options = scorecard["status"].dropna().unique().tolist()
selected_status = st.sidebar.multiselect(
    "Status", options=status_options, default=status_options
)

min_score, max_score = st.sidebar.slider(
    "Score-Bereich", min_value=0, max_value=100, value=(0, 100)
)

filtered = scorecard.loc[
    (scorecard["status"].isin(selected_status))
    & (scorecard["score"] >= min_score)
    & (scorecard["score"] <= max_score)
]

# ── Summary Metrics ─────────────────────────────────────────────────────────
col1, col2, col3 = st.columns(3)
n_vorreiter = len(filtered.loc[filtered["status"] == "Vorreiter"])
n_zeitplan = len(filtered.loc[filtered["status"] == "Im Zeitplan"])
n_nachholbedarf = len(filtered.loc[filtered["status"] == "Nachholbedarf"])

col1.metric("🟢 Vorreiter", n_vorreiter)
col2.metric("🟡 Im Zeitplan", n_zeitplan)
col3.metric("🔴 Nachholbedarf", n_nachholbedarf)

# ── Score Distribution ──────────────────────────────────────────────────────
st.subheader("Score-Verteilung")
fig_hist = px.histogram(
    filtered,
    x="score",
    nbins=30,
    color="status",
    color_discrete_map={
        "Vorreiter": "#2ecc71",
        "Im Zeitplan": "#f39c12",
        "Nachholbedarf": "#e74c3c",
    },
    template="plotly_dark",
    labels={"score": "Energiewende-Score", "status": "Status", "count": "Anzahl"},
)
fig_hist.update_layout(
    height=300,
    margin=dict(l=40, r=20, t=30, b=40),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
)
st.plotly_chart(fig_hist, use_container_width=True)

# ── Ranking Table ───────────────────────────────────────────────────────────
st.subheader(f"Ranking ({len(filtered):,} Gemeinden)")

display_cols = [
    "GemeindeName",
    "score",
    "status",
    "anlagen_gesamt",
    "kapazitaet_mw",
    "solar_mw",
    "wind_mw",
    "zubau_3j_mw",
    "technologie_vielfalt",
]
display_cols = [c for c in display_cols if c in filtered.columns]

column_config = {
    "GemeindeName": st.column_config.TextColumn("Gemeinde"),
    "score": st.column_config.ProgressColumn(
        "Score", min_value=0, max_value=100, format="%d"
    ),
    "status": st.column_config.TextColumn("Status"),
    "anlagen_gesamt": st.column_config.NumberColumn("Anlagen", format="%d"),
    "kapazitaet_mw": st.column_config.NumberColumn("Gesamt (MW)", format="%.1f"),
    "solar_mw": st.column_config.NumberColumn("Solar (MW)", format="%.1f"),
    "wind_mw": st.column_config.NumberColumn("Wind (MW)", format="%.1f"),
    "zubau_3j_mw": st.column_config.NumberColumn("Zubau 3J (MW)", format="%.1f"),
    "technologie_vielfalt": st.column_config.NumberColumn("Technologien", format="%d"),
}

st.dataframe(
    filtered[display_cols],
    column_config=column_config,
    use_container_width=True,
    hide_index=True,
    height=600,
)

# ── Top / Bottom 10 ────────────────────────────────────────────────────────
col_top, col_bottom = st.columns(2)

with col_top:
    st.subheader("🥇 Top 10")
    top10 = filtered.head(10)[["GemeindeName", "score", "kapazitaet_mw"]].copy()
    st.dataframe(top10, hide_index=True, use_container_width=True)

with col_bottom:
    st.subheader("⚠️ Schlusslichter")
    bottom10 = filtered.tail(10)[["GemeindeName", "score", "kapazitaet_mw"]].copy()
    st.dataframe(bottom10, hide_index=True, use_container_width=True)
