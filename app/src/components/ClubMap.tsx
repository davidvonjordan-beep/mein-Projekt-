import { useEffect, type ReactNode } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { GolfClub, LatLon } from '../types';
import { fromXY, toXY } from '../lib/courseGeo';

export type MapStyle = 'map' | 'satellite';

const flagIcon = (active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="pin${active ? ' pin-active' : ''}"><span>⛳</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
  });

interface Props {
  center: [number, number];
  userPos: [number, number] | null;
  clubs: GolfClub[];
  selectedId: string | null;
  style: MapStyle;
  focus: { lat: number; lon: number; zoom: number } | null;
  onSelect: (id: string) => void;
  onMoved: (lat: number, lon: number, radiusM: number) => void;
  fit?: { points: [number, number][]; key: number } | null;
  /** Kartendrehung in Grad (Kompassrichtung, die oben liegt); 0 = Norden oben */
  bearing?: number;
  onMapClick?: (lat: number, lon: number) => void;
  children?: ReactNode;
}

/**
 * Berechnet Mittelpunkt und Zoom, damit alle Punkte bei gegebener Kartendrehung
 * in den freien Bereich (abzüglich Padding) passen.
 */
function fitRotated(map: L.Map, points: LatLon[], bearing: number, padTL: [number, number], padBR: [number, number]) {
  const origin = points[0];
  const h = (bearing * Math.PI) / 180;
  const [sin, cos] = [Math.sin(h), Math.cos(h)];
  // In ein Bildschirm-Koordinatensystem drehen: right/up
  const rotated = points.map((p) => {
    const [x, y] = toXY(p, origin);
    return [x * cos - y * sin, x * sin + y * cos];
  });
  const rs = rotated.map((r) => r[0]);
  const us = rotated.map((r) => r[1]);
  const [minR, maxR, minU, maxU] = [Math.min(...rs), Math.max(...rs), Math.min(...us), Math.max(...us)];
  const size = map.getSize();
  const availW = Math.max(50, size.x - padTL[0] - padBR[0]);
  const availH = Math.max(50, size.y - padTL[1] - padBR[1]);
  const mpp = Math.max((maxR - minR) / availW, (maxU - minU) / availH, 0.15) * 1.1;
  const zoomRaw = Math.log2((156543.03 * Math.cos((origin[0] * Math.PI) / 180)) / mpp);
  const zoom = Math.min(map.getMaxZoom(), Math.floor(zoomRaw * 4) / 4);
  const mppZ = (156543.03 * Math.cos((origin[0] * Math.PI) / 180)) / 2 ** zoom;
  // Mitte des freien Bereichs liegt um (dx, dy) Pixel neben der Kartenmitte
  const dx = (padTL[0] - padBR[0]) / 2;
  const dy = (padTL[1] - padBR[1]) / 2;
  const cR = (minR + maxR) / 2 - dx * mppZ;
  const cU = (minU + maxU) / 2 + dy * mppZ;
  const center = fromXY([cR * cos + cU * sin, -cR * sin + cU * cos], origin);
  return { center, zoom };
}

function Controller({ focus, fit, bearing = 0, onMoved, onMapClick }: Pick<Props, 'focus' | 'fit' | 'bearing' | 'onMoved' | 'onMapClick'>) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 0.8 });
  }, [focus, map]);
  useEffect(() => {
    // leaflet-rotate dreht die Karte im Uhrzeigersinn; damit die Kompassrichtung
    // `bearing` oben liegt, muss sie gegen den Uhrzeigersinn gedreht werden.
    map.setBearing((360 - bearing) % 360);
  }, [bearing, map]);
  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    const desktop = window.innerWidth >= 768;
    const padTL: [number, number] = desktop ? [410, 80] : [30, 80];
    const padBR: [number, number] = desktop ? [70, 30] : [30, Math.round(window.innerHeight * 0.55)];
    const { center, zoom } = fitRotated(map, fit.points, bearing, padTL, padBR);
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [fit, bearing, map]);
  useMapEvents({
    click: (e) => onMapClick?.(e.latlng.lat, e.latlng.lng),
    moveend: () => {
      const c = map.getCenter();
      const b = map.getBounds();
      const radius = Math.min(50_000, c.distanceTo(b.getNorthEast()));
      onMoved(c.lat, c.lng, radius);
    },
  });
  return null;
}

export function ClubMap({ center, userPos, clubs, selectedId, style, focus, fit, bearing = 0, onSelect, onMoved, onMapClick, children }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={11}
      maxZoom={20}
      zoomSnap={0.25}
      className="map"
      zoomControl={false}
      rotate
      rotateControl={false}
      touchRotate={false}
      shiftKeyRotate={false}
    >
      {style === 'map' ? (
        <TileLayer
          key="osm"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
          maxNativeZoom={19}
        />
      ) : (
        <TileLayer
          key="sat"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
          maxNativeZoom={19}
        />
      )}
      <Controller focus={focus} fit={fit} bearing={bearing} onMoved={onMoved} onMapClick={onMapClick} />
      {children}
      {userPos && (
        <CircleMarker center={userPos} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />
      )}
      {clubs.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lon]}
          icon={flagIcon(c.id === selectedId)}
          zIndexOffset={c.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(c.id) }}
          title={c.name}
        />
      ))}
    </MapContainer>
  );
}
