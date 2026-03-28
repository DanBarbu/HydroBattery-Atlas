/**
 * Electrical Infrastructure Cost Model
 */
HB.Cost = HB.Cost || {};

HB.Cost.electrical = {
    /**
     * Calculate electrical infrastructure costs
     * @param {Object} params
     * @param {number} params.capacityMW - Plant capacity (MW)
     * @param {number} params.transmissionDistanceKm - Distance to grid connection (km)
     * @param {number} params.turbineGenCost - Turbine-generator cost (for switchgear %)
     * @returns {Object} Cost breakdown
     */
    calculate(params) {
        const { capacityMW, transmissionDistanceKm, turbineGenCost } = params;
        const C = HB.Config.COST;

        const capacityKVA = capacityMW * 1000 * 1.1; // 10% oversize for reactive power

        // Step-up transformers
        const transformerCost = capacityKVA * C.TRANSFORMER_PER_KVA;

        // Switchgear and protection systems
        const switchgearCost = (turbineGenCost || 0) * C.SWITCHGEAR_FRACTION;

        // Transmission line
        const txDist = transmissionDistanceKm || this._estimateTransmissionDistance(capacityMW);
        const transmissionCost = txDist * C.TRANSMISSION_PER_KM;

        // Grid connection and interconnection studies
        const gridConnectionCost = C.GRID_CONNECTION_FIXED *
            (1 + Math.log10(Math.max(1, capacityMW / 100)));

        // SCADA and control room
        const scadaCost = 1500000 + capacityMW * 2000;

        // Cables and bus bars
        const cablesCost = capacityMW * 5000;

        return {
            transformers: Math.round(transformerCost),
            switchgear: Math.round(switchgearCost),
            transmissionLine: Math.round(transmissionCost),
            gridConnection: Math.round(gridConnectionCost),
            scada: Math.round(scadaCost),
            cables: Math.round(cablesCost),
            total: Math.round(transformerCost + switchgearCost + transmissionCost +
                            gridConnectionCost + scadaCost + cablesCost),
            details: {
                capacityKVA: Math.round(capacityKVA),
                transmissionDistanceKm: txDist.toFixed(1),
                voltage: this._selectVoltage(capacityMW)
            }
        };
    },

    /**
     * Estimate transmission distance if not provided
     */
    _estimateTransmissionDistance(capacityMW) {
        // Larger plants tend to be in more remote areas
        if (capacityMW < 50) return 5;
        if (capacityMW < 200) return 15;
        if (capacityMW < 500) return 25;
        return 40;
    },

    /**
     * Select transmission voltage based on capacity
     */
    _selectVoltage(capacityMW) {
        if (capacityMW < 50) return '66 kV';
        if (capacityMW < 200) return '132 kV';
        if (capacityMW < 500) return '220 kV';
        return '330+ kV';
    }
};
