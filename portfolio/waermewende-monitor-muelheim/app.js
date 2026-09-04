/* =========================================================================
   Kanduit Wärmewende-Monitor Mülheim — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-/Vergabe-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_WWM;
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
const views = { overview: 'view-overview', indikatoren: 'view-indikatoren', massnahmen: 'view-massnahmen', netze: 'view-netze', fortschritt: 'view-fortschritt', euro: 'view-euro', daten: 'view-daten' };
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
   Jeder Eintrag nennt Berechnung UND Datenlücke.
   ==================================================================== */
const EW = DATA.eckwerte, ES = DATA.eckwerte_seiten, LZ = DATA.leitzahl;
const INV = DATA.investitionen, THG = DATA.thg, GP = THG.gegenprobe;
const S = k => `S. ${ES[k]}`;
const fmtMioD = v => nf1.format(v) + ' Mio €';
/* Immer eine Nachkommastelle — sonst steht „356 kt" neben „294,4 kt" und die
   Gegenprobe-Tabelle liest sich unsauber (gleiche Regel wie bei fmtMio). */
const nfKt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKt = v => nfKt.format(v) + ' kt';

const METRIC_INFO = {
  leitzahl: { t: 'Tempo beim Wärmepumpenzubau', d: `Beide Werte stehen in Tabelle 26
    des Endberichts (S. 130) nebeneinander: Referenzwert rund ${fmtInt(LZ.ist)} neue
    Wärmepumpen pro Jahr, Zielwert rund ${fmtInt(LZ.soll)} pro Jahr. Der Faktor ist der
    Quotient beider Angaben. Es ist eine Untergrenze: Der Zielwert unterstellt, dass die
    Fernwärme parallel ihre rund ${fmtInt(EW.fw_anschluesse_pro_jahr)} Anschlüsse pro Jahr
    schafft — bleibt der Netzausbau zurück, muss der dezentrale Zubau höher liegen.
    Ein Ist-Wert nach dem Ratsbeschluss liegt nicht vor; die Zahl beschreibt die Lücke
    zwischen Referenz und Ziel, nicht den heutigen Erfüllungsstand.` },
  thg_pfad: { t: 'Treibhausgaspfad des Wärmesektors', d: `Emissionen des Wärmesektors je
    Stützjahr aus Tabelle 41 (S. 186), in Kilotonnen CO₂-Äquivalent pro Jahr. Das
    Basisjahr ist kein Kalenderjahr, sondern das klimabereinigte Mittel der Jahre
    ${DATA.meta.basisjahr} (S. 23). Der Pfad ist das Zielszenario der Wärmeplanung,
    keine gemessene Reihe — Ist-Werte entstehen erst mit der jährlichen Fortschreibung der
    Energie- und Treibhausgasbilanz (Endbericht Kapitel 8).` },
  investition: { t: 'Investitionsrahmen bis 2045', d: `Rechnerisches Investitionsvolumen
    des Zielszenarios: ${fmtMioD(INV.gesamt_mio)} netto, Preisstand 2025 (${S('investition_gesamt_mio')}).
    Gegengerechnet sind im Bericht vermiedene Ersatzinvestitionen von
    ${fmtMioD(INV.einsparungen_mio)}. Enthalten sind nur Investitionen — Energiekosten im
    Betrieb und Einsparungen durch Sanierung sind ausdrücklich nicht eingerechnet. Wie viel
    davon die Stadt selbst trägt, weist der Bericht nicht aus.` },
  gebaeudewechsel: { t: 'Gebäude mit neuer Versorgungslösung', d: `Rund
    ${EW.gebaeude_umstellung_anteil_pct} % aller Gebäude, etwa
    ${fmtInt(EW.gebaeude_umstellung_anzahl)} Stück, brauchen bis 2045 eine neue
    Versorgungslösung (${S('gebaeude_umstellung_anzahl')}). Im Mittel sind das über
    ${fmtInt(EW.umstellungen_dezentral_pro_jahr)} dezentrale Umstellungen und
    ${fmtInt(EW.fw_anschluesse_pro_jahr)} Fernwärmeanschlüsse pro Jahr. Als Referenz nennt
    der Bericht rund ${fmtInt(EW.zentralheizungen_referenz_pro_jahr)} neu eingebaute
    Zentralheizungen pro Jahr in den letzten Jahren.` },
  fw_anteil: { t: 'Fernwärmeanteil am Wärmebedarf', d: `Anteil der Fernwärme an der Deckung
    des Wärmebedarfs, Referenz gegen Zielwert aus Tabelle 26 (S. 130). Der Wert bezieht
    sich auf das gesamte Stadtgebiet; die Anteile je Stadtteil liegen im Bericht nur als
    Karte vor und lassen sich daraus nicht als Zahlenreihe entnehmen.` },
  indikatoren: { t: 'Indikatoren der Wärmewende', d: `Alle ${DATA.indikatoren.length}
    Indikatoren aus Tabelle 26 des Endberichts (S. 130), unverändert übernommen, mit
    Referenz- und Zielwert. Was fehlt, ist die dritte Spalte: ein Ist-Wert. Der Wärmeplan
    wurde am ${DATA.meta.ratsbeschluss} beschlossen, eine Fortschreibung der Indikatoren
    ist noch nicht veröffentlicht. Diese Spalte bleibt hier leer, statt geschätzt zu
    werden — sie ist der Kern dessen, was ein laufendes Controlling liefern müsste.` },
  ind_mix: { t: 'Energieträger heute und im Zielszenario', d: `Anteile der Energieträger am
    Wärmebedarf, Referenz gegen Zielwert (Tabelle 26, S. 130). Die Anteile summieren
    sich nicht exakt auf 100 %, weil der Bericht sie einzeln gerundet ausweist und
    kleine Beiträge wie Solarthermie nicht als eigenen Indikator führt.` },
  massnahmen: { t: 'Maßnahmen der Umsetzungsstrategie', d: `Die
    ${DATA.massnahmen.length} Maßnahmen aus Kapitel 6.5 des Endberichts, je Maßnahme ein
    Steckbrief. Übernommen sind die Sachangaben — Strategiefeld, Federführung, Laufzeit,
    Kostenträger, Zahl der Umsetzungsschritte und Erfolgsindikatoren. Der Fließtext der
    Steckbriefe wird nicht wiedergegeben (siehe „Rechte an den Quellen“ unter Daten &
    Methode). Ein Umsetzungsstatus fehlt: Er existiert öffentlich noch nicht.` },
  massnahmen_feld: { t: 'Maßnahmen je Strategiefeld', d: `Verteilung der
    ${DATA.massnahmen.length} Maßnahmen auf die Strategiefelder, die der Bericht an den
    Vorgaben des LANUK NRW ausrichtet. Das Strategiefeld „Energieeffizienz und energetische
    Sanierung“ trägt bewusst keine eigene Maßnahme — der Wärmeplan verweist dort auf das
    Integrierte Klimaschutzkonzept von 2023 (S. 135).` },
  federfuehrung: { t: 'Federführung je Maßnahme', d: `Wer die Maßnahme laut Steckbrief
    leitet. Der weit überwiegende Teil liegt nicht bei der Stadtverwaltung selbst, sondern
    bei den städtischen bzw. beteiligten Unternehmen. Für ein Umsetzungscontrolling heißt
    das: Der Datenfluss muss vertraglich geregelt werden, er entsteht nicht von allein
    innerhalb der Verwaltung.` },
  netz_ef: { t: 'Emissionsfaktoren der Wärmenetze im Basisjahr', d: `Gramm CO₂-Äquivalent
    je Kilowattstunde Wärmeabsatz, Basisjahr, aus Tabelle 35 (S. 184), berechnet nach
    der Carnotmethode. Nur ${DATA.netze.netze_mit_basiswert} der
    ${DATA.netze.netze_gesamt} aufgeführten Netze haben einen Basisjahr-Wert — die übrigen
    entstehen erst. Die Spalten für 2030, 2040 und 2045 sind im Bericht für Netzgruppen
    verbunden und deshalb hier nicht je Netz ausgewiesen.` },
  netzausbau: { t: 'Trassenlänge und Bautempo', d: `Heute rund
    ${fmtInt(EW.netzlaenge_gesamt_km)} km Trasse, im Zielzustand
    ${fmtInt(EW.netzlaenge_ziel_km)} km Gesamtnetz, davon
    ${EW.trassenanteil_ziel_pct} % Trasse — also rund
    ${fmtInt(EW.netzlaenge_ziel_km * EW.trassenanteil_ziel_pct / 100)} km.
    Der Bericht nennt ein nötiges Tempo von über ${fmtInt(EW.trassenbau_km_pro_jahr)} km
    Trasse pro Jahr (S. 115). Achtung: Dieselbe Zahl 45 km steht im Bericht einmal
    als Trassenlänge und einmal als Länge inklusive Hausanschlüssen — der Abgleich dazu
    steht unter Daten & Methode.` },
  pruefgebiete: { t: 'Prüfgebiete', d: `Gebiete, für die noch nicht entschieden ist, ob sie
    Wärmenetzgebiet oder dezentrales Versorgungsgebiet werden (§ 3 WPG). Der Endbericht
    beschreibt vier Kategorien mit Beispielen (S. 117), nennt aber keine Anzahl und
    keine Gebietsliste — er hält nur fest, ihre Zahl sei „möglichst gering gehalten“.
    Eine Nachverfolgung je Gebiet setzt deshalb eine Datenlieferung der Stadt voraus.` },
  endenergie: { t: 'Endenergie Wärme je Energieträger', d: `Endenergieverbrauch Wärme in
    GWh pro Jahr, Bilanzgrenze Gebäudekante, je Energieträger und Stützjahr aus den
    Tabellen 36–40 (S. 185 f.). Umschaltbar nach Sektor. Für Wärmepumpen ist nur
    der Antriebsstrom enthalten, nicht die Umweltwärme — der Rückgang der Endenergie
    überzeichnet deshalb die Effizienzwirkung nicht, sondern bildet sie bilanziell ab.` },
  gebaeude_anschluss: { t: 'Gebäude mit Wärmenetz- und Gasnetzanschluss', d: `Anzahl der
    Gebäude je Stützjahr aus den Tabellen 43 und 45 (S. 186). Laut Fußnote sind
    gemeinschaftlich versorgte Gebäudeteile und Adressen zu einem Gebäude zusammengefasst —
    diese Reihe zählt also anders als die Adressen-Indikatoren in Tabelle 26. Beide Reihen
    dürfen nicht in einer Quote gemischt werden.` },
  fw_mix: { t: 'Erzeugungsmix der Fernwärme', d: `Endenergieeinsatz zur Erzeugung der
    leitungsgebundenen Wärme je Energieträger und Stützjahr, Bilanzgrenze Erzeugung
    (Tabelle 42, S. 186). Die konkrete Zusammensetzung ist laut § 32 WPG von den
    Netzbetreibern bis Ende 2026 in Dekarbonisierungsfahrplänen festzulegen — die hier
    gezeigten Werte sind die Annahme der Wärmeplanung, nicht der Fahrplan der medl.` },
  euro: { t: 'Investition je Tonne vermiedener Emission', d: `Investitionsvolumen eines
    Blocks geteilt durch die ihm zugerechnete Emissionsminderung im Zieljahr. Belegt sind
    die drei Investitionsblöcke (S. 129), die Gesamtminderung von
    ${fmtKt(INV.minderung_kt)} pro Jahr (Tabelle 41) und der Wirkungsanteil der Sanierung
    von ${INV.sanierung_anteil_pct} % (S. 129). Nicht belegt ist die Aufteilung
    der übrigen ${INV.rest_anteil_pct} % — dafür der Regler. Die Kennzahl setzt eine
    einmalige Investition ins Verhältnis zu einer jährlichen Minderung: eine Rangfolge,
    keine Wirtschaftlichkeitsrechnung.` },
  gegenprobe: { t: 'Gegenprobe der linearen Zwischenjahres-Fortschreibung', d: `Ein Monitor
    braucht einen Zielpfad auch für die Jahre zwischen den Stützjahren. Geprüft wurde der
    naheliegende Weg — eine Gerade vom Basisjahr zum Zieljahr 2045 —, angepasst allein an
    diesen beiden Punkten und dann auf die drei veröffentlichten Stützjahre 2030, 2035 und
    2040 angewandt, die das Verfahren nicht gesehen hat. Mittlere absolute Abweichung
    ${fmtKt(GP.mae)} pro Jahr, im Mittel ${nf1.format(GP.mape)} %, und in allen drei
    Jahren ${GP.richtung}. Die Gerade taugt deshalb nicht als Zielpfad: Sie ließe die Stadt
    in den frühen Jahren hinter dem Plan aussehen, obwohl sie auf Plan wäre.` },
  querprobe: { t: 'Querprobe des Anschlusstempos', d: `Der Zielwert „rund
    ${fmtInt(DATA.querprobe_fw.genannt)} neue Fernwärmeanschlüsse pro Jahr“ (Tabelle 26)
    lässt sich aus zwei anderen Reihen desselben Berichts nachrechnen: über die Adressen
    mit Fernwärme (Tabelle 26) und über die Gebäude mit Wärmenetzanschluss (Tabelle 43).
    Beide Wege ergeben ${nf1.format(DATA.querprobe_fw.aus_gebaeuden)} bzw.
    ${nf1.format(DATA.querprobe_fw.aus_adressen)} pro Jahr — der genannte Wert liegt
    dazwischen. Die Spanne entsteht aus den unterschiedlichen Bezugsgrößen Adresse und
    Gebäude, nicht aus einem Fehler.` },
  controlling: { t: 'Controlling-Bausteine des Endberichts', d: `Kapitel 8 des Endberichts
    (S. 174 ff.) beschreibt vier Bausteine eines laufenden Controllings. Die
    Spalte rechts hält fest, welche davon dieser Demonstrator abbildet und welche
    Verwaltungsprozesse bleiben, die ein Werkzeug nicht ersetzt.` },
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
   Farben je Energieträger — über alle Ansichten identisch, damit die
   Reihen zwischen Endenergie und Erzeugungsmix vergleichbar bleiben.
   ==================================================================== */
const ET_FARBE = {
  'Fernwärme': 'var(--dv-petrol)', 'Erdgas': '#9aa3ad', 'Biomethan': 'var(--dv-green)',
  'Klimaneutrale Gase': 'var(--dv-violet)', 'Klimaneutrale Brennstoffe': 'var(--dv-violet)',
  'Heizöl': '#6b7280', 'Flüssiggas': '#c4cad2', 'Feste Biomasse': 'var(--dv-lime)',
  'Strom': 'var(--dv-amber)', 'Oberflächennahe Geothermie': 'var(--dv-orange)',
  'Geothermie': 'var(--dv-orange)', 'Umweltwärme aus Luft': 'var(--dv-cyan)',
  'Umweltwärme aus Oberflächengewässern': '#1d7fa3', 'Solarthermie': '#e8b93b',
  'Abwärme': 'var(--dv-coral)',
};
const etFarbe = n => ET_FARBE[n] || 'var(--neutral-400)';
const JAHR_LABEL = j => j === 'Basisjahr' ? 'Basis' : j;

/* ====================================================================
   VIEWS
   ==================================================================== */
function renderOverview() {
  $('#leitzahl').innerHTML = `
    <div class="k">Leitzahl${infoIcon('leitzahl')}</div>
    <div class="v">${nf1.format(LZ.faktor)}-fach</div>
    <div class="d"><b>So viel schneller muss der Wärmepumpenzubau werden.</b>
      Der Wärmeplan beziffert den heutigen Zubau mit rund ${fmtInt(LZ.ist)} Wärmepumpen
      pro Jahr und den nötigen mit rund ${fmtInt(LZ.soll)} — rund
      ${fmtInt(LZ.zusaetzlich)} zusätzliche Anlagen, Jahr für Jahr bis
      ${DATA.meta.zieljahr} (Tabelle 26, S. ${LZ.seite}). Es ist eine Untergrenze:
      Sie gilt nur, wenn die Fernwärme parallel ihre rund
      ${fmtInt(EW.fw_anschluesse_pro_jahr)} Anschlüsse pro Jahr schafft. Bleibt der
      Netzausbau zurück, verschiebt sich die Last auf den dezentralen Zubau.
      Nachgerechnet unter <a href="#" data-goto="indikatoren">Indikatoren</a>,
      geprüft unter <a href="#" data-goto="daten">Daten &amp; Methode</a>.</div>`;

  const k = $('#overview-kpis');
  [
    { k: 'Investitionsrahmen bis 2045', v: fmtMioD(INV.gesamt_mio), info: 'investition',
      d: `netto, Preisstand 2025 · rund ${fmtInt(EW.investition_je_einwohner_monat_eur)} €
          je Einwohner*in und Monat` },
    { k: 'Treibhausgase Wärmesektor', v: `−${EW.thg_minderung_2045_pct} %`, cls: 'petrol',
      info: 'thg_pfad',
      d: `${fmtKt(THG.werte.Basisjahr)} im Basisjahr → ${fmtKt(THG.werte['2045'])} in 2045` },
    { k: 'Gebäude mit neuer Versorgung', v: fmtInt(EW.gebaeude_umstellung_anzahl),
      info: 'gebaeudewechsel',
      d: `${EW.gebaeude_umstellung_anteil_pct} % aller Gebäude bis 2045 ·
          über ${fmtInt(EW.umstellungen_dezentral_pro_jahr)} dezentrale Umstellungen/Jahr` },
    { k: 'Fernwärme am Wärmebedarf', v: `7,5 % → 33,3 %`, info: 'fw_anteil',
      d: `Absatz ${fmtInt(EW.fw_absatz_heute_gwh)} → ${fmtInt(EW.fw_absatz_ziel_gwh)} GWh/a,
          nahezu eine Vervierfachung` },
  ].forEach(s => k.appendChild(statCard(s)));

  const cols = DATA.meta.stuetzjahre.map(j => ({
    id: j, label: JAHR_LABEL(j), n: THG.werte[j],
    tip: `<b>${j === 'Basisjahr' ? 'Basisjahr ' + DATA.meta.basisjahr : j}</b>
      <div class="row"><span>Treibhausgase</span><span>${fmtKt(THG.werte[j])}/a</span></div>
      <div class="row"><span>gegenüber Basisjahr</span><span>${j === 'Basisjahr' ? '—'
        : nf1.format((THG.werte[j] / THG.werte.Basisjahr - 1) * 100) + ' %'}</span></div>`,
  }));
  columnChart($('#chart-thg'), cols, { showTotals: true, height: 250,
    color: 'var(--dv-petrol)' });

  $('#controlling-liste').innerHTML = DATA.controlling.map(c => `
    <div class="kv"><span class="kk"><b>${esc(c.t)}</b>
      <span class="pill ${c.im_monitor === 'ja' ? 'ok' : 'warn'}">${
        c.im_monitor === 'ja' ? 'im Demonstrator abgebildet' : 'teilweise'}</span></span>
      <span class="vv mono">S. ${c.s}</span>
      <span class="src">${esc(c.d)}</span></div>`).join('');
}

function renderIndikatoren() {
  const ind = DATA.indikatoren;
  const kats = [];
  ind.forEach(i => { if (!kats.includes(i.kategorie)) kats.push(i.kategorie); });

  // Anteile am Wärmebedarf: heute gegen Zielszenario
  const anteil = ind.filter(i => i.kategorie === kats[0]);
  const mix = $('#chart-ind-mix'); mix.innerHTML = '';
  const teile = st => anteil.map(i => ({
    label: i.indikator.replace('Anteil ', ''),
    n: Math.max(st === 'ref' ? i.referenz_num : i.ziel_num, 0),
    color: etFarbe(i.indikator.replace('Anteil ', '').replace(' (inkl. WP)', '')
      .replace('Heizöl + Flüssiggas', 'Heizöl').replace('Biomasse', 'Feste Biomasse')),
  }));
  mixBar(mix, 'Referenz', teile('ref'), `Basisjahr ${DATA.meta.basisjahr}`);
  mixBar(mix, 'Zielszenario', teile('ziel'), `${DATA.meta.zieljahr}`);

  $('#ind-tabelle').innerHTML = kats.map(kat => {
    const rows = ind.filter(i => i.kategorie === kat).map(i => {
      const lz = i.indikator === 'neue Wärmepumpen';
      return `<tr${lz ? ' style="background:var(--petrol-100)"' : ''}>
        <td>${esc(i.indikator)}${lz ? ' <span class="pill cat-stadt">Leitzahl</span>' : ''}</td>
        <td class="num">${esc(i.referenz)}</td>
        <td class="num">${esc(i.ziel)}</td>
        <td class="num" style="color:var(--neutral-400)">—</td></tr>`;
    }).join('');
    return `<div class="table-wrap" style="margin-bottom:var(--sp-4)">
      <table><thead><tr>
        <th>${esc(kat)}</th><th class="num">Referenzwert</th>
        <th class="num">Zielwert ${DATA.meta.zieljahr}</th><th class="num">Ist-Wert</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

/* ---------- Maßnahmen ---------- */
let mFilterFeld = 'alle', mFilterFF = 'alle';

function ffGruppe(ff) {
  if (/medl/i.test(ff)) return 'medl GmbH';
  if (/Westnetz/i.test(ff)) return 'Westnetz GmbH';
  return 'Stadt Mülheim an der Ruhr';
}

function massnahmenGefiltert() {
  return DATA.massnahmen.filter(m =>
    (mFilterFeld === 'alle' || m.strategiefeld === mFilterFeld) &&
    (mFilterFF === 'alle' || ffGruppe(m.federfuehrung) === mFilterFF));
}

function renderMassnahmen() {
  const alle = DATA.massnahmen;
  const k = $('#massnahmen-kpis'); k.innerHTML = '';
  const ffZahl = {};
  alle.forEach(m => { const g = ffGruppe(m.federfuehrung); ffZahl[g] = (ffZahl[g] || 0) + 1; });
  const beiStadt = ffZahl['Stadt Mülheim an der Ruhr'] || 0;
  [
    { k: 'Maßnahmen im Wärmeplan', v: fmtInt(alle.length), info: 'massnahmen',
      d: `in ${DATA.massnahmen_strategiefelder.length} Strategiefeldern · je ein Steckbrief` },
    { k: 'Erfolgsindikatoren', v: fmtInt(alle.reduce((a, m) => a + m.n_erfolgsindikatoren, 0)),
      cls: 'petrol', info: 'massnahmen',
      d: 'Grundlage des maßnahmenbezogenen Monitorings laut Kapitel 8' },
    { k: 'Umsetzungsschritte', v: fmtInt(alle.reduce((a, m) => a + m.n_schritte, 0)),
      d: 'einzeln benannte Handlungen über alle Steckbriefe' },
    { k: 'Federführung bei der Stadt', v: `${beiStadt} von ${alle.length}`, info: 'federfuehrung',
      d: `${alle.length - beiStadt} liegen bei medl GmbH oder Westnetz GmbH` },
  ].forEach(s => k.appendChild(statCard(s)));

  const felder = DATA.massnahmen_strategiefelder;
  columnChart($('#chart-massnahmen-feld'), felder.map(f => {
    const n = alle.filter(m => m.strategiefeld === f).length;
    return { id: f, label: f.split(' ')[0].slice(0, 11), n,
      tip: `<b>${esc(f)}</b><div class="row"><span>Maßnahmen</span><span>${n}</span></div>` };
  }), { showTotals: true, height: 200, color: 'var(--dv-petrol)' });

  barChart($('#chart-massnahmen-ff'), Object.keys(ffZahl).sort().map(g => ({
    label: g, value: ffZahl[g], valLabel: fmtInt(ffZahl[g]),
    color: g === 'Stadt Mülheim an der Ruhr' ? 'var(--dv-petrol)' : 'var(--neutral-400)',
    tip: `<b>${esc(g)}</b><div class="row"><span>Maßnahmen</span><span>${ffZahl[g]}</span></div>`,
  })), { padL: 190, rowH: 34 });

  const sel = $('#m-feld');
  sel.innerHTML = '<option value="alle">alle Strategiefelder</option>' +
    felder.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  const sel2 = $('#m-ff');
  sel2.innerHTML = '<option value="alle">alle Federführungen</option>' +
    Object.keys(ffZahl).sort().map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  sel.onchange = e => { mFilterFeld = e.target.value; massnahmenTabelle(); };
  sel2.onchange = e => { mFilterFF = e.target.value; massnahmenTabelle(); };
  massnahmenTabelle();
}

function massnahmenTabelle() {
  const rows = massnahmenGefiltert();
  $('#m-anzahl').textContent = rows.length === DATA.massnahmen.length
    ? `alle ${rows.length} Maßnahmen`
    : `${rows.length} von ${DATA.massnahmen.length} Maßnahmen`;
  $('#m-tabelle').innerHTML = `<table><thead><tr>
      <th>Nr.</th><th>Maßnahme</th><th>Strategiefeld</th><th>Federführung</th>
      <th>Laufzeit</th><th class="num">Erfolgs&shy;indikatoren</th><th>Status${assumeMark('umsetzungsstand')}</th><th></th>
    </tr></thead><tbody>${rows.map(m => `<tr>
      <td class="mono">${esc(m.nr)}</td>
      <td>${esc(m.titel)}</td>
      <td><span class="pill cat-sonstige">${esc(m.strategiefeld)}</span></td>
      <td>${esc(ffGruppe(m.federfuehrung))}</td>
      <td>${esc(m.laufzeit.length > 62 ? m.laufzeit.slice(0, 60) + '…' : m.laufzeit)}</td>
      <td class="num">${m.n_erfolgsindikatoren}</td>
      <td><span class="pill annahme">nicht veröffentlicht</span></td>
      <td><button class="kbtn ghost" data-blatt="${esc(m.nr)}">Blatt</button></td>
    </tr>`).join('')}</tbody></table>`;
}

/* ---------- Kennzahlenblatt (Drawer) ---------- */
function openBlatt(nr) {
  const m = DATA.massnahmen.find(x => x.nr === nr); if (!m) return;
  const z = (t, v) => v ? `<div class="kv"><span class="kk">${t}</span>
    <span class="vv">${esc(v)}</span></div>` : '';
  $('#drawer-body').innerHTML = `
    <p class="eyebrow">Maßnahme ${esc(m.nr)} · Endbericht S. ${m.seite}</p>
    <h3>${esc(m.titel)}</h3>
    <div class="kvlist">
      ${z('Strategiefeld', m.strategiefeld)}
      ${z('Kommunaler Einflussbereich', m.einflussbereich.join(', '))}
      ${z('Federführung', m.federfuehrung)}
      ${z('Beteiligte', m.beteiligte)}
      ${z('Laufzeit', m.laufzeit)}
      ${z('Kostenträger', m.kostentraeger)}
      ${z('Finanzierung', m.finanzierung)}
      <div class="kv"><span class="kk">Kosten beziffert</span>
        <span class="vv">${m.kosten_quantifiziert ? 'ja' : 'nein — im Steckbrief nicht pauschal quantifiziert'}</span></div>
      ${z('Umsetzungsschritte', m.n_schritte + ' benannt')}
      ${z('Erfolgsindikatoren', m.n_erfolgsindikatoren + ' benannt')}
      ${z('Hemmnisse benannt', m.hat_hemmnisse ? 'ja' : 'nein')}
      <div class="kv"><span class="kk">Umsetzungsstand</span>
        <span class="vv">nicht veröffentlicht${assumeMark('umsetzungsstand')}</span>
        <span class="src">Der Wärmeplan wurde am ${DATA.meta.ratsbeschluss} beschlossen.
        Ein Statuswert entsteht erst mit dem jährlichen Controlling der
        Koordinierungsstelle (Endbericht Kapitel 8).</span></div>
    </div>
    <p class="note">Quelle: Endbericht zur Wärmeplanung für Mülheim an der Ruhr,
      Maßnahmensteckbrief ${esc(m.nr)}, S. ${m.seite} · Abruf ${DATA.meta.stand}.
      Sachangaben übernommen, Steckbrieftext nicht wiedergegeben.</p>`;
  $('#drawer').classList.add('show');
  $('#drawer-back').classList.add('show');
}
function closeBlatt() {
  $('#drawer').classList.remove('show');
  $('#drawer-back').classList.remove('show');
}

function renderNetze() {
  const k = $('#netze-kpis'); k.innerHTML = '';
  const trasseZiel = EW.netzlaenge_ziel_km * EW.trassenanteil_ziel_pct / 100;
  [
    { k: 'Wärmenetze heute', v: fmtInt(EW.netze_gesamt), info: 'netz_ef',
      d: `„Innenstadt“ plus elf kleinere Netze · rund
          ${fmtInt(EW.gebaeude_alle_netze)} Gebäude und Gebäudekomplexe` },
    { k: 'Trassenlänge', v: `${fmtInt(EW.netzlaenge_gesamt_km)} → ${fmtInt(trasseZiel)} km`,
      cls: 'petrol', info: 'netzausbau',
      d: `Gesamtnetz inkl. Hausanschlüssen ${fmtInt(EW.netzlaenge_ziel_km)} km im Zielzustand` },
    { k: 'Nötiges Bautempo', v: `> ${fmtInt(EW.trassenbau_km_pro_jahr)} km/Jahr`,
      info: 'netzausbau', d: 'Trassenverlegung im Mittel bis 2045, laut Endbericht S. 115' },
    { k: 'Prüfgebiete', v: '4 Kategorien', info: 'pruefgebiete',
      d: `ohne veröffentlichte Anzahl${assumeMark('gebietszahl')} · Klärung läuft` },
  ].forEach(s => k.appendChild(statCard(s)));

  const netze = DATA.netze.netze;
  const mit = netze.filter(n => n.basisjahr_g_co2_kwh != null)
    .sort((a, b) => b.basisjahr_g_co2_kwh - a.basisjahr_g_co2_kwh);
  barChart($('#chart-netze-ef'), mit.map(n => ({
    label: n.netz, value: n.basisjahr_g_co2_kwh,
    valLabel: fmtInt(n.basisjahr_g_co2_kwh) + ' g',
    color: n.netz === 'Innenstadt' ? 'var(--dv-petrol)' : 'var(--neutral-400)',
    tip: `<b>${esc(n.netz)}</b><div class="row"><span>Emissionsfaktor Basisjahr</span>
      <span>${fmtInt(n.basisjahr_g_co2_kwh)} g CO₂-Äq/kWh</span></div>`,
  })), { padL: 210, rowH: 27 });

  const neu = netze.filter(n => n.basisjahr_g_co2_kwh == null).map(n => n.netz);
  $('#netze-neu').innerHTML = `Ohne Basisjahr-Wert, weil erst im Zielszenario entstehend:
    <b>${neu.map(esc).join(', ')}</b> — ${neu.length} der ${netze.length} in Tabelle 35
    geführten Netze.`;

  $('#pruef-liste').innerHTML = DATA.pruefgebiete.map(p => `
    <div class="kv"><span class="kk"><b>${esc(p.t)}</b></span>
      <span class="vv mono">S. ${p.seite}</span>
      <span class="src">${esc(p.d)} <i>Beispiele: ${p.beispiele.map(esc).join(', ')}.</i></span>
    </div>`).join('');
}

/* ---------- Umsetzungsfortschritt ---------- */
let sektor = 'alle';

function renderFortschritt() {
  const sel = $('#f-sektor');
  sel.innerHTML = `<option value="alle">alle Sektoren</option>` +
    Object.entries(DATA.endenergie.sektoren)
      .map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('');
  sel.onchange = e => { sektor = e.target.value; fortschrittCharts(); };
  fortschrittCharts();
}

function fortschrittCharts() {
  const reihen = DATA.endenergie.reihen;
  const namen = Object.keys(reihen).sort((a, b) =>
    (reihen[b].Basisjahr.phh + reihen[b].Basisjahr.oef + reihen[b].Basisjahr.ghd) -
    (reihen[a].Basisjahr.phh + reihen[a].Basisjahr.oef + reihen[a].Basisjahr.ghd));
  const wert = (n, j) => {
    const r = reihen[n][j];
    return sektor === 'alle' ? r.phh + r.oef + r.ghd : r[sektor];
  };
  const cols = DATA.meta.stuetzjahre.map(j => {
    const c = { id: j, label: JAHR_LABEL(j) };
    namen.forEach(n => { c[n] = wert(n, j); });
    const summe = namen.reduce((a, n) => a + c[n], 0);
    c.tip = `<b>${j === 'Basisjahr' ? 'Basisjahr' : j}</b>
      <div class="row"><span>Summe</span><span>${nf1.format(summe)} GWh/a</span></div>` +
      namen.filter(n => c[n] > 0.5).map(n =>
        `<div class="row"><span>${esc(n)}</span><span>${nf1.format(c[n])}</span></div>`).join('');
    return c;
  });
  columnChart($('#chart-endenergie'), cols, {
    keys: namen.map(n => ({ key: n, color: etFarbe(n) })),
    legend: namen.map(n => ({ label: n, color: etFarbe(n) })),
    height: 280,
  });

  const g = DATA.gebaeude.werte;
  columnChart($('#chart-gebaeude'), DATA.meta.stuetzjahre.map(j => ({
    id: j, label: JAHR_LABEL(j), fw: g.fernwaerme[j], gas: g.gas[j],
    tip: `<b>${j === 'Basisjahr' ? 'Basisjahr' : j}</b>
      <div class="row"><span>mit Wärmenetz</span><span>${fmtInt(g.fernwaerme[j])}</span></div>
      <div class="row"><span>mit Gasnetz</span><span>${fmtInt(g.gas[j])}</span></div>`,
  })), {
    keys: [{ key: 'fw', color: 'var(--dv-petrol)' }, { key: 'gas', color: '#9aa3ad' }],
    legend: [{ label: 'Gebäude mit Wärmenetzanschluss', color: 'var(--dv-petrol)' },
             { label: 'Gebäude mit Gasnetzanschluss', color: '#9aa3ad' }],
    height: 230,
  });

  const fm = DATA.fernwaerme_mix.reihen;
  const fmN = Object.keys(fm).sort();
  columnChart($('#chart-fwmix'), DATA.meta.stuetzjahre.map(j => {
    const c = { id: j, label: JAHR_LABEL(j) };
    fmN.forEach(n => { c[n] = fm[n][j]; });
    c.tip = `<b>${j === 'Basisjahr' ? 'Basisjahr' : j}</b>` + fmN.filter(n => c[n] > 0)
      .map(n => `<div class="row"><span>${esc(n)}</span><span>${nf1.format(c[n])} GWh</span></div>`).join('');
    return c;
  }), {
    keys: fmN.map(n => ({ key: n, color: etFarbe(n) })),
    legend: fmN.map(n => ({ label: n, color: etFarbe(n) })), height: 250,
  });
}

/* ---------- Klimawirkung je Euro ---------- */
function euroBloecke(wpAnteilPct) {
  const rest = INV.rest_anteil_pct / 100;
  const wpAnteil = rest * (wpAnteilPct / 100);
  const fwAnteil = rest - wpAnteil;
  const anteil = { wp: wpAnteil, fw: fwAnteil, san: INV.sanierung_anteil_pct / 100 };
  return INV.bloecke.map(b => {
    const kt = INV.minderung_kt * anteil[b.k];
    return { ...b, anteil_pct: anteil[b.k] * 100, kt,
             eur_je_t: b.mio * 1e6 / (kt * 1000) };
  });
}

function renderEuro() {
  const sl = $('#euro-slider');
  sl.value = Math.round(INV.wp_anteil_start_pct);
  sl.oninput = () => euroZeichnen(+sl.value);
  euroZeichnen(+sl.value);
}

function euroZeichnen(wpAnteilPct) {
  const b = euroBloecke(wpAnteilPct);
  const teuerste = b.slice().sort((x, y) => y.eur_je_t - x.eur_je_t)[0];
  $('#euro-reglerwert').innerHTML = `Wärmepumpen tragen
    <b>${fmtInt(wpAnteilPct)} %</b> der nicht belegten ${INV.rest_anteil_pct} %
    Klimawirkung, Fernwärme ${fmtInt(100 - wpAnteilPct)} %${assumeMark('wirkungsanteil')}`;

  const k = $('#euro-kpis'); k.innerHTML = '';
  b.forEach(x => k.appendChild(statCard({
    k: x.t, v: fmtInt(x.eur_je_t) + ' €', info: 'euro',
    cls: x.k === 'san' ? 'ink' : '',
    d: `${fmtMioD(x.mio)} für ${fmtKt(x.kt)}/a · Wirkungsanteil
        ${nf1.format(x.anteil_pct)} %${x.belegt_wirkung ? ' (belegt, S. 129)'
        : assumeMark('wirkungsanteil')}`,
  })));

  barChart($('#chart-euro'), b.slice().sort((x, y) => x.eur_je_t - y.eur_je_t).map(x => ({
    label: x.t.length > 34 ? x.t.slice(0, 32) + '…' : x.t,
    value: x.eur_je_t, valLabel: fmtInt(x.eur_je_t) + ' €/t',
    color: x.k === 'san' ? 'var(--dv-coral)' : 'var(--dv-petrol)',
    tip: `<b>${esc(x.t)}</b>
      <div class="row"><span>Investition</span><span>${fmtMioD(x.mio)}</span></div>
      <div class="row"><span>zugerechnete Minderung</span><span>${fmtKt(x.kt)}/a</span></div>
      <div class="row"><span>je Tonne und Jahr</span><span>${fmtInt(x.eur_je_t)} €</span></div>`,
  })), { padL: 230, rowH: 34 });

  // Ab welchem Regler-Wert kippt die Rangfolge? Beide Kreuzungspunkte
  // ergeben sich direkt aus dem Verhältnis Kostenanteil zu Wirkungsanteil.
  const mio = Object.fromEntries(INV.bloecke.map(x => [x.k, x.mio]));
  const rest = INV.rest_anteil_pct / 100, sa = INV.sanierung_anteil_pct / 100;
  const untenPct = mio.wp * sa / (rest * mio.san) * 100;          // darunter: WP teurer
  const obenPct = (1 - mio.fw * sa / (rest * mio.san)) * 100;     // darüber: FW teurer
  const imFenster = wpAnteilPct > untenPct && wpAnteilPct < obenPct;
  $('#euro-robust').innerHTML = `Teuerste vermiedene Tonne bei der aktuellen
    Reglerstellung: <b>${esc(teuerste.t)}</b>.
    Diese Rangfolge hält, solange den Wärmepumpen zwischen rund
    <b>${fmtInt(untenPct)} %</b> und <b>${fmtInt(obenPct)} %</b> der nicht belegten
    Klimawirkung zugerechnet werden — darunter zögen die Wärmepumpen an der Sanierung
    vorbei, darüber die Fernwärme. Der plausible Bereich liegt in diesem Fenster: Im
    Zielszenario decken Wärmepumpen ${nf1.format(INV.wp_anteil_start_pct)} % der nicht
    durch Sanierung erklärten Wirkung. ${imFenster
      ? 'Die aktuelle Einstellung liegt darin.'
      : '<b>Die aktuelle Einstellung liegt außerhalb — die Rangfolge ist hier gekippt.</b>'}
    Unabhängig von der Annahme bleibt nur der belegte Teil: Die Sanierung kostet
    ${nf1.format(mio.san / INV.gesamt_mio * 100)} % der Investitionen und trägt
    ${INV.sanierung_anteil_pct} % zur Zielerreichung bei (S. 129).`;
}

/* ---------- Daten & Methode ---------- */
function renderDaten() {
  $('#abgleich-liste').innerHTML = DATA.abgleich.map(a => `
    <div class="kv"><span class="kk"><b>${esc(a.t)}</b></span>
      <span class="vv"><span class="pill ok">hier gilt: ${esc(a.gilt)}</span></span>
      <span class="src"><b>${esc(a.a.q)}:</b> ${esc(a.a.v)} &nbsp;·&nbsp;
        <b>${esc(a.b.q)}:</b> ${esc(a.b.v)}<br>${esc(a.d)}</span></div>`).join('');

  // Gestapelt: die lineare Fortschreibung als Sockel, die Lücke zum Wärmeplan
  // darüber. Die Gesamthöhe ist damit der Wert des Wärmeplans.
  columnChart($('#chart-daten-backtest'), GP.punkte.map(p => ({
    id: p.jahr, label: p.jahr, linear: p.linear, luecke: p.ist - p.linear,
    tip: `<b>${p.jahr}</b>
      <div class="row"><span>Wärmeplan</span><span>${fmtKt(p.ist)}/a</span></div>
      <div class="row"><span>lineare Fortschreibung</span><span>${fmtKt(p.linear)}/a</span></div>
      <div class="row"><span>Abweichung</span><span>${nf1.format(p.abw)} kt (${nf1.format(p.abw_pct)} %)</span></div>`,
  })), {
    keys: [{ key: 'linear', color: 'var(--neutral-400)' },
           { key: 'luecke', color: 'var(--dv-coral)' }],
    legend: [{ label: 'lineare Fortschreibung Basisjahr → 2045', color: 'var(--neutral-400)' },
             { label: 'Lücke zum Wärmeplan (Fortschreibung zu niedrig)', color: 'var(--dv-coral)' }],
    height: 230, showTotals: true,
  });

  // zweiter Balken je Jahr: die lineare Vorhersage, als eigene Reihe daneben
  const bt = $('#backtest-tabelle');
  bt.innerHTML = `<table><thead><tr><th>Stützjahr</th>
      <th class="num">Wärmeplan</th><th class="num">lineare Fortschreibung</th>
      <th class="num">Abweichung</th></tr></thead><tbody>${GP.punkte.map(p => `
      <tr><td>${p.jahr}</td><td class="num">${fmtKt(p.ist)}</td>
        <td class="num">${fmtKt(p.linear)}</td>
        <td class="num" style="color:var(--error)">${nf1.format(p.abw)} kt
          (${nf1.format(p.abw_pct)} %)</td></tr>`).join('')}
      <tr><td><b>Mittlere absolute Abweichung</b></td><td class="num">—</td>
        <td class="num">—</td>
        <td class="num"><b>${fmtKt(GP.mae)} (${nf1.format(GP.mape)} %)</b></td></tr>
    </tbody></table>`;

  const q = DATA.querprobe_fw, qe = DATA.querprobe_energie;
  $('#querprobe-text').innerHTML = `Der Wärmeplan nennt als Zielwert rund
    <b>${fmtInt(q.genannt)} neue Fernwärmeanschlüsse pro Jahr</b> (Tabelle 26). Dieselbe
    Größe lässt sich aus zwei anderen Reihen desselben Berichts nachrechnen, über
    ${nf1.format(q.jahre)} Jahre zwischen Basisjahr und Zieljahr:
    aus den <b>Adressen</b> mit Fernwärme ergeben sich
    <b>${nf1.format(q.aus_adressen)} pro Jahr</b> (Tabelle 26),
    aus den <b>Gebäuden</b> mit Wärmenetzanschluss
    <b>${nf1.format(q.aus_gebaeuden)} pro Jahr</b> (Tabelle 43). Der genannte Wert liegt
    zwischen beiden — die Spanne entsteht aus den unterschiedlichen Bezugsgrößen Adresse
    und Gebäude, nicht aus einem Fehler. Für den Monitor heißt das: Die Reihen bleiben
    getrennt, und eine Anschlussquote wird nur innerhalb einer Bezugsgröße gebildet.
    <br><br>Dieselbe Probe für die Energiebilanz: Die Summe der Tabellen 36–40 trifft,
    ohne die Umweltwärme-Zeilen, den im Fließtext genannten Endenergiebedarf auf
    ${nf1.format(qe.Basisjahr.abw_pct)} % genau im Basisjahr
    (${nf1.format(qe.Basisjahr.summe_tabellen)} gegen
    ${fmtInt(qe.Basisjahr.fliesstext)} GWh/a) und auf
    ${nf1.format(qe['2045'].abw_pct)} % in 2045
    (${nf1.format(qe['2045'].summe_tabellen)} gegen
    ${fmtInt(qe['2045'].fliesstext)} GWh/a, S. 126). Das ist zugleich die
    Prüfung, dass die Spalten der Anhangtabellen richtig zugeordnet sind — eine
    verrutschte Spalte fiele hier sofort auf.`;

  /* Register der Demo-Annahmen — Wortlaut kommt aus generate.py. */
  $('#annahmen-liste').innerHTML = (DATA.annahmen || []).map(a =>
    `<div class="kv"><span class="kk"><b>${esc(a.t)}</b></span><span class="vv"></span>
     <span class="src">${esc(a.d)}</span></div>`).join('')
    || '<p class="note">Keine Demo-Annahmen — jede Zahl stammt aus einer offenen Quelle.</p>';
}


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

/* Kennzahlenblatt je Maßnahme öffnen/schließen */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-blatt]');
  if (b) { openBlatt(b.dataset.blatt); return; }
  if (e.target.closest('.dclose') || e.target.id === 'drawer-back') closeBlatt();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBlatt(); });

/* Querverweise aus Fließtext auf einen Tab: <a href="#" data-goto="tabid">…</a> */
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-goto]'); if (!a) return;
  e.preventDefault(); showView(a.dataset.goto);
});
renderOverview();
renderIndikatoren();
renderMassnahmen();
renderNetze();
renderFortschritt();
renderEuro();
renderDaten();
verdrahteQuellen();
})();
