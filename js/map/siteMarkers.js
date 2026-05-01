/**
 * Site Markers - manages markers for known sites and search results
 */
HB.Markers = {
    knownSitesLayer: null,
    mineVoidsLayer: null,
    searchResultsLayer: null,
    manualMarkers: { upper: null, lower: null },

    init() {
        // Cluster layer for known sites
        this.knownSitesLayer = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        });
        HB.Map.map.addLayer(this.knownSitesLayer);

        // Layer for search results
        this.searchResultsLayer = L.layerGroup().addTo(HB.Map.map);

        // Load known sites
        this.loadKnownSites();
    },

    /**
     * Load known sites onto the map
     */
    loadKnownSites() {
        this.knownSitesLayer.clearLayers();

        const allSites = [...HB.Data.knownSites, ...HB.Data.mineVoids.map(mv => ({
            id: mv.id,
            name: mv.name,
            country: mv.country,
            region: mv.region,
            lat: mv.lat,
            lng: mv.lng,
            status: mv.status,
            configuration: 'mine_void',
            capacity_mw: mv.capacity_mw,
            storage_mwh: mv.storage_mwh,
            head_m: mv.head_m,
            tunnel_length_m: mv.distance_between_pits_m,
            bearing_deg: mv.bearing_deg || null,
            upper_elevation_m: mv.upper_pit_elevation_m || null,
            lower_elevation_m: mv.lower_pit_elevation_m || null,
            upper_area_ha: mv.upper_pit_volume_m3 ? Math.max(1, Math.round(mv.upper_pit_volume_m3 / 80000)) : null,
            lower_area_ha: mv.lower_pit_volume_m3 ? Math.max(1, Math.round(mv.lower_pit_volume_m3 / 80000)) : null,
            upper_volume_gl: mv.upper_pit_volume_m3 ? +(mv.upper_pit_volume_m3 / 1e6).toFixed(1) : null,
            lower_volume_gl: mv.lower_pit_volume_m3 ? +(mv.lower_pit_volume_m3 / 1e6).toFixed(1) : null,
            description: mv.description,
            source_url: mv.source_url
        }))];

        allSites.forEach(site => {
            const marker = this._createSiteMarker(site);
            this.knownSitesLayer.addLayer(marker);
        });
    },

    /**
     * Create a marker for a known site
     */
    _createSiteMarker(site) {
        const color = this._statusColor(site.status);
        const icon = L.divIcon({
            className: 'marker-site-container',
            html: `<div class="marker-site" style="background:${color};"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        const marker = L.marker([site.lat, site.lng], { icon });

        const popup = this._createSitePopup(site);
        marker.bindPopup(popup);

        marker.siteData = site;
        return marker;
    },

    /**
     * Create popup content for a site
     */
    _createSitePopup(site) {
        const statusLabel = (site.status || '').replace(/_/g, ' ');
        return `
            <div class="popup-title">${site.name}</div>
            <div style="margin-bottom:6px;">
                <span class="status-badge ${site.status}">${statusLabel}</span>
            </div>
            <div class="popup-row">
                <span class="label">Country</span>
                <span class="value">${site.country}</span>
            </div>
            ${site.capacity_mw ? `<div class="popup-row">
                <span class="label">Capacity</span>
                <span class="value">${HB.Utils.formatNumber(site.capacity_mw)} MW</span>
            </div>` : ''}
            ${site.storage_mwh ? `<div class="popup-row">
                <span class="label">Storage</span>
                <span class="value">${HB.Utils.formatEnergy(site.storage_mwh * 1000)}</span>
            </div>` : ''}
            ${site.head_m ? `<div class="popup-row">
                <span class="label">Head</span>
                <span class="value">${site.head_m}m</span>
            </div>` : ''}
            <button class="popup-btn" onclick="HB.Events.emit('viewSiteDetail', '${site.id}')">
                View Details & Cost Estimate
            </button>
        `;
    },

    _statusColor(status) {
        switch (status) {
            case 'operational': return '#34a853';
            case 'under_construction': return '#f9ab00';
            case 'proposed': return '#4a90d9';
            case 'potential': return '#9aa0a6';
            case 'anu_bluefield': return '#7b61ff';
            case 'anu_greenfield': return '#1e8c3a';
            case 'anu_brownfield': return '#b45309';
            case 'anu_ocean': return '#0891b2';
            default: return '#9aa0a6';
        }
    },

    /**
     * Display search results on map
     */
    showSearchResults(results) {
        this.clearSearchResults();

        results.forEach((result, i) => {
            // Upper reservoir marker (red)
            const upperIcon = L.divIcon({
                className: '',
                html: `<div class="marker-upper" title="Upper #${i+1}"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            const upperMarker = L.marker(
                [result.upper.lat, result.upper.lng],
                { icon: upperIcon }
            ).addTo(this.searchResultsLayer);
            upperMarker.bindTooltip(`#${result.rank} Upper: ${Math.round(result.upper.elevation)}m`, { direction: 'top' });

            // Lower reservoir marker (blue)
            const lowerIcon = L.divIcon({
                className: '',
                html: `<div class="marker-lower" title="Lower #${i+1}"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            const lowerMarker = L.marker(
                [result.lower.lat, result.lower.lng],
                { icon: lowerIcon }
            ).addTo(this.searchResultsLayer);
            lowerMarker.bindTooltip(`#${result.rank} Lower: ${Math.round(result.lower.elevation)}m`, { direction: 'bottom' });

            // Tunnel line
            const line = L.polyline(
                [[result.upper.lat, result.upper.lng], [result.lower.lat, result.lower.lng]],
                { color: '#e74c3c', weight: 2, dashArray: '6, 4', opacity: 0.6 }
            ).addTo(this.searchResultsLayer);

            // Click handler
            upperMarker.on('click', () => HB.Events.emit('selectSearchResult', result));
            lowerMarker.on('click', () => HB.Events.emit('selectSearchResult', result));
            line.on('click', () => HB.Events.emit('selectSearchResult', result));
        });
    },

    clearSearchResults() {
        this.searchResultsLayer.clearLayers();
        HB.Map.clearTunnelLines();
    },

    /**
     * Highlight a specific search result
     */
    highlightResult(result) {
        HB.Map.clearTunnelLines();
        HB.Map.addTunnelLine(
            result.upper.lat, result.upper.lng,
            result.lower.lat, result.lower.lng
        );
        HB.Map.fitBounds([result.upper, result.lower]);
    },

    /**
     * Place manual marker (upper or lower)
     */
    placeManualMarker(type, lat, lng) {
        // Remove existing
        if (this.manualMarkers[type]) {
            HB.Map.map.removeLayer(this.manualMarkers[type]);
        }

        const className = type === 'upper' ? 'marker-upper' : 'marker-lower';
        const icon = L.divIcon({
            className: '',
            html: `<div class="${className}"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        this.manualMarkers[type] = L.marker([lat, lng], {
            icon,
            draggable: true
        }).addTo(HB.Map.map);

        // Update coords on drag
        this.manualMarkers[type].on('dragend', (e) => {
            const pos = e.target.getLatLng();
            HB.Events.emit('manualMarkerMoved', { type, lat: pos.lat, lng: pos.lng });
        });

        // Draw tunnel line if both markers exist
        this._updateManualTunnel();

        return this.manualMarkers[type];
    },

    _updateManualTunnel() {
        HB.Map.clearTunnelLines();
        if (this.manualMarkers.upper && this.manualMarkers.lower) {
            const u = this.manualMarkers.upper.getLatLng();
            const l = this.manualMarkers.lower.getLatLng();
            HB.Map.addTunnelLine(u.lat, u.lng, l.lat, l.lng);
        }
    },

    clearManualMarkers() {
        ['upper', 'lower'].forEach(type => {
            if (this.manualMarkers[type]) {
                HB.Map.map.removeLayer(this.manualMarkers[type]);
                this.manualMarkers[type] = null;
            }
        });
        HB.Map.clearTunnelLines();
    },

    /**
     * Filter known sites by criteria
     */
    filterKnownSites(filters) {
        this.knownSitesLayer.clearLayers();

        const allSites = [...HB.Data.knownSites, ...HB.Data.mineVoids.map(mv => ({
            id: mv.id, name: mv.name, country: mv.country, region: mv.region,
            lat: mv.lat, lng: mv.lng, status: mv.status,
            configuration: 'mine_void',
            capacity_mw: mv.capacity_mw, storage_mwh: mv.storage_mwh,
            head_m: mv.head_m,
            tunnel_length_m: mv.distance_between_pits_m,
            bearing_deg: mv.bearing_deg || null,
            upper_elevation_m: mv.upper_pit_elevation_m || null,
            lower_elevation_m: mv.lower_pit_elevation_m || null,
            upper_area_ha: mv.upper_pit_volume_m3 ? Math.max(1, Math.round(mv.upper_pit_volume_m3 / 80000)) : null,
            lower_area_ha: mv.lower_pit_volume_m3 ? Math.max(1, Math.round(mv.lower_pit_volume_m3 / 80000)) : null,
            upper_volume_gl: mv.upper_pit_volume_m3 ? +(mv.upper_pit_volume_m3 / 1e6).toFixed(1) : null,
            lower_volume_gl: mv.lower_pit_volume_m3 ? +(mv.lower_pit_volume_m3 / 1e6).toFixed(1) : null,
            description: mv.description, source_url: mv.source_url
        }))];

        allSites.forEach(site => {
            // Country filter
            if (filters.country && filters.country !== 'all' && site.country !== filters.country) return;
            // Status filter
            if (filters.statuses && !filters.statuses.includes(site.status)) return;
            // Config filter
            if (filters.configurations && !filters.configurations.includes(site.configuration)) return;
            // Capacity filter
            if (filters.minCapacityMW && (site.capacity_mw || 0) < filters.minCapacityMW) return;

            this.knownSitesLayer.addLayer(this._createSiteMarker(site));
        });
    }
};
