/* ------------------------------------------------------------------ */
/*  FloodScenario — What-if threshold engine.                          */
/*  Calculates when automated alerts would have fired and compares     */
/*  against the actual evacuation timeline.                            */
/* ------------------------------------------------------------------ */

window.FloodScenario = (function () {
    'use strict';

    let data = {};
    let currentStationId = 'AHR_ALTENAHR';

    // Actual first public warning: Katwarn at 2021-07-14T01:09Z
    const ACTUAL_EVACUATION_ISO = '2021-07-14T01:09:00Z';
    const ACTUAL_EVACUATION_MS = new Date(ACTUAL_EVACUATION_ISO).getTime();

    function init(appData) {
        data = appData;

        document.getElementById('thresh-alert').addEventListener('input', onSliderChange);
        document.getElementById('thresh-evac').addEventListener('input', onSliderChange);
    }

    function onSliderChange() {
        var alertVal = parseInt(document.getElementById('thresh-alert').value, 10);
        var evacVal = parseInt(document.getElementById('thresh-evac').value, 10);
        document.getElementById('val-alert').textContent = alertVal + ' cm';
        document.getElementById('val-evac').textContent = evacVal + ' cm';
        recalculate(alertVal, evacVal);
    }

    function setStation(stationId) {
        if (!data.gaugeReadings[stationId]) return;
        currentStationId = stationId;
        onSliderChange();
    }

    function findFirstExceedance(readings, threshold) {
        for (var i = 0; i < readings.length; i++) {
            if (readings[i].level_cm >= threshold) return i;
        }
        return -1;
    }

    function recalculate(alertThreshold, evacThreshold) {
        var readings = data.gaugeReadings[currentStationId];
        if (!readings) return;

        var alertIdx = findFirstExceedance(readings, alertThreshold);
        var evacIdx = findFirstExceedance(readings, evacThreshold);

        var alertTime = alertIdx >= 0 ? new Date(readings[alertIdx].timestamp) : null;
        var evacTime = evacIdx >= 0 ? new Date(readings[evacIdx].timestamp) : null;

        var resultsEl = document.getElementById('scenario-results');
        var html = '';

        if (alertTime) {
            var alertDeltaH = (ACTUAL_EVACUATION_MS - alertTime.getTime()) / 3600000;
            html += '<div class="scenario-delta">';
            if (alertDeltaH > 0) {
                html += '<span class="delta-hours positive">+' + alertDeltaH.toFixed(1) + 'h</span>';
                html += '<span class="delta-label">earlier warning (vs actual Katwarn at 01:09)</span>';
            } else {
                html += '<span class="delta-hours negative">' + alertDeltaH.toFixed(1) + 'h</span>';
                html += '<span class="delta-label">warning after actual Katwarn</span>';
            }
            html += '</div>';
            html += '<div class="scenario-detail">';
            html += '<strong>Auto-alert</strong> would have fired at <strong>' + formatUTC(alertTime) + '</strong>';
            html += ' when ' + stationName() + ' reached ' + alertThreshold + ' cm.';
            html += '</div>';
        } else {
            html += '<div class="scenario-detail muted">Alert threshold never reached at this station.</div>';
        }

        if (evacTime) {
            var evacDeltaH = (ACTUAL_EVACUATION_MS - evacTime.getTime()) / 3600000;
            html += '<div class="scenario-delta" style="margin-top:8px">';
            if (evacDeltaH > 0) {
                html += '<span class="delta-hours positive">+' + evacDeltaH.toFixed(1) + 'h</span>';
                html += '<span class="delta-label">earlier evacuation trigger</span>';
            } else {
                html += '<span class="delta-hours negative">' + evacDeltaH.toFixed(1) + 'h</span>';
                html += '<span class="delta-label">evacuation after actual Katwarn</span>';
            }
            html += '</div>';
            html += '<div class="scenario-detail">';
            html += '<strong>Auto-evacuate</strong> would have triggered at <strong>' + formatUTC(evacTime) + '</strong>';
            html += ' when ' + stationName() + ' reached ' + evacThreshold + ' cm.';
            html += '</div>';
        } else {
            html += '<div class="scenario-detail muted" style="margin-top:6px">Evacuation threshold never reached.</div>';
        }

        resultsEl.innerHTML = html;

        if (window.FloodTimeline) {
            window.FloodTimeline.addScenarioAnnotations(alertIdx, evacIdx);
        }
    }

    function stationName() {
        var st = data.gaugeStations.features.find(
            function (f) { return f.properties.station_id === currentStationId; }
        );
        return st ? st.properties.name : currentStationId;
    }

    function formatUTC(d) {
        return 'Jul ' + d.getUTCDate() + ' ' +
            String(d.getUTCHours()).padStart(2, '0') + ':' +
            String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
    }

    return {
        init: init,
        setStation: setStation,
        recalculate: function () { onSliderChange(); },
    };
})();
