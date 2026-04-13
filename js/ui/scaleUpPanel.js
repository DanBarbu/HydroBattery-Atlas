/**
 * Scale-Up Panel — Comparison dashboard for multi-tier PHES storage scenarios.
 *
 * Renders a side-by-side comparison table across storage tiers (2–150 GWh)
 * for the currently selected site, using the same lake-pair geometry.
 *
 * Features:
 *   - Tier selector (checkboxes to include/exclude tiers)
 *   - Storage duration selector (6 h, 10 h, 18 h)
 *   - Lifetime selector (30 / 40 / 50 yr) for financial metrics
 *   - Horizontal-scrollable comparison table with colour-coded best values
 *   - Auto-refreshes when financial parameters are recalculated
 *
 * Depends on: HB.Cost.scaleUp, HB.Cost.engine (anuModel)
 */
HB.UI = HB.UI || {};

HB.UI.scaleUp = {

    _currentSite:   null,
    _results:       null,
    _activeTiers:   new Set(['p0', 'p1', 2, 5, 10, 20, 50, 150]),
    _storageHours:  18,
    _lifetime:      40,     // yr30 | yr40 | yr50

    // -----------------------------------------------------------------------
    // PUBLIC API
    // -----------------------------------------------------------------------

    init() {
        // No DOM-level init required; everything is rendered on demand.
    },

    /**
     * Called by siteDetailPanel.show() whenever a site is displayed.
     * Resets the panel and shows a "Generate" button.
     */
    render(site) {
        this._currentSite = site;
        this._results = null;

        const panel = document.getElementById('scale-up-panel');
        if (!panel) return;

        panel.style.display = 'block';
        this._renderControls();
    },

    /**
     * Re-run analysis with current financial parameters (called after recalculate).
     */
    refresh() {
        if (this._results) this._runAnalysis();
    },

    // -----------------------------------------------------------------------
    // CONTROLS RENDER
    // -----------------------------------------------------------------------

    _renderControls() {
        const body = document.getElementById('scale-up-body');
        if (!body) return;

        // Phase options (pre-PHES stages)
        const phaseOptions = [
            { id: 'p0', label: 'Phase 0 — FPV Only' },
            { id: 'p1', label: 'Phase 1 — Retrofit + FPV' }
        ].map(p => {
            const checked = this._activeTiers.has(p.id) ? 'checked' : '';
            return `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" class="su-tier-cb" value="${p.id}" ${checked}
                               style="cursor:pointer;" />
                        <span style="font-style:italic;color:#0d47a1;">${p.label}</span>
                    </label>`;
        }).join('');

        // GWh tier options (Phase 2+)
        const tierOptions = HB.Cost.scaleUp.TIERS.map(t => {
            const checked = this._activeTiers.has(t) ? 'checked' : '';
            return `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" class="su-tier-cb" value="${t}" ${checked}
                               style="cursor:pointer;" />
                        <span>${t} GWh</span>
                    </label>`;
        }).join('');

        body.innerHTML = `
            <div style="margin-bottom:10px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px;">Pre-Integration Phases</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;margin-bottom:6px;">
                    ${phaseOptions}
                </div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px;">PHES Storage Tiers (Phase 2+)</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;">
                    ${tierOptions}
                </div>
            </div>

            <div style="display:flex;gap:10px;margin-bottom:10px;">
                <div style="flex:1;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px;">Storage Duration</div>
                    <select id="su-duration" style="width:100%;height:28px;font-size:12px;border:1px solid var(--border);border-radius:4px;padding:0 6px;">
                        <option value="6" ${this._storageHours === 6  ? 'selected' : ''}>6 hours</option>
                        <option value="10" ${this._storageHours === 10 ? 'selected' : ''}>10 hours</option>
                        <option value="18" ${this._storageHours === 18 ? 'selected' : ''}>18 hours (ANU)</option>
                    </select>
                </div>
                <div style="flex:1;">
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:4px;">Project Lifetime</div>
                    <select id="su-lifetime" style="width:100%;height:28px;font-size:12px;border:1px solid var(--border);border-radius:4px;padding:0 6px;">
                        <option value="30" ${this._lifetime === 30 ? 'selected' : ''}>30 years</option>
                        <option value="40" ${this._lifetime === 40 ? 'selected' : ''}>40 years</option>
                        <option value="50" ${this._lifetime === 50 ? 'selected' : ''}>50 years</option>
                    </select>
                </div>
            </div>

            <button id="btn-run-scaleup" class="btn-primary" style="width:100%;margin-bottom:8px;">
                Generate Scale-Up Analysis
            </button>

            <div id="scale-up-table-wrap"></div>
        `;

        // Wire events
        document.querySelectorAll('.su-tier-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const raw = cb.value;
                const val = (raw === 'p0' || raw === 'p1') ? raw : parseInt(raw, 10);
                cb.checked ? this._activeTiers.add(val) : this._activeTiers.delete(val);
            });
        });

        document.getElementById('su-duration').addEventListener('change', e => {
            this._storageHours = parseInt(e.target.value, 10);
        });

        document.getElementById('su-lifetime').addEventListener('change', e => {
            this._lifetime = parseInt(e.target.value, 10);
            // Re-render table if results already computed
            if (this._results) this._renderTable();
        });

        document.getElementById('btn-run-scaleup').addEventListener('click', () => this._runAnalysis());
    },

    // -----------------------------------------------------------------------
    // ANALYSIS
    // -----------------------------------------------------------------------

    _runAnalysis() {
        const site = this._currentSite;
        if (!site) return;

        const btn = document.getElementById('btn-run-scaleup');
        if (btn) { btn.textContent = 'Calculating…'; btn.disabled = true; }

        // Extract lake-pair geometry from current site
        const headM       = site.headHeight || site.head_m || 200;
        const separationM = site.tunnelLength
            || ((site.separation_km || site.anu_separation_km || 5) * 1000);
        const waterRockRatio = site.water_rock_ratio
            || site.anu_water_rock_ratio || 10;
        const country = site.country || 'default';

        // Build ordered tiers: phases first ('p0','p1'), then numeric GWh ascending
        const phases = [];
        const numeric = [];
        this._activeTiers.forEach(t => {
            if (typeof t === 'string') phases.push(t);
            else numeric.push(t);
        });
        phases.sort();                    // p0 before p1
        numeric.sort((a, b) => a - b);
        const activeTiersArr = [...phases, ...numeric];

        // Bluefield / operational sites use existing reservoirs: no new dam cost
        const useExistingReservoirs = (site.isdam === false)
            || (site.status && site.status.indexOf('bluefield') !== -1)
            || site.status === 'operational'
            || site.status === 'under_construction'
            || site.configuration === 'lake_pair';

        // Run scale-up engine (handles 'p0','p1' + numeric tiers)
        this._results = HB.Cost.scaleUp.calculate({
            headM,
            separationM,
            waterRockRatio,
            country,
            storageHours: this._storageHours,
            useExistingReservoirs
        }, activeTiersArr);

        if (btn) { btn.textContent = 'Regenerate Analysis'; btn.disabled = false; }

        this._renderTable();
    },

    // -----------------------------------------------------------------------
    // TABLE RENDER
    // -----------------------------------------------------------------------

    _renderTable() {
        const wrap = document.getElementById('scale-up-table-wrap');
        if (!wrap || !this._results || !this._results.length) return;

        const results = this._results;
        const ltKey = `yr${this._lifetime}`;

        // Helper: find min/max across tiers for a metric → colour coding
        const vals = (fn) => results.map(fn);
        const minOf = (fn) => Math.min(...vals(fn).filter(v => v !== null && isFinite(v)));
        const maxOf = (fn) => Math.max(...vals(fn).filter(v => v !== null && isFinite(v)));

        // Colour coding: green = best, red = worst (direction-aware)
        const _cellBg = (val, min, max, lowerIsBetter) => {
            if (val === null || !isFinite(val) || max === min) return '';
            const t = (val - min) / (max - min);          // 0 = min, 1 = max
            const greenT = lowerIsBetter ? (1 - t) : t;   // 0 = red, 1 = green
            const r = Math.round(255 - greenT * 180);
            const g = Math.round(140 + greenT * 115);
            const b = Math.round(140 - greenT * 80);
            return `background:rgba(${r},${g},${b},0.18);`;
        };

        // Precompute min/max for colour coding
        const minCapexKWh  = minOf(r => r.capex.per_kWh);
        const maxCapexKWh  = maxOf(r => r.capex.per_kWh);
        const minCapexKW   = minOf(r => r.capex.per_kW);
        const maxCapexKW   = maxOf(r => r.capex.per_kW);
        const minLcos      = minOf(r => r.lcos.total);
        const maxLcos      = maxOf(r => r.lcos.total);
        const minOpexPct   = minOf(r => r.opex.pct_capex);
        const maxOpexPct   = maxOf(r => r.opex.pct_capex);
        const minNpv5      = minOf(r => r.lifetimes[ltKey]?.npv5_M);
        const maxNpv5      = maxOf(r => r.lifetimes[ltKey]?.npv5_M);
        const minNpv8      = minOf(r => r.lifetimes[ltKey]?.npv8_M);
        const maxNpv8      = maxOf(r => r.lifetimes[ltKey]?.npv8_M);
        const minNpv10     = minOf(r => r.lifetimes[ltKey]?.npv10_M);
        const maxNpv10     = maxOf(r => r.lifetimes[ltKey]?.npv10_M);
        const minIrr       = minOf(r => r.lifetimes[ltKey]?.irr_pct);
        const maxIrr       = maxOf(r => r.lifetimes[ltKey]?.irr_pct);
        const minRoi       = minOf(r => r.lifetimes[ltKey]?.roi_pct);
        const maxRoi       = maxOf(r => r.lifetimes[ltKey]?.roi_pct);
        const minPayback   = minOf(r => r.lifetimes[ltKey]?.payback_yr);
        const maxPayback   = maxOf(r => r.lifetimes[ltKey]?.payback_yr);

        // Format helpers
        const _$M  = v  => v === null || !isFinite(v) ? '—' : `$${_fmt(v)}M`;
        const _$B  = v  => v === null || !isFinite(v) ? '—'
                        : (Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(2)}B` : `$${_fmt(v)}M`);
        const _pct = v  => v === null || !isFinite(v) ? '—' : `${v.toFixed(1)}%`;
        const _yr  = v  => v === null || !isFinite(v) ? '—' : `${v.toFixed(1)} yr`;
        const _num = (v, dp=0) => v === null || !isFinite(v) ? '—'
                        : v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

        // Build column headers (phases vs tiers)
        const headerCols = results.map(r => {
            if (r.isPhase) {
                return `<th style="min-width:90px;text-align:right;padding:6px 8px;white-space:nowrap;">
                    <div style="font-size:13px;font-weight:800;color:#0d47a1;">${r.label}</div>
                    <div style="font-size:9px;color:#666;font-weight:400;line-height:1.3;">${r.sublabel}</div>
                    <div style="font-size:10px;color:#888;margin-top:2px;">${_num(r.firmMW || r.powerMW, 0)} MW firm</div>
                </th>`;
            }
            return `<th style="min-width:80px;text-align:right;padding:6px 8px;white-space:nowrap;">
                <div style="font-size:14px;font-weight:800;color:#1565c0;">${r.energyGWh} GWh</div>
                <div style="font-size:10px;color:#888;font-weight:400;">${_num(r.powerMW, 0)} MW</div>
            </th>`;
        }).join('');

        // Build table rows — helper to build a data row
        const _row = (label, cells, sublabel) => `
            <tr>
                <td style="padding:5px 8px;color:#555;font-size:11px;white-space:nowrap;">
                    ${label}
                    ${sublabel ? `<div style="color:#aaa;font-size:9px;">${sublabel}</div>` : ''}
                </td>
                ${cells}
            </tr>`;

        const _td = (val, bg) =>
            `<td style="text-align:right;padding:5px 8px;font-size:12px;font-variant-numeric:tabular-nums;${bg || ''}">${val}</td>`;

        const _section = (title) => `
            <tr style="background:#f0f4f8;">
                <td colspan="${results.length + 1}" style="padding:5px 8px;font-size:10px;font-weight:800;text-transform:uppercase;color:#455a7b;letter-spacing:0.6px;">${title}</td>
            </tr>`;

        // ---- PHASE DETAILS (only shown when phases are included) ----
        const hasPhases = results.some(r => r.isPhase);
        const phaseRows = !hasPhases ? '' : [
            _section('Phase Details'),
            _row('FPV solar capacity', results.map(r =>
                _td(r.solarMW ? `${_num(r.solarMW, 0)} MW` : '\u2014')
            ).join(''), 'floating PV'),
            _row('Turbine retrofit', results.map(r =>
                _td(r.capex.turbineRetrofit_M ? `${_num(r.capex.turbineRetrofit_M, 0)} MW @ $${HB.Cost.scaleUp.RETROFIT_PER_MW}M/MW` : '\u2014')
            ).join(''), 'pump-back conversion'),
            _row('Firm 24/7 output', results.map(r =>
                _td(r.firmMW != null ? `<strong>${_num(r.firmMW, 0)} MW</strong>` : '\u2014')
            ).join(''), 'guaranteed dispatchable')
        ].join('');

        // ---- ENGINEERING ----
        const engRows = [
            _section('Engineering'),
            _row('Power capacity', results.map(r => _td(`${_num(r.powerMW, 0)} MW`)).join('')),
            _row('Storage duration', results.map(r =>
                _td(r.storageHours ? `${r.storageHours} h` : '\u2014')
            ).join('')),
            _row('Head height', results.map(r => _td(`${_num(r.anu.engineering.headM, 0)} m`)).join('')),
            _row('Tunnel / sep.', results.map(r => _td(`${(r.anu.engineering.separationM / 1000).toFixed(1)} km`)).join('')),
            _row('Water volume', results.map(r =>
                _td(r.anu.engineering.totalWaterGL ? `${r.anu.engineering.totalWaterGL.toFixed(1)} GL` : '\u2014')
            ).join('')),
            _row('Reservoir area', results.map(r =>
                _td(r.anu.engineering.upperAreaHa ? `${_num(r.anu.engineering.upperAreaHa, 0)} ha` : '\u2014')
            ).join('')),
            _row('W:R ratio', results.map(r =>
                _td(r.anu.engineering.waterRockRatio || '\u2014')
            ).join('')),
            _row('ANU cost class', results.map(r => {
                const cls = r.anu.summary.costClass;
                if (cls === '\u2014') return _td('\u2014');
                const col = cls === 'A' ? '#2e7d32' : cls === 'B' ? '#1565c0'
                          : cls === 'C' ? '#e65100' : '#c62828';
                return _td(`<span style="font-weight:800;color:${col};">${cls}</span>`);
            }).join(''))
        ].join('');

        // ---- CAPITAL COSTS ----
        const capexRows = [
            _section('Capital Costs (CAPEX)'),
            _row('Dam / reservoirs', results.map(r => _td(r.capex.dam_M ? _$M(r.capex.dam_M) : '\u2014')).join('')),
            _row('Tunnel / penstock', results.map(r => _td(r.capex.tunnel_M ? _$M(r.capex.tunnel_M) : '\u2014')).join('')),
            _row('Powerhouse + turbines', results.map(r => _td(r.capex.powerhouse_M ? _$M(r.capex.powerhouse_M) : '\u2014')).join('')),
            _row('Turbine retrofit', results.map(r => _td(r.capex.turbineRetrofit_M ? _$M(r.capex.turbineRetrofit_M) : '\u2014')).join(''), 'pump-back conversion'),
            _row('FPV solar', results.map(r => _td(r.capex.solar_M ? _$M(r.capex.solar_M) : '\u2014')).join(''), 'utility-scale floating PV'),
            _row('Electrical infra', results.map(r => _td(_$M(r.capex.electrical_M))).join(''), 'transformers, grid, SCADA'),
            _row('Civil + environmental', results.map(r => _td(r.capex.civil_env_M ? _$M(r.capex.civil_env_M) : '\u2014')).join(''), 'roads, EIA, permitting'),
            _row('EPC contingency (10%)', results.map(r => _td(_$M(r.capex.epc_M))).join('')),
            _row('Total CAPEX', results.map(r => _td(
                `<strong>${_$B(r.capex.total_M)}</strong>`
            )).join('')),
            _row('$/kW', results.map(r => _td(
                `<span style="${_cellBg(r.capex.per_kW, minCapexKW, maxCapexKW, true)}padding:2px 4px;border-radius:3px;">$${_num(r.capex.per_kW)}</span>`
            )).join('')),
            _row('$/kWh stored', results.map(r => {
                if (r.capex.per_kWh == null) return _td('\u2014');
                return _td(
                    `<span style="${_cellBg(r.capex.per_kWh, minCapexKWh, maxCapexKWh, true)}padding:2px 4px;border-radius:3px;">$${r.capex.per_kWh.toFixed(1)}</span>`
                );
            }).join(''))
        ].join('');

        // ---- OPEX ----
        const opexRows = [
            _section('Annual OPEX (1.5% of CAPEX)'),
            _row('Annual OPEX', results.map(r => _td(_$M(r.opex.annual_M))).join('')),
            _row('OPEX % of CAPEX', results.map(r => _td(_pct(r.opex.pct_capex))).join(''))
        ].join('');

        // ---- LCOE / LCOS ----
        const lcosLabel = hasPhases
            ? 'LCOS / LCOE — Levelized Cost ($/MWh)'
            : 'LCOS — Levelized Cost of Energy Storage ($/MWh)';
        const lcosRows = [
            _section(lcosLabel),
            _row('Lost energy cost', results.map(r =>
                _td(r.lcos.isLCOE ? '\u2014' : `$${r.lcos.lostEnergy.toFixed(1)}`)
            ).join('')),
            _row('Capital cost component', results.map(r =>
                _td(r.lcos.isLCOE ? '\u2014' : `$${r.lcos.capital.toFixed(1)}`)
            ).join('')),
            _row('O&M component', results.map(r =>
                _td(r.lcos.isLCOE ? '\u2014' : `$${r.lcos.om.toFixed(1)}`)
            ).join('')),
            _row('LCOS / LCOE Total', results.map(r => {
                const lbl = r.lcos.isLCOE ? 'LCOE' : r.lcos.isBlended ? 'Blended' : 'LCOS';
                return _td(
                    `<strong style="${_cellBg(r.lcos.total, minLcos, maxLcos, true)}padding:2px 4px;border-radius:3px;">$${r.lcos.total.toFixed(1)}</strong>`
                    + `<div style="font-size:9px;color:#888;">${lbl}</div>`
                );
            }).join(''))
        ].join('');

        // ---- REVENUE MODEL ----
        const revenueRows = [
            _section(`Revenue Model (${this._lifetime}-yr lifetime, sell @ $${HB.Cost.financials.energyPurchasePrice}/MWh)`),
            _row('Gross revenue', results.map(r => _td(_$M(r.revenue.gross_M))).join(''), '/yr'),
            _row('Energy purchase cost', results.map(r => _td(_$M(r.revenue.energyCost_M))).join(''), `/yr @ ${Math.round(HB.Cost.scaleUp.BUY_PRICE_FRACTION * 100)}% of sell price`),
            _row('Annual OPEX', results.map(r => _td(_$M(r.opex.annual_M))).join(''), '/yr'),
            _row('Net annual revenue', results.map(r => {
                const v = r.revenue.net_M;
                const col = v > 0 ? '#2e7d32' : '#c62828';
                return _td(`<strong style="color:${col};">${_$M(v)}</strong>`);
            }).join(''), '/yr after OPEX')
        ].join('');

        // ---- FINANCIAL METRICS ----
        const ltLabel = `${this._lifetime}-Year`;
        const finRows = [
            _section(`Financial Metrics — ${ltLabel} Project Life`),

            _row(`NPV @ 5% discount`, results.map(r => {
                const v = r.lifetimes[ltKey]?.npv5_M;
                const bg = _cellBg(v, minNpv5, maxNpv5, false);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_$B(v)}</span>`);
            }).join('')),

            _row(`NPV @ 8% discount`, results.map(r => {
                const v = r.lifetimes[ltKey]?.npv8_M;
                const bg = _cellBg(v, minNpv8, maxNpv8, false);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_$B(v)}</span>`);
            }).join('')),

            _row(`NPV @ 10% discount`, results.map(r => {
                const v = r.lifetimes[ltKey]?.npv10_M;
                const bg = _cellBg(v, minNpv10, maxNpv10, false);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_$B(v)}</span>`);
            }).join('')),

            _row('IRR', results.map(r => {
                const v = r.lifetimes[ltKey]?.irr_pct;
                const bg = _cellBg(v, minIrr, maxIrr, false);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;font-weight:700;">${_pct(v)}</span>`);
            }).join('')),

            _row(`ROI (${ltLabel})`, results.map(r => {
                const v = r.lifetimes[ltKey]?.roi_pct;
                const bg = _cellBg(v, minRoi, maxRoi, false);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_pct(v)}</span>`);
            }).join('')),

            _row('Simple payback', results.map(r => {
                const v = r.lifetimes[ltKey]?.payback_yr;
                const bg = _cellBg(v, minPayback, maxPayback, true);
                return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_yr(v)}</span>`);
            }).join(''), 'undiscounted')
        ].join('');

        // ---- COMPARISON ACROSS ALL LIFETIMES ----
        const allLifetimeRows = [30, 40, 50].map(yr => {
            const lk = `yr${yr}`;
            const minIrrYr = minOf(r => r.lifetimes[lk]?.irr_pct);
            const maxIrrYr = maxOf(r => r.lifetimes[lk]?.irr_pct);
            return `
                ${_section(`IRR Comparison — ${yr}-Year Life`)}
                ${_row(`IRR @ ${yr} yr`, results.map(r => {
                    const v = r.lifetimes[lk]?.irr_pct;
                    const bg = _cellBg(v, minIrrYr, maxIrrYr, false);
                    return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;font-weight:700;">${_pct(v)}</span>`);
                }).join(''))}
                ${_row(`NPV@8% @ ${yr} yr`, results.map(r => {
                    const v = r.lifetimes[lk]?.npv8_M;
                    const mn = minOf(rr => rr.lifetimes[lk]?.npv8_M);
                    const mx = maxOf(rr => rr.lifetimes[lk]?.npv8_M);
                    const bg = _cellBg(v, mn, mx, false);
                    return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_$B(v)}</span>`);
                }).join(''))}
                ${_row(`Payback @ ${yr} yr`, results.map(r => {
                    const v = r.lifetimes[lk]?.payback_yr;
                    const mn = minOf(rr => rr.lifetimes[lk]?.payback_yr);
                    const mx = maxOf(rr => rr.lifetimes[lk]?.payback_yr);
                    const bg = _cellBg(v, mn, mx, true);
                    return _td(`<span style="${bg}padding:2px 4px;border-radius:3px;">${_yr(v)}</span>`);
                }).join(''))}`;
        }).join('');

        // Assumptions footnote
        const fin = HB.Cost.financials;
        const footnote = `
            <div style="margin-top:10px;font-size:10px;color:#888;line-height:1.5;border-top:1px solid #e0e0e0;padding-top:8px;">
                <strong>Assumptions:</strong>
                Storage duration: ${this._storageHours}h &nbsp;|&nbsp;
                Sell price: $${fin.energyPurchasePrice}/MWh &nbsp;|&nbsp;
                Buy price: $${Math.round(fin.energyPurchasePrice * HB.Cost.scaleUp.BUY_PRICE_FRACTION)}/MWh &nbsp;|&nbsp;
                Cycles/yr: ${fin.cyclesPerYear} &nbsp;|&nbsp;
                OPEX: ${HB.Cost.scaleUp.OPEX_FRACTION * 100}% CAPEX/yr &nbsp;|&nbsp;
                EPC contingency: ${HB.Cost.scaleUp.EPC_CONTINGENCY * 100}% &nbsp;|&nbsp;
                Gen. efficiency: ${Math.round(fin.genEfficiency * 100)}% &nbsp;|&nbsp;
                Region factor: ${fin.regionFactors[this._currentSite?.country] || fin.regionFactors['default']}×.
                <br>Cost colours: <span style="background:rgba(75,195,120,0.25);padding:0 4px;border-radius:2px;">green = best</span>
                &nbsp;<span style="background:rgba(220,80,80,0.18);padding:0 4px;border-radius:2px;">red = worst</span>.
                NPV/IRR use a simplified arbitrage revenue model (buy/sell spread). ±50% accuracy.
            </div>`;

        wrap.innerHTML = `
            <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #dde3ec;border-radius:6px;margin-top:4px;">
                <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
                    <thead>
                        <tr style="background:#1a3a5c;color:#fff;">
                            <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap;">Metric</th>
                            ${headerCols}
                        </tr>
                    </thead>
                    <tbody>
                        ${phaseRows}
                        ${engRows}
                        ${capexRows}
                        ${opexRows}
                        ${lcosRows}
                        ${revenueRows}
                        ${finRows}
                        ${allLifetimeRows}
                    </tbody>
                </table>
            </div>
            ${footnote}
        `;

        // Zebra row striping
        wrap.querySelectorAll('tbody tr:not([style*="background:#f0f4f8"])').forEach((tr, i) => {
            if (i % 2 === 1) tr.style.background = 'rgba(0,0,0,0.02)';
        });
    }
};

// ---- Local format helper ----
function _fmt(n) {
    if (n === null || !isFinite(n)) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'k';
    if (abs >= 100)  return sign + abs.toFixed(0);
    if (abs >= 10)   return sign + abs.toFixed(1);
    return sign + abs.toFixed(2);
}
