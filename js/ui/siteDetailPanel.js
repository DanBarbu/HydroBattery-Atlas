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
            upper: { elevation: site.upper_elevation_m },
            lower: { elevation: site.lower_elevation_m },
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
            storage_mwh: site.storage_mwh
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

        const params = [
            ['Configuration', (site.configuration || 'lake_pair').replace(/_/g, ' ')],
            ['Country / Region', [site.country, site.region].filter(Boolean).join(', ') || '--'],
            ['Upper Elevation', site.upper?.elevation ? `${Math.round(site.upper.elevation)}m` : '--'],
            ['Lower Elevation', site.lower?.elevation ? `${Math.round(site.lower.elevation)}m` : '--'],
            ['Head Height', site.headHeight ? `${Math.round(site.headHeight)}m` : '--'],
            ['Tunnel Length', site.tunnelLength ? `${(site.tunnelLength / 1000).toFixed(1)} km` : '--'],
            ['Energy Storage', site.energyKWh ? HB.Utils.formatEnergy(site.energyKWh) : '--'],
            ['Power Capacity', site.powerKW ? HB.Utils.formatPower(site.powerKW) : '--'],
            ['Storage Duration', site.energyKWh && site.powerKW ?
                `${(site.energyKWh / site.powerKW).toFixed(1)} hours` : '--'],
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
        const sepKm = site.separation_km ?? (site.tunnelLength ? site.tunnelLength / 1000 : 5);

        // Zoom level inversely proportional to separation
        const zoom = sepKm < 1   ? 14
                   : sepKm < 3   ? 13
                   : sepKm < 8   ? 12
                   : sepKm < 20  ? 11
                   : sepKm < 50  ? 10 : 9;

        if (!this._miniMap) {
            // First-time initialisation
            this._miniMap = L.map(container, {
                center: [lat, lng],
                zoom,
                zoomControl:        true,
                attributionControl: false,
                scrollWheelZoom:    false,
                dragging:           true,
                doubleClickZoom:    true
            });

            // Base: ESRI satellite imagery (free, no key required)
            L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 18 }
            ).addTo(this._miniMap);

            // Overlay: place names / country labels
            L.tileLayer(
                'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 18, opacity: 0.55 }
            ).addTo(this._miniMap);

            this._miniMapLayers = {};
        } else {
            // Pan/zoom to new site; clear previous site's layers
            this._miniMap.setView([lat, lng], zoom);
            Object.values(this._miniMapLayers).forEach(l => {
                if (l) this._miniMap.removeLayer(l);
            });
            this._miniMapLayers = {};
        }

        // --- Placeholder markers (shown while WFS polygons load) ---
        const headM    = site.head_m ?? site.headHeight ?? site.headM ?? 200;
        const deltaLat = (sepKm / 2) / 111;
        const circleOpts = (color, ttl) => ({
            radius: 7, color, weight: 2,
            fillColor: color, fillOpacity: 0.70, title: ttl
        });
        const upperPH = L.circleMarker([lat + deltaLat, lng],
            circleOpts('#1565C0', `Upper reservoir — ${Math.round(headM)}m head`))
            .bindTooltip(`⬆ Upper reservoir<br>${Math.round(headM)}m head`)
            .addTo(this._miniMap);
        const lowerPH = L.circleMarker([lat - deltaLat, lng],
            circleOpts('#42A5F5', 'Lower reservoir'))
            .bindTooltip('⬇ Lower reservoir')
            .addTo(this._miniMap);
        const pairLine = L.polyline([[lat + deltaLat, lng], [lat - deltaLat, lng]], {
            color: '#e74c3c', weight: 2, dashArray: '6 4', opacity: 0.80
        }).addTo(this._miniMap);
        this._miniMapLayers = { upperMarker: upperPH, lowerMarker: lowerPH, pairLine };

        // Ensure Leaflet reflows after panel visibility change
        setTimeout(() => { if (this._miniMap) this._miniMap.invalidateSize(); }, 120);

        // Fetch real lake-perimeter polygons from ANU GeoServer (replaces placeholders)
        this._loadANUPolygons(site, lat, lng, sepKm);
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
        const { ws, layer } = this._anuWfsLayer(site);

        // Bounding box: 1.6× separation so both reservoirs fit; min ±0.08°
        const margin = Math.max(0.08, (sepKm * 1.6) / 111);
        const bbox = `${(lng - margin).toFixed(5)},${(lat - margin).toFixed(5)},`
                   + `${(lng + margin).toFixed(5)},${(lat + margin).toFixed(5)},EPSG:4326`;

        const url = `https://re100.anu.edu.au/geoserver/${ws}/wfs`
                  + `?service=WFS&version=2.0.0&request=GetFeature`
                  + `&typeNames=${encodeURIComponent(layer)}`
                  + `&outputFormat=application%2Fjson`
                  + `&count=120`
                  + `&bbox=${bbox}`;

        const fetchId = `${lat},${lng}`;
        this._pendingFetch = fetchId;

        fetch(url)
            .then(r => { if (!r.ok) throw new Error(`WFS ${r.status}`); return r.json(); })
            .then(geojson => {
                if (this._pendingFetch !== fetchId || !this._miniMap) return;

                const all = geojson.features || [];

                // ── Split by feature type ──────────────────────────────────────
                // isdam=true  → dam-wall overlay polygon     → skip
                // isupper 0/1 → reservoir lake polygon       → blue fill
                // ispipe=true → LineString tunnel geometry   → orange line
                const isUp  = v => v === '1' || v === 1;
                const isLow = v => v === '0' || v === 0;

                const reservoirFeats = all.filter(f =>
                    !f.properties.isdam &&
                    (isUp(f.properties.isupper) || isLow(f.properties.isupper))
                );
                const pipeFeats = all.filter(f => f.properties.ispipe);

                if (!reservoirFeats.length && !pipeFeats.length) return;

                // Remove placeholder markers/line
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

                                // Parse description HTML (same pattern as reservoir features)
                                const d = this._parseANUDescription(p.description);
                                const dget = (...keys) => {
                                    for (const k of keys) {
                                        if (d[k] != null && d[k] !== '') return d[k];
                                    }
                                    // Fallback: try direct property
                                    for (const k of keys) {
                                        if (p[k] != null && p[k] !== '') return p[k];
                                    }
                                    return null;
                                };

                                const head    = dget('Head (m)', 'Head');
                                const sep     = dget('Separation (km)', 'Separation');
                                const slope   = dget('Average Slope (%)', 'Average slope (%)', 'Average Slope', 'average_slope');
                                const hdr     = dget('Head/Distance Ratio', 'Head/distance ratio', 'head_distance_ratio');
                                const energy  = dget('Energy (GWh)', 'Energy');
                                const vol     = dget('Volume (GL)', 'Volume');
                                const area    = dget('Reservoir Area (ha)', 'Reservoir area (ha)', 'Reservoir Area', 'reservoir_area');
                                const wrock   = dget('Water/Rock Ratio', 'Water:Rock ratio', 'water_rock_ratio');
                                const dvol    = dget('Dam Volume (Mm³)', 'Dam Volume (Mm3)', 'Dam Volume (GL)', 'Dam Volume', 'dam_volume');
                                const cls     = dget('Class', 'class');
                                const lcos    = dget('LCOS ($/MWh)', 'Energy Cost', 'energy_cost');
                                const cpkw    = dget('Cost/kW ($/kW)', 'Power Cost', 'power_cost');
                                const country = dget('Country');

                                // DEBUG — remove after confirming keys
                                console.log('[ANU pipe] raw props:', p);
                                console.log('[ANU pipe] parsed description:', d);

                                layer.bindTooltip(
                                    'Tunnel / Penstock — click for details',
                                    { sticky: true, className: 'anu-tip' }
                                );

                                const rows = [
                                    cls     && ['Cost class',          `<strong style="color:${classColor(cls)};">${cls}</strong>`],
                                    head    && ['Head',                `${head} m`],
                                    sep     && ['Separation',          `${sep} km`],
                                    slope   && ['Average slope',       `${slope}%`],
                                    hdr     && ['Head/distance ratio', hdr],
                                    energy  && ['Energy',              `${energy} GWh`],
                                    vol     && ['Volume',              `${vol} GL`],
                                    area    && ['Reservoir area',      `${Number(area).toLocaleString()} ha`],
                                    wrock   && ['Water:Rock ratio',    wrock],
                                    dvol    && ['Dam volume',          dvol],
                                    lcos    && ['LCOS',                `$${lcos}/MWh`],
                                    cpkw    && ['Cost per kW',         `$${cpkw}/kW`],
                                    country && ['Country',             country],
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
                if (attrEl) attrEl.textContent = 'Imagery © Esri  |  Data © ANU RE100';
            })
            .catch(() => {
                // WFS unavailable or CORS — placeholder markers/line remain visible
            });
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
