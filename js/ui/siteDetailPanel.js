/**
 * Site Detail Panel - shows detailed site information in the right panel
 */
HB.UI = HB.UI || {};

HB.UI.siteDetail = {
    init() {
        const panel = document.getElementById('right-panel');
        const collapseBtn = document.getElementById('right-panel-collapse-btn');

        // Close button — fully hides panel
        document.getElementById('close-right-panel').addEventListener('click', () => {
            panel.classList.add('hidden');
            collapseBtn.style.display = 'none';
        });

        // Collapse/expand toggle
        collapseBtn.addEventListener('click', () => {
            this._toggleRightPanel();
        });

        // Resize handle — drag to widen/narrow
        this._initResizeHandle();

        // Listen for site detail events
        HB.Events.on('showSiteDetail', (site) => this.show(site));

        // Listen for known site view detail
        HB.Events.on('viewSiteDetail', (siteId) => this.showKnownSite(siteId));
    },

    _toggleRightPanel() {
        const panel = document.getElementById('right-panel');
        const btn = document.getElementById('right-panel-collapse-btn');
        const isCurrentlyCollapsed = panel.classList.contains('collapsed');

        if (!isCurrentlyCollapsed) {
            // Save rendered width BEFORE class change so offsetWidth is still valid
            this._savedPanelWidth = panel.offsetWidth;
            // Clear any inline width so the CSS class "width: 0" wins
            panel.style.width = '';
            panel.classList.add('collapsed');
            btn.style.right = '0';
            btn.title = 'Show panel';
            btn.classList.add('flipped');
        } else {
            panel.classList.remove('collapsed');
            // Restore the width the user had before collapsing
            if (this._savedPanelWidth) {
                panel.style.width = this._savedPanelWidth + 'px';
            }
            btn.title = 'Hide panel';
            btn.classList.remove('flipped');
            setTimeout(() => this._syncCollapseBtn(), 250);
        }

        setTimeout(() => {
            if (HB.Map && HB.Map.map) HB.Map.map.invalidateSize();
            if (this._miniMap) this._miniMap.invalidateSize();
        }, 350);
    },

    _initResizeHandle() {
        const handle = document.getElementById('right-panel-resize-handle');
        const panel = document.getElementById('right-panel');
        const collapseBtn = document.getElementById('right-panel-collapse-btn');
        let startX, startWidth;

        const startDrag = (clientX) => {
            startX = clientX;
            startWidth = panel.offsetWidth;
            handle.classList.add('dragging');
            panel.style.transition = 'none';
            collapseBtn.style.transition = 'none';
        };

        const doDrag = (clientX) => {
            const delta = startX - clientX; // moving left = wider
            const newWidth = Math.max(320, Math.min(window.innerWidth * 0.9, startWidth + delta));
            panel.style.width = newWidth + 'px';
            collapseBtn.style.right = newWidth + 'px';
        };

        const endDrag = () => {
            handle.classList.remove('dragging');
            panel.style.transition = '';
            collapseBtn.style.transition = '';
            setTimeout(() => {
                if (HB.Map && HB.Map.map) HB.Map.map.invalidateSize();
                if (this._miniMap) this._miniMap.invalidateSize();
            }, 50);
        };

        // Mouse drag
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDrag(e.clientX);

            const onMouseMove = (e) => doDrag(e.clientX);
            const onMouseUp = () => {
                endDrag();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Touch drag
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrag(e.touches[0].clientX);

            const onTouchMove = (e) => doDrag(e.touches[0].clientX);
            const onTouchEnd = () => {
                endDrag();
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            };

            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
        }, { passive: false });
    },

    _syncCollapseBtn() {
        const panel = document.getElementById('right-panel');
        const btn = document.getElementById('right-panel-collapse-btn');
        if (!btn || panel.classList.contains('hidden')) return;
        if (panel.classList.contains('collapsed')) {
            btn.style.right = '0';
        } else {
            btn.style.right = panel.offsetWidth + 'px';
        }
    },

    show(site) {
        const panel = document.getElementById('right-panel');
        const collapseBtn = document.getElementById('right-panel-collapse-btn');
        panel.classList.remove('hidden');
        panel.classList.remove('collapsed');
        collapseBtn.style.display = 'flex';
        collapseBtn.classList.remove('flipped');
        collapseBtn.title = 'Hide panel';
        // Sync button position after layout
        requestAnimationFrame(() => this._syncCollapseBtn());

        // Site name
        document.getElementById('site-name').textContent = site.name || 'Site Evaluation';

        // Status badge
        const badge = document.getElementById('site-status-badge');
        const statusLabel = (site.status || 'search_result').replace(/_/g, ' ');
        badge.textContent = statusLabel;
        badge.className = `status-badge ${site.status || 'search_result'}`;

        // Parameters table
        this._renderParams(site);

        // Satellite view (ANU/known sites) or canvas cross-section fallback
        this._renderSiteView(site);

        // Cost breakdown — prefer ANU model for Bluefield sites
        if (site.anuResult) {
            HB.UI.costBreakdown.renderAnu(site.anuResult);
        } else if (site.costResult) {
            HB.UI.costBreakdown.render(site.costResult);
        }

        // Key metrics
        this._renderMetrics(site);

        // Notify financial params panel
        if (HB.UI.financialParams) HB.UI.financialParams.onSiteShown(site);

        // Show scale-up analysis panel
        if (HB.UI.scaleUp) HB.UI.scaleUp.render(site);

        // Show sensitivity analysis panel
        if (HB.UI.SensitivityPanel) HB.UI.SensitivityPanel.onSiteShown(site);

        // Show floating PV integration panel
        if (HB.UI.fpvPanel) HB.UI.fpvPanel.onSiteShown(site);
    },

    showKnownSite(siteId) {
        // Find site in known sites or mine voids
        let site = HB.Data.knownSites.find(s => s.id === siteId);
        if (!site) {
            const mv = HB.Data.mineVoids.find(s => s.id === siteId);
            if (mv) {
                site = {
                    id: mv.id, name: mv.name, country: mv.country, region: mv.region,
                    lat: mv.lat, lng: mv.lng, status: mv.status,
                    configuration: 'mine_void',
                    capacity_mw: mv.capacity_mw, storage_mwh: mv.storage_mwh,
                    head_m: mv.head_m,
                    upper_elevation_m: mv.upper_pit_elevation_m,
                    lower_elevation_m: mv.lower_pit_elevation_m,
                    tunnel_length_m: mv.distance_between_pits_m,
                    upper_lat: mv.upper_lat || null,
                    upper_lng: mv.upper_lng || null,
                    lower_lat: mv.lower_lat || null,
                    lower_lng: mv.lower_lng || null,
                    bearing_deg: mv.bearing_deg || null,
                    upper_area_ha: mv.upper_pit_volume_m3 ? Math.max(1, Math.round(mv.upper_pit_volume_m3 / 80000)) : null,
                    lower_area_ha: mv.lower_pit_volume_m3 ? Math.max(1, Math.round(mv.lower_pit_volume_m3 / 80000)) : null,
                    upper_volume_gl: mv.upper_pit_volume_m3 ? +(mv.upper_pit_volume_m3 / 1e6).toFixed(1) : null,
                    lower_volume_gl: mv.lower_pit_volume_m3 ? +(mv.lower_pit_volume_m3 / 1e6).toFixed(1) : null,
                    description: mv.description, source_url: mv.source_url
                };
            }
        }
        if (!site) return;

        // Run cost calculation
        const energyKWh = (site.storage_mwh || 1000) * 1000;
        const powerKW = (site.capacity_mw || 100) * 1000;
        const headHeight = site.head_m || 200;
        const tunnelLength = site.tunnel_length_m || 2000;

        // Use ANU model for Bluefield sites (or any site with ANU data).
        // Existing lake pairs (bluefield, operational, lake_pair with isdam===false)
        // have ALL civil infrastructure already built — reservoirs, tunnels, and
        // powerhouse are sunk costs. The cost breakdown shows $0 for these.
        let anuResult = null;
        const hasAnuData = site.anu_class || site.status === 'anu_bluefield' || site.anu_energy_cost_usd_mwh;
        const isBluefieldExisting = (site.isdam === false)
            || site.status === 'anu_bluefield'
            || site.status === 'operational'
            || site.status === 'under_construction'
            || (site.configuration === 'lake_pair'
                && (site.status || '').indexOf('bluefield') !== -1);
        if (hasAnuData && headHeight && site.storage_mwh) {
            anuResult = HB.Cost.engine.anuModel({
                headM: headHeight,
                separationM: tunnelLength || ((site.separation_km || site.anu_separation_km || 5) * 1000),
                energyGWh: site.storage_mwh / 1000,
                powerMW: site.capacity_mw,
                waterRockRatio: site.anu_water_rock_ratio || site.water_rock_ratio || 10,
                volumeGL: site.anu_volume_gl || site.volume_gl,
                damVolumeGL: site.anu_dam_volume_mm3 || site.dam_volume_mm3,
                reservoirAreaHa: site.anu_reservoir_area_ha || site.reservoir_area_ha,
                country: site.country || 'default',
                useExistingReservoirs: isBluefieldExisting
            });

            if (isBluefieldExisting && anuResult) {
                const isFullyBuilt = site.status === 'operational'
                    || site.status === 'under_construction';

                if (isFullyBuilt) {
                    // All civil infrastructure sunk cost — no new CAPEX
                    anuResult.components.reservoirs_M = 0;
                    anuResult.components.tunnel_M     = 0;
                    anuResult.components.powerhouse_M = 0;
                    anuResult.components.overhead_M   = 0;
                    anuResult.summary.totalCapexM     = 0;
                    anuResult.summary.totalCAPEX      = 0;
                    anuResult.summary.costPerKW       = 0;
                    anuResult.summary.costPerKWh      = 0;
                    anuResult.summary.breakdown.forEach(b => { b.value = 0; });
                    anuResult.summary.useExistingReservoirs    = true;
                    anuResult.summary.isExistingInfrastructure = true;
                } else {
                    // ANU Bluefield — lake pair exists (reservoirs sunk), but tunnel +
                    // powerhouse have NOT been built yet and are real new CAPEX.
                    const ovhIdx = anuResult.components.overheadIndex || 1;
                    anuResult.components.reservoirs_M  = 0;
                    anuResult.summary.breakdown[0].value = 0;   // reservoir slice → $0
                    const newTotalM = (anuResult.components.tunnel_M
                                    + anuResult.components.powerhouse_M) * ovhIdx;
                    anuResult.summary.totalCapexM = Math.round(newTotalM * 1000) / 1000;
                    anuResult.summary.totalCAPEX  = newTotalM * 1e6;
                    anuResult.summary.costPerKW   = site.capacity_mw
                        ? Math.round(newTotalM * 1e6 / (site.capacity_mw * 1000) * 10) / 10 : 0;
                    anuResult.summary.costPerKWh  = site.storage_mwh
                        ? Math.round(newTotalM * 1e6 / (site.storage_mwh * 1000) * 100) / 100 : 0;
                    anuResult.summary.useExistingReservoirs = true;
                    anuResult.summary.isExistingReservoirs  = true;
                }
            }
        }

        const costResult = HB.Cost.engine.calculate({
            headHeight,
            tunnelLength,
            energyKWh,
            powerKW,
            configuration: site.configuration || 'lake_pair',
        });

        const detailSite = {
            name: site.name,
            status: site.status,
            country: site.country,
            region: site.region,
            upper: {
                label:            site.upper_reservoir || null,
                reservoir_id:     site.upper_reservoir_id || null,
                elevation:        site.upper_elevation_m ?? site.upper_elev_m ?? site.upper_elev_nwl_m ?? null,
                elev_nwl_m:       site.upper_elev_nwl_m ?? null,
                elev_min_m:       site.upper_elev_min_m ?? null,
                area_ha:          site.upper_area_ha ?? null,
                volume_gl:        site.upper_volume_gl ?? site.upper_vol_gl ?? null,
                volume_active_gl: site.upper_volume_active_gl ?? null,
                max_depth_m:      site.upper_max_depth_m ?? null,
                depth_fluct_m:    site.upper_depth_fluct_m ?? null,
                dam_height_m:     site.upper_dam_height_m ?? null,
                dam_crest_m:      site.upper_dam_crest_m ?? null,
            },
            lower: {
                label:            site.lower_reservoir || null,
                reservoir_id:     site.lower_reservoir_id || null,
                elevation:        site.lower_elevation_m ?? site.lower_elev_m ?? site.lower_elev_nwl_m ?? null,
                elev_nwl_m:       site.lower_elev_nwl_m ?? null,
                elev_min_m:       site.lower_elev_min_m ?? null,
                area_ha:          site.lower_area_ha ?? null,
                volume_gl:        site.lower_volume_gl ?? site.lower_vol_gl ?? null,
                volume_total_gl:  site.lower_volume_total_gl ?? null,
                volume_active_gl: site.lower_volume_active_gl ?? null,
                max_depth_m:      site.lower_max_depth_m ?? null,
                depth_fluct_m:    site.lower_depth_fluct_m ?? null,
                dam_height_m:     site.lower_dam_height_m ?? null,
                dam_length_m:     site.lower_dam_length_m ?? null,
                dam_volume_gl:    site.lower_dam_volume_gl ?? null,
            },
            bearing_deg: site.bearing_deg,
            headHeight,
            tunnelLength,
            energyKWh,
            powerKW,
            configuration: site.configuration || 'lake_pair',
            description: site.description,
            source_url: site.source_url,
            year_commissioned: site.year_commissioned,
            costResult,
            anuResult,
            // Preserve ANU data for financial params recalculation
            water_rock_ratio: site.anu_water_rock_ratio || site.water_rock_ratio,
            volume_gl: site.anu_volume_gl || site.volume_gl,
            dam_volume_mm3: site.anu_dam_volume_mm3 || site.dam_volume_mm3,
            reservoir_area_ha: site.anu_reservoir_area_ha || site.reservoir_area_ha,
            separation_km: site.separation_km || site.anu_separation_km,
            capacity_mw: site.capacity_mw,
            isdam: site.isdam,
            gsa: site.gsa || null,
            lat: site.lat,
            lng: site.lng,
            storage_mwh: site.storage_mwh,
            // Embedded polygon / pipeline data (required for _drawEmbeddedPolygons)
            upper_polygon: site.upper_polygon || null,
            lower_polygon: site.lower_polygon || null,
            pipe_geometry: site.pipe_geometry || null,
            anu_id_upper: site.anu_id_upper || null,
            anu_id_lower: site.anu_id_lower || null,
            anu_tunnel_km: site.anu_tunnel_km || null,
            anu_tunnel_slope_pct: site.anu_tunnel_slope_pct || null,
            anu_flow_m3s: site.anu_flow_m3s || null,
            // Exact reservoir lat/lng for satellite map centering
            upper_lat: site.upper_lat ?? null,
            upper_lng: site.upper_lng ?? null,
            lower_lat: site.lower_lat ?? null,
            lower_lng: site.lower_lng ?? null,
        };

        this.show(detailSite);

        // Fly to site
        if (site.lat && site.lng) {
            HB.Map.flyTo(site.lat, site.lng, 12);
        }
    },

    _renderParams(site) {
        const tbody = document.querySelector('#site-params-table tbody');
        tbody.innerHTML = '';

        // Normalise field names — search results use nested objects; knownSites use flat fields
        const upperElev  = site.upper?.elevation ?? site.upper_elevation_m ?? site.upper_elev_m ?? site.upper_elev_nwl_m ?? null;
        const lowerElev  = site.lower?.elevation ?? site.lower_elevation_m ?? site.lower_elev_m ?? site.lower_elev_nwl_m ?? null;
        const headH      = site.headHeight ?? site.head_m ?? null;
        const tunnelM    = site.tunnelLength ?? site.tunnel_length_m ?? site.separationM ?? null;
        const energyKWh  = site.energyKWh ?? (site.storage_mwh != null ? site.storage_mwh * 1000 : null);
        const powerKW    = site.powerKW   ?? (site.capacity_mw  != null ? site.capacity_mw  * 1000 : null);

        // Helper to resolve reservoir sub-fields — works for both detailSite (nested)
        // and raw knownSite objects (flat), so the panel renders correctly in both paths.
        const u = site.upper || {};
        const l = site.lower || {};
        const uLabel     = u.label         || site.upper_reservoir     || null;
        const uArea      = u.area_ha       ?? site.upper_area_ha       ?? null;
        const uVol       = u.volume_gl     ?? site.upper_volume_gl     ?? site.upper_vol_gl     ?? null;
        const uVolActive = u.volume_active_gl ?? site.upper_volume_active_gl ?? null;
        const uDepthF    = u.depth_fluct_m ?? site.upper_depth_fluct_m ?? null;
        const uDamH      = u.dam_height_m  ?? site.upper_dam_height_m  ?? null;
        const uElev2     = u.elev_nwl_m    ?? site.upper_elev_nwl_m    ?? null;
        const uElevMin   = u.elev_min_m    ?? site.upper_elev_min_m    ?? null;

        const lLabel     = l.label         || site.lower_reservoir     || null;
        const lArea      = l.area_ha       ?? site.lower_area_ha       ?? null;
        const lVol       = l.volume_gl     ?? site.lower_volume_gl     ?? site.lower_vol_gl     ?? null;
        const lVolTotal  = l.volume_total_gl  ?? site.lower_volume_total_gl  ?? null;
        const lVolActive = l.volume_active_gl ?? site.lower_volume_active_gl ?? null;
        const lDepth     = l.max_depth_m   ?? site.lower_max_depth_m   ?? null;
        const lDepthF    = l.depth_fluct_m ?? site.lower_depth_fluct_m ?? null;
        const lDamH      = l.dam_height_m  ?? site.lower_dam_height_m  ?? null;
        const lDamLen    = l.dam_length_m  ?? site.lower_dam_length_m  ?? null;
        const lElev2     = l.elev_nwl_m    ?? site.lower_elev_nwl_m    ?? null;
        const lElevMin   = l.elev_min_m    ?? site.lower_elev_min_m    ?? null;

        const params = [
            ['Configuration', (site.configuration || 'lake_pair').replace(/_/g, ' ')],
            ['Country / Region', [site.country, site.region].filter(Boolean).join(', ') || '--'],
            ...(uLabel    ? [['Upper Reservoir', uLabel]]                                               : []),
            ['Upper Elevation',   upperElev != null ? `${Math.round(upperElev)} m` : '--'],
            ...(uElev2  != null && uElev2  !== upperElev ? [['Upper NWL',          `${Math.round(uElev2)} m`]]  : []),
            ...(uElevMin != null                         ? [['Upper Min Level',    `${Math.round(uElevMin)} m`]] : []),
            ...(uArea    != null ? [['Upper Reservoir Area',   `${uArea} ha`]]                          : []),
            ...(uVol     != null ? [['Upper Reservoir Volume', uVolActive != null ? `${uVolActive} GL active / ${uVol} GL total` : `${uVol} GL`]] : []),
            ...(uDepthF  != null ? [['Upper Level Fluctuation', `${uDepthF} m`]]                        : []),
            ...(uDamH    != null ? [['Upper Dam Height', `${uDamH} m`]]                                 : []),
            ...(lLabel    ? [['Lower Reservoir', lLabel]]                                               : []),
            ['Lower Elevation',   lowerElev != null ? `${Math.round(lowerElev)} m` : '--'],
            ...(lElev2  != null && lElev2  !== lowerElev ? [['Lower NWL',          `${Math.round(lElev2)} m`]]  : []),
            ...(lElevMin != null                         ? [['Lower Min Level',    `${Math.round(lElevMin)} m`]] : []),
            ...(lArea    != null ? [['Lower Reservoir Area',   `${lArea} ha`]]                          : []),
            ...(lVol != null || lVolTotal != null ? [['Lower Reservoir Volume',
                lVolActive != null && lVolTotal != null ? `${lVolActive} GL active / ${lVolTotal} GL total`
                : lVolActive != null                    ? `${lVolActive} GL active`
                : lVolTotal  != null                    ? `${lVolTotal} GL total`
                                                        : `${lVol} GL`]]                               : []),
            ...(lDepth   != null ? [['Lower Max Depth',   `${lDepth} m`]]                               : []),
            ...(lDepthF  != null ? [['Lower Level Fluctuation', `${lDepthF} m`]]                        : []),
            ...(lDamH    != null ? [['Lower Dam Height',  `${lDamH} m`]]                                : []),
            ...(lDamLen  != null ? [['Lower Dam Length',  `${lDamLen} m`]]                              : []),
            ['Head Height',     headH     != null ? `${Math.round(headH)} m`     : '--'],
            ...(site.bearing_deg != null ? [['Bearing', `${site.bearing_deg}°`]] : []),
            ['Tunnel Length',   tunnelM   != null ? `${(tunnelM / 1000).toFixed(1)} km` : '--'],
            ['Energy Storage',  energyKWh != null ? HB.Utils.formatEnergy(energyKWh)    : '--'],
            ['Power Capacity',  powerKW   != null ? HB.Utils.formatPower(powerKW)       : '--'],
            ['Storage Duration', energyKWh != null && powerKW != null ?
                `${(energyKWh / powerKW).toFixed(1)} hours` : '--'],
        ];

        if (site.costResult?.engineering) {
            const eng = site.costResult.engineering;
            params.push(
                ['Water Volume', HB.Utils.formatVolume(eng.waterVolume)],
                ['Flow Rate', `${eng.flowRate.toFixed(1)} m\u00B3/s`],
                ['Penstock Diameter', `${eng.penstockDiameter.toFixed(2)}m`],
                ['Net Head', `${Math.round(eng.netHead)}m`],
                ['Turbine Type', eng.turbineType],
                ['Units', eng.numUnits],
                ['Efficiency', `${(eng.efficiency * 100).toFixed(0)}%`]
            );
        }

        if (site.year_commissioned) {
            params.push(['Year Commissioned', site.year_commissioned]);
        }

        // Solar resource (GSA data)
        if (site.gsa) {
            const g = site.gsa;
            const peakH = (g.pvoutYear / 365).toFixed(1);
            params.push(['FPV Solar Resource',
                `GHI ${g.ghiYear} kWh/m\u00B2/yr \u00B7 PVOUT ${g.pvoutYear} kWh/kWp/yr \u00B7 ${peakH} peak h/day`]);
        }

        // GSA report link
        if (site.lat != null && site.lng != null) {
            const gsaUrl = `https://globalsolaratlas.info/detail?c=${site.lat},${site.lng},11&m=site&s=${site.lat},${site.lng}&pv=hydro,180,10,1000`;
            params.push(['Global Solar Atlas', `<a href="${gsaUrl}" target="_blank" style="color:var(--accent);text-decoration:none;">View GSA Report \u2197</a>`]);
        }

        // HydroATLAS enrichment data (water resource)
        const hydroData = HB.Data.hydroAtlas && HB.Data.hydroAtlas[site.id];
        if (hydroData) {
            if (hydroData.lake) {
                const lk = hydroData.lake;
                const typeLabel = lk.lake_type === 2 ? 'Reservoir' : lk.lake_type === 3 ? 'Controlled Lake' : 'Natural Lake';
                const namePart = lk.lake_name ? `${lk.lake_name} ` : '';
                params.push(['\u{1F4A7} Nearest Water Body',
                    `${namePart}${typeLabel} (${lk.lake_dist_km} km away)`]);
                if (lk.lake_area_km2)
                    params.push(['Lake Area', `${lk.lake_area_km2} km\u00B2`]);
                if (lk.lake_vol_mcm)
                    params.push(['Lake Volume', `${lk.lake_vol_mcm.toLocaleString()} Mm\u00B3`]);
                if (lk.lake_depth_avg_m)
                    params.push(['Avg Depth', `${lk.lake_depth_avg_m} m`]);
                if (lk.lake_discharge_m3s)
                    params.push(['Lake Discharge', `${lk.lake_discharge_m3s} m\u00B3/s`]);
                if (lk.lake_res_time_days)
                    params.push(['Residence Time', `${Math.round(lk.lake_res_time_days)} days (${(lk.lake_res_time_days / 365).toFixed(1)} yr)`]);
                if (lk.lake_elevation_m != null)
                    params.push(['Lake Elevation', `${lk.lake_elevation_m} m`]);
            }
            if (hydroData.basin) {
                const b = hydroData.basin;
                if (b.discharge_m3s)
                    params.push(['Basin Discharge', `${b.discharge_m3s} m\u00B3/s`]);
                if (b.precip_mm_yr)
                    params.push(['Precipitation', `${b.precip_mm_yr} mm/yr`]);
                if (b.pet_mm_yr)
                    params.push(['Evapotranspiration', `${b.pet_mm_yr} mm/yr (PET)`]);
                if (b.aridity_index != null)
                    params.push(['Aridity Index', b.aridity_index]);
                if (b.protected_area_pct)
                    params.push(['\u26A0 Protected Area', `${b.protected_area_pct}% of catchment`]);
                if (b.forest_pct)
                    params.push(['Forest Cover', `${b.forest_pct}%`]);
                if (b.temp_c_avg != null)
                    params.push(['Mean Temp', `${b.temp_c_avg}\u00B0C`]);
            }
            params.push(['Data Source',
                '<a href="https://www.hydrosheds.org" target="_blank" style="color:var(--accent);text-decoration:none;">HydroSHEDS / HydroATLAS (CC-BY 4.0) \u2197</a>']);
        }

        if (site.description) {
            params.push(['Description', site.description]);
        }

        params.forEach(([label, value]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${label}</td><td>${value}</td>`;
            tbody.appendChild(tr);
        });
    },

    // -----------------------------------------------------------------------
    // SITE VIEW — satellite mini-map (ANU/known) or canvas cross-section
    // -----------------------------------------------------------------------

    /**
     * Router: shows a Leaflet satellite mini-map when the site has lat/lng,
     * otherwise falls back to the canvas cross-section diagram.
     */
    _renderSiteView(site) {
        const lat  = site.lat  ?? site.latitude;
        const lng  = site.lng  ?? site.longitude;
        const hasCoords = lat != null && lng != null && isFinite(lat) && isFinite(lng);

        const mapDiv    = document.getElementById('site-satellite-map');
        const canvas    = document.getElementById('cross-section-canvas');
        const title     = document.getElementById('site-view-title');
        const footer    = document.getElementById('site-view-footer');
        const anuLink   = document.getElementById('site-anu-link');
        const attrSpan  = document.getElementById('site-view-attribution');

        if (hasCoords) {
            // Show satellite mini-map, hide canvas
            mapDiv.style.display  = 'block';
            canvas.style.display  = 'none';
            title.textContent     = 'Reservoir Pair — Satellite View';
            footer.style.display  = 'flex';
            attrSpan.textContent  = 'Imagery © Esri';
            // ANU atlas link — global atlas (no deep-link API available)
            anuLink.href = site.source_url || 'https://re100.eng.anu.edu.au/global/';
            anuLink.style.display = '';

            this._showSatelliteMap(site, lat, lng, mapDiv);
        } else {
            // No coords — show canvas cross-section
            mapDiv.style.display  = 'none';
            canvas.style.display  = 'block';
            title.textContent     = 'Cross-Section';
            footer.style.display  = 'none';
            this._drawCrossSection(site);
        }
    },

    /**
     * Create or update the Leaflet satellite mini-map centred on the lake pair.
     * Uses ESRI World Imagery tiles (free, no key) + ANU GeoServer WFS polygons.
     */
    _showSatelliteMap(site, lat, lng, container) {
        const sepKm = site.separation_km ?? (site.separationM ? site.separationM / 1000 : site.tunnelLength ? site.tunnelLength / 1000 : 5);

        // Use exact reservoir coordinates when available, otherwise estimate from centre + separation
        const hasExactCoords = site.upper_lat != null && site.upper_lng != null
                            && site.lower_lat != null && site.lower_lng != null;
        const headM   = site.head_m ?? site.headHeight ?? site.headM ?? null;
        let upperLatLng, lowerLatLng, centerLat, centerLng;

        if (hasExactCoords) {
            upperLatLng = [site.upper_lat, site.upper_lng];
            lowerLatLng = [site.lower_lat, site.lower_lng];
            centerLat   = (site.upper_lat + site.lower_lat) / 2;
            centerLng   = (site.upper_lng + site.lower_lng) / 2;
        } else {
            const deltaLat = (sepKm / 2) / 111;
            upperLatLng = [lat + deltaLat, lng];
            lowerLatLng = [lat - deltaLat, lng];
            centerLat   = lat;
            centerLng   = lng;
        }

        // Zoom level inversely proportional to separation
        const zoom = sepKm < 1   ? 14
                   : sepKm < 3   ? 13
                   : sepKm < 8   ? 12
                   : sepKm < 20  ? 11
                   : sepKm < 50  ? 10 : 9;

        if (!this._miniMap) {
            this._miniMap = L.map(container, {
                center: [centerLat, centerLng],
                zoom,
                zoomControl:        true,
                attributionControl: false,
                scrollWheelZoom:    false,
                dragging:           true,
                doubleClickZoom:    true
            });

            L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 18 }
            ).addTo(this._miniMap);

            L.tileLayer(
                'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 18, opacity: 0.55 }
            ).addTo(this._miniMap);

            // Coordinate crosshair overlay — shows lat/lng under cursor so positions can be verified
            const coordBox = document.createElement('div');
            coordBox.id = 'minimap-coords';
            coordBox.style.cssText = 'position:absolute;bottom:6px;left:6px;z-index:1000;background:rgba(0,0,0,0.65);color:#fff;font-size:10px;font-family:monospace;padding:2px 6px;border-radius:3px;pointer-events:none;display:none;';
            container.style.position = 'relative';
            container.appendChild(coordBox);
            this._miniMap.on('mousemove', e => {
                coordBox.style.display = 'block';
                coordBox.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
            });
            this._miniMap.on('mouseout', () => { coordBox.style.display = 'none'; });

            this._miniMapLayers = {};
            // Must call invalidateSize after Leaflet renders into a previously-hidden div
            setTimeout(() => this._miniMap.invalidateSize(), 100);
        } else {
            this._miniMap.setView([centerLat, centerLng], zoom);
            Object.values(this._miniMapLayers).forEach(l => {
                if (l) this._miniMap.removeLayer(l);
            });
            this._miniMapLayers = {};
            setTimeout(() => this._miniMap.invalidateSize(), 50);
        }

        // --- Reservoir markers ---
        const circleOpts = (color, ttl) => ({
            radius: 8, color, weight: 2,
            fillColor: color, fillOpacity: 0.75, title: ttl
        });
        // Resolve labels from nested upper/lower objects (detailSite path) with flat fallbacks
        const uRes  = site.upper || {};
        const lRes  = site.lower || {};
        const uName = uRes.label || site.upper_reservoir || null;
        const lName = lRes.label || site.lower_reservoir || null;
        const uElevLabel = uRes.elevation ?? site.upper_elev_m ?? site.upper_elevation_m ?? null;
        const lElevLabel = lRes.elevation ?? site.lower_elev_m ?? site.lower_elevation_m ?? null;
        const upperLabel = uName
            ? `⬆ ${uName.replace(/ \(.*/, '')}<br>${headM != null ? Math.round(headM) + ' m head · ' : ''}${uElevLabel != null ? uElevLabel + 'm ASL' : ''}`
            : `⬆ Upper reservoir${headM != null ? ' — ' + Math.round(headM) + ' m head' : ''}`;
        const lowerLabel = lName
            ? `⬇ ${lName.replace(/ \(.*/, '')}<br>${lElevLabel != null ? lElevLabel + 'm ASL' : ''}`
            : '⬇ Lower reservoir';

        const upperPH = L.circleMarker(upperLatLng,
            circleOpts('#1565C0', upperLabel))
            .bindTooltip(upperLabel, { permanent: false })
            .addTo(this._miniMap);
        const lowerPH = L.circleMarker(lowerLatLng,
            circleOpts('#42A5F5', lowerLabel))
            .bindTooltip(lowerLabel, { permanent: false })
            .addTo(this._miniMap);
        const pairLine = L.polyline([upperLatLng, lowerLatLng], {
            color: '#e74c3c', weight: 3, dashArray: '6 4', opacity: 0.85
        }).addTo(this._miniMap);

        // Add tunnel/penstock popup to the pair line so all site types get clickable data
        {
            const lenKm  = site.anu_tunnel_km || site.separation_km
                           || (site.tunnelLength ? (site.tunnelLength / 1000).toFixed(1) : null) || '—';
            const slope  = site.anu_tunnel_slope_pct || '—';
            const headM  = site.headHeight ?? site.head_m ?? site.headM ?? '—';
            const flowM3 = site.anu_flow_m3s || '—';
            pairLine.bindTooltip('Penstock / Tunnel — click for details', { sticky: true, className: 'anu-tip' });
            pairLine.bindPopup(`
                <div style="font-family:system-ui,sans-serif;min-width:200px;">
                  <div style="background:#e67e22;color:#fff;
                       padding:7px 14px;margin:-12px -16px 10px;
                       border-radius:4px 4px 0 0;font-size:13px;font-weight:700;">
                    ⚡ Penstock / Tunnel
                  </div>
                  <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.6;">
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Length</td><td>${lenKm} km</td></tr>
                    <tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Slope</td><td>${slope !== '—' ? slope + '%' : '—'}</td></tr>
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Head</td><td>${headM !== '—' ? Math.round(headM) + ' m' : '—'}</td></tr>
                    ${flowM3 !== '—' ? `<tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Flow</td><td>${flowM3} m³/s</td></tr>` : ''}
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Source</td>
                        <td style="font-size:10px;color:#666;">${site.anu_tunnel_km ? 'ANU RE100 (embedded)' : 'Estimated'}</td></tr>
                  </table>
                </div>`, { maxWidth: 260, className: 'anu-popup' }
            );
        }

        this._miniMapLayers = { upperMarker: upperPH, lowerMarker: lowerPH, pairLine };

        // If site has pre-fetched polygon coordinates, render them directly —
        // _drawEmbeddedPolygons handles its own fitBounds inside a setTimeout.
        // Otherwise fit bounds to placeholder markers, then attempt live WFS fetch.
        if (site.upper_polygon || site.lower_polygon) {
            this._drawEmbeddedPolygons(site);
        } else {
            // Fit bounds to show both placeholder markers while WFS loads
            setTimeout(() => {
                if (this._miniMap) {
                    this._miniMap.invalidateSize();
                    const bounds = L.latLngBounds([upperLatLng, lowerLatLng]).pad(0.25);
                    this._miniMap.fitBounds(bounds, { maxZoom: 14 });
                }
            }, 150);
            this._loadANUPolygons(site, lat, lng, sepKm);
        }
    },

    /**
     * Render reservoir polygons that are embedded directly in the site data object.
     * Used when the ANU WFS is not accessible cross-origin (CORS blocked) or
     * when the layer requires authentication ("Protected" brownfield sites).
     *
     * Expects site.upper_polygon and/or site.lower_polygon as GeoJSON Geometry
     * objects (type Polygon or MultiPolygon, coordinates in [lng,lat] order).
     */
    _drawEmbeddedPolygons(site) {
        if (!this._miniMap) return;

        // Remove placeholder dot-markers placed by _showSatelliteMap
        ['upperMarker', 'lowerMarker', 'pairLine'].forEach(k => {
            if (this._miniMapLayers?.[k]) {
                this._miniMap.removeLayer(this._miniMapLayers[k]);
                delete this._miniMapLayers[k];
            }
        });

        const features = [];
        if (site.upper_polygon) {
            features.push({
                type: 'Feature',
                properties: {
                    isupper: '1', isdam: false, ispipe: false,
                    identifier: site.anu_id_upper || site.upper?.reservoir_id || site.upper?.label || 'Upper reservoir'
                },
                geometry: site.upper_polygon
            });
        }
        if (site.lower_polygon) {
            features.push({
                type: 'Feature',
                properties: {
                    isupper: '0', isdam: false, ispipe: false,
                    identifier: site.anu_id_lower || site.lower?.reservoir_id || site.lower?.label || 'Lower reservoir'
                },
                geometry: site.lower_polygon
            });
        }
        if (!features.length) return;

        const isUp = f => f.properties.isupper === '1' || f.properties.isupper === 1;

        const polyLayer = L.geoJSON(
            { type: 'FeatureCollection', features },
            {
                style: f => {
                    const up = isUp(f);
                    return {
                        fillColor:   up ? '#1565C0' : '#42A5F5',
                        fillOpacity: 0.45,
                        color:       up ? '#0D47A1' : '#1976D2',
                        weight: 2.5, opacity: 0.95
                    };
                },
                onEachFeature: (feature, layer) => {
                    const up  = isUp(feature);
                    const rid = feature.properties.identifier;
                    const res  = up ? site.upper : site.lower;
                    const elev = res?.elevation ?? (up ? site.upper_elev_m : site.lower_elev_m) ?? null;
                    const area = res?.area_ha   ?? (up ? site.upper_area_ha : site.lower_area_ha) ?? null;
                    const vol  = res?.volume_gl ?? (up ? (site.upper_vol_gl ?? site.upper_volume_gl) : (site.lower_vol_gl ?? site.lower_volume_gl)) ?? null;
                    const volA = res?.volume_active_gl ?? (up ? site.upper_volume_active_gl : site.lower_volume_active_gl) ?? null;
                    const volT = res?.volume_total_gl  ?? (up ? null : site.lower_volume_total_gl) ?? null;
                    const dep  = res?.max_depth_m   ?? (up ? site.upper_max_depth_m : site.lower_max_depth_m) ?? null;
                    const dflc = res?.depth_fluct_m ?? (up ? site.upper_depth_fluct_m : site.lower_depth_fluct_m) ?? null;
                    const damH = res?.dam_height_m  ?? (up ? site.upper_dam_height_m : site.lower_dam_height_m) ?? null;

                    const volStr = volA != null && volT != null ? `${volA} GL active / ${volT} GL total`
                                 : volA != null ? `${volA} GL active`
                                 : volT != null ? `${volT} GL total`
                                 : vol  != null ? `${vol} GL` : null;

                    const td = (label, value, shade) =>
                        `<tr${shade ? ' style="background:#EEF4FB;"' : ''}><td style="color:#555;font-weight:600;padding-right:12px;white-space:nowrap;">${label}</td><td>${value}</td></tr>`;

                    layer.bindTooltip(
                        `${up ? '⬆ Upper' : '⬇ Lower'} reservoir — click for details`,
                        { sticky: true, className: 'anu-tip' }
                    );
                    layer.bindPopup(`
                        <div style="font-family:system-ui,sans-serif;min-width:200px;">
                          <div style="background:${up ? '#1565C0' : '#1976D2'};color:#fff;
                               padding:7px 14px;margin:-12px -16px 10px;
                               border-radius:4px 4px 0 0;font-size:13px;font-weight:700;">
                            ${up ? '⬆ Upper' : '⬇ Lower'} Reservoir
                          </div>
                          <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.6;">
                            ${td('ID',        rid,          false)}
                            ${elev   != null ? td('Elevation',        `${elev} m ASL`,  true)  : ''}
                            ${area   != null ? td('Area',             `${area} ha`,     false) : ''}
                            ${volStr != null ? td('Volume',           volStr,           true)  : ''}
                            ${dep    != null ? td('Max Depth',        `${dep} m`,       false) : ''}
                            ${dflc   != null ? td('Level Fluctuation',`${dflc} m`,      true)  : ''}
                            ${damH   != null ? td('Dam Height',       `${damH} m`,      false) : ''}
                            ${td('Source', '<span style="font-size:10px;color:#666;">ANU RE100 (embedded)</span>', true)}
                          </table>
                        </div>`, { maxWidth: 300, className: 'anu-popup' }
                    );
                }
            }
        ).addTo(this._miniMap);

        this._miniMapLayers.polygons = polyLayer;

        // Pipeline / penstock — orange line matching ANU Atlas style.
        // If embedded pipe_geometry exists use that; otherwise draw a thin
        // dashed red fallback line between the two reservoir centre-points.
        if (site.pipe_geometry) {
            const pipeLayer = L.geoJSON(
                { type: 'Feature', geometry: site.pipe_geometry, properties: {} },
                {
                    style: () => ({
                        color:   '#e67e22',   // ANU Atlas penstock orange
                        weight:  4,
                        opacity: 0.95
                    }),
                    onEachFeature: (feature, layer) => {
                        layer.bindTooltip('Penstock / Tunnel — click for details',
                            { sticky: true, className: 'anu-tip' });
                        const lenKm  = site.anu_tunnel_km     || site.separation_km || '—';
                        const slope  = site.anu_tunnel_slope_pct || '—';
                        const headM  = site.headHeight ?? site.head_m ?? site.headM ?? '—';
                        const flowM3 = site.anu_flow_m3s || '—';
                        layer.bindPopup(`
                            <div style="font-family:system-ui,sans-serif;min-width:200px;">
                              <div style="background:#e67e22;color:#fff;
                                   padding:7px 14px;margin:-12px -16px 10px;
                                   border-radius:4px 4px 0 0;font-size:13px;font-weight:700;">
                                ⚡ Penstock / Tunnel
                              </div>
                              <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.6;">
                                <tr><td style="color:#555;font-weight:600;padding-right:12px;">Length</td><td>${lenKm} km</td></tr>
                                <tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Slope</td><td>${slope !== '—' ? slope + '%' : '—'}</td></tr>
                                <tr><td style="color:#555;font-weight:600;padding-right:12px;">Head</td><td>${headM !== '—' ? Math.round(headM) + ' m' : '—'}</td></tr>
                                ${flowM3 !== '—' ? `<tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Flow</td><td>${flowM3} m³/s</td></tr>` : ''}
                                <tr><td style="color:#555;font-weight:600;padding-right:12px;">Source</td>
                                    <td style="font-size:10px;color:#666;">ANU RE100 (embedded)</td></tr>
                              </table>
                            </div>`, { maxWidth: 260, className: 'anu-popup' }
                        );
                    }
                }
            ).addTo(this._miniMap);
            this._miniMapLayers.pipeline = pipeLayer;
        } else if (site.upper_lat != null && site.lower_lat != null) {
            // Fallback: dashed red line between reservoir centres
            const pLine = L.polyline(
                [[site.upper_lat, site.upper_lng], [site.lower_lat, site.lower_lng]],
                { color: '#e74c3c', weight: 2, dashArray: '6 4', opacity: 0.85 }
            ).addTo(this._miniMap);
            this._miniMapLayers.pairLine = pLine;
        }

        // Compute individual bounds for zoom buttons
        const upperFeats = features.filter(f => isUp(f));
        const lowerFeats = features.filter(f => !isUp(f));
        const upperBounds = upperFeats.length
            ? L.geoJSON({ type: 'FeatureCollection', features: upperFeats }).getBounds()
            : null;
        const lowerBounds = lowerFeats.length
            ? L.geoJSON({ type: 'FeatureCollection', features: lowerFeats }).getBounds()
            : null;
        const bothBounds  = polyLayer.getBounds();

        this._setupZoomButtons(upperBounds, lowerBounds, bothBounds);

        // Default view: lower reservoir at high zoom (larger and more visible);
        // fall back to combined bounds if only one polygon exists.
        setTimeout(() => {
            if (!this._miniMap) return;
            this._miniMap.invalidateSize();
            const target = lowerBounds && lowerBounds.isValid() ? lowerBounds : bothBounds;
            const pad    = (lowerBounds && upperBounds) ? 0.35 : 0.2;
            this._miniMap.fitBounds(target.pad(pad), { maxZoom: 15 });
        }, 150);

        const attrEl = document.getElementById('site-view-attribution');
        if (attrEl) attrEl.textContent = 'Imagery © Esri  |  Reservoir outlines © ANU RE100';
    },

    /**
     * Resolve the ANU GeoServer WFS layer name from the site's tier/type.
     *
     * ANU WFS layers (all MultiPolygon, one feature per reservoir):
     *   global_bluefield:2gwh_6h   global_greenfield:2gwh_6h
     *   global_bluefield:5gwh_18h  global_greenfield:5gwh_18h
     *   global_bluefield:15gwh_18h global_greenfield:15gwh_18h
     *   global_brownfield:2gwh_6h  …
     */
    _anuWfsLayer(site) {
        const id     = site.id || '';
        const tier   = (site.anu_tier || site.tier || '').toLowerCase();
        const status = (site.status || '').toLowerCase();

        // Workspace
        const ws = id.startsWith('anu_gf') || status.includes('greenfield')
                 ? 'global_greenfield'
                 : id.startsWith('anu_br') || status.includes('brownfield')
                 ? 'global_brownfield'
                 : 'global_bluefield';

        // Energy tier → layer suffix
        const suffix = tier.includes('5gwh') || tier === '5gwh_18h' ? '5gwh_18h'
                     : tier.includes('2gwh') || tier === '2gwh_6h'  ? '2gwh_6h'
                     : '15gwh_18h';   // default (15 GWh has widest coverage)

        return { ws, layer: `${ws}:${suffix}` };
    },

    /**
     * Parse the ANU WFS `description` HTML table into a plain key→value object.
     * The description field looks like:
     *   <table>…<tr><td>Class</td><td>B</td></tr>…</table>
     */
    _parseANUDescription(html) {
        if (!html) return {};
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const data = {};
            doc.querySelectorAll('tr').forEach(tr => {
                const cells = [...tr.querySelectorAll('td, th')];
                if (cells.length >= 2) {
                    const key = cells[0].textContent.trim().replace(/:$/, '');
                    data[key] = cells[1].textContent.trim();
                }
            });
            return data;
        } catch (e) { return {}; }
    },

    /**
     * Fetch ANU GeoServer WFS features for this site's bounding box and render:
     *   • Reservoir polygons  (isdam=false, isupper='0'|'1') — blue lake outlines
     *   • Pipeline LineString (ispipe=true)                  — actual tunnel geometry
     *
     * All popup data comes from the `description` HTML field (reservoir features)
     * or from the WFS properties directly (pipeline features), matching the ANU Atlas.
     */
    _loadANUPolygons(site, lat, lng, sepKm) {
        const fetchId = `${lat},${lng}`;
        this._pendingFetch = fetchId;

        // Skip WFS entirely for non-ANU sites (mine voids, operational, proposed, etc.)
        // to avoid unnecessary network requests that always fail via CORS.
        const isAnuSite = site.anu_id_upper || site.anu_id_lower
            || (site.status || '').startsWith('anu_')
            || site.anu_tier || site.anu_class;
        if (!isAnuSite) {
            this._drawFallbackReservoirs(site);
            return;
        }

        // ── Dual-layer: upper and lower reservoirs in different ANU workspaces ──
        // (e.g. Mamut: upper in global_brownfield:5gwh_18h,
        //              lower in global_bluefield:15gwh_18h)
        const hasDual = site.upper_anu_layer && site.lower_anu_layer
                     && site.upper_anu_layer !== site.lower_anu_layer
                     && site.upper_lat && site.lower_lat;

        let fetchPromise;
        if (hasDual) {
            // Small bbox centred on each reservoir (~6 km radius)
            const m = 0.06;
            const mkUrl = (lyr, rlat, rlng) => {
                const ws2 = lyr.split(':')[0];
                return `https://re100.anu.edu.au/geoserver/${ws2}/wfs`
                     + `?service=WFS&version=2.0.0&request=GetFeature`
                     + `&typeNames=${encodeURIComponent(lyr)}`
                     + `&outputFormat=application%2Fjson&count=30`
                     + `&bbox=${(rlng-m).toFixed(5)},${(rlat-m).toFixed(5)},`
                     + `${(rlng+m).toFixed(5)},${(rlat+m).toFixed(5)},EPSG:4326`;
            };
            const upUrl = mkUrl(site.upper_anu_layer, site.upper_lat, site.upper_lng);
            const loUrl = mkUrl(site.lower_anu_layer, site.lower_lat, site.lower_lng);

            fetchPromise = Promise.all([
                fetch(upUrl).then(r => r.ok ? r.json() : {features:[]}).catch(() => ({features:[]})),
                fetch(loUrl).then(r => r.ok ? r.json() : {features:[]}).catch(() => ({features:[]}))
            ]).then(([upGj, loGj]) => {
                // Force-tag each feature with the correct isupper value so the
                // existing render block can colour them upper (dark blue) / lower (light blue)
                const upFeats = (upGj.features || []).map(f =>
                    ({ ...f, properties: { ...f.properties, isupper: '1' } }));
                const loFeats = (loGj.features || []).map(f =>
                    ({ ...f, properties: { ...f.properties, isupper: '0' } }));
                return { features: [...upFeats, ...loFeats] };
            });
        } else {
            // ── Single-layer: both reservoirs in the same ANU workspace ──────
            const { ws, layer } = this._anuWfsLayer(site);
            const margin = Math.max(0.08, (sepKm * 1.6) / 111);
            const bbox = `${(lng - margin).toFixed(5)},${(lat - margin).toFixed(5)},`
                       + `${(lng + margin).toFixed(5)},${(lat + margin).toFixed(5)},EPSG:4326`;
            const url = `https://re100.anu.edu.au/geoserver/${ws}/wfs`
                      + `?service=WFS&version=2.0.0&request=GetFeature`
                      + `&typeNames=${encodeURIComponent(layer)}`
                      + `&outputFormat=application%2Fjson&count=120`
                      + `&bbox=${bbox}`;
            fetchPromise = fetch(url)
                .then(r => { if (!r.ok) throw new Error(`WFS ${r.status}`); return r.json(); });
        }

        fetchPromise
            .then(geojson => {
                if (this._pendingFetch !== fetchId || !this._miniMap) return;

                const all = geojson.features || [];

                // ── Split by feature type ──────────────────────────────────────
                // isdam=true  → dam-wall overlay polygon     → skip
                // isupper 0/1 → reservoir lake polygon       → blue fill
                // ispipe=true → LineString tunnel geometry   → orange line
                const isUp  = v => v === '1' || v === 1;
                const isLow = v => v === '0' || v === 0;

                const strictResFeat = all.filter(f =>
                    !f.properties.isdam &&
                    (isUp(f.properties.isupper) || isLow(f.properties.isupper))
                );
                const pipeFeats = all.filter(f => f.properties.ispipe);

                // Lenient fallback: accept any non-dam non-pipe polygon.
                // Pit-lake / brownfield features may not have isupper set.
                const reservoirFeats = strictResFeat.length > 0
                    ? strictResFeat
                    : all.filter(f => !f.properties.isdam && !f.properties.ispipe &&
                          (f.geometry?.type === 'Polygon' ||
                           f.geometry?.type === 'MultiPolygon'));

                // If no reservoir polygons found, draw fallback circles regardless of
                // whether a pipe/tunnel feature was found (the WFS for Mamut returns
                // the tunnel LineString but no reservoir MultiPolygons).
                if (!reservoirFeats.length) {
                    this._drawFallbackReservoirs(site);
                    if (!pipeFeats.length) return;   // nothing else to draw
                    // else fall through — still render the real tunnel geometry below
                }

                // Remove placeholder markers/line (if fallback didn't already)
                ['upperMarker', 'lowerMarker', 'pairLine'].forEach(k => {
                    if (this._miniMapLayers[k]) {
                        this._miniMap.removeLayer(this._miniMapLayers[k]);
                        delete this._miniMapLayers[k];
                    }
                });

                // ── Shared helpers ─────────────────────────────────────────────
                const classColor = cl =>
                    cl === 'A' ? '#2e7d32' : cl === 'B' ? '#1565c0' :
                    cl === 'C' ? '#e65100' : '#c62828';

                // Build an HTML table from an array of [label, value] pairs.
                // Alternating rows get a light-blue background (ANU Atlas style).
                const buildTable = rows => rows.map(([k, v], i) =>
                    `<tr${i % 2 ? ' style="background:#EEF4FB;"' : ''}>
                        <td style="color:#555;padding:3px 12px 3px 0;white-space:nowrap;font-weight:600;">${k}</td>
                        <td style="padding:3px 0;">${v}</td>
                    </tr>`
                ).join('');

                const popup = (bgColor, title, tableHtml) => `
                    <div style="font-family:system-ui,sans-serif;min-width:230px;">
                        <div style="background:${bgColor};color:#fff;
                            padding:7px 14px;margin:-12px -16px 10px;
                            border-radius:4px 4px 0 0;font-size:13px;font-weight:700;
                            letter-spacing:.3px;">${title}</div>
                        <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.5;">
                            ${tableHtml}
                        </table>
                    </div>`;

                // ── Reservoir polygons ─────────────────────────────────────────
                if (reservoirFeats.length) {
                    const polyLayer = L.geoJSON(
                        { type: 'FeatureCollection', features: reservoirFeats },
                        {
                            style: f => {
                                const up = isUp(f.properties.isupper);
                                return {
                                    fillColor:   up ? '#1565C0' : '#42A5F5',
                                    fillOpacity: 0.40,
                                    color:       up ? '#0D47A1' : '#1976D2',
                                    weight:      2.5,
                                    opacity:     0.95
                                };
                            },
                            onEachFeature: (feature, layer) => {
                                const p   = feature.properties;
                                const up  = isUp(p.isupper);
                                const rid = (p.identifier || p.name || '').replace(/ Dam$/, '');

                                // description HTML keys carry units, e.g. "Elevation (m)",
                                // "Area (ha)", "Volume (GL)".  Parse them all and look up
                                // by both the keyed name and stripped variants.
                                const d = this._parseANUDescription(p.description);

                                // Helper: find value by any of the candidate key names
                                const dget = (...keys) => {
                                    for (const k of keys) {
                                        if (d[k] != null && d[k] !== '') return d[k];
                                    }
                                    return null;
                                };

                                const elev    = dget('Elevation (m)', 'Elevation');
                                const area    = dget('Area (ha)', 'Area');
                                const vol     = dget('Volume (GL)', 'Volume');
                                const dwh     = dget('Dam Wall Height (m)', 'Dam Wall Height');
                                const dlen    = dget('Dam Length (m)', 'Dam Length');
                                const dvol    = dget('Dam Volume (GL)', 'Dam Volume');
                                const wrock   = dget('Water/Rock Ratio', 'Water Rock Ratio');
                                const country = dget('Country');
                                const cls     = dget('Class');
                                const qlat    = dget('Latitude');
                                const qlng    = dget('Longitude');

                                layer.bindTooltip(
                                    `${up ? '⬆ Upper' : '⬇ Lower'} reservoir — click for details`,
                                    { sticky: true, className: 'anu-tip' }
                                );

                                const rows = [
                                    rid     && ['Reservoir ID',    rid],
                                    ['Role',                       up ? '⬆ Upper reservoir' : '⬇ Lower reservoir'],
                                    country && ['Country',         country],
                                    elev    && ['Elevation',       `${elev} m`],
                                    qlat    && ['Latitude',        qlat],
                                    qlng    && ['Longitude',       qlng],
                                    area    && ['Reservoir area',  `${Number(area).toLocaleString()} ha`],
                                    vol     && ['Volume',          `${vol} GL`],
                                    dwh     && ['Dam wall height', `${dwh} m`],
                                    dlen    && ['Dam length',      `${Number(dlen).toLocaleString()} m`],
                                    dvol    && ['Dam volume',      `${dvol} GL`],
                                    wrock   && ['Water:Rock ratio',wrock],
                                    cls     && ['Cost class',
                                        `<strong style="color:${classColor(cls)};">${cls}</strong>`],
                                ].filter(Boolean);

                                layer.bindPopup(
                                    popup(
                                        up ? '#1565C0' : '#1976D2',
                                        `${up ? '⬆ Upper' : '⬇ Lower'} Reservoir`,
                                        buildTable(rows)
                                    ),
                                    { maxWidth: 300, className: 'anu-popup' }
                                );
                            }
                        }
                    ).addTo(this._miniMap);
                    this._miniMapLayers.polygons = polyLayer;
                }

                // ── Pipeline LineStrings (actual ANU tunnel geometry) ──────────
                // Like reservoir features, pipe data lives in the description HTML.
                if (pipeFeats.length) {
                    const pipeLayer = L.geoJSON(
                        { type: 'FeatureCollection', features: pipeFeats },
                        {
                            style: () => ({
                                color:   '#e67e22',   // ANU Atlas penstock orange
                                weight:  4,
                                opacity: 0.95
                            }),
                            onEachFeature: (feature, layer) => {
                                const p = feature.properties;

                                // Parse description HTML (exact ANU Atlas key names confirmed from live WFS)
                                const d = this._parseANUDescription(p.description);
                                // Check description HTML first, then direct WFS property as fallback
                                const dget = k => {
                                    if (d[k] != null && d[k] !== '') return d[k];
                                    if (p[k] != null && p[k] !== '') return String(p[k]);
                                    return null;
                                };

                                const cls     = dget('Class');
                                const head    = dget('Head (m)');
                                const sep     = dget('Separation (km)');
                                const slope   = dget('Average Slope (%)');
                                const vol     = dget('Volume (GL)');
                                const wrock   = dget('Water to Rock (Pair)');
                                const energy  = dget('Energy (GWh)');
                                const storH   = dget('Storage time (h)');
                                // Key varies: Upper or Lower lake depending on site
                                const depthUp  = dget('Upper Lake Depth Fluctuation (m)');
                                const depthLow = dget('Lower Lake Depth Fluctuation (m)');
                                const depth    = depthUp || depthLow;
                                const depthLabel = depthUp
                                    ? 'Upper Lake Depth Fluct. (m)'
                                    : 'Lower Lake Depth Fluct. (m)';
                                const country = dget('Country');

                                layer.bindTooltip(
                                    'Tunnel / Penstock — click for details',
                                    { sticky: true, className: 'anu-tip' }
                                );

                                const rows = [
                                    cls     && ['Class',                      `<strong style="color:${classColor(cls)};">${cls}</strong>`],
                                    head    && ['Head (m)',                   head],
                                    sep     && ['Separation (km)',            sep],
                                    slope   && ['Average Slope (%)',          slope],
                                    vol     && ['Volume (GL)',                vol],
                                    wrock   && ['Water to Rock (Pair)',       wrock],
                                    energy  && ['Energy (GWh)',               energy],
                                    storH   && ['Storage time (h)',           storH],
                                    depth   && [depthLabel,                    depth],
                                    country && ['Country',                    country],
                                ].filter(Boolean);

                                layer.bindPopup(
                                    popup('#e67e22', 'Tunnel / Penstock', buildTable(rows)),
                                    { maxWidth: 300, className: 'anu-popup' }
                                );
                            }
                        }
                    ).addTo(this._miniMap);
                    this._miniMapLayers.pipeline = pipeLayer;
                }

                const attrEl = document.getElementById('site-view-attribution');
                if (attrEl) attrEl.textContent = 'Imagery © Esri  |  Reservoir outlines © ANU RE100';

                // Zoom buttons — compute bounds from rendered reservoir polygons
                if (this._miniMapLayers.polygons) {
                    const isUp = v => v === '1' || v === 1;
                    const renderedFeats = reservoirFeats;
                    const uFeats = renderedFeats.filter(f => isUp(f.properties.isupper));
                    const lFeats = renderedFeats.filter(f => !isUp(f.properties.isupper));
                    const uBounds = uFeats.length ? L.geoJSON({ type: 'FeatureCollection', features: uFeats }).getBounds() : null;
                    const lBounds = lFeats.length ? L.geoJSON({ type: 'FeatureCollection', features: lFeats }).getBounds() : null;
                    this._setupZoomButtons(uBounds, lBounds, this._miniMapLayers.polygons.getBounds());
                }
            })
            .catch(() => {
                // WFS unavailable or CORS — draw estimated circles from known reservoir data
                this._drawFallbackReservoirs(site);
            });
    },

    /**
     * When ANU WFS returns no polygon data (empty layer, CORS block, network error),
     * draw estimated L.circle shapes sized from the site's known area or volume.
     * Removes the placeholder dot-markers placed earlier by _showSatelliteMap.
     */

    /**
     * Create/update the Lower Reservoir / Upper Reservoir / Both zoom buttons.
     * Called from _drawEmbeddedPolygons, _loadANUPolygons, and _drawFallbackReservoirs
     * so every code path gets working zoom buttons.
     */
    _setupZoomButtons(upperBounds, lowerBounds, bothBounds) {
        const btnDiv = document.getElementById('site-reservoir-zoom-btns');
        if (!btnDiv || !this._miniMap) return;
        btnDiv.innerHTML = '';
        if (!upperBounds || !lowerBounds) { btnDiv.style.display = 'none'; return; }
        const mkBtn = (label, color, fn) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = `font-size:11px;padding:2px 9px;border:1px solid ${color};`
                + `background:#fff;color:${color};border-radius:3px;cursor:pointer;`
                + `font-family:system-ui,sans-serif;font-weight:600;`;
            b.addEventListener('mouseover', () => b.style.background = '#f0f4ff');
            b.addEventListener('mouseout',  () => b.style.background = '#fff');
            b.addEventListener('click', fn);
            return b;
        };
        const both = bothBounds
            || L.latLngBounds(upperBounds.getSouthWest(), upperBounds.getNorthEast()).extend(lowerBounds);
        btnDiv.appendChild(mkBtn('⬇ Lower Reservoir', '#1976D2', () =>
            this._miniMap.fitBounds(lowerBounds.pad(0.25), { maxZoom: 15 })));
        btnDiv.appendChild(mkBtn('⬆ Upper Reservoir', '#0D47A1', () =>
            this._miniMap.fitBounds(upperBounds.pad(0.5),  { maxZoom: 16 })));
        btnDiv.appendChild(mkBtn('↔ Both', '#555', () =>
            this._miniMap.fitBounds(both.pad(0.15), { maxZoom: 13 })));
        btnDiv.style.display = 'flex';
    },

    _drawFallbackReservoirs(site) {
        if (!this._miniMap) return;

        // Remove placeholder dot-markers
        ['upperMarker', 'lowerMarker', 'pairLine'].forEach(k => {
            if (this._miniMapLayers?.[k]) {
                this._miniMap.removeLayer(this._miniMapLayers[k]);
                delete this._miniMapLayers[k];
            }
        });

        // Resolve coords — use exact if available, otherwise estimate from center ± half-tunnel
        let upperLat = site.upper_lat, upperLng = site.upper_lng;
        let lowerLat = site.lower_lat, lowerLng = site.lower_lng;
        if (!upperLat || !lowerLat) {
            const centerLat = site.lat ?? 0;
            const centerLng = site.lng ?? 0;
            const sepKm = site.separation_km ?? (site.tunnelLength ? site.tunnelLength / 1000 : 2);
            const delta = (sepKm / 2) / 111;
            upperLat = centerLat + delta; upperLng = centerLng;
            lowerLat = centerLat - delta; lowerLng = centerLng;
        }

        // Resolve area/volume — support both nested detailSite objects and flat fields
        const u = site.upper || {};
        const l = site.lower || {};
        const uArea  = u.area_ha    ?? site.upper_area_ha   ?? null;
        const uVol   = u.volume_gl  ?? site.upper_volume_gl ?? site.upper_vol_gl  ?? null;
        const uElev  = u.elevation  ?? site.upper_elevation_m ?? site.upper_elev_m ?? null;
        const uLabel = u.label      ?? site.upper_reservoir  ?? null;
        const uVolA  = u.volume_active_gl ?? null;
        const uDamH  = u.dam_height_m ?? null;
        const uDepth = u.depth_fluct_m ?? null;

        const lArea  = l.area_ha    ?? site.lower_area_ha   ?? null;
        const lVol   = l.volume_gl  ?? site.lower_volume_gl ?? site.lower_vol_gl  ?? null;
        const lElev  = l.elevation  ?? site.lower_elevation_m ?? site.lower_elev_m ?? null;
        const lLabel = l.label      ?? site.lower_reservoir  ?? null;
        const lVolA  = l.volume_active_gl ?? null;
        const lVolT  = l.volume_total_gl  ?? null;
        const lDamH  = l.dam_height_m ?? null;
        const lDepth = l.depth_fluct_m ?? null;

        // Build popup HTML for a reservoir circle
        const resPopup = (isUpper, name, elev, area, vol, volA, volT, damH, depthF, estimated) => {
            const title = isUpper ? '⬆ Upper Reservoir' : '⬇ Lower Reservoir';
            const bgColor = isUpper ? '#1565C0' : '#1976D2';
            const volStr = volA != null && volT != null ? `${volA} GL active / ${volT} GL total`
                         : volA != null ? `${volA} GL active`
                         : volT != null ? `${volT} GL total`
                         : vol  != null ? `${vol} GL` : null;
            const rows = [
                name   && `<tr><td style="color:#555;font-weight:600;padding-right:12px;">Name</td><td>${name}</td></tr>`,
                elev  != null && `<tr style="background:#EEF4FB;"><td style="color:#555;font-weight:600;padding-right:12px;">Elevation</td><td>${Math.round(elev)} m ASL</td></tr>`,
                area  != null && `<tr><td style="color:#555;font-weight:600;padding-right:12px;">Area</td><td>${area} ha</td></tr>`,
                volStr && `<tr style="background:#EEF4FB;"><td style="color:#555;font-weight:600;padding-right:12px;">Volume</td><td>${volStr}</td></tr>`,
                depthF != null && `<tr><td style="color:#555;font-weight:600;padding-right:12px;">Level Fluctuation</td><td>${depthF} m</td></tr>`,
                damH  != null && `<tr style="background:#EEF4FB;"><td style="color:#555;font-weight:600;padding-right:12px;">Dam Height</td><td>${damH} m</td></tr>`,
                `<tr><td style="color:#555;font-weight:600;padding-right:12px;">Source</td><td style="font-size:10px;color:#666;">${estimated ? 'Estimated from pit volume' : 'ANU RE100'}</td></tr>`
            ].filter(Boolean).join('');
            return `<div style="font-family:system-ui,sans-serif;min-width:210px;">
              <div style="background:${bgColor};color:#fff;padding:7px 14px;margin:-12px -16px 10px;
                   border-radius:4px 4px 0 0;font-size:13px;font-weight:700;">${title}</div>
              <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.6;">${rows}</table>
            </div>`;
        };

        const isEstimated = !site.upper_lat;

        // Radius (m) from area; fall back to volume/assumed-depth (40 m).
        // Enforce minimum 350 m so the circle is clearly visible at wide zoom.
        const radiusFrom = (areaHa, volGl, defaultHa) => {
            const areaM2 = areaHa ? areaHa * 10000
                         : volGl  ? (volGl * 1e6) / 40
                         : defaultHa * 10000;
            return Math.max(350, Math.sqrt(areaM2 / Math.PI));
        };

        const upperR = radiusFrom(uArea, uVol, 5);
        const lowerR = radiusFrom(lArea, lVol, 10);

        const upperCircle = L.circle([upperLat, upperLng], {
            radius: upperR,
            fillColor: '#1565C0', fillOpacity: 0.40,
            color: '#0D47A1', weight: 2.5, opacity: 0.95
        }).bindTooltip('⬆ Upper reservoir — click for details', { sticky: true })
          .bindPopup(resPopup(true,  uLabel, uElev, uArea, uVol, uVolA, null,  uDamH, uDepth, isEstimated), { maxWidth: 280, className: 'anu-popup' })
          .addTo(this._miniMap);

        const lowerCircle = L.circle([lowerLat, lowerLng], {
            radius: lowerR,
            fillColor: '#42A5F5', fillOpacity: 0.40,
            color: '#1976D2', weight: 2.5, opacity: 0.95
        }).bindTooltip('⬇ Lower reservoir — click for details', { sticky: true })
          .bindPopup(resPopup(false, lLabel, lElev, lArea, lVol, lVolA, lVolT, lDamH, lDepth, isEstimated), { maxWidth: 280, className: 'anu-popup' })
          .addTo(this._miniMap);

        const pairLine = L.polyline(
            [[upperLat, upperLng], [lowerLat, lowerLng]],
            { color: '#e74c3c', weight: 3, dashArray: '6 4', opacity: 0.85 }
        ).addTo(this._miniMap);

        // Draggable centre handles — lets user visually correct reservoir positions.
        // Dragging updates the circle, the connecting line, and the coord display.
        const coordBox = document.getElementById('minimap-coords');
        const addDragHandle = (lat, lng, isUpper, circle) => {
            const col = isUpper ? '#0D47A1' : '#1976D2';
            const lbl = isUpper ? '⬆' : '⬇';
            const handle = L.marker([lat, lng], {
                draggable: true,
                zIndexOffset: 1000,
                icon: L.divIcon({
                    html: `<div title="Drag to reposition" style="width:22px;height:22px;background:${col};border-radius:50%;border:3px solid #fff;cursor:grab;box-shadow:0 2px 5px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">✥</div>`,
                    iconSize: [22, 22], iconAnchor: [11, 11], className: ''
                })
            }).addTo(this._miniMap);
            handle.on('drag', e => {
                const {lat: la, lng: lo} = e.latlng;
                circle.setLatLng([la, lo]);
                const uPos = isUpper ? [la, lo] : (this._miniMapLayers.upperHandle?.getLatLng() || [upperLat, upperLng]);
                const lPos = isUpper ? (this._miniMapLayers.lowerHandle?.getLatLng() || [lowerLat, lowerLng]) : [la, lo];
                pairLine.setLatLngs([uPos, lPos]);
                if (coordBox) {
                    coordBox.style.display = 'block';
                    coordBox.style.background = 'rgba(13,71,161,.9)';
                    coordBox.textContent = `${lbl} ${la.toFixed(5)}, ${lo.toFixed(5)}  ← copy to mineVoids.js`;
                }
            });
            handle.on('dragend', e => {
                const {lat: la, lng: lo} = e.latlng;
                if (coordBox) coordBox.textContent = `${lbl} FINAL: ${la.toFixed(5)}, ${lo.toFixed(5)}  ← copy to mineVoids.js`;
            });
            return handle;
        };
        this._miniMapLayers.upperHandle = addDragHandle(upperLat, upperLng, true,  upperCircle);
        this._miniMapLayers.lowerHandle = addDragHandle(lowerLat, lowerLng, false, lowerCircle);

        // Popup with available penstock data
        {
            const lenKm  = site.anu_tunnel_km || site.separation_km
                           || (site.tunnelLength ? (site.tunnelLength / 1000).toFixed(1) : null) || '—';
            const slope  = site.anu_tunnel_slope_pct || '—';
            const headM  = site.headHeight ?? site.head_m ?? site.headM ?? '—';
            const flowM3 = site.anu_flow_m3s || '—';
            pairLine.bindTooltip('Penstock / Tunnel — click for details', { sticky: true, className: 'anu-tip' });
            pairLine.bindPopup(`
                <div style="font-family:system-ui,sans-serif;min-width:200px;">
                  <div style="background:#e67e22;color:#fff;
                       padding:7px 14px;margin:-12px -16px 10px;
                       border-radius:4px 4px 0 0;font-size:13px;font-weight:700;">
                    ⚡ Penstock / Tunnel
                  </div>
                  <table style="font-size:11.5px;border-collapse:collapse;width:100%;line-height:1.6;">
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Length</td><td>${lenKm} km</td></tr>
                    <tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Slope</td><td>${slope !== '—' ? slope + '%' : '—'}</td></tr>
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Head</td><td>${headM !== '—' ? Math.round(headM) + ' m' : '—'}</td></tr>
                    ${flowM3 !== '—' ? `<tr style="background:#FFF3E0;"><td style="color:#555;font-weight:600;padding-right:12px;">Flow</td><td>${flowM3} m³/s</td></tr>` : ''}
                    <tr><td style="color:#555;font-weight:600;padding-right:12px;">Source</td>
                        <td style="font-size:10px;color:#666;">${site.anu_tunnel_km ? 'ANU RE100 (embedded)' : 'Estimated'}</td></tr>
                  </table>
                </div>`, { maxWidth: 260, className: 'anu-popup' }
            );
        }

        this._miniMapLayers.upperCircle = upperCircle;
        this._miniMapLayers.lowerCircle = lowerCircle;
        this._miniMapLayers.pairLine    = pairLine;

        const uBounds = upperCircle.getBounds();
        const lBounds = lowerCircle.getBounds();
        // Create bothBounds as a NEW copy to avoid mutating uBounds
        const bothBounds = L.latLngBounds(uBounds.getSouthWest(), uBounds.getNorthEast()).extend(lBounds);
        this._setupZoomButtons(uBounds, lBounds, bothBounds);

        this._miniMap.fitBounds(
            L.latLngBounds([[upperLat, upperLng], [lowerLat, lowerLng]]).pad(0.4),
            { maxZoom: 14 }
        );
    },

    _drawCrossSection(site) {
        const canvas = document.getElementById('cross-section-canvas');
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        const upperElev = site.upper?.elevation || (site.headHeight ? site.headHeight + 200 : 500);
        const lowerElev = site.lower?.elevation || 200;
        const headHeight = site.headHeight || (upperElev - lowerElev);
        const tunnelLength = site.tunnelLength || 2000;

        // Scaling
        const maxElev = upperElev + 50;
        const minElev = Math.max(0, lowerElev - 50);
        const elevRange = maxElev - minElev;

        const pad = { top: 20, bottom: 30, left: 50, right: 20 };
        const plotW = W - pad.left - pad.right;
        const plotH = H - pad.top - pad.bottom;

        const scaleX = (d) => pad.left + (d / tunnelLength) * plotW;
        const scaleY = (e) => pad.top + plotH - ((e - minElev) / elevRange) * plotH;

        // Background gradient (sky)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(1, '#E0F0FF');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Ground profile (simplified mountain)
        ctx.beginPath();
        ctx.moveTo(pad.left, scaleY(lowerElev));
        ctx.lineTo(scaleX(tunnelLength * 0.15), scaleY(lowerElev + headHeight * 0.3));
        ctx.lineTo(scaleX(tunnelLength * 0.35), scaleY(upperElev));
        ctx.lineTo(scaleX(tunnelLength * 0.5), scaleY(upperElev - headHeight * 0.1));
        ctx.lineTo(scaleX(tunnelLength * 0.65), scaleY(upperElev - headHeight * 0.15));
        ctx.lineTo(scaleX(tunnelLength * 0.8), scaleY(lowerElev + headHeight * 0.4));
        ctx.lineTo(scaleX(tunnelLength), scaleY(lowerElev));
        ctx.lineTo(scaleX(tunnelLength), H);
        ctx.lineTo(pad.left, H);
        ctx.closePath();

        const groundGrad = ctx.createLinearGradient(0, scaleY(maxElev), 0, H);
        groundGrad.addColorStop(0, '#8B7355');
        groundGrad.addColorStop(0.3, '#6B5B3F');
        groundGrad.addColorStop(1, '#4A3F2F');
        ctx.fillStyle = groundGrad;
        ctx.fill();

        // Upper reservoir (blue ellipse)
        const ux = scaleX(tunnelLength * 0.35);
        const uy = scaleY(upperElev);
        ctx.fillStyle = 'rgba(30, 136, 229, 0.7)';
        ctx.beginPath();
        ctx.ellipse(ux, uy, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1565C0';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Lower reservoir
        const lx = scaleX(tunnelLength * 0.8);
        const ly = scaleY(lowerElev);
        ctx.fillStyle = 'rgba(30, 136, 229, 0.7)';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1565C0';
        ctx.stroke();

        // Tunnel line (dashed)
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.moveTo(ux, uy);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.setLineDash([]);

        // Powerhouse symbol (small rectangle)
        const phX = lx - 15;
        const phY = ly - 15;
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(phX, phY, 12, 12);
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 1;
        ctx.strokeRect(phX, phY, 12, 12);

        // Head height annotation
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const annotX = scaleX(tunnelLength * 0.1);
        ctx.beginPath();
        ctx.moveTo(annotX, uy);
        ctx.lineTo(annotX, ly);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowheads
        ctx.fillStyle = '#333';
        this._drawArrow(ctx, annotX, uy + 5, 'down');
        this._drawArrow(ctx, annotX, ly - 5, 'up');

        // Labels
        ctx.fillStyle = '#333';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillText('Upper', ux, uy - 16);
        ctx.fillText(`${Math.round(upperElev)}m`, ux, uy - 4);

        ctx.fillText('Lower', lx, ly - 16);
        ctx.fillText(`${Math.round(lowerElev)}m`, lx, ly - 4);

        // Head height label
        ctx.save();
        ctx.translate(annotX - 12, (uy + ly) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`Head: ${Math.round(headHeight)}m`, 0, 0);
        ctx.restore();

        // Distance label at bottom
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(`Tunnel: ${(tunnelLength / 1000).toFixed(1)} km`, W / 2, H - 8);

        // Powerhouse label
        ctx.fillStyle = '#e67e22';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.fillText('PH', phX + 6, phY - 3);
    },

    _drawArrow(ctx, x, y, direction) {
        ctx.beginPath();
        if (direction === 'down') {
            ctx.moveTo(x - 4, y - 4);
            ctx.lineTo(x, y);
            ctx.lineTo(x + 4, y - 4);
        } else {
            ctx.moveTo(x - 4, y + 4);
            ctx.lineTo(x, y);
            ctx.lineTo(x + 4, y + 4);
        }
        ctx.fill();
    },

    _renderMetrics(site) {
        const container = document.getElementById('key-metrics');

        // Prefer ANU model results when available
        if (site.anuResult) {
            const s = site.anuResult.summary;
            const eng = site.anuResult.engineering;
            const metrics = [
                { value: `$${(s.totalCapexM / 1000).toFixed(1)}B`, label: 'Total CAPEX' },
                { value: `${Math.round(s.costPerKW)}`, label: '$/kW' },
                { value: `${Math.round(s.costPerKWh)}`, label: '$/kWh stored' },
                { value: `${Math.round(s.lcos)}`, label: '$/MWh LCOS' },
                { value: `${site.anuResult.financials.hoursAtFullPower.toFixed(1)}h`, label: 'Duration' },
                { value: `${eng.totalWaterGL.toFixed(2)} Mm\u00B3`, label: 'Water Volume' }
            ];
            // Use M format for CAPEX under 1B
            if (s.totalCapexM < 1000) {
                metrics[0].value = `$${s.totalCapexM.toFixed(0)}M`;
            }
            container.innerHTML = metrics.map(m => `
                <div class="metric-card">
                    <div class="metric-value">${m.value}</div>
                    <div class="metric-label">${m.label}</div>
                </div>
            `).join('');
            return;
        }

        if (!site.costResult) {
            container.innerHTML = '';
            return;
        }

        const eng = site.costResult.engineering;
        const summary = site.costResult.summary;

        const metrics = [
            { value: HB.Utils.formatCurrency(summary.totalCAPEX), label: 'Total CAPEX' },
            { value: `${summary.costPerKW}`, label: '$/kW' },
            { value: `${summary.costPerKWh.toFixed(0)}`, label: '$/kWh stored' },
            { value: `${summary.lcos.toFixed(0)}`, label: '$/MWh LCOS' },
            { value: `${(eng.storageDuration).toFixed(1)}h`, label: 'Duration' },
            { value: HB.Utils.formatVolume(eng.waterVolume), label: 'Water Volume' }
        ];

        container.innerHTML = metrics.map(m => `
            <div class="metric-card">
                <div class="metric-value">${m.value}</div>
                <div class="metric-label">${m.label}</div>
            </div>
        `).join('');
    }
};
