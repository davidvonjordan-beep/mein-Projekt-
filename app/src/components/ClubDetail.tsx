import { useState } from 'react';
import type { GolfClub, Review } from '../types';
import { formatDistance } from '../lib/geo';
import { ratingFor } from '../lib/rating';
import { StarRating } from './StarRating';

interface Props {
  club: GolfClub;
  distance: number | null;
  reviews: Review[];
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onViewCourse: () => void;
  onAddReview: (stars: number, text: string, author: string) => void;
}

export function ClubDetail({ club, distance, reviews, isFavorite, onClose, onToggleFavorite, onViewCourse, onAddReview }: Props) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const rating = ratingFor(club, reviews);
  const clubReviews = reviews.filter((r) => r.clubId === club.id).slice().reverse();
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${club.lat},${club.lon}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars) return;
    onAddReview(stars, text.trim(), author.trim() || 'Anonym');
    setStars(0);
    setText('');
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
        <button className="btn primary" onClick={onViewCourse}>🛰️ Platz ansehen</button>
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
        <form className="review-form" onSubmit={submit}>
          <label>Deine Bewertung</label>
          <StarRating value={stars} onChange={setStars} size={26} />
          <input placeholder="Dein Name (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <textarea placeholder="Wie war der Platz? Greens, Service, Preis-Leistung …" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <button className="btn primary" disabled={!stars}>Bewertung abgeben</button>
        </form>
        {clubReviews.map((r, i) => (
          <article key={i} className="review">
            <div className="review-head">
              <strong>{r.author}</strong>
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
