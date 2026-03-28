/**
 * Search Filters - parameter validation and constraint objects
 */
HB.SearchFilters = {
    /**
     * Create filter object from UI inputs
     */
    fromUI() {
        const energySlider = document.getElementById('energy-slider');
        const energyUnit = document.getElementById('energy-unit');
        const powerInput = document.getElementById('power-capacity');
        const powerUnit = document.getElementById('power-unit');

        const energyRaw = Math.pow(10, parseFloat(energySlider.value));
        const energyKWh = HB.Utils.energyToKWh(energyRaw, energyUnit.value);
        const powerKW = HB.Utils.powerToKW(parseFloat(powerInput.value), powerUnit.value);

        return {
            energyKWh,
            powerKW,
            configuration: HB.State.selectedConfig,
            searchRadiusM: parseFloat(document.getElementById('search-radius').value) * 1000,
            minHeadM: parseFloat(document.getElementById('min-head').value),
            maxTunnelM: parseFloat(document.getElementById('max-tunnel').value) * 1000,
            efficiency: parseFloat(document.getElementById('round-trip-eff').value) / 100
        };
    },

    /**
     * Validate a candidate site pair against filters
     */
    validate(upperElev, lowerElev, distance, filters) {
        const headHeight = upperElev - lowerElev;
        if (headHeight < filters.minHeadM) return null;
        if (distance > filters.maxTunnelM) return null;

        // Head-to-distance ratio (steepness check)
        const ratio = headHeight / distance;
        if (ratio < 0.02) return null; // Too flat

        // Volume feasibility
        const density = filters.configuration === 'lake_ocean' ?
            HB.Config.SEAWATER_DENSITY : HB.Config.WATER_DENSITY;
        const volume = HB.Geo.requiredVolume(
            filters.energyKWh, headHeight, filters.efficiency, density
        );

        // Max practical reservoir volume check (10 km³)
        if (volume > 10e9) return null;

        const tunnelLength = HB.Geo.tunnelLength(distance, headHeight);

        return {
            headHeight,
            tunnelLength,
            horizontalDistance: distance,
            volume,
            ratio
        };
    }
};
