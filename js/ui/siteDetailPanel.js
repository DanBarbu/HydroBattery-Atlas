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
        panel.classList.toggle('collapsed');
        const isCollapsed = panel.classList.contains('collapsed');
        btn.title = isCollapsed ? 'Show panel' : 'Hide panel';
        btn.classList.toggle('flipped', isCollapsed);
        // Sync button position immediately for collapse, after transition for expand
        if (isCollapsed) {
            btn.style.right = '0';
        } else {
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

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            handle.classList.add('dragging');
            panel.style.transition = 'none';
            collapseBtn.style.transition = 'none';

            const onMouseMove = (e) => {
                const delta = startX - e.clientX; // moving left = wider
                const newWidth = Math.max(320, Math.min(window.innerWidth * 0.8, startWidth + delta));
                panel.style.width = newWidth + 'px';
                collapseBtn.style.right = newWidth + 'px';
            };

            const onMouseUp = () => {
                handle.classList.remove('dragging');
                panel.style.transition = '';
                collapseBtn.style.transition = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                setTimeout(() => {
                    if (HB.Map && HB.Map.map) HB.Map.map.invalidateSize();
                }, 50);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
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

        // Cross-section
        this._drawCrossSection(site);

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

            // For existing lake pairs, ALL civil infrastructure is sunk cost ($0).
            // Override ANU component costs to reflect actual investment needed.
            if (isBluefieldExisting && anuResult) {
                anuResult.components.reservoirs_M = 0;
                anuResult.components.tunnel_M     = 0;
                anuResult.components.powerhouse_M = 0;
                anuResult.components.overhead_M   = 0;
                anuResult.summary.totalCapexM     = 0;
                anuResult.summary.totalCAPEX      = 0;
                anuResult.summary.costPerKW       = 0;
                anuResult.summary.costPerKWh      = 0;
                anuResult.summary.breakdown.forEach(b => { b.value = 0; });
                anuResult.summary.useExistingReservoirs = true;
                anuResult.summary.isExistingInfrastructure = true;
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
