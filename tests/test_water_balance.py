"""
model/water.py: the daily balance conserves water, the soil store stays within its limits,
and the living-cover day counts add up.

Water balance over a whole run:
  rain and snow = transpiration + soil evaporation + deep drainage + blown snow + melt runoff
                  + change of soil water + change of snowpack
"""

import datetime as dt
import json
import math
import unittest

from helpers import ROOT
import water

CONFIG = json.loads((ROOT / "model" / "crops.json").read_text(encoding="utf-8"))
CROPS, ROTATIONS = CONFIG["crops"], CONFIG["rotations"]
FIRST = 2000


def synthetic_weather(years=8, rain=True):
    """A cold-continental climate: -16 C in January, +20 C in July, showers, a few storms and windy days."""
    rows, day = [], dt.date(FIRST, 1, 1)
    while day.year < FIRST + years:
        doy = day.timetuple().tm_yday
        t = 2 - 18 * math.cos(2 * math.pi * (doy - 15) / 365)
        precip = 0.0
        if rain:
            precip = 14.0 if doy % 29 == 0 else 3.0 if doy % 5 == 0 else 0.4 if doy % 2 == 0 else 0.0
        rows.append({
            "date": day, "T2M": t, "T2M_MAX": t + 6, "T2M_MIN": t - 6, "PRECTOTCORR": precip,
            "ALLSKY_SFC_SW_DWN": max(1.0, 4 + 20 * math.sin(math.pi * (doy - 30) / 330)),
            "RH2M": 65.0, "WS2M": 7.0 if doy % 11 == 0 else 3.0,
        })
        day += dt.timedelta(days=1)
    return rows


def run(weather, key, phase=0, observer=None):
    eto = [water.reference_et(d, 52.0, 200.0)[0] for d in weather]
    return water.simulate(weather, eto, ROTATIONS[key]["sequence"], phase, CROPS, weather[0]["date"].year,
                          observer=observer)


def initial_soil():
    return water.Profile(water.SOIL["available_water_mm_per_m"], water.SOIL["profile_depth_m"]).total()


class WaterBalance(unittest.TestCase):
    def assert_conserved(self, records):
        rain = sum(r["rain_snow_mm"] for r in records)
        out = sum(r["transpiration_mm"] + r["evaporation_mm"] + r["deep_drainage_mm"]
                  + r["snow_blown_mm"] + r["melt_runoff_mm"] for r in records)
        stored = (records[-1]["soil_end_mm"] - initial_soil()) + (records[-1]["snow_end_mm"] - 0.0)
        self.assertLess(abs(rain - out - stored), 1.0, f"rain {rain:.2f}, out {out:.2f}, stored {stored:.2f}")

    def test_conservation_synthetic(self):
        weather = synthetic_weather()
        for key in ROTATIONS:
            for phase in range(len(ROTATIONS[key]["sequence"])):
                with self.subTest(rotation=key, phase=phase):
                    self.assert_conserved(run(weather, key, phase))

    def test_conservation_real_weather(self):
        """The same check over the real NASA POWER record of one demo point."""
        path = ROOT / "data" / "kostanay" / "power_daily.csv"
        if not path.exists():
            self.skipTest("no data for kostanay")
        weather = [d for d in water.load_weather(path) if d["date"].year >= 1994]
        for key in ("A_current", "B_pea"):
            with self.subTest(rotation=key):
                self.assert_conserved(run(weather, key))

    def test_harvest_to_sowing_window_closes(self):
        """Rain and snow from one harvest to the next sowing = soil water gained + where the rest went."""
        checked = 0
        for key in ROTATIONS:
            for r in run(synthetic_weather(), key):
                if r["water_at_previous_harvest_mm"] is None or r["water_at_sowing_mm"] is None:
                    continue
                gained = r["water_at_sowing_mm"] - r["water_at_previous_harvest_mm"]
                went = sum(r["window_" + f] for f in water.WINDOW_FLUXES) + r["window_snow_change_mm"]
                with self.subTest(rotation=key, year=r["year"]):
                    self.assertAlmostEqual(r["precip_since_previous_harvest_mm"], gained + went, places=6)
                checked += 1
        self.assertGreater(checked, 20)

    def test_soil_store_stays_within_limits(self):
        problems = []

        def watch(date, layers, capacity, snowpack):
            if snowpack < -1e-9 or any(w < -1e-9 or w > capacity + 1e-9 for w in layers):
                problems.append(date)

        for key in ROTATIONS:
            run(synthetic_weather(), key, observer=watch)
        self.assertEqual(problems, [])

    def test_no_rain_soil_water_only_falls(self):
        totals = []
        run(synthetic_weather(years=2, rain=False), "A_current",
            observer=lambda date, layers, capacity, snowpack: totals.append(sum(layers)))
        self.assertTrue(all(b <= a + 1e-9 for a, b in zip(totals, totals[1:])))
        self.assertLess(totals[-1], totals[0])

    def test_correlation_helpers(self):
        self.assertAlmostEqual(water.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertAlmostEqual(water.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1.0)
        self.assertIsNone(water.pearson([1, 1, 1], [1, 2, 3]))      # no spread: undefined, not NaN
        self.assertEqual(water.ranks([10, 30, 20, 30]), [1.0, 3.5, 2.0, 3.5])
        # Spearman via ranks: a monotone but curved relation gives exactly 1
        x = [1, 2, 3, 4, 5]
        self.assertAlmostEqual(water.pearson(water.ranks(x), water.ranks([v ** 3 for v in x])), 1.0)

    def test_by_year_averages_all_phases(self):
        weather = synthetic_weather()
        seq = ROTATIONS["A_current"]["sequence"]
        eto = [water.reference_et(d, 52.0, 200.0)[0] for d in weather]
        runs = [water.simulate(weather, eto, seq, phase, CROPS, FIRST) for phase in range(len(seq))]
        items = water.by_year(runs, FIRST + 2, FIRST + 7)
        self.assertEqual([i["year"] for i in items], list(range(FIRST + 2, FIRST + 8)))
        for item in items:
            self.assertEqual(item["fields"], 4)
            self.assertEqual(item["crops"], 3)  # one field of four is fallow every year
            rows = [r for run in runs for r in run if r["year"] == item["year"] and r["land_use"] != "fallow"]
            expected = 100 * sum(r["transpiration_mm"] / r["demand_mm"] for r in rows) / len(rows)
            self.assertAlmostEqual(item["demand_met_pct"], expected)

    def test_cover_days_add_up(self):
        weather = synthetic_weather()
        for key in ROTATIONS:
            has_fallow = "fallow" in ROTATIONS[key]["sequence"]
            for r in run(weather, key):
                with self.subTest(rotation=key, year=r["year"]):
                    self.assertEqual(r["green_cover_days"] + r["bare_days"], r["season_days"])
                    self.assertEqual(r["bare_fallow_days"] + r["bare_stubble_days"], r["bare_days"])
                    self.assertLessEqual(r["bare_windy_days"], r["bare_days"])
                    self.assertLessEqual(r["fallow_windy_days"], r["bare_fallow_days"])
                    if not has_fallow:
                        self.assertEqual(r["bare_fallow_days"], 0)
                    if r["land_use"] == "fallow":
                        self.assertEqual(r["green_cover_days"], 0)
                        self.assertGreater(r["bare_fallow_days"], 100)


if __name__ == "__main__":
    unittest.main()
