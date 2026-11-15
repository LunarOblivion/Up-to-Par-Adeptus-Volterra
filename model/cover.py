#!/usr/bin/env python3
"""
Living-cover calendar for one field.

Reads the two files written by data_fetch/fetch_data.py:
  ndvi_16day.csv   MODIS MOD13Q1 V061 (Collection 6.1) NDVI, 250 m, every 16 days
  power_daily.csv  NASA POWER daily weather

For every calendar year it reports
  green_days   warm-season days with living green cover (NDVI above a threshold)
  bare_days    warm-season days without it
  exposure     bare days that also had strong wind or heavy rain
  status       "cropped", "likely fallow", "unclear" or "long green season"
               (greener for longer than a spring crop: perennial grass or similar),
               with a dry-year warning

Usage:
  python model/cover.py data/shortandy          # prints a table, writes cover_calendar.json

All thresholds are in THRESHOLDS below. They are first guesses that were tuned on one
field near Shortandy and must be reviewed by an agronomist. NDVI sees green plants only:
standing stubble and crop residue protect the soil too, but they are invisible here.

"""

import csv
import datetime as dt
import json
import pathlib
import sys

import season  # warm season, wind and rain thresholds shared with water.py

THRESHOLDS = {
    "warm_temp_c": season.WARM_TEMP_C,  # 7-day mean air temperature that opens the warm season
    "green_ndvi": 0.35,          # NDVI at or above this counts as living green cover
                                 # (0.30 also counted short weed flushes on fallow as cover)
    "fallow_summer_ndvi": 0.35,  # mean NDVI 10 Jun - 20 Aug below this: likely fallow
    "unclear_summer_ndvi": 0.42, # between the two values: unclear
    "long_season_green_days": 130,  # more green days than a spring crop gives: perennial or grass-like cover
    "strong_wind_ms": season.STRONG_WIND_MS,  # daily mean wind at 2 m
    "heavy_rain_mm": season.HEAVY_RAIN_MM,    # daily precipitation
    "dry_year_percentile": 20,   # May-July rain in the driest 20 % of years: dry-year warning
    "suspicious_long_season_share": 0.25,  # more years than this with a long green season:
                                           # the point may not be on an annual-crop field
    "low_summer_ndvi_median": 0.40,  # median over the full years of the 10 Jun - 20 Aug mean NDVI below this:
                                     # a typical summer sits within 0.05 of fallow_summer_ndvi, so the threshold
                                     # cannot tell a weak crop from fallow and some fallow-like years may be poor crops
}
SUMMER_START = (6, 10)
SUMMER_END = (8, 20)
COMPOSITE_DAYS = 16


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def to_float(text):
    return float(text) if text not in ("", None) else None


def load_weather(path):
    """{date: {T2M, WS2M, PRECTOTCORR, ...}} with floats or None."""
    weather = {}
    for row in read_csv(path):
        day = dt.date.fromisoformat(row["date"])
        weather[day] = {key: to_float(value) for key, value in row.items() if key != "date"}
    return weather


def warm_days(weather, threshold):
    """Days whose centred 7-day mean temperature reaches the threshold (see model/season.py)."""
    days = sorted(weather)
    return season.warm_days(days, [weather[day]["T2M"] for day in days], threshold)


def load_ndvi(path):
    """Returns (valid points [(date, ndvi)], snow days set).

    reliability: 0 good, 1 marginal, 2 snow/ice, 3 cloudy. Cloudy composites are dropped,
    snow composites mark their 16 days as snow.
    """
    points, snow = [], set()
    for row in read_csv(path):
        day = dt.date.fromisoformat(row["date"])
        ndvi = to_float(row["ndvi"])
        reliability = row.get("reliability", "")
        if reliability == "" and ndvi is not None:
            # NDVI-only download (no quality band, e.g. read from NASA GIBS): the same rule as the
            # live page, web/live.js. A near-zero NDVI between November and March is read as snow.
            # (Rule from the Up To Para version by LunarOblivion.)
            if ndvi < 0.05 and (day.month >= 11 or day.month <= 3):
                snow.update(day + dt.timedelta(days=offset) for offset in range(COMPOSITE_DAYS))
            else:
                points.append((day, ndvi))
        elif reliability == "2":
            snow.update(day + dt.timedelta(days=offset) for offset in range(COMPOSITE_DAYS))
        elif reliability in ("0", "1") and ndvi is not None:
            points.append((day, ndvi))
    points.sort()
    return points, snow


def daily_ndvi(points):
    """Linear interpolation between valid composites."""
    series = {}
    for (day_a, ndvi_a), (day_b, ndvi_b) in zip(points, points[1:]):
        span = (day_b - day_a).days
        for offset in range(span):
            series[day_a + dt.timedelta(days=offset)] = ndvi_a + (ndvi_b - ndvi_a) * offset / span
    if points:
        series[points[-1][0]] = points[-1][1]
    return series


def percentile_rank(value, values):
    """Share of values that are less than or equal to this one, 0..100."""
    return 100.0 * sum(1 for other in values if other <= value) / len(values)


def build_calendar(ndvi_path, weather_path, thresholds=THRESHOLDS):
    weather = load_weather(weather_path)
    points, snow = load_ndvi(ndvi_path)
    ndvi = daily_ndvi(points)
    warm = warm_days(weather, thresholds["warm_temp_c"])

    first_year, last_year = points[0][0].year, points[-1][0].year

    # May-July rain for every year with weather, used to tell drought from fallow.
    days = sorted(weather)
    may_july_rain = season.may_july_rain(days, [weather[d]["PRECTOTCORR"] for d in days])

    years = []
    for year in range(first_year, last_year + 1):
        days = [dt.date(year, 1, 1) + dt.timedelta(days=i)
                for i in range((dt.date(year + 1, 1, 1) - dt.date(year, 1, 1)).days)]
        season_days = [d for d in days if d in warm and d not in snow and d in ndvi]
        if not season_days:
            continue
        green = [d for d in season_days if ndvi[d] >= thresholds["green_ndvi"]]
        bare = [d for d in season_days if ndvi[d] < thresholds["green_ndvi"]]
        windy = [d for d in bare if (weather[d]["WS2M"] or 0) >= thresholds["strong_wind_ms"]]
        rainy = [d for d in bare if (weather[d]["PRECTOTCORR"] or 0) >= thresholds["heavy_rain_mm"]]
        # (the same rules as season.is_windy / is_heavy_rain; thresholds stay overridable here)

        summer = [ndvi[d] for d in days
                  if d in ndvi and dt.date(year, *SUMMER_START) <= d <= dt.date(year, *SUMMER_END)]
        summer_mean = sum(summer) / len(summer) if summer else None
        year_points = [(d, v) for d, v in points if d.year == year]
        peak_day, peak = max(year_points, key=lambda item: item[1])

        complete = (dt.date(year, *SUMMER_START) in ndvi) and (dt.date(year, *SUMMER_END) in ndvi)
        if summer_mean is None or not complete:
            status = "incomplete year"
        elif summer_mean < thresholds["fallow_summer_ndvi"]:
            status = "likely fallow"
        elif summer_mean < thresholds["unclear_summer_ndvi"]:
            status = "unclear"
        elif len(green) >= thresholds["long_season_green_days"]:
            status = "long green season"
        else:
            status = "cropped"

        rain = may_july_rain.get(year)
        rain_rank = percentile_rank(rain, list(may_july_rain.values())) if rain is not None else None
        dry_year = rain_rank is not None and rain_rank <= thresholds["dry_year_percentile"]

        years.append({
            "year": year,
            "status": status,
            "dry_year": dry_year,
            "warm_days": len(season_days),
            "green_days": len(green),
            "bare_days": len(bare),
            "bare_windy_days": len(windy),
            "bare_heavy_rain_days": len(rainy),
            "rain_on_bare_mm": round(sum(weather[d]["PRECTOTCORR"] or 0 for d in bare), 1),
            "peak_ndvi": round(peak, 2),
            "peak_date": peak_day.isoformat(),
            "summer_ndvi": None if summer_mean is None else round(summer_mean, 2),
            "may_july_rain_mm": None if rain is None else round(rain),
            "may_july_rain_percentile": None if rain_rank is None else round(rain_rank),
        })

    full = [y for y in years if y["status"] != "incomplete year"]
    summary = {
        "years_analysed": len(full),
        "likely_fallow_years": [y["year"] for y in full if y["status"] == "likely fallow"],
        "unclear_years": [y["year"] for y in full if y["status"] == "unclear"],
        "long_green_season_years": [y["year"] for y in full if y["status"] == "long green season"],
        "mean_green_days": round(sum(y["green_days"] for y in full) / len(full)) if full else None,
        "mean_bare_days": round(sum(y["bare_days"] for y in full) / len(full)) if full else None,
        "median_summer_ndvi": median([y["summer_ndvi"] for y in full if y["summer_ndvi"] is not None]),
    }
    summary["warnings"] = check_point(summary, thresholds)
    return {"thresholds": thresholds, "summary": summary, "years": years}


def check_point(summary, thresholds=THRESHOLDS):
    """Warnings about the point itself. The team checks the coordinates; this only flags."""
    warnings = []
    years, long_years = summary["years_analysed"], summary["long_green_season_years"]
    if years and len(long_years) / years > thresholds["suspicious_long_season_share"]:
        warnings.append({
            "code": "many_long_green_seasons",
            "text": f"{len(long_years)} of {years} years ({round(100 * len(long_years) / years)}%) stayed green longer "
                    "than a spring crop does. This point may sit on grassland, a perennial forage field or a small "
                    "research plot rather than on one annual-crop field. Its coordinates should be checked before "
                    "the fallow audit is trusted.",
        })
    low = summary.get("median_summer_ndvi")
    if low is not None and low < thresholds["low_summer_ndvi_median"]:
        warnings.append({
            "code": "low_summer_greenness",
            "median_summer_ndvi": low,
            "text": f"Summer greenness is low on this field (median NDVI {low:.2f} from 10 June to 20 August). The "
                    f"{thresholds['fallow_summer_ndvi']} fallow threshold may count weak crops as fallow, so some of "
                    f"the {len(summary['likely_fallow_years'])} fallow-like years may be poor crops.",
        })
    return warnings


def median(values):
    """Median of a list, None when it is empty (statistics.median raises)."""
    if not values:
        return None
    ordered, mid = sorted(values), len(values) // 2
    return round(ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2, 3)


def print_table(calendar):
    header = f"{'year':<5}{'status':<18}{'green':>6}{'bare':>6}{'windy':>6}{'rain>10':>8}{'peak':>6}{'summer':>7}{'MJJ rain':>9}  note"
    print(header)
    for y in calendar["years"]:
        summer = "-" if y["summer_ndvi"] is None else f"{y['summer_ndvi']:.2f}"
        rain = "-" if y["may_july_rain_mm"] is None else str(y["may_july_rain_mm"])
        note = ""
        if y["dry_year"]:
            low = y["status"] in ("likely fallow", "unclear")
            note = "dry year: low NDVI may be drought" if low else "dry year"
        print(f"{y['year']:<5}{y['status']:<18}{y['green_days']:>6}{y['bare_days']:>6}"
              f"{y['bare_windy_days']:>6}{y['bare_heavy_rain_days']:>8}{y['peak_ndvi']:>6.2f}"
              f"{summer:>7}{rain:>9}  {note}")
    s = calendar["summary"]
    print(f"\n{s['years_analysed']} full years. Mean green days {s['mean_green_days']}, "
          f"mean bare warm-season days {s['mean_bare_days']}.")
    print(f"Likely fallow: {s['likely_fallow_years']}. Unclear: {s['unclear_years']}.")
    print(f"Long green season (perennial or grass-like cover?): {s['long_green_season_years']}.")
    for warning in s["warnings"]:
        print(f"WARNING: {warning['text']}")


def run_point(folder):
    """Build the calendar for data/<point> and write cover_calendar.json. Returns the calendar."""
    folder = pathlib.Path(folder)
    calendar = build_calendar(folder / "ndvi_16day.csv", folder / "power_daily.csv")
    with open(folder / "cover_calendar.json", "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(calendar, indent=2))
    return calendar


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python model/cover.py data/<point>")
    folder = pathlib.Path(sys.argv[1])
    calendar = run_point(folder)
    print_table(calendar)
    print(f"-> {folder / 'cover_calendar.json'}")


if __name__ == "__main__":
    main()
