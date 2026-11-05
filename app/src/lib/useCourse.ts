import { useEffect, useMemo, useState } from 'react';
import type { CourseLayout, GolfClub, LatLon } from '../types';
import { fetchCourseLayout, holeTarget } from './courseLayout';
import { demoCourseLayout } from '../data/demoCourse';
import { distM, greenDistances, type Unit } from './courseGeo';
import { loadScores, saveScores } from './storage';

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
  const [scores, setScores] = useState<Record<number, number>>({});
  const [fitKey, setFitKey] = useState(0);

  // Platzdaten laden
  useEffect(() => {
    setLayout(null);
    setNotice(null);
    setHoleIdx(0);
    setMeasure(null);
    if (!club) return;
    setScores(loadScores(club.id));
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
    if (club) saveScores(club.id, scores);
  }, [club, scores]);

  const hole = layout?.holes[holeIdx] ?? null;
  const target = useMemo(() => (hole && layout ? holeTarget(hole, layout) : null), [hole, layout]);
  const onCourse = !!(gps && club && distM(gps.pos, [club.lat, club.lon]) < ON_COURSE_RADIUS_M);
  const player: LatLon | null = onCourse ? gps!.pos : hole?.path[0] ?? null;

  const distances = player && target ? greenDistances(player, target.target, target.green) : null;
  const measureDistances =
    player && measure
      ? { toPoint: distM(player, measure), pointToGreen: target ? distM(measure, target.target) : null }
      : null;

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
    setUnit,
    setMeasure,
    selectHole: (i: number) => {
      setHoleIdx(i);
      setMeasure(null);
    },
    setScore: (ref: number, strokes: number) => setScores((s) => ({ ...s, [ref]: strokes })),
    resetScores: () => setScores({}),
  };
}
