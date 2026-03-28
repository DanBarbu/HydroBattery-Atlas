/**
 * Geographic Utility Functions
 */
HB.Geo = {
    /**
     * Haversine distance between two points in meters
     */
    distance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth radius in meters
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    /**
     * Bearing from point 1 to point 2 in degrees
     */
    bearing(lat1, lng1, lat2, lng2) {
        const dLng = this.toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(this.toRad(lat2));
        const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
                  Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLng);
        return (this.toDeg(Math.atan2(y, x)) + 360) % 360;
    },

    /**
     * Destination point given start, bearing (degrees), and distance (meters)
     */
    destination(lat, lng, bearing, distance) {
        const R = 6371000;
        const d = distance / R;
        const brng = this.toRad(bearing);
        const lat1 = this.toRad(lat);
        const lng1 = this.toRad(lng);

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
        );
        const lng2 = lng1 + Math.atan2(
            Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );

        return { lat: this.toDeg(lat2), lng: this.toDeg(lng2) };
    },

    /**
     * Generate a grid of points within a radius of a center point
     * @param {number} centerLat
     * @param {number} centerLng
     * @param {number} radius - in meters
     * @param {number} spacing - grid spacing in meters
     * @returns {Array<{lat, lng}>}
     */
    generateGrid(centerLat, centerLng, radius, spacing) {
        const points = [];
        const latSpacing = (spacing / 111320); // degrees latitude per meter
        const lngSpacing = spacing / (111320 * Math.cos(this.toRad(centerLat)));

        const latSteps = Math.ceil(radius / spacing);
        const lngSteps = Math.ceil(radius / spacing);

        for (let i = -latSteps; i <= latSteps; i++) {
            for (let j = -lngSteps; j <= lngSteps; j++) {
                const lat = centerLat + i * latSpacing;
                const lng = centerLng + j * lngSpacing;
                // Check if within radius
                if (this.distance(centerLat, centerLng, lat, lng) <= radius) {
                    points.push({ lat, lng });
                }
            }
        }
        return points;
    },

    /**
     * Calculate tunnel length accounting for slope
     */
    tunnelLength(horizontalDist, elevationDiff) {
        return Math.sqrt(horizontalDist ** 2 + elevationDiff ** 2);
    },

    /**
     * Calculate required water volume for energy storage
     * E = rho * g * h * V * eta / 3,600,000
     * V = E * 3,600,000 / (rho * g * h * eta)
     */
    requiredVolume(energyKWh, headM, efficiency, density) {
        density = density || HB.Config.WATER_DENSITY;
        efficiency = efficiency || HB.Config.DEFAULT_EFFICIENCY;
        return (energyKWh * HB.Config.KWH_TO_JOULES) /
               (density * HB.Config.GRAVITY * headM * efficiency);
    },

    /**
     * Calculate energy from volume and head
     */
    energyFromVolume(volumeM3, headM, efficiency, density) {
        density = density || HB.Config.WATER_DENSITY;
        efficiency = efficiency || HB.Config.DEFAULT_EFFICIENCY;
        return (density * HB.Config.GRAVITY * headM * volumeM3 * efficiency) /
               HB.Config.KWH_TO_JOULES;
    },

    /**
     * Calculate flow rate from power and head
     * Q = P / (rho * g * h * eta)
     */
    flowRate(powerKW, headM, efficiency, density) {
        density = density || HB.Config.WATER_DENSITY;
        efficiency = efficiency || HB.Config.DEFAULT_TURBINE_EFFICIENCY;
        const powerW = powerKW * 1000;
        return powerW / (density * HB.Config.GRAVITY * headM * efficiency);
    },

    /**
     * Calculate penstock diameter for economic flow velocity
     * D = sqrt(4 * Q / (pi * v_max))
     */
    penstockDiameter(flowRateM3s) {
        return Math.sqrt((4 * flowRateM3s) /
               (Math.PI * HB.Config.MAX_FLOW_VELOCITY));
    },

    /**
     * Friction head loss (Darcy-Weisbach)
     * h_f = f * (L/D) * (v² / 2g)
     */
    frictionLoss(length, diameter, velocity, frictionFactor) {
        frictionFactor = frictionFactor || HB.Config.FRICTION_FACTOR_STEEL;
        return frictionFactor * (length / diameter) *
               (velocity ** 2 / (2 * HB.Config.GRAVITY));
    },

    /**
     * Net head = gross head - friction losses
     */
    netHead(grossHead, tunnelLength, diameter, flowRate) {
        const velocity = flowRate / (Math.PI * (diameter / 2) ** 2);
        const loss = this.frictionLoss(tunnelLength, diameter, velocity);
        return grossHead - loss;
    },

    /**
     * Storage duration in hours
     */
    storageDuration(energyKWh, powerKW) {
        if (powerKW <= 0) return 0;
        return energyKWh / powerKW;
    },

    /**
     * Estimate reservoir surface area from volume (simplified bowl model)
     * Assumes average depth of 10m for surface reservoirs
     */
    reservoirArea(volumeM3, avgDepth) {
        avgDepth = avgDepth || 10;
        return volumeM3 / avgDepth;
    },

    /**
     * Estimate dam height needed to create a reservoir of given volume
     * Using simplified valley geometry
     */
    estimateDamHeight(volumeM3, valleyWidth) {
        valleyWidth = valleyWidth || 200;
        // V ≈ (1/3) * H * W * L where L ≈ 3*H for typical valley
        // V ≈ H² * W
        return Math.sqrt(volumeM3 / valleyWidth);
    },

    toRad(deg) { return deg * Math.PI / 180; },
    toDeg(rad) { return rad * 180 / Math.PI; }
};
