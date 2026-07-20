/**
 * Floating PV (FPV) Engine — HydroBattery Atlas
 *
 * Sizes and costs a floating solar PV array that charges a PHES reservoir
 * during peak solar hours, enabling 24/7 renewable energy supply.
 *
 * Physical & cost model calibrated to:
 *   - World Bank / ESMAP "Where Sun Meets Water" Handbook (2019 / 2023 update)
 *   - NREL Floating PV Cost Benchmark Q1 2021 (NREL/TP-7A40-80695)
 *   - IEA PVPS Task 13 Floating PV Report (2025)
 *   - IRENA Renewable Power Generation Costs (2023)
 *   - Global Solar Atlas 2.0 / Solargis (World Bank)
 *
 * Cost basis: 2024 USD, utility scale (≥ 10 MW DC).
 */
HB.FPV = HB.FPV || {};

HB.FPV.engine = {

    // =========================================================================
    // COST PARAMETERS  (all in $/Wp DC, utility scale, Australia = 1.0 anchor)
    // Source: NREL Q1-2021 benchmark scaled +10% to 2024 USD; World Bank ESMAP
    // =========================================================================
    costParams: {
        modules:        0.22,   // Mono-PERC 550 Wp modules, 21% eff. (~$0.20–0.24 range)
        floats:         0.20,   // HDPE floating structures at >10 MW economy of scale
        anchoring:      0.10,   // Mooring lines + shore / lakebed anchors
        electricalBOS:  0.16,   // Inverters, inter-array cables, MV transformer, SCADA
        installation:   0.08,   // Marine installation, floating crane, commissioning
        softCosts:      0.10,   // Engineering, permitting, development, insurance
        // ---- Performance ----
        moduleEfficiency:  0.210,  // 21 % mono-PERC
        performanceRatio:  0.820,  // FPV PR slightly above ground-mount (+2% water-cooling)
        degradationPerYr:  0.005,  // 0.5 %/yr (IEC 61215 typical)
        systemLifetime:    25,     // years
        // ---- Geometry ----
        floatAreaFactor:   1.15,   // total platform area / active panel area (access lanes)
        panelAreaPerKWp:   4.76,   // m²/kWp  (= 1 kW / 210 W/m²)
        moduleSizeWp:      550,    // standard utility module size
        // ---- OPEX ----
        opexPerKW:         13.5,   // $/kW/yr  (ESMAP median ~€15/kW/yr; inspection, cleaning,
                                   //           mooring check, inverter maintenance)
    },

    // =========================================================================
    // REGIONAL COST INDEX — FPV (vs Australia = 1.0)
    // FPV costs more uniform than PHES (70%+ modules from China, globally traded).
    // Main variable: installation labour + permitting. Source: IRENA 2023, BNEF.
    // =========================================================================
    fpvRegionalIndex: {
        'Australia':       1.00,
        'New Zealand':     1.10,
        'Malaysia':        0.75,
        'Indonesia':       0.72,
        'Philippines':     0.75,
        'Vietnam':         0.70,
        'Thailand':        0.72,
        'Myanmar':         0.68,
        'India':           0.62,
        'China':           0.58,
        'South Korea':     1.05,
        'Japan':           1.35,
        'Romania':         0.78,
        'Bulgaria':        0.78,
        'Czech Republic':  0.85,
        'Poland':          0.82,
        'Hungary':         0.80,
        'Austria':         1.15,
        'Switzerland':     1.25,
        'Germany':         1.15,
        'France':          1.08,
        'Italy':           1.05,
        'Spain':           0.95,
        'Portugal':        0.90,
        'United Kingdom':  1.18,
        'Norway':          1.20,
        'Sweden':          1.15,
        'United States':   1.25,
        'Canada':          1.15,
        'Brazil':          0.82,
        'Chile':           0.90,
        'Colombia':        0.80,
        'Argentina':       0.82,
        'South Africa':    0.80,
        'Kenya':           0.72,
        'Ethiopia':        0.68,
        'Sabah / Borneo':  0.73,
        'default':         0.90
    },

    // =========================================================================
    // LATITUDE-BASED SOLAR RESOURCE FALLBACK
    // Used when Global Solar Atlas API is unavailable.
    // GHI in kWh/m²/yr; PVOUT in kWh/kWp/yr (horizontal, PR ≈ 0.82)
    // Source: Solargis global averages by latitude band
    // =========================================================================
    latitudeSolar: [
        { maxLat:  5, ghi: 2050, pvout: 1520 },   // equatorial tropics
        { maxLat: 10, ghi: 1980, pvout: 1460 },
        { maxLat: 15, ghi: 1920, pvout: 1400 },
        { maxLat: 20, ghi: 1980, pvout: 1430 },   // subtropical / hot arid
        { maxLat: 25, ghi: 2100, pvout: 1520 },
        { maxLat: 30, ghi: 1950, pvout: 1400 },
        { maxLat: 35, ghi: 1700, pvout: 1200 },   // Mediterranean
        { maxLat: 40, ghi: 1500, pvout: 1060 },
        { maxLat: 45, ghi: 1330, pvout:  940 },   // temperate continental
        { maxLat: 50, ghi: 1150, pvout:  810 },
        { maxLat: 55, ghi:  980, pvout:  690 },   // maritime / northern EU
        { maxLat: 60, ghi:  870, pvout:  610 },
        { maxLat: 90, ghi:  750, pvout:  520 },
    ],

    // =========================================================================
    // MAIN ENTRY POINT
    // =========================================================================
    /**
     * Evaluate a floating PV installation paired with a PHES site.
     *
     * @param {object} p
     * @param {number}  p.lat              Reservoir latitude
     * @param {number}  p.lng              Reservoir longitude
     * @param {string}  p.country          Country name (for regional cost index)
     * @param {number}  p.phesEnergyGWh    PHES storage capacity (GWh)
     * @param {number}  p.phesPowerMW      PHES rated power (MW)
     * @param {number}  [p.phesRTE]        Round-trip efficiency, 0–1 (default 0.80)
     * @param {number}  [p.pvoutKWhKWp]    PVOUT from GSA  (kWh/kWp/yr); auto-estimated if absent
     * @param {number}  [p.ghiKWhM2]       GHI from GSA    (kWh/m²/yr)
     * @param {number}  [p.solarPeakHrs]   Override peak solar hours/day (default: derived from PVOUT)
     * @param {number}  [p.gridNodeMW]     Grid node export ceiling (MW); 0 = unconstrained
     * @returns {object}
     */
    evaluate(p) {
        const cp   = this.costParams;
        const rte  = p.phesRTE || 0.80;
        const phesEnergyMWh = p.phesEnergyGWh * 1000;

        // ---- Solar resource ------------------------------------------------
        const solar = this._solarResource(p);
        const peakHrs = p.solarPeakHrs || solar.peakHoursDay;

        // ---- Sizing --------------------------------------------------------
        // Minimum FPV: must deliver E_phes of charge energy in one solar day
        //   P_fpv × peakHrs = E_phes / RTE   →   P_fpv = E_phes / (peakHrs × RTE)
        const fpvMinMW   = phesEnergyMWh / (peakHrs * rte);
        // Recommended +25% cloud / seasonal margin (ESMAP guidance)
        const fpvRecMW   = fpvMinMW * 1.25;
        // If grid node is limited, FPV must also cover direct export headroom
        const gridMW     = p.gridNodeMW || 0;
        const fpvDesignMW = gridMW > 0
            ? Math.max(fpvRecMW, fpvMinMW + gridMW)
            : fpvRecMW;

        const platformM2PerKWp = cp.panelAreaPerKWp * cp.floatAreaFactor; // m²/kWp
        const panelAreaM2      = fpvDesignMW * 1000 * cp.panelAreaPerKWp;
        const platformAreaM2   = fpvDesignMW * 1000 * platformM2PerKWp;
        const panelsRequired   = Math.ceil(fpvDesignMW * 1e6 / cp.moduleSizeWp);

        // ---- Annual energy -------------------------------------------------
        // annualFpvMWh = P_kWp × PVOUT_kWh/kWp/yr / 1000 (kWh→MWh)
        const annualFpvMWh     = fpvDesignMW * 1000 * solar.pvoutYear / 1000;
        const dailyFpvMWh      = annualFpvMWh / 365;

        // Dispatch split: 60% to PHES charging, 40% direct export (stylised daily average)
        // Constrained: can't store more than PHES capacity per day
        const dailyToPhes      = Math.min(dailyFpvMWh * 0.60, phesEnergyMWh);
        const dailyFromPhes    = dailyToPhes * rte;
        const dailyDirectExport = dailyFpvMWh - dailyToPhes;
        const dailyToGrid      = dailyDirectExport + dailyFromPhes;

        const annualToPhes     = dailyToPhes * 365;
        const annualFromPhes   = dailyFromPhes * 365;
        const annualDirect     = annualFpvMWh - annualToPhes;
        const annualToGrid     = annualDirect + annualFromPhes;
        const capacityFactor   = annualFpvMWh / (fpvDesignMW * 8760);

        // ---- Hourly dispatch profile (stylised 24-hour average day) --------
        const hourly = this._hourlyProfile(fpvDesignMW, solar, phesEnergyMWh, p.phesPowerMW, rte, gridMW);

        // ---- Capital costs -------------------------------------------------
        const ridx = this.fpvRegionalIndex[p.country] || this.fpvRegionalIndex['default'];
        // Each $/Wp component × regional index × installed MW → $M
        const modules_M       = fpvDesignMW * cp.modules       * ridx;
        const floats_M        = fpvDesignMW * cp.floats        * ridx;
        const anchoring_M     = fpvDesignMW * cp.anchoring     * ridx;
        const electricalBOS_M = fpvDesignMW * cp.electricalBOS * ridx;
        const installation_M  = fpvDesignMW * cp.installation  * ridx;
        const softCosts_M     = fpvDesignMW * cp.softCosts     * ridx;
        const totalCapexM     = modules_M + floats_M + anchoring_M +
                                electricalBOS_M + installation_M + softCosts_M;
        const specificWp      = totalCapexM / fpvDesignMW; // $/Wp (= $M/MW)

        // ---- OPEX ----------------------------------------------------------
        const annualOpexM  = fpvDesignMW * 1000 * cp.opexPerKW / 1e6; // $M/yr

        // ---- LCOE (FPV only, 25 yr, 7% discount, degradation applied) -----
        const dr           = 0.07;
        const life         = cp.systemLifetime;
        const annuity      = (1 - Math.pow(1 + dr, -life)) / dr;
        let lifetimeMWh    = 0;
        for (let y = 1; y <= life; y++) {
            lifetimeMWh += annualFpvMWh * Math.pow(1 - cp.degradationPerYr, y - 1);
        }
        const lcoeFpv = (totalCapexM * 1e6 + annualOpexM * 1e6 * annuity) / lifetimeMWh;

        // ---- Payback -------------------------------------------------------
        const energyPrice  = HB.Cost.financials.energyPurchasePrice; // $/MWh
        const annualRevM   = annualToGrid * energyPrice / 1e6;
        const simplePayback = annualRevM > 0 ? totalCapexM / annualRevM : 99;

        // ---- GSA URL -------------------------------------------------------
        const gsaUrl = this._gsaUrl(p.lat, p.lng, Math.round(fpvDesignMW * 1000));

        return {
            input: { ...p, solarPeakHours: Math.round(peakHrs * 10) / 10 },
            solar,
            sizing: {
                fpvMinMW:       _r(fpvMinMW, 1),
                fpvRecMW:       _r(fpvRecMW, 1),
                fpvDesignMW:    _r(fpvDesignMW, 1),
                panelAreaM2:    Math.round(panelAreaM2),
                platformAreaM2: Math.round(platformAreaM2),
                platformAreaHa: _r(platformAreaM2 / 10000, 1),
                platformAreaKm2:_r(platformAreaM2 / 1e6, 2),
                panelsRequired,
            },
            energy: {
                annualFpvMWh:      Math.round(annualFpvMWh),
                annualToPhes_MWh:  Math.round(annualToPhes),
                annualFromPhes_MWh:Math.round(annualFromPhes),
                annualDirect_MWh:  Math.round(annualDirect),
                annualToGrid_MWh:  Math.round(annualToGrid),
                capacityFactorPct: _r(capacityFactor * 100, 1),
                dailyFpvMWh:       _r(dailyFpvMWh, 1),
                dailyToPhes_MWh:   _r(dailyToPhes, 1),
                dailyFromPhes_MWh: _r(dailyFromPhes, 1),
                dailyToGrid_MWh:   _r(dailyToGrid, 1),
                hourly,
            },
            costs: {
                regionIndex:    ridx,
                specificWp:     _r(specificWp, 2),
                breakdown: { modules_M, floats_M, anchoring_M, electricalBOS_M, installation_M, softCosts_M },
                totalCapexM:    _r(totalCapexM, 1),
                annualOpexM:    _r(annualOpexM, 2),
                opexPerKW:      cp.opexPerKW,
                lcoeFpvPerMWh:  Math.round(lcoeFpv),
                simplePaybackYr:_r(simplePayback, 1),
                annualRevM:     _r(annualRevM, 2),
            },
            gsaUrl,
        };
    },

    // =========================================================================
    // SOLAR RESOURCE HELPER
    // =========================================================================
    _solarResource(p) {
        if (p.pvoutKWhKWp && p.pvoutKWhKWp > 0) {
            const pvout = p.pvoutKWhKWp;
            const ghi   = p.ghiKWhM2 || Math.round(pvout / 0.82 * 1.05); // rough estimate
            return {
                pvoutYear:    Math.round(pvout),
                ghiYear:      Math.round(ghi),
                peakHoursDay: _r(pvout / 365, 2),
                source:       'user_supplied'
            };
        }
        const absLat = Math.abs(p.lat || 0);
        const row = this.latitudeSolar.find(r => absLat <= r.maxLat)
                 || this.latitudeSolar[this.latitudeSolar.length - 1];
        return {
            pvoutYear:    row.pvout,
            ghiYear:      row.ghi,
            peakHoursDay: _r(row.pvout / 365, 2),
            source:       'latitude_estimate'
        };
    },

    // =========================================================================
    // STYLISED 24-HOUR DISPATCH PROFILE (average day)
    // Solar generation follows a Gaussian bell from 6 am to 8 pm.
    // PHES charges during peak solar hours; discharges in morning/evening.
    // =========================================================================
    _hourlyProfile(fpvMW, solar, phesMWh, phesPowerMW, rte, gridNodeMW) {
        const SUNRISE = 6, SUNSET = 20, PEAK_H = 13, SIGMA = 3.2;
        const maxChargeMW = Math.min(phesPowerMW || fpvMW * 0.6, fpvMW);
        const gridCap     = gridNodeMW > 0 ? gridNodeMW : Infinity;

        // Bell-curve generation profile scaled to daily PVOUT
        const dailyMWh = solar.pvoutYear / 365 * fpvMW; // MWh over 24 h
        const rawShape = Array.from({ length: 24 }, (_, h) =>
            (h >= SUNRISE && h < SUNSET)
                ? Math.exp(-0.5 * ((h - PEAK_H) / SIGMA) ** 2)
                : 0
        );
        const rawSum = rawShape.reduce((a, b) => a + b, 0) || 1;
        const gen = rawShape.map(v => v * dailyMWh / rawSum); // MWh/h

        const charge  = new Array(24).fill(0);
        const disch   = new Array(24).fill(0);
        const gridExp = new Array(24).fill(0);
        let stored = 0;

        // Pass 1 — charge during solar hours
        gen.forEach((g, h) => {
            if (g <= 0) { gridExp[h] = 0; return; }
            const canCharge = Math.min(g, maxChargeMW, phesMWh - stored);
            charge[h]   = Math.max(0, canCharge);
            stored     += charge[h];
            gridExp[h]  = Math.min(g - charge[h], gridCap);
        });

        // Pass 2 — discharge morning & evening peaks
        const DISCHARGE_HOURS = [5,6,7,8,17,18,19,20,21,22,23,0,1,2,3,4];
        let avail = stored * rte;
        const sliceSize = avail / Math.max(DISCHARGE_HOURS.length, 1);
        DISCHARGE_HOURS.forEach(h => {
            if (avail <= 0 || gen[h] > fpvMW * 0.1) return;
            const d = Math.min(sliceSize, avail, maxChargeMW);
            disch[h]   = d;
            avail     -= d;
            gridExp[h] = Math.min((gridExp[h] || 0) + d, gridCap);
        });

        const rnd = v => Math.round(v * 10) / 10;
        return {
            fpvGenMWh:      gen.map(rnd),
            phesChargeMWh:  charge.map(rnd),
            phesDischarMWh: disch.map(rnd),
            gridExportMWh:  gridExp.map(rnd),
        };
    },

    // =========================================================================
    // GLOBAL SOLAR ATLAS URL BUILDER
    // Generates a direct link to the GSA detail page for this location & system.
    // pv=hydro,azimuth,tilt,kWp  — "hydro" = floating configuration
    // =========================================================================
    _gsaUrl(lat, lng, capacityKWp) {
        const zoom = 10, tilt = 10, az = 180;
        return `https://globalsolaratlas.info/detail?c=${lat},${lng},${zoom}&m=site&s=${lat},${lng}&pv=hydro,${az},${tilt},${capacityKWp}`;
    },

    // =========================================================================
    // LIVE GLOBAL SOLAR ATLAS API FETCH
    // Tries api.globalsolaratlas.info — returns null on any failure.
    // =========================================================================
    async fetchGSA(lat, lng) {
        try {
            const url  = `https://api.globalsolaratlas.info/data/lta?loc=${lat},${lng}`;
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 5000);
            const resp = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tid);
            if (!resp.ok) return null;
            const data = await resp.json();
            const ann  = data?.annual?.data || {};
            const pvout = ann.PVOUT_csi || ann.PVOUT_total || null;
            if (!pvout) return null;
            return {
                pvoutYear:    Math.round(pvout),
                ghiYear:      Math.round(ann.GHI || pvout * 1.25),
                dniYear:      Math.round(ann.DNI || 0),
                difYear:      Math.round(ann.DIF || 0),
                airTempC:     ann.TEMP != null ? Math.round(ann.TEMP * 10) / 10 : null,
                peakHoursDay: _r(pvout / 365, 2),
                source:       'GlobalSolarAtlas'
            };
        } catch {
            return null;
        }
    },
};

// Rounding helper (internal)
function _r(v, d) { return Math.round(v * Math.pow(10, d)) / Math.pow(10, d); }
