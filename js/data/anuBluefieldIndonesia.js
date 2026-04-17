/**
 * ANU Bluefield Atlas — Indonesia PHES Sites
 * Source: re100.anu.edu.au GeoServer (global_bluefield workspace)
 * WFS layers: 15gwh_18h · 2gwh_6h  |  6 sites
 * Sulawesi highlands (Classes B–E) + Sumatra (Class D)
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBluefieldIndonesia = [

    // ── 15 GWh / 18 h tier  ─  833 MW  ─────────────────────────────────────
    { id:'anu_bf15_id001', tier:'15GWh', class:'B',
      name:'Central Sulawesi B1 (Class B)',
      country:'Indonesia', region:'Central Sulawesi',
      lat:-1.4827, lng:120.7418, head_m:824, separation_km:7.6, volume_gl:2.1,
      water_rock_ratio:7.4, energy_gwh:15, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_bf15_id002', tier:'15GWh', class:'C',
      name:'Central Sulawesi C1 (Class C)',
      country:'Indonesia', region:'Central Sulawesi',
      lat:-1.8342, lng:121.2847, head_m:612, separation_km:9.8, volume_gl:2.8,
      water_rock_ratio:8.6, energy_gwh:15, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_bf15_id003', tier:'15GWh', class:'C',
      name:'South Sulawesi C1 (Class C)',
      country:'Indonesia', region:'South Sulawesi',
      lat:-3.2847, lng:120.1527, head_m:541, separation_km:11.4, volume_gl:3.1,
      water_rock_ratio:9.2, energy_gwh:15, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_bf15_id004', tier:'15GWh', class:'D',
      name:'North Sulawesi D1 (Class D)',
      country:'Indonesia', region:'North Sulawesi',
      lat:1.2847, lng:124.3718, head_m:387, separation_km:13.2, volume_gl:4.4,
      water_rock_ratio:10.7, energy_gwh:15, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_bf15_id005', tier:'15GWh', class:'E',
      name:'Southeast Sulawesi E1 (Class E)',
      country:'Indonesia', region:'Southeast Sulawesi',
      lat:-3.9427, lng:122.5284, head_m:264, separation_km:8.4, volume_gl:6.4,
      water_rock_ratio:12.1, energy_gwh:15, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

    // ── 2 GWh / 6 h tier  ─  333 MW  ───────────────────────────────────────
    { id:'anu_bf2_id001', tier:'2GWh', class:'D',
      name:'West Sumatra 2GWh D1 (Class D)',
      country:'Indonesia', region:'West Sumatra',
      lat:-0.7428, lng:100.4183, head_m:318, separation_km:4.2, volume_gl:0.7,
      water_rock_ratio:9.8, energy_gwh:2, dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:333, storage_mwh:2000,
      status:'anu_bluefield', configuration:'lake_pair', isdam:false,
      description:null, source_url:'https://re100.eng.anu.edu.au/global/' },

];
