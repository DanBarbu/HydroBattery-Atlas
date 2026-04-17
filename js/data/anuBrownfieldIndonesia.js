/**
 * ANU Brownfield Atlas — Indonesia PHES Sites
 * Source: re100.anu.edu.au GeoServer (global_brownfield workspace)
 * WFS layer: 15gwh_18h  |  2 sites  |  Classes C–D
 * PITD69 Kalimantan coal mine cluster (ispin=true features)
 * Uses existing open-cut coal mine voids as lower reservoir
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBrownfieldIndonesia = [

    // ── 15 GWh / 18 h tier  ─  833 MW  ─────────────────────────────────────
    { id:'anu_brf15_id001', tier:'15GWh', class:'C',
      name:'Kalimantan Coal Mine PITD69 BF C1 (Brownfield)',
      country:'Indonesia', region:'East Kalimantan',
      lat:-0.5284, lng:117.1427, head_m:562, separation_km:9.4, volume_gl:3.0,
      water_rock_ratio:8.7, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_brownfield', configuration:'lake_pair', isdam:false,
      description:'ANU Brownfield Class C. Uses PITD69 Kalimantan open-cut coal mine void as lower reservoir. Head 562m, separation 9.4km.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_brf15_id002', tier:'15GWh', class:'D',
      name:'Kalimantan Coal Mine PITD69 BF D1 (Brownfield)',
      country:'Indonesia', region:'East Kalimantan',
      lat:-0.6847, lng:117.3284, head_m:398, separation_km:12.1, volume_gl:4.3,
      water_rock_ratio:10.2, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_brownfield', configuration:'lake_pair', isdam:false,
      description:'ANU Brownfield Class D. Uses PITD69 Kalimantan open-cut coal mine void as lower reservoir. Head 398m, separation 12.1km.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

];
