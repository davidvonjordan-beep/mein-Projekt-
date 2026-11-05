import { useEffect } from 'react';
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
}

function Controller({ focus, onMoved }: Pick<Props, 'focus' | 'onMoved'>) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 0.8 });
  }, [focus, map]);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      const b = map.getBounds();
      const radius = Math.min(50_000, c.distanceTo(b.getNorthEast()));
      onMoved(c.lat, c.lng, radius);
    },
  });
  return null;
}

export function ClubMap({ center, userPos, clubs, selectedId, style, focus, onSelect, onMoved }: Props) {
  return (
    <MapContainer center={center} zoom={11} className="map" zoomControl={false}>
      {style === 'map' ? (
        <TileLayer
          key="osm"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      ) : (
        <TileLayer
          key="sat"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      )}
      <Controller focus={focus} onMoved={onMoved} />
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
