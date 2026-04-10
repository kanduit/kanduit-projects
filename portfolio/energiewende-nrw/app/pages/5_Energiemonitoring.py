"""Energiemonitoring — National electricity generation, CO₂ intensity & renewables share.

Data source: SMARD (Bundesnetzagentur) — hourly generation by energy source.
SMARD provides data at national (DE) level.  NRW falls mostly within the
Amprion transmission zone but this page shows the national picture as context
for the state-level expansion tracked elsewhere in the dashboard.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.bootstrap import ensure_data, ensure_smard_data
from src.branding import render_header
from src.config import DASHBOARD_ICON, DASHBOARD_TITLE, SMARD_DEPLOY_PATH, SMARD_GENERATION_PATH

st.set_page_config(
    page_title=f"Energiemonitoring — {DASHBOARD_TITLE}",
    page_icon=DASHBOARD_ICON,
    layout="wide",
)
ensure_data()
ensure_smard_data()
render_header()

st.title("⚡ Energiemonitoring Deutschland")
st.caption(
    "Stromerzeugung, CO₂-Intensität und Anteil erneuerbarer Energien — "
    "nationale Daten als Kontext für die Energiewende in NRW (Quelle: SMARD / Bundesnetzagentur)"
)

RENEWABLE_SOURCES = ["wind_onshore", "wind_offshore", "solar", "biomasse", "wasserkraft", "sonstige_erneuerbare"]
CONVENTIONAL_SOURCES = ["braunkohle", "steinkohle", "erdgas", "kernenergie"]

CO2_FACTORS_G_PER_MWH = {
    "braunkohle": 1_075_000,
    "steinkohle": 835_000,
    "erdgas": 400_000,
    "kernenergie": 12_000,
    "wind_onshore": 11_000,
    "wind_offshore": 11_000,
    "solar": 45_000,
    "biomasse": 230_000,
    "wasserkraft": 24_000,
    "sonstige_erneuerbare": 30_000,
}

SOURCE_LABELS = {
    "wind_onshore": "Wind Onshore",
    "wind_offshore": "Wind Offshore",
    "solar": "Solar",
    "biomasse": "Biomasse",
    "wasserkraft": "Wasserkraft",
    "sonstige_erneuerbare": "Sonstige Erneuerbare",
    "braunkohle": "Braunkohle",
    "steinkohle": "Steinkohle",
    "erdgas": "Erdgas",
    "kernenergie": "Kernenergie",
}


@st.cache_data(ttl=3600)
def _load_smard():
    path = SMARD_DEPLOY_PATH if SMARD_DEPLOY_PATH.exists() else SMARD_GENERATION_PATH
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_parquet(path)
    if "timestamp" not in df.columns:
        return pd.DataFrame()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


smard = _load_smard()

if smard.empty:
    st.warning("Keine SMARD-Daten vorhanden — bitte Daten-Pipeline ausführen.")
    st.stop()

available_sources = [c for c in RENEWABLE_SOURCES + CONVENTIONAL_SOURCES if c in smard.columns]
ren_cols = [c for c in RENEWABLE_SOURCES if c in smard.columns]
conv_cols = [c for c in CONVENTIONAL_SOURCES if c in smard.columns]

# ── Sidebar date filter ─────────────────────────────────────────────────────
st.sidebar.header("Zeitraum")
min_date = smard["timestamp"].min().date()
max_date = smard["timestamp"].max().date()

default_start = max(min_date, max_date - pd.Timedelta(days=365))
date_range = st.sidebar.date_input(
    "Zeitraum wählen",
    value=(default_start, max_date),
    min_value=min_date,
    max_value=max_date,
)

if isinstance(date_range, tuple) and len(date_range) == 2:
    start, end = date_range
else:
    start, end = default_start, max_date

mask = (smard["timestamp"].dt.date >= start) & (smard["timestamp"].dt.date <= end)
filtered = smard.loc[mask].copy()

if filtered.empty:
    st.warning("Keine Daten im gewählten Zeitraum.")
    st.stop()

# ── Headline KPIs ───────────────────────────────────────────────────────────
filtered["_renewable_mw"] = filtered[ren_cols].sum(axis=1)
filtered["_conventional_mw"] = filtered[conv_cols].sum(axis=1)
filtered["_total_mw"] = filtered["_renewable_mw"] + filtered["_conventional_mw"]
filtered["_renewable_share"] = (
    filtered["_renewable_mw"] / filtered["_total_mw"].replace(0, np.nan) * 100
)

co2_total = sum(
    filtered[col].fillna(0) * CO2_FACTORS_G_PER_MWH.get(col, 0) / 1e6
    for col in available_sources
    if col in filtered.columns
)
filtered["_co2_g_per_kwh"] = co2_total / filtered["_total_mw"].replace(0, np.nan)

avg_renewable_share = filtered["_renewable_share"].mean()
avg_co2 = filtered["_co2_g_per_kwh"].mean()
total_gen_twh = filtered["_total_mw"].sum() / 1e6

k1, k2, k3, k4 = st.columns(4)
k1.metric("Ø Erneuerbaren-Anteil", f"{avg_renewable_share:.1f} %")
k2.metric("Ø CO₂-Intensität", f"{avg_co2:.0f} g/kWh")
k3.metric("Stromerzeugung", f"{total_gen_twh:.1f} TWh")
k4.metric("Datenpunkte", f"{len(filtered):,}")

# ── Period aggregation for charts ───────────────────────────────────────────
period = filtered.sort_values("timestamp").reset_index(drop=True)
period["renewable_mwh"] = period[ren_cols].sum(axis=1)
period["conventional_mwh"] = period[conv_cols].sum(axis=1)
period["total_mwh"] = period["renewable_mwh"] + period["conventional_mwh"]
period["renewable_share_pct"] = (
    period["renewable_mwh"] / period["total_mwh"].replace(0, np.nan) * 100
)

co2_period = sum(
    period[col].fillna(0) * CO2_FACTORS_G_PER_MWH.get(col, 0) / 1e6
    for col in available_sources
)
period["co2_g_per_kwh"] = co2_period / period["total_mwh"].replace(0, np.nan)

# ── Chart 1: Stacked generation (renewable vs conventional) ────────────────
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Energieüberwachung")
    fig_gen = go.Figure()
    fig_gen.add_trace(go.Bar(
        x=period["timestamp"],
        y=period["renewable_mwh"] / 1e3,
        name="Erneuerbar",
        marker_color="#27ae60",
    ))
    fig_gen.add_trace(go.Bar(
        x=period["timestamp"],
        y=period["conventional_mwh"] / 1e3,
        name="Konventionell",
        marker_color="#7f8c8d",
    ))
    fig_gen.update_layout(
        barmode="stack",
        xaxis_title="Datum",
        yaxis_title="Erzeugung (GWh/Woche)",
        template="plotly_white",
        height=380,
        margin=dict(l=50, r=20, t=30, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig_gen, use_container_width=True)

# ── Chart 2: CO₂ intensity ─────────────────────────────────────────────────
with col_right:
    st.subheader("CO₂-Intensität der Stromerzeugung")
    fig_co2 = go.Figure()
    fig_co2.add_trace(go.Scatter(
        x=period["timestamp"],
        y=period["co2_g_per_kwh"],
        mode="lines",
        line=dict(color="#c0392b", width=2),
        fill="tozeroy",
        fillcolor="rgba(192,57,43,0.1)",
        name="g CO₂/kWh",
    ))
    fig_co2.update_layout(
        xaxis_title="Datum",
        yaxis_title="g CO₂ / kWh",
        template="plotly_white",
        height=380,
        margin=dict(l=50, r=20, t=30, b=40),
    )
    st.plotly_chart(fig_co2, use_container_width=True)

# ── Chart 3: Renewables share ──────────────────────────────────────────────
col_left2, col_right2 = st.columns(2)

with col_left2:
    st.subheader("Anteil erneuerbarer Energien am Stromnetz")
    fig_ren = go.Figure()
    fig_ren.add_trace(go.Scatter(
        x=period["timestamp"],
        y=period["renewable_share_pct"],
        mode="lines",
        line=dict(color="#2980b9", width=2),
        fill="tozeroy",
        fillcolor="rgba(41,128,185,0.15)",
        name="Erneuerbaren-Anteil (%)",
    ))
    fig_ren.add_hline(
        y=65,
        line_dash="dash",
        line_color="#e67e22",
        annotation_text="NRW Ziel 2030: 65% CO₂-Reduktion",
        annotation_position="top left",
    )
    fig_ren.update_layout(
        xaxis_title="Datum",
        yaxis_title="Anteil erneuerbarer Energien (%)",
        template="plotly_white",
        height=380,
        margin=dict(l=50, r=20, t=30, b=40),
    )
    st.plotly_chart(fig_ren, use_container_width=True)

# ── Chart 4: Correlation heatmap ───────────────────────────────────────────
with col_right2:
    st.subheader("Korrelation zwischen Energiequellen")
    corr_cols = [c for c in ["wind_onshore", "solar", "erdgas", "braunkohle"] if c in filtered.columns]
    if len(corr_cols) >= 2:
        corr_labels = [SOURCE_LABELS.get(c, c) for c in corr_cols]
        corr_matrix = filtered[corr_cols].corr()
        fig_corr = px.imshow(
            corr_matrix.values,
            x=corr_labels,
            y=corr_labels,
            color_continuous_scale="RdBu_r",
            zmin=-1,
            zmax=1,
            text_auto=".2f",
            aspect="equal",
        )
        fig_corr.update_layout(
            template="plotly_white",
            height=380,
            margin=dict(l=50, r=20, t=30, b=40),
        )
        st.plotly_chart(fig_corr, use_container_width=True)
    else:
        st.info("Zu wenige Energiequellen für die Korrelationsanalyse.")

# ── Detailed source breakdown ───────────────────────────────────────────────
st.divider()
st.subheader("Detaillierte Erzeugung nach Energieträger")

source_totals = []
for col in available_sources:
    total_gwh = period[col].sum() / 1e3
    source_totals.append({
        "Energieträger": SOURCE_LABELS.get(col, col),
        "Erzeugung (GWh)": round(total_gwh, 1),
        "Typ": "Erneuerbar" if col in ren_cols else "Konventionell",
    })

source_df = pd.DataFrame(source_totals).sort_values("Erzeugung (GWh)", ascending=False)
fig_sources = px.bar(
    source_df,
    x="Energieträger",
    y="Erzeugung (GWh)",
    color="Typ",
    color_discrete_map={"Erneuerbar": "#27ae60", "Konventionell": "#7f8c8d"},
    template="plotly_white",
)
fig_sources.update_layout(
    height=350,
    margin=dict(l=50, r=20, t=30, b=40),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
)
st.plotly_chart(fig_sources, use_container_width=True)

# ── Context for stakeholders ────────────────────────────────────────────────
st.divider()
with st.expander("ℹ️ Hinweise für Entscheidungsträger", expanded=False):
    st.markdown("""
**Datenquelle:** SMARD (Strommarktdaten) der Bundesnetzagentur — stündliche
Erzeugungsdaten nach Energieträger auf nationaler Ebene (DE).

**Relevanz für NRW:**
- NRW liegt überwiegend in der Amprion-Regelzone, die Daten zeigen jedoch den
  nationalen Mix als Referenz.
- Die CO₂-Intensität gibt Aufschluss darüber, wie „sauber" die Stromerzeugung
  zu einem bestimmten Zeitpunkt ist — ein Schlüsselindikator für die
  Nachhaltigkeitsberichterstattung.
- Eine negative Korrelation zwischen Wind und Erdgas deutet darauf hin, dass
  Gaskraftwerke als Backup bei Windflauten einspringen.

**CO₂-Faktoren:** Die Berechnung nutzt Standardemissionsfaktoren des
Umweltbundesamtes (g CO₂/MWh) pro Energieträger.
""")
