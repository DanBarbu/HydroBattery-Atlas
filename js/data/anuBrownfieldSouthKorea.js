/**
 * ANU Brownfield Atlas — South Korea (Republic of Korea) PHES Sites
 * Source: re100.anu.edu.au GeoServer (global_brownfield workspace)
 * WFS layer: 15gwh_18h  |  2 sites  |  Class D (mine-adjacent)
 * Taebaek coal-field area — uses existing mine infrastructure
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuBrownfieldSouthKorea = [

    // ── 15 GWh / 18 h tier ──────────────────────────────────────────────────
    { id:'anu_brf15_sk001', tier:'15GWh', class:'D',
      name:'Taebaek Mine Void BF D1 (Brownfield)',
      country:'South Korea', region:'Gangwon',
      lat:37.3218, lng:129.1454,
      head_m:1037, separation_km:5.2, volume_gl:1.6,
      water_rock_ratio:7.1, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_brownfield', configuration:'lake_pair', isdam:false,
      description:'ANU Brownfield Class D. Uses existing mine pit/void as lower reservoir near Taebaek coalfield. Head 1037m, separation 5.2km. RES15951.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_brf15_sk002', tier:'15GWh', class:'D',
      name:'Taebaek Coast BF D2 (Brownfield)',
      country:'South Korea', region:'Gangwon',
      lat:37.3282, lng:129.1560,
      head_m:851, separation_km:6.1, volume_gl:2.0,
      water_rock_ratio:7.5, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_brownfield', configuration:'lake_pair', isdam:false,
      description:'ANU Brownfield Class D. Uses existing mine infrastructure near Taebaek east-coast slopes. Head 851m, separation 6.1km. RES14960.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

];
