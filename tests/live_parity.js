/*
 * Checks the browser ports in web/live.js against the Python originals, using the
 * prepared fields: reference evapotranspiration (model/water.py) and the living-cover
 * calendar (model/cover.py).
 *
 *   python build_site.py && node tests/live_parity.js
 */
const fs = require("fs");
const path = require("path");
const Live = require("../web/live.js");

const root = path.join(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "build", "data.json"), "utf8"));
let failures = 0;

function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, "utf8").replace(/\r/g, "").trim().split("\n");
  const keys = head.split(",");
  return lines.map(l => Object.fromEntries(l.split(",").map((v, i) => [keys[i], v === "" ? null : (i === 0 ? v : Number(v))])));
}

for (const [id, point] of Object.entries(site.points)) {
  const dir = path.join(root, "data", id);
  // 1. ETo from raw POWER rows vs the Python values embedded in the page
  const rows = readCsv(path.join(dir, "power_daily.csv")).filter(r => r.date >= "1994-01-01");
  let worst = 0;
  rows.forEach((r, i) => {
    const [y, m, d] = r.date.split("-").map(Number);
    const doy = Live.dayNo(y, m, d) - Live.dayNo(y, 1, 1) + 1;
    const js = Live.referenceEt(r, point.meta.lat, point.meta.elevation_m || 200, doy);
    worst = Math.max(worst, Math.abs(js - point.weather.eto[i]));
  });
  const etoOk = worst < 0.002;
  if (!etoOk) failures++;

  // 2. calendar from the NDVI file vs model/cover.py
  const comps = readCsv(path.join(dir, "ndvi_16day.csv")).map(r => ({ date: r.date, ndvi: r.ndvi, reliability: r.reliability === null ? "" : String(r.reliability) }));
  const cal = Live.coverCalendar(comps, point);
  const py = JSON.parse(fs.readFileSync(path.join(dir, "cover_calendar.json"), "utf8"));
  let same = 0, total = 0, dayDiff = 0;
  for (const y of py.years) {
    const j = cal.years.find(v => v.year === y.year);
    total++;
    if (j && j.status === y.status && j.dry_year === y.dry_year) same++;
    else if (process.env.VERBOSE) console.log("  ", y.year, y.status, y.dry_year, "|", j && j.status, j && j.dry_year);
    if (j) dayDiff = Math.max(dayDiff, Math.abs(j.green_days - y.green_days), Math.abs(j.bare_days - y.bare_days));
  }
  if (same !== total || dayDiff > 1) failures++;

  // 3. live mode has no reliability flag: how much does that change the year labels?
  const noFlag = Live.coverCalendar(comps.map(c => ({ date: c.date, ndvi: c.ndvi })), point);
  let liveSame = 0;
  for (const y of py.years) { const j = noFlag.years.find(v => v.year === y.year); if (j && j.status === y.status) liveSame++; }

  console.log(`${id}: ETo max diff ${worst.toFixed(4)} mm ${etoOk ? "ok" : "FAIL"}; calendar ${same}/${total} years identical, ` +
              `max day diff ${dayDiff}; without quality flags ${liveSame}/${total} labels unchanged`);
}
console.log(failures ? `${failures} failures` : "all live ports match Python");
process.exit(failures ? 1 : 0);
