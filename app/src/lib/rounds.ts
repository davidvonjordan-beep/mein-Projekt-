import type { GolfClub, Round, Shot } from '../types';
import { distM } from './courseGeo';
import { read, write } from './storage';

export const CLUBS: Array<{ id: string; label: string }> = [
  { id: 'Dr', label: 'Driver' },
  { id: 'H3', label: 'Holz 3' },
  { id: 'H5', label: 'Holz 5' },
  { id: 'Hy', label: 'Hybrid' },
  { id: 'E4', label: 'Eisen 4' },
  { id: 'E5', label: 'Eisen 5' },
  { id: 'E6', label: 'Eisen 6' },
  { id: 'E7', label: 'Eisen 7' },
  { id: 'E8', label: 'Eisen 8' },
  { id: 'E9', label: 'Eisen 9' },
  { id: 'PW', label: 'Pitching Wedge' },
  { id: 'GW', label: 'Gap Wedge' },
  { id: 'SW', label: 'Sand Wedge' },
  { id: 'LW', label: 'Lob Wedge' },
  { id: 'Pt', label: 'Putter' },
];
export const clubLabel = (id: string) => CLUBS.find((c) => c.id === id)?.label ?? id;

const HISTORY_KEY = 'golfmap.history.v1';
const currentKey = (clubId: string) => `golfmap.current.${clubId}`;

export function newRound(club: GolfClub): Round {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    clubId: club.id,
    clubName: club.name,
    date: new Date().toISOString(),
    scores: {},
    pars: {},
    shots: [],
  };
}

export const loadCurrentRound = (club: GolfClub) => read<Round | null>(currentKey(club.id), null) ?? newRound(club);
export const saveCurrentRound = (r: Round) => write(currentKey(r.clubId), r);
export const loadHistory = () => read<Round[]>(HISTORY_KEY, []);

export const hasData = (r: Round) => Object.keys(r.scores).length > 0 || r.shots.length > 0;

/** Laufende Runde ins Archiv übernehmen (falls etwas gespielt wurde). */
export function archiveRound(r: Round) {
  if (!hasData(r)) return;
  write(HISTORY_KEY, [{ ...r }, ...loadHistory().filter((x) => x.id !== r.id)]);
}

export function deleteRound(id: string) {
  write(HISTORY_KEY, loadHistory().filter((r) => r.id !== id));
}

export function roundTotals(r: Round) {
  const holes = Object.keys(r.scores).map(Number).filter((h) => r.scores[h] > 0);
  const strokes = holes.reduce((s, h) => s + r.scores[h], 0);
  const withPar = holes.filter((h) => r.pars[h]);
  const toPar = withPar.reduce((s, h) => s + r.scores[h] - r.pars[h], 0);
  return { holes: holes.length, strokes, toPar, hasPar: withPar.length > 0 };
}

export const formatToPar = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);

/** Weite jedes Schlags = Abstand zur Position des nächsten Schlags am selben Loch. */
export function shotDistances(shots: Shot[]): Array<{ shot: Shot; distance: number | null }> {
  const sorted = [...shots].sort((a, b) => a.t - b.t);
  return sorted.map((shot, i) => {
    const next = sorted.slice(i + 1).find((s) => s.hole === shot.hole);
    return { shot, distance: next ? distM(shot.pos, next.pos) : null };
  });
}

export interface ClubStat {
  club: string;
  avg: number;
  max: number;
  count: number;
}

export function clubStats(rounds: Round[]): ClubStat[] {
  const byClub = new Map<string, number[]>();
  for (const r of rounds) {
    for (const { shot, distance } of shotDistances(r.shots)) {
      // Putts und unplausible Werte (z. B. GPS-Sprünge) ignorieren
      if (distance == null || shot.club === 'Pt' || distance < 5 || distance > 400) continue;
      byClub.set(shot.club, [...(byClub.get(shot.club) ?? []), distance]);
    }
  }
  return CLUBS.filter((c) => byClub.has(c.id)).map((c) => {
    const d = byClub.get(c.id)!;
    return { club: c.id, avg: d.reduce((s, x) => s + x, 0) / d.length, max: Math.max(...d), count: d.length };
  });
}

/** Schläger, dessen Durchschnittsweite die Entfernung am knappsten erreicht. */
export function suggestClub(stats: ClubStat[], distance: number): ClubStat | null {
  if (!stats.length || distance < 10) return null;
  const reaching = stats.filter((s) => s.avg >= distance * 0.97).sort((a, b) => a.avg - b.avg);
  return reaching[0] ?? [...stats].sort((a, b) => b.avg - a.avg)[0];
}
