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

- 👤 Konto (E-Mail + Passwort): Bewertungen für alle sichtbar, Runden, Schläge und Favoriten
  werden gesichert und zwischen Geräten synchronisiert – auch offline auf dem Platz nutzbar

## Aufbau
- `app/` – Web-App (React, Vite, Leaflet)
- `server/` – API-Server (Node.js, Express, SQLite) für Konten, Bewertungen, Favoriten und Runden

## Datenquellen
- Golfplätze: OpenStreetMap über die Overpass API (kostenlos, kein API-Key)
- Karte: OpenStreetMap-Kacheln · Satellit: Esri World Imagery
- Fällt OpenStreetMap aus, werden fiktive Demo-Clubs (inkl. erfundenem 9-Loch-Layout) angezeigt
- Loch-Daten gibt es nur für Plätze, die in OpenStreetMap detailliert erfasst sind
- Bewertungen, Favoriten, Runden & Schläge: GolfMap-Server (SQLite-Datei `server/data/golfmap.db`)
- Ohne Anmeldung bleiben Runden & Favoriten lokal im Browser; beim Anmelden werden sie ins Konto übernommen

## Starten (Entwicklung)
Benötigt Node.js 22.18 oder neuer. Zwei Terminals:
```bash
# 1. Server (http://localhost:3001)
cd server
npm install
npm run dev

# 2. App (http://localhost:5173, leitet /api an den Server weiter)
cd app
npm install
npm run dev
```
Tests des Servers: `cd server && npm test`

Demo ohne Server als eine HTML-Datei (z. B. zum Teilen): `cd app && npm run build:demo` → `app/dist-demo/index.html`

## Betrieb (Produktion)
```bash
cd app && npm install && npm run build      # baut die App nach app/dist
cd ../server && npm install && npm start    # liefert App + API auf Port 3001 aus
```
Einstellungen per Umgebungsvariablen: `PORT`, `DB_FILE` (Pfad zur SQLite-Datei), `STATIC_DIR`.
Wichtig: Öffentlich nur über **HTTPS** betreiben (sonst kein GPS im Handy-Browser und unsichere Logins)
und die Datenbankdatei regelmäßig sichern.

## Nächste Schritte (Ideen)
- Passwort vergessen (E-Mail-Versand), Bewertungen melden/moderieren
- Server online stellen (z. B. Render, Fly.io, Hetzner)
- Fotos der Plätze, Greenfee-Preise, Startzeiten-Buchung
- Handicap-Berechnung, Statistik zu Fairway-/Grüntreffern und Putts
- Als echte iOS/Android-App verpacken (z. B. PWA oder Capacitor)
