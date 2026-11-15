"""
The browser models against the Python models: tests/parity.js (web/model.js against model/water.py)
and tests/live_parity.js (web/live.js against reference evapotranspiration and model/cover.py).
Both read build/data.json, which build_site.py writes. Needs Node; skipped without it.

"""

import pathlib
import shutil
import subprocess
import tempfile
import unittest

from helpers import ROOT

import build_site


class JavaScriptParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.node = shutil.which("node")
        if cls.node:
            with tempfile.TemporaryDirectory() as tmp:
                build_site.main(out=pathlib.Path(tmp) / "index.html")   # also writes build/data.json

    def run_node(self, script):
        if not self.node:
            self.skipTest("Node is not installed")
        done = subprocess.run([self.node, str(ROOT / "tests" / script)], capture_output=True, text=True,
                              encoding="utf-8", timeout=600, cwd=str(ROOT))
        self.assertEqual(done.returncode, 0, f"{script} failed:\n{done.stdout[-2500:]}\n{done.stderr[-1000:]}")
        return done.stdout

    def test_browser_water_balance_matches_python(self):
        out = self.run_node("parity.js")
        self.assertRegex(out, r"\d+ checks, largest difference [\d.]+, 0 failures")

    def test_browser_eto_and_cover_calendar_match_python(self):
        out = self.run_node("live_parity.js")
        self.assertIn("all live ports match Python", out)


if __name__ == "__main__":
    unittest.main()
