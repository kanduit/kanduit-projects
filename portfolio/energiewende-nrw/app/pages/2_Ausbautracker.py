"""Ausbautracker — Expansion rate vs. 2030 target."""

from __future__ import annotations

import sys
from pathlib import Path

import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.bootstrap import ensure_data
from src.branding import render_header
from src.config import DASHBOARD_ICON, DASHBOARD_TITLE, TARGETS_2030
from src.processing.targets import build_trajectory
from src.processing.transform import cumulative_capacity, load_combined_installations

st.set_page_config(
    page_title=f"Ausbautracker — {DASHBOARD_TITLE}",
    page_icon=DASHBOARD_ICON,
    layout="wide",
)
ensure_data()
render_header()
st.title("📈 Ausbautracker")
st.caption("Kumulierte installierte Leistung vs. linearer Zielpfad 2030")


@st.cache_data(ttl=3600)
def _load():
    df = load_combined_installations()
    return cumulative_capacity(df)


annual = _load()
if annual.empty:
    st.warning("Keine Daten vorhanden — bitte Daten-Pipeline ausführen.")
    st.stop()

# ── Cumulative Capacity vs Target ───────────────────────────────────────────
TECH_CONFIG = {
    "Solar": {
        "color": "#f1c40f",
        "target_gw": TARGETS_2030["solar_pv_gw"],
        "target_gw_high": TARGETS_2030["solar_pv_gw_high"],
        "baseline_year": 2010,
    },
    "Wind": {
        "color": "#3498db",
        "target_gw": TARGETS_2030["wind_onshore_gw"],
        "target_gw_high": None,
        "baseline_year": 2000,
    },
}

for tech, cfg in TECH_CONFIG.items():
    st.subheader(f"{'☀️' if tech == 'Solar' else '💨'} {tech}")

    tech_annual = annual.loc[annual["technology"] == tech].copy()
    if tech_annual.empty:
        st.info(f"Keine {tech}-Daten vorhanden.")
        continue

    tech_annual["cumulative_gw"] = tech_annual["cumulative_mw"] / 1_000
    tech_annual["added_gw"] = tech_annual["added_mw"] / 1_000

    baseline_row = tech_annual.loc[tech_annual["year"] >= 2018].head(1)
    if baseline_row.empty:
        baseline_row = tech_annual.head(1)
    baseline_year = int(baseline_row["year"].iloc[0])
    baseline_gw = float(baseline_row["cumulative_gw"].iloc[0])

    trajectory = build_trajectory(baseline_year, baseline_gw, 2030, cfg["target_gw"])

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=tech_annual["year"],
            y=tech_annual["cumulative_gw"],
            mode="lines+markers",
            name=f"{tech} — Ist",
            line=dict(color=cfg["color"], width=3),
            marker=dict(size=6),
        )
    )

    fig.add_trace(
        go.Scatter(
            x=trajectory["year"],
            y=trajectory["required_gw"],
            mode="lines",
            name="Zielpfad 2030",
            line=dict(color="#e74c3c", width=2, dash="dash"),
        )
    )

    if cfg.get("target_gw_high"):
        traj_high = build_trajectory(
            baseline_year, baseline_gw, 2030, cfg["target_gw_high"]
        )
        fig.add_trace(
            go.Scatter(
                x=traj_high["year"],
                y=traj_high["required_gw"],
                mode="lines",
                name="Zielpfad 2030 (hoch)",
                line=dict(color="#e74c3c", width=1, dash="dot"),
            )
        )

    # Gap shading between actual trend and target
    last_year = int(tech_annual["year"].max())
    last_gw = float(tech_annual["cumulative_gw"].iloc[-1])
    if last_gw < cfg["target_gw"] and last_year < 2030:
        traj_subset = trajectory.loc[trajectory["year"] >= last_year]
        fig.add_trace(
            go.Scatter(
                x=list(traj_subset["year"]) + [last_year],
                y=list(traj_subset["required_gw"]) + [last_gw],
                fill="toself",
                fillcolor="rgba(231, 76, 60, 0.12)",
                line=dict(width=0),
                showlegend=False,
                hoverinfo="skip",
            )
        )

    fig.update_layout(
        xaxis_title="Jahr",
        yaxis_title="Installierte Leistung (GW)",
        template="plotly_dark",
        height=400,
        margin=dict(l=40, r=20, t=30, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Annual additions bar chart ──────────────────────────────────────────
    st.markdown(f"**Jährlicher Zubau — {tech}**")
    fig_bar = go.Figure()
    fig_bar.add_trace(
        go.Bar(
            x=tech_annual["year"],
            y=tech_annual["added_gw"],
            marker_color=cfg["color"],
            name="Jährlicher Zubau",
        )
    )

    remaining = cfg["target_gw"] - last_gw
    years_left = 2030 - last_year
    if years_left > 0:
        required_annual = remaining / years_left
        fig_bar.add_hline(
            y=required_annual,
            line_dash="dash",
            line_color="#e74c3c",
            annotation_text=f"Erforderlich: {required_annual:.2f} GW/a",
            annotation_position="top left",
        )

    fig_bar.update_layout(
        xaxis_title="Jahr",
        yaxis_title="Zubau (GW)",
        template="plotly_dark",
        height=300,
        margin=dict(l=40, r=20, t=30, b=40),
    )
    st.plotly_chart(fig_bar, use_container_width=True)
    st.divider()
