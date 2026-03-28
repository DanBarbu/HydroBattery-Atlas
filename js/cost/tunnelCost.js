/**
 * Tunnel & Penstock Cost Model
 */
HB.Cost = HB.Cost || {};

HB.Cost.tunnel = {
    /**
     * Calculate tunnel/penstock costs
     * @param {Object} params
     * @param {number} params.tunnelLength - Total tunnel length (m)
     * @param {number} params.penstockDiameter - Required diameter (m)
     * @param {number} params.headHeight - Head height (m)
     * @param {string} params.geology - 'good', 'mixed', 'poor'
     * @param {boolean} params.verticalShaft - Whether a vertical shaft is needed
     * @param {number} params.shaftDepth - Vertical shaft depth if applicable (m)
     * @returns {Object} Cost breakdown
     */
    calculate(params) {
        const { tunnelLength, penstockDiameter, headHeight, geology, verticalShaft, shaftDepth } = params;
        const C = HB.Config.COST;

        // Geology factor
        let geoFactor;
        switch (geology) {
            case 'good': geoFactor = C.GEOLOGY_FACTOR_GOOD; break;
            case 'poor': geoFactor = C.GEOLOGY_FACTOR_POOR; break;
            default:     geoFactor = C.GEOLOGY_FACTOR_MIXED;
        }

        // Reference diameter for base cost (3m)
        const refDiameter = 3.0;
        const diameterRatio = Math.max(1, penstockDiameter / refDiameter);

        // Tunnel excavation cost
        // Scales with cross-sectional area (D²)
        const tunnelCostPerM = C.TUNNEL_BASE_PER_M * Math.pow(diameterRatio, C.TUNNEL_DIAMETER_EXPONENT) * geoFactor;
        const tunnelExcavation = tunnelLength * tunnelCostPerM;

        // Steel penstock lining cost
        // Only for high-pressure sections (typically last portion near powerhouse)
        const penstockLength = Math.min(tunnelLength, headHeight * 2); // High-pressure section
        const linerCostPerM = C.STEEL_LINER_PER_M * diameterRatio * this._pressureFactor(headHeight);
        const penstockLining = penstockLength * linerCostPerM;

        // Vertical shaft (if needed)
        let shaftCost = 0;
        if (verticalShaft && shaftDepth > 0) {
            const shaftCostPerM = tunnelCostPerM * C.VERTICAL_SHAFT_PREMIUM;
            shaftCost = shaftDepth * shaftCostPerM;
        }

        // Surge tank (for long tunnels or high head)
        const surgeTankCost = this._surgeTankCost(tunnelLength, penstockDiameter, headHeight);

        // Valves and fittings
        const valvesCost = this._valvesCost(penstockDiameter, headHeight);

        return {
            tunnelExcavation: Math.round(tunnelExcavation),
            penstockLining: Math.round(penstockLining),
            verticalShaft: Math.round(shaftCost),
            surgeTank: Math.round(surgeTankCost),
            valves: Math.round(valvesCost),
            total: Math.round(tunnelExcavation + penstockLining + shaftCost + surgeTankCost + valvesCost),
            details: {
                tunnelLength: Math.round(tunnelLength),
                penstockDiameter: penstockDiameter.toFixed(2),
                costPerMeter: Math.round(tunnelCostPerM),
                geologyFactor: geoFactor,
                penstockLength: Math.round(penstockLength)
            }
        };
    },

    /**
     * Pressure factor for penstock steel thickness
     * Higher head = thicker walls = higher cost
     */
    _pressureFactor(headHeight) {
        if (headHeight <= 200) return 1.0;
        if (headHeight <= 500) return 1.3;
        if (headHeight <= 1000) return 1.6;
        return 2.0;
    },

    /**
     * Surge tank cost for water hammer protection
     */
    _surgeTankCost(tunnelLength, diameter, headHeight) {
        // Needed for tunnels > 2km or head > 300m
        if (tunnelLength < 2000 && headHeight < 300) return 0;

        // Tank volume proportional to tunnel volume and head
        const tunnelVolume = Math.PI * (diameter / 2) ** 2 * tunnelLength;
        const tankVolume = tunnelVolume * 0.1; // 10% of tunnel volume
        const costPerM3 = 2000; // steel tank
        return tankVolume * costPerM3;
    },

    /**
     * Main valves and fittings
     */
    _valvesCost(diameter, headHeight) {
        // Butterfly valves, spherical valves for high head
        const baseCost = 500000; // $500K base
        const sizeFactor = Math.pow(diameter / 3, 2);
        const pressureFactor = this._pressureFactor(headHeight);
        return baseCost * sizeFactor * pressureFactor * 2; // 2 main valves
    }
};
