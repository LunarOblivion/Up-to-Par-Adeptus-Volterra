"""
Definitions shared by model/cover.py (satellite record) and model/water.py (rotation model),
so that "warm season", "strong wind" and "heavy rain" mean the same thing in both.

AI assistance: drafted with an AI model (Claude, Anthropic) and reviewed by the team.
"""

WARM_TEMP_C = 5.0      # centred 7-day mean air temperature that opens the warm season
STRONG_WIND_MS = 6.0   # daily mean wind at 2 m
HEAVY_RAIN_MM = 10.0   # daily precipitation
MAY_JULY_MIN_DAYS = 85  # a year needs this many May-July days with rain data to be ranked


def warm_days(dates, temps, threshold=WARM_TEMP_C):
    """Days whose centred 7-day mean temperature reaches the threshold.

    dates must be sorted and consecutive; temps may contain None (missing days are skipped).
    """
    warm = set()
    for index, day in enumerate(dates):
        window = [t for t in temps[max(0, index - 3):index + 4] if t is not None]
        if window and sum(window) / len(window) >= threshold:
            warm.add(day)
    return warm


def may_july_rain(dates, precip, min_days=MAY_JULY_MIN_DAYS):
    """{year: May-July precipitation, mm} for years with at least min_days of data."""
    values = {}
    for day, value in zip(dates, precip):
        if 5 <= day.month <= 7 and value is not None:
            values.setdefault(day.year, []).append(value)
    return {year: sum(items) for year, items in sorted(values.items()) if len(items) >= min_days}


def is_windy(wind_ms):
    return (wind_ms or 0) >= STRONG_WIND_MS


def is_heavy_rain(precip_mm):
    return (precip_mm or 0) >= HEAVY_RAIN_MM
