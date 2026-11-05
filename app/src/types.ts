export interface GolfClub {
  id: string;
  name: string;
  lat: number;
  lon: number;
  holes?: number;
  par?: number;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingHours?: string;
  description?: string;
  /** Bewertung aus der Datenquelle (z. B. Demo-Daten) */
  baseRating?: number;
  baseRatingCount?: number;
  source: 'osm' | 'demo';
}

export interface Review {
  clubId: string;
  stars: number;
  text: string;
  author: string;
  date: string;
}
