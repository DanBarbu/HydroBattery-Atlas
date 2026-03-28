/**
 * Financial Parameters Panel - Interactive controls for adjusting
 * ANU cost model parameters and recalculating in real-time.
 */
HB.UI = HB.UI || {};

HB.UI.financialParams = {
    _currentSite: null,

    onSiteShown(site) {
        this._currentSite = site;
        this._syncFromFinancials();
    },

    init() {
        // Wire up recalculate button
        const btn = document.getElementById('btn-recalculate');
        if (btn) btn.addEventListener('click', () => this._recalculate());

        // Wire up reset button
        const resetBtn = document.getElementById('btn-reset-params');
        if (resetBtn) resetBtn.addEventListener('click', () => this._resetDefaults());

        // Toggle panel visibility
        const toggle = document.getElementById('toggle-fin-params');
        if (toggle) toggle.addEventListener('click', () => {
            const body = document.getElementById('fin-params-body');
            body.classList.toggle('hidden');
            toggle.textContent = body.classList.contains('hidden') ? '+' : '\u2212';
        });

        this._syncFromFinancials();
    },

    _syncFromFinancials() {
        const fin = HB.Cost.financials;
        this._setVal('fp-cycles', fin.cyclesPerYear);
        this._setVal('fp-energy-price', fin.energyPurchasePrice);
        this._setVal('fp-equity-return', (fin.equityReturn * 100).toFixed(1));
        this._setVal('fp-bank-rate', (fin.bankRate * 100).toFixed(1));
        this._setVal('fp-equity-frac', (fin.equityFraction * 100).toFixed(0));
        this._setVal('fp-inflation', (fin.inflationRate * 100).toFixed(1));
        this._setVal('fp-lifetime', fin.systemLifetime);
        this._setVal('fp-dam-cost', fin.damCostPerM3);
        this._setVal('fp-pump-eff', (fin.pumpEfficiency * 100).toFixed(0));
        this._setVal('fp-gen-eff', (fin.genEfficiency * 100).toFixed(0));
        this._setVal('fp-lithium-cost', fin.lithiumBatteryCostPerKWh);
        this._setVal('fp-custom-gwh', '');
    },

    _setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    },

    _getNum(id, fallback) {
        const el = document.getElementById(id);
        if (!el || el.value === '') return fallback;
        const v = parseFloat(el.value);
        return isNaN(v) ? fallback : v;
    },

    _applyToFinancials() {
        const fin = HB.Cost.financials;
        fin.cyclesPerYear = this._getNum('fp-cycles', fin.cyclesPerYear);
        fin.energyPurchasePrice = this._getNum('fp-energy-price', fin.energyPurchasePrice);
        fin.equityReturn = this._getNum('fp-equity-return', fin.equityReturn * 100) / 100;
        fin.bankRate = this._getNum('fp-bank-rate', fin.bankRate * 100) / 100;
        fin.equityFraction = this._getNum('fp-equity-frac', fin.equityFraction * 100) / 100;
        fin.debtFraction = 1 - fin.equityFraction;
        fin.inflationRate = this._getNum('fp-inflation', fin.inflationRate * 100) / 100;
        fin.systemLifetime = this._getNum('fp-lifetime', fin.systemLifetime);
        fin.damCostPerM3 = this._getNum('fp-dam-cost', fin.damCostPerM3);
        fin.pumpEfficiency = this._getNum('fp-pump-eff', fin.pumpEfficiency * 100) / 100;
        fin.genEfficiency = this._getNum('fp-gen-eff', fin.genEfficiency * 100) / 100;
        fin.lithiumBatteryCostPerKWh = this._getNum('fp-lithium-cost', fin.lithiumBatteryCostPerKWh);
    },

    _resetDefaults() {
        const fin = HB.Cost.financials;
        fin.equityFraction = 0.3; fin.debtFraction = 0.7;
        fin.equityReturn = 0.10; fin.bankRate = 0.05;
        fin.inflationRate = 0.015; fin.systemLifetime = 60;
        fin.cyclesPerYear = 240; fin.energyPurchasePrice = 47;
        fin.pumpEfficiency = 0.90; fin.genEfficiency = 0.90;
        fin.damCostPerM3 = 168; fin.lithiumBatteryCostPerKWh = 447;
        this._syncFromFinancials();
        this._recalculate();
    },

    _recalculate() {
        this._applyToFinancials();

        const site = this._currentSite;
        if (!site) return;

        // Determine base parameters for ANU model
        const headM = site.headHeight || site.head_m || 200;
        const sepM = site.tunnelLength || ((site.separation_km || site.anu_separation_km || 5) * 1000);
        const baseGWh = (site.energyKWh ? site.energyKWh / 1e6 : null)
                      || site.energy_gwh || (site.storage_mwh ? site.storage_mwh / 1000 : 1);
        const customGWh = this._getNum('fp-custom-gwh', null);
        const energyGWh = (customGWh && customGWh > 0) ? customGWh : baseGWh;

        const params = {
            headM: headM,
            separationM: sepM,
            energyGWh: energyGWh,
            powerMW: site.powerKW ? site.powerKW / 1000 : (site.capacity_mw || undefined),
            waterRockRatio: site.water_rock_ratio || site.anu_water_rock_ratio || 10,
            volumeGL: (customGWh && customGWh > 0) ? undefined : (site.volume_gl || site.anu_volume_gl || undefined),
            damVolumeGL: (customGWh && customGWh > 0) ? undefined : (site.dam_volume_mm3 || site.anu_dam_volume_mm3 || undefined),
            reservoirAreaHa: (customGWh && customGWh > 0) ? undefined : (site.reservoir_area_ha || site.anu_reservoir_area_ha || undefined),
            country: site.country || 'default'
        };

        // If custom GWh, recalculate power proportionally
        if (customGWh && customGWh > 0 && customGWh !== baseGWh) {
            const basePower = params.powerMW || (baseGWh * 1000 / 18);
            params.powerMW = basePower * (customGWh / baseGWh);
        }

        const anuResult = HB.Cost.engine.anuModel(params);

        // Update ANU cost display and key metrics
        if (anuResult) {
            HB.UI.costBreakdown.renderAnu(anuResult);
            site.anuResult = anuResult;
            HB.UI.siteDetail._renderMetrics(site);
        }

        // Refresh scale-up panel with updated financial parameters
        if (HB.UI.scaleUp) HB.UI.scaleUp.refresh();

        // Flash the recalculate button to confirm
        const btn = document.getElementById('btn-recalculate');
        if (btn) {
            btn.textContent = 'Updated!';
            btn.style.background = '#2e7d32';
            setTimeout(() => {
                btn.textContent = 'Recalculate';
                btn.style.background = '';
            }, 1200);
        }
    }
};
