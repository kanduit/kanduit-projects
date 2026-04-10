/* ------------------------------------------------------------------ */
/*  FloodMap — Leaflet map with risk choropleth, gauge markers,       */
/*  and population density overlay.                                    */
/* ------------------------------------------------------------------ */

window.FloodMap = (function () {
    'use strict';

    let map, municipalityLayer, gaugeLayer, populationLayer;
    let gaugeMarkers = {};
    let data = {};
    let onMunicipalityClick = null;

    const MUNICIPALITY_TO_GAUGE = {
        'Schuld':                   'AHR_SCHULD',
        'Insul':                    'AHR_MUESCH',
        'Altenahr':                 'AHR_ALTENAHR',
        'Mayschoß':                 'AHR_ALTENAHR',
        'Dernau':                   'AHR_DERNAU',
        'Bad Neuenahr-Ahrweiler':   'AHR_BODENDORF',
        'Sinzig':                   'AHR_BODENDORF',
        'Blankenheim':              'AHR_MUESCH',
        'Euskirchen':               'ERFT_BLIESHEIM',
        'Swisttal':                 'ERFT_BLIESHEIM',
        'Erftstadt':                'ERFT_BLIESHEIM',
        'Weilerswist':              'ERFT_BLIESHEIM',
        'Rheinbach':                'ERFT_BLIESHEIM',
        'Stolberg':                 'ERFT_BLIESHEIM',
    };

    function riskColor(score) {
        if (score >= 70) return '#ff3b3b';
        if (score >= 50) return '#ff8c00';
        if (score >= 30) return '#ffb800';
        return '#00e676';
    }

    function riskFill(score) {
        const c = riskColor(score);
        return c + '55';
    }

    function gaugeColor(level, station) {
        if (level >= station.critical_level_cm) return '#ff3b3b';
        if (level >= station.warning_level_cm) return '#ffb800';
        return '#00e676';
    }

    function init(containerId, appData, clickCallback) {
        data = appData;
        onMunicipalityClick = clickCallback;

        map = L.map(containerId, {
            zoomControl: true,
            attributionControl: false,
        }).setView([50.50, 6.95], 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            subdomains: 'abcd',
        }).addTo(map);

        L.control.attribution({ prefix: false, position: 'bottomright' })
            .addAttribution('&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/">OSM</a>')
            .addTo(map);

        buildMunicipalityLayer();
        buildGaugeLayer();
        buildPopulationLayer();

        setTimeout(() => map.invalidateSize(), 200);
    }

    function buildMunicipalityLayer() {
        const riskMap = {};
        data.riskScores.forEach(r => { riskMap[r.name] = r.risk_score; });

        municipalityLayer = L.geoJSON(data.municipalities, {
            style: function (feature) {
                const score = riskMap[feature.properties.name] || 0;
                return {
                    color: riskColor(score),
                    weight: 1.5,
                    fillColor: riskFill(score),
                    fillOpacity: 0.35,
                };
            },
            onEachFeature: function (feature, layer) {
                const p = feature.properties;
                const score = riskMap[p.name] || 0;
                layer.bindPopup(
                    `<h4>${p.name}</h4>` +
                    `<div class="gauge-popup-stat"><span class="gauge-popup-label">Population</span><span class="gauge-popup-value">${p.population.toLocaleString()}</span></div>` +
                    `<div class="gauge-popup-stat"><span class="gauge-popup-label">Elevation</span><span class="gauge-popup-value">${p.elevation_avg_m} m</span></div>` +
                    `<div class="gauge-popup-stat"><span class="gauge-popup-label">River</span><span class="gauge-popup-value">${p.river}</span></div>` +
                    `<div class="gauge-popup-stat"><span class="gauge-popup-label">Risk Score</span><span class="gauge-popup-value" style="color:${riskColor(score)}">${score}/100</span></div>`
                );
                layer.on('click', function () {
                    if (onMunicipalityClick) onMunicipalityClick(p.name);
                });
            },
        }).addTo(map);
    }

    function buildGaugeLayer() {
        gaugeLayer = L.layerGroup().addTo(map);

        data.gaugeStations.features.forEach(function (f) {
            const p = f.properties;
            const coords = f.geometry.coordinates;
            const marker = L.circleMarker([coords[1], coords[0]], {
                radius: 8,
                color: '#00e676',
                fillColor: '#00e67644',
                fillOpacity: 0.8,
                weight: 2,
            });

            marker.bindPopup(buildGaugePopup(p, p.normal_level_cm));
            marker.stationId = p.station_id;
            marker.stationProps = p;
            gaugeMarkers[p.station_id] = marker;
            gaugeLayer.addLayer(marker);
        });
    }

    function buildGaugePopup(p, currentLevel) {
        const color = gaugeColor(currentLevel, p);
        return (
            `<h4>${p.name} (${p.river})</h4>` +
            `<div class="gauge-popup-stat"><span class="gauge-popup-label">Current</span><span class="gauge-popup-value" style="color:${color}">${currentLevel.toFixed(0)} cm</span></div>` +
            `<div class="gauge-popup-stat"><span class="gauge-popup-label">Normal</span><span class="gauge-popup-value">${p.normal_level_cm} cm</span></div>` +
            `<div class="gauge-popup-stat"><span class="gauge-popup-label">Warning</span><span class="gauge-popup-value" style="color:#ffb800">${p.warning_level_cm} cm</span></div>` +
            `<div class="gauge-popup-stat"><span class="gauge-popup-label">Critical</span><span class="gauge-popup-value" style="color:#ff3b3b">${p.critical_level_cm} cm</span></div>`
        );
    }

    function buildPopulationLayer() {
        populationLayer = L.layerGroup().addTo(map);
        const maxPop = Math.max(...data.populationGrid.map(p => p.population));

        data.populationGrid.forEach(function (p) {
            const radius = 4 + 18 * (p.population / maxPop);
            const circle = L.circleMarker([p.lat, p.lon], {
                radius: radius,
                color: 'transparent',
                fillColor: '#00d4ff',
                fillOpacity: 0.12,
                interactive: false,
            });
            populationLayer.addLayer(circle);
        });
    }

    function updateGauges(timestampIndex) {
        Object.keys(gaugeMarkers).forEach(function (sid) {
            const marker = gaugeMarkers[sid];
            const readings = data.gaugeReadings[sid];
            if (!readings || !readings[timestampIndex]) return;

            const level = readings[timestampIndex].level_cm;
            const color = gaugeColor(level, marker.stationProps);
            marker.setStyle({ color: color, fillColor: color + '44' });
            marker.setRadius(level > marker.stationProps.critical_level_cm ? 12 : 8);
            marker.setPopupContent(buildGaugePopup(marker.stationProps, level));
        });
    }

    function highlightMunicipality(name) {
        if (!municipalityLayer) return;
        const riskMap = {};
        data.riskScores.forEach(r => { riskMap[r.name] = r.risk_score; });

        municipalityLayer.eachLayer(function (layer) {
            const n = layer.feature.properties.name;
            const score = riskMap[n] || 0;
            if (n === name) {
                layer.setStyle({ weight: 3, color: '#00d4ff', fillOpacity: 0.5 });
                layer.bringToFront();
            } else {
                layer.setStyle({
                    weight: 1.5,
                    color: riskColor(score),
                    fillOpacity: 0.35,
                });
            }
        });
    }

    function toggleLayer(layerName, visible) {
        const layers = { risk: municipalityLayer, gauges: gaugeLayer, pop: populationLayer };
        const layer = layers[layerName];
        if (!layer) return;
        if (visible) map.addLayer(layer);
        else map.removeLayer(layer);
    }

    function getGaugeForMunicipality(name) {
        return MUNICIPALITY_TO_GAUGE[name] || 'AHR_ALTENAHR';
    }

    function resize() {
        if (map) map.invalidateSize();
    }

    return {
        init: init,
        updateGauges: updateGauges,
        highlightMunicipality: highlightMunicipality,
        toggleLayer: toggleLayer,
        getGaugeForMunicipality: getGaugeForMunicipality,
        resize: resize,
    };
})();
