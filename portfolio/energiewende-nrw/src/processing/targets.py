"""2030 target definitions and gap-analysis math."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd

from src.config import EXPANSION_BASELINE_YEAR, TARGETS_2030


@dataclass
class GapResult:
    technology: str
    target_gw: float
    current_gw: float
    remaining_gw: float
    current_annual_rate_gw: float
    years_needed: float
    projected_year: int
    gap_years: float  # positive = behind schedule


def _latest_capacity_gw(
    annual: pd.DataFrame, technology: str
) -> tuple[float, float]:
    """Return (current cumulative GW, avg annual addition GW over last 3 yr)."""
    tech_df = annual.loc[annual["technology"] == technology].sort_values("year")
    if tech_df.empty:
        return 0.0, 0.0

    current_gw = tech_df["cumulative_mw"].iloc[-1] / 1_000
    recent = tech_df.tail(3)
    avg_rate = recent["added_mw"].mean() / 1_000  # GW per year
    return current_gw, avg_rate


def compute_gap(annual: pd.DataFrame) -> list[GapResult]:
    """Compute the gap analysis for solar and wind against NRW 2030 targets."""
    target_year = TARGETS_2030["coal_exit_year"]
    today = date.today()
    years_left = target_year - today.year + (1 - today.timetuple().tm_yday / 365)

    configs = [
        ("Solar", TARGETS_2030["solar_pv_gw"]),
        ("Wind", TARGETS_2030["wind_onshore_gw"]),
    ]

    results: list[GapResult] = []
    for tech, target_gw in configs:
        current_gw, annual_rate = _latest_capacity_gw(annual, tech)
        remaining = max(target_gw - current_gw, 0)

        if annual_rate > 0:
            years_needed = remaining / annual_rate
            projected_year = today.year + int(years_needed)
        else:
            years_needed = float("inf")
            projected_year = 9999

        gap_years = max(projected_year - target_year, 0)

        results.append(
            GapResult(
                technology=tech,
                target_gw=target_gw,
                current_gw=round(current_gw, 2),
                remaining_gw=round(remaining, 2),
                current_annual_rate_gw=round(annual_rate, 3),
                years_needed=round(years_needed, 1),
                projected_year=projected_year,
                gap_years=round(gap_years, 1),
            )
        )

    return results


def required_annual_rate_gw(
    current_gw: float, target_gw: float, target_year: int = 2030
) -> float:
    """GW/year that must be added *from now* to hit the target on time."""
    today = date.today()
    years_left = target_year - today.year + (1 - today.timetuple().tm_yday / 365)
    if years_left <= 0:
        return float("inf")
    return (target_gw - current_gw) / years_left


def build_trajectory(
    start_year: int,
    start_gw: float,
    target_year: int,
    target_gw: float,
) -> pd.DataFrame:
    """Linear required trajectory from start to target."""
    years = list(range(start_year, target_year + 1))
    n = len(years)
    capacities = [start_gw + (target_gw - start_gw) * i / (n - 1) for i in range(n)]
    return pd.DataFrame({"year": years, "required_gw": capacities})
