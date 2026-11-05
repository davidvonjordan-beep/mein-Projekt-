import type { GolfClub, Round, Shot } from '../types';
import { distM } from './courseGeo';
import { read, write } from './storage';
import { api, getToken } from './api';

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
const DELETED_KEY = 'golfmap.deleted.v1';
const CURRENT_PREFIX = 'golfmap.current.';
const currentKey = (clubId: string) => CURRENT_PREFIX + clubId;

/** Wird ausgelöst, wenn sich gespeicherte Runden geändert haben (z. B. nach dem Abgleich). */
export const ROUNDS_CHANGED = 'golfmap:rounds-changed';
const notify = () => window.dispatchEvent(new Event(ROUNDS_CHANGED));

export function newRound(club: GolfClub): Round {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    clubId: club.id,
    clubName: club.name,
    date: new Date().toISOString(),
    scores: {},
    pars: {},
    shots: [],
    updatedAt: Date.now(),
  };
}

const withDefaults = (r: Round): Round => ({ ...r, updatedAt: r.updatedAt ?? Date.parse(r.date) });

export const loadCurrentRound = (club: GolfClub) => {
  const r = read<Round | null>(currentKey(club.id), null);
  return r ? withDefaults(r) : newRound(club);
};
export const saveCurrentRound = (r: Round) => write(currentKey(r.clubId), r);
export const loadHistory = () => read<Round[]>(HISTORY_KEY, []).map(withDefaults);
const saveHistory = (h: Round[]) => write(HISTORY_KEY, h.sort((a, b) => b.date.localeCompare(a.date)));

export const hasData = (r: Round) => Object.keys(r.scores).length > 0 || r.shots.length > 0;

/** Laufende Runde ins Archiv übernehmen (falls etwas gespielt wurde). */
export function archiveRound(r: Round) {
  if (!hasData(r)) return;
  saveHistory([{ ...r, finished: true, updatedAt: Date.now() }, ...loadHistory().filter((x) => x.id !== r.id)]);
}

export function deleteRound(id: string) {
  saveHistory(loadHistory().filter((r) => r.id !== id));
  write(DELETED_KEY, [...new Set([...read<string[]>(DELETED_KEY, []), id])]);
}

function listCurrentRounds(): Round[] {
  const out: Round[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CURRENT_PREFIX)) {
        const r = read<Round | null>(key, null);
        if (r) out.push(withDefaults(r));
      }
    }
  } catch {
    /* Speicher nicht verfügbar */
  }
  return out;
}

/** Entfernt alle Rundendaten vom Gerät (z. B. beim Abmelden). */
export function clearLocalRounds() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(CURRENT_PREFIX) || k === HISTORY_KEY || k === DELETED_KEY)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignorieren */
  }
  notify();
}

let syncing: Promise<void> | null = null;

/**
 * Gleicht lokale Runden mit dem Server ab: Löschungen und neue/geänderte
 * Runden hochladen, dann Server-Stand übernehmen (neuere Version gewinnt).
 * Ohne Anmeldung oder Netz passiert nichts – die Daten bleiben lokal.
 */
export function syncRounds(): Promise<void> {
  if (!getToken()) return Promise.resolve();
  if (!syncing) {
    syncing = doSync()
      .catch(() => {
        /* offline – nächster Versuch später */
      })
      .finally(() => {
        syncing = null;
      });
  }
  return syncing;
}

async function doSync() {
  // 1. Löschungen übertragen
  const deleted = read<string[]>(DELETED_KEY, []);
  for (const id of deleted) {
    await api.deleteRound(id);
    write(DELETED_KEY, read<string[]>(DELETED_KEY, []).filter((x) => x !== id));
  }

  // 2. Lokale Änderungen hochladen
  const push = async (r: Round) => {
    if (r.syncedAt && r.syncedAt >= r.updatedAt) return null;
    if (!r.finished && !hasData(r)) return null; // leere laufende Runde nicht hochladen
    await api.putRound({ ...r, syncedAt: undefined });
    return { ...r, syncedAt: r.updatedAt };
  };
  const history = loadHistory();
  for (let i = 0; i < history.length; i++) {
    const synced = await push(history[i]);
    if (synced) {
      history[i] = synced;
      saveHistory(history);
    }
  }
  for (const r of listCurrentRounds()) {
    const synced = await push(r);
    if (synced) {
      const latest = read<Round | null>(currentKey(r.clubId), null);
      if (latest?.id === r.id && latest.updatedAt === r.updatedAt) saveCurrentRound(synced);
    }
  }

  // 3. Server-Stand übernehmen
  const server = await api.rounds();
  const serverIds = new Set(server.map((r) => r.id));
  const merged = new Map(
    loadHistory()
      // auf einem anderen Gerät gelöschte Runden entfernen
      .filter((r) => !r.syncedAt || serverIds.has(r.id))
      .map((r) => [r.id, r] as const),
  );
  for (const s of server) {
    const remote: Round = { ...s, syncedAt: s.updatedAt };
    if (s.finished) {
      const local = merged.get(s.id);
      if (!local || local.updatedAt <= s.updatedAt) merged.set(s.id, remote);
      const cur = read<Round | null>(currentKey(s.clubId), null);
      if (cur?.id === s.id) write(currentKey(s.clubId), null);
    } else {
      const cur = read<Round | null>(currentKey(s.clubId), null);
      if (!cur || (cur.updatedAt ?? 0) < s.updatedAt) saveCurrentRound(remote);
    }
  }
  saveHistory([...merged.values()]);
  notify();
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
