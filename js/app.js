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
                upper_elevation_m: bf.upper_elev_m || (bf.head_m ? Math.round(bf.head_m * 0.7 + 200) : null),
                lower_elevation_m: bf.lower_elev_m || (bf.head_m ? 200 : null),
                head_m: bf.head_m,
                // Scale-up engine fields
                headM: bf.headM || bf.head_m,
                separationM: bf.separationM || (bf.separation_km ? Math.round(bf.separation_km * 1000) : null),
                separation_km: bf.separation_km,
                tunnel_length_m: bf.separationM || (bf.separation_km ? Math.round(bf.separation_km * 1000) : null),
                year_commissioned: null,
                description: bf.description,
                source_url: bf.source_url || 'https://re100.eng.anu.edu.au/global/',
                isdam: bf.isdam,
                // Extra ANU Bluefield properties
                anu_tier: bf.tier,
                anu_class: bf.class,
                anu_volume_gl: bf.volume_gl,
                anu_water_rock_ratio: bf.water_rock_ratio,
                anu_dam_volume_mm3: bf.dam_volume_mm3,
                anu_reservoir_area_ha: bf.reservoir_area_ha,
                anu_energy_cost_usd_mwh: bf.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: bf.power_cost_usd_kw,
                // Extra metadata for brownfield/lake pairs
                upper_reservoir: bf.upper_reservoir,
                upper_lat: bf.upper_lat,
                upper_lng: bf.upper_lng,
                lower_reservoir: bf.lower_reservoir,
                lower_lat: bf.lower_lat,
                lower_lng: bf.lower_lng,
                anu_id_upper: bf.anu_id_upper,
                anu_id_lower: bf.anu_id_lower,
                anu_dataset: bf.anu_dataset,
                // Pre-fetched polygon + pipeline coordinates (bypasses CORS on live WFS)
                upper_polygon:  bf.upper_polygon  || null,
                lower_polygon:  bf.lower_polygon  || null,
                pipe_geometry:  bf.pipe_geometry  || null,
                upper_area_ha: bf.upper_area_ha || null,
                lower_area_ha: bf.lower_area_ha || null,
                upper_vol_gl:  bf.upper_vol_gl  || null,
                lower_vol_gl:  bf.lower_vol_gl  || null,
                upper_elev_m:  bf.upper_elev_m  || null,
                lower_elev_m:  bf.lower_elev_m  || null,
                // ANU tunnel fields for satellite map popup
                anu_tunnel_km:       bf.anu_tunnel_km       || null,
                anu_tunnel_slope_pct: bf.anu_tunnel_slope_pct || bf.slope_pct || null,
                anu_flow_m3s:        bf.anu_flow_m3s        || bf.flow_rate_m3s || null
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
                upper_elevation_m: s.upper_elev_m || s.upper_elev_nwl_m || (s.head_m ? Math.round(s.head_m * 0.7 + 200) : null),
                lower_elevation_m: s.lower_elev_m || s.lower_elev_nwl_m || (s.head_m ? 200 : null),
                head_m: s.head_m,
                separation_km: s.separation_km,
                tunnel_length_m: s.separation_km ? Math.round(s.separation_km * 1000) : null,
                year_commissioned: null,
                description: s.description,
                source_url: s.source_url || 'https://re100.eng.anu.edu.au/global/',
                isdam: s.isdam,
                anu_tier: s.tier,
                anu_class: s.class,
                anu_volume_gl: s.volume_gl,
                anu_water_rock_ratio: s.water_rock_ratio,
                anu_dam_volume_mm3: s.dam_volume_mm3,
                anu_reservoir_area_ha: s.reservoir_area_ha,
                anu_energy_cost_usd_mwh: s.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: s.power_cost_usd_kw,
                // Detailed per-reservoir fields (present in some datasets)
                upper_reservoir:       s.upper_reservoir  || null,
                upper_reservoir_id:    s.upper_reservoir_id || null,
                upper_lat:             s.upper_lat  || null,
                upper_lng:             s.upper_lng  || null,
                upper_elev_m:          s.upper_elev_m  || null,
                upper_elev_nwl_m:      s.upper_elev_nwl_m  || null,
                upper_elev_min_m:      s.upper_elev_min_m  || null,
                upper_area_ha:         s.upper_area_ha  || null,
                upper_volume_gl:       s.upper_volume_gl  || null,
                upper_depth_fluct_m:   s.upper_depth_fluct_m  || null,
                upper_max_depth_m:     s.upper_max_depth_m  || null,
                upper_dam_height_m:    s.upper_dam_height_m  || null,
                upper_dam_crest_m:     s.upper_dam_crest_m  || null,
                lower_reservoir:       s.lower_reservoir  || null,
                lower_reservoir_id:    s.lower_reservoir_id || null,
                lower_lat:             s.lower_lat  || null,
                lower_lng:             s.lower_lng  || null,
                lower_elev_m:          s.lower_elev_m  || null,
                lower_elev_nwl_m:      s.lower_elev_nwl_m  || null,
                lower_elev_min_m:      s.lower_elev_min_m  || null,
                lower_area_ha:         s.lower_area_ha  || null,
                lower_volume_gl:       s.lower_volume_gl  || null,
                lower_volume_total_gl: s.lower_volume_total_gl  || null,
                lower_volume_active_gl:s.lower_volume_active_gl  || null,
                lower_depth_fluct_m:   s.lower_depth_fluct_m  || null,
                lower_max_depth_m:     s.lower_max_depth_m  || null,
                lower_dam_height_m:    s.lower_dam_height_m  || null,
                lower_dam_length_m:    s.lower_dam_length_m  || null,
                lower_dam_volume_gl:   s.lower_dam_volume_gl  || null,
                // Turbine/penstock fields
                flow_rate_m3s:         s.flow_rate_m3s  || null,
                penstock_diameter_m:   s.penstock_diameter_m  || null,
                turbine_type:          s.turbine_type  || null,
                units:                 s.units  || null,
                efficiency_pct:        s.efficiency_pct  || null,
                existing_plant_mw:     s.existing_plant_mw  || null,
                existing_plant_year:   s.existing_plant_year  || null,
                anu_id_upper:          s.anu_id_upper  || null,
                anu_id_lower:          s.anu_id_lower  || null,
                anu_dataset:           s.anu_dataset  || null,
                // ANU tunnel fields used by satellite map popup
                anu_tunnel_km:         s.anu_tunnel_km || s.tunnel_km || null,
                anu_tunnel_slope_pct:  s.slope_pct  || null,
                anu_flow_m3s:          s.flow_rate_m3s  || null
            });
        });
        console.log('Merged ' + dataset.length + ' ' + label + ' sites');
    }

    _mergeAnuDataset(HB.Data.anuGreenfieldMalaysia,    'ANU Greenfield Malaysia');
    _mergeAnuDataset(HB.Data.anuGreenfieldRomania,     'ANU Greenfield Romania');
    _mergeAnuDataset(HB.Data.anuBrownfieldMalaysia,    'ANU Brownfield Malaysia');
    _mergeAnuDataset(HB.Data.anuBrownfieldRomania,     'ANU Brownfield Romania');
    _mergeAnuDataset(HB.Data.anuOceanMalaysia,         'ANU Ocean Malaysia');
    _mergeAnuDataset(HB.Data.anuBluefieldSouthKorea,   'ANU Bluefield South Korea');
    _mergeAnuDataset(HB.Data.anuGreenfieldSouthKorea,  'ANU Greenfield South Korea');
    _mergeAnuDataset(HB.Data.anuBrownfieldSouthKorea,  'ANU Brownfield South Korea');
    _mergeAnuDataset(HB.Data.anuBluefieldPhilippines,  'ANU Bluefield Philippines');
    _mergeAnuDataset(HB.Data.anuGreenfieldPhilippines, 'ANU Greenfield Philippines');
    _mergeAnuDataset(HB.Data.anuBrownfieldPhilippines, 'ANU Brownfield Philippines');
    _mergeAnuDataset(HB.Data.anuBluefieldIndonesia,    'ANU Bluefield Indonesia');
    _mergeAnuDataset(HB.Data.anuGreenfieldIndonesia,   'ANU Greenfield Indonesia');
    _mergeAnuDataset(HB.Data.anuBrownfieldIndonesia,   'ANU Brownfield Indonesia');

    // Merge Olt River cascade hydropower plants (Romania)
    // Source: GEM Global Hydropower Tracker + OpenStreetMap Overpass API
    if (HB.Data.oltCascadeRomania && HB.Data.oltCascadeRomania.length) {
        HB.Data.oltCascadeRomania.forEach(function (s) {
            HB.Data.knownSites.push({
                id:                 s.id,
                name:               s.name,
                country:            s.country,
                region:             s.region,
                lat:                s.lat,
                lng:                s.lng,
                status:             s.status,
                configuration:      s.configuration,
                capacity_mw:        s.capacity_mw,
                storage_mwh:        s.storage_mwh,
                head_m:             s.head_m,
                headM:              s.headM || s.head_m,
                separationM:        s.separationM,
                tunnel_length_m:    s.separationM,
                upper_elevation_m:  s.upper_elevation_m,
                lower_elevation_m:  s.lower_elevation_m,
                year_commissioned:  s.year_commissioned,
                description:        s.description,
                source_url:         s.source_url,
                isdam:              s.isdam,
                gem_river:          s.gem_river,
                gem_owner:          s.gem_owner,
                gem_technology:     s.gem_technology
            });
        });
        console.log('Merged ' + HB.Data.oltCascadeRomania.length + ' Olt cascade Romania sites');
    }

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
                upper_elevation_m: bf.upper_elev_m || bf.upper_elev_nwl_m || (bf.head_m ? Math.round(bf.head_m * 0.7 + 200) : null),
                lower_elevation_m: bf.lower_elev_m || bf.lower_elev_nwl_m || (bf.head_m ? 200 : null),
                head_m: bf.head_m,
                separation_km: bf.separation_km,
                tunnel_length_m: bf.separation_km ? Math.round(bf.separation_km * 1000) : null,
                year_commissioned: null,
                description: bf.description,
                source_url: bf.source_url || 'https://re100.eng.anu.edu.au/global/',
                isdam: bf.isdam,
                anu_tier: bf.tier,
                anu_class: bf.class,
                anu_volume_gl: bf.volume_gl,
                anu_water_rock_ratio: bf.water_rock_ratio,
                anu_dam_volume_mm3: bf.dam_volume_mm3,
                anu_reservoir_area_ha: bf.reservoir_area_ha,
                anu_energy_cost_usd_mwh: bf.energy_cost_usd_mwh,
                anu_power_cost_usd_kw: bf.power_cost_usd_kw,
                // Detailed per-reservoir fields
                upper_reservoir:       bf.upper_reservoir  || null,
                upper_reservoir_id:    bf.upper_reservoir_id || null,
                upper_lat:             bf.upper_lat  || null,
                upper_lng:             bf.upper_lng  || null,
                upper_elev_m:          bf.upper_elev_m  || null,
                upper_elev_nwl_m:      bf.upper_elev_nwl_m  || null,
                upper_elev_min_m:      bf.upper_elev_min_m  || null,
                upper_area_ha:         bf.upper_area_ha  || null,
                upper_volume_gl:       bf.upper_volume_gl  || null,
                upper_depth_fluct_m:   bf.upper_depth_fluct_m  || null,
                upper_max_depth_m:     bf.upper_max_depth_m  || null,
                upper_dam_height_m:    bf.upper_dam_height_m  || null,
                upper_dam_crest_m:     bf.upper_dam_crest_m  || null,
                lower_reservoir:       bf.lower_reservoir  || null,
                lower_reservoir_id:    bf.lower_reservoir_id || null,
                lower_lat:             bf.lower_lat  || null,
                lower_lng:             bf.lower_lng  || null,
                lower_elev_m:          bf.lower_elev_m  || null,
                lower_elev_nwl_m:      bf.lower_elev_nwl_m  || null,
                lower_elev_min_m:      bf.lower_elev_min_m  || null,
                lower_area_ha:         bf.lower_area_ha  || null,
                lower_volume_gl:       bf.lower_volume_gl  || null,
                lower_volume_total_gl: bf.lower_volume_total_gl  || null,
                lower_volume_active_gl:bf.lower_volume_active_gl  || null,
                lower_depth_fluct_m:   bf.lower_depth_fluct_m  || null,
                lower_max_depth_m:     bf.lower_max_depth_m  || null,
                lower_dam_height_m:    bf.lower_dam_height_m  || null,
                lower_dam_length_m:    bf.lower_dam_length_m  || null,
                lower_dam_volume_gl:   bf.lower_dam_volume_gl  || null,
                // Turbine/penstock fields
                flow_rate_m3s:         bf.flow_rate_m3s  || null,
                penstock_diameter_m:   bf.penstock_diameter_m  || null,
                turbine_type:          bf.turbine_type  || null,
                units:                 bf.units  || null,
                efficiency_pct:        bf.efficiency_pct  || null,
                existing_plant_mw:     bf.existing_plant_mw  || null,
                existing_plant_year:   bf.existing_plant_year  || null,
                anu_id_upper:          bf.anu_id_upper  || null,
                anu_id_lower:          bf.anu_id_lower  || null,
                anu_dataset:           bf.anu_dataset  || null,
                // ANU tunnel fields used by satellite map popup
                anu_tunnel_slope_pct:  bf.slope_pct  || null,
                anu_flow_m3s:          bf.flow_rate_m3s  || null
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

    // ── URL hash deep-link support ──────────────────────────────────────────
    // Supported:
    //   #site=SITE_ID          → open site detail panel for that site
    //   #map=LAT,LNG,ZOOM      → fly map to position
    // Example: https://danbarbu.github.io/HydroBattery-Atlas/#site=ro-tarnita-pot-RES25892
    (function _handleUrlHash() {
        const hash = window.location.hash; // e.g. "#site=ro-tarnita-pot-RES25892"
        if (!hash) return;

        if (hash.startsWith('#site=')) {
            const siteId = hash.slice(6);
            // Slight delay ensures map tiles and markers are fully rendered
            setTimeout(() => {
                // Find the site in the data
                const site = HB.Data.knownSites.find(s => s.id === siteId);
                if (site) {
                    // Fly map to the site
                    HB.Map.flyTo(site.lat, site.lng, 11);
                    // Emit the viewSiteDetail event to open the detail panel
                    HB.Events.emit('viewSiteDetail', siteId);
                } else {
                    console.warn('Hash site not found:', siteId);
                }
            }, 800);
        } else if (hash.startsWith('#map=')) {
            const parts = hash.slice(5).split(',');
            if (parts.length >= 2) {
                const lat  = parseFloat(parts[0]);
                const lng  = parseFloat(parts[1]);
                const zoom = parts[2] ? parseInt(parts[2], 10) : 8;
                if (!isNaN(lat) && !isNaN(lng)) {
                    setTimeout(() => HB.Map.flyTo(lat, lng, zoom), 400);
                }
            }
        }
    })();

    // Update footer site count
    const siteCountEl = document.getElementById('site-count');
    if (siteCountEl) {
        siteCountEl.textContent = HB.Data.knownSites.length + HB.Data.mineVoids.length;
    }

    /**
     * Setup browse tab filter controls
     */
    function _setupBrowseFilters() {
        const statusCheckboxes = document.querySelectorAll('#filter-status-group input[type="checkbox"]');
        const configCheckboxes = document.querySelectorAll('#filter-config-group input[type="checkbox"]');
        const minCapInput = document.getElementById('filter-min-capacity');
        const countrySelect = document.getElementById('filter-country');
        const nameInput = document.getElementById('filter-site-name');

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
            const nameQuery = nameInput ? nameInput.value.trim().toLowerCase() : '';

            HB.Markers.filterKnownSites({ statuses, configurations, minCapacityMW, country });
            _populateKnownSitesList({ statuses, configurations, minCapacityMW, country, nameQuery });
        };

        statusCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        configCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
        if (minCapInput) minCapInput.addEventListener('change', applyFilters);
        if (countrySelect) countrySelect.addEventListener('change', applyFilters);
        if (nameInput) nameInput.addEventListener('input', applyFilters);
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
                    if (label.includes('Australia'))       countrySelect.value = 'Australia';
                    else if (label.includes('Malaysia') || label.includes('Mamut')) countrySelect.value = 'Malaysia';
                    else if (label.includes('Romania'))    countrySelect.value = 'Romania';
                    else if (label.includes('South Korea') || label.includes('🇰🇷')) countrySelect.value = 'South Korea';
                    else if (label.includes('Philippines') || label.includes('🇵🇭')) countrySelect.value = 'Philippines';
                    else if (label.includes('Indonesia')  || label.includes('🇮🇩')) countrySelect.value = 'Indonesia';
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
            if (filters.nameQuery) {
                allSites = allSites.filter(s =>
                    (s.name || '').toLowerCase().includes(filters.nameQuery) ||
                    (s.region || '').toLowerCase().includes(filters.nameQuery)
                );
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
