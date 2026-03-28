/**
 * Search Panel - handles search UI interactions
 */
HB.UI = HB.UI || {};

HB.UI.searchPanel = {
    init() {
        this._setupTabs();
        this._setupConfigButtons();
        this._setupEnergySlider();
        this._setupLocationSearch();
        this._setupSearchButton();
        this._setupUnitToggle();
        this._setupModals();
    },

    _setupTabs() {
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            });
        });
    },

    _setupConfigButtons() {
        document.querySelectorAll('.config-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.config-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                HB.State.selectedConfig = btn.dataset.config;
            });
        });
    },

    _setupEnergySlider() {
        const slider = document.getElementById('energy-slider');
        const valueEl = document.getElementById('energy-value');
        const unitEl = document.getElementById('energy-unit');

        const updateDisplay = () => {
            const rawKWh = Math.pow(10, parseFloat(slider.value));
            let displayValue, displayUnit;

            if (rawKWh >= 1e9) {
                displayValue = rawKWh / 1e9;
                displayUnit = 'TWh';
            } else if (rawKWh >= 1e6) {
                displayValue = rawKWh / 1e6;
                displayUnit = 'GWh';
            } else if (rawKWh >= 1e3) {
                displayValue = rawKWh / 1e3;
                displayUnit = 'MWh';
            } else {
                displayValue = rawKWh;
                displayUnit = 'kWh';
            }

            valueEl.textContent = displayValue >= 100 ? Math.round(displayValue) :
                                  displayValue >= 10 ? displayValue.toFixed(1) :
                                  displayValue.toFixed(2);
            unitEl.value = displayUnit;
        };

        slider.addEventListener('input', updateDisplay);

        unitEl.addEventListener('change', () => {
            // When unit changes, adjust slider to match
            const currentKWh = Math.pow(10, parseFloat(slider.value));
            const currentInNewUnit = currentKWh / HB.Config.UNITS.energy[unitEl.value];
            valueEl.textContent = currentInNewUnit >= 100 ? Math.round(currentInNewUnit) :
                                  currentInNewUnit >= 10 ? currentInNewUnit.toFixed(1) :
                                  currentInNewUnit.toFixed(2);
        });

        updateDisplay();
    },

    _setupLocationSearch() {
        const input = document.getElementById('location-search');
        const suggestions = document.getElementById('search-suggestions');
        let debounceTimer;

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = input.value.trim();
            if (query.length < 3) {
                suggestions.classList.add('hidden');
                return;
            }

            debounceTimer = setTimeout(async () => {
                // Check if it's coordinates (lat, lng)
                const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
                if (coordMatch) {
                    const lat = parseFloat(coordMatch[1]);
                    const lng = parseFloat(coordMatch[2]);
                    HB.Map.flyTo(lat, lng, 10);
                    suggestions.classList.add('hidden');
                    return;
                }

                // Geocode with Nominatim
                try {
                    const url = `${HB.Config.GEOCODING_API}?format=json&q=${encodeURIComponent(query)}&limit=5`;
                    const resp = await fetch(url, {
                        headers: { 'Accept': 'application/json' }
                    });
                    const results = await resp.json();

                    if (results.length === 0) {
                        suggestions.classList.add('hidden');
                        return;
                    }

                    suggestions.innerHTML = '';
                    results.forEach(r => {
                        const div = document.createElement('div');
                        div.className = 'search-suggestion';
                        div.innerHTML = `
                            <div class="suggestion-name">${r.display_name.split(',')[0]}</div>
                            <div class="suggestion-detail">${r.display_name}</div>
                        `;
                        div.addEventListener('click', () => {
                            HB.Map.flyTo(parseFloat(r.lat), parseFloat(r.lon), 11);
                            input.value = r.display_name.split(',')[0];
                            suggestions.classList.add('hidden');
                        });
                        suggestions.appendChild(div);
                    });
                    suggestions.classList.remove('hidden');
                } catch (e) {
                    console.error('Geocoding error:', e);
                }
            }, 400);
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                suggestions.classList.add('hidden');
            }
        });

        // Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstSuggestion = suggestions.querySelector('.search-suggestion');
                if (firstSuggestion) firstSuggestion.click();
            }
        });
    },

    _setupSearchButton() {
        document.getElementById('btn-find-sites').addEventListener('click', async () => {
            const center = HB.Map.getCenter();
            const filters = HB.SearchFilters.fromUI();

            // Show search area
            HB.Map.showSearchArea(center.lat, center.lng, filters.searchRadiusM);

            // Show progress
            const progressContainer = document.getElementById('search-progress');
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            progressContainer.classList.remove('hidden');

            const btn = document.getElementById('btn-find-sites');
            btn.disabled = true;
            btn.textContent = 'Searching...';

            try {
                const results = await HB.Search.run(
                    center.lat, center.lng, filters,
                    (phase, pct, msg) => {
                        progressFill.style.width = `${Math.min(100, (phase - 1) * 25 + pct * 0.25)}%`;
                        progressText.textContent = msg;
                    }
                );

                HB.State.searchResults = results;

                if (results.length > 0) {
                    HB.Markers.showSearchResults(results);
                    HB.UI.resultsPanel.showResults(results);
                    HB.Utils.showToast(`Found ${results.length} potential sites`);
                } else {
                    HB.Utils.showToast('No suitable sites found. Try adjusting parameters.');
                    HB.UI.resultsPanel.showNoResults();
                }
            } catch (e) {
                console.error('Search error:', e);
                HB.Utils.showToast('Search error: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 1.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
                </svg> Find HydroBattery Sites`;
                progressContainer.classList.add('hidden');
            }
        });
    },

    _setupUnitToggle() {
        document.getElementById('btn-metric').addEventListener('click', () => {
            HB.State.units = 'metric';
            document.getElementById('btn-metric').classList.add('active');
            document.getElementById('btn-imperial').classList.remove('active');
        });
        document.getElementById('btn-imperial').addEventListener('click', () => {
            HB.State.units = 'imperial';
            document.getElementById('btn-imperial').classList.add('active');
            document.getElementById('btn-metric').classList.remove('active');
        });
    },

    _setupModals() {
        // Help modal
        document.getElementById('btn-help').addEventListener('click', () => {
            document.getElementById('help-modal').classList.remove('hidden');
        });

        // Settings modal
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('hidden');
        });

        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.add('hidden');
            });
        });

        // Close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        });

        // Settings changes
        document.getElementById('setting-map-tiles').addEventListener('change', (e) => {
            HB.Map.setTileLayer(e.target.value);
        });

        document.getElementById('setting-currency').addEventListener('change', (e) => {
            HB.State.currency = e.target.value;
        });

        document.getElementById('setting-discount-rate').addEventListener('change', (e) => {
            HB.State.discountRate = parseFloat(e.target.value) / 100;
        });

        document.getElementById('setting-construction-years').addEventListener('change', (e) => {
            HB.State.constructionYears = parseInt(e.target.value);
        });

        document.getElementById('setting-show-elevation').addEventListener('change', (e) => {
            HB.State.showElevation = e.target.checked;
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.getElementById('left-panel').classList.toggle('collapsed');
        });
    }
};
