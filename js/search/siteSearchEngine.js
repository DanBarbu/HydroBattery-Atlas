/**
 * Site Search Engine - finds suitable pumped hydro sites
 *
 * Four-phase algorithm:
 * 1. Grid sampling - fetch elevation over search area
 * 2. Candidate pair generation - find high/low pairs
 * 3. Volume feasibility check
 * 4. Cost estimation and ranking
 */
HB.Search = {
    _running: false,
    _cancelled: false,

    /**
     * Run site search
     * @param {number} centerLat
     * @param {number} centerLng
     * @param {Object} filters - from HB.SearchFilters.fromUI()
     * @param {Function} onProgress - callback(phase, percent, message)
     * @returns {Promise<Array>} Ranked results
     */
    async run(centerLat, centerLng, filters, onProgress) {
        if (this._running) {
            this.cancel();
            await new Promise(r => setTimeout(r, 100));
        }
        this._running = true;
        this._cancelled = false;

        const results = [];

        try {
            // Phase 1: Grid sampling
            onProgress(1, 0, 'Sampling elevation data...');
            const gridPoints = HB.Geo.generateGrid(
                centerLat, centerLng,
                filters.searchRadiusM,
                HB.Config.COARSE_GRID_SPACING
            );

            // Fetch elevations in batches
            const totalPoints = gridPoints.length;
            const elevations = [];
            const batchSize = HB.Config.ELEVATION_BATCH_SIZE;

            for (let i = 0; i < totalPoints; i += batchSize) {
                if (this._cancelled) return [];
                const batch = gridPoints.slice(i, i + batchSize);
                const batchElevs = await HB.Elevation.getElevationBatch(batch);
                elevations.push(...batchElevs);
                onProgress(1, Math.round((i + batch.length) / totalPoints * 100),
                    `Scanning elevation: ${elevations.length}/${totalPoints} points`);
            }

            // Build elevation map
            const elevMap = gridPoints.map((p, i) => ({
                lat: p.lat,
                lng: p.lng,
                elevation: elevations[i]
            })).filter(p => p.elevation !== null);

            if (elevMap.length < 10) {
                onProgress(2, 100, 'Insufficient elevation data in area');
                return [];
            }

            // Phase 2: Candidate pair generation
            onProgress(2, 0, 'Finding reservoir pairs...');
            const candidates = this._findPairs(elevMap, filters, (pct, msg) => {
                onProgress(2, pct, msg);
            });

            if (candidates.length === 0) {
                onProgress(3, 100, 'No suitable sites found');
                return [];
            }

            // Phase 3: Volume feasibility (already checked in _findPairs)
            onProgress(3, 50, `Evaluating ${candidates.length} candidates...`);

            // Phase 4: Cost estimation and ranking
            onProgress(4, 0, 'Estimating costs...');
            for (let i = 0; i < candidates.length; i++) {
                if (this._cancelled) return [];
                const c = candidates[i];

                const costResult = HB.Cost.engine.quickEstimate(
                    c.headHeight, c.tunnelLength,
                    filters.energyKWh, filters.powerKW,
                    filters.configuration
                );

                results.push({
                    id: `search_${i}`,
                    upper: { lat: c.upper.lat, lng: c.upper.lng, elevation: c.upper.elevation },
                    lower: { lat: c.lower.lat, lng: c.lower.lng, elevation: c.lower.elevation },
                    headHeight: c.headHeight,
                    tunnelLength: c.tunnelLength,
                    horizontalDistance: c.horizontalDistance,
                    volume: c.volume,
                    energyKWh: filters.energyKWh,
                    powerKW: filters.powerKW,
                    configuration: filters.configuration,
                    efficiency: filters.efficiency,
                    costEstimate: costResult,
                    name: `Site ${i + 1}`
                });

                onProgress(4, Math.round((i + 1) / candidates.length * 100),
                    `Costing: ${i + 1}/${candidates.length}`);
            }

            // Sort by cost per kWh
            results.sort((a, b) => a.costEstimate.costPerKWh - b.costEstimate.costPerKWh);

            // Limit to top 50
            const topResults = results.slice(0, 50);

            // Assign ranks
            topResults.forEach((r, i) => {
                r.rank = i + 1;
                r.name = `Site #${i + 1}`;
            });

            onProgress(4, 100, `Found ${topResults.length} sites`);
            return topResults;

        } finally {
            this._running = false;
        }
    },

    /**
     * Find upper/lower reservoir pairs from elevation grid
     */
    _findPairs(elevMap, filters, onProgress) {
        const candidates = [];
        const maxDist = filters.maxTunnelM;
        const minHead = filters.minHeadM;

        // Sort by elevation descending to find upper reservoirs first
        const sorted = [...elevMap].sort((a, b) => b.elevation - a.elevation);

        // Use spatial indexing: group into grid cells
        const cellSize = maxDist / 2; // spatial hash cell size
        const cells = new Map();
        for (const p of elevMap) {
            const cx = Math.floor(p.lat * 111320 / cellSize);
            const cy = Math.floor(p.lng * 111320 * Math.cos(HB.Geo.toRad(p.lat)) / cellSize);
            const key = `${cx},${cy}`;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(p);
        }

        // For top elevated points, find nearby low points
        const upperCount = Math.min(sorted.length, Math.ceil(sorted.length * 0.3));
        let checked = 0;

        for (let i = 0; i < upperCount; i++) {
            const upper = sorted[i];
            checked++;
            if (checked % 100 === 0) {
                onProgress(Math.round(checked / upperCount * 100),
                    `Checking pairs: ${checked}/${upperCount}`);
            }

            // Check nearby cells for lower reservoir candidates
            const cx = Math.floor(upper.lat * 111320 / cellSize);
            const cy = Math.floor(upper.lng * 111320 * Math.cos(HB.Geo.toRad(upper.lat)) / cellSize);

            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    const nearbyKey = `${cx + dx},${cy + dy}`;
                    const nearby = cells.get(nearbyKey);
                    if (!nearby) continue;

                    for (const lower of nearby) {
                        if (lower.elevation >= upper.elevation) continue;
                        const headHeight = upper.elevation - lower.elevation;
                        if (headHeight < minHead) continue;

                        const dist = HB.Geo.distance(upper.lat, upper.lng, lower.lat, lower.lng);
                        if (dist > maxDist || dist < 200) continue; // Min 200m apart

                        const validated = HB.SearchFilters.validate(
                            upper.elevation, lower.elevation, dist, filters
                        );
                        if (!validated) continue;

                        candidates.push({
                            upper,
                            lower,
                            headHeight: validated.headHeight,
                            tunnelLength: validated.tunnelLength,
                            horizontalDistance: validated.horizontalDistance,
                            volume: validated.volume,
                            ratio: validated.ratio
                        });

                        // Limit candidates to prevent excessive computation
                        if (candidates.length >= 500) return candidates;
                    }
                }
            }
        }

        return candidates;
    },

    cancel() {
        this._cancelled = true;
    },

    isRunning() {
        return this._running;
    }
};
