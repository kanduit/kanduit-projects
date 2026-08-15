/* =========================================================================
   Kanduit Schulinvestitions-Monitor Duisburg — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-/Vergabe-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_SCHULINVESTITIONS;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- formatting (de-DE) ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => nf.format(Math.round(v));
const fmtMio = v => nf1.format(v / 1e6) + ' Mio €';
const fmtTsd = v => nf.format(Math.round(v / 1000)) + ' T€';
const fmtVal = v => v == null ? '—' : (v >= 1e6 ? fmtMio(v) : fmtTsd(v));
const fmtDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const MONTH_SHORT = { '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez' };
const fmtMonth = m => MONTH_SHORT[m.slice(5, 7)] + ' ' + m.slice(2, 4);

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview: 'view-overview', karte: 'view-karte', register: 'view-register', modell: 'view-modell', eigenanteil: 'view-eigenanteil', szenarien: 'view-szenarien' };
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

const fmtEur = v => nf.format(Math.round(v)) + ' €';
const fmtPct = v => nf1.format(v * 100) + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ====================================================================
   DEMO-ANNAHMEN — aus generate.py übernommen, Wortlaut unverändert.
   Jede angenommene Größe trägt in der Oberfläche ein ◈ mit diesem Text.
   ==================================================================== */
const ANNAHME = {};
DATA.annahmen.forEach(a => { ANNAHME[a.k] = a; });

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
   METRIC DEFINITIONS — Klartext-Glossar für die ⓘ-Tooltips.
   Jeder Eintrag benennt die Berechnung UND die Datenlücke.
   ==================================================================== */
const S = DATA.stadt, B = DATA.budget, GZ = DATA.ganztag;
const SCHULEN = DATA.schulen;
const PRIV = SCHULEN.filter(s => s.priv).length;
const BEZ_NAME = {}; DATA.bezirke.forEach(b => { BEZ_NAME[b.nr] = b.name; });

const METRIC_INFO = {
  standorte: {
    t: 'Schulstandorte in Trägerschaft',
    d: `Alle ${fmtInt(S.schulen)} Schulen mit aktivem Schulbetrieb im Duisburger
Schulverzeichnis des MSB (Gemeindeschlüssel 05112000), Schuljahr ${DATA.meta.schuljahr}.
Nicht enthalten sind Schulamt, ZfsL und Lehrerseminare — die stehen unter denselben
Schlüsseln im Register, sind aber keine Schulen. ${fmtInt(PRIV)} Standorte sind in
privater Trägerschaft und damit nicht in städtischer Baulast; sie bleiben in der Liste,
weil sie für die Schulentwicklungsplanung nach § 80 SchulG zählen — im Register sind
sie als „privat“ gekennzeichnet.`,
  },
  schueler: {
    t: 'Schülerinnen und Schüler',
    d: `Summe der Schülerzahlen je Schule aus der MSB-Datei anzahlen.csv,
Schuljahr ${DATA.meta.schuljahr}. Aggregat je Schule — keine personenbezogenen Daten,
keine Jahrgangsaufteilung. Der Schulträger erhält nach § 120 SchulG NRW ohnehin keine
personenbezogenen Schülerdaten, und dieser Monitor braucht sie nicht.`,
  },
  startchancen: {
    t: 'Startchancen-Schulen',
    d: `${fmtInt(S.sc)} Duisburger Schulen stehen auf der bestätigten Teilnehmerliste
des Landes (Gesamtliste beider Aufnahmegruppen, Stand ${DATA.meta.standListe}) — das sind
${nf1.format(S.sc / B.nrwSchulen * 100)} % aller ${fmtInt(B.nrwSchulen)} Startchancen-Schulen
in NRW bei rund 2,7 % der nordrhein-westfälischen Bevölkerung. Die Auswahl trifft das Land
über den Sozialindex; kommunalen Gestaltungsspielraum gibt es dabei nicht.
Verknüpft wird über die Schulnummer, nicht über den Namen — die Teilnehmerliste lässt
bei Förderschulen den Förderschwerpunkt weg.`,
  },
  budget: {
    t: 'Schulträgerbudget Säule I',
    d: `${fmtEur(B.foerder)} Förderbetrag für die Stadt Duisburg im Investitionsprogramm
Säule I des Startchancen-Programms, Laufzeit ${B.von} bis ${B.bis}. Veröffentlicht vom
Schulministerium (Stand ${DATA.meta.standBudget}); NRW-Gesamtsumme ${fmtMio(B.landessumme)}.
Duisburg trägt damit ${nf1.format(B.foerder / B.landessumme * 100)} % der Landessumme.
Bei ${fmtPct(B.quote)} Förderquote entspricht das rund ${fmtMio(B.gesamt)} Gesamtvolumen,
davon mindestens ${fmtMio(B.eigen)} kommunaler Eigenanteil. Wie sich das Budget auf die
einzelnen Standorte verteilt, sagt die Quelle nicht — das ist Demo-Annahme.`,
  },
  luecke: {
    t: 'Zusätzlicher Platzbedarf bis ' + S.prognoseJahr,
    d: `Fortschreibung der echten MSB-Zeitreihe: für jede Schulform wird die
Duisburger Entwicklung ${S.refJahr}→${S.basisJahr} jährlich gemittelt und bis
${S.prognoseJahr} verlängert, gedeckelt auf ±25 %. Angewandt auf die heutige Belegung
jeder Schule ergibt das ${fmtInt(S.lue)} zusätzlich unterzubringende Plätze.
Zwei Grenzen: die genehmigte Zügigkeit je Standort liegt nicht offen vor, Bezugsgröße
ist deshalb die heutige Belegung; und für Hauptschule, Sekundarschule und Freie
Waldorfschule wird gar nicht fortgeschrieben, weil deren Zahlen Umbau- und
Auslaufentscheidungen folgen, nicht der Demografie.`,
  },
  reihe: {
    t: 'Schülerzahlen Duisburg 2012–' + S.basisJahr,
    d: `Alle Schulformen, öffentliche und private Trägerschaft, aus der MSB-Zeitreihe
nach Kreis (Krfr. Stadt Duisburg). Die Kurve zeigt den Wendepunkt: bis 2015 fallend,
seither steigend, ${S.basisJahr} wieder auf dem Stand von 2012. Genau die Lage, die die
Stabsstelle Schulentwicklungsplanung auf ihrer eigenen Aufgabenseite beschreibt.`,
  },
  formen: {
    t: 'Entwicklung je Schulform',
    d: `Veränderung der Schülerzahl ${S.refJahr}→${S.basisJahr} je Schulform in Duisburg,
aus der MSB-Zeitreihe. Hauptschule und Sekundarschule sind grau gesetzt: ihre Rückgänge
sind strukturell (Umbau der Schullandschaft), keine demografische Aussage — sie in eine
Bedarfsprognose zu übernehmen wäre falsch.`,
  },
  straenge: {
    t: 'Die drei Bedarfsstränge',
    d: `Der Kern des Monitors. Heute werden Sanierungsbedarf, Startchancen-Maßnahmen und
Ganztags-Raumbedarf in drei getrennten Listen geführt, obwohl sie um dieselben Standorte
und dieselben Haushaltsmittel konkurrieren. Nur der Startchancen-Strang ist in einer
veröffentlichten Summe verankert (${fmtMio(B.gesamt)}); Sanierung und Ganztag sind
Demo-Annahmen. Förderfähig ist ausschließlich der Startchancen-Strang — Sanierung und
Ganztag trägt die Stadt vollständig selbst.`,
  },
  bezirke: {
    t: 'Standorte je Stadtbezirk',
    d: `Zuordnung über Punkt-in-Polygon: die UTM32-Koordinate jeder Schule aus dem
Schulverzeichnis gegen die amtlichen Stadtbezirksgrenzen der Stadt Duisburg.
Alle ${fmtInt(S.schulen)} Standorte liegen eindeutig in genau einem der ${S.bezirke} Bezirke.`,
  },
  sozialindex: {
    t: 'Sozialindexstufe des Landes',
    d: `Neunstufige Sozialindexstufe NRW je Schule (1 = geringste, 9 = höchste Belastung),
aus der MSB-Schulliste ${DATA.meta.schuljahr}. Sie liegt nur für allgemeinbildende Schulen
vor: ${fmtInt(S.ohneSoz)} der ${fmtInt(S.schulen)} Duisburger Standorte — im Wesentlichen
Berufskollegs — haben keine Stufe. Diese Standorte gehen im Prioritätsmodell mit einem
neutralen Mittelwert ein und werden dadurch weder bevorzugt noch benachteiligt.`,
  },
  zustand: {
    t: 'Zustandsnote 1–5',
    d: `◈ Demo-Annahme, keine Amtsdaten. Ein Zustandsregister der Duisburger Schulgebäude
ist nicht öffentlich. Das Schulbetriebsdatum wäre ein naheliegender Ersatz, taugt aber
nicht: es steht für 101 der ${fmtInt(S.schulen)} Standorte auf 1973, dem Aufbau des
Registers, nicht auf einem Baujahr. Die Note wird deshalb deterministisch aus der
Schulnummer gezogen — reproduzierbar, aber fachlich bedeutungslos. Im Projekt durch die
Zustandsdaten des Amtes oder des Immobilienmanagements zu ersetzen.`,
  },
  ganztagBedarf: {
    t: 'Ganztags-Platzbedarf aus dem Rechtsanspruch',
    d: `§ 24 Abs. 4 SGB VIII gilt seit 01.08.2026, aufwachsend über vier Ausbaustufen bis
zum Schuljahr 2029/30. Bei voller Stufe und ${fmtPct(GZ.quote)} angenommener Inanspruchnahme
ergeben sich ${fmtInt(GZ.gesamt)} Plätze an den ${fmtInt(S.grundschulen)} Duisburger
Grundschulen. Die Schülerzahlen sind echt, Quote und Gleichverteilung über vier Jahrgänge
sind Annahmen. Wichtig: der heutige OGS-Bestand je Standort ist nicht öffentlich — das
hier ist der Bedarf aus dem Rechtsanspruch, nicht die Lücke gegenüber dem Bestand.`,
  },
  volumen: {
    t: 'Maßnahmenvolumen gesamt',
    d: `Summe der drei Stränge: ${fmtMio(S.vSc)} Startchancen (förderfähig),
${fmtMio(S.vSan)} Sanierung an ${fmtInt(S.sanStandorte)} Standorten und ${fmtMio(S.vGz)}
Ganztag. Nur die Startchancen-Summe ist in einer veröffentlichten Quelle verankert; die
Verteilung auf Standorte und die beiden anderen Stränge sind Demo-Annahmen. Die Zahl ist
als Größenordnung zu lesen, nicht als Kostenschätzung.`,
  },
  eigenanteil: {
    t: 'Kommunaler Eigenanteil',
    d: `${fmtMio(S.eig)} von ${fmtMio(S.vol)} Gesamtvolumen bleiben bei der Stadt:
${fmtMio(S.vSc - S.foe)} als Eigenanteil zu den Startchancen-Maßnahmen (mindestens
${fmtPct(1 - B.quote)} laut Förderrichtlinie) plus ${fmtMio(S.vSan + S.vGz)} für Sanierung
und Ganztag, die aus Säule I gar nicht förderfähig sind. Genau diese Unterscheidung
entscheidet über die Haushaltsplanung — und sie geht in einer gemeinsamen Maßnahmenliste
regelmäßig verloren.`,
  },
  score: {
    t: 'Prioritätswert 0–100',
    d: `Gewichteter Mittelwert aus vier normierten Kriterien: Bauzustand (Note 1–5 → 0–1),
Sozialindexstufe (1–9 → 0–1, ohne Stufe = 0,5), Kapazitätslücke (relativ zum größten Wert
im Feld) und Förderfähigkeit (Startchancen-Schule = 1, sonst 0). Die Gewichte sind frei
einstellbar und stehen jederzeit als Text unter den Reglern — genau das ist der Punkt:
wenn ein Ausschuss fragt, warum Standort A vor Standort B liegt, ist der Rechenweg
ablesbar. Das Modell ersetzt keine fachliche Entscheidung, es macht sie begründbar.`,
  },
  zeitachse: {
    t: 'Eigenanteil je Haushaltsjahr',
    d: `Die Maßnahmen werden in der Reihenfolge des Prioritätsmodells in die Jahre
${B.planjahre[0]} bis ${B.planjahre[B.planjahre.length - 1]} eingeplant; jede Maßnahme
fällt vollständig in ein Jahr und nur dann, wenn der jährliche Eigenanteils-Deckel sie
noch trägt. Was nicht mehr hineinpasst, erscheint als Überhang. Die Programmlaufzeit
${B.von}–${B.bis} ist echt; der Einplanungsalgorithmus und der Deckel sind Demo-Annahmen —
in der Praxis entscheiden Bauabläufe, Vergabefristen und die Kämmerei mit.`,
  },
  deckel: {
    t: 'Eigenanteils-Deckel',
    d: `Der maximal verfügbare kommunale Eigenanteil je Haushaltsjahr, frei einstellbar.
Er wirkt als Nebenbedingung: Maßnahmen werden nur eingeplant, solange das Jahresbudget
reicht. Ohne Deckel läge der rechnerische Durchschnitt bei ${fmtMio(S.eig / B.planjahre.length)}
pro Jahr. Ein realistischer Wert ergibt sich erst aus der mittelfristigen Finanzplanung
der Stadt — die ist hier nicht hinterlegt.`,
  },
  ueberhang: {
    t: 'Überhang',
    d: `Volumen, das der eingestellte Deckel bis ${B.planjahre[B.planjahre.length - 1]}
nicht mehr aufnimmt. Es verschwindet nicht, es verschiebt sich — beim Startchancen-Strang
mit der harten Nebenbedingung, dass Säule I ${B.bis} endet: was bis dahin nicht abgerufen
ist, ist Fördergeld, das die Stadt nicht bekommt.`,
  },
  ganztagRang: {
    t: 'Rangdifferenz Ganztag gegen Bauzustand',
    d: `Vergleich zweier Ranglisten über dieselben Standorte: einmal ausschließlich nach
Ganztags-Raumbedarf sortiert, einmal ausschließlich nach Bauzustand. Die Differenzspalte
zeigt, wie weit ein Standort zwischen beiden Sichten springt. Große Sprünge sind die
interessanten Fälle — dort widersprechen sich zwei berechtigte Prioritäten, und genau
dort braucht eine Ausschussvorlage eine Begründung.`,
  },
  verzoegerung: {
    t: 'Wirkung einer Verzögerung um ein Jahr',
    d: `Das nach Priorität führende Maßnahmenpaket wird um ein Haushaltsjahr nach hinten
geschoben, alles andere bleibt gleich. Gezeigt werden die drei Größen, die dabei
auseinanderlaufen: der Fördermittelabruf innerhalb der Laufzeit bis ${B.bis}, das
Eigenanteilsprofil der Folgejahre und die Kapazitätslücke, die währenddessen offen bleibt.
Die Verschiebung selbst ist eine Modellannahme — reale Verzögerungen treffen selten ein
ganzes Paket gleichzeitig. Und die Einplanung arbeitet nach dem einfachen Prinzip
„erstes Jahr, in das die Maßnahme noch passt“. Das kann dazu führen, dass eine
Verschiebung den Förderabruf rechnerisch sogar leicht erhöht, weil kleinere Maßnahmen in
die frei gewordenen Jahresbudgets rutschen. Das ist ein Artefakt des Verfahrens, keine
Aussage über die Wirklichkeit — im Projekt tritt an diese Stelle die tatsächliche
Maßnahmen- und Bauablaufplanung des Amtes.`,
  },
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
   PRIORITÄTSMODELL — geteilter Zustand über Register, Modell, Eigenanteil
   und Szenarien. Jede Gewichtsänderung rechnet alle abhängigen Ansichten neu.
   ==================================================================== */
const KRIT = [
  { k: 'zustand', t: 'Bauzustand', h: 'Note 1–5, ◈ Demo-Annahme' },
  { k: 'sozial', t: 'Sozialindexstufe', h: 'Stufe 1–9 des Landes, ohne Stufe = neutral' },
  { k: 'luecke', t: 'Kapazitätslücke', h: 'zusätzlicher Bedarf bis ' + S.prognoseJahr },
  { k: 'foerder', t: 'Förderfähigkeit', h: 'Startchancen-Schule ja/nein' },
];
const W = { zustand: 30, sozial: 25, luecke: 25, foerder: 20 };
const MAX_LUE = Math.max(...SCHULEN.map(s => s.lue), 1);

function kriterien(s) {
  return {
    zustand: (s.z - 1) / 4,
    sozial: s.soz == null ? 0.5 : (s.soz - 1) / 8,
    luecke: s.lue / MAX_LUE,
    foerder: s.sc ? 1 : 0,
  };
}
function scoreOf(s, w) {
  w = w || W;
  const c = kriterien(s);
  const sum = KRIT.reduce((a, k) => a + w[k.k], 0) || 1;
  return KRIT.reduce((a, k) => a + w[k.k] * c[k.k], 0) / sum * 100;
}
/** Standorte nach Prioritätswert, absteigend; Schulnummer als stabiler Tiebreak. */
function ranked(w) {
  return SCHULEN.map(s => ({ s, sc: scoreOf(s, w) }))
    .sort((a, b) => b.sc - a.sc || (a.s.id < b.s.id ? -1 : 1))
    .map((r, i) => ({ ...r, rang: i + 1 }));
}
function weightText(w) {
  w = w || W;
  const sum = KRIT.reduce((a, k) => a + w[k.k], 0) || 1;
  return KRIT.map(k => `${k.t} ${nf1.format(w[k.k] / sum * 100)} %`).join(' · ');
}

/** Greedy-Einplanung in Haushaltsjahre unter einem jährlichen Eigenanteils-Deckel. */
function planen(liste, deckel, startIndex) {
  const jahre = B.planjahre;
  const belegt = jahre.map(() => 0);
  const zuteilung = [];
  let ueberhang = 0, ueberhangN = 0;
  liste.forEach(r => {
    const von = startIndex ? startIndex(r) : 0;
    let platziert = -1;
    for (let i = von; i < jahre.length; i++) {
      if (belegt[i] + r.s.eig <= deckel) { belegt[i] += r.s.eig; platziert = i; break; }
    }
    if (platziert < 0) { ueberhang += r.s.eig; ueberhangN++; }
    zuteilung.push({ ...r, jahr: platziert < 0 ? null : jahre[platziert] });
  });
  return { jahre, belegt, zuteilung, ueberhang, ueberhangN };
}

/* Ampelfarbe nach Prioritätsrang (Quintile). */
const RANG_FARBE = ['#c24b57', '#d97a2b', '#c9931f', '#1fa2c4', '#2f8f6b'];
const RANG_LABEL = ['sehr hoch', 'hoch', 'mittel', 'nachrangig', 'gering'];
function rangKlasse(rang, n) { return Math.min(4, Math.floor((rang - 1) / (n / 5))); }

/* ====================================================================
   KENNZAHLENBLATT (Drawer) — Ansicht 5 des Briefs, druckbar,
   jede Zahl mit Quelle, Stand und Rechenweg.
   ==================================================================== */
const drawer = $('#drawer'), drawerBack = $('#drawer-back');
function closeDrawer() { drawer.classList.remove('show'); drawerBack.classList.remove('show'); }
drawerBack.addEventListener('click', closeDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function openBlatt(id) {
  const r = ranked(W).find(x => x.s.id === id);
  if (!r) return;
  const s = r.s, c = kriterien(s), n = SCHULEN.length;
  const kl = rangKlasse(r.rang, n);
  const zeile = (k, v, src) =>
    `<div class="kv"><span class="kk">${k}</span><span class="vv">${v}</span>` +
    (src ? `<span class="src">${src}</span>` : '') + `</div>`;

  $('#drawer-title').innerHTML = esc(s.n);
  $('#drawer-sub').textContent = `${s.f} · Schulnummer ${s.id}`;
  $('#drawer-body').innerHTML = `
    <div class="banner ${s.sc ? 'info' : 'warn'}" style="margin-bottom:var(--sp-4)">
      <b>Prioritätsrang ${r.rang} von ${n}</b> — Wert ${nf1.format(r.sc)} von 100
      (${RANG_LABEL[kl]}).<br>Gewichtung dieser Rechnung: ${weightText(W)}.
      ${s.sc ? 'Startchancen-Schule: Maßnahmen sind zu ' + fmtPct(B.quote) + ' förderfähig.'
             : 'Keine Startchancen-Schule: Maßnahmen sind aus Säule I nicht förderfähig.'}
    </div>

    <div class="dsec">Standort</div>
    ${zeile('Stadtbezirk', esc(BEZ_NAME[s.b] || '—'),
      'Punkt-in-Polygon der UTM32-Koordinate gegen die amtlichen Stadtbezirksgrenzen der Stadt Duisburg.')}
    ${zeile('Trägerschaft', s.priv ? 'privat' : 'öffentlich',
      'Rechtsform laut Schulverzeichnis MSB NRW, Schuljahr ' + DATA.meta.schuljahr + '.')}
    ${zeile('Schülerinnen und Schüler', fmtInt(s.sch),
      'MSB Open Data, anzahlen.csv, Schuljahr ' + DATA.meta.schuljahr +
      '. Aggregat je Schule, keine personenbezogenen Daten.')}
    ${zeile('Sozialindexstufe', s.soz == null ? 'keine Stufe' : s.soz + ' von 9',
      s.soz == null
        ? 'Für diese Schulform veröffentlicht das Land keine Sozialindexstufe. Im Modell mit dem neutralen Mittelwert 0,5 angesetzt.'
        : 'MSB-Schulliste ' + DATA.meta.schuljahr + ', neunstufige Sozialindexstufe NRW (1 = geringste, 9 = höchste Belastung).')}

    <div class="dsec">Bedarf</div>
    ${zeile('Zustandsnote' + assumeMark('zustand'), s.z + ' von 5',
      '◈ Demo-Annahme, deterministisch aus der Schulnummer. Kein Amtsdatum — im Projekt zu ersetzen.')}
    ${zeile('Prognose ' + S.prognoseJahr, s.prog == null ? 'nicht fortgeschrieben' : fmtInt(s.prog),
      s.prog == null
        ? 'Schulform im Umbau bzw. Auslaufen — eine Trendfortschreibung wäre hier irreführend.'
        : 'Heutige Belegung × Trend der Schulform ' + S.refJahr + '→' + S.basisJahr +
          ' (MSB-Zeitreihe), fortgeschrieben bis ' + S.prognoseJahr + ', gedeckelt auf ±25 %.')}
    ${zeile('Kapazitätslücke', s.lue ? '+' + fmtInt(s.lue) + ' Plätze' : 'keine',
      'Prognose minus heutige Belegung, negative Werte als 0. Die genehmigte Zügigkeit liegt nicht offen vor.')}
    ${s.gz ? zeile('Ganztags-Platzbedarf' + assumeMark('ganztag'), fmtInt(s.gz) + ' Plätze',
      'Volle Ausbaustufe 2029/30 bei ' + fmtPct(GZ.quote) + ' angenommener Inanspruchnahme. ' +
      'Bedarf aus dem Rechtsanspruch, nicht Lücke gegenüber dem heutigen OGS-Bestand — der ist nicht öffentlich.') : ''}

    <div class="dsec">Maßnahmenvolumen</div>
    ${zeile('Startchancen Säule I', s.vSc ? fmtEur(s.vSc) : '—',
      s.vSc ? 'Anteil am Duisburger Schulträgerbudget von ' + fmtEur(B.foerder) +
              ' Förderbetrag (= ' + fmtMio(B.gesamt) + ' Gesamtvolumen bei ' + fmtPct(B.quote) +
              '). Die Summe ist veröffentlicht, ◈ die Verteilung auf Standorte ist Demo-Annahme.'
            : 'Nicht im Startchancen-Programm.')}
    ${zeile('Sanierung' + (s.vSan ? assumeMark('volumen') : ''), s.vSan ? fmtEur(s.vSan) : '—',
      s.vSan ? '◈ Demo-Annahme: Schülerzahl × Stufen über Note 2 × 900 €. Nicht förderfähig.'
             : 'Zustandsnote unter 3 — im Modell kein Sanierungsvolumen.')}
    ${zeile('Ganztag' + (s.vGz ? assumeMark('volumen') : ''), s.vGz ? fmtEur(s.vGz) : '—',
      s.vGz ? '◈ Demo-Annahme: ' + fmtInt(s.gzNeu) + ' noch zu schaffende Plätze × ' +
              fmtEur(GZ.eurPlatz) + '. Aus Säule I nicht förderfähig.'
            : 'Kein Grundschulstandort — kein Ganztags-Rechtsanspruch nach § 24 Abs. 4 SGB VIII.')}
    ${zeile('<b>Gesamtvolumen</b>', '<b>' + fmtEur(s.vol) + '</b>', '')}
    ${zeile('davon Förderung', s.foe ? '− ' + fmtEur(s.foe) : '—',
      s.foe ? fmtPct(B.quote) + ' des Startchancen-Anteils, Förderrichtlinie Säule I.'
            : 'Keine Förderung aus Säule I.')}
    ${zeile('<b>Kommunaler Eigenanteil</b>', '<b>' + fmtEur(s.eig) + '</b>',
      'Gesamtvolumen minus Förderung. Diese Zahl belastet den städtischen Haushalt.')}

    <div class="dsec">Rechenweg Prioritätswert</div>
    ${KRIT.map(k => zeile(k.t + ' (Gewicht ' + W[k.k] + ')',
      nf1.format(c[k.k] * 100) + ' von 100', '')).join('')}
    ${zeile('<b>Prioritätswert</b>', '<b>' + nf1.format(r.sc) + ' von 100</b>',
      'Gewichteter Mittelwert der vier normierten Kriterien. Gewichte frei einstellbar unter „Priorisierung“.')}

    <p class="note">Stand ${DATA.meta.stand}. Quellen: MSB NRW (Schulverzeichnis,
    Schülerzahlen, Sozialindexstufen, Zeitreihe), Startchancen-Teilnehmerliste und
    Schulträgerbudgets Säule I des Schulministeriums, Stadtbezirke der Stadt Duisburg.
    Mit ◈ markierte Größen sind Demo-Annahmen und im Projekt durch Amtsdaten zu ersetzen.
    Demonstrator der Kanduit UG, kein Produkt der Stadt Duisburg.</p>`;

  drawer.classList.add('show');
  drawerBack.classList.add('show');
  $('#drawer-close').focus();
}

/* ====================================================================
   VIEWS
   ==================================================================== */
function renderOverview() {
  const k = $('#overview-kpis'); k.innerHTML = '';
  [
    { k: 'Schulstandorte', v: fmtInt(S.schulen), d: fmtInt(S.schueler) + ' Schülerinnen und Schüler', info: 'standorte' },
    { k: 'Startchancen-Schulen', v: fmtInt(S.sc), d: nf1.format(S.sc / B.nrwSchulen * 100) + ' % aller ' + fmtInt(B.nrwSchulen) + ' in NRW', cls: 'petrol', info: 'startchancen' },
    { k: 'Schulträgerbudget Säule I', v: fmtMio(B.foerder), d: 'Förderbetrag ' + B.von + '–' + B.bis, cls: 'ink', info: 'budget' },
    { k: 'Zusätzlicher Platzbedarf', v: '+' + fmtInt(S.lue), d: 'bis ' + S.prognoseJahr + ', aus dem echten Trend je Schulform', info: 'luecke' },
  ].forEach(s => k.appendChild(statCard(s)));

  const jahre = DATA.zeitreihe;
  columnChart($('#chart-reihe'), jahre.map(r => ({
    id: r.jahr, label: String(r.jahr).slice(2), n: r.n,
    tip: `<b>${r.jahr}</b><div class="row"><span>Schülerinnen und Schüler</span><span>${fmtInt(r.n)}</span></div>`,
  })), {
    height: 240, labelEvery: 2, color: 'var(--dv-petrol)',
    breaks: [{ at: S.refJahr, label: S.refJahr + ' Trendbasis', dy: 10 }],
  });

  const formen = DATA.formen.filter(f => f.jetzt >= 250);
  barChart($('#chart-formen'), formen.map(f => {
    const d = f.jetzt / f.ref - 1;
    return {
      label: f.name, value: Math.abs(d) * 100,
      valLabel: (d >= 0 ? '+' : '−') + nf1.format(Math.abs(d) * 100) + ' %',
      color: f.auslaufend ? 'var(--neutral-400)' : (d >= 0 ? 'var(--dv-petrol)' : 'var(--dv-orange)'),
      tip: `<b>${f.name}</b><div class="row"><span>${S.refJahr}</span><span>${fmtInt(f.ref)}</span></div>` +
        `<div class="row"><span>${S.basisJahr}</span><span>${fmtInt(f.jetzt)}</span></div>` +
        (f.auslaufend ? `<div class="def">Strukturell bedingt — nicht fortgeschrieben.</div>` : ''),
    };
  }), { padL: 150 });

  const straenge = [
    { label: 'Startchancen Säule I', n: S.vSc, color: 'var(--dv-petrol)' },
    { label: 'Sanierung', n: S.vSan, color: 'var(--dv-orange)' },
    { label: 'Ganztag', n: S.vGz, color: 'var(--dv-violet)' },
  ];
  const mix = $('#chart-straenge'); mix.innerHTML = '';
  mixBar(mix, 'Maßnahmenvolumen gesamt', straenge, fmtMio(S.vol));
  mixBar(mix, 'davon förderfähig (nur Säule I)', [
    { label: 'Förderung Land', n: S.foe, color: 'var(--dv-green)' },
    { label: 'Kommunaler Eigenanteil', n: S.eig, color: 'var(--dv-coral)' },
  ], fmtMio(S.eig) + ' Eigenanteil');
}

function renderKarte() {
  const k = $('#karte-kpis'); k.innerHTML = '';
  const top = [...DATA.bezirke].sort((a, b) => b.sc - a.sc)[0];
  [
    { k: 'Stadtbezirke', v: fmtInt(S.bezirke), d: 'alle ' + fmtInt(S.schulen) + ' Standorte eindeutig zugeordnet', info: 'bezirke' },
    { k: 'Meiste Startchancen-Schulen', v: esc(top.name), d: fmtInt(top.sc) + ' von ' + fmtInt(top.schulen) + ' Standorten im Bezirk', cls: 'petrol', info: 'startchancen' },
    { k: 'Grundschulen', v: fmtInt(S.grundschulen), d: 'mit Ganztags-Rechtsanspruch nach § 24 Abs. 4 SGB VIII', info: 'ganztagBedarf' },
    { k: 'Maßnahmenvolumen', v: fmtMio(S.vol), d: 'drei Stränge zusammengeführt', cls: 'ink', info: 'volumen' },
  ].forEach(s => k.appendChild(statCard(s)));

  /* --- SVG-Karte: äquirektangulär, Längengrad um cos(lat) gestaucht --- */
  const pts = DATA.bezirke.flatMap(b => b.ringe.flat());
  const lon0 = Math.min(...pts.map(p => p[0])), lon1 = Math.max(...pts.map(p => p[0]));
  const lat0 = Math.min(...pts.map(p => p[1])), lat1 = Math.max(...pts.map(p => p[1]));
  /* Duisburg ist deutlich höher als breit — die Karte wird deshalb in eine
     feste Box eingepasst und darin zentriert, sonst wird sie unlesbar lang. */
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
  const PAD = 12, W_ = 640, HMAX = 560;
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
  svg.setAttribute('aria-label',
    `Karte der ${S.schulen} Duisburger Schulstandorte, eingefärbt nach Prioritätsrang`);

  DATA.bezirke.forEach(b => {
    b.ringe.forEach(r => {
      const p = svgEl('path', {
        d: 'M' + r.map(c => px(c[0]).toFixed(1) + ',' + py(c[1]).toFixed(1)).join('L') + 'Z',
        class: 'bez',
      });
      p.addEventListener('mousemove', e => showTip(
        `<b>${esc(b.name)}</b>
         <div class="row"><span>Standorte</span><span>${fmtInt(b.schulen)}</span></div>
         <div class="row"><span>Schülerinnen und Schüler</span><span>${fmtInt(b.sch)}</span></div>
         <div class="row"><span>Startchancen-Schulen</span><span>${fmtInt(b.sc)}</span></div>
         <div class="row"><span>Eigenanteil</span><span>${fmtMio(b.eig)}</span></div>`,
        e.clientX, e.clientY));
      p.addEventListener('mouseleave', hideTip);
      svg.appendChild(p);
    });
  });
  DATA.bezirke.forEach(b => {
    const t = svgEl('text', { x: px(b.mitte[0]).toFixed(1), y: py(b.mitte[1]).toFixed(1), class: 'bez-lbl' });
    t.textContent = b.name;
    svg.appendChild(t);
  });

  const rk = ranked(W), n = rk.length;
  rk.forEach(r => {
    const s = r.s, kl = rangKlasse(r.rang, n);
    const c = svgEl('circle', {
      cx: px(s.lon).toFixed(1), cy: py(s.lat).toFixed(1),
      r: (3.2 + Math.sqrt(s.sch) / 16).toFixed(1),
      fill: RANG_FARBE[kl], class: 'dot' + (s.sc ? ' sc' : ''),
      tabindex: '0', role: 'button',
    });
    const tip = `<b>${esc(s.n)}</b>
      <div class="row"><span>Prioritätsrang</span><span>${r.rang} von ${n}</span></div>
      <div class="row"><span>Schulform</span><span>${esc(s.f)}</span></div>
      <div class="row"><span>Schülerinnen und Schüler</span><span>${fmtInt(s.sch)}</span></div>
      <div class="row"><span>Startchancen</span><span>${s.sc ? 'ja' : 'nein'}</span></div>
      <div class="row"><span>Eigenanteil</span><span>${fmtEur(s.eig)}</span></div>
      <div class="def">Klicken für das Kennzahlenblatt.</div>`;
    c.addEventListener('mousemove', e => showTip(tip, e.clientX, e.clientY));
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('click', () => openBlatt(s.id));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBlatt(s.id); } });
    svg.appendChild(c);
  });

  const box = $('#map'); box.innerHTML = ''; box.appendChild(svg);

  const lg = $('#map-legend'); lg.innerHTML = '';
  RANG_LABEL.forEach((l, i) => lg.appendChild(el('div', 'item',
    `<span class="dotsw" style="background:${RANG_FARBE[i]}"></span>Priorität ${l}`)));
  lg.appendChild(el('div', 'item',
    `<span class="dotsw" style="background:#fff; box-shadow:0 0 0 1.5px var(--ink)"></span>Startchancen-Schule (dunkler Rand)`));
  lg.appendChild(el('div', 'item', '<span style="color:var(--neutral-500)">Punktgröße = Schülerzahl</span>'));

  barChart($('#chart-bezirke'), [...DATA.bezirke].sort((a, b) => b.sch - a.sch).map(b => ({
    label: b.name, value: b.sch, valLabel: fmtInt(b.sch),
    color: 'var(--dv-petrol)',
    tip: `<b>${esc(b.name)}</b>
      <div class="row"><span>Standorte</span><span>${fmtInt(b.schulen)}</span></div>
      <div class="row"><span>Startchancen-Schulen</span><span>${fmtInt(b.sc)}</span></div>
      <div class="row"><span>Kapazitätslücke ${S.prognoseJahr}</span><span>+${fmtInt(b.lue)}</span></div>`,
  })), { padL: 165 });
}

/* ---------------- Standortregister ---------------- */
const COLS = [
  { k: 'rang', t: 'Rang', num: true, v: r => r.rang, c: r => `<span class="rank">${r.rang}</span>` },
  { k: 'name', t: 'Standort', v: r => r.s.n, c: r => esc(r.s.n) + (r.s.priv ? ' <span class="pill">privat</span>' : '') },
  { k: 'form', t: 'Schulform', v: r => r.s.f, c: r => esc(r.s.f) },
  { k: 'bezirk', t: 'Stadtbezirk', v: r => BEZ_NAME[r.s.b] || '', c: r => esc(BEZ_NAME[r.s.b] || '—') },
  { k: 'sch', t: 'Schüler', num: true, v: r => r.s.sch, c: r => fmtInt(r.s.sch) },
  { k: 'soz', t: 'Sozialindex', num: true, v: r => r.s.soz == null ? -1 : r.s.soz, c: r => r.s.soz == null ? '<span style="color:var(--neutral-400)">ohne</span>' : r.s.soz },
  {
    k: 'z', t: 'Zustand ◈', num: true, v: r => r.s.z,
    c: r => `<span class="zbar"><i style="width:${r.s.z / 5 * 100}%; background:${RANG_FARBE[5 - r.s.z]}"></i></span> ${r.s.z}`,
  },
  { k: 'sc', t: 'Startchancen', v: r => r.s.sc ? 1 : 0, c: r => r.s.sc ? '<span class="pill ok">ja</span>' : '<span class="pill">nein</span>' },
  { k: 'lue', t: 'Lücke ' + S.prognoseJahr, num: true, v: r => r.s.lue, c: r => r.s.lue ? '+' + fmtInt(r.s.lue) : '—' },
  { k: 'vol', t: 'Volumen ◈', num: true, v: r => r.s.vol, c: r => fmtVal(r.s.vol) },
  { k: 'eig', t: 'Eigenanteil ◈', num: true, v: r => r.s.eig, c: r => fmtVal(r.s.eig) },
];
let sortK = 'rang', sortDir = 1;

function registerRows() {
  const f = $('#f-form').value, b = $('#f-bezirk').value;
  const q = $('#f-suche').value.trim().toLowerCase();
  const nurSc = $('#f-sc').checked;
  return ranked(W).filter(r =>
    (!f || r.s.f === f) && (!b || r.s.b === b) && (!nurSc || r.s.sc) &&
    (!q || r.s.n.toLowerCase().includes(q) || r.s.id.includes(q)));
}

function renderRegister() {
  const rows = registerRows();
  const col = COLS.find(c => c.k === sortK) || COLS[0];
  rows.sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    const d = typeof x === 'string' ? x.localeCompare(y, 'de') : x - y;
    return (d || (a.rang - b.rang)) * sortDir;
  });

  const k = $('#register-kpis'); k.innerHTML = '';
  const sum = (fn) => rows.reduce((a, r) => a + fn(r.s), 0);
  [
    { k: 'Standorte in der Auswahl', v: fmtInt(rows.length), d: 'von ' + fmtInt(S.schulen) + ' insgesamt', info: 'standorte' },
    { k: 'Schülerinnen und Schüler', v: fmtInt(sum(s => s.sch)), d: 'Aggregat je Schule, Schuljahr ' + DATA.meta.schuljahr, info: 'schueler' },
    { k: 'Maßnahmenvolumen', v: fmtMio(sum(s => s.vol)), d: 'drei Stränge, teils Demo-Annahme', info: 'volumen' },
    { k: 'Kommunaler Eigenanteil', v: fmtMio(sum(s => s.eig)), d: 'nach Abzug der Säule-I-Förderung', cls: 'ink', info: 'eigenanteil' },
  ].forEach(s => k.appendChild(statCard(s)));

  $('#register-table').innerHTML =
    `<table><thead><tr>${COLS.map(c =>
      `<th class="${c.num ? 'num ' : ''}sortable${c.k === sortK ? ' sorted' : ''}" data-k="${c.k}"
        >${c.t}<span class="arrow">${c.k === sortK ? (sortDir > 0 ? '▲' : '▼') : '↕'}</span></th>`).join('')}
    </tr></thead><tbody>${rows.map(r =>
      `<tr class="clickable" data-id="${r.s.id}" tabindex="0">${COLS.map(c =>
        `<td class="${c.num ? 'num' : ''}">${c.c(r)}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;

  $('#register-count').textContent =
    `${fmtInt(rows.length)} Standorte · Gewichtung: ${weightText(W)}`;
}

function csvExport() {
  const rows = registerRows();
  const head = ['Schulnummer', 'Standort', 'Schulform', 'Stadtbezirk', 'Traegerschaft',
    'Schueler', 'Sozialindexstufe', 'Zustandsnote (Demo-Annahme)', 'Startchancen',
    'Kapazitaetsluecke ' + S.prognoseJahr, 'Ganztagsbedarf',
    'Volumen Startchancen EUR', 'Volumen Sanierung EUR (Demo-Annahme)',
    'Volumen Ganztag EUR (Demo-Annahme)', 'Volumen gesamt EUR', 'Foerderung EUR',
    'Eigenanteil EUR', 'Prioritaetsrang', 'Prioritaetswert'];
  const lines = rows.map(r => [r.s.id, r.s.n, r.s.f, BEZ_NAME[r.s.b] || '',
    r.s.priv ? 'privat' : 'oeffentlich', r.s.sch, r.s.soz == null ? '' : r.s.soz, r.s.z,
    r.s.sc ? 'ja' : 'nein', r.s.lue, r.s.gz, r.s.vSc, r.s.vSan, r.s.vGz, r.s.vol,
    r.s.foe, r.s.eig, r.rang, nf1.format(r.sc)]);
  const q = v => /[";\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  const csv = '﻿' + [head, ...lines].map(l => l.map(q).join(';')).join('\r\n') +
    `\r\n\r\n"Kanduit Schulinvestitions-Monitor Duisburg — Demonstrator, kein Produkt der Stadt Duisburg."` +
    `\r\n"Stand ${DATA.meta.stand}. Gewichtung: ${weightText(W)}."` +
    `\r\n"Mit (Demo-Annahme) bezeichnete Spalten sind keine Amtsdaten."\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = el('a'); a.href = url; a.download = 'schulinvestitions-monitor-duisburg.csv';
  a.click(); URL.revokeObjectURL(url);
}

/* ---------------- Priorisierung ---------------- */
function renderModell() {
  const box = $('#sliders');
  if (!box.dataset.built) {
    box.dataset.built = '1';
    box.innerHTML = KRIT.map(k => `
      <div class="slider">
        <div class="head"><span class="nm">${k.t}${k.k === 'zustand' ? assumeMark('zustand') : ''}</span>
          <span class="val" id="w-${k.k}">${W[k.k]}</span></div>
        <input type="range" min="0" max="100" step="5" value="${W[k.k]}" data-w="${k.k}"
          aria-label="Gewicht ${k.t}">
        <span class="hint">${k.h}</span>
      </div>`).join('');
    box.addEventListener('input', e => {
      const t = e.target.dataset.w; if (!t) return;
      W[t] = +e.target.value;
      $('#w-' + t).textContent = W[t];
      renderModell(); renderRegister(); renderKarte(); renderEigenanteil(); renderSzenarien();
    });
    $('#w-reset').addEventListener('click', () => {
      Object.assign(W, { zustand: 30, sozial: 25, luecke: 25, foerder: 20 });
      $$('#sliders input[data-w]').forEach(i => {
        i.value = W[i.dataset.w]; $('#w-' + i.dataset.w).textContent = W[i.dataset.w];
      });
      renderModell(); renderRegister(); renderKarte(); renderEigenanteil(); renderSzenarien();
    });
  }

  const sum = KRIT.reduce((a, k) => a + W[k.k], 0);
  $('#weight-readout').innerHTML = sum === 0
    ? '<b>Alle Gewichte auf 0.</b> Ohne Gewichtung gibt es keine Rangfolge — jeder Standort erhält den Wert 0. Mindestens ein Kriterium muss größer als 0 sein.'
    : `<b>Aktuelle Gewichtung:</b> ${weightText(W)}<br>
       Prioritätswert = (${KRIT.map(k => `${W[k.k]} × ${k.t}`).join(' + ')}) ÷ ${sum},
       Kriterien je auf 0–1 normiert, Ergebnis × 100.`;

  const rk = ranked(W).slice(0, 20), n = SCHULEN.length;
  barChart($('#chart-rangliste'), rk.map(r => ({
    label: (r.rang + '. ' + r.s.n).slice(0, 42),
    value: r.sc, valLabel: nf1.format(r.sc),
    color: RANG_FARBE[rangKlasse(r.rang, n)],
    tip: `<b>${esc(r.s.n)}</b>
      <div class="row"><span>Prioritätswert</span><span>${nf1.format(r.sc)}</span></div>
      ${KRIT.map(k => `<div class="row"><span>${k.t}</span><span>${nf1.format(kriterien(r.s)[k.k] * 100)}</span></div>`).join('')}
      <div class="def">Klicken für das Kennzahlenblatt.</div>`,
  })), { padL: 250, rowH: 26 });

  $('#chart-rangliste').onclick = null;
  $$('#chart-rangliste .bar').forEach((bar, i) => {
    bar.style.cursor = 'pointer';
    bar.addEventListener('click', () => openBlatt(rk[i].s.id));
  });
}

/* ---------------- Eigenanteils-Zeitachse ---------------- */
function deckelWert() { return +$('#deckel').value * 1e6; }

function renderEigenanteil() {
  const deckel = deckelWert();
  $('#deckel-val').textContent = fmtMio(deckel) + ' / Jahr';
  const plan = planen(ranked(W), deckel);

  const k = $('#eigenanteil-kpis'); k.innerHTML = '';
  [
    { k: 'Eigenanteil gesamt', v: fmtMio(S.eig), d: 'von ' + fmtMio(S.vol) + ' Maßnahmenvolumen', info: 'eigenanteil' },
    { k: 'Deckel je Haushaltsjahr', v: fmtMio(deckel), d: 'einstellbar · rechnerischer Schnitt ohne Deckel: ' + fmtMio(S.eig / B.planjahre.length), cls: 'petrol', info: 'deckel' },
    { k: 'Eingeplant bis ' + B.planjahre[B.planjahre.length - 1], v: fmtMio(plan.belegt.reduce((a, b) => a + b, 0)), d: fmtInt(plan.zuteilung.length - plan.ueberhangN) + ' von ' + fmtInt(plan.zuteilung.length) + ' Standorten', info: 'zeitachse' },
    { k: 'Überhang', v: plan.ueberhang ? fmtMio(plan.ueberhang) : '0', d: plan.ueberhangN ? fmtInt(plan.ueberhangN) + ' Standorte passen nicht mehr hinein' : 'alle Maßnahmen passen in die Laufzeit', cls: plan.ueberhang ? 'ink' : '', info: 'ueberhang' },
  ].forEach(s => k.appendChild(statCard(s)));

  columnChart($('#chart-zeitachse'), plan.jahre.map((j, i) => ({
    id: j, label: String(j), n: plan.belegt[i],
    tip: `<b>Haushaltsjahr ${j}</b>
      <div class="row"><span>Eigenanteil</span><span>${fmtEur(plan.belegt[i])}</span></div>
      <div class="row"><span>Deckel</span><span>${fmtEur(deckel)}</span></div>
      <div class="row"><span>Auslastung</span><span>${nf1.format(plan.belegt[i] / deckel * 100)} %</span></div>
      <div class="row"><span>Maßnahmen</span><span>${fmtInt(plan.zuteilung.filter(z => z.jahr === j).length)}</span></div>`,
  })), { height: 260, color: 'var(--dv-coral)', showTotals: false });

  const warn = $('#eigenanteil-warn');
  if (plan.ueberhang) {
    const scUeber = plan.zuteilung.filter(z => z.jahr === null && z.s.sc)
      .reduce((a, z) => a + z.s.foe, 0);
    warn.className = 'banner warn';
    warn.innerHTML = `<b>Bei diesem Deckel bleibt Fördergeld liegen.</b>
      ${fmtMio(plan.ueberhang)} Eigenanteil an ${fmtInt(plan.ueberhangN)} Standorten passen
      bis ${B.planjahre[B.planjahre.length - 1]} nicht mehr in die Jahresbudgets.
      ${scUeber ? `Davon entfallen ${fmtMio(scUeber)} auf Fördermittel aus Säule I — die
      Programmlaufzeit endet ${B.bis}, nicht abgerufene Mittel verfallen.` : ''}
      Den Regler höher zu stellen zeigt, welcher Jahresbetrag nötig wäre.`;
  } else {
    warn.className = 'banner info';
    warn.innerHTML = `<b>Alle Maßnahmen passen in die Laufzeit.</b> Bei ${fmtMio(deckel)}
      je Haushaltsjahr sind alle ${fmtInt(S.schulen)} Standorte bis
      ${B.planjahre[B.planjahre.length - 1]} eingeplant. Die Spitzenlast liegt bei
      ${fmtMio(Math.max(...plan.belegt))} — daran bemisst sich, was die mittelfristige
      Finanzplanung tragen muss.`;
  }
}

/* ---------------- Szenarien ---------------- */
let szenario = 'deckel';
function renderSzenarien() {
  $$('#szenario-seg button').forEach(b => b.classList.toggle('active', b.dataset.s === szenario));
  const box = $('#szenario-body');
  if (szenario === 'deckel') return szDeckel(box);
  if (szenario === 'ganztag') return szGanztag(box);
  return szVerzoegerung(box);
}

function szDeckel(box) {
  const stufen = [10, 15, 20, 25, 30].map(m => {
    const d = m * 1e6, p = planen(ranked(W), d);
    const abruf = p.zuteilung.filter(z => z.jahr !== null).reduce((a, z) => a + z.s.foe, 0);
    return { m, d, p, abruf };
  });
  const best = stufen.find(x => x.p.ueberhang === 0);
  box.innerHTML = `
    <div class="banner info" style="margin-bottom:var(--sp-4)">
      <b>Szenario 1 — „Eigenanteil-Deckel“.</b> Der maximal verfügbare Eigenanteil je
      Haushaltsjahr wirkt als Nebenbedingung. Gefragt ist die Reihenfolge, die den
      abgerufenen Förderbetrag maximiert. Weil Förderung nur am Startchancen-Strang hängt,
      läuft die Antwort darauf hinaus, förderfähige Maßnahmen früh einzuplanen — der Regler
      „Förderfähigkeit“ unter „Priorisierung“ steuert genau das.
      ${best ? `Ab ${fmtMio(best.d)} je Jahr passen alle Maßnahmen in die Laufzeit.`
             : `Selbst bei 30 Mio € je Jahr bleibt ein Überhang.`}
    </div>
    <div class="grid g2">
      <div class="card">
        <div class="card-title">Abgerufener Förderbetrag je Deckel${infoIcon('deckel')}</div>
        <div class="card-sub">Säule I · maximal ${fmtMio(B.foerder)}</div>
        <div id="sz-abruf"></div>
        <p class="note src-note" data-src="budget"></p>
      </div>
      <div class="card">
        <div class="card-title">Überhang je Deckel${infoIcon('ueberhang')}</div>
        <div class="card-sub">Eigenanteil, der bis ${B.planjahre[B.planjahre.length - 1]} nicht eingeplant ist</div>
        <div id="sz-ueber"></div>
        <p class="note src-note" data-src="budget"></p>
      </div>
    </div>`;
  barChart($('#sz-abruf'), stufen.map(x => ({
    label: fmtMio(x.d) + '/Jahr', value: x.abruf, valLabel: fmtMio(x.abruf),
    color: x.abruf >= B.foerder * 0.999 ? 'var(--dv-green)' : 'var(--dv-amber)',
    tip: `<b>Deckel ${fmtMio(x.d)} je Jahr</b>
      <div class="row"><span>Förderabruf</span><span>${fmtEur(x.abruf)}</span></div>
      <div class="row"><span>Anteil am Budget</span><span>${nf1.format(x.abruf / B.foerder * 100)} %</span></div>`,
  })), { padL: 120 });
  barChart($('#sz-ueber'), stufen.map(x => ({
    label: fmtMio(x.d) + '/Jahr', value: x.p.ueberhang, valLabel: x.p.ueberhang ? fmtMio(x.p.ueberhang) : '0',
    color: x.p.ueberhang ? 'var(--dv-coral)' : 'var(--dv-green)',
    tip: `<b>Deckel ${fmtMio(x.d)} je Jahr</b>
      <div class="row"><span>Überhang</span><span>${fmtEur(x.p.ueberhang)}</span></div>
      <div class="row"><span>Standorte</span><span>${fmtInt(x.p.ueberhangN)}</span></div>`,
  })), { padL: 120 });
  verdrahteQuellen();
}

function szGanztag(box) {
  const gs = SCHULEN.filter(s => s.gz > 0);
  const nachGz = [...gs].sort((a, b) => b.gz - a.gz || (a.id < b.id ? -1 : 1));
  const nachZ = [...gs].sort((a, b) => b.z - a.z || b.sch - a.sch || (a.id < b.id ? -1 : 1));
  const rangGz = {}, rangZ = {};
  nachGz.forEach((s, i) => { rangGz[s.id] = i + 1; });
  nachZ.forEach((s, i) => { rangZ[s.id] = i + 1; });
  const rows = nachGz.slice(0, 25).map(s => ({ s, g: rangGz[s.id], z: rangZ[s.id], d: rangZ[s.id] - rangGz[s.id] }));

  box.innerHTML = `
    <div class="banner info" style="margin-bottom:var(--sp-4)">
      <b>Szenario 2 — „Ganztag zuerst“.</b> Zwei Ranglisten über dieselben
      ${fmtInt(gs.length)} Grundschulen: links die Priorisierung nach Ganztags-Raumbedarf,
      rechts die nach Bauzustand. Die Differenzspalte zeigt, wie weit ein Standort zwischen
      beiden Sichten springt. Der Bauzustand ist eine ◈ Demo-Annahme — die Sprünge
      illustrieren die Mechanik, nicht die Duisburger Lage.
    </div>
    <div class="card">
      <div class="card-title">Ganztags-Rangliste gegen Zustands-Rangliste${infoIcon('ganztagRang')}</div>
      <div class="card-sub">25 Standorte mit dem größten Ganztags-Raumbedarf</div>
      <div class="table-wrap" style="margin-top:var(--sp-4)">
        <table><thead><tr>
          <th class="num">Rang Ganztag</th><th>Standort</th><th class="num">Platzbedarf</th>
          <th class="num">Zustand ◈</th><th class="num">Rang Zustand</th><th class="num">Differenz</th>
        </tr></thead><tbody>${rows.map(r => `
          <tr class="clickable" data-id="${r.s.id}" tabindex="0">
            <td class="num"><span class="rank">${r.g}</span></td>
            <td>${esc(r.s.n)}</td>
            <td class="num">${fmtInt(r.s.gz)}</td>
            <td class="num">${r.s.z}</td>
            <td class="num">${r.z}</td>
            <td class="num delta ${r.d > 0 ? 'up' : r.d < 0 ? 'down' : ''}">${r.d > 0 ? '+' + r.d : r.d}</td>
          </tr>`).join('')}</tbody></table>
      </div>
      <p class="note">Positive Differenz: der Standort steht in der Ganztags-Sicht weiter
      vorn als in der Zustands-Sicht. Genau diese Fälle brauchen in einer Ausschussvorlage
      eine Begründung, weil zwei berechtigte Prioritäten auseinanderlaufen.</p>
      <p class="note src-note" data-src="msb"></p>
    </div>`;
  verdrahteQuellen();
}

function szVerzoegerung(box) {
  const deckel = deckelWert();
  const rk = ranked(W);
  const paketN = Math.min(20, rk.length);
  const basis = planen(rk, deckel);
  const spaet = planen(rk, deckel, r => (r.rang <= paketN ? 1 : 0));

  const abruf = p => p.zuteilung.filter(z => z.jahr !== null && z.jahr <= B.bis)
    .reduce((a, z) => a + z.s.foe, 0);
  const luecke = p => p.zuteilung.filter(z => z.jahr === null || z.jahr > 2029)
    .reduce((a, z) => a + z.s.lue, 0);

  /* Bis zu welchem Jahresdeckel kostet eine Verzögerung noch Fördermittel?
     Das ist die eigentliche Antwort — nicht das Balkenpaar. Gesucht ist der
     höchste Deckel im Reglerbereich, bei dem der Abruf noch einbricht. */
  const DMIN = 5, DMAX = 40;
  let schwelle = null;
  for (let m = DMAX; m >= DMIN; m--) {
    const d = m * 1e6;
    if (abruf(planen(rk, d, r => (r.rang <= paketN ? 1 : 0))) < abruf(planen(rk, d))) {
      schwelle = d; break;
    }
  }
  const verlust = abruf(basis) - abruf(spaet);

  box.innerHTML = `
    <div class="banner ${verlust > 0 ? 'warn' : 'info'}" style="margin-bottom:var(--sp-4)">
      <b>Szenario 3 — „Verzögerung um ein Jahr“.</b> Das nach Priorität führende Paket aus
      ${fmtInt(paketN)} Standorten wird um ein Haushaltsjahr nach hinten geschoben, alles
      andere bleibt gleich. Gerechnet wird mit dem unter „Eigenanteil“ eingestellten Deckel
      von ${fmtMio(deckel)} je Jahr.<br>
      ${verlust > 0
        ? `<b>Bei diesem Deckel kostet die Verzögerung ${fmtMio(verlust)} Fördermittel</b> —
           die Maßnahmen rutschen über das Programmende ${B.bis} hinaus.`
        : verlust < 0
          ? `<b>Bei diesem Deckel steigt der Abruf rechnerisch um ${fmtMio(-verlust)}.</b>
             Das ist kein Vorteil der Verzögerung, sondern ein Effekt des Einplanungs­verfahrens:
             wenn ein großes Paket später kommt, passen kleinere förderfähige Maßnahmen früher
             in die Jahresbudgets. Ein reales Bauprogramm verhält sich nicht so — die Zahl zeigt
             die Grenze des Modells, nicht eine Handlungsempfehlung.`
          : `<b>Bei diesem Deckel federt die Laufzeit die Verzögerung ab.</b> Der Fördermittelabruf
             bleibt vollständig; verschoben wird nur die Last zwischen den Haushaltsjahren.`}
      ${schwelle
        ? `Bis zu einem Deckel von ${fmtMio(schwelle)} je Jahr kostet eine Verzögerung
           Fördermittel, darüber federt die Laufzeit sie ab. Dieser Betrag ist die
           eigentliche Zahl für die mittelfristige Finanzplanung — unterhalb davon wird
           ein verlorenes Jahr auch zu verlorenem Fördergeld.`
        : `Im Reglerbereich von ${fmtMio(DMIN * 1e6)} bis ${fmtMio(DMAX * 1e6)} je Jahr
           kostet eine Verzögerung um ein Jahr an keiner Stelle Fördermittel — die Laufzeit
           bis ${B.bis} hat dafür genug Reserve. Kritisch würde erst eine Verzögerung um
           mehrere Jahre oder ein deutlich engerer Haushalt.`}
    </div>
    <div class="grid g3" style="margin-bottom:var(--sp-4)" id="sz-v-kpis"></div>
    <div class="card">
      <div class="card-title">Eigenanteilsprofil: planmäßig gegen verschoben${infoIcon('verzoegerung')}</div>
      <div class="card-sub">Kommunaler Eigenanteil je Haushaltsjahr</div>
      <div id="sz-v-chart"></div>
      <p class="note src-note" data-src="budget"></p>
    </div>`;

  const k = $('#sz-v-kpis');
  const dAbruf = abruf(spaet) - abruf(basis);
  const dLue = luecke(spaet) - luecke(basis);
  [
    {
      k: 'Fördermittelabruf bis ' + B.bis, v: fmtMio(abruf(spaet)),
      d: dAbruf ? (dAbruf < 0 ? '−' : '+') + fmtMio(Math.abs(dAbruf)).replace('-', '') + ' gegenüber planmäßig' : 'unverändert gegenüber planmäßig',
      cls: dAbruf < 0 ? 'ink' : '', info: 'budget',
    },
    {
      k: 'Spitzenlast Eigenanteil', v: fmtMio(Math.max(...spaet.belegt)),
      d: 'planmäßig ' + fmtMio(Math.max(...basis.belegt)), info: 'zeitachse',
    },
    {
      k: 'Lücke an spät eingeplanten Standorten', v: '+' + fmtInt(luecke(spaet)),
      d: dLue ? fmtInt(Math.abs(dLue)) + ' Plätze mehr als planmäßig' : 'unverändert gegenüber planmäßig',
      cls: dLue > 0 ? 'ink' : '', info: 'verzoegerung',
    },
  ].forEach(s => k.appendChild(statCard(s)));

  /* Beide Reihen sollen nebeneinander stehen, nicht gestapelt. Der Kit kann nur
     stapeln — deshalb bekommt er eine unsichtbare Referenzsäule mit dem Maximum
     beider Reihen (davon leitet er Achse und Gitternetz ab), und die beiden
     echten Säulen werden mit genau derselben Skala darüber gezeichnet. */
  const maxV = Math.max(...basis.belegt, ...spaet.belegt, 1);
  columnChart($('#sz-v-chart'), B.planjahre.map((j, i) => ({
    id: j, label: String(j), ref: Math.max(basis.belegt[i], spaet.belegt[i]),
    tip: `<b>Haushaltsjahr ${j}</b>
      <div class="row"><span>planmäßig</span><span>${fmtEur(basis.belegt[i])}</span></div>
      <div class="row"><span>verschoben</span><span>${fmtEur(spaet.belegt[i])}</span></div>
      <div class="row"><span>Differenz</span><span>${(spaet.belegt[i] - basis.belegt[i] >= 0 ? '+' : '−') + fmtEur(Math.abs(spaet.belegt[i] - basis.belegt[i]))}</span></div>`,
  })), {
    height: 260,
    keys: [{ key: 'ref', color: 'transparent' }],
    legend: [{ label: 'planmäßig', color: 'var(--dv-petrol)' },
             { label: 'nach Verschiebung', color: 'var(--dv-coral)' }],
  });
  const svg = $('#sz-v-chart svg');
  if (svg) {
    const H_ = 260, padL = 40, padR = 10, padT = 20, padB = 34, W_ = 620;
    const iw = (W_ - padL - padR) / B.planjahre.length;
    const plot = H_ - padT - padB;
    [[basis.belegt, 'var(--dv-petrol)', 0.14], [spaet.belegt, 'var(--dv-coral)', 0.52]]
      .forEach(([reihe, farbe, off]) => reihe.forEach((v, i) => {
        const h = plot * (v / maxV);
        if (h <= 0) return;
        svg.appendChild(svgEl('rect', {
          x: (padL + i * iw + iw * off).toFixed(1), y: (H_ - padB - h).toFixed(1),
          width: (iw * 0.34).toFixed(1), height: h.toFixed(1),
          rx: 2, fill: farbe, class: 'bar',
        }));
      }));
  }
  verdrahteQuellen();
}

/** Quellenzeilen unter neu erzeugten Karten nachverdrahten. */
function verdrahteQuellen() {
  $$('.src-note').forEach(n => {
    const s = SRC_LABEL[n.dataset.src]; if (!s || n.dataset.done) return;
    n.dataset.done = '1';
    n.innerHTML = `Quelle: <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a> · Abruf ${DATA.meta.stand}`;
  });
}


/* ====================================================================
   INIT
   ==================================================================== */
$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;

/* Filter des Standortregisters aus den Daten füllen */
const formOpts = [...new Set(SCHULEN.map(s => s.f))].sort((a, b) => a.localeCompare(b, 'de'));
$('#f-form').innerHTML = '<option value="">alle Schulformen</option>' +
  formOpts.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
$('#f-bezirk').innerHTML = '<option value="">alle Stadtbezirke</option>' +
  DATA.bezirke.map(b => `<option value="${b.nr}">${esc(b.name)}</option>`).join('');

['#f-form', '#f-bezirk', '#f-sc'].forEach(sel =>
  $(sel).addEventListener('change', renderRegister));
$('#f-suche').addEventListener('input', renderRegister);
$('#csv').addEventListener('click', csvExport);

$('#register-table').addEventListener('click', e => {
  const th = e.target.closest('th.sortable');
  if (th) {
    if (sortK === th.dataset.k) sortDir = -sortDir;
    else { sortK = th.dataset.k; sortDir = th.classList.contains('num') ? -1 : 1; }
    return renderRegister();
  }
  const tr = e.target.closest('tr.clickable');
  if (tr) openBlatt(tr.dataset.id);
});
$('#register-table').addEventListener('keydown', e => {
  const tr = e.target.closest('tr.clickable');
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBlatt(tr.dataset.id); }
});

$('#deckel').addEventListener('input', () => { renderEigenanteil(); renderSzenarien(); });

$('#szenario-seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-s]'); if (!b) return;
  szenario = b.dataset.s; renderSzenarien();
});
$('#szenario-body').addEventListener('click', e => {
  const tr = e.target.closest('tr.clickable'); if (tr) openBlatt(tr.dataset.id);
});
$('#szenario-body').addEventListener('keydown', e => {
  const tr = e.target.closest('tr.clickable');
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBlatt(tr.dataset.id); }
});

/* Register der Demo-Annahmen im Fuß der Überblicksseite */
$('#annahmen-liste').innerHTML = DATA.annahmen.map(a =>
  `<div class="kv"><span class="kk"><b>${esc(a.t)}</b></span><span class="vv"></span>
   <span class="src">${esc(a.d)}</span></div>`).join('');

renderOverview();
renderKarte();
renderRegister();
renderModell();
renderEigenanteil();
renderSzenarien();
verdrahteQuellen();
})();
