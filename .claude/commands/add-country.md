# Add Country to HydroBattery Atlas

Add all PHES site data for a new country to the atlas. Argument: country name (e.g. `Nigeria`).

## Usage
```
/add-country Nigeria
/add-country "South Africa"
```

---

## Step 0 — Resolve inputs

The country name comes from `$ARGUMENTS`. Strip quotes if present.

Derive:
- `COUNTRY` = argument as-is (e.g. `Nigeria`)
- `COUNTRY_SLUG` = lowercase, spaces → underscores, special chars removed (e.g. `nigeria`, `south_korea`)
- `COUNTRY_CODE` = 2-letter ISO code (e.g. `NG`, `ZA`) — used for ANU site ID prefixes
- `DISPLAY_NAME` = how the country appears in the HTML dropdown (same as `COUNTRY`)

If the argument is missing or ambiguous, stop and ask.

---

## Step 1 — Look up country overhead index

Read **only lines 136–175** of `js/cost/costEngine.js` (the `countryOverheadIndex` block).

- If `COUNTRY` already has an entry → note its value and **skip to Step 2** (no edit needed).
- If missing → determine the appropriate overhead index:
  - Use **0.85–0.95** for countries with streamlined state procurement (e.g. China, Vietnam)
  - Use **1.00** for baseline (Australia-equivalent regulatory environment)
  - Use **1.05–1.15** for moderate permitting complexity (most African, SE Asian, Latin American countries)
  - Use **1.20–1.40** for high regulatory complexity / premium labour markets
  - Use **1.50+** for very high complexity (Japan-tier or Switzerland-tier)
  - For sub-Saharan Africa default to **1.10** unless known otherwise
  - Add a one-line comment explaining the choice

  Add the entry to `countryOverheadIndex` in alphabetical order within the block.

---

## Step 2 — Fetch ANU site data

The ANU RE100 Global Atlas publishes PHES sites via a public GeoServer WFS. Fetch each dataset using `curl`. Do **not** read existing data files — work from scratch.

### ANU GeoServer WFS endpoints

**Greenfield** (new reservoir pairs on virgin land):
```
https://re100.anu.edu.au/geoserver/global_greenfield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_greenfield:2gwh_6h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'
```
Also fetch tier `5gwh_18h` (replace `2gwh_6h`).

**Bluefield** (existing reservoir pairs):
```
https://re100.anu.edu.au/geoserver/global_bluefield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_bluefield:15gwh_18h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'
```
Also fetch tier `2gwh_6h`.

**Brownfield** (one existing + one new reservoir):
```
https://re100.anu.edu.au/geoserver/global_brownfield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_brownfield:15gwh_18h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'
```

Run all 5 curl calls in parallel (background `&` + `wait`), saving to `/tmp/`:
```bash
curl -s --max-time 30 "URL" -o /tmp/hb_gf2.json &
curl -s --max-time 30 "URL" -o /tmp/hb_gf5.json &
curl -s --max-time 30 "URL" -o /tmp/hb_bf15.json &
curl -s --max-time 30 "URL" -o /tmp/hb_bf2.json &
curl -s --max-time 30 "URL" -o /tmp/hb_bro15.json &
wait
```

Check each file. If a fetch returns an error or 0 features, note it and continue (that dataset may simply not exist for the country).

### Inspect the raw feature properties

Before converting, print the first feature's `properties` keys from any non-empty file so you can map field names correctly:
```bash
python3 -c "import json; d=json.load(open('/tmp/hb_gf2.json')); print(list(d['features'][0]['properties'].keys())) if d.get('features') else print('empty')"
```

---

## Step 3 — Convert WFS JSON → JS data files

For each non-empty dataset, write a JS file. Do **not** read existing data files for reference — use the schemas below.

### File naming convention
| Dataset | File path |
|---------|-----------|
| Greenfield | `js/data/anuGreenfield{CountryCamel}.js` |
| Bluefield | `js/data/anuBluefield{CountryCamel}.js` |
| Brownfield | `js/data/anuBrownfield{CountryCamel}.js` |

Where `{CountryCamel}` = PascalCase country name (e.g. `Nigeria`, `SouthKorea`, `SouthAfrica`).

### JS file template

```js
/**
 * ANU RE100 {Type} Atlas — {COUNTRY} PHES Sites
 * Source: re100.anu.edu.au GeoServer ({workspace} workspace)
 * WFS layers: {tiers_fetched}  |  {N} sites
 * {brief geographic note about where sites are located}
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anu{Type}{CountryCamel} = [
  {
    "id": "anu_{prefix}_{iso2}NNN",
    "tier": "2GWh",
    "class": "B",
    "name": "{region} 2GWh {Class}{N} ({Type})",
    "country": "{COUNTRY}",
    "region": "{region from WFS}",
    "lat": 0.0,
    "lng": 0.0,
    "head_m": 0,
    "separation_km": 0.0,
    "volume_gl": 0.0,
    "water_rock_ratio": 0.0,
    "energy_gwh": 2.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 333,
    "storage_mwh": 2000,
    "status": "anu_{type_lower}",
    "configuration": "lake_pair",
    "isdam": false,
    "description": null,
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  ...
];
```

### Field mapping from WFS properties

| JS field | WFS property (typical names) |
|----------|------------------------------|
| `lat` | `latitude`, `lat`, geometry centroid Y |
| `lng` | `longitude`, `lon`, `lng`, geometry centroid X |
| `head_m` | `head`, `head_m`, `head_height` |
| `separation_km` | `separation`, `separation_km`, `dist_km` |
| `volume_gl` | `volume_gl`, `volume`, `vol_gl` |
| `water_rock_ratio` | `wr_ratio`, `water_rock_ratio`, `wrr` |
| `energy_gwh` | `energy_gwh`, `energy`, `storage_gwh` |
| `dam_volume_mm3` | `dam_volume`, `dam_vol_mm3` (null if absent) |
| `reservoir_area_ha` | `area_ha`, `reservoir_area` (null if absent) |
| `energy_cost_usd_mwh` | `cost_mwh`, `lcos`, `energy_cost` (null if absent) |
| `power_cost_usd_kw` | `cost_kw`, `power_cost` (null if absent) |
| `capacity_mw` | `power_mw`, `capacity`, `power` |
| `storage_mwh` | computed as `energy_gwh * 1000` |
| `class` | `class`, `site_class`, `grade` |
| `region` | `state`, `region`, `province`, `admin1` |

If geometry is a Point, use coordinates directly. If Polygon/MultiPolygon, compute the centroid.

### ID scheme
- Greenfield 2GWh: `anu_gf2_{iso2}NNN` (e.g. `anu_gf2_ng001`)
- Greenfield 5GWh: `anu_gf5_{iso2}NNN`
- Bluefield 15GWh: `anu_bf15_{iso2}NNN`
- Bluefield 2GWh: `anu_bf2_{iso2}NNN`
- Brownfield 15GWh: `anu_bro15_{iso2}NNN`

Pad numbers to 3 digits.

### Writing the files

Generate each file using a Python script that reads the `/tmp/hb_*.json` files and writes the JS output — do not try to write the JS manually for large datasets. Example:

```python
import json, math

def centroid(geom):
    coords = geom['coordinates']
    if geom['type'] == 'Point':
        return coords[1], coords[0]
    # Flatten polygon rings
    flat = []
    rings = coords[0] if geom['type'] == 'Polygon' else coords[0][0]
    for pt in rings:
        flat.append(pt)
    lats = [p[1] for p in flat]
    lngs = [p[0] for p in flat]
    return sum(lats)/len(lats), sum(lngs)/len(lngs)

with open('/tmp/hb_gf2.json') as f:
    data = json.load(f)

lines = []
for i, feat in enumerate(data.get('features', []), 1):
    p = feat['properties']
    lat, lng = centroid(feat['geometry'])
    # ... map fields ...
    # ... append formatted JS object ...
    pass

# write to js/data/anuGreenfieldNIGERIA.js
```

Run the script with `python3`. Print the first 3 generated entries to verify correctness before writing.

---

## Step 4 — Wire up in `app.js`

Read **only lines 155–172** of `js/app.js` (the `_mergeAnuDataset` call block).

Add entries for each new file **immediately after the last existing country's block**, maintaining the pattern:
```js
_mergeAnuDataset(HB.Data.anuGreenfieldNigeria,   'ANU Greenfield Nigeria');
_mergeAnuDataset(HB.Data.anuBluefieldNigeria,    'ANU Bluefield Nigeria');
_mergeAnuDataset(HB.Data.anuBrownfieldNigeria,   'ANU Brownfield Nigeria');
```

Only add lines for datasets that actually have sites (skip empty ones).

---

## Step 5 — Add `<script>` tags in `index.html`

Read **only lines 712–735** of `index.html` (the data script tags block).

Add one `<script>` tag per new data file, immediately after the last existing country's script tags, before `hydroAtlasEnrichment.js`:
```html
<script src="js/data/anuGreenfieldNigeria.js?v=1"></script>
<script src="js/data/anuBluefieldNigeria.js?v=1"></script>
<script src="js/data/anuBrownfieldNigeria.js?v=1"></script>
```

Only add tags for files that were actually written.

---

## Step 6 — Add country to filter dropdown

Read **only lines 224–236** of `index.html` (the `filter-country` select block).

Add one `<option>` in alphabetical order:
```html
<option value="Nigeria">Nigeria</option>
```

---

## Step 7 — Commit and push

```bash
git add js/data/anuGreenfield{CountryCamel}.js \
        js/data/anuBluefield{CountryCamel}.js \
        js/data/anuBrownfield{CountryCamel}.js \
        js/cost/costEngine.js \
        js/app.js \
        index.html

git commit -m "feat: add {COUNTRY} PHES sites to atlas

- {N_GF} greenfield sites ({tiers})
- {N_BF} bluefield sites ({tiers})
- {N_BRO} brownfield sites ({tiers})
- countryOverheadIndex: {COUNTRY} = {INDEX}
- Wired in app.js + index.html filter dropdown

https://claude.ai/code/session_014uRcBa7rnez1zSXvsXDf4P"

git push -u origin claude/hydrobattery-atlas-xMAuM
```

---

## Error handling

| Situation | Action |
|-----------|--------|
| WFS returns 0 features for a type | Skip that file; don't create empty array files |
| WFS returns HTTP error or timeout | Retry once with `--max-time 60`; if still fails, note it and skip |
| Country name not found in WFS | Try alternate spellings (e.g. `"South Korea"` vs `"Republic of Korea"`); print available country values with: `curl ... \| python3 -c "import json,sys; d=json.load(sys.stdin); print(set(f['properties'].get('country','') for f in d['features'][:20]))"` |
| `costEngine.js` already has the country | Skip Step 1 edit, proceed |
| Geometry is null | Skip the feature and log a warning |

---

## Token budget notes (for the model)

- **Do not** read existing `js/data/anu*.js` files — they are large and not needed.
- **Do not** read all of `app.js` or `index.html` — use targeted `Read` with `offset`/`limit`.
- The Python conversion script runs in the shell; only the generated JS is written to disk.
- All WFS data stays in `/tmp/` and is never read back into the context window (write-only).
- Total expected token cost for a typical country: **~15k–25k tokens**.
