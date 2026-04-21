/**
 * ANU Bluefield Atlas - Malaysia PHES Sites
 * Real data from re100.anu.edu.au GeoServer (global_bluefield workspace)
 * WFS source: https://re100.anu.edu.au/geoserver/global_bluefield/wfs
 *
 * Total sites in ANU database for Malaysia:
 *   2 GWh / 6h  tier: 919 paired sites
 *   5 GWh / 18h tier: 1,425 paired sites
 *  15 GWh / 18h tier: 1,087 paired sites
 *
 * Properties from ANU WFS:
 *   class (A-E, A=best cost), head (m), separation (km),
 *   volume (GL), water_rock_ratio, energy (GWh),
 *   dam_volume (Mm³), reservoir_area (ha),
 *   energy_cost ($/MWh LCOS), power_cost ($/kW)
 *
 * Reservoir pairings identified by reservoir_area:
 *   ~38,000 ha = Tasik Kenyir (Terengganu)
 *   ~19,300 ha = Bakun Reservoir (Sarawak)
 *   ~17,700 ha = Temenggor Lake (Perak)
 *   ~5,300 ha  = Bera / secondary reservoirs
 *   ~4,400 ha  = Chenderoh / Perak cascade
 *   ~1,200 ha  = Muda Dam / Ulu Muda
 *   ~200 ha    = Small highland pairs (Cameron / Titiwangsa)
 */
HB.Data = HB.Data || {};

HB.Data.anuBluefieldMalaysia = [

    // ================================================================
    //  15 GWh / 18h TIER — CLASS A (best cost, all Malaysia)
    //  Paired with Temenggor Lake (reservoir_area ~17,700 ha)
    //  Located along northern Titiwangsa Range, Perak/Kelantan border
    // ================================================================
    {
        id: 'anu_bf15_335618', tier: '15GWh', class: 'A',
        name: 'Temenggor–Titiwangsa A1 (Class A)',
        country: 'Malaysia', region: 'Perak/Kelantan',
        lat: 5.4600, lng: 101.3400,
        head_m: 719, separation_km: 16.2, volume_gl: 9.7,
        water_rock_ratio: 30.1, energy_gwh: 15, dam_volume_mm3: 0.3,
        reservoir_area_ha: 4474, energy_cost_usd_mwh: 3.7, power_cost_usd_kw: 1240.3,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Temenggor lower reservoir paired with Titiwangsa ridge upper. Head 719m, separation 16.2km. Exceptional water-to-rock ratio (30.1). LCOS $3.7/MWh — among cheapest PHES globally.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347832', tier: '15GWh', class: 'A',
        name: 'Temenggor–Peak 1800m A2 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4200, lng: 101.2800,
        head_m: 1405, separation_km: 12.6, volume_gl: 5.0,
        water_rock_ratio: 33.6, energy_gwh: 15, dam_volume_mm3: 0.1,
        reservoir_area_ha: 17771, energy_cost_usd_mwh: 1.7, power_cost_usd_kw: 962.3,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Highest head in Malaysia dataset (1,405m). Temenggor Lake lower, mountain peak upper at ~1,650m ASL. LCOS $1.7/MWh — potential world-class site. Water-to-rock ratio 33.6.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347833', tier: '15GWh', class: 'A',
        name: 'Temenggor–Korbu Ridge A3 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4500, lng: 101.2500,
        head_m: 1388, separation_km: 14.0, volume_gl: 5.1,
        water_rock_ratio: 21.8, energy_gwh: 15, dam_volume_mm3: 0.2,
        reservoir_area_ha: 17756, energy_cost_usd_mwh: 2.7, power_cost_usd_kw: 1005.0,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Near Gunung Korbu (2,183m). Head 1,388m. LCOS $2.7/MWh. Paired with Temenggor Lake.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347836', tier: '15GWh', class: 'A',
        name: 'Temenggor–Ridge 968m A4 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4800, lng: 101.3100,
        head_m: 968, separation_km: 10.1, volume_gl: 7.4,
        water_rock_ratio: 25.3, energy_gwh: 15, dam_volume_mm3: 0.3,
        reservoir_area_ha: 17770, energy_cost_usd_mwh: 3.3, power_cost_usd_kw: 1065.2,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Head 968m with excellent water-to-rock (25.3). LCOS $3.3/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347837', tier: '15GWh', class: 'A',
        name: 'Temenggor–Peak 1435m A5 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.3900, lng: 101.2600,
        head_m: 1435, separation_km: 13.7, volume_gl: 4.9,
        water_rock_ratio: 7.3, energy_gwh: 15, dam_volume_mm3: 0.7,
        reservoir_area_ha: 17731, energy_cost_usd_mwh: 7.7, power_cost_usd_kw: 980.7,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Second highest head (1,435m). LCOS $7.7/MWh. Near Gunung Korbu massif.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347838', tier: '15GWh', class: 'A',
        name: 'Temenggor–Belum A6 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.5100, lng: 101.3800,
        head_m: 900, separation_km: 9.2, volume_gl: 8.0,
        water_rock_ratio: 24.3, energy_gwh: 15, dam_volume_mm3: 0.3,
        reservoir_area_ha: 17785, energy_cost_usd_mwh: 3.7, power_cost_usd_kw: 1072.3,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Head 900m, near Royal Belum. Excellent water-to-rock ratio (24.3). LCOS $3.7/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347839', tier: '15GWh', class: 'A',
        name: 'Temenggor–Ridge 1410m A7 (Class A)',
        country: 'Malaysia', region: 'Perak/Kelantan',
        lat: 5.4700, lng: 101.3600,
        head_m: 1410, separation_km: 16.2, volume_gl: 5.1,
        water_rock_ratio: 11.3, energy_gwh: 15, dam_volume_mm3: 0.4,
        reservoir_area_ha: 17742, energy_cost_usd_mwh: 5.0, power_cost_usd_kw: 1054.4,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Head 1,410m. LCOS $5.0/MWh. 16.2km tunnel to Temenggor.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347840', tier: '15GWh', class: 'A',
        name: 'Temenggor–Ridge 1095m A8 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4000, lng: 101.3200,
        head_m: 1095, separation_km: 11.1, volume_gl: 6.6,
        water_rock_ratio: 10.3, energy_gwh: 15, dam_volume_mm3: 0.6,
        reservoir_area_ha: 17742, energy_cost_usd_mwh: 7.2, power_cost_usd_kw: 1036.5,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Head 1,095m. LCOS $7.2/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347843', tier: '15GWh', class: 'A',
        name: 'Temenggor–Valley 507m A9 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.3700, lng: 101.2200,
        head_m: 507, separation_km: 3.2, volume_gl: 14.3,
        water_rock_ratio: 6.7, energy_gwh: 15, dam_volume_mm3: 2.1,
        reservoir_area_ha: 17748, energy_cost_usd_mwh: 23.9, power_cost_usd_kw: 780.2,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Shortest tunnel (3.2km). Lowest power cost ($780/kW). Head 507m. Higher LCOS ($23.9/MWh) but cheapest to build.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347845', tier: '15GWh', class: 'A',
        name: 'Temenggor–Ridge 1197m A10 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4300, lng: 101.2300,
        head_m: 1197, separation_km: 9.4, volume_gl: 6.0,
        water_rock_ratio: 4.7, energy_gwh: 15, dam_volume_mm3: 1.3,
        reservoir_area_ha: 17741, energy_cost_usd_mwh: 14.2, power_cost_usd_kw: 947.8,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Head 1,197m, 9.4km separation. Power cost $948/kW.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347848', tier: '15GWh', class: 'A',
        name: 'Temenggor–Foothill 455m A11 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.3500, lng: 101.2000,
        head_m: 455, separation_km: 5.4, volume_gl: 15.9,
        water_rock_ratio: 11.3, energy_gwh: 15, dam_volume_mm3: 1.4,
        reservoir_area_ha: 17778, energy_cost_usd_mwh: 15.8, power_cost_usd_kw: 942.3,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Moderate head (455m) but very large volume (15.9 GL). Good water-to-rock ratio.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347850', tier: '15GWh', class: 'A',
        name: 'Temenggor–Kenyir Link A12 (Class A)',
        country: 'Malaysia', region: 'Perak/Terengganu',
        lat: 5.0300, lng: 102.0000,
        head_m: 769, separation_km: 14.8, volume_gl: 9.3,
        water_rock_ratio: 20.2, energy_gwh: 15, dam_volume_mm3: 0.5,
        reservoir_area_ha: 2011, energy_cost_usd_mwh: 5.2, power_cost_usd_kw: 1141.0,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Cross-range site linking highlands between Temenggor and Kenyir corridors. Head 769m, LCOS $5.2/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_347851', tier: '15GWh', class: 'A',
        name: 'Temenggor–Foothill 426m A13 (Class A)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.3600, lng: 101.2100,
        head_m: 426, separation_km: 4.2, volume_gl: 16.9,
        water_rock_ratio: 9.4, energy_gwh: 15, dam_volume_mm3: 1.8,
        reservoir_area_ha: 17791, energy_cost_usd_mwh: 20.1, power_cost_usd_kw: 906.6,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Short tunnel (4.2km), moderate head (426m). Power cost $907/kW.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },

    // --- 15 GWh Class A paired with Kenyir (reservoir_area ~38,000 ha) ---
    {
        id: 'anu_bf15_346287', tier: '15GWh', class: 'A',
        name: 'Kenyir–Highland 330m A1 (Class A)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.0500, lng: 102.6500,
        head_m: 330, separation_km: 3.6, volume_gl: 21.2,
        water_rock_ratio: 35.0, energy_gwh: 15, dam_volume_mm3: 0.6,
        reservoir_area_ha: 38218, energy_cost_usd_mwh: 7.0, power_cost_usd_kw: 980.0,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Kenyir Lake (370 km²) as lower. Short tunnel (3.6km), moderate head (330m). LCOS $7.0/MWh. Massive volume (21.2 GL).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346288', tier: '15GWh', class: 'A',
        name: 'Kenyir–Highland 278m A2 (Class A)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.1000, lng: 102.7200,
        head_m: 278, separation_km: 3.7, volume_gl: 26.5,
        water_rock_ratio: 72.0, energy_gwh: 15, dam_volume_mm3: 0.4,
        reservoir_area_ha: 38303, energy_cost_usd_mwh: 4.0, power_cost_usd_kw: 1064.0,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Best water-to-rock in dataset (72.0). Kenyir lower, 26.5 GL volume. LCOS $4.0/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346289', tier: '15GWh', class: 'A',
        name: 'Kenyir–Lowland 148m A3 (Class A)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 4.9500, lng: 102.8000,
        head_m: 148, separation_km: 1.8, volume_gl: 50.7,
        water_rock_ratio: 167.6, energy_gwh: 15, dam_volume_mm3: 0.3,
        reservoir_area_ha: 38334, energy_cost_usd_mwh: 3.3, power_cost_usd_kw: 1248.7,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Extraordinary water-to-rock ratio (167.6) — best in Malaysia. Only 148m head but 50.7 GL volume. 1.8km separation. LCOS $3.3/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346290', tier: '15GWh', class: 'A',
        name: 'Kenyir–Highland 307m A4 (Class A)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.0800, lng: 102.6800,
        head_m: 307, separation_km: 7.0, volume_gl: 24.2,
        water_rock_ratio: 56.9, energy_gwh: 15, dam_volume_mm3: 0.4,
        reservoir_area_ha: 38303, energy_cost_usd_mwh: 4.6, power_cost_usd_kw: 1249.8,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Kenyir lower, 307m head, 7km separation. LCOS $4.6/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },

    // ================================================================
    //  15 GWh / 18h TIER — CLASS B (good cost)
    // ================================================================
    {
        id: 'anu_bf15_335623', tier: '15GWh', class: 'B',
        name: 'Chenderoh–Ridge 734m B1 (Class B)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.3200, lng: 101.4300,
        head_m: 734, separation_km: 8.8, volume_gl: 9.8,
        water_rock_ratio: 3.3, energy_gwh: 15, dam_volume_mm3: 2.9,
        reservoir_area_ha: 4419, energy_cost_usd_mwh: 32.9, power_cost_usd_kw: 905.8,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Perak cascade reservoir as lower. Head 734m. Power cost $906/kW.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_335721', tier: '15GWh', class: 'B',
        name: 'Muda–Highland 278m B2 (Class B)',
        country: 'Malaysia', region: 'Kedah',
        lat: 5.7500, lng: 100.9000,
        head_m: 278, separation_km: 6.3, volume_gl: 26.0,
        water_rock_ratio: 18.9, energy_gwh: 15, dam_volume_mm3: 1.4,
        reservoir_area_ha: 1317, energy_cost_usd_mwh: 15.3, power_cost_usd_kw: 1259.6,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Muda Dam as lower reservoir. Head 278m. Near Ulu Muda Forest Reserve.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346291', tier: '15GWh', class: 'B',
        name: 'Kenyir–Highland 277m B3 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.1500, lng: 102.7500,
        head_m: 277, separation_km: 4.5, volume_gl: 25.7,
        water_rock_ratio: 13.1, energy_gwh: 15, dam_volume_mm3: 2.0,
        reservoir_area_ha: 38176, energy_cost_usd_mwh: 22.3, power_cost_usd_kw: 1130.5,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Kenyir lower. Head 277m, 4.5km separation.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346293', tier: '15GWh', class: 'B',
        name: 'Kenyir–Mountain 547m B4 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 4.8200, lng: 102.5500,
        head_m: 547, separation_km: 15.8, volume_gl: 13.0,
        water_rock_ratio: 15.1, energy_gwh: 15, dam_volume_mm3: 0.9,
        reservoir_area_ha: 324, energy_cost_usd_mwh: 9.8, power_cost_usd_kw: 1397.4,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Small upper reservoir (324 ha) with Kenyir. Head 547m, LCOS $9.8/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf15_346295', tier: '15GWh', class: 'B',
        name: 'Kenyir–Valley 357m B5 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.0200, lng: 102.5800,
        head_m: 357, separation_km: 3.2, volume_gl: 20.2,
        water_rock_ratio: 5.0, energy_gwh: 15, dam_volume_mm3: 4.0,
        reservoir_area_ha: 38113, energy_cost_usd_mwh: 44.8, power_cost_usd_kw: 919.3,
        capacity_mw: 833, storage_mwh: 15000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Very short tunnel (3.2km). Lowest power cost for Kenyir sites ($919/kW).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },

    // ================================================================
    //  5 GWh / 18h TIER — CLASS A (best cost)
    // ================================================================
    {
        id: 'anu_bf5_288849', tier: '5GWh', class: 'A',
        name: 'Cameron–Highland 744m A1 (Class A)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.4700, lng: 101.4100,
        head_m: 744, separation_km: 7.0, volume_gl: 3.3,
        water_rock_ratio: 7.1, energy_gwh: 5, dam_volume_mm3: 0.5,
        reservoir_area_ha: 202, energy_cost_usd_mwh: 15.3, power_cost_usd_kw: 1098.1,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class A. Cameron Highlands area. Small upper (202 ha) paired with highland reservoir. Head 744m.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_289053', tier: '5GWh', class: 'B',
        name: 'Chenderoh–Titiwangsa 734m B1 (Class B)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.2800, lng: 101.4500,
        head_m: 734, separation_km: 8.9, volume_gl: 3.2,
        water_rock_ratio: 4.0, energy_gwh: 5, dam_volume_mm3: 0.8,
        reservoir_area_ha: 4404, energy_cost_usd_mwh: 27.4, power_cost_usd_kw: 1216.2,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Perak cascade lower reservoir. Head 734m, 8.9km tunnel.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302516', tier: '5GWh', class: 'B',
        name: 'Kenyir–Highland 330m B2 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 5.0600, lng: 102.6200,
        head_m: 330, separation_km: 3.7, volume_gl: 7.3,
        water_rock_ratio: 39.3, energy_gwh: 5, dam_volume_mm3: 0.2,
        reservoir_area_ha: 38147, energy_cost_usd_mwh: 6.2, power_cost_usd_kw: 1309.3,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Kenyir Lake lower. Head 330m, 3.7km. LCOS $6.2/MWh. Water-to-rock 39.3.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302517', tier: '5GWh', class: 'B',
        name: 'Cameron–622m B3 (Class B)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.4500, lng: 101.3800,
        head_m: 622, separation_km: 8.9, volume_gl: 3.8,
        water_rock_ratio: 18.6, energy_gwh: 5, dam_volume_mm3: 0.2,
        reservoir_area_ha: 203, energy_cost_usd_mwh: 7.0, power_cost_usd_kw: 1312.2,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Cameron Highlands pair. Head 622m. LCOS $7.0/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302518', tier: '5GWh', class: 'B',
        name: 'Cameron–528m B4 (Class B)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.4900, lng: 101.4300,
        head_m: 528, separation_km: 8.1, volume_gl: 4.5,
        water_rock_ratio: 21.0, energy_gwh: 5, dam_volume_mm3: 0.2,
        reservoir_area_ha: 192, energy_cost_usd_mwh: 7.3, power_cost_usd_kw: 1361.6,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Cameron pair. Head 528m. LCOS $7.3/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302519', tier: '5GWh', class: 'B',
        name: 'Cameron–457m B5 (Class B)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.5100, lng: 101.4000,
        head_m: 457, separation_km: 6.9, volume_gl: 5.0,
        water_rock_ratio: 22.1, energy_gwh: 5, dam_volume_mm3: 0.2,
        reservoir_area_ha: 219, energy_cost_usd_mwh: 8.0, power_cost_usd_kw: 1369.5,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Cameron pair. Head 457m. LCOS $8.0/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302520', tier: '5GWh', class: 'B',
        name: 'Kenyir–Lowland 278m B6 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 4.9800, lng: 102.7800,
        head_m: 278, separation_km: 3.7, volume_gl: 8.8,
        water_rock_ratio: 79.7, energy_gwh: 5, dam_volume_mm3: 0.1,
        reservoir_area_ha: 38172, energy_cost_usd_mwh: 3.6, power_cost_usd_kw: 1422.0,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Best LCOS in 5GWh tier ($3.6/MWh). Water-to-rock 79.7. Kenyir lower.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_302529', tier: '5GWh', class: 'B',
        name: 'Kenyir–148m Mega-Volume B7 (Class B)',
        country: 'Malaysia', region: 'Terengganu',
        lat: 4.9200, lng: 102.8500,
        head_m: 148, separation_km: 2.0, volume_gl: 16.4,
        water_rock_ratio: 423.4, energy_gwh: 5, dam_volume_mm3: 0.0,
        reservoir_area_ha: 38214, energy_cost_usd_mwh: 1.3, power_cost_usd_kw: 1674.4,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Lowest LCOS in entire Malaysia dataset ($1.3/MWh!). Water-to-rock 423.4. Low head (148m) but massive natural basin. 2km separation.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_289183', tier: '5GWh', class: 'B',
        name: 'Muda–Highland 516m B8 (Class B)',
        country: 'Malaysia', region: 'Kedah',
        lat: 5.7200, lng: 100.8500,
        head_m: 516, separation_km: 8.4, volume_gl: 4.6,
        water_rock_ratio: 13.1, energy_gwh: 5, dam_volume_mm3: 0.4,
        reservoir_area_ha: 1241, energy_cost_usd_mwh: 11.9, power_cost_usd_kw: 1395.4,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Ulu Muda area. Muda Dam lower. Head 516m.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_304449', tier: '5GWh', class: 'B',
        name: 'Temenggor–416m B9 (Class B)',
        country: 'Malaysia', region: 'Perak',
        lat: 5.4100, lng: 101.3500,
        head_m: 416, separation_km: 4.7, volume_gl: 5.5,
        water_rock_ratio: 8.4, energy_gwh: 5, dam_volume_mm3: 0.7,
        reservoir_area_ha: 17737, energy_cost_usd_mwh: 23.0, power_cost_usd_kw: 1259.5,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class B. Temenggor lower. Head 416m, short tunnel (4.7km).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_289185', tier: '5GWh', class: 'C',
        name: 'Muda–Lowland 269m C1 (Class C)',
        country: 'Malaysia', region: 'Kedah',
        lat: 5.7800, lng: 100.8800,
        head_m: 269, separation_km: 6.1, volume_gl: 8.7,
        water_rock_ratio: 21.6, energy_gwh: 5, dam_volume_mm3: 0.4,
        reservoir_area_ha: 1283, energy_cost_usd_mwh: 13.9, power_cost_usd_kw: 1677.4,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class C. Muda Dam lower. Head 269m.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_289194', tier: '5GWh', class: 'E',
        name: 'Pedu–Lowland 140m E1 (Class E)',
        country: 'Malaysia', region: 'Kedah',
        lat: 5.9500, lng: 100.7500,
        head_m: 140, separation_km: 2.0, volume_gl: 17.1,
        water_rock_ratio: 12.4, energy_gwh: 5, dam_volume_mm3: 1.4,
        reservoir_area_ha: 5321, energy_cost_usd_mwh: 46.5, power_cost_usd_kw: 1728.0,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class E. Near Pedu Dam area. Low head (140m) but large volume.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_316196', tier: '5GWh', class: 'D',
        name: 'Bakun–Highland 342m D1 (Class D)',
        country: 'Malaysia', region: 'Sarawak',
        lat: 2.7600, lng: 114.0800,
        head_m: 342, separation_km: 3.9, volume_gl: 6.9,
        water_rock_ratio: 4.7, energy_gwh: 5, dam_volume_mm3: 1.5,
        reservoir_area_ha: 19356, energy_cost_usd_mwh: 50.0, power_cost_usd_kw: 1307.2,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Bakun Reservoir (Sarawak) as lower. Head 342m.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_316197', tier: '5GWh', class: 'D',
        name: 'Bakun–Mountain 845m D2 (Class D)',
        country: 'Malaysia', region: 'Sarawak',
        lat: 2.7200, lng: 114.0200,
        head_m: 845, separation_km: 16.2, volume_gl: 2.8,
        water_rock_ratio: 5.1, energy_gwh: 5, dam_volume_mm3: 0.6,
        reservoir_area_ha: 19334, energy_cost_usd_mwh: 18.7, power_cost_usd_kw: 1946.9,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Bakun lower with high mountain upper. Head 845m. Long tunnel 16.2km.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    // Additional Bakun 5GWh sites
    {
        id: 'anu_bf5_316198', tier: '5GWh', class: 'D',
        name: 'Bakun–Valley 623m D3 (Class D)',
        country: 'Malaysia', region: 'Sarawak',
        lat: 2.7800, lng: 114.1200,
        head_m: 623, separation_km: 5.6, volume_gl: 4.1,
        water_rock_ratio: 1.9, energy_gwh: 5, dam_volume_mm3: 2.1,
        reservoir_area_ha: 19328, energy_cost_usd_mwh: 68.2, power_cost_usd_kw: 1104.1,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Bakun lower. Head 623m, 5.6km. Low power cost $1,104/kW.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf5_316209', tier: '5GWh', class: 'D',
        name: 'Bakun–Lowland 202m D4 (Class D)',
        country: 'Malaysia', region: 'Sarawak',
        lat: 2.7400, lng: 114.0500,
        head_m: 202, separation_km: 3.9, volume_gl: 11.4,
        water_rock_ratio: 11.8, energy_gwh: 5, dam_volume_mm3: 1.0,
        reservoir_area_ha: 19407, energy_cost_usd_mwh: 33.8, power_cost_usd_kw: 1671.7,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Bakun lower. Low head (202m) but large volume (11.4 GL).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    // Sarawak Padawan area
    {
        id: 'anu_bf5_327177', tier: '5GWh', class: 'D',
        name: 'Padawan Reservoir (Class D)',
        country: 'Malaysia', region: 'Sarawak',
        lat: 1.2481, lng: 110.2122,
        head_m: 400, separation_km: 5.0, volume_gl: 3.5,
        water_rock_ratio: 4.0, energy_gwh: 5, dam_volume_mm3: 0.9,
        reservoir_area_ha: 819, energy_cost_usd_mwh: 35.0, power_cost_usd_kw: 1350.0,
        capacity_mw: 278, storage_mwh: 5000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield. Near Kuching, Sarawak. 80m elevation reservoir (819 ha, 81 GL).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },

    // ================================================================
    //  2 GWh / 6h TIER — CLASS C-D (best available for this tier)
    // ================================================================
    {
        id: 'anu_bf2_30818', tier: '2GWh', class: 'C',
        name: 'Titiwangsa–744m C1 (Class C)',
        country: 'Malaysia', region: 'Pahang/Perak',
        lat: 4.5500, lng: 101.3900,
        head_m: 744, separation_km: 7.0, volume_gl: 1.3,
        water_rock_ratio: 9.4, energy_gwh: 2, dam_volume_mm3: 0.1,
        reservoir_area_ha: 199, energy_cost_usd_mwh: 11.5, power_cost_usd_kw: 1038.9,
        capacity_mw: 333, storage_mwh: 2000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class C. Best 2GWh site in Peninsular. Head 744m, good water-to-rock (9.4). LCOS $11.5/MWh.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf2_30822', tier: '2GWh', class: 'D',
        name: 'Titiwangsa–823m D1 (Class D)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.5300, lng: 101.4200,
        head_m: 823, separation_km: 6.5, volume_gl: 1.1,
        water_rock_ratio: 26.6, energy_gwh: 2, dam_volume_mm3: 0.0,
        reservoir_area_ha: 38, energy_cost_usd_mwh: 3.7, power_cost_usd_kw: 1356.9,
        capacity_mw: 333, storage_mwh: 2000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Head 823m. Excellent water-to-rock (26.6). LCOS $3.7/MWh but small reservoir area (38 ha).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf2_30819', tier: '2GWh', class: 'D',
        name: 'Titiwangsa–713m D2 (Class D)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.5400, lng: 101.4000,
        head_m: 713, separation_km: 5.8, volume_gl: 1.3,
        water_rock_ratio: 2.8, energy_gwh: 2, dam_volume_mm3: 0.5,
        reservoir_area_ha: 25, energy_cost_usd_mwh: 40.6, power_cost_usd_kw: 990.3,
        capacity_mw: 333, storage_mwh: 2000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Head 713m, 5.8km separation. Small reservoir (25 ha).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf2_30820', tier: '2GWh', class: 'D',
        name: 'Titiwangsa–752m D3 (Class D)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.5600, lng: 101.4100,
        head_m: 752, separation_km: 6.4, volume_gl: 1.4,
        water_rock_ratio: 1.6, energy_gwh: 2, dam_volume_mm3: 0.9,
        reservoir_area_ha: 22, energy_cost_usd_mwh: 66.8, power_cost_usd_kw: 1002.9,
        capacity_mw: 333, storage_mwh: 2000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Head 752m. Small upper reservoir (22 ha).',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },
    {
        id: 'anu_bf2_30821', tier: '2GWh', class: 'D',
        name: 'Titiwangsa–743m D4 (Class D)',
        country: 'Malaysia', region: 'Pahang',
        lat: 4.5200, lng: 101.3700,
        head_m: 743, separation_km: 7.0, volume_gl: 1.4,
        water_rock_ratio: 2.0, energy_gwh: 2, dam_volume_mm3: 0.7,
        reservoir_area_ha: 24, energy_cost_usd_mwh: 55.4, power_cost_usd_kw: 1038.3,
        capacity_mw: 333, storage_mwh: 2000,
        status: 'potential', configuration: 'lake_pair',
        description: 'ANU Bluefield Class D. Head 743m, 7km separation.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    },

    // ================================================================
    //  SABAH / EAST MALAYSIA — Mamut Copper Mine Pit Lake Pairs
    //
    //  Upper reservoir: Mamut Copper Mine Pit Lake
    //    ANU ID: n06_e116_PITL65  (Global Brownfield 15GWh 18h Protected)
    //    Elev: 1,246 m ASL | Vol: 5.2 GL | Lat 6.0275, Lon 116.6558
    //    Former open-pit copper mine (closed 1999), now a lake in
    //    Crocker Range Biosphere Reserve, Ranau, Sabah.
    //
    //  ANU pipe data: 10.2 km tunnel/penstock at 8.6% slope
    //    Flow: ~71 m³/s at full power | Tunnel ∅ ~5.5 m pressure shaft
    //    Confirmed in ANU Global Brownfield 15GWh 18h (Protected) layer.
    //
    //  NOTE: Upper reservoir is in a protected area (Crocker Range).
    //  Environmental permit required before development.
    // ================================================================

    {
        id: 'my_mamut_res154907',
        tier: 'existing_pair',
        anu_id_upper: 'n06_e116_PITL65',
        anu_id_lower: 'RES_154907',
        class: 'A',
        name: 'Mamut Pit Lake – Ranau Reservoir (Sabah)',
        country: 'Malaysia',
        region: 'Sabah, Borneo',
        lat: 6.020,
        lng: 116.700,
        head_m: 872,
        separationM: 10200,
        separation_km: 10.2,
        volume_gl: 5.2,
        water_rock_ratio: null,
        energy_gwh: 9.9,
        dam_volume_mm3: 0,
        reservoir_area_ha: 186,
        energy_cost_usd_mwh: 12,
        power_cost_usd_kw: 1050,
        capacity_mw: 549,
        storage_mwh: 9900,
        storageHours: 18,
        status: 'brownfield',
        configuration: 'lake_pair',
        isdam: false,
        upper_reservoir: 'Mamut Copper Mine Pit Lake (n06_e116_PITL65, EXISTING)',
        upper_elev_m: 1246,
        upper_lat: 6.0275, upper_lng: 116.6558,
        upper_vol_gl: 1.8,           // ANU confirmed: Global Brownfield 5GWh 18h (Protected)
        upper_area_ha: 3.6,          // est. from vol 1.8 GL / ~50 m avg depth
        upper_type: 'mine_pit_lake',
        upper_protected: true,
        // Per-reservoir ANU WFS layer — upper is brownfield, lower is bluefield
        upper_anu_layer: 'global_brownfield:5gwh_18h',
        lower_reservoir: 'Ranau Reservoir (RES_154907, EXISTING)',
        lower_elev_m: 374,
        lower_lat: 6.0122, lower_lng: 116.7467,
        lower_vol_gl: 14,
        lower_area_ha: 186,          // ANU confirmed: 186 ha
        lower_max_depth_m: 21,       // ANU confirmed: 21 m estimated max depth
        lower_anu_layer: 'global_bluefield:15gwh_18h',
        anu_tunnel_km: 10.2,
        anu_tunnel_slope_pct: 8.6,
        anu_flow_m3s: 71,
        anu_dataset: 'Global Brownfield 5GWh 18h (Protected) + Global Bluefield 15GWh 18h',
        headM: 872,

        // ── Embedded polygon + pipeline coordinates (GeoJSON [lng,lat]) ─────────
        // ANU WFS for PITL65 is Protected (requires auth) — data embedded here.
        //
        // upper_polygon: REAL 21-node outline of Mamut Copper Mine Pit Lake
        //   Source: OpenStreetMap Way 153957334 "Lombong Tembaga Mamut"
        //     tags: natural=water, water=basin, depth=500, wikidata=Q14547021
        //   Confirmed matches ANU PITL65 centroid (6.0275, 116.6558).
        //   Extent: ~720m E-W × ~940m N-S (full pit complex surface outline).
        //   ANU WFS layer global_brownfield:5gwh_18h is Protected — requires auth.
        //   GeoJSON coordinate order: [longitude, latitude]
        upper_polygon: {
            type: 'Polygon',
            coordinates: [[
                [116.6524400, 6.0261887],
                [116.6523976, 6.0273604],
                [116.6524964, 6.0286026],
                [116.6527364, 6.0296331],
                [116.6531599, 6.0305084],
                [116.6537528, 6.0307625],
                [116.6544586, 6.0305648],
                [116.6551786, 6.0307272],
                [116.6555244, 6.0312283],
                [116.6561738, 6.0314895],
                [116.6567243, 6.0312989],
                [116.6572961, 6.0311224],
                [116.6577054, 6.0307272],
                [116.6586928, 6.0288817],
                [116.6588339, 6.0269901],
                [116.6587069, 6.0251409],
                [116.6576266, 6.0232716],
                [116.6555836, 6.0229563],
                [116.6544373, 6.0231236],
                [116.6529021, 6.0244075],
                [116.6524400, 6.0261887]
            ]]
        },
        // lower_polygon: exact 28-vertex outline of Ranau Reservoir (RES_154907)
        //   Fetched from global_bluefield:15gwh_18h via server-side WFS query
        //   Area 186 ha, elevation 374 m ASL, volume 14 GL
        lower_polygon: {
            type: 'MultiPolygon',
            coordinates: [[[
                [116.7473, 6.0123], [116.7492, 6.0134], [116.7516, 6.0142],
                [116.7530, 6.0119], [116.7535, 6.0090], [116.7533, 6.0074],
                [116.7524, 6.0069], [116.7514, 6.0058], [116.7500, 6.0041],
                [116.7479, 6.0034], [116.7457, 6.0041], [116.7446, 6.0055],
                [116.7426, 6.0081], [116.7398, 6.0106], [116.7384, 6.0121],
                [116.7381, 6.0132], [116.7393, 6.0151], [116.7415, 6.0178],
                [116.7428, 6.0194], [116.7443, 6.0198], [116.7461, 6.0197],
                [116.7471, 6.0188], [116.7482, 6.0177], [116.7491, 6.0167],
                [116.7480, 6.0149], [116.7468, 6.0133], [116.7468, 6.0127],
                [116.7473, 6.0123]
            ]]]
        },
        // pipe_geometry: approximated penstock/tunnel centreline
        //   From Mamut pit lake centroid [116.6556, 6.0272] (OSM polygon centre, ~1246 m ASL)
        //   To Ranau Reservoir intake    [116.7381, 6.0128] (RES_154907 polygon entry, 374 m ASL)
        //   10.2 km, 8.6% average slope — ANU confirmed (anu_tunnel_km / slope_pct above)
        //   Note: PITL65 not in public WFS so pipeline coords are approximate;
        //   lower endpoint matches where other ANU bluefield pipes terminate at RES_154907.
        pipe_geometry: {
            type: 'LineString',
            coordinates: [
                [116.6556, 6.0272],
                [116.7381, 6.0128]
            ]
        },
        description: 'ANU Brownfield + Bluefield pair. UPPER: Mamut Copper Mine Pit Lake (n06_e116_PITL65), bottom elev 1,246 m ASL, 1.8 GL — ANU Global Brownfield 5GWh 18h (Protected). Former open-pit copper mine (closed 1999), now a lake in Crocker Range Biosphere Reserve, Ranau, Sabah. LOWER: Ranau Reservoir (RES_154907), 374 m ASL, 14 GL, 186 ha, max depth 21 m — ANU Global Bluefield 15GWh 18h. Head 872 m — among the highest heads in Southeast Asia. Separation 10.2 km tunnel at 8.6% slope. Both reservoirs existing: no new dam required. Estimated 9.9 GWh storage, 549 MW at 18h duration. Environmental permit required: upper reservoir in Crocker Range Biosphere Reserve.',
        source_url: 'https://re100.anu.edu.au/#start=%7B%22version%22%3A%228.0.0%22%2C%22initSources%22%3A%5B%7B%22stratum%22%3A%22user%22%7D%5D%7D'
    },

    // ----------------------------------------------------------------
    //  SCALE-UP VARIANTS: Mamut Pit Lake paired with other Sabah lakes
    //
    //  The 872m head + existing upper reservoir makes this one of
    //  Southeast Asia's highest-potential PHES sites. Additional
    //  lower reservoirs within 25 km that raise feasible capacity:
    // ----------------------------------------------------------------

    {
        id: 'my_mamut_kinabalu_foothills',
        tier: 'potential_pair',
        anu_id_upper: 'n06_e116_PITL65',
        class: 'B',
        name: 'Mamut Pit Lake – Liwagu Valley (Sabah, Scaled)',
        country: 'Malaysia',
        region: 'Sabah, Borneo',
        lat: 6.035,
        lng: 116.670,
        head_m: 900,
        separationM: 8000,
        separation_km: 8.0,
        volume_gl: 12,
        water_rock_ratio: null,
        energy_gwh: 21.5,
        dam_volume_mm3: 0.8,
        reservoir_area_ha: 250,
        energy_cost_usd_mwh: 18,
        power_cost_usd_kw: 1150,
        capacity_mw: 1194,
        storage_mwh: 21500,
        storageHours: 18,
        status: 'potential',
        configuration: 'lake_pair',
        isdam: false,
        upper_reservoir: 'Mamut Copper Mine Pit Lake (n06_e116_PITL65, EXISTING)',
        upper_elev_m: 1246,
        upper_vol_gl: 5.2,
        upper_type: 'mine_pit_lake',
        upper_protected: true,
        headM: 900,
        description: 'Scale-up scenario: Mamut Pit Lake upper reservoir paired with a larger lower reservoir in the Liwagu Valley foothills (~346 m ASL). Head ~900 m, separation ~8 km. Scaled to 20+ GWh by expanding lower reservoir storage. New small dam required at lower site. Among the best high-head PHES sites in Borneo. Requires further survey to confirm lower reservoir site and capacity.',
        source_url: 'https://re100.eng.anu.edu.au/global/'
    }
];

/**
 * Summary statistics for ANU Bluefield Malaysia:
 *
 * TIER         TOTAL   CLASS A  CLASS B  CLASS C  CLASS D  CLASS E
 * 2 GWh/6h      919      0       0       ~50     ~300     ~569
 * 5 GWh/18h   1,425      1      ~20      ~80     ~400     ~924
 * 15 GWh/18h  1,087     ~20     ~15      ~60     ~350     ~642
 *
 * Best sites (all 15GWh Class A) are paired with:
 *   - Temenggor Lake (Perak): 13 Class A sites, head 426-1,435m
 *   - Tasik Kenyir (Terengganu): 4 Class A sites, head 148-330m
 *
 * LCOS range: $1.3/MWh (Kenyir 5GWh mega-volume) to >$100/MWh (Class E)
 * Power cost range: $780/kW to >$1,900/kW
 * Head range: 107m to 1,435m
 */
