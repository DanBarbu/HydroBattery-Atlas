/**
 * Powerhouse & Electromechanical Equipment Cost Model
 *
 * Based on NREL/ORNL regression formulas for pump-turbines,
 * generators, and powerhouse structures.
 */
HB.Cost = HB.Cost || {};

HB.Cost.powerhouse = {
    /**
     * Calculate powerhouse and electromechanical costs
     * @param {Object} params
     * @param {number} params.capacityMW - Total installed capacity (MW)
     * @param {number} params.headHeight - Net head (m)
     * @param {number} params.numUnits - Number of pump-turbine units
     * @param {boolean} params.underground - Underground powerhouse?
     * @param {boolean} params.variableSpeed - Variable-speed units?
     * @returns {Object} Cost breakdown
     */
    calculate(params) {
        const { capacityMW, headHeight, numUnits, underground, variableSpeed } = params;
        const C = HB.Config.COST;

        const units = numUnits || this._optimalUnits(capacityMW);
        const unitCapacity = capacityMW / units;

        // Turbine type selection based on head
        const turbineType = this._selectTurbineType(headHeight);

        // Pump-turbine cost per kW
        // C_tg = COEFF * P^POW_EXP * H^HEAD_EXP
        let costPerKW = C.TURBINE_COEFF *
            Math.pow(unitCapacity, C.TURBINE_POW_EXP) *
            Math.pow(headHeight, C.TURBINE_HEAD_EXP);

        // Variable speed premium
        if (variableSpeed) {
            costPerKW *= C.VARIABLE_SPEED_PREMIUM;
        }

        // Turbine type adjustment
        costPerKW *= this._turbineTypeFactor(turbineType);

        const totalCapacityKW = capacityMW * 1000;
        const turbineGenCost = costPerKW * totalCapacityKW;

        // Powerhouse structure
        const powerhouseCost = this._powerhouseStructureCost(capacityMW, units, underground);

        // Governor and control systems
        const governorCost = 200000 * units; // ~$200K per unit

        // Cooling and auxiliary systems
        const auxiliaryCost = totalCapacityKW * 15; // ~$15/kW

        return {
            turbineGenerator: Math.round(turbineGenCost),
            powerhouseStructure: Math.round(powerhouseCost),
            governors: Math.round(governorCost),
            auxiliarySystems: Math.round(auxiliaryCost),
            total: Math.round(turbineGenCost + powerhouseCost + governorCost + auxiliaryCost),
            details: {
                turbineType,
                numUnits: units,
                unitCapacityMW: unitCapacity.toFixed(1),
                costPerKW: Math.round(costPerKW),
                variableSpeed: !!variableSpeed,
                underground: !!underground
            }
        };
    },

    /**
     * Select turbine type based on head height
     */
    _selectTurbineType(head) {
        if (head < 30) return 'kaplan';
        if (head < 400) return 'francis';
        return 'pelton';
    },

    /**
     * Turbine type cost adjustment factor
     */
    _turbineTypeFactor(type) {
        switch (type) {
            case 'kaplan':  return 1.15; // More complex reversible
            case 'francis': return 1.0;  // Standard for PHES
            case 'pelton':  return 1.1;  // High head specialty
            default:        return 1.0;
        }
    },

    /**
     * Optimal number of units based on capacity
     */
    _optimalUnits(capacityMW) {
        if (capacityMW <= 50) return 1;
        if (capacityMW <= 200) return 2;
        if (capacityMW <= 500) return 3;
        if (capacityMW <= 1000) return 4;
        return Math.ceil(capacityMW / 300);
    },

    /**
     * Powerhouse structure cost
     */
    _powerhouseStructureCost(capacityMW, numUnits, underground) {
        // Estimate cavern/building volume
        // Typical: 20m x 15m x 30m per 100MW unit
        const volumePerUnit = 20 * 15 * 30 * (capacityMW / (numUnits * 100));
        const totalVolume = volumePerUnit * numUnits;

        if (underground) {
            return totalVolume * HB.Config.COST.UNDERGROUND_CAVERN_PER_M3;
        } else {
            return totalVolume * HB.Config.COST.UNDERGROUND_CAVERN_PER_M3 *
                   HB.Config.COST.SURFACE_POWERHOUSE_FACTOR;
        }
    }
};
