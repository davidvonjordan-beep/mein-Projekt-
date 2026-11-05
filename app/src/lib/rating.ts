import type { GolfClub, Review } from '../types';

export interface RatingSummary {
  average: number;
  count: number;
}

export function ratingFor(club: GolfClub, reviews: Review[]): RatingSummary {
  const own = reviews.filter((r) => r.clubId === club.id);
  const baseCount = club.baseRatingCount ?? 0;
  const baseSum = (club.baseRating ?? 0) * baseCount;
  const count = baseCount + own.length;
  const sum = baseSum + own.reduce((s, r) => s + r.stars, 0);
  return { average: count ? sum / count : 0, count };
}
