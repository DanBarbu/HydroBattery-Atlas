# Pulling ANU raw data (skip OCR where you can)

The ANU RE100 Bluefield atlas panels have a **"Show Raw Data"** button — the
atlas serves structured, exact records behind it via a WFS (Web Feature Service)
GeoServer endpoint. Always prefer this to vision-parsing a screenshot: it gives
exact, batchable numbers and reservoir polygons directly.

## Endpoint

```
https://re100.anu.edu.au/geoserver/global_bluefield/wfs
```

Layers are named by tier: `2gwh_6h`, `5gwh_18h`, `15gwh_18h`, `50gwh_50h`,
`150gwh_168h`.

## Example: all Romania 2 GWh pairs (≤10 km separation), as GeoJSON

```bash
curl -s --max-time 60 \
  "https://re100.anu.edu.au/geoserver/global_bluefield/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=global_bluefield:2gwh_6h&outputFormat=application/json&CQL_FILTER=country='Romania'&maxFeatures=500&propertyName=identifier,isupper,class,head,separation,volume,water_rock_ratio,energy,dam_volume,reservoir_area,country,energy_cost,power_cost,isdam"
```

Filter to a single pair by `identifier` (the code shown on the panel), e.g.
`CQL_FILTER=identifier=453965`. Each pair returns two features (`isupper=true`
upper reservoir, `isupper=false` lower); the panel's headline PAIR figures
(head, separation, energy, class) are the same on both.

## Screenshot fallback

When the WFS is unreachable or you only have an image (e.g. the perimeter
polygons aren't in the raw fields), read the three layers off the screenshot:

- **Upper reservoir** — elevation, area (ha), volume (GL).
- **Lower reservoir** — elevation, area (ha), volume (GL), dam height × length.
- **Combined PAIR** — class, head (m), separation (km), slope (%), energy (GWh),
  storage hours. This is the record that maps to an atlas entry.

Enter those into the atlas schema (`field-schema.md`) and compute costs with
`scripts/anu_cost_model.py`. Trace reservoir perimeters into GeoJSON rings only
if you need them on the map — they don't affect the cost model.

> Cross-repo note: the original chat referenced a sibling repo/dataset
> (`romania_mine_phes_sites.json`). In THIS repo the equivalent datasets are the
> `js/data/anuBluefield<Region>.js` arrays and `js/data/mineVoids.js`. Write
> extracted pairs there.
