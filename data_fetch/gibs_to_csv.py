"""Write data/<point>/ndvi_16day.csv from MODIS NDVI read off NASA GIBS tiles.

Used for the five extra fields on 14 Nov 2026, when the ORNL MODIS subset service
answered 503. The values were read in the browser with the GIBS decoder in web/live.js
and saved in data_fetch/gibs/ndvi_series_2026-11-14.txt. No quality band comes with them;
model/cover.py then treats a near-zero NDVI between November and March as snow, as the
live page does.

    python data_fetch/gibs_to_csv.py

Up To Para version by LunarOblivion.
AI assistance: drafted with an AI model (Claude, Anthropic), reviewed by the team.
"""
import csv
import datetime as dt
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SERIES = ROOT / "data_fetch" / "gibs" / "ndvi_series_2026-11-14.txt"


def composite_dates():
    out = []
    for year in range(2000, 2027):
        for doy in range(1, 354, 16):
            if (year == 2000 and doy < 49) or (year == 2026 and doy > 289):
                continue
            out.append(dt.date(year, 1, 1) + dt.timedelta(days=doy - 1))
    return out


def main():
    dates = composite_dates()
    for line in SERIES.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or ":" not in line:
            continue
        point, values = line.split(":", 1)
        values = values.split(",")
        assert len(values) == len(dates), (point, len(values))
        folder = ROOT / "data" / point
        folder.mkdir(parents=True, exist_ok=True)
        rows = 0
        with (folder / "ndvi_16day.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["date", "ndvi", "evi", "reliability"])
            for day, value in zip(dates, values):
                if value == "m":
                    continue
                if value == "t":
                    # transparent: NDVI below zero (snow, water) or no data
                    ndvi = "-0.05" if day.month >= 11 or day.month <= 3 else ""
                else:
                    ndvi = f"{int(value) / 1000:.3f}"
                writer.writerow([day.isoformat(), ndvi, "", ""])
                rows += 1
        print(f"{point}: {rows} composites -> {folder / 'ndvi_16day.csv'}")


if __name__ == "__main__":
    main()
