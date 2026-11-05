import { useEffect, useMemo, useState } from 'react';
import type { CourseLayout, GolfClub, LatLon, Round } from '../types';
import { fetchCourseLayout, holeTarget } from './courseLayout';
import { demoCourseLayout } from '../data/demoCourse';
import { distM, greenDistances, toXY, type Unit } from './courseGeo';
import {
  archiveRound,
  clubStats,
  loadCurrentRound,
  loadHistory,
  newRound,
  ROUNDS_CHANGED,
  saveCurrentRound,
  suggestClub,
  syncRounds,
} from './rounds';

/** Ab dieser Entfernung zum Club gilt der Spieler als „nicht auf dem Platz“. */
const ON_COURSE_RADIUS_M = 3000;

export function useCourse(club: GolfClub | null) {
  const [layout, setLayout] = useState<CourseLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [holeIdx, setHoleIdx] = useState(0);
  const [gps, setGps] = useState<{ pos: LatLon; accuracy: number } | null>(null);
  const [measure, setMeasure] = useState<LatLon | null>(null);
  const [unit, setUnit] = useState<Unit>('m');
  const [round, setRound] = useState<Round | null>(null);
  const [selectedClub, setSelectedClub] = useState('Dr');
  const [history, setHistory] = useState<Round[]>(loadHistory);
  const [fitKey, setFitKey] = useState(0);
  const [followHole, setFollowHole] = useState(true);

  // Platzdaten laden
  useEffect(() => {
    setLayout(null);
    setNotice(null);
    setHoleIdx(0);
    setMeasure(null);
    if (!club) return;
    setRound(loadCurrentRound(club));
    const applyLayout = (l: CourseLayout) => {
      setLayout(l);
      if (!l.holes.length)
        setNotice('Für diesen Platz sind in OpenStreetMap keine Loch-Daten eingetragen. Du kannst trotzdem per Antippen messen.');
      setFitKey((k) => k + 1);
    };
    if (club.source === 'demo') {
      applyLayout(demoCourseLayout([club.lat, club.lon]));
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetchCourseLayout(club, ctrl.signal)
      .then(applyLayout)
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return;
        setLayout({ holes: [], features: [], pins: [] });
        setNotice('Platzdaten konnten nicht geladen werden. Prüfe deine Internetverbindung.');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [club]);

  // Live-GPS während des Platz-Modus
  useEffect(() => {
    if (!club || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ pos: [p.coords.latitude, p.coords.longitude], accuracy: p.coords.accuracy }),
      () => setGps(null),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [club]);

  useEffect(() => {
    if (!round) return;
    saveCurrentRound(round);
    // kurz warten, damit nicht jeder Tipp einzeln übertragen wird
    const t = setTimeout(() => syncRounds(), 3000);
    return () => clearTimeout(t);
  }, [round]);

  // Nach einem Abgleich: Historie neu laden und ggf. neuere Version der laufenden Runde übernehmen
  useEffect(() => {
    const onChange = () => {
      setHistory(loadHistory());
      if (!club) return;
      const stored = loadCurrentRound(club);
      setRound((r) => (!r || stored.id !== r.id || stored.updatedAt > r.updatedAt ? stored : r));
    };
    window.addEventListener(ROUNDS_CHANGED, onChange);
    return () => window.removeEventListener(ROUNDS_CHANGED, onChange);
  }, [club]);

  const hole = layout?.holes[holeIdx] ?? null;
  const target = useMemo(() => (hole && layout ? holeTarget(hole, layout) : null), [hole, layout]);
  const onCourse = !!(gps && club && distM(gps.pos, [club.lat, club.lon]) < ON_COURSE_RADIUS_M);
  const player: LatLon | null = onCourse ? gps!.pos : hole?.path[0] ?? null;

  const distances = player && target ? greenDistances(player, target.target, target.green) : null;
  const measureDistances =
    player && measure
      ? { toPoint: distM(player, measure), pointToGreen: target ? distM(measure, target.target) : null }
      : null;

  // Spielrichtung: Abschlag → Ziel als Kompasswinkel (0° = Norden)
  const holeBearing = useMemo(() => {
    if (!hole || !target) return 0;
    const [x, y] = toXY(target.target, hole.path[0]);
    return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  }, [hole, target]);
  const bearing = followHole && hole ? holeBearing : 0;

  const scores = round?.scores ?? {};
  const holeShots = useMemo(
    () => (round && hole ? round.shots.filter((x) => x.hole === hole.ref).sort((a, b) => a.t - b.t) : []),
    [round, hole],
  );
  /** Ballposition für den nächsten Schlag: markierter Punkt > GPS > Abschlag (erster Schlag) */
  const lastShot = holeShots[holeShots.length - 1];
  const shotPos: { pos: LatLon; source: 'measure' | 'gps' | 'tee' | 'last' } | null = measure
    ? { pos: measure, source: 'measure' }
    : onCourse
      ? { pos: gps!.pos, source: 'gps' }
      : hole && holeShots.length === 0
        ? { pos: hole.path[0], source: 'tee' }
        : selectedClub === 'Pt' && lastShot
          ? { pos: lastShot.pos, source: 'last' } // weiterer Putt ohne neue Position
          : null;

  const stats = useMemo(() => clubStats(round ? [round, ...history.filter((h) => h.id !== round.id)] : history), [round, history]);
  const suggestion = distances ? suggestClub(stats, distances.center) : null;

  const updateRound = (fn: (r: Round) => Round) => setRound((r) => (r ? { ...fn(r), updatedAt: Date.now() } : r));

  const fit = useMemo(() => {
    if (!club) return null;
    const points: LatLon[] = hole ? [...hole.path, ...(target?.green ?? [])] : [[club.lat, club.lon]];
    if (!hole && layout?.features.length) layout.features.forEach((f) => points.push(...f.polygon));
    return { points, key: fitKey * 1000 + holeIdx };
  }, [club, hole, target, layout, fitKey, holeIdx]);

  return {
    layout,
    loading,
    notice,
    hole,
    holeIdx,
    target,
    player,
    onCourse,
    gpsAccuracy: gps?.accuracy ?? null,
    distances,
    measure,
    measureDistances,
    unit,
    scores,
    fit,
    bearing,
    followHole,
    setFollowHole,
    setUnit,
    setMeasure,
    selectHole: (i: number) => {
      setHoleIdx(i);
      setMeasure(null);
    },
    round,
    holeShots,
    shotPos,
    stats,
    suggestion,
    selectedClub,
    setSelectedClub,
    setScore: (ref: number, strokes: number) =>
      updateRound((r) => ({
        ...r,
        scores: { ...r.scores, [ref]: strokes },
        pars: hole?.par ? { ...r.pars, [ref]: hole.par } : r.pars,
      })),
    recordShot: () => {
      if (!hole || !shotPos) return;
      updateRound((r) => {
        const count = r.shots.filter((x) => x.hole === hole.ref).length + 1;
        return {
          ...r,
          shots: [...r.shots, { hole: hole.ref, club: selectedClub, pos: shotPos.pos, t: Date.now() }],
          scores: { ...r.scores, [hole.ref]: Math.max(r.scores[hole.ref] ?? 0, count) },
          pars: hole.par ? { ...r.pars, [hole.ref]: hole.par } : r.pars,
        };
      });
      setMeasure(null);
    },
    undoShot: () => {
      const last = holeShots[holeShots.length - 1];
      if (!last) return;
      updateRound((r) => ({ ...r, shots: r.shots.filter((x) => x !== last) }));
    },
    /** Runde ins Archiv und neue Runde beginnen */
    finishRound: () => {
      if (!round || !club) return;
      archiveRound(round);
      setHistory(loadHistory());
      setRound(newRound(club));
      syncRounds();
    },
  };
}
