import { useEffect, type ReactNode } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { GolfClub } from '../types';

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
  onMapClick?: (lat: number, lon: number) => void;
  children?: ReactNode;
}

function Controller({ focus, fit, onMoved, onMapClick }: Pick<Props, 'focus' | 'fit' | 'onMoved' | 'onMapClick'>) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 0.8 });
  }, [focus, map]);
  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    const desktop = window.innerWidth >= 768;
    map.flyToBounds(L.latLngBounds(fit.points), {
      paddingTopLeft: desktop ? [410, 80] : [30, 80],
      paddingBottomRight: desktop ? [70, 30] : [30, Math.round(window.innerHeight * 0.55)],
      maxZoom: 18,
      duration: 0.8,
    });
  }, [fit, map]);
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

export function ClubMap({ center, userPos, clubs, selectedId, style, focus, fit, onSelect, onMoved, onMapClick, children }: Props) {
  return (
    <MapContainer center={center} zoom={11} maxZoom={20} className="map" zoomControl={false}>
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
      <Controller focus={focus} fit={fit} onMoved={onMoved} onMapClick={onMapClick} />
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
