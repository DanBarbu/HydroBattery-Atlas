/**
 * Scale-Up Engine — Multi-tier PHES capital cost and financial analysis.
 *
 * Given a lake-pair geometry (head, separation, water:rock ratio, country),
 * calculates all capital cost components and extended financial metrics for
 * six standard storage capacity tiers:
 *   2 GWh | 5 GWh | 10 GWh | 20 GWh | 50 GWh | 150 GWh
 *
 * Scaling logic:
 *   - Head, separation, and geology stay fixed (same lake pair).
 *   - Water volume and power rating scale with the target energy tier.
 *   - Economy-of-scale is captured by ANU formulas (powerhouse P^0.75,
 *     tunnel sublinear with H, dam linear with volume).
 *   - EPC contingency (10%) applied on top of ANU base costs.
 *   - Electrical and civil/environment estimated as fixed fractions of
 *     base CAPEX, consistent with the detailed sub-model proportions.
 *
 * Financial model:
 *   - Revenue: electricity sold at market price, electricity purchased at
 *     BUY_PRICE_FRACTION × sell price (typical pumped-hydro arbitrage spread).
 *   - OPEX: OPEX_FRACTION of total CAPEX (incl. EPC contingency) per year.
 *   - NPV, IRR, ROI, payback computed for 30, 40, and 50-year project lifetimes
 *     at discount rates of 5%, 8%, and 10%.
 *
 * Depends on: HB.Cost.financials, HB.Cost.engine (anuModel)
 */
HB.Cost = HB.Cost || {};

HB.Cost.scaleUp = {

    /** Standard storage capacity tiers (GWh). */
    TIERS: [2, 5, 10, 20, 50, 150],

    /** Default storage duration (hours at full power). ANU standard = 18 h. */
    DEFAULT_STORAGE_HOURS: 18,

    /**
     * OPEX as fraction of total CAPEX per year.
     * Typical PHES range: 1–2%. Using 1.5% as midpoint.
     */
    OPEX_FRACTION: 0.015,

    /**
     * Energy purchase price as fraction of selling price.
     * Represents the arbitrage spread: buy cheap off-peak, sell peak.
     * 0.4 → buy at 40% of sell price, consistent with 2–3× peak/off-peak ratio.
     */
    BUY_PRICE_FRACTION: 0.4,

    /**
     * EPC (Engineering, Procurement & Construction) contingency fraction.
     * Applied on top of ANU base costs to arrive at total installed cost.
     */
    EPC_CONTINGENCY: 0.10,

    /**
     * Electrical infrastructure as fraction of powerhouse cost.
     * Based on proportions from the detailed electricalCost.js sub-model.
     */
    ELECTRICAL_FRACTION: 0.15,

    /**
     * Civil works + environmental mitigation as fraction of base CAPEX.
     * Based on proportions from civilCost.js + environmentalCost.js sub-models.
     */
    CIVIL_ENV_FRACTION: 0.12,

    // -----------------------------------------------------------------------
    // PUBLIC API
    // -----------------------------------------------------------------------

    /**
     * Calculate scale-up scenarios for a lake pair across all storage tiers.
     *
     * @param {Object}   siteParams
     * @param {number}   siteParams.headM          - Gross head height (m)
     * @param {number}   siteParams.separationM    - Tunnel / penstock length (m)
     * @param {string}   [siteParams.country]      - Country for region cost factor
     * @param {number}   [siteParams.waterRockRatio] - Water:rock ratio (default 10)
     * @param {number}   [siteParams.storageHours] - Storage duration in hours (default 18)
     * @param {number[]} [tiers]                   - GWh tiers to compute (default: TIERS)
     * @returns {Object[]} Array of tier result objects, one per tier.
     */
    calculate(siteParams, tiers) {
        const activeTiers = (tiers && tiers.length) ? tiers : this.TIERS;
        return activeTiers.map(gwh => this._calcTier(gwh, siteParams));
    },

    // -----------------------------------------------------------------------
    // PRIVATE — PER-TIER CALCULATION
    // -----------------------------------------------------------------------

    _calcTier(energyGWh, site) {
        const fin   = HB.Cost.financials;
        const hours = site.storageHours || this.DEFAULT_STORAGE_HOURS;
        const powerMW = energyGWh * 1000 / hours;

        // ---- ANU base model (reservoirs + tunnel + powerhouse) ----
        const anu = HB.Cost.engine.anuModel({
            headM:          site.headM,
            separationM:    site.separationM,
            energyGWh:      energyGWh,
            powerMW:        powerMW,
            waterRockRatio: site.waterRockRatio || 10,
            country:        site.country || 'default'
        });

        const baseCapexM = anu.summary.totalCapexM;  // Reservoirs + Tunnel + Powerhouse

        // ---- Additional capital cost components ----
        // Electrical infrastructure (transformers, switchgear, grid connection, SCADA)
        const electricalM = anu.components.powerhouse_M * this.ELECTRICAL_FRACTION;

        // Civil works + access roads + environmental mitigation + permitting
        const civilEnvM = baseCapexM * this.CIVIL_ENV_FRACTION;

        // Sub-total before contingency
        const subTotalM = baseCapexM + electricalM + civilEnvM;

        // EPC contingency (engineering, procurement management + risk buffer)
        const epcM = subTotalM * this.EPC_CONTINGENCY;

        // Total installed CAPEX
        const totalCapexM = subTotalM + epcM;

        // ---- Unit cost metrics ----
        const capexPerKW  = Math.round(totalCapexM * 1e6 / (powerMW * 1000));
        const capexPerKWh = Math.round(totalCapexM * 1e6 / (energyGWh * 1e6) * 10) / 10;

        // ---- Annual OPEX ----
        const annualOpexM = Math.round(totalCapexM * this.OPEX_FRACTION * 1000) / 1000;

        // ---- Annual energy flows (from ANU model) ----
        const annualSoldMWh      = anu.financials.annualSoldTWh      * 1e6;
        const annualPurchasedMWh = anu.financials.annualPurchasedTWh * 1e6;

        // ---- Revenue model ----
        const sellPrice   = fin.energyPurchasePrice;          // $/MWh — selling price
        const buyPrice    = sellPrice * this.BUY_PRICE_FRACTION; // $/MWh — pumping cost
        const grossRevM   = (annualSoldMWh * sellPrice)      / 1e6;
        const energyCostM = (annualPurchasedMWh * buyPrice)  / 1e6;
        const netRevM     = grossRevM - energyCostM - annualOpexM;  // after opex

        // ---- Extended financial metrics by project lifetime ----
        const lifetimes = {};
        [30, 40, 50].forEach(yr => {
            lifetimes[`yr${yr}`] = this._extendedFinancials(
                totalCapexM, netRevM, annualOpexM, grossRevM, yr
            );
        });

        return {
            energyGWh,
            powerMW:      Math.round(powerMW * 10) / 10,
            storageHours: hours,

            // Full ANU model result (engineering + LCOS)
            anu,

            // CAPEX component breakdown
            capex: {
                dam_M:           _r2(anu.components.reservoirs_M),
                tunnel_M:        _r2(anu.components.tunnel_M),
                powerhouse_M:    _r2(anu.components.powerhouse_M),
                electrical_M:    _r2(electricalM),
                civil_env_M:     _r2(civilEnvM),
                epc_M:           _r2(epcM),
                total_M:         _r2(totalCapexM),
                per_kW:          capexPerKW,
                per_kWh:         capexPerKWh
            },

            // Annual OPEX
            opex: {
                annual_M:    annualOpexM,
                pct_capex:   Math.round(this.OPEX_FRACTION * 1000) / 10  // e.g. 1.5
            },

            // LCOS from ANU model ($/MWh)
            lcos: anu.lcosBreakdown,

            // Revenue summary ($M/yr)
            revenue: {
                gross_M:      _r2(grossRevM),
                energyCost_M: _r2(energyCostM),
                net_M:        _r2(netRevM)
            },

            // Financial metrics per lifetime: { yr30, yr40, yr50 }
            lifetimes
        };
    },

    // -----------------------------------------------------------------------
    // PRIVATE — FINANCIAL MATHS
    // -----------------------------------------------------------------------

    /**
     * Extended financial metrics for a given project lifetime.
     *
     * @param {number} capexM       - Total CAPEX ($M)
     * @param {number} netRevM      - Net annual revenue after OPEX ($M/yr)
     * @param {number} annualOpexM  - Annual OPEX ($M/yr) — for reference
     * @param {number} grossRevM    - Gross annual revenue ($M/yr) — for ROI
     * @param {number} years        - Project lifetime (30 / 40 / 50)
     * @returns {Object}
     */
    _extendedFinancials(capexM, netRevM, annualOpexM, grossRevM, years) {
        const npv5  = this._npv(capexM, netRevM, 0.05, years);
        const npv8  = this._npv(capexM, netRevM, 0.08, years);
        const npv10 = this._npv(capexM, netRevM, 0.10, years);
        const irr   = this._irr(capexM, netRevM, years);

        // Simple (undiscounted) ROI over project life
        const roi = netRevM > 0
            ? Math.round((netRevM * years - capexM) / capexM * 1000) / 10
            : null;

        // Simple payback period (years)
        const payback = netRevM > 0
            ? Math.round(capexM / netRevM * 10) / 10
            : null;

        return {
            npv5_M:     _r1(npv5),
            npv8_M:     _r1(npv8),
            npv10_M:    _r1(npv10),
            irr_pct:    irr !== null ? Math.round(irr * 100) / 100 : null,
            roi_pct:    roi,
            payback_yr: payback
        };
    },

    /**
     * Net Present Value of uniform annual cash flows.
     *   NPV = annualRev × [(1 − (1+r)^−n) / r] − CAPEX
     *
     * @param {number} capexM    - Initial investment ($M, negative cash flow at t=0)
     * @param {number} annualM   - Uniform annual net revenue ($M)
     * @param {number} r         - Discount rate (decimal, e.g. 0.08)
     * @param {number} n         - Project lifetime (years)
     * @returns {number} NPV ($M)
     */
    _npv(capexM, annualM, r, n) {
        const af = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;   // annuity factor
        return annualM * af - capexM;
    },

    /**
     * Internal Rate of Return — bisection method.
     * Finds r such that NPV(r) = 0.
     *
     * @param {number} capexM  - Initial investment ($M)
     * @param {number} annualM - Annual net revenue ($M)
     * @param {number} n       - Project lifetime (years)
     * @returns {number|null}  IRR as percentage (e.g. 8.3 for 8.3%), or null if
     *                         project never pays back within the given lifetime.
     */
    _irr(capexM, annualM, n) {
        if (annualM <= 0) return null;

        // Quick feasibility: if undiscounted total revenue < CAPEX, IRR < 0
        // We still solve; the result will be negative.
        let lo = -0.99, hi = 50.0;   // search between -99% and +5000%

        // Verify sign change exists in [lo, hi]
        const npvLo = this._npv(capexM, annualM, lo, n);
        const npvHi = this._npv(capexM, annualM, hi, n);
        if (npvLo * npvHi > 0) {
            // No sign change — IRR outside search range; return null or bound
            return npvLo > 0 ? hi * 100 : lo * 100;
        }

        // Bisection — 200 iterations gives < 0.00001% precision
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            const npv = this._npv(capexM, annualM, mid, n);
            if (Math.abs(npv) < 1e-6 * capexM) return mid * 100;
            if (npv > 0) lo = mid;
            else         hi = mid;
        }
        return ((lo + hi) / 2) * 100;
    }
};

// ---- Rounding helpers (local to this module) ----
function _r1(x) { return Math.round(x * 10) / 10; }
function _r2(x) { return Math.round(x * 100) / 100; }
