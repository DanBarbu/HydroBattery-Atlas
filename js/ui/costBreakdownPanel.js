/**
 * Cost Breakdown Panel - renders cost tables, LCOS breakdown, and financials
 * Supports both original detailed model and ANU/Kenyir PSH model.
 */
HB.UI = HB.UI || {};

HB.UI.costBreakdown = {
    render(costResult) {
        if (!costResult) return;
        const { summary, components } = costResult;
        this._renderCostTable(summary);
        this._renderSummary(summary);
        HB.UI.chartRenderer.drawPieChart(
            document.getElementById('cost-pie-chart'),
            summary.breakdown
        );
    },

    /**
     * Render ANU model results (called for Bluefield/known sites with ANU data)
     */
    renderAnu(anuResult) {
        if (!anuResult) return;
        const container = document.getElementById('cost-summary');
        if (!container) return;

        const s = anuResult.summary;
        const lcos = anuResult.lcosBreakdown;
        const fin = anuResult.financials;
        const eng = anuResult.engineering;
        const comp = anuResult.components;
        const isExisting   = s.isExistingInfrastructure;  // fully built (operational)
        const isExistingRes = s.isExistingReservoirs;       // ANU bluefield — lakes only

        const classColor = s.costClass === 'A' ? '#2e7d32' : s.costClass === 'B' ? '#1565c0' : s.costClass === 'C' ? '#ff8f00' : '#c62828';

        let capexSection;
        if (isExisting) {
            capexSection = `
                <div style="background:#e8f5e9;border-radius:6px;padding:8px 10px;margin-bottom:8px;">
                    <div style="font-weight:700;color:#2e7d32;font-size:12px;">Existing Infrastructure</div>
                    <div style="font-size:10px;color:#555;margin-top:2px;">Reservoirs, tunnels, and powerhouse already built. No new civil CAPEX required. Use Scale-Up Analysis for Phase 0/1 retrofit + FPV investment costs.</div>
                </div>
                <div class="cost-metric">
                    <span class="label">New Civil CAPEX</span>
                    <span class="value" style="color:#2e7d32;font-weight:700;">$0</span>
                </div>`;
        } else if (isExistingRes) {
            capexSection = `
                <div style="background:#e3f2fd;border-radius:6px;padding:8px 10px;margin-bottom:8px;">
                    <div style="font-weight:700;color:#1565c0;font-size:12px;">Lake Pair Exists — Reservoir CAPEX $0</div>
                    <div style="font-size:10px;color:#555;margin-top:2px;">Natural lake pair identified by ANU atlas. No dam/reservoir construction required. New investment: tunnel + powerhouse only.</div>
                </div>
                <div class="cost-metric">
                    <span class="label">New CAPEX (tunnel + powerhouse)</span>
                    <span class="value">$${s.totalCapexM.toFixed(1)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cost / kW</span>
                    <span class="value">$${HB.Utils.formatNumber(s.costPerKW)}/kW</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cost / kWh stored</span>
                    <span class="value">$${s.costPerKWh.toFixed(1)}/kWh</span>
                </div>`;
        } else {
            capexSection = `
                <div class="cost-metric" style="border-bottom:2px solid ${classColor};padding-bottom:8px;margin-bottom:8px;">
                    <span class="label">ANU Cost Class</span>
                    <span class="value" style="color:${classColor};font-weight:800;font-size:18px;">${s.costClass}</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Total CAPEX</span>
                    <span class="value">$${s.totalCapexM.toFixed(1)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cost / kW</span>
                    <span class="value">$${HB.Utils.formatNumber(s.costPerKW)}/kW</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cost / kWh</span>
                    <span class="value">$${s.costPerKWh.toFixed(1)}/kWh</span>
                </div>`;
        }

        container.innerHTML = `
            ${capexSection}

            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">LCOS Breakdown ($/MWh)</div>
                <div class="cost-metric">
                    <span class="label">Lost energy cost</span>
                    <span class="value">$${lcos.lostEnergy.toFixed(1)}</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Capital cost</span>
                    <span class="value">$${lcos.capital.toFixed(1)}</span>
                </div>
                <div class="cost-metric">
                    <span class="label">O&M cost</span>
                    <span class="value">$${lcos.om.toFixed(1)}</span>
                </div>
                <div class="cost-metric" style="border-top:1px solid rgba(0,0,0,0.15);padding-top:4px;font-weight:700;">
                    <span class="label">LCOS Total</span>
                    <span class="value" style="color:#1565c0;">$${lcos.total.toFixed(1)}/MWh</span>
                </div>
            </div>

            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">${isExisting ? 'Infrastructure (Sunk Cost)' : 'Component Costs ($M)'}</div>
                <div class="cost-metric">
                    <span class="label">Reservoirs / Dam</span>
                    <span class="value" style="color:${(isExisting || isExistingRes) ? '#2e7d32' : 'inherit'}">
                        ${(isExisting || isExistingRes) ? 'Existing lake pair' : '$' + comp.reservoirs_M.toFixed(2) + 'M'}
                    </span>
                </div>
                <div class="cost-metric">
                    <span class="label">Tunnel / Penstock</span>
                    <span class="value" style="color:${isExisting ? '#2e7d32' : 'inherit'}">
                        ${isExisting ? 'Existing' : '$' + comp.tunnel_M.toFixed(2) + 'M'}
                    </span>
                </div>
                <div class="cost-metric">
                    <span class="label">Powerhouse</span>
                    <span class="value" style="color:${isExisting ? '#2e7d32' : 'inherit'}">
                        ${isExisting ? 'Existing' : '$' + comp.powerhouse_M.toFixed(2) + 'M'}
                    </span>
                </div>
            </div>

            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">System</div>
                <div class="cost-metric">
                    <span class="label">Power</span>
                    <span class="value">${eng.powerMW} MW</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Storage</span>
                    <span class="value">${eng.energyGWh} GWh / ${fin.hoursAtFullPower}h</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Water volume</span>
                    <span class="value">${eng.totalWaterGL.toFixed(1)} GL</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Reservoir area</span>
                    <span class="value">${eng.upperAreaHa.toFixed(0)} ha</span>
                </div>
                <div class="cost-metric">
                    <span class="label">W:R ratio</span>
                    <span class="value">${eng.waterRockRatio}</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Region factor</span>
                    <span class="value">${eng.country} (${eng.regionFactor}x)</span>
                </div>
            </div>

            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">Financial Parameters</div>
                <div class="cost-metric">
                    <span class="label">Discount rate (real)</span>
                    <span class="value">${(fin.realDiscount * 100).toFixed(1)}%</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cycles / year</span>
                    <span class="value">${fin.cyclesPerYear}</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Energy buy price</span>
                    <span class="value">$${fin.energyPrice}/MWh</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Annual O&M</span>
                    <span class="value">$${(fin.fixedOM_M + fin.variableOM_M).toFixed(2)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Refurb NPV (yr 20+40)</span>
                    <span class="value">$${fin.refurbNPV_M.toFixed(1)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Benchmark (ANU)</span>
                    <span class="value">$${fin.benchmarkCost_M.toFixed(1)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Cost / benchmark</span>
                    <span class="value">${s.costRatio.toFixed(3)}</span>
                </div>
            </div>

            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">vs Lithium Battery</div>
                <div class="cost-metric">
                    <span class="label">Li-ion equiv. cost</span>
                    <span class="value">$${fin.lithiumCost_M.toFixed(0)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">PSH / Li-ion ratio</span>
                    <span class="value" style="color:${fin.costVsLithium < 0.3 ? '#2e7d32' : fin.costVsLithium < 0.6 ? '#ff8f00' : '#c62828'};font-weight:700;">${(fin.costVsLithium * 100).toFixed(1)}%</span>
                </div>
            </div>
        `;

        // Render pie chart and table
        const pieContainer = document.getElementById('cost-pie-chart');
        const tbody = document.querySelector('#cost-breakdown-table tbody');

        if (isExisting) {
            // For existing sites: show "Existing Infrastructure" instead of cost breakdown
            if (pieContainer) {
                pieContainer.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:180px;color:#2e7d32;font-size:13px;font-weight:600;text-align:center;">
                        All civil infrastructure<br>already exists<br>
                        <span style="font-size:10px;font-weight:400;color:#666;display:block;margin-top:4px;">
                            See Scale-Up Analysis for<br>Phase 0/1 investment costs
                        </span>
                    </div>`;
            }
            if (tbody) {
                tbody.innerHTML = '';
                const labels = ['Reservoirs', 'Tunnel / Penstock', 'Powerhouse'];
                const colors = ['#4a90d9', '#e74c3c', '#2ecc71'];
                labels.forEach((name, i) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors[i]};margin-right:6px;vertical-align:middle;"></span>${name}</td>
                        <td style="color:#2e7d32;">Existing</td>
                        <td>\u2014</td>`;
                    tbody.appendChild(tr);
                });
                const totalRow = document.createElement('tr');
                totalRow.className = 'cost-total';
                totalRow.innerHTML = '<td>New Civil CAPEX</td><td style="color:#2e7d32;font-weight:700;">$0</td><td>\u2014</td>';
                tbody.appendChild(totalRow);
            }
        } else {
            if (pieContainer && HB.UI.chartRenderer) {
                HB.UI.chartRenderer.drawPieChart(pieContainer, s.breakdown);
            }
            if (tbody) {
                tbody.innerHTML = '';
                s.breakdown.forEach(item => {
                    const pct = ((item.value / (s.totalCapexM * 1e6)) * 100).toFixed(1);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${item.color};margin-right:6px;vertical-align:middle;"></span>${item.name}</td>
                        <td>$${(item.value / 1e6).toFixed(2)}M</td>
                        <td>${pct}%</td>
                    `;
                    tbody.appendChild(tr);
                });
                const totalRow = document.createElement('tr');
                totalRow.className = 'cost-total';
                totalRow.innerHTML = `<td>Total CAPEX</td><td>$${s.totalCapexM.toFixed(1)}M</td><td>100%</td>`;
                tbody.appendChild(totalRow);
            }
        }
    },

    _renderCostTable(summary) {
        const tbody = document.querySelector('#cost-breakdown-table tbody');
        tbody.innerHTML = '';
        const total = summary.totalCAPEX;
        summary.breakdown.forEach(item => {
            const pct = ((item.value / total) * 100).toFixed(1);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${item.color};margin-right:6px;vertical-align:middle;"></span>${item.name}</td>
                <td>${HB.Utils.formatCurrencyFull(item.value)}</td>
                <td>${pct}%</td>
            `;
            tbody.appendChild(tr);
        });
        const totalRow = document.createElement('tr');
        totalRow.className = 'cost-total';
        totalRow.innerHTML = `<td>Total CAPEX</td><td>${HB.Utils.formatCurrencyFull(total)}</td><td>100%</td>`;
        tbody.appendChild(totalRow);
    },

    _renderSummary(summary) {
        const container = document.getElementById('cost-summary');
        container.innerHTML = `
            <div class="cost-metric">
                <span class="label">Total CAPEX</span>
                <span class="value">${HB.Utils.formatCurrency(summary.totalCAPEX)}</span>
            </div>
            <div class="cost-metric">
                <span class="label">Cost per kW</span>
                <span class="value">${HB.Utils.formatCurrency(summary.costPerKW)}/kW</span>
            </div>
            <div class="cost-metric">
                <span class="label">Cost per kWh stored</span>
                <span class="value">${HB.Utils.formatCurrency(summary.costPerKWh)}/kWh</span>
            </div>
            <div class="cost-metric">
                <span class="label">LCOS (levelized)</span>
                <span class="value">${HB.Utils.formatCurrency(summary.lcos)}/MWh</span>
            </div>
        `;
    }
};
