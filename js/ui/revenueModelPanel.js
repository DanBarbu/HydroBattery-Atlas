/**
 * Revenue Model Panel
 *
 * UI controls for the full PHES revenue model:
 *   • Energy arbitrage  (sell price, buy price, cycles/year)
 *   • Ancillary services premium  (FCR / aFRR / FCAS)
 *   • Capacity payments  ($/kW/year — availability fee)
 *
 * Market profile presets let users quickly switch between well-calibrated
 * scenarios (Conservative → Full Service), with a Custom mode for manual tuning.
 *
 * On apply, the module writes values into HB.Cost.financials and
 * HB.Cost.scaleUp, then triggers a full recalculate + scale-up refresh.
 */
HB.UI = HB.UI || {};

HB.UI.revenueModel = {

    // ---- Market profile presets ----------------------------------------
    PRESETS: {
        conservative: {
            label:       'Conservative (Arbitrage Only)',
            description: 'Pure price-spread arbitrage; no capacity or ancillary revenue.',
            sellPrice:    47,
            buyPrice:     19,
            cycles:       240,
            capPayment:   0,
            ancillary:    0,
        },
        eu_balanced: {
            label:       'EU Grid Services (Balanced)',
            description: 'IRENA 2023 / ENTSO-E central case for EU grid-connected PHES.',
            sellPrice:    90,
            buyPrice:     42,
            cycles:       300,
            capPayment:   50,
            ancillary:    40,
        },
        romania: {
            label:       'Romania Market',
            description: 'OPCOM day-ahead + Transelectrica balancing + emerging capacity mechanism (ANRE).',
            sellPrice:    90,
            buyPrice:     42,
            cycles:       300,
            capPayment:   50,
            ancillary:    35,
        },
        optimistic: {
            label:       'Full Service (Optimistic)',
            description: 'Best-case: high peak prices, full ancillary stack, mature capacity market.',
            sellPrice:   120,
            buyPrice:     45,
            cycles:       330,
            capPayment:   80,
            ancillary:    60,
        },
        custom: {
            label:       'Custom',
            description: 'Manually configure all revenue parameters.',
            sellPrice:    90,
            buyPrice:     42,
            cycles:       300,
            capPayment:   50,
            ancillary:    40,
        },
    },

    // ---- State -------------------------------------------------------------
    _activePreset: 'eu_balanced',

    // ---- Init --------------------------------------------------------------
    init() {
        // Collapse / expand toggle
        const toggle = document.getElementById('toggle-rev-model');
        if (toggle) toggle.addEventListener('click', () => {
            const body = document.getElementById('rev-model-body');
            const collapsed = body.classList.toggle('hidden');
            toggle.textContent = collapsed ? '+' : '−';
        });

        // Populate preset dropdown
        this._buildPresetOptions();

        // Preset selector change
        const sel = document.getElementById('rev-preset');
        if (sel) sel.addEventListener('change', () => this._onPresetChange(sel.value));

        // Input changes → update bar live
        ['rev-sell-price', 'rev-buy-price', 'rev-cycles', 'rev-cap-payment', 'rev-ancillary'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                this._markCustom();
                this._updateBar();
            });
        });

        // Buttons
        const applyBtn  = document.getElementById('btn-rev-apply');
        const resetBtn  = document.getElementById('btn-rev-reset');
        if (applyBtn)  applyBtn.addEventListener('click',  () => this._apply());
        if (resetBtn)  resetBtn.addEventListener('click',  () => this._resetToPreset('eu_balanced'));

        // Seed with EU balanced default
        this._loadPreset('eu_balanced');
    },

    // ---- Build preset <option> elements ------------------------------------
    _buildPresetOptions() {
        const sel = document.getElementById('rev-preset');
        if (!sel) return;
        Object.entries(this.PRESETS).forEach(([key, p]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = p.label;
            sel.appendChild(opt);
        });
    },

    // ---- Preset selected ---------------------------------------------------
    _onPresetChange(key) {
        if (key === 'custom') {
            this._activePreset = 'custom';
            this._updateDescription('Manually configure all revenue parameters.');
            return;
        }
        this._loadPreset(key);
    },

    _loadPreset(key) {
        const p = this.PRESETS[key];
        if (!p) return;
        this._activePreset = key;

        this._setVal('rev-sell-price', p.sellPrice);
        this._setVal('rev-buy-price',  p.buyPrice);
        this._setVal('rev-cycles',     p.cycles);
        this._setVal('rev-cap-payment',p.capPayment);
        this._setVal('rev-ancillary',  p.ancillary);

        const sel = document.getElementById('rev-preset');
        if (sel) sel.value = key;

        this._updateDescription(p.description);
        this._updateBar();
    },

    _resetToPreset(key) {
        this._loadPreset(key);
        this._apply(/* silent */ false);
    },

    // ---- Mark inputs as "custom" when user edits manually -----------------
    _markCustom() {
        const sel = document.getElementById('rev-preset');
        if (sel) sel.value = 'custom';
        this._activePreset = 'custom';
        this._updateDescription(this.PRESETS.custom.description);
    },

    // ---- Revenue composition bar ------------------------------------------
    _updateBar() {
        const sellPrice  = this._getNum('rev-sell-price',  90);
        const buyPrice   = this._getNum('rev-buy-price',   42);
        const cycles     = this._getNum('rev-cycles',      300);
        const capPayment = this._getNum('rev-cap-payment', 50);
        const ancillary  = this._getNum('rev-ancillary',   40) / 100;

        // Effective $/MWh from each stream (gross, before pumping cost)
        const annualMWhPerMW = 8 * cycles;   // 8h storage × cycles — representative basis
        const capPerMWh      = capPayment > 0 ? (capPayment * 1000 / annualMWhPerMW) : 0;
        const ancPerMWh      = sellPrice * ancillary;
        const totalPerMWh    = Math.max(1, sellPrice + ancPerMWh + capPerMWh);

        const energyPct    = Math.round(sellPrice  / totalPerMWh * 100);
        const ancillaryPct = Math.round(ancPerMWh  / totalPerMWh * 100);
        const capacityPct  = 100 - energyPct - ancillaryPct;

        // Net spread highlight
        const spread = sellPrice - buyPrice;

        // Update bar segments
        this._setBarWidth('rev-bar-energy',    energyPct);
        this._setBarWidth('rev-bar-ancillary', ancillaryPct);
        this._setBarWidth('rev-bar-capacity',  capacityPct);

        // Update labels
        this._setText('rev-pct-energy',    `${energyPct}%`);
        this._setText('rev-pct-ancillary', `${ancillaryPct}%`);
        this._setText('rev-pct-capacity',  `${capacityPct}%`);

        // Effective revenue label
        const effectivePerMWh = Math.round(totalPerMWh);
        const spreadTxt = `Arbitrage spread: $${spread}/MWh · Effective: $${effectivePerMWh}/MWh gross`;
        this._setText('rev-spread-info', spreadTxt);
    },

    _setBarWidth(id, pct) {
        const el = document.getElementById(id);
        if (el) el.style.width = Math.max(0, pct) + '%';
    },

    // ---- Apply to cost engine and refresh ----------------------------------
    _apply(/* unused */ _) {
        const fin = HB.Cost.financials;

        // Write new values into financials
        fin.energySellPrice         = this._getNum('rev-sell-price',  fin.energySellPrice  || 90);
        fin.energyBuyPrice          = this._getNum('rev-buy-price',   fin.energyBuyPrice   || 42);
        fin.cyclesPerYear           = this._getNum('rev-cycles',       fin.cyclesPerYear    || 300);
        fin.capacityPaymentPerKW    = this._getNum('rev-cap-payment',  fin.capacityPaymentPerKW !== undefined ? fin.capacityPaymentPerKW : 50);
        fin.ancillaryRevenuePremium = this._getNum('rev-ancillary',    (fin.ancillaryRevenuePremium !== undefined ? fin.ancillaryRevenuePremium : 0.40) * 100) / 100;

        // Keep legacy alias in sync
        fin.energyPurchasePrice = fin.energySellPrice;

        // Trigger full recalculate via financialParams panel if available
        if (HB.UI.financialParams && HB.UI.financialParams._recalculate) {
            HB.UI.financialParams._recalculate();
        } else if (HB.UI.scaleUp && HB.UI.scaleUp.refresh) {
            HB.UI.scaleUp.refresh();
        }

        // Flash apply button
        const btn = document.getElementById('btn-rev-apply');
        if (btn) {
            const orig = btn.textContent;
            btn.textContent = 'Applied ✓';
            btn.style.background = '#2e7d32';
            setTimeout(() => {
                btn.textContent = orig;
                btn.style.background = '';
            }, 1400);
        }
    },

    // ---- Sync FROM financials (called when site changes) -------------------
    syncFromFinancials() {
        const fin = HB.Cost.financials;
        if (fin.energySellPrice)                    this._setVal('rev-sell-price',  fin.energySellPrice);
        if (fin.energyBuyPrice)                     this._setVal('rev-buy-price',   fin.energyBuyPrice);
        if (fin.cyclesPerYear)                      this._setVal('rev-cycles',      fin.cyclesPerYear);
        if (fin.capacityPaymentPerKW !== undefined) this._setVal('rev-cap-payment', fin.capacityPaymentPerKW);
        if (fin.ancillaryRevenuePremium !== undefined) this._setVal('rev-ancillary', Math.round(fin.ancillaryRevenuePremium * 100));
        this._updateBar();
    },

    // ---- Description text --------------------------------------------------
    _updateDescription(txt) {
        const el = document.getElementById('rev-preset-desc');
        if (el) el.textContent = txt;
    },

    // ---- Helpers -----------------------------------------------------------
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
    _setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    },
};
