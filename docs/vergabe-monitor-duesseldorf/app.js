/* =========================================================================
   Kanduit Vergabe-Monitor Düsseldorf — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_VERGABE;
const D11 = DATA.cities.DEA11;
const CITY_ORDER = ['DEA11', 'DEA23', 'DEA13', 'DEA52'];
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtMio = v => nf1.format(v / 1e6) + ' Mio €';
const fmtTsd = v => nf.format(Math.round(v / 1000)) + ' T€';
const fmtVal = v => v == null ? '—' : (v >= 1e6 ? fmtMio(v) : fmtTsd(v));
const fmtDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const MONTH_SHORT = { '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez' };
const fmtMonth = m => MONTH_SHORT[m.slice(5, 7)] + ' ' + m.slice(2, 4);

const CAT_LABEL = {
  stadt: 'Landeshauptstadt / Stadt', tochter: 'Städtische Töchter',
  'kommunal-sonst': 'Sonstige kommunale Träger', land: 'Land NRW & Einrichtungen',
  bund: 'Bund & Bahn', sonstige: 'Sonstige öffentliche Auftraggeber',
};
const CAT_COLOR = {
  stadt: 'var(--dv-petrol)', tochter: 'var(--dv-green)', 'kommunal-sonst': 'var(--dv-lime)',
  land: 'var(--dv-orange)', bund: 'var(--dv-violet)', sonstige: 'var(--neutral-400)',
};
const PROC_COLOR = {
  'open': 'var(--dv-petrol)', 'restricted': 'var(--dv-cyan)', 'neg-w-call': 'var(--dv-green)',
  'neg-wo-call': 'var(--dv-coral)', 'comp-dial': 'var(--dv-violet)', 'comp-tend': 'var(--dv-lime)',
  'innovation': 'var(--dv-amber)', 'none': 'var(--neutral-400)',
};
const procColor = key => PROC_COLOR[key] || 'var(--dv-amber)';
const CITY_COLOR = nuts => nuts === 'DEA11' ? 'var(--petrol-600)' : 'var(--neutral-400)';

const SRC_LABEL = {
  bkms: { t: 'Bekanntmachungsservice (Datenservice Öffentlicher Einkauf)', u: DATA.meta.quellen.bkms },
  uiDuesseldorf: { t: 'Bekanntmachungen Düsseldorf (DEA11) — oeffentlichevergabe.de', u: DATA.meta.quellen.uiDuesseldorf },
  einwohner: { t: 'Einwohnerzahlen: IT.NRW, ' + DATA.meta.quellen.einwohnerStand, u: DATA.meta.quellen.einwohner },
};

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview: 'view-overview', dauern: 'view-dauern', direkt: 'view-direkt', benchmark: 'view-benchmark', radar: 'view-radar' };
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
   Jede Kennzahl benennt Berechnung UND Datenlücken.
   ==================================================================== */
const Z = DATA.meta.zeitraum;
const PERIOD = `Zeitraum ${fmtMonth(Z.von + '-01')} – ${fmtMonth(Z.bis + '-01')}`;
const METRIC_INFO = {
  kpi_gesamt: { t: 'Bekanntmachungen gesamt', d: `Alle eForms-Bekanntmachungen mit Erfüllungsort Düsseldorf (NUTS DEA11) im Bekanntmachungsservice: Ausschreibungen, Zuschläge, Vorinformationen, Auftragsänderungen. ${PERIOD}. Unterschwellige Vergaben ohne Bekanntmachungspflicht sind systembedingt nicht enthalten.` },
  kpi_ausschreibungen: { t: 'Ausschreibungen', d: 'Auftragsbekanntmachungen (eForms-Formtyp „competition"). Reale, veröffentlichte Verfahren — keine Schätzung.' },
  kpi_ergebnisse: { t: 'Zuschläge / Ergebnisse', d: 'Zuschlags- und Ergebnisbekanntmachungen (Formtyp „result"). Nicht jedes Verfahren aus dem Zeitraum hat schon ein veröffentlichtes Ergebnis.' },
  kpi_volumen: { t: 'Auftragsvolumen (wo ausgewiesen)', d: `Summe der in Zuschlagsbekanntmachungen ausgewiesenen Auftragswerte. Nur ${fmtInt(D11.resultsWithValue)} von ${fmtInt(D11.results)} Ergebnissen nennen einen Wert — die Summe ist also eine Untergrenze, kein Gesamtvolumen.` },
  kpi_buyers: { t: 'Beteiligte Vergabestellen', d: 'Anzahl unterschiedlicher öffentlicher Auftraggeber, die im Zeitraum mit Erfüllungsort Düsseldorf bekannt gemacht haben — Stadt, Töchter, Land, Bund und weitere.' },
  kpi_bids: { t: 'Median Angebote je Los', d: `Median der in Ergebnisbekanntmachungen ausgewiesenen Angebotszahlen (${fmtInt(D11.bidsN)} Ergebnisse mit Angabe). Kennzahl für Wettbewerbsintensität.` },
  quartal: { t: 'Bekanntmachungen je Quartal', d: 'Zählung nach Veröffentlichungsdatum im Bekanntmachungsservice; nur vollständige Quartale (aktuelles Teilquartal ausgeblendet). „Sonstige" = Vorinformationen, Ex-ante-Transparenz, Auftragsänderungen.' },
  verfahrensart: { t: 'Verfahrensarten-Mix', d: 'Verteilung der eForms-Verfahrensarten über alle Ausschreibungen im Zeitraum. Oberschwellig dominiert das Offene Verfahren; unterschwellige Verfahren erscheinen nur, soweit freiwillig bekannt gemacht.' },
  cpv: { t: 'CPV-Gruppen', d: 'Common Procurement Vocabulary — EU-weit einheitliche Klassifikation des Auftragsgegenstands. Gruppiert nach den ersten zwei Ziffern (Abteilung), gezählt je Ausschreibung (Haupt-CPV).' },
  vergabestellen: { t: 'Beteiligte Vergabestellen', d: 'Öffentliche Auftraggeber laut Bekanntmachung, kategorisiert per Namens-Heuristik: Stadt, städtische Töchter, Land NRW, Bund/Bahn, Sonstige. Auftraggeber sind öffentliche Stellen — Zuschlagsempfänger (Firmen) werden bewusst nicht gerankt.' },
  dauer_median: { t: 'Median-Dauer je Verfahrensart', d: 'Tage zwischen Auftragsbekanntmachung und Zuschlagsentscheidung (bzw. Ergebnisbekanntmachung, wo kein Zuschlagsdatum ausgewiesen ist), verknüpft über die Verfahrens-ID. Median statt Mittelwert — robust gegen Ausreißer. Nur Verfahrensarten mit ≥ 5 Paaren.' },
  dauer_vergleich: { t: 'Median-Dauer im Städtevergleich', d: 'Gleiche Methodik für alle vier Städte: nur Verfahren, bei denen Bekanntmachung und Ergebnis öffentlich verknüpfbar sind. Unterschiede können auch am Verfahrensmix liegen, nicht nur an der Bearbeitungsgeschwindigkeit.' },
  dauer_abdeckung: { t: 'Abdeckung', d: 'Anteil der Ergebnisbekanntmachungen, denen eine Auftragsbekanntmachung im Beobachtungszeitraum zugeordnet werden konnte. Der Rest: Bekanntmachung vor Januar 2024, Direktvergabe ohne Bekanntmachung oder Veröffentlichung auf anderer Plattform.' },
  monatsreihe: { t: 'Ausschreibungen je Monat', d: 'Auftragsbekanntmachungen der Stadt und aller weiteren Vergabestellen mit Erfüllungsort Düsseldorf, je Kalendermonat. Markiert: 01.01.2026 (§ 75a GO NRW — Wegfall der kommunalen Wertgrenzen) und 01.02.2026 (Direktauftragsgrenze 50 T€).' },
  mixvergleich: { t: 'Verfahrensmix vor / nach dem Stichtag', d: 'Anteile der Verfahrensarten an den Ausschreibungen: Gesamtjahr 2025 gegenüber 2026 (bis zum letzten vollen Quartal). Prozentwerte, daher trotz unterschiedlicher Zeitraumlängen vergleichbar.' },
  veat: { t: 'Freiwillige Ex-ante-Transparenz (VEAT)', d: 'Bekanntmachungen, mit denen ein Auftraggeber eine beabsichtigte Direktvergabe freiwillig vorab transparent macht (Formtyp „dir-awa-pre"). Die geringe Zahl zeigt: Das Gros der Direktaufträge bleibt öffentlich unsichtbar.' },
  bench_rate: { t: 'Bekanntmachungen je 100.000 Einwohner', d: 'Gesamtzahl der Bekanntmachungen im Zeitraum, geteilt durch die amtliche Einwohnerzahl (IT.NRW, ' + DATA.meta.quellen.einwohnerStand + '), mal 100.000. Achtung Landeshauptstadt-Effekt: In Düsseldorf schreiben auch viele Landeseinrichtungen aus.' },
  buyer_cats: { t: 'Auftraggeber-Kategorien', d: 'Namens-Heuristik über die Auftraggeber der Bekanntmachungen: Stadtverwaltung, städtische Töchter, Land NRW (inkl. Unikliniken, Hochschulen, Landesbetriebe), Bund & Bahn, Sonstige. Macht den Landeshauptstadt-Effekt im Benchmark sichtbar.' },
  radar_frist: { t: 'Simulierte Meldefrist', d: 'Zuschlagsdatum (wo ausgewiesen, sonst Datum der Ergebnisbekanntmachung) + 60 Tage — die Meldefrist der VergStatVO für Aufträge ab 25 T€ netto. Ob die Meldung an Destatis tatsächlich erfolgt ist, ist öffentlich nicht sichtbar; die Ansicht ist eine Konzept-Demonstration.' },
  radar_fenster: { t: 'Zuschläge im Radar-Fenster', d: 'Ergebnisbekanntmachungen für Düsseldorf, deren simulierte 60-Tage-Frist heute noch läuft oder in den letzten 4 Monaten ablief.' },
  radar_offen: { t: 'Frist läuft', d: 'Simulierte Meldefristen, die am Stichtag (Datenstand) noch nicht abgelaufen sind.' },
  radar_knapp: { t: 'Frist < 14 Tage', d: 'Davon Fristen, die binnen 14 Tagen ablaufen — im echten Betrieb der Trigger für Erinnerungen und Vorbefüllung.' },
  radar_abgelaufen: { t: 'Frist abgelaufen', d: 'Simulierte Fristen im Fenster, die bereits abgelaufen sind. Heißt nicht „Meldung versäumt" — der tatsächliche Meldestatus steht nur in internen Systemen.' },
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

/* source footnotes under every chart card */
$$('.src-note').forEach(n => {
  const s = SRC_LABEL[n.dataset.src]; if (!s) return;
  n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a> · Abruf ${DATA.meta.stand}`;
});

/* ====================================================================
   SVG helpers
   ==================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

/* horizontal bar chart (labels left, value right) */
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

/* vertical column chart, optionally stacked, with optional break markers */
function columnChart(container, cols, opts) {
  opts = opts || {};
  const W = 620, H = opts.height || 240, padL = 40, padR = 10, padT = 20, padB = 34;
  const keys = opts.keys;                          // [{key,label,color}] for stacks
  const totals = cols.map(c => keys ? keys.reduce((a, k) => a + (c[k.key] || 0), 0) : c.n);
  const max = Math.max(...totals, 1);
  const iw = (W - padL - padR) / cols.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  // y gridlines
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
  // break markers between columns (e.g. rule changes)
  (opts.breaks || []).forEach(b => {
    const i = cols.findIndex(c => c.id === b.at);
    if (i < 0) return;
    const x = padL + i * iw;                       // left edge of that column
    svg.appendChild(svgEl('line', { x1: x, y1: padT - 6, x2: x, y2: H - padB, class: 'break-line' }));
    const right = x > (W - padL - padR) * 0.6;     // anchor away from the nearer edge
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

/* 100% stacked horizontal bar built from divs */
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

function statCard(s) {
  const c = el('div', 'stat' + (s.cls ? ' ' + s.cls : ''));
  c.innerHTML = `<div class="k">${s.k}${infoIcon(s.info)}</div><div class="v">${s.v}</div><div class="d">${s.d}</div>`;
  return c;
}

/* ====================================================================
   ÜBERBLICK
   ==================================================================== */
function renderOverview() {
  const kpis = [
    { k: 'Bekanntmachungen', v: fmtInt(D11.total), d: `${fmtMonth(Z.von + '-01')} – ${fmtMonth(Z.bis + '-01')}`, info: 'kpi_gesamt' },
    { k: 'Ausschreibungen', v: fmtInt(D11.competitions), d: 'Auftragsbekanntmachungen', info: 'kpi_ausschreibungen' },
    { k: 'Zuschläge / Ergebnisse', v: fmtInt(D11.results), d: 'veröffentlichte Ergebnisse', cls: 'petrol', info: 'kpi_ergebnisse' },
    { k: 'Volumen (ausgewiesen)', v: fmtMio(D11.awardSum), d: `bei ${fmtInt(D11.resultsWithValue)} von ${fmtInt(D11.results)} Zuschlägen`, cls: 'ink', info: 'kpi_volumen' },
    { k: 'Vergabestellen', v: fmtInt(D11.distinctBuyers), d: 'Stadt · Töchter · Land · Bund', info: 'kpi_buyers' },
    { k: 'Median Angebote/Los', v: nf1.format(D11.bidsMedian), d: 'Wettbewerbsintensität', info: 'kpi_bids' },
  ];
  const wrap = $('#kpis'); wrap.innerHTML = '';
  kpis.forEach(s => wrap.appendChild(statCard(s)));

  // quarterly stacked columns
  const qcols = D11.quarterly.map(q => ({
    id: q.q,
    label: q.q.replace('20', "Q" + q.q.slice(6) + " '").slice(-6),  // -> "Q1 '24"
    competition: q.competition, result: q.result, other: q.other,
    tip: `<b>${q.q}</b><div class="row"><span>Ausschreibungen</span><span>${q.competition}</span></div><div class="row"><span>Zuschläge/Ergebnisse</span><span>${q.result}</span></div><div class="row"><span>Sonstige</span><span>${q.other}</span></div>`,
  }));
  columnChart($('#chart-quartal'), qcols, {
    keys: [
      { key: 'competition', color: 'var(--dv-petrol)' },
      { key: 'result', color: 'var(--petrol-300)' },
      { key: 'other', color: 'var(--neutral-300)' },
    ],
    legend: [
      { label: 'Ausschreibungen', color: 'var(--dv-petrol)' },
      { label: 'Zuschläge/Ergebnisse', color: 'var(--petrol-300)' },
      { label: 'Sonstige', color: 'var(--neutral-300)' },
    ],
    showTotals: true,
  });

  // procedure mix
  barChart($('#chart-verfahren'), D11.procMix.map(p => ({
    label: p.label.length > 30 ? p.label.slice(0, 29) + '…' : p.label,
    value: p.n, color: procColor(p.key),
    tip: `<b>${p.label}</b><div class="row"><span>Ausschreibungen</span><span>${fmtInt(p.n)}</span></div><div class="row"><span>Anteil</span><span>${nf1.format(p.n / D11.competitions * 100)} %</span></div>`,
  })), { padL: 190 });

  // CPV top 10
  barChart($('#chart-cpv'), D11.cpvTop.map(p => ({
    label: p.label, value: p.n, color: 'var(--petrol-500)',
    tip: `<b>CPV ${p.div} — ${p.label}</b><div class="row"><span>Ausschreibungen</span><span>${fmtInt(p.n)}</span></div>`,
  })), { padL: 190 });

  // buyers: category mix + top list (fixed order — Stadt first, like Benchmark view)
  const box = $('#chart-buyers'); box.innerHTML = '';
  const catParts = ['stadt', 'tochter', 'kommunal-sonst', 'land', 'bund', 'sonstige']
    .map(k => ({ label: CAT_LABEL[k], n: D11.buyerCats[k] || 0, color: CAT_COLOR[k] }))
    .filter(p => p.n > 0);
  mixBar(box, 'Alle Bekanntmachungen nach Auftraggeber-Kategorie', catParts, fmtInt(D11.total));
  const lg = el('div', 'legend');
  catParts.forEach(p => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${p.color}"></span>${p.label} (${fmtInt(p.n)})`)));
  box.appendChild(lg);
  const list = el('div');
  list.style.marginTop = '14px';
  D11.topBuyers.slice(0, 8).forEach(b => {
    list.appendChild(el('div', 'buyer-row',
      `<span class="nm">${b.name}</span><span style="display:flex;gap:8px;align-items:center"><span class="pill cat-${b.cat}">${CAT_LABEL[b.cat].split(' ')[0].replace('/', '')}</span><span class="n">${fmtInt(b.n)}</span></span>`));
  });
  box.appendChild(list);
}

/* ====================================================================
   VERFAHRENSDAUERN
   ==================================================================== */
function renderDauern() {
  const d = DATA.dauern.DEA11;
  const cov = Math.round(d.matched / d.results * 100);
  $('#dauer-kpis').innerHTML = '';
  [
    { k: 'Median gesamt', v: fmtInt(d.medianAll) + ' Tage', d: 'Bekanntmachung → Zuschlag', cls: 'petrol', info: 'dauer_median' },
    { k: 'Spannweite (P25–P75)', v: `${fmtInt(d.p25)}–${fmtInt(d.p75)}`, d: 'Tage · mittlere 50 %', info: 'dauer_median' },
    { k: 'Auswertbare Paare', v: fmtInt(d.matched), d: `von ${fmtInt(d.results)} Ergebnissen`, info: 'dauer_abdeckung' },
    { k: 'Abdeckung', v: cov + ' %', d: 'ehrlich ausgewiesen', cls: 'ink', info: 'dauer_abdeckung' },
  ].forEach(s => $('#dauer-kpis').appendChild(statCard(s)));

  $('#dauer-gap').innerHTML = `<b>Datenlücke, transparent gemacht:</b> ${fmtInt(d.results - d.matched)} der
    ${fmtInt(d.results)} Ergebnisbekanntmachungen (${100 - cov} %) lassen sich keiner Auftragsbekanntmachung im
    Beobachtungszeitraum zuordnen — Bekanntmachung vor Januar 2024, Verfahren ohne vorherige Bekanntmachung
    oder Veröffentlichung auf anderer Plattform. Mit internen Verfahrensdaten wäre die Abdeckung vollständig.`;

  barChart($('#chart-dauer-proc'), d.byProc.map(p => ({
    label: p.label.length > 30 ? p.label.slice(0, 29) + '…' : p.label,
    value: p.median, valLabel: fmtInt(p.median) + ' T.',
    color: procColor(p.key),
    tip: `<b>${p.label}</b><div class="row"><span>Median</span><span>${fmtInt(p.median)} Tage</span></div><div class="row"><span>P25–P75</span><span>${fmtInt(p.p25)}–${fmtInt(p.p75)} Tage</span></div><div class="row"><span>Verfahren (Paare)</span><span>${fmtInt(p.n)}</span></div>`,
  })), { padL: 190 });

  barChart($('#chart-dauer-city'), CITY_ORDER.map(nuts => {
    const dd = DATA.dauern[nuts], c = DATA.cities[nuts];
    return {
      label: c.name, value: dd.medianAll, valLabel: fmtInt(dd.medianAll) + ' T.',
      color: CITY_COLOR(nuts),
      tip: `<b>${c.name}</b><div class="row"><span>Median</span><span>${fmtInt(dd.medianAll)} Tage</span></div><div class="row"><span>P25–P75</span><span>${fmtInt(dd.p25)}–${fmtInt(dd.p75)} Tage</span></div><div class="row"><span>Paare</span><span>${fmtInt(dd.matched)} von ${fmtInt(dd.results)}</span></div>`,
    };
  }), { padL: 110 });
}

/* ====================================================================
   DIREKTAUFTRAG 2026
   ==================================================================== */
function renderDirekt() {
  const S = DATA.szenario;
  const monthly = S.monthlyComp;
  const m2025 = monthly.filter(m => m.m >= '2025-01' && m.m <= '2025-12');
  const m2026 = monthly.filter(m => m.m >= '2026-01');
  const avg = arr => arr.length ? arr.reduce((a, m) => a + m.n, 0) / arr.length : 0;
  const a25 = avg(m2025), a26 = avg(m2026);
  const delta = a25 ? Math.round((a26 - a25) / a25 * 100) : 0;
  const veatTotal = S.veatMonthly.reduce((a, m) => a + m.n, 0);
  const veat2026 = S.veatMonthly.filter(m => m.m >= '2026-01').reduce((a, m) => a + m.n, 0);

  $('#direkt-kpis').innerHTML = '';
  [
    { k: 'Ø Ausschreibungen/Monat 2025', v: nf1.format(a25), d: S.vorLabel, info: 'monatsreihe' },
    { k: 'Ø Ausschreibungen/Monat 2026', v: nf1.format(a26), d: S.nachLabel, cls: 'petrol', info: 'monatsreihe' },
    { k: 'Veränderung', v: (delta > 0 ? '+' : '') + delta + ' %', d: 'öffentlich sichtbares Aufkommen', cls: 'ink', info: 'monatsreihe' },
    { k: 'Ex-ante-Transparenz', v: fmtInt(veatTotal), d: `davon ${fmtInt(veat2026)} seit Jan 2026`, info: 'veat' },
  ].forEach(s => $('#direkt-kpis').appendChild(statCard(s)));

  // monthly columns with rule-change markers
  columnChart($('#chart-monat'), monthly.map(m => ({
    id: m.m, label: fmtMonth(m.m), n: m.n,
    tip: `<b>${fmtMonth(m.m)}</b><div class="row"><span>Ausschreibungen</span><span>${m.n}</span></div>`,
  })), {
    color: 'var(--dv-petrol)', labelEvery: 3, height: 250,
    breaks: [
      { at: '2026-01', label: '§ 75a GO NRW', dy: 0 },
      { at: '2026-02', label: 'Direktauftrag ≤ 50 T€', dy: 12 },
    ],
  });

  // mix comparison (share bars)
  const box = $('#chart-mix'); box.innerHTML = '';
  const mkParts = mix => mix.mix.map(p => ({ label: p.label, n: p.n, color: procColor(p.key) }));
  mixBar(box, S.vorLabel, mkParts(S.vor), fmtInt(S.vor.n) + ' Ausschreibungen');
  mixBar(box, S.nachLabel, mkParts(S.nach), fmtInt(S.nach.n) + ' Ausschreibungen');
  const lgKeys = {};
  [...S.vor.mix, ...S.nach.mix].forEach(p => { lgKeys[p.key] = p; });
  const lg = el('div', 'legend');
  Object.values(lgKeys).forEach(p => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${procColor(p.key)}"></span>${p.label}`)));
  box.appendChild(lg);
  box.appendChild(el('p', 'note', 'Oberschwellige Verfahren ändern sich durch § 75a GO NRW kaum — der Umbruch findet ' +
    'unterhalb der Schwellenwerte statt und ist hier systembedingt unsichtbar. Der sichtbare Mix ist die Referenz, ' +
    'gegen die interne Zahlen gelesen werden.'));

  // VEAT monthly
  columnChart($('#chart-veat'), S.veatMonthly.map(m => ({
    id: m.m, label: fmtMonth(m.m), n: m.n,
    tip: `<b>${fmtMonth(m.m)}</b><div class="row"><span>VEAT-Bekanntmachungen</span><span>${m.n}</span></div>`,
  })), { color: 'var(--dv-orange)', labelEvery: 3, height: 200, breaks: [{ at: '2026-02', label: 'Direktauftrag ≤ 50 T€', dy: 0 }] });
}

/* ====================================================================
   BENCHMARK
   ==================================================================== */
function renderBenchmark() {
  const per100k = c => c.total / c.einwohner * 100000;
  const kommShare = c => {
    const k = (c.buyerCats.stadt || 0) + (c.buyerCats.tochter || 0) + (c.buyerCats['kommunal-sonst'] || 0);
    return k / c.total * 100;
  };
  $('#bench-kpis').innerHTML = '';
  CITY_ORDER.forEach(nuts => {
    const c = DATA.cities[nuts];
    $('#bench-kpis').appendChild(statCard({
      k: c.name, v: nf1.format(per100k(c)),
      d: `Bekanntm. je 100.000 Einw. · ${fmtInt(c.total)} gesamt`,
      cls: nuts === 'DEA11' ? 'petrol' : '', info: 'bench_rate',
    }));
  });

  barChart($('#chart-bench-rate'), CITY_ORDER.map(nuts => {
    const c = DATA.cities[nuts];
    return {
      label: c.name, value: per100k(c), valLabel: nf1.format(per100k(c)),
      color: CITY_COLOR(nuts),
      tip: `<b>${c.name}</b><div class="row"><span>Bekanntmachungen</span><span>${fmtInt(c.total)}</span></div><div class="row"><span>Einwohner</span><span>${fmtInt(c.einwohner)}</span></div><div class="row"><span>je 100.000</span><span>${nf1.format(per100k(c))}</span></div><div class="row"><span>kommunaler Anteil</span><span>${fmtInt(kommShare(c))} %</span></div>`,
    };
  }), { padL: 110 });

  barChart($('#chart-bench-dauer'), CITY_ORDER.map(nuts => {
    const c = DATA.cities[nuts], d = DATA.dauern[nuts];
    return {
      label: c.name, value: d.medianAll, valLabel: fmtInt(d.medianAll) + ' T.',
      color: CITY_COLOR(nuts),
      tip: `<b>${c.name}</b><div class="row"><span>Median</span><span>${fmtInt(d.medianAll)} Tage</span></div><div class="row"><span>Paare</span><span>${fmtInt(d.matched)} von ${fmtInt(d.results)}</span></div>`,
    };
  }), { padL: 110 });

  // buyer categories per city (share bars)
  const box = $('#chart-bench-cats'); box.innerHTML = '';
  const CAT_ORDER = ['stadt', 'tochter', 'kommunal-sonst', 'land', 'bund', 'sonstige'];
  CITY_ORDER.forEach(nuts => {
    const c = DATA.cities[nuts];
    mixBar(box, c.name, CAT_ORDER.map(k => ({ label: CAT_LABEL[k], n: c.buyerCats[k] || 0, color: CAT_COLOR[k] })), fmtInt(c.total));
  });
  const lg = el('div', 'legend');
  CAT_ORDER.forEach(k => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${CAT_COLOR[k]}"></span>${CAT_LABEL[k]}`)));
  box.appendChild(lg);

  // raw table
  const rows = [
    ['Einwohner (IT.NRW)', c => fmtInt(c.einwohner)],
    ['Bekanntmachungen', c => fmtInt(c.total)],
    ['Ausschreibungen', c => fmtInt(c.competitions)],
    ['Zuschläge/Ergebnisse', c => fmtInt(c.results)],
    ['Volumen ausgewiesen', c => fmtMio(c.awardSum)],
    ['… bei Zuschlägen', c => fmtInt(c.resultsWithValue) + ' / ' + fmtInt(c.results)],
    ['Median-Dauer (Tage)', (c, nuts) => fmtInt(DATA.dauern[nuts].medianAll)],
    ['Median Angebote/Los', c => c.bidsMedian == null ? '—' : nf1.format(c.bidsMedian)],
    ['Vergabestellen', c => fmtInt(c.distinctBuyers)],
  ];
  $('#bench-table').innerHTML =
    `<thead><tr><th>Kennzahl</th>${CITY_ORDER.map(n => `<th class="num">${DATA.cities[n].name}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map(([lbl, fn]) => `<tr><td>${lbl}</td>${CITY_ORDER.map(n => `<td class="num">${fn(DATA.cities[n], n)}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

/* ====================================================================
   MELDE-RADAR (schematisch)
   ==================================================================== */
function renderRadar() {
  const R = DATA.radar;
  $('#radar-kpis').innerHTML = '';
  [
    { k: 'Zuschläge im Fenster', v: fmtInt(R.n90), d: 'letzte ~6 Monate', info: 'radar_fenster' },
    { k: 'Frist läuft', v: fmtInt(R.offen), d: 'simulierte 60-Tage-Frist', cls: 'petrol', info: 'radar_offen' },
    { k: 'Frist < 14 Tage', v: fmtInt(R.unter14), d: 'Trigger für Erinnerung', cls: 'ink', info: 'radar_knapp' },
    { k: 'Frist abgelaufen', v: fmtInt(R.abgelaufen), d: 'Meldestatus nur intern sichtbar', info: 'radar_abgelaufen' },
  ].forEach(s => $('#radar-kpis').appendChild(statCard(s)));

  const MAX_ROWS = 40;
  const items = R.items.filter(r => r.rest >= 0).concat(R.items.filter(r => r.rest < 0)).slice(0, MAX_ROWS);
  // the category pill already says "Landeshauptstadt" — strip the boilerplate prefix
  const buyerShort = b => b.replace(/^Landeshauptstadt Düsseldorf,?\s*(Der Oberbürgermeister,?\s*)?/i, '') || b;
  const pill = r => r.rest < 0
    ? `<span class="pill err">abgelaufen</span>`
    : r.rest < 14 ? `<span class="pill warn">${r.rest} Tage</span>` : `<span class="pill ok">${r.rest} Tage</span>`;
  $('#radar-table').innerHTML =
    `<thead><tr><th>Vergabestelle</th><th>Basis</th><th class="num">Zuschlag/Ergebnis</th><th class="num">Meldefrist (simuliert)</th><th class="num">Rest</th><th class="num">Wert (ausgew.)</th></tr></thead>` +
    `<tbody>${items.map(r => `<tr>
      <td style="max-width:340px;overflow-wrap:anywhere"><span class="pill cat-${r.cat}" style="margin-right:6px">${(CAT_LABEL[r.cat] || '').split(' ')[0].replace('/', '')}</span>${buyerShort(r.buyer)}</td>
      <td style="white-space:nowrap;color:var(--neutral-500);font-size:var(--t-small)">${r.basisTyp}</td>
      <td class="num">${fmtDate(r.basis)}</td>
      <td class="num">${fmtDate(r.frist)}</td>
      <td class="num">${pill(r)}</td>
      <td class="num">${fmtVal(r.value)}</td>
    </tr>`).join('')}</tbody>`;
  if (R.items.length > MAX_ROWS) {
    $('#radar-table').insertAdjacentHTML('afterend',
      `<p class="note">Angezeigt: ${MAX_ROWS} von ${fmtInt(R.items.length)} Einträgen im Fenster — laufende Fristen zuerst. ` +
      `${fmtInt(R.mitZuschlagsdatum)} von ${fmtInt(R.gesamtResults)} Ergebnissen im Gesamtzeitraum weisen ein explizites Zuschlagsdatum aus.</p>`);
  }
}

/* ====================================================================
   INIT
   ==================================================================== */
$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
renderOverview();
renderDauern();
renderDirekt();
renderBenchmark();
renderRadar();
})();
