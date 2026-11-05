import type { GolfClub, Review } from '../types';
import { formatDistance } from '../lib/geo';
import { ratingFor } from '../lib/rating';
import { StarRating } from './StarRating';

interface Props {
  clubs: Array<GolfClub & { distance: number | null }>;
  reviews: Review[];
  favorites: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ClubList({ clubs, reviews, favorites, selectedId, onSelect }: Props) {
  if (!clubs.length) {
    return <p className="empty">Keine Golfplätze gefunden. Verschiebe die Karte oder zoome heraus.</p>;
  }
  return (
    <ul className="club-list">
      {clubs.map((c) => {
        const r = ratingFor(c, reviews);
        return (
          <li key={c.id}>
            <button className={`club-item${c.id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(c.id)}>
              <div className="club-item-head">
                <span className="club-name">
                  {favorites.includes(c.id) && <span className="fav-dot" title="Favorit">♥</span>}
                  {c.name}
                </span>
                {c.distance != null && <span className="distance">{formatDistance(c.distance)}</span>}
              </div>
              <div className="club-item-meta">
                {r.count ? (
                  <>
                    <StarRating value={r.average} size={13} />
                    <span>{r.average.toFixed(1).replace('.', ',')} ({r.count})</span>
                  </>
                ) : (
                  <span className="muted">Noch keine Bewertungen</span>
                )}
                {c.holes && <span className="chip">{c.holes} Loch</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
