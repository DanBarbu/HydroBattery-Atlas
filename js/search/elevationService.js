/**
 * Elevation Service - fetches elevation data with caching and batching
 */
HB.Elevation = {
    _cache: new Map(),
    _dbReady: false,
    _db: null,

    /**
     * Initialize IndexedDB cache
     */
    async init() {
        try {
            const request = indexedDB.open('HydroBatteryElevation', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('elevations')) {
                    db.createObjectStore('elevations', { keyPath: 'key' });
                }
            };
            this._db = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            this._dbReady = true;
        } catch (e) {
            console.warn('IndexedDB not available, using memory cache only');
        }
    },

    /**
     * Cache key from coordinates (rounded to ~10m precision)
     */
    _key(lat, lng) {
        return `${lat.toFixed(4)},${lng.toFixed(4)}`;
    },

    /**
     * Get cached elevation
     */
    async _getFromCache(key) {
        if (this._cache.has(key)) return this._cache.get(key);
        if (!this._dbReady) return null;
        try {
            const tx = this._db.transaction('elevations', 'readonly');
            const store = tx.objectStore('elevations');
            const result = await new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            if (result) {
                this._cache.set(key, result.elevation);
                return result.elevation;
            }
        } catch (e) { /* ignore */ }
        return null;
    },

    /**
     * Store elevation in cache
     */
    async _setCache(key, elevation) {
        this._cache.set(key, elevation);
        if (!this._dbReady) return;
        try {
            const tx = this._db.transaction('elevations', 'readwrite');
            const store = tx.objectStore('elevations');
            store.put({ key, elevation, ts: Date.now() });
        } catch (e) { /* ignore */ }
    },

    /**
     * Fetch elevation for a single point
     */
    async getElevation(lat, lng) {
        const key = this._key(lat, lng);
        const cached = await this._getFromCache(key);
        if (cached !== null) return cached;

        const results = await this.getElevationBatch([{ lat, lng }]);
        return results[0];
    },

    /**
     * Fetch elevation for multiple points using Open-Meteo API
     * Batches in groups of 100
     */
    async getElevationBatch(points) {
        const results = new Array(points.length);
        const uncached = [];

        // Check cache first
        for (let i = 0; i < points.length; i++) {
            const key = this._key(points[i].lat, points[i].lng);
            const cached = await this._getFromCache(key);
            if (cached !== null) {
                results[i] = cached;
            } else {
                uncached.push({ index: i, lat: points[i].lat, lng: points[i].lng });
            }
        }

        // Fetch uncached in batches
        const batchSize = HB.Config.ELEVATION_BATCH_SIZE;
        for (let b = 0; b < uncached.length; b += batchSize) {
            const batch = uncached.slice(b, b + batchSize);
            const lats = batch.map(p => p.lat.toFixed(4)).join(',');
            const lngs = batch.map(p => p.lng.toFixed(4)).join(',');

            try {
                const url = `${HB.Config.ELEVATION_API}?latitude=${lats}&longitude=${lngs}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                const data = await response.json();

                const elevations = data.elevation || [];
                for (let i = 0; i < batch.length; i++) {
                    const elev = elevations[i] !== undefined ? elevations[i] : null;
                    results[batch[i].index] = elev;
                    if (elev !== null) {
                        const key = this._key(batch[i].lat, batch[i].lng);
                        await this._setCache(key, elev);
                    }
                }
            } catch (e) {
                console.error('Elevation API error:', e);
                // Try fallback API
                for (const p of batch) {
                    try {
                        const elev = await this._fetchFallback(p.lat, p.lng);
                        results[p.index] = elev;
                    } catch (e2) {
                        results[p.index] = null;
                    }
                }
            }

            // Throttle
            if (b + batchSize < uncached.length) {
                await new Promise(r => setTimeout(r, HB.Config.API_THROTTLE_MS));
            }
        }

        return results;
    },

    /**
     * Fallback: Open-Elevation API
     */
    async _fetchFallback(lat, lng) {
        const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.results && data.results[0]) {
            const elev = data.results[0].elevation;
            const key = this._key(lat, lng);
            await this._setCache(key, elev);
            return elev;
        }
        return null;
    },

    /**
     * Get elevation profile along a line between two points
     */
    async getProfile(lat1, lng1, lat2, lng2, numSamples) {
        numSamples = numSamples || 20;
        const points = [];
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            points.push({
                lat: lat1 + t * (lat2 - lat1),
                lng: lng1 + t * (lng2 - lng1)
            });
        }
        const elevations = await this.getElevationBatch(points);
        const totalDist = HB.Geo.distance(lat1, lng1, lat2, lng2);
        return points.map((p, i) => ({
            lat: p.lat,
            lng: p.lng,
            elevation: elevations[i],
            distance: (i / numSamples) * totalDist
        }));
    },

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            memoryEntries: this._cache.size,
            dbReady: this._dbReady
        };
    }
};
