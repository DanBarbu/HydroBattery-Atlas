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

    /** FPV solar CAPEX ($M per MW installed). Utility-scale floating PV. */
    SOLAR_CAPEX_PER_MW: 1.10,

    /**
     * Turbine-as-pump minimal retrofit cost model ($/kW of pumping capacity).
     *
     * Source: "Retrofitting Existing Hydropower Turbines as Pumps" research essay.
     * Scope: siphon-based reverse-rotation, no runner replacement, no civil excavation.
     * Total range: USD 80–350/kW (essay central finding, §5 & §11).
     * Central estimate: USD 215/kW (~$0.215M/MW) = 8–25% of original turbine value.
     *
     * Component breakdown ($/kW, based on essay §5 Table 4 & §10 recommendations):
     *   VFD (variable-frequency drive + transformer, filters, cooling)  40–150 $/kW
     *   Siphon piping + vacuum priming system                          15–60  $/kW
     *   Guide vane adaptation / lock mechanism                          5–30  $/kW
     *   Motor-drive upgrade (generator → motor winding, excitation)    10–50  $/kW
     *   Electrical controls, protection, SCADA integration              8–40  $/kW
     *   Commissioning, testing, integration                             2–20  $/kW
     *   ---
     *   Sub-total (siphon-only):                                       80–350 $/kW
     *   Optional booster pump (draft tube, +5–8% η recovery):         +20–80 $/kW
     *
     * Round-trip efficiency: 49–65% without booster, 62–70% with booster + VSD.
     * Compared to 75–87% for purpose-built RPTs (NREL/DOE central: 80%).
     */
    RETROFIT_COST_PER_KW: {
        vfd:           95,    // VFD + transformer, filters, cooling (central of 40–150)
        siphon:        38,    // siphon piping + vacuum priming (central of 15–60)
        guideVane:     18,    // guide vane adaptation/lock (central of 5–30)
        motorDrive:    30,    // motor-drive upgrade (central of 10–50)
        electrical:    24,    // controls, protection, SCADA (central of 8–40)
        commissioning: 10,    // testing, integration (central of 2–20)
    },

    /** Optional booster pump cost ($/kW). Set to 0 to disable. */
    RETROFIT_BOOSTER_PER_KW: 0,

    /** Total retrofit cost ($/kW) — computed from components + booster. */
    get RETROFIT_PER_KW() {
        const c = this.RETROFIT_COST_PER_KW;
        return c.vfd + c.siphon + c.guideVane + c.motorDrive
             + c.electrical + c.commissioning + this.RETROFIT_BOOSTER_PER_KW;
    },

    /** Retrofit cost as $M per MW (for backward compatibility). */
    get RETROFIT_PER_MW() {
        return this.RETROFIT_PER_KW / 1000;
    },

    /**
     * Pump-mode hydraulic efficiency for turbine-as-pump retrofit.
     * Essay §6 Table 5: Francis Ns 100–200 → 72–80% pump η at BEP.
     * Central estimate 75% for medium-Ns Francis (best candidate class).
     * With guide vane optimisation: +3–7 pp (essay §6.2).
     * With variable-speed (VFD): +2–4 pp.
     */
    PUMP_MODE_EFFICIENCY: 0.60,   // existing turbine reversed into pump mode

    /**
     * Generation-mode efficiency (standard turbine operation, unchanged).
     * Essay §6 Table 5: 88–93%, typically 90%+ for well-maintained Francis.
     */
    GEN_MODE_EFFICIENCY: 0.90,

    /** Round-trip efficiency = pump η × gen η (e.g. 0.60 × 0.90 = 0.54). */
    get RETROFIT_RTE() {
        return this.PUMP_MODE_EFFICIENCY * this.GEN_MODE_EFFICIENCY;
    },

    /** Default solar capacity factor for FPV (region-agnostic). */
    SOLAR_CF: 0.20,

    /**
     * Average peak sun hours per day used to compute Phase 1 water volume.
     * Phase 1 water volume = volume pumped uphill by FPV over one average solar day.
     * 5 h/day is the global average for utility-scale FPV sites.
     */
    SOLAR_PEAK_HOURS: 5,

    /** Phase 1 default storage capacity (GWh). Initial integration tier. */
    PHASE1_STORAGE_GWH: 6,

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
        const results = [];
        activeTiers.forEach(t => {
            if (t === 'p0')      results.push(this._calcPhase0(siteParams));
            else if (t === 'p1') results.push(this._calcPhase1(siteParams));
            else                 results.push(this._calcTier(t, siteParams));
        });
        return results;
    },

    // -----------------------------------------------------------------------
    // PHASE 0 — FPV + EXISTING HYDRO, NO STORAGE
    // Non-integrated solar addition. Revenue from direct solar sales only.
    // CAPEX = solar installation; existing hydro is sunk cost.
    // -----------------------------------------------------------------------

    _calcPhase0(site) {
        const fin   = HB.Cost.financials;
        const hours = site.storageHours || this.DEFAULT_STORAGE_HOURS;

        // Size solar relative to 2 GWh tier power rating (~2.5×)
        const refPowerMW = 2000 / hours;
        const solarMW    = Math.round(refPowerMW * 2.5);
        const cf         = this.SOLAR_CF;

        // Firm 24/7 output: solar average × ~0.44 (no storage to shift peaks)
        const firmMW = Math.round(solarMW * cf * 0.44);

        // CAPEX: solar + grid connection + EPC contingency
        const solarCapexM = solarMW * this.SOLAR_CAPEX_PER_MW;
        const electricalM = solarCapexM * 0.08;
        const subTotalM   = solarCapexM + electricalM;
        const epcM        = subTotalM * this.EPC_CONTINGENCY;
        const totalCapexM = subTotalM + epcM;

        // Revenue: sell solar at market, ~70 % utilisation (curtailment w/o storage)
        const annualGenMWh = solarMW * cf * 8760 * 0.70;
        const sellPrice    = fin.energyPurchasePrice;
        const grossRevM    = (annualGenMWh * sellPrice) / 1e6;
        const annualOpexM  = _r2(totalCapexM * 0.01);        // 1 % solar O&M
        const netRevM      = grossRevM - annualOpexM;

        // LCOE (25-yr amortisation + O&M)
        const lcoe = annualGenMWh > 0
            ? (totalCapexM * 1e6) / (annualGenMWh * 25)
              + (annualOpexM * 1e6) / annualGenMWh
            : 0;

        const lifetimes = {};
        [30, 40, 50].forEach(yr => {
            lifetimes[`yr${yr}`] = this._extendedFinancials(
                totalCapexM, netRevM, annualOpexM, grossRevM, yr);
        });

        return {
            isPhase: true, phase: 0,
            label: 'Phase 0',
            sublabel: 'FPV + Hydro (No Storage)',
            energyGWh:    0,
            powerMW:      firmMW,
            solarMW:      solarMW,
            firmMW:       firmMW,
            storageHours: 0,

            anu: {
                engineering: {
                    headM: site.headM, separationM: site.separationM,
                    totalWaterGL: 0, upperAreaHa: 0, waterRockRatio: 0
                },
                summary: { costClass: '\u2014' }
            },

            capex: {
                dam_M: 0, tunnel_M: 0, powerhouse_M: 0,
                solar_M:           _r2(solarCapexM),
                turbineRetrofit_M: 0,
                electrical_M:      _r2(electricalM),
                civil_env_M:       0,
                epc_M:             _r2(epcM),
                total_M:           _r2(totalCapexM),
                per_kW:  firmMW > 0 ? Math.round(totalCapexM * 1e6 / (firmMW * 1000)) : 0,
                per_kWh: null
            },

            opex: { annual_M: annualOpexM, pct_capex: 1.0 },

            lcos: {
                lostEnergy: 0, capital: 0, om: 0,
                total: _r1(lcoe), isLCOE: true
            },

            revenue: {
                gross_M:      _r2(grossRevM),
                energyCost_M: 0,
                net_M:        _r2(netRevM)
            },

            lifetimes
        };
    },

    // -----------------------------------------------------------------------
    // PHASE 1 — TURBINE RETROFIT + FPV, INITIAL STORAGE (6 GWh)
    // Retrofit existing turbines for pump-back mode, add FPV solar,
    // create first integrated PHES capacity using existing reservoirs.
    // -----------------------------------------------------------------------

    _calcPhase1(site) {
        const fin        = HB.Cost.financials;
        const headM      = site.headM > 0 ? site.headM : 200;   // guard: never divide by 0
        const hours      = site.storageHours > 0 ? site.storageHours : this.DEFAULT_STORAGE_HOURS;
        const storageGWh = this.PHASE1_STORAGE_GWH;
        const powerMW    = storageGWh * 1000 / hours;
        const existing   = site.useExistingReservoirs;  // bluefield / operational

        // Use retrofit-specific efficiencies for energy flow calculations.
        // Turbine-as-pump has lower RTE (49–65%) than purpose-built RPT (75–87%).
        const pumpEff = this.PUMP_MODE_EFFICIENCY;
        const genEff  = this.GEN_MODE_EFFICIENCY;
        const rte     = this.RETROFIT_RTE;

        // ANU model for reference costs (existing reservoirs).
        // Override pump/gen efficiencies for accurate energy flow modelling.
        const anu = HB.Cost.engine.anuModel({
            headM:                 headM,
            separationM:           site.separationM,
            energyGWh:             storageGWh,
            powerMW:               powerMW,
            waterRockRatio:        site.waterRockRatio || 10,
            country:               site.country || 'default',
            useExistingReservoirs: true
        });

        // Recompute energy flows with retrofit RTE instead of ANU default (90%×90%=81%)
        const cycles             = fin.cyclesPerYear;
        const annualPurchasedTWh = (storageGWh / pumpEff) * cycles / 1000;
        const annualSoldTWh      = (storageGWh * genEff) * cycles / 1000;

        // Solar FPV: ~2.8× rated power
        const solarMW = Math.round(powerMW * 2.8);
        const cf      = this.SOLAR_CF;

        // Firm 24/7 output with storage shifting.
        // Lower RTE reduces dispatchable output → scale firm MW by RTE ratio vs 81%.
        const rteFactor = rte / 0.81;
        const firmMW    = Math.round(powerMW * 0.30 * rteFactor);

        // ---- CAPEX (component-level turbine-as-pump retrofit) ----
        const turbineRetrofitM = _r2(powerMW * this.RETROFIT_PER_MW);
        const solarCapexM      = _r2(solarMW * this.SOLAR_CAPEX_PER_MW);
        // Existing lake pairs already have tunnels/penstocks → no tunnel cost
        const tunnelM          = existing ? 0 : anu.components.tunnel_M;
        const electricalM      = _r2((turbineRetrofitM + solarCapexM) * this.ELECTRICAL_FRACTION);
        const civilEnvM        = _r2((turbineRetrofitM + tunnelM) * this.CIVIL_ENV_FRACTION);
        const subTotalM        = turbineRetrofitM + solarCapexM + tunnelM + electricalM + civilEnvM;
        const epcM             = _r2(subTotalM * this.EPC_CONTINGENCY);
        const totalCapexM      = _r2(subTotalM + epcM);

        // ---- Retrofit cost breakdown for reporting ----
        const rc = this.RETROFIT_COST_PER_KW;
        const powerKW = powerMW * 1000;
        const retrofitBreakdown = {
            vfd_M:           _r2(rc.vfd * powerKW / 1e6),
            siphon_M:        _r2(rc.siphon * powerKW / 1e6),
            guideVane_M:     _r2(rc.guideVane * powerKW / 1e6),
            motorDrive_M:    _r2(rc.motorDrive * powerKW / 1e6),
            electrical_M:    _r2(rc.electrical * powerKW / 1e6),
            commissioning_M: _r2(rc.commissioning * powerKW / 1e6),
            booster_M:       _r2(this.RETROFIT_BOOSTER_PER_KW * powerKW / 1e6),
            total_per_kW:    this.RETROFIT_PER_KW,
            total_M:         turbineRetrofitM
        };

        // ---- Revenue: storage arbitrage + excess solar ----
        const annualSoldMWh      = annualSoldTWh * 1e6;
        const annualPurchasedMWh = annualPurchasedTWh * 1e6;
        const sellPrice          = fin.energyPurchasePrice;
        const buyPrice           = sellPrice * this.BUY_PRICE_FRACTION;

        // Excess solar not consumed by pumping → sold at 70 % utilisation
        // Note: lower pump efficiency → MORE energy needed per cycle → less excess solar
        const solarAnnualMWh = solarMW * cf * 8760;
        const excessSolarMWh = Math.max(0, solarAnnualMWh * 0.90 - annualPurchasedMWh);
        const solarRevM      = (excessSolarMWh * sellPrice * 0.70) / 1e6;

        const grossRevM   = (annualSoldMWh * sellPrice) / 1e6 + solarRevM;
        const energyCostM = (annualPurchasedMWh * buyPrice) / 1e6;
        const annualOpexM = _r2(totalCapexM * this.OPEX_FRACTION);
        const netRevM     = grossRevM - energyCostM - annualOpexM;

        // Blended LCOE
        const totalAnnualMWh = annualSoldMWh + excessSolarMWh * 0.70;
        const lcoe = totalAnnualMWh > 0
            ? (totalCapexM * 1e6) / (totalAnnualMWh * 25)
              + ((annualOpexM + energyCostM) * 1e6) / totalAnnualMWh
            : 0;

        const lifetimes = {};
        [30, 40, 50].forEach(yr => {
            lifetimes[`yr${yr}`] = this._extendedFinancials(
                totalCapexM, netRevM, annualOpexM, grossRevM, yr);
        });

        return {
            isPhase: true, phase: 1,
            label: 'Phase 1',
            sublabel: existing
                ? 'Turbine-as-Pump Retrofit + FPV'
                : 'Turbine-as-Pump + FPV (6 GWh)',
            energyGWh:    storageGWh,
            powerMW:      Math.round(powerMW * 10) / 10,
            solarMW:      solarMW,
            firmMW:       firmMW,
            storageHours: hours,

            anu: (() => {
                // Phase 1 daily pumped water volume — bounded by three physical limits:
                //
                //  V [GL] = P_pump [MW] × peakSunH [h] × pumpEff × 3600 / (9810 × H [m])
                //
                //  Constraint 1 — Solar energy (FPV):
                //    V_solar = solarMW × peakSunH × pumpEff × 3600 / (9810 × H)
                //
                //  Constraint 2 — Turbine pump capacity (existing turbines reversed):
                //    Turbines rated at powerMW; in pump mode they can absorb up to
                //    powerMW MW of electrical input from FPV (usually << solarMW).
                //    V_turbine = powerMW × peakSunH × pumpEff × 3600 / (9810 × H)
                //
                //  Constraint 3 — Pipe / penstock flow capacity:
                //    Pipe is sized for generation flow at genEff (90%), which is larger
                //    than pump flow at pumpEff (60%), so pipe is rarely the binding
                //    constraint but provides a hard physical ceiling.
                //    V_pipe = powerMW × peakSunH × 3600 / (9810 × genEff × H)
                //
                //  Effective volume = min(V_solar, V_turbine, V_pipe)
                //  Since solarMW >> powerMW, V_turbine is almost always the binding limit.
                const peakSunH  = this.SOLAR_PEAK_HOURS;
                const avgDepthM = HB.Cost.financials.avgReservoirDepth || 15;
                const k         = peakSunH * 3600 / (9810 * headM); // common factor (headM guarded above)

                const V_solar   = solarMW  * pumpEff * k;
                const V_turbine = powerMW  * pumpEff * k;          // turbine absorbs FPV up to its rated MW
                const V_pipe    = powerMW  * k / genEff;            // pipe ceiling (gen-side sizing)

                const waterGL   = Math.min(V_solar, V_turbine, V_pipe);
                anu.engineering.totalWaterGL = Math.round(waterGL * 10) / 10;
                anu.engineering.upperAreaHa  = Math.round(100 * waterGL / avgDepthM * 10) / 10;
                return anu;
            })(),

            // Retrofit-specific efficiency parameters
            efficiency: {
                pumpMode:  Math.round(pumpEff * 1000) / 10,    // e.g. 75.0%
                genMode:   Math.round(genEff * 1000) / 10,     // e.g. 90.0%
                roundTrip: Math.round(rte * 1000) / 10,        // e.g. 67.5%
                hasBooster: this.RETROFIT_BOOSTER_PER_KW > 0
            },

            capex: {
                dam_M:             0,
                tunnel_M:          _r2(tunnelM),
                powerhouse_M:      0,
                solar_M:           solarCapexM,
                turbineRetrofit_M: turbineRetrofitM,
                electrical_M:      electricalM,
                civil_env_M:       civilEnvM,
                epc_M:             epcM,
                total_M:           totalCapexM,
                per_kW:  Math.round(totalCapexM * 1e6 / (powerMW * 1000)),
                per_kWh: Math.round(totalCapexM * 1e6 / (storageGWh * 1e6) * 10) / 10
            },

            // Turbine-as-pump retrofit cost breakdown
            retrofitBreakdown,

            opex: {
                annual_M:  annualOpexM,
                pct_capex: Math.round(this.OPEX_FRACTION * 1000) / 10
            },

            lcos: {
                lostEnergy: anu.lcosBreakdown ? anu.lcosBreakdown.lostEnergy : 0,
                capital:    anu.lcosBreakdown ? anu.lcosBreakdown.capital    : 0,
                om:         anu.lcosBreakdown ? anu.lcosBreakdown.om         : 0,
                total:      _r1(lcoe),
                isBlended:  true
            },

            revenue: {
                gross_M:      _r2(grossRevM),
                energyCost_M: _r2(energyCostM),
                net_M:        _r2(netRevM)
            },

            lifetimes
        };
    },

    // -----------------------------------------------------------------------
    // PRIVATE — PER-TIER CALCULATION (PHASE 2+)
    // -----------------------------------------------------------------------

    _calcTier(energyGWh, site) {
        const fin   = HB.Cost.financials;
        const hours = site.storageHours || this.DEFAULT_STORAGE_HOURS;
        const powerMW = energyGWh * 1000 / hours;
        const existing = site.useExistingReservoirs || false;

        // ---- ANU base model (reservoirs + tunnel + powerhouse) ----
        // Compute the FULL cost at this tier (used for greenfield or as reference).
        const anu = HB.Cost.engine.anuModel({
            headM:          site.headM,
            separationM:    site.separationM,
            energyGWh:      energyGWh,
            powerMW:        powerMW,
            waterRockRatio: site.waterRockRatio || 10,
            country:        site.country || 'default',
            useExistingReservoirs: existing
        });

        // ---- MARGINAL COST LOGIC for existing lake pairs ----
        // For bluefield/operational sites with known existing capacity, the
        // reservoirs, tunnels, and powerhouse already exist and are sunk costs.
        // Only charge MARGINAL expansion costs for capacity beyond what exists.
        //
        // Existing capacity (from site data):
        //   existingStorageGWh — energy already accommodated by existing reservoirs
        //   existingPowerMW    — power already handled by existing turbines/tunnels
        //
        // Rules:
        //   1. Reservoirs: $0 if tier ≤ existing storage. If tier > existing,
        //      charge only the cost delta (ANU cost at tier minus ANU cost at existing).
        //   2. Tunnel: $0 if tier power ≤ existing power. If tier > existing,
        //      charge marginal tunnel cost for the additional flow capacity.
        //   3. Powerhouse: $0 if tier power ≤ existing power. If tier > existing,
        //      charge marginal powerhouse + grid node cost for additional MW.

        const existGWh = (existing && site.existingStorageGWh > 0) ? site.existingStorageGWh : 0;
        const existMW  = (existing && site.existingPowerMW > 0)    ? site.existingPowerMW    : 0;

        let costReservoirs_M = anu.components.reservoirs_M;
        let costTunnel_M     = anu.components.tunnel_M;
        let costPowerhouse_M = anu.components.powerhouse_M;

        // --- Reservoirs: marginal only if existing lake capacity is known ---
        // Gated on existGWh: the lakes/dams exist up to existGWh capacity.
        if (existing && existGWh > 0) {
            if (energyGWh <= existGWh) {
                costReservoirs_M = 0;
            } else {
                // Cost of expanding from existing capacity to tier capacity.
                // Marginal = ANU(tier) - ANU(existing), both at greenfield reservoir rate.
                const anuExistR = HB.Cost.engine.anuModel({
                    headM: site.headM, separationM: site.separationM,
                    energyGWh: existGWh,
                    powerMW: existGWh * 1000 / hours,
                    waterRockRatio: site.waterRockRatio || 10,
                    country: site.country || 'default',
                    useExistingReservoirs: false  // greenfield rate for delta comparison
                });
                const anuTierFull = HB.Cost.engine.anuModel({
                    headM: site.headM, separationM: site.separationM,
                    energyGWh: energyGWh,
                    powerMW: powerMW,
                    waterRockRatio: site.waterRockRatio || 10,
                    country: site.country || 'default',
                    useExistingReservoirs: false
                });
                costReservoirs_M = Math.max(0,
                    anuTierFull.components.reservoirs_M - anuExistR.components.reservoirs_M);
            }
        }

        // --- Tunnel: marginal only if existing tunnel/power infrastructure exists ---
        // Gated on existMW: for ANU bluefield sites, tunnels don't exist yet
        // (existMW = 0), so the full ANU tunnel cost applies. For operational
        // plants with existing tunnels, only charge the marginal expansion.
        if (existing && existMW > 0) {
            if (powerMW <= existMW) {
                costTunnel_M = 0;
            } else {
                const existPowerForHours = existGWh > 0 ? existGWh * 1000 / hours : existMW;
                const anuExistT = HB.Cost.engine.anuModel({
                    headM: site.headM, separationM: site.separationM,
                    energyGWh: existGWh || (existMW * hours / 1000),
                    powerMW: Math.max(existMW, existPowerForHours),
                    waterRockRatio: site.waterRockRatio || 10,
                    country: site.country || 'default',
                    useExistingReservoirs: false
                });
                costTunnel_M = Math.max(0,
                    anu.components.tunnel_M - anuExistT.components.tunnel_M);
            }
        }

        // --- Powerhouse: marginal only if existing powerhouse exists ---
        // Same gating as tunnel: only operational plants with built turbines
        // and grid connections have sunk powerhouse cost.
        if (existing && existMW > 0) {
            if (powerMW <= existMW) {
                costPowerhouse_M = 0;
            } else {
                const anuExistP = HB.Cost.engine.anuModel({
                    headM: site.headM, separationM: site.separationM,
                    energyGWh: existGWh || (existMW * hours / 1000),
                    powerMW: existMW,
                    waterRockRatio: site.waterRockRatio || 10,
                    country: site.country || 'default',
                    useExistingReservoirs: false
                });
                costPowerhouse_M = Math.max(0,
                    anu.components.powerhouse_M - anuExistP.components.powerhouse_M);
            }
        }

        // Apply country overhead to marginal components
        const overheadIndex = anu.components.overheadIndex || 1;
        const civilSubtotalM = (costReservoirs_M + costTunnel_M + costPowerhouse_M);
        const baseCapexM     = civilSubtotalM * overheadIndex;

        // ---- Additional capital cost components ----
        const electricalM = costPowerhouse_M * overheadIndex * this.ELECTRICAL_FRACTION;
        const civilEnvM   = baseCapexM * this.CIVIL_ENV_FRACTION;
        const subTotalM   = baseCapexM + electricalM + civilEnvM;
        const epcM        = subTotalM * this.EPC_CONTINGENCY;
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

        // ---- Recompute LCOS capital from actual marginal CAPEX ----
        // anu.lcosBreakdown uses the ANU model's own CAPEX (which may differ from
        // the marginal CAPEX computed above). Recalculate the capital component so
        // LCOS is consistent with the CAPEX breakdown shown in the table.
        const _fin = HB.Cost.financials;
        const _r   = _fin.realDiscount;
        const _lt  = _fin.systemLifetime;
        const _annSoldTWh = anu.financials ? anu.financials.annualSoldTWh : 0;
        const _refurbM = 112000 * powerMW * 1000
                       * (Math.exp(-_r * 20) + Math.exp(-_r * 40)) / 1e6;
        const _amort   = _r > 0 ? _r / (1 - Math.exp(-_r * _lt)) : 1 / _lt;
        const _lcosCapActual = (_annSoldTWh > 0)
            ? ((totalCapexM + _refurbM) * _amort) / _annSoldTWh : 0;
        const _lcosBase = anu.lcosBreakdown || { lostEnergy: 0, capital: 0, om: 0, total: 0 };
        const lcosActual = {
            lostEnergy: _lcosBase.lostEnergy,
            capital:    Math.round(_lcosCapActual * 100) / 100,
            om:         _lcosBase.om,
            total:      Math.round((_lcosBase.lostEnergy + _lcosCapActual + _lcosBase.om) * 100) / 100
        };

        // ---- Extended financial metrics by project lifetime ----
        // When CAPEX = $0 (tier fully within existing capacity), financial metrics
        // like IRR/ROI are meaningless — no new investment is required.
        const noNewInvestment = totalCapexM < 0.01;
        const lifetimes = {};
        if (noNewInvestment) {
            [30, 40, 50].forEach(yr => {
                lifetimes[`yr${yr}`] = {
                    npv5_M: null, npv8_M: null, npv10_M: null,
                    irr_pct: null, roi_pct: null, payback_yr: 0
                };
            });
        } else {
            [30, 40, 50].forEach(yr => {
                lifetimes[`yr${yr}`] = this._extendedFinancials(
                    totalCapexM, netRevM, annualOpexM, grossRevM, yr
                );
            });
        }

        return {
            energyGWh,
            powerMW:      Math.round(powerMW * 10) / 10,
            storageHours: hours,

            // Full ANU model result (engineering + LCOS)
            anu,

            // CAPEX component breakdown (marginal costs for existing sites)
            capex: {
                dam_M:             _r2(costReservoirs_M),
                tunnel_M:          _r2(costTunnel_M),
                powerhouse_M:      _r2(costPowerhouse_M),
                solar_M:           0,
                turbineRetrofit_M: 0,
                electrical_M:      _r2(electricalM),
                civil_env_M:       _r2(civilEnvM),
                epc_M:             _r2(epcM),
                total_M:           _r2(totalCapexM),
                per_kW:            capexPerKW,
                per_kWh:           capexPerKWh,
                isMarginal:        existing && existGWh > 0,
                noNewInvestment:   noNewInvestment
            },

            // Annual OPEX
            opex: {
                annual_M:    annualOpexM,
                pct_capex:   Math.round(this.OPEX_FRACTION * 1000) / 10  // e.g. 1.5
            },

            // LCOS recomputed from actual marginal CAPEX (consistent with table)
            lcos: lcosActual,

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
