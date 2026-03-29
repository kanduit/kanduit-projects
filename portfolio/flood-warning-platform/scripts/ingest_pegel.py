#!/usr/bin/env python3
"""
Optional: Fetch live gauge data from the Pegel Online (WSV) REST API.

Demonstrates real-time integration with Germany's federal waterway
gauge monitoring system. Note: only federal waterways are available
(Ahr, Erft, Wupper are state-level and not in this API).

Usage:
    python scripts/ingest_pegel.py [--output docs/data/live_gauges.json]

API docs: https://pegelonline.wsv.de/webservice/dokuRestapi
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("requests library required: pip install requests")

BASE_URL = "https://pegelonline.wsv.de/webservices/rest-api/v2"

DEMO_WATERS = ["RHEIN", "MOSEL", "RUHR"]


def fetch_stations(water: str) -> list:
    url = f"{BASE_URL}/stations.json"
    params = {
        "waters": water,
        "includeTimeseries": "true",
        "includeCurrentMeasurement": "true",
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_measurements(station_uuid: str, days: int = 7) -> list:
    url = f"{BASE_URL}/stations/{station_uuid}/W/measurements.json"
    params = {"start": f"P{days}D"}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="Fetch live Pegel Online data")
    parser.add_argument("--output", default="docs/data/live_gauges.json")
    parser.add_argument("--water", default=",".join(DEMO_WATERS),
                        help="Comma-separated water names")
    args = parser.parse_args()

    waters = [w.strip() for w in args.water.split(",")]
    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "stations": [],
    }

    for water in waters:
        print(f"Fetching stations on {water}...")
        try:
            stations = fetch_stations(water)
        except Exception as e:
            print(f"  Error: {e}")
            continue

        for s in stations[:5]:
            station_data = {
                "uuid": s.get("uuid"),
                "name": s.get("shortname"),
                "long_name": s.get("longname"),
                "water": water,
                "km": s.get("km"),
                "latitude": s.get("latitude"),
                "longitude": s.get("longitude"),
            }

            ts_list = s.get("timeseries", [])
            w_series = next((t for t in ts_list if t.get("shortname") == "W"), None)
            if w_series and w_series.get("currentMeasurement"):
                cm = w_series["currentMeasurement"]
                station_data["current_level_cm"] = cm.get("value")
                station_data["current_timestamp"] = cm.get("timestamp")

            result["stations"].append(station_data)
            print(f"  {station_data['name']:20s} {station_data.get('current_level_cm', '?'):>8} cm")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {len(result['stations'])} stations to {args.output}")


if __name__ == "__main__":
    main()
