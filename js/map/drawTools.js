/**
 * Draw Tools - handles manual marker placement for site evaluation
 */
HB.DrawTools = {
    _placingType: null,

    init() {
        // Listen for map clicks when in placement mode
        HB.Events.on('mapClick', (data) => {
            if (!this._placingType) return;
            this._placeMarker(this._placingType, data.lat, data.lng);
            this._placingType = null;
            document.getElementById('map').style.cursor = '';
        });

        // Place upper button
        document.getElementById('btn-place-upper').addEventListener('click', () => {
            this.startPlacing('upper');
        });

        // Place lower button
        document.getElementById('btn-place-lower').addEventListener('click', () => {
            this.startPlacing('lower');
        });

        // Manual coordinate input
        document.getElementById('btn-evaluate-manual').addEventListener('click', () => {
            this.evaluateManual();
        });

        // Listen for marker drag
        HB.Events.on('manualMarkerMoved', async (data) => {
            await this._updateElevation(data.type, data.lat, data.lng);
            document.getElementById(`${data.type}-lat`).value = data.lat.toFixed(6);
            document.getElementById(`${data.type}-lng`).value = data.lng.toFixed(6);
        });
    },

    startPlacing(type) {
        this._placingType = type;
        document.getElementById('map').style.cursor = 'crosshair';
        HB.Utils.showToast(`Click on the map to place ${type} reservoir marker`);
    },

    async _placeMarker(type, lat, lng) {
        HB.Markers.placeManualMarker(type, lat, lng);
        document.getElementById(`${type}-lat`).value = lat.toFixed(6);
        document.getElementById(`${type}-lng`).value = lng.toFixed(6);
        await this._updateElevation(type, lat, lng);
    },

    async _updateElevation(type, lat, lng) {
        const elevEl = document.getElementById(`${type}-elev`);
        elevEl.textContent = 'Loading...';
        try {
            const elev = await HB.Elevation.getElevation(lat, lng);
            elevEl.textContent = elev !== null ? `${Math.round(elev)}m` : 'N/A';
        } catch (e) {
            elevEl.textContent = 'Error';
        }
    },

    async evaluateManual() {
        const upperLat = parseFloat(document.getElementById('upper-lat').value);
        const upperLng = parseFloat(document.getElementById('upper-lng').value);
        const lowerLat = parseFloat(document.getElementById('lower-lat').value);
        const lowerLng = parseFloat(document.getElementById('lower-lng').value);

        if (isNaN(upperLat) || isNaN(upperLng) || isNaN(lowerLat) || isNaN(lowerLng)) {
            HB.Utils.showToast('Please set both upper and lower reservoir locations');
            return;
        }

        HB.Utils.showToast('Evaluating site...');

        // Place markers if not already placed
        HB.Markers.placeManualMarker('upper', upperLat, upperLng);
        HB.Markers.placeManualMarker('lower', lowerLat, lowerLng);

        // Get elevations
        const elevations = await HB.Elevation.getElevationBatch([
            { lat: upperLat, lng: upperLng },
            { lat: lowerLat, lng: lowerLng }
        ]);

        const upperElev = elevations[0];
        const lowerElev = elevations[1];

        if (upperElev === null || lowerElev === null) {
            HB.Utils.showToast('Could not fetch elevation data');
            return;
        }

        document.getElementById('upper-elev').textContent = `${Math.round(upperElev)}m`;
        document.getElementById('lower-elev').textContent = `${Math.round(lowerElev)}m`;

        const headHeight = upperElev - lowerElev;
        if (headHeight <= 0) {
            HB.Utils.showToast('Upper reservoir must be at a higher elevation than lower');
            return;
        }

        const distance = HB.Geo.distance(upperLat, upperLng, lowerLat, lowerLng);
        const tunnelLength = HB.Geo.tunnelLength(distance, headHeight);

        // Get energy/power from search panel
        const filters = HB.SearchFilters.fromUI();

        // Create site object for cost calculation
        const site = {
            id: 'manual_eval',
            name: 'Manual Evaluation',
            upper: { lat: upperLat, lng: upperLng, elevation: upperElev },
            lower: { lat: lowerLat, lng: lowerLng, elevation: lowerElev },
            headHeight,
            tunnelLength,
            horizontalDistance: distance,
            energyKWh: filters.energyKWh,
            powerKW: filters.powerKW,
            configuration: filters.configuration,
            efficiency: filters.efficiency,
            status: 'search_result'
        };

        // Run full cost estimate
        const costResult = HB.Cost.engine.calculate({
            headHeight,
            tunnelLength,
            energyKWh: filters.energyKWh,
            powerKW: filters.powerKW,
            configuration: filters.configuration,
            efficiency: filters.efficiency
        });

        site.costResult = costResult;

        // Show in right panel
        HB.Events.emit('showSiteDetail', site);

        // Fit map to show both markers
        HB.Map.fitBounds([
            { lat: upperLat, lng: upperLng },
            { lat: lowerLat, lng: lowerLng }
        ]);
    }
};
