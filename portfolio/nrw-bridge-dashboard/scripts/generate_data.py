#!/usr/bin/env python3
"""
Generate bridge data for the NRW Bridge Monitor dashboard.

1. Fetches real bridge locations from OpenStreetMap (Overpass API)
2. Generates realistic synthetic attributes (condition grades, traffic, InSAR, etc.)
3. Computes composite risk scores
4. Exports bridges.geojson and top50.json
"""

import json
import math
import os
import random
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import requests

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"

NRW_BBOX = {
    "south": 50.32,
    "west": 5.87,
    "north": 52.53,
    "east": 9.46,
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

ROAD_CLASSES = ["Autobahn", "Bundesstraße", "Landesstraße", "Kreisstraße", "Gemeindestraße"]
ROAD_CLASS_WEIGHTS = [0.08, 0.12, 0.25, 0.30, 0.25]

STRUCTURE_TYPES = ["Spannbetonbrücke", "Stahlverbundbrücke", "Stahlbrücke", "Steinbrücke", "Stahlbetonbrücke"]
STRUCTURE_TYPE_WEIGHTS = [0.35, 0.20, 0.10, 0.05, 0.30]

NRW_CITY_PREFIXES = [
    "Köln", "Düsseldorf", "Dortmund", "Essen", "Duisburg", "Bochum", "Wuppertal",
    "Bielefeld", "Bonn", "Münster", "Aachen", "Gelsenkirchen", "Mönchengladbach",
    "Krefeld", "Oberhausen", "Hagen", "Hamm", "Mülheim", "Leverkusen", "Solingen",
    "Herne", "Neuss", "Paderborn", "Recklinghausen", "Bottrop", "Remscheid",
    "Bergisch Gladbach", "Siegen", "Gütersloh", "Moers", "Witten", "Iserlohn",
    "Marl", "Lünen", "Ratingen", "Minden", "Velbert", "Viersen", "Dorsten",
]

GERMAN_RIVER_NAMES = [
    "Rhein", "Ruhr", "Lippe", "Ems", "Wupper", "Sieg", "Erft", "Emscher",
    "Lenne", "Volme", "Niers", "Rur", "Agger", "Dhünn", "Bigge", "Möhne",
]

BRIDGE_SUFFIXES = ["brücke", "überführung", "talbrücke", "viadukt"]

ROAD_REFS_AUTOBAHN = ["A1", "A2", "A3", "A4", "A40", "A42", "A43", "A44", "A45", "A46",
                       "A52", "A57", "A59", "A61", "A565", "A555", "A553"]
ROAD_REFS_BUNDES = [f"B{n}" for n in [1, 7, 8, 51, 54, 55, 56, 57, 58, 62, 64, 66, 224, 226, 229, 236]]


def fetch_osm_bridges():
    """Fetch bridge locations from OpenStreetMap Overpass API for NRW."""
    print("Fetching bridge locations from OpenStreetMap...")

    query = f"""
    [out:json][timeout:120];
    (
      way["bridge"="yes"]["highway"](
        {NRW_BBOX['south']},{NRW_BBOX['west']},{NRW_BBOX['north']},{NRW_BBOX['east']}
      );
    );
    out center;
    """

    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        elements = data.get("elements", [])
        print(f"  Received {len(elements)} bridge ways from OSM")

        bridges = []
        for el in elements:
            center = el.get("center", {})
            lat = center.get("lat")
            lon = center.get("lon")
            if lat is None or lon is None:
                continue
            tags = el.get("tags", {})
            bridges.append({
                "osm_id": el["id"],
                "lat": lat,
                "lon": lon,
                "name": tags.get("name", ""),
                "road_ref": tags.get("ref", ""),
                "highway_type": tags.get("highway", ""),
                "lanes": tags.get("lanes", ""),
            })
        return bridges

    except Exception as e:
        print(f"  OSM fetch failed: {e}")
        print("  Falling back to synthetic locations...")
        return None


def generate_synthetic_locations(count=15000):
    """Generate synthetic bridge locations within NRW boundaries."""
    print(f"Generating {count} synthetic bridge locations...")

    np.random.seed(42)

    nrw_center_lat, nrw_center_lon = 51.43, 7.66
    lats = np.random.normal(nrw_center_lat, 0.45, count)
    lons = np.random.normal(nrw_center_lon, 0.75, count)

    lats = np.clip(lats, NRW_BBOX["south"], NRW_BBOX["north"])
    lons = np.clip(lons, NRW_BBOX["west"], NRW_BBOX["east"])

    # Add clustering around major cities (Ruhrgebiet density)
    ruhr_centers = [
        (51.45, 7.01), (51.51, 7.47), (51.48, 7.22), (51.43, 6.76),
        (51.23, 6.78), (51.26, 7.18), (50.94, 6.96), (51.96, 7.63),
        (50.74, 7.10), (51.03, 7.00),
    ]
    cluster_count = int(count * 0.3)
    for i in range(cluster_count):
        center = ruhr_centers[i % len(ruhr_centers)]
        idx = i % count
        lats[idx] = np.clip(np.random.normal(center[0], 0.08), NRW_BBOX["south"], NRW_BBOX["north"])
        lons[idx] = np.clip(np.random.normal(center[1], 0.08), NRW_BBOX["west"], NRW_BBOX["east"])

    bridges = []
    for i in range(count):
        bridges.append({
            "osm_id": 100000000 + i,
            "lat": float(lats[i]),
            "lon": float(lons[i]),
            "name": "",
            "road_ref": "",
            "highway_type": "",
            "lanes": "",
        })
    return bridges


def generate_bridge_name(road_class, road_ref, idx):
    """Generate a realistic German bridge name."""
    rng = random.Random(idx)

    if road_class == "Autobahn" and rng.random() < 0.7:
        river = rng.choice(GERMAN_RIVER_NAMES)
        suffix = rng.choice(["brücke", "talbrücke"])
        return f"{road_ref} {river}{suffix}"

    if rng.random() < 0.4:
        river = rng.choice(GERMAN_RIVER_NAMES)
        return f"{river}{rng.choice(BRIDGE_SUFFIXES)}"

    if rng.random() < 0.5:
        city = rng.choice(NRW_CITY_PREFIXES)
        suffix = rng.choice(BRIDGE_SUFFIXES)
        return f"{city}er {suffix.capitalize()}"

    return f"BW {idx:05d}"


def enrich_bridges(bridges):
    """Add synthetic attributes to each bridge."""
    print(f"Enriching {len(bridges)} bridges with synthetic attributes...")

    np.random.seed(42)
    random.seed(42)
    n = len(bridges)

    road_classes = np.random.choice(ROAD_CLASSES, size=n, p=ROAD_CLASS_WEIGHTS)
    structure_types = np.random.choice(STRUCTURE_TYPES, size=n, p=STRUCTURE_TYPE_WEIGHTS)

    # Construction year: peak 1965-1975
    baujahr = np.random.normal(1970, 12, n).astype(int)
    baujahr = np.clip(baujahr, 1920, 2020)

    # Condition grades: beta distribution skewed toward 1.5-2.5
    raw_grades = np.random.beta(2.5, 3.5, n)
    zustandsnoten = 1.0 + raw_grades * 3.0
    zustandsnoten = np.round(zustandsnoten * 2) / 2  # Round to 0.5 steps

    # Older bridges tend toward worse condition
    age_factor = np.clip((2026 - baujahr - 30) / 50, 0, 1)
    zustandsnoten = np.clip(zustandsnoten + age_factor * 0.5, 1.0, 4.0)
    zustandsnoten = np.round(zustandsnoten * 2) / 2

    for i, b in enumerate(bridges):
        rc = road_classes[i]
        b["strassenklasse"] = rc

        if not b["road_ref"]:
            if rc == "Autobahn":
                b["road_ref"] = random.choice(ROAD_REFS_AUTOBAHN)
            elif rc == "Bundesstraße":
                b["road_ref"] = random.choice(ROAD_REFS_BUNDES)
            else:
                b["road_ref"] = f"L{random.randint(100, 999)}" if rc == "Landesstraße" else f"K{random.randint(1, 99)}"

        if not b["name"]:
            b["name"] = generate_bridge_name(rc, b["road_ref"], i)

        b["bauwerk_typ"] = structure_types[i]
        b["baujahr"] = int(baujahr[i])
        b["zustandsnote"] = float(zustandsnoten[i])

        # Traffic (AADT) by road class
        dtv_ranges = {
            "Autobahn": (30000, 120000),
            "Bundesstraße": (8000, 40000),
            "Landesstraße": (2000, 15000),
            "Kreisstraße": (500, 5000),
            "Gemeindestraße": (100, 2000),
        }
        lo, hi = dtv_ranges[rc]
        b["verkehr_dtv"] = int(np.random.uniform(lo, hi))

        # Load capacity
        cap_ranges = {
            "Autobahn": (30, 60),
            "Bundesstraße": (20, 44),
            "Landesstraße": (16, 30),
            "Kreisstraße": (12, 24),
            "Gemeindestraße": (6, 16),
        }
        lo, hi = cap_ranges[rc]
        b["tragfaehigkeit_tonnen"] = int(np.random.uniform(lo, hi))

        design_load = b["tragfaehigkeit_tonnen"]
        actual_load_estimate = b["verkehr_dtv"] / 1000 * 0.4
        b["verkehrslast_verhaeltnis"] = round(min(actual_load_estimate / max(design_load, 1), 2.0), 2)

        b["anzahl_felder"] = random.choice([1, 1, 2, 2, 2, 3, 3, 4, 5])
        b["strukturelle_redundanz"] = 0 if b["anzahl_felder"] == 1 else 1

        umweg_ranges = {
            "Autobahn": (15, 80),
            "Bundesstraße": (5, 40),
            "Landesstraße": (3, 20),
            "Kreisstraße": (2, 10),
            "Gemeindestraße": (1, 5),
        }
        lo, hi = umweg_ranges[rc]
        b["wirtschaftlicher_umweg_km"] = round(random.uniform(lo, hi), 1)

        days_back = random.randint(180, 2000)
        b["letzte_pruefung"] = (date(2026, 3, 1) - timedelta(days=days_back)).isoformat()

        # InSAR displacement time series (12 months)
        is_anomalous = random.random() < 0.05
        if is_anomalous:
            trend = np.random.uniform(-0.8, -0.2)
            noise = np.random.normal(0, 0.3, 12)
            cumulative = np.cumsum(np.full(12, trend) + noise)
            b["insar_verschiebung_mm"] = [round(float(v), 2) for v in cumulative]
        else:
            b["insar_verschiebung_mm"] = [round(float(v), 2) for v in np.random.normal(0, 0.15, 12)]

        # Inspection history (3-6 past inspections)
        num_inspections = random.randint(3, 6)
        inspection_years = sorted(random.sample(range(2005, 2026), min(num_inspections, 21)))
        base_grade = max(1.0, b["zustandsnote"] - 0.5 * len(inspection_years) * 0.1)
        inspection_history = []
        grade = base_grade
        for yr in inspection_years:
            grade = min(4.0, grade + random.uniform(-0.1, 0.3))
            grade = max(1.0, grade)
            inspection_history.append({
                "jahr": yr,
                "zustandsnote": round(grade * 2) / 2,
            })
        if inspection_history:
            inspection_history[-1]["zustandsnote"] = b["zustandsnote"]
        b["pruefungshistorie"] = inspection_history

    return bridges


def compute_risk_scores(bridges):
    """Compute composite risk score for each bridge."""
    print("Computing risk scores...")

    all_grades = np.array([b["zustandsnote"] for b in bridges])
    all_ages = np.array([max(0, 2026 - b["baujahr"] - 60) for b in bridges])
    all_traffic = np.array([b["verkehrslast_verhaeltnis"] for b in bridges])
    all_detour = np.array([b["wirtschaftlicher_umweg_km"] for b in bridges])

    def normalize(arr):
        mn, mx = arr.min(), arr.max()
        if mx == mn:
            return np.zeros_like(arr)
        return (arr - mn) / (mx - mn)

    norm_grade = normalize(all_grades)
    norm_age = normalize(all_ages)
    norm_traffic = normalize(all_traffic)
    norm_detour = normalize(all_detour)
    redundancy = np.array([1 - b["strukturelle_redundanz"] for b in bridges], dtype=float)

    risk = (
        0.30 * norm_grade +
        0.20 * norm_age +
        0.20 * norm_traffic +
        0.15 * redundancy +
        0.15 * norm_detour
    )

    for i, b in enumerate(bridges):
        b["risiko_score"] = round(float(risk[i]), 4)

    return bridges


def export_geojson(bridges):
    """Export bridges as GeoJSON FeatureCollection."""
    print("Exporting GeoJSON...")

    features = []
    for b in bridges:
        props = {k: v for k, v in b.items() if k not in ("lat", "lon", "osm_id")}
        props["id"] = b["osm_id"]
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [b["lon"], b["lat"]],
            },
            "properties": props,
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / "bridges.geojson"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  Written {out_path} ({size_mb:.1f} MB, {len(features)} features)")
    return geojson


def export_top50(bridges):
    """Export top 50 critical bridges as a separate JSON."""
    print("Exporting Top 50 critical bridges...")

    sorted_bridges = sorted(bridges, key=lambda b: b["risiko_score"], reverse=True)
    top50 = []
    for rank, b in enumerate(sorted_bridges[:50], 1):
        top50.append({
            "rang": rank,
            "id": b["osm_id"],
            "name": b["name"],
            "strassenklasse": b["strassenklasse"],
            "strasse": b["road_ref"],
            "zustandsnote": b["zustandsnote"],
            "baujahr": b["baujahr"],
            "risiko_score": b["risiko_score"],
            "verkehr_dtv": b["verkehr_dtv"],
            "lat": b["lat"],
            "lon": b["lon"],
        })

    out_path = DATA_DIR / "top50.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(top50, f, ensure_ascii=False, indent=2)
    print(f"  Written {out_path}")
    return top50


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bridges = fetch_osm_bridges()

    if bridges is None or len(bridges) < 5000:
        if bridges and len(bridges) > 0:
            print(f"  OSM returned only {len(bridges)} bridges, supplementing with synthetic...")
            needed = 15000 - len(bridges)
            synthetic = generate_synthetic_locations(needed)
            bridges.extend(synthetic)
        else:
            bridges = generate_synthetic_locations(15000)
    elif len(bridges) > 18000:
        print(f"  Trimming from {len(bridges)} to 15000 bridges...")
        random.seed(42)
        random.shuffle(bridges)
        bridges = bridges[:15000]

    bridges = enrich_bridges(bridges)
    bridges = compute_risk_scores(bridges)
    export_geojson(bridges)
    export_top50(bridges)

    scores = [b["risiko_score"] for b in bridges]
    print(f"\nSummary:")
    print(f"  Total bridges: {len(bridges)}")
    print(f"  Risk score range: {min(scores):.3f} - {max(scores):.3f}")
    print(f"  Mean risk score: {np.mean(scores):.3f}")
    print(f"  Bridges with risk > 0.7: {sum(1 for s in scores if s > 0.7)}")
    print(f"  Bridges with risk > 0.8: {sum(1 for s in scores if s > 0.8)}")
    print("Done!")


if __name__ == "__main__":
    main()
