#!/usr/bin/env python3
"""
ANU PSH cost model — Python replica of the app's cost engine.

This mirrors, line-for-line, the formulas in:
  - js/cost/costEngine.js   -> HB.Cost.engine.anuModel()
  - js/cost/scaleUpEngine.js -> HB.Cost.scaleUp

Use it inside the ANU lake-pair extraction skill to compute CapEx ($),
CapEx benchmarks ($/kWh and $/MWh) and LCOS ($/MWh and $/kWh) from an
extracted lake-pair record, WITHOUT having to boot the browser app.
The numbers it produces are the same ones the app will show, so the two
stay consistent (the whole point of "map into the existing cost module").

Run directly for a worked example, or import `anu_model` / `scale_up`.

    python3 anu_cost_model.py \
        --head 227 --separation-km 0.6 --energy-gwh 2 --storage-hours 6 \
        --volume-gl 6 --country default

All defaults are copied from HB.Cost.financials in js/cost/costEngine.js.
Keep this file in sync if those defaults change.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, asdict


# ---------------------------------------------------------------------------
# Financial defaults — copied verbatim from HB.Cost.financials (costEngine.js)
# ---------------------------------------------------------------------------
@dataclass
class Financials:
    equity_fraction: float = 0.30
    debt_fraction: float = 0.70
    equity_return: float = 0.10
    bank_rate: float = 0.05
    inflation_rate: float = 0.015
    system_lifetime: int = 60          # years
    cycles_per_year: int = 240         # pump+gen cycles
    energy_purchase_price: float = 47  # $/MWh
    pump_efficiency: float = 0.90
    gen_efficiency: float = 0.90
    useable_fraction: float = 0.85
    dam_cost_per_m3: float = 168       # $/m3 rock volume
    avg_reservoir_depth: float = 15    # m
    lithium_battery_cost_per_kwh: float = 447  # $/kWh benchmark

    region_factors = {
        "Australia": 1.0,
        "Malaysia": 0.5,
        "Romania": 0.7,
        "default": 0.8,
    }

    @property
    def nominal_discount(self) -> float:
        return (self.equity_fraction * self.equity_return
                + self.debt_fraction * self.bank_rate)

    @property
    def real_discount(self) -> float:
        return self.nominal_discount - self.inflation_rate


FIN = Financials()


def _region_factor(country: str) -> float:
    return FIN.region_factors.get(country, FIN.region_factors["default"])


# ---------------------------------------------------------------------------
# anuModel — replica of HB.Cost.engine.anuModel(p)
# ---------------------------------------------------------------------------
def anu_model(
    head_m: float,
    energy_gwh: float,
    separation_m: float = 5000.0,
    power_mw: float | None = None,
    storage_hours: float | None = None,
    water_rock_ratio: float = 10.0,
    country: str = "default",
    volume_gl: float | None = None,
    dam_volume_gl: float | None = None,
    reservoir_area_ha: float | None = None,
    cycles_per_year: int | None = None,
    energy_price: float | None = None,
) -> dict:
    """Return the same CapEx / LCOS breakdown the app computes."""
    H = head_m
    S = separation_m
    E = energy_gwh
    hours = storage_hours or (E * 1000 / (power_mw or E * 1000 / 18))
    P = power_mw or (E * 1000 / hours)
    WR = water_rock_ratio
    region_factor = _region_factor(country)
    cycles = cycles_per_year or FIN.cycles_per_year
    price = energy_price or FIN.energy_purchase_price
    r = FIN.real_discount
    lifetime = FIN.system_lifetime

    # ---- system characteristics ----
    if volume_gl:
        available_water_gl = volume_gl * FIN.useable_fraction
        total_water_gl = volume_gl
    else:
        available_water_gl = E * 3600 / (9.8 * FIN.gen_efficiency * H)
        total_water_gl = available_water_gl / FIN.useable_fraction
    rock_volume_gl = dam_volume_gl if dam_volume_gl is not None else total_water_gl / WR
    slope = H / S
    upper_area_ha = reservoir_area_ha or (100 * total_water_gl / FIN.avg_reservoir_depth)

    # ---- component capital costs ($M) ----
    cost_reservoirs = FIN.dam_cost_per_m3 * rock_volume_gl
    cost_tunnel = region_factor * (
        (66000 * P + 17000000) + S * (1280 * P + 210000) * math.pow(H, -0.54)
    ) / 1_000_000
    cost_powerhouse = 63.5 * math.pow(H, -0.5) * math.pow(P, 0.75)
    total_capex_m = cost_reservoirs + cost_tunnel + cost_powerhouse
    total_capex = total_capex_m * 1_000_000

    # ---- unit-cost benchmarks ----
    cost_per_kw = total_capex_m * 1_000_000 / (P * 1000)          # $/kW
    cost_per_kwh = total_capex_m * 1_000_000 / (E * 1_000_000)    # $/kWh
    cost_per_mwh = cost_per_kwh * 1000                            # $/MWh

    # ---- ANU cost class benchmark ----
    benchmark_cost = 47 * E + 530 / 1000 * P
    cost_ratio = total_capex_m / benchmark_cost
    if cost_ratio < 1:      cost_class = "A"
    elif cost_ratio < 1.25: cost_class = "B"
    elif cost_ratio < 1.5:  cost_class = "C"
    elif cost_ratio < 1.75: cost_class = "D"
    elif cost_ratio < 2:    cost_class = "E"
    else:                   cost_class = ">E"

    # ---- O&M ----
    fixed_om = 8210 * P / 1_000_000
    variable_om = 0.3 * 2 * cycles * E / 1000
    total_om = fixed_om + variable_om

    # ---- refurbishment NPV ----
    refurb_npv = 112000 * P * (math.exp(-r * 20) + math.exp(-r * 40)) / 1_000_000

    # ---- annual energy ----
    annual_purchased_twh = (E / FIN.gen_efficiency) * cycles / 1000
    annual_sold_twh = (E * FIN.gen_efficiency) * cycles / 1000
    annual_sold_mwh = annual_sold_twh * 1_000_000

    # ---- LCOS ($/MWh) ----
    lcos_lost_energy = (annual_purchased_twh - annual_sold_twh) * 1_000_000 * price / annual_sold_mwh
    lcos_capital = ((total_capex_m + refurb_npv) * r) / (1 - math.exp(-r * lifetime)) / annual_sold_twh
    lcos_om = total_om / annual_sold_twh
    lcos_total = lcos_lost_energy + lcos_capital + lcos_om

    # ---- lithium comparison ----
    lithium_cost_m = FIN.lithium_battery_cost_per_kwh * E * 1_000_000 / 1_000_000
    cost_vs_lithium = total_capex_m / lithium_cost_m

    return {
        "summary": {
            "totalCAPEX_usd": round(total_capex),
            "totalCapex_M": round(total_capex_m, 3),
            "costPerKW": round(cost_per_kw, 1),
            "costPerKWh": round(cost_per_kwh, 2),   # $/kWh
            "costPerMWh": round(cost_per_mwh, 1),   # $/MWh benchmark
            "costClass": cost_class,
            "costRatio": round(cost_ratio, 3),
        },
        "capexCategories_M": {
            "reservoirs": round(cost_reservoirs, 3),
            "tunnel_penstock": round(cost_tunnel, 3),
            "powerhouse": round(cost_powerhouse, 3),
        },
        "lcos_usd_per_mwh": {
            "lostEnergy": round(lcos_lost_energy, 2),       # charging term
            "capital": round(lcos_capital, 2),
            "om": round(lcos_om, 2),
            "total": round(lcos_total, 2),                  # incl. charging
            "total_ex_charging": round(lcos_capital + lcos_om, 2),
        },
        "lcos_usd_per_kwh": round(lcos_total / 1000, 5),               # incl. charging
        "lcos_usd_per_kwh_ex_charging": round((lcos_capital + lcos_om) / 1000, 5),
        "discountRate": r,  # LCOS is rate-sensitive: +1pt ~ +10-12%; flag when quoting
        "engineering": {
            "powerMW": round(P, 1),
            "headM": H,
            "separationM": S,
            "energyGWh": E,
            "storageHours": round(hours, 2),
            "totalWaterGL": round(total_water_gl, 3),
            "rockVolumeGL": round(rock_volume_gl, 4),
            "slope": round(slope, 4),
            "upperAreaHa": round(upper_area_ha, 1),
            "waterRockRatio": WR,
            "regionFactor": region_factor,
            "country": country,
        },
        "benchmarks": {
            "lithiumCost_M": round(lithium_cost_m, 2),
            "costVsLithium": round(cost_vs_lithium, 4),
        },
    }


# ---------------------------------------------------------------------------
# scale_up — replica of HB.Cost.scaleUp (six-tier CapEx allocation)
# ---------------------------------------------------------------------------
TIERS = [2, 5, 10, 20, 50, 150]
DEFAULT_STORAGE_HOURS = 18
OPEX_FRACTION = 0.015
ELECTRICAL_FRACTION = 0.15
CIVIL_ENV_FRACTION = 0.12
EPC_CONTINGENCY = 0.10


def scale_up_tier(energy_gwh: float, head_m: float, separation_m: float,
                  country: str = "default", water_rock_ratio: float = 10.0,
                  storage_hours: float | None = None) -> dict:
    """One tier of the six-tier scale-up cost allocation (replica of _calcTier)."""
    hours = storage_hours or DEFAULT_STORAGE_HOURS
    power_mw = energy_gwh * 1000 / hours
    anu = anu_model(head_m=head_m, separation_m=separation_m, energy_gwh=energy_gwh,
                    power_mw=power_mw, water_rock_ratio=water_rock_ratio, country=country)

    base_capex_m = anu["summary"]["totalCapex_M"]
    powerhouse_m = anu["capexCategories_M"]["powerhouse"]
    electrical_m = powerhouse_m * ELECTRICAL_FRACTION
    civil_env_m = base_capex_m * CIVIL_ENV_FRACTION
    subtotal_m = base_capex_m + electrical_m + civil_env_m
    epc_m = subtotal_m * EPC_CONTINGENCY
    total_capex_m = subtotal_m + epc_m

    return {
        "energyGWh": energy_gwh,
        "powerMW": round(power_mw, 1),
        "capexCategories_M": {
            "dam_reservoir": anu["capexCategories_M"]["reservoirs"],
            "tunnel_penstock": anu["capexCategories_M"]["tunnel_penstock"],
            "powerhouse": powerhouse_m,
            "electrical": round(electrical_m, 2),
            "civil_env": round(civil_env_m, 2),
            "epc_contingency": round(epc_m, 2),
            "total": round(total_capex_m, 2),
        },
        "capexPerKW": round(total_capex_m * 1e6 / (power_mw * 1000)),
        "capexPerKWh": round(total_capex_m * 1e6 / (energy_gwh * 1e6), 1),
        "lcos_usd_per_mwh": anu["lcos_usd_per_mwh"]["total"],
    }


def scale_up(head_m: float, separation_m: float, country: str = "default",
             water_rock_ratio: float = 10.0, storage_hours: float | None = None,
             tiers: list[float] | None = None) -> list[dict]:
    return [scale_up_tier(g, head_m, separation_m, country, water_rock_ratio, storage_hours)
            for g in (tiers or TIERS)]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _main() -> None:
    ap = argparse.ArgumentParser(description="ANU PSH CapEx / LCOS calculator (app replica)")
    ap.add_argument("--head", type=float, required=True, help="Head height (m)")
    ap.add_argument("--separation-km", type=float, default=5.0, help="Reservoir separation (km)")
    ap.add_argument("--energy-gwh", type=float, required=True, help="Stored energy (GWh)")
    ap.add_argument("--storage-hours", type=float, default=None, help="Storage duration (h)")
    ap.add_argument("--power-mw", type=float, default=None, help="Power rating (MW)")
    ap.add_argument("--water-rock-ratio", type=float, default=10.0)
    ap.add_argument("--volume-gl", type=float, default=None, help="Known reservoir volume (GL)")
    ap.add_argument("--dam-volume-gl", type=float, default=None, help="Known dam/rock volume (GL/Mm3)")
    ap.add_argument("--reservoir-area-ha", type=float, default=None)
    ap.add_argument("--country", default="default",
                    help="Australia | Malaysia | Romania | default")
    ap.add_argument("--scale-up", action="store_true",
                    help="Also print the six-tier scale-up allocation")
    args = ap.parse_args()

    result = anu_model(
        head_m=args.head,
        energy_gwh=args.energy_gwh,
        separation_m=args.separation_km * 1000,
        power_mw=args.power_mw,
        storage_hours=args.storage_hours,
        water_rock_ratio=args.water_rock_ratio,
        country=args.country,
        volume_gl=args.volume_gl,
        dam_volume_gl=args.dam_volume_gl,
        reservoir_area_ha=args.reservoir_area_ha,
    )
    out = {"anuModel": result}
    if args.scale_up:
        out["scaleUp"] = scale_up(args.head, args.separation_km * 1000,
                                  args.country, args.water_rock_ratio, args.storage_hours)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    _main()
