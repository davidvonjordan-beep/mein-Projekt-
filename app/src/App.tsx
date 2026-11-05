import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GolfClub, Review } from './types';
import { ClubMap, type MapStyle } from './components/ClubMap';
import { ClubList } from './components/ClubList';
import { ClubDetail } from './components/ClubDetail';
import { CourseOverlay } from './components/CourseOverlay';
import { CoursePanel } from './components/CoursePanel';
import { useCourse } from './lib/useCourse';
import { fetchGolfClubs } from './lib/overpass';
import { demoClubsAround } from './data/demoClubs';
import { distanceKm } from './lib/geo';
import { ratingFor } from './lib/rating';
import { loadFavorites, loadReviews, saveFavorites, saveReviews } from './lib/storage';

const FALLBACK: [number, number] = [48.137, 11.575]; // München
const INITIAL_RADIUS = 25_000;

type Sort = 'distance' | 'rating' | 'name';

export default function App() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [clubs, setClubs] = useState<GolfClub[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('distance');
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('map');
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom: number } | null>(null);
  const [pendingArea, setPendingArea] = useState<{ lat: number; lon: number; r: number } | null>(null);
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [courseClub, setCourseClub] = useState<GolfClub | null>(null);
  const course = useCourse(courseClub);
  const abortRef = useRef<AbortController | null>(null);
  const lastSearch = useRef<{ lat: number; lon: number } | null>(null);

  const search = useCallback(async (lat: number, lon: number, radius: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    lastSearch.current = { lat, lon };
    setPendingArea(null);
    setLoading(true);
    setNotice(null);
    try {
      const result = await fetchGolfClubs(lat, lon, radius, ctrl.signal);
      setClubs(result);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setClubs(demoClubsAround(lat, lon));
      setNotice('OpenStreetMap ist gerade nicht erreichbar – es werden Demo-Clubs angezeigt.');
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  // Standort ermitteln
  useEffect(() => {
    const start = (pos: [number, number]) => {
      setCenter(pos);
      search(pos[0], pos[1], INITIAL_RADIUS);
    };
    if (!navigator.geolocation) return start(FALLBACK);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setUserPos(pos);
        start(pos);
      },
      () => {
        setNotice('Standort nicht verfügbar – zeige Umgebung München.');
        start(FALLBACK);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, [search]);

  useEffect(() => saveReviews(reviews), [reviews]);
  useEffect(() => saveFavorites(favorites), [favorites]);

  const ref = userPos ?? center;
  const visibleClubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clubs
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q))
      .filter((c) => !onlyFavs || favorites.includes(c.id))
      .map((c) => ({ ...c, distance: ref ? distanceKm(ref[0], ref[1], c.lat, c.lon) : null }));
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'de');
      if (sort === 'rating') return ratingFor(b, reviews).average - ratingFor(a, reviews).average;
      return (a.distance ?? 0) - (b.distance ?? 0);
    });
    return list;
  }, [clubs, query, onlyFavs, favorites, ref, sort, reviews]);

  const selected = visibleClubs.find((c) => c.id === selectedId) ?? clubs.find((c) => c.id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
    const c = clubs.find((x) => x.id === id);
    if (c) setFocus({ lat: c.lat, lon: c.lon, zoom: 13 });
  };

  const onMoved = useCallback((lat: number, lon: number, r: number) => {
    const last = lastSearch.current;
    if (!last || distanceKm(last.lat, last.lon, lat, lon) > 3) setPendingArea({ lat, lon, r });
  }, []);

  if (!center) {
    return (
      <div className="splash">
        <div className="splash-logo">⛳</div>
        <p>Suche Golfplätze in deiner Nähe …</p>
      </div>
    );
  }

  return (
    <div className="app">
      <ClubMap
        center={center}
        userPos={userPos}
        clubs={courseClub ? [] : visibleClubs}
        selectedId={selectedId}
        style={courseClub ? 'satellite' : mapStyle}
        focus={focus}
        fit={courseClub ? course.fit : null}
        onSelect={select}
        onMoved={onMoved}
        onMapClick={courseClub ? (lat, lon) => course.setMeasure([lat, lon]) : undefined}
      >
        {courseClub && course.layout && (
          <CourseOverlay
            layout={course.layout}
            hole={course.hole}
            target={course.target?.target ?? null}
            player={course.player}
            playerIsGps={course.onCourse}
            measure={course.measure}
            unit={course.unit}
          />
        )}
      </ClubMap>

      {!courseClub && (
      <>
      <header className="topbar">
        <div className="brand">⛳ <span>GolfMap</span></div>
        <input
          className="search"
          type="search"
          placeholder="Club oder Ort suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className="map-controls">
        <button className="fab" onClick={() => setMapStyle(mapStyle === 'map' ? 'satellite' : 'map')} title="Kartenansicht wechseln">
          {mapStyle === 'map' ? '🛰️' : '🗺️'}
        </button>
        {userPos && (
          <button className="fab" onClick={() => setFocus({ lat: userPos[0], lon: userPos[1], zoom: 11 })} title="Mein Standort">
            📍
          </button>
        )}
      </div>

      {(pendingArea || loading) && (
        <button
          className="search-area"
          disabled={loading}
          onClick={() => pendingArea && search(pendingArea.lat, pendingArea.lon, pendingArea.r)}
        >
          {loading ? 'Lade Golfplätze …' : '🔍 In diesem Bereich suchen'}
        </button>
      )}

      </>
      )}

      {courseClub ? (
        <aside className="panel open course-panel">
          <CoursePanel
            club={courseClub}
            layout={course.layout}
            loading={course.loading}
            notice={course.notice}
            hole={course.hole}
            holeIdx={course.holeIdx}
            distances={course.distances}
            measureDistances={course.measureDistances}
            positionInfo={{ gps: course.onCourse, accuracy: course.gpsAccuracy }}
            unit={course.unit}
            scores={course.scores}
            onUnit={course.setUnit}
            onHole={course.selectHole}
            onScore={course.setScore}
            onResetScores={course.resetScores}
            onClearMeasure={() => course.setMeasure(null)}
            onExit={() => {
              setCourseClub(null);
              setFocus({ lat: courseClub.lat, lon: courseClub.lon, zoom: 13 });
            }}
          />
        </aside>
      ) : (
      <aside className={`panel${sheetOpen ? ' open' : ''}`}>
        <button className="sheet-handle" onClick={() => setSheetOpen(!sheetOpen)} aria-label="Liste ein-/ausklappen">
          <span />
        </button>
        {selected ? (
          <ClubDetail
            key={selected.id}
            club={selected}
            distance={ref ? distanceKm(ref[0], ref[1], selected.lat, selected.lon) : null}
            reviews={reviews}
            isFavorite={favorites.includes(selected.id)}
            onClose={() => setSelectedId(null)}
            onToggleFavorite={() =>
              setFavorites((f) => (f.includes(selected.id) ? f.filter((x) => x !== selected.id) : [...f, selected.id]))
            }
            onViewCourse={() => {
              setMapStyle('satellite');
              setFocus({ lat: selected.lat, lon: selected.lon, zoom: 16 });
              if (window.innerWidth < 768) setSheetOpen(false);
            }}
            onPlay={() => setCourseClub(selected)}
            onAddReview={(stars, text, author) =>
              setReviews((r) => [...r, { clubId: selected.id, stars, text, author, date: new Date().toISOString() }])
            }
          />
        ) : (
          <>
            <div className="panel-head">
              <h1>
                {loading ? 'Lade …' : `${visibleClubs.length} Golfplätze`}
                <span className="muted"> in der Nähe</span>
              </h1>
              <div className="filters">
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="distance">Nächste zuerst</option>
                  <option value="rating">Beste Bewertung</option>
                  <option value="name">Name A–Z</option>
                </select>
                <button className={`chip-btn${onlyFavs ? ' on' : ''}`} onClick={() => setOnlyFavs(!onlyFavs)}>
                  ♥ Favoriten
                </button>
              </div>
              {notice && <p className="notice">{notice}</p>}
            </div>
            <ClubList clubs={visibleClubs} reviews={reviews} favorites={favorites} selectedId={selectedId} onSelect={select} />
          </>
        )}
      </aside>
      )}
    </div>
  );
}
