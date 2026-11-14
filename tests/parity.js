/*
 * Checks that web/model.js gives the same water balance as model/water.py.
 *
 *   python build_site.py                      # writes docs/data.json
 *   python model/water.py data/<point>        # writes data/<point>/water_balance.json
 *   node tests/parity.js
 *
 * AI assistance: drafted with an AI model (Claude, Anthropic), reviewed by the team.
 */
const fs = require("fs");
const path = require("path");
const M = require("../web/model.js");

const root = path.join(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "build", "data.json"), "utf8"));
const crops = site.crops.crops;
let worst = 0, checks = 0;

function compare(label, a, b, tolerance) {
  const diff = Math.abs(a - b);
  worst = Math.max(worst, diff); checks++;
  const ok = diff <= tolerance;
  if (!ok) console.log(`  MISMATCH ${label}: python ${a.toFixed(2)} js ${b.toFixed(2)}`);
  return ok;
}

let failures = 0;
for (const [id, point] of Object.entries(site.points)) {
  const pyFile = path.join(root, "data", id, "water_balance.json");
  if (!fs.existsSync(pyFile)) { console.log(`${id}: no water_balance.json, skipped`); continue; }
  const py = JSON.parse(fs.readFileSync(pyFile, "utf8"));
  const rotations = Object.entries(site.crops.rotations).map(([key, r]) => ({ id: key, sequence: r.sequence }));
  const js = M.runAll(point, rotations, crops, {}, { keepFrom: 2000, keepTo: point.keep_to });
  for (const r of js) {
    const p = py.rotations[r.id];
    const t = 0.6; // percentage points; inputs are rounded to 0.01 mm when the page is built
    if (!compare(`${id} ${r.id} through crops`, p.water_use.through_crops_pct, r.water_use.through_crops_pct, t)) failures++;
    if (!compare(`${id} ${r.id} evaporation`, p.water_use.soil_evaporation_pct, r.water_use.soil_evaporation_pct, t)) failures++;
    if (!compare(`${id} ${r.id} need met`, p.mean_demand_met_pct, r.mean_demand_met_pct, t)) failures++;
    if (!compare(`${id} ${r.id} severe`, p.severe_stress_crop_years_pct, r.severe_stress_crop_years_pct, 3)) failures++;
    for (const [key, item] of Object.entries(p.by_crop)) {
      const [crop, , previous] = key.split(" ");
      const j = r.by_crop[crop + "|" + previous];
      if (!j) { console.log(`  MISSING ${id} ${r.id} ${key}`); failures++; continue; }
      if (!compare(`${id} ${r.id} ${key} water at sowing`, item.water_at_sowing_mm, j.water_at_sowing_mm, 2)) failures++;
      // Fallow Audit metrics
      if (!compare(`${id} ${r.id} ${key} water at sowing 0-100 cm`, item.water_at_sowing_0_100_cm_mm, j.water_at_sowing_0_100_cm_mm, 2)) failures++;
      if (!compare(`${id} ${r.id} ${key} severe stress %`, item.severe_stress_pct, j.severe_stress_pct, 4)) failures++;
    }
    // Fallow Audit metrics: living-cover days, the harvest-to-sowing window, the fallow advantage at sowing
    for (const [f, v] of Object.entries(p.cover)) {
      if (f === "per_fallow") {
        for (const [g, w] of Object.entries(v)) if (!compare(`${id} ${r.id} per fallow ${g}`, w, r.cover.per_fallow[g], 1)) failures++;
      } else if (!compare(`${id} ${r.id} ${f}`, v, r.cover[f], 0.5)) failures++;
    }
    for (const block of ["fallow", "after_wheat_storage"]) {
      const a = p[block], b = r[block];
      if (!a && !b) continue;
      if (!a || !b) { console.log(`  MISSING ${id} ${r.id} ${block}`); failures++; continue; }
      if (!compare(`${id} ${r.id} ${block} count`, a.count, b.count, 0)) failures++;
      if (!compare(`${id} ${r.id} ${block} mean gain`, a.mean_gain_mm, b.mean_gain_mm, 1)) failures++;
      if (!compare(`${id} ${r.id} ${block} rain in window`, a.mean_precip_mm, b.mean_precip_mm, 1)) failures++;
      if (!compare(`${id} ${r.id} ${block} stays in soil %`, a.storage_efficiency_pct.mean, b.storage_efficiency_pct.mean, 0.3)) failures++;
      for (const [k, v] of Object.entries(a.where_it_went_pct))
        if (!compare(`${id} ${r.id} ${block} ${k} %`, v, b.where_it_went_pct[k], 0.3)) failures++;
    }
    const adv = p.fallow_advantage_at_wheat_sowing_mm, jadv = r.fallow_advantage_at_wheat_sowing_mm;
    if (adv || jadv) {
      if (!adv || !jadv) { console.log(`  MISSING ${id} ${r.id} fallow advantage`); failures++; }
      else {
        if (!compare(`${id} ${r.id} fallow advantage 0-100 cm`, adv.mean_cm100, jadv.mean_cm100, 1)) failures++;
        if (!compare(`${id} ${r.id} fallow advantage 0-120 cm`, adv.mean_cm120, jadv.mean_cm120, 1)) failures++;
        for (const [y, v] of Object.entries(adv.by_year))
          if (!compare(`${id} ${r.id} fallow advantage ${y} 0-100 cm`, v.cm100, jadv.by_year[y].cm100, 2)) failures++;
      }
    }
  }
  console.log(`${id}: compared`);
}
console.log(`${checks} checks, largest difference ${worst.toFixed(3)}, ${failures} failures`);
process.exit(failures ? 1 : 0);
