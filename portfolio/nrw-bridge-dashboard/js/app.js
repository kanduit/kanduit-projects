/**
 * App module: data loading, event coordination between map, list, and detail panel.
 */
(async function () {
    'use strict';

    const NF = new Intl.NumberFormat('de-DE');

    // Init map
    BridgeMap.init('map');

    // Load data
    let geojson, top50;
    try {
        const [geoRes, topRes] = await Promise.all([
            fetch('data/bridges.geojson'),
            fetch('data/top50.json'),
        ]);
        geojson = await geoRes.json();
        top50 = await topRes.json();
    } catch (err) {
        document.getElementById('loading-overlay').innerHTML =
            `<p style="color:#d73027">Fehler beim Laden der Daten.<br>Bitte stellen Sie sicher, dass die Anwendung über einen HTTP-Server ausgeliefert wird.<br><code>python -m http.server</code></p>`;
        return;
    }

    const features = geojson.features;

    // Update header stats
    const risks = features.map(f => f.properties.risiko_score);
    document.getElementById('stat-total').textContent = NF.format(features.length);
    document.getElementById('stat-critical').textContent = NF.format(risks.filter(r => r >= 0.6).length);
    document.getElementById('stat-warning').textContent = NF.format(risks.filter(r => r >= 0.4).length);

    // Load markers
    BridgeMap.loadBridges(features);

    // Build top 50 list
    renderTop50(top50);

    // Wire up map bridge selection
    BridgeMap.onSelect((props) => {
        showDetail(props);
        switchTab('details');
    });

    // Wire up filters
    BridgeFilters.init((filterFn) => {
        const visibleCount = BridgeMap.applyFilter(filterFn);
        document.getElementById('filter-count').textContent = `${NF.format(visibleCount)} von ${NF.format(features.length)} Brücken`;
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Hide loading overlay
    document.getElementById('loading-overlay').classList.add('hidden');

    // ---- Top 50 List ----
    function renderTop50(data) {
        const listEl = document.getElementById('top50-list');
        listEl.innerHTML = '';

        for (const bridge of data) {
            const row = document.createElement('div');
            row.className = 'top50-row';
            row.dataset.bridgeId = bridge.id;

            const riskColor = BridgeMap.getRiskColor(bridge.risiko_score);

            row.innerHTML = `
                <div class="top50-rank" style="background:${riskColor}">${bridge.rang}</div>
                <div class="top50-info">
                    <div class="top50-name" title="${bridge.name}">${bridge.name}</div>
                    <div class="top50-meta">${bridge.strassenklasse} ${bridge.strasse} · Bj. ${bridge.baujahr} · Note ${bridge.zustandsnote}</div>
                </div>
                <div class="top50-score" style="color:${riskColor}">${bridge.risiko_score.toFixed(3)}</div>
            `;

            row.addEventListener('click', () => {
                document.querySelectorAll('.top50-row.active').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                BridgeMap.selectBridgeById(bridge.id);
                showDetailForTop50(bridge);
                switchTab('details');
            });

            listEl.appendChild(row);
        }
    }

    function showDetailForTop50(bridge) {
        const feature = features.find(f => f.properties.id === bridge.id);
        if (feature) {
            showDetail(feature.properties);
        }
    }

    // ---- Detail Panel ----
    function showDetail(props) {
        document.getElementById('detail-empty').style.display = 'none';
        document.getElementById('detail-content').style.display = 'block';

        document.getElementById('detail-name').textContent = props.name;

        const badge = document.getElementById('detail-risk-badge');
        badge.textContent = `Risiko ${props.risiko_score.toFixed(3)}`;
        badge.style.background = BridgeMap.getRiskColor(props.risiko_score);

        document.getElementById('detail-road').textContent = props.road_ref;
        document.getElementById('detail-class').textContent = props.strassenklasse;
        document.getElementById('detail-type').textContent = props.bauwerk_typ;
        document.getElementById('detail-year').textContent = props.baujahr;
        document.getElementById('detail-grade').textContent = props.zustandsnote.toFixed(1);
        document.getElementById('detail-traffic').textContent = NF.format(props.verkehr_dtv) + ' Fz./Tag';
        document.getElementById('detail-capacity').textContent = props.tragfaehigkeit_tonnen + ' t';
        document.getElementById('detail-spans').textContent = props.anzahl_felder;
        document.getElementById('detail-detour').textContent = props.wirtschaftlicher_umweg_km + ' km';
        document.getElementById('detail-inspection').textContent = formatDate(props.letzte_pruefung);

        BridgeCharts.renderInspectionChart('chart-inspection', props.pruefungshistorie);
        BridgeCharts.renderInsarChart('chart-insar', props.insar_verschiebung_mm);
    }

    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }

    function formatDate(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
})();
