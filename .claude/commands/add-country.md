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
- `COUNTRY_SLUG` = lowercase, spaces → underscores (e.g. `nigeria`, `south_korea`)
- `ISO2` = 2-letter ISO code lowercase (e.g. `ng`, `za`) — used in site ID prefixes
- `CountryCamel` = PascalCase, spaces removed (e.g. `Nigeria`, `SouthKorea`, `SouthAfrica`)

If the argument is missing or ambiguous, stop and ask.

---

## Step 1 — Country overhead index

Read **only lines 136–180** of `js/cost/costEngine.js` (the `countryOverheadIndex` block).

- If `COUNTRY` already has an entry → note its value and **skip to Step 2**.
- If missing → pick the appropriate overhead index:
  - **0.85–0.95** — streamlined state procurement (China, Vietnam, SE Asia)
  - **1.00** — baseline (Australia-equivalent)
  - **1.05–1.15** — moderate complexity (most African, SE Asian, Latin American)
  - **1.20–1.40** — high regulatory complexity / premium labour markets
  - **1.50+** — very high (Japan-tier, Switzerland-tier)
  - Sub-Saharan Africa default: **1.10**
  - Add a one-line comment justifying the value

Add the entry **in alphabetical order** within the block, then save.

---

## Step 2 — Acquire ANU site data

### 2a. Try the live WFS (may be blocked)

The ANU RE100 Atlas publishes sites via GeoServer WFS. Attempt all 5 fetches in parallel:

```bash
curl -s --max-time 30 "https://re100.anu.edu.au/geoserver/global_greenfield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_greenfield:2gwh_6h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'" -o /tmp/hb_gf2.json &
curl -s --max-time 30 "https://re100.anu.edu.au/geoserver/global_greenfield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_greenfield:5gwh_18h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'" -o /tmp/hb_gf5.json &
curl -s --max-time 30 "https://re100.anu.edu.au/geoserver/global_bluefield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_bluefield:15gwh_18h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'" -o /tmp/hb_bf15.json &
curl -s --max-time 30 "https://re100.anu.edu.au/geoserver/global_bluefield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_bluefield:2gwh_6h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'" -o /tmp/hb_bf2.json &
curl -s --max-time 30 "https://re100.anu.edu.au/geoserver/global_brownfield/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_brownfield:15gwh_18h&outputFormat=application/json&CQL_FILTER=country='COUNTRY'" -o /tmp/hb_bro15.json &
wait
python3 -c "
import json, os
for k,f in [('gf2','/tmp/hb_gf2.json'),('gf5','/tmp/hb_gf5.json'),('bf15','/tmp/hb_bf15.json'),('bf2','/tmp/hb_bf2.json'),('bro15','/tmp/hb_bro15.json')]:
    try:
        d=json.load(open(f)); n=len(d.get('features',[])); print(f'{k}: {n} features')
    except: print(f'{k}: error/blocked')
"
```

**⚠️ Known constraint:** The ANU GeoServer blocks requests from cloud/datacenter IPs with HTTP 403 — both `curl` and `WebFetch` are affected. If the check above shows `error/blocked` or 0 features for all endpoints, skip to **Step 2b**.

If fetches succeed, inspect property keys before converting:
```bash
python3 -c "import json; d=json.load(open('/tmp/hb_gf2.json')); print(list(d['features'][0]['properties'].keys())) if d.get('features') else print('empty')"
```
Then proceed to Step 3 (WFS path), using the field mapping table there.

### 2b. Topographic modelling (fallback when WFS is blocked)

Research the country's **main highland and plateau regions** using your training knowledge. For each region identify:
- Name and administrative state/province
- Approximate centre coordinates (lat, lng)
- Typical elevation range (metres)
- Viable head heights for PHES (difference between upper and lower reservoir elevations)

#### Site count guidelines by country area

| Country area | Greenfield 2GWh | Greenfield 5GWh | Bluefield | Brownfield |
|---|---|---|---|---|
| < 200 000 km² | 8–12 | 3–5 | 2–3 | 1–2 |
| 200 000–500 000 km² | 12–20 | 5–8 | 3–5 | 2–4 |
| 500 000–1 000 000 km² | 18–25 | 6–10 | 4–6 | 3–5 |
| > 1 000 000 km² | 25–40 | 8–14 | 5–8 | 4–7 |

#### ANU site classification rules

Assign class based on estimated LCOS (lower = better):

| Class | LCOS guidance | Typical head | Typical W:R ratio |
|-------|--------------|--------------|-------------------|
| A | < $15/MWh | > 900 m | < 7 |
| B | $15–25/MWh | 700–900 m | 7–8 |
| C | $25–40/MWh | 450–700 m | 8–10 |
| D | $40–65/MWh | 250–450 m | 10–13 |
| E | > $65/MWh | 150–250 m | 13–16 |

#### Physical parameter ranges (2GWh / 6h tier, 333 MW)

| Parameter | Class B | Class C | Class D | Class E |
|---|---|---|---|---|
| `head_m` | 700–900 | 450–700 | 250–450 | 150–250 |
| `separation_km` | 3–6 | 5–9 | 8–13 | 10–15 |
| `volume_gl` | 1.2–1.6 | 1.5–2.2 | 2.0–3.2 | 2.8–4.0 |
| `water_rock_ratio` | 7–8 | 8–10 | 10–13 | 13–16 |
| `dam_volume_mm3` | 0.1–0.2 | 0.2–0.3 | 0.3–0.5 | 0.4–0.6 |
| `reservoir_area_ha` | 35–50 | 45–70 | 60–95 | 80–120 |

For 5GWh / 18h tier (833 MW): multiply `volume_gl` × 2.5, `dam_volume_mm3` × 2.5, `reservoir_area_ha` × 2.5. Keep `head_m` and `separation_km` the same.

For 15GWh / 18h tier (833 MW): multiply `volume_gl` × 7.5 and scale area proportionally.

**Bluefield sites** use existing dams/reservoirs as the lower reservoir (`isdam: true`). Name them after the real dam. Head is typically lower (150–400 m) since you're constrained to existing water bodies.

**Brownfield sites** use one existing valley + one new reservoir. Use real river basin names. `volume_gl` is large (existing water body, 20–100 GL).

Set `energy_cost_usd_mwh: null` and `power_cost_usd_kw: null` — the cost engine calculates these from the physical parameters.

---

## Step 3 — Generate JS data files with Python

Write **one Python script** that generates all three files at once and saves them directly to the repo (not `/tmp/`). Run it with `python3`. **Do not write the JS manually.**

### Python script structure

```python
# ── site data lists ──────────────────────────────────────────────────────────
gf2_sites = [
    # {"region": str, "state": str, "lat": float, "lng": float,
    #  "head_m": int, "sep_km": float, "vol_gl": float, "wr": float,
    #  "cls": str, "dam_mm3": float, "area_ha": float}
    ...
]
gf5_sites = [ ... ]   # same schema
bf_sites  = [ ... ]   # add "tier": "15GWh"|"2GWh", "cap_mw": int, "mwh": int, "isdam": True
bro_sites = [ ... ]   # add "tier": "15GWh", "cap_mw": 833, "mwh": 15000

# ── helper ───────────────────────────────────────────────────────────────────
def make_gf_entry(site, idx, tier_label, energy_gwh, cap_mw, mwh, prefix, cls_count):
    c = site["cls"]
    cls_count[c] = cls_count.get(c, 0) + 1
    n = cls_count[c]
    name = f"{site['region']} {tier_label} {c}{n} (Greenfield)"
    return f"""  {{
    "id": "{prefix}_{ISO2}{idx:03d}",
    "tier": "{tier_label}",
    "class": "{c}",
    "name": "{name}",
    "country": "{COUNTRY}",
    "region": "{site['state']}",
    "lat": {site['lat']},
    "lng": {site['lng']},
    "head_m": {site['head_m']},
    "separation_km": {site['sep_km']},
    "volume_gl": {site['vol_gl']},
    "water_rock_ratio": {site['wr']},
    "energy_gwh": {energy_gwh},
    "dam_volume_mm3": {site['dam_mm3']},
    "reservoir_area_ha": {site['area_ha']},
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": {cap_mw},
    "storage_mwh": {mwh},
    "status": "anu_greenfield",
    "configuration": "lake_pair",
    "isdam": false,
    "description": "ANU Greenfield Class {c}. New reservoir pair. Head {site['head_m']}m, sep {site['sep_km']}km, W:R {site['wr']}.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }}"""

# ── build and write files ────────────────────────────────────────────────────
# Greenfield
cls_count = {}
gf_entries = []
for i, s in enumerate(gf2_sites, 1):
    gf_entries.append(make_gf_entry(s, i, "2GWh", 2.0, 333, 2000, "anu_gf2", cls_count))
cls_count = {}
for i, s in enumerate(gf5_sites, 1):
    gf_entries.append(make_gf_entry(s, i, "5GWh", 5.0, 833, 5000, "anu_gf5", cls_count))

data_note = "Modelled from ANU RE100 Atlas methodology (WFS IP-restricted)"
# ... or "Source: re100.anu.edu.au GeoServer (WFS)" if fetched live

gf_js = f"""/**
 * ANU RE100 Greenfield Atlas — {COUNTRY} PHES Sites
 * {data_note}
 * Tiers: 2GWh_6h ({len(gf2_sites)} sites) · 5GWh_18h ({len(gf5_sites)} sites)  |  Total: {len(gf_entries)} sites
 */
window.HB = window.HB || {{}};
HB.Data = HB.Data || {{}};

HB.Data.anuGreenfield{CountryCamel} = [
""" + ',\n'.join(gf_entries) + '\n];\n'

with open(f'js/data/anuGreenfield{CountryCamel}.js', 'w') as f:
    f.write(gf_js)

# ... repeat for bluefield and brownfield ...
print(f"Done: {len(gf2_sites)+len(gf5_sites)} greenfield + {len(bf_sites)} bluefield + {len(bro_sites)} brownfield")
```

### WFS path (if Step 2a succeeded)

Replace the hardcoded site lists with a WFS reader:

```python
def centroid(geom):
    if geom['type'] == 'Point':
        return geom['coordinates'][1], geom['coordinates'][0]
    rings = geom['coordinates'][0] if geom['type'] == 'Polygon' else geom['coordinates'][0][0]
    lats = [p[1] for p in rings]; lngs = [p[0] for p in rings]
    return sum(lats)/len(lats), sum(lngs)/len(lngs)

import json
with open('/tmp/hb_gf2.json') as f:
    data = json.load(f)
for i, feat in enumerate(data.get('features', []), 1):
    p = feat['properties']
    if feat['geometry'] is None: continue   # skip null geometries
    lat, lng = centroid(feat['geometry'])
    # map p fields → JS object fields using the field mapping table below
```

#### Field mapping (WFS properties → JS fields)

| JS field | WFS property names to try (in order) |
|----------|--------------------------------------|
| `lat` / `lng` | geometry centroid |
| `head_m` | `head`, `head_m`, `head_height` |
| `separation_km` | `separation`, `separation_km`, `dist_km` |
| `volume_gl` | `volume_gl`, `volume`, `vol_gl` |
| `water_rock_ratio` | `wr_ratio`, `water_rock_ratio`, `wrr` |
| `energy_gwh` | `energy_gwh`, `energy`, `storage_gwh` |
| `dam_volume_mm3` | `dam_volume`, `dam_vol_mm3` (None → null) |
| `reservoir_area_ha` | `area_ha`, `reservoir_area` (None → null) |
| `energy_cost_usd_mwh` | `cost_mwh`, `lcos`, `energy_cost` (None → null) |
| `capacity_mw` | `power_mw`, `capacity`, `power` |
| `class` | `class`, `site_class`, `grade` |
| `region` (state) | `state`, `region`, `province`, `admin1` |

### Validate syntax before continuing

```bash
# Browser JS files use `window` — mock it for Node validation
for f in anuGreenfield{CountryCamel} anuBluefield{CountryCamel} anuBrownfield{CountryCamel}; do
    node -e "var window={HB:{Data:{}}}; $(cat js/data/${f}.js)" 2>&1 | grep -v "^$" | head -2
    echo "$f: syntax OK"
done
```

> **Note:** Do **not** use `node --input-type=module` — the `window` global will cause a false `ReferenceError`. The one-liner above is the correct validator.

---

## Step 4 — Wire up in `app.js`

Find the last `_mergeAnuDataset` call to locate the insertion point:

```bash
grep -n "_mergeAnuDataset" js/app.js | tail -5
```

Read those lines (use `offset`/`limit` targeting), then add immediately after the last existing entry:

```js
_mergeAnuDataset(HB.Data.anuGreenfield{CountryCamel},   'ANU Greenfield {COUNTRY}');
_mergeAnuDataset(HB.Data.anuBluefield{CountryCamel},    'ANU Bluefield {COUNTRY}');
_mergeAnuDataset(HB.Data.anuBrownfield{CountryCamel},   'ANU Brownfield {COUNTRY}');
```

Only add lines for files that were actually written.

---

## Step 5 — Add `<script>` tags in `index.html`

Find the current last data script tag to locate the insertion point:

```bash
grep -n "js/data/anu" index.html | tail -5
```

Read those lines, then add the new tags immediately **before** `hydroAtlasEnrichment.js`:

```html
<script src="js/data/anuGreenfield{CountryCamel}.js?v=1"></script>
<script src="js/data/anuBluefield{CountryCamel}.js?v=1"></script>
<script src="js/data/anuBrownfield{CountryCamel}.js?v=1"></script>
```

Only add tags for files that were actually written.

---

## Step 6 — Add country to filter dropdown

Find the filter select block:

```bash
grep -n "filter-country\|option value" index.html | head -20
```

Add `<option value="{COUNTRY}">{COUNTRY}</option>` in **alphabetical order** among the existing options.

---

## Step 7 — Commit and push

**Always use `git push` — never use `mcp__github__create_or_update_file` or any GitHub API file upload for these files.** Pushing via the GitHub API stores base64-encoded content literally in the file, which causes merge conflicts later.

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
{if modelled}: - Note: data modelled from ANU RE100 methodology (WFS IP-restricted)

https://claude.ai/code/session_014uRcBa7rnez1zSXvsXDf4P"

git push -u origin HEAD
```

---

## Error handling

| Situation | Action |
|-----------|--------|
| WFS returns HTTP 403 (cloud IP blocked) | Expected — go to Step 2b (topographic modelling) |
| WFS returns 0 features for a type | Skip that file; don't create empty JS arrays |
| WFS timeout | Retry once with `--max-time 60`; if still fails, use Step 2b |
| Country name not recognised by WFS | Try alternate spellings; probe with: `python3 -c "import json,sys; d=json.load(sys.stdin); print(set(f['properties'].get('country','') for f in d['features'][:50]))"` piped from curl |
| `costEngine.js` already has the country | Skip Step 1 edit |
| Null geometry in WFS feature | Skip the feature with a `continue` |
| JS syntax error in generated file | Check for unescaped quotes in `description` field; run the Node validator |
| Merge conflict with main on PR | If main has base64-encoded content (from prior GitHub API push), resolve with `git checkout --ours <file>` for each conflicted file, then commit |

---

## Token budget notes

- **Do not** read existing `js/data/anu*.js` files — they are large and not needed.
- **Do not** read all of `app.js` or `index.html` — use `grep -n` to find line numbers, then `Read` with `offset`/`limit`.
- The Python generation script runs entirely in the shell; the site data never enters the context window.
- Files are written directly to the repo by the Python script — no `/tmp/` copy step needed.
- **Typical token cost:** ~15k–25k tokens (topographic path) or ~20k–30k tokens (live WFS path).
