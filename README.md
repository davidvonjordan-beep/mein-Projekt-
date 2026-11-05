# GolfMap ⛳

Eine Art „Google Maps für Golfer“: Die App zeigt alle Golfplätze in deiner Nähe auf einer Karte,
mit Infos, Satellitenansicht des Platzes und Bewertungen.

## Features (v0.1)
- 📍 Standort ermitteln und Golfplätze im Umkreis von 25 km anzeigen
- 🗺️ Karte mit Golf-Markern, „In diesem Bereich suchen“ beim Verschieben
- 📋 Liste sortierbar nach Entfernung, Bewertung oder Name, Suche nach Name/Ort
- ℹ️ Detailseite: Löcher, Par, Adresse, Öffnungszeiten, Telefon, Website, Route
- 🛰️ „Platz ansehen“: Satellitenbild zoomt direkt auf den Golfplatz
- ⭐ Bewertungen abgeben (Sterne + Text) und Favoriten merken
- ⛳ **Auf dem Platz**: Lochübersicht mit Fairways, Grüns, Bunkern und Wasser (aus OpenStreetMap),
  GPS-Entfernungsmesser zum Grün (vorne / Mitte / hinten), Messen per Antippen der Karte,
  Meter/Yards und Scorekarte (Schläge pro Loch, Gesamt zu Par)
- 🏌️ Schläge erfassen: Schläger wählen, „Schlag von hier“ (GPS oder angetippte Ballposition) –
  die Weite wird bis zum nächsten Schlag gemessen; Schlägerempfehlung nach deinen Durchschnittsweiten
- 📊 Meine Runden: gespeicherte Runden mit Scorekarte und Ergebnis zu Par, Schlägerweiten-Statistik
- 🧭 Karte dreht sich automatisch in Spielrichtung (Abschlag unten, Grün oben), per Kompass-Knopf umschaltbar auf Norden oben
- 📱 Mobil: Bottom-Sheet wie bei Google Maps · Desktop: Seitenleiste

## Datenquellen
- Golfplätze: OpenStreetMap über die Overpass API (kostenlos, kein API-Key)
- Karte: OpenStreetMap-Kacheln · Satellit: Esri World Imagery
- Fällt OpenStreetMap aus, werden fiktive Demo-Clubs (inkl. erfundenem 9-Loch-Layout) angezeigt
- Loch-Daten gibt es nur für Plätze, die in OpenStreetMap detailliert erfasst sind
- Bewertungen, Favoriten, Runden & Schläge werden aktuell nur lokal im Browser gespeichert

## Starten
```bash
cd app
npm install
npm run dev
```
Dann http://localhost:5173 öffnen (Standortfreigabe erlauben).

## Nächste Schritte (Ideen)
- Backend + Login, damit Bewertungen für alle Nutzer sichtbar sind
- Fotos der Plätze, Greenfee-Preise, Startzeiten-Buchung
- Handicap-Berechnung, Statistik zu Fairway-/Grüntreffern und Putts
- Als echte iOS/Android-App verpacken (z. B. PWA oder Capacitor)
