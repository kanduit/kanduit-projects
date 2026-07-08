/* =========================================================================
   Kanduit Schulbau-Monitor — application logic (vanilla JS, no build step)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_DATA;
const SCHOOLS = DATA.schulen;
const BEZ = DATA.bezirke.features;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtMio = v => nf1.format(v / 1e6) + ' Mio €';
const fmtEur = v => nf.format(Math.round(v)) + ' €';
const FORMS = ['Grundschule','Hauptschule','Realschule','Gesamtschule','Gymnasium','Berufskolleg','Förderschule','Sonstige'];
const ZK_COLOR = { 1: 'var(--cond-1)', 2: 'var(--cond-2)', 3: 'var(--cond-3)', 4: 'var(--cond-4)' };
const ZK_LABEL = { 1: 'gut', 2: 'mittel', 3: 'schlecht', 4: 'ungenügend' };
const statusClass = s => 'status-' + s.toLowerCase().replace(/[^a-zäöü]/g, '');

/* condition index -> color (good=green … bad=coral) */
function condColor(idx) {
  if (idx >= 75) return '#2f8f6b';
  if (idx >= 65) return '#7cb342';
  if (idx >= 55) return '#c9931f';
  if (idx >= 45) return '#d97a2b';
  return '#c24b57';
}

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview:'view-overview', map:'view-map', schools:'view-schools', priority:'view-priority' };
let rendered = {};
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  Object.entries(views).forEach(([k, id]) => $('#' + id).classList.toggle('active', k === name));
  if (name === 'map' && !rendered.map) { renderMap(); rendered.map = true; }
  if (name === 'schools' && !rendered.schools) { renderTable(); rendered.schools = true; }
  if (name === 'priority' && !rendered.priority) { renderPriority(); rendered.priority = true; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showView(b.dataset.view); });

/* ====================================================================
   TOOLTIP
   ==================================================================== */
const tt = $('#tooltip');
function showTip(html, x, y) {
  tt.innerHTML = html; tt.classList.add('show');
  const r = tt.getBoundingClientRect();
  let nx = x + 16, ny = y + 16;
  if (nx + r.width > window.innerWidth - 8) nx = x - r.width - 16;
  if (ny + r.height > window.innerHeight - 8) ny = y - r.height - 16;
  tt.style.left = nx + 'px'; tt.style.top = ny + 'px';
}
const hideTip = () => tt.classList.remove('show');

/* ====================================================================
   METRIC DEFINITIONS — plain-language glossary for the ⓘ hover tooltips.
   Kept in sync with the "Kennzahlen" section of README.de.md / README.md.
   ==================================================================== */
const METRIC_INFO = {
  // ---- Übersicht-KPIs & Stammdaten ----
  schulstandorte: { t: 'Schulstandorte', d: 'Anzahl der erfassten Schulstandorte, verteilt auf die 10 Stadtbezirke. Reale Stammdaten aus Open Data Düsseldorf.' },
  sanierungsstau_gesamt: { t: 'Sanierungsstau gesamt', d: 'Geschätzte Gesamtkosten, um alle Schulgebäude in einen neuwertigen Zustand zu versetzen — Summe über alle Standorte. Illustrativer Demo-Wert.' },
  kritisch: { t: 'Kritische Standorte', d: 'Anzahl der Standorte in Zustandsklasse 4 (ungenügend) — die dringendsten Sanierungsfälle. Illustrativer Demo-Wert.' },
  // ---- Kern-Kennzahlen je Schule ----
  zustandsindex: { t: 'Zustandsindex', d: 'Baulicher Gesamtzustand auf einer Skala von 0 bis 100 (100 = neuwertig, 0 = ungenügend). Als Ø-Wert der Durchschnitt über alle Standorte. Illustrativer Demo-Wert.' },
  zklasse: { t: 'Zustandsklasse', d: 'Fasst den Zustandsindex zu vier Klassen zusammen: 1 = gut (≥ 75), 2 = mittel (55–74), 3 = schlecht (38–54), 4 = ungenügend (< 38). Illustrativer Demo-Wert.' },
  sanierungsstau: { t: 'Sanierungsstau', d: 'Geschätzte Kosten, um dieses Gebäude in einen neuwertigen Zustand zu versetzen. Steigt mit dem Zustandsdefizit und der Gebäudefläche. Illustrativer Demo-Wert.' },
  modernisierung: { t: 'Modernisierung', d: 'Anteil des bereits umgesetzten Modernisierungsbedarfs in Prozent (0–100 %). 100 % = vollständig modernisiert. Illustrativer Demo-Wert.' },
  prioritaet: { t: 'Prioritätsscore', d: 'Rangkennzahl von 0 bis 100, die vier Kriterien zu einer nachvollziehbaren Dringlichkeitsreihenfolge bündelt (Gebäudezustand, betroffene Schüler:innen, Höhe des Sanierungsstaus, Mängel & Recht). Höher = dringender. Illustrativer Demo-Wert.' },
  baujahr: { t: 'Baujahr', d: 'Errichtungsjahr des Gebäudes. Illustrativer Demo-Wert.' },
  schueler: { t: 'Schüler:innen', d: 'Anzahl der Schüler:innen am Standort; in der Übersicht als Summe über alle Standorte. Illustrativer Demo-Wert.' },
  status: { t: 'Maßnahmenstatus', d: 'Bearbeitungsstand der Sanierungsmaßnahme: nicht begonnen, geplant, in Umsetzung oder abgeschlossen. Illustrativer Demo-Wert.' },
  form: { t: 'Schulform', d: 'Schulform laut Stammdaten, normalisiert auf acht Kategorien (Grundschule, Gymnasium, Berufskolleg …). Reale Stammdaten.' },
  bezirkName: { t: 'Stadtbezirk', d: 'Zugehöriger Stadtbezirk (1–10), aus den realen Koordinaten und Bezirksgrenzen abgeleitet (Punkt-in-Polygon). Reale Stammdaten.' },
  // ---- Karten-Kennzahlen (Bezirksaggregate) ----
  avgZustand: { t: 'Ø Zustandsindex', d: 'Durchschnittlicher Zustandsindex aller Schulen im Stadtbezirk (0–100). Illustrativer Demo-Wert.' },
  sumSanierungsstau: { t: 'Sanierungsstau', d: 'Summe des geschätzten Sanierungsstaus aller Schulen im Stadtbezirk. Illustrativer Demo-Wert.' },
  avgPrioritaet: { t: 'Ø Prioritätsscore', d: 'Durchschnittlicher Prioritätsscore aller Schulen im Stadtbezirk (0–100). Illustrativer Demo-Wert.' },
  avgModernisierung: { t: 'Ø Modernisierung', d: 'Durchschnittlicher Modernisierungsgrad aller Schulen im Stadtbezirk in Prozent. Illustrativer Demo-Wert.' },
  // ---- Sanierungsfahrplan-Simulation ----
  simulation_modell: { t: 'Wie die Simulation rechnet', d: 'Vereinfachtes Modell: Die Schulen werden streng nach Prioritätsscore abgearbeitet — das gesamte Jahresbudget fließt in das jeweils dringendste Projekt. Kostet es mehr als ein Jahresbudget, wird das Budget mehrere Jahre dafür angespart; erst danach beginnt das nächste Projekt. Die Balken zeigen die pro Jahr fertiggestellten Standorte: Bei kleinem Budget kann ein Jahr daher 0 zeigen, obwohl das volle Budget in ein laufendes Großprojekt fließt. Die rote Linie zeigt den verbleibenden Sanierungsstau in €, der jedes Jahr um das Budget sinkt. Reale Bauprogramme bündeln mehrere Projekte parallel — die Simulation ist bewusst vereinfacht und illustrativ.' },
  sim_dauer: { t: 'Jahre bis zum Abbau des Staus', d: 'Anzahl der Jahre, bis der gesamte Sanierungsstau bei konstantem Jahresbudget abgetragen ist (Gesamtstau ÷ Jahresbudget, aufgerundet). Illustrativer Demo-Wert.' },
  sim_jahr1: { t: 'Standorte in Jahr 1', d: 'Anzahl der Standorte, die im ersten Jahr vollständig saniert werden. Kann 0 sein, wenn das dringendste Projekt teurer ist als ein Jahresbudget — dann spart das Modell das Budget mehrere Jahre dafür an, und der erste Abschluss folgt in einem späteren Jahr.' },
  sim_krit3: { t: 'Kritische Schulen in ≤ 3 Jahren', d: 'Wie viele der Schulen in Zustandsklasse 4 (ungenügend) innerhalb der ersten drei Jahre fertig saniert sind — gemessen an allen kritischen Standorten.' },
  // ---- Gewichte im Prioritätsmodell ----
  weight_zustand: { t: 'Kriterium: Gebäudezustand', d: 'Gewicht 40 von 100. Je schlechter der Zustandsindex, desto höher der Beitrag zum Prioritätsscore. Illustrativ — Gewichte sind mit dem Amt abstimmbar.' },
  weight_schueler: { t: 'Kriterium: Betroffene Schüler:innen', d: 'Gewicht 20 von 100. Mehr betroffene Schüler:innen erhöhen die Priorität. Illustrativ — Gewichte sind mit dem Amt abstimmbar.' },
  weight_stau: { t: 'Kriterium: Höhe Sanierungsstau', d: 'Gewicht 15 von 100. Ein höherer geschätzter Sanierungsstau erhöht die Priorität. Illustrativ — Gewichte sind mit dem Amt abstimmbar.' },
  weight_maengel: { t: 'Kriterium: Mängel & Recht', d: 'Gewicht 25 von 100. Brandschutzmängel, fehlende Barrierefreiheit und Schadstoffverdacht erhöhen die Priorität. Illustrativ — Gewichte sind mit dem Amt abstimmbar.' },
};

/* Returns the markup for an ⓘ info icon, or '' if no definition exists for the key. */
function infoIcon(key) {
  return METRIC_INFO[key]
    ? ` <span class="info-i" data-info="${key}" tabindex="0" role="button" aria-label="Erklärung: ${METRIC_INFO[key].t}">ⓘ</span>`
    : '';
}

/* Delegated handlers so dynamically-rendered icons work everywhere. */
function infoTipFor(ic, x, y) {
  const m = METRIC_INFO[ic.dataset.info]; if (!m) return;
  showTip(`<b>${m.t}</b><div class="def">${m.d}</div>`, x, y);
}
document.addEventListener('mouseover', e => { const ic = e.target.closest && e.target.closest('.info-i'); if (ic) infoTipFor(ic, e.clientX, e.clientY); });
document.addEventListener('mousemove', e => { const ic = e.target.closest && e.target.closest('.info-i'); if (ic) infoTipFor(ic, e.clientX, e.clientY); });
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('.info-i')) hideTip(); });
document.addEventListener('focusin', e => { const ic = e.target.closest && e.target.closest('.info-i'); if (ic) { const r = ic.getBoundingClientRect(); infoTipFor(ic, r.right, r.bottom); } });
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.info-i')) hideTip(); });

/* ====================================================================
   SVG helpers
   ==================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

/* simple horizontal bar chart */
function barChart(container, rows, opts) {
  opts = opts || {};
  const W = 560, rowH = opts.rowH || 30, padL = opts.padL || 150, padR = 70, padT = 8;
  const H = padT * 2 + rows.length * rowH;
  const max = Math.max(...rows.map(r => r.value), 1);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const bw = (W - padL - padR) * (r.value / max);
    const lbl = svgEl('text', { x: padL - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'axis-txt' });
    lbl.textContent = r.label; svg.appendChild(lbl);
    const bar = svgEl('rect', { x: padL, y: y + 5, width: Math.max(bw, 1), height: rowH - 14, rx: 3, fill: r.color || 'var(--dv-petrol)', class: 'bar' });
    if (r.onClick) { bar.style.cursor = 'pointer'; bar.addEventListener('click', r.onClick); }
    if (r.tip) {
      bar.addEventListener('mousemove', e => showTip(r.tip, e.clientX, e.clientY));
      bar.addEventListener('mouseleave', hideTip);
    }
    svg.appendChild(bar);
    const val = svgEl('text', { x: padL + Math.max(bw, 1) + 8, y: y + rowH / 2 + 4, class: 'bar-label' });
    val.textContent = r.valLabel != null ? r.valLabel : r.value; svg.appendChild(val);
  });
  container.innerHTML = ''; container.appendChild(svg);
}

/* ====================================================================
   OVERVIEW
   ==================================================================== */
function renderOverview() {
  const m = DATA.meta;
  const kpis = [
    { k: 'Schulstandorte', v: fmtInt(m.anzahlSchulen), d: m.anzahlBezirke + ' Stadtbezirke', info: 'schulstandorte' },
    { k: 'Sanierungsstau gesamt', v: nf1.format(m.sumSanierungsstau / 1e9) + ' Mrd €', d: 'geschätzt · illustrativ', cls: 'petrol', info: 'sanierungsstau_gesamt' },
    { k: 'Ø Zustandsindex', v: nf1.format(m.avgZustand), d: 'Skala 0–100 (100 = neuwertig)', info: 'zustandsindex' },
    { k: 'Kritische Standorte', v: fmtInt(m.kritisch), d: 'Zustandsklasse 4', cls: 'ink', info: 'kritisch' },
    { k: 'Ø Modernisierung', v: m.avgModernisierung + ' %', d: 'umgesetzter Bedarf', info: 'modernisierung' },
    { k: 'Schüler:innen', v: fmtInt(m.schueler), d: 'an erfassten Standorten', info: 'schueler' },
  ];
  const wrap = $('#kpis'); wrap.innerHTML = '';
  kpis.forEach(s => {
    const c = el('div', 'stat' + (s.cls ? ' ' + s.cls : ''));
    c.innerHTML = `<div class="k">${s.k}${infoIcon(s.info)}</div><div class="v">${s.v}</div><div class="d">${s.d}</div>`;
    wrap.appendChild(c);
  });

  // zustandsklasse distribution
  const byZk = [1, 2, 3, 4].map(z => ({
    label: 'Klasse ' + z + ' · ' + ZK_LABEL[z],
    value: SCHOOLS.filter(s => s.zklasse === z).length,
    color: ZK_COLOR[z],
    tip: `<b>Zustandsklasse ${z} — ${ZK_LABEL[z]}</b><div class="row"><span>Standorte</span><span>${SCHOOLS.filter(s => s.zklasse === z).length}</span></div>`
  }));
  barChart($('#chart-zklasse'), byZk, { padL: 150 });

  // sanierungsstau by form
  const byForm = FORMS.map(f => {
    const list = SCHOOLS.filter(s => s.form === f);
    return { f, sum: list.reduce((a, s) => a + s.sanierungsstau, 0), n: list.length };
  }).filter(r => r.n > 0).sort((a, b) => b.sum - a.sum)
    .map(r => ({ label: r.f, value: r.sum, valLabel: nf1.format(r.sum / 1e6), color: 'var(--dv-petrol)',
      tip: `<b>${r.f}</b><div class="row"><span>Standorte</span><span>${r.n}</span></div><div class="row"><span>Sanierungsstau</span><span>${fmtMio(r.sum)}</span></div>` }));
  barChart($('#chart-form'), byForm, { padL: 130 });

  // sanierungsstau by bezirk
  const byBez = BEZ.map(f => f.properties).sort((a, b) => b.sumSanierungsstau - a.sumSanierungsstau)
    .map(p => ({ label: p.name + ' · ' + p.anzahlSchulen + ' Sch.', value: p.sumSanierungsstau,
      valLabel: nf1.format(p.sumSanierungsstau / 1e6), color: 'var(--petrol-600)',
      onClick: () => { showView('map'); selectBezirk(p.bezirk); },
      tip: `<b>${p.name}</b><div style="color:#94a3b8;font-size:.8em">${p.stadtteile}</div><div class="row"><span>Sanierungsstau</span><span>${fmtMio(p.sumSanierungsstau)}</span></div><div class="row"><span>Ø Zustand</span><span>${p.avgZustand}</span></div>` }));
  barChart($('#chart-bezirk'), byBez, { padL: 180 });

  // top priority list
  const top = [...SCHOOLS].sort((a, b) => b.prioritaet - a.prioritaet).slice(0, 8);
  const box = $('#top-priority'); box.innerHTML = '';
  top.forEach((s, i) => {
    const row = el('div', 'prio-row');
    row.style.cssText = 'grid-template-columns:22px 1fr auto; padding:9px 0; border-bottom:1px solid var(--neutral-100); cursor:pointer';
    row.innerHTML = `<span class="mono" style="color:var(--neutral-400)">${i + 1}</span>
      <div><div style="font-weight:600; font-size:.94rem">${s.name}</div>
      <div style="font-size:var(--t-small); color:var(--neutral-500)">${s.form} · ${s.stadtteil}</div></div>
      <div style="text-align:right"><div class="mono" style="font-weight:600; color:var(--error)">${nf1.format(s.prioritaet)}</div>
      <div class="mono" style="font-size:var(--t-micro); color:var(--neutral-500)">${fmtMio(s.sanierungsstau)}</div></div>`;
    row.addEventListener('click', () => openDrawer(s.id));
    box.appendChild(row);
  });
}

/* ====================================================================
   MAP
   ==================================================================== */
let mapMetric = 'avgZustand';
let showDots = true;
let selectedBezirk = null;

// projection
const allPts = [];
BEZ.forEach(f => f.geometry.coordinates[0].forEach(c => allPts.push(c)));
const latMid = allPts.reduce((a, c) => a + c[1], 0) / allPts.length;
const kx = Math.cos(latMid * Math.PI / 180);
const projRaw = (lon, lat) => [lon * kx, lat];
let MB = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
allPts.forEach(c => { const [x, y] = projRaw(c[0], c[1]); MB.minX = Math.min(MB.minX, x); MB.maxX = Math.max(MB.maxX, x); MB.minY = Math.min(MB.minY, y); MB.maxY = Math.max(MB.maxY, y); });
const VBW = 760, VBH = 620, PAD = 24;
const spanX = MB.maxX - MB.minX, spanY = MB.maxY - MB.minY;
const scale = Math.min((VBW - 2 * PAD) / spanX, (VBH - 2 * PAD) / spanY);
const offX = (VBW - spanX * scale) / 2, offY = (VBH - spanY * scale) / 2;
function project(lon, lat) {
  const [x, y] = projRaw(lon, lat);
  return [offX + (x - MB.minX) * scale, VBH - offY - (y - MB.minY) * scale];
}

const METRICS = {
  avgZustand: { label: 'Ø Zustandsindex', fmt: v => nf1.format(v), good: true,
    buckets: [{ max: 45, c: '#c24b57', l: '< 45 sehr kritisch' }, { max: 55, c: '#d97a2b', l: '45–55 kritisch' }, { max: 65, c: '#c9931f', l: '55–65 mittel' }, { max: 75, c: '#7cb342', l: '65–75 gut' }, { max: Infinity, c: '#2f8f6b', l: '≥ 75 sehr gut' }] },
  avgModernisierung: { label: 'Ø Modernisierung', fmt: v => v + ' %', good: true,
    buckets: [{ max: 25, c: '#c24b57', l: '< 25 %' }, { max: 40, c: '#d97a2b', l: '25–40 %' }, { max: 55, c: '#c9931f', l: '40–55 %' }, { max: 70, c: '#7cb342', l: '55–70 %' }, { max: Infinity, c: '#2f8f6b', l: '≥ 70 %' }] },
  avgPrioritaet: { label: 'Ø Prioritätsscore', fmt: v => nf1.format(v), good: false,
    buckets: [{ max: 35, c: '#e4f4f8', l: '< 35' }, { max: 45, c: '#84cede', l: '35–45' }, { max: 55, c: '#38a9c4', l: '45–55' }, { max: 65, c: '#0e7490', l: '55–65' }, { max: Infinity, c: '#155e75', l: '≥ 65' }] },
  sumSanierungsstau: { label: 'Sanierungsstau', fmt: v => fmtMio(v), good: false, dynamic: true,
    ramp: ['#e4f4f8', '#84cede', '#38a9c4', '#0e7490', '#155e75'] },
};

function metricColor(metric, v) {
  const cfg = METRICS[metric];
  if (cfg.dynamic) {
    const vals = BEZ.map(f => f.properties[metric]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const t = (v - mn) / (mx - mn || 1);
    return cfg.ramp[Math.min(cfg.ramp.length - 1, Math.floor(t * cfg.ramp.length))];
  }
  for (const b of cfg.buckets) if (v < b.max) return b.c;
  return cfg.buckets[cfg.buckets.length - 1].c;
}

function pathFor(feature) {
  return feature.geometry.coordinates[0].map((c, i) => {
    const [x, y] = project(c[0], c[1]);
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ') + ' Z';
}

function renderMap() {
  const svg = $('#map-svg'); svg.innerHTML = '';
  // polygons
  BEZ.forEach(f => {
    const p = f.properties;
    const path = svgEl('path', { d: pathFor(f), class: 'bezirk', fill: metricColor(mapMetric, p[mapMetric]), 'data-bez': p.bezirk });
    path.addEventListener('mousemove', e => showTip(bezTip(p), e.clientX, e.clientY));
    path.addEventListener('mouseleave', hideTip);
    path.addEventListener('click', () => selectBezirk(p.bezirk));
    svg.appendChild(path);
  });
  // labels
  BEZ.forEach(f => {
    const p = f.properties; const [x, y] = project(p.cx, p.cy);
    const t = svgEl('text', { x, y, 'text-anchor': 'middle', class: 'bez-label' });
    t.textContent = p.bezirk; svg.appendChild(t);
  });
  // school dots
  if (showDots) {
    SCHOOLS.forEach(s => {
      const [x, y] = project(s.lon, s.lat);
      const dot = svgEl('circle', { cx: x, cy: y, r: 3.4, class: 'school-dot', fill: condColor(s.zustandsindex), 'data-id': s.id });
      dot.addEventListener('mousemove', e => showTip(`<b>${s.name}</b><div class="row"><span>Zustand</span><span>${s.zustandsindex} (Kl. ${s.zklasse})</span></div><div class="row"><span>Sanierungsstau</span><span>${fmtMio(s.sanierungsstau)}</span></div>`, e.clientX, e.clientY));
      dot.addEventListener('mouseleave', hideTip);
      dot.addEventListener('click', () => openDrawer(s.id));
      svg.appendChild(dot);
    });
  }
  applyMapSelection();
  renderLegend();
  if (!selectedBezirk) renderBezirkPanel(null);
}

function bezTip(p) {
  return `<b>${p.name}</b><div style="color:#94a3b8;font-size:.82em;margin-bottom:4px">${p.stadtteile}</div>
    <div class="row"><span>Schulen</span><span>${p.anzahlSchulen}</span></div>
    <div class="row"><span>Ø Zustand</span><span>${p.avgZustand}</span></div>
    <div class="row"><span>Sanierungsstau</span><span>${fmtMio(p.sumSanierungsstau)}</span></div>
    <div class="row"><span>Ø Priorität</span><span>${p.avgPrioritaet}</span></div>`;
}

function renderLegend() {
  const cfg = METRICS[mapMetric];
  const box = $('#map-legend'); box.innerHTML = '';
  const title = el('div', 'item'); title.innerHTML = `<b style="font-family:var(--font-mono);font-size:var(--t-micro);text-transform:uppercase;letter-spacing:.07em;color:var(--neutral-600)">${cfg.label}</b>`;
  box.appendChild(title);
  if (cfg.dynamic) {
    const vals = BEZ.map(f => f.properties[mapMetric]); const mn = Math.min(...vals), mx = Math.max(...vals);
    cfg.ramp.forEach((c, i) => {
      const a = mn + (mx - mn) * i / cfg.ramp.length, b = mn + (mx - mn) * (i + 1) / cfg.ramp.length;
      const it = el('div', 'item'); it.innerHTML = `<span class="sw" style="background:${c}"></span>${nf1.format(a / 1e6)}–${nf1.format(b / 1e6)} Mio`;
      box.appendChild(it);
    });
  } else {
    cfg.buckets.forEach(b => { const it = el('div', 'item'); it.innerHTML = `<span class="sw" style="background:${b.c}"></span>${b.l}`; box.appendChild(it); });
  }
  if (showDots) { const it = el('div', 'item'); it.innerHTML = `<span class="sw" style="border-radius:50%;width:12px;height:12px;background:var(--neutral-400)"></span>Standort (Farbe = Zustand)`; box.appendChild(it); }
}

function applyMapSelection() {
  $$('.bezirk', $('#map-svg')).forEach(p => {
    const b = +p.dataset.bez;
    p.classList.toggle('sel', selectedBezirk === b);
    p.classList.toggle('dim', selectedBezirk != null && selectedBezirk !== b);
  });
}

function selectBezirk(b) {
  selectedBezirk = (selectedBezirk === b) ? null : b;
  applyMapSelection();
  renderBezirkPanel(selectedBezirk);
}

function renderBezirkPanel(b) {
  const panel = $('#bezirk-panel');
  if (b == null) {
    const m = DATA.meta;
    panel.innerHTML = `<div class="card"><div class="card-title">Gesamtstadt</div>
      <div class="card-sub">Klicke einen Bezirk für Details</div>
      <div class="kv" style="margin-top:14px">
        <dt>Schulstandorte</dt><dd>${fmtInt(m.anzahlSchulen)}</dd>
        <dt>Sanierungsstau</dt><dd>${fmtMio(m.sumSanierungsstau)}</dd>
        <dt>Ø Zustandsindex</dt><dd>${nf1.format(m.avgZustand)}</dd>
        <dt>Ø Modernisierung</dt><dd>${m.avgModernisierung} %</dd>
        <dt>Kritische Standorte</dt><dd>${m.kritisch}</dd>
      </div></div>`;
    return;
  }
  const p = BEZ.find(f => f.properties.bezirk === b).properties;
  const list = SCHOOLS.filter(s => s.bezirk === b).sort((a, c) => c.prioritaet - a.prioritaet);
  const rows = list.slice(0, 6).map(s => `<div class="prio-row" style="grid-template-columns:1fr auto; padding:7px 0; border-bottom:1px solid var(--neutral-100); cursor:pointer" onclick="window.__openDrawer(${s.id})">
      <div><div style="font-weight:600;font-size:.9rem">${s.name}</div><div style="font-size:var(--t-small);color:var(--neutral-500)">${s.form}</div></div>
      <div style="text-align:right"><span class="pill zk zk-${s.zklasse}">Kl. ${s.zklasse}</span><div class="mono" style="font-size:var(--t-micro);color:var(--neutral-500);margin-top:3px">${fmtMio(s.sanierungsstau)}</div></div></div>`).join('');
  panel.innerHTML = `<div class="card">
    <div class="card-title">${p.name}</div>
    <div class="card-sub">${p.stadtteile}</div>
    <div class="kv" style="margin-top:14px">
      <dt>Schulstandorte</dt><dd>${p.anzahlSchulen}</dd>
      <dt>Schüler:innen</dt><dd>${fmtInt(p.schueler)}</dd>
      <dt>Sanierungsstau</dt><dd>${fmtMio(p.sumSanierungsstau)}</dd>
      <dt>Ø Zustandsindex</dt><dd>${p.avgZustand}</dd>
      <dt>Ø Modernisierung</dt><dd>${p.avgModernisierung} %</dd>
      <dt>Ø Priorität</dt><dd>${p.avgPrioritaet}</dd>
    </div>
    <div class="section-label">Dringendste Standorte</div>${rows}
    <button class="kbtn ghost" style="margin-top:14px;width:100%" onclick="window.__showInTable(${b})">Alle ${p.anzahlSchulen} Standorte in Tabelle →</button>
  </div>`;
}

$('#map-metric').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  mapMetric = b.dataset.metric;
  $$('#map-metric button').forEach(x => x.classList.toggle('active', x === b));
  renderMap();
});
$('#toggle-dots').addEventListener('change', e => { showDots = e.target.checked; renderMap(); });

/* ====================================================================
   TABLE
   ==================================================================== */
const COLS = [
  { key: 'name', label: 'Schule', num: false },
  { key: 'bezirkName', label: 'Bezirk', num: false, get: s => 'Bezirk ' + s.bezirk },
  { key: 'form', label: 'Form', num: false },
  { key: 'baujahr', label: 'Baujahr', num: true },
  { key: 'schueler', label: 'Schüler', num: true, fmt: v => fmtInt(v) },
  { key: 'zustandsindex', label: 'Zustand', num: true, bar: true },
  { key: 'zklasse', label: 'Klasse', num: false, pill: true },
  { key: 'sanierungsstau', label: 'Sanierungsstau', num: true, fmt: v => nf1.format(v / 1e6) + ' Mio' },
  { key: 'modernisierung', label: 'Modern.', num: true, fmt: v => v + ' %' },
  { key: 'prioritaet', label: 'Priorität', num: true, prio: true },
  { key: 'status', label: 'Status', num: false, statusPill: true },
];
let sortKey = 'prioritaet', sortDir = -1;
let filters = { bezirk: '', form: '', zklasse: '', status: '', q: '' };

function buildFilters() {
  const box = $('#filters'); box.innerHTML = '';
  const mk = (label, id, options, val) => {
    const f = el('div', 'field');
    f.innerHTML = `<label>${label}</label><select id="${id}"><option value="">Alle</option>${options.map(o => `<option value="${o.v}" ${o.v == val ? 'selected' : ''}>${o.l}</option>`).join('')}</select>`;
    return f;
  };
  box.appendChild(mk('Stadtbezirk', 'f-bezirk', BEZ.map(f => ({ v: f.properties.bezirk, l: f.properties.name })).sort((a,b)=>a.v-b.v), filters.bezirk));
  box.appendChild(mk('Schulform', 'f-form', FORMS.filter(f => SCHOOLS.some(s => s.form === f)).map(f => ({ v: f, l: f })), filters.form));
  box.appendChild(mk('Zustandsklasse', 'f-zklasse', [1, 2, 3, 4].map(z => ({ v: z, l: 'Klasse ' + z + ' (' + ZK_LABEL[z] + ')' })), filters.zklasse));
  box.appendChild(mk('Maßnahmenstatus', 'f-status', [...new Set(SCHOOLS.map(s => s.status))].map(s => ({ v: s, l: s })), filters.status));
  const sf = el('div', 'field'); sf.innerHTML = `<label>Suche</label><input id="f-q" type="search" placeholder="Schulname oder Stadtteil…" value="${filters.q}">`;
  box.appendChild(sf);
  $('#f-bezirk').onchange = e => { filters.bezirk = e.target.value; renderRows(); };
  $('#f-form').onchange = e => { filters.form = e.target.value; renderRows(); };
  $('#f-zklasse').onchange = e => { filters.zklasse = e.target.value; renderRows(); };
  $('#f-status').onchange = e => { filters.status = e.target.value; renderRows(); };
  $('#f-q').oninput = e => { filters.q = e.target.value; renderRows(); };
}

function buildHead() {
  const tr = $('#thead-row'); tr.innerHTML = '';
  COLS.forEach(c => {
    const th = el('th', c.num ? 'num' : '');
    th.innerHTML = c.label + infoIcon(c.key) + ' <span class="arr">↕</span>';
    if (sortKey === c.key) { th.classList.add('sorted'); th.querySelector('.arr').textContent = sortDir < 0 ? '↓' : '↑'; }
    th.onclick = e => { if (e.target.closest('.info-i')) return; if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = c.num ? -1 : 1; } buildHead(); renderRows(); };
    tr.appendChild(th);
  });
}

function filtered() {
  return SCHOOLS.filter(s =>
    (!filters.bezirk || s.bezirk == filters.bezirk) &&
    (!filters.form || s.form === filters.form) &&
    (!filters.zklasse || s.zklasse == filters.zklasse) &&
    (!filters.status || s.status === filters.status) &&
    (!filters.q || (s.name + ' ' + s.stadtteil).toLowerCase().includes(filters.q.toLowerCase()))
  );
}

function renderRows() {
  const rows = filtered().sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') return sortDir * va.localeCompare(vb, 'de');
    return sortDir * ((va || 0) - (vb || 0));
  });
  const tb = $('#tbody'); tb.innerHTML = '';
  const sumStau = rows.reduce((a, s) => a + s.sanierungsstau, 0);
  $('#tcount').innerHTML = `${rows.length} von ${SCHOOLS.length} Standorten · Sanierungsstau ${fmtMio(sumStau)}`;
  const frag = document.createDocumentFragment();
  rows.forEach(s => {
    const tr = el('tr');
    tr.onclick = () => openDrawer(s.id);
    COLS.forEach(c => {
      const td = el('td', c.num ? 'num' : '');
      if (c.bar) {
        td.className = 'num bar-cell';
        td.innerHTML = `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span>${s.zustandsindex}</span><div class="barbg" style="width:54px"><div class="barfill" style="width:${s.zustandsindex}%;background:${condColor(s.zustandsindex)}"></div></div></div>`;
      } else if (c.pill) {
        td.innerHTML = `<span class="pill zk zk-${s.zklasse}">${s.zklasse} · ${ZK_LABEL[s.zklasse]}</span>`;
      } else if (c.statusPill) {
        td.innerHTML = `<span class="pill ${statusClass(s.status)}">${s.status}</span>`;
      } else if (c.prio) {
        td.className = 'num bar-cell';
        td.innerHTML = `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span style="font-weight:600">${nf1.format(s.prioritaet)}</span><div class="barbg" style="width:46px"><div class="barfill" style="width:${s.prioritaet}%;background:var(--petrol-600)"></div></div></div>`;
      } else {
        const v = c.get ? c.get(s) : s[c.key];
        td.textContent = c.fmt ? c.fmt(v) : v;
      }
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  tb.appendChild(frag);
}

function renderTable() { buildFilters(); buildHead(); renderRows(); }

/* ====================================================================
   DRAWER (school detail)
   ==================================================================== */
function priorityComponents(s) {
  return [
    { l: 'Gebäudezustand', v: (100 - s.zustandsindex) / 100 * 40, max: 40 },
    { l: 'Betroffene Schüler', v: Math.min(1, s.schueler / 1400) * 20, max: 20 },
    { l: 'Sanierungsstau', v: Math.min(1, s.sanierungsstau / 18e6) * 15, max: 15 },
    { l: 'Mängel & Recht', v: (s.brandschutz ? 14 : 0) + (!s.barrierefrei ? 6 : 0) + (s.schadstoff ? 5 : 0), max: 25 },
  ];
}
function gauge(idx) {
  const c = condColor(idx), r = 30, circ = Math.PI * r, off = circ * (1 - idx / 100);
  return `<svg width="92" height="58" viewBox="0 0 92 58">
    <path d="M8 50 A38 38 0 0 1 84 50" fill="none" stroke="var(--neutral-200)" stroke-width="9" stroke-linecap="round"/>
    <path d="M8 50 A38 38 0 0 1 84 50" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${Math.PI*38}" stroke-dashoffset="${Math.PI*38*(1-idx/100)}"/>
    <text x="46" y="46" text-anchor="middle" style="font-family:var(--font-display);font-weight:800;font-size:20px;fill:var(--ink)">${idx}</text>
  </svg>`;
}
function openDrawer(id) {
  const s = SCHOOLS.find(x => x.id === id); if (!s) return;
  const comps = priorityComponents(s);
  const flags = [];
  if (s.brandschutz) flags.push('Brandschutzmangel');
  if (!s.barrierefrei) flags.push('nicht barrierefrei');
  if (s.schadstoff) flags.push('Schadstoffverdacht');
  const flagHtml = flags.length ? flags.map(f => `<span class="pill flag">⚠ ${f}</span>`).join(' ') : '<span class="pill status-abgeschlossen">keine erfasst</span>';
  const d = $('#drawer');
  d.innerHTML = `
    <div class="drawer-head">
      <button class="close" onclick="window.__closeDrawer()" aria-label="Schließen">✕</button>
      <h3>${s.name}</h3>
      <div class="meta">${s.form} · Bezirk ${s.bezirk} · ${s.stadtteil}</div>
    </div>
    <div class="drawer-body">
      <div class="gauge-wrap">
        ${gauge(s.zustandsindex)}
        <div>
          <div style="font-family:var(--font-mono);font-size:var(--t-micro);text-transform:uppercase;letter-spacing:.07em;color:var(--neutral-500)">Zustandsindex${infoIcon('zustandsindex')}</div>
          <div><span class="pill zk zk-${s.zklasse}">Klasse ${s.zklasse} · ${ZK_LABEL[s.zklasse]}</span></div>
          <div style="margin-top:8px"><span class="pill ${statusClass(s.status)}">${s.status}</span></div>
        </div>
      </div>
      <div class="grid g2" style="gap:10px">
        <div class="stat" style="padding:12px 14px"><div class="k">Sanierungsstau${infoIcon('sanierungsstau')}</div><div class="v" style="font-size:1.4rem">${fmtMio(s.sanierungsstau)}</div></div>
        <div class="stat" style="padding:12px 14px"><div class="k">Prioritätsscore${infoIcon('prioritaet')}</div><div class="v" style="font-size:1.4rem;color:var(--petrol-700)">${nf1.format(s.prioritaet)}</div></div>
      </div>
      <div class="section-label">Stammdaten</div>
      <dl class="kv">
        <dt>Adresse</dt><dd style="text-align:right">${s.strasse}, ${s.plz}</dd>
        <dt>Schulträger</dt><dd>${s.traeger}</dd>
        <dt>Baujahr</dt><dd>${s.baujahr}</dd>
        <dt>Letzte Sanierung</dt><dd>${s.sanierungsjahr || '—'}</dd>
        <dt>Schüler:innen</dt><dd>${fmtInt(s.schueler)}</dd>
        <dt>Bruttogrundfläche</dt><dd>${fmtInt(s.bgf)} m²</dd>
        <dt>Modernisierung${infoIcon('modernisierung')}</dt><dd>${s.modernisierung} %</dd>
      </dl>
      <div class="section-label">Mängel & Recht</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${flagHtml}</div>
      <div class="section-label">Zusammensetzung des Prioritätsscores</div>
      <div class="prio-bar">
        ${comps.map(c => `<div class="prio-row"><span>${c.l}</span><div class="tr"><i style="width:${c.v / c.max * 100}%;background:var(--petrol-600)"></i></div><span class="pv">${nf1.format(c.v)}/${c.max}</span></div>`).join('')}
      </div>
      <p class="note">Werte sind illustrativ und dienen der Methoden-Demonstration.</p>
    </div>`;
  d.classList.add('show'); d.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('show');
}
function closeDrawer() { $('#drawer').classList.remove('show'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('show'); }
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
window.__openDrawer = openDrawer;
window.__closeDrawer = closeDrawer;
window.__showInTable = b => { filters = { bezirk: String(b), form: '', zklasse: '', status: '', q: '' }; rendered.schools = true; buildFilters(); buildHead(); renderRows(); showView('schools'); };

/* ====================================================================
   PRIORITY view
   ==================================================================== */
function renderPriority() {
  // weights
  const W = [
    { wv: '40', wl: 'Gebäudezustand', info: 'weight_zustand' },
    { wv: '20', wl: 'Betroffene Schüler:innen', info: 'weight_schueler' },
    { wv: '15', wl: 'Höhe Sanierungsstau', info: 'weight_stau' },
    { wv: '25', wl: 'Mängel & Recht (Brandschutz, Barrierefreiheit, Schadstoffe)', info: 'weight_maengel' },
  ];
  $('#weights').innerHTML = W.map(w => `<div class="weight"><div class="wv">${w.wv}</div><div class="wl">${w.wl}${infoIcon(w.info)}</div></div>`).join('');

  renderScenario();
  $('#budget').addEventListener('input', renderScenario);
  renderScatter();
  renderRank();
}

function renderScenario() {
  const budgetMio = +$('#budget').value;
  $('#budget-val').textContent = budgetMio + ' Mio € / Jahr';
  const B = budgetMio * 1e6;
  const sorted = [...SCHOOLS].sort((a, b) => b.prioritaet - a.prioritaet || b.sanierungsstau - a.sanierungsstau);
  let cum = 0;
  sorted.forEach(s => { cum += s.sanierungsstau; s._year = Math.ceil(cum / B); });
  const total = DATA.meta.sumSanierungsstau;
  const totalYears = sorted[sorted.length - 1]._year;
  const year1 = sorted.filter(s => s._year === 1).length;
  const crit = sorted.filter(s => s.zklasse === 4);
  const crit3 = crit.filter(s => s._year <= 3).length;
  $('#scenario-out').innerHTML = `
    <div><div class="big">${totalYears} Jahre</div><div class="note" style="margin:0">bis zum Abbau des Staus${infoIcon('sim_dauer')}</div></div>
    <div><div class="big">${year1}</div><div class="note" style="margin:0">Standorte in Jahr 1${infoIcon('sim_jahr1')}</div></div>
    <div><div class="big">${crit3}/${crit.length}</div><div class="note" style="margin:0">kritische Schulen in ≤ 3 Jahren${infoIcon('sim_krit3')}</div></div>`;

  // burndown: schools completed per year (first 12) + remaining backlog line
  const maxY = Math.min(12, totalYears);
  const perYear = [];
  for (let y = 1; y <= maxY; y++) {
    const done = sorted.filter(s => s._year === y).length;
    const remaining = Math.max(0, total - B * y);
    perYear.push({ y, done, remaining });
  }
  // padT leaves room for the count label above the tallest bar (10px mono, baseline padT-4)
  const W2 = 620, H = 220, padL = 44, padB = 28, padT = 24, padR = 44;
  const bw = (W2 - padL - padR) / maxY;
  const maxDone = Math.max(...perYear.map(p => p.done), 1);
  const remScale = total || 1;
  let bars = '', line = '', xlab = '';
  perYear.forEach((p, i) => {
    const x = padL + i * bw;
    const h = (H - padT - padB) * (p.done / maxDone);
    bars += `<rect x="${x + 4}" y="${H - padB - h}" width="${bw - 8}" height="${h}" rx="2" fill="var(--petrol-300)"></rect>`;
    bars += `<text x="${x + bw / 2}" y="${H - padB - h - 4}" text-anchor="middle" class="bar-label">${p.done}</text>`;
    xlab += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis-txt">J${p.y}</text>`;
    const ry = padT + (H - padT - padB) * (1 - p.remaining / remScale);
    line += (i ? 'L' : 'M') + (x + bw / 2) + ' ' + ry + ' ';
  });
  $('#chart-burndown').innerHTML = `
    <svg class="chart" viewBox="0 0 ${W2} ${H}" style="height:${H}px">
      ${bars}
      <path d="${line}" fill="none" stroke="var(--error)" stroke-width="2.5"/>
      ${perYear.map((p, i) => { const x = padL + i * bw + bw / 2; const ry = padT + (H - padT - padB) * (1 - p.remaining / remScale); return `<circle cx="${x}" cy="${ry}" r="3" fill="var(--error)"/>`; }).join('')}
      ${xlab}
    </svg>
    <div class="legend"><div class="item"><span class="sw" style="background:var(--petrol-300)"></span>abgeschlossene Standorte / Jahr</div><div class="item"><span class="sw" style="background:var(--error)"></span>verbleibender Sanierungsstau</div></div>
    <p class="note">Greedy-Zuteilung nach Prioritätsscore bei konstantem Jahresbudget. ${maxY < totalYears ? 'Dargestellt sind die ersten 12 Jahre.' : ''}</p>`;
}

function renderScatter() {
  const W = 560, H = 360, padL = 54, padB = 40, padT = 12, padR = 16;
  const xMax = Math.max(...SCHOOLS.map(s => s.sanierungsstau));
  const px = v => padL + (W - padL - padR) * (v / xMax);
  const py = v => padT + (H - padT - padB) * (1 - v / 100); // zustand 0-100
  const prioColor = p => p >= 70 ? '#c24b57' : p >= 55 ? '#d97a2b' : p >= 45 ? '#c9931f' : '#0e7490';
  let grid = '';
  for (let z = 0; z <= 100; z += 25) { const y = py(z); grid += `<line class="gridline" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/><text x="${padL - 8}" y="${y + 3}" text-anchor="end" class="axis-txt">${z}</text>`; }
  for (let i = 0; i <= 4; i++) { const v = xMax * i / 4; const x = px(v); grid += `<text x="${x}" y="${H - 22}" text-anchor="middle" class="axis-txt">${nf1.format(v / 1e6)}</text>`; }
  const dots = SCHOOLS.map(s => {
    const r = 3 + Math.sqrt(s.schueler) / 9;
    return `<circle class="dot-school" cx="${px(s.sanierungsstau).toFixed(1)}" cy="${py(s.zustandsindex).toFixed(1)}" r="${r.toFixed(1)}" fill="${prioColor(s.prioritaet)}" fill-opacity=".62" stroke="${prioColor(s.prioritaet)}" data-id="${s.id}"/>`;
  }).join('');
  $('#chart-scatter').innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">
      ${grid}
      <text x="${padL}" y="${H - 4}" class="axis-txt">Sanierungsstau (Mio €) →</text>
      <text transform="translate(14 ${padT + 30}) rotate(-90)" class="axis-txt">Zustandsindex →</text>
      ${dots}
    </svg>
    <div class="legend">
      <div class="item"><span class="sw" style="background:#c24b57;border-radius:50%"></span>Priorität ≥ 70</div>
      <div class="item"><span class="sw" style="background:#d97a2b;border-radius:50%"></span>55–70</div>
      <div class="item"><span class="sw" style="background:#0e7490;border-radius:50%"></span>&lt; 45</div>
    </div>`;
  $$('#chart-scatter .dot-school').forEach(c => {
    const s = SCHOOLS.find(x => x.id == c.dataset.id);
    c.addEventListener('mousemove', e => showTip(`<b>${s.name}</b><div class="row"><span>Zustand</span><span>${s.zustandsindex}</span></div><div class="row"><span>Sanierungsstau</span><span>${fmtMio(s.sanierungsstau)}</span></div><div class="row"><span>Priorität</span><span>${nf1.format(s.prioritaet)}</span></div>`, e.clientX, e.clientY));
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('click', () => openDrawer(+c.dataset.id));
  });
}

function renderRank() {
  const top = [...SCHOOLS].sort((a, b) => b.prioritaet - a.prioritaet).slice(0, 12);
  const max = top[0].prioritaet;
  $('#priority-rank').innerHTML = top.map((s, i) => `
    <div class="prio-row" style="grid-template-columns:22px 1fr 1.1fr 52px;padding:8px 0;border-bottom:1px solid var(--neutral-100);cursor:pointer" onclick="window.__openDrawer(${s.id})">
      <span class="mono" style="color:var(--neutral-400)">${i + 1}</span>
      <div><div style="font-weight:600;font-size:.9rem">${s.name}</div><div style="font-size:var(--t-small);color:var(--neutral-500)">${s.form} · Bezirk ${s.bezirk}</div></div>
      <div class="tr" style="height:9px;border-radius:5px;background:var(--neutral-200);overflow:hidden;align-self:center"><i style="display:block;height:100%;width:${s.prioritaet / max * 100}%;background:var(--petrol-600)"></i></div>
      <span class="mono" style="text-align:right;font-weight:600;color:var(--error)">${nf1.format(s.prioritaet)}</span>
    </div>`).join('');
}

/* ====================================================================
   INIT
   ==================================================================== */
$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
renderOverview();
})();
