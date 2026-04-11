/**
 * Master Cost Engine - Orchestrates all cost sub-models
 * Includes ANU/Kenyir PSH calculator model (from Excel spreadsheet)
 * with full financial feasibility and capacity interpolation.
 */
HB.Cost = HB.Cost || {};

// Default financial parameters (user-adjustable)
HB.Cost.financials = {
    equityFraction: 0.3,
    debtFraction: 0.7,
    equityReturn: 0.10,
    bankRate: 0.05,
    inflationRate: 0.015,
    systemLifetime: 60,        // years
    cyclesPerYear: 240,        // average pump+gen cycles
    energyPurchasePrice: 47,   // $/MWh
    pumpEfficiency: 0.90,
    genEfficiency: 0.90,
    useableFraction: 0.85,
    damCostPerM3: 195,         // $/m³ rock volume (2024 USD; calibrated +16% vs 2019 ANU basis)
    avgReservoirDepth: 15,     // m (for area calculation)
    lithiumBatteryCostPerKWh: 447, // $/kWh benchmark

    /**
     * Tunnel construction cost index per country (vs Australia = 1.0 baseline).
     * Applies only to the tunnel/penstock formula — reflects labour & materials
     * for underground civil works in each market.
     *
     * Calibration basis (benchmarked against World Bank / IRENA / project data):
     *   Australia   1.00  — anchor (Snowy 2.0, Kidston)
     *   USA         1.10  — NREL ATB / Bath County / Raccoon Mountain
     *   China       0.65  — Fengning, Guangzhou (state-led construction)
     *   Japan       1.35  — Kannagawa (high-spec underground, expensive labour)
     *   Switzerland 1.50  — Linthal/Limmern (alpine drilling, CHF labour rates)
     *   UK          1.10  — Dinorwig (historical + modern projects)
     *   Germany     1.00  — Goldisthal
     *   South Africa 0.75 — Ingula (cheaper labour, higher overrun risk captured in overhead)
     *   Malaysia    0.50  — SE Asia labour
     *   Romania     0.65  — Eastern European market
     */
    regionFactors: {
        'Australia':      1.00,
        'New Zealand':    1.10,
        'Malaysia':       0.50,
        'Indonesia':      0.55,
        'Philippines':    0.55,
        'Vietnam':        0.50,
        'Thailand':       0.55,
        'Myanmar':        0.45,
        'India':          0.55,
        'China':          0.65,
        'South Korea':    1.20,
        'Japan':          1.35,
        'Romania':        0.65,
        'Bulgaria':       0.65,
        'Czech Republic': 0.75,
        'Poland':         0.75,
        'Hungary':        0.70,
        'Austria':        1.10,
        'Switzerland':    1.50,
        'Germany':        1.00,
        'France':         1.00,
        'Italy':          0.95,
        'Spain':          0.90,
        'Portugal':       0.85,
        'United Kingdom': 1.10,
        'Norway':         1.15,
        'Sweden':         1.10,
        'United States':  1.10,
        'Canada':         1.05,
        'Brazil':         0.70,
        'Chile':          0.80,
        'Colombia':       0.70,
        'Argentina':      0.70,
        'South Africa':   0.75,
        'Kenya':          0.60,
        'Ethiopia':       0.55,
        'Sabah / Borneo': 0.50,   // Malaysian Borneo sub-region
        'default':        0.85
    },

    /**
     * Country-level project overhead multiplier — applied to TOTAL CAPEX after the
     * 3-component ANU civil formula.  Captures costs NOT in the base formula:
     *   • Environmental review & permitting (e.g. US NEPA, EU EIA)
     *   • Owner's costs, project development, legal
     *   • EPC management, contingency, risk premium
     *   • Grid interconnection studies and works
     *
     * Calibration source: benchmarked against NREL ATB 2024, World Bank ESMAP,
     * IRENA 2023 Renewable Power Costs, and individual project outturns.
     *
     * Australia = 1.00 (anchor — ANU formula already calibrated to AU market).
     * Values > 1.0 indicate higher regulatory/delivery costs than Australia.
     * Values < 1.0 indicate more streamlined approvals or lower soft costs.
     */
    countryOverheadIndex: {
        'Australia':      1.00,
        'New Zealand':    1.15,
        'Malaysia':       0.95,
        'Indonesia':      0.95,
        'Philippines':    1.00,
        'Vietnam':        0.95,
        'Thailand':       1.00,
        'Myanmar':        1.00,
        'India':          0.95,
        'China':          0.75,   // streamlined state approvals, efficient procurement
        'South Korea':    1.15,
        'Japan':          1.40,   // very complex permitting, high specs
        'Romania':        1.05,
        'Bulgaria':       1.00,
        'Czech Republic': 1.10,
        'Poland':         1.05,
        'Hungary':        1.05,
        'Austria':        1.25,
        'Switzerland':    1.55,   // highest labour costs in Europe, alpine complexity
        'Germany':        1.20,
        'France':         1.20,
        'Italy':          1.15,
        'Spain':          1.10,
        'Portugal':       1.05,
        'United Kingdom': 1.35,   // complex planning, Dinorwig/Cruachan precedent
        'Norway':         1.20,
        'Sweden':         1.15,
        'United States':  1.90,   // NEPA review, FERC licensing, legal — NREL ATB calibrated
        'Canada':         1.50,
        'Brazil':         1.10,
        'Chile':          1.10,
        'Colombia':       1.10,
        'Argentina':      1.10,
        'South Africa':   1.15,   // higher than raw labour costs due to governance/overrun risk
        'Kenya':          1.05,
        'Ethiopia':       1.00,
        'Sabah / Borneo': 0.95,
        'default':        1.10
    },

    // Derived
    get nominalDiscount() {
        return this.equityFraction * this.equityReturn + this.debtFraction * this.bankRate;
    },
    get realDiscount() {
        return this.nominalDiscount - this.inflationRate;
    }
};

HB.Cost.engine = {
    /**
     * ANU/Kenyir PSH cost model — exact formulas from the Excel calculator.
     * Works for any capacity from 10 MWh to 500 GWh.
     *
     * @param {Object} p
     * @param {number} p.headM           - Head height (m)
     * @param {number} p.separationM     - Separation between reservoirs (m)
     * @param {number} p.energyGWh       - Stored energy (GWh)
     * @param {number} p.powerMW         - Power rating (MW), auto-calculated if omitted
     * @param {number} [p.waterRockRatio] - Water-to-rock ratio (default 10 for greenfield)
     * @param {string} [p.country]       - For region tunnel cost factor
     * @param {number} [p.cyclesPerYear] - Override default
     * @param {number} [p.energyPrice]   - Override purchase price $/MWh
     * @param {number} [p.volumeGL]      - Known reservoir volume (overrides calculation)
     * @param {number} [p.damVolumeGL]   - Known dam/rock volume (overrides calculation)
     * @param {number} [p.reservoirAreaHa] - Known reservoir area
     * @param {boolean} [p.useExistingReservoirs] - True for bluefield sites using existing lakes
     *        (no new dam construction; cost = marginal intake/outlet structures only)
     * @returns {Object} Full cost + financial breakdown
     */
    anuModel(p) {
        const fin = HB.Cost.financials;
        const H = p.headM;
        const S = p.separationM || 5000;
        const E = p.energyGWh;
        const storageHours = p.storageHours || (E * 1000 / (p.powerMW || E * 1000 / 18));
        const P = p.powerMW || (E * 1000 / storageHours);
        const WR = p.waterRockRatio || 10;
        const country = p.country || 'default';
        const regionFactor  = fin.regionFactors[country]       || fin.regionFactors['default'];
        const overheadIndex = fin.countryOverheadIndex[country] || fin.countryOverheadIndex['default'];
        const cycles = p.cyclesPerYear || fin.cyclesPerYear;
        const energyPrice = p.energyPrice || fin.energyPurchasePrice;
        const r = fin.realDiscount;
        const lifetime = fin.systemLifetime;

        // ---- SYSTEM CHARACTERISTICS ----
        // Available water volume needed: E(kWh) = m*g*h*η => m = E*3600/(g*η*H)
        const availableWaterGL = p.volumeGL
            ? p.volumeGL * fin.useableFraction
            : E * 3600 / (9.8 * fin.genEfficiency * H);  // in GL (Mm³)
        const totalWaterGL = p.volumeGL || (availableWaterGL / fin.useableFraction);
        const rockVolumeGL = p.damVolumeGL || (totalWaterGL / WR);
        const slope = H / S;
        const hoursAtFullPower = E * 1000 / P;
        const upperAreaHa = p.reservoirAreaHa || (100 * totalWaterGL / fin.avgReservoirDepth);
        const upperDiameterKm = Math.sqrt(upperAreaHa * 10000 * 4 / Math.PI) / 1000;

        // ---- COMPONENT CAPITAL COSTS ($million, 2024 USD) ----
        // Constants updated from ANU 2019 basis → 2024 USD (+15% construction cost inflation).
        // Calibration anchors: Snowy 2.0 (AUS, −9%→+4%), Linthal/CH, Goldisthal/DE, Guangzhou/CN.

        // 1. Reservoirs — dam cost × rock volume (damCostPerM3 updated 168→195 $/m³)
        //    For bluefield sites with existing reservoirs (useExistingReservoirs=true):
        //    No new dam construction. Cost covers only marginal intake/outlet structures,
        //    trashrack, gate valves, and cofferdam works — typically ~5% of greenfield dam cost.
        const existingRes = !!p.useExistingReservoirs;
        const reservoirFraction = existingRes ? 0.05 : 1.0;
        const costReservoirs = fin.damCostPerM3 * rockVolumeGL * reservoirFraction;

        // 2. Tunnel / Penstock — ANU formula × regional labour index × 1.15 inflation factor
        //    Constants ×1.15 vs original ANU (66000→75900, 17M→19.55M, 1280→1472, 210000→241500)
        const costTunnel = regionFactor * (
            (75900 * P + 19550000) + S * (1472 * P + 241500) * Math.pow(H, -0.54)
        ) / 1000000;

        // 3. Powerhouse — ANU formula, constant updated 63.5→70 (+10% electromechanical inflation)
        const costPowerhouse = 70.0 * Math.pow(H, -0.5) * Math.pow(P, 0.75);

        // 4. Country overhead — permitting, environmental review, owner's costs, EPC contingency.
        //    Multiplies all three civil components. Australia = 1.00 (anchor).
        const civilSubtotal = costReservoirs + costTunnel + costPowerhouse;
        const totalCapexM   = civilSubtotal * overheadIndex;
        const totalCapex = totalCapexM * 1000000; // convert to $

        // ---- COST METRICS ----
        const costPerKW = totalCapexM * 1000000 / (P * 1000);  // $/kW
        const costPerKWh = totalCapexM * 1000000 / (E * 1000000); // $/kWh

        // ---- ANU COST CLASS (Benchmark) ----
        // Benchmark formula updated to 2024 USD (+16%): 47→54.5 $/kWh, 0.53→0.61 $/W
        const benchmarkCost = 54.5 * E + 0.61 * P; // $M (2024 USD)
        const costRatio = totalCapexM / benchmarkCost;
        let costClass;
        if (costRatio < 1) costClass = 'A';
        else if (costRatio < 1.25) costClass = 'B';
        else if (costRatio < 1.5) costClass = 'C';
        else if (costRatio < 1.75) costClass = 'D';
        else if (costRatio < 2) costClass = 'E';
        else costClass = '>E';

        // ---- O&M ----
        const fixedOM = 8210 * P / 1000000;  // $M/year
        const variableOM = 0.3 * 2 * cycles * E / 1000; // $M/year
        const totalOM = fixedOM + variableOM;
        const omFraction = totalOM / totalCapexM;

        // ---- REFURBISHMENT (NPV at years 20 and 40) ----
        const refurbNPV = 112000 * P * (Math.exp(-r * 20) + Math.exp(-r * 40)) / 1000000; // $M

        // ---- ANNUAL ENERGY ----
        const annualPurchasedTWh = (E / fin.genEfficiency) * cycles / 1000;
        const annualSoldTWh = (E * fin.genEfficiency) * cycles / 1000;
        const annualSoldMWh = annualSoldTWh * 1000000;

        // ---- LCOS COMPONENTS ($/MWh) ----
        // Lost energy cost
        const lcosLostEnergy = (annualPurchasedTWh - annualSoldTWh) * 1000000 * energyPrice / annualSoldMWh;

        // Capital cost component
        const lcosCapital = ((totalCapexM + refurbNPV) * r) / (1 - Math.exp(-r * lifetime)) / annualSoldTWh;

        // O&M cost component
        const lcosOM = totalOM / annualSoldTWh;

        // Total LCOS
        const lcosTotal = lcosLostEnergy + lcosCapital + lcosOM;

        // ---- LITHIUM BATTERY COMPARISON ----
        const lithiumCostTotal = fin.lithiumBatteryCostPerKWh * E * 1000000 / 1000000; // $M
        const costVsLithium = totalCapexM / lithiumCostTotal;

        return {
            summary: {
                totalCAPEX: totalCapex,
                totalCapexM: totalCapexM,
                costPerKW: Math.round(costPerKW * 10) / 10,
                costPerKWh: Math.round(costPerKWh * 100) / 100,
                lcos: Math.round(lcosTotal * 100) / 100,
                costClass: costClass,
                costRatio: Math.round(costRatio * 1000) / 1000,

                breakdown: [
                    { name: existingRes ? 'Intake Structures' : 'Reservoirs', value: costReservoirs  * overheadIndex * 1e6, color: '#4a90d9' },
                    { name: 'Tunnel / Penstock', value: costTunnel     * overheadIndex * 1e6, color: '#e74c3c' },
                    { name: 'Powerhouse',        value: costPowerhouse * overheadIndex * 1e6, color: '#2ecc71' }
                ],
                useExistingReservoirs: existingRes
            },

            lcosBreakdown: {
                lostEnergy: Math.round(lcosLostEnergy * 100) / 100,
                capital: Math.round(lcosCapital * 100) / 100,
                om: Math.round(lcosOM * 100) / 100,
                total: Math.round(lcosTotal * 100) / 100
            },

            financials: {
                annualPurchasedTWh: Math.round(annualPurchasedTWh * 10000) / 10000,
                annualSoldTWh: Math.round(annualSoldTWh * 10000) / 10000,
                fixedOM_M: Math.round(fixedOM * 1000) / 1000,
                variableOM_M: Math.round(variableOM * 1000) / 1000,
                omFraction: Math.round(omFraction * 10000) / 10000,
                refurbNPV_M: Math.round(refurbNPV * 100) / 100,
                realDiscount: r,
                nominalDiscount: fin.nominalDiscount,
                cyclesPerYear: cycles,
                energyPrice: energyPrice,
                hoursAtFullPower: Math.round(hoursAtFullPower * 10) / 10,
                benchmarkCost_M: Math.round(benchmarkCost * 100) / 100,
                lithiumCost_M: Math.round(lithiumCostTotal * 100) / 100,
                costVsLithium: Math.round(costVsLithium * 10000) / 10000
            },

            engineering: {
                powerMW: Math.round(P * 10) / 10,
                headM: H,
                separationM: S,
                energyGWh: E,
                totalWaterGL: Math.round(totalWaterGL * 1000) / 1000,
                availableWaterGL: Math.round(availableWaterGL * 1000) / 1000,
                rockVolumeGL: Math.round(rockVolumeGL * 10000) / 10000,
                slope: Math.round(slope * 10000) / 10000,
                upperAreaHa: Math.round(upperAreaHa * 10) / 10,
                upperDiameterKm: Math.round(upperDiameterKm * 100) / 100,
                waterRockRatio: WR,
                regionFactor: regionFactor,
                overheadIndex: overheadIndex,
                country: country
            },

            components: {
                reservoirs_M:  Math.round(costReservoirs  * 1000) / 1000,
                tunnel_M:      Math.round(costTunnel      * 1000) / 1000,
                powerhouse_M:  Math.round(costPowerhouse  * 1000) / 1000,
                overhead_M:    Math.round((totalCapexM - civilSubtotal) * 1000) / 1000,
                overheadIndex: Math.round(overheadIndex * 1000) / 1000,
                useExistingReservoirs: existingRes
            }
        };
    },

    /**
     * Interpolate cost for an arbitrary capacity between two ANU tier data points.
     * E.g., calculate 3.4 GWh cost at a location that has 2GWh and 5GWh ANU data.
     *
     * @param {Object} tierLow   - Lower tier site data (from ANU, e.g. 2GWh)
     * @param {Object} tierHigh  - Higher tier site data (from ANU, e.g. 5GWh)
     * @param {number} targetGWh - Desired energy storage (GWh)
     * @param {Object} [overrides] - Optional parameter overrides
     * @returns {Object} Interpolated anuModel result
     */
    interpolateCapacity(tierLow, tierHigh, targetGWh, overrides) {
        const eLow = tierLow.energy_gwh || tierLow.energyGWh;
        const eHigh = tierHigh.energy_gwh || tierHigh.energyGWh;

        if (targetGWh <= eLow) return this.anuModel(Object.assign(this._siteToAnuParams(tierLow), overrides || {}));
        if (targetGWh >= eHigh) return this.anuModel(Object.assign(this._siteToAnuParams(tierHigh), overrides || {}));

        // Fraction between tiers
        const t = (targetGWh - eLow) / (eHigh - eLow);

        // Interpolate physical parameters
        const headM = this._lerp(tierLow.head_m, tierHigh.head_m, t);
        const sepKm = this._lerp(
            tierLow.separation_km || tierLow.separationKm || 5,
            tierHigh.separation_km || tierHigh.separationKm || 5, t
        );
        const wr = this._lerp(
            tierLow.water_rock_ratio || tierLow.waterRockRatio || 10,
            tierHigh.water_rock_ratio || tierHigh.waterRockRatio || 10, t
        );
        // Volume scales ~linearly with energy for same head
        const volLow = tierLow.volume_gl || tierLow.volumeGL;
        const volHigh = tierHigh.volume_gl || tierHigh.volumeGL;
        const volumeGL = (volLow && volHigh) ? this._lerp(volLow, volHigh, t) : undefined;
        // Dam volume scales with water volume / WR
        const dvLow = tierLow.dam_volume_mm3 || tierLow.damVolumeGL;
        const dvHigh = tierHigh.dam_volume_mm3 || tierHigh.damVolumeGL;
        const damVolumeGL = (dvLow && dvHigh) ? this._lerp(dvLow, dvHigh, t) : undefined;
        // Area
        const aLow = tierLow.reservoir_area_ha || tierLow.reservoirAreaHa;
        const aHigh = tierHigh.reservoir_area_ha || tierHigh.reservoirAreaHa;
        const areaHa = (aLow && aHigh) ? this._lerp(aLow, aHigh, t) : undefined;

        const params = {
            headM: headM,
            separationM: sepKm * 1000,
            energyGWh: targetGWh,
            waterRockRatio: wr,
            volumeGL: volumeGL,
            damVolumeGL: damVolumeGL,
            reservoirAreaHa: areaHa,
            country: tierLow.country || tierHigh.country || 'default'
        };

        return this.anuModel(Object.assign(params, overrides || {}));
    },

    /**
     * Convert a site object (from knownSites/bluefield data) to anuModel params.
     */
    _siteToAnuParams(site) {
        return {
            headM: site.head_m || site.headM,
            separationM: (site.separation_km || site.separationKm || site.tunnel_length_m / 1000 || 5) * 1000,
            energyGWh: (site.energy_gwh || site.energyGWh) || (site.storage_mwh || site.storageMWh || 0) / 1000,
            powerMW: site.capacity_mw || site.powerMW,
            waterRockRatio: site.water_rock_ratio || site.anu_water_rock_ratio || site.waterRockRatio || 10,
            volumeGL: site.volume_gl || site.anu_volume_gl || site.volumeGL,
            damVolumeGL: site.dam_volume_mm3 || site.anu_dam_volume_mm3 || site.damVolumeGL,
            reservoirAreaHa: site.reservoir_area_ha || site.anu_reservoir_area_ha || site.reservoirAreaHa,
            country: site.country || 'default'
        };
    },

    _lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Full project cost estimate (original detailed model — kept for compatibility)
     */
    calculate(site) {
        const config = site.configuration || 'lake_pair';
        const geology = site.geology || 'mixed';
        const terrain = site.terrain || 'hilly';
        const damType = site.damType || this._selectDamType(site.headHeight);
        const efficiency = site.efficiency || HB.Config.DEFAULT_EFFICIENCY;
        const density = config === 'lake_ocean' ? HB.Config.SEAWATER_DENSITY : HB.Config.WATER_DENSITY;

        // Derived parameters
        const volume = HB.Geo.requiredVolume(site.energyKWh, site.headHeight, efficiency, density);
        const flowRate = HB.Geo.flowRate(site.powerKW, site.headHeight, HB.Config.DEFAULT_TURBINE_EFFICIENCY, density);
        const penstockDiameter = HB.Geo.penstockDiameter(flowRate);
        const netHead = HB.Geo.netHead(site.headHeight, site.tunnelLength, penstockDiameter, flowRate);
        const storageDuration = HB.Geo.storageDuration(site.energyKWh, site.powerKW);
        const capacityMW = site.powerKW / 1000;

        let damCount = 2;
        if (config === 'lake_ocean') damCount = 1;
        if (config === 'lake_underground') damCount = 1;

        const damResult = HB.Cost.dam.calculate({ volume, headHeight: site.headHeight, damType, configuration: config, damCount });
        const isUnderground = config === 'lake_underground';
        const tunnelResult = HB.Cost.tunnel.calculate({ tunnelLength: site.tunnelLength, penstockDiameter, headHeight: site.headHeight, geology, verticalShaft: isUnderground, shaftDepth: isUnderground ? site.headHeight : 0 });
        const powerhouseResult = HB.Cost.powerhouse.calculate({ capacityMW, headHeight: netHead, numUnits: null, underground: isUnderground, variableSpeed: site.variableSpeed || false });
        const electricalResult = HB.Cost.electrical.calculate({ capacityMW, transmissionDistanceKm: site.transmissionDistanceKm, turbineGenCost: powerhouseResult.turbineGenerator });
        const constructionSubtotal = damResult.total + tunnelResult.total + powerhouseResult.total + electricalResult.total;
        const civilResult = HB.Cost.civil.calculate({ capacityMW, terrain, constructionSubtotal });
        const hardCostSubtotal = constructionSubtotal + civilResult.total;
        const envResult = HB.Cost.environmental.calculate({ constructionSubtotal: hardCostSubtotal, capacityMW, constructionYears: HB.State.constructionYears, discountRate: HB.State.discountRate });
        const totalCAPEX = hardCostSubtotal + envResult.total;

        // Also run ANU model for comparison if we have head data
        let anuResult = null;
        if (site.headHeight && site.energyKWh) {
            anuResult = this.anuModel({
                headM: site.headHeight,
                separationM: site.tunnelLength || 5000,
                energyGWh: site.energyKWh / 1000000,
                powerMW: site.powerKW / 1000
            });
        }

        const costPerKW = totalCAPEX / site.powerKW;
        const costPerKWh = totalCAPEX / site.energyKWh;
        const annualCycles = 300;
        const plantLife = 50;
        const annualEnergy = site.energyKWh * annualCycles / 1000;
        const crf = (HB.State.discountRate * Math.pow(1 + HB.State.discountRate, plantLife)) / (Math.pow(1 + HB.State.discountRate, plantLife) - 1);
        const annualizedCAPEX = totalCAPEX * crf;
        const annualOM = totalCAPEX * 0.01;
        const lcos = (annualizedCAPEX + annualOM) / annualEnergy;

        return {
            components: {
                damReservoir: damResult, waterConveyance: tunnelResult,
                powerhouseElectromechanical: powerhouseResult, electrical: electricalResult,
                civilWorks: civilResult, environmentalSoft: envResult
            },
            summary: {
                totalCAPEX, costPerKW: Math.round(costPerKW),
                costPerKWh: Math.round(costPerKWh * 100) / 100,
                lcos: Math.round(lcos * 100) / 100,
                breakdown: [
                    { name: 'Dam & Reservoir', value: damResult.total, color: '#4a90d9' },
                    { name: 'Water Conveyance', value: tunnelResult.total, color: '#e74c3c' },
                    { name: 'Powerhouse & E/M', value: powerhouseResult.total, color: '#2ecc71' },
                    { name: 'Electrical', value: electricalResult.total, color: '#f39c12' },
                    { name: 'Civil Works', value: civilResult.total, color: '#9b59b6' },
                    { name: 'Environmental & Soft', value: envResult.total, color: '#1abc9c' }
                ]
            },
            engineering: {
                waterVolume: volume, flowRate, penstockDiameter, netHead,
                grossHead: site.headHeight, storageDuration, configuration: config,
                damType, turbineType: powerhouseResult.details.turbineType,
                numUnits: powerhouseResult.details.numUnits, efficiency
            },
            anuComparison: anuResult
        };
    },

    _selectDamType(headHeight) {
        if (headHeight > 100) return 'rcc';
        if (headHeight > 50) return 'rockfill';
        return 'earthfill';
    },

    quickEstimate(headHeight, tunnelLength, energyKWh, powerKW, configuration) {
        const density = configuration === 'lake_ocean' ? HB.Config.SEAWATER_DENSITY : HB.Config.WATER_DENSITY;
        const volume = HB.Geo.requiredVolume(energyKWh, headHeight, HB.Config.DEFAULT_EFFICIENCY, density);
        const capacityMW = powerKW / 1000;
        const damCost = volume * 8;
        const tunnelCost = tunnelLength * 15000;
        const powerhouseCost = capacityMW * 1000 * 1200;
        const electricalCost = capacityMW * 1000 * 200;
        const civilCost = capacityMW * 1000 * 100;
        const subtotal = damCost + tunnelCost + powerhouseCost + electricalCost + civilCost;
        const total = subtotal + subtotal * 0.35;
        return { totalCAPEX: total, costPerKW: total / powerKW, costPerKWh: total / energyKWh };
    }
};
