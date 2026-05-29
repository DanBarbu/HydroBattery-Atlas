window.HB = window.HB || {};
HB.Data = HB.Data || {};

/**
 * ANU RE100 Ocean Atlas — Saudi Arabia PHES Sites
 * Upper reservoir + ocean as lower reservoir
 * configuration: lake_ocean | status: anu_ocean
 *
 * ─────────────────────────────────────────────────────────
 * CONFIRMED ANU SITES (with live WFS RES identifier):
 *   sa001 (n28_e035_RES68475)  — Gulf of Aqaba, Tabuk, 50GWh B
 *   sa002 (n28_e035_RES68475)  — Gulf of Aqaba, Tabuk, 15GWh B (same reservoir pair)
 *   sa003 (n28_e035_RES68475)  — Gulf of Aqaba, Tabuk,  5GWh B (same reservoir pair)
 *
 * HOW TO FIND MORE REAL SITES:
 *   Open scripts/extract-anu-ocean-sites.html in a browser that
 *   can reach re100.anu.edu.au, click Extract, and paste the output
 *   back to replace this file.
 * ─────────────────────────────────────────────────────────
 *
 * Sites: 3 | Tiers: {'50GWh': 1, '15GWh': 1, '5GWh': 1}
 */
HB.Data.anuOceanSaudiArabia = [
  {
    "id": "anu_oc50_sa001",
    "tier": "50GWh",
    "class": "B",
    "name": "Tabuk Gulf Aqaba Ocean 50GWh B (n28_e035_RES68475)",
    "country": "Saudi Arabia",
    "region": "Tabuk",
    "lat": 28.17819,
    "lng": 35.23806,
    "upper_lat": 28.1782,
    "upper_lng": 35.2381,
    "lower_lat": 28.1648,
    "lower_lng": 34.9792,
    "head_m": 1513,
    "separation_km": 29.8,
    "vol_gl": 15.9,
    "wr": 2.5,
    "energy_gwh": 50,
    "storage_h": 18,
    "slope_pct": 47,
    "area_ha": 18,
    "dam_wall_m": 112.4,
    "capacity_mw": 2778,
    "configuration": "lake_ocean",
    "status": "anu_ocean"
  },
  {
    "id": "anu_oc15_sa002",
    "tier": "15GWh",
    "class": "B",
    "name": "Tabuk Gulf Aqaba Ocean 15GWh B (n28_e035_RES68475)",
    "country": "Saudi Arabia",
    "region": "Tabuk",
    "lat": 28.17819,
    "lng": 35.23806,
    "upper_lat": 28.1782,
    "upper_lng": 35.2381,
    "lower_lat": 28.1648,
    "lower_lng": 34.9792,
    "head_m": 1513,
    "separation_km": 29.8,
    "vol_gl": 9.5,
    "wr": 2.5,
    "energy_gwh": 15,
    "storage_h": 18,
    "slope_pct": 47,
    "area_ha": 14,
    "dam_wall_m": 112.4,
    "capacity_mw": 833,
    "configuration": "lake_ocean",
    "status": "anu_ocean"
  },
  {
    "id": "anu_oc5_sa003",
    "tier": "5GWh",
    "class": "B",
    "name": "Tabuk Gulf Aqaba Ocean 5GWh B (n28_e035_RES68475)",
    "country": "Saudi Arabia",
    "region": "Tabuk",
    "lat": 28.17819,
    "lng": 35.23806,
    "upper_lat": 28.1782,
    "upper_lng": 35.2381,
    "lower_lat": 28.1648,
    "lower_lng": 34.9792,
    "head_m": 1513,
    "separation_km": 29.8,
    "vol_gl": 15.9,
    "wr": 2.5,
    "energy_gwh": 5,
    "storage_h": 18,
    "slope_pct": 47,
    "area_ha": 8,
    "dam_wall_m": 112.4,
    "capacity_mw": 278,
    "configuration": "lake_ocean",
    "status": "anu_ocean"
  }
];
