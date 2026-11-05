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

export type LatLon = [number, number];

export type CourseFeatureKind = 'fairway' | 'green' | 'tee' | 'bunker' | 'water' | 'rough';

export interface CourseFeature {
  kind: CourseFeatureKind;
  polygon: LatLon[];
}

export interface CourseHole {
  ref: number;
  par?: number;
  handicap?: number;
  /** Spiellinie vom Abschlag zum Grün */
  path: LatLon[];
}

export interface CourseLayout {
  holes: CourseHole[];
  features: CourseFeature[];
  pins: LatLon[];
}

export interface Shot {
  hole: number;
  club: string;
  pos: LatLon;
  t: number;
}

export interface Round {
  id: string;
  clubId: string;
  clubName: string;
  date: string;
  scores: Record<number, number>;
  pars: Record<number, number>;
  shots: Shot[];
}
