/* =========================================================================
   Kanduit Ganztags-Bedarfsmonitor Bochum — application logic
   (vanilla JS, no build step; gleiche Systematik wie Schulbau-/Vergabe-Monitor)
   ========================================================================= */
(function () {
"use strict";
const DATA = window.KANDUIT_BOCHUM;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- formatting (de-DE) ---------- */
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fmtInt = v => v == null ? '—' : nf.format(Math.round(v));
const fmtPct0 = v => v == null ? '—' : nf.format(Math.round(v)) + ' %';
const fmtPct1 = v => v == null ? '—' : nf1.format(v) + ' %';
const fmtSigned = v => (v > 0 ? '+' : '') + fmtInt(v);
const sjKurz = sj => sj.slice(2, 4) + '/' + sj.slice(-2);
const fmtDate = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const fmtEuro = v => v == null ? '—'
  : v >= 1e6 ? nf1.format(v / 1e6) + ' Mio. €'
  : v >= 1e4 ? nf.format(Math.round(v / 1000)) + ' T€'
  : nf.format(Math.round(v)) + ' €';

/* ====================================================================
   MODELL

   Anspruchsberechtigte: Schülerinnen und Schüler in den Klassenstufen, die
   der Stufenplan des § 24 Abs. 4 SGB VIII im jeweiligen Schuljahr erfasst.
   Die Jahrgangsstärken je Standort stammen aus der Rekonstruktion in
   scripts/generate.py und decken sich mit der veröffentlichten
   Belegungsprognose der Stadt.

   Platzbedarf: Anspruchsberechtigte × Inanspruchnahmequote. Der Anspruch
   besteht für alle, angemeldet wird nur ein Teil.

   Kapazität je Standort: NICHT öffentlich. Belegt ist allein die stadtweite
   Platzzahl. Sie wird im Ausgangsjahr 2026/27 proportional zur Schülerzahl
   auf die Standorte verteilt und danach festgehalten — die Unterschiede im
   Deckungsgrad entstehen also ausschließlich aus den Kohorten der Stadt,
   nicht aus erfundenen Standortwerten.
   ==================================================================== */
const SJ = DATA.meta.schuljahre;
const STUFE = DATA.meta.stufenplan;
const SJ_START = DATA.meta.sjStart;
const PLAETZE = DATA.eckwerte.plaetze_2026_27;
const SCHUELER_START = DATA.meta.schuelerStart;

const AMPEL_FARBE = { gruen: 'var(--ok)', gelb: 'var(--warn)', rot: 'var(--error)' };
const AMPEL_TEXT = { gruen: 'gedeckt', gelb: 'knapp', rot: 'Lücke' };

const KANTEN = Object.values(DATA.nachbarn).reduce((a, v) => a + v.length, 0) / 2;
const TREND = DATA.quoteReihe;
const BASS = DATA.bass;
const BASS_META = DATA.bassMeta;
const JAHR_START = 2026;                       // Startjahr des Schuljahres 2026/27
const sjJahr = sj => parseInt(sj.slice(0, 4), 10);

const SZENARIEN = [
  { id: 'regel', name: 'Stufenplan Regelfall',
    kurz: 'Anspruch nach Gesetz, Platzangebot und Elternquote bleiben auf dem Stand 2026/27',
    quote: null, steigung: 0, ausbau: 0, umverteilung: 0 },
  { id: 'kipppunkt', name: 'Kipppunkt Elternquote',
    kurz: 'Die Inanspruchnahme steigt mit der belegten Steigung weiter — wann reißt der Bestand?',
    quote: null, steigung: TREND.steigungProJahr, ausbau: 0, umverteilung: 0 },
  { id: 'umverteilung', name: 'Umverteilung statt Ausbau',
    kurz: 'Keine neuen Plätze; Überhänge wandern in angrenzende Bezirke mit Lücke',
    quote: null, steigung: 0, ausbau: 0, umverteilung: 1 }
];

const state = {
  sj: '2029/2030',
  szenario: 'regel',
  quote: DATA.meta.quoteBasis,
  steigung: 0,
  ausbau: 0,
  umverteilung: 0,
  allokation: 'flach',
  sozialGewicht: 0.15,
  sortKey: 'luecke',
  sortDir: -1,
  standortNr: null,
  nurLuecke: false
};

function szenarioById(id) { return SZENARIEN.find(s => s.id === id) || SZENARIEN[0]; }

/** Annahmen eines Szenarios in seiner Reinform — für den Vergleich der drei. */
function szenarioAnnahmen(sz) {
  return {
    quote: sz.quote != null ? sz.quote : DATA.meta.quoteBasis,
    steigung: sz.steigung, ausbau: sz.ausbau, umverteilung: sz.umverteilung,
    allokation: state.allokation, sozialGewicht: state.sozialGewicht,
    szenario: sz
  };
}

/** Regler-Werte des aktiven Szenarios (Szenario setzt, Regler überschreiben). */
function annahmen() {
  return {
    quote: state.quote, steigung: state.steigung, ausbau: state.ausbau,
    umverteilung: state.umverteilung, allokation: state.allokation,
    sozialGewicht: state.sozialGewicht, szenario: szenarioById(state.szenario)
  };
}

/** Inanspruchnahmequote im Schuljahr sj — Ausgangswert plus Trend. */
function quoteIn(sj, a) {
  return Math.min(1, Math.max(0, a.quote + a.steigung * (sjJahr(sj) - JAHR_START)));
}

/** Anspruchsberechtigte einer Schule im Schuljahr sj. */
function anspruch(schule, sj) {
  const n = STUFE[sj] || 0;
  return schule.jg[sj].slice(0, n).reduce((a, b) => a + b, 0);
}

/** Schülerzahl (Klassen 1–4) einer Schule im Schuljahr sj. */
function schueler(schule, sj) {
  return schule.jg[sj].reduce((a, b) => a + b, 0);
}

/* ---------------------------------------------------------- Allokationen ---
   Zwei begründbare Verteilungen derselben belegten Gesamtzahl. Beide summieren
   sich exakt auf die stadtweit veröffentlichten Plätze; keine erfindet eine
   Standortkapazität hinzu. Der Abstand zwischen ihnen ist genau das, was eine
   Platzliste des Amtes auflösen würde.
   -------------------------------------------------------------------------- */

/** Take-up-Faktor aus der Sozialindexstufe des Landes (1 bis 9, 5 = neutral). */
function sozialFaktor(schule, gewicht) {
  const stufe = parseInt(schule.sozialindex, 10);
  if (!Number.isFinite(stufe)) return 1;      // ohne Stufe: neutral, nie benachteiligt
  return 1 + gewicht * (stufe - 5) / 4;
}

/** Verteilung der belegten Gesamtplatzzahl auf die Standorte, Summe = PLAETZE. */
const kapCache = new Map();
function grundKapazitaeten(a) {
  const key = a.allokation === 'sozial' ? 'sozial:' + a.sozialGewicht : 'flach';
  if (kapCache.has(key)) return kapCache.get(key);
  const gewicht = k => schueler(k, SJ_START) *
    (a.allokation === 'sozial' ? sozialFaktor(k, a.sozialGewicht) : 1);
  const summe = DATA.schulen.reduce((s, k) => s + gewicht(k), 0);
  const aus = {};
  DATA.schulen.forEach(k => { aus[k.nr] = PLAETZE * gewicht(k) / summe; });
  kapCache.set(key, aus);
  return aus;
}

function grundKapazitaet(schule, a) {
  return grundKapazitaeten(a || annahmen())[schule.nr];
}

/* ------------------------------------------------- Umverteilung (Adjazenz) --
   Plätze dürfen nur in angrenzende Bezirke wandern. Ohne diese Schranke schlägt
   das Modell Verlagerungen quer durch die Stadt vor, die keine Familie mitgeht.
   Der Nachbarschaftsgraph liegt als prüfbare Datei im Repo
   (data/sources/bo_nachbarschaft.json).
   -------------------------------------------------------------------------- */

/** Bezirke im Umkreis von `tiefe` Kanten (ohne den Ausgangsbezirk). */
function umkreis(nr, tiefe) {
  const gesehen = new Set([nr]);
  let rand = [nr];
  for (let t = 0; t < tiefe; t++) {
    const naechste = [];
    rand.forEach(x => (DATA.nachbarn[x] || []).forEach(y => {
      if (!gesehen.has(y)) { gesehen.add(y); naechste.push(y); }
    }));
    rand = naechste;
  }
  gesehen.delete(nr);
  return Array.from(gesehen);
}

/**
 * Verlagert Überhänge in angrenzende Bezirke mit Lücke.
 * Liefert {zusatz: {nr: ±Plätze}, pfade: [{von, nach, n}]}.
 */
function umverteilen(sj, a, basis) {
  const zusatz = {}, pfade = [];
  DATA.schulen.forEach(s => { zusatz[s.nr] = 0; });
  if (!a.umverteilung) return { zusatz: zusatz, pfade: pfade };

  const q = quoteIn(sj, a);
  const bedarf = {}, frei = {}, fehlt = {};
  DATA.schulen.forEach(s => {
    bedarf[s.nr] = q * anspruch(s, sj);
    const k = basis[s.nr];
    frei[s.nr] = Math.max(0, k - bedarf[s.nr]);
    fehlt[s.nr] = Math.max(0, bedarf[s.nr] - k);
  });

  // Gebende Bezirke der Reihe nach; jeder verteilt seinen Überhang auf die
  // erreichbaren Nachbarn im Verhältnis von deren offenem Bedarf.
  DATA.schulen.slice()
    .sort((x, y) => frei[y.nr] - frei[x.nr])
    .forEach(geber => {
      let uebrig = frei[geber.nr];
      if (uebrig <= 0.5) return;
      const nachbarn = umkreis(geber.nr, a.umverteilung)
        .filter(n => fehlt[n] > 0.5);
      const offen = nachbarn.reduce((s, n) => s + fehlt[n], 0);
      if (offen <= 0) return;
      const menge = Math.min(uebrig, offen);
      nachbarn.forEach(n => {
        const anteil = menge * fehlt[n] / offen;
        if (anteil < 0.5) return;
        zusatz[geber.nr] -= anteil;
        zusatz[n] += anteil;
        fehlt[n] -= anteil;
        pfade.push({ von: geber.nr, nach: n, n: anteil });
      });
      frei[geber.nr] -= menge;
    });
  return { zusatz: zusatz, pfade: pfade };
}

/* ------------------------------------------------------------- Kostenachse --
   Alle Sätze aus BASS 11-02 Nr. 19 in der Fassung BASS 2026/2027, gültig ab
   01.08.2026, jährlich +3 % zum 1. August. Land, Kommune und Eltern werden
   getrennt ausgewiesen und nicht saldiert.
   -------------------------------------------------------------------------- */
function satzIn(betrag, sj) {
  const jahre = sjJahr(sj) - JAHR_START;
  return Math.round(betrag * Math.pow(1 + BASS_META.steigerung_jaehrlich, jahre));
}

/** Kostenbild eines Schuljahres. versorgt = tatsächlich betreute Kinder. */
function kosten(sj, versorgt, plaetze, luecke) {
  const land = satzIn(BASS.land_grundbetrag.betrag, sj);
  const eigen = satzIn(BASS.kommunaler_eigenanteil.betrag, sj);
  const eltern = satzIn(BASS.elternbeitrag_hoechstgrenze.betrag, sj);
  return {
    satzLand: land, satzEigen: eigen, satzEltern: eltern,
    land: land * versorgt,
    kommune: eigen * plaetze,
    elternMax: eltern * 12 * versorgt,
    mehrbelastung: eigen * luecke
  };
}

/**
 * Stadtweiter Ausbau bis zum Schuljahr sj, verteilt proportional zur Lücke
 * des jeweiligen Vorjahres — so wandern neue Plätze dorthin, wo sie fehlen.
 * Liefert eine Zuordnung Schulnummer -> zusätzliche Plätze.
 */
function ausbauVerteilung(sjZiel, a) {
  const basis = grundKapazitaeten(a);
  const zusatz = {};
  DATA.schulen.forEach(s => { zusatz[s.nr] = 0; });
  if (!a.ausbau) return zusatz;
  const bis = SJ.indexOf(sjZiel), start = SJ.indexOf(SJ_START);
  for (let i = start + 1; i <= bis; i++) {
    const vorjahr = SJ[i - 1], q = quoteIn(vorjahr, a);
    const luecken = DATA.schulen.map(s => Math.max(
      0, q * anspruch(s, vorjahr) - (basis[s.nr] + zusatz[s.nr])));
    const summe = luecken.reduce((x, y) => x + y, 0);
    if (summe <= 0) continue;
    DATA.schulen.forEach((s, k) => { zusatz[s.nr] += a.ausbau * luecken[k] / summe; });
  }
  return zusatz;
}

/** Plätze je Standort im Schuljahr sj: Grundverteilung + Ausbau + Umverteilung. */
function kapazitaeten(sj, a) {
  const basis = grundKapazitaeten(a);
  const ausbau = ausbauVerteilung(sj, a);
  const mit = {};
  DATA.schulen.forEach(s => { mit[s.nr] = basis[s.nr] + ausbau[s.nr]; });
  const um = umverteilen(sj, a, mit);
  const aus = {};
  DATA.schulen.forEach(s => { aus[s.nr] = mit[s.nr] + um.zusatz[s.nr]; });
  return { kap: aus, pfade: um.pfade };
}

function ampelStufe(deckung) {
  if (deckung >= 1) return 'gruen';
  if (deckung >= 0.85) return 'gelb';
  return 'rot';
}

/** Kennzahlen aller Standorte für ein Schuljahr. */
function standorte(sj, a) {
  a = a || annahmen();
  const { kap, pfade } = kapazitaeten(sj, a);
  const q = quoteIn(sj, a);
  const eintritte = eintrittsjahre(a);
  const rows = DATA.schulen.map(s => {
    const berechtigt = anspruch(s, sj);
    const bedarf = q * berechtigt;
    const k = kap[s.nr];
    const luecke = Math.max(0, bedarf - k);
    const deckung = bedarf > 0 ? Math.min(k / bedarf, 9.99) : null;
    return {
      schule: s, sj: sj, quote: q,
      schueler: schueler(s, sj), berechtigt: berechtigt,
      // Nachfrage aller vier Jahrgangsstufen — auch der noch nicht
      // anspruchsberechtigten. Sie belegen dieselben Plätze.
      gesamtbedarf: q * schueler(s, sj),
      bedarf: bedarf, kap: k, luecke: luecke, deckung: deckung,
      versorgt: Math.min(bedarf, k),
      ampel: deckung == null ? 'gruen' : ampelStufe(deckung),
      eintritt: eintritte[s.nr]
    };
  });
  rows.pfade = pfade;
  return rows;
}

/** Erstes Schuljahr je Standort, in dem eine Lücke entsteht. */
const eintrittCache = new Map();
function eintrittsjahre(a) {
  const key = [a.quote, a.steigung, a.ausbau, a.umverteilung, a.allokation,
               a.sozialGewicht].join('|');
  if (eintrittCache.has(key)) return eintrittCache.get(key);
  const aus = {};
  DATA.schulen.forEach(s => { aus[s.nr] = null; });
  SJ.forEach(sj => {
    if (!STUFE[sj]) return;
    const { kap } = kapazitaeten(sj, a);
    const q = quoteIn(sj, a);
    DATA.schulen.forEach(s => {
      if (aus[s.nr]) return;
      if (q * anspruch(s, sj) - kap[s.nr] > 0.5) aus[s.nr] = sj;
    });
  });
  eintrittCache.set(key, aus);
  return aus;
}

function summe(rows) {
  const t = { schueler: 0, berechtigt: 0, gesamtbedarf: 0, bedarf: 0, kap: 0,
              luecke: 0, versorgt: 0 };
  rows.forEach(r => { for (const k in t) t[k] += r[k]; });
  t.deckung = t.bedarf > 0 ? t.kap / t.bedarf : null;
  return t;
}

/** Stadtweite Reihe über alle Schuljahre, inklusive Kostenbild. */
function stadtReihe(a) {
  a = a || annahmen();
  return SJ.map(sj => {
    const t = summe(standorte(sj, a));
    return { sj: sj, kurz: sjKurz(sj), stufen: STUFE[sj],
             quote: quoteIn(sj, a),
             kosten: kosten(sj, t.versorgt, t.kap, t.luecke), ...t };
  });
}

/** Inanspruchnahmequote, ab der die stadtweiten Plätze nicht mehr reichen. */
function kritischeQuote(sj) {
  const berechtigt = DATA.schulen.reduce((a, s) => a + anspruch(s, sj), 0);
  return berechtigt > 0 ? PLAETZE / berechtigt : null;
}

/**
 * Erstes Schuljahr, in dem die fortgeschriebene Elternquote die kritische
 * Quote überschreitet — die Antwort auf „wann kippt es“ statt nur „ab wieviel“.
 */
function kipppunktJahr(a) {
  a = a || annahmen();
  for (const sj of SJ) {
    if (!STUFE[sj]) continue;
    const krit = kritischeQuote(sj);
    if (krit != null && quoteIn(sj, a) > krit) {
      return { sj: sj, quote: quoteIn(sj, a), krit: krit };
    }
  }
  return null;
}

const schuleByNr = nr => DATA.schulen.find(s => s.nr === nr);

/* ====================================================================
   TABS
   ==================================================================== */
const views = { overview: 'view-overview', karte: 'view-karte', ampel: 'view-ampel', standort: 'view-standort', szenarien: 'view-szenarien', daten: 'view-daten' };
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  Object.entries(views).forEach(([k, id]) => $('#' + id).classList.toggle('active', k === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showView(b.dataset.view); });
// Querverweise aus dem Fließtext (z. B. das Datenstand-Badge auf den Rechenweg)
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-goto]');
  if (a) { e.preventDefault(); showView(a.dataset.goto); }
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
   Jeder Eintrag benennt Berechnung UND Datenlücke.
   ==================================================================== */
const Q = DATA.meta.quellen;
const HERKUNFT_KOHORTE =
  `Grundlage sind die Jahrgangsstärken der Stadt Bochum: die Klassen 1 bis 4 des
   Schuljahres 2025/26 und die Kinder der Altersjahre 0 bis 5 nach dem Abschlag
   von ${nf1.format(Math.abs(DATA.meta.progAbschlag))} % , den die Stadt selbst ansetzt.
   Die Aufteilung auf die Klassenstufen ist zurückgerechnet und deckt sich in
   allen ${fmtInt(DATA.schulen.length * SJ.length)} Fällen exakt mit der
   veröffentlichten Belegungsprognose — der Monitor rechnet also die Kohorten
   des Schulträgers nach, er schätzt sie nicht.`;
const LUECKE_KAPAZITAET =
  `Datenlücke: Es gibt keinen offenen Datensatz mit OGS-Plätzen je Grundschule.
   Belegt ist allein die stadtweite Zahl von ${fmtInt(PLAETZE)} Plätzen zum
   Schuljahr 2026/27. Sie wird hier im Ausgangsjahr proportional zur Schülerzahl
   verteilt und danach festgehalten. Standortwerte des Amtes ersetzen diese
   Zeile — an der Systematik ändert sich dadurch nichts.`;

const METRIC_INFO = {
  berechtigt: { t: 'Anspruchsberechtigte Kinder', d: `Schülerinnen und Schüler in
    den Klassenstufen, die der Stufenplan des § 24 Abs. 4 SGB VIII im jeweiligen
    Schuljahr erfasst: 2026/27 Klasse 1, 2027/28 Klassen 1–2, 2028/29 Klassen 1–3,
    ab 2029/30 alle vier. ${HERKUNFT_KOHORTE}` },
  bedarf: { t: 'Platzbedarf', d: `Anspruchsberechtigte × Inanspruchnahmequote.
    Der Rechtsanspruch besteht für alle Kinder der erfassten Klassenstufen,
    angemeldet wird nur ein Teil. Ausgangswert der Quote ist
    ${fmtPct1(DATA.meta.quoteBasis * 100)} — abgeleitet aus den
    ${fmtInt(PLAETZE)} vergebenen und ${fmtInt(DATA.eckwerte.ablehnungen_2026_27)}
    abgelehnten Plätzen im Verhältnis zu ${fmtInt(SCHUELER_START)} Schülerinnen
    und Schülern 2026/27. Die Quote ist frei einstellbar, weil niemand weiß, wie
    stark der Rechtsanspruch die bisher gar nicht angemeldete Nachfrage sichtbar
    macht.` },
  kapazitaet: { t: 'Ganztagsplätze je Standort', d: LUECKE_KAPAZITAET },
  deckung: { t: 'Deckungsgrad', d: `Ganztagsplätze geteilt durch Platzbedarf.
    Ampel: grün ab 100 %, gelb ab 85 %, rot darunter. Die Unterschiede zwischen
    den Standorten entstehen allein daraus, wie sich die Kohorten je
    Grundschulbezirk gegenüber 2026/27 entwickeln — die Platzverteilung selbst
    ist im Ausgangsjahr für alle Standorte gleich angesetzt. ${LUECKE_KAPAZITAET}` },
  luecke: { t: 'Offene Plätze', d: `Platzbedarf minus Ganztagsplätze, auf null
    begrenzt. Überhänge an anderen Standorten werden nicht gegengerechnet: Ein
    freier Platz in Wattenscheid hilft einem Kind in Langendreer nicht.
    ${LUECKE_KAPAZITAET}` },
  eintritt: { t: 'Eintrittsjahr der Lücke', d: `Erstes Schuljahr, in dem der
    Platzbedarf dieses Standorts die ihm zugeordneten Plätze übersteigt — unter
    den aktuell eingestellten Annahmen. „—“ heißt: im gesamten Prognosezeitraum
    bis 2031/32 keine Lücke. ${LUECKE_KAPAZITAET}` },
  aufwachsen: { t: 'Lesart in den Aufwachsjahren', d: `Wichtig für 2026/27 bis
    2028/29: Verglichen wird der <b>Rechtsanspruch</b> mit dem gesamten
    Platzbestand. In diesen Jahren halten erst ein bis drei Jahrgangsstufen einen
    Anspruch, die Plätze belegen aber weiterhin alle vier — die Ampel zeigt also
    nicht „keine Nachfrage“, sondern „der Bestand ist noch nicht rechtlich
    gebunden“. Dass es real bereits eng ist, belegt die Stadt selbst:
    ${fmtInt(DATA.eckwerte.ablehnungen_2026_27)} Kinder haben zum Schuljahr
    2026/27 keinen Platz bekommen. Erst ab 2029/30 sind Anspruch und Nachfrage
    deckungsgleich — deshalb steht dieses Schuljahr im Überblick vorn.` },
  kritQuote: { t: 'Kritische Elternquote', d: `Inanspruchnahmequote, ab der die
    ${fmtInt(PLAETZE)} stadtweit vorhandenen Plätze rechnerisch nicht mehr
    ausreichen. Da diese Zahl stadtweit belegt ist, hängt sie an keiner
    Verteilungsannahme — sie ist die belastbarste Kennzahl dieses Monitors.` },
  geburten: { t: 'Geburten je Jahr', d: `Lebendgeborene je statistischem Bezirk,
    Summe über die 30 Bezirke. Der Vorlaufindikator des Ganztagsanspruchs: Wer
    bis 2031/32 eingeschult wird, ist bereits geboren. Die Reihe stammt aus einer
    anderen Quelle als die Kohorten (BOStatIS statt Kartendienst) und ist deshalb
    als Gegenprobe brauchbar. Datenlücke: Wanderungen sind darin nicht
    enthalten — die Stadt setzt dafür ihren Abschlag von
    ${nf1.format(Math.abs(DATA.meta.progAbschlag))} % an.` },
  frkap: { t: 'Freie Grundschulkapazität', d: `Freie Plätze im Grundschulbetrieb
    laut Prognose der Stadt — negative Werte sind Fehlbedarf. Wichtig: Die Stadt
    misst diese Größe gegen die Belegung 2025/26, nicht gegen eine
    Raumkapazität. Sie beantwortet die Frage „passen die Kinder in die
    Klassenräume“, nicht „gibt es einen Ganztagsplatz“ — beides zusammen zu
    lesen ist genau der Grund, das Schulverwaltungsamt früh dazuzuholen.` },
  sozialindex: { t: 'Sozialindexstufe NRW', d: `Neunstufige Sozialindexstufe des
    Landes (1 = geringste, 9 = höchste Belastung), aus dem Schulverzeichnis des
    Schulministeriums. Sie steuert Lehrerstellen, nicht Ganztagsplätze — hier
    steht sie als Kontext: Eine Ganztagslücke an einem Standort mit hoher
    Sozialindexstufe wiegt fachlich schwerer. Datenlücke: nur für Stammschulen
    ausgewiesen, nicht je Teilstandort.` },
  schulzahl: { t: 'Wie viele Grundschulen hat Bochum?', d: `Drei Quellen, drei
    Zahlen — und keine ist falsch: ${DATA.abgleich.presse} nennt die Stadt in
    ihrer Mitteilung, ${DATA.abgleich.gisBezirke} Grundschulbezirke führt ihr
    eigener Kartendienst (${DATA.abgleich.gisStandorte} Standorte +
    ${DATA.abgleich.gisTeilstandorte} Teilstandorte),
    ${DATA.abgleich.msbGesamt} Schulen in Betrieb listet das Landesverzeichnis
    (${DATA.abgleich.msbOeffentlich} öffentlich, ${DATA.abgleich.msbPrivat}
    privat). Der Monitor rechnet auf den ${DATA.abgleich.gisBezirke} Bezirken,
    weil nur sie Kohorten und Grenzen mitbringen.` },
  ewo: { t: 'Kinder im Bezirk nach Altersjahr', d: `Einwohnerinnen und Einwohner
    der Altersjahre 0 bis 5 im Grundschulbezirk, Stand ${DATA.meta.ewoStand},
    aus dem Melderegister der Stadt. Daraus bildet die Stadt nach Abschlag die
    künftigen Einschulungsjahrgänge. Datenlücke: Der Datensatz reicht nur bis
    Altersjahr 5 — für Schuljahre nach 2031/32 fehlt die Grundlage, dort müssten
    Geburten fortgeschrieben werden.` },
  ausbau: { t: 'Ausbaupfad', d: `Zusätzliche Plätze je Schuljahr, verteilt
    proportional zur Lücke des Vorjahres — neue Plätze wandern also dorthin, wo
    sie fehlen. Das ist eine Rechenannahme, keine Aussage über tatsächliche
    Bau-, Personal- oder Trägerkapazitäten. Was ein Platz kostet, ist in Bochum
    nicht öffentlich; Kostenfolgen gehören in die Fachabstimmung mit dem Amt.` },
  steigung: { t: 'Steigung der Elternquote', d: `Öffentlich belegt sind für Bochum
    genau zwei Schuljahre mit Plätzen <i>und</i> Ablehnungen: 2022/23 und 2026/27. Die
    angemeldete Nachfrage ist ihre Summe. Damit die Steigung nicht aus zwei
    Grundgesamtheiten entsteht, steht in beiden Fällen derselbe Nenner: die
    Grundschülerzahl Bochums aus dem amtlichen Landesverzeichnis. Ergebnis:
    ${fmtPct1(TREND.punkte[0].quote * 100)} → ${fmtPct1(TREND.punkte[1].quote * 100)},
    also ${nf1.format(TREND.steigungProJahr * 100)} Punkte je Jahr.
    <b>Zwei Punkte sind kein Trend im statistischen Sinn</b> — die Steigung ist ein
    Differenzenquotient und deshalb als Regler ausgelegt, nicht als Prognose.
    Datenlücke: Für 2026/27 reicht die amtliche Reihe noch nicht; dort steht der
    jüngste Wert (${TREND.punkte[1].nennerJahr}). Der Versatz von einem Jahr ist
    benannt statt weggerechnet. Eine landesweite Ganztagsquote wird bewusst nicht
    danebengelegt: Sie hat einen anderen Nenner, und ohne belastbare Angleichung
    gehören beide Größen nicht in dieselbe Kurve.` },
  allokation: { t: 'Platzverteilung — zwei Annahmen', d: `Die stadtweite Platzzahl ist
    belegt, ihre Verteilung auf die Standorte nicht. Der Monitor bietet deshalb zwei
    begründbare Verteilungen derselben Gesamtzahl an. <b>Flach:</b> proportional zur
    Schülerzahl. <b>Sozialgewichtet:</b> zusätzlich mit einem Take-up-Faktor aus der
    neunstufigen Sozialindexstufe des Landes, die das Land schulscharf veröffentlicht —
    ein einziger freier Parameter, die Summe bleibt bei ${fmtInt(PLAETZE)} Plätzen.
    Standard ist die flache Verteilung. Der Abstand zwischen beiden ist genau das, was
    eine Platzliste des Amtes auflösen würde. Datenlücke: Für
    ${DATA.meta.ohneSozialindex.length
      ? esc(DATA.meta.ohneSozialindex.join(', '))
      : 'keinen Standort'} liegt keine Sozialindexstufe vor — dieser Standort bleibt
    neutral gewichtet. Teilstandorte erben die Stufe ihrer Stammschule.` },
  umverteilung: { t: 'Umverteilung in Nachbarbezirke', d: `Im Szenario „Umverteilung
    statt Ausbau“ wandern Überhänge in Bezirke mit Lücke — aber nur in
    <b>angrenzende</b>. Grundlage ist ein Nachbarschaftsgraph aus den Bezirksgrenzen:
    zwei Bezirke gelten als benachbart, wenn ihre Umringe mindestens zwei Stützpunkte
    teilen, also ein gemeinsames Grenzstück haben. ${fmtInt(KANTEN)} Kanten, jede von
    Hand prüfbar in <span class="mono">data/sources/bo_nachbarschaft.json</span>.
    Ohne diese Schranke schlägt ein Umverteilungsmodell Wege quer durch die Stadt vor,
    die keine Familie mitgeht. Was die Schranke <i>nicht</i> kann: Sie kennt keine
    Schulwege, keine Verkehrsverbindungen und keine Elternwünsche — sie ist die
    schwächste plausible Annahme, nicht die richtige.` },
  kosten: { t: 'Kostenbild in Euro', d: `Alle Sätze stammen aus der Förderrichtlinie
    selbst — BASS 11-02 Nr. 19, Fassung ${esc(BASS_META.fassung)}, gültig ab
    ${fmtDate(BASS_META.gueltig_ab)} — nicht aus Pressemitteilungen.
    <b>Land:</b> ${fmtInt(BASS.land_grundbetrag.betrag)} € Grundfestbetrag je Kind und
    Schuljahr (Nr. 5.4.1). <b>Kommune:</b> ${fmtInt(BASS.kommunaler_eigenanteil.betrag)} €
    Eigenanteil je Platz und Jahr (Nr. 5.5). <b>Eltern:</b> bis
    ${fmtInt(BASS.elternbeitrag_hoechstgrenze.betrag)} € je Kind und Monat — das ist die
    <i>Höchstgrenze</i> der Richtlinie, nicht der Bochumer Satzungssatz. Alle Sätze
    steigen laut Richtlinie jährlich zum 1. August um drei Prozent.
    Datenlücken: Die Bochumer Elternbeitragssatzung ist sozial gestaffelt und liegt nicht
    offen vor — Elternbeiträge werden deshalb getrennt ausgewiesen und nicht mit dem
    Eigenanteil saldiert, obwohl die Richtlinie eine Anrechnung zulässt. Nicht enthalten
    sind Investitions-, Raum- und Trägerkosten sowie der Lehrerstellenanteil, für den die
    Richtlinie ein Wahlrecht vorsieht.` },
  register: { t: 'Registerabgleich', d: `Gegenüberstellung des Bezirksdatensatzes
    der Stadt und des amtlichen Schulverzeichnisses des Landes. Sie erklärt die
    Differenz der Schülerzahlen: Der Bezirksdatensatz zählt
    ${fmtInt(DATA.abgleich.gisSchueler)} Kinder in den
    ${DATA.abgleich.gisBezirke} Bezirken, das Landesverzeichnis
    ${fmtInt(DATA.abgleich.msbSchueler)} an allen ${DATA.abgleich.msbGesamt}
    Grundschulen — die Differenz sind die Ersatzschulen und die öffentlichen
    Schulen ohne eigenen Schulbezirk.` }
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
   ==================================================================== */
const SRC_LABEL = {
  bezirke: { t: 'Stadt Bochum, Kartendienst maponline — Thema „Grundschulen“', u: Q.bezirke.quelle_url },
  ogs: { t: 'Stadtweite OGS-Eckwerte 2026/27 (Bericht über Angaben der Stadt Bochum)', u: Q.ogs.quelle_url },
  bostatis: { t: 'Stadt Bochum, Statistik und Wirkungscontrolling — BOStatIS', u: Q.geburten.quelle_url },
  msb: { t: 'Ministerium für Schule und Bildung NRW — Open Data', u: Q.msb.quelle_url }
};
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
          color, height, labelEvery, showTotals, rule: {value,label,color}} */
function columnChart(container, cols, opts) {
  opts = opts || {};
  const W = 620, H = opts.height || 240, padL = 40, padR = 10, padT = 20, padB = 34;
  const keys = opts.keys;
  const totals = cols.map(c => keys ? keys.reduce((a, k) => a + (c[k.key] || 0), 0) : c.n);
  const max = Math.max(...totals, opts.rule ? opts.rule.value : 0, 1);
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
        const rect = svgEl('rect', { x: x + iw * 0.14, y: y0 - h, width: iw * 0.72, height: h, rx: 2, fill: c.color || k.color, class: 'bar' });
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
  if (opts.rule) {
    const y = H - padB - (H - padT - padB) * (opts.rule.value / max);
    svg.appendChild(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y,
      stroke: opts.rule.color || 'var(--ink)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }));
    const t = svgEl('text', { x: W - padR - 2, y: y - 5, 'text-anchor': 'end',
      class: 'bar-label', fill: opts.rule.color || 'var(--ink)' });
    t.textContent = opts.rule.label; svg.appendChild(t);
  }
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
   STEUERLEISTE — Schuljahr, Szenario, Regler
   ==================================================================== */
const ANSPRUCHS_SJ = SJ.filter(sj => STUFE[sj] > 0);

function controlsHtml() {
  return `
    <div class="ctrl-group">
      <span class="lbl">Schuljahr</span>
      <div class="segmented" data-ctrl="sj">
        ${ANSPRUCHS_SJ.map(sj => `<button data-v="${sj}">${sjKurz(sj)}<span class="sm">Kl. 1–${STUFE[sj]}</span></button>`).join('')}
      </div>
    </div>
    <div class="ctrl-group" style="flex:1 1 320px">
      <span class="lbl">Szenario</span>
      <div class="segmented" data-ctrl="szenario">
        ${SZENARIEN.map(s => `<button data-v="${s.id}">${esc(s.name)}</button>`).join('')}
      </div>
    </div>
    <div class="ctrl-group">
      <span class="lbl">Platzverteilung <span class="info-i" data-info="allokation" tabindex="0" role="button" aria-label="Erklärung: Platzverteilung">ⓘ</span></span>
      <div class="segmented" data-ctrl="allokation">
        <button data-v="flach">flach<span class="sm">nach Schülerzahl</span></button>
        <button data-v="sozial">sozialgewichtet<span class="sm">nach Sozialindex</span></button>
      </div>
    </div>`;
}

function mountControls(host) {
  host.innerHTML = controlsHtml();
  $$('[data-ctrl]', host).forEach(grp => {
    const key = grp.dataset.ctrl;
    $$('button', grp).forEach(b => {
      b.classList.toggle('on', b.dataset.v === String(state[key]));
      b.addEventListener('click', () => {
        state[key] = b.dataset.v;
        if (key === 'szenario') {
          const s = szenarioById(b.dataset.v);
          state.quote = s.quote != null ? s.quote : DATA.meta.quoteBasis;
          state.steigung = s.steigung;
          state.ausbau = s.ausbau;
          state.umverteilung = s.umverteilung;
        }
        renderAll();
      });
    });
  });
}

function mountSliders(host) {
  const a = annahmen();
  host.innerHTML = '';
  [
    { k: 'quote', nm: 'Inanspruchnahmequote 2026/27', min: 50, max: 100, step: 0.5,
      val: Math.round(a.quote * 1000) / 10, einheit: ' %',
      hint: `Ausgangswert ${fmtPct1(DATA.meta.quoteBasis * 100)} — beobachtet 2026/27 aus vergebenen und abgelehnten Plätzen.`,
      set: v => { state.quote = v / 100; } },
    { k: 'steigung', nm: 'Steigung der Elternquote', min: 0, max: 4, step: 0.1,
      val: Math.round(a.steigung * 1000) / 10, einheit: ' Punkte/Jahr',
      hint: `Belegt sind zwei Stützpunkte: ${fmtPct1(TREND.punkte[0].quote * 100)} (2022/23) und `
        + `${fmtPct1(TREND.punkte[1].quote * 100)} (2026/27) auf gleichem Nenner — `
        + `${nf1.format(TREND.steigungProJahr * 100)} Punkte je Jahr. Zwei Punkte sind kein Trend; deshalb ein Regler.`,
      set: v => { state.steigung = v / 100; } },
    { k: 'ausbau', nm: 'Zusätzliche Plätze je Schuljahr', min: 0, max: 1200, step: 50,
      val: Math.round(a.ausbau), einheit: '',
      hint: 'Verteilt proportional zur Lücke des Vorjahres. Reine Rechenannahme — Bau-, Personal- und Trägerkapazitäten sind nicht öffentlich.',
      set: v => { state.ausbau = v; } },
    { k: 'umverteilung', nm: 'Umverteilung in Nachbarbezirke', min: 0, max: 2, step: 1,
      val: a.umverteilung, einheit: ' Ebene(n)',
      hint: '0 = keine Verlagerung. 1 = nur direkt angrenzende Bezirke, 2 = auch deren Nachbarn. '
        + `Grundlage ist der Nachbarschaftsgraph mit ${fmtInt(KANTEN)} Kanten aus den Bezirksgrenzen.`,
      set: v => { state.umverteilung = v; } },
    { k: 'sozialGewicht', nm: 'Sozialindex-Gewicht der Allokation', min: 0, max: 40, step: 5,
      val: Math.round(a.sozialGewicht * 100), einheit: ' %',
      hint: 'Nur wirksam bei sozialindexgewichteter Allokation. Der einzige freie Parameter: '
        + 'Spannweite des Take-up-Faktors zwischen Sozialindexstufe 1 und 9. Die Gesamtzahl der Plätze bleibt unverändert.',
      set: v => { state.sozialGewicht = v / 100; } }
  ].forEach(s => {
    const row = el('div', 'slider-row');
    row.innerHTML = `<div class="head"><span class="nm">${s.nm}</span>
        <span class="val" data-val>${nf1.format(s.val)}${s.einheit}</span></div>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.val}"
        aria-label="${s.nm}">
      <div class="hint">${s.hint}</div>`;
    const inp = $('input', row), out = $('[data-val]', row);
    inp.addEventListener('input', () => { out.textContent = nf1.format(+inp.value) + s.einheit; });
    inp.addEventListener('change', () => { s.set(+inp.value); renderAll(); });
    host.appendChild(row);
  });
}

/* ====================================================================
   VIEWS
   ==================================================================== */
function renderOverview() {
  const a = annahmen();
  const reihe = stadtReihe(a);
  const voll = reihe.find(r => r.sj === DATA.meta.sjVoll);
  const krit = kritischeQuote(DATA.meta.sjVoll);

  /* ---- Leitzahl: Kipppunkt. Heute, Schwelle und Abstand gleichzeitig ---- */
  const heute = DATA.meta.quoteBasis;
  const abstand = (krit - heute) * 100;
  const trendJahre = TREND.steigungProJahr > 0 ? abstand / (TREND.steigungProJahr * 100) : null;
  const trefferMitTrend = kipppunktJahr({ quote: heute, steigung: TREND.steigungProJahr,
    ausbau: 0, umverteilung: 0, allokation: 'flach', sozialGewicht: 0 });
  $('#kipppunkt-hero').innerHTML = `
    <div class="hero-zahl">
      <div class="hero-lbl">Elternquote heute</div>
      <div class="hero-v">${fmtPct1(heute * 100)}</div>
      <div class="hero-d">beobachtet 2026/27</div>
    </div>
    <div class="hero-pfeil" aria-hidden="true">→</div>
    <div class="hero-zahl kipp">
      <div class="hero-lbl">Kipppunkt 2029/30${infoIcon('kritQuote')}</div>
      <div class="hero-v">${fmtPct1(krit * 100)}</div>
      <div class="hero-d">ab hier reichen die ${fmtInt(PLAETZE)} Plätze nicht mehr</div>
    </div>
    <div class="hero-zahl abstand">
      <div class="hero-lbl">Abstand</div>
      <div class="hero-v">${nf1.format(abstand)}<span class="ein"> Punkte</span></div>
      <div class="hero-d">${trendJahre != null
        ? `bei belegter Steigung von ${nf1.format(TREND.steigungProJahr * 100)} Punkten je Jahr: rund ${nf1.format(trendJahre)} Jahre`
        : 'ohne Trendannahme'}</div>
    </div>
    <div class="hero-fazit">
      ${trefferMitTrend
        ? `<b>Mit der belegten Steigung ist der Puffer im Schuljahr ${trefferMitTrend.sj} aufgebraucht</b>
           — genau in dem Jahr, in dem der Rechtsanspruch erstmals alle vier Jahrgangsstufen erfasst.`
        : `<b>Mit der belegten Steigung bleibt der Bestand im gesamten Prognosezeitraum ausreichend.</b>`}
      <span class="note" style="display:block; margin-top:4px">Die Steigung stammt aus zwei
      belegten Stützpunkten auf gleichem Nenner und ist im Reiter „Szenarien“ frei
      einstellbar.${infoIcon('steigung')}</span>
    </div>`;

  /* ---- Datenstand-Badge ---- */
  const p = DATA.meta.pruefung;
  const ok = p.abweichungen === 0;
  $('#pruef-badge').className = 'pruef-badge' + (ok ? '' : ' fehler');
  $('#pruef-badge').innerHTML = `<span class="dot ${ok ? 'gruen' : 'rot'}"></span>
    <span>Datenstand geprüft: <b>${DATA.meta.stand}</b> — ${ok
      ? `${fmtInt(p.werte)} von ${fmtInt(p.werte)} städtischen Belegungswerten reproduziert`
      : `<b>${fmtInt(p.abweichungen)} von ${fmtInt(p.werte)} Werten weichen ab</b>`}</span>
    <a href="#" data-goto="daten">Rechenweg ansehen</a>`;

  const kpis = $('#overview-kpis'); kpis.innerHTML = '';
  [
    { k: 'Anspruchsberechtigt 2029/30', v: fmtInt(voll.berechtigt),
      d: 'Klassen 1–4, erstes Jahr mit vollem Rechtsanspruch', cls: 'ink', info: 'berechtigt' },
    { k: 'Ganztagsplätze 2026/27', v: fmtInt(PLAETZE),
      d: `stadtweit belegt · 2022/23: ${fmtInt(DATA.eckwerte.plaetze_2022_23)}`, info: 'kapazitaet' },
    { k: 'Deckung 2029/30 stadtweit', v: fmtPct0(voll.deckung * 100),
      d: voll.luecke <= 0.5 ? 'an jedem Standort gedeckt'
        : voll.deckung >= 1
          ? `Bilanz reicht — an Einzelstandorten fehlen ${fmtInt(voll.luecke)} Plätze`
          : `${fmtInt(voll.luecke)} offene Plätze an den Standorten`,
      info: 'deckung' },
    { k: 'Kritische Elternquote', v: fmtPct1(krit * 100),
      d: `heute ${fmtPct1(DATA.meta.quoteBasis * 100)} — Abstand ${nf1.format((krit - DATA.meta.quoteBasis) * 100)} Punkte`,
      cls: 'petrol', info: 'kritQuote' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  const untenGrenze = standorte(DATA.meta.sjVoll, a).filter(r => r.luecke > 0.5).length;
  $('#overview-banner').innerHTML = `<b>Der Stufenplan allein sprengt den Bestand nicht — die Elternquote tut es.</b>
    Bis 2029/30 wächst der Rechtsanspruch auf alle vier Jahrgangsstufen und damit auf
    ${fmtInt(voll.berechtigt)} Kinder. Gleichzeitig schrumpfen die Jahrgänge: Die Stadt selbst
    erwartet an den ${DATA.abgleich.gisBezirke} Grundschulbezirken
    ${fmtInt(reihe[SJ.indexOf(DATA.meta.sjVoll)].schueler)} Kinder statt
    ${fmtInt(SCHUELER_START)} im Schuljahr 2026/27. Bei der heute beobachteten
    Inanspruchnahme von ${fmtPct1(DATA.meta.quoteBasis * 100)} reichen die
    ${fmtInt(PLAETZE)} Plätze stadtweit rechnerisch aus — ab
    ${fmtPct1(krit * 100)} nicht mehr. Das sind
    ${nf1.format((krit - DATA.meta.quoteBasis) * 100)} Prozentpunkte Abstand.
    Und selbst im auskömmlichen Fall haben ${untenGrenze} der
    ${DATA.abgleich.gisBezirke} Standorte eine Lücke, weil die Plätze dort liegen,
    wo die Kinder weniger werden.
    <span class="note" style="display:block; margin-top:8px">In den Aufwachsjahren
    2026/27 bis 2028/29 hält erst ein Teil der Jahrgänge einen Anspruch, während alle
    vier Jahrgangsstufen dieselben Plätze belegen. Die Ampel misst dort den rechtlich
    gebundenen Anteil des Bestandes, nicht die tatsächliche Nachfrage — real wurden
    zum Schuljahr 2026/27 bereits ${fmtInt(DATA.eckwerte.ablehnungen_2026_27)} Kinder
    abgelehnt.${infoIcon('aufwachsen')}</span>`;

  columnChart($('#chart-overview-anspruch'), SJ.map(sj => {
    const r = reihe[SJ.indexOf(sj)];
    const jg = [0, 1, 2, 3].map(k => DATA.schulen.reduce(
      (s, sc) => s + (k < STUFE[sj] ? sc.jg[sj][k] : 0), 0));
    return {
      id: sj, label: sjKurz(sj), k1: jg[0], k2: jg[1], k3: jg[2], k4: jg[3],
      tip: `<b>Schuljahr ${sj}</b>
        <div class="row"><span>Stufenplan</span><span>${STUFE[sj] ? 'Klassen 1–' + STUFE[sj] : 'kein Anspruch'}</span></div>
        <div class="row"><span>anspruchsberechtigt</span><span>${fmtInt(r.berechtigt)}</span></div>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(r.bedarf)}</span></div>
        <div class="row"><span>Schüler gesamt</span><span>${fmtInt(r.schueler)}</span></div>`
    };
  }), {
    keys: [{ key: 'k1', color: 'var(--dv-petrol)' }, { key: 'k2', color: 'var(--dv-cyan)' },
           { key: 'k3', color: 'var(--petrol-300)' }, { key: 'k4', color: 'var(--petrol-200)' }],
    legend: [{ label: 'Klasse 1', color: 'var(--dv-petrol)' }, { label: 'Klasse 2', color: 'var(--dv-cyan)' },
             { label: 'Klasse 3', color: 'var(--petrol-300)' }, { label: 'Klasse 4', color: 'var(--petrol-200)' },
             { label: `Ganztagsplätze (${fmtInt(PLAETZE)})`, color: 'var(--ink)' }],
    height: 260, showTotals: true,
    rule: { value: PLAETZE, label: `${fmtInt(PLAETZE)} Plätze`, color: 'var(--ink)' }
  });

  const g = DATA.geburten;
  columnChart($('#chart-overview-geburten'), g.jahre.map(j => ({
    id: j, label: j.slice(2), n: g.stadt[j],
    tip: `<b>Geburten ${j}</b>
      <div class="row"><span>Lebendgeborene</span><span>${fmtInt(g.stadt[j])}</span></div>
      <div class="row"><span>Einschulung</span><span>Schuljahr ${+j + 6}/${(+j + 7) % 100}</span></div>`
  })), { color: 'var(--dv-cyan)', height: 200, showTotals: true });
}

/* ------------------------------------------------------------- Karte ---- */
function renderKarte() {
  const a = annahmen();
  const rows = standorte(state.sj, a);
  const t = summe(rows);
  const zaehl = { gruen: 0, gelb: 0, rot: 0 };
  rows.forEach(r => zaehl[r.ampel]++);

  mountControls($('#karte-controls'));
  const kpis = $('#karte-kpis'); kpis.innerHTML = '';
  [
    { k: 'Standorte gedeckt', v: fmtInt(zaehl.gruen), d: 'Deckungsgrad ab 100 %', cls: 'ink' },
    { k: 'Standorte knapp', v: fmtInt(zaehl.gelb), d: 'Deckungsgrad 85 bis unter 100 %' },
    { k: 'Standorte mit Lücke', v: fmtInt(zaehl.rot), d: 'Deckungsgrad unter 85 %' },
    { k: 'Offene Plätze gesamt', v: fmtInt(t.luecke), d: `Deckung stadtweit ${fmtPct0(t.deckung * 100)}`, cls: 'petrol', info: 'luecke' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  $('#karte-sub').textContent =
    `Schuljahr ${state.sj} · Klassen 1–${STUFE[state.sj]} · ${szenarioById(state.szenario).name} · `
    + `Quote ${fmtPct1(quoteIn(state.sj, a) * 100)}`;
  drawMap(rows);

  const lg = $('#map-legend'); lg.innerHTML = '';
  [['gruen', 'gedeckt'], ['gelb', 'knapp'], ['rot', 'Lücke']].forEach(([k, txt]) =>
    lg.appendChild(el('div', 'item', `<span class="sw" style="background:${AMPEL_FARBE[k]}"></span>${txt}`)));
  lg.appendChild(el('div', 'item', '<span class="sw" style="background:var(--neutral-400)"></span>Punktfläche ∝ anspruchsberechtigte Kinder'));
  if (rows.pfade && rows.pfade.length) {
    lg.appendChild(el('div', 'item',
      '<span class="sw" style="background:var(--dv-violet)"></span>Verlagerung in Nachbarbezirke'));
  }
  renderAllokationsdiff();
}

/** Differenz beider Verteilungsannahmen je Bezirk — die Größe der Datenlücke. */
function renderAllokationsdiff() {
  const flach = grundKapazitaeten({ allokation: 'flach', sozialGewicht: 0 });
  const sozial = grundKapazitaeten({ allokation: 'sozial',
    sozialGewicht: state.sozialGewicht });
  const diffs = DATA.schulen.map(s => ({
    s: s, d: sozial[s.nr] - flach[s.nr], flach: flach[s.nr], sozial: sozial[s.nr]
  })).sort((x, y) => y.d - x.d);
  const zeigen = diffs.slice(0, 5).concat(diffs.slice(-5));
  barChart($('#chart-karte-allokation'), zeigen.map(x => ({
    label: x.s.name.length > 26 ? x.s.name.slice(0, 25) + '…' : x.s.name,
    value: Math.abs(x.d),
    valLabel: fmtSigned(Math.round(x.d)) + ' Plätze',
    color: x.d >= 0 ? 'var(--dv-violet)' : 'var(--neutral-400)',
    tip: `<b>${esc(x.s.name)}</b>
      <div class="row"><span>Sozialindexstufe</span><span>${esc(x.s.sozialindex)}</span></div>
      <div class="row"><span>flache Verteilung</span><span>${fmtInt(x.flach)}</span></div>
      <div class="row"><span>sozialgewichtet</span><span>${fmtInt(x.sozial)}</span></div>
      <div class="row"><span>Differenz</span><span>${fmtSigned(Math.round(x.d))}</span></div>`
  })), { padL: 200, rowH: 26 });
}

function drawMap(rows) {
  const W = 640, H = 520, pad = 12;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  DATA.schulen.forEach(s => s.ringe.forEach(r => r.forEach(p => {
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
    'aria-label': `Karte der ${DATA.schulen.length} Bochumer Grundschulbezirke, eingefärbt nach Deckungsgrad im Schuljahr ${state.sj}`
  });

  rows.forEach(r => {
    const p = svgEl('path', {
      d: path(r.schule.ringe), fill: AMPEL_FARBE[r.ampel], 'fill-opacity': .34,
      stroke: '#fff', 'stroke-width': .9, class: 'map-bezirk-flaeche'
    });
    const tip = e => showTip(standortTip(r), e.clientX, e.clientY);
    p.addEventListener('mousemove', tip);
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', () => oeffneStandort(r.schule.nr));
    svg.appendChild(p);
  });

  /* Tatsächlich genutzte Verlagerungspfade — nur zwischen Nachbarbezirken. */
  const pfade = rows.pfade || [];
  if (pfade.length) {
    const defs = svgEl('defs', {});
    const mk = svgEl('marker', { id: 'pfeil', viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' });
    mk.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--dv-violet)' }));
    defs.appendChild(mk); svg.appendChild(defs);
    const maxN = Math.max.apply(null, pfade.map(p => p.n)) || 1;
    pfade.slice().sort((a, b) => a.n - b.n).forEach(p => {
      const von = schuleByNr(p.von), nach = schuleByNr(p.nach);
      if (!von || !nach || von.lat == null || nach.lat == null) return;
      const l = svgEl('line', {
        x1: px(von.lon).toFixed(1), y1: py(von.lat).toFixed(1),
        x2: px(nach.lon).toFixed(1), y2: py(nach.lat).toFixed(1),
        stroke: 'var(--dv-violet)', 'stroke-opacity': .75,
        'stroke-width': (1 + 3 * p.n / maxN).toFixed(1),
        'marker-end': 'url(#pfeil)', class: 'map-pfad'
      });
      l.addEventListener('mousemove', e => showTip(
        `<b>Verlagerung</b>
         <div class="row"><span>von</span><span>${esc(von.name)}</span></div>
         <div class="row"><span>nach</span><span>${esc(nach.name)}</span></div>
         <div class="row"><span>Plätze</span><span>${fmtInt(p.n)}</span></div>
         <div class="def">Nur zwischen angrenzenden Bezirken — Rechenannahme, keine Schulwegbetrachtung.</div>`,
        e.clientX, e.clientY));
      l.addEventListener('mouseleave', hideTip);
      svg.appendChild(l);
    });
  }

  const maxB = Math.max.apply(null, rows.map(r => r.berechtigt)) || 1;
  rows.slice().sort((x, y) => y.berechtigt - x.berechtigt).forEach(r => {
    const s = r.schule;
    if (s.lat == null || s.lon == null) return;
    const rad = 3.5 + 8 * Math.sqrt(r.berechtigt / maxB);
    const c = svgEl('circle', {
      cx: px(s.lon).toFixed(1), cy: py(s.lat).toFixed(1), r: rad.toFixed(1),
      fill: AMPEL_FARBE[r.ampel], class: 'map-pt', tabindex: '0', role: 'button',
      'aria-label': `${s.name}, Deckungsgrad ${Math.round((r.deckung || 0) * 100)} Prozent, ${Math.round(r.luecke)} offene Plätze. Öffnet die Standortansicht.`
    });
    const tip = e => showTip(standortTip(r), e.clientX, e.clientY);
    c.addEventListener('mousemove', tip);
    c.addEventListener('mouseleave', hideTip);
    c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); showTip(standortTip(r), b.right, b.bottom); });
    c.addEventListener('blur', hideTip);
    c.addEventListener('click', () => oeffneStandort(s.nr));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffneStandort(s.nr); } });
    svg.appendChild(c);
  });

  const host = $('#map-host'); host.innerHTML = ''; host.appendChild(svg);
}

function standortTip(r) {
  const s = r.schule;
  return `<b>${esc(s.name)}</b>
    <div class="row"><span>Stadtbezirk</span><span>${esc(s.bezirk)}</span></div>
    <div class="row"><span>anspruchsberechtigt</span><span>${fmtInt(r.berechtigt)}</span></div>
    <div class="row"><span>Platzbedarf (Anspruch)</span><span>${fmtInt(r.bedarf)}</span></div>
    <div class="row"><span>Nachfrage alle Kl. 1–4</span><span>${fmtInt(r.gesamtbedarf)}</span></div>
    <div class="row"><span>Plätze (Annahme)</span><span>${fmtInt(r.kap)}</span></div>
    <div class="row"><span>offene Plätze</span><span>${fmtInt(r.luecke)}</span></div>
    <div class="row"><span>Deckungsgrad</span><span>${r.deckung == null ? '—' : fmtPct0(r.deckung * 100)} · ${AMPEL_TEXT[r.ampel]}</span></div>
    <div class="def">Klicken öffnet die Standortansicht.</div>`;
}

function oeffneStandort(nr) {
  state.standortNr = nr;
  renderStandort();
  showView('standort');
}

/* -------------------------------------------------------- Lückenampel ---- */
const COLS = [
  { k: 'name', t: 'Standort', num: false },
  { k: 'bezirk', t: 'Stadtbezirk', num: false },
  { k: 'schueler', t: 'Kinder Kl. 1–4', num: true },
  { k: 'berechtigt', t: 'anspruchsberechtigt', num: true },
  { k: 'bedarf', t: 'Platzbedarf', num: true },
  { k: 'kap', t: 'Plätze (Annahme)', num: true },
  { k: 'luecke', t: 'offene Plätze', num: true },
  { k: 'deckung', t: 'Deckungsgrad', num: true },
  { k: 'eintrittSort', t: 'Lücke ab', num: true }
];

function ampelZeilen() {
  const a = annahmen();
  return standorte(state.sj, a).map(r => ({
    nr: r.schule.nr, name: r.schule.name, bezirk: r.schule.bezirk,
    teil: r.schule.teilstandort, sozialindex: r.schule.sozialindex,
    schueler: r.schueler, berechtigt: r.berechtigt, bedarf: r.bedarf,
    gesamtbedarf: r.gesamtbedarf,
    kap: r.kap, luecke: r.luecke, deckung: r.deckung == null ? 99 : r.deckung,
    eintritt: r.eintritt, eintrittSort: r.eintritt ? SJ.indexOf(r.eintritt) : 99,
    ampel: r.ampel
  }));
}

function sortiert(rows) {
  const k = state.sortKey, d = state.sortDir;
  return rows.slice().sort((a, b) => {
    const x = a[k], y = b[k];
    if (typeof x === 'string') return d * x.localeCompare(y, 'de');
    return d * (x - y);
  });
}

function renderAmpel() {
  const a = annahmen();
  let rows = ampelZeilen();
  const t = summe(standorte(state.sj, a));
  mountControls($('#ampel-controls'));

  const kpis = $('#ampel-kpis'); kpis.innerHTML = '';
  const mitLuecke = rows.filter(r => r.luecke > 0.5);
  const groesste = rows.slice().sort((x, y) => y.luecke - x.luecke)[0];
  [
    { k: 'Standorte mit Lücke', v: `${fmtInt(mitLuecke.length)} von ${fmtInt(rows.length)}`,
      d: `Schuljahr ${state.sj}`, cls: 'ink', info: 'luecke' },
    { k: 'Offene Plätze gesamt', v: fmtInt(t.luecke), d: 'Überhänge nicht gegengerechnet' },
    { k: 'Größte Einzellücke', v: fmtInt(groesste.luecke),
      d: esc(groesste.name), info: 'deckung' },
    { k: 'Platzbedarf gesamt', v: fmtInt(t.bedarf),
      d: `bei Quote ${fmtPct1(quoteIn(state.sj, a) * 100)}`, cls: 'petrol', info: 'bedarf' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  if (state.nurLuecke) rows = rows.filter(r => r.luecke > 0.5);
  rows = sortiert(rows);

  const thead = COLS.map(c => {
    const on = state.sortKey === c.k;
    return `<th class="sortable${c.num ? ' num' : ''}${on ? ' sorted' : ''}" data-k="${c.k}">
      ${c.t}${on ? ` <span class="arrow">${state.sortDir < 0 ? '▾' : '▴'}</span>` : ''}</th>`;
  }).join('');
  const tbody = rows.map(r => `<tr class="click" data-nr="${esc(r.nr)}">
      <td><span class="dot ${r.ampel}"></span>${esc(r.name)}${r.teil ? ' <span class="pill">Teilstandort</span>' : ''}
        <span class="sub">Sozialindexstufe ${esc(r.sozialindex)}</span></td>
      <td>${esc(r.bezirk)}</td>
      <td class="num">${fmtInt(r.schueler)}</td>
      <td class="num">${fmtInt(r.berechtigt)}</td>
      <td class="num">${fmtInt(r.bedarf)}</td>
      <td class="num">${fmtInt(r.kap)}</td>
      <td class="num">${r.luecke > 0.5 ? fmtInt(r.luecke) : '—'}</td>
      <td class="num">${r.deckung === 99 ? '—' : fmtPct0(r.deckung * 100)}</td>
      <td class="num">${r.eintritt ? sjKurz(r.eintritt) : '—'}</td>
    </tr>`).join('');
  $('#ampel-table').innerHTML = `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;

  $$('#ampel-table th.sortable').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.k;
    if (state.sortKey === k) state.sortDir *= -1;
    else { state.sortKey = k; state.sortDir = COLS.find(c => c.k === k).num ? -1 : 1; }
    renderAmpel();
  }));
  $$('#ampel-table tbody tr').forEach(tr =>
    tr.addEventListener('click', () => oeffneStandort(tr.dataset.nr)));

  $('#ampel-filter').checked = state.nurLuecke;
  $('#ampel-count').textContent =
    `${fmtInt(rows.length)} Standorte · Schuljahr ${state.sj} · ${szenarioById(state.szenario).name}`;
}

function csvExport() {
  const a = annahmen();
  const rows = sortiert(ampelZeilen());
  const kopf = ['Standort', 'Stadtbezirk', 'Teilstandort', 'Sozialindexstufe',
    'Kinder Klassen 1-4', 'anspruchsberechtigt', 'Platzbedarf (Anspruch)',
    'Nachfrage alle Klassen 1-4',
    'Ganztagsplaetze (Annahme)', 'offene Plaetze', 'Deckungsgrad Prozent', 'Luecke ab'];
  const zeilen = rows.map(r => [r.name, r.bezirk, r.teil ? 'ja' : 'nein', r.sozialindex,
    Math.round(r.schueler), Math.round(r.berechtigt), Math.round(r.bedarf),
    Math.round(r.gesamtbedarf),
    Math.round(r.kap), Math.round(r.luecke),
    r.deckung === 99 ? '' : Math.round(r.deckung * 100), r.eintritt || '']);
  const kopfzeilen = [
    ['Kanduit Ganztags-Bedarfsmonitor Bochum — Demonstrator, kein Produkt der Stadt Bochum'],
    ['Schuljahr', state.sj], ['Szenario', szenarioById(state.szenario).name],
    ['Inanspruchnahmequote Prozent', nf1.format(quoteIn(state.sj, a) * 100)],
    ['Steigung Punkte je Jahr', nf1.format(a.steigung * 100)],
    ['Allokation', a.allokation === 'sozial' ? 'sozialindexgewichtet' : 'flach'],
    ['Umverteilungstiefe', a.umverteilung ? a.umverteilung + ' Nachbarschaftsebene(n)' : 'keine'],
    ['Zusaetzliche Plaetze je Schuljahr', Math.round(a.ausbau)],
    ['Datenstand', DATA.meta.stand],
    ['Hinweis', 'Ganztagsplaetze je Standort sind eine Verteilungsannahme aus der '
      + 'stadtweit belegten Platzzahl. Es gibt keinen offenen Datensatz mit '
      + 'OGS-Plaetzen je Grundschule.'],
    []
  ];
  const csv = kopfzeilen.concat([kopf], zeilen)
    .map(z => z.map(f => {
      const s = String(f == null ? '' : f);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a2 = el('a');
  a2.href = url;
  a2.download = `ganztags-bedarfsmonitor-bochum_${state.sj.replace('/', '-')}_${state.szenario}.csv`;
  document.body.appendChild(a2); a2.click(); a2.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --------------------------------------------------------- Standorte ---- */
function renderStandort() {
  const a = annahmen();
  if (!state.standortNr) {
    state.standortNr = standorte(DATA.meta.sjVoll, a)
      .slice().sort((x, y) => y.luecke - x.luecke)[0].schule.nr;
  }
  const s = schuleByNr(state.standortNr);

  const sel = $('#standort-select');
  sel.innerHTML = DATA.stadtbezirke.map(b => `<optgroup label="${esc(b.name)}">${
    b.schulNrs.map(nr => {
      const sc = schuleByNr(nr);
      return `<option value="${esc(nr)}"${nr === s.nr ? ' selected' : ''}>${esc(sc.name)}</option>`;
    }).join('')}</optgroup>`).join('');

  const je = SJ.map(sj => {
    const q = quoteIn(sj, a);
    const kap = kapazitaeten(sj, a).kap[s.nr];
    const berechtigt = anspruch(s, sj);
    const bedarf = q * berechtigt;
    return { sj: sj, quote: q, berechtigt: berechtigt, bedarf: bedarf, kap: kap,
             luecke: Math.max(0, bedarf - kap), schueler: schueler(s, sj),
             gesamtbedarf: q * schueler(s, sj) };
  });
  const jetzt = je[SJ.indexOf(state.sj)];
  const deckung = jetzt.bedarf > 0 ? jetzt.kap / jetzt.bedarf : null;

  const kpis = $('#standort-kpis'); kpis.innerHTML = '';
  [
    { k: `Anspruchsberechtigt ${sjKurz(state.sj)}`, v: fmtInt(jetzt.berechtigt),
      d: `Klassen 1–${STUFE[state.sj]} von ${fmtInt(jetzt.schueler)} Kindern`, cls: 'ink', info: 'berechtigt' },
    { k: 'Platzbedarf', v: fmtInt(jetzt.bedarf), d: `Quote ${fmtPct1(jetzt.quote * 100)}`, info: 'bedarf' },
    { k: 'Plätze (Annahme)', v: fmtInt(jetzt.kap),
      d: jetzt.luecke > 0.5 ? `${fmtInt(jetzt.luecke)} offene Plätze` : 'rechnerisch gedeckt', info: 'kapazitaet' },
    { k: 'Deckungsgrad', v: deckung == null ? '—' : fmtPct0(deckung * 100),
      d: deckung == null ? 'kein Anspruch in diesem Jahr' : AMPEL_TEXT[ampelStufe(deckung)],
      cls: 'petrol', info: 'deckung' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  $('#standort-kopf').innerHTML = `<b>${esc(s.name)}</b>${s.teilstandort ? ' <span class="pill">Teilstandort</span>' : ''}
     — ${esc(s.anschrift)}, ${esc(s.plzOrt)} · Stadtbezirk ${esc(s.bezirk)} ·
     Sozialindexstufe ${esc(s.sozialindex)}${infoIcon('sozialindex')}`;

  /* Jahrgangsverlauf: gestapelte Klassenstufen je Schuljahr */
  columnChart($('#chart-standort-jg'), SJ.map(sj => ({
    id: sj, label: sjKurz(sj),
    k1: s.jg[sj][0], k2: s.jg[sj][1], k3: s.jg[sj][2], k4: s.jg[sj][3],
    tip: `<b>Schuljahr ${sj}</b>
      ${[1, 2, 3, 4].map(k => `<div class="row"><span>Klasse ${k}</span><span>${fmtInt(s.jg[sj][k - 1])}</span></div>`).join('')}
      <div class="row"><span>gesamt</span><span>${fmtInt(schueler(s, sj))}</span></div>
      <div class="row"><span>anspruchsberechtigt</span><span>${fmtInt(anspruch(s, sj))}</span></div>`
  })), {
    keys: [{ key: 'k1', color: 'var(--dv-petrol)' }, { key: 'k2', color: 'var(--dv-cyan)' },
           { key: 'k3', color: 'var(--petrol-300)' }, { key: 'k4', color: 'var(--petrol-200)' }],
    legend: [{ label: 'Klasse 1', color: 'var(--dv-petrol)' }, { label: 'Klasse 2', color: 'var(--dv-cyan)' },
             { label: 'Klasse 3', color: 'var(--petrol-300)' }, { label: 'Klasse 4', color: 'var(--petrol-200)' }],
    height: 230, showTotals: true
  });

  /* Kohortenherkunft: Kinder im Bezirk nach Altersjahr */
  barChart($('#chart-standort-ewo'), s.ewo.map((n, i) => ({
    label: `${i} Jahre → Kl. 1 ${sjKurz(SJ[6 - i])}`,
    value: n,
    valLabel: `${fmtInt(n)}  (Prognose ${fmtInt(s.prog[i])})`,
    color: 'var(--dv-cyan)',
    tip: `<b>Altersjahr ${i}, Stand ${DATA.meta.ewoStand}</b>
      <div class="row"><span>im Bezirk gemeldet</span><span>${fmtInt(n)}</span></div>
      <div class="row"><span>nach Abschlag ${nf1.format(DATA.meta.progAbschlag)} %</span><span>${fmtInt(s.prog[i])}</span></div>
      <div class="row"><span>Einschulung</span><span>Schuljahr ${SJ[6 - i]}</span></div>`
  })), { padL: 190, rowH: 30 });

  /* Grundschulkapazität der Stadt (eigene Größe, nicht Ganztag) */
  columnChart($('#chart-standort-frkap'), SJ.map((sj, i) => ({
    id: sj, label: sjKurz(sj), n: Math.abs(s.frkap[i]),
    color: s.frkap[i] < 0 ? 'var(--error)' : 'var(--ok)',
    tip: `<b>Schuljahr ${sj}</b>
      <div class="row"><span>freie Grundschulplätze</span><span>${fmtSigned(s.frkap[i])}</span></div>
      <div class="row"><span>Belegung</span><span>${fmtInt(schueler(s, sj))}</span></div>
      <div class="row"><span>Bezugsgröße</span><span>${fmtInt(s.kapGrund)}</span></div>`
  })), {
    height: 190, showTotals: true,
    legend: [{ label: 'freie Plätze', color: 'var(--ok)' }, { label: 'Fehlbedarf', color: 'var(--error)' }]
  });

  const tab = je.filter(r => STUFE[r.sj] > 0).map(r => `<tr>
      <td>${r.sj}</td><td class="num">${fmtInt(r.schueler)}</td>
      <td class="num">${fmtInt(r.berechtigt)}</td><td class="num">${fmtInt(r.bedarf)}</td>
      <td class="num">${fmtInt(r.gesamtbedarf)}</td>
      <td class="num">${fmtInt(r.kap)}</td>
      <td class="num">${r.luecke > 0.5 ? fmtInt(r.luecke) : '—'}</td>
      <td class="num">${r.bedarf > 0 ? fmtPct0(r.kap / r.bedarf * 100) : '—'}</td></tr>`).join('');
  $('#standort-tabelle').innerHTML = `<table><thead><tr>
      <th>Schuljahr</th><th class="num">Kinder Kl. 1–4</th><th class="num">anspruchsberechtigt</th>
      <th class="num">Bedarf (Anspruch)</th><th class="num">Nachfrage Kl. 1–4</th>
      <th class="num">Plätze (Annahme)</th>
      <th class="num">offene Plätze</th><th class="num">Deckungsgrad</th>
    </tr></thead><tbody>${tab}</tbody></table>`;
}

/* --------------------------------------------------------- Szenarien ---- */
function renderSzenarien() {
  mountControls($('#szenarien-controls'));
  mountSliders($('#szenarien-slider'));
  const a = annahmen();

  const karten = $('#szenarien-karten'); karten.innerHTML = '';
  SZENARIEN.forEach(sz => {
    const b = szenarioAnnahmen(sz);
    const rows = standorte(DATA.meta.sjVoll, b);
    const t = summe(rows);
    const offen = rows.filter(r => r.luecke > 0.5).length;
    const c = el('div', 'card' + (sz.id === state.szenario ? '' : ''));
    c.innerHTML = `<div class="card-title">${esc(sz.name)}
        ${sz.id === state.szenario ? '<span class="pill ok">aktiv</span>' : ''}</div>
      <div class="card-sub">${esc(sz.kurz)}</div>
      <dl class="sheet-kv" style="margin-top:14px">
        <dt>Platzbedarf 2029/30</dt><dd>${fmtInt(t.bedarf)}</dd>
        <dt>Plätze 2029/30</dt><dd>${fmtInt(t.kap)}</dd>
        <dt>offene Plätze</dt><dd>${t.luecke > 0.5 ? fmtInt(t.luecke) : '—'}</dd>
        <dt>Deckungsgrad</dt><dd>${fmtPct0(t.deckung * 100)}</dd>
        <dt>Standorte mit Lücke</dt><dd>${fmtInt(offen)} von ${fmtInt(DATA.schulen.length)}</dd>
      </dl>`;
    karten.appendChild(c);
  });

  const serien = SZENARIEN.map(sz => {
    const b = szenarioAnnahmen(sz);
    return { sz: sz, reihe: ANSPRUCHS_SJ.map(sj => summe(standorte(sj, b))) };
  });
  const farben = ['var(--dv-petrol)', 'var(--ok)', 'var(--error)'];
  barChart($('#chart-szenarien-luecke'), serien.flatMap((s, i) =>
    s.reihe.map((r, j) => ({
      label: `${s.sz.name.split(' ')[0]} · ${sjKurz(ANSPRUCHS_SJ[j])}`,
      value: Math.round(r.luecke), color: farben[i],
      tip: `<b>${esc(s.sz.name)} · ${ANSPRUCHS_SJ[j]}</b>
        <div class="row"><span>Platzbedarf</span><span>${fmtInt(r.bedarf)}</span></div>
        <div class="row"><span>Plätze</span><span>${fmtInt(r.kap)}</span></div>
        <div class="row"><span>offene Plätze</span><span>${fmtInt(r.luecke)}</span></div>
        <div class="row"><span>Deckungsgrad</span><span>${fmtPct0(r.deckung * 100)}</span></div>`
    }))), { padL: 200, rowH: 26 });

  renderQuoteTrend(a);
  renderKosten(a);

  const aktuell = summe(standorte(DATA.meta.sjVoll, a));
  const krit = kritischeQuote(DATA.meta.sjVoll);
  $('#szenarien-banner').innerHTML = `<b>Aktuelle Einstellung:</b>
    ${esc(szenarioById(state.szenario).name)}, Quote ${fmtPct1(a.quote * 100)} im
    Ausgangsjahr${a.steigung ? ` und ${fmtPct1(quoteIn(DATA.meta.sjVoll, a) * 100)} in 2029/30
    (${nf1.format(a.steigung * 100)} Punkte je Jahr)` : ' und unverändert fortgeschrieben'},
    ${fmtInt(a.ausbau)} zusätzliche Plätze je Schuljahr,
    ${a.umverteilung ? `Umverteilung über ${a.umverteilung} Nachbarschaftsebene(n)` : 'keine Umverteilung'},
    ${a.allokation === 'sozial' ? 'sozialindexgewichtete' : 'flache'} Platzverteilung.
    Ergebnis 2029/30:
    Platzbedarf ${fmtInt(aktuell.bedarf)}, Plätze ${fmtInt(aktuell.kap)},
    ${aktuell.luecke > 0.5 ? `<b>${fmtInt(aktuell.luecke)} offene Plätze</b>` : '<b>rechnerisch gedeckt</b>'}.
    Der Kipppunkt liegt bei einer Inanspruchnahme von ${fmtPct1(krit * 100)} —
    darüber reichen die ${fmtInt(PLAETZE)} belegten Plätze stadtweit nicht mehr,
    unabhängig von jeder Verteilungsannahme.`;
}

/**
 * Elternquote als Zeitachse: zwei belegte Stützpunkte, die eingestellte
 * Fortschreibung und die kritische Quote je Schuljahr. Der Schnittpunkt beider
 * Linien ist die Antwort auf „wann“, nicht nur auf „ab wieviel“.
 */
function renderQuoteTrend(a) {
  const treffer = kipppunktJahr(a);
  const cols = ANSPRUCHS_SJ.map(sj => {
    const q = quoteIn(sj, a) * 100;
    const krit = kritischeQuote(sj) * 100;
    const kippt = q > krit;
    return {
      id: sj, label: sjKurz(sj), n: q,
      color: kippt ? 'var(--error)' : 'var(--dv-petrol)',
      tip: `<b>Schuljahr ${sj}</b>
        <div class="row"><span>Elternquote (fortgeschrieben)</span><span>${fmtPct1(q)}</span></div>
        <div class="row"><span>kritische Quote</span><span>${fmtPct1(krit)}</span></div>
        <div class="row"><span>Stufenplan</span><span>Klassen 1–${STUFE[sj]}</span></div>
        <div class="def">${kippt ? 'Der Bestand reicht in diesem Jahr nicht mehr.'
          : 'Der Bestand reicht in diesem Jahr noch.'}</div>`
    };
  });
  columnChart($('#chart-szenarien-quote'), cols, {
    height: 230, showTotals: false,
    rule: { value: kritischeQuote(DATA.meta.sjVoll) * 100,
            label: `kritische Quote 2029/30: ${fmtPct1(kritischeQuote(DATA.meta.sjVoll) * 100)}`,
            color: 'var(--warn)' },
    legend: [
      { label: 'Elternquote reicht', color: 'var(--dv-petrol)' },
      { label: 'Elternquote über dem Kipppunkt', color: 'var(--error)' },
      { label: 'kritische Quote 2029/30', color: 'var(--warn)' }
    ]
  });

  $('#szenarien-quote-sub').textContent =
    `Ausgangswert ${fmtPct1(a.quote * 100)} · Steigung ${nf1.format(a.steigung * 100)} Punkte je Jahr · `
    + (treffer ? `Kipppunkt erreicht im Schuljahr ${treffer.sj}`
               : 'Kipppunkt im Prognosezeitraum nicht erreicht');

  const p0 = TREND.punkte[0], p1 = TREND.punkte[1];
  $('#szenarien-nenner').innerHTML = `<b>Nenner, ausdrücklich benannt:</b>
    ${esc(TREND.nenner)}. Belegte Stützpunkte: ${p0.sj} —
    ${fmtInt(p0.plaetze)} Plätze + ${fmtInt(p0.ablehnungen)} Ablehnungen =
    ${fmtInt(p0.nachfrage)} angemeldete Kinder auf ${fmtInt(p0.nenner)} Grundschulkinder
    (${fmtPct1(p0.quote * 100)}); ${p1.sj} — ${fmtInt(p1.plaetze)} + ${fmtInt(p1.ablehnungen)}
    = ${fmtInt(p1.nachfrage)} auf ${fmtInt(p1.nenner)} (${fmtPct1(p1.quote * 100)}, Nenner
    Stand ${p1.nennerJahr}, ein Jahr Versatz). Daraus
    ${nf1.format(TREND.steigungProJahr * 100)} Punkte je Jahr.
    Die Modellquote von ${fmtPct1(DATA.meta.quoteBasis * 100)} hat einen anderen Nenner
    (Kinder in den ${DATA.abgleich.gisBezirke} Grundschulbezirken) — übernommen wird
    deshalb nur die <i>Steigung</i>, nicht das Niveau. Eine landesweite Ganztagsquote wird
    bewusst nicht danebengelegt: anderer Nenner, keine belastbare Angleichung.`;
}

/** Kostenbild je Schuljahr, getrennt nach Land, Kommune und Eltern. */
function renderKosten(a) {
  const reihe = stadtReihe(a).filter(r => STUFE[r.sj] > 0);
  columnChart($('#chart-szenarien-kosten'), reihe.map(r => ({
    id: r.sj, label: sjKurz(r.sj),
    land: r.kosten.land / 1e6, kommune: r.kosten.kommune / 1e6,
    tip: `<b>Schuljahr ${r.sj}</b>
      <div class="row"><span>versorgte Kinder</span><span>${fmtInt(r.versorgt)}</span></div>
      <div class="row"><span>Landeszuschuss</span><span>${fmtEuro(r.kosten.land)}</span></div>
      <div class="row"><span>kommunaler Eigenanteil</span><span>${fmtEuro(r.kosten.kommune)}</span></div>
      <div class="row"><span>Elternbeiträge, Höchstgrenze</span><span>${fmtEuro(r.kosten.elternMax)}</span></div>
      <div class="row"><span>Lückenschluss würde kosten</span><span>${fmtEuro(r.kosten.mehrbelastung)}</span></div>`
  })), {
    keys: [{ key: 'land', color: 'var(--dv-petrol)' }, { key: 'kommune', color: 'var(--dv-amber)' }],
    legend: [{ label: 'Landeszuschuss', color: 'var(--dv-petrol)' },
             { label: 'kommunaler Eigenanteil', color: 'var(--dv-amber)' }],
    height: 220
  });
  $('#szenarien-kosten-sub').textContent =
    'Mio. € je Schuljahr · Land und Kommune gestapelt · Elternbeiträge in der Tabelle, getrennt und nicht saldiert';

  $('#szenarien-kosten-tab').innerHTML = `<table><thead><tr>
      <th>Schuljahr</th><th class="num">versorgte Kinder</th><th class="num">Plätze</th>
      <th class="num">Land</th><th class="num">Kommune</th>
      <th class="num">Eltern (Höchstgrenze)</th><th class="num">Lückenschluss</th>
    </tr></thead><tbody>${reihe.map(r => `<tr>
      <td>${r.sj}</td>
      <td class="num">${fmtInt(r.versorgt)}</td>
      <td class="num">${fmtInt(r.kap)}</td>
      <td class="num">${fmtEuro(r.kosten.land)}</td>
      <td class="num">${fmtEuro(r.kosten.kommune)}</td>
      <td class="num">${fmtEuro(r.kosten.elternMax)}</td>
      <td class="num">${r.kosten.mehrbelastung > 0 ? fmtEuro(r.kosten.mehrbelastung) : '—'}</td>
    </tr>`).join('')}</tbody></table>`;

  const voll = reihe.find(r => r.sj === DATA.meta.sjVoll);
  $('#szenarien-saetze').innerHTML = `<b>Sätze:</b>
    Land ${fmtInt(BASS.land_grundbetrag.betrag)} € je Kind und Schuljahr (${esc(BASS.land_grundbetrag.fundstelle)}),
    kommunaler Eigenanteil ${fmtInt(BASS.kommunaler_eigenanteil.betrag)} € je Platz und Jahr
    (${esc(BASS.kommunaler_eigenanteil.fundstelle)}), Elternbeitrag höchstens
    ${fmtInt(BASS.elternbeitrag_hoechstgrenze.betrag)} € je Kind und Monat
    (${esc(BASS.elternbeitrag_hoechstgrenze.fundstelle)}) — jeweils ab
    ${fmtDate(BASS_META.gueltig_ab)}, jährlich +3 % zum 1. August.
    Quelle: <a href="${BASS_META.quelle_url}" target="_blank" rel="noopener">BASS 11-02 Nr. 19, Fassung ${esc(BASS_META.fassung)}</a>.
    ${voll && voll.kosten.mehrbelastung > 0
      ? `<br><b>Für den Haushalt:</b> Die Lücke im Schuljahr ${DATA.meta.sjVoll} zu schließen,
         kostet die Stadt rechnerisch ${fmtEuro(voll.kosten.mehrbelastung)} im Jahr an
         zusätzlichem Eigenanteil — ohne Investitions- und Raumkosten, die nicht öffentlich sind.`
      : ''}
    <br><span class="assumption wrap">Elternbeiträge = Höchstgrenze der Richtlinie, nicht die
    sozial gestaffelte Bochumer Satzung</span>`;
}

/* ---------------------------------------------------- Daten & Methode ---- */
function renderDaten() {
  const ab = DATA.abgleich;
  const kpis = $('#daten-kpis'); kpis.innerHTML = '';
  [
    { k: 'Grundschulbezirke', v: fmtInt(ab.gisBezirke),
      d: `${ab.gisStandorte} Standorte + ${ab.gisTeilstandorte} Teilstandorte`, cls: 'ink', info: 'schulzahl' },
    { k: 'Geprüfte Belegungswerte', v: fmtInt(DATA.schulen.length * SJ.length),
      d: 'Kohortenrekonstruktion ohne Abweichung', info: 'berechtigt' },
    { k: 'Statistische Bezirke', v: fmtInt(DATA.geburten.bezirke.length),
      d: `Geburtenreihe ${DATA.geburten.jahre[0]}–${DATA.geburten.jahre[DATA.geburten.jahre.length - 1]}`, info: 'geburten' },
    { k: 'Offene Standortkapazität', v: '0', d: 'kein Datensatz mit OGS-Plätzen je Schule',
      cls: 'petrol', info: 'kapazitaet' }
  ].forEach(c => kpis.appendChild(statCard(c)));

  $('#daten-abgleich').innerHTML = `<table><thead><tr>
      <th>Quelle</th><th class="num">Schulen</th><th>Zählweise</th></tr></thead><tbody>
    <tr><td>Mitteilung der Stadt Bochum, Mai 2026</td><td class="num">${fmtInt(ab.presse)}</td>
      <td>Grundschulen — Zählweise nicht ausgewiesen</td></tr>
    <tr><td>Kartendienst der Stadt, Thema „Grundschulen“</td><td class="num">${fmtInt(ab.gisBezirke)}</td>
      <td>Grundschulbezirke: ${ab.gisStandorte} Standorte + ${ab.gisTeilstandorte} Teilstandorte.
        <span class="sub">Grundlage dieses Monitors — nur hier gibt es Kohorten und Bezirksgrenzen.</span></td></tr>
    <tr><td>Schulverzeichnis des Landes NRW</td><td class="num">${fmtInt(ab.msbGesamt)}</td>
      <td>Schulen in Betrieb: ${ab.msbOeffentlich} öffentlich, ${ab.msbPrivat} privat.
        <span class="sub">Ohne eigenen Schulbezirk: ${esc(ab.msbOhneBezirk.join(', ')) || '—'}.
        Ersatzschulen: ${esc(ab.msbPrivatNamen.join(', '))}.</span></td></tr>
    </tbody></table>`;

  $('#daten-schueler').innerHTML = `<dl class="sheet-kv">
      <dt>Kinder in den ${ab.gisBezirke} Bezirken 2025/26</dt><dd>${fmtInt(ab.gisSchueler)}</dd>
      <dt>Kinder an allen ${ab.msbGesamt} Grundschulen</dt><dd>${fmtInt(ab.msbSchueler)}</dd>
      <dt>Differenz</dt><dd>${fmtInt(ab.msbSchueler - ab.gisSchueler)}</dd>
    </dl>
    <p class="note">Die Differenz sind die Ersatzschulen und die öffentlichen Schulen ohne
    eigenen Schulbezirk. Der Monitor rechnet bewusst auf der kleineren, aber räumlich
    zuordenbaren Grundgesamtheit — und weist das hier aus, statt es zu glätten.</p>`;

  const posten = [
    ['Grundschulbezirke, Jahrgangsstärken, Kapazität, Belegungsprognose bis 2031/32',
     'Stadt Bochum, Kartendienst maponline, Thema „Grundschulen“', Q.bezirke.quelle_url,
     'belegt'],
    ['Geburten und Sterbefälle je statistischem Bezirk 2017–2025',
     'Stadt Bochum, BOStatIS', Q.geburten.quelle_url, 'belegt'],
    ['Einwohner nach Altersjahren je statistischem Bezirk, Stand 31.12.2022',
     'Stadt Bochum, BOStatIS (Open Data, 5er-Rundung)', Q.alter.quelle_url, 'belegt'],
    ['Schulverzeichnis, Schülerzahlen, Sozialindexstufen',
     'Ministerium für Schule und Bildung NRW', Q.msb.quelle_url, 'belegt'],
    ['Stadtweite OGS-Plätze und Ablehnungen 2026/27',
     'Bericht über Angaben der Stadt Bochum, Mai 2026', Q.ogs.quelle_url, 'sekundär'],
    ['OGS-Plätze je Grundschulstandort', 'nicht öffentlich verfügbar', null, 'fehlt'],
    ['Kosten je Ganztagsplatz', 'nicht öffentlich verfügbar', null, 'fehlt'],
    ['Träger-, Personal- und Raumkapazitäten im Ganztag', 'nicht öffentlich verfügbar', null, 'fehlt']
  ];
  const pill = st => st === 'belegt' ? '<span class="pill ok">belegt</span>'
    : st === 'sekundär' ? '<span class="pill warn">Sekundärquelle</span>'
    : '<span class="pill err">Datenlieferung Amt erforderlich</span>';
  $('#daten-quellen').innerHTML = `<table><thead><tr>
      <th>Größe</th><th>Quelle</th><th>Status</th></tr></thead><tbody>${
    posten.map(([g, q, u, st]) => `<tr><td>${esc(g)}</td>
      <td>${u ? `<a href="${u}" target="_blank" rel="noopener">${esc(q)}</a>` : esc(q)}</td>
      <td>${pill(st)}</td></tr>`).join('')}</tbody></table>`;

  const r = DATA.msbReihe;
  const jahre = Object.keys(r).sort();
  columnChart($('#chart-daten-reihe'), jahre.map(j => ({
    id: j, label: j.slice(2), n: r[j].schueler,
    tip: `<b>Schuljahr ${j}/${(+j + 1) % 100}</b>
      <div class="row"><span>Grundschulen</span><span>${fmtInt(r[j].schulen)}</span></div>
      <div class="row"><span>Schülerinnen und Schüler</span><span>${fmtInt(r[j].schueler)}</span></div>
      <div class="row"><span>Klassen</span><span>${fmtInt(r[j].klassen)}</span></div>`
  })), { color: 'var(--petrol-500)', height: 200, labelEvery: 2 });

  $('#daten-methode').innerHTML = `
    <p><b>1 · Kohorten.</b> Die Stadt veröffentlicht je Grundschulbezirk die Klassen 1–4
    des Schuljahres 2025/26, die Kinder der Altersjahre 0–5 nach ihrem eigenen Abschlag von
    ${nf1.format(DATA.meta.progAbschlag)} % und die Belegungsprognose bis 2031/32 — aber nicht,
    wie sich die Prognose auf die Klassenstufen verteilt. Genau das braucht der Stufenplan.
    Die Verteilung wird zurückgerechnet: Klasse <i>k</i> im Prognosejahr <i>i</i> stammt aus dem
    Einschulungsjahrgang <i>i − k + 1</i>.</p>
    <p><b>2 · Gegenprobe.</b> Die Summe der rekonstruierten Klassenstufen muss die
    veröffentlichte Belegung ergeben. Sie tut es in allen
    ${fmtInt(DATA.schulen.length * SJ.length)} Fällen. Weicht bei einem künftigen Abruf
    ein einziger Wert ab, bricht <span class="mono">scripts/generate.py</span> ab, statt
    still eine falsche Zahl auszuliefern.</p>
    <p><b>3 · Anspruch.</b> § 24 Abs. 4 SGB VIII wächst jahrgangsweise auf: 2026/27 Klasse 1,
    2027/28 Klassen 1–2, 2028/29 Klassen 1–3, ab 2029/30 alle vier. Anspruchsberechtigt sind
    alle Kinder dieser Stufen; der Platzbedarf ist der Teil davon, der angemeldet wird.</p>
    <p><b>4 · Lesart der Aufwachsjahre.</b> Von 2026/27 bis 2028/29 halten erst ein bis
    drei Jahrgangsstufen einen Anspruch, die Plätze belegen aber weiterhin alle vier.
    Die Ampel misst in diesen Jahren, wie viel des Bestandes rechtlich gebunden ist —
    nicht, wie viel Nachfrage besteht. Dass es real schon eng ist, zeigt die Stadt
    selbst: ${fmtInt(DATA.eckwerte.ablehnungen_2026_27)} Ablehnungen zum Schuljahr
    2026/27. Die Standortansicht führt beide Größen nebeneinander. Ab 2029/30 fallen
    Anspruch und Nachfrage zusammen.</p>
    <p><b>5 · Die eine Annahme.</b> Ganztagsplätze je Standort sind nicht öffentlich. Belegt
    ist allein die stadtweite Zahl. Sie wird im Ausgangsjahr 2026/27 proportional zur
    Schülerzahl verteilt und danach festgehalten. Alle Unterschiede im Deckungsgrad
    entstehen deshalb aus den Kohorten der Stadt, nicht aus erfundenen Standortwerten.
    Liefert das Amt seine Standortzahlen, ersetzen sie genau eine Zeile im Modell.</p>
    <p><b>6 · Was der Monitor nicht kann.</b> Er kennt keine Trägerverträge, keine
    Personalschlüssel, keine Raumgrößen und keine Kosten je Platz — nichts davon ist
    öffentlich. Er ersetzt kein Fachverfahren, sondern legt eine Auswertungsschicht über
    Daten, die die Stadt bereits selbst veröffentlicht.</p>
    <p><b>7 · Datenschutz.</b> Verarbeitet werden ausschließlich Jahrgangs- und
    Bezirkssummen. Keine Einzelfalldaten, keine Sozialdaten nach §§ 61 ff. SGB VIII in
    Verbindung mit SGB X, kein Zugriff auf ein Fachverfahren. Die Seite lädt Daten nur aus
    der mitgelieferten Datei; die gesamte Rechnung läuft im Browser.</p>
    <p class="note">Kleinere Korrekturen an der Quelle sind dokumentiert:
    ${DATA.meta.labelsKorrigiert.length
      ? DATA.meta.labelsKorrigiert.map(k => `Feld <span class="mono">${esc(k.feld)}</span>
        enthält „${esc(k.quelle)}“ und wurde als Schuljahr ${esc(k.gesetzt)} gelesen`).join('; ')
      : 'keine'}. Bezirksgrenzen: ${esc(DATA.meta.vereinfachung)}.</p>`;
}

/* ====================================================================
   INIT
   ==================================================================== */
function renderAll() {
  renderOverview();
  renderKarte();
  renderAmpel();
  renderStandort();
  renderSzenarien();
}

$('#standLabel').textContent = 'Stand ' + DATA.meta.stand;
$('#footer-stand').textContent = DATA.meta.stand;
$('#ampel-filter').addEventListener('change', e => { state.nurLuecke = e.target.checked; renderAmpel(); });
$('#ampel-csv').addEventListener('click', csvExport);
$('#standort-select').addEventListener('change', e => { state.standortNr = e.target.value; renderStandort(); });

renderAll();
renderDaten();
})();
