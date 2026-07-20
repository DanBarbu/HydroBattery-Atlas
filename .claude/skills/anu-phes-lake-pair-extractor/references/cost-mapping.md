# ANU field → cost category mapping, CapEx & LCOS formulas

The rule: **map ANU fields into the app's EXISTING cost module — never invent a
parallel one.** The engine is `HB.Cost.engine.anuModel()` (js/cost/costEngine.js)
for a single point estimate, and `HB.Cost.scaleUp` (js/cost/scaleUpEngine.js) for
the six-tier allocation. `scripts/anu_cost_model.py` is a line-for-line Python
replica so you can compute the identical numbers during extraction.

## Inputs the cost model needs (from the extracted PAIR record)

| Model param        | From atlas field      | Fallback if missing                     |
|--------------------|-----------------------|-----------------------------------------|
| `headM`            | `head_m`              | required                                |
| `separationM`      | `separation_km*1000`  | 5000                                    |
| `energyGWh`        | `energy_gwh`          | `storage_mwh/1000`                      |
| `powerMW`          | `capacity_mw`         | `energy_gwh*1000/storage_hours`         |
| `waterRockRatio`   | `water_rock_ratio`    | 10 (greenfield)                         |
| `volumeGL`         | `volume_gl`           | derived: `E*3600/(9.8*η*H)`             |
| `damVolumeGL`      | `dam_volume_mm3`      | `totalWaterGL / waterRockRatio`         |
| `reservoirAreaHa`  | `reservoir_area_ha`   | `100*totalWaterGL/avgDepth`             |
| `country`          | `country`             | 'default' (region cost factor 0.8×)     |

Region cost factors (tunnel): Australia 1.0× · Malaysia 0.5× · Romania 0.7× ·
default 0.8×.

## CapEx categories (the "different categories of expenses")

`anuModel` allocates CapEx into **three physical categories** ($M):

1. **Reservoirs** = `damCostPerM3 (168 $/m3) × rockVolumeGL`
   — driven by `dam_volume_mm3` (or `volume_gl / water_rock_ratio`).
2. **Tunnel / Penstock** = `regionFactor × ((66000·P + 17e6) + S·(1280·P + 210000)·H^-0.54) / 1e6`
   — driven by `head_m`, `separation_km`, `capacity_mw`, `country`.
3. **Powerhouse** = `63.5 · H^-0.5 · P^0.75`
   — driven by `head_m`, `capacity_mw`.

`totalCapex = Reservoirs + Tunnel + Powerhouse`.

The **six-tier scale-up** (`scaleUp`) expands this into the full allocation used
by the app's scale-up panel, adding three derived categories on top of the ANU
base for each of the 2/5/10/20/50/150 GWh tiers:

4. **Electrical** = `powerhouse_M × 0.15`
5. **Civil + Environmental** = `baseCapex_M × 0.12`
6. **EPC contingency** = `(base + electrical + civilEnv) × 0.10`

`tier total = Reservoirs + Tunnel + Powerhouse + Electrical + CivilEnv + EPC`.

## Benchmarks the task asks for

- **CapEx $/kWh** = `totalCapex$ / (energy_gwh × 1e6)` → `summary.costPerKWh`.
- **CapEx $/MWh** = `costPerKWh × 1000` → `summary.costPerMWh`.
  (The task says "$/MWh"; the atlas' native benchmark is $/kWh — report both.)
- **CapEx $/kW** = `totalCapex$ / (capacity_mw × 1000)` → compare to ANU's
  `power_cost_usd_kw` as a cross-check.

## LCOS ($/MWh, and $/kWh for the task)

Levelised Cost Of Storage sums three components (all $/MWh sold):

- **Lost-energy** = round-trip loss valued at the purchase price:
  `(purchasedTWh − soldTWh)·1e6·price / soldMWh`.
- **Capital** = annualised CapEx (+refurb NPV) over energy sold:
  `((totalCapex_M + refurbNPV_M)·r) / (1 − e^(−r·lifetime)) / soldTWh`,
  with `r = realDiscount = 0.065 − 0.015 = 0.05`, `lifetime = 60 yr`.
- **O&M** = `(fixedOM + variableOM) / soldTWh`,
  `fixedOM = 8210·P`, `variableOM = 0.3·2·cycles·E`.

`LCOS = lostEnergy + capital + om` in **$/MWh**.
The task wants **$/kWh** → divide by 1000 (`scripts` returns `lcos_usd_per_kwh`).

**Cross-check:** ANU's own `energy_cost` field is its published LCOS in $/MWh.
After computing, compare your `lcos.total` to the extracted `energy_cost_usd_mwh`.
They use different discounting assumptions so they won't match exactly, but a
large divergence (>2×) means a units or extraction error — re-check inputs.

## Worked reference (the attached example pair, `default` region)

`head 227 m, separation 0.6 km, energy 2 GWh, 6 h, volume 6 GL`:
- CapEx ≈ $477 M → $238.6/kWh ($238,559/MWh), Class E, slope 0.38.
- LCOS ≈ $78.4/MWh = $0.0784/kWh.
Reproduce with:
`python3 scripts/anu_cost_model.py --head 227 --separation-km 0.6 --energy-gwh 2 --storage-hours 6 --volume-gl 6 --scale-up`
