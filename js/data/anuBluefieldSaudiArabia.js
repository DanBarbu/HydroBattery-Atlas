/**
 * ANU RE100 Bluefield Atlas — Saudi Arabia PHES Sites
 * Source: Modelled from ANU RE100 Global Atlas methodology
 * Existing reservoirs: Abha Dam (Asir), Jizan Dam, Bisha Dam
 * Tiers: 2GWh_6h (1 sites) · 15GWh_18h (2 sites)  |  Total: 3 sites
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBluefieldSaudiArabia = [
  {
    "id": "anu_bf2_sa001",
    "tier": "2GWh",
    "class": "C",
    "name": "Abha Dam 2GWh C1 (Bluefield)",
    "country": "Saudi Arabia",
    "region": "Asir",
    "lat": 18.2124,
    "lng": 42.3747,
    "head_m": 384,
    "separation_km": 5.6,
    "volume_gl": 8.2,
    "water_rock_ratio": None,
    "energy_gwh": 2.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 333,
    "storage_mwh": 2000,
    "status": "anu_bluefield",
    "configuration": "lake_pair",
    "isdam": true,
    "description": "ANU Bluefield Class C. Existing reservoir lower site. Head 384m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  {
    "id": "anu_bf15_sa002",
    "tier": "15GWh",
    "class": "D",
    "name": "Jizan Dam 15GWh D1 (Bluefield)",
    "country": "Saudi Arabia",
    "region": "Jizan",
    "lat": 17.2847,
    "lng": 42.6421,
    "head_m": 264,
    "separation_km": 7.2,
    "volume_gl": 138,
    "water_rock_ratio": None,
    "energy_gwh": 15.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 833,
    "storage_mwh": 15000,
    "status": "anu_bluefield",
    "configuration": "lake_pair",
    "isdam": true,
    "description": "ANU Bluefield Class D. Existing reservoir lower site. Head 264m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  {
    "id": "anu_bf15_sa003",
    "tier": "15GWh",
    "class": "D",
    "name": "Bisha Dam 15GWh D2 (Bluefield)",
    "country": "Saudi Arabia",
    "region": "Asir",
    "lat": 19.9747,
    "lng": 42.6121,
    "head_m": 298,
    "separation_km": 6.8,
    "volume_gl": 92,
    "water_rock_ratio": None,
    "energy_gwh": 15.0,
    "dam_volume_mm3": null,
    "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null,
    "power_cost_usd_kw": null,
    "capacity_mw": 833,
    "storage_mwh": 15000,
    "status": "anu_bluefield",
    "configuration": "lake_pair",
    "isdam": true,
    "description": "ANU Bluefield Class D. Existing reservoir lower site. Head 298m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }
];
