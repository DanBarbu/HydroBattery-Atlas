/**
 * Map Manager - Leaflet map initialization and layer management
 */
HB.Map = {
    map: null,
    tileLayer: null,
    searchCircle: null,
    tunnelLines: [],

    /**
     * Initialize the Leaflet map
     */
    init() {
        this.map = L.map('map', {
            center: HB.Config.DEFAULT_CENTER,
            zoom: HB.Config.DEFAULT_ZOOM,
            zoomControl: true,
            attributionControl: true
        });

        this.setTileLayer(HB.State.mapTileLayer);

        // Mouse move handler for coordinates display
        this.map.on('mousemove', HB.Utils.debounce((e) => {
            const coordsEl = document.getElementById('cursor-coords');
            if (coordsEl) {
                coordsEl.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
            }
        }, 50));

        // Elevation on hover
        this.map.on('mousemove', HB.Utils.debounce(async (e) => {
            if (!HB.State.showElevation) return;
            const elevEl = document.getElementById('cursor-elevation');
            if (!elevEl) return;
            try {
                const elev = await HB.Elevation.getElevation(e.latlng.lat, e.latlng.lng);
                if (elev !== null) {
                    elevEl.textContent = `Elev: ${Math.round(elev)}m`;
                }
            } catch (err) {
                // silently ignore
            }
        }, 300));

        // Click handler for manual marker placement
        this.map.on('click', (e) => {
            HB.Events.emit('mapClick', { lat: e.latlng.lat, lng: e.latlng.lng });
        });

        // Scale control
        L.control.scale({ imperial: false, metric: true }).addTo(this.map);
    },

    /**
     * Set tile layer
     */
    setTileLayer(layerId) {
        const source = HB.Config.TILE_SOURCES[layerId];
        if (!source) return;

        if (this.tileLayer) {
            this.map.removeLayer(this.tileLayer);
        }

        this.tileLayer = L.tileLayer(source.url, {
            attribution: source.attribution,
            maxZoom: source.maxZoom
        }).addTo(this.map);

        HB.State.mapTileLayer = layerId;
    },

    /**
     * Fly to a location
     */
    flyTo(lat, lng, zoom) {
        if (!this.map || isNaN(lat) || isNaN(lng)) return;
        try {
            this.map.setView([lat, lng], zoom || 12, { animate: true, duration: 1.5 });
        } catch (e) {
            console.warn('flyTo error:', e);
            this.map.setView([lat, lng], zoom || 12);
        }
    },

    /**
     * Show search area circle
     */
    showSearchArea(lat, lng, radiusM) {
        this.clearSearchArea();
        this.searchCircle = L.circle([lat, lng], {
            radius: radiusM,
            className: 'search-area-circle',
            color: '#1a73e8',
            weight: 2,
            dashArray: '6, 4',
            fillColor: '#1a73e8',
            fillOpacity: 0.05
        }).addTo(this.map);
    },

    clearSearchArea() {
        if (this.searchCircle) {
            this.map.removeLayer(this.searchCircle);
            this.searchCircle = null;
        }
    },

    /**
     * Draw a tunnel line between upper and lower reservoirs
     */
    addTunnelLine(upperLat, upperLng, lowerLat, lowerLng) {
        const line = L.polyline(
            [[upperLat, upperLng], [lowerLat, lowerLng]],
            {
                color: '#e74c3c',
                weight: 3,
                dashArray: '8, 6',
                opacity: 0.8
            }
        ).addTo(this.map);
        this.tunnelLines.push(line);
        return line;
    },

    clearTunnelLines() {
        this.tunnelLines.forEach(l => this.map.removeLayer(l));
        this.tunnelLines = [];
    },

    /**
     * Fit map bounds to show all given points
     */
    fitBounds(points) {
        if (!points || points.length === 0 || !this.map) return;
        try {
            const validPoints = points.filter(p => !isNaN(p.lat) && !isNaN(p.lng));
            if (validPoints.length === 0) return;
            const bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
            console.warn('fitBounds error:', e);
        }
    },

    /**
     * Get current map center
     */
    getCenter() {
        const c = this.map.getCenter();
        return { lat: c.lat, lng: c.lng };
    },

    getZoom() {
        return this.map.getZoom();
    }
};
