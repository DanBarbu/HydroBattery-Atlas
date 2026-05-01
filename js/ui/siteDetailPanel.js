/**
 * Site Detail Panel - shows detailed site information in the right panel
 */
HB.UI = HB.UI || {};

HB.UI.siteDetail = {
    init() {
        // Close button
        document.getElementById('close-right-panel').addEventListener('click', () => {
            document.getElementById('right-panel').classList.add('hidden');
        });

        // Listen for site detail events
        HB.Events.on('showSiteDetail', (site) => this.show(site));

        // Listen for known site view detail
        HB.Events.on('viewSiteDetail', (siteId) => this.showKnownSite(siteId));
    },

    show(site) {
        const panel = document.getElementById('right-panel');
        panel.classList.remove('hidden');

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

        // Use ANU model for Bluefield sites (or any site with ANU data)
        let anuResult = null;
        const hasAnuData = site.anu_class || site.status === 'anu_bluefield' || site.anu_energy_cost_usd_mwh;
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
                country: site.country || 'default'
            });
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
            upper: { elevation: site.upper_elevation_m, area_ha: site.upper_area_ha, volume_gl: site.upper_volume_gl },
            lower: { elevation: site.lower_elevation_m, area_ha: site.lower_area_ha, volume_gl: site.lower_volume_gl },
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
            capacity_mw: site.capacity_mw
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
            ['Upper Pit Area', site.upper?.area_ha ? `${site.upper.area_ha} ha` : '--'],
            ['Upper Pit Volume', site.upper?.volume_gl ? `${site.upper.volume_gl} GL` : '--'],
            ['Lower Elevation', site.lower?.elevation ? `${Math.round(site.lower.elevation)}m` : '--'],
            ['Lower Pit Area', site.lower?.area_ha ? `${site.lower.area_ha} ha` : '--'],
            ['Lower Pit Volume', site.lower?.volume_gl ? `${site.lower.volume_gl} GL` : '--'],
            ['Head Height', site.headHeight ? `${Math.round(site.headHeight)}m` : '--'],
            ['Tunnel Length', site.tunnelLength ? `${(site.tunnelLength / 1000).toFixed(1)} km` : '--'],
            ['Bearing', site.bearing_deg != null ? `${site.bearing_deg}°` : '--'],
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
