#!/usr/bin/env python3
"""
Fetch the two core datasets for each demo point and save them as CSV.

  1. NASA POWER daily agroclimatology (weather; soil wetness GWETTOP/GWETROOT too: GWETROOT is used only
     to cross-check the model's soil water, GWETTOP is not used), 1981 -> now
  2. MODIS MOD13Q1 V061 (Collection 6.1) NDVI and pixel reliability (250 m, 16-day) via the ORNL DAAC TESViS REST API, 2000 -> now.
     EVI is not requested (MODIS_BANDS); the evi column of ndvi_16day.csv stays empty unless an old
     all-band cache file is reused.

Usage:
  python fetch_data.py --check              # one tiny request to each API, prints what comes back
  python fetch_data.py                      # fetch everything for all points in points.json
  python fetch_data.py --only shortandy     # fetch one point
  python fetch_data.py --skip-modis         # weather only

Raw API responses are cached in data/<point>/raw/, so a re-run continues where it stopped.
Standard library only, no installs needed.

Data sources:
  NASA POWER Project, NASA Langley Research Center  https://power.larc.nasa.gov/
  ORNL DAAC TESViS (MODIS/VIIRS subsets)            https://modis.ornl.gov/rst/ui/
"""

import argparse
import concurrent.futures
import csv
import datetime as dt
import json
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMS = [
    "T2M",                # mean air temperature at 2 m, C
    "T2M_MAX",            # daily max, C
    "T2M_MIN",            # daily min, C (frost)
    "PRECTOTCORR",        # precipitation, mm/day
    "ALLSKY_SFC_SW_DWN",  # solar radiation at surface
    "RH2M",               # relative humidity at 2 m, %
    "WS2M",               # wind speed at 2 m, m/s
    "GWETTOP",            # surface soil wetness, 0..1
    "GWETROOT",           # root-zone soil wetness, 0..1
]
POWER_FIRST_YEAR = 1981
POWER_CHUNK_YEARS = 5

MODIS_URL = "https://modis.ornl.gov/rst/api/v1"
MODIS_PRODUCT = "MOD13Q1"
MODIS_DATES_PER_REQUEST = 10
MODIS_FILL = -3000
MODIS_SCALE = 0.0001
MODIS_NDVI_BAND = "250m_16_days_NDVI"
MODIS_RELIABILITY_BAND = "250m_16_days_pixel_reliability"
# The subset service is slow when it returns all 12 bands (about a minute per request),
# so we ask only for the bands we use and run several requests at once.
MODIS_BANDS = ["250m_16_days_NDVI", "250m_16_days_pixel_reliability"]
MODIS_WORKERS = 6  # parallel requests; the TESViS server needs about 90 s per request
NDVI_ONLY = False  # set by --ndvi-only: skip the quality band, half the requests (Up To Para version)

PAUSE_SECONDS = 0.5


def make_ssl_context():
    """Use the certifi CA bundle when it is installed.

    Python from python.org on macOS ships without root certificates, which gives
    CERTIFICATE_VERIFY_FAILED. `pip install certifi` fixes that for this script.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


SSL_CONTEXT = make_ssl_context()


def http_get_json(url, retries=4, timeout=180):
    """GET a URL and parse JSON. Retries on network errors and 5xx/429."""
    last_error = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as error:
            if isinstance(error.reason, ssl.SSLCertVerificationError):
                raise RuntimeError(
                    "Python cannot verify HTTPS certificates on this computer.\n"
                    "  Fix: run  pip install certifi  in this interpreter and start the script again."
                ) from error
            if isinstance(error, urllib.error.HTTPError):
                body = error.read().decode("utf-8", "replace")[:500]
                last_error = f"HTTP {error.code}: {body}"
                if error.code not in (429, 500, 502, 503, 504):
                    break
            else:
                last_error = repr(error)
        except (TimeoutError, json.JSONDecodeError) as error:
            last_error = repr(error)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"Request failed: {url}\n  {last_error}")


def coord_tag(point):
    """Coordinates go into cache file names, so moving a point never reuses old data."""
    return f"{point['lat']:.4f}_{point['lon']:.4f}"


def cached_get(url, cache_file, get=http_get_json):
    """Return the cached response if present, otherwise fetch and cache it."""
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    data = get(url)
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(data), encoding="utf-8")
    time.sleep(PAUSE_SECONDS)
    return data


# ---------------------------------------------------------------- NASA POWER

def power_url(lat, lon, start, end, params=POWER_PARAMS):
    query = urllib.parse.urlencode({
        "parameters": ",".join(params),
        "community": "AG",
        "latitude": lat,
        "longitude": lon,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }, safe=",")
    return f"{POWER_URL}?{query}"


def parse_power(response):
    """Turn one POWER response into {YYYYMMDD: {param: value or None}}."""
    try:
        by_param = response["properties"]["parameter"]
    except (KeyError, TypeError):
        raise RuntimeError(
            "Unexpected POWER response. Top-level keys: "
            f"{list(response)[:10] if isinstance(response, dict) else type(response)}"
        )
    fill = response.get("header", {}).get("fill_value", -999.0)
    rows = {}
    for param, series in by_param.items():
        for day, value in series.items():
            rows.setdefault(day, {})[param] = None if value == fill else value
    return rows


def power_elevation(response):
    """Elevation of the POWER grid point in metres (third coordinate of the GeoJSON point), or None."""
    try:
        return round(float(response["geometry"]["coordinates"][2]), 1)
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def fetch_power(point, out_dir, end_date, get=http_get_json):
    """Writes power_daily.csv. Returns (number of days, elevation of the POWER grid point in m or None)."""
    rows = {}
    elevation = None
    year = POWER_FIRST_YEAR
    while year <= end_date.year:
        start = dt.date(year, 1, 1)
        end = min(dt.date(year + POWER_CHUNK_YEARS - 1, 12, 31), end_date)
        cache = out_dir / "raw" / f"power_{coord_tag(point)}_{start:%Y%m%d}_{end:%Y%m%d}.json"
        print(f"  POWER {start} .. {end}")
        response = cached_get(power_url(point["lat"], point["lon"], start, end), cache, get)
        rows.update(parse_power(response))
        found = power_elevation(response)
        if found is not None:
            elevation = found
        year += POWER_CHUNK_YEARS

    out_file = out_dir / "power_daily.csv"
    with out_file.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date"] + POWER_PARAMS)
        for day in sorted(rows):
            date = f"{day[:4]}-{day[4:6]}-{day[6:]}"
            values = [rows[day].get(param) for param in POWER_PARAMS]
            writer.writerow([date] + ["" if v is None else v for v in values])
    print(f"  -> {out_file} ({len(rows)} days, grid elevation {elevation} m)")
    return len(rows), elevation


# --------------------------------------------------------------- MODIS NDVI

def modis_dates_url(lat, lon):
    query = urllib.parse.urlencode({"latitude": lat, "longitude": lon})
    return f"{MODIS_URL}/{MODIS_PRODUCT}/dates?{query}"


def modis_subset_url(lat, lon, start_date, end_date, band=None):
    params = {"latitude": lat, "longitude": lon}
    if band:
        params["band"] = band
    params.update({
        "startDate": start_date,
        "endDate": end_date,
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    })
    return f"{MODIS_URL}/{MODIS_PRODUCT}/subset?{urllib.parse.urlencode(params)}"


def pick_band(band_names, keyword):
    matches = [name for name in band_names if keyword.lower() in name.lower()]
    return matches[0] if matches else None


def parse_modis(response, require_ndvi=True):
    """Turn one subset response into {calendar_date: {ndvi, evi, reliability}}."""
    try:
        subset = response["subset"]
    except (KeyError, TypeError):
        raise RuntimeError(
            "Unexpected MODIS response. Top-level keys: "
            f"{list(response)[:10] if isinstance(response, dict) else type(response)}"
        )
    band_names = sorted({item["band"] for item in subset})
    wanted = {
        "ndvi": pick_band(band_names, "NDVI"),
        "evi": pick_band(band_names, "EVI"),
        "reliability": pick_band(band_names, "reliability"),
    }
    if require_ndvi and wanted["ndvi"] is None:
        raise RuntimeError(f"No NDVI band in response. Bands: {band_names}")

    rows = {}
    for item in subset:
        for key, band in wanted.items():
            if band is None or item["band"] != band:
                continue
            data = item["data"]
            raw = data[len(data) // 2]  # centre pixel (the only one for a 0 km window)
            if key == "reliability":
                value = None if raw is None or raw < 0 else int(raw)
            else:
                value = None if raw is None or raw <= MODIS_FILL else round(raw * MODIS_SCALE, 4)
            rows.setdefault(item["calendar_date"], {})[key] = value
    return rows


def band_filter_works(point, out_dir, chunk, get):
    """Ask for one band only. If the server honours it, requests get much smaller."""
    cache = out_dir / "raw" / f"modis_{coord_tag(point)}_ndvi_{chunk[0]}_{chunk[-1]}.json"
    try:
        started = time.time()
        url = modis_subset_url(point["lat"], point["lon"], chunk[0], chunk[-1], MODIS_NDVI_BAND)
        response = cached_get(url, cache, get)
        bands = {item["band"] for item in response["subset"]}
    except (RuntimeError, KeyError, TypeError) as error:
        print(f"  MODIS: single-band request failed ({str(error).splitlines()[-1].strip()[:80]})")
        return False
    print(f"  MODIS: single-band request returned {sorted(bands)} in {time.time() - started:.0f} s")
    return bands == {MODIS_NDVI_BAND}


def fetch_modis_chunk(point, out_dir, chunk, single_band, get):
    """Fetch one group of composites. Reuses any all-band file cached by an earlier run."""
    tag = coord_tag(point)
    lat, lon = point["lat"], point["lon"]
    raw = out_dir / "raw"
    all_bands_cache = raw / f"modis_{tag}_{chunk[0]}_{chunk[-1]}.json"
    if all_bands_cache.exists() or not single_band:
        url = modis_subset_url(lat, lon, chunk[0], chunk[-1])
        return parse_modis(cached_get(url, all_bands_cache, get))

    rows = {}
    bands = [("ndvi", MODIS_NDVI_BAND), ("rel", MODIS_RELIABILITY_BAND)]
    if NDVI_ONLY and not (raw / f"modis_{tag}_rel_{chunk[0]}_{chunk[-1]}.json").exists():
        bands = bands[:1]   # quality band only if it is already in the cache
    for short, band in bands:
        cache = raw / f"modis_{tag}_{short}_{chunk[0]}_{chunk[-1]}.json"
        url = modis_subset_url(lat, lon, chunk[0], chunk[-1], band)
        parsed = parse_modis(cached_get(url, cache, get), require_ndvi=(short == "ndvi"))
        for date, values in parsed.items():
            rows.setdefault(date, {}).update(values)
    return rows


def fetch_modis(point, out_dir, get=http_get_json, workers=MODIS_WORKERS):
    lat, lon = point["lat"], point["lon"]
    tag = coord_tag(point)
    dates_response = cached_get(modis_dates_url(lat, lon), out_dir / "raw" / f"modis_{tag}_dates.json", get)
    modis_dates = [item["modis_date"] for item in dates_response["dates"]]
    chunks = [modis_dates[i:i + MODIS_DATES_PER_REQUEST]
              for i in range(0, len(modis_dates), MODIS_DATES_PER_REQUEST)]
    print(f"  MODIS: {len(modis_dates)} composites, {modis_dates[0]} .. {modis_dates[-1]}, "
          f"{len(chunks)} requests, {workers} in parallel")

    missing = [chunk for chunk in chunks
               if not (out_dir / "raw" / f"modis_{tag}_{chunk[0]}_{chunk[-1]}.json").exists()]
    single_band = band_filter_works(point, out_dir, missing[-1], get) if missing else False

    rows = {}
    started = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fetch_modis_chunk, point, out_dir, chunk, single_band, get)
                   for chunk in chunks]
        for done, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            rows.update(future.result())
            if done % 5 == 0 or done == len(chunks):
                print(f"  MODIS {done}/{len(chunks)} requests done, {time.time() - started:.0f} s")

    out_file = out_dir / "ndvi_16day.csv"
    with out_file.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        # reliability: 0 good, 1 marginal, 2 snow/ice, 3 cloudy
        writer.writerow(["date", "ndvi", "evi", "reliability"])
        for date in sorted(rows):
            row = rows[date]
            values = [row.get("ndvi"), row.get("evi"), row.get("reliability")]
            writer.writerow([date] + ["" if v is None else v for v in values])
    print(f"  -> {out_file} ({len(rows)} composites)")
    return len(rows)


# --------------------------------------------------------------------- main

def check():
    """One tiny request per API: tells us at once whether access works without login."""
    lat, lon = 51.70, 71.00
    print("1) NASA POWER")
    try:
        url = power_url(lat, lon, dt.date(2024, 6, 1), dt.date(2024, 6, 3))
        rows = parse_power(http_get_json(url))
        for day in sorted(rows):
            print("   ", day, rows[day])
        print("   OK")
    except Exception as error:  # noqa: BLE001 - we want to see any failure
        print("   FAILED:", error)

    print("2) ORNL TESViS / MODIS")
    try:
        dates = http_get_json(modis_dates_url(lat, lon))["dates"]
        print(f"    {len(dates)} composites, first {dates[0]}, last {dates[-1]}")
        first, last = dates[-3]["modis_date"], dates[-1]["modis_date"]
        started = time.time()
        response = http_get_json(modis_subset_url(lat, lon, first, last, MODIS_BANDS[0]))
        print(f"    one-band request took {time.time() - started:.1f} s")
        print("    bands:", sorted({item["band"] for item in response["subset"]}))
        rows = parse_modis(response)
        for date in sorted(rows):
            print("   ", date, rows[date])
        print("   OK")
    except Exception as error:  # noqa: BLE001
        print("   FAILED:", error)


def main():
    here = pathlib.Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="test both APIs and exit")
    parser.add_argument("--points", default=str(here / "points.json"))
    parser.add_argument("--out", default=str(here.parent / "data"))
    parser.add_argument("--only", help="fetch a single point id")
    parser.add_argument("--skip-power", action="store_true")
    parser.add_argument("--skip-modis", action="store_true")
    parser.add_argument("--ndvi-only", action="store_true",
                        help="download NDVI without the quality band (twice as fast; snow is then read from NDVI)")
    parser.add_argument("--workers", type=int, default=MODIS_WORKERS,
                        help="parallel MODIS requests (default %(default)s)")
    args = parser.parse_args()
    global NDVI_ONLY
    NDVI_ONLY = args.ndvi_only

    if args.check:
        check()
        return

    points = json.loads(pathlib.Path(args.points).read_text(encoding="utf-8"))["points"]
    if args.only:
        points = [p for p in points if p["id"] == args.only]
        if not points:
            sys.exit(f"No point with id '{args.only}' in {args.points}")

    # POWER publishes with a delay of a few days, so stop ten days before today.
    end_date = dt.date.today() - dt.timedelta(days=10)

    for point in points:
        out_dir = pathlib.Path(args.out) / point["id"]
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"{point['id']}: {point['name']} ({point['lat']}, {point['lon']})")
        summary = dict(point)
        summary["fetched_on"] = dt.date.today().isoformat()
        if not args.skip_power:
            summary["power_days"], elevation = fetch_power(point, out_dir, end_date)
            # An elevation given in points.json wins; otherwise the POWER grid elevation is used.
            if summary.get("elevation_m") is None:
                summary["elevation_m"] = elevation
        if not args.skip_modis:
            summary["modis_composites"] = fetch_modis(point, out_dir, workers=args.workers)
        (out_dir / "meta.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )


if __name__ == "__main__":
    main()
