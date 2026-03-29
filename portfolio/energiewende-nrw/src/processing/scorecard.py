"""Municipality-level Energiewende scorecard."""

from __future__ import annotations

import logging

import pandas as pd

log = logging.getLogger(__name__)


def compute_scorecard(
    installations: pd.DataFrame,
    population: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Score each municipality on its energy-transition progress.

    Parameters
    ----------
    installations : DataFrame
        Combined solar+wind with columns: GemeindeName, Gemeindeschluessel,
        capacity_mw, Inbetriebnahmedatum, technology.
    population : DataFrame, optional
        With columns: Gemeindeschluessel, einwohner (population).
        If None, per-capita metrics are omitted.

    Returns a DataFrame with one row per municipality.
    """
    if installations.empty:
        return pd.DataFrame()

    df = installations.dropna(subset=["GemeindeName"]).copy()

    gem_group = df.groupby(["GemeindeName", "Gemeindeschluessel"])

    agg = gem_group.agg(
        anlagen_gesamt=("EinheitMastrNummer", "count"),
        kapazitaet_mw=("capacity_mw", "sum"),
        solar_mw=("capacity_mw", lambda s: s[df.loc[s.index, "technology"] == "Solar"].sum()),
        wind_mw=("capacity_mw", lambda s: s[df.loc[s.index, "technology"] == "Wind"].sum()),
        erste_anlage=("Inbetriebnahmedatum", "min"),
        letzte_anlage=("Inbetriebnahmedatum", "max"),
    ).reset_index()

    n_tech = (
        df.groupby(["GemeindeName", "Gemeindeschluessel"])["technology"]
        .nunique()
        .reset_index()
        .rename(columns={"technology": "technologie_vielfalt"})
    )
    agg = agg.merge(n_tech, on=["GemeindeName", "Gemeindeschluessel"], how="left")

    recent_cutoff = pd.Timestamp.now() - pd.DateOffset(years=3)
    recent = df.loc[df["Inbetriebnahmedatum"] >= recent_cutoff]
    recent_agg = (
        recent.groupby(["GemeindeName", "Gemeindeschluessel"])["capacity_mw"]
        .sum()
        .reset_index()
        .rename(columns={"capacity_mw": "zubau_3j_mw"})
    )
    agg = agg.merge(recent_agg, on=["GemeindeName", "Gemeindeschluessel"], how="left")
    agg["zubau_3j_mw"] = agg["zubau_3j_mw"].fillna(0)

    if population is not None and not population.empty:
        agg = agg.merge(population, on="Gemeindeschluessel", how="left")
        if "einwohner" in agg.columns:
            agg["kw_pro_kopf"] = (agg["kapazitaet_mw"] * 1_000) / agg["einwohner"]

    agg = _assign_score(agg)
    return agg.sort_values("score", ascending=False).reset_index(drop=True)


def _assign_score(df: pd.DataFrame) -> pd.DataFrame:
    """Compute a 0–100 composite score per municipality.

    Components (equal-weighted percentile ranks):
      - Total installed capacity
      - 3-year expansion rate
      - Technology diversity (1 or 2)
    """
    score_cols = []

    for col in ("kapazitaet_mw", "zubau_3j_mw"):
        rank_col = f"_rank_{col}"
        df[rank_col] = df[col].rank(pct=True)
        score_cols.append(rank_col)

    df["_rank_vielfalt"] = df["technologie_vielfalt"].rank(pct=True)
    score_cols.append("_rank_vielfalt")

    if "kw_pro_kopf" in df.columns:
        df["_rank_kw_pro_kopf"] = df["kw_pro_kopf"].rank(pct=True)
        score_cols.append("_rank_kw_pro_kopf")

    df["score"] = (df[score_cols].mean(axis=1) * 100).round(1)

    df["status"] = pd.cut(
        df["score"],
        bins=[0, 33, 66, 100],
        labels=["Nachholbedarf", "Im Zeitplan", "Vorreiter"],
        include_lowest=True,
    )

    df = df.drop(columns=[c for c in df.columns if c.startswith("_rank_")])
    return df
