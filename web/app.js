/*
 * Fallow Audit page logic. Reads DATA (built by build_site.py) and runs web/model.js live.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------ text
  const STR = {
    en: {
      brand: DATA.project_name || "Up To Para",
      mapOffline: "The map could not be loaded (no internet, or the map service is blocked). The sketch shows where the fields are; click one to choose it. Everything below works from data built into this page.",
      mapSketchAria: "Sketch map of the prepared fields",
      smapAxis: "same day, other years",
      smapLoading: "Reading today's soil moisture from NASA SMAP…",
      smapNote: "NASA SMAP Level-4 root-zone soil moisture, read from the NASA GIBS map. One value covers a 9 km cell, so it describes the district, not this one field.",
      smapBig: (d, v, diff, y0, y1) => `Soil now, ${d}: ${v} m³ of water per m³ in the top metre. That is ${Math.abs(diff)}% ${diff < 0 ? 'drier' : 'wetter'} than on the same day in ${y0}–${y1}.`,
      gridWater: "water or no data",
      gridYearTip: (y, sh, own) => `${y}: ${sh}% of the land around was bare` + (own ? ', your field too' : ''),
      gridTip: (n, t, list) => `Bare in ${n} of ${t} summers` + (list ? `: ${list}` : ''),
      gridYearsLabel: "Share of land around the field bare in summer. Straw bars: your field was bare too.",
      gridSummary: (n, t, years, avg, share) => `Your field lay bare in ${n} of ${t} summers${years ? ' (' + years + ')' : ''}. The land around it: ${avg} summers on average. Your field was bare more often than ${share}% of it.`,
      gridError: "NASA GIBS did not answer, so the neighbour map is missing.",
      gridLoading: (d, t) => `Reading MODIS summers from NASA GIBS: ${d} of ${t}…`,
      gridSub: "4 × 4 km around the field, one square per MODIS pixel. The brighter the ochre, the more summers the land lay bare, under fallow or after a failed crop.",
      gridTitle: "The field and its neighbours",
      s0Title: "What the satellite saw, and what fallow really gave",
      pass6: "Pass 6",
      pass7: "Pass 7",
      // Fallow Audit evidence
      fa: {
        warnLow: (m, lo, hi, n, gibs, date, th) => `Check this field: its summer greenness is low (median NDVI ${m} against ${lo}-${hi} on the other fields). The ${th} threshold may count weak crops as fallow, so some of the ${n} fallow-like years may be poor crops.` +
          (gibs ? ` NDVI for this field was read from NASA GIBS map tiles${date ? `; a direct check against ORNL was not possible on ${date}` : ""}.` : ""),
        warn: (n, t) => `Check this point: ${n} of ${t} years stayed green longer than a spring crop does. It may sit on grassland, a perennial forage field or a small research plot rather than on one annual-crop field. Its coordinates should be checked before the fallow audit is trusted.`,
        headTilled: (x, y, name) => `Tilled bare soil: ${x} days a year now → ${y} with ${name}.`,
        headNoTilled: "Your rotation has no tilled bare fallow.",
        // what-if: MODIS shows no fallow-like year on this field, so a rotation with fallow is not what it does now
        headTilledIf: (x, y, name) => `Tilled bare soil if this field had fallow: ${x} days a year → ${y} with ${name}. MODIS shows no fallow-like year here since 2000, so this is a what-if.`,
        waterLineIf: (crop, mm, stay) => `A fallow year would have given the next ${crop} ${mm} mm more water at sowing, but only ${stay}% of the rain and snow from the harvest before it to that sowing would have stayed in the soil; the rest would have evaporated, drained away or blown off as snow.`,
        waterLessIf: (crop, mm) => `On this field a fallow year would have left the next ${crop} with ${mm} mm less water at sowing than other years.`,
        cropsLineIf: (c0, c1, name, m0, m1) => `${c0} harvests in 10 years with fallow, ${c1} with ${name}. On average each crop would have got ${m0}% of the water it needed with fallow and ${m1}% with that option: more harvests, each with a little less water.`,
        statTilled: "days of tilled bare soil a year",
        moneyBanner: "Example yields and costs. Enter your own: the ranking can change.",
        waterLine: (crop, mm, stay) => `A fallow year gave the next ${crop} ${mm} mm more water at sowing, but only ${stay}% of the rain and snow from the harvest before it to that sowing stayed in the soil; the rest evaporated, drained away or blew off as snow.`,
        waterLess: (crop, mm) => `On this field a fallow year left the next ${crop} with ${mm} mm less water at sowing than other years.`,
        cropsLine: (c0, c1, name, m0, m1) => `${c0} harvests in 10 years now, ${c1} with ${name}. On average each crop got ${m0}% of the water it needed now and ${m1}% with that option: more harvests, each with a little less water.`,
        note: "A replay of past weather on this field, not a forecast. Money is in pass 3, with example yields and costs that you replace with your own.",
        bareSplit: (t, s) => `${t} days of tilled bare soil and ${s} of stubble or seedbed a year`,
        windowTitle: "Where the rain and snow of a fallow went, from the harvest before it to wheat sowing",
        windowFallow: (mm) => `Fallow, ${mm} mm`,
        windowStubble: (mm) => `One winter on wheat stubble, ${mm} mm`,
        wStay: "Stayed in the soil",
        windowNote: (n) => `Your rotation with the settings above, mean of ${n} fallow periods, model on NASA POWER weather. For comparison, USDA ARS writes about wheat-fallow in the US Great Plains that "fallow loses 65 to 80 percent of precipitation to evaporation" (AgResearch Magazine, January 2011): a share lost to evaporation, not the share stored.`,
        windowNone: "Your rotation has no fallow, so there is no fallow window to show.",
        checksTitle: "Checks against field trials and other data",
        checksLead: "How far the model can be trusted on this field. Each check says what it compares, what came out, and what it cannot show. They use the starting example rotation with the default soil and sowing dates.",
        gwTitle: "Soil water against NASA POWER root-zone soil wetness (GWETROOT)",
        gwLead: (n, may, sep) => `Model soil water in 0-120 cm (fallow-wheat-wheat-barley, mean of its 4 phases) against the 7-day mean of GWETROOT around the date, ${n} years: r = ${may} on 1 May, r = ${sep} on 15 September.`,
        gwCols: ["Date", "r", "Rank r", "3 driest years", "3 wettest years"],
        gwDates: { may_1: "1 May", sep_15: "15 September" },
        gwModel: "Model", gwPower: "POWER",
        gwCommon: (k) => `${k} of 3 in common`,
        strength: (r) => Math.abs(r) >= 0.7 ? "strong" : Math.abs(r) >= 0.4 ? "moderate" : "weak",
        gwNote: "GWETROOT is a 0-1 wetness index for a NASA POWER grid cell of tens of kilometres, with its own soil and layer depth, so only the year-to-year ups and downs are compared. It comes from the same NASA POWER data system as the weather that drives the model, so agreement is partly shared weather: it shows that the model's water store rises and falls with NASA's own estimate, not that the soil of this field behaves the same way. Strong, moderate and weak follow a rule of thumb (|r| of 0.7 and 0.4).",
        trialTitle: "Check against the Shortandy trial (Suleimenov et al., 2005)",
        trialLead: (years, checked) => `The rotation trial at Shortandy (${years}) compared fallow-wheat-wheat-barley with oats or pea in place of the fallow. The paper reports the fallow's soil-water advantage at wheat sowing and grain yields; the model's numbers for this point stand next to them. Published numbers: ${checked}.`,
        trialCols: ["What is compared", "Model", "Published", "Model against the paper"],
        rowLabel: {},
        pubText: {},
        noteText: {},
        measure: {},
        within: "within +20 to +30 mm",
        outside: (pos, d) => `${pos === "above" ? "above" : "below"} +20 to +30 mm by ${d} mm`,
        opposite: (pub, model) => `paper ${pub} mm, model ${model} mm: opposite sign`,
        sameSign: (pub, model) => `paper ${pub} mm, model ${model} mm: same sign`,
        reference: "for reference",
        depthDiffers: " (other layer depth: not directly comparable)",
        sameDirection: "Same direction: wheat after fallow comes first in both",
        otherDirection: "Different direction",
        directionNote: "only the direction is compared: the model does not compute grain yield",
        notReported: "not reported in the paper",
        verdict: (years, mean, inRange, oppYear) => `On average over ${years} the model's fallow advantage (${mean} mm) ${inRange ? "falls in" : "falls outside"} the published range, but it does not reproduce individual years` + (oppYear ? `: in ${oppYear} the trial found stubble wetter, the model did not` : "") + ". The model describes the field's behaviour over many years on district-scale weather, not a single year on a trial plot.",
        explain: (y, pub, model) => `In ${y} the paper found stubble wetter than fallow (${pub} mm); the model gives ${model} mm. Likely reasons: the model runs on the weather of the NASA POWER grid cell, not of the trial station, and it does not know the trial's real tillage, stubble and snow.`,
        quote: (page, q) => `The paper (${page}): "${q}"`,
        trialMeasuredTitle: "What the trial measured (not the model)",
        trialTableCols: ["Rotation", "Grain yield of each crop, t/ha", "Whole area, t/ha", "Against the control", "Weeds, g/m² dry matter"],
        control: "control",
        trialCaption: (table, years, model) => `${table}. The trial lasted 3 years (${years}); the model covers the growing seasons ${model}.`,
        trialNotes: [],
        station: (p, t, rain, t2, years) => `Trial station: ${p} mm of rain and snow a year and ${t} °C. NASA POWER grid cell, ${years}: ${rain} mm and ${t2} °C. A station against a grid cell of tens of kilometres, and different years.`,
        carbonCheckTitle: "Soil carbon against Takata et al. 2007-2008 (abstracts)",
        carbonCheck: (v, inside) => `In this model, switching wheat-fallow to continuous wheat changes soil carbon by ${v} t C/ha a year (same weather, default soil). Takata et al. (2008) estimate +0.1 to +0.3 t C/ha a year for that switch at Shortandy: the model is ${inside ? "inside" : "outside"} that range here.`,
        carbonCoeffs: "Soil carbon is a rough estimate from the abstracts of Takata et al. 2007-2008 (Shortandy); the authors note low predictive ability of their regression. Coefficients and published ranges: a fallow year −0.8 t C/ha (Takata et al. 2007: fallow fields about −0.8); crop residue input 1.3 t C/ha a year (Takata et al. 2008: 1.0-1.6; a second 2008 study: 0.9-1.4 per season); respiration of a crop field 1.1 t C/ha a year (1.0-1.2; 0.9-1.1). All three lie within the published ranges. That residue input grows with the crop's water-limited growth is our assumption. Sources: doi 10.1111/j.1747-0765.2007.00127.x, 10.1111/j.1747-0765.2007.00217.x, 10.1111/j.1747-0765.2007.00298.x.",
      },
      pass5: "Pass 5",
      pass4: "Pass 4",
      pass3: "Pass 3",
      pass2: "Pass 2",
      pass1: "Pass 1",
      readoutNone: (y) => `${y}: no satellite data yet.`,
      readoutGrid: (y, v) => `${y}: midsummer NDVI ${v} at the field.`,
      readout: (y, what, dry, green) => `${y}: ${what}.` + (green !== undefined ? ` Green for ${green} days.` : '') + (dry ? ' A dry year.' : ''),
      yearWord: {"likely fallow": "bare all summer: fallow or a failed crop", "unclear": "unclear: fallow or a weak crop", "long green season": "green almost all season", "cropped": "a crop grew", "incomplete year": "the year is not over"},
      pauseLabel: "Pause",
      playLabel: "Play the years",
      seasons: {"161": "mid-June", "193": "mid-July", "225": "mid-August"},
      seasonLabel: "Time of the summer",
      tlTitle: "The field, summer by summer",
      loaderHide: "Hide this, keep loading",
      loaderNote: "Satellite history comes from NASA GIBS, about 25 MB, usually under a minute. If GIBS does not answer, the page asks the slower ORNL archive. The page fills in as soon as the weather arrives.",
      ldGrid: "Neighbours, 4 × 4 km, every summer",
      ldNdvi: "Satellite, MODIS, since 2000",
      ldWeather: "Weather, NASA POWER, since 1981",
      loaderTitle: "Collecting this field's history",
      smapDateNote: (d) => `Map date ${d}.`,
      legGrid: (y) => `Ochre squares: land bare in summer ${y}, light ochre: unclear.`,
      legSmap: ["dry", "wet"],
      legNdvi: ["bare", "dense crop"],
      gridToggle: "Bare land in the chosen summer",
      modes: {"s2": ["Sharp photo", "Sentinel-2, 2020, 10 m"], "ndvi": ["Greenness", "MODIS NDVI for the year below"], "color": ["The day itself", "MODIS true colour, may be cloudy"], "smap": ["Soil moisture now", "NASA SMAP, top metre"], "osm": ["Roads and villages", "OpenStreetMap"]},
      lensTitle: "What the map shows",
      fieldPixel: "your field, one MODIS pixel",
      scTitle: "What if the climate shifts? Rain and temperature sliders",
      scLead: "Replay the same years with less or more rain and a warmer climate. Reference evapotranspiration and snow are recalculated from the shifted NASA POWER temperatures; relative humidity, wind and sunshine stay as recorded.",
      scRain: "Rain and snow, change", scTemp: "Temperature, warmer by",
      scNote: (r, t) => `What-if active: rain ${r > 0 ? "+" : ""}${r}%, temperature +${t} °C. All numbers on the page use it.`,
      prTitle: "Your priorities and constraints",
      prLead: "Say what matters most and which crops you can actually grow and sell. The rotations are then ranked for you; the numbers themselves do not change.",
      prNames: { income: "Income", water: "Fewer harvests short of water", soil: "Soil carbon and humus", bare: "Fewer days of bare soil" },
      prLevels: ["not important", "a little", "important", "very important"],
      prCrops: "Crops you can grow and sell",
      fit: (best, next) => `Best fit for your priorities: ${best}${next ? `. Next: ${next}` : ""}.`,
      fitNone: "No rotation fits: every one uses a crop you excluded.",
      badgeRank: (n) => `#${n} for your priorities`, badgeOut: "uses a crop you excluded",
      ppTitle: "Agrochemical passport of the field (optional)",
      ppLead: "Copy a few numbers from the field's agrochemical passport. Soil texture sets how much water the soil holds; humus turns the rough soil-carbon estimate into a rough humus estimate. Nothing leaves your browser.",
      pp: { year: "Survey year", humus: "Humus, %", texture: "Soil texture", depth: "Sampling depth, cm", density: "Bulk density, g/cm³",
            p: "Mobile phosphorus P₂O₅, mg/kg", k: "Exchangeable potassium K₂O, mg/kg", ph: "pH", fallow: "Fallow years from your own records, e.g. 2016, 2020, 2024" },
      textures: { "": "not set", sand: "sand", loamy_sand: "loamy sand", sandy_loam: "sandy loam", loam: "loam", silt_loam: "silt loam", clay_loam: "clay loam", clay: "clay" },
      ppHumus: (now, later, years, rot) => `Rough humus estimate for ${rot}: ${now}% now, about ${later}% in ${years} years if the rotation stays the same (see the soil-carbon check in pass 7).`,
      ppNPK: "Phosphorus, potassium and pH are kept with the field but not used by the model yet.",
      humusLine: (now, later) => `humus ${now}% → ${later}% in 10 years (rough estimate)`,
      records: (m, t, extra) => `Your records: ${m} of ${t} fallow years also found by the satellite.` + (extra.length ? ` The satellite also marks ${extra.join(", ")}: drought or a crop that failed?` : ""),
      recordsMissed: (y) => ` Not seen from orbit: ${y.join(", ")}.`,
      slope: (s, e, risk) => `Field slope from AWS Terrain Tiles elevation (built largely from NASA SRTM): ${s}% at about ${e} m above sea level. Water-erosion risk on bare soil: ${risk}.`,
      slopeRisk: ["low", "moderate", "high"],
      slopeFail: "",
      frostAll: (list) => `Years with frost of −2 °C or colder between emergence and harvest (NASA POWER minimum temperature): ${list}.`,
      glTitle: "Words used on this page",
      glossary: [
        ["NDVI", "A greenness index computed from red and near-infrared light seen by a satellite. Bare soil is about 0.1–0.3, a dense green crop 0.6–0.9."],
        ["Fallow", "A field left without a crop for a season, tilled to keep weeds down and to store water for the next crop."],
        ["Evapotranspiration", "Water that leaves the field as vapour: evaporation from the soil plus transpiration through plants."],
        ["Water need met", "The share of the water a crop would use with plenty of moisture that it actually got. Below half, a crop failure is likely."],
        ["Root-zone soil wetness", "How wet the top metre of soil is, on a scale from 0 (dry) to 1 (saturated), from NASA POWER."],
        ["Soil carbon and humus", "Organic matter stored in the soil. Humus is about 58% carbon. Fallow burns it; crop residues and roots add to it."],
        ["FAO-56", "The international method of the UN Food and Agriculture Organization for crop water use, used here for the daily water balance."],
        ["NASA POWER", "NASA's free daily weather and soil-wetness record for any point on Earth since 1981, built from satellites and models."],
        ["MODIS", "Instruments on NASA's Terra and Aqua satellites. Here: vegetation index every 16 days at 250 m since 2000."],
        ["SRTM", "NASA's Shuttle Radar Topography Mission, the elevation map of the Earth used here for field slope."],
        ["Sentinel-2", "ESA satellites with 10 m images. The map uses a cloud-free mosaic of them to find field edges."],
      ],
      mapHint: "Click the middle of a large field and the page loads fresh NASA data for it. Zoom in with + to see where one field ends.",
      coordLabel: "Coordinates", coordButton: "Analyse point", coordPlaceholder: "Latitude, longitude, e.g. 52.01, 68.00",
      coordBad: "Enter latitude and longitude as two numbers, for example 52.01, 68.00.",
      livePoint: (lat, lon) => `Point ${lat} N, ${lon} E`,
      loadingWeather: "Loading weather since 1981 for this point…",
      weatherReady: "Weather is in, and everything below is now calculated for this point. Check that the point sits inside one field, at least 300 m from its edge.",
      weatherError: "NASA POWER did not answer. Check the internet connection and try again.",
      loadingNdvi: (d, t) => `Satellite history: ${d} of ${t} parts, newest years first.`,
      ndviDone: n => `Satellite history loaded: ${n} MODIS images.`,
      ndviError: "The MODIS archive did not answer. The page works from weather alone for now; the field history can be loaded later.",
      layerSat: "Satellite (ESA Sentinel-2 cloudless)", layerMap: "Map (OpenStreetMap)",

      tagline: "A fair test of a crop rotation takes about twenty years in the field. NASA satellites have already recorded those years. Run your rotation through your own field's past before you change anything.",
      pickField: "Fields",
      answerNote: "Prices, yields and costs in pass 3 are examples until you type in your own. All of this is a replay of past weather, not a forecast.",
      ribbonTitle: "Every day of the field since 2000, as MODIS saw it",
      ribbonSub: "One line per year, January on the left. Brown is bare soil, green is a growing crop, pale blue is snow.",
      ribbonDesc: "A grid of years and days coloured by vegetation greenness from MODIS satellite images.",
      legBare: "Bare soil", legGreen: "Green crop", legSnow: "Snow", legGap: "No clear image",
      legF: "F  looks like fallow", legQ: "?  unclear", legDry: "dry  very dry May to July",
      s1Title: "Build your rotation and compare it",
      s1Lead: "The first row is your rotation. Change any year, or try the three options below it. Every rotation is replayed through the daily weather of this field, {period}.",
      soil: "Soil", sowShift: "Sowing date", reset: "Reset to the starting example",
      soilLight: "Light (sandy loam)", soilMedium: "Medium (loam)", soilHeavy: "Heavy (clay loam)",
      shift: d => d === 0 ? "As usual" : (d < 0 ? `${-d} days earlier` : `${d} days later`),
      yourRotation: "Your rotation", option: k => `Option ${k}`,
      addYear: "Add a year", removeYear: "Remove the last year",
      yearOf: (i, name) => `Year ${i} of ${name}`,
      statIncome: "₸ per hectare a year, average",
      statCrops: "harvests in 10 years",
      statFail: "of harvests short of water",
      stripGood: "Crops got 75% or more of the water they needed",
      stripMid: "50 to 75%: water stress",
      stripBad: "less than half: a likely crop failure",
      stripNote: "Each square is one year, averaged over all fields of the rotation (one field in each stage every year).",
      after: (c, p) => `${STR.en.crops[c]} after ${STR.en.crops[p]}`,
      fieldLabels: {"shortandy": "Shortandy, Akmola", "kostanay": "Kostanay, by the M-36", "north_kz": "Molodezhnoye, North Kazakhstan", "taiynsha": "Taiynsha, North Kazakhstan", "pavlodar": "Voznesenka, Pavlodar", "osakarovka": "Osakarovka, Karaganda", "ubagan": "Ubagan, Kostanay", "esil": "Esil, Akmola"},
      tipField: (name, met, y) => `${name}: ${met}% of the water it needed, about ${y} t/ha`,
      tipFallow: "fallow: no harvest",
      s2Title: "What each rotation would have earned",
      s2Lead: "Income per hectare added up year after year, after costs. Enter your own yields, prices and costs and the lines move.",
      econTitle: "Your numbers",
      econCrop: "Crop", econYield: "Your usual yield, t/ha", econPrice: "Price, ₸/t", econCost: "Costs, ₸/ha",
      econFallowCost: "Fallow tillage, ₸/ha",
      econNote: "Your usual yield means the average you get now. The model raises it in wet years and lowers it in dry ones using FAO yield response factors. Prices: Kazakhstan market quotes 2024-2026. Yields and costs: examples, replace them.",
      moneyAxis: "Thousand ₸ per hectare, added up",
      moneySummary: (best, diff, years) => `With the example yields and costs above, ${best} comes out ${diff} ₸ per hectare a year ahead of your rotation over ${years}.`,
      moneySame: years => `With the example yields and costs above, your rotation earns the most of the four over ${years}.`,
      sATitle: "What to sow next spring",
      thisYear: "On this field this year", nextYear: "Next spring you sow",
      autumnLead: (year, rank, n, rain) => rank === 1
        ? `Autumn ${year}: the soil on this field is drier than in any autumn since 2000, by NASA POWER root-zone wetness. ${rain} mm of rain since 1 September.`
        : rank === n ? `Autumn ${year}: the soil on this field is wetter than in any autumn since 2000. ${rain} mm of rain since 1 September.`
        : `Autumn ${year}: the soil on this field is drier than in ${n - rank} of ${n - 1} autumns since 2000. ${rain} mm of rain since 1 September.`,
      autumnHead: (rel) => (rel >= 95 ? "In past years with an autumn like this one, the next season's crop got about as much of the water it needed as in an average year."
        : rel >= 80 ? "In past years with an autumn like this one, the next season's crop got somewhat less of the water it needed than in an average year."
        : "In past years with an autumn like this one, the next season's crop got clearly less of the water it needed than in an average year.") + " Not a forecast.",
      autumnAnswer: (next, prev, met, all, fails, k) => `After the ${k} most similar autumns, ${STR.en.crops[next]} after ${STR.en.crops[prev]} got ${met}% of the water it needed, against ${all}% in an average year, and fell short of water in ${fails} of ${k}.`,
      autumnNotForecast: "This compares past seasons that followed similar autumns; it is not a forecast of next year's harvest.",
      autumnRange: (lo, hi) => `In those years it ranged from ${lo}% to ${hi}%.`,
      autumnSignal: (r) => r >= 0.5 ? "On this field the autumn soil says a lot about the next season."
        : r >= 0.3 ? "On this field the autumn soil tells part of the story; the rain of the coming summer matters more."
        : "On this field the autumn soil says little about the next season; the rain of the coming summer decides most of it.",
      autumnFallow: "A fallow year makes no harvest, so there is nothing to compare for it here. Use pass 2 to see what fallow does to the crop after it.",
      autumnRow: (y) => `season after autumn ${y}`,
      autumnOutside: "This autumn is outside everything seen since 2000, so the years below are the nearest we have, not true look-alikes.",
      autumnAvg: "all years",
      autumnNote: "Most similar autumns: the closest root-zone soil wetness (NASA POWER GWETROOT, 15 September to 4 November) and autumn rain. Winter snow is still to come and can change the picture; the latest weeks of POWER data may be revised.",
      autumnChartLabel: "Autumn soil wetness and rain, each dot is one year",
      autumnX: "Root-zone soil wetness, 15 Sep to 4 Nov", autumnY: "Rain since 1 Sep, mm",
      s3Title: "Where the rain and snow went, and what happens to the soil",
      s3Lead: "Every millimetre that fell on the field, split by where it ended up. Only water that passes through a crop makes grain. Beside each rotation: how long the soil lies bare and what happens to soil carbon.",
      wCrops: "Through crops", wEvap: "Evaporated from soil", wDrain: "Drained below roots", wSnow: "Snow blown away", wRunoff: "Melt water ran off",
      bareDays: d => `${d} bare-soil days a year`,
      carbon: (c, h) => `soil carbon ${c} t/ha a year (humus ${h} t)`,
      carbonNote: "Soil carbon: rough estimate from abstracts of Takata et al. 2007-2008 (Shortandy). The authors note low predictive ability of their regression. Coefficients against the published ranges: pass 7.",
      seasonType: t => `Season shape (clustering): ${t}`,
      seasonNames: { "bare all season": "bare all season", "weak crop season": "weak crop", "strong crop season": "strong crop", "long green season": "long green season" },
      stressTitle: "Stress test: the driest summers on this field",
      stressLead: (years) => `How each rotation would have lived through the ${years.length} driest May–July periods since 2000 (${years.join(", ")}), by NASA POWER rain.`,
      stressCols: ["Rotation", "Water need met in those years", "Harvests short of water"],
      stressFail: (n, t) => `${n} of ${t}`,
      s4Title: "Strategy cards: why, evidence, gains, gaps and risks",
      s4Lead: "One card per rotation. Each says why it is on the table, what the NASA data show for this field, what it may give, what the tool does not know, and what to check with your agronomist.",
      cardWhy: "Why it is suggested", cardEvidence: "What the data show for this field", cardGain: "What it may give, compared with your rotation",
      cardGaps: "Where information is missing", cardRisks: "Risks to check locally",
      why: {
        A: "This is the rotation the field follows today, or the one you entered. Every other card is measured against it.",
        AIf: "A rotation with fallow one year in four, the traditional practice of the region. MODIS shows no fallow-like year on this field since 2000, so this card is a what-if: enter what you actually grow in pass 2. Every other card is measured against it.",
        B: "Pea in place of fallow was tested in the Shortandy trial (Suleimenov et al., 2005, 2000-2002): about 10% more grain from the whole area than with fallow, less than with oats; barley after pea was weak, and wild oat was twice as abundant (pea got no herbicide). Pea fixes its own nitrogen.",
        C: "Oats in place of fallow gave the most grain in the Shortandy trial (Suleimenov et al., 2005, 2000-2002): about 30% more from the whole area than with fallow (2.07 against 1.59 t/ha). Oats cover the soil all season and give grain or forage.",
        D: "Lentil and flax break the cereal chain twice. This sequence was put together by the team and has not been tested in a trial we could cite.",
        custom: (changes) => `Your own variant: ${changes}.`,
        noFallow: "it has no fallow year", addsLegume: "it adds a legume", addsBreak: "it adds a non-cereal break crop", same: "same crops as your rotation, in a different order",
      },
      ev: {
        water: (span, through, evap) => `NASA POWER weather ${span}: ${through}% of the rain and snow went through crops, ${evap}% evaporated from the soil.`,
        met: (met, fail) => `Crops got ${met}% of the water they needed on average and fell short in ${fail}% of crop-years.`,
        sowing: (what, mm) => `${what}: ${mm} mm of soil water at sowing on average.`,
        modis: (years) => `MODIS shows fallow-like years on this field: ${years}.`,
        modisNone: "MODIS shows no clear fallow year on this field since 2000.",
      },
      gain: {
        base: "This is the baseline.",
        moneyLink: "Money: see pass 3. The yields and costs there are examples; enter your own.",
        // v is the size of the change without a sign; more says which way it went
        harvests: (v, more) => `${v} ${more ? "more" : "fewer"} harvests in 10 years`,
        failures: (v, more) => `${v} points ${more ? "more" : "fewer"} harvests short of water`,
        carbon: (v, more) => `${v} t ${more ? "more" : "less"} soil carbon per hectare a year`,
        bare: (v, more) => `${v} ${more ? "more" : "fewer"} days of tilled bare soil a year`,
        same: { harvests: "Harvests in 10 years: the same", failures: "Harvests short of water: the same share",
                carbon: "Soil carbon: the same", bare: "Days of tilled bare soil: the same" },
        better: "better", worse: "worse", noChange: "no change",
      },
      gaps: {
        weather: "Weather comes from a NASA POWER grid tens of kilometres wide: it describes the district, not this field.",
        sowing: "Sowing dates and growth-stage lengths are typical values, not yours.",
        ky: (c) => `${c}: how its yield responds to water is an assumption.`,
        pea: "Field pea: crop coefficients, root depth and stress threshold follow FAO-56 Tables 17 and 22; the sowing date is an assumption.",
        nitrogen: "Nitrogen left by legumes or released in fallow is not counted.",
        money: "Prices are market quotes; yields and costs are examples until you enter yours.",
      },
      seeNot: "What the model does not see", askLocal: "Ask locally",
      fData: "Data",
      fDataText: "Vegetation: MODIS Terra NDVI, 250 m, every 16 days since 2000; for Kostanay, Shortandy and Molodezhnoye MOD13Q1 V061 (Collection 6.1) from NASA ORNL DAAC TESViS with its quality band, for the five other fields read from NASA GIBS map tiles (layer MODIS_Terra_L3_NDVI_16Day) without a quality band. Weather: NASA POWER daily agroclimatology, a grid tens of kilometres wide, so it describes the district, not the single field. NASA POWER root-zone soil wetness (GWETROOT) is used for the autumn comparison and to cross-check the model in pass 7.",
      fMethod: "Method",
      fMethodText: "Daily soil water balance after FAO Irrigation and Drainage Paper 56: Penman-Monteith reference evapotranspiration, dual crop coefficient, water stress coefficient. Yield response to water after FAO Paper 33, used only for the money section. Snow, stubble and sowing dates are simplified assumptions, listed with their sources in the project repository. Fallow years come from NDVI thresholds; k-means clustering of the yearly NDVI curves gives the same fallow / not fallow answer in 185 of 185 field-years with a clear threshold label (31 unclear or unfinished years not compared).",
      fLimits: "Limits",
      fLimitsText: "This tool supports a decision; it does not make it. Crop parameters marked as assumed in the repository still need checking. Nitrogen from legumes, weeds and diseases are not modelled. Against the Shortandy trial the model's fallow advantage falls in the published range on average over 2000-2002 but not in single years. Treat the numbers as a comparison between rotations, not as a promise.",
      ans: {
        fallowMain: (crop, mm) => `A fallow year gave the next ${STR.en.crops[crop]} ${mm} mm more water at sowing.`,
        fallowSub: (pct, L, evap) => `That is about ${pct}% of an average July's rain on this field. It cost one harvest in ${L}, and ${evap}% of all rain and snow evaporated from the soil.`,
        fallowLess: (crop, mm) => `On this field a fallow year left the next ${STR.en.crops[crop]} with ${mm} mm less water at sowing than other years.`,
        noFallowMain: "Your rotation has no fallow year.",
        noFallowSub: (through, evap) => `${through}% of the rain and snow goes through crops and ${evap}% evaporates from the soil.`,
        money: (mine, best, diff) => `With ${mine ? "your" : "the example"} prices and yields in pass 3, “${best}” would have earned ${diff} ₸ more per hectare a year than your rotation.`,
        moneySame: (mine) => `With ${mine ? "your" : "the example"} prices and yields in pass 3, your rotation earned the most of the four options.`,
      },
      crops: { fallow: "fallow", wheat: "wheat", barley: "barley", oats: "oats", pea: "pea", lentil: "lentil", flax: "flax" },
      cropTitle: { fallow: "Fallow", wheat: "Spring wheat", barley: "Barley", oats: "Oats", pea: "Field pea", lentil: "Lentil", flax: "Flax" },
      notes: {
        fallow: ["Weed control, one of the main reasons farmers keep fallow. Nitrogen released in fallow.", "How much of your fallow is for moisture and how much for weeds? What do the tillage passes cost you?"],
        wheat: ["Diseases and weeds that build up when wheat follows wheat.", "Which wheat diseases are common in your district after two cereals in a row?"],
        barley: ["Feed or malting quality, which changes the price a lot.", "Who buys barley near you, and at what quality?"],
        oats: ["Cereal diseases, since oats add a fourth cereal.", "Do you have livestock or a forage buyer?"],
        pea: ["Nitrogen the pea leaves for the next wheat. Pea diseases and harvest losses. Wild oat control: in the Shortandy trial weeds were twice as abundant in the pea rotation.", "Is there a buyer and an elevator for pea nearby? Seed, inoculant, a herbicide against wild oat, the crop to grow after pea, and can your combine harvest it cleanly?"],
        lentil: ["Nitrogen for the next crop. Lentil is low and harvest is demanding. Its water response factor is assumed.", "Red or green lentil, who buys it, and herbicide carry-over from the previous crop?"],
        flax: ["Flax straw and seed prices swing widely. Its water response factor is assumed.", "Market for flax seed, and how will you handle the tough straw?"],
      },
      yearsRange: (a, b) => `${a} to ${b}`,
      partialRange: (a, b, d) => `${a}–${b} (${b} to ${d})`, dateLocale: "en-GB",
      fieldMeta: (lat, lon, rain, a, b) => `${lat} N, ${lon} E. Rain and snow ${rain} mm a year, mean of the complete years ${a} to ${b}. NASA POWER.`,
      ribbonTip: (date, ndvi, note) => `${date}\n${ndvi}${note ? "\n" + note : ""}`,
      ndviBare: "bare soil", ndviThin: "thin cover", ndviGreen: "green crop", ndviSnow: "snow", ndviGap: "no clear image",
      status: { "likely fallow": "This year looks like fallow.", "unclear": "Unclear year.", "long green season": "Green for most of the season: grass or a long crop?", "cropped": "", "incomplete year": "" },
      dryNote: "Very dry May to July.",
      months: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
      markFallow: "F", markDry: "dry",
      stripAria: name => `${name}: water supply by year`,
      thatYear: "that year",
      numberLocale: "en-US",
      langName: "English",
    },
    ru: {
      brand: DATA.project_name || "Up To Para",
      mapOffline: "Карту загрузить не удалось (нет интернета или сервис карт заблокирован). На схеме показано, где поля; нажмите на поле, чтобы выбрать его. Всё, что ниже, работает на данных, встроенных в эту страницу.",
      mapSketchAria: "Схема подготовленных полей",
      smapAxis: "тот же день в другие годы",
      smapLoading: "Читаю сегодняшнюю влажность почвы из NASA SMAP…",
      smapNote: "NASA SMAP Level-4, влажность корневого слоя, значение снято с карты NASA GIBS. Одно число на клетку 9 км: это район, а не одно поле.",
      smapBig: (d, v, diff, y0, y1) => `Почва сейчас, ${d}: ${v} м³ воды на м³ в верхнем метре. Это на ${Math.abs(diff)}% ${diff < 0 ? 'суше' : 'влажнее'}, чем в этот же день в ${y0}–${y1} годах.`,
      gridWater: "вода или нет данных",
      gridYearTip: (y, sh, own) => `${y}: голой была ${sh}% земли вокруг` + (own ? ', и ваше поле' : ''),
      gridTip: (n, t, list) => `Голая ${n} лет из ${t}` + (list ? `: ${list}` : ''),
      gridYearsLabel: "Доля земли вокруг поля, голой летом. Соломенный столбик — ваше поле тоже было голым.",
      gridSummary: (n, t, years, avg, share) => `Ваше поле стояло голым ${n} лет из ${t}${years ? ' (' + years + ')' : ''}. Земля вокруг — в среднем ${avg}. Ваше поле бывало голым чаще, чем ${share}% земли вокруг.`,
      gridError: "NASA GIBS не ответил, поэтому карты соседей нет.",
      gridLoading: (d, t) => `Читаю летние снимки MODIS из NASA GIBS: ${d} из ${t}…`,
      gridSub: "4 × 4 км вокруг поля, квадрат — пиксель MODIS. Чем ярче охра, тем больше лет земля летом стояла голой: под паром или после неудачного посева.",
      gridTitle: "Поле и соседи",
      s0Title: "Что увидел спутник и что на самом деле дал пар",
      pass6: "Пролёт 6",
      pass7: "Пролёт 7",
      // Fallow Audit, доказательная часть
      fa: {
        warnLow: (m, lo, hi, n, gibs, date, th) => `Проверьте это поле: летняя зелень здесь низкая (медиана NDVI ${m} против ${lo}–${hi} на других полях). Порог ${th} может принимать слабые посевы за пар, поэтому часть из ${n} похожих на пар лет может оказаться слабыми посевами.` +
          (gibs ? ` NDVI этого поля прочитан с картографических тайлов NASA GIBS${date ? `; прямая сверка с ORNL ${date} была невозможна` : ""}.` : ""),
        warn: (n, t) => `Проверьте эту точку: в ${n} годах из ${t} поле оставалось зелёным дольше, чем яровая культура. Возможно, точка стоит на залежи, многолетних травах или небольшой опытной делянке, а не на одном поле с однолетними культурами. Перед тем как доверять аудиту пара, нужно проверить координаты.`,
        headTilled: (x, y, name) => `Дней обработанной голой почвы в году: ${x} сейчас → ${y} — ${name}.`,
        headNoTilled: "В вашем севообороте нет обработанного голого пара.",
        headTilledIf: (x, y, name) => `Дней обработанной голой почвы в году, если бы на этом поле был пар: ${x} → ${y} — ${name}. MODIS не видит здесь паровых лет с 2000 года, так что это расчёт «что если».`,
        waterLineIf: (crop, mm, stay) => `Год пара дал бы следующей культуре (${crop}) на ${mm} мм больше влаги к посеву, но в почве осталось бы только ${stay}% дождя и снега от уборки предшественника до этого посева; остальное испарилось бы, ушло вглубь или было бы сдуто вместе со снегом.`,
        waterLessIf: (crop, mm) => `На этом поле после года пара у следующей культуры (${crop}) к посеву было бы на ${mm} мм меньше влаги, чем в другие годы.`,
        cropsLineIf: (c0, c1, name, m0, m1) => `Урожаев за 10 лет: ${c0} с паром, ${c1} — ${name}. В среднем каждая культура получала бы ${m0}% нужной ей воды с паром и ${m1}% в этом варианте: урожаев больше, но каждому чуть меньше воды.`,
        statTilled: "дней обработанной голой почвы в год",
        moneyBanner: "Урожайности и затраты — примеры. Впишите свои: порядок вариантов может измениться.",
        waterLine: (crop, mm, stay) => `Год пара дал следующей культуре (${crop}) на ${mm} мм больше влаги к посеву, но в почве осталось только ${stay}% дождя и снега от уборки предшественника до этого посева; остальное испарилось, ушло вглубь или сдуто вместе со снегом.`,
        waterLess: (crop, mm) => `На этом поле после года пара у следующей культуры (${crop}) к посеву было на ${mm} мм меньше влаги, чем в другие годы.`,
        cropsLine: (c0, c1, name, m0, m1) => `Урожаев за 10 лет: ${c0} сейчас, ${c1} — ${name}. В среднем каждая культура получала ${m0}% нужной ей воды сейчас и ${m1}% в этом варианте: урожаев больше, но каждому чуть меньше воды.`,
        note: "Это повтор прошлой погоды на этом поле, а не прогноз. Деньги — в пролёте 3: урожайности и затраты там примерные, их нужно заменить своими.",
        bareSplit: (t, s) => `${t} дней обработанной голой почвы и ${s} дней стерни или посевного ложа в год`,
        windowTitle: "Куда ушли дождь и снег за период пара, от уборки предшественника до посева пшеницы",
        windowFallow: (mm) => `Пар, ${mm} мм`,
        windowStubble: (mm) => `Одна зима на стерне пшеницы, ${mm} мм`,
        wStay: "Осталось в почве",
        windowNote: (n) => `Ваш севооборот с настройками выше, среднее по ${n} периодам пара; модель на погоде NASA POWER. Для сравнения: USDA ARS пишет о системе пшеница-пар на Великих равнинах США, что «fallow loses 65 to 80 percent of precipitation to evaporation» (AgResearch Magazine, январь 2011), то есть пар теряет 65–80 % осадков на испарение. Это доля, потерянная на испарение, а не доля, сохранённая в почве.`,
        windowNone: "В вашем севообороте нет пара, поэтому показывать период пара не для чего.",
        checksTitle: "Проверки по полевым опытам и другим данным",
        checksLead: "Насколько модели можно доверять на этом поле. Каждая проверка говорит, что с чем сравнивается, что получилось и чего она показать не может. Используется исходный пример севооборота с почвой и сроками сева по умолчанию.",
        gwTitle: "Влага в почве против корнеобитаемой влажности NASA POWER (GWETROOT)",
        gwLead: (n, may, sep) => `Модельная влага в слое 0–120 см (пар-пшеница-пшеница-ячмень, среднее по 4 фазам) против среднего GWETROOT за 7 дней вокруг даты, ${n} лет: r = ${may} на 1 мая, r = ${sep} на 15 сентября.`,
        gwCols: ["Дата", "r", "r по рангам", "3 самых сухих года", "3 самых влажных года"],
        gwDates: { may_1: "1 мая", sep_15: "15 сентября" },
        gwModel: "Модель", gwPower: "POWER",
        gwCommon: (k) => `общих: ${k} из 3`,
        strength: (r) => Math.abs(r) >= 0.7 ? "сильная" : Math.abs(r) >= 0.4 ? "умеренная" : "слабая",
        gwNote: "GWETROOT — индекс влажности от 0 до 1 для ячейки сетки NASA POWER размером в десятки километров, со своей почвой и своей глубиной слоя, поэтому сравниваются только колебания от года к году. Он берётся из той же системы NASA POWER, что и погода, на которой считает модель, поэтому совпадение отчасти объясняется общей погодой: проверка показывает, что запас воды в модели растёт и падает вместе с оценкой NASA, но не показывает, что почва этого поля ведёт себя так же. «Сильная», «умеренная» и «слабая» — по правилу большого пальца (|r| 0,7 и 0,4).",
        trialTitle: "Сверка с опытом в Шортанды (Suleimenov et al., 2005)",
        trialLead: (years, checked) => `Опыт в Шортанды (${years}) сравнивал пар-пшеница-пшеница-ячмень с вариантами, где вместо пара сеяли овёс или горох. Статья даёт преимущество пара по влаге к посеву пшеницы и урожайность; рядом стоят числа модели для этой точки. Опубликованные числа: ${checked}.`,
        trialCols: ["Что сравнивается", "Модель", "Опубликовано", "Модель против статьи"],
        rowLabel: {
          fallow_advantage_at_sowing: "Прибавка доступной влаги к посеву яровой пшеницы после пара по сравнению с пшеницей по стерне",
          wheat_after_fallow_direction: "Пшеница по пару против пшеницы после овса и после гороха",
          water_at_sowing_wheat_after_pea: "Влага к посеву, пшеница после гороха",
          water_at_sowing_wheat_after_oats: "Влага к посеву, пшеница после овса",
          fallow_gain: "Прирост влаги за пар, от уборки предшественника до посева пшеницы",
          fallow_storage_efficiency: "Доля осадков, сохранённых паром (прирост влаги / дождь и снег)",
        },
        pubText: {
          fallow_advantage_at_sowing: "+20…+30 мм в двух годах из трёх; −20 мм в 2001 г. (на стерне влажнее)",
          wheat_after_fallow_direction: "пшеница по пару дала на 20–25 % больше зерна, чем после овса и после гороха",
        },
        noteText: {
          fallow_advantage_at_sowing: "статья не называет два года с +20…+30 мм; раз 2001 исключён, это могут быть только 2000 и 2002",
        },
        measure: {
          wheat_after_fallow_direction: "доля нужной пшенице воды, которую она получила (урожай модель не считает)",
        },
        within: "в пределах +20…+30 мм",
        outside: (pos, d) => `${pos === "above" ? "выше" : "ниже"} диапазона +20…+30 мм на ${d} мм`,
        opposite: (pub, model) => `статья ${pub} мм, модель ${model} мм: знак противоположный`,
        sameSign: (pub, model) => `статья ${pub} мм, модель ${model} мм: знак совпадает`,
        reference: "для справки",
        depthDiffers: " (другая глубина слоя: напрямую не сравнить)",
        sameDirection: "Направление совпадает: пшеница по пару на первом месте и там, и там",
        otherDirection: "Направление разное",
        directionNote: "сравнивается только направление: урожай модель не считает",
        notReported: "в статье нет",
        verdict: (years, mean, inRange, oppYear) => `В среднем за ${years} преимущество пара в модели (${mean} мм) ${inRange ? "попадает" : "не попадает"} в опубликованный диапазон, но отдельные годы модель не воспроизводит` + (oppYear ? `: в ${oppYear} г. в опыте стерня была влажнее, а в модели нет` : "") + ". Модель описывает поведение поля за много лет на погоде масштаба района, а не один год на опытной делянке.",
        explain: (y, pub, model) => `В ${y} г. статья нашла стерню влажнее пара (${pub} мм); модель даёт ${model} мм. Вероятные причины: модель считает на погоде ячейки NASA POWER, а не опытной станции, и не знает реальной обработки, стерни и снега в опыте.`,
        quote: (page, q) => `Статья (${page.replace("p.", "с.")}): «${q}»`,
        trialMeasuredTitle: "Что измерил опыт (не модель)",
        trialTableCols: ["Севооборот", "Урожай зерна по культурам, т/га", "Со всей площади, т/га", "Против контроля", "Сорняки, г/м² сухой массы"],
        control: "контроль",
        trialCaption: (table, years, model) => `${table.replace("Table 1, p. 144: grain yield, t/ha, mean of 2000-2002", "Таблица 1, с. 144: урожай зерна, т/га, среднее за 2000–2002")}. Опыт длился 3 года (${years}); модель охватывает сезоны ${model}.`,
        trialNotes: ["Сорняков, в основном овсюга, в севообороте с горохом было вдвое больше; горох не обрабатывали гербицидом.", "Ячмень после гороха дал низкий урожай."],
        station: (p, t, rain, t2, years) => `Опытная станция: ${p} мм дождя и снега в год и ${t} °C. Ячейка NASA POWER, ${years}: ${rain} мм и ${t2} °C. Станция против ячейки сетки в десятки километров, и годы разные.`,
        carbonCheckTitle: "Углерод почвы против Takata et al. 2007–2008 (по аннотациям)",
        carbonCheck: (v, inside) => `В этой модели переход от пшеницы с паром к беспрерывной пшенице меняет углерод почвы на ${v} т C/га в год (та же погода, почва по умолчанию). Takata et al. (2008) оценивают такой переход в Шортанды в +0,1…+0,3 т C/га в год: здесь модель ${inside ? "внутри" : "вне"} этого диапазона.`,
        carbonCoeffs: "Углерод почвы — грубая оценка по аннотациям Takata et al. 2007–2008 (Шортанды); сами авторы отмечают низкую предсказательную силу своей регрессии. Коэффициенты и опубликованные диапазоны: год пара −0,8 т C/га (Takata et al. 2007: паровые поля около −0,8); поступление с остатками 1,3 т C/га в год (Takata et al. 2008: 1,0–1,6; второе исследование 2008 г.: 0,9–1,4 за сезон); дыхание поля с культурой 1,1 т C/га в год (1,0–1,2; 0,9–1,1). Все три числа внутри опубликованных диапазонов. То, что поступление с остатками растёт вместе с ростом культуры при нехватке воды, — наше допущение. Источники: doi 10.1111/j.1747-0765.2007.00127.x, 10.1111/j.1747-0765.2007.00217.x, 10.1111/j.1747-0765.2007.00298.x.",
      },
      pass5: "Пролёт 5",
      pass4: "Пролёт 4",
      pass3: "Пролёт 3",
      pass2: "Пролёт 2",
      pass1: "Пролёт 1",
      readoutNone: (y) => `${y}: снимков пока нет.`,
      readoutGrid: (y, v) => `${y}: NDVI поля в середине лета ${v}.`,
      readout: (y, what, dry, green) => `${y}: ${what}.` + (green !== undefined ? ` Зелёным поле было ${green} дн.` : '') + (dry ? ' Сухой год.' : ''),
      yearWord: {"likely fallow": "голое всё лето: пар или неудачный посев", "unclear": "неясно: пар или слабый посев", "long green season": "зелёное почти весь сезон", "cropped": "был посев", "incomplete year": "год ещё не закончился"},
      pauseLabel: "Пауза",
      playLabel: "Прокрутить годы",
      seasons: {"161": "середина июня", "193": "середина июля", "225": "середина августа"},
      seasonLabel: "Время лета",
      tlTitle: "Поле лето за летом",
      loaderHide: "Скрыть, пусть грузится",
      loaderNote: "История со спутника идёт из NASA GIBS, это около 25 МБ, обычно меньше минуты. Если GIBS не ответит, страница обратится к более медленному архиву ORNL. Страница начнёт заполняться, как только придёт погода.",
      ldGrid: "Соседи 4 × 4 км, каждое лето",
      ldNdvi: "Снимки MODIS с 2000 года",
      ldWeather: "Погода NASA POWER с 1981 года",
      loaderTitle: "Собираем историю поля",
      smapDateNote: (d) => `Карта за ${d}.`,
      legGrid: (y) => `Охра — земля стояла голой летом ${y} года, светлая охра — неясно.`,
      legSmap: ["сухо", "влажно"],
      legNdvi: ["голо", "густой посев"],
      gridToggle: "Голая земля выбранным летом",
      modes: {"s2": ["Чёткий снимок", "Sentinel-2, 2020 год, 10 м"], "ndvi": ["Зелень", "MODIS NDVI за год на шкале внизу"], "color": ["Тот самый день", "MODIS в цвете, бывают облака"], "smap": ["Влажность почвы сейчас", "NASA SMAP, верхний метр"], "osm": ["Дороги и сёла", "OpenStreetMap"]},
      lensTitle: "Что на карте",
      scTitle: "Что если климат изменится? Ползунки осадков и температуры",
      scLead: "Те же годы, но с меньшим или большим количеством осадков и более тёплым климатом. Эвапотранспирация и снег пересчитываются по сдвинутым температурам NASA POWER; влажность воздуха, ветер и солнце остаются как были записаны.",
      scRain: "Осадки, изменение", scTemp: "Температура, теплее на",
      scNote: (r, t) => `Включён сценарий: осадки ${r > 0 ? "+" : ""}${r}%, температура +${t} °C. Все цифры на странице считаются с ним.`,
      prTitle: "Ваши приоритеты и ограничения",
      prLead: "Укажите, что для вас важнее и какие культуры вы реально можете вырастить и продать. Севообороты будут ранжированы под вас; сами цифры не меняются.",
      prNames: { income: "Доход", water: "Меньше урожаев с нехваткой воды", soil: "Углерод и гумус почвы", bare: "Меньше дней голой почвы" },
      prLevels: ["не важно", "немного", "важно", "очень важно"],
      prCrops: "Культуры, которые вы можете вырастить и продать",
      fit: (best, next) => `Лучше всего под ваши приоритеты: ${best}${next ? `. Следом: ${next}` : ""}.`,
      fitNone: "Ни один севооборот не подходит: в каждом есть исключённая вами культура.",
      badgeRank: (n) => `№${n} по вашим приоритетам`, badgeOut: "есть исключённая культура",
      ppTitle: "Агрохимический паспорт поля (по желанию)",
      ppLead: "Перепишите несколько чисел из агрохимического паспорта поля. Гранулометрический состав задаёт, сколько воды держит почва; гумус превращает грубую оценку углерода в грубую оценку гумуса. Ничего не покидает ваш браузер.",
      pp: { year: "Год обследования", humus: "Гумус, %", texture: "Гранулометрический состав", depth: "Глубина отбора, см", density: "Плотность почвы, г/см³",
            p: "Подвижный фосфор P₂O₅, мг/кг", k: "Обменный калий K₂O, мг/кг", ph: "pH", fallow: "Годы пара по вашим записям, например 2016, 2020, 2024" },
      textures: { "": "не указан", sand: "песок", loamy_sand: "супесь лёгкая", sandy_loam: "супесь", loam: "суглинок", silt_loam: "пылеватый суглинок", clay_loam: "тяжёлый суглинок", clay: "глина" },
      ppHumus: (now, later, years, rot) => `Грубая оценка гумуса для варианта «${rot}»: сейчас ${now}%, примерно ${later}% через ${years} лет, если севооборот не менять (см. проверку углерода в пролёте 7).`,
      ppNPK: "Фосфор, калий и pH сохраняются вместе с полем, но модель их пока не использует.",
      humusLine: (now, later) => `гумус ${now}% → ${later}% через 10 лет (грубая оценка)`,
      records: (m, t, extra) => `Ваши записи: ${m} из ${t} паровых лет спутник тоже нашёл.` + (extra.length ? ` Спутник отмечает ещё ${extra.join(", ")}: засуха или погибший посев?` : ""),
      recordsMissed: (y) => ` Не видно со спутника: ${y.join(", ")}.`,
      slope: (s, e, risk) => `Уклон поля по высотам AWS Terrain Tiles (построены в основном по NASA SRTM): ${s}%, высота около ${e} м над уровнем моря. Риск водной эрозии на голой почве: ${risk}.`,
      slopeRisk: ["низкий", "средний", "высокий"],
      slopeFail: "",
      frostAll: (list) => `Годы с заморозком −2 °C и ниже между всходами и уборкой (минимальная температура NASA POWER): ${list}.`,
      glTitle: "Термины на этой странице",
      glossary: [
        ["NDVI", "Индекс зелёности, который считают по красному и ближнему инфракрасному свету, видимому со спутника. Голая почва — около 0,1–0,3, густой зелёный посев — 0,6–0,9."],
        ["Пар", "Поле, оставленное на сезон без культуры; его обрабатывают против сорняков и чтобы накопить влагу для следующей культуры."],
        ["Эвапотранспирация", "Вода, которая уходит с поля паром: испарение с почвы плюс транспирация через растения."],
        ["Покрытие потребности в воде", "Доля воды, которую культура получила, от той, что она взяла бы при достаточной влаге. Меньше половины — вероятный неурожай."],
        ["Влажность корневого слоя", "Насколько влажен верхний метр почвы, по шкале от 0 (сухо) до 1 (насыщено), по данным NASA POWER."],
        ["Углерод и гумус почвы", "Органическое вещество в почве. Гумус примерно на 58% состоит из углерода. Пар его сжигает, пожнивные остатки и корни пополняют."],
        ["FAO-56", "Международная методика Продовольственной и сельскохозяйственной организации ООН для расчёта водопотребления культур; здесь по ней считается суточный водный баланс."],
        ["NASA POWER", "Бесплатный архив NASA с ежедневной погодой и влажностью почвы для любой точки Земли с 1981 года, построенный по спутникам и моделям."],
        ["MODIS", "Приборы на спутниках NASA Terra и Aqua. Здесь: индекс растительности каждые 16 дней с разрешением 250 м с 2000 года."],
        ["SRTM", "Радарная топографическая съёмка NASA с шаттла — карта высот Земли; здесь по ней считается уклон поля."],
        ["Sentinel-2", "Спутники ESA со снимками 10 м. Карта использует их безоблачную мозаику, чтобы видеть границы полей."],
      ],
      mapHint: "Щёлкните по середине большого поля, и страница загрузит для него свежие данные NASA. Приблизьте карту кнопкой +, чтобы видеть, где кончается поле.",
      coordLabel: "Координаты", coordButton: "Анализировать точку", coordPlaceholder: "Широта, долгота, например 52.01, 68.00",
      coordBad: "Введите широту и долготу двумя числами, например 52.01, 68.00.",
      livePoint: (lat, lon) => `Точка ${lat} с. ш., ${lon} в. д.`,
      loadingWeather: "Загружаю погоду с 1981 года для этой точки…",
      weatherReady: "Погода загружена, и всё ниже уже посчитано для этой точки. Проверьте, что точка внутри одного поля и не ближе 300 м к краю.",
      weatherError: "NASA POWER не ответил. Проверьте подключение к интернету и попробуйте ещё раз.",
      loadingNdvi: (d, t) => `История со спутника: ${d} из ${t} частей, сначала последние годы.`,
      ndviDone: n => `История поля загружена: ${n} снимков MODIS.`,
      ndviError: "Архив MODIS не ответил. Пока страница считает только по погоде, историю поля можно загрузить позже.",
      layerSat: "Спутник (ESA Sentinel-2 cloudless)", layerMap: "Карта (OpenStreetMap)",

      tagline: "Чтобы честно проверить севооборот в поле, нужно лет двадцать. Спутники NASA эти годы уже сняли. Прогоните свой севооборот через прошлое своего поля, а потом решайте, менять ли его.",
      pickField: "Поля",
      answerNote: "Цены, урожайность и затраты в третьем пролёте даны для примера, пока вы не введёте свои. Всё это повтор прошлой погоды, а не прогноз.",
      ribbonTitle: "Каждый день поля с 2000 года глазами MODIS",
      ribbonSub: "Одна строка — один год, январь слева. Коричневое — голая почва, зелёное — растущий посев, бледно-голубое — снег.",
      ribbonDesc: "Сетка лет и дней, раскрашенная по зелёности растительности на снимках спутника MODIS.",
      legBare: "Голая почва", legGreen: "Зелёный посев", legSnow: "Снег", legGap: "Нет чистого снимка",
      legF: "П — похоже на пар", legQ: "? — неясно", legDry: "сух — очень сухие май–июль",
      s1Title: "Соберите свой севооборот и сравните",
      s1Lead: "Первая строка — ваш севооборот. Измените любой год или попробуйте три варианта ниже. Каждый севооборот прогоняется через ежедневную погоду этого поля, {period}.",
      soil: "Почва", sowShift: "Срок посева", reset: "Вернуть начальный пример",
      soilLight: "Лёгкая (супесь)", soilMedium: "Средняя (суглинок)", soilHeavy: "Тяжёлая (глинистая)",
      shift: d => d === 0 ? "Как обычно" : (d < 0 ? `на ${-d} дней раньше` : `на ${d} дней позже`),
      yourRotation: "Ваш севооборот", option: k => `Вариант ${k}`,
      addYear: "Добавить год", removeYear: "Убрать последний год",
      yearOf: (i, name) => `Год ${i}: ${name}`,
      statIncome: "₸ с гектара в год, в среднем",
      statCrops: "урожаев за 10 лет",
      statFail: "урожаев с нехваткой воды",
      stripGood: "Культура получила 75% нужной воды и больше",
      stripMid: "50–75%: водный стресс",
      stripBad: "меньше половины: вероятный неурожай",
      stripNote: "Каждый квадрат — год, в среднем по всем полям севооборота (каждый год одно поле на каждой стадии).",
      after: (c, p) => `${STR.ru.cropTitle[c]} по ${STR.ru.cropDat[p]}`,
      cropDat: { fallow: "пару", wheat: "пшенице", barley: "ячменю", oats: "овсу", pea: "гороху", lentil: "чечевице", flax: "льну" },
      fieldLabels: {"shortandy": "Шортанды, Акмолинская", "kostanay": "Костанай, у трассы М-36", "north_kz": "Молодёжное, Северо-Казахстанская", "taiynsha": "Тайынша, Северо-Казахстанская", "pavlodar": "Вознесенка, Павлодарская", "osakarovka": "Осакаровка, Карагандинская", "ubagan": "Убаган, Костанайская", "esil": "Есиль, Акмолинская"},
      tipField: (name, met, y) => `${name}: ${met}% нужной воды, около ${y} т/га`,
      tipFallow: "пар: урожая нет",
      s2Title: "Сколько заработал бы каждый севооборот",
      s2Lead: "Доход с гектара после затрат, накопленный год за годом. Введите свою урожайность, цены и затраты — линии пересчитаются.",
      econTitle: "Ваши цифры",
      econCrop: "Культура", econYield: "Ваш обычный урожай, т/га", econPrice: "Цена, ₸/т", econCost: "Затраты, ₸/га",
      econFallowCost: "Обработка пара, ₸/га",
      econNote: "Обычный урожай — это ваш средний урожай сейчас. Модель повышает его во влажные годы и снижает в сухие по коэффициентам реакции урожая на воду FAO. Цены: рыночные котировки Казахстана 2024–2026. Урожайность и затраты — примеры, замените их.",
      moneyAxis: "Тыс. ₸ с гектара, нарастающим итогом",
      moneySummary: (best, diff, years) => `При примерных урожаях и затратах выше, ${best} опережает ваш севооборот на ${diff} ₸ с гектара в год за ${years}.`,
      moneySame: years => `При примерных урожаях и затратах выше, ваш севооборот зарабатывает больше всех четырёх за ${years}.`,
      sATitle: "Что сеять весной",
      thisYear: "На этом поле в этом году", nextYear: "Весной вы сеете",
      autumnLead: (year, rank, n, rain) => rank === 1
        ? `Осень ${year}: почва на этом поле суше, чем в любую осень с 2000 года, по влажности корневого слоя NASA POWER. С 1 сентября выпало ${rain} мм.`
        : rank === n ? `Осень ${year}: почва на этом поле влажнее, чем в любую осень с 2000 года. С 1 сентября выпало ${rain} мм.`
        : `Осень ${year}: почва на этом поле суше, чем в ${n - rank} из ${n - 1} осеней с 2000 года. С 1 сентября выпало ${rain} мм.`,
      autumnHead: (rel) => (rel >= 95 ? "В прошлые годы после похожей осени культура следующего сезона получала примерно столько же нужной ей воды, сколько в средний год."
        : rel >= 80 ? "В прошлые годы после похожей осени культура следующего сезона получала немного меньше нужной ей воды, чем в средний год."
        : "В прошлые годы после похожей осени культура следующего сезона получала заметно меньше нужной ей воды, чем в средний год.") + " Это не прогноз.",
      autumnAnswer: (next, prev, met, all, fails, k) => `После ${k} самых похожих осеней культура «${STR.ru.cropTitle[next].toLowerCase()} по ${STR.ru.cropDat[prev]}» получала ${met}% нужной воды против ${all}% в средний год, а нехватка воды случилась в ${fails} из ${k} лет.`,
      autumnNotForecast: "Это сравнение с прошлыми сезонами после похожих осеней, а не прогноз урожая на следующий год.",
      autumnRange: (lo, hi) => `В эти годы — от ${lo}% до ${hi}%.`,
      autumnSignal: (r) => r >= 0.5 ? "На этом поле осенняя почва многое говорит о следующем сезоне."
        : r >= 0.3 ? "На этом поле осенняя почва объясняет часть картины; дожди будущего лета важнее."
        : "На этом поле осенняя почва мало говорит о следующем сезоне; больше всего решают дожди будущего лета.",
      autumnOutside: "Эта осень выходит за всё, что было с 2000 года, поэтому годы ниже — ближайшие из имеющихся, а не настоящие двойники.",
      autumnFallow: "Пар не даёт урожая, поэтому здесь сравнивать нечего. Что пар даёт следующей культуре, видно во втором пролёте.",
      autumnRow: (y) => `сезон после осени ${y}`,
      autumnAvg: "все годы",
      autumnNote: "Похожие осени — с самой близкой влажностью корневого слоя (NASA POWER GWETROOT, 15 сентября – 4 ноября) и осенними осадками. Впереди ещё зимний снег, он может изменить картину; данные POWER за последние недели могут уточняться.",
      autumnChartLabel: "Осенняя влажность почвы и осадки, каждая точка — год",
      autumnX: "Влажность корневого слоя, 15 сен – 4 ноя", autumnY: "Осадки с 1 сентября, мм",
      s3Title: "Куда ушли дождь и снег и что происходит с почвой",
      s3Lead: "Каждый миллиметр, выпавший на поле, разложен по тому, куда он делся. Зерно даёт только вода, прошедшая через растения. Рядом с каждым севооборотом — сколько почва лежит голой и что происходит с углеродом почвы.",
      wCrops: "Через растения", wEvap: "Испарилось с почвы", wDrain: "Ушло ниже корней", wSnow: "Снег сдуло", wRunoff: "Талая вода стекла",
      bareDays: d => `${d} дней голой почвы в год`,
      carbon: (c, h) => `углерод почвы ${c} т/га в год (гумус ${h} т)`,
      carbonNote: "Углерод почвы: грубая оценка по аннотациям Takata et al. 2007–2008 (Шортанды). Сами авторы отмечают низкую предсказательную силу своей регрессии. Коэффициенты против опубликованных диапазонов — в пролёте 7.",
      seasonType: t => `Тип сезона (кластеризация): ${t}`,
      seasonNames: { "bare all season": "голое весь сезон", "weak crop season": "слабый посев", "strong crop season": "сильный посев", "long green season": "долгий зелёный сезон" },
      stressTitle: "Стресс-тест: самые сухие лета на этом поле",
      stressLead: (years) => `Как каждый севооборот пережил бы ${years.length} самых сухих мая–июля с 2000 года (${years.join(", ")}), по осадкам NASA POWER.`,
      stressCols: ["Севооборот", "Покрытие потребности в воде в эти годы", "Урожаев с нехваткой воды"],
      stressFail: (n, t) => `${n} из ${t}`,
      s4Title: "Карточки стратегий: зачем, данные, выгода, пробелы и риски",
      s4Lead: "Одна карточка на каждый севооборот: почему он предложен, что показывают данные NASA по этому полю, что он может дать, чего инструмент не знает и что проверить с агрономом.",
      cardWhy: "Почему предложен", cardEvidence: "Что показывают данные по этому полю", cardGain: "Что может дать по сравнению с вашим севооборотом",
      cardGaps: "Где не хватает данных", cardRisks: "Риски, которые нужно проверить на месте",
      why: {
        A: "Это севооборот, который поле ведёт сейчас, или тот, что вы ввели. С ним сравниваются все остальные карточки.",
        AIf: "Севооборот с паром раз в четыре года, традиционный для региона. MODIS не видит на этом поле паровых лет с 2000 года, поэтому эта карточка — расчёт «что если»: впишите в пролёте 2, что вы сеете на самом деле. С ним сравниваются все остальные карточки.",
        B: "Горох вместо пара проверяли в опыте в Шортанды (Suleimenov et al., 2005, 2000–2002): примерно на 10% больше зерна со всей площади, чем с паром, но меньше, чем с овсом; ячмень после гороха был слабым, а овсюга было вдвое больше (горох не обрабатывали гербицидом). Горох сам обеспечивает себя азотом.",
        C: "Овёс вместо пара дал больше всего зерна в опыте в Шортанды (Suleimenov et al., 2005, 2000–2002): примерно на 30% больше со всей площади, чем с паром (2,07 против 1,59 т/га). Овёс закрывает почву весь сезон и даёт зерно или корм.",
        D: "Чечевица и лён дважды разрывают цепочку зерновых. Этот севооборот составлен командой и не проверен в опыте, на который мы могли бы сослаться.",
        custom: (changes) => `Ваш собственный вариант: ${changes}.`,
        noFallow: "в нём нет пара", addsLegume: "в нём есть бобовая культура", addsBreak: "в нём есть незерновой разрыв", same: "те же культуры, что в вашем севообороте, в другом порядке",
      },
      ev: {
        water: (span, through, evap) => `Погода NASA POWER ${span}: ${through}% осадков прошли через растения, ${evap}% испарились с почвы.`,
        met: (met, fail) => `Культуры получали в среднем ${met}% нужной воды, нехватка была в ${fail}% урожаев.`,
        sowing: (what, mm) => `${what}: в среднем ${mm} мм влаги в почве к посеву.`,
        modis: (years) => `MODIS показывает похожие на пар годы на этом поле: ${years}.`,
        modisNone: "MODIS не показывает явных паровых лет на этом поле с 2000 года.",
      },
      gain: {
        base: "Это точка отсчёта.",
        moneyLink: "Деньги — в пролёте 3. Урожайности и затраты там примерные, впишите свои.",
        harvests: (v, more) => `на ${v} ${more ? "больше" : "меньше"} урожаев за 10 лет`,
        failures: (v, more, n) => `на ${v} ${ruPlural(n, "пункт", "пункта", "пунктов")} ${more ? "больше" : "меньше"} урожаев с нехваткой воды`,
        carbon: (v, more) => `на ${v} т ${more ? "больше" : "меньше"} углерода почвы с гектара в год`,
        bare: (v, more, n) => `на ${v} ${ruPlural(n, "день", "дня", "дней")} ${more ? "больше" : "меньше"} обработанной голой почвы в год`,
        same: { harvests: "Урожаев за 10 лет: столько же", failures: "Доля урожаев с нехваткой воды: та же",
                carbon: "Углерод почвы: без изменений", bare: "Дней обработанной голой почвы: столько же" },
        better: "лучше", worse: "хуже", noChange: "без изменений",
      },
      gaps: {
        weather: "Погода взята из сетки NASA POWER шириной в десятки километров: она описывает район, а не это поле.",
        sowing: "Сроки посева и длины фаз развития — типичные значения, а не ваши.",
        ky: (c) => `${c}: реакция урожая на воду принята допущением.`,
        pea: "Горох: коэффициенты культуры, глубина корней и порог стресса взяты из таблиц 17 и 22 FAO-56; дата сева — допущение.",
        nitrogen: "Азот от бобовых и азот, высвобождаемый в пару, не учитываются.",
        money: "Цены — рыночные котировки; урожайность и затраты — примеры, пока вы не введёте свои.",
      },
      seeNot: "Чего не видит модель", askLocal: "Уточните на месте",
      fData: "Данные",
      fDataText: "Растительность: MODIS Terra NDVI, 250 м, каждые 16 дней с 2000 г.; для Костаная, Шортанды и Молодёжного — MOD13Q1 V061 (Collection 6.1) из NASA ORNL DAAC TESViS с каналом качества, для пяти других полей — снято с карт NASA GIBS (слой MODIS_Terra_L3_NDVI_16Day) без канала качества. Погода: суточные агроклиматические данные NASA POWER; сетка шириной в десятки километров, поэтому описывает район, а не одно поле. Влажность корнеобитаемого слоя NASA POWER (GWETROOT) используется для сравнения осеней и для проверки модели в пролёте 7.",
      fMethod: "Метод",
      fMethodText: "Суточный водный баланс почвы по методике FAO, публикация 56 по орошению и дренажу: эталонная эвапотранспирация по Пенману–Монтейту, двойной коэффициент культуры, коэффициент водного стресса. Реакция урожая на воду по публикации FAO 33 — только для раздела о деньгах. Снег, стерня и сроки посева — упрощённые допущения, они перечислены с источниками в репозитории проекта. Годы пара находятся по порогам NDVI; кластеризация годовых кривых NDVI методом k-средних даёт тот же ответ «пар / не пар» в 185 из 185 полелет с ясной меткой порогов (31 неясный или незавершённый год не сравнивался).",
      fLimits: "Ограничения",
      fLimitsText: "Инструмент помогает принять решение, но не принимает его. Параметры культур, отмеченные в репозитории как допущения, ещё нужно проверить. Азот от бобовых, сорняки и болезни не моделируются. По сравнению с опытом в Шортанды преимущество пара в модели попадает в опубликованный диапазон в среднем за 2000–2002, но не по отдельным годам. Считайте числа сравнением севооборотов, а не обещанием.",
      ans: {
        fallowMain: (crop, mm) => `Пар дал следующей ${STR.ru.cropDat[crop]} на ${mm} мм больше влаги к посеву.`,
        fallowSub: (pct, L, evap) => `Это около ${pct}% среднего июльского дождя на этом поле. Цена — один урожай из ${L}, и ${evap}% всех осадков испарились с почвы.`,
        fallowLess: (crop, mm) => `На этом поле ${STR.ru.cropDat[crop]} после пара досталось на ${mm} мм меньше влаги к посеву, чем в другие годы.`,
        noFallowMain: "В вашем севообороте нет пара.",
        noFallowSub: (through, evap) => `${through}% осадков проходит через растения, ${evap}% испаряется с почвы.`,
        money: (mine, best, diff) => `С ${mine ? "вашими" : "примерными"} ценами и урожайностью из шага 2 «${best}» заработал бы на ${diff} ₸ с гектара в год больше вашего севооборота.`,
        moneySame: (mine) => `С ${mine ? "вашими" : "примерными"} ценами и урожайностью из шага 2 ваш севооборот заработал больше всех четырёх вариантов.`,
      },
      crops: { fallow: "пар", wheat: "пшеница", barley: "ячмень", oats: "овёс", pea: "горох", lentil: "чечевица", flax: "лён" },
      cropTitle: { fallow: "Пар", wheat: "Яровая пшеница", barley: "Ячмень", oats: "Овёс", pea: "Горох", lentil: "Чечевица", flax: "Лён" },
      notes: {
        fallow: ["Борьбу с сорняками — одну из главных причин держать пар. Азот, который высвобождается в пару.", "Сколько в вашем пару ради влаги и сколько ради сорняков? Во что обходятся обработки?"],
        wheat: ["Болезни и сорняки, которые накапливаются при пшенице по пшенице.", "Какие болезни пшеницы обычны в вашем районе после двух зерновых подряд?"],
        barley: ["Кормовое или пивоваренное качество, от которого сильно зависит цена.", "Кто покупает ячмень рядом с вами и какого качества?"],
        oats: ["Болезни зерновых: овёс добавляет четвёртую зерновую культуру.", "Есть ли у вас скот или покупатель на корм?"],
        pea: ["Азот, который горох оставляет следующей пшенице. Болезни гороха и потери при уборке. Борьба с овсюгом: в опыте в Шортанды сорняков в севообороте с горохом было вдвое больше.", "Есть ли рядом покупатель и элеватор для гороха? Семена, инокулянт, гербицид против овсюга, что сеять после гороха, и сможет ли ваш комбайн чисто его убрать?"],
        lentil: ["Азот для следующей культуры. Чечевица низкая, уборка сложная. Её коэффициент реакции на воду принят допущением.", "Красная или зелёная, кто её покупает, и нет ли последействия гербицидов от предшественника?"],
        flax: ["Цены на льносемя сильно колеблются. Коэффициент реакции на воду принят допущением.", "Есть ли сбыт льносемени и что вы будете делать с жёсткой соломой?"],
      },
      yearsRange: (a, b) => `${a}–${b}`,
      partialRange: (a, b, d) => `${a}–${b} (${b} — по ${d})`, dateLocale: "ru-RU",
      fieldMeta: (lat, lon, rain, a, b) => `${lat} с. ш., ${lon} в. д. Осадков ${rain} мм в год, среднее по полным годам ${a}–${b}. NASA POWER.`,
      ribbonTip: (date, ndvi, note) => `${date}\n${ndvi}${note ? "\n" + note : ""}`,
      ndviBare: "голая почва", ndviThin: "редкий покров", ndviGreen: "зелёный посев", ndviSnow: "снег", ndviGap: "нет чистого снимка",
      status: { "likely fallow": "Этот год похож на пар.", "unclear": "Неясный год.", "long green season": "Зелёное почти весь сезон: травы или поздняя культура?", "cropped": "", "incomplete year": "" },
      dryNote: "Очень сухие май–июль.",
      months: ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"],
      markFallow: "П", markDry: "сух",
      stripAria: name => `${name}: обеспеченность водой по годам`,
      thatYear: "за год",
      numberLocale: "ru-RU",
      langName: "Русский",
    },
  };
  const LANGS = ["en", "ru"];
  let lang = (() => {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem("fallow-lang"); if (LANGS.includes(s)) return s; } catch (e) { /* storage blocked */ }
    return "en";
  })();
  const T = () => STR[lang];
  // keys may be nested, e.g. "fa.checksTitle" (Fallow Audit strings)
  const tr = (key) => { const v = key.split(".").reduce((o, k) => (o == null ? o : o[k]), T()); return typeof v === "function" ? v() : v; };

  // ------------------------------------------------------------------ state
  const crops = DATA.crops.crops;
  const COLORS = ["#3987e5", "#d95926", "#199e70", "#9085e9"];
  const SOILS = { light: 130, medium: 160, heavy: 180 };
  const SHIFTS = [-10, -5, 0, 5, 10];
  const CROP_OPTIONS = ["fallow", "wheat", "barley", "oats", "pea", "lentil", "flax"];

  function startingRotations() {
    return Object.values(DATA.crops.rotations).map(r => r.sequence.slice());
  }
  function startingEconomics() { return JSON.parse(JSON.stringify(DATA.crops.economics.crops)); }

  const state = {
    point: Object.keys(DATA.points)[0],
    rotations: startingRotations(),
    soil: "medium",
    shift: 0,
    econ: startingEconomics(),
    results: null,
    scen: { rain: 0, temp: 0 },
    prio: { income: 0, water: 1, soil: 1, bare: 1 },   // money counts only if the farmer turns it up
    allow: { wheat: true, barley: true, oats: true, pea: true, lentil: true, flax: true },
    passport: (() => { try { return JSON.parse(localStorage.getItem("uptopara-passport") || "{}"); } catch (e) { return {}; } })(),
  };

  const $ = (id) => document.getElementById(id);
  let nf = new Intl.NumberFormat(STR[lang].numberLocale, { maximumFractionDigits: 0 });
  const money = (v) => nf.format(Math.round(v / 100) * 100);
  const signed = (v, d) => (v > 0 ? "+" : v < 0 ? "−" : "") + new Intl.NumberFormat(T().numberLocale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
  const signedMoney = (v) => (Math.round(v / 100) > 0 ? "+" : Math.round(v / 100) < 0 ? "−" : "") + money(Math.abs(v));
  const fmtN = (v, d) => new Intl.NumberFormat(T().numberLocale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fmt1 = (v) => new Intl.NumberFormat(T().numberLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  const pct = (v) => Math.round(v);
  // A year range for model results. Means over complete years are labelled where they are made (field meta);
  // a range that ends in the year the weather series stops early says so: "2000–2026 (2026 to 4 November)".
  function period(a, b, point) {
    const w = point && point.weather;
    if (!w || !w.precip) return T().yearsRange(a, b);
    const end = new Date((FallowLive.dayNo(w.start[0], w.start[1], w.start[2]) + w.precip.length - 1) * 86400000);
    if (b !== end.getUTCFullYear() || (end.getUTCMonth() === 11 && end.getUTCDate() === 31)) return T().yearsRange(a, b);
    const d = new Intl.DateTimeFormat(T().dateLocale, { day: "numeric", month: "long", timeZone: "UTC" }).format(end);
    return T().partialRange(a, b, d);
  }
  const rotName = (i) => i === 0 ? T().yourRotation : T().option("ABCD"[i]);
  const cropName = (c) => T().crops[c] || c;
  const seqText = (seq) => seq.map(cropName).join(" – ");

  // ------------------------------------------------------------------ compute
  const scenarioCache = new Map();
  function scenarioWeather(point) {
    const { rain, temp } = state.scen, w = point.weather;
    if ((!rain && !temp) || !w.tmax) return w;
    const key = state.point + "|" + rain + "|" + temp + "|" + point.meta.lat;
    if (scenarioCache.has(key)) return scenarioCache.get(key);
    const start = FallowLive.dayNo(w.start[0], w.start[1], w.start[2]);
    const elev = point.meta.elevation_m || 200, f = 1 + rain / 100;
    const out = { start: w.start, precip: w.precip.map(v => v * f), tmean: [], eto: [], tmin: [], ws: w.ws };
    for (let i = 0; i < w.precip.length; i++) {
      const sh = (v) => v === null || v === undefined ? null : v + temp;
      const day = { T2M: sh(w.tmean[i]), T2M_MAX: sh(w.tmax[i]), T2M_MIN: sh(w.tmin[i]), RH2M: w.rh[i], WS2M: w.ws[i], ALLSKY_SFC_SW_DWN: w.rs[i] };
      const n = start + i, y = new Date(n * 86400000).getUTCFullYear();
      out.tmean.push(day.T2M); out.tmin.push(day.T2M_MIN);
      out.eto.push(FallowLive.referenceEt(day, point.meta.lat, elev, n - FallowLive.dayNo(y, 1, 1) + 1));
    }
    scenarioCache.set(key, out);
    return out;
  }

  function compute() {
    const point0 = DATA.points[state.point];
    const point = Object.assign({}, point0, { weather: scenarioWeather(point0) });
    state.results = FallowModel.runAll(
      point,
      state.rotations.map((seq, i) => ({ id: "ABCD"[i], sequence: seq })),
      crops, state.econ,
      { keepFrom: 2000, keepTo: point.keep_to, sowShiftDays: state.shift,
        soil: { available_water_mm_per_m: SOILS[state.soil] } });
  }

  // ------------------------------------------------------------------ static text
  function setLang(next) {
    lang = next;
    try { localStorage.setItem("fallow-lang", lang); } catch (e) { /* storage blocked */ }
    nf = new Intl.NumberFormat(T().numberLocale, { maximumFractionDigits: 0 });
    const url = new URL(location.href); url.searchParams.set("lang", lang);
    try { history.replaceState(null, "", url); } catch (e) { /* file:// may refuse */ }
    const keepThis = $("this-year").value, keepNext = $("next-year").value;
    applyText(); fillAutumnSelects(); $("this-year").value = keepThis; $("next-year").value = keepNext;
    renderPriorities(); renderGlossary(); scOut();
    renderAll(); renderEcon();
  }

  function applyText() {
    document.documentElement.lang = lang;
    document.title = T().brand + ": " + T().tagline.split(".")[0];
    $("langs").innerHTML = LANGS.map(l => `<button type="button" data-lang="${l}" aria-pressed="${l === lang}">${STR[l].langName}</button>`).join("");
    document.querySelectorAll("[data-t]").forEach(el => { el.textContent = tr(el.dataset.t); });
    $("coord").placeholder = T().coordPlaceholder;
    $("soil").innerHTML = Object.keys(SOILS).map(k =>
      `<option value="${k}">${tr("soil" + k[0].toUpperCase() + k.slice(1))}</option>`).join("");
    $("soil").value = state.soil;
    $("sow-shift").innerHTML = SHIFTS.map(d => `<option value="${d}">${T().shift(d)}</option>`).join("");
    $("sow-shift").value = String(state.shift);

    const key = (color, label) => `<span class="key"><i style="background:${color}"></i>${label}</span>`;
    const ramp = (keys) => `<span class="key">${keys.map(k => `<i style="background:${RIB[k]};margin-right:-6px"></i>`).join("")}<span style="margin-left:6px">`;
    $("ribbon-legend").innerHTML =
      ramp(["1", "2", "3"]) + T().legBare + "</span></span>" +
      ramp(["4", "6", "8"]) + T().legGreen + "</span></span>" +
      key(RIB.s, T().legSnow) + key(RIB["."], T().legGap) +
      `<span class="key">${T().legF}</span><span class="key">${T().legQ}</span><span class="key">${T().legDry}</span>`;
    $("strip-legend").innerHTML = key("var(--w-good)", T().stripGood) + key("var(--w-mid)", T().stripMid) +
      `<span class="key"><i style="background:var(--w-bad);text-align:center;font-style:normal;line-height:10px;font-size:11px">×</i>${T().stripBad}</span>` +
      `<span class="key">${T().stripNote}</span>`;
  }

  // ------------------------------------------------------------------ field list
  const fieldName = (id, p) => p.live ? T().livePoint(p.meta.lat.toFixed(3), p.meta.lon.toFixed(3))
    : ((T().fieldLabels || {})[id] || p.meta.label || p.meta.name || id);
  function renderFields() {
    $("fields").innerHTML = Object.entries(DATA.points).map(([id, p]) => {
      const name = fieldName(id, p), cut = name.indexOf(", ");
      const place = cut > 0 ? name.slice(0, cut) : name, region = cut > 0 ? name.slice(cut + 2) : "";
      return `<button type="button" data-id="${id}" aria-pressed="${id === state.point}"><span>${place}</span><small>${region}</small></button>`;
    }).join("");
    const p = DATA.points[state.point];
    const meanYears = (p.evidence && p.evidence.climate.mean_years) || [2000, p.keep_to];
    $("field-meta").textContent = T().fieldMeta(p.meta.lat.toFixed(3), p.meta.lon.toFixed(3), nf.format(p.rain_mm_per_year), meanYears[0], meanYears[1]);
  }

  // ------------------------------------------------------------------ the map: Sentinel-2 underneath, NASA GIBS on top
  const GIBS_LAYERS = {
    ndvi: ["MODIS_Terra_L3_NDVI_16Day", 9, 0.85],
    color: ["MODIS_Terra_CorrectedReflectance_TrueColor", 9, 1],
    smap: ["SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", 6, 0.72],
  };
  const MODES = ["ndvi", "color", "s2", "smap", "osm"];
  const SEASONS = [161, 193, 225];
  const GIBS_CREDIT = 'NASA GIBS: MODIS Terra NDVI and colour, SMAP L4';
  let map = null, baseS2 = null, baseOsm = null, overlay = null, overlayKey = "", markers = {}, liveMarker = null,
      pixelBox = null, gridLayer = null, shownPoint = null;
  state.mode = "ndvi"; state.season = 193; state.showGrid = true; state.yearFor = {};
  state.smapDate = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);

  // ---- map sketch for when map tiles cannot be loaded (no internet, a filter, a blocked host).
  // Drawn from the field coordinates built into the page, so the first screen is never empty.
  let mapFallbackOn = false, tilesSeen = false;
  function drawMapFallback() {
    const el = $("map");
    let box = $("map-fallback");
    if (!box) {
      box = document.createElement("div");
      box.id = "map-fallback";
      box.className = "map-fallback";
      el.appendChild(box);
      if (typeof L !== "undefined") { L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box); }
      box.addEventListener("click", e => { const g = e.target.closest("[data-field]"); if (g) selectPoint(g.dataset.field); });
    }
    const w = Math.max(320, el.clientWidth || 900), h = Math.max(320, el.clientHeight || 600);
    const wide = w > 900;
    // the note goes first (below the title block, see .mf-note); the sketch starts below the note
    box.innerHTML = `<p class="mf-note">${T().mapOffline}</p>`;
    box.hidden = false;
    const note = box.querySelector(".mf-note"), top = Math.max(150, note.offsetTop + note.offsetHeight + 24);
    const pad = wide ? { l: 380, r: 320, t: top, b: 230 } : { l: 48, r: 16, t: top, b: 40 };
    const pts = Object.entries(DATA.points).filter(([, p]) => !p.live);
    const lats = pts.map(([, p]) => p.meta.lat), lons = pts.map(([, p]) => p.meta.lon);
    const lat0 = Math.floor(Math.min(...lats)) - 1, lat1 = Math.ceil(Math.max(...lats)) + 1;
    const lon0 = Math.floor(Math.min(...lons)) - 1, lon1 = Math.ceil(Math.max(...lons)) + 1;
    const k = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);            // keep the shape of the region
    const sx = (w - pad.l - pad.r) / ((lon1 - lon0) * k), sy = (h - pad.t - pad.b) / (lat1 - lat0), s = Math.min(sx, sy);
    const ox = pad.l + ((w - pad.l - pad.r) - s * (lon1 - lon0) * k) / 2, oy = pad.t + ((h - pad.t - pad.b) - s * (lat1 - lat0)) / 2;
    const X = lon => ox + (lon - lon0) * k * s, Y = lat => oy + (lat1 - lat) * s;
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${T().mapSketchAria}">`;
    svg += `<rect x="${X(lon0)}" y="${Y(lat1)}" width="${X(lon1) - X(lon0)}" height="${Y(lat0) - Y(lat1)}" class="mf-frame"/>`;
    for (let lat = lat0; lat <= lat1; lat++) svg += `<line x1="${X(lon0)}" x2="${X(lon1)}" y1="${Y(lat)}" y2="${Y(lat)}" class="mf-grid"/><text x="${X(lon0) - 6}" y="${Y(lat) + 4}" class="mf-axis" text-anchor="end">${lat}°N</text>`;
    for (let lon = lon0; lon <= lon1; lon += 2) svg += `<line y1="${Y(lat0)}" y2="${Y(lat1)}" x1="${X(lon)}" x2="${X(lon)}" class="mf-grid"/><text x="${X(lon)}" y="${Y(lat0) + 16}" class="mf-axis" text-anchor="middle">${lon}°E</text>`;
    // Labels: try right, left, above, below; keep the first place that does not overlap another label.
    const charW = wide ? 7.2 : 6.6;
    const placed = pts.map(([, p]) => { const x = X(p.meta.lon), y = Y(p.meta.lat); return { x1: x - 8, x2: x + 8, y1: y - 8, y2: y + 8 }; });   // labels keep off every dot
    const overlaps = (b) => placed.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    pts.forEach(([id, p]) => {
      const x = X(p.meta.lon), y = Y(p.meta.lat), on = id === state.point;
      const full = fieldName(id, p), label = wide ? full : full.split(",")[0];
      const lw = label.length * charW;
      const options = [
        { tx: x + 12, ty: y + 4, anchor: "start", box: { x1: x + 10, x2: x + 14 + lw, y1: y - 9, y2: y + 7 } },
        { tx: x - 12, ty: y + 4, anchor: "end", box: { x1: x - 14 - lw, x2: x - 10, y1: y - 9, y2: y + 7 } },
        { tx: x, ty: y - 13, anchor: "middle", box: { x1: x - lw / 2, x2: x + lw / 2, y1: y - 26, y2: y - 10 } },
        { tx: x, ty: y + 22, anchor: "middle", box: { x1: x - lw / 2, x2: x + lw / 2, y1: y + 9, y2: y + 25 } },
      ].filter(o => o.box.x1 >= Math.max(2, pad.l - 40) && o.box.x2 <= w - Math.max(2, pad.r - 10));   // stay clear of the panels
      const pick = options.find(o => !overlaps(o.box)) || options[0] || { tx: x + 12, ty: y + 4, anchor: "start", box: { x1: 0, x2: 0, y1: 0, y2: 0 } };
      placed.push(pick.box);
      svg += `<g data-field="${id}" class="mf-pt${on ? " on" : ""}" tabindex="0" role="button" aria-label="${full}">` +
        `<circle cx="${x}" cy="${y}" r="${on ? 9 : 6}"/><text x="${pick.tx}" y="${pick.ty}" text-anchor="${pick.anchor}">${label}</text></g>`;
    });
    svg += "</svg>";
    box.insertAdjacentHTML("beforeend", svg);
    mapFallbackOn = true;
  }
  function hideMapFallback() { const box = $("map-fallback"); if (box) box.hidden = true; mapFallbackOn = false; }

  function renderMap() {
    const el = $("map");
    if (typeof L === "undefined") { drawMapFallback(); return; }
    if (!map) {
      map = L.map(el, { scrollWheelZoom: false, doubleClickZoom: false, zoomControl: true, zoomSnap: 0.5 });
      map.zoomControl.setPosition("bottomright");
      baseS2 = L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg", {
        maxNativeZoom: 15, maxZoom: 17,
        attribution: 'Sentinel-2 cloudless 2020 by <a href="https://s2maps.eu">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)' });
      baseOsm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OpenStreetMap contributors" });
      [baseS2, baseOsm].forEach(layer => layer.on("tileload", () => { tilesSeen = true; hideMapFallback(); }));
      setTimeout(() => { if (!tilesSeen) drawMapFallback(); }, 6000);
      window.addEventListener("resize", () => { if (mapFallbackOn) drawMapFallback(); });
      baseS2.addTo(map);
      Object.entries(DATA.points).forEach(([id, p]) => {
        if (p.live) return;
        markers[id] = L.circleMarker([p.meta.lat, p.meta.lon], { radius: 6, weight: 2, color: "#0f1614", fillOpacity: 1, bubblingMouseEvents: false })
          .addTo(map).on("click", () => selectPoint(id));
      });
      map.on("click", e => loadLivePoint(e.latlng.lat, e.latlng.lng));
    }
    Object.entries(markers).forEach(([id, mk]) => {
      mk.setStyle({ fillColor: id === state.point ? "#e6bd57" : "#e9ede6", radius: id === state.point ? 0 : 6 });
      mk.unbindTooltip().bindTooltip(fieldName(id, DATA.points[id]), { direction: "top" });
    });
    if (liveMarker) liveMarker.setStyle({ fillColor: "#e6bd57", radius: state.point === "live" ? 0 : 6 });
    const p = DATA.points[state.point], key = p.meta.lat + "," + p.meta.lon;
    if (shownPoint !== key) {
      shownPoint = key;
      map.setView([p.meta.lat, p.meta.lon], 13, { animate: false });
      if (pixelBox) pixelBox.remove();
      const dLat = 125 / 111320, dLon = 125 / (111320 * Math.cos(p.meta.lat * Math.PI / 180));
      pixelBox = L.rectangle([[p.meta.lat - dLat, p.meta.lon - dLon], [p.meta.lat + dLat, p.meta.lon + dLon]],
        { color: "#e6bd57", weight: 2, fill: false, interactive: false }).addTo(map);
    }
    updateImagery();
    if (mapFallbackOn) drawMapFallback();
  }

  function updateImagery() {
    if (!map) return;
    const m = state.mode;
    const wantOsm = m === "osm";
    if (wantOsm && !map.hasLayer(baseOsm)) { map.removeLayer(baseS2); baseOsm.addTo(map); }
    if (!wantOsm && !map.hasLayer(baseS2)) { map.removeLayer(baseOsm); baseS2.addTo(map); }
    const g = GIBS_LAYERS[m];
    if (!g) { if (overlay) { overlay.remove(); overlay = null; overlayKey = ""; } }
    else {
      const date = m === "smap" ? state.smapDate : FallowLive.doyDate(state.year, state.season);
      const url = FallowLive.gibsUrl(g[0], date, g[1]);
      if (overlay && overlayKey === m) overlay.setUrl(url);
      else {
        if (overlay) overlay.remove();
        overlay = L.tileLayer(url, { maxNativeZoom: g[1], maxZoom: 17, opacity: g[2], attribution: GIBS_CREDIT }).addTo(map);
        overlayKey = m;
      }
    }
    if (pixelBox) pixelBox.bringToFront();
    renderGridOverlay();
    renderLens();
  }

  function renderLens() {
    $("lens-modes").innerHTML = MODES.map(m => `<button type="button" data-mode="${m}" aria-pressed="${m === state.mode}">${T().modes[m][0]}<small>${T().modes[m][1]}</small></button>`).join("");
    const ramp = (colours, ends) => `<div class="ramp" style="background:linear-gradient(90deg,${colours.join(",")})"></div><div class="ramp-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
    let leg = "";
    if (state.mode === "ndvi") leg = ramp(["#d1c0ab", "#9d7c5e", "#bfde77", "#64a600", "#126e00"], T().legNdvi) + `<span>${state.year}, ${T().seasons[state.season]}</span>`;
    else if (state.mode === "color") leg = `<span>${FallowLive.doyDate(state.year, state.season)}</span>`;
    else if (state.mode === "smap") leg = ramp(["#ffa200", "#fff100", "#82c100", "#00ffff", "#0059ff"], T().legSmap) + `<span>${T().smapDateNote(state.smapDate)}</span>`;
    if (state.showGrid && gridFor()) leg += `<p style="margin:8px 0 0">${T().legGrid(state.year)}</p>`;
    $("lens-legend").innerHTML = leg;
  }

  function selectPoint(id) {
    if (id === state.point) return;
    stopPlay();
    state.point = id;
    if (id !== "live") { setLiveStatus(""); }
    renderAll();
  }

  // ------------------------------------------------------------------ timeline of summers
  const lastYearOf = (p) => p.keep_to || new Date().getFullYear();
  function yearStatus(p, y) {
    const st = (p.cover && p.cover.years || []).find(v => v.year === y);
    if (st) return { kind: st.status, dry: st.dry_year, green: st.green_days };
    const g = gridFor();
    if (g && g.years[y]) {
      const v = g.years[y][g.centre[1] * g.size + g.centre[0]];
      if (v !== null && v !== undefined) return { kind: v < 0.35 ? "likely fallow" : v < 0.42 ? "unclear" : "cropped", ndvi: v };
    }
    return null;
  }
  function defaultYear(p) {
    const fallow = (p.cover && p.cover.summary && p.cover.summary.likely_fallow_years) || [];
    return fallow.length ? fallow[fallow.length - 1] : lastYearOf(p);
  }
  function renderTimeline() {
    const p = DATA.points[state.point], last = lastYearOf(p);
    const key = p.meta.lat + "," + p.meta.lon;
    if (!state.yearFor[key]) state.yearFor[key] = defaultYear(p);
    state.year = Math.min(state.yearFor[key], last);
    const years = []; for (let y = 2000; y <= last; y++) years.push(y);
    const box = $("years");
    box.style.setProperty("--n", years.length);
    box.innerHTML = years.map(y => {
      const s = yearStatus(p, y);
      const colour = !s ? "var(--line)" : s.kind === "likely fallow" ? "var(--bare)" : s.kind === "incomplete year" ? "var(--line)" : "var(--green)";
      const cls = [s && s.kind === "unclear" ? "unclear" : "", s && s.dry ? "dry" : ""].join(" ").trim();
      return `<button type="button" data-year="${y}" class="${cls}" style="--c:${colour}" aria-pressed="${y === state.year}"><span>${y}</span></button>`;
    }).join("");
    const play = $("play");
    play.setAttribute("aria-label", playing ? T().pauseLabel : T().playLabel);
    play.setAttribute("aria-pressed", String(!!playing));
    $("season").innerHTML = SEASONS.map(d => `<option value="${d}">${T().seasons[d]}</option>`).join("");
    $("season").value = String(state.season);
    renderReadout();
  }
  function renderReadout() {
    const p = DATA.points[state.point], s = yearStatus(p, state.year);
    $("year-readout").textContent = !s ? T().readoutNone(state.year)
      : s.ndvi !== undefined ? T().readoutGrid(state.year, fmtN(s.ndvi, 2))
      : T().readout(state.year, T().yearWord[s.kind] || s.kind, s.dry, s.green);
  }
  function setYear(y) {
    const p = DATA.points[state.point];
    state.year = y; state.yearFor[p.meta.lat + "," + p.meta.lon] = y;
    document.querySelectorAll("#years button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.year === y)));
    renderReadout(); updateImagery(); renderGridYears();
  }
  let playing = null;
  function stopPlay() { if (playing) { clearInterval(playing); playing = null; $("play").setAttribute("aria-pressed", "false"); $("play").setAttribute("aria-label", T().playLabel); } }
  function togglePlay() {
    if (playing) return stopPlay();
    const p = DATA.points[state.point], last = lastYearOf(p);
    if (state.year >= last) setYear(2000);
    playing = setInterval(() => { if (state.year >= last) stopPlay(); else setYear(state.year + 1); }, 1200);
    $("play").setAttribute("aria-pressed", "true"); $("play").setAttribute("aria-label", T().pauseLabel);
  }

  // ------------------------------------------------------------------ neighbours: MODIS NDVI around the field, from NASA GIBS
  const gridStore = {};
  const pointKey = () => { const p = DATA.points[state.point]; return p.meta.lat.toFixed(4) + "," + p.meta.lon.toFixed(4); };
  const gridFor = () => { const g = gridStore[pointKey()]; return g && g.grid; };
  const classify = (v) => v === null || v === undefined ? null : v < 0.35 ? "bare" : v < 0.42 ? "unclear" : "green";

  function ensureGrid() {
    const key = pointKey(), p = DATA.points[state.point];
    if (gridStore[key]) return;
    const entry = gridStore[key] = { done: 0, total: 1 };
    FallowLive.fetchNdviGrid(p.meta.lat, p.meta.lon, lastYearOf(p), (d, t, y) => {
      entry.done = d; entry.total = t;
      if (key === pointKey()) { loaderStep("ld-grid", d, t); if (d % 9 === 0) $("grid-summary").textContent = T().gridLoading(d, t); }
    }).then(grid => {
      if (!Object.keys(grid.years).length) throw new Error("no data");
      entry.grid = grid;
      if (key === pointKey()) { loaderStep("ld-grid", 1, 1); renderGrid(); renderGridOverlay(); renderTimeline(); renderLens(); }
    }).catch(() => {
      entry.error = true;
      if (key === pointKey()) { $("grid-summary").textContent = T().gridError; loaderStep("ld-grid", 0, 1, true); }
    });
  }

  function gridCounts(g) {
    const years = Object.keys(g.years).map(Number).sort((a, b) => a - b);
    const n = g.size * g.size, bare = new Array(n).fill(0), seen = new Array(n).fill(0), list = Array.from({ length: n }, () => []);
    for (const y of years) g.years[y].forEach((v, i) => { const c = classify(v); if (!c) return; seen[i]++; if (c === "bare") { bare[i]++; list[i].push(y); } });
    return { years, bare, seen, list };
  }

  function renderGrid() {
    const g = gridFor(), canvas = $("grid-map");
    const entry = gridStore[pointKey()];
    if (!g) {
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
      $("grid-summary").textContent = entry && entry.error ? T().gridError : T().gridLoading(entry ? entry.done : 0, entry ? entry.total : "…");
      $("grid-years").innerHTML = ""; $("grid-legend").innerHTML = "";
      return;
    }
    const c = gridCounts(g); g._c = c;
    const W = canvas.clientWidth || 360, dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = W * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = W / g.size, max = Math.max(4, ...c.bare);
    const mix = (t) => { const a = [29, 41, 37], b = [233, 160, 96]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(",")})`; };
    for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
      const k = j * g.size + i;
      ctx.fillStyle = c.seen[k] < 3 ? "#13242f" : mix(Math.min(1, c.bare[k] / max));
      ctx.fillRect(i * cell, j * cell, Math.ceil(cell) - 1, Math.ceil(cell) - 1);
    }
    ctx.strokeStyle = "#e6bd57"; ctx.lineWidth = 2;
    ctx.strokeRect(g.centre[0] * cell - 1, g.centre[1] * cell - 1, cell + 1, cell + 1);
    canvas._g = { cell, g };
    $("grid-legend").innerHTML = `<span class="key"><i style="background:${mix(0)}"></i>0</span><span class="key"><i style="background:${mix(0.5)}"></i>${Math.round(max / 2)}</span>` +
      `<span class="key"><i style="background:${mix(1)}"></i>${max}+</span><span class="key"><i style="background:#13242f"></i>${T().gridWater}</span>` +
      `<span class="key"><i style="background:none;outline:2px solid #e6bd57;outline-offset:-2px"></i>${T().fieldPixel}</span>`;
    const ck = g.centre[1] * g.size + g.centre[0];
    if (c.seen[ck] < 3) { $("grid-summary").textContent = T().gridError; renderGridYears(); return; }
    const valid = c.bare.filter((v, k) => c.seen[k] >= 3);
    const avg = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
    const below = valid.filter(v => v < c.bare[ck]).length;
    $("grid-summary").textContent = T().gridSummary(c.bare[ck], c.seen[ck], c.list[ck].join(", "), fmtN(avg, 1), pct(100 * below / Math.max(1, valid.length)));
    renderGridYears();
  }

  function renderGridYears() {
    const g = gridFor(); if (!g || !g._c) return;
    const c = g._c, ck = g.centre[1] * g.size + g.centre[0];
    const box = $("grid-years");
    box.style.setProperty("--n", c.years.length);
    box.innerHTML = c.years.map(y => {
      const vals = g.years[y].map(classify).filter(Boolean);
      const sh = vals.length ? 100 * vals.filter(v => v === "bare").length / vals.length : 0;
      const own = classify(g.years[y][ck]) === "bare";
      const sel = y === state.year ? ";outline:1px solid #e9ede6;outline-offset:1px" : "";
      return `<span class="${own ? "own" : ""}" style="height:${Math.max(2, sh)}%${sel}" data-tip="${T().gridYearTip(y, pct(sh), own)}"></span>`;
    }).join("");
    box.setAttribute("aria-label", T().gridYearsLabel);
    box.title = "";
    if (!box.nextElementSibling || !box.nextElementSibling.classList.contains("grid-cap")) box.insertAdjacentHTML("afterend", `<p class="fig-note grid-cap"></p>`);
    box.nextElementSibling.textContent = T().gridYearsLabel;
  }

  function gridTip(e) {
    const c = $("grid-map"), info = c._g; if (!info) return null;
    const r = c.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / info.cell), j = Math.floor((e.clientY - r.top) / info.cell);
    const g = info.g; if (i < 0 || j < 0 || i >= g.size || j >= g.size) return null;
    const k = j * g.size + i;
    if (g._c.seen[k] < 3) return T().gridWater;
    return T().gridTip(g._c.bare[k], g._c.seen[k], g._c.list[k].join(", "));
  }

  function renderGridOverlay() {
    if (!map) return;
    if (gridLayer) { gridLayer.remove(); gridLayer = null; }
    const g = gridFor();
    if (!g || !state.showGrid || !g.years[state.year]) return;
    const renderer = L.canvas({ padding: 0.2 });
    gridLayer = L.layerGroup();
    const vals = g.years[state.year];
    for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
      const c = classify(vals[j * g.size + i]);
      if (c !== "bare" && c !== "unclear") continue;
      L.rectangle(FallowLive.gridCellBounds(g, i, j), { renderer, stroke: false, fillColor: "#e9a060", fillOpacity: c === "bare" ? 0.6 : 0.25, interactive: false }).addTo(gridLayer);
    }
    const a = FallowLive.gridCellBounds(g, 0, 0), b = FallowLive.gridCellBounds(g, g.size - 1, g.size - 1);
    L.rectangle([[b[0][0], a[0][1]], [a[1][0], b[1][1]]], { renderer, color: "#e9ede6", weight: 1, dashArray: "4 4", fill: false, interactive: false }).addTo(gridLayer);
    gridLayer.addTo(map);
    if (pixelBox) pixelBox.bringToFront();
  }

  // ------------------------------------------------------------------ soil moisture now: NASA SMAP from GIBS
  const smapStore = {};
  function ensureSmap() {
    const key = pointKey(), p = DATA.points[state.point];
    if (smapStore[key]) return renderSmap();
    const entry = smapStore[key] = { loading: true };
    renderSmap();
    FallowLive.fetchSmap(p.meta.lat, p.meta.lon).then(r => {
      entry.loading = false; entry.result = r;
      if (r) { state.smapDate = r.date; if (state.mode === "smap") updateImagery(); }
      if (key === pointKey()) renderSmap();
    }).catch(() => { entry.loading = false; if (key === pointKey()) renderSmap(); });
  }
  function renderSmap() {
    const entry = smapStore[pointKey()], box = $("smap");
    if (!entry) { box.innerHTML = ""; return; }
    if (entry.loading) { box.innerHTML = `<p class="note">${T().smapLoading}</p><div></div>`; return; }
    const r = entry.result;
    if (!r || !r.past.length) { box.innerHTML = ""; return; }
    const mean = r.past.reduce((s, e) => s + e.value, 0) / r.past.length;
    const diff = Math.round(100 * (r.value - mean) / mean);
    const all = r.past.concat([{ year: +r.date.slice(0, 4), value: r.value, now: true }]);
    const top = Math.max(...all.map(e => e.value)) * 1.05;
    const day = new Date(r.date + "T00:00:00Z").toLocaleDateString(T().numberLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    box.innerHTML = `<div><p class="smap-big">${T().smapBig(day, fmtN(r.value, 2), diff, r.past[0].year, r.past[r.past.length - 1].year)}</p>` +
      `<p class="note">${T().smapNote}</p></div>` +
      `<div><div class="smap-bars" style="--n:${all.length}">${all.map(e => `<span class="${e.now ? "now" : ""}" style="height:${(100 * e.value / top).toFixed(1)}%" data-tip="${e.year}: ${fmtN(e.value, 2)} m³/m³"></span>`).join("")}</div>` +
      `<div class="smap-axis"><span>${all[0].year}</span><span>${T().smapAxis}</span><span>${all[all.length - 1].year}</span></div></div>`;
  }

  // ------------------------------------------------------------------ live points and the loading card
  let liveRun = 0;
  function setLiveStatus(text, isError) {
    const el = $("live-status"); el.textContent = text || ""; el.classList.toggle("err", !!isError);
  }
  function loaderStep(id, done, total, failed) {
    const li = $(id); if (!li) return;
    const share = total ? Math.min(1, done / total) : 0;
    li.querySelector("i").style.width = (100 * share).toFixed(0) + "%";
    li.querySelector(".ld-val").textContent = failed ? "×" : share >= 1 ? "✓" : Math.round(100 * share) + "%";
    li.classList.toggle("done", share >= 1);
    const all = ["ld-weather", "ld-ndvi", "ld-grid"].every(k => $(k).classList.contains("done") || $(k).querySelector(".ld-val").textContent === "×");
    if (all) setTimeout(() => { $("loader").hidden = true; }, 900);
  }
  function showLoader() {
    ["ld-weather", "ld-ndvi", "ld-grid"].forEach(k => { $(k).classList.remove("done"); $(k).querySelector("i").style.width = "0"; $(k).querySelector(".ld-val").textContent = ""; });
    $("loader-year").textContent = "";
    $("loader").hidden = false;
  }

  async function loadLivePoint(lat, lon) {
    if (!(lat >= -60 && lat <= 75 && lon >= -180 && lon <= 180)) { setLiveStatus(T().coordBad, true); return; }
    const run = ++liveRun;
    stopPlay();
    if (map) {
      if (liveMarker) liveMarker.remove();
      liveMarker = L.circleMarker([lat, lon], { radius: 6, weight: 2, color: "#0f1614", fillColor: "#e6bd57", fillOpacity: 1, bubblingMouseEvents: false })
        .addTo(map).on("click", () => { if (DATA.points.live) selectPoint("live"); });
    }
    showLoader();
    setLiveStatus(T().loadingWeather);
    let point;
    try {
      const weather = await FallowLive.fetchWeather(lat, lon, (d, t) => { if (run === liveRun) loaderStep("ld-weather", d, t); });
      if (run !== liveRun) return;
      point = FallowLive.buildPoint(lat, lon, weather, `${lat.toFixed(3)}, ${lon.toFixed(3)}`);
    } catch (e) {
      if (run === liveRun) { setLiveStatus(T().weatherError, true); loaderStep("ld-weather", 0, 1, true); }
      return;
    }
    DATA.points.live = point;
    state.point = "live";
    setLiveStatus(T().weatherReady);
    renderAll();

    const composites = [];
    const onChunk = (items, done, total) => {
        if (run !== liveRun) return;
        composites.push(...items);
        const years = items.map(it => +it.date.slice(0, 4)).filter(Boolean);
        if (years.length) $("loader-year").textContent = Math.min(...years);
        loaderStep("ld-ndvi", done, total);
        const cal = FallowLive.coverCalendar(composites, point);
        point.ribbon = cal.ribbon;
        point.cover = { summary: cal.summary, years: cal.years };
        if (done === total) point.season_types = FallowLive.seasonTypes(cal.daily, DATA.crops.season_clusters);
        point.ndviStatus = done === total ? T().ndviDone(composites.length) : T().loadingNdvi(done, total);
        if (state.point === "live") { drawRibbon(); $("ribbon-status").textContent = point.ndviStatus; if (done % 5 === 0 || done === total) renderTimeline(); }
    };
    try {
      // NASA GIBS first (fast); the ORNL archive only if GIBS fails or gives too little.
      let fromGibs = true;
      try {
        await FallowLive.fetchNdviGibs(lat, lon, onChunk);
        if (composites.filter(c => c.ndvi !== null).length < 200) throw new Error("too few");
      } catch (e) {
        fromGibs = false;
        if (run !== liveRun) return;
        composites.length = 0;
        loaderStep("ld-ndvi", 0, 1);
        await FallowLive.fetchNdvi(lat, lon, onChunk);
      }
      point.ndviSource = fromGibs ? "gibs" : "ornl";
    } catch (e) {
      if (run === liveRun) { point.ndviStatus = T().ndviError; loaderStep("ld-ndvi", 0, 1, true); if (state.point === "live") $("ribbon-status").textContent = point.ndviStatus; }
    }
  }

  // ------------------------------------------------------------------ ribbon
  const RIB = { "0": "#4f3e30", "1": "#5f4b3a", "2": "#86705b", "3": "#b5a48a", "4": "#b6d69a", "5": "#86c076",
                "6": "#53a45a", "7": "#2c8549", "8": "#196b3c", "9": "#105a31", s: "#bcd4e4", ".": "#1d2925" };

  function drawRibbon() {
    const p = DATA.points[state.point];
    const canvas = $("ribbon");
    const years = Object.keys(p.ribbon).map(Number).sort((a, b) => a - b);
    const W = canvas.parentElement.clientWidth || 640;
    const left = 40, right = 46, top = 18, rowH = Math.max(8, Math.min(12, Math.floor(330 / years.length))), gap = 2;
    const H = top + years.length * (rowH + gap) + 4;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const plotW = W - left - right, dayW = plotW / 366;

    ctx.font = "11px 'PT Sans', system-ui, sans-serif";
    ctx.fillStyle = "#84948c"; ctx.textBaseline = "middle";
    const months = T().months;
    const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    starts.forEach((s, i) => { ctx.textAlign = "left"; ctx.fillText(months[i], left + s * dayW + 2, 8); });

    const statusByYear = {};
    p.cover.years.forEach(y => { statusByYear[y.year] = y; });
    years.forEach((y, r) => {
      const row = p.ribbon[y], yTop = top + r * (rowH + gap);
      for (let d = 0; d < row.length; d++) {
        ctx.fillStyle = RIB[row[d]] || RIB["."];
        ctx.fillRect(left + d * dayW, yTop, Math.ceil(dayW + 0.5), rowH);
      }
      ctx.fillStyle = "#b0bdb6"; ctx.textAlign = "right";
      if (r % 2 === 0 || years.length < 15) ctx.fillText(String(y), left - 6, yTop + rowH / 2);
      const st = statusByYear[y];
      if (st) {
        ctx.textAlign = "left"; ctx.fillStyle = "#e9ede6";
        const mark = st.status === "likely fallow" ? T().markFallow : st.status === "unclear" ? "?" : "";
        ctx.font = "700 11px 'PT Sans', system-ui, sans-serif";
        if (mark) ctx.fillText(mark, W - right + 6, yTop + rowH / 2);
        ctx.font = "11px 'PT Sans', system-ui, sans-serif";
        if (st.dry_year) ctx.fillText(T().markDry, W - right + 18, yTop + rowH / 2);
      }
    });
    canvas._geom = { years, left, top, rowH, gap, dayW, plotW };
    $("ribbon-status").textContent = p.live ? (p.ndviStatus || T().loadingNdvi(0, "…")) : "";
  }

  function ribbonTip(e) {
    const c = $("ribbon"), g = c._geom; if (!g) return null;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const r = Math.floor((y - g.top) / (g.rowH + g.gap)), d = Math.floor((x - g.left) / g.dayW);
    if (r < 0 || r >= g.years.length || d < 0 || d > 365) return null;
    const year = g.years[r], p = DATA.points[state.point], ch = p.ribbon[year][d];
    if (ch === undefined) return null;
    const date = new Date(Date.UTC(year, 0, 1 + d)).toISOString().slice(0, 10);
    let what = ch === "s" ? T().ndviSnow : ch === "." ? T().ndviGap :
      `NDVI ${(+ch / 10).toFixed(1)}–${((+ch + 1) / 10).toFixed(1)}: ` + (+ch < 3 ? T().ndviBare : +ch < 4 ? T().ndviThin : T().ndviGreen);
    const st = p.cover.years.find(v => v.year === year);
    const type = (p.season_types || {})[year];
    const note = [st ? T().status[st.status] : "", st && st.dry_year ? T().dryNote : "",
                  type ? T().seasonType(T().seasonNames[type] || type) : ""].filter(Boolean).join("\n");
    return T().ribbonTip(date, what, note);
  }

  // ------------------------------------------------------------------ hero answer
  // (replaced: see Fallow Audit renderAnswer below)

  function bestIndex() {
    let best = 0;
    state.results.forEach((r, i) => { if (r.mean_income_per_ha > state.results[best].mean_income_per_ha + 1) best = i; });
    return best;
  }

  // ------------------------------------------------------------------ rotations
  function renderRotations() {
    const best = bestIndex();
    const maxCrop = Math.max(...state.results.map(r => r.crop_years_per_10));
    const minFail = Math.min(...state.results.map(r => r.severe_stress_crop_years_pct));
    const minTilled = Math.min(...state.results.map(r => Math.round(r.cover.bare_fallow_days)));
    const scores = scoreRotations(), ranked = scores.filter(s => !s.excluded).sort((a, b) => b.score - a.score).map(s => s.i);
    $("rotations").innerHTML = state.rotations.map((seq, i) => {
      const r = state.results[i], name = rotName(i);
      const badge = scores[i].excluded ? `<span class="badge out">${T().badgeOut}</span>`
        : `<span class="badge${ranked[0] === i ? " top" : ""}">${T().badgeRank(ranked.indexOf(i) + 1)}</span>`;
      const slots = seq.map((c, j) =>
        (j ? `<span class="sep" aria-hidden="true">–</span>` : "") +
        `<select data-rot="${i}" data-slot="${j}" aria-label="${T().yearOf(j + 1, name)}">` +
        CROP_OPTIONS.map(o => `<option value="${o}"${o === c ? " selected" : ""}>${cropName(o)}</option>`).join("") +
        `</select>`).join("");
      const cells = r.years.map(y => {
        const cls = y.met === null ? "bad" : y.met >= 0.75 ? "good" : y.met >= 0.5 ? "mid" : "bad";
        const bg = cls === "good" ? "var(--w-good)" : cls === "mid" ? "var(--w-mid)" : "var(--w-bad)";
        const tip = `${y.year}\n` + y.fields.map(f => f.met === null ? T().tipFallow :
          T().tipField(T().after(f.use, f.previous), pct(100 * f.met), fmt1(f.yield_t_ha))).join("\n");
        return `<span class="${cls === "bad" ? "bad" : ""}" style="background:${bg}" data-tip="${tip.replace(/"/g, "&quot;")}"></span>`;
      }).join("");
      const first = r.years[0].year, last = r.years[r.years.length - 1].year;
      return `<div class="rot${i === 0 ? " current" : ""}">
        <div class="rot-name"><span class="swatch" style="background:${COLORS[i]}"></span>
          <div><b>${name}</b><small>${seqText(seq)}</small>${badge}</div></div>
        <div>
          <div class="slots">${slots}
            <button type="button" class="slot-btn" data-add="${i}" aria-label="${T().addYear}" ${seq.length >= 6 ? "disabled" : ""}>+</button>
            <button type="button" class="slot-btn" data-remove="${i}" aria-label="${T().removeYear}" ${seq.length <= 2 ? "disabled" : ""}>−</button>
          </div>
          <div class="strip" style="--n:${r.years.length}" role="img" aria-label="${T().stripAria(name)}">${cells}</div>
          <div class="strip-years"><span>${first}</span><span>${last}</span></div>
        </div>
        <div class="rot-stats">
          <div class="stat${Math.round(r.cover.bare_fallow_days) === minTilled ? " best" : ""}"><b>${Math.round(r.cover.bare_fallow_days)}</b><span>${T().fa.statTilled}</span></div>
          <div class="stat${r.crop_years_per_10 === maxCrop ? " best" : ""}"><b>${fmt1(r.crop_years_per_10)}</b><span>${T().statCrops}</span></div>
          <div class="stat${r.severe_stress_crop_years_pct === minFail ? " best" : ""}"><b>${pct(r.severe_stress_crop_years_pct)}%</b><span>${T().statFail}</span></div>
        </div>
      </div>`;
    }).join("");
  }

  // ------------------------------------------------------------------ money
  function renderMoney() {
    const res = state.results, years = res[0].years.map(y => y.year);
    const W = 720, H = 360, L = 58, R = 150, Tp = 14, B = 34;
    const all = res.flatMap(r => r.cumulative_income).concat([0]);
    let lo = Math.min(...all) / 1000, hi = Math.max(...all) / 1000;
    const step = niceStep((hi - lo) / 5); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (i) => L + (W - L - R) * i / (years.length - 1);
    const y = (v) => Tp + (H - Tp - B) * (1 - (v / 1000 - lo) / (hi - lo));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T().s2Title}">`;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
      s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${Math.abs(v) < 1e-9 ? "#5d6e67" : "#24302c"}"/>` +
           `<text x="${L - 8}" y="${yy + 4}" text-anchor="end">${nf.format(v)}</text>`;
    }
    years.forEach((yr, i) => { if ((i % 5 === 0 && i < years.length - 3) || i === years.length - 1) s += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${yr}</text>`; });
    s += `<text x="${L}" y="${Tp - 2}" text-anchor="start" style="font-size:11px">${T().moneyAxis}</text>`;
    const ends = res.map((r, i) => ({ i, v: r.cumulative_income[r.cumulative_income.length - 1] }));
    res.forEach((r, i) => {
      const d = r.cumulative_income.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("");
      s += `<path d="${d}" fill="none" stroke="${COLORS[i]}" stroke-width="${i === 0 ? 3 : 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    // direct labels at line ends, nudged apart
    const placed = ends.map(e => ({ ...e, py: y(e.v) })).sort((a, b) => a.py - b.py);
    for (let k = 1; k < placed.length; k++) if (placed[k].py - placed[k - 1].py < 16) placed[k].py = placed[k - 1].py + 16;
    placed.forEach(e => {
      s += `<circle cx="${x(years.length - 1)}" cy="${y(e.v)}" r="4" fill="${COLORS[e.i]}" stroke="#0f1614" stroke-width="2"/>` +
           `<text class="lbl" x="${x(years.length - 1) + 10}" y="${e.py + 4}">${rotName(e.i)}</text>`;
    });
    s += `<line id="cross" x1="0" x2="0" y1="${Tp}" y2="${H - B}" stroke="#e9ede6" stroke-width="1" opacity="0"/>`;
    s += `<rect id="hit" x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent"/></svg>`;
    $("money-chart").innerHTML = s;
    const svg = $("money-chart").querySelector("svg");
    svg._x = { L, R, W, n: years.length, years };

    const best = bestIndex(), span = period(years[0], years[years.length - 1], DATA.points[state.point]);
    $("money-summary").textContent = best === 0 ? T().moneySame(span) :
      T().moneySummary(`“${rotName(best)}”`, money(res[best].mean_income_per_ha - res[0].mean_income_per_ha), span);
  }

  function moneyTip(e) {
    const svg = $("money-chart").querySelector("svg"); if (!svg) return null;
    const g = svg._x, rect = svg.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * g.W / rect.width;
    if (sx < g.L || sx > g.W - g.R) { svg.querySelector("#cross").setAttribute("opacity", 0); return null; }
    const i = Math.round((sx - g.L) / ((g.W - g.L - g.R) / (g.n - 1)));
    const cx = g.L + (g.W - g.L - g.R) * i / (g.n - 1);
    const cross = svg.querySelector("#cross"); cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 0.35);
    return `${g.years[i]}\n` + state.results.map((r, k) =>
      `${rotName(k)}: ${money(r.cumulative_income[i])} ₸ (${r.years[i].income_per_ha >= 0 ? "+" : ""}${money(r.years[i].income_per_ha)} ${T().thatYear})`).join("\n");
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  function renderEcon() {
    const used = CROP_OPTIONS.filter(c => c !== "fallow" && state.rotations.some(s => s.includes(c)));
    const inp = (c, k, step) => `<input type="number" min="0" step="${step}" data-crop="${c}" data-key="${k}" value="${state.econ[c][k]}" aria-label="${T().cropTitle[c]}: ${k}">`;
    let h = `<tr><th>${T().econCrop}</th><th>${T().econYield}</th><th>${T().econPrice}</th><th>${T().econCost}</th></tr>`;
    used.forEach(c => { h += `<tr><td>${T().cropTitle[c]}</td><td>${inp(c, "yield_t_ha", 0.1)}</td><td>${inp(c, "price_per_t", 1000)}</td><td>${inp(c, "cost_per_ha", 1000)}</td></tr>`; });
    if (state.rotations.some(s => s.includes("fallow"))) {
      h += `<tr><td colspan="3">${T().econFallowCost}</td><td>${inp("fallow", "cost_per_ha", 1000)}</td></tr>`;
    }
    $("econ").innerHTML = h;
  }

  // ------------------------------------------------------------------ next spring (analog autumns)
  const K_ANALOG = 5;
  function analogs(point) {
    const entries = Object.entries(point.autumn.years).map(([y, v]) => ({ year: +y, ...v }));
    const current = entries.reduce((a, b) => (b.year > a.year ? b : a));
    const past = entries.filter(e => e.year < current.year && e.year + 1 <= point.keep_to);
    const sd = (k) => { const m = past.reduce((s, e) => s + e[k], 0) / past.length;
      return Math.sqrt(past.reduce((s, e) => s + (e[k] - m) ** 2, 0) / past.length) || 1; };
    const sw = sd("wetness"), sr = sd("rain_mm");
    past.forEach(e => { e.dist = Math.hypot((e.wetness - current.wetness) / sw, 0.3 * (e.rain_mm - current.rain_mm) / sr); });
    const near = past.slice().sort((a, b) => a.dist - b.dist).slice(0, K_ANALOG);
    const all = entries.slice().sort((a, b) => a.wetness - b.wetness);
    const rank = all.findIndex(e => e.year === current.year) + 1;
    return { current, past, near, rank, n: all.length };
  }

  function nextSpringOutcomes(point, prev, next) {
    const crop = crops[next]; if (!crop) return null;
    const opts = { sowShiftDays: state.shift, soil: { available_water_mm_per_m: SOILS[state.soil] } };
    const byYear = {};
    for (let phase = 0; phase < 2; phase++) {
      for (const rec of FallowModel.simulate(point.weather, [prev, next], phase, crops, opts)) {
        if (rec.land_use === next && rec.previous === prev && rec.year >= 2001 && rec.year <= point.keep_to && rec.demand_mm > 0) {
          const met = rec.transpiration_mm / rec.demand_mm;
          byYear[rec.year] = { met, rel: Math.max(0, 1 - crop.ky * (1 - met)) };
        }
      }
    }
    return byYear;
  }

  function renderAutumn() {
    const p = DATA.points[state.point], a = analogs(p);
    $("autumn-lead").textContent = T().autumnLead(a.current.year, a.rank, a.n, Math.round(a.current.rain_mm));
    const prev = $("this-year").value || "wheat", next = $("next-year").value || "wheat";
    const out = nextSpringOutcomes(p, prev, next);
    drawAutumnChart(a);
    if (!out) { $("autumn-answer").textContent = T().autumnFallow; $("autumn-detail").textContent = ""; $("autumn-years").innerHTML = ""; return; }
    const years = Object.keys(out).map(Number);
    const allMet = years.reduce((s, y) => s + out[y].met, 0) / years.length;
    const allRel = years.reduce((s, y) => s + out[y].rel, 0) / years.length;
    const near = a.near.map(e => ({ ...e, o: out[e.year + 1] })).filter(e => e.o);
    const nearMet = near.reduce((s, e) => s + e.o.met, 0) / near.length;
    const nearRel = near.reduce((s, e) => s + e.o.rel, 0) / near.length;
    const fails = near.filter(e => e.o.met < 0.5).length;
    const usual = state.econ[next] ? state.econ[next].yield_t_ha : null;
    const relPct = allRel > 0 ? 100 * nearRel / allRel : 0;
    const pairs = a.past.filter(e => out[e.year + 1]);
    const r = correlation(pairs.map(e => e.wetness), pairs.map(e => out[e.year + 1].met));
    const mets = near.map(e => e.o.met);
    $("autumn-answer").textContent = T().autumnHead(allMet > 0 ? 100 * nearMet / allMet : 0);   // water, not yield
    $("autumn-detail").textContent = T().autumnAnswer(next, prev, pct(100 * nearMet), pct(100 * allMet), fails, near.length) +
      " " + T().autumnRange(pct(100 * Math.min(...mets)), pct(100 * Math.max(...mets))) +
      " " + T().autumnNotForecast +
      " " + T().autumnSignal(r) + (a.rank === 1 || a.rank === a.n ? " " + T().autumnOutside : "");
    const row = (label, met, cls) => `<div class="ay ${cls || ""}"><span>${label}</span>
      <span class="track"><span class="bar" style="display:block;width:${Math.max(2, Math.min(100, 100 * met))}%"></span></span>
      <span class="val">${pct(100 * met)}%</span></div>`;
    $("autumn-years").innerHTML = near.map(e => row(String(e.year + 1), e.o.met, "") .replace("<span>" + (e.year + 1) + "</span>",
      `<span data-tip="${T().autumnRow(e.year)}">${e.year + 1}</span>`)).join("") + row(T().autumnAvg, allMet, "avg");
  }

  function correlation(a, b) {
    const n = a.length; if (n < 3) return 0;
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }

  function drawAutumnChart(a) {
    const W = 560, H = 330, L = 50, R = 16, Tp = 16, B = 46;
    const pts = a.past.concat([a.current]);
    const xs = pts.map(e => e.wetness), ys = pts.map(e => e.rain_mm);
    const x0 = Math.min(...xs) - 0.01, x1 = Math.max(...xs) + 0.01, y1 = Math.max(...ys) * 1.1;
    const X = v => L + (W - L - R) * (v - x0) / (x1 - x0), Y = v => Tp + (H - Tp - B) * (1 - v / y1);
    const nearSet = new Set(a.near.map(e => e.year));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T().autumnChartLabel}">`;
    const ys_ = niceStep(y1 / 4);
    for (let v = 0; v <= y1; v += ys_) s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#24302c"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    const xs_ = niceStep((x1 - x0) / 4);
    for (let v = Math.ceil(x0 / xs_) * xs_; v <= x1; v += xs_) s += `<text x="${X(v)}" y="${H - 26}" text-anchor="middle">${v.toFixed(2)}</text>`;
    s += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">${T().autumnX}</text>`;
    s += `<text x="${L}" y="${Tp - 4}" style="font-size:11px">${T().autumnY}</text>`;
    a.past.forEach(e => {
      const near = nearSet.has(e.year);
      s += `<circle cx="${X(e.wetness)}" cy="${Y(e.rain_mm)}" r="${near ? 6 : 4.5}" fill="${near ? "#3987e5" : "#4a5a54"}" stroke="#0f1614" stroke-width="2" data-tip="${e.year}: ${e.wetness.toFixed(3)}, ${Math.round(e.rain_mm)} mm"/>`;
      if (near) s += `<text class="lbl" x="${X(e.wetness) + 9}" y="${Y(e.rain_mm) + 4}" style="font-size:12px">${e.year}</text>`;
    });
    const c = a.current;
    s += `<circle cx="${X(c.wetness)}" cy="${Y(c.rain_mm)}" r="8" fill="#e6bd57" stroke="#0f1614" stroke-width="2" data-tip="${c.year}: ${c.wetness.toFixed(3)}, ${Math.round(c.rain_mm)} mm"/>` +
         `<text class="lbl" x="${X(c.wetness) + 12}" y="${Y(c.rain_mm) + 5}" style="font-weight:700">${c.year}</text></svg>`;
    $("autumn-chart").innerHTML = s;
  }

  function fillAutumnSelects() {
    const cur = state.rotations[0];
    const thisSel = $("this-year"), nextSel = $("next-year");
    const keepThis = thisSel.value, keepNext = nextSel.value;
    thisSel.innerHTML = CROP_OPTIONS.map(o => `<option value="${o}">${cropName(o)}</option>`).join("");
    nextSel.innerHTML = CROP_OPTIONS.filter(o => o !== "fallow").map(o => `<option value="${o}">${cropName(o)}</option>`).join("");
    thisSel.value = keepThis || "wheat"; nextSel.value = keepNext || "wheat";
    if (!keepThis && cur.includes("wheat")) thisSel.value = "wheat";
  }

  // ------------------------------------------------------------------ water split
  const SPLIT = [
    ["through_crops_pct", "wCrops", "#4f9e45", "#0f1614"],
    ["soil_evaporation_pct", "wEvap", "#c98950", "#0f1614"],
    ["deep_drainage_pct", "wDrain", "#3987e5", "#0f1614"],
    ["snow_blown_off_pct", "wSnow", "#bcd4e4", "#0f1614"],
    ["melt_runoff_pct", "wRunoff", "#5f7f93", "#e9ede6"],
  ];
  function renderSplit() {
    $("water-split").innerHTML = state.results.map((r, i) => {
      const parts = SPLIT.map(([k, label, bg, fg]) => {
        const v = r.water_use[k];
        return `<span style="flex:${v.toFixed(2)} 0 0;background:${bg};color:${fg}" data-tip="${T()[label]}: ${pct(v)}%">${v >= 7 ? pct(v) + "%" : ""}</span>`;
      }).join("");
      return `<div class="split-row"><div class="name"><span class="swatch" style="background:${COLORS[i]}"></span>
        <span><b>${rotName(i)}</b><br><small>${T().fa.bareSplit(Math.round(r.cover.bare_fallow_days), Math.round(r.cover.bare_stubble_days))}<br>${T().carbon(signed(r.soil_carbon_t_c_per_year, 2), signed(r.soil_carbon_t_c_per_year * FallowModel.SOIL_CARBON.humus_per_carbon, 2))}${(() => { const h = humusChange(r, passport()); return h ? "<br>" + T().humusLine(fmtN(h.now, 2), fmtN(h.in10, 2)) : ""; })()}</small></span></div>
        <div class="split-bar">${parts}</div></div>`;
    }).join("");
    $("split-legend").innerHTML = SPLIT.map(([, label, bg]) => `<span class="key"><i style="background:${bg}"></i>${T()[label]}</span>`).join("") +
      `<span class="key" style="flex-basis:100%;max-width:80ch">${T().carbonNote}</span>`;
  }

  // ------------------------------------------------------------------ checks
  // ------------------------------------------------------------------ frost check
  function frostYears(crop) {
    const p = DATA.points[state.point], w = p.weather, cr = crops[crop];
    if (!cr || !w.tmin) return null;
    const start = FallowLive.dayNo(w.start[0], w.start[1], w.start[2]);
    const total = cr.stages_days.reduce((s, v) => s + v, 0);
    const [m, d] = cr.sow.split("-").map(Number);
    let hit = 0, years = 0;
    for (let y = 2000; y <= p.keep_to; y++) {
      const sow = FallowLive.dayNo(y, m, d) + state.shift;
      let frost = false;
      for (let n = sow + 10; n < sow + total; n++) {
        const t = w.tmin[n - start];
        if (t !== null && t !== undefined && t + state.scen.temp <= -2) { frost = true; break; }
      }
      years++; if (frost) hit++;
    }
    return { hit, years };
  }

  // ------------------------------------------------------------------ priorities
  function scoreRotations() {
    const res = state.results, w = state.prio;
    const metrics = res.map(r => ({ income: r.mean_income_per_ha, water: -r.severe_stress_crop_years_pct,
                                    soil: r.soil_carbon_t_c_per_year, bare: -r.cover.bare_fallow_days }));
    const norm = (k, v) => { const vals = metrics.map(m => m[k]), lo = Math.min(...vals), hi = Math.max(...vals); return hi - lo < 1e-9 ? 1 : (v - lo) / (hi - lo); };
    const wsum = Object.values(w).reduce((s, v) => s + v, 0) || 1;
    return res.map((r, i) => {
      const excluded = state.rotations[i].some(c => c !== "fallow" && !state.allow[c]);
      const score = Object.keys(w).reduce((s, k) => s + w[k] * norm(k, metrics[i][k]), 0) / wsum;
      return { i, score, excluded };
    });
  }

  function renderPriorities() {
    $("priorities").innerHTML = Object.keys(state.prio).map(k =>
      `<label class="range"><span>${T().prNames[k]}</span><input type="range" min="0" max="3" step="1" value="${state.prio[k]}" data-prio="${k}"><output>${T().prLevels[state.prio[k]]}</output></label>`).join("");
    $("crop-allow").innerHTML = Object.keys(state.allow).map(c =>
      `<label><input type="checkbox" data-allow="${c}" ${state.allow[c] ? "checked" : ""}>${T().cropTitle[c]}</label>`).join("");
  }

  function renderFit() {
    const ranked = scoreRotations().filter(s => !s.excluded).sort((a, b) => b.score - a.score);
    $("fit").textContent = ranked.length ? T().fit(rotName(ranked[0].i), ranked[1] ? rotName(ranked[1].i) : "") : T().fitNone;
    return ranked;
  }

  // ------------------------------------------------------------------ agrochemical passport
  const TEXTURE_SOIL = { sand: "light", loamy_sand: "light", sandy_loam: "light", loam: "medium", silt_loam: "medium", clay_loam: "heavy", clay: "heavy" };
  function passportKey() { const p = DATA.points[state.point]; return p.live ? `${p.meta.lat.toFixed(3)},${p.meta.lon.toFixed(3)}` : state.point; }
  function passport() { return state.passport[passportKey()] || (state.passport[passportKey()] = { depth: 20, density: 1.2 }); }
  function savePassport() { try { localStorage.setItem("uptopara-passport", JSON.stringify(state.passport)); } catch (e) { /* storage blocked */ } }

  function renderPassportForm() {
    const pp = passport(), L = T().pp;
    const num = (k, step) => `<label>${L[k]}<input type="number" step="${step}" min="0" data-pp="${k}" value="${pp[k] !== undefined ? pp[k] : ""}"></label>`;
    $("passport").innerHTML = num("year", 1) + num("humus", 0.1) +
      `<label>${L.texture}<select data-pp="texture">${Object.entries(T().textures).map(([k, v]) => `<option value="${k}"${(pp.texture || "") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>` +
      num("depth", 1) + num("density", 0.05) + num("p", 1) + num("k", 1) + num("ph", 0.1) +
      `<label class="wide">${L.fallow}<input type="text" data-pp="fallow" value="${pp.fallow || ""}"></label>`;
  }

  function humusChange(r, pp) {
    if (!(pp.humus > 0)) return null;
    const layer = (pp.depth || 20) / 100 * (pp.density || 1.2) * 10000;  // t of soil per hectare in the sampled layer
    const perYear = 100 * r.soil_carbon_t_c_per_year * FallowModel.SOIL_CARBON.humus_per_carbon / layer;
    return { now: pp.humus, in10: pp.humus + 10 * perYear };
  }

  function renderPassportResult() {
    const pp = passport(), out = [];
    const h = state.results && humusChange(state.results[0], pp);
    if (h) out.push(T().ppHumus(fmtN(h.now, 2), fmtN(h.in10, 2), 10, rotName(0)));
    if (pp.p || pp.k || pp.ph) out.push(T().ppNPK);
    $("pp-result").textContent = out.join(" ");
    renderRecords();
  }

  function renderRecords() {
    const pp = passport(), p = DATA.points[state.point];
    const mine = String(pp.fallow || "").match(/\d{4}/g);
    if (!mine || !p.cover || !p.cover.years.length) { $("records-check").textContent = ""; return; }
    const years = [...new Set(mine.map(Number))].filter(y => y >= 2000);
    const sat = p.cover.summary.likely_fallow_years || [];
    const matched = years.filter(y => sat.includes(y)), missed = years.filter(y => !sat.includes(y)), extra = sat.filter(y => !years.includes(y));
    $("records-check").textContent = T().records(matched.length, years.length, extra) + (missed.length ? T().recordsMissed(missed) : "");
  }

  // ------------------------------------------------------------------ slope (NASA SRTM)
  const slopeCache = {};
  async function renderSlope() {
    const p = DATA.points[state.point], key = passportKey();
    const show = (v) => {
      if (!v || v.error) { $("slope").textContent = T().slopeFail; return; }
      const risk = T().slopeRisk[v.slope_pct < 2 ? 0 : v.slope_pct < 5 ? 1 : 2];
      $("slope").textContent = T().slope(fmtN(v.slope_pct, 1), Math.round(v.elevation_m), risk);
    };
    if (slopeCache[key]) return show(slopeCache[key]);
    $("slope").textContent = "";
    try { slopeCache[key] = await FallowLive.fetchSlope(p.meta.lat, p.meta.lon); }
    catch (e) { slopeCache[key] = { error: true }; }
    if (passportKey() === key) show(slopeCache[key]);
  }

  // ------------------------------------------------------------------ glossary
  function renderGlossary() {
    $("glossary").innerHTML = T().glossary.map(([term, text]) => `<dt>${term}</dt><dd>${text}</dd>`).join("");
  }

  // ------------------------------------------------------------------ stress test
  function driestYears(p, n) {
    const mjj = p.may_july_rain || {};
    const rows = state.results[0].years.map(y => ({ year: y.year, rain: mjj[y.year] })).filter(r => r.rain !== undefined);
    return rows.sort((a, b) => a.rain - b.rain).slice(0, n).map(r => r.year).sort((a, b) => a - b);
  }

  function renderStress() {
    const p = DATA.points[state.point], worst = driestYears(p, 3);
    if (!worst.length) { $("stress-lead").textContent = ""; $("stress").innerHTML = ""; return; }
    $("stress-lead").textContent = T().stressLead(worst);
    const cols = T().stressCols;
    let h = `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;
    state.results.forEach((r, i) => {
      const ys = r.years.filter(y => worst.includes(y.year));
      const fields = ys.flatMap(y => y.fields.filter(f => f.met !== null));
      const met = fields.length ? fields.reduce((s, f) => s + f.met, 0) / fields.length : 0;
      const fails = fields.filter(f => f.met < 0.5).length;
      h += `<tr><td><span class="swatch" style="background:${COLORS[i]}"></span>${rotName(i)}</td>` +
           `<td>${pct(100 * met)}%</td><td>${T().stressFail(fails, fields.length)}</td></tr>`;
    });
    $("stress").innerHTML = h;
  }

  // ------------------------------------------------------------------ strategy cards
  const LEGUMES = ["pea", "lentil"], CEREALS = ["wheat", "barley", "oats"];
  function whyText(i, seq) {
    const start = startingRotations();
    if (i === 0) return whatIf() ? T().why.AIf : T().why.A;
    const k = start.findIndex(s => s.join() === seq.join());
    if (k > 0) return T().why["ABCD"[k]];
    const cur = state.rotations[0], changes = [];
    if (cur.includes("fallow") && !seq.includes("fallow")) changes.push(T().why.noFallow);
    if (seq.some(c => LEGUMES.includes(c)) && !cur.some(c => LEGUMES.includes(c))) changes.push(T().why.addsLegume);
    if (seq.some(c => c !== "fallow" && !CEREALS.includes(c) && !LEGUMES.includes(c))) changes.push(T().why.addsBreak);
    return T().why.custom(changes.length ? changes.join(", ") : T().why.same);
  }

  // A change against your rotation, said in words (more / fewer) with a better / worse label, so its
  // direction does not depend on reading a sign. higherIsBetter: true for harvests and soil carbon.
  function ruPlural(n, one, few, many) {
    const k = Math.floor(Math.abs(n)) % 100, d = k % 10;
    if (Math.abs(n) % 1) return few;
    if (k > 10 && k < 20) return many;
    return d === 1 ? one : d >= 2 && d <= 4 ? few : many;
  }
  function change(key, v, digits, higherIsBetter) {
    const G = T().gain, size = Number(Math.abs(v).toFixed(digits));
    if (size === 0) return `${G.same[key]} <span class="dir same">(${G.noChange})</span>`;
    const good = (v > 0) === higherIsBetter;
    return `${G[key](fmtN(size, digits), v > 0, size)} <span class="dir ${good ? "better" : "worse"}">(${good ? G.better : G.worse})</span>`;
  }

  function renderCards() {
    const p = DATA.points[state.point], A = state.results[0];
    const range = [state.results[0].years[0].year, state.results[0].years[state.results[0].years.length - 1].year];
    const fallowYears = (p.cover && p.cover.summary && p.cover.summary.likely_fallow_years) || [];
    $("cards").innerHTML = state.rotations.map((seq, i) => {
      const r = state.results[i];
      const ev = [T().ev.water(period(range[0], range[1], p), pct(r.water_use.through_crops_pct), pct(r.water_use.soil_evaporation_pct)),
                  T().ev.met(pct(r.mean_demand_met_pct), pct(r.severe_stress_crop_years_pct))];
      Object.values(r.by_crop).filter(e => e.previous === "fallow" || LEGUMES.includes(e.previous)).slice(0, 2)
        .forEach(e => ev.push(T().ev.sowing(T().after(e.crop, e.previous), Math.round(e.water_at_sowing_mm))));
      if (i === 0) ev.push(fallowYears.length ? T().ev.modis(fallowYears.join(", ")) : T().ev.modisNone);
      const fr = [...new Set(seq)].filter(c => crops[c]).map(c => ({ c, f: frostYears(c) })).filter(x => x.f);
      if (fr.length) ev.push(T().frostAll(fr.map(x => `${T().cropTitle[x.c].toLowerCase()} ${x.f.hit}/${x.f.years}`).join(", ")));

      const gains = i === 0 ? [T().gain.base] : [
        change("harvests", r.crop_years_per_10 - A.crop_years_per_10, 1, true),
        change("failures", r.severe_stress_crop_years_pct - A.severe_stress_crop_years_pct, 0, false),
        change("carbon", r.soil_carbon_t_c_per_year - A.soil_carbon_t_c_per_year, 2, true),
        change("bare", r.cover.bare_fallow_days - A.cover.bare_fallow_days, 0, false),
        T().gain.moneyLink,
      ];

      const used = [...new Set(seq)];
      const gaps = [T().gaps.weather, T().gaps.sowing];
      used.forEach(c => { const cr = crops[c]; if (cr && (cr.assumed || []).some(x => x.startsWith("ky"))) gaps.push(T().gaps.ky(T().cropTitle[c])); });
      if (used.includes("pea")) gaps.push(T().gaps.pea);
      if (used.includes("fallow") || used.some(c => LEGUMES.includes(c))) gaps.push(T().gaps.nitrogen);
      gaps.push(T().gaps.money);

      const risks = used.map(c => `<li><b>${T().cropTitle[c]}:</b> ${T().notes[c][1]} <span class="why">${T().notes[c][0]}</span></li>`);
      const li = (list) => `<ul>${list.map(x => x.startsWith("<li>") ? x : `<li>${x}</li>`).join("")}</ul>`;
      return `<article class="card" style="--c:${COLORS[i]}"><h3>${rotName(i)}</h3><p class="seq">${seqText(seq)}</p><dl>
        <div><dt>${T().cardWhy}</dt><dd>${whyText(i, seq)}</dd></div>
        <div><dt>${T().cardEvidence}</dt><dd>${li(ev)}</dd></div>
        <div><dt>${T().cardGain}</dt><dd>${li(gains)}</dd></div>
        <div><dt>${T().cardGaps}</dt><dd>${li(gaps)}</dd></div>
        <div><dt>${T().cardRisks}</dt><dd>${li(risks)}</dd></div></dl></article>`;
    }).join("");
  }

  // ------------------------------------------------------------------ render all
  // ------------------------------------------------------------------ first screen: water, bare soil, harvests
  // Fallow Audit: the main result is water, tilled bare soil and the number of harvests; money stays in pass 3.
  const rotationCrops = (i) => state.rotations[i].map(c => T().crops[c]).join(" – ");
  // The current rotation has fallow but MODIS shows no fallow-like year on this field: say "would have", not "now".
  function whatIf() {
    const s = DATA.points[state.point].cover && DATA.points[state.point].cover.summary;
    return state.rotations[0].includes("fallow") && !!s && !(s.likely_fallow_years || []).length;
  }
  function renderAnswer() {
    const R = state.results, A = R[0], p = DATA.points[state.point], F0 = T().fa, wi = whatIf();
    const F = Object.assign({}, F0, wi ? { headTilled: F0.headTilledIf, waterLine: F0.waterLineIf, waterLess: F0.waterLessIf, cropsLine: F0.cropsLineIf } : {});
    const summary = p.cover && p.cover.summary, warns = (summary && summary.warnings) || [];
    // one paragraph per warning that cover.py raised for this field
    const others = Object.entries(DATA.points).filter(([id]) => id !== state.point)
      .map(([, q]) => q.cover && q.cover.summary && q.cover.summary.median_summer_ndvi).filter(v => typeof v === "number");
    const d2 = (v) => fmtN(v, 2), dateText = (iso) => iso ? new Intl.DateTimeFormat(T().dateLocale,
      lang === "ru" ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(iso + "T00:00:00Z")) : "";
    const texts = warns.map(w => w.code === "low_summer_greenness"
      ? F.warnLow(d2(w.median_summer_ndvi), d2(Math.min(...others)), d2(Math.max(...others)), summary.likely_fallow_years.length,
                  /GIBS/.test(p.meta.ndvi_source || ""), dateText(p.meta.ornl_check_date), d2(p.cover.thresholds.fallow_summer_ndvi))
      : F.warn(summary.long_green_season_years.length, summary.years_analysed));
    $("point-warning").hidden = !texts.length;
    $("point-warning").innerHTML = texts.map(t => `<span class="warn-item">${t}</span>`).join("");

    // the option with the fewest days of tilled bare soil (ties: the first, i.e. option B)
    const tilled = (r) => (r.cover ? r.cover.bare_fallow_days : 0);
    let alt = 1;
    for (let i = 2; i < R.length; i++) if (tilled(R[i]) < tilled(R[alt])) alt = i;
    const altLabel = `${rotName(alt)}: ${rotationCrops(alt)}`;
    $("answer-1").textContent = tilled(A) >= 0.5
      ? F.headTilled(Math.round(tilled(A)), Math.round(tilled(R[alt])), altLabel) : F.headNoTilled;

    const entries = Object.values(A.by_crop), afterFallow = entries.filter(e => e.previous === "fallow");
    let water = T().ans.noFallowSub(pct(A.water_use.through_crops_pct), pct(A.water_use.soil_evaporation_pct));
    if (afterFallow.length) {
      const crop = afterFallow[0].crop, others = entries.filter(e => e.crop === crop && e.previous !== "fallow");
      const wAvg = (list, k) => list.reduce((s, e) => s + e[k] * e.crop_years, 0) / list.reduce((s, e) => s + e.crop_years, 0);
      if (others.length) {
        const extra = afterFallow[0].water_at_sowing_mm - wAvg(others, "water_at_sowing_mm");
        const stay = A.fallow ? pct(A.fallow.storage_efficiency_pct.mean) : null;
        water = extra >= 0 && stay !== null ? F.waterLine(T().crops[crop], Math.round(extra), stay)
              : extra < 0 ? F.waterLess(T().crops[crop], Math.round(-extra)) : water;
      }
    }
    $("answer-2").textContent = water;
    $("answer-3").textContent = F.cropsLine(fmtN(A.crop_years_per_10, 1), fmtN(R[alt].crop_years_per_10, 1), altLabel,
                                           pct(A.mean_demand_met_pct), pct(R[alt].mean_demand_met_pct));
    $("answer-note").innerHTML = (state.scen.rain || state.scen.temp)
      ? `<span class="scenario-note">${T().scNote(state.scen.rain, state.scen.temp)}</span> ${F.note}` : F.note;
  }

  // ------------------------------------------------------------------ pass 5: the harvest-to-sowing window of a fallow
  function renderFallowWindow() {
    const A = state.results[0], F = T().fa, box = $("fallow-window");
    if (!A.fallow) { box.innerHTML = `<p class="fig-note">${F.windowNone}</p>`; return; }
    const colour = (key) => (SPLIT.find(s => s[1] === key) || [])[2];
    const parts = [["stay", F.wStay, "#4f9e45"], ["evaporated_from_soil", T().wEvap, colour("wEvap")],
                   ["drained_below_profile", T().wDrain, colour("wDrain")], ["snow_blown_off", T().wSnow, colour("wSnow")],
                   ["snowmelt_runoff", T().wRunoff, colour("wRunoff")]];
    const row = (label, block) => {
      const v = Object.assign({ stay: block.storage_efficiency_pct.mean }, block.where_it_went_pct);
      return `<div class="split-row"><div class="name"><span><b>${label}</b></span></div><div class="split-bar">` +
        parts.map(([k, name, bg]) => v[k] > 0.5
          ? `<span style="flex:${v[k].toFixed(2)} 0 0;background:${bg};color:#0f1614" data-tip="${name}: ${pct(v[k])}%">${v[k] >= 7 ? pct(v[k]) + "%" : ""}</span>` : "").join("") +
        `</div></div>`;
    };
    box.innerHTML = `<h3 class="check-title">${F.windowTitle}</h3>` + row(F.windowFallow(nf.format(A.fallow.mean_precip_mm)), A.fallow) +
      (A.after_wheat_storage ? row(F.windowStubble(nf.format(A.after_wheat_storage.mean_precip_mm)), A.after_wheat_storage) : "") +
      `<div class="split-legend">${parts.map(([k, name, bg]) => `<span class="key"><i style="background:${bg}"></i>${name} ${pct(k === "stay" ? A.fallow.storage_efficiency_pct.mean : A.fallow.where_it_went_pct[k])}%</span>`).join("")}</div>` +
      `<p class="fig-note">${F.windowNote(A.fallow.count)}</p>`;
  }

  // ------------------------------------------------------------------ pass 7: checks against independent data
  const carbonCache = new Map();
  function carbonSwitch(id) {      // wheat-fallow -> continuous wheat, default soil and sowing dates, same weather
    if (carbonCache.has(id)) return carbonCache.get(id);
    const p = DATA.points[id];
    const r = FallowModel.runAll(p, [{ id: "WF", sequence: ["fallow", "wheat"] }, { id: "WW", sequence: ["wheat"] }], crops, {},
                                 { keepFrom: 2000, keepTo: p.keep_to });
    const v = r[1].soil_carbon_t_c_per_year - r[0].soil_carbon_t_c_per_year;
    carbonCache.set(id, v);
    return v;
  }
  function trLabel(s) {            // labels from model/validation.json are English; translate the few words they use
    s = s.replace(/(\d{4})-(\d{4})/, (m, a, b) => period(+a, +b, DATA.points[state.point]));
    if (lang !== "ru") return s;
    return s.replace("mean ", "среднее ").replace("trial years ", "годы опыта ").replace("after fallow", "после пара")
            .replace("after pea", "после гороха").replace("after oats", "после овса").replace("harvest to sowing", "от уборки до посева");
  }
  function renderChecks() {
    const p = DATA.points[state.point], F = T().fa, ev = p.evidence;
    // GWETROOT
    const g = ev && ev.gwetroot_check, dates = g ? ["may_1", "sep_15"].filter(k => g.dates[k]) : [];
    $("gw-block").hidden = !dates.length;
    if (dates.length) {
      const r2 = (v) => fmtN(v, 2);
      $("gw-lead").textContent = F.gwLead(g.dates[dates[0]].years.length, r2(g.dates.may_1.pearson_r), r2(g.dates.sep_15.pearson_r));
      const yrs = (list, common) => list.map(y => common.includes(y) ? `<b>${y}</b>` : `${y}`).join(", ");
      $("gw-table").innerHTML = `<tr>${F.gwCols.map(c => `<th>${c}</th>`).join("")}</tr>` + dates.map(k => {
        const d = g.dates[k];
        return `<tr><td>${F.gwDates[k]}</td><td>${r2(d.pearson_r)}<small>${F.strength(d.pearson_r)}</small></td><td>${r2(d.spearman_rho)}</td>` +
          `<td class="yrs">${F.gwModel}: ${yrs(d.driest_model, d.driest_common)}<br>${F.gwPower}: ${yrs(d.driest_power, d.driest_common)}<small>${F.gwCommon(d.driest_common.length)}</small></td>` +
          `<td class="yrs">${F.gwModel}: ${yrs(d.wettest_model, d.wettest_common)}<br>${F.gwPower}: ${yrs(d.wettest_power, d.wettest_common)}<small>${F.gwCommon(d.wettest_common.length)}</small></td></tr>`;
      }).join("");
      $("gw-note").textContent = F.gwNote;
    }

    // Shortandy trial (only points with a published trial)
    const v = p.validation;
    $("trial-block").hidden = !v;
    if (!v) ["trial-lead", "trial-verdict", "trial-notes"].forEach(id => { $(id).textContent = ""; });
    if (v) {
      const trial = v.trial || {}, mm = (x) => signed(x, 0);
      const checked = lang === "ru" && trial.verified_by === "team, checked against the publisher PDF on 2026-11-14"
        ? "сверены командой с PDF издателя 14.11.2026" : trial.verified_by;
      $("trial-lead").textContent = F.trialLead(trial.years, checked);
      let t = `<tr>${F.trialCols.map(c => `<th>${c}</th>`).join("")}</tr>`;
      let verdict = "", explain = "", quote = "";
      v.rows.forEach(r => {
        const label = (lang === "ru" && F.rowLabel[r.key]) || r.label;
        let model, published, against;
        if (r.kind === "range") {
          model = r.models.map(m => `${mm(m.value)} ${lang === "ru" ? "мм" : "mm"}<small>${trLabel(m.label)}</small>`).join("");
          published = `${(lang === "ru" && F.pubText[r.key]) || r.published_text}<small>0-${r.depth_cm} cm, ${r.years}, ${r.page_or_table}; ${(lang === "ru" && F.noteText[r.key]) || r.note}</small>`;
          against = r.models.map(m => {
            let s;
            if (m.position == null) s = F.reference;
            else if (m.published != null) s = m.position === "opposite sign" ? F.opposite(mm(m.published), mm(m.value)) : F.sameSign(mm(m.published), mm(m.value));
            else s = m.position === "within" ? F.within : F.outside(m.position, fmtN(m.distance, 0));
            return s + (m.depth_differs ? F.depthDiffers : "") + `<small>${trLabel(m.label)}</small>`;
          }).join("");
          const meanTrial = r.models.find(m => m.label.startsWith(`mean ${r.years}`));
          const opp = r.models.find(m => m.position === "opposite sign");
          if (meanTrial && r.published_range) {
            const inRange = meanTrial.value >= r.published_range[0] && meanTrial.value <= r.published_range[1];
            const off = r.models.some(m => m.position && m.position !== "within" && m.position !== "same sign");
            verdict = off ? F.verdict(r.years, mm(meanTrial.value), inRange, opp ? opp.year : null) : "";
          }
          if (opp) explain = F.explain(opp.year, mm(opp.published), mm(opp.value));
          if (r.quote) quote = F.quote(r.page_or_table, r.quote);
        } else if (r.kind === "direction") {
          model = r.models.map(m => `${pct(m.value)}% ${trLabel(m.label)}`).join("<br>") + `<small>${(lang === "ru" && F.measure[r.key]) || r.model_measure}</small>`;
          published = `${(lang === "ru" && F.pubText[r.key]) || r.published_text}<small>${r.years}, ${r.page_or_table}</small>`;
          against = (r.same_direction ? F.sameDirection : F.otherDirection) + `<small>${F.directionNote}</small>`;
        } else {
          model = r.models.map(m => `${nf.format(m.value)}${r.unit === "%" ? "%" : (lang === "ru" ? " мм" : " mm")}<small>${trLabel(m.label)}</small>`).join("");
          published = `<span class="pending">${F.notReported}</span>`;
          against = "–";
        }
        t += `<tr><td>${label}</td><td class="cmp">${model}</td><td class="cmp">${published}</td><td class="cmp">${against}</td></tr>`;
      });
      $("trial-compare").innerHTML = t;
      $("trial-verdict").textContent = [verdict, explain, quote].filter(Boolean).join(" ");

      const rot = trial.rotations || {}, control = rot.A_current;
      $("trial-table").innerHTML = `<caption class="fig-note">${F.trialCaption(trial.table || "", trial.years, period(ev.climate.years[0], ev.climate.years[1], p))}</caption>` +
        `<tr>${F.trialTableCols.map(c => `<th>${c}</th>`).join("")}</tr>` +
        Object.entries(rot).map(([k, r]) => {
          const crops = r.crops.map((c, i) => `${T().crops[c]} ${fmtN(r.yield_t_ha[i], 2)}`).join(", ");
          const vs = k === "A_current" ? F.control : signed(100 * (r.whole_area_t_ha / control.whole_area_t_ha - 1), 0) + "%";
          const weeds = (trial.weeds_dry_matter_g_m2 || {})[k];
          return `<tr><td>${r.name}</td><td>${crops}</td><td>${fmtN(r.whole_area_t_ha, 2)}</td><td>${vs}</td><td>${weeds == null ? "–" : fmtN(weeds, 1)}</td></tr>`;
        }).join("");
      const notes = lang === "ru" && F.trialNotes.length ? F.trialNotes : (trial.notes || []);
      const c = ev.climate;
      $("trial-notes").textContent = notes.join(" ") + (trial.precipitation_mm_per_year != null
        ? " " + F.station(trial.precipitation_mm_per_year, fmtN(trial.mean_air_temperature_c, 1), nf.format(c.mean_rain_snow_mm_per_year),
                          fmtN(c.mean_air_temperature_c, 1), c.mean_years.join("-")) : "");
    }

    // soil carbon against Takata et al. (abstracts)
    const dc = carbonSwitch(state.point);
    $("carbon-check").textContent = F.carbonCheck(signed(dc, 2), dc >= 0.1 && dc <= 0.3);
    $("carbon-coeffs").textContent = F.carbonCoeffs;
  }

  function renderAll() {
    compute();
    renderFields();
    const lead = document.querySelector('[data-t="s1Lead"]');      // the years this field's weather covers
    if (lead) lead.textContent = tr("s1Lead").replace("{period}", period(2000, DATA.points[state.point].keep_to, DATA.points[state.point]));
    renderTimeline();
    renderMap();
    ensureGrid();
    renderGrid();
    ensureSmap();
    renderAnswer();
    drawRibbon();
    renderRotations();
    renderMoney();
    renderEcon();
    renderAutumn();
    renderSplit();
    renderFallowWindow();
    renderStress();
    renderCards();
    renderChecks();
    renderFit();
    renderPassportForm();
    renderPassportResult();
    renderSlope();
  }

  function rerun() { compute(); renderAnswer(); renderRotations(); renderMoney(); renderAutumn(); renderSplit(); renderFallowWindow(); renderStress(); renderCards(); renderFit(); renderPassportResult(); }
  let timer = null;
  const rerunSoon = () => { clearTimeout(timer); timer = setTimeout(rerun, 150); };

  // ------------------------------------------------------------------ events
  $("fields").addEventListener("click", e => {
    const b = e.target.closest("button"); if (b && b.dataset.id) selectPoint(b.dataset.id);
  });
  $("lens-modes").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.dataset.mode === state.mode) return;
    state.mode = b.dataset.mode; updateImagery();
  });
  $("grid-toggle").addEventListener("change", e => { state.showGrid = e.target.checked; renderGridOverlay(); renderLens(); });
  $("years").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { stopPlay(); setYear(+b.dataset.year); } });
  $("years").addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const last = lastYearOf(DATA.points[state.point]);
    const y = Math.max(2000, Math.min(last, state.year + (e.key === "ArrowRight" ? 1 : -1)));
    e.preventDefault(); stopPlay(); setYear(y);
    const b = document.querySelector(`#years button[data-year="${y}"]`); if (b) b.focus();
  });
  $("play").addEventListener("click", togglePlay);
  $("season").addEventListener("change", e => { state.season = +e.target.value; updateImagery(); });
  $("loader-hide").addEventListener("click", () => { $("loader").hidden = true; });
  $("soil").addEventListener("change", e => { state.soil = e.target.value; rerun(); });
  $("sow-shift").addEventListener("change", e => { state.shift = Number(e.target.value); rerun(); });
  $("reset").addEventListener("click", () => {
    state.rotations = startingRotations(); state.econ = startingEconomics(); state.soil = "medium"; state.shift = 0;
    state.scen = { rain: 0, temp: 0 }; $("sc-rain").value = 0; $("sc-temp").value = 0; scOut();
    applyText(); fillAutumnSelects(); renderAll();
  });
  $("rotations").addEventListener("change", e => {
    const t = e.target; if (!t.dataset.rot) return;
    state.rotations[+t.dataset.rot][+t.dataset.slot] = t.value; rerun(); renderEcon();
  });
  $("rotations").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.add !== undefined) { const s = state.rotations[+b.dataset.add]; if (s.length < 6) s.push("wheat"); }
    else if (b.dataset.remove !== undefined) { const s = state.rotations[+b.dataset.remove]; if (s.length > 2) s.pop(); }
    else return;
    rerun(); renderEcon();
  });
  $("econ").addEventListener("input", e => {
    const t = e.target; if (!t.dataset.crop) return;
    const v = parseFloat(t.value); if (!isFinite(v) || v < 0) return;
    state.econ[t.dataset.crop][t.dataset.key] = v; rerunSoon();
  });

  const tip = $("tip");
  function showTip(text, e) {
    if (!text) { tip.style.display = "none"; return; }
    tip.textContent = text; tip.style.display = "block";
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = e.clientX + 14, top = e.clientY + 14;
    if (left + w > window.innerWidth - 8) left = e.clientX - w - 14;
    if (top + h > window.innerHeight - 8) top = e.clientY - h - 14;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  document.addEventListener("mousemove", e => {
    if (e.target.id === "ribbon") return showTip(ribbonTip(e), e);
    if (e.target.id === "grid-map") return showTip(gridTip(e), e);
    if (e.target.closest && e.target.closest("#money-chart svg")) return showTip(moneyTip(e), e);
    const el = e.target.closest && e.target.closest("[data-tip]");
    showTip(el ? el.dataset.tip : null, e);
  });
  document.addEventListener("mouseleave", () => showTip(null));
  let resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { drawRibbon(); renderGrid(); }, 120); });

  const scOut = () => { $("sc-rain-out").textContent = (state.scen.rain > 0 ? "+" : "") + state.scen.rain + "%"; $("sc-temp-out").textContent = "+" + state.scen.temp + " °C"; };
  $("sc-rain").addEventListener("input", e => { state.scen.rain = +e.target.value; scOut(); rerunSoon(); });
  $("sc-temp").addEventListener("input", e => { state.scen.temp = +e.target.value; scOut(); rerunSoon(); });
  $("priorities").addEventListener("input", e => {
    const k = e.target.dataset.prio; if (!k) return;
    state.prio[k] = +e.target.value; e.target.nextElementSibling.textContent = T().prLevels[state.prio[k]];
    renderRotations(); renderFit();
  });
  $("crop-allow").addEventListener("change", e => { const c = e.target.dataset.allow; if (!c) return; state.allow[c] = e.target.checked; renderRotations(); renderFit(); });
  $("passport").addEventListener("change", e => {
    const k = e.target.dataset.pp; if (!k) return;
    const pp = passport();
    pp[k] = ["texture", "fallow"].includes(k) ? e.target.value : (e.target.value === "" ? undefined : parseFloat(e.target.value));
    savePassport();
    if (k === "texture" && TEXTURE_SOIL[pp.texture]) { state.soil = TEXTURE_SOIL[pp.texture]; $("soil").value = state.soil; rerun(); }
    else { renderPassportResult(); renderSplit(); }
  });
  $("coord-form").addEventListener("submit", e => {
    e.preventDefault();
    const nums = ($("coord").value.match(/-?\d+(?:[.,]\d+)?/g) || []).map(v => parseFloat(v.replace(",", ".")));
    if (nums.length !== 2) { setLiveStatus(T().coordBad, true); return; }
    loadLivePoint(nums[0], nums[1]);
    if (map) map.setView([nums[0], nums[1]], 13);
  });
  $("langs").addEventListener("click", e => { const b = e.target.closest("button"); if (b && b.dataset.lang !== lang) setLang(b.dataset.lang); });
  $("this-year").addEventListener("change", renderAutumn);
  $("next-year").addEventListener("change", renderAutumn);

  applyText();
  // keep the field console below the title block whatever its height (language, browser translation, font)
  const orbitHead = document.querySelector(".orbit-head"), orbitBox = document.querySelector(".orbit");
  let headH = 0;
  const placeConsole = () => {
    const h = Math.ceil(orbitHead.getBoundingClientRect().bottom - orbitBox.getBoundingClientRect().top);
    if (h === headH) return;
    headH = h;
    orbitBox.style.setProperty("--head-h", h + "px");
    if (mapFallbackOn) drawMapFallback();          // the offline map sketch moves its note and frame down too
  };
  if (orbitHead && orbitBox) {
    placeConsole();
    if (window.ResizeObserver) new ResizeObserver(placeConsole).observe(orbitHead);
    // a browser translation or a language switch replaces the text: measure again right away
    if (window.MutationObserver) new MutationObserver(placeConsole).observe(orbitHead, { subtree: true, childList: true, characterData: true });
    window.addEventListener("resize", placeConsole);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeConsole);
  }
  fillAutumnSelects();
  renderPriorities();
  renderGlossary();
  scOut();
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawRibbon);
})();
