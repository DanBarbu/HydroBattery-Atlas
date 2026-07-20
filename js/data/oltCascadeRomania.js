/**
 * Olt River Cascade Hydropower Plants — Romania
 * ============================================================
 * 20 hydroelectric plants from Cornetu / Gura Lotrului down to
 * the Danube confluence at Izbiceni.
 *
 * DATA SOURCE:
 *   Primary:   Global Energy Monitor (GEM) wiki — Global Hydropower Tracker
 *              https://www.gem.wiki/Category:Hydroelectric_power_plants_in_Romania
 *   Secondary: OpenStreetMap Overpass API (coordinates cross-check)
 *              Hidroelectrica official branch page
 *              https://www.hidroelectrica.ro/article/39
 *
 * WHY MISSING FROM ATLAS PREVIOUSLY:
 *   These are low-head run-of-river cascade plants (8–25 m head per step)
 *   and do not meet ANU RE100 minimums (≥300 m head, ≥2 GWh).
 *   However five lower-Olt plants (Ipotești → Izbiceni) already operate as
 *   PUMPED STORAGE with reversible Bulb turbines (pump mode 200 MW total,
 *   inaugurated 2014). The full cascade (Cornetu→Izbiceni) delivers ~300 m
 *   cumulative head — a significant distributed energy storage corridor.
 *
 * CASCADE TOTALS (Hidroelectrica data):
 *   Middle Olt (Cornetu–Drăgășani): 12 plants, 501.9 MW, 1,475 GWh/yr
 *   Lower Olt  (Strejești–Izbiceni): 8 plants,  379 MW
 *   Grand total: 20 plants, 880.9 MW
 *
 * ELEVATION PROFILE (ASL, approximate):
 *   Cornetu ~335 m → Gura Lotrului ~315 m → Turnu ~290 m →
 *   Câlimănești ~270 m → Dăești ~245 m → Rm. Vâlcea ~228 m →
 *   Râureni ~213 m → Govora ~196 m → Băbeni ~184 m →
 *   Ionești ~173 m → Zăvideni ~158 m → Drăgășani ~142 m →
 *   Strejești ~120 m → Arcești ~93 m → Slatina ~78 m →
 *   Ipotești ~63 m → Drăgănești ~50 m → Frunzaru ~38 m →
 *   Rusănești ~30 m → Izbiceni ~22 m
 *
 * Coordinates: exact from GEM/OSM where available; estimated (est.) otherwise.
 * head_m values are per-plant step estimates derived from elevation profile.
 */

HB.Data = HB.Data || {};

HB.Data.oltCascadeRomania = [

    // ============================================================
    //  MIDDLE OLT CASCADE — 12 Kaplan-turbine dam-type plants
    //  Operator: Sucursala Hidrocentrale Râmnicu Vâlcea
    //  Source: GEM wiki + Hidroelectrica
    // ============================================================

    {
        id: 'ro_olt_cornetu',
        name: 'Cornetu (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.3926, lng: 24.3067,              // GEM exact
        upper_elevation_m: 335, lower_elevation_m: 315,
        head_m: 20,
        headM: 20,
        separationM: 500,
        capacity_mw: 31, storage_mwh: 93,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 2002,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 31 MW (2 Kaplan turbines), commissioned 2002. Northernmost of the 12-plant middle Olt cascade (501.9 MW total). Located at the upper end of the main Olt gorge section north of Câlimănești.',
        source_url: 'https://www.gem.wiki/Cornetu_hydroelectric_plant'
    },

    {
        id: 'ro_olt_gura_lotrului',
        name: 'Gura Lotrului (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.358, lng: 24.178,                // est. — Lotru/Olt confluence, Brezoi area
        upper_elevation_m: 315, lower_elevation_m: 290,
        head_m: 25,
        headM: 25,
        separationM: 600,
        capacity_mw: 36, storage_mwh: 108,       // est. (501.9 MW total minus known plants)
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1971,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'Olt cascade plant at the Lotru River confluence (Brezoi area). Strategic node connecting the surface Olt cascade with the high-head Lotru–Ciunget underground powerhouse (510 MW, 18 km tunnel, 840 m head). Kaplan turbines. Part of the Sucursala Hidrocentrale Râmnicu Vâlcea portfolio.',
        source_url: 'https://www.hidroelectrica.ro/article/39'
    },

    {
        id: 'ro_olt_turnu',
        name: 'Turnu (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.310, lng: 24.335,                // est. — Câlimănești gorge, largest on Olt
        upper_elevation_m: 290, lower_elevation_m: 270,
        head_m: 20,
        headM: 20,
        separationM: 600,
        capacity_mw: 55, storage_mwh: 165,       // est. — described as "largest on the Olt"
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1972,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'Olt cascade — described as the largest hydroelectric plant on the Olt River. Construction required raising the road and railway over 15 km through the Olt gorge near Câlimănești. Kaplan turbines. Part of 12-plant middle Olt cascade (501.9 MW total).',
        source_url: 'https://www.hidroelectrica.ro/article/39'
    },

    {
        id: 'ro_olt_calimanesti',
        name: 'Călimănești (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.2402, lng: 24.3469,              // GEM exact
        upper_elevation_m: 270, lower_elevation_m: 248,
        head_m: 22,
        headM: 22,
        separationM: 500,
        capacity_mw: 40, storage_mwh: 120,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1981,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 40 MW (2 turbines), commissioned 1981. Run-of-river cascade plant on the Olt near the spa town of Călimănești. Kaplan turbines. Part of the 12-plant middle Olt cascade.',
        source_url: 'https://www.gem.wiki/C%C4%83lim%C4%83ne%C8%99ti_Olt_hydroelectric_plant'
    },

    {
        id: 'ro_olt_daesti',
        name: 'Dăești (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.1782, lng: 24.3687,              // GEM exact
        upper_elevation_m: 248, lower_elevation_m: 230,
        head_m: 18,
        headM: 18,
        separationM: 500,
        capacity_mw: 38, storage_mwh: 114,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1976,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 38 MW (2 Kaplan turbines), commissioned 1976. Part of the 12-plant middle Olt cascade (501.9 MW total) between Râmnicu Vâlcea and Câlimănești.',
        source_url: 'https://www.gem.wiki/D%C4%83e%C8%99ti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_ramnicu_valcea',
        name: 'Râmnicu Vâlcea (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.103, lng: 24.376,                // est. — near Rm. Vâlcea city
        upper_elevation_m: 230, lower_elevation_m: 215,
        head_m: 15,
        headM: 15,
        separationM: 500,
        capacity_mw: 50, storage_mwh: 150,       // est. (501.9 MW total minus known plants)
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1977,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'Olt cascade plant adjacent to the city of Râmnicu Vâlcea (Vâlcea county seat). Kaplan turbines. The Sucursala Hidrocentrale Râmnicu Vâlcea administrative headquarters manages all 23 hydroelectric plants on this system. Part of the 12-plant middle Olt cascade (501.9 MW total).',
        source_url: 'https://www.hidroelectrica.ro/article/39'
    },

    {
        id: 'ro_olt_raureni',
        name: 'Râureni (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.0714, lng: 24.3616,              // GEM exact
        upper_elevation_m: 215, lower_elevation_m: 200,
        head_m: 15,
        headM: 15,
        separationM: 500,
        capacity_mw: 48, storage_mwh: 144,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1977,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 48 MW, commissioned 1977. Kaplan turbines. Part of the 12-plant middle Olt cascade south of Râmnicu Vâlcea.',
        source_url: 'https://www.gem.wiki/R%C3%A2ureni_hydroelectric_plant'
    },

    {
        id: 'ro_olt_govora',
        name: 'Govora (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 45.0094, lng: 24.2968,              // GEM exact
        upper_elevation_m: 200, lower_elevation_m: 186,
        head_m: 14,
        headM: 14,
        separationM: 500,
        capacity_mw: 46, storage_mwh: 138,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1975,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 46 MW, commissioned 1975. Near the industrial town of Govora (salt / chemical industry). Kaplan turbines. Part of the 12-plant middle Olt cascade (501.9 MW total).',
        source_url: 'https://www.gem.wiki/Govora_hydroelectric_plant'
    },

    {
        id: 'ro_olt_babeni',
        name: 'Băbeni (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 44.9167, lng: 24.2461,              // GEM exact
        upper_elevation_m: 186, lower_elevation_m: 174,
        head_m: 12,
        headM: 12,
        separationM: 500,
        capacity_mw: 37, storage_mwh: 111,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1978,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 37 MW (2 Kaplan turbines), commissioned 1978. Part of the 12-plant middle Olt cascade south of Govora.',
        source_url: 'https://www.gem.wiki/B%C4%83beni_hydroelectric_plant'
    },

    {
        id: 'ro_olt_ionesti',
        name: 'Ionești (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 44.8542, lng: 24.2467,              // GEM exact
        upper_elevation_m: 174, lower_elevation_m: 162,
        head_m: 12,
        headM: 12,
        separationM: 500,
        capacity_mw: 38, storage_mwh: 114,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1978,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 38 MW (2 Kaplan turbines), commissioned 1978. Run-of-river cascade plant at Ionești, Vâlcea. Part of the 12-plant middle Olt cascade.',
        source_url: 'https://www.gem.wiki/Ione%C8%99ti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_zavideni',
        name: 'Zăvideni (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 44.773, lng: 24.2728,               // GEM exact
        upper_elevation_m: 162, lower_elevation_m: 148,
        head_m: 14,
        headM: 14,
        separationM: 500,
        capacity_mw: 38, storage_mwh: 114,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1980,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 38 MW (2 Kaplan turbines), commissioned 1980. Part of the 12-plant middle Olt cascade near the Vâlcea/Olt county border.',
        source_url: 'https://www.gem.wiki/Zavideni_hydroelectric_plant'
    },

    {
        id: 'ro_olt_dragasani',
        name: 'Drăgășani (Olt Cascade)',
        country: 'Romania', region: 'Vâlcea County',
        lat: 44.6817, lng: 24.2935,              // GEM exact
        upper_elevation_m: 148, lower_elevation_m: 130,
        head_m: 18,
        headM: 18,
        separationM: 500,
        capacity_mw: 45, storage_mwh: 135,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1980,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 45 MW (2 Kaplan turbines), commissioned 1980. Southernmost of the 12-plant middle Olt cascade near the wine-producing town of Drăgășani. Adjacent to the start of the lower Olt section (Strejești–Izbiceni, 8 plants, 379 MW).',
        source_url: 'https://www.gem.wiki/Dr%C4%83g%C4%83%C5%9Fani_hydroelectric_plant'
    },

    // ============================================================
    //  LOWER OLT CASCADE — 8 plants, 379 MW total
    //  Mix of Kaplan (Strejești/Arcești), Bulb, and reversible Bulb turbines
    //  The 5 plants Ipotești→Izbiceni use REVERSIBLE Bulb turbines —
    //  Romania's FIRST operational pumped-storage plants (inaugurated 2014).
    //  Pump mode: 200 MW total (40 MW each); turbine mode: ~278 MW total
    // ============================================================

    {
        id: 'ro_olt_strejesti',
        name: 'Strejești (Olt Cascade)',
        country: 'Romania', region: 'Olt County',
        lat: 44.5358, lng: 24.3223,              // GEM exact
        upper_elevation_m: 130, lower_elevation_m: 108,
        head_m: 22,
        headM: 22,
        separationM: 600,
        capacity_mw: 50, storage_mwh: 150,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1979,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 50 MW, commissioned 1979. Kaplan turbines. First of the 8-plant lower Olt cascade (379 MW total) administered by the Slatina Hydroelectric Branch. Slightly higher head than run-of-river average due to longer impoundment.',
        source_url: 'https://www.gem.wiki/Streje%C5%9Fti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_arcesti',
        name: 'Arcești (Olt Cascade)',
        country: 'Romania', region: 'Olt County',
        lat: 44.4472, lng: 24.3128,              // GEM exact
        upper_elevation_m: 108, lower_elevation_m: 88,
        head_m: 20,
        headM: 20,
        separationM: 600,
        capacity_mw: 38, storage_mwh: 114,
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1980,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 38 MW (2 Kaplan turbines), commissioned 1980. Modernisation contracted by Hidroelectrica in 2024 (along with Vaduri and Remeți). Part of lower Olt cascade (379 MW total).',
        source_url: 'https://www.gem.wiki/Arce%C8%99ti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_slatina',
        name: 'Slatina (Olt Cascade)',
        country: 'Romania', region: 'Olt County',
        lat: 44.427, lng: 24.372,                // est. — near Slatina city
        upper_elevation_m: 88, lower_elevation_m: 75,
        head_m: 13,
        headM: 13,
        separationM: 500,
        capacity_mw: 13, storage_mwh: 39,        // est.: 379 - (50+38+57+57+57+53+54) = 13 MW
        status: 'operational', isdam: false,
        configuration: 'run_of_river',
        year_commissioned: 1978,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'Olt cascade plant near Slatina (Olt county capital), equipped with 2 Bulb turbines. Administered by the Slatina Hydroelectric Branch. The Branch manages 8 plants on the lower Olt totalling 379 MW. Transition plant between Kaplan (Arcești) and reversible Bulb turbines (Ipotești–Izbiceni).',
        source_url: 'https://www.hidroelectrica.ro/article/39'
    },

    // --- 5 REVERSIBLE PUMPED-STORAGE PLANTS (Ipotești → Izbiceni) ---
    // Romania's first operational pumped-storage plants.
    // Each: 4 × reversible Bulb turbines (turbine / pump mode).
    // Pump mode aggregate: 200 MW (40 MW per plant).
    // Inaugurated as pumped storage: 2014.
    // Used for daily load balancing: pump at night, generate at peak.

    {
        id: 'ro_olt_ipotesti',
        name: 'Ipotești — Reversible PHES (Lower Olt)',
        country: 'Romania', region: 'Olt County',
        lat: 44.2641, lng: 24.4041,              // GEM exact
        upper_elevation_m: 75, lower_elevation_m: 62,
        head_m: 13,
        headM: 13,
        separationM: 14000,  // distance to next dam (Drăgănești) for pump reach
        capacity_mw: 57, storage_mwh: 228,
        status: 'operational', isdam: false,
        configuration: 'inline_pumped_storage',
        year_commissioned: 1988,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 57 MW (4 reversible Bulb turbines), commissioned 1988. One of Romania\'s first pumped-storage plants: pump mode 40 MW activated 2014. Pumps water upstream into the Slatina/Arcești reach at night; generates during peak demand. Head ~13 m (low-head run-of-river pumped storage). Part of the lower Olt cascade (379 MW total). Total reversible Bulb capacity for 5 plants: 278 MW turbine / 200 MW pump.',
        source_url: 'https://www.gem.wiki/Ipotesti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_draganesti',
        name: 'Drăgănești — Reversible PHES (Lower Olt)',
        country: 'Romania', region: 'Olt County',
        lat: 44.1637, lng: 24.4832,              // GEM exact
        upper_elevation_m: 62, lower_elevation_m: 50,
        head_m: 12,
        headM: 12,
        separationM: 13000,
        capacity_mw: 57, storage_mwh: 228,
        status: 'operational', isdam: false,
        configuration: 'inline_pumped_storage',
        year_commissioned: 1988,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 57 MW (4 reversible Bulb turbines), commissioned 1988. Romania\'s operational pumped storage — pump mode (40 MW) activated 2014. One of five identical reversible plants on the lower Olt between Slatina and the Danube.',
        source_url: 'https://www.gem.wiki/Dr%C4%83g%C4%83ne%C8%99ti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_frunzaru',
        name: 'Frunzaru — Reversible PHES (Lower Olt)',
        country: 'Romania', region: 'Olt County',
        lat: 44.0418, lng: 24.5744,              // GEM exact
        upper_elevation_m: 50, lower_elevation_m: 39,
        head_m: 11,
        headM: 11,
        separationM: 11000,
        capacity_mw: 57, storage_mwh: 228,
        status: 'operational', isdam: false,
        configuration: 'inline_pumped_storage',
        year_commissioned: 1990,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 57 MW (4 reversible Bulb turbines), commissioned 1990. Pumped-storage capability activated 2014 (40 MW pump). Part of five identical reversible plants on the lower Olt — Romania\'s first operational PHES.',
        source_url: 'https://www.gem.wiki/Frunzaru_hydroelectric_plant'
    },

    {
        id: 'ro_olt_rusanesti',
        name: 'Rusănești — Reversible PHES (Lower Olt)',
        country: 'Romania', region: 'Olt County',
        lat: 43.9163, lng: 24.6270,              // GEM exact
        upper_elevation_m: 39, lower_elevation_m: 30,
        head_m: 9,
        headM: 9,
        separationM: 10000,
        capacity_mw: 53, storage_mwh: 212,
        status: 'operational', isdam: false,
        configuration: 'inline_pumped_storage',
        year_commissioned: 1989,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 53 MW (4 reversible Bulb turbines), commissioned 1989. Pumped-storage capability activated 2014 (40 MW pump). One of five identical reversible plants on the lower Olt, Romania\'s first operational PHES system.',
        source_url: 'https://www.gem.wiki/Rusanesti_hydroelectric_plant'
    },

    {
        id: 'ro_olt_izbiceni',
        name: 'Izbiceni — Reversible PHES (Lower Olt)',
        country: 'Romania', region: 'Olt County',
        lat: 43.8122, lng: 24.6968,              // GEM exact
        upper_elevation_m: 30, lower_elevation_m: 22,
        head_m: 8,
        headM: 8,
        separationM: 9000,
        capacity_mw: 54, storage_mwh: 216,
        status: 'operational', isdam: false,
        configuration: 'inline_pumped_storage',
        year_commissioned: 1998,
        gem_river: 'Olt', gem_owner: 'Hidroelectrica',
        gem_technology: 'conventional_storage',
        description: 'GEM: Operating 54 MW (4 reversible Bulb turbines), commissioned 1998. Most downstream and youngest of the five reversible Bulb plants on the lower Olt. Pumping mode (40 MW) activated 2014. 9 km from Danube confluence. Anchor of Romania\'s first PHES system on the Olt.',
        source_url: 'https://www.gem.wiki/Izbiceni_hydroelectric_plant'
    }

];
