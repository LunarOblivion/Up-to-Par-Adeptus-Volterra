"""
The page (docs/index.html): builds, is self-contained, works for every field and in both languages
with no internet at all, and fits a phone screen.

The browser checks need Chrome or Edge (run headless with every host name blocked); without one
they are skipped and only the static checks run; then check the page by hand in a browser.

"""

import json
import pathlib
import re
import tempfile
import unittest

from helpers import PHONE_WIDTH, POINTS, ROOT, page_data, probe_page

import build_site

MAX_PAGE_BYTES = 5 * 1024 * 1024   # 8 fields of daily weather since 1994 for the in-browser model;
                                   # GitHub Pages serves it gzip-compressed (about a third of that)

# Runs inside the page with no internet: every field, then Russian. Returns what the test checks.
WALK_FIELDS = r"""
const out = { fields: {}, ids: [] };
const text = id => { const el = document.getElementById(id); return el ? el.innerText.trim().length : -1; };
const bad = s => ["NaN", "undefined", "Infinity", "[object"].filter(w => s.includes(w));
out.ids = [...document.querySelectorAll("#fields [data-id]")].map(b => b.dataset.id);
for (const id of out.ids) {
  document.querySelector(`#fields [data-id="${id}"]`).click();
  await __wait(700);
  const fb = document.getElementById("map-fallback");
  const txt = id => { const el = document.getElementById(id); return el && !el.closest("[hidden]") ? el.innerText.trim() : ""; };
  out.fields[id] = { answer: text("answer-1"), rotations: text("rotations"), cards: text("cards"), stress: text("stress"),
                     split: text("water-split"), meta: text("field-meta"), fallback: !!fb && !fb.hidden,
                     bad: bad(document.body.innerText),
                     a1: txt("answer-1"), a2: txt("answer-2"), a3: txt("answer-3"), warn: txt("point-warning"),
                     window: txt("fallow-window"), gw: txt("gw-lead"), trial: txt("trial-compare"),
                     verdict: txt("trial-verdict"), trialTable: txt("trial-table"), carbon: txt("carbon-check"),
                     splitText: txt("water-split"), rotText: txt("rotations"), stressText: txt("stress"),
                     cardsText: txt("cards"), metaText: txt("field-meta"), autumn: txt("autumn-answer") + " " + txt("autumn-detail"),
                     banner: (document.querySelector(".money-banner") || {}).innerText || "",
                     money: txt("money-summary"), lead: (document.querySelector('[data-t="s1Lead"]') || {}).innerText || "",
                     body: document.body.innerText };
}
document.querySelector('#langs [data-lang="ru"]').click();
await __wait(700);
const ru = document.body.innerText;
out.ru = { cyrillic: (ru.match(/[Ѐ-ӿ]/g) || []).length, bad: bad(ru), text: ru };
out.page = { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth };
return out;
"""


class Site(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.page = pathlib.Path(cls.tmp.name) / "index.html"
        build_site.main(out=cls.page)
        cls.html = cls.page.read_text(encoding="utf-8")
        cls.data = page_data(cls.html)
        cls.offline = {width: probe_page(cls.page, width, WALK_FIELDS) for width in (1440, PHONE_WIDTH)}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def browser(self, width):
        result = self.offline[width]
        if result is None:
            self.skipTest("Chrome or Edge not found: check the page by hand in a browser")
        return result

    # ---------------------------------------------------------------- static

    def test_committed_page_is_up_to_date(self):
        committed = (ROOT / "docs" / "index.html").read_text(encoding="utf-8").replace("\r\n", "\n")
        self.assertEqual(committed, self.html, "docs/index.html is stale: run python run_all.py")

    def test_no_duplicate_data_file_is_published(self):
        self.assertFalse((ROOT / "docs" / "data.json").exists(), "data.json belongs in build/, not docs/")

    def test_size(self):
        self.assertLess(self.page.stat().st_size, MAX_PAGE_BYTES)

    def test_nothing_is_loaded_from_the_internet_to_show_the_page(self):
        """Scripts, styles and fonts are inlined. URLs inside the scripts (live NASA data, map tiles)
        are optional extras that the offline browser test below switches off."""
        for pattern in (r"""<script[^>]+src\s*=""", r"""<link[^>]+href\s*=\s*["']?https?:""", r"@import",
                        r"fonts\.googleapis", r"fonts\.gstatic", r"unpkg\.com"):
            with self.subTest(pattern=pattern):
                self.assertIsNone(re.search(pattern, self.html, re.I))
        self.assertIn("Leaflet 1.9.4", self.html)          # inlined, BSD-2-Clause
        self.assertIn('<link rel="icon" type="image/svg+xml" href="favicon.svg">', self.html)
        self.assertTrue((ROOT / "docs" / "favicon.svg").exists())   # no 404 for the browser's favicon request

    def test_project_name_is_one_constant(self):
        self.assertIn(f"<title>{build_site.PROJECT_NAME}:", self.html)
        self.assertEqual(self.data["project_name"], build_site.PROJECT_NAME)
        self.assertNotIn("/*PROJECT_NAME*/", self.html)

    def test_every_field_is_on_the_page_with_its_evidence(self):
        expected = [p for p in POINTS if (ROOT / "data" / p / "water_balance.json").exists()]
        self.assertEqual(list(self.data["points"]), expected)
        self.assertEqual(len(expected), 8)
        for point, item in self.data["points"].items():
            with self.subTest(point=point):
                self.assertTrue(item["cover"]["years"])
                self.assertIn("A_current", item["evidence"]["rotations"])
                self.assertIsNotNone(item["evidence"]["gwetroot_check"])
                self.assertEqual("validation" in item, point == "shortandy")
                self.assertGreater(item["meta"]["elevation_m"], 0)

    # ---------------------------------------------------------------- in a browser, no internet

    def test_suspicious_points_are_flagged(self):
        """Shortandy (7 of 27 long green seasons) must carry the warning; other fields follow their data.
        Esil: low summer greenness (median summer NDVI 0.37), the only field below 0.40."""
        self.assertTrue(self.data["points"]["shortandy"]["cover"]["summary"]["warnings"])
        low = [p for p, item in self.data["points"].items()
               if any(w["code"] == "low_summer_greenness" for w in item["cover"]["summary"]["warnings"])]
        self.assertEqual(low, ["esil"])

    def test_esil_warning_on_the_page(self):
        result = self.browser(1440)
        warn = result["fields"]["esil"]["warn"]
        self.assertIn("Check this field: its summer greenness is low (median NDVI 0.37 against 0.42-0.64 on the other fields).", warn)
        self.assertIn("The 0.35 threshold may count weak crops as fallow, so some of the 12 fallow-like years may be poor crops.", warn)
        self.assertIn("NDVI for this field was read from NASA GIBS map tiles; a direct check against ORNL was not possible on 14 Nov 2026.", warn)
        self.assertIn("летняя зелень здесь низкая", self.html)          # the Russian text of the same warning

    def test_offline_every_field_renders(self):
        result = self.browser(1440)
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["ids"], list(self.data["points"]))
        for point, f in result["fields"].items():
            with self.subTest(point=point):
                self.assertTrue(f["fallback"], "the map sketch must replace missing map tiles")
                for key in ("answer", "rotations", "cards", "stress", "split", "meta"):
                    self.assertGreater(f[key], 0, f"{key} is empty")
                self.assertEqual(f["bad"], [])

    def test_fallow_audit_blocks_on_every_field(self):
        """M3: tilled bare soil, the fallow window, GWETROOT, carbon; the trial only at Shortandy; flags."""
        result = self.browser(1440)
        for point, f in result["fields"].items():
            item = self.data["points"][point]
            with self.subTest(point=point):
                if item["cover"]["summary"]["likely_fallow_years"]:
                    self.assertRegex(f["a1"], r"^Tilled bare soil: \d+ days a year now → \d+ with Option [BCD]")
                else:                                                        # MODIS sees no fallow here: what-if
                    self.assertRegex(f["a1"], r"^Tilled bare soil if this field had fallow: \d+ days a year → \d+ with Option [BCD].*what-if")
                    self.assertIn("would have", f["a2"] + f["a3"])
                    self.assertNotIn(" now", f["a1"] + f["a2"] + f["a3"])
                self.assertNotIn("₸", f["a1"] + f["a2"] + f["a3"])            # no money on the first screen
                self.assertRegex(f["a2"], r"only \d+% of the rain and snow")
                self.assertRegex(f["a3"], r"harvests in 10 years (now|with fallow)")
                self.assertIn("Stayed in the soil", f["window"])
                self.assertIn("65 to 80 percent", f["window"])
                self.assertRegex(f["gw"], r"r = \d\.\d\d on 1 May, r = \d\.\d\d on 15 September")
                self.assertRegex(f["carbon"], r"by [+−]\d\.\d\d t C/ha a year")
                self.assertIn("days of tilled bare soil and", f["splitText"])
                self.assertEqual(bool(f["warn"]), bool(item["cover"]["summary"]["warnings"]))
                self.assertEqual(bool(f["trial"]), point == "shortandy")
        sh = result["fields"]["shortandy"]
        self.assertIn("+20 to +30 mm in two of the three years", sh["trial"])
        self.assertIn("opposite sign", sh["trial"])
        self.assertIn("falls in the published range, but it does not reproduce individual years", sh["verdict"])
        self.assertIn("not a single year on a trial plot", sh["verdict"])
        self.assertIn("1.59", sh["trialTable"])
        self.assertIn("+30%", sh["trialTable"])
        self.assertIn("+10%", sh["trialTable"])
        self.assertIn("inside that range", sh["carbon"])                      # +0.26 against +0.1..+0.3

    def test_texts_follow_the_evidence(self):
        """M4: money only in pass 3 with its banner; cards follow Suleimenov et al. 2005; no yield forecast."""
        result = self.browser(1440)
        for point, f in result["fields"].items():
            with self.subTest(point=point):
                self.assertNotIn("₸", f["rotText"])          # no money in the rotation builder
                self.assertNotIn("₸", f["stressText"])       # no money in the stress test
                self.assertNotIn("₸", f["cardsText"])        # cards link to pass 3 instead
                self.assertIn("Money: see pass 3", f["cardsText"])
                self.assertIn("Oats in place of fallow gave the most grain in the Shortandy trial", f["cardsText"])
                self.assertIn("about 10% more grain from the whole area than with fallow, less than with oats", f["cardsText"])
                self.assertIn("has not been tested in a trial we could cite", f["cardsText"])
                for gone in ("spread quickly", "gave more grain from the whole area", "not yet verified", "of a usual harvest"):
                    self.assertNotIn(gone, f["cardsText"] + f["autumn"])
                self.assertIn("mean of the complete years 2000 to 2025", f["metaText"])
                self.assertIn("Example yields and costs. Enter your own: the ranking can change.", f["banner"])
                if f["autumn"].strip():
                    self.assertIn("forecast", f["autumn"])
                # gains and losses against your rotation say their direction in words, not with a sign
                self.assertNotIn("points in the share", f["cardsText"])
                self.assertRegex(f["cardsText"], r"\d+ points (more|fewer) harvests short of water \((better|worse)\)")
                self.assertRegex(f["cardsText"], r"\d+ (more|fewer) days of tilled bare soil a year \((better|worse)\)")
                # years: a range ending in the year the weather stops early says so
                self.assertRegex(f["lead"], r"2000–\d{4} \(\d{4} to \d{1,2} [A-Z][a-z]+\)")
                self.assertNotIn("to today", f["body"])
                self.assertNotRegex(f["body"], r"weather 2000–2026:")
                if f["money"]:
                    self.assertTrue(f["money"].startswith("With the example yields and costs above,"), f["money"])
        ru = result["ru"]["text"]
        for gone in ("быстро распространяются", "обычного урожая", "Прогноз гумуса", "ещё не провер"):
            self.assertNotIn(gone, ru)
        for present in ("Урожайности и затраты — примеры", "Пролёт 7", "Деньги — в пролёте 3", "(хуже)", "(лучше)",
                        "При примерных урожаях и затратах выше,", "— по "):
            self.assertIn(present, ru)

    def test_offline_russian(self):
        result = self.browser(1440)
        self.assertGreater(result["ru"]["cyrillic"], 2000)
        self.assertEqual(result["ru"]["bad"], [])

    def test_offline_phone_first_screen_and_no_sideways_scroll(self):
        result = self.browser(PHONE_WIDTH)
        self.assertEqual(result["errors"], [])
        first = result["fields"][result["ids"][0]]
        self.assertTrue(first["fallback"])
        self.assertGreater(first["answer"], 0)
        self.assertLessEqual(result["page"]["scroll"], result["page"]["client"], "the page scrolls sideways on a phone")


if __name__ == "__main__":
    unittest.main()
