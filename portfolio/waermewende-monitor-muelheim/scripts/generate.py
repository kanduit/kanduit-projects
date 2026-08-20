# -*- coding: utf-8 -*-
"""
generate.py — aggregate the committed data snapshots (data/sources/) into
data.js for the Kanduit Wärmewende-Monitor Mülheim.

Run:  python3 scripts/generate.py     (from the project folder)

Conventions (do not break):
- Reads ONLY files under data/sources/ — no network access, so the build is
  reproducible offline. Fetching lives in scripts/fetch_endbericht.py.
- Output must be DETERMINISTIC: running twice yields a byte-identical data.js
  (meta.stand comes from the snapshots, never from datetime.now()).
- Aggregates only; no personal data, no company/winner names.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "sources")

# Das Basisjahr der Wärmeplanung ist das klimabereinigte Mittel der Jahre
# 2021–2024 (Endbericht S. 23), also kein Kalenderjahr. Für jede Rechnung auf
# der Zeitachse wird die Mitte dieses Zeitraums angesetzt.
BASISJAHR_VON, BASISJAHR_BIS = 2021, 2024
BASISJAHR_X = (BASISJAHR_VON + BASISJAHR_BIS + 1) / 2   # 2022,5
ZIELJAHR = 2045
STUETZJAHRE = ["Basisjahr", "2030", "2035", "2040", "2045"]

# Jede Größe, die nicht offen belegt ist, steht hier — im Wortlaut, mit
# Begründung. app.js zieht daraus die ◈-Tooltips.
ANNAHMEN = [
    {"k": "wirkungsanteil", "t": "Aufteilung der Klimawirkung auf Wärmepumpen und Fernwärme",
     "d": "Demo-Annahme. Der Endbericht beziffert den Beitrag zur Zielerreichung "
          "nur für einen der drei Investitionsblöcke: die Gebäudesanierung trägt "
          "14 % bei (S. 129). Wie sich die verbleibenden 86 % auf die dezentrale "
          "Heizungsumstellung und den Fernwärmeaus- und -umbau verteilen, steht "
          "dort nicht. Der Startwert teilt sie im Verhältnis der Wärmebedarfs"
          "deckung im Zieljahr — Wärmepumpen 53 %, Fernwärme 33 % (S. 123) — und "
          "ist über den Regler veränderbar. Im Projekt durch die Wirkungsbilanz "
          "je Maßnahme aus dem Controlling der Stadt zu ersetzen."},
    {"k": "gebietszahl", "t": "Anzahl der Versorgungs- und Prüfgebiete",
     "d": "Liegt nicht vor — und wird hier deshalb auch nicht geschätzt. Der "
          "Endbericht weist die Versorgungsgebiete kartografisch und über "
          "Flächen- und Bedarfsanteile aus (17 % der Fläche, 810 GWh/a, über "
          "51 % des Wärmebedarfs, S. 113), nennt aber an keiner Stelle eine "
          "Anzahl von Gebieten; zu den Prüfgebieten heißt es nur, ihre Anzahl "
          "sei „möglichst gering gehalten“ (S. 117). Eine Zählung je Gebietstyp "
          "setzt die Geometrien der Wärmeplanung voraus — eine Datenlieferung "
          "der Stadt bzw. die Freigabe der Online-Karte."},
    {"k": "umsetzungsstand", "t": "Umsetzungsstand je Maßnahme",
     "d": "Demo-Annahme in der Darstellung, nicht in den Daten: Der Monitor "
          "führt die 14 Maßnahmen mit ihren belegten Feldern (Federführung, "
          "Laufzeit, Kostenträger, Zahl der Erfolgsindikatoren), aber ohne "
          "Statuswert — der Wärmeplan wurde am 16.07.2026 beschlossen, ein "
          "Umsetzungsstand ist noch nicht veröffentlicht. Die Statusspalte "
          "bleibt deshalb leer statt erfunden. Sie wird im Projekt aus dem "
          "jährlichen Controlling der Koordinierungsstelle gefüllt (Endbericht "
          "Kapitel 8)."},
]

# Anzeigename + URL je Quellenschlüssel; data-src im HTML verweist hierauf.
QUELLEN = {
    "endbericht": {"t": "Endbericht zur Wärmeplanung für Mülheim an der Ruhr (Juli 2026)",
                   "u": "https://cms.muelheim-ruhr.de/sites/default/files/2026-07/"
                        "Waermeplanung_Muelheim_Endbericht.pdf"},
    "stadt": {"t": "Wärmeplanung — Stadt Mülheim an der Ruhr",
              "u": "https://cms.muelheim-ruhr.de/stadtraum/planen-und-bauen/waermeplanung"},
    "wpg": {"t": "Wärmeplanungsgesetz (WPG) des Bundes",
            "u": "https://www.gesetze-im-internet.de/wpg/"},
}

HEADER = (
    "/* Kanduit Wärmewende-Monitor Mülheim — aggregierte öffentliche Daten.\n"
    "   Quelle: Endbericht zur Wärmeplanung für Mülheim an der Ruhr (Stadt\n"
    "   Mülheim an der Ruhr, Redaktionsdatum 15.05.2026, vom Rat beschlossen\n"
    "   am 16.07.2026) — Abruf siehe meta.stand.\n"
    "   Keine personenbezogenen Daten.\n*/\n"
)


def lade(name):
    with open(os.path.join(SRC, name + ".json"), encoding="utf-8") as fh:
        return json.load(fh)


def r(x, n=1):
    return None if x is None else round(x, n)


# --------------------------------------------------------------------------
def leitzahl(ind):
    """Die eine Zahl: Tempo beim Wärmepumpenzubau, heute gegen Zielwert.

    Beide Werte stehen in Tabelle 26 (S. 130) nebeneinander — Referenz
    ~150 WP/Jahr, Ziel ~1.350 WP/Jahr.
    """
    wp = next(i for i in ind if i["indikator"] == "neue Wärmepumpen")
    ist, soll = wp["referenz_num"], wp["ziel_num"]
    return {"ist": ist, "soll": soll, "faktor": r(soll / ist, 1),
            "zusaetzlich": soll - ist, "seite": wp["seite"]}


def thg_gegenprobe(werte):
    """Gegenprobe der linearen Zwischenjahres-Fortschreibung.

    Ein Monitor braucht einen Zielpfad für die Jahre zwischen den Stützjahren.
    Der naheliegende Weg — gerade Linie vom Basisjahr zum Zieljahr — wird hier
    an den drei veröffentlichten Stützjahren geprüft, die das Verfahren nicht
    gesehen hat.
    """
    x0, y0 = BASISJAHR_X, werte["Basisjahr"]
    x1, y1 = float(ZIELJAHR), werte["2045"]
    steigung = (y1 - y0) / (x1 - x0)
    punkte = []
    for jahr in ("2030", "2035", "2040"):
        x = float(jahr)
        vorher = y0 + steigung * (x - x0)
        ist = werte[jahr]
        punkte.append({"jahr": jahr, "ist": ist, "linear": r(vorher),
                       "abw": r(vorher - ist), "abw_pct": r((vorher - ist) / ist * 100)})
    mae = sum(abs(p["abw"]) for p in punkte) / len(punkte)
    mape = sum(abs(p["abw_pct"]) for p in punkte) / len(punkte)
    return {"punkte": punkte, "mae": r(mae), "mape": r(mape),
            "steigung": r(steigung, 2),
            "richtung": "zu niedrig" if all(p["abw"] < 0 for p in punkte) else "gemischt"}


def investitionen(eck, thg_werte):
    """Klimawirkung je Euro — Investitionsblöcke gegen Emissionsminderung.

    Belegt sind: die drei Investitionsblöcke (S. 129), der Wirkungsanteil der
    Sanierung (14 %, S. 129) und die Emissionsminderung insgesamt (Tabelle 41).
    Nicht belegt ist die Aufteilung der restlichen 86 % — siehe ◈ wirkungsanteil.
    """
    w = lambda k: eck[k]["wert"]
    minderung = thg_werte["Basisjahr"] - thg_werte["2045"]          # kt/a
    san_anteil = w("sanierung_thg_beitrag_pct") / 100
    return {
        "gesamt_mio": w("investition_gesamt_mio"),
        "minderung_kt": r(minderung),
        "sanierung_anteil_pct": w("sanierung_thg_beitrag_pct"),
        "rest_anteil_pct": r(100 - w("sanierung_thg_beitrag_pct")),
        # Startwert der Aufteilung: Anteile an der Wärmebedarfsdeckung 2045
        # (Wärmepumpen 53 %, Fernwärme 33 %, S. 123) → 53/86 bzw. 33/86.
        "wp_anteil_start_pct": r(53 / 86 * 100),
        "bloecke": [
            {"k": "wp", "t": "Dezentrale Heizungsumstellung auf Wärmepumpen",
             "mio": w("investition_waermepumpen_mio"), "belegt_wirkung": False},
            {"k": "fw", "t": "Fernwärmeaus- und -umbau",
             "mio": w("investition_fernwaerme_mio"), "belegt_wirkung": False},
            {"k": "san", "t": "Energetische Gebäudesanierung",
             "mio": w("investition_sanierung_mio"), "belegt_wirkung": True,
             "wirkung_pct": w("sanierung_thg_beitrag_pct"),
             "wirkung_kt": r(minderung * san_anteil)},
        ],
        "einsparungen_mio": w("einsparung_kesseltausch_mio") + w("einsparung_fw_reinvest_mio"),
        "je_einwohner_monat_eur": w("investition_je_einwohner_monat_eur"),
        "foerderung_hinweis": "BEW und BEG decken laut Endbericht 30–50 % der Investitionen (S. 128).",
    }


def registerabgleich(eck, massnahmen, geb, ind):
    """Stellen, an denen die Quellen für dieselbe Größe verschiedene Zahlen
    oder verschiedene Bezugsgrößen nennen. Der erste Einwand im Termin."""
    w = lambda k: eck[k]["wert"]
    fw_adr = next(i for i in ind if i["indikator"] == "Adressen mit FW")
    return [
        {"k": "massnahmen",
         "t": "Zwölf oder vierzehn Maßnahmen?",
         "a": {"q": "Fließtext, S. 137", "v": f"{w('massnahmen_text_anzahl'):.0f} Maßnahmen"},
         "b": {"q": "Übersichtstabellen 27–31 und Steckbriefe 6.5.1.1–6.5.5.1",
               "v": f"{len(massnahmen)} Maßnahmen"},
         "gilt": f"{len(massnahmen)}",
         "d": "Der Endbericht kündigt „alle zwölf Maßnahmen“ an, führt in den "
              "Übersichtstabellen und als Steckbrief aber vierzehn aus. Nachgezählt "
              "wurden die Steckbriefe: vier im Strategiefeld „Wärmeplanung als "
              "Prozess“, drei „Wärmenetze und Infrastruktur“, drei „Ausbau "
              "erneuerbarer Energien und Abwärme“, drei „Begleitende Prozesse“, "
              "eine „Sonstige“. Für einen Umsetzungsgrad ist das kein Detail: "
              "derselbe Fortschritt ergibt je nach Nenner 12 oder 14 Prozentpunkte "
              "Unterschied. Dieser Monitor rechnet mit 14."},
        {"k": "netzlaenge",
         "t": "45 km Wärmenetz — Trasse oder inklusive Hausanschlüsse?",
         "a": {"q": "S. 115", "v": "45 km inkl. Hausanschlussleitungen"},
         "b": {"q": "S. 136", "v": "knapp 45 km Trassenlänge"},
         "gilt": "Trassenlänge",
         "d": "Dieselbe Zahl steht an zwei Stellen mit zwei Definitionen. "
              "Auflösen lässt es sich über S. 135: allein das Netz „Innenstadt“ "
              "hat 26 km Trassenlänge, und es gibt elf weitere Netze — die "
              "verbleibenden rund 19 km sind plausibel als Trasse, nicht als "
              "Gesamtlänge inklusive Hausanschlüssen. Der Unterschied ist "
              "erheblich: Bei 45 km Trasse heute und 120 km im Zielzustand "
              "(60 % von 200 km) fehlen 75 km; läse man die 45 km als "
              "Gesamtlänge, wären es 93 km und damit rund ein Viertel mehr "
              "Bautempo. Dieser Monitor rechnet mit der Trassen-Lesart."},
        {"k": "adressen",
         "t": "Adressen oder Gebäude mit Fernwärme?",
         "a": {"q": "Tabelle 26, S. 130", "v": f"{fw_adr['referenz']} Adressen"},
         "b": {"q": "Tabelle 43, S. 186",
               "v": f"{geb['werte']['fernwaerme']['Basisjahr']:.0f} Gebäude"},
         "gilt": "je nach Kennzahl",
         "d": "Kein Widerspruch, sondern zwei Bezugsgrößen für dieselbe Sache: "
              "Die Indikatorentabelle zählt Adressen, die Anhangtabelle zählt "
              "Gebäude, wobei gemeinschaftlich versorgte Gebäudeteile und "
              "Adressen laut Fußnote zu einem Gebäude zusammengefasst sind. Wer "
              "beide Reihen in einer Fortschrittsquote mischt, rechnet mit "
              "einem um rund ein Drittel abweichenden Nenner. Der Monitor hält "
              "die Reihen getrennt und beschriftet sie einzeln."},
    ]


PRUEFGEBIETE = [
    {"k": "denkmal", "t": "Denkmalbereiche",
     "d": "Fernwärme wäre hier eine minimalinvasive Option für Einzelgebäude und "
          "Ensembles, die Gebiete grenzen aber nicht unmittelbar an Bestands- "
          "oder Ausbaugebiete an.",
     "beispiele": ["Mausegatt-Siedlung", "Heimaterde"], "seite": 117},
    {"k": "gewerbe", "t": "Zukünftige Gewerbegebiete mit wenigen Anrainern",
     "d": "Energieversorgungskonzepte noch in Entwicklung oder Prüfung.",
     "beispiele": ["Gewerbegebiet Mülheim-West", "CT-Park"], "seite": 117},
    {"k": "nachbar", "t": "Gebiete an Netzgebieten der Nachbarkommunen",
     "d": "Eine Kooperation zur leitungsgebundenen Versorgung wäre zu prüfen. "
          "Der Steckbrief 6.5.1.4 nennt für die Prüfung das Jahr 2026.",
     "beispiele": ["angrenzend an Oberhausen", "angrenzend an Essen"], "seite": 117},
    {"k": "dichte", "t": "Weitere Gebiete mit hoher Wärmeliniendichte",
     "d": "Wärmequellenlage, netztechnische Erschließbarkeit und erreichbare "
          "Anschlussquoten sind noch nicht abschließend geprüft.",
     "beispiele": ["gemischte Wohnbebauung", "Gewerbegebiete mit wenigen Abnehmern"],
     "seite": 117},
]

CONTROLLING = [
    {"t": "Jahresbericht", "s": 174, "im_monitor": "teilweise",
     "d": "Einmal jährlich ein qualitativer Kurzbericht zum Umsetzungsstand an "
          "Politik und Öffentlichkeit. Der Monitor liefert dafür die Zahlenbasis "
          "und den Druckbereich je Ansicht, nicht den Berichtstext."},
    {"t": "Prüfung relevanter Indikatoren", "s": 174, "im_monitor": "ja",
     "d": "Nachverfolgung der Kennwerte aus Tabelle 26 — jährlich erfassbar, aus "
          "der Bilanzfortschreibung und aus der fünfjährigen Fortschreibung."},
    {"t": "Fortschreibung der Energie- und Treibhausgasbilanz", "s": 175, "im_monitor": "ja",
     "d": "Endenergie nach Energieträgern und Sektoren, Treibhausgase nach "
          "Energieträgern — im Monitor als Zielpfad je Stützjahr hinterlegt."},
    {"t": "Multiprojektmanagement", "s": 175, "im_monitor": "teilweise",
     "d": "Steuerung aller Maßnahmen auf ein bilanzielles Gesamtziel für 2030, "
          "2035 und 2040. Der Monitor führt die Maßnahmen und die Zielmarken, "
          "die Projektsteuerung selbst ersetzt er nicht."},
]


def main():
    ind = lade("endbericht_indikatoren")["indikatoren"]
    mas = lade("endbericht_massnahmen")["massnahmen"]
    eck = lade("endbericht_eckwerte")["eckwerte"]
    thg = lade("endbericht_thg")
    geb = lade("endbericht_gebaeude")
    ene = lade("endbericht_endenergie")
    fwm = lade("endbericht_fernwaerme_mix")
    netze = lade("endbericht_netze")
    meta_src = lade("endbericht_thg")["_meta"]

    w = lambda k: eck[k]["wert"]

    # Querprobe: Der Zielwert „~150 FW-Anschlüsse/Jahr" (Tabelle 26) lässt sich
    # aus zwei unabhängigen Reihen desselben Berichts nachrechnen — einmal über
    # die Adressen (Tabelle 26), einmal über die Gebäude (Tabelle 43).
    jahre = ZIELJAHR - BASISJAHR_X
    adr = {i["indikator"]: i for i in ind}
    fw_adr_delta = adr["Adressen mit FW"]["ziel_num"] - adr["Adressen mit FW"]["referenz_num"]
    fw_geb = geb["werte"]["fernwaerme"]
    fw_geb_delta = fw_geb["2045"] - fw_geb["Basisjahr"]
    querprobe = {
        "genannt": w("fw_anschluesse_pro_jahr"),
        "aus_adressen": r(fw_adr_delta / jahre),
        "aus_gebaeuden": r(fw_geb_delta / jahre),
        "jahre": r(jahre),
        "seiten": "130, 186",
    }

    payload = {
        "meta": {
            "stand": meta_src["abruf"],
            "quellen": QUELLEN,
            "ratsbeschluss": meta_src["ratsbeschluss"],
            "redaktionsdatum": meta_src["redaktionsdatum"],
            "zieljahr": ZIELJAHR,
            "basisjahr": f"{BASISJAHR_VON}–{BASISJAHR_BIS}",
            "basisjahr_x": BASISJAHR_X,
            "stuetzjahre": STUETZJAHRE,
            "einwohner": w("einwohner"),
            "seiten_gesamt": meta_src["seiten_gesamt"],
        },
        "annahmen": ANNAHMEN,
        "leitzahl": leitzahl(ind),
        "eckwerte": {k: v["wert"] for k, v in eck.items()},
        "eckwerte_seiten": {k: v["seite"] for k, v in eck.items()},
        "indikatoren": ind,
        "massnahmen": mas,
        "massnahmen_strategiefelder": sorted({m["strategiefeld"] for m in mas}),
        "pruefgebiete": PRUEFGEBIETE,
        "controlling": CONTROLLING,
        "thg": {"einheit": thg["einheit"], "werte": thg["werte"],
                "gegenprobe": thg_gegenprobe(thg["werte"])},
        "endenergie": ene,
        "fernwaerme_mix": fwm,
        "gebaeude": geb,
        "netze": netze,
        "investitionen": investitionen(eck, thg["werte"]),
        "abgleich": registerabgleich(eck, mas, geb, ind),
        "querprobe_fw": querprobe,
        "querprobe_energie": ene["gegenprobe_fliesstext"],
    }

    out = os.path.join(ROOT, "data.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER + "window.KANDUIT_WWM = " +
                 json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")) + ";\n")
    print("wrote", out, f"({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
