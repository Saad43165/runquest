import React, { useRef, useEffect, memo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Region } from 'react-native-maps';
import { LatLng } from '../types';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  green:  '#00FF87',
  accent: '#00C6FF',
  white:  '#F0F4F8',
  black:  '#080A0E',
  card:   '#141820',
  border: '#1E2530',
  red:    '#FF4B4B',
};

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  region: Region | null;
  path: LatLng[];
  polygons: { points: LatLng[]; color: string }[];
  showPolygons?: boolean;
  showPath?: boolean;
  tileStyle?: 'default' | 'dark' | '3d';
  accuracyMeters?: number | null;
  headingDeg?: number | null;
};

// ─── Build Leaflet HTML ───────────────────────────────────────────────────────
function buildLeafletHTML(
  lat: number,
  lng: number,
  tileStyle: 'default' | 'dark' | '3d',
  path: LatLng[],
  polygons: { points: LatLng[]; color: string }[],
  showPath: boolean,
  showPolygons: boolean,
  accuracyMeters: number | null,
  headingDeg: number | null,
): string {
  const pathJSON     = JSON.stringify(path.map(p => [p.latitude, p.longitude]));
  const polygonsJSON = JSON.stringify(
    polygons.map(p => ({ points: p.points.map(pp => [pp.latitude, pp.longitude]), color: p.color }))
  );
  const heading  = headingDeg ?? 0;
  const darkMode = tileStyle === 'dark' || tileStyle === '3d';

  // Tile URLs — for '3d' we use an Esri satellite layer (free, no token needed)
  const tileUrl = tileStyle === '3d'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : darkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const bgColor = darkMode ? '#0d1117' : '#f8fafc';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; background:${bgColor}; }
  .leaflet-control-attribution { display:none; }
  .leaflet-control-zoom { border:none !important; }
  .leaflet-control-zoom a {
    background:${darkMode ? '#1c2230' : '#ffffff'} !important;
    color:${darkMode ? '#e0e8f0' : '#333'} !important;
    border:1px solid ${darkMode ? '#2a3550' : '#ccc'} !important;
    border-radius:8px !important;
    width:32px !important; height:32px !important;
    line-height:30px !important; font-size:18px !important;
    margin-bottom:4px !important; display:block !important;
  }
  @keyframes pulse {
    0%   { transform:scale(1); opacity:0.7; }
    100% { transform:scale(2.5); opacity:0; }
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
// ── Map init ──────────────────────────────────────────────────────────────────
var is3D = ${tileStyle === '3d' ? 'true' : 'false'};
var map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
  zoomAnimation: true,
});
L.tileLayer('${tileUrl}', { maxZoom: 19 }).addTo(map);
map.setView([${lat}, ${lng}], is3D ? 17 : 16);

// ── Person / direction marker ─────────────────────────────────────────────────
function buildPersonIcon(headingDeg) {
  var h = headingDeg || 0;
  return L.divIcon({
    className: '',
    html: \`
      <div style="position:relative;width:48px;height:64px;">
        <!-- direction chevron -->
        <svg style="position:absolute;top:0;left:0" width="48" height="64" viewBox="0 0 48 64" overflow="visible">
          <g transform="rotate(\${h},24,32)">
            <path d="M24 4 L34 18 L24 13 L14 18 Z" fill="#00FF87" opacity="0.95"/>
          </g>
          <!-- pulse ring -->
          <circle cx="24" cy="38" r="14" fill="#00FF87" opacity="0.15">
            <animate attributeName="r" values="10;18;10" dur="1.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.3;0;0.3" dur="1.6s" repeatCount="indefinite"/>
          </circle>
          <!-- ground shadow -->
          <ellipse cx="24" cy="58" rx="7" ry="3" fill="rgba(0,0,0,0.25)"/>
          <!-- legs -->
          <path d="M20 46 L17 58 M28 46 L31 58" stroke="#141820" stroke-width="3" stroke-linecap="round"/>
          <!-- torso -->
          <path d="M18 34 L30 34 L28 46 L20 46 Z" fill="#141820"/>
          <!-- arms -->
          <path d="M18 36 L10 42 M30 36 L38 42" stroke="#141820" stroke-width="3" stroke-linecap="round"/>
          <!-- head -->
          <circle cx="24" cy="27" r="7" fill="#FFDBB5"/>
          <!-- GPS dot -->
          <circle cx="24" cy="38" r="3.5" fill="#00FF87"/>
        </svg>
      </div>
    \`,
    iconSize: [48, 64],
    iconAnchor: [24, 48],
  });
}

var currentHeading = ${heading};
var userMarker = L.marker([${lat}, ${lng}], {
  icon: buildPersonIcon(currentHeading),
  zIndexOffset: 1000,
}).addTo(map);

// ── Accuracy circle ───────────────────────────────────────────────────────────
${accuracyMeters && accuracyMeters > 0 && accuracyMeters < 300 ? `
var accuracyCircle = L.circle([${lat}, ${lng}], {
  radius: ${accuracyMeters},
  color: '#00C6FF', fillColor: '#00C6FF',
  fillOpacity: 0.08, weight: 1.5, opacity: 0.5,
}).addTo(map);
` : 'var accuracyCircle = null;'}

// ── Run path ──────────────────────────────────────────────────────────────────
var pathCoords = ${pathJSON};
var pathLayer = null, shadowLayer = null, startMarker = null;

function drawPath() {
  if (pathLayer)   { map.removeLayer(pathLayer);   pathLayer   = null; }
  if (shadowLayer) { map.removeLayer(shadowLayer); shadowLayer = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (pathCoords.length >= 2 && ${showPath}) {
    shadowLayer = L.polyline(pathCoords, {
      color: '#00000060', weight: 8, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    pathLayer = L.polyline(pathCoords, {
      color: '#00FF87', weight: 4, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    var startIcon = L.divIcon({
      className: '',
      html: '<div style="width:24px;height:24px;background:#00FF87;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px #0006;"></div>',
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    startMarker = L.marker(pathCoords[0], { icon: startIcon }).addTo(map);
  }
}
drawPath();

// ── Polygons ──────────────────────────────────────────────────────────────────
var polygonLayers = [];
var polygonsData  = ${polygonsJSON};

function drawPolygons() {
  polygonLayers.forEach(function(l) { map.removeLayer(l); });
  polygonLayers = [];
  if (${showPolygons}) {
    polygonsData.forEach(function(poly) {
      var l = L.polygon(poly.points, {
        color: poly.color, fillColor: poly.color,
        fillOpacity: 0.22, weight: 2.5,
      }).addTo(map);
      polygonLayers.push(l);
    });
  }
}
drawPolygons();

// ── Message handler ───────────────────────────────────────────────────────────
function handleMsg(raw) {
  try {
    var msg = JSON.parse(raw);
    if (msg.type === 'UPDATE') {
      // Update heading + rebuild icon only when it actually changed
      if (msg.heading !== undefined && msg.heading !== currentHeading) {
        currentHeading = msg.heading;
        userMarker.setIcon(buildPersonIcon(currentHeading));
      }
      userMarker.setLatLng([msg.lat, msg.lng]);
      if (accuracyCircle) { accuracyCircle.setLatLng([msg.lat, msg.lng]); }
      if (msg.recenter)   { map.setView([msg.lat, msg.lng], map.getZoom(), { animate: true }); }
      if (msg.path     !== undefined) { pathCoords   = msg.path;     drawPath();     }
      if (msg.polygons !== undefined) { polygonsData = msg.polygons; drawPolygons(); }
    } else if (msg.type === 'RECENTER') {
      map.setView([msg.lat, msg.lng], 16, { animate: true });
    }
  } catch(e) {}
}

document.addEventListener('message', function(e) { handleMsg(e.data); });
window.addEventListener('message',   function(e) { handleMsg(e.data); });
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
function MapRunView({
  region,
  path,
  polygons,
  showPolygons  = true,
  showPath      = true,
  tileStyle     = 'dark',
  accuracyMeters = null,
  headingDeg    = null,
}: Props) {
  const webRef          = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const prevRegionRef   = useRef<Region | null>(null);
  const prevHeadingRef  = useRef<number | null>(null);

  useEffect(() => {
    if (!mapReady || !webRef.current || !region) return;

    const prev    = prevRegionRef.current;
    const moved   = !prev
      || Math.abs(prev.latitude  - region.latitude)  > 0.00001
      || Math.abs(prev.longitude - region.longitude) > 0.00001;
    prevRegionRef.current = region;

    const headingChanged = headingDeg !== prevHeadingRef.current;
    prevHeadingRef.current = headingDeg;

    const msg = {
      type:     'UPDATE',
      lat:      region.latitude,
      lng:      region.longitude,
      heading:  headingDeg ?? 0,
      recenter: moved,
      path:     showPath
        ? path.map(p => [p.latitude, p.longitude])
        : [],
      polygons: showPolygons
        ? polygons.map(p => ({ points: p.points.map(pp => [pp.latitude, pp.longitude]), color: p.color }))
        : [],
    };
    webRef.current.postMessage(JSON.stringify(msg));
  }, [region, path, polygons, showPath, showPolygons, headingDeg, mapReady]);

  if (!region) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="location-outline" size={48} color={C.border} />
        <Text style={{ color: C.white, marginTop: 12, fontSize: 16 }}>Waiting for location…</Text>
        <Text style={{ color: C.border, marginTop: 6,  fontSize: 12 }}>Please allow location access</Text>
      </View>
    );
  }

  const html = buildLeafletHTML(
    region.latitude, region.longitude,
    tileStyle,
    path, polygons,
    showPath, showPolygons,
    accuracyMeters,
    headingDeg,
  );

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onLoadEnd={() => setMapReady(true)}
        onError={e => console.warn('Map WebView error:', e.nativeEvent)}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="map-outline" size={40} color={C.border} />
          <Text style={{ color: C.white, marginTop: 12, fontSize: 14 }}>Loading map…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.black },
  webview:        { flex: 1, backgroundColor: 'transparent' },
  placeholder:    { flex: 1, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
});

export default memo(MapRunView);