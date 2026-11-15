# Up To Para

**Test a crop rotation on your own field's past before you risk a real season.**

NASA Space Apps Challenge 2026. Challenge: crop rotation decision support with NASA Earth observations.
Region: northern Kazakhstan. Comparison site: Shortandy, Akmola Region (rotation trial of Suleimenov et al., 2005).

The page is `docs/index.html`: one self-contained file, English and Russian, no login, no server. It opens and
works with no internet at all (map tiles and live NASA data are extras that load when there is a connection).
GitHub Pages serves it from the `docs/` folder of `main`.

## The problem

In northern Kazakhstan, wheat covers most of the arable land and is traditionally rotated with summer
fallow. One year in four the field earns nothing and lies bare to wind and sun. Fallow is kept because
it is believed to store water for the next wheat crop. Farmers rarely get to see how much water it really
stored on *their* field, or what the same years would have looked like with a pulse crop, oats, or a
diverse rotation instead.

The tool supports a decision; it does not make it. It is a replay of past weather, not a forecast.

## What the page shows

Pick a field: one of eight prepared fields across the grain belt of northern Kazakhstan, or click anywhere in
the world (live mode: NASA POWER and MODIS are loaded for that point in the browser). The first screen answers
three questions for the current rotation (fallow-wheat-wheat-barley) against the option with the fewest days of
tilled bare soil: how many days a year the soil lies tilled and bare, how much of the rain and snow between the
harvest and the next wheat sowing actually stayed in the soil, and how many harvests the rotation gives in ten
years with how much of the crops' water need met. On a field where MODIS sees no fallow-like year this is worded as a
what-if. There is no money on the first screen. Then, pass by pass:

1. **What the satellite saw.** MODIS NDVI since 2000, day by day: green crop, bare soil, snow; years that look
   like fallow; very dry May-July seasons (drought and fallow look alike from orbit). A neighbour map (4 x 4 km of
   MODIS pixels) shows how many summers each pixel lay bare. A field whose record looks like grassland or a
   research plot gets a warning.
2. **Build your rotation.** The current rotation and three alternatives (pea, oats or lentil-flax in place of
   fallow) run through every day of NASA POWER weather, 2000–2026 (2026 to 4 November), with the FAO-56 soil water balance.
   Rain and temperature sliders, soil and sowing date, priorities. A stress test replays the three driest
   May-July seasons.
3. **Money.** Opens with "Example yields and costs. Enter your own: the ranking can change." Yields scale with
   water stress (FAO-33 Ky); prices and costs are editable. The summary sentence starts "With the example yields
   and costs above".
4. **Next spring.** Today's root-zone soil moisture (NASA SMAP L4 via GIBS) against the same day in past years,
   and this autumn's GWETROOT against past autumns. Analog years, not a forecast.
5. **Where the rain and snow went.** Crops, soil evaporation, drainage, snowmelt runoff, snow blown off. The
   harvest-to-sowing window of a fallow: what stayed in the soil and where the rest went. Field slope, and a rough
   soil-carbon estimate per rotation.
6. **Strategy cards.** Why, evidence, gains, gaps and risks of each option, following the Shortandy trial. Each
   change against your rotation is said in words with a better or worse label ("8 points more harvests short of
   water (worse)"), not with a bare sign.
7. **Checks.** For every field: the model's soil water on 1 May and 15 September against NASA POWER GWETROOT,
   year by year. For Shortandy also the published trial results next to the model, and the soil-carbon change of
   switching wheat-fallow to continuous wheat against Takata et al. (2008).

## Results on the prepared fields (default settings)

Model on NASA POWER weather 2000–2026 (2026 to 4 November) unless marked MODIS; rain and snow are means of the
complete years 2000–2025. "Now" is fallow-wheat-wheat-barley; at Molodezhnoye, where MODIS sees no fallow-like
year, the page words it as a what-if ("if this field had fallow").

| Field | Region | Rain + snow, mm/yr (2000-2025) | Fallow-like summers seen by MODIS | Tilled bare soil, days/yr now | Stays in the soil, harvest to wheat sowing | Extra water at wheat sowing after fallow | Water need met now | GWETROOT r, 1 May / 15 Sep |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kostanay, M-36 road | Kostanay | 418 | 2004, 2009, 2016, 2020, 2024 | 42 | 22% | 28 mm | 65% | 0.88 / 0.89 |
| Shortandy (trial site) * | Akmola | 385 | 2000, 2023 | 41 | 24% | 33 mm | 58% | 0.95 / 0.84 |
| Molodezhnoye | North Kazakhstan | 423 | none | 40 (what-if) | 21% | 30 mm | 71% | 0.92 / 0.93 |
| Taiynsha ** | North Kazakhstan | 416 | 2020 | 41 | 22% | 35 mm | 68% | 0.91 / 0.89 |
| Esil * ** | Akmola | 383 | 12 of 27 summers | 42 | 25% | 35 mm | 57% | 0.90 / 0.86 |
| Ubagan * ** | Kostanay | 377 | 2010, 2019, 2021 | 43 | 25% | 42 mm | 55% | 0.82 / 0.78 |
| Voznesenka ** | Pavlodar | 346 | 2007, 2008, 2014, 2020 | 41 | 26% | 49 mm | 51% | 0.89 / 0.90 |
| Osakarovka ** | Karaganda | 387 | 2003, 2010, 2012, 2021, 2022, 2023 | 41 | 25% | 32 mm | 58% | 0.88 / 0.75 |

\* Flagged on the page: many summers stayed green longer than a spring crop does (Shortandy 7 of 27, Ubagan 11
of 27), so the point may not sit on one annual-crop field. Its coordinates should be checked. Esil is flagged for
low summer greenness (see Limits).
\*\* MODIS NDVI read from NASA GIBS map tiles, without the MODIS quality band (see Data).

- Every alternative removes the tilled bare days (40-43 a year now, 0 without fallow) and gives 10 harvests in
  10 years instead of 7.5. Each crop gets a little less of the water it needs (with pea in place of fallow
  3-4 percentage points less on every field), and severely stressed crop years rise (Kostanay 19% now, 23-29% without fallow).
- A fallow keeps only 21-26% of the rain and snow from the harvest before it to the next wheat sowing. For
  comparison, USDA ARS writes that fallow in the US Great Plains "loses 65 to 80 percent of precipitation to
  evaporation" ([AgResearch Magazine, January 2011](https://agresearchmag.ars.usda.gov/2011/jan/rotations)).
- Shortandy trial (Suleimenov et al., 2005; numbers entered by the team from the publisher's PDF, model not
  tuned to them): over 2000-2002 the model's fallow advantage at wheat sowing falls in the published range, but
  the model does not reproduce individual years (in 2001 the trial found stubble wetter, the model did not).
- Soil carbon, a rough estimate from the abstracts of Takata et al. 2007-2008: switching wheat-fallow to
  continuous wheat changes soil carbon by +0.13 to +0.33 t C/ha a year across the eight fields (Shortandy +0.26).
  Takata et al. estimate +0.1 to +0.3 for that switch at Shortandy; Kostanay (+0.32) and Molodezhnoye (+0.33) are
  just outside. The authors note the low predictive ability of their regression.
- The model runs a textbook rotation through the field's weather, not the field's real history: MODIS shows
  what was actually grown.

These are model results, not field measurements.

## Run it

Python 3.9 or newer, standard library only. Node.js for the model parity tests, Chrome or Edge (headless) for
the page tests; without them those tests are skipped.

```
python run_all.py              # cover.py, water.py and season types for every field, then build_site.py
python build_site.py           # only rebuild docs/index.html from the model results in data/
python tests/run_tests.py      # all tests: Python, the Node parity checks, the page offline in headless Chrome
node tests/parity.js           # Node only: the browser model (web/model.js) against model/water.py, all fields
node tests/live_parity.js      # Node only: the live loader (web/live.js) against the prepared inputs
```

The Node checks read `build/data.json`, which `run_all.py` and `build_site.py` write. Open `docs/index.html`, or
serve it: `cd docs && python -m http.server 8000`, then http://localhost:8000.

To add a field, put it in `data_fetch/points.json` (centre of one field, at least 500 m from its edge) and run:

```
python data_fetch/fetch_data.py --check            # test both APIs
python data_fetch/fetch_data.py --only <point id>  # NASA POWER and MODIS (ORNL), about 15-20 minutes
python run_all.py
```

`fetch_data.py` keeps the raw API responses in `data/<point>/raw/`; that cache is not in this repository and
nothing else needs it (each field's elevation is stored in its `meta.json`).

`python data_fetch/gibs_to_csv.py` rewrites the NDVI files of the five GIBS fields from the saved series in
`data_fetch/gibs/`.

## Data

| Dataset | What for | Access |
| --- | --- | --- |
| NASA POWER daily, Agroclimatology: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, WS2M, GWETROOT | Weather for the water balance (FAO-56 reference evapotranspiration), snow, wind; GWETROOT only to cross-check the model | https://power.larc.nasa.gov/ |
| MODIS Terra MOD13Q1 V061, 250 m 16-day NDVI with pixel reliability | Green, bare and fallow years of Kostanay, Shortandy, Molodezhnoye | ORNL DAAC TESViS, https://modis.ornl.gov/ |
| NASA GIBS: MODIS Terra NDVI 16-day map layer (MOD13Q1) | NDVI history of the five other fields; greenness map; neighbour map (pixel colours decoded back into NDVI) | https://gibs.earthdata.nasa.gov/ |
| NASA GIBS: MODIS Terra Corrected Reflectance, true colour | The field on a given day | https://gibs.earthdata.nasa.gov/ |
| NASA SMAP Level-4 root-zone soil moisture (via GIBS) | Soil moisture today against past years | https://gibs.earthdata.nasa.gov/ |
| AWS Terrain Tiles (largely NASA SRTM) | Field slope and elevation | https://registry.opendata.aws/terrain-tiles/ |
| ESA Copernicus Sentinel-2 cloudless 2020 (EOX) | Satellite map for finding fields | https://s2maps.eu/ |

The MODIS version follows from the data: MOD13Q1 V006 was decommissioned on 31 July 2023 and its record ends on
2023-02-17, while every ORNL field here has composites after that date, up to 2026-10-16, which only V061
contains. For the five extra fields the ORNL service answered 503 on 14 November 2026, so the same MOD13Q1
composites were read from NASA GIBS tiles. Each colour in the GIBS layer stands for one NDVI range of its published
colour map; on the Kostanay field the decoded values matched ORNL within 0.005. GIBS has no quality band, so a
near-zero NDVI from November to March is treated as snow. The field elevation of these five comes from NASA POWER.

## How it works

- `model/water.py` (Python, reference) and `web/model.js` (the same model in the browser): FAO-56 dual crop
  coefficient water balance, Penman-Monteith reference evapotranspiration (checked against FAO-56 Example 18),
  Kcb + Ke, Ks stress, a soil profile in 10 cm layers so that roots only reach water above their depth. Each
  rotation runs in all its phases over 1994 to 4 November 2026; the years from 2000 on are kept. Not from FAO-56 and plain
  assumptions: a degree-day snow model, part of the snow blown off bare fallow, snowmelt runoff on frozen soil,
  less evaporation under stubble. `tests/parity.js` keeps the two equal: 1352 checks on all eight fields,
  largest difference 0.002.
- `model/cover.py`: a warm-season day (centred 7-day mean of 5 C or more, no snow) is green when the
  daily-interpolated NDVI is 0.35 or more. A year whose mean NDVI from 10 June to 20 August is below 0.35 looks
  like fallow, 0.35-0.42 is unclear, green for 130 days or more is a long green season. Two rules put a warning on
  a field: more than 25% long green seasons (it may be grassland or a research plot), and a median summer NDVI
  (10 June to 20 August, over the full years) below 0.40, within 0.05 of the fallow threshold, so that weak crops
  may be counted as fallow.
- `model/seasons.py`: k-means of season NDVI curves (k = 4). On the eight fields it agrees with the thresholds on
  fallow or not in 185 of 185 clear field-years.
- `web/live.js`: loads NASA POWER and MODIS for a clicked point and rebuilds the same inputs as the Python
  scripts (`tests/live_parity.js`).
- `model/crops.json`: crop parameters, each marked as checked against a source (FAO-56 Tables 11, 12, 17 and 22;
  FAO-33 Ky) or assumed; example economics.

Definitions used on the page:

- **Tilled bare soil**: warm-season days without snow from 1 June of the fallow year to the next sowing.
  Other bare days (stubble, seedbed, young crop) are counted separately.
- **Stays in the soil**: plant-available soil water at wheat sowing minus the water at the harvest before the
  fallow, divided by the rain and snow over the same window.
- **Water need met**: crop transpiration divided by its unstressed transpiration (Kcb x ETo) over the season.
  A crop-year with less than half of its need met counts as severely stressed.
- **GWETROOT check**: model plant-available water in 0-120 cm against the 7-day mean of GWETROOT around 1 May
  and 15 September. Only the year-to-year variation is compared, and GWETROOT shares its weather source with the
  model, so this is a consistency check, not a field measurement.

## Limits

- NASA POWER is a 0.5 degree grid and SMAP a 9 km cell: the district, not the single field.
- MODIS pixels are 250 m, so the field must be at least about 500 m across. MODIS sees living green plants only:
  stubble is invisible, weeds count as green, and a summer fallow looks like a crop that failed in a drought.
- The NDVI thresholds were set on the first three fields. At Esil 12 of 27 summers fall below them; its median
  summer NDVI is 0.37 against 0.42-0.64 on the other fields, so weak crops may be counted as fallow there, and the
  page says so. Its NDVI comes from NASA GIBS tiles; a direct check against ORNL was not possible on 14 Nov 2026.
- The soil is the FAO-56 example silt loam (160 mm of plant-available water per metre, 1.2 m deep) unless the
  farmer enters an agrochemical passport. A fallow cannot store more than this soil holds.
- Sowing dates, stage lengths, flax parameters, Ky for barley, oats, lentil and flax, the snow model and the
  NDVI thresholds are assumptions; `model/crops.json` lists what is checked and what is not.
- The model does not see weeds, diseases, nitrogen or prices. Weed control is one of the main reasons for
  fallow and is not modelled.
- Example yields and costs are illustrative and in tenge; the farmer replaces them.
- The Shortandy trial lasted three years (2000-2002); the model describes many years on district weather, not a
  single year on a trial plot.

## Next steps

Calibrate humus with agrochemical survey archives; cross-check rain with GPM IMERG; use the SMAP record in the
next-spring outlook; outline real field boundaries; ask agronomists to review the NDVI thresholds per region.

## Repository layout

```
data_fetch/       download scripts, points.json, GIBS NDVI series of the five extra fields
data/             one folder per field: NASA inputs and model results
model/            cover.py, water.py, season.py, seasons.py, crops.json, validation.json
web/              page template, model.js, live.js, app.js, styles, Leaflet 1.9.4 (BSD-2-Clause)
build_site.py     builds docs/index.html with all data and scripts inlined
run_all.py        runs the models for every field, then build_site.py
tests/            unittest suite and Node parity checks (python tests/run_tests.py)
docs/             the published page (GitHub Pages)
```

## References

1. NASA POWER Project, NASA Langley Research Center. https://power.larc.nasa.gov/ The data was obtained from the
   National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy
   Resources (POWER) project funded through the NASA Earth Science Division; Daily 2.10.3, accessed 2026/11/14.
2. Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA EOSDIS LP DAAC.
   https://doi.org/10.5067/MODIS/MOD13Q1.061
3. ORNL DAAC (2018). Terrestrial Ecology Subsetting & Visualization Services (TESViS) Global Subsets Tool.
   https://doi.org/10.3334/ORNLDAAC/1379
4. NASA Global Imagery Browse Services (GIBS), NASA EOSDIS. https://nasa-gibs.github.io/gibs-api-docs/
5. Reichle, R. et al. SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Analysis
   Update, Version 7. NASA NSIDC DAAC. https://doi.org/10.5067/LWJ6TF5SZRG3
6. Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration. FAO Irrigation and Drainage
   Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm
7. Doorenbos, J., Kassam, A.H. (1979). Yield response to water. FAO Irrigation and Drainage Paper 33; Ky as given
   in Steduto, P. et al. (2012), FAO Irrigation and Drainage Paper 66. https://fao.org/4/i2800e/i2800e02.pdf
8. Suleimenov, M., Akhmetov, K., Kaskarbayev, Zh., Kireyev, A., Martynova, L., Medeubayev, R. (2005). Role of
   Wheat in Diversified Cropping Systems in Dryland Agriculture of Central Asia. Turkish Journal of Agriculture and
   Forestry 29(2): 143-150. https://journals.tubitak.gov.tr/agriculture/vol29/iss2/7
9. Takata, Y. et al. (2007). Soil Science and Plant Nutrition. https://doi.org/10.1111/j.1747-0765.2007.00127.x
   (abstract; fallow fields lose about 0.8 t C/ha a year)
10. Takata, Y. et al. (2008). Influence of crop rotation system on the spatial and temporal variation of the soil
    organic carbon budget in northern Kazakhstan. Soil Science and Plant Nutrition 54(1): 159-171.
    https://doi.org/10.1111/j.1747-0765.2007.00217.x (abstract)
11. Takata, Y. et al. (2008). Regional evaluation of the spatio-temporal variation in soil organic carbon
    dynamics for rainfed cereal farming in northern Kazakhstan. Soil Science and Plant Nutrition 54(5): 794-806.
    https://doi.org/10.1111/j.1747-0765.2007.00298.x (abstract)
12. USDA ARS, AgResearch Magazine, January 2011. https://agresearchmag.ars.usda.gov/2011/jan/rotations
13. Manitoba Agriculture. Agricultural Climate of Manitoba, Table 1: Number of Days Required for Selected Crops to Reach Maturity.
    https://www.gov.mb.ca/agriculture/weather/agricultural-climate-of-mb.html
14. Example prices: Prodcorporation wheat purchase price, 2026 harvest
    (https://dairynews.today/kz/news/pravitelstvo_kazakhstana_ustanovilo_zakupochnye_tseny_na_pshenitsu_urozhaya_2026_goda_5993571.html);
    elevator prices, August 2025 (https://bizmedia.kz/2025-08-18-rekomendaczii-po-torgovoj-strategii-dlya-proizvoditelej-zerna-maslichnyh-i-bobovyh/);
    farm-gate prices, December 2024, Bureau of National Statistics
    (https://dairynews.today/kz/news/v-kazakhstane-tseny-na-zernovye-snizilis-a-maslichnye-podorozhali-v-dekabre-2024-goda.html).
15. EOX IT Services. Sentinel-2 cloudless 2020 (contains modified Copernicus Sentinel data 2020). https://s2maps.eu/
16. Terrain Tiles on AWS. https://registry.opendata.aws/terrain-tiles/
17. Leaflet 1.9.4 (BSD-2-Clause), https://leafletjs.com/; OpenStreetMap contributors,
    https://www.openstreetmap.org/copyright

## Use of AI
Model formulas, crop
parameters and literature values were checked against the sources above; the Shortandy trial numbers were
entered by the team from the publisher's PDF. No AI-generated images are used.

## Team

LunarOblivion (Kravchenko Angelina, SUNO-QT (Artur Kvon); Ratibor; Torgyn; Amirzhan
