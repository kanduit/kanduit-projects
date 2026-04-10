#!/usr/bin/env python3
"""
Generate realistic sample data for the July 2021 Ahr Valley flood event.

All coordinates are approximate real-world locations. Hydrographs are modeled
using shifted gamma curves calibrated to reported peak levels. Event timestamps
are based on publicly documented investigation reports.

Outputs JSON/GeoJSON files to ../docs/data/
"""

import json
import math
import os
import random
from datetime import datetime, timedelta, timezone

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "data")

SEED = 2021_07_14
random.seed(SEED)

# ---------------------------------------------------------------------------
# Municipality definitions (approximate centres, populations, elevations)
# ---------------------------------------------------------------------------

MUNICIPALITIES = [
    {"name": "Schuld", "lat": 50.369, "lon": 6.870, "pop": 700, "elev": 215, "river": "Ahr", "devastation": "extreme"},
    {"name": "Insul", "lat": 50.370, "lon": 6.895, "pop": 500, "elev": 220, "river": "Ahr", "devastation": "extreme"},
    {"name": "Altenahr", "lat": 50.517, "lon": 6.985, "pop": 1_800, "elev": 175, "river": "Ahr", "devastation": "extreme"},
    {"name": "Mayschoß", "lat": 50.530, "lon": 7.014, "pop": 1_000, "elev": 160, "river": "Ahr", "devastation": "severe"},
    {"name": "Dernau", "lat": 50.543, "lon": 7.044, "pop": 1_700, "elev": 140, "river": "Ahr", "devastation": "severe"},
    {"name": "Bad Neuenahr-Ahrweiler", "lat": 50.548, "lon": 7.118, "pop": 28_000, "elev": 100, "river": "Ahr", "devastation": "severe"},
    {"name": "Sinzig", "lat": 50.547, "lon": 7.177, "pop": 17_500, "elev": 70, "river": "Ahr", "devastation": "moderate"},
    {"name": "Blankenheim", "lat": 50.435, "lon": 6.648, "pop": 8_000, "elev": 500, "river": "Ahr (upper)", "devastation": "moderate"},
    {"name": "Euskirchen", "lat": 50.660, "lon": 6.790, "pop": 59_000, "elev": 165, "river": "Erft", "devastation": "moderate"},
    {"name": "Swisttal", "lat": 50.680, "lon": 6.970, "pop": 18_500, "elev": 150, "river": "Swist", "devastation": "moderate"},
    {"name": "Erftstadt", "lat": 50.810, "lon": 6.770, "pop": 50_000, "elev": 100, "river": "Erft", "devastation": "severe"},
    {"name": "Weilerswist", "lat": 50.760, "lon": 6.840, "pop": 17_000, "elev": 130, "river": "Erft", "devastation": "moderate"},
    {"name": "Rheinbach", "lat": 50.630, "lon": 6.950, "pop": 27_000, "elev": 180, "river": "Swist", "devastation": "light"},
    {"name": "Stolberg", "lat": 50.770, "lon": 6.230, "pop": 56_000, "elev": 200, "river": "Vicht/Inde", "devastation": "severe"},
]

# ---------------------------------------------------------------------------
# Gauge station definitions
# ---------------------------------------------------------------------------

GAUGE_STATIONS = [
    {"id": "AHR_MUESCH",       "name": "Müsch",           "river": "Ahr",  "lat": 50.383, "lon": 6.825, "normal_cm": 35,  "warn_cm": 150, "critical_cm": 300, "peak_cm": 520,  "peak_offset_h": -3.0},
    {"id": "AHR_SCHULD",       "name": "Schuld",          "river": "Ahr",  "lat": 50.369, "lon": 6.870, "normal_cm": 45,  "warn_cm": 180, "critical_cm": 350, "peak_cm": 650,  "peak_offset_h": -1.5},
    {"id": "AHR_ALTENAHR",     "name": "Altenahr",        "river": "Ahr",  "lat": 50.517, "lon": 6.985, "normal_cm": 55,  "warn_cm": 200, "critical_cm": 400, "peak_cm": 710,  "peak_offset_h": 0.0},
    {"id": "AHR_DERNAU",       "name": "Dernau",          "river": "Ahr",  "lat": 50.543, "lon": 7.044, "normal_cm": 50,  "warn_cm": 190, "critical_cm": 380, "peak_cm": 620,  "peak_offset_h": 1.0},
    {"id": "AHR_BODENDORF",    "name": "Bad Bodendorf",   "river": "Ahr",  "lat": 50.555, "lon": 7.155, "normal_cm": 60,  "warn_cm": 200, "critical_cm": 400, "peak_cm": 550,  "peak_offset_h": 2.5},
    {"id": "ERFT_BLIESHEIM",   "name": "Bliesheim",       "river": "Erft", "lat": 50.796, "lon": 6.818, "normal_cm": 40,  "warn_cm": 120, "critical_cm": 250, "peak_cm": 380,  "peak_offset_h": 4.0},
]

# Reference peak time: Altenahr peak is July 14, 2021 03:00 UTC
PEAK_REF = datetime(2021, 7, 14, 3, 0, tzinfo=timezone.utc)

# Simulation window
SIM_START = datetime(2021, 7, 9, 0, 0, tzinfo=timezone.utc)
SIM_END   = datetime(2021, 7, 17, 0, 0, tzinfo=timezone.utc)

# ---------------------------------------------------------------------------
# Event timeline (based on public investigation reports)
# ---------------------------------------------------------------------------

EVENTS = [
    {"ts": "2021-07-09T18:00Z", "source": "EFAS", "type": "warning", "severity": "low",
     "title": "EFAS Flash Flood Warning Issued",
     "desc": "EFAS issues first probabilistic flood alert for Rhine tributaries. Probability of exceeding 5-year return period: 65%. Sent to German federal authorities via EFFIS portal.",
     "municipalities": ["Blankenheim", "Euskirchen"]},

    {"ts": "2021-07-10T12:00Z", "source": "EFAS", "type": "warning", "severity": "medium",
     "title": "EFAS Upgrades to Formal Flood Warning",
     "desc": "EFAS formal notification sent to German Federal Institute of Hydrology (BfG). Warning covers Ahr, Erft, and Rur catchments. Probability exceeding 20-year return period: >50%.",
     "municipalities": ["Schuld", "Altenahr", "Euskirchen", "Erftstadt"]},

    {"ts": "2021-07-12T06:00Z", "source": "DWD", "type": "warning", "severity": "medium",
     "title": "DWD Severe Weather Watch (Vorabinformation)",
     "desc": "DWD issues advance warning for extreme precipitation in Eifel region. Expected: 100-150mm in 48 hours. Landkreise receive PDF via email.",
     "municipalities": ["Schuld", "Insul", "Altenahr", "Blankenheim"]},

    {"ts": "2021-07-13T06:00Z", "source": "DWD", "type": "warning", "severity": "high",
     "title": "DWD Extreme Weather Warning Level 4 (Unwetterwarnung)",
     "desc": "Highest DWD warning level issued: >200mm rainfall expected in Eifel/Ahr within 24h. Warning distributed to Landkreise Ahrweiler, Euskirchen, and Rhein-Sieg-Kreis.",
     "municipalities": ["Schuld", "Insul", "Altenahr", "Mayschoß", "Dernau", "Bad Neuenahr-Ahrweiler", "Euskirchen"]},

    {"ts": "2021-07-13T15:00Z", "source": "Gauge", "type": "threshold", "severity": "medium",
     "title": "Müsch Gauge Exceeds Warning Level",
     "desc": "First Ahr gauge to cross warning threshold (150cm). Water level rising at 15cm/hour. No automated alert system connected to this gauge.",
     "municipalities": ["Schuld", "Insul"]},

    {"ts": "2021-07-13T18:00Z", "source": "Gauge", "type": "threshold", "severity": "high",
     "title": "Multiple Gauges Exceed Warning Levels",
     "desc": "Schuld (180cm) and Altenahr (200cm) gauges cross warning thresholds. Rate of rise accelerating. Landkreis Ahrweiler activates crisis staff.",
     "municipalities": ["Schuld", "Altenahr", "Mayschoß"]},

    {"ts": "2021-07-13T23:00Z", "source": "Gauge", "type": "threshold", "severity": "critical",
     "title": "Schuld Gauge Exceeds Critical Level",
     "desc": "Schuld gauge at 380cm and rising — exceeds all-time record (320cm from 2016). Exponential rise indicates flash flood. No automated evacuation trigger exists.",
     "municipalities": ["Schuld", "Insul"]},

    {"ts": "2021-07-14T00:30Z", "source": "Gauge", "type": "threshold", "severity": "critical",
     "title": "Altenahr Gauge Exceeds Critical Level",
     "desc": "Altenahr reads 420cm — well above critical (400cm). Rising 50cm/hour. Gauge will be destroyed at ~03:00 when peak exceeds 700cm.",
     "municipalities": ["Altenahr", "Mayschoß", "Dernau"]},

    {"ts": "2021-07-14T01:09Z", "source": "Authority", "type": "action", "severity": "critical",
     "title": "Landkreis Ahrweiler Issues First Warning via Katwarn",
     "desc": "First official public warning sent via Katwarn app: 'Extreme flooding Ahr. Seek higher ground immediately.' Many residents asleep, not registered for app.",
     "municipalities": ["Schuld", "Altenahr", "Mayschoß", "Dernau", "Bad Neuenahr-Ahrweiler"]},

    {"ts": "2021-07-14T02:00Z", "source": "Authority", "type": "action", "severity": "critical",
     "title": "Cell Broadcast Evacuation Would Have Been Possible",
     "desc": "Cell broadcast (DE-Alert) was not yet deployed in Germany. Would have reached all mobile phones in affected area without app registration.",
     "municipalities": ["Schuld", "Insul", "Altenahr", "Mayschoß", "Dernau", "Bad Neuenahr-Ahrweiler"]},

    {"ts": "2021-07-14T03:00Z", "source": "Event", "type": "impact", "severity": "critical",
     "title": "Catastrophic Peak — Ahr Valley",
     "desc": "Ahr river reaches estimated 7m+ at Altenahr. Entire valley floor inundated. Houses swept from foundations. Bridges destroyed. Gauge infrastructure lost.",
     "municipalities": ["Schuld", "Insul", "Altenahr", "Mayschoß", "Dernau"]},

    {"ts": "2021-07-14T06:00Z", "source": "Event", "type": "impact", "severity": "critical",
     "title": "Erftstadt-Blessem Gravel Pit Collapse",
     "desc": "Floodwaters erode into active gravel quarry at Erftstadt-Blessem, creating massive sinkhole that swallows houses and roads.",
     "municipalities": ["Erftstadt"]},

    {"ts": "2021-07-14T14:00Z", "source": "Authority", "type": "action", "severity": "high",
     "title": "Federal THW Deploys to Ahr Valley",
     "desc": "Technisches Hilfswerk (THW) deploys major assets. Road infrastructure destroyed — many villages unreachable. Helicopter evacuations begin.",
     "municipalities": ["Schuld", "Altenahr", "Dernau", "Bad Neuenahr-Ahrweiler", "Sinzig"]},

    {"ts": "2021-07-14T21:00Z", "source": "Authority", "type": "action", "severity": "critical",
     "title": "Steinbachtalsperre Dam Failure Feared",
     "desc": "Authorities order precautionary evacuation of Swisttal-Odendorf due to risk of Steinbachtalsperre dam breach. Dam holds, but illustrates cascading risks.",
     "municipalities": ["Swisttal", "Rheinbach"]},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_polygon(lat: float, lon: float, n_vertices: int = 10, radius_deg: float = 0.025) -> list:
    """Generate an irregular polygon around a centre point."""
    coords = []
    for i in range(n_vertices):
        angle = 2 * math.pi * i / n_vertices
        r = radius_deg * (0.7 + 0.6 * random.random())
        # Longitude correction for latitude
        plon = lon + r * math.cos(angle) / math.cos(math.radians(lat))
        plat = lat + r * math.sin(angle)
        coords.append([round(plon, 5), round(plat, 5)])
    coords.append(coords[0])  # close ring
    return [coords]


def flood_hydrograph(station: dict, time_hours: float) -> float:
    """
    Model gauge level at a given time offset (hours since SIM_START).

    Uses an asymmetric double-exponential curve centered on the station's peak
    time. Rising limb is steeper than recession.
    """
    peak_time_h = (PEAK_REF - SIM_START).total_seconds() / 3600 + station["peak_offset_h"]
    dt = time_hours - peak_time_h
    normal = station["normal_cm"]
    amplitude = station["peak_cm"] - normal

    if dt < -36:
        return normal + random.gauss(0, 1.5)

    # Gradual pre-event rise starting ~36h before peak
    if dt < -12:
        frac = (dt + 36) / 24
        rise = amplitude * 0.05 * max(0, frac) ** 2
        return normal + rise + random.gauss(0, 2)

    # Rapid rise in final 12 hours before peak
    if dt < 0:
        frac = (dt + 12) / 12
        rise = amplitude * (0.05 + 0.95 * (frac ** 3))
        return normal + rise + random.gauss(0, 3)

    # Peak region (±1h)
    if dt < 1:
        return station["peak_cm"] + random.gauss(0, 5)

    # Recession limb (slower exponential decay)
    recession = amplitude * math.exp(-0.06 * (dt - 1))
    level = normal + recession + random.gauss(0, 2)
    return max(normal - 5, level)


def precipitation_curve(time_hours: float) -> float:
    """
    Approximate hourly precipitation (mm/h) for the Eifel region.

    Peak precip preceded flood peak by ~6-12 hours.
    """
    precip_peak_h = (PEAK_REF - SIM_START).total_seconds() / 3600 - 8
    dt = time_hours - precip_peak_h

    if abs(dt) > 30:
        return max(0, random.gauss(0.5, 0.5))

    # Broad rain event with intense core
    broad = 8 * math.exp(-0.01 * dt * dt)
    core = 35 * math.exp(-0.08 * dt * dt)
    return max(0, broad + core + random.gauss(0, 2))


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def gen_municipalities():
    features = []
    for m in MUNICIPALITIES:
        feature = {
            "type": "Feature",
            "properties": {
                "name": m["name"],
                "population": m["pop"],
                "elevation_avg_m": m["elev"],
                "river": m["river"],
                "devastation_level": m["devastation"],
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": make_polygon(m["lat"], m["lon"]),
            },
        }
        features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def gen_gauge_stations():
    features = []
    for s in GAUGE_STATIONS:
        feature = {
            "type": "Feature",
            "properties": {
                "station_id": s["id"],
                "name": s["name"],
                "river": s["river"],
                "normal_level_cm": s["normal_cm"],
                "warning_level_cm": s["warn_cm"],
                "critical_level_cm": s["critical_cm"],
            },
            "geometry": {
                "type": "Point",
                "coordinates": [s["lon"], s["lat"]],
            },
        }
        features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def gen_gauge_readings():
    readings = {}
    for s in GAUGE_STATIONS:
        sid = s["id"]
        readings[sid] = []
        t = SIM_START
        while t < SIM_END:
            hours_since_start = (t - SIM_START).total_seconds() / 3600
            level = flood_hydrograph(s, hours_since_start)
            readings[sid].append({
                "timestamp": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "level_cm": round(max(0, level), 1),
            })
            t += timedelta(hours=1)
    return readings


def gen_precipitation():
    data = []
    t = SIM_START
    while t < SIM_END:
        hours = (t - SIM_START).total_seconds() / 3600
        rate = precipitation_curve(hours)
        data.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "precipitation_mm_h": round(max(0, rate), 1),
        })
        t += timedelta(hours=1)
    return data


def gen_event_timeline():
    return [
        {
            "timestamp": e["ts"],
            "source": e["source"],
            "type": e["type"],
            "severity": e["severity"],
            "title": e["title"],
            "description": e["desc"],
            "municipalities_affected": e["municipalities"],
        }
        for e in EVENTS
    ]


def gen_population_grid():
    """Simplified population data per municipality."""
    return [
        {
            "name": m["name"],
            "lat": m["lat"],
            "lon": m["lon"],
            "population": m["pop"],
            "density_per_km2": round(m["pop"] / (math.pi * 2.5**2), 1),
            "households_estimated": m["pop"] // 2,
        }
        for m in MUNICIPALITIES
    ]


def gen_risk_scores():
    """
    Composite risk score (0-100) per municipality.
    Weighted: 30% elevation (lower = riskier), 30% proximity to river,
    20% population density, 20% historical devastation.
    """
    devastation_map = {"extreme": 1.0, "severe": 0.75, "moderate": 0.4, "light": 0.15}
    max_pop = max(m["pop"] for m in MUNICIPALITIES)
    max_elev = max(m["elev"] for m in MUNICIPALITIES)

    scores = []
    for m in MUNICIPALITIES:
        elev_score = (1 - m["elev"] / max_elev) * 30
        river_score = 25 if "Ahr" in m["river"] else 12
        pop_score = (m["pop"] / max_pop) * 20
        hist_score = devastation_map.get(m["devastation"], 0.2) * 20
        total = min(100, round(elev_score + river_score + pop_score + hist_score + random.gauss(0, 3)))
        scores.append({
            "name": m["name"],
            "lat": m["lat"],
            "lon": m["lon"],
            "risk_score": max(5, total),
            "components": {
                "elevation_risk": round(elev_score, 1),
                "river_proximity": round(river_score, 1),
                "population_exposure": round(pop_score, 1),
                "historical_severity": round(hist_score, 1),
            },
        })

    scores.sort(key=lambda s: s["risk_score"], reverse=True)
    return scores


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def write_json(filename: str, data):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    size_kb = os.path.getsize(path) / 1024
    print(f"  {filename:30s} {size_kb:>7.1f} KB")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Generating flood warning platform sample data...")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}\n")

    write_json("municipalities.geojson", gen_municipalities())
    write_json("gauge_stations.geojson", gen_gauge_stations())
    write_json("gauge_readings.json", gen_gauge_readings())
    write_json("precipitation.json", gen_precipitation())
    write_json("event_timeline.json", gen_event_timeline())
    write_json("population_grid.json", gen_population_grid())
    write_json("risk_scores.json", gen_risk_scores())

    print("\nDone. All data files generated successfully.")


if __name__ == "__main__":
    main()
