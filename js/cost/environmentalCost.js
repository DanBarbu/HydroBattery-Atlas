/**
 * Environmental, Permitting & Soft Costs Model
 */
HB.Cost = HB.Cost || {};

HB.Cost.environmental = {
    /**
     * Calculate environmental and soft costs
     * @param {Object} params
     * @param {number} params.constructionSubtotal - Sum of all construction costs
     * @param {number} params.capacityMW
     * @param {number} params.constructionYears
     * @param {number} params.discountRate
     * @returns {Object}
     */
    calculate(params) {
        const { constructionSubtotal, capacityMW, constructionYears, discountRate } = params;
        const C = HB.Config.COST;

        const years = constructionYears || HB.State.constructionYears;
        const rate = discountRate || HB.State.discountRate;

        // Environmental Impact Assessment
        const eiaCost = C.EIA_COST * this._projectScaleFactor(capacityMW);

        // Permitting and regulatory approvals
        const permittingCost = C.PERMITTING_COST * this._projectScaleFactor(capacityMW);

        // Engineering, procurement, project management
        const engineeringCost = constructionSubtotal * C.ENGINEERING_FRACTION;

        // Contingency
        const subtotalBeforeContingency = constructionSubtotal + eiaCost + permittingCost + engineeringCost;
        const contingencyCost = subtotalBeforeContingency * C.CONTINGENCY_FRACTION;

        // Interest during construction (IDC)
        const idcCost = this._calculateIDC(constructionSubtotal, years, rate);

        // Insurance during construction
        const insuranceCost = constructionSubtotal * 0.01 * years;

        // Owner's costs (legal, admin, etc.)
        const ownersCost = constructionSubtotal * 0.03;

        return {
            environmentalAssessment: Math.round(eiaCost),
            permitting: Math.round(permittingCost),
            engineering: Math.round(engineeringCost),
            contingency: Math.round(contingencyCost),
            interestDuringConstruction: Math.round(idcCost),
            insurance: Math.round(insuranceCost),
            ownersCosts: Math.round(ownersCost),
            total: Math.round(eiaCost + permittingCost + engineeringCost +
                            contingencyCost + idcCost + insuranceCost + ownersCost),
            details: {
                constructionYears: years,
                discountRate: (rate * 100).toFixed(1) + '%',
                contingencyRate: (C.CONTINGENCY_FRACTION * 100).toFixed(0) + '%'
            }
        };
    },

    /**
     * Project scale factor for EIA/permitting
     */
    _projectScaleFactor(capacityMW) {
        if (capacityMW < 50) return 0.5;
        if (capacityMW < 200) return 1.0;
        if (capacityMW < 500) return 1.5;
        return 2.0;
    },

    /**
     * Interest During Construction (simplified)
     * Assumes linear spend over construction period
     */
    _calculateIDC(totalCost, years, rate) {
        // Average outstanding balance = totalCost / 2 (linear draw)
        // IDC = avg_balance * rate * years
        return (totalCost / 2) * rate * years;
    }
};
