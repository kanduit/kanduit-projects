(function () {
  "use strict";

  const METRICS = {
    population: {
      label: "Bevölkerung",
      unit: "",
      format: (v) => v.toLocaleString("de-DE"),
      colors: ["#E8F4FD", "#B8DCEF", "#7ABDE2", "#3A8FD6", "#1B5A96", "#0F2640"],
      reverse: false,
    },
    pop_change_pct: {
      label: "Bevölkerungsentwicklung",
      unit: "%",
      format: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + " %",
      colors: ["#EF4444", "#F59E0B", "#FDE68A", "#BBF7D0", "#22C55E", "#15803D"],
      reverse: false,
    },
    unemployment_rate: {
      label: "Arbeitslosenquote",
      unit: "%",
      format: (v) => v.toFixed(1) + " %",
      colors: ["#15803D", "#22C55E", "#BBF7D0", "#FDE68A", "#F59E0B", "#EF4444"],
      reverse: false,
    },
    age_over_65_pct: {
      label: "Anteil Ü65",
      unit: "%",
      format: (v) => v.toFixed(1) + " %",
      colors: ["#E8F4FD", "#B8DCEF", "#7ABDE2", "#3A8FD6", "#8B5CF6", "#6D28D9"],
      reverse: false,
    },
    gdp_per_capita: {
      label: "BIP pro Kopf",
      unit: "€",
      format: (v) => v.toLocaleString("de-DE") + " €",
      colors: ["#FDE8E8", "#FCA5A5", "#F9D07A", "#BBF7D0", "#22C55E", "#15803D"],
      reverse: false,
    },
  };

  let map, geoLayer, kreiseData, nrwAverages;
  let currentMetric = "unemployment_rate";
  let selectedArs = null;
  let detailChart = null;
  let comparisonChart = null;
  let sortColumn = "value";
  let sortDir = "desc";

  async function init() {
    const [geoRes, dataRes] = await Promise.all([
      fetch("geo/nrw-kreise.geojson").then((r) => r.json()),
      fetch("data/kreise.json").then((r) => r.json()),
    ]);

    kreiseData = dataRes.kreise;
    nrwAverages = dataRes.nrw_averages;

    renderSummary();
    initMap(geoRes);
    updateMap();
    renderRanking();
    bindEvents();
  }

  function renderSummary() {
    const el = document.getElementById("nrw-summary");
    el.innerHTML = `
      <span class="summary-item">NRW gesamt: <span class="summary-value">${nrwAverages.population_total.toLocaleString("de-DE")} Einw.</span></span>
      <span class="summary-item">Ø Arbeitslosenquote: <span class="summary-value">${nrwAverages.unemployment_rate} %</span></span>
      <span class="summary-item">Ø BIP/Kopf: <span class="summary-value">${nrwAverages.gdp_per_capita.toLocaleString("de-DE")} €</span></span>
      <span class="summary-item">Ø Anteil Ü65: <span class="summary-value">${nrwAverages.age_over_65_pct} %</span></span>
    `;
  }

  function initMap(geoJson) {
    map = L.map("map", {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 14,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    geoLayer = L.geoJSON(geoJson, {
      style: featureStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
  }

  function getMetricValue(ars, metric) {
    const d = kreiseData[ars];
    return d ? d[metric] : null;
  }

  function getColorScale(metric) {
    const m = METRICS[metric];
    const values = Object.keys(kreiseData).map((ars) => getMetricValue(ars, metric)).filter((v) => v !== null);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max, colors: m.colors };
  }

  function getColor(value, scale) {
    if (value == null) return "#ccc";
    const { min, max, colors } = scale;
    const range = max - min || 1;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));
    const idx = Math.min(Math.floor(ratio * colors.length), colors.length - 1);
    return colors[idx];
  }

  function featureStyle(feature) {
    const ars = feature.properties.ARS;
    const scale = getColorScale(currentMetric);
    const value = getMetricValue(ars, currentMetric);
    const isSelected = ars === selectedArs;
    return {
      fillColor: getColor(value, scale),
      fillOpacity: isSelected ? 0.9 : 0.75,
      color: isSelected ? "#1B3A5C" : "#fff",
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
    };
  }

  function onEachFeature(feature, layer) {
    const ars = feature.properties.ARS;
    const d = kreiseData[ars];
    if (!d) return;

    layer.on({
      mouseover: (e) => highlightFeature(e),
      mouseout: (e) => resetHighlight(e),
      click: (e) => selectKreis(ars, e),
    });

    layer.bindTooltip(
      () => {
        const m = METRICS[currentMetric];
        const val = getMetricValue(ars, currentMetric);
        return `<span class="kreis-tooltip-name">${d.name}</span><br><span class="kreis-tooltip-value">${m.label}: ${m.format(val)}</span>`;
      },
      { sticky: true, direction: "top", offset: [0, -10] }
    );
  }

  function highlightFeature(e) {
    const layer = e.target;
    if (layer.feature.properties.ARS === selectedArs) return;
    layer.setStyle({ weight: 2.5, color: "#1B3A5C", fillOpacity: 0.85 });
    layer.bringToFront();
  }

  function resetHighlight(e) {
    const layer = e.target;
    if (layer.feature.properties.ARS === selectedArs) return;
    geoLayer.resetStyle(layer);
  }

  function selectKreis(ars, e) {
    selectedArs = ars;
    updateMap();
    showDetail(ars);
    highlightRankingRow(ars);
    if (e && e.target) e.target.bringToFront();
  }

  function updateMap() {
    geoLayer.eachLayer((layer) => {
      layer.setStyle(featureStyle(layer.feature));
    });
    updateLegend();
  }

  function updateLegend() {
    const m = METRICS[currentMetric];
    const scale = getColorScale(currentMetric);
    const legendEl = document.getElementById("legend");

    const swatches = m.colors.map((c) => `<span style="background:${c}"></span>`).join("");
    legendEl.innerHTML = `
      <div class="legend-title">${m.label}</div>
      <div class="legend-scale">${swatches}</div>
      <div class="legend-labels">
        <span>${m.format(scale.min)}</span>
        <span>${m.format(scale.max)}</span>
      </div>
    `;
  }

  function showDetail(ars) {
    const d = kreiseData[ars];
    if (!d) return;

    document.getElementById("detail-placeholder").style.display = "none";
    document.getElementById("detail-content").style.display = "block";
    document.getElementById("detail-name").textContent = d.name;
    document.getElementById("detail-bez").textContent = d.bez;

    const statsEl = document.getElementById("detail-stats");
    const changeCls = d.pop_change_pct > 0 ? "positive" : d.pop_change_pct < 0 ? "negative" : "";
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Bevölkerung</div>
        <div class="stat-value">${d.population.toLocaleString("de-DE")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Entwicklung</div>
        <div class="stat-value ${changeCls}">${d.pop_change_pct > 0 ? "+" : ""}${d.pop_change_pct.toFixed(1)} %</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Arbeitslosenquote</div>
        <div class="stat-value">${d.unemployment_rate.toFixed(1)} %</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">BIP pro Kopf</div>
        <div class="stat-value">${d.gdp_per_capita.toLocaleString("de-DE")} €</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Anteil unter 18</div>
        <div class="stat-value">${d.age_under_18_pct.toFixed(1)} %</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Anteil Ü65</div>
        <div class="stat-value">${d.age_over_65_pct.toFixed(1)} %</div>
      </div>
    `;

    renderDetailChart(d);
    renderComparisonChart(d);
  }

  function renderDetailChart(d) {
    const ctx = document.getElementById("detail-chart").getContext("2d");
    if (detailChart) detailChart.destroy();

    const trend = d.pop_trend || [];
    detailChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: trend.map((t) => t.year),
        datasets: [
          {
            label: "Bevölkerung",
            data: trend.map((t) => t.pop),
            borderColor: "#3A8FD6",
            backgroundColor: "rgba(58,143,214,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#3A8FD6",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.parsed.y.toLocaleString("de-DE") + " Einw.",
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: (v) => (v / 1000).toFixed(0) + "k",
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
        },
      },
    });
  }

  function renderComparisonChart(d) {
    const ctx = document.getElementById("comparison-chart").getContext("2d");
    if (comparisonChart) comparisonChart.destroy();

    comparisonChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Arbeitslosenquote", "Anteil Ü65", "BIP/Kopf (Tsd.)"],
        datasets: [
          {
            label: d.name,
            data: [d.unemployment_rate, d.age_over_65_pct, d.gdp_per_capita / 1000],
            backgroundColor: "rgba(58,143,214,0.7)",
            borderRadius: 4,
          },
          {
            label: "NRW Ø",
            data: [
              nrwAverages.unemployment_rate,
              nrwAverages.age_over_65_pct,
              nrwAverages.gdp_per_capita / 1000,
            ],
            backgroundColor: "rgba(27,58,92,0.3)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "rgba(0,0,0,0.05)" }, beginAtZero: true },
        },
      },
    });
  }

  function renderRanking() {
    const m = METRICS[currentMetric];
    document.getElementById("ranking-metric-header").textContent = m.label;

    const entries = Object.entries(kreiseData).map(([ars, d]) => ({
      ars,
      name: d.name,
      value: d[currentMetric],
      population: d.population,
    }));

    entries.sort((a, b) => {
      let av, bv;
      if (sortColumn === "name") {
        av = a.name;
        bv = b.name;
        return sortDir === "asc" ? av.localeCompare(bv, "de") : bv.localeCompare(av, "de");
      }
      av = sortColumn === "value" ? a.value : a.population;
      bv = sortColumn === "value" ? b.value : b.population;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    const tbody = document.getElementById("ranking-body");
    tbody.innerHTML = entries
      .map(
        (e, i) => `
        <tr data-ars="${e.ars}" class="${e.ars === selectedArs ? "active" : ""}">
          <td>${i + 1}</td>
          <td>${e.name}</td>
          <td>${m.format(e.value)}</td>
          <td>${e.population.toLocaleString("de-DE")}</td>
        </tr>`
      )
      .join("");

    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll(".ranking-table th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === sortColumn) {
        th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function highlightRankingRow(ars) {
    document.querySelectorAll(".ranking-table tbody tr").forEach((tr) => {
      tr.classList.toggle("active", tr.dataset.ars === ars);
    });
  }

  function bindEvents() {
    document.getElementById("metric-select").addEventListener("change", (e) => {
      currentMetric = e.target.value;
      updateMap();
      renderRanking();
      if (selectedArs) showDetail(selectedArs);
    });

    document.getElementById("detail-close").addEventListener("click", () => {
      selectedArs = null;
      document.getElementById("detail-content").style.display = "none";
      document.getElementById("detail-placeholder").style.display = "flex";
      updateMap();
      highlightRankingRow(null);
    });

    document.querySelectorAll(".ranking-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (col === "rank") return;
        if (sortColumn === col) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortColumn = col;
          sortDir = col === "name" ? "asc" : "desc";
        }
        renderRanking();
      });
    });

    document.getElementById("ranking-body").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-ars]");
      if (!tr) return;
      const ars = tr.dataset.ars;
      selectKreis(ars);
      geoLayer.eachLayer((layer) => {
        if (layer.feature.properties.ARS === ars) {
          map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 11 });
        }
      });
    });
  }

  init();
})();
