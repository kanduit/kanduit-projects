/**
 * Charts module: D3-based inspection history and InSAR displacement charts.
 */
const BridgeCharts = (() => {
    const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    function renderInspectionChart(containerId, historyData) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (!historyData || historyData.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:12px">Keine Prüfungsdaten verfügbar</p>';
            return;
        }

        const margin = { top: 10, right: 16, bottom: 28, left: 36 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 140 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(historyData, d => d.jahr))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([1, 4])
            .range([0, height]);

        // Warning zones
        svg.append('rect')
            .attr('x', 0).attr('y', y(3)).attr('width', width).attr('height', y(4) - y(3))
            .attr('class', 'insar-warning-zone');

        // Grid
        svg.append('g')
            .attr('class', 'chart-grid')
            .selectAll('line')
            .data([1, 1.5, 2, 2.5, 3, 3.5, 4])
            .enter().append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', d => y(d)).attr('y2', d => y(d));

        // Line
        const line = d3.line()
            .x(d => x(d.jahr))
            .y(d => y(d.zustandsnote))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(historyData)
            .attr('class', 'chart-line')
            .attr('stroke', '#d73027')
            .attr('d', line);

        // Dots
        svg.selectAll('.chart-dot')
            .data(historyData)
            .enter().append('circle')
            .attr('class', 'chart-dot')
            .attr('cx', d => x(d.jahr))
            .attr('cy', d => y(d.zustandsnote))
            .attr('r', 4)
            .attr('fill', d => {
                if (d.zustandsnote >= 3.0) return '#d73027';
                if (d.zustandsnote >= 2.5) return '#f46d43';
                if (d.zustandsnote >= 2.0) return '#fee08b';
                return '#1a9641';
            });

        // Labels on dots
        svg.selectAll('.chart-tooltip')
            .data(historyData)
            .enter().append('text')
            .attr('class', 'chart-tooltip')
            .attr('x', d => x(d.jahr))
            .attr('y', d => y(d.zustandsnote) - 8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#636e72')
            .text(d => d.zustandsnote.toFixed(1));

        // X axis
        svg.append('g')
            .attr('class', 'chart-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(Math.min(historyData.length, 6)).tickFormat(d3.format('d')));

        // Y axis
        svg.append('g')
            .attr('class', 'chart-axis')
            .call(d3.axisLeft(y).tickValues([1, 2, 3, 4]).tickFormat(d => d.toFixed(1)));
    }

    function renderInsarChart(containerId, displacementData) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (!displacementData || displacementData.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:12px">Keine InSAR-Daten verfügbar</p>';
            return;
        }

        const margin = { top: 10, right: 16, bottom: 28, left: 40 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 140 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const data = displacementData.map((v, i) => ({ month: i, value: v }));

        const x = d3.scaleLinear()
            .domain([0, 11])
            .range([0, width]);

        const yExtent = d3.extent(data, d => d.value);
        const yPad = Math.max(Math.abs(yExtent[0]), Math.abs(yExtent[1]), 1) * 1.3;

        const y = d3.scaleLinear()
            .domain([-yPad, yPad])
            .range([height, 0]);

        // Warning threshold zones (below -2mm is concerning)
        if (yPad > 2) {
            svg.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width)
                .attr('height', Math.max(0, y(-2)))
                .attr('class', 'insar-warning-zone');
        }

        // Zero line
        svg.append('line')
            .attr('class', 'insar-zero-line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y(0)).attr('y2', y(0));

        // Area
        const area = d3.area()
            .x(d => x(d.month))
            .y0(y(0))
            .y1(d => y(d.value))
            .curve(d3.curveMonotoneX);

        const isAnomaly = Math.min(...displacementData) < -1.5;
        const lineColor = isAnomaly ? '#d73027' : '#0984e3';

        svg.append('path')
            .datum(data)
            .attr('class', 'chart-area')
            .attr('fill', lineColor)
            .attr('d', area);

        // Line
        const line = d3.line()
            .x(d => x(d.month))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('class', 'chart-line')
            .attr('stroke', lineColor)
            .attr('d', line);

        // Dots
        svg.selectAll('.chart-dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'chart-dot')
            .attr('cx', d => x(d.month))
            .attr('cy', d => y(d.value))
            .attr('r', 3)
            .attr('fill', lineColor);

        // X axis
        svg.append('g')
            .attr('class', 'chart-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(12).tickFormat(i => MONTHS_DE[i] || ''));

        // Y axis
        svg.append('g')
            .attr('class', 'chart-axis')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d > 0 ? '+' : ''}${d.toFixed(1)} mm`));
    }

    return { renderInspectionChart, renderInsarChart };
})();
