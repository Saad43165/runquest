import React, { useEffect, useMemo } from 'react';
import { LatLng } from '../types';
import { MapContainer, TileLayer, Polyline, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default icon paths (webpack/vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Props = {
  region: { latitude: number; longitude: number } | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
  showPolygons?: boolean;
  showPath?: boolean;
  tileStyle?: 'default' | 'dark' | '3d';
  accuracyMeters?: number | null;
  headingDeg?: number | null;
  items?: { id: string; type: 'gem' | 'shield' | 'boost' | 'chest'; latitude: number; longitude: number; collected: boolean }[];
};

// ─── Tile sources — '3d' uses free Esri satellite imagery (no token needed)
const TILES = {
  default: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  '3d':    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// ─── Recenter helper ──────────────────────────────────────────────────────────
function Recenter({ region, tileStyle }: { region: Props['region']; tileStyle: Props['tileStyle'] }) {
  const map = useMap();
  useEffect(() => {
    if (!region) return;
    const zoom = tileStyle === '3d' ? 17 : 15;
    map.setView([region.latitude, region.longitude], map.getZoom() || zoom);
  }, [region, map, tileStyle]);
  return null;
}

// ─── Loot Marker ──────────────────────────────────────────────────────────────
function LootMarker({ item }: { item: NonNullable<Props['items']>[number] }) {
  const map = useMap();
  const icon = useMemo(() => {
    const svgs = {
      gem: `
        <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gemGradWeb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00F0FF" />
              <stop offset="100%" stop-color="#7000FF" />
            </linearGradient>
            <filter id="glowWeb1" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <polygon points="32,6 54,22 44,58 20,58 10,22" fill="url(#gemGradWeb)" stroke="#FFF" stroke-width="2.5" filter="url(#glowWeb1)" />
          <polygon points="32,6 32,58" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
          <polygon points="10,22 54,22" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
        </svg>
      `,
      shield: `
        <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="shieldGradWeb" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#00FF87" />
              <stop offset="100%" stop-color="#60EFFF" />
            </linearGradient>
            <filter id="glowWeb2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <path d="M32 6 C42 6, 52 12, 54 24 C54 42, 32 58, 32 58 C32 58, 10 42, 10 24 C12 12, 22 6, 32 6 Z" fill="url(#shieldGradWeb)" stroke="#FFF" stroke-width="2.5" filter="url(#glowWeb2)" />
          <path d="M32 14 C38 14, 44 18, 45 26 C45 38, 32 48, 32 48 C32 48, 19 38, 19 26 C20 18, 26 14, 32 14 Z" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-dasharray="2,2" />
        </svg>
      `,
      boost: `
        <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="boostGradWeb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF9F0A" />
              <stop offset="100%" stop-color="#FF375F" />
            </linearGradient>
            <filter id="glowWeb3" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <path d="M38 4 L14 34 L30 34 L22 60 L50 26 L32 26 Z" fill="url(#boostGradWeb)" stroke="#FFF" stroke-width="2.5" filter="url(#glowWeb3)" />
        </svg>
      `,
      chest: `
        <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chestGradWeb" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFD60A" />
              <stop offset="100%" stop-color="#FF9F0A" />
            </linearGradient>
            <filter id="glowWeb4" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <rect x="8" y="24" width="48" height="32" rx="6" fill="url(#chestGradWeb)" stroke="#FFF" stroke-width="2.5" filter="url(#glowWeb4)" />
          <rect x="6" y="12" width="52" height="12" rx="3" fill="#FFE066" stroke="#FFF" stroke-width="2.5" filter="url(#glowWeb4)" />
          <circle cx="32" cy="28" r="2.5" fill="#FFD60A" />
        </svg>
      `
    };
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
          transform: translate(-50%, -50%);
          animation: floatAnimation 2.2s infinite ease-in-out;
        ">
          ${svgs[item.type] || '❓'}
        </div>
        <style>
          @keyframes floatAnimation {
            0%, 100% { transform: translate(-50%, -50%) translateY(0) scale(1); }
            50% { transform: translate(-50%, -50%) translateY(-8px) scale(1.08); }
          }
        </style>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }, [item.type]);

  useEffect(() => {
    if (item.collected) return;
    const marker = L.marker([item.latitude, item.longitude], { icon }).addTo(map);
    return () => { marker.remove(); };
  }, [item.latitude, item.longitude, item.collected, icon, map]);

  return null;
}

// ─── Person / direction marker ────────────────────────────────────────────────
function UserMarker({ position, heading }: { position: [number, number] | null; heading: number | null }) {
  const map = useMap();
  const h   = heading ?? 0;

  const icon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:48px;height:64px;">
        <svg width="48" height="64" viewBox="0 0 48 64" style="overflow:visible;" xmlns="http://www.w3.org/2000/svg">
          <!-- Direction chevron — rotates with heading -->
          <g transform="rotate(${h},24,32)">
            <path d="M24 4 L34 18 L24 13 L14 18 Z" fill="#00FF87" opacity="0.95"/>
          </g>
          <!-- Pulse ring (CSS animation via SVG animate) -->
          <circle cx="24" cy="38" r="10" fill="#00FF87" opacity="0.2">
            <animate attributeName="r"       values="10;20;10" dur="1.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.25;0;0.25" dur="1.6s" repeatCount="indefinite"/>
          </circle>
          <!-- Ground shadow -->
          <ellipse cx="24" cy="58" rx="7" ry="3" fill="rgba(0,0,0,0.22)"/>
          <!-- Legs -->
          <path d="M20 46 L17 58 M28 46 L31 58"
                stroke="#141820" stroke-width="3" stroke-linecap="round"/>
          <!-- Torso -->
          <path d="M18 34 L30 34 L28 46 L20 46 Z" fill="#141820"/>
          <!-- Arms -->
          <path d="M18 36 L10 42 M30 36 L38 42"
                stroke="#141820" stroke-width="3" stroke-linecap="round"/>
          <!-- Head -->
          <circle cx="24" cy="27" r="7" fill="#FFDBB5"/>
          <!-- GPS centre dot -->
          <circle cx="24" cy="38" r="3.5" fill="#00FF87"/>
        </svg>
      </div>
    `,
    iconSize:   [48, 64],
    iconAnchor: [24, 48],
  }), [h]);

  useEffect(() => {
    if (!position) return;
    const marker = L.marker(position, { icon, zIndexOffset: 1000 }).addTo(map);
    return () => { marker.remove(); };
  }, [position, icon, map]);

  return null;
}

// ─── Start flag marker ────────────────────────────────────────────────────────
function StartMarker({ position }: { position: [number, number] | null }) {
  const map  = useMap();
  const icon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px;height:36px;
        background:#141820;border:3px solid #00ff87;
        border-radius:999px;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 8px rgba(0,0,0,0.5);
        transform:translate(-50%,-50%);
      ">
        <span style="font-size:18px;">🏁</span>
      </div>
    `,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
  }), []);

  useEffect(() => {
    if (!position) return;
    const marker = L.marker(position, { icon }).addTo(map);
    return () => { marker.remove(); };
  }, [position, icon, map]);

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MapRunView({
  region,
  path,
  polygons,
  showPolygons = true,
  showPath     = true,
  tileStyle    = 'dark',
  accuracyMeters,
  headingDeg,
  items,
}: Props) {
  if (!region) {
    return (
      <div style={{ flex: 1, background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a95a3' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>📍</div>
          <div style={{ marginTop: 12 }}>Waiting for location…</div>
        </div>
      </div>
    );
  }

  const center: [number, number] = [region.latitude, region.longitude];
  const zoom                     = tileStyle === '3d' ? 17 : 15;

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILES[tileStyle ?? 'dark']} maxZoom={19} />

        <Recenter region={region} tileStyle={tileStyle} />
        <UserMarker position={center} heading={headingDeg ?? null} />

        {showPath && path.length > 0 && (
          <>
            <StartMarker position={[path[0].latitude, path[0].longitude]} />
            {/* Shadow stroke for depth */}
            <Polyline
              positions={path.map(p => [p.latitude, p.longitude])}
              pathOptions={{ color: '#00000060', weight: 8, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={path.map(p => [p.latitude, p.longitude])}
              pathOptions={{ color: '#00FF87', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )}

        {showPolygons && polygons.map((p, i) => (
          <Polygon
            key={i}
            positions={p.points.map(pt => [pt.latitude, pt.longitude])}
            pathOptions={{ color: p.color, weight: 2.5, fillColor: p.color, fillOpacity: 0.22 }}
          />
        ))}

        {items && items.map(item => (
          <LootMarker key={item.id} item={item} />
        ))}
      </MapContainer>
    </div>
  );
}