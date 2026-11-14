#!/usr/bin/env python3
"""
Run the whole pipeline on the data that is already downloaded, then build the page.

  for every point in data_fetch/points.json that has data/<id>/power_daily.csv and ndvi_16day.csv:
      model/cover.py  -> data/<id>/cover_calendar.json
      model/water.py  -> data/<id>/water_balance.json
  model/seasons.py    -> data/<id>/season_types.json, model/season_clusters.json (all fields together)
  build_site.py       -> docs/index.html

Usage:
  python run_all.py                 # all points, then the page
  python run_all.py --only kostanay # one point, then the page
  python run_all.py --no-site       # model results only

This script never downloads anything. For a new point run data_fetch/fetch_data.py first.
Standard library only, Python 3.9+.

AI assistance: drafted with an AI model (Claude, Anthropic) and reviewed by the team.
"""

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "model"))

import build_site  # noqa: E402
import cover  # noqa: E402
import water  # noqa: E402
import seasons  # noqa: E402


def load_points(path=ROOT / "data_fetch" / "points.json"):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))["points"]


# Settings of a point in points.json that the models read from data/<id>/meta.json.
POINT_SETTINGS = ("name", "sow_dates", "elevation_m")


def power_cache_elevation(folder):
    """Elevation of the NASA POWER grid point from the cached raw responses (no download), or None."""
    for path in sorted(pathlib.Path(folder).glob("raw/power_*.json"), reverse=True):
        try:
            return round(float(json.loads(path.read_text(encoding="utf-8"))["geometry"]["coordinates"][2]), 1)
        except (KeyError, IndexError, TypeError, ValueError):
            continue
    return None


def sync_meta(folder, point):
    """Bring meta.json in line with points.json (name, sow_dates, elevation_m) without downloading.

    elevation_m: the value in points.json if given, else the one already in meta.json,
    else the elevation of the POWER grid point from the raw cache.
    Coordinates are never changed here: moving a point needs a new download.
    """
    meta_file = pathlib.Path(folder) / "meta.json"
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    if point and (abs(meta["lat"] - point["lat"]) > 1e-6 or abs(meta["lon"] - point["lon"]) > 1e-6):
        sys.exit(f"{meta_file}: coordinates differ from points.json; run data_fetch/fetch_data.py --only {point['id']}")
    updated = dict(meta)
    for key in POINT_SETTINGS:
        if point and point.get(key) is not None:
            updated[key] = point[key]
        elif key == "sow_dates":
            updated.pop(key, None)  # removed from points.json: back to the dates in crops.json
    if updated.get("elevation_m") is None:
        updated["elevation_m"] = power_cache_elevation(folder)
    if updated != meta:
        with open(meta_file, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(updated, ensure_ascii=False, indent=2))
    return updated


def run_point(point_id, data_dir=ROOT / "data", point=None):
    """Model one point. Returns False when its data has not been downloaded."""
    folder = pathlib.Path(data_dir) / point_id
    missing = [name for name in ("power_daily.csv", "ndvi_16day.csv", "meta.json")
               if not (folder / name).exists()]
    if missing:
        print(f"{point_id}: skipped, missing {', '.join(missing)} "
              f"(run: python data_fetch/fetch_data.py --only {point_id})")
        return False
    sync_meta(folder, point)
    calendar = cover.run_point(folder)
    result = water.run_point(folder)
    water.write_result(folder, result)
    s = calendar["summary"]
    print(f"{point_id}: {s['years_analysed']} years of MODIS, fallow-like years {s['likely_fallow_years'] or 'none'}; "
          f"water balance {result['climate']['years'][0]}-{result['climate']['years'][1]}, "
          f"{len(result['rotations'])} rotations, elevation {result['elevation_m_used']} m")
    return True


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run cover.py and water.py for all points, then build the page.")
    parser.add_argument("--only", help="run a single point id")
    parser.add_argument("--no-site", action="store_true", help="do not rebuild docs/index.html")
    args = parser.parse_args(argv)

    points = {p["id"]: p for p in load_points()}
    ids = list(points)
    if args.only:
        if args.only not in ids:
            sys.exit(f"No point with id '{args.only}' in data_fetch/points.json")
        ids = [args.only]

    done = [point_id for point_id in ids if run_point(point_id, point=points[point_id])]
    if not done:
        sys.exit("No point has data. Run data_fetch/fetch_data.py first.")
    if not args.only:
        # season types cluster the NDVI curves of all fields together (model/seasons.py)
        seasons.main()
    if not args.no_site:
        build_site.main()


if __name__ == "__main__":
    main()
