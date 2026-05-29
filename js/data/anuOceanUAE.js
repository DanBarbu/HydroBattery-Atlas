window.HB = window.HB || {};
HB.Data = HB.Data || {};

/**
 * ANU RE100 Ocean Atlas — UAE PHES Sites
 * Upper reservoir + ocean as lower reservoir
 * configuration: lake_ocean | status: anu_ocean
 *
 * ─────────────────────────────────────────────────────────
 * CONFIRMED ANU SITES (with live WFS RES identifier):
 *   ae001 (n25_e056_RES17226)  — Arabian Gulf, Ras Al Khaimah, 15GWh B
 *
 * HOW TO FIND MORE REAL SITES:
 *   Open scripts/extract-anu-ocean-sites.html in a browser that
 *   can reach re100.anu.edu.au, click Extract, and paste the output
 *   back to replace this file.
 * ─────────────────────────────────────────────────────────
 *
 * Sites: 1 | Tiers: {'15GWh': 1}
 */
HB.Data.anuOceanUAE = [
  {
    "id": "anu_oc15_ae001",
    "tier": "15GWh",
    "class": "B",
    "name": "RAK Hajar Arabian Gulf Ocean 15GWh B (n25_e056_RES17226)",
    "country": "UAE",
    "region": "Ras Al Khaimah",
    "lat": 25.75958,
    "lng": 56.03792,
    "upper_lat": 25.7596,
    "upper_lng": 56.0379,
    "lower_lat": 25.8075,
    "lower_lng": 55.9239,
    "head_m": 761,
    "separation_km": 15.2,
    "vol_gl": 9.5,
    "wr": 7.9,
    "energy_gwh": 15,
    "storage_h": 18,
    "slope_pct": 32,
    "area_ha": 24,
    "dam_wall_m": 58.0,
    "capacity_mw": 833,
    "configuration": "lake_ocean",
    "status": "anu_ocean"
  }
];
