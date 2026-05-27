/**
 * ANU RE100 Brownfield Atlas — Saudi Arabia PHES Sites
 * Source: Modelled from ANU RE100 Global Atlas methodology
 * Basins: Wadi Baysh (Jizan), Wadi Najran
 * Tiers: 15GWh_18h (2 sites)  |  Total: 2 sites
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBrownfieldSaudiArabia = [
  {
    "id": "anu_bro15_sa001",
    "tier": "15GWh",
    "class": "D",
    "name": "Wadi Baysh Basin 15GWh D1 (Brownfield)",
    "country": "Saudi Arabia",
    "region": "Jizan",
    "lat": 17.8247,
    "lng": 42.8121,
    "head_m": 341,
    "separation_km": 6.4,
    "volume_gl": 162,
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
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 341m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  },
  {
    "id": "anu_bro15_sa002",
    "tier": "15GWh",
    "class": "D",
    "name": "Wadi Najran 15GWh D2 (Brownfield)",
    "country": "Saudi Arabia",
    "region": "Najran",
    "lat": 17.4947,
    "lng": 44.1821,
    "head_m": 286,
    "separation_km": 8.1,
    "volume_gl": 218,
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
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 286m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }
];
