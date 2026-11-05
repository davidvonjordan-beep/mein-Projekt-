import { useCallback, useEffect, useState } from 'react';
import type { GolfClub } from '../types';
import { api, type RatingSummary, type ServerReview } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DEMO } from '../lib/demo';
import { formatDistance } from '../lib/geo';
import { ratingFor } from '../lib/rating';
import { StarRating } from './StarRating';

interface Props {
  club: GolfClub;
  distance: number | null;
  rating?: RatingSummary;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onViewCourse: () => void;
  onPlay: () => void;
  onReviewed: () => void;
  onRequireLogin: (reason: string) => void;
}

export function ClubDetail({ club, distance, rating: serverRating, isFavorite, onClose, onToggleFavorite, onViewCourse, onPlay, onReviewed, onRequireLogin }: Props) {
  const { user, serverAvailable } = useAuth();
  const hasServer = serverAvailable === true;
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [clubReviews, setClubReviews] = useState<ServerReview[] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const rating = ratingFor(club, serverRating);
  const mine = clubReviews?.find((r) => r.mine);

  const loadReviews = useCallback(() => {
    if (!hasServer) return setClubReviews([]);
    api
      .reviews(club.id)
      .then(setClubReviews)
      .catch(() => setClubReviews([]));
  }, [club.id, hasServer]);
  useEffect(loadReviews, [loadReviews, user]);

  // Eigene Bewertung zum Bearbeiten vorausfüllen
  useEffect(() => {
    if (mine) {
      setStars(mine.stars);
      setText(mine.text);
    }
  }, [mine]);
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${club.lat},${club.lon}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars) return;
    setSending(true);
    setReviewError(null);
    try {
      await api.addReview(club.id, stars, text.trim());
      loadReviews();
      onReviewed();
    } catch (err) {
      setReviewError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <h2>{club.name}</h2>
          <div className="detail-rating">
            {rating.count ? (
              <>
                <strong>{rating.average.toFixed(1).replace('.', ',')}</strong>
                <StarRating value={rating.average} />
                <span className="muted">({rating.count} Bewertungen)</span>
              </>
            ) : (
              <span className="muted">Noch keine Bewertungen</span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onPlay}>⛳ Auf dem Platz</button>
        <button className="btn" onClick={onViewCourse}>🛰️ Platz ansehen</button>
        <a className="btn" href={routeUrl} target="_blank" rel="noreferrer">🧭 Route</a>
        <button className={`btn${isFavorite ? ' fav-on' : ''}`} onClick={onToggleFavorite}>
          {isFavorite ? '♥ Gemerkt' : '♡ Merken'}
        </button>
      </div>

      <div className="facts">
        {distance != null && <Fact label="Entfernung" value={formatDistance(distance)} />}
        {club.holes && <Fact label="Löcher" value={String(club.holes)} />}
        {club.par && <Fact label="Par" value={String(club.par)} />}
      </div>

      {club.description && <p className="description">{club.description}</p>}

      <dl className="info">
        {club.address && <Info label="Adresse" value={club.address} />}
        {club.openingHours && <Info label="Öffnungszeiten" value={club.openingHours} />}
        {club.phone && <Info label="Telefon" value={<a href={`tel:${club.phone}`}>{club.phone}</a>} />}
        {club.email && <Info label="E-Mail" value={<a href={`mailto:${club.email}`}>{club.email}</a>} />}
        {club.website && (
          <Info label="Website" value={<a href={club.website} target="_blank" rel="noreferrer">{club.website.replace(/^https?:\/\//, '')}</a>} />
        )}
      </dl>

      <section className="reviews">
        <h3>Bewertungen</h3>
        {!hasServer ? (
          <p className="muted small">
            {DEMO
              ? 'In der Demo-Version können keine Bewertungen abgegeben werden – dafür braucht es den GolfMap-Server.'
              : 'Bewertungen abgeben ist bald möglich – dafür wird gerade der GolfMap-Server eingerichtet.'}
          </p>
        ) : user ? (
          <form className="review-form" onSubmit={submit}>
            <label>{mine ? 'Deine Bewertung bearbeiten' : `Deine Bewertung als ${user.name}`}</label>
            <StarRating value={stars} onChange={setStars} size={26} />
            <textarea placeholder="Wie war der Platz? Greens, Service, Preis-Leistung …" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            {reviewError && <p className="error">{reviewError}</p>}
            <button className="btn primary" disabled={!stars || sending}>
              {sending ? 'Wird gespeichert …' : mine ? 'Bewertung aktualisieren' : 'Bewertung abgeben'}
            </button>
          </form>
        ) : (
          <div className="review-form">
            <p className="small">Melde dich an, um diesen Platz zu bewerten.</p>
            <button className="btn primary" onClick={() => onRequireLogin('Melde dich an, um Plätze zu bewerten.')}>Anmelden</button>
          </div>
        )}
        {clubReviews === null && <p className="muted small">Lade Bewertungen …</p>}
        {clubReviews?.map((r) => (
          <article key={r.id} className="review">
            <div className="review-head">
              <strong>{r.author}{r.mine && ' (du)'}</strong>
              <StarRating value={r.stars} size={13} />
              <span className="muted">{new Date(r.date).toLocaleDateString('de-DE')}</span>
            </div>
            {r.text && <p>{r.text}</p>}
          </article>
        ))}
      </section>

      <p className="source muted">
        {club.source === 'osm' ? 'Daten: © OpenStreetMap-Mitwirkende' : 'Demo-Daten (fiktiver Club)'}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span className="fact-value">{value}</span>
      <span className="fact-label">{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
