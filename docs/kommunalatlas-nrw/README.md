# Kommunalatlas NRW

Interaktive Datenlandkarte für kommunale Entscheidungen in Nordrhein-Westfalen.

Ein Portfolio-Projekt von [Kanduit](https://kanduit.de) — Digitalisierung, Daten & Software für den öffentlichen Sektor in NRW.

## Überblick

Der Kommunalatlas visualisiert demografische und wirtschaftliche Kennzahlen aller 53 Kreise und kreisfreien Städte in NRW auf einer interaktiven Karte. Kommunen können so ihre Region im Landesvergleich einordnen und datenbasierte Entscheidungen treffen.

### Funktionen

- **Choropleth-Karte** — NRW-Kreise eingefärbt nach wählbarer Kennzahl
- **5 Kennzahlen** — Bevölkerung, Bevölkerungsentwicklung, Arbeitslosenquote, Anteil Ü65, BIP pro Kopf
- **Detail-Panel** — Klick auf einen Kreis zeigt Profil mit Statistiken und Charts
- **Vergleich** — Balkendiagramm gegen NRW-Durchschnitt
- **Ranking-Tabelle** — Sortierbar nach jeder Kennzahl
- **Responsiv** — Desktop und Mobilgeräte

### Technologie

- [Leaflet.js](https://leafletjs.com/) für die interaktive Karte
- [Chart.js](https://www.chartjs.org/) für Diagramme
- Statisches HTML/CSS/JS — kein Backend, kein Framework
- Gehostet auf GitHub Pages (kostenlos)

## Datenquellen

| Quelle | Daten | Lizenz |
|--------|-------|--------|
| [Open.NRW / BKG](https://www.opengeodata.nrw.de/) | Verwaltungsgrenzen (GeoJSON) | Datenlizenz Deutschland – Zero 2.0 |
| [IT.NRW Kommunalprofile](https://statistik.nrw/) | Bevölkerung, Altersstruktur | Datenlizenz Deutschland – Namensnennung 2.0 |
| [Landesdatenbank NRW](https://www.landesdatenbank.nrw.de/) | Wirtschaftsdaten | Datenlizenz Deutschland – Namensnennung 2.0 |
| [Bundesagentur für Arbeit](https://statistik.arbeitsagentur.de/) | Arbeitsmarktdaten | Datenlizenz Deutschland – Namensnennung 2.0 |
| [VGR der Länder](https://www.statistikportal.de/de/vgrdl) | BIP pro Kopf | Datenlizenz Deutschland – Namensnennung 2.0 |

## Lokal starten

```bash
python3 -m http.server 8765
# Dann http://localhost:8765 öffnen
```

## Lizenz

Code: MIT. Daten: siehe Datenquellen oben.

---

Erstellt von [Kanduit](https://kanduit.de) — Ihr Partner für die digitale Verwaltung in NRW.
