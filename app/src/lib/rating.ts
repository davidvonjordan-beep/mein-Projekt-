import type { GolfClub } from '../types';
import type { RatingSummary as ServerSummary } from './api';

export interface RatingSummary {
  average: number;
  count: number;
}

/** Kombiniert Bewertungen aus der Datenquelle (Demo) mit den Bewertungen der App-Nutzer. */
export function ratingFor(club: GolfClub, server?: ServerSummary): RatingSummary {
  const baseCount = club.baseRatingCount ?? 0;
  const baseSum = (club.baseRating ?? 0) * baseCount;
  const count = baseCount + (server?.count ?? 0);
  const sum = baseSum + (server ? server.avg * server.count : 0);
  return { average: count ? sum / count : 0, count };
}
