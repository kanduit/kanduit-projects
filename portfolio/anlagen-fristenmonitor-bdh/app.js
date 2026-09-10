(function () {
"use strict";
const DATA = window.KANDUIT_BDH;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const MONTH_SHORT = { '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez' };
const fmtMonth = m => MONTH_SHORT[m.slice(5, 7)] + ' ' + m.slice(2, 4);
const fmtPct = v => nf1.format(v * 100) + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const views = { overview: 'view-overview', register: 'view-register', fristen: 'view-fristen', risiko: 'view-risiko', bericht: 'view-bericht', daten: 'view-daten' };
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  Object.entries(views).forEach(([k, id]) => $('#' + id).classList.toggle('active', k === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showView(b.dataset.view); });

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

const METRIC_INFO = {
  leitzahl: { t: 'Leitzahl: jährliche MFA-Nachweise der nächsten 12 Monate', d: 'Zählt nur MFA mit effektivem Intervall 12 Monate, deren nächste Fälligkeit in (Stand, Stand+12 Monate] liegt. Kontinuierliche Anlagen (Intervall 0) sind ausgeschlossen. Überfällige Nachweise nach dem Grenzwertbeginn 01.01.2025 stehen daneben, nicht in der Zahl. Die 40 PRTR-Einrichtungen haben keine Frist und sind nicht die Leitzahl. Datenlücke: Messdaten und Intervalle sind ◈ Demo-Annahmen, das Amtsregister ist nicht öffentlich.' },
  overlayN: { t: 'Öffentliche IED-Kulisse', d: '68 eindeutige Betriebe der EU-Registry 2024 in Bochum, Dortmund und Hagen (Bundesland NW). 40 davon berichten 2024 an PRTR. Das ist IED-Maßstab, nicht 44. BImSchV (1–<50 MW). Datenlücke: kein 44.-BImSchV-Register.' },
  mfaN: { t: 'Schematischer MFA-Bestand', d: '144 Anlagen, 48 je Stadt, kalibriert auf die Größenordnung der öffentlichen Kulisse statt auf 40.000 × Bevölkerungsanteil. Deterministisch aus einem Seed, nicht aus random. Datenlücke: das echte Register der UUB liegt nicht offen.' },
  prtrN: { t: 'PRTR 2024 BDH', d: '40 eindeutige inspire_id unter bundesland=nw und exaktem Ortsnamen. Alle 40 finden sich in der EU-Liste wieder. Namen, Straße und Muttergesellschaft wurden beim Abruf verworfen. Datenlücke: kennnummer ist durchgängig „-“.' },
  ueberfaellig: { t: 'Überfällige jährliche Nachweise', d: 'Jährliche MFA, die seit dem Grenzwertbeginn 01.01.2025 mindestens einen fälligen Nachweis verpasst haben. Die nächste Fälligkeit liegt danach wieder im 12-Monats-Fenster und zählt in der Leitzahl. Datenlücke: lastMeasuredOn ist ◈.' },
  faelligStadt: { t: 'Fällige Nachweise nach Stadt', d: 'Leitzahl aufgeteilt auf Bochum, Dortmund und Hagen. Nur Intervall 12 Monate. Datenlücke: schematischer Bestand.' },
  tabMfa: { t: 'Tabelle MFA 44. BImSchV', d: 'Vollständiger schematischer Bestand. Anzeigenamen sind eindeutig (MFA Hagen 14). Keine Betreibernamen. Fälligkeit rechnet der Client. Datenlücke: Amtsregister fehlt.' },
  tabIed: { t: 'Tabelle IED-/PRTR-Kulisse', d: '68 Betriebe, Betriebskorn. PRTR-Felder nur dort, wo der Join inspire_id = inspire_betrieb trifft (40 von 40). Kein Intervall, keine Bewertung durch die Schieber. Datenlücke: IED ≠ 44. BImSchV.' },
  karte: { t: 'Karte BDH', d: 'Drei kreisfreie Städte aus dem Geobasis-WFS (EPSG:4326), vereinfacht. Kreise = MFA, Quadrate = IED-Kulisse. Zwei Glyphen, zwei Listen. Datenlücke: MFA-Koordinaten sind synthetisch in der Stadtpolygonfläche.' },
  kalender: { t: 'Messtermine nächste 12 Monate', d: 'Monat × Stadt, nur jährliche MFA im Horizont. Peak ist der Monat mit den meisten Terminen. Klick setzt den Registerfilter auf diesen Monat. Datenlücke: schematisch.' },
  flipLast: { t: 'Laständerung Intervallwechsel', d: 'Szenario Intervallwechsel dreht Erdgas-Anlagen 5–20 MW von 12 auf 36 Monate (und zurück). Die Säulen zeigen die Leitzahl je Stadt vorher/nachher. Datenlücke: die Gruppe ist benannt, nicht behördlich festgelegt.' },
  gewichte: { t: '§-52a-Gewichte', d: 'Ein Objekt state.riskWeights. Schieber schreiben dieselben drei Zahlen, die Überblick, Register, Risiko und Bericht lesen. Start 40/35/25. Datenlücke: Gewichte und Faktoren sind ◈, nicht die Beispielbewertung der Bezirksregierung Arnsberg.' },
  rangfolge: { t: 'Rangfolge MFA', d: 'Gewichteter Mittelwert der Faktoren u/a/o, normiert auf 0–100. Nur MFA. IED-Zeilen haben keine Faktoren und stehen nicht in dieser Liste. Datenlücke: Faktoren deterministisch, fachlich bedeutungslos bis zur Amtslieferung.' },
  deckung: { t: 'Deckung durch Stellen', d: 'Summe aus den nächsten fälligen jährlichen Nachweisen und den seit 01.01.2025 verpassten Zyklen, geteilt durch (Stellen × 80 Termine je Person und Jahr). Ein überfälliger Zyklus zählt extra, nicht als dieselbe Frist. Szenario Stelle ±1 ändert nur den Stellenansatz. Datenlücke: 80 und 2 sind ◈, kein Stellenplan.' },
  isaReihe: { t: 'ISA-Inspektionen NRW', d: 'Veröffentlichte Landesreihe 2015–2024. 2024: 1.848 Inspektionen, −15 % gegenüber 2023. Kein BDH-Schnitt. Datenlücke: ISA splittet Bochum, Dortmund und Hagen nicht.' },
  abgleich: { t: 'Registerabgleich', d: 'Vier Zahlen, vier Körnungen: ISA UUBn Arnsberg 2.030 Anlagen (ganzer Bezirk), EU-Registry 68 Betriebe BDH, PRTR 40 Einrichtungen BDH, schematisch 144 MFA. Keine ist ein Fehler der anderen. Datenlücke: es gibt kein öffentliches 44.-BImSchV-Register.' },
  gegenprobe: { t: 'Gegenprobe Hold-Forward', d: 'Letzter PRTR-Stand 2015–2019 (42 Einrichtungen) wird unverändert auf 2020–2024 gehalten. MAPE gegen die bekannten Jahre. Taugt als Größenordnung, nicht als Plan je Jahr. Datenlücke: Hold-Forward kennt keine Betriebsschließungen.' },
  benchmark: { t: 'Benchmark UUBn', d: 'Rang der UUBn Arnsberg unter den fünf ISA-UUB-Blöcken nach Anlagenbestand und nach Anlagen je 1.000 Einwohner des Regierungsbezirks. Zwei Einschränkungen: BDH ist nur ein Teil der UUBn Arnsberg, und 44. BImSchV ist nicht die ISA-Zählung nach 4. BImSchV.' },
  stellen: { t: 'Stellenansatz', d: 'Default 2 Stellen plus Szenario-Delta. Datenlücke: kein veröffentlichter Stellenplan der UUB.' },
  kapazitaet: { t: 'Terminkapazität', d: 'Stellen × 80 Messtermine je Person und Jahr. Datenlücke: 80 ist ◈.' },
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

const SRC_LABEL = DATA.meta.quellen || {};
function verdrahteQuellen() {
  $$('.src-note').forEach(n => {
    const s = SRC_LABEL[n.dataset.src]; if (!s || n.dataset.done) return;
    n.dataset.done = '1';
    n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a> · Abruf ${DATA.meta.stand}`;
  });
}

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
        if (c.click) { rect.style.cursor = 'pointer'; rect.addEventListener('click', c.click); }
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

function pad2(n) { return String(n).padStart(2, '0'); }
function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(y, m - 1 + months, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, last));
  return base.getFullYear() + '-' + pad2(base.getMonth() + 1) + '-' + pad2(base.getDate());
}
function walkDue(anchor, interval, stand, gz) {
  if (!interval) return { next: null, missed: 0 };
  let due = addMonths(anchor, interval);
  let missed = 0;
  let guard = 0;
  while (due <= stand && guard++ < 24) {
    if (due >= gz) missed++;
    due = addMonths(due, interval);
  }
  return { next: due, missed };
}
function ringFromPath(d) {
  return d.replace(/Z/g, '').split(/[ML]/).filter(Boolean).map(s => s.split(',').map(Number));
}
const CITY_COLOR = { '911': 'var(--dv-petrol)', '913': 'var(--dv-orange)', '914': 'var(--dv-violet)' };
const INTERVAL_T = { 0: 'kontinuierlich', 12: 'jährlich', 36: 'dreijährlich' };
const KRIT = [
  { k: 'umwelt', t: 'Umweltauswirkungen', h: '§ 52a: Auswirkungen auf die Umwelt' },
  { k: 'adherence', t: 'Einhaltung der Rechtsvorschriften', h: '§ 52a: Einhaltung' },
  { k: 'umgebung', t: 'Umgebung der Anlage', h: '§ 52a: Umgebung' },
];
const RANG_FARBE = ['#c24b57', '#d97a2b', '#c9931f', '#1fa2c4', '#2f8f6b'];
function rangKlasse(rang, n) { return Math.min(4, Math.floor((rang - 1) / (n / 5))); }
function cityName(k) { return DATA.cities[k].name; }

const state = {
  scenario: 'termine',
  riskWeights: Object.assign({}, DATA.config.defaultWeights),
  staffDelta: 0,
  visibility: true,
  filter: { city: '', q: '', interval: '', dueMonth: '' },
};

function inFlipGruppe(p) {
  const g = DATA.config.flipGruppe;
  return p.fuel === g.brennstoff && p.sizeBand === g.mw;
}
function effectiveInterval(p, st) {
  if (st.scenario !== 'intervall' || !inFlipGruppe(p)) return p.intervalMonths;
  if (p.intervalMonths === 12) return 36;
  if (p.intervalMonths === 36) return 12;
  return p.intervalMonths;
}
function scoreOf(p, w) {
  const sum = (w.umwelt + w.adherence + w.umgebung) || 1;
  const r = p.riskFactors;
  return (w.umwelt * r.u + w.adherence * r.a + w.umgebung * r.o) / sum * 100;
}
function weightText(w) {
  const sum = (w.umwelt + w.adherence + w.umgebung) || 1;
  return KRIT.map(k => k.t.split(' ')[0] + ' ' + nf1.format(w[k.k] / sum * 100) + ' %').join(' · ');
}

function deriveDashboard(data, st) {
  const cfg = data.config;
  const stand = data.meta.standIso;
  const horizon = addMonths(stand, cfg.horizonMonths);
  const gz = cfg.grenzwertbeginn;
  const w = st.riskWeights;
  const mfaAll = data.populations.mfa44.map(p => {
    const interval = effectiveInterval(p, st);
    const walked = walkDue(p.lastMeasuredOn, interval, stand, gz);
    const due = walked.next;
    const inHorizon = !!(due && stand < due && due <= horizon);
    const overdue = walked.missed > 0;
    return {
      p, interval, due, inHorizon, overdue, missed: walked.missed,
      score: scoreOf(p, w),
      flip: inFlipGruppe(p),
    };
  });
  const annual = mfaAll.filter(r => r.interval === 12);
  const leitzahl = annual.filter(r => r.inHorizon).length;
  const ueberfaellig = annual.filter(r => r.overdue).length;
  const q = (st.filter.q || '').trim().toLowerCase();
  const mfa = mfaAll.filter(r => {
    if (st.filter.city && r.p.cityKey !== st.filter.city) return false;
    if (st.filter.interval !== '' && String(r.interval) !== st.filter.interval) return false;
    if (st.filter.dueMonth && (!r.due || r.due.slice(0, 7) !== st.filter.dueMonth)) return false;
    if (q && !r.p.displayName.toLowerCase().includes(q) && !r.p.id.toLowerCase().includes(q)) return false;
    return true;
  });
  const iedAll = data.populations.publicIedPrtr;
  const ied = iedAll.filter(r => {
    if (st.filter.city && r.cityKey !== st.filter.city) return false;
    if (q && !r.displayName.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
    return true;
  });
  const months = [];
  let cursor = stand.slice(0, 7);
  for (let i = 0; i < 12; i++) {
    const ym = addMonths(stand, i + 1).slice(0, 7);
    const rec = { id: ym, label: fmtMonth(ym + '-01'), '911': 0, '913': 0, '914': 0, n: 0 };
    annual.forEach(r => {
      if (r.inHorizon && r.due.slice(0, 7) === ym) {
        rec[r.p.cityKey]++; rec.n++;
      }
    });
    months.push(rec);
    cursor = ym;
  }
  let peak = months[0];
  months.forEach(m => { if (m.n > peak.n) peak = m; });
  const ranked = mfaAll.map(r => r).sort((a, b) => b.score - a.score || (a.p.id < b.p.id ? -1 : 1))
    .map((r, i) => Object.assign({}, r, { rang: i + 1 }));
  const visits = annual.reduce((n, r) => n + (r.inHorizon ? 1 : 0) + r.missed, 0);
  const staff = cfg.stellenDefault + (st.scenario === 'stelle' ? st.staffDelta : 0);
  const capacity = Math.max(0, staff) * cfg.termineProPersonJahr;
  const byCityDue = { '911': 0, '913': 0, '914': 0 };
  annual.forEach(r => { if (r.inHorizon) byCityDue[r.p.cityKey]++; });
  const leitzahlBase = data.populations.mfa44.reduce((acc, p) => {
    if (p.intervalMonths !== 12) return acc;
    const due = walkDue(p.lastMeasuredOn, 12, stand, gz).next;
    if (due && stand < due && due <= horizon) acc[p.cityKey]++;
    return acc;
  }, { '911': 0, '913': 0, '914': 0 });
  return {
    stand, horizon, leitzahl, ueberfaellig, mfaAll, mfa, iedAll, ied,
    months, peak, ranked, visits, staff, capacity,
    coverage: capacity ? visits / capacity : null,
    byCityDue, leitzahlBase, w, cfg,
    prtrN: iedAll.filter(r => r.prtr2024).length,
    mfaN: data.populations.mfa44.length,
    iedN: iedAll.length,
  };
}

function vis(v) { return state.visibility ? v : '—'; }
function zeile(k, v, src) {
  return `<div class="kv"><span class="kk">${k}</span><span class="vv">${v}</span>` +
    (src ? `<span class="src">${src}</span>` : '') + `</div>`;
}

const drawer = $('#drawer'), drawerBack = $('#drawer-back');
function closeDrawer() { drawer.classList.remove('show'); drawerBack.classList.remove('show'); }
drawerBack.addEventListener('click', closeDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function openBlattMfa(id) {
  const vm = deriveDashboard(DATA, state);
  const r = vm.ranked.find(x => x.p.id === id);
  if (!r) return;
  const p = r.p, n = vm.ranked.length, kl = rangKlasse(r.rang, n);
  $('#drawer-title').textContent = p.displayName;
  $('#drawer-sub').textContent = cityName(p.cityKey) + ' · ' + p.id;
  $('#drawer-body').innerHTML = `
    <div class="banner assume-banner" style="margin-bottom:var(--sp-4)">
      <b>Schematische MFA nach 44. BImSchV</b> — nicht in der öffentlichen IED-Kulisse.
      Rang ${r.rang} von ${fmtInt(n)}, Wert ${nf1.format(r.score)} von 100.
      Gewichtung: ${weightText(state.riskWeights)}.
    </div>
    <div class="dsec">Lage</div>
    ${zeile('Stadt', esc(cityName(p.cityKey)), 'Gebietsschlüssel ' + p.cityKey + ', gemeinsame UUB.')}
    ${zeile('Anzeigename', esc(p.displayName), 'Kein Betreibername. Eindeutig im Demonstrator.')}
    ${zeile('PLZ', vis(p.postalCode), 'Aus einem städtischen PLZ-Vorrat gezogen, kein Standortregister.')}
    ${zeile('Koordinaten', vis(p.lon + ', ' + p.lat), 'Synthetisch in der amtlichen Stadtfläche (Punkt-in-Polygon).')}
    <div class="dsec">Anlage${assumeMark('mfa')}</div>
    ${zeile('Leistungsklasse', esc(p.sizeBand), '1–5 / 5–20 / 20–50 MW, ◈.')}
    ${zeile('Brennstoff', esc(p.fuel), '')}
    ${zeile('Anlagentyp', esc(p.plantType), '')}
    ${zeile('Intervall' + assumeMark('intervalle'), INTERVAL_T[r.interval] + ' (' + r.interval + ' Monate)',
      r.interval !== p.intervalMonths ? 'Szenario Intervallwechsel hat die Klasse gedreht.' : 'Tabelle Größe × Brennstoff.')}
    ${zeile('Letzte Messung' + assumeMark('messung'), fmtDate(p.lastMeasuredOn), '◈, nicht Amtsdatum.')}
    ${zeile('Nächste Fälligkeit', r.due ? fmtDate(r.due) : 'kontinuierlich',
      'Client: lastMeasuredOn + Intervall. Nicht in data.js gespeichert.')}
    <div class="dsec">Risiko${assumeMark('risiko')}</div>
    ${KRIT.map(k => zeile(k.t, nf1.format(p.riskFactors[k.k === 'umwelt' ? 'u' : k.k === 'adherence' ? 'a' : 'o'] * 100) + ' von 100',
      'Gewicht ' + state.riskWeights[k.k])).join('')}
    ${zeile('<b>Prioritätswert</b>', '<b>' + nf1.format(r.score) + '</b>', 'Gewichteter Mittelwert × 100.')}
    <p class="note">Stand ${DATA.meta.stand}. Mit ◈ markierte Größen sind Demo-Annahmen.
    Demonstrator der Kanduit UG, kein Produkt der Städte Bochum, Dortmund und Hagen.</p>`;
  drawer.classList.add('show'); drawerBack.classList.add('show'); $('#drawer-close').focus();
}

function openBlattIed(id) {
  const row = DATA.populations.publicIedPrtr.find(r => r.id === id);
  if (!row) return;
  const pr = row.prtr2024;
  $('#drawer-title').textContent = row.displayName;
  $('#drawer-sub').textContent = cityName(row.cityKey) + ' · ' + row.id;
  $('#drawer-body').innerHTML = `
    <div class="banner warn" style="margin-bottom:var(--sp-4)">
      <b>Öffentliche IED-/PRTR-Kulisse</b> — nicht das 44.-BImSchV-Register.
      Kein Messintervall, keine Bewertung durch die Schieber.
    </div>
    <div class="dsec">Lage</div>
    ${zeile('Stadt', esc(cityName(row.cityKey)), 'EU-Registry 2024, Bundesland NW, exakter Ortsname.')}
    ${zeile('Anzeigename', esc(row.displayName), 'Kein Betreibername.')}
    ${zeile('Inspire-ID', esc(row.id), 'inspireFacilityId, Join-Schlüssel zu PRTR.')}
    ${zeile('PLZ', vis(row.postalCode || '—'), 'Aus der EU-Liste, Namen und Straße verworfen.')}
    ${zeile('Koordinaten', vis(row.lon + ', ' + row.lat), 'ETRS89-Angaben der Quelle, bereits lon/lat.')}
    <div class="dsec">Betrieb</div>
    ${zeile('Typ', esc(row.typ), 'IED oder NONIED laut EU-Registry.')}
    ${zeile('Status', esc(row.status), 'Status.Betrieb, gekürzt.')}
    ${zeile('IE-Tätigkeit', row.ieActivity ? esc(row.ieActivity) : '—', 'Anhang I, wo ausgewiesen.')}
    ${zeile('Installationen', fmtInt(row.installationCount), 'Summe Anzahl_Anlagen bzw. Zeilen je Betrieb.')}
    ${zeile('Inspektionen 2024', fmtInt(row.insp), 'Feld Inspektionen_Anzahl, viele Nullen.')}
    <div class="dsec">PRTR 2024</div>
    ${pr
      ? zeile('NACE', esc((pr.naceCode || '') + (pr.naceText ? ' · ' + pr.naceText : '')),
          'Join inspire_id = inspire_betrieb, 40 von 40 PRTR-Treffern.') +
        zeile('Tätigkeitsschlüssel', (pr.activityKeys || []).join(', ') || '—', 'prtr_schluessel.') +
        zeile('Vertraulichkeit', pr.confidentialityFlag ? 'Kennzeichen gesetzt' : 'kein Kennzeichen',
          'Nur Flag, kein Begründungstext.')
      : '<p class="note">Dieser Betrieb berichtet 2024 nicht an PRTR — eine der 28 EU-IDs ohne PRTR-Gegenstück.</p>'}
    <p class="note">Stand ${DATA.meta.stand}. Demonstrator der Kanduit UG, kein Produkt der Städte Bochum, Dortmund und Hagen.</p>`;
  drawer.classList.add('show'); drawerBack.classList.add('show'); $('#drawer-close').focus();
}

function tableHtml(cols, rows, rowId, openFn) {
  return `<table><thead><tr>${cols.map(c =>
    `<th class="${c.num ? 'num ' : ''}sortable${c.k === (cols._sortK) ? ' sorted' : ''}" data-k="${c.k}">${c.t}<span class="arrow">${c.k === cols._sortK ? (cols._sortDir > 0 ? '▲' : '▼') : '↕'}</span></th>`
  ).join('')}</tr></thead><tbody>${rows.map(r =>
    `<tr class="clickable" data-open="${openFn}" data-id="${esc(rowId(r))}" tabindex="0">${cols.map(c =>
      `<td class="${c.num ? 'num' : ''}">${c.c(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

let sortMfa = { k: 'name', dir: 1 };
let sortIed = { k: 'name', dir: 1 };

function mfaCols(vm) {
  const cols = [
    { k: 'name', t: 'Anzeige', v: r => r.p.displayName, c: r => esc(r.p.displayName) },
    { k: 'city', t: 'Stadt', v: r => cityName(r.p.cityKey), c: r => esc(cityName(r.p.cityKey)) },
    { k: 'band', t: 'Klasse', v: r => r.p.sizeBand, c: r => esc(r.p.sizeBand) },
    { k: 'fuel', t: 'Brennstoff', v: r => r.p.fuel, c: r => esc(r.p.fuel) },
    { k: 'int', t: 'Intervall ◈', v: r => r.interval, c: r => INTERVAL_T[r.interval] },
    { k: 'due', t: 'Fällig', v: r => r.due || '', c: r => r.due ? fmtDate(r.due) : '—' },
    { k: 'plz', t: 'PLZ', v: r => r.p.postalCode, c: r => esc(vis(r.p.postalCode)) },
  ];
  cols._sortK = sortMfa.k; cols._sortDir = sortMfa.dir;
  return cols;
}
function iedCols() {
  const cols = [
    { k: 'name', t: 'Anzeige', v: r => r.displayName, c: r => esc(r.displayName) },
    { k: 'city', t: 'Stadt', v: r => cityName(r.cityKey), c: r => esc(cityName(r.cityKey)) },
    { k: 'typ', t: 'Typ', v: r => r.typ, c: r => esc(r.typ) },
    { k: 'status', t: 'Status', v: r => r.status, c: r => esc(r.status) },
    { k: 'insp', t: 'Insp. 2024', num: true, v: r => r.insp, c: r => fmtInt(r.insp) },
    { k: 'prtr', t: 'PRTR', v: r => r.prtr2024 ? 1 : 0, c: r => r.prtr2024 ? '<span class="pill ok">2024</span>' : '<span class="pill">nein</span>' },
    { k: 'plz', t: 'PLZ', v: r => r.postalCode || '', c: r => esc(vis(r.postalCode || '—')) },
  ];
  cols._sortK = sortIed.k; cols._sortDir = sortIed.dir;
  return cols;
}
function sortRows(rows, cols, sort) {
  const col = cols.find(c => c.k === sort.k) || cols[0];
  return rows.slice().sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    const d = typeof x === 'string' ? x.localeCompare(y, 'de') : x - y;
    return (d || 0) * sort.dir;
  });
}
function bindTable(container, sortRef, redrawFn) {
  container.onclick = e => {
    const th = e.target.closest('th.sortable');
    const tr = e.target.closest('tr.clickable');
    if (th) {
      const k = th.dataset.k;
      if (sortRef.k === k) sortRef.dir *= -1; else { sortRef.k = k; sortRef.dir = 1; }
      redrawFn(); return;
    }
    if (tr) {
      if (tr.dataset.open === 'mfa') openBlattMfa(tr.dataset.id);
      else openBlattIed(tr.dataset.id);
    }
  };
}

function csvDownload(name, head, lines) {
  const q = v => /[";\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  const csv = '\uFEFF' + [head, ...lines].map(l => l.map(q).join(';')).join('\r\n') +
    `\r\n\r\n"Kanduit Anlagen- und Fristenmonitor BDH — Demonstrator, kein Produkt der Staedte Bochum, Dortmund und Hagen."` +
    `\r\n"Stand ${DATA.meta.stand}."\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = el('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function renderOverview(vm) {
  $('#leitzahl').innerHTML = `
    <div class="k">Leitzahl${infoIcon('leitzahl')}${assumeMark('mfa')}</div>
    <div class="v">${fmtInt(vm.leitzahl)}</div>
    <div class="d"><b>Mindestens ${fmtInt(vm.leitzahl)} jährliche Messnachweise der 44. BImSchV sind in den nächsten 12 Monaten fällig</b>
      — Untergrenze, nur Intervall 12 Monate, Stand ${fmtDate(vm.stand)} bis ${fmtDate(vm.horizon)}.
      Grenzwertbeginn 01.01.2025: ${fmtInt(vm.ueberfaellig)} Anlagen haben mindestens einen Nachweis verpasst. Die verpassten Zyklen stehen neben der Leitzahl, nicht in ihr.
      Werden sie nicht erbracht, fehlen Nachweise und das Überwachungsprogramm ist nicht gedeckt.
      Durchgerechnet unter <a href="#" data-goto="fristen">Fristenkalender</a>.</div>`;

  const k = $('#overview-kpis'); k.innerHTML = '';
  [
    { k: 'MFA 44. BImSchV ◈', v: fmtInt(vm.mfaN), d: '48 je Stadt, schematisch', info: 'mfaN' },
    { k: 'IED-Betriebe öffentlich', v: fmtInt(vm.iedN), d: 'EU-Registry 2024, nicht 44. BImSchV', cls: 'petrol', info: 'overlayN' },
    { k: 'davon PRTR 2024', v: fmtInt(vm.prtrN), d: 'Join inspire_id, 40 von 40', info: 'prtrN' },
    { k: 'Überfällig seit 01.01.2025', v: fmtInt(vm.ueberfaellig), d: 'jährliche MFA, nicht in der Leitzahl', cls: 'ink', info: 'ueberfaellig' },
  ].forEach(s => k.appendChild(statCard(s)));

  barChart($('#chart-overview-stadt'), ['911', '913', '914'].map(key => ({
    label: cityName(key), value: vm.byCityDue[key],
    color: CITY_COLOR[key],
    tip: `<b>${esc(cityName(key))}</b><div class="row"><span>fällige Jahresnachweise</span><span>${fmtInt(vm.byCityDue[key])}</span></div>`,
  })), { padL: 120 });

  const mc = mfaCols(vm);
  $('#overview-mfa').innerHTML = tableHtml(mc, sortRows(vm.mfaAll, mc, sortMfa), r => r.p.id, 'mfa');
  const ic = iedCols();
  $('#overview-ied').innerHTML = tableHtml(ic, sortRows(vm.iedAll, ic, sortIed), r => r.id, 'ied');
}

function renderKarte(vm) {
  const geo = DATA.geography.cities;
  const rings = {};
  const pts = [];
  Object.keys(geo).forEach(k => {
    rings[k] = ringFromPath(geo[k].path);
    rings[k].forEach(p => pts.push(p));
  });
  const lon0 = Math.min(...pts.map(p => p[0])), lon1 = Math.max(...pts.map(p => p[0]));
  const lat0 = Math.min(...pts.map(p => p[1])), lat1 = Math.max(...pts.map(p => p[1]));
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
  const PAD = 12, W_ = 640, HMAX = 420;
  const bw = (lon1 - lon0) * kx, bh = lat1 - lat0;
  const sx = Math.min((W_ - 2 * PAD) / bw, (HMAX - 2 * PAD) / bh);
  const H_ = bh * sx + 2 * PAD;
  const offX = (W_ - bw * sx) / 2;
  const px = lon => offX + (lon - lon0) * kx * sx;
  const py = lat => H_ - PAD - (lat - lat0) * sx;

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W_} ${H_}`);
  svg.setAttribute('class', 'map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Karte Bochum, Dortmund und Hagen mit MFA- und IED-Standorten');

  Object.keys(geo).forEach(k => {
    const r = rings[k];
    const p = svgEl('path', {
      d: 'M' + r.map(c => px(c[0]).toFixed(1) + ',' + py(c[1]).toFixed(1)).join('L') + 'Z',
      class: 'bez',
    });
    p.addEventListener('mousemove', e => showTip(
      `<b>${esc(cityName(k))}</b>
       <div class="row"><span>MFA ◈</span><span>${fmtInt(vm.mfaAll.filter(x => x.p.cityKey === k).length)}</span></div>
       <div class="row"><span>IED-Betriebe</span><span>${fmtInt(vm.iedAll.filter(x => x.cityKey === k).length)}</span></div>`,
      e.clientX, e.clientY));
    p.addEventListener('mouseleave', hideTip);
    svg.appendChild(p);
    const mitte = geo[k].mitte;
    const t = svgEl('text', { x: px(mitte[0]).toFixed(1), y: py(mitte[1]).toFixed(1), class: 'bez-lbl' });
    t.textContent = cityName(k);
    svg.appendChild(t);
  });

  vm.ied.forEach(row => {
    const s = svgEl('rect', {
      x: (px(row.lon) - 3.2).toFixed(1), y: (py(row.lat) - 3.2).toFixed(1),
      width: 6.4, height: 6.4, fill: 'var(--dv-coral)', class: 'sq',
      tabindex: '0', role: 'button',
    });
    const tip = `<b>${esc(row.displayName)}</b>
      <div class="row"><span>Typ</span><span>${esc(row.typ)}</span></div>
      <div class="row"><span>PRTR 2024</span><span>${row.prtr2024 ? 'ja' : 'nein'}</span></div>
      <div class="def">IED-Kulisse, nicht 44. BImSchV. Klick öffnet das Blatt.</div>`;
    s.addEventListener('mousemove', e => showTip(tip, e.clientX, e.clientY));
    s.addEventListener('mouseleave', hideTip);
    s.addEventListener('click', () => openBlattIed(row.id));
    svg.appendChild(s);
  });

  const n = vm.ranked.length;
  vm.mfa.forEach(r => {
    const kl = rangKlasse(vm.ranked.find(x => x.p.id === r.p.id).rang, n);
    const c = svgEl('circle', {
      cx: px(r.p.lon).toFixed(1), cy: py(r.p.lat).toFixed(1), r: 3.4,
      fill: RANG_FARBE[kl], class: 'dot', tabindex: '0', role: 'button',
    });
    const tip = `<b>${esc(r.p.displayName)}</b>
      <div class="row"><span>Intervall</span><span>${INTERVAL_T[r.interval]}</span></div>
      <div class="row"><span>Fällig</span><span>${r.due ? fmtDate(r.due) : '—'}</span></div>
      <div class="def">Schematische MFA. Klick öffnet das Blatt.</div>`;
    c.addEventListener('mousemove', e => showTip(tip, e.clientX, e.clientY));
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('click', () => openBlattMfa(r.p.id));
    svg.appendChild(c);
  });

  const box = $('#map'); box.innerHTML = ''; box.appendChild(svg);
  const lg = $('#map-legend'); lg.innerHTML = '';
  lg.appendChild(el('div', 'item', '<span class="dotsw" style="background:var(--dv-petrol)"></span>MFA 44. BImSchV (schematisch)'));
  lg.appendChild(el('div', 'item', '<span class="sqsw" style="background:var(--dv-coral)"></span>IED-/PRTR-Betrieb (öffentlich)'));
}

function renderRegister(vm) {
  const k = $('#register-kpis'); k.innerHTML = '';
  [
    { k: 'MFA in der Auswahl', v: fmtInt(vm.mfa.length), d: 'von ' + fmtInt(vm.mfaN) + ' schematisch', info: 'tabMfa' },
    { k: 'IED in der Auswahl', v: fmtInt(vm.ied.length), d: 'von ' + fmtInt(vm.iedN) + ' öffentlich', info: 'tabIed' },
    { k: 'Leitzahl (ungefiltert)', v: fmtInt(vm.leitzahl), d: 'jährliche Nachweise, 12 Monate', cls: 'petrol', info: 'leitzahl' },
    { k: 'Koordinaten sichtbar', v: state.visibility ? 'ja' : 'nein', d: 'PLZ und Lage, keine Namen', info: 'karte' },
  ].forEach(s => k.appendChild(statCard(s)));
  renderKarte(vm);
  const mc = mfaCols(vm);
  $('#register-mfa').innerHTML = tableHtml(mc, sortRows(vm.mfa, mc, sortMfa), r => r.p.id, 'mfa');
  $('#register-mfa-count').textContent = fmtInt(vm.mfa.length) + ' Zeilen · Gewichtung: ' + weightText(state.riskWeights);
  const ic = iedCols();
  $('#register-ied').innerHTML = tableHtml(ic, sortRows(vm.ied, ic, sortIed), r => r.id, 'ied');
  $('#register-ied-count').textContent = fmtInt(vm.ied.length) + ' Betriebe · ' + fmtInt(vm.ied.filter(r => r.prtr2024).length) + ' mit PRTR 2024';
}

function renderFristen(vm) {
  const k = $('#fristen-kpis'); k.innerHTML = '';
  [
    { k: 'Leitzahl 12 Monate', v: fmtInt(vm.leitzahl), d: 'nur jährliche MFA', cls: 'ink', info: 'leitzahl' },
    { k: 'Peak-Monat', v: vm.peak.n ? fmtMonth(vm.peak.id + '-01') : '—', d: fmtInt(vm.peak.n) + ' Termine', info: 'kalender' },
    { k: 'Überfällig', v: fmtInt(vm.ueberfaellig), d: 'nach 01.01.2025, nicht im Kalender', info: 'ueberfaellig' },
    { k: 'Szenario', v: state.scenario === 'intervall' ? 'Wechsel' : 'Fristen', d: DATA.config.flipGruppe.t, info: 'flipLast' },
  ].forEach(s => k.appendChild(statCard(s)));

  const keys = [
    { key: '911', color: 'var(--dv-petrol)' },
    { key: '913', color: 'var(--dv-orange)' },
    { key: '914', color: 'var(--dv-violet)' },
  ];
  columnChart($('#chart-fristen'), vm.months.map(m => ({
    id: m.id, label: m.label, '911': m['911'], '913': m['913'], '914': m['914'],
    tip: `<b>${m.label}</b>
      <div class="row"><span>Bochum</span><span>${fmtInt(m['911'])}</span></div>
      <div class="row"><span>Dortmund</span><span>${fmtInt(m['913'])}</span></div>
      <div class="row"><span>Hagen</span><span>${fmtInt(m['914'])}</span></div>
      <div class="def">Klick filtert das Anlagenregister auf diesen Monat.</div>`,
    click: () => {
      state.filter.dueMonth = m.id;
      showView('register');
      redraw();
    },
  })), {
    keys, height: 260, showTotals: true,
    legend: keys.map(x => ({ label: cityName(x.key), color: x.color })),
    breaks: vm.peak.n ? [{ at: vm.peak.id, label: 'Peak', dy: 8 }] : [],
  });

  barChart($('#chart-flip'), ['911', '913', '914'].map(key => {
    const now = vm.byCityDue[key];
    const base = vm.leitzahlBase[key];
    const dlt = now - base;
    return {
      label: cityName(key),
      value: Math.abs(dlt) || 0.01,
      valLabel: (dlt > 0 ? '+' : dlt < 0 ? '−' : '') + fmtInt(Math.abs(dlt)) + ' (jetzt ' + fmtInt(now) + ')',
      color: dlt > 0 ? 'var(--dv-coral)' : dlt < 0 ? 'var(--dv-green)' : 'var(--neutral-300)',
      tip: `<b>${esc(cityName(key))}</b>
        <div class="row"><span>ohne Wechsel</span><span>${fmtInt(base)}</span></div>
        <div class="row"><span>aktuelles Szenario</span><span>${fmtInt(now)}</span></div>`,
    };
  }), { padL: 120 });
}

function renderRisiko(vm) {
  const box = $('#sliders');
  if (!box.dataset.built) {
    box.dataset.built = '1';
    box.innerHTML = KRIT.map(k => `
      <div class="slider">
        <div class="head"><span class="nm">${k.t}${assumeMark('risiko')}</span>
          <span class="val" id="w-${k.k}">${state.riskWeights[k.k]}</span></div>
        <input type="range" min="0" max="100" step="5" value="${state.riskWeights[k.k]}" data-w="${k.k}"
          aria-label="Gewicht ${k.t}">
        <span class="hint">${k.h}</span>
      </div>`).join('');
    box.addEventListener('input', e => {
      const t = e.target.dataset.w; if (!t) return;
      state.riskWeights[t] = +e.target.value;
      $('#w-' + t).textContent = state.riskWeights[t];
      redraw();
    });
    $('#w-reset').addEventListener('click', () => {
      Object.assign(state.riskWeights, DATA.config.defaultWeights);
      $$('#sliders input[data-w]').forEach(i => {
        i.value = state.riskWeights[i.dataset.w];
        $('#w-' + i.dataset.w).textContent = state.riskWeights[i.dataset.w];
      });
      redraw();
    });
  }
  const sum = KRIT.reduce((a, k) => a + state.riskWeights[k.k], 0);
  $('#weight-readout').innerHTML = sum === 0
    ? '<b>Alle Gewichte auf 0.</b> Ohne Gewichtung bleibt der Wert 0.'
    : `<b>Aktuelle Gewichtung:</b> ${weightText(state.riskWeights)}<br>
       Ein Objekt, alle Ansichten lesen denselben Stand.`;

  const top = vm.ranked.slice(0, 20);
  barChart($('#chart-rangliste'), top.map(r => ({
    label: (r.rang + '. ' + r.p.displayName).slice(0, 28),
    value: r.score, valLabel: nf1.format(r.score),
    color: RANG_FARBE[rangKlasse(r.rang, vm.ranked.length)],
    tip: `<b>${esc(r.p.displayName)}</b>
      <div class="row"><span>Rang</span><span>${r.rang} von ${fmtInt(vm.ranked.length)}</span></div>
      <div class="row"><span>Wert</span><span>${nf1.format(r.score)}</span></div>
      <div class="def">Klick im Register öffnet das Blatt.</div>`,
  })), { padL: 160, rowH: 22 });
}

function renderBericht(vm) {
  const k = $('#bericht-kpis'); k.innerHTML = '';
  const cov = vm.coverage;
  [
    { k: 'Fällige + überfällige Termine', v: fmtInt(vm.visits), d: 'jährliche MFA, schematisch', info: 'leitzahl' },
    { k: 'Stellen', v: fmtInt(vm.staff), d: 'Default ' + DATA.config.stellenDefault + (state.scenario === 'stelle' ? ', Szenario ±1' : ''), info: 'stellen' },
    { k: 'Kapazität', v: fmtInt(vm.capacity), d: fmtInt(DATA.config.termineProPersonJahr) + ' Termine je Person und Jahr', info: 'kapazitaet' },
    { k: 'Deckung', v: cov == null ? '—' : fmtPct(cov), d: cov != null && cov < 1 ? 'Unterdeckung' : 'rechnerisch gedeckt', cls: 'ink', info: 'deckung' },
  ].forEach(s => k.appendChild(statCard(s)));

  const mix = $('#chart-deckung'); mix.innerHTML = '';
  mixBar(mix, 'Termine gegen Kapazität', [
    { label: 'gedeckt', n: Math.min(vm.visits, vm.capacity), color: 'var(--dv-green)' },
    { label: 'ungedeckt', n: Math.max(0, vm.visits - vm.capacity), color: 'var(--dv-coral)' },
  ], vm.capacity ? (fmtInt(vm.visits) + ' bei ' + fmtInt(vm.capacity) + ' Plätzen') : 'keine Kapazität');

  columnChart($('#chart-isa-reihe'), DATA.evidence.isaInspectionSeries.map(r => ({
    id: r.year, label: String(r.year).slice(2), n: r.n,
    tip: `<b>${r.year}</b><div class="row"><span>Inspektionen NRW</span><span>${fmtInt(r.n)}</span></div>`,
  })), {
    height: 240, labelEvery: 2, color: 'var(--dv-petrol)',
    breaks: [{ at: 2024, label: '−15 % zu 2023', dy: 8 }],
  });
}

function renderDaten(vm) {
  const ab = DATA.evidence.abgleich;
  barChart($('#chart-daten-abgleich'), ab.map(r => ({
    label: r.t.replace('ISA 2024 ', '').replace('EU-Registry ', '').replace('PRTR 2024 ', '').replace('schematischer ', ''),
    value: r.n, valLabel: fmtInt(r.n),
    color: r.k === 'mfa' ? 'var(--dv-violet)' : (r.k === 'isa' ? 'var(--neutral-400)' : 'var(--dv-petrol)'),
    tip: `<b>${esc(r.t)}</b><div class="row"><span>Zahl</span><span>${fmtInt(r.n)}</span></div><div class="def">${esc(r.d)}</div>`,
  })), { padL: 210, rowH: 36 });
  $('#abgleich-note').innerHTML = `ISA ${fmtInt(2030)} UUBn Arnsberg ≠ ${fmtInt(68)} EU-Betriebe BDH ≠ ${fmtInt(40)} PRTR-Einrichtungen ≠ ${fmtInt(144)} MFA.
    Vier Körnungen, vier Aussagen. Die 2.030 gelten für den ganzen Bezirk Arnsberg, nicht für BDH allein. Die 144 MFA sind ◈.`;

  const hf = DATA.evidence.prtrHoldForward;
  columnChart($('#chart-daten-backtest'), DATA.evidence.prtrFacilitySeries.map(r => ({
    id: r.year, label: String(r.year).slice(2), n: r.n,
    tip: `<b>${r.year}</b><div class="row"><span>PRTR-Einrichtungen BDH</span><span>${fmtInt(r.n)}</span></div>` +
      (r.year >= 2020 ? `<div class="row"><span>Hold-Forward</span><span>${fmtInt(hf.hold)}</span></div>` : ''),
  })), {
    height: 240, labelEvery: 1, color: 'var(--dv-petrol)',
    breaks: [{ at: 2020, label: 'Vorhersagefenster', dy: 8 }],
  });
  $('#gegenprobe-note').innerHTML = `Hold-Forward des Stands ${fmtInt(hf.hold)} (2019) auf 2020–2024, MAPE ${fmtPct(hf.mape)}.
    Die Fortschreibung taugt als Größenordnung, nicht als Planungsgrundlage je Jahr.
    Die ISA-Inspektionsreihe daneben zeigt den gesetzlichen 1-/3-Jahres-Rhythmus, keine gefittete Kurve.`;

  const bm = DATA.evidence.benchmark;
  barChart($('#chart-benchmark'), bm.rows.map(r => ({
    label: r.t.replace('UUBn ', ''),
    value: r.anlagen,
    valLabel: fmtInt(r.anlagen) + ' · Rang ' + r.rangAnlagen,
    color: r.k === 'arnsberg' ? 'var(--dv-petrol)' : 'var(--neutral-300)',
    tip: `<b>${esc(r.t)}</b>
      <div class="row"><span>Anlagen</span><span>${fmtInt(r.anlagen)}</span></div>
      <div class="row"><span>je 1.000 Ew. (RB)</span><span>${nf1.format(r.je1000)}</span></div>
      <div class="row"><span>Rang Bestand</span><span>${r.rangAnlagen} von ${bm.n}</span></div>
      <div class="row"><span>Rang je 1.000</span><span>${r.rangJe1000} von ${bm.n}</span></div>`,
  })), { padL: 110, rowH: 28 });
  $('#benchmark-note').innerHTML = `UUBn Arnsberg liegt auf <b>Rang ${bm.arnsbergRangAnlagen} von ${fmtInt(bm.n)}</b> nach Anlagenbestand
    und auf Rang ${bm.arnsbergRangJe1000} je 1.000 Einwohner des Regierungsbezirks.
    Zwei Einschränkungen der Normierung: (1) BDH ist nur ein Teil der UUBn Arnsberg.
    (2) Anlagen der 44. BImSchV sind nicht die ISA-Zählung nach 4. BImSchV. Die drei Städte werden nicht gegeneinander gerankt, weil ISA sie nicht trennt.`;

  $('#annahmen-liste').innerHTML = (DATA.annahmen || []).map(a =>
    `<div class="kv"><span class="kk"><b>${esc(a.t)}</b></span><span class="vv"></span>
     <span class="src">${esc(a.d)}</span></div>`).join('');
}

function redraw() {
  const vm = deriveDashboard(DATA, state);
  renderOverview(vm);
  renderRegister(vm);
  renderFristen(vm);
  renderRisiko(vm);
  renderBericht(vm);
  renderDaten(vm);
  $('#staff-seg').hidden = state.scenario !== 'stelle';
  verdrahteQuellen();
}

$('#scenario-seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-sc]'); if (!b) return;
  state.scenario = b.dataset.sc;
  $$('#scenario-seg button').forEach(x => x.classList.toggle('active', x === b));
  redraw();
});
$('#staff-seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-delta]'); if (!b) return;
  state.staffDelta = +b.dataset.delta;
  $$('#staff-seg button').forEach(x => x.classList.toggle('active', x === b));
  redraw();
});
['f-city', 'f-interval'].forEach(id => {
  $('#' + id).addEventListener('change', e => {
    if (id === 'f-city') state.filter.city = e.target.value;
    else state.filter.interval = e.target.value;
    redraw();
  });
});
$('#f-suche').addEventListener('input', e => { state.filter.q = e.target.value; redraw(); });
$('#f-vis').addEventListener('change', e => { state.visibility = e.target.checked; redraw(); });
$('#csv-mfa').addEventListener('click', () => {
  const vm = deriveDashboard(DATA, state);
  csvDownload('anlagen-fristenmonitor-bdh-mfa.csv',
    ['id', 'Anzeige', 'Stadt', 'PLZ', 'Klasse', 'Brennstoff', 'Typ', 'IntervallMonate', 'letzteMessung', 'faelligClient'],
    vm.mfa.map(r => [r.p.id, r.p.displayName, cityName(r.p.cityKey), vis(r.p.postalCode),
      r.p.sizeBand, r.p.fuel, r.p.plantType, r.interval, r.p.lastMeasuredOn, r.due || '']));
});
$('#csv-ied').addEventListener('click', () => {
  const vm = deriveDashboard(DATA, state);
  csvDownload('anlagen-fristenmonitor-bdh-ied.csv',
    ['id', 'Anzeige', 'Stadt', 'PLZ', 'Typ', 'Status', 'IE', 'Inspektionen2024', 'PRTR2024'],
    vm.ied.map(r => [r.id, r.displayName, cityName(r.cityKey), vis(r.postalCode || ''),
      r.typ, r.status, r.ieActivity || '', r.insp, r.prtr2024 ? 'ja' : 'nein']));
});
bindTable($('#overview-mfa'), sortMfa, redraw);
bindTable($('#overview-ied'), sortIed, redraw);
bindTable($('#register-mfa'), sortMfa, redraw);
bindTable($('#register-ied'), sortIed, redraw);

$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
$('#print-btn').addEventListener('click', () => {
  const d = $('#drawer');
  document.body.classList.toggle('printing-blatt', !!d && d.classList.contains('show'));
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-blatt'));
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-goto]'); if (!a) return;
  e.preventDefault(); showView(a.dataset.goto);
});
redraw();

})();
