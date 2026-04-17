/**
 * ANU Greenfield Atlas — South Korea (Republic of Korea) PHES Sites
 * Source: re100.anu.edu.au GeoServer (global_greenfield workspace)
 * WFS layer: 15gwh_18h  |  5 sites  |  Classes D–E
 * Coordinates from live WFS feature centroids (EPSG:4326)
 */
window.HB = window.HB || {};
HB.Data = HB.Data || {};

HB.Data.anuGreenfieldSouthKorea = [

    // ── 15 GWh / 18 h tier ──────────────────────────────────────────────────
    { id:'anu_gf15_sk001', tier:'15GWh', class:'D',
      name:'Gyeongju Highlands GF D1 (Greenfield)',
      country:'South Korea', region:'North Gyeongsang',
      lat:35.7286, lng:129.1019,
      head_m:258, separation_km:6.5, volume_gl:6.6,
      water_rock_ratio:8.9, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_greenfield', configuration:'lake_pair', isdam:false,
      description:'ANU Greenfield Class D. New reservoir pair on virgin land. Head 258m, separation 6.5km. RES14946.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_gf15_sk002', tier:'15GWh', class:'D',
      name:'South Gyeongsang Coast GF D2 (Greenfield)',
      country:'South Korea', region:'South Gyeongsang',
      lat:35.4394, lng:129.2336,
      head_m:592, separation_km:8.1, volume_gl:2.9,
      water_rock_ratio:6.8, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_greenfield', configuration:'lake_pair', isdam:false,
      description:'ANU Greenfield Class D. New reservoir pair on virgin land. Head 592m, separation 8.1km. RES33337.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_gf15_sk003', tier:'15GWh', class:'E',
      name:'Nakdong Plateau GF E1 (Greenfield)',
      country:'South Korea', region:'South Gyeongsang',
      lat:35.5142, lng:128.9211,
      head_m:471, separation_km:10.5, volume_gl:3.6,
      water_rock_ratio:9.2, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_greenfield', configuration:'lake_pair', isdam:false,
      description:'ANU Greenfield Class E. New reservoir pair on virgin land. Head 471m, separation 10.5km. RES28183.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_gf15_sk004', tier:'15GWh', class:'E',
      name:'Pohang Highlands GF E2 (Greenfield)',
      country:'South Korea', region:'North Gyeongsang',
      lat:35.7833, lng:129.1272,
      head_m:359, separation_km:7.3, volume_gl:4.7,
      water_rock_ratio:10.1, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_greenfield', configuration:'lake_pair', isdam:false,
      description:'ANU Greenfield Class E. New reservoir pair on virgin land. Head 359m, separation 7.3km. RES13821.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

    { id:'anu_gf15_sk005', tier:'15GWh', class:'E',
      name:'Jeju Halla Slopes GF E1 (Greenfield)',
      country:'South Korea', region:'Jeju',
      lat:33.2717, lng:126.3439,
      head_m:432, separation_km:8.7, volume_gl:3.9,
      water_rock_ratio:8.4, energy_gwh:15,
      dam_volume_mm3:null, reservoir_area_ha:null,
      energy_cost_usd_mwh:null, power_cost_usd_kw:null,
      capacity_mw:833, storage_mwh:15000,
      status:'anu_greenfield', configuration:'lake_pair', isdam:false,
      description:'ANU Greenfield Class E. New reservoir pair on Hallasan volcanic slopes, Jeju Island. Head 432m, separation 8.7km. RES8978.',
      source_url:'https://re100.eng.anu.edu.au/global/' },

];
