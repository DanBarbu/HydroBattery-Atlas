/**
 * Configuration Type Definitions and Modifiers
 */
HB.Data = HB.Data || {};

HB.Data.configurations = {
    lake_pair: {
        id: 'lake_pair',
        name: 'Lake Pair',
        description: 'Two reservoirs at different elevations connected by tunnel/penstock',
        icon: 'lake_pair',
        costModifiers: {
            damFactor: 1.0,
            tunnelFactor: 1.0,
            powerhouseFactor: 1.0,
            corrosionFactor: 1.0
        },
        constraints: {
            minHead: 50,
            maxHead: 2000,
            minTunnel: 200,
            maxTunnel: 30000,
            waterDensity: 1000
        },
        suitability: {
            terrain: ['hilly', 'mountainous'],
            description: 'Best for hilly or mountainous terrain with natural depressions or valleys for reservoirs.'
        }
    },

    lake_ocean: {
        id: 'lake_ocean',
        name: 'Lake-Ocean',
        description: 'Upper reservoir at elevation, ocean as lower reservoir (infinite volume)',
        icon: 'lake_ocean',
        costModifiers: {
            damFactor: 0.6,        // Only one dam
            tunnelFactor: 1.15,     // Corrosion-resistant materials
            powerhouseFactor: 1.10, // Seawater-rated equipment
            corrosionFactor: 1.15   // Seawater corrosion premium
        },
        constraints: {
            minHead: 30,
            maxHead: 1000,
            minTunnel: 100,
            maxTunnel: 5000,
            waterDensity: 1025
        },
        suitability: {
            terrain: ['coastal', 'hilly'],
            description: 'Ideal for coastal areas with nearby elevated terrain. No lower dam needed.'
        }
    },

    lake_underground: {
        id: 'lake_underground',
        name: 'Underground Reservoir',
        description: 'Surface reservoir with underground cavern as lower reservoir',
        icon: 'lake_underground',
        costModifiers: {
            damFactor: 0.5,        // Only surface dam
            tunnelFactor: 0.7,     // Shorter tunnel (vertical shaft)
            powerhouseFactor: 1.3, // Underground powerhouse
            corrosionFactor: 1.0
        },
        constraints: {
            minHead: 100,
            maxHead: 1500,
            minTunnel: 100,
            maxTunnel: 2000,
            waterDensity: 1000
        },
        suitability: {
            terrain: ['any'],
            description: 'Can work in flat terrain. Requires suitable geology for underground cavern excavation.'
        }
    },

    mine_void: {
        id: 'mine_void',
        name: 'Mine Void',
        description: 'Repurposed open-pit or underground mine voids',
        icon: 'mine_void',
        costModifiers: {
            damFactor: 0.35,       // Existing pit walls, minimal dam work
            tunnelFactor: 0.8,     // Often shorter distances
            powerhouseFactor: 1.0,
            corrosionFactor: 1.05  // Potential acid mine drainage
        },
        constraints: {
            minHead: 30,
            maxHead: 1500,
            minTunnel: 100,
            maxTunnel: 5000,
            waterDensity: 1000
        },
        suitability: {
            terrain: ['any'],
            description: 'Uses existing mine infrastructure. Lower capital cost but site-specific geological risks.'
        },
        additionalCosts: {
            pitWallReinforcement: true,
            dewatering: true,
            waterTreatment: true,
            environmentalRemediation: true
        }
    }
};

/**
 * Get configuration parameters
 */
HB.Data.getConfiguration = function(configId) {
    return HB.Data.configurations[configId] || HB.Data.configurations.lake_pair;
};
