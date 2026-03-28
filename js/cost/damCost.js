/**
 * Dam & Reservoir Construction Cost Model
 *
 * Based on NREL bottom-up PSH cost model and ORNL baseline data.
 * Supports RCC, earthfill, rockfill dams and mine void preparation.
 */
HB.Cost = HB.Cost || {};

HB.Cost.dam = {
    /**
     * Calculate dam and reservoir costs
     * @param {Object} params
     * @param {number} params.volume - Active water volume (m³)
     * @param {number} params.headHeight - Head height / dam height proxy (m)
     * @param {string} params.damType - 'rcc', 'earthfill', 'rockfill'
     * @param {string} params.configuration - 'lake_pair', 'lake_ocean', 'mine_void', 'lake_underground'
     * @param {number} params.damCount - Number of dams needed (1 or 2)
     * @returns {Object} Cost breakdown
     */
    calculate(params) {
        const { volume, headHeight, damType, configuration, damCount } = params;
        const C = HB.Config.COST;

        // Estimate dam dimensions
        const damHeight = Math.min(headHeight, this._estimateDamHeight(volume));
        const crestLength = this._estimateCrestLength(volume, damHeight);
        const damBodyVolume = this._damBodyVolume(damHeight, crestLength, damType);

        // Unit cost per m³ of dam body
        let unitCost;
        switch (damType) {
            case 'rcc':       unitCost = C.DAM_RCC_PER_M3; break;
            case 'earthfill': unitCost = C.DAM_EARTHFILL_PER_M3; break;
            case 'rockfill':  unitCost = C.DAM_ROCKFILL_PER_M3; break;
            default:          unitCost = C.DAM_EARTHFILL_PER_M3;
        }

        // Economy of scale
        const scaleFactor = Math.pow(damBodyVolume / 100000, C.SCALE_EXPONENT - 1);
        const adjustedUnitCost = unitCost * Math.max(0.5, Math.min(2.0, scaleFactor));

        let singleDamCost = damBodyVolume * adjustedUnitCost;
        let totalDamCost;

        // Configuration adjustments
        if (configuration === 'mine_void') {
            // Mine void: reduced cost for pit wall reinforcement
            totalDamCost = singleDamCost * C.DAM_MINE_PREP_FACTOR * (damCount || 2);
        } else if (configuration === 'lake_ocean') {
            // Ocean config: only upper dam needed, but seawater intake structure
            totalDamCost = singleDamCost + this._seawaterIntakeCost(params);
        } else if (configuration === 'lake_underground') {
            // Underground: surface dam + cavern cost (cavern handled separately)
            totalDamCost = singleDamCost;
        } else {
            // Lake pair: potentially two dams
            totalDamCost = singleDamCost * (damCount || 2);
        }

        // Reservoir liner (if needed for new reservoirs on permeable ground)
        const surfaceArea = HB.Geo.reservoirArea(volume);
        const linerCost = surfaceArea * C.GEOMEMBRANE_PER_M2 * 0.5; // 50% chance liner needed

        // Reservoir excavation (for new reservoirs)
        const excavationVolume = volume * 0.3; // Assume 30% excavation needed
        const excavationCost = excavationVolume * C.EXCAVATION_PER_M3;

        return {
            damConstruction: Math.round(totalDamCost),
            reservoirLiner: Math.round(linerCost),
            reservoirExcavation: Math.round(excavationCost),
            total: Math.round(totalDamCost + linerCost + excavationCost),
            details: {
                damHeight: Math.round(damHeight),
                crestLength: Math.round(crestLength),
                damBodyVolume: Math.round(damBodyVolume),
                damType,
                unitCostPerM3: Math.round(adjustedUnitCost)
            }
        };
    },

    /**
     * Estimate dam height from volume (simplified)
     * For a valley reservoir: V ≈ H² * W_avg, so H ≈ sqrt(V / W)
     */
    _estimateDamHeight(volume) {
        const valleyWidth = 200 + Math.sqrt(volume) * 0.01;
        return Math.max(10, Math.sqrt(volume / valleyWidth));
    },

    /**
     * Estimate dam crest length
     */
    _estimateCrestLength(volume, height) {
        // Typical crest length 2-5x the dam height
        return Math.max(50, height * 3 + Math.sqrt(volume) * 0.005);
    },

    /**
     * Calculate dam body volume using trapezoidal cross-section
     * Base width = height * slope_ratio, crest width = 5-10m
     */
    _damBodyVolume(height, crestLength, damType) {
        let slopeRatio;
        let crestWidth;
        switch (damType) {
            case 'rcc':
                slopeRatio = 0.8; // steeper
                crestWidth = 6;
                break;
            case 'earthfill':
                slopeRatio = 3.0; // gentle slopes
                crestWidth = 8;
                break;
            case 'rockfill':
                slopeRatio = 1.5;
                crestWidth = 7;
                break;
            default:
                slopeRatio = 2.0;
                crestWidth = 7;
        }

        const baseWidth = crestWidth + 2 * slopeRatio * height;
        const crossArea = 0.5 * (crestWidth + baseWidth) * height;
        return crossArea * crestLength;
    },

    /**
     * Seawater intake/outfall structure cost
     */
    _seawaterIntakeCost(params) {
        // Base cost for intake + outfall + corrosion protection
        const baseCost = 8000000; // $8M base
        const volumeFactor = Math.pow(params.volume / 1e6, 0.4) * 2000000;
        return baseCost + volumeFactor;
    }
};
