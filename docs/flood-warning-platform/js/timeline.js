/* ------------------------------------------------------------------ */
/*  FloodTimeline — Chart.js dual-axis timeline with event annotations */
/*  and a moving playhead.                                             */
/* ------------------------------------------------------------------ */

window.FloodTimeline = (function () {
    'use strict';

    let chart = null;
    let data = {};
    let currentStationId = 'AHR_ALTENAHR';
    let playheadIndex = 0;

    const SEVERITY_COLORS = {
        low:      '#00e676',
        medium:   '#ffb800',
        high:     '#ff8c00',
        critical: '#ff3b3b',
    };

    function formatLabel(iso) {
        const d = new Date(iso);
        const day = d.getUTCDate();
        const hour = String(d.getUTCHours()).padStart(2, '0');
        return `Jul ${day} ${hour}:00`;
    }

    function buildAnnotations(events, labels) {
        const annotations = {};

        events.forEach(function (evt, i) {
            const evtDate = new Date(evt.timestamp).getTime();
            let closest = 0;
            let closestDiff = Infinity;
            labels.forEach(function (lbl, idx) {
                const diff = Math.abs(new Date(data.gaugeReadings[currentStationId][idx].timestamp).getTime() - evtDate);
                if (diff < closestDiff) { closestDiff = diff; closest = idx; }
            });

            annotations['evt_' + i] = {
                type: 'line',
                xMin: closest,
                xMax: closest,
                borderColor: SEVERITY_COLORS[evt.severity] || '#ffffff',
                borderWidth: 1,
                borderDash: [4, 3],
                label: {
                    display: true,
                    content: evt.source,
                    position: 'start',
                    backgroundColor: SEVERITY_COLORS[evt.severity] || '#ffffff',
                    color: '#000',
                    font: { size: 8, family: "'JetBrains Mono', monospace", weight: '600' },
                    padding: { top: 2, bottom: 2, left: 4, right: 4 },
                    borderRadius: 2,
                },
            };
        });

        annotations['playhead'] = {
            type: 'line',
            xMin: playheadIndex,
            xMax: playheadIndex,
            borderColor: '#ffffff',
            borderWidth: 2,
            borderDash: [],
        };

        return annotations;
    }

    function init(canvasId, appData) {
        data = appData;
        const ctx = document.getElementById(canvasId).getContext('2d');
        const readings = data.gaugeReadings[currentStationId];
        const labels = readings.map(r => formatLabel(r.timestamp));
        const gaugeLevels = readings.map(r => r.level_cm);
        const precipData = data.precipitation.map(p => p.precipitation_mm_h);

        const station = data.gaugeStations.features.find(
            f => f.properties.station_id === currentStationId
        );
        const warnLevel = station ? station.properties.warning_level_cm : 200;
        const critLevel = station ? station.properties.critical_level_cm : 400;

        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Gauge Level (cm)',
                        type: 'line',
                        data: gaugeLevels,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'yGauge',
                        order: 1,
                    },
                    {
                        label: 'Precipitation (mm/h)',
                        data: precipData,
                        backgroundColor: 'rgba(100, 160, 255, 0.35)',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        yAxisID: 'yPrecip',
                        order: 2,
                        barPercentage: 1.0,
                        categoryPercentage: 1.0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#5a6f8a',
                            font: { size: 10, family: "'Inter', sans-serif" },
                            boxWidth: 12,
                            padding: 8,
                        },
                    },
                    tooltip: {
                        backgroundColor: '#0d1320',
                        titleColor: '#c8d6e5',
                        bodyColor: '#c8d6e5',
                        borderColor: '#1a2744',
                        borderWidth: 1,
                        titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
                        bodyFont: { family: "'Inter', sans-serif", size: 11 },
                        padding: 8,
                    },
                    annotation: {
                        annotations: Object.assign(
                            buildAnnotations(data.eventTimeline, labels),
                            {
                                warnBand: {
                                    type: 'box',
                                    yMin: warnLevel,
                                    yMax: critLevel,
                                    yScaleID: 'yGauge',
                                    backgroundColor: 'rgba(255, 184, 0, 0.06)',
                                    borderWidth: 0,
                                },
                                critBand: {
                                    type: 'box',
                                    yMin: critLevel,
                                    yMax: 800,
                                    yScaleID: 'yGauge',
                                    backgroundColor: 'rgba(255, 59, 59, 0.06)',
                                    borderWidth: 0,
                                },
                                warnLine: {
                                    type: 'line',
                                    yMin: warnLevel,
                                    yMax: warnLevel,
                                    yScaleID: 'yGauge',
                                    borderColor: 'rgba(255, 184, 0, 0.4)',
                                    borderWidth: 1,
                                    borderDash: [6, 4],
                                },
                                critLine: {
                                    type: 'line',
                                    yMin: critLevel,
                                    yMax: critLevel,
                                    yScaleID: 'yGauge',
                                    borderColor: 'rgba(255, 59, 59, 0.4)',
                                    borderWidth: 1,
                                    borderDash: [6, 4],
                                },
                            }
                        ),
                    },
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(26, 39, 68, 0.5)', lineWidth: 0.5 },
                        ticks: {
                            color: '#5a6f8a',
                            font: { size: 9, family: "'JetBrains Mono', monospace" },
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 20,
                        },
                    },
                    yGauge: {
                        position: 'left',
                        title: { display: true, text: 'Gauge Level (cm)', color: '#5a6f8a', font: { size: 10 } },
                        grid: { color: 'rgba(26, 39, 68, 0.5)', lineWidth: 0.5 },
                        ticks: {
                            color: '#00d4ff',
                            font: { size: 9, family: "'JetBrains Mono', monospace" },
                        },
                        min: 0,
                        suggestedMax: 750,
                    },
                    yPrecip: {
                        position: 'right',
                        title: { display: true, text: 'Precip (mm/h)', color: '#5a6f8a', font: { size: 10 } },
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#6488cc',
                            font: { size: 9, family: "'JetBrains Mono', monospace" },
                        },
                        min: 0,
                        suggestedMax: 50,
                    },
                },
            },
        });
    }

    function setStation(stationId) {
        if (!data.gaugeReadings[stationId]) return;
        currentStationId = stationId;

        const readings = data.gaugeReadings[stationId];
        const labels = readings.map(r => formatLabel(r.timestamp));
        const gaugeLevels = readings.map(r => r.level_cm);

        chart.data.labels = labels;
        chart.data.datasets[0].data = gaugeLevels;

        const station = data.gaugeStations.features.find(
            f => f.properties.station_id === stationId
        );
        if (station) {
            const w = station.properties.warning_level_cm;
            const c = station.properties.critical_level_cm;
            const ann = chart.options.plugins.annotation.annotations;
            ann.warnBand.yMin = w;
            ann.warnBand.yMax = c;
            ann.critBand.yMin = c;
            ann.warnLine.yMin = w;
            ann.warnLine.yMax = w;
            ann.critLine.yMin = c;
            ann.critLine.yMax = c;
        }

        chart.update('none');
    }

    function setPlayhead(index) {
        playheadIndex = index;
        if (!chart) return;
        const ann = chart.options.plugins.annotation.annotations;
        ann.playhead.xMin = index;
        ann.playhead.xMax = index;
        chart.update('none');
    }

    function addScenarioAnnotations(alertIndex, evacIndex) {
        if (!chart) return;
        const ann = chart.options.plugins.annotation.annotations;

        if (alertIndex !== null && alertIndex >= 0) {
            ann['scenarioAlert'] = {
                type: 'line',
                xMin: alertIndex,
                xMax: alertIndex,
                borderColor: '#00e676',
                borderWidth: 2,
                borderDash: [8, 4],
                label: {
                    display: true,
                    content: 'AUTO-ALERT',
                    position: 'end',
                    backgroundColor: '#00e676',
                    color: '#000',
                    font: { size: 8, family: "'JetBrains Mono', monospace", weight: '700' },
                    padding: { top: 2, bottom: 2, left: 4, right: 4 },
                    borderRadius: 2,
                },
            };
        } else {
            delete ann['scenarioAlert'];
        }

        if (evacIndex !== null && evacIndex >= 0) {
            ann['scenarioEvac'] = {
                type: 'line',
                xMin: evacIndex,
                xMax: evacIndex,
                borderColor: '#00d4ff',
                borderWidth: 2,
                borderDash: [8, 4],
                label: {
                    display: true,
                    content: 'AUTO-EVACUATE',
                    position: 'end',
                    backgroundColor: '#00d4ff',
                    color: '#000',
                    font: { size: 8, family: "'JetBrains Mono', monospace", weight: '700' },
                    padding: { top: 2, bottom: 2, left: 4, right: 4 },
                    borderRadius: 2,
                },
            };
        } else {
            delete ann['scenarioEvac'];
        }

        chart.update('none');
    }

    function clearScenarioAnnotations() {
        if (!chart) return;
        const ann = chart.options.plugins.annotation.annotations;
        delete ann['scenarioAlert'];
        delete ann['scenarioEvac'];
        chart.update('none');
    }

    return {
        init: init,
        setStation: setStation,
        setPlayhead: setPlayhead,
        addScenarioAnnotations: addScenarioAnnotations,
        clearScenarioAnnotations: clearScenarioAnnotations,
    };
})();
