#!/usr/bin/env python3
"""
Optional: Fetch precipitation data from DWD Open Data.

Downloads recent radar composite files or gridded precipitation
products from the Deutscher Wetterdienst open data server.

Usage:
    python scripts/ingest_dwd.py [--output docs/data/live_precip.json]

DWD Open Data: https://opendata.dwd.de/weather/radar/
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("requests library required: pip install requests")

DWD_RADAR_INDEX = "https://opendata.dwd.de/weather/radar/composite/rv/"
DWD_RECENT_PRECIP = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/hourly/radolan/recent/bin/"


def list_radar_files(url: str) -> list[str]:
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    files = re.findall(r'href="([^"]+\.(?:gz|bz2|bin))"', resp.text)
    return files


def fetch_file_info(url: str, filename: str) -> dict:
    head = requests.head(url + filename, timeout=10)
    return {
        "filename": filename,
        "url": url + filename,
        "size_bytes": int(head.headers.get("Content-Length", 0)),
        "last_modified": head.headers.get("Last-Modified", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch DWD radar/precipitation index")
    parser.add_argument("--output", default="docs/data/live_precip.json")
    parser.add_argument("--max-files", type=int, default=10,
                        help="Max files to list per source")
    args = parser.parse_args()

    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "sources": [],
    }

    sources = [
        ("Radar Composite (RV)", DWD_RADAR_INDEX),
        ("RADOLAN Recent", DWD_RECENT_PRECIP),
    ]

    for name, url in sources:
        print(f"Indexing: {name}")
        print(f"  URL: {url}")
        try:
            files = list_radar_files(url)
        except Exception as e:
            print(f"  Error listing files: {e}")
            result["sources"].append({"name": name, "url": url, "error": str(e)})
            continue

        file_infos = []
        for fname in files[-args.max_files:]:
            try:
                info = fetch_file_info(url, fname)
                file_infos.append(info)
                size_kb = info["size_bytes"] / 1024
                print(f"  {fname:40s} {size_kb:>8.1f} KB")
            except Exception:
                pass

        result["sources"].append({
            "name": name,
            "url": url,
            "total_files": len(files),
            "sample_files": file_infos,
        })

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nSaved index to {args.output}")


if __name__ == "__main__":
    main()
