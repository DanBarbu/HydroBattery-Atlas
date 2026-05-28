# /audit-atlas — ANU Coverage Audit for HydroBattery Atlas

Run a completeness audit to verify all expected ANU PHES datasets are present and populated for every country in the atlas.

## Usage

```
/audit-atlas
/audit-atlas --fix        # also populate empty files using /add-country
/audit-atlas --json       # output JSON for scripting
```

## What it checks

For each registered country the audit verifies:
- **Greenfield** data file exists and has > 0 sites
- **Bluefield** data file exists and has > 0 sites
- **Brownfield** data file exists and has > 0 sites
- **Ocean** data file exists for coastal countries with ocean-PHES potential

Coastal countries with expected Ocean PHES:
`Malaysia, Indonesia, Philippines, South Korea, Oman, Saudi Arabia, UAE`

## Steps

### Step 1 — Run the audit script

```bash
node scripts/audit-atlas.js
```

The script reads all `js/data/anu*.js` files and produces a per-country table with:
- File name
- Site count (✓ N sites / ⚠ EMPTY / ✗ MISSING)
- Summary totals

### Step 2 — Interpret results

| Status    | Meaning                                             | Action                        |
|-----------|-----------------------------------------------------|-------------------------------|
| ✓ N sites | File present and populated                          | None                          |
| ⚠ EMPTY   | File exists but has 0 sites (placeholder from init) | Run `/add-country <name>`     |
| ✗ MISSING | File not found at all                               | Run `/add-country <name>`     |

### Step 3 — Fix empty/missing files

For any country with EMPTY or MISSING files run:
```
/add-country <CountryName>
```
That skill generates all three standard types (Greenfield/Bluefield/Brownfield) plus Ocean if the country is coastal.

For Ocean-only gaps on an existing country, generate just the ocean file:

```python
# Write js/data/anuOcean{Country}.js manually
# Use configuration: "lake_ocean", status: "anu_ocean"
# Validate: node -e "var window={HB:{Data:{}}}; var HB=window.HB; $(cat js/data/anuOcean{Country}.js)"
```

Then register it in `app.js` and `index.html`:

```bash
# Find insertion points
grep -n "_mergeAnuDataset.*{Country}" js/app.js | tail -3
grep -n "anu.*{Country}" index.html | tail -3
```

Add after the last Brownfield line for that country:
```javascript
// app.js
_mergeAnuDataset(HB.Data.anuOcean{Country}, 'ANU Ocean {Country}');
```
```html
<!-- index.html -->
<script src="js/data/anuOcean{Country}.js?v=1"></script>
```

### Step 4 — Re-run audit to confirm

```bash
node scripts/audit-atlas.js
```

All countries should show ✓ for all expected types.

### Step 5 — Commit and push

```bash
git add js/data/ js/app.js index.html scripts/audit-atlas.js
git commit -m "fix: populate missing ANU datasets — audit clean"
git push -u origin claude/hydrobattery-atlas-xMAuM
```

## Remote audit (requires Playwright)

To compare local counts against live ANU WFS counts, use the `/fetch-anu-country` skill which fetches real data via Playwright. The audit script only validates what's locally present.

## Adding new countries to the audit

Edit `scripts/audit-atlas.js` and add the country to `ATLAS_COUNTRIES`:

```javascript
const ATLAS_COUNTRIES = {
  ...
  'New Country': { coastal: true, oceanLikely: true },
};
```

Then register the country files in `app.js` and `index.html` using `/add-country`.
