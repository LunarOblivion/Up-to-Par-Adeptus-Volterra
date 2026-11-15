#!/usr/bin/env python3
"""
Daily soil-water balance for crop rotations, replayed over the real weather of one field.

Method: FAO Irrigation and Drainage Paper 56 (Allen et al., 1998)
  - reference evapotranspiration ETo: FAO Penman-Monteith (Chapters 2-4)
  - crop transpiration and soil evaporation: dual crop coefficient Kcb + Ke (Chapter 7)
  - water stress: Ks from root-zone depletion (Chapter 8)
Additions that are NOT from FAO-56 and are plain assumptions (see ASSUMPTIONS):
  - a degree-day snow model, snow blown off bare fields, snowmelt runoff on frozen soil
  - less evaporation under standing stubble

Input:  data/<point>/power_daily.csv  (NASA POWER daily, written by data_fetch/fetch_data.py)
        model/crops.json              (crop parameters and rotations, with their sources)
Output: data/<point>/water_balance.json and a printed summary

Usage:  python model/water.py data/kostanay

The model does not predict yield in tonnes. It reports how much of the water a crop
wanted it could actually get, and where the rest of the rain went.
"""

import csv
import datetime as dt
import json
import math
import pathlib
import sys

import season  # warm season, wind and rain thresholds shared with cover.py

SOIL = {
    # FAO-56 Annex 8 example soil (silt loam). Replace with local soil data.
    "available_water_mm_per_m": 160.0,
    "profile_depth_m": 1.2,
    "rew_mm": 8.0,    # readily evaporable water
    "tew_mm": 22.0,   # total evaporable water of the 0.10 m surface layer
}

ASSUMPTIONS = {
    "elevation_m": 200.0,              # air pressure only, small effect; used when meta.json has no elevation_m
    "snow_temp_c": 0.0,                # precipitation falls as snow below this mean temperature
    "melt_mm_per_degree_day": 3.0,     # degree-day snowmelt factor
    "snow_kept_on_stubble": 1.0,       # share of snowfall that stays on a field with stubble
    "snow_kept_on_bare_fallow": 0.7,   # share that stays on a bare tilled fallow (rest is blown off)
    "melt_infiltration": 0.8,          # share of snowmelt that enters the soil (rest runs off frozen ground)
    "stubble_evaporation_factor": 0.75,  # FAO-56 ch.10: about 5 % less evaporation per 10 % residue cover; 50 % cover assumed
    "kc_max": 1.2,
    "kcb_min": 0.15,
    "initial_root_depth_m": 0.15,
    "spinup_years": 6,                 # years simulated before results are kept
    "severe_stress": 0.5,              # a crop that got less than half of its water demand
}

SIGMA = 4.903e-9  # Stefan-Boltzmann, MJ K-4 m-2 day-1


# ------------------------------------------------------------------ weather

def load_weather(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            item = {"date": dt.date.fromisoformat(row["date"])}
            for key, value in row.items():
                if key != "date":
                    item[key] = float(value) if value != "" else None
            rows.append(item)
    return rows


def sat_vapour_pressure(temp_c):
    return 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))


def extraterrestrial_radiation(lat_deg, day_of_year):
    """Ra in MJ m-2 day-1 (FAO-56 eq. 21)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * day_of_year / 365)
    delta = 0.409 * math.sin(2 * math.pi * day_of_year / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(delta))))
    return (24 * 60 / math.pi) * 0.0820 * dr * (
        ws * math.sin(phi) * math.sin(delta) + math.cos(phi) * math.cos(delta) * math.sin(ws))


def reference_et(day, lat_deg, elevation_m):
    """FAO Penman-Monteith ETo, mm/day (FAO-56 eq. 6). Returns (eto, radiation_was_estimated)."""
    tmax, tmin, tmean = day["T2M_MAX"], day["T2M_MIN"], day["T2M"]
    if None in (tmax, tmin, tmean):
        return 0.0, False
    u2 = day["WS2M"] if day["WS2M"] is not None else 2.0
    rh = day["RH2M"] if day["RH2M"] is not None else 60.0
    ra = extraterrestrial_radiation(lat_deg, day["date"].timetuple().tm_yday)
    rs = day["ALLSKY_SFC_SW_DWN"]
    estimated = rs is None
    if estimated:  # Hargreaves radiation formula, FAO-56 eq. 50, interior location
        rs = 0.16 * math.sqrt(max(tmax - tmin, 0.0)) * ra

    pressure = 101.3 * ((293 - 0.0065 * elevation_m) / 293) ** 5.26
    gamma = 0.000665 * pressure
    delta = 4098 * sat_vapour_pressure(tmean) / (tmean + 237.3) ** 2
    es = (sat_vapour_pressure(tmax) + sat_vapour_pressure(tmin)) / 2
    ea = rh / 100 * es

    rso = (0.75 + 2e-5 * elevation_m) * ra
    rns = 0.77 * rs
    ratio = min(rs / rso, 1.0) if rso > 0 else 0.5
    rnl = (SIGMA * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2
           * (0.34 - 0.14 * math.sqrt(max(ea, 0.0))) * (1.35 * ratio - 0.35))
    rn = rns - rnl
    eto = (0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)) / (
        delta + gamma * (1 + 0.34 * u2))
    return max(eto, 0.0), estimated


# -------------------------------------------------------------------- crops

def crop_state(crop, sow_date, day):
    """Kcb, root depth and stage for a crop on a given day; None outside its season."""
    age = (day - sow_date).days
    l_ini, l_dev, l_mid, l_late = crop["stages_days"]
    total = l_ini + l_dev + l_mid + l_late
    if age < 0 or age >= total:
        return None
    k_ini, k_mid, k_end = crop["kcb"]
    if age < l_ini:
        kcb = k_ini
    elif age < l_ini + l_dev:
        kcb = k_ini + (k_mid - k_ini) * (age - l_ini) / l_dev
    elif age < l_ini + l_dev + l_mid:
        kcb = k_mid
    else:
        kcb = k_mid + (k_end - k_mid) * (age - l_ini - l_dev - l_mid) / l_late
    grow = min(1.0, age / (l_ini + l_dev))
    root = ASSUMPTIONS["initial_root_depth_m"] + (crop["root_depth_m"] - ASSUMPTIONS["initial_root_depth_m"]) * grow
    return {"kcb": kcb, "root_m": root}


def sow_date(crop, year):
    month, day = (int(part) for part in crop["sow"].split("-"))
    return dt.date(year, month, day)


def harvest_date(crop, year):
    """First day after the crop's last stage: the model's harvest."""
    return sow_date(crop, year) + dt.timedelta(days=sum(crop["stages_days"]))


# --------------------------------------------------------------- simulation

LAYER_M = 0.1  # the soil profile is split into layers of this thickness


class Profile:
    """Plant-available water of the soil profile, kept in thin layers.

    Water enters from the top and fills layer after layer; what does not fit drains
    below the profile. Roots take water only from the layers they have reached, so a
    shallow-rooted crop leaves deep water for the next crop, and after winter the top
    of the profile is wet even when the subsoil is still dry.
    """

    def __init__(self, available_mm_per_m, depth_m, fill=0.5):
        count = round(depth_m / LAYER_M)
        self.capacity = available_mm_per_m * LAYER_M
        self.layers = [self.capacity * fill] * count

    def total(self):
        return sum(self.layers)

    def add(self, water):
        """Infiltrate from the top; returns deep drainage."""
        for i in range(len(self.layers)):
            take = min(self.capacity - self.layers[i], water)
            self.layers[i] += take
            water -= take
            if water <= 0:
                return 0.0
        return water

    def _shares(self, depth_m):
        """Fraction of each layer that lies above depth_m."""
        return [min(1.0, max(0.0, depth_m / LAYER_M - i)) for i in range(len(self.layers))]

    def in_root_zone(self, depth_m):
        return sum(w * f for w, f in zip(self.layers, self._shares(depth_m)))

    def take(self, amount, depth_m):
        """Remove water from the layers above depth_m, in proportion to what each holds."""
        shares = self._shares(depth_m)
        available = [w * f for w, f in zip(self.layers, shares)]
        total = sum(available)
        if total <= 0 or amount <= 0:
            return 0.0
        amount = min(amount, total)
        for i, part in enumerate(available):
            self.layers[i] -= amount * part / total
        return amount

    def take_from_top(self, amount, layers=2):
        """Evaporation: from the first layer, then the second."""
        taken = 0.0
        for i in range(layers):
            part = min(self.layers[i], amount - taken)
            self.layers[i] -= part
            taken += part
        return taken


# Water flows summed over the window from one harvest to the next sowing.
WINDOW_FLUXES = ("transpiration_mm", "evaporation_mm", "deep_drainage_mm", "snow_blown_mm", "melt_runoff_mm")

WINDOW_SHARES = {"evaporated_from_soil": "evaporation_mm", "drained_below_profile": "deep_drainage_mm",
                 "snow_blown_off": "snow_blown_mm", "snowmelt_runoff": "melt_runoff_mm",
                 "transpired": "transpiration_mm"}

COVER_FIELDS = ("season_days", "green_cover_days", "bare_days", "bare_fallow_days", "bare_stubble_days",
                "bare_windy_days", "bare_heavy_rain_days", "fallow_windy_days", "fallow_heavy_rain_days")


def simulate(weather, eto, sequence, phase, crops, first_year, warm=None, observer=None):
    """Run one rotation in one phase. Returns a list of yearly records.

    warm: set of warm-season dates (season.warm_days); computed from the weather when None.
    observer: optional function(date, layers, layer_capacity, snowpack) called at the end of every day,
              used by the tests to check the soil store.
    """
    aw = SOIL["available_water_mm_per_m"]
    tew, rew = SOIL["tew_mm"], SOIL["rew_mm"]
    a = ASSUMPTIONS
    if warm is None:
        warm = season.warm_days([d["date"] for d in weather], [d["T2M"] for d in weather])

    soil = Profile(aw, SOIL["profile_depth_m"])
    surface = tew                   # depletion of the evaporation layer, mm (FAO-56 De)
    snowpack = 0.0
    records = {}
    # Water stored at the last harvest and rain and snow since then: the window from the
    # harvest of one crop to the sowing of the next (it spans the whole fallow year after a fallow).
    last_harvest_water, precip_since_harvest = None, 0.0
    # Where the rain and snow of that window went: running totals at the last harvest.
    at_harvest, snow_at_harvest = None, 0.0

    def running_totals():
        return {f: sum(r[f] for r in records.values()) for f in WINDOW_FLUXES}

    for index, day in enumerate(weather):
        date = day["date"]
        year = date.year
        land_use = sequence[(year - first_year + phase) % len(sequence)]
        previous_use = sequence[(year - 1 - first_year + phase) % len(sequence)]
        record = records.setdefault(year, {
            "year": year, "land_use": land_use, "previous": previous_use,
            "rain_snow_mm": 0.0, "transpiration_mm": 0.0, "demand_mm": 0.0,
            "evaporation_mm": 0.0, "deep_drainage_mm": 0.0, "snow_blown_mm": 0.0,
            "melt_runoff_mm": 0.0, "water_at_sowing_mm": None, "water_at_sowing_0_100_cm_mm": None,
            "water_on_may_1_mm": None,
            "water_on_sep_15_mm": None, "water_at_harvest_mm": None,
            "water_at_previous_harvest_mm": None, "precip_since_previous_harvest_mm": None,
            "soil_end_mm": None, "snow_end_mm": None,
            **{field: 0 for field in COVER_FIELDS},
            **{"window_" + field: None for field in WINDOW_FLUXES},
            "window_snow_change_mm": None,
        })

        precip = day["PRECTOTCORR"] or 0.0
        tmean = day["T2M"] if day["T2M"] is not None else 0.0
        record["rain_snow_mm"] += precip

        crop = crops.get(land_use)
        state = crop_state(crop, sow_date(crop, year), date) if crop else None

        # Is the surface bare tilled fallow right now? From 1 June of the fallow year
        # (first tillage) until the next crop is sown.
        fallow_bare = (land_use == "fallow" and (date.month, date.day) >= (6, 1)) or \
                      (previous_use == "fallow" and state is None and date.month < 6)

        stored = soil.total()
        if crop and date == sow_date(crop, year):
            record["water_at_sowing_mm"] = stored
            record["water_at_sowing_0_100_cm_mm"] = soil.in_root_zone(1.0)  # the 1 m layer trials usually report
            if last_harvest_water is not None:
                record["water_at_previous_harvest_mm"] = last_harvest_water
                record["precip_since_previous_harvest_mm"] = precip_since_harvest
                now = running_totals()
                for field in WINDOW_FLUXES:
                    record["window_" + field] = now[field] - at_harvest[field]
                record["window_snow_change_mm"] = snowpack - snow_at_harvest
        if crop and date == harvest_date(crop, year):
            record["water_at_harvest_mm"] = stored
            last_harvest_water, precip_since_harvest = stored, 0.0
            at_harvest, snow_at_harvest = running_totals(), snowpack
        precip_since_harvest += precip
        if (date.month, date.day) == (5, 1):
            record["water_on_may_1_mm"] = stored
        if (date.month, date.day) == (9, 15):
            record["water_on_sep_15_mm"] = stored

        # --- snow
        water_in = 0.0
        if tmean < a["snow_temp_c"]:
            kept = a["snow_kept_on_bare_fallow"] if fallow_bare else a["snow_kept_on_stubble"]
            snowpack += precip * kept
            record["snow_blown_mm"] += precip * (1 - kept)
        else:
            water_in += precip
            if snowpack > 0:
                melt = min(snowpack, a["melt_mm_per_degree_day"] * tmean)
                snowpack -= melt
                water_in += melt * a["melt_infiltration"]
                record["melt_runoff_mm"] += melt * (1 - a["melt_infiltration"])

        record["deep_drainage_mm"] += soil.add(water_in)
        surface = max(0.0, surface - water_in)

        # --- living cover: warm-season days without snow on the ground, as MODIS sees them in cover.py
        if date in warm and snowpack <= 0:
            record["season_days"] += 1
            if state and state["kcb"] > a["kcb_min"]:
                record["green_cover_days"] += 1
            else:
                # bare of living plants: tilled fallow, or stubble / seedbed / young crop
                record["bare_days"] += 1
                record["bare_fallow_days" if fallow_bare else "bare_stubble_days"] += 1
                windy, heavy = season.is_windy(day["WS2M"]), season.is_heavy_rain(day["PRECTOTCORR"])
                record["bare_windy_days"] += windy
                record["bare_heavy_rain_days"] += heavy
                if fallow_bare:
                    record["fallow_windy_days"] += windy
                    record["fallow_heavy_rain_days"] += heavy

        frozen = snowpack > 0 or tmean < 0
        eto_day = 0.0 if frozen else eto[index]

        # --- transpiration (FAO-56 ch. 7 and 8)
        kcb = state["kcb"] if state else 0.0
        transpiration = demand = 0.0
        if state:
            root = min(state["root_m"], SOIL["profile_depth_m"])
            taw_root = aw * root
            depletion = taw_root - soil.in_root_zone(root)
            demand = kcb * eto_day
            p = min(0.8, max(0.1, crop["p"] + 0.04 * (5 - demand)))
            raw = p * taw_root
            ks = 1.0 if depletion <= raw else max(0.0, (taw_root - depletion) / ((1 - p) * taw_root))
            transpiration = soil.take(ks * demand, root)

        # --- soil evaporation (FAO-56 ch. 7)
        height = crop["height_m"] if crop else 0.0
        cover = 0.0
        if state and kcb > a["kcb_min"]:
            cover = ((kcb - a["kcb_min"]) / (a["kc_max"] - a["kcb_min"])) ** (1 + 0.5 * height)
        exposed = max(0.01, 1 - min(cover, 0.99))
        kr = 1.0 if surface <= rew else max(0.0, (tew - surface) / (tew - rew))
        ke = min(kr * (a["kc_max"] - kcb), exposed * a["kc_max"])
        evaporation = ke * eto_day
        if state is None and not fallow_bare:
            evaporation *= a["stubble_evaporation_factor"]
        evaporation = soil.take_from_top(evaporation)
        surface = min(tew, surface + evaporation / exposed)

        record["transpiration_mm"] += transpiration
        record["demand_mm"] += demand
        record["evaporation_mm"] += evaporation
        record["soil_end_mm"] = soil.total()
        record["snow_end_mm"] = snowpack
        if observer:
            observer(date, soil.layers, soil.capacity, snowpack)

    return [records[year] for year in sorted(records)]


def summarise(rotation_runs, keep_from, keep_to):
    """Average the phases of one rotation over the kept years."""
    rows = [r for run in rotation_runs for r in run if keep_from <= r["year"] <= keep_to]
    crop_rows = [r for r in rows if r["land_use"] != "fallow" and r["demand_mm"] > 0]
    total_rain = sum(r["rain_snow_mm"] for r in rows)

    def mean(values):
        values = [v for v in values if v is not None]
        return sum(values) / len(values) if values else None

    def satisfaction(r):
        return r["transpiration_mm"] / r["demand_mm"]

    by_crop = {}
    for r in crop_rows:
        key = f"{r['land_use']} after {r['previous']}"
        by_crop.setdefault(key, []).append(r)

    def storage(previous_use, crop="wheat"):
        """Soil water gained from the harvest of the previous crop to the sowing of `crop` after
        `previous_use`, and the share of rain and snow in that window that stayed in the soil
        (precipitation storage efficiency). For a fallow the window covers the whole fallow year."""
        items = []
        for r in rows:
            if r["previous"] != previous_use or r["land_use"] != crop or r["year"] - 1 < keep_from:
                continue
            start, end = r["water_at_previous_harvest_mm"], r["water_at_sowing_mm"]
            rain = r["precip_since_previous_harvest_mm"]
            if start is None or end is None or not rain:
                continue
            share = {name: 100 * (r["window_" + field] or 0.0) / rain for name, field in WINDOW_SHARES.items()}
            share["snow_left_on_the_ground"] = 100 * (r["window_snow_change_mm"] or 0.0) / rain
            items.append({"year": r["year"] - 1 if previous_use == "fallow" else r["year"],
                          "gain_mm": end - start, "start_mm": start, "precip_mm": rain,
                          "efficiency_pct": 100 * (end - start) / rain, "share": share})
        if not items:
            return None
        lowest = min(items, key=lambda item: item["gain_mm"])
        return {
            "window": "harvest of the previous crop to sowing",
            "count": len(items),
            "mean_gain_mm": mean([i["gain_mm"] for i in items]),
            "min_gain_mm": lowest["gain_mm"],
            "max_gain_mm": max(i["gain_mm"] for i in items),
            "min_gain_year": lowest["year"],
            "min_gain_start_mm": lowest["start_mm"],
            "mean_precip_mm": mean([i["precip_mm"] for i in items]),
            "storage_efficiency_pct": {
                "mean": mean([i["efficiency_pct"] for i in items]),
                "min": min(i["efficiency_pct"] for i in items),
                "max": max(i["efficiency_pct"] for i in items),
            },
            # Where the rain and snow of the window went, % of it (mean over the windows; adds up to 100
            # together with storage_efficiency_pct.mean).
            "where_it_went_pct": {name: mean([i["share"][name] for i in items]) for name in items[0]["share"]},
        }

    fallow = storage("fallow")
    if fallow:
        fallow["fallow_years"] = fallow["count"]

    # Extra soil water at wheat sowing after a fallow, compared with wheat after wheat (stubble), the same year.
    # In a rotation with both, every year has one field of each, so the difference is a same-weather comparison.
    advantage = None
    after_fallow = {r["year"]: r for r in rows if r["land_use"] == "wheat" and r["previous"] == "fallow"}
    after_wheat = {r["year"]: r for r in rows if r["land_use"] == "wheat" and r["previous"] == "wheat"}
    common = sorted(set(after_fallow) & set(after_wheat))
    if common:
        by_year = {str(y): {
            "cm120": after_fallow[y]["water_at_sowing_mm"] - after_wheat[y]["water_at_sowing_mm"],
            "cm100": after_fallow[y]["water_at_sowing_0_100_cm_mm"] - after_wheat[y]["water_at_sowing_0_100_cm_mm"],
        } for y in common}
        advantage = {
            "mean_cm120": mean([v["cm120"] for v in by_year.values()]),
            "mean_cm100": mean([v["cm100"] for v in by_year.values()]),
            "by_year": by_year,
        }

    # Living-cover days a year, averaged over all phases and kept years (same definition as cover.py).
    cover = {field: mean([r[field] for r in rows]) for field in COVER_FIELDS}
    fallow_rows = [r for r in rows if r["land_use"] == "fallow"]
    if fallow_rows:
        # One whole fallow period (tilled from 1 June to the next sowing), per fallow.
        cover["per_fallow"] = {
            field: sum(r[field] for r in rows) / len(fallow_rows)
            for field in ("bare_fallow_days", "fallow_windy_days", "fallow_heavy_rain_days")
        }

    return {
        "years": [keep_from, keep_to],
        "crop_years_per_10": 10 * len(crop_rows) / len(rows),
        "water_use": {
            "rain_and_snow_mm_per_year": total_rain / len(rows),
            "through_crops_pct": 100 * sum(r["transpiration_mm"] for r in rows) / total_rain,
            "soil_evaporation_pct": 100 * sum(r["evaporation_mm"] for r in rows) / total_rain,
            "deep_drainage_pct": 100 * sum(r["deep_drainage_mm"] for r in rows) / total_rain,
            "snow_blown_off_pct": 100 * sum(r["snow_blown_mm"] for r in rows) / total_rain,
            "melt_runoff_pct": 100 * sum(r["melt_runoff_mm"] for r in rows) / total_rain,
        },
        "mean_demand_met_pct": 100 * mean([satisfaction(r) for r in crop_rows]),
        "severe_stress_crop_years_pct": 100 * sum(
            1 for r in crop_rows if satisfaction(r) < ASSUMPTIONS["severe_stress"]) / len(crop_rows),
        "by_crop": {
            key: {
                "crop_years": len(items),
                "demand_met_pct": 100 * mean([satisfaction(r) for r in items]),
                "severe_stress_pct": 100 * sum(
                    1 for r in items if satisfaction(r) < ASSUMPTIONS["severe_stress"]) / len(items),
                "water_at_sowing_mm": mean([r["water_at_sowing_mm"] for r in items]),
                "water_at_sowing_0_100_cm_mm": mean([r["water_at_sowing_0_100_cm_mm"] for r in items]),
                "transpiration_mm": mean([r["transpiration_mm"] for r in items]),
            } for key, items in sorted(by_crop.items())
        },
        "cover": cover,
        "fallow": fallow,
        "fallow_advantage_at_wheat_sowing_mm": advantage,
        # The same window over a winter on wheat stubble, to compare with the fallow.
        "after_wheat_storage": storage("wheat"),
    }


def run_point(folder, config_path=None, keep_from=2000):
    folder = pathlib.Path(folder)
    config_path = config_path or pathlib.Path(__file__).resolve().parent / "crops.json"
    config = json.loads(pathlib.Path(config_path).read_text(encoding="utf-8"))
    crops, rotations = config["crops"], config["rotations"]

    meta_file = folder / "meta.json"
    meta = json.loads(meta_file.read_text(encoding="utf-8")) if meta_file.exists() else {}
    lat = meta.get("lat")
    if lat is None:
        sys.exit(f"{meta_file} has no latitude; run data_fetch/fetch_data.py first")
    elevation = meta.get("elevation_m")
    if elevation is None:
        elevation = ASSUMPTIONS["elevation_m"]
    crops = with_sow_dates(crops, meta.get("sow_dates"))

    weather = load_weather(folder / "power_daily.csv")
    first_sim_year = keep_from - ASSUMPTIONS["spinup_years"]
    weather = [d for d in weather if d["date"].year >= first_sim_year]
    last_full_year = weather[-1]["date"].year - (0 if (weather[-1]["date"].month, weather[-1]["date"].day) >= (9, 30) else 1)

    eto, estimated_days = [], 0
    for day in weather:
        value, estimated = reference_et(day, lat, elevation)
        eto.append(value)
        estimated_days += estimated

    warm = season.warm_days([d["date"] for d in weather], [d["T2M"] for d in weather])

    eto_by_year = {}
    rain_by_year = {}
    for day, value in zip(weather, eto):
        eto_by_year[day["date"].year] = eto_by_year.get(day["date"].year, 0.0) + value
        rain_by_year[day["date"].year] = rain_by_year.get(day["date"].year, 0.0) + (day["PRECTOTCORR"] or 0.0)

    # Yearly climate means use complete calendar years only: the last year of POWER data
    # usually stops a few weeks before today, and its missing winter would lower the mean.
    last_day = weather[-1]["date"]
    last_calendar_year = last_day.year if (last_day.month, last_day.day) == (12, 31) else last_day.year - 1
    climate_years = [y for y in range(keep_from, min(last_full_year, last_calendar_year) + 1)]

    # The driest May-July seasons of the kept years: the stress test on the page.
    mjj = season.may_july_rain([d["date"] for d in weather], [d["PRECTOTCORR"] for d in weather])
    mjj = {year: total for year, total in mjj.items() if keep_from <= year <= last_full_year}
    worst = sorted(mjj, key=lambda year: (mjj[year], year))[:3]

    result = {
        "point": meta,
        "elevation_m_used": elevation,
        "sow_dates_used": {name: params["sow"] for name, params in crops.items()},
        "soil": SOIL,
        "assumptions": ASSUMPTIONS,
        "climate": {
            "years": [keep_from, last_full_year],
            "mean_years": [climate_years[0], climate_years[-1]],
            "data_end": last_day.isoformat(),
            "partial_years": [y for y in range(keep_from, last_full_year + 1) if y not in climate_years],
            "mean_eto_mm_per_year": sum(eto_by_year[y] for y in climate_years) / len(climate_years),
            "mean_rain_snow_mm_per_year": sum(rain_by_year[y] for y in climate_years) / len(climate_years),
            "mean_air_temperature_c": mean_of([d["T2M"] for d in weather if d["date"].year in climate_years]),
            "days_with_estimated_radiation": estimated_days,
            "may_july_rain_mm": {str(year): round(total, 1) for year, total in sorted(mjj.items())},
            "worst_years": worst,
        },
        "rotations": {},
    }
    for key, rotation in rotations.items():
        runs = [simulate(weather, eto, rotation["sequence"], phase, crops, first_sim_year, warm=warm)
                for phase in range(len(rotation["sequence"]))]
        summary = summarise(runs, keep_from, last_full_year)
        summary["label"] = rotation["label"]
        summary["short"] = rotation.get("short", rotation["label"])
        summary["sequence"] = rotation["sequence"]
        summary["by_year"] = by_year(runs, keep_from, last_full_year)
        # Every phase, every kept year: the full record behind the averages (not embedded in the page).
        summary["yearly_by_phase"] = [
            [{k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()}
             for r in run if keep_from <= r["year"] <= last_full_year]
            for run in runs
        ]
        result["rotations"][key] = summary
        if key == "A_current":
            result["gwetroot_check"] = gwetroot_check(weather, runs, keep_from, last_full_year)
    return result


def mean_of(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def pearson(xs, ys):
    """Pearson correlation of two equal-length lists; None when undefined."""
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0 or syy <= 0:
        return None
    return sxy / math.sqrt(sxx * syy)


def ranks(values):
    """Ranks 1..n, ties get their mean rank (for the Spearman correlation)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    result = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            result[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return result


# Independent check of the soil-water store against NASA POWER root-zone soil wetness (GWETROOT, 0..1).
# GWETROOT describes a grid cell of tens of kilometres with its own soil and layer depth, so only the
# year-to-year ups and downs are compared (correlation and ranks), never the absolute values.
GWETROOT_DATES = {"may_1": ((5, 1), "water_on_may_1_mm"), "sep_15": ((9, 15), "water_on_sep_15_mm")}
GWETROOT_HALF_WINDOW_DAYS = 3   # weekly mean of GWETROOT around the date


def gwetroot_check(weather, runs, keep_from, keep_to):
    """Model soil water (0-120 cm, mean over the phases) against GWETROOT on 1 May and 15 September."""
    wetness = {d["date"]: d.get("GWETROOT") for d in weather}
    result = {"rotation_phases": len(runs), "window_days": 2 * GWETROOT_HALF_WINDOW_DAYS + 1, "dates": {}}
    for name, ((month, day), field) in GWETROOT_DATES.items():
        years, model, power = [], [], []
        for year in range(keep_from, keep_to + 1):
            values = [r[field] for run in runs for r in run if r["year"] == year and r[field] is not None]
            centre = dt.date(year, month, day)
            week = [wetness.get(centre + dt.timedelta(days=k))
                    for k in range(-GWETROOT_HALF_WINDOW_DAYS, GWETROOT_HALF_WINDOW_DAYS + 1)]
            week = [w for w in week if w is not None]
            if len(values) == len(runs) and len(week) >= GWETROOT_HALF_WINDOW_DAYS + 2:
                years.append(year)
                model.append(sum(values) / len(values))
                power.append(sum(week) / len(week))
        if len(years) < 5:
            result["dates"][name] = None
            continue

        def extreme(series, wettest):
            return sorted(years, key=lambda y: series[years.index(y)], reverse=wettest)[:3]

        dry_m, dry_p = extreme(model, False), extreme(power, False)
        wet_m, wet_p = extreme(model, True), extreme(power, True)
        result["dates"][name] = {
            "years": years,
            "model_mm": [round(v, 1) for v in model],
            "gwetroot": [round(v, 3) for v in power],
            "pearson_r": pearson(model, power),
            "spearman_rho": pearson(ranks(model), ranks(power)),
            "driest_model": dry_m, "driest_power": dry_p, "driest_common": sorted(set(dry_m) & set(dry_p)),
            "wettest_model": wet_m, "wettest_power": wet_p, "wettest_common": sorted(set(wet_m) & set(wet_p)),
        }
    return result


def with_sow_dates(crops, sow_dates):
    """Crop parameters with the sowing dates of one point ({"wheat": "05-05", ...}) put in place."""
    if not sow_dates:
        return crops
    crops = {name: dict(params) for name, params in crops.items()}
    for name, sow in sow_dates.items():
        if name not in crops:
            raise ValueError(f"sow_dates: unknown crop '{name}' (known: {', '.join(sorted(crops))})")
        month, day = (int(part) for part in sow.split("-"))
        dt.date(2001, month, day)  # raises on an impossible date such as 02-30
        crops[name]["sow"] = sow
    return crops


def by_year(runs, keep_from, keep_to):
    """One record per calendar year, averaged over the phases of the rotation.

    Every phase is a field that is at a different point of the rotation in the same weather,
    so a year's average describes a farm that runs the rotation on all its fields at once.
    """
    items = []
    for year in range(keep_from, keep_to + 1):
        rows = [r for run in runs for r in run if r["year"] == year]
        crops = [r for r in rows if r["land_use"] != "fallow" and r["demand_mm"] > 0]
        wheat = [r for r in crops if r["land_use"] == "wheat"]

        def met(items_):
            return None if not items_ else 100 * sum(r["transpiration_mm"] / r["demand_mm"] for r in items_) / len(items_)

        items.append({
            "year": year,
            "fields": len(rows),
            "crops": len(crops),
            "demand_met_pct": met(crops),
            "wheat_demand_met_pct": met(wheat),
            "severe_stress_crops": sum(1 for r in crops if r["transpiration_mm"] / r["demand_mm"] < ASSUMPTIONS["severe_stress"]),
            "transpiration_mm": sum(r["transpiration_mm"] for r in rows) / len(rows),
            "green_cover_days": sum(r["green_cover_days"] for r in rows) / len(rows),
            "bare_fallow_days": sum(r["bare_fallow_days"] for r in rows) / len(rows),
        })
    return items


def print_summary(result):
    c = result["climate"]
    print(f"Years {c['years'][0]}-{c['years'][1]}: rain and snow {c['mean_rain_snow_mm_per_year']:.0f} mm/year, "
          f"reference evapotranspiration {c['mean_eto_mm_per_year']:.0f} mm/year")
    print()
    print(f"{'rotation':<48}{'crops/10y':>10}{'via crops':>10}{'evapor.':>9}{'drain':>7}{'snow off':>9}{'runoff':>8}{'need met':>9}{'severe':>8}")
    for rotation in result["rotations"].values():
        w = rotation["water_use"]
        print(f"{rotation['label']:<48}{rotation['crop_years_per_10']:>10.1f}{w['through_crops_pct']:>9.0f}%"
              f"{w['soil_evaporation_pct']:>8.0f}%{w['deep_drainage_pct']:>6.0f}%{w['snow_blown_off_pct']:>8.0f}%"
              f"{w['melt_runoff_pct']:>7.0f}%{rotation['mean_demand_met_pct']:>8.0f}%{rotation['severe_stress_crop_years_pct']:>7.0f}%")
    print()
    for rotation in result["rotations"].values():
        print(rotation["label"])
        for key, item in rotation["by_crop"].items():
            print(f"    {key:<26} water at sowing {item['water_at_sowing_mm']:>4.0f} mm, "
                  f"need met {item['demand_met_pct']:>3.0f}%, transpired {item['transpiration_mm']:>4.0f} mm")
        if rotation["fallow"]:
            f = rotation["fallow"]
            print(f"    fallow year: soil water gained from the previous harvest to the next sowing "
                  f"{f['mean_gain_mm']:.0f} mm on average (range {f['min_gain_mm']:.0f} to {f['max_gain_mm']:.0f})")


def write_result(folder, result):
    out_file = pathlib.Path(folder) / "water_balance.json"
    with open(out_file, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(result, indent=2, ensure_ascii=False))
    return out_file


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python model/water.py data/<point>")
    folder = pathlib.Path(sys.argv[1])
    result = run_point(folder)
    print_summary(result)
    print(f"-> {write_result(folder, result)}")


if __name__ == "__main__":
    main()
