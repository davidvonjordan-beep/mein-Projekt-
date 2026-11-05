import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GolfClub } from './types';
import { ClubMap, type MapStyle } from './components/ClubMap';
import { ClubList } from './components/ClubList';
import { ClubDetail } from './components/ClubDetail';
import { CourseOverlay } from './components/CourseOverlay';
import { CoursePanel } from './components/CoursePanel';
import { StatsView } from './components/StatsView';
import { useCourse } from './lib/useCourse';
import { fetchGolfClubs } from './lib/overpass';
import { demoClubsAround } from './data/demoClubs';
import { distanceKm } from './lib/geo';
import { ratingFor } from './lib/rating';
import { loadFavorites, saveFavorites } from './lib/storage';
import { api, type RatingSummary } from './lib/api';
import { useAuth } from './lib/auth';
import { AuthDialog } from './components/AuthDialog';
import { DEMO } from './lib/demo';

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
  const { user, logout, serverAvailable } = useAuth();
  const hasServer = serverAvailable === true;
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [ratingsKey, setRatingsKey] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
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
      if (DEMO) throw new Error('Demo-Modus');
      const result = await fetchGolfClubs(lat, lon, radius, ctrl.signal);
      setClubs(result);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setClubs(demoClubsAround(lat, lon));
      if (!DEMO) setNotice('OpenStreetMap ist gerade nicht erreichbar – es werden Demo-Clubs angezeigt.');
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
    if (DEMO || !navigator.geolocation) return start(FALLBACK);
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

  // Bewertungen der App-Nutzer für die geladenen Clubs holen
  useEffect(() => {
    if (!clubs.length || !hasServer) return;
    let cancelled = false;
    api
      .ratings(clubs.slice(0, 300).map((c) => c.id))
      .then((r) => !cancelled && setRatings(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clubs, ratingsKey, hasServer]);

  // Favoriten: angemeldet → vom Server (lokale werden einmalig übernommen), sonst lokal
  useEffect(() => {
    if (!user) {
      setFavorites(loadFavorites());
      return;
    }
    const local = loadFavorites();
    Promise.all(local.map((id) => api.addFavorite(id)))
      .then(() => api.favorites())
      .then((f) => {
        setFavorites(f);
        saveFavorites([]);
      })
      .catch(() => undefined);
  }, [user]);

  const toggleFavorite = (id: string) => {
    const isFav = favorites.includes(id);
    const next = isFav ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavorites(next);
    if (!user) return saveFavorites(next);
    (isFav ? api.removeFavorite(id) : api.addFavorite(id)).catch(() => {
      setFavorites(favorites); // zurücksetzen, wenn der Server nicht erreichbar ist
      setNotice('Favorit konnte nicht gespeichert werden – keine Verbindung zum Server.');
    });
  };

  const ref = userPos ?? center;
  const visibleClubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clubs
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q))
      .filter((c) => !onlyFavs || favorites.includes(c.id))
      .map((c) => ({ ...c, distance: ref ? distanceKm(ref[0], ref[1], c.lat, c.lon) : null }));
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'de');
      if (sort === 'rating') return ratingFor(b, ratings[b.id]).average - ratingFor(a, ratings[a.id]).average;
      return (a.distance ?? 0) - (b.distance ?? 0);
    });
    return list;
  }, [clubs, query, onlyFavs, favorites, ref, sort, ratings]);

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
        bearing={courseClub ? course.bearing : 0}
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
            shots={course.holeShots}
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
        {hasServer && (
        <div className="user-area">
          <button
            className={`avatar${user ? ' on' : ''}`}
            onClick={() => (user ? setUserMenu(!userMenu) : setAuthReason(''))}
            title={user ? user.name : 'Anmelden'}
            aria-label={user ? `Konto von ${user.name}` : 'Anmelden'}
          >
            {user ? user.name.slice(0, 1).toUpperCase() : '👤'}
          </button>
          {user && userMenu && (
            <div className="user-menu">
              <strong>{user.name}</strong>
              <span className="muted small">{user.email}</span>
              <button
                className="btn"
                onClick={async () => {
                  setUserMenu(false);
                  await logout();
                }}
              >
                Abmelden
              </button>
            </div>
          )}
        </div>
        )}
      </header>

      <div className="map-controls">
        {!DEMO && (
          <button className="fab" onClick={() => setMapStyle(mapStyle === 'map' ? 'satellite' : 'map')} title="Kartenansicht wechseln">
            {mapStyle === 'map' ? '🛰️' : '🗺️'}
          </button>
        )}
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

      {courseClub && course.hole && (
        <div className="map-controls course-controls">
          <button
            className={`fab compass${course.followHole ? ' on' : ''}`}
            onClick={() => course.setFollowHole(!course.followHole)}
            title={course.followHole ? 'Norden nach oben' : 'In Spielrichtung drehen'}
            aria-label={course.followHole ? 'Norden nach oben' : 'In Spielrichtung drehen'}
          >
            <span className="needle" style={{ transform: `rotate(${-course.bearing}deg)` }}>
              <span className="n">N</span>▲
            </span>
          </button>
        </div>
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
            onFinishRound={course.finishRound}
            holeShots={course.holeShots}
            shotPos={course.shotPos}
            selectedClub={course.selectedClub}
            suggestion={course.suggestion}
            onSelectClub={course.setSelectedClub}
            onRecordShot={course.recordShot}
            onUndoShot={course.undoShot}
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
            rating={ratings[selected.id]}
            isFavorite={favorites.includes(selected.id)}
            onClose={() => setSelectedId(null)}
            onToggleFavorite={() => toggleFavorite(selected.id)}
            onViewCourse={() => {
              setMapStyle('satellite');
              setFocus({ lat: selected.lat, lon: selected.lon, zoom: 16 });
              if (window.innerWidth < 768) setSheetOpen(false);
            }}
            onPlay={() => setCourseClub(selected)}
            onReviewed={() => setRatingsKey((k) => k + 1)}
            onRequireLogin={setAuthReason}
          />
        ) : statsOpen ? (
          <StatsView onClose={() => setStatsOpen(false)} onLogin={() => setAuthReason('Melde dich an, um deine Runden zu sichern.')} />
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
                <button className="chip-btn" onClick={() => setStatsOpen(true)}>
                  📊 Meine Runden
                </button>
              </div>
              {DEMO && (
                <p className="notice demo-note">
                  <strong>Demo-Version.</strong> Erfundene Clubs rund um München, ohne Kartenbild und Login. Probier „⛳ Auf dem Platz“ aus!
                </p>
              )}
              {notice && <p className="notice">{notice}</p>}
            </div>
            <ClubList clubs={visibleClubs} ratings={ratings} favorites={favorites} selectedId={selectedId} onSelect={select} />
          </>
        )}
      </aside>
      )}

      {authReason !== null && <AuthDialog reason={authReason || undefined} onClose={() => setAuthReason(null)} />}
    </div>
  );
}
