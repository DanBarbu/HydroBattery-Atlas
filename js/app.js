/**
 * HydroBattery Atlas - Application Bootstrap
 * Main entry point that initializes all modules and wires events.
 */
(async function () {
    'use strict';

    // Merge ANU Bluefield Malaysia data into knownSites
    if (HB.Data.anuBluefieldMalaysia && HB.Data.anuBluefieldMalaysia.length) {
        var bfCount = 0;
        HB.Data.anuBluefieldMalaysia.forEach(function (bf) {
            // Convert ANU Bluefield format to knownSites format
            HB.Data.knownSites.push({
                id: bf.id,
                name: bf.name,
                country: bf.country,
                region: bf.region,
                lat: bf.lat,
                lng: bf.lng,
                status: bf.status || 'potential',
                configuration: bf.configuration || 'lake_pair',
                capacity_mw: bf.capacity_mw,
                storage_mwh: bf.storage_mwh,
                upper_elevation_m: bf.head_m ? Math.round(bf.head_m * 0.7 + 200) : null,
                lower_elevation_m: bf.head_m ? 200 : null,
                head_m: bf.head_m,
                tunnel_length_m: bf.separation_km ? Math.round(bf.separation_km * 1000) : null,
                year_commissioned: null,
                description: bf.description,
                source_url: bf.source_url || 'https://re100.eng.anu.edu.au/global/',
                // Extra ANU Bluefield properties
                anu_tier: bf.tier,
                anu_class: bf.class,
                anu_volume_gl: bf.volume_gl,
                anu_water_rock_ratio: bf.water_rock_ratio,
                anu_dam_volume_mm3: bf.dam_volume_mm3,
                anu_reservoir_area_ha: bf.reservoir_area_ha,
                anu_energy_cost_usd_mwh: bf.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: bf.power_cost_usd_kw
            });
            bfCount++;
        });
        console.log('Merged ' + bfCount + ' ANU Bluefield Malaysia sites');
    }

    // Generic ANU site merger (used for greenfield, brownfield, ocean)
    function _mergeAnuDataset(dataset, label) {
        if (!dataset || !dataset.length) return;
        dataset.forEach(function (s) {
            HB.Data.knownSites.push({
                id: s.id,
                name: s.name,
                country: s.country,
                region: s.region,
                lat: s.lat,
                lng: s.lng,
                status: s.status,
                configuration: s.configuration || 'lake_pair',
                capacity_mw: s.capacity_mw,
                storage_mwh: s.storage_mwh,
                upper_elevation_m: s.head_m ? Math.round(s.head_m * 0.7 + 200) : null,
                lower_elevation_m: s.head_m ? 200 : null,
                head_m: s.head_m,
                tunnel_length_m: s.separation_km ? Math.round(s.separation_km * 1000) : null,
                year_commissioned: null,
                description: s.description,
                source_url: s.source_url || 'https://re100.eng.anu.edu.au/global/',
                anu_tier: s.tier,
                anu_class: s.class,
                anu_volume_gl: s.volume_gl,
                anu_water_rock_ratio: s.water_rock_ratio,
                anu_dam_volume_mm3: s.dam_volume_mm3,
                anu_reservoir_area_ha: s.reservoir_area_ha,
                anu_energy_cost_usd_mwh: s.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: s.power_cost_usd_kw
            });
        });
        console.log('Merged ' + dataset.length + ' ' + label + ' sites');
    }

    _mergeAnuDataset(HB.Data.anuGreenfieldMalaysia, 'ANU Greenfield Malaysia');
    _mergeAnuDataset(HB.Data.anuGreenfieldRomania,  'ANU Greenfield Romania');
    _mergeAnuDataset(HB.Data.anuBrownfieldMalaysia, 'ANU Brownfield Malaysia');
    _mergeAnuDataset(HB.Data.anuBrownfieldRomania,  'ANU Brownfield Romania');
    _mergeAnuDataset(HB.Data.anuOceanMalaysia,      'ANU Ocean Malaysia');

    // Merge ANU Bluefield Romania data into knownSites
    if (HB.Data.anuBluefieldRomania && HB.Data.anuBluefieldRomania.length) {
        var bfRoCount = 0;
        HB.Data.anuBluefieldRomania.forEach(function (bf) {
            HB.Data.knownSites.push({
                id: bf.id,
                name: bf.name,
                country: bf.country,
                region: bf.region,
                lat: bf.lat,
                lng: bf.lng,
                status: bf.status || 'potential',
                configuration: bf.configuration || 'lake_pair',
                capacity_mw: bf.capacity_mw,
                storage_mwh: bf.storage_mwh,
                upper_elevation_m: bf.head_m ? Math.round(bf.head_m * 0.7 + 200) : null,
                lower_elevation_m: bf.head_m ? 200 : null,
                head_m: bf.head_m,
                tunnel_length_m: bf.separation_km ? Math.round(bf.separation_km * 1000) : null,
                year_commissioned: null,
                description: bf.description,
                source_url: bf.source_url || 'https://re100.eng.anu.edu.au/global/',
                anu_tier: bf.tier,
                anu_class: bf.class,
                anu_volume_gl: bf.volume_gl,
                anu_water_rock_ratio: bf.water_rock_ratio,
                anu_dam_volume_mm3: bf.dam_volume_mm3,
                anu_reservoir_area_ha: bf.reservoir_area_ha,
                anu_energy_cost_usd_mwh: bf.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: bf.power_cost_usd_kw
            });
            bfRoCount++;
        });
        console.log('Merged ' + bfRoCount + ' ANU Bluefield Romania sites');
    }

    // Initialize elevation cache
    await HB.Elevation.init();

    // Initialize map
    HB.Map.init();

    // Initialize markers
    HB.Markers.init();

    // Initialize UI modules
    HB.UI.searchPanel.init();
    HB.UI.resultsPanel.init();
    HB.UI.siteDetail.init();
    if (HB.UI.financialParams) HB.UI.financialParams.init();
    if (HB.UI.scaleUp) HB.UI.scaleUp.init();
    if (HB.UI.SensitivityPanel) HB.UI.SensitivityPanel.init();
    if (HB.UI.fpvPanel) HB.UI.fpvPanel.init();

    // Wire scale-up panel collapse toggle
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'toggle-scaleup-body') {
            const body = document.getElementById('scale-up-body');
            if (!body) return;
            const hidden = body.style.display === 'none';
            body.style.display = hidden ? 'block' : 'none';
            e.target.innerHTML = hidden ? '&#8722;' : '+';
        }
    });

    // Initialize draw tools
    HB.DrawTools.init();

    // Wire up Browse tab filters and region jump buttons
    _setupBrowseFilters();
    _setupRegionJumpButtons();

    // Wire up events
    HB.Events.on('selectSearchResult', (result) => {
        HB.Markers.highlightResult(result);

        const fullCost = HB.Cost.engine.calculate({
            headHeight: result.headHeight,
            tunnelLength: result.tunnelLength,
            energyKWh: result.energyKWh,
            powerKW: result.powerKW,
            configuration: result.configuration,
            efficiency: result.efficiency
        });

        HB.Events.emit('showSiteDetail', {
            ...result,
            costResult: fullCost,
            status: 'search_result'
        });
    });

    // Populate browse tab with known sites
    _populateKnownSitesList();

    console.log('HydroBattery Atlas initialized');
    console.log(`Loaded ${HB.Data.knownSites.length} known sites and ${HB.Data.mineVoids.length} mine void sites`);

    // Update footer site count
    const siteCountEl = document.getElementById('site-count');
    if (siteCountEl) {
        siteCountEl.textContent = HB.Data.knownSites.length + HB.Data.mineVoids.length;
    }

    /**
     * Setup browse tab filter controls
     */
    function _setupBrowseFilters() {
        const statusCheckboxes = document.querySelectorAll('#tab-browse .checkbox-group:first-of-type input');
        const configCheckboxes = document.querySelectorAll('#tab-browse .checkbox-group:last-of-type input');
        const minCapInput = document.getElementById('filter-min-capacity');
        const countrySelect = document.getElementById('filter-country');

        const applyFilters = () => {
            const statuses = [];
            statusCheckboxes.forEach(cb => {
                if (cb.checked) statuses.push(cb.value);
            });

            const configurations = [];
            configCheckboxes.forEach(cb => {
                if (cb.checked) configurations.push(cb.value);
            });

            const minCapacityMW = parseFloat(minCapInput.value) || 0;
            const country = countrySelect ? countrySelect.value : 'all';

            HB.Markers.filterKnownSites({ statuses, configurations, minCapacityMW, country });
            _populateKnownSitesList({ statuses, configurations, minCapacityMW, country });
        };

        statusCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        configCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        minCapInput.addEventListener('change', applyFilters);
        if (countrySelect) countrySelect.addEventListener('change', applyFilters);
    }

    /**
     * Wire up "Jump to Region" quick-navigation buttons in the Browse tab
     */
    function _setupRegionJumpButtons() {
        document.querySelectorAll('.region-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat);
                const lng = parseFloat(btn.dataset.lng);
                const zoom = parseInt(btn.dataset.zoom, 10) || 6;
                HB.Map.flyTo(lat, lng, zoom);

                // Also switch country filter to match the clicked region
                const countrySelect = document.getElementById('filter-country');
                if (countrySelect) {
                    const label = btn.textContent.trim();
                    if (label.includes('Australia')) countrySelect.value = 'Australia';
                    else if (label.includes('Malaysia') || label.includes('Mamut')) countrySelect.value = 'Malaysia';
                    else if (label.includes('Romania')) countrySelect.value = 'Romania';
                    countrySelect.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    /**
     * Populate the known sites list in the Browse tab
     */
    function _populateKnownSitesList(filters) {
        const container = document.getElementById('known-sites-list');
        container.innerHTML = '';

        let allSites = [...HB.Data.knownSites, ...HB.Data.mineVoids.map(mv => ({
            id: mv.id, name: mv.name, country: mv.country, region: mv.region,
            lat: mv.lat, lng: mv.lng, status: mv.status,
            configuration: 'mine_void',
            capacity_mw: mv.capacity_mw, storage_mwh: mv.storage_mwh,
            head_m: mv.head_m, description: mv.description
        }))];

        // Apply filters
        if (filters) {
            if (filters.country && filters.country !== 'all') {
                allSites = allSites.filter(s => s.country === filters.country);
            }
            if (filters.statuses && filters.statuses.length > 0) {
                allSites = allSites.filter(s => filters.statuses.includes(s.status));
            }
            if (filters.configurations && filters.configurations.length > 0) {
                allSites = allSites.filter(s => filters.configurations.includes(s.configuration));
            }
            if (filters.minCapacityMW > 0) {
                allSites = allSites.filter(s => (s.capacity_mw || 0) >= filters.minCapacityMW);
            }
        }

        // Sort by capacity descending
        allSites.sort((a, b) => (b.capacity_mw || 0) - (a.capacity_mw || 0));

        if (allSites.length === 0) {
            container.innerHTML = '<div class="no-results"><p>No sites match the current filters.</p></div>';
            return;
        }

        allSites.forEach(site => {
            const card = document.createElement('div');
            card.className = 'result-card';
            const statusLabel = (site.status || '').replace(/_/g, ' ');
            const anuExtra = site.anu_class ? `
                <div class="result-card-stats" style="border-top:1px solid rgba(0,0,0,0.08);margin-top:4px;padding-top:4px;">
                    <div class="result-stat">
                        <span class="label">ANU Class</span>
                        <span class="value" style="color:${site.anu_class === 'A' ? '#2e7d32' : site.anu_class === 'B' ? '#1565c0' : '#666'};font-weight:700;">${site.anu_class}</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">Tier</span>
                        <span class="value">${site.anu_tier || '--'}</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">LCOS</span>
                        <span class="value">$${site.anu_energy_cost_usd_mwh}/MWh</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">W:R Ratio</span>
                        <span class="value">${site.anu_water_rock_ratio}</span>
                    </div>
                </div>` : '';
            card.innerHTML = `
                <div class="result-card-header">
                    <span class="result-card-title">${site.name}</span>
                    <span class="status-badge ${site.status}" style="font-size:9px;padding:1px 6px;">${statusLabel}</span>
                </div>
                <div class="result-card-stats">
                    <div class="result-stat">
                        <span class="label">Country</span>
                        <span class="value">${site.country || '--'}</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">Capacity</span>
                        <span class="value">${site.capacity_mw ? HB.Utils.formatNumber(site.capacity_mw) + ' MW' : '--'}</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">Storage</span>
                        <span class="value">${site.storage_mwh ? HB.Utils.formatEnergy(site.storage_mwh * 1000) : '--'}</span>
                    </div>
                    <div class="result-stat">
                        <span class="label">Head</span>
                        <span class="value">${site.head_m ? site.head_m + 'm' : '--'}</span>
                    </div>
                </div>
                ${anuExtra}
            `;

            card.addEventListener('click', () => {
                HB.Events.emit('viewSiteDetail', site.id);
                // Highlight
                document.querySelectorAll('#known-sites-list .result-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });

            container.appendChild(card);
        });
    }
})();
