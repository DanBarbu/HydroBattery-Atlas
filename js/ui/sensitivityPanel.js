/**
 * Sensitivity Analysis Panel
 * Tunes each location variable ±50% of its base value and shows
 * the correlated impact on CAPEX and LCOE (tornado diagram).
 */
HB.UI = HB.UI || {};

HB.UI.SensitivityPanel = {

    _base: null,        // { headM, separationM, energyGWh, powerMW, waterRockRatio, country }
    _baseResult: null,  // anuModel() result at base values
    _mults: null,       // multiplier per parameter (1.0 = base)

    // Parameter definitions: key, display label, unit, formatting helper
    PARAMS: [
        {
            key: 'energy',
            label: 'Energy Storage',
            format(base, mult) {
                const mwh = base.energyGWh * mult * 1000;
                return mwh >= 1000
                    ? `${(mwh / 1000).toFixed(2)} GWh`
                    : `${mwh.toFixed(0)} MWh`;
            }
        },
        {
            key: 'head',
            label: 'Head Height',
            format(base, mult) { return `${Math.round(base.headM * mult)} m`; }
        },
        {
            key: 'tunnel',
            label: 'Tunnel Length',
            format(base, mult) { return `${(base.separationM * mult / 1000).toFixed(1)} km`; }
        },
        {
            key: 'power',
            label: 'Power Rating',
            format(base, mult) { return `${Math.round(base.powerMW * mult)} MW`; }
        },
        {
            key: 'waterRock',
            label: 'Water:Rock Ratio',
            format(base, mult) { return `${(base.waterRockRatio * mult).toFixed(1)}`; }
        }
    ],

    // Called from siteDetailPanel.show() whenever any site is displayed
    onSiteShown(site) {
        // Prefer ANU engineering values (already normalised); fall back to raw site fields
        const eng = site.anuResult?.engineering;
        const energyGWh = eng?.energyGWh
            || (site.energyKWh ? site.energyKWh / 1e6 : (site.storage_mwh || 2000) / 1000);
        const headM       = eng?.headM       || site.headHeight   || site.head_m    || 300;
        const separationM = eng?.separationM || site.tunnelLength || site.tunnel_length_m || 5000;
        const powerMW     = eng?.powerMW
            || (site.powerKW  ? site.powerKW  / 1000 : null)
            || (site.capacity_mw || null)
            || energyGWh * 1000 / 18;   // default 18-hour storage
        const waterRockRatio = eng?.waterRockRatio
            || site.water_rock_ratio || site.anu_water_rock_ratio || 10;
        const country = site.country || 'default';

        const useExistingReservoirs = (site.isdam === false);
        this._base = { energyGWh, headM, separationM, powerMW, waterRockRatio, country, useExistingReservoirs };
        this._mults = { energy: 1, head: 1, tunnel: 1, power: 1, waterRock: 1 };

        // Compute base result (reuse anuResult if already available)
        this._baseResult = site.anuResult || this._runModel(this._base);

        this._buildSliders();
        this._recalcAndRender();

        const panel = document.getElementById('sensitivity-panel');
        if (panel) panel.style.display = '';
    },

    init() {
        // Collapse / expand toggle
        document.getElementById('toggle-sens-body')?.addEventListener('click', () => {
            const body = document.getElementById('sens-body');
            const btn  = document.getElementById('toggle-sens-body');
            if (!body) return;
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            btn.innerHTML = isHidden ? '&#8722;' : '+';
        });

        // Reset button
        document.getElementById('sens-reset')?.addEventListener('click', () => this._reset());
    },

    // ── Private ──────────────────────────────────────────────────────────────

    _buildSliders() {
        const container = document.getElementById('sens-sliders');
        if (!container) return;

        container.innerHTML = this.PARAMS.map(p => `
            <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                    <span style="font-size:11px;font-weight:600;color:var(--text-primary);">${p.label}</span>
                    <span id="sens-val-${p.key}"
                          style="font-size:11px;font-weight:700;color:var(--primary);min-width:70px;text-align:right;">
                        ${p.format(this._base, 1)}
                    </span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:10px;color:var(--text-muted);width:28px;flex-shrink:0;">−50%</span>
                    <input type="range" id="sens-slider-${p.key}"
                           min="0" max="100" value="50"
                           style="flex:1;height:4px;accent-color:var(--primary);cursor:pointer;" />
                    <span style="font-size:10px;color:var(--text-muted);width:28px;flex-shrink:0;text-align:right;">+50%</span>
                </div>
                <div style="text-align:center;margin-top:2px;">
                    <span id="sens-pct-${p.key}"
                          style="font-size:10px;color:var(--text-muted);">base</span>
                </div>
            </div>
        `).join('');

        this.PARAMS.forEach(p => {
            const slider = document.getElementById(`sens-slider-${p.key}`);
            if (!slider) return;
            slider.addEventListener('input', () => {
                // slider 0→100  maps to multiplier 0.5×→1.5×
                this._mults[p.key] = 0.5 + slider.value / 100;
                this._updateSliderLabel(p.key);
                this._recalcAndRender();
            });
        });
    },

    _updateSliderLabel(key) {
        const mult  = this._mults[key];
        const param = this.PARAMS.find(p => p.key === key);
        const valEl = document.getElementById(`sens-val-${key}`);
        const pctEl = document.getElementById(`sens-pct-${key}`);
        if (param && valEl) valEl.textContent = param.format(this._base, mult);
        if (pctEl) {
            const pct = (mult - 1) * 100;
            pctEl.textContent = pct === 0 ? 'base' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
            pctEl.style.color = pct === 0
                ? 'var(--text-muted)'
                : (pct > 0 ? '#e65100' : '#1e8c3a');
        }
    },

    _getAdjustedParams(overrides) {
        const b = this._base;
        const m = overrides || this._mults;
        return {
            headM:          b.headM          * (m.head      ?? 1),
            separationM:    b.separationM    * (m.tunnel    ?? 1),
            energyGWh:      b.energyGWh      * (m.energy    ?? 1),
            powerMW:        b.powerMW        * (m.power     ?? 1),
            waterRockRatio: b.waterRockRatio * (m.waterRock ?? 1),
            country:        b.country,
            useExistingReservoirs: b.useExistingReservoirs
        };
    },

    _runModel(params) {
        return HB.Cost.engine.anuModel({
            headM:          params.headM,
            separationM:    params.separationM,
            energyGWh:      params.energyGWh,
            powerMW:        params.powerMW,
            waterRockRatio: params.waterRockRatio,
            country:        params.country,
            useExistingReservoirs: params.useExistingReservoirs
        });
    },

    _recalcAndRender() {
        const result = this._runModel(this._getAdjustedParams());
        this._renderMetrics(result);
        this._drawTornado();
    },

    // ── Metrics bar ──────────────────────────────────────────────────────────

    _renderMetrics(result) {
        const container = document.getElementById('sens-metrics');
        if (!container || !result) return;

        const bs = this._baseResult?.summary;
        const cs = result.summary;

        const deltaBadge = (curr, base, lowerIsBetter) => {
            if (!base || base === 0) return '';
            const pct = (curr - base) / base * 100;
            if (Math.abs(pct) < 0.1) return '<div style="font-size:9px;color:var(--text-muted);">—</div>';
            const good  = lowerIsBetter ? (pct < 0) : (pct > 0);
            const color = good ? '#1e8c3a' : '#e74c3c';
            return `<div style="font-size:9px;color:${color};font-weight:600;">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</div>`;
        };

        const CLASS_COLOR = {
            A: '#1e8c3a', B: '#2e7d32', C: '#f9ab00',
            D: '#e65100', E: '#c62828', '>E': '#b71c1c'
        };

        const items = [
            {
                value: cs.totalCapexM >= 1000
                    ? `$${(cs.totalCapexM / 1000).toFixed(2)}B`
                    : `$${cs.totalCapexM.toFixed(0)}M`,
                delta: deltaBadge(cs.totalCapexM, bs?.totalCapexM, true),
                label: 'CAPEX'
            },
            {
                value: `$${Math.round(cs.costPerKWh)}`,
                delta: deltaBadge(cs.costPerKWh, bs?.costPerKWh, true),
                label: '$/kWh stored'
            },
            {
                value: `$${Math.round(cs.lcos)}`,
                delta: deltaBadge(cs.lcos, bs?.lcos, true),
                label: '$/MWh LCOS'
            },
            {
                value: `<span style="font-weight:800;color:${CLASS_COLOR[cs.costClass] || '#555'};">${cs.costClass}</span>`,
                delta: '',
                label: 'ANU Class'
            }
        ];

        container.innerHTML = items.map(m => `
            <div style="background:var(--bg-section);border:1px solid var(--border-light);
                        border-radius:6px;padding:6px 4px;text-align:center;">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${m.value}</div>
                ${m.delta}
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${m.label}</div>
            </div>
        `).join('');
    },

    // ── Tornado chart ─────────────────────────────────────────────────────────

    _drawTornado() {
        const canvas = document.getElementById('sens-tornado');
        if (!canvas || !this._baseResult) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;  // 380px (matches cross-section & cost-pie canvases)
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const baseLcos   = this._baseResult.summary.lcos;
        const baseCapex  = this._baseResult.summary.totalCapexM;

        // For each param sweep −50% / +50% (others at base)
        const rows = this.PARAMS.map(p => {
            const mkMults = (mult) => {
                const m = { energy: 1, head: 1, tunnel: 1, power: 1, waterRock: 1 };
                m[p.key] = mult;
                return m;
            };
            const rLow  = this._runModel(this._getAdjustedParams(mkMults(0.5))).summary;
            const rHigh = this._runModel(this._getAdjustedParams(mkMults(1.5))).summary;
            return {
                label:     p.label,
                lcosLow:   rLow.lcos,
                lcosHigh:  rHigh.lcos,
                capexLow:  rLow.totalCapexM,
                capexHigh: rHigh.totalCapexM,
                spread:    Math.abs(rHigh.lcos - rLow.lcos)
            };
        });

        // Sort descending by LCOS spread (largest impact first)
        rows.sort((a, b) => b.spread - a.spread);

        // Layout
        const labelW = 96;
        const padR   = 44;
        const padT   = 6;
        const padB   = 28;
        const plotW  = W - labelW - padR;
        const plotH  = H - padT - padB;
        const rowH   = plotH / rows.length;

        // X-axis domain: cover all LCOS values plus 5% margin
        const allLcos = rows.flatMap(r => [r.lcosLow, r.lcosHigh]).concat(baseLcos);
        const xMin = Math.min(...allLcos) * 0.95;
        const xMax = Math.max(...allLcos) * 1.05;
        const xRange = xMax - xMin;

        const toX = v => labelW + ((v - xMin) / xRange) * plotW;
        const baseX = toX(baseLcos);

        // Background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, W, H);

        // Subtle vertical grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        const nGridLines = 4;
        for (let i = 0; i <= nGridLines; i++) {
            const gx = labelW + (i / nGridLines) * plotW;
            ctx.beginPath();
            ctx.moveTo(gx, padT);
            ctx.lineTo(gx, H - padB);
            ctx.stroke();
        }

        // Draw bars
        rows.forEach((row, i) => {
            const midY  = padT + i * rowH + rowH * 0.5;
            const barH  = Math.max(10, rowH * 0.52);

            const xL = toX(row.lcosLow);
            const xH = toX(row.lcosHigh);
            const xLeft  = Math.min(xL, xH, baseX);
            const xRight = Math.max(xL, xH, baseX);

            // Left half (−50% side)
            const leftColor  = row.lcosLow <= row.lcosHigh ? '#1e8c3a' : '#e74c3c';
            const rightColor = row.lcosLow <= row.lcosHigh ? '#e74c3c' : '#1e8c3a';

            if (xL < baseX) {
                ctx.fillStyle = leftColor + 'bb';
                ctx.fillRect(xL, midY - barH / 2, baseX - xL, barH);
            }
            if (xH > baseX) {
                ctx.fillStyle = rightColor + 'bb';
                ctx.fillRect(baseX, midY - barH / 2, xH - baseX, barH);
            }

            // Bar outline
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 0.75;
            ctx.strokeRect(xLeft, midY - barH / 2, xRight - xLeft, barH);

            // Parameter label (left column)
            ctx.fillStyle = '#333';
            ctx.font = '10px -apple-system,BlinkMacSystemFont,sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(row.label, labelW - 5, midY);

            // End-point value labels
            ctx.font = '9px -apple-system,BlinkMacSystemFont,sans-serif';
            ctx.fillStyle = '#555';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const topY = midY - barH / 2 - 1;
            ctx.fillText(`$${row.lcosLow.toFixed(0)}`, xL, topY);
            if (Math.abs(xH - xL) > 24)  // skip if bars are too close
                ctx.fillText(`$${row.lcosHigh.toFixed(0)}`, xH, topY);
        });

        // Base line
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(baseX, padT);
        ctx.lineTo(baseX, H - padB + 4);
        ctx.stroke();
        ctx.setLineDash([]);

        // X-axis label + base marker
        ctx.fillStyle = '#444';
        ctx.font = '9px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`Base $${baseLcos.toFixed(0)}`, baseX, H - padB + 14);
        ctx.fillStyle = '#888';
        ctx.fillText('LCOS  $/MWh', W / 2, H - 4);

        // Legend strip (green = cost reduces, red = cost rises)
        const lgX = W - padR + 4;
        const lgY = padT + 4;
        ctx.font = '8px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1e8c3a';
        ctx.fillRect(lgX, lgY, 8, 8);
        ctx.fillStyle = '#555';
        ctx.fillText('↓', lgX + 10, lgY + 4);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(lgX, lgY + 12, 8, 8);
        ctx.fillStyle = '#555';
        ctx.fillText('↑', lgX + 10, lgY + 16);
    },

    _reset() {
        this._mults = { energy: 1, head: 1, tunnel: 1, power: 1, waterRock: 1 };
        this.PARAMS.forEach(p => {
            const slider = document.getElementById(`sens-slider-${p.key}`);
            if (slider) { slider.value = 50; this._updateSliderLabel(p.key); }
        });
        this._recalcAndRender();
    }
};
