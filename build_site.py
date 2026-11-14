#!/usr/bin/env python3
"""
Build the web tool: one self-contained HTML file, docs/index.html.

AI assistance: drafted with an AI model (Claude, Anthropic) and reviewed by the team.

  python build_site.py          # normally run by python run_all.py

Reads, for every field in data_fetch/points.json that has been processed:
  power_daily.csv, ndvi_16day.csv, meta.json      (data_fetch/fetch_data.py)
  cover_calendar.json                             (model/cover.py)
  water_balance.json                              (model/water.py)
  season_types.json                               (model/seasons.py)
and model/crops.json, model/validation.json, then inlines web/style.css, web/vendor/leaflet,
web/model.js, web/live.js, web/app.js and the data into web/template.html.

Two kinds of numbers end up on the page:
  * the interactive part (rotation builder, climate sliders, money) is computed in the browser
    by web/model.js from the daily weather embedded here; tests/parity.js keeps it equal to water.py;
  * the evidence part (living cover, fallow window, checks against the Shortandy trial and
    NASA POWER GWETROOT) comes from model/water.py for the default soil and sowing dates.

The page loads nothing from the internet to work: Leaflet is inlined, fonts fall back to system
fonts, and the map falls back to a drawn sketch when map tiles cannot be loaded. Live NASA data
for any clicked point is an extra that needs the internet.

Writes docs/index.html and, for the JavaScript tests only, build/data.json (not published).

Interface and browser model: Up To Para version by LunarOblivion; merged with the Fallow Audit
evidence part.
"""

import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "model"))

import cover  # noqa: E402
import water  # noqa: E402

PROJECT_NAME = "Up To Para"   # the team is still choosing the name; change it here only
FIRST_SIM_YEAR = 2000 - water.ASSUMPTIONS["spinup_years"]
MODEL_DEPTH_CM = 120          # water.SOIL profile_depth_m
AUTUMN = ((9, 15), (11, 4))   # window for root-zone wetness; rain counted from 1 September
LABELS = {"kostanay": "Kostanay Region", "shortandy": "Shortandy, Akmola Region", "north_kz": "North Kazakhstan Region",
          "taiynsha": "Taiynsha, North Kazakhstan Region", "pavlodar": "Voznesenka, Pavlodar Region",
          "osakarovka": "Osakarovka, Karaganda Region", "ubagan": "Ubagan, Kostanay Region", "esil": "Esil, Akmola Region"}


# ------------------------------------------------------------------ helpers

def write_lf(path, text):
    """LF line endings on every OS, so the page is byte-reproducible."""
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def columns(records, digits=1):
    """[{year: 2000, x: 1.234}, ...] -> {year: [2000, ...], x: [1.2, ...]}: a smaller page."""
    if not records:
        return {}
    return {key: [round(r[key], digits) if isinstance(r[key], float) else r[key] for r in records]
            for key in records[0]}


def rounded(value, digits=2):
    """Round every float in a nested structure."""
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, dict):
        return {k: rounded(v, digits) for k, v in value.items()}
    if isinstance(value, list):
        return [rounded(v, digits) for v in value]
    return value


# ------------------------------------------------------------------ checks against the Shortandy trial

def model_value(water_data, spec):
    """A model number by its path in water_balance.json; with 'years' and 'key', the mean over those years."""
    value = water_data
    for part in spec["path"]:
        value = value.get(part) if isinstance(value, dict) else None
    if value is not None and "years" in spec:
        first, last = spec["years"]
        items = [value[str(y)][spec["key"]] for y in range(first, last + 1) if str(y) in value]
        value = sum(items) / len(items) if items else None
    return None if value is None else round(value, 1)


def validation_rows(water_data, spec):
    """Model against the published trial (model/validation.json, 'comparisons'). Nothing is invented:
    a range is compared with each model value, a direction only by order, and 'not_reported' rows
    show the model value alone."""
    rows = []
    for key, item in spec.items():
        kind = item.get("kind", "not_reported")
        models = [{"label": m["label"], "value": model_value(water_data, m), "depth_cm": m.get("depth_cm"),
                   "compare_to": m.get("compare_to", "range"), "year": m.get("year")}
                  for m in item.get("model_values", [])]
        row = {"key": key, "kind": kind, "label": item["label"], "unit": item["unit"], "models": models,
               "published_range": item.get("published_range"), "published_text": item.get("published_text"),
               "depth_cm": item.get("depth_cm"), "years": item.get("years"), "page_or_table": item.get("page_or_table"),
               "note": item.get("note"), "model_measure": item.get("model_measure"),
               "verified_by": item.get("verified_by")}
        if kind == "range":
            row["published_by_year"] = item.get("published_by_year")
            row["quote"] = item.get("quote")
            for m in models:
                v, target = m["value"], m["compare_to"]
                m["depth_differs"] = m["depth_cm"] is not None and row["depth_cm"] is not None and m["depth_cm"] != row["depth_cm"]
                m["position"] = m["distance"] = m["published"] = None
                if v is None or target is None:
                    continue                                   # shown for reference, no verdict
                if target == "range" and row["published_range"]:
                    low, high = row["published_range"]
                    m["position"] = "within" if low <= v <= high else "below" if v < low else "above"
                    m["distance"] = round(max(low - v, v - high, 0.0), 1)
                elif isinstance(target, (int, float)):
                    m["published"] = target
                    m["position"] = "same sign" if (v > 0) == (target > 0) else "opposite sign"
                    m["distance"] = round(v - target, 1)
        if kind == "direction":
            values = [m["value"] for m in models]
            row["same_direction"] = None if None in values else all(values[0] > v for v in values[1:])
        rows.append(row)
    return rows


def load_validation(path=ROOT / "model" / "validation.json"):
    if not path.exists():
        return None, {}
    config = json.loads(path.read_text(encoding="utf-8"))
    return config.get("source", {}), config.get("points", {})


# ------------------------------------------------------------------ one field

def ribbon(ndvi_path):
    """One string per year, one character per day: 0-9 NDVI tenths, s snow, . no data."""
    points, snow = cover.load_ndvi(ndvi_path)
    daily = cover.daily_ndvi(points)
    first, last = points[0][0].year, points[-1][0].year
    rows = {}
    for year in range(first, last + 1):
        day = dt.date(year, 1, 1)
        chars = []
        while day.year == year:
            if day in snow:
                chars.append("s")
            elif day in daily:
                chars.append(str(min(9, max(0, int(daily[day] * 10)))))
            else:
                chars.append(".")
            day += dt.timedelta(days=1)
        rows[str(year)] = "".join(chars)
    return rows


def autumn_features(rows):
    """Root-zone soil wetness (NASA POWER GWETROOT) and autumn rain, per year, same window every year."""
    last = rows[-1]["date"]
    out = {}
    for year in range(2000, last.year + 1):
        start, end = dt.date(year, *AUTUMN[0]), dt.date(year, *AUTUMN[1])
        if end > last:
            continue
        wet = [d["GWETROOT"] for d in rows if start <= d["date"] <= end and d.get("GWETROOT") is not None]
        rain = sum(d["PRECTOTCORR"] or 0 for d in rows if dt.date(year, 9, 1) <= d["date"] <= end)
        if wet:
            out[str(year)] = {"wetness": round(sum(wet) / len(wet), 4), "rain_mm": round(rain, 1)}
    return {"window": "15 Sep - 4 Nov", "data_until": last.isoformat(), "years": out}


def may_july_rain(rows):
    """May-July rain per year over the full POWER record, for the dry-year ranking."""
    out, count = {}, {}
    for d in rows:
        if 5 <= d["date"].month <= 7 and d["PRECTOTCORR"] is not None:
            out[d["date"].year] = out.get(d["date"].year, 0) + d["PRECTOTCORR"]
            count[d["date"].year] = count.get(d["date"].year, 0) + 1
    return {str(y): round(v, 2) for y, v in out.items() if count[y] >= 85}


def evidence(water_data):
    """The model results the evidence sections show (default soil and sowing dates)."""
    rotations = {}
    for key, r in water_data["rotations"].items():
        rotations[key] = rounded({
            "label": r["label"], "short": r.get("short", r["label"]), "sequence": r["sequence"],
            "crop_years_per_10": r["crop_years_per_10"], "water_use": r["water_use"],
            "mean_demand_met_pct": r["mean_demand_met_pct"], "severe_stress_crop_years_pct": r["severe_stress_crop_years_pct"],
            "cover": r["cover"], "fallow": r["fallow"], "after_wheat_storage": r["after_wheat_storage"],
            "fallow_advantage_at_wheat_sowing_mm": r.get("fallow_advantage_at_wheat_sowing_mm"),
            "by_crop": r["by_crop"], "by_year": columns(r.get("by_year", [])),
        })
    return {
        "climate": rounded(dict(water_data["climate"])),
        "soil": water_data["soil"],
        "assumptions": {k: water_data["assumptions"][k] for k in ("kcb_min", "severe_stress")},
        "elevation_m_used": water_data.get("elevation_m_used"),
        "sow_dates_used": water_data.get("sow_dates_used"),
        "gwetroot_check": rounded(water_data.get("gwetroot_check"), 6),   # the page shows r to 2 decimals: fewer would round twice (0.894998 -> 0.895 -> 0.90)
        "rotations": rotations,
    }


def point_data(folder, point, validation_source, validation):
    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
    meta.setdefault("label", LABELS.get(folder.name, meta.get("name", folder.name)))
    for key in ("ndvi_source", "ornl_check_date"):     # where NDVI came from; when a check against ORNL failed
        if point.get(key):
            meta[key] = point[key]
    rows = water.load_weather(folder / "power_daily.csv")
    weather = [d for d in rows if d["date"].year >= FIRST_SIM_YEAR]
    elevation = meta.get("elevation_m") or water.ASSUMPTIONS["elevation_m"]
    eto = [water.reference_et(d, meta["lat"], elevation)[0] for d in weather]

    last = weather[-1]["date"]
    keep_to = last.year if (last.month, last.day) >= (9, 30) else last.year - 1
    july = [sum(d["PRECTOTCORR"] or 0 for d in weather if d["date"].year == y and d["date"].month == 7)
            for y in range(2000, keep_to + 1)]

    calendar = json.loads((folder / "cover_calendar.json").read_text(encoding="utf-8"))
    water_data = json.loads((folder / "water_balance.json").read_text(encoding="utf-8"))
    types_file = folder / "season_types.json"

    data = {
        "meta": meta,
        "keep_to": keep_to,
        "july_rain_mm": sum(july) / len(july),
        "rain_mm_per_year": water_data["climate"]["mean_rain_snow_mm_per_year"],
        "weather": {
            "start": [weather[0]["date"].year, weather[0]["date"].month, weather[0]["date"].day],
            "precip": [round(d["PRECTOTCORR"] or 0.0, 2) for d in weather],
            "tmean": [None if d["T2M"] is None else round(d["T2M"], 2) for d in weather],
            "eto": [round(v, 3) for v in eto],
            # raw values for the climate what-if sliders and the frost check
            "tmax": [None if d["T2M_MAX"] is None else round(d["T2M_MAX"], 1) for d in weather],
            "tmin": [None if d["T2M_MIN"] is None else round(d["T2M_MIN"], 1) for d in weather],
            "rh": [None if d["RH2M"] is None else round(d["RH2M"]) for d in weather],
            "ws": [None if d["WS2M"] is None else round(d["WS2M"], 2) for d in weather],   # 2 decimals as POWER: the 6 m/s windy-day threshold
            "rs": [None if d["ALLSKY_SFC_SW_DWN"] is None else round(d["ALLSKY_SFC_SW_DWN"], 1) for d in weather],
        },
        "ribbon": ribbon(folder / "ndvi_16day.csv"),
        "autumn": autumn_features(rows),
        "may_july_rain": may_july_rain(rows),
        "season_types": json.loads(types_file.read_text(encoding="utf-8")) if types_file.exists() else {},
        "cover": {"summary": calendar["summary"], "thresholds": calendar["thresholds"], "years": [
            {k: y[k] for k in ("year", "status", "dry_year", "green_days", "bare_days", "bare_windy_days",
                               "bare_heavy_rain_days", "peak_ndvi", "may_july_rain_mm")}
            for y in calendar["years"]]},
        "evidence": evidence(water_data),
    }
    if folder.name in validation:
        spec = validation[folder.name]
        data["validation"] = {"source": validation_source, "model_depth_cm": MODEL_DEPTH_CM, "trial": spec.get("trial"),
                              "rows": validation_rows(water_data, spec.get("comparisons", {}))}
    return data


# ------------------------------------------------------------------ the page

def leaflet():
    """Leaflet 1.9.4 (BSD-2-Clause), inlined so the map works without unpkg.com.
    Its CSS refers to marker and layer-switcher images the page does not use; those rules are dropped."""
    vendor = ROOT / "web" / "vendor" / "leaflet"
    css = (vendor / "leaflet.css").read_text(encoding="utf-8")
    css = re.sub(r"url\(images/[^)]*\)", "none", css)
    return css, (vendor / "leaflet.js").read_text(encoding="utf-8")


def site_data():
    points = json.loads((ROOT / "data_fetch" / "points.json").read_text(encoding="utf-8"))["points"]
    validation_source, validation = load_validation()
    data = {}
    for point in points:
        folder = ROOT / "data" / point["id"]
        needed = ("power_daily.csv", "ndvi_16day.csv", "meta.json", "cover_calendar.json", "water_balance.json")
        if all((folder / name).exists() for name in needed):
            data[point["id"]] = point_data(folder, point, validation_source, validation)
    if not data:
        raise SystemExit("No results found. Run python run_all.py first.")
    crops = json.loads((ROOT / "model" / "crops.json").read_text(encoding="utf-8"))
    clusters_file = ROOT / "model" / "season_clusters.json"
    if clusters_file.exists():
        clusters = json.loads(clusters_file.read_text(encoding="utf-8"))
        crops["season_clusters"] = clusters["clusters"]
        crops["season_agreement"] = clusters.get("agreement_with_thresholds")
    return {"project_name": PROJECT_NAME, "points": data, "crops": crops}


def main(out=None):
    site = site_data()
    web = ROOT / "web"
    css, js = leaflet()
    page = (web / "template.html").read_text(encoding="utf-8")
    for marker, text in (("/*LEAFLET_CSS*/", css), ("/*STYLE*/", (web / "style.css").read_text(encoding="utf-8")),
                         ("/*LEAFLET_JS*/", js), ("/*MODEL*/", (web / "model.js").read_text(encoding="utf-8")),
                         ("/*LIVE*/", (web / "live.js").read_text(encoding="utf-8")),
                         ("/*APP*/", (web / "app.js").read_text(encoding="utf-8"))):
        page = page.replace(marker, text)
    page = page.replace("/*PROJECT_NAME*/", PROJECT_NAME)
    payload = json.dumps(site, separators=(",", ":"), ensure_ascii=False)
    page = page.replace("/*DATA*/", payload)

    out = pathlib.Path(out) if out else ROOT / "docs" / "index.html"
    write_lf(out, page)
    write_lf(ROOT / "build" / "data.json", payload)    # for tests/parity.js and tests/live_parity.js only
    print(f"-> {out} ({len(site['points'])} fields, {out.stat().st_size // 1024} KB)")
    return out


if __name__ == "__main__":
    main()
