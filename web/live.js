/*
 * Live NASA data for any point, straight from the browser (no server).
 *
 *   NASA POWER daily API   weather and soil wetness, 1994 to ten days ago   (about 10 s)
 *   ORNL DAAC TESViS API    MODIS MOD13Q1 NDVI, 2000 to now, newest first     (several minutes)
 *   NASA GIBS map tiles     MODIS NDVI history and neighbours, SMAP soil moisture, decoded from colours (about 1 min)
 *
 * Also contains JavaScript ports of the Python reference evapotranspiration
 * (model/water.py) and living-cover calendar (model/cover.py), so a live point gets
 * the same analysis as the prepared fields. tests/live_parity.js compares them.
 */
(function (root) {
  "use strict";

  const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
  const POWER_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "RH2M", "WS2M", "GWETROOT"];
  const MODIS_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1";
  const NDVI_BAND = "250m_16_days_NDVI";
  const FIRST_YEAR = 1981;   // full POWER record, used for the dry-year ranking
  const MODEL_FIRST_YEAR = 1994;   // the water balance starts here (six spin-up years before 2000)
  const THRESHOLDS = {
    warm_temp_c: 5.0, green_ndvi: 0.35, fallow_summer_ndvi: 0.35, unclear_summer_ndvi: 0.42,
    long_season_green_days: 130, strong_wind_ms: 6.0, heavy_rain_mm: 10.0, dry_year_percentile: 20,
  };

  // ---------------------------------------------------------------- dates
  const dayNo = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
  const ymd = (n) => { const t = new Date(n * 86400000); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
  const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const compact = (n) => iso(n).replace(/-/g, "");

  // ---------------------------------------------------------------- FAO-56 reference evapotranspiration
  const SIGMA = 4.903e-9;
  const svp = (t) => 0.6108 * Math.exp(17.27 * t / (t + 237.3));
  function extraterrestrial(latDeg, doy) {
    const phi = latDeg * Math.PI / 180;
    const dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
    const delta = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
    return (24 * 60 / Math.PI) * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  }
  function referenceEt(day, latDeg, elevation, doy) {
    const tmax = day.T2M_MAX, tmin = day.T2M_MIN, tmean = day.T2M;
    if (tmax === null || tmin === null || tmean === null) return 0;
    const u2 = day.WS2M !== null ? day.WS2M : 2.0;
    const rh = day.RH2M !== null ? day.RH2M : 60.0;
    const ra = extraterrestrial(latDeg, doy);
    let rs = day.ALLSKY_SFC_SW_DWN;
    if (rs === null) rs = 0.16 * Math.sqrt(Math.max(tmax - tmin, 0)) * ra;
    const pressure = 101.3 * Math.pow((293 - 0.0065 * elevation) / 293, 5.26);
    const gamma = 0.000665 * pressure;
    const delta = 4098 * svp(tmean) / Math.pow(tmean + 237.3, 2);
    const es = (svp(tmax) + svp(tmin)) / 2, ea = rh / 100 * es;
    const rso = (0.75 + 2e-5 * elevation) * ra, rns = 0.77 * rs;
    const ratio = rso > 0 ? Math.min(rs / rso, 1.0) : 0.5;
    const rnl = SIGMA * (Math.pow(tmax + 273.16, 4) + Math.pow(tmin + 273.16, 4)) / 2 *
                (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) * (1.35 * ratio - 0.35);
    const rn = rns - rnl;
    const eto = (0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2));
    return Math.max(eto, 0);
  }

  // ---------------------------------------------------------------- fetching
  async function getJson(url, tries) {
    tries = tries || 3;
    let last;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (r.ok) return await r.json();
        last = new Error(`HTTP ${r.status}`);
        if (r.status < 500 && r.status !== 429) break;
      } catch (e) { last = e; }
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
    throw last;
  }

  async function pool(tasks, size, onDone) {
    let next = 0, done = 0;
    const results = new Array(tasks.length);
    async function worker() {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
        done++; if (onDone) onDone(done, tasks.length, i, results[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
    return results;
  }

  /* Weather for a point. Returns rows [{n, T2M, ...}] and the elevation POWER reports. */
  async function fetchWeather(lat, lon, onProgress) {
    const end = Math.floor(Date.now() / 86400000) - 10;
    const lastYear = ymd(end)[0];
    const chunks = [];
    for (let y = FIRST_YEAR; y <= lastYear; y += 5) {
      const a = dayNo(y, 1, 1), b = Math.min(dayNo(y + 4, 12, 31), end);
      chunks.push(() => getJson(`${POWER_URL}?parameters=${POWER_PARAMS.join(",")}&community=AG` +
        `&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start=${compact(a)}&end=${compact(b)}&format=JSON`));
    }
    const parts = await pool(chunks, 4, onProgress);
    const byDay = new Map();
    let elevation = null;
    for (const part of parts) {
      const fill = (part.header && part.header.fill_value !== undefined) ? part.header.fill_value : -999;
      if (part.geometry && part.geometry.coordinates && part.geometry.coordinates.length > 2) elevation = part.geometry.coordinates[2];
      for (const [param, series] of Object.entries(part.properties.parameter)) {
        for (const [key, value] of Object.entries(series)) {
          const n = dayNo(+key.slice(0, 4), +key.slice(4, 6), +key.slice(6, 8));
          if (!byDay.has(n)) byDay.set(n, { n });
          byDay.get(n)[param] = value === fill ? null : value;
        }
      }
    }
    const rows = Array.from(byDay.values()).sort((a, b) => a.n - b.n);
    for (const r of rows) for (const p of POWER_PARAMS) if (r[p] === undefined) r[p] = null;
    while (rows.length && rows[rows.length - 1].PRECTOTCORR === null) rows.pop();  // trailing days not yet published
    return { rows, elevation: elevation === null ? 200 : elevation };
  }

  /* Turns weather rows into the point structure the page and model use. */
  function mayJulyRain(rows) {
    const out = {}, count = {};
    for (const r of rows) {
      const [y, m] = ymd(r.n);
      if (m >= 5 && m <= 7 && r.PRECTOTCORR !== null) { out[y] = (out[y] || 0) + r.PRECTOTCORR; count[y] = (count[y] || 0) + 1; }
    }
    for (const y of Object.keys(out)) if (count[y] < 85) delete out[y];
    return out;
  }

  function buildPoint(lat, lon, weather, label) {
    const mjj = mayJulyRain(weather.rows);
    const rows = weather.rows.filter(r => ymd(r.n)[0] >= MODEL_FIRST_YEAR);
    const first = rows[0].n, last = rows[rows.length - 1].n;
    const [ly, lm, ld] = ymd(last);
    const keepTo = (lm > 9 || (lm === 9 && ld >= 30)) ? ly : ly - 1;
    const precip = [], tmean = [], eto = [], tmax = [], tmin = [], rh = [], ws = [], rs = [];
    const r1 = (v) => v === null ? null : Math.round(v * 10) / 10;
    for (let n = first, i = 0; n <= last; n++) {
      const r = rows[i] && rows[i].n === n ? rows[i++] : { T2M: null, T2M_MAX: null, T2M_MIN: null, PRECTOTCORR: null, ALLSKY_SFC_SW_DWN: null, RH2M: null, WS2M: null };
      const [y] = ymd(n);
      const doy = n - dayNo(y, 1, 1) + 1;
      precip.push(r.PRECTOTCORR === null ? 0 : Math.round(r.PRECTOTCORR * 100) / 100);
      tmean.push(r.T2M === null ? null : Math.round(r.T2M * 100) / 100);
      eto.push(Math.round(referenceEt(r, lat, weather.elevation, doy) * 1000) / 1000);
      tmax.push(r1(r.T2M_MAX)); tmin.push(r1(r.T2M_MIN)); rh.push(r.RH2M === null ? null : Math.round(r.RH2M));
      ws.push(r1(r.WS2M)); rs.push(r1(r.ALLSKY_SFC_SW_DWN));
    }
    const sumWhere = (fn) => rows.reduce((s, r) => s + (fn(r) ? (r.PRECTOTCORR || 0) : 0), 0);
    let july = 0, years = 0;
    for (let y = 2000; y <= keepTo; y++) { july += sumWhere(r => { const [a, b] = ymd(r.n); return a === y && b === 7; }); years++; }
    const rain = sumWhere(r => { const y = ymd(r.n)[0]; return y >= 2000 && y <= keepTo; });

    const autumn = {};
    for (let y = 2000; y <= ly; y++) {
      const a = dayNo(y, 9, 15), b = dayNo(y, 11, 4), r0 = dayNo(y, 9, 1);
      if (b > last) continue;
      const wet = rows.filter(r => r.n >= a && r.n <= b && r.GWETROOT !== null).map(r => r.GWETROOT);
      const rainA = rows.filter(r => r.n >= r0 && r.n <= b).reduce((s, r) => s + (r.PRECTOTCORR || 0), 0);
      if (wet.length) autumn[y] = { wetness: wet.reduce((s, v) => s + v, 0) / wet.length, rain_mm: rainA };
    }
    const [fy, fm, fd] = ymd(first);
    return {
      live: true,
      meta: { lat, lon, label, name: label, elevation_m: weather.elevation },
      keep_to: keepTo,
      july_rain_mm: july / years,
      rain_mm_per_year: rain / (keepTo - 2000 + 1),
      weather: { start: [fy, fm, fd], precip, tmean, eto, tmax, tmin, rh, ws, rs },
      ribbon: {}, autumn: { years: autumn }, may_july_rain: mjj,
      cover: { summary: { likely_fallow_years: [], unclear_years: [], long_green_season_years: [] }, years: [] },
      season_types: {},
      modis: [],
    };
  }

  // ---------------------------------------------------------------- MODIS
  async function modisDates(lat, lon) {
    const d = await getJson(`${MODIS_URL}/dates?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`);
    return d.dates.map(x => x.modis_date);
  }

  /* Fetch NDVI composites newest first; onChunk gets [{date, ndvi}] after every request. */
  async function fetchNdvi(lat, lon, onChunk, signal) {
    const dates = await modisDates(lat, lon);
    const chunks = [];
    for (let i = 0; i < dates.length; i += 10) chunks.push(dates.slice(i, i + 10));
    chunks.reverse();
    const tasks = chunks.map(c => async () => {
      if (signal && signal.aborted) return [];
      const r = await getJson(`${MODIS_URL}/subset?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
        `&band=${NDVI_BAND}&startDate=${c[0]}&endDate=${c[c.length - 1]}&kmAboveBelow=0&kmLeftRight=0`).catch(() => ({ subset: [] }));
      return (r.subset || []).filter(s => s.band === NDVI_BAND).map(s => {
        const raw = s.data[Math.floor(s.data.length / 2)];
        return { date: s.calendar_date, ndvi: raw === null || raw <= -3000 ? null : raw * 0.0001 };
      });
    });
    await pool(tasks, 6, (done, total, i, items) => onChunk(items, done, total));
  }

  // ---------------------------------------------------------------- living-cover calendar (port of model/cover.py)
  /*
   * composites: [{date: "YYYY-MM-DD", ndvi, reliability?}]. Without a reliability flag (live data),
   * a near-zero NDVI between November and March is read as snow.
   */
  function coverCalendar(composites, point) {
    const pts = [], snow = new Set();
    for (const c of composites) {
      const [y, m, d] = c.date.split("-").map(Number), n = dayNo(y, m, d);
      const winter = m >= 11 || m <= 3;
      const rel = c.reliability === "" || c.reliability === null ? undefined : c.reliability;   // "" = NDVI-only data
      const isSnow = rel === "2" || (rel === undefined && c.ndvi !== null && c.ndvi < 0.05 && winter);
      if (isSnow) { for (let k = 0; k < 16; k++) snow.add(n + k); continue; }
      if (c.ndvi !== null && (rel === undefined || rel === "0" || rel === "1")) pts.push([n, c.ndvi]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    const ndvi = new Map();
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, va] = pts[i], [b, vb] = pts[i + 1], span = b - a;
      for (let k = 0; k < span; k++) ndvi.set(a + k, va + (vb - va) * k / span);
    }
    if (pts.length) ndvi.set(pts[pts.length - 1][0], pts[pts.length - 1][1]);

    const w = point.weather, start = dayNo(w.start[0], w.start[1], w.start[2]);
    const t = (n) => { const v = w.tmean[n - start]; return v === undefined ? null : v; };
    const warm = new Set();
    for (let n = start; n < start + w.tmean.length; n++) {
      let s = 0, c = 0;
      for (let k = -3; k <= 3; k++) { const v = t(n + k); if (v !== null) { s += v; c++; } }
      if (c && s / c >= THRESHOLDS.warm_temp_c) warm.add(n);
    }
    const p = (n) => w.precip[n - start] || 0;

    let mjj = point.may_july_rain;
    if (!mjj) {
      mjj = {};
      const firstW = w.start[0], lastW = ymd(start + w.precip.length - 1)[0];
      for (let y = firstW; y <= lastW; y++) {
        let s = 0, c = 0;
        for (let n = dayNo(y, 5, 1); n <= dayNo(y, 7, 31); n++) if (n - start >= 0 && n - start < w.precip.length) { s += p(n); c++; }
        if (c >= 85) mjj[y] = s;
      }
    }
    const mjjVals = Object.values(mjj);

    const ribbon = {}, years = [];
    if (!pts.length) return { ribbon, years, summary: { likely_fallow_years: [], unclear_years: [], long_green_season_years: [] } };
    const y0 = ymd(pts[0][0])[0], y1 = ymd(pts[pts.length - 1][0])[0];
    for (let y = y0; y <= y1; y++) {
      const a = dayNo(y, 1, 1), b = dayNo(y + 1, 1, 1);
      let row = "";
      for (let n = a; n < b; n++) row += snow.has(n) ? "s" : ndvi.has(n) ? String(Math.min(9, Math.max(0, Math.floor(ndvi.get(n) * 10)))) : ".";
      ribbon[y] = row;
      const season = [];
      for (let n = a; n < b; n++) if (warm.has(n) && !snow.has(n) && ndvi.has(n)) season.push(n);
      if (!season.length) continue;
      const green = season.filter(n => ndvi.get(n) >= THRESHOLDS.green_ndvi).length;
      const bare = season.length - green;
      const summer = [];
      for (let n = dayNo(y, 6, 10); n <= dayNo(y, 8, 20); n++) if (ndvi.has(n)) summer.push(ndvi.get(n));
      const summerMean = summer.length ? summer.reduce((s, v) => s + v, 0) / summer.length : null;
      const complete = ndvi.has(dayNo(y, 6, 10)) && ndvi.has(dayNo(y, 8, 20));
      let status;
      if (summerMean === null || !complete) status = "incomplete year";
      else if (summerMean < THRESHOLDS.fallow_summer_ndvi) status = "likely fallow";
      else if (summerMean < THRESHOLDS.unclear_summer_ndvi) status = "unclear";
      else if (green >= THRESHOLDS.long_season_green_days) status = "long green season";
      else status = "cropped";
      const rain = mjj[y];
      const rank = rain === undefined ? null : 100 * mjjVals.filter(v => v <= rain).length / mjjVals.length;
      years.push({ year: y, status, dry_year: rank !== null && rank <= THRESHOLDS.dry_year_percentile,
                   green_days: green, bare_days: bare, may_july_rain_mm: rain === undefined ? null : Math.round(rain) });
    }
    const full = years.filter(y => y.status !== "incomplete year");
    const summary = {
      years_analysed: full.length,
      likely_fallow_years: full.filter(y => y.status === "likely fallow").map(y => y.year),
      unclear_years: full.filter(y => y.status === "unclear").map(y => y.year),
      long_green_season_years: full.filter(y => y.status === "long green season").map(y => y.year),
      mean_green_days: full.length ? Math.round(full.reduce((s, y) => s + y.green_days, 0) / full.length) : null,
      mean_bare_days: full.length ? Math.round(full.reduce((s, y) => s + y.bare_days, 0) / full.length) : null,
    };
    return { ribbon, years, summary, daily: ndvi };
  }

  /* Season types for a live point: nearest cluster centre found by model/seasons.py. */
  function seasonTypes(daily, clusters) {
    const out = {};
    if (!clusters || !daily || !daily.size) return out;
    const years = new Set(Array.from(daily.keys()).map(n => ymd(n)[0]));
    for (const y of years) {
      const curve = [];
      for (let k = 0; k < 13; k++) curve.push(daily.get(dayNo(y, 4, 7) + 16 * k));
      if (curve.filter(v => v === undefined).length > 2) continue;
      for (let i = 0; i < 13; i++) if (curve[i] === undefined) {
        const j = [...curve.keys()].filter(k => curve[k] !== undefined).sort((a, b) => Math.abs(a - i) - Math.abs(b - i))[0];
        curve[i] = curve[j];
      }
      let best = null, bestD = Infinity;
      for (const c of clusters) {
        const d = c.mean_curve.reduce((s, v, i) => s + (v - curve[i]) ** 2, 0);
        if (d < bestD) { bestD = d; best = c.name; }
      }
      out[y] = best;
    }
    return out;
  }

  // ---------------------------------------------------------------- terrain slope
  /*
   * Elevation from the open Terrain Tiles on AWS (Terrarium encoding), which over this region
   * are built from NASA SRTM. Slope is taken over about 250 m around the point, the size of
   * one MODIS pixel.
   */
  async function fetchSlope(lat, lon) {
    const z = 13, n = 2 ** z;
    const fx = (lon + 180) / 360 * n;
    const fy = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 768;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    await Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(async dy => {
      const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx + dx}/${ty + dy}.png`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const img = await createImageBitmap(await r.blob());
      ctx.drawImage(img, (dx + 1) * 256, (dy + 1) * 256);
    })));
    const px = Math.round((fx - tx + 1) * 256), py = Math.round((fy - ty + 1) * 256);
    const elev = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return d[0] * 256 + d[1] + d[2] / 256 - 32768; };
    const metres = 156543.03392 * Math.cos(lat * Math.PI / 180) / n;
    const k = Math.max(1, Math.round(125 / metres));
    const dzdx = (elev(px + k, py) - elev(px - k, py)) / (2 * k * metres);
    const dzdy = (elev(px, py + k) - elev(px, py - k)) / (2 * k * metres);
    return { slope_pct: 100 * Math.hypot(dzdx, dzdy), elevation_m: elev(px, py) };
  }

  // ---------------------------------------------------------------- NASA GIBS imagery, read pixel by pixel
  /*
   * NASA GIBS serves MODIS and SMAP as coloured map tiles. Each colour stands for one value
   * range in the layer's published colour map, so the colour of a pixel can be turned back
   * into a number. Checked on 14 Nov 2026 against the ORNL MODIS values for the Kostanay field:
   * the decoded NDVI agreed to within 0.005 on six dates.
   */
  const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
  const NDVI_LAYER = "MODIS_Terra_L3_NDVI_16Day", NDVI_Z = 9;
  const SMAP_LAYER = "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", SMAP_Z = 6;
  const table = (text) => new Map(text.split(",").map(s => { const [h, v] = s.split(":"); return [h, +v / 1000]; }));
  // colour -> NDVI, from gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml (bin centres)
  const NDVI_COLOURS = table("f1ecec:3,f1eced:8,efe7e7:13,efe7e8:18,ece2e2:23,ece2e3:28,e2d8d8:33,e2d8d9:38,e1d9d4:43,e1d9d5:48,e0dad2:53,e0dad3:58,ddd5cb:63,ddd5cc:68,e5dbcd:73,e5dbce:78,e1d2c5:83,e1d2c6:88,dfcec1:93,dfcec2:98,ddc9bc:103,ddc9bd:108,d7c4b3:113,d7c4b4:118,d1c0ab:123,d1c0ac:128,cdba9e:133,cdba9f:138,c8b5a5:143,c8b5a6:148,c0b096:153,c0b097:158,b9ab9b:163,b9ab9c:168,b4a595:173,b4a596:178,b09f8e:183,b09f8f:188,b09b89:193,b09b8a:198,b19883:203,b19884:208,b0957d:213,b0957e:218,b09278:223,b09279:228,ac8d73:233,ac8d74:238,a9896e:243,a9896f:248,a58468:253,a58469:258,a18063:263,a18064:268,9d7c5e:273,9d7c5f:278,9a6e59:283,9a6e5a:288,965a46:293,965a47:298,bfde77:304,bfde78:311,b0cf68:319,b0cf69:326,a7cc4b:334,a7cc4c:341,a4c63d:349,a4c63e:356,a0c030:364,a0c031:371,96ba20:379,96ba21:386,8fb715:394,8fb716:401,87b30a:409,87b30b:416,80b005:424,80b006:431,78ad00:439,78ad01:446,6eaa00:454,6eaa01:461,64a600:469,64a601:476,5da300:484,5da301:491,56a100:499,56a101:506,529800:514,529801:521,539700:529,539701:536,4e9400:544,4e9401:551,489000:559,489001:566,438d00:574,438d01:581,3e8a00:589,3e8a01:596,398700:605,398701:615,338300:625,338301:635,2e8000:645,2e8001:655,297d00:665,297d01:675,217800:685,217801:695,1d7500:705,1d7501:715,197300:725,197301:735,126e00:745,126e01:755,0a6900:765,0a6901:775,086700:785,086701:795,056400:805,056401:815,006400:825,006401:835,006000:845,006001:855,005a00:865,005a01:875,005400:885,005401:895,004800:905,004801:915,003c00:925,003c01:935,003600:945,003601:955,002400:965,002401:975,001800:985,001801:995");
  // colour -> soil moisture, m3/m3, from gibs.earthdata.nasa.gov/colormaps/v1.3/SMAP_Analyzed_Soil_Moisture.xml
  const SMAP_COLOURS = table("ffa200:2,ffa500:5,ffa700:7,ffaa00:10,ffac00:13,ffae00:16,ffb100:18,ffb300:20,ffb500:24,ffb800:27,ffba00:29,ffbd00:32,ffbf00:35,ffc100:38,ffc400:40,ffc600:42,ffc800:46,ffcb00:49,ffcd00:51,ffd000:54,ffd200:57,ffd400:60,ffd700:62,ffd900:65,ffdb00:68,ffde00:71,ffe000:73,ffe300:76,ffe500:79,ffe700:82,ffea00:84,ffec00:87,ffee00:90,fff100:93,fff300:95,fff600:98,fff800:101,fff900:104,fffa00:106,fffb00:109,fffd00:112,ffff00:115,fffe00:118,f9fc00:120,f3f900:123,edf600:126,e7f300:129,e1f000:131,dbed00:134,d5ea00:137,d0e700:140,cae400:142,c4e100:145,bede00:148,b8db00:151,b2d800:153,acd500:156,a6d200:159,a0cf00:162,9acc00:164,94c900:167,8ec600:170,88c300:173,82c100:175,7dbe00:178,77bb00:181,71b800:184,6bb500:186,65b200:189,5faf00:192,59ac00:195,53a900:197,4da600:200,47a300:203,41a000:206,3b9d00:208,359a00:211,2f9700:214,2a9400:217,249100:219,1e8e00:222,188b00:225,128800:228,0c8500:230,068200:233,008200:236,008206:239,00850c:242,008813:244,008b19:247,008f1f:250,009225:253,00952c:255,009832:258,009b38:261,009e3e:264,00a144:266,00a44b:269,00a851:272,00ab57:275,00ae5d:277,00b164:280,00b46a:283,00b770:286,00ba76:288,00bd7c:291,00c183:294,00c489:297,00c78f:299,00ca95:302,00cd9b:305,00d0a2:308,00d3a8:310,00d6ae:313,00dab4:316,00ddbb:319,00e0c1:321,00e3c7:324,00e6cd:327,00e9d3:330,00ecda:332,00efe0:335,00f3e6:338,00f6ec:341,00f9f3:343,00fcf9:346,00feff:349,00ffff:352,00fdff:355,00f9ff:357,00f3ff:360,00edff:363,00e7ff:366,00e1ff:368,00dbff:371,00d5ff:374,00d0ff:377,00caff:379,00c4ff:382,00beff:385,00b8ff:388,00b2ff:390,00acff:393,00a6ff:396,00a0ff:399,009aff:401,0094ff:404,008eff:407,0088ff:410,0082ff:412,007dff:415,0077ff:418,0071ff:421,006bff:423,0065ff:426,005fff:429,0059ff:432,0053ff:434,004dff:437,0047ff:440,0041ff:443,003bff:445,0035ff:448,002fff:451,002aff:454,0024ff:456,001eff:459,0018ff:462,0012ff:465,000cff:468,0006ff:470,0000ff:473,0000fb:476,0000f8:479,0000f4:481,0000f1:484,0000ed:487,0000e9:490,0000e6:492,0000e2:495,0000df:498,0000db:500,0000d7:503,0000d4:506,0000d0:508,0000cd:512,0000c9:514,0000c5:517,0000c2:520,0000be:523,0000bb:525,0000b7:528,0000b3:531,0000b0:534,0000ac:536,0000a8:539,0000a5:542,0000a1:545,00009e:547,00009a:550,000096:553,000093:556,00008f:558,00008c:561,000088:564,000084:567,000081:569,00007d:571,00007a:575,000076:577,000072:580,00006f:583,00006b:585,000068:589,000064:591,020264:594,040464:597,060664:599,080864:603,0a0a64:605,0c0c64:607,0e0e64:611,101064:613,121264:616,141464:619,161664:621,181864:625,1a1a64:627,1c1c64:630,1e1e64:633,202064:636,22225a:638,24245a:641,26265a:644,28285a:647,2a2a5a:649,2c2c5a:652,2e2e5a:655,30305a:658,32325a:660,34345a:663,36365a:666,38385a:669,3a3a5a:671,3c3c50:674,3e3e50:677,404050:680,424250:682,444450:685,464650:688,484850:690,4a4a50:693,4c4c50:696,4e4e50:698,505050:700");

  const toPx = (lat, lon, z) => {
    const n = 256 * 2 ** z, r = lat * Math.PI / 180;
    return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
  };
  const toLatLon = (px, py, z) => {
    const n = 256 * 2 ** z;
    return [Math.atan(Math.sinh(Math.PI * (1 - 2 * py / n))) * 180 / Math.PI, px / n * 360 - 180];
  };
  const doyDate = (year, doy) => new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
  const tileUrl = (layer, date, level, z, x, y) =>
    `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/${z}/${y}/${x}.png`;

  const tileCache = new Map();
  function readTile(url) {
    if (!tileCache.has(url)) {
      tileCache.set(url, (async () => {
        const r = await fetch(url);
        if (!r.ok) return null;
        const img = await createImageBitmap(await r.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
        const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(256, 256)
          : Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, 256, 256).data;
      })().catch(() => null));
    }
    return tileCache.get(url);
  }
  const hex = (d, i) => ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, "0");
  /* Exact colour first; if the browser shifted colours slightly, the nearest colour within a small distance. */
  function colourValue(colours, d, i) {
    const h = hex(d, i);
    if (colours.has(h)) return colours.get(h);
    if (!colours._near) colours._near = new Map();
    if (colours._near.has(h)) return colours._near.get(h);
    let best, bestD = 13 * 13 * 3;
    for (const [k, v] of colours) {
      const dr = parseInt(k.slice(0, 2), 16) - d[i], dg = parseInt(k.slice(2, 4), 16) - d[i + 1], db = parseInt(k.slice(4, 6), 16) - d[i + 2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestD) { bestD = dist; best = v; }
    }
    colours._near.set(h, best);
    return best;
  }

  async function gibsPool(tasks, size) {
    let next = 0;
    const out = new Array(tasks.length);
    await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); }
    }));
    return out;
  }

  /*
   * Midsummer NDVI of every pixel in a window around the field, one value per year:
   * the highest of three 16-day MODIS composites (25 June, 11 July, 27 July).
   * GIBS draws MOD13Q1 on a web-map grid of about 180 m at these latitudes.
   */
  const GRID_DOYS = [177, 193, 209];
  async function fetchNdviGrid(lat, lon, lastYear, onProgress, halfPx = 11) {
    const z = NDVI_Z;
    const [cx, cy] = toPx(lat, lon, z);
    const x0 = Math.floor(cx) - halfPx, y0 = Math.floor(cy) - halfPx, size = 2 * halfPx + 1;
    const tiles = [];
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + size - 1) / 256); tx++)
      for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + size - 1) / 256); ty++) tiles.push([tx, ty]);
    const years = [];
    for (let y = 2000; y <= lastYear; y++) years.push(y);
    let done = 0;
    const total = years.length * GRID_DOYS.length;
    const jobs = years.flatMap(year => GRID_DOYS.map(doy => async () => {
      const date = doyDate(year, doy);
      const datas = await Promise.all(tiles.map(([tx, ty]) => readTile(tileUrl(NDVI_LAYER, date, 9, z, tx, ty))));
      done++; if (onProgress) onProgress(done, total, year);
      return { year, datas };
    }));
    const results = await gibsPool(jobs, 8);
    const out = { z, x0, y0, size, centre: [Math.floor(cx) - x0, Math.floor(cy) - y0], years: {} };
    for (const { year, datas } of results) {
      const best = out.years[year] || (out.years[year] = new Array(size * size).fill(null));
      tiles.forEach(([tx, ty], k) => {
        const d = datas[k]; if (!d) return;
        for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
          const gx = x0 + i, gy = y0 + j;
          if (Math.floor(gx / 256) !== tx || Math.floor(gy / 256) !== ty) continue;
          const p = ((gy - ty * 256) * 256 + (gx - tx * 256)) * 4;
          if (d[p + 3] < 128) continue;   // transparent: water or no data
          const v = colourValue(NDVI_COLOURS, d, p);
          if (v !== undefined && (best[j * size + i] === null || v > best[j * size + i])) best[j * size + i] = v;
        }
      });
    }
    for (const y of Object.keys(out.years)) if (out.years[y].every(v => v === null)) delete out.years[y];
    return out;
  }
  /*
   * The whole NDVI history of one pixel from NASA GIBS: every 16-day MOD13Q1 composite since
   * February 2000, newest year first. Same contract as fetchNdvi (ORNL): onChunk gets
   * [{date, ndvi}] after each year. About 600 small images, roughly 25 MB.
   * A transparent pixel means NDVI below zero or no data; in November to March it is read as snow.
   */
  async function readPixel(url, ix, iy) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url);
        if (r.status === 404) return undefined;
        if (!r.ok) throw new Error("HTTP " + r.status);
        const img = await createImageBitmap(await r.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
        const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(256, 256)
          : Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(ix, iy, 1, 1).data;
        if (d[3] < 128) return null;
        const v = colourValue(NDVI_COLOURS, d, 0);
        return v === undefined ? null : v;
      } catch (e) {
        await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
      }
    }
    throw new Error("GIBS did not answer");
  }
  async function fetchNdviGibs(lat, lon, onChunk) {
    const z = NDVI_Z;
    const [px, py] = toPx(lat, lon, z);
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
    const ix = Math.floor(px) - tx * 256, iy = Math.floor(py) - ty * 256;
    const now = new Date(), lastYear = now.getUTCFullYear();
    const years = [];
    for (let y = lastYear; y >= 2000; y--) years.push(y);
    let done = 0, failed = 0;
    await gibsPool(years.map(year => async () => {
      const doys = [];
      for (let doy = 1; doy <= 353; doy += 16) {
        const start = Date.UTC(year, 0, doy);
        if (year === 2000 && doy < 49) continue;
        if (start + 16 * 86400000 > now.getTime() - 10 * 86400000) continue;   // composite not published yet
        doys.push(doy);
      }
      const items = await gibsPool(doys.map(doy => async () => {
        const date = doyDate(year, doy), month = +date.slice(5, 7);
        let v;
        try { v = await readPixel(tileUrl(NDVI_LAYER, date, 9, z, tx, ty), ix, iy); }
        catch (e) { failed++; return null; }
        if (v === undefined) return null;
        if (v === null) return { date, ndvi: month >= 11 || month <= 3 ? -0.05 : null };
        return { date, ndvi: v };
      }), 6);
      done++;
      onChunk(items.filter(Boolean), done, years.length);
    }), 2);
    if (failed > 100) throw new Error("GIBS did not answer");
  }
  function gridCellBounds(grid, i, j) {
    const a = toLatLon(grid.x0 + i, grid.y0 + j, grid.z), b = toLatLon(grid.x0 + i + 1, grid.y0 + j + 1, grid.z);
    return [[b[0], a[1]], [a[0], b[1]]];
  }

  /*
   * SMAP Level-4 root-zone soil moisture (top metre) at the point: the latest day GIBS has,
   * and the same day of the year in every year since 2016 for comparison.
   */
  async function smapAt(lat, lon, date) {
    const [px, py] = toPx(lat, lon, SMAP_Z);
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
    const d = await readTile(tileUrl(SMAP_LAYER, date, 6, SMAP_Z, tx, ty));
    if (!d) return undefined;   // no tile for that day
    const p = ((Math.floor(py) - ty * 256) * 256 + (Math.floor(px) - tx * 256)) * 4;
    if (d[p + 3] < 128) return null;
    const v = colourValue(SMAP_COLOURS, d, p);
    return v === undefined ? null : v;
  }
  async function fetchSmap(lat, lon) {
    const today = new Date();
    let date = null, value;
    for (let back = 2; back <= 12 && date === null; back++) {
      const d = new Date(today.getTime() - back * 86400000).toISOString().slice(0, 10);
      value = await smapAt(lat, lon, d);
      if (value !== undefined) date = d;
    }
    if (date === null || value === null) return null;
    const md = date.slice(4);
    const years = [];
    for (let y = 2016; y < +date.slice(0, 4); y++) years.push(y);
    const past = await gibsPool(years.map(y => async () => ({ year: y, value: await smapAt(lat, lon, y + md) })), 6);
    return { date, value, past: past.filter(p => typeof p.value === "number") };
  }
  const gibsUrl = (layer, date, level) => `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${layer.includes("CorrectedReflectance") ? "jpg" : "png"}`;

  const api = { fetchNdviGibs, fetchNdviGrid, gridCellBounds, fetchSmap, gibsUrl, doyDate, fetchSlope, fetchWeather, buildPoint, fetchNdvi, coverCalendar, seasonTypes, referenceEt, dayNo, THRESHOLDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FallowLive = api;
})(typeof window !== "undefined" ? window : globalThis);
