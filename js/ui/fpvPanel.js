/**
 * Floating Solar PV Integration Panel
 *
 * Appends a collapsible section to the right-panel site detail view.
 * Lets users size a floating PV array to charge the PHES reservoir 24/7,
 * fetch live solar data from Global Solar Atlas, view the dispatch profile,
 * and generate a printable feasibility report.
 *
 * Depends on: HB.FPV.engine (fpvEngine.js), HB.Cost.financials (costEngine.js)
 */
HB.UI = HB.UI || {};

HB.UI.fpvPanel = {

    _site:   null,
    _result: null,

    // =========================================================================
    // INIT — inject HTML once; bind events
    // =========================================================================
    init() {
        this._injectCSS();
        this._injectPanelHTML();
        this._injectReportModal();
        this._bindEvents();
    },

    // =========================================================================
    // CALLED BY siteDetailPanel.js each time a site is shown
    // =========================================================================
    onSiteShown(site) {
        this._site   = site;
        this._result = null;

        const panel = document.getElementById('fpv-panel');
        if (!panel) return;
        panel.style.display = '';

        // Pre-fill PHES fields from site data
        const gwh   = site.energyGWh    || (site.storage_mwh  ? site.storage_mwh  / 1000 : 1);
        const power = site.powerMW      || site.capacity_mw   || 100;
        _set('fpv-phes-gwh', gwh.toFixed(2));
        _set('fpv-phes-mw',  power.toFixed(0));
        _set('fpv-rte',      '80');
        _set('fpv-peak-hrs', '');
        _set('fpv-pvout',    '');
        _set('fpv-ghi',      '');
        _set('fpv-grid-mw',  '');

        // Clear previous results
        _hide('fpv-results');
        _q('#fpv-gsa-status').textContent = '';

        // Use embedded GSA data if available; otherwise try API fetch
        if (site.gsa && site.gsa.pvoutYear) {
            const g = site.gsa;
            _set('fpv-pvout', g.pvoutYear);
            _set('fpv-ghi',   g.ghiYear);
            const peakH = (g.pvoutYear / 365).toFixed(1);
            const gsaUrl = (site.lat != null && site.lng != null)
                ? `https://globalsolaratlas.info/detail?c=${site.lat},${site.lng},11&m=site&s=${site.lat},${site.lng}&pv=hydro,180,10,1000`
                : 'https://globalsolaratlas.info/';
            const el = _q('#fpv-gsa-status');
            el.innerHTML = `Solar data: <a href="${gsaUrl}" target="_blank" style="color:var(--accent)">Global Solar Atlas</a>`
                + ` — GHI <strong>${g.ghiYear}</strong> kWh/m\u00B2/yr \u00B7 PVOUT <strong>${g.pvoutYear}</strong> kWh/kWp/yr`
                + ` \u00B7 ${peakH} peak sun h/day`
                + (g.airTempC != null ? ` \u00B7 ${g.airTempC}\u00B0C avg` : '');
            el.style.color = '#27ae60';
        } else if (site.lat != null && site.lng != null) {
            this._fetchGSA(site.lat, site.lng);
        }
    },

    // =========================================================================
    // GSA API FETCH
    // =========================================================================
    async _fetchGSA(lat, lng) {
        const el = _q('#fpv-gsa-status');
        el.style.color = 'var(--text-muted)';
        el.textContent = 'Fetching solar data from Global Solar Atlas…';

        const gsa = await HB.FPV.engine.fetchGSA(lat, lng);
        if (gsa) {
            _set('fpv-pvout', gsa.pvoutYear);
            _set('fpv-ghi',   gsa.ghiYear);
            el.innerHTML = `Solar data: <a href="https://globalsolaratlas.info/" target="_blank" style="color:var(--accent)">Global Solar Atlas</a>`
                + ` — GHI <strong>${gsa.ghiYear}</strong> kWh/m²/yr · PVOUT <strong>${gsa.pvoutYear}</strong> kWh/kWp/yr`
                + ` · ${gsa.peakHoursDay} peak sun h/day`;
            el.style.color = '#27ae60';
        } else {
            // Latitude-based fallback
            const est = HB.FPV.engine._solarResource({ lat, lng, country: this._site?.country || '' });
            _set('fpv-pvout', est.pvoutYear);
            _set('fpv-ghi',   est.ghiYear);
            el.textContent = `GSA unavailable — latitude estimate used (${lat.toFixed(1)}°): `
                + `GHI ${est.ghiYear} kWh/m²/yr, PVOUT ${est.pvoutYear} kWh/kWp/yr. Edit manually.`;
            el.style.color = '#e67e22';
        }
    },

    // =========================================================================
    // EVALUATE
    // =========================================================================
    _evaluate() {
        const site = this._site;
        if (!site) return;

        const params = {
            lat:           site.lat  || 0,
            lng:           site.lng  || 0,
            country:       site.country || '',
            phesEnergyGWh: _num('fpv-phes-gwh') || 1,
            phesPowerMW:   _num('fpv-phes-mw')  || 100,
            phesRTE:       (_num('fpv-rte') || 80) / 100,
            pvoutKWhKWp:   _num('fpv-pvout') || 0,
            ghiKWhM2:      _num('fpv-ghi')   || 0,
            solarPeakHrs:  _num('fpv-peak-hrs') || 0,
            gridNodeMW:    _num('fpv-grid-mw')   || 0,
        };

        this._result = HB.FPV.engine.evaluate(params);
        this._renderResults(this._result);
    },

    // =========================================================================
    // RENDER RESULTS
    // =========================================================================
    _renderResults(r) {
        const s   = r.sizing;
        const e   = r.energy;
        const c   = r.costs;
        const sol = r.solar;

        const fN  = (n, d=1) => n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
        const fM  = n => `$${fN(n,1)}M`;
        const fGWh = n => `${fN(n/1000,1)} GWh`;

        _q('#fpv-results').innerHTML = `

<!-- ── Solar resource ──────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">Solar Resource
        <span class="fpv-src">${sol.source === 'GlobalSolarAtlas' ? '● Global Solar Atlas' : '◌ Latitude estimate'}</span>
    </div>
    <div class="fpv-kpis">
        <div class="fpv-kpi"><b>${fN(sol.ghiYear,0)}</b><span>GHI kWh/m²/yr</span></div>
        <div class="fpv-kpi"><b>${fN(sol.pvoutYear,0)}</b><span>PVOUT kWh/kWp/yr</span></div>
        <div class="fpv-kpi"><b>${fN(sol.peakHoursDay,1)} h</b><span>Peak sun h/day</span></div>
        <div class="fpv-kpi"><b>${fN(e.capacityFactorPct,1)}%</b><span>Capacity factor</span></div>
    </div>
</div>

<!-- ── Sizing ───────────────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">FPV System Sizing</div>
    <table class="fpv-tbl">
        <tr><td>Minimum FPV (fills PHES in ${fN(sol.peakHoursDay,1)} h/day)</td><td>${fN(s.fpvMinMW,0)} MW</td></tr>
        <tr><td><b>Design capacity (+25% cloud margin)</b></td><td><b>${fN(s.fpvDesignMW,0)} MW</b></td></tr>
        <tr><td>550 Wp modules required</td><td>${fN(s.panelsRequired,0)}</td></tr>
        <tr><td>Active panel area</td><td>${fN(s.panelAreaM2/1e4,1)} ha</td></tr>
        <tr><td>Total floating platform area</td><td>${fN(s.platformAreaHa,1)} ha &nbsp;(${fN(s.platformAreaKm2,2)} km²)</td></tr>
    </table>
</div>

<!-- ── Dispatch chart ───────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">24-Hour Average Dispatch Profile</div>
    <canvas id="fpv-chart" width="346" height="140"></canvas>
    <div class="fpv-legend">
        <span class="fpv-dot" style="background:#f39c12"></span>FPV generation &nbsp;
        <span class="fpv-dot" style="background:#3498db"></span>→ PHES &nbsp;
        <span class="fpv-dot" style="background:#27ae60"></span>PHES → grid
    </div>
</div>

<!-- ── Annual energy ────────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">Annual 24/7 Energy Dispatch</div>
    <div class="fpv-kpis">
        <div class="fpv-kpi"><b>${fGWh(e.annualFpvMWh)}</b><span>FPV generated</span></div>
        <div class="fpv-kpi"><b>${fGWh(e.annualToPhes_MWh)}</b><span>→ PHES stored</span></div>
        <div class="fpv-kpi"><b>${fGWh(e.annualFromPhes_MWh)}</b><span>PHES → grid</span></div>
        <div class="fpv-kpi fpv-kpi-accent"><b>${fGWh(e.annualToGrid_MWh)}</b><span>Total to grid</span></div>
    </div>
</div>

<!-- ── Costs ────────────────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">Capital Cost (${fN(c.specificWp,2)} $/Wp · regional index ${fN(c.regionIndex,2)}×)</div>
    <table class="fpv-tbl">
        <tr><td>Solar modules (mono-PERC 21%)</td><td>${fM(c.breakdown.modules_M)}</td></tr>
        <tr><td>Floating structures (HDPE)</td><td>${fM(c.breakdown.floats_M)}</td></tr>
        <tr><td>Anchoring &amp; mooring</td><td>${fM(c.breakdown.anchoring_M)}</td></tr>
        <tr><td>Electrical BOS (inverters, cables, MV)</td><td>${fM(c.breakdown.electricalBOS_M)}</td></tr>
        <tr><td>Installation &amp; commissioning</td><td>${fM(c.breakdown.installation_M)}</td></tr>
        <tr><td>Soft costs (E&amp;P, permitting)</td><td>${fM(c.breakdown.softCosts_M)}</td></tr>
        <tr class="fpv-total"><td><b>Total FPV CAPEX</b></td><td><b>${fM(c.totalCapexM)}</b></td></tr>
    </table>
</div>

<!-- ── Economics ────────────────────────────────────────────── -->
<div class="fpv-section">
    <div class="fpv-stitle">Financial Indicators (25 yr, 7% discount)</div>
    <div class="fpv-kpis">
        <div class="fpv-kpi"><b>${fM(c.totalCapexM)}</b><span>FPV CAPEX</span></div>
        <div class="fpv-kpi"><b>${fM(c.annualOpexM)}/yr</b><span>OPEX</span></div>
        <div class="fpv-kpi"><b>$${fN(c.lcoeFpvPerMWh,0)}/MWh</b><span>LCOE (FPV)</span></div>
        <div class="fpv-kpi"><b>${fN(c.simplePaybackYr,1)} yr</b><span>Payback</span></div>
    </div>
</div>

<!-- ── Action buttons ───────────────────────────────────────── -->
<div class="fpv-actions">
    <a class="fpv-btn-outline" href="${r.gsaUrl}" target="_blank">
        View on Global Solar Atlas ↗
    </a>
    <button class="fpv-btn-primary" id="fpv-btn-report">Generate Full Report</button>
</div>`;

        _show('fpv-results');

        // Draw the dispatch chart
        requestAnimationFrame(() => this._drawChart(r.energy.hourly));

        // Wire report button
        _q('#fpv-btn-report').addEventListener('click', () => this._openReport());
    },

    // =========================================================================
    // DISPATCH CHART (canvas)
    // =========================================================================
    _drawChart(h) {
        const canvas = _q('#fpv-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const pad = { t: 8, r: 6, b: 22, l: 38 };
        const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        const barW = cW / 24;

        const gen = h.fpvGenMWh, chg = h.phesChargeMWh, dis = h.phesDischarMWh;
        const maxV = Math.max(...gen.map((v, i) => v + (dis[i] || 0))) || 1;

        ctx.clearRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(128,128,128,0.15)';
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1.0].forEach(f => {
            const y = pad.t + cH * (1 - f);
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        });

        // Bars
        for (let h2 = 0; h2 < 24; h2++) {
            const x  = pad.l + h2 * barW + 1;
            const bW = barW - 2;

            // FPV generation (yellow-orange)
            const genH = (gen[h2] / maxV) * cH;
            if (genH > 0) {
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(x, pad.t + cH - genH, bW, genH);
            }

            // PHES charge overlay (blue, bottom of gen bar)
            const chgH = ((chg[h2] || 0) / maxV) * cH;
            if (chgH > 0) {
                ctx.fillStyle = '#3498db';
                ctx.fillRect(x, pad.t + cH - chgH, bW, chgH);
            }

            // PHES discharge (green)
            const disH = ((dis[h2] || 0) / maxV) * cH;
            if (disH > 0) {
                ctx.fillStyle = 'rgba(39,174,96,0.85)';
                ctx.fillRect(x, pad.t + cH - disH, bW, disH);
            }
        }

        // X-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        [0, 6, 12, 18, 23].forEach(h2 => {
            ctx.fillText(`${h2}:00`, pad.l + h2 * barW + barW / 2, H - 6);
        });

        // Y-axis label
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(maxV)} MW`, pad.l - 2, pad.t + 8);
        ctx.fillText('0', pad.l - 2, pad.t + cH);
    },

    // =========================================================================
    // REPORT MODAL
    // =========================================================================
    _openReport() {
        const r    = this._result;
        const site = this._site;
        if (!r) return;

        const s   = r.sizing;
        const e   = r.energy;
        const c   = r.costs;
        const sol = r.solar;
        const fN  = (n, d=1) => n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
        const fM  = n => `$${fN(n,1)}M`;
        const fGWh = n => `${fN(n/1000,1)} GWh`;
        const today = new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
        const energyPrice = HB.Cost.financials.energyPurchasePrice;

        // Component share helper
        const share = (v) => fN(v / c.totalCapexM * 100, 1) + '%';

        const html = `
<div style="font-family:Georgia,serif;">
<h1 style="color:#1a3a5c;font-size:20px;margin:0 0 4px;">Floating Solar PV Integration — Feasibility Report</h1>
<div style="color:#666;font-size:12px;margin-bottom:20px;border-bottom:2px solid #1a3a5c;padding-bottom:8px;">
    <b>${site.name || 'PHES Site'}</b> &nbsp;|&nbsp; ${site.country || ''} &nbsp;(${fN(r.input.lat,4)}°, ${fN(r.input.lng,4)}°)
    &nbsp;|&nbsp; Generated ${today} by HydroBattery Atlas
</div>

<!-- 1. Executive Summary -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">1. Executive Summary</h2>
<p style="font-size:12px;line-height:1.7;">
    A <b>${fN(s.fpvDesignMW,0)}-MW</b> floating photovoltaic (FPV) array installed on the reservoir surface
    of <b>${site.name || 'this PHES site'}</b> can provide <b>24/7 renewable electricity</b> by coupling solar
    generation with the ${fN(r.input.phesEnergyGWh,2)}-GWh pumped hydro energy storage (PHES) battery.
    During an average of <b>${fN(sol.peakHoursDay,1)} peak solar hours per day</b>, the FPV system generates
    <b>${fN(e.dailyFpvMWh,0)} MWh</b>, of which ${fN(e.dailyToPhes_MWh,0)} MWh charges the PHES reservoir.
    For the remaining ${fN(24-sol.peakHoursDay,1)} hours, PHES discharges ${fN(e.dailyFromPhes_MWh,0)} MWh/day,
    maintaining uninterrupted renewable supply.
</p>
<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
    <tr style="background:#1a3a5c;color:#fff;">
        <th style="padding:5px 10px;text-align:left;">Indicator</th>
        <th style="padding:5px 10px;text-align:right;">Value</th>
    </tr>
    <tr><td style="padding:4px 10px;">FPV design capacity</td><td style="text-align:right;">${fN(s.fpvDesignMW,0)} MW</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Total FPV CAPEX</td><td style="text-align:right;font-weight:700;">${fM(c.totalCapexM)}</td></tr>
    <tr><td style="padding:4px 10px;">Annual OPEX</td><td style="text-align:right;">${fM(c.annualOpexM)}</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">LCOE — FPV only (25 yr, 7%)</td><td style="text-align:right;font-weight:700;">$${fN(c.lcoeFpvPerMWh,0)}/MWh</td></tr>
    <tr><td style="padding:4px 10px;">Annual renewable supply to grid</td><td style="text-align:right;">${fGWh(e.annualToGrid_MWh)}</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Floating platform area</td><td style="text-align:right;">${fN(s.platformAreaHa,1)} ha (${fN(s.platformAreaKm2,2)} km²)</td></tr>
    <tr><td style="padding:4px 10px;">Simple payback (at $${fN(energyPrice,0)}/MWh)</td><td style="text-align:right;">${fN(c.simplePaybackYr,1)} years</td></tr>
</table>

<!-- 2. Solar Resource -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">2. Solar Resource Assessment</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;">
        <th style="padding:5px 10px;text-align:left;">Parameter</th>
        <th style="padding:5px 10px;text-align:right;">Value</th>
        <th style="padding:5px 10px;text-align:left;">Notes</th>
    </tr>
    <tr><td style="padding:4px 10px;">Annual GHI</td><td style="text-align:right;">${fN(sol.ghiYear,0)} kWh/m²/yr</td><td style="padding:4px 10px;">${sol.source}</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Annual PVOUT (horizontal)</td><td style="text-align:right;">${fN(sol.pvoutYear,0)} kWh/kWp/yr</td><td style="padding:4px 10px;">GSA horizontal floating config</td></tr>
    <tr><td style="padding:4px 10px;">Average peak sun hours/day</td><td style="text-align:right;">${fN(sol.peakHoursDay,2)} h</td><td></td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Performance ratio (FPV)</td><td style="text-align:right;">0.82</td><td style="padding:4px 10px;">+2% vs ground-mount (water cooling)</td></tr>
    <tr><td style="padding:4px 10px;">Panel tilt / azimuth</td><td style="text-align:right;">10° / 180° S</td><td style="padding:4px 10px;">Low-tilt optimal for floating</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Module type</td><td style="text-align:right;">Mono-PERC 550 Wp, 21%</td><td></td></tr>
    <tr><td style="padding:4px 10px;">FPV capacity factor</td><td style="text-align:right;">${fN(e.capacityFactorPct,1)}%</td><td></td></tr>
</table>
<p style="font-size:11px;color:#888;margin-top:4px;">
    GSA detail page: <a href="${r.gsaUrl}" target="_blank">${r.gsaUrl}</a>
</p>

<!-- 3. System Sizing -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">3. System Sizing Methodology</h2>
<p style="font-size:12px;line-height:1.7;">
    The minimum FPV capacity is determined by the daily PHES charging requirement:
    <br><i>P<sub>FPV,min</sub> = E<sub>PHES</sub> ÷ (t<sub>solar</sub> × η<sub>RTE</sub>)</i>
    <br>= ${fN(r.input.phesEnergyGWh,2)} GWh × 1000 ÷ (${fN(sol.peakHoursDay,2)} h × ${fN(r.input.phesRTE,2)}) = <b>${fN(s.fpvMinMW,0)} MW</b>
    <br>A +25% cloud-cover and seasonal variability margin raises this to the design capacity of <b>${fN(s.fpvDesignMW,0)} MW</b>.
</p>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;"><th style="padding:5px 10px;text-align:left;">Parameter</th><th style="padding:5px 10px;text-align:right;">Value</th></tr>
    <tr><td style="padding:4px 10px;">PHES storage capacity</td><td style="text-align:right;">${fN(r.input.phesEnergyGWh,2)} GWh</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">PHES rated power</td><td style="text-align:right;">${fN(r.input.phesPowerMW,0)} MW</td></tr>
    <tr><td style="padding:4px 10px;">Round-trip efficiency</td><td style="text-align:right;">${fN(r.input.phesRTE*100,0)}%</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Min FPV capacity (no margin)</td><td style="text-align:right;">${fN(s.fpvMinMW,0)} MW</td></tr>
    <tr><td style="padding:4px 10px;"><b>Design FPV capacity (+25%)</b></td><td style="text-align:right;font-weight:700;">${fN(s.fpvDesignMW,0)} MW</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Number of modules (550 Wp)</td><td style="text-align:right;">${fN(s.panelsRequired,0)} panels</td></tr>
    <tr><td style="padding:4px 10px;">Panel active area</td><td style="text-align:right;">${fN(s.panelAreaM2/1e4,1)} ha</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;"><b>Total floating platform (incl. access)</b></td><td style="text-align:right;font-weight:700;">${fN(s.platformAreaHa,1)} ha &nbsp;(${fN(s.platformAreaKm2,2)} km²)</td></tr>
</table>

<!-- 4. Energy Dispatch -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">4. Annual 24/7 Energy Dispatch</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;">
        <th style="padding:5px 10px;text-align:left;">Energy Flow</th>
        <th style="padding:5px 10px;text-align:right;">Daily avg. (MWh)</th>
        <th style="padding:5px 10px;text-align:right;">Annual (GWh)</th>
    </tr>
    <tr><td style="padding:4px 10px;">FPV gross generation</td><td style="text-align:right;">${fN(e.dailyFpvMWh,1)}</td><td style="text-align:right;">${fGWh(e.annualFpvMWh)}</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">&nbsp;→ to PHES charging</td><td style="text-align:right;">${fN(e.dailyToPhes_MWh,1)}</td><td style="text-align:right;">${fGWh(e.annualToPhes_MWh)}</td></tr>
    <tr><td style="padding:4px 10px;">&nbsp;→ direct export to grid</td><td style="text-align:right;">${fN(e.dailyFpvMWh-e.dailyToPhes_MWh,1)}</td><td style="text-align:right;">${fGWh(e.annualDirect_MWh)}</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">PHES discharge to grid</td><td style="text-align:right;">${fN(e.dailyFromPhes_MWh,1)}</td><td style="text-align:right;">${fGWh(e.annualFromPhes_MWh)}</td></tr>
    <tr style="font-weight:700;border-top:2px solid #1a3a5c;"><td style="padding:5px 10px;">Total renewable supply to grid (24/7)</td><td style="text-align:right;">${fN(e.dailyToGrid_MWh,1)}</td><td style="text-align:right;">${fGWh(e.annualToGrid_MWh)}</td></tr>
</table>

<!-- 5. Capital Cost -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">5. Capital Cost Estimate (2024 USD)</h2>
<p style="font-size:12px;">Regional cost index: <b>${fN(c.regionIndex,2)}×</b> (${site.country || 'default'}).
Specific cost: <b>${fN(c.specificWp,2)} $/Wp</b>.</p>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;">
        <th style="padding:5px 10px;text-align:left;">Component</th>
        <th style="padding:5px 10px;text-align:right;">Unit ($/Wp)</th>
        <th style="padding:5px 10px;text-align:right;">Cost</th>
        <th style="padding:5px 10px;text-align:right;">Share</th>
    </tr>
    ${[
        ['Solar modules (mono-PERC 21% eff.)', 0.22*c.regionIndex, c.breakdown.modules_M],
        ['Floating structures — HDPE pontoons',  0.20*c.regionIndex, c.breakdown.floats_M],
        ['Anchoring & mooring system',           0.10*c.regionIndex, c.breakdown.anchoring_M],
        ['Electrical BOS (inverters, cables, MV)', 0.16*c.regionIndex, c.breakdown.electricalBOS_M],
        ['Installation & commissioning',         0.08*c.regionIndex, c.breakdown.installation_M],
        ['Soft costs (E&P, permits, dev.)',      0.10*c.regionIndex, c.breakdown.softCosts_M],
    ].map(([name, unit, val], i) => `
    <tr ${i%2?'style="background:#f0f4f8;"':''}>
        <td style="padding:4px 10px;">${name}</td>
        <td style="text-align:right;">${fN(unit,3)}</td>
        <td style="text-align:right;">${fM(val)}</td>
        <td style="text-align:right;">${share(val)}</td>
    </tr>`).join('')}
    <tr style="font-weight:700;border-top:2px solid #1a3a5c;">
        <td style="padding:5px 10px;">Total FPV CAPEX</td>
        <td style="text-align:right;">${fN(c.specificWp,2)}</td>
        <td style="text-align:right;">${fM(c.totalCapexM)}</td>
        <td style="text-align:right;">100%</td>
    </tr>
</table>
<p style="font-size:11px;color:#888;">Annual OPEX: ${fM(c.annualOpexM)} ($${fN(c.opexPerKW,1)}/kW/yr).
Sources: World Bank ESMAP 2023; NREL/TP-7A40-80695 scaled +10% to 2024 USD.</p>

<!-- 6. Financial -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">6. Financial Analysis</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;"><th style="padding:5px 10px;text-align:left;">Metric</th><th style="padding:5px 10px;text-align:right;">Value</th><th style="padding:5px 10px;text-align:left;">Basis</th></tr>
    <tr><td style="padding:4px 10px;">LCOE — FPV only</td><td style="text-align:right;font-weight:700;">$${fN(c.lcoeFpvPerMWh,0)}/MWh</td><td style="padding:4px 10px;">25 yr, 7% discount, 0.5%/yr degradation</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Annual revenue (grid sales)</td><td style="text-align:right;">${fM(c.annualRevM)}/yr</td><td style="padding:4px 10px;">At $${fN(energyPrice,0)}/MWh</td></tr>
    <tr><td style="padding:4px 10px;">Simple payback</td><td style="text-align:right;">${fN(c.simplePaybackYr,1)} yr</td><td></td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Module degradation</td><td style="text-align:right;">0.5%/yr</td><td style="padding:4px 10px;">IEC 61215 standard</td></tr>
    <tr><td style="padding:4px 10px;">System lifetime</td><td style="text-align:right;">25 yr</td><td style="padding:4px 10px;">ESMAP standard; structural inspection yr 12</td></tr>
</table>

<!-- 7. Environmental co-benefits -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">7. Environmental Co-Benefits</h2>
<ul style="font-size:12px;line-height:1.8;padding-left:20px;">
    <li><b>Evaporation reduction:</b> Platform covers ${fN(s.platformAreaHa,1)} ha of reservoir surface —
        preventing an estimated ${fN(s.platformAreaHa * 1.0,0)}–${fN(s.platformAreaHa * 1.5,0)} ML/yr of evaporative loss.</li>
    <li><b>Carbon abatement:</b> ~${fN(e.annualToGrid_MWh * 0.5/1000,0)} kt CO₂/yr avoided (at 0.5 kg CO₂/kWh displaced grid power).</li>
    <li><b>Water quality:</b> Shading reduces algal bloom risk; improved dissolved oxygen conditions.</li>
    <li><b>No additional land:</b> Utilises existing disturbed reservoir surface — zero new land footprint.</li>
    <li><b>Wave dampening:</b> Floating platform reduces shoreline erosion and sediment resuspension.</li>
    <li><b>Biodiversity:</b> Under-platform shading creates habitat niches; recommended partial coverage ≤ 30% of reservoir.</li>
</ul>

<!-- 8. Risks -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">8. Key Risks &amp; Mitigations</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#1a3a5c;color:#fff;">
        <th style="padding:5px 10px;">Risk</th>
        <th style="padding:5px 10px;">Likelihood</th>
        <th style="padding:5px 10px;">Mitigation</th>
    </tr>
    <tr><td style="padding:4px 10px;">Solar variability / cloud cover</td><td style="padding:4px 10px;">Medium</td><td style="padding:4px 10px;">+25% FPV capacity margin; PHES multi-day buffer</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Anchor/mooring failure (high wind)</td><td style="padding:4px 10px;">Low</td><td style="padding:4px 10px;">IEC TS 63049 mooring design; redundant shore anchors; wind load study</td></tr>
    <tr><td style="padding:4px 10px;">PHES water level variation</td><td style="padding:4px 10px;">Medium</td><td style="padding:4px 10px;">Flexible mooring lines sized for 10–100% reservoir level</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Corrosion (brackish / freshwater)</td><td style="padding:4px 10px;">Low–Med</td><td style="padding:4px 10px;">Marine-grade HDPE floats; stainless / galvanised hardware; annual inspection</td></tr>
    <tr><td style="padding:4px 10px;">O&amp;M access difficulty</td><td style="padding:4px 10px;">Low</td><td style="padding:4px 10px;">Maintenance boat ramp included; modular platform — section removal by barge</td></tr>
    <tr style="background:#f0f4f8;"><td style="padding:4px 10px;">Environmental permitting</td><td style="padding:4px 10px;">Medium</td><td style="padding:4px 10px;">EIA for aquatic ecology; phase 1 limited to 30% reservoir area</td></tr>
</table>

<!-- 9. References -->
<h2 style="color:#2471a3;font-size:14px;margin-top:20px;">9. References &amp; Data Sources</h2>
<ol style="font-size:11px;line-height:1.9;padding-left:20px;">
    <li>World Bank / ESMAP (2023). <i>Where Sun Meets Water: Floating Solar Handbook for Practitioners</i>. World Bank, Washington DC.
        <a href="https://openknowledge.worldbank.org/entities/publication/9aa88b03-2eda-5793-8796-75c2990ae43f" target="_blank">openknowledge.worldbank.org</a></li>
    <li>NREL (2022). <i>Floating Photovoltaic System Cost Benchmark: Q1 2021</i>. NREL/TP-7A40-80695.
        <a href="https://docs.nrel.gov/docs/fy22osti/80695.pdf" target="_blank">docs.nrel.gov</a></li>
    <li>IEA PVPS Task 13 (2025). <i>Floating PV Plants</i>. Report T13-31.</li>
    <li>Solargis / World Bank (2024). <i>Global Solar Atlas 2.0</i>.
        <a href="https://globalsolaratlas.info" target="_blank">globalsolaratlas.info</a></li>
    <li>IRENA (2023). <i>Renewable Power Generation Costs in 2022</i>. IRENA, Abu Dhabi.</li>
    <li>NREL (2024). <i>Q1-2024 Solar Cost Benchmarks</i>. data.nrel.gov.</li>
</ol>

<p style="font-size:10px;color:#bbb;margin-top:20px;border-top:1px solid #eee;padding-top:8px;">
    Cost estimates are preliminary (±30%) based on published engineering cost models.
    Site-specific geotechnical, bathymetric, and ecological surveys are required before investment decisions.
    Generated by <b>HydroBattery Atlas</b> — hydrobattery.info
</p>
</div>`;

        _q('#fpv-report-content').innerHTML = html;
        document.getElementById('fpv-report-modal').classList.remove('hidden');
    },

    _printReport() {
        const content = document.getElementById('fpv-report-content');
        if (!content) return;
        const css = `
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, Arial, sans-serif; margin: 24px 32px; color: #1a1a1a; font-size: 13px; }
  h1 { font-size: 18px; color: #1a3a5c; margin: 0 0 4px; }
  h2 { font-size: 14px; color: #2471a3; margin: 20px 0 6px; page-break-after: avoid; }
  p  { margin: 6px 0; line-height: 1.5; }
  ul, ol { padding-left: 20px; line-height: 1.8; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; page-break-inside: avoid; }
  th, td { padding: 4px 10px; }
  th { background: #1a3a5c; color: #fff; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td:last-child { text-align: right; }
  tr:nth-child(even) td { background: #f0f4f8; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: #2471a3; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin: 10px 0; }
  .kpi { background: #f0f4f8; border-radius: 6px; padding: 8px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kpi b { display: block; font-size: 15px; }
  .kpi span { font-size: 10px; color: #666; }
  @media print {
    body { margin: 0; }
    a { color: #2471a3; text-decoration: none; }
    @page { margin: 15mm 20mm; size: A4 portrait; }
  }`;
        const fullHtml = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Floating Solar PV Integration — Feasibility Report</title>
<style>${css}</style>
</head><body>${content.innerHTML}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const pw = window.open(url, '_blank');
        if (!pw) { window.print(); return; }
        pw.addEventListener('load', () => {
            setTimeout(() => { pw.print(); URL.revokeObjectURL(url); }, 300);
        });
    },

    // =========================================================================
    // HTML INJECTION HELPERS
    // =========================================================================
    _injectPanelHTML() {
        const siteDetail = document.getElementById('site-detail');
        if (!siteDetail || document.getElementById('fpv-panel')) return;

        const div = document.createElement('div');
        div.className = 'detail-section';
        div.id = 'fpv-panel';
        div.style.display = 'none';
        div.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;">
    <h3 style="margin-bottom:0;">&#9728; Floating Solar PV Integration</h3>
    <button id="fpv-toggle" class="fpv-toggle-btn">&#8722;</button>
</div>
<div style="font-size:10px;color:var(--text-muted);margin-top:2px;margin-bottom:10px;">
    Size a floating PV array to supply 24/7 renewable energy via the HydroBattery
</div>
<div id="fpv-body">
    <div id="fpv-gsa-status" style="font-size:11px;min-height:14px;margin-bottom:8px;"></div>
    <div class="fpv-inputs">
        <div class="fpv-field">
            <label>PHES capacity (GWh)</label>
            <input id="fpv-phes-gwh" type="number" step="0.1" min="0.001" />
        </div>
        <div class="fpv-field">
            <label>PHES power (MW)</label>
            <input id="fpv-phes-mw" type="number" step="10" min="1" />
        </div>
        <div class="fpv-field">
            <label>PVOUT kWh/kWp/yr</label>
            <input id="fpv-pvout" type="number" step="10" min="100" placeholder="auto from GSA" />
        </div>
        <div class="fpv-field">
            <label>GHI kWh/m²/yr</label>
            <input id="fpv-ghi" type="number" step="10" min="100" placeholder="auto from GSA" />
        </div>
        <div class="fpv-field">
            <label>Round-trip eff. (%)</label>
            <input id="fpv-rte" type="number" step="1" min="50" max="95" value="80" />
        </div>
        <div class="fpv-field">
            <label>Grid node limit (MW)</label>
            <input id="fpv-grid-mw" type="number" step="10" min="0" placeholder="0 = none" />
        </div>
        <div class="fpv-field">
            <label>Override peak hrs/day</label>
            <input id="fpv-peak-hrs" type="number" step="0.1" min="1" max="12" placeholder="auto" />
        </div>
    </div>
    <button id="fpv-btn-eval" class="fpv-btn-primary" style="width:100%;margin:8px 0;">
        Evaluate FPV Integration
    </button>
    <div id="fpv-results" style="display:none;"></div>
</div>`;
        siteDetail.appendChild(div);
    },

    _injectReportModal() {
        if (document.getElementById('fpv-report-modal')) return;
        const m = document.createElement('div');
        m.id = 'fpv-report-modal';
        m.className = 'modal hidden';
        m.innerHTML = `
<div class="modal-content" style="max-width:740px;max-height:88vh;overflow-y:auto;">
    <button class="modal-close" id="fpv-report-close">&times;</button>
    <div id="fpv-report-content"></div>
    <div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #ddd;">
        <button id="fpv-report-print"
            style="flex:1;padding:9px;background:#1a3a5c;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;">
            🖨 Print / Save PDF
        </button>
        <button id="fpv-report-close2"
            style="flex:0 0 auto;padding:9px 18px;background:none;border:1px solid #ddd;border-radius:4px;font-size:12px;cursor:pointer;">
            Close
        </button>
    </div>
</div>`;
        document.body.appendChild(m);
    },

    _injectCSS() {
        if (document.getElementById('fpv-style')) return;
        const s = document.createElement('style');
        s.id = 'fpv-style';
        s.textContent = `
.fpv-inputs { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:6px; }
.fpv-field label { font-size:10px; font-weight:600; text-transform:uppercase; color:var(--text-secondary); display:block; }
.fpv-field input { width:100%; height:27px; padding:0 6px; border:1px solid var(--border); border-radius:4px; font-size:12px; box-sizing:border-box; margin-top:2px; background:var(--bg,#fff); color:var(--text,#222); }
.fpv-section { margin-bottom:12px; }
.fpv-stitle { font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-secondary); margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; }
.fpv-src { font-size:10px; font-weight:400; text-transform:none; }
.fpv-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; }
.fpv-kpi { background:var(--bg-alt,#f5f7fa); border-radius:4px; padding:6px 4px; text-align:center; }
.fpv-kpi b { display:block; font-size:13px; color:var(--text); }
.fpv-kpi span { font-size:9px; color:var(--text-muted); }
.fpv-kpi-accent { background:rgba(52,152,219,0.12); }
.fpv-tbl { width:100%; border-collapse:collapse; font-size:11px; }
.fpv-tbl tr:nth-child(even) td { background:var(--bg-alt,#f5f7fa); }
.fpv-tbl td { padding:3px 0; }
.fpv-tbl td:last-child { text-align:right; }
.fpv-total td { font-weight:700; border-top:1px solid var(--border); padding-top:4px; }
.fpv-legend { font-size:10px; color:var(--text-muted); margin-top:4px; }
.fpv-dot { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:3px; vertical-align:middle; }
.fpv-actions { display:flex; gap:6px; margin-top:10px; }
.fpv-btn-primary { flex:1; height:32px; background:var(--accent,#3498db); color:#fff; border:none; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer; }
.fpv-btn-outline { flex:1; height:32px; border:1px solid var(--accent,#3498db); color:var(--accent,#3498db); background:none; border-radius:4px; font-size:12px; cursor:pointer; text-align:center; line-height:30px; text-decoration:none; }
.fpv-toggle-btn { background:none; border:1px solid var(--border); border-radius:4px; width:24px; height:24px; cursor:pointer; font-size:16px; line-height:1; color:var(--text-secondary); }
@media print {
    #fpv-report-modal .modal-content { max-height:none !important; overflow:visible !important; }
    button { display:none !important; }
}`;
        document.head.appendChild(s);
    },

    // =========================================================================
    // EVENT BINDING
    // =========================================================================
    _bindEvents() {
        document.addEventListener('click', (e) => {
            const id = e.target.id;
            if (id === 'fpv-btn-eval')    { this._evaluate(); return; }
            if (id === 'fpv-toggle') {
                const body = document.getElementById('fpv-body');
                const hidden = body.style.display === 'none';
                body.style.display = hidden ? '' : 'none';
                e.target.innerHTML = hidden ? '&#8722;' : '+';
                return;
            }
            if (id === 'fpv-report-print') { this._printReport(); return; }
            if (id === 'fpv-report-close' || id === 'fpv-report-close2') {
                document.getElementById('fpv-report-modal')?.classList.add('hidden');
            }
        });
    },
};

// ─── tiny helpers ────────────────────────────────────────────────────────────
function _q(sel)    { return document.querySelector(sel); }
function _set(id,v) { const el=document.getElementById(id); if(el) el.value=v; }
function _num(id)   { return parseFloat(document.getElementById(id)?.value)||0; }
function _hide(id)  { const el=document.getElementById(id); if(el) el.style.display='none'; }
function _show(id)  { const el=document.getElementById(id); if(el) el.style.display=''; }
