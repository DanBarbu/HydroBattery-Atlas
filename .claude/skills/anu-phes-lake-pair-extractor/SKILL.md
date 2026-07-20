---
name: anu-phes-lake-pair-extractor
description: Extract pumped-hydro (PHES) lake pairs from the ANU RE100 Bluefield / PHES Atlas — from raw WFS data or a screenshot — with their unique code, geometry (head, separation, volume, dam, reservoir area, perimeters), then compute and allocate CapEx across cost categories, benchmark CapEx $/kWh & $/MWh and LCOS $/kWh, and add the pair into the HydroBattery Atlas app data. Use when the user references the ANU atlas, a PHES lake pair, a Bluefield/mine-void site, or wants a reservoir-pair screenshot turned into an atlas entry with costs.
---

# ANU PHES lake-pair extractor → HydroBattery Atlas

Turn an ANU RE100 Atlas lake pair (a screenshot, or better, its raw WFS record)
into a fully-costed entry in this repo's HydroBattery Atlas app. The pipeline is:
**extract → compute CapEx/LCOS via the existing cost module → add to the data →
validate in the running app → commit.**

Design principle: **map ANU fields into the app's EXISTING cost engine and data
schema — do not invent parallel ones.** The engine is `HB.Cost.engine.anuModel`
and `HB.Cost.scaleUp`; the data lives in `js/data/anuBluefield<Region>.js` and
`js/data/mineVoids.js`.

## References (read the one you need)

- `references/field-schema.md` — the atlas record schema + the ANU-WFS-field →
  atlas-field mapping. **Read first.** Explains the three-layer model (upper
  reservoir, lower reservoir, combined PAIR) and that only the PAIR becomes an
  atlas entry.
- `references/cost-mapping.md` — ANU field → cost category mapping, the CapEx
  category formulas, and the LCOS formula (with the $/MWh→$/kWh conversion).
- `references/wfs-extraction.md` — how to pull exact records from the ANU WFS
  ("Show Raw Data") instead of OCR, with a ready curl command.

## Scripts

- `scripts/anu_cost_model.py` — Python replica of `costEngine.js` + `scaleUpEngine.js`.
  Computes the identical CapEx categories, $/kWh, $/MWh and LCOS the app shows,
  without booting the browser. `--scale-up` adds the six-tier allocation.
- `scripts/add_lake_pair.py` — validate a JSON record and insert it into a
  `js/data/*.js` array (derives `capacity_mw`, `storage_mwh`, description, etc.).

## Workflow

### 1. Extract the pair
Prefer the ANU WFS endpoint over OCR (see `references/wfs-extraction.md`). Pull
the pair by its `identifier` (the unique code on the panel). You get the upper
and lower reservoir features plus the headline PAIR figures. If only a
screenshot exists, read the three layers off it as the fallback.

Assemble one PAIR record in the atlas schema (`references/field-schema.md`),
keyed by the unique code. Decide the target file:
- Bluefield reservoir pair → `js/data/anuBluefield<Region>.js`
  (create a new region file, following an existing one, if the region is new).
- Two mine pits → `js/data/mineVoids.js`.

Perimeter polygons: the WFS geometry carries them; store as GeoJSON rings only
if you want them drawn on the map. They do not affect costs.

### 2. Compute & allocate CapEx + LCOS
Run the cost model on the pair's geometry:

```bash
python3 scripts/anu_cost_model.py \
    --head <head_m> --separation-km <sep_km> --energy-gwh <energy> \
    --storage-hours <hours> --volume-gl <vol> --water-rock-ratio <wr> \
    --country <Australia|Malaysia|Romania|default> --scale-up
```

This returns the three CapEx categories (Reservoirs, Tunnel/Penstock,
Powerhouse), the six-tier allocation (adds Electrical, Civil+Env, EPC), and the
benchmarks the task asks for: **CapEx $/kWh, CapEx $/MWh, and LCOS $/MWh (plus
$/kWh)**. See `references/cost-mapping.md` for what drives each category.

**Cross-check:** compare the computed `lcos.total` against the extracted ANU
`energy_cost` ($/MWh) and computed $/kW against ANU `power_cost`. A >2×
divergence means a units/extraction error — fix inputs before proceeding.

### 3. Add to the atlas data
```bash
python3 scripts/add_lake_pair.py --file js/data/anuBluefield<Region>.js --record pair.json
```
Use `--dry-run` first to review the formatted block. For a brand-new region,
create `js/data/anuBluefield<Region>.js` modelled on `anuBluefieldRomania.js`,
register it in the app (see step 4), and wire it into the search/marker layer
the same way existing region arrays are (grep for `anuBluefieldRomania` to find
every reference: `js/app.js`, `js/map/siteMarkers.js`, search engine, panels).

### 4. Validate in the running app
The app is cache-versioned. Bump the `?v=` query on the changed data file's
`<script>` tag in `index.html` (e.g. `anuBluefieldRomania.js?v=2` → `?v=3`), then
launch and confirm the new pair renders with its cost breakdown:

```bash
python3 -m http.server 11616   # then open http://localhost:11616
```
Check: marker at the right lat/lng, detail panel shows head/separation/volume,
cost breakdown panel shows the three CapEx categories, and the scale-up panel
shows the six tiers. Use the `/run` or `/verify` skill if available.

### 5. Commit
Commit the data file + `index.html` cache bump (and any new region file/wiring)
with a message describing the pair(s) added and the source.

## Notes
- Region cost factors live in `HB.Cost.financials.regionFactors`
  (Australia 1.0× · Malaysia 0.5× · Romania 0.7× · default 0.8×). Add a new
  country there if its factor should differ from `default`.
- Keep `scripts/anu_cost_model.py` in sync if `costEngine.js` / `scaleUpEngine.js`
  defaults change — its whole value is producing the same numbers as the app.
