"""
model/cover.py on synthetic MODIS and weather series where the right answer is known.

AI assistance: drafted with an AI model (Claude, Anthropic) and reviewed by the team.
"""

import csv
import datetime as dt
import pathlib
import tempfile
import unittest

import helpers  # noqa: F401  (import paths)
import cover

FIRST, LAST = 2010, 2012


def warm(day):
    """Warm from 15 April to 15 October, frost otherwise."""
    return (4, 15) <= (day.month, day.day) <= (10, 15)


def fallow_ndvi(day):
    return 0.25 if warm(day) else 0.15          # summer stays below 0.3


def crop_ndvi(day):
    """A spring crop: green-up from 20 May, peak 0.8 on 10 July, gone by 31 August."""
    year = day.year
    up, peak, down = dt.date(year, 5, 20), dt.date(year, 7, 10), dt.date(year, 8, 31)
    if up <= day <= peak:
        return 0.2 + 0.6 * (day - up).days / (peak - up).days
    if peak < day <= down:
        return 0.8 - 0.6 * (day - peak).days / (down - peak).days
    return 0.2


def perennial_ndvi(day):
    return 0.7 if (4, 25) <= (day.month, day.day) <= (10, 5) else 0.2


def write_series(folder, ndvi_by_year, extra_rows=(), reliability=None):
    """Weather and 16-day NDVI files for 2010-2012. extra_rows replace composites on given dates."""
    folder = pathlib.Path(folder)
    with open(folder / "power_daily.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "T2M", "WS2M", "PRECTOTCORR"])
        day = dt.date(FIRST, 1, 1)
        while day <= dt.date(LAST, 12, 31):
            writer.writerow([day.isoformat(), 15.0 if warm(day) else -10.0, 3.0, 1.0])
            day += dt.timedelta(days=1)
    overrides = dict(extra_rows)
    with open(folder / "ndvi_16day.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "ndvi", "evi", "reliability"])
        for year in range(FIRST, LAST + 1):
            day = dt.date(year, 1, 1)
            while day.year == year:
                if day in overrides:
                    ndvi, rel = overrides[day]
                else:
                    ndvi = ndvi_by_year[year](day)
                    rel = (reliability(day) if reliability else None) or ("0" if warm(day) else "2")
                writer.writerow([day.isoformat(), round(ndvi, 4), "", rel])
                day += dt.timedelta(days=16)
    return folder / "ndvi_16day.csv", folder / "power_daily.csv"


class CoverCalendar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = pathlib.Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def calendar(self, ndvi_by_year, **kwargs):
        return cover.build_calendar(*write_series(self.folder, ndvi_by_year, **kwargs))

    def status(self, calendar):
        return {y["year"]: y["status"] for y in calendar["years"]}

    def test_fallow_and_cropped_years(self):
        cal = self.calendar({2010: fallow_ndvi, 2011: crop_ndvi, 2012: fallow_ndvi})
        self.assertEqual(self.status(cal), {2010: "likely fallow", 2011: "cropped", 2012: "likely fallow"})
        self.assertEqual(cal["summary"]["likely_fallow_years"], [2010, 2012])
        year_2011 = [y for y in cal["years"] if y["year"] == 2011][0]
        self.assertAlmostEqual(year_2011["peak_ndvi"], 0.8, delta=0.05)
        self.assertGreater(year_2011["green_days"], 50)
        year_2010 = [y for y in cal["years"] if y["year"] == 2010][0]
        self.assertEqual(year_2010["green_days"], 0)

    def test_cloudy_composite_is_dropped(self):
        years = {2010: crop_ndvi, 2011: crop_ndvi, 2012: crop_ndvi}
        clean = self.calendar(years)
        # 2011-07-06 is a composite date (every 16 days from 1 January); mark it cloudy with a fake value
        cloudy_day = dt.date(2011, 7, 6)
        cloudy = self.calendar(years, extra_rows=[(cloudy_day, (0.05, "3"))])
        self.assertEqual(self.status(cloudy), self.status(clean))
        c11 = [y for y in cloudy["years"] if y["year"] == 2011][0]
        k11 = [y for y in clean["years"] if y["year"] == 2011][0]
        self.assertGreater(c11["green_days"], 50)
        self.assertLessEqual(abs(c11["green_days"] - k11["green_days"]), 16)  # only interpolation changes
        self.assertNotAlmostEqual(c11["peak_ndvi"], 0.05)

    def test_snow_days_are_not_in_the_season(self):
        years = {2010: crop_ndvi, 2011: crop_ndvi, 2012: crop_ndvi}
        base = self.calendar(years)
        # The composite of 2011-04-23 starts after the warm season opens; mark it snow
        snowy = self.calendar(years, extra_rows=[(dt.date(2011, 4, 23), (0.2, "2"))])
        w_base = [y for y in base["years"] if y["year"] == 2011][0]["warm_days"]
        w_snow = [y for y in snowy["years"] if y["year"] == 2011][0]["warm_days"]
        self.assertEqual(w_base - w_snow, 16)

    def test_ndvi_only_series_from_gibs(self):
        """No quality band (NDVI read from NASA GIBS): a near-zero NDVI from November to March is snow,
        everything else is a valid composite. Same rule as web/live.js."""
        years = {2010: fallow_ndvi, 2011: crop_ndvi, 2012: crop_ndvi}
        with_flags = self.calendar(years)
        ndvi_path = self.folder / "ndvi_16day.csv"
        lines = ndvi_path.read_text(encoding="utf-8").splitlines()
        out = [lines[0]]
        for line in lines[1:]:
            date, ndvi, evi, rel = line.split(",")
            winter = int(date[5:7]) >= 11 or int(date[5:7]) <= 3
            if rel == "2" and winter:
                ndvi = "0.0"                     # snow as GIBS shows it: no green at all
            out.append(",".join([date, ndvi, evi, ""]))
        ndvi_path.write_text("\n".join(out) + "\n", encoding="utf-8")
        points, snow = cover.load_ndvi(ndvi_path)
        self.assertIn(dt.date(2011, 1, 10), snow)                          # a January composite is snow
        self.assertFalse([v for d, v in points if (d.month >= 11 or d.month <= 3) and v < 0.05])
        no_flags = cover.build_calendar(ndvi_path, self.folder / "power_daily.csv")
        self.assertEqual(self.status(no_flags), self.status(with_flags))   # fallow and crop years unchanged

    def test_warning_when_many_long_green_seasons(self):
        cal = self.calendar({2010: perennial_ndvi, 2011: crop_ndvi, 2012: crop_ndvi})
        self.assertEqual(cal["summary"]["long_green_season_years"], [2010])
        self.assertEqual([w["code"] for w in cal["summary"]["warnings"]], ["many_long_green_seasons"])  # 1/3 > 25 %
        cal = self.calendar({2010: crop_ndvi, 2011: crop_ndvi, 2012: fallow_ndvi})
        self.assertEqual(cal["summary"]["warnings"], [])

    def test_warning_when_summers_are_barely_green(self):
        """Median summer NDVI below 0.40, within 0.05 of the fallow threshold: weak crops may look like fallow."""
        cal = self.calendar({2010: fallow_ndvi, 2011: fallow_ndvi, 2012: crop_ndvi})
        self.assertAlmostEqual(cal["summary"]["median_summer_ndvi"], 0.25, delta=0.01)
        low = [w for w in cal["summary"]["warnings"] if w["code"] == "low_summer_greenness"]
        self.assertEqual(len(low), 1)
        self.assertIn("2 fallow-like years", low[0]["text"])
        cal = self.calendar({2010: crop_ndvi, 2011: crop_ndvi, 2012: fallow_ndvi})
        self.assertGreater(cal["summary"]["median_summer_ndvi"], 0.40)


if __name__ == "__main__":
    unittest.main()
