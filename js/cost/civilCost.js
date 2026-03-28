/**
 * Civil Works & Access Infrastructure Cost Model
 */
HB.Cost = HB.Cost || {};

HB.Cost.civil = {
    /**
     * Calculate civil works costs
     * @param {Object} params
     * @param {number} params.capacityMW - Plant capacity
     * @param {number} params.accessRoadKm - Access road length (km)
     * @param {number} params.landAreaHa - Land area required (hectares)
     * @param {string} params.terrain - 'flat', 'hilly', 'mountainous'
     * @param {string} params.region - Country/region for land cost
     * @param {number} params.constructionSubtotal - Subtotal for site prep %
     * @returns {Object}
     */
    calculate(params) {
        const { capacityMW, accessRoadKm, landAreaHa, terrain, constructionSubtotal } = params;
        const C = HB.Config.COST;

        // Access roads
        const roadLength = accessRoadKm || this._estimateRoadLength(capacityMW, terrain);
        const terrainFactor = this._terrainFactor(terrain);
        const accessRoadCost = roadLength * C.ACCESS_ROAD_PER_KM * terrainFactor;

        // Site preparation
        const sitePrepCost = (constructionSubtotal || 0) * C.SITE_PREP_FRACTION;

        // Land acquisition
        const area = landAreaHa || this._estimateLandArea(capacityMW);
        const landCost = area * C.LAND_PER_HECTARE;

        // Construction camp and facilities (for remote sites)
        const campCost = this._constructionCampCost(capacityMW, terrain);

        // Mobilization and demobilization
        const mobilizationCost = (capacityMW * 1000 * 20); // ~$20/kW

        return {
            accessRoads: Math.round(accessRoadCost),
            sitePreparation: Math.round(sitePrepCost),
            landAcquisition: Math.round(landCost),
            constructionCamp: Math.round(campCost),
            mobilization: Math.round(mobilizationCost),
            total: Math.round(accessRoadCost + sitePrepCost + landCost + campCost + mobilizationCost),
            details: {
                accessRoadKm: roadLength.toFixed(1),
                landAreaHa: area.toFixed(0),
                terrainFactor: terrainFactor.toFixed(2)
            }
        };
    },

    _terrainFactor(terrain) {
        switch (terrain) {
            case 'flat':        return 0.8;
            case 'hilly':       return 1.0;
            case 'mountainous': return 1.5;
            default:            return 1.0;
        }
    },

    _estimateRoadLength(capacityMW, terrain) {
        let base = 3; // km minimum
        if (capacityMW > 100) base = 5;
        if (capacityMW > 500) base = 10;
        if (terrain === 'mountainous') base *= 1.5;
        return base;
    },

    _estimateLandArea(capacityMW) {
        // Very rough: ~5 ha per 100MW + reservoir area
        return 5 + capacityMW * 0.05;
    },

    _constructionCampCost(capacityMW, terrain) {
        if (terrain === 'flat' && capacityMW < 100) return 2000000;
        if (capacityMW < 100) return 5000000;
        if (capacityMW < 500) return 10000000;
        return 15000000;
    }
};
