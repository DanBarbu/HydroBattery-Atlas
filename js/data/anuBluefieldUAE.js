/**
 * ANU RE100 Bluefield Atlas — UAE PHES Sites
 * Source: Modelled from ANU RE100 Global Atlas methodology
 * Existing: Hatta Dam/Reservoir (Dubai — Hatta PSP under development)
 * Tiers: 2GWh_6h (1 sites) · 15GWh_18h (0 sites)  |  Total: 1 sites
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBluefieldUAE = [
  {
    "id": "anu_bf2_ae001",
    "tier": "2GWh",
    "class": "D",
    "name": "Hatta Reservoir 2GWh D1 (Bluefield)",
    "country": "UAE",
    "region": "Dubai",
    "lat": 24.7847,
    "lng": 56.1021,
    "head_m": 248,
    "separation_km": 4.8,
    "volume_gl": 31,
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
    "description": "ANU Bluefield Class D. Existing reservoir lower site. Head 248m.",
    "source_url": "https://re100.eng.anu.edu.au/global/"
  }
];
