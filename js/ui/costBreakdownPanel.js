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

        const classColor = s.costClass === 'A' ? '#2e7d32' : s.costClass === 'B' ? '#1565c0' : s.costClass === 'C' ? '#ff8f00' : '#c62828';

        container.innerHTML = `
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
            </div>

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
                <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:6px;">Component Costs ($M)</div>
                <div class="cost-metric">
                    <span class="label">Reservoirs</span>
                    <span class="value">$${comp.reservoirs_M.toFixed(2)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Tunnel / Penstock</span>
                    <span class="value">$${comp.tunnel_M.toFixed(2)}M</span>
                </div>
                <div class="cost-metric">
                    <span class="label">Powerhouse</span>
                    <span class="value">$${comp.powerhouse_M.toFixed(2)}M</span>
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

        // Render pie chart
        const pieContainer = document.getElementById('cost-pie-chart');
        if (pieContainer && HB.UI.chartRenderer) {
            HB.UI.chartRenderer.drawPieChart(pieContainer, s.breakdown);
        }

        // Render table
        const tbody = document.querySelector('#cost-breakdown-table tbody');
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
