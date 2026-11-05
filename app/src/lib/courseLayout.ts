import type { CourseFeature, CourseFeatureKind, CourseHole, CourseLayout, GolfClub, LatLon } from '../types';
import { ENDPOINTS } from './overpass';
import { centroid, distM, pointInPolygon } from './courseGeo';

interface GeomElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

const KIND_BY_TAG: Record<string, CourseFeatureKind> = {
  fairway: 'fairway',
  green: 'green',
  tee: 'tee',
  bunker: 'bunker',
  water_hazard: 'water',
  lateral_water_hazard: 'water',
  rough: 'rough',
};

function buildQuery(club: GolfClub): string {
  const [, type, id] = club.id.split('-'); // osm-way-123
  const golfSel = `way["golf"];node["golf"="pin"];way["natural"="water"];`;
  if (type === 'way' || type === 'relation') {
    const sel = golfSel.replace(/;/g, '(area.c);');
    return `[out:json][timeout:25];${type}(${id});map_to_area->.c;(${sel});out geom;`;
  }
  const sel = golfSel.replace(/;/g, `(around:1500,${club.lat},${club.lon});`);
  return `[out:json][timeout:25];(${sel});out geom;`;
}

export function parseLayout(elements: GeomElement[]): CourseLayout {
  const holes: CourseHole[] = [];
  const features: CourseFeature[] = [];
  const pins: LatLon[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      if (t.golf === 'pin') pins.push([el.lat, el.lon]);
      continue;
    }
    const pts: LatLon[] = (el.geometry ?? []).map((g) => [g.lat, g.lon]);
    if (pts.length < 2) continue;
    if (t.golf === 'hole') {
      const ref = parseInt(t.ref ?? '', 10);
      if (!Number.isFinite(ref)) continue;
      holes.push({
        ref,
        par: parseInt(t.par ?? '', 10) || undefined,
        handicap: parseInt(t.handicap ?? '', 10) || undefined,
        path: pts,
      });
    } else if (pts.length >= 3) {
      const kind = t.golf ? KIND_BY_TAG[t.golf] : t.natural === 'water' ? 'water' : undefined;
      if (kind) features.push({ kind, polygon: pts });
    }
  }
  // Doppelte Lochnummern (z. B. mehrere Plätze in einer Anlage): erste behalten
  const seen = new Set<number>();
  const unique = holes.sort((a, b) => a.ref - b.ref).filter((h) => !seen.has(h.ref) && seen.add(h.ref));
  return { holes: unique, features, pins };
}

export async function fetchCourseLayout(club: GolfClub, signal?: AbortSignal): Promise<CourseLayout> {
  const query = buildQuery(club);
  let lastError: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const json = (await res.json()) as { elements: GeomElement[] };
      return parseLayout(json.elements);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastError = e;
    }
  }
  throw lastError ?? new Error('Overpass nicht erreichbar');
}

export interface HoleTarget {
  /** Zielpunkt: Fahne, sonst Grünmitte, sonst Ende der Spiellinie */
  target: LatLon;
  green: LatLon[] | null;
}

export function holeTarget(hole: CourseHole, layout: CourseLayout): HoleTarget {
  const end = hole.path[hole.path.length - 1];
  const greens = layout.features.filter((f) => f.kind === 'green');
  let green = greens.find((g) => pointInPolygon(end, g.polygon))?.polygon ?? null;
  if (!green) {
    let best = 60; // max. 60 m Abstand
    for (const g of greens) {
      const d = distM(end, centroid(g.polygon));
      if (d < best) {
        best = d;
        green = g.polygon;
      }
    }
  }
  const pin = green ? layout.pins.find((p) => pointInPolygon(p, green!)) : undefined;
  return { target: pin ?? (green ? centroid(green) : end), green };
}
