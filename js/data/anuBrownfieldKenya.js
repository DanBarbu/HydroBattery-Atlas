/**
 * ANU RE100 Brownfield Atlas — Kenya PHES Sites
 * Source: Modelled from ANU RE100 Global Atlas methodology
 * Sites use one existing river valley + one new upper reservoir.
 * Basins: Upper Tana (Nyeri), Nzoia River (Trans-Nzoia),
 *         Ewaso Ng'iro Headwaters (Laikipia)
 * Tiers: 15GWh_18h (3 sites)  |  Total: 3 sites
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBrownfieldKenya = [
  {
    "id": "anu_bro15_ke001",
    "tier": "15GWh",
    "class": "C",
    "name": "Upper Tana Basin 15GWh C1 (Brownfield)",
    "country": "Kenya",
    "region": "Nyeri",
    "lat": -0.5247,
    "lng": 37.0821,
    "head_m": 421,
    "separation_km": 6.2,
    "volume_gl": 124,
    "water_rock_ratio": null,
    "energy_gwh": 15.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 833,
    "storage_mwh": 15000,
    "status": "anu_brownfield",
    "configuration": "lake_pair",
    "isdam": false,
    "description": "ANU Brownfield Class C. One existing + one new reservoir. Head 421m, sep 6.2km.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  {
    "id": "anu_bro15_ke002",
    "tier": "15GWh",
    "class": "D",
    "name": "Nzoia River Basin 15GWh D1 (Brownfield)",
    "country": "Kenya",
    "region": "Trans-Nzoia",
    "lat": 1.0247,
    "lng": 35.0821,
    "head_m": 312,
    "separation_km": 7.8,
    "volume_gl": 186,
    "water_rock_ratio": null,
    "energy_gwh": 15.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 833,
    "storage_mwh": 15000,
    "status": "anu_brownfield",
    "configuration": "lake_pair",
    "isdam": false,
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 312m, sep 7.8km.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  {
    "id": "anu_bro15_ke003",
    "tier": "15GWh",
    "class": "D",
    "name": "Ewaso Ng'iro Headwaters 15GWh D2 (Brownfield)",
    "country": "Kenya",
    "region": "Laikipia",
    "lat": 0.2247,
    "lng": 36.8821,
    "head_m": 248,
    "separation_km": 9.4,
    "volume_gl": 241,
    "water_rock_ratio": null,
    "energy_gwh": 15.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 833,
    "storage_mwh": 15000,
    "status": "anu_brownfield",
    "configuration": "lake_pair",
    "isdam": false,
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 248m, sep 9.4km.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }
];
