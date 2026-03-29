/**
 * Map module: Leaflet map with clustered, color-coded bridge markers.
 */
const BridgeMap = (() => {
    let map;
    let clusterGroup;
    let allMarkers = [];
    let selectedMarker = null;
    let onBridgeSelect = null;

    const RISK_COLORS = [
        { max: 0.3, color: '#1a9641' },
        { max: 0.4, color: '#a6d96a' },
        { max: 0.5, color: '#fee08b' },
        { max: 0.6, color: '#f46d43' },
        { max: 1.0, color: '#d73027' },
    ];

    function getRiskColor(score) {
        for (const band of RISK_COLORS) {
            if (score <= band.max) return band.color;
        }
        return '#d73027';
    }

    function init(containerId) {
        map = L.map(containerId, {
            center: [51.43, 7.4],
            zoom: 8,
            minZoom: 7,
            maxZoom: 18,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(map);

        clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function (cluster) {
                const markers = cluster.getAllChildMarkers();
                const avgRisk = markers.reduce((sum, m) => sum + m.options.riskScore, 0) / markers.length;
                const color = getRiskColor(avgRisk);
                const size = markers.length < 100 ? 36 : markers.length < 500 ? 44 : 52;
                return L.divIcon({
                    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${size < 40 ? 11 : 13}px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.8)">${markers.length}</div>`,
                    className: 'custom-cluster',
                    iconSize: L.point(size, size),
                });
            },
        });

        map.addLayer(clusterGroup);
        return map;
    }

    function loadBridges(geojsonFeatures) {
        allMarkers = [];
        clusterGroup.clearLayers();

        for (const feature of geojsonFeatures) {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            const lat = coords[1];
            const lon = coords[0];
            const risk = props.risiko_score || 0;
            const color = getRiskColor(risk);

            const marker = L.circleMarker([lat, lon], {
                radius: 5,
                fillColor: color,
                color: '#fff',
                weight: 1,
                fillOpacity: 0.85,
                riskScore: risk,
            });

            marker.bridgeProps = props;
            marker.bridgeCoords = [lat, lon];

            marker.bindTooltip(
                `<strong>${props.name}</strong><br/>` +
                `${props.strassenklasse} ${props.road_ref}<br/>` +
                `Risiko: ${risk.toFixed(3)} | Note: ${props.zustandsnote}`,
                { direction: 'top', offset: [0, -6] }
            );

            marker.on('click', () => {
                selectBridge(marker);
            });

            allMarkers.push({ marker, props, coords: [lat, lon] });
        }

        const leafletMarkers = allMarkers.map(m => m.marker);
        clusterGroup.addLayers(leafletMarkers);
    }

    function selectBridge(marker) {
        if (selectedMarker) {
            selectedMarker.setStyle({ weight: 1, color: '#fff', radius: 5 });
        }
        selectedMarker = marker;
        marker.setStyle({ weight: 3, color: '#0984e3', radius: 8 });
        marker.bringToFront();

        if (onBridgeSelect) {
            onBridgeSelect(marker.bridgeProps);
        }
    }

    function selectBridgeById(bridgeId) {
        const entry = allMarkers.find(m => m.props.id === bridgeId);
        if (!entry) return;
        clusterGroup.zoomToShowLayer(entry.marker, () => {
            selectBridge(entry.marker);
            map.setView(entry.coords, Math.max(map.getZoom(), 13));
        });
    }

    function applyFilter(filterFn) {
        clusterGroup.clearLayers();
        const visible = allMarkers.filter(m => filterFn(m.props));
        clusterGroup.addLayers(visible.map(m => m.marker));
        return visible.length;
    }

    function resetView() {
        map.setView([51.43, 7.4], 8);
    }

    function onSelect(callback) {
        onBridgeSelect = callback;
    }

    return { init, loadBridges, selectBridgeById, applyFilter, resetView, onSelect, getRiskColor };
})();
