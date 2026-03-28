/**
 * Results Panel - displays search results
 */
HB.UI = HB.UI || {};

HB.UI.resultsPanel = {
    init() {
        // Sort results
        document.getElementById('sort-results').addEventListener('change', (e) => {
            this._sortAndDisplay(e.target.value);
        });
    },

    showResults(results) {
        const container = document.getElementById('search-results');
        const list = document.getElementById('results-list');
        const count = document.getElementById('results-count');

        container.classList.remove('hidden');
        count.textContent = `(${results.length})`;
        list.innerHTML = '';

        results.forEach(result => {
            list.appendChild(this._createResultCard(result));
        });
    },

    showNoResults() {
        const container = document.getElementById('search-results');
        const list = document.getElementById('results-list');
        const count = document.getElementById('results-count');

        container.classList.remove('hidden');
        count.textContent = '(0)';
        list.innerHTML = `
            <div class="no-results">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p>No suitable sites found in this area.<br>Try increasing the search radius, lowering the minimum head height, or searching in a more mountainous region.</p>
            </div>
        `;
    },

    _createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.dataset.resultId = result.id;

        const costEst = result.costEstimate;
        card.innerHTML = `
            <div class="result-card-header">
                <span class="result-card-title">${result.name}</span>
                <span class="result-card-rank">#${result.rank}</span>
            </div>
            <div class="result-card-stats">
                <div class="result-stat">
                    <span class="label">Head</span>
                    <span class="value">${Math.round(result.headHeight)}m</span>
                </div>
                <div class="result-stat">
                    <span class="label">Tunnel</span>
                    <span class="value">${(result.tunnelLength / 1000).toFixed(1)}km</span>
                </div>
                <div class="result-stat">
                    <span class="label">Volume</span>
                    <span class="value">${HB.Utils.formatVolume(result.volume)}</span>
                </div>
                <div class="result-stat">
                    <span class="label">Upper Elev</span>
                    <span class="value">${Math.round(result.upper.elevation)}m</span>
                </div>
            </div>
            <div class="result-card-cost">
                <span class="total">${HB.Utils.formatCurrency(costEst.totalCAPEX)}</span>
                <span class="per-kwh">${HB.Utils.formatCurrency(costEst.costPerKWh)}/kWh</span>
            </div>
        `;

        card.addEventListener('click', () => {
            // Highlight on map
            HB.Markers.highlightResult(result);

            // Mark active
            document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            // Run full cost calculation and show detail
            const fullCost = HB.Cost.engine.calculate({
                headHeight: result.headHeight,
                tunnelLength: result.tunnelLength,
                energyKWh: result.energyKWh,
                powerKW: result.powerKW,
                configuration: result.configuration,
                efficiency: result.efficiency
            });

            const siteDetail = {
                ...result,
                costResult: fullCost,
                status: 'search_result'
            };

            HB.Events.emit('showSiteDetail', siteDetail);
        });

        return card;
    },

    _sortAndDisplay(sortBy) {
        const results = [...HB.State.searchResults];

        switch (sortBy) {
            case 'cost_per_kwh':
                results.sort((a, b) => a.costEstimate.costPerKWh - b.costEstimate.costPerKWh);
                break;
            case 'total_cost':
                results.sort((a, b) => a.costEstimate.totalCAPEX - b.costEstimate.totalCAPEX);
                break;
            case 'head_height':
                results.sort((a, b) => b.headHeight - a.headHeight);
                break;
            case 'distance':
                results.sort((a, b) => a.tunnelLength - b.tunnelLength);
                break;
        }

        results.forEach((r, i) => r.rank = i + 1);
        this.showResults(results);
    }
};
