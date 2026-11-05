import L from 'leaflet';
import { CircleMarker, Marker, Polygon, Polyline } from 'react-leaflet';
import type { CourseFeatureKind, CourseHole, CourseLayout, LatLon } from '../types';
import { distM, formatLen, type Unit } from '../lib/courseGeo';

const STYLE: Record<CourseFeatureKind, L.PathOptions> = {
  rough: { color: '#6f9b4a', weight: 0, fillColor: '#6f9b4a', fillOpacity: 0.25 },
  fairway: { color: '#3d9a3d', weight: 1, fillColor: '#5cc15c', fillOpacity: 0.55 },
  tee: { color: '#2f7d2f', weight: 1, fillColor: '#8fdc6f', fillOpacity: 0.8 },
  green: { color: '#1f6e2a', weight: 1.5, fillColor: '#7ee07e', fillOpacity: 0.85 },
  bunker: { color: '#c9a95c', weight: 1, fillColor: '#f1dfa6', fillOpacity: 0.9 },
  water: { color: '#2a6fb5', weight: 1, fillColor: '#4a94dc', fillOpacity: 0.7 },
};
const ORDER: CourseFeatureKind[] = ['rough', 'water', 'fairway', 'tee', 'bunker', 'green'];

const label = (text: string, cls = '') =>
  L.divIcon({ className: '', html: `<div class="dist-label ${cls}">${text}</div>`, iconSize: [0, 0] });

const pinIcon = L.divIcon({ className: '', html: '<div class="flag">⛳</div>', iconSize: [24, 24], iconAnchor: [6, 22] });

const mid = (a: LatLon, b: LatLon): LatLon => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

interface Props {
  layout: CourseLayout;
  hole: CourseHole | null;
  target: LatLon | null;
  player: LatLon | null;
  playerIsGps: boolean;
  measure: LatLon | null;
  unit: Unit;
}

export function CourseOverlay({ layout, hole, target, player, playerIsGps, measure, unit }: Props) {
  const features = [...layout.features].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return (
    <>
      {features.map((f, i) => (
        <Polygon key={`f${i}`} positions={f.polygon} pathOptions={STYLE[f.kind]} interactive={false} />
      ))}
      {layout.holes.map((h) =>
        h === hole ? null : (
          <Polyline key={`h${h.ref}`} positions={h.path} pathOptions={{ color: '#fff', weight: 1.5, opacity: 0.45, dashArray: '4 6' }} interactive={false} />
        ),
      )}
      {hole && (
        <>
          <Polyline positions={hole.path} pathOptions={{ color: '#fff', weight: 3, opacity: 0.9, dashArray: '8 8' }} interactive={false} />
          <Marker position={hole.path[0]} icon={label(`Loch ${hole.ref}`, 'tee-label')} interactive={false} />
        </>
      )}
      {target && <Marker position={target} icon={pinIcon} interactive={false} />}

      {player && measure && target && (
        <>
          <Polyline positions={[player, measure, target]} pathOptions={{ color: '#ffd23f', weight: 3 }} interactive={false} />
          <Marker position={mid(player, measure)} icon={label(formatLen(distM(player, measure), unit) + ' ' + unit)} interactive={false} />
          <Marker position={mid(measure, target)} icon={label(formatLen(distM(measure, target), unit) + ' ' + unit)} interactive={false} />
          <CircleMarker center={measure} radius={7} pathOptions={{ color: '#000', weight: 2, fillColor: '#ffd23f', fillOpacity: 1 }} />
        </>
      )}
      {player && measure && !target && (
        <>
          <Polyline positions={[player, measure]} pathOptions={{ color: '#ffd23f', weight: 3 }} interactive={false} />
          <Marker position={mid(player, measure)} icon={label(formatLen(distM(player, measure), unit) + ' ' + unit)} interactive={false} />
          <CircleMarker center={measure} radius={7} pathOptions={{ color: '#000', weight: 2, fillColor: '#ffd23f', fillOpacity: 1 }} />
        </>
      )}
      {player && (
        <CircleMarker
          center={player}
          radius={9}
          pathOptions={{ color: '#fff', weight: 3, fillColor: playerIsGps ? '#2563eb' : '#9aa5a0', fillOpacity: 1 }}
          interactive={false}
        />
      )}
    </>
  );
}
