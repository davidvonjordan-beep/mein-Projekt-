import type { GolfClub } from '../types';

/**
 * Fiktive Beispiel-Clubs, relativ zur aktuellen Position verteilt.
 * Werden nur angezeigt, wenn OpenStreetMap nicht erreichbar ist.
 */
const TEMPLATES: Array<Omit<GolfClub, 'id' | 'lat' | 'lon' | 'source'> & { dLat: number; dLon: number }> = [
  { name: 'Golfclub Am Lindenhof (Demo)', dLat: 0.05, dLon: 0.08, holes: 18, par: 72, baseRating: 4.6, baseRatingCount: 128,
    description: 'Gepflegter Parkland-Platz mit altem Baumbestand, Driving Range und Clubrestaurant.', phone: '+49 000 000001', openingHours: 'Mo-So 08:00-19:00' },
  { name: 'Golfpark Seewiesen (Demo)', dLat: -0.07, dLon: 0.04, holes: 27, par: 72, baseRating: 4.2, baseRatingCount: 86,
    description: 'Drei kombinierbare 9-Loch-Schleifen rund um zwei Seen. Öffentlicher Kurzplatz für Einsteiger.' },
  { name: 'Golf & Country Club Hügelland (Demo)', dLat: 0.11, dLon: -0.09, holes: 18, par: 71, baseRating: 4.8, baseRatingCount: 203,
    description: 'Anspruchsvoller Platz mit Höhenunterschieden und Panoramablick. Gäste mit Handicap bis 36 willkommen.' },
  { name: 'Öffentlicher Golfplatz Feldmark (Demo)', dLat: -0.03, dLon: -0.12, holes: 9, par: 33, baseRating: 3.9, baseRatingCount: 41,
    description: 'Unkomplizierter 9-Loch-Platz ohne Mitgliedschaft – ideal für Anfänger und After-Work-Runden.' },
  { name: 'Golfresort Schlossgut (Demo)', dLat: 0.16, dLon: 0.15, holes: 36, par: 72, baseRating: 4.5, baseRatingCount: 312,
    description: 'Zwei Meisterschaftsplätze, Hotel am Schloss und große Übungsanlage.' },
];

export function demoClubsAround(lat: number, lon: number): GolfClub[] {
  return TEMPLATES.map(({ dLat, dLon, ...rest }, i) => ({
    ...rest,
    id: `demo-${i}`,
    lat: lat + dLat,
    lon: lon + dLon,
    source: 'demo',
  }));
}
