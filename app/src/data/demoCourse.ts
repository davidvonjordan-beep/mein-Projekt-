import type { CourseFeature, CourseHole, CourseLayout, LatLon } from '../types';
import { fromXY } from '../lib/courseGeo';

type XY = [number, number];

const PARS = [4, 3, 5, 4, 4, 3, 4, 5, 4];
const LENGTHS: Record<number, number> = { 3: 160, 4: 350, 5: 470 };

const rot = ([x, y]: XY, a: number): XY => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];

function ellipse(c: XY, rx: number, ry: number, angle: number, n = 20): XY[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return add(c, rot([rx * Math.cos(t), ry * Math.sin(t)], angle));
  });
}

/** Abgerundeter Streifen (Fairway) entlang eines Segments a→b */
function strip(a: XY, b: XY, width: number): XY[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const r = width / 2;
  const cap = (c: XY, from: number): XY[] =>
    Array.from({ length: 9 }, (_, i) => {
      const t = ang + from + (i / 8) * Math.PI;
      return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
    });
  return [...cap(b, -Math.PI / 2), ...cap(a, Math.PI / 2)];
}

/** Erzeugt einen fiktiven 9-Loch-Platz rund um den Demo-Club. */
export function demoCourseLayout(center: LatLon): CourseLayout {
  const holes: CourseHole[] = [];
  const features: CourseFeature[] = [];
  const pins: LatLon[] = [];
  const ll = (p: XY) => fromXY(p, center);
  const poly = (pts: XY[]) => pts.map(ll);

  let pos: XY = [-250, -350];
  let heading = Math.PI / 2.6;

  PARS.forEach((par, i) => {
    const len = LENGTHS[par] + ((i * 37) % 40);
    const dir = (d: number, side = 0): XY => add(pos, rot([d, side], heading));
    const bend = par === 3 ? 0 : (i % 2 ? 1 : -1) * 25;
    const tee = pos;
    const mid = dir(len * 0.6, bend);
    const green = dir(len, bend * 0.4);
    const path = par === 3 ? [tee, green] : [tee, mid, green];

    features.push({ kind: 'tee', polygon: poly(ellipse(tee, 10, 6, heading, 8)) });
    if (par !== 3) {
      features.push({ kind: 'fairway', polygon: poly(strip(dir(len * 0.4, bend * 0.6), mid, 38)) });
      features.push({ kind: 'fairway', polygon: poly(strip(mid, dir(len - 28, bend * 0.45), 32)) });
      features.push({ kind: 'bunker', polygon: poly(ellipse(dir(len * 0.62, bend - 26), 12, 7, heading, 14)) });
    }
    features.push({ kind: 'green', polygon: poly(ellipse(green, 17, 13, heading, 24)) });
    features.push({ kind: 'bunker', polygon: poly(ellipse(add(green, rot([-6, 21], heading)), 10, 5, heading, 14)) });
    if (i === 3) features.push({ kind: 'water', polygon: poly(ellipse(dir(len * 0.82, -48), 30, 18, heading + 0.4, 20)) });
    pins.push(ll(add(green, rot([((i * 5) % 9) - 4, ((i * 3) % 7) - 3], heading))));
    holes.push({ ref: i + 1, par, handicap: ((i * 5) % 9) + 1, path: path.map(ll) });

    pos = add(green, rot([25, 30], heading));
    heading += (Math.PI * 2) / PARS.length;
  });

  return { holes, features, pins };
}
