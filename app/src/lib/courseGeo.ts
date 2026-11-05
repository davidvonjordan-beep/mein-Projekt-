import type { LatLon } from '../types';

const M_PER_DEG_LAT = 111_320;

/** Lokale Projektion in Meter (für kurze Distanzen auf einem Golfplatz ausreichend genau). */
export function toXY(p: LatLon, origin: LatLon): [number, number] {
  const mLon = M_PER_DEG_LAT * Math.cos((origin[0] * Math.PI) / 180);
  return [(p[1] - origin[1]) * mLon, (p[0] - origin[0]) * M_PER_DEG_LAT];
}

export function fromXY(xy: [number, number], origin: LatLon): LatLon {
  const mLon = M_PER_DEG_LAT * Math.cos((origin[0] * Math.PI) / 180);
  return [origin[0] + xy[1] / M_PER_DEG_LAT, origin[1] + xy[0] / mLon];
}

export function distM(a: LatLon, b: LatLon): number {
  const [x, y] = toXY(b, a);
  return Math.hypot(x, y);
}

export function pathLength(path: LatLon[]): number {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += distM(path[i - 1], path[i]);
  return s;
}

export function centroid(poly: LatLon[]): LatLon {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

export function pointInPolygon(p: LatLon, poly: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface GreenDistances {
  front: number | null;
  center: number;
  back: number | null;
}

/**
 * Entfernungen vom Spieler zum Grün: vorne/hinten = nächster/fernster Punkt
 * des Grüns entlang der Linie Spieler → Grünmitte.
 */
export function greenDistances(player: LatLon, target: LatLon, green: LatLon[] | null): GreenDistances {
  const center = distM(player, target);
  if (!green || green.length < 3) return { front: null, center, back: null };
  const [dx, dy] = toXY(target, player);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let min = Infinity;
  let max = -Infinity;
  for (const v of green) {
    const [x, y] = toXY(v, player);
    const proj = x * ux + y * uy;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  }
  return { front: Math.max(0, min), center, back: max };
}

export type Unit = 'm' | 'yd';
export const formatLen = (m: number, unit: Unit) => `${Math.round(unit === 'm' ? m : m * 1.09361)}`;
