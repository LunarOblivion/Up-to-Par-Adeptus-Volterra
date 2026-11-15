"""
FAO Penman-Monteith reference evapotranspiration against FAO-56, Chapter 4, Example 18
(Brussels, 6 July: daily ETo = 3.9 mm/day).

Example 18 inputs: latitude 50 deg 48' N, altitude 100 m, Tmax 21.5 C, Tmin 12.3 C,
RHmax 84 %, RHmin 63 %, wind 10 km/h at 10 m (u2 = 2.078 m/s), 9.25 hours of sunshine,
which the example turns into Rs = 22.07 MJ m-2 day-1, with Ra = 41.09 and ea = 1.409 kPa.

water.reference_et takes the daily mean relative humidity (that is what NASA POWER gives),
so the test passes the RH that reproduces the example's ea: RH = ea / es = 1.409 / 1.997.
"""

import datetime as dt
import unittest

import helpers  # noqa: F401  (import paths)
import water

LAT = 50 + 48 / 60
DAY = {
    "date": dt.date(2019, 7, 6),   # day of year 187, as in the example
    "T2M_MAX": 21.5, "T2M_MIN": 12.3, "T2M": (21.5 + 12.3) / 2,
    "WS2M": 2.078,
    "ALLSKY_SFC_SW_DWN": 22.07,
    "RH2M": 100 * 1.409 / ((water.sat_vapour_pressure(21.5) + water.sat_vapour_pressure(12.3)) / 2),
}


class ReferenceET(unittest.TestCase):
    def test_extraterrestrial_radiation(self):
        self.assertAlmostEqual(water.extraterrestrial_radiation(LAT, 187), 41.09, delta=0.05)

    def test_example_18(self):
        eto, estimated = water.reference_et(DAY, LAT, 100)
        self.assertFalse(estimated)
        self.assertAlmostEqual(eto, 3.9, delta=0.1)

    def test_missing_radiation_is_estimated(self):
        day = dict(DAY, ALLSKY_SFC_SW_DWN=None)
        eto, estimated = water.reference_et(day, LAT, 100)
        self.assertTrue(estimated)
        self.assertGreater(eto, 0)


if __name__ == "__main__":
    unittest.main()
