import type { GolfClub } from '../types';

export const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toInt(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function buildAddress(t: Record<string, string>): string | undefined {
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const city = [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ');
  const s = [street, city].filter(Boolean).join(', ');
  return s || undefined;
}

/** Lädt Golfplätze im Umkreis (Meter) um einen Punkt aus OpenStreetMap. */
export async function fetchGolfClubs(
  lat: number,
  lon: number,
  radiusM: number,
  signal?: AbortSignal,
): Promise<GolfClub[]> {
  const query = `[out:json][timeout:25];
nwr["leisure"="golf_course"](around:${Math.round(radiusM)},${lat},${lon});
out center tags;`;

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
      const json = (await res.json()) as { elements: OverpassElement[] };
      return json.elements
        .map((el): GolfClub | null => {
          const t = el.tags ?? {};
          const pos = el.center ?? (el.lat != null ? { lat: el.lat, lon: el.lon! } : null);
          if (!pos) return null;
          return {
            id: `osm-${el.type}-${el.id}`,
            name: t.name || t['name:de'] || 'Golfplatz (ohne Namen)',
            lat: pos.lat,
            lon: pos.lon,
            holes: toInt(t.holes ?? t['golf:holes']),
            par: toInt(t.par ?? t['golf:par']),
            website: t.website || t['contact:website'] || t.url,
            phone: t.phone || t['contact:phone'],
            email: t.email || t['contact:email'],
            address: buildAddress(t),
            openingHours: t.opening_hours,
            description: t.description,
            source: 'osm',
          };
        })
        .filter((c): c is GolfClub => c !== null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      lastError = e;
    }
  }
  throw lastError ?? new Error('Overpass nicht erreichbar');
}
