/* =========================================================================
   Kanduit Ganztags-Platzmonitor Mönchengladbach — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-/Vergabe-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_GANZTAGS;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting (de-DE) ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDec = (v, d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const fmtInt = v => nf.format(Math.round(v));
const fmtPct = v => nf1.format(v) + ' %';
const fmtPct0 = v => nf.format(Math.round(v)) + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview: 'view-overview', map: 'view-map', table: 'view-table', capacity: 'view-capacity', measures: 'view-measures', sheet: 'view-sheet' };
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
   Wird von buildMetricInfo() bei jedem Rendern mit den aktuellen Annahmen
   neu aufgebaut; ein Eintrag je KPI und Chart, jeder benennt Berechnung
   UND Datenlücke.
   ==================================================================== */
let METRIC_INFO = {};

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
   Schlüssel und URLs kommen aus meta.quellen in data.js; im HTML steht
   <p class="note src-note" data-src="key"></p>.
   ==================================================================== */
const SRC_LABEL = DATA.meta.quellen;
$$('.src-note').forEach(n => {
  const s = SRC_LABEL[n.dataset.src]; if (!s) return;
  n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a> · Abruf ${DATA.meta.stand}`;
});

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
   MODELL — sämtliche Szenariorechnung läuft hier im Browser.
   ==================================================================== */
const K = DATA.konstanten;
const BASISJAHR = DATA.meta.basisjahr;
const C_OK = 'var(--ok)', C_WARN = 'var(--warn)', C_ERR = 'var(--error)';
const C_KAP = 'var(--dv-petrol)', C_LUECKE = 'var(--dv-coral)', C_MASS = 'var(--dv-green)';

const state = {
  stufe: DATA.stufen[0].id,
  szenario: 'stufenplan',       // stufenplan | nachfrage | raumoptionen
  quotePlus: 10,                // Szenario „Hohe Inanspruchnahme“: +10 oder +20 pp
  mitMassnahmen: true,          // Szenario „Raumoptionen“
  raum: Object.assign({}, DATA.raumDefaults),
  quote: K.quoteBasis,
  bestandsquote: K.bestandsquote,
  trend: Math.round(K.trendDefault * 1000) / 10,  // in Prozent, auf die Reglerstufe gerundet
  sortKey: 'luecke',
  sortDir: -1,
  filterBezirk: 'alle',
  sheetNr: DATA.schulen[0].nr
};

const stufeById = id => DATA.stufen.find(s => s.id === id) || DATA.stufen[0];
const schuleByNr = nr => DATA.schulen.find(s => s.nr === nr);

/* Wirksame Inanspruchnahmequote — Szenario 2 hebt sie um 10 bzw. 20 Punkte an. */
function quoteEffektiv() {
  return state.szenario === 'nachfrage'
    ? Math.min(100, state.quote + state.quotePlus)
    : state.quote;
}
/* Szenario 3 vergleicht mit und ohne die geplanten Maßnahmen. */
function massnahmenAktiv() {
  return state.szenario === 'raumoptionen' ? state.mitMassnahmen : true;
}

/* Klassenraum-Äquivalente je Standort inklusive der Demo-Streuung des
   Raumbestands. Bei Streuung 0 % rechnet das Modell strikt proportional zur
   Schülerzahl. Identische Formel wie in scripts/generate.py. */
function raeumeEffektiv(s, raum) {
  const r = raum || state.raum;
  return Math.max(1, Math.round(s.raeume * (1 + r.raumStreuung / 100 * s.raumIndex)));
}

/* Kapazität je Standort aus Fläche und Nutzung — nicht aus festen Gruppengrößen.
   Identische Formel wie in scripts/generate.py. */
function kapazitaet(s, raum) {
  const r = raum || state.raum;
  const flaeche = raeumeEffektiv(s, r) * r.flaecheProRaum * (r.anteilGanztag / 100);
  return Math.floor(flaeche / r.flaecheProKind * r.belegungsfaktor);
}

/* Zahl der an einem Standort tatsächlich geführten Jahrgänge (Schulen im Aufbau
   führen noch nicht alle vier). */
function jahrgaengeVorhanden(s, jahr) {
  return s.imAufbau ? Math.max(1, Math.min(4, jahr - s.gruendung + 1)) : 4;
}

function massnahmenFuer(nr, jahr) {
  return DATA.massnahmen
    .filter(m => m.schulNr === nr && m.wirksamAb <= jahr)
    .reduce((a, m) => a + m.plaetze, 0);
}

function ampel(deckung) {
  if (deckung >= 1) return 'gruen';
  if (deckung >= 0.85) return 'gelb';
  return 'rot';
}
const AMPEL_FARBE = { gruen: C_OK, gelb: C_WARN, rot: C_ERR };
const AMPEL_TEXT = { gruen: 'gedeckt', gelb: 'knapp', rot: 'Lücke' };

/* Kernrechnung je Standort und Ausbaustufe. */
function berechne(s, stufe, opts) {
  opts = opts || {};
  const mitM = opts.mitMassnahmen != null ? opts.mitMassnahmen : massnahmenAktiv();
  const quote = opts.quote != null ? opts.quote : quoteEffektiv();
  const raum = opts.raum || state.raum;
  const trend = (opts.trend != null ? opts.trend : state.trend) / 100;

  const jahr = stufe.jahr;
  const kohorte = s.kohorte * Math.pow(1 + trend, jahr - BASISJAHR);
  const vorhanden = jahrgaengeVorhanden(s, jahr);
  const anspruchsJg = Math.min(stufe.jahrgaenge, vorhanden);
  const bestandsJg = Math.max(0, vorhanden - anspruchsJg);

  const bedarfAnspruch = kohorte * anspruchsJg * (quote / 100);
  const bedarfBestand = kohorte * bestandsJg * (state.bestandsquote / 100);
  const bedarf = bedarfAnspruch + bedarfBestand;

  const kapBasis = kapazitaet(s, raum);
  const kapMass = mitM ? massnahmenFuer(s.nr, jahr) : 0;
  const kap = kapBasis + kapMass;
  const luecke = Math.max(0, bedarf - kap);
  const deckung = bedarf > 0 ? kap / bedarf : 1;

  return {
    schule: s, stufe: stufe, kohorte: kohorte, anspruchsJg: anspruchsJg, bestandsJg: bestandsJg,
    bedarf: bedarf, bedarfAnspruch: bedarfAnspruch, bedarfBestand: bedarfBestand,
    kapBasis: kapBasis, kapMass: kapMass, kap: kap,
    luecke: luecke, ueberhang: Math.max(0, kap - bedarf),
    deckung: deckung, ampel: ampel(deckung)
  };
}

function alleStandorte(stufe, opts) {
  return DATA.schulen.map(s => berechne(s, stufe, opts));
}
function summe(rows) {
  const acc = { bedarf: 0, bedarfAnspruch: 0, bedarfBestand: 0, kap: 0, kapBasis: 0, kapMass: 0, luecke: 0, ueberhang: 0, kohorte: 0 };
  rows.forEach(r => { for (const k in acc) acc[k] += r[k]; });
  acc.deckung = acc.bedarf > 0 ? acc.kap / acc.bedarf : 1;
  return acc;
}

/* Freie Plätze für die Erstklässler eines Schuljahres — die Größe, die die Stadt
   öffentlich genannt hat (rund 1.380 im Sommer 2026). */
function freiePlaetzeKlasse1(stufe) {
  const belegtDurchBestand = DATA.schulen.reduce((a, s) => {
    const kohorte = s.kohorte * Math.pow(1 + state.trend / 100, stufe.jahr - BASISJAHR);
    const vorhanden = jahrgaengeVorhanden(s, stufe.jahr);
    return a + kohorte * Math.max(0, vorhanden - 1) * (state.bestandsquote / 100);
  }, 0);
  const kap = DATA.schulen.reduce((a, s) => a + kapazitaet(s, state.raum) + (massnahmenAktiv() ? massnahmenFuer(s.nr, stufe.jahr) : 0), 0);
  return kap - belegtDurchBestand;
}

/* ====================================================================
   GLOSSAR — jede Kennzahl mit Berechnung UND Datenlücke.
   ==================================================================== */
function buildMetricInfo() {
  const st = stufeById(state.stufe);
  const anzahl = DATA.schulen.length;
  const dq = `Aus offenen Daten stammen Standorte, Schüler- und Klassenzahlen (${anzahl} Grundschulen, Schuljahr ${DATA.meta.schuljahrBasis}). `;
  const demo = 'Demo-Annahme — im Projekt durch Daten des Fachbereichs zu ersetzen.';

  METRIC_INFO = {
    bedarf: { t: 'Platzbedarf gesamt', d: `Summe über alle ${anzahl} Standorte: Jahrgangsstärke × Zahl der geführten Jahrgänge × Quote. Für die Anspruchsjahrgänge (${st.klassen}) gilt die Inanspruchnahmequote von ${fmtPct(quoteEffektiv())}, für die übrigen Jahrgänge die Bestandsquote von ${fmtPct(state.bestandsquote)}. ${dq}Nicht offen verfügbar sind die Jahrgangsstärken je Schule — sie werden als Schülerzahl ÷ 4 Jahrgänge angesetzt (Schulen im Aufbau: ÷ Zahl der bereits geführten Jahrgänge). Die Bestandsquote ist eine ${demo}` },
    bedarfAnspruch: { t: 'Davon rechtlich gebunden', d: `Der Teil des Platzbedarfs, der in der Stufe ${st.id} unter den Rechtsanspruch nach § 24 Abs. 4 SGB VIII fällt (${st.klassen}). Rechenweg: Jahrgangsstärke × ${st.jahrgaenge} Anspruchsjahrgang/-jahrgänge × ${fmtPct(quoteEffektiv())}. Die Quote ist aus der öffentlich genannten Bedarfsgröße für 2026/27 zurückgerechnet, nicht amtlich ausgewiesen.` },
    kapazitaet: { t: 'Kapazität', d: `Ergebnis des Raummodells: Klassenraum-Äquivalente × ${nf1.format(state.raum.flaecheProRaum)} m² × ${fmtPct(state.raum.anteilGanztag)} ÷ ${nf2.format(state.raum.flaecheProKind)} m² je Kind × Belegungsfaktor ${nf2.format(state.raum.belegungsfaktor)}${massnahmenAktiv() ? ', zuzüglich der bis dahin wirksamen Maßnahmen' : ' — ohne Maßnahmen (Szenario „Raumoptionen“)'}. Raumflächen je Standort liegen nicht offen vor; die Klassenraum-Äquivalente werden aus der Schülerzahl und der mittleren Klassengröße (${nf1.format(K.klassengroesse)}, MSB NRW) abgeleitet. Sämtliche Raumkennwerte sind ${demo}` },
    luecke: { t: 'Offene Plätze (Lücke)', d: `Platzbedarf minus Kapazität, je Standort auf mindestens null begrenzt und dann summiert. Überhänge an einem Standort gleichen eine Lücke an einem anderen also nicht aus — genau das ist der Unterschied zur gesamtstädtischen Bilanz. Grundlage sind die oben genannten Annahmen; die Größe ist ein Planungswert, keine Feststellung des Schulträgers.` },
    deckung: { t: 'Deckungsgrad', d: `Kapazität geteilt durch Platzbedarf. Ampellogik: grün ab 100 %, gelb ab 85 %, rot darunter. Der Deckungsgrad wird je Standort gerechnet und für Bezirke und die Gesamtstadt aus den Summen gebildet.` },
    stufenbilanz: { t: 'Stadtweite Bilanz je Ausbaustufe', d: `Je Ausbaustufe der gedeckte Anteil des Platzbedarfs und die offenen Plätze, gestapelt. Der Rechtsanspruch wächst jährlich um einen Jahrgang: ${DATA.stufen.map(s => s.id + ' = ' + s.klassen).join(', ')}. Die Balkenhöhe ist der Gesamtplatzbedarf, also einschließlich der Jahrgänge ohne Anspruch. Fortschreibung der Jahrgangsstärken mit ${fmtPct(state.trend)} p. a.` },
    anker: { t: 'Plausibilitätsanker 2026/27', d: `Vergleich des Modellergebnisses mit den Zahlen, die die Stadt Mönchengladbach für das Schuljahr 2026/27 öffentlich genannt hat: ${fmtInt(DATA.anker.bedarfVon)}–${fmtInt(DATA.anker.bedarfBis)} benötigte Plätze für Erstklässler, rund ${fmtInt(DATA.anker.freiePlaetze)} freie Plätze, bis zu ${fmtInt(DATA.anker.luecke)} zusätzlich zu schaffende Plätze. Die Voreinstellungen der Raumregler sind bewusst so gewählt, dass das Modell diese Größenordnung reproduziert — der Anker prüft also die Kalibrierung, nicht das Ergebnis. Bei veränderten Reglern läuft er auseinander; das ist beabsichtigt.` },
    zeitreihe: { t: 'Grundschülerzahlen im Zeitverlauf', d: `Ist-Werte 2012/13 bis ${BASISJAHR}/${String(BASISJAHR + 1).slice(2)} aus dem Open-Data-Angebot des Schulministeriums NRW (Kreis 116, Schulform Grundschule, öffentlich und privat). Ab ${BASISJAHR + 1} Fortschreibung mit dem eingestellten Jahrgangstrend von ${fmtPct(state.trend)} p. a. Geburtsjahrgänge, Wanderungssalden und Einzugsbereiche liegen nicht offen vor — im Projekt tritt die Bevölkerungsprognose des Fachbereichs an die Stelle dieser Fortschreibung.` },
    luecke_bezirk: { t: 'Offene Plätze je Stadtbezirk', d: `Summe der standortscharfen Lücken je Stadtbezirk in der Stufe ${st.id}. Die Zuordnung der Standorte zu den vier Stadtbezirken erfolgt geometrisch über die Grenzen aus OpenStreetMap (ODbL); amtliche Bezirksgrenzen liegen für Mönchengladbach nicht als offener Datensatz vor. Schuleinzugsbereiche sind nicht abgebildet — sie wären im Projekt die genauere Aggregationsebene.` },
    karte: { t: 'Standortkarte', d: `Punktposition aus den UTM-Koordinaten des Schulverzeichnisses NRW (EPSG:25832, nach WGS84 umgerechnet). Farbe nach Deckungsgrad in der Stufe ${st.id}, Fläche des Punktes proportional zum Platzbedarf. Die Bezirksflächen sind vereinfachte OSM-Grenzen (Toleranz rund 35 m) und dienen der Orientierung, nicht der Flächenberechnung.` },
    ampel_bezirk: { t: 'Standorte je Ampelstufe und Bezirk', d: `Verteilung der Standorte eines Bezirks auf grün (Deckungsgrad ab 100 %), gelb (ab 85 %) und rot. Gezählt werden Standorte, nicht Plätze — ein großer roter Standort wiegt hier so viel wie ein kleiner. Die Platzsicht steht in der Standorttabelle.` },
    bezirkstabelle: { t: 'Bezirksübersicht', d: `Bedarf, Kapazität und Lücke je Stadtbezirk, dazu der Ü3-Platzbestand der Kindertageseinrichtungen als Vorlaufindikator für die kommenden Einschulungsjahrgänge (Open Data NRW, ${DATA.bezirke.reduce((a, b) => a + b.kitas, 0)} Einrichtungen zugeordnet${DATA.meta.kitasOhneBezirk ? `, ${DATA.meta.kitasOhneBezirk} ohne Bezirkszuordnung wegen der vereinfachten Grenzen` : ''}). Der Ü3-Bestand ist ein Indikator, keine Prognose: Übergangsquoten zwischen Kita und Grundschule liegen nicht offen vor.` },
    raummodell: { t: 'Raumannahmen', d: `Die vier Regler bestimmen die Kapazität je Standort. Klassenraum-Äquivalente werden als Schülerzahl ÷ mittlere Klassengröße (${nf1.format(K.klassengroesse)}; ${DATA.zeitreihe[DATA.zeitreihe.length - 1].schueler.toLocaleString('de-DE')} Schülerinnen und Schüler in ${DATA.zeitreihe[DATA.zeitreihe.length - 1].klassen} Klassen, MSB NRW) berechnet. Alle fünf Kennwerte sind ${demo} Die Voreinstellungen sind auf die öffentlich genannte Größenordnung für 2026/27 kalibriert. Der fünfte Regler bildet ab, dass der Raumbestand real nicht der Schülerzahl folgt — siehe die eigene Erläuterung dort.` },
    nachfrage: { t: 'Nachfrageannahmen', d: `Die Inanspruchnahmequote der Anspruchsjahrgänge ist aus der öffentlich genannten Bedarfsgröße 2026/27 (${fmtInt(DATA.anker.bedarfVon)}–${fmtInt(DATA.anker.bedarfBis)} Plätze) und der modellierten Jahrgangsstärke zurückgerechnet: ${fmtPct(K.quoteBasis)}. Die Bestandsquote der Jahrgänge ohne Anspruch ist eine ${demo} Der Jahrgangstrend ist die beobachtete jährliche Veränderung der Grundschülerzahl: ${fmtPct(K.trend.j3 * 100)} über drei Jahre, ${fmtPct(K.trend.j5 * 100)} über fünf, ${fmtPct(K.trend.j1 * 100)} im letzten Jahr.` },
    kap_bezirk: { t: 'Kapazität und Bedarf je Stadtbezirk', d: `Gestapelt: die vorhandene Kapazität und der darüber hinausgehende Bedarf. Die Balkenhöhe ist damit der Gesamtplatzbedarf des Bezirks in der Stufe ${st.id}. Kapazitäten sind Modellwerte aus den Raumannahmen (${demo}), Bedarfe folgen aus Schülerzahlen und Quoten.` },
    sensitivitaet: { t: 'Empfindlichkeit des Flächenrichtwerts', d: `Stadtweite Kapazität bei unterschiedlichen Flächenrichtwerten je Kind, alle übrigen Regler unverändert. Die Reihe zeigt, wie stark das Ergebnis an genau dieser Annahme hängt — deshalb ist der Richtwert im Projekt zuerst mit dem Fachbereich und dem Gebäudemanagement zu klären. Ein amtlicher Richtwert für den offenen Ganztag ist nicht offen veröffentlicht.` },
    wirkung: { t: 'Kumulierte Wirkung der Maßnahmen', d: `Je Ausbaustufe: die durch bis dahin wirksame Maßnahmen geschlossenen Plätze und die danach verbleibende Lücke. Die Summe beider Werte ist die Lücke ohne Maßnahmen. Eine Maßnahme wirkt ab dem angegebenen Jahr auf ihren Standort, nicht stadtweit — Plätze in Rheindahlen decken keinen Anspruch in Neuwerk. Die gesamte Maßnahmenliste ist ${demo}` },
    plaetze_jahr: { t: 'Geschaffene Plätze je Wirksamkeitsjahr', d: `Verteilung der angenommenen Platzwirkung auf die Wirksamkeitsjahre. Vollständig ${demo} Geplante Schulbaumaßnahmen werden nicht offen veröffentlicht; im Projekt kommt diese Liste aus der Koordination Schulbaumaßnahmen (40.G).` },
    massnahmen_gesamt: { t: 'Maßnahmen gesamt', d: `Zahl und Platzwirkung der angenommenen Bau- und Umbaumaßnahmen. Sie sind deterministisch aus der modellierten Endstufenlücke 2029/30 abgeleitet, damit die Mechanik nachvollziehbar bleibt. Keine dieser Maßnahmen ist beschlossen oder angekündigt — ${demo}` },
    kohorte: { t: 'Jahrgangsstärke', d: `Schülerzahl des Standorts geteilt durch vier Jahrgänge, fortgeschrieben mit ${fmtPct(state.trend)} p. a. Bei Schulen im Aufbau wird durch die Zahl der bereits geführten Jahrgänge geteilt. Eine jahrgangsscharfe Schülerstatistik je Schule liegt nicht offen vor; § 120 SchulG NRW schließt personenbezogene Schülerdaten beim Schulträger ohnehin aus.` },
    sozialindex: { t: 'Sozialindexstufe', d: `Stufe 1 bis 9 nach dem Sozialindex des Landes NRW (Schulliste Schuljahr 2025/26, MSB NRW); Stufe 9 steht für die größte Belastung. Für neu errichtete Standorte ist keine Stufe ausgewiesen („ohne“). Der Index geht in diese Rechnung nicht ein — er ist als Priorisierungshinweis mitgeführt.` },
    raeume: { t: 'Klassenraum-Äquivalente', d: `Schülerzahl geteilt durch die mittlere Klassengröße in Mönchengladbach (${nf1.format(K.klassengroesse)}, MSB NRW), aufgerundet, anschließend mit der eingestellten Streuung von ${fmtPct(state.raum.raumStreuung)} verschoben. Ein Ersatz für das nicht offen verfügbare Raumbuch: die tatsächliche Raumzahl, Raumgrößen und Fachraumanteile je Standort sind ${demo}` },
    streuung: { t: 'Streuung des Raumbestands', d: `Der Raumbestand einer Grundschule folgt real nicht ihrer Schülerzahl: Baujahr, spätere Erweiterungen, Fachraum- und Mensaanteil unterscheiden sich erheblich. Diese Streuung ist planungsrelevant, liegt aber nicht offen vor — sie wird hier deterministisch aus der Schulnummer erzeugt und stadtweit auf null zentriert, verschiebt also Kapazität zwischen Standorten, ohne welche zu schaffen. Auf 0 % gestellt rechnet das Modell strikt proportional zur Schülerzahl; dann liegen fast alle Standorte beim selben Deckungsgrad — das wäre ein Artefakt des Modells und keine Aussage über die Stadt. ${demo}` }
  };
}

/* ====================================================================
   STEUERLEISTE — Ausbaustufe und Szenario, in mehreren Ansichten geteilt.
   ==================================================================== */
const SZENARIEN = [
  { id: 'stufenplan', t: 'Stufenplan bis 2029/30', sub: 'Quote konstant' },
  { id: 'nachfrage', t: 'Hohe Inanspruchnahme', sub: 'Quote + 10 / + 20 Pp.' },
  { id: 'raumoptionen', t: 'Raumoptionen', sub: 'mit / ohne Maßnahmen' }
];

function controlsHtml() {
  const stufen = DATA.stufen.map(s =>
    `<button data-ctrl="stufe" data-val="${s.id}" class="${s.id === state.stufe ? 'on' : ''}" aria-pressed="${s.id === state.stufe}">${s.id}<span class="sm">${s.klassen}</span></button>`).join('');
  const szen = SZENARIEN.map(s =>
    `<button data-ctrl="szenario" data-val="${s.id}" class="${s.id === state.szenario ? 'on' : ''}" aria-pressed="${s.id === state.szenario}">${s.t}<span class="sm">${s.sub}</span></button>`).join('');

  let extra = '';
  if (state.szenario === 'nachfrage') {
    extra = `<div class="ctrl-group"><span class="lbl">Aufschlag auf die Quote</span><div class="segmented">
      ${[10, 20].map(p => `<button data-ctrl="quotePlus" data-val="${p}" class="${state.quotePlus === p ? 'on' : ''}" aria-pressed="${state.quotePlus === p}">+ ${p} Pp.<span class="sm">${fmtPct(Math.min(100, state.quote + p))}</span></button>`).join('')}
    </div></div>`;
  } else if (state.szenario === 'raumoptionen') {
    extra = `<div class="ctrl-group"><span class="lbl">Raumoptionen</span><div class="segmented">
      <button data-ctrl="mitMassnahmen" data-val="1" class="${state.mitMassnahmen ? 'on' : ''}" aria-pressed="${state.mitMassnahmen}">mit Maßnahmen<span class="sm">${fmtInt(DATA.massnahmen.reduce((a, m) => a + m.plaetze, 0))} Plätze</span></button>
      <button data-ctrl="mitMassnahmen" data-val="0" class="${!state.mitMassnahmen ? 'on' : ''}" aria-pressed="${!state.mitMassnahmen}">ohne Maßnahmen<span class="sm">Bestand</span></button>
    </div></div>`;
  }

  return `<div class="controls">
    <div class="ctrl-group"><span class="lbl">Ausbaustufe des Rechtsanspruchs</span><div class="segmented">${stufen}</div></div>
    <div class="ctrl-group"><span class="lbl">Szenario</span><div class="segmented">${szen}</div></div>
    ${extra}
  </div>`;
}

function mountControls() {
  ['controls-overview', 'controls-map', 'controls-table', 'controls-measures'].forEach(id => {
    const host = $('#' + id); if (host) host.innerHTML = controlsHtml();
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('.controls .segmented button'); if (!b) return;
  const k = b.dataset.ctrl, v = b.dataset.val;
  if (k === 'stufe') state.stufe = v;
  else if (k === 'szenario') state.szenario = v;
  else if (k === 'quotePlus') state.quotePlus = +v;
  else if (k === 'mitMassnahmen') state.mitMassnahmen = v === '1';
  renderAll();
});

/* ====================================================================
   VIEWS
   ==================================================================== */
function renderLegalBanner() {
  $('#legal-banner').innerHTML = `<b>Rechtsanspruch auf ganztägige Förderung.</b>
    Nach § 24 Abs. 4 SGB VIII (GaFöG) besteht der Anspruch seit dem 1. August 2026 für die erste
    Klasse und wächst jährlich um einen Jahrgang bis zu den Klassen 1–4 im Schuljahr 2029/30.
    Die Schulentwicklungsplanung ist Pflichtaufgabe nach § 80 SchulG NRW. Dieser Demonstrator
    arbeitet ausschließlich mit aggregierten Daten auf Ebene Schule, Stadtbezirk und Jahrgang;
    personenbezogene Schülerdaten erhält der Schulträger nach § 120 SchulG NRW nicht und werden
    hier auch nicht gebraucht.`;
}

function renderOverview() {
  const st = stufeById(state.stufe);
  const rows = alleStandorte(st);
  const s = summe(rows);
  const rot = rows.filter(r => r.ampel === 'rot').length;

  const kpis = $('#overview-kpis'); kpis.innerHTML = '';
  kpis.appendChild(statCard({
    k: 'Platzbedarf ' + st.id, v: fmtInt(s.bedarf), info: 'bedarf',
    d: `davon ${fmtInt(s.bedarfAnspruch)} rechtlich gebunden (${st.klassen})`, cls: 'ink'
  }));
  kpis.appendChild(statCard({
    k: 'Kapazität', v: fmtInt(s.kap), info: 'kapazitaet',
    d: massnahmenAktiv() && s.kapMass > 0
      ? `Bestand ${fmtInt(s.kapBasis)} + ${fmtInt(s.kapMass)} aus Maßnahmen`
      : 'Bestand aus dem Raummodell, ohne Maßnahmen'
  }));
  kpis.appendChild(statCard({
    k: 'Offene Plätze', v: fmtInt(s.luecke), info: 'luecke', cls: 'petrol',
    d: `an ${rot} von ${rows.length} Standorten unter 85 % Deckung`
  }));
  kpis.appendChild(statCard({
    k: 'Deckungsgrad', v: fmtPct0(s.deckung * 100), info: 'deckung',
    d: `Überhang an anderen Standorten: ${fmtInt(s.ueberhang)} Plätze`
  }));

  /* Bilanz je Stufe */
  columnChart($('#chart-stufen'), DATA.stufen.map(stufe => {
    const sum = summe(alleStandorte(stufe));
    return {
      id: stufe.id, label: stufe.id,
      gedeckt: Math.min(sum.kap, sum.bedarf), luecke: sum.luecke,
      tip: `<b>${stufe.id} · ${stufe.klassen}</b>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(sum.bedarf)}</span></div>
        <div class="row"><span>davon Rechtsanspruch</span><span>${fmtInt(sum.bedarfAnspruch)}</span></div>
        <div class="row"><span>Kapazität</span><span>${fmtInt(sum.kap)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sum.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(sum.deckung * 100)}</span></div>`
    };
  }), {
    keys: [{ key: 'gedeckt', color: C_KAP }, { key: 'luecke', color: C_LUECKE }],
    legend: [{ label: 'gedeckter Bedarf', color: C_KAP }, { label: 'offene Plätze', color: C_LUECKE }],
    height: 260, showTotals: true
  });

  /* Plausibilitätsanker */
  const st2627 = DATA.stufen[0];
  const s2627 = summe(alleStandorte(st2627, { mitMassnahmen: false }));
  const frei = freiePlaetzeKlasse1(st2627);
  const a = DATA.anker;
  const zeile = (label, modell, referenz, anzeige) => {
    const abw = referenz ? (modell - referenz) / referenz * 100 : 0;
    return `<div class="buyer-row"><div class="nm">${label}<span class="sub">öffentlich genannt: ${anzeige}</span></div>
      <div class="n">${fmtInt(modell)}<span class="sub" style="text-align:right; display:block">Abweichung ${nf1.format(abw)} %</span></div></div>`;
  };
  const mitte = (a.bedarfVon + a.bedarfBis) / 2;
  $('#anker-box').innerHTML =
    zeile('Bedarf Erstklässler', s2627.bedarfAnspruch, mitte, `${fmtInt(a.bedarfVon)}–${fmtInt(a.bedarfBis)}`) +
    zeile('Freie Plätze für Klasse 1', frei, a.freiePlaetze, 'rund ' + fmtInt(a.freiePlaetze)) +
    zeile('Zusätzlich zu schaffen', Math.max(0, s2627.bedarfAnspruch - frei), a.luecke, 'bis zu ' + fmtInt(a.luecke)) +
    `<p class="note">Die Voreinstellungen der Raumregler sind auf diese öffentlich genannten Werte
      kalibriert. Sobald Sie im Kapazitätsmodell etwas verändern, läuft der Anker auseinander —
      das macht sichtbar, wie stark das Ergebnis an welcher Annahme hängt.</p>`;

  /* Zeitreihe Ist + Fortschreibung */
  const letzte = DATA.zeitreihe[DATA.zeitreihe.length - 1];
  const reihe = DATA.zeitreihe.map(z => ({
    id: 'j' + z.jahr, label: String(z.jahr).slice(2),
    ist: z.schueler, prognose: 0,
    tip: `<b>Schuljahr ${z.jahr}/${String(z.jahr + 1).slice(2)}</b>
      <div class="row"><span>Schülerinnen und Schüler</span><span>${fmtInt(z.schueler)}</span></div>
      <div class="row"><span>Klassen</span><span>${fmtInt(z.klassen)}</span></div>
      <div class="row"><span>Schulen</span><span>${fmtInt(z.schulen)}</span></div>`
  }));
  for (let j = BASISJAHR + 1; j <= 2029; j++) {
    const v = letzte.schueler * Math.pow(1 + state.trend / 100, j - BASISJAHR);
    reihe.push({
      id: 'j' + j, label: String(j).slice(2), ist: 0, prognose: v,
      tip: `<b>Schuljahr ${j}/${String(j + 1).slice(2)} — Fortschreibung</b>
        <div class="row"><span>modelliert</span><span>${fmtInt(v)}</span></div>
        <div class="row"><span>Jahrgangstrend</span><span>${fmtPct(state.trend)} p. a.</span></div>`
    });
  }
  columnChart($('#chart-zeitreihe'), reihe, {
    keys: [{ key: 'ist', color: C_KAP }, { key: 'prognose', color: 'var(--petrol-300)' }],
    legend: [{ label: 'Ist (MSB NRW)', color: C_KAP }, { label: 'Fortschreibung', color: 'var(--petrol-300)' }],
    breaks: [{ at: 'j2026', label: 'Rechtsanspruch ab 01.08.2026', dy: 8 }],
    height: 260, labelEvery: 2
  });

  /* Lücke je Bezirk */
  barChart($('#chart-bezirke'), DATA.bezirke.map(b => {
    const sub = summe(rows.filter(r => r.schule.bezirk === b.name));
    return {
      label: b.name, value: sub.luecke, valLabel: fmtInt(sub.luecke),
      color: AMPEL_FARBE[ampel(sub.deckung)],
      tip: `<b>Stadtbezirk ${b.name}</b>
        <div class="row"><span>Standorte</span><span>${fmtInt(b.schulen)}</span></div>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(sub.bedarf)}</span></div>
        <div class="row"><span>Kapazität</span><span>${fmtInt(sub.kap)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sub.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(sub.deckung * 100)}</span></div>`
    };
  }), { padL: 90 });
}

/* ---------------- Karte ---------------- */
function renderMap() {
  const st = stufeById(state.stufe);
  const rows = alleStandorte(st);
  const byAmpel = { gruen: 0, gelb: 0, rot: 0 };
  rows.forEach(r => byAmpel[r.ampel]++);

  const kpis = $('#map-kpis'); kpis.innerHTML = '';
  kpis.appendChild(statCard({ k: 'Standorte gedeckt', v: fmtInt(byAmpel.gruen), info: 'deckung', d: 'Deckungsgrad ab 100 %' }));
  kpis.appendChild(statCard({ k: 'Standorte knapp', v: fmtInt(byAmpel.gelb), info: 'deckung', d: 'Deckungsgrad 85 bis unter 100 %' }));
  kpis.appendChild(statCard({ k: 'Standorte mit Lücke', v: fmtInt(byAmpel.rot), info: 'deckung', d: 'Deckungsgrad unter 85 %', cls: 'petrol' }));
  kpis.appendChild(statCard({
    k: 'Größte Einzellücke', v: fmtInt(Math.max.apply(null, rows.map(r => r.luecke))), info: 'luecke',
    d: rows.slice().sort((a, b) => b.luecke - a.luecke)[0].schule.name
  }));

  drawMap(rows);

  const lg = $('#map-legend'); lg.innerHTML = '';
  [['gruen', 'gedeckt (ab 100 %)'], ['gelb', 'knapp (85 – 99 %)'], ['rot', 'Lücke (unter 85 %)']]
    .forEach(([k, t]) => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${AMPEL_FARBE[k]}"></span>${t}`)));
  lg.appendChild(el('div', 'item', '<span style="color:var(--neutral-500)">Punktfläche ∝ Platzbedarf</span>'));

  const host = $('#chart-ampel'); host.innerHTML = '';
  DATA.bezirke.forEach(b => {
    const mine = rows.filter(r => r.schule.bezirk === b.name);
    mixBar(host, 'Bezirk ' + b.name, [
      { label: 'gedeckt', n: mine.filter(r => r.ampel === 'gruen').length, color: C_OK },
      { label: 'knapp', n: mine.filter(r => r.ampel === 'gelb').length, color: C_WARN },
      { label: 'Lücke', n: mine.filter(r => r.ampel === 'rot').length, color: C_ERR }
    ], mine.length + ' Standorte');
  });
}

function drawMap(rows) {
  const W = 620, H = 560, pad = 14;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  DATA.stadtRinge.forEach(r => r.forEach(p => {
    minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]);
    minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]);
  }));
  const midLat = (minLat + maxLat) / 2, kx = Math.cos(midLat * Math.PI / 180);
  const spanX = (maxLon - minLon) * kx, spanY = maxLat - minLat;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const px = lon => offX + (lon - minLon) * kx * scale;
  const py = lat => offY + (maxLat - lat) * scale;
  const path = ringe => ringe.map(r => 'M' + r.map(p => px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1)).join('L') + 'Z').join(' ');

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'map-svg', role: 'img',
    'aria-label': 'Karte der Grundschulstandorte in Mönchengladbach, eingefärbt nach Deckungsgrad'
  });

  const labels = [];
  DATA.bezirke.forEach(b => {
    const p = svgEl('path', { d: path(b.ringe), class: 'map-bezirk' });
    p.addEventListener('mousemove', e => {
      const sub = summe(rows.filter(r => r.schule.bezirk === b.name));
      showTip(`<b>Stadtbezirk ${b.name}</b>
        <div class="row"><span>Standorte</span><span>${fmtInt(b.schulen)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sub.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(sub.deckung * 100)}</span></div>`, e.clientX, e.clientY);
    });
    p.addEventListener('mouseleave', hideTip);
    svg.appendChild(p);
    /* Bezirksbeschriftung am Flächenschwerpunkt des größten Rings — wird nach
       den Standortpunkten gezeichnet, damit sie nicht verdeckt wird. */
    const ring = b.ringe.slice().sort((a, c) => c.length - a.length)[0];
    labels.push({
      x: ring.reduce((a, p2) => a + px(p2[0]), 0) / ring.length,
      y: ring.reduce((a, p2) => a + py(p2[1]), 0) / ring.length,
      t: b.name
    });
  });
  svg.appendChild(svgEl('path', { d: path(DATA.stadtRinge), class: 'map-stadt' }));

  const maxBedarf = Math.max.apply(null, rows.map(r => r.bedarf)) || 1;
  rows.slice().sort((a, b) => b.bedarf - a.bedarf).forEach(r => {
    const s = r.schule;
    if (s.lat == null || s.lon == null) return;
    const rad = 5 + 10 * Math.sqrt(r.bedarf / maxBedarf);
    const c = svgEl('circle', {
      cx: px(s.lon).toFixed(1), cy: py(s.lat).toFixed(1), r: rad.toFixed(1),
      fill: AMPEL_FARBE[r.ampel], 'fill-opacity': .85, class: 'map-pt',
      tabindex: '0', role: 'button',
      'aria-label': `${s.name}, Deckungsgrad ${Math.round(r.deckung * 100)} Prozent, ${Math.round(r.luecke)} offene Plätze`
    });
    const tip = e => showTip(standortTip(r), e.clientX, e.clientY);
    c.addEventListener('mousemove', tip);
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); showTip(standortTip(r), b.right, b.bottom); });
    c.addEventListener('blur', hideTip);
    const oeffnen = () => { state.sheetNr = s.nr; renderSheet(); showView('sheet'); };
    c.addEventListener('click', oeffnen);
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(); } });
    svg.appendChild(c);
  });

  labels.forEach(l => {
    const t = svgEl('text', { x: l.x.toFixed(1), y: l.y.toFixed(1), 'text-anchor': 'middle',
      class: 'map-bezirk-lbl' });
    t.textContent = l.t; svg.appendChild(t);
  });

  const host = $('#map-canvas'); host.innerHTML = ''; host.appendChild(svg);
}

function standortTip(r) {
  const s = r.schule;
  return `<b>${esc(s.name)}</b>
    <div class="row"><span>Stadtbezirk</span><span>${esc(s.bezirk)}</span></div>
    <div class="row"><span>Platzbedarf ${r.stufe.id}</span><span>${fmtInt(r.bedarf)}</span></div>
    <div class="row"><span>davon Rechtsanspruch</span><span>${fmtInt(r.bedarfAnspruch)}</span></div>
    <div class="row"><span>Kapazität</span><span>${fmtInt(r.kap)}</span></div>
    <div class="row"><span>offene Plätze</span><span>${fmtInt(r.luecke)}</span></div>
    <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(r.deckung * 100)}</span></div>
    <div class="def">Klicken öffnet das Kennzahlenblatt.</div>`;
}

/* ---------------- Standorte / Tabelle ---------------- */
const COLS = [
  { k: 'name', t: 'Grundschule', num: false, v: r => r.schule.name, info: null },
  { k: 'bezirk', t: 'Bezirk', num: false, v: r => r.schule.bezirk },
  { k: 'sozialindex', t: 'Sozialindex', num: true, v: r => r.schule.sozialindex, info: 'sozialindex',
    sort: r => r.schule.sozialindex === 'ohne' ? -1 : +r.schule.sozialindex },
  { k: 'kohorte', t: 'Jahrgang', num: true, v: r => nf1.format(r.kohorte), info: 'kohorte', sort: r => r.kohorte },
  { k: 'bedarf', t: 'Bedarf', num: true, v: r => fmtInt(r.bedarf), info: 'bedarf', sort: r => r.bedarf },
  { k: 'anspruch', t: 'davon Anspruch', num: true, v: r => fmtInt(r.bedarfAnspruch), info: 'bedarfAnspruch', sort: r => r.bedarfAnspruch },
  { k: 'kap', t: 'Kapazität', num: true, v: r => fmtInt(r.kap), info: 'kapazitaet', sort: r => r.kap },
  { k: 'massnahmen', t: 'aus Maßnahmen', num: true, v: r => r.kapMass ? fmtInt(r.kapMass) : '—', info: 'wirkung', sort: r => r.kapMass },
  { k: 'luecke', t: 'Lücke', num: true, v: r => fmtInt(r.luecke), info: 'luecke', sort: r => r.luecke },
  { k: 'deckung', t: 'Deckung', num: true, v: r => fmtPct0(r.deckung * 100), info: 'deckung', sort: r => r.deckung }
];

function sortiert(rows) {
  const col = COLS.find(c => c.k === state.sortKey) || COLS[8];
  const key = col.sort || (r => String(col.v(r)));
  return rows.slice().sort((a, b) => {
    const va = key(a), vb = key(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'de') * state.sortDir;
    }
    return (va - vb) * state.sortDir;
  });
}

function renderTable() {
  const st = stufeById(state.stufe);
  const alle = alleStandorte(st);

  /* Bezirkstabelle */
  const kopf = `<thead><tr><th>Stadtbezirk</th><th class="num">Standorte</th>
    <th class="num">Grundschüler</th><th class="num">Platzbedarf</th><th class="num">Kapazität</th>
    <th class="num">Lücke</th><th class="num">Deckung</th><th class="num">Kita Ü3-Plätze</th></tr></thead>`;
  const bz = DATA.bezirke.map(b => {
    const sub = summe(alle.filter(r => r.schule.bezirk === b.name));
    return `<tr><td><span class="dot ${ampel(sub.deckung)}"></span>${esc(b.name)}</td>
      <td class="num">${fmtInt(b.schulen)}</td><td class="num">${fmtInt(b.schueler)}</td>
      <td class="num">${fmtInt(sub.bedarf)}</td><td class="num">${fmtInt(sub.kap)}</td>
      <td class="num">${fmtInt(sub.luecke)}</td><td class="num">${fmtPct0(sub.deckung * 100)}</td>
      <td class="num">${fmtInt(b.kitaUe3)}<span class="sub">${fmtInt(b.kitas)} Einrichtungen</span></td></tr>`;
  }).join('');
  const ges = summe(alle);
  const gesZeile = `<tr style="font-weight:600; background:var(--neutral-100)"><td>Gesamtstadt</td>
    <td class="num">${fmtInt(DATA.schulen.length)}</td>
    <td class="num">${fmtInt(DATA.bezirke.reduce((a, b) => a + b.schueler, 0))}</td>
    <td class="num">${fmtInt(ges.bedarf)}</td><td class="num">${fmtInt(ges.kap)}</td>
    <td class="num">${fmtInt(ges.luecke)}</td><td class="num">${fmtPct0(ges.deckung * 100)}</td>
    <td class="num">${fmtInt(DATA.bezirke.reduce((a, b) => a + b.kitaUe3, 0))}</td></tr>`;
  $('#tbl-bezirke').innerHTML = kopf + '<tbody>' + bz + gesZeile + '</tbody>';

  /* Bezirksfilter */
  const sel = $('#filter-bezirk');
  if (!sel.options.length) {
    sel.innerHTML = '<option value="alle">Alle Stadtbezirke</option>' +
      DATA.bezirke.map(b => `<option value="${esc(b.name)}">Bezirk ${esc(b.name)}</option>`).join('');
    sel.addEventListener('change', () => { state.filterBezirk = sel.value; renderTable(); });
  }
  sel.value = state.filterBezirk;

  const gefiltert = state.filterBezirk === 'alle'
    ? alle : alle.filter(r => r.schule.bezirk === state.filterBezirk);
  const rows = sortiert(gefiltert);

  const th = COLS.map(c => {
    const on = c.k === state.sortKey;
    return `<th class="${c.num ? 'num ' : ''}sortable${on ? ' sorted' : ''}" data-sort="${c.k}"
      tabindex="0" role="button" aria-label="Nach ${esc(c.t)} sortieren">${esc(c.t)}${infoIcon(c.info)}${on ? ' <span class="arrow">' + (state.sortDir < 0 ? '▼' : '▲') + '</span>' : ''}</th>`;
  }).join('');
  const tb = rows.map(r => `<tr class="click" data-nr="${r.schule.nr}" tabindex="0">` + COLS.map(c => {
    if (c.k === 'name') {
      return `<td><span class="dot ${r.ampel}"></span>${esc(r.schule.name)}
        <span class="sub">${esc(r.schule.strasse)}${r.schule.rechtsform === 'privat' ? ' · privater Träger' : ''}${r.schule.imAufbau ? ' · im Aufbau' : ''}</span></td>`;
    }
    return `<td class="${c.num ? 'num' : ''}">${esc(c.v(r))}</td>`;
  }).join('') + '</tr>').join('');
  $('#tbl-schulen').innerHTML = `<thead><tr>${th}</tr></thead><tbody>${tb}</tbody>`;

  $('#table-count').textContent =
    `${rows.length} von ${DATA.schulen.length} Grundschulen · Ausbaustufe ${st.id} (${st.klassen}) · `
    + `Szenario „${SZENARIEN.find(s => s.id === state.szenario).t}“`;
}

$('#tbl-schulen').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]');
  if (th) {
    const k = th.dataset.sort;
    if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = k === 'name' || k === 'bezirk' ? 1 : -1; }
    return renderTable();
  }
  const tr = e.target.closest('tr[data-nr]');
  if (tr) { state.sheetNr = tr.dataset.nr; renderSheet(); showView('sheet'); }
});
$('#tbl-schulen').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const th = e.target.closest('th[data-sort]');
  if (th) { e.preventDefault(); th.click(); return; }
  const tr = e.target.closest('tr[data-nr]');
  if (tr) { e.preventDefault(); state.sheetNr = tr.dataset.nr; renderSheet(); showView('sheet'); }
});

$('#btn-csv').addEventListener('click', () => {
  const st = stufeById(state.stufe);
  const alle = alleStandorte(st);
  const rows = sortiert(state.filterBezirk === 'alle' ? alle : alle.filter(r => r.schule.bezirk === state.filterBezirk));
  const kopf = ['Schulnummer', 'Grundschule', 'Strasse', 'PLZ', 'Stadtbezirk', 'Traegerform',
    'Sozialindexstufe', 'Ausbaustufe', 'Anspruchsjahrgaenge', 'Jahrgangsstaerke', 'Platzbedarf',
    'davon Rechtsanspruch', 'Kapazitaet Bestand', 'Kapazitaet aus Massnahmen', 'Kapazitaet gesamt',
    'Offene Plaetze', 'Deckungsgrad in Prozent'];
  const zellen = rows.map(r => [r.schule.nr, r.schule.name, r.schule.strasse, r.schule.plz,
    r.schule.bezirk, r.schule.rechtsform, r.schule.sozialindex, r.stufe.id, r.anspruchsJg,
    Math.round(r.kohorte * 10) / 10, Math.round(r.bedarf), Math.round(r.bedarfAnspruch),
    r.kapBasis, r.kapMass, r.kap, Math.round(r.luecke), Math.round(r.deckung * 1000) / 10]);
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '﻿' + [
    `# Kanduit Ganztags-Platzmonitor Moenchengladbach - Stand ${DATA.meta.stand}`,
    `# Szenario: ${SZENARIEN.find(s => s.id === state.szenario).t}; Inanspruchnahmequote ${Math.round(quoteEffektiv() * 10) / 10} %; Bestandsquote ${state.bestandsquote} %; Jahrgangstrend ${Math.round(state.trend * 10) / 10} % p.a.`,
    `# Raumannahmen (Demo): ${state.raum.flaecheProRaum} m2 je Klassenraum-Aequivalent, ${state.raum.anteilGanztag} % ganztagsnutzbar, ${state.raum.flaecheProKind} m2 je Kind, Belegungsfaktor ${state.raum.belegungsfaktor}`,
    '# Quellen: MSB NRW Open Data, Open Data NRW (Kitas), OpenStreetMap (Bezirksgrenzen, ODbL). Keine personenbezogenen Daten.',
    kopf.map(q).join(';')
  ].concat(zellen.map(z => z.map(q).join(';'))).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a'); a.href = url;
  a.download = `ganztags-platzmonitor-mg_${st.id.replace('/', '-')}_${state.szenario}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

/* ---------------- Kapazitätsmodell ---------------- */
const RAUM_SLIDER = [
  { k: 'flaecheProRaum', t: 'Fläche je Klassenraum-Äquivalent', min: 50, max: 130, step: 5, dec: 0, unit: ' m²',
    hint: 'Klassenraum zuzüglich anteiliger Neben-, Mehrzweck- und Mensaflächen. Demo-Annahme.' },
  { k: 'anteilGanztag', t: 'Multifunktional für den Ganztag nutzbar', min: 25, max: 90, step: 5, dec: 0, unit: ' %',
    hint: 'Anteil dieser Fläche, der im offenen bzw. halboffenen Modell für den Ganztag genutzt werden kann. Demo-Annahme.' },
  { k: 'flaecheProKind', t: 'Flächenrichtwert je Kind', min: 2.5, max: 6, step: 0.25, dec: 2, unit: ' m²',
    hint: 'Fläche je gleichzeitig betreutem Kind. Ein amtlicher Richtwert für den offenen Ganztag ist nicht offen veröffentlicht. Demo-Annahme.' },
  { k: 'belegungsfaktor', t: 'Belegungsfaktor versetzte Nutzung', min: 1, max: 1.8, step: 0.05, dec: 2, unit: '',
    hint: 'Mehrfachnutzung derselben Fläche durch gestaffelte Betreuungszeiten. 1,00 bedeutet keine versetzte Nutzung. Demo-Annahme.' },
  { k: 'raumStreuung', t: 'Streuung des Raumbestands', min: 0, max: 40, step: 5, dec: 0, unit: ' %', info: 'streuung',
    hint: 'Der Raumbestand einer Schule folgt real nicht ihrer Schülerzahl — Baujahr, Erweiterungen und Fachraumanteil unterscheiden sich. Diese Streuung liegt nicht offen vor und wird hier deterministisch aus der Schulnummer erzeugt. Auf 0 % gestellt rechnet das Modell strikt proportional; dann haben alle Standorte fast denselben Deckungsgrad — ein Artefakt des Modells, keine Aussage über die Stadt. Demo-Annahme.' }
];
const NACHFRAGE_SLIDER = [
  { k: 'quote', t: 'Inanspruchnahmequote der Anspruchsjahrgänge', min: 40, max: 100, step: 0.5, dec: 1, unit: ' %',
    hint: 'Aus der öffentlich genannten Bedarfsgröße 2026/27 zurückgerechnet. Im Szenario „Hohe Inanspruchnahme“ kommen 10 bzw. 20 Prozentpunkte hinzu.' },
  { k: 'bestandsquote', t: 'Bestandsquote der übrigen Jahrgänge', min: 20, max: 100, step: 1, dec: 0, unit: ' %',
    hint: 'Teilnahme am Ganztag in den Jahrgängen ohne Rechtsanspruch. Demo-Annahme.' },
  { k: 'trend', t: 'Jahrgangstrend', min: -2, max: 5, step: 0.1, dec: 1, unit: ' % p. a.',
    hint: 'Jährliche Veränderung der Jahrgangsstärke. Voreinstellung: beobachtete Entwicklung der letzten drei Jahre (MSB NRW).' }
];

function sliderHtml(defs, quelle) {
  return defs.map(d => {
    const val = quelle === 'raum' ? state.raum[d.k] : state[d.k];
    const anz = fmtDec(val, d.dec);
    return `<div class="slider-row">
      <div class="head"><span class="nm">${d.t}${infoIcon(d.info)}</span><span class="val">${anz}${d.unit}</span></div>
      <input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${val}"
        data-slider="${d.k}" data-scope="${quelle}" aria-label="${esc(d.t)}">
      <span class="hint">${d.hint}</span>
    </div>`;
  }).join('') + `<div style="margin-top:12px"><button class="kbtn ghost" data-reset="${quelle}">Voreinstellungen wiederherstellen</button></div>`;
}

/* Regler nur einmal aufbauen — beim Ziehen wird ausschließlich die Anzeige
   aktualisiert, sonst reißt das Ziehen ab. */
function mountSliders(force) {
  [['#sliders-raum', RAUM_SLIDER, 'raum'], ['#sliders-nachfrage', NACHFRAGE_SLIDER, 'state']]
    .forEach(([sel, defs, scope]) => {
      const host = $(sel);
      if (force || !host.children.length) { host.innerHTML = sliderHtml(defs, scope); return; }
      defs.forEach(d => {
        const val = scope === 'raum' ? state.raum[d.k] : state[d.k];
        const inp = host.querySelector(`input[data-slider="${d.k}"]`);
        if (inp && parseFloat(inp.value) !== val) inp.value = val;
        const out = inp && inp.parentElement.querySelector('.val');
        if (out) out.textContent = fmtDec(val, d.dec) + d.unit;
      });
    });
}

function renderCapacity() {
  mountSliders(false);

  const r = state.raum;
  const proRaum = r.flaecheProRaum * (r.anteilGanztag / 100) / r.flaecheProKind * r.belegungsfaktor;
  const raeumeGes = DATA.schulen.reduce((a, s) => a + raeumeEffektiv(s), 0);
  $('#formel-raum').textContent =
    `Klassenraum-Äquivalente = Schülerzahl ÷ ${nf1.format(K.klassengroesse)}, aufgerundet, × (1 ± ${nf1.format(r.raumStreuung)} % Streuung)\n`
    + `Plätze je Standort = Äquivalente × ${nf1.format(r.flaecheProRaum)} m² × ${nf1.format(r.anteilGanztag)} % ÷ ${nf2.format(r.flaecheProKind)} m² × ${nf2.format(r.belegungsfaktor)}\n`
    + `                   = Äquivalente × ${nf1.format(proRaum)} Plätze\n`
    + `Stadtweit: ${fmtInt(raeumeGes)} Äquivalente → ${fmtInt(DATA.schulen.reduce((a, s) => a + kapazitaet(s), 0))} Plätze`;

  const st = stufeById(state.stufe);
  const kohorteGes = DATA.schulen.reduce((a, s) => a + s.kohorte, 0) * Math.pow(1 + state.trend / 100, st.jahr - BASISJAHR);
  $('#formel-nachfrage').textContent =
    `Platzbedarf = Jahrgangsstärke × Anspruchsjahrgänge × ${nf1.format(quoteEffektiv())} %\n`
    + `            + Jahrgangsstärke × übrige Jahrgänge × ${nf1.format(state.bestandsquote)} %\n`
    + `Jahrgangsstärke stadtweit ${st.id}: ${fmtInt(kohorteGes)} (Basis ${fmtInt(DATA.schulen.reduce((a, s) => a + s.kohorte, 0))} × ${nf1.format(state.trend)} % p. a.)`;

  const rows = alleStandorte(st);
  const s = summe(rows);
  const frei = freiePlaetzeKlasse1(DATA.stufen[0]);
  const kpis = $('#capacity-kpis'); kpis.innerHTML = '';
  kpis.appendChild(statCard({ k: 'Kapazität stadtweit', v: fmtInt(DATA.schulen.reduce((a, x) => a + kapazitaet(x), 0)), info: 'raummodell', d: 'aus dem Raummodell, ohne Maßnahmen', cls: 'ink' }));
  kpis.appendChild(statCard({ k: 'Plätze je Klassenraum-Äquivalent', v: nf1.format(proRaum), info: 'raeume', d: `${fmtInt(raeumeGes)} Äquivalente stadtweit` }));
  kpis.appendChild(statCard({ k: 'Freie Plätze Klasse 1 (2026/27)', v: fmtInt(frei), info: 'anker', d: `öffentlich genannt: rund ${fmtInt(DATA.anker.freiePlaetze)}`, cls: 'petrol' }));
  kpis.appendChild(statCard({ k: 'Deckungsgrad ' + st.id, v: fmtPct0(s.deckung * 100), info: 'deckung', d: `${fmtInt(s.luecke)} offene Plätze` }));

  columnChart($('#chart-kap-bezirk'), DATA.bezirke.map(b => {
    const sub = summe(rows.filter(x => x.schule.bezirk === b.name));
    return {
      id: b.name, label: b.name,
      kap: Math.min(sub.kap, sub.bedarf), fehlt: sub.luecke,
      tip: `<b>Stadtbezirk ${b.name}</b>
        <div class="row"><span>Kapazität</span><span>${fmtInt(sub.kap)}</span></div>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(sub.bedarf)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sub.luecke)}</span></div>`
    };
  }), {
    keys: [{ key: 'kap', color: C_KAP }, { key: 'fehlt', color: C_LUECKE }],
    legend: [{ label: 'vorhandene Kapazität', color: C_KAP }, { label: 'zusätzlicher Bedarf', color: C_LUECKE }],
    height: 240, showTotals: true
  });

  barChart($('#chart-sens'), [3, 3.5, 4, 4.5, 5].map(m2 => {
    const raum = Object.assign({}, state.raum, { flaecheProKind: m2 });
    const kap = DATA.schulen.reduce((a, x) => a + kapazitaet(x, raum), 0);
    return {
      label: nf1.format(m2) + ' m² je Kind', value: kap, valLabel: fmtInt(kap),
      color: Math.abs(m2 - state.raum.flaecheProKind) < 0.01 ? C_KAP : 'var(--petrol-300)',
      tip: `<b>${nf1.format(m2)} m² je Kind</b>
        <div class="row"><span>Kapazität stadtweit</span><span>${fmtInt(kap)}</span></div>
        <div class="row"><span>gegenüber Voreinstellung</span><span>${fmtInt(kap - DATA.schulen.reduce((a, x) => a + kapazitaet(x, DATA.raumDefaults), 0))}</span></div>`
    };
  }), { padL: 120 });
}

document.addEventListener('input', e => {
  const sl = e.target.closest('input[data-slider]'); if (!sl) return;
  const v = parseFloat(sl.value);
  if (sl.dataset.scope === 'raum') state.raum[sl.dataset.slider] = v;
  else state[sl.dataset.slider] = v;
  renderAll();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-reset]'); if (!b) return;
  if (b.dataset.reset === 'raum') state.raum = Object.assign({}, DATA.raumDefaults);
  else { state.quote = K.quoteBasis; state.bestandsquote = K.bestandsquote; state.trend = Math.round(K.trendDefault * 1000) / 10; }
  mountSliders(true);
  renderAll();
});

/* ---------------- Maßnahmenwirkung ---------------- */
function renderMeasures() {
  const st = stufeById(state.stufe);
  const gesamt = DATA.massnahmen.reduce((a, m) => a + m.plaetze, 0);
  const bisStufe = DATA.massnahmen.filter(m => m.wirksamAb <= st.jahr);
  const mit = summe(alleStandorte(st, { mitMassnahmen: true }));
  const ohne = summe(alleStandorte(st, { mitMassnahmen: false }));

  const kpis = $('#measures-kpis'); kpis.innerHTML = '';
  kpis.appendChild(statCard({ k: 'Maßnahmen gesamt', v: fmtInt(DATA.massnahmen.length), info: 'massnahmen_gesamt', d: `${fmtInt(gesamt)} Plätze an ${new Set(DATA.massnahmen.map(m => m.schulNr)).size} Standorten`, cls: 'ink' }));
  kpis.appendChild(statCard({ k: 'Wirksam bis ' + st.id, v: fmtInt(bisStufe.reduce((a, m) => a + m.plaetze, 0)), info: 'plaetze_jahr', d: `${bisStufe.length} von ${DATA.massnahmen.length} Maßnahmen` }));
  kpis.appendChild(statCard({ k: 'Lücke mit Maßnahmen', v: fmtInt(mit.luecke), info: 'luecke', cls: 'petrol', d: `ohne Maßnahmen: ${fmtInt(ohne.luecke)} Plätze` }));
  kpis.appendChild(statCard({
    k: 'Wirkung auf die Lücke', v: fmtInt(ohne.luecke - mit.luecke), info: 'wirkung',
    d: ohne.luecke > 0 ? `schließt ${fmtPct0((ohne.luecke - mit.luecke) / ohne.luecke * 100)} der offenen Plätze` : 'keine Lücke in dieser Stufe'
  }));

  const hinweis = $('#measures-hint');
  if (!bisStufe.length) {
    hinweis.className = 'banner info';
    hinweis.style.display = '';
    hinweis.innerHTML = `<b>In der Ausbaustufe ${st.id} wirkt noch keine der angenommenen Maßnahmen.</b>
      Die früheste ist für ${Math.min.apply(null, DATA.massnahmen.map(m => m.wirksamAb))} angesetzt.
      Die Lücke dieser Stufe von ${fmtInt(mit.luecke)} Plätzen muss also aus dem Bestand gedeckt werden.
      Wählen Sie oben eine spätere Stufe, um die kumulierte Wirkung zu sehen.`;
  } else {
    hinweis.style.display = 'none';
  }

  columnChart($('#chart-wirkung'), DATA.stufen.map(stufe => {
    const m = summe(alleStandorte(stufe, { mitMassnahmen: true }));
    const o = summe(alleStandorte(stufe, { mitMassnahmen: false }));
    return {
      id: stufe.id, label: stufe.id,
      rest: m.luecke, geschlossen: Math.max(0, o.luecke - m.luecke),
      tip: `<b>${stufe.id} · ${stufe.klassen}</b>
        <div class="row"><span>Lücke ohne Maßnahmen</span><span>${fmtInt(o.luecke)}</span></div>
        <div class="row"><span>durch Maßnahmen geschlossen</span><span>${fmtInt(Math.max(0, o.luecke - m.luecke))}</span></div>
        <div class="row"><span>verbleibende Lücke</span><span>${fmtInt(m.luecke)}</span></div>`
    };
  }), {
    keys: [{ key: 'rest', color: C_LUECKE }, { key: 'geschlossen', color: C_MASS }],
    legend: [{ label: 'verbleibende Lücke', color: C_LUECKE }, { label: 'durch Maßnahmen geschlossen', color: C_MASS }],
    height: 260, showTotals: true
  });

  const jahre = {};
  DATA.massnahmen.forEach(m => { jahre[m.wirksamAb] = (jahre[m.wirksamAb] || 0) + m.plaetze; });
  barChart($('#chart-jahre'), Object.keys(jahre).sort().map(j => {
    const anz = DATA.massnahmen.filter(m => m.wirksamAb === +j).length;
    return {
      label: 'ab ' + j, value: jahre[j], valLabel: fmtInt(jahre[j]),
      color: +j <= st.jahr ? C_MASS : 'var(--neutral-300)',
      tip: `<b>Wirksam ab ${j}</b>
        <div class="row"><span>Maßnahmen</span><span>${fmtInt(anz)}</span></div>
        <div class="row"><span>Plätze</span><span>${fmtInt(jahre[j])}</span></div>
        <div class="row"><span>in Stufe ${st.id}</span><span>${+j <= st.jahr ? 'wirksam' : 'noch nicht wirksam'}</span></div>`
    };
  }), { padL: 90 });

  const rows = DATA.massnahmen.map(m => {
    const s = schuleByNr(m.schulNr);
    const wirksam = m.wirksamAb <= st.jahr;
    return `<tr><td class="mono">${m.id}</td>
      <td>${esc(s.name)}<span class="sub">${esc(s.strasse)} · Bezirk ${esc(s.bezirk)}</span></td>
      <td>${esc(m.typ)}</td>
      <td class="num">${fmtInt(m.plaetze)}</td>
      <td class="num">${m.wirksamAb}</td>
      <td><span class="pill ${wirksam ? 'ok' : 'warn'}">${wirksam ? 'in dieser Stufe wirksam' : 'später wirksam'}</span></td>
      <td><span class="assumption">Demo-Annahme</span></td></tr>`;
  }).join('');
  $('#tbl-massnahmen').innerHTML = `<thead><tr><th>Nr.</th><th>Standort</th><th>Maßnahmentyp</th>
    <th class="num">Plätze${infoIcon('massnahmen_gesamt')}</th><th class="num">wirksam ab</th>
    <th>Status in ${esc(st.id)}</th><th>Herkunft</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ---------------- Kennzahlenblatt ---------------- */
function renderSheet() {
  const sel = $('#sheet-select');
  if (!sel.options.length) {
    sel.innerHTML = DATA.schulen.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(s => `<option value="${s.nr}">${esc(s.name)}</option>`).join('');
    sel.addEventListener('change', () => { state.sheetNr = sel.value; renderSheet(); });
  }
  sel.value = state.sheetNr;

  const s = schuleByNr(state.sheetNr);
  const je = DATA.stufen.map(st => berechne(s, st));
  const akt = je.find(r => r.stufe.id === state.stufe) || je[0];
  const mass = DATA.massnahmen.filter(m => m.schulNr === s.nr);
  const bezirk = DATA.bezirke.find(b => b.name === s.bezirk);
  const r = state.raum;

  const stufenZeilen = je.map(x => `<tr>
    <td>${x.stufe.id}<span class="sub">${x.stufe.klassen}</span></td>
    <td class="num">${nf1.format(x.kohorte)}</td>
    <td class="num">${fmtInt(x.bedarf)}</td>
    <td class="num">${fmtInt(x.bedarfAnspruch)}</td>
    <td class="num">${fmtInt(x.kap)}</td>
    <td class="num">${fmtInt(x.luecke)}</td>
    <td class="num"><span class="dot ${x.ampel}"></span>${fmtPct0(x.deckung * 100)}</td></tr>`).join('');

  $('#sheet-body').innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-title">${esc(s.name)}</div>
      <div class="card-sub">${esc(s.strasse)} · ${esc(s.plz)} Mönchengladbach · Stadtbezirk ${esc(s.bezirk)}</div>
      <div class="grid g2" style="margin-top:var(--sp-4)">
        <dl class="sheet-kv">
          <dt>Schulnummer</dt><dd>${esc(s.nr)}</dd>
          <dt>Trägerform</dt><dd>${s.rechtsform === 'privat' ? 'privater Träger' : 'öffentlich'}</dd>
          <dt>Sozialindexstufe${infoIcon('sozialindex')}</dt><dd>${esc(s.sozialindex)}</dd>
          <dt>Schülerinnen und Schüler</dt><dd>${fmtInt(s.schueler)}</dd>
          <dt>Schulbetrieb seit</dt><dd>${s.gruendung}${s.imAufbau ? ' · im Aufbau' : ''}</dd>
        </dl>
        <dl class="sheet-kv">
          <dt>Klassenraum-Äquivalente${infoIcon('raeume')}</dt><dd>${fmtInt(raeumeEffektiv(s))}</dd>
          <dt>Jahrgangsstärke ${DATA.meta.schuljahrBasis}${infoIcon('kohorte')}</dt><dd>${nf1.format(s.kohorte)}</dd>
          <dt>Kapazität Bestand${infoIcon('kapazitaet')}</dt><dd>${fmtInt(akt.kapBasis)}</dd>
          <dt>Plätze aus Maßnahmen${infoIcon('wirkung')}</dt><dd>${fmtInt(akt.kapMass)}</dd>
          <dt>Koordinate (WGS84)</dt><dd>${s.lat != null ? s.lat.toFixed(4) + '° N, ' + s.lon.toFixed(4) + '° O' : '—'}</dd>
        </dl>
      </div>
      <p class="note">Quelle der Bestandsdaten:
        <a href="${SRC_LABEL.msb.u}" target="_blank" rel="noopener">${esc(SRC_LABEL.msb.t)}</a>,
        Schuljahr ${DATA.meta.schuljahrBasis}, Abruf ${DATA.meta.stand}. Bezirkszuordnung:
        <a href="${SRC_LABEL.osm.u}" target="_blank" rel="noopener">${esc(SRC_LABEL.osm.t)}</a>.
        Klassenraum-Äquivalente, Kapazität und Maßnahmen sind <span class="assumption">Demo-Annahme</span> —
        im Projekt durch Daten des Fachbereichs zu ersetzen.</p>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-title">Bedarf und Kapazität je Ausbaustufe${infoIcon('stufenbilanz')}</div>
      <div class="card-sub">Szenario „${esc(SZENARIEN.find(x => x.id === state.szenario).t)}“ · Quote ${fmtPct(quoteEffektiv())} · Trend ${fmtPct(state.trend)} p. a.</div>
      <div class="table-wrap" style="margin-top:var(--sp-3); border:none; box-shadow:none">
        <table><thead><tr><th>Ausbaustufe</th><th class="num">Jahrgang</th><th class="num">Platzbedarf</th>
          <th class="num">davon Anspruch</th><th class="num">Kapazität</th><th class="num">Lücke</th>
          <th class="num">Deckung</th></tr></thead><tbody>${stufenZeilen}</tbody></table>
      </div>
      <p class="note">Rechtsgrundlage des Anspruchs: § 24 Abs. 4 SGB VIII (GaFöG), stufenweise seit
        01.08.2026. Schulentwicklungsplanung: § 80 SchulG NRW.</p>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-title">Rechenweg für die Stufe ${esc(akt.stufe.id)}</div>
      <div class="card-sub">jeder Schritt mit Herkunft</div>
      <div class="calc">1) Jahrgangsstärke
   ${fmtInt(s.schueler)} Schüler ÷ ${jahrgaengeVorhanden(s, BASISJAHR)} Jahrgänge = ${nf1.format(s.kohorte)}   [MSB NRW, ${DATA.meta.schuljahrBasis}]
   Fortschreibung: ${nf1.format(s.kohorte)} × (1 + ${nf1.format(state.trend)} %)^${akt.stufe.jahr - BASISJAHR} = ${nf1.format(akt.kohorte)}

2) Platzbedarf ${akt.stufe.id}
   Anspruch:  ${nf1.format(akt.kohorte)} × ${akt.anspruchsJg} Jahrgang/-gänge × ${nf1.format(quoteEffektiv())} % = ${fmtInt(akt.bedarfAnspruch)}
   Bestand:   ${nf1.format(akt.kohorte)} × ${akt.bestandsJg} Jahrgang/-gänge × ${nf1.format(state.bestandsquote)} % = ${fmtInt(akt.bedarfBestand)}
   Summe:     ${fmtInt(akt.bedarf)} Plätze

3) Kapazität   [Demo-Annahme]
   Basis-Äquivalente:  ${fmtInt(s.schueler)} ÷ ${nf1.format(K.klassengroesse)}, aufgerundet = ${fmtInt(s.raeume)}
   Streuung ${nf1.format(r.raumStreuung)} %:     × (1 ${s.raumIndex < 0 ? '−' : '+'} ${nf1.format(Math.abs(s.raumIndex) * r.raumStreuung)} %) = ${fmtInt(raeumeEffektiv(s))} Äquivalente
   Fläche:    ${fmtInt(raeumeEffektiv(s))} × ${nf1.format(r.flaecheProRaum)} m² × ${nf1.format(r.anteilGanztag)} % = ${fmtInt(raeumeEffektiv(s) * r.flaecheProRaum * r.anteilGanztag / 100)} m²
   Plätze:    ${fmtInt(raeumeEffektiv(s) * r.flaecheProRaum * r.anteilGanztag / 100)} m² ÷ ${nf2.format(r.flaecheProKind)} m² × ${nf2.format(r.belegungsfaktor)} = ${fmtInt(akt.kapBasis)}
   Maßnahmen: + ${fmtInt(akt.kapMass)}  →  ${fmtInt(akt.kap)} Plätze

4) Ergebnis
   Lücke:        ${fmtInt(akt.bedarf)} − ${fmtInt(akt.kap)} = ${fmtInt(akt.luecke)} Plätze
   Deckungsgrad: ${fmtInt(akt.kap)} ÷ ${fmtInt(akt.bedarf)} = ${fmtPct0(akt.deckung * 100)}  (${AMPEL_TEXT[akt.ampel]})</div>
    </div>

    <div class="card">
      <div class="card-title">Maßnahmen an diesem Standort${infoIcon('massnahmen_gesamt')}</div>
      <div class="card-sub">Demo-Annahme · ${mass.length} Maßnahme${mass.length === 1 ? '' : 'n'}</div>
      ${mass.length ? `<div class="table-wrap" style="margin-top:var(--sp-3); border:none; box-shadow:none">
        <table><thead><tr><th>Nr.</th><th>Maßnahmentyp</th><th class="num">Plätze</th><th class="num">wirksam ab</th></tr></thead>
        <tbody>${mass.map(m => `<tr><td class="mono">${m.id}</td><td>${esc(m.typ)}</td>
          <td class="num">${fmtInt(m.plaetze)}</td><td class="num">${m.wirksamAb}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="note" style="margin-top:12px">Für diesen Standort ist in der Demo-Maßnahmenliste keine Maßnahme hinterlegt.</p>'}
      <p class="note">Kontext Stadtbezirk ${esc(s.bezirk)}: ${fmtInt(bezirk ? bezirk.schulen : 0)} Grundschulen,
        ${fmtInt(bezirk ? bezirk.kitaUe3 : 0)} Ü3-Plätze in ${fmtInt(bezirk ? bezirk.kitas : 0)} Kindertageseinrichtungen
        (<a href="${SRC_LABEL.kitas.u}" target="_blank" rel="noopener">Open Data NRW</a>, Abruf ${DATA.meta.stand}).</p>
    </div>`;
}

/* ====================================================================
   INIT
   ==================================================================== */
function renderAll() {
  buildMetricInfo();
  mountControls();
  renderOverview();
  renderMap();
  renderTable();
  renderCapacity();
  renderMeasures();
  renderSheet();
  $$('.src-note').forEach(n => {
    const s = SRC_LABEL[n.dataset.src]; if (!s) return;
    n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a> · Abruf ${DATA.meta.stand}`;
  });
}

$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
renderLegalBanner();
renderAll();
})();
