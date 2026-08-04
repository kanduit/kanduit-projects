/* =========================================================================
   Kanduit — Ganztags-Bedarfsmonitor Krefeld
   Sämtliche Verarbeitung läuft clientseitig im Browser. Keine Server-
   komponente, keine Übertragung von Eingaben, keine personenbezogenen Daten.
   ========================================================================= */
const DATA = window.KANDUIT_GANZTAGS;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------------- Formatierung (de-DE) ---------------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtPct = v => nf1.format(v) + ' %';
const fmtPct0 = v => nf.format(Math.round(v)) + ' %';
const fmtSigned = v => (v >= 0 ? '+' : '−') + fmtInt(Math.abs(v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview: 'view-overview', karte: 'view-karte', bezirke: 'view-bezirke', szenarien: 'view-szenarien', rechner: 'view-rechner', blatt: 'view-blatt' };
function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#' + views[name]).classList.add('active');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
$('#tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) showView(t.dataset.view); });

/* ====================================================================
   TOOLTIP
   ==================================================================== */
const tt = $('#tooltip');
function showTip(html, x, y) {
  tt.innerHTML = html; tt.classList.add('show');
  const r = tt.getBoundingClientRect();
  let nx = x + 16, ny = y + 16;
  if (nx + r.width > window.innerWidth - 8) nx = Math.max(8, x - r.width - 16);
  if (ny + r.height > window.innerHeight - 8) ny = Math.max(8, y - r.height - 16);
  tt.style.left = nx + 'px'; tt.style.top = ny + 'px';
}
const hideTip = () => tt.classList.remove('show');

/* ====================================================================
   GLOSSAR — jede Kennzahl mit Berechnung UND Datenlücke.
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
   QUELLEN — Quellen-Link unter jeder Karte.
   ==================================================================== */
const SRC_LABEL = DATA.meta.quellen;
$$('.src-note').forEach(n => {
  const s = SRC_LABEL[n.dataset.src]; if (!s) return;
  n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a> · Abruf ${DATA.meta.stand}`;
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

/* vertical column chart, optionally stacked, with optional break markers. */
function columnChart(container, cols, opts) {
  opts = opts || {};
  const W = 620, H = opts.height || 240, padL = 44, padR = 10, padT = 20, padB = 34;
  const keys = opts.keys;
  const totals = cols.map(c => keys ? keys.reduce((a, k) => a + (c[k.key] || 0), 0) : c.n);
  const max = Math.max(...totals, opts.min || 1);
  const iw = (W - padL - padR) / cols.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', style: `height:${H}px` });
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = max * s / steps, y = H - padB - (H - padT - padB) * (s / steps);
    svg.appendChild(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'gridline' }));
    const t = svgEl('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', class: 'axis-txt' });
    t.textContent = opts.pct ? fmtInt(v) + '%' : fmtInt(v); svg.appendChild(t);
  }
  cols.forEach((c, i) => {
    const x = padL + i * iw;
    let y0 = H - padB;
    const stacks = keys || [{ key: 'n', color: c.color || opts.color || 'var(--dv-petrol)' }];
    stacks.forEach(k => {
      const v = c[k.key] || 0;
      const h = (H - padT - padB) * (v / max);
      if (v > 0) {
        const rect = svgEl('rect', { x: x + iw * 0.14, y: y0 - h, width: iw * 0.72, height: h, rx: 2, fill: c.color && !keys ? c.color : k.color, class: 'bar' });
        if (c.tip) { rect.addEventListener('mousemove', e => showTip(c.tip, e.clientX, e.clientY)); rect.addEventListener('mouseleave', hideTip); }
        svg.appendChild(rect);
      }
      y0 -= h;
    });
    if (opts.showTotals) {
      const t = svgEl('text', { x: x + iw / 2, y: y0 - 4, 'text-anchor': 'middle', class: 'bar-label' });
      t.textContent = c.totalLabel != null ? c.totalLabel : fmtInt(totals[i]); svg.appendChild(t);
    }
    const everyN = opts.labelEvery || 1;
    if (i % everyN === 0) {
      const t = svgEl('text', { x: x + iw / 2, y: H - padB + 14, 'text-anchor': 'middle', class: 'axis-txt' });
      t.textContent = c.label; svg.appendChild(t);
    }
  });
  /* Markierungslinien (z. B. „vollständig gedeckt“). Die Beschriftung sitzt
     links, weil die Säulenwerte rechts oben stehen und sich sonst überlagern. */
  (opts.marks || []).forEach(m => {
    const y = H - padB - (H - padT - padB) * (m.at / max);
    svg.appendChild(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'break-line' }));
    const t = svgEl('text', { x: padL + 3, y: y - 5, 'text-anchor': 'start', class: 'break-label' });
    t.textContent = m.label; svg.appendChild(t);
  });
  container.innerHTML = ''; container.appendChild(svg);
  if (opts.legend) {
    const lg = el('div', 'legend');
    opts.legend.forEach(l => lg.appendChild(el('div', 'item', `<span class="sw" style="background:${l.color}"></span>${l.label}`)));
    container.appendChild(lg);
  }
}

/* KPI stat tile */
function statCard(s) {
  const c = el('div', 'stat' + (s.cls ? ' ' + s.cls : ''));
  c.innerHTML = `<div class="k">${s.k}${infoIcon(s.info)}</div><div class="v">${s.v}</div><div class="d">${s.d}</div>`;
  return c;
}

/* ====================================================================
   MODELL — die gesamte Szenariorechnung läuft hier im Browser.
   ==================================================================== */
const K = DATA.konstanten;
const C_OK = 'var(--ok)', C_WARN = 'var(--warn)', C_ERR = 'var(--error)';
const C_KAP = 'var(--dv-petrol)', C_LUECKE = 'var(--dv-coral)';

/* Letztes Ist-Jahr und letztes Planjahr der veröffentlichten Ausbauplanung.
   Bis zum Ende des Planungshorizonts gelten die Werte der Stadt; erst danach
   greift ein abweichendes Ausbautempo. */
const IST = DATA.ausbauplanung.filter(p => p.ist).slice(-1)[0];
const IST_JAHR = parseInt(IST.schuljahr.slice(0, 4), 10);
const PLAN_ENDE = DATA.ausbauplanung[DATA.ausbauplanung.length - 1];
const PLAN_ENDE_JAHR = parseInt(PLAN_ENDE.schuljahr.slice(0, 4), 10);
const PLAN_JE_JAHR = {};
DATA.ausbauplanung.forEach(p => { PLAN_JE_JAHR[parseInt(p.schuljahr.slice(0, 4), 10)] = p; });

const TEMPI = [
  { g: K.ausbauGruppen, t: 'Planung der Stadt', sub: K.ausbauGruppen + ' Gruppen/Jahr' },
  { g: 22, t: 'beschleunigt', sub: '22 Gruppen/Jahr' },
  { g: 30, t: 'stark beschleunigt', sub: '30 Gruppen/Jahr' }
];

const state = {
  stufe: DATA.stufen[DATA.stufen.length - 1].id,
  szenario: 'stufenplan',          // stufenplan | ausbaupfad | nachfrage
  quotePlus: 10,                   // Szenario „Hohe Inanspruchnahme“
  tempo: K.ausbauGruppen,          // Szenario „Ausbaupfad“
  quoteAnspruch: K.quoteAnspruch,
  quoteBestand: K.quoteBestand,
  ebene: 'stadtbezirk',            // stadtbezirk | stadtteil
  sortKey: 'luecke',
  sortDir: -1,
  sheetNr: DATA.schulen[0].nr
};

const stufeById = id => DATA.stufen.find(s => s.id === id) || DATA.stufen[0];
const schuleByNr = nr => DATA.schulen.find(s => s.nr === nr);

/* Wirksame Quoten. Szenario 3 hebt beide um 10 bzw. 20 Punkte an; die Quote
   der Anspruchsjahrgänge ist dabei bei 100 % gedeckelt. */
function quoten(plusOverride) {
  const plus = plusOverride != null ? plusOverride
    : (state.szenario === 'nachfrage' ? state.quotePlus : 0);
  return {
    anspruch: Math.min(100, state.quoteAnspruch + plus),
    bestand: Math.min(100, state.quoteBestand + plus),
    plus: plus
  };
}

/* Wirksames Ausbautempo — nur Szenario 2 weicht von der Planung der Stadt ab. */
function tempoEffektiv() {
  return state.szenario === 'ausbaupfad' ? state.tempo : K.ausbauGruppen;
}

/* Stadtweite Platzzahl eines Schuljahres.
   Innerhalb des veröffentlichten Planungshorizonts (bis ${PLAN_ENDE}) gelten
   die Werte aus Tabelle 4-1 des OGS-Berichts — sie sind beschlossen und
   ändern sich durch ein anderes Ausbautempo nicht mehr. Erst danach wird mit
   dem gewählten Tempo fortgeschrieben. */
function plaetzeStadt(jahr, tempo) {
  tempo = tempo != null ? tempo : tempoEffektiv();
  if (PLAN_JE_JAHR[jahr]) return PLAN_JE_JAHR[jahr].plaetze;
  if (jahr < PLAN_ENDE_JAHR) return IST.plaetze;
  return PLAN_ENDE.plaetze + (jahr - PLAN_ENDE_JAHR) * tempo * K.plaetzeJeGruppe;
}

/* Kernrechnung je Standort und Ausbaustufe. */
function berechne(s, stufe, opts) {
  opts = opts || {};
  const q = opts.quoten || quoten();
  const tempo = opts.tempo != null ? opts.tempo : tempoEffektiv();

  let kinderAnspruch = 0, kinderRest = 0;
  for (let i = 0; i < 4; i++) {
    const n = s.jahrgang[String(stufe.jahr - i)] || 0;
    if (i < stufe.jahrgaenge) kinderAnspruch += n; else kinderRest += n;
  }
  const bedarfAnspruch = kinderAnspruch * q.anspruch / 100;
  const bedarfRest = kinderRest * q.bestand / 100;
  const bedarf = bedarfAnspruch + bedarfRest;
  const kap = plaetzeStadt(stufe.jahr, tempo) * s.kapAnteil;

  return {
    schule: s, stufe: stufe,
    kinder: kinderAnspruch + kinderRest, kinderAnspruch: kinderAnspruch, kinderRest: kinderRest,
    bedarf: bedarf, bedarfAnspruch: bedarfAnspruch, bedarfRest: bedarfRest,
    kap: kap,
    gedeckt: Math.min(bedarf, kap),
    luecke: Math.max(0, bedarf - kap),
    ueberhang: Math.max(0, kap - bedarf),
    deckung: bedarf > 0 ? kap / bedarf : 1,
    ampel: ampel(bedarf > 0 ? kap / bedarf : 1)
  };
}

function ampel(deckung) {
  if (deckung >= 1) return 'gruen';
  if (deckung >= 0.85) return 'gelb';
  return 'rot';
}
const AMPEL_FARBE = { gruen: C_OK, gelb: C_WARN, rot: C_ERR };
const AMPEL_TEXT = { gruen: 'gedeckt', gelb: 'knapp', rot: 'Lücke' };

function alleStandorte(stufe, opts) {
  return DATA.schulen.map(s => berechne(s, stufe, opts));
}
function summe(rows) {
  const acc = { kinder: 0, kinderAnspruch: 0, kinderRest: 0, bedarf: 0, bedarfAnspruch: 0, bedarfRest: 0, kap: 0, gedeckt: 0, luecke: 0, ueberhang: 0 };
  rows.forEach(r => { for (const k in acc) acc[k] += r[k]; });
  acc.deckung = acc.bedarf > 0 ? acc.kap / acc.bedarf : 1;
  return acc;
}

/* Gebiete der gewählten Ebene. */
function gebiete() {
  return state.ebene === 'stadtbezirk' ? DATA.bezirke : DATA.stadtteile;
}
const EBENE_TXT = { stadtbezirk: 'Stadtbezirke', stadtteil: 'Stadtteile' };
function gebietVon(s) {
  return state.ebene === 'stadtbezirk' ? s.stadtbezirk : s.stadtteil;
}

/* Jahr, in dem ein Ausbautempo den Bedarf der Endstufe deckt. */
function zielerreichung(tempo) {
  const endstufe = DATA.stufen[DATA.stufen.length - 1];
  const bedarf = summe(alleStandorte(endstufe, { tempo: tempo })).bedarf;
  for (let j = IST_JAHR; j <= IST_JAHR + 40; j++) {
    if (plaetzeStadt(j, tempo) >= bedarf) return { jahr: j, bedarf: bedarf };
  }
  return { jahr: null, bedarf: bedarf };
}

/* ====================================================================
   GLOSSAR
   ==================================================================== */
const DEMO = 'Demo-Annahme — im Projekt durch Daten des Fachbereichs zu ersetzen.';

function buildMetricInfo() {
  const st = stufeById(state.stufe);
  const q = quoten();
  const n = DATA.schulen.length;
  const bt = DATA.backtest;
  const b = DATA.befragung;

  METRIC_INFO = {
    bedarf: {
      t: 'Platzbedarf gesamt',
      d: `Summe über alle ${n} Grundschulen in der Stufe ${st.id}. Je Klassenstufe wird die
        Jahrgangsstärke mit der zugehörigen Quote multipliziert: die ${st.jahrgaenge}
        Anspruchsjahrgänge (${st.klassen}) mit ${fmtPct(q.anspruch)}, die übrigen mit
        ${fmtPct(q.bestand)}. Die Quote der Anspruchsjahrgänge ist der Anteil der Eltern,
        die in der Elternbefragung der Stadt (Juni 2024, ${fmtInt(b.haushalte)} Haushalte,
        Rücklauf ${fmtPct(b.ruecklaufquote)}) angegeben haben, künftig einen Ganztagsplatz in
        Anspruch nehmen zu wollen. Die Quote der übrigen Jahrgänge ist die tatsächliche
        Teilnahmequote 2025/26 aus Tabelle 4-1 des OGS-Berichts. Nicht abgebildet sind
        Schuleinzugsbereiche — der Bedarf eines Bezirks wird im Verhältnis der Schülerzahlen
        auf seine Standorte verteilt.`
    },
    bedarfAnspruch: {
      t: 'Davon rechtlich gebunden',
      d: `Der Teil des Platzbedarfs, der in der Stufe ${st.id} unter den Rechtsanspruch nach
        § 24 Abs. 4 SGB VIII fällt (${st.klassen}). Dieser Teil ist einklagbar; die übrigen
        Jahrgänge sind es nicht. Rechenweg: Jahrgangsstärke der Anspruchsjahrgänge ×
        ${fmtPct(q.anspruch)}.`
    },
    kapazitaet: {
      t: 'Kapazität (Plätze im Ganztag)',
      d: `Stadtweite Platzzahl des Schuljahres, verteilt auf die Standorte. Die stadtweite Zahl
        ist keine Annahme: Bis 2027/28 stammt sie aus Tabelle 4-1 des OGS-Berichts (Ist bis
        2024/25, danach die Ausbauplanung der Stadt), darüber hinaus wird sie mit dem dort
        genannten Tempo von ${K.ausbauGruppen} Gruppen beziehungsweise
        ${fmtInt(K.plaetzeProJahr)} Plätzen pro Jahr fortgeschrieben. Ein abweichendes
        Ausbautempo wirkt erst nach dem Ende des veröffentlichten Planungshorizonts
        (${PLAN_ENDE.schuljahr}, ${fmtInt(PLAN_ENDE.plaetze)} Plätze) — die Jahre davor sind
        bereits beschlossen. Die Platzzahl je einzelner Schule ist nicht offen verfügbar —
        ihre Verteilung ist die zentrale ${DEMO}`
    },
    kapAnteil: {
      t: 'Verteilung der Plätze auf die Standorte',
      d: `Die stadtweite Platzzahl wird im Verhältnis von Schülerzahl × OGS-Quote des
        Sozialindex verteilt. Die Quoten je Grundschulsozialindex stammen aus Abb. 4-1 des
        OGS-Berichts (Schuljahr 2023/24): Stufe 1 ${fmtPct(DATA.ogsQuoteJeGsi['1'])},
        Stufe 2 ${fmtPct(DATA.ogsQuoteJeGsi['2'])}, Stufe 3 ${fmtPct(DATA.ogsQuoteJeGsi['3'])},
        Stufe 4 ${fmtPct(DATA.ogsQuoteJeGsi['4'])}, Stufe 5 ${fmtPct(DATA.ogsQuoteJeGsi['5'])}.
        Die Stadt veröffentlicht ihren fünfstufigen kommunalen Grundschulsozialindex je Schule
        nicht; er wird hier gleichmäßig aus der neunstufigen Sozialindexstufe des Landes
        abgeleitet. Sowohl diese Umrechnung als auch die Verteilungsregel selbst sind
        ${DEMO}`
    },
    luecke: {
      t: 'Offene Plätze (Lücke)',
      d: `Platzbedarf minus Kapazität, je Standort auf mindestens null begrenzt und dann
        summiert. Überhänge an einem Standort gleichen eine Lücke an einem anderen also nicht
        aus — das ist der Unterschied zur rein gesamtstädtischen Bilanz und der Grund, warum
        die standortscharfe Rechnung mehr offene Plätze ausweist als die Differenz der
        Summen. Ein Planungswert, keine Feststellung des Schulträgers.`
    },
    deckung: {
      t: 'Deckungsgrad',
      d: `Kapazität geteilt durch Platzbedarf. Ampellogik: grün ab 100 %, gelb ab 85 %, rot
        darunter. Je Standort gerechnet, für Gebiete und die Gesamtstadt aus den Summen
        gebildet. Zum Vergleich: Die Stadt weist für 2025/26 eine Ganztagsquote von
        ${fmtPct(K.quoteBestand)} aus — diese Quote misst Plätze je Schülerin und Schüler,
        nicht Plätze je Bedarf, und liegt deshalb systematisch höher.`
    },
    stufenbilanz: {
      t: 'Stadtweite Bilanz je Ausbaustufe',
      d: `Je Ausbaustufe der gedeckte Platzbedarf und die offenen Plätze, gestapelt; die
        Balkenhöhe ist der Gesamtbedarf. Der Rechtsanspruch wächst jährlich um einen Jahrgang:
        ${DATA.stufen.map(s => s.id + ' = ' + s.klassen).join(', ')}. Die Kapazität wächst
        parallel mit der Ausbauplanung — die Lücke wächst trotzdem, weil jeder zusätzliche
        Anspruchsjahrgang mehr Bedarf auslöst, als ${fmtInt(K.plaetzeProJahr)} neue Plätze
        decken.`
    },
    jahrgaenge: {
      t: 'Einschulungsjahrgänge',
      d: `Zahl der Kinder, die in dem jeweiligen Schuljahr eingeschult werden. Diese Größe muss
        nicht prognostiziert werden: Alle Kinder, die bis 2029/30 eingeschult werden, sind
        bereits geboren und im Melderegister der Stadt erfasst. Grundlage sind die
        kleinräumigen Bevölkerungsdaten zum ${DATA.meta.stichtagBev} (Altersgruppen unter 3,
        3 bis unter 6, 6 bis unter 10 je statistischem Bezirk). Die Quelle veröffentlicht
        Altersblöcke, keine einzelnen Geburtsjahrgänge — zwischen den drei Blockmittelwerten
        wird interpoliert. Anschließend wird mit der gemessenen Wanderungsrate von
        ${fmtPct(K.wanderungsratePct)} pro Jahr auf das Grundschulalter fortgeschrieben.
        Jahrgangsscharfe Geburtszahlen je Bezirk liegen nicht offen vor; im Projekt tritt die
        Statistik des FB 312 an diese Stelle.`
    },
    wanderung: {
      t: 'Wanderungsrate',
      d: `Nicht angenommen, sondern gemessen: Dieselben Geburtsjahrgänge werden in einem
        späteren Altersblock wiedergefunden und die Differenz ausgewiesen. Über die Reihe
        2012–2024 ergibt sich vom Block „unter 3“ zum Block „3 bis unter 6“ der Faktor
        ${nf1.format(K.f1 * 100 - 100)} % (${K.f1n} Jahrgangspaare) und weiter zum Block
        „6 bis unter 10“ ${nf1.format(K.f2 * 100 - 100)} % (${K.f2n} Paare) — zusammen
        ${fmtPct(K.wanderungsratePct)} je Altersjahr. Krefeld gewinnt also über Zuzug Kinder
        hinzu, bevor sie eingeschult werden. Die Rate wird stadtweit gebildet und auf alle
        Bezirke angewandt; bezirksscharfe Raten wären bei diesen Fallzahlen zu unruhig.`
    },
    backtest: {
      t: 'Prüfung des Verfahrens',
      d: `Zwei unabhängige Prüfungen. Erstens die Rückrechnung: Die Wanderungsfaktoren werden
        nur auf den Jahren ${bt.fitVon}–${bt.fitBis} geschätzt und sagen anschließend
        ${bt.jahre.length} Geburtsjahrgänge voraus, die bei der Schätzung ungesehen blieben.
        Mittlere absolute Abweichung: ${fmtPct(bt.mape)}. Zweitens der Abgleich mit einer
        fremden Quelle: Die Altersgruppe 6 bis unter 10 des Melderegisters
        (${fmtInt(K.ankerRegister)}) sollte die Grundschülerzahl der Schulstatistik
        (${fmtInt(K.ankerMsb)}, MSB NRW) treffen — die Abweichung beträgt
        ${fmtPct(K.ankerAbwPct)} und erklärt sich daraus, dass nicht jedes Kind im
        Grundschulalter eine Krefelder Grundschule besucht.`
    },
    ausbaureihe: {
      t: 'Ausbau des Offenen Ganztags',
      d: `Plätze im Ganztag je Schuljahr aus Tabelle 4-1 des OGS-Berichts. Bis ${IST.schuljahr}
        Ist-Werte, danach die Ausbauplanung der Stadt bei ${K.ausbauGruppen} zusätzlichen
        Gruppen pro Jahr. Die Zahl der Plätze stieg von ${fmtInt(DATA.ausbauplanung[0].plaetze)}
        (${DATA.ausbauplanung[0].schuljahr}) auf ${fmtInt(IST.plaetze)} (${IST.schuljahr}),
        die Zahl der Gruppen von ${nf1.format(DATA.ausbauplanung[0].gruppen)} auf
        ${nf1.format(IST.gruppen)}. Eine Gruppe entspricht ${K.plaetzeJeGruppe} Plätzen.`
    },
    karte: {
      t: 'Standortkarte',
      d: `Punktposition aus den UTM-Koordinaten des Schulverzeichnisses NRW (EPSG:25832, nach
        WGS84 umgerechnet). Farbe nach Deckungsgrad in der Stufe ${st.id}, Punktfläche
        proportional zum Platzbedarf. Die Flächen sind die amtlichen Grenzen der Stadt Krefeld
        (${EBENE_TXT[state.ebene]}), für die Darstellung auf rund 25 m vereinfacht. Die fünf
        Stadtbezirke gelten seit dem 01.11.2025; zuvor waren es neun.`
    },
    luecke_bezirk: {
      t: 'Offene Plätze je Gebiet',
      d: `Summe der standortscharfen Lücken je Gebiet in der Stufe ${st.id}. Die Zuordnung der
        Standorte erfolgt geometrisch über die amtliche Gebietsgliederung der Stadt. Wichtig:
        Stadtbezirke sind die politische Einteilung (fünf Bezirksvertretungen seit dem
        01.11.2025), Stadtteile die statistische — auf letztere beziehen sich das
        Statistische Jahrbuch und die amtlichen Statistiken der Stadt. Schuleinzugsbereiche
        sind nicht abgebildet; sie wären im Projekt die genauere Ebene.`
    },
    gebietstabelle: {
      t: 'Gebietsübersicht',
      d: `Bedarf, Kapazität, Lücke und Deckungsgrad je Gebiet, dazu der Ü3-Platzbestand der
        Kindertageseinrichtungen als Vorlaufindikator für die kommenden Einschulungsjahrgänge
        (Open Data NRW${DATA.meta.kitasOhneBezirk ? `, ${DATA.meta.kitasOhneBezirk} Einrichtungen ohne Zuordnung wegen der vereinfachten Grenzen` : ''}).
        <b>Wichtig für die Lesart:</b> Der Bedarf eines Gebiets folgt dem <i>Wohnort</i> der
        Kinder (Melderegister), die Kapazität dem <i>Schulort</i>. Weil Schuleinzugsbereiche
        nicht offen vorliegen, erscheinen Gebiete mit vielen Kindern und wenigen Schulplätzen
        unterversorgt und Gebiete mit großen Schulen überversorgt — auch dann, wenn die Kinder
        die Schule im Nachbarbezirk besuchen und tatsächlich versorgt sind. Die
        Gebietsunterschiede sind deshalb ein Hinweis auf Pendelbeziehungen, keine
        Versorgungsaussage; belastbar wird die Ebene erst mit den Einzugsbereichen des
        Fachbereichs. Die stadtweite Summe ist von diesem Effekt nicht betroffen.`
    },
    sz_stufenplan: {
      t: 'Szenario 1 — Stufenplan bis 2029/30',
      d: `Der Rechtsanspruch wächst jährlich um einen Jahrgang, die Quoten bleiben konstant
        (Anspruchsjahrgänge ${fmtPct(state.quoteAnspruch)}, übrige ${fmtPct(state.quoteBestand)}).
        Der Ausbau folgt der Planung der Stadt. Das Szenario isoliert damit den reinen Effekt
        der Anspruchsausweitung.`
    },
    sz_ausbaupfad: {
      t: 'Szenario 2 — Ausbaupfad',
      d: `Das historische Tempo von ${K.ausbauGruppen} zusätzlichen Gruppen pro Jahr
        (${fmtInt(K.plaetzeProJahr)} Plätze) gegen beschleunigte Pfade. Ausgewiesen wird je
        Variante das Jahr, in dem der Platzbedarf der Endstufe 2029/30 gedeckt wäre.
        Personal-, Raum- und Mensenkapazitäten begrenzen das Tempo real — der OGS-Bericht
        nennt die Küchen- und Mensenausstattung ausdrücklich als Engpass. Ein schnellerer Pfad
        ist hier eine Rechengröße, keine Aussage über Machbarkeit.`
    },
    sz_nachfrage: {
      t: 'Szenario 3 — Hohe Inanspruchnahme',
      d: `Aufschlag von 10 beziehungsweise 20 Prozentpunkten auf beide Quoten, weil der
        Rechtsanspruch das Anmeldeverhalten verändert. Zur Einordnung: In der Elternbefragung
        der Stadt (Juni 2024) gaben ${fmtPct(b.wollenGanztagsplatz)} der Eltern an, künftig
        einen Ganztagsplatz in Anspruch nehmen zu wollen; der OGS-Bericht leitet daraus ab,
        dass bis 2029 eine nahezu vollständige Versorgungsquote von
        ${fmtPct(K.bedarfsquote2029)} erforderlich sein wird. Die Aufschläge bewegen sich
        damit innerhalb dessen, was die Stadt selbst erwartet. Das Diagramm folgt der oben
        gewählten Ausbaustufe. In den Übergangsjahren ist der Effekt am größten, weil der
        Aufschlag dort auf die Jahrgänge ohne Rechtsanspruch wirkt; in der Endstufe 2029/30
        sind alle vier Jahrgänge anspruchsberechtigt und die Quote läuft gegen die Deckelung
        bei 100 % — dann sind + 10 und + 20 Prozentpunkte nicht mehr zu unterscheiden.`
    },
    annahmen: {
      t: 'Annahmen',
      d: `Alle vier Regler sind mit veröffentlichten Werten der Stadt vorbelegt: die Quote der
        Anspruchsjahrgänge mit dem Ergebnis der Elternbefragung (${fmtPct(K.quoteAnspruch)}),
        die Quote der übrigen Jahrgänge mit der Ganztagsquote 2025/26
        (${fmtPct(K.quoteBestand)}), das Ausbautempo mit ${K.ausbauGruppen} Gruppen pro Jahr
        und die Gruppengröße mit ${K.plaetzeJeGruppe} Plätzen. Nicht verstellbar und nicht
        offen verfügbar ist die Platzzahl je einzelner Schule.`
    },
    wirkung: {
      t: 'Wirkung der Ausbauschritte',
      d: `Stadtweiter Deckungsgrad in der Stufe ${st.id}, wenn zusätzlich zur eingestellten
        Kapazität weitere Ausbauschritte von je ${fmtInt(K.plaetzeProJahr)} Plätzen
        (${K.ausbauGruppen} Gruppen) wirksam werden. Die Schritte wirken hier stadtweit; real
        wirkt ein Ausbauschritt an seinem Standort — Plätze in Hüls decken keinen Anspruch in
        Fischeln. Die standortscharfe Wirkung zeigt die Karte.`
    },
    mensa: {
      t: 'Küchen- und Mensa-Maßnahmen',
      d: `Die im OGS-Bericht benannten Maßnahmenpakete zum Ausbau von Küchen und Mensen
        (Beschluss ASW und Betriebsausschuss ZGM, Vorlage 6283/24). Sie sind Voraussetzung
        für höhere Ganztagsquoten am Standort: Der Bericht hält fest, dass in allen Mensen
        bereits im Drei-Schicht-Betrieb gegessen wird und die Kapazitäten ausgeschöpft sind.
        Platzwirkungen je Maßnahme beziffert der Bericht nicht — die Tabelle weist deshalb
        keine Plätze aus, sondern nur Standort und Zeitpunkt.
        ${DATA.meta.mensaZugeordnet} der ${DATA.meta.mensaGesamt} genannten Standorte ließen
        sich einer Schulnummer des Schulverzeichnisses zuordnen; die übrigen sind
        Förderschulen im Primarbereich, die das Verzeichnis unter „Grundschule“ nicht führt.`
    },
    sozialindex: {
      t: 'Sozialindexstufe',
      d: `Stufe 1 bis 9 nach dem Sozialindex des Landes NRW (Schulliste 2025/26, MSB NRW);
        Stufe 9 steht für die größte Belastung. Für einen Standort ist keine Stufe ausgewiesen
        („ohne“). Die Stadt Krefeld verwendet daneben einen eigenen, fünfstufigen
        Grundschulsozialindex, den sie je Schule nicht veröffentlicht.`
    },
    kohorte: {
      t: 'Jahrgangsstärke am Standort',
      d: `Die Jahrgangsstärke des Bezirks, verteilt auf seine Grundschulen im Verhältnis der
        Schülerzahlen. Es gibt keine offenen Schuleinzugsbereiche — deshalb diese
        Verteilungsregel, die eine ${DEMO} Sie verschiebt Bedarf zwischen den Standorten eines
        Bezirks, ohne welchen zu schaffen: Die Bezirkssumme bleibt der gemessene Registerwert.`
    }
  };
}

/* ====================================================================
   STEUERLEISTE — Ausbaustufe und Szenario, in mehreren Ansichten geteilt.
   ==================================================================== */
const SZENARIEN = [
  { id: 'stufenplan', t: 'Stufenplan bis 2029/30', sub: 'Quoten konstant' },
  { id: 'ausbaupfad', t: 'Ausbaupfad', sub: 'Tempo im Vergleich' },
  { id: 'nachfrage', t: 'Hohe Inanspruchnahme', sub: 'Quoten + 10 / + 20 Pp.' }
];

function controlsHtml() {
  const stufen = DATA.stufen.map(s =>
    `<button data-ctrl="stufe" data-val="${s.id}" class="${s.id === state.stufe ? 'on' : ''}" aria-pressed="${s.id === state.stufe}">${s.id}<span class="sm">${s.klassen}</span></button>`).join('');
  const szen = SZENARIEN.map(s =>
    `<button data-ctrl="szenario" data-val="${s.id}" class="${s.id === state.szenario ? 'on' : ''}" aria-pressed="${s.id === state.szenario}">${s.t}<span class="sm">${s.sub}</span></button>`).join('');

  let extra = '';
  if (state.szenario === 'nachfrage') {
    const q = quoten();
    extra = `<div class="ctrl-group"><span class="lbl">Aufschlag auf die Quoten</span><div class="segmented">
      ${[10, 20].map(p => `<button data-ctrl="quotePlus" data-val="${p}" class="${state.quotePlus === p ? 'on' : ''}" aria-pressed="${state.quotePlus === p}">+ ${p} Pp.<span class="sm">${fmtPct(Math.min(100, state.quoteBestand + p))} / ${fmtPct(Math.min(100, state.quoteAnspruch + p))}</span></button>`).join('')}
    </div></div>`;
  } else if (state.szenario === 'ausbaupfad') {
    extra = `<div class="ctrl-group"><span class="lbl">Ausbautempo</span><div class="segmented">
      ${TEMPI.map(t => `<button data-ctrl="tempo" data-val="${t.g}" class="${state.tempo === t.g ? 'on' : ''}" aria-pressed="${state.tempo === t.g}">${t.t}<span class="sm">${t.sub}</span></button>`).join('')}
    </div></div>`;
  }

  return `<div class="controls">
    <div class="ctrl-group"><span class="lbl">Ausbaustufe des Rechtsanspruchs</span><div class="segmented">${stufen}</div></div>
    <div class="ctrl-group"><span class="lbl">Szenario</span><div class="segmented">${szen}</div></div>
    ${extra}
  </div>`;
}

function mountControls() {
  ['controls-overview', 'controls-karte', 'controls-bezirke', 'controls-rechner', 'controls-blatt'].forEach(id => {
    const host = $('#' + id); if (host) host.innerHTML = controlsHtml();
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('.controls .segmented button'); if (!b) return;
  const k = b.dataset.ctrl, v = b.dataset.val;
  if (k === 'stufe') state.stufe = v;
  else if (k === 'szenario') state.szenario = v;
  else if (k === 'quotePlus') state.quotePlus = +v;
  else if (k === 'tempo') state.tempo = +v;
  renderAll();
});

/* ====================================================================
   VIEWS
   ==================================================================== */
function renderLegalBanner() {
  $('#legal-banner').innerHTML = `<b>Rechtsanspruch auf ganztägige Förderung.</b>
    Nach § 24 Abs. 4 SGB VIII (GaFöG) besteht der Anspruch seit dem 1. August 2026 für die
    erste Klasse und wächst jährlich um einen Jahrgang bis zu den Klassen 1–4 im Schuljahr
    2029/30. Die Jugendhilfeplanung ist Pflichtaufgabe nach § 80 SGB VIII. Dieser Demonstrator
    ergänzt den OGS-Bericht der Stadt Krefeld um die Vorausschau — er ersetzt ihn nicht und
    ist kein Fachverfahren. Es werden ausschließlich aggregierte Daten auf Ebene Schule,
    Bezirk und Jahrgang verarbeitet; Sozialdaten nach §§ 61 ff. SGB VIII werden weder benötigt
    noch verwendet.`;
}

/* ---------------------------------------------------------- Überblick ---- */
function renderOverview() {
  const st = stufeById(state.stufe);
  const rows = alleStandorte(st);
  const s = summe(rows);
  const q = quoten();

  const kpis = $('#overview-kpis'); kpis.innerHTML = '';
  [
    { k: 'Platzbedarf ' + st.id, v: fmtInt(s.bedarf), d: `${st.klassen} · ${fmtInt(s.kinder)} Kinder im Grundschulalter`, cls: 'ink', info: 'bedarf' },
    { k: 'Davon Rechtsanspruch', v: fmtInt(s.bedarfAnspruch), d: `${fmtPct0(s.bedarfAnspruch / s.bedarf * 100)} des Bedarfs · einklagbar`, info: 'bedarfAnspruch' },
    { k: 'Plätze im Ganztag', v: fmtInt(s.kap), d: PLAN_JE_JAHR[st.jahr] ? 'Ausbauplanung der Stadt' : `fortgeschrieben, ${K.ausbauGruppen} Gruppen/Jahr`, cls: 'petrol', info: 'kapazitaet' },
    { k: 'Offene Plätze', v: fmtInt(s.luecke), d: `Deckungsgrad ${fmtPct0(s.deckung * 100)}`, info: 'luecke' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  columnChart($('#chart-stufen'), DATA.stufen.map(x => {
    const sm = summe(alleStandorte(x));
    return {
      id: x.id, label: x.id, gedeckt: sm.gedeckt, luecke: sm.luecke,
      totalLabel: fmtPct0(sm.deckung * 100),
      tip: `<b>${x.id} · ${x.klassen}</b>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(sm.bedarf)}</span></div>
        <div class="row"><span>davon Rechtsanspruch</span><span>${fmtInt(sm.bedarfAnspruch)}</span></div>
        <div class="row"><span>Plätze</span><span>${fmtInt(sm.kap)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sm.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(sm.deckung * 100)}</span></div>`
    };
  }), {
    keys: [{ key: 'gedeckt', color: C_KAP }, { key: 'luecke', color: C_LUECKE }],
    legend: [{ label: 'gedeckter Platzbedarf', color: C_KAP }, { label: 'offene Plätze', color: C_LUECKE }],
    showTotals: true, height: 260
  });

  const jgJahre = DATA.meta.einschulungsjahre;
  columnChart($('#chart-jahrgaenge'), jgJahre.map(e => {
    const n = DATA.schulen.reduce((a, x) => a + (x.jahrgang[e] || 0), 0);
    return {
      id: e, label: e.slice(2) + '/' + String(+e + 1).slice(2), n: n,
      color: +e >= 2026 ? C_KAP : 'var(--neutral-300)',
      tip: `<b>Einschulung ${e}/${String(+e + 1).slice(2)}</b>
        <div class="row"><span>Kinder</span><span>${fmtInt(n)}</span></div>
        <div class="row"><span>Geburtsjahrgang</span><span>${+e - 6}</span></div>
        <div class="row"><span>Status</span><span>${+e <= 2025 ? 'bereits eingeschult' : 'geboren, noch nicht eingeschult'}</span></div>`
    };
  }), { height: 210, showTotals: true, min: 2600 });

  columnChart($('#chart-ausbau'), DATA.ausbauplanung.map(p => ({
    id: p.schuljahr, label: p.schuljahr.slice(2, 5), n: p.plaetze,
    color: p.ist ? C_KAP : 'var(--petrol-300)',
    tip: `<b>${p.schuljahr}${p.ist ? ' (Ist)' : ' (Planung)'}</b>
      <div class="row"><span>Plätze im Ganztag</span><span>${fmtInt(p.plaetze)}</span></div>
      <div class="row"><span>Gruppen</span><span>${nf1.format(p.gruppen)}</span></div>
      <div class="row"><span>Schüler:innen</span><span>${fmtInt(p.schueler)}</span></div>
      <div class="row"><span>Ganztagsquote</span><span>${fmtPct(p.quote)}</span></div>`
  })), {
    height: 210, labelEvery: 2,
    legend: [{ label: 'Ist', color: C_KAP }, { label: 'Ausbauplanung der Stadt', color: 'var(--petrol-300)' }]
  });

  const bt = DATA.backtest;
  $('#anker-box').innerHTML = `
    <div class="grid g2">
      <div>
        <div class="mixrow"><div class="lbl">Rückrechnung an der Vergangenheit</div></div>
        <div class="table-wrap" style="box-shadow:none;border:1px solid var(--neutral-200)">
          <table><thead><tr><th>Geburtsjahrgang</th><th class="num">Prognose</th><th class="num">Ist</th><th class="num">Abweichung</th></tr></thead>
          <tbody>${bt.jahre.map(z => `<tr><td>${z.geburtsjahr}</td><td class="num">${fmtInt(z.prognose)}</td><td class="num">${fmtInt(z.ist)}</td><td class="num" style="color:${Math.abs(z.abwPct) < 3 ? 'var(--ok)' : 'var(--warn)'}">${nf1.format(z.abwPct)} %</td></tr>`).join('')}</tbody></table>
        </div>
        <p class="note">Faktoren nur auf ${bt.fitVon}–${bt.fitBis} geschätzt, Zieljahre ungesehen.
          Mittlere absolute Abweichung <b>${fmtPct(bt.mape)}</b>.</p>
      </div>
      <div>
        <div class="mixrow"><div class="lbl">Abgleich mit einer fremden Quelle</div></div>
        <dl class="sheet-kv">
          <dt>Melderegister, 6 bis unter 10 Jahre</dt><dd>${fmtInt(K.ankerRegister)}</dd>
          <dt>Schulstatistik MSB, Grundschüler:innen</dt><dd>${fmtInt(K.ankerMsb)}</dd>
          <dt>Abweichung</dt><dd>${nf1.format(K.ankerAbwPct)} %</dd>
          <dt>Gemessene Wanderungsrate${infoIcon('wanderung')}</dt><dd>${fmtPct(K.wanderungsratePct)} je Altersjahr</dd>
        </dl>
        <p class="note">Zwei unabhängig erhobene Quellen — Melderegister der Stadt und
          Schulstatistik des Landes — beschreiben dieselbe Altersgruppe. Die verbleibende
          Abweichung entspricht den Kindern, die keine Krefelder Grundschule besuchen.</p>
      </div>
    </div>`;
}

/* -------------------------------------------------------------- Karte ---- */
function renderKarte() {
  const st = stufeById(state.stufe);
  const rows = alleStandorte(st);
  const s = summe(rows);
  const zaehl = { gruen: 0, gelb: 0, rot: 0 };
  rows.forEach(r => zaehl[r.ampel]++);

  const kpis = $('#karte-kpis'); kpis.innerHTML = '';
  [
    { k: 'Standorte gedeckt', v: fmtInt(zaehl.gruen), d: 'Deckungsgrad ab 100 %', cls: 'ink' },
    { k: 'Standorte knapp', v: fmtInt(zaehl.gelb), d: 'Deckungsgrad 85 bis 100 %' },
    { k: 'Standorte mit Lücke', v: fmtInt(zaehl.rot), d: 'Deckungsgrad unter 85 %' },
    { k: 'Deckungsgrad gesamt', v: fmtPct0(s.deckung * 100), d: `${fmtInt(s.luecke)} offene Plätze`, cls: 'petrol', info: 'deckung' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  $('#karte-sub').textContent = `Stufe ${st.id} · ${st.klassen} · Ampellogik: grün ab 100 %, gelb ab 85 %, rot darunter`;
  drawMap(rows);

  const lg = $('#map-legend'); lg.innerHTML = '';
  [['gruen', 'gedeckt'], ['gelb', 'knapp'], ['rot', 'Lücke']].forEach(([a, t]) =>
    lg.appendChild(el('div', 'item', `<span class="sw" style="background:${AMPEL_FARBE[a]}"></span>${t}`)));
  lg.appendChild(el('div', 'item', '<span class="sw" style="background:var(--neutral-200)"></span>Punktfläche ∝ Platzbedarf'));
}

function drawMap(rows) {
  const W = 620, H = 560, pad = 14;
  const flaechen = gebiete();
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  flaechen.forEach(b => b.ringe.forEach(r => r.forEach(p => {
    minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]);
    minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]);
  })));
  const midLat = (minLat + maxLat) / 2, kx = Math.cos(midLat * Math.PI / 180);
  const spanX = (maxLon - minLon) * kx, spanY = maxLat - minLat;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const px = lon => offX + (lon - minLon) * kx * scale;
  const py = lat => offY + (maxLat - lat) * scale;
  const path = ringe => ringe.map(r => 'M' + r.map(p => px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1)).join('L') + 'Z').join(' ');

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'map-svg', role: 'img',
    'aria-label': `Karte der ${DATA.schulen.length} Grundschulstandorte in Krefeld, eingefärbt nach Deckungsgrad in der Ausbaustufe ${state.stufe}`
  });

  const labels = [];
  flaechen.forEach(b => {
    const p = svgEl('path', { d: path(b.ringe), class: 'map-bezirk' });
    p.addEventListener('mousemove', e => {
      const sub = summe(rows.filter(r => gebietVon(r.schule) === b.nr));
      showTip(`<b>${esc(b.name)}</b>
        <div class="row"><span>Fläche</span><span>${nf1.format(b.flaecheKm2)} km²</span></div>
        <div class="row"><span>Grundschulen</span><span>${fmtInt(b.schulNrs.length)}</span></div>
        <div class="row"><span>Kinder 6 bis unter 10</span><span>${fmtInt(b.a6bis10)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sub.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${b.schulNrs.length ? fmtPct0(sub.deckung * 100) : 'keine eigene Schule'}</span></div>`, e.clientX, e.clientY);
    });
    p.addEventListener('mouseleave', hideTip);
    svg.appendChild(p);
    const ring = b.ringe.slice().sort((a, c) => c.length - a.length)[0];
    if (ring) labels.push({
      x: ring.reduce((a, p2) => a + px(p2[0]), 0) / ring.length,
      y: ring.reduce((a, p2) => a + py(p2[1]), 0) / ring.length,
      t: b.name
    });
  });

  const maxBedarf = Math.max.apply(null, rows.map(r => r.bedarf)) || 1;
  rows.slice().sort((a, b) => b.bedarf - a.bedarf).forEach(r => {
    const s = r.schule;
    if (s.lat == null || s.lon == null) return;
    const rad = 5 + 10 * Math.sqrt(r.bedarf / maxBedarf);
    const c = svgEl('circle', {
      cx: px(s.lon).toFixed(1), cy: py(s.lat).toFixed(1), r: rad.toFixed(1),
      fill: AMPEL_FARBE[r.ampel], 'fill-opacity': .85, class: 'map-pt',
      tabindex: '0', role: 'button',
      'aria-label': `${s.name}, Deckungsgrad ${Math.round(r.deckung * 100)} Prozent, ${Math.round(r.luecke)} offene Plätze. Öffnet das Kennzahlenblatt.`
    });
    const tip = e => showTip(standortTip(r), e.clientX, e.clientY);
    c.addEventListener('mousemove', tip);
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); showTip(standortTip(r), b.right, b.bottom); });
    c.addEventListener('blur', hideTip);
    const oeffnen = () => { state.sheetNr = s.nr; renderBlatt(); showView('blatt'); };
    c.addEventListener('click', oeffnen);
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(); } });
    svg.appendChild(c);
  });

  labels.forEach(l => {
    const t = svgEl('text', { x: l.x.toFixed(1), y: l.y.toFixed(1), 'text-anchor': 'middle', class: 'map-bezirk-lbl' });
    t.textContent = l.t; svg.appendChild(t);
  });

  const host = $('#map-host'); host.innerHTML = ''; host.appendChild(svg);
}

function standortTip(r) {
  const s = r.schule;
  return `<b>${esc(s.name)}</b>
    <div class="row"><span>Platzbedarf ${r.stufe.id}</span><span>${fmtInt(r.bedarf)}</span></div>
    <div class="row"><span>davon Rechtsanspruch</span><span>${fmtInt(r.bedarfAnspruch)}</span></div>
    <div class="row"><span>Plätze (Modell)</span><span>${fmtInt(r.kap)}</span></div>
    <div class="row"><span>offene Plätze</span><span>${fmtInt(r.luecke)}</span></div>
    <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(r.deckung * 100)} · ${AMPEL_TEXT[r.ampel]}</span></div>
    <div class="def">Klicken öffnet das Kennzahlenblatt.</div>`;
}

/* ------------------------------------------------------------ Bezirke ---- */
const COLS = [
  { k: 'name', t: 'Gebiet', num: false },
  { k: 'schulen', t: 'Grundschulen', num: true },
  { k: 'kinder', t: 'Kinder Kl. 1–4', num: true },
  { k: 'bedarf', t: 'Platzbedarf', num: true },
  { k: 'bedarfAnspruch', t: 'davon Anspruch', num: true },
  { k: 'kap', t: 'Plätze', num: true },
  { k: 'luecke', t: 'offene Plätze', num: true },
  { k: 'deckung', t: 'Deckungsgrad', num: true },
  { k: 'kitaUe3', t: 'Ü3-Plätze Kita', num: true }
];

function gebietsZeilen() {
  const st = stufeById(state.stufe);
  const rows = alleStandorte(st);
  return gebiete().map(b => {
    const sub = summe(rows.filter(r => gebietVon(r.schule) === b.nr));
    return {
      nr: b.nr, name: b.name, schulen: b.schulNrs.length,
      kinder: sub.kinder, bedarf: sub.bedarf, bedarfAnspruch: sub.bedarfAnspruch,
      kap: sub.kap, luecke: sub.luecke, deckung: sub.deckung,
      kitaUe3: b.kitaUe3, kitas: b.kitas, flaeche: b.flaecheKm2,
      einwohner: b.einwohner, a6bis10: b.a6bis10, ampel: ampel(sub.deckung)
    };
  });
}

function sortiert(rows) {
  const k = state.sortKey, d = state.sortDir;
  return rows.slice().sort((a, b) => {
    const x = a[k], y = b[k];
    if (typeof x === 'string') return d * x.localeCompare(y, 'de');
    return d * (x - y);
  });
}

function renderBezirke() {
  const st = stufeById(state.stufe);

  $('#ebene-switch').innerHTML = [
    ['stadtbezirk', 'Stadtbezirke', DATA.bezirke.length + ' · politisch'],
    ['stadtteil', 'Stadtteile', DATA.stadtteile.length + ' · statistisch']
  ].map(([v, t, sub]) => `<button data-ebene="${v}" class="${state.ebene === v ? 'on' : ''}" aria-pressed="${state.ebene === v}">${t}<span class="sm">${sub}</span></button>`).join('');

  const zeilen = gebietsZeilen();
  const mitSchule = zeilen.filter(z => z.schulen > 0);

  $('#bezirke-chart-sub').textContent = `Stufe ${st.id} · ${EBENE_TXT[state.ebene]} mit eigener Grundschule · Personen`;
  barChart($('#chart-bezirke'), mitSchule.slice().sort((a, b) => b.luecke - a.luecke).map(z => ({
    label: z.name.length > 22 ? z.name.slice(0, 21) + '…' : z.name,
    value: z.luecke,
    color: AMPEL_FARBE[z.ampel],
    tip: `<b>${esc(z.name)}</b>
      <div class="row"><span>Platzbedarf</span><span>${fmtInt(z.bedarf)}</span></div>
      <div class="row"><span>Plätze</span><span>${fmtInt(z.kap)}</span></div>
      <div class="row"><span>offene Plätze</span><span>${fmtInt(z.luecke)}</span></div>
      <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(z.deckung * 100)}</span></div>`
  })), { padL: 150, rowH: state.ebene === 'stadtteil' ? 26 : 34 });

  const thead = $('#bezirke-table thead');
  thead.innerHTML = '<tr>' + COLS.map(c =>
    `<th class="sortable${c.num ? ' num' : ''}${state.sortKey === c.k ? ' sorted' : ''}" data-sort="${c.k}" tabindex="0" role="button" aria-label="Nach ${c.t} sortieren">${c.t}${c.k === 'kitaUe3' ? infoIcon('gebietstabelle') : ''}${state.sortKey === c.k ? ` <span class="arrow">${state.sortDir < 0 ? '▼' : '▲'}</span>` : ''}</th>`).join('') + '</tr>';

  $('#bezirke-table tbody').innerHTML = sortiert(zeilen).map(z => `<tr>
    <td><span class="dot ${z.ampel}"></span>${esc(z.name)}<span class="sub">${nf1.format(z.flaeche)} km² · ${fmtInt(z.einwohner)} Einwohner</span></td>
    <td class="num">${z.schulen || '—'}</td>
    <td class="num">${fmtInt(z.kinder)}</td>
    <td class="num">${fmtInt(z.bedarf)}</td>
    <td class="num">${fmtInt(z.bedarfAnspruch)}</td>
    <td class="num">${z.schulen ? fmtInt(z.kap) : '—'}</td>
    <td class="num">${z.schulen ? fmtInt(z.luecke) : '—'}</td>
    <td class="num">${z.schulen ? fmtPct0(z.deckung * 100) : '—'}</td>
    <td class="num">${fmtInt(z.kitaUe3)}</td></tr>`).join('');

  const ohne = zeilen.length - mitSchule.length;
  $('#bezirke-note').innerHTML = `Stufe ${st.id} · ${st.klassen}. ${ohne
    ? `${ohne} der ${zeilen.length} ${EBENE_TXT[state.ebene]} haben keine eigene Grundschule — ihr Bedarf ist ausgewiesen, die Kapazität liegt bei den Standorten der Nachbarschaft. `
    : ''}Kinderzahlen aus dem Melderegister zum ${DATA.meta.stichtagBev}, Ü3-Plätze aus Open Data NRW.
    <b>Der Bedarf folgt dem Wohnort, die Kapazität dem Schulort.</b> Ohne die
    Schuleinzugsbereiche des Fachbereichs lassen sich Pendelbeziehungen zwischen den Gebieten
    nicht abbilden — Unterschiede zwischen den Gebieten sind daher als Hinweis zu lesen, nicht
    als Versorgungsaussage. Stadtweit gleicht sich der Effekt aus.`;
}

$('#ebene-switch').addEventListener('click', e => {
  const b = e.target.closest('button[data-ebene]'); if (!b) return;
  state.ebene = b.dataset.ebene; renderAll();
});
$('#bezirke-table thead').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]'); if (!th) return;
  const k = th.dataset.sort;
  if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = k === 'name' ? 1 : -1; }
  renderBezirke();
});
$('#bezirke-table thead').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const th = e.target.closest('th[data-sort]'); if (!th) return;
  e.preventDefault(); th.click();
});

$('#csv-btn').addEventListener('click', () => {
  const st = stufeById(state.stufe);
  const q = quoten();
  const kopf = [
    `# Kanduit Ganztags-Bedarfsmonitor Krefeld — ${EBENE_TXT[state.ebene]}`,
    `# Ausbaustufe ${st.id} (${st.klassen}), Szenario ${SZENARIEN.find(s => s.id === state.szenario).t}`,
    `# Quote Anspruchsjahrgaenge ${nf1.format(q.anspruch)} %, uebrige Jahrgaenge ${nf1.format(q.bestand)} %, Ausbautempo ${tempoEffektiv()} Gruppen/Jahr`,
    `# Datenstand ${DATA.meta.stand}; Quellen: Stadt Krefeld (Bevoelkerung, Gebiete, OGS-Bericht 2026), MSB NRW, Open Data NRW`,
    `# Die Platzzahl je Schule ist eine ausgewiesene Demo-Annahme.`
  ].join('\n');
  const sep = ';';
  const zeilen = sortiert(gebietsZeilen()).map(z => [
    z.nr, z.name, z.schulen, Math.round(z.kinder), Math.round(z.bedarf),
    Math.round(z.bedarfAnspruch), Math.round(z.kap), Math.round(z.luecke),
    nf1.format(z.deckung * 100), z.kitaUe3
  ].join(sep));
  const csv = kopf + '\n' + ['Nummer', 'Gebiet', 'Grundschulen', 'Kinder Klasse 1-4', 'Platzbedarf',
    'davon Rechtsanspruch', 'Plaetze', 'offene Plaetze', 'Deckungsgrad %', 'Ue3-Plaetze Kita'].join(sep)
    + '\n' + zeilen.join('\n') + '\n';
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ganztags-bedarfsmonitor-krefeld_${state.ebene}_${st.id.replace('/', '-')}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ---------------------------------------------------------- Szenarien ---- */
function renderSzenarien() {
  $('#szenarien-banner').innerHTML = `<b>Die Szenarien sind Rechengrößen, keine Prognosen.</b>
    Sie zeigen, wie empfindlich das Ergebnis auf die jeweils benannte Annahme reagiert. Der
    Umschalter oben in den anderen Ansichten setzt dasselbe Szenario dort ebenfalls.
    Personal-, Raum- und Mensenkapazitäten sind nicht modelliert — der OGS-Bericht nennt sie
    ausdrücklich als Engpass des Ausbaus.`;

  /* Szenario 1 — Deckungsgrad je Stufe bei konstanten Quoten */
  const q0 = { anspruch: state.quoteAnspruch, bestand: state.quoteBestand, plus: 0 };
  columnChart($('#chart-sz1'), DATA.stufen.map(x => {
    const sm = summe(alleStandorte(x, { quoten: q0, tempo: K.ausbauGruppen }));
    return {
      id: x.id, label: x.id, n: sm.deckung * 100,
      color: AMPEL_FARBE[ampel(sm.deckung)],
      totalLabel: fmtPct0(sm.deckung * 100),
      tip: `<b>${x.id} · ${x.klassen}</b>
        <div class="row"><span>Anspruchsjahrgänge</span><span>${x.jahrgaenge} von 4</span></div>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(sm.bedarf)}</span></div>
        <div class="row"><span>Plätze</span><span>${fmtInt(sm.kap)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sm.luecke)}</span></div>`
    };
  }), { height: 230, showTotals: true, pct: true, min: 100, marks: [{ at: 100, label: 'vollständig gedeckt' }] });

  /* Szenario 2 — Ausbaupfade und Zielerreichung */
  const pfade = TEMPI.map(t => {
    const z = zielerreichung(t.g);
    const endstufe = DATA.stufen[DATA.stufen.length - 1];
    const sm = summe(alleStandorte(endstufe, { tempo: t.g }));
    return { tempo: t, ziel: z, sm: sm };
  });
  $('#pfad-table thead').innerHTML = '<tr><th>Ausbaupfad</th><th class="num">Plätze/Jahr</th><th class="num">Plätze 2029/30</th><th class="num">Deckungsgrad 2029/30</th><th class="num">Ziel erreicht</th></tr>';
  $('#pfad-table tbody').innerHTML = pfade.map(p => `<tr>
    <td><span class="dot ${ampel(p.sm.deckung)}"></span>${p.tempo.t}<span class="sub">${p.tempo.sub}</span></td>
    <td class="num">${fmtInt(p.tempo.g * K.plaetzeJeGruppe)}</td>
    <td class="num">${fmtInt(p.sm.kap)}</td>
    <td class="num">${fmtPct0(p.sm.deckung * 100)}</td>
    <td class="num">${p.ziel.jahr ? p.ziel.jahr + '/' + String(p.ziel.jahr + 1).slice(2) : 'nicht bis 2065'}</td></tr>`).join('');

  const maxJahr = Math.max(...pfade.map(p => p.ziel.jahr || IST_JAHR + 20));
  const jahre = [];
  for (let j = IST_JAHR; j <= Math.min(maxJahr, IST_JAHR + 16); j++) jahre.push(j);
  const bedarfEnd = pfade[0].ziel.bedarf;
  columnChart($('#chart-sz2'), jahre.map(j => ({
    id: j, label: String(j).slice(2),
    n: plaetzeStadt(j, state.szenario === 'ausbaupfad' ? state.tempo : K.ausbauGruppen),
    color: plaetzeStadt(j, state.szenario === 'ausbaupfad' ? state.tempo : K.ausbauGruppen) >= bedarfEnd ? C_OK : C_KAP,
    tip: `<b>Schuljahr ${j}/${String(j + 1).slice(2)}</b>
      ${TEMPI.map(t => `<div class="row"><span>${t.sub}</span><span>${fmtInt(plaetzeStadt(j, t.g))}</span></div>`).join('')}
      <div class="row"><span>Bedarf Endstufe</span><span>${fmtInt(bedarfEnd)}</span></div>`
  })), {
    height: 240, labelEvery: 2,
    marks: [{ at: bedarfEnd, label: `Platzbedarf Endstufe 2029/30: ${fmtInt(bedarfEnd)}` }]
  });

  /* Szenario 3 — Aufschlag auf die Quoten, in der gewählten Ausbaustufe.
     In der Endstufe sind alle vier Jahrgänge anspruchsberechtigt; die Quote
     der Anspruchsjahrgänge liegt dann schon bei 95 % und der Aufschlag läuft
     gegen die Deckelung bei 100 %. Der Effekt ist deshalb in den
     Übergangsjahren am größten — dort wirkt er auf die Jahrgänge ohne
     Anspruch, die heute nur zu 61,5 % teilnehmen. */
  const sz3stufe = stufeById(state.stufe);
  const gedeckelt = sz3stufe.jahrgaenge === 4 && state.quoteAnspruch + 10 >= 100;
  $('#sz3-sub').textContent = `Platzbedarf ${sz3stufe.id} (${sz3stufe.klassen}) bei Aufschlag auf die Quoten · Personen`
    + (gedeckelt ? ' · in der Endstufe greift die Deckelung bei 100 %' : '');
  columnChart($('#chart-sz3'), [0, 10, 20].map(p => {
    const qq = quoten(p);
    const sm = summe(alleStandorte(sz3stufe, { quoten: qq, tempo: K.ausbauGruppen }));
    return {
      id: p, label: p === 0 ? 'Basis' : '+ ' + p + ' Pp.',
      gedeckt: sm.gedeckt, luecke: sm.luecke,
      totalLabel: fmtPct0(sm.deckung * 100),
      tip: `<b>${p === 0 ? 'Basisquoten' : 'Aufschlag + ' + p + ' Prozentpunkte'}</b>
        <div class="row"><span>Anspruchsjahrgänge</span><span>${fmtPct(qq.anspruch)}</span></div>
        <div class="row"><span>übrige Jahrgänge</span><span>${fmtPct(qq.bestand)}</span></div>
        <div class="row"><span>Platzbedarf 2029/30</span><span>${fmtInt(sm.bedarf)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(sm.luecke)}</span></div>`
    };
  }), {
    keys: [{ key: 'gedeckt', color: C_KAP }, { key: 'luecke', color: C_LUECKE }],
    legend: [{ label: 'gedeckter Platzbedarf', color: C_KAP }, { label: 'offene Plätze', color: C_LUECKE }],
    showTotals: true, height: 230
  });
}

/* --------------------------------------------------- Deckungsgradrechner -- */
const SLIDER = [
  { k: 'quoteAnspruch', t: 'Inanspruchnahme der Anspruchsjahrgänge', min: 50, max: 100, step: 0.5, einheit: '%',
    hint: () => `Voreinstellung ${fmtPct(K.quoteAnspruch)} — Elternbefragung der Stadt, Juni 2024.` },
  { k: 'quoteBestand', t: 'Teilnahmequote der übrigen Jahrgänge', min: 30, max: 100, step: 0.5, einheit: '%',
    hint: () => `Voreinstellung ${fmtPct(K.quoteBestand)} — Ganztagsquote 2025/26, Tabelle 4-1.` },
  { k: 'tempo', t: 'Ausbautempo', min: 5, max: 45, step: 1, einheit: ' Gruppen/Jahr',
    hint: () => `Voreinstellung ${K.ausbauGruppen} Gruppen — Ausbauplanung der Stadt. Entspricht ${fmtInt(state.tempo * K.plaetzeJeGruppe)} Plätzen pro Jahr.` }
];

function mountSliders() {
  const host = $('#sliders');
  if (!host.dataset.built) {
    host.innerHTML = SLIDER.map(s => `<div class="slider-row">
      <div class="head"><span class="nm">${s.t}</span><span class="val" id="val-${s.k}"></span></div>
      <input type="range" id="sl-${s.k}" min="${s.min}" max="${s.max}" step="${s.step}"
             aria-label="${s.t}">
      <span class="hint" id="hint-${s.k}"></span>
    </div>`).join('') + `<div class="slider-row"><button class="kbtn ghost" id="reset-btn">Auf die Werte der Stadt zurücksetzen</button></div>`;
    host.dataset.built = '1';
    SLIDER.forEach(s => $('#sl-' + s.k).addEventListener('input', e => {
      state[s.k] = +e.target.value;
      if (s.k === 'tempo') state.szenario = 'ausbaupfad';
      renderAll();
    }));
    $('#reset-btn').addEventListener('click', () => {
      state.quoteAnspruch = K.quoteAnspruch; state.quoteBestand = K.quoteBestand;
      state.tempo = K.ausbauGruppen; renderAll();
    });
  }
  SLIDER.forEach(s => {
    $('#sl-' + s.k).value = state[s.k];
    $('#val-' + s.k).textContent = (s.einheit === '%' ? nf1.format(state[s.k]) : fmtInt(state[s.k])) + s.einheit;
    $('#hint-' + s.k).textContent = s.hint();
  });
}

function renderRechner() {
  const st = stufeById(state.stufe);
  const s = summe(alleStandorte(st));
  const heute = summe(alleStandorte(DATA.stufen[0], { tempo: K.ausbauGruppen }));
  const schritt = K.plaetzeProJahr;
  $('#schritt-inline').textContent = fmtInt(schritt);

  mountSliders();

  const proSchritt = schritt / s.bedarf * 100;
  const kpis = $('#rechner-kpis'); kpis.innerHTML = '';
  [
    { k: `Deckungsgrad ${DATA.stufen[0].id}`, v: fmtPct0(heute.deckung * 100), d: `${fmtInt(heute.luecke)} offene Plätze · ${DATA.stufen[0].klassen}`, cls: 'ink', info: 'deckung' },
    { k: `Deckungsgrad ${st.id}`, v: fmtPct0(s.deckung * 100), d: `${fmtInt(s.luecke)} offene Plätze · ${st.klassen}`, cls: 'petrol', info: 'deckung' },
    { k: 'Ein Ausbauschritt bringt', v: '+ ' + fmtPct(proSchritt), d: `${fmtInt(schritt)} Plätze = ${K.ausbauGruppen} Gruppen`, info: 'wirkung' },
    { k: 'Nötige Schritte bis 100 %', v: s.luecke > 0 ? fmtInt(Math.ceil(s.luecke / schritt)) : '0', d: s.luecke > 0 ? `zusätzlich zur Planung in ${st.id}` : 'Bedarf bereits gedeckt', info: 'wirkung' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  const schritte = [0, 1, 2, 3, 4, 5];
  columnChart($('#chart-wirkung'), schritte.map(n => {
    const kap = s.kap + n * schritt;
    const deck = kap / s.bedarf;
    return {
      id: n, label: n === 0 ? 'Planung' : '+' + n,
      n: deck * 100, color: AMPEL_FARBE[ampel(deck)],
      totalLabel: fmtPct0(deck * 100),
      tip: `<b>${n === 0 ? 'Ausbauplanung der Stadt' : n + ' zusätzliche Ausbauschritte'}</b>
        <div class="row"><span>zusätzliche Plätze</span><span>${fmtInt(n * schritt)}</span></div>
        <div class="row"><span>Plätze gesamt</span><span>${fmtInt(kap)}</span></div>
        <div class="row"><span>Platzbedarf ${st.id}</span><span>${fmtInt(s.bedarf)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(Math.max(0, s.bedarf - kap))}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(deck * 100)}</span></div>`
    };
  }), { height: 230, showTotals: true, pct: true, min: 100, marks: [{ at: 100, label: 'vollständig gedeckt' }] });

  $('#mensa-table thead').innerHTML = '<tr><th>Paket</th><th>Standort</th><th class="num">wirksam ab</th><th>im Schulverzeichnis</th></tr>';
  $('#mensa-table tbody').innerHTML = DATA.mensa.map(m => {
    const sch = m.schulNr ? schuleByNr(m.schulNr) : null;
    return `<tr${sch ? ' class="click" data-nr="' + m.schulNr + '"' : ''}>
      <td>Paket ${m.paket}</td>
      <td>${esc(m.standort)}</td>
      <td class="num">${m.wirksamAb}</td>
      <td>${sch ? esc(sch.name) : '<span class="assumption">nicht als Grundschule geführt</span>'}</td></tr>`;
  }).join('');
}

$('#mensa-table').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-nr]'); if (!tr) return;
  state.sheetNr = tr.dataset.nr; renderBlatt(); showView('blatt');
});

/* --------------------------------------------------- Kennzahlenblatt ----- */
function renderBlatt() {
  const sel = $('#schul-select');
  if (!sel.dataset.built) {
    sel.innerHTML = DATA.schulen.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(s => `<option value="${s.nr}">${esc(s.name)}</option>`).join('');
    sel.dataset.built = '1';
    sel.addEventListener('change', () => { state.sheetNr = sel.value; renderBlatt(); });
  }
  sel.value = state.sheetNr;

  const s = schuleByNr(state.sheetNr);
  const st = stufeById(state.stufe);
  const r = berechne(s, st);
  const q = quoten();
  const bezirk = DATA.bezirke.find(b => b.nr === s.stadtbezirk);
  const teil = DATA.stadtteile.find(b => b.nr === s.stadtteil);
  const statName = DATA.statbezirkNamen[s.statbezirk] || s.statbezirk;
  const mensaHier = DATA.mensa.filter(m => m.schulNr === s.nr);

  const jgZeilen = [];
  for (let i = 0; i < 4; i++) {
    const e = st.jahr - i;
    jgZeilen.push({
      klasse: i + 1, einschulung: e, geburt: e - 6,
      n: s.jahrgang[String(e)] || 0,
      anspruch: i < st.jahrgaenge
    });
  }

  $('#blatt-host').innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-title">${esc(s.name)} <span class="dot ${r.ampel}" style="margin-left:6px"></span><span style="font-size:.8rem;font-weight:400;color:var(--neutral-500)">${AMPEL_TEXT[r.ampel]}</span></div>
      <div class="card-sub">Schulnummer ${s.nr} · ${esc(s.strasse)}, ${s.plz} Krefeld · Ausbaustufe ${st.id} (${st.klassen})</div>
      <dl class="sheet-kv">
        <dt>Stadtbezirk (politisch)</dt><dd>${esc(bezirk ? bezirk.name : '—')}</dd>
        <dt>Stadtteil (statistisch)</dt><dd>${esc(teil ? teil.name : '—')}</dd>
        <dt>statistischer Bezirk</dt><dd>${esc(statName)} (${s.statbezirk})</dd>
        <dt>Trägerschaft</dt><dd>${s.rechtsform === 'privat' ? 'privat' : 'öffentlich'}</dd>
        <dt>Schüler:innen (MSB, ${DATA.meta.schuljahrBasis})</dt><dd>${fmtInt(s.schueler)}</dd>
        <dt>Sozialindexstufe Land${infoIcon('sozialindex')}</dt><dd>${s.sozialindex === 'ohne' ? 'ohne' : s.sozialindex + ' von 9'}</dd>
      </dl>
    </div>

    <div class="grid g4" style="margin-bottom:var(--sp-4)">
      ${[
        { k: 'Platzbedarf', v: fmtInt(r.bedarf), d: st.klassen, cls: 'ink', info: 'bedarf' },
        { k: 'Davon Rechtsanspruch', v: fmtInt(r.bedarfAnspruch), d: `${fmtPct0(r.bedarfAnspruch / r.bedarf * 100)} des Bedarfs`, info: 'bedarfAnspruch' },
        { k: 'Plätze (Modell)', v: fmtInt(r.kap), d: 'Verteilung = Annahme', cls: 'petrol', info: 'kapAnteil' },
        { k: 'Offene Plätze', v: fmtInt(r.luecke), d: `Deckungsgrad ${fmtPct0(r.deckung * 100)}`, info: 'luecke' }
      ].map(c => `<div class="stat${c.cls ? ' ' + c.cls : ''}"><div class="k">${c.k}${infoIcon(c.info)}</div><div class="v">${c.v}</div><div class="d">${c.d}</div></div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="card-title">Rechenweg${infoIcon('kohorte')}</div>
      <div class="card-sub">jede Zeile nachvollziehbar aus den Quellen unten</div>
      <div class="table-wrap" style="box-shadow:none;border:1px solid var(--neutral-200)">
        <table><thead><tr><th>Klasse</th><th class="num">Einschulung</th><th class="num">Geburtsjahr</th><th class="num">Kinder</th><th>Quote</th><th class="num">Platzbedarf</th></tr></thead>
        <tbody>${jgZeilen.map(z => `<tr>
          <td>Klasse ${z.klasse}${z.anspruch ? ' <span class="pill ok">Anspruch</span>' : ''}</td>
          <td class="num">${z.einschulung}/${String(z.einschulung + 1).slice(2)}</td>
          <td class="num">${z.geburt}</td>
          <td class="num">${nf1.format(z.n)}</td>
          <td>${fmtPct(z.anspruch ? q.anspruch : q.bestand)}</td>
          <td class="num">${fmtInt(z.n * (z.anspruch ? q.anspruch : q.bestand) / 100)}</td></tr>`).join('')}
        <tr><td colspan="5"><b>Platzbedarf gesamt</b></td><td class="num"><b>${fmtInt(r.bedarf)}</b></td></tr></tbody></table>
      </div>
      <div class="calc">Kapazität = stadtweite Plätze ${st.id} (${fmtInt(plaetzeStadt(st.jahr))}) × Anteil des Standorts (${nf1.format(s.kapAnteil * 1000) } ‰) = ${fmtInt(r.kap)}
Anteil = Schüler:innen (${fmtInt(s.schueler)}) × OGS-Quote Sozialindex (${fmtPct(DATA.ogsQuoteJeGsi[s.gsi])}) ÷ Summe über alle ${DATA.schulen.length} Standorte
Offene Plätze = max(0; Platzbedarf ${fmtInt(r.bedarf)} − Kapazität ${fmtInt(r.kap)}) = ${fmtInt(r.luecke)}
Deckungsgrad = Kapazität ÷ Platzbedarf = ${fmtPct(r.deckung * 100)}</div>
      ${mensaHier.length ? `<p class="note"><b>Küchen- und Mensa-Maßnahme:</b> ${mensaHier.map(m => `Paket ${m.paket}, wirksam ab ${m.wirksamAb} (${esc(m.standort)})`).join('; ')}. Quelle: OGS-Bericht 2026, Vorlage 6283/24.</p>` : ''}
    </div>

    <div class="card">
      <div class="card-title">Herkunftsnachweis</div>
      <div class="card-sub">Quelle, Stand und Rechenweg je Kennzahl</div>
      <dl class="sheet-kv">
        <dt>Standort und Koordinate</dt><dd>Schulverzeichnis NRW, EPSG:25832 → WGS84</dd>
        <dt>Schüler:innenzahl</dt><dd>MSB NRW, Schuljahr ${DATA.meta.schuljahrBasis}</dd>
        <dt>Sozialindexstufe</dt><dd>MSB NRW, Schulliste 2025/26</dd>
        <dt>Jahrgangsstärken</dt><dd>Melderegister Krefeld, ${DATA.meta.stichtagBev}</dd>
        <dt>Wanderungsrate</dt><dd>gemessen, Reihe 2012–2024 (${fmtPct(K.wanderungsratePct)}/Jahr)</dd>
        <dt>Stadtweite Platzzahl</dt><dd>OGS-Bericht 2026, Tabelle 4-1</dd>
        <dt>OGS-Quoten je Sozialindex</dt><dd>OGS-Bericht 2026, Abb. 4-1</dd>
        <dt>Inanspruchnahmequote</dt><dd>Elternbefragung der Stadt, Juni 2024</dd>
        <dt>Gebietszuordnung</dt><dd>amtliche Gebietsgliederung der Stadt Krefeld</dd>
        <dt>OGS-Bericht, Fassung</dt><dd>SHA-256 ${DATA.meta.ogsBerichtSha}… (${DATA.meta.ogsBerichtStand})</dd>
      </dl>
      <p class="note"><b>Was dieses Blatt nicht leisten kann.</b> Die Platzzahl je einzelner
        Schule veröffentlicht die Stadt nicht — sie wird hier aus der stadtweiten Zahl
        abgeleitet und ist eine <span class="assumption">Demo-Annahme</span>. Ebenso fehlen
        Schuleinzugsbereiche und jahrgangsscharfe Geburtszahlen je Bezirk. Genau diese drei
        Größen liegen dem Fachbereich vor; mit ihnen wird aus dem Blatt eine prüffähige
        Anlage zur Fortschreibung des OGS-Berichts.</p>
      <ul class="source-list">
        ${Object.keys(SRC_LABEL).map(k => `<li><a href="${SRC_LABEL[k].u}" target="_blank" rel="noopener">${esc(SRC_LABEL[k].t)}</a></li>`).join('')}
      </ul>
    </div>`;
}

/* ====================================================================
   INIT
   ==================================================================== */
function renderAll() {
  buildMetricInfo();
  mountControls();
  renderOverview();
  renderKarte();
  renderBezirke();
  renderSzenarien();
  renderRechner();
  renderBlatt();
}

$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
renderLegalBanner();
renderAll();
window.addEventListener('resize', hideTip);
