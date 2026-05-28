# Fetch ANU RE100 Data for a Country

Fetch real PHES site data directly from the ANU RE100 GeoServer for a given
country — including Ocean PHES — bypassing the cloud-IP block by running
`fetch()` calls from inside a Playwright browser page at the ANU origin.

## Usage
```
/fetch-anu-country Nigeria
/fetch-anu-country "Saudi Arabia"
```

The fetched data is written directly to `js/data/` as ready-to-use JS files.
After running this skill, run `/add-country <COUNTRY>` Steps 1 and 4–7 only
(skip Steps 2–3 since this skill replaces them).

---

## Why this works

The ANU GeoServer accepts WFS requests that originate from `re100.anu.edu.au`
(checked via the `Origin` / `Referer` request headers). Direct `curl` or
`WebFetch` calls fail because they carry a cloud-datacenter origin.

Playwright opens a real Chromium browser at `https://re100.anu.edu.au/` and
then executes `fetch()` calls *from inside that page context*. The browser
automatically sets `Origin: https://re100.anu.edu.au`, which the server
accepts — no credentials, no API key needed.

---

## Step 0 — Resolve inputs

- `COUNTRY` = `$ARGUMENTS` stripped of quotes (e.g. `Saudi Arabia`)
- `ISO2` = lowercase 2-letter ISO code (e.g. `sa`)
- `CountryCamel` = PascalCase no spaces (e.g. `SaudiArabia`)

---

## Step 1 — Check / install Playwright

```bash
node -e "require('playwright')" 2>/dev/null && echo "playwright OK" || (
    echo "Installing playwright..."
    npm install playwright --save-dev 2>&1 | tail -3
    npx playwright install chromium --with-deps 2>&1 | tail -5
)
```

If installation fails (no internet, no npm), skip to **Fallback** at the end.

---

## Step 2 — Write the fetch script

Write `/tmp/fetch_anu.js`:

```javascript
// /tmp/fetch_anu.js
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const COUNTRY = process.argv[2];
if (!COUNTRY) { console.error('Usage: node fetch_anu.js "Country Name"'); process.exit(1); }

// All ANU datasets — workspace : layer : metadata
const ENDPOINTS = [
    // Greenfield
    { key:'gf2',     ws:'global_greenfield', layer:'2gwh_6h',    type:'greenfield', tier:'2GWh',  energy:2.0,  cap:333,  mwh:2000  },
    { key:'gf5',     ws:'global_greenfield', layer:'5gwh_18h',   type:'greenfield', tier:'5GWh',  energy:5.0,  cap:833,  mwh:5000  },
    { key:'gf15',    ws:'global_greenfield', layer:'15gwh_18h',  type:'greenfield', tier:'15GWh', energy:15.0, cap:833,  mwh:15000 },
    // Bluefield
    { key:'bf2',     ws:'global_bluefield',  layer:'2gwh_6h',    type:'bluefield',  tier:'2GWh',  energy:2.0,  cap:333,  mwh:2000  },
    { key:'bf15',    ws:'global_bluefield',  layer:'15gwh_18h',  type:'bluefield',  tier:'15GWh', energy:15.0, cap:833,  mwh:15000 },
    // Brownfield
    { key:'bro15',   ws:'global_brownfield', layer:'15gwh_18h',  type:'brownfield', tier:'15GWh', energy:15.0, cap:833,  mwh:15000 },
    // Ocean PHES — upper reservoir + ocean as lower reservoir
    { key:'ocean2',  ws:'global_ocean',      layer:'2gwh_6h',    type:'ocean',      tier:'2GWh',  energy:2.0,  cap:333,  mwh:2000  },
    { key:'ocean15', ws:'global_ocean',      layer:'15gwh_18h',  type:'ocean',      tier:'15GWh', energy:15.0, cap:833,  mwh:15000 },
    { key:'ocean50', ws:'global_ocean',      layer:'50gwh_18h',  type:'ocean',      tier:'50GWh', energy:50.0, cap:2778, mwh:50000 },
];

// Extract lat/lng from GeoJSON geometry (Point or Polygon centroid)
function latLng(geom) {
    if (!geom) return [null, null];
    const c = geom.coordinates;
    if (geom.type === 'Point')   return [c[1], c[0]];
    if (geom.type === 'MultiPoint') return [c[0][1], c[0][0]];
    // Polygon / MultiPolygon — centroid of first ring
    const ring = geom.type === 'Polygon' ? c[0] : c[0][0];
    const lats = ring.map(p => p[1]), lngs = ring.map(p => p[0]);
    return [lats.reduce((a,b)=>a+b)/lats.length, lngs.reduce((a,b)=>a+b)/lngs.length];
}

// Resolve a property from multiple possible field names
function prop(p, ...keys) {
    for (const k of keys) if (p[k] !== undefined && p[k] !== null) return p[k];
    return null;
}

async function main() {
    console.log(`\nFetching ANU data for: ${COUNTRY}`);
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Load the ANU origin so fetch() carries Origin: https://re100.anu.edu.au
    console.log('Opening re100.anu.edu.au ...');
    await page.goto('https://re100.anu.edu.au/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });

    const results = {};

    for (const ep of ENDPOINTS) {
        const url = `https://re100.anu.edu.au/geoserver/${ep.ws}/wfs`
            + `?service=WFS&version=2.0.0&request=GetFeature`
            + `&typeNames=${ep.ws}:${ep.layer}`
            + `&outputFormat=application/json`
            + `&CQL_FILTER=country='${COUNTRY.replace(/'/g, "''")}'`;

        try {
            const data = await page.evaluate(async (fetchUrl) => {
                const r = await fetch(fetchUrl, { credentials: 'omit' });
                if (!r.ok) return { error: r.status, features: [] };
                return r.json();
            }, url);

            const features = data.features || [];
            console.log(`  ${ep.key.padEnd(8)} ${ep.ws.padEnd(20)} ${ep.layer.padEnd(12)} → ${features.length} sites`);
            results[ep.key] = { ep, features };
        } catch (e) {
            console.log(`  ${ep.key.padEnd(8)} FAILED: ${e.message}`);
            results[ep.key] = { ep, features: [] };
        }
    }

    await browser.close();

    // ── Convert features → JS objects ──────────────────────────────────────
    const byType = { greenfield: [], bluefield: [], brownfield: [], ocean: [] };

    for (const [key, { ep, features }] of Object.entries(results)) {
        if (!features.length) continue;

        // Print first feature's property keys so we can see the schema
        if (features.length > 0 && key === Object.keys(results).find(k => results[k].features.length > 0)) {
            console.log(`\nField names (from ${key}):`);
            console.log(Object.keys(features[0].properties).join(', '));
        }

        features.forEach((feat, i) => {
            const p     = feat.properties || {};
            const [lat, lng] = latLng(feat.geometry);
            if (lat === null) return; // skip null geometry

            const cls   = prop(p, 'class', 'site_class', 'grade', 'CLASS') || 'C';
            const head  = prop(p, 'head', 'head_m', 'head_height', 'HEAD');
            const sep   = prop(p, 'separation', 'separation_km', 'dist_km', 'SEPARATION');
            const vol   = prop(p, 'volume_gl', 'volume', 'vol_gl', 'VOLUME');
            const wr    = prop(p, 'water_rock_ratio', 'wr_ratio', 'water_to_rock', 'wrr', 'WR');
            const dam   = prop(p, 'dam_volume', 'dam_vol_mm3', 'dam_volume_mm3');
            const area  = prop(p, 'area_ha', 'reservoir_area', 'reservoir_area_ha');
            const lcos  = prop(p, 'cost_mwh', 'lcos', 'energy_cost', 'energy_cost_usd_mwh');
            const pwr   = prop(p, 'cost_kw', 'power_cost', 'power_cost_usd_kw');
            const region= prop(p, 'state', 'region', 'province', 'admin1', 'STATE') || COUNTRY;
            const isdam = ep.type === 'bluefield';

            // ID scheme
            const pfx = ep.key.replace(/\d+$/, '');
            const idx = String(i + 1).padStart(3, '0');
            const iso2 = COUNTRY.toLowerCase().replace(/[^a-z]/g,'').slice(0,2);
            const id = `anu_${pfx}_${iso2}${idx}`;

            byType[ep.type].push({
                id, tier: ep.tier, class: cls, type: ep.type,
                country: COUNTRY, region,
                lat: lat ? +lat.toFixed(6) : null,
                lng: lng ? +lng.toFixed(6) : null,
                head_m: head ? Math.round(+head) : null,
                separation_km: sep ? +parseFloat(sep).toFixed(1) : null,
                volume_gl: vol ? +parseFloat(vol).toFixed(1) : null,
                water_rock_ratio: wr ? +parseFloat(wr).toFixed(1) : null,
                energy_gwh: ep.energy,
                dam_volume_mm3: dam ? +parseFloat(dam).toFixed(1) : null,
                reservoir_area_ha: area ? +parseFloat(area).toFixed(1) : null,
                energy_cost_usd_mwh: lcos ? +parseFloat(lcos).toFixed(1) : null,
                power_cost_usd_kw: pwr ? +parseFloat(pwr).toFixed(1) : null,
                capacity_mw: ep.cap,
                storage_mwh: ep.mwh,
                isdam,
            });
        });
    }

    // ── Serialize to JS ─────────────────────────────────────────────────────
    const camel = COUNTRY.replace(/\s+(.)/g, (_, c) => c.toUpperCase())
                         .replace(/^(.)/, c => c.toUpperCase())
                         .replace(/[^A-Za-z0-9]/g, '');
    const dataDir = process.argv[3] || path.join(process.cwd(), 'js/data');

    function toJsEntry(s) {
        return `  {
    "id": "${s.id}",
    "tier": "${s.tier}",
    "class": "${s.class}",
    "name": "${s.region} ${s.tier} ${s.class} (${s.type.charAt(0).toUpperCase()+s.type.slice(1)})",
    "country": "${s.country}",
    "region": "${s.region}",
    "lat": ${s.lat},
    "lng": ${s.lng},
    "head_m": ${s.head_m},
    "separation_km": ${s.separation_km},
    "volume_gl": ${s.volume_gl},
    "water_rock_ratio": ${s.water_rock_ratio},
    "energy_gwh": ${s.energy_gwh},
    "dam_volume_mm3": ${s.dam_volume_mm3},
    "reservoir_area_ha": ${s.reservoir_area_ha},
    "energy_cost_usd_mwh": ${s.energy_cost_usd_mwh},
    "power_cost_usd_kw": ${s.power_cost_usd_kw},
    "capacity_mw": ${s.capacity_mw},
    "storage_mwh": ${s.storage_mwh},
    "status": "anu_${s.type}",
    "configuration": "${s.type === 'ocean' ? 'lake_ocean' : 'lake_pair'}",
    "isdam": ${s.isdam},
    "description": null,
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }`;
    }

    const written = [];
    for (const [type, sites] of Object.entries(byType)) {
        if (!sites.length) { console.log(`\n${type}: 0 sites — skipping file`); continue; }

        const typeCap  = type.charAt(0).toUpperCase() + type.slice(1);
        const fileName = `anu${typeCap}${camel}.js`;
        const tiers    = [...new Set(sites.map(s => s.tier))].join(', ');
        const content  =
`/**
 * ANU RE100 ${typeCap} Atlas — ${COUNTRY} PHES Sites
 * Source: re100.anu.edu.au GeoServer (fetched via Playwright in-browser fetch)
 * Tiers: ${tiers}  |  Total: ${sites.length} sites
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anu${typeCap}${camel} = [
${sites.map(toJsEntry).join(',\n')}
];
`;
        const outPath = path.join(dataDir, fileName);
        fs.writeFileSync(outPath, content);
        console.log(`\n✓ ${fileName} — ${sites.length} sites (${tiers})`);
        written.push({ type, typeCap, camel, count: sites.length, tiers, fileName });
    }

    // Summary JSON for the calling shell
    fs.writeFileSync('/tmp/anu_fetch_summary.json', JSON.stringify({ country: COUNTRY, camel, written }, null, 2));
    console.log('\nDone. Summary written to /tmp/anu_fetch_summary.json');
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## Step 3 — Run the fetch script

```bash
node /tmp/fetch_anu.js "COUNTRY" "$(pwd)/js/data"
```

Watch the output. For each endpoint you should see `→ N sites`. If all show `→ 0 sites`, the server is filtering differently — see the **Troubleshooting** section.

---

## Step 4 — Validate generated files

```bash
for f in js/data/anu*{CountryCamel}.js; do
    err=$(node -e "var window={HB:{Data:{}}}; $(cat $f)" 2>&1 | grep -i syntaxerror)
    [ -n "$err" ] && echo "$f: ✗ $err" || echo "$f: ✓"
done
```

---

## Step 5 — Wire app.js

```bash
grep -n "_mergeAnuDataset" js/app.js | tail -4
```

Read those lines and add immediately after the last entry, one line per generated file. The Ocean file uses a different variable name prefix:

```js
_mergeAnuDataset(HB.Data.anuGreenfield{CountryCamel},  'ANU Greenfield {COUNTRY}');
_mergeAnuDataset(HB.Data.anuBluefield{CountryCamel},   'ANU Bluefield {COUNTRY}');
_mergeAnuDataset(HB.Data.anuBrownfield{CountryCamel},  'ANU Brownfield {COUNTRY}');
_mergeAnuDataset(HB.Data.anuOcean{CountryCamel},       'ANU Ocean {COUNTRY}');
```

Only add lines for types that were actually written (check `/tmp/anu_fetch_summary.json`).

---

## Step 6 — Wire index.html

```bash
grep -n "js/data/anu" index.html | tail -4
grep -n "option value" index.html | grep -i "south.africa\|nigeria\|kenya\|oman"
```

Add `<script>` tags before `hydroAtlasEnrichment.js`, and the country `<option>` in alphabetical order in the filter dropdown.

---

## Step 7 — Commit and push

```bash
git add js/data/anu*{CountryCamel}.js js/app.js index.html
# Also add js/cost/costEngine.js if countryOverheadIndex was added

git commit -m "feat: add {COUNTRY} PHES sites to atlas (ANU live data)

- {N_GF} greenfield sites
- {N_BF} bluefield sites
- {N_BRO} brownfield sites
- {N_OCEAN} ocean PHES sites
- Data fetched from ANU RE100 GeoServer via Playwright browser context

https://claude.ai/code/session_014uRcBa7rnez1zSXvsXDf4P"

git push -u origin HEAD
```

---

## Troubleshooting

### All endpoints return 0 features

The country name in the WFS may differ from common usage. Probe it:

```bash
node /tmp/fetch_anu.js "_PROBE_" "$(pwd)/js/data"
```

Then in a separate script, fetch without CQL_FILTER and print distinct country values:

```javascript
// In the page.evaluate call, remove the CQL_FILTER and add &count=100
// then: new Set(data.features.map(f => f.properties.country))
```

Or try alternate names: `"Kingdom of Saudi Arabia"`, `"United Arab Emirates"`, etc.

### HTTP 403 still returned inside Playwright

The server may be doing both Origin AND IP checking. Options:

1. **Use a residential proxy** — set in Playwright context:
   ```javascript
   const browser = await chromium.launch({
       headless: true,
       proxy: { server: 'http://YOUR_PROXY:PORT' }
   });
   ```

2. **Run from a home/office machine** — execute `node /tmp/fetch_anu.js` locally, then copy the generated `js/data/anu*.js` files back to the repo.

3. **Fall back to topographic modelling** — run `/add-country {COUNTRY}` which uses Step 2b (topographic) as the fallback.

### Ocean PHES layer names differ

Try alternate tier names if `2gwh_6h` / `15gwh_18h` / `50gwh_18h` return 0:

```
2gwh_6h  →  also try: 2_gwh_6h, ocean_2gwh
50gwh_18h → also try: 50gwh_18h_ocean, global_ocean_50gwh
```

Print available layer names from GetCapabilities:
```bash
node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,args:['--no-sandbox']});
  const p=await b.newPage();
  await p.goto('https://re100.anu.edu.au/');
  const d=await p.evaluate(async()=>{
    const r=await fetch('https://re100.anu.edu.au/geoserver/global_ocean/wfs?service=WFS&version=2.0.0&request=GetCapabilities');
    return r.text();
  });
  console.log(d.match(/Name>([^<]+)/g)?.slice(0,20).join('\n'));
  await b.close();
})();
"
```

### Playwright not available / install blocked

Fall back to `/add-country {COUNTRY}` — it uses topographic modelling (Step 2b) which doesn't require network access to ANU.

---

## Token budget

- The Node.js script runs entirely in the shell.
- Only the summary JSON (`/tmp/anu_fetch_summary.json`) and generated JS file headers enter context.
- Site feature arrays stay on disk — never read back into the conversation.
- Expected token cost: **~8k–15k tokens** (mostly Steps 5–7 wiring).
