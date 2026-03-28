/**
 * HydroBattery Atlas - Configuration & Constants
 */
const HB = window.HB || {};
window.HB = HB;

HB.Config = {
    // Physics constants
    GRAVITY: 9.81,              // m/s²
    WATER_DENSITY: 1000,        // kg/m³ (freshwater)
    SEAWATER_DENSITY: 1025,     // kg/m³
    KWH_TO_JOULES: 3600000,    // 1 kWh = 3.6 MJ

    // Default parameters
    DEFAULT_EFFICIENCY: 0.80,       // 80% round-trip
    DEFAULT_TURBINE_EFFICIENCY: 0.90,
    DEFAULT_PUMP_EFFICIENCY: 0.88,
    DEFAULT_GENERATOR_EFFICIENCY: 0.98,
    MIN_HEAD_HEIGHT: 100,           // meters
    MAX_TUNNEL_LENGTH: 10000,       // meters (10 km)
    DEFAULT_SEARCH_RADIUS: 25000,   // meters (25 km)

    // Penstock/tunnel design
    MAX_FLOW_VELOCITY: 4.0,     // m/s for steel penstocks
    FRICTION_FACTOR_STEEL: 0.015,
    FRICTION_FACTOR_CONCRETE: 0.013,

    // API endpoints
    ELEVATION_API: 'https://api.open-meteo.com/v1/elevation',
    GEOCODING_API: 'https://nominatim.openstreetmap.org/search',
    REVERSE_GEOCODING_API: 'https://nominatim.openstreetmap.org/reverse',

    // Map tile sources
    TILE_SOURCES: {
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        },
        topo: {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
            maxZoom: 17
        },
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '&copy; Esri',
            maxZoom: 18
        }
    },

    // Default map view
    DEFAULT_CENTER: [0, 20],
    DEFAULT_ZOOM: 3,

    // Search grid
    COARSE_GRID_SPACING: 1000,  // meters
    FINE_GRID_SPACING: 250,     // meters
    ELEVATION_BATCH_SIZE: 100,  // points per API call
    API_THROTTLE_MS: 200,       // ms between API calls

    // Cost model constants (2024 USD)
    // Calibrated against: Kidston (A$777M/250MW), Bath County, Dinorwig, Snowy 2.0
    COST: {
        // Dam construction ($/m³ of dam body)
        DAM_RCC_PER_M3: 80,            // Roller-Compacted Concrete
        DAM_EARTHFILL_PER_M3: 18,      // Earthfill
        DAM_ROCKFILL_PER_M3: 30,       // Rockfill
        DAM_MINE_PREP_FACTOR: 0.10,    // Mine void prep = 10% of equivalent new dam (pits exist)

        // Reservoir
        GEOMEMBRANE_PER_M2: 15,        // liner cost
        EXCAVATION_PER_M3: 8,          // reservoir excavation

        // Tunnel/Penstock
        TUNNEL_BASE_PER_M: 10000,      // base cost per linear meter (3m diameter)
        TUNNEL_DIAMETER_EXPONENT: 1.8,  // scales with ~D^1.8
        STEEL_LINER_PER_M: 3000,       // steel penstock lining per meter
        GEOLOGY_FACTOR_GOOD: 1.0,
        GEOLOGY_FACTOR_MIXED: 1.2,
        GEOLOGY_FACTOR_POOR: 1.6,
        VERTICAL_SHAFT_PREMIUM: 1.4,

        // Powerhouse & Turbines
        // Cost = TURBINE_COEFF * P^TURBINE_POW_EXP * H^TURBINE_HEAD_EXP ($/kW)
        TURBINE_COEFF: 4500,           // Calibrated to modern pump-turbine costs
        TURBINE_POW_EXP: -0.22,        // economy of scale
        TURBINE_HEAD_EXP: -0.10,
        VARIABLE_SPEED_PREMIUM: 1.20,
        UNDERGROUND_CAVERN_PER_M3: 2000,  // $/m³ for underground excavation
        SURFACE_POWERHOUSE_FACTOR: 0.5,

        // Electrical
        TRANSFORMER_PER_KVA: 18,
        SWITCHGEAR_FRACTION: 0.06,     // % of turbine-generator cost
        TRANSMISSION_PER_KM: 1500000,  // $/km
        GRID_CONNECTION_FIXED: 1200000,

        // Civil works
        ACCESS_ROAD_PER_KM: 1000000,
        SITE_PREP_FRACTION: 0.03,       // % of total civil
        LAND_PER_HECTARE: 10000,        // default, varies by region

        // Environmental & Soft costs
        EIA_COST: 4000000,
        PERMITTING_COST: 2500000,
        ENGINEERING_FRACTION: 0.10,     // % of construction
        CONTINGENCY_FRACTION: 0.15,     // % of subtotal

        // Scale factors
        SCALE_EXPONENT: 0.6,           // economy of scale exponent
    },

    // Currency conversion (relative to USD)
    CURRENCY_RATES: {
        USD: 1.0,
        EUR: 0.92,
        AUD: 1.53,
        GBP: 0.79
    },

    CURRENCY_SYMBOLS: {
        USD: '$',
        EUR: '\u20AC',
        AUD: 'A$',
        GBP: '\u00A3'
    },

    // Unit conversions
    UNITS: {
        energy: {
            kWh: 1,
            MWh: 1000,
            GWh: 1000000,
            TWh: 1000000000
        },
        power: {
            kW: 1,
            MW: 1000,
            GW: 1000000
        }
    }
};

// Application state
HB.State = {
    units: 'metric',
    currency: 'USD',
    mapTileLayer: 'topo',
    selectedConfig: 'lake_pair',
    searchResults: [],
    selectedSite: null,
    manualMarkers: { upper: null, lower: null },
    placingMarker: null, // 'upper' or 'lower'
    showElevation: true,
    discountRate: 0.07,
    constructionYears: 4,
    costYear: 2024
};

// Event bus for module communication
HB.Events = {
    _handlers: {},
    on(event, handler) {
        if (!this._handlers[event]) this._handlers[event] = [];
        this._handlers[event].push(handler);
    },
    off(event, handler) {
        if (!this._handlers[event]) return;
        this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    },
    emit(event, data) {
        if (!this._handlers[event]) return;
        this._handlers[event].forEach(h => h(data));
    }
};

// Utility functions
HB.Utils = {
    formatNumber(n, decimals = 0) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(decimals || 1) + 'T';
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals || 1) + 'B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals || 1) + 'M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals || 1) + 'K';
        return n.toFixed(decimals);
    },

    formatCurrency(amount) {
        const rate = HB.Config.CURRENCY_RATES[HB.State.currency] || 1;
        const symbol = HB.Config.CURRENCY_SYMBOLS[HB.State.currency] || '$';
        const converted = amount * rate;
        return symbol + HB.Utils.formatNumber(converted);
    },

    formatCurrencyFull(amount) {
        const rate = HB.Config.CURRENCY_RATES[HB.State.currency] || 1;
        const symbol = HB.Config.CURRENCY_SYMBOLS[HB.State.currency] || '$';
        const converted = amount * rate;
        return symbol + converted.toLocaleString('en-US', { maximumFractionDigits: 0 });
    },

    formatEnergy(kWh) {
        if (kWh >= 1e9) return (kWh / 1e9).toFixed(2) + ' TWh';
        if (kWh >= 1e6) return (kWh / 1e6).toFixed(2) + ' GWh';
        if (kWh >= 1e3) return (kWh / 1e3).toFixed(2) + ' MWh';
        return kWh.toFixed(2) + ' kWh';
    },

    formatPower(kW) {
        if (kW >= 1e6) return (kW / 1e6).toFixed(2) + ' GW';
        if (kW >= 1e3) return (kW / 1e3).toFixed(2) + ' MW';
        return kW.toFixed(2) + ' kW';
    },

    formatVolume(m3) {
        if (m3 >= 1e9) return (m3 / 1e9).toFixed(2) + ' km\u00B3';
        if (m3 >= 1e6) return (m3 / 1e6).toFixed(2) + ' Mm\u00B3';
        if (m3 >= 1e3) return (m3 / 1e3).toFixed(1) + ' \u00D710\u00B3 m\u00B3';
        return m3.toFixed(0) + ' m\u00B3';
    },

    energyToKWh(value, unit) {
        return value * (HB.Config.UNITS.energy[unit] || 1);
    },

    powerToKW(value, unit) {
        return value * (HB.Config.UNITS.power[unit] || 1);
    },

    showToast(message, duration = 3000) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    },

    debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
};
