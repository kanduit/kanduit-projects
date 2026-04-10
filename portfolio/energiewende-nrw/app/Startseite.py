"""Energiewende-Monitor NRW — Startseite (Overview / KPI Dashboard)."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import (
    DASHBOARD_ICON,
    DASHBOARD_TITLE,
    TARGETS_2030,
)
from src.bootstrap import ensure_data
from src.processing.targets import compute_gap
from src.processing.transform import (
    cumulative_capacity,
    load_combined_installations,
    monthly_additions,
)

st.set_page_config(
    page_title=DASHBOARD_TITLE,
    page_icon=DASHBOARD_ICON,
    layout="wide",
)

ensure_data()

# ── Custom CSS ──────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    .kpi-card {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        padding: 1.5rem;
        color: white;
        text-align: center;
    }
    .kpi-card h2 { font-size: 2.2rem; margin: 0; }
    .kpi-card p { margin: 0.3rem 0 0 0; opacity: 0.8; font-size: 0.9rem; }
    .status-ahead { border-left: 4px solid #2ecc71; }
    .status-behind { border-left: 4px solid #e74c3c; }
    .status-ontrack { border-left: 4px solid #f39c12; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title(f"{DASHBOARD_ICON} {DASHBOARD_TITLE}")
st.caption(
    "Echtzeit-Übersicht zur Energiewende in Nordrhein-Westfalen — "
    "Daten: Marktstammdatenregister (BNetzA), SMARD"
)


# ── Data loading ────────────────────────────────────────────────────────────
@st.cache_data(ttl=3600)
def _load():
    df = load_combined_installations()
    annual = cumulative_capacity(df)
    monthly = monthly_additions(df)
    gaps = compute_gap(annual) if not annual.empty else []
    return df, annual, monthly, gaps


df, annual, monthly, gaps = _load()

# ── KPI Cards ───────────────────────────────────────────────────────────────
solar_gw = df.loc[df["technology"] == "Solar", "capacity_mw"].sum() / 1_000
wind_gw = df.loc[df["technology"] == "Wind", "capacity_mw"].sum() / 1_000
total_gw = solar_gw + wind_gw
n_anlagen = len(df)

solar_gap = next((g for g in gaps if g.technology == "Solar"), None)
wind_gap = next((g for g in gaps if g.technology == "Wind"), None)

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        label="☀️ Solar installiert",
        value=f"{solar_gw:,.1f} GW",
        delta=f"Ziel: {TARGETS_2030['solar_pv_gw']} GW",
    )

with col2:
    st.metric(
        label="💨 Wind Onshore installiert",
        value=f"{wind_gw:,.1f} GW",
        delta=f"Ziel: {TARGETS_2030['wind_onshore_gw']} GW",
    )

with col3:
    st.metric(
        label="⚡ Erneuerbare gesamt",
        value=f"{total_gw:,.1f} GW",
        delta=f"{n_anlagen:,} Anlagen",
    )

with col4:
    if solar_gap and wind_gap:
        worst_gap = max(solar_gap.gap_years, wind_gap.gap_years)
        if worst_gap > 0:
            st.metric(
                label="🔴 Zielverfehlung 2030",
                value=f"+{worst_gap:.0f} Jahre",
                delta="hinter dem Zeitplan",
                delta_color="inverse",
            )
        else:
            st.metric(
                label="🟢 Status 2030",
                value="Im Zeitplan",
                delta="Ziel erreichbar",
            )
    else:
        st.metric(label="📊 Status", value="—", delta="Berechnung läuft")

st.divider()

# ── Trend Charts ────────────────────────────────────────────────────────────
st.subheader("Monatlicher Zubau (letzte 3 Jahre)")

if not monthly.empty:
    recent_monthly = monthly.loc[
        monthly["month"] >= (pd.Timestamp.now() - pd.DateOffset(years=3))
    ]

    fig = go.Figure()
    for tech, color in [("Solar", "#f1c40f"), ("Wind", "#3498db")]:
        tech_data = recent_monthly.loc[recent_monthly["technology"] == tech]
        fig.add_trace(
            go.Bar(
                x=tech_data["month"],
                y=tech_data["capacity_mw"],
                name=tech,
                marker_color=color,
            )
        )

    fig.update_layout(
        barmode="stack",
        xaxis_title="Monat",
        yaxis_title="Zubau (MW)",
        template="plotly_dark",
        height=350,
        margin=dict(l=40, r=20, t=30, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig, use_container_width=True)

# ── Gap Summary Table ───────────────────────────────────────────────────────
st.subheader("Lückenanalyse auf einen Blick")

if gaps:
    gap_df = pd.DataFrame(
        [
            {
                "Technologie": g.technology,
                "Aktuell (GW)": g.current_gw,
                "Ziel 2030 (GW)": g.target_gw,
                "Fehlend (GW)": g.remaining_gw,
                "Ø Zubau/Jahr (GW)": g.current_annual_rate_gw,
                "Zielerreichung (Jahr)": g.projected_year if g.projected_year < 9999 else "nie",
                "Rückstand (Jahre)": g.gap_years,
            }
            for g in gaps
        ]
    )
    st.dataframe(gap_df, use_container_width=True, hide_index=True)

st.caption(
    "Datenquellen: Marktstammdatenregister (BNetzA) — DL-DE-BY-2.0 · "
    "SMARD (BNetzA) — CC BY 4.0"
)
