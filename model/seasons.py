#!/usr/bin/env python3
"""
Season types without hand-picked thresholds: k-means clustering of yearly NDVI curves.

Every field-year becomes one curve of 13 NDVI values, 7 April to 17 October, every 16 days
(MODIS MOD13Q1, interpolated between clear images). All curves of all fields are clustered
together, so a "bare all season" year means the same thing on every field. Clusters are
named afterwards from the shape of their average curve, and compared with the threshold
labels of model/cover.py as an independent check.

Usage:  python model/seasons.py            # all folders in data/ that have ndvi_16day.csv

Writes data/<point>/season_types.json and model/season_clusters.json.
Pure Python, no installs. Deterministic (fixed random seed).

AI assistance: drafted with an AI model (Claude, Anthropic), reviewed by the team.
"""

import datetime as dt
import json
import pathlib
import random

import cover

ROOT = pathlib.Path(__file__).resolve().parent.parent
K = 4
SAMPLES = 13
START = (4, 7)
STEP_DAYS = 16
RESTARTS = 50
GREEN = cover.THRESHOLDS["green_ndvi"]


def write_lf(path, text):
    """LF line endings on every OS, so the files are byte-reproducible."""
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def curves_for(folder):
    points, _snow = cover.load_ndvi(folder / "ndvi_16day.csv")
    daily = cover.daily_ndvi(points)
    out = {}
    for year in range(points[0][0].year, points[-1][0].year + 1):
        days = [dt.date(year, *START) + dt.timedelta(days=STEP_DAYS * k) for k in range(SAMPLES)]
        values = [daily.get(d) for d in days]
        if sum(v is None for v in values) > 2:
            continue
        for i, v in enumerate(values):  # fill a rare gap with the nearest known value
            if v is None:
                values[i] = next(values[j] for j in sorted(range(SAMPLES), key=lambda j: abs(j - i)) if values[j] is not None)
        out[year] = values
    return out


def distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def kmeans(data, k, rng):
    centres = [rng.choice(data)]
    while len(centres) < k:  # k-means++ seeding
        weights = [min(distance(x, c) for c in centres) for x in data]
        pick, total = rng.random() * sum(weights), 0.0
        for x, w in zip(data, weights):
            total += w
            if total >= pick:
                centres.append(x)
                break
    for _ in range(100):
        groups = [min(range(k), key=lambda c: distance(x, centres[c])) for x in data]
        new = []
        for c in range(k):
            members = [x for x, g in zip(data, groups) if g == c]
            new.append([sum(col) / len(members) for col in zip(*members)] if members else centres[c])
        if new == centres:
            break
        centres = new
    inertia = sum(distance(x, centres[g]) for x, g in zip(data, groups))
    return centres, groups, inertia


def name_clusters(centres):
    """Name each cluster from its average curve."""
    info = []
    for i, c in enumerate(centres):
        info.append({"id": i, "peak": max(c), "green_samples": sum(v >= GREEN for v in c),
                     "peak_at": c.index(max(c))})
    names = {}
    bare = min(info, key=lambda x: x["peak"])
    names[bare["id"]] = "bare all season"
    rest = [x for x in info if x["id"] != bare["id"]]
    longest = max(rest, key=lambda x: (x["green_samples"], x["peak"]))
    names[longest["id"]] = "long green season"
    rest = [x for x in rest if x["id"] != longest["id"]]
    rest.sort(key=lambda x: x["peak"])
    labels = ["weak crop season", "strong crop season"] if len(rest) == 2 else ["crop season"] * len(rest)
    for x, label in zip(rest, labels):
        names[x["id"]] = label
    return names


def main():
    folders = sorted(f for f in (ROOT / "data").iterdir() if (f / "ndvi_16day.csv").exists())
    rows = []
    for folder in folders:
        for year, curve in curves_for(folder).items():
            rows.append((folder, year, curve))
    data = [r[2] for r in rows]

    rng = random.Random(42)
    best = min((kmeans(data, K, rng) for _ in range(RESTARTS)), key=lambda result: result[2])
    centres, groups, inertia = best
    names = name_clusters(centres)

    per_point = {}
    for (folder, year, _curve), g in zip(rows, groups):
        per_point.setdefault(folder, {})[str(year)] = names[g]

    agree = total = 0
    print(f"{len(rows)} field-years from {len(folders)} fields, k={K}, inertia {inertia:.2f}")
    for folder, types in per_point.items():
        calendar_file = folder / "cover_calendar.json"
        status = {}
        if calendar_file.exists():
            status = {str(y["year"]): y["status"] for y in json.loads(calendar_file.read_text(encoding="utf-8"))["years"]}
        for year, label in types.items():
            s = status.get(year)
            if s in (None, "incomplete year", "unclear"):
                continue
            total += 1
            agree += (label == "bare all season") == (s == "likely fallow")
        write_lf(folder / "season_types.json", json.dumps(types, indent=1))
        bare = [y for y, t in types.items() if t == "bare all season"]
        print(f"  {folder.name}: bare all season {bare}")
    print(f"Fallow / not fallow agreement with the threshold method: {agree} of {total} years")

    write_lf(ROOT / "model" / "season_clusters.json", json.dumps({
        "method": "k-means, k=4, 50 k-means++ restarts, seed 42, on NDVI sampled 7 Apr - 17 Oct every 16 days",
        "agreement_with_thresholds": {"same": agree, "years": total},
        "clusters": [{"name": names[i], "mean_curve": [round(v, 3) for v in c]} for i, c in enumerate(centres)],
    }, indent=1))


if __name__ == "__main__":
    main()
