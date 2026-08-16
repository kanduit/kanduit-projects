/* =========================================================================
   Kanduit {{TITLE}} — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-/Vergabe-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_{{DATA_KEY}};
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting (de-DE) ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
/* Geldbeträge immer mit einer Nachkommastelle — sonst steht „60 Mio €“ neben
   „219,4 Mio €“ und eine KPI-Reihe liest sich unsauber. */
const nfMio = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtMio = v => nfMio.format(v / 1e6) + ' Mio €';
const fmtTsd = v => nf.format(Math.round(v / 1000)) + ' T€';
const fmtVal = v => v == null ? '—' : (v >= 1e6 ? fmtMio(v) : fmtTsd(v));
const fmtDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const MONTH_SHORT = { '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez' };
const fmtMonth = m => MONTH_SHORT[m.slice(5, 7)] + ' ' + m.slice(2, 4);
const fmtEur = v => nf.format(Math.round(v)) + ' €';
const fmtPct = v => nf1.format(v * 100) + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ====================================================================
   TABS
   ==================================================================== */
const views = {{VIEWS_MAP}};
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  Object.entries(views).forEach(([k, id]) => $('#' + id).classList.toggle('active', k === name));
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
   METRIC DEFINITIONS — Klartext-Glossar für die ⓘ-Tooltips.
   TODO: ein Eintrag je KPI/Chart; jeder benennt Berechnung UND Datenlücken.
   ==================================================================== */
const METRIC_INFO = {
  // beispiel_kpi: { t: 'Titel der Kennzahl', d: 'Wie sie berechnet wird — und was die öffentlichen Daten NICHT zeigen.' },
};

function infoIcon(key) {
  return METRIC_INFO[key]
    ? ` <span class="info-i" data-info="${key}" tabindex="0" role="button" aria-label="Erklärung: ${METRIC_INFO[key].t}">ⓘ</span>`
    : '';
}
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
   SOURCE NOTES — Quellen-Link unter jeder Chart-Karte.
   Die Labels kommen aus generate.py (meta.quellen), damit Anzeige und
   Datenherkunft nicht auseinanderlaufen können. Im HTML:
   <p class="note src-note" data-src="key"></p>
   verdrahteQuellen() nach jedem Nachrendern aufrufen (Szenario-Karten o. ä.).
   ==================================================================== */
const SRC_LABEL = DATA.meta.quellen || {};
function verdrahteQuellen() {
  $$('.src-note').forEach(n => {
    const s = SRC_LABEL[n.dataset.src]; if (!s || n.dataset.done) return;
    n.dataset.done = '1';
    n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a> · Abruf ${DATA.meta.stand}`;
  });
}

/* ====================================================================
   DEMO-ANNAHMEN — Wortlaut unverändert aus generate.py (ANNAHMEN).
   Jede nicht öffentlich belegte Größe trägt in der Oberfläche ein ◈ mit
   der vollständigen Begründung. Die Trennung echt/angenommen ist bei jedem
   dieser Demonstratoren der Glaubwürdigkeitstest — nicht die Optik.
   ==================================================================== */
const ANNAHME = {};
(DATA.annahmen || []).forEach(a => { ANNAHME[a.k] = a; });

function assumeMark(key) {
  const a = ANNAHME[key];
  return a ? ` <span class="assume" data-assume="${key}" tabindex="0" role="button"
    aria-label="Demo-Annahme: ${esc(a.t)}">◈</span>` : '';
}
function assumeTip(node, x, y) {
  const a = ANNAHME[node.dataset.assume]; if (!a) return;
  showTip(`<b>◈ Demo-Annahme — ${esc(a.t)}</b><div class="def">${esc(a.d)}</div>`, x, y);
}
document.addEventListener('mouseover', e => { const n = e.target.closest && e.target.closest('.assume'); if (n) assumeTip(n, e.clientX, e.clientY); });
document.addEventListener('mousemove', e => { const n = e.target.closest && e.target.closest('.assume'); if (n) assumeTip(n, e.clientX, e.clientY); });
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('.assume')) hideTip(); });
document.addEventListener('focusin', e => { const n = e.target.closest && e.target.closest('.assume'); if (n) { const r = n.getBoundingClientRect(); assumeTip(n, r.right, r.bottom); } });
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.assume')) hideTip(); });

/* ====================================================================
   SVG chart kit
   ==================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

/* horizontal bar chart: rows = [{label, value, valLabel?, color?, tip?}] */
function barChart(container, rows, opts) {
  opts = opts || {};
  const W = 560, rowH = opts.rowH || 30, padL = opts.padL || 170, padR = 76, padT = 8;
  const H = padT * 2 + rows.length * rowH;
  const max = Math.max(...rows.map(r => r.value), 1);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const bw = (W - padL - padR) * (r.value / max);
    const lbl = svgEl('text', { x: padL - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'axis-txt' });
    lbl.textContent = r.label; svg.appendChild(lbl);
    const bar = svgEl('rect', { x: padL, y: y + 5, width: Math.max(bw, 1.5), height: rowH - 14, rx: 3, fill: r.color || 'var(--dv-petrol)', class: 'bar' });
    if (r.tip) {
      bar.addEventListener('mousemove', e => showTip(r.tip, e.clientX, e.clientY));
      bar.addEventListener('mouseleave', hideTip);
    }
    svg.appendChild(bar);
    const val = svgEl('text', { x: padL + Math.max(bw, 1.5) + 8, y: y + rowH / 2 + 4, class: 'bar-label' });
    val.textContent = r.valLabel != null ? r.valLabel : fmtInt(r.value); svg.appendChild(val);
  });
  container.innerHTML = ''; container.appendChild(svg);
}

/* vertical column chart, optionally stacked, with optional break markers.
   cols = [{id, label, n | <stack keys>, tip?}]
   opts: {keys: [{key,color}], legend: [{label,color}], breaks: [{at:id, label, dy?}],
          color, height, labelEvery, showTotals} */
function columnChart(container, cols, opts) {
  opts = opts || {};
  const W = 620, H = opts.height || 240, padL = 40, padR = 10, padT = 20, padB = 34;
  const keys = opts.keys;
  const totals = cols.map(c => keys ? keys.reduce((a, k) => a + (c[k.key] || 0), 0) : c.n);
  const max = Math.max(...totals, 1);
  const iw = (W - padL - padR) / cols.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = max * s / steps, y = H - padB - (H - padT - padB) * (s / steps);
    svg.appendChild(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'gridline' }));
    const t = svgEl('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', class: 'axis-txt' });
    t.textContent = fmtInt(v); svg.appendChild(t);
  }
  cols.forEach((c, i) => {
    const x = padL + i * iw;
    let y0 = H - padB;
    const stacks = keys || [{ key: 'n', color: opts.color || 'var(--dv-petrol)' }];
    stacks.forEach(k => {
      const v = c[k.key] || 0;
      const h = (H - padT - padB) * (v / max);
      if (v > 0) {
        const rect = svgEl('rect', { x: x + iw * 0.14, y: y0 - h, width: iw * 0.72, height: h, rx: 2, fill: k.color, class: 'bar' });
        if (c.tip) { rect.addEventListener('mousemove', e => showTip(c.tip, e.clientX, e.clientY)); rect.addEventListener('mouseleave', hideTip); }
        svg.appendChild(rect);
      }
      y0 -= h;
    });
    if (opts.showTotals) {
      const t = svgEl('text', { x: x + iw / 2, y: y0 - 4, 'text-anchor': 'middle', class: 'bar-label' });
      t.textContent = fmtInt(totals[i]); svg.appendChild(t);
    }
    const everyN = opts.labelEvery || 1;
    if (i % everyN === 0) {
      const t = svgEl('text', { x: x + iw / 2, y: H - padB + 14, 'text-anchor': 'middle', class: 'axis-txt' });
      t.textContent = c.label; svg.appendChild(t);
    }
  });
  (opts.breaks || []).forEach(b => {
    const i = cols.findIndex(c => c.id === b.at);
    if (i < 0) return;
    const x = padL + i * iw;
    svg.appendChild(svgEl('line', { x1: x, y1: padT - 6, x2: x, y2: H - padB, class: 'break-line' }));
    const right = x > (W - padL - padR) * 0.6;
    const t = svgEl('text', { x: right ? x - 4 : x + 4, y: padT + (b.dy || 0),
      'text-anchor': right ? 'end' : 'start', class: 'break-label' });
    t.textContent = b.label; svg.appendChild(t);
  });
  container.innerHTML = ''; container.appendChild(svg);
  if (opts.legend) {
    const lg = el('div', 'legend');
    opts.legend.forEach(l => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${l.color}"></span>${l.label}`)));
    container.appendChild(lg);
  }
}

/* 100% stacked horizontal bar built from divs; parts = [{label, n, color}] */
function mixBar(container, label, parts, totalLabel) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  const row = el('div', 'mixrow');
  row.appendChild(el('div', 'lbl', `${label} · ${totalLabel}`));
  const bar = el('div', 'mixbar');
  parts.forEach(p => {
    const span = el('span');
    span.style.width = (p.n / total * 100) + '%';
    span.style.background = p.color;
    span.addEventListener('mousemove', e => showTip(
      `<b>${p.label}</b><div class="row"><span>Anzahl</span><span>${fmtInt(p.n)}</span></div><div class="row"><span>Anteil</span><span>${nf1.format(p.n / total * 100)} %</span></div>`, e.clientX, e.clientY));
    span.addEventListener('mouseleave', hideTip);
    bar.appendChild(span);
  });
  row.appendChild(bar);
  container.appendChild(row);
}

/* KPI stat tile; s = {k, v, d, cls?: 'ink'|'petrol', info?: METRIC_INFO key} */
function statCard(s) {
  const c = el('div', 'stat' + (s.cls ? ' ' + s.cls : ''));
  c.innerHTML = `<div class="k">${s.k}${infoIcon(s.info)}</div><div class="v">${s.v}</div><div class="d">${s.d}</div>`;
  return c;
}

/* ====================================================================
   VIEWS — eine render-Funktion je Tab.
   TODO: implementieren; nur Kit-Helfer verwenden (statCard, barChart,
   columnChart, mixBar, infoIcon, showTip). Chart-Idiome: siehe
   .claude/skills/build-demo/references/reference.md → Exemplar-Pointer.
   ==================================================================== */
{{RENDER_STUBS}}

/* ====================================================================
   INIT
   ==================================================================== */
$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;

/* Drucken: ein geöffnetes Kennzahlenblatt hat Vorrang, sonst die aktive
   Ansicht — nie alle Ansichten auf einmal. */
$('#print-btn').addEventListener('click', () => {
  const d = $('#drawer');
  document.body.classList.toggle('printing-blatt', !!d && d.classList.contains('show'));
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-blatt'));

/* Querverweise aus Fließtext auf einen Tab: <a href="#" data-goto="tabid">…</a> */
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-goto]'); if (!a) return;
  e.preventDefault(); showView(a.dataset.goto);
});
{{RENDER_CALLS}}
verdrahteQuellen();
})();
