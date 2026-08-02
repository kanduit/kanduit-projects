/* =========================================================================
   Kanduit Vergabe-Monitor Düsseldorf — application logic
   (vanilla JS, no build step; gleiche Systematik wie Kommunalatlas NRW)

   Auswertungseinheit ist durchgängig die VERGABESTELLE. Der Erfüllungsort
   (NUTS) ist nur der Filter der Quelle und wird ausschließlich in der Ansicht
   „Wer beschafft?" als Zerlegung gezeigt — nie als Kennzahl der Stadt.
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_VERGABE;
const D11 = DATA.cities.DEA11;
const KERN = D11.kern;                       // Kernverwaltung = Auftraggeber Stadt
const CITY_ORDER = ['DEA11', 'DEA23', 'DEA13', 'DEA52'];
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtMio = v => nf1.format(v / 1e6) + ' Mio €';
const fmtPct = v => nf1.format(v) + ' %';

const TL = DATA.traegerLabel;
const TRAEGER_COLOR = {
  kern: 'var(--dv-petrol)', beteiligung: 'var(--dv-green)', kommunal: 'var(--dv-lime)',
  land: 'var(--dv-orange)', bund: 'var(--dv-violet)', unternehmen: 'var(--dv-cyan)',
  unklar: 'var(--neutral-400)',
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
const views = { overview: 'view-overview', stellen: 'view-stellen', dauern: 'view-dauern',
                wettbewerb: 'view-wettbewerb', benchmark: 'view-benchmark' };
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  Object.entries(views).forEach(([k, id]) => $('#' + id).classList.toggle('active', k === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showView(b.dataset.view); });
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goto]'); if (!a) return;
  e.preventDefault(); showView(a.dataset.goto);
});

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
const PERIOD = `Zeitraum ${Z.von} bis ${Z.bis}`;
const PLATZ = D11.platz;
const faktor = KERN.total ? (PLATZ.total / KERN.total) : 0;

const METRIC_INFO = {
  kpi_gesamt: { t: 'Bekanntmachungen der Stadt', d: `eForms-Bekanntmachungen, deren Auftraggeber die Kernverwaltung der Landeshauptstadt ist (Ämter und Eigenbetriebe). ${PERIOD}. Nicht enthalten: andere öffentliche Auftraggeber am selben Ort sowie unterschwellige Vergaben ohne Bekanntmachungspflicht.` },
  kpi_ausschreibungen: { t: 'Ausschreibungen', d: 'Auftragsbekanntmachungen der Kernverwaltung (eForms-Formtyp „competition"). Reale, veröffentlichte Verfahren — keine Schätzung.' },
  kpi_ergebnisse: { t: 'Zuschläge / Ergebnisse', d: 'Zuschlags- und Ergebnisbekanntmachungen der Kernverwaltung (Formtyp „result"). Nicht jedes Verfahren im Zeitraum hat schon ein veröffentlichtes Ergebnis.' },
  kpi_volumen: { t: 'Auftragsvolumen (wo ausgewiesen)', d: `Summe der in Zuschlagsbekanntmachungen der Stadt ausgewiesenen Auftragswerte. Nur ${fmtInt(KERN.resultsWithValue)} von ${fmtInt(KERN.results)} Ergebnissen nennen einen Wert — die Summe ist eine Untergrenze, kein Gesamtvolumen.` },
  kpi_stellen: { t: 'Vergabestellen der Stadt', d: 'Anzahl unterschiedlich benannter Vergabestellen innerhalb der Kernverwaltung (Zentrale Vergabestelle, Eigenbetriebe, einzelne Ämter). Schreibweisen können variieren; die Zahl ist daher eine Obergrenze.' },
  kpi_bids: { t: 'Median Angebote je Los', d: `Median der in Ergebnisbekanntmachungen der Stadt ausgewiesenen Angebotszahlen (${fmtInt(KERN.bidsN)} Ergebnisse mit Angabe).` },
  quartal: { t: 'Bekanntmachungen je Quartal', d: 'Zählung nach Veröffentlichungsdatum, nur Verfahren der Kernverwaltung und nur vollständige Quartale (aktuelles Teilquartal ausgeblendet). „Sonstige" = Vorinformationen, Ex-ante-Transparenz, Auftragsänderungen.' },
  verfahrensart: { t: 'Verfahrensarten-Mix', d: 'Verteilung der eForms-Verfahrensarten über die Ausschreibungen der Kernverwaltung. Oberschwellig dominiert das Offene Verfahren; unterschwellige Verfahren erscheinen nur, soweit freiwillig bekannt gemacht.' },
  cpv: { t: 'CPV-Gruppen', d: 'Common Procurement Vocabulary — EU-weit einheitliche Klassifikation des Auftragsgegenstands, gruppiert nach den ersten zwei Ziffern (Abteilung), gezählt je Ausschreibung der Stadt (Haupt-CPV).' },
  stellen_kern: { t: 'Vergabestellen der Stadt', d: 'Welche Stellen der Stadt selbst bekannt machen — die Zentrale Vergabestelle bündelt den Großteil, Eigenbetriebe treten daneben eigenständig auf. Grundlage ist der in der Bekanntmachung genannte Auftraggeber.' },

  traegermix: { t: 'Zerlegung nach Träger', d: 'Alle Bekanntmachungen mit Erfüllungsort Düsseldorf, aufgeteilt nach dem tatsächlichen Auftraggeber. Zuordnung mehrstufig: eindeutige Kennung bzw. Name der Stadt, sonst die amtliche eForms-Selbstauskunft „Art des Auftraggebers" (Suffixe kommunal/Land/Bund), sonst konservative Namensmuster. Nicht eindeutig Zuordenbares wird als solches ausgewiesen statt stillschweigend einsortiert.' },
  stellenliste: { t: 'Vergabestellen je Träger', d: 'Öffentliche Auftraggeber, gezählt nach Bekanntmachungen. Auftraggeber sind öffentliche Stellen — Zuschlagsempfänger (Firmen) werden bewusst nicht genannt und nicht gerankt.' },
  ortsfaktor: { t: 'Überzeichnung durch den Ortsfilter', d: `Verhältnis aller Bekanntmachungen mit Erfüllungsort Düsseldorf (${fmtInt(PLATZ.total)}) zu denen der städtischen Kernverwaltung (${fmtInt(KERN.total)}). Wer nur nach Ort filtert, überzeichnet das Beschaffungsvolumen der Stadt um diesen Faktor.` },
  unklar: { t: 'Nicht zuordenbar', d: 'Anteil der Bekanntmachungen, deren Auftraggeber sich nicht zweifelsfrei einem Träger zuordnen lässt — meist weil die Bekanntmachung keinen Auftraggebernamen im ausgewerteten Feld führt. Wird ausgewiesen statt geschätzt.' },

  dauer_median: { t: 'Median-Dauer je Verfahrensart', d: 'Tage zwischen Auftragsbekanntmachung und Zuschlagsentscheidung (bzw. Ergebnisbekanntmachung, wo kein Zuschlagsdatum ausgewiesen ist), verknüpft über die Verfahrens-ID, nur innerhalb der Kernverwaltung. Median statt Mittelwert — robust gegen Ausreißer. Nur Verfahrensarten mit ≥ 5 Paaren.' },
  dauer_vergleich: { t: 'Median-Dauer im Städtevergleich', d: 'Gleiche Methodik in allen vier Städten, jeweils nur für die Kernverwaltung. Unterschiede können auch am Verfahrensmix liegen, nicht nur an der Bearbeitungsgeschwindigkeit.' },
  dauer_abdeckung: { t: 'Abdeckung', d: 'Anteil der Ergebnisbekanntmachungen der Stadt, denen eine Auftragsbekanntmachung im Beobachtungszeitraum zugeordnet werden konnte. Der Rest: Bekanntmachung vor Januar 2024, Verfahren ohne vorherige Bekanntmachung oder Veröffentlichung auf anderer Plattform.' },

  wett_median: { t: 'Median Angebote je Zuschlag', d: 'Median der in Zuschlagsbekanntmachungen der Stadt ausgewiesenen Angebotszahlen. Kennzahl für Wettbewerbsintensität: Je niedriger, desto dünner der Markt.' },
  wett_buckets: { t: 'Verteilung der Angebotszahlen', d: 'Wie viele Zuschläge der Stadt auf 1, 2, 3–5, 6–9 bzw. 10+ Angebote entfielen. Verfahren mit nur einem Angebot sind vergaberechtlich zulässig, aber ein Signal für Marktenge oder zu enge Leistungsbeschreibung.' },
  wett_cpv: { t: 'Wettbewerb je Warengruppe', d: 'Median-Angebotszahl je CPV-Abteilung, aufsteigend sortiert — oben die Warengruppen mit dem dünnsten Wettbewerb. Nur Gruppen mit mindestens 8 Zuschlägen, damit einzelne Verfahren das Bild nicht verzerren.' },

  bench_rate: { t: 'Bekanntmachungen je 100.000 Einwohner', d: 'Bekanntmachungen der jeweiligen Kernverwaltung im Zeitraum, geteilt durch die amtliche Einwohnerzahl (IT.NRW, ' + DATA.meta.quellen.einwohnerStand + '), mal 100.000. Erst die Eingrenzung auf die Kernverwaltung macht den Vergleich belastbar.' },
  bench_effekt: { t: 'Ortsfilter vs. Auftraggeberfilter', d: 'Je Stadt: alle Bekanntmachungen am Ort gegenüber denen der Kernverwaltung. Der Abstand ist der Landeshauptstadt- bzw. Klinikums-Effekt — in Düsseldorf besonders groß, weil hier viele Landesbehörden sitzen.' },
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
   SVG chart kit
   ==================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

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

/* grouped horizontal bars: rows = [{label, a, b, ...}] with two series */
function pairedBarChart(container, rows, opts) {
  const W = 560, rowH = 42, padL = opts.padL || 110, padR = 90, padT = 10;
  const H = padT * 2 + rows.length * rowH;
  const max = Math.max(...rows.map(r => Math.max(r.a, r.b)), 1);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const lbl = svgEl('text', { x: padL - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'axis-txt' });
    lbl.textContent = r.label; svg.appendChild(lbl);
    [['a', opts.colorA, 4], ['b', opts.colorB, 19]].forEach(([k, color, dy]) => {
      const bw = (W - padL - padR) * (r[k] / max);
      const bar = svgEl('rect', { x: padL, y: y + dy, width: Math.max(bw, 1.5), height: 13, rx: 3, fill: color, class: 'bar' });
      if (r.tip) {
        bar.addEventListener('mousemove', e => showTip(r.tip, e.clientX, e.clientY));
        bar.addEventListener('mouseleave', hideTip);
      }
      svg.appendChild(bar);
      const t = svgEl('text', { x: padL + Math.max(bw, 1.5) + 7, y: y + dy + 11, class: 'bar-label' });
      t.textContent = fmtInt(r[k]); svg.appendChild(t);
    });
  });
  container.innerHTML = ''; container.appendChild(svg);
  if (opts.legend) {
    const lg = el('div', 'legend');
    opts.legend.forEach(l => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${l.color}"></span>${l.label}`)));
    container.appendChild(lg);
  }
}

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
    if (i % (opts.labelEvery || 1) === 0) {
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
      `<b>${p.label}</b><div class="row"><span>Bekanntmachungen</span><span>${fmtInt(p.n)}</span></div><div class="row"><span>Anteil</span><span>${nf1.format(p.n / total * 100)} %</span></div>`, e.clientX, e.clientY));
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
const fill = (sel, cards) => { const b = $(sel); b.innerHTML = ''; cards.forEach(s => b.appendChild(statCard(s))); };

/* ====================================================================
   ÜBERBLICK (Kernverwaltung)
   ==================================================================== */
function renderOverview() {
  fill('#kpis', [
    { k: 'Bekanntmachungen der Stadt', v: fmtInt(KERN.total), d: `${Z.von} – ${Z.bis}`, info: 'kpi_gesamt' },
    { k: 'Ausschreibungen', v: fmtInt(KERN.competitions), d: 'Auftragsbekanntmachungen', info: 'kpi_ausschreibungen' },
    { k: 'Zuschläge / Ergebnisse', v: fmtInt(KERN.results), d: 'veröffentlichte Ergebnisse', cls: 'petrol', info: 'kpi_ergebnisse' },
    { k: 'Volumen (ausgewiesen)', v: fmtMio(KERN.awardSum), d: `bei ${fmtInt(KERN.resultsWithValue)} von ${fmtInt(KERN.results)} Zuschlägen`, cls: 'ink', info: 'kpi_volumen' },
    { k: 'Vergabestellen der Stadt', v: fmtInt(KERN.distinctStellen), d: 'Ämter & Eigenbetriebe', info: 'kpi_stellen' },
    { k: 'Median Angebote/Los', v: KERN.bidsMedian == null ? '—' : nf1.format(KERN.bidsMedian), d: 'Wettbewerbsintensität', info: 'kpi_bids' },
  ]);

  columnChart($('#chart-quartal'), KERN.quarterly.map(q => ({
    id: q.q, label: 'Q' + q.q.slice(6) + " '" + q.q.slice(2, 4),
    competition: q.competition, result: q.result, other: q.other,
    tip: `<b>${q.q}</b><div class="row"><span>Ausschreibungen</span><span>${q.competition}</span></div><div class="row"><span>Zuschläge/Ergebnisse</span><span>${q.result}</span></div><div class="row"><span>Sonstige</span><span>${q.other}</span></div>`,
  })), {
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

  barChart($('#chart-verfahren'), KERN.procMix.map(p => ({
    label: p.label.length > 30 ? p.label.slice(0, 29) + '…' : p.label,
    value: p.n, color: procColor(p.key),
    tip: `<b>${p.label}</b><div class="row"><span>Ausschreibungen</span><span>${fmtInt(p.n)}</span></div><div class="row"><span>Anteil</span><span>${nf1.format(p.n / KERN.competitions * 100)} %</span></div>`,
  })), { padL: 190 });

  barChart($('#chart-cpv'), KERN.cpvTop.map(p => ({
    label: p.label, value: p.n, color: 'var(--petrol-500)',
    tip: `<b>CPV ${p.div} — ${p.label}</b><div class="row"><span>Ausschreibungen</span><span>${fmtInt(p.n)}</span></div>`,
  })), { padL: 190 });

  const box = $('#chart-kernstellen'); box.innerHTML = '';
  KERN.topStellen.forEach(s => {
    box.appendChild(el('div', 'buyer-row',
      `<span class="nm">${s.name}</span><span class="n">${fmtInt(s.n)}</span>`));
  });
  box.appendChild(el('p', 'note', `Die Stadt tritt im Zeitraum unter ${fmtInt(KERN.distinctStellen)} Bezeichnungen als Auftraggeber auf — Ämter, Eigenbetriebe und geänderte Amtsbezeichnungen. Verfahren der städtischen Beteiligungen (${fmtInt(D11.beteiligung.total)} Bekanntmachungen) sind hier bewusst nicht enthalten.`));
}

/* ====================================================================
   WER BESCHAFFT? — die Zerlegung
   ==================================================================== */
function renderStellen() {
  fill('#stellen-kpis', [
    { k: 'Erfüllungsort Düsseldorf', v: fmtInt(PLATZ.total), d: 'alle Auftraggeber zusammen', info: 'traegermix' },
    { k: 'davon Kernverwaltung', v: fmtInt(KERN.total), d: fmtPct(PLATZ.kernAnteil) + ' der Bekanntmachungen', cls: 'petrol', info: 'kpi_gesamt' },
    { k: 'Überzeichnung durch Ortsfilter', v: nf1.format(faktor) + '×', d: 'Ort statt Auftraggeber gerechnet', cls: 'ink', info: 'ortsfaktor' },
    { k: 'Nicht zuordenbar', v: fmtPct(PLATZ.unklarAnteil), d: 'offen ausgewiesen, nicht geschätzt', info: 'unklar' },
  ]);

  const box = $('#chart-traeger'); box.innerHTML = '';
  const parts = PLATZ.traegerMix.map(t => ({ label: t.label, n: t.n, color: TRAEGER_COLOR[t.key] }));
  mixBar(box, 'Erfüllungsort Düsseldorf', parts, fmtInt(PLATZ.total) + ' Bekanntmachungen');
  const lg = el('div', 'legend');
  parts.forEach(p => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${p.color}"></span>${p.label} (${fmtInt(p.n)})`)));
  box.appendChild(lg);
  const barBox = el('div'); barBox.style.marginTop = '18px';
  barChart(barBox, PLATZ.traegerMix.map(t => ({
    label: t.label.length > 28 ? t.label.slice(0, 27) + '…' : t.label,
    value: t.n, color: TRAEGER_COLOR[t.key],
    valLabel: fmtInt(t.n) + '  ·  ' + nf1.format(t.n / PLATZ.total * 100) + ' %',
    tip: `<b>${t.label}</b><div class="row"><span>Bekanntmachungen</span><span>${fmtInt(t.n)}</span></div><div class="row"><span>Anteil am Ort</span><span>${nf1.format(t.n / PLATZ.total * 100)} %</span></div>`,
  })), { padL: 200, padR: 120 });
  box.appendChild(barBox);
  box.appendChild(el('p', 'note', 'Die Landeshauptstadt ist nur einer von vielen Auftraggebern am Ort. Land, Bund, Klinikum und öffentliche Unternehmen beschaffen eigenständig; kooperative Vergaben sind die Ausnahme. Eine Auswertung „für Düsseldorf" muss deshalb nach Auftraggeber gefiltert werden, nicht nach Erfüllungsort.'));

  const list = $('#stellen-liste'); list.innerHTML = '';
  DATA.traegerOrder.filter(t => DATA.vergabestellen[t]).forEach(t => {
    list.appendChild(el('div', 'section-label', `<span class="pill" style="background:${TRAEGER_COLOR[t]};color:#fff">${TL[t]}</span>`));
    DATA.vergabestellen[t].forEach(s => {
      list.appendChild(el('div', 'buyer-row', `<span class="nm">${s.name}</span><span class="n">${fmtInt(s.n)}</span>`));
    });
  });
}

/* ====================================================================
   VERFAHRENSDAUERN
   ==================================================================== */
function renderDauern() {
  const d = D11.dauernKern;
  const cov = d.results ? Math.round(d.matched / d.results * 100) : 0;
  fill('#dauer-kpis', [
    { k: 'Median gesamt', v: d.medianAll == null ? '—' : fmtInt(d.medianAll) + ' Tage', d: 'Bekanntmachung → Zuschlag', cls: 'petrol', info: 'dauer_median' },
    { k: 'Spannweite (P25–P75)', v: d.p25 == null ? '—' : `${fmtInt(d.p25)}–${fmtInt(d.p75)}`, d: 'Tage · mittlere 50 %', info: 'dauer_median' },
    { k: 'Auswertbare Paare', v: fmtInt(d.matched), d: `von ${fmtInt(d.results)} Ergebnissen`, info: 'dauer_abdeckung' },
    { k: 'Abdeckung', v: cov + ' %', d: 'ehrlich ausgewiesen', cls: 'ink', info: 'dauer_abdeckung' },
  ]);

  $('#dauer-gap').innerHTML = `<b>Datenlücke, transparent gemacht:</b> ${fmtInt(d.results - d.matched)} der
    ${fmtInt(d.results)} Ergebnisbekanntmachungen der Stadt (${100 - cov} %) lassen sich keiner
    Auftragsbekanntmachung im Beobachtungszeitraum zuordnen — Bekanntmachung vor Januar 2024,
    Verfahren ohne vorherige Bekanntmachung oder Veröffentlichung auf anderer Plattform.
    Mit internen Verfahrensdaten wäre die Abdeckung vollständig.`;

  barChart($('#chart-dauer-proc'), d.byProc.map(p => ({
    label: p.label.length > 30 ? p.label.slice(0, 29) + '…' : p.label,
    value: p.median, valLabel: fmtInt(p.median) + ' T.',
    color: procColor(p.key),
    tip: `<b>${p.label}</b><div class="row"><span>Median</span><span>${fmtInt(p.median)} Tage</span></div><div class="row"><span>P25–P75</span><span>${fmtInt(p.p25)}–${fmtInt(p.p75)} Tage</span></div><div class="row"><span>Verfahren (Paare)</span><span>${fmtInt(p.n)}</span></div>`,
  })), { padL: 190 });

  barChart($('#chart-dauer-city'), CITY_ORDER.map(nuts => {
    const dd = DATA.cities[nuts].dauernKern, c = DATA.cities[nuts];
    return {
      label: c.name, value: dd.medianAll || 0, valLabel: dd.medianAll == null ? '—' : fmtInt(dd.medianAll) + ' T.',
      color: CITY_COLOR(nuts),
      tip: `<b>${c.name} · Kernverwaltung</b><div class="row"><span>Median</span><span>${dd.medianAll == null ? '—' : fmtInt(dd.medianAll) + ' Tage'}</span></div><div class="row"><span>Paare</span><span>${fmtInt(dd.matched)} von ${fmtInt(dd.results)}</span></div>`,
    };
  }), { padL: 110 });
}

/* ====================================================================
   WETTBEWERB
   ==================================================================== */
function renderWettbewerb() {
  const W = DATA.wettbewerb;
  const eins = W.buckets.find(b => b.k === '1');
  const anteil1 = W.n ? (eins.n / W.n * 100) : 0;
  fill('#wett-kpis', [
    { k: 'Median Angebote', v: W.median == null ? '—' : nf1.format(W.median), d: 'je Zuschlag der Stadt', cls: 'petrol', info: 'wett_median' },
    { k: 'Zuschläge mit Angabe', v: fmtInt(W.n), d: `von ${fmtInt(W.resultsGesamt)} Ergebnissen`, info: 'wett_buckets' },
    { k: 'Nur ein Angebot', v: fmtPct(anteil1), d: `${fmtInt(eins.n)} Zuschläge`, cls: 'ink', info: 'wett_buckets' },
    { k: 'Warengruppen ausgewertet', v: fmtInt(W.byCpv.length), d: 'mit ≥ 8 Zuschlägen', info: 'wett_cpv' },
  ]);

  columnChart($('#chart-wett-buckets'), W.buckets.map(b => ({
    id: b.k, label: b.k + (b.k === '1' ? ' Angebot' : ' Angebote'), n: b.n,
    tip: `<b>${b.k} Angebot(e)</b><div class="row"><span>Zuschläge</span><span>${fmtInt(b.n)}</span></div><div class="row"><span>Anteil</span><span>${W.n ? nf1.format(b.n / W.n * 100) : 0} %</span></div>`,
  })), { color: 'var(--dv-petrol)', height: 220, showTotals: true });

  barChart($('#chart-wett-cpv'), W.byCpv.map(c => ({
    label: c.label.length > 26 ? c.label.slice(0, 25) + '…' : c.label,
    value: c.median, valLabel: nf1.format(c.median) + ' Ang.',
    color: c.median < 2.5 ? 'var(--dv-coral)' : c.median < 4 ? 'var(--dv-amber)' : 'var(--dv-green)',
    tip: `<b>CPV ${c.div} — ${c.label}</b><div class="row"><span>Median Angebote</span><span>${nf1.format(c.median)}</span></div><div class="row"><span>Zuschläge</span><span>${fmtInt(c.n)}</span></div>`,
  })), { padL: 180 });
}

/* ====================================================================
   BENCHMARK (Kernverwaltung je Stadt)
   ==================================================================== */
function renderBenchmark() {
  const per100k = c => c.kern.total / c.einwohner * 100000;
  fill('#bench-kpis', CITY_ORDER.map(nuts => {
    const c = DATA.cities[nuts];
    return {
      k: c.name, v: nf1.format(per100k(c)),
      d: `je 100.000 Einw. · ${fmtInt(c.kern.total)} Bekanntm. der Kernverwaltung`,
      cls: nuts === 'DEA11' ? 'petrol' : '', info: 'bench_rate',
    };
  }));

  barChart($('#chart-bench-rate'), CITY_ORDER.map(nuts => {
    const c = DATA.cities[nuts];
    return {
      label: c.name, value: per100k(c), valLabel: nf1.format(per100k(c)),
      color: CITY_COLOR(nuts),
      tip: `<b>${c.name} · Kernverwaltung</b><div class="row"><span>Bekanntmachungen</span><span>${fmtInt(c.kern.total)}</span></div><div class="row"><span>Einwohner</span><span>${fmtInt(c.einwohner)}</span></div><div class="row"><span>je 100.000</span><span>${nf1.format(per100k(c))}</span></div>`,
    };
  }), { padL: 110 });

  pairedBarChart($('#chart-bench-effekt'), CITY_ORDER.map(nuts => {
    const c = DATA.cities[nuts];
    return {
      label: c.name, a: c.platz.total, b: c.kern.total,
      tip: `<b>${c.name}</b><div class="row"><span>Erfüllungsort gesamt</span><span>${fmtInt(c.platz.total)}</span></div><div class="row"><span>davon Kernverwaltung</span><span>${fmtInt(c.kern.total)}</span></div><div class="row"><span>Überzeichnung</span><span>${nf1.format(c.platz.total / (c.kern.total || 1))}×</span></div>`,
    };
  }), {
    colorA: 'var(--neutral-300)', colorB: 'var(--petrol-600)', padL: 110,
    legend: [
      { label: 'alle Auftraggeber am Ort', color: 'var(--neutral-300)' },
      { label: 'nur Kernverwaltung', color: 'var(--petrol-600)' },
    ],
  });

  const rows = [
    ['Einwohner (IT.NRW)', c => fmtInt(c.einwohner)],
    ['Bekanntmachungen am Ort', c => fmtInt(c.platz.total)],
    ['… davon Kernverwaltung', c => `${fmtInt(c.kern.total)} (${fmtPct(c.platz.kernAnteil)})`],
    ['Ausschreibungen (Stadt)', c => fmtInt(c.kern.competitions)],
    ['Zuschläge (Stadt)', c => fmtInt(c.kern.results)],
    ['Volumen ausgewiesen', c => fmtMio(c.kern.awardSum)],
    ['… bei Zuschlägen', c => `${fmtInt(c.kern.resultsWithValue)} / ${fmtInt(c.kern.results)}`],
    ['Median-Dauer (Tage)', c => c.dauernKern.medianAll == null ? '—' : fmtInt(c.dauernKern.medianAll)],
    ['Median Angebote/Los', c => c.kern.bidsMedian == null ? '—' : nf1.format(c.kern.bidsMedian)],
    ['Städtische Beteiligungen', c => fmtInt(c.beteiligung.total)],
  ];
  $('#bench-table').innerHTML =
    `<thead><tr><th>Kennzahl</th>${CITY_ORDER.map(n => `<th class="num">${DATA.cities[n].name}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map(([lbl, fn]) => `<tr><td>${lbl}</td>${CITY_ORDER.map(n => `<td class="num">${fn(DATA.cities[n])}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

/* ====================================================================
   INIT
   ==================================================================== */
$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
renderOverview();
renderStellen();
renderDauern();
renderWettbewerb();
renderBenchmark();
})();
