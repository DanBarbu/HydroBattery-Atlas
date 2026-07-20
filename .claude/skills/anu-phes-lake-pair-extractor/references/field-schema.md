# Field schema & ANU → Atlas mapping

The atlas stores **one record per lake pair**. A single ANU screenshot is three
layers of the same pair (upper reservoir, lower reservoir, combined PAIR); only
the **PAIR record** becomes an atlas entry. The two reservoir layers supply the
geometry (volume, area, dam) that feeds the cost categories.

## 0. Normalized extraction JSON (intermediate, before the atlas record)

Extract all three layers of a pair into ONE object keyed by `pair_id` (the ANU
`identifier`), then map it to the atlas record in §1/§2. This keeps the "one pair,
three layers" structure explicit and gives perimeters a home:

```json
{
  "pair_id": "453965",
  "class": "E", "head_m": 558, "separation_km": 4.6,
  "energy_gwh": 2, "storage_hours": 6, "slope_pct": 12.1,
  "anu_energy_cost_usd_mwh": 77.9, "anu_power_cost_usd_kw": 1033.0,
  "upper":  { "elevation_m": null, "area_ha": 36.1, "volume_gl": 1.7 },
  "lower":  { "elevation_m": null, "area_ha": null, "volume_gl": null,
              "dam_height_m": null, "dam_length_m": null, "isdam": false },
  "perimeters": { "upper": [[lng,lat], …], "lower": [[lng,lat], …] },
  "wfs_fid": "2gwh_6h.453965", "country": "Romania"
}
```

`pair_id` is canonical; `perimeters` are optional GeoJSON rings (map only, no cost
effect). The PAIR-level fields become the atlas record; `upper`/`lower` supply the
geometry that drives the cost categories.

## 1. Atlas lake-pair record (Bluefield)

Target files: `js/data/anuBluefield<Region>.js` (e.g. `anuBluefieldRomania.js`,
`anuBluefieldMalaysia.js`). Each is a `HB.Data.anuBluefield<Region> = [ … ]`
array of objects with this exact shape:

```js
{
  "id": "ro-bf-2gwh_6h-453965",   // "<cc>-bf-<tier>-<numeric_code>", lowercase
  "tier": "2GWh",                  // "2GWh" | "5GWh" | "15GWh" | "existing_proposed"
  "class": "E",                    // ANU cost class A–E (A = cheapest); null if N/A
  "name": "Parang / Lotru Pair 453965 (2GWh)",
  "country": "Romania",
  "region": "Parang / Lotru",      // human label / valley name
  "lat": 45.7157,                  // PAIR centroid (upper reservoir if unsure)
  "lng": 23.8735,
  "head_m": 558,                   // ANU: head
  "separation_km": 4.6,            // ANU: separation
  "volume_gl": 1.7,                // ANU: volume (upper reservoir usable)
  "water_rock_ratio": 1.9,         // ANU: water_rock_ratio
  "energy_gwh": 2,                 // ANU: energy — defines the tier
  "dam_volume_mm3": 0.9,           // ANU: dam_volume (Mm3 == GL)
  "reservoir_area_ha": 36.1,       // ANU: reservoir_area
  "energy_cost_usd_mwh": 77.9,     // ANU: energy_cost  (this IS ANU LCOS $/MWh)
  "power_cost_usd_kw": 1033.0,     // ANU: power_cost   ($/kW)
  "capacity_mw": 333,             // energy_gwh*1000 / storage_hours
  "storage_mwh": 2000,            // energy_gwh * 1000
  "status": "anu_bluefield",       // see status vocab below
  "configuration": "lake_pair",
  "description": "ANU Bluefield Class E 2GWh/6h. Head 558m, separation 4.6km. …",
  "source_url": "https://re100.eng.anu.edu.au/global/",
  "isdam": false,                  // ANU: isdam (lower reservoir needs a dam?)
  "wfs_fid": "2gwh_6h.453965"      // ANU WFS feature id — provenance
}
```

Storage hours per tier (ANU convention, sets `capacity_mw`):
`2GWh → 6h`, `5GWh → 18h`, `15GWh → 18h`, `50GWh → 50h`, `150GWh → 168h`.
So `capacity_mw = round(energy_gwh * 1000 / storage_hours)`.

`status` vocab: `anu_bluefield` (extracted from atlas), `proposed`,
`operational`, `under_construction`, `potential`.

## 2. Atlas mine-void record

Target file: `js/data/mineVoids.js` (`HB.Data.mineVoids` array). Use this shape
when the pair is two mine pits rather than a Bluefield reservoir pair:

```js
{
  id, name, country, region, lat, lng,
  status, mine_type, commodity,
  upper_pit_elevation_m, lower_pit_elevation_m, head_m,
  upper_pit_volume_m3, lower_pit_volume_m3, distance_between_pits_m,
  capacity_mw, storage_mwh, estimated_cost_musd,
  description, source_url, developer
}
```

`head_m = upper_pit_elevation_m − lower_pit_elevation_m`;
`distance_between_pits_m = separation_km * 1000`.

## 3. ANU WFS field → atlas field (authoritative source, prefer over OCR)

The ANU atlas serves structured data behind its "Show Raw Data" button via a
WFS endpoint. Pull that instead of vision-parsing screenshots (see
`wfs-extraction.md`). Field-by-field:

| ANU WFS property | Atlas field           | Notes                                  |
|------------------|-----------------------|----------------------------------------|
| `identifier`     | numeric part of `id` + `wfs_fid` | unique pair code            |
| `class`          | `class`               | A–E cost class                         |
| `head`           | `head_m`              | metres                                 |
| `separation`     | `separation_km`       | km                                     |
| `volume`         | `volume_gl`           | GL (= Mm3)                             |
| `water_rock_ratio`| `water_rock_ratio`   | dimensionless                          |
| `energy`         | `energy_gwh`          | GWh — pick the tier                    |
| `dam_volume`     | `dam_volume_mm3`      | Mm3 (= GL)                            |
| `reservoir_area` | `reservoir_area_ha`   | hectares                               |
| `energy_cost`    | `energy_cost_usd_mwh` | ANU's own LCOS $/MWh (keep for x-check)|
| `power_cost`     | `power_cost_usd_kw`   | $/kW                                   |
| `isdam`          | `isdam`               | boolean                                |
| `isupper`        | (drop)                | distinguishes the two reservoir layers |
| `country`        | `country`             |                                        |
| geometry         | `lat`,`lng` + perimeter polygon | centroid for marker; polygon optional |

## 4. Perimeter drawings (fallback / enrichment)

The WFS geometry gives reservoir polygons directly. If only a screenshot is
available, trace the two reservoir perimeters and store them as GeoJSON
`[[lng,lat],…]` rings under an optional `upper_perimeter` / `lower_perimeter`
key — the map's draw tools (`js/map/drawTools.js`) can render them. Perimeters
are geometry only; they do **not** change the cost model, which is driven by
`volume_gl`, `dam_volume_mm3`, `reservoir_area_ha`, `head_m`, `separation_km`.
