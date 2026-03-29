"""Lückenanalyse — Gap analysis with projection scenarios."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.bootstrap import ensure_data
from src.config import DASHBOARD_ICON, DASHBOARD_TITLE, TARGETS_2030
from src.processing.targets import compute_gap
from src.processing.transform import cumulative_capacity, load_combined_installations

st.set_page_config(
    page_title=f"Lückenanalyse — {DASHBOARD_TITLE}",
    page_icon=DASHBOARD_ICON,
    layout="wide",
)
ensure_data()
st.title("🔍 Lückenanalyse")
st.caption("Bei aktuellem Tempo: Wann erreicht NRW die Ausbauziele?")


@st.cache_data(ttl=3600)
def _load():
    df = load_combined_installations()
    annual = cumulative_capacity(df)
    gaps = compute_gap(annual) if not annual.empty else []
    return annual, gaps


annual, gaps = _load()

if not gaps:
    st.warning("Keine Daten vorhanden — bitte Daten-Pipeline ausführen.")
    st.stop()

# ── Headline ────────────────────────────────────────────────────────────────
worst = max(gaps, key=lambda g: g.gap_years)
if worst.gap_years > 0:
    st.error(
        f"### Bei aktuellem Ausbautempo verfehlt NRW das Ziel 2030 "
        f"um **{worst.gap_years:.0f} Jahre** ({worst.technology})"
    )
else:
    st.success("### NRW ist auf Kurs, die 2030-Ziele zu erreichen.")

# ── Per-Technology Detail ───────────────────────────────────────────────────
for gap in gaps:
    icon = "☀️" if gap.technology == "Solar" else "💨"
    color = "#f1c40f" if gap.technology == "Solar" else "#3498db"

    with st.expander(f"{icon} {gap.technology}", expanded=True):
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Aktuell", f"{gap.current_gw:.1f} GW")
        c2.metric("Ziel 2030", f"{gap.target_gw:.0f} GW")
        c3.metric("Fehlend", f"{gap.remaining_gw:.1f} GW")
        c4.metric(
            "Ø Zubau/Jahr",
            f"{gap.current_annual_rate_gw:.2f} GW",
        )

        st.markdown(
            f"**Projektion:** Bei Fortschreibung der aktuellen Rate wird das Ziel "
            f"im Jahr **{gap.projected_year}** erreicht "
            f"({'pünktlich' if gap.gap_years == 0 else f'{gap.gap_years:.0f} Jahre zu spät'})."
        )

# ── Scenario Analysis ──────────────────────────────────────────────────────
st.divider()
st.subheader("Szenarioanalyse: Was wäre wenn?")

st.markdown(
    "Wie verändert sich die Zielerreichung, wenn der jährliche Zubau "
    "beschleunigt wird?"
)

for gap in gaps:
    icon = "☀️" if gap.technology == "Solar" else "💨"
    color = "#f1c40f" if gap.technology == "Solar" else "#3498db"
    target_year = TARGETS_2030["coal_exit_year"]

    tech_annual = annual.loc[annual["technology"] == gap.technology].copy()
    tech_annual["cumulative_gw"] = tech_annual["cumulative_mw"] / 1_000

    if tech_annual.empty:
        continue

    last_year = int(tech_annual["year"].max())
    last_gw = float(tech_annual["cumulative_gw"].iloc[-1])
    base_rate = gap.current_annual_rate_gw

    multipliers = [1.0, 1.5, 2.0, 3.0]
    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=tech_annual["year"],
            y=tech_annual["cumulative_gw"],
            mode="lines+markers",
            name="Historisch",
            line=dict(color=color, width=3),
        )
    )

    fig.add_hline(
        y=gap.target_gw,
        line_dash="dash",
        line_color="#e74c3c",
        annotation_text=f"Ziel: {gap.target_gw} GW",
        annotation_position="top left",
    )

    dash_styles = ["solid", "dot", "dashdot", "longdash"]
    for mult, dash in zip(multipliers, dash_styles):
        rate = base_rate * mult
        if rate <= 0:
            continue

        proj_years = list(range(last_year, 2040))
        proj_gw = [last_gw + rate * (y - last_year) for y in proj_years]

        label = f"×{mult:.1f}" if mult != 1.0 else "Aktuelles Tempo"
        fig.add_trace(
            go.Scatter(
                x=proj_years,
                y=proj_gw,
                mode="lines",
                name=f"{label} ({rate:.2f} GW/a)",
                line=dict(
                    color=color,
                    width=2 if mult == 1.0 else 1.5,
                    dash=dash,
                ),
                opacity=0.7,
            )
        )

    fig.add_vline(
        x=target_year,
        line_dash="dash",
        line_color="rgba(255,255,255,0.4)",
        annotation_text="2030",
    )

    fig.update_layout(
        title=f"{icon} {gap.technology} — Szenarien",
        xaxis_title="Jahr",
        yaxis_title="Installierte Leistung (GW)",
        template="plotly_dark",
        height=450,
        margin=dict(l=40, r=20, t=60, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig, use_container_width=True)

# ── Summary Table ───────────────────────────────────────────────────────────
st.divider()
st.subheader("Zusammenfassung")

rows = []
for gap in gaps:
    for mult in [1.0, 1.5, 2.0, 3.0]:
        rate = gap.current_annual_rate_gw * mult
        if rate > 0:
            years = gap.remaining_gw / rate
            proj = gap.projected_year if mult == 1.0 else int(2026 + years)
        else:
            years = float("inf")
            proj = "nie"

        rows.append(
            {
                "Technologie": gap.technology,
                "Szenario": f"×{mult:.1f}" if mult != 1.0 else "Aktuell",
                "Zubau/Jahr (GW)": round(rate, 3),
                "Jahre bis Ziel": round(years, 1) if years != float("inf") else "∞",
                "Zielerreichung": proj,
                "Pünktlich?": "✅" if isinstance(proj, int) and proj <= 2030 else "❌",
            }
        )

st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

st.caption(
    "Hinweis: Die Szenarien extrapolieren den durchschnittlichen Zubau der "
    "letzten drei Jahre. Politische Maßnahmen, Genehmigungsverfahren und "
    "Lieferketteneffekte können die tatsächliche Entwicklung erheblich "
    "beeinflussen."
)
