/*
 * Fallow audit model, browser version.
 *
 * A line-by-line port of model/water.py (FAO-56 dual crop coefficient water balance)
 * plus a yield and income layer. Reference evapotranspiration is computed in Python
 * when the page is built and arrives here as one number per day.
 *
 * tests/parity.js checks that this file and model/water.py give the same numbers.
 *
 * Fallow Audit additions, ported from model/water.py (same names, same day order): warm season
 * (centred 7-day mean temperature, no snow on the ground), living-cover days (green / bare tilled
 * fallow / bare stubble, windy and heavy-rain bare days), harvest dates and the window from one harvest
 * to the next sowing (soil water gained, rain and snow, where the rest went), soil water at sowing in
 * 0-100 cm, the fallow advantage at wheat sowing, and the summaries built from them in runAll().
 *
 * Up To Para version by LunarOblivion, merged with Fallow Audit.
 * AI assistance: drafted with an AI model (Claude, Anthropic), reviewed by the team.
 */
(function (root) {
  "use strict";

  const LAYER_M = 0.1;

  const DEFAULT_SOIL = {
    available_water_mm_per_m: 160.0,
    profile_depth_m: 1.2,
    rew_mm: 8.0,
    tew_mm: 22.0,
  };

  const DEFAULT_ASSUMPTIONS = {
    snow_temp_c: 0.0,
    melt_mm_per_degree_day: 3.0,
    snow_kept_on_stubble: 1.0,
    snow_kept_on_bare_fallow: 0.7,
    melt_infiltration: 0.8,
    stubble_evaporation_factor: 0.75,
    kc_max: 1.2,
    kcb_min: 0.15,
    initial_root_depth_m: 0.15,
    severe_stress: 0.5,
    warm_temp_c: 5.0,
    strong_wind_ms: 6.0,     // model/season.py STRONG_WIND_MS
    heavy_rain_mm: 10.0,     // model/season.py HEAVY_RAIN_MM
  };

  const WINDOW_FLUXES = ["transpiration_mm", "evaporation_mm", "deep_drainage_mm", "snow_blown_mm", "melt_runoff_mm"];
  const WINDOW_SHARES = { evaporated_from_soil: "evaporation_mm", drained_below_profile: "deep_drainage_mm",
                          snow_blown_off: "snow_blown_mm", snowmelt_runoff: "melt_runoff_mm", transpired: "transpiration_mm" };
  const COVER_FIELDS = ["season_days", "green_cover_days", "bare_days", "bare_fallow_days", "bare_stubble_days",
                        "bare_windy_days", "bare_heavy_rain_days", "fallow_windy_days", "fallow_heavy_rain_days"];

  /* Warm season as in model/season.py: the centred 7-day mean temperature reaches warm_temp_c
     (missing days are skipped). Returns one true/false per day. */
  function warmDays(tmean, threshold) {
    const out = new Array(tmean.length);
    for (let i = 0; i < tmean.length; i++) {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - 3); j < Math.min(tmean.length, i + 4); j++) {
        const t = tmean[j];
        if (t !== null && t !== undefined) { sum += t; n++; }
      }
      out[i] = n > 0 && sum / n >= threshold;
    }
    return out;
  }

  /*
   * Soil carbon, a rough yearly budget per field, from the abstracts of Takata et al. (Shortandy):
   *   fallow field -0.8 t C/ha a year: Takata et al. 2007 (doi 10.1111/j.1747-0765.2007.00127.x),
   *     fallow fields about -0.8;
   *   crop residue input 1.3 t C/ha a year: within 1.0-1.6 (Takata et al. 2008, 54(1):159-171,
   *     doi 10.1111/j.1747-0765.2007.00217.x) and 0.9-1.4 per season (Takata et al. 2008, 54(5):794-806,
   *     doi 10.1111/j.1747-0765.2007.00298.x);
   *   crop field respiration 1.1 t C/ha a year: within 1.0-1.2 and 0.9-1.1 (same two papers).
   * The authors note low predictive ability of their regression; this is a rough estimate, not a
   * calibration. That the residue input scales with the crop's water-limited growth is our assumption.
   */
  const SOIL_CARBON = {
    fallow_budget_t_c: -0.8,
    crop_residue_t_c: 1.3,
    crop_respiration_t_c: 1.1,
    humus_per_carbon: 1.724,
  };

  // ---------------------------------------------------------------- dates
  // Days are handled as integer day numbers counted from 1970-01-01 (UTC), so no time zones.
  function dayNumber(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
  function fromDayNumber(n) {
    const dt = new Date(n * 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  // ---------------------------------------------------------------- soil
  class Profile {
    constructor(availablePerM, depthM, fill) {
      const count = Math.round(depthM / LAYER_M);
      this.capacity = availablePerM * LAYER_M;
      this.layers = new Array(count).fill(this.capacity * (fill === undefined ? 0.5 : fill));
    }
    total() { let s = 0; for (const w of this.layers) s += w; return s; }
    add(water) {
      for (let i = 0; i < this.layers.length; i++) {
        const take = Math.min(this.capacity - this.layers[i], water);
        this.layers[i] += take;
        water -= take;
        if (water <= 0) return 0.0;
      }
      return water;
    }
    shares(depthM) {
      const out = [];
      for (let i = 0; i < this.layers.length; i++) out.push(Math.min(1.0, Math.max(0.0, depthM / LAYER_M - i)));
      return out;
    }
    inRootZone(depthM) {
      const f = this.shares(depthM); let s = 0;
      for (let i = 0; i < this.layers.length; i++) s += this.layers[i] * f[i];
      return s;
    }
    take(amount, depthM) {
      const f = this.shares(depthM);
      const available = this.layers.map((w, i) => w * f[i]);
      let total = 0; for (const a of available) total += a;
      if (total <= 0 || amount <= 0) return 0.0;
      amount = Math.min(amount, total);
      for (let i = 0; i < available.length; i++) this.layers[i] -= amount * available[i] / total;
      return amount;
    }
    takeFromTop(amount, layers) {
      layers = layers || 2;
      let taken = 0.0;
      for (let i = 0; i < layers; i++) {
        const part = Math.min(this.layers[i], amount - taken);
        this.layers[i] -= part;
        taken += part;
      }
      return taken;
    }
  }

  // ---------------------------------------------------------------- crops
  function sowDay(crop, year, shiftDays) {
    const [m, d] = crop.sow.split("-").map(Number);
    return dayNumber(year, m, d) + (shiftDays || 0);
  }

  function cropState(crop, sow, day, a) {
    const age = day - sow;
    const [lIni, lDev, lMid, lLate] = crop.stages_days;
    const total = lIni + lDev + lMid + lLate;
    if (age < 0 || age >= total) return null;
    const [kIni, kMid, kEnd] = crop.kcb;
    let kcb;
    if (age < lIni) kcb = kIni;
    else if (age < lIni + lDev) kcb = kIni + (kMid - kIni) * (age - lIni) / lDev;
    else if (age < lIni + lDev + lMid) kcb = kMid;
    else kcb = kMid + (kEnd - kMid) * (age - lIni - lDev - lMid) / lLate;
    const grow = Math.min(1.0, age / (lIni + lDev));
    const root = a.initial_root_depth_m + (crop.root_depth_m - a.initial_root_depth_m) * grow;
    return { kcb, root_m: root };
  }

  // ---------------------------------------------------------------- simulation
  /*
   * weather: { start: [y, m, d], precip: [...], tmean: [...], eto: [...] }, one entry per day.
   * Returns one record per calendar year for a single field that follows `sequence`,
   * starting `phase` positions into it in the first simulated year.
   */
  function simulate(weather, sequence, phase, crops, options) {
    const soilCfg = Object.assign({}, DEFAULT_SOIL, options.soil || {});
    const a = Object.assign({}, DEFAULT_ASSUMPTIONS, options.assumptions || {});
    const shift = options.sowShiftDays || 0;
    const aw = soilCfg.available_water_mm_per_m;
    const tew = soilCfg.tew_mm, rew = soilCfg.rew_mm;
    const n = weather.precip.length;
    const start = dayNumber(weather.start[0], weather.start[1], weather.start[2]);
    const firstYear = weather.start[0];
    const L = sequence.length;

    const soil = new Profile(aw, soilCfg.profile_depth_m);
    let surface = tew;
    let snowpack = 0.0;
    const records = new Map();
    const sowCache = new Map();
    const warm = warmDays(weather.tmean, a.warm_temp_c);
    // the window from one harvest to the next sowing (spans the whole fallow year after a fallow)
    const totals = { transpiration_mm: 0, evaporation_mm: 0, deep_drainage_mm: 0, snow_blown_mm: 0, melt_runoff_mm: 0 };
    let lastHarvestWater = null, precipSinceHarvest = 0.0, atHarvest = null, snowAtHarvest = 0.0;

    for (let i = 0; i < n; i++) {
      const day = start + i;
      const { y: year, m: month, d: dom } = fromDayNumber(day);
      const landUse = sequence[(((year - firstYear + phase) % L) + L) % L];
      const previousUse = sequence[(((year - 1 - firstYear + phase) % L) + L) % L];
      let rec = records.get(year);
      if (!rec) {
        rec = { year, land_use: landUse, previous: previousUse,
          rain_snow_mm: 0, transpiration_mm: 0, demand_mm: 0, evaporation_mm: 0,
          deep_drainage_mm: 0, snow_blown_mm: 0, melt_runoff_mm: 0,
          water_at_sowing_mm: null, water_on_may_1_mm: null, water_on_sep_15_mm: null,
          bare_warm_days: 0,
          water_at_sowing_0_100_cm_mm: null, water_at_harvest_mm: null,
          water_at_previous_harvest_mm: null, precip_since_previous_harvest_mm: null, window_snow_change_mm: null };
        for (const f of COVER_FIELDS) rec[f] = 0;
        for (const f of WINDOW_FLUXES) rec["window_" + f] = null;
        records.set(year, rec);
      }

      const precip = weather.precip[i] || 0.0;
      const tmean = weather.tmean[i] === null || weather.tmean[i] === undefined ? 0.0 : weather.tmean[i];
      rec.rain_snow_mm += precip;

      const crop = crops[landUse] || null;
      let sow = null, state = null;
      if (crop) {
        const key = landUse + year;
        sow = sowCache.get(key);
        if (sow === undefined) { sow = sowDay(crop, year, shift); sowCache.set(key, sow); }
        state = cropState(crop, sow, day, a);
      }

      const afterJune1 = month > 6 || (month === 6 && dom >= 1);
      const fallowBare = (landUse === "fallow" && afterJune1) ||
                         (previousUse === "fallow" && state === null && month < 6);

      const stored = soil.total();
      if (crop && day === sow) {
        rec.water_at_sowing_mm = stored;
        rec.water_at_sowing_0_100_cm_mm = soil.inRootZone(1.0);   // the 1 m layer trials usually report
        if (lastHarvestWater !== null) {
          rec.water_at_previous_harvest_mm = lastHarvestWater;
          rec.precip_since_previous_harvest_mm = precipSinceHarvest;
          for (const f of WINDOW_FLUXES) rec["window_" + f] = totals[f] - atHarvest[f];
          rec.window_snow_change_mm = snowpack - snowAtHarvest;
        }
      }
      if (crop && day === sow + crop.stages_days.reduce((s, v) => s + v, 0)) {   // harvest: day after the last stage
        rec.water_at_harvest_mm = stored;
        lastHarvestWater = stored; precipSinceHarvest = 0.0;
        atHarvest = Object.assign({}, totals); snowAtHarvest = snowpack;
      }
      precipSinceHarvest += precip;
      if (month === 5 && dom === 1) rec.water_on_may_1_mm = stored;
      if (month === 9 && dom === 15) rec.water_on_sep_15_mm = stored;

      // snow
      let waterIn = 0.0;
      if (tmean < a.snow_temp_c) {
        const kept = fallowBare ? a.snow_kept_on_bare_fallow : a.snow_kept_on_stubble;
        snowpack += precip * kept;
        rec.snow_blown_mm += precip * (1 - kept);
        totals.snow_blown_mm += precip * (1 - kept);
      } else {
        waterIn += precip;
        if (snowpack > 0) {
          const melt = Math.min(snowpack, a.melt_mm_per_degree_day * tmean);
          snowpack -= melt;
          waterIn += melt * a.melt_infiltration;
          rec.melt_runoff_mm += melt * (1 - a.melt_infiltration);
          totals.melt_runoff_mm += melt * (1 - a.melt_infiltration);
        }
      }

      const drained = soil.add(waterIn);
      rec.deep_drainage_mm += drained;
      totals.deep_drainage_mm += drained;
      surface = Math.max(0.0, surface - waterIn);

      // living cover: warm-season days without snow on the ground (model/water.py, same rules as cover.py)
      if (warm[i] && snowpack <= 0) {
        rec.season_days += 1;
        if (state && state.kcb > a.kcb_min) rec.green_cover_days += 1;
        else {
          rec.bare_days += 1;
          if (fallowBare) rec.bare_fallow_days += 1; else rec.bare_stubble_days += 1;
          const ws = weather.ws ? weather.ws[i] : null;
          const windy = (ws || 0) >= a.strong_wind_ms ? 1 : 0, heavy = precip >= a.heavy_rain_mm ? 1 : 0;
          rec.bare_windy_days += windy; rec.bare_heavy_rain_days += heavy;
          if (fallowBare) { rec.fallow_windy_days += windy; rec.fallow_heavy_rain_days += heavy; }
        }
      }

      const frozen = snowpack > 0 || tmean < 0;
      const etoDay = frozen ? 0.0 : weather.eto[i];

      // transpiration (FAO-56 ch. 7 and 8)
      const kcb = state ? state.kcb : 0.0;
      let transpiration = 0.0, demand = 0.0;
      if (state) {
        const rootD = Math.min(state.root_m, soilCfg.profile_depth_m);
        const tawRoot = aw * rootD;
        const depletion = tawRoot - soil.inRootZone(rootD);
        demand = kcb * etoDay;
        const p = Math.min(0.8, Math.max(0.1, crop.p + 0.04 * (5 - demand)));
        const raw = p * tawRoot;
        const ks = depletion <= raw ? 1.0 : Math.max(0.0, (tawRoot - depletion) / ((1 - p) * tawRoot));
        transpiration = soil.take(ks * demand, rootD);
      }

      // soil evaporation (FAO-56 ch. 7)
      const height = crop ? crop.height_m : 0.0;
      let cover = 0.0;
      if (state && kcb > a.kcb_min) {
        cover = Math.pow((kcb - a.kcb_min) / (a.kc_max - a.kcb_min), 1 + 0.5 * height);
      }
      const exposed = Math.max(0.01, 1 - Math.min(cover, 0.99));
      const kr = surface <= rew ? 1.0 : Math.max(0.0, (tew - surface) / (tew - rew));
      const ke = Math.min(kr * (a.kc_max - kcb), exposed * a.kc_max);
      let evaporation = ke * etoDay;
      if (state === null && !fallowBare) evaporation *= a.stubble_evaporation_factor;
      evaporation = soil.takeFromTop(evaporation);
      surface = Math.min(tew, surface + evaporation / exposed);

      rec.transpiration_mm += transpiration;
      totals.transpiration_mm += transpiration;
      rec.demand_mm += demand;
      rec.evaporation_mm += evaporation;
      totals.evaporation_mm += evaporation;
      if (fallowBare && tmean >= a.warm_temp_c) rec.bare_warm_days += 1;
    }
    return Array.from(records.keys()).sort((x, y) => x - y).map(k => records.get(k));
  }

  // ---------------------------------------------------------------- yield and money
  function relativeYield(rec, crop) {
    if (!crop || rec.demand_mm <= 0) return null;
    const met = rec.transpiration_mm / rec.demand_mm;
    return Math.max(0, 1 - crop.ky * (1 - met));
  }

  /*
   * Runs every rotation in every phase and turns the result into what the page shows.
   * rotations: [{ id, sequence }], the first one is the farmer's current rotation.
   * economics: { crop: { yield_t_ha, price_per_t, cost_per_ha } }, plus economics.fallow.cost_per_ha
   */
  function runAll(point, rotations, crops, economics, options) {
    const keepFrom = options.keepFrom || 2000;
    const keepTo = options.keepTo;
    const severe = DEFAULT_ASSUMPTIONS.severe_stress;

    const runs = rotations.map(r => {
      const phases = [];
      for (let p = 0; p < r.sequence.length; p++) {
        phases.push(simulate(point.weather, r.sequence, p, crops, options)
          .filter(rec => rec.year >= keepFrom && rec.year <= keepTo));
      }
      return { id: r.id, sequence: r.sequence, phases };
    });

    // Reference relative yield per crop: the farmer's average yield refers to the current
    // rotation for crops it contains, otherwise to every rotation that grows the crop.
    const refRel = {};
    const collect = (runList) => {
      const acc = {};
      for (const run of runList) for (const phase of run.phases) for (const rec of phase) {
        const crop = crops[rec.land_use];
        const rel = relativeYield(rec, crop);
        if (rel === null) continue;
        (acc[rec.land_use] = acc[rec.land_use] || []).push(rel);
      }
      return acc;
    };
    const inCurrent = collect([runs[0]]), inAll = collect(runs);
    for (const c of Object.keys(inAll)) {
      const list = inCurrent[c] || inAll[c];
      refRel[c] = list.reduce((s, v) => s + v, 0) / list.length;
    }

    return runs.map(run => {
      const years = [];
      for (let y = keepFrom; y <= keepTo; y++) {
        const fields = run.phases.map(ph => ph.find(rec => rec.year === y)).filter(Boolean).map(rec => {
          const crop = crops[rec.land_use];
          const econ = economics[rec.land_use] || {};
          if (!crop) {
            return { use: rec.land_use, previous: rec.previous, met: null, yield_t_ha: 0,
                     income: -(economics.fallow ? economics.fallow.cost_per_ha : 0),
                     carbon_t_c: SOIL_CARBON.fallow_budget_t_c, rec };
          }
          const met = rec.demand_mm > 0 ? rec.transpiration_mm / rec.demand_mm : null;
          const rel = relativeYield(rec, crop);
          const yieldT = refRel[rec.land_use] > 0 ? (econ.yield_t_ha || 0) * rel / refRel[rec.land_use] : 0;
          const growth = refRel[rec.land_use] > 0 ? rel / refRel[rec.land_use] : 1;
          return { use: rec.land_use, previous: rec.previous, met, yield_t_ha: yieldT,
                   income: yieldT * (econ.price_per_t || 0) - (econ.cost_per_ha || 0),
                   carbon_t_c: SOIL_CARBON.crop_residue_t_c * growth - SOIL_CARBON.crop_respiration_t_c, rec };
        });
        const cropFields = fields.filter(f => f.met !== null);
        years.push({
          year: y,
          fields,
          met: cropFields.length ? cropFields.reduce((s, f) => s + f.met, 0) / cropFields.length : null,
          income_per_ha: fields.reduce((s, f) => s + f.income, 0) / fields.length,
          carbon_t_c: fields.reduce((s, f) => s + f.carbon_t_c, 0) / fields.length,
        });
      }

      const all = run.phases.flat();
      const cropRecs = all.filter(r => crops[r.land_use] && r.demand_mm > 0);
      const rain = all.reduce((s, r) => s + r.rain_snow_mm, 0);
      const sum = (key) => all.reduce((s, r) => s + r[key], 0);
      const mean = (list) => { const v = list.filter(x => x !== null && x !== undefined); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      const sat = (r) => r.transpiration_mm / r.demand_mm;

      const byCrop = {};
      for (const r of cropRecs) {
        const key = r.land_use + "|" + r.previous;
        (byCrop[key] = byCrop[key] || []).push(r);
      }
      const byCropSummary = {};
      for (const [key, list] of Object.entries(byCrop)) {
        byCropSummary[key] = {
          crop: key.split("|")[0], previous: key.split("|")[1], crop_years: list.length,
          demand_met_pct: 100 * mean(list.map(sat)),
          water_at_sowing_mm: mean(list.map(r => r.water_at_sowing_mm)),
          transpiration_mm: mean(list.map(r => r.transpiration_mm)),
          failure_years: list.filter(r => sat(r) < severe).length,
          severe_stress_pct: 100 * list.filter(r => sat(r) < severe).length / list.length,
          water_at_sowing_0_100_cm_mm: mean(list.map(r => r.water_at_sowing_0_100_cm_mm)),
        };
      }

      let cumulative = 0;
      const cumulativeIncome = years.map(y => (cumulative += y.income_per_ha));

      return {
        id: run.id,
        sequence: run.sequence,
        years,
        cumulative_income: cumulativeIncome,
        mean_income_per_ha: years.reduce((s, y) => s + y.income_per_ha, 0) / years.length,
        crop_years_per_10: 10 * cropRecs.length / all.length,
        water_use: {
          rain_and_snow_mm_per_year: rain / all.length,
          through_crops_pct: 100 * sum("transpiration_mm") / rain,
          soil_evaporation_pct: 100 * sum("evaporation_mm") / rain,
          deep_drainage_pct: 100 * sum("deep_drainage_mm") / rain,
          snow_blown_off_pct: 100 * sum("snow_blown_mm") / rain,
          melt_runoff_pct: 100 * sum("melt_runoff_mm") / rain,
        },
        mean_demand_met_pct: 100 * mean(cropRecs.map(sat)),
        severe_stress_crop_years_pct: cropRecs.length ? 100 * cropRecs.filter(r => sat(r) < severe).length / cropRecs.length : 0,
        bare_warm_days_per_year: sum("bare_warm_days") / all.length,
        soil_carbon_t_c_per_year: years.reduce((s, y) => s + y.carbon_t_c, 0) / years.length,
        by_crop: byCropSummary,
        // Fallow Audit summaries, as model/water.py summarise()
        cover: coverSummary(all, keepFrom),
        fallow: storage(all, "fallow", "wheat", keepFrom),
        after_wheat_storage: storage(all, "wheat", "wheat", keepFrom),
        fallow_advantage_at_wheat_sowing_mm: fallowAdvantage(all),
      };
    });
  }

  const meanOf = (list) => { const v = list.filter(x => x !== null && x !== undefined); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

  // Living-cover days a year, averaged over every phase and kept year; one whole fallow period per fallow.
  function coverSummary(rows) {
    const out = {};
    for (const f of COVER_FIELDS) out[f] = meanOf(rows.map(r => r[f]));
    const fallowRows = rows.filter(r => r.land_use === "fallow").length;
    if (fallowRows) {
      out.per_fallow = {};
      for (const f of ["bare_fallow_days", "fallow_windy_days", "fallow_heavy_rain_days"])
        out.per_fallow[f] = rows.reduce((s, r) => s + r[f], 0) / fallowRows;
    }
    return out;
  }

  // Soil water gained from the previous harvest to the sowing of `crop` after `previousUse`, the share of the
  // rain and snow of that window that stayed in the soil, and where the rest went (water.py storage()).
  function storage(rows, previousUse, crop, keepFrom) {
    const items = [];
    for (const r of rows) {
      if (r.previous !== previousUse || r.land_use !== crop || r.year - 1 < keepFrom) continue;
      const start = r.water_at_previous_harvest_mm, end = r.water_at_sowing_mm, rain = r.precip_since_previous_harvest_mm;
      if (start === null || end === null || !rain) continue;
      const share = {};
      for (const [name, f] of Object.entries(WINDOW_SHARES)) share[name] = 100 * (r["window_" + f] || 0) / rain;
      share.snow_left_on_the_ground = 100 * (r.window_snow_change_mm || 0) / rain;
      items.push({ year: previousUse === "fallow" ? r.year - 1 : r.year, gain_mm: end - start, start_mm: start,
                   precip_mm: rain, efficiency_pct: 100 * (end - start) / rain, share });
    }
    if (!items.length) return null;
    const lowest = items.reduce((a, b) => (b.gain_mm < a.gain_mm ? b : a));
    const where = {};
    for (const name of Object.keys(items[0].share)) where[name] = meanOf(items.map(i => i.share[name]));
    return {
      window: "harvest of the previous crop to sowing", count: items.length,
      mean_gain_mm: meanOf(items.map(i => i.gain_mm)), min_gain_mm: lowest.gain_mm,
      max_gain_mm: Math.max(...items.map(i => i.gain_mm)), min_gain_year: lowest.year, min_gain_start_mm: lowest.start_mm,
      mean_precip_mm: meanOf(items.map(i => i.precip_mm)),
      storage_efficiency_pct: { mean: meanOf(items.map(i => i.efficiency_pct)),
                                min: Math.min(...items.map(i => i.efficiency_pct)), max: Math.max(...items.map(i => i.efficiency_pct)) },
      where_it_went_pct: where,
    };
  }

  // Extra soil water at wheat sowing after a fallow, against wheat after wheat in the same year (water.py).
  function fallowAdvantage(rows) {
    const afterFallow = {}, afterWheat = {};
    for (const r of rows) {
      if (r.land_use !== "wheat") continue;
      if (r.previous === "fallow") afterFallow[r.year] = r; else if (r.previous === "wheat") afterWheat[r.year] = r;
    }
    const years = Object.keys(afterFallow).filter(y => afterWheat[y]).sort();
    if (!years.length) return null;
    const byYear = {};
    for (const y of years) byYear[y] = {
      cm120: afterFallow[y].water_at_sowing_mm - afterWheat[y].water_at_sowing_mm,
      cm100: afterFallow[y].water_at_sowing_0_100_cm_mm - afterWheat[y].water_at_sowing_0_100_cm_mm };
    return { mean_cm120: meanOf(years.map(y => byYear[y].cm120)), mean_cm100: meanOf(years.map(y => byYear[y].cm100)), by_year: byYear };
  }

  const api = { simulate, runAll, Profile, dayNumber, fromDayNumber, DEFAULT_SOIL, DEFAULT_ASSUMPTIONS, SOIL_CARBON };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FallowModel = api;
})(typeof window !== "undefined" ? window : globalThis);
