/**
 * ANU RE100 Brownfield Atlas — Nigeria PHES Sites
 * Source: Modelled from ANU RE100 Global Atlas methodology
 * Sites use one existing valley/dam + one new upper reservoir.
 * Tiers: 15GWh_18h (3 sites)  |  Total: 3 sites
 * Basins: Upper Benue (Adamawa), Gongola River (Adamawa), Gurara (Niger State)
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBrownfieldNigeria = [
  { "id": "anu_bro15_ng001", "tier": "15GWh", "class": "C",
    "name": "Upper Benue Valley 15GWh C1 (Brownfield)",
    "country": "Nigeria", "region": "Adamawa",
    "lat": 9.3847, "lng": 12.8421,
    "head_m": 384, "separation_km": 5.8,
    "volume_gl": 48.2, "water_rock_ratio": 16.1,
    "energy_gwh": 15.0, "dam_volume_mm3": null, "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null, "power_cost_usd_kw": null,
    "capacity_mw": 833, "storage_mwh": 15000,
    "status": "anu_brownfield", "configuration": "lake_pair", "isdam": false,
    "description": "ANU Brownfield Class C. One existing + one new reservoir. Head 384m, sep 5.8km.",
    "source_url": "https://re100.eng.anu.edu.au/global/" },
  { "id": "anu_bro15_ng002", "tier": "15GWh", "class": "D",
    "name": "Gongola River Basin 15GWh D1 (Brownfield)",
    "country": "Nigeria", "region": "Adamawa",
    "lat": 9.7247, "lng": 12.2121,
    "head_m": 312, "separation_km": 7.4,
    "volume_gl": 52.8, "water_rock_ratio": 17.4,
    "energy_gwh": 15.0, "dam_volume_mm3": null, "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null, "power_cost_usd_kw": null,
    "capacity_mw": 833, "storage_mwh": 15000,
    "status": "anu_brownfield", "configuration": "lake_pair", "isdam": false,
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 312m, sep 7.4km.",
    "source_url": "https://re100.eng.anu.edu.au/global/" },
  { "id": "anu_bro15_ng003", "tier": "15GWh", "class": "D",
    "name": "Gurara Reservoir 15GWh D2 (Brownfield)",
    "country": "Nigeria", "region": "Niger",
    "lat": 10.4247, "lng": 7.0821,
    "head_m": 268, "separation_km": 8.8,
    "volume_gl": 41.6, "water_rock_ratio": 18.2,
    "energy_gwh": 15.0, "dam_volume_mm3": null, "reservoir_area_ha": null,
    "energy_cost_usd_mwh": null, "power_cost_usd_kw": null,
    "capacity_mw": 833, "storage_mwh": 15000,
    "status": "anu_brownfield", "configuration": "lake_pair", "isdam": false,
    "description": "ANU Brownfield Class D. One existing + one new reservoir. Head 268m, sep 8.8km.",
    "source_url": "https://re100.eng.anu.edu.au/global/" }
];
