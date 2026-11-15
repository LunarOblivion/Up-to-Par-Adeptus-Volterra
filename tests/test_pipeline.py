"""
The pipeline as a whole: the committed results in data/ are exactly what the code produces now,
and every code file says that it was drafted with AI assistance.

"""

import pathlib
import shutil
import tempfile
import unittest

import json

from helpers import POINTS, ROOT
import run_all
import water

POINT_CONFIG = {p["id"]: p for p in run_all.load_points()}

INPUTS = ("power_daily.csv", "ndvi_16day.csv", "meta.json")
OUTPUTS = ("cover_calendar.json", "water_balance.json")


class Pipeline(unittest.TestCase):
    def test_committed_results_are_reproducible(self):
        """Run cover.py and water.py on a copy of every point and compare with data/<point>/."""
        points = [p for p in POINTS if all((ROOT / "data" / p / name).exists() for name in INPUTS)]
        self.assertTrue(points)
        with tempfile.TemporaryDirectory() as tmp:
            for point in points:
                target = pathlib.Path(tmp) / point
                target.mkdir()
                for name in INPUTS:
                    shutil.copy(ROOT / "data" / point / name, target / name)
                self.assertTrue(run_all.run_point(point, data_dir=tmp, point=POINT_CONFIG[point]))
                for name in OUTPUTS:
                    with self.subTest(point=point, file=name):
                        fresh = (target / name).read_text(encoding="utf-8")
                        committed = (ROOT / "data" / point / name).read_text(encoding="utf-8").replace("\r\n", "\n")
                        self.assertEqual(fresh, committed, f"data/{point}/{name} is stale: run python run_all.py")

    def test_every_point_has_its_elevation(self):
        for point in POINTS:
            meta_file = ROOT / "data" / point / "meta.json"
            if not meta_file.exists():
                continue
            with self.subTest(point=point):
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                self.assertIsInstance(meta.get("elevation_m"), float)
                # Every field says where its elevation came from, so the check works without the raw cache
                # (data/*/raw/ is not in the published repository).
                self.assertTrue(meta.get("elevation_source") or meta.get("elevation_note"))
                # Where the raw POWER cache is present: the same number as its grid point, unless points.json overrides it
                cached = run_all.power_cache_elevation(ROOT / "data" / point)
                if POINT_CONFIG[point].get("elevation_m") is None and cached is not None:
                    self.assertEqual(meta["elevation_m"], cached)
                result = json.loads((ROOT / "data" / point / "water_balance.json").read_text(encoding="utf-8"))
                self.assertEqual(result["elevation_m_used"], meta["elevation_m"])

    def test_sow_dates_from_points_json_reach_the_model(self):
        """A point's sow_dates go into meta.json and from there into the water balance."""
        point = "kostanay"
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp) / point
            target.mkdir()
            for name in INPUTS:
                shutil.copy(ROOT / "data" / point / name, target / name)
            config = dict(POINT_CONFIG[point], sow_dates={"wheat": "05-01"})
            self.assertTrue(run_all.run_point(point, data_dir=tmp, point=config))
            meta = json.loads((target / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["sow_dates"], {"wheat": "05-01"})
            result = json.loads((target / "water_balance.json").read_text(encoding="utf-8"))
            self.assertEqual(result["sow_dates_used"]["wheat"], "05-01")
            self.assertEqual(result["sow_dates_used"]["barley"], "05-25")   # unchanged from crops.json
            default = json.loads((ROOT / "data" / point / "water_balance.json").read_text(encoding="utf-8"))
            key = "wheat after fallow"
            self.assertNotEqual(result["rotations"]["A_current"]["by_crop"][key]["water_at_sowing_mm"],
                                default["rotations"]["A_current"]["by_crop"][key]["water_at_sowing_mm"])
            # dropping sow_dates from points.json brings back the crops.json dates
            self.assertTrue(run_all.run_point(point, data_dir=tmp, point=POINT_CONFIG[point]))
            self.assertNotIn("sow_dates", json.loads((target / "meta.json").read_text(encoding="utf-8")))

    def test_bad_sow_dates_are_refused(self):
        crops = json.loads((ROOT / "model" / "crops.json").read_text(encoding="utf-8"))["crops"]
        with self.assertRaises(ValueError):
            water.with_sow_dates(crops, {"maize": "05-01"})
        with self.assertRaises(ValueError):
            water.with_sow_dates(crops, {"wheat": "02-30"})
        self.assertEqual(water.with_sow_dates(crops, {"wheat": "04-28"})["wheat"]["sow"], "04-28")
        self.assertEqual(crops["wheat"]["sow"], "05-20")  # the shared parameters are not modified

    def test_point_without_data_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertFalse(run_all.run_point("nowhere", data_dir=tmp))

    def test_every_code_file_declares_ai_assistance(self):
        files = [p for p in ROOT.rglob("*") if p.suffix in (".py", ".js")
                 and ".git" not in p.parts and "vendor" not in p.parts and "build" not in p.parts]   # vendor: Leaflet, BSD-2
        files += [ROOT / "model" / "crops.json", ROOT / "model" / "validation.json"]
        for path in files:
            with self.subTest(file=str(path.relative_to(ROOT))):
                head = path.read_text(encoding="utf-8")[:1500]
                self.assertRegex(head, r"(AI assistance|_ai_assistance).*drafted with an AI model \(Claude, Anthropic\)")


if __name__ == "__main__":
    unittest.main()
