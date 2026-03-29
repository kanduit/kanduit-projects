/* ------------------------------------------------------------------ */
/*  FloodApp — Main controller.                                        */
/*  Loads data, wires modules, manages replay state.                   */
/* ------------------------------------------------------------------ */

(function () {
    'use strict';

    var DATA_FILES = {
        municipalities:  'data/municipalities.geojson',
        gaugeStations:   'data/gauge_stations.geojson',
        gaugeReadings:   'data/gauge_readings.json',
        precipitation:   'data/precipitation.json',
        eventTimeline:   'data/event_timeline.json',
        populationGrid:  'data/population_grid.json',
        riskScores:      'data/risk_scores.json',
    };

    var state = {
        data: {},
        selectedMunicipality: null,
        currentIndex: 0,
        isPlaying: false,
        replaySpeed: 1,
        intervalId: null,
        totalSteps: 0,
    };

    /* -- Data Loading ---------------------------------------------- */

    function loadAll() {
        var keys = Object.keys(DATA_FILES);
        var promises = keys.map(function (key) {
            return fetch(DATA_FILES[key])
                .then(function (r) {
                    if (!r.ok) throw new Error('Failed to load ' + DATA_FILES[key]);
                    return r.json();
                })
                .then(function (json) {
                    state.data[key] = json;
                });
        });
        return Promise.all(promises);
    }

    /* -- Initialization -------------------------------------------- */

    function initApp() {
        var firstStationId = Object.keys(state.data.gaugeReadings)[0];
        state.totalSteps = state.data.gaugeReadings[firstStationId].length;

        populateMunicipalitySelect();
        buildEventLog();

        FloodMap.init('map', state.data, onMunicipalitySelected);
        FloodTimeline.init('timeline-chart', state.data);
        FloodScenario.init(state.data);

        bindControls();
        updateTimeDisplay();
        updateEventHighlights();
    }

    /* -- Municipality Select --------------------------------------- */

    function populateMunicipalitySelect() {
        var select = document.getElementById('municipality-select');
        state.data.riskScores.forEach(function (r) {
            var opt = document.createElement('option');
            opt.value = r.name;
            opt.textContent = r.name + ' (risk: ' + r.risk_score + ')';
            select.appendChild(opt);
        });
        select.addEventListener('change', function () {
            onMunicipalitySelected(this.value || null);
        });
    }

    function onMunicipalitySelected(name) {
        state.selectedMunicipality = name;
        document.getElementById('municipality-select').value = name || '';

        FloodMap.highlightMunicipality(name);

        var gaugeId = name
            ? FloodMap.getGaugeForMunicipality(name)
            : 'AHR_ALTENAHR';

        FloodTimeline.setStation(gaugeId);
        FloodScenario.setStation(gaugeId);

        var stationFeature = state.data.gaugeStations.features.find(
            function (f) { return f.properties.station_id === gaugeId; }
        );
        var label = stationFeature
            ? stationFeature.properties.name + ' (' + stationFeature.properties.river + ')'
            : 'All Stations';
        document.getElementById('timeline-label').textContent = label;

        updateStatusBadge();
    }

    /* -- Event Log ------------------------------------------------- */

    function buildEventLog() {
        var container = document.getElementById('event-log');
        var html = '';
        state.data.eventTimeline.forEach(function (evt, i) {
            var d = new Date(evt.timestamp);
            var timeStr = 'Jul ' + d.getUTCDate() + ' ' +
                String(d.getUTCHours()).padStart(2, '0') + ':' +
                String(d.getUTCMinutes()).padStart(2, '0');

            html += '<div class="event-entry sev-' + evt.severity + '" data-index="' + i + '" data-ts="' + evt.timestamp + '">';
            html += '<div><span class="event-time">' + timeStr + '</span>';
            html += '<span class="event-source">' + evt.source + '</span></div>';
            html += '<div class="event-title">' + evt.title + '</div>';
            html += '<div class="event-desc">' + evt.description + '</div>';
            html += '</div>';
        });
        container.innerHTML = html;
        document.getElementById('event-counter').textContent = state.data.eventTimeline.length + ' events';
    }

    function updateEventHighlights() {
        var readings = state.data.gaugeReadings['AHR_ALTENAHR'];
        if (!readings || !readings[state.currentIndex]) return;
        var currentTs = new Date(readings[state.currentIndex].timestamp).getTime();

        var entries = document.querySelectorAll('.event-entry');
        var lastActive = null;
        entries.forEach(function (el) {
            var evtTs = new Date(el.getAttribute('data-ts')).getTime();
            if (evtTs <= currentTs) {
                el.classList.remove('future');
                el.classList.remove('active');
                lastActive = el;
            } else {
                el.classList.add('future');
                el.classList.remove('active');
            }
        });
        if (lastActive) {
            lastActive.classList.add('active');
            lastActive.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /* -- Status Badge ---------------------------------------------- */

    function updateStatusBadge() {
        var badge = document.getElementById('status-indicator');
        var gaugeId = state.selectedMunicipality
            ? FloodMap.getGaugeForMunicipality(state.selectedMunicipality)
            : 'AHR_ALTENAHR';

        var readings = state.data.gaugeReadings[gaugeId];
        if (!readings || !readings[state.currentIndex]) return;

        var level = readings[state.currentIndex].level_cm;
        var station = state.data.gaugeStations.features.find(
            function (f) { return f.properties.station_id === gaugeId; }
        );
        if (!station) return;

        var props = station.properties;
        badge.className = 'status-badge';
        if (level >= props.critical_level_cm) {
            badge.classList.add('status-critical');
            badge.textContent = 'CRITICAL';
        } else if (level >= props.warning_level_cm) {
            badge.classList.add('status-warning');
            badge.textContent = 'WARNING';
        } else {
            badge.classList.add('status-normal');
            badge.textContent = 'NORMAL';
        }
    }

    /* -- Time Display ---------------------------------------------- */

    function updateTimeDisplay() {
        var readings = state.data.gaugeReadings['AHR_ALTENAHR'];
        if (!readings || !readings[state.currentIndex]) return;
        var d = new Date(readings[state.currentIndex].timestamp);
        var str = d.getUTCFullYear() + '-' +
            String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(d.getUTCDate()).padStart(2, '0') + ' ' +
            String(d.getUTCHours()).padStart(2, '0') + ':' +
            String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
        document.getElementById('time-value').textContent = str;
    }

    /* -- Replay Engine --------------------------------------------- */

    function bindControls() {
        document.getElementById('btn-play').addEventListener('click', togglePlay);
        document.getElementById('btn-restart').addEventListener('click', restart);
        document.getElementById('btn-step').addEventListener('click', stepForward);
        document.getElementById('replay-speed').addEventListener('change', function () {
            state.replaySpeed = parseFloat(this.value);
            if (state.isPlaying) {
                clearInterval(state.intervalId);
                state.intervalId = setInterval(tick, 500 / state.replaySpeed);
            }
        });

        document.getElementById('layer-risk').addEventListener('change', function () {
            FloodMap.toggleLayer('risk', this.checked);
        });
        document.getElementById('layer-gauges').addEventListener('change', function () {
            FloodMap.toggleLayer('gauges', this.checked);
        });
        document.getElementById('layer-pop').addEventListener('change', function () {
            FloodMap.toggleLayer('pop', this.checked);
        });

        window.addEventListener('resize', function () { FloodMap.resize(); });
    }

    function togglePlay() {
        state.isPlaying = !state.isPlaying;
        var btn = document.getElementById('btn-play');
        if (state.isPlaying) {
            btn.textContent = '\u23F8';
            btn.classList.add('active');
            state.intervalId = setInterval(tick, 500 / state.replaySpeed);
        } else {
            btn.textContent = '\u25B6';
            btn.classList.remove('active');
            clearInterval(state.intervalId);
        }
    }

    function restart() {
        state.currentIndex = 0;
        updateAll();
        if (state.isPlaying) {
            clearInterval(state.intervalId);
            state.isPlaying = false;
            document.getElementById('btn-play').textContent = '\u25B6';
            document.getElementById('btn-play').classList.remove('active');
        }
    }

    function stepForward() {
        if (state.currentIndex < state.totalSteps - 1) {
            state.currentIndex++;
            updateAll();
        }
    }

    function tick() {
        if (state.currentIndex < state.totalSteps - 1) {
            state.currentIndex++;
            updateAll();
        } else {
            togglePlay();
        }
    }

    function updateAll() {
        updateTimeDisplay();
        FloodMap.updateGauges(state.currentIndex);
        FloodTimeline.setPlayhead(state.currentIndex);
        updateEventHighlights();
        updateStatusBadge();
    }

    /* -- Boot ------------------------------------------------------ */

    document.addEventListener('DOMContentLoaded', function () {
        loadAll()
            .then(initApp)
            .catch(function (err) {
                console.error('Failed to load data:', err);
                document.getElementById('event-log').innerHTML =
                    '<p style="color:#ff3b3b;padding:12px">Error loading data files. ' +
                    'Make sure to serve via HTTP (e.g. <code>pixi run serve</code>), ' +
                    'not file://.</p>';
            });
    });

})();
