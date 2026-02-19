import React, { useEffect } from 'react';
import { LatLng } from '../types';
import { MapContainer, TileLayer, Polyline as LeafPolyline, Polygon as LeafPolygon, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Props = {
  region: { latitude: number; longitude: number } | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
};

function Recenter({ region }: { region: Props['region'] }) {
  const map = useMap();
  useEffect(() => {
    if (region) {
      map.setView([region.latitude, region.longitude], map.getZoom());
    }
  }, [region, map]);
  return null;
}

export default function MapRunView({ region, path, polygons }: Props) {
  const center = region ? [region.latitude, region.longitude] : [0, 0];
  const polylinePoints = path.map((p) => [p.latitude, p.longitude]) as [number, number][];
  const containerStyle = { flex: 1, height: '100%', width: '100%' };
  return (
    <div style={containerStyle}>
      <MapContainer {...({ center, zoom: 15, style: containerStyle } as any)}>
        <Recenter region={region} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {polylinePoints.length > 0 && (
          <>
            <Marker position={polylinePoints[0] as any} />
            <LeafPolyline positions={polylinePoints as any} pathOptions={{ color: '#00D1FF', weight: 4 }} />
          </>
        )}
        {polygons.map((p, idx) => (
          <LeafPolygon
            key={idx}
            positions={p.points.map((x) => [x.latitude, x.longitude]) as any}
            pathOptions={{ color: p.color, weight: 2, fillColor: p.color, fillOpacity: 0.25 }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
